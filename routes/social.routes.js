const express = require("express");
const router = express.Router();
const Announcement = require("../models/Announcement");
const User = require("../models/User");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

// GET all active announcements (public — shown to users on login/dashboard)
router.get("/", async (req, res) => {
  try {
    const announcements = await Announcement.find({ active: true }).sort({ createdAt: -1 });
    res.json(announcements);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all announcements (admin)
router.get("/all", authMiddleware, adminOnly, async (req, res) => {
  try {
    const all = await Announcement.find().sort({ createdAt: -1 }).populate("createdBy", "name");
    res.json(all);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create announcement (admin)
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, message, type } = req.body;
    const ann = await Announcement.create({ title, message, type, createdBy: req.userId });
    res.status(201).json(ann);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH toggle active (admin)
router.patch("/:id/toggle", authMiddleware, adminOnly, async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ error: "Not found" });
    ann.active = !ann.active;
    await ann.save();
    res.json(ann);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE announcement (admin)
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET leaderboard — all users by points (no limit)
router.get("/leaderboard", async (req, res) => {
  try {
    const users = await User.find({ role: "user", status: "active" })
      .select("name points streak category country")
      .sort({ points: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH suspend user (admin)
router.patch("/suspend/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { days, reason } = req.body;
    const until = new Date();
    until.setDate(until.getDate() + (parseInt(days) || 1));
    const user = await User.findByIdAndUpdate(req.params.id,
      { status: "suspended", suspendedUntil: until, suspendReason: reason || "Policy violation" },
      { new: true }
    );
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH unsuspend user (admin)
router.patch("/unsuspend/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id,
      { status: "active", suspendedUntil: null, suspendReason: "" },
      { new: true }
    );
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH update streak (called after quiz completion)
router.patch("/streak", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const today = new Date().toDateString();
    const lastDate = user.lastQuizDate ? new Date(user.lastQuizDate).toDateString() : null;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastDate === today) return res.json({ streak: user.streak, message: "Already updated today" });
    const newStreak = lastDate === yesterday ? user.streak + 1 : 1;
    user.streak = newStreak;
    user.lastQuizDate = new Date();
    await user.save();
    res.json({ streak: newStreak });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
