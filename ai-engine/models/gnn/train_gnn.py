"""
models/gnn/train_gnn.py
Training loop for NyxaraGNN.
AUC-based early stopping. Saves best model checkpoint.
~20-30 minutes on CPU for 9K nodes.
"""
import json
import logging
from pathlib import Path
import numpy as np
import torch
import torch.nn.functional as F
from torch_geometric.data import Data
from sklearn.metrics import roc_auc_score

from models.gnn.model import NyxaraGNN

logger = logging.getLogger("nyxara.train_gnn")
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"


def train_gnn(
    data: Data,
    hidden_channels: int = 128,
    lr: float = 0.001,
    epochs: int = 450,
    patience: int = 30,
    weight_decay: float = 1e-4,
) -> NyxaraGNN:
    """
    Train NyxaraGNN with AUC early stopping.
    Returns best model (by validation AUC).
    """
    in_channels = data.x.shape[1]

    model = NyxaraGNN(
        in_channels=in_channels,
        hidden_channels=hidden_channels,
    )

    # Class-weighted loss to handle imbalance
    n_pos = data.y[data.train_mask].sum().item()
    n_neg = (data.train_mask.sum() - n_pos).item()
    class_weight = torch.tensor([1.0, n_neg / max(n_pos, 1)], dtype=torch.float)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10, factor=0.5)

    best_val_auc = 0.0
    best_state = None
    patience_counter = 0

    logger.info(f"Starting GNN training: {epochs} epochs, {data.num_nodes} nodes, {data.num_edges} edges")

    for epoch in range(1, epochs + 1):
        # ── Train ────────────────────────────────────────────
        model.train()
        optimizer.zero_grad()
        out = model(data.x, data.edge_index)
        loss = F.cross_entropy(
            out[data.train_mask],
            data.y[data.train_mask],
            weight=class_weight,
        )
        loss.backward()
        optimizer.step()

        # ── Validate ─────────────────────────────────────────
        if epoch % 5 == 0 or epoch == epochs:
            model.eval()
            with torch.no_grad():
                val_out = model(data.x, data.edge_index)
                val_probs = F.softmax(val_out[data.val_mask], dim=1)[:, 1].numpy()
                val_labels = data.y[data.val_mask].numpy()

            try:
                val_auc = roc_auc_score(val_labels, val_probs)
            except ValueError:
                val_auc = 0.0

            scheduler.step(1 - val_auc)

            if epoch % 25 == 0:
                logger.info(f"Epoch {epoch:4d} | Loss: {loss.item():.4f} | Val AUC: {val_auc:.4f}")

            if val_auc > best_val_auc:
                best_val_auc = val_auc
                best_state = {k: v.clone() for k, v in model.state_dict().items()}
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    logger.info(f"Early stopping at epoch {epoch}. Best Val AUC: {best_val_auc:.4f}")
                    break

    # Load best state
    if best_state:
        model.load_state_dict(best_state)

    logger.info(f"GNN training complete. Best validation AUC: {best_val_auc:.4f}")

    # Save
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save({
        "model_state": model.state_dict(),
        "in_channels": in_channels,
        "hidden_channels": hidden_channels,
        "best_val_auc": best_val_auc,
    }, ARTIFACTS_DIR / "gnn_model.pth")

    return model


def load_gnn() -> NyxaraGNN:
    """Load saved GNN model."""
    checkpoint = torch.load(ARTIFACTS_DIR / "gnn_model.pth", map_location="cpu")
    model = NyxaraGNN(
        in_channels=checkpoint["in_channels"],
        hidden_channels=checkpoint["hidden_channels"],
    )
    model.load_state_dict(checkpoint["model_state"])
    model.eval()
    return model


def get_gnn_scores(model: NyxaraGNN, data: Data) -> np.ndarray:
    """Get fraud probabilities for all nodes."""
    model.eval()
    with torch.no_grad():
        out = model(data.x, data.edge_index)
        probs = F.softmax(out, dim=1)[:, 1].numpy()
    return probs