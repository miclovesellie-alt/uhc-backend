const express = require("express");
const router = require("express").Router();
const Book = require("../models/Book");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const multer = require("multer");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { createAdminActivity } = require("../utils/adminLogger");
const { broadcastToAllUsers } = require("../utils/userNotifier");

// Configure Cloudinary storage (auto-reads CLOUDINARY_URL from .env)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: "uhc-library",
    resource_type: "raw", // Required for PDFs, DOCX, PPT, etc.
    public_id: `${Date.now()}${path.extname(file.originalname)}`, // Preserve .pdf, .docx etc. in URL
    allowed_formats: ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"],
  }),
});

const upload = multer({ storage: storage });

// @desc    Get all books
// @route   GET /api/library/books
router.get("/books", async (req, res) => {
  try {
    const { course } = req.query;
    let query = {};
    if (course) query.course = course;
    const books = await Book.find(query).sort({ createdAt: -1 });
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch books" });
  }
});

// @desc    Add a book (Admin with file upload)
// @route   POST /api/library/books
router.post("/books", authMiddleware, adminOnly, upload.single("file"), async (req, res) => {
  try {
    const { title, author, course, description, isDownloadable } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const newBook = await Book.create({
      title,
      author,
      course,
      description,
      fileUrl: req.file.path, // Full Cloudinary URL (permanent, survives redeploys)
      isDownloadable: isDownloadable === "true" || isDownloadable === true,
      uploadedBy: req.userId
    });
    
    // Log Activity
    await createAdminActivity(
      req.userId, 
      'UPLOAD_BOOK', 
      `uploaded a new document: "${title}"`, 
      { type: 'Book', id: newBook._id, details: { title, course }, notifType: 'SUCCESS' }
    );
    
    // Notify users
    await broadcastToAllUsers(`New library document added: "${title}"`, 'INFO', '/library');
    
    res.status(201).json(newBook);
  } catch (err) {
    console.error("Add book error:", err);
    res.status(500).json({ message: "Failed to add book" });
  }
});

const DeletedItem = require("../models/DeletedItem");

// @desc    Delete a book (Move to Recycle Bin)
// @route   DELETE /api/library/books/:id
router.delete("/books/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Book not found" });

    await DeletedItem.create({
      originalId: book._id,
      type: "Book",
      data: book.toObject(),
      deletedBy: req.userId
    });

    await Book.findByIdAndDelete(req.params.id);

    // Log Activity
    await createAdminActivity(
      req.userId, 
      'DELETE_BOOK', 
      `moved the document "${book.title}" to the Recycle Bin`, 
      { type: 'Book', id: book._id, details: { title: book.title }, notifType: 'WARNING' }
    );

    res.json({ message: "Book moved to recycle bin" });
  } catch (err) {
    console.error("Move to recycle bin error:", err);
    res.status(500).json({ message: "Failed to move book to recycle bin", error: err.message });
  }
});

// @desc    Get all courses
router.get("/courses", async (req, res) => {
  try {
    const courses = await Book.distinct("course");
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch courses" });
  }
});

module.exports = router;
