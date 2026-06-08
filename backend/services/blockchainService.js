// services/blockchainService.js
const axios    = require("axios");
const AuditLog = require("../models/AuditLog");
const CHAIN_URL = process.env.BLOCKCHAIN_URL || "http://localhost:8003";

async function commitDecision({ accountId, decision, riskScore }) {
  try {
    const { data } = await axios.post(`${CHAIN_URL}/v1/commit`, { accountId, decision, riskScore }, { timeout: 5000 });
    // Store audit entry locally too
    await AuditLog.create({
      accountId,
      decision,
      riskScore,
      decisionHash:    data.decision_hash,
      merkleLeafHash:  data.leaf_hash,
      blockchainBatchId: data.batch_id,
    }).catch(() => {}); // Ignore duplicate key (re-analysis)
    return data;
  } catch {
    return null; // Blockchain offline — don't fail the analysis
  }
}

module.exports = { commitDecision };