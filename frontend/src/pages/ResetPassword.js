import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/auth.css";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const response = await axios.post("/api/auth/reset-password", {
        token,
        newPassword,
      });
      setMessage(response.data.message || "Password reset successfully");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => navigate("/auth"), 3000);
    } catch (err) {
      setError(
        err.response?.data?.message || "Something went wrong. Please try again later."
      );
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-card-wrapper">
        <div className="auth-card">
          <button className="auth-back-btn" onClick={() => navigate("/auth")}>
            <span className="back-circle">←</span>
            <span className="back-label">Back to Login</span>
          </button>

          <h1 className="auth-title">New Password</h1>
          <p className="auth-subtitle">Enter your new password below to reset your account</p>

          {message && <p className="success-text">{message}</p>}
          {error && <p className="error-text">{error}</p>}

          <form onSubmit={handleReset}>
            <label className="input-label">New Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="newPassword"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <span className="eye-icon" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? "🙈" : "👁️"}
              </span>
            </div>

            <label className="input-label">Confirm Password</label>
            <div className="password-wrapper">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <span className="eye-icon" onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? "🙈" : "👁️"}
              </span>
            </div>

            <button type="submit" className="auth-button">
              Reset Password &nbsp;→
            </button>
          </form>

          <p className="auth-link">
            Remember your password?{" "}
            <span onClick={() => navigate("/auth")}>Login</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;