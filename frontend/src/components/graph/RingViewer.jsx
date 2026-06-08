// src/components/graph/RingViewer.jsx
import { useState } from "react";

const SHAPE_COLORS = {
  STAR:      { bg: "bg-crimson/15",  border: "border-crimson/40",  text: "text-crimson" },
  CHAIN:     { bg: "bg-amber/10",    border: "border-amber/30",    text: "text-amber" },
  CYCLE:     { bg: "bg-orchid/10",   border: "border-orchid/30",   text: "text-orchid" },
  CLUSTER:   { bg: "bg-cyan/10",     border: "border-cyan/30",     text: "text-cyan" },
  BIPARTITE: { bg: "bg-jade/10",     border: "border-jade/30",     text: "text-jade" },
};

const ROLE_ICONS = {
  hub:          { icon: "◆", color: "text-crimson",  label: "Hub / Orchestrator" },
  orchestrator: { icon: "★", color: "text-crimson",  label: "Orchestrator" },
  bridge:       { icon: "▲", color: "text-amber",    label: "Bridge" },
  mule:         { icon: "●", color: "text-orange-400", label: "Mule" },
  relay:        { icon: "→", color: "text-frost/60", label: "Relay" },
  terminal:     { icon: "■", color: "text-jade",     label: "Terminal" },
  cycler:       { icon: "↺", color: "text-orchid",   label: "Cycler" },
  coordinator:  { icon: "◉", color: "text-cyan",     label: "Coordinator" },
  member:       { icon: "○", color: "text-frost/50", label: "Member" },
  source:       { icon: "▶", color: "text-amber",    label: "Source" },
  legitimate:   { icon: "○", color: "text-jade",     label: "Legitimate" },
};

function RingCard({ ring, onSelect, selected }) {
  const style  = SHAPE_COLORS[ring.shape] || SHAPE_COLORS.CLUSTER;
  const isHigh = ring.fraud_rate > 0.5;

  return (
    <div
      onClick={() => onSelect(ring)}
      className={`cursor-pointer rounded-xl p-4 border transition-all duration-200 ${style.bg} ${style.border}
        ${selected ? "ring-2 ring-offset-1 ring-offset-night ring-grape/60" : "hover:scale-[1.01]"}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className={`text-xs font-bold font-mono ${style.text}`}>{ring.shape}</span>
          <p className="text-frost/80 text-sm font-mono mt-0.5 truncate max-w-[160px]">{ring.ring_id}</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold font-mono ${isHigh ? "text-crimson" : "text-amber"}`}>
            {(ring.fraud_rate * 100).toFixed(0)}%
          </p>
          <p className="text-frost/40 text-xs">fraud rate</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-frost/50 text-xs">{ring.size || ring.accounts?.length} accounts</span>
        <span className={`text-xs font-mono ${style.text}`}>conf: {(ring.confidence * 100).toFixed(0)}%</span>
      </div>
      {/* Member role dots */}
      <div className="flex flex-wrap gap-1 mt-2">
        {Object.entries(ring.roles || {}).slice(0, 8).map(([acct, role]) => {
          const ri = ROLE_ICONS[role] || ROLE_ICONS.member;
          return (
            <span key={acct} title={`${acct}: ${ri.label}`} className={`text-xs ${ri.color}`}>{ri.icon}</span>
          );
        })}
        {Object.keys(ring.roles || {}).length > 8 && (
          <span className="text-frost/30 text-xs">+{Object.keys(ring.roles).length - 8}</span>
        )}
      </div>
    </div>
  );
}

function RingDetail({ ring }) {
  if (!ring) return null;
  const style = SHAPE_COLORS[ring.shape] || SHAPE_COLORS.CLUSTER;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`font-bold text-lg ${style.text}`}>{ring.shape} Ring</h3>
        <span className="text-frost/40 font-mono text-xs">{ring.ring_id}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Size",       value: ring.size || ring.accounts?.length },
          { label: "Fraud Rate", value: `${(ring.fraud_rate * 100).toFixed(1)}%` },
          { label: "Confidence", value: `${(ring.confidence * 100).toFixed(0)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-night/60 rounded-lg p-2">
            <p className="text-frost/80 font-mono font-bold">{value}</p>
            <p className="text-frost/40 text-xs">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-frost/50 text-xs font-semibold mb-2 uppercase tracking-wider">Account Roles</p>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {Object.entries(ring.roles || {}).map(([acct, role]) => {
            const ri = ROLE_ICONS[role] || ROLE_ICONS.member;
            return (
              <div key={acct} className="flex items-center gap-2 text-xs">
                <span className={`text-base ${ri.color}`}>{ri.icon}</span>
                <span className="text-frost/70 font-mono flex-1 truncate">{acct}</span>
                <span className={`${ri.color} font-medium`}>{ri.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {ring.hub_node && (
        <div className="bg-crimson/10 border border-crimson/30 rounded-lg px-3 py-2 text-xs">
          <span className="text-crimson font-semibold">Hub Node: </span>
          <span className="text-frost/70 font-mono">{ring.hub_node}</span>
        </div>
      )}
    </div>
  );
}

export default function RingViewer({ rings = [] }) {
  const [selected, setSelected] = useState(null);
  const [filter,   setFilter]   = useState("ALL");

  const shapes  = ["ALL", ...new Set(rings.map(r => r.shape))];
  const visible = filter === "ALL" ? rings : rings.filter(r => r.shape === filter);

  if (!rings.length) {
    return (
      <div className="text-center py-12 text-frost/30">
        <p className="text-4xl mb-2">🕸️</p>
        <p className="text-sm">No rings detected yet. Train the model to populate ring data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {shapes.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === s ? "bg-grape text-white" : "bg-abyss text-frost/50 border border-grape/20 hover:text-frost"
            }`}>
            {s} {s !== "ALL" && `(${rings.filter(r => r.shape === s).length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Ring cards */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {visible.map(ring => (
            <RingCard
              key={ring.ring_id}
              ring={ring}
              onSelect={setSelected}
              selected={selected?.ring_id === ring.ring_id}
            />
          ))}
        </div>
        {/* Detail panel */}
        <div>
          {selected
            ? <RingDetail ring={selected} />
            : <div className="card text-center text-frost/30 text-sm py-16">Click a ring card to inspect member roles</div>
          }
        </div>
      </div>
    </div>
  );
}