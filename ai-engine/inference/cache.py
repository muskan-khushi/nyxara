"""
inference/cache.py
Loads all trained models into memory at startup.
Provides O(1) logit cache for known accounts.
"""
import json
import logging
import pickle
from pathlib import Path
from typing import Any

logger = logging.getLogger("nyxara.cache")
ARTIFACTS_DIR = Path(__file__).parent.parent / "models" / "artifacts"

# Global model registry — populated by warm_cache()
_MODELS: dict[str, Any] = {"loaded": False}

# Account score cache: account_id → ScoreResponse
_SCORE_CACHE: dict[str, Any] = {}


async def warm_cache():
    """Load all model artifacts into _MODELS dict."""
    global _MODELS

    try:
        logger.info("Loading model artifacts into memory ...")

        # Ensemble models
        with open(ARTIFACTS_DIR / "xgb_model.pkl", "rb") as f:
            _MODELS["xgb"] = pickle.load(f)

        with open(ARTIFACTS_DIR / "lgbm_model.pkl", "rb") as f:
            _MODELS["lgbm"] = pickle.load(f)

        with open(ARTIFACTS_DIR / "catboost_model.pkl", "rb") as f:
            _MODELS["catboost"] = pickle.load(f)

        with open(ARTIFACTS_DIR / "meta_learner.pkl", "rb") as f:
            _MODELS["meta"] = pickle.load(f)

        # GNN
        from models.gnn.train_gnn import load_gnn
        _MODELS["gnn"] = load_gnn()

        # VAE
        from models.anomaly.vae import load_vae
        _MODELS["vae"], _MODELS["vae_threshold"] = load_vae()

        # Feature list
        with open(ARTIFACTS_DIR / "selected_features.json") as f:
            _MODELS["selected_features"] = json.load(f)["features"]

        # Model metadata
        with open(ARTIFACTS_DIR / "model_meta.json") as f:
            meta = json.load(f)
            _MODELS["version"] = meta.get("version", "1.0.0")
            _MODELS["n_features"] = meta.get("n_features", 0)

        _MODELS["loaded"] = True
        logger.info(f"✅ All models loaded. Features: {_MODELS['n_features']} | Version: {_MODELS['version']}")

    except Exception as e:
        logger.error(f"❌ Failed to load models: {e}")
        _MODELS["loaded"] = False


def get_cached_score(account_id: str) -> Any | None:
    return _SCORE_CACHE.get(account_id)


def set_cached_score(account_id: str, result: Any):
    _SCORE_CACHE[account_id] = result


def is_known_account(account_id: str) -> bool:
    return account_id in _SCORE_CACHE


def get_cache_info() -> dict:
    return {
        "loaded": _MODELS.get("loaded", False),
        "version": _MODELS.get("version", "unknown"),
        "n_features": _MODELS.get("n_features", 0),
        "cache_size": len(_SCORE_CACHE),
    }