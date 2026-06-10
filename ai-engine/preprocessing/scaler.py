"""
preprocessing/scaler.py
RobustScaler — outlier-resistant normalization for financial data.

CRITICAL FIX: CatBoost requires cat_features to remain integer dtype.
We load the encoded column names from encoders.json at runtime and exclude
them from scaling so they stay as int (not float).
"""
import json
import logging
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.preprocessing import RobustScaler

logger = logging.getLogger("nyxara.scaler")
ARTIFACTS_DIR = Path(__file__).parent.parent / "models" / "artifacts"


def _get_encoded_cols() -> list[str]:
    """Return column names that were label-encoded (must stay integer)."""
    path = ARTIFACTS_DIR / "encoders.json"
    if not path.exists():
        return []
    with open(path) as f:
        return list(json.load(f).keys())


def fit_scaler(X: pd.DataFrame) -> tuple[pd.DataFrame, RobustScaler]:
    """Fit RobustScaler on training data, skipping encoded categorical columns."""
    encoded_cols = _get_encoded_cols()

    # Only scale numeric columns that are NOT label-encoded categoricals
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    cols_to_scale = [c for c in numeric_cols if c not in encoded_cols]

    scaler = RobustScaler()
    X = X.copy()
    if cols_to_scale:
        X[cols_to_scale] = scaler.fit_transform(X[cols_to_scale])

    # Save params — only for the columns we actually scaled
    params = {
        "columns": cols_to_scale,
        "center": scaler.center_.tolist() if cols_to_scale else [],
        "scale": scaler.scale_.tolist() if cols_to_scale else [],
        "encoded_cols_skipped": encoded_cols,
    }
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "norm_params.json", "w") as f:
        json.dump(params, f, indent=2)

    logger.info(
        f"RobustScaler fitted on {len(cols_to_scale)} columns "
        f"(skipped {len(encoded_cols)} encoded categoricals). Saved norm_params.json."
    )
    return X, scaler


def apply_scaler(X: pd.DataFrame) -> pd.DataFrame:
    """Apply saved scaler to new data (inference time). Skips encoded cols."""
    with open(ARTIFACTS_DIR / "norm_params.json") as f:
        params = json.load(f)

    cols_to_scale = params["columns"]
    if not cols_to_scale:
        return X

    scaler = RobustScaler()
    scaler.center_ = np.array(params["center"])
    scaler.scale_ = np.array(params["scale"])

    X = X.copy()
    present = [c for c in cols_to_scale if c in X.columns]
    if present:
        # Align to the exact fitted columns (handle missing cols at inference)
        subset = X[present].copy()
        # RobustScaler expects shape matching fitted; re-fit missing cols as zeros
        if len(present) < len(cols_to_scale):
            missing = [c for c in cols_to_scale if c not in X.columns]
            for mc in missing:
                subset[mc] = 0.0
            subset = subset[cols_to_scale]  # reorder to match fit order
            X[cols_to_scale] = scaler.transform(subset)
        else:
            X[present] = scaler.transform(subset[cols_to_scale] if len(present) == len(cols_to_scale) else subset)
    return X