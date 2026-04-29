const mongoose = require("mongoose");

const LibraryItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ["PDF", "Audio", "Video"], required: true },
  description: { type: String },
  thumbnail: { type: String }, // path to thumbnail image
  fileUrl: { type: String, required: true }, // path to file
  category: { type: String }, // e.g., "Nutrition", "Anatomy"
  audience: { type: String, enum: ["Student", "Patient", "Professional"] },
  price: { type: Number, default: 0 }, // 0 for free
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("LibraryItem", LibraryItemSchema);
