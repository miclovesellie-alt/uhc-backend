/**
 * telegramBot.js
 * ──────────────
 * Self-contained Telegram bot. Required once by server.js — starts polling
 * automatically if a token is stored in MongoDB. The admin panel can restart
 * the bot at any time by calling botManager.restart().
 */

const TelegramBot     = require("node-telegram-bot-api");
const TelegramBotUser = require("../models/TelegramBotUser");
const TelegramBotLog  = require("../models/TelegramBotLog");
const TelegramBotConfig = require("../models/TelegramBotConfig");
const { downloadMedia, detectPlatform, cleanup } = require("./downloader");

// ─── URL regex ──────────────────────────────────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s]+/gi;

// ─── Supported platform hostnames ───────────────────────────────────────────
const SUPPORTED = [
  "tiktok.com", "instagram.com", "youtube.com", "youtu.be",
  "twitter.com", "x.com", "reddit.com", "pinterest.com",
  "facebook.com", "fb.watch", "snapchat.com", "vimeo.com",
];

function isSupportedUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return SUPPORTED.some(s => host === s || host.endsWith("." + s));
  } catch { return false; }
}

// ─── Bot state ───────────────────────────────────────────────────────────────
let bot = null;
let botRunning = false;
let botStartedAt = null;

// ─── Pending format selection: { chatId_msgId: { url, chatId, from } } ──────
const pendingSelections = new Map();

// ─── upsert user in DB ───────────────────────────────────────────────────────
async function upsertUser(from) {
  await TelegramBotUser.findOneAndUpdate(
    { telegramId: from.id },
    {
      $set: {
        username:  from.username  || null,
        firstName: from.first_name || "",
        lastName:  from.last_name  || "",
        lastSeen:  new Date(),
      },
      $inc: { totalRequests: 1 },
    },
    { upsert: true, new: true }
  );
}

async function bumpPlatform(telegramId, platform) {
  await TelegramBotUser.findOneAndUpdate(
    { telegramId },
    { $inc: { [`platforms.${platform}`]: 1 } }
  );
}

// ─── Log a request ───────────────────────────────────────────────────────────
async function logRequest(from, url, platform, format, status, errorMsg = "") {
  await TelegramBotLog.create({
    telegramId: from.id,
    username:   from.username || "",
    firstName:  from.first_name || "",
    url, platform, format, status, errorMsg,
  });
}

// ─── Handle a download request ───────────────────────────────────────────────
async function handleDownload(chatId, from, url, format) {
  const platform = detectPlatform(url);
  const statusMsg = await bot.sendMessage(chatId,
    `⏳ *Fetching ${format === "audio" ? "🎵 audio" : "🎬 video"} from ${platform}…*\n_This may take a few seconds._`,
    { parse_mode: "Markdown" }
  );

  let filePath = null;
  try {
    const result = await downloadMedia(url, format);
    filePath = result.filePath;

    if (format === "audio") {
      await bot.sendAudio(chatId, filePath, {
        caption: `🎵 *${result.title}*\n_via @${(await bot.getMe()).username}_`,
        parse_mode: "Markdown",
      });
    } else {
      await bot.sendVideo(chatId, filePath, {
        caption: `🎬 *${result.title}*\n_via @${(await bot.getMe()).username}_`,
        parse_mode: "Markdown",
        supports_streaming: true,
      });
    }

    await upsertUser(from);
    await bumpPlatform(from.id, platform);
    await logRequest(from, url, platform, format, "success");

  } catch (err) {
    if (err.code === "FILE_TOO_LARGE") {
      await bot.sendMessage(chatId,
        `⚠️ *File too large for Telegram (>50 MB)*\nHere's the direct link instead:\n${err.url || url}`,
        { parse_mode: "Markdown" }
      );
      await logRequest(from, url, platform, format, "toolarge");
    } else {
      console.error("[TelegramBot] Download error:", err.message);
      await bot.sendMessage(chatId,
        `❌ *Could not download media.*\n_${err.message || "Unknown error"}_\n\nMake sure the link is public and try again.`,
        { parse_mode: "Markdown" }
      );
      await logRequest(from, url, platform, format, "failed", err.message || "");
    }
  } finally {
    cleanup(filePath);
    try { await bot.deleteMessage(chatId, statusMsg.message_id); } catch (_) {}
  }
}

// ─── Start the bot ────────────────────────────────────────────────────────────
function startBot(token) {
  if (bot) stopBot();

  try {
    bot = new TelegramBot(token, { polling: true });
    botRunning = true;
    botStartedAt = new Date();
    console.log("[TelegramBot] ✅ Bot started (polling)");

    // ── /start ──────────────────────────────────────────────────────────────
    bot.onText(/\/start/, async (msg) => {
      const name = msg.from.first_name || "there";
      await bot.sendMessage(msg.chat.id,
        `👋 *Hey ${name}! I'm your media downloader bot.*\n\n` +
        `Just paste any link from:\n` +
        `• 🎵 TikTok  • 📸 Instagram  • ▶️ YouTube\n` +
        `• 🐦 Twitter/X  • 🤖 Reddit  • 📌 Pinterest\n` +
        `• 📘 Facebook  • 👻 Snapchat  • 🎞 Vimeo\n\n` +
        `I'll ask whether you want *Video* or *Audio* and send it right to you!`,
        { parse_mode: "Markdown" }
      );
    });

    // ── /help ────────────────────────────────────────────────────────────────
    bot.onText(/\/help/, async (msg) => {
      await bot.sendMessage(msg.chat.id,
        `🆘 *How to use this bot:*\n\n` +
        `1. Copy a link from TikTok, Instagram, YouTube, etc.\n` +
        `2. Paste it here\n` +
        `3. Choose *Video* or *Audio*\n` +
        `4. Get your file instantly!\n\n` +
        `_Max file size: 50 MB (Telegram limit)_`,
        { parse_mode: "Markdown" }
      );
    });

    // ── Any message with a URL ────────────────────────────────────────────────
    bot.on("message", async (msg) => {
      if (!msg.text || msg.text.startsWith("/")) return;

      const urls = msg.text.match(URL_REGEX) || [];
      const supported = urls.filter(isSupportedUrl);

      if (supported.length === 0) {
        // Only reply if it looks like they tried to send a link
        if (urls.length > 0) {
          await bot.sendMessage(msg.chat.id,
            `🤔 I don't recognize that platform yet.\nSupported: TikTok, Instagram, YouTube, Twitter/X, Reddit, Pinterest, Facebook, Snapchat, Vimeo.`
          );
        }
        return;
      }

      const url = supported[0];
      const keyboard = {
        inline_keyboard: [[
          { text: "🎬 Video (MP4)", callback_data: `video|${url}` },
          { text: "🎵 Audio (MP3)", callback_data: `audio|${url}` },
        ]],
      };

      await bot.sendMessage(msg.chat.id,
        `🔗 *Link detected!*\nWhat do you want?`,
        { reply_markup: keyboard, parse_mode: "Markdown" }
      );
    });

    // ── Inline button callbacks ───────────────────────────────────────────────
    bot.on("callback_query", async (query) => {
      const [format, url] = query.data.split("|");
      if (!["video", "audio"].includes(format) || !url) return;

      await bot.answerCallbackQuery(query.id, { text: "⏳ Starting download…" });
      await handleDownload(query.message.chat.id, query.from, url, format);
    });

    // ── Polling errors ────────────────────────────────────────────────────────
    bot.on("polling_error", (err) => {
      console.error("[TelegramBot] Polling error:", err.message);
      if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
        console.error("[TelegramBot] ❌ Invalid token — stopping bot.");
        stopBot();
      }
    });

  } catch (err) {
    console.error("[TelegramBot] Failed to start:", err.message);
    bot = null;
    botRunning = false;
    botStartedAt = null;
  }
}

// ─── Stop the bot ─────────────────────────────────────────────────────────────
function stopBot() {
  if (bot) {
    try { bot.stopPolling(); } catch (_) {}
    bot = null;
  }
  botRunning = false;
  botStartedAt = null;
  console.log("[TelegramBot] 🛑 Bot stopped.");
}

// ─── Public API (used by the admin route) ─────────────────────────────────────
const botManager = {
  getStatus: () => ({ running: botRunning, startedAt: botStartedAt }),

  async restart(token) {
    stopBot();
    if (token) startBot(token);
  },

  stop: stopBot,
};

// ─── Auto-start on server boot ──────────────────────────────────────────────
(async () => {
  try {
    // Wait up to 20s for mongoose connection
    const mongoose = require("mongoose");
    for (let i = 0; i < 10; i++) {
      if (mongoose.connection.readyState === 1) break;
      await new Promise(r => setTimeout(r, 2000));
    }

    let config = await TelegramBotConfig.findById("singleton");

    // ── Env var bootstrap: if TELEGRAM_BOT_TOKEN is set and DB has no token, save it ──
    const envToken = process.env.TELEGRAM_BOT_TOKEN;
    if (envToken && (!config || !config.token)) {
      config = await TelegramBotConfig.findOneAndUpdate(
        { _id: "singleton" },
        { $set: { token: envToken, enabled: true, startedAt: new Date() } },
        { upsert: true, new: true }
      );
      console.log("[TelegramBot] 🔑 Token loaded from TELEGRAM_BOT_TOKEN env var — saved to DB.");
    }

    if (!config) {
      config = await TelegramBotConfig.findOneAndUpdate(
        { _id: "singleton" },
        { $setOnInsert: { token: "", enabled: false } },
        { upsert: true, new: true }
      );
    }

    if (config.token && config.enabled) {
      console.log("[TelegramBot] ✅ Starting bot…");
      startBot(config.token);
    } else {
      console.log("[TelegramBot] ℹ️  No token configured. Set TELEGRAM_BOT_TOKEN env var or add one in the admin panel.");
    }
  } catch (err) {
    console.error("[TelegramBot] Auto-start error:", err.message);
  }
})();

module.exports = botManager;
