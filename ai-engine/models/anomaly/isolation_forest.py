"""
models/anomaly/isolation_forest.py
Extended Isolation Forest — complementary anomaly detector to VAE.
Catches different anomaly shapes (VAE = reconstruction-based, IsoForest = partitioning-based).
Their scores are averaged for a more robust zero-day anomaly signal.
"""
import json
import logging
import pickle
from pathlib import Path
import numpy as np
from sklearn.ensemble import IsolationForest

logger = logging.getLogger("nyxara.isolation_forest")
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"


def train_isolation_forest(
    X_legit: np.ndarray,
    contamination: float = 0.05,
    n_estimators: int = 200,
    random_state: int = 42,
) -> IsolationForest:
    """
    Train on legitimate accounts only (same as VAE).
    contamination = expected fraction of outliers in training data.
    """
    logger.info(f"Training Isolation Forest on {len(X_legit)} legitimate accounts ...")

    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        max_samples="auto",
        max_features=1.0,
        bootstrap=False,
        random_state=random_state,
        n_jobs=-1,
        verbose=0,
    )
    model.fit(X_legit)

    # Compute score distribution on training data
    scores = -model.score_samples(X_legit)   # Higher = more anomalous
    threshold = float(np.percentile(scores, 95))

    logger.info(f"Isolation Forest trained. Anomaly threshold (P95): {threshold:.4f}")

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "iso_forest.pkl", "wb") as f:
        pickle.dump(model, f)
    with open(ARTIFACTS_DIR / "iso_threshold.json", "w") as f:
        json.dump({"threshold": threshold, "contamination": contamination}, f)

    return model


def load_isolation_forest() -> tuple[IsolationForest, float]:
    with open(ARTIFACTS_DIR / "iso_forest.pkl", "rb") as f:
        model = pickle.load(f)
    with open(ARTIFACTS_DIR / "iso_threshold.json") as f:
        meta = json.load(f)
    return model, float(meta["threshold"])


def get_iso_anomaly_score(
    model: IsolationForest,
    threshold: float,
    X: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Returns (normalized_score [0,1], is_anomaly [bool]).
    Normalized score: raw anomaly score / threshold, clipped to [0,1].
    """
    raw_scores = -model.score_samples(X)   # Flip sign: higher = more anomalous
    normalized = np.clip(raw_scores / (threshold + 1e-9), 0, 2) / 2.0
    is_anomaly = raw_scores > threshold
    return normalized, is_anomaly


def combined_anomaly_score(
    vae_score: float,
    iso_score: float,
    vae_weight: float = 0.6,
    iso_weight: float = 0.4,
) -> float:
    """Weighted average of VAE + IsoForest anomaly scores."""
    return float(np.clip(vae_weight * vae_score + iso_weight * iso_score, 0.0, 1.0))