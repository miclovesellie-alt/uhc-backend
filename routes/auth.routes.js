const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../utils/mail");
const User = require("../models/User");
const { getSetting } = require("../utils/settings");
const { createAdminActivity, createUserActivityLog } = require("../utils/adminLogger");

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationEmail = async (email, otp) => {
  await sendEmail({
    to: email,
    subject: "[Universal Health] Verify your email address",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#f8fafc;color:#0f172a;border-radius:16px;border:1px solid #e2e8f0">
        <h2 style="color:#4255ff">📧 Verify your Email</h2>
        <p>Welcome to Universal Health! Please use the following 6-digit code to verify your email address and activate your account.</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:4px;color:#0f172a;margin:24px 0;text-align:center;background:#fff;padding:16px;border-radius:8px;border:1px dashed #cbd5e1">${otp}</div>
        <p style="color:#64748b;font-size:0.85rem">This code expires in <strong>15 minutes</strong>.</p>
      </div>
    `
  });
};

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

    const otp = generateOTP();

    const user = new User({
      name,
      email,
      phone: phone || "",
      password: hashedPassword,
      category,
      country,
      isVerified: false,
      otp: otp,
      otpExpires: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
    });

    await user.save();
    
    // Send OTP Email
    await sendVerificationEmail(user.email, otp);

    res.json({ message: "Account created! Please check your email for the verification code.", email: user.email, requiresVerification: true });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- VERIFY EMAIL ----------------
router.post("/verify-email", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isVerified) return res.status(400).json({ message: "Email is already verified" });

    if (user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Log Activity for Admins
    await createUserActivityLog(
      user._id, 
      "USER_SIGNUP",
      `New user verified: "${user.name}" (${user.category})`, 
      'INFO'
    );

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ message: "Email verified successfully", token, user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    console.error("Verify email error:", err);
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

    // Check if verified
    if (!user.isVerified) {
      // Resend OTP if not verified
      const otp = generateOTP();
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      await sendVerificationEmail(user.email, otp);
      
      return res.status(403).json({ 
        message: "Please verify your email to log in. A new code has been sent.", 
        requiresVerification: true,
        email: user.email
      });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Add login point
    user.points = (user.points || 0) + 1;
    await user.save();

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

// ---------------- FORGOT PASSWORD (FIXED PRODUCTION VERSION) ----------------
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        message: "If this email exists, a reset link has been sent",
      });
    }

    // Generate 6-digit OTP
    const otp = generateOTP();

    // 🔥 PRODUCTION FIX: use updateOne instead of save()
    await User.updateOne(
      { email },
      {
        otp: otp,
        otpExpires: Date.now() + 15 * 60 * 1000, // 15 mins
      }
    );

    await sendEmail({
      to: email,
      subject: "[Universal Health] Password Reset Code",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#f8fafc;color:#0f172a;border-radius:16px;border:1px solid #e2e8f0">
          <h2 style="color:#4255ff">🔐 Password Reset Request</h2>
          <p>We received a request to reset your password. Use the following 6-digit code to proceed.</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:4px;color:#0f172a;margin:24px 0;text-align:center;background:#fff;padding:16px;border-radius:8px;border:1px dashed #cbd5e1">${otp}</div>
          <p style="color:#64748b;font-size:0.85rem">This code expires in <strong>15 minutes</strong>. If you did not request this, ignore this email.</p>
        </div>
      `
    });

    res.json({
      message: "If this email exists, a reset code has been sent",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- RESET PASSWORD ----------------
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        message: "Email, OTP, and new password required",
      });
    }

    const user = await User.findOne({
      email: email,
      otp: otp,
      otpExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired token",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpires = undefined;

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