import React, { useState } from "react";
import axios from "axios";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import "../../admin_styles/BulkUpload.css";

export default function BulkUpload() {
  const [questions, setQuestions] = useState([]);
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: '' }

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.questions && Array.isArray(data.questions)) {
          setQuestions(data.questions);
          setJsonInput(JSON.stringify(data, null, 2));
          setStatus(null);
        } else {
          throw new Error("Invalid format. Expected { questions: [...] }");
        }
      } catch (err) {
        setStatus({ type: "error", message: "Invalid JSON file: " + err.message });
      }
    };
    reader.readAsText(file);
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setJsonInput(val);
    try {
      const data = JSON.parse(val);
      if (data.questions && Array.isArray(data.questions)) {
        setQuestions(data.questions);
        setStatus(null);
      }
    } catch {
      // Don't set error while typing
    }
  };

  const handleUpload = async () => {
    if (questions.length === 0) {
      setStatus({ type: "error", message: "No questions to upload" });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post("/api/upload-questions", { questions }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStatus({ type: "success", message: res.data.message });
      setQuestions([]);
      setJsonInput("");
    } catch (err) {
      setStatus({ type: "error", message: err.response?.data?.message || "Upload failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-section-header">
        <div>
          <h1 className="admin-title">Bulk Question Upload</h1>
          <p className="admin-subtitle">Add hundreds of questions at once via JSON</p>
        </div>
      </div>

      <div className="bulk-upload-container">
        <div className="upload-options">
          {/* File Upload */}
          <div className="upload-card">
            <h3><Upload size={18} /> Upload JSON File</h3>
            <p>Select a .json file containing your questions array.</p>
            <input
              type="file"
              id="file-upload"
              accept=".json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-upload" className="admin-btn primary">
              Browse Files
            </label>
          </div>

          {/* Format Helper */}
          <div className="upload-card info">
            <h3><FileText size={18} /> Required Format</h3>
            <pre className="code-snippet">
{`{
  "questions": [
    {
      "course": "Anatomy",
      "question": "What is...?",
      "options": ["A", "B", "C", "D"],
      "answer": 0
    }
  ]
}`}
            </pre>
          </div>
        </div>

        <div className="manual-input-section">
          <h3>Manual JSON Input</h3>
          <textarea
            className="json-textarea"
            placeholder="Paste your JSON here..."
            value={jsonInput}
            onChange={handleTextChange}
          />
        </div>

        {status && (
          <div className={`status-banner ${status.type}`}>
            {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{status.message}</span>
            <button className="close-btn" onClick={() => setStatus(null)}><X size={14} /></button>
          </div>
        )}

        {questions.length > 0 && (
          <div className="preview-section">
            <div className="preview-header">
              <h3>Preview ({questions.length} questions)</h3>
              <button 
                className="admin-btn primary" 
                onClick={handleUpload}
                disabled={loading}
              >
                {loading ? "Uploading..." : "Confirm & Upload All"}
              </button>
            </div>
            
            <div className="preview-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Course</th>
                    <th>Question</th>
                    <th>Options</th>
                    <th>Answer</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.slice(0, 10).map((q, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><span className="admin-badge blue">{q.course}</span></td>
                      <td className="q-text">{q.question}</td>
                      <td className="opt-text">{q.options?.join(" | ")}</td>
                      <td><span className="admin-badge green">Index {q.answer}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {questions.length > 10 && (
                <div className="table-more">And {questions.length - 10} more questions...</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
