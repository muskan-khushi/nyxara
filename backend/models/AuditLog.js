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
AuditLogSchema.index({ decisionHash: 1 }, { unique: true });

module.exports = mongoose.model("AuditLog", AuditLogSchema);


// models/User.js
const mongoose2 = require("mongoose");

const UserSchema = new mongoose2.Schema({
  email:        { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ["analyst", "admin", "compliance"], default: "analyst" },
  name:         String,
}, { timestamps: true });

UserSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose2.model("User", UserSchema);