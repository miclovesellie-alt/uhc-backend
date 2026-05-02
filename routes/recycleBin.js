const express = require("express");
const router = express.Router();
const DeletedItem = require("../models/DeletedItem");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const Question = require("../models/Question");
const Book = require("../models/Book");
const FeedItem = require("../models/FeedItem");
const { createAdminActivity } = require("../utils/adminLogger");

// @desc    Get all items in recycle bin
router.get("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const items = await DeletedItem.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch recycle bin" });
  }
});

// @desc    Restore an item
router.post("/restore/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const item = await DeletedItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    if (item.type === "Question") {
      await Question.create(item.data);
    } else if (item.type === "Book") {
      await Book.create(item.data);
    } else if (item.type === "Feed") {
      await FeedItem.create(item.data);
    }

    await DeletedItem.findByIdAndDelete(req.params.id);

    // Log Activity
    await createAdminActivity(
      req.userId, 
      'RESTORE_ITEM', 
      `restored a ${item.type}: "${item.data.title || item.data.question || 'Untitled Item'}"`, 
      { type: item.type, id: item.originalId, details: { title: item.data.title }, notifType: 'SUCCESS' }
    );

    res.json({ message: "Item restored successfully" });
  } catch (err) {
    console.error("Restore error:", err);
    res.status(500).json({ message: "Failed to restore item", error: err.message });
  }
});

// @desc    Empty recycle bin
router.delete("/empty", authMiddleware, adminOnly, async (req, res) => {
  try {
    await DeletedItem.deleteMany({});
    
    // Log Activity
    await createAdminActivity(
      req.userId, 
      'EMPTY_RECYCLE_BIN', 
      `emptied the recycle bin`, 
      { type: 'System', id: req.userId, details: {}, notifType: 'DANGER' }
    );

    res.json({ message: "Recycle bin emptied" });
  } catch (err) {
    console.error("Empty bin error:", err);
    res.status(500).json({ message: "Failed to empty recycle bin" });
  }
});

// @desc    Permanently delete
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const item = await DeletedItem.findById(req.params.id);
    await DeletedItem.findByIdAndDelete(req.params.id);

    // Log Activity
    if (item) {
      await createAdminActivity(
        req.userId, 
        'PERMANENT_DELETE', 
        `permanently deleted a ${item.type}: "${item.data.title || item.data.question || 'Untitled Item'}"`, 
        { type: item.type, id: item.originalId, details: { title: item.data.title }, notifType: 'DANGER' }
      );
    }

    res.json({ message: "Item permanently deleted" });
  } catch (err) {
    console.error("Permanent delete error:", err);
    res.status(500).json({ message: "Failed to delete item" });
  }
});

module.exports = router;
