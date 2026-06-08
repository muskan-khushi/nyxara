// src/components/graph/NetworkGraph.jsx
import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

const RISK_COLOR = (r) => {
  if (r > 0.85) return "#DC2626";
  if (r > 0.70) return "#F97316";
  if (r > 0.40) return "#F59E0B";
  return "#10B981";
};

const ROLE_SHAPE = (role, ctx, x, y, r) => {
  if (role === "hub" || role === "orchestrator") {
    // Diamond
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath();
  } else if (role === "bridge") {
    // Triangle
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.866, y + r * 0.5);
    ctx.lineTo(x - r * 0.866, y + r * 0.5);
    ctx.closePath();
  } else {
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
};

export default function NetworkGraph({ nodes = [], links = [], onNodeClick = null, height = 500 }) {
  const canvasRef = useRef();
  const simRef    = useRef();

  const draw = useCallback((canvas, simNodes, simLinks) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height: h } = canvas;
    ctx.clearRect(0, 0, width, h);

    // Background
    ctx.fillStyle = "rgba(18,8,46,0.8)";
    ctx.fillRect(0, 0, width, h);

    // Links
    simLinks.forEach(link => {
      const s = link.source, t = link.target;
      if (!s.x || !t.x) return;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = "rgba(123,47,190,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Arrow
      const angle = Math.atan2(t.y - s.y, t.x - s.x);
      const r     = (t.risk > 0.85 ? 14 : 10) + 2;
      const ax    = t.x - r * Math.cos(angle);
      const ay    = t.y - r * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - 6 * Math.cos(angle - 0.4), ay - 6 * Math.sin(angle - 0.4));
      ctx.lineTo(ax - 6 * Math.cos(angle + 0.4), ay - 6 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = "rgba(123,47,190,0.4)";
      ctx.fill();
    });

    // Nodes
    simNodes.forEach(node => {
      if (!node.x) return;
      const r     = node.risk > 0.85 ? 14 : node.role === "hub" ? 16 : 10;
      const color = RISK_COLOR(node.risk || 0);

      // Glow for high-risk
      if ((node.risk || 0) > 0.7) {
        ctx.shadowColor = color;
        ctx.shadowBlur  = 15;
      }

      // Ring pulse for ring members
      if (node.in_ring) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = color + "50";
        ctx.lineWidth   = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ROLE_SHAPE(node.role || "mule", ctx, node.x, node.y, r);
      ctx.fillStyle   = color + "25";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth   = node.risk > 0.85 ? 2.5 : 1.5;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // Label
      ctx.fillStyle   = "rgba(245,243,255,0.7)";
      ctx.font        = "9px monospace";
      ctx.textAlign   = "center";
      ctx.fillText(node.id?.slice(0, 10) || "", node.x, node.y + r + 12);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nodes.length) return;

    const W = canvas.parentElement.clientWidth;
    const H = height;
    canvas.width  = W;
    canvas.height = H;

    const simNodes = nodes.map(n => ({ ...n }));
    const simLinks = links.map(l => ({ ...l }));

    const sim = d3.forceSimulation(simNodes)
      .force("link",    d3.forceLink(simLinks).id(d => d.id).distance(80).strength(0.5))
      .force("charge",  d3.forceManyBody().strength(-180))
      .force("center",  d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide(20));

    simRef.current = sim;
    sim.on("tick", () => draw(canvas, simNodes, simLinks));

    // Drag
    const cvs = d3.select(canvas);
    let dragNode = null;

    cvs.on("mousedown", (event) => {
      const [mx, my] = d3.pointer(event);
      dragNode = simNodes.find(n => n.x && Math.hypot(n.x - mx, n.y - my) < 20);
      if (dragNode) { sim.alphaTarget(0.3).restart(); dragNode.fx = dragNode.x; dragNode.fy = dragNode.y; }
    });
    cvs.on("mousemove", (event) => {
      if (!dragNode) return;
      const [mx, my] = d3.pointer(event);
      dragNode.fx = mx; dragNode.fy = my;
    });
    cvs.on("mouseup", () => {
      if (dragNode) { sim.alphaTarget(0); dragNode.fx = null; dragNode.fy = null; dragNode = null; }
    });
    cvs.on("click", (event) => {
      const [mx, my] = d3.pointer(event);
      const clicked  = simNodes.find(n => n.x && Math.hypot(n.x - mx, n.y - my) < 20);
      if (clicked && onNodeClick) onNodeClick(clicked);
    });

    return () => { sim.stop(); };
  }, [nodes, links, height, draw, onNodeClick]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height, cursor: "grab", borderRadius: 8 }}
    />
  );
}