// src/components/compliance/STRDraft.jsx
import { useState } from "react";
import { FileText, Download, CheckCircle, AlertTriangle } from "lucide-react";

const STR_TYPE_LABELS = {
  mule_network:         "Mule Network Activity",
  cross_border_layering: "Cross-Border Layering",
  structuring:          "Structured Cash Deposits (Smurfing)",
  suspicious_activity:  "Suspicious Account Activity",
};

export default function STRDraft({ str, alertId, onFiled }) {
  const [fields, setFields]   = useState(str || {});
  const [filed,  setFiled]    = useState(false);
  const [saving, setSaving]   = useState(false);

  if (!str) {
    return (
      <div className="text-center py-8 text-frost/30 text-sm">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
        Select an alert to generate STR draft
      </div>
    );
  }

  function update(key, value) {
    setFields(prev => ({ ...prev, [key]: value }));
  }

  async function markFiled() {
    setSaving(true);
    // TODO: call PATCH /api/alerts/:alertId/str-filed
    await new Promise(r => setTimeout(r, 800));
    setFiled(true);
    setSaving(false);
    onFiled?.();
  }

  function exportTxt() {
    const lines = [
      "SUSPICIOUS TRANSACTION REPORT — FIU-IND FORMAT",
      "=" .repeat(50),
      `Reporting Entity:        ${fields.reporting_entity}`,
      `FIRC Code:               ${fields.firc_code}`,
      `Account ID:              ${fields.account_id}`,
      `Customer Occupation:     ${fields.customer_occupation}`,
      `Account Type:            ${fields.account_type}`,
      `STR Type:                ${STR_TYPE_LABELS[fields.str_type] || fields.str_type}`,
      `Risk Score:              ${((fields.risk_score || 0) * 100).toFixed(1)}`,
      `Observation Period:      ${fields.observation_period}`,
      "",
      "NATURE OF SUSPICION:",
      fields.nature_of_suspicion,
      "",
      "RISK INDICATORS:",
      ...(fields.risk_indicators || []).map(i => `  • ${i}`),
      "",
      `Amount Involved:         ${fields.amount_involved ?? "Not determined"}`,
      `Audit Hash:              ${fields.audit_hash || "Pending blockchain confirmation"}`,
      "",
      `Generated:               ${fields.generated_at}`,
      "",
      "⚠️  ANALYST REVIEW REQUIRED BEFORE FILING",
      "Analyst Signature: _______________________",
      "Date Filed:        _______________________",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `STR_${fields.account_id}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-orchid" />
          <span className="text-frost/80 font-semibold text-sm">STR Draft — FIU-IND Format</span>
        </div>
        <div className="flex gap-2">
          <button onClick={exportTxt} className="btn-outline text-xs flex items-center gap-1">
            <Download className="w-3 h-3" /> Export
          </button>
          {!filed && (
            <button onClick={markFiled} disabled={saving} className="btn-primary text-xs flex items-center gap-1 disabled:opacity-50">
              <CheckCircle className="w-3 h-3" />
              {saving ? "Saving..." : "Mark Filed"}
            </button>
          )}
        </div>
      </div>

      {filed && (
        <div className="bg-jade/10 border border-jade/30 rounded-lg px-4 py-2 text-jade text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> STR marked as filed. Audit trail updated.
        </div>
      )}

      <div className="bg-amber/5 border border-amber/20 rounded-lg px-3 py-2 text-amber text-xs flex items-center gap-2">
        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
        Analyst review required before filing. Verify all fields. Never auto-file without human approval.
      </div>

      {/* Form fields */}
      <div className="space-y-3 text-sm">
        {[
          { key: "reporting_entity",    label: "Reporting Entity", readOnly: true },
          { key: "firc_code",           label: "FIRC Code",        readOnly: true },
          { key: "account_id",          label: "Account Number",   readOnly: true },
          { key: "customer_occupation", label: "Occupation",       readOnly: false },
          { key: "account_type",        label: "Account Type",     readOnly: false },
          { key: "observation_period",  label: "Observation Period", readOnly: false },
        ].map(({ key, label, readOnly }) => (
          <div key={key} className="grid grid-cols-3 gap-2 items-center">
            <label className="text-frost/40 text-xs col-span-1">{label}</label>
            <input
              className={`input text-xs col-span-2 ${readOnly ? "opacity-50 cursor-not-allowed" : ""}`}
              value={fields[key] || ""}
              readOnly={readOnly}
              onChange={e => !readOnly && update(key, e.target.value)}
            />
          </div>
        ))}

        {/* STR Type selector */}
        <div className="grid grid-cols-3 gap-2 items-center">
          <label className="text-frost/40 text-xs">STR Type</label>
          <select className="input text-xs col-span-2" value={fields.str_type || ""} onChange={e => update("str_type", e.target.value)}>
            {Object.entries(STR_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Nature of suspicion — editable textarea */}
        <div>
          <label className="text-frost/40 text-xs mb-1 block">Nature of Suspicion (editable)</label>
          <textarea
            rows={4}
            className="input text-xs resize-none"
            value={fields.nature_of_suspicion || ""}
            onChange={e => update("nature_of_suspicion", e.target.value)}
          />
        </div>

        {/* Risk indicators */}
        {fields.risk_indicators?.length > 0 && (
          <div>
            <label className="text-frost/40 text-xs mb-1 block">Risk Indicators (FATF Mapped)</label>
            <div className="space-y-1">
              {fields.risk_indicators.map((ind, i) => (
                <div key={i} className="text-xs text-frost/60 bg-night/60 rounded px-3 py-1.5 border border-grape/10">
                  {ind}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit hash */}
        <div className="grid grid-cols-3 gap-2 items-center">
          <label className="text-frost/40 text-xs">Audit Hash</label>
          <span className="text-frost/50 font-mono text-xs col-span-2 truncate">
            {fields.audit_hash || "Pending blockchain confirmation"}
          </span>
        </div>
      </div>
    </div>
  );
}