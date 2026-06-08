// src/components/layout/Sidebar.jsx
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Search, Share2, Bell, Shield, BarChart2 } from "lucide-react";

const NAV = [
  { to: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { to: "/analyzer",   icon: Search,          label: "Analyzer" },
  { to: "/graph",      icon: Share2,          label: "Graph View" },
  { to: "/alerts",     icon: Bell,            label: "Alerts" },
  { to: "/compliance", icon: Shield,          label: "Compliance" },
  { to: "/metrics",    icon: BarChart2,       label: "Metrics" },
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-abyss border-r border-grape/20 flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-grape/20">
        <span className="text-xl font-bold text-frost">
          Nyx<span className="text-orchid">ara</span>
        </span>
        <span className="ml-2 text-[10px] text-grape/60 font-mono border border-grape/30 rounded px-1">v1.0</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-grape/20 text-orchid border border-grape/40"
                  : "text-frost/60 hover:text-frost hover:bg-grape/10"
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-grape/20">
        <p className="text-[10px] text-frost/20 text-center font-mono">
          "Where others see transactions,<br />Nyxara reads the shadow network."
        </p>
      </div>
    </aside>
  );
}
