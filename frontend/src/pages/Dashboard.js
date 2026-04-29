import React from "react";
import { Routes, Route } from "react-router-dom";
import AuthCard from "./pages/AuthCard";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthCard />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App;
