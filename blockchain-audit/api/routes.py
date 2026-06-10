"""api/routes.py — Blockchain Audit routes

FIX: commit / get_audit_trail / verify_chain are all async; the route handlers
must await them. Original code called them without await, causing coroutine
objects to be returned instead of results.
"""
from fastapi import APIRouter
from pydantic import BaseModel
import ledger

router = APIRouter()


class CommitRequest(BaseModel):
    accountId: str
    decision:  str
    riskScore: float


@router.post("/v1/commit")
async def commit_decision(payload: CommitRequest):
    # FIX: await the async ledger function
    return await ledger.commit(payload.accountId, payload.decision, payload.riskScore)


@router.get("/v1/audit/{account_id}")
async def get_audit(account_id: str):
    entries = await ledger.get_audit_trail(account_id)
    return {"accountId": account_id, "entries": entries}


@router.get("/v1/verify")
async def verify():
    return await ledger.verify_chain()


@router.get("/v1/merkle-root")
async def merkle_root():
    latest = await ledger.batches_col.find_one(sort=[("timestamp", -1)])
    if not latest:
        return {"merkleRoot": None, "message": "No batches sealed yet"}
    return {
        "batchId":    latest["batchId"],
        "merkleRoot": latest["merkleRoot"],
        "leafCount":  latest["leafCount"],
    }


@router.get("/health")
async def health():
    return {"status": "ok", "service": "nyxara-blockchain-audit"}