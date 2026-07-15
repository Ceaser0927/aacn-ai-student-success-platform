"""
config_loader.py

Loads a project_config.json that describes EVERYTHING project-specific
about a risk-screening task: what the target is, what "bad" means, what
features exist at what stage, which cohorts are for training vs held-out
validation, and where the data lives.

This is the file that changes when you move from "nursing student risk"
to "hospital patient deterioration risk" (or any other domain). The
training/evaluation/prediction code (train_generic.py, evaluate_generic.py,
predict_generic.py) reads this config and never needs to change itself --
that is the whole point of "portability": swap the config + a data loader,
keep the pipeline.

CONFIG FIELDS
-------------
project_name          : str, human-readable label, used in logs/output
id_column              : str, column name that uniquely identifies a
                         subject (a student, a patient, etc.)
target_column          : str, the outcome column used to derive risk
                         (e.g. "Comprehensive" score, or a hospital
                         deterioration/acuity score)
risk_direction         : "low_is_bad" or "high_is_bad"
                         - low_is_bad:  risk = (target < risk_threshold)
                           (matches this project: low Comprehensive = risk)
                         - high_is_bad: risk = (target >= risk_threshold)
                           (matches e.g. a deterioration score where
                           higher = more severe)
risk_threshold         : float, the cutoff used with risk_direction above
excluded_features      : list[str], features known to be unreliable
                         (miscalibrated across cohorts, too sparse, etc.)
                         -- NEVER used in training even if present in data
stages                 : dict[str, list[str]], progressive feature sets,
                         from earliest/sparsest to most complete. Each
                         stage gets its own independently trained model.
train_cohorts          : list[str], cohort/file identifiers used ONLY for
                         training (never touched during validation)
holdout_cohorts        : list[str], cohort/file identifiers NEVER used in
                         training -- used only to validate reliability
data_dir               : str, path (relative to this config file's
                         location, or absolute) where cohort files live
file_pattern           : str, filename pattern with "{cohort}" placeholder,
                         e.g. "{cohort}_master_dataset.csv"
min_train_samples      : int, minimum usable rows required to train a
                         stage at all
reliability_recall_threshold : float, minimum recall a stage must clear on
                         EVERY held-out cohort to be marked reliable and
                         used for actionable screening output
"""

from pathlib import Path
from typing import Any, Dict
import json

REQUIRED_FIELDS = [
    "project_name", "id_column", "target_column", "risk_direction",
    "risk_threshold", "excluded_features", "stages", "train_cohorts",
    "holdout_cohorts", "data_dir", "file_pattern", "min_train_samples",
    "reliability_recall_threshold",
]


def load_config(config_path: str) -> Dict[str, Any]:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(path, "r", encoding="utf-8") as f:
        config = json.load(f)

    missing = [field for field in REQUIRED_FIELDS if field not in config]
    if missing:
        raise ValueError(f"Config {config_path} is missing required fields: {missing}")

    if config["risk_direction"] not in ("low_is_bad", "high_is_bad"):
        raise ValueError(
            f"risk_direction must be 'low_is_bad' or 'high_is_bad', "
            f"got: {config['risk_direction']!r}"
        )

    # Resolve data_dir relative to the config file's own location, so the
    # config is portable regardless of where scripts are invoked from.
    data_dir = Path(config["data_dir"])
    if not data_dir.is_absolute():
        data_dir = (path.parent / data_dir).resolve()
    config["_resolved_data_dir"] = data_dir
    config["_config_dir"] = path.parent.resolve()

    return config


def compute_is_high_risk(target_values, config: Dict[str, Any]):
    """
    Applies the config's risk_direction + risk_threshold to a pandas
    Series (or array-like) of target values, returning a 0/1 array.
    """
    threshold = config["risk_threshold"]
    if config["risk_direction"] == "low_is_bad":
        return (target_values < threshold).astype(int)
    else:  # "high_is_bad"
        return (target_values >= threshold).astype(int)
