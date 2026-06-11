const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    name:    { type: String, required: true },
    email:   { type: String, required: true },
    message: { type: String, required: true },
    subject: { type: String, default: "" },
    // Link to the User who sent it (null for anonymous contact form)
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // 'contact' = landing page form, 'suggestion' = logged-in user from profile, 'admin_reply' = admin to user
    source:  { type: String, default: "contact", enum: ["contact", "suggestion", "admin_reply"] },
    status:  { type: String, default: "unread", enum: ["unread", "read", "archived"] },
    // Admin reply fields
    adminReply:  { type: String, default: "" },
    repliedAt:   { type: Date, default: null },
    repliedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
