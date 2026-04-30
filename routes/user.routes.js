const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/auth"); // your JWT middleware

// GET /api/user - return the logged-in user's info
router.get("/", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password"); // exclude password
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      name: user.name,
      email: user.email,
      points: user.points,
      gender: user.gender,
      profileImage: user.profileImage || null, // optional default
    });
  } catch (err) {
    console.error("Error fetching user:", err.message);
    res.status(500).json({ message: "Server error fetching user data" });
  }
});
// PUT /api/user - update the logged-in user's profile
router.put("/", authMiddleware, async (req, res) => {
  try {
    const { name, phone, category, country, profileImage } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.userId, 
      { name, phone, category, country, profileImage }, 
      { new: true }
    ).select("-password");
    
    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating user:", err.message);
    res.status(500).json({ message: "Server error updating profile" });
  }
});

module.exports = router;
