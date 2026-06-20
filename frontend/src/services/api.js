// src/services/api.js
import axios from "axios";
import { getMockResponse } from "./mockData";

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

// Auto-logout on 401 & Offline mock fallback
api.interceptors.response.use(
  res => res,
  err => {
    // If there's a network error or connection refused (e.g. backend down)
    if (err.message === "Network Error" || !err.response || err.code === "ECONNREFUSED") {
      console.warn(`[Offline Fallback] Returning mock data for ${err.config.url}`);
      
      // Remove query params and extract pathname to match the base URL in our mock config
      let path = err.config.url.split('?')[0];
      try {
        path = new URL(path, window.location.origin).pathname;
      } catch (e) {}
      
      const mockResponse = getMockResponse(path);
      
      return Promise.resolve(mockResponse);
    }

    if (err.response?.status === 401) {
      localStorage.removeItem("nyxara_token");
      localStorage.removeItem("nyxara_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;