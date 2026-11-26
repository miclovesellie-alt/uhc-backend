const express = require("express");
const router = express.Router({ mergeParams: true });
const mongoose = require("mongoose");

const Community = require("../models/Community");
const CommunityMember = require("../models/CommunityMember");
const CommunitySession = require("../models/CommunitySession");
const SessionResult = require("../models/SessionResult");
const Question = require("../models/Question");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth.middleware");
const { notifyUser } = require("../utils/userNotifier");

// io is injected via setIO
let _io = null;
function setIO(io) {
  _io = io;
}

// ── Helper: strip answer field from questions before sending to client ──────
function stripAnswers(questions) {
  return questions.map((q) => {
    const obj = typeof q.toObject === "function" ? q.toObject() : { ...q };
    delete obj.answer;
    return obj;
  });
}

// ── Helper: check if user is active member of community ────────────────────
async function getActiveMember(communityId, userId) {
  return CommunityMember.findOne({
    community: communityId,
    user: userId,
    status: "active",
  });
}

// ── POST /:communityId/sessions — Create session ───────────────────────────
router.post("/:communityId/sessions", authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const { course, questionCount, timeLimit, scheduledAt } = req.body;

    if (!course || !questionCount || !timeLimit) {
      return res.status(400).json({ message: "course, questionCount, and timeLimit are required" });
    }

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: "Community not found" });

    // Admin or co-admin only
    const myMember = await CommunityMember.findOne({
      community: communityId,
      user: req.userId,
      status: "active",
      role: { $in: ["admin", "co-admin"] },
    });
    if (!myMember) return res.status(403).json({ message: "Only admin or co-admin can create sessions" });

    // Sample questions from DB
    const questions = await Question.aggregate([
      { $match: { course: { $regex: course, $options: "i" } } },
      { $sample: { size: parseInt(questionCount) } },
    ]);

    if (questions.length === 0) {
      return res.status(404).json({ message: "No questions found for this course" });
    }

    const session = await CommunitySession.create({
      community: communityId,
      createdBy: req.userId,
      course,
      questionCount: questions.length,
      timeLimit: parseInt(timeLimit),
      questions,
      scheduledAt: scheduledAt || undefined,
      status: "waiting",
    });

    // Notify all active members
    const members = await CommunityMember.find({ community: communityId, status: "active" }).lean();
    const notifyPromises = members
      .filter((m) => m.user.toString() !== req.userId.toString())
      .map((m) =>
        notifyUser(
          m.user,
          `📝 A new quiz session for "${course}" has been created in "${community.name}"`,
          "INFO",
          `${process.env.FRONTEND_URL || "https://uhcacadamy.com"}/communities/${communityId}/sessions/${session._id}`
        )
      );
    await Promise.all(notifyPromises);

    res.status(201).json(session);
  } catch (err) {
    console.error("Create session error:", err);
    res.status(500).json({ message: "Failed to create session" });
  }
});

// ── GET /:communityId/sessions — List sessions (paginated) ─────────────────
router.get("/:communityId/sessions", authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const myMember = await getActiveMember(communityId, req.userId);
    if (!myMember) return res.status(403).json({ message: "Access denied" });

    const [sessions, total] = await Promise.all([
      CommunitySession.find({ community: communityId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-questions") // don't send question pool in list
        .lean(),
      CommunitySession.countDocuments({ community: communityId }),
    ]);

    res.json({ sessions, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("List sessions error:", err);
    res.status(500).json({ message: "Failed to fetch sessions" });
  }
});

// ── GET /:communityId/sessions/:sessionId — Session detail ─────────────────
router.get("/:communityId/sessions/:sessionId", authMiddleware, async (req, res) => {
  try {
    const { communityId, sessionId } = req.params;

    const myMember = await getActiveMember(communityId, req.userId);
    if (!myMember) return res.status(403).json({ message: "Access denied" });

    const session = await CommunitySession.findOne({
      _id: sessionId,
      community: communityId,
    }).lean();
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Strip answers from questions
    const safeSession = { ...session, questions: stripAnswers(session.questions || []) };

    if (session.status === "active" || session.status === "completed") {
      const results = await SessionResult.find({ session: sessionId })
        .populate("user", "name category")
        .sort({ score: -1 })
        .lean();
      return res.json({ session: safeSession, results });
    }

    res.json({ session: safeSession });
  } catch (err) {
    console.error("Get session detail error:", err);
    res.status(500).json({ message: "Failed to fetch session" });
  }
});

// ── POST /:communityId/sessions/:sessionId/start — Start session ───────────
router.post("/:communityId/sessions/:sessionId/start", authMiddleware, async (req, res) => {
  try {
    const { communityId, sessionId } = req.params;
    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: "Community not found" });

    // Admin or co-admin
    const myMember = await CommunityMember.findOne({
      community: communityId,
      user: req.userId,
      status: "active",
      role: { $in: ["admin", "co-admin"] },
    });
    if (!myMember) return res.status(403).json({ message: "Only admin or co-admin can start sessions" });

    const session = await CommunitySession.findOne({ _id: sessionId, community: communityId });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.status !== "waiting") {
      return res.status(400).json({ message: "Session has already been started or completed" });
    }

    session.status = "active";
    session.startedAt = new Date();
    await session.save();

    // Emit to community socket room
    if (_io) {
      _io.to(`community:${communityId}`).emit("community:session:start", {
        sessionId: session._id,
        questions: stripAnswers(session.questions || []),
        timeLimit: session.timeLimit,
      });
    }

    // Notify all active members
    const members = await CommunityMember.find({ community: communityId, status: "active" }).lean();
    const notifyPromises = members.map((m) =>
      notifyUser(
        m.user,
        `🚀 A quiz session has started in "${community.name}"! Join now!`,
        "INFO",
        `${process.env.FRONTEND_URL || "https://uhcacadamy.com"}/communities/${communityId}/sessions/${session._id}`
      )
    );
    await Promise.all(notifyPromises);

    res.json({ message: "Session started", session: { ...session.toObject(), questions: stripAnswers(session.questions || []) } });
  } catch (err) {
    console.error("Start session error:", err);
    res.status(500).json({ message: "Failed to start session" });
  }
});

// ── POST /:communityId/sessions/:sessionId/submit — Submit answers ─────────
router.post("/:communityId/sessions/:sessionId/submit", authMiddleware, async (req, res) => {
  try {
    const { communityId, sessionId } = req.params;
    const { answers } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: "answers must be an array" });
    }

    // Must be active member
    const myMember = await getActiveMember(communityId, req.userId);
    if (!myMember) return res.status(403).json({ message: "Access denied" });

    const session = await CommunitySession.findOne({ _id: sessionId, community: communityId });
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (session.status !== "active") {
      return res.status(400).json({ message: "Session is not active" });
    }

    // Prevent double submit
    const existingResult = await SessionResult.findOne({ session: sessionId, user: req.userId });
    if (existingResult) return res.status(409).json({ message: "You have already submitted this session" });

    // Build question map from stored session questions
    const questionMap = {};
    (session.questions || []).forEach((q) => {
      const qId = (q._id || q.id || "").toString();
      questionMap[qId] = q;
    });

    // Score the answers
    let score = 0;
    let totalTime = 0;
    const scoredAnswers = answers.map((a) => {
      const q = questionMap[a.questionId];
      const correct = q ? q.answer === a.selectedIndex : false;
      if (correct) score++;
      totalTime += a.timeTaken || 0;
      return {
        questionId: a.questionId,
        selectedIndex: a.selectedIndex,
        correct,
        timeTaken: a.timeTaken || 0,
      };
    });

    const totalQuestions = session.questions.length;
    const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    const result = await SessionResult.create({
      session: sessionId,
      community: communityId,
      user: req.userId,
      answers: scoredAnswers,
      score,
      totalQuestions,
      accuracy,
      timeTaken: totalTime,
      completedAt: new Date(),
    });

    // Emit updated leaderboard
    const leaderboard = await SessionResult.find({ session: sessionId })
      .populate("user", "name category")
      .sort({ score: -1 })
      .lean();

    if (_io) {
      _io.to(`community:${communityId}`).emit("community:session:result", {
        sessionId,
        leaderboard,
      });
    }

    // Check if all active members have submitted
    const activeMembers = await CommunityMember.find({ community: communityId, status: "active" }).lean();
    const submittedCount = await SessionResult.countDocuments({ session: sessionId });
    if (submittedCount >= activeMembers.length) {
      session.status = "completed";
      session.endedAt = new Date();
      await session.save();
    }

    res.status(201).json({ result, score, accuracy });
  } catch (err) {
    console.error("Submit session error:", err);
    res.status(500).json({ message: "Failed to submit session" });
  }
});

// ── GET /:communityId/sessions/:sessionId/results — Session results ─────────
router.get("/:communityId/sessions/:sessionId/results", authMiddleware, async (req, res) => {
  try {
    const { communityId, sessionId } = req.params;

    const myMember = await getActiveMember(communityId, req.userId);
    if (!myMember) return res.status(403).json({ message: "Access denied" });

    const results = await SessionResult.find({ session: sessionId })
      .populate("user", "name category")
      .sort({ score: -1 })
      .lean();

    res.json(results);
  } catch (err) {
    console.error("Get session results error:", err);
    res.status(500).json({ message: "Failed to fetch results" });
  }
});

// ── GET /:communityId/leaderboard — Cumulative leaderboard ─────────────────
router.get("/:communityId/leaderboard", authMiddleware, async (req, res) => {
  try {
    const { communityId } = req.params;

    const myMember = await getActiveMember(communityId, req.userId);
    if (!myMember) return res.status(403).json({ message: "Access denied" });

    // Get completed sessions in this community
    const completedSessions = await CommunitySession.find({
      community: communityId,
      status: "completed",
    }).select("_id").lean();

    const sessionIds = completedSessions.map((s) => s._id);

    const leaderboard = await SessionResult.aggregate([
      { $match: { session: { $in: sessionIds }, community: new mongoose.Types.ObjectId(communityId) } },
      {
        $group: {
          _id: "$user",
          totalSessions: { $sum: 1 },
          totalScore: { $sum: "$score" },
          avgAccuracy: { $avg: "$accuracy" },
          bestScore: { $max: "$score" },
        },
      },
      { $sort: { totalScore: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: { path: "$userInfo", preserveNullAndEmpty: true } },
      {
        $project: {
          userId: "$_id",
          name: "$userInfo.name",
          category: "$userInfo.category",
          totalSessions: 1,
          totalScore: 1,
          avgAccuracy: { $round: ["$avgAccuracy", 1] },
          bestScore: 1,
        },
      },
    ]);

    res.json(leaderboard);
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
});

module.exports = { router, setIO };
