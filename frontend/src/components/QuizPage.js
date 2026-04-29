import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Flag, BookOpen, CheckCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import "../styles/quiz.css";
import api from "../api/api";
import coursesTopics from "../data/courses_topics.json";

/* ── Book Loader ── */
const BookLoader = ({ text = "Loading…" }) => (
  <div className="book-loader-wrap">
    <div className="book-anim">
      <div className="book-spine" />
      <div className="book-page bp1" />
      <div className="book-page bp2" />
      <div className="book-page bp3" />
    </div>
    <p className="book-loader-text">{text}</p>
  </div>
);

/* ── Circular Timer ── */
const CircleTimer = ({ timeLeft, total = 45 }) => {
  const r = 22, c = 2 * Math.PI * r;
  const pct = Math.max(0, timeLeft / total);
  const col = timeLeft < 10 ? "#ef4444" : timeLeft < 20 ? "#f59e0b" : "#4255ff";
  return (
    <div className="circle-timer">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} stroke="#e2e8f0" strokeWidth="4" fill="none" />
        <circle cx="28" cy="28" r={r} stroke={col} strokeWidth="4" fill="none"
          strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round"
          transform="rotate(-90 28 28)"
          style={{ transition: "stroke-dasharray 1s linear, stroke .3s" }} />
      </svg>
      <span style={{ color: col, fontWeight: 700, fontSize: ".78rem" }}>{timeLeft}s</span>
    </div>
  );
};

/* ── Avatar color ── */
const avatarColor = (name = "") => {
  const cols = ["#4255ff","#8b5cf6","#ec4899","#f59e0b","#10b981","#06b6d4"];
  return cols[(name.charCodeAt(0) || 0) % cols.length];
};

/* ── Load questions ── */
const loadQ = async (course, limit) => {
  try {
    const res = await api.get(`/questions?course=${encodeURIComponent(course)}&limit=${limit}`);
    return res.data;
  } catch { return []; }
};

/* ══════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════ */
export default function QuizPage() {
  const navigate = useNavigate();
  const userId   = localStorage.getItem("userId");
  const storeKey = `activeQuiz_${userId}`;
  const userName = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}").name || "Student"; } catch { return "Student"; } })();

  const [stage, setStage]               = useState("selectCourse");
  const [courses, setCourses]           = useState([]);
  const [selCourse, setSelCourse]       = useState(null);
  const [questions, setQuestions]       = useState([]);
  const [loadingQ, setLoadingQ]         = useState(false);
  const [idx, setIdx]                   = useState(0);
  const [answers, setAnswers]           = useState([]);
  const [flagged, setFlagged]           = useState([]);
  const [selAns, setSelAns]             = useState(null);
  const [locked, setLocked]             = useState(false);
  const [score, setScore]               = useState(0);
  const [streak, setStreak]             = useState(0);
  const [bestStreak, setBestStreak]     = useState(0);
  const [done, setDone]                 = useState(false);
  const [showNav, setShowNav]           = useState(false);
  const [timeLeft, setTimeLeft]         = useState(45);
  const [blurred, setBlurred]           = useState(false);
  const { user, setUser } = React.useContext(UserContext);
  const timerRef = useRef(null);

  const awardPoints = async (amount, reason) => {
    try {
      const res = await api.post("/points/add", { amount, reason });
      if (user) setUser({ ...user, points: res.data.totalPoints });
    } catch (err) {
      console.error("Failed to award points", err);
    }
  };

  const [noSS, setNoSS] = useState(false);

  /* ── Fetch Global Settings ── */
  useEffect(() => {
    api.get("/settings/noScreenshot").then(res => {
      if (res.data.value !== null) setNoSS(res.data.value);
    }).catch(() => {});
  }, []);

  /* ── Fetch courses ── */
  useEffect(() => { api.get("/courses").then(r => setCourses(r.data)).catch(() => {}); }, []);

  /* ── No-screenshot ── */
  useEffect(() => {
    if (!noSS || stage !== "quiz") return;
    const blockKey = (e) => { if (e.key === "PrintScreen" || e.key === "F12") e.preventDefault(); };
    const blockCtx = (e) => e.preventDefault();
    const onBlur = () => setBlurred(true);
    const onFocus = () => setBlurred(false);
    document.addEventListener("keydown", blockKey);
    document.addEventListener("contextmenu", blockCtx);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("keydown", blockKey);
      document.removeEventListener("contextmenu", blockCtx);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [noSS, stage]);

  /* ── Restore from storage ── */
  useEffect(() => {
    const s = localStorage.getItem(storeKey);
    if (!s) return;
    try {
      const d = JSON.parse(s);
      setStage(d.stage); setSelCourse(d.selCourse); setQuestions(d.questions);
      setIdx(d.idx); setAnswers(d.answers); setFlagged(d.flagged || []);
      setSelAns(d.selAns); setLocked(d.locked || false);
      setScore(d.score); setStreak(d.streak || 0); setBestStreak(d.bestStreak || 0);
      setDone(d.done); setTimeLeft(d.timeLeft || 45);
    } catch {}
  }, [storeKey]);

  /* ── Persist state ── */
  useEffect(() => {
    if (stage !== "quiz") return;
    localStorage.setItem(storeKey, JSON.stringify({
      stage, selCourse, questions, idx, answers, flagged,
      selAns, locked, score, streak, bestStreak, done, timeLeft,
    }));
  }, [stage, selCourse, questions, idx, answers, flagged, selAns, locked, score, streak, bestStreak, done, timeLeft, storeKey]);

  /* ── Per-question timer ── */
  useEffect(() => {
    if (stage !== "quiz" || done || locked) { clearInterval(timerRef.current); return; }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); confirmAnswer(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, idx, done, locked]);

  /* ── Load questions handler ── */
  const handleNumSelect = async (num) => {
    setLoadingQ(true);
    const qs = await loadQ(selCourse, num);
    setLoadingQ(false);
    if (!qs.length) { alert("No questions available!"); return; }
    const fixed = qs.map(q => ({ ...q, correctAnswerText: q.options[q.answer] }));
    setQuestions(fixed);
    setAnswers(new Array(fixed.length).fill(null));
    setFlagged(new Array(fixed.length).fill(false));
    setIdx(0); setSelAns(null); setLocked(false);
    setScore(0); setStreak(0); setBestStreak(0);
    setDone(false); setTimeLeft(45); setStage("quiz");
  };

  /* ── Confirm answer ── */
  const confirmAnswer = useCallback((timedOut = false) => {
    clearInterval(timerRef.current);
    const ans = timedOut ? null : selAns;
    const updated = [...answers];
    updated[idx] = ans;
    setAnswers(updated);
    setLocked(true);
    const q = questions[idx];
    if (ans === q?.answer) {
      setScore(s => s + 1);
      const ns = streak + 1;
      setStreak(ns);
      setBestStreak(b => Math.max(b, ns));
    } else {
      setStreak(0);
    }
  }, [selAns, answers, idx, questions, streak]);

  /* ── Navigate to question ── */
  const goTo = (i) => {
    if (i < 0 || i >= questions.length) return;
    setIdx(i); setSelAns(answers[i]); setLocked(answers[i] !== null);
    setTimeLeft(45); setShowNav(false);
  };

  const handleNext = () => {
    if (idx < questions.length - 1) {
      goTo(idx + 1);
    } else {
      // Calculate Quiz Points
      const correctAnswers = answers.filter((a, i) => a === questions[i]?.answer).length;
      const setsOfFive = Math.floor(questions.length / 5);
      
      const totalPoints = correctAnswers + (setsOfFive * 3);
      if (totalPoints > 0) {
        awardPoints(totalPoints, "Quiz Completion");
      }
      
      setDone(true);
    }
  };

  const toggleFlag = () => {
    const f = [...flagged]; f[idx] = !f[idx]; setFlagged(f);
  };

  const handleReview = () => {
    localStorage.removeItem(storeKey);
    navigate("/review", { state: { questions, userAnswers: answers, score, totalQuestions: questions.length } });
  };

  const q = questions[idx];
  const finalScore = answers.filter((a, i) => a === questions[i]?.answer).length;
  const pct = questions.length ? Math.round((finalScore / questions.length) * 100) : 0;

  return (
    <div className="quiz-page-wrap">

      {/* Watermark */}
      {noSS && stage === "quiz" && (
        <div className="quiz-watermark-overlay">
          {Array(15).fill(0).map((_, i) => (
            <div key={i} className="quiz-watermark-row" style={{ marginLeft: i % 2 === 0 ? "0" : "-100px" }}>
              {Array(10).fill(`${userName} · UHC CONFIDENTIAL · `).join("")}
            </div>
          ))}
        </div>
      )}

      {/* Blur overlay */}
      {noSS && stage === "quiz" && blurred && (
        <div className="quiz-blur-overlay" onClick={() => setBlurred(false)}>
          <div className="quiz-blur-inner">🔒<br /><b>Quiz Paused</b><br /><small>Click to resume</small></div>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ══ COURSE SELECT ══ */}
        {stage === "selectCourse" && (
          <motion.div key="course" initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="quiz-card scrollable-card">
            <motion.button className="quiz-back-button" onClick={() => window.history.back()} animate={{ x: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ArrowLeft size={22} />
            </motion.button>
            <div className="quiz-header-badge"><BookOpen size={16} /> Quiz Arena</div>
            <h1 className="quiz-card-title">Choose a Course</h1>
            <p className="quiz-card-sub">Select the subject you want to practice</p>
            <div className="quiz-course-grid">
              {(courses.length > 0 ? courses.map(c => c.name) : Object.keys(coursesTopics)).map(name => (
                <button key={name} className="quiz-course-card" onClick={() => { setSelCourse(name); setStage("selectNumber"); }}>
                  <span className="quiz-course-icon">📚</span>
                  <span>{name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══ NUMBER SELECT ══ */}
        {stage === "selectNumber" && (
          <motion.div key="num" initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="quiz-card scrollable-card">
            <motion.button className="quiz-back-button" onClick={() => setStage("selectCourse")}>
              <ArrowLeft size={22} />
            </motion.button>
            <div className="quiz-header-badge"><Clock size={16} /> Select Mode</div>
            <h1 className="quiz-card-title">How Many Questions?</h1>
            <p className="quiz-card-sub">Course: <strong>{selCourse}</strong></p>
            {loadingQ ? <BookLoader text="Loading questions…" /> : (
              <div className="quiz-num-grid">
                {[
                  { n: 5,   label: "Quick",    icon: "⚡", desc: "~4 min",  col: "#10b981" },
                  { n: 10,  label: "Standard", icon: "📖", desc: "~8 min",  col: "#4255ff" },
                  { n: 20,  label: "Practice", icon: "💪", desc: "~15 min", col: "#8b5cf6" },
                  { n: 50,  label: "Advanced", icon: "🔥", desc: "~38 min", col: "#f59e0b" },
                  { n: 100, label: "Marathon", icon: "🏆", desc: "~75 min", col: "#ef4444" },
                ].map(({ n, label, icon, desc, col }) => (
                  <button key={n} className="quiz-num-card" style={{ "--nc": col }} onClick={() => handleNumSelect(n)}>
                    <span className="qnc-icon">{icon}</span>
                    <span className="qnc-count">{n}</span>
                    <span className="qnc-label">{label}</span>
                    <span className="qnc-desc">{desc}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ══ ACTIVE QUIZ ══ */}
        {stage === "quiz" && !done && q && (
          <motion.div 
            key={`q${idx}`} 
            initial={{ x: 60, opacity: 0 }} 
            animate={{ x: 0, opacity: 1 }} 
            exit={{ x: -60, opacity: 0 }} 
            transition={{ type: "spring", stiffness: 300, damping: 30 }} 
            className="quiz-card quiz-active-card"
            style={noSS ? { userSelect: "none", MozUserSelect: "none", WebkitUserSelect: "none", msUserSelect: "none" } : {}}
          >

            {/* Top bar */}
            <div className="quiz-top-bar">
              <div className="quiz-tb-left">
                <span className="quiz-q-counter">{idx + 1} / {questions.length}</span>
                {streak >= 3 && <span className="quiz-streak-badge">🔥 {streak}</span>}
              </div>
              <div className="quiz-tb-right">
                <button className={`quiz-flag-btn${flagged[idx] ? " flagged" : ""}`} onClick={toggleFlag}><Flag size={14} /></button>
                <button className="quiz-nav-toggle-btn" onClick={() => setShowNav(s => !s)}>⊞</button>
                <CircleTimer timeLeft={timeLeft} total={45} />
              </div>
            </div>

            {/* Progress bar */}
            <div className="quiz-prog-wrap">
              <div className="quiz-prog-bar" style={{ width: `${(idx / questions.length) * 100}%` }} />
            </div>

            {/* Nav panel */}
            {showNav && (
              <div className="quiz-nav-panel">
                <div className="quiz-nav-grid">
                  {questions.map((_, i) => (
                    <button key={i} onClick={() => goTo(i)}
                      className={`qnd${i === idx ? " cur" : ""}${answers[i] !== null ? (answers[i] === questions[i]?.answer ? " ok" : " bad") : ""}${flagged[i] ? " flag" : ""}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <div className="quiz-nav-legend">
                  <span><b className="qnd cur" />Current</span>
                  <span><b className="qnd ok" />Correct</span>
                  <span><b className="qnd bad" />Wrong</span>
                  <span><b className="qnd flag" />Flagged</span>
                </div>
              </div>
            )}

            {/* Question */}
            <div className="quiz-q-wrap">
              {q.difficulty && <span className={`qdiff qdiff-${(q.difficulty || "medium").toLowerCase()}`}>{q.difficulty}</span>}
              <h2 className="quiz-question">{q.question}</h2>
            </div>

            {/* Options */}
            <div className="quiz-opts">
              {q.options.map((opt, i) => {
                let cls = "quiz-opt";
                if (locked) {
                  if (i === q.answer) cls += " correct";
                  else if (i === selAns) cls += " wrong";
                  else cls += " dimmed";
                } else if (selAns === i) cls += " selected";
                return (
                  <button key={i} className={cls} onClick={() => !locked && setSelAns(i)} disabled={locked}>
                    <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
                    <span className="opt-text">{opt}</span>
                    {locked && i === q.answer && <CheckCircle size={15} className="opt-check" />}
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {locked && q.explanation && (
              <motion.div className="quiz-explanation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                💡 <strong>Explanation:</strong> {q.explanation}
              </motion.div>
            )}

            {/* Actions */}
            <div className="quiz-act-row">
              {!locked
                ? <button className="quiz-btn primary" disabled={selAns === null} onClick={() => confirmAnswer(false)}>Confirm Answer</button>
                : <button className="quiz-btn success" onClick={handleNext}>{idx < questions.length - 1 ? "Next →" : "Finish 🏁"}</button>
              }
            </div>

            {/* Mini stats */}
            <div className="quiz-mini-stats">
              <span>✅ {answers.filter((a, i) => a === questions[i]?.answer).length}</span>
              <span>❌ {answers.filter((a, i) => a !== null && a !== questions[i]?.answer).length}</span>
              <span>📌 {flagged.filter(Boolean).length}</span>
              <span>⏳ {questions.length - answers.filter(a => a !== null).length} left</span>
            </div>
          </motion.div>
        )}

        {/* ══ RESULTS ══ */}
        {done && (
          <motion.div key="result" initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 22 }} className="quiz-card quiz-result-card">
            <div className="qr-avatar" style={{ background: avatarColor(userName) }}>{userName[0]?.toUpperCase()}</div>
            <h1 className="qr-title">Quiz Complete!</h1>

            {/* Score ring */}
            <div className="qr-ring-wrap">
              <svg viewBox="0 0 120 120" width="130" height="130">
                <circle cx="60" cy="60" r="50" stroke="#e2e8f0" strokeWidth="10" fill="none" />
                <circle cx="60" cy="60" r="50"
                  stroke={pct >= 70 ? "#4255ff" : pct >= 50 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="10" fill="none"
                  strokeDasharray={`${(pct / 100) * 314} 314`} strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ transition: "stroke-dasharray 1.5s ease" }} />
              </svg>
              <div className="qr-ring-label">
                <span className="qr-big">{pct}%</span>
                <span className="qr-small">{finalScore}/{questions.length}</span>
              </div>
            </div>

            <div className="qr-grade">
              {pct >= 90 ? "🏆 Excellent!" : pct >= 70 ? "🎯 Great Work!" : pct >= 50 ? "📈 Keep Going!" : "💪 Try Again!"}
            </div>

            <div className="qr-stats-row">
              {[["✅","Correct",finalScore],["❌","Wrong",questions.length-finalScore],["🔥","Best Streak",bestStreak],["📌","Flagged",flagged.filter(Boolean).length]].map(([ic, lb, vl]) => (
                <div key={lb} className="qrs">
                  <span className="qrs-ic">{ic}</span>
                  <span className="qrs-vl">{vl}</span>
                  <span className="qrs-lb">{lb}</span>
                </div>
              ))}
            </div>

            <div className="qr-actions">
              <button className="quiz-btn primary" onClick={handleReview}>Review Answers</button>
              <button className="quiz-btn ghost" onClick={() => { localStorage.removeItem(storeKey); setStage("selectCourse"); setDone(false); }}>New Quiz</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}