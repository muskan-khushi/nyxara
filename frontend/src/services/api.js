// src/services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:8080",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Attach saved token on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem("nyxara_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem("nyxara_token");
      localStorage.removeItem("nyxara_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;