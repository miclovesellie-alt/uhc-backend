const express = require("express");
const router = express.Router();

/* =================================
   UPLOAD DISABLED FOR NOW
================================= */

const Question = require("../models/Question");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

// @desc    Bulk upload questions
// @route   POST /api/upload-questions
// @access  Private/Admin
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "No questions provided" });
    }

    // Basic validation for each question
    const validatedQuestions = questions.map(q => {
      if (!q.course || !q.question || !q.options || q.options.length !== 4 || typeof q.answer !== 'number') {
        throw new Error(`Invalid question format: ${q.question || 'Unknown'}`);
      }
      return {
        ...q,
        // uploadedBy: req.user?._id // We'll add this if we have auth user info
      };
    });

    const createdQuestions = await Question.insertMany(validatedQuestions);

    // Log Activity
    const { createAdminActivity } = require("../utils/adminLogger");
    const { broadcastToAllUsers } = require("../utils/userNotifier");
    
    await createAdminActivity(
      req.userId, 
      'BULK_UPLOAD_QUESTIONS', 
      `bulk uploaded ${createdQuestions.length} questions`, 
      { type: 'Question', details: { count: createdQuestions.length }, notifType: 'SUCCESS' }
    );

    // In-app push notification to all users
    await broadcastToAllUsers(`New study materials: ${createdQuestions.length} questions were just added!`, 'INFO', '/quiz');

    // ── Fire-and-forget email blast ──────────────────────────────────
    setImmediate(async () => {
      try {
        const User = require("../models/User");
        const { sendEmail } = require("../utils/mail");
        const FRONTEND = process.env.FRONTEND_URL || "https://uhcacadamy.com";

        // Summarise by course
        const courseGroups = {};
        for (const q of createdQuestions) {
          courseGroups[q.course] = (courseGroups[q.course] || 0) + 1;
        }
        const courseSummary = Object.entries(courseGroups)
          .map(([c, n]) => `<span style="display:inline-block;background:rgba(66,85,255,.1);color:#4255ff;border-radius:6px;padding:2px 10px;font-size:.78rem;font-weight:700;margin:3px">${c} (${n})</span>`)
          .join(" ");

        const users = await User.find({
          status: "active",
          role:   { $in: ["user", "tutor", "health_worker"] },
          email:  { $exists: true, $ne: "" },
        }).select("email name").lean();

        let sent = 0;
        for (const u of users) {
          await sendEmail({
            to: u.email,
            subject: `📚 ${createdQuestions.length} new questions added — UHC Academy`,
            html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:40px 32px;border-radius:20px;border:1px solid #e2e8f0">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:2rem;font-weight:900;background:linear-gradient(135deg,#10b981,#0ea5e9);-webkit-background-clip:text;-webkit-text-fill-color:transparent">UHC Academy</div>
  </div>
  <div style="background:linear-gradient(135deg,#4255ff,#8b5cf6);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px">
    <div style="font-size:2.5rem;margin-bottom:8px">🆕</div>
    <h2 style="color:white;margin:0 0 6px;font-size:1.4rem">New Questions Added!</h2>
    <p style="color:rgba(255,255,255,.8);margin:0;font-size:.9rem"><strong>${createdQuestions.length} new questions</strong> just landed in the study bank</p>
  </div>
  <div style="background:#fff;border-radius:14px;padding:16px;border:1px solid #e2e8f0;margin-bottom:24px">
    <div style="font-size:.72rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Courses Updated</div>
    <div>${courseSummary}</div>
  </div>
  <a href="${FRONTEND}/quiz" style="display:block;padding:14px;background:linear-gradient(135deg,#4255ff,#8b5cf6);color:white;border-radius:12px;text-decoration:none;font-weight:700;font-size:1rem;text-align:center;margin-bottom:12px">🎯 Start Practising Now →</a>
  <a href="${FRONTEND}/leaderboard" style="display:block;padding:12px;background:#f1f5f9;color:#4255ff;border-radius:12px;text-decoration:none;font-weight:600;font-size:.88rem;text-align:center">🏆 View Leaderboard</a>
  <p style="color:#94a3b8;font-size:0.72rem;margin:24px 0 0;text-align:center">UHC Academy · Universal Health Community</p>
</div>`,
          });
          sent++;
          if (sent % 50 === 0) await new Promise(r => setTimeout(r, 1000)); // rate-limit
        }
        console.log(`✅ New-questions email sent to ${sent} users`);
      } catch (emailErr) {
        console.error("Bulk upload email error:", emailErr.message);
      }
    });

    res.status(201).json({
      message: `${createdQuestions.length} questions uploaded successfully`,
      count: createdQuestions.length
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    res.status(400).json({ message: err.message || "Failed to upload questions" });
  }
});

module.exports = router;