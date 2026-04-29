import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import { ArrowLeft, Download, Maximize2, Minimize2, BookOpen } from "lucide-react";
import { getFileUrl } from "../utils/config";
import "../styles/BookViewer.css";

export default function BookViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        const res = await api.get("/library/books");
        const found = res.data.find(b => b._id === id);
        setBook(found);
      } catch (err) {
        console.error("Failed to load book", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBook();
  }, [id]);

  const toggleFullscreen = () => {
    const elem = document.getElementById("pdf-viewer-frame");
    if (!elem) return; // Fix: avoid null error if iframe is not rendered

    if (!isFullscreen) {
      if (elem.requestFullscreen) elem.requestFullscreen();
      else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
      else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  if (loading) return <div className="viewer-loading">Opening your book...</div>;
  if (!book) return <div className="viewer-error">Book not found. <button onClick={() => navigate("/library")}>Back to Library</button></div>;

  return (
    <div className="book-viewer-page">
      <div className="viewer-header">
        <div className="viewer-header-left">
          <button className="viewer-back-btn" onClick={() => navigate("/library")}>
            <ArrowLeft size={20} />
          </button>
          <div className="viewer-title-info">
            <h1>{book.title}</h1>
            <span>{book.course} • By {book.author || "Unknown Author"}</span>
          </div>
        </div>
        <div className="viewer-header-right">
          {book.isDownloadable && (
            <button className="viewer-action-btn" onClick={() => window.open(getFileUrl(book.fileUrl), "_blank")}>
              <Download size={18} /> Download
            </button>
          )}
          {book.fileUrl.toLowerCase().split('?')[0].endsWith(".pdf") && (
            <button className="viewer-action-btn" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
        </div>
      </div>

      <div className="viewer-container">
        {book.fileUrl.toLowerCase().split('?')[0].endsWith(".pdf") ? (
            <iframe 
              id="pdf-viewer-frame"
              src={`${getFileUrl(book.fileUrl)}#toolbar=0`} 
              title={book.title}
              className="pdf-iframe"
            />
          ) : (
            <div className="unsupported-viewer">
              <BookOpen size={64} />
              <h2>Digital Reader</h2>
              <p>This document is in a format that requires a specialized viewer. You can download it to read it on your device.</p>
              {book.isDownloadable ? (
                <button className="viewer-action-btn primary" onClick={() => window.open(getFileUrl(book.fileUrl), "_blank")}>
                  Download & Read ↗
                </button>
              ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Contact admin for access to this non-downloadable resource.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
