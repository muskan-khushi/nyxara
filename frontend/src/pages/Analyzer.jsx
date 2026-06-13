// src/pages/Analyzer.jsx
// Deep-dive single account analysis — redesigned for clarity and trust

import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { collectDeviceSignal } from "../services/fingerprint";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";

/* ── Score layer bar ── */
function LayerBar({ label, value = 0, weight, color }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-frost/40 text-xs font-mono w-18 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-grape/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
      <span className="text-frost/70 text-xs font-mono w-8 text-right">{Math.round(value * 100)}</span>
      <span className="text-frost/25 text-[10px] w-8 text-right">{weight}</span>
    </div>
  );
}

/* ── Decision badge ── */
function DecisionBadge({ decision }) {
  const map = {
    BLOCK: { bg: "bg-crimson/15 border-crimson/40 text-crimson", icon: "🔴" },
    FLAG: { bg: "bg-orange-500/15 border-orange-500/40 text-orange-400", icon: "🟡" },
    REVIEW: { bg: "bg-amber/15 border-amber/40 text-amber", icon: "🔍" },
    APPROVE: { bg: "bg-jade/15 border-jade/40 text-jade", icon: "✅" },
  };
  const s = map[decision] || map.REVIEW;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${s.bg}`}>
      {s.icon} {decision}
    </span>
  );
}

/* ── SHAP chart ── */
function ShapChart({ factors = [] }) {
  const data = factors.slice(0, 10).map(f => ({
    name: f.feature.length > 14 ? f.feature.slice(0, 14) + "…" : f.feature,
    value: parseFloat(f.shap_value.toFixed(4)),
    full: f.feature,
    rawValue: f.raw_value,
  })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-abyss border border-grape/40 rounded-lg p-3 text-xs shadow-lg">
        <p className="text-orchid font-mono font-semibold mb-1">{d.full}</p>
        <p className="text-frost/70">SHAP: <span className={`font-mono font-bold ${d.value > 0 ? "text-crimson" : "text-jade"}`}>{d.value > 0 ? "+" : ""}{d.value}</span></p>
        {d.rawValue !== null && <p className="text-frost/50">Value: <span className="font-mono">{typeof d.rawValue === "number" ? d.rawValue.toFixed(3) : d.rawValue}</span></p>}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: "#F5F3FF50", fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: "#F5F3FF70", fontSize: 10, fontFamily: "monospace" }} width={100} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(123,47,190,0.08)" }} />
        <ReferenceLine x={0} stroke="rgba(123,47,190,0.3)" strokeWidth={1} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value > 0 ? "#DC2626" : "#10B981"} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Circular risk dial (canvas) ── */
function RiskDial({ score = 0, decision = "APPROVE" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const size = 140;
    const cx = size / 2, cy = size / 2 + 6;
    const r = 52;
    const colors = { APPROVE: "#10B981", REVIEW: "#F59E0B", FLAG: "#F97316", BLOCK: "#DC2626" };
    const color = colors[decision] || "#7B2FBE";
    let cur = 0;
    const target = score;

    const draw = (v) => {
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = "rgba(123,47,190,0.12)";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.stroke();

      if (v > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, Math.PI + v * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 12;
        ctx.lineCap = "round";
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = "#F5F3FF";
      ctx.font = `bold 22px Inter`;
      ctx.textAlign = "center";
      ctx.fillText(Math.round(v * 100), cx, cy + 4);
      ctx.fillStyle = color;
      ctx.font = `600 9px Inter`;
      ctx.fillText(decision, cx, cy + 16);
    };

    const id = setInterval(() => {
      cur = Math.min(cur + target / 35, target);
      draw(cur);
      if (cur >= target) clearInterval(id);
    }, 16);

    return () => clearInterval(id);
  }, [score, decision]);

  return <canvas ref={canvasRef} width={140} height={105} />;
}

const OCCUPATIONS = ["student", "salaried", "selfemployed", "housewife", "retired", "agriculture", "others"];
const DEFAULT_FEATURES = {
  F115: "", F321: "", F527: "", F531: "", F670: "",
  F1692: "", F2082: "", F2122: "", F2582: "", F2678: "",
  F2737: "", F2956: "", F3043: "", F3836: "", F3887: "",
  F3889: "", F3891: "student", F3894: "",
};

const FEATURE_HINTS = {
  F527: "Pass-through ratio (debit/credit flow)",
  F3836: "Transaction amount or balance",
  F3891: "Customer occupation",
  F1692: "Linked account count (0–10)",
  F2082: "International transaction exposure",
  F3894: "Transaction count in window",
  F3887: "Customer age or account tenure",
  F2122: "Cash deposit frequency",
  F3043: "Account relationship tenure (days)",
};

export default function Analyzer() {
  const [accountId, setAccountId] = useState("");
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("scores");

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!accountId.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const deviceSignal = await collectDeviceSignal();
      const { data } = await api.post("/api/accounts/analyze", {
        accountId: accountId.trim(),
        features: Object.fromEntries(
          Object.entries(features)
            .filter(([, v]) => v !== "")
            .map(([k, v]) => [k, isNaN(v) ? v : Number(v)])
        ),
        deviceSignal,
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || "Analysis failed. Ensure the AI engine is running on port 8001.");
    } finally {
      setLoading(false);
    }
  }

  function loadDemo() {
    setAccountId("ACC-7832");
    setFeatures({
      ...DEFAULT_FEATURES,
      F527: "0.94", F3836: "4500000", F3894: "85",
      F1692: "6", F2082: "0.3", F670: "1",
      F3891: "student", F2122: "0.7",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-frost">Account Analyzer</h1>
          <p className="text-frost/40 text-sm mt-0.5">Submit account features for real-time 6-layer fraud analysis</p>
        </div>
        <button onClick={loadDemo} className="btn-outline text-sm flex items-center gap-2">
          <span>Load Demo</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Input form — 2 cols */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-frost/70 font-semibold text-sm">Account Features</h2>
            <span className="text-frost/25 text-xs font-mono">18 key features · F-codes</span>
          </div>

          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label className="text-frost/50 text-xs mb-1.5 block font-mono">Account ID *</label>
              <input
                className="input font-mono text-sm"
                placeholder="ACC-000001"
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                required
              />
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
              {Object.keys(DEFAULT_FEATURES).map(key => (
                <div key={key}>
                  <label className="text-frost/40 text-[10px] mb-1 block font-mono flex items-center gap-1">
                    {key}
                    {FEATURE_HINTS[key] && (
                      <span className="text-frost/20 text-[9px] leading-tight hidden group-hover:block">
                        {FEATURE_HINTS[key]}
                      </span>
                    )}
                  </label>
                  {key === "F3891" ? (
                    <select
                      className="input text-xs py-1.5"
                      value={features[key]}
                      onChange={e => setFeatures(f => ({ ...f, [key]: e.target.value }))}
                    >
                      {OCCUPATIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      className="input text-xs font-mono py-1.5"
                      placeholder={key === "F3889" ? "G365D" : "0.0"}
                      value={features[key]}
                      onChange={e => setFeatures(f => ({ ...f, [key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-crimson/10 border border-crimson/30 rounded-lg px-3 py-2.5 text-crimson text-xs">
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Analyzing across 6 layers…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Analyze Account
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results — 3 cols */}
        <div className="xl:col-span-3 space-y-4">
          {!result && !loading && (
            <div className="card flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-grape/10 border border-grape/20 flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="#C084FC" strokeWidth="1.5"/>
                  <path d="M18 18L24 24" stroke="#C084FC" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-frost/40 text-sm">Fill in account features and click Analyze</p>
              <p className="text-frost/20 text-xs mt-1">Or load the demo case to see a pre-filled example</p>
            </div>
          )}

          {loading && (
            <div className="card flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative w-16 h-16">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-full border border-grape/40"
                    style={{ animation: `ping ${1 + i * 0.3}s cubic-bezier(0,0,0.2,1) infinite`, animationDelay: `${i * 0.2}s` }}
                  />
                ))}
                <div className="absolute inset-0 rounded-full bg-grape/20 flex items-center justify-center">
                  <span className="text-orchid text-lg">🧠</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-frost/60 text-sm font-medium">Running 6-layer analysis</p>
                <p className="text-frost/30 text-xs mt-1">GNN · Ensemble · VAE · BEI · Graph · SHAP</p>
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Risk summary card */}
              <div className="card">
                <div className="flex items-start gap-5">
                  <RiskDial score={result.finalRisk} decision={result.decision} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-frost/80 font-mono font-semibold">{result.accountId}</span>
                      <DecisionBadge decision={result.decision} />
                      {result.ringMembership && (
                        <span className="text-xs px-2 py-0.5 rounded bg-crimson/10 border border-crimson/30 text-crimson font-mono">
                          ⬡ Ring Member
                        </span>
                      )}
                    </div>
                    <p className="text-frost/40 text-xs leading-relaxed mb-3">
                      {result.alertText || "Analysis complete. Review layer scores for detail."}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { l: "Risk Score", v: `${Math.round(result.finalRisk * 100)}` },
                        { l: "Ring", v: result.ringMembership ? "Detected" : "None" },
                        { l: "Override", v: result.overrideApplied ? "Applied" : "None" },
                      ].map(({ l, v }) => (
                        <div key={l} className="bg-night/60 rounded-lg p-2">
                          <p className="text-frost/80 font-mono font-bold text-sm">{v}</p>
                          <p className="text-frost/30 text-[10px]">{l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="card">
                <div className="flex gap-1 bg-night/60 rounded-lg p-1 mb-4 w-fit">
                  {["scores", "shap", "alert"].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all capitalize ${
                        activeTab === tab ? "bg-grape text-white shadow" : "text-frost/50 hover:text-frost"
                      }`}
                    >
                      {tab === "scores" ? "Layer Scores" : tab === "shap" ? "SHAP Analysis" : "Compliance Alert"}
                    </button>
                  ))}
                </div>

                {activeTab === "scores" && (
                  <div className="space-y-3">
                    {[
                      { label: "GNN", key: "gnn", color: "#7B2FBE", weight: "35%" },
                      { label: "Ensemble", key: "ensemble", color: "#C084FC", weight: "25%" },
                      { label: "VAE", key: "vae", color: "#06B6D4", weight: "20%" },
                      { label: "BEI", key: "bei", color: "#F59E0B", weight: "12%" },
                      { label: "Graph", key: "graph", color: "#10B981", weight: "8%" },
                    ].map(l => (
                      <LayerBar
                        key={l.key}
                        label={l.label}
                        value={result.scores?.[l.key] ?? 0}
                        weight={l.weight}
                        color={l.color}
                      />
                    ))}
                    <div className="mt-4 pt-4 border-t border-grape/10 flex items-center gap-3">
                      <span className="text-frost/40 text-xs font-mono w-18">finalRisk</span>
                      <div className="flex-1 h-3 bg-grape/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${result.finalRisk * 100}%`,
                            background: result.finalRisk >= 0.85 ? "#DC2626" : result.finalRisk >= 0.70 ? "#F97316" : result.finalRisk >= 0.40 ? "#F59E0B" : "#10B981",
                          }}
                        />
                      </div>
                      <span className="text-frost font-mono font-bold text-sm w-8 text-right">{Math.round(result.finalRisk * 100)}</span>
                    </div>
                  </div>
                )}

                {activeTab === "shap" && (
                  result.shap?.length > 0 ? (
                    <div>
                      <p className="text-frost/30 text-xs mb-3">
                        Red bars = fraud risk factors · Green bars = safe signals
                      </p>
                      <ShapChart factors={result.shap} />
                    </div>
                  ) : (
                    <p className="text-frost/30 text-sm text-center py-8">SHAP values not available for this result.</p>
                  )
                )}

                {activeTab === "alert" && (
                  <div>
                    <div className="bg-amber/5 border border-amber/20 rounded-lg px-3 py-2 text-amber text-xs flex items-center gap-2 mb-4">
                      ⚠ Draft compliance narrative — analyst review required before any STR filing
                    </div>
                    <p className="text-frost/70 text-sm leading-relaxed">
                      {result.alertText || "No alert text generated for this analysis."}
                    </p>
                    {result.decision !== "APPROVE" && (
                      <div className="mt-4 pt-4 border-t border-grape/10">
                        <a
                          href="/compliance"
                          className="text-xs text-orchid hover:underline"
                        >
                          Generate STR draft in Compliance module →
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}