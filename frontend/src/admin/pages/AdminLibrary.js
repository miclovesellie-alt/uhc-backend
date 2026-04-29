import React, { useState, useEffect } from "react";
import axios from "axios";
import { Book, Plus, Trash2, Search, BookOpen, FileUp, Download, EyeOff } from "lucide-react";
import "../../admin_styles/AdminLibrary.css";

export default function AdminLibrary() {
  const [books, setBooks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBook, setNewBook] = useState({
    title: "", author: "", course: "", description: "", isDownloadable: true
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [newCourse, setNewCourse] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [bookToDelete, setBookToDelete] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [booksRes, coursesRes] = await Promise.all([
        axios.get("/api/library/books"),
        axios.get("/api/library/courses")
      ]);
      setBooks(booksRes.data);
      setCourses(coursesRes.data);
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    if (!selectedFile) return alert("Please select a document file");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", newBook.title);
    formData.append("author", newBook.author);
    formData.append("course", newBook.course || newCourse);
    formData.append("description", newBook.description);
    formData.append("isDownloadable", newBook.isDownloadable);

    try {
      const token = localStorage.getItem("token");
      await axios.post("/api/library/books", formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      
      setShowAddModal(false);
      setNewBook({ title: "", author: "", course: "", description: "", isDownloadable: true });
      setSelectedFile(null);
      setNewCourse("");
      setUploadProgress(0);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add book");
      setUploadProgress(0);
    }
  };

  const handleDelete = (id) => {
    if (!id) return alert("Error: Missing book ID");
    setBookToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!bookToDelete) return;
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Session expired. Please log in again.");
        return;
      }

      await axios.delete(`/api/library/books/${bookToDelete}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setShowDeleteModal(false);
      setBookToDelete(null);
      fetchData();
    } catch (err) {
      console.error("Delete operation failed:", err.response || err);
      alert(err.response?.data?.message || "Delete failed.");
    }
  };

  const filteredBooks = books.filter(b => 
    (b.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.course || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-page">
      <div className="admin-section-header">
        <div>
          <h1 className="admin-title">Library Management</h1>
          <p className="admin-subtitle">Upload documents and manage study resources</p>
        </div>
        <button className="admin-btn primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Upload New Book
        </button>
      </div>

      <div className="library-admin-controls">
        <div className="search-bar">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search books by title or course..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title / Filename</th>
              <th>Course</th>
              <th>Permissions</th>
              <th>Added On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center">Loading...</td></tr>
            ) : filteredBooks.length === 0 ? (
              <tr><td colSpan="5" className="text-center">No books found</td></tr>
            ) : (
              filteredBooks.map(book => (
                <tr key={book._id}>
                  <td>
                    <div className="book-cell">
                      <div className="book-icon-sm"><Book size={14} /></div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{book.title}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-muted)' }}>{book.author}</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="admin-badge blue">{book.course}</span></td>
                  <td>
                    {book.isDownloadable ? (
                      <span className="admin-badge green" title="Users can download this file">
                        <Download size={12} /> Downloadable
                      </span>
                    ) : (
                      <span className="admin-badge red" title="View only - Download disabled">
                        <EyeOff size={12} /> View Only
                      </span>
                    )}
                  </td>
                  <td>{new Date(book.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="table-actions">
                      <button className="action-btn delete" onClick={() => handleDelete(book._id)}>
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
          <div className="modal-content">
            <h3><BookOpen size={20} /> Upload Study Resource</h3>
            <form onSubmit={handleAddBook}>
              
              <div className="form-group">
                <label>Select Document (PDF, Word, or PowerPoint)</label>
                <div className="file-input-wrapper">
                  <input 
                    type="file" 
                    id="file-upload" 
                    accept=".pdf,.doc,.docx,.ppt,.pptx"
                    onChange={e => setSelectedFile(e.target.files[0])} 
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="file-upload" className="file-drop-area">
                    <FileUp size={24} />
                    <span>{selectedFile ? selectedFile.name : "Click to select a file"}</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Rename Document / Title</label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g. Advanced Anatomy Guide"
                  value={newBook.title} 
                  onChange={e => setNewBook({...newBook, title: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label>Author / Publisher</label>
                <input 
                  type="text" 
                  value={newBook.author} 
                  onChange={e => setNewBook({...newBook, author: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label>Course</label>
                <select value={newBook.course} onChange={e => setNewBook({...newBook, course: e.target.value})}>
                  <option value="">Select Existing Course</option>
                  {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--admin-muted)' }}>Or Create New Course</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Pediatrics" 
                    value={newCourse} 
                    onChange={e => {setNewCourse(e.target.value); if(e.target.value) setNewBook({...newBook, course: ""})}} 
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="toggle-wrapper" onClick={() => setNewBook({...newBook, isDownloadable: !newBook.isDownloadable})}>
                  <div className={`toggle-switch ${newBook.isDownloadable ? 'on' : 'off'}`}>
                    <div className="toggle-handle"></div>
                  </div>
                  <span className="toggle-label">Allow students to download this file</span>
                </div>
              </div>

              {uploadProgress > 0 && (
                <div className="upload-progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                  <span>{uploadProgress}% Uploading...</span>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="admin-btn secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="admin-btn primary" disabled={uploadProgress > 0}>
                  {uploadProgress > 0 ? "Uploading..." : "Upload & Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ 
                width: 56, 
                height: 56, 
                borderRadius: '50%', 
                background: '#fee2e2', 
                color: '#ef4444', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                marginBottom: 20
              }}>
                <Trash2 size={28} />
              </div>
              
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--admin-text)', marginBottom: 8 }}>
                Delete this document?
              </h3>
              
              <p style={{ color: 'var(--admin-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 28 }}>
                This item will be moved to the Recycle Bin. You can restore it anytime within the next 7 days.
              </p>
              
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button 
                  className="admin-btn secondary" 
                  style={{ flex: 1, padding: '12px', fontSize: '0.9rem' }}
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="admin-btn primary" 
                  style={{ flex: 1, padding: '12px', fontSize: '0.9rem', background: '#ef4444', border: 'none' }}
                  onClick={confirmDelete}
                >
                  Delete Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
