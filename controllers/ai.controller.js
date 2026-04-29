const AIQuestion = require("../models/AIQuestion");

/**
 * @desc Ask AI a question
 * @route POST /api/ai/question
 * @access Private
 */
exports.askQuestion = async (req, res) => {
  try {
    const { question } = req.body;

    // For now, just store question; you can integrate AI here
    const aiQuestion = await AIQuestion.create({
      user: req.user.id,
      question,
      response: "This is a placeholder AI response." // Replace with real AI later
    });

    res.status(201).json({ success: true, data: aiQuestion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get all AI questions of user
 * @route GET /api/ai/questions
 * @access Private
 */
exports.getUserQuestions = async (req, res) => {
  try {
    const questions = await AIQuestion.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
