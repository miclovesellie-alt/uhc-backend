const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../utils/mail");
const User = require("../models/User");
const { getSetting } = require("../utils/settings");
const { createAdminActivity, createUserActivityLog } = require("../utils/adminLogger");

// ---------------- SIGNUP ----------------
router.post("/signup", async (req, res) => {
  try {
    const registrationOpen = await getSetting("registrationOpen", true);
    if (!registrationOpen) {
      return res.status(403).json({ message: "Registration is currently closed by administration." });
    }

    const { name, email, phone, password, category, country } = req.body;

    if (!name || !email || !password || !category || !country) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      phone: phone || "",
      password: hashedPassword,
      category,
      country,
    });

    await user.save();

    // Log Activity for Admins
    await createUserActivityLog(
      user._id, 
      "USER_SIGNUP",
      `New user joined: "${name}" (${category})`, 
      'INFO'
    );

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ token, user });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- LOGIN ----------------
router.post("/login", async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return res.status(400).json({ message: "Please provide email or phone and password" });
    }

    // Support login by email or phone
    const query = email ? { email } : { phone };
    const user = await User.findOne(query);
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    // Check Maintenance Mode (allow admins)
    const maintenanceMode = await getSetting("maintenanceMode", false);
    if (maintenanceMode && !['admin', 'superadmin'].includes(user.role)) {
      return res.status(503).json({ message: "Platform is currently under maintenance. Please try again later." });
    }

    // Check if banned
    if (user.status === "banned") {
      return res.status(403).json({ message: "Your account has been suspended. Contact support." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Add login point (Max 1 per 24 hours)
    const now = new Date();
    const lastPoint = user.lastLoginPointDate;

    if (!lastPoint || (now - lastPoint) >= 24 * 60 * 60 * 1000) {
      user.points = (user.points || 0) + 1;
      user.lastLoginPointDate = now;
      await user.save();
    }

    // Notify Admins of User Login
    if (!['admin', 'superadmin'].includes(user.role)) {
      await createUserActivityLog(
        user._id,
        "USER_LOGIN",
        `User logged in: "${user.name}" (${user.category || 'User'})`,
        'INFO'
      );
    }

    // Log Activity if Admin
    if (['admin', 'superadmin'].includes(user.role)) {
      await createAdminActivity(
        user._id, 
        'ADMIN_LOGIN', 
        `Administrator logged in`, 
        { type: 'User', id: user._id, details: { name: user.name, role: user.role }, notifType: 'SUCCESS' }
      );
    }

    // Return full user object including role so frontend can redirect admins
    res.json({ token, user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- ADMIN FORGOT PASSWORD (requires secretKey) ----------------
router.post("/admin-forgot-password", async (req, res) => {
  try {
    const { email, secretKey } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    // Validate platform secret key
    // The key is stored in the DB or env. We fall back to env variable, then a default.
    const expectedKey = process.env.ADMIN_SECRET_KEY || "UHC-ADMIN-2024";
    if (!secretKey || secretKey !== expectedKey) {
      // Always return generic message — never reveal key mismatch
      return res.json({ message: "If this admin email exists and the secret key is correct, a reset link has been sent" });
    }

    const user = await User.findOne({ email, role: { $in: ["admin", "superadmin"] } });
    if (!user) return res.json({ message: "If this admin email exists and the secret key is correct, a reset link has been sent" });

    const token = crypto.randomBytes(32).toString("hex");
    await User.updateOne({ email }, {
      resetPasswordToken: token,
      resetPasswordExpires: Date.now() + 3600000,
    });

    await sendEmail({
      to: email,
      subject: "[UHC Admin] Password Reset Request",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#f8fafc;color:#0f172a;border-radius:16px;border:1px solid #e2e8f0">
          <h2 style="color:#4255ff">🔐 Admin Password Reset</h2>
          <p>A password reset was requested for your <strong>UHC Admin</strong> account.</p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4255ff;color:white;border-radius:10px;text-decoration:none;font-weight:bold;margin:16px 0">Reset My Password</a>
          <p style="color:#64748b;font-size:0.85rem">This link expires in <strong>1 hour</strong>. If you did not request this, ignore this email.</p>
        </div>
      `
    });

    res.json({ message: "If this admin email exists and the secret key is correct, a reset link has been sent" });
  } catch (err) {
    console.error("Admin forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- SUPERADMIN: RESET ANY USER PASSWORD ----------------
router.post("/admin-reset-user-password", async (req, res) => {
  try {
    const { adminToken, userId, newPassword } = req.body;
    if (!adminToken || !userId || !newPassword) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Verify the requesting user is admin/superadmin
    const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.id);
    if (!admin || !['admin','superadmin'].includes(admin.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, { password: hashed });
    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Admin reset user password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- MANUAL PASSWORD RESET REQUEST ----------------
router.post("/manual-reset-request", async (req, res) => {
  try {
    const { name, email, username } = req.body;

    if (!name || !email || !username) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });

    // Send Email to Admin
    await sendEmail({
      to: "boafokyei3@gmail.com",
      subject: `Manual Password Reset Request from ${name}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #e63946;">Manual Password Reset Request</h2>
          <p>A user is requesting a manual password reset.</p>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Username/Phone:</strong> ${username}</p>
          <hr />
          <p style="font-size: 0.8rem; color: #666;">Please reset their password in the admin panel and contact them securely.</p>
        </div>
      `
    });

    if (user) {
        await createUserActivityLog(
            user._id,
            "PASSWORD_RESET_REQUEST",
            `Manual password reset requested by ${name} (${email})`,
            "WARNING"
        );
    }

    res.json({ message: "Your request has been sent. An administrator will contact you shortly." });
  } catch (err) {
    console.error("Manual reset request error:", err);
    res.status(500).json({ message: "Failed to send request" });
  }
});

// ---------------- FORGOT PASSWORD (DEPRECATED) ----------------
router.post("/forgot-password", async (req, res) => {
  return res.status(400).json({ 
    message: "This feature has been deprecated. Please use the manual reset form." 
  });
});

// ---------------- RESET PASSWORD ----------------
router.post("/reset-password", async (req, res) => {
  try {
    console.log("REQ BODY:", req.body); // 🔥 DEBUG LINE

    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({
        message: "Token and new password required",
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired token",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    await createUserActivityLog(
      user._id,
      "PASSWORD_RESET",
      `User reset their password: ${user.name}`,
      'WARNING'
    );

    res.json({
      message: "Password has been reset successfully",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;