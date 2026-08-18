const mongoose = require("mongoose");

// Singleton config document — stores the bot token and enabled/disabled state.
// We use a string _id of "singleton" so there's always exactly one document.
const telegramBotConfigSchema = new mongoose.Schema(
  {
    _id:       { type: String },
    token:     { type: String, default: "" },
    enabled:   { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
  }
  // NOTE: no { _id: false } — we want Mongoose to respect our custom string _id
);

module.exports = mongoose.model("TelegramBotConfig", telegramBotConfigSchema);
