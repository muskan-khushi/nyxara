"""api/routes/explain.py"""
from fastapi import APIRouter
from api.schemas import AccountFeatures
router = APIRouter()

@router.post("/explain")
async def explain_account(payload: AccountFeatures):
    """Return SHAP waterfall data for a scored account."""
    # Re-use score route logic but return only SHAP
    from api.routes.score import score_account
    result = await score_account(payload)
    return {
        "account_id": result.account_id,
        "shap_factors": result.shap_factors,
        "ensemble_score": result.ensemble_score,
    }