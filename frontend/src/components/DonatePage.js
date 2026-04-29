// src/components/DonatePage.js
import React from "react";
import "../styles/dashboard.css";

function DonatePage({ onClose }) {
  return (
    <div className="page page-left">
      <div className="page-header">
        <button onClick={onClose}>Back</button>
        <h2>Support / Donate</h2>
      </div>
      <p>Help keep Universal Health free by supporting us.</p>
      <div className="donate-info">
        <p><strong>Bank:</strong> Example Bank</p>
        <p><strong>Account Name:</strong> Universal Health</p>
        <p><strong>Account Number:</strong> 1234567890</p>
      </div>
    </div>
  );
}

export default DonatePage;
