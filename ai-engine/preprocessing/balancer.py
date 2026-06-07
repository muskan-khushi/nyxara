"""
preprocessing/balancer.py
Handle severe class imbalance (2-8% fraud rate).
Strategy selected automatically based on fraud rate.
"""
import logging
import numpy as np
import pandas as pd
from imblearn.combine import SMOTETomek
from imblearn.over_sampling import SMOTE, ADASYN

logger = logging.getLogger("nyxara.balancer")


def balance_dataset(
    X: pd.DataFrame,
    y: pd.Series,
    strategy: str = "auto",
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.Series]:
    """
    Balance dataset using SMOTE variants.

    Args:
        strategy: "auto" (choose based on fraud rate), "smote", "smotetomek", "adasyn"

    Returns:
        X_balanced, y_balanced
    """
    fraud_rate = y.mean()
    logger.info(f"Balancing dataset. Fraud rate: {fraud_rate:.4f} | Strategy: {strategy}")

    if strategy == "auto":
        if fraud_rate < 0.01:
            strategy = "adasyn"
        elif fraud_rate < 0.05:
            strategy = "smotetomek"
        else:
            strategy = "smote"

    logger.info(f"Selected balancing strategy: {strategy}")

    if strategy == "adasyn":
        sampler = ADASYN(sampling_strategy=0.3, random_state=random_state, n_neighbors=5)
    elif strategy == "smotetomek":
        sampler = SMOTETomek(random_state=random_state)
    else:
        sampler = SMOTE(sampling_strategy=0.5, random_state=random_state, k_neighbors=5)

    X_bal, y_bal = sampler.fit_resample(X, y)

    X_bal = pd.DataFrame(X_bal, columns=X.columns)
    y_bal = pd.Series(y_bal, name=y.name)

    logger.info(
        f"After balancing: {len(X_bal):,} samples | "
        f"Fraud: {y_bal.sum():,} ({y_bal.mean()*100:.1f}%)"
    )
    return X_bal, y_bal


def compute_class_weights(y: pd.Series) -> dict:
    """
    Compute class weights for models that support it (XGBoost scale_pos_weight).
    Returns dict: {0: weight_0, 1: weight_1}
    """
    n_neg = (y == 0).sum()
    n_pos = (y == 1).sum()
    scale_pos_weight = n_neg / max(n_pos, 1)
    logger.info(f"scale_pos_weight: {scale_pos_weight:.2f}")
    return {"scale_pos_weight": scale_pos_weight, "n_neg": int(n_neg), "n_pos": int(n_pos)}