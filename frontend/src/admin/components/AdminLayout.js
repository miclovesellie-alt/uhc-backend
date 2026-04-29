import React, { useContext, useState } from "react";
import { useNavigate, useLocation, Outlet, NavLink } from "react-router-dom";
import { UserContext } from "../../context/UserContext";
import "../admin_styles/AdminLayout.css";
import {
  LayoutDashboard, Users, HelpCircle, Upload,
  Bell, Settings, LogOut, Menu, X, ChevronRight, FileText, Shield, Library, Mail, Layout, Trash2
} from "lucide-react";

const baseNavItems = [
  { icon: <LayoutDashboard size={17} />, label: "Dashboard",     path: "/admin"                },
  { icon: <Users          size={17} />, label: "Users",          path: "/admin/users"          },
  { icon: <HelpCircle     size={17} />, label: "Questions",      path: "/admin/questions"      },
  { icon: <Library        size={17} />, label: "Library",        path: "/admin/userlibrary"    },
  { icon: <Layout         size={17} />, label: "Feed Manager",   path: "/admin/feed"           },
  { icon: <Upload         size={17} />, label: "Bulk Upload",    path: "/admin/uploads"        },
  { icon: <FileText       size={17} />, label: "Activity Logs",  path: "/admin/logs"           },
  { icon: <Bell           size={17} />, label: "Notifications",  path: "/admin/notifications"  },
  { icon: <Trash2         size={17} />, label: "Recycle Bin",    path: "/admin/recycle-bin"    },
  { icon: <Mail           size={17} />, label: "Messages",       path: "/admin/messages"       },
  { icon: <Settings       size={17} />, label: "Settings",       path: "/admin/settings"       },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, adminTheme } = useContext(UserContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Set axios default header for admin requests
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      import("axios").then(({ default: axios }) => {
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      });
    }
  }, []);

  const navItems = [...baseNavItems];
  if (user?.role === "superadmin") {
    navItems.splice(2, 0, { icon: <Shield size={17} />, label: "Admins", path: "/admin/admins" });
  }

  const handleLogout = () => { logout(); navigate("/"); };
  const isActive = (path) => path === "/admin"
    ? location.pathname === "/admin"
    : location.pathname.startsWith(path);

  const pageTitle = navItems.find(n => isActive(n.path))?.label || "Admin";

  return (
    <div className={`admin-wrapper ${adminTheme === "dark" ? "admin-dark" : ""}`}>

      {/* ===== SIDEBAR ===== */}
      <aside className={`admin-sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <div className="admin-logo">
          <div className="logo-animated-text">
            <span className="logo-letter">U</span>
            <span className="logo-letter">H</span>
            <span className="logo-letter">C</span>
          </div>
          <div style={{ marginLeft: 8 }}>
            <h2 style={{ fontSize: '0.9rem' }}>Admin</h2>
            <span>Control Panel</span>
          </div>
        </div>

        <nav className="admin-nav">
          <div className="admin-nav-section">Main</div>
          {navItems.filter(item => item.path !== "/admin/logs" && item.path !== "/admin/notifications" && item.path !== "/admin/settings" && item.path !== "/admin/messages").map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={() => isActive(item.path) ? "active" : ""}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

          <div className="admin-nav-section" style={{ marginTop: 8 }}>Monitoring</div>
          {navItems.filter(item => item.path === "/admin/logs" || item.path === "/admin/notifications" || item.path === "/admin/messages" || item.path === "/admin/recycle-bin").map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={() => isActive(item.path) ? "active" : ""}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

          <div className="admin-nav-section" style={{ marginTop: 8 }}>System</div>
          {navItems.filter(item => item.path === "/admin/settings").map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={() => isActive(item.path) ? "active" : ""}
              onClick={() => setSidebarOpen(false)}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Profile + logout */}
        <div className="admin-nav-logout">
          <div
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, marginBottom: 6 }}
          >
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--admin-accent-pale)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem", fontWeight: 700, color: "var(--admin-accent)", flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase() || "A"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--admin-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "Admin"}</div>
              <div style={{ fontSize: ".7rem", color: "var(--admin-muted)" }}>Administrator</div>
            </div>
          </div>
          <button className="admin-btn danger" style={{ width: "100%", justifyContent: "center" }} onClick={handleLogout}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 150 }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ===== CONTENT ===== */}
      <div className="admin-content">

        {/* Topbar */}
        <div className="admin-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="admin-hamburger"
              style={{ alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, border: "1px solid var(--admin-border)", background: "transparent", color: "var(--admin-text)", cursor: "pointer" }}
              onClick={() => setSidebarOpen(o => !o)}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span className="admin-topbar-title">{pageTitle}</span>
          </div>
          <div className="admin-topbar-actions">
            <span style={{ fontSize: ".78rem", color: "var(--admin-muted)" }}>
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
          </div>
        </div>

        {/* Page content */}
        <Outlet />
      </div>
    </div>
  );
}