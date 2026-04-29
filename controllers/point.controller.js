const Point = require("../models/Point");
const User = require("../models/User");

/**
 * @desc Add points to a user
 * @route POST /api/points/add
 * @access Private
 */
exports.addPoints = async (req, res) => {
  try {
    const { userId, points } = req.body;

    let userPoints = await Point.findOne({ user: userId });

    if (userPoints) {
      userPoints.points += points;
      await userPoints.save();
    } else {
      userPoints = await Point.create({ user: userId, points });
    }

    res.status(200).json({ success: true, data: userPoints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get leaderboard (top users)
 * @route GET /api/points/leaderboard
 * @access Public
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await Point.find()
      .sort({ points: -1 })
      .limit(10)
      .populate("user", "name role");

    res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
