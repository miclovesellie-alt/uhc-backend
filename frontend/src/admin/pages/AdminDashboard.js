import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import axios from "axios";
import { RefreshCw, TrendingUp, Users, BookOpen, Zap, Activity } from "lucide-react";

const COLORS = ["#4255ff","#16a34a","#d97706","#dc2626","#8b5cf6"];

/* ── Book Loader ── */
const BookLoader = () => (
  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"48px 20px", gap:16 }}>
    <div style={{ width:50, height:60, position:"relative" }}>
      <div style={{ position:"absolute", left:0, top:0, width:10, height:60, background:"linear-gradient(180deg,#4255ff,#8b5cf6)", borderRadius:"3px 0 0 3px" }} />
      {[0,1,2].map(i => (
        <div key={i} style={{
          position:"absolute", left:10, top:3, width:36, height:54,
          background:["#c7d2fe","#a5b4fc","#818cf8"][i],
          borderRadius:"0 8px 8px 0",
          transformOrigin:"left center",
          animation:`flipPage 1.4s ease-in-out ${i*0.35}s infinite`,
        }} />
      ))}
    </div>
    <p style={{ color:"#64748b", fontSize:".85rem", fontWeight:500 }}>Loading live data…</p>
    <style>{`@keyframes flipPage{0%{transform:rotateY(0);}40%{transform:rotateY(-140deg);}60%{transform:rotateY(-140deg);}100%{transform:rotateY(0);}}`}</style>
  </div>
);

/* ── Live dot ── */
const LiveDot = () => (
  <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:".72rem", fontWeight:700, color:"#16a34a" }}>
    <span style={{ width:7, height:7, borderRadius:"50%", background:"#16a34a", display:"inline-block", animation:"livePulse 1.2s ease infinite" }} />
    LIVE
    <style>{`@keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}`}</style>
  </span>
);

export default function AdminDashboard() {
  const [stats, setStats]             = useState({ totalUsers:0, totalQuestions:0, totalCourses:0, activeUsers:0 });
  const [recentUsers, setRecentUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [chartType, setChartType]     = useState("bar");
  const [loading, setLoading]         = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = async () => {
    setLoading(true);
    try {
      // 1. Stats
      try {
        const statsRes = await axios.get("/api/admin/stats");
        console.log("📊 Stats received:", statsRes.data);
        if (statsRes.data) {
          setStats({
            totalUsers: statsRes.data.totalUsers || 0,
            totalQuestions: statsRes.data.totalQuestions || 0,
            totalCourses: statsRes.data.totalCourses || 0,
            activeUsers: statsRes.data.activeUsers || 0
          });
        }
      } catch (e) { console.error("Stats fetch error", e); }

      // 2. Recent Users
      try {
        const usersRes = await axios.get("/api/users");
        const sorted = [...(Array.isArray(usersRes.data) ? usersRes.data : [])].reverse().slice(0, 6);
        setRecentUsers(sorted);
      } catch (e) { console.error("Users fetch error", e); }

      // 3. Activity Logs
      try {
        const logsRes = await axios.get("/api/admin/activity/logs");
        setAdminLogs(Array.isArray(logsRes.data) ? logsRes.data.slice(0, 8) : []);
      } catch (e) { console.error("Logs fetch error", e); }

      setLastRefresh(new Date());
    } catch (err) {
      console.error("General dashboard fetch error:", err);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 15000);
    return () => clearInterval(iv);
  }, []);

  const kpi = [
    { label:"Total Users",       value:stats.totalUsers,     icon:<Users size={18}/>,    color:"blue",   trend:"+12% this week" },
    { label:"Total Questions",   value:stats.totalQuestions, icon:<BookOpen size={18}/>, color:"green",  trend:"+5% this week"  },
    { label:"Total Courses",     value:stats.totalCourses,   icon:<Activity size={18}/>, color:"orange", trend:"Active"         },
    { label:"Active (24h)",      value:stats.activeUsers,    icon:<Zap size={18}/>,      color:"blue",   trend:"Live"           },
  ];

  const chartData = [
    { name:"Users",     value:stats.totalUsers },
    { name:"Questions", value:stats.totalQuestions },
    { name:"Courses",   value:stats.totalCourses },
    { name:"Active",    value:stats.activeUsers },
  ];

  const avatarColor = (name="") => {
    const cols=["#4255ff","#8b5cf6","#ec4899","#f59e0b","#10b981","#06b6d4"];
    return cols[(name.charCodeAt(0)||0)%cols.length];
  };

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <div className="admin-section-header" style={{ marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:"1.4rem", fontWeight:800, color:"var(--admin-text)", margin:0 }}>
            📊 Dashboard Overview
          </h1>
          <p style={{ fontSize:".82rem", color:"var(--admin-muted)", margin:"4px 0 0", display:"flex", alignItems:"center", gap:8 }}>
            Last refreshed: {lastRefresh.toLocaleTimeString()} &nbsp;<LiveDot />
          </p>
        </div>
        <button className="admin-btn secondary sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="admin-stats-grid">
        {kpi.map((k,i) => (
          <div className="admin-stat-card" key={i}>
            <div className={`admin-stat-icon ${k.color}`}>{k.icon}</div>
            <div className="admin-stat-value">{k.value.toLocaleString()}</div>
            <div className="admin-stat-label">{k.label}</div>
            <div className="admin-stat-trend"><TrendingUp size={11}/> {k.trend}</div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="admin-section-header">
        <span className="admin-section-title">📈 Analytics</span>
        <select className="admin-select" value={chartType} onChange={e=>setChartType(e.target.value)}>
          <option value="bar">Bar Chart</option>
          <option value="pie">Pie Chart</option>
        </select>
      </div>

      <div className="admin-charts-grid" style={{ marginBottom:28 }}>
        <div className="admin-chart-card">
          <h3>Platform Statistics</h3>
          <ResponsiveContainer width="100%" height={240}>
            {chartType==="pie" ? (
              <PieChart>
                <Pie data={chartData.filter(d=>d.value>0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={e=>e.name}>
                  {chartData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip contentStyle={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, color:"#0f172a" }}/>
              </PieChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4"/>
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize:12 }}/>
                <YAxis stroke="#94a3b8" tick={{ fontSize:12 }}/>
                <Tooltip contentStyle={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, color:"#0f172a" }}/>
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {chartData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Live Admin Activity Feed */}
        <div className="admin-chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <h3 style={{ margin: 0 }}>🛡️ Admin Activity</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--admin-muted)' }}>Latest updates</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:8, maxHeight: 300, overflowY: 'auto', paddingRight: 5 }}>
            {adminLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--admin-muted)' }}>No recent activity</div>
            ) : adminLogs.map((log, idx) => (
              <div key={log._id || idx} style={{ 
                display: 'flex', 
                gap: 12, 
                padding: '10px', 
                background: 'rgba(0,0,0,0.02)', 
                borderRadius: 12,
                border: '1px solid var(--admin-border)'
              }}>
                <div style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: '50%', 
                  background: avatarColor(log.admin?.name), 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: 'white', 
                  fontWeight: 800, 
                  fontSize: '0.75rem',
                  flexShrink: 0
                }}>
                  {(log.admin?.name || "A")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--admin-text)' }}>{log.admin?.name || "Admin"}</strong> {log.message}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--admin-muted)', marginTop: 4 }}>
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.action.replace('_', ' ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Live Recent Users Feed ── */}
      <div className="admin-section-header">
        <span className="admin-section-title">👥 Recent Users <LiveDot /></span>
        <button className="admin-btn secondary sm" onClick={()=>window.location.href="/admin/users"}>
          View All
        </button>
      </div>

      {loading && recentUsers.length === 0 ? <BookLoader /> : (
        <div className="admin-table-wrap" style={{ marginBottom:28 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Country</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u,i)=>(
                <tr key={u._id}>
                  <td style={{ color:"var(--admin-muted)", fontWeight:600 }}>{i+1}</td>
                  <td>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:30, height:30, borderRadius:"50%", background:avatarColor(u.name), display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:".8rem", flexShrink:0 }}>
                        {(u.name||"?")[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight:600, fontSize:".875rem" }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ color:"var(--admin-muted)", fontSize:".82rem" }}>{u.email}</td>
                  <td>
                    <span className={`admin-badge ${u.role==="admin"?"orange":u.role==="superadmin"?"red":"blue"}`}>
                      {u.role||"user"}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${u.status==="banned"?"red":"green"}`}>
                      {u.status==="banned"?"Banned":"Active"}
                    </span>
                  </td>
                  <td style={{ color:"var(--admin-muted)", fontSize:".82rem" }}>{u.country||"—"}</td>
                </tr>
              ))}
              {recentUsers.length===0 && (
                <tr><td colSpan={6} style={{ textAlign:"center", color:"var(--admin-muted)", padding:32 }}>No users yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}