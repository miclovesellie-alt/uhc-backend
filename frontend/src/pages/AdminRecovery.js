import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

/**
 * AdminRecovery — A hidden, unlisted page for admin password recovery.
 * NOT linked from the login page. Admins must know this URL directly.
 * Requires: registered admin email + platform secret key.
 */
export default function AdminRecovery() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(null); // null | "loading" | "success" | "error"
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    // The platform secret key is checked on backend
    try {
      await axios.post("/api/auth/admin-forgot-password", {
        email,
        secretKey,
      });
      setStatus("success");
      setMessage(
        "If this email belongs to an admin account and the secret key is correct, a reset link has been sent. Check your inbox."
      );
    } catch (err) {
      setStatus("error");
      setMessage(
        err.response?.data?.message ||
          "Request failed. Verify your credentials."
      );
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-card-wrapper">
        <div className="auth-card" style={{ maxWidth: 420 }}>

          {/* Shield icon header */}
          <div style={{
            width: 60, height: 60, borderRadius: 18,
            background: "linear-gradient(135deg, #4255ff, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.8rem", margin: "0 auto 20px", boxShadow: "0 8px 24px rgba(66,85,255,0.35)"
          }}>
            🛡️
          </div>

          <h1 className="auth-title" style={{ textAlign: "center" }}>Admin Recovery</h1>
          <p className="auth-subtitle" style={{ textAlign: "center" }}>
            This page is for authorised administrators only.<br />
            Enter your admin email and the platform secret key.
          </p>

          {/* Info banner */}
          <div style={{
            padding: "10px 14px",
            background: "rgba(66,85,255,0.08)",
            borderRadius: 10,
            border: "1px solid rgba(66,85,255,0.25)",
            fontSize: ".8rem",
            color: "#4255ff",
            marginBottom: 20,
            lineHeight: 1.5,
          }}>
            🔐 The platform secret key is set in <strong>Admin Settings → Security</strong>.
            Contact your Super Admin if you do not have it.
          </div>

          {status === "success" && (
            <div style={{
              padding: "12px 16px", background: "rgba(34,197,94,0.12)",
              borderRadius: 10, border: "1px solid rgba(34,197,94,0.3)",
              color: "#16a34a", fontSize: ".85rem", marginBottom: 16, lineHeight: 1.5
            }}>
              ✅ {message}
            </div>
          )}
          {status === "error" && (
            <div style={{
              padding: "12px 16px", background: "rgba(239,68,68,0.1)",
              borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444", fontSize: ".85rem", marginBottom: 16
            }}>
              ❌ {message}
            </div>
          )}

          {status !== "success" && (
            <form onSubmit={handleSubmit}>
              <label className="input-label">Admin Email Address</label>
              <input
                type="email"
                placeholder="admin@uhc.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ marginBottom: 16 }}
              />

              <label className="input-label">Platform Secret Key</label>
              <div className="password-wrapper" style={{ marginBottom: 24 }}>
                <input
                  type={showKey ? "text" : "password"}
                  placeholder="Enter secret key..."
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  required
                />
                <span className="eye-icon" onClick={() => setShowKey(!showKey)}>
                  {showKey ? "🙈" : "👁️"}
                </span>
              </div>

              <button
                type="submit"
                className="auth-button"
                disabled={status === "loading"}
              >
                {status === "loading" ? "Sending…" : "Send Reset Link →"}
              </button>
            </form>
          )}

          <p className="auth-link" style={{ marginTop: 20, textAlign: "center" }}>
            <span onClick={() => navigate("/auth")} style={{ cursor: "pointer" }}>
              ← Back to Login
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
