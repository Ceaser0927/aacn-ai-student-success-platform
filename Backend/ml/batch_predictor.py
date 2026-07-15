from pathlib import Path
from typing import Dict, Any

import pandas as pd

from ml.dynamic_predictor import predict_student_dynamic


VALID_COURSES = {
    "Foundation",
    "CT1",
    "Pharm",
    "OB",
    "Peds",
    "Comm",
    "Men",
    "MS",
    "CT2",
    "Leadership",
}


ID_COLUMNS = {
    "StudentID",
    "Student ID",
    "Student_ID",
    "student_id",
    "studentId",
    "ID",
}


def normalize_student_id(student_id: Any) -> str:
    if pd.isna(student_id) or student_id is None:
        return ""

    student_id_str = str(student_id).strip()

    if student_id_str.endswith(".0"):
        student_id_str = student_id_str[:-2]

    return student_id_str


def predict_cohort(
    dataset_path: Path,
    output_path: Path,
) -> Dict[str, Any]:

    dataset_path = Path(dataset_path)
    output_path = Path(output_path)

    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(dataset_path)

    results = []
    skipped_rows = []

    for index, row in df.iterrows():
        student_id = None

        for id_col in ID_COLUMNS:
            if id_col in df.columns:
                student_id = row.get(id_col)
                break

        student_id = normalize_student_id(student_id)

        if not student_id:
            student_id = f"S5_{index + 1}"

        scores = {}

        for col in df.columns:
            normalized_col = str(col).strip()

            if normalized_col not in VALID_COURSES:
                continue

            value = row[col]

            if pd.isna(value):
                continue

            try:
                scores[normalized_col] = float(value)
            except (TypeError, ValueError):
                continue

        if not scores:
            skipped_rows.append({
                "row_index": int(index),
                "student_id": student_id,
                "reason": "No valid course scores found",
            })
            continue

        prediction = predict_student_dynamic({
            "student_id": student_id,
            "scores": scores,
        })

        results.append({
            "student_id": prediction["student_id"],
            "predicted_comprehensive": prediction["predicted_comprehensive"],
            "risk_level": prediction["risk_level"],
            "confidence": prediction["confidence"],
            "method": prediction["method"],
            "observed_courses": ", ".join(prediction["observed_courses"]),
            "missing_courses": ", ".join(prediction["missing_courses"]),
            "primary_prediction": prediction["primary_prediction"],
            "fallback_prediction": prediction["fallback_prediction"],
            "primary_features_used": ", ".join(prediction.get("primary_features_used", [])),
            "actual_comprehensive": row.get("Comprehensive", None),
        })

    if not results:
        raise ValueError(
            "No rows could be predicted. Check whether the S5 CSV has valid course columns."
        )

    result_df = pd.DataFrame(results)
    result_df.to_csv(output_path, index=False)

    return {
        "message": "Cohort prediction completed successfully.",
        "dataset_path": str(dataset_path),
        "output_path": str(output_path),
        "rows_predicted": len(result_df),
        "rows_skipped": len(skipped_rows),
        "skipped_rows": skipped_rows[:10],
        "columns_found": list(df.columns),
    }