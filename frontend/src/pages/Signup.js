import React, { useState } from "react";
import countriesList from "../data/countries";
import axios from "axios";

function Signup({ onFlip }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    country: "",
    category: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Handle input changes
  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    if (!formData.country) {
      setError("Please select a country!");
      return;
    }

    if (!formData.category) {
      setError("Please select a category!");
      return;
    }

    try {
      const res = await axios.post(
        "https://uhc-backend.onrender.com/api/auth/signup",
        formData
      );

      setSuccess("Account created successfully! Redirecting to login...");
      setFormData({
        name: "",
        email: "",
        country: "",
        category: "",
        password: "",
        confirmPassword: "",
      });

      // Auto-flip to login after 2 seconds
      setTimeout(() => onFlip(), 2000);
    } catch (err) {
      setError(
        err.response?.data?.message || "Something went wrong. Try again."
      );
    }
  };

  return (
    <>
      <h1 className="main-heading">Universal Healthcare Community (UHC)</h1>
      <h2 className="sub-heading">Sign Up</h2>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <form className="signup-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Full Name"
          value={formData.name}
          onChange={handleChange}
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email Address"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <select
          name="country"
          value={formData.country}
          onChange={handleChange}
          required
        >
          <option value="">Select Country</option>
          {countriesList.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          name="category"
          value={formData.category}
          onChange={handleChange}
          required
        >
          <option value="">Select Category</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
          <option value="healthWorker">Health Worker</option>
          <option value="patient">Patient</option>
        </select>

        <div className="password-wrapper">
          <input
            type="password"
            name="password"
            placeholder="Create Password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <span className="eye-icon">👁️</span>
        </div>

        <div className="password-wrapper">
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
          <span className="eye-icon">👁️</span>
        </div>

        <button type="submit" className="auth-button">
          Sign Up
        </button>
      </form>

      <p className="auth-link">
        Already have an account? <span onClick={onFlip}>Login</span>
      </p>
    </>
  );
}

export default Signup;
