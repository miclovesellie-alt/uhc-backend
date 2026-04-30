const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");

// =========================
// IMPORT ROUTES
// =========================
const authRoutes = require("./routes/auth.routes");
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

// =========================
// IMPORT MODELS
// =========================
const User = require("./models/User");
const Question = require("./models/Question");
const Course = require("./models/Course");

// =========================
// APP INIT
// =========================
const app = express();
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
  // We don't log 'Admin connected' on every connection since users connect too
  
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
userAdmin.setIO(io);
questionsRoute.setIO(io);
contactRoutes.setIO(io);
setLoggerIO(io);

// =========================
// MIDDLEWARE
// =========================
app.use(cors({ origin: "*" })); // Allows any frontend to call API routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =========================
// SAFE APP.USE HELPER
// =========================
function safeUse(path, route) {
  if (typeof route === "function") {
    app.use(path, route);
  } else if (route && route.router) {
    app.use(path, route.router);
  } else {
    console.warn(`Skipping ${path} — not a valid router function`);
  }
}

// =========================
// API ROUTES (SAFE)
// =========================
safeUse("/api/auth", authRoutes);
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
safeUse("/api/admin/activity", adminActivityRoutes);

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

  console.log(`📊 Stats updated: ${totalUsers} Users, ${totalQuestions} Questions, ${totalCourses} Courses, ${liveUsers} Live`);
  
  return { totalUsers, totalQuestions, totalCourses, activeUsers, liveUsers };
}

async function emitAdminStats() {
  const stats = await fetchAdminStats();
  io.emit("ADMIN_STATS_UPDATE", stats);
}