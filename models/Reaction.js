const mongoose = require("mongoose");

const ReactionSchema = new mongoose.Schema(
  {
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Article",
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    type: {
      type: String,
      enum: ["like", "love", "insightful", "support"], // add more if needed
      default: "like"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reaction", ReactionSchema);
