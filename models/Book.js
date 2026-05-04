const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    author: { type: String },
    course: { type: String, required: true },
    description: { type: String },
    fileUrl: { type: String, required: true },
    fileType: { type: String, default: "pdf" }, // pdf | ppt | pptx
    coverImage: { type: String },
    isDownloadable: { type: Boolean, default: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, default: "approved", enum: ["pending", "approved", "rejected"] },
    rejectReason: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Book", bookSchema);
