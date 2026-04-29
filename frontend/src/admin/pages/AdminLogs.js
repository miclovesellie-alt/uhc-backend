import React, { useState, useEffect } from "react";
import { Trash2, Download, Search, RefreshCw } from "lucide-react";
import axios from "axios";

const ACTION_TYPES = ["All", "Added", "Edited", "Deleted", "Updated", "Enabled", "Disabled", "Cleared", "Promoted", "Demoted", "Banned", "Reset"];

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadLogs = async () => {
    try {
      const res = await axios.get("/api/admin/activity/logs");
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load logs", err);
      setLogs([]);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const filteredLogs = logs.filter(log => {
    const fullText = `${log.action} ${log.admin?.name} ${log.message}`.toLowerCase();
    const matchSearch = fullText.includes(search.toLowerCase());
    const matchFilter = filter === "All" || log.action?.toLowerCase().includes(filter.toLowerCase());
    return matchSearch && matchFilter;
  });

  const clearLogs = () => {
    localStorage.removeItem("adminLogs");
    setLogs([]);
    showToast("All logs cleared");
  };

  const exportCSV = () => {
    const rows = [["Timestamp", "Action", "By"], ...logs.map(l => [l.ts, l.action, l.by])];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "admin_logs.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const formatTs = (ts) => {
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  };

  const getActionColor = (action = "") => {
    if (action.toLowerCase().includes("delet")) return "red";
    if (action.toLowerCase().includes("add") || action.toLowerCase().includes("creat")) return "green";
    if (action.toLowerCase().includes("ban")) return "orange";
    if (action.toLowerCase().includes("edit") || action.toLowerCase().includes("updat")) return "blue";
    if (action.toLowerCase().includes("clear")) return "orange";
    if (action.toLowerCase().includes("enabl") || action.toLowerCase().includes("disabl")) return "orange";
    return "blue";
  };

  const getActionIcon = (action = "") => {
    if (action.toLowerCase().includes("delet")) return "🗑️";
    if (action.toLowerCase().includes("add") || action.toLowerCase().includes("creat")) return "➕";
    if (action.toLowerCase().includes("ban")) return "🚫";
    if (action.toLowerCase().includes("edit") || action.toLowerCase().includes("updat")) return "✏️";
    if (action.toLowerCase().includes("login") || action.toLowerCase().includes("sign")) return "🔑";
    if (action.toLowerCase().includes("clear")) return "🧹";
    if (action.toLowerCase().includes("screenshot")) return "📵";
    if (action.toLowerCase().includes("promot")) return "⬆️";
    return "📋";
  };

  return (
    <div className="admin-page">
      {toast && (
        <div style={{ position: "fixed", top: 70, right: 24, zIndex: 9999, padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: ".875rem", background: toast.type === "error" ? "#ef4444" : "#22c55e", color: "white", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>{toast.msg}</div>
      )}

      <div className="admin-section-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>📋 Activity Logs</h1>
          <p style={{ fontSize: ".82rem", color: "var(--admin-muted)", margin: "4px 0 0" }}>
            {logs.length} entries — Superadmin monitoring of all admin actions
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="admin-btn secondary sm" onClick={loadLogs}><RefreshCw size={13} /> Refresh</button>
          <button className="admin-btn secondary sm" onClick={exportCSV}><Download size={13} /> Export CSV</button>
          <button className="admin-btn danger sm" onClick={clearLogs}><Trash2 size={13} /> Clear All</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Actions", value: logs.length, icon: "📊" },
          { label: "Today", value: logs.filter(l => new Date(l.ts).toDateString() === new Date().toDateString()).length, icon: "📅" },
          { label: "Deletions", value: logs.filter(l => l.action?.toLowerCase().includes("delet")).length, icon: "🗑️" },
          { label: "Additions", value: logs.filter(l => l.action?.toLowerCase().includes("add")).length, icon: "➕" },
        ].map((s, i) => (
          <div key={i} style={{ background: "var(--admin-card)", border: "1px solid var(--admin-border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: "1.2rem", marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--admin-text)" }}>{s.value}</div>
            <div style={{ fontSize: ".75rem", color: "var(--admin-muted)", fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--admin-muted)" }} />
          <input className="admin-input" style={{ width: "100%", paddingLeft: 36, boxSizing: "border-box" }}
            placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" value={filter} onChange={e => setFilter(e.target.value)}>
          {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Log table */}
      {filteredLogs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--admin-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📭</div>
          No log entries yet. Actions performed by admins will appear here.
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Performed By</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
               {filteredLogs.map((log, i) => (
                <tr key={log._id || i}>
                  <td style={{ color: "var(--admin-muted)", fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ color: "var(--admin-muted)", fontSize: ".8rem", whiteSpace: "nowrap" }}>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{getActionIcon(log.action)}</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: ".875rem", fontWeight: 600 }}>{log.action.replace('_', ' ')}</span>
                        <span style={{ fontSize: ".75rem", color: 'var(--admin-muted)' }}>{log.message}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--admin-accent-pale)", color: "var(--admin-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".7rem", fontWeight: 700 }}>
                        {log.admin?.name?.[0] || "?"}
                      </div>
                      <span style={{ fontSize: ".875rem", fontWeight: 500 }}>{log.admin?.name || "System"}</span>
                    </div>
                  </td>
                  <td><span className={`admin-badge ${getActionColor(log.action)}`}>{log.targetType || 'System'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
