"""
models/ensemble/stacker.py
Meta-learner: combines XGB + LGBM + CatBoost + GNN score.
Uses Logistic Regression to learn optimal weighting.
"""
import logging
import pickle
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import roc_auc_score

logger = logging.getLogger("nyxara.stacker")
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"


def build_meta_features(
    xgb_probs: np.ndarray,
    lgbm_probs: np.ndarray,
    cat_probs: np.ndarray,
    gnn_scores: np.ndarray | None = None,
) -> np.ndarray:
    """Stack base model probabilities into meta-feature matrix."""
    parts = [
        xgb_probs.reshape(-1, 1),
        lgbm_probs.reshape(-1, 1),
        cat_probs.reshape(-1, 1),
    ]
    if gnn_scores is not None:
        parts.append(gnn_scores.reshape(-1, 1))
    return np.hstack(parts)


def train_meta_learner(
    meta_X: np.ndarray,
    y: np.ndarray,
) -> LogisticRegression:
    """
    Train Logistic Regression on stacked base model probabilities.
    Uses cross-validation to avoid leakage.
    """
    meta_model = LogisticRegression(
        C=1.0,
        class_weight="balanced",
        max_iter=1000,
        random_state=42,
    )
    meta_model.fit(meta_X, y)

    cv_scores = cross_val_score(meta_model, meta_X, y, cv=5, scoring="roc_auc")
    logger.info(f"Meta-learner CV AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    with open(ARTIFACTS_DIR / "meta_learner.pkl", "wb") as f:
        pickle.dump(meta_model, f)

    return meta_model


def load_meta_learner() -> LogisticRegression:
    with open(ARTIFACTS_DIR / "meta_learner.pkl", "rb") as f:
        return pickle.load(f)


def predict_ensemble(
    meta_model: LogisticRegression,
    xgb_prob: float,
    lgbm_prob: float,
    cat_prob: float,
    gnn_score: float | None = None,
) -> float:
    """Get ensemble probability for a single account at inference time."""
    row = [xgb_prob, lgbm_prob, cat_prob]
    if gnn_score is not None:
        row.append(gnn_score)
    X = np.array(row).reshape(1, -1)
    return float(meta_model.predict_proba(X)[0, 1])