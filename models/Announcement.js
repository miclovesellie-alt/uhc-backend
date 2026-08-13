const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  message:   { type: String, required: true },
  type:      { type: String, default: "info", enum: ["info", "warning", "success", "danger"] },
  active:    { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  // ── Broadcast targeting ──
  audience:     { type: String, default: "all",    enum: ["all", "active", "inactive"] },
  subject:      { type: String, default: "custom", enum: ["new_document", "reminder_login", "custom"] },
  deliveryMode: { type: String, default: "banner", enum: ["banner", "email", "both"] },

  // ── Email delivery tracking ──
  emailSent:      { type: Boolean, default: false },
  emailSentAt:    { type: Date,    default: null   },
  recipientCount: { type: Number,  default: 0      },
}, { timestamps: true });

module.exports = mongoose.model("Announcement", announcementSchema);
