const Comment = require("../models/Comment");
const Article = require("../models/Article");

/**
 * @desc    Add comment to article
 * @route   POST /api/articles/:articleId/comments
 * @access  Private (All authenticated users)
 */
exports.addComment = async (req, res) => {
  try {
    const article = await Article.findById(req.params.articleId);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found"
      });
    }

    const comment = await Comment.create({
      article: req.params.articleId,
      user: req.user.id,
      text: req.body.text
    });

    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to add comment"
    });
  }
};

/**
 * @desc    Get comments for an article
 * @route   GET /api/articles/:articleId/comments
 * @access  Public
 */
exports.getCommentsByArticle = async (req, res) => {
  try {
    const comments = await Comment.find({
      article: req.params.articleId
    })
      .populate("user", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: comments.length,
      data: comments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch comments"
    });
  }
};

/**
 * @desc    Delete comment
 * @route   DELETE /api/comments/:id
 * @access  Private (Owner / Admin)
 */
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    if (
      comment.user.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized"
      });
    }

    await comment.deleteOne();

    res.status(200).json({
      success: true,
      message: "Comment deleted"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete comment"
    });
  }
};
