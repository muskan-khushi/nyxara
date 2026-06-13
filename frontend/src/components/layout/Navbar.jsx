// src/components/layout/Navbar.jsx
// Top navbar — page title, WebSocket status, global search trigger

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAlerts } from "../../context/AlertContext";

const PAGE_META = {
  "/dashboard": { title: "Command Center", sub: "Real-time mule account intelligence" },
  "/analyzer": { title: "Account Analyzer", sub: "6-layer fraud analysis" },
  "/graph": { title: "Graph Intelligence", sub: "Ring detection · Community fraud rates" },
  "/alerts": { title: "Alert Queue", sub: "Analyst review workflow" },
  "/compliance": { title: "Compliance Center", sub: "STR generation · Blockchain audit" },
  "/metrics": { title: "Model Performance", sub: "AUC · F1 · SHAP attribution" },
};

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const { alerts, connected: wsConnected } = useAlerts();

  const meta = PAGE_META[location.pathname] || { title: "Nyxara", sub: "" };
  const pendingCount = alerts.filter(a => !a.analystAction).length;

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) navigate(`/analyzer?account=${encodeURIComponent(search.trim())}`);
  }

  return (
    <header className="flex items-center justify-between px-6 py-3.5 border-b border-grape/12 bg-abyss/60 backdrop-blur-sm sticky top-0 z-30">
      {/* Page title */}
      <div>
        <h2 className="text-frost/90 font-semibold text-sm leading-none">{meta.title}</h2>
        {meta.sub && <p className="text-frost/30 text-[10px] mt-0.5">{meta.sub}</p>}
      </div>

      {/* Center: quick search */}
      <form onSubmit={handleSearch} className="hidden md:flex items-center gap-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Quick lookup account ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearching(true)}
            onBlur={() => setSearching(false)}
            className={`bg-night/60 border text-xs text-frost/80 placeholder-frost/25 rounded-lg pl-8 pr-3 py-2 outline-none transition-all font-mono
              ${searching ? "border-grape/50 w-52" : "border-grape/20 w-40"}`}
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-frost/25" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5.5" cy="5.5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 8L10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
      </form>

      {/* Right: status indicators */}
      <div className="flex items-center gap-3">
        {/* WS status */}
        <div className="hidden sm:flex items-center gap-1.5" title={wsConnected ? "WebSocket connected" : "WebSocket disconnected"}>
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-jade animate-pulse" : "bg-crimson"}`} />
          <span className="text-frost/30 text-[10px] font-mono">{wsConnected ? "Live" : "Offline"}</span>
        </div>

        {/* Alert badge */}
        {pendingCount > 0 && (
          <button
            onClick={() => navigate("/alerts")}
            className="relative flex items-center gap-1.5 text-frost/40 hover:text-frost/70 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2C5 2 3 4.5 3 7V10L1.5 12H14.5L13 10V7C13 4.5 11 2 8 2Z" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 12C6 13.1 6.9 14 8 14C9.1 14 10 13.1 10 12" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            <span className="bg-crimson text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center absolute -top-1 -right-1">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          </button>
        )}

        {/* Quick analyze CTA */}
        <button
          onClick={() => navigate("/analyzer")}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-grape/20 hover:bg-grape/30 border border-grape/30 rounded-lg text-orchid text-xs font-medium transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7.5 7.5L9.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Analyze
        </button>
      </div>
    </header>
  );
}