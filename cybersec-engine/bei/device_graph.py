"""bei/device_graph.py — Track which devices control which accounts"""
import logging
import networkx as nx

logger = logging.getLogger("nyxara.device_graph")

# In-memory bipartite graph: device_fp ↔ account_id
# Persist to MongoDB in production
_G = nx.DiGraph()


def record_access(fp32: str, account_id: str):
    fp_node   = f"fp:{fp32}"
    acct_node = f"acct:{account_id}"
    _G.add_edge(fp_node, acct_node)


def get_device_controlled_accounts(fp32: str) -> list[str]:
    fp_node = f"fp:{fp32}"
    if fp_node not in _G:
        return []
    return [n.replace("acct:", "") for n in _G.successors(fp_node)]


def get_controller_risk_score(fp32: str) -> float:
    """High degree fingerprint node = probable mule controller."""
    accounts = get_device_controlled_accounts(fp32)
    n = len(accounts)
    if n >= 10: return 1.0
    if n >= 5:  return 0.7
    if n >= 3:  return 0.4
    return 0.0