// src/pages/Analyzer.jsx
import { useState } from "react";
import api from "../services/api";
import { collectDeviceSignal } from "../services/fingerprint";
import RiskGauge     from "../components/dashboard/RiskGauge";
import ShapChart     from "../components/analyzer/ShapChart";
import ScoreBreakdown from "../components/analyzer/ScoreBreakdown";
import { Search, Loader2 } from "lucide-react";

const BADGE = { BLOCK: "risk-badge-block", FLAG: "risk-badge-flag", REVIEW: "risk-badge-review", APPROVE: "risk-badge-approve" };

const DEFAULT_FEATURES = {
  F115: "", F321: "", F527: "", F531: "", F670: "",
  F1692: "", F2082: "", F2122: "", F2582: "", F2678: "",
  F2737: "", F2956: "", F3043: "", F3836: "", F3887: "",
  F3889: "", F3891: "student", F3894: "",
};

export default function Analyzer() {
  const [accountId, setAccountId] = useState("");
  const [features,  setFeatures]  = useState(DEFAULT_FEATURES);
  const [result,    setResult]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!accountId.trim()) return;
    setLoading(true); setError(""); setResult(null);

    try {
      const deviceSignal = await collectDeviceSignal();
      const { data } = await api.post("/api/accounts/analyze", {
        accountId: accountId.trim(),
        features: Object.fromEntries(
          Object.entries(features).filter(([, v]) => v !== "").map(([k, v]) => [k, isNaN(v) ? v : Number(v)])
        ),
        deviceSignal,
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || "Analysis failed. Is the AI engine running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-frost">Account Analyzer</h1>
        <p className="text-frost/50 text-sm mt-1">Submit account features for real-time fraud risk analysis</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Input form */}
        <div className="card">
          <h2 className="text-frost/80 font-semibold mb-4">Account Features</h2>
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label className="text-frost/60 text-xs mb-1 block">Account ID *</label>
              <input className="input font-mono" placeholder="ACC-000001" value={accountId} onChange={e => setAccountId(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Object.keys(DEFAULT_FEATURES).map(key => (
                <div key={key}>
                  <label className="text-frost/50 text-xs mb-1 block font-mono">{key}</label>
                  {key === "F3891" ? (
                    <select className="input text-sm" value={features[key]} onChange={e => setFeatures(f => ({ ...f, [key]: e.target.value }))}>
                      {["student","salaried","selfemployed","housewife","retired","agriculture","others"].map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input text-sm font-mono"
                      placeholder={key === "F3889" ? "G365D" : "0.0"}
                      value={features[key]}
                      onChange={e => setFeatures(f => ({ ...f, [key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && <p className="text-crimson text-sm bg-crimson/10 rounded px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Search className="w-4 h-4" /> Analyze Account</>}
            </button>
          </form>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Risk gauge + decision */}
            <div className="card flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 w-full">
                <h2 className="text-frost/80 font-semibold flex-1">{result.accountId}</h2>
                <span className={BADGE[result.decision]}>{result.decision}</span>
              </div>
              <RiskGauge score={result.finalRisk} decision={result.decision} size={160} />
            </div>

            {/* Score breakdown */}
            <div className="card">
              <h3 className="text-frost/60 text-sm font-semibold mb-3">Layer Scores</h3>
              <ScoreBreakdown scores={result.scores} />
            </div>

            {/* SHAP chart */}
            {result.shap?.length > 0 && (
              <div className="card">
                <h3 className="text-frost/60 text-sm font-semibold mb-3">Risk Factor Analysis (SHAP)</h3>
                <ShapChart factors={result.shap} />
              </div>
            )}

            {/* Alert text */}
            {result.alertText && (
              <div className="card border-grape/40">
                <h3 className="text-orchid text-sm font-semibold mb-2">Compliance Alert</h3>
                <p className="text-frost/80 text-sm leading-relaxed">{result.alertText}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
