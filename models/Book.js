const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    author: { type: String },
    course: { type: String, required: true },
    description: { type: String },
    fileUrl: { type: String, required: true },
    coverImage: { type: String },
    isDownloadable: { type: Boolean, default: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Book", bookSchema);
