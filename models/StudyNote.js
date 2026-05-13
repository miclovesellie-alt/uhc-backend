const mongoose = require("mongoose");

const studyNoteSchema = new mongoose.Schema(
  {
    title:     { type: String, required: true },
    body:      { type: String, required: true }, // Markdown-style text
    course:    { type: String, required: true },
    emoji:     { type: String, default: "📝" },
    color:     { type: String, default: "#10b981" }, // accent color for the card
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudyNote", studyNoteSchema);
