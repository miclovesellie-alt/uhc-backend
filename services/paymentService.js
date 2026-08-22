const axios = require("axios");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { createAdminActivity, createUserActivityLog } = require("../utils/adminLogger");

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "sk_test_7a84d00daba0a8646265dc91956235cc3ea8e952";

const SUBSCRIPTION_PLANS = {
  monthly: {
    id: "monthly",
    title: "Pro Monthly",
    amount: 35, // GHS 35
    durationDays: 30,
    features: [
      "♾️ Unlimited AI study assistant questions daily",
      "⚡ Priority access across Gemini Pro & Claude engines",
      "🧠 In-depth question breakdowns with mnemonics",
      "🎯 Custom AI-generated quiz simulations",
      "👑 Official 'Premium Scholar' profile badge"
    ]
  },
  semester: {
    id: "semester",
    title: "NMC Semester Pass",
    amount: 180, // GHS 180 (Save GH₵ 30)
    durationDays: 120,
    features: [
      "♾️ Unlimited AI access for your entire semester (120 Days)",
      "📚 Complete NMC licensure exam preparation suite",
      "⚡ Highest priority processing & zero rate limits",
      "📄 Unlimited Study Hub downloads & flashcards",
      "💬 Priority WhatsApp tutor support"
    ]
  },
  annual: {
    id: "annual",
    title: "Annual Mastery Pass",
    amount: 290, // GHS 290 (Save GH₵ 130)
    durationDays: 365,
    features: [
      "♾️ Full 1-Year Unlimited access across all courses",
      "🏆 All current & future AI premium capabilities",
      "🩺 Complete nursing & midwifery clinical repository",
      "🌟 VIP status across leaderboards & community"
    ]
  }
};

/**
 * Initialize a Paystack transaction
 */
async function initializePaystackTransaction({ email, amountGhs, reference, callbackUrl, metadata }) {
  try {
    const amountKobo = Math.round(amountGhs * 100); // Paystack expects amount in pesewas / kobo
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amountKobo,
        currency: "GHS",
        reference,
        callback_url: callbackUrl,
        channels: ["mobile_money", "card", "bank"],
        metadata
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json"
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("[Paystack Init Error]", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to initialize Paystack checkout");
  }
}

/**
 * Verify a Paystack transaction by reference
 */
async function verifyPaystackTransaction(reference) {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error("[Paystack Verify Error]", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to verify transaction with Paystack");
  }
}

/**
 * Activate Premium Subscription on a User Account
 */
async function activateUserSubscription(userId, planId, paymentRecordId, approvedByAdminId = null) {
  const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.monthly;
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found for subscription activation");

  const now = new Date();
  let newExpiresAt = new Date();

  // If user is already premium and not expired, extend from existing expiration date
  if (user.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now) {
    newExpiresAt = new Date(new Date(user.premiumExpiresAt).getTime() + (plan.durationDays * 24 * 60 * 60 * 1000));
  } else {
    newExpiresAt = new Date(now.getTime() + (plan.durationDays * 24 * 60 * 60 * 1000));
  }

  user.isPremium = true;
  user.premiumPlan = planId;
  user.premiumExpiresAt = newExpiresAt;
  user.premiumActivatedAt = now;
  user.aiCredits = 9999; // Unlimited virtual credits
  await user.save();

  // Update Payment record
  if (paymentRecordId) {
    await Payment.findByIdAndUpdate(paymentRecordId, {
      status: "success",
      paidAt: now,
      expiresAt: newExpiresAt,
      adminApprovedBy: approvedByAdminId || null
    });
  }

  // Activity logs
  try {
    await createUserActivityLog(
      userId,
      "PREMIUM_ACTIVATED",
      `Upgraded to ${plan.title} (Valid until ${newExpiresAt.toLocaleDateString()})`,
      "SUCCESS"
    );
    await createAdminActivity(
      userId,
      "SUBSCRIPTION_ACTIVATED",
      `${user.name} subscribed to ${plan.title} (GH₵ ${plan.amount})`,
      { type: "Payment", id: paymentRecordId, notifType: "SUCCESS" }
    );
  } catch (logErr) {
    console.error("Error logging payment activation:", logErr);
  }

  return { user, newExpiresAt, plan };
}

module.exports = {
  SUBSCRIPTION_PLANS,
  initializePaystackTransaction,
  verifyPaystackTransaction,
  activateUserSubscription
};
