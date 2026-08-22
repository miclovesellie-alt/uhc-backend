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
      const opts = Array.isArray(q.options) ? q.options.map(o => String(o).trim()).filter(Boolean) : [];
      if (!q.course || !q.question || (opts.length !== 3 && opts.length !== 4) || typeof q.answer !== 'number' || q.answer < 0 || q.answer >= opts.length) {
        throw new Error(`Invalid question format: "${q.question || 'Unknown'}" (Must have 3 or 4 valid options and correct answer index)`);
      }
      return {
        ...q,
        options: opts,
      };
    });

    const createdQuestions = await Question.insertMany(validatedQuestions);

    // Log Activity
    const { createAdminActivity } = require("../utils/adminLogger");

    await createAdminActivity(
      req.userId,
      'BULK_UPLOAD_QUESTIONS',
      `bulk uploaded ${createdQuestions.length} questions`,
      { type: 'Question', details: { count: createdQuestions.length }, notifType: 'SUCCESS' }
    );
    // NOTE: Notifications and emails are no longer sent automatically on upload.
    // Admins use the Announcement Center to notify users of new content.

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