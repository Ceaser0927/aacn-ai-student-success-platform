"""
train_highrisk_models.py

Trains PROGRESSIVE-STAGE binary "High risk" classifiers instead of the old
3-class (High/Medium/Low) + chained-imputation architecture.

Key design decisions (based on empirical findings from S5-S10 data):
- Target is reframed as BINARY: is_high_risk = (Comprehensive < HIGH_RISK_THRESHOLD)
  Medium/Low are NOT separately modeled -- the product only cares about
  catching High-risk students (recall-first), not fine-grained tiering.
- One classifier is trained PER "stage" = a specific set of known courses,
  matching how much data a real in-progress student would actually have.
  This replaces chained imputation (which was shown to compound regression-
  to-the-mean errors) with models that only ever see REAL observed scores.
- 'Peds' is EXCLUDED from all stages: S5 cohort's Peds scores are on a
  clearly different scale (mean ~66 vs ~81 in S6-S10, std 3x larger),
  which was empirically shown to make cross-cohort predictions worse than
  random (negative R2). Do not use Peds until this is investigated/recalibrated.
- class_weight='balanced' is used because High-risk is a minority class
  (~8-12% of students), and plain classifiers ignore it otherwise.
- Training data = S6, S7, S8, S9, S10 (S5 is reserved as a fully held-out
  test cohort -- see evaluate_highrisk_s5.py).

Run:
    python train_highrisk_models.py
"""

from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import roc_auc_score, precision_recall_curve

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data" / "processed"
MODEL_DIR = BASE_DIR / "models"
METADATA_PATH = MODEL_DIR / "metadata.json"

TRAIN_COHORTS = ["s6", "s7", "s8", "s9"]  # S10 held out for validation, S5 held out for validation

HIGH_RISK_THRESHOLD = 75.0  # Comprehensive < this => High risk (matches pass-mark ~70-75 discussion)

# Progressive course stages, in the order a real student accumulates them.
# Excludes Peds (scale mismatch across cohorts, see earlier findings) AND
# Pharm (Pharm is missing entirely in S5 and missing in 62/63 rows of S10 --
# too unreliably recorded across cohorts to depend on for a shipped model).
STAGES = {
    "stage_ct1_only": ["CT1"],
    "stage_ct1_ob": ["CT1", "OB"],
    "stage_mid_program": ["CT1", "OB", "Comm", "Men"],
    "stage_late_program": ["CT1", "OB", "Comm", "Men", "MS", "CT2", "Leadership"],
}

MIN_TRAIN_SAMPLES = 30  # below this, a stage is not trustworthy enough to ship


def load_training_data() -> pd.DataFrame:
    frames = []
    for cohort in TRAIN_COHORTS:
        path = DATA_DIR / f"{cohort}_master_dataset.csv"
        df = pd.read_csv(path)
        df["cohort"] = cohort
        frames.append(df)
    combined = pd.concat(frames, ignore_index=True)
    combined["is_high_risk"] = (combined["Comprehensive"] < HIGH_RISK_THRESHOLD).astype(int)
    return combined


def find_recommended_threshold(y_true: np.ndarray, proba: np.ndarray, target_recall: float = 0.9) -> float:
    """
    Pick the lowest probability threshold that achieves at least `target_recall`
    on the (in-sample / CV) predictions. Recall-first, since missing a
    genuinely at-risk student is the costly error here, not over-flagging.
    """
    precisions, recalls, thresholds = precision_recall_curve(y_true, proba)
    # precision_recall_curve returns thresholds of length n-1; recalls/precisions length n
    best_threshold = 0.1  # conservative fallback: flag broadly
    for p, r, t in zip(precisions[:-1], recalls[:-1], thresholds):
        if r >= target_recall:
            best_threshold = t
    return float(best_threshold)


def train_stage(df: pd.DataFrame, stage_name: str, features: list) -> dict:
    subset = df.dropna(subset=features + ["Comprehensive"]).copy()
    n = len(subset)

    if n < MIN_TRAIN_SAMPLES:
        print(f"[SKIP] {stage_name}: only {n} usable rows (< {MIN_TRAIN_SAMPLES}), not training.")
        return None

    X = subset[features].values
    y = subset["is_high_risk"].values
    positive_rate = y.mean()

    # In-sample LOOCV probabilities, used only to pick a sane default threshold
    # and to report an honest (non-overfit) AUC for this stage.
    loo = LeaveOneOut()
    cv_proba = np.zeros(n)
    for train_idx, test_idx in loo.split(X):
        m = LogisticRegression(class_weight="balanced", max_iter=1000)
        m.fit(X[train_idx], y[train_idx])
        cv_proba[test_idx] = m.predict_proba(X[test_idx])[:, 1]

    try:
        auc = roc_auc_score(y, cv_proba)
    except ValueError:
        auc = float("nan")  # can happen if a fold has only one class

    recommended_threshold = find_recommended_threshold(y, cv_proba, target_recall=0.9)

    # Final model trained on ALL available training rows for this stage
    final_model = LogisticRegression(class_weight="balanced", max_iter=1000)
    final_model.fit(X, y)

    model_path = MODEL_DIR / f"{stage_name}.joblib"
    joblib.dump(final_model, model_path)

    print(f"[OK] {stage_name}: n={n}, positive_rate={positive_rate:.1%}, "
          f"LOOCV AUC={auc:.3f}, recommended_threshold={recommended_threshold:.3f}")

    return {
        "features": features,
        "model_path": str(model_path),
        "n_train": int(n),
        "positive_rate": round(float(positive_rate), 4),
        "loocv_auc": round(float(auc), 4) if not np.isnan(auc) else None,
        "recommended_threshold": round(float(recommended_threshold), 4),
    }


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    df = load_training_data()
    print(f"Loaded training data: {len(df)} rows from cohorts {TRAIN_COHORTS}\n")

    stage_metadata = {}
    for stage_name, features in STAGES.items():
        result = train_stage(df, stage_name, features)
        if result is not None:
            stage_metadata[stage_name] = result

    metadata = {
        "high_risk_threshold": HIGH_RISK_THRESHOLD,
        "excluded_courses": ["Peds", "MS5", "Pharm", "Foundation"],
        "exclusion_reason": {
            "Peds": "Scale mismatch across cohorts (S5 mean~66 vs S6-10 mean~81); "
                    "degrades held-out performance until recalibrated/investigated.",
            "MS5": "Only present in S5 cohort, not in training cohorts.",
            "Pharm": "Missing entirely in S5 and missing in 62/63 rows of S10 -- "
                     "too unreliably recorded across cohorts to depend on.",
            "Foundation": "Missing entirely in S5, so any stage using it can't be "
                          "validated against that held-out cohort.",
        },
        "course_order_full": ["CT1", "OB", "Comm", "Men", "MS", "CT2", "Leadership"],
        "stages": stage_metadata,
        "train_cohorts": TRAIN_COHORTS,
    }

    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nSaved metadata: {METADATA_PATH}")


if __name__ == "__main__":
    main()
