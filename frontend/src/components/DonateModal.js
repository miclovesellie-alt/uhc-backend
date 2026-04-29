import React from "react";
import "../styles/dashboard.css";

function DonateModal({ onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>Support Universal Health</h2>

        <p>
          Help keep Universal Health free by supporting us.
        </p>

        <div className="donate-info">
          <p><strong>Bank:</strong> Example Bank</p>
          <p><strong>Account Name:</strong> Universal Health</p>
          <p><strong>Account Number:</strong> 1234567890</p>
        </div>

        <button className="secondary-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default DonateModal;
