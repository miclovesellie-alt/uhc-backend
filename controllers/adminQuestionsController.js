const Question = require("../models/Question");
const DeletedItem = require("../models/DeletedItem");
const { createAdminActivity } = require("../utils/adminLogger");

/* =========================================
   GET QUESTIONS (FILTER + SEARCH + PAGINATION)
========================================= */
exports.getQuestions = async (req, res) => {
  try {
    const { course, search, page = 1, limit = 20 } = req.query;

    let query = {};

    if (course) {
      query.course = course;
    }

    if (search) {
      query.question = { $regex: search, $options: "i" };
    }

    const questions = await Question.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Question.countDocuments(query);

    res.json({
      questions,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/* =========================================
   CREATE QUESTION
========================================= */
exports.createQuestion = async (req, res) => {
  try {
    const newQuestion = new Question(req.body);
    const saved = await newQuestion.save();
    
    // Log Activity
    await createAdminActivity(
      req.userId, 
      'CREATE_QUESTION', 
      `added a new question to ${saved.course}`, 
      { type: 'Question', id: saved._id, details: { question: saved.question, course: saved.course }, notifType: 'SUCCESS' }
    );
    
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/* =========================================
   UPDATE QUESTION
========================================= */
exports.updateQuestion = async (req, res) => {
  try {
    const updated = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    // Log Activity
    await createAdminActivity(
      req.userId, 
      'UPDATE_QUESTION', 
      `updated a question in ${updated.course}`, 
      { type: 'Question', id: updated._id, details: { question: updated.question }, notifType: 'INFO' }
    );

    res.json(updated);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/* =========================================
   DELETE QUESTION
========================================= */
exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });

    await DeletedItem.create({
      originalId: question._id,
      type: "Question",
      data: question.toObject(),
      deletedBy: req.user?.id || req.userId
    });

    await Question.findByIdAndDelete(req.params.id);

    // Log Activity
    await createAdminActivity(
      req.userId, 
      'DELETE_QUESTION', 
      `moved a question from ${question.course} to the Recycle Bin`, 
      { type: 'Question', id: question._id, details: { question: question.question }, notifType: 'WARNING' }
    );

    res.json({ message: "Moved to recycle bin" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};