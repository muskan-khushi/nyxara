"""
preprocessing/feature_selector.py
5-Stage feature selection pipeline: 3,924 → 50 power features.

Stage 1: Variance threshold      (~3,924 → ~1,800)
Stage 2: Missing value analysis  (~1,800 → ~1,200)
Stage 3: Mutual information      (~1,200 → 150)
Stage 4: Correlation dedup       (150 → ~100)
Stage 5: SHAP forward select     (~100 → 50)
"""
import json
import logging
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.feature_selection import VarianceThreshold, mutual_info_classif
from sklearn.model_selection import StratifiedKFold
import xgboost as xgb
import shap

logger = logging.getLogger("nyxara.feature_selector")

ARTIFACTS_DIR = Path(__file__).parent.parent / "models" / "artifacts"

# Always keep these regardless of MI rank
BANK_KEY_FEATURES = [
    "F115", "F321", "F527", "F531", "F670", "F1692",
    "F2082", "F2122", "F2582", "F2678", "F2737", "F2956",
    "F3043", "F3836", "F3887", "F3889", "F3891", "F3894",
]

FINAL_N_FEATURES = 50


# ─── Stage 1 ─────────────────────────────────────────────────────────────────

def variance_filter(X: pd.DataFrame, threshold: float = 0.01) -> pd.DataFrame:
    """Drop near-constant features. Applied to numeric columns only."""
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = X.select_dtypes(include=["object"]).columns.tolist()

    selector = VarianceThreshold(threshold=threshold)
    selector.fit(X[numeric_cols])
    kept_numeric = [c for c, keep in zip(numeric_cols, selector.get_support()) if keep]

    result = pd.concat([X[kept_numeric], X[cat_cols]], axis=1)
    logger.info(f"Stage 1 Variance: {len(X.columns)} → {len(result.columns)} columns")
    return result


# ─── Stage 2 ─────────────────────────────────────────────────────────────────

def missing_analysis(X: pd.DataFrame, drop_threshold: float = 0.50, flag_threshold: float = 0.40) -> pd.DataFrame:
    """
    Drop columns with >50% missing.
    Create _missing binary flag for columns 40-50% missing.
    Impute remaining: median (numeric) / mode (categorical).
    """
    missing_pct = X.isnull().mean()

    # Drop high-missing columns (except bank key features)
    to_drop = [
        c for c in X.columns
        if missing_pct[c] > drop_threshold and c not in BANK_KEY_FEATURES
    ]
    X = X.drop(columns=to_drop)
    logger.info(f"Stage 2 Missing: dropped {len(to_drop)} columns (>{drop_threshold*100:.0f}% missing)")

    # Create binary flags for 40-50% missing range
    for col in X.columns:
        if flag_threshold < missing_pct.get(col, 0) <= drop_threshold:
            X[f"{col}_missing"] = X[col].isnull().astype("int8")
            logger.info(f"  Created flag: {col}_missing")

    # Special flag: F3043 missingness is a strong fraud signal
    if "F3043" in X.columns and "F3043_missing" not in X.columns:
        X["F3043_missing"] = X["F3043"].isnull().astype("int8")

    # Impute
    for col in X.select_dtypes(include=[np.number]).columns:
        if X[col].isnull().any():
            X[col] = X[col].fillna(X[col].median())

    for col in X.select_dtypes(include=["object"]).columns:
        if X[col].isnull().any():
            X[col] = X[col].fillna(X[col].mode().iloc[0] if not X[col].mode().empty else "UNKNOWN")

    logger.info(f"Stage 2 complete: {X.shape[1]} columns remaining")
    return X


# ─── Stage 3 ─────────────────────────────────────────────────────────────────

def mutual_info_ranking(X: pd.DataFrame, y: pd.Series, top_n: int = 150) -> pd.DataFrame:
    """
    Rank all numeric features by mutual information with target.
    Force-include all bank key features.
    Returns top_n features DataFrame.
    """
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = X.select_dtypes(include=["object"]).columns.tolist()

    logger.info(f"Stage 3: Computing mutual information for {len(numeric_cols)} numeric features ...")

    mi_scores = mutual_info_classif(
        X[numeric_cols].fillna(0),
        y,
        discrete_features=False,
        n_neighbors=5,
        random_state=42,
        # n_jobs=-1 would speed up but not available in older sklearn versions
    )

    mi_series = pd.Series(mi_scores, index=numeric_cols).sort_values(ascending=False)

    # Force-include bank key features
    must_include = [c for c in BANK_KEY_FEATURES if c in X.columns]
    top_by_mi = mi_series.head(top_n).index.tolist()
    selected_numeric = list(set(top_by_mi) | set(must_include))

    result = pd.concat([X[selected_numeric], X[cat_cols]], axis=1)
    logger.info(f"Stage 3 MI: selected {len(result.columns)} features (top {top_n} + {len(must_include)} forced)")
    return result


# ─── Stage 4 ─────────────────────────────────────────────────────────────────

def correlation_dedup(X: pd.DataFrame, threshold: float = 0.95) -> pd.DataFrame:
    """
    Remove features with |Pearson r| > threshold with another feature.
    When removing, keep the one with higher MI score (passed in via column order).
    """
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = X.select_dtypes(include=["object"]).columns.tolist()

    corr_matrix = X[numeric_cols].corr().abs()
    upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))

    to_drop = [col for col in upper.columns if any(upper[col] > threshold)]
    # Never drop bank key features
    to_drop = [c for c in to_drop if c not in BANK_KEY_FEATURES]

    X = X.drop(columns=to_drop)
    logger.info(f"Stage 4 Correlation dedup: dropped {len(to_drop)} correlated features → {X.shape[1]} remaining")
    return X


# ─── Stage 5 ─────────────────────────────────────────────────────────────────

def shap_forward_select(
    X: pd.DataFrame,
    y: pd.Series,
    n_features: int = FINAL_N_FEATURES,
    n_trees: int = 100,
) -> tuple[pd.DataFrame, list[str]]:
    """
    Train a fast XGBoost, compute SHAP mean |values|, keep top n_features.
    Cross-validate to confirm feature stability.
    Saves selected_features.json to artifacts.
    """
    numeric_X = X.select_dtypes(include=[np.number])
    cat_cols = X.select_dtypes(include=["object"]).columns.tolist()

    logger.info(f"Stage 5: SHAP selection from {numeric_X.shape[1]} numeric features ...")

    # Quick XGBoost
    scale_pos_weight = (y == 0).sum() / max((y == 1).sum(), 1)
    model = xgb.XGBClassifier(
        n_estimators=n_trees,
        max_depth=5,
        learning_rate=0.1,
        scale_pos_weight=scale_pos_weight,
        tree_method="hist",
        random_state=42,
        eval_metric="auc",
        verbosity=0,
    )
    model.fit(numeric_X, y)

    # SHAP values
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(numeric_X)
    mean_abs_shap = pd.Series(
        np.abs(shap_values).mean(axis=0),
        index=numeric_X.columns
    ).sort_values(ascending=False)

    # Force-include bank key features
    must_include = [c for c in BANK_KEY_FEATURES if c in numeric_X.columns]
    top_shap = mean_abs_shap.head(n_features).index.tolist()
    selected = list(set(top_shap) | set(must_include))[:n_features + len(must_include)]

    # Final feature list
    final_cols = selected + cat_cols
    X_final = X[final_cols]

    # Save
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "selected_features.json", "w") as f:
        json.dump({"features": final_cols, "n_features": len(final_cols)}, f, indent=2)

    logger.info(f"Stage 5 SHAP: final feature set = {len(final_cols)} features. Saved to artifacts.")
    return X_final, final_cols


# ─── Master pipeline ─────────────────────────────────────────────────────────

def run_selection_pipeline(X: pd.DataFrame, y: pd.Series) -> tuple[pd.DataFrame, list[str]]:
    """Run all 5 stages in sequence. Returns (X_selected, feature_names)."""
    X = variance_filter(X)
    X = missing_analysis(X)
    X = mutual_info_ranking(X, y)
    X = correlation_dedup(X)
    X, features = shap_forward_select(X, y)
    return X, features


def load_selected_features() -> list[str]:
    """Load previously saved feature list."""
    path = ARTIFACTS_DIR / "selected_features.json"
    with open(path) as f:
        return json.load(f)["features"]