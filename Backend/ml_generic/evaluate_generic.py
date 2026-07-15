"""
evaluate_generic.py

Config-driven version of evaluate_highrisk_holdout.py. Validates every
trained stage against EVERY cohort listed in config["holdout_cohorts"] --
none of which were used in training. A stage is marked `reliable: true`
only if it clears `reliability_recall_threshold` on ALL testable cohorts.

Usage:
    python3 evaluate_generic.py configs/nursing_config.json
"""

from pathlib import Path
import argparse
import json

import pandas as pd
from sklearn.metrics import recall_score, precision_score, roc_auc_score

from config_loader import load_config, compute_is_high_risk
from data_loader import load_cohort


def evaluate_stage_on_cohort(stage_name, stage_info, df, cohort_name, config):
    features = stage_info["features"]
    target_col = config["target_column"]

    missing_cols = [f for f in features if f not in df.columns]
    if missing_cols:
        print(f"  [{cohort_name}] lacks columns {missing_cols}, cannot evaluate")
        return None

    subset = df.dropna(subset=features + [target_col]).copy()
    if len(subset) < 5:
        print(f"  [{cohort_name}] n={len(subset)} too small, skipping")
        return None

    import joblib
    model = joblib.load(stage_info["model_path"])

    proba = model.predict_proba(subset[features].values)[:, 1]
    flags = (proba >= stage_info["recommended_threshold"]).astype(int)

    y_true = compute_is_high_risk(subset[target_col], config).values

    recall = recall_score(y_true, flags, zero_division=0)
    precision = precision_score(y_true, flags, zero_division=0)
    try:
        auc = roc_auc_score(y_true, proba)
    except ValueError:
        auc = float("nan")

    n_true_high = int(y_true.sum())
    n_caught = int(((flags == 1) & (y_true == 1)).sum())
    n_flagged = int(flags.sum())

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
    parser = argparse.ArgumentParser(description="Validate trained stages against held-out cohorts.")
    parser.add_argument("config_path", help="Path to project_config.json")
    args = parser.parse_args()

    config = load_config(args.config_path)
    models_dir = config["_config_dir"] / "models" / config["project_name"]
    metadata_path = models_dir / "metadata.json"

    if not metadata_path.exists():
        raise FileNotFoundError(f"{metadata_path} not found. Run train_generic.py first.")

    with open(metadata_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    reliability_bar = config["reliability_recall_threshold"]

    cohort_dfs = {}
    for cohort in config["holdout_cohorts"]:
        cohort_dfs[cohort] = load_cohort(cohort, config)

    for stage_name, stage_info in metadata["stages"].items():
        print(f"=== {stage_name} (features={stage_info['features']}) ===")

        held_out_results = {}
        for cohort in config["holdout_cohorts"]:
            result = evaluate_stage_on_cohort(stage_name, stage_info, cohort_dfs[cohort], cohort, config)
            if result is not None:
                held_out_results[cohort] = result

        stage_info["held_out_results"] = held_out_results
        testable_recalls = [r["recall"] for r in held_out_results.values()]

        if not testable_recalls:
            stage_info["reliable"] = None
            stage_info["reliability_note"] = "Not yet validated on any independent cohort."
        else:
            worst_recall = min(testable_recalls)
            is_reliable = worst_recall >= reliability_bar
            stage_info["reliable"] = bool(is_reliable)
            stage_info["reliability_note"] = (
                f"Held-out recall per cohort: "
                + ", ".join(f"{c}={r['recall']}" for c, r in held_out_results.items())
                + f". Worst={worst_recall:.3f} (bar={reliability_bar}). "
                + ("Clears the recall bar on every testable cohort."
                   if is_reliable else
                   "Does NOT clear the recall bar on at least one cohort -- "
                   "this stage misses too many true High-risk cases to be "
                   "presented as an actionable flag.")
            )

        print(f"  RELIABLE (must pass on all testable cohorts): {stage_info['reliable']}\n")

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Updated {metadata_path} with multi-cohort held-out validation results.")


if __name__ == "__main__":
    main()
