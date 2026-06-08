// src/components/dashboard/OccupationMatrix.jsx
// Occupation × velocity bucket → fraud rate heat map

const OCCUPATIONS = ["student", "housewife", "retired", "agriculture", "salaried", "selfemployed"];
const VEL_BUCKETS = ["Low (1-5)", "Med (6-20)", "High (21-50)", "Extreme (50+)"];

// Demo heat map values — occupation × velocity → fraud probability
// In prod: computed from dataset statistics post-training
const DEMO_MATRIX = {
  student:     [0.08, 0.31, 0.72, 0.94],
  housewife:   [0.05, 0.22, 0.65, 0.91],
  retired:     [0.04, 0.18, 0.58, 0.87],
  agriculture: [0.06, 0.19, 0.42, 0.78],
  salaried:    [0.03, 0.09, 0.28, 0.61],
  selfemployed:[0.04, 0.11, 0.31, 0.55],
};

const heatColor = (value) => {
  if (value > 0.75) return { bg: "bg-crimson/80",     text: "text-white" };
  if (value > 0.50) return { bg: "bg-orange-500/70",  text: "text-white" };
  if (value > 0.25) return { bg: "bg-amber/60",       text: "text-night" };
  if (value > 0.10) return { bg: "bg-amber/20",       text: "text-amber" };
  return                    { bg: "bg-jade/15",        text: "text-jade" };
};

export default function OccupationMatrix({ matrix = DEMO_MATRIX }) {
  return (
    <div>
      <p className="text-frost/50 text-xs mb-3">Occupation × Transaction Velocity → Fraud Probability</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-frost/30 text-left font-normal pb-2 pr-3 w-24">Occupation</th>
              {VEL_BUCKETS.map(v => (
                <th key={v} className="text-frost/40 font-normal pb-2 px-1 text-center">{v}</th>
              ))}
            </tr>
          </thead>
          <tbody className="space-y-1">
            {OCCUPATIONS.map(occ => (
              <tr key={occ}>
                <td className="text-frost/60 pr-3 py-1 font-mono capitalize">{occ}</td>
                {(matrix[occ] || [0, 0, 0, 0]).map((val, i) => {
                  const { bg, text } = heatColor(val);
                  return (
                    <td key={i} className="px-1 py-1">
                      <div className={`rounded text-center py-1 font-mono font-bold ${bg} ${text} min-w-[52px]`}>
                        {(val * 100).toFixed(0)}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-frost/20 text-[10px] mt-2">
        Innovation #1: Occupation-specific velocity baselines — student with 50+ txns is 10× more anomalous than selfemployed
      </p>
    </div>
  );
}