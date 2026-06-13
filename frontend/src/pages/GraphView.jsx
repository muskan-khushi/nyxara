// src/pages/GraphView.jsx
// Mule network topology — deep-space canvas graph + ring inspector + community view

import { useEffect, useState, useCallback, useRef } from "react";
import api from "../services/api";
import NetworkGraph from "../components/graph/NetworkGraph";
import RingViewer   from "../components/graph/RingViewer";
import CommunityView from "../components/graph/CommunityView";

/* ── Build D3 nodes/links from rings API response ── */
function buildGraph(rings) {
  const nodeMap = new Map();
  const links   = [];

  rings.forEach(ring => {
    const roles = ring.roles || {};
    (ring.accounts || []).forEach(id => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          risk:    ring.fraud_rate * (0.85 + Math.random() * 0.15),
          role:    roles[id] || "member",
          in_ring: true,
          ring_id: ring.ring_id,
          shape:   ring.shape,
        });
      }
    });

    const accts = ring.accounts || [];
    const hub   = ring.hub_node;
    if (ring.shape === "STAR" && hub) {
      accts.filter(a => a !== hub).forEach(mule => links.push({ source: hub, target: mule }));
    } else {
      for (let i = 0; i < accts.length - 1; i++)
        links.push({ source: accts[i], target: accts[i + 1] });
      if (ring.shape === "CYCLE" && accts.length > 1)
        links.push({ source: accts[accts.length - 1], target: accts[0] });
    }
  });

  return { nodes: Array.from(nodeMap.values()), links };
}

/* ── Decision color ── */
const riskColor = (r) => {
  if (r > 0.85) return "#f87171";
  if (r > 0.70) return "#fb923c";
  if (r > 0.40) return "#fbbf24";
  return "#34d399";
};

/* ── Federated 3-D simulation (unchanged logic, refreshed styling) ── */
function FederatedGraphSim({ height = 420 }) {
  const canvasRef  = useRef(null);
  const rotRef     = useRef({ x: 0.25, y: 0.4 });
  const mouseRef   = useRef({ down: false, lx: 0, ly: 0 });

  const bankNodes = [
    { id: "SBI",   label: "State Bank of India", x: -75, y: -35, z: -35, color: "#38bdf8" },
    { id: "HDFC",  label: "HDFC Bank",           x:  75, y: -35, z: -35, color: "#fb923c" },
    { id: "ICICI", label: "ICICI Bank",           x:  45, y:  45, z:  55, color: "#c084fc" },
    { id: "AXIS",  label: "Axis Bank",            x: -45, y:  45, z:  55, color: "#34d399" },
    { id: "SMPC",  label: "FedGNN SMPC Node",     x:   0, y:   0, z:   0, color: "#f5f3ff" },
  ];
  const bankLinks = [
    [4,0],[4,1],[4,2],[4,3],[0,1],[1,2],[2,3],[3,0],
  ];

  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const W   = canvas.parentNode.clientWidth;
      canvas.width  = W * dpr;
      canvas.height = height * dpr;
      canvas.style.width  = "100%";
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = bankLinks.map((_, i) => ({
      link: i, progress: Math.random(), speed: 0.004 + Math.random() * 0.005,
    }));

    const loop = () => {
      if (!mouseRef.current.down) rotRef.current.y += 0.0018;

      const W = canvas.width  / (window.devicePixelRatio || 1);
      const H = height;
      ctx.clearRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = "rgba(30,58,138,0.07)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

      const cx = W / 2, cy = H / 2;
      const cosY = Math.cos(rotRef.current.y), sinY = Math.sin(rotRef.current.y);
      const cosX = Math.cos(rotRef.current.x), sinX = Math.sin(rotRef.current.x);

      const proj = bankNodes.map(n => {
        let rx = n.x * cosY - n.z * sinY;
        let rz = n.z * cosY + n.x * sinY;
        let ry = n.y * cosX - rz * sinX;
        rz     = rz * cosX + n.y * sinX;
        const sc = 280 / (280 + rz + 80);
        return { ...n, sx: cx + rx * sc, sy: cy + ry * sc, scale: sc, rz };
      });

      // Edges
      bankLinks.forEach(([si, ti]) => {
        const a = proj[si], b = proj[ti];
        const isHub = si === 4 || ti === 4;
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
        ctx.strokeStyle = isHub ? "rgba(192,132,252,0.18)" : "rgba(251,146,60,0.09)";
        ctx.lineWidth   = isHub ? 0.9 : 1.1;
        ctx.stroke();
      });

      // Particles
      particles.forEach(p => {
        const [si, ti] = bankLinks[p.link];
        const a = proj[si], b = proj[ti];
        const px = a.sx + (b.sx - a.sx) * p.progress;
        const py = a.sy + (b.sy - a.sy) * p.progress;
        const sc = (a.scale + b.scale) / 2;
        const isHub = si === 4 || ti === 4;
        ctx.beginPath(); ctx.arc(px, py, 2.2 * sc, 0, Math.PI * 2);
        ctx.fillStyle = isHub ? "#a78bfa" : "#fb7185";
        ctx.fill();
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;
      });

      // Nodes (depth-sorted)
      [...proj].sort((a, b) => b.rz - a.rz).forEach(n => {
        const r = (n.id === "SMPC" ? 11 : 7) * n.scale;
        ctx.beginPath(); ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2);
        ctx.fillStyle   = n.color + "20"; ctx.fill();
        ctx.strokeStyle = n.color;
        ctx.lineWidth   = n.id === "SMPC" ? 1.8 : 1.2; ctx.stroke();
        ctx.fillStyle = "rgba(245,243,255,0.65)";
        ctx.font      = `600 8px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(n.id === "SMPC" ? "SMPC" : n.id, n.sx, n.sy - r - 5);
      });

      animId = requestAnimationFrame(loop);
    };
    loop();

    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, [height]);

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      style={{ height, background: "radial-gradient(ellipse at 40% 30%, #0d1f3c 0%, #080e1a 70%)" }}
      onMouseDown={e => { mouseRef.current.down = true; mouseRef.current.lx = e.clientX; mouseRef.current.ly = e.clientY; }}
      onMouseMove={e => {
        if (!mouseRef.current.down) return;
        rotRef.current.y += (e.clientX - mouseRef.current.lx) * 0.007;
        rotRef.current.x += (e.clientY - mouseRef.current.ly) * 0.007;
        mouseRef.current.lx = e.clientX; mouseRef.current.ly = e.clientY;
      }}
      onMouseUp={()   => { mouseRef.current.down = false; }}
      onMouseLeave={() => { mouseRef.current.down = false; }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}

/* ── Selected node info panel ── */
function NodePanel({ node }) {
  if (!node) return null;
  const col = riskColor(node.risk || 0);
  const decision = node.risk > 0.85 ? "BLOCK" : node.risk > 0.70 ? "FLAG" : node.risk > 0.40 ? "REVIEW" : "APPROVE";

  return (
    <div
      className="mt-3 rounded-xl border p-3 grid grid-cols-2 md:grid-cols-4 gap-3"
      style={{ background: "rgba(8,14,26,0.7)", borderColor: col + "30" }}
    >
      {[
        { label: "Account ID", value: node.id,                              mono: true },
        { label: "Risk Score", value: `${Math.round((node.risk || 0) * 100)}%`, mono: true, color: col },
        { label: "Role",       value: node.role || "member",                mono: false },
        { label: "Decision",   value: decision,                             mono: true,  color: col },
      ].map(({ label, value, mono, color }) => (
        <div key={label}>
          <p className="text-xs mb-0.5" style={{ color: "rgba(245,243,255,0.35)" }}>{label}</p>
          <p
            className={`text-sm ${mono ? "font-mono" : ""} truncate`}
            style={{ color: color || "rgba(245,243,255,0.8)", fontWeight: color ? 600 : 400 }}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ label, value, color }) {
  return (
    <div className="card py-3 text-center">
      <p className="text-2xl font-bold font-mono" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: "rgba(245,243,255,0.4)" }}>{label}</p>
    </div>
  );
}

/* ── Tab button ── */
function Tab({ id, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className="px-4 py-2 rounded text-sm font-medium transition-all"
      style={{
        background:   active ? "#6d28d9"              : "transparent",
        color:        active ? "#fff"                 : "rgba(245,243,255,0.45)",
        boxShadow:    active ? "0 2px 8px #6d28d920"  : "none",
      }}
    >
      {label}
    </button>
  );
}

const TABS = [
  { id: "network",   label: "Network Graph" },
  { id: "rings",     label: "Ring Topology" },
  { id: "community", label: "Communities"   },
  { id: "federated", label: "Federated"     },
];

/* ── Role legend pill ── */
const LEGEND = [
  { label: "Block",    color: "#f87171" },
  { label: "Flag",     color: "#fb923c" },
  { label: "Review",   color: "#fbbf24" },
  { label: "Approve",  color: "#34d399" },
  { label: "Hub ▲",    color: "#60a5fa" },
  { label: "Bridge ◆", color: "#60a5fa" },
];

export default function GraphView() {
  const [tab,         setTab]         = useState("network");
  const [rings,       setRings]       = useState([]);
  const [communities, setCommunities] = useState([]);
  const [graphData,   setGraphData]   = useState({ nodes: [], links: [] });
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [selected,    setSelected]    = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [rRes, cRes] = await Promise.allSettled([
        api.get("/api/rings"),
        api.get("/api/clusters"),
      ]);
      const fetchedRings       = rRes.status === "fulfilled" ? rRes.value.data.rings    || [] : [];
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
  const highRiskComm  = communities.filter(c => c.fraud_rate > 0.5);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#f5f3ff" }}>Graph Intelligence</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(245,243,255,0.35)" }}>
            GNN-detected mule rings · Louvain community fraud rates
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs font-mono" style={{ color: "rgba(245,243,255,0.2)" }}>
              {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="btn-outline text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 0 1 2 7M2 7l2-2M2 7l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Rings"      value={rings.length}            color="#c084fc" />
        <StatCard label="High-Risk Rings"  value={highRiskRings.length}    color="#f87171" />
        <StatCard label="Communities"      value={communities.length}      color="#38bdf8" />
        <StatCard label="Nodes Mapped"     value={graphData.nodes.length}  color="#f5f3ff" />
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm border" style={{ background: "rgba(251,191,36,0.06)", borderColor: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>
          ⚠ {error}
        </div>
      )}

      {/* Tab switcher */}
      <div
        className="flex gap-1 rounded-lg p-1 w-fit border"
        style={{ background: "#120824", borderColor: "rgba(109,40,217,0.2)" }}
      >
        {TABS.map(({ id, label }) => (
          <Tab key={id} id={id} label={label} active={tab === id} onClick={setTab} />
        ))}
      </div>

      {/* Tab content */}
      <div className="card min-h-[560px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-10 h-10 rounded-full animate-spin border-2" style={{ borderColor: "rgba(109,40,217,0.2)", borderTopColor: "#6d28d9" }} />
            <p className="text-sm" style={{ color: "rgba(245,243,255,0.3)" }}>Loading graph data…</p>
          </div>
        ) : (
          <>
            {/* ── Network Graph ── */}
            {tab === "network" && (
              <div>
                {/* Sub-header */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm" style={{ color: "rgba(245,243,255,0.4)" }}>
                    {graphData.nodes.length} nodes · {graphData.links.length} edges
                    {selected && (
                      <span className="ml-3 font-mono" style={{ color: "#c084fc" }}>
                        · {selected.id} ({selected.role})
                      </span>
                    )}
                  </p>
                  {/* Legend */}
                  <div className="flex gap-3 flex-wrap">
                    {LEGEND.map(({ label, color }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-xs" style={{ color: "rgba(245,243,255,0.4)" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hint */}
                <p className="text-xs mb-2" style={{ color: "rgba(245,243,255,0.2)" }}>
                  Scroll to zoom · Drag to pan · Click node to inspect
                </p>

                {graphData.nodes.length > 0 ? (
                  <>
                    <NetworkGraph
                      nodes={graphData.nodes}
                      links={graphData.links}
                      onNodeClick={setSelected}
                      height={460}
                    />
                    <NodePanel node={selected} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="text-5xl mb-4 opacity-20">🕸️</div>
                    <p className="text-sm" style={{ color: "rgba(245,243,255,0.3)" }}>No ring data yet.</p>
                    <p className="text-xs mt-1" style={{ color: "rgba(245,243,255,0.2)" }}>
                      Run <code style={{ color: "#c084fc" }}>training/run_all.py</code> to detect rings.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Ring Topology ── */}
            {tab === "rings" && <RingViewer rings={rings} />}

            {/* ── Communities ── */}
            {tab === "community" && <CommunityView communities={communities} />}

            {/* ── Federated Intelligence ── */}
            {tab === "federated" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                  <p className="text-sm mb-3" style={{ color: "rgba(245,243,255,0.4)" }}>
                    Cross-bank federated GNN — drag to rotate · Secure SMPC weight exchange
                  </p>
                  <FederatedGraphSim height={420} />
                </div>
                <div className="space-y-4">
                  <div className="card space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider font-mono" style={{ color: "rgba(245,243,255,0.5)" }}>
                      Cross-Bank SMURFing Loop
                    </h3>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(245,243,255,0.4)" }}>
                      A single bank sees only its own nodes. Homomorphic GNN embeddings across SBI, HDFC, and ICICI expose cyclic flows that span bank boundaries before cash-out.
                    </p>
                    <div className="p-3 rounded-lg text-xs font-mono space-y-1.5" style={{ background: "rgba(8,14,26,0.5)", border: "1px solid rgba(109,40,217,0.15)", color: "#c084fc" }}>
                      <p>🏦 SBI → HDFC  ₹49,900</p>
                      <p>🏦 HDFC → ICICI ₹49,500</p>
                      <p>🏦 ICICI → SBI  ATM withdrawal</p>
                      <p className="font-bold" style={{ color: "#f87171" }}>⚠ Cross-bank cycle detected</p>
                    </div>
                  </div>
                  <div className="card text-center py-6">
                    <p className="text-xs font-mono mb-2 uppercase tracking-wide" style={{ color: "rgba(245,243,255,0.3)" }}>Privacy level</p>
                    <p className="text-3xl font-bold font-mono" style={{ color: "#34d399" }}>100%</p>
                    <p className="text-xs mt-1 leading-relaxed max-w-xs mx-auto" style={{ color: "rgba(245,243,255,0.4)" }}>
                      No raw customer data shared. Only encrypted neural-network gradients are exchanged.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}