const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/auth"); // your JWT middleware

// GET /api/user/leaderboard - return top 5 users by points
router.get("/leaderboard", async (req, res) => {
  try {
    const topUsers = await User.find({ status: "active", role: "user" })
      .sort({ points: -1 })
      .limit(5)
      .select("name category points");
    
    res.json(topUsers);
  } catch (err) {
    console.error("Error fetching leaderboard:", err.message);
    res.status(500).json({ message: "Server error fetching leaderboard" });
  }
});

// GET /api/user - return the logged-in user's info
router.get("/", authMiddleware, async (req, res) => {
  try {
    // Exclude password and version key
    const user = await User.findById(req.userId).select("-password -__v");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err.message);
    res.status(500).json({ message: "Server error fetching user data" });
  }
});
// PUT /api/user - update the logged-in user's profile
router.put("/", authMiddleware, async (req, res) => {
  try {
    const { name, phone, category, country, profileImage } = req.body;
    const oldUser = await User.findById(req.userId);
    const updatedUser = await User.findByIdAndUpdate(
      req.userId, 
      { name, phone, category, country, profileImage }, 
      { new: true }
    ).select("-password");
    
    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    // Notify admins when a user adds/updates their phone number
    if (phone && (!oldUser?.phone || oldUser.phone !== phone)) {
      try {
        const { createAdminActivity, createUserActivityLog } = require("../utils/adminLogger");
        await createUserActivityLog(
          req.userId,
          "PHONE_UPDATED",
          `${updatedUser.name} set mobile/WhatsApp number: ${phone}`,
          "SUCCESS"
        );
        await createAdminActivity(
          req.userId,
          "USER_PHONE_UPDATED",
          `${updatedUser.name} set mobile/WhatsApp number: ${phone}`,
          { type: "User", id: req.userId, details: { name: updatedUser.name, phone }, notifType: "SUCCESS" }
        );
      } catch (logErr) {
        console.error("Error logging phone update activity:", logErr);
      }
    }

    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating user:", err.message);
    res.status(500).json({ message: "Server error updating profile" });
  }
});

module.exports = router;
