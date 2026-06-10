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
    Fit LabelEncoders on ALL object/string columns.
    Returns encoded DataFrame and encoder mapping dict.
    """
    encoders = {}
    X = X.copy()

    # Encode all object columns, not just the two hardcoded ones
    all_cat_cols = X.select_dtypes(include=["object"]).columns.tolist()

    for col in all_cat_cols:
        le = LabelEncoder()
        X[col] = X[col].fillna("UNKNOWN").astype(str)
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
        # Unseen categories (like 'Savings' if not in training) map to -1
        X[col] = X[col].astype(str).map(class_map).fillna(-1).astype(int)

    # Also encode any remaining object columns not in saved encoders
    remaining_obj = X.select_dtypes(include=["object"]).columns.tolist()
    for col in remaining_obj:
        logger.warning(f"Column {col} has object dtype at inference but no saved encoder — label encoding on the fly")
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str).fillna("UNKNOWN"))

    return X