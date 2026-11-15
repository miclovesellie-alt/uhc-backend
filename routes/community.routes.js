const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Community = require("../models/Community");
const CommunityMember = require("../models/CommunityMember");
const CommunitySession = require("../models/CommunitySession");
const SessionResult = require("../models/SessionResult");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth.middleware");
const { notifyUser } = require("../utils/userNotifier");
const { sendEmail } = require("../utils/mail");

const FRONTEND_URL = process.env.FRONTEND_URL || "https://uhcacadamy.com";

// ── Helper: build styled community invite email ────────────────────────────
function buildInviteEmail({ inviteeName, inviterName, communityName, communityType, actionLink }) {
  return `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:40px 32px;border-radius:20px;border:1px solid #e2e8f0">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:2rem;font-weight:900;background:linear-gradient(135deg,#10b981,#0ea5e9);-webkit-background-clip:text;-webkit-text-fill-color:transparent">UHC Academy</div>
    <div style="font-size:0.72rem;letter-spacing:2px;text-transform:uppercase;color:#94a3b8">Universal Health Community</div>
  </div>
  <div style="background:linear-gradient(135deg,#4255ff,#8b5cf6);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px">
    <div style="font-size:2.5rem;margin-bottom:8px">🏘️</div>
    <h2 style="color:white;margin:0 0 6px;font-size:1.4rem">You're Invited to a Community!</h2>
  </div>
  <div style="background:#fff;border-radius:14px;padding:20px;border:1px solid #e2e8f0;margin-bottom:24px;color:#334155;line-height:1.7;font-size:.92rem">
    <p style="margin:0 0 8px">Hi <strong>${inviteeName}</strong>,</p>
    <p style="margin:0 0 8px"><strong>${inviterName}</strong> has invited you to join the <strong>${communityName}</strong> community (${communityType}) on UHC Academy.</p>
    <p style="margin:0">Join your peers to participate in live quiz sessions, track your progress on leaderboards, and learn together!</p>
  </div>
  <a href="${actionLink}" style="display:block;padding:14px;background:linear-gradient(135deg,#4255ff,#8b5cf6);color:white;border-radius:12px;text-decoration:none;font-weight:700;font-size:1rem;text-align:center;margin-bottom:12px">🏘️ View Invitation →</a>
  <p style="color:#94a3b8;font-size:0.72rem;margin:24px 0 0;text-align:center">UHC Academy · Universal Health Community<br>You're receiving this because someone invited you to a community.</p>
</div>`;
}

// ── POST / — Create community ──────────────────────────────────────────────
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description, type } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Community name is required" });
    }

    const community = await Community.create({
      name: name.trim(),
      description: description || "",
      type: type || "private",
      admin: req.userId,
    });

    // Creator becomes admin member
    await CommunityMember.create({
      community: community._id,
      user: req.userId,
      role: "admin",
      status: "active",
      joinedAt: new Date(),
    });

    res.status(201).json({ community });
  } catch (err) {
    console.error("Create community error:", err);
    res.status(500).json({ message: "Failed to create community" });
  }
});

// ── GET / — Get current user's communities ─────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const memberships = await CommunityMember.find({
      user: req.userId,
      status: "active",
    })
      .populate({
        path: "community",
        populate: { path: "admin", select: "name" },
      })
      .lean();

    const communities = memberships
      .filter((m) => m.community)
      .map((m) => ({
        ...m.community,
        myRole: m.role,
      }));

    res.json({ communities });
  } catch (err) {
    console.error("Get communities error:", err);
    res.status(500).json({ message: "Failed to fetch communities" });
  }
});

// ── GET /invites/pending — Pending invites for current user ────────────────
// NOTE: must be before /:id to avoid conflict
router.get("/invites/pending", authMiddleware, async (req, res) => {
  try {
    const pending = await CommunityMember.find({
      user: req.userId,
      status: "pending",
    })
      .populate({ path: "community", select: "name type" })
      .populate({ path: "invitedBy", select: "name" })
      .lean();

    res.json({ invites: pending });
  } catch (err) {
    console.error("Get pending invites error:", err);
    res.status(500).json({ message: "Failed to fetch pending invites" });
  }
});

// ── POST /leave/:id — Leave a community ───────────────────────────────────
router.post("/leave/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const community = await Community.findById(id);
    if (!community) return res.status(404).json({ message: "Community not found" });

    const myMember = await CommunityMember.findOne({
      community: id,
      user: req.userId,
      status: "active",
    });
    if (!myMember) return res.status(404).json({ message: "You are not a member of this community" });

    const isAdmin = community.admin.toString() === req.userId.toString();

    if (isAdmin) {
      // Find oldest active member (excluding self) to promote
      const nextMember = await CommunityMember.findOne({
        community: id,
        user: { $ne: req.userId },
        status: "active",
      }).sort({ joinedAt: 1 });

      if (nextMember) {
        // Promote to admin
        nextMember.role = "admin";
        await nextMember.save();
        community.admin = nextMember.user;
        // Remove from coAdmins if was there
        community.coAdmins = community.coAdmins.filter(
          (uid) => uid.toString() !== nextMember.user.toString()
        );
        await community.save();
      } else {
        // No other members — dissolve community
        await CommunityMember.deleteMany({ community: id });
        await CommunitySession.deleteMany({ community: id });
        await SessionResult.deleteMany({ community: id });
        await Community.findByIdAndDelete(id);
        return res.json({ message: "Community dissolved (no other members)" });
      }
    }

    await CommunityMember.deleteOne({ community: id, user: req.userId });
    res.json({ message: "Left community successfully" });
  } catch (err) {
    console.error("Leave community error:", err);
    res.status(500).json({ message: "Failed to leave community" });
  }
});

// ── GET /:id — Community detail ────────────────────────────────────────────
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const community = await Community.findById(id).populate("admin", "name email");
    if (!community) return res.status(404).json({ message: "Community not found" });

    // Check membership
    const myMember = await CommunityMember.findOne({
      community: id,
      user: req.userId,
      status: "active",
    });
    if (!myMember) return res.status(403).json({ message: "Access denied" });

    const [members, pendingCount, sessionCount] = await Promise.all([
      CommunityMember.find({ community: id, status: "active" })
        .populate("user", "name email category")
        .lean(),
      CommunityMember.countDocuments({ community: id, status: "pending" }),
      CommunitySession.countDocuments({ community: id }),
    ]);

    res.json({
      ...community.toObject(),
      members,
      pendingCount,
      sessionCount,
      myRole: myMember.role,
    });
  } catch (err) {
    console.error("Get community detail error:", err);
    res.status(500).json({ message: "Failed to fetch community" });
  }
});

// ── PUT /:id — Update community ────────────────────────────────────────────
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const community = await Community.findById(id);
    if (!community) return res.status(404).json({ message: "Community not found" });

    if (community.admin.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Only admin can update the community" });
    }

    const { name, description, type } = req.body;
    if (name !== undefined) community.name = name.trim();
    if (description !== undefined) community.description = description;
    if (type !== undefined) community.type = type;

    await community.save();
    res.json(community);
  } catch (err) {
    console.error("Update community error:", err);
    res.status(500).json({ message: "Failed to update community" });
  }
});

// ── DELETE /:id — Delete community ────────────────────────────────────────
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const community = await Community.findById(id);
    if (!community) return res.status(404).json({ message: "Community not found" });

    if (community.admin.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Only admin can delete the community" });
    }

    await Promise.all([
      CommunityMember.deleteMany({ community: id }),
      CommunitySession.deleteMany({ community: id }),
      SessionResult.deleteMany({ community: id }),
      Community.findByIdAndDelete(id),
    ]);

    res.json({ message: "Community deleted successfully" });
  } catch (err) {
    console.error("Delete community error:", err);
    res.status(500).json({ message: "Failed to delete community" });
  }
});

// ── POST /:id/invite — Invite user by email ────────────────────────────────
router.post("/:id/invite", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const community = await Community.findById(id);
    if (!community) return res.status(404).json({ message: "Community not found" });

    // Must be admin or co-admin
    const myMember = await CommunityMember.findOne({
      community: id,
      user: req.userId,
      status: "active",
      role: { $in: ["admin", "co-admin"] },
    });
    if (!myMember) return res.status(403).json({ message: "Only admin or co-admin can invite" });

    // Find the target user
    const targetUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (!targetUser) return res.status(404).json({ message: "No user found with that email" });

    // Check for existing membership
    const existing = await CommunityMember.findOne({
      community: id,
      user: targetUser._id,
    });
    if (existing) return res.status(409).json({ message: "User already has a membership record for this community" });

    // Create pending invitation
    await CommunityMember.create({
      community: id,
      user: targetUser._id,
      role: "member",
      status: "pending",
      invitedBy: req.userId,
    });

    // Load inviter info
    const inviter = await User.findById(req.userId).select("name").lean();
    const actionLink = `${FRONTEND_URL}/communities/${id}/invites`;

    // In-app notification
    await notifyUser(
      targetUser._id,
      `🏘️ You've been invited to join "${community.name}" by ${inviter.name}`,
      "INFO",
      actionLink
    );

    // Email notification
    await sendEmail({
      to: targetUser.email,
      subject: `🏘️ You're invited to "${community.name}" on UHC Academy`,
      html: buildInviteEmail({
        inviteeName: (targetUser.name || "").split(" ")[0] || "there",
        inviterName: inviter.name || "A member",
        communityName: community.name,
        communityType: community.type,
        actionLink,
      }),
    });

    res.status(201).json({ message: "Invitation sent successfully" });
  } catch (err) {
    console.error("Invite error:", err);
    res.status(500).json({ message: "Failed to send invitation" });
  }
});

// ── POST /:id/respond — Accept or decline invite ───────────────────────────
router.post("/:id/respond", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { accept } = req.body;

    const member = await CommunityMember.findOne({
      community: id,
      user: req.userId,
      status: "pending",
    });
    if (!member) return res.status(404).json({ message: "No pending invitation found" });

    const community = await Community.findById(id);
    if (!community) return res.status(404).json({ message: "Community not found" });

    if (accept) {
      member.status = "active";
      member.joinedAt = new Date();
      await member.save();

      // Notify community admin
      const user = await User.findById(req.userId).select("name").lean();
      await notifyUser(
        community.admin,
        `✅ ${user.name} accepted your invitation to join "${community.name}"`,
        "SUCCESS",
        `${FRONTEND_URL}/communities/${id}`
      );

      res.json({ message: "You have joined the community" });
    } else {
      member.status = "declined";
      await member.save();

      // Notify admin of decline
      const user = await User.findById(req.userId).select("name").lean();
      await notifyUser(
        community.admin,
        `❌ ${user.name} declined the invitation to "${community.name}"`,
        "INFO",
        `${FRONTEND_URL}/communities/${id}`
      );

      res.json({ message: "Invitation declined" });
    }
  } catch (err) {
    console.error("Respond to invite error:", err);
    res.status(500).json({ message: "Failed to respond to invitation" });
  }
});

// ── GET /:id/members — List members with cumulative stats ──────────────────
router.get("/:id/members", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Must be a member
    const myMember = await CommunityMember.findOne({
      community: id,
      user: req.userId,
      status: "active",
    });
    if (!myMember) return res.status(403).json({ message: "Access denied" });

    const members = await CommunityMember.find({ community: id, status: "active" })
      .populate("user", "name email category")
      .lean();

    // Gather stats for each member
    const memberIds = members.map((m) => m.user._id);
    const results = await SessionResult.aggregate([
      { $match: { community: new mongoose.Types.ObjectId(id), user: { $in: memberIds } } },
      {
        $group: {
          _id: "$user",
          totalSessions: { $sum: 1 },
          avgScore: { $avg: "$score" },
        },
      },
    ]);

    const statsMap = {};
    results.forEach((r) => {
      statsMap[r._id.toString()] = r;
    });

    const enriched = members.map((m) => {
      const stats = statsMap[m.user._id.toString()] || { totalSessions: 0, avgScore: 0 };
      return {
        ...m,
        totalSessions: stats.totalSessions,
        avgScore: Math.round((stats.avgScore || 0) * 100) / 100,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("Get members error:", err);
    res.status(500).json({ message: "Failed to fetch members" });
  }
});

// ── DELETE /:id/members/:userId — Kick a member ────────────────────────────
router.delete("/:id/members/:userId", authMiddleware, async (req, res) => {
  try {
    const { id, userId } = req.params;
    const community = await Community.findById(id);
    if (!community) return res.status(404).json({ message: "Community not found" });

    // Requester must be admin or co-admin
    const myMember = await CommunityMember.findOne({
      community: id,
      user: req.userId,
      status: "active",
      role: { $in: ["admin", "co-admin"] },
    });
    if (!myMember) return res.status(403).json({ message: "Only admin or co-admin can kick members" });

    // Cannot kick the admin
    if (community.admin.toString() === userId) {
      return res.status(400).json({ message: "Cannot kick the community admin" });
    }

    const targetMember = await CommunityMember.findOne({ community: id, user: userId, status: "active" });
    if (!targetMember) return res.status(404).json({ message: "Member not found" });

    await CommunityMember.deleteOne({ community: id, user: userId });

    // Remove from coAdmins if applicable
    community.coAdmins = community.coAdmins.filter((uid) => uid.toString() !== userId);
    await community.save();

    res.json({ message: "Member removed successfully" });
  } catch (err) {
    console.error("Kick member error:", err);
    res.status(500).json({ message: "Failed to remove member" });
  }
});

// ── POST /:id/promote — Promote member to co-admin ────────────────────────
router.post("/:id/promote", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const community = await Community.findById(id);
    if (!community) return res.status(404).json({ message: "Community not found" });

    if (community.admin.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Only admin can promote members" });
    }

    const targetMember = await CommunityMember.findOne({ community: id, user: userId, status: "active" });
    if (!targetMember) return res.status(404).json({ message: "Member not found" });

    if (targetMember.role === "admin") {
      return res.status(400).json({ message: "User is already the admin" });
    }

    targetMember.role = "co-admin";
    await targetMember.save();

    if (!community.coAdmins.some((uid) => uid.toString() === userId)) {
      community.coAdmins.push(userId);
      await community.save();
    }

    // Notify the promoted user
    await notifyUser(
      userId,
      `⭐ You've been promoted to co-admin of "${community.name}"`,
      "SUCCESS",
      `${FRONTEND_URL}/communities/${id}`
    );

    res.json({ message: "Member promoted to co-admin" });
  } catch (err) {
    console.error("Promote member error:", err);
    res.status(500).json({ message: "Failed to promote member" });
  }
});

module.exports = router;
