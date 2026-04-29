import React, { useState, useEffect, useContext } from "react";
import { Save, Eye, EyeOff, Moon, Sun } from "lucide-react";
import api from "../../api/api";
import { UserContext } from "../../context/UserContext";

const logAction = (action) => {
  const logs = JSON.parse(localStorage.getItem("adminLogs") || "[]");
  logs.unshift({ ts: new Date().toISOString(), action, by: "Admin" });
  localStorage.setItem("adminLogs", JSON.stringify(logs.slice(0, 500)));
};

const Toggle = ({ checked, onChange, icon, label, desc }) => (
  <div style={{ 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "space-between", 
    padding: "14px 16px", 
    background: "var(--admin-card)", 
    border: "1px solid var(--admin-border)", 
    borderRadius: 12, 
    marginBottom: 8 
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: "1.1rem" }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: ".875rem", color: "var(--admin-text)" }}>{label}</div>
        {desc && <div style={{ fontSize: ".75rem", color: "var(--admin-muted)", marginTop: 2 }}>{desc}</div>}
      </div>
    </div>
    <button onClick={() => onChange(!checked)} style={{ width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", background: checked ? "var(--admin-accent)" : "#cbd5e1", position: "relative", transition: "background .2s", flexShrink: 0 }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "white", position: "absolute", top: 4, left: checked ? 24 : 4, transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
    </button>
  </div>
);

const Section = ({ icon, title, children }) => (
  <div style={{ background: "var(--admin-card)", border: "1px solid var(--admin-border)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--admin-border)" }}>
      <span style={{ fontSize: "1.1rem" }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: ".95rem", fontWeight: 700, color: "var(--admin-text)" }}>{title}</h3>
    </div>
    {children}
  </div>
);

export default function AdminSettings() {
  const { adminTheme, setAdminTheme } = useContext(UserContext);
  const [name, setName] = useState("Admin");
  const [email, setEmail] = useState("admin@uhc.com");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [secretKey, setSecretKey] = useState(() => localStorage.getItem("adminSecretKey") || "UHC-ADMIN-2024");
  const [showKey, setShowKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [noScreenshot, setNoScreenshot] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [quizTimer, setQuizTimer] = useState(true);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [toast, setToast] = useState(null);

  // Load settings from backend
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: ns } = await api.get("/settings/noScreenshot");
        if (ns.value !== null) setNoScreenshot(ns.value);
        
        const { data: mm } = await api.get("/settings/maintenanceMode");
        if (mm.value !== null) setMaintenanceMode(mm.value);

        const { data: qt } = await api.get("/settings/quizTimer");
        if (qt.value !== null) setQuizTimer(qt.value);

        const { data: ro } = await api.get("/settings/registrationOpen");
        if (ro.value !== null) setRegistrationOpen(ro.value);
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const copyKey = () => {
    navigator.clipboard.writeText(secretKey).then(() => { setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000); });
  };

  const saveSecretKey = () => {
    localStorage.setItem("adminSecretKey", secretKey);
    logAction("Updated platform secret key");
    showToast("Secret key saved");
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveProfile = () => { logAction("Updated admin profile settings"); showToast("Profile settings saved"); };
  
  const saveSecurity = async () => {
    try {
      await api.post("/settings", { key: "noScreenshot", value: noScreenshot });
      await api.post("/settings", { key: "quizTimer", value: quizTimer });
      logAction(`Updated security & quiz controls`);
      showToast("Security settings saved");
    } catch (err) {
      showToast("Failed to save security settings", "error");
    }
  };

  const saveSystem = async () => {
    try {
      await api.post("/settings", { key: "maintenanceMode", value: maintenanceMode });
      await api.post("/settings", { key: "registrationOpen", value: registrationOpen });
      logAction("Updated system settings");
      showToast("System settings saved");
    } catch (err) {
      showToast("Failed to save system settings", "error");
    }
  };

  return (
    <div className="admin-page" style={{ maxWidth: 720 }}>
      {toast && (
        <div style={{ position: "fixed", top: 70, right: 24, zIndex: 9999, padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: ".875rem", background: toast.type === "error" ? "#ef4444" : "#22c55e", color: "white", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>{toast.msg}</div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>⚙️ Settings</h1>
        <p style={{ fontSize: ".82rem", color: "var(--admin-muted)", margin: "4px 0 0" }}>Manage admin preferences and system configuration</p>
      </div>

      <Section icon="✨" title="Appearance">
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          padding: "14px 16px", 
          background: "var(--admin-card)", 
          border: "1px solid var(--admin-border)", 
          borderRadius: 12, 
          marginBottom: 8 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "1.1rem" }}>{adminTheme === "dark" ? <Moon size={18} /> : <Sun size={18} />}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: ".875rem", color: "var(--admin-text)" }}>Dark Mode</div>
              <div style={{ fontSize: ".75rem", color: "var(--admin-muted)", marginTop: 2 }}>Switch between light and dark themes for the admin panel</div>
            </div>
          </div>
          <button 
            onClick={() => setAdminTheme(adminTheme === "light" ? "dark" : "light")} 
            style={{ 
              width: 46, 
              height: 26, 
              borderRadius: 13, 
              border: "none", 
              cursor: "pointer", 
              background: adminTheme === "dark" ? "var(--admin-accent)" : "#cbd5e1", 
              position: "relative", 
              transition: "background .2s", 
              flexShrink: 0 
            }}
          >
            <div style={{ 
              width: 18, 
              height: 18, 
              borderRadius: "50%", 
              background: "white", 
              position: "absolute", 
              top: 4, 
              left: adminTheme === "dark" ? 24 : 4, 
              transition: "left .2s", 
              boxShadow: "0 1px 4px rgba(0,0,0,0.2)" 
            }} />
          </button>
        </div>
      </Section>

      <Section icon="👤" title="Admin Profile">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: ".78rem", color: "var(--admin-muted)", fontWeight: 600, display: "block", marginBottom: 6 }}>DISPLAY NAME</label>
            <input className="admin-input" style={{ width: "100%", boxSizing: "border-box" }} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: ".78rem", color: "var(--admin-muted)", fontWeight: 600, display: "block", marginBottom: 6 }}>EMAIL</label>
            <input className="admin-input" style={{ width: "100%", boxSizing: "border-box" }} type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: ".78rem", color: "var(--admin-muted)", fontWeight: 600, display: "block", marginBottom: 6 }}>NEW PASSWORD</label>
            <div style={{ position: "relative" }}>
              <input className="admin-input" style={{ width: "100%", boxSizing: "border-box", paddingRight: 44 }} type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to keep current" />
              <button onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--admin-muted)" }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button className="admin-btn primary" style={{ alignSelf: "flex-end" }} onClick={saveProfile}>
            <Save size={14} /> Save Profile
          </button>
        </div>
      </Section>

      <Section icon="🛡️" title="Security & Quiz Controls">
        <Toggle checked={noScreenshot} onChange={(v) => { setNoScreenshot(v); }} icon={noScreenshot ? "📵" : "📸"} label="No-Screenshot Mode" desc="Blocks screenshots during quizzes. Applies watermark and blur on tab switch." />
        <Toggle checked={quizTimer} onChange={(v) => { setQuizTimer(v); }} icon="⏱️" label="Quiz Timer" desc="Show per-question countdown timer during quizzes" />
        <button className="admin-btn primary" style={{ marginTop: 12 }} onClick={saveSecurity}>
          <Save size={14} /> Save Security Settings
        </button>
        {noScreenshot && (
          <div style={{ padding:"12px 16px", background:"rgba(66,85,255,0.06)", borderRadius:10, border:"1px solid rgba(66,85,255,0.2)", fontSize:".82rem", color:"var(--admin-accent)", marginTop:8 }}>
            ✅ No-Screenshot mode is <strong>ACTIVE</strong>. Students have screenshot protection & blur-on-tab-switch.
          </div>
        )}
      </Section>

      <Section icon="🔑" title="Admin Recovery Secret Key">
        <div style={{ padding:"10px 14px", background:"rgba(66,85,255,0.06)", borderRadius:10, border:"1px solid rgba(66,85,255,0.2)", fontSize:".8rem", color:"#4255ff", marginBottom:14, lineHeight:1.6 }}>
          🔐 This key is required to access the <strong>/admin-recovery</strong> page. Share it only with authorised admins. Change it regularly.
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ position:"relative" }}>
            <input
              className="admin-input"
              style={{ width:"100%", boxSizing:"border-box", paddingRight:90, fontFamily:"monospace", fontSize:"1rem", letterSpacing:".08em" }}
              type={showKey ? "text" : "password"}
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
            />
            <div style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", display:"flex", gap:4 }}>
              <button onClick={() => setShowKey(k=>!k)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--admin-muted)" }}>
                {showKey ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
              <button onClick={copyKey} style={{ background:"none", border:"none", cursor:"pointer", fontSize:".75rem", color:"var(--admin-accent)", fontWeight:700 }}>
                {keyCopied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
          <button className="admin-btn primary" style={{ alignSelf:"flex-start" }} onClick={saveSecretKey}>
            <Save size={14}/> Save Secret Key
          </button>
        </div>
      </Section>

      <Section icon="🔔" title="Notification Preferences">
        <Toggle checked={emailNotif} onChange={setEmailNotif} icon="📧" label="Email Notifications" desc="Receive alerts for new signups and quiz completions" />
        <Toggle checked={smsNotif} onChange={setSmsNotif} icon="📱" label="SMS Notifications" desc="Receive critical alerts via SMS" />
        <button className="admin-btn primary" style={{ marginTop: 8 }} onClick={() => { showToast("Notification settings saved"); logAction("Updated notification settings"); }}>
          <Save size={14} /> Save Notifications
        </button>
      </Section>

      <Section icon="🖥️" title="System Configuration">
        <Toggle checked={maintenanceMode} onChange={setMaintenanceMode} icon="🔧" label="Maintenance Mode" desc="Temporarily disable user access to the platform" />
        <Toggle checked={registrationOpen} onChange={setRegistrationOpen} icon="📝" label="Open Registration" desc="Allow new users to sign up" />
        {maintenanceMode && (
          <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", fontSize: ".82rem", color: "#ef4444", marginTop: 8 }}>
            ⚠️ <strong>Maintenance Mode is ON.</strong> Regular users cannot access the platform.
          </div>
        )}
        <button className="admin-btn primary" style={{ marginTop: 12 }} onClick={saveSystem}>
          <Save size={14} /> Save System Settings
        </button>
      </Section>

      <Section icon="⚠️" title="Danger Zone">
        <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: ".875rem", color: "#ef4444" }}>Clear All Activity Logs</div>
            <div style={{ fontSize: ".75rem", color: "var(--admin-muted)", marginTop: 2 }}>Permanently removes all admin activity records</div>
          </div>
          <button className="admin-btn danger sm" onClick={() => { localStorage.removeItem("adminLogs"); showToast("Logs cleared"); }}>Clear Logs</button>
        </div>
      </Section>
    </div>
  );
}