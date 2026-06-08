// src/pages/Alerts.jsx
import { useEffect, useState } from "react";
import api from "../services/api";
import { useAlerts } from "../context/AlertContext";

const BADGE = { BLOCK: "risk-badge-block", FLAG: "risk-badge-flag", REVIEW: "risk-badge-review" };

export default function Alerts() {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");
  const { alerts: live } = useAlerts();

  useEffect(() => {
    api.get("/api/alerts", { params: { limit: 50 } })
      .then(r => setAlerts(r.data.alerts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [live.length]);

  async function takeAction(alertId, action) {
    await api.patch(`/api/alerts/${alertId}/action`, { action });
    setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, analystAction: action } : a));
  }

  const filtered = filter === "all" ? alerts : alerts.filter(a =>
    filter === "pending" ? !a.analystAction : a.analystAction === filter
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-frost">Alerts</h1>
        <div className="flex gap-2">
          {["all","pending","confirmed","dismissed","escalated"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${filter === f ? "bg-grape text-white" : "bg-abyss text-frost/50 hover:text-frost border border-grape/20"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-frost/40 text-sm">Loading alerts...</p>}

      <div className="space-y-2">
        {filtered.map(alert => (
          <div key={alert._id} className="card-hover flex items-start gap-4">
            <span className={BADGE[alert.decision] || "risk-badge-review"}>{alert.decision}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-frost/80 font-mono text-sm">{alert.accountId}</span>
                <span className="text-frost/30 text-xs">{new Date(alert.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-frost/50 text-xs mt-1 line-clamp-2">{alert.alertText}</p>
            </div>
            <span className="text-frost/50 font-mono text-sm">{((alert.riskScore || 0) * 100).toFixed(0)}</span>
            {!alert.analystAction && (
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => takeAction(alert._id, "confirmed")} className="text-xs px-2 py-1 bg-crimson/20 text-crimson border border-crimson/30 rounded hover:bg-crimson/30">Confirm</button>
                <button onClick={() => takeAction(alert._id, "dismissed")} className="text-xs px-2 py-1 bg-jade/10 text-jade border border-jade/30 rounded hover:bg-jade/20">Dismiss</button>
                <button onClick={() => takeAction(alert._id, "escalated")} className="text-xs px-2 py-1 bg-amber/10 text-amber border border-amber/30 rounded hover:bg-amber/20">Escalate</button>
              </div>
            )}
            {alert.analystAction && (
              <span className="text-frost/30 text-xs flex-shrink-0 font-medium">{alert.analystAction}</span>
            )}
          </div>
        ))}
        {!loading && !filtered.length && (
          <p className="text-frost/30 text-sm text-center py-8">No alerts match this filter.</p>
        )}
      </div>
    </div>
  );
}
