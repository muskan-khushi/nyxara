// src/components/layout/Sidebar.jsx
// Nyxara sidebar navigation — dark grape/orchid theme

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
];

export default function Sidebar({ collapsed = false, onToggle }) {
  const { user, logout } = useAuth();
  const { alerts } = useAlerts();
  const navigate = useNavigate();
  const location = useLocation();

  const pending = alerts.filter(a => !a.analystAction).length;

  return (
    <aside
      className={`flex flex-col h-screen bg-abyss border-r border-grape/15 transition-all duration-200 flex-shrink-0
        ${collapsed ? "w-14" : "w-56"}`}
    >
      {/* Logo */}
      <div className={`flex items-center border-b border-grape/15 py-4 ${collapsed ? "justify-center px-0" : "gap-2.5 px-4"}`}>
        <div className="w-7 h-7 rounded-lg bg-grape/25 border border-grape/40 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L12.5 4.25V10.75L7 14L1.5 10.75V4.25L7 1Z" stroke="#C084FC" strokeWidth="1.1" fill="none"/>
            <circle cx="7" cy="7" r="2" fill="#C084FC"/>
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="text-base font-bold leading-none">
              Nyx<span className="text-orchid">ara</span>
            </span>
            <p className="text-frost/25 text-[9px] leading-none mt-0.5 font-mono">Mule Detection AI</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV.map(group => (
          <div key={group.group}>
            {!collapsed && (
              <p className="text-frost/20 text-[9px] uppercase tracking-widest font-medium px-2 mb-1.5">
                {group.group}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center rounded-lg transition-all duration-150 group relative
                    ${collapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-2"}
                    ${isActive
                      ? "bg-grape/20 text-frost border border-grape/35 shadow-sm"
                      : "text-frost/50 hover:text-frost/80 hover:bg-grape/10 border border-transparent"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`text-sm flex-shrink-0 ${isActive ? "text-orchid" : ""}`}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className="text-xs font-medium truncate">{item.label}</span>
                      )}
                      {/* Badge */}
                      {item.badge && pending > 0 && (
                        <span className={`bg-crimson text-white text-[9px] font-bold rounded-full flex-shrink-0
                          ${collapsed
                            ? "absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center"
                            : "ml-auto px-1.5 py-0.5"
                          }`}
                        >
                          {pending > 99 ? "99+" : pending}
                        </span>
                      )}
                      {/* Collapsed tooltip */}
                      {collapsed && (
                        <span className="absolute left-12 bg-abyss border border-grape/30 text-frost/80 text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
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
      <div className="border-t border-grape/15 p-2 space-y-1">
        {/* Live indicator */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-jade animate-pulse flex-shrink-0" />
            <span className="text-frost/30 text-[10px] font-mono">AI Engine · Live</span>
          </div>
        )}

        {/* User */}
        <div className={`flex items-center rounded-lg hover:bg-grape/10 cursor-pointer transition-colors
          ${collapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-2"}`}
          title={collapsed ? `${user?.email} · ${user?.role}` : ""}
        >
          <div className="w-6 h-6 rounded-full bg-grape/30 border border-grape/40 flex items-center justify-center flex-shrink-0">
            <span className="text-orchid text-[9px] font-bold uppercase">
              {(user?.email || "A").charAt(0)}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-frost/70 text-[10px] font-medium truncate">{user?.email || "analyst@nyxara.ai"}</p>
              <p className="text-orchid/50 text-[9px] font-mono capitalize">{user?.role || "analyst"}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="text-frost/20 hover:text-frost/50 transition-colors p-0.5 ml-auto"
              title="Logout"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 6H10M8 4L10 6L8 8M7 2H2.5C2 2 1.5 2.5 1.5 3V9C1.5 9.5 2 10 2.5 10H7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className={`w-full flex items-center justify-center py-1.5 text-frost/20 hover:text-frost/50 transition-colors`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
          >
            <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}