const mongoose = require("mongoose");

// Stores the single bot configuration (token, on/off, etc.)
const telegramBotConfigSchema = new mongoose.Schema(
  {
    _id:     { type: String, default: "singleton" },
    token:   { type: String, default: "" },
    enabled: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
  },
  { _id: false }
);

module.exports = mongoose.model("TelegramBotConfig", telegramBotConfigSchema);
