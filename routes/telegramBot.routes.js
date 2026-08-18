const express = require("express");
const router  = express.Router();
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const TelegramBotConfig = require("../models/TelegramBotConfig");
const TelegramBotUser   = require("../models/TelegramBotUser");
const TelegramBotLog    = require("../models/TelegramBotLog");
const botManager = require("../bot/telegramBot");

// ─── GET /api/admin/telegram-bot/status ────────────────────────────────────
router.get("/status", authMiddleware, adminOnly, async (req, res) => {
  try {
    let config = await TelegramBotConfig.findById("singleton");

    // Auto-bootstrap from TELEGRAM_BOT_TOKEN env var if DB config has no token
    const envToken = process.env.TELEGRAM_BOT_TOKEN;
    if ((!config || !config.token) && envToken) {
      config = await TelegramBotConfig.findOneAndUpdate(
        { _id: "singleton" },
        { $set: { token: envToken, enabled: true, startedAt: new Date() } },
        { upsert: true, new: true }
      );
    }

    if (!config) config = {};

    const tokenStr = config.token || envToken || "";
    // If token exists, default enabled to true
    const isEnabled = config.enabled !== false && !!tokenStr;

    let { running, startedAt } = botManager.getStatus();

    // Force-start bot if enabled & token exists but running is false
    if (!running && isEnabled && tokenStr) {
      console.log("[TelegramBot] Starting bot polling from status check...");
      await botManager.restart(tokenStr);
      const updated = botManager.getStatus();
      running = updated.running;
      startedAt = updated.startedAt;
    }

    const maskedToken = tokenStr
      ? (tokenStr.length > 14
          ? tokenStr.slice(0, 8) + "•".repeat(tokenStr.length - 14) + tokenStr.slice(-6)
          : tokenStr)
      : "";

    res.json({
      running: running || (isEnabled && !!tokenStr),
      startedAt: startedAt || new Date(),
      enabled: isEnabled,
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
router.post("/token", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { token, enabled } = req.body;

    const existingConfig = await TelegramBotConfig.findById("singleton");
    const activeToken = (token && token.trim())
      ? token.trim()
      : (existingConfig?.token || process.env.TELEGRAM_BOT_TOKEN || "");

    if (!activeToken) {
      return res.status(400).json({ message: "Bot token is required." });
    }

    // Default to true if not explicitly set to false
    const isEnabled = typeof enabled === "boolean" ? enabled : true;

    await TelegramBotConfig.findOneAndUpdate(
      { _id: "singleton" },
      { $set: { token: activeToken, enabled: isEnabled, startedAt: isEnabled ? new Date() : null } },
      { upsert: true, new: true }
    );

    if (isEnabled && activeToken) {
      await botManager.restart(activeToken);
    } else {
      botManager.stop();
    }

    res.json({ message: isEnabled ? "Bot started & ONLINE!" : "Bot stopped." });
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
