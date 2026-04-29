import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";

const PrivateRoute = ({ children, adminOnly = false }) => {
  const { user } = useContext(UserContext);
  const token = localStorage.getItem("token");

  // 1. No token → block immediately
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // 2. Token exists but user not yet loaded (important on refresh)
  if (!user) {
    return null; // wait for context to hydrate
  }

  // 3. Admin check
  if (adminOnly && !['admin', 'superadmin'].includes(user.role)) {
    console.warn("Unauthorized access attempt to admin panel");
    return <Navigate to="/dashboard" replace />;
  }

  // 4. Allow access
  return children;
};

export default PrivateRoute;