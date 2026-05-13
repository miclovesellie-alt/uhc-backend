const mongoose = require("mongoose");

const resourceLinkSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true },
    url:         { type: String, required: true },
    description: { type: String, default: "" },
    type:        { type: String, enum: ["video", "article", "tool", "other"], default: "video" },
    course:      { type: String, required: true },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ResourceLink", resourceLinkSchema);
