const express = require("express");
const { askQuestion, getUserQuestions } = require("../controllers/ai.controller");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Ask a question
router.post("/question", protect, askQuestion);

// Get user's questions
router.get("/questions", protect, getUserQuestions);

module.exports = router;
