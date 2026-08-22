const AIQuestion = require("../models/AIQuestion");
const User = require("../models/User");
const Question = require("../models/Question");
const aiService = require("../services/aiService");

// Helper to check and reset daily user credits or return unlimited for Premium users
const checkAndResetCredits = async (user) => {
  const now = new Date();
  
  // Premium users get unlimited credits
  if (user.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now) {
    return 9999; // Unlimited
  }

  const lastReset = user.lastAiCreditReset ? new Date(user.lastAiCreditReset) : new Date(0);
  
  // If last reset was on a previous calendar day, reset to 10 credits
  if (now.toDateString() !== lastReset.toDateString()) {
    user.aiCredits = 10;
    user.lastAiCreditReset = now;
    await user.save();
  }
  return user.aiCredits;
};

/**
 * @desc Get User's AI credits & points status
 * @route GET /api/ai/credits
 * @access Private
 */
exports.getUserCredits = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id || req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const now = new Date();
    const isPremium = Boolean(user.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now);
    const currentCredits = await checkAndResetCredits(user);
    
    res.status(200).json({
      success: true,
      isPremium,
      premiumPlan: isPremium ? user.premiumPlan : "free",
      premiumExpiresAt: user.premiumExpiresAt,
      credits: isPremium ? "Unlimited" : currentCredits,
      points: user.points || 0
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Purchase additional AI credits using UHC Points (50 points = 10 credits)
 * @route POST /api/ai/buy-credits
 * @access Private
 */
exports.buyCreditsWithPoints = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id || req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const costInPoints = 50;
    const creditsGranted = 10;

    if ((user.points || 0) < costInPoints) {
      return res.status(400).json({
        success: false,
        message: `Insufficient points. You need ${costInPoints} points to buy ${creditsGranted} AI credits.`
      });
    }

    user.points -= costInPoints;
    user.aiCredits = (user.aiCredits || 0) + creditsGranted;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Successfully purchased ${creditsGranted} AI credits for ${costInPoints} points!`,
      credits: user.aiCredits,
      points: user.points
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Ask AI a general study question
 * @route POST /api/ai/question
 * @access Private
 */
exports.askQuestion = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: "Question content is required" });
    }

    const user = await User.findById(req.user?.id || req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const currentCredits = await checkAndResetCredits(user);
    if (currentCredits <= 0) {
      return res.status(403).json({
        success: false,
        code: "CREDITS_EXHAUSTED",
        message: "You have used all your daily AI credits! Purchase more with UHC points or try again tomorrow.",
        credits: 0,
        points: user.points || 0
      });
    }

    // Call AI Service (cascade: Gemini → Groq → Claude)
    const aiResult = await aiService.askAI(question);

    // All 3 providers exhausted — return subscription wall response
    if (aiResult.allExhausted) {
      return res.status(200).json({
        success: true,
        allProvidersExhausted: true,
        exhaustedMessage: aiResult.exhaustedMessage,
        remainingCredits: user.aiCredits
      });
    }

    const responseText = aiResult.text;
    const providerUsed = aiResult.provider || "Google Gemini";

    // Deduct 1 credit if not premium
    const now = new Date();
    const isPremium = Boolean(user.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now);
    if (!isPremium) {
      user.aiCredits = Math.max(0, (user.aiCredits || 10) - 1);
      await user.save();
    }

    // Log query
    const aiQuestionRecord = await AIQuestion.create({
      user: req.user?.id || req.userId,
      question,
      response: responseText,
      type: "chat",
      metadata: { provider: providerUsed }
    });

    res.status(201).json({
      success: true,
      data: {
        ...aiQuestionRecord.toObject(),
        response: responseText,
        provider: providerUsed
      },
      provider: providerUsed,
      failoverMessage: aiResult.failoverMessage || null,
      remainingCredits: user.aiCredits
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Explain Quiz Option (Right vs Wrong selection)
 * @route POST /api/ai/explain-question
 * @access Private
 */
exports.explainQuizQuestion = async (req, res) => {
  try {
    const { questionText, options, selectedIndex, correctIndex } = req.body;

    const user = await User.findById(req.user?.id || req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const currentCredits = await checkAndResetCredits(user);
    if (currentCredits <= 0) {
      return res.status(403).json({
        success: false,
        code: "CREDITS_EXHAUSTED",
        message: "You have used all your daily AI credits! Purchase more with UHC points or try again tomorrow.",
        credits: 0,
        points: user.points || 0
      });
    }

    const aiResult = await aiService.explainQuizOption(questionText, options, selectedIndex, correctIndex);

    if (aiResult.allExhausted) {
      return res.status(200).json({
        success: true,
        allProvidersExhausted: true,
        exhaustedMessage: aiResult.exhaustedMessage,
        remainingCredits: user.aiCredits
      });
    }

    const explanationText = aiResult.text;
    const providerUsed = aiResult.provider || "Google Gemini";

    user.aiCredits -= 1;
    await user.save();

    await AIQuestion.create({
      user: req.user?.id || req.userId,
      question: `Quiz Explanation: ${questionText}`,
      response: explanationText,
      type: "explanation",
      metadata: { selectedIndex, correctIndex, provider: providerUsed }
    });

    res.status(200).json({
      success: true,
      explanation: explanationText,
      provider: providerUsed,
      failoverMessage: aiResult.failoverMessage || null,
      remainingCredits: user.aiCredits
    });
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
    const questions = await AIQuestion.find({ user: req.user?.id || req.userId }).sort({ createdAt: -1 }).limit(30);
    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ADMIN AI CONTROLLERS
// ==========================================

/**
 * @desc Admin: Rewrite and balance long/predictable options for a question
 * @route POST /api/ai/admin/shorten-options
 * @access Private/Admin
 */
exports.adminShortenOptions = async (req, res) => {
  try {
    const { questionId, questionText, options, answer } = req.body;

    let targetQuestionText = questionText;
    let targetOptions = options;
    let targetAnswer = answer;

    let questionDoc = null;
    if (questionId) {
      questionDoc = await Question.findById(questionId);
      if (questionDoc) {
        targetQuestionText = questionDoc.question;
        targetOptions = questionDoc.options;
        targetAnswer = questionDoc.answer;
      }
    }

    if (!targetQuestionText || !targetOptions || targetOptions.length !== 4) {
      return res.status(400).json({ success: false, message: "Valid question and 4 options required" });
    }

    const shortenedOptions = await aiService.shortenAndBalanceOptions(
      targetQuestionText,
      targetOptions,
      targetAnswer
    );

    // If questionId provided, optionally save directly
    if (questionDoc && req.body.autoSave) {
      questionDoc.options = shortenedOptions;
      await questionDoc.save();
    }

    res.status(200).json({
      success: true,
      originalOptions: targetOptions,
      shortenedOptions,
      questionId: questionDoc ? questionDoc._id : null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Admin: Generate quiz questions from study notes
 * @route POST /api/ai/admin/generate-from-notes
 * @access Private/Admin
 */
exports.adminGenerateFromNotes = async (req, res) => {
  try {
    const { notesText, count = 3, course = "General Health", autoSave = false } = req.body;

    if (!notesText || notesText.length < 20) {
      return res.status(400).json({ success: false, message: "Study notes content too short" });
    }

    const generatedQuestions = await aiService.generateQuestionsFromNotes(
      notesText,
      count,
      course
    );

    let savedCount = 0;
    if (autoSave && generatedQuestions.length > 0) {
      const docsToInsert = generatedQuestions.map(q => ({
        course,
        question: q.question,
        options: q.options,
        answer: q.answer,
        uploadedBy: req.user?.id || req.userId
      }));
      const inserted = await Question.insertMany(docsToInsert);
      savedCount = inserted.length;
    }

    res.status(200).json({
      success: true,
      questions: generatedQuestions,
      savedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Admin: Generate similar questions based on existing question
 * @route POST /api/ai/admin/similar-questions
 * @access Private/Admin
 */
exports.adminGenerateSimilarQuestions = async (req, res) => {
  try {
    const { questionId, count = 2 } = req.body;
    const questionDoc = await Question.findById(questionId);
    if (!questionDoc) {
      return res.status(404).json({ success: false, message: "Base question not found" });
    }

    const similarQuestions = await aiService.generateSimilarQuestions(
      questionDoc.question,
      questionDoc.options,
      questionDoc.answer,
      count
    );

    res.status(200).json({
      success: true,
      baseQuestion: questionDoc.question,
      similarQuestions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
