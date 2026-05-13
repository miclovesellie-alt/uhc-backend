const express = require("express");
const router  = express.Router();
const Institution = require("../models/Institution");
const User        = require("../models/User");
const { authMiddleware, adminOnly } = require("../middleware/auth.middleware");

// ════════════════════════════════════════════════════════
//  PUBLIC: Search / list approved institutions
//  GET /api/institutions?q=...&type=school&country=Ghana
// ════════════════════════════════════════════════════════
router.get("/", async (req, res) => {
  try {
    const { q = "", type, country } = req.query;
    const filter = { status: "approved" };
    if (q)       filter.name    = { $regex: q, $options: "i" };
    if (type)    filter.type    = type;
    if (country) filter.country = country;
    const institutions = await Institution.find(filter)
      .select("name type country city memberCount")
      .sort({ memberCount: -1, name: 1 })
      .limit(50);
    res.json(institutions);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  USER: Suggest a new institution (goes to admin review)
//  POST /api/institutions/suggest
// ════════════════════════════════════════════════════════
router.post("/suggest", authMiddleware, async (req, res) => {
  try {
    const { name, type, country, city } = req.body;
    if (!name) return res.status(400).json({ error: "Institution name is required" });

    // Check if already exists (case-insensitive)
    const existing = await Institution.findOne({ name: { $regex: `^${name.trim()}$`, $options: "i" } });
    if (existing) {
      if (existing.status === "approved") return res.json({ existing: true, institution: existing });
      return res.status(409).json({ error: "Already submitted and pending review." });
    }

    const inst = await Institution.create({
      name: name.trim(), type: type || "school",
      country: country || "Ghana", city: city || "",
      addedBy: req.userId, status: "pending",
    });
    res.status(201).json({ message: "Suggestion submitted for admin review.", institution: inst });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "This institution already exists." });
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  USER: Set my institution
//  PATCH /api/institutions/select/:id
// ════════════════════════════════════════════════════════
router.patch("/select/:id", authMiddleware, async (req, res) => {
  try {
    const inst = await Institution.findOne({ _id: req.params.id, status: "approved" });
    if (!inst) return res.status(404).json({ error: "Institution not found or not yet approved." });

    // Decrement old institution count
    const user = await User.findById(req.userId);
    if (user.institution && String(user.institution) !== req.params.id) {
      await Institution.findByIdAndUpdate(user.institution, { $inc: { memberCount: -1 } });
    }

    // Update user and increment new institution count
    await User.findByIdAndUpdate(req.userId, {
      institution: inst._id,
      institutionVerified: false, // reset — admin re-verifies
    });
    await Institution.findByIdAndUpdate(inst._id, { $inc: { memberCount: 1 } });

    res.json({ message: "Institution set.", institution: inst });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  USER: Clear my institution
//  PATCH /api/institutions/clear
// ════════════════════════════════════════════════════════
router.patch("/clear", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.institution) {
      await Institution.findByIdAndUpdate(user.institution, { $inc: { memberCount: -1 } });
    }
    await User.findByIdAndUpdate(req.userId, { institution: null, institutionVerified: false });
    res.json({ message: "Institution cleared." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  ADMIN: Get all institutions (pending + approved)
//  GET /api/institutions/admin/all
// ════════════════════════════════════════════════════════
router.get("/admin/all", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const institutions = await Institution.find(filter)
      .populate("addedBy", "name email")
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 });
    res.json(institutions);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  ADMIN: Approve an institution
//  PATCH /api/institutions/admin/:id/approve
// ════════════════════════════════════════════════════════
router.patch("/admin/:id/approve", authMiddleware, adminOnly, async (req, res) => {
  try {
    const inst = await Institution.findByIdAndUpdate(req.params.id,
      { status: "approved", approvedBy: req.userId }, { new: true }
    );
    res.json(inst);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  ADMIN: Reject / delete an institution
//  DELETE /api/institutions/admin/:id
// ════════════════════════════════════════════════════════
router.delete("/admin/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    await Institution.findByIdAndDelete(req.params.id);
    // Clear from all users who had this institution
    await User.updateMany({ institution: req.params.id }, { institution: null, institutionVerified: false });
    res.json({ message: "Institution removed." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  ADMIN: Verify a user's institution (give badge)
//  PATCH /api/institutions/admin/verify-user/:userId
// ════════════════════════════════════════════════════════
router.patch("/admin/verify-user/:userId", authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.userId,
      { institutionVerified: req.body.verified !== false },
      { new: true }
    ).select("name institutionVerified institution");
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
