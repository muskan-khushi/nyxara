// src/context/AuthContext.jsx
import { createContext, useContext, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("nyxara_token"));
  const [user,  setUser]  = useState(() => JSON.parse(localStorage.getItem("nyxara_user") || "null"));

  async function login(email, password) {
    const { data } = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("nyxara_token", data.token);
    localStorage.setItem("nyxara_user",  JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  function logout() {
    localStorage.removeItem("nyxara_token");
    localStorage.removeItem("nyxara_user");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
