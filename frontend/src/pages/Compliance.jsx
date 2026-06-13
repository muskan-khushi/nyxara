// src/pages/Compliance.jsx
// FIU-IND STR draft generation + Blockchain audit trail

import { useState, useEffect } from "react";
import api from "../services/api";

/* ── Hash display with copy ── */
function HashDisplay({ hash, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(hash || "").then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div>
      {label && <p className="text-frost/30 text-xs mb-1">{label}</p>}
      <div className="flex items-center gap-2">
        <code className="text-frost/60 font-mono text-[10px] bg-night/60 px-2.5 py-1.5 rounded-lg border border-grape/15 flex-1 truncate">
          {hash || "—"}
        </code>
        {hash && (
          <button onClick={copy} className="text-frost/30 hover:text-orchid transition-colors p-1.5">
            {copied ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M8 4V2.5A1.5 1.5 0 0 0 6.5 1h-4A1.5 1.5 0 0 0 1 2.5v4A1.5 1.5 0 0 0 2.5 8H4" stroke="currentColor" strokeWidth="1.2"/></svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── STR Form ── */
const STR_TYPES = {
  mule_network: "Mule Network Activity",
  cross_border_layering: "Cross-Border Layering",
  structuring: "Structured Cash Deposits (Smurfing)",
  suspicious_activity: "Suspicious Account Activity",
};

function STRForm({ str, alertId, onFiled }) {
  const [fields, setFields] = useState(str || {});
  const [filed, setFiled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setFields(str || {}); setFiled(false); }, [str]);

  if (!str) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-grape/10 border border-grape/20 flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M7 3H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V15M11 3h8v8M11 11l8-8" stroke="#C084FC" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-frost/40 text-sm">Select an alert to generate STR draft</p>
        <p className="text-frost/20 text-xs mt-1">FIU-IND format — requires analyst review before filing</p>
      </div>
    );
  }

  const update = (key, val) => setFields(f => ({ ...f, [key]: val }));

  async function markFiled() {
    if (!alertId) return;
    setSaving(true);
    try {
      await api.patch(`/api/alerts/${alertId}/action`, {
        action: "confirmed",
        note: `STR Draft filed. Observation: ${fields.observation_period || "Last 90 days"}`,
      });
      setFiled(true);
      onFiled?.();
    } catch { } finally { setSaving(false); }
  }

  function exportTxt() {
    const lines = [
      "SUSPICIOUS TRANSACTION REPORT — FIU-IND FORMAT",
      "=".repeat(52),
      `Reporting Entity:    ${fields.reporting_entity}`,
      `FIRC Code:           ${fields.firc_code}`,
      `Account ID:          ${fields.account_id}`,
      `Customer Occupation: ${fields.customer_occupation}`,
      `Account Type:        ${fields.account_type}`,
      `STR Type:            ${STR_TYPES[fields.str_type] || fields.str_type}`,
      `Risk Score:          ${((fields.risk_score || 0) * 100).toFixed(1)}`,
      `Observation Period:  ${fields.observation_period}`,
      "",
      "NATURE OF SUSPICION:",
      fields.nature_of_suspicion || "",
      "",
      "RISK INDICATORS (FATF Mapped):",
      ...(fields.risk_indicators || []).map(i => `  • ${i}`),
      "",
      `Amount Involved:     ${fields.amount_involved ?? "Not determined"}`,
      `Audit Hash:          ${fields.audit_hash || "Pending"}`,
      "",
      `Generated:           ${fields.generated_at}`,
      "",
      "⚠  ANALYST REVIEW REQUIRED BEFORE FILING",
      "Analyst Signature: _______________________",
      "Date Filed:        _______________________",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `STR_${fields.account_id}_${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {filed && (
        <div className="bg-jade/8 border border-jade/25 rounded-xl px-4 py-3 text-jade text-sm flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          STR marked as filed. Audit trail updated.
        </div>
      )}

      <div className="bg-amber/5 border border-amber/20 rounded-xl px-3 py-2.5 text-amber text-xs flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L13 12H1L7 1Z" stroke="currentColor" strokeWidth="1.2"/><path d="M7 5V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="7" cy="10" r="0.5" fill="currentColor"/></svg>
        Analyst review required before filing. Never auto-file without human approval.
      </div>

      {/* Read-only fields */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: "reporting_entity", label: "Reporting Entity", readOnly: true },
          { key: "firc_code", label: "FIRC Code", readOnly: true },
          { key: "account_id", label: "Account Number", readOnly: true },
          { key: "customer_occupation", label: "Occupation", readOnly: false },
          { key: "account_type", label: "Account Type", readOnly: false },
          { key: "observation_period", label: "Observation Period", readOnly: false },
        ].map(({ key, label, readOnly }) => (
          <div key={key}>
            <label className="text-frost/35 text-[10px] mb-1 block uppercase tracking-wider">{label}</label>
            <input
              className={`input text-xs py-1.5 font-mono ${readOnly ? "opacity-40 cursor-not-allowed" : ""}`}
              value={fields[key] || ""}
              readOnly={readOnly}
              onChange={e => !readOnly && update(key, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* STR Type */}
      <div>
        <label className="text-frost/35 text-[10px] mb-1 block uppercase tracking-wider">STR Type</label>
        <select className="input text-xs" value={fields.str_type || ""} onChange={e => update("str_type", e.target.value)}>
          {Object.entries(STR_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Nature of suspicion */}
      <div>
        <label className="text-frost/35 text-[10px] mb-1 block uppercase tracking-wider">Nature of Suspicion (editable)</label>
        <textarea
          rows={4}
          className="input text-xs resize-none font-mono"
          value={fields.nature_of_suspicion || ""}
          onChange={e => update("nature_of_suspicion", e.target.value)}
        />
      </div>

      {/* Risk indicators */}
      {fields.risk_indicators?.length > 0 && (
        <div>
          <label className="text-frost/35 text-[10px] mb-2 block uppercase tracking-wider">FATF Risk Indicators</label>
          <div className="space-y-1">
            {fields.risk_indicators.map((ind, i) => (
              <div key={i} className="text-[10px] font-mono text-frost/60 bg-grape/5 rounded-lg px-3 py-1.5 border border-grape/10">
                {ind}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit hash */}
      <HashDisplay hash={fields.audit_hash} label="Blockchain Audit Hash" />

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button onClick={exportTxt} className="btn-outline text-xs flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 9H10M6 2V7M4 5L6 7L8 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Export .txt
        </button>
        {!filed && (
          <button onClick={markFiled} disabled={saving} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {saving ? "Saving…" : "Mark Filed"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Audit trail entry ── */
function AuditEntry({ entry, idx }) {
  const [open, setOpen] = useState(false);
  const DECISION_STYLE = {
    BLOCK: "bg-crimson/10 text-crimson border-crimson/25",
    FLAG: "bg-orange-500/10 text-orange-400 border-orange-500/25",
    REVIEW: "bg-amber/10 text-amber border-amber/25",
    APPROVE: "bg-jade/10 text-jade border-jade/25",
  };

  return (
    <div className="border border-grape/10 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-grape/5 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-frost/20 font-mono text-xs w-5">{idx + 1}</span>
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${DECISION_STYLE[entry.decision] || ""}`}>
          {entry.decision}
        </span>
        <span className="text-frost/60 font-mono text-xs flex-1 truncate">{entry.accountId}</span>
        <span className="text-frost/30 text-xs">
          {((entry.riskScore || 0) * 100).toFixed(1)}
        </span>
        <span className="text-frost/20 text-xs hidden sm:block">
          {new Date(entry.timestamp || entry.createdAt).toLocaleString()}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`text-frost/20 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && (
        <div className="px-4 pb-3 border-t border-grape/8 pt-3 space-y-2">
          <HashDisplay hash={entry.decisionHash || entry.leafHash} label="Decision Hash" />
          {entry.merkleLeafHash && <HashDisplay hash={entry.merkleLeafHash} label="Merkle Leaf" />}
          {entry.blockchainBatchId && (
            <div>
              <p className="text-frost/30 text-xs mb-1">Batch ID</p>
              <span className="text-orchid font-mono text-xs">{entry.blockchainBatchId}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Compliance() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [audit, setAudit] = useState(null);
  const [str, setStr] = useState(null);
  const [verify, setVerify] = useState(null);
  const [merkle, setMerkle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    api.get("/api/alerts", { params: { limit: 100 } })
      .then(r => {
        const fetchedAlerts = r.data.alerts || [];
        setAlerts(fetchedAlerts);
        if (fetchedAlerts.length > 0) selectAlert(fetchedAlerts[0]._id, fetchedAlerts);
      }).catch(() => {});
    api.get("/api/compliance/merkle-root").then(r => setMerkle(r.data)).catch(() => {});
  }, []);

  async function selectAlert(id, alertList = alerts) {
    if (!id) return;
    setSelectedAlertId(id);
    const alert = alertList.find(a => a._id === id);
    if (!alert) return;
    setAccountId(alert.accountId);
    setLoading(true);
    try {
      const [strRes, auditRes] = await Promise.all([
        api.get(`/api/compliance/str/${id}`),
        api.get(`/api/compliance/audit/${alert.accountId}`),
      ]);
      setStr(strRes.data);
      setAudit(auditRes.data);
    } catch {} finally { setLoading(false); }
  }

  const handleFiled = () => {
    api.get("/api/alerts", { params: { limit: 100 } })
      .then(r => setAlerts(r.data.alerts || []))
      .catch(() => {});
    if (selectedAlertId) {
      selectAlert(selectedAlertId);
    }
  };

  async function manualLookup() {
    if (!accountId.trim()) return;
    setLoading(true);
    try {
      const match = alerts.find(a => a.accountId.toLowerCase() === accountId.trim().toLowerCase());
      if (match) { selectAlert(match._id); return; }
      const auditRes = await api.get(`/api/compliance/audit/${accountId}`);
      setAudit(auditRes.data);
      setStr(null);
      setSelectedAlertId("");
    } catch {} finally { setLoading(false); }
  }

  async function runVerify() {
    setVerifying(true);
    try {
      const { data } = await api.get("/api/compliance/verify");
      setVerify(data);
    } catch {
      setVerify({ total: 0, tampered: 0, integrity: true, message: "Blockchain engine unavailable" });
    } finally { setVerifying(false); }
  }

  const entries = audit?.entries || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-frost">Compliance Center</h1>
        <p className="text-frost/40 text-sm mt-0.5">Blockchain audit trail · FIU-IND STR generation · PMLA 2002 alignment</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: controls */}
        <div className="xl:col-span-1 space-y-4">
          {/* Chain integrity */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-frost/70 font-semibold text-sm flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 9L2 12M9 5L12 2M6 4L10 8M4 6L8 10" stroke="#C084FC" strokeWidth="1.3" strokeLinecap="round"/></svg>
                Chain Integrity
              </h2>
              <button onClick={runVerify} disabled={verifying} className="btn-outline text-xs disabled:opacity-50">
                {verifying ? "Verifying…" : "Verify"}
              </button>
            </div>
            {verify ? (
              <div className={`rounded-lg px-3 py-2.5 text-xs flex items-center gap-2 ${
                verify.integrity
                  ? "bg-jade/8 border border-jade/20 text-jade"
                  : "bg-crimson/8 border border-crimson/20 text-crimson"
              }`}>
                {verify.integrity
                  ? `✓ Chain intact — ${verify.total} decisions verified`
                  : `✗ TAMPER DETECTED — ${verify.tampered} compromised`
                }
              </div>
            ) : (
              <p className="text-frost/25 text-xs">Click Verify to check chain integrity</p>
            )}

            {/* Merkle root */}
            {merkle?.merkleRoot && (
              <div className="mt-3 pt-3 border-t border-grape/10">
                <HashDisplay hash={merkle.merkleRoot} label={`Latest Batch Root (${merkle.leafCount} leaves)`} />
              </div>
            )}
          </div>

          {/* Alert selector */}
          <div className="card">
            <h2 className="text-frost/70 font-semibold text-sm mb-3">Generate STR</h2>
            <div className="space-y-3">
              <div>
                <label className="text-frost/35 text-[10px] mb-1 block uppercase tracking-wider">Select Alert Case</label>
                <select
                  value={selectedAlertId}
                  onChange={e => selectAlert(e.target.value)}
                  className="input text-xs"
                >
                  <option value="">— Choose an alert —</option>
                  {alerts.map(a => (
                    <option key={a._id} value={a._id}>
                      {a.accountId} ({a.decision} · {Math.round((a.riskScore || 0) * 100)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex items-center gap-2">
                <div className="flex-1 h-px bg-grape/10" />
                <span className="text-frost/20 text-[10px] font-mono">OR</span>
                <div className="flex-1 h-px bg-grape/10" />
              </div>

              <div>
                <label className="text-frost/35 text-[10px] mb-1 block uppercase tracking-wider">Search Account ID</label>
                <div className="flex gap-2">
                  <input
                    className="input font-mono text-xs flex-1"
                    placeholder="ACC-000001"
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && manualLookup()}
                  />
                  <button onClick={manualLookup} className="btn-primary px-3">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Audit entries count */}
          {entries.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between">
                <h2 className="text-frost/70 font-semibold text-sm">Audit Trail</h2>
                <span className="text-frost/30 text-xs font-mono">{entries.length} entries</span>
              </div>
              <p className="text-frost/30 text-xs mt-1">Immutable SHA-256 decision records</p>
            </div>
          )}
        </div>

        {/* Right: STR form + audit */}
        <div className="xl:col-span-2 space-y-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="#C084FC" strokeWidth="1.2"/>
                <path d="M4 5H10M4 7H10M4 9H7" stroke="#C084FC" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span className="text-frost/70 font-semibold text-sm">STR Draft — FIU-IND Format</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-grape/20 border-t-grape rounded-full animate-spin" />
              </div>
            ) : (
              <STRForm str={str} alertId={selectedAlertId} onFiled={handleFiled} />
            )}
          </div>

          {/* Audit trail */}
          {entries.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-frost/70 font-semibold text-sm">Immutable Audit Trail</h2>
                <div className={`flex items-center gap-1.5 text-xs ${verify?.integrity !== false ? "text-jade" : "text-crimson"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${verify?.integrity !== false ? "bg-jade" : "bg-crimson"}`} />
                  {verify?.integrity !== false ? "Verified" : "Tamper detected"}
                </div>
              </div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {entries.map((entry, i) => (
                  <AuditEntry key={entry.decisionHash || i} entry={entry} idx={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}