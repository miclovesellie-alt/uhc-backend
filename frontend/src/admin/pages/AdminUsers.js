import React, { useEffect, useState } from "react";
import axios from "axios";
import { Search, Shield, Ban, Key, Trash2, RefreshCw, Eye, EyeOff } from "lucide-react";

const logAction = (action) => {
  const logs = JSON.parse(localStorage.getItem("adminLogs") || "[]");
  logs.unshift({ ts: new Date().toISOString(), action, by: "Admin" });
  localStorage.setItem("adminLogs", JSON.stringify(logs.slice(0, 500)));
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [resetPasswordModal, setResetPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error("Load users failed", err); }
    finally { setLoading(false); }
  };

  const updateUser = async (data, label) => {
    try {
      await axios.patch(`/api/users/${selectedUser._id}`, data);
      logAction(`${label}: ${selectedUser.name}`);
      showToast(`${label} successful`);
      setSelectedUser(null);
      setConfirmAction(null);
      fetchUsers();
    } catch (err) { showToast("Action failed", "error"); }
  };

  const deleteUser = async () => {
    try {
      await axios.delete(`/api/users/${selectedUser._id}`);
      logAction(`Deleted user: ${selectedUser.name}`);
      showToast("User deleted");
      setSelectedUser(null);
      setConfirmAction(null);
      fetchUsers();
    } catch (err) { showToast("Delete failed", "error"); }
  };

  const doResetPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      showToast("Password must be at least 4 characters", "error"); return;
    }
    try {
      await axios.post(`/api/users/${selectedUser._id}/reset-password`, { newPassword });
      logAction(`Reset password for: ${selectedUser.name}`);
      showToast(`Password reset for ${selectedUser.name}`);
      setResetPasswordModal(false);
      setNewPassword("");
      setSelectedUser(null);
    } catch (err) { showToast("Reset failed", "error"); }
  };

  const filteredUsers = users
    .filter(u => {
      if (filter === "admins")  return u.role === "admin";
      if (filter === "banned")  return u.status === "banned";
      if (filter === "active")  return u.status !== "banned";
      return true;
    })
    .filter(u => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  const roleColor = (role) => role === "admin" ? "orange" : role === "superadmin" ? "red" : "blue";

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
            👥 User Management
          </h1>
          <p style={{ fontSize: ".82rem", color: "var(--admin-muted)", margin: "4px 0 0" }}>
            {users.length} total users
          </p>
        </div>
        <button className="admin-btn secondary sm" onClick={fetchUsers} disabled={loading}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--admin-muted)" }} />
          <input className="admin-input" style={{ width: "100%", paddingLeft: 36, boxSizing: "border-box" }}
            placeholder="Search by name or email..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Users</option>
          <option value="active">Active</option>
          <option value="admins">Admins</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* User Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--admin-muted)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>⏳</div> Loading users...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--admin-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📭</div> No users found
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Country</th>
                <th>Points</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, i) => (
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
                  <td><span className={`admin-badge ${roleColor(u.role)}`}>{u.role || "user"}</span></td>
                  <td>
                    <span className={`admin-badge ${u.status === "banned" ? "red" : "green"}`}>
                      {u.status === "banned" ? "Banned" : "Active"}
                    </span>
                  </td>
                  <td style={{ color: "var(--admin-muted)", fontSize: ".82rem" }}>{u.country || "—"}</td>
                  <td style={{ fontWeight: 600 }}>{u.points || 0}</td>
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

      {/* ── USER ACTIONS MODAL ── */}
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

            {/* User info grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                ["Role", selectedUser.role || "user"],
                ["Status", selectedUser.status || "active"],
                ["Country", selectedUser.country || "—"],
                ["Category", selectedUser.category || "—"],
                ["Points", selectedUser.points || 0],
                ["Phone", selectedUser.phone || "—"],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid var(--admin-border)" }}>
                  <div style={{ fontSize: ".7rem", color: "var(--admin-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: ".875rem", color: "var(--admin-text)", fontWeight: 600 }}>{String(val)}</div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="admin-btn secondary" style={{ justifyContent: "flex-start", gap: 10 }}
                onClick={() => setConfirmAction({ type: "role", label: selectedUser.role === "admin" ? "Demote to User" : "Promote to Admin" })}>
                <Shield size={15} />
                {selectedUser.role === "admin" ? "Demote to User" : "Promote to Admin"}
              </button>
              <button className="admin-btn secondary" style={{ justifyContent: "flex-start", gap: 10 }}
                onClick={() => setConfirmAction({ type: "ban", label: selectedUser.status === "banned" ? "Unban User" : "Ban User" })}>
                <Ban size={15} />
                {selectedUser.status === "banned" ? "Unban User" : "Ban User"}
              </button>
              <button className="admin-btn secondary" style={{ justifyContent: "flex-start", gap: 10 }}
                onClick={() => { setResetPasswordModal(true); }}>
                <Key size={15} /> Reset Password
              </button>
              <button className="admin-btn danger" style={{ justifyContent: "flex-start", gap: 10 }}
                onClick={() => setConfirmAction({ type: "delete", label: `Delete ${selectedUser.name}` })}>
                <Trash2 size={15} /> Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM ACTION MODAL ── */}
      {confirmAction && selectedUser && (
        <div className="admin-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>
              {confirmAction.type === "delete" ? "🗑️" : confirmAction.type === "ban" ? "🚫" : confirmAction.type === "role" ? "⬆️" : "🔑"}
            </div>
            <h3 style={{ margin: "0 0 8px" }}>{confirmAction.label}?</h3>
            <p style={{ color: "var(--admin-muted)", fontSize: ".875rem", marginBottom: 20 }}>
              This action will affect <strong style={{ color: "var(--admin-text)" }}>{selectedUser.name}</strong>.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="admin-btn secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button
                className={confirmAction.type === "delete" ? "admin-btn danger" : "admin-btn primary"}
                onClick={() => {
                  if (confirmAction.type === "delete") deleteUser();
                  else if (confirmAction.type === "ban") updateUser({ status: selectedUser.status === "banned" ? "active" : "banned" }, confirmAction.label);
                  else if (confirmAction.type === "role") updateUser({ role: selectedUser.role === "admin" ? "user" : "admin" }, confirmAction.label);
                  else if (confirmAction.type === "reset") updateUser({ password: "123456" }, "Password reset");
                }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL ── */}
      {resetPasswordModal && selectedUser && (
        <div className="admin-modal-overlay" onClick={() => { setResetPasswordModal(false); setNewPassword(""); }}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>🔑 Reset Password</h3>
              <button className="admin-btn secondary sm" onClick={() => { setResetPasswordModal(false); setNewPassword(""); }}>✕</button>
            </div>
            <p style={{ color: "var(--admin-muted)", fontSize: ".875rem", marginBottom: 16 }}>
              Set a new password for <strong style={{ color: "var(--admin-text)" }}>{selectedUser.name}</strong>
            </p>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <input
                className="admin-input"
                style={{ width: "100%", boxSizing: "border-box", paddingRight: 44 }}
                type={showNewPass ? "text" : "password"}
                placeholder="New password (min 4 chars)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doResetPassword()}
              />
              <button
                onClick={() => setShowNewPass(p => !p)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--admin-muted)" }}
              >
                {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="admin-btn secondary" onClick={() => { setResetPasswordModal(false); setNewPassword(""); }}>Cancel</button>
              <button className="admin-btn primary" onClick={doResetPassword}>Reset Password</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }`}</style>
    </div>
  );
}