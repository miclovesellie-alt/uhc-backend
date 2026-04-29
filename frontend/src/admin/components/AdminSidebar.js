import React from "react";
import { NavLink } from "react-router-dom"; // <-- use NavLink instead of Link
import "../admin_styles/AdminSidebar.css";

function AdminSidebar() {
  return (
    <div className="admin-sidebar">
      <div className="admin-logo">
        <h2>UHC Admin</h2>
      </div>
      <nav className="admin-nav">
        <NavLink to="/admin" end>
          Dashboard
        </NavLink>
        <NavLink to="/admin/users">Users</NavLink>
        <NavLink to="/admin/questions">Questions</NavLink>
        <NavLink to="/admin/userlibrary">User Library</NavLink>
        <NavLink to="/admin/uploads">Bulk Upload</NavLink>
        <NavLink to="/admin/notifications">Notifications</NavLink>
        <NavLink to="/admin/messages">Messages</NavLink>
        <NavLink to="/admin/settings">Settings</NavLink>
      </nav>
    </div>
  );
}

export default AdminSidebar;