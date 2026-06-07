// models/Account.js
const mongoose = require("mongoose");

const AccountSchema = new mongoose.Schema({
  accountId:      { type: String, required: true, unique: true },
  features:       { type: Object, default: {} },
  riskScore:      { type: Number, min: 0, max: 1 },
  decision:       { type: String, enum: ["APPROVE", "REVIEW", "FLAG", "BLOCK"] },
  gnnScore:       Number,
  ensembleScore:  Number,
  vaeScore:       Number,
  beiScore:       Number,
  graphScore:     Number,
  ringMembership: Boolean,
  shap:           [{ feature: String, shap_value: Number, raw_value: Number, direction: String }],
  alertText:      String,
  overrideApplied: Boolean,
  lastAnalyzed:   { type: Date, default: Date.now },
}, { timestamps: true });

AccountSchema.index({ riskScore: -1 });
AccountSchema.index({ lastAnalyzed: -1 });
AccountSchema.index({ decision: 1 });

module.exports = mongoose.model("Account", AccountSchema);