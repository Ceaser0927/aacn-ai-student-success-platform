from pathlib import Path
from typing import Dict, Any, List, Union
from itertools import combinations

import json
import joblib
import pandas as pd
import numpy as np

from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    accuracy_score,
    f1_score,
)
from sklearn.model_selection import train_test_split


COURSE_ORDER = [
    "Foundation",
    "CT1",
    "Pharm",
    "OB",
    "Peds",
    "Comm",
    "Men",
    "MS5",
    "MS",
    "CT2",
    "Leadership",
]

MAX_PRIMARY_FEATURES = 3

RISK_LABELS = ["High", "Medium", "Low"]


def create_risk_label(score: float) -> str:
    if score < 75:
        return "High"
    elif score < 85:
        return "Medium"
    else:
        return "Low"


def _load_datasets(dataset_path: Union[Path, List[Path]]) -> tuple[pd.DataFrame, Path, Any]:
    if isinstance(dataset_path, list):
        dataframes = []

        for path in dataset_path:
            path = Path(path)

            if not path.exists():
                raise FileNotFoundError(f"Dataset not found: {path}")

            df_part = pd.read_csv(path)
            df_part["Cohort"] = path.stem.replace("_master_dataset", "").upper()
            dataframes.append(df_part)

        df = pd.concat(dataframes, ignore_index=True)
        base_dir = Path(dataset_path[0]).parents[2]

        return df, base_dir, [str(Path(p)) for p in dataset_path]

    path = Path(dataset_path)

    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    df = pd.read_csv(path)
    base_dir = path.parents[2]

    return df, base_dir, str(path)


def _clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    for col in df.columns:
        converted = pd.to_numeric(df[col], errors="coerce")

        if converted.notna().sum() > 0:
            df[col] = converted

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    for col in numeric_cols:
        df[col] = df[col].fillna(df[col].median())

    return df


def _available_courses(df: pd.DataFrame, target_column: str) -> List[str]:
    return [
        course
        for course in COURSE_ORDER
        if course in df.columns and course != target_column
    ]


def _regression_metrics(y_true, y_pred) -> Dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def _classification_metrics(y_true, y_pred) -> Dict[str, float]:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
    }


def _safe_split(X, y):
    if len(X) < 5:
        return X, X, y, y

    try:
        return train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
            stratify=y if y.nunique() > 1 and y.value_counts().min() >= 2 else None,
        )
    except ValueError:
        return train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
        )


def _train_primary_models(
    df: pd.DataFrame,
    courses: List[str],
    target_column: str,
    models_dir: Path,
) -> Dict[str, Any]:
    primary_metadata: Dict[str, Any] = {}
    model_count = 0

    max_size = min(MAX_PRIMARY_FEATURES, len(courses))

    for size in range(1, max_size + 1):
        for feature_combo in combinations(courses, size):
            features = list(feature_combo)
            model_df = df[features + [target_column]].dropna()

            if len(model_df) < 10:
                continue

            X = model_df[features]
            y_reg = model_df[target_column]
            y_cls = y_reg.apply(create_risk_label)

            X_train, X_test, y_train, y_test = _safe_split(X, y_reg)

            regressor = RandomForestRegressor(
                n_estimators=80,
                random_state=42,
                min_samples_leaf=2,
            )

            regressor.fit(X_train, y_train)
            reg_preds = regressor.predict(X_test)
            reg_metrics = _regression_metrics(y_test, reg_preds)

            X_train_c, X_test_c, y_train_c, y_test_c = _safe_split(X, y_cls)

            classifier = RandomForestClassifier(
                n_estimators=80,
                random_state=42,
                min_samples_leaf=2,
                class_weight="balanced",
            )

            classifier.fit(X_train_c, y_train_c)
            cls_preds = classifier.predict(X_test_c)
            cls_metrics = _classification_metrics(y_test_c, cls_preds)

            model_count += 1

            regressor_path = models_dir / f"primary_regressor_combo_{model_count}.pkl"
            classifier_path = models_dir / f"primary_classifier_combo_{model_count}.pkl"

            joblib.dump(regressor, regressor_path)
            joblib.dump(classifier, classifier_path)

            primary_metadata[f"combo_{model_count}"] = {
                "features": features,
                "feature_count": len(features),
                "regressor_path": str(regressor_path),
                "classifier_path": str(classifier_path),
                "regression_metrics": reg_metrics,
                "classification_metrics": cls_metrics,
                "rows_used": int(len(model_df)),
            }

    return primary_metadata


def _train_relationship_models(
    df: pd.DataFrame,
    courses: List[str],
    models_dir: Path,
) -> Dict[str, Any]:
    relationship_dir = models_dir / "relationship_models"
    relationship_dir.mkdir(parents=True, exist_ok=True)

    relationship_metadata: Dict[str, Any] = {}

    for target_course in courses:
        input_features = [course for course in courses if course != target_course]
        model_df = df[input_features + [target_course]].dropna()

        if len(model_df) < 10:
            continue

        X = model_df[input_features]
        y = model_df[target_course]

        X_train, X_test, y_train, y_test = _safe_split(X, y)

        model = RandomForestRegressor(
            n_estimators=80,
            random_state=42,
            min_samples_leaf=2,
        )

        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        metrics = _regression_metrics(y_test, preds)

        model_path = relationship_dir / f"estimate_{target_course}.pkl"
        joblib.dump(model, model_path)

        relationship_metadata[target_course] = {
            "target_course": target_course,
            "input_features": input_features,
            "model_path": str(model_path),
            "metrics": metrics,
            "rows_used": int(len(model_df)),
        }

    return relationship_metadata


def train_progressive_models(
    dataset_path: Union[Path, List[Path]],
    target_column: str = "Comprehensive",
    pass_mark: float = 75,
) -> Dict[str, Any]:

    df, base_dir, dataset_source = _load_datasets(dataset_path)

    models_dir = base_dir / "ml" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    df = _clean_dataframe(df)

    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")

    courses = _available_courses(df, target_column)

    if len(courses) < 1:
        raise ValueError("No valid course columns found for training.")

    metadata: Dict[str, Any] = {
        "target_column": target_column,
        "pass_mark": pass_mark,
        "risk_label_strategy": {
            "High": "Comprehensive < 75",
            "Medium": "75 <= Comprehensive < 80",
            "Low": "Comprehensive >= 80",
        },
        "dataset_source": dataset_source,
        "course_order": courses,
        "primary_model_strategy": "flexible_course_combinations",
        "max_primary_features": MAX_PRIMARY_FEATURES,
        "primary_models": {},
        "full_model": {},
        "risk_classifier": {},
        "relationship_models": {},
        "missing_estimator": {},
    }

    metadata["primary_models"] = _train_primary_models(
        df=df,
        courses=courses,
        target_column=target_column,
        models_dir=models_dir,
    )

    full_df = df[courses + [target_column]].dropna()

    if len(full_df) < 10:
        raise ValueError("Not enough complete rows to train full model.")

    X_full = full_df[courses]
    y_full_reg = full_df[target_column]
    y_full_cls = y_full_reg.apply(create_risk_label)

    X_train, X_test, y_train, y_test = _safe_split(X_full, y_full_reg)

    full_regressor = RandomForestRegressor(
        n_estimators=120,
        random_state=42,
        min_samples_leaf=2,
    )

    full_regressor.fit(X_train, y_train)
    reg_preds = full_regressor.predict(X_test)
    full_reg_metrics = _regression_metrics(y_test, reg_preds)

    full_regressor_path = models_dir / "full_risk_regressor.pkl"
    joblib.dump(full_regressor, full_regressor_path)

    metadata["full_model"] = {
        "features": courses,
        "model_path": str(full_regressor_path),
        "metrics": full_reg_metrics,
        "rows_used": int(len(full_df)),
    }

    X_train_c, X_test_c, y_train_c, y_test_c = _safe_split(X_full, y_full_cls)

    risk_classifier = RandomForestClassifier(
        n_estimators=120,
        random_state=42,
        min_samples_leaf=2,
        class_weight="balanced",
    )

    risk_classifier.fit(X_train_c, y_train_c)
    cls_preds = risk_classifier.predict(X_test_c)
    cls_metrics = _classification_metrics(y_test_c, cls_preds)

    risk_classifier_path = models_dir / "risk_level_classifier.pkl"
    joblib.dump(risk_classifier, risk_classifier_path)

    metadata["risk_classifier"] = {
        "features": courses,
        "model_path": str(risk_classifier_path),
        "classes": list(risk_classifier.classes_),
        "metrics": cls_metrics,
        "rows_used": int(len(full_df)),
        "class_distribution": y_full_cls.value_counts().to_dict(),
    }

    metadata["relationship_models"] = _train_relationship_models(
        df=df,
        courses=courses,
        models_dir=models_dir,
    )

    course_medians = {
        course: float(df[course].median())
        for course in courses
        if course in df.columns
    }

    course_correlations = (
        df[courses + [target_column]]
        .corr(numeric_only=True)
        .fillna(0)
        .to_dict()
    )

    metadata["missing_estimator"] = {
        "method": "relationship_model_with_correlation_fallback",
        "course_medians": course_medians,
        "course_correlations": course_correlations,
    }

    metadata_path = models_dir / "metadata.json"

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return {
        "message": "Risk classification training completed successfully.",
        "dataset_source": dataset_source,
        "models_dir": str(models_dir),
        "metadata_path": str(metadata_path),
        "primary_models_trained": len(metadata["primary_models"]),
        "relationship_models_trained": len(metadata["relationship_models"]),
        "course_order": courses,
        "full_regression_metrics": full_reg_metrics,
        "risk_classifier_metrics": cls_metrics,
        "risk_class_distribution": metadata["risk_classifier"]["class_distribution"],
        "rows_used_full_model": int(len(full_df)),
    }