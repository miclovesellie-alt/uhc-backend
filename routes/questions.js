const express = require("express");
const router = express.Router();
const Question = require("../models/Question");
const AdminNotification = require("../models/AdminNotification");
const { authMiddleware } = require("../middleware/auth.middleware");

// we will inject io later from server.js
let io;

// allow socket injection
const setIO = (_io) => {
  io = _io;
};

/* =================================
   GET QUESTIONS FOR QUIZ
   /api/questions?course=Surgery&limit=20
   Fixed: Case-insensitive course matching
================================= */
router.get("/", async (req, res) => {
  try {
    let { course, limit } = req.query;

    if (!course) {
      return res.status(400).json({ message: "Course is required" });
    }

    const number = parseInt(limit) || 10;

    // Trim spaces and escape special regex characters
    const safeCourse = course.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const questions = await Question.aggregate([
      {
        $match: {
          course: { $regex: new RegExp(`^${safeCourse}$`, "i") }
        }
      },
      { $sample: { size: number } }
    ]);

    res.json(questions);
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ message: "Server error while loading questions" });
  }
});

/* =================================
   REPORT FAULTY QUESTION
   /api/questions/report
================================= */
router.post("/report", authMiddleware, async (req, res) => {
  try {
    const { questionId, reason, questionText } = req.body;

    if (!questionId) {
      return res.status(400).json({ message: "Question ID is required" });
    }

    await Question.findByIdAndUpdate(questionId, {
      isReported: true,
      reportReason: reason || "No reason provided"
    });

    // Use the standardized adminLogger
    const { createUserActivityLog } = require("../utils/adminLogger");
    await createUserActivityLog(
      req.userId,
      "QUESTION_REPORTED",
      `Question Reported: "${questionText || questionId}" \nReason: ${reason || "No reason provided"}`,
      "WARNING"
    );

    res.json({ message: "Report submitted successfully. Thank you!" });
  } catch (error) {
    console.error("Error reporting question:", error);
    res.status(500).json({ message: "Failed to submit report" });
  }
});

module.exports = { router, setIO };