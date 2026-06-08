// src/components/analyzer/ScoreBreakdown.jsx
const LAYERS = [
  { key: "gnn",      label: "GNN",      color: "#7B2FBE", weight: "35%" },
  { key: "ensemble", label: "Ensemble", color: "#C084FC", weight: "25%" },
  { key: "vae",      label: "VAE",      color: "#06B6D4", weight: "20%" },
  { key: "bei",      label: "BEI",      color: "#F59E0B", weight: "12%" },
  { key: "graph",    label: "Graph",    color: "#10B981", weight: "8%"  },
];

export default function ScoreBreakdown({ scores = {} }) {
  return (
    <div className="space-y-2">
      {LAYERS.map(({ key, label, color, weight }) => {
        const val = scores[key] ?? 0;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-frost/50 text-xs font-mono w-16">{label}</span>
            <div className="flex-1 h-2 bg-grape/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${val * 100}%`, background: color }} />
            </div>
            <span className="text-frost/70 text-xs font-mono w-10 text-right">{(val * 100).toFixed(0)}</span>
            <span className="text-frost/30 text-[10px] w-8">{weight}</span>
          </div>
        );
      })}
    </div>
  );
}
