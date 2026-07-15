from ml.feature_engineering import add_engineered_features
from pathlib import Path
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.metrics import mean_absolute_error, r2_score, accuracy_score


BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_DIR = BASE_DIR / "data" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def train_model(
    dataset_path,
    target_column="Comprehensive",
    pass_mark=75
):

    df = pd.read_csv(dataset_path)

    df = add_engineered_features(df, pass_mark=pass_mark)

    exclude_columns = [
        "StudentID",
        "Cohort",
        target_column,
    ]

    features = [
        col
        for col in df.columns
        if col not in exclude_columns
    ]

    for col in features:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df[target_column] = pd.to_numeric(
        df[target_column],
        errors="coerce"
    )

    df["Pass"] = (
        df[target_column] >= pass_mark
    ).astype(int)

    df_clean = df.dropna(
        subset=features + [target_column]
    )

    X = df_clean[features]
    y_score = df_clean[target_column]
    y_pass = df_clean["Pass"]

    (
        X_train,
        X_test,
        y_score_train,
        y_score_test,
        y_pass_train,
        y_pass_test,
    ) = train_test_split(
        X,
        y_score,
        y_pass,
        test_size=0.2,
        random_state=42,
    )

    regression_model = RandomForestRegressor(
        n_estimators=100,
        random_state=42,
    )

    classification_model = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        class_weight="balanced",
    )

    regression_model.fit(
        X_train,
        y_score_train,
    )

    classification_model.fit(
        X_train,
        y_pass_train,
    )

    score_pred = regression_model.predict(X_test)
    pass_pred = classification_model.predict(X_test)

    mae = mean_absolute_error(
        y_score_test,
        score_pred,
    )

    r2 = r2_score(
        y_score_test,
        score_pred,
    )

    accuracy = accuracy_score(
        y_pass_test,
        pass_pred,
    )

    regression_path = (
        MODEL_DIR /
        "latest_regression_model.pkl"
    )

    classification_path = (
        MODEL_DIR /
        "latest_classification_model.pkl"
    )

    joblib.dump(
        {
            "model": regression_model,
            "features": features,
            "target": target_column,
            "pass_mark": pass_mark,
        },
        regression_path,
    )

    joblib.dump(
        {
            "model": classification_model,
            "features": features,
            "target": "Pass",
            "source_target": target_column,
            "pass_mark": pass_mark,
        },
        classification_path,
    )

    return {
        "rows_used": len(df_clean),
        "target": target_column,
        "pass_mark": pass_mark,
        "features": features,
        "mae": round(mae, 2),
        "r2": round(r2, 2),
        "accuracy": round(accuracy, 2),
        "regression_model": str(regression_path),
        "classification_model": str(classification_path),
    }