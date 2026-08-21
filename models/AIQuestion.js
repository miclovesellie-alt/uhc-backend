const mongoose = require("mongoose");

const AIQuestionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    question: { type: String, required: true },
    response: { type: String }, // AI response
    type: { type: String, default: "chat", enum: ["chat", "explanation", "shorten", "similar", "from_notes"] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AIQuestion", AIQuestionSchema);
