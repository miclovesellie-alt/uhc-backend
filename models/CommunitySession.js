const mongoose = require("mongoose");

const communitySessionSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: String,
      required: true,
    },
    questionCount: {
      type: Number,
      required: true,
    },
    timeLimit: {
      type: Number, // seconds
      required: true,
    },
    questions: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    scheduledAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["waiting", "active", "completed"],
      default: "waiting",
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CommunitySession", communitySessionSchema);
