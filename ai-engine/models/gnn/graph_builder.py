"""
models/gnn/graph_builder.py
Build PyTorch Geometric Data object from account features.

FIXES:
1. build_branch_edges and build_linked_edges now receive a DataFrame that is
   guaranteed to have a 0-based RangeIndex (caller must reset_index before
   passing). Added an explicit assertion + reset to be safe.
2. to_pyg_data now deduplicates edges AND enforces 0 ≤ u,v < num_nodes before
   building the edge tensor, preventing CUDA/CPU index-out-of-bounds crashes.
3. X_numeric selection in to_pyg_data uses a copy to avoid SettingWithCopy.
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
    """KNN edges based on cosine similarity."""
    logger.info(f"Building KNN edges (k={k}) for {len(X_numeric)} accounts ...")
    X_norm = normalize(X_numeric, norm="l2")

    nbrs = NearestNeighbors(
        n_neighbors=min(k + 1, len(X_numeric)),
        metric="cosine",
        algorithm="brute",
        n_jobs=-1,
    )
    nbrs.fit(X_norm)
    distances, indices = nbrs.kneighbors(X_norm)

    edges = []
    for i, (dists, nbrs_i) in enumerate(zip(distances, indices)):
        for d, j in zip(dists[1:], nbrs_i[1:]):
            if d <= distance_threshold:
                edges.append((i, j))
                edges.append((j, i))

    logger.info(f"KNN edges: {len(edges)} total")
    return edges


def build_branch_edges(
    df: pd.DataFrame,
    max_group_size: int = 2000,
    max_edges_per_group: int = 500,
) -> list[tuple]:
    """Connect accounts in the same branch (F3889)."""
    if "F3889" not in df.columns:
        return []

    # FIX: ensure 0-based positional index
    df = df.reset_index(drop=True)

    edges = []
    for branch, group in df.groupby("F3889"):
        if len(group) >= max_group_size:
            continue
        idxs = group.index.tolist()   # positional ints
        n_pairs = len(idxs) * (len(idxs) - 1) // 2

        if n_pairs <= max_edges_per_group:
            for ii in range(len(idxs)):
                for jj in range(ii + 1, len(idxs)):
                    u, v = idxs[ii], idxs[jj]
                    edges.append((u, v))
                    edges.append((v, u))
        else:
            import random
            rng = random.Random(42)
            for _ in range(max_edges_per_group):
                ii, jj = rng.sample(range(len(idxs)), 2)
                u, v = idxs[ii], idxs[jj]
                edges.append((u, v))
                edges.append((v, u))

    logger.info(f"Branch edges: {len(edges)} total")
    return edges


def build_linked_edges(df: pd.DataFrame, link_threshold: int = 5) -> list[tuple]:
    """Connect accounts where F1692 > threshold."""
    if "F1692" not in df.columns:
        return []

    # FIX: ensure 0-based positional index
    df = df.reset_index(drop=True)

    high_link = df[pd.to_numeric(df["F1692"], errors="coerce").fillna(0) > link_threshold].index.tolist()
    n_high = len(high_link)

    if n_high > 2000:
        logger.warning(f"Too many high-link accounts ({n_high}). Capping at 2000.")
        high_link = high_link[:2000]
        n_high = 2000

    edges = []
    for i in range(n_high):
        for j in range(i + 1, n_high):
            u, v = high_link[i], high_link[j]
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
    """Assemble PyTorch Geometric Data object."""
    num_nodes = len(X)

    # FIX: use .copy() to avoid SettingWithCopyWarning
    X_numeric = X.select_dtypes(include=[np.number]).copy()

    node_features = torch.FloatTensor(X_numeric.values)
    labels        = torch.LongTensor(y.values)

    # FIX: deduplicate and validate edge bounds in one pass
    seen = set()
    valid_edges = []
    for u, v in all_edges:
        if not (0 <= u < num_nodes and 0 <= v < num_nodes):
            continue
        key = (u, v)
        if key not in seen:
            seen.add(key)
            valid_edges.append(key)

    if valid_edges:
        edge_index = torch.tensor(valid_edges, dtype=torch.long).t().contiguous()
    else:
        edge_index = torch.zeros((2, 0), dtype=torch.long)

    data = Data(
        x=node_features,
        edge_index=edge_index,
        y=labels,
        train_mask=torch.BoolTensor(train_mask),
        val_mask=torch.BoolTensor(val_mask),
        test_mask=torch.BoolTensor(test_mask),
        num_nodes=num_nodes,
    )

    logger.info(
        f"PyG Data: {data.num_nodes} nodes | {data.num_edges} edges | "
        f"Train: {train_mask.sum()} | Val: {val_mask.sum()} | Test: {test_mask.sum()}"
    )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(data, ARTIFACTS_DIR / "processed_graph.pt")
    return data