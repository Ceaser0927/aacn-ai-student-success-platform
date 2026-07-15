"""
data_loader.py

Abstracts "how do I get a cohort's data as a DataFrame" away from the
training/evaluation code. Today it's CSV files (nursing course data
exported by hand). Tomorrow it might be a hospital's database query, an
API pull, or a de-identified extract handed over under a data use
agreement. Only THIS file needs a new implementation when that happens --
train_generic.py / evaluate_generic.py / predict_generic.py never change.

To add a new source: implement a function with the same signature as
`load_cohort_csv` below (cohort_name, config) -> pd.DataFrame, and point
`get_loader(config)` at it based on a "data_source" field in the config
(defaults to "csv" if not specified, for backward compatibility with the
nursing project's config).
"""

from pathlib import Path
from typing import Any, Callable, Dict

import pandas as pd


def load_cohort_csv(cohort_name: str, config: Dict[str, Any]) -> pd.DataFrame:
    data_dir: Path = config["_resolved_data_dir"]
    filename = config["file_pattern"].format(cohort=cohort_name)
    path = data_dir / filename

    if not path.exists():
        raise FileNotFoundError(
            f"Cohort file not found: {path}\n"
            f"(data_dir={data_dir}, file_pattern={config['file_pattern']!r}, "
            f"cohort={cohort_name!r})"
        )

    return pd.read_csv(path)


# Registry of available loaders. A new data source (e.g. a hospital DB)
# gets added here as a new key, not by editing the training/eval scripts.
_LOADERS: Dict[str, Callable[[str, Dict[str, Any]], pd.DataFrame]] = {
    "csv": load_cohort_csv,
}


def get_loader(config: Dict[str, Any]) -> Callable[[str, Dict[str, Any]], pd.DataFrame]:
    source = config.get("data_source", "csv")
    if source not in _LOADERS:
        raise ValueError(
            f"Unknown data_source {source!r} in config. "
            f"Available: {list(_LOADERS.keys())}. "
            f"Add a new loader function in data_loader.py and register it "
            f"in _LOADERS to support a new data source."
        )
    return _LOADERS[source]


def load_cohort(cohort_name: str, config: Dict[str, Any]) -> pd.DataFrame:
    loader = get_loader(config)
    return loader(cohort_name, config)
