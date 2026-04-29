import React, { useState, useEffect } from "react";
import { RefreshCw, Check } from "lucide-react";
import axios from "axios";

const NOTIF_TYPES = ["All", "Users", "System", "Quiz", "Security"];

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("All");
  const [noScreenshot, setNoScreenshot] = useState(false);
  const [maintenance, setMaintenance] = useState(false);

  const load = async () => {
    try {
      const [notifsRes, ssRes, mmRes] = await Promise.all([
        axios.get("/api/admin/activity/notifications"),
        axios.get("/api/settings/noScreenshot"),
        axios.get("/api/settings/maintenanceMode")
      ]);
      
      const ssActive = ssRes.data.value === true;
      const mmActive = mmRes.data.value === true;
      
      setNoScreenshot(ssActive);
      setMaintenance(mmActive);
      setNotifications(processNotifications(notifsRes.data, ssActive, mmActive));
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

  const processNotifications = (backendNotifs, ss, mm) => {
    const list = [];
    
    // Add dynamic system status notifications
    if (ss) list.push({ id: "ss", type: "Security", icon: "📵", title: "No-Screenshot Active", desc: "Screenshot protection is enabled for all quizzes", time: "Active now", read: false, color: "blue" });
    if (mm) list.push({ id: "mm", type: "System", icon: "🔧", title: "Maintenance Mode", desc: "Platform is in maintenance — users cannot log in", time: "Active now", read: false, color: "orange" });

    // Map backend notifications
    backendNotifs.forEach(n => {
      const isReadByMe = n.readBy?.includes(localStorage.getItem("userId"));
      list.push({
        id: n._id,
        type: n.type === 'DANGER' ? 'Security' : n.type === 'WARNING' ? 'Quiz' : 'System',
        icon: n.type === 'DANGER' ? '🚫' : n.type === 'WARNING' ? '⚠️' : '🔔',
        title: n.sender?.name || 'System Alert',
        desc: n.message,
        time: new Date(n.createdAt).toLocaleString(),
        read: isReadByMe,
        color: n.type === 'DANGER' ? 'red' : n.type === 'WARNING' ? 'orange' : 'blue'
      });
    });

    return list;
  };



  useEffect(() => { load(); }, []);

  const filtered = notifications.filter(n => filter === "All" || n.type === filter);
  const unread = notifications.filter(n => !n.read).length;

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const colorMap = { blue: "#4255ff", green: "#22c55e", orange: "#f59e0b", red: "#ef4444" };

  return (
    <div className="admin-page">
      <div className="admin-section-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>
            🔔 Notifications
            {unread > 0 && <span style={{ marginLeft: 10, fontSize: ".75rem", background: "#ef4444", color: "white", borderRadius: 50, padding: "2px 8px", fontWeight: 700 }}>{unread}</span>}
          </h1>
          <p style={{ fontSize: ".82rem", color: "var(--admin-muted)", margin: "4px 0 0" }}>
            {notifications.length} total · {unread} unread
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="admin-btn secondary sm" onClick={markAllRead}><Check size={13} /> Mark All Read</button>
          <button className="admin-btn secondary sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {NOTIF_TYPES.map(t => (
          <button key={t} onClick={() => setFilter(t)} className={filter === t ? "admin-btn primary sm" : "admin-btn secondary sm"}>
            {t}
          </button>
        ))}
      </div>

      {/* Notification cards */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--admin-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📭</div>
          No notifications in this category
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(n => (
            <div key={n.id} style={{
              display: "flex", alignItems: "flex-start", gap: 14, padding: "16px",
              background: n.read ? "rgba(255,255,255,0.02)" : "rgba(66,85,255,0.06)",
              border: `1px solid ${n.read ? "var(--admin-border)" : "rgba(66,85,255,0.25)"}`,
              borderRadius: 14, cursor: "pointer", transition: "background .18s",
            }} onClick={async () => {
              if (!n.read && !['ss','mm'].includes(n.id)) {
                try {
                  await axios.patch(`/api/admin/activity/notifications/${n.id}/read`);
                  setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                } catch (err) { console.error(err); }
              } else {
                setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
              }
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${colorMap[n.color]}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
                {n.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: ".875rem", color: "var(--admin-text)" }}>{n.title}</span>
                  <span className={`admin-badge ${n.color}`} style={{ fontSize: ".68rem" }}>{n.type}</span>
                  {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--admin-accent)", flexShrink: 0 }} />}
                </div>
                <div style={{ fontSize: ".82rem", color: "var(--admin-muted)", lineHeight: 1.4 }}>{n.desc}</div>
              </div>
              <div style={{ fontSize: ".75rem", color: "var(--admin-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{n.time}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
