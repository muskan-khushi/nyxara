"""
models/ensemble/xgboost_model.py
XGBoost classifier — Layer 3, Base Model 1.
Fastest SHAP computation; proven SOTA on tabular financial data.
"""
import json
import logging
import pickle
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score
import xgboost as xgb
import shap

logger = logging.getLogger("nyxara.xgboost")
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"


def train_xgboost(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    scale_pos_weight: float = 10.0,
    n_estimators: int = 500,
) -> xgb.XGBClassifier:
    """
    Train XGBoost with early stopping.
    Returns fitted model.
    """
    model = xgb.XGBClassifier(
        n_estimators=n_estimators,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        gamma=1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        scale_pos_weight=scale_pos_weight,
        tree_method="hist",          # CPU-optimized
        eval_metric=["auc", "logloss"],
        random_state=42,
        verbosity=1,
        early_stopping_rounds=30,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=50,
    )

    val_auc = roc_auc_score(y_val, model.predict_proba(X_val)[:, 1])
    logger.info(f"XGBoost validation AUC: {val_auc:.4f} | Best iteration: {model.best_iteration}")

    # Save model
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "xgb_model.pkl", "wb") as f:
        pickle.dump(model, f)

    return model


def load_xgboost() -> xgb.XGBClassifier:
    with open(ARTIFACTS_DIR / "xgb_model.pkl", "rb") as f:
        return pickle.load(f)


def compute_shap_values(model: xgb.XGBClassifier, X: pd.DataFrame) -> dict:
    """
    Compute SHAP values for a batch of accounts.
    Returns dict with shap_values array and feature names.
    """
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)
    return {
        "shap_values": shap_values,
        "expected_value": float(explainer.expected_value),
        "feature_names": X.columns.tolist(),
    }


def top_shap_factors(model: xgb.XGBClassifier, X_row: pd.DataFrame, top_n: int = 10) -> list[dict]:
    """
    Get top N SHAP factors for a single account row.
    Returns list of {feature, shap_value, raw_value, direction}.
    """
    explainer = shap.TreeExplainer(model)
    shap_vals = explainer.shap_values(X_row)[0]  # Single row

    factors = []
    for i, (fname, sval) in enumerate(zip(X_row.columns, shap_vals)):
        factors.append({
            "feature": fname,
            "shap_value": float(sval),
            "raw_value": float(X_row.iloc[0, i]),
            "direction": "fraud_risk" if sval > 0 else "safe_signal",
        })

    factors.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
    return factors[:top_n]