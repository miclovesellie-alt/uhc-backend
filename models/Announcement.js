const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  message:  { type: String, required: true },
  type:     { type: String, default: "info", enum: ["info", "warning", "success", "danger"] },
  active:   { type: Boolean, default: true },
  createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("Announcement", announcementSchema);
