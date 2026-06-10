"""
preprocessing/encoder.py
Encode categorical features for ML models.

FIXES:
- Encoded columns are cast to int32 (not float) so CatBoost cat_features work.
- apply_encoders also ensures int dtype is preserved post-encoding.
- Unseen category fallback is -1 (int), not NaN (float).
"""
import json
import logging
from pathlib import Path
import pandas as pd
from sklearn.preprocessing import LabelEncoder

logger = logging.getLogger("nyxara.encoder")
ARTIFACTS_DIR = Path(__file__).parent.parent / "models" / "artifacts"


def fit_encoders(X: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Fit LabelEncoders on ALL object/string columns.
    Returns encoded DataFrame and encoder mapping dict.
    Encoded columns are stored as int32 — required for CatBoost cat_features.
    """
    encoders = {}
    X = X.copy()

    all_cat_cols = X.select_dtypes(include=["object"]).columns.tolist()

    for col in all_cat_cols:
        le = LabelEncoder()
        X[col] = X[col].fillna("UNKNOWN").astype(str)
        X[col] = le.fit_transform(X[col]).astype("int32")   # FIX: keep as int
        encoders[col] = {
            "classes": le.classes_.tolist(),
        }
        logger.info(f"Encoded {col}: {len(le.classes_)} categories → int32")

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "encoders.json", "w") as f:
        json.dump(encoders, f, indent=2)

    return X, encoders


def apply_encoders(X: pd.DataFrame) -> pd.DataFrame:
    """
    Apply saved encoders to new data (inference time).
    Preserves int dtype so downstream scalers don't clobber cat_features.
    """
    with open(ARTIFACTS_DIR / "encoders.json") as f:
        encoders = json.load(f)

    X = X.copy()
    for col, meta in encoders.items():
        if col not in X.columns:
            # Column absent at inference — add as -1 (unknown) integer column
            X[col] = -1
            X[col] = X[col].astype("int32")
            continue
        classes = meta["classes"]
        class_map = {c: i for i, c in enumerate(classes)}
        X[col] = (
            X[col]
            .astype(str)
            .map(class_map)
            .fillna(-1)           # unseen category → -1
            .astype("int32")      # FIX: must stay integer
        )

    # Encode any remaining object columns with no saved encoder (on-the-fly)
    remaining_obj = X.select_dtypes(include=["object"]).columns.tolist()
    for col in remaining_obj:
        logger.warning(
            f"Column {col} has object dtype at inference but no saved encoder — "
            "label encoding on the fly"
        )
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str).fillna("UNKNOWN")).astype("int32")

    return X