// routes/compliance.js
const express   = require("express");
const router    = express.Router();
const Account   = require("../models/Account");
const Alert     = require("../models/Alert");
const AuditLog  = require("../models/AuditLog");

// GET /api/compliance/str/:alertId — generate STR draft
router.get("/str/:alertId", async (req, res, next) => {
  try {
    const alert   = await Alert.findById(req.params.alertId);
    if (!alert) return res.status(404).json({ error: "Alert not found" });

    const account = await Account.findOne({ accountId: alert.accountId });

    // Auto-fill STR fields from ML output
    const str = {
      reporting_entity:    process.env.BANK_NAME || "Nyxara Demo Bank",
      firc_code:           process.env.BANK_FIRC || "NXRA0001",
      account_id:          alert.accountId,
      account_type:        account?.features?.F3889 || "Unknown",
      customer_occupation: account?.features?.F3891 || "Unknown",
      risk_score:          alert.riskScore,
      str_type:            _classifySTRType(account),
      nature_of_suspicion: alert.alertText,
      risk_indicators:     _mapRiskIndicators(account),
      amount_involved:     account?.features?.F3836 || null,
      audit_hash:          null, // filled from blockchain
      observation_period:  "Last 90 days",
      generated_at:        new Date().toISOString(),
      requires_analyst_review: true,
    };

    // Fetch blockchain hash
    const auditEntry = await AuditLog.findOne({ accountId: alert.accountId }).sort({ createdAt: -1 });
    if (auditEntry) str.audit_hash = auditEntry.decisionHash;

    res.json(str);
  } catch (err) { next(err); }
});

// GET /api/compliance/audit/:accountId — full audit trail
router.get("/audit/:accountId", async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ accountId: req.params.accountId }).sort({ createdAt: -1 });
    res.json({ accountId: req.params.accountId, entries: logs });
  } catch (err) { next(err); }
});

function _classifySTRType(account) {
  if (!account) return "suspicious_activity";
  const features = account.features || {};
  if (features.F2082 > 0)        return "cross_border_layering";
  if (account.ringMembership)    return "mule_network";
  if (features.F2122 > 0.5)     return "structuring";
  return "suspicious_activity";
}

function _mapRiskIndicators(account) {
  const indicators = [];
  const f = account?.features || {};
  if (account?.ringMembership)          indicators.push("FATF-ML-01: Mule network ring membership");
  if (f.F527 > 0.9)                    indicators.push("FATF-ML-02: High pass-through ratio");
  if (f.F2082 > 0)                     indicators.push("FATF-ML-04: International transaction exposure");
  if (f.F3043 === null)                indicators.push("FATF-ML-06: Missing account history (ghost account)");
  if (f.F2122 > 0.4)                   indicators.push("FATF-ML-08: Structured cash deposits below CTR threshold");
  if (account?.riskScore > 0.85)       indicators.push("FATF-ML-10: Critical risk score — automated detection");
  return indicators;
}

module.exports = router;