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


def build_branch_edges(df: pd.DataFrame, max_group_size: int = 50) -> list[tuple]:
    """
    Connect accounts in the same branch (F3889).
    Only for groups < max_group_size to avoid spurious hubs.
    """
    if "F3889" not in df.columns:
        return []

    edges = []
    for branch, group in df.groupby("F3889"):
        if len(group) >= max_group_size:
            continue
        idxs = group.index.tolist()
        for i in range(len(idxs)):
            for j in range(i + 1, len(idxs)):
                edges.append((idxs[i], idxs[j]))
                edges.append((idxs[j], idxs[i]))

    logger.info(f"Branch edges: {len(edges)} total")
    return edges


def build_linked_edges(df: pd.DataFrame, link_threshold: int = 5) -> list[tuple]:
    """
    Connect accounts where F1692 (linked accounts) > threshold.
    These are explicitly bank-flagged as linked.
    """
    if "F1692" not in df.columns:
        return []

    high_link = df[df["F1692"] > link_threshold].index.tolist()
    edges = []
    for i in range(len(high_link)):
        for j in range(i + 1, len(high_link)):
            edges.append((high_link[i], high_link[j]))
            edges.append((high_link[j], high_link[i]))

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

    # Deduplicate and build edge index
    unique_edges = list(set(all_edges))
    if unique_edges:
        edge_index = torch.LongTensor(unique_edges).t().contiguous()
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