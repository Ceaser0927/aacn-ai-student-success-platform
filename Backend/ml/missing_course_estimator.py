from pathlib import Path
from typing import Dict, Any

import joblib
import pandas as pd


def _load_model(model_path: str):
    path = Path(model_path)

    if not path.exists():
        return None

    return joblib.load(path)


def _estimate_with_correlation(
    missing_course: str,
    student_scores: Dict[str, float],
    metadata: Dict[str, Any],
) -> float:
    estimator_info = metadata.get("missing_estimator", {})
    course_medians = estimator_info.get("course_medians", {})
    course_correlations = estimator_info.get("course_correlations", {})

    observed_values = list(student_scores.values())

    if observed_values:
        observed_average = sum(observed_values) / len(observed_values)
    else:
        observed_average = 75.0

    missing_course_median = float(course_medians.get(missing_course, 75.0))

    weighted_adjustment_sum = 0.0
    weight_sum = 0.0

    for observed_course, observed_score in student_scores.items():
        observed_course_median = float(
            course_medians.get(observed_course, observed_average)
        )

        correlation = 0.0

        if missing_course in course_correlations:
            correlation = float(
                course_correlations
                .get(missing_course, {})
                .get(observed_course, 0.0)
            )

        if correlation == 0.0 and observed_course in course_correlations:
            correlation = float(
                course_correlations
                .get(observed_course, {})
                .get(missing_course, 0.0)
            )

        weight = abs(correlation)

        if weight <= 0.05:
            continue

        observed_difference = observed_score - observed_course_median
        weighted_adjustment_sum += observed_difference * correlation
        weight_sum += weight

    if weight_sum > 0:
        estimated_value = missing_course_median + (
            weighted_adjustment_sum / weight_sum
        )
    else:
        estimated_value = (missing_course_median * 0.6) + (observed_average * 0.4)

    return max(0.0, min(100.0, float(estimated_value)))


def estimate_missing_courses(
    student_scores: Dict[str, float],
    metadata: Dict[str, Any],
) -> Dict[str, float]:

    course_order = metadata.get("course_order", [])
    relationship_models = metadata.get("relationship_models", {})

    clean_student_scores: Dict[str, float] = {}

    for course, value in student_scores.items():
        try:
            clean_student_scores[course] = float(value)
        except (TypeError, ValueError):
            continue

    estimated_courses: Dict[str, float] = {}
    working_scores: Dict[str, float] = dict(clean_student_scores)

    for course in course_order:
        if course in working_scores:
            continue

        relationship_info = relationship_models.get(course)
        estimated_value = None

        if relationship_info is not None:
            input_features = relationship_info.get("input_features", [])

            if all(feature in working_scores for feature in input_features):
                model = _load_model(relationship_info.get("model_path", ""))

                if model is not None:
                    model_input = pd.DataFrame([
                        {
                            feature: working_scores[feature]
                            for feature in input_features
                        }
                    ])

                    estimated_value = float(model.predict(model_input)[0])

        if estimated_value is None:
            estimated_value = _estimate_with_correlation(
                missing_course=course,
                student_scores=working_scores,
                metadata=metadata,
            )

        estimated_value = max(0.0, min(100.0, float(estimated_value)))
        estimated_courses[course] = round(estimated_value, 2)
        working_scores[course] = estimated_value

    return estimated_courses