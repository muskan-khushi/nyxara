// models/Alert.js
const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema({
  accountId:      { type: String, required: true },
  decision:       { type: String, enum: ["REVIEW", "FLAG", "BLOCK"], required: true },
  riskScore:      { type: Number, required: true },
  alertText:      String,
  cyberFlags:     [String],
  analystAction:  { type: String, enum: [null, "confirmed", "dismissed", "escalated"], default: null },
  analystNote:    String,
  analystId:      String,
  actionAt:       Date,
}, { timestamps: true });

AlertSchema.index({ accountId: 1 });
AlertSchema.index({ decision: 1 });
AlertSchema.index({ createdAt: -1 });
AlertSchema.index({ analystAction: 1 });

module.exports = mongoose.model("Alert", AlertSchema);