const express = require("express");
const User = require("../models/User");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const { createAdminActivity } = require("../utils/adminLogger");
let io;

const router = express.Router();

// =========================
// INJECT SOCKET.IO INSTANCE
// =========================
const setIO = (_io) => {
  io = _io;
};

// =========================
// GET ALL USERS
// =========================
router.get("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// =========================
// DELETE USER
// =========================
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ message: "User not found" });

    const deleted = await User.findByIdAndDelete(req.params.id);
    
    // Log Activity
    await createAdminActivity(
      req.userId, 
      'DELETE_USER', 
      `deleted user account: "${userToDelete.name || userToDelete.email}"`, 
      { type: 'User', id: req.params.id, details: { name: userToDelete.name, email: userToDelete.email }, notifType: 'DANGER' }
    );

    if (io) io.emit("ADMIN_ACTION", `User deleted: ${req.params.id}`);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

// =========================
// UPDATE USER
// =========================
router.patch("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const oldUser = await User.findById(req.params.id);
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "User not found" });

    // Log Activity
    let actionDesc = `updated user "${updated.name || updated.email}"`;
    if (req.body.role && oldUser.role !== req.body.role) actionDesc = `changed role of "${updated.name}" to ${req.body.role}`;
    if (req.body.status && oldUser.status !== req.body.status) actionDesc = `${req.body.status === 'banned' ? 'banned' : 'unbanned'} user "${updated.name}"`;

    await createAdminActivity(
      req.userId, 
      'UPDATE_USER', 
      actionDesc, 
      { type: 'User', id: updated._id, details: req.body, notifType: 'INFO' }
    );

    if (io) io.emit("USER_UPDATE", updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});

// =========================
// SUPERADMIN: RESET USER PASSWORD
// =========================
router.post("/:id/reset-password", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }
    const bcrypt = require("bcryptjs");
    const hashed = await bcrypt.hash(newPassword, 10);
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { password: hashed, resetPasswordToken: undefined, resetPasswordExpires: undefined },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "User not found" });
    if (io) io.emit("ADMIN_ACTION", `Password reset for: ${updated.name || updated.email}`);
    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ message: "Reset failed" });
  }
});

// =========================
// CREATE USER
// =========================
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const newUser = await User.create(req.body);
    if (io) io.emit("NEW_USER", `New user registered: ${newUser.name || newUser.email}`);
    res.json(newUser);
  } catch (err) {
    res.status(500).json({ message: "Create failed" });
  }
});

// =========================
// LOGIN USER
// =========================
router.post("/login", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.lastLogin = new Date();
    await user.save();

    if (io) io.emit("USER_LOGIN", `User logged in: ${user.name || user.email}`);
    res.json({ message: "Login successful", user });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});

// =========================
// EXPORT BOTH ROUTER & setIO
// =========================
module.exports = {
  router,
  setIO,
};