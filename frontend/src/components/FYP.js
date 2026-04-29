import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import { getFileUrl } from "../utils/config";
import axios from "axios";
import "../styles/dashboard.css";

import fbLogo from "../assets/fb.webp";
import igLogo from "../assets/ig.webp";
import snapLogo from "../assets/snapchat.webp";
import tikLogo from "../assets/tik.webp";
import gmailLogo from "../assets/gmail.webp";

const healthEmojis = ["🫀","🧠","🩺","💊","🩻","🩹","🏥","🔬","🧬","💉"];
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const STATS = [
  { icon: "📝", label: "Practice Questions", value: "10,000+", colorClass: "blue" },
  { icon: "🩺", label: "Nursing Topics",     value: "50+",     colorClass: "green" },
  { icon: "🎓", label: "Students Enrolled",  value: "5,000+",  colorClass: "orange" },
];

export default function FYP({ refresh }) {
  const { user, setUser } = useContext(UserContext);
  const { searchQuery } = useOutletContext();
  const navigate = useNavigate();
  const logoDropdownRef = useRef();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [selectedArticle, setSelectedArticle] = useState(null);

  const awardPoints = async (amount, reason) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post("/api/points/add", { amount, reason }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Update local user context so profile shows new points
      if (user) setUser({ ...user, points: res.data.totalPoints });
    } catch (err) {
      console.error("Failed to award points", err);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [refresh]);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      // 1. Try fetching from Admin Feed first
      const adminRes = await axios.get("/api/admin/feed");
      let allPosts = adminRes.data;

      // 2. If admin feed is empty or short, fetch from a public health news source as fallback
      if (allPosts.length < 3) {
        try {
          const newsRes = await axios.get("https://newsapi.org/v2/top-headlines?category=health&language=en&apiKey=c66289b4f74d47728f3f886f3f06484e");
          const newsItems = newsRes.data.articles.map((art, idx) => ({
            _id: `news-${idx}`,
            title: art.title,
            content: art.description || art.content || "No description available.",
            author: art.author || "Global Health News",
            category: "Global",
            image: art.urlToImage,
            likes: Math.floor(Math.random() * 100),
            createdAt: art.publishedAt,
            isExternal: true
          }));
          allPosts = [...allPosts, ...newsItems];
        } catch (newsErr) {
          console.warn("External news fetch failed", newsErr);
        }
      }
      setPosts(allPosts);
    } catch (err) {
      console.error("Failed to fetch feed", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = (id) => {
    const isLiking = !likedPosts[id];
    setLikedPosts(prev => ({ ...prev, [id]: isLiking }));
    if (isLiking) awardPoints(1, "Reaction");
  };

  const handleComment = (id) => {
    const text = (commentInputs[id] || "").trim();
    if (!text) return;
    
    // In a real app, we'd send this to the server
    // For now, we award points and clear input
    awardPoints(1, "Comment");
    setCommentInputs(prev => ({ ...prev, [id]: "" }));
    alert("Comment posted! +1 point");
  };

  const toggleLogoMenu = () => logoDropdownRef.current?.classList.toggle("active");

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* ── Welcome banner ── */}
      <div className="dash-welcome-banner">
        <div className="dash-welcome-text">
          <h2>Welcome back, {firstName} 👋</h2>
          <p>Continue your nursing education journey. You're making great progress!</p>
        </div>
        <div className="dash-welcome-actions">
          <button className="dash-action-btn secondary" onClick={() => navigate("/library")}>
            📚 Study Library
          </button>
          <button className="dash-action-btn primary" onClick={() => navigate("/quiz")}>
            🎯 Take a Quiz
          </button>
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="dash-stats-row">
        {STATS.map((s, i) => (
          <div className="dash-stat-card" key={i}>
            <div className={`dash-stat-icon ${s.colorClass}`}>{s.icon}</div>
            <div className="dash-stat-value">{s.value}</div>
            <div className="dash-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Feed header ── */}
      <div className="dash-section-header">
        <span className="dash-section-title">📰 Health Feed</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button
              className="dash-action-btn secondary community-btn"
              style={{ padding: "6px 14px", fontSize: ".8rem" }}
              onClick={toggleLogoMenu}
            >
              🌐 Community
            </button>
            <div className="logo-dropdown" ref={logoDropdownRef}>
              {[
                { href: "https://www.facebook.com/share/17jdo77dP8/",    src: fbLogo,   label: "Facebook"  },
                { href: "https://www.instagram.com",                      src: igLogo,   label: "Instagram" },
                { href: "https://snapchat.com/t/xDlg1SmQ",               src: snapLogo, label: "Snapchat"  },
                { href: "https://www.tiktok.com/@psychedout____",         src: tikLogo,  label: "TikTok"    },
                { href: "mailto:unihealthplatform@gmail.com",             src: gmailLogo,label: "Email Us"  },
              ].map(({ href, src, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer">
                  <img src={src} alt={label} className="dropdown-icon" />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </div>
          {/* Create Post button removed from here as per user request */}
        </div>
      </div>

      {/* ── Post cards ── */}
      <div className="dash-card-grid">
        {posts.filter(p => 
          p.title?.toLowerCase().includes(searchQuery?.toLowerCase() || "") ||
          p.content?.toLowerCase().includes(searchQuery?.toLowerCase() || "")
        ).map(post => (
          <div key={post._id} className="dash-post-card">
            {post.image
              ? <img 
                  src={post.isExternal ? post.image : getFileUrl(post.image)} 
                  alt={post.title} 
                  className="dash-post-img"
                  onError={e => { e.target.style.display = "none"; }} 
                />
              : <div className="dash-post-img-placeholder">{rnd(healthEmojis)}</div>
            }
            <div className="dash-post-body">
              <span className="dash-post-badge">🏥 {post.category || "Health"}</span>
              <div className="dash-post-title">{post.title}</div>
              <div className="dash-post-desc">
                {post.content?.length > 120 ? post.content.slice(0, 120) + "..." : post.content}
              </div>
              
              <div className="dash-post-footer" style={{ marginTop: 12 }}>
                <div className="dash-post-author">
                  <div className="dash-post-avatar" style={{ background: "var(--accent-pale)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".75rem", fontWeight: 700 }}>
                    {post.author?.[0] || "A"}
                  </div>
                  <span className="dash-post-author-name">{post.author}</span>
                </div>
                <div className="dash-post-actions">
                  <button
                    className={`dash-post-action-btn${likedPosts[post._id] ? " liked" : ""}`}
                    onClick={() => toggleLike(post._id)}
                  >
                    {likedPosts[post._id] ? "❤️" : "🤍"} {post.likes + (likedPosts[post._id] ? 1 : 0)}
                  </button>
                  <button className="dash-post-action-btn" onClick={() => setSelectedArticle(post)}>
                    📖 Read More
                  </button>
                </div>
              </div>
              <div className="dash-post-comments-section" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    type="text" 
                    className="comment-input" 
                    placeholder="Add a comment..." 
                    value={commentInputs[post._id] || ""}
                    onChange={e => setCommentInputs(prev => ({ ...prev, [post._id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleComment(post._id)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.85rem' }}
                  />
                  <button 
                    onClick={() => handleComment(post._id)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="dash-loading">Loading fresh updates...</div>}
      {!loading && posts.length === 0 && (
        <div className="dash-loading" style={{ opacity: 0.5 }}>No updates yet. Check back soon!</div>
      )}

      {/* ── Article Viewer Modal ── */}
      {selectedArticle && (
        <div className="modal-overlay" onClick={e => { if (e.target.classList.contains("modal-overlay")) setSelectedArticle(null); }}>
          <div className="article-modal-content" style={{ animation: 'slideUp 0.4s ease' }}>
            <button className="modal-close-x" onClick={() => setSelectedArticle(null)}>×</button>
            {selectedArticle.image && (
              <img 
                src={selectedArticle.isExternal ? selectedArticle.image : getFileUrl(selectedArticle.image)} 
                alt={selectedArticle.title} 
                className="article-modal-img" 
              />
            )}
            <div className="article-modal-body">
              <span className="dash-post-badge">🏥 Health Update</span>
              <h2 className="article-modal-title">{selectedArticle.title}</h2>
              <div className="article-modal-meta">
                <span>Published by {selectedArticle.author} • {new Date(selectedArticle.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="article-modal-text">
                <p style={{ whiteSpace: 'pre-wrap' }}>{selectedArticle.content}</p>
              </div>
              <div className="article-modal-footer">
                <button className="dash-action-btn secondary" onClick={() => setSelectedArticle(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
