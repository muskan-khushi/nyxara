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
      <span className="text-frost/40 text-[10px] font-mono w-40 truncate flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-grape/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-750"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
      <span className="text-frost/70 text-xs font-mono w-8 text-right">{Math.round(value * 100)}</span>
      <span className="text-frost/25 text-[9px] w-14 text-right flex-shrink-0 font-mono">{weight}</span>
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
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(109,40,217,0.08)" }} />
        <ReferenceLine x={0} stroke="rgba(109,40,217,0.3)" strokeWidth={1} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value > 0 ? "var(--crimson)" : "var(--jade)"} fillOpacity={0.85} />
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
    const colors = { APPROVE: "var(--jade)", REVIEW: "var(--amber)", FLAG: "var(--orange)", BLOCK: "var(--crimson)" };
    const color = colors[decision] || "var(--grape)";
    let cur = 0;
    const target = score;

    const draw = (v) => {
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = "rgba(109,40,217,0.12)";
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
  F115: "0", F321: "0", F527: "", F531: "", F670: "0",
  F1692: "", F2082: "", F2122: "", F2582: "", F2678: "0",
  F2737: "", F2956: "", F3043: "", F3836: "", F3887: "",
  F3889: "", F3891: "student", F3894: "",
};

const FEATURE_GROUPS = {
  txn: [
    { key: "F3836", label: "Avg Transaction Value (₹)", type: "number", hint: "Average amount per transaction in window", placeholder: "e.g. 50000" },
    { key: "F3894", label: "Velocity (Txns/24h)", type: "number", hint: "Transaction count in past 24 hours", placeholder: "e.g. 5" },
    { key: "F527",  label: "Debit/Credit Pass-Through Ratio", type: "number", hint: "Outflow/inflow flow ratio (0.0 to 1.0)", placeholder: "e.g. 0.95" },
    { key: "F2122", label: "Cash Deposit Frequency", type: "number", hint: "Ratio of cash deposit txns (0.0 to 1.0)", placeholder: "e.g. 0.3" },
    { key: "F2582", label: "Avg Transaction Spacing (min)", type: "number", hint: "Average time spacing between transactions", placeholder: "e.g. 15" },
    { key: "F2956", label: "Out-of-Hours Ratio", type: "number", hint: "Ratio of late-night/irregular hour transactions", placeholder: "e.g. 0.1" },
    { key: "F321",  label: "Outbound Velocity Surge", type: "select", options: ["", "0", "1"], hint: "Sudden outbound transfer volume spike detected", placeholder: "" },
    { key: "F115",  label: "Dormancy Trigger Flag", type: "select", options: ["", "0", "1"], hint: "Account activated after >180 days of dormancy", placeholder: "" }
  ],
  network: [
    { key: "F1692", label: "Linked Accounts Count", type: "number", hint: "Number of accounts sharing device/phone signals", placeholder: "e.g. 2" },
    { key: "F670",  label: "High-Risk Peer Connection", type: "select", options: ["", "0", "1"], hint: "Direct transaction connection to a blacklisted mule", placeholder: "" },
    { key: "F531",  label: "Community Fraud Density", type: "number", hint: "Fraud rate inside the network cluster (0.0 to 1.0)", placeholder: "e.g. 0.12" },
    { key: "F2082", label: "International Exposure Ratio", type: "number", hint: "Ratio of cross-border transfers", placeholder: "e.g. 0.0" },
    { key: "F2737", label: "IP Geolocation Changes (24h)", type: "number", hint: "Unique IP regions logged in past 24 hours", placeholder: "e.g. 1" },
    { key: "F2678", label: "Failed Login Attempts", type: "number", hint: "Failed auth attempts in past 24 hours", placeholder: "e.g. 0" }
  ],
  profile: [
    { key: "F3887", label: "Customer Age", type: "number", hint: "Age of the account holder", placeholder: "e.g. 28" },
    { key: "F3891", label: "Declared Occupation", type: "select", options: OCCUPATIONS, hint: "Customer declared occupation", placeholder: "" },
    { key: "F3043", label: "Account Tenure (days)", type: "number", hint: "Days elapsed since account opening", placeholder: "e.g. 365" },
    { key: "F3889", label: "Branch Code", type: "text", hint: "Core branch location identifier", placeholder: "e.g. G365D" }
  ]
};

const PRESETS = [
  {
    name: "Safe Saver Profile",
    icon: "🛡️",
    desc: "Typical retail customer with normal transactions",
    accountId: "ACC-NORMAL",
    features: {
      F115: "0", F321: "0", F527: "0.12", F531: "0.01", F670: "0",
      F1692: "1", F2082: "0.0", F2122: "0.1", F2582: "120", F2678: "0",
      F2737: "1", F2956: "0.02", F3043: "620", F3836: "12500", F3887: "38",
      F3889: "H290B", F3891: "salaried", F3894: "2",
    }
  },
  {
    name: "Student Mule Setup",
    icon: "🎓",
    desc: "Young account, sudden velocity, dormant activation",
    accountId: "ACC-7832",
    features: {
      F115: "1", F321: "1", F527: "0.94", F531: "0.78", F670: "1",
      F1692: "6", F2082: "0.3", F2122: "0.7", F2582: "5", F2678: "0",
      F2737: "4", F2956: "0.45", F3043: "25", F3836: "450000", F3887: "19",
      F3889: "G365D", F3891: "student", F3894: "85",
    }
  },
  {
    name: "Cash Smurfing Ring",
    icon: "💰",
    desc: "Multiple cash deposits below reporting limits",
    accountId: "ACC-SMURF-CASH",
    features: {
      F115: "0", F321: "0", F527: "0.85", F531: "0.42", F670: "0",
      F1692: "3", F2082: "0.0", F2122: "0.92", F2582: "8", F2678: "1",
      F2737: "1", F2956: "0.15", F3043: "180", F3836: "49500", F3887: "46",
      F3889: "K401C", F3891: "housewife", F3894: "42",
    }
  },
  {
    name: "Layering Conduit",
    icon: "🌐",
    desc: "Cross-border transfers, high linked device signals",
    accountId: "ACC-LAYERING-INT",
    features: {
      F115: "0", F321: "1", F527: "0.99", F531: "0.88", F670: "1",
      F1692: "8", F2082: "0.88", F2122: "0.15", F2582: "12", F2678: "2",
      F2737: "6", F2956: "0.65", F3043: "90", F3836: "2500000", F3887: "32",
      F3889: "B210A", F3891: "selfemployed", F3894: "38",
    }
  }
];

/* ── Interactive 3D Canvas Graph Component ── */
function Gnn3DGraph({ accountId, ringMembership, finalRisk, height = 280 }) {
  const canvasRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const mouseRef = useRef({ x: -100, y: -100, isDown: false, lastX: 0, lastY: 0 });
  const rotationRef = useRef({ x: 0.3, y: 0.4 });

  // Generate nodes once
  const nodesRef = useRef([]);
  const linksRef = useRef([]);

  if (!nodesRef.current.length) {
    const nodes = [];
    const links = [];
    
    // Center target node
    nodes.push({ id: accountId, x: 0, y: 0, z: 0, risk: finalRisk, role: "Target", r: 12 });
    
    const numPeers = ringMembership ? 6 : 4;
    for (let i = 0; i < numPeers; i++) {
      const angle = (i / numPeers) * Math.PI * 2;
      const rDist = 95;
      nodes.push({
        id: `ACC-PEER-0${i + 1}`,
        x: Math.cos(angle) * rDist,
        y: (Math.random() - 0.5) * 60,
        z: Math.sin(angle) * rDist,
        risk: ringMembership ? 0.75 + Math.random() * 0.22 : 0.04 + Math.random() * 0.12,
        role: ringMembership ? (i === 0 ? "Hub" : i === 1 ? "Bridge" : "Mule Peer") : "Safe Connection",
        r: 8
      });
      links.push({ source: 0, target: i + 1 });
    }

    if (ringMembership) {
      // Connect peers in a ring cycle
      for (let i = 1; i <= numPeers; i++) {
        const next = i === numPeers ? 1 : i + 1;
        links.push({ source: i, target: next });
      }
    }
    nodesRef.current = nodes;
    linksRef.current = links;
  }

  const handleMouseDown = (e) => {
    mouseRef.current.isDown = true;
    mouseRef.current.lastX = e.clientX;
    mouseRef.current.lastY = e.clientY;
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const mouse = mouseRef.current;
    mouse.x = x;
    mouse.y = y;

    if (mouse.isDown) {
      const dx = e.clientX - mouse.lastX;
      const dy = e.clientY - mouse.lastY;
      rotationRef.current.y += dx * 0.007;
      rotationRef.current.x += dy * 0.007;
      mouse.lastX = e.clientX;
      mouse.lastY = e.clientY;
    }
  };

  const handleMouseUpOrLeave = () => {
    mouseRef.current.isDown = false;
  };

  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const rect = canvas.parentNode.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = "100%";
      canvas.style.height = `${height}px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const autoRotateSpeed = 0.003;
    const particles = [];
    linksRef.current.forEach((link, idx) => {
      particles.push({
        linkIdx: idx,
        progress: Math.random(),
        speed: 0.008 + Math.random() * 0.008
      });
    });

    const loop = () => {
      if (!mouseRef.current.isDown) {
        rotationRef.current.y += autoRotateSpeed;
      }

      const W = canvas.width / window.devicePixelRatio;
      const H = height;
      const cx = W / 2;
      const cy = H / 2;

      ctx.clearRect(0, 0, W, H);

      // Draw subtle background grid/nodes
      ctx.fillStyle = "rgba(167, 139, 250, 0.06)";
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          for (let k = -1; k <= 1; k++) {
            if (i === 0 && j === 0 && k === 0) continue;
            const gx = i * 110, gy = j * 100, gz = k * 110;
            const cosY = Math.cos(rotationRef.current.y), sinY = Math.sin(rotationRef.current.y);
            let rx = gx * cosY - gz * sinY;
            let rz = gz * cosY + gx * sinY;
            const cosX = Math.cos(rotationRef.current.x), sinX = Math.sin(rotationRef.current.x);
            let ry = gy * cosX - rz * sinX;
            rz = rz * cosX + gy * sinX;
            const scale = 200 / (200 + rz + 180);
            if (scale > 0) {
              ctx.beginPath();
              ctx.arc(cx + rx * scale, cy + ry * scale, 1.2 * scale, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // Rotate and project nodes
      const projectedNodes = nodesRef.current.map(node => {
        const cosY = Math.cos(rotationRef.current.y), sinY = Math.sin(rotationRef.current.y);
        let rx = node.x * cosY - node.z * sinY;
        let rz = node.z * cosY + node.x * sinY;

        const cosX = Math.cos(rotationRef.current.x), sinX = Math.sin(rotationRef.current.x);
        let ry = node.y * cosX - rz * sinX;
        rz = rz * cosX + node.y * sinX;

        const focal = 180;
        const scale = focal / (focal + rz + 140);
        const sx = cx + rx * scale;
        const sy = cy + ry * scale;

        return { ...node, rx, ry, rz, sx, sy, scale };
      });

      // Draw connection lines
      projectedNodes.forEach((node, idx) => {
        linksRef.current.forEach(link => {
          if (link.source === idx) {
            const other = projectedNodes[link.target];
            ctx.beginPath();
            ctx.moveTo(node.sx, node.sy);
            ctx.lineTo(other.sx, other.sy);
            const alpha = Math.min(0.25, Math.max(0.05, 0.22 * ((node.scale + other.scale) / 2)));
            ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      // Draw flowing connection particles
      particles.forEach(p => {
        const link = linksRef.current[p.linkIdx];
        const sNode = projectedNodes[link.source];
        const tNode = projectedNodes[link.target];
        const px = sNode.sx + (tNode.sx - sNode.sx) * p.progress;
        const py = sNode.sy + (tNode.sy - sNode.sy) * p.progress;
        const avgScale = (sNode.scale + tNode.scale) / 2;

        ctx.beginPath();
        ctx.arc(px, py, 2 * avgScale, 0, Math.PI * 2);
        ctx.fillStyle = "#A78BFA";
        ctx.shadowColor = "#A78BFA";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;

        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;
      });

      // Render nodes using Painter's algorithm
      const sorted = [...projectedNodes].sort((a, b) => b.rz - a.rz);
      let hovered = null;
      const mouse = mouseRef.current;

      sorted.forEach(node => {
        const r = node.r * node.scale;
        if (r <= 0) return;
        const dist = Math.hypot(node.sx - mouse.x, node.sy - mouse.y);
        const isHovered = dist < r + 5;
        if (isHovered) hovered = node;

        const color = node.risk > 0.8 ? "#FB7185" : node.risk > 0.5 ? "#FB923C" : node.risk > 0.3 ? "#FBBF24" : "#34D399";

        // Glow shell
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? "rgba(167, 139, 250, 0.12)" : `${color}0A`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.sx, node.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = isHovered ? "#A78BFA" : `${color}25`;
        ctx.fill();

        ctx.strokeStyle = isHovered ? "#F5F3FF" : color;
        ctx.lineWidth = isHovered ? 2.2 : 1.2;
        ctx.stroke();

        if (isHovered || node.role === "Target") {
          ctx.fillStyle = "rgba(245, 243, 255, 0.85)";
          ctx.font = node.role === "Target" ? "bold 10px Inter" : "9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(node.role === "Target" ? "Target Account" : node.id, node.sx, node.sy - r - 6);
        }
      });

      setHoveredNode(hovered);
      animId = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [height]);

  return (
    <div className="relative overflow-hidden w-full bg-night/30 rounded-xl" style={{ height }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        style={{ cursor: "grab", display: "block" }}
      />
      {hoveredNode && (
        <div className="absolute bottom-3 left-3 right-3 bg-abyss/90 border border-grape/30 rounded-lg p-2.5 text-[11px] font-mono backdrop-blur-md animate-fade-in shadow-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-orchid font-semibold">{hoveredNode.id}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
              hoveredNode.risk > 0.8 
                ? "bg-crimson/15 text-crimson border-crimson/30" 
                : hoveredNode.risk > 0.5 
                ? "bg-orange-500/15 text-orange-400 border-orange-500/30" 
                : "bg-jade/15 text-jade border-jade/30"
            }`}>
              {hoveredNode.role}
            </span>
          </div>
          <div className="flex items-center justify-between text-frost/40">
            <span>Graph Risk Score:</span>
            <span className="font-bold text-frost/80">{Math.round(hoveredNode.risk * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 3D Standby Wireframe Sphere Component ── */
function Gnn3DPlaceholder({ height = 240 }) {
  const canvasRef = useRef(null);
  const rotationRef = useRef({ x: 0.2, y: 0.3 });

  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const rect = canvas.parentNode.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = "100%";
      canvas.style.height = `${height}px`;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const points = [];
    const numLat = 6;
    const numLon = 9;
    const rDist = 75;

    for (let i = 1; i < numLat; i++) {
      const lat = (i / numLat) * Math.PI;
      for (let j = 0; j < numLon; j++) {
        const lon = (j / numLon) * Math.PI * 2;
        points.push({
          x: Math.sin(lat) * Math.cos(lon) * rDist,
          y: Math.cos(lat) * rDist,
          z: Math.sin(lat) * Math.sin(lon) * rDist
        });
      }
    }

    const loop = () => {
      rotationRef.current.y += 0.0025;
      rotationRef.current.x += 0.0008;

      const W = canvas.width / window.devicePixelRatio;
      const H = height;
      const cx = W / 2;
      const cy = H / 2;

      ctx.clearRect(0, 0, W, H);

      const projected = points.map(pt => {
        const cosY = Math.cos(rotationRef.current.y), sinY = Math.sin(rotationRef.current.y);
        let rx = pt.x * cosY - pt.z * sinY;
        let rz = pt.z * cosY + pt.x * sinY;

        const cosX = Math.cos(rotationRef.current.x), sinX = Math.sin(rotationRef.current.x);
        let ry = pt.y * cosX - rz * sinX;
        rz = rz * cosX + pt.y * sinX;

        const scale = 200 / (200 + rz + 100);
        return { sx: cx + rx * scale, sy: cy + ry * scale, scale };
      });

      ctx.strokeStyle = "rgba(167, 139, 250, 0.07)";
      ctx.lineWidth = 0.5;

      for (let i = 0; i < numLat - 1; i++) {
        for (let j = 0; j < numLon; j++) {
          const idx = i * numLon + j;
          const right = i * numLon + ((j + 1) % numLon);
          const down = (i + 1) * numLon + j;

          if (projected[idx] && projected[right]) {
            ctx.beginPath();
            ctx.moveTo(projected[idx].sx, projected[idx].sy);
            ctx.lineTo(projected[right].sx, projected[right].sy);
            ctx.stroke();
          }
          if (i < numLat - 2 && projected[idx] && projected[down]) {
            ctx.beginPath();
            ctx.moveTo(projected[idx].sx, projected[idx].sy);
            ctx.lineTo(projected[down].sx, projected[down].sy);
            ctx.stroke();
          }
        }
      }

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(109, 40, 217, 0.15)";
      ctx.strokeStyle = "rgba(167, 139, 250, 0.3)";
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();

      animId = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [height]);

  return <canvas ref={canvasRef} className="block mx-auto opacity-60" />;
}

/* ── Behavioral Biometrics HUD Component ── */
function BiometricsHUD() {
  const canvasRef = useRef(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [integrityScore, setIntegrityScore] = useState(99);
  const [status, setStatus] = useState("SECURE"); // SECURE | BOT_ALERT | RAT_ALERT
  const [metrics, setMetrics] = useState({ speedVar: 14.2, curvature: 82, keysCv: 0.38 });
  const [simMode, setSimMode] = useState(null); // 'bot' | 'rat' | null
  
  const mouseHistory = useRef([]);
  const keyTimings = useRef([]);
  const sweepAngle = useRef(0);

  // Track keystrokes
  useEffect(() => {
    const handleKeyDown = () => {
      keyTimings.current.push(Date.now());
      if (keyTimings.current.length > 20) keyTimings.current.shift();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Track mouse moves on window
  useEffect(() => {
    if (simMode) return; // ignore real mouse if simulating

    const handleMouseMove = (e) => {
      setCoords({ x: e.clientX, y: e.clientY });
      mouseHistory.current.push({ x: e.clientX, y: e.clientY, ts: Date.now() });
      if (mouseHistory.current.length > 50) mouseHistory.current.shift();
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [simMode]);

  // Simulation runner
  useEffect(() => {
    if (!simMode) return;

    let frameId;
    let step = 0;
    const runSim = () => {
      step++;
      const time = Date.now();
      if (simMode === "bot") {
        const startX = 100, startY = 100;
        const endX = 500, endY = 400;
        const t = (step % 60) / 60;
        const x = startX + (endX - startX) * t;
        const y = startY + (endY - startY) * t;
        setCoords({ x: Math.round(x), y: Math.round(y) });
        mouseHistory.current.push({ x, y, ts: time });
        if (mouseHistory.current.length > 50) mouseHistory.current.shift();
      } else if (simMode === "rat") {
        if (step % 15 === 0) {
          const x = Math.random() * window.innerWidth;
          const y = Math.random() * window.innerHeight;
          setCoords({ x: Math.round(x), y: Math.round(y) });
          for (let i = 0; i < 5; i++) {
            mouseHistory.current.push({ x, y, ts: time - i * 10 });
          }
          if (mouseHistory.current.length > 50) mouseHistory.current.shift();
        }
      }
      frameId = requestAnimationFrame(runSim);
    };

    frameId = requestAnimationFrame(runSim);
    return () => cancelAnimationFrame(frameId);
  }, [simMode]);

  // Analysis & Canvas Loop
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const parent = canvas.parentNode;
      const w = parent ? parent.clientWidth : 200;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = 110 * window.devicePixelRatio;
      canvas.style.width = "100%";
      canvas.style.height = "110px";
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      const W = canvas.width / window.devicePixelRatio;
      const H = 110;
      const cx = W / 2;
      const cy = H / 2;

      ctx.clearRect(0, 0, W, H);

      // 1. Draw Radar background grid
      ctx.strokeStyle = "rgba(167, 139, 250, 0.08)";
      ctx.lineWidth = 1;
      
      [20, 40, 50].forEach(r => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      ctx.beginPath();
      ctx.moveTo(cx - 70, cy); ctx.lineTo(cx + 70, cy);
      ctx.moveTo(cx, cy - 50); ctx.lineTo(cx, cy + 50);
      ctx.stroke();

      // 2. Draw sonar sweep
      sweepAngle.current += 0.03;
      const sweepX = cx + Math.cos(sweepAngle.current) * 50;
      const sweepY = cy + Math.sin(sweepAngle.current) * 50;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sweepX, sweepY);
      ctx.strokeStyle = "rgba(167, 139, 250, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 3. Draw mouse trail projected on canvas
      const pts = mouseHistory.current;
      if (pts.length > 1) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        pts.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });

        const dx = maxX - minX || 1;
        const dy = maxY - minY || 1;
        const maxDelta = Math.max(dx, dy);

        ctx.beginPath();
        pts.forEach((p, idx) => {
          const px = cx + ((p.x - (minX + maxX)/2) / maxDelta) * 80;
          const py = cy + ((p.y - (minY + maxY)/2) / maxDelta) * 80;

          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });

        let trailColor = "rgba(167, 139, 250, 0.6)";
        if (status === "BOT_ALERT") trailColor = "rgba(251, 113, 133, 0.8)";
        else if (status === "RAT_ALERT") trailColor = "rgba(251, 146, 60, 0.8)";
        else if (pts.length > 5) trailColor = "rgba(52, 211, 153, 0.8)";

        ctx.strokeStyle = trailColor;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = trailColor;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        const lastPt = pts[pts.length - 1];
        const hx = cx + ((lastPt.x - (minX + maxX)/2) / maxDelta) * 80;
        const hy = cy + ((lastPt.y - (minY + maxY)/2) / maxDelta) * 80;
        ctx.beginPath();
        ctx.arc(hx, hy, 3, 0, Math.PI * 2);
        ctx.fillStyle = status === "SECURE" ? "var(--jade)" : "var(--crimson)";
        ctx.fill();
      }

      animId = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [status]);

  // Real-time metrics analyzer
  useEffect(() => {
    const interval = setInterval(() => {
      const pts = mouseHistory.current;
      const keys = keyTimings.current;

      let keysCv = 0.38;
      if (keys.length > 3) {
        const deltas = [];
        for (let i = 1; i < keys.length; i++) deltas.push(keys[i] - keys[i - 1]);
        const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        const variance = deltas.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / deltas.length;
        keysCv = parseFloat((Math.sqrt(variance) / (mean || 1)).toFixed(3));
      }

      let speedVar = 15.4;
      let curvature = 75;

      if (pts.length > 6) {
        const speeds = [];
        const angles = [];
        for (let i = 1; i < pts.length; i++) {
          const dx = pts[i].x - pts[i - 1].x;
          const dy = pts[i].y - pts[i - 1].y;
          const dt = pts[i].ts - pts[i - 1].ts || 1;
          const dist = Math.hypot(dx, dy);
          speeds.push(dist / dt);
          angles.push(Math.atan2(dy, dx));
        }

        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        const speedVariance = speeds.reduce((s, v) => s + Math.pow(v - avgSpeed, 2), 0) / speeds.length;
        speedVar = parseFloat(speedVariance.toFixed(2));

        let angleChanges = 0;
        for (let i = 1; i < angles.length; i++) {
          let diff = Math.abs(angles[i] - angles[i - 1]);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          angleChanges += diff;
        }
        curvature = Math.min(98, Math.max(5, Math.round((angleChanges / angles.length) * 120)));
      }

      let integrity = 99;
      let state = "SECURE";

      if (simMode === "bot") {
        integrity = 4;
        state = "BOT_ALERT";
        speedVar = 0;
        curvature = 0;
        keysCv = 0.01;
      } else if (simMode === "rat") {
        integrity = 12;
        state = "RAT_ALERT";
        speedVar = 345.2;
        curvature = 8;
        keysCv = 0.88;
      } else {
        if (pts.length > 10) {
          if (speedVar < 0.02) {
            integrity = 18;
            state = "BOT_ALERT";
          } else if (speedVar > 220) {
            integrity = 35;
            state = "RAT_ALERT";
          } else {
            integrity = Math.min(99, 85 + Math.round(Math.random() * 14));
            state = "SECURE";
          }
        } else {
          integrity = 99;
          state = "SECURE";
        }
      }

      setIntegrityScore(integrity);
      setStatus(state);
      setMetrics({ speedVar, curvature, keysCv });
    }, 400);

    return () => clearInterval(interval);
  }, [simMode]);

  return (
    <div className="card space-y-3.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-frost/70 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
          <span>👤 Behavioral Biometrics Sensor (BEI)</span>
        </h3>
        <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider border ${
          status === "SECURE" 
            ? "bg-jade/15 text-jade border-jade/30" 
            : status === "BOT_ALERT"
            ? "bg-crimson/15 text-crimson border-crimson/30 animate-pulse"
            : "bg-orange-500/15 text-orange-400 border-orange-500/30 animate-pulse"
        }`}>
          {status === "SECURE" ? "SECURE" : status === "BOT_ALERT" ? "ROBOT BOT DETECTED" : "RAT REMOTE INTRUSION"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative border border-grape/15 bg-night/50 rounded-xl overflow-hidden h-[110px]">
          <canvas ref={canvasRef} />
          <div className="absolute bottom-1 right-2 text-[8px] font-mono text-frost/30">
            X: {coords.x} Y: {coords.y}
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-2.5">
          <div className="flex items-center justify-between bg-night/50 border border-grape/10 rounded-lg p-2">
            <div>
              <p className="text-frost/30 text-[9px] font-mono uppercase">Biometric Integrity</p>
              <p className={`text-lg font-bold font-mono ${integrityScore > 70 ? "text-jade" : "text-crimson"}`}>
                {integrityScore}% Human
              </p>
            </div>
            <div className="text-right">
              <p className="text-frost/30 text-[9px] font-mono uppercase">Sensor State</p>
              <p className="text-[10px] font-mono font-semibold text-frost/70">
                {simMode ? "Simulation" : "Scanning"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[9px] font-mono">
            <div className="bg-night/50 border border-grape/10 rounded p-1.5">
              <p className="text-frost/30 mb-0.5">Speed Var</p>
              <p className="text-frost/80 font-bold">{metrics.speedVar}</p>
            </div>
            <div className="bg-night/50 border border-grape/10 rounded p-1.5">
              <p className="text-frost/30 mb-0.5">Curve Dev</p>
              <p className="text-frost/80 font-bold">{metrics.curvature}%</p>
            </div>
            <div className="bg-night/50 border border-grape/10 rounded p-1.5">
              <p className="text-frost/30 mb-0.5">Key Cv</p>
              <p className="text-frost/80 font-bold">{metrics.keysCv}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t border-grape/10">
        <button
          type="button"
          onClick={() => setSimMode(m => m === "bot" ? null : "bot")}
          className={`flex-1 text-[9px] font-mono py-1 rounded transition-colors border ${
            simMode === "bot" 
              ? "bg-crimson/20 border-crimson/50 text-crimson" 
              : "bg-grape/15 border-grape/25 text-orchid hover:bg-grape/25"
          }`}
        >
          {simMode === "bot" ? "Stop Bot Sim" : "Sim Script Bot"}
        </button>
        <button
          type="button"
          onClick={() => setSimMode(m => m === "rat" ? null : "rat")}
          className={`flex-1 text-[9px] font-mono py-1 rounded transition-colors border ${
            simMode === "rat" 
              ? "bg-orange-500/20 border-orange-500/50 text-orange-400" 
              : "bg-grape/15 border-grape/25 text-orchid hover:bg-grape/25"
          }`}
        >
          {simMode === "rat" ? "Stop RAT Sim" : "Sim RAT Hijack"}
        </button>
      </div>
    </div>
  );
}

export default function Analyzer() {
  const [accountId, setAccountId] = useState("");
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("scores");
  const [formTab, setFormTab] = useState("txn");

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

  function applyPreset(preset) {
    setAccountId(preset.accountId);
    setFeatures(preset.features);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-frost">Account Analyzer</h1>
          <p className="text-frost/40 text-sm mt-0.5">Categorized risk parameters & interactive 3D transaction topology analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Input form — 2 cols */}
        <div className="xl:col-span-2 space-y-4">
          <div className="card space-y-4">
          <div>
            <h2 className="text-frost/70 font-semibold text-xs mb-2 uppercase tracking-wider">Quick Anomaly Presets</h2>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(preset => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="p-2 rounded-lg border border-grape/15 bg-night/50 hover:bg-grape/10 hover:border-grape/35 text-left transition-all duration-150 flex items-start gap-2 group"
                >
                  <span className="text-sm group-hover:scale-110 transition-transform">{preset.icon}</span>
                  <div className="min-w-0">
                    <p className="text-frost/80 font-semibold text-[10px] leading-none mb-0.5 truncate">{preset.name}</p>
                    <p className="text-frost/30 text-[9px] leading-tight line-clamp-1">{preset.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-grape/10" />

          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label className="text-frost/50 text-[10px] mb-1.5 block font-mono uppercase tracking-wider">Account ID *</label>
              <input
                className="input font-mono text-sm"
                placeholder="e.g. ACC-7832"
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                required
              />
            </div>

            {/* Form Category Tabs */}
            <div className="flex gap-1 bg-night/60 rounded-lg p-1 border border-grape/15">
              {[
                { id: "txn", label: "📊 Transaction" },
                { id: "network", label: "🌐 Network" },
                { id: "profile", label: "👤 Profile" }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFormTab(t.id)}
                  className={`flex-1 text-center py-1.5 rounded text-[10px] font-medium transition-all ${
                    formTab === t.id ? "bg-grape text-white" : "text-frost/40 hover:text-frost hover:bg-grape/5"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Active tab fields list */}
            <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
              {FEATURE_GROUPS[formTab].map(field => (
                <div key={field.key} className="group flex flex-col space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-frost/70 text-xs font-medium flex items-center gap-1.5">
                      <span>{field.label}</span>
                      <span className="text-frost/25 text-[9px] font-mono">{field.key}</span>
                    </label>
                  </div>
                  
                  {field.type === "select" ? (
                    <select
                      className="input text-xs py-1.5"
                      value={features[field.key]}
                      onChange={e => setFeatures(f => ({ ...f, [field.key]: e.target.value }))}
                    >
                      {field.options.map(o => <option key={o} value={o}>{o || "Unset"}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      className="input text-xs font-mono py-1.5"
                      placeholder={field.placeholder}
                      value={features[field.key]}
                      onChange={e => setFeatures(f => ({ ...f, [field.key]: e.target.value }))}
                    />
                  )}
                  <span className="text-frost/30 text-[9px] leading-tight group-focus-within:text-orchid/60 transition-colors">
                    {field.hint}
                  </span>
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-crimson/8 border border-crimson/20 rounded-lg px-3 py-2 text-crimson text-xs">
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Running 6-Layer Stack…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Run Risk Analyzer
                </>
              )}
            </button>
          </form>
          </div>
          <BiometricsHUD />
        </div>

        {/* Results — 3 cols */}
        <div className="xl:col-span-3 space-y-4">
          {!result && !loading && (
            <div className="card flex flex-col items-center justify-center py-12 text-center h-[460px] border-dashed border-grape/25">
              <div className="w-full max-w-[260px] mb-4">
                <Gnn3DPlaceholder height={200} />
              </div>
              <p className="text-frost/60 text-sm font-semibold mb-1">GNN Scanner Standby</p>
              <p className="text-frost/30 text-xs max-w-xs mx-auto leading-relaxed">
                Click a scenario preset on the left or enter a custom account configuration, then start the analyzer to view deep network risk projections.
              </p>
            </div>
          )}

          {loading && (
            <div className="card flex flex-col items-center justify-center py-20 gap-4 h-[460px]">
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
                      {result.alertText || "Analysis complete. Review layer scores for details."}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { l: "Risk Score", v: `${Math.round(result.finalRisk * 100)}%` },
                        { l: "Topology Ring", v: result.ringMembership ? "DETECTED" : "NONE" },
                        { l: "Policy Override", v: result.overrideApplied ? "APPLIED" : "NONE" },
                      ].map(({ l, v }) => (
                        <div key={l} className="bg-night/60 rounded-lg p-2 border border-grape/10">
                          <p className={`text-xs font-mono font-bold ${l.includes("Score") ? "text-orchid" : "text-frost/80"}`}>{v}</p>
                          <p className="text-frost/30 text-[9px] mt-0.5 uppercase tracking-wide">{l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="card space-y-4">
                <div className="flex gap-1 bg-night/60 rounded-lg p-1 border border-grape/15 w-fit">
                  {[
                    { id: "scores", label: "Layer Scores" },
                    { id: "graph", label: "3D GNN Topology" },
                    { id: "shap", label: "SHAP Analysis" },
                    { id: "alert", label: "Draft STR" }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                        activeTab === tab.id ? "bg-grape text-white shadow" : "text-frost/40 hover:text-frost"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === "scores" && (
                  <div className="space-y-3">
                    {[
                      { label: "GNN (Graph Neural Net)", key: "gnn", color: "var(--grape)", weight: "35% weight" },
                      { label: "Ensemble Classifier", key: "ensemble", color: "var(--orchid)", weight: "25% weight" },
                      { label: "VAE Anomaly Detection", key: "vae", color: "var(--cyan)", weight: "20% weight" },
                      { label: "BEI Behavioral Biometrics", key: "bei", color: "var(--amber)", weight: "12% weight" },
                      { label: "Graph Topology Rules", key: "graph", color: "var(--jade)", weight: "8% weight" },
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
                            background: result.finalRisk >= 0.85 ? "var(--crimson)" : result.finalRisk >= 0.70 ? "var(--orange)" : result.finalRisk >= 0.40 ? "var(--amber)" : "var(--jade)",
                          }}
                        />
                      </div>
                      <span className="text-frost font-mono font-bold text-sm w-8 text-right">{Math.round(result.finalRisk * 100)}</span>
                    </div>
                  </div>
                )}

                {activeTab === "graph" && (
                  <div className="border border-grape/15 rounded-xl bg-night/50 p-1">
                    <Gnn3DGraph
                      accountId={result.accountId}
                      ringMembership={result.ringMembership}
                      finalRisk={result.finalRisk}
                      height={280}
                    />
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
                    <p className="text-frost/70 text-sm leading-relaxed font-mono bg-night/50 p-3 rounded-lg border border-grape/10">
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