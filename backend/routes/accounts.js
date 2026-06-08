// routes/accounts.js
const express = require("express");
const router  = express.Router();
const Account = require("../models/Account");
const Alert   = require("../models/Alert");
const aiService     = require("../services/aiService");
const cyberService  = require("../services/cyberService");
const blockchainService = require("../services/blockchainService");
const alertService  = require("../services/alertService");

/**
 * POST /api/accounts/analyze
 * The 12-step analysis pipeline.
 */
router.post("/analyze", async (req, res, next) => {
  const io = req.app.get("io");
  const { accountId, features, deviceSignal } = req.body;

  if (!accountId || !features) {
    return res.status(400).json({ error: "accountId and features are required" });
  }

  try {
    // Step 3: Save preliminary record
    await Account.findOneAndUpdate(
      { accountId },
      { accountId, features, decision: "PROCESSING" },
      { upsert: true, new: true }
    );

    // Steps 4 & 5: Parallel AI + Cyber scoring
    const [aiResult, cyberResult] = await Promise.all([
      aiService.score({ account_id: accountId, ...features }),
      cyberService.scoreDevice(deviceSignal || {}),
    ]);

    // Step 7: Risk fusion already done in AI engine (includes BEI weight)
    const finalRisk = aiResult.final_risk;
    const decision  = aiResult.decision;

    // Step 9: Update MongoDB
    const account = await Account.findOneAndUpdate(
      { accountId },
      {
        riskScore:       finalRisk,
        decision,
        gnnScore:        aiResult.gnn_score,
        ensembleScore:   aiResult.ensemble_score,
        vaeScore:        aiResult.vae_score,
        beiScore:        cyberResult.bei_risk_score || 0,
        graphScore:      aiResult.graph_score,
        ringMembership:  aiResult.ring_membership,
        shap:            aiResult.shap_factors,
        alertText:       aiResult.alert_text,
        overrideApplied: aiResult.override_applied,
        lastAnalyzed:    new Date(),
      },
      { new: true }
    );

    // Step 10: Create alert for non-APPROVE decisions
    let alert = null;
    if (decision !== "APPROVE") {
      alert = await Alert.create({
        accountId,
        decision,
        riskScore: finalRisk,
        alertText: aiResult.alert_text,
        cyberFlags: cyberResult.flags || [],
      });

      // Step 11: WebSocket broadcast
      alertService.broadcastAlert(io, {
        alertId:   alert._id,
        accountId,
        decision,
        riskScore: finalRisk,
        alertText: aiResult.alert_text,
        timestamp: alert.createdAt,
      });
    }

    // Step 12: Async blockchain commit (fire and forget)
    blockchainService.commitDecision({ accountId, decision, riskScore: finalRisk })
      .catch(err => console.error("[Blockchain] Commit failed:", err.message));

    return res.json({
      accountId,
      finalRisk,
      decision,
      scores: {
        gnn:      aiResult.gnn_score,
        ensemble: aiResult.ensemble_score,
        vae:      aiResult.vae_score,
        bei:      cyberResult.bei_risk_score,
        graph:    aiResult.graph_score,
      },
      shap:       aiResult.shap_factors,
      alertText:  aiResult.alert_text,
      alertId:    alert?._id || null,
      ringMembership: aiResult.ring_membership,
    });

  } catch (err) {
    next(err);
  }
});


/**
 * GET /api/accounts/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const account = await Account.findOne({ accountId: req.params.id });
    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json(account);
  } catch (err) { next(err); }
});


/**
 * GET /api/accounts?page=1&limit=20&decision=FLAG
 */
router.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, decision, minRisk, maxRisk } = req.query;
    const filter = {};
    if (decision) filter.decision = decision;
    if (minRisk || maxRisk) filter.riskScore = {};
    if (minRisk) filter.riskScore.$gte = parseFloat(minRisk);
    if (maxRisk) filter.riskScore.$lte = parseFloat(maxRisk);

    const [accounts, total] = await Promise.all([
      Account.find(filter)
        .sort({ lastAnalyzed: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select("-features"), // Don't send full feature vector in list view
      Account.countDocuments(filter),
    ]);

    res.json({ accounts, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

module.exports = router;