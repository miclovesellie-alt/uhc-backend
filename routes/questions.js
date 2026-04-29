const express = require("express");
const router = express.Router();
const Question = require("../models/Question");

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

module.exports = { router, setIO };