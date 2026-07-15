from pathlib import Path
import pandas as pd
import joblib

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_DIR = BASE_DIR / "data" / "models"

REGRESSION_MODEL_PATH = MODEL_DIR / "latest_regression_model.pkl"
CLASSIFICATION_MODEL_PATH = MODEL_DIR / "latest_classification_model.pkl"


def load_models():
    regression_bundle = joblib.load(REGRESSION_MODEL_PATH)
    classification_bundle = joblib.load(CLASSIFICATION_MODEL_PATH)

    return regression_bundle, classification_bundle


def predict_student(student_data: dict):
    regression_bundle, classification_bundle = load_models()

    regression_model = regression_bundle["model"]
    classification_model = classification_bundle["model"]

    features = regression_bundle["features"]
    pass_mark = regression_bundle["pass_mark"]

    df = pd.DataFrame([student_data])

    if "CT_Growth" in features:
        if "CT1" in df.columns and "CT2" in df.columns:
            df["CT_Growth"] = df["CT2"] - df["CT1"]
        else:
            df["CT_Growth"] = None

    for feature in features:
        if feature not in df.columns:
            df[feature] = None

    X = df[features]

    predicted_score = regression_model.predict(X)[0]

    probabilities = classification_model.predict_proba(X)[0]
    fail_probability = probabilities[0]
    pass_probability = probabilities[1]

    if pass_probability >= 0.8:
        risk_level = "Low Risk"
    elif pass_probability >= 0.5:
        risk_level = "Medium Risk"
    else:
        risk_level = "High Risk"

    feature_scores = df[features].drop(columns=["CT_Growth"], errors="ignore").iloc[0]

    weak_subjects = (
        feature_scores
        .sort_values()
        .head(3)
        .to_dict()
    )

    strong_subjects = (
        feature_scores
        .sort_values(ascending=False)
        .head(3)
        .to_dict()
    )

    return {
        "predicted_comprehensive_score": float(round(predicted_score, 2)),
        "pass_mark": int(pass_mark),
        "pass_probability": float(round(pass_probability, 2)),
        "fail_probability": float(round(fail_probability, 2)),
        "risk_level": risk_level,
        "weak_subjects": {k: float(v) for k, v in weak_subjects.items()},
        "strong_subjects": {k: float(v) for k, v in strong_subjects.items()},
        "features_used": features,
    }