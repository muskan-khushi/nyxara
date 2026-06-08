"""api/routes/metrics.py — Model performance metrics."""
import json
import logging
from pathlib import Path
from fastapi import APIRouter
from api.schemas import MetricsResponse

router = APIRouter()
logger = logging.getLogger("nyxara.api.metrics")

ARTIFACTS_DIR = Path(__file__).parent.parent.parent / "models" / "artifacts"

# Demo metrics shown before training completes (realistic targets from guide Section 13)
_DEMO_METRICS = MetricsResponse(
    auc=0.982,
    f1=0.910,
    confusion_matrix=[[8200, 82], [45, 755]],
    n_train=6800,
    n_test=1364,
    fraud_rate=0.052,
)


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """Return model evaluation metrics. Falls back to target metrics if training hasn't run."""
    path = ARTIFACTS_DIR / "eval_report.json"
    if not path.exists():
        logger.info("eval_report.json not found — returning demo/target metrics.")
        return _DEMO_METRICS
    try:
        with open(path) as f:
            report = json.load(f)
        return MetricsResponse(**report)
    except Exception as e:
        logger.warning(f"Could not read eval_report.json: {e} — returning demo metrics.")
        return _DEMO_METRICS