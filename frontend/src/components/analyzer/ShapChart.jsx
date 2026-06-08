// src/components/analyzer/ShapChart.jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";

export default function ShapChart({ factors = [] }) {
  const data = factors.slice(0, 8).map(f => ({
    name:  f.feature.length > 12 ? f.feature.slice(0, 12) + "…" : f.feature,
    value: parseFloat(f.shap_value.toFixed(4)),
    full:  f.feature,
  })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
        <XAxis type="number" tick={{ fill: "#F5F3FF80", fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: "#F5F3FF90", fontSize: 10, fontFamily: "monospace" }} width={90} />
        <Tooltip
          contentStyle={{ background: "#1A0533", border: "1px solid #7B2FBE50", borderRadius: 8 }}
          labelStyle={{ color: "#C084FC" }}
          formatter={(v, _, { payload }) => [`${v > 0 ? "+" : ""}${v}`, payload.full]}
        />
        <ReferenceLine x={0} stroke="#7B2FBE60" />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value > 0 ? "#DC2626" : "#10B981"} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
