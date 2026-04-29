import React, { useContext, useState, useRef, useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import "../styles/dashboard.css";

  Home, BookOpen, ClipboardList, User, LogOut,
  Search, BarChart2, ChevronRight, Menu, X
} from "lucide-react";

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(UserContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dropdownRef = useRef();
  const logoDropdownRef = useRef();
  const hideTimeoutRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  const userObj = user || null;

  const avatarColor = (name = "") => {
    const cols = ["#4255ff","#8b5cf6","#ec4899","#f59e0b","#10b981","#06b6d4"];
    return cols[(name.charCodeAt(0) || 0) % cols.length];
  };

  const handleLogout = () => {
    const userId = localStorage.getItem("userId");
    localStorage.removeItem(`activeQuiz_${userId}`);
    logout();
    navigate("/");
  };

  // Close logo dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (logoDropdownRef.current && !logoDropdownRef.current.contains(e.target)) {
        logoDropdownRef.current.classList.remove("active");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);


  const navItems = [
    { icon: <Home size={18} />, label: "Home", path: "/dashboard" },
    { icon: <BookOpen size={18} />, label: "Library", path: "/library" },
    { icon: <ClipboardList size={18} />, label: "Quiz", path: "/quiz" },
    { icon: <BarChart2 size={18} />, label: "Progress", path: "/profile" },
  ];

  return (
    <div className="dashboard-wrapper">

      {/* ===== TOP NAVBAR ===== */}
      <div className="dashboard-topbar">
        {/* Hamburger for mobile */}
        <button
          className="topbar-hamburger"
          onClick={() => setSidebarOpen(o => !o)}
          title="Menu"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Logo */}
        <div className="topbar-logo" onClick={() => navigate("/dashboard")}>
          <div className="logo-animated-text">
            <span className="logo-letter">U</span>
            <span className="logo-letter">H</span>
            <span className="logo-letter">C</span>
          </div>
        </div>

        {/* Search */}
        <div className="topbar-search">
          <Search size={16} className="topbar-search-icon" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#939bb4" }} />
          <input
            type="text"
            placeholder="Search topics, quizzes, resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="topbar-spacer" />

        {/* Right actions */}
        <div className="topbar-nav-group">
          {/* Create button removed per user request - Admin now manages feed content */}

          {/* Profile letter avatar */}
          <button
            className="topbar-avatar-btn"
            onClick={() => navigate("/profile")}
            title="Profile"
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: avatarColor(userObj?.name || ""),
              border: "2px solid rgba(66,85,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontWeight: 800, fontSize: ".9rem",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            {(userObj?.name || "U")[0].toUpperCase()}
          </button>
        </div>
      </div>

      {/* ===== DASHBOARD BODY ===== */}
      <div className="dashboard-body">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="sidebar-mobile-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ===== LEFT SIDEBAR ===== */}
        <aside className={`dashboard-sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
          <span className="sidebar-section-label">Navigate</span>

          {navItems.map((item) => (
            <button
              key={item.path}
              className={`sidebar-nav-item ${isActive(item.path) ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div className="sidebar-divider" />
          <span className="sidebar-section-label">Account</span>

          <button className="sidebar-nav-item" onClick={() => navigate("/profile")}>
            <span className="nav-item-icon"><User size={18} /></span>
            Profile
          </button>

          <button className="sidebar-nav-item" onClick={handleLogout}>
            <span className="nav-item-icon"><LogOut size={18} /></span>
            Log out
          </button>

          {/* Profile mini card at bottom */}
          {userObj && (
            <div className="sidebar-profile-mini" onClick={() => navigate("/profile")}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: avatarColor(userObj.name || ""),
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 800, fontSize: ".9rem",
                flexShrink: 0,
              }}>
                {(userObj.name || "U")[0].toUpperCase()}
              </div>
              <div className="sidebar-profile-mini-info">
                <div className="sidebar-profile-mini-name">{userObj.name || "User"}</div>
                <div className="sidebar-profile-mini-role">{userObj.category || "Member"}</div>
              </div>
              <ChevronRight size={14} style={{ color: "#939bb4", flexShrink: 0 }} />
            </div>
          )}
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="dashboard-content">
          <Outlet context={{ searchQuery }} />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;