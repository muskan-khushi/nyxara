"""api/routes/batch.py"""
import asyncio
from fastapi import APIRouter
from api.schemas import BatchScoreRequest
from api.routes.score import score_account

router = APIRouter()

@router.post("/batch")
async def batch_score(payload: BatchScoreRequest):
    """Score up to 100 accounts in parallel."""
    tasks = [score_account(acct) for acct in payload.accounts]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return {
        "results": [r.model_dump() if not isinstance(r, Exception) else {"error": str(r)} for r in results],
        "total": len(results),
    }