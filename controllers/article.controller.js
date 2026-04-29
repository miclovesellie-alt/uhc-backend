const Article = require("../models/Article");
const { createAdminActivity } = require("../utils/adminLogger");

/**
 * @desc    Create new article
 * @route   POST /api/articles
 * @access  Private (Tutor / Health Worker)
 */
exports.createArticle = async (req, res) => {
  try {
    const article = await Article.create({
      title: req.body.title,
      content: req.body.content,
      category: req.body.category,
      author: req.user.id,
      authorRole: req.user.role
    });

    // Log Activity
    await createAdminActivity(
      req.user.id, 
      'CREATE_ARTICLE', 
      `published a new article: "${req.body.title}"`, 
      { type: 'Article', id: article._id, details: { title: article.title }, notifType: 'SUCCESS' }
    );

    res.status(201).json({
      success: true,
      data: article
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create article",
      error: error.message
    });
  }
};

/**
 * @desc    Get all articles
 * @route   GET /api/articles
 * @access  Public
 */
exports.getArticles = async (req, res) => {
  try {
    const articles = await Article.find()
      .populate("author", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: articles.length,
      data: articles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch articles"
    });
  }
};

/**
 * @desc    Get single article
 * @route   GET /api/articles/:id
 * @access  Public
 */
exports.getArticleById = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate("author", "name role");

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found"
      });
    }

    res.status(200).json({
      success: true,
      data: article
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching article"
    });
  }
};

/**
 * @desc    Delete article
 * @route   DELETE /api/articles/:id
 * @access  Private (Owner / Admin)
 */
exports.deleteArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found"
      });
    }

    // Only author or admin can delete
    if (article.author.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized"
      });
    }

    await article.deleteOne();

    // Log Activity
    await createAdminActivity(
      req.user.id, 
      'DELETE_ARTICLE', 
      `deleted article: "${article.title}"`, 
      { type: 'Article', id: article._id, details: { title: article.title }, notifType: 'DANGER' }
    );

    res.status(200).json({
      success: true,
      message: "Article deleted"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete article"
    });
  }
};
