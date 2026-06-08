"""
models/community/pagerank.py
PageRank α=0.85 hub scoring.
High PageRank + high out-degree = ring orchestrator.
High PageRank + low out-degree = money mule terminal.
"""
import json
import logging
from pathlib import Path
import numpy as np
import networkx as nx

logger = logging.getLogger("nyxara.pagerank")
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"


def compute_pagerank(
    G: nx.DiGraph,
    account_ids: list[str],
    alpha: float = 0.85,
    max_iter: int = 100,
) -> dict[str, float]:
    """
    Compute PageRank for all nodes.
    Returns {account_id: pagerank_score (normalized 0–1)}.
    """
    if G.number_of_nodes() == 0:
        return {}

    pr = nx.pagerank(G, alpha=alpha, max_iter=max_iter, tol=1e-6)

    # Map node index → account_id and normalize to [0, 1]
    raw = {account_ids[node]: score for node, score in pr.items() if node < len(account_ids)}

    if not raw:
        return {}

    max_pr = max(raw.values())
    min_pr = min(raw.values())
    span   = max_pr - min_pr or 1.0

    normalized = {aid: (score - min_pr) / span for aid, score in raw.items()}

    logger.info(
        f"PageRank computed for {len(normalized)} accounts. "
        f"Top hub score: {max_pr:.6f} | Mean: {np.mean(list(raw.values())):.6f}"
    )
    return normalized


def classify_node_role(
    account_id: str,
    pagerank_score: float,
    out_degree: int,
    in_degree: int,
    gnn_score: float = 0.0,
) -> str:
    """
    Classify account role in the network based on graph topology.
    Returns: orchestrator | hub | mule | bridge | terminal | legitimate
    """
    if pagerank_score > 0.8 and out_degree >= 5:
        return "orchestrator"
    if pagerank_score > 0.6 and out_degree >= 3:
        return "hub"
    if pagerank_score > 0.4 and in_degree >= 2 and out_degree >= 2:
        return "bridge"
    if in_degree >= 2 and out_degree == 0:
        return "terminal"
    if gnn_score > 0.6:
        return "mule"
    return "legitimate"


def get_top_hubs(
    pagerank_scores: dict[str, float],
    account_ids: list[str],
    G: nx.DiGraph,
    top_n: int = 20,
) -> list[dict]:
    """Return top N hub accounts sorted by PageRank score."""
    id_to_idx = {aid: i for i, aid in enumerate(account_ids)}

    hubs = []
    for aid, pr in sorted(pagerank_scores.items(), key=lambda x: x[1], reverse=True)[:top_n]:
        idx      = id_to_idx.get(aid)
        out_deg  = G.out_degree(idx) if idx is not None else 0
        in_deg   = G.in_degree(idx)  if idx is not None else 0
        hubs.append({
            "account_id":     aid,
            "pagerank_score": round(pr, 4),
            "out_degree":     out_deg,
            "in_degree":      in_deg,
            "role":           classify_node_role(aid, pr, out_deg, in_deg),
        })

    # Save
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "pagerank_data.json", "w") as f:
        json.dump({"top_hubs": hubs, "scores": {k: round(v, 6) for k, v in pagerank_scores.items()}}, f)

    return hubs


def load_pagerank_scores() -> dict[str, float]:
    path = ARTIFACTS_DIR / "pagerank_data.json"
    if not path.exists():
        return {}
    with open(path) as f:
        return json.load(f).get("scores", {})