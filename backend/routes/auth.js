// routes/auth.js
const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const User    = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const JWT_SECRET  = process.env.JWT_SECRET  || "dev_secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "8h";

// ── POST /api/auth/login ──────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    // Hardcoded demo admin — always works even with empty DB
    if (email === "admin@nyxara.ai" && password === "nyxara2026") {
      const token = jwt.sign({ id: "demo-admin", email, role: "admin", name: "Demo Admin" }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      return res.json({ token, user: { email, role: "admin", name: "Demo Admin" } });
    }

    // Real DB lookup
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({ token, user: { email: user.email, role: user.role, name: user.name } });
  } catch (err) { next(err); }
});

// ── POST /api/auth/register (admin only in prod) ──────────────
router.post("/register", authMiddleware, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied — admin role required" });
    }
    const { email, password, name, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, name: name || "", role: role || "analyst" });

    res.status(201).json({ message: "User created", email: user.email, role: user.role });
  } catch (err) { next(err); }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get("/me", authMiddleware, (req, res) => {
  res.json({ email: req.user.email, role: req.user.role, name: req.user.name });
});

module.exports = router;