const express = require("express");
const {
  addComment,
  getCommentsByArticle,
  deleteComment
} = require("../controllers/comment.controller");

const { protect } = require("../middleware/auth");

const router = express.Router({ mergeParams: true }); // mergeParams allows access to articleId from parent route

// Get comments for an article
router.get("/", getCommentsByArticle);

// Add comment (authenticated users)
router.post("/", protect, addComment);

// Delete comment (owner or admin)
router.delete("/:id", protect, deleteComment);

module.exports = router;
