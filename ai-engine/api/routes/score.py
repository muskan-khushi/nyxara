"""api/routes/score.py — POST /v1/score

FIXES:
1. Preprocessing order at inference must mirror training:
   composite_features → encode → scale (not encode → scale → composite).
2. Feature alignment now uses the saved selected_features list, adding 0.0
   for any columns that appear in training but not in the inference request.
3. GNN score default uses ensemble mean only when the account is not in cache;
   makes the result sensible for new/unseen accounts.
4. Removed bare `except Exception` swallowing the real error; re-raises with
   proper HTTP 500 so the caller can see what went wrong.
"""
import logging
import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from api.schemas import AccountFeatures, ScoreResponse
from inference.cache import get_cached_score, set_cached_score
from inference.scorer import fuse_scores
from inference.alert_narrator import generate_alert
from models.ensemble.xgboost_model import top_shap_factors

router = APIRouter()
logger = logging.getLogger("nyxara.api.score")


@router.post("/score", response_model=ScoreResponse)
async def score_account(payload: AccountFeatures):
    """Full account risk analysis."""
    account_id = payload.account_id

    # O(1) cache hit for known accounts (only when no extra features supplied)
    cached = get_cached_score(account_id)
    if cached and not (payload.model_fields_set - {"account_id", "bei_risk_score"}):
        return cached

    from inference.cache import _MODELS as M
    if not M.get("loaded"):
        raise HTTPException(status_code=503, detail="Models not yet loaded. Try again shortly.")

    try:
        # ── Build one-row DataFrame from payload ──────────────
        features_dict = payload.model_dump(exclude={"account_id", "bei_risk_score"})
        X_row = pd.DataFrame([features_dict])

        # ── Preprocessing: SAME ORDER as training ─────────────
        # 1. Composite features (needs raw numeric + string occupation)
        from preprocessing.composite_features import add_composite_features
        X_row = add_composite_features(X_row)

        # 2. Encode categoricals → int
        from preprocessing.encoder import apply_encoders
        X_row = apply_encoders(X_row)

        # 3. Scale numerics (skips encoded cols automatically)
        from preprocessing.scaler import apply_scaler
        X_row = apply_scaler(X_row)

        # ── Align to training feature set ─────────────────────
        selected_features = M["selected_features"]
        for col in selected_features:
            if col not in X_row.columns:
                X_row[col] = 0.0
        # Drop any extra columns not seen at training time
        X_row = X_row[[c for c in selected_features if c in X_row.columns]]
        # Add back any still-missing ones as 0
        for col in selected_features:
            if col not in X_row.columns:
                X_row[col] = 0.0
        X_row = X_row[selected_features]

        # ── Ensemble scores ───────────────────────────────────
        xgb_prob  = float(M["xgb"].predict_proba(X_row)[:, 1][0])
        lgbm_prob = float(M["lgbm"].predict_proba(X_row)[:, 1][0])
        cat_prob  = float(M["catboost"].predict_proba(X_row)[:, 1][0])

        # ── GNN score fallback for unknown accounts ───────────
        gnn_score = float(cached.gnn_score) if cached else float(
            np.mean([xgb_prob, lgbm_prob, cat_prob])
        )

        # ── Meta-learner ──────────────────────────────────────
        from models.ensemble.stacker import build_meta_features
        meta_X = build_meta_features(
            np.array([xgb_prob]),
            np.array([lgbm_prob]),
            np.array([cat_prob]),
            np.array([gnn_score]),
        )
        ensemble_score = float(M["meta"].predict_proba(meta_X)[0, 1])

        # ── VAE anomaly score ─────────────────────────────────
        from models.anomaly.vae import get_vae_anomaly_score
        X_numeric = X_row.select_dtypes(include=[np.number]).values.astype(np.float32)
        vae_scores, _ = get_vae_anomaly_score(M["vae"], M["vae_threshold"], X_numeric)
        vae_score = float(vae_scores[0])

        # ── SHAP ──────────────────────────────────────────────
        shap_factors = top_shap_factors(M["xgb"], X_row)

        occupation = str(payload.F3891 or "unknown")

        # ── Risk fusion ───────────────────────────────────────
        result = fuse_scores(
            account_id=account_id,
            gnn_score=gnn_score,
            ensemble_score=ensemble_score,
            vae_score=vae_score,
            bei_score=payload.bei_risk_score or 0.0,
        )

        # ── LLM / rule-based alert ────────────────────────────
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

        set_cached_score(account_id, response)
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scoring failed for {account_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))