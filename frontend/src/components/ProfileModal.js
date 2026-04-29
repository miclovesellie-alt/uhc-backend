import React from "react";
import "../styles/dashboard.css";

function ProfileModal({ onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>My Profile</h2>

        <p>Edit your profile information</p>

        <input type="text" placeholder="Full Name" />
        <input type="email" placeholder="Email" />
        <select>
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>

        <div className="modal-actions">
          <button className="primary-btn">Save Changes</button>
          <button className="secondary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;
