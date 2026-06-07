"""
preprocessing/scaler.py
RobustScaler — outlier-resistant normalization for financial data.
"""
import json
import logging
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.preprocessing import RobustScaler

logger = logging.getLogger("nyxara.scaler")
ARTIFACTS_DIR = Path(__file__).parent.parent / "models" / "artifacts"


def fit_scaler(X: pd.DataFrame) -> tuple[pd.DataFrame, RobustScaler]:
    """Fit RobustScaler on training data. Saves norm_params.json."""
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()

    scaler = RobustScaler()
    X = X.copy()
    X[numeric_cols] = scaler.fit_transform(X[numeric_cols])

    # Save params for inference
    params = {
        "columns": numeric_cols,
        "center": scaler.center_.tolist(),
        "scale": scaler.scale_.tolist(),
    }
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "norm_params.json", "w") as f:
        json.dump(params, f, indent=2)

    logger.info(f"RobustScaler fitted on {len(numeric_cols)} columns. Saved norm_params.json.")
    return X, scaler


def apply_scaler(X: pd.DataFrame) -> pd.DataFrame:
    """Apply saved scaler to new data (inference time)."""
    with open(ARTIFACTS_DIR / "norm_params.json") as f:
        params = json.load(f)

    scaler = RobustScaler()
    scaler.center_ = np.array(params["center"])
    scaler.scale_ = np.array(params["scale"])

    X = X.copy()
    cols = [c for c in params["columns"] if c in X.columns]
    X[cols] = scaler.transform(X[cols])
    return X