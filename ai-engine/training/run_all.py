"""
training/run_all.py
Master training pipeline. Run this once to train all models.

Usage:
    cd ai-engine
    python training/run_all.py

Estimated time: 30-60 minutes on laptop CPU.
"""
import json
import logging
import sys
import time
from pathlib import Path

import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, f1_score, confusion_matrix

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("nyxara.training")

ARTIFACTS_DIR = Path(__file__).parent.parent / "models" / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def run_full_pipeline(dataset_path: str = "../data/dataset.xlsx"):
    start = time.time()
    logger.info("=" * 60)
    logger.info("NYXARA TRAINING PIPELINE — START")
    logger.info("=" * 60)

    # ── Step 1: Load dataset ───────────────────────────────────
    logger.info("\n[1/12] Loading dataset ...")
    from preprocessing.loader import load_dataset, check_imbalance, quick_eda
    X, y = load_dataset(dataset_path)
    fraud_rate = check_imbalance(y)
    eda = quick_eda(X, y)

    # ── Step 2: Feature selection (5-stage) ────────────────────
    logger.info("\n[2/12] Running 5-stage feature selection pipeline ...")
    from preprocessing.feature_selector import run_selection_pipeline
    X_selected, feature_names = run_selection_pipeline(X, y)
    logger.info(f"Selected {len(feature_names)} features")

    # ── Step 3: Composite features ─────────────────────────────
    logger.info("\n[3/12] Engineering composite features ...")
    from preprocessing.composite_features import add_composite_features
    X_selected = add_composite_features(X_selected)

    # ── Step 4: Encode + Scale ─────────────────────────────────
    logger.info("\n[4/12] Encoding and scaling ...")
    from preprocessing.encoder import fit_encoders
    from preprocessing.scaler import fit_scaler
    X_encoded, encoders = fit_encoders(X_selected)
    X_scaled, scaler = fit_scaler(X_encoded)

    # ── Step 5: Train / Val / Test split ───────────────────────
    logger.info("\n[5/12] Splitting data ...")
    X_temp, X_test, y_temp, y_test = train_test_split(
        X_scaled, y, test_size=0.15, random_state=42, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=0.15, random_state=42, stratify=y_temp
    )
    logger.info(f"Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")

    # ── Step 6: Balance training set ───────────────────────────
    logger.info("\n[6/12] Balancing training set ...")
    from preprocessing.balancer import balance_dataset, compute_class_weights
    X_train_bal, y_train_bal = balance_dataset(X_train, y_train)
    weights = compute_class_weights(y_train)
    spw = weights["scale_pos_weight"]

    # ── Step 7: Train ensemble ─────────────────────────────────
    logger.info("\n[7/12] Training ensemble models ...")

    from models.ensemble.xgboost_model import train_xgboost
    xgb_model = train_xgboost(X_train_bal, y_train_bal, X_val, y_val, scale_pos_weight=spw)
    xgb_val_probs = xgb_model.predict_proba(X_val)[:, 1]

    from models.ensemble.lightgbm_model import train_lightgbm
    lgbm_model = train_lightgbm(X_train_bal, y_train_bal, X_val, y_val, scale_pos_weight=spw)
    lgbm_val_probs = lgbm_model.predict_proba(X_val)[:, 1]

    from models.ensemble.catboost_model import train_catboost
    cat_model = train_catboost(X_train_bal, y_train_bal, X_val, y_val, scale_pos_weight=spw)
    cat_val_probs = cat_model.predict_proba(X_val)[:, 1]

    # ── Step 8: Build graph + train GNN ───────────────────────
    logger.info("\n[8/12] Building graph and training GNN ...")
    from models.gnn.graph_builder import build_knn_edges, build_branch_edges, build_linked_edges, to_pyg_data

    all_edges = (
        build_knn_edges(X_scaled.select_dtypes(include=[np.number]).values, k=8)
        + build_branch_edges(X_scaled)
        + build_linked_edges(X_scaled)
    )

    n = len(X_scaled)
    train_mask = np.zeros(n, dtype=bool)
    val_mask   = np.zeros(n, dtype=bool)
    test_mask  = np.zeros(n, dtype=bool)
    train_mask[X_train.index] = True
    val_mask[X_val.index]     = True
    test_mask[X_test.index]   = True

    import torch
    from models.gnn.train_gnn import train_gnn, get_gnn_scores
    pyg_data  = to_pyg_data(X_scaled, y, all_edges, train_mask, val_mask, test_mask)
    gnn_model = train_gnn(pyg_data)
    gnn_all_scores = get_gnn_scores(gnn_model, pyg_data)
    gnn_val_scores = gnn_all_scores[val_mask]

    # ── Step 9: Train meta-learner ─────────────────────────────
    logger.info("\n[9/12] Training meta-learner (stacker) ...")
    from models.ensemble.stacker import build_meta_features, train_meta_learner
    meta_X    = build_meta_features(xgb_val_probs, lgbm_val_probs, cat_val_probs, gnn_val_scores)
    meta_model = train_meta_learner(meta_X, y_val.values)

    # ── Step 9b: Train VAE ─────────────────────────────────────
    logger.info("\n[9b/12] Training VAE on legitimate accounts ...")
    from models.anomaly.vae import train_vae
    legit_mask = y_train_bal == 0
    X_legit    = X_train_bal[legit_mask].select_dtypes(include=[np.number]).values
    vae_model  = train_vae(X_legit.astype(np.float32))

    # ── Step 10: Ring detection ────────────────────────────────
    logger.info("\n[10/12] Detecting mule rings ...")
    import networkx as nx
    from models.gnn.ring_detector import (
        build_networkx_graph, detect_all_rings, save_rings_to_artifacts
    )
    account_ids = [f"ACC-{i:06d}" for i in range(n)]
    G = build_networkx_graph(all_edges, account_ids, risk_scores={
        account_ids[i]: float(gnn_all_scores[i]) for i in range(n)
    })
    rings = detect_all_rings(G, account_ids, gnn_scores=gnn_all_scores)
    save_rings_to_artifacts(rings)

    # ── Step 11: Community detection ───────────────────────────
    logger.info("\n[11/12] Running Louvain community detection ...")
    from models.community.louvain import detect_communities
    community_data = detect_communities(G, account_ids, gnn_scores=gnn_all_scores, labels=y.values)

    # ── Step 12: Evaluate ──────────────────────────────────────
    logger.info("\n[12/12] Final evaluation on test set ...")
    xgb_test  = xgb_model.predict_proba(X_test)[:, 1]
    lgbm_test = lgbm_model.predict_proba(X_test)[:, 1]
    cat_test  = cat_model.predict_proba(X_test)[:, 1]
    gnn_test  = gnn_all_scores[test_mask]

    meta_test_X    = build_meta_features(xgb_test, lgbm_test, cat_test, gnn_test)
    ensemble_probs = meta_model.predict_proba(meta_test_X)[:, 1]

    auc   = roc_auc_score(y_test, ensemble_probs)
    preds = (ensemble_probs >= 0.5).astype(int)
    f1    = f1_score(y_test, preds, zero_division=0)
    cm    = confusion_matrix(y_test, preds).tolist()

    report = {
        "auc":               round(auc, 4),
        "f1":                round(f1, 4),
        "confusion_matrix":  cm,
        "optimal_threshold": 0.5,
        "n_train":           len(X_train_bal),
        "n_test":            len(X_test),
        "fraud_rate":        round(fraud_rate, 4),
    }

    with open(ARTIFACTS_DIR / "eval_report.json", "w") as f:
        json.dump(report, f, indent=2)

    with open(ARTIFACTS_DIR / "model_meta.json", "w") as f:
        json.dump({
            "version":       "1.0.0",
            "n_features":    len(feature_names),
            "training_rows": len(X_train_bal),
        }, f, indent=2)

    elapsed = (time.time() - start) / 60
    logger.info(f"\n{'='*60}")
    logger.info(f"TRAINING COMPLETE in {elapsed:.1f} minutes")
    logger.info(f"Test AUC: {auc:.4f} | F1: {f1:.4f}")
    logger.info(f"Rings detected: {len(rings)}")
    logger.info(f"Communities: {community_data.get('n_communities', '?')}")
    logger.info(f"{'='*60}\n")

    return report


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="../data/dataset.xlsx")
    args = parser.parse_args()
    run_full_pipeline(dataset_path=args.dataset)