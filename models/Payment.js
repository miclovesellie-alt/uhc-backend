const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true, // Amount in GHS (e.g. 35)
    },
    amountKobo: {
      type: Number, // Raw amount in pesewas/kobo for Paystack (e.g. 3500)
    },
    currency: {
      type: String,
      default: "GHS",
    },
    plan: {
      type: String,
      enum: ["monthly", "semester", "annual", "credits_pack"],
      default: "monthly",
    },
    planTitle: {
      type: String,
      default: "Pro Monthly (30 Days)",
    },
    durationDays: {
      type: Number,
      default: 30,
    },
    gateway: {
      type: String,
      enum: ["paystack", "manual_momo", "admin_grant"],
      default: "paystack",
    },
    channel: {
      type: String, // e.g. 'mobile_money', 'card', 'bank'
      default: "mobile_money",
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "reversed"],
      default: "pending",
      index: true,
    },
    customerEmail: {
      type: String,
      default: "",
    },
    customerPhone: {
      type: String,
      default: "",
    },
    momoTransactionId: {
      type: String, // For manual mobile money submissions
      default: "",
    },
    paidAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    adminApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
