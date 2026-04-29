const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const { sendEmail } = require("../utils/mail");

let io;
const setIO = (_io) => { io = _io; };

// @desc    Submit contact form
// @route   POST /api/contact
router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newMessage = await Message.create({ name, email, message });

    // Send Email to Admin
    await sendEmail({
      to: "boafokyei3@gmail.com",
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>New Message Received</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong></p>
          <p style="background: #f4f4f4; padding: 15px; border-radius: 8px;">${message}</p>
          <hr />
          <p style="font-size: 0.8rem; color: #666;">This message was sent from the Uni Health Com landing page.</p>
        </div>
      `
    });

    // Notify Admin via Socket
    if (io) {
      io.emit("NEW_ADMIN_NOTIFICATION", {
        type: "Message",
        title: "New Contact Message",
        desc: `From ${name} (${email})`,
        time: "Just now",
        color: "blue"
      });
      io.emit("NEW_MESSAGE", newMessage);
    }

    res.status(201).json({ message: "Message sent successfully" });
  } catch (err) {
    console.error("Contact submit error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// @desc    Get all messages (Admin)
// @route   GET /api/contact/messages
router.get("/messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// @desc    Update message status
// @route   PATCH /api/contact/messages/:id
router.patch("/messages/:id", async (req, res) => {
  try {
    const updated = await Message.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});

// @desc    Delete message
// @route   DELETE /api/contact/messages/:id
router.delete("/messages/:id", async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ message: "Message deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = { router, setIO };
