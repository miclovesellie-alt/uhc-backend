const mongoose = require("mongoose");

const telegramBotUserSchema = new mongoose.Schema(
  {
    telegramId:   { type: Number, required: true, unique: true },
    username:     { type: String, default: null },
    firstName:    { type: String, default: "" },
    lastName:     { type: String, default: "" },
    totalRequests:{ type: Number, default: 0 },
    lastSeen:     { type: Date, default: Date.now },
    platforms:    { type: Map, of: Number, default: {} }, // e.g. { tiktok: 3, youtube: 1 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("TelegramBotUser", telegramBotUserSchema);
