const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: "" },
    password: { type: String, required: true },
    category: { type: String, required: true },
    country: { type: String, required: true },
    points: { type: Number, default: 0 },
    role:   { type: String, default: "user", enum: ["user", "admin", "superadmin"] },
    status: { type: String, default: "active", enum: ["active", "banned"] },
    lastLoginPointDate: { type: Date },

    // ===== Password Reset Fields =====
    resetPasswordToken:   { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);