// src/pages/Compliance.jsx
import { useState } from "react";
import api from "../services/api";
import { Shield, Search } from "lucide-react";

export default function Compliance() {
  const [accountId, setAccountId] = useState("");
  const [audit, setAudit] = useState(null);
  const [str,   setStr]   = useState(null);
  const [verify, setVerify] = useState(null);

  async function loadAudit() {
    if (!accountId.trim()) return;
    const [a, s] = await Promise.all([
      api.get(`/api/compliance/audit/${accountId}`).then(r => r.data).catch(() => null),
      api.get(`/api/compliance/str/demo-alert-id`).then(r => r.data).catch(() => null),
    ]);
    setAudit(a); setStr(s);
  }

  async function runVerify() {
    const { data } = await api.get("/api/compliance/verify").catch(() => ({ data: null }));
    setVerify(data);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-frost">Compliance & Audit</h1>

      {/* Chain integrity */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-frost/80 font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-orchid" /> Blockchain Integrity</h2>
          <button onClick={runVerify} className="btn-outline text-sm">Verify Chain</button>
        </div>
        {verify && (
          <div className={`rounded-lg px-4 py-3 text-sm ${verify.integrity ? "bg-jade/10 text-jade border border-jade/30" : "bg-crimson/10 text-crimson border border-crimson/30"}`}>
            {verify.integrity
              ? `✅ Chain intact — ${verify.total} decisions verified, 0 tampered`
              : `❌ TAMPER DETECTED — ${verify.tampered} compromised entries`
            }
          </div>
        )}
      </div>

      {/* Audit trail lookup */}
      <div className="card">
        <h2 className="text-frost/80 font-semibold mb-4">Audit Trail Lookup</h2>
        <div className="flex gap-2">
          <input className="input font-mono flex-1" placeholder="Account ID" value={accountId} onChange={e => setAccountId(e.target.value)} />
          <button onClick={loadAudit} className="btn-primary flex items-center gap-2"><Search className="w-4 h-4" /> Lookup</button>
        </div>

        {audit?.entries?.length > 0 && (
          <div className="mt-4 space-y-2">
            {audit.entries.map((e, i) => (
              <div key={i} className="bg-night/60 rounded p-3 border border-grape/10">
                <div className="flex justify-between text-xs">
                  <span className="text-frost/60 font-mono">{e.decisionHash?.slice(0, 16)}...</span>
                  <span className="text-frost/40">{new Date(e.timestamp || e.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs">
                  <span className="text-orchid">{e.decision}</span>
                  <span className="text-frost/50">Risk: {((e.riskScore || 0) * 100).toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STR Draft */}
      {str && (
        <div className="card">
          <h2 className="text-frost/80 font-semibold mb-4">STR Draft (FIU-IND Format)</h2>
          <div className="space-y-2 text-sm">
            {Object.entries(str).filter(([k]) => !["requires_analyst_review"].includes(k)).map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="text-frost/40 font-mono text-xs w-40 flex-shrink-0">{k}</span>
                <span className="text-frost/80 text-xs">{Array.isArray(v) ? v.join("; ") : String(v)}</span>
              </div>
            ))}
          </div>
          <p className="text-amber text-xs mt-4">⚠️ Analyst review required before filing. Never auto-file without human approval.</p>
        </div>
      )}
    </div>
  );
}
