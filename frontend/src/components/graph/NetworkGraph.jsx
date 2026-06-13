// src/components/graph/NetworkGraph.jsx
// Full-canvas deep-space graph — D3 force layout, zoom/pan, role shapes, ring pulses
import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

const DECISION_COLOR = (risk) => {
  if (risk > 0.85) return "#f87171"; // BLOCK  — red
  if (risk > 0.70) return "#fb923c"; // FLAG   — orange
  if (risk > 0.40) return "#fbbf24"; // REVIEW — amber
  return "#34d399";                  // APPROVE — green
};

// Hex → rgba helper
function hex2rgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Draw node shape by role
function drawShape(ctx, role, x, y, r) {
  ctx.beginPath();
  if (role === "hub" || role === "orchestrator") {
    // Upward triangle — orchestrators
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.866, y + r * 0.5);
    ctx.lineTo(x - r * 0.866, y + r * 0.5);
    ctx.closePath();
  } else if (role === "bridge" || role === "coordinator") {
    // Diamond — bridges
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  } else if (role === "terminal") {
    // Square — terminals
    ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
  } else {
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
}

export default function NetworkGraph({ nodes = [], links = [], onNodeClick = null, height = 520 }) {
  const canvasRef = useRef();
  const stateRef  = useRef({
    simNodes: [], simLinks: [],
    hoveredId: null, selectedId: null,
    cam: { x: 0, y: 0, scale: 1 },
    drag: null, panning: false, lastMouse: { x: 0, y: 0 },
    particles: [],
    time: 0,
    animId: null,
  });
  const simRef = useRef();

  // Seeded PRNG so particles are stable across re-renders
  const makeParticles = (W, H) => {
    let s = 1337;
    const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
    return Array.from({ length: 55 }, () => ({
      x: rng() * W, y: rng() * H,
      vx: (rng() - 0.5) * 0.18,
      vy: (rng() - 0.5) * 0.12,
      r: rng() * 1.4 + 0.4,
      a: rng() * 0.3 + 0.04,
    }));
  };

  const worldToScreen = (wx, wy, cam, W, H) => {
    const ox = W / 2 * (1 - cam.scale);
    const oy = H / 2 * (1 - cam.scale);
    return [(wx + cam.x) * cam.scale + ox, (wy + cam.y) * cam.scale + oy];
  };

  const screenToWorld = (sx, sy, cam, W, H) => {
    const ox = W / 2 * (1 - cam.scale);
    const oy = H / 2 * (1 - cam.scale);
    return [(sx - ox) / cam.scale - cam.x, (sy - oy) / cam.scale - cam.y];
  };

  const getNodeAt = useCallback((mx, my, W, H) => {
    const { simNodes, cam } = stateRef.current;
    for (let i = simNodes.length - 1; i >= 0; i--) {
      const n = simNodes[i];
      if (!n.x) continue;
      const [sx, sy] = worldToScreen(n.x, n.y, cam, W, H);
      const r = (n.role === "hub" || n.role === "orchestrator" ? 14 : n.role === "bridge" ? 12 : 9) * cam.scale;
      if (Math.hypot(sx - mx, sy - my) < r + 4) return n;
    }
    return null;
  }, []);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const { simNodes, simLinks, hoveredId, selectedId, cam, particles, time } = stateRef.current;

    // ── Background ──
    ctx.clearRect(0, 0, W, H);
    // Deep space radial gradient
    const bg = ctx.createRadialGradient(W * 0.35, H * 0.3, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    bg.addColorStop(0,   "#0d1f3c");
    bg.addColorStop(0.5, "#080e1a");
    bg.addColorStop(1,   "#050810");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Dot grid ──
    ctx.fillStyle = "rgba(30,58,138,0.18)";
    const gs = 40 * cam.scale;
    const offX = ((cam.x * cam.scale) % gs + gs) % gs + (W / 2 * (1 - cam.scale)) % gs;
    const offY = ((cam.y * cam.scale) % gs + gs) % gs + (H / 2 * (1 - cam.scale)) % gs;
    for (let x = offX % gs; x < W; x += gs)
      for (let y = offY % gs; y < H; y += gs) {
        ctx.beginPath();
        ctx.arc(x, y, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

    // ── Ambient particles ──
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(96,165,250,${p.a})`;
      ctx.fill();
    }

    // ── Apply camera transform ──
    ctx.save();
    const ox = W / 2 * (1 - cam.scale);
    const oy = H / 2 * (1 - cam.scale);
    ctx.translate(ox + cam.x * cam.scale, oy + cam.y * cam.scale);
    ctx.scale(cam.scale, cam.scale);

    // ── Edges ──
    for (const link of simLinks) {
      const s = link.source, t = link.target;
      if (!s?.x || !t?.x) continue;
      const isRingEdge = s.ring_id && s.ring_id === t.ring_id;
      const isSelected = selectedId && (s.id === selectedId || t.id === selectedId);
      const sColor = DECISION_COLOR(s.risk || 0);
      const tColor = DECISION_COLOR(t.risk || 0);

      let alpha = isRingEdge ? 0.3 : 0.06;
      if (isSelected) alpha = Math.min(alpha * 4, 0.75);

      const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
      grad.addColorStop(0, hex2rgba(sColor, alpha));
      grad.addColorStop(1, hex2rgba(tColor, alpha));

      if (isRingEdge) {
        // Slight curve on ring edges
        const mx = (s.x + t.x) / 2 + (t.y - s.y) * 0.12;
        const my = (s.y + t.y) / 2 - (t.x - s.x) * 0.12;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(mx, my, t.x, t.y);
      } else {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = isRingEdge ? (isSelected ? 1.4 : 0.9) : 0.4;
      ctx.stroke();
    }

    // ── Nodes ──
    for (const node of simNodes) {
      if (!node.x) continue;
      const col = DECISION_COLOR(node.risk || 0);
      const isHub   = node.role === "hub" || node.role === "orchestrator";
      const isBridge = node.role === "bridge" || node.role === "coordinator";
      const r = isHub ? 13 : isBridge ? 11 : 8;
      const isHovered  = node.id === hoveredId;
      const isSelected = node.id === selectedId;
      const inRing = !!node.ring_id;

      // Outer ambient glow for ring members
      if (inRing) {
        const pulse = Math.sin(time * 1.8 + node.x * 0.05) * 0.5 + 0.5;
        const gr = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r + 10 + pulse * 4);
        gr.addColorStop(0, hex2rgba(col, 0.12 + pulse * 0.06));
        gr.addColorStop(1, hex2rgba(col, 0));
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 10 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = gr;
        ctx.fill();
      }

      // Selection rings
      if (isSelected) {
        for (let i = 3; i >= 1; i--) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 6 * i, 0, Math.PI * 2);
          ctx.strokeStyle = hex2rgba(col, 0.35 - i * 0.08);
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      } else if (isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 7, 0, Math.PI * 2);
        ctx.strokeStyle = hex2rgba(col, 0.5);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Node fill — radial gradient from bright center
      const grd = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r * 1.3);
      grd.addColorStop(0, hex2rgba(col, 0.95));
      grd.addColorStop(1, hex2rgba(col, 0.45));
      drawShape(ctx, node.role || "member", node.x, node.y, r);
      ctx.fillStyle = grd;
      ctx.fill();

      // Stroke
      if (inRing || isHub || isSelected || isHovered) {
        ctx.strokeStyle = isSelected ? col : hex2rgba(col, 0.8);
        ctx.lineWidth = isSelected ? 1.5 : 0.8;
        ctx.stroke();
      }

      // Label on hover or hub
      if (isHovered || isSelected || isHub) {
        ctx.fillStyle = isSelected ? "rgba(255,255,255,0.9)" : "rgba(226,232,240,0.7)";
        ctx.font = `${isHub ? "500 " : ""}9px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.fillText((node.id || "").slice(0, 12), node.x, node.y + r + 13);
      }
    }

    ctx.restore();
    stateRef.current.time += 0.016;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nodes.length) return;

    const W = canvas.parentElement?.clientWidth || 800;
    const H = height;
    canvas.width  = W;
    canvas.height = H;

    const st = stateRef.current;
    st.simNodes = nodes.map(n => ({ ...n }));
    st.simLinks = links.map(l => ({ ...l }));
    st.particles = makeParticles(W, H);
    st.cam = { x: 0, y: 0, scale: 1 };

    const sim = d3.forceSimulation(st.simNodes)
      .force("link",    d3.forceLink(st.simLinks).id(d => d.id).distance(85).strength(0.45))
      .force("charge",  d3.forceManyBody().strength(-220))
      .force("center",  d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide(24));

    simRef.current = sim;

    // Tick-driven animation loop
    const loop = () => {
      drawFrame();
      st.animId = requestAnimationFrame(loop);
    };
    loop();

    // ── Pointer events ──
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (st.drag) {
        const [wx, wy] = screenToWorld(mx, my, st.cam, W, H);
        st.drag.fx = wx; st.drag.fy = wy;
        return;
      }
      if (st.panning) {
        st.cam.x += (mx - st.lastMouse.x) / st.cam.scale;
        st.cam.y += (my - st.lastMouse.y) / st.cam.scale;
        st.lastMouse = { x: mx, y: my };
        return;
      }
      const hit = getNodeAt(mx, my, W, H);
      st.hoveredId = hit?.id || null;
      canvas.style.cursor = hit ? "pointer" : "grab";
    };

    const onMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = getNodeAt(mx, my, W, H);
      if (hit) {
        st.drag = hit;
        sim.alphaTarget(0.3).restart();
        const [wx, wy] = screenToWorld(mx, my, st.cam, W, H);
        hit.fx = wx; hit.fy = wy;
        canvas.style.cursor = "grabbing";
      } else {
        st.panning = true;
        st.lastMouse = { x: mx, y: my };
        canvas.style.cursor = "grabbing";
      }
    };

    const onMouseUp = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (st.drag) {
        // Was it a click (no move)?
        const hit = getNodeAt(mx, my, W, H);
        if (hit) {
          st.selectedId = hit.id === st.selectedId ? null : hit.id;
          if (onNodeClick) onNodeClick(hit.id === st.selectedId ? hit : null);
        }
        sim.alphaTarget(0);
        st.drag.fx = null; st.drag.fy = null;
        st.drag = null;
      }
      st.panning = false;
      canvas.style.cursor = "grab";
    };

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.88 : 1.14;
      const [wx, wy] = screenToWorld(mx, my, st.cam, W, H);
      st.cam.scale = Math.max(0.25, Math.min(5, st.cam.scale * factor));
      // Keep mouse world point fixed
      const ox = W / 2 * (1 - st.cam.scale);
      const oy = H / 2 * (1 - st.cam.scale);
      st.cam.x = (mx - ox) / st.cam.scale - wx;
      st.cam.y = (my - oy) / st.cam.scale - wy;
    };

    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("mousedown",  onMouseDown);
    canvas.addEventListener("mouseup",    onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("wheel",      onWheel, { passive: false });

    return () => {
      sim.stop();
      cancelAnimationFrame(st.animId);
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("mousedown",  onMouseDown);
      canvas.removeEventListener("mouseup",    onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("wheel",      onWheel);
    };
  }, [nodes, links, height, drawFrame, getNodeAt, onNodeClick]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height, display: "block", borderRadius: "0.75rem", cursor: "grab" }}
    />
  );
}