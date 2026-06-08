"""api/routes.py — Blockchain Audit routes"""
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
    return ledger.commit(payload.accountId, payload.decision, payload.riskScore)


@router.get("/v1/audit/{account_id}")
async def get_audit(account_id: str):
    return {"accountId": account_id, "entries": ledger.get_audit_trail(account_id)}


@router.get("/v1/verify")
async def verify():
    return ledger.verify_chain()


@router.get("/v1/merkle-root")
async def merkle_root():
    latest = ledger.batches_col.find_one(sort=[("timestamp", -1)])
    if not latest:
        return {"merkleRoot": None, "message": "No batches sealed yet"}
    return {"batchId": latest["batchId"], "merkleRoot": latest["merkleRoot"], "leafCount": latest["leafCount"]}


@router.get("/health")
async def health():
    return {"status": "ok", "service": "nyxara-blockchain-audit"}