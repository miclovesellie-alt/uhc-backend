const express = require("express");
const router = express.Router();
const FeedItem = require("../models/FeedItem");
const DeletedItem = require("../models/DeletedItem");
const User = require("../models/User");
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

// @desc    Edit a feed item (Admin)
router.put("/:id", authMiddleware, adminOnly, upload.single("image"), async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const item = await FeedItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.title = title || item.title;
    item.content = content || item.content;
    item.category = category || item.category;

    if (req.file) {
      item.image = req.file.path;
    }

    await item.save();

    // Log Activity
    await createAdminActivity(
      req.userId, 
      'EDIT_FEED_POST', 
      `updated announcement: "${item.title}"`, 
      { type: 'Feed', id: item._id, details: { title: item.title }, notifType: 'INFO' }
    );

    res.json(item);
  } catch (err) {
    res.status(500).json({ message: "Failed to update item" });
  }
});

// @desc    Like a feed item
router.post("/:id/like", authMiddleware, async (req, res) => {
  try {
    const item = await FeedItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const userIdStr = req.userId.toString();
    const hasLiked = item.likedBy && item.likedBy.includes(userIdStr);

    if (hasLiked) {
      item.likedBy = item.likedBy.filter(id => id !== userIdStr);
      item.likes = Math.max(0, item.likes - 1);
    } else {
      if (!item.likedBy) item.likedBy = [];
      item.likedBy.push(userIdStr);
      item.likes += 1;
    }

    await item.save();

    res.json({ likes: item.likes, likedBy: item.likedBy });
  } catch (err) {
    res.status(500).json({ message: "Failed to like item" });
  }
});

// @desc    Add a comment to a feed item
router.post("/:id/comment", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Comment text is required" });

    const item = await FeedItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const userIdStr = req.userId.toString();
    
    // Check comment limit (max 3 per user per post)
    const userCommentsCount = item.comments.filter(c => c.userId === userIdStr).length;
    if (userCommentsCount >= 3) {
      return res.status(400).json({ message: "You have reached the maximum limit of 3 comments per post." });
    }

    const newComment = {
      userId: userIdStr,
      name: user.name,
      text: text,
      createdAt: new Date()
    };

    item.comments.push(newComment);
    await item.save();

    res.json(item.comments);
  } catch (err) {
    res.status(500).json({ message: "Failed to add comment" });
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
