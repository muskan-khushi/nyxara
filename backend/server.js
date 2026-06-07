/**
 * Nyxara Backend — Port 8080
 * Express + Socket.IO orchestration layer.
 */
require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { connectDB } = require("./config/db");
const { errorHandler } = require("./middleware/errorHandler");
const { authMiddleware } = require("./middleware/auth");

// ── Route imports ─────────────────────────────────────────────
const authRoutes       = require("./routes/auth");
const accountRoutes    = require("./routes/accounts");
const alertRoutes      = require("./routes/alerts");
const adminRoutes      = require("./routes/admin");
const complianceRoutes = require("./routes/compliance");

// ── App setup ─────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true },
});

// Make io available to routes
app.set("io", io);

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: { error: "Too many requests — please slow down." },
}));

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth",       authRoutes);
app.use("/api/accounts",   authMiddleware, accountRoutes);
app.use("/api/alerts",     authMiddleware, alertRoutes);
app.use("/api/admin",      authMiddleware, adminRoutes);
app.use("/api/compliance", authMiddleware, complianceRoutes);

app.get("/health", (req, res) => res.json({ status: "ok", service: "nyxara-backend" }));

// ── WebSocket ─────────────────────────────────────────────────
io.use((socket, next) => {
  // Auth check for socket connections
  const token = socket.handshake.auth?.token;
  if (!token && process.env.NODE_ENV !== "development") {
    return next(new Error("Authentication required"));
  }
  next();
});

io.on("connection", (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.on("subscribe_alerts", () => {
    socket.join("alert_room");
    socket.emit("subscribed", { room: "alert_room" });
  });

  socket.on("disconnect", () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ── Error handler (must be last) ──────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.BACKEND_PORT || 8080;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🔮 Nyxara Backend running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket ready`);
    console.log(`🤖 AI Engine: ${process.env.AI_ENGINE_URL}`);
    console.log(`🔒 Cybersec Engine: ${process.env.CYBER_ENGINE_URL}\n`);
  });
});

module.exports = { app, io };