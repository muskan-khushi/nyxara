// src/components/dashboard/MetricsCards.jsx
export default function MetricsCards({ auc = 0, f1 = 0, precision = 0, recall = 0 }) {
  const cards = [
    { label: "AUC-ROC",   value: auc,       pct: true,  color: "text-orchid" },
    { label: "F1 Score",  value: f1,        pct: true,  color: "text-cyan" },
    { label: "Precision", value: precision, pct: true,  color: "text-jade" },
    { label: "Recall",    value: recall,    pct: true,  color: "text-amber" },
  ];

  return (
    <div>
      <h2 className="text-frost/70 text-sm font-semibold mb-4">Model Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, pct, color }) => (
          <div key={label} className="bg-night/50 rounded-lg p-4 border border-grape/10">
            <p className={`text-2xl font-bold font-mono ${color}`}>
              {pct ? `${(value * 100).toFixed(1)}%` : value}
            </p>
            <p className="text-frost/40 text-xs mt-1">{label}</p>
            {/* Mini progress bar */}
            <div className="mt-2 h-1 bg-grape/20 rounded-full overflow-hidden">
              <div className={`h-full rounded-full bg-current ${color}`} style={{ width: `${value * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
