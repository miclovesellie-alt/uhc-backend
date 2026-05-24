const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: "" },
    password: { type: String, required: false, default: null },
    googleId:  { type: String, default: null },
    authProvider: { type: String, default: "local", enum: ["local", "google"] },
    category: { type: String, required: true },
    country: { type: String, required: true },
    points: { type: Number, default: 0 },
    role:   { type: String, default: "user", enum: ["user", "tutor", "health_worker", "admin", "superadmin"] },
    status: { type: String, default: "active", enum: ["active", "banned", "suspended"] },
    suspendedUntil: { type: Date, default: null },
    suspendReason:  { type: String, default: "" },
    streak:         { type: Number, default: 0 },
    lastQuizDate:   { type: Date, default: null },
    lastLoginPointDate: { type: Date },
    lastLogin: { type: Date, default: null },
    adminTheme: { type: String, default: "light", enum: ["light", "dark"] },

    // ===== Institution (for tutors & health workers) =====
    institution:          { type: mongoose.Schema.Types.ObjectId, ref: "Institution", default: null },
    institutionVerified:  { type: Boolean, default: false },

    // ===== Password Reset Fields =====
    resetPasswordToken:   { type: String },
    resetPasswordExpires: { type: Date },

    // ===== Email Verification =====
    isEmailVerified:    { type: Boolean, default: false },
    emailVerifyToken:   { type: String },
    emailVerifyExpires: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);