// src/context/AlertContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const AlertContext = createContext(null);
let socket = null;

export function AlertProvider({ children }) {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    socket = io("/", { auth: { token }, transports: ["websocket"] });

    socket.on("connect",    () => { setConnected(true);  socket.emit("subscribe_alerts"); });
    socket.on("disconnect", () => setConnected(false));

    socket.on("new_alert", (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 100)); // Keep last 100
    });

    socket.on("alert_updated", ({ alertId, action }) => {
      setAlerts(prev => prev.map(a => a.alertId === alertId ? { ...a, analystAction: action } : a));
    });

    return () => { socket?.disconnect(); socket = null; };
  }, [token]);

  return (
    <AlertContext.Provider value={{ alerts, connected, clearAlerts: () => setAlerts([]) }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() { return useContext(AlertContext); }
