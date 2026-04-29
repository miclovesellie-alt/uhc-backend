const mongoose = require("mongoose");

const AIQuestionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    question: { type: String, required: true },
    response: { type: String }, // AI response
  },
  { timestamps: true }
);

module.exports = mongoose.model("AIQuestion", AIQuestionSchema);
