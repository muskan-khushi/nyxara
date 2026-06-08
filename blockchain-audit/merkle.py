"""merkle.py — Merkle tree for tamper-evident audit batches"""
import hashlib


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


def build_merkle_tree(leaves: list[str]) -> dict:
    """
    Build Merkle tree from leaf hashes.
    Returns {root, levels} where levels[0] = leaves.
    """
    if not leaves:
        return {"root": "", "levels": []}

    current = list(leaves)
    levels  = [current]

    while len(current) > 1:
        if len(current) % 2 == 1:
            current.append(current[-1])  # Duplicate last if odd
        current = [_sha256(current[i] + current[i + 1]) for i in range(0, len(current), 2)]
        levels.append(current)

    return {"root": current[0], "levels": levels}


def compute_leaf_hash(account_id: str, risk_score: float, decision: str, timestamp: str) -> str:
    raw = f"{account_id}|{risk_score:.6f}|{decision}|{timestamp}"
    return _sha256(raw)


def verify_leaf(
    stored_hash: str,
    account_id: str,
    risk_score: float,
    decision: str,
    timestamp: str,
) -> bool:
    recomputed = compute_leaf_hash(account_id, risk_score, decision, timestamp)
    return recomputed == stored_hash