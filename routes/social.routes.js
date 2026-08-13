const express = require("express");
const router  = express.Router();
const Announcement  = require("../models/Announcement");
const User          = require("../models/User");
const { sendEmail } = require("../utils/mail");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const { broadcastToAudience, countAudience } = require("../utils/userNotifier");

const FRONTEND = process.env.FRONTEND_URL || "https://uhcacadamy.com";
const INACTIVE_DAYS = 7;

// ── Audience filter helper (mirrors userNotifier) ──────────────────────────
function audienceFilter(audience) {
  const base = {
    status: "active",
    role:   { $in: ["user", "tutor", "health_worker"] },
    email:  { $exists: true, $ne: "" },
  };
  if (audience === "active") {
    const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
    base.lastLogin = { $gte: cutoff };
  } else if (audience === "inactive") {
    const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
    base.$or = [{ lastLogin: { $lt: cutoff } }, { lastLogin: null }];
  }
  return base;
}

// ── Build email HTML for an announcement ──────────────────────────────────
function buildAnnouncementEmail({ userName, title, message, subject, actionLink }) {
  const emoji = subject === "new_document" ? "📄" : subject === "reminder_login" ? "🔔" : "📢";
  const cta   = subject === "new_document"
    ? { label: "📖 Explore New Materials →", url: `${FRONTEND}/quiz` }
    : subject === "reminder_login"
    ? { label: "🎯 Log In & Continue Learning →", url: `${FRONTEND}/quiz` }
    : { label: "🔗 Open UHC Academy →", url: FRONTEND };

  return `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:40px 32px;border-radius:20px;border:1px solid #e2e8f0">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:2rem;font-weight:900;background:linear-gradient(135deg,#10b981,#0ea5e9);-webkit-background-clip:text;-webkit-text-fill-color:transparent">UHC Academy</div>
    <div style="font-size:0.72rem;letter-spacing:2px;text-transform:uppercase;color:#94a3b8">Universal Health Community</div>
  </div>
  <div style="background:linear-gradient(135deg,#4255ff,#8b5cf6);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px">
    <div style="font-size:2.5rem;margin-bottom:8px">${emoji}</div>
    <h2 style="color:white;margin:0 0 6px;font-size:1.4rem">${title}</h2>
  </div>
  <div style="background:#fff;border-radius:14px;padding:20px;border:1px solid #e2e8f0;margin-bottom:24px;color:#334155;line-height:1.7;font-size:.92rem">
    <p style="margin:0 0 8px">Hi <strong>${userName}</strong>,</p>
    <p style="margin:0">${message.replace(/\n/g, "<br>")}</p>
  </div>
  <a href="${actionLink || cta.url}" style="display:block;padding:14px;background:linear-gradient(135deg,#4255ff,#8b5cf6);color:white;border-radius:12px;text-decoration:none;font-weight:700;font-size:1rem;text-align:center;margin-bottom:12px">${cta.label}</a>
  <p style="color:#94a3b8;font-size:0.72rem;margin:24px 0 0;text-align:center">UHC Academy · Universal Health Community<br>You're receiving this because you're a registered member.</p>
</div>`;
}

// ── GET /api/social/ — active announcements (public, banner display) ────────
router.get("/", async (req, res) => {
  try {
    const announcements = await Announcement.find({
      active:       true,
      deliveryMode: { $in: ["banner", "both"] },
    }).sort({ createdAt: -1 });
    res.json(announcements);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/social/all — all announcements (admin) ────────────────────────
router.get("/all", authMiddleware, adminOnly, async (req, res) => {
  try {
    const all = await Announcement.find()
      .sort({ createdAt: -1 })
      .populate("createdBy", "name");
    res.json(all);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/social/audience-count — preview recipient count (admin) ────────
router.get("/audience-count", authMiddleware, adminOnly, async (req, res) => {
  try {
    const audience = req.query.audience || "all";
    const count    = await countAudience(audience);
    res.json({ count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/social/ — create & broadcast announcement (admin) ─────────────
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      title,
      message,
      type         = "info",
      audience     = "all",
      subject      = "custom",
      deliveryMode = "banner",
    } = req.body;

    if (!title?.trim() || !message?.trim())
      return res.status(400).json({ error: "Title and message are required" });

    // ── Query matched users ───────────────────────────────────────────
    const filter = audienceFilter(audience);
    const users  = await User.find(filter).select("name email _id").lean();
    const recipientCount = users.length;

    // ── 1. Save to DB if banner is included ───────────────────────────
    let ann = null;
    const saveBanner = ["banner", "both"].includes(deliveryMode);
    if (saveBanner) {
      ann = await Announcement.create({
        title, message, type, audience, subject, deliveryMode,
        active: true,
        createdBy: req.userId,
        recipientCount,
      });
    } else {
      // Still save a record for history (inactive/hidden banner)
      ann = await Announcement.create({
        title, message, type, audience, subject, deliveryMode,
        active: false,
        createdBy: req.userId,
        recipientCount,
      });
    }

    // ── 2. In-app notifications (always) ─────────────────────────────
    const notifMsg = `📢 ${title}: ${message.slice(0, 100)}${message.length > 100 ? "…" : ""}`;
    await broadcastToAudience(audience, notifMsg, "POST", "/");

    // ── 3. Email blast (fire-and-forget) ─────────────────────────────
    const sendEmails = ["email", "both"].includes(deliveryMode);
    if (sendEmails && users.length > 0) {
      const annId = ann._id;

      setImmediate(async () => {
        try {
          let sent = 0;
          for (const u of users) {
            await sendEmail({
              to:      u.email,
              subject: `📢 ${title} — UHC Academy`,
              html:    buildAnnouncementEmail({
                userName:   (u.name || "").split(" ")[0] || "there",
                title,
                message,
                subject,
                actionLink: null,
              }),
            });
            sent++;
            if (sent % 50 === 0) await new Promise(r => setTimeout(r, 1000));
          }

          // Mark email as sent on the record
          await Announcement.findByIdAndUpdate(annId, {
            emailSent:   true,
            emailSentAt: new Date(),
          });

          console.log(`✅ Announcement email sent to ${sent} users (${audience})`);
        } catch (emailErr) {
          console.error("Announcement email error:", emailErr.message);
        }
      });
    }

    res.status(201).json({
      ...ann.toObject(),
      recipientCount,
      emailQueued: sendEmails,
    });
  } catch (err) {
    console.error("Announcement create error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/social/:id/toggle — toggle banner active state (admin) ───────
router.patch("/:id/toggle", authMiddleware, adminOnly, async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ error: "Not found" });
    ann.active = !ann.active;
    await ann.save();
    res.json(ann);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/social/:id — delete announcement (admin) ────────────────────
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/social/leaderboard — all users by points ───────────────────────
router.get("/leaderboard", async (req, res) => {
  try {
    const users = await User.find({ role: "user", status: "active" })
      .select("name points streak category country")
      .sort({ points: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/social/suspend/:id — suspend user (admin) ────────────────────
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

// ── PATCH /api/social/unsuspend/:id — unsuspend user (admin) ────────────────
router.patch("/unsuspend/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id,
      { status: "active", suspendedUntil: null, suspendReason: "" },
      { new: true }
    );
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/social/streak — update streak (after quiz completion) ─────────
router.patch("/streak", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const today     = new Date().toDateString();
    const lastDate  = user.lastQuizDate ? new Date(user.lastQuizDate).toDateString() : null;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (lastDate === today) return res.json({ streak: user.streak, message: "Already updated today" });
    const newStreak = lastDate === yesterday ? user.streak + 1 : 1;
    user.streak      = newStreak;
    user.lastQuizDate = new Date();
    await user.save();
    res.json({ streak: newStreak });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
