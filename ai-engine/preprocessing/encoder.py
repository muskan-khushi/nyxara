"""
preprocessing/encoder.py
Encode categorical features for ML models.
"""
import json
import logging
from pathlib import Path
import pandas as pd
from sklearn.preprocessing import LabelEncoder

logger = logging.getLogger("nyxara.encoder")
ARTIFACTS_DIR = Path(__file__).parent.parent / "models" / "artifacts"

CATEGORICAL_COLS = ["F3891", "F3889"]


def fit_encoders(X: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Fit LabelEncoders on categorical columns.
    Returns encoded DataFrame and encoder mapping dict.
    """
    encoders = {}
    X = X.copy()

    for col in CATEGORICAL_COLS:
        if col not in X.columns:
            continue
        le = LabelEncoder()
        X[col] = X[col].astype(str).fillna("UNKNOWN")
        X[col] = le.fit_transform(X[col])
        encoders[col] = {
            "classes": le.classes_.tolist(),
        }
        logger.info(f"Encoded {col}: {len(le.classes_)} categories")

    # Save encoder mapping
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "encoders.json", "w") as f:
        json.dump(encoders, f, indent=2)

    return X, encoders


def apply_encoders(X: pd.DataFrame) -> pd.DataFrame:
    """Apply saved encoders to new data (inference time)."""
    with open(ARTIFACTS_DIR / "encoders.json") as f:
        encoders = json.load(f)

    X = X.copy()
    for col, meta in encoders.items():
        if col not in X.columns:
            continue
        classes = meta["classes"]
        class_map = {c: i for i, c in enumerate(classes)}
        X[col] = X[col].astype(str).map(class_map).fillna(-1).astype(int)

    return X