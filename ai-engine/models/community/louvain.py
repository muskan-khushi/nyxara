"""
models/community/louvain.py
Louvain community detection on the account graph.
Assigns community_fraud_rate to each account — guilt by association.
Feeds risk_cluster_membership composite feature.
"""
import json
import logging
from pathlib import Path
import numpy as np
import networkx as nx

logger = logging.getLogger("nyxara.louvain")

ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"

try:
    import community as community_louvain   # python-louvain package
    LOUVAIN_AVAILABLE = True
except ImportError:
    LOUVAIN_AVAILABLE = False
    logger.warning("python-louvain not installed. pip install python-louvain. Falling back to greedy modularity.")


def detect_communities(
    G: nx.DiGraph,
    account_ids: list[str],
    gnn_scores: np.ndarray | None = None,
    labels: np.ndarray | None = None,
) -> dict:
    """
    Run Louvain community detection.

    Returns:
        {
          "account_community": {account_id: community_id},
          "community_fraud_rate": {community_id: float},
          "community_sizes": {community_id: int},
          "account_fraud_rate": {account_id: float},  ← the key output
        }
    """
    undirected = G.to_undirected()

    # Remove isolates for cleaner communities
    isolates = list(nx.isolates(undirected))
    undirected.remove_nodes_from(isolates)

    if undirected.number_of_nodes() == 0:
        logger.warning("Graph has no edges after removing isolates — communities empty.")
        return _empty_result(account_ids)

    # Run Louvain (or fallback)
    if LOUVAIN_AVAILABLE:
        partition = community_louvain.best_partition(undirected, resolution=1.0, random_state=42)
    else:
        # Greedy modularity fallback
        communities = nx.algorithms.community.greedy_modularity_communities(undirected)
        partition   = {}
        for cid, comm in enumerate(communities):
            for node in comm:
                partition[node] = cid

    # Map node index → account_id
    account_community: dict[str, int] = {}
    for node, cid in partition.items():
        if node < len(account_ids):
            account_community[account_ids[node]] = cid

    # Assign isolated nodes to their own singleton community
    max_cid = max(partition.values()) if partition else 0
    for node in isolates:
        if node < len(account_ids):
            max_cid += 1
            account_community[account_ids[node]] = max_cid

    # Compute fraud rate per community
    community_members: dict[int, list[str]] = {}
    for aid, cid in account_community.items():
        community_members.setdefault(cid, []).append(aid)

    id_to_idx = {aid: i for i, aid in enumerate(account_ids)}

    community_fraud_rate: dict[int, float] = {}
    for cid, members in community_members.items():
        if gnn_scores is not None:
            scores = [float(gnn_scores[id_to_idx[a]]) for a in members if a in id_to_idx]
            rate   = float(np.mean([s > 0.5 for s in scores])) if scores else 0.0
        elif labels is not None:
            labs   = [int(labels[id_to_idx[a]]) for a in members if a in id_to_idx]
            rate   = float(np.mean(labs)) if labs else 0.0
        else:
            rate   = 0.0
        community_fraud_rate[cid] = rate

    # Account-level fraud rate = their community's fraud rate
    account_fraud_rate = {aid: community_fraud_rate[cid] for aid, cid in account_community.items()}
    community_sizes    = {cid: len(members) for cid, members in community_members.items()}

    n_communities = len(community_members)
    logger.info(
        f"Louvain: {n_communities} communities detected | "
        f"Largest: {max(community_sizes.values())} accounts | "
        f"High-fraud communities (>50%): {sum(1 for r in community_fraud_rate.values() if r > 0.5)}"
    )

    result = {
        "account_community":    account_community,
        "community_fraud_rate": {str(k): v for k, v in community_fraud_rate.items()},
        "community_sizes":      {str(k): v for k, v in community_sizes.items()},
        "account_fraud_rate":   account_fraud_rate,
        "n_communities":        n_communities,
    }

    # Save to artifacts
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "community_data.json", "w") as f:
        json.dump(result, f)

    return result


def load_community_data() -> dict:
    path = ARTIFACTS_DIR / "community_data.json"
    if not path.exists():
        return {}
    with open(path) as f:
        return json.load(f)


def get_account_community_fraud_rate(account_id: str) -> float:
    """Fast lookup: get community fraud rate for a single account."""
    data = load_community_data()
    return data.get("account_fraud_rate", {}).get(account_id, 0.0)


def _empty_result(account_ids: list[str]) -> dict:
    return {
        "account_community":    {aid: 0 for aid in account_ids},
        "community_fraud_rate": {"0": 0.0},
        "community_sizes":      {"0": len(account_ids)},
        "account_fraud_rate":   {aid: 0.0 for aid in account_ids},
        "n_communities":        1,
    }


def get_community_report() -> list[dict]:
    """Return sorted community summary for the /v1/clusters API endpoint."""
    data = load_community_data()
    if not data:
        return []

    sizes  = data.get("community_sizes", {})
    rates  = data.get("community_fraud_rate", {})

    report = []
    for cid in sizes:
        report.append({
            "community_id":    cid,
            "size":            sizes[cid],
            "fraud_rate":      rates.get(cid, 0.0),
            "risk_level":      "HIGH" if rates.get(cid, 0) > 0.5 else "MEDIUM" if rates.get(cid, 0) > 0.2 else "LOW",
        })

    return sorted(report, key=lambda x: x["fraud_rate"], reverse=True)