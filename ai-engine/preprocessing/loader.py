"""
preprocessing/loader.py
Load the hackathon dataset efficiently.
9,082 rows × 3,924 features — fits comfortably in RAM if we optimize dtypes.
"""
import logging
from pathlib import Path
import pandas as pd
import numpy as np

logger = logging.getLogger("nyxara.loader")

# The target column (F3924): 0 = legitimate, 1 = suspicious/mule
TARGET_COL = "F3924"

# Bank-identified key features — always kept regardless of MI score
BANK_KEY_FEATURES = [
    "F115", "F321", "F527", "F531", "F670", "F1692",
    "F2082", "F2122", "F2582", "F2678", "F2737", "F2956",
    "F3043", "F3836", "F3887", "F3889", "F3891", "F3894",
]

# String/categorical columns identified in dataset analysis
CATEGORICAL_COLS = ["F3889", "F3891"]
DATETIME_COLS = []  # Add datetime column name if found during EDA


def load_dataset(path: str | Path, nrows: int | None = None) -> tuple[pd.DataFrame, pd.Series]:
    """
    Load XLSX dataset. Returns (X_features, y_target).

    Args:
        path: Path to dataset.xlsx
        nrows: If set, load only first N rows (useful for quick EDA)

    Returns:
        X: DataFrame of all feature columns
        y: Series of target labels (0/1)
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    logger.info(f"Loading dataset from {path} ...")

    df = pd.read_excel(
        path,
        engine="openpyxl",
        nrows=nrows,
    )

    # Drop pandas auto-index column if present
    if "Unnamed: 0" in df.columns:
        df.drop(columns=["Unnamed: 0"], inplace=True)

    logger.info(f"Raw shape: {df.shape}")

    # Ensure target column exists
    if TARGET_COL not in df.columns:
        raise ValueError(
            f"Target column '{TARGET_COL}' not found. "
            f"Available columns (last 5): {list(df.columns[-5:])}"
        )

    # Separate features and target
    y = df[TARGET_COL].astype(int)
    X = df.drop(columns=[TARGET_COL])

    # Memory optimization
    X = memory_optimize(X)

    logger.info(f"Features shape: {X.shape} | Target distribution:\n{y.value_counts()}")
    return X, y


def memory_optimize(df: pd.DataFrame) -> pd.DataFrame:
    """
    Downcast numeric types to save ~50% RAM.
    float64 → float32, int64 → int32 where safe.
    Categorical columns are left as object for now (encoded later).
    """
    before_mb = df.memory_usage(deep=True).sum() / 1e6

    for col in df.select_dtypes(include=["float64"]).columns:
        df[col] = df[col].astype("float32")

    for col in df.select_dtypes(include=["int64"]).columns:
        df[col] = df[col].astype("int32")

    after_mb = df.memory_usage(deep=True).sum() / 1e6
    logger.info(f"Memory: {before_mb:.1f}MB → {after_mb:.1f}MB (saved {before_mb - after_mb:.1f}MB)")
    return df


def check_imbalance(y: pd.Series) -> float:
    """
    Print class distribution and recommend sampling strategy.
    Returns fraud rate (float).
    """
    counts = y.value_counts()
    fraud_rate = counts.get(1, 0) / len(y)

    logger.info(
        f"\n{'='*40}\n"
        f"Class distribution:\n"
        f"  Legitimate (0): {counts.get(0, 0):,} ({(1 - fraud_rate) * 100:.1f}%)\n"
        f"  Suspicious  (1): {counts.get(1, 0):,} ({fraud_rate * 100:.1f}%)\n"
        f"  Fraud rate: {fraud_rate:.4f}\n"
        f"{'='*40}"
    )

    if fraud_rate < 0.01:
        logger.warning("Extreme imbalance (<1%) — use ADASYN or weighted loss.")
    elif fraud_rate < 0.05:
        logger.warning("Severe imbalance (<5%) — use SMOTETomek.")
    else:
        logger.info("Moderate imbalance — SMOTE sufficient.")

    return fraud_rate


def quick_eda(X: pd.DataFrame, y: pd.Series) -> dict:
    """
    Run basic EDA. Returns summary dict for logging/display.
    """
    numeric = X.select_dtypes(include=[np.number])
    categorical = X.select_dtypes(include=["object"])

    missing_pct = (X.isnull().sum() / len(X) * 100).sort_values(ascending=False)
    high_missing = missing_pct[missing_pct > 40]

    summary = {
        "n_rows": len(X),
        "n_features": len(X.columns),
        "n_numeric": len(numeric.columns),
        "n_categorical": len(categorical.columns),
        "fraud_rate": float(y.mean()),
        "high_missing_features": len(high_missing),
        "top_missing": high_missing.head(5).to_dict(),
        "f3836_range": [float(X["F3836"].min()), float(X["F3836"].max())] if "F3836" in X else None,
        "f3887_range": [float(X["F3887"].min()), float(X["F3887"].max())] if "F3887" in X else None,
        "f3043_missing_pct": float(X["F3043"].isnull().mean() * 100) if "F3043" in X else None,
        "f3891_categories": X["F3891"].unique().tolist() if "F3891" in X else None,
    }

    logger.info(f"EDA Summary: {summary}")
    return summary