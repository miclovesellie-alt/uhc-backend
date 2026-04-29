import React, { useState } from "react";
import axios from "axios";

function Login({ onFlip, onLoginSuccess }) {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState("login"); // "login" | "signup" | "reset"

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post("https://uhc-backend.onrender.com/api/auth/login", formData);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      if (onLoginSuccess) onLoginSuccess(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    }
  };

  // Flip handlers
  const flipToSignup = () => setActivePage("signup");
  const flipToLogin = () => setActivePage("login");
  const flipToReset = () => setActivePage("reset");

  return (
    <div className={`flip-card ${activePage !== "login" ? "flipped-reset" : ""}`}>
      <div className="flip-card-inner">

        {/* LOGIN PAGE */}
        {activePage === "login" && (
          <div className="flip-card-front auth-card">
            <h1 className="main-heading">Universal Healthcare Community (UHC)</h1>
            <h2 className="sub-heading">Login</h2>

            {error && <p className="error-text">{error}</p>}

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <div className="password-wrapper">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <span className="eye-icon">👁️</span>
              </div>
              <button type="submit" className="auth-button">
                Login
              </button>
            </form>

            <p className="auth-link">
              Don’t have an account? <span onClick={flipToSignup}>Sign Up</span>
            </p>

            <p className="auth-link">
              Forgot password? <span onClick={flipToReset}>Reset</span>
            </p>
          </div>
        )}

        {/* RESET PAGE */}
        {activePage === "reset" && (
          <div className="flip-card-back auth-card">
            <h1 className="main-heading">Reset Password</h1>
            <div className="reset-content">
              <p className="reset-message">
                A reset message will be sent to your email.
              </p>
              <button className="auth-button" onClick={flipToLogin}>
                Back to Login
              </button>
            </div>
          </div>
        )}

        {/* SIGNUP PAGE */}
        {activePage === "signup" && (
          <div className="flip-card-back auth-card">
            <h1 className="main-heading">Sign Up</h1>
            <p className="reset-message">Redirect your signup form here</p>
            <button className="auth-button" onClick={flipToLogin}>
              Back to Login
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default Login;
