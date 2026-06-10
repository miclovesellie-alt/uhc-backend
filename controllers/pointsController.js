const User = require("../models/User");
const { createUserActivityLog } = require("../utils/adminLogger");
const { notifyUser } = require("../utils/userNotifier");

// @desc    Add points to a user
// @route   POST /api/points/add
exports.addPoints = async (req, res) => {
  try {
    const { amount, reason, course, questionsAnswered, totalQuestions } = req.body;
    const userId = req.user?.id || req.userId;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.points = (user.points || 0) + (amount || 0);
    await user.save();

    // Build a rich admin notification message
    let adminMsg = `"${user.name}" earned ${amount} pts`;
    if (course) adminMsg += ` · Course: ${course}`;
    if (questionsAnswered !== undefined && totalQuestions) {
      const pct = Math.round((questionsAnswered / totalQuestions) * 100);
      adminMsg += ` · ${questionsAnswered}/${totalQuestions} correct (${pct}%)`;
    }

    // Notify Admins — use QUIZ_COMPLETED action + WARNING type so it appears under Quiz tab
    await createUserActivityLog(
      user._id,
      "QUIZ_COMPLETED",
      adminMsg,
      "WARNING"
    );

    // Notify User
    const userMsg = course
      ? `You earned ${amount} points for completing the ${course} quiz!`
      : `You earned ${amount} points for ${reason}!`;
    await notifyUser(user._id, userMsg, "SUCCESS");

    res.json({
      message: `Earned ${amount} points for ${reason}!`,
      totalPoints: user.points,
    });
  } catch (err) {
    console.error("Points error:", err);
    res.status(500).json({ message: "Failed to update points" });
  }
};
