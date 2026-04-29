import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import axios from "axios";
import { BookMarked, BookOpen, ChevronRight, ArrowLeft, GraduationCap } from "lucide-react";
import "../styles/library.css";

function Library() {
  const navigate = useNavigate();
  const { searchQuery } = useOutletContext();
  const [books, setBooks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("courses"); // 'courses' or 'books'
  const [activeCourse, setActiveCourse] = useState(null);

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    try {
      const [booksRes, coursesRes] = await Promise.all([
        axios.get("/api/library/books"),
        axios.get("/api/library/courses")
      ]);
      setBooks(booksRes.data);
      setCourses(coursesRes.data);
    } catch (err) {
      console.error("Library fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  const getBookCount = (courseName) => {
    return books.filter(b => b.course === courseName).length;
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          book.author?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = activeCourse ? book.course === activeCourse : true;
    return matchesSearch && matchesCourse;
  });

  const selectCourse = (course) => {
    setActiveCourse(course);
    setView("books");
  };

  const goBack = () => {
    setView("courses");
    setActiveCourse(null);
  };

  if (loading) return <div className="viewer-loading">Loading Study Library...</div>;

  return (
    <div className="library-wrapper">
      <div className="library-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {view === "books" && (
            <button className="viewer-back-btn" onClick={goBack} style={{ width: 36, height: 36 }}>
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="library-title">
            {view === "courses" ? "Explore Courses" : activeCourse}
          </h1>
        </div>
        
        <div className="library-controls" style={{ visibility: 'hidden' }}>
          {/* Global search in topbar handles this now */}
        </div>
      </div>

      {view === "courses" ? (
        <div className="library-topics-grid">
          {courses
            .filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(course => (
            <div key={course} className="course-card-classic" onClick={() => selectCourse(course)}>
              <div className="course-card-icon">
                <GraduationCap size={32} />
              </div>
              <div className="course-card-info">
                <h3>{course}</h3>
                <span className="book-count-badge">{getBookCount(course)} Resources</span>
              </div>
              <ChevronRight className="course-arrow" size={20} />
            </div>
          ))}
          {courses.length === 0 && (
            <div className="empty-library">
              <BookOpen size={48} />
              <p>No courses available yet. Contact admin to add resources.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="library-books-grid">
          {filteredBooks.length === 0 ? (
            <div className="text-center py-20" style={{ gridColumn: '1/-1' }}>
              <BookOpen size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <p style={{ color: 'var(--text-muted)' }}>No books found in this section.</p>
            </div>
          ) : (
            filteredBooks.map(book => (
              <div key={book._id} className="book-card">
                <div className="book-cover">
                  {book.coverImage ? (
                    <img src={book.coverImage} alt={book.title} />
                  ) : (
                    <div className="book-cover-placeholder">
                      <BookMarked size={50} strokeWidth={1.5} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, marginTop: 4 }}>UHC CLASSIC</span>
                    </div>
                  )}
                </div>
                <div className="book-info">
                  <h3 className="book-title">{book.title}</h3>
                  <p className="book-author">{book.author || "Unknown Author"}</p>
                  <div className="book-actions">
                    <button className="book-btn" onClick={() => navigate(`/library/view/${book._id}`)}>
                      <BookOpen size={16} /> Open Reader
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Library;