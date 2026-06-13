// src/context/AuthContext.jsx
import { createContext, useContext, useState, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const t = localStorage.getItem("nyxara_token");
      const u = localStorage.getItem("nyxara_user");
      if (t && u) { api.defaults.headers.common["Authorization"] = `Bearer ${t}`; return JSON.parse(u); }
    } catch {}
    return null;
  });

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    const { token, user: u } = data;
    localStorage.setItem("nyxara_token", token);
    localStorage.setItem("nyxara_user", JSON.stringify(u));
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("nyxara_token");
    localStorage.removeItem("nyxara_user");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}