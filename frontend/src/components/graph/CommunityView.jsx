// src/components/graph/CommunityView.jsx
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const RISK_COLOR = (rate) => {
  if (rate > 0.5)  return "#DC2626";
  if (rate > 0.2)  return "#F59E0B";
  return "#10B981";
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-abyss border border-grape/40 rounded-lg p-3 text-xs shadow-lg">
      <p className="text-orchid font-mono font-semibold">Community {d.community_id}</p>
      <p className="text-frost/70 mt-1">Size: <span className="text-frost font-mono">{d.size}</span> accounts</p>
      <p className="text-frost/70">Fraud rate: <span className="font-mono" style={{ color: RISK_COLOR(d.fraud_rate) }}>{(d.fraud_rate * 100).toFixed(1)}%</span></p>
      <p className={`mt-1 font-semibold ${d.risk_level === "HIGH" ? "text-crimson" : d.risk_level === "MEDIUM" ? "text-amber" : "text-jade"}`}>
        {d.risk_level} RISK
      </p>
    </div>
  );
};

export default function CommunityView({ communities = [] }) {
  if (!communities.length) {
    return (
      <div className="text-center py-10 text-frost/30 text-sm">
        No community data yet. Run training to populate.
      </div>
    );
  }

  const chartData = communities.map(c => ({
    ...c,
    x:    c.size,
    y:    c.fraud_rate * 100,
    z:    Math.max(c.size / 5, 50),
    fill: RISK_COLOR(c.fraud_rate),
  }));

  const highRisk = communities.filter(c => c.fraud_rate > 0.5);
  const totalAccounts = communities.reduce((s, c) => s + c.size, 0);

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex gap-4 text-xs">
        <div className="card-hover py-2 px-3 flex-1 text-center">
          <p className="text-2xl font-bold font-mono text-frost">{communities.length}</p>
          <p className="text-frost/40">Communities</p>
        </div>
        <div className="card-hover py-2 px-3 flex-1 text-center">
          <p className="text-2xl font-bold font-mono text-crimson">{highRisk.length}</p>
          <p className="text-frost/40">High Risk (&gt;50%)</p>
        </div>
        <div className="card-hover py-2 px-3 flex-1 text-center">
          <p className="text-2xl font-bold font-mono text-frost">{totalAccounts.toLocaleString()}</p>
          <p className="text-frost/40">Total Accounts</p>
        </div>
      </div>

      {/* Scatter: size vs fraud rate */}
      <div>
        <p className="text-frost/50 text-xs mb-2">Community Size vs Fraud Rate — bubble size ∝ community size</p>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
            <XAxis dataKey="x" name="Size" label={{ value: "Community Size", position: "insideBottom", offset: -10, fill: "#F5F3FF50", fontSize: 11 }}
              tick={{ fill: "#F5F3FF60", fontSize: 10 }} />
            <YAxis dataKey="y" name="Fraud Rate %" domain={[0, 100]}
              label={{ value: "Fraud Rate %", angle: -90, position: "insideLeft", fill: "#F5F3FF50", fontSize: 11 }}
              tick={{ fill: "#F5F3FF60", fontSize: 10 }} />
            <ZAxis dataKey="z" range={[40, 400]} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={50} stroke="#DC262660" strokeDasharray="4 4" label={{ value: "50% threshold", fill: "#DC262680", fontSize: 10 }} />
            <Scatter
              data={chartData}
              shape={(props) => {
                const { cx, cy, r } = props;
                const color = props.payload.fill;
                return (
                  <circle cx={cx} cy={cy} r={Math.sqrt(props.payload.z / Math.PI) * 2}
                    fill={color + "30"} stroke={color} strokeWidth={1.5} opacity={0.8} />
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* High risk community list */}
      {highRisk.length > 0 && (
        <div>
          <p className="text-crimson text-xs font-semibold mb-2">⚠️ High-Risk Communities</p>
          <div className="space-y-1">
            {highRisk.slice(0, 5).map(c => (
              <div key={c.community_id} className="flex items-center justify-between text-xs bg-crimson/5 border border-crimson/20 rounded px-3 py-1.5">
                <span className="text-frost/60 font-mono">Community {c.community_id}</span>
                <span className="text-frost/50">{c.size} accounts</span>
                <span className="text-crimson font-bold font-mono">{(c.fraud_rate * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}