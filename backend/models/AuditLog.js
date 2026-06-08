// models/AuditLog.js
const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
  accountId:       { type: String, required: true },
  decision:        String,
  riskScore:       Number,
  decisionHash:    { type: String, unique: true },
  merkleLeafHash:  String,
  blockchainBatchId: String,
}, { timestamps: true });

AuditLogSchema.index({ accountId: 1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);