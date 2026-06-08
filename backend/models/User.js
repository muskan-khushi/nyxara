// models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ["analyst", "admin", "compliance"], default: "analyst" },
  name:         { type: String, default: "" },
  lastLogin:    { type: Date },
}, { timestamps: true });

UserSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("User", UserSchema);