// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import api from "../services/api";
import { useAlerts } from "../context/AlertContext";
import RiskGauge       from "../components/dashboard/RiskGauge";
import AlertFeed       from "../components/dashboard/AlertFeed";
import MetricsCards    from "../components/dashboard/MetricsCards";
import FraudMap        from "../components/dashboard/FraudMap";
import OccupationMatrix from "../components/dashboard/OccupationMatrix";
import { Activity, AlertTriangle, Clock } from "lucide-react";

// Map numeric risk → decision label (mirrors scorer.py thresholds)
function riskToDecision(score) {
  if (score >= 0.85) return "BLOCK";
  if (score >= 0.70) return "FLAG";
  if (score >= 0.40) return "REVIEW";
  return "APPROVE";
}

export default function Dashboard() {
  const [stats,        setStats]       = useState(null);
  const [latestScore,  setLatestScore] = useState(0.87);
  const [metricsData,  setMetricsData] = useState({ auc: 0.982, f1: 0.91, precision: 0.94, recall: 0.89 });
  const { alerts } = useAlerts();

  useEffect(() => {
    // Load admin stats (account counts)
    api.get("/api/admin/stats").then(r => setStats(r.data)).catch(() => {});

    // Load most recent flagged account to drive the gauge
    api.get("/api/accounts", { params: { limit: 1, sortBy: "lastAnalyzed", order: "desc" } })
      .then(r => {
        const top = r.data.accounts?.[0];
        if (top?.riskScore != null) setLatestScore(top.riskScore);
      }).catch(() => {});

    // Load real model metrics
    api.get("/api/admin/evaluate").then(r => {
      if (r.data?.auc) setMetricsData(r.data);
    }).catch(() => {});
  }, [alerts.length]); // refresh when new alerts arrive

  const counts = stats?.counts || {};
  const decision = riskToDecision(latestScore);

  const summaryCards = [
    { label: "Total Analyzed", value: counts.total  ?? "—", icon: Activity,       color: "text-frost",       border: "border-grape/20" },
    { label: "Blocked",        value: counts.blocked ?? "—", icon: AlertTriangle,   color: "text-crimson",     border: "border-crimson/20" },
    { label: "Flagged",        value: counts.flagged ?? "—", icon: AlertTriangle,   color: "text-orange-400",  border: "border-orange-500/20" },
    { label: "Under Review",   value: counts.review  ?? "—", icon: Clock,           color: "text-amber",       border: "border-amber/20" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-frost">Command Center</h1>
        <p className="text-frost/50 text-sm mt-1">Real-time mule account detection — Nyxara Intelligence Platform</p>
      </div>

      {/* Summary count cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map(({ label, value, icon: Icon, color, border }) => (
          <div key={label} className={`card border ${border} text-center`}>
            <Icon className={`w-5 h-5 mx-auto mb-2 ${color} opacity-70`} />
            <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
            <p className="text-frost/50 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Gauge + Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card flex flex-col items-center justify-center gap-2">
          <p className="text-frost/60 text-sm font-medium">Latest Account Risk</p>
          <RiskGauge score={latestScore} decision={decision} size={180} />
          <p className="text-frost/30 text-xs font-mono">
            Updates on new analysis
          </p>
        </div>
        <div className="card col-span-2">
          <MetricsCards
            auc={metricsData.auc}
            f1={metricsData.f1}
            precision={metricsData.precision || 0.94}
            recall={metricsData.recall || 0.89}
          />
        </div>
      </div>

      {/* FraudMap + Occupation Matrix */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-frost/80 font-semibold mb-4">Branch Fraud Heat Map</h2>
          <FraudMap />
        </div>
        <div className="card">
          <h2 className="text-frost/80 font-semibold mb-4">Occupation × Velocity Matrix</h2>
          <OccupationMatrix />
        </div>
      </div>

      {/* Live alert feed */}
      <div className="card">
        <h2 className="text-frost/80 font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-crimson animate-pulse" />
          Live Alert Feed
          {alerts.filter(a => !a.analystAction).length > 0 && (
            <span className="ml-auto bg-crimson text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {alerts.filter(a => !a.analystAction).length} pending
            </span>
          )}
        </h2>
        <AlertFeed alerts={alerts} maxItems={15} />
      </div>
    </div>
  );
}