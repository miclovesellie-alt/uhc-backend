const mongoose = require("mongoose");

const sessionResultSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunitySession",
      required: true,
      index: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    answers: [
      {
        questionId: { type: String },
        selectedIndex: { type: Number },
        correct: { type: Boolean },
        timeTaken: { type: Number },
      },
    ],
    score: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
    },
    accuracy: {
      type: Number, // 0-100
    },
    timeTaken: {
      type: Number, // seconds total
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SessionResult", sessionResultSchema);
