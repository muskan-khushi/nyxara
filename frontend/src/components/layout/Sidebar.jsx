// src/components/layout/Sidebar.jsx
// Nyxara premium sidebar navigation — glassmorphism & gradients

import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAlerts } from "../../context/AlertContext";

const NAV = [
  {
    group: "Intelligence",
    items: [
      { to: "/dashboard", label: "Command Center", icon: "⬡" },
      { to: "/analyzer", label: "Account Analyzer", icon: "◎" },
      { to: "/graph", label: "Graph Intelligence", icon: "⬡" },
    ],
  },
  {
    group: "Operations",
    items: [
      { to: "/alerts", label: "Alert Queue", icon: "◈", badge: true },
      { to: "/compliance", label: "Compliance & STR", icon: "◧" },
      { to: "/metrics", label: "Model Performance", icon: "◐" },
    ],
  },
  {
    group: "Innovations",
    items: [
      { to: "/replay",  label: "Attack Replay",  icon: "🎬", isNew: true },
      { to: "/atlas",   label: "Risk Atlas",      icon: "🗺",  isNew: true },
      { to: "/cockpit", label: "Analyst Cockpit", icon: "🛰",  isNew: true },
    ],
  },
];

export default function Sidebar({ collapsed = false, onToggle }) {
  const { user, logout } = useAuth();
  const { alerts } = useAlerts();
  const pending = alerts.filter(a => !a.analystAction).length;

  return (
    <aside
      className={`flex flex-col h-screen bg-black/20 border-r border-white/5 backdrop-blur-xl transition-all duration-300 flex-shrink-0 relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.2)]
        ${collapsed ? "w-16" : "w-64"}`}
    >
      {/* Logo */}
      <div className={`flex items-center py-6 ${collapsed ? "justify-center px-0" : "gap-3 px-6"}`}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-grape/40 to-orchid/10 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(124,58,237,0.3)] relative overflow-hidden">
          <div className="absolute inset-0 bg-white/20 blur-md rounded-full -top-4 -left-4 w-6 h-6 animate-pulse-slow"></div>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" className="relative z-10">
            <path d="M7 1L12.5 4.25V10.75L7 14L1.5 10.75V4.25L7 1Z" stroke="url(#logo-grad)" strokeWidth="1.2" fill="none"/>
            <circle cx="7" cy="7" r="2" fill="#C084FC"/>
            <defs>
              <linearGradient id="logo-grad" x1="1" y1="1" x2="13" y2="13" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F8FAFC" />
                <stop offset="1" stopColor="#C084FC" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="text-xl font-display font-bold leading-none tracking-tight text-white">
              Nyx<span className="text-gradient">ara</span>
            </span>
            <p className="text-orchid/60 text-[10px] leading-none mt-1 font-mono tracking-widest uppercase">Mule AI</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-6">
        {NAV.map((group, gIdx) => (
          <div key={group.group} className={`animate-fade-in delay-${(gIdx+1)*100}`}>
            {!collapsed && (
              <p className="text-white/30 text-[10px] uppercase tracking-[0.2em] font-bold px-3 mb-2">
                {group.group}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center rounded-xl transition-all duration-300 group relative overflow-hidden
                    ${collapsed ? "justify-center p-2.5 mx-auto w-10 h-10" : "gap-3 px-3 py-2.5"}
                    ${isActive
                      ? "bg-white/10 text-white border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_12px_rgba(0,0,0,0.2)]"
                      : "text-frost/50 hover:text-white hover:bg-white/5 border border-transparent"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Active indicator bar */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-gradient-to-b from-cyan to-orchid rounded-r-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                      )}
                      
                      <span className={`text-base flex-shrink-0 transition-transform duration-300 ${isActive ? "text-cyan scale-110" : "group-hover:scale-110"}`}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className={`text-sm font-medium truncate ${isActive ? "text-white" : ""}`}>{item.label}</span>
                      )}
                      
                      {/* Alert badge */}
                      {item.badge && pending > 0 && (
                        <span className={`bg-gradient-to-r from-crimson to-orange text-white text-[9px] font-bold rounded-full flex-shrink-0 shadow-[0_0_10px_rgba(225,29,72,0.4)]
                          ${collapsed
                            ? "absolute top-0 right-0 w-3.5 h-3.5 flex items-center justify-center border border-night"
                            : "ml-auto px-1.5 py-0.5"
                          }`}
                        >
                          {pending > 99 ? "99+" : pending}
                        </span>
                      )}
                      
                      {/* NEW badge */}
                      {item.isNew && !collapsed && (
                        <span className="ml-auto text-[8px] font-mono font-black px-1.5 py-0.5 rounded-md bg-orchid/20 border border-orchid/30 text-orchid leading-none flex-shrink-0 backdrop-blur-sm shadow-[0_0_8px_rgba(192,132,252,0.2)]">
                          NEW
                        </span>
                      )}
                      
                      {/* Collapsed tooltip */}
                      {collapsed && (
                        <span className="absolute left-14 bg-black/80 backdrop-blur-md border border-white/10 text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-xl font-medium">
                          {item.label}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom — status + user */}
      <div className="border-t border-white/5 p-3 space-y-2 bg-black/20">
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5 shadow-inner backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-jade shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse flex-shrink-0" />
            {/* <span className="text-frost/60 text-[10px] font-mono tracking-wide">SYSTEM <span className="text-jade font-bold">ONLINE</span></span> */}
          </div>
        )}

        {/* User profile */}
        <div className={`flex items-center rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5
          ${collapsed ? "justify-center p-2.5 mx-auto w-10 h-10" : "gap-3 px-3 py-2"}`}
          title={collapsed ? `${user?.email} · ${user?.role}` : ""}
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate to-night border border-white/20 flex items-center justify-center flex-shrink-0 shadow-inner">
            <span className="text-white text-[10px] font-bold uppercase">
              {(user?.email || "A").charAt(0)}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-[11px] font-medium truncate">{user?.email || "analyst@nyxara.ai"}</p>
              <p className="text-cyan/70 text-[9px] font-mono capitalize">{user?.role || "Lead Investigator"}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={logout} className="text-frost/30 hover:text-crimson transition-colors p-1 ml-auto" title="Logout">
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                <path d="M4 6H10M8 4L10 6L8 8M7 2H2.5C2 2 1.5 2.5 1.5 3V9C1.5 9.5 2 10 2.5 10H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className={`w-full flex items-center justify-center py-2 text-frost/30 hover:text-white transition-colors hover:bg-white/5 rounded-lg`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}