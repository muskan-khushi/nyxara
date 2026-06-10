"""
training/run_all.py
Master training pipeline. Run this once to train all models.

Usage:
    cd ai-engine
    python training/run_all.py

FIXES applied on top of original:
1. DataFrame index reset after train/test split — sklearn returns positional
   integer indices; using them as boolean masks on the original DataFrame caused
   wrong or out-of-bounds assignments.
2. composite_features called BEFORE encoder/scaler (not after), because
   composite_features needs string occupation and raw numeric values.
3. fit_encoders called after composite_features so encoded cols are included
   in norm_params.
4. Graph builder receives RESET-index DataFrame to guarantee 0-based integer
   node indices match edge tuples.
5. model_meta.json now written with correct n_features count.
6. FIX (NEW): optimal threshold computed via precision_recall_curve on
   validation set instead of hardcoded 0.5 — this is the critical fix for
   F1=0.13 → much higher F1 on extreme imbalance (0.89% fraud rate).
7. FIX (NEW): precision and recall added to eval_report.json so Metrics page
   works correctly.
8. FIX (NEW): community_fraud_rate and ring_membership properly fetched
   and stored during scoring so scorer.py override rule fires correctly.
"""
import json
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    roc_auc_score,
    f1_score,
    confusion_matrix,
    precision_recall_curve,
    precision_score,
    recall_score,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("nyxara.training")

ARTIFACTS_DIR = Path(__file__).parent.parent / "models" / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def run_full_pipeline(
    dataset_path: str = "../data/dataset.xlsx",
    nrows: int | None = None,
    dry_run: bool = False,
):
    start = time.time()
    logger.info("=" * 60)
    logger.info("NYXARA TRAINING PIPELINE — START")
    logger.info("=" * 60)

    # ── Step 1: Load ──────────────────────────────────────────
    logger.info("\n[1/12] Loading dataset ...")
    from preprocessing.loader import load_dataset, check_imbalance, quick_eda
    X, y = load_dataset(dataset_path, nrows=nrows)
    # reset index so all downstream iloc/positional ops are consistent
    X = X.reset_index(drop=True)
    y = y.reset_index(drop=True)
    fraud_rate = check_imbalance(y)
    quick_eda(X, y)

    # ── Step 2: Feature selection ─────────────────────────────
    logger.info("\n[2/12] Running 5-stage feature selection pipeline ...")
    from preprocessing.feature_selector import run_selection_pipeline
    X_selected, feature_names = run_selection_pipeline(X, y)
    X_selected = X_selected.reset_index(drop=True)
    logger.info(f"Selected {len(feature_names)} features")

    # ── Step 3: Composite features (BEFORE encoding) ──────────
    # Must run on raw/unencoded data so occupation strings are still intact
    logger.info("\n[3/12] Engineering composite features ...")
    from preprocessing.composite_features import add_composite_features
    X_selected = add_composite_features(X_selected)
    X_selected = X_selected.reset_index(drop=True)

    # ── Step 4a: Encode categoricals ─────────────────────────
    logger.info("\n[4a/12] Encoding categorical columns ...")
    from preprocessing.encoder import fit_encoders
    X_encoded, encoders = fit_encoders(X_selected)
    X_encoded = X_encoded.reset_index(drop=True)

    # ── Step 4b: Scale numerics (skips encoded cols) ──────────
    logger.info("\n[4b/12] Scaling numeric columns ...")
    from preprocessing.scaler import fit_scaler
    X_scaled, scaler = fit_scaler(X_encoded)
    X_scaled = X_scaled.reset_index(drop=True)

    # Update feature names to include composite features
    final_feature_names = X_scaled.columns.tolist()
    with open(ARTIFACTS_DIR / "selected_features.json", "w") as f:
        json.dump({"features": final_feature_names, "n_features": len(final_feature_names)}, f, indent=2)

    # ── Step 5: Split ─────────────────────────────────────────
    logger.info("\n[5/12] Splitting data ...")
    X_temp, X_test, y_temp, y_test = train_test_split(
        X_scaled, y, test_size=0.15, random_state=42, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=0.15, random_state=42, stratify=y_temp
    )
    # reset index on all splits so positional masking works correctly
    X_train = X_train.reset_index(drop=True)
    X_val   = X_val.reset_index(drop=True)
    X_test  = X_test.reset_index(drop=True)
    y_train = y_train.reset_index(drop=True)
    y_val   = y_val.reset_index(drop=True)
    y_test  = y_test.reset_index(drop=True)
    logger.info(f"Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")

    # ── Step 6: Balance ───────────────────────────────────────
    logger.info("\n[6/12] Balancing training set ...")
    from preprocessing.balancer import balance_dataset, compute_class_weights
    X_train_bal, y_train_bal = balance_dataset(X_train, y_train)
    X_train_bal = X_train_bal.reset_index(drop=True)
    y_train_bal = y_train_bal.reset_index(drop=True)
    weights = compute_class_weights(y_train)
    spw = weights["scale_pos_weight"]

    # ── Step 7: Ensemble ──────────────────────────────────────
    logger.info("\n[7/12] Training ensemble models ...")
    n_est = 5 if dry_run else 500

    from models.ensemble.xgboost_model import train_xgboost
    xgb_model = train_xgboost(
        X_train_bal, y_train_bal, X_val, y_val,
        scale_pos_weight=spw, n_estimators=n_est,
    )
    xgb_val_probs = xgb_model.predict_proba(X_val)[:, 1]

    from models.ensemble.lightgbm_model import train_lightgbm
    lgbm_model = train_lightgbm(
        X_train_bal, y_train_bal, X_val, y_val,
        scale_pos_weight=spw, n_estimators=n_est,
    )
    lgbm_val_probs = lgbm_model.predict_proba(X_val)[:, 1]

    from models.ensemble.catboost_model import train_catboost
    cat_model = train_catboost(
        X_train_bal, y_train_bal, X_val, y_val,
        scale_pos_weight=spw, iterations=n_est,
    )
    cat_val_probs = cat_model.predict_proba(X_val)[:, 1]

    # ── Step 8: Graph + GNN ───────────────────────────────────
    logger.info("\n[8/12] Building graph and training GNN ...")
    from models.gnn.graph_builder import (
        build_knn_edges, build_branch_edges, build_linked_edges, to_pyg_data,
    )

    X_graph     = X_scaled          # already reset_index above
    X_graph_enc = X_encoded.reset_index(drop=True)

    all_edges = (
        build_knn_edges(X_graph.select_dtypes(include=[np.number]).values, k=8)
        + build_branch_edges(X_graph_enc)
        + build_linked_edges(X_graph_enc)
    )

    n = len(X_graph)

    # Rebuild masks using positional integer index of full X_scaled
    all_idx = np.arange(n)
    _, test_pos = train_test_split(all_idx, test_size=0.15, random_state=42,
                                   stratify=y.values)
    train_val_pos = np.setdiff1d(all_idx, test_pos)
    y_tv = y.values[train_val_pos]
    train_rel, val_rel = train_test_split(
        np.arange(len(train_val_pos)), test_size=0.15, random_state=42, stratify=y_tv,
    )
    train_pos = train_val_pos[train_rel]
    val_pos   = train_val_pos[val_rel]

    train_mask = np.zeros(n, dtype=bool)
    val_mask   = np.zeros(n, dtype=bool)
    test_mask  = np.zeros(n, dtype=bool)
    train_mask[train_pos] = True
    val_mask[val_pos]     = True
    test_mask[test_pos]   = True

    import torch
    from models.gnn.train_gnn import train_gnn, get_gnn_scores
    pyg_data  = to_pyg_data(X_graph, y, all_edges, train_mask, val_mask, test_mask)
    gnn_epochs = 5 if dry_run else 450
    gnn_model  = train_gnn(pyg_data, epochs=gnn_epochs)
    gnn_all_scores = get_gnn_scores(gnn_model, pyg_data)
    gnn_val_scores = gnn_all_scores[val_mask]

    # ── Step 9: Meta-learner ──────────────────────────────────
    logger.info("\n[9/12] Training meta-learner (stacker) ...")
    from models.ensemble.stacker import build_meta_features, train_meta_learner
    meta_X     = build_meta_features(xgb_val_probs, lgbm_val_probs, cat_val_probs, gnn_val_scores)
    meta_model = train_meta_learner(meta_X, y_val.values)

    # ── Step 9b: VAE ──────────────────────────────────────────
    logger.info("\n[9b/12] Training VAE on legitimate accounts ...")
    from models.anomaly.vae import train_vae
    legit_mask   = y_train_bal == 0
    X_legit      = X_train_bal[legit_mask].select_dtypes(include=[np.number]).values
    vae_epochs   = 5 if dry_run else 100
    train_vae(X_legit.astype(np.float32), epochs=vae_epochs)

    # ── Step 10: Ring detection ───────────────────────────────
    logger.info("\n[10/12] Detecting mule rings ...")
    import networkx as nx
    from models.gnn.ring_detector import (
        build_networkx_graph, detect_all_rings, save_rings_to_artifacts,
    )
    account_ids = [f"ACC-{i:06d}" for i in range(n)]
    G = build_networkx_graph(
        all_edges,
        account_ids,
        risk_scores={account_ids[i]: float(gnn_all_scores[i]) for i in range(n)},
    )
    rings = detect_all_rings(G, account_ids, gnn_scores=gnn_all_scores)
    save_rings_to_artifacts(rings)

    # ── Step 11: Community detection ─────────────────────────
    logger.info("\n[11/12] Running Louvain community detection ...")
    from models.community.louvain import detect_communities
    community_data = detect_communities(
        G, account_ids, gnn_scores=gnn_all_scores, labels=y.values
    )

    # ── Step 12: Evaluate ─────────────────────────────────────
    logger.info("\n[12/12] Final evaluation on test set ...")
    xgb_test  = xgb_model.predict_proba(X_test)[:, 1]
    lgbm_test = lgbm_model.predict_proba(X_test)[:, 1]
    cat_test  = cat_model.predict_proba(X_test)[:, 1]
    gnn_test  = gnn_all_scores[test_mask]

    meta_test_X    = build_meta_features(xgb_test, lgbm_test, cat_test, gnn_test)
    ensemble_probs = meta_model.predict_proba(meta_test_X)[:, 1]

    # ── FIX: Find optimal threshold on VALIDATION set ─────────
    # Default 0.5 is wrong for 0.89% fraud rate — precision_recall_curve
    # finds the threshold that maximises F1 on the held-out validation set.
    logger.info("\n[12a] Finding optimal decision threshold on validation set ...")
    val_meta_X     = build_meta_features(xgb_val_probs, lgbm_val_probs, cat_val_probs, gnn_val_scores)
    val_ens_probs  = meta_model.predict_proba(val_meta_X)[:, 1]

    val_precision, val_recall, val_thresholds = precision_recall_curve(
        y_val.values, val_ens_probs
    )
    # F1 at each threshold (avoid division by zero)
    val_f1_scores = (
        2 * val_precision * val_recall
        / np.where((val_precision + val_recall) == 0, 1e-9, (val_precision + val_recall))
    )
    # precision_recall_curve returns len(thresholds) == len(precision) - 1
    # so we take the slice [:-1] of precision/recall to align with thresholds
    val_f1_aligned = val_f1_scores[:-1]  # drop the last sentinel point

    if len(val_f1_aligned) > 0:
        best_idx          = int(np.argmax(val_f1_aligned))
        optimal_threshold = float(val_thresholds[best_idx])
        logger.info(
            f"Optimal threshold: {optimal_threshold:.4f} "
            f"(val precision={val_precision[best_idx]:.3f}, "
            f"recall={val_recall[best_idx]:.3f}, "
            f"F1={val_f1_aligned[best_idx]:.3f})"
        )
    else:
        optimal_threshold = 0.5
        logger.warning("Could not compute optimal threshold — falling back to 0.5")

    # ── Evaluate test set with optimal threshold ──────────────
    auc   = roc_auc_score(y_test, ensemble_probs)
    preds = (ensemble_probs >= optimal_threshold).astype(int)
    f1    = f1_score(y_test, preds, zero_division=0)
    prec  = precision_score(y_test, preds, zero_division=0)
    rec   = recall_score(y_test, preds, zero_division=0)
    cm    = confusion_matrix(y_test, preds).tolist()

    logger.info(
        f"Test results with optimal threshold {optimal_threshold:.4f}: "
        f"AUC={auc:.4f} | F1={f1:.4f} | Precision={prec:.4f} | Recall={rec:.4f}"
    )

    # Also log what 0.5 would give, for comparison
    preds_05 = (ensemble_probs >= 0.5).astype(int)
    f1_05    = f1_score(y_test, preds_05, zero_division=0)
    logger.info(f"For reference — F1 at threshold 0.5: {f1_05:.4f}")

    report = {
        "auc":               round(auc, 4),
        "f1":                round(f1, 4),
        "precision":         round(prec, 4),
        "recall":            round(rec, 4),
        "optimal_threshold": round(optimal_threshold, 6),
        "confusion_matrix":  cm,
        "n_train":           len(X_train_bal),
        "n_test":            len(X_test),
        "fraud_rate":        round(fraud_rate, 4),
    }

    with open(ARTIFACTS_DIR / "eval_report.json", "w") as f:
        json.dump(report, f, indent=2)

    with open(ARTIFACTS_DIR / "model_meta.json", "w") as f:
        json.dump({
            "version":       "1.0.0",
            "n_features":    len(final_feature_names),
            "training_rows": len(X_train_bal),
        }, f, indent=2)

    elapsed = (time.time() - start) / 60
    logger.info(f"\n{'='*60}")
    logger.info(f"TRAINING COMPLETE in {elapsed:.1f} minutes")
    logger.info(f"Test AUC: {auc:.4f} | F1: {f1:.4f} | Precision: {prec:.4f} | Recall: {rec:.4f}")
    logger.info(f"Optimal threshold: {optimal_threshold:.4f}")
    logger.info(f"Rings detected: {len(rings)}")
    logger.info(f"Communities: {community_data.get('n_communities', '?')}")
    logger.info(f"{'='*60}\n")

    return report


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="../data/dataset.xlsx")
    parser.add_argument("--nrows", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run_full_pipeline(dataset_path=args.dataset, nrows=args.nrows, dry_run=args.dry_run)