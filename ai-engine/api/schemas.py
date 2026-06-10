"""
api/schemas.py
Pydantic request/response models for the AI Engine API.
"""
from pydantic import BaseModel, Field
from typing import Optional


class AccountFeatures(BaseModel):
    """Features for a single account. Only the 18 key features required at minimum."""
    account_id: str = Field(..., description="Unique account identifier")
    # Bank-identified key features (send as many as available)
    F115: Optional[float] = None
    F321: Optional[float] = None
    F527: Optional[float] = None
    F531: Optional[float] = None
    F670: Optional[float] = None
    F1692: Optional[float] = None
    F2082: Optional[float] = None
    F2122: Optional[float] = None
    F2582: Optional[float] = None
    F2678: Optional[float] = None
    F2737: Optional[float] = None
    F2956: Optional[float] = None
    F3043: Optional[float] = None
    F3836: Optional[float] = None
    F3887: Optional[float] = None
    F3889: Optional[str]   = None
    F3891: Optional[str]   = None  # occupation
    F3894: Optional[float] = None
    # BEI score from cybersec engine (injected by backend)
    bei_risk_score: Optional[float] = 0.0
    # Allow extra fields for full feature vector
    model_config = {"extra": "allow"}


class ShapFactor(BaseModel):
    feature: str
    shap_value: float
    raw_value: Optional[float] = None
    direction: str  # "fraud_risk" | "safe_signal"


class ScoreResponse(BaseModel):
    account_id: str
    final_risk: float = Field(..., ge=0.0, le=1.0)
    decision: str  # APPROVE | REVIEW | FLAG | BLOCK
    gnn_score: float
    ensemble_score: float
    vae_score: float
    bei_score: float
    graph_score: float
    ring_membership: bool
    community_fraud_rate: float
    shap_factors: list[ShapFactor]
    alert_text: str
    override_applied: bool


class BatchScoreRequest(BaseModel):
    accounts: list[AccountFeatures] = Field(..., max_length=100)


class MetricsResponse(BaseModel):
    auc: float
    f1: float
    confusion_matrix: list[list[int]]
    n_train: int
    n_test: int
    fraud_rate: float


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    model_version: str
    n_features: int
    cache_size: int