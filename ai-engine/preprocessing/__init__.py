"""
preprocessing/__init__.py
Convenience imports for the preprocessing pipeline.
"""
from .loader import load_dataset, check_imbalance, quick_eda, memory_optimize
from .feature_selector import run_selection_pipeline, load_selected_features
from .composite_features import add_composite_features
from .encoder import fit_encoders, apply_encoders
from .scaler import fit_scaler, apply_scaler
from .balancer import balance_dataset, compute_class_weights

__all__ = [
    "load_dataset",
    "check_imbalance",
    "quick_eda",
    "memory_optimize",
    "run_selection_pipeline",
    "load_selected_features",
    "add_composite_features",
    "fit_encoders",
    "apply_encoders",
    "fit_scaler",
    "apply_scaler",
    "balance_dataset",
    "compute_class_weights",
]