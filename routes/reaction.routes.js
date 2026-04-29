const express = require("express");
const { reactToArticle, getReactions } = require("../controllers/reaction.controller");
const { protect } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

// Add or update reaction
router.post("/", protect, reactToArticle);

// Get reactions
router.get("/", getReactions);

module.exports = router;
s