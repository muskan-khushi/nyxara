"""
preprocessing/composite_features.py
Engineer the 12 composite features described in the Nyxara guide.

FIXES:
1. Deduplicate columns FIRST (repeated pd.concat in pipeline can add duplicates).
2. Guard occupation column against post-encoding integer dtype — map back to
   string labels before using string operations or OCCUPATION_* dicts.
3. All composite columns are explicitly cast to float32 to avoid dtype surprises
   downstream (ADASYN / sklearn require homogeneous numeric types).
"""
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger("nyxara.composite")

OCCUPATION_RISK_WEIGHTS = {
    "student": 1.0,
    "housewife": 0.9,
    "retired": 0.8,
    "agriculture": 0.6,
    "salaried": 0.4,
    "selfemployed": 0.3,
    "others": 0.5,
}

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

# Index→label map matching LabelEncoder alphabetical order for F3891
# (agriculture=0, housewife=1, others=2, retired=3, salaried=4, selfemployed=5, student=6)
_F3891_IDX_MAP = {
    0: "agriculture", 1: "housewife", 2: "others",
    3: "retired", 4: "salaried", 5: "selfemployed", 6: "student",
}


def _resolve_occupation(df: pd.DataFrame) -> pd.Series:
    """
    Return a string occupation Series regardless of whether F3891 is still
    object dtype (pre-encoding) or int dtype (post-encoding).
    Falls back to 'others' for any unrecognised value.
    """
    if "F3891" not in df.columns:
        return pd.Series("others", index=df.index)

    col = df["F3891"]
    if pd.api.types.is_object_dtype(col):
        return col.str.lower().str.strip().fillna("others")
    else:
        # Already label-encoded to int — map back to string labels
        return col.map(_F3891_IDX_MAP).fillna("others")


def add_composite_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add 12 composite features. Safe to call before or after encoding."""
    df = df.copy()

    # ── 1. Deduplicate columns (can arise from repeated pd.concat) ────────────
    df = df.loc[:, ~df.columns.duplicated()]

    # ── Resolve occupation as strings ─────────────────────────────────────────
    occ = _resolve_occupation(df)

    def safe(col: str, default: float = 0.0) -> pd.Series:
        if col in df.columns:
            return pd.to_numeric(df[col], errors="coerce").fillna(default)
        return pd.Series(default, index=df.index, dtype="float32")

    # ── 1. occupation_velocity_anomaly ────────────────────────────────────────
    if "F3894" in df.columns and "F3891" in df.columns:
        raw_f3891 = df["F3891"]
        # Group by the raw column values (int or str — both work for groupby)
        occ_95th = df.groupby(raw_f3891)["F3894"].transform(
            lambda x: pd.to_numeric(x, errors="coerce").quantile(0.95)
        )
        df["occupation_velocity_anomaly"] = (
            safe("F3894") / (occ_95th.fillna(1.0) + 1e-6)
        ).astype("float32")
    else:
        df["occupation_velocity_anomaly"] = np.float32(0.0)

    # ── 2. pass_through_score ─────────────────────────────────────────────────
    df["pass_through_score"] = (safe("F527") * safe("F2737").abs()).astype("float32")

    # ── 3. network_centrality_proxy ──────────────────────────────────────────
    df["network_centrality_proxy"] = (
        safe("F531") * np.log1p(safe("F1692"))
    ).astype("float32")

    # ── 4. dormancy_activation_signal ────────────────────────────────────────
    df["dormancy_activation_signal"] = (
        safe("F3043_missing", 0.0) * safe("F3894")
    ).astype("float32")

    # ── 5. financial_impossibility_score ─────────────────────────────────────
    income_proxy = occ.map(OCCUPATION_INCOME_PROXY).fillna(200_000).astype(float)
    df["financial_impossibility_score"] = (
        safe("F3836").abs() / income_proxy
    ).astype("float32")

    # ── 6. peer_deviation_combined ───────────────────────────────────────────
    df["peer_deviation_combined"] = (
        safe("F2582").abs() + safe("F2678").abs()
    ).astype("float32")

    # ── 7. structuring_risk ───────────────────────────────────────────────────
    df["structuring_risk"] = (safe("F2122") * safe("F3894")).astype("float32")

    # ── 8. cross_border_occupation_risk ──────────────────────────────────────
    occ_risk = occ.map(OCCUPATION_RISK_WEIGHTS).fillna(0.5).astype(float)
    df["cross_border_occupation_risk"] = (safe("F2082") * occ_risk).astype("float32")

    # ── 9. temporal_burst_index ───────────────────────────────────────────────
    f3043 = safe("F3043").fillna(1.0).clip(lower=1.0)
    df["temporal_burst_index"] = (safe("F3894") / f3043).astype("float32")

    # ── 10. risk_cluster_membership (placeholder) ────────────────────────────
    if "risk_cluster_membership" not in df.columns:
        df["risk_cluster_membership"] = np.float32(0.0)

    # ── 11. two_hop_contamination (placeholder) ──────────────────────────────
    if "two_hop_contamination" not in df.columns:
        df["two_hop_contamination"] = np.float32(0.0)

    # ── 12. international_flag_occupation ─────────────────────────────────────
    is_high_risk_occ = occ.isin(HIGH_RISK_OCCUPATIONS_FOR_INTL)
    has_intl = safe("F2082") > 0
    df["international_flag_occupation"] = (
        (has_intl & is_high_risk_occ).astype("int8")
    )

    logger.info(
        f"Added 12 composite features. DataFrame now has {len(df.columns)} columns."
    )
    return df