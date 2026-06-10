"""
models/gnn/graph_builder.py
Build PyTorch Geometric Data object from account features.
Three edge types: KNN similarity + branch clustering + linked accounts.
"""
import logging
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from torch_geometric.data import Data
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import normalize

logger = logging.getLogger("nyxara.graph_builder")
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"


def build_knn_edges(X_numeric: np.ndarray, k: int = 8, distance_threshold: float = 0.3) -> list[tuple]:
    """
    KNN edges based on cosine similarity in feature space.
    Accounts with similar financial behavior are connected.
    """
    logger.info(f"Building KNN edges (k={k}) for {len(X_numeric)} accounts ...")
    X_norm = normalize(X_numeric, norm="l2")

    nbrs = NearestNeighbors(n_neighbors=k + 1, metric="cosine", algorithm="brute", n_jobs=-1)
    nbrs.fit(X_norm)
    distances, indices = nbrs.kneighbors(X_norm)

    edges = []
    for i, (dists, nbrs_i) in enumerate(zip(distances, indices)):
        for d, j in zip(dists[1:], nbrs_i[1:]):  # Skip self (index 0)
            if d <= distance_threshold:
                edges.append((i, j))
                edges.append((j, i))  # Bidirectional

    logger.info(f"KNN edges: {len(edges)} total")
    return edges


def build_branch_edges(df: pd.DataFrame, max_group_size: int = 2000, max_edges_per_group: int = 500) -> list[tuple]:
    """
    Connect accounts in the same branch (F3889).
    For groups > max_edges_per_group pairs, sample random edges to avoid O(n^2).
    Groups > max_group_size are skipped entirely.
    """
    if "F3889" not in df.columns:
        return []

    idx_to_pos = {idx: pos for pos, idx in enumerate(df.index)}
    edges = []
    for branch, group in df.groupby("F3889"):
        if len(group) >= max_group_size:
            continue
        idxs = group.index.tolist()
        n_pairs = len(idxs) * (len(idxs) - 1) // 2

        if n_pairs <= max_edges_per_group:
            # Small group — connect all pairs
            for i in range(len(idxs)):
                for j in range(i + 1, len(idxs)):
                    pos_i = idx_to_pos[idxs[i]]
                    pos_j = idx_to_pos[idxs[j]]
                    edges.append((pos_i, pos_j))
                    edges.append((pos_j, pos_i))
        else:
            # Large group — sample random edges
            import random
            rng = random.Random(42)
            for _ in range(max_edges_per_group):
                i, j = rng.sample(range(len(idxs)), 2)
                pos_i = idx_to_pos[idxs[i]]
                pos_j = idx_to_pos[idxs[j]]
                edges.append((pos_i, pos_j))
                edges.append((pos_j, pos_i))

    logger.info(f"Branch edges: {len(edges)} total")
    return edges


def build_linked_edges(df: pd.DataFrame, link_threshold: int = 5) -> list[tuple]:
    """
    Connect accounts where F1692 (linked accounts) > threshold.
    These are explicitly bank-flagged as linked.
    """
    if "F1692" not in df.columns:
        return []

    idx_to_pos = {idx: pos for pos, idx in enumerate(df.index)}
    high_link = df[df["F1692"] > link_threshold].index.tolist()
    high_link_positions = [idx_to_pos[idx] for idx in high_link if idx in idx_to_pos]

    n_high = len(high_link_positions)
    if n_high > 2000:
        logger.warning(f"Too many high-link accounts ({n_high}). Bounding edge construction to prevent O(n^2) blowup.")
        high_link_positions = high_link_positions[:2000]
        n_high = 2000

    edges = []
    for i in range(n_high):
        for j in range(i + 1, n_high):
            u, v = high_link_positions[i], high_link_positions[j]
            edges.append((u, v))
            edges.append((v, u))

    logger.info(f"Linked account edges: {len(edges)} total")
    return edges


def to_pyg_data(
    X: pd.DataFrame,
    y: pd.Series,
    all_edges: list[tuple],
    train_mask: np.ndarray,
    val_mask: np.ndarray,
    test_mask: np.ndarray,
) -> Data:
    """
    Assemble PyTorch Geometric Data object.
    """
    # Only numeric features for GNN node features
    X_numeric = X.select_dtypes(include=[np.number])

    node_features = torch.FloatTensor(X_numeric.values)
    labels = torch.LongTensor(y.values)

    # Deduplicate and build edge index defensively
    num_nodes = len(X)
    valid_edges = []
    for u, v in set(all_edges):
        if 0 <= u < num_nodes and 0 <= v < num_nodes:
            valid_edges.append((u, v))
        else:
            logger.warning(f"Edge index out of bounds ignored: ({u}, {v}) for num_nodes={num_nodes}")

    if valid_edges:
        edge_index = torch.LongTensor(valid_edges).t().contiguous()
    else:
        edge_index = torch.zeros((2, 0), dtype=torch.long)

    data = Data(
        x=node_features,
        edge_index=edge_index,
        y=labels,
        train_mask=torch.BoolTensor(train_mask),
        val_mask=torch.BoolTensor(val_mask),
        test_mask=torch.BoolTensor(test_mask),
        num_nodes=len(X),
    )

    logger.info(
        f"PyG Data: {data.num_nodes} nodes | {data.num_edges} edges | "
        f"Train: {train_mask.sum()} | Val: {val_mask.sum()} | Test: {test_mask.sum()}"
    )

    # Save graph
    torch.save(data, ARTIFACTS_DIR / "processed_graph.pt")
    return data