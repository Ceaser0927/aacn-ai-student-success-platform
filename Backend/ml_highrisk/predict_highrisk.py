"""
predict_highrisk.py

Replaces dynamic_predictor.py's chained-imputation architecture.

For a given student, with whatever courses they've actually completed so far:
1. Find the most advanced trained "stage" whose required features are a
   SUBSET of what the student actually has (i.e. use the most informative
   model the data genuinely supports -- never invent missing course scores).
2. Score them with that stage's probability-of-High-risk model.
3. Flag them using that stage's pre-computed recall-oriented threshold
   (NOT the default 0.5 -- see train_highrisk_models.py).
4. Attach an honest confidence label based on how much of the full course
   sequence is actually known, so downstream UI never implies more
   certainty than the data supports.

No course score is ever estimated/imputed. If a student's known courses
don't fully cover any trained stage, we say so explicitly instead of
guessing.
"""

from pathlib import Path
from typing import Any, Dict, Optional

import json
import joblib

BASE_DIR = Path(__file__).resolve().parent
METADATA_PATH = BASE_DIR / "models" / "metadata.json"


def _load_metadata() -> Dict[str, Any]:
    if not METADATA_PATH.exists():
        raise FileNotFoundError("metadata.json not found. Run train_highrisk_models.py first.")
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _confidence_label(known_count: int, total_count: int) -> str:
    ratio = known_count / max(total_count, 1)
    if ratio >= 0.75:
        return "High confidence"
    if ratio >= 0.4:
        return "Medium confidence"
    return "Low confidence (early-stage estimate)"


def _find_best_stage(available_courses: set, metadata: Dict[str, Any]) -> Optional[str]:
    """
    Among trained stages whose feature set is fully covered by the student's
    known courses, pick the one using the MOST features (i.e. the most
    informative model the data actually supports).
    """
    stages = metadata["stages"]
    candidates = [
        (name, info) for name, info in stages.items()
        if set(info["features"]).issubset(available_courses)
    ]
    if not candidates:
        return None
    best_name, _ = max(candidates, key=lambda item: len(item[1]["features"]))
    return best_name


def predict_student_risk(student_id: str, scores: Dict[str, float]) -> Dict[str, Any]:
    metadata = _load_metadata()
    course_order_full = metadata["course_order_full"]
    excluded = set(metadata.get("excluded_courses", []))

    clean_scores = {}
    for course, value in scores.items():
        if course in excluded:
            continue  # never use excluded/misaligned courses (e.g. Peds)
        try:
            clean_scores[course] = float(value)
        except (TypeError, ValueError):
            continue

    available_courses = set(clean_scores.keys())
    stage_name = _find_best_stage(available_courses, metadata)

    known_count = len([c for c in course_order_full if c in available_courses])
    total_count = len(course_order_full)
    confidence = _confidence_label(known_count, total_count)

    if stage_name is None:
        return {
            "student_id": student_id,
            "status": "insufficient_data",
            "message": (
                "Not enough matching course data to produce a reliable High-risk "
                "screening result. No score is being guessed."
            ),
            "known_courses": sorted(available_courses),
            "confidence": "None",
        }

    stage_info = metadata["stages"][stage_name]
    # Always resolve the model file from the local models/ folder next to this
    # script, regardless of what absolute path was recorded in metadata.json
    # at training time (e.g. if the project was moved to a different machine).
    model_filename = Path(stage_info["model_path"]).name
    model_path = BASE_DIR / "models" / model_filename
    model = joblib.load(model_path)
    features = stage_info["features"]

    input_row = [[clean_scores[f] for f in features]]
    proba_high = float(model.predict_proba(input_row)[0][1])

    threshold = stage_info["recommended_threshold"]
    flagged = proba_high >= threshold

    # `reliable` is set by evaluate_highrisk_s5.py based on ACTUAL held-out
    # performance on a cohort never used in training -- not a training-time
    # metric, which would be overly optimistic. Do not present a stage's
    # output as an actionable screening flag unless it has cleared that bar.
    reliable = stage_info.get("reliable")  # True / False / None (not yet validated)

    if reliable is False:
        return {
            "student_id": student_id,
            "status": "low_confidence_signal",
            "stage_used": stage_name,
            "features_used": features,
            "probability_high_risk": round(proba_high, 4),
            "flagged_for_review": None,
            "confidence": "Not reliable enough to act on",
            "known_courses": sorted(available_courses),
            "known_course_count": known_count,
            "total_course_count": total_count,
            "note": (
                "This stage performed no better than chance in independent "
                "held-out testing (" + stage_info.get("reliability_note", "") + "). "
                "Do NOT treat this as a screening flag. It is shown for "
                "transparency only -- do not use it to make decisions about "
                "this student."
            ),
        }

    if reliable is None:
        confidence_suffix = " -- NOT YET VALIDATED on an independent cohort; use with caution"
    else:
        confidence_suffix = ""

    return {
        "student_id": student_id,
        "status": "ok",
        "stage_used": stage_name,
        "features_used": features,
        "probability_high_risk": round(proba_high, 4),
        "screening_threshold": round(threshold, 4),
        "flagged_for_review": bool(flagged),
        "confidence": confidence + confidence_suffix,
        "known_courses": sorted(available_courses),
        "known_course_count": known_count,
        "total_course_count": total_count,
        "stage_loocv_auc": stage_info["loocv_auc"],
        "stage_held_out_results": stage_info.get("held_out_results"),
        "note": (
            "This is a screening signal, not a diagnosis. Flagged students are "
            "recommended for faculty review; unflagged does not guarantee no risk."
        ),
    }


if __name__ == "__main__":
    # quick manual smoke test
    example = predict_student_risk("demo_student", {"CT1": 68.0})
    print(json.dumps(example, indent=2))
