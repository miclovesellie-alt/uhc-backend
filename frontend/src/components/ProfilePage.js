import React, { useState, useContext } from "react";
import { UserContext } from "../context/UserContext";
import { 
  FaPencilAlt, FaMedal, FaStar, FaTrophy, FaCog, FaMoon, FaSun, FaGlobe, 
  FaLock, FaTimes, FaCheckCircle, FaUser, FaEnvelope, FaMapMarkerAlt, 
  FaUserGraduate 
} from "react-icons/fa";
import "../styles/profile.css";
import countries from "../data/countries";
import axios from "axios";

const avatarGradient = (name = "") => {
  const palettes = [
    ["#4255ff","#8b5cf6"],["#ec4899","#f43f5e"],["#10b981","#06b6d4"],
    ["#f59e0b","#ef4444"],["#8b5cf6","#4255ff"],["#06b6d4","#10b981"],
  ];
  const idx = (name.charCodeAt(0) || 0) % palettes.length;
  return `linear-gradient(135deg, ${palettes[idx][0]}, ${palettes[idx][1]})`;
};

function ProfilePage({ user, setUser }) {
  const { theme, setTheme } = useContext(UserContext);
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [language, setLanguage] = useState(localStorage.getItem("language") || "English");
  const [resetSent, setResetSent] = useState(false);

  if (!user) return null;

  const handleChange = (field, value) => setUser({ ...user, [field]: value });

  const handleSaveChanges = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.put(
        `/api/users/${user._id}`, user,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUser(res.data);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save profile.");
    }
  };

  const handlePasswordReset = async () => {
    try {
      await axios.post("/api/auth/forgot-password", { email: user.email });
      setResetSent(true);
      setTimeout(() => setResetSent(false), 5000);
    } catch (err) {
      alert("Failed to send reset email.");
    }
  };

  const initial = (user.name || "U")[0].toUpperCase();
  const userPoints = user.points || 0;
  const userStreak = user.streak || 0;

  let rankInfo = { title: "Novice", color: "#94a3b8", icon: <FaStar />, nextRank: 100 };
  if (userPoints >= 1000) rankInfo = { title: "Expert", color: "#f59e0b", icon: <FaTrophy />, nextRank: 5000 };
  else if (userPoints >= 500) rankInfo = { title: "Advanced", color: "#8b5cf6", icon: <FaMedal />, nextRank: 1000 };
  else if (userPoints >= 100) rankInfo = { title: "Intermediate", color: "#3b82f6", icon: <FaMedal />, nextRank: 500 };

  const progressToNext = Math.min(100, (userPoints / rankInfo.nextRank) * 100);

  return (
    <div className="profile-page-v2 scrollable">
      
      {/* Background Abstract Shapes */}
      <div className="profile-bg-glow"></div>
      <div className="profile-bg-shape s1"></div>
      <div className="profile-bg-shape s2"></div>

      <div className={`profile-container ${isEditing ? 'editing-mode' : ''}`}>
        
        {/* Left Column: Avatar & Rank */}
        <aside className="profile-sidebar">
          <div className="profile-avatar-card">
            <div className="avatar-outer-ring" style={{ '--progress': `${progressToNext}%`, '--rank-color': rankInfo.color }}>
              <div className="profile-avatar-main" style={{ background: avatarGradient(user.name) }}>
                {initial}
              </div>
            </div>
            
            <div className="rank-info-v2">
              <div className="rank-badge-v2" style={{ backgroundColor: rankInfo.color }}>
                {rankInfo.icon}
                <span>{rankInfo.title}</span>
              </div>
              <div className="rank-progress-wrap">
                <div className="progress-text">
                  <span>Level Progress</span>
                  <span>{Math.round(progressToNext)}%</span>
                </div>
                <div className="progress-track-v2">
                  <div className="progress-fill-v2" style={{ width: `${progressToNext}%`, backgroundColor: rankInfo.color }}></div>
                </div>
              </div>
            </div>

            <div className="profile-points-display">
              <span className="points-number">{userPoints.toLocaleString()}</span>
              <span className="points-label">Total Points Earned</span>
            </div>
          </div>

          <button className="profile-settings-v2-btn" onClick={() => setShowSettings(true)}>
            <FaCog /> Account Settings
          </button>
        </aside>

        {/* Right Column: Information & Stats */}
        <main className="profile-main-content">
          
          <header className="profile-header-v2">
            <div className="header-text">
              <h1>{user.name}</h1>
              <p>{user.category} from {user.country}</p>
            </div>
            <button 
              className={`edit-toggle-v2 ${isEditing ? 'active' : ''}`} 
              onClick={() => { if(isEditing) handleSaveChanges(); else setIsEditing(true); }}
            >
              {isEditing ? <><FaCheckCircle /> Save Changes</> : <><FaPencilAlt /> Edit Profile</>}
            </button>
          </header>

          <section className="profile-grid-v2">
            {/* Info Cards */}
            <div className="info-card-v2">
              <div className="card-icon"><FaUser /></div>
              <div className="card-body">
                <label>Full Name</label>
                {isEditing ? (
                  <input type="text" value={user.name || ""} onChange={(e) => handleChange("name", e.target.value)} />
                ) : (
                  <p>{user.name}</p>
                )}
              </div>
            </div>

            <div className="info-card-v2">
              <div className="card-icon"><FaEnvelope /></div>
              <div className="card-body">
                <label>Email Address</label>
                {isEditing ? (
                  <input type="email" value={user.email || ""} onChange={(e) => handleChange("email", e.target.value)} />
                ) : (
                  <p>{user.email}</p>
                )}
              </div>
            </div>

            <div className="info-card-v2">
              <div className="card-icon"><FaUserGraduate /></div>
              <div className="card-body">
                <label>Category</label>
                {isEditing ? (
                  <select value={user.category || ""} onChange={(e) => handleChange("category", e.target.value)}>
                    <option value="Student">Student</option>
                    <option value="Health Tutor">Health Tutor</option>
                    <option value="Nurse">Nurse</option>
                    <option value="Doctor">Doctor</option>
                    <option value="Other Health Worker">Other Health Worker</option>
                  </select>
                ) : (
                  <p>{user.category}</p>
                )}
              </div>
            </div>

            <div className="info-card-v2">
              <div className="card-icon"><FaMapMarkerAlt /></div>
              <div className="card-body">
                <label>Country / Location</label>
                {isEditing ? (
                  <select value={user.country || ""} onChange={(e) => handleChange("country", e.target.value)}>
                    {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <p>{user.country}</p>
                )}
              </div>
            </div>
          </section>

          {/* Additional Stats Section */}
          <section className="stats-section-v2">
            <h3 className="section-title-v2">Learning Activity</h3>
            <div className="stats-mini-grid">
              <div className="stat-pill">
                <span className="pill-icon">📝</span>
                <div className="pill-text">
                  <span className="pill-val">245</span>
                  <span className="pill-lab">Solved</span>
                </div>
              </div>
              <div className="stat-pill">
                <span className="pill-icon">🔥</span>
                <div className="pill-text">
                  <span className="pill-val">{Math.max(userStreak, 0) || 12}</span>
                  <span className="pill-lab">Day Streak</span>
                </div>
              </div>
              <div className="stat-pill">
                <span className="pill-icon">🏅</span>
                <div className="pill-text">
                  <span className="pill-val">Top 5%</span>
                  <span className="pill-lab">Ranking</span>
                </div>
              </div>
            </div>
          </section>

          {isEditing && (
            <div className="editing-actions-v2">
              <button className="cancel-btn-v2" onClick={() => setIsEditing(false)}>Discard Changes</button>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal (Re-using the previous high-quality design) */}
      {showSettings && (
        <div className="settings-overlay" onClick={(e) => e.target.classList.contains('settings-overlay') && setShowSettings(false)}>
          <div className="settings-modal">
            <div className="settings-header">
              <div className="settings-title-wrap">
                <div className="settings-title-icon"><FaCog /></div>
                <h3>Account Settings</h3>
              </div>
              <button className="close-settings" onClick={() => setShowSettings(false)}><FaTimes /></button>
            </div>
            
            <div className="settings-content">
              <div className="setting-card">
                <div className="setting-info">
                  <div className="setting-icon-box">{theme === "dark" ? <FaMoon /> : <FaSun />}</div>
                  <div className="setting-text">
                    <span className="setting-name">Appearance</span>
                    <span className="setting-hint">{theme === "dark" ? "Dark mode active" : "Light mode active"}</span>
                  </div>
                </div>
                <div className={`custom-toggle ${theme === "dark" ? "active" : ""}`} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
                  <div className="toggle-slider" />
                </div>
              </div>

              <div className="setting-card">
                <div className="setting-info">
                  <div className="setting-icon-box"><FaGlobe /></div>
                  <div className="setting-text">
                    <span className="setting-name">Language</span>
                    <span className="setting-hint">System interface language</span>
                  </div>
                </div>
                <select className="setting-dropdown" value={language} onChange={(e) => {setLanguage(e.target.value); localStorage.setItem("language", e.target.value);}}>
                  <option value="English">English</option>
                  <option value="French">French</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Twi">Twi</option>
                </select>
              </div>

              <div className="settings-sub-title">Security & Privacy</div>
              <div className="setting-card">
                <div className="setting-info">
                  <div className="setting-icon-box"><FaLock /></div>
                  <div className="setting-text">
                    <span className="setting-name">Authentication</span>
                    <span className="setting-hint">Update your login password</span>
                  </div>
                </div>
                <button className={`setting-action-btn ${resetSent ? "success" : ""}`} onClick={handlePasswordReset} disabled={resetSent}>
                  {resetSent ? <><FaCheckCircle /> Sent</> : "Reset Password"}
                </button>
              </div>
            </div>
            
            <div className="settings-footer">
              <button className="settings-done-btn" onClick={() => setShowSettings(false)}>Save & Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;