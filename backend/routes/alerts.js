// routes/alerts.js
const express = require("express");
const router  = express.Router();
const Alert   = require("../models/Alert");

/**
 * GET /api/alerts?page=1&limit=20&decision=FLAG&status=pending
 * Paginated alert list with filters.
 */
router.get("/", async (req, res, next) => {
  try {
    const {
      page     = 1,
      limit    = 20,
      decision,
      status,        // "pending" | "confirmed" | "dismissed" | "escalated"
      sortBy   = "createdAt",
      order    = "desc",
    } = req.query;

    const filter = {};
    if (decision) filter.decision = decision.toUpperCase();
    if (status === "pending") {
      filter.analystAction = null;
    } else if (status) {
      filter.analystAction = status;
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const sort  = { [sortBy]: order === "asc" ? 1 : -1 };

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Alert.countDocuments(filter),
    ]);

    res.json({
      alerts,
      total,
      page:  parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/alerts/:id
 * Single alert detail.
 */
router.get("/:id", async (req, res, next) => {
  try {
    const alert = await Alert.findById(req.params.id).lean();
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    res.json(alert);
  } catch (err) { next(err); }
});

/**
 * PATCH /api/alerts/:id/action
 * Analyst takes action on an alert: confirm / dismiss / escalate.
 * Body: { action: "confirmed" | "dismissed" | "escalated", note?: string }
 */
router.patch("/:id/action", async (req, res, next) => {
  try {
    const { action, note } = req.body;
    const allowed = ["confirmed", "dismissed", "escalated"];

    if (!action || !allowed.includes(action)) {
      return res.status(400).json({ error: `action must be one of: ${allowed.join(", ")}` });
    }

    const update = {
      analystAction: action,
      analystId:     req.user?.id || "unknown",
      actionAt:      new Date(),
    };
    if (note) update.analystNote = note;

    const alert = await Alert.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!alert) return res.status(404).json({ error: "Alert not found" });

    // Broadcast update to connected dashboards
    const io = req.app.get("io");
    if (io) {
      io.to("alert_room").emit("alert_updated", {
        alertId: alert._id.toString(),
        accountId: alert.accountId,
        action,
        analystId: update.analystId,
      });
    }

    res.json({ message: "Action recorded", alert });
  } catch (err) { next(err); }
});

/**
 * GET /api/alerts/stats/summary
 * Quick summary counts for dashboard widgets.
 */
router.get("/stats/summary", async (req, res, next) => {
  try {
    const [pending, confirmed, dismissed, escalated, total] = await Promise.all([
      Alert.countDocuments({ analystAction: null }),
      Alert.countDocuments({ analystAction: "confirmed" }),
      Alert.countDocuments({ analystAction: "dismissed" }),
      Alert.countDocuments({ analystAction: "escalated" }),
      Alert.countDocuments(),
    ]);

    // By decision type
    const [blocked, flagged, reviewed] = await Promise.all([
      Alert.countDocuments({ decision: "BLOCK" }),
      Alert.countDocuments({ decision: "FLAG" }),
      Alert.countDocuments({ decision: "REVIEW" }),
    ]);

    res.json({
      total,
      byAction: { pending, confirmed, dismissed, escalated },
      byDecision: { blocked, flagged, reviewed },
    });
  } catch (err) { next(err); }
});

module.exports = router;