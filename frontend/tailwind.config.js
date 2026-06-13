// ═══════════════════════════════════════════
// tailwind.config.js
// ═══════════════════════════════════════════
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night:   "#12082E",
        abyss:   "#1A0533",
        grape:   "#7B2FBE",
        orchid:  "#C084FC",
        cyan:    "#06B6D4",
        amber:   "#F59E0B",
        jade:    "#10B981",
        crimson: "#DC2626",
        slate:   "#374151",
        frost:   "#F5F3FF",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Cascadia Code", "monospace"],
      },
      borderRadius: {
        DEFAULT: "10px",
        sm: "6px",
        lg: "14px",
        xl: "18px",
        "2xl": "22px",
      },
      boxShadow: {
        grape:  "0 4px 24px rgba(123,47,190,0.25)",
        orchid: "0 4px 20px rgba(192,132,252,0.20)",
        crimson:"0 4px 16px rgba(220,38,38,0.30)",
      },
      animation: {
        "fade-in":  "fadeIn 0.25s ease-out both",
        "slide-up": "slideUp 0.30s ease-out both",
        "glow":     "glowPulse 2.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0, transform: "translateY(6px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        slideUp:   { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        glowPulse: { "0%,100%": { boxShadow: "0 0 8px rgba(123,47,190,0.2)" }, "50%": { boxShadow: "0 0 24px rgba(123,47,190,0.5)" } },
      },
    },
  },
  plugins: [],
};

// ═══════════════════════════════════════════
// vite.config.js
// ═══════════════════════════════════════════
/*
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api":  { target: "http://localhost:8080", changeOrigin: true },
      "/v1":   { target: "http://localhost:8001", changeOrigin: true },
      "/socket.io": { target: "http://localhost:8080", ws: true, changeOrigin: true },
    },
  },
});
*/

// ═══════════════════════════════════════════
// package.json (key deps)
// ═══════════════════════════════════════════
/*
{
  "name": "nyxara-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev":   "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react":              "^18.3.1",
    "react-dom":          "^18.3.1",
    "react-router-dom":   "^6.26.0",
    "axios":              "^1.7.2",
    "socket.io-client":   "^4.7.5",
    "d3":                 "^7.9.0",
    "recharts":           "^2.12.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer":          "^10.4.20",
    "postcss":               "^8.4.40",
    "tailwindcss":           "^3.4.10",
    "vite":                  "^5.4.1"
  }
}
*/

// ═══════════════════════════════════════════
// src/main.jsx
// ═══════════════════════════════════════════
/*
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
*/

// ═══════════════════════════════════════════
// index.html
// ═══════════════════════════════════════════
/*
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/nyxara-logo.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nyxara — Mule Account Detection AI</title>
  <meta name="description" content="AI-powered mule account detection platform. GNN + Ensemble + VAE. FIU-IND compliant." />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
*/

// ═══════════════════════════════════════════
// .env.example
// ═══════════════════════════════════════════
/*
VITE_BACKEND_URL=http://localhost:8080
VITE_AI_ENGINE_URL=http://localhost:8001
VITE_CYBER_ENGINE_URL=http://localhost:8002
VITE_BLOCKCHAIN_URL=http://localhost:8003
*/