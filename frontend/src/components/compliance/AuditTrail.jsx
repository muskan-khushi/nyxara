// src/components/compliance/AuditTrail.jsx
import { useState } from "react";
import { Shield, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";

const DECISION_STYLES = {
  BLOCK:   "text-crimson border-crimson/30 bg-crimson/10",
  FLAG:    "text-orange-400 border-orange-400/30 bg-orange-400/10",
  REVIEW:  "text-amber border-amber/30 bg-amber/10",
  APPROVE: "text-jade border-jade/30 bg-jade/10",
};

function EntryRow({ entry, idx }) {
  const [open, setOpen] = useState(false);
  const style = DECISION_STYLES[entry.decision] || DECISION_STYLES.REVIEW;

  return (
    <div className="border border-grape/10 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-grape/5 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-frost/30 font-mono text-xs w-6 text-center">{idx + 1}</span>
        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${style}`}>{entry.decision}</span>
        <span className="text-frost/60 font-mono text-xs flex-1 truncate">
          {entry.accountId}
        </span>
        <span className="text-frost/40 text-xs">
          {(entry.riskScore * 100 || 0).toFixed(1)}
        </span>
        <span className="text-frost/30 text-xs hidden sm:block">
          {new Date(entry.timestamp || entry.createdAt).toLocaleString()}
        </span>
        {open ? <ChevronUp className="w-3 h-3 text-frost/30" /> : <ChevronDown className="w-3 h-3 text-frost/30" />}
      </div>

      {open && (
        <div className="px-4 pb-3 border-t border-grape/10 space-y-2 pt-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-frost/40 w-28">Decision Hash</span>
            <span className="text-frost/60 font-mono text-[10px] truncate">{entry.decisionHash || entry.leafHash}</span>
          </div>
          {entry.merkleLeafHash && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-frost/40 w-28">Merkle Leaf</span>
              <span className="text-frost/60 font-mono text-[10px] truncate">{entry.merkleLeafHash}</span>
            </div>
          )}
          {entry.blockchainBatchId && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-frost/40 w-28">Batch ID</span>
              <span className="text-orchid font-mono text-xs">{entry.blockchainBatchId}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditTrail({ entries = [], integrity = true, accountId = "" }) {
  return (
    <div className="space-y-3">
      {/* Integrity header */}
      <div className={`flex items-center gap-3 rounded-lg px-4 py-3 border ${
        integrity
          ? "bg-jade/10 border-jade/30 text-jade"
          : "bg-crimson/10 border-crimson/30 text-crimson"
      }`}>
        {integrity
          ? <Shield className="w-4 h-4 flex-shrink-0" />
          : <ShieldAlert className="w-4 h-4 flex-shrink-0 animate-pulse" />
        }
        <div>
          <p className="font-semibold text-sm">
            {integrity ? "Chain Integrity Verified" : "⚠️ TAMPER DETECTED"}
          </p>
          <p className="text-xs opacity-70">
            {integrity
              ? `${entries.length} decisions — all hashes verified`
              : "Hash mismatch detected. Contact compliance officer immediately."
            }
          </p>
        </div>
      </div>

      {/* Entry list */}
      {entries.length === 0 ? (
        <p className="text-frost/30 text-sm text-center py-6">
          {accountId ? `No audit entries for ${accountId}` : "Enter an account ID to view audit trail"}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {entries.map((entry, i) => (
            <EntryRow key={entry.decisionHash || i} entry={entry} idx={i} />
          ))}
        </div>
      )}
    </div>
  );
}