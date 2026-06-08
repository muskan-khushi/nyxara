// src/components/layout/Navbar.jsx
import { Bell, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useAlerts } from "../../context/AlertContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { alerts, connected } = useAlerts();
  const unread = alerts.filter(a => !a.analystAction).length;

  return (
    <header className="h-14 bg-abyss border-b border-grape/20 flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        {connected
          ? <Wifi className="w-4 h-4 text-jade" />
          : <WifiOff className="w-4 h-4 text-crimson" />
        }
        <span className="text-xs text-frost/40">{connected ? "Live" : "Offline"}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Bell className="w-5 h-5 text-frost/60 hover:text-orchid cursor-pointer transition-colors" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-crimson rounded-full text-[10px] flex items-center justify-center font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-grape flex items-center justify-center text-xs font-bold">
            {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || "A"}
          </div>
          <span className="text-frost/70 text-sm">{user?.name || user?.email}</span>
        </div>

        <button onClick={logout} className="text-frost/40 hover:text-crimson text-sm transition-colors">
          Sign out
        </button>
      </div>
    </header>
  );
}
