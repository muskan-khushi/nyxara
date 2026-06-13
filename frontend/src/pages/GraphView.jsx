// src/pages/GraphView.jsx
// Mule network topology — D3 force graph + ring inspector + community view

import { useEffect, useState, useCallback, useRef } from "react";
import * as d3 from "d3";
import api from "../services/api";

/* ── Risk color helper ── */
const riskColor = (r) => {
  if (r > 0.85) return "#DC2626";
  if (r > 0.70) return "#F97316";
  if (r > 0.40) return "#F59E0B";
  return "#10B981";
};

/* ── D3 Network Canvas ── */
function NetworkCanvas({ nodes = [], links = [], onNodeClick, height = 480 }) {
  const canvasRef = useRef();
  const simRef = useRef();

  const draw = useCallback((canvas, simNodes, simLinks, hoveredId) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width: W, height: H } = canvas;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "rgba(18,8,46,0.85)";
    ctx.fillRect(0, 0, W, H);

    // Draw grid (subtle)
    ctx.strokeStyle = "rgba(123,47,190,0.04)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Links
    simLinks.forEach(link => {
      const s = link.source, t = link.target;
      if (!s?.x || !t?.x) return;
      const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
      grad.addColorStop(0, "rgba(123,47,190,0.15)");
      grad.addColorStop(1, "rgba(192,132,252,0.08)");
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Nodes
    simNodes.forEach(node => {
      if (!node.x) return;
      const r = node.role === "hub" || node.role === "orchestrator" ? 14 : node.role === "bridge" ? 11 : 8;
      const color = riskColor(node.risk || 0);
      const isHovered = node.id === hoveredId;

      // Glow ring for high-risk
      if ((node.risk || 0) > 0.7) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 6, 0, 2 * Math.PI);
        ctx.fillStyle = color + "12";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
        ctx.fillStyle = color + "20";
        ctx.fill();
      }

      // Ring membership pulse
      if (node.in_ring) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = color + "40";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Hover highlight
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 7, 0, 2 * Math.PI);
        ctx.strokeStyle = "#C084FC60";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Node shape by role
      ctx.beginPath();
      if (node.role === "hub" || node.role === "orchestrator") {
        // Diamond
        ctx.moveTo(node.x, node.y - r);
        ctx.lineTo(node.x + r, node.y);
        ctx.lineTo(node.x, node.y + r);
        ctx.lineTo(node.x - r, node.y);
        ctx.closePath();
      } else if (node.role === "bridge") {
        // Triangle
        ctx.moveTo(node.x, node.y - r);
        ctx.lineTo(node.x + r * 0.866, node.y + r * 0.5);
        ctx.lineTo(node.x - r * 0.866, node.y + r * 0.5);
        ctx.closePath();
      } else {
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      }
      ctx.fillStyle = color + "22";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 2 : 1.5;
      ctx.stroke();

      // Label
      if (isHovered || r >= 12) {
        ctx.fillStyle = "rgba(245,243,255,0.75)";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText((node.id || "").slice(0, 10), node.x, node.y + r + 12);
      }
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nodes.length) return;

    const W = canvas.parentElement?.clientWidth || 600;
    const H = height;
    canvas.width = W;
    canvas.height = H;

    const simNodes = nodes.map(n => ({ ...n }));
    const simLinks = links.map(l => ({ ...l }));
    let hoveredId = null;

    const sim = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id(d => d.id).distance(90).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide(22));

    simRef.current = sim;
    sim.on("tick", () => draw(canvas, simNodes, simLinks, hoveredId));

    const cvs = d3.select(canvas);
    let dragNode = null;

    cvs.on("mousedown", event => {
      const [mx, my] = d3.pointer(event);
      dragNode = simNodes.find(n => n.x && Math.hypot(n.x - mx, n.y - my) < 22);
      if (dragNode) { sim.alphaTarget(0.3).restart(); dragNode.fx = dragNode.x; dragNode.fy = dragNode.y; }
    });
    cvs.on("mousemove", event => {
      const [mx, my] = d3.pointer(event);
      if (dragNode) { dragNode.fx = mx; dragNode.fy = my; return; }
      const found = simNodes.find(n => n.x && Math.hypot(n.x - mx, n.y - my) < 18);
      hoveredId = found?.id || null;
      canvas.style.cursor = found ? "pointer" : "grab";
      draw(canvas, simNodes, simLinks, hoveredId);
    });
    cvs.on("mouseup", () => {
      if (dragNode) { sim.alphaTarget(0); dragNode.fx = null; dragNode.fy = null; dragNode = null; }
    });
    cvs.on("click", event => {
      const [mx, my] = d3.pointer(event);
      const clicked = simNodes.find(n => n.x && Math.hypot(n.x - mx, n.y - my) < 18);
      if (clicked && onNodeClick) onNodeClick(clicked);
    });

    return () => sim.stop();
  }, [nodes, links, height, draw, onNodeClick]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height, cursor: "grab", display: "block", borderRadius: "0.75rem" }}
    />
  );
}

/* ── Ring topology badge ── */
const SHAPE_COLORS = {
  STAR: "text-crimson border-crimson/30 bg-crimson/10",
  CHAIN: "text-amber border-amber/30 bg-amber/10",
  CYCLE: "text-orchid border-orchid/30 bg-orchid/10",
  CLUSTER: "text-cyan border-cyan/30 bg-cyan/10",
  BIPARTITE: "text-jade border-jade/30 bg-jade/10",
};

/* ── Community scatter ── */
function CommunitySummary({ communities }) {
  if (!communities.length) return <p className="text-frost/30 text-sm text-center py-8">No community data.</p>;

  return (
    <div className="space-y-2">
      {communities.slice(0, 10).map(c => (
        <div key={c.community_id} className="flex items-center gap-3 py-2 border-b border-grape/8 last:border-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.fraud_rate > 0.5 ? "bg-crimson" : c.fraud_rate > 0.2 ? "bg-amber" : "bg-jade"}`} />
          <span className="text-frost/50 font-mono text-xs w-20">Community {c.community_id}</span>
          <div className="flex-1 h-1.5 bg-grape/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{
              width: `${c.fraud_rate * 100}%`,
              background: c.fraud_rate > 0.5 ? "#DC2626" : c.fraud_rate > 0.2 ? "#F59E0B" : "#10B981",
            }} />
          </div>
          <span className="text-xs font-mono font-bold w-10 text-right" style={{
            color: c.fraud_rate > 0.5 ? "#DC2626" : c.fraud_rate > 0.2 ? "#F59E0B" : "#10B981",
          }}>{(c.fraud_rate * 100).toFixed(0)}%</span>
          <span className="text-frost/30 text-xs w-16 text-right">{c.size} accts</span>
        </div>
      ))}
    </div>
  );
}

/* ── Build D3 nodes/links from rings ── */
function buildGraph(rings) {
  const nodeMap = new Map();
  const links = [];

  rings.forEach(ring => {
    const roles = ring.roles || {};
    (ring.accounts || []).forEach(id => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          risk: ring.fraud_rate * (0.85 + Math.random() * 0.15),
          role: roles[id] || "member",
          in_ring: true,
          ring_id: ring.ring_id,
          shape: ring.shape,
        });
      }
    });

    const accts = ring.accounts || [];
    const hub = ring.hub_node;
    if (ring.shape === "STAR" && hub) {
      accts.filter(a => a !== hub).forEach(mule => links.push({ source: hub, target: mule }));
    } else {
      for (let i = 0; i < accts.length - 1; i++) links.push({ source: accts[i], target: accts[i + 1] });
      if (ring.shape === "CYCLE" && accts.length > 1) links.push({ source: accts[accts.length - 1], target: accts[0] });
    }
  });

  return { nodes: Array.from(nodeMap.values()), links };
}

const TABS = [
  { id: "network", label: "Network Graph" },
  { id: "rings", label: "Ring Topology" },
  { id: "community", label: "Communities" },
];

export default function GraphView() {
  const [tab, setTab] = useState("network");
  const [rings, setRings] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedRing, setSelectedRing] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [rRes, cRes] = await Promise.allSettled([
        api.get("/api/rings"),
        api.get("/api/clusters"),
      ]);
      const fetchedRings = rRes.status === "fulfilled" ? rRes.value.data.rings || [] : [];
      const fetchedCommunities = cRes.status === "fulfilled" ? cRes.value.data.clusters || [] : [];
      setRings(fetchedRings);
      setCommunities(fetchedCommunities);
      setGraphData(buildGraph(fetchedRings));
      setLastRefresh(new Date());
    } catch {
      setError("Could not load graph data. Is the AI engine running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const highRiskRings = rings.filter(r => r.fraud_rate > 0.6);
  const highRiskComm = communities.filter(c => c.fraud_rate > 0.5);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-frost">Graph Intelligence</h1>
          <p className="text-frost/40 text-sm mt-0.5">
            GNN-detected mule rings · Louvain community fraud rates
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-frost/20 text-xs font-mono">
              {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button onClick={load} disabled={loading} className="btn-outline text-sm flex items-center gap-2 disabled:opacity-50">
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 0 1 2 7M2 7l2-2M2 7l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Rings", value: rings.length, color: "text-orchid" },
          { label: "High-Risk Rings", value: highRiskRings.length, color: "text-crimson" },
          { label: "Communities", value: communities.length, color: "text-cyan" },
          { label: "Nodes Mapped", value: graphData.nodes.length, color: "text-frost" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card py-3 text-center">
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
            <p className="text-frost/40 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-amber/8 border border-amber/25 text-amber rounded-xl px-4 py-3 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-abyss rounded-lg p-1 w-fit border border-grape/15">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded text-sm font-medium transition-all ${
              tab === id ? "bg-grape text-white shadow" : "text-frost/50 hover:text-frost"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card min-h-[540px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 border-2 border-grape/20 border-t-grape rounded-full animate-spin" />
            <p className="text-frost/30 text-sm">Loading graph data…</p>
          </div>
        ) : (
          <>
            {/* ── Network Graph ── */}
            {tab === "network" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-frost/50 text-sm">
                    {graphData.nodes.length} nodes · {graphData.links.length} edges
                    {selected && (
                      <span className="ml-3 text-orchid font-mono">
                        Selected: {selected.id} ({selected.role})
                      </span>
                    )}
                  </p>
                  <div className="flex gap-4 text-[10px] text-frost/30">
                    <span>◆ Hub/Orchestrator</span>
                    <span>▲ Bridge</span>
                    <span>● Mule/Member</span>
                  </div>
                </div>

                {graphData.nodes.length > 0 ? (
                  <NetworkCanvas
                    nodes={graphData.nodes}
                    links={graphData.links}
                    onNodeClick={setSelected}
                    height={460}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="text-5xl mb-4 opacity-20">🕸️</div>
                    <p className="text-frost/30 text-sm">No ring data yet.</p>
                    <p className="text-frost/20 text-xs mt-1">Run <code className="text-orchid">training/run_all.py</code> to detect rings.</p>
                  </div>
                )}

                {selected && (
                  <div className="mt-3 grid grid-cols-4 gap-3 bg-night/60 rounded-xl border border-grape/20 p-3 text-sm">
                    {[
                      { label: "Account", value: selected.id },
                      { label: "Risk Score", value: `${Math.round((selected.risk || 0) * 100)}` },
                      { label: "Role", value: selected.role || "member" },
                      { label: "Ring", value: selected.ring_id ? selected.ring_id.slice(0, 20) + "…" : "None" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-frost/30 text-xs mb-0.5">{label}</p>
                        <p className="text-frost/80 font-mono text-xs">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Ring Topology ── */}
            {tab === "rings" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Ring list */}
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {rings.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-2 opacity-20">🕸️</div>
                      <p className="text-frost/30 text-sm">No rings detected. Train the model first.</p>
                    </div>
                  )}
                  {rings.map(ring => {
                    const shapeStyle = SHAPE_COLORS[ring.shape] || SHAPE_COLORS.CLUSTER;
                    const isSelected = selectedRing?.ring_id === ring.ring_id;
                    return (
                      <div
                        key={ring.ring_id}
                        onClick={() => setSelectedRing(ring)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                          isSelected ? "border-grape/60 bg-grape/8" : "border-grape/15 bg-abyss/40 hover:border-grape/30"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${shapeStyle}`}>
                              {ring.shape}
                            </span>
                            <p className="text-frost/70 font-mono text-xs mt-1 truncate max-w-[180px]">{ring.ring_id}</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold font-mono ${ring.fraud_rate > 0.5 ? "text-crimson" : "text-amber"}`}>
                              {(ring.fraud_rate * 100).toFixed(0)}%
                            </p>
                            <p className="text-frost/30 text-[10px]">{ring.size || ring.accounts?.length} accounts</p>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(ring.roles || {}).slice(0, 6).map(([acct, role]) => (
                            <span key={acct} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-grape/10 text-orchid/60 border border-grape/15">
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Ring detail */}
                <div>
                  {selectedRing ? (
                    <div className="card space-y-4">
                      <div>
                        <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${SHAPE_COLORS[selectedRing.shape] || ""}`}>
                          {selectedRing.shape} RING
                        </span>
                        <p className="text-frost/50 font-mono text-xs mt-1">{selectedRing.ring_id}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          { l: "Size", v: selectedRing.size || selectedRing.accounts?.length },
                          { l: "Fraud Rate", v: `${(selectedRing.fraud_rate * 100).toFixed(1)}%` },
                          { l: "Confidence", v: `${(selectedRing.confidence * 100).toFixed(0)}%` },
                        ].map(({ l, v }) => (
                          <div key={l} className="bg-night/60 rounded-lg p-2">
                            <p className="font-mono font-bold text-sm text-frost/80">{v}</p>
                            <p className="text-frost/30 text-[10px]">{l}</p>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-frost/40 text-xs uppercase tracking-wider mb-2">Member Roles</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {Object.entries(selectedRing.roles || {}).map(([acct, role]) => (
                            <div key={acct} className="flex items-center gap-2 text-xs py-1 border-b border-grape/8 last:border-0">
                              <span className="text-frost/60 font-mono truncate flex-1">{acct}</span>
                              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                                role === "hub" || role === "orchestrator"
                                  ? "bg-crimson/15 text-crimson"
                                  : role === "bridge"
                                  ? "bg-amber/15 text-amber"
                                  : "bg-grape/10 text-orchid/70"
                              }`}>{role}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {selectedRing.hub_node && (
                        <div className="bg-crimson/8 border border-crimson/20 rounded-lg p-2 text-xs">
                          <span className="text-crimson font-medium">Hub: </span>
                          <span className="text-frost/60 font-mono">{selectedRing.hub_node}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="card flex items-center justify-center h-48 text-frost/30 text-sm">
                      Click a ring to inspect roles
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Communities ── */}
            {tab === "community" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-frost/50 text-sm">Louvain community fraud rates — sorted by risk</p>
                    <div className="flex gap-3 text-xs text-frost/30">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-crimson inline-block" /> &gt;50%</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber inline-block" /> 20-50%</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-jade inline-block" /> &lt;20%</span>
                    </div>
                  </div>
                  <CommunitySummary communities={communities} />
                </div>
                <div className="space-y-3">
                  {[
                    { label: "High-Risk (&gt;50%)", value: highRiskComm.length, color: "text-crimson" },
                    { label: "Total communities", value: communities.length, color: "text-orchid" },
                    { label: "Total accounts", value: communities.reduce((s, c) => s + c.size, 0).toLocaleString(), color: "text-frost" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="card py-4 text-center">
                      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                      <p className="text-frost/40 text-xs mt-0.5" dangerouslySetInnerHTML={{ __html: label }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}