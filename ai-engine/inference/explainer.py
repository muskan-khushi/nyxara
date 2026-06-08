"""
inference/explainer.py
4-layer SHAP explainability stack:
  1. SHAP Global  — which features drive ALL flags this month
  2. SHAP Local   — waterfall chart per account (top-10 factors)
  3. Graph Explain — ring topology context
  4. LLM Narration — plain-English (in alert_narrator.py)
"""
import json
import logging
from pathlib import Path
import numpy as np
import pandas as pd
import shap

logger = logging.getLogger("nyxara.explainer")
ARTIFACTS_DIR = Path(__file__).parent.parent / "models" / "artifacts"


# ─── Local explanation (per account) ─────────────────────────

def explain_account(
    model,          # XGBoost model
    X_row: pd.DataFrame,
    top_n: int = 10,
) -> list[dict]:
    """
    Compute SHAP values for a single account.
    Returns list of top_n factors sorted by |SHAP value|.
    """
    explainer  = shap.TreeExplainer(model)
    shap_vals  = explainer.shap_values(X_row)

    if isinstance(shap_vals, list):
        shap_vals = shap_vals[1]   # Binary classification: take class-1 (fraud) values

    row_shap = shap_vals[0] if shap_vals.ndim == 2 else shap_vals

    factors = []
    for fname, sval, rval in zip(X_row.columns, row_shap, X_row.iloc[0]):
        factors.append({
            "feature":    fname,
            "shap_value": float(sval),
            "raw_value":  float(rval) if not pd.isna(rval) else None,
            "direction":  "fraud_risk" if sval > 0 else "safe_signal",
        })

    factors.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
    return factors[:top_n]


# ─── Global explanation (all accounts) ───────────────────────

def compute_global_shap(
    model,
    X: pd.DataFrame,
    sample_size: int = 500,
) -> list[dict]:
    """
    Compute mean |SHAP| across a sample of accounts.
    Returns feature importance ranking for the monthly compliance report.
    """
    if len(X) > sample_size:
        X = X.sample(sample_size, random_state=42)

    logger.info(f"Computing global SHAP on {len(X)} accounts ...")
    explainer  = shap.TreeExplainer(model)
    shap_vals  = explainer.shap_values(X)

    if isinstance(shap_vals, list):
        shap_vals = shap_vals[1]

    mean_abs = np.abs(shap_vals).mean(axis=0)

    global_factors = [
        {
            "feature":         fname,
            "mean_abs_shap":   float(mval),
            "rank":            i + 1,
        }
        for i, (fname, mval) in enumerate(
            sorted(zip(X.columns, mean_abs), key=lambda x: x[1], reverse=True)
        )
    ]

    # Save monthly report
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "global_shap.json", "w") as f:
        json.dump(global_factors[:30], f, indent=2)

    logger.info(f"Global SHAP complete. Top feature: {global_factors[0]['feature']} ({global_factors[0]['mean_abs_shap']:.4f})")
    return global_factors


# ─── Graph explanation (ring context) ────────────────────────

def explain_graph_position(
    account_id: str,
    ring_data: list[dict],
    pagerank_score: float = 0.0,
    community_fraud_rate: float = 0.0,
) -> dict:
    """
    Build graph-layer explanation text for the compliance alert.
    Tells the officer WHERE in the ring this account sits.
    """
    # Find account's ring membership
    rings_in = [r for r in ring_data if account_id in r.get("accounts", [])]

    if not rings_in:
        return {
            "in_ring":         False,
            "ring_count":      0,
            "roles":           [],
            "explanation":     "Account has no detected ring membership.",
            "pagerank_score":  round(pagerank_score, 4),
            "community_fraud": round(community_fraud_rate, 4),
        }

    ring = rings_in[0]  # Primary ring
    role = ring.get("roles", {}).get(account_id, "member")
    shape = ring.get("shape", "UNKNOWN")
    size  = ring.get("size", len(ring.get("accounts", [])))
    hub   = ring.get("hub_node")

    if role == "hub":
        exp = f"Account is the HUB of a {shape} ring ({size} nodes). It controls {size-1} downstream mule accounts."
    elif role == "mule":
        exp = f"Account is a MULE node in a {shape} ring. Hub account: {hub}."
    elif role == "bridge":
        exp = f"Account is a BRIDGE connecting two clusters in a {shape} structure ({size} total nodes)."
    elif role == "orchestrator":
        exp = f"Account is the ORCHESTRATOR of a {shape} network ({size} nodes). Highest PageRank in cluster."
    else:
        exp = f"Account is a member of a {shape} ring ({size} nodes, fraud rate: {ring.get('fraud_rate', 0):.1%})."

    return {
        "in_ring":         True,
        "ring_count":      len(rings_in),
        "ring_id":         ring.get("ring_id"),
        "shape":           shape,
        "role":            role,
        "ring_size":       size,
        "ring_fraud_rate": ring.get("fraud_rate", 0.0),
        "explanation":     exp,
        "pagerank_score":  round(pagerank_score, 4),
        "community_fraud": round(community_fraud_rate, 4),
    }


def load_global_shap() -> list[dict]:
    path = ARTIFACTS_DIR / "global_shap.json"
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)