const mongoose = require("mongoose");

const flashcardSchema = new mongoose.Schema(
  {
    question:  { type: String, required: true },
    answer:    { type: String, required: true },
    hint:      { type: String, default: "" },
    course:    { type: String, required: true },
    emoji:     { type: String, default: "🃏" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Flashcard", flashcardSchema);
