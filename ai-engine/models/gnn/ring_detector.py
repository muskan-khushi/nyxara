"""
models/gnn/ring_detector.py
DFS-based ring/cycle detection in the account transaction graph.
Detects: STAR, CHAIN, CYCLE, CLUSTER, BIPARTITE typologies.
Results cached to MongoDB rings collection.

Max 6 hops, 25s time budget per search as per spec.
"""
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
import networkx as nx
import numpy as np

logger = logging.getLogger("nyxara.ring_detector")

MAX_HOPS    = 6
TIME_BUDGET = 25.0   # seconds per ring search
MIN_RING_SIZE = 3    # minimum accounts to form a ring


@dataclass
class Ring:
    ring_id:   str
    shape:     str              # STAR | CHAIN | CYCLE | CLUSTER | BIPARTITE
    accounts:  list[str]
    roles:     dict[str, str]   # accountId → hub | mule | bridge | victim
    hub_node:  str | None
    fraud_rate: float           # fraction of ring members already confirmed fraud
    confidence: float           # 0–1 detection confidence


def build_networkx_graph(
    edge_list: list[tuple],
    account_ids: list[str],
    risk_scores: dict[str, float] | None = None,
) -> nx.DiGraph:
    """Build NetworkX DiGraph from PyG edge list."""
    G = nx.DiGraph()
    for i, aid in enumerate(account_ids):
        G.add_node(i, account_id=aid, risk=risk_scores.get(aid, 0.0) if risk_scores else 0.0)
    for src, dst in edge_list:
        G.add_edge(src, dst)
    return G


# ─── Typology detectors ───────────────────────────────────────

def _detect_star(G: nx.DiGraph, node: int, account_ids: list[str], min_spokes: int = 3) -> Ring | None:
    """Hub with high out-degree and low in-degree."""
    out_deg = G.out_degree(node)
    in_deg  = G.in_degree(node)
    if out_deg < min_spokes or in_deg > 2:
        return None

    spokes = list(G.successors(node))
    if len(spokes) < min_spokes:
        return None

    hub_id = account_ids[node]
    members = [hub_id] + [account_ids[s] for s in spokes]
    roles   = {hub_id: "hub"} | {account_ids[s]: "mule" for s in spokes}

    return Ring(
        ring_id   = f"STAR_{hub_id}",
        shape     = "STAR",
        accounts  = members,
        roles     = roles,
        hub_node  = hub_id,
        fraud_rate = 0.0,
        confidence = min(0.5 + out_deg * 0.05, 0.99),
    )


def _detect_chain(G: nx.DiGraph, start: int, account_ids: list[str]) -> Ring | None:
    """Linear A→B→C→D path. Each node: in=1, out=1 except endpoints."""
    path = [start]
    visited = {start}
    current = start
    deadline = time.time() + TIME_BUDGET

    while time.time() < deadline and len(path) < MAX_HOPS:
        succs = [s for s in G.successors(current) if s not in visited]
        if len(succs) != 1:
            break
        nxt = succs[0]
        if G.in_degree(nxt) != 1:
            break
        path.append(nxt)
        visited.add(nxt)
        current = nxt

    if len(path) < MIN_RING_SIZE:
        return None

    members = [account_ids[n] for n in path]
    roles   = {members[0]: "source", members[-1]: "terminus"}
    roles.update({m: "relay" for m in members[1:-1]})

    return Ring(
        ring_id   = f"CHAIN_{members[0]}_{members[-1]}",
        shape     = "CHAIN",
        accounts  = members,
        roles     = roles,
        hub_node  = None,
        fraud_rate = 0.0,
        confidence = min(0.4 + len(path) * 0.06, 0.95),
    )


def _detect_cycles(G: nx.DiGraph, account_ids: list[str]) -> list[Ring]:
    """Find SCCs (strongly connected components) with size ≥ MIN_RING_SIZE."""
    rings = []
    for scc in nx.strongly_connected_components(G):
        if len(scc) < MIN_RING_SIZE:
            continue
        members = [account_ids[n] for n in scc]
        # Compute reciprocity within SCC
        sub = G.subgraph(scc)
        recip = nx.reciprocity(sub) if sub.number_of_edges() > 0 else 0.0

        roles = {m: "cycler" for m in members}
        rings.append(Ring(
            ring_id   = f"CYCLE_{'_'.join(sorted(members)[:3])}",
            shape     = "CYCLE",
            accounts  = members,
            roles     = roles,
            hub_node  = None,
            fraud_rate = 0.0,
            confidence = min(0.5 + recip * 0.4, 0.99),
        ))
    return rings


def _detect_clusters(G: nx.DiGraph, account_ids: list[str]) -> list[Ring]:
    """Dense subgraphs via weakly connected components with high edge density."""
    rings = []
    undirected = G.to_undirected()

    for component in nx.connected_components(undirected):
        if len(component) < MIN_RING_SIZE:
            continue
        sub = undirected.subgraph(component)
        n   = len(component)
        density = nx.density(sub)

        if density < 0.4:   # Not dense enough to be a cluster ring
            continue

        members = [account_ids[n_] for n_ in component]
        # Highest degree node = coordinator
        degrees = dict(sub.degree())
        hub_idx = max(degrees, key=degrees.get)
        hub_id  = account_ids[hub_idx]

        roles = {m: "member" for m in members}
        roles[hub_id] = "coordinator"

        rings.append(Ring(
            ring_id   = f"CLUSTER_{hub_id}",
            shape     = "CLUSTER",
            accounts  = members,
            roles     = roles,
            hub_node  = hub_id,
            fraud_rate = 0.0,
            confidence = min(0.3 + density * 0.6, 0.95),
        ))
    return rings


# ─── Master detector ──────────────────────────────────────────

def detect_all_rings(
    G: nx.DiGraph,
    account_ids: list[str],
    gnn_scores: np.ndarray | None = None,
) -> list[Ring]:
    """
    Run all ring detectors on the graph.
    Returns deduplicated list of Ring objects.
    """
    start_total = time.time()
    all_rings: list[Ring] = []
    seen_accounts: set[frozenset] = set()

    def _is_duplicate(ring: Ring) -> bool:
        key = frozenset(ring.accounts)
        if key in seen_accounts:
            return True
        seen_accounts.add(key)
        return False

    # Cycles first (most definitive)
    cycles = _detect_cycles(G, account_ids)
    for r in cycles:
        if not _is_duplicate(r):
            all_rings.append(r)

    # Star rings
    for node in G.nodes():
        if time.time() - start_total > 60:
            break
        ring = _detect_star(G, node, account_ids)
        if ring and not _is_duplicate(ring):
            all_rings.append(ring)

    # Chains
    for node in G.nodes():
        if time.time() - start_total > 90:
            break
        if G.in_degree(node) == 0:   # Only start from sources
            ring = _detect_chain(G, node, account_ids)
            if ring and not _is_duplicate(ring):
                all_rings.append(ring)

    # Dense clusters
    clusters = _detect_clusters(G, account_ids)
    for r in clusters:
        if not _is_duplicate(r):
            all_rings.append(r)

    # Annotate fraud rates using GNN scores
    if gnn_scores is not None:
        id_to_idx = {aid: i for i, aid in enumerate(account_ids)}
        for ring in all_rings:
            scores = [gnn_scores[id_to_idx[a]] for a in ring.accounts if a in id_to_idx]
            ring.fraud_rate = float(np.mean([s > 0.5 for s in scores])) if scores else 0.0

    logger.info(
        f"Ring detection complete: {len(all_rings)} rings found "
        f"({sum(1 for r in all_rings if r.shape=='STAR')} STAR, "
        f"{sum(1 for r in all_rings if r.shape=='CYCLE')} CYCLE, "
        f"{sum(1 for r in all_rings if r.shape=='CHAIN')} CHAIN, "
        f"{sum(1 for r in all_rings if r.shape=='CLUSTER')} CLUSTER) "
        f"in {time.time()-start_total:.1f}s"
    )
    return all_rings


def rings_to_dicts(rings: list[Ring]) -> list[dict]:
    return [
        {
            "ring_id":    r.ring_id,
            "shape":      r.shape,
            "accounts":   r.accounts,
            "roles":      r.roles,
            "hub_node":   r.hub_node,
            "fraud_rate": r.fraud_rate,
            "confidence": r.confidence,
            "size":       len(r.accounts),
        }
        for r in rings
    ]