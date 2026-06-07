"""api/routes/health.py"""
from fastapi import APIRouter
from api.schemas import HealthResponse
from inference.cache import get_cache_info

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health():
    info = get_cache_info()
    return HealthResponse(
        status="ok",
        models_loaded=info["loaded"],
        model_version=info.get("version", "1.0.0"),
        n_features=info.get("n_features", 0),
        cache_size=info.get("cache_size", 0),
    )