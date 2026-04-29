import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/auth.css";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const response = await axios.post("/api/auth/forgot-password", { email });
      setMessage(response.data.message || "If this email exists, a reset link has been sent.");
      setEmail("");
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

          <h1 className="auth-title">Forgot Password</h1>
          <p className="auth-subtitle">Enter your email and we'll send you a reset link</p>

          {message && <p className="success-text">{message}</p>}
          {error && <p className="error-text">{error}</p>}

          <form onSubmit={handleReset}>
            <label className="input-label">Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <button type="submit" className="auth-button">
              Send Reset Link &nbsp;→
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

export default ForgotPassword;