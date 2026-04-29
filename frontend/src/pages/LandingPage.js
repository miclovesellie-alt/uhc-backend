import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { motion } from "framer-motion";
import { 
  BookOpen, 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  Trophy, 
  ArrowRight,
  CheckCircle2,
  Smartphone,
  LayoutDashboard,
  Menu,
  X
} from "lucide-react";
import "../styles/landingpage.css";
import graduation from "../assets/graduation.jpeg";

function useCounter(target, active) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const duration = 2000;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        start = target;
        clearInterval(timer);
      }
      setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, active]);
  return count;
}

const features = [
  { icon: <Zap />, title: "Adaptive Quizzes", desc: "Our smart algorithms adjust difficulty based on your performance, focusing on areas where you need the most improvement." },
  { icon: <BookOpen />, title: "Study Resources", desc: "Access a library of clinical guides, lecture notes, and exam prep materials curated by nursing experts." },
  { icon: <TrendingUp />, title: "Detailed Analytics", desc: "Visualize your progress with beautiful charts. Track your score history across different nursing topics." },
  { icon: <ShieldCheck />, title: "Secure Exams", desc: "Anti-cheating measures and proctored environments for high-stakes nursing licensing preparation." },
  { icon: <LayoutDashboard />, title: "Admin Dashboard", desc: "Powerful tools for instructors to manage classes, create custom question banks, and monitor student success." },
  { icon: <Trophy />, title: "National Rankings", desc: "Compete with nursing students across the country on our seasonal leaderboards and earn certifications." },
];

const roles = [
  { 
    icon: "🩺", 
    title: "Nursing Students", 
    desc: "Master your coursework and prepare for licensing exams with the most comprehensive nursing platform.",
    features: ["5,000+ Practice Questions", "Personalized Study Plans", "Instant Performance Feedback", "Peer Community Support"] 
  },
  { 
    icon: "👨‍🏫", 
    title: "Instructors & Schools", 
    desc: "Empower your students with data-driven insights and effortless classroom management tools.",
    features: ["Custom Quiz Creation", "Real-time Student Monitoring", "Automated Grading System", "Class Performance Reports"] 
  },
];

const AI_QUESTIONS = [
  { 
    q: "What is Universal Health Community?", 
    a: "UHC is a specialized digital ecosystem for nursing education. We provide adaptive testing, extensive study libraries, and real-time performance analytics to help you master your nursing career." 
  },
  { 
    q: "How does the adaptive quiz system work?", 
    a: "Our system analyzes your performance across different nursing categories (like Pharmacology or Pediatrics) and identifies your weak spots. It then adjusts the question difficulty and frequency to ensure you master those areas faster." 
  },
  { 
    q: "Can instructors track student progress?", 
    a: "Absolutely! Our robust Admin Dashboard allows instructors to create classes, monitor real-time student performance, manage question banks, and identify students who may need additional support." 
  },
  { 
    q: "Is UHC mobile friendly?", 
    a: "Yes! Our platform is built with a 'mobile-first' philosophy. You can study, take quizzes, and track your progress seamlessly across your phone, tablet, or desktop." 
  }
];

function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const statsRef = useRef(null);
  const [statsActive, setStatsActive] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactStatus, setContactStatus] = useState(null); 

  // AI Assistant State
  const [selectedAIQ, setSelectedAIQ] = useState(null);
  const [aiTyping, setAiTyping] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsActive(true); },
      { threshold: 0.5 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const totalQuestions = useCounter(10000, statsActive);
  const totalStudents = useCounter(5000, statsActive);
  const successRate = useCounter(94, statsActive);

  const handleAIQuestion = (item) => {
    if (aiTyping) return;
    setSelectedAIQ(item.q);
    setAiTyping(true);
    setAiAnswer("");
    
    let i = 0;
    const interval = setInterval(() => {
      setAiAnswer(item.a.slice(0, i));
      i++;
      if (i > item.a.length) {
        clearInterval(interval);
        setAiTyping(false);
      }
    }, 20);
  };


  return (
    <div className="landing-container">
      {/* NAVBAR */}
      <nav className={`landing-navbar ${scrolled ? "scrolled" : ""} ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="landing-logo" onClick={() => { window.scrollTo(0, 0); setMobileMenuOpen(false); }}>
          <span className="logo-text wave-text">
            {"UHC".split("").map((char, index) => (
              <span key={index} style={{ "--i": index }}>{char}</span>
            ))}
          </span>
        </div>

        <div className={`landing-nav-links ${mobileMenuOpen ? "active" : ""}`}>
          <span className="nav-link" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>Quiz Library</span>
          <span className="nav-link" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>Study Guides</span>
          <span className="nav-link" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>Resources</span>
          <div className="nav-divider"></div>
          <span className="landing-login mobile-only" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>Log In</span>
          <button className="landing-signup mobile-only" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>Get Started</button>
        </div>

        <div className="landing-nav-right">
          <span className="landing-login desktop-only" onClick={() => navigate("/auth")}>Log In</span>
          <button className="landing-signup desktop-only" onClick={() => navigate("/auth")}>Get Started</button>
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="hero-section">
        <div className="hero-text">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <span className="section-label">Empowering Future Healthcare Heroes</span>
            <h1>The Gold Standard in <span className="highlight">Nursing Education</span></h1>
            <p>Join over 5,000 nursing students mastering their exams with interactive quizzes, real-time analytics, and expert-curated resources.</p>
            <div className="hero-actions">
              <button className="hero-btn" onClick={() => navigate("/auth")}>Join the Community</button>
              <button className="hero-btn-secondary" onClick={() => navigate("/auth")}>Browse Library</button>
            </div>
          </motion.div>
        </div>
        <div className="hero-image-wrapper">
          <div className="hero-image-container">
             <img src={graduation} alt="Graduating Nursing Student" />
             <div className="hero-floating-card">
               <div style={{ background: '#10b981', padding: '8px', borderRadius: '10px', color: 'white' }}>
                 <Trophy size={20} />
               </div>
               <div>
                 <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>94% Success Rate</div>
                 <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Among our regular students</div>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* ROLES SECTION */}
      <section className="roles-section">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <span className="section-label">Built For You</span>
          <h2 className="section-title">Designed for Excellence</h2>
          <p className="section-subtitle">Whether you're a student striving for licensure or an instructor shaping the next generation, UHC provides the tools you need.</p>
          
          <div className="roles-grid">
            {roles.map((role, idx) => (
              <motion.div 
                key={idx} 
                className="role-card"
                whileHover={{ y: -8 }}
              >
                <div className="role-icon">{role.icon}</div>
                <h3>{role.title}</h3>
                <p>{role.desc}</p>
                <div className="role-features">
                  {role.features.map((f, i) => (
                    <div key={i} className="role-feature">
                      <CheckCircle2 size={16} className="role-check" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI ASSISTANT SECTION */}
      <section className="ai-assistant-section">
        <div className="ai-assistant-container">
          <div className="ai-assistant-info">
            <span className="section-label">Meet Your Guide</span>
            <h2 className="section-title">Interactive <span className="highlight">AI Assistant</span></h2>
            <p className="section-subtitle">Click on a question to learn more about how UHC can transform your study experience.</p>
            
            <div className="ai-questions-list">
              {AI_QUESTIONS.map((item, idx) => (
                <button 
                  key={idx} 
                  className={`ai-q-btn ${selectedAIQ === item.q ? 'active' : ''}`}
                  onClick={() => handleAIQuestion(item)}
                >
                  <ArrowRight size={16} />
                  <span>{item.q}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ai-model-wrapper">
            <div className="ai-model-card">
              <div className="ai-phone-screen">
                <div className="ai-avatar-header">
                  <div className="ai-avatar-pulse">
                    <Smartphone size={20} color="white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#333' }}>UHC Assistant</div>
                    <div style={{ fontSize: '0.7rem', color: '#10b981' }}>{aiTyping ? 'Typing...' : 'Online'}</div>
                  </div>
                </div>
                
                <div className="ai-response-area">
                  {!selectedAIQ ? (
                    <div className="ai-placeholder">
                      <p>Select a question to start chatting with our medical guide.</p>
                    </div>
                  ) : (
                    <div className="ai-chat-bubble">
                      <div className="user-q">{selectedAIQ}</div>
                      <div className="ai-a">{aiAnswer}<span className="cursor">|</span></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="features-section">
        <span className="section-label">Core Capabilities</span>
        <h2 className="section-title">Everything you need to excel</h2>
        <p className="section-subtitle">Powerful features designed specifically for the unique challenges of nursing education.</p>
        
        <div className="features-grid">
          {features.map((feature, idx) => (
            <motion.div key={idx} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="stats-section" ref={statsRef}>
        <div className="stats-grid">
          <div className="stat">
            <h2>{totalQuestions.toLocaleString()}+</h2>
            <p>Practice Questions</p>
          </div>
          <div className="stat">
            <h2>{totalStudents.toLocaleString()}+</h2>
            <p>Active Students</p>
          </div>
          <div className="stat">
            <h2>{successRate}%</h2>
            <p>Licensing Success</p>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="cta-section">
        <div className="cta-box">
          <div className="cta-content">
            <h2>Ready to transform your learning?</h2>
            <p>Start your journey toward nursing excellence today. Create your free account in less than 2 minutes.</p>
            <button className="cta-btn" onClick={() => navigate("/auth")}>Get Started Free</button>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '400px', padding: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '24px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                 <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                    <Smartphone size={20} />
                 </div>
                 <div style={{ fontWeight: 700 }}>Mobile Ready</div>
               </div>
               <p style={{ fontSize: '0.9rem', opacity: 0.9 }}>Study anywhere, anytime. Our platform is fully responsive and optimized for all your devices.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-contact">
            <h3>Contact Us</h3>
            <p>Have questions? Reach us at <strong>boafokyei3@gmail.com</strong> or call <strong>+233 598 173 019</strong>.</p>
            
            {contactStatus && (
              <div className={`contact-status-msg ${contactStatus.type}`}>
                {contactStatus.type === 'success' ? '✓ ' : '✕ '} {contactStatus.msg}
              </div>
            )}

            <form className="footer-contact-form" onSubmit={async (e) => { 
              e.preventDefault(); 
              try {
                await api.post("/contact", contactForm);
                setContactStatus({ type: 'success', msg: 'Thank you! Your message has been sent to our team.' });
                setContactForm({ name: "", email: "", message: "" });
                setTimeout(() => setContactStatus(null), 5000);
              } catch (err) {
                setContactStatus({ type: 'error', msg: 'Failed to send message. Please try again.' });
              }
            }}>
              <div className="input-group">
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  value={contactForm.name}
                  onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                  required 
                />
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  value={contactForm.email}
                  onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                  required 
                />
              </div>
              <textarea 
                placeholder="How can we help?" 
                value={contactForm.message}
                onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                required
              />
              <button type="submit" className="contact-submit-btn">
                <span>Send Message</span>
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
          <div className="footer-links">
            <h4>Platform</h4>
            <ul>
              <li><a href="/auth">Quiz Library</a></li>
              <li><a href="/auth">Flashcards</a></li>
              <li><a href="/auth">Study Guides</a></li>
              <li><a href="/auth">Analytics</a></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Support</h4>
            <ul>
              <li><a href="/auth">Help Center</a></li>
              <li><a href="/auth">Community</a></li>
              <li><a href="/auth">Terms of Service</a></li>
              <li><a href="/auth">Privacy Policy</a></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Connect</h4>
            <ul>
              <li><a href="https://wa.me/233598173019" target="_blank" rel="noreferrer">WhatsApp: +233 598 173 019</a></li>
              <li><a href="mailto:boafokyei3@gmail.com">Email Us</a></li>
              <li><a href="#facebook">Facebook</a></li>
              <li><a href="#instagram">Instagram</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} Universal Healthcare Community. All rights reserved.</span>
          <div style={{ display: 'flex', gap: '24px' }}>
             <a href="#privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</a>
             <a href="#terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;