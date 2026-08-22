const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const authMiddleware = require("../middleware/auth");
const User = require("../models/User");
const Payment = require("../models/Payment");
const {
  SUBSCRIPTION_PLANS,
  initializePaystackTransaction,
  verifyPaystackTransaction,
  activateUserSubscription
} = require("../services/paymentService");
const { createAdminActivity, createUserActivityLog } = require("../utils/adminLogger");

// Admin authorization middleware
const adminOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return res.status(403).json({ message: "Admin access required" });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    res.status(500).json({ message: "Server error checking admin privileges" });
  }
};

/**
 * GET /api/payment/plans
 * Returns available subscription tiers & pricing
 */
router.get("/plans", (req, res) => {
  res.json({
    success: true,
    currency: "GHS",
    plans: Object.values(SUBSCRIPTION_PLANS)
  });
});

/**
 * GET /api/payment/my-subscription
 * Returns current user's subscription status
 */
router.get("/my-subscription", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("isPremium premiumPlan premiumExpiresAt premiumActivatedAt aiCredits");
    if (!user) return res.status(404).json({ message: "User not found" });

    const now = new Date();
    const isActive = user.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now;

    res.json({
      success: true,
      isPremium: Boolean(isActive),
      plan: isActive ? user.premiumPlan : "free",
      expiresAt: user.premiumExpiresAt,
      activatedAt: user.premiumActivatedAt,
      daysRemaining: isActive ? Math.max(0, Math.ceil((new Date(user.premiumExpiresAt) - now) / (1000 * 60 * 60 * 24))) : 0,
      aiCredits: isActive ? "Unlimited" : (user.aiCredits || 0)
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching subscription status" });
  }
});

/**
 * POST /api/payment/initialize
 * Initializes Paystack payment for a student
 */
router.post("/initialize", authMiddleware, async (req, res) => {
  try {
    const { planId = "monthly", callbackUrl } = req.body;
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) return res.status(400).json({ message: "Invalid subscription plan selected" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const reference = `UHC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create pending payment record
    const payment = await Payment.create({
      user: user._id,
      reference,
      amount: plan.amount,
      amountKobo: plan.amount * 100,
      currency: "GHS",
      plan: plan.id,
      planTitle: plan.title,
      durationDays: plan.durationDays,
      gateway: "paystack",
      status: "pending",
      customerEmail: user.email,
      customerPhone: user.phone || "",
      metadata: {
        userId: user._id.toString(),
        userName: user.name,
        planId: plan.id
      }
    });

    const initResult = await initializePaystackTransaction({
      email: user.email,
      amountGhs: plan.amount,
      reference,
      callbackUrl: callbackUrl || `${req.headers.origin || "https://uhcacadamy.com"}/dashboard?payment=verify&reference=${reference}`,
      metadata: {
        paymentId: payment._id.toString(),
        userId: user._id.toString(),
        planId: plan.id
      }
    });

    res.json({
      success: true,
      reference,
      authorizationUrl: initResult.data.authorization_url,
      accessCode: initResult.data.access_code
    });
  } catch (err) {
    console.error("[Payment Init Error]", err);
    res.status(500).json({ message: err.message || "Failed to initialize payment" });
  }
});

/**
 * GET /api/payment/verify/:reference
 * Verifies Paystack reference and activates premium immediately
 */
router.get("/verify/:reference", authMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;
    const payment = await Payment.findOne({ reference });
    if (!payment) return res.status(404).json({ message: "Transaction record not found" });

    // If already verified, return success
    if (payment.status === "success") {
      return res.json({
        success: true,
        message: "Payment already verified and active!",
        payment
      });
    }

    // Verify with Paystack
    const verifyResult = await verifyPaystackTransaction(reference);
    const data = verifyResult.data;

    if (data.status === "success") {
      payment.status = "success";
      payment.paidAt = new Date(data.paid_at || Date.now());
      payment.channel = data.channel || "mobile_money";
      await payment.save();

      // Activate User Subscription
      const activation = await activateUserSubscription(
        payment.user,
        payment.plan,
        payment._id
      );

      return res.json({
        success: true,
        message: "🎉 Payment verified successfully! Your UHC Premium is now active.",
        plan: activation.plan,
        expiresAt: activation.newExpiresAt
      });
    } else {
      payment.status = "failed";
      await payment.save();
      return res.status(400).json({
        success: false,
        message: data.gateway_response || "Payment was not successful"
      });
    }
  } catch (err) {
    console.error("[Payment Verify Error]", err);
    res.status(500).json({ message: err.message || "Error verifying payment" });
  }
});

/**
 * POST /api/payment/manual-momo
 * Submits a manual Mobile Money transaction ID for admin verification
 */
router.post("/manual-momo", authMiddleware, async (req, res) => {
  try {
    const { planId = "monthly", momoTransactionId, senderPhone } = req.body;
    if (!momoTransactionId || !momoTransactionId.trim()) {
      return res.status(400).json({ message: "Mobile Money transaction ID or SMS reference is required" });
    }

    const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.monthly;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const reference = `MOMO-MANUAL-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const payment = await Payment.create({
      user: user._id,
      reference,
      amount: plan.amount,
      amountKobo: plan.amount * 100,
      currency: "GHS",
      plan: plan.id,
      planTitle: plan.title,
      durationDays: plan.durationDays,
      gateway: "manual_momo",
      channel: "mobile_money",
      status: "pending",
      customerEmail: user.email,
      customerPhone: senderPhone || user.phone || "",
      momoTransactionId: momoTransactionId.trim(),
      metadata: {
        notes: "Student submitted manual MoMo payment for review"
      }
    });

    // Notify admins
    await createAdminActivity(
      user._id,
      "MANUAL_PAYMENT_SUBMITTED",
      `${user.name} submitted manual MoMo payment (GH₵ ${plan.amount}, ID: ${momoTransactionId})`,
      { type: "Payment", id: payment._id, notifType: "WARNING" }
    );

    res.json({
      success: true,
      message: "Your payment details have been submitted! An admin will confirm and activate your premium within minutes.",
      payment
    });
  } catch (err) {
    res.status(500).json({ message: "Error submitting manual payment" });
  }
});

// ════════════════ ADMIN ROUTES ════════════════ //

/**
 * GET /api/payment/admin/stats
 * Returns overall revenue metrics
 */
router.get("/admin/stats", authMiddleware, adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const totalRevenueAgg = await Payment.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]);

    const monthRevenueAgg = await Payment.aggregate([
      { $match: { status: "success", createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const todayRevenueAgg = await Payment.aggregate([
      { $match: { status: "success", createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const activeSubscribers = await User.countDocuments({
      isPremium: true,
      premiumExpiresAt: { $gt: now }
    });

    const pendingManualReviews = await Payment.countDocuments({
      gateway: "manual_momo",
      status: "pending"
    });

    res.json({
      success: true,
      totalRevenue: totalRevenueAgg[0]?.total || 0,
      totalTransactions: totalRevenueAgg[0]?.count || 0,
      monthRevenue: monthRevenueAgg[0]?.total || 0,
      todayRevenue: todayRevenueAgg[0]?.total || 0,
      activeSubscribers,
      pendingManualReviews
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching admin payment stats" });
  }
});

/**
 * GET /api/payment/admin/transactions
 * Returns transaction list with filters, search, and pagination
 */
router.get("/admin/transactions", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 25, status, plan, search } = req.query;
    const filter = {};

    if (status && status !== "all") filter.status = status;
    if (plan && plan !== "all") filter.plan = plan;

    let query = Payment.find(filter)
      .populate("user", "name email phone category points isPremium")
      .populate("adminApprovedBy", "name")
      .sort({ createdAt: -1 });

    const total = await Payment.countDocuments(filter);
    const transactions = await query
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      transactions
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching transactions" });
  }
});

/**
 * PUT /api/payment/admin/transactions/:id/approve
 * Admin 1-click approval for manual MoMo or pending payments
 */
router.put("/admin/transactions/:id/approve", authMiddleware, adminOnly, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment record not found" });

    const activation = await activateUserSubscription(
      payment.user,
      payment.plan,
      payment._id,
      req.userId
    );

    res.json({
      success: true,
      message: `Payment approved! ${activation.plan.title} activated until ${activation.newExpiresAt.toLocaleDateString()}`,
      payment
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to approve payment" });
  }
});

/**
 * PUT /api/payment/admin/user/:userId/grant-premium
 * Admin manually grants, extends, or revokes premium for any student
 */
router.put("/admin/user/:userId/grant-premium", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { planId = "monthly", durationDays = 30, isRevoke = false } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (isRevoke) {
      user.isPremium = false;
      user.premiumPlan = "free";
      user.premiumExpiresAt = null;
      await user.save();
      return res.json({ success: true, message: `Premium revoked for ${user.name}` });
    }

    const plan = SUBSCRIPTION_PLANS[planId] || { title: "Custom Admin Grant", amount: 0, durationDays };
    const reference = `ADMIN-GRANT-${Date.now()}`;

    const payment = await Payment.create({
      user: user._id,
      reference,
      amount: plan.amount || 0,
      currency: "GHS",
      plan: planId,
      planTitle: plan.title,
      durationDays: Number(durationDays),
      gateway: "admin_grant",
      status: "success",
      paidAt: new Date(),
      adminApprovedBy: req.userId
    });

    const activation = await activateUserSubscription(user._id, planId, payment._id, req.userId);

    res.json({
      success: true,
      message: `Successfully granted ${plan.title} to ${user.name}! Valid until ${activation.newExpiresAt.toLocaleDateString()}`
    });
  } catch (err) {
    res.status(500).json({ message: "Error updating user premium status" });
  }
});

module.exports = router;
