const User = require("../models/User");
const { createUserActivityLog } = require("../utils/adminLogger");

// @desc    Add points to a user
// @route   POST /api/points/add
exports.addPoints = async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const userId = req.user?.id || req.userId;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.points = (user.points || 0) + (amount || 0);
    
    // For now, just save the user
    await user.save();

    // Notify Admins
    await createUserActivityLog(
      user._id,
      `User earned ${amount} pts: "${user.name}" (${reason})`,
      'SUCCESS'
    );

    res.json({ 
      message: `Earned ${amount} points for ${reason}!`, 
      totalPoints: user.points 
    });
  } catch (err) {
    console.error("Points error:", err);
    res.status(500).json({ message: "Failed to update points" });
  }
};
