from pathlib import Path
from typing import Dict, Any, List, Optional

import json
import joblib
import pandas as pd

from ml.missing_course_estimator import estimate_missing_courses


def _load_metadata() -> Dict[str, Any]:
    current_dir = Path(__file__).resolve().parent
    metadata_path = current_dir / "models" / "metadata.json"

    if not metadata_path.exists():
        raise FileNotFoundError("metadata.json not found. Please run /train first.")

    with open(metadata_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_model(model_path: str):
    path = Path(model_path)

    if not path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    return joblib.load(path)


def _find_best_primary_model(
    student_scores: Dict[str, float],
    metadata: Dict[str, Any],
) -> Optional[Dict[str, Any]]:

    primary_models = metadata.get("primary_models", {})
    available_courses = set(student_scores.keys())

    valid_models: List[Dict[str, Any]] = []

    for model_info in primary_models.values():
        features = model_info.get("features", [])

        if set(features).issubset(available_courses):
            valid_models.append(model_info)

    if not valid_models:
        return None

    def score_model(model_info: Dict[str, Any]):
        cls_metrics = model_info.get("classification_metrics", {})
        f1 = cls_metrics.get("f1_macro", 0)
        feature_count = model_info.get("feature_count", len(model_info.get("features", [])))
        return (feature_count, f1)

    return max(valid_models, key=score_model)


def _proba_to_dict(model, proba_row) -> Dict[str, float]:
    result = {
        "High": 0.0,
        "Medium": 0.0,
        "Low": 0.0,
    }

    for label, probability in zip(model.classes_, proba_row):
        result[str(label)] = round(float(probability), 4)

    return result


def _blend_probabilities(
    primary_probs: Optional[Dict[str, float]],
    fallback_probs: Dict[str, float],
    observed_count: int,
    total_courses: int,
) -> Dict[str, float]:

    if primary_probs is None:
        return fallback_probs

    observed_ratio = observed_count / max(total_courses, 1)

    primary_weight = min(0.75, max(0.35, observed_ratio))
    fallback_weight = 1.0 - primary_weight

    blended = {}

    for label in ["High", "Medium", "Low"]:
        blended[label] = round(
            (primary_probs.get(label, 0.0) * primary_weight)
            + (fallback_probs.get(label, 0.0) * fallback_weight),
            4,
        )

    total = sum(blended.values())

    if total > 0:
        blended = {
            label: round(value / total, 4)
            for label, value in blended.items()
        }

    return blended


def _confidence_from_probability(probabilities: Dict[str, float]) -> str:
    max_probability = max(probabilities.values())

    if max_probability >= 0.70:
        return "High"
    if max_probability >= 0.50:
        return "Medium"
    return "Low"


def predict_student_dynamic(data: Dict[str, Any]) -> Dict[str, Any]:

    metadata = _load_metadata()

    student_id = data.get("student_id", "unknown")
    scores = data.get("scores", data)

    if not isinstance(scores, dict):
        raise ValueError("Input must contain a 'scores' object.")

    course_order = metadata.get("course_order", [])

    clean_scores: Dict[str, float] = {}

    for key, value in scores.items():
        normalized_key = str(key).strip()

        if normalized_key not in course_order:
            continue

        try:
            clean_scores[normalized_key] = float(value)
        except (TypeError, ValueError):
            continue

    if not clean_scores:
        raise ValueError("No valid numeric course scores provided.")

    observed_courses = [
        course for course in course_order
        if course in clean_scores
    ]

    missing_courses = [
        course for course in course_order
        if course not in clean_scores
    ]

    primary_prediction = None
    primary_probs = None
    primary_features_used: List[str] = []

    primary_model_info = _find_best_primary_model(clean_scores, metadata)

    if primary_model_info is not None:
        primary_features = primary_model_info["features"]
        primary_features_used = primary_features

        primary_input = pd.DataFrame([
            {feature: clean_scores[feature] for feature in primary_features}
        ])

        if "regressor_path" in primary_model_info:
            primary_regressor = _load_model(primary_model_info["regressor_path"])
            primary_prediction = float(primary_regressor.predict(primary_input)[0])

        if "classifier_path" in primary_model_info:
            primary_classifier = _load_model(primary_model_info["classifier_path"])
            primary_proba_row = primary_classifier.predict_proba(primary_input)[0]
            primary_probs = _proba_to_dict(primary_classifier, primary_proba_row)

    estimated_courses = estimate_missing_courses(clean_scores, metadata)

    completed_scores = {
        **clean_scores,
        **estimated_courses,
    }

    full_model_info = metadata.get("full_model", {})
    full_features = full_model_info.get("features", [])

    full_regressor = _load_model(full_model_info["model_path"])

    full_input = pd.DataFrame([
        {feature: completed_scores[feature] for feature in full_features}
    ])

    fallback_prediction = float(full_regressor.predict(full_input)[0])

    risk_classifier_info = metadata.get("risk_classifier", {})
    risk_classifier = _load_model(risk_classifier_info["model_path"])

    classifier_input = pd.DataFrame([
        {feature: completed_scores[feature] for feature in risk_classifier_info["features"]}
    ])

    fallback_proba_row = risk_classifier.predict_proba(classifier_input)[0]
    fallback_probs = _proba_to_dict(risk_classifier, fallback_proba_row)

    risk_probabilities = _blend_probabilities(
        primary_probs=primary_probs,
        fallback_probs=fallback_probs,
        observed_count=len(observed_courses),
        total_courses=len(course_order),
    )

    risk_level = max(
        risk_probabilities,
        key=lambda label: risk_probabilities[label],
    )

    confidence = _confidence_from_probability(risk_probabilities)

    if primary_prediction is not None:
        observed_ratio = len(observed_courses) / max(len(course_order), 1)

        primary_weight = min(0.75, max(0.35, observed_ratio))
        fallback_weight = 1.0 - primary_weight

        final_prediction = (
            primary_prediction * primary_weight
            + fallback_prediction * fallback_weight
        )

        method = "Primary Classifier + Fallback Classifier"
    else:
        final_prediction = fallback_prediction
        method = "Fallback Classifier Only"

    return {
        "student_id": student_id,
        "risk_level": risk_level,
        "risk_probabilities": risk_probabilities,
        "confidence": confidence,
        "method": method,
        "predicted_comprehensive": round(float(final_prediction), 2),
        "observed_courses": observed_courses,
        "missing_courses": missing_courses,
        "estimated_courses": estimated_courses,
        "primary_prediction": (
            round(primary_prediction, 2)
            if primary_prediction is not None
            else None
        ),
        "fallback_prediction": round(fallback_prediction, 2),
        "primary_features_used": primary_features_used,
    }