const express = require("express");
const router  = express.Router();
const Message          = require("../models/Message");
const UserNotification = require("../models/UserNotification");
const User             = require("../models/User");
const { sendEmail }    = require("../utils/mail");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const { createUserActivityLog } = require("../utils/adminLogger");

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
    const { subject, message, category } = req.body;
    if (!message || !message.trim())
      return res.status(400).json({ message: "Message is required" });

    const user = await User.findById(req.userId).select("name email");
    if (!user) return res.status(404).json({ message: "User not found" });

    const catLabel = category ? category.charAt(0).toUpperCase() + category.slice(1) : "Suggestion";
    const finalSubject = subject ? `[${catLabel}] ${subject}` : `[${catLabel}] Message from ${user.name}`;

    const newMsg = await Message.create({
      name:    user.name,
      email:   user.email,
      subject: finalSubject,
      message: message.trim(),
      userId:  req.userId,
      source:  "suggestion",
      category: category || "suggestion",
    });

    await sendEmail({
      to: "boafokyei3@gmail.com",
      subject: `💬 ${catLabel}: ${user.name}${subject ? ` — ${subject}` : ""}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:32px;border-radius:16px;border:1px solid #e2e8f0;">
          <div style="font-size:1.5rem;font-weight:900;background:linear-gradient(135deg,#4255ff,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px;">UHC Academy</div>
          <div style="font-size:0.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:20px;">User Message (${catLabel})</div>
          <h2 style="color:#0f172a;margin:0 0 8px;">💬 ${subject || "New Message"}</h2>
          <p style="color:#475569;margin:0 0 4px;"><strong>From:</strong> ${user.name} (${user.email})</p>
          <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px 0;color:#334155;line-height:1.6;">
            ${message.trim().replace(/\n/g, "<br>")}
          </div>
          <a href="https://uhcacadamy.com/admin/messages" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#4255ff,#8b5cf6);color:white;border-radius:10px;text-decoration:none;font-weight:700;">View in Admin Panel →</a>
        </div>
      `,
    });

    // Log user activity and trigger admin notification (database + socket)
    await createUserActivityLog(
      req.userId,
      "USER_MESSAGE",
      `${user.name} sent a ${category || "suggestion"}: ${subject || "No Subject"}`,
      "INFO"
    );

    res.status(201).json({ message: "Message sent successfully", id: newMsg._id });
  } catch (err) {
    console.error("Suggestion error:", err);
    res.status(500).json({ message: "Failed to send message" });
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
    originalMsg.userRead   = false;
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

// ── POST /api/contact/message-user/:userId  (admin → specific user direct message) ─
router.post("/message-user/:userId", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { subject, messageText } = req.body;
    if (!messageText?.trim()) return res.status(400).json({ message: "Message text is required" });

    const [targetUser, admin] = await Promise.all([
      User.findById(req.params.userId).select("name email"),
      User.findById(req.userId).select("name"),
    ]);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    // Store as Message (shows in admin Messages panel)
    await Message.create({
      name:    admin?.name || "Admin",
      email:   "admin@uhcacadamy.com",
      subject: subject || `Message from Admin`,
      message: messageText.trim(),
      userId:  req.params.userId,
      source:  "admin_reply",
      adminReply: messageText.trim(),
      repliedAt:  new Date(),
      repliedBy:  req.userId,
      status:  "read",
      userRead: false,
    });

    // In-app UserNotification
    await UserNotification.create({
      recipient:  req.params.userId,
      message:    `📨 ${admin?.name || "Admin"}: ${messageText.trim().slice(0, 120)}${messageText.length > 120 ? "…" : ""}`,
      type:       "MESSAGE",
      actionLink: "/profile",
    });

    // Real-time socket
    if (io) {
      io.emit("USER_NOTIFICATION", {
        userId:  req.params.userId,
        message: `📨 Message from ${admin?.name || "Admin"}`,
        type:    "MESSAGE",
      });
    }

    // Email user
    await sendEmail({
      to:      targetUser.email,
      subject: `📨 ${subject || "Message from UHC Academy Admin"}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:32px;border-radius:16px;border:1px solid #e2e8f0;">
          <div style="font-size:1.5rem;font-weight:900;background:linear-gradient(135deg,#4255ff,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:16px;">UHC Academy</div>
          <h2 style="color:#0f172a;margin:0 0 4px;">📨 Message from Admin</h2>
          <p style="color:#64748b;font-size:.85rem;margin-bottom:20px;">Hi <strong>${targetUser.name}</strong>, you have a new message from ${admin?.name || "the admin team"}.</p>
          <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;color:#334155;line-height:1.6;">
            ${messageText.trim().replace(/\n/g, "<br>")}
          </div>
          <a href="https://uhcacadamy.com/profile" style="display:inline-block;margin-top:20px;padding:12px 24px;background:linear-gradient(135deg,#4255ff,#8b5cf6);color:white;border-radius:10px;text-decoration:none;font-weight:700;">View in App →</a>
        </div>
      `,
    });

    res.json({ message: "Message sent to user" });
  } catch (err) {
    console.error("message-user error:", err);
    res.status(500).json({ message: "Failed to send message" });
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

// ── GET /api/contact/my-messages  (logged-in user: get their conversation thread) ──
router.get("/my-messages", authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ userId: req.userId })
      .sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user messages" });
  }
});

// ── PATCH /api/contact/my-messages/:id/read  (logged-in user: mark message as read) ──
router.patch("/my-messages/:id/read", authMiddleware, async (req, res) => {
  try {
    const msg = await Message.findOne({ _id: req.params.id, userId: req.userId });
    if (!msg) return res.status(404).json({ message: "Message not found or unauthorized" });
    msg.status = "read";
    msg.userRead = true;
    await msg.save();
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: "Failed to mark message as read" });
  }
});

module.exports = { router, setIO };
