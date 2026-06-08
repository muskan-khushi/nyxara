"""
inference/scorer.py
Orchestrates: GNN + Ensemble + VAE + BEI → finalRisk fusion.
Implements the weighted formula from the Nyxara guide (Section 07).

finalRisk = 0.35×gnn + 0.25×ensemble + 0.20×vae + 0.12×bei + 0.08×graph_features
Decision thresholds: <0.40 APPROVE · 0.40-0.70 REVIEW · 0.70-0.85 FLAG · ≥0.85 BLOCK
Override rule: ring_membership AND community_fraud_rate > 0.60 → force minimum REVIEW
"""
import logging
import os
from dataclasses import dataclass, field

logger = logging.getLogger("nyxara.scorer")

# ── Configurable weights (loaded from .env with fallback) ─────
W_GNN      = float(os.getenv("WEIGHT_GNN",      "0.35"))
W_ENSEMBLE = float(os.getenv("WEIGHT_ENSEMBLE",  "0.25"))
W_VAE      = float(os.getenv("WEIGHT_VAE",       "0.20"))
W_BEI      = float(os.getenv("WEIGHT_BEI",       "0.12"))
W_GRAPH    = float(os.getenv("WEIGHT_GRAPH",      "0.08"))

# Decision thresholds
T_APPROVE = float(os.getenv("RISK_THRESHOLD_APPROVE", "0.40"))
T_REVIEW  = float(os.getenv("RISK_THRESHOLD_REVIEW",  "0.70"))
T_FLAG    = float(os.getenv("RISK_THRESHOLD_FLAG",     "0.85"))

# Override threshold: if ring member AND community fraud rate > this → force REVIEW
RING_OVERRIDE_COMMUNITY_RATE = 0.60


@dataclass
class FusionResult:
    account_id:           str
    final_risk:           float
    decision:             str          # APPROVE | REVIEW | FLAG | BLOCK
    gnn_score:            float
    ensemble_score:       float
    vae_score:            float
    bei_score:            float
    graph_score:          float
    ring_membership:      bool
    community_fraud_rate: float
    override_applied:     bool = False


def _graph_features_score(
    ring_membership_flag: bool,
    community_fraud_rate: float,
    two_hop_contamination: float,
) -> float:
    """
    Composite graph-level score from ring membership, community fraud rate,
    and 2-hop contamination.
    graph_score = 0.5×ring_flag + 0.3×community_rate + 0.2×two_hop
    """
    return (
        0.5 * float(ring_membership_flag)
        + 0.3 * float(community_fraud_rate)
        + 0.2 * float(two_hop_contamination)
    )


def _apply_decision(final_risk: float) -> str:
    if final_risk >= T_FLAG:
        return "BLOCK"
    if final_risk >= T_REVIEW:
        return "FLAG"
    if final_risk >= T_APPROVE:
        return "REVIEW"
    return "APPROVE"


def fuse_scores(
    account_id:            str,
    gnn_score:             float,
    ensemble_score:        float,
    vae_score:             float,
    bei_score:             float,
    ring_membership:       bool  = False,
    community_fraud_rate:  float = 0.0,
    two_hop_contamination: float = 0.0,
) -> FusionResult:
    """
    Compute weighted finalRisk and decision for one account.

    Args:
        account_id:            Bank account identifier string
        gnn_score:             Graph Neural Network fraud probability [0,1]
        ensemble_score:        XGB+LGBM+CatBoost stacked probability [0,1]
        vae_score:             VAE reconstruction anomaly score [0,1]
        bei_score:             Browser/device BEI risk score [0,1]
        ring_membership:       True if account detected in a suspicious ring
        community_fraud_rate:  Louvain community fraud rate [0,1]
        two_hop_contamination: Mean risk of 2-hop graph neighbors [0,1]

    Returns:
        FusionResult with final_risk, decision, and per-layer scores
    """
    # Clamp all inputs to [0, 1]
    gnn_s  = max(0.0, min(1.0, float(gnn_score)))
    ens_s  = max(0.0, min(1.0, float(ensemble_score)))
    vae_s  = max(0.0, min(1.0, float(vae_score)))
    bei_s  = max(0.0, min(1.0, float(bei_score)))

    graph_s = _graph_features_score(ring_membership, community_fraud_rate, two_hop_contamination)
    graph_s = max(0.0, min(1.0, graph_s))

    # Weighted fusion
    final_risk = (
        W_GNN      * gnn_s
        + W_ENSEMBLE * ens_s
        + W_VAE      * vae_s
        + W_BEI      * bei_s
        + W_GRAPH    * graph_s
    )
    final_risk = max(0.0, min(1.0, final_risk))

    decision = _apply_decision(final_risk)
    override_applied = False

    # Override rule: ring member in high-fraud community → minimum REVIEW
    if ring_membership and community_fraud_rate > RING_OVERRIDE_COMMUNITY_RATE:
        if decision == "APPROVE":
            decision = "REVIEW"
            override_applied = True
            logger.info(
                f"[{account_id}] Override applied: ring member + "
                f"community_fraud_rate={community_fraud_rate:.2f} → forced REVIEW"
            )

    logger.debug(
        f"[{account_id}] GNN={gnn_s:.3f} ENS={ens_s:.3f} VAE={vae_s:.3f} "
        f"BEI={bei_s:.3f} GRAPH={graph_s:.3f} → finalRisk={final_risk:.3f} → {decision}"
    )

    return FusionResult(
        account_id=account_id,
        final_risk=round(final_risk, 4),
        decision=decision,
        gnn_score=round(gnn_s, 4),
        ensemble_score=round(ens_s, 4),
        vae_score=round(vae_s, 4),
        bei_score=round(bei_s, 4),
        graph_score=round(graph_s, 4),
        ring_membership=ring_membership,
        community_fraud_rate=round(community_fraud_rate, 4),
        override_applied=override_applied,
    )


def batch_fuse(
    accounts: list[dict],
) -> list[FusionResult]:
    """
    Fuse scores for a batch of accounts.
    Each dict must have keys matching fuse_scores() arguments.
    """
    results = []
    for acct in accounts:
        try:
            result = fuse_scores(**acct)
            results.append(result)
        except Exception as e:
            logger.error(f"Batch fusion failed for {acct.get('account_id', '?')}: {e}")
    return results