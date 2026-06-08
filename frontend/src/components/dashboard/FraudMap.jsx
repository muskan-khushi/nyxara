// src/components/dashboard/FraudMap.jsx
// Branch-code heat map: F3889 branch → fraud rate.
// Shows which bank branches are hotspots for mule account activity.

const DEMO_BRANCHES = [
  { branch: "G365D", fraudRate: 0.81, total: 42,  flagged: 34 },
  { branch: "B210A", fraudRate: 0.67, total: 38,  flagged: 25 },
  { branch: "K401C", fraudRate: 0.54, total: 61,  flagged: 33 },
  { branch: "M330F", fraudRate: 0.41, total: 29,  flagged: 12 },
  { branch: "R180E", fraudRate: 0.28, total: 55,  flagged: 15 },
  { branch: "H290B", fraudRate: 0.19, total: 47,  flagged:  9 },
  { branch: "T550G", fraudRate: 0.11, total: 63,  flagged:  7 },
  { branch: "P445D", fraudRate: 0.06, total: 72,  flagged:  4 },
];

function heatColor(rate) {
  if (rate > 0.70) return { bar: "#DC2626", bg: "bg-crimson/20",  text: "text-crimson",       label: "CRITICAL" };
  if (rate > 0.50) return { bar: "#F97316", bg: "bg-orange-500/15", text: "text-orange-400",  label: "HIGH" };
  if (rate > 0.30) return { bar: "#F59E0B", bg: "bg-amber/15",    text: "text-amber",         label: "MEDIUM" };
  if (rate > 0.15) return { bar: "#84CC16", bg: "bg-lime-500/10", text: "text-lime-400",      label: "LOW" };
  return               { bar: "#10B981", bg: "bg-jade/10",        text: "text-jade",           label: "SAFE" };
}

export default function FraudMap({ branches = DEMO_BRANCHES }) {
  const sorted = [...branches].sort((a, b) => b.fraudRate - a.fraudRate);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-frost/50 text-xs">Branch Code → Fraud Rate (F3889 forensic mapping)</p>
        <p className="text-frost/30 text-[10px]">Demo data — connect AI engine for live stats</p>
      </div>

      <div className="space-y-1.5">
        {sorted.map((b) => {
          const c = heatColor(b.fraudRate);
          return (
            <div key={b.branch} className={`rounded-lg px-3 py-2 border border-transparent ${c.bg} hover:border-grape/30 transition-colors`}>
              <div className="flex items-center gap-3">
                {/* Branch code */}
                <span className="text-frost/70 font-mono text-xs w-14 flex-shrink-0">{b.branch}</span>

                {/* Bar */}
                <div className="flex-1 h-2 bg-night/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${b.fraudRate * 100}%`, background: c.bar }}
                  />
                </div>

                {/* Pct */}
                <span className={`font-mono font-bold text-xs w-10 text-right ${c.text}`}>
                  {(b.fraudRate * 100).toFixed(0)}%
                </span>

                {/* Count */}
                <span className="text-frost/30 text-[10px] w-16 text-right flex-shrink-0">
                  {b.flagged}/{b.total}
                </span>

                {/* Badge */}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text} border border-current/30 w-14 text-center flex-shrink-0`}>
                  {c.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 pt-1 flex-wrap">
        {[
          { label: "Critical (>70%)", color: "bg-crimson" },
          { label: "High (>50%)",     color: "bg-orange-500" },
          { label: "Medium (>30%)",   color: "bg-amber" },
          { label: "Safe (<15%)",     color: "bg-jade" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-frost/40">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}