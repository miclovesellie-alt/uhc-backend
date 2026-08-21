const express = require("express");
const {
  askQuestion,
  getUserQuestions,
  getUserCredits,
  buyCreditsWithPoints,
  explainQuizQuestion,
  adminShortenOptions,
  adminGenerateFromNotes,
  adminGenerateSimilarQuestions
} = require("../controllers/ai.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

// User AI Endpoints
router.get("/credits", authMiddleware, getUserCredits);
router.post("/buy-credits", authMiddleware, buyCreditsWithPoints);
router.post("/question", authMiddleware, askQuestion);
router.post("/explain-question", authMiddleware, explainQuizQuestion);
router.get("/questions", authMiddleware, getUserQuestions);

// Admin AI Endpoints
router.post("/admin/shorten-options", authMiddleware, adminShortenOptions);
router.post("/admin/generate-from-notes", authMiddleware, adminGenerateFromNotes);
router.post("/admin/similar-questions", authMiddleware, adminGenerateSimilarQuestions);

module.exports = router;
