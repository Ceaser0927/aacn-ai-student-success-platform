"""
evaluate_highrisk_holdout.py

Held-out evaluation against TWO independent cohorts (S5 and S10), neither of
which was used in training (train_highrisk_models.py trains only on
S6-S9). A stage is only marked `reliable: true` if it clears the AUC bar
on EVERY cohort where it's testable -- passing on one lucky cohort isn't
enough, given how small these cohorts are.

Writes results back into metadata.json under each stage:
    held_out_results: { "s5": {...}, "s10": {...} }
    reliable: true / false / null

predict_highrisk.py reads `reliable` and refuses to present an unreliable
stage's output as an actionable screening flag.
"""

from pathlib import Path
import json
import sys

import pandas as pd
from sklearn.metrics import recall_score, precision_score, roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parent))
from predict_highrisk import predict_student_risk, _load_metadata  # noqa: E402

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data" / "processed"
METADATA_PATH = BASE_DIR / "models" / "metadata.json"
HIGH_RISK_THRESHOLD = 75.0

HOLDOUT_COHORTS = ["s5", "s10"]
# Reliability is judged by RECALL, not AUC -- AUC measures ranking ability in
# the abstract, but the product's stated priority is "catch as many true
# High-risk students as possible" using the ACTUAL recommended_threshold.
# A stage can have decent AUC yet still catch almost nobody at its chosen
# operating point (this happened with stage_late_program in testing --
# AUC 0.55-0.76 but recall 0.0-0.17). Recall is the metric that matches
# what the product actually needs.
RELIABILITY_RECALL_THRESHOLD = 0.70


def evaluate_stage_on_cohort(stage_name, stage_info, df, cohort_name):
    features = stage_info["features"]

    missing_cols = [f for f in features if f not in df.columns]
    if missing_cols:
        print(f"  [{cohort_name}] lacks columns {missing_cols}, cannot evaluate")
        return None

    subset = df.dropna(subset=features + ["Comprehensive"]).copy()
    if len(subset) < 5:
        print(f"  [{cohort_name}] n={len(subset)} too small, skipping")
        return None

    probs, flags = [], []
    for _, row in subset.iterrows():
        scores = {f: row[f] for f in features}
        result = predict_student_risk(str(row["Student_ID"]), scores)
        proba_val = result["probability_high_risk"]
        probs.append(proba_val)
        flags.append(int(proba_val >= stage_info["recommended_threshold"]))

    y_true = (subset["Comprehensive"] < HIGH_RISK_THRESHOLD).astype(int).values
    y_pred = pd.Series(flags).values
    proba = pd.Series(probs).values

    recall = recall_score(y_true, y_pred, zero_division=0)
    precision = precision_score(y_true, y_pred, zero_division=0)
    try:
        auc = roc_auc_score(y_true, proba)
    except ValueError:
        auc = float("nan")

    n_true_high = int(y_true.sum())
    n_caught = int(((y_pred == 1) & (y_true == 1)).sum())
    n_flagged = int(y_pred.sum())

    print(f"  [{cohort_name}] n={len(subset)}  true High-risk={n_true_high}  flagged={n_flagged}  "
          f"AUC={auc:.3f}  recall={recall:.3f} ({n_caught}/{n_true_high})  precision={precision:.3f}")

    return {
        "n": int(len(subset)),
        "auc": round(float(auc), 4) if not pd.isna(auc) else None,
        "recall": round(float(recall), 4),
        "precision": round(float(precision), 4),
        "n_true_high": n_true_high,
        "n_flagged": n_flagged,
        "n_caught": n_caught,
    }


def main():
    metadata = _load_metadata()

    cohort_dfs = {}
    for cohort in HOLDOUT_COHORTS:
        cohort_dfs[cohort] = pd.read_csv(DATA_DIR / f"{cohort}_master_dataset.csv")

    for stage_name, stage_info in metadata["stages"].items():
        print(f"=== {stage_name} (features={stage_info['features']}) ===")

        held_out_results = {}
        for cohort in HOLDOUT_COHORTS:
            result = evaluate_stage_on_cohort(stage_name, stage_info, cohort_dfs[cohort], cohort)
            if result is not None:
                held_out_results[cohort] = result

        stage_info["held_out_results"] = held_out_results

        testable_recalls = [r["recall"] for r in held_out_results.values()]

        if not testable_recalls:
            stage_info["reliable"] = None
            stage_info["reliability_note"] = "Not yet validated on any independent cohort."
        else:
            # Require the WORST cohort's recall to clear the bar -- one good
            # cohort doesn't excuse a bad one. Recall (not AUC) is used
            # because it directly reflects "did we catch the true High-risk
            # students", which is the stated product priority.
            worst_recall = min(testable_recalls)
            is_reliable = worst_recall >= RELIABILITY_RECALL_THRESHOLD
            stage_info["reliable"] = bool(is_reliable)
            stage_info["reliability_note"] = (
                f"Held-out recall per cohort: "
                + ", ".join(f"{c}={r['recall']}" for c, r in held_out_results.items())
                + f". Worst={worst_recall:.3f} (bar={RELIABILITY_RECALL_THRESHOLD}). "
                + ("Clears the recall bar on every testable cohort."
                   if is_reliable else
                   "Does NOT clear the recall bar on at least one cohort -- "
                   "this stage misses too many true High-risk students to be "
                   "presented as an actionable flag.")
            )

        print(f"  RELIABLE (must pass on all testable cohorts): {stage_info['reliable']}\n")

    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Updated {METADATA_PATH} with multi-cohort held-out validation results.")


if __name__ == "__main__":
    main()
