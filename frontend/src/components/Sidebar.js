import React from "react";
import { Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

function Sidebar({ user, onEditProfile, onDonate, onLogout, onHome, onServices, isOpen }) {
  const navigate = useNavigate();

  return (
    <div className={`dashboard-sidebar ${isOpen ? "show-sidebar" : "hide-sidebar"}`}>
      <div className="sidebar-home-link" onClick={onHome}>
        <Home size={20} /> Home
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-card">
          <img
            src={user.profileImage || "/assets/profile.jpeg"}
            alt="Profile"
            className="profile-avatar"
          />
          <h3>{user.name}</h3> {/* ✅ use backend name */}
          <p className="profile-points">Points: {user.points || 0}</p>
          <p className="profile-info">
            {user.category} from {user.country || "N/A"} {/* ✅ use backend country */}
          </p>
          <button onClick={onEditProfile}>Edit Profile</button>
        </div>

        <div className="sidebar-card">
          <h4>Take a Quiz</h4>
          <button onClick={() => navigate("/quiz")}>Start Quiz</button>
        </div>

        <div className="sidebar-card">
          <h4>Library</h4>
          <button onClick={() => navigate("/library")}>Open Library</button>
        </div>

        <div className="sidebar-card">
          <h4>Services</h4>
          <button onClick={onServices}>View Services</button>
        </div>

        <div className="sidebar-card">
          <h4>Support / Donate</h4>
          <button onClick={onDonate}>Donate</button>
        </div>
      </div>

      <button className="logout-button" onClick={onLogout}>
        Logout
      </button>
    </div>
  );
}

export default Sidebar;