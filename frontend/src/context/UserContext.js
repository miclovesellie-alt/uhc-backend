import React, { createContext, useState, useEffect } from "react";
import axios from "axios";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  // ✅ Load user from localStorage for persistence
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [adminTheme, setAdminTheme] = useState(localStorage.getItem("adminTheme") || "light");

  // User-side theme: applies to document.body for user dashboard pages
  useEffect(() => {
    document.body.className = theme === "dark" ? "dark-theme" : "";
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Admin-side theme: stored separately, consumed only by AdminLayout component
  useEffect(() => {
    localStorage.setItem("adminTheme", adminTheme);
  }, [adminTheme]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    // ✅ Validate token in background without immediately logging out
    axios
      .get("https://uhc-backend.onrender.com/api/user", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setUser(res.data); // update with fresh data
        localStorage.setItem("user", JSON.stringify(res.data));
      })
      .catch((err) => {
        console.error("Failed to fetch user:", err.response || err);
        // Optional: only remove token if it's truly invalid
        if (err.response?.status === 401) {
          setUser(null);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <UserContext.Provider value={{ user, setUser: updateUser, loading, logout, theme, setTheme, adminTheme, setAdminTheme }}>
      {children}
    </UserContext.Provider>
  );
};
