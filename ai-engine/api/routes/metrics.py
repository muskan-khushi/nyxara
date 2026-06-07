"""api/routes/metrics.py"""
import json
from pathlib import Path
from fastapi import APIRouter
from api.schemas import MetricsResponse

router = APIRouter()
ARTIFACTS_DIR = Path(__file__).parent.parent.parent / "models" / "artifacts"

@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    with open(ARTIFACTS_DIR / "eval_report.json") as f:
        report = json.load(f)
    return MetricsResponse(**report)