"""
preprocessing/composite_features.py
Engineer the 12 composite features described in the Nyxara guide.
These are computed AFTER feature selection — they're always added on top.
"""
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger("nyxara.composite")

# Occupation risk weights (higher = more suspicious for financial anomalies)
OCCUPATION_RISK_WEIGHTS = {
    "student": 1.0,
    "housewife": 0.9,
    "retired": 0.8,
    "agriculture": 0.6,
    "salaried": 0.4,
    "selfemployed": 0.3,
    "others": 0.5,
}

# Expected annual income proxy by occupation (in ₹, rough median)
OCCUPATION_INCOME_PROXY = {
    "student": 50_000,
    "housewife": 80_000,
    "retired": 200_000,
    "agriculture": 150_000,
    "salaried": 500_000,
    "selfemployed": 600_000,
    "others": 200_000,
}

HIGH_RISK_OCCUPATIONS_FOR_INTL = {"student", "housewife", "retired"}


def add_composite_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add all 12 composite features to the DataFrame.
    Input df must have already been encoded (F3891 as string still OK here).
    Returns df with additional columns.
    """
    df = df.copy()

    # ── Helpers ───────────────────────────────────────────────
    occ = df["F3891"].str.lower().str.strip() if "F3891" in df.columns else pd.Series("others", index=df.index)

    def safe(col, default=0.0):
        return df[col] if col in df.columns else pd.Series(default, index=df.index)

    # ── 1. occupation_velocity_anomaly ────────────────────────
    # F3894 / occupation 95th percentile txn count
    if "F3894" in df.columns and "F3891" in df.columns:
        occ_95th = df.groupby("F3891")["F3894"].transform(lambda x: x.quantile(0.95))
        df["occupation_velocity_anomaly"] = df["F3894"] / (occ_95th + 1e-6)
    else:
        df["occupation_velocity_anomaly"] = 0.0

    # ── 2. pass_through_score ─────────────────────────────────
    # F527 (debit-credit ratio) × F2737 (balance volatility)
    df["pass_through_score"] = safe("F527") * safe("F2737").abs()

    # ── 3. network_centrality_proxy ──────────────────────────
    # F531 × log(F1692 + 1)
    df["network_centrality_proxy"] = safe("F531") * np.log1p(safe("F1692"))

    # ── 4. dormancy_activation_signal ────────────────────────
    # F3043_missing × F3894
    df["dormancy_activation_signal"] = (
        safe("F3043_missing", 0) * safe("F3894")
    )

    # ── 5. financial_impossibility_score ─────────────────────
    # F3836 / occupation expected annual income
    income_proxy = occ.map(OCCUPATION_INCOME_PROXY).fillna(200_000).astype(float)
    df["financial_impossibility_score"] = safe("F3836").abs() / income_proxy

    # ── 6. peer_deviation_combined ───────────────────────────
    # |F2582| + |F2678|
    df["peer_deviation_combined"] = safe("F2582").abs() + safe("F2678").abs()

    # ── 7. structuring_risk ───────────────────────────────────
    # F2122 (cash frequency) × F3894 (txn count)
    df["structuring_risk"] = safe("F2122") * safe("F3894")

    # ── 8. cross_border_occupation_risk ──────────────────────
    # F2082 × occupation_risk_weight
    occ_risk = occ.map(OCCUPATION_RISK_WEIGHTS).fillna(0.5).astype(float)
    df["cross_border_occupation_risk"] = safe("F2082") * occ_risk

    # ── 9. temporal_burst_index ───────────────────────────────
    # F3894 / max(F3043, 1) — transactions per day of relationship
    f3043 = safe("F3043").fillna(1).clip(lower=1)
    df["temporal_burst_index"] = safe("F3894") / f3043

    # ── 10. risk_cluster_membership ──────────────────────────
    # Placeholder — filled by community/louvain.py after graph build
    # Set to 0.0 here; scorer.py will overwrite from the ring cache
    if "risk_cluster_membership" not in df.columns:
        df["risk_cluster_membership"] = 0.0

    # ── 11. two_hop_contamination ────────────────────────────
    # Placeholder — filled by graph inference
    if "two_hop_contamination" not in df.columns:
        df["two_hop_contamination"] = 0.0

    # ── 12. international_flag_occupation ─────────────────────
    # Binary: F2082 > 0 AND occupation in {student, housewife, retired}
    is_high_risk_occ = occ.isin(HIGH_RISK_OCCUPATIONS_FOR_INTL)
    has_intl = safe("F2082") > 0
    df["international_flag_occupation"] = (has_intl & is_high_risk_occ).astype("int8")

    n_added = 12
    logger.info(f"Added {n_added} composite features. DataFrame now has {len(df.columns)} columns.")
    return df