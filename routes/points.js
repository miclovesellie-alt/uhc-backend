const express = require("express");
const router = express.Router();
const { addPoints } = require("../controllers/pointsController");
const { authMiddleware } = require("../middleware/auth.middleware");

router.post("/add", authMiddleware, addPoints);

module.exports = router;
