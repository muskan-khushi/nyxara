// src/context/AlertContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import api from "../services/api";

const AlertContext = createContext(null);
export const useAlerts = () => useContext(AlertContext);

const WS_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  // Load initial alerts
  useEffect(() => {
    api.get("/api/alerts", { params: { limit: 50 } })
      .then(r => setAlerts(r.data.alerts || []))
      .catch(() => {});
  }, []);

  // WebSocket connection
  useEffect(() => {
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
      setAlerts(prev => [alert, ...prev.filter(a => a.alertId !== alert.alertId)]);
      // Browser notification (if permission granted)
      if (Notification.permission === "granted" && alert.decision === "BLOCK") {
        new Notification(`Nyxara: BLOCK — ${alert.accountId}`, {
          body: `Risk score: ${Math.round((alert.riskScore || 0) * 100)}`,
          icon: "/nyxara-logo.svg",
        });
      }
    });

    socket.on("alert_updated", updated => {
      setAlerts(prev => prev.map(a => a.alertId === updated.alertId ? { ...a, ...updated } : a));
    });

    socket.emit("subscribe_alerts");
    socketRef.current = socket;

    // Request notification permission
    if (Notification.permission === "default") Notification.requestPermission();

    return () => { socket.disconnect(); };
  }, []);

  const addAlert = useCallback(alert => {
    setAlerts(prev => [alert, ...prev]);
  }, []);

  return (
    <AlertContext.Provider value={{ alerts, connected, addAlert }}>
      {children}
    </AlertContext.Provider>
  );
}