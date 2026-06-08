// routes/graph.js
// Proxy routes: frontend calls /api/rings + /api/clusters
// Backend forwards to AI engine (which isn't directly exposed to browser).
const express    = require("express");
const router     = express.Router();
const aiService  = require("../services/aiService");

/**
 * GET /api/rings
 * Returns pre-cached mule ring structures from the AI engine.
 */
router.get("/rings", async (req, res, next) => {
  try {
    const data = await aiService.getRings();
    res.json(data);
  } catch (err) {
    // Graceful degradation — return empty so frontend still renders
    res.json({ rings: [], total: 0, source: "unavailable", message: "AI engine unreachable." });
  }
});

/**
 * GET /api/clusters
 * Returns Louvain community fraud-rate report from the AI engine.
 */
router.get("/clusters", async (req, res, next) => {
  try {
    const data = await aiService.getClusters();
    res.json(data);
  } catch (err) {
    res.json({ clusters: [], total: 0, source: "unavailable", message: "AI engine unreachable." });
  }
});

module.exports = router;