// src/pages/Alerts.jsx
// Alert queue with real-time WebSocket updates and analyst action workflow

import { useEffect, useState } from "react";
import api from "../services/api";
import { useAlerts } from "../context/AlertContext";

const DECISION_STYLE = {
  BLOCK:  { pill: "bg-crimson/15 text-crimson border-crimson/30", dot: "bg-crimson" },
  FLAG:   { pill: "bg-orange-500/15 text-orange-400 border-orange-500/30", dot: "bg-orange-400" },
  REVIEW: { pill: "bg-amber/15 text-amber border-amber/30", dot: "bg-amber" },
  APPROVE:{ pill: "bg-jade/15 text-jade border-jade/30", dot: "bg-jade" },
};

const ACTION_STYLE = {
  confirmed:  "text-crimson bg-crimson/10 border-crimson/30",
  escalated:  "text-amber bg-amber/10 border-amber/30",
  dismissed:  "text-frost/40 bg-frost/5 border-frost/15",
};

function TimeAgo({ date }) {
  if (!date) return null;
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  let label = "";
  if (mins < 2) label = "just now";
  else if (mins < 60) label = `${mins}m ago`;
  else if (hours < 24) label = `${hours}h ago`;
  else label = `${days}d ago`;
  return <span className="text-frost/30 text-xs">{label}</span>;
}

function AlertCard({ alert, onAction, isSelected, onSelect }) {
  const ds = DECISION_STYLE[alert.decision] || DECISION_STYLE.REVIEW;
  const [actioning, setActioning] = useState(false);

  async function doAction(action) {
    setActioning(true);
    try {
      await api.patch(`/api/alerts/${alert._id}/action`, { action });
      onAction(alert._id, action);
    } catch (e) {
      console.error("Action failed:", e);
    } finally {
      setActioning(false);
    }
  }

  return (
    <div
      onClick={() => onSelect(alert._id)}
      className={`group relative p-4 rounded-xl border cursor-pointer transition-all duration-200 
        ${isSelected
          ? "border-grape/60 bg-grape/8 shadow-lg shadow-grape/10"
          : "border-grape/15 bg-abyss/40 hover:border-grape/35 hover:bg-abyss/70"
        }`}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute left-0 top-4 bottom-4 w-0.5 bg-grape rounded-r" />
      )}

      <div className="flex items-start gap-3">
        {/* Decision indicator */}
        <div className="flex-shrink-0 mt-0.5">
          <div className={`w-2 h-2 rounded-full ${ds.dot} ${!alert.analystAction ? "animate-pulse" : ""}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${ds.pill}`}>
              {alert.decision}
            </span>
            <span className="text-frost/80 font-mono text-sm font-semibold truncate">{alert.accountId}</span>
            <span className="text-frost/50 font-mono text-xs font-bold">
              {Math.round((alert.riskScore || 0) * 100)}
            </span>
            {alert.ringMembership && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-crimson/10 border border-crimson/20 text-crimson font-mono">
                Ring
              </span>
            )}
          </div>

          {/* Alert text */}
          <p className="text-frost/50 text-xs leading-relaxed line-clamp-2 mb-2">
            {alert.alertText || "Risk threshold exceeded — review required."}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <TimeAgo date={alert.createdAt} />
            {alert.analystAction ? (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${ACTION_STYLE[alert.analystAction] || ""}`}>
                {alert.analystAction}
              </span>
            ) : (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => doAction("confirmed")}
                  disabled={actioning}
                  className="text-[10px] px-2 py-0.5 rounded bg-crimson/15 text-crimson border border-crimson/25 hover:bg-crimson/25 transition-colors disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => doAction("dismissed")}
                  disabled={actioning}
                  className="text-[10px] px-2 py-0.5 rounded bg-jade/10 text-jade border border-jade/25 hover:bg-jade/20 transition-colors disabled:opacity-50"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => doAction("escalated")}
                  disabled={actioning}
                  className="text-[10px] px-2 py-0.5 rounded bg-amber/10 text-amber border border-amber/25 hover:bg-amber/20 transition-colors disabled:opacity-50"
                >
                  Escalate
                </button>
              </div>
            )}
          </div>

          {/* Cyber flags */}
          {alert.cyberFlags?.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              {alert.cyberFlags.slice(0, 3).map((f, i) => (
                <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-grape/10 text-orchid/60 border border-grape/15">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Detail panel ── */
function AlertDetail({ alert }) {
  if (!alert) return (
    <div className="card flex flex-col items-center justify-center h-full py-20 text-center">
      <div className="text-3xl mb-3 opacity-20">📋</div>
      <p className="text-frost/30 text-sm">Select an alert to view details</p>
    </div>
  );

  const ds = DECISION_STYLE[alert.decision] || DECISION_STYLE.REVIEW;

  return (
    <div className="card space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${ds.pill}`}>
            {alert.decision}
          </span>
          <span className="text-frost/80 font-mono font-semibold">{alert.accountId}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Risk score bar */}
          <div className="flex-1 h-2 bg-grape/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(alert.riskScore || 0) * 100}%`,
                background: alert.riskScore >= 0.85 ? "#DC2626" : alert.riskScore >= 0.70 ? "#F97316" : alert.riskScore >= 0.40 ? "#F59E0B" : "#10B981",
              }}
            />
          </div>
          <span className="text-frost/70 font-mono font-bold text-sm">
            {Math.round((alert.riskScore || 0) * 100)}
          </span>
        </div>
      </div>

      {/* Alert text */}
      <div>
        <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-2">Compliance Narrative</p>
        <p className="text-frost/70 text-sm leading-relaxed">{alert.alertText || "No narrative available."}</p>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {[
          { label: "Created", value: alert.createdAt ? new Date(alert.createdAt).toLocaleString() : "—" },
          { label: "Action", value: alert.analystAction || "Pending" },
          { label: "Ring Member", value: alert.ringMembership ? "Yes" : "No" },
          { label: "Analyst", value: alert.analystId || "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-night/50 rounded-lg p-2.5">
            <p className="text-frost/30 mb-0.5">{label}</p>
            <p className="text-frost/70 font-mono">{value}</p>
          </div>
        ))}
      </div>

      {/* Analyst note */}
      {alert.analystNote && (
        <div>
          <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-2">Analyst Note</p>
          <p className="text-frost/60 text-sm bg-night/40 rounded-lg p-3 border border-grape/10">
            {alert.analystNote}
          </p>
        </div>
      )}

      {/* Cyber flags detail */}
      {alert.cyberFlags?.length > 0 && (
        <div>
          <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-2">BEI Cyber Flags</p>
          <div className="space-y-1">
            {alert.cyberFlags.map((f, i) => (
              <div key={i} className="text-xs font-mono text-orchid/70 bg-grape/10 rounded px-2.5 py-1.5 border border-grape/15">
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigate to compliance */}
      {alert.decision !== "APPROVE" && (
        <div className="pt-3 border-t border-grape/10">
          <a href="/compliance" className="text-xs text-orchid hover:text-orchid/80 flex items-center gap-1 transition-colors">
            Generate STR draft →
          </a>
        </div>
      )}
    </div>
  );
}

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "BLOCK", label: "Blocked" },
  { key: "FLAG", label: "Flagged" },
  { key: "REVIEW", label: "Review" },
  { key: "confirmed", label: "Confirmed" },
  { key: "dismissed", label: "Dismissed" },
  { key: "escalated", label: "Escalated" },
];

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const { alerts: live } = useAlerts();

  useEffect(() => {
    api.get("/api/alerts", { params: { limit: 60 } })
      .then(r => setAlerts(r.data.alerts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [live.length]);

  function handleAction(id, action) {
    setAlerts(prev => prev.map(a => a._id === id ? { ...a, analystAction: action } : a));
  }

  const filtered = alerts.filter(a => {
    if (filter === "all") return true;
    if (filter === "pending") return !a.analystAction;
    if (["BLOCK", "FLAG", "REVIEW"].includes(filter)) return a.decision === filter;
    return a.analystAction === filter;
  });

  const selected = alerts.find(a => a._id === selectedId);

  const counts = {
    pending: alerts.filter(a => !a.analystAction).length,
    block: alerts.filter(a => a.decision === "BLOCK").length,
    flag: alerts.filter(a => a.decision === "FLAG").length,
  };

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-frost">Alert Queue</h1>
          <p className="text-frost/40 text-sm mt-0.5">
            {counts.pending > 0
              ? `${counts.pending} alerts pending analyst review`
              : "All alerts reviewed — queue clear"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {counts.block > 0 && (
            <span className="text-xs font-mono px-2 py-1 rounded bg-crimson/15 border border-crimson/30 text-crimson">
              {counts.block} BLOCK
            </span>
          )}
          {counts.flag > 0 && (
            <span className="text-xs font-mono px-2 py-1 rounded bg-orange-500/15 border border-orange-500/30 text-orange-400">
              {counts.flag} FLAG
            </span>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f.key
                ? "bg-grape text-white shadow"
                : "bg-abyss border border-grape/20 text-frost/50 hover:text-frost hover:border-grape/40"
            }`}
          >
            {f.label}
            {f.key === "pending" && counts.pending > 0 && (
              <span className="ml-1.5 bg-crimson text-white text-[9px] px-1 rounded-full">{counts.pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 flex-1 min-h-0">
        {/* Alert list */}
        <div className="xl:col-span-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
          {loading && (
            <div className="text-center py-10">
              <div className="text-frost/30 text-sm animate-pulse">Loading alerts…</div>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="card text-center py-12">
              <div className="text-3xl mb-2 opacity-20">✓</div>
              <p className="text-frost/30 text-sm">No alerts match this filter.</p>
            </div>
          )}
          {filtered.map(a => (
            <AlertCard
              key={a._id}
              alert={a}
              onAction={handleAction}
              isSelected={selectedId === a._id}
              onSelect={setSelectedId}
            />
          ))}
        </div>

        {/* Detail pane */}
        <div className="xl:col-span-3 overflow-y-auto max-h-[calc(100vh-280px)]">
          <AlertDetail alert={selected} />
        </div>
      </div>
    </div>
  );
}