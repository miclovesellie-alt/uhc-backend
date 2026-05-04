const express = require("express");
const router = express.Router();
const https = require("https");
const http = require("http");
const Book = require("../models/Book");
const FeedItem = require("../models/FeedItem");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const path = require("path");

// ── Cloudinary storage for user-submitted books (PDF + PPT only) ──
const bookStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "uhc-library-pending",
    resource_type: "auto",
    public_id: `${Date.now()}${path.extname(file.originalname)}`,
    allowed_formats: ["pdf", "ppt", "pptx"],
  }),
});
const uploadBook = multer({
  storage: bookStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF and PPT/PPTX files are allowed"), false);
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Cloudinary storage for feed post images ──
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "uhc-feed-pending",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1200, crop: "limit", quality: "auto" }],
  }),
});
const uploadImage = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ════════════════════════════════════════════
//  PDF PROXY — fixes CORS for Cloudinary PDFs
//  GET /api/submissions/proxy-pdf?url=ENCODED_URL
// ════════════════════════════════════════════
router.get("/proxy-pdf", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  try {
    const decoded = decodeURIComponent(url);

    // Detect file type from the URL, not Cloudinary's headers (which may be octet-stream)
    const urlLower = decoded.toLowerCase().split("?")[0];
    let contentType = "application/pdf"; // default
    if (urlLower.includes(".pptx") || urlLower.includes("pptx")) {
      contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    } else if (urlLower.includes(".ppt")) {
      contentType = "application/vnd.ms-powerpoint";
    } else if (urlLower.includes(".docx")) {
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (urlLower.includes(".doc")) {
      contentType = "application/msword";
    }

    const protocol = decoded.startsWith("https") ? https : http;
    const proxyReq = protocol.get(decoded, (proxyRes) => {
      // Force correct Content-Type — never trust Cloudinary's octet-stream
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("X-Frame-Options", "ALLOWALL");
      if (proxyRes.headers["content-length"]) {
        res.setHeader("Content-Length", proxyRes.headers["content-length"]);
      }
      res.status(proxyRes.statusCode || 200);
      proxyRes.pipe(res);
    });
    proxyReq.setTimeout(30000, () => {
      proxyReq.destroy();
      if (!res.headersSent) res.status(504).json({ error: "Upstream timeout" });
    });
    proxyReq.on("error", (err) => {
      console.error("Proxy error:", err.message);
      if (!res.headersSent) res.status(502).json({ error: "Failed to fetch document" });
    });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════
//  USER: Submit a book (goes to pending)
//  POST /api/submissions/book
// ════════════════════════════════════════════
router.post("/book", authMiddleware, uploadBook.single("file"), async (req, res) => {
  try {
    const { title, author, course, description } = req.body;
    if (!req.file) return res.status(400).json({ error: "File is required" });
    if (!title || !course) return res.status(400).json({ error: "Title and course are required" });

    const ext = path.extname(req.file.originalname).replace(".", "").toLowerCase();
    const book = await Book.create({
      title, author, course, description,
      fileUrl: req.file.path,
      fileType: ext,
      submittedBy: req.userId,
      uploadedBy: req.userId,
      status: "pending",
    });
    res.status(201).json({ message: "Book submitted for review!", book });
  } catch (err) {
    console.error("Book submission error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════
//  USER: Submit a feed post (goes to pending)
//  POST /api/submissions/feed  (multipart/form-data)
// ════════════════════════════════════════════
router.post("/feed", authMiddleware, uploadImage.single("image"), async (req, res) => {
  try {
    const { title, content, category } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Title and content are required" });
    const user = await require("../models/User").findById(req.userId).select("name");
    const post = await FeedItem.create({
      title, content, category: category || "Health",
      author: user?.name || "Student",
      image: req.file ? req.file.path : undefined, // Cloudinary URL if image attached
      submittedBy: req.userId,
      status: "pending",
    });
    res.status(201).json({ message: "Post submitted for review!", post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════
//  ADMIN: Get all pending items
//  GET /api/submissions/pending
// ════════════════════════════════════════════
router.get("/pending", authMiddleware, adminOnly, async (req, res) => {
  try {
    const [books, posts] = await Promise.all([
      Book.find({ status: "pending" }).populate("submittedBy", "name email").sort({ createdAt: -1 }),
      FeedItem.find({ status: "pending" }).populate("submittedBy", "name email").sort({ createdAt: -1 }),
    ]);
    res.json({ books, posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════
//  ADMIN: Approve a pending book
//  PATCH /api/submissions/book/:id/approve
// ════════════════════════════════════════════
router.patch("/book/:id/approve", authMiddleware, adminOnly, async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, { status: "approved" }, { new: true });
    res.json(book);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: Reject a pending book
router.patch("/book/:id/reject", authMiddleware, adminOnly, async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id,
      { status: "rejected", rejectReason: req.body.reason || "Does not meet requirements" },
      { new: true }
    );
    res.json(book);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════
//  ADMIN: Approve a pending feed post
// ════════════════════════════════════════════
router.patch("/feed/:id/approve", authMiddleware, adminOnly, async (req, res) => {
  try {
    const post = await FeedItem.findByIdAndUpdate(req.params.id, { status: "approved" }, { new: true });
    res.json(post);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: Reject a pending feed post
router.patch("/feed/:id/reject", authMiddleware, adminOnly, async (req, res) => {
  try {
    const post = await FeedItem.findByIdAndUpdate(req.params.id,
      { status: "rejected", rejectReason: req.body.reason || "Does not meet community guidelines" },
      { new: true }
    );
    res.json(post);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Also update library/books GET to only return approved books for regular users
router.get("/my-submissions", authMiddleware, async (req, res) => {
  try {
    const [books, posts] = await Promise.all([
      Book.find({ submittedBy: req.userId }).select("title course status rejectReason createdAt").sort({ createdAt: -1 }),
      FeedItem.find({ submittedBy: req.userId }).select("title status rejectReason createdAt").sort({ createdAt: -1 }),
    ]);
    res.json({ books, posts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
