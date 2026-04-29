const express = require("express");
const router = express.Router();
const Settings = require("../models/Settings");

const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const { createAdminActivity } = require("../utils/adminLogger");

// Get a setting by key
router.get("/:key", async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: req.params.key });
    if (!setting) {
      return res.json({ key: req.params.key, value: null });
    }
    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: "Error fetching setting" });
  }
});

// Update or create a setting
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  const { key, value } = req.body;
  try {
    const setting = await Settings.findOneAndUpdate(
      { key },
      { value, updatedAt: Date.now() },
      { upsert: true, new: true }
    );

    // Log Activity
    await createAdminActivity(
      req.userId, 
      'SYSTEM_CONFIG_CHANGE', 
      `updated system setting: ${key} to ${value}`, 
      { type: 'Setting', id: key, details: { key, value }, notifType: 'WARNING' }
    );

    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: "Error saving setting" });
  }
});

module.exports = router;
