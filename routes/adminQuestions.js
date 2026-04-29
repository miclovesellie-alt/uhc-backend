const express = require("express");
const router = express.Router();

const {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion
} = require("../controllers/adminQuestionsController");


const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

/* GET QUESTIONS */
router.get("/", getQuestions);

/* CREATE QUESTION */
router.post("/", authMiddleware, adminOnly, createQuestion);

/* UPDATE QUESTION */
router.put("/:id", authMiddleware, adminOnly, updateQuestion);

/* DELETE QUESTION */
router.delete("/:id", authMiddleware, adminOnly, deleteQuestion);

/* FIND DUPLICATES */
router.get("/duplicates/find", async (req, res) => {
  try {
    const Question = require("../models/Question");
    const duplicates = await Question.aggregate([
      {
        $group: {
          _id: "$question",
          count: { $sum: 1 },
          ids: { $push: "$_id" },
          docs: { $push: "$$ROOT" }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    res.json(duplicates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;