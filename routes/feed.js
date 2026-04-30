const express = require("express");
const router = express.Router();
const FeedItem = require("../models/FeedItem");
const DeletedItem = require("../models/DeletedItem");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "feed",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
  },
});
const upload = multer({ storage });

const { createAdminActivity } = require("../utils/adminLogger");

// @desc    Get all feed items
router.get("/", async (req, res) => {
  try {
    const items = await FeedItem.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch feed" });
  }
});

// @desc    Add a feed item (Admin)
router.post("/", authMiddleware, adminOnly, upload.single("image"), async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const newItem = await FeedItem.create({
      title,
      content,
      category,
      image: req.file ? req.file.path : null
    });

    // Log Activity
    await createAdminActivity(
      req.userId, 
      'CREATE_FEED_POST', 
      `published a new announcement: "${title}"`, 
      { type: 'Feed', id: newItem._id, details: { title }, notifType: 'SUCCESS' }
    );

    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ message: "Failed to create feed item" });
  }
});

// @desc    Delete (move to recycle bin)
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const item = await FeedItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    await DeletedItem.create({
      originalId: item._id,
      type: "Feed",
      data: item.toObject(),
      deletedBy: req.userId
    });

    await FeedItem.findByIdAndDelete(req.params.id);

    // Log Activity
    await createAdminActivity(
      req.userId, 
      'DELETE_FEED_POST', 
      `moved announcement to recycle bin: "${item.title}"`, 
      { type: 'Feed', id: item._id, details: { title: item.title }, notifType: 'DANGER' }
    );

    res.json({ message: "Moved to recycle bin" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete item" });
  }
});

module.exports = router;
