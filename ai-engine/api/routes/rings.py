"""api/routes/rings.py"""
from fastapi import APIRouter
router = APIRouter()

@router.get("/rings")
async def get_rings():
    """Return pre-cached ring structures detected in the account graph."""
    # TODO: Query MongoDB rings collection populated by ring_detector.py
    return {"rings": [], "message": "Ring cache not yet populated — run training/run_all.py"}