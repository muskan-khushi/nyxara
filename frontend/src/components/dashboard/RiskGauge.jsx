// src/components/dashboard/RiskGauge.jsx
import { useEffect, useRef } from "react";

const DECISION_COLORS = {
  APPROVE: "#10B981",
  REVIEW:  "#F59E0B",
  FLAG:    "#F97316",
  BLOCK:   "#DC2626",
};

export default function RiskGauge({ score = 0, decision = "APPROVE", size = 180 }) {
  const ref = useRef();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const cx  = size / 2, cy = size / 2 + 10;
    const r   = size * 0.38;
    const color = DECISION_COLORS[decision] || "#7B2FBE";

    let current = 0;
    const target = score;
    const step   = target / 40;

    function draw(val) {
      ctx.clearRect(0, 0, size, size);

      // Background arc
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = "rgba(123,47,190,0.15)";
      ctx.lineWidth   = 16;
      ctx.lineCap     = "round";
      ctx.stroke();

      // Value arc
      const end = Math.PI + val * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, end);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 16;
      ctx.lineCap     = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur  = 12;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // Score text
      ctx.fillStyle = "#F5F3FF";
      ctx.font      = `bold ${size * 0.2}px Inter`;
      ctx.textAlign = "center";
      ctx.fillText(Math.round(val * 100), cx, cy + 5);

      // Decision label
      ctx.fillStyle = color;
      ctx.font      = `600 ${size * 0.085}px Inter`;
      ctx.fillText(decision, cx, cy + size * 0.16);
    }

    const id = setInterval(() => {
      current = Math.min(current + step, target);
      draw(current);
      if (current >= target) clearInterval(id);
    }, 20);

    return () => clearInterval(id);
  }, [score, decision, size]);

  return <canvas ref={ref} width={size} height={size * 0.75} />;
}
