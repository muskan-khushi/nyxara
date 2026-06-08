"""api/routes/rings.py — Return pre-cached ring structures."""
import json
import logging
from pathlib import Path
from fastapi import APIRouter

router = APIRouter()
logger = logging.getLogger("nyxara.api.rings")

ARTIFACTS_DIR = Path(__file__).parent.parent.parent / "models" / "artifacts"


def _load_rings_from_cache() -> list[dict]:
    """Load rings from JSON artifact (populated by ring_detector.py at training time)."""
    path = ARTIFACTS_DIR / "rings_cache.json"
    if path.exists():
        with open(path) as f:
            return json.load(f).get("rings", [])
    return []


def _demo_rings() -> list[dict]:
    """Return plausible demo rings for hackathon demo when training hasn't run yet."""
    return [
        {
            "ring_id":    "STAR_ACC-7832",
            "shape":      "STAR",
            "accounts":   ["ACC-7832", "ACC-1021", "ACC-4455", "ACC-8871", "ACC-3302", "ACC-6614"],
            "roles":      {
                "ACC-7832": "hub",
                "ACC-1021": "mule",
                "ACC-4455": "mule",
                "ACC-8871": "mule",
                "ACC-3302": "mule",
                "ACC-6614": "mule",
            },
            "hub_node":   "ACC-7832",
            "fraud_rate": 0.83,
            "confidence": 0.91,
            "size":       6,
        },
        {
            "ring_id":    "CYCLE_ACC-2201_ACC-5543_ACC-9910",
            "shape":      "CYCLE",
            "accounts":   ["ACC-2201", "ACC-5543", "ACC-9910", "ACC-1187"],
            "roles":      {
                "ACC-2201": "cycler",
                "ACC-5543": "cycler",
                "ACC-9910": "cycler",
                "ACC-1187": "cycler",
            },
            "hub_node":   None,
            "fraud_rate": 1.0,
            "confidence": 0.97,
            "size":       4,
        },
        {
            "ring_id":    "CHAIN_ACC-0031_ACC-8892",
            "shape":      "CHAIN",
            "accounts":   ["ACC-0031", "ACC-4423", "ACC-7756", "ACC-8892"],
            "roles":      {
                "ACC-0031": "source",
                "ACC-4423": "relay",
                "ACC-7756": "relay",
                "ACC-8892": "terminus",
            },
            "hub_node":   None,
            "fraud_rate": 0.75,
            "confidence": 0.82,
            "size":       4,
        },
        {
            "ring_id":    "CLUSTER_ACC-6601",
            "shape":      "CLUSTER",
            "accounts":   ["ACC-6601", "ACC-2219", "ACC-3387", "ACC-5541", "ACC-7723"],
            "roles":      {
                "ACC-6601": "coordinator",
                "ACC-2219": "member",
                "ACC-3387": "member",
                "ACC-5541": "member",
                "ACC-7723": "member",
            },
            "hub_node":   "ACC-6601",
            "fraud_rate": 0.60,
            "confidence": 0.74,
            "size":       5,
        },
    ]


@router.get("/rings")
async def get_rings():
    """Return pre-cached ring structures detected in the account graph."""
    rings = _load_rings_from_cache()
    source = "trained"

    if not rings:
        rings = _demo_rings()
        source = "demo"
        logger.info("Serving demo ring data — run training/run_all.py to populate real rings.")

    return {
        "rings":  rings,
        "total":  len(rings),
        "source": source,
        "message": (
            "Live ring data from trained model."
            if source == "trained"
            else "Demo ring data — run training/run_all.py to generate real rings from your dataset."
        ),
    }