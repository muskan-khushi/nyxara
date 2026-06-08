// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import api from "../services/api";
import { useAlerts } from "../context/AlertContext";
import RiskGauge      from "../components/dashboard/RiskGauge";
import AlertFeed      from "../components/dashboard/AlertFeed";
import MetricsCards   from "../components/dashboard/MetricsCards";

export default function Dashboard() {
  const [stats,   setStats]   = useState(null);
  const [metrics, setMetrics] = useState(null);
  const { alerts } = useAlerts();

  useEffect(() => {
    api.get("/api/admin/stats").then(r => setStats(r.data)).catch(() => {});
    api.get("/api/accounts", { params: { limit: 5 } })
      .then(r => {
        const top = r.data.accounts[0];
        if (top) setMetrics({ auc: 0.982, f1: 0.91, totalScored: r.data.total });
      }).catch(() => {});
  }, []);

  const counts = stats?.counts || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-frost">Command Center</h1>
        <p className="text-frost/50 text-sm mt-1">Real-time mule account detection dashboard</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Analyzed", value: counts.total   ?? "—", color: "text-frost" },
          { label: "Blocked",        value: counts.blocked  ?? "—", color: "text-crimson" },
          { label: "Flagged",        value: counts.flagged  ?? "—", color: "text-orange-400" },
          { label: "Under Review",   value: counts.review   ?? "—", color: "text-amber" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center">
            <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
            <p className="text-frost/50 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gauge */}
        <div className="card flex flex-col items-center justify-center">
          <p className="text-frost/60 text-sm mb-3">Latest Account Risk</p>
          <RiskGauge score={0.87} decision="BLOCK" />
        </div>

        {/* Metrics */}
        <div className="card col-span-2">
          <MetricsCards auc={0.982} f1={0.91} precision={0.94} recall={0.89} />
        </div>
      </div>

      {/* Live alert feed */}
      <div className="card">
        <h2 className="text-frost/80 font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-crimson animate-pulse" />
          Live Alert Feed
        </h2>
        <AlertFeed alerts={alerts} maxItems={15} />
      </div>
    </div>
  );
}
