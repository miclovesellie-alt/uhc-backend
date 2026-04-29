import React, { useState, useEffect } from "react";
import axios from "axios";
import { Copy, Trash2, Edit2, AlertTriangle, RefreshCw } from "lucide-react";

export default function DuplicateQuestions() {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/questions/duplicates/find");
      setDuplicates(res.data);
    } catch (err) {
      console.error("Fetch duplicates failed", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm("Are you sure you want to delete this specific question instance?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`/api/admin/questions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDuplicates();
    } catch (err) {
      alert("Delete failed");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-section-header">
        <div>
          <h1 className="admin-title">Duplicate Question Finder</h1>
          <p className="admin-subtitle">Find and remove identical questions across your database</p>
        </div>
        <button className="admin-btn secondary" onClick={fetchDuplicates}>
          <RefreshCw size={18} /> Refresh List
        </button>
      </div>

      {duplicates.length > 0 && (
        <div className="admin-alert warning" style={{ marginBottom: 24, padding: 16, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          <AlertTriangle color="#f59e0b" />
          <span style={{ color: '#d97706', fontWeight: 600 }}>We found {duplicates.length} sets of duplicate questions.</span>
        </div>
      )}

      <div className="duplicates-list">
        {loading ? (
          <div className="text-center py-20">Loading duplicates...</div>
        ) : duplicates.length === 0 ? (
          <div className="text-center py-20">No duplicates found! Great job.</div>
        ) : (
          duplicates.map((group, i) => (
            <div key={i} className="duplicate-group-card" style={{ background: 'var(--admin-card-bg)', border: '1px solid var(--admin-border)', borderRadius: 16, marginBottom: 24, overflow: 'hidden' }}>
              <div className="group-header" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, color: 'var(--admin-text)' }}>
                  Question Text: "{group._id}"
                </div>
                <span className="admin-badge red">{group.count} occurrences</span>
              </div>
              <div className="group-docs" style={{ padding: 20 }}>
                {group.docs.map(doc => (
                  <div key={doc._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.1)', borderRadius: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--admin-muted)' }}>ID: {doc._id}</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--admin-text)' }}>Course: <span className="admin-badge blue">{doc.course}</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="action-btn delete" onClick={() => deleteQuestion(doc._id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
