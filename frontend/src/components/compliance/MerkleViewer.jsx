// src/components/compliance/MerkleViewer.jsx
import { useEffect, useRef } from "react";

function truncate(hash, n = 8) {
  if (!hash) return "empty";
  return hash.slice(0, n) + "…";
}

export default function MerkleViewer({ batchId, merkleRoot, leafCount, levels = [] }) {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (!merkleRoot) {
      ctx.fillStyle = "rgba(245,243,255,0.2)";
      ctx.font      = "13px Inter";
      ctx.textAlign = "center";
      ctx.fillText("No Merkle batch sealed yet", W / 2, H / 2);
      return;
    }

    // Draw simplified 3-level visual tree
    // Root → 4 children → 8 leaves (representative)
    const drawNode = (x, y, hash, color = "#7B2FBE", radius = 28) => {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle   = color + "20";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      ctx.fillStyle  = "#F5F3FF90";
      ctx.font       = "8px monospace";
      ctx.textAlign  = "center";
      ctx.fillText(truncate(hash, 6), x, y + 2);
    };

    const drawLine = (x1, y1, x2, y2) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = "rgba(123,47,190,0.3)";
      ctx.lineWidth   = 1;
      ctx.stroke();
    };

    const rootY    = 40;
    const level1Y  = 110;
    const level2Y  = 180;

    // Root
    drawNode(W / 2, rootY, merkleRoot, "#C084FC", 32);
    ctx.fillStyle = "#C084FC";
    ctx.font      = "10px Inter";
    ctx.textAlign = "center";
    ctx.fillText("Merkle Root", W / 2, rootY - 42);
    ctx.fillText(`Batch: ${batchId || "—"}`, W / 2, rootY - 28);

    // Level 1 — 4 child nodes
    const l1xs = [W * 0.15, W * 0.38, W * 0.62, W * 0.85];
    l1xs.forEach(x => {
      drawLine(W / 2, rootY + 32, x, level1Y - 22);
      drawNode(x, level1Y, "h" + Math.random().toString(36).slice(2, 8), "#7B2FBE", 22);
    });

    // Level 2 — 8 leaf nodes
    const l2xs = [W * 0.06, W * 0.22, W * 0.38, W * 0.50, W * 0.60, W * 0.72, W * 0.85, W * 0.94];
    l2xs.forEach((x, i) => {
      const parent = l1xs[Math.floor(i / 2)];
      drawLine(parent, level1Y + 22, x, level2Y - 18);
      drawNode(x, level2Y, "leaf" + i, "#06B6D4", 18);
    });

    // Stats below
    ctx.fillStyle = "rgba(245,243,255,0.4)";
    ctx.font      = "10px Inter";
    ctx.textAlign = "center";
    ctx.fillText(`${leafCount || 0} decisions in batch`, W / 2, H - 20);

  }, [batchId, merkleRoot, leafCount]);

  return (
    <div className="space-y-3">
      <div className="bg-night/60 rounded-lg p-3 border border-grape/20">
        <p className="text-frost/50 text-xs font-semibold mb-2">Merkle Root</p>
        <p className="text-orchid font-mono text-xs break-all">{merkleRoot || "No batch sealed yet"}</p>
        {batchId && (
          <div className="flex gap-4 mt-2 text-xs text-frost/40">
            <span>Batch: <span className="text-frost/60 font-mono">{batchId}</span></span>
            <span>Leaves: <span className="text-frost/60 font-mono">{leafCount}</span></span>
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={500}
        height={240}
        className="w-full rounded-lg"
        style={{ background: "rgba(18,8,46,0.7)" }}
      />

      <p className="text-frost/25 text-xs text-center">
        Visual representation — leaf hashes → branch hashes → root hash (SHA-256)
      </p>
    </div>
  );
}