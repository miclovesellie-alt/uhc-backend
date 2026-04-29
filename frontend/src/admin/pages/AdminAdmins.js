import React, { useEffect, useState } from "react";
import axios from "axios";
import { Search, Shield, RefreshCw } from "lucide-react";

const logAction = (action) => {
  const logs = JSON.parse(localStorage.getItem("adminLogs") || "[]");
  logs.unshift({ ts: new Date().toISOString(), action, by: "Superadmin" });
  localStorage.setItem("adminLogs", JSON.stringify(logs.slice(0, 500)));
};

export default function AdminAdmins() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/users");
      const allUsers = Array.isArray(res.data) ? res.data : [];
      setUsers(allUsers.filter(u => u.role === "admin" || u.role === "superadmin"));
    } catch (err) { console.error("Load admins failed", err); }
    finally { setLoading(false); }
  };

  const updateUser = async (data, label) => {
    try {
      await axios.patch(`/api/users/${selectedUser._id}`, data);
      logAction(`${label}: ${selectedUser.name}`);
      showToast(`${label} successful`);
      setSelectedUser(null);
      setConfirmAction(null);
      fetchAdmins();
    } catch (err) { showToast("Action failed", "error"); }
  };

  const filteredAdmins = users
    .filter(u => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  const roleColor = (role) => role === "superadmin" ? "red" : "orange";

  return (
    <div className="admin-page">
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 70, right: 24, zIndex: 9999,
          padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: ".875rem",
          background: toast.type === "error" ? "#ef4444" : "#22c55e", color: "white",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)", animation: "slideIn .2s ease"
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="admin-section-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>
            🛡️ Admin Directory
          </h1>
          <p style={{ fontSize: ".82rem", color: "var(--admin-muted)", margin: "4px 0 0" }}>
            {users.length} administrators
          </p>
        </div>
        <button className="admin-btn secondary sm" onClick={fetchAdmins} disabled={loading}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--admin-muted)" }} />
          <input className="admin-input" style={{ width: "100%", paddingLeft: 36, boxSizing: "border-box" }}
            placeholder="Search admins by name or email..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Admins Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--admin-muted)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>⏳</div> Loading admins...
        </div>
      ) : filteredAdmins.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--admin-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📭</div> No admins found
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Admin Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((u, i) => (
                <tr key={u._id}>
                  <td style={{ color: "var(--admin-muted)", fontWeight: 600 }}>{i + 1}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "var(--admin-accent-pale)", color: "var(--admin-accent)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: ".85rem", flexShrink: 0
                      }}>{u.name?.[0] || "?"}</div>
                      <span style={{ fontWeight: 600, fontSize: ".875rem" }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--admin-muted)", fontSize: ".82rem" }}>{u.email}</td>
                  <td><span className={`admin-badge ${roleColor(u.role)}`}>{u.role || "admin"}</span></td>
                  <td>
                    <button className="admin-btn secondary sm" onClick={() => setSelectedUser(u)}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MANAGE MODAL ── */}
      {selectedUser && !confirmAction && (
        <div className="admin-modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: "var(--admin-accent-pale)", color: "var(--admin-accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "1.1rem"
                }}>{selectedUser.name?.[0]}</div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--admin-text)" }}>{selectedUser.name}</div>
                  <div style={{ fontSize: ".8rem", color: "var(--admin-muted)" }}>{selectedUser.email}</div>
                </div>
              </div>
              <button className="admin-btn secondary sm" onClick={() => setSelectedUser(null)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedUser.role !== "superadmin" && (
                <button className="admin-btn secondary" style={{ justifyContent: "flex-start", gap: 10 }}
                  onClick={() => setConfirmAction({ type: "role", label: "Demote to User" })}>
                  <Shield size={15} />
                  Demote to User
                </button>
              )}
              {selectedUser.role === "superadmin" && (
                <div style={{ color: "var(--admin-muted)", fontSize: ".85rem", textAlign: "center", padding: "10px" }}>
                  Superadmin cannot be modified here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM ACTION MODAL ── */}
      {confirmAction && selectedUser && (
        <div className="admin-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>⬆️</div>
            <h3 style={{ margin: "0 0 8px" }}>{confirmAction.label}?</h3>
            <p style={{ color: "var(--admin-muted)", fontSize: ".875rem", marginBottom: 20 }}>
              This action will affect <strong style={{ color: "var(--admin-text)" }}>{selectedUser.name}</strong>.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="admin-btn secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className="admin-btn primary"
                onClick={() => updateUser({ role: "user" }, confirmAction.label)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }`}</style>
    </div>
  );
}
