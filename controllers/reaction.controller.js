const Reaction = require("../models/Reaction");

/**
 * @desc    Add or update a reaction to an article
 * @route   POST /api/articles/:articleId/reactions
 * @access  Private
 */
exports.reactToArticle = async (req, res) => {
  try {
    const { type } = req.body;
    const userId = req.user.id;
    const articleId = req.params.articleId;

    let reaction = await Reaction.findOne({ article: articleId, user: userId });

    if (reaction) {
      // Update reaction type
      reaction.type = type;
      await reaction.save();
    } else {
      reaction = await Reaction.create({
        article: articleId,
        user: userId,
        type
      });
    }

    res.status(200).json({ success: true, data: reaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get reactions for an article
 * @route   GET /api/articles/:articleId/reactions
 * @access  Public
 */
exports.getReactions = async (req, res) => {
  try {
    const reactions = await Reaction.find({ article: req.params.articleId })
      .populate("user", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reactions.length,
      data: reactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
