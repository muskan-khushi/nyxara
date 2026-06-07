"""
models/ensemble/catboost_model.py
CatBoost — most robust on small datasets; handles sparse data well.
"""
import logging
import pickle
from pathlib import Path
import pandas as pd
from sklearn.metrics import roc_auc_score
from catboost import CatBoostClassifier, Pool

logger = logging.getLogger("nyxara.catboost")
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"

CATEGORICAL_COLS = ["F3891", "F3889"]


def train_catboost(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    scale_pos_weight: float = 10.0,
) -> CatBoostClassifier:

    cat_features = [c for c in CATEGORICAL_COLS if c in X_train.columns]
    cat_idx = [X_train.columns.tolist().index(c) for c in cat_features]

    # CatBoost needs string categoricals
    X_tr = X_train.copy()
    X_v = X_val.copy()
    for c in cat_features:
        X_tr[c] = X_tr[c].astype(str)
        X_v[c] = X_v[c].astype(str)

    train_pool = Pool(X_tr, y_train, cat_features=cat_idx if cat_idx else None)
    val_pool = Pool(X_v, y_val, cat_features=cat_idx if cat_idx else None)

    model = CatBoostClassifier(
        iterations=500,
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

    val_auc = roc_auc_score(y_val, model.predict_proba(X_v)[:, 1])
    logger.info(f"CatBoost validation AUC: {val_auc:.4f}")

    with open(ARTIFACTS_DIR / "catboost_model.pkl", "wb") as f:
        pickle.dump(model, f)

    return model


def load_catboost() -> CatBoostClassifier:
    with open(ARTIFACTS_DIR / "catboost_model.pkl", "rb") as f:
        return pickle.load(f)