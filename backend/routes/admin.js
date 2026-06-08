// routes/admin.js
const express = require("express");
const router  = express.Router();
const Account = require("../models/Account");
const Alert   = require("../models/Alert");

// GET /api/admin/stats — live dashboard metrics
router.get("/stats", async (req, res, next) => {
  try {
    const [
      totalAccounts,
      blockedCount,
      flaggedCount,
      reviewCount,
      approvedCount,
      pendingAlerts,
      recentAlerts,
    ] = await Promise.all([
      Account.countDocuments(),
      Account.countDocuments({ decision: "BLOCK" }),
      Account.countDocuments({ decision: "FLAG" }),
      Account.countDocuments({ decision: "REVIEW" }),
      Account.countDocuments({ decision: "APPROVE" }),
      Alert.countDocuments({ analystAction: null }),
      Alert.find().sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    // Risk score distribution
    const riskDist = await Account.aggregate([
      {
        $bucket: {
          groupBy: "$riskScore",
          boundaries: [0, 0.2, 0.4, 0.6, 0.8, 1.01],
          default: "other",
          output: { count: { $sum: 1 } },
        },
      },
    ]);

    res.json({
      counts: { total: totalAccounts, blocked: blockedCount, flagged: flaggedCount, review: reviewCount, approved: approvedCount },
      pendingAlerts,
      recentAlerts,
      riskDistribution: riskDist,
    });
  } catch (err) { next(err); }
});

module.exports = router;