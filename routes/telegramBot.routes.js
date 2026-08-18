const express = require("express");
const router  = express.Router();
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const TelegramBotConfig = require("../models/TelegramBotConfig");
const TelegramBotUser   = require("../models/TelegramBotUser");
const TelegramBotLog    = require("../models/TelegramBotLog");
const botManager = require("../bot/telegramBot");

// ─── GET /api/admin/telegram-bot/status ────────────────────────────────────
// Returns: { running, startedAt, token, maskedToken, enabled }
router.get("/status", authMiddleware, adminOnly, async (req, res) => {
  try {
    let config = await TelegramBotConfig.findById("singleton");

    // Auto-bootstrap from TELEGRAM_BOT_TOKEN env var if DB config doesn't have token
    if ((!config || !config.token) && process.env.TELEGRAM_BOT_TOKEN) {
      config = await TelegramBotConfig.findOneAndUpdate(
        { _id: "singleton" },
        { $set: { token: process.env.TELEGRAM_BOT_TOKEN, enabled: true, startedAt: new Date() } },
        { upsert: true, new: true }
      );
    }

    if (!config) config = {};

    let { running, startedAt } = botManager.getStatus();

    // Auto-recover: If config specifies enabled & token exists, but bot isn't currently running, start it!
    if (!running && config.enabled && config.token) {
      console.log("[TelegramBot] Auto-starting bot from /status request...");
      await botManager.restart(config.token);
      const updated = botManager.getStatus();
      running = updated.running;
      startedAt = updated.startedAt;
    }

    const tokenStr = config.token || "";
    const maskedToken = tokenStr
      ? (tokenStr.length > 14
          ? tokenStr.slice(0, 8) + "•".repeat(tokenStr.length - 14) + tokenStr.slice(-6)
          : tokenStr)
      : "";

    res.json({
      running,
      startedAt,
      enabled: config.enabled || false,
      token: tokenStr,
      maskedToken,
    });
  } catch (err) {
    console.error("[BotRoute] status error:", err);
    res.status(500).json({ message: "Failed to fetch bot status" });
  }
});

// ─── POST /api/admin/telegram-bot/token ─────────────────────────────────────
// Body: { token: "...", enabled: true }
// Saves token to DB and restarts (or stops) the bot
router.post("/token", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { token, enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled must be a boolean" });
    }

    const existingConfig = await TelegramBotConfig.findById("singleton");
    const activeToken = (token && token.trim()) ? token.trim() : (existingConfig?.token || process.env.TELEGRAM_BOT_TOKEN || "");

    if (enabled && !activeToken) {
      return res.status(400).json({ message: "Bot token is required to enable the bot." });
    }

    await TelegramBotConfig.findOneAndUpdate(
      { _id: "singleton" },
      { $set: { token: activeToken, enabled, startedAt: enabled ? new Date() : null } },
      { upsert: true, new: true }
    );

    if (enabled && activeToken) {
      await botManager.restart(activeToken);
    } else {
      botManager.stop();
    }

    res.json({ message: enabled ? "Bot started successfully!" : "Bot stopped." });
  } catch (err) {
    console.error("[BotRoute] token save error:", err);
    res.status(500).json({ message: "Failed to save token" });
  }
});

// ─── GET /api/admin/telegram-bot/users ──────────────────────────────────────
// Returns paginated list of Telegram users
router.get("/users", authMiddleware, adminOnly, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [users, total] = await Promise.all([
      TelegramBotUser.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      TelegramBotUser.countDocuments(),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bot users" });
  }
});

// ─── GET /api/admin/telegram-bot/logs ───────────────────────────────────────
// Returns the last 50 download requests
router.get("/logs", authMiddleware, adminOnly, async (req, res) => {
  try {
    const logs = await TelegramBotLog.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bot logs" });
  }
});

// ─── GET /api/admin/telegram-bot/stats ──────────────────────────────────────
// Returns aggregate stats
router.get("/stats", authMiddleware, adminOnly, async (req, res) => {
  try {
    const [total, success, failed, toolarge, totalUsers] = await Promise.all([
      TelegramBotLog.countDocuments(),
      TelegramBotLog.countDocuments({ status: "success" }),
      TelegramBotLog.countDocuments({ status: "failed" }),
      TelegramBotLog.countDocuments({ status: "toolarge" }),
      TelegramBotUser.countDocuments(),
    ]);

    // Platform breakdown
    const platformAgg = await TelegramBotLog.aggregate([
      { $group: { _id: "$platform", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const platforms = platformAgg.map(p => ({ name: p._id, count: p.count }));

    res.json({ total, success, failed, toolarge, totalUsers, platforms });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bot stats" });
  }
});

module.exports = router;
