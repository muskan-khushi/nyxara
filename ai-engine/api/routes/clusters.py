"""api/routes/clusters.py — Louvain community report."""
import logging
from pathlib import Path
from fastapi import APIRouter

router = APIRouter()
logger = logging.getLogger("nyxara.api.clusters")

ARTIFACTS_DIR = Path(__file__).parent.parent.parent / "models" / "artifacts"


def _demo_communities() -> list[dict]:
    return [
        {"community_id": "0", "size": 312, "fraud_rate": 0.78, "risk_level": "HIGH"},
        {"community_id": "1", "size": 187, "fraud_rate": 0.63, "risk_level": "HIGH"},
        {"community_id": "2", "size": 445, "fraud_rate": 0.41, "risk_level": "MEDIUM"},
        {"community_id": "3", "size": 521, "fraud_rate": 0.22, "risk_level": "MEDIUM"},
        {"community_id": "4", "size": 234, "fraud_rate": 0.09, "risk_level": "LOW"},
        {"community_id": "5", "size": 891, "fraud_rate": 0.04, "risk_level": "LOW"},
        {"community_id": "6", "size": 1102, "fraud_rate": 0.02, "risk_level": "LOW"},
        {"community_id": "7", "size": 76,  "fraud_rate": 0.92, "risk_level": "HIGH"},
    ]


@router.get("/clusters")
async def get_clusters():
    """Return Louvain community report with fraud rates per cluster."""
    try:
        from models.community.louvain import get_community_report
        communities = get_community_report()
        if communities:
            return {"clusters": communities, "total": len(communities), "source": "trained"}
    except Exception as e:
        logger.warning(f"Could not load community data: {e}")

    demo = _demo_communities()
    return {
        "clusters": demo,
        "total":    len(demo),
        "source":   "demo",
        "message":  "Demo community data — run training/run_all.py to generate real clusters.",
    }