// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AlertProvider } from "./context/AlertContext";

import Login      from "./pages/Login";
import Dashboard  from "./pages/Dashboard";
import Analyzer   from "./pages/Analyzer";
import GraphView  from "./pages/GraphView";
import Alerts     from "./pages/Alerts";
import Compliance from "./pages/Compliance";
import Metrics    from "./pages/Metrics";
import Navbar     from "./components/layout/Navbar";
import Sidebar    from "./components/layout/Sidebar";

function ProtectedLayout({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-screen bg-night overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AlertProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/analyzer"   element={<ProtectedLayout><Analyzer /></ProtectedLayout>} />
            <Route path="/graph"      element={<ProtectedLayout><GraphView /></ProtectedLayout>} />
            <Route path="/alerts"     element={<ProtectedLayout><Alerts /></ProtectedLayout>} />
            <Route path="/compliance" element={<ProtectedLayout><Compliance /></ProtectedLayout>} />
            <Route path="/metrics"    element={<ProtectedLayout><Metrics /></ProtectedLayout>} />
          </Routes>
        </AlertProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
