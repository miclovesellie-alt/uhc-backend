const express = require("express");
const {
  createArticle,
  getArticles,
  getArticleById,
  deleteArticle
} = require("../controllers/article.controller");

const {
  addComment,
  getCommentsByArticle,
  deleteComment
} = require("../controllers/comment.controller");

const {
  reactToArticle,
  getReactions
} = require("../controllers/reaction.controller");

const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// ====================
// Article Routes
// ====================

// Get all articles or create new article
router
  .route("/")
  .get(getArticles)
  .post(protect, authorize("tutor", "health_worker"), createArticle);

// Get single article or delete article
router
  .route("/:id")
  .get(getArticleById)
  .delete(protect, deleteArticle);

// ====================
// Comment Routes
// ====================

// List comments for an article
router.get("/:articleId/comments", getCommentsByArticle);

// Add comment
router.post("/:articleId/comments", protect, addComment);

// Delete comment
router.delete("/:articleId/comments/:id", protect, deleteComment);

// ====================
// Reaction Routes
// ====================

// Get reactions for an article
router.get("/:articleId/reactions", getReactions);

// Add/update reaction
router.post("/:articleId/reactions", protect, reactToArticle);

module.exports = router;
