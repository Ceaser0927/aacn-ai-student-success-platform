"""
predict_generic.py

Config-driven version of predict_highrisk.py. Given a subject's known
feature values, finds the most informative trained stage whose features
are fully covered, scores it, and gates the output on that stage's
`reliable` flag (set by evaluate_generic.py from REAL held-out
performance -- never a training-time metric).

Usage (as a library):
    from predict_generic import predict_risk
    result = predict_risk("configs/nursing_config.json", "student_123",
                           {"CT1": 68, "OB": 70, "Comm": 72, "Men": 69})
"""

from pathlib import Path
from typing import Any, Dict, Optional

import json
import joblib

from config_loader import load_config


def _confidence_label(known_count: int, total_count: int) -> str:
    ratio = known_count / max(total_count, 1)
    if ratio >= 0.75:
        return "High confidence"
    if ratio >= 0.4:
        return "Medium confidence"
    return "Low confidence (early-stage estimate)"


def _load_metadata(config) -> Dict[str, Any]:
    models_dir = config["_config_dir"] / "models" / config["project_name"]
    metadata_path = models_dir / "metadata.json"
    if not metadata_path.exists():
        raise FileNotFoundError(f"{metadata_path} not found. Run train_generic.py first.")
    with open(metadata_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _find_best_stage(available_features: set, metadata: Dict[str, Any]) -> Optional[str]:
    stages = metadata["stages"]
    candidates = [
        (name, info) for name, info in stages.items()
        if set(info["features"]).issubset(available_features)
    ]
    if not candidates:
        return None

    # Prefer RELIABLE stages over unreliable ones, even if an unreliable
    # stage would use more features. "More information available" does
    # NOT mean "better model" -- we've measured cases (stage_4 in the
    # nursing project) where adding more features made a stage LESS
    # reliable on held-out data. Without this, any subject with a fully
    # complete record would always be routed to the most feature-rich
    # stage regardless of whether it actually validated -- silently
    # discarding a smaller, PROVEN-reliable stage that also matched.
    # Feature count is only used to break ties within the same
    # reliability tier.
    def sort_key(item):
        _, info = item
        reliable = info.get("reliable")
        # True sorts first, then None (untested), then False (proven unreliable)
        reliability_rank = {True: 0, None: 1, False: 2}.get(reliable, 1)
        return (reliability_rank, -len(info["features"]))

    candidates.sort(key=sort_key)
    return candidates[0][0]


def _compute_top_factors(clean_values, features, feature_means, feature_coefficients, risk_direction, top_n=3):
    """
    Explains WHY a prediction came out the way it did, using only the
    trained model's own coefficients -- not a guess, not an LLM. For each
    feature, contribution = coefficient * (this subject's value - the
    training-set average). A large positive contribution means that
    feature pushed the risk probability UP relative to an average
    student; a large negative contribution pushed it down.

    This deliberately does NOT try to explain low_confidence_signal or
    insufficient_data results -- explaining an unreliable prediction in
    detail would just make it look more credible than it is.
    """
    if not feature_means or not feature_coefficients:
        return []

    contributions = []
    for f in features:
        if f not in clean_values or f not in feature_means or f not in feature_coefficients:
            continue
        mean = feature_means[f]
        coef = feature_coefficients[f]
        value = clean_values[f]
        contribution = coef * (value - mean)
        contributions.append({
            "feature": f,
            "value": round(value, 2),
            "cohort_average": round(mean, 2),
            "direction": "below average" if value < mean else "above average",
            "contribution": round(contribution, 4),
        })

    # Sort by how much each feature pushed toward "high risk" (largest
    # positive contribution first), since those are the most relevant
    # factors to surface for a flagged subject.
    contributions.sort(key=lambda c: c["contribution"], reverse=True)
    return contributions[:top_n]


def predict_risk(config_path: str, subject_id: str, feature_values: Dict[str, float]) -> Dict[str, Any]:
    config = load_config(config_path)
    metadata = _load_metadata(config)
    excluded = set(config.get("excluded_features", []))

    clean_values = {}
    for feature, value in feature_values.items():
        if feature in excluded:
            continue
        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            continue
        # A missing CSV cell arrives here as NaN, which is technically a
        # valid float but not a valid feature value -- treat it the same
        # as "this feature isn't known for this subject", not as a number
        # to feed into the model (which would crash on NaN, or worse,
        # silently produce a meaningless prediction).
        if numeric_value != numeric_value:  # NaN != NaN is the classic check
            continue
        clean_values[feature] = numeric_value

    available_features = set(clean_values.keys())
    stage_name = _find_best_stage(available_features, metadata)

    all_possible_features = set()
    for info in metadata["stages"].values():
        all_possible_features.update(info["features"])
    known_count = len(available_features & all_possible_features)
    total_count = len(all_possible_features)
    confidence = _confidence_label(known_count, total_count)

    if stage_name is None:
        return {
            "subject_id": subject_id,
            "status": "insufficient_data",
            "message": "Not enough matching feature data for a reliable screening result.",
            "known_features": sorted(available_features),
            "confidence": "None",
        }

    stage_info = metadata["stages"][stage_name]
    model_filename = Path(stage_info["model_path"]).name
    models_dir = config["_config_dir"] / "models" / config["project_name"]
    model = joblib.load(models_dir / model_filename)
    features = stage_info["features"]

    input_row = [[clean_values[f] for f in features]]
    proba_high = float(model.predict_proba(input_row)[0][1])
    threshold = stage_info["recommended_threshold"]
    flagged = proba_high >= threshold

    reliable = stage_info.get("reliable")

    if reliable is False:
        return {
            "subject_id": subject_id,
            "status": "low_confidence_signal",
            "stage_used": stage_name,
            "features_used": features,
            "probability_high_risk": round(proba_high, 4),
            "flagged_for_review": None,
            "confidence": "Not reliable enough to act on",
            "known_features": sorted(available_features),
            "note": (
                "This stage did not clear the reliability bar in independent "
                "held-out testing (" + stage_info.get("reliability_note", "") + "). "
                "Do NOT treat this as a screening flag."
            ),
        }

    confidence_suffix = " -- NOT YET VALIDATED on an independent cohort; use with caution" if reliable is None else ""

    top_factors = _compute_top_factors(
        clean_values=clean_values,
        features=features,
        feature_means=stage_info.get("feature_means", {}),
        feature_coefficients=stage_info.get("feature_coefficients", {}),
        risk_direction=config["risk_direction"],
    )

    return {
        "subject_id": subject_id,
        "status": "ok",
        "stage_used": stage_name,
        "features_used": features,
        "probability_high_risk": round(proba_high, 4),
        "screening_threshold": round(threshold, 4),
        "flagged_for_review": bool(flagged),
        "confidence": confidence + confidence_suffix,
        "known_features": sorted(available_features),
        "known_feature_count": known_count,
        "total_feature_count": total_count,
        "stage_loocv_auc": stage_info["loocv_auc"],
        "stage_held_out_results": stage_info.get("held_out_results"),
        "top_contributing_factors": top_factors,
        "note": (
            "This is a screening signal, not a diagnosis. Flagged subjects are "
            "recommended for expert review; unflagged does not guarantee no risk."
        ),
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python3 predict_generic.py <config_path> [feature=value ...]")
        print("Example: python3 predict_generic.py configs/nursing_config.json CT1=68 OB=70")
        sys.exit(1)

    config_path = sys.argv[1]
    feature_args = {}
    for arg in sys.argv[2:]:
        key, _, value = arg.partition("=")
        feature_args[key] = value

    if not feature_args:
        print(f"No feature=value pairs given -- showing available stages for {config_path}:")
        _cfg = load_config(config_path)
        _meta = _load_metadata(_cfg)
        for stage_name, info in _meta["stages"].items():
            print(f"  {stage_name}: features={info['features']}  reliable={info.get('reliable')}")
        sys.exit(0)

    result = predict_risk(config_path, "demo_subject", feature_args)
    print(json.dumps(result, indent=2))