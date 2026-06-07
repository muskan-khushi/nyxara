"""
startup.py — Called on FastAPI lifespan start.
Checks if trained models exist in artifacts/. If not, triggers training.
"""
import os
import json
import logging
from pathlib import Path

logger = logging.getLogger("nyxara.startup")

ARTIFACTS_DIR = Path(__file__).parent / "models" / "artifacts"

REQUIRED_ARTIFACTS = [
    "selected_features.json",
    "norm_params.json",
    "xgb_model.pkl",
    "lgbm_model.pkl",
    "catboost_model.pkl",
    "meta_learner.pkl",
    "gnn_model.pth",
    "vae_model.pth",
    "vae_threshold.json",
    "eval_report.json",
]


def _artifacts_exist() -> bool:
    return all((ARTIFACTS_DIR / f).exists() for f in REQUIRED_ARTIFACTS)


async def ensure_models_ready():
    """
    Check if all model artifacts are present.
    - If yes: load them into the inference cache (fast path).
    - If no: run the full training pipeline (takes 30-60 min on CPU).
    """
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    if _artifacts_exist():
        logger.info("✅ All model artifacts found — loading inference cache.")
        from inference.cache import warm_cache
        await warm_cache()
        return

    logger.warning(
        "⚠️  Model artifacts missing. Starting training pipeline. "
        "This will take 30–60 minutes on CPU. "
        "You can also run: python training/run_all.py manually."
    )

    dataset_path = os.getenv("DATASET_PATH", "../data/compressed_DataSet.xlsx")
    if not Path(dataset_path).exists():
        logger.error(
            f"❌ Dataset not found at {dataset_path}. "
            "Copy compressed_DataSet.xlsx to the data/ folder and restart."
        )
        return

    # Import here to avoid slow imports at module load time
    from training.run_all import run_full_pipeline
    run_full_pipeline(dataset_path=dataset_path)
    logger.info("✅ Training complete — warming inference cache.")
    from inference.cache import warm_cache
    await warm_cache()