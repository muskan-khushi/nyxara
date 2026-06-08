// src/components/dashboard/AlertFeed.jsx
const BADGE = {
  BLOCK:  "risk-badge-block",
  FLAG:   "risk-badge-flag",
  REVIEW: "risk-badge-review",
};

export default function AlertFeed({ alerts = [], maxItems = 20 }) {
  if (!alerts.length) {
    return <p className="text-frost/30 text-sm text-center py-8">No live alerts yet. Analyzing accounts will populate this feed.</p>;
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {alerts.slice(0, maxItems).map((a, i) => (
        <div key={a.alertId || i} className="flex items-start gap-3 bg-night/60 rounded-lg p-3 border border-grape/10 hover:border-grape/30 transition-colors">
          <span className={BADGE[a.decision] || "risk-badge-review"}>{a.decision}</span>
          <div className="flex-1 min-w-0">
            <p className="text-frost/80 text-sm font-mono truncate">{a.accountId}</p>
            <p className="text-frost/40 text-xs mt-0.5 line-clamp-1">{a.alertText}</p>
          </div>
          <span className="text-frost/30 text-xs font-mono flex-shrink-0">
            {a.riskScore ? (a.riskScore * 100).toFixed(0) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
