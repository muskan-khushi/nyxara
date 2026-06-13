// src/context/AlertContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import api from "../services/api";
import { useAuth } from "./AuthContext";

const AlertContext = createContext(null);
export const useAlerts = () => useContext(AlertContext);

const WS_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const { user } = useAuth();

  // Load initial alerts
  useEffect(() => {
    if (!user) {
      setAlerts([]);
      return;
    }
    api.get("/api/alerts", { params: { limit: 50 } })
      .then(r => setAlerts(r.data.alerts || []))
      .catch(() => {});
  }, [user]);

  // WebSocket connection
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("nyxara_token");
    if (!token) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("new_alert", alert => {
      const normalized = {
        ...alert,
        _id: alert._id || alert.alertId,
        alertId: alert.alertId || alert._id
      };
      setAlerts(prev => [normalized, ...prev.filter(a => (a.alertId || a._id) !== normalized.alertId)]);
      // Browser notification (if permission granted)
      if (Notification.permission === "granted" && normalized.decision === "BLOCK") {
        new Notification(`Nyxara: BLOCK — ${normalized.accountId}`, {
          body: `Risk score: ${Math.round((normalized.riskScore || 0) * 100)}`,
          icon: "/nyxara-logo.svg",
        });
      }
    });

    socket.on("alert_updated", updated => {
      setAlerts(prev => prev.map(a => (a.alertId || a._id) === updated.alertId ? { ...a, ...updated, analystAction: updated.action } : a));
    });

    socket.emit("subscribe_alerts");
    socketRef.current = socket;

    // Request notification permission
    if (Notification.permission === "default") Notification.requestPermission();

    return () => { socket.disconnect(); };
  }, [user]);

  const addAlert = useCallback(alert => {
    const normalized = {
      ...alert,
      _id: alert._id || alert.alertId,
      alertId: alert.alertId || alert._id
    };
    setAlerts(prev => [normalized, ...prev]);
  }, []);

  return (
    <AlertContext.Provider value={{ alerts, connected, addAlert }}>
      {children}
    </AlertContext.Provider>
  );
}