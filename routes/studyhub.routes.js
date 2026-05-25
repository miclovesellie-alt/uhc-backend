const express = require("express");
const router = express.Router();
const Flashcard    = require("../models/Flashcard");
const StudyNote    = require("../models/StudyNote");
const ResourceLink = require("../models/ResourceLink");
const Question     = require("../models/Question");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

/* ──────────────────────────────────────────────────────
   Helper: convert a Question doc → flashcard-shaped object
────────────────────────────────────────────────────── */
function questionToCard(q) {
  const letters = ["A", "B", "C", "D"];
  const correctText = q.options[q.answer] || "";
  // Build a hint showing all 4 options
  const hint = q.options
    .map((opt, i) => `${letters[i]}) ${opt}`)
    .join("  •  ");
  return {
    _id:      `q_${q._id}`,   // prefix so it never clashes with Flashcard IDs
    question: q.question,
    answer:   correctText,
    hint,
    course:   q.course,
    emoji:    "❓",
    isActive: true,
    _source:  "question",     // internal flag (not stored, just informational)
  };
}

// ─── FLASHCARDS ────────────────────────────────────────────────
// GET all active flashcards (optionally filtered by course)
router.get("/flashcards", async (req, res) => {
  try {
    const query = { isActive: true };
    if (req.query.course) query.course = req.query.course;
    const cards = await Flashcard.find(query).sort({ createdAt: -1 });
    res.json(cards);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch flashcards" });
  }
});

// POST create flashcard (admin only)
router.post("/flashcards", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { question, answer, hint, course, emoji } = req.body;
    if (!question || !answer || !course)
      return res.status(400).json({ message: "question, answer, and course are required" });
    const card = await Flashcard.create({ question, answer, hint, course, emoji, createdBy: req.userId });
    res.status(201).json(card);
  } catch (err) {
    res.status(500).json({ message: "Failed to create flashcard" });
  }
});

// PUT update flashcard (admin only)
router.put("/flashcards/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { question, answer, hint, course, emoji } = req.body;
    const card = await Flashcard.findByIdAndUpdate(
      req.params.id,
      { question, answer, hint, course, emoji },
      { new: true, runValidators: true }
    );
    if (!card) return res.status(404).json({ message: "Flashcard not found" });
    res.json(card);
  } catch (err) {
    res.status(500).json({ message: "Failed to update flashcard" });
  }
});

// DELETE flashcard (admin only)
router.delete("/flashcards/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await Flashcard.findByIdAndDelete(req.params.id);
    res.json({ message: "Flashcard deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete flashcard" });
  }
});

// ─── STUDY NOTES ────────────────────────────────────────────────
// GET all active notes
router.get("/notes", async (req, res) => {
  try {
    const query = { isActive: true };
    if (req.query.course) query.course = req.query.course;
    const notes = await StudyNote.find(query).sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notes" });
  }
});

// POST create note (admin only)
router.post("/notes", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, body, course, emoji, color } = req.body;
    if (!title || !body || !course)
      return res.status(400).json({ message: "title, body, and course are required" });
    const note = await StudyNote.create({ title, body, course, emoji, color, createdBy: req.userId });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ message: "Failed to create note" });
  }
});

// PUT update note (admin only)
router.put("/notes/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, body, course, emoji, color } = req.body;
    const note = await StudyNote.findByIdAndUpdate(
      req.params.id,
      { title, body, course, emoji, color },
      { new: true, runValidators: true }
    );
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: "Failed to update note" });
  }
});

// DELETE note (admin only)
router.delete("/notes/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await StudyNote.findByIdAndDelete(req.params.id);
    res.json({ message: "Note deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete note" });
  }
});

// ─── RESOURCE LINKS ────────────────────────────────────────────
// GET all active resources
router.get("/resources", async (req, res) => {
  try {
    const query = { isActive: true };
    if (req.query.course) query.course = req.query.course;
    const resources = await ResourceLink.find(query).sort({ createdAt: -1 });
    res.json(resources);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch resources" });
  }
});

// POST create resource (admin only)
router.post("/resources", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, url, description, type, course } = req.body;
    if (!title || !url || !course)
      return res.status(400).json({ message: "title, url, and course are required" });
    const resource = await ResourceLink.create({ title, url, description, type, course, createdBy: req.userId });
    res.status(201).json(resource);
  } catch (err) {
    res.status(500).json({ message: "Failed to create resource" });
  }
});

// PUT update resource (admin only)
router.put("/resources/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, url, description, type, course } = req.body;
    const resource = await ResourceLink.findByIdAndUpdate(
      req.params.id,
      { title, url, description, type, course },
      { new: true, runValidators: true }
    );
    if (!resource) return res.status(404).json({ message: "Resource not found" });
    res.json(resource);
  } catch (err) {
    res.status(500).json({ message: "Failed to update resource" });
  }
});

// DELETE resource (admin only)
router.delete("/resources/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await ResourceLink.findByIdAndDelete(req.params.id);
    res.json({ message: "Resource deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete resource" });
  }
});

// ─── ALL DATA in one shot (used by the student page) ────────────
router.get("/all", async (req, res) => {
  try {
    const course = req.query.course || undefined;
    const fcQuery  = course ? { isActive: true, course } : { isActive: true };
    const qFilter  = course ? { course }                 : {};

    const [manualCards, questions, notes, resources] = await Promise.all([
      Flashcard.find({ ...fcQuery, status: { $in: ["approved", undefined] } }).sort({ createdAt: -1 }),
      Question.find(qFilter).select("question options answer course").lean(),
      StudyNote.find(course ? { isActive: true, course } : { isActive: true }).sort({ createdAt: -1 }),
      ResourceLink.find(course ? { isActive: true, course } : { isActive: true }).sort({ createdAt: -1 }),
    ]);

    // Convert questions → flashcard shape and merge after manual cards
    const questionCards = questions.map(questionToCard);
    const flashcards = [...manualCards, ...questionCards];

    res.json({ flashcards, notes, resources });
  } catch (err) {
    console.error("Study Hub /all error:", err);
    res.status(500).json({ message: "Failed to fetch study hub data" });
  }
});

module.exports = router;

