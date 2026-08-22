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

    if (!name || !email || !phone || !password || !category || !country) {
      return res.status(400).json({ message: "Please fill all fields including your mobile / WhatsApp number" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token
    const verifyToken   = crypto.randomBytes(32).toString("hex");
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = new User({
      name,
      email,
      phone: phone || "",
      password: hashedPassword,
      category,
      country,
      isEmailVerified:    false,
      emailVerifyToken:   verifyToken,
      emailVerifyExpires: verifyExpires,
    });

    await user.save();

    // Send verification email
    const FRONTEND = process.env.FRONTEND_URL || "https://uhcacadamy.com";
    const verifyUrl = `${FRONTEND}/verify-email?token=${verifyToken}`;

    await sendEmail({
      to: email,
      subject: "✅ Verify your UHC Academy email",
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:40px 32px;border-radius:20px;border:1px solid #e2e8f0">
          <div style="text-align:center;margin-bottom:24px">
            <div style="font-size:2rem;font-weight:900;background:linear-gradient(135deg,#10b981,#0ea5e9);-webkit-background-clip:text;-webkit-text-fill-color:transparent">UHC Academy</div>
            <div style="font-size:0.8rem;letter-spacing:2px;text-transform:uppercase;color:#94a3b8">Universal Health Community</div>
          </div>
          <h2 style="color:#0f172a;margin:0 0 8px">Welcome, ${name}! 🎉</h2>
          <p style="color:#475569;margin:0 0 24px">You're almost in. Click the button below to verify your email address and activate your account.</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#10b981,#0ea5e9);color:white;border-radius:12px;text-decoration:none;font-weight:700;font-size:1rem">Verify My Email →</a>
          <p style="color:#94a3b8;font-size:0.8rem;margin:24px 0 0">This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="color:#cbd5e1;font-size:0.72rem">Or paste this link in your browser:<br>${verifyUrl}</p>
        </div>
      `
    });

    // Log signup activity
    await createUserActivityLog(
      user._id,
      "USER_SIGNUP",
      `${name} registered — awaiting email verification (${category})`,
      'INFO'
    );

    // Return "requires verification" signal — no JWT yet
    res.status(201).json({ requiresVerification: true, email });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- VERIFY EMAIL ----------------
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: "Token is required" });

    const user = await User.findOne({
      emailVerifyToken:   token,
      emailVerifyExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Verification link is invalid or has expired. Please request a new one." });
    }

    user.isEmailVerified    = true;
    user.emailVerifyToken   = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    await createUserActivityLog(user._id, "EMAIL_VERIFIED", `${user.name} verified their email`, 'INFO');

    res.json({ message: "Email verified successfully! You can now log in." });
  } catch (err) {
    console.error("Email verify error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- RESEND VERIFICATION EMAIL ----------------
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user)           return res.json({ message: "If that account exists, a new verification link has been sent." });
    if (user.isEmailVerified) return res.json({ message: "This account is already verified. Please log in." });

    const verifyToken   = crypto.randomBytes(32).toString("hex");
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.emailVerifyToken   = verifyToken;
    user.emailVerifyExpires = verifyExpires;
    await user.save();

    const FRONTEND  = process.env.FRONTEND_URL || "https://uhcacadamy.com";
    const verifyUrl = `${FRONTEND}/verify-email?token=${verifyToken}`;

    await sendEmail({
      to: email,
      subject: "✅ New verification link — UHC Academy",
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:40px 32px;border-radius:20px;border:1px solid #e2e8f0">
          <div style="text-align:center;margin-bottom:24px">
            <div style="font-size:2rem;font-weight:900;background:linear-gradient(135deg,#10b981,#0ea5e9);-webkit-background-clip:text;-webkit-text-fill-color:transparent">UHC Academy</div>
          </div>
          <h2 style="color:#0f172a">New Verification Link</h2>
          <p style="color:#475569">Here's your new email verification link for <strong>${email}</strong>.</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#10b981,#0ea5e9);color:white;border-radius:12px;text-decoration:none;font-weight:700">Verify My Email →</a>
          <p style="color:#94a3b8;font-size:0.8rem;margin-top:24px">This link expires in <strong>24 hours</strong>.</p>
        </div>
      `
    });

    res.json({ message: "A new verification link has been sent to your email." });
  } catch (err) {
    console.error("Resend verify error:", err);
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

    // Block NEW users who haven't verified their email yet
    // (existing users pre-verification-feature have no emailVerifyToken — they bypass this)
    if (!user.isEmailVerified && user.emailVerifyToken) {
      return res.status(403).json({
        message: "Please verify your email before logging in. Check your inbox.",
        requiresVerification: true,
        email: user.email,
      });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Stamp last login time
    user.lastLogin = new Date();

    // Add login point (Max 1 per 24 hours)
    const now = new Date();
    const lastPoint = user.lastLoginPointDate;
    let gainedPoint = false;

    if (!lastPoint || (now - lastPoint) >= 24 * 60 * 60 * 1000) {
      user.points = (user.points || 0) + 1;
      user.lastLoginPointDate = now;
      gainedPoint = true;
    }
    await user.save();

    // ── Compute leaderboard rank (non-critical, best-effort) ──
    let leaderboardRank = null;
    let overtook = 0;
    if (!['admin', 'superadmin'].includes(user.role)) {
      try {
        const aboveCount = await User.countDocuments({
          points:  { $gt: user.points },
          role:    { $in: ['user', 'tutor', 'health_worker'] },
          status:  'active',
          _id:     { $ne: user._id },
        });
        leaderboardRank = aboveCount + 1;

        if (gainedPoint && user.points > 1) {
          // Count users who are now tied at the user's new score (they were ahead before +1)
          overtook = await User.countDocuments({
            points: user.points,
            role:   { $in: ['user', 'tutor', 'health_worker'] },
            status: 'active',
            _id:    { $ne: user._id },
          });
        }
      } catch { /* non-critical — never block login */ }
    }

    // Notify Admins of User Login
    if (!['admin', 'superadmin'].includes(user.role)) {
      await createUserActivityLog(
        user._id,
        "USER_LOGIN",
        `${user.name} logged in (${user.category || 'User'})`,
        'INFO'
      );
    }

    // Log Activity if Admin
    if (['admin', 'superadmin'].includes(user.role)) {
      await createAdminActivity(
        user._id,
        'ADMIN_LOGIN',
        `${user.name} logged in (Admin)`,
        { type: 'User', id: user._id, details: { name: user.name, role: user.role }, notifType: 'SUCCESS' }
      );
    }

    // Return full user object + rank metadata
    res.json({
      token,
      user:            { ...user.toObject(), password: undefined },
      leaderboardRank,
      overtook,
      gainedPoint,
    });
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
      resetPasswordToken:   token,
      resetPasswordExpires: Date.now() + 3600000,
    });

    const FRONTEND  = process.env.FRONTEND_URL || "https://uhcacadamy.com";
    const resetUrl  = `${FRONTEND}/reset-password/${token}`;

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

// ---------------- FORGOT PASSWORD ----------------
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Always return the same message to avoid user enumeration
    const genericMsg = "If an account with that email exists, a reset link has been sent.";

    const user = await User.findOne({ email });
    if (!user) return res.json({ message: genericMsg });

    const token   = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour

    await User.updateOne({ email }, {
      resetPasswordToken:   token,
      resetPasswordExpires: expires,
    });

    const FRONTEND  = process.env.FRONTEND_URL || "https://uhcacadamy.com";
    const resetUrl  = `${FRONTEND}/reset-password/${token}`;

    await sendEmail({
      to: email,
      subject: "🔐 Reset your UHC Academy password",
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:40px 32px;border-radius:20px;border:1px solid #e2e8f0">
          <div style="text-align:center;margin-bottom:24px">
            <div style="font-size:2rem;font-weight:900;background:linear-gradient(135deg,#10b981,#0ea5e9);-webkit-background-clip:text;-webkit-text-fill-color:transparent">UHC Academy</div>
          </div>
          <h2 style="color:#0f172a;margin:0 0 8px">🔐 Password Reset</h2>
          <p style="color:#475569;margin:0 0 24px">We received a request to reset the password for <strong>${email}</strong>. Click the button below to create a new password.</p>
          <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#4255ff,#8b5cf6);color:white;border-radius:12px;text-decoration:none;font-weight:700;font-size:1rem">Reset My Password →</a>
          <p style="color:#94a3b8;font-size:0.8rem;margin:24px 0 0">This link expires in <strong>1 hour</strong>. If you didn't request a reset, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="color:#cbd5e1;font-size:0.72rem">Or paste this link in your browser:<br>${resetUrl}</p>
        </div>
      `
    });

    await createUserActivityLog(user._id, "PASSWORD_RESET_REQUEST", `Password reset email sent to ${email}`, 'WARNING');
    res.json({ message: genericMsg });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
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

// ---------------- ADMIN: UPDATE OWN PROFILE ----------------
// PUT /api/auth/admin-profile
router.put("/admin-profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(decoded.id);
    if (!admin || !["admin", "superadmin"].includes(admin.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { name, email, password, adminTheme } = req.body;

    if (name) admin.name = name.trim();
    if (email) {
      const existing = await User.findOne({ email, _id: { $ne: admin._id } });
      if (existing) return res.status(400).json({ message: "Email already in use" });
      admin.email = email.trim();
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      admin.password = await bcrypt.hash(password, 10);
    }
    if (adminTheme) admin.adminTheme = adminTheme;

    await admin.save();

    await createAdminActivity(
      admin._id,
      'PROFILE_UPDATE',
      `${admin.name} updated their admin profile`,
      { type: 'User', id: admin._id, details: { name: admin.name }, notifType: 'INFO' }
    );

    const { password: _pw, resetPasswordToken: _t, resetPasswordExpires: _e, ...safeAdmin } = admin.toObject();
    res.json(safeAdmin);
  } catch (err) {
    console.error("Admin profile update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;