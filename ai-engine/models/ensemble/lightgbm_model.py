"""
models/ensemble/lightgbm_model.py
LightGBM — fastest training; best native categorical support.
"""
import logging
import pickle
from pathlib import Path
import pandas as pd
from sklearn.metrics import roc_auc_score
import lightgbm as lgb

logger = logging.getLogger("nyxara.lightgbm")
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"

def train_lightgbm(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    scale_pos_weight: float = 10.0,
    n_estimators: int = 500,
) -> lgb.LGBMClassifier:

    model = lgb.LGBMClassifier(
        n_estimators=n_estimators,
        max_depth=6,
        learning_rate=0.05,
        num_leaves=63,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_samples=20,
        reg_alpha=0.1,
        reg_lambda=1.0,
        class_weight={0: 1.0, 1: scale_pos_weight},
        random_state=42,
        verbose=-1,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        eval_metric="auc",
        callbacks=[lgb.early_stopping(30), lgb.log_evaluation(50)],
    )

    val_auc = roc_auc_score(y_val, model.predict_proba(X_val)[:, 1])
    logger.info(f"LightGBM validation AUC: {val_auc:.4f}")

    with open(ARTIFACTS_DIR / "lgbm_model.pkl", "wb") as f:
        pickle.dump(model, f)

    return model


def load_lightgbm() -> lgb.LGBMClassifier:
    with open(ARTIFACTS_DIR / "lgbm_model.pkl", "rb") as f:
        return pickle.load(f)