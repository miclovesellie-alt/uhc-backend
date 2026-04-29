import React, { useEffect, useState } from "react";
import "../admin_styles/AdminStats.css";

function AdminStats() {

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalQuestions: 0,
    activeUsers: 0
  });

  useEffect(() => {

    const fetchStats = async () => {
      try {

        const res = await fetch("/api/admin/stats");
        const data = await res.json();

        setStats(data);

      } catch (error) {
        console.error("Failed to load stats", error);
      }
    };

    fetchStats();

  }, []);

  return (
    <div className="admin-stats">

      <div className="admin-stat-card">
        <h3>Total Users</h3>
        <p>{stats.totalUsers}</p>
      </div>

      <div className="admin-stat-card">
        <h3>Total Courses</h3>
        <p>{stats.totalCourses}</p>
      </div>

      <div className="admin-stat-card">
        <h3>Total Questions</h3>
        <p>{stats.totalQuestions}</p>
      </div>

      <div className="admin-stat-card">
        <h3>Active Users</h3>
        <p>{stats.activeUsers}</p>
      </div>

    </div>
  );
}

export default AdminStats;