from pathlib import Path
from typing import Dict, Any

import json
import pandas as pd
import numpy as np

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    confusion_matrix,
    classification_report,
)


BASE_DIR = Path(__file__).resolve().parent.parent

PREDICTION_PATH = BASE_DIR / "data" / "predictions" / "s5_prediction_results.csv"
REPORT_DIR = BASE_DIR / "data" / "reports"
REPORT_PATH = REPORT_DIR / "model_evaluation.json"

RISK_LABELS = ["High", "Medium", "Low"]


def actual_risk_label(score: float) -> str:
    if score < 75:
        return "High"
    if score < 80:
        return "Medium"
    return "Low"


def load_data() -> pd.DataFrame:
    if not PREDICTION_PATH.exists():
        raise FileNotFoundError(f"Prediction file not found: {PREDICTION_PATH}")

    df = pd.read_csv(PREDICTION_PATH)

    required_columns = [
        "student_id",
        "predicted_comprehensive",
        "actual_comprehensive",
        "risk_level",
    ]

    for column in required_columns:
        if column not in df.columns:
            raise ValueError(f"Missing required column: {column}")

    df["predicted_comprehensive"] = pd.to_numeric(
        df["predicted_comprehensive"],
        errors="coerce",
    )

    df["actual_comprehensive"] = pd.to_numeric(
        df["actual_comprehensive"],
        errors="coerce",
    )

    df = df.dropna(
        subset=[
            "predicted_comprehensive",
            "actual_comprehensive",
            "risk_level",
        ]
    )

    df["actual_risk_level"] = df["actual_comprehensive"].apply(actual_risk_label)

    df["error"] = df["predicted_comprehensive"] - df["actual_comprehensive"]
    df["absolute_error"] = df["error"].abs()

    df["absolute_percentage_error"] = (
        df["absolute_error"] / df["actual_comprehensive"]
    ) * 100

    return df


def calculate_regression_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    y_true = df["actual_comprehensive"]
    y_pred = df["predicted_comprehensive"]

    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)
    mape = df["absolute_percentage_error"].mean()
    bias = df["error"].mean()

    best_row = df.sort_values("absolute_error", ascending=True).iloc[0]
    worst_row = df.sort_values("absolute_error", ascending=False).iloc[0]

    return {
        "students_evaluated": int(len(df)),
        "mae": round(float(mae), 4),
        "rmse": round(float(rmse), 4),
        "r2": round(float(r2), 4),
        "mape_percent": round(float(mape), 4),
        "bias": round(float(bias), 4),
        "min_error": round(float(df["error"].min()), 4),
        "max_error": round(float(df["error"].max()), 4),
        "best_prediction": {
            "student_id": str(best_row["student_id"]),
            "actual": round(float(best_row["actual_comprehensive"]), 4),
            "predicted": round(float(best_row["predicted_comprehensive"]), 4),
            "error": round(float(best_row["error"]), 4),
            "absolute_error": round(float(best_row["absolute_error"]), 4),
        },
        "worst_prediction": {
            "student_id": str(worst_row["student_id"]),
            "actual": round(float(worst_row["actual_comprehensive"]), 4),
            "predicted": round(float(worst_row["predicted_comprehensive"]), 4),
            "error": round(float(worst_row["error"]), 4),
            "absolute_error": round(float(worst_row["absolute_error"]), 4),
        },
    }


def calculate_classification_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    y_true = df["actual_risk_level"]
    y_pred = df["risk_level"]

    matrix = confusion_matrix(
        y_true,
        y_pred,
        labels=RISK_LABELS,
    )

    report = classification_report(
        y_true,
        y_pred,
        labels=RISK_LABELS,
        output_dict=True,
        zero_division=0,
    )

    actual_distribution = y_true.value_counts().to_dict()
    predicted_distribution = y_pred.value_counts().to_dict()

    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision_macro": round(
            float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
            4,
        ),
        "recall_macro": round(
            float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
            4,
        ),
        "f1_macro": round(
            float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
            4,
        ),
        "actual_distribution": actual_distribution,
        "predicted_distribution": predicted_distribution,
        "confusion_matrix": {
            "labels": RISK_LABELS,
            "matrix": matrix.tolist(),
        },
        "per_class": {
            label: {
                "precision": round(float(report[label]["precision"]), 4),
                "recall": round(float(report[label]["recall"]), 4),
                "f1_score": round(float(report[label]["f1-score"]), 4),
                "support": int(report[label]["support"]),
            }
            for label in RISK_LABELS
            if label in report
        },
    }


def calculate_extra_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    method_distribution = (
        df["method"].value_counts().to_dict()
        if "method" in df.columns
        else {}
    )

    confidence_distribution = (
        df["confidence"].value_counts().to_dict()
        if "confidence" in df.columns
        else {}
    )

    correct_df = df[df["actual_risk_level"] == df["risk_level"]]
    incorrect_df = df[df["actual_risk_level"] != df["risk_level"]]

    worst_misclassified = []

    if not incorrect_df.empty:
        worst_rows = incorrect_df.sort_values(
            "absolute_error",
            ascending=False,
        ).head(10)

        for _, row in worst_rows.iterrows():
            worst_misclassified.append({
                "student_id": str(row["student_id"]),
                "actual_score": round(float(row["actual_comprehensive"]), 4),
                "predicted_score": round(float(row["predicted_comprehensive"]), 4),
                "actual_risk": row["actual_risk_level"],
                "predicted_risk": row["risk_level"],
                "absolute_error": round(float(row["absolute_error"]), 4),
            })

    return {
        "method_distribution": method_distribution,
        "confidence_distribution": confidence_distribution,
        "correct_predictions": int(len(correct_df)),
        "incorrect_predictions": int(len(incorrect_df)),
        "worst_misclassified": worst_misclassified,
    }


def calculate_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    return {
        "regression": calculate_regression_metrics(df),
        "classification": calculate_classification_metrics(df),
        "extra": calculate_extra_metrics(df),
    }


def save_report(metrics: Dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    with open(REPORT_PATH, "w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)


def print_report(metrics: Dict[str, Any]) -> None:
    regression = metrics["regression"]
    classification = metrics["classification"]
    extra = metrics["extra"]

    print("\n==============================")
    print(" AACN MODEL EVALUATION")
    print("==============================")

    print("\nRegression Metrics:")
    print(f"Students evaluated: {regression['students_evaluated']}")
    print(f"MAE: {regression['mae']}")
    print(f"RMSE: {regression['rmse']}")
    print(f"R2: {regression['r2']}")
    print(f"MAPE: {regression['mape_percent']}%")
    print(f"Bias: {regression['bias']}")

    print("\nClassification Metrics:")
    print(f"Accuracy: {classification['accuracy']}")
    print(f"Precision Macro: {classification['precision_macro']}")
    print(f"Recall Macro: {classification['recall_macro']}")
    print(f"F1 Macro: {classification['f1_macro']}")

    print("\nActual Risk Distribution:")
    print(classification["actual_distribution"])

    print("\nPredicted Risk Distribution:")
    print(classification["predicted_distribution"])

    print("\nConfusion Matrix:")
    print("Labels:", classification["confusion_matrix"]["labels"])
    print(classification["confusion_matrix"]["matrix"])

    print("\nPer-Class Metrics:")
    print(classification["per_class"])

    print("\nMethod Distribution:")
    print(extra["method_distribution"])

    print("\nConfidence Distribution:")
    print(extra["confidence_distribution"])

    print("\nCorrect / Incorrect:")
    print({
        "correct": extra["correct_predictions"],
        "incorrect": extra["incorrect_predictions"],
    })

    print("\nWorst Misclassified:")
    print(extra["worst_misclassified"])

    print("\nSaved report:")
    print(REPORT_PATH)

    print("==============================\n")


def main():
    df = load_data()
    metrics = calculate_metrics(df)
    save_report(metrics)
    print_report(metrics)


if __name__ == "__main__":
    main()