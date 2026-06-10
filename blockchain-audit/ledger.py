"""
ledger.py — Commit decisions + batch Merkle every 50 entries (async motor)

FIXES:
1. Original commit() was not async — motor requires `await` on all collection
   operations. Added `async def` and `await` throughout.
2. get_audit_trail / verify_chain were missing `async def`.
3. commit() now returns the result dict correctly in all code paths.
"""
import os
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

from merkle import compute_leaf_hash, build_merkle_tree

logger = logging.getLogger("nyxara.ledger")

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/nyxara")
client        = AsyncIOMotorClient(MONGO_URI)
db            = client.get_default_database()

decisions_col = db["audit_decisions"]
batches_col   = db["audit_batches"]

BATCH_SIZE = 50


async def commit(account_id: str, decision: str, risk_score: float) -> dict:
    ts        = datetime.now(timezone.utc).isoformat()
    leaf_hash = compute_leaf_hash(account_id, risk_score, decision, ts)

    doc = {
        "accountId": account_id,
        "decision":  decision,
        "riskScore": risk_score,
        "leafHash":  leaf_hash,
        "timestamp": ts,
        "batchId":   None,
    }
    await decisions_col.insert_one(doc)

    # Check if batch threshold reached
    unbatched = await decisions_col.find({"batchId": None}).to_list(length=None)
    batch_id  = None
    if len(unbatched) >= BATCH_SIZE:
        leaves   = [d["leafHash"] for d in unbatched]
        tree     = build_merkle_tree(leaves)
        # FIX: await the count query
        n_batches = await batches_col.count_documents({})
        batch_id  = f"batch_{n_batches + 1}"
        await batches_col.insert_one({
            "batchId":     batch_id,
            "merkleRoot":  tree["root"],
            "leafCount":   len(leaves),
            "decisionIds": [str(d["_id"]) for d in unbatched],
            "timestamp":   ts,
        })
        await decisions_col.update_many(
            {"batchId": None},
            {"$set": {"batchId": batch_id}},
        )
        logger.info(f"Merkle batch {batch_id} sealed. Root: {tree['root'][:16]}...")

    return {
        "decision_hash": leaf_hash,
        "leaf_hash":     leaf_hash,
        "batch_id":      batch_id,
        "timestamp":     ts,
    }


async def get_audit_trail(account_id: str) -> list:
    cursor = decisions_col.find({"accountId": account_id}, {"_id": 0}).sort("timestamp", -1)
    return await cursor.to_list(length=None)


async def verify_chain() -> dict:
    """Recompute all leaf hashes and compare to stored. Return tamper report."""
    all_docs = await decisions_col.find({}, {"_id": 0}).to_list(length=None)
    tampered = []
    for doc in all_docs:
        recomputed = compute_leaf_hash(
            doc["accountId"], doc["riskScore"], doc["decision"], doc["timestamp"]
        )
        if recomputed != doc["leafHash"]:
            tampered.append({"accountId": doc["accountId"], "timestamp": doc["timestamp"]})
    return {
        "total":            len(all_docs),
        "tampered":         len(tampered),
        "tampered_entries": tampered,
        "integrity":        len(tampered) == 0,
    }