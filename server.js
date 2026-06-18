const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const passport = require("passport");

// Rate limiters
const globalLimiter = rateLimit({ windowMs: 15*60*1000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter  = rateLimit({ windowMs: 15*60*1000, max: 20,  message: { message: "Too many login attempts. Please try again in 15 minutes." }, standardHeaders: true, legacyHeaders: false });


// =========================
// IMPORT ROUTES
// =========================
const authRoutes = require("./routes/auth.routes");
const googleAuthRoutes = require("./routes/google.auth");
const uploadQuestionsRoute = require("./routes/uploadQuestions");
const questionsRoute = require("./routes/questions"); // exports { router, setIO }
const adminQuestionsRoutes = require("./routes/adminQuestions");
const userAdmin = require("./routes/users.admin"); // exports { router, setIO }
const userRoutes = require("./routes/user.routes");
const settingsRoutes = require("./routes/settings");
const contactRoutes = require("./routes/contact");
const libraryRoutes = require("./routes/library.routes");
const recycleBinRoutes = require("./routes/recycleBin");
const feedRoutes = require("./routes/feed");
const pointsRoutes = require("./routes/points");
const adminActivityRoutes = require("./routes/adminActivity");
const dailySummaryRoutes  = require("./routes/dailySummary");
const userNotificationsRoutes = require("./routes/userNotifications");
const socialRoutes = require("./routes/social.routes");
const submissionsRoutes = require("./routes/submissions");
const studyHubRoutes    = require("./routes/studyhub.routes");
const institutionRoutes = require("./routes/institution.routes");

// =========================
// IMPORT MODELS
// =========================
const User = require("./models/User");
const Question = require("./models/Question");
const Course = require("./models/Course");
const LibraryItem = require("./models/LibraryItem");
const Flashcard    = require("./models/Flashcard");
const StudyNote    = require("./models/StudyNote");
const ResourceLink = require("./models/ResourceLink");

// =========================
// APP INIT
// =========================
const app = express();

// Trust the reverse proxy (Render/Vercel) to get the real client IP
app.set("trust proxy", 1);

// Force HTTPS â€” redirect any HTTP request to HTTPS (Render sets X-Forwarded-Proto)
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] === "http") {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allows any frontend to connect to socket
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

const presenceTracker = require("./utils/presenceTracker");

// =========================
// SOCKET CONNECTION
// =========================
io.on("connection", (socket) => {
  // Send current presence state immediately to the new socket
  socket.emit("PRESENCE_UPDATE", {
    onlineIds: presenceTracker.getActiveUserIds(),
    recentIds: presenceTracker.getRecentlyActiveUserIds(3)
  });

  socket.on("register_presence", (userId) => {
    presenceTracker.addPresence(socket.id, userId);
    emitAdminStats(); // Update dashboard live
    emitPresenceUpdate();
  });

  socket.on("disconnect", () => {
    presenceTracker.removePresence(socket.id);
    emitAdminStats(); // Update dashboard live
    emitPresenceUpdate();
  });
});

function emitPresenceUpdate() {
  if (io) {
    io.emit("PRESENCE_UPDATE", {
      onlineIds: presenceTracker.getActiveUserIds(),
      recentIds: presenceTracker.getRecentlyActiveUserIds(3)
    });
  }
}

// =========================
// INJECT SOCKET INTO ROUTES
// =========================
const { setIO: setLoggerIO } = require("./utils/adminLogger");
const { setIO: setUserNotifierIO } = require("./utils/userNotifier");
userAdmin.setIO(io);
questionsRoute.setIO(io);
contactRoutes.setIO(io);
setLoggerIO(io);
setUserNotifierIO(io);

// =========================
// MIDDLEWARE
// =========================
app.use(cors({ origin: "*" })); // Allows any frontend to call API routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(passport.initialize());
// Rate limiting â€” apply globally, stricter on auth
app.use("/api", globalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);


// =========================
// SAFE APP.USE HELPER
// =========================
function safeUse(path, route) {
  if (typeof route === "function") {
    app.use(path, route);
  } else if (route && route.router) {
    app.use(path, route.router);
  } else {
    console.warn(`Skipping ${path} â€” not a valid router function`);
  }
}

// =========================
// API ROUTES (SAFE)
// =========================
safeUse("/api/auth", authRoutes);
safeUse("/api/auth/google", googleAuthRoutes);
safeUse("/api/upload-questions", uploadQuestionsRoute);
safeUse("/api/questions", questionsRoute); // now works
safeUse("/api/admin/questions", adminQuestionsRoutes);
safeUse("/api/users", userAdmin);
safeUse("/api/user", userRoutes);
safeUse("/api/settings", settingsRoutes);
safeUse("/api/contact", contactRoutes);
safeUse("/api/library", libraryRoutes);
safeUse("/api/admin/recycle-bin", recycleBinRoutes);
safeUse("/api/admin/feed", feedRoutes);
safeUse("/api/points", pointsRoutes);
safeUse("/api/admin/activity",       adminActivityRoutes);
safeUse("/api/admin/daily-summary",  dailySummaryRoutes);
safeUse("/api/user/notifications", userNotificationsRoutes);
safeUse("/api/studyhub",           studyHubRoutes);
safeUse("/api/institutions",       institutionRoutes);

// =========================
// COURSES ROUTES
// =========================
app.get("/api/courses", async (req, res) => {
  try {
    const [dbCourses, questionCourses] = await Promise.all([
      Course.find({ isActive: true }).lean(),
      Question.distinct("course")
    ]);
    
    // Merge names and remove duplicates
    const allNames = new Set([
      ...dbCourses.map(c => c.name),
      ...questionCourses.filter(Boolean)
    ]);
    
    // Sort alphabetically
    const sorted = Array.from(allNames).sort().map(name => ({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-")
    }));

    res.json(sorted);
  } catch (err) {
    console.error("Fetch courses error:", err);
    res.status(500).json({ message: "Failed to fetch courses" });
  }
});

app.post("/api/courses", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name)
      return res.status(400).json({ message: "Course name is required" });

    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const existing = await Course.findOne({ slug });
    if (existing)
      return res.status(400).json({ message: "Course already exists" });

    const newCourse = new Course({ name, slug });
    await newCourse.save();
    res.json(newCourse);

    emitAdminStats(); // update stats after new course
  } catch (err) {
    console.error("Create course error:", err);
    res.status(500).json({ message: "Failed to create course" });
  }
});

app.put("/api/courses/:name", async (req, res) => {
  try {
    const oldName = decodeURIComponent(req.params.name);
    const { name: newName } = req.body;

    if (!newName || !newName.trim())
      return res.status(400).json({ message: "New course name is required" });

    const trimmedName = newName.trim();
    const newSlug = trimmedName.toLowerCase().replace(/\s+/g, "-");

    // Check the new name doesn't conflict with an existing course
    const conflict = await Course.findOne({ name: trimmedName });
    if (conflict && conflict.name !== oldName)
      return res.status(400).json({ message: "A course with that name already exists" });

    // Update the Course document (upsert in case it only exists on questions)
    await Course.findOneAndUpdate(
      { name: oldName },
      { name: trimmedName, slug: newSlug },
      { upsert: true, new: true }
    );

    // Remap all questions from old name to new name
    await Question.updateMany({ course: oldName }, { $set: { course: trimmedName } });

    res.json({ message: "Course renamed successfully", oldName, newName: trimmedName });
    emitAdminStats();
  } catch (err) {
    console.error("Rename course error:", err);
    res.status(500).json({ message: "Failed to rename course" });
  }
});

app.delete("/api/courses/:name", async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    
    // 1. Delete from Course collection if it exists
    await Course.findOneAndDelete({ name });
    
    // 2. Remove the course from any questions using it
    await Question.updateMany({ course: name }, { $set: { course: "" } });
    
    res.json({ message: "Course deleted successfully" });
    emitAdminStats();
  } catch (err) {
    console.error("Delete course error:", err);
    res.status(500).json({ message: "Failed to delete course" });
  }
});

// =========================
// ADMIN STATS ROUTE
// =========================
app.get("/api/admin/stats", async (req, res) => {
  try {
    const stats = await fetchAdminStats();
    res.json(stats);
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ message: "Failed to load admin stats" });
  }
});

// =========================
// TEST ROUTE
// =========================
app.use("/api/social", socialRoutes);
app.use("/api/submissions", submissionsRoutes);
app.get("/", (req, res) => res.send("Universal Health API running"));

// =========================
// DATABASE CONNECTION
// =========================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// =========================
// SERVER START
// =========================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// =========================
// UTILITY: ADMIN STATS
// =========================
async function fetchAdminStats() {
  const totalUsers = await User.countDocuments();
  const totalQuestions = await Question.countDocuments();
  const totalBooks = await LibraryItem.countDocuments();

  // Use Course model if questions might be empty
  let totalCourses = await Course.countDocuments();
  if (totalCourses === 0) {
    const courses = await Question.distinct("course");
    totalCourses = courses.length;
  }

  const activeUsers = await User.countDocuments({
    lastLogin: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24) },
  });

  const liveUsers = presenceTracker.getActiveCount();

  // Study Hub totals
  // totalFlashcards = manually-created Flashcard docs + question-derived (Question count)
  const [fcCount, noteCount, resCount, questionCount] = await Promise.all([
    Flashcard.countDocuments(),
    StudyNote.countDocuments({ isActive: true }),
    ResourceLink.countDocuments({ isActive: true }),
    Question.countDocuments(),
  ]);
  // Flashcards visible to students = manual cards + all questions (shown as flashcards)
  const totalFlashcards = fcCount + questionCount;
  const totalStudyHub = totalFlashcards + noteCount + resCount;

  // Signup trend: last 7 days
  const signupTrend = await getSignupTrend(7);

  console.log(`ðŸ“Š Stats updated: ${totalUsers} Users, ${totalQuestions} Questions, ${totalCourses} Courses, ${liveUsers} Live, ${totalBooks} Books, ${totalStudyHub} StudyHub`);

  return { totalUsers, totalQuestions, totalCourses, activeUsers, liveUsers, totalBooks, totalStudyHub, signupTrend };
}

app.get("/api/admin/presence", (req, res) => {
  res.json({
    onlineIds: presenceTracker.getActiveUserIds(),
    recentIds: presenceTracker.getRecentlyActiveUserIds(3)
  });
});

// Signup trend endpoint - supports ?days=N, returns { trend, total }
app.get("/api/admin/stats/signups", async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 365);
    const trend = await getSignupTrend(days);
    const total = trend.reduce((sum, d) => sum + d.signups, 0);
    res.json({ trend, total });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch signup trend" });
  }
});

async function getSignupTrend(days) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const count = await User.countDocuments({ createdAt: { $gte: start, $lte: end } });
    result.push({
      day: start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      signups: count
    });
  }
  return result;
}

async function emitAdminStats() {
  const stats = await fetchAdminStats();
  io.emit("ADMIN_STATS_UPDATE", stats);
}

// =========================
// DAILY LOGIN-REMINDER EMAIL
// Checks every 30 min; fires once per day at 8:00-8:30 AM UTC
// =========================
let _lastDailyEmailDate = null;

function buildDailyReminderEmail(user, frontend) {
  const name    = (user.name || "").split(" ")[0] || "there";
  const streak  = user.streak  || 0;
  const points  = user.points  || 0;
  const streakBlock = streak > 0
    ? `<div style="background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(239,68,68,.08));border:1.5px solid #f59e0b;border-radius:14px;padding:16px;margin-bottom:20px;text-align:center">
         <div style="font-size:1.8rem">🔥</div>
         <strong style="color:#d97706;display:block;font-size:1.1rem">${streak}-Day Streak!</strong>
         <span style="color:#92400e;font-size:.8rem">Log in today to keep it going</span>
       </div>`
    : "";
  return `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:auto;background:#f8fafc;padding:40px 32px;border-radius:20px;border:1px solid #e2e8f0">
  <div style="text-align:center;margin-bottom:24px">
    <div style="font-size:2rem;font-weight:900;background:linear-gradient(135deg,#10b981,#0ea5e9);-webkit-background-clip:text;-webkit-text-fill-color:transparent">UHC Academy</div>
    <div style="font-size:0.72rem;letter-spacing:2px;text-transform:uppercase;color:#94a3b8">Universal Health Community</div>
  </div>
  <div style="font-size:2.5rem;text-align:center;margin-bottom:6px">📚</div>
  <h2 style="color:#0f172a;text-align:center;margin:0 0 8px">Hi ${name}, ready to learn today?</h2>
  <p style="color:#475569;text-align:center;margin:0 0 22px;line-height:1.5">You haven't logged in yet today. Keep your momentum going and climb the leaderboard!</p>
  ${streakBlock}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
    <div style="background:#fff;border-radius:12px;padding:14px;text-align:center;border:1px solid #e2e8f0">
      <div style="font-size:1.6rem;font-weight:900;color:#4255ff">${points}</div>
      <div style="font-size:.72rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Total Points</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:14px;text-align:center;border:1px solid #e2e8f0">
      <div style="font-size:1.6rem;font-weight:900;color:#f59e0b">${streak}</div>
      <div style="font-size:.72rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Day Streak</div>
    </div>
  </div>
  <a href="${frontend}/quiz" style="display:block;padding:14px 32px;background:linear-gradient(135deg,#4255ff,#8b5cf6);color:white;border-radius:12px;text-decoration:none;font-weight:700;font-size:1rem;text-align:center;margin-bottom:12px">
    🎯 Start Today's Quiz →
  </a>
  <a href="${frontend}/leaderboard" style="display:block;padding:12px;background:#f1f5f9;color:#4255ff;border-radius:12px;text-decoration:none;font-weight:600;font-size:.88rem;text-align:center">
    🏆 View Leaderboard
  </a>
  <p style="color:#94a3b8;font-size:0.72rem;margin:24px 0 0;text-align:center">
    You're receiving this daily reminder as a UHC Academy member.<br>
    Log in to manage your email preferences.
  </p>
</div>`;
}

setInterval(async () => {
  const now      = new Date();
  const utcH     = now.getUTCHours();
  const todayStr = now.toISOString().split("T")[0];
  if (utcH !== 8 || _lastDailyEmailDate === todayStr) return; // only 8 AM UTC, once per day
  _lastDailyEmailDate = todayStr;

  try {
    const todayStart = new Date(todayStr + "T00:00:00Z");
    const { sendEmail } = require("./utils/mail");
    const FRONTEND = process.env.FRONTEND_URL || "https://uhcacadamy.com";

    const inactiveUsers = await User.find({
      status: "active",
      role:   { $in: ["user", "tutor", "health_worker"] },
      email:  { $exists: true, $ne: "" },
      $or: [
        { lastLogin: { $lt: todayStart } },
        { lastLogin: null },
      ],
    }).select("name email points streak").lean();

    let sent = 0;
    for (const u of inactiveUsers) {
      await sendEmail({
        to:      u.email,
        subject: `🔔 ${(u.name || "").split(" ")[0] || "Hey"}, your daily study reminder — UHC Academy`,
        html:    buildDailyReminderEmail(u, FRONTEND),
      });
      sent++;
      if (sent % 50 === 0) await new Promise(r => setTimeout(r, 1000)); // rate-limit
    }
    console.log(`✅ Daily reminder sent to ${sent} inactive users`);
  } catch (err) {
    console.error("Daily email scheduler error:", err.message);
  }
}, 30 * 60 * 1000); // check every 30 minutes
