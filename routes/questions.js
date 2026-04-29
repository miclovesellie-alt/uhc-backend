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

/* =================================
   ADMIN: GET ALL QUESTIONS
   /api/questions/all
================================= */
router.get("/all", async (req, res) => {
  try {
    const questions = await Question.find().sort({ createdAt: -1 });
    res.json(questions);
  } catch (error) {
    console.error("Error fetching all questions:", error);
    res.status(500).json({ message: "Server error while fetching questions" });
  }
});

/* =================================
   ADMIN: CREATE QUESTION
   /api/questions
================================= */
router.post("/", async (req, res) => {
  try {
    const { course, question, options, answer } = req.body;

    const newQuestion = new Question({
      course: course.trim(), // trim extra spaces
      question,
      options,
      answer
    });

    const savedQuestion = await newQuestion.save();

    if (io) io.emit("UPLOAD", savedQuestion);

    res.json(savedQuestion);
  } catch (error) {
    console.error("Error creating question:", error);
    res.status(500).json({ message: "Failed to create question" });
  }
});

/* =================================
   ADMIN: UPDATE QUESTION
   /api/questions/:id
================================= */
router.put("/:id", async (req, res) => {
  try {
    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (io) io.emit("QUESTION_UPDATED", updatedQuestion);

    res.json(updatedQuestion);
  } catch (error) {
    console.error("Error updating question:", error);
    res.status(500).json({ message: "Failed to update question" });
  }
});

/* =================================
   ADMIN: DELETE QUESTION
   /api/questions/:id
================================= */
router.delete("/:id", async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);

    if (io) io.emit("QUESTION_DELETED", req.params.id);

    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error("Error deleting question:", error);
    res.status(500).json({ message: "Failed to delete question" });
  }
});

module.exports = { router, setIO };