"""
models/ensemble/catboost_model.py
CatBoost — most robust on small datasets; handles sparse data well.

FIXES:
1. cat_features is completely removed from Pool construction.
   By the time data reaches CatBoost, F3891/F3889 are already label-encoded
   integers AND then RobustScaler-normalised (float). Passing them as
   cat_features expects raw string values — this was crashing training.
2. Pool construction no longer passes cat_features at all.
"""
import logging
import pickle
from pathlib import Path
import pandas as pd
from sklearn.metrics import roc_auc_score
from catboost import CatBoostClassifier, Pool

logger = logging.getLogger("nyxara.catboost")
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"


def train_catboost(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    scale_pos_weight: float = 10.0,
    iterations: int = 500,
) -> CatBoostClassifier:
    """
    Train CatBoost classifier.

    NOTE: All categorical columns (F3891, F3889) have been label-encoded to
    integers and then passed through RobustScaler, so they are plain float
    features at this point.  Do NOT pass cat_features — CatBoost would expect
    raw string categories, not scaled floats.
    """
    # Pool without cat_features — all columns are numeric at this stage
    train_pool = Pool(X_train, y_train)
    val_pool   = Pool(X_val,   y_val)

    model = CatBoostClassifier(
        iterations=iterations,
        depth=6,
        learning_rate=0.05,
        l2_leaf_reg=3,
        scale_pos_weight=scale_pos_weight,
        eval_metric="AUC",
        random_seed=42,
        verbose=50,
        early_stopping_rounds=30,
        task_type="CPU",
    )

    model.fit(train_pool, eval_set=val_pool, use_best_model=True)

    val_auc = roc_auc_score(y_val, model.predict_proba(X_val)[:, 1])
    logger.info(f"CatBoost validation AUC: {val_auc:.4f}")

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "catboost_model.pkl", "wb") as f:
        pickle.dump(model, f)

    return model


def load_catboost() -> CatBoostClassifier:
    with open(ARTIFACTS_DIR / "catboost_model.pkl", "rb") as f:
        return pickle.load(f)