import React, { useState, useEffect } from "react";
import axios from "axios";
import { Trash2, RotateCcw, AlertTriangle, Search } from "lucide-react";
import "../../admin_styles/AdminLibrary.css";

export default function AdminRecycleBin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    fetchBin();
  }, []);

  const fetchBin = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/admin/recycle-bin", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(res.data);
    } catch (err) {
      console.error("Failed to fetch bin", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`/api/admin/recycle-bin/restore/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBin();
    } catch (err) {
      alert("Restore failed");
    }
  };

  const handlePermanentDelete = (id) => {
    setItemToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmPermanentDelete = async () => {
    if (!itemToDelete) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`/api/admin/recycle-bin/${itemToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowDeleteModal(false);
      setItemToDelete(null);
      fetchBin();
    } catch (err) {
      alert("Delete failed");
    }
  };

  const filteredItems = items.filter(i => 
    i.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    JSON.stringify(i.data).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-page">
      <div className="admin-section-header">
        <div>
          <h1 className="admin-title">Recycle Bin</h1>
          <p className="admin-subtitle">Deleted items are kept here for 7 days</p>
        </div>
        <div className="admin-badge orange" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
          <AlertTriangle size={14} /> Auto-purge enabled
        </div>
      </div>

      <div className="library-admin-controls">
        <div className="search-bar">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search by type or content..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Resource Type</th>
              <th>Original Name/Text</th>
              <th>Deleted On</th>
              <th>Expires In</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center">Loading...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan="5" className="text-center">Recycle bin is empty</td></tr>
            ) : (
              filteredItems.map(item => {
                const daysLeft = Math.ceil((new Date(item.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <tr key={item._id}>
                    <td><span className="admin-badge blue">{item.type}</span></td>
                    <td>
                      <div style={{ maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.data.title || item.data.question || "Untitled Item"}
                      </div>
                    </td>
                    <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span style={{ color: daysLeft <= 2 ? 'var(--admin-danger)' : 'inherit', fontWeight: 600 }}>
                        {daysLeft} days
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="action-btn" title="Restore" onClick={() => handleRestore(item._id)}>
                          <RotateCcw size={16} />
                        </button>
                        <button className="action-btn delete" title="Delete Permanently" onClick={() => handlePermanentDelete(item._id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ 
                width: 56, 
                height: 56, 
                borderRadius: '50%', 
                background: '#fff7ed', 
                color: '#ea580c', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                marginBottom: 20
              }}>
                <AlertTriangle size={28} />
              </div>
              
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--admin-text)', marginBottom: 8 }}>
                Permanently delete?
              </h3>
              
              <p style={{ color: 'var(--admin-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 28 }}>
                This action is <strong style={{ color: '#ef4444' }}>permanent</strong> and cannot be undone. 
                The document will be completely removed from the system.
              </p>
              
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button 
                  className="admin-btn secondary" 
                  style={{ flex: 1, padding: '12px', fontSize: '0.9rem' }}
                  onClick={() => setShowDeleteModal(false)}
                >
                  Go Back
                </button>
                <button 
                  className="admin-btn primary" 
                  style={{ flex: 1, padding: '12px', fontSize: '0.9rem', background: '#1e293b', border: 'none' }}
                  onClick={confirmPermanentDelete}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
