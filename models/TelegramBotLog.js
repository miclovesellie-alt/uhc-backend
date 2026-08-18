const mongoose = require("mongoose");

// Each document = one media download request
const telegramBotLogSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true },
    username:   { type: String, default: "" },
    firstName:  { type: String, default: "" },
    url:        { type: String, required: true },
    platform:   { type: String, default: "unknown" },
    format:     { type: String, enum: ["video", "audio"], default: "video" },
    status:     { type: String, enum: ["success", "failed", "toolarge"], default: "success" },
    errorMsg:   { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TelegramBotLog", telegramBotLogSchema);
