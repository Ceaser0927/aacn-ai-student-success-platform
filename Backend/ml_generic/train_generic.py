"""
train_generic.py

Config-driven version of train_highrisk_models.py. Trains one binary
"high risk" classifier per stage defined in the project config, using
ONLY the train_cohorts listed there. holdout_cohorts are never touched
here -- see evaluate_generic.py.

Usage:
    python3 train_generic.py configs/nursing_config.json
    python3 train_generic.py configs/hospital_config.json   # <- same code,
                                                              #    different config
"""

from pathlib import Path
import argparse
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import roc_auc_score, precision_recall_curve

from config_loader import load_config, compute_is_high_risk
from data_loader import load_cohort


def load_training_data(config) -> pd.DataFrame:
    frames = []
    for cohort in config["train_cohorts"]:
        df = load_cohort(cohort, config)
        df["_cohort"] = cohort
        frames.append(df)
    combined = pd.concat(frames, ignore_index=True)
    combined["_is_high_risk"] = compute_is_high_risk(combined[config["target_column"]], config)
    return combined


def find_recommended_threshold(y_true, proba, target_recall: float = 0.9) -> float:
    precisions, recalls, thresholds = precision_recall_curve(y_true, proba)
    best_threshold = 0.1
    for p, r, t in zip(precisions[:-1], recalls[:-1], thresholds):
        if r >= target_recall:
            best_threshold = t
    return float(best_threshold)


def train_stage(df: pd.DataFrame, stage_name: str, features: list, config, models_dir: Path):
    target_col = config["target_column"]
    min_samples = config["min_train_samples"]

    excluded = set(config.get("excluded_features", []))
    bad_features = [f for f in features if f in excluded]
    if bad_features:
        raise ValueError(
            f"Stage {stage_name!r} uses excluded feature(s) {bad_features} -- "
            f"remove them from the stage definition or from excluded_features."
        )

    subset = df.dropna(subset=features + [target_col]).copy()
    n = len(subset)

    if n < min_samples:
        print(f"[SKIP] {stage_name}: only {n} usable rows (< {min_samples}), not training.")
        return None

    X = subset[features].values
    y = subset["_is_high_risk"].values
    positive_rate = y.mean()

    if y.sum() < 2 or y.sum() == len(y):
        print(f"[SKIP] {stage_name}: positive class has {int(y.sum())} examples, can't train/validate.")
        return None

    loo = LeaveOneOut()
    cv_proba = np.zeros(n)
    for train_idx, test_idx in loo.split(X):
        m = LogisticRegression(class_weight="balanced", max_iter=1000)
        m.fit(X[train_idx], y[train_idx])
        cv_proba[test_idx] = m.predict_proba(X[test_idx])[:, 1]

    try:
        auc = roc_auc_score(y, cv_proba)
    except ValueError:
        auc = float("nan")

    recommended_threshold = find_recommended_threshold(y, cv_proba, target_recall=0.9)

    final_model = LogisticRegression(class_weight="balanced", max_iter=1000)
    final_model.fit(X, y)

    model_path = models_dir / f"{stage_name}.joblib"
    joblib.dump(final_model, model_path)

    print(f"[OK] {stage_name}: n={n}, positive_rate={positive_rate:.1%}, "
          f"LOOCV AUC={auc:.3f}, recommended_threshold={recommended_threshold:.3f}")

    # Store the training-set mean for each feature, and the model's
    # coefficient for each feature. Together these let predict_generic.py
    # explain WHY a given prediction came out the way it did (e.g. "this
    # student's OB score is 13 points below the cohort average, and OB is
    # the feature the model weighs most heavily") -- grounded in the
    # model's actual math, not a guess.
    feature_means = {f: round(float(subset[f].mean()), 4) for f in features}
    feature_coefficients = {f: round(float(c), 6) for f, c in zip(features, final_model.coef_[0])}

    return {
        "features": features,
        "model_path": str(model_path),
        "n_train": int(n),
        "positive_rate": round(float(positive_rate), 4),
        "loocv_auc": round(float(auc), 4) if not np.isnan(auc) else None,
        "recommended_threshold": round(float(recommended_threshold), 4),
        "feature_means": feature_means,
        "feature_coefficients": feature_coefficients,
    }


def main():
    parser = argparse.ArgumentParser(description="Train progressive-stage risk classifiers from a config.")
    parser.add_argument("config_path", help="Path to project_config.json")
    args = parser.parse_args()

    config = load_config(args.config_path)
    models_dir = config["_config_dir"] / "models" / config["project_name"]
    models_dir.mkdir(parents=True, exist_ok=True)

    df = load_training_data(config)
    print(f"[{config['project_name']}] Loaded training data: {len(df)} rows "
          f"from cohorts {config['train_cohorts']}\n")

    stage_metadata = {}
    for stage_name, features in config["stages"].items():
        result = train_stage(df, stage_name, features, config, models_dir)
        if result is not None:
            stage_metadata[stage_name] = result

    metadata = {
        "project_name": config["project_name"],
        "id_column": config["id_column"],
        "target_column": config["target_column"],
        "risk_direction": config["risk_direction"],
        "risk_threshold": config["risk_threshold"],
        "excluded_features": config.get("excluded_features", []),
        "stages": stage_metadata,
        "train_cohorts": config["train_cohorts"],
        "reliability_recall_threshold": config["reliability_recall_threshold"],
    }

    metadata_path = models_dir / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nSaved metadata: {metadata_path}")


if __name__ == "__main__":
    main()