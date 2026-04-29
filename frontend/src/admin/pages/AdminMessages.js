import React, { useState, useEffect } from "react";
import api from "../../api/api";
import { Mail, Trash2, Clock, Search } from "lucide-react";
import "../../admin_styles/AdminMessages.css";

export default function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await api.get("/contact/messages");
      setMessages(res.data);
    } catch (err) {
      console.error("Fetch messages failed", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/contact/messages/${id}`, { status: "read" });
      setMessages(messages.map(m => m._id === id ? { ...m, status: "read" } : m));
      if (selectedMessage?._id === id) setSelectedMessage({ ...selectedMessage, status: "read" });
    } catch (err) {
      console.error("Update status failed", err);
    }
  };

  const filtered = messages.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-page">
      <div className="admin-section-header">
        <div>
          <h1 className="admin-title">Messages & Mail</h1>
          <p className="admin-subtitle">Manage inquiries from the contact form</p>
        </div>
      </div>

      <div className="messages-layout">
        {/* Sidebar: Message List */}
        <div className="messages-list-card">
          <div className="search-box">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search messages..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="messages-scroll">
            {loading ? (
              <div className="loading-state">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">No messages found</div>
            ) : (
              filtered.map(m => (
                <div 
                  key={m._id} 
                  className={`message-item ${m.status === 'unread' ? 'unread' : ''} ${selectedMessage?._id === m._id ? 'selected' : ''}`}
                  onClick={() => { setSelectedMessage(m); if(m.status === 'unread') markAsRead(m._id); }}
                >
                  <div className="message-item-header">
                    <span className="sender-name">{m.name}</span>
                    <span className="msg-time">{new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="msg-preview">{m.message}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Content: Message Detail */}
        <div className="message-detail-card">
          {selectedMessage ? (
            <div className="message-detail-view">
              <div className="detail-header">
                <div className="sender-info">
                  <div className="sender-avatar">
                    {selectedMessage.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h2>{selectedMessage.name}</h2>
                    <p>{selectedMessage.email}</p>
                  </div>
                </div>
                <div className="detail-meta">
                  <div className="meta-item"><Clock size={14} /> {new Date(selectedMessage.createdAt).toLocaleString()}</div>
                  {selectedMessage.status === 'unread' && <span className="status-badge unread">New</span>}
                </div>
              </div>

              <div className="message-body">
                <p>{selectedMessage.message}</p>
              </div>

              <div className="detail-actions">
                <a href={`mailto:${selectedMessage.email}`} className="admin-btn primary">Reply via Email</a>
                <button className="admin-btn secondary text-red" onClick={() => {/* Delete logic */}}>
                   <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <Mail size={48} className="muted-icon" />
              <p>Select a message to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
