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

    // Notify users
    await broadcastToAllUsers(`New study materials: ${createdQuestions.length} questions were just added!`, 'INFO', '/quiz');

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