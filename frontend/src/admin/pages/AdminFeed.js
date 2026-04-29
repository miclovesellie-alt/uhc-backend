import React, { useState, useEffect } from "react";
import api from "../../api/api";
import { Plus, Trash2, Send, Layout, AlertTriangle } from "lucide-react";
import "../../admin_styles/AdminLibrary.css";

export default function AdminFeed() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [newItem, setNewItem] = useState({ title: "", content: "", category: "Health" });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      const res = await api.get("/admin/feed");
      setItems(res.data);
    } catch (err) {
      console.error("Failed to fetch feed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("title", newItem.title);
    formData.append("content", newItem.content);
    formData.append("category", newItem.category);
    if (selectedFile) formData.append("image", selectedFile);

    try {
      await api.post("/admin/feed", formData, {
        headers: { 
          "Content-Type": "multipart/form-data"
        },
        onUploadProgress: (progressEvent) => {
          setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      });
      setShowAddModal(false);
      setNewItem({ title: "", content: "", category: "Health" });
      setSelectedFile(null);
      setUploadProgress(0);
      fetchFeed();
    } catch (err) {
      alert("Failed to create post");
    }
  };

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.delete(`/admin/feed/${itemToDelete._id}`);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
      fetchFeed();
    } catch (err) {
      alert("Delete failed");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-section-header">
        <div>
          <h1 className="admin-title">Feed Management</h1>
          <p className="admin-subtitle">Create and manage dashboard announcements</p>
        </div>
        <button className="admin-btn primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> New Feed Post
        </button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Post Content</th>
              <th>Category</th>
              <th>Created On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="text-center">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="4" className="text-center">No feed posts yet</td></tr>
            ) : (
              items.map(item => (
                <tr key={item._id}>
                  <td>
                    <div className="book-cell">
                      <div className="book-icon-sm"><Layout size={14} /></div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{item.title}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.content}</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="admin-badge blue">{item.category}</span></td>
                  <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions">
                      <button className="action-btn delete" onClick={() => handleDeleteClick(item)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <h3><Send size={20} /> Create New Announcement</h3>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Title</label>
                <input required type="text" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <input type="text" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Content</label>
                <textarea required rows="4" value={newItem.content} onChange={e => setNewItem({...newItem, content: e.target.value})} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--admin-border)', padding: 12 }} />
              </div>
              <div className="form-group">
                <label>Image (Optional)</label>
                <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files[0])} />
              </div>
              {uploadProgress > 0 && <div className="upload-progress-bar"><div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div></div>}
              <div className="modal-actions">
                <button type="button" className="admin-btn secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="admin-btn primary">Post Announcement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
            <div style={{ 
              width: 56, height: 56, borderRadius: '50%', background: '#fff1f2', color: '#e11d48',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
            }}>
              <AlertTriangle size={28} />
            </div>
            <h3 style={{ marginBottom: 8 }}>Move to Recycle Bin?</h3>
            <p style={{ color: 'var(--admin-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
              The announcement "<strong>{itemToDelete?.title}</strong>" will be moved to the recycle bin.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="admin-btn secondary" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="admin-btn danger" style={{ flex: 1 }} onClick={confirmDelete}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
