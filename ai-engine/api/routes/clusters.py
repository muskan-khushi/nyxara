"""api/routes/clusters.py"""
from fastapi import APIRouter
router = APIRouter()

@router.get("/clusters")
async def get_clusters():
    """Return Louvain community report with fraud rates per cluster."""
    return {"clusters": [], "message": "Run training/run_all.py to populate community data"}