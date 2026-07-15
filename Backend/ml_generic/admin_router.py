"""
ml_generic/admin_router.py

FastAPI router wrapping the config-driven training pipeline
(config_loader.py / data_loader.py / train_generic.py / evaluate_generic.py /
predict_generic.py -- all in this same ml_generic/ folder).

Mount this into your existing main.py WITHOUT touching the existing
/train, /predict, /predict_s5 routes:

    from ml_generic.admin_router import router as admin_router
    app.include_router(admin_router)

All new routes are prefixed /api/... so they can't collide with the
existing routes. This uses a SEPARATE staging/live directory from your
existing ml/ pipeline (ml_generic/staging, ml_generic/live) -- it does not
read or write anything under ml/models or data/predictions, so the
existing /train, /predict, /predict_s5 behavior is completely unaffected.

Design principle (per the Admin-scope discussion): the admin can only
declare BUSINESS facts through these endpoints -- which columns are
features, what the outcome is, when each variable becomes available, and
what "high risk" means. Model type, cross-validation strategy, minimum
sample size, and threshold-selection logic remain fixed in train_generic.py
and are not exposed here.
"""

from pathlib import Path
import json
import os
import shutil
import subprocess
import sys

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header
import firebase_admin
from firebase_admin import auth
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal

try:
    import anthropic
except ImportError:
    anthropic = None  # the /polish_recommendations endpoint will report a clear error instead of crashing on import

BASE_DIR = Path(__file__).resolve().parent  # .../Backend/ml_generic
STAGING_DIR = BASE_DIR / "staging"
LIVE_DIR = BASE_DIR / "live"
UPLOADS_DIR = BASE_DIR / "uploads"
FEATURE_METADATA_PATH = BASE_DIR / "feature_metadata.json"

for d in (STAGING_DIR, LIVE_DIR, UPLOADS_DIR):
    d.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/api", tags=["admin_training"])


# ---------------------------------------------------------------------
# Single source of truth for "human-readable course name" and "what
# resources exist for this feature" -- lives on the BACKEND now, not
# guessed independently in the frontend (COURSE_NAMES / RESOURCE_HINTS
# in recommendations.js). Keyed per-feature (CT1/OB/Comm/Men/...) so
# each flagged factor pulls its OWN actions, instead of every subject
# sharing one flat resource list regardless of which course actually
# triggered the flag.
#
# IMPORTANT: the values in feature_metadata.json are placeholders and
# must be verified by an admin against real course names and real
# support resources before this is used with actual students -- Claude
# never invents or edits these entries on its own.
# ---------------------------------------------------------------------
def _load_feature_metadata() -> Dict[str, Any]:
    if not FEATURE_METADATA_PATH.exists():
        return {}
    with open(FEATURE_METADATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    data.pop("_comment", None)
    return data


def _display_name(feature: str, metadata: Dict[str, Any]) -> str:
    return metadata.get(feature, {}).get("display_name", feature)


def _normalize_hint(hint: Any) -> Optional[Dict[str, Any]]:
    """
    Accepts either the OLD feature_metadata.json format (a plain string
    resource hint) or the NEW format (a {"label": ..., "url": ...} object),
    and normalizes to the latter. This keeps existing entries working
    while the JSON file is migrated feature-by-feature.
    """
    if isinstance(hint, str):
        return {"label": hint, "url": None}
    if isinstance(hint, dict) and hint.get("label"):
        return {"label": hint["label"], "url": hint.get("url")}
    return None


def _resolve_action_objects(
    factors: List[Dict[str, Any]],
    metadata: Dict[str, Any],
    max_actions: int = 4,
) -> List[Dict[str, Any]]:
    """
    Same per-factor resolution as _resolve_actions_for_factors, but keeps
    the full {"label": ..., "url": ...} object instead of collapsing to a
    label string -- used for the admin-facing decision_support panel,
    where a real (human-verified, never AI-generated) link should be
    clickable. `url` is None wherever feature_metadata.json hasn't been
    given a real link yet; the frontend renders those as plain text
    instead of a broken/placeholder link.
    """
    seen_labels: List[str] = []
    results: List[Dict[str, Any]] = []
    for f in factors:
        if f.get("contribution", 0) <= 0:
            continue
        raw_hints = metadata.get(f.get("feature"), {}).get("resource_hints", [])
        for raw in raw_hints:
            normalized = _normalize_hint(raw)
            if not normalized or normalized["label"] in seen_labels:
                continue
            seen_labels.append(normalized["label"])
            results.append(normalized)
    return results[:max_actions]


def _resolve_actions_for_factors(
    factors: List[Dict[str, Any]],
    metadata: Dict[str, Any],
    max_actions: int = 4,
) -> List[str]:
    """
    Label-only version, used for the student-facing AI-polish prompt --
    Claude only ever sees resource CATEGORY labels (e.g. "study group"),
    never a URL, so there's no risk of it mangling, inventing, or
    mis-copying a link into freeform text.
    """
    return [a["label"] for a in _resolve_action_objects(factors, metadata, max_actions)]


# ---------------------------------------------------------------------
# Exposes feature_metadata.json to the frontend so recommendations.js can
# drop its own hardcoded COURSE_NAMES / RESOURCE_HINTS copies and read the
# single backend source of truth instead. Read-only; admins edit the JSON
# file directly on disk, not through this API.
# ---------------------------------------------------------------------
@router.get("/feature_metadata")
def get_feature_metadata():
    return _load_feature_metadata()


def project_staging_dir(name: str) -> Path:
    return STAGING_DIR / name


def project_live_dir(name: str) -> Path:
    return LIVE_DIR / name


def project_data_dir(name: str) -> Path:
    return UPLOADS_DIR / name / "processed"


# ---------------------------------------------------------------------
# Request schemas -- these ARE the "business configuration" surface.
# Anything not listed here (model type, CV strategy, min sample size,
# threshold-search method) is intentionally not exposed to the admin.
# ---------------------------------------------------------------------
class VariableRelationship(BaseModel):
    feature: str
    available_from_stage: int


class ProjectCreateRequest(BaseModel):
    project_name: str
    id_column: str
    target_column: str
    risk_direction: Literal["low_is_bad", "high_is_bad"]
    risk_threshold: float
    excluded_features: List[str] = Field(default_factory=list)
    variable_relationships: List[VariableRelationship]
    # Reliability bar is business-tunable but deliberately restricted to a
    # small set of sane presets rather than an arbitrary float, so it can't
    # be quietly loosened to make an unreliable stage look "reliable".
    reliability_recall_threshold: Literal[0.70, 0.85, 0.95] = 0.70


class PublishRequest(BaseModel):
    confirm: bool = False


class PredictRequest(BaseModel):
    project_name: str
    subject_id: str = "unknown"
    feature_values: Dict[str, float]


# ---------------------------------------------------------------------
# 1. Declare the project (business config only -- see class above)
# ---------------------------------------------------------------------
@router.post("/projects")
def create_project(body: ProjectCreateRequest):
    if not body.variable_relationships:
        raise HTTPException(400, "variable_relationships must be non-empty")

    stage_numbers = sorted({r.available_from_stage for r in body.variable_relationships})
    stages = {}
    for stage_num in stage_numbers:
        features_so_far = [
            r.feature for r in body.variable_relationships
            if r.available_from_stage <= stage_num
        ]
        stages[f"stage_{stage_num}"] = features_so_far

    staging_dir = project_staging_dir(body.project_name)
    staging_dir.mkdir(parents=True, exist_ok=True)

    config = {
        "project_name": body.project_name,
        "data_source": "csv",
        "id_column": body.id_column,
        "target_column": body.target_column,
        "risk_direction": body.risk_direction,
        "risk_threshold": body.risk_threshold,
        "excluded_features": body.excluded_features,
        "stages": stages,
        "train_cohorts": [],
        "holdout_cohorts": [],
        "data_dir": str(project_data_dir(body.project_name)),
        "file_pattern": "{cohort}.csv",
        # NOTE: min_train_samples is intentionally NOT settable by the
        # admin -- it's a data-science safety floor, fixed here.
        "min_train_samples": 30,
        "reliability_recall_threshold": body.reliability_recall_threshold,
    }

    config_path = staging_dir / "project_config.json"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    return {
        "status": "ok",
        "project_name": body.project_name,
        "derived_stages": stages,
        "message": f"Config created with {len(stages)} stage(s). Now upload training/holdout data.",
    }


# ---------------------------------------------------------------------
# 2. Upload data files, tagged train or holdout
# ---------------------------------------------------------------------
@router.post("/projects/{project_name}/upload")
async def upload_cohort(
    project_name: str,
    file: UploadFile = File(...),
    cohort_name: str = Form(...),
    role: Literal["train", "holdout"] = Form(...),
):
    config_path = project_staging_dir(project_name) / "project_config.json"
    if not config_path.exists():
        raise HTTPException(404, f"Project {project_name!r} not found -- call POST /api/projects first")

    data_dir = project_data_dir(project_name)
    data_dir.mkdir(parents=True, exist_ok=True)
    dest_path = data_dir / f"{cohort_name}.csv"
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    key = "train_cohorts" if role == "train" else "holdout_cohorts"
    if cohort_name not in config[key]:
        config[key].append(cohort_name)

    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    return {
        "status": "ok",
        "cohort_name": cohort_name,
        "role": role,
        "train_cohorts": config["train_cohorts"],
        "holdout_cohorts": config["holdout_cohorts"],
    }


# ---------------------------------------------------------------------
# 3. Train (staging only)
# ---------------------------------------------------------------------
@router.post("/projects/{project_name}/train")
def train_project(project_name: str):
    config_path = project_staging_dir(project_name) / "project_config.json"
    if not config_path.exists():
        raise HTTPException(404, f"Project {project_name!r} not found")

    with open(config_path) as f:
        config = json.load(f)
    if not config["train_cohorts"]:
        raise HTTPException(400, "No training data uploaded yet (role='train')")

    result = subprocess.run(
        [sys.executable, str(BASE_DIR / "train_generic.py"), str(config_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise HTTPException(500, detail=result.stdout + result.stderr)

    return {"status": "ok", "log": result.stdout}


# ---------------------------------------------------------------------
# 4. Evaluate on held-out cohorts (staging only) -- this is what the
#    admin reviews before deciding whether to publish.
# ---------------------------------------------------------------------
@router.post("/projects/{project_name}/evaluate")
def evaluate_project(project_name: str):
    config_path = project_staging_dir(project_name) / "project_config.json"
    if not config_path.exists():
        raise HTTPException(404, f"Project {project_name!r} not found")

    with open(config_path) as f:
        config = json.load(f)
    if not config["holdout_cohorts"]:
        raise HTTPException(400, "No holdout data uploaded yet (role='holdout') -- "
                                  "cannot validate reliability without independent data")

    result = subprocess.run(
        [sys.executable, str(BASE_DIR / "evaluate_generic.py"), str(config_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise HTTPException(500, detail=result.stdout + result.stderr)

    metadata_path = project_staging_dir(project_name) / "models" / project_name / "metadata.json"
    with open(metadata_path) as f:
        metadata = json.load(f)

    return {
        "status": "ok",
        "log": result.stdout,
        "stages": {
            name: {
                "features": info["features"],
                "reliable": info.get("reliable"),
                "reliability_note": info.get("reliability_note"),
                "held_out_results": info.get("held_out_results"),
            }
            for name, info in metadata["stages"].items()
        },
    }


@router.get("/projects/{project_name}/status")
def project_status(project_name: str):
    metadata_path = project_staging_dir(project_name) / "models" / project_name / "metadata.json"
    if not metadata_path.exists():
        return {"status": "not_trained_yet"}
    with open(metadata_path) as f:
        return json.load(f)


@router.get("/projects/{project_name}/live_status")
def live_project_status(project_name: str):
    """
    Same shape as /status, but reads the LIVE (published) metadata instead
    of the staging one. Use this for anything shown to end users (e.g. a
    Risk Analysis page) -- staging may contain newer, not-yet-published
    changes that don't reflect what's actually driving real predictions.
    """
    metadata_path = project_live_dir(project_name) / "models" / project_name / "metadata.json"
    if not metadata_path.exists():
        raise HTTPException(404, f"No published (live) model for project {project_name!r}")
    with open(metadata_path) as f:
        return json.load(f)


# ---------------------------------------------------------------------
# 5. Publish: only step that affects what /api/predict serves.
# ---------------------------------------------------------------------
@router.post("/projects/{project_name}/publish")
def publish_project(project_name: str, body: PublishRequest):
    if not body.confirm:
        raise HTTPException(400, "Publishing replaces the live model. Resend with confirm=true.")

    staging_project_dir = project_staging_dir(project_name)
    metadata_path = staging_project_dir / "models" / project_name / "metadata.json"
    if not metadata_path.exists():
        raise HTTPException(400, "No trained+evaluated model to publish. Run /train and /evaluate first.")

    live_project_dir = project_live_dir(project_name)
    if live_project_dir.exists():
        shutil.rmtree(live_project_dir)
    shutil.copytree(staging_project_dir, live_project_dir)

    return {"status": "ok", "message": f"{project_name} published to live."}


# ---------------------------------------------------------------------
# 6. Predict using the LIVE (published) model only.
#    Named /api/predict to avoid colliding with the existing /predict
#    route (old dynamic_predictor-based endpoint), which is untouched.
# ---------------------------------------------------------------------
@router.post("/predict")
def predict(body: PredictRequest):
    live_config_path = project_live_dir(body.project_name) / "project_config.json"
    if not live_config_path.exists():
        raise HTTPException(404, f"No published (live) model for project {body.project_name!r}")

    sys.path.insert(0, str(BASE_DIR))
    from predict_generic import predict_risk

    return predict_risk(str(live_config_path), body.subject_id, body.feature_values)


# ---------------------------------------------------------------------
# 7. Batch predict: score every subject in an already-uploaded cohort
#    file using the LIVE (published) model. Used to drive dashboard
#    pages (e.g. scoring the s5 holdout cohort to show on Home/Students)
#    instead of hand-scoring one subject at a time.
# ---------------------------------------------------------------------
@router.post("/projects/{project_name}/predict_cohort/{cohort_name}")
def predict_cohort_endpoint(project_name: str, cohort_name: str):
    live_config_path = project_live_dir(project_name) / "project_config.json"
    if not live_config_path.exists():
        raise HTTPException(404, f"No published (live) model for project {project_name!r}")

    with open(live_config_path) as f:
        live_config = json.load(f)

    import pandas as pd
    data_dir = project_data_dir(project_name)
    cohort_path = data_dir / live_config["file_pattern"].format(cohort=cohort_name)
    if not cohort_path.exists():
        raise HTTPException(404, f"Cohort file not found: {cohort_path}")

    df = pd.read_csv(cohort_path)
    id_col = live_config["id_column"]

    sys.path.insert(0, str(BASE_DIR))
    from predict_generic import predict_risk

    results = []
    for _, row in df.iterrows():
        subject_id = str(row[id_col]) if id_col in df.columns else "unknown"
        feature_values = {k: v for k, v in row.to_dict().items() if k != id_col}
        results.append(predict_risk(str(live_config_path), subject_id, feature_values))

    return {"cohort": cohort_name, "count": len(results), "results": results}


# ---------------------------------------------------------------------
# 8. AI-polished recommendation text. This does NOT decide what's wrong
#    with a subject -- it only rephrases the exact numbers already
#    computed by predict_risk's top_contributing_factors (feature, value,
#    cohort_average, direction). The model is explicitly instructed to
#    use only those numbers and nothing else, and the output still goes
#    through the same admin Approve/Reject/Edit workflow before it's
#    considered final -- this does not bypass that gate.
#
#    Requires ANTHROPIC_API_KEY to be set as an environment variable on
#    this server. One batched API call handles the whole list, instead
#    of one call per subject, to keep latency and cost down.
# ---------------------------------------------------------------------
class FactorInput(BaseModel):
    subject_id: str
    factors: List[Dict[str, Any]]  # same shape as top_contributing_factors
    # DEPRECATED: if the frontend sends this, it's used as-is for backward
    # compatibility. Leave empty (default) to have the backend resolve
    # actions per-factor from feature_metadata.json instead -- this is the
    # recommended path since it varies by WHICH course triggered the flag,
    # rather than one flat list shared by every subject.
    resource_hints: List[str] = Field(default_factory=list)


class PolishRequest(BaseModel):
    subject_label: str = "student"
    items: List[FactorInput]


def _build_polish_prompt(subject_label: str, batch_items) -> str:
    metadata = _load_feature_metadata()
    blocks = []
    for item in batch_items:
        if not item.factors:
            blocks.append(f"subject_id: {item.subject_id}\nfactor: none available")
            continue
        top = item.factors[0]
        display = _display_name(top["feature"], metadata)
        # Prefer explicit resource_hints if the frontend sent them (back-
        # compat); otherwise resolve per-factor from feature_metadata.json
        # so the actions actually match which course triggered the flag.
        hints = item.resource_hints or _resolve_actions_for_factors(item.factors, metadata)
        hint_text = (
            f"\nresource categories to mention (do not invent specific links/titles "
            f"beyond these categories): {', '.join(hints)}"
            if hints else ""
        )
        blocks.append(
            f"subject_id: {item.subject_id}\n"
            f"factor: {display} = {top['value']} "
            f"({top['direction']}, cohort average {top['cohort_average']})"
            f"{hint_text}"
        )

    return (
        f"You are writing brief, supportive messages that will be sent DIRECTLY to "
        f"{subject_label}s themselves, based on pre-computed course statistics.\n\n"
        "STRICT RULES:\n"
        "- Base each message ONLY on the course(s)/direction given for that subject_id. "
        "Do not invent any other reason, diagnosis, cause, or explanation.\n"
        "- Do NOT mention exact scores, numbers, or comparisons to a cohort/peer "
        "average in the message -- this goes to the subject directly, not to staff.\n"
        "- Do not make clinical, medical, or educational judgments.\n"
        "- Format each message as: (1) a short intro sentence naming the course(s) "
        "involved, (2) a line reading exactly 'A few things that might help:' "
        "followed by a bulleted list (each line starting with '\u2022 ') using ALL of "
        "the resource categories given for that subject_id -- do not invent a "
        "specific URL, video title, book name, or named resource beyond those "
        "categories, (3) a closing sentence encouraging them to reach out to their "
        "instructor or academic advisor directly. Use '\\n\\n' between these three "
        "parts so they render as separate paragraphs.\n"
        "- Second person, warm and supportive tone, not alarming.\n"
        "- IMPORTANT: multiple subject_ids below may share the same course. Vary the "
        "intro/closing phrasing across them so the messages don't read as an "
        "identical form letter copy-pasted to everyone -- reword naturally each time "
        "even when the underlying course and resource categories are the same.\n"
        "- Return ONLY valid JSON: a list of objects with 'subject_id' and 'text' "
        "fields, one per subject_id below, in the same order. No other text, no "
        "markdown formatting, no code fences.\n\n"
        "Data:\n\n" + "\n\n".join(blocks)
    )


def _build_decision_support(item: FactorInput) -> Dict[str, Any]:
    """
    Deterministic (non-AI) admin-facing decision-support block for the
    "based on" panel in recommendations.js. Every number here comes
    straight from predict_generic.py's already-computed
    top_contributing_factors, or is a fixed template string built from
    those numbers -- Claude never touches this function, so there's no
    risk of an invented reason, fabricated score, or hallucinated resource
    reaching an admin's screen.

    This is intentionally separate from the AI-polished `text` field
    (which stays soft, number-free, and goes to the student) -- this
    block is the "why was this student flagged" evidence for staff.
    """
    metadata = _load_feature_metadata()
    factors = item.factors or []

    if not factors:
        return {
            "primary_concern": None,
            "contributing_factors": [],
            "recommended_actions": [],
            "expected_outcome": None,
        }

    primary = factors[0]  # _compute_top_factors already sorts by contribution desc

    # Only features actually pushing risk UP count toward "why flagged" --
    # a feature that's actually a strength (negative/zero contribution)
    # isn't part of the concern and shouldn't dilute the percentages.
    positive = [f for f in factors if f.get("contribution", 0) > 0]
    total = sum(f["contribution"] for f in positive) or 1.0

    contributing_factors = [
        {
            "feature": f["feature"],
            "display_name": _display_name(f["feature"], metadata),
            "value": f["value"],
            "cohort_average": f["cohort_average"],
            "direction": f["direction"],
            "weight_pct": round(100 * f["contribution"] / total, 1),
        }
        for f in positive
    ]

    gap = round(abs(primary["value"] - primary["cohort_average"]), 1)
    primary_display = _display_name(primary["feature"], metadata)

    return {
        "primary_concern": {
            "feature": primary["feature"],
            "display_name": primary_display,
            "value": primary["value"],
            "cohort_average": primary["cohort_average"],
            "gap": gap,
            "direction": primary["direction"],
        },
        "contributing_factors": contributing_factors,
        # Full {label, url} objects here (not just labels) -- this is the
        # admin-facing panel, so a real, human-verified link can be shown
        # as clickable. Same per-factor resolution the student message
        # actions are based on, kept consistent so admin and student never
        # see contradictory action lists.
        "recommended_actions": (
            [_normalize_hint(h) for h in item.resource_hints if _normalize_hint(h)]
            if item.resource_hints
            else _resolve_action_objects(factors, metadata)
        ),
        "expected_outcome": (
            f"Strengthen understanding in {primary_display} and reduce "
            f"predicted risk before the next assessment."
        ),
    }


def _call_claude_for_batch(client, subject_label: str, batch_items):
    prompt = _build_polish_prompt(subject_label, batch_items)

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4000,  # generous per-batch budget; batching keeps this from ever being exceeded
        messages=[{"role": "user", "content": prompt}],
    )

    raw_text = "".join(block.text for block in response.content if block.type == "text")
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(
            500,
            f"Model did not return valid JSON for a batch. This usually means the "
            f"response was cut off -- if this keeps happening, reduce BATCH_SIZE "
            f"in admin_router.py. Raw response: {raw_text[:300]}",
        )


@router.post("/polish_recommendations")
def polish_recommendations(body: PolishRequest):
    if anthropic is None:
        raise HTTPException(
            500,
            "The 'anthropic' package isn't installed on the server. "
            "Run: pip install anthropic",
        )

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            500,
            "ANTHROPIC_API_KEY is not set on the server. Set it as an "
            "environment variable before starting the backend.",
        )

    if not body.items:
        return {"items": []}

    client = anthropic.Anthropic(api_key=api_key)

    # Process in small batches rather than one giant request. The richer
    # message format (intro + bulleted resource list + closing) uses a lot
    # more output tokens per subject than the earlier one-line version --
    # sending all 31+ subjects in a single call risks the response being
    # cut off mid-JSON (which is exactly what caused the "Model did not
    # return valid JSON" error). Batching keeps each individual call's
    # output comfortably within max_tokens no matter how large the cohort
    # being scored is.
    BATCH_SIZE = 8
    parsed_all = []
    for i in range(0, len(body.items), BATCH_SIZE):
        batch = body.items[i : i + BATCH_SIZE]
        parsed_all.extend(_call_claude_for_batch(client, body.subject_label, batch))

    # decision_support is built WITHOUT Claude -- pure Python off the same
    # top_contributing_factors already used for the student-facing `text`
    # above. This is the structured admin evidence panel (Primary Concern /
    # Contributing Factors / Recommended Actions / Expected Outcome).
    decision_support_by_id = {
        item.subject_id: _build_decision_support(item) for item in body.items
    }
    for entry in parsed_all:
        entry["decision_support"] = decision_support_by_id.get(entry.get("subject_id"))

    return {"items": parsed_all}



# APPROVED_RECOMMENDATIONS_PATH = BASE_DIR / "live" / "approved_recommendations.json"


# class ApprovedRecommendationRequest(BaseModel):
#     subject_id: str
#     probability: float
#     text: str
#     factual_basis: str | None = None
#     top_factors: List[Dict[str, Any]] = Field(default_factory=list)


# def normalize_subject_id(value):
#     if value is None:
#         return None

#     text = str(value).strip()

#     if text.endswith(".0"):
#         text = text[:-2]

#     return text


# def load_approved_recommendations():
#     if not APPROVED_RECOMMENDATIONS_PATH.exists():
#         return {}

#     with open(APPROVED_RECOMMENDATIONS_PATH, "r", encoding="utf-8") as f:
#         return json.load(f)


# def save_approved_recommendations(data):
#     APPROVED_RECOMMENDATIONS_PATH.parent.mkdir(parents=True, exist_ok=True)

#     with open(APPROVED_RECOMMENDATIONS_PATH, "w", encoding="utf-8") as f:
#         json.dump(data, f, indent=2)


# @router.post("/recommendations/approve")
# def approve_recommendation(body: ApprovedRecommendationRequest):
#     data = load_approved_recommendations()

#     subject_id = normalize_subject_id(body.subject_id)

#     data[subject_id] = {
#         "subject_id": subject_id,
#         "probability": body.probability,
#         "text": body.text,
#         "factual_basis": body.factual_basis,
#         "top_factors": body.top_factors,
#         "status": "approved",
#     }

#     save_approved_recommendations(data)

#     return {
#         "status": "ok",
#         "message": "Recommendation approved",
#         "subject_id": subject_id,
#     }


# @router.get("/recommendations/my")
# def get_my_recommendation(authorization: str = Header(None)):
#     from ml_generic.auth_router import init_firebase

#     init_firebase()

#     if not authorization or not authorization.startswith("Bearer "):
#         raise HTTPException(status_code=401, detail="Missing Firebase token")

#     id_token = authorization.replace("Bearer ", "")

#     try:
#         decoded_token = auth.verify_id_token(id_token)

#         subject_id = normalize_subject_id(decoded_token.get("subject_id"))

#         if not subject_id:
#             raise HTTPException(status_code=403, detail="No subject_id found")

#         data = load_approved_recommendations()
#         recommendation = data.get(subject_id)

#         if not recommendation:
#             return {
#                 "status": "empty",
#                 "message": "No approved recommendation yet",
#                 "recommendation": None,
#                 "subject_id": subject_id,
#             }

#         return {
#             "status": "ok",
#             "subject_id": subject_id,
#             "recommendation": recommendation,
#         }

#     except HTTPException:
#         raise

#     except Exception as e:
#         raise HTTPException(status_code=401, detail=str(e))