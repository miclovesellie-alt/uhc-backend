import React, { useContext } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import AuthCard from "./pages/AuthCard";
import LandingPage from "./pages/LandingPage";
import DashboardLayout from "./components/DashboardLayout";
import PrivateRoute from "./components/PrivateRoute";
import QuizPage from "./components/QuizPage";
import { UserProvider, UserContext } from "./context/UserContext";

import ProfilePage from "./components/ProfilePage";

// ===== LIBRARY IMPORTS =====
import Library from "./pages/Library";
import TopicPage from "./pages/TopicPage";
import BookViewer from "./pages/BookViewer";

// ===== OTHER PAGE IMPORTS =====
import FYP from "./components/FYP";

// ===== REVIEW PAGE IMPORT =====
import ReviewPage from "./components/ReviewPage";

// ===== ADMIN IMPORT =====
import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminUsers from "./admin/pages/AdminUsers";
import AdminAdmins from "./admin/pages/AdminAdmins";
import AdminQuestions from "./admin/pages/AdminQuestions";
import AdminSettings from "./admin/pages/AdminSettings";
import AdminLogs from "./admin/pages/AdminLogs";
import AdminNotifications from "./admin/pages/AdminNotifications";
import BulkUpload from "./admin/pages/BulkUpload";
import AdminMessages from "./admin/pages/AdminMessages";
import AdminLibrary from "./admin/pages/AdminLibrary";
import AdminFeed from "./admin/pages/AdminFeed";
import AdminRecycleBin from "./admin/pages/AdminRecycleBin";
import DuplicateQuestions from "./admin/pages/DuplicateQuestions";

// ===== ADMIN LAYOUT =====
import AdminLayout from "./admin/components/AdminLayout";

// ===== AUTH/RESET PASSWORD PAGES =====
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminRecovery from "./pages/AdminRecovery";

function AppRoutes() {
  const { user, setUser } = useContext(UserContext);
  const location = useLocation();

  // Page transition variants
  const pageVariants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 }
  };

  const pageTransition = {
    type: "tween",
    ease: [0.25, 0.46, 0.45, 0.94],
    duration: 0.4
  };

  return (
    <AnimatePresence mode="wait">
    <Routes location={location} key={location.pathname}>
      {/* ===== LANDING PAGE ===== */}
      <Route path="/" element={
        <motion.div
          initial="initial" animate="animate" exit="exit"
          variants={pageVariants} transition={pageTransition}
          style={{ minHeight: '100vh' }}
        >
          <LandingPage />
        </motion.div>
      } />

      {/* ===== AUTH PAGE ===== */}
      <Route
        path="/auth"
        element={
          <motion.div
            initial="initial" animate="animate" exit="exit"
            variants={pageVariants} transition={pageTransition}
            style={{ minHeight: '100vh' }}
          >
            <AuthCard />
          </motion.div>
        }
      />

      {/* ===== PASSWORD RESET PAGES ===== */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* ===== ADMIN RECOVERY (hidden, unlinked from login page) ===== */}
      <Route path="/admin-recovery" element={<AdminRecovery />} />

      {/* ===== ADMIN ROUTES (NESTED UNDER ADMINLAYOUT) ===== */}
      <Route
        path="/admin"
        element={
          <PrivateRoute adminOnly={true}>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users"         element={<AdminUsers />} />
        <Route path="admins"        element={<AdminAdmins />} />
        <Route path="questions"     element={<AdminQuestions />} />
        <Route path="settings"      element={<AdminSettings />} />
        <Route path="logs"          element={<AdminLogs />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="messages"      element={<AdminMessages />} />
        <Route path="userlibrary"   element={<AdminLibrary />} />
        <Route path="feed"          element={<AdminFeed />} />
        <Route path="recycle-bin"   element={<AdminRecycleBin />} />
        <Route path="uploads"       element={<BulkUpload />} />
        <Route path="duplicates"    element={<DuplicateQuestions />} />
      </Route>

      {/* ===== DASHBOARD LAYOUT WRAPPER ===== */}
      <Route
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        {/* ===== FYP ===== */}
        <Route path="/dashboard" element={<FYP />} />
        <Route path="/fyp" element={<FYP />} />

        {/* ===== QUIZ ===== */}
        <Route path="/quiz" element={<QuizPage />} />

        {/* ===== REVIEW PAGE ===== */}
        <Route path="/review" element={<ReviewPage />} />

        {/* ===== PROFILE ===== */}
        <Route
          path="/profile"
          element={<ProfilePage user={user} setUser={setUser} />}
        />

        {/* ===== LIBRARY ===== */}
        <Route path="/library" element={<Library />} />
        <Route path="/library/view/:id" element={<BookViewer />} />
        <Route path="/library/:topic" element={<TopicPage />} />
      </Route>

      {/* ===== 404 ===== */}
      <Route
        path="*"
        element={
          <div style={{ textAlign: "center", marginTop: "50px" }}>
            404 — Page Not Found
          </div>
        }
      />
    </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <UserProvider>
      <AppRoutes />
    </UserProvider>
  );
}

export default App;