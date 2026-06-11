const express = require("express");
const router  = express.Router();
const Message          = require("../models/Message");
const UserNotification = require("../models/UserNotification");
const User             = require("../models/User");
const { sendEmail }    = require("../utils/mail");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

let io;
const setIO = (_io) => { io = _io; };

// ── POST /api/contact  (anonymous landing-page contact form) ─────────────────
router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message)
      return res.status(400).json({ message: "All fields are required" });

    const newMessage = await Message.create({ name, email, message, source: "contact" });

    await sendEmail({
      to: "boafokyei3@gmail.com",
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <div style="font-family:sans-serif;padding:20px;color:#333;">
          <h2>New Message Received</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong></p>
          <p style="background:#f4f4f4;padding:15px;border-radius:8px;">${message}</p>
          <hr/>
          <p style="font-size:0.8rem;color:#666;">From the UHC Academy landing page contact form.</p>
        </div>
      `,
    });

    if (io) {
      io.emit("NEW_ADMIN_NOTIFICATION", { type: "Message", title: "New Contact Message", desc: `From ${name} (${email})`, time: "Just now", color: "blue" });
      io.emit("NEW_MESSAGE", newMessage);
    }
    res.status(201).json({ message: "Message sent successfully" });
  } catch (err) {
    console.error("Contact submit error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// ── POST /api/contact/suggestions  (logged-in user → admin suggestion) ───────
router.post("/suggestions", authMiddleware, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!message || !message.trim())
      return res.status(400).json({ message: "Message is required" });

    const user = await User.findById(req.userId).select("name email");
    if (!user) return res.status(404).json({ message: "User not found" });

    const newMsg = await Message.create({
      name:    user.name,
      email:   user.email,
      subject: subject || "User Suggestion",
      message: message.trim(),
      userId:  req.userId,
      source:  "suggestion",
    });

    await sendEmail({
      to: "boafokyei3@gmail.com",
      subject: `💬 User Suggestion from ${user.name}${subject ? ` — ${subject}` : ""}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:32px;border-radius:16px;border:1px solid #e2e8f0;">
          <div style="font-size:1.5rem;font-weight:900;background:linear-gradient(135deg,#4255ff,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px;">UHC Academy</div>
          <div style="font-size:0.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:20px;">User Suggestion</div>
          <h2 style="color:#0f172a;margin:0 0 8px;">💬 ${subject || "New Suggestion"}</h2>
          <p style="color:#475569;margin:0 0 4px;"><strong>From:</strong> ${user.name} (${user.email})</p>
          <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px 0;color:#334155;line-height:1.6;">
            ${message.trim().replace(/\n/g, "<br>")}
          </div>
          <a href="https://uhcacadamy.com/admin/messages" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#4255ff,#8b5cf6);color:white;border-radius:10px;text-decoration:none;font-weight:700;">View in Admin Panel →</a>
        </div>
      `,
    });

    if (io) {
      io.emit("NEW_ADMIN_NOTIFICATION", {
        type: "INFO", title: "💬 New User Suggestion",
        desc: `${user.name}: ${(subject || message).slice(0, 60)}`,
        time: "Just now", color: "blue",
      });
    }

    res.status(201).json({ message: "Suggestion sent successfully", id: newMsg._id });
  } catch (err) {
    console.error("Suggestion error:", err);
    res.status(500).json({ message: "Failed to send suggestion" });
  }
});

// ── GET /api/contact/messages  (admin: all messages, filterable by source) ───
router.get("/messages", authMiddleware, adminOnly, async (req, res) => {
  try {
    const filter = {};
    if (req.query.source) filter.source = req.query.source;
    const messages = await Message.find(filter)
      .populate("userId",    "name email role")
      .populate("repliedBy", "name")
      .sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// ── PATCH /api/contact/messages/:id  (admin: update status) ──────────────────
router.patch("/messages/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const updated = await Message.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});

// ── POST /api/contact/messages/:id/reply  (admin → user: in-app + email) ─────
router.post("/messages/:id/reply", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { replyText } = req.body;
    if (!replyText || !replyText.trim())
      return res.status(400).json({ message: "Reply text is required" });

    const originalMsg = await Message.findById(req.params.id).populate("userId", "name email");
    if (!originalMsg) return res.status(404).json({ message: "Message not found" });

    const admin = await User.findById(req.userId).select("name");

    originalMsg.adminReply = replyText.trim();
    originalMsg.repliedAt  = new Date();
    originalMsg.repliedBy  = req.userId;
    originalMsg.status     = "read";
    await originalMsg.save();

    // In-app notification for the user
    if (originalMsg.userId?._id) {
      await UserNotification.create({
        recipient:  originalMsg.userId._id,
        message:    `📨 Reply from Admin: ${replyText.trim().slice(0, 120)}${replyText.length > 120 ? "…" : ""}`,
        type:       "MESSAGE",
        actionLink: "/profile",
      });
      if (io) {
        io.emit("USER_NOTIFICATION", {
          userId:  originalMsg.userId._id.toString(),
          message: `📨 ${admin?.name || "Admin"} replied to your message`,
          type:    "MESSAGE",
        });
      }
    }

    // Email reply to user
    const recipientEmail = originalMsg.userId?.email || originalMsg.email;
    if (recipientEmail) {
      await sendEmail({
        to:      recipientEmail,
        subject: `📨 Reply from UHC Academy Admin — ${originalMsg.subject || "Your Message"}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:32px;border-radius:16px;border:1px solid #e2e8f0;">
            <div style="font-size:1.5rem;font-weight:900;background:linear-gradient(135deg,#10b981,#0ea5e9);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:16px;">UHC Academy</div>
            <h2 style="color:#0f172a;margin:0 0 4px;">📨 Admin Reply</h2>
            <p style="color:#64748b;font-size:0.85rem;margin-bottom:20px;">Hi <strong>${originalMsg.name}</strong>, ${admin?.name || "an admin"} has replied to your message.</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px;color:#334155;line-height:1.6;">
              ${replyText.trim().replace(/\n/g, "<br>")}
            </div>
            <div style="background:#f1f5f9;border-radius:10px;padding:14px;margin-bottom:20px;font-size:0.82rem;color:#64748b;border-left:3px solid #94a3b8;">
              <strong>Your original message:</strong><br>${originalMsg.message.slice(0, 300)}${originalMsg.message.length > 300 ? "…" : ""}
            </div>
            <a href="https://uhcacadamy.com/profile" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#10b981,#0ea5e9);color:white;border-radius:10px;text-decoration:none;font-weight:700;">View in App →</a>
          </div>
        `,
      });
    }

    res.json({ message: "Reply sent successfully" });
  } catch (err) {
    console.error("Admin reply error:", err);
    res.status(500).json({ message: "Failed to send reply" });
  }
});

// ── DELETE /api/contact/messages/:id  (admin: delete message) ────────────────
router.delete("/messages/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ message: "Message deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = { router, setIO };
