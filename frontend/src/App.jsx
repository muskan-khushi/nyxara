// src/App.jsx
// Root component — routing, layout shell, auth guard

import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AlertProvider } from "./context/AlertContext";
import Sidebar from "./components/layout/Sidebar";
import Navbar from "./components/layout/Navbar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Analyzer from "./pages/Analyzer";
import GraphView from "./pages/GraphView";
import Alerts from "./pages/Alerts";
import Compliance from "./pages/Compliance";
import Metrics from "./pages/Metrics";

/* ── Auth guard ── */
function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

/* ── App shell with sidebar + content ── */
function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-night overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ── Root app ── */
export default function App() {
  return (
    <AuthProvider>
      <AlertProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

          {/* Protected — wrapped in sidebar shell */}
          <Route path="/dashboard" element={
            <PrivateRoute>
              <AppShell><Dashboard /></AppShell>
            </PrivateRoute>
          } />
          <Route path="/analyzer" element={
            <PrivateRoute>
              <AppShell><Analyzer /></AppShell>
            </PrivateRoute>
          } />
          <Route path="/graph" element={
            <PrivateRoute>
              <AppShell><GraphView /></AppShell>
            </PrivateRoute>
          } />
          <Route path="/alerts" element={
            <PrivateRoute>
              <AppShell><Alerts /></AppShell>
            </PrivateRoute>
          } />
          <Route path="/compliance" element={
            <PrivateRoute>
              <AppShell><Compliance /></AppShell>
            </PrivateRoute>
          } />
          <Route path="/metrics" element={
            <PrivateRoute>
              <AppShell><Metrics /></AppShell>
            </PrivateRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AlertProvider>
    </AuthProvider>
  );
}