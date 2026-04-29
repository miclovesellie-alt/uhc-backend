const express = require("express");
const { addPoints, getLeaderboard } = require("../controllers/point.controller");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Add points for engagement
router.post("/add", protect, addPoints);

// Get leaderboard
router.get("/leaderboard", getLeaderboard);

module.exports = router;
