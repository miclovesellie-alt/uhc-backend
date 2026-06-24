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

    // Compute leaderboard rank before adding points (best-effort)
    let rankBefore = null;
    if (!['admin', 'superadmin'].includes(user.role)) {
      try {
        const aboveCountBefore = await User.countDocuments({
          points:  { $gt: user.points || 0 },
          role:    { $in: ['user', 'tutor', 'health_worker'] },
          status:  'active',
          _id:     { $ne: user._id },
        });
        rankBefore = aboveCountBefore + 1;
      } catch (e) {
        console.error("Error computing rank before:", e);
      }
    }

    user.points = (user.points || 0) + (amount || 0);
    await user.save();

    // Compute leaderboard rank after adding points
    let rankAfter = null;
    let overtook = 0;
    if (!['admin', 'superadmin'].includes(user.role)) {
      try {
        const aboveCountAfter = await User.countDocuments({
          points:  { $gt: user.points },
          role:    { $in: ['user', 'tutor', 'health_worker'] },
          status:  'active',
          _id:     { $ne: user._id },
        });
        rankAfter = aboveCountAfter + 1;

        if (rankBefore !== null && rankAfter < rankBefore) {
          // Count users whose points are >= user's old points and < user's new points
          overtook = await User.countDocuments({
            points: { $gte: user.points - amount, $lt: user.points },
            role:   { $in: ['user', 'tutor', 'health_worker'] },
            status: 'active',
            _id:    { $ne: user._id },
          });
        }
      } catch (e) {
        console.error("Error computing rank after:", e);
      }
    }

    // Build a rich admin notification message
    let adminMsg = `"${user.name}" earned ${amount} pts`;
    if (course) adminMsg += ` · Course: ${course}`;
    if (questionsAnswered !== undefined && totalQuestions) {
      const pct = Math.round((questionsAnswered / totalQuestions) * 100);
      adminMsg += ` · ${questionsAnswered}/${totalQuestions} correct (${pct}%)`;
    }

    // Notify Admins — use QUIZ_COMPLETED action so it appears under Quiz tab in daily summary
    await createUserActivityLog(
      user._id,
      "QUIZ_COMPLETED",
      adminMsg,
      "WARNING",
      { course: course || null, questionsAnswered, totalQuestions }
    );

    // Notify User
    const userMsg = course
      ? `You earned ${amount} points for completing the ${course} quiz!`
      : `You earned ${amount} points for ${reason}!`;
    await notifyUser(user._id, userMsg, "SUCCESS");

    res.json({
      message: `Earned ${amount} points for ${reason}!`,
      totalPoints: user.points,
      rankBefore,
      rankAfter,
      overtook
    });
  } catch (err) {
    console.error("Points error:", err);
    res.status(500).json({ message: "Failed to update points" });
  }
};
