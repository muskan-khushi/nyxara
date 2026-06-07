"""api/routes/score.py — POST /v1/score"""
import logging
import pandas as pd
from fastapi import APIRouter, HTTPException
from api.schemas import AccountFeatures, ScoreResponse
from inference.cache import get_cached_score, is_known_account
from inference.scorer import fuse_scores
from inference.alert_narrator import generate_alert
from models.ensemble.xgboost_model import top_shap_factors

router = APIRouter()
logger = logging.getLogger("nyxara.api.score")


@router.post("/score", response_model=ScoreResponse)
async def score_account(payload: AccountFeatures):
    """
    Full account risk analysis.
    Returns all layer scores, SHAP factors, and LLM alert.
    """
    account_id = payload.account_id

    # Check O(1) cache first
    cached = get_cached_score(account_id)
    if cached and not payload.model_fields_set - {"account_id", "bei_risk_score"}:
        return cached

    try:
        # Convert payload to DataFrame (one row)
        features_dict = payload.model_dump(exclude={"account_id", "bei_risk_score"})
        X_row = pd.DataFrame([features_dict])

        # Import live models from cache module
        from inference.cache import _MODELS as M
        if not M.get("loaded"):
            raise HTTPException(status_code=503, detail="Models not yet loaded. Try again in a moment.")

        # Preprocess
        from preprocessing.encoder import apply_encoders
        from preprocessing.scaler import apply_scaler
        from preprocessing.composite_features import add_composite_features

        X_row = add_composite_features(X_row)
        X_row = apply_encoders(X_row)
        X_row = apply_scaler(X_row)

        # Align to training feature set
        selected_features = M["selected_features"]
        for col in selected_features:
            if col not in X_row.columns:
                X_row[col] = 0.0
        X_row = X_row[selected_features]

        # Ensemble scores
        xgb_prob  = float(M["xgb"].predict_proba(X_row)[:, 1][0])
        lgbm_prob = float(M["lgbm"].predict_proba(X_row)[:, 1][0])
        cat_prob  = float(M["catboost"].predict_proba(X_row)[:, 1][0])

        # GNN score (use pre-computed if known account, else use ensemble mean)
        import numpy as np
        from models.ensemble.stacker import build_meta_features
        gnn_score = float(cached.gnn_score) if cached else float(np.mean([xgb_prob, lgbm_prob, cat_prob]))

        # Meta-learner
        meta_X = build_meta_features(
            np.array([xgb_prob]), np.array([lgbm_prob]),
            np.array([cat_prob]), np.array([gnn_score])
        )
        ensemble_score = float(M["meta"].predict_proba(meta_X)[0, 1])

        # VAE anomaly
        from models.anomaly.vae import get_vae_anomaly_score
        X_numeric = X_row.select_dtypes(include=[np.number]).values.astype(np.float32)
        vae_scores, _ = get_vae_anomaly_score(M["vae"], M["vae_threshold"], X_numeric)
        vae_score = float(vae_scores[0])

        # SHAP
        shap_factors = top_shap_factors(M["xgb"], X_row)

        # Occupation for alert
        occupation = str(payload.F3891 or "unknown")

        # Risk fusion
        result = fuse_scores(
            account_id=account_id,
            gnn_score=gnn_score,
            ensemble_score=ensemble_score,
            vae_score=vae_score,
            bei_score=payload.bei_risk_score or 0.0,
        )

        # Generate alert text
        alert_text = await generate_alert(
            account_id=account_id,
            decision=result.decision,
            final_risk=result.final_risk,
            occupation=occupation,
            top_factors=shap_factors,
            ring_membership=result.ring_membership,
        )

        response = ScoreResponse(
            account_id=account_id,
            final_risk=result.final_risk,
            decision=result.decision,
            gnn_score=result.gnn_score,
            ensemble_score=result.ensemble_score,
            vae_score=result.vae_score,
            bei_score=result.bei_score,
            graph_score=result.graph_score,
            ring_membership=result.ring_membership,
            community_fraud_rate=result.community_fraud_rate,
            shap_factors=shap_factors,
            alert_text=alert_text,
            override_applied=result.override_applied,
        )

        return response

    except Exception as e:
        logger.error(f"Scoring failed for {account_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))