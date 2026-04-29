import React, { useEffect, useState } from "react";
import { Plus, Search, Edit2, Trash2, BookOpen, ChevronDown, ChevronUp, Copy } from "lucide-react";
import axios from "axios";

const logAction = (action) => {
  const logs = JSON.parse(localStorage.getItem("adminLogs") || "[]");
  logs.unshift({ ts: new Date().toISOString(), action, by: "Admin" });
  localStorage.setItem("adminLogs", JSON.stringify(logs.slice(0, 500)));
};

export default function AdminQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("All");
  const [expanded, setExpanded] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [coursesFromDB, setCoursesFromDB] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [toast, setToast] = useState(null);

  const [newQ, setNewQ] = useState({ question: "", options: ["","","",""], answer: null, course: "", difficulty: "Medium", explanation: "" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { fetchQuestions(); fetchCourses(); }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/questions/all");
      setQuestions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Questions load error:", err);
      setQuestions([]);
    } finally { setLoading(false); }
  };

  const fetchCourses = async () => {
    try {
      const res = await axios.get("/api/courses");
      setCoursesFromDB(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error("Courses load error:", err); }
  };

  const courses = ["All", ...new Set([
    ...questions.map(q => q.course).filter(Boolean),
    ...coursesFromDB.map(c => c.name).filter(Boolean),
  ])];

  const filtered = questions.filter(q => {
    const txt = search.toLowerCase();
    const matchSearch = q.question?.toLowerCase().includes(txt) ||
      q.options?.some(o => o?.toLowerCase().includes(txt));
    const matchCourse = selectedCourse === "All" || q.course === selectedCourse;
    return matchSearch && matchCourse;
  });

  /* ── Delete ── */
  const handleDelete = async () => {
    try {
      await axios.delete(`/api/admin/questions/${deleteId}`);
      setQuestions(prev => prev.filter(q => q._id !== deleteId));
      logAction(`Deleted question ID: ${deleteId}`);
      showToast("Question deleted");
      setDeleteId(null);
    } catch (err) { showToast("Delete failed", "error"); }
  };

  /* ── Edit ── */
  const handleSave = async () => {
    try {
      const res = await axios.put(`/api/admin/questions/${editData._id}`, editData);
      setQuestions(prev => prev.map(q => q._id === res.data._id ? res.data : q));
      logAction(`Edited question: "${editData.question?.slice(0, 40)}"`);
      showToast("Question updated");
      setEditModal(false);
    } catch (err) { showToast("Update failed", "error"); }
  };

  /* ── Add question ── */
  const handleAddQuestion = async () => {
    if (!newQ.question || newQ.answer === null || !newQ.course) {
      showToast("Fill all fields and select the correct answer", "error"); return;
    }
    try {
      const res = await axios.post("/api/admin/questions", newQ);
      setQuestions(prev => [res.data, ...prev]);
      logAction(`Added question: "${newQ.question?.slice(0, 40)}"`);
      showToast("Question added!");
      setShowAddModal(false);
      setNewQ({ question: "", options: ["","","",""], answer: null, course: "", difficulty: "Medium", explanation: "" });
    } catch (err) { showToast("Add failed", "error"); }
  };

  /* ── Add course ── */
  const handleAddCourse = async () => {
    if (!newCourseName.trim()) return;
    try {
      const res = await axios.post("/api/courses", { name: newCourseName });
      setCoursesFromDB(prev => [...prev, res.data]);
      logAction(`Added course: "${newCourseName}"`);
      showToast("Course added");
      setNewCourseName(""); setAddingCourse(false);
    } catch (err) { showToast("Course add failed", "error"); }
  };

  /* ── Book loader ── */
  const BookLoader = () => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"60px 20px", gap:16 }}>
      <div style={{ width:50, height:60, position:"relative" }}>
        <div style={{ position:"absolute", left:0, top:0, width:10, height:60, background:"linear-gradient(180deg,#4255ff,#8b5cf6)", borderRadius:"3px 0 0 3px" }} />
        {[0,1,2].map(i => (
          <div key={i} style={{
            position:"absolute", left:10, top:3, width:36, height:54,
            background:["#c7d2fe","#a5b4fc","#818cf8"][i],
            borderRadius:"0 8px 8px 0", transformOrigin:"left center",
            animation:`flipPage 1.4s ease-in-out ${i*0.35}s infinite`,
          }}/>
        ))}
      </div>
      <p style={{ color:"var(--admin-muted)", fontSize:".85rem", fontWeight:500 }}>Loading questions…</p>
      <style>{`@keyframes flipPage{0%{transform:rotateY(0);}40%{transform:rotateY(-140deg);}60%{transform:rotateY(-140deg);}100%{transform:rotateY(0);}}`}</style>
    </div>
  );

  return (
    <div className="admin-page">

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 70, right: 24, zIndex: 9999,
          padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: ".875rem",
          background: toast.type === "error" ? "#ef4444" : "#22c55e", color: "white",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)", animation: "slideIn .2s ease"
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="admin-section-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>
            📝 Question Manager
          </h1>
          <p style={{ fontSize: ".82rem", color: "var(--admin-muted)", margin: "4px 0 0" }}>
            {questions.length} questions · {courses.length - 1} courses
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="admin-btn secondary sm" onClick={() => window.location.href = "/admin/duplicates"}>
            <Copy size={14} /> Find Duplicates
          </button>
          <button className="admin-btn secondary sm" onClick={() => setShowCourseModal(true)}>
            <BookOpen size={14} /> Courses
          </button>
          <button className="admin-btn primary" onClick={() => setShowAddModal(true)}>
            <Plus size={15} /> Add Question
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--admin-muted)" }} />
          <input
            className="admin-input"
            style={{ width: "100%", paddingLeft: 36, boxSizing: "border-box" }}
            placeholder="Search questions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="admin-select"
          value={selectedCourse}
          onChange={e => setSelectedCourse(e.target.value)}
        >
          {courses.map((c, i) => <option key={i} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Questions list */}
      {loading ? (
        <BookLoader />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--admin-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📭</div>
          No questions found
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Question</th>
                <th>Course</th>
                <th>Options</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q, idx) => (
                <>
                  <tr key={q._id} style={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === q._id ? null : q._id)}>
                    <td style={{ color: "var(--admin-muted)", fontWeight: 600 }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {expanded === q._id ? <ChevronUp size={13} style={{ color: "var(--admin-muted)", flexShrink: 0 }} /> : <ChevronDown size={13} style={{ color: "var(--admin-muted)", flexShrink: 0 }} />}
                        <span style={{ fontSize: ".87rem", lineHeight: 1.4 }}>{q.question}</span>
                      </div>
                    </td>
                    <td><span className="admin-badge blue">{q.course || "—"}</span></td>
                    <td style={{ color: "var(--admin-muted)", fontSize: ".8rem" }}>{q.options?.length || 0} opts</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="admin-btn secondary sm" title="Edit"
                          onClick={() => { setEditData({ ...q }); setEditModal(true); }}>
                          <Edit2 size={13} />
                        </button>
                        <button className="admin-btn danger sm" title="Delete"
                          onClick={() => setDeleteId(q._id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === q._id && (
                    <tr key={`${q._id}-expanded`} style={{ background: "rgba(66,85,255,0.03)" }}>
                      <td colSpan={5} style={{ padding: "12px 16px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                          {q.options?.map((opt, i) => (
                            <div key={i} style={{
                              padding: "8px 12px", borderRadius: 8,
                              background: q.answer === i ? "rgba(22,163,74,0.08)" : "#f8fafc",
                              border: `1px solid ${q.answer === i ? "rgba(22,163,74,0.35)" : "var(--admin-border)"}`,
                              color: q.answer === i ? "#16a34a" : "var(--admin-muted)",
                              fontSize: ".83rem", fontWeight: q.answer === i ? 600 : 400,
                            }}>
                              {String.fromCharCode(65 + i)}. {opt}
                              {q.answer === i && " ✓"}
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(66,85,255,0.05)", borderRadius:8, fontSize:".8rem", color:"#4255ff" }}>
                            💡 {q.explanation}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ADD QUESTION — slide-in panel ── */}
      {showAddModal && (
        <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex" }}>
          {/* Backdrop */}
          <div style={{ flex:1, background:"rgba(0,0,0,0.35)", backdropFilter:"blur(4px)" }} onClick={() => setShowAddModal(false)} />
          {/* Panel */}
          <div style={{
            width:"min(540px, 100vw)", background:"white", height:"100%", overflowY:"auto",
            boxShadow:"-8px 0 40px rgba(0,0,0,0.12)", display:"flex", flexDirection:"column",
            animation:"slideInR .25s ease",
          }}>
            {/* Panel header */}
            <div style={{ padding:"20px 24px", borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, background:"#f8fafc" }}>
              <div>
                <h2 style={{ margin:0, fontSize:"1.1rem", fontWeight:800, color:"#0f172a" }}>➕ Add New Question</h2>
                <p style={{ margin:"2px 0 0", fontSize:".78rem", color:"#64748b" }}>Fill all fields and pick the correct option</p>
              </div>
              <button className="admin-btn secondary sm" onClick={() => setShowAddModal(false)}>✕ Close</button>
            </div>

            {/* Panel body */}
            <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:18, flex:1 }}>

              {/* Course */}
              <div>
                <label style={{ fontSize:".78rem", fontWeight:700, color:"#64748b", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:".06em" }}>Course *</label>
                <select className="admin-select" style={{ width:"100%" }}
                  value={newQ.course} onChange={e => setNewQ(p => ({ ...p, course: e.target.value }))}>
                  <option value="">— Select a course —</option>
                  {coursesFromDB.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {/* Difficulty */}
              <div>
                <label style={{ fontSize:".78rem", fontWeight:700, color:"#64748b", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:".06em" }}>Difficulty</label>
                <div style={{ display:"flex", gap:8 }}>
                  {["Easy","Medium","Hard"].map(d => (
                    <button key={d} onClick={() => setNewQ(p => ({ ...p, difficulty: d }))}
                      style={{
                        flex:1, padding:"8px", borderRadius:10, border:"2px solid",
                        borderColor: newQ.difficulty===d ? "#4255ff" : "#e2e8f0",
                        background: newQ.difficulty===d ? "rgba(66,85,255,0.08)" : "#f8fafc",
                        color: newQ.difficulty===d ? "#4255ff" : "#64748b",
                        fontWeight:700, fontSize:".82rem", cursor:"pointer",
                      }}>{d}</button>
                  ))}
                </div>
              </div>

              {/* Question text */}
              <div>
                <label style={{ fontSize:".78rem", fontWeight:700, color:"#64748b", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:".06em" }}>
                  Question Text * <span style={{ textTransform:"none", fontWeight:400, color:"#94a3b8" }}>({newQ.question.length} chars)</span>
                </label>
                <textarea
                  className="admin-input"
                  style={{ width:"100%", minHeight:100, resize:"vertical", boxSizing:"border-box", lineHeight:1.6 }}
                  placeholder="Type your question here…"
                  value={newQ.question}
                  onChange={e => setNewQ(p => ({ ...p, question: e.target.value }))}
                />
              </div>

              {/* Options */}
              <div>
                <label style={{ fontSize:".78rem", fontWeight:700, color:"#64748b", display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:".06em" }}>
                  Options * <span style={{ textTransform:"none", fontWeight:500, color:"#16a34a" }}>— click the letter to mark correct answer</span>
                </label>
                {newQ.options.map((opt, i) => (
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
                    <button
                      onClick={() => setNewQ(p => ({ ...p, answer: i }))}
                      style={{
                        width:32, height:32, borderRadius:10, border:"2px solid",
                        borderColor: newQ.answer===i ? "#16a34a" : "#e2e8f0",
                        background: newQ.answer===i ? "#16a34a" : "white",
                        color: newQ.answer===i ? "white" : "#64748b",
                        fontSize:".8rem", cursor:"pointer", flexShrink:0,
                        display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800,
                        boxShadow: newQ.answer===i ? "0 2px 8px rgba(22,163,74,.3)" : "none",
                        transition:"all .15s",
                      }}>
                      {String.fromCharCode(65+i)}
                    </button>
                    <input
                      className="admin-input"
                      style={{ flex:1, borderColor: newQ.answer===i ? "rgba(22,163,74,.4)" : undefined, background: newQ.answer===i ? "rgba(22,163,74,.04)" : undefined }}
                      placeholder={`Option ${String.fromCharCode(65+i)}…`}
                      value={opt}
                      onChange={e => {
                        const opts=[...newQ.options]; opts[i]=e.target.value;
                        setNewQ(p => ({ ...p, options:opts }));
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Explanation */}
              <div>
                <label style={{ fontSize:".78rem", fontWeight:700, color:"#64748b", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:".06em" }}>Explanation <span style={{ textTransform:"none", fontWeight:400, color:"#94a3b8" }}>(optional — shown after answering)</span></label>
                <textarea
                  className="admin-input"
                  style={{ width:"100%", minHeight:70, resize:"vertical", boxSizing:"border-box", lineHeight:1.6 }}
                  placeholder="Explain why the correct answer is correct…"
                  value={newQ.explanation || ""}
                  onChange={e => setNewQ(p => ({ ...p, explanation: e.target.value }))}
                />
              </div>

              {/* Preview */}
              {newQ.question && (
                <div style={{ background:"rgba(66,85,255,0.04)", border:"1px solid rgba(66,85,255,0.15)", borderRadius:14, padding:16 }}>
                  <div style={{ fontSize:".72rem", fontWeight:700, color:"#4255ff", marginBottom:8, textTransform:"uppercase", letterSpacing:".06em" }}>📋 Preview</div>
                  <div style={{ fontWeight:600, fontSize:".9rem", color:"#0f172a", marginBottom:10, lineHeight:1.5 }}>{newQ.question}</div>
                  {newQ.options.map((o,i) => o && (
                    <div key={i} style={{ padding:"6px 10px", marginBottom:5, borderRadius:8, fontSize:".82rem",
                      background: newQ.answer===i ? "rgba(22,163,74,.1)" : "#f8fafc",
                      border: `1px solid ${newQ.answer===i ? "rgba(22,163,74,.3)" : "#e2e8f0"}`,
                      color: newQ.answer===i ? "#16a34a" : "#475569", fontWeight: newQ.answer===i ? 600 : 400,
                    }}>
                      {String.fromCharCode(65+i)}. {o} {newQ.answer===i && "✓"}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div style={{ padding:"16px 24px", borderTop:"1px solid #e2e8f0", display:"flex", gap:10, flexShrink:0, background:"#f8fafc" }}>
              <button className="admin-btn secondary" style={{ flex:1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="admin-btn primary" style={{ flex:2 }} onClick={handleAddQuestion}>
                ✓ Save Question
              </button>
            </div>
          </div>
          <style>{`@keyframes slideInR{from{transform:translateX(60px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editModal && editData && (
        <div className="admin-modal-overlay" onClick={() => setEditModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>✏️ Edit Question</h3>
              <button className="admin-btn secondary sm" onClick={() => setEditModal(false)}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: ".8rem", color: "var(--admin-muted)", fontWeight: 600, display: "block", marginBottom: 6 }}>COURSE</label>
                <select className="admin-select" style={{ width:"100%", boxSizing:"border-box" }}
                  value={editData.course || ""}
                  onChange={e => setEditData(p => ({ ...p, course: e.target.value }))}>
                  <option value="">— Select a course —</option>
                  {coursesFromDB.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: ".8rem", color: "var(--admin-muted)", fontWeight: 600, display: "block", marginBottom: 6 }}>QUESTION</label>
                <textarea className="admin-input"
                  style={{ width: "100%", minHeight: 90, resize: "vertical", boxSizing: "border-box" }}
                  value={editData.question || ""}
                  onChange={e => setEditData(p => ({ ...p, question: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: ".8rem", color: "var(--admin-muted)", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  OPTIONS <span style={{ color: "var(--admin-green)", fontWeight: 400 }}>(click letter to set correct)</span>
                </label>
                {editData.options?.map((opt, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <button
                      onClick={() => setEditData(p => ({ ...p, answer: i }))}
                      style={{
                        width: 28, height: 28, borderRadius: "50%", border: "2px solid",
                        borderColor: editData.answer === i ? "#16a34a" : "var(--admin-border)",
                        background: editData.answer === i ? "#16a34a" : "transparent",
                        color: "white", fontSize: ".75rem", cursor: "pointer", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
                      }}>
                      {String.fromCharCode(65 + i)}
                    </button>
                    <input className="admin-input" style={{ flex: 1 }}
                      value={opt}
                      onChange={e => {
                        const opts = [...editData.options]; opts[i] = e.target.value;
                        setEditData(p => ({ ...p, options: opts }));
                      }} />
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize: ".8rem", color: "var(--admin-muted)", fontWeight: 600, display: "block", marginBottom: 6 }}>EXPLANATION (optional)</label>
                <textarea className="admin-input"
                  style={{ width: "100%", minHeight: 70, resize: "vertical", boxSizing: "border-box" }}
                  placeholder="Why is this answer correct?"
                  value={editData.explanation || ""}
                  onChange={e => setEditData(p => ({ ...p, explanation: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="admin-btn secondary" onClick={() => setEditModal(false)}>Cancel</button>
                <button className="admin-btn primary" onClick={handleSave}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── COURSE MANAGER MODAL ── */}
      {showCourseModal && (
        <div className="admin-modal-overlay" onClick={() => setShowCourseModal(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>📚 Course Manager</h3>
              <button className="admin-btn secondary sm" onClick={() => setShowCourseModal(false)}>✕</button>
            </div>
            <input className="admin-input" style={{ width: "100%", marginBottom: 12, boxSizing: "border-box" }}
              placeholder="Search courses..." value={courseSearch}
              onChange={e => setCourseSearch(e.target.value)} />
            <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {coursesFromDB.filter(c => c.name?.toLowerCase().includes(courseSearch.toLowerCase())).map(c => (
                <div key={c._id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 10,
                  background: "#f8fafc", border: "1px solid var(--admin-border)",
                }}>
                  <span style={{ fontSize: ".875rem", color: "var(--admin-text)" }}>{c.name}</span>
                  <span className="admin-badge blue" style={{ fontSize: ".72rem" }}>
                    {questions.filter(q => q.course === c.name).length} Qs
                  </span>
                </div>
              ))}
            </div>
            {addingCourse ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input className="admin-input" style={{ flex: 1 }} placeholder="New course name..."
                  value={newCourseName} onChange={e => setNewCourseName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddCourse()} />
                <button className="admin-btn primary sm" onClick={handleAddCourse}>Save</button>
                <button className="admin-btn secondary sm" onClick={() => setAddingCourse(false)}>✕</button>
              </div>
            ) : (
              <button className="admin-btn primary" style={{ width: "100%" }} onClick={() => setAddingCourse(true)}>
                <Plus size={14} /> Add Course
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteId && (
        <div className="admin-modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px" }}>Delete Question?</h3>
            <p style={{ color: "var(--admin-muted)", fontSize: ".875rem", marginBottom: 20 }}>
              This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="admin-btn secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="admin-btn danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </div>
  );
}
