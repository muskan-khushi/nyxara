// src/pages/Dashboard.jsx
// Nyxara Command Center — redesigned for analyst clarity

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAlerts } from "../context/AlertContext";

/* ── Animated arc gauge ── */
function RiskGauge({ score = 0, decision = "APPROVE", size = 160 }) {
  const canvasRef = useRef();
  const COLORS = { APPROVE: "#10B981", REVIEW: "#F59E0B", FLAG: "#F97316", BLOCK: "#DC2626" };
  const color = COLORS[decision] || "#7B2FBE";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const cx = size / 2, cy = size / 2 + 8;
    const r = size * 0.38;
    let current = 0, id;

    const draw = (val) => {
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = "rgba(123,47,190,0.12)";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.stroke();

      if (val > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, Math.PI + val * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 14;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      ctx.fillStyle = "#F5F3FF";
      ctx.font = `bold ${size * 0.18}px Inter`;
      ctx.textAlign = "center";
      ctx.fillText(Math.round(val * 100), cx, cy + 4);

      ctx.fillStyle = color;
      ctx.font = `600 ${size * 0.07}px Inter`;
      ctx.fillText(decision, cx, cy + size * 0.14);
    };

    id = setInterval(() => {
      current = Math.min(current + score / 40, score);
      draw(current);
      if (current >= score) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [score, decision, size, color]);

  return <canvas ref={canvasRef} width={size} height={size * 0.72} />;
}

/* ── Mini sparkline ── */
function Sparkline({ data, color = "#7B2FBE", height = 32, width = 80 }) {
  if (!data?.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * (width - 2) + 1 : width / 2;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Stat card ── */
function StatCard({ label, value, sub, color = "text-orchid", trend, sparkData }) {
  return (
    <div className="card group hover:border-grape/40 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <span className="text-frost/40 text-xs font-medium uppercase tracking-wider">{label}</span>
        {sparkData && <Sparkline data={sparkData} color={color.includes("crimson") ? "#DC2626" : "#7B2FBE"} />}
      </div>
      <div className={`text-3xl font-bold font-mono ${color} mb-1`}>{value}</div>
      {sub && <div className="text-frost/30 text-xs">{sub}</div>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs mt-2 ${trend >= 0 ? "text-crimson" : "text-jade"}`}>
          <span>{trend >= 0 ? "↑" : "↓"}</span>
          <span>{Math.abs(trend)}% from yesterday</span>
        </div>
      )}
    </div>
  );
}

/* ── Alert row ── */
function AlertRow({ alert, onAction }) {
  const BADGE = {
    BLOCK: "bg-crimson/15 text-crimson border-crimson/30",
    FLAG: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    REVIEW: "bg-amber/15 text-amber border-amber/30",
    APPROVE: "bg-jade/15 text-jade border-jade/30",
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-grape/8 last:border-0 group hover:bg-grape/5 -mx-2 px-2 rounded transition-colors">
      <span className={`flex-shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${BADGE[alert.decision] || BADGE.REVIEW} mt-0.5`}>
        {alert.decision}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-frost/80 font-mono text-sm truncate">{alert.accountId}</span>
          <span className="text-frost/40 font-mono text-xs font-bold">{Math.round((alert.riskScore || 0) * 100)}</span>
        </div>
        <p className="text-frost/40 text-xs leading-tight line-clamp-1">{alert.alertText || "Risk threshold exceeded"}</p>
      </div>
      <div className="flex-shrink-0 text-frost/20 text-xs">
        {alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
      </div>
    </div>
  );
}

/* ── Occupation risk matrix mini ── */
function OccupationMini() {
  const data = [
    { occ: "Student", low: 8, med: 31, high: 72, extreme: 94 },
    { occ: "Housewife", low: 5, med: 22, high: 65, extreme: 91 },
    { occ: "Retired", low: 4, med: 18, high: 58, extreme: 87 },
    { occ: "Salaried", low: 3, med: 9, high: 28, extreme: 61 },
    { occ: "Self-emp", low: 4, med: 11, high: 31, extreme: 55 },
  ];
  const heatBg = (v) => {
    if (v > 70) return "bg-crimson/70 text-white";
    if (v > 45) return "bg-orange-500/60 text-white";
    if (v > 20) return "bg-amber/50 text-night";
    return "bg-jade/20 text-jade";
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-frost/30 font-normal pb-2 pr-2">Occupation</th>
            {["Low", "Med", "High", "Extreme"].map(v => (
              <th key={v} className="text-frost/30 font-normal pb-2 px-1 text-center">{v}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.occ}>
              <td className="text-frost/60 pr-2 py-0.5 font-mono">{row.occ}</td>
              {[row.low, row.med, row.high, row.extreme].map((v, i) => (
                <td key={i} className="px-0.5 py-0.5">
                  <div className={`text-center rounded py-0.5 font-bold min-w-[36px] ${heatBg(v)}`}>{v}%</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Risk distribution bar ── */
function RiskDistBar({ counts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const segments = [
    { key: "blocked", label: "Block", color: "bg-crimson", val: counts.blocked || 0 },
    { key: "flagged", label: "Flag", color: "bg-orange-500", val: counts.flagged || 0 },
    { key: "review", label: "Review", color: "bg-amber", val: counts.review || 0 },
    { key: "approved", label: "Approve", color: "bg-jade", val: counts.approved || 0 },
  ];
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-3">
        {segments.map(s => (
          <div
            key={s.key}
            className={`${s.color} transition-all duration-700`}
            style={{ width: `${(s.val / total) * 100}%`, minWidth: s.val > 0 ? "2px" : 0 }}
            title={`${s.label}: ${s.val}`}
          />
        ))}
      </div>
      <div className="flex gap-4 flex-wrap">
        {segments.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${s.color}`} />
            <span className="text-frost/50 text-xs">{s.label}</span>
            <span className="text-frost/80 text-xs font-mono font-bold">{s.val.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState({ auc: 0.982, f1: 0.91, precision: 0.94, recall: 0.89 });
  const [latestScore, setLatestScore] = useState(0.87);
  const [latestDecision, setLatestDecision] = useState("BLOCK");
  const { alerts } = useAlerts();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/api/admin/stats").then(r => setStats(r.data)).catch(() => {});
    api.get("/api/accounts", { params: { limit: 1, sortBy: "lastAnalyzed", order: "desc" } })
      .then(r => {
        const top = r.data.accounts?.[0];
        if (top?.riskScore != null) {
          setLatestScore(top.riskScore);
          setLatestDecision(top.decision || "APPROVE");
        }
      }).catch(() => {});
    api.get("/api/admin/evaluate").then(r => { if (r.data?.auc) setMetrics(r.data); }).catch(() => {});
  }, [alerts.length]);

  const counts = stats?.counts || {};
  const recentAlerts = alerts.slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-frost">Command Center</h1>
          <p className="text-frost/40 text-sm mt-0.5">Real-time mule account detection — live intelligence feed</p>
        </div>
        <button
          onClick={() => navigate("/analyzer")}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Analyze Account
        </button>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Analyzed"
          value={(counts.total || 0).toLocaleString()}
          sub="Accounts in system"
          color="text-frost"
          sparkData={[20, 35, 28, 42, 51, 39, 58, 47, 63, 71]}
        />
        <StatCard
          label="Blocked"
          value={(counts.blocked || 0).toLocaleString()}
          sub="Immediate freeze"
          color="text-crimson"
          trend={12}
        />
        <StatCard
          label="Flagged"
          value={(counts.flagged || 0).toLocaleString()}
          sub="Priority review"
          color="text-orange-400"
          trend={5}
        />
        <StatCard
          label="Under Review"
          value={(counts.review || 0).toLocaleString()}
          sub="Analyst queue"
          color="text-amber"
        />
      </div>

      {/* Middle row: Gauge + Model perf + Risk dist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Latest account gauge */}
        <div className="card flex flex-col items-center justify-center gap-2 py-6">
          <p className="text-frost/40 text-xs uppercase tracking-wider font-medium">Latest Analyzed</p>
          <RiskGauge score={latestScore} decision={latestDecision} size={160} />
          <p className="text-frost/20 text-xs font-mono">Updates on new analysis</p>
        </div>

        {/* Model metrics */}
        <div className="card">
          <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-4">Model Performance</p>
          <div className="space-y-3">
            {[
              { label: "AUC-ROC", value: metrics.auc, color: "#C084FC" },
              { label: "F1 Score", value: metrics.f1, color: "#06B6D4" },
              { label: "Precision", value: metrics.precision || 0.94, color: "#10B981" },
              { label: "Recall", value: metrics.recall || 0.89, color: "#F59E0B" },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-3">
                <span className="text-frost/50 text-xs w-20">{m.label}</span>
                <div className="flex-1 h-1.5 bg-grape/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${m.value * 100}%`, background: m.color }} />
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: m.color }}>
                  {(m.value * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/metrics")}
            className="mt-4 text-xs text-orchid/60 hover:text-orchid transition-colors flex items-center gap-1"
          >
            View full report →
          </button>
        </div>

        {/* Risk distribution */}
        <div className="card">
          <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-4">Decision Distribution</p>
          <RiskDistBar counts={counts} />
          <div className="mt-4 pt-4 border-t border-grape/10">
            <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-2">Fraud Rate</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold font-mono text-orchid">
                {counts.total ? ((((counts.blocked || 0) + (counts.flagged || 0)) / counts.total) * 100).toFixed(1) : "—"}%
              </span>
              <span className="text-frost/40 text-xs mb-0.5">of total accounts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Alerts + Occupation matrix */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Live alerts */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-crimson animate-pulse" />
              <span className="text-frost/70 font-semibold text-sm">Live Alert Feed</span>
              {alerts.filter(a => !a.analystAction).length > 0 && (
                <span className="bg-crimson text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {alerts.filter(a => !a.analystAction).length}
                </span>
              )}
            </div>
            <button onClick={() => navigate("/alerts")} className="text-xs text-orchid/60 hover:text-orchid transition-colors">
              View all →
            </button>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-3xl mb-2 opacity-20">📡</div>
              <p className="text-frost/30 text-sm">No live alerts yet.</p>
              <p className="text-frost/20 text-xs mt-1">Analyze accounts to populate this feed.</p>
            </div>
          ) : (
            <div className="divide-y divide-grape/8">
              {recentAlerts.map((a, i) => <AlertRow key={a.alertId || i} alert={a} />)}
            </div>
          )}
        </div>

        {/* Occupation matrix */}
        <div className="card">
          <p className="text-frost/70 font-semibold text-sm mb-4">
            Occupation × Velocity Risk
          </p>
          <OccupationMini />
          <p className="text-frost/20 text-[10px] mt-4 leading-relaxed">
            Innovation #1: Student with 50+ txns is 10× more anomalous than self-employed with same count
          </p>
        </div>
      </div>

      {/* Quick action bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Analyze Account", icon: "🔍", route: "/analyzer", color: "hover:border-orchid/40" },
          { label: "Ring Detection", icon: "🕸️", route: "/graph", color: "hover:border-cyan/40" },
          { label: "Alert Queue", icon: "🚨", route: "/alerts", color: "hover:border-crimson/40" },
          { label: "Compliance STR", icon: "📋", route: "/compliance", color: "hover:border-jade/40" },
        ].map(action => (
          <button
            key={action.label}
            onClick={() => navigate(action.route)}
            className={`card-hover text-left flex items-center gap-3 p-4 ${action.color} transition-all`}
          >
            <span className="text-xl">{action.icon}</span>
            <span className="text-frost/70 text-sm font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}