// src/pages/AttackReplay.jsx
// Cinematic attack simulation replay — judges see the full story in real time

import { useState, useEffect, useRef, useCallback } from 'react';
import { ATTACK_SCENARIOS } from '../data/attackScenarios';

/* ── Node position in canvas (560x400) ── */
const NODE_RADIUS = 22;

function lerp(a, b, t) { return a + (b - a) * t; }

/* ── Canvas graph renderer ── */
function ReplayCanvas({ scenario, frameIdx, progress }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scenario) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, W, H);

    const prevFrame = scenario.frames[Math.max(0, frameIdx - 1)];
    const currFrame = scenario.frames[frameIdx];
    if (!currFrame) return;

    const t = Math.min(progress, 1);

    // Interpolate node positions
    const nodes = currFrame.nodes.map((n, i) => {
      const pn = prevFrame?.nodes?.[i];
      return {
        ...n,
        drawX: pn ? lerp(pn.x, n.x, t) : n.x,
        drawY: pn ? lerp(pn.y, n.y, t) : n.y,
        drawRisk: pn ? lerp(pn.risk, n.risk, t) : n.risk,
      };
    });

    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });

    // ── Draw edges ──
    (currFrame.edges || []).forEach(edge => {
      const src = nodeMap[edge.from];
      const tgt = nodeMap[edge.to];
      if (!src || !tgt) return;

      const color = edge.blocked ? '#FB7185' : edge.reverse ? '#C084FC' : '#38BDF8';
      const alpha = edge.blocked ? 0.5 : edge.active ? 0.8 : 0.3;

      // Glow line
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = edge.blocked ? 0 : 12;
      ctx.strokeStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = edge.blocked ? 2 : edge.active ? 2.5 : 1.5;
      if (edge.blocked) ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(src.drawX, src.drawY);
      if (edge.cycle) {
        // Curved arc for cycle edges
        const mx = (src.drawX + tgt.drawX) / 2 + 40;
        const my = (src.drawY + tgt.drawY) / 2 - 40;
        ctx.quadraticCurveTo(mx, my, tgt.drawX, tgt.drawY);
      } else {
        ctx.lineTo(tgt.drawX, tgt.drawY);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Animate particles along active edges
      if (edge.active && !edge.blocked) {
        const key = `${edge.from}-${edge.to}`;
        if (!particlesRef.current.find(p => p.key === key)) {
          particlesRef.current.push({ key, progress: Math.random(), speed: 0.008 + Math.random() * 0.006 });
        }
      }

      // Label
      if (edge.label && !edge.blocked) {
        const mx = (src.drawX + tgt.drawX) / 2;
        const my = (src.drawY + tgt.drawY) / 2 - 8;
        ctx.fillStyle = 'rgba(245,243,255,0.7)';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(edge.label, mx, my);
      }
    });

    // ── Animate particles ──
    particlesRef.current = particlesRef.current.map(p => {
      const edge = currFrame.edges?.find(e => `${e.from}-${e.to}` === p.key);
      if (!edge) return null;
      const src = nodeMap[edge.from];
      const tgt = nodeMap[edge.to];
      if (!src || !tgt) return null;

      let px, py;
      if (edge.cycle) {
        const mx = (src.drawX + tgt.drawX) / 2 + 40;
        const my = (src.drawY + tgt.drawY) / 2 - 40;
        const t0 = p.progress;
        px = (1 - t0) * (1 - t0) * src.drawX + 2 * (1 - t0) * t0 * mx + t0 * t0 * tgt.drawX;
        py = (1 - t0) * (1 - t0) * src.drawY + 2 * (1 - t0) * t0 * my + t0 * t0 * tgt.drawY;
      } else {
        px = lerp(src.drawX, tgt.drawX, p.progress);
        py = lerp(src.drawY, tgt.drawY, p.progress);
      }

      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#A78BFA';
      ctx.shadowColor = '#A78BFA';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      return { ...p, progress: (p.progress + p.speed) % 1 };
    }).filter(Boolean);

    // ── Draw nodes ──
    nodes.forEach(node => {
      const r = NODE_RADIUS;
      const riskColor = node.blocked ? '#FB7185' : node.protected ? '#34D399' :
        node.drawRisk > 0.85 ? '#FB7185' : node.drawRisk > 0.65 ? '#FB923C' :
        node.drawRisk > 0.40 ? '#FBBF24' : '#34D399';

      // Outer glow ring
      const glowR = r + (node.blocked ? 8 : 4) + (node.blocked ? Math.sin(Date.now() / 200) * 4 : 0);
      ctx.beginPath();
      ctx.arc(node.drawX, node.drawY, glowR, 0, Math.PI * 2);
      ctx.fillStyle = `${riskColor}15`;
      ctx.fill();

      // Main circle
      ctx.beginPath();
      ctx.arc(node.drawX, node.drawY, r, 0, Math.PI * 2);
      ctx.fillStyle = `${riskColor}20`;
      ctx.strokeStyle = riskColor;
      ctx.lineWidth = node.blocked ? 2.5 : 1.8;
      ctx.shadowColor = riskColor;
      ctx.shadowBlur = node.blocked ? 20 : 10;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Risk fill arc
      const fillAngle = -Math.PI / 2 + node.drawRisk * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(node.drawX, node.drawY);
      ctx.arc(node.drawX, node.drawY, r - 4, -Math.PI / 2, fillAngle);
      ctx.closePath();
      ctx.fillStyle = `${riskColor}30`;
      ctx.fill();

      // Label
      const lines = (node.label || node.id).split('\n');
      ctx.fillStyle = node.blocked ? '#FB7185' : 'rgba(245,243,255,0.9)';
      ctx.font = `bold 9px Inter, sans-serif`;
      ctx.textAlign = 'center';
      lines.forEach((line, i) => {
        ctx.fillText(line, node.drawX, node.drawY + (i - (lines.length - 1) / 2) * 10);
      });

      // Blocked X
      if (node.blocked) {
        ctx.strokeStyle = '#FB7185';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(node.drawX - r - 6, node.drawY - r - 6);
        ctx.lineTo(node.drawX + r + 6, node.drawY + r + 6);
        ctx.moveTo(node.drawX + r + 6, node.drawY - r - 6);
        ctx.lineTo(node.drawX - r - 6, node.drawY + r + 6);
        ctx.stroke();
      }

      // Protected check
      if (node.protected) {
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(node.drawX - 10, node.drawY);
        ctx.lineTo(node.drawX - 3, node.drawY + 8);
        ctx.lineTo(node.drawX + 10, node.drawY - 8);
        ctx.stroke();
      }
    });
  }, [scenario, frameIdx, progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const parent = canvas.parentNode;
      if (!parent) return;
      const W = parent.clientWidth;
      const H = 380;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    particlesRef.current = [];
  }, [frameIdx]);

  useEffect(() => {
    let id;
    const loop = () => { draw(); id = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(id);
  }, [draw]);

  return (
    <div className="relative w-full" style={{ height: 380 }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}

/* ── Detection layer pill ── */
function LayerPill({ text, fired }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all duration-500 ${
      fired
        ? 'bg-jade/10 border-jade/40 text-jade shadow-lg'
        : 'bg-night/60 border-grape/15 text-frost/25'
    }`}>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${
        fired ? 'bg-jade shadow-jade animate-pulse' : 'bg-grape/20'
      }`} />
      {text}
    </div>
  );
}

const ALL_LAYERS = [
  'L1: Temporal GNN',
  'L2: Contrastive Transformer',
  'L3: Ensemble Classifier',
  'L4: VAE Anomaly',
  'L5: Multi-View LineGNN',
  'L6: SHAP + Llama 3 Narration',
];

export default function AttackReplay() {
  const [selected, setSelected] = useState(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [transProgress, setTransProgress] = useState(1);
  const playIntervalRef = useRef(null);
  const progressRef = useRef(null);

  const scenario = selected !== null ? ATTACK_SCENARIOS[selected] : null;
  const frame = scenario?.frames?.[frameIdx];

  // Auto-play logic
  useEffect(() => {
    if (!playing || !scenario) return;
    progressRef.current = 0;
    setTransProgress(0);

    const anim = () => {
      progressRef.current = Math.min(1, (progressRef.current || 0) + 0.025);
      setTransProgress(progressRef.current);
      if (progressRef.current < 1) {
        playIntervalRef.current = requestAnimationFrame(anim);
      } else {
        setTimeout(() => {
          if (frameIdx < scenario.frames.length - 1) {
            setFrameIdx(f => f + 1);
            progressRef.current = 0;
          } else {
            setPlaying(false);
          }
        }, 1800);
      }
    };
    playIntervalRef.current = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(playIntervalRef.current);
  }, [playing, frameIdx, scenario]);

  function selectScenario(idx) {
    setSelected(idx);
    setFrameIdx(0);
    setPlaying(false);
    setTransProgress(1);
    cancelAnimationFrame(playIntervalRef.current);
  }

  function handlePlay() {
    if (!scenario) return;
    if (frameIdx >= scenario.frames.length - 1) {
      setFrameIdx(0);
      setTransProgress(0);
    }
    setPlaying(true);
  }

  function handleStep() {
    if (!scenario || frameIdx >= scenario.frames.length - 1) return;
    setPlaying(false);
    cancelAnimationFrame(playIntervalRef.current);
    setFrameIdx(f => f + 1);
    setTransProgress(1);
  }

  function handleReset() {
    setPlaying(false);
    cancelAnimationFrame(playIntervalRef.current);
    setFrameIdx(0);
    setTransProgress(1);
  }

  const isLastFrame = scenario && frameIdx === scenario.frames.length - 1;
  const firedLayers = frame?.layersFiring || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">Attack Replay Mode</h1>
          <p className="text-frost/40 text-sm mt-1 font-medium">Cinematic attack simulation — watch Nyxara detect threats in real time</p>
        </div>
        <div className="flex items-center gap-2 bg-crimson/10 border border-crimson/30 rounded-lg px-3 py-1.5 shadow-[0_0_15px_rgba(225,29,72,0.2)]">
          <span className="w-2.5 h-2.5 rounded-full bg-crimson animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.8)]" />
          <span className="text-crimson text-xs font-mono font-bold tracking-wider">SIMULATION MODE</span>
        </div>
      </div>

      {/* Scenario selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ATTACK_SCENARIOS.map((sc, i) => (
          <button
            key={sc.id}
            onClick={() => selectScenario(i)}
            className={`text-left p-4 rounded-xl border transition-all duration-200 group ${
              selected === i
                ? 'border-opacity-60 shadow-lg'
                : 'border-grape/20 bg-night/40 hover:border-grape/40 hover:bg-grape/5'
            }`}
            style={selected === i ? {
              borderColor: sc.color,
              backgroundColor: `${sc.color}10`,
              boxShadow: `0 0 20px ${sc.glowColor}`,
            } : {}}
          >
            <div className="text-2xl mb-2">{sc.icon}</div>
            <p className="text-frost font-semibold text-sm leading-tight mb-1">{sc.name}</p>
            <p className="text-frost/40 text-[10px] leading-tight mb-3">{sc.subtitle}</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-frost/30 text-[9px] font-mono">AMOUNT</span>
                <span className="font-mono font-bold text-[10px]" style={{ color: sc.color }}>{sc.totalAmount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-frost/30 text-[9px] font-mono">ACCOUNTS</span>
                <span className="text-frost/60 font-mono text-[10px]">{sc.accountsInvolved}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-frost/30 text-[9px] font-mono">DETECTION</span>
                <span className="text-jade font-mono font-bold text-[10px]">{sc.timeToDetect}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {!scenario ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4 opacity-30">🎬</div>
          <p className="text-frost/40 text-base font-medium">Select an attack scenario above to begin playback</p>
          <p className="text-frost/20 text-sm mt-1">Watch Nyxara's 6-layer detection stack neutralize real attack typologies</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Left: Canvas + controls */}
          <div className="xl:col-span-2 space-y-3">
            {/* Phase badge + frame info */}
            <div className="card py-3">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border"
                  style={{ color: frame?.phaseColor, borderColor: `${frame?.phaseColor}40`, backgroundColor: `${frame?.phaseColor}15` }}
                >
                  {frame?.phase}
                </span>
                <span className="text-frost font-semibold text-sm">{frame?.title}</span>
                <div className="ml-auto flex items-center gap-1 text-frost/30 text-xs font-mono">
                  Frame {frameIdx + 1} / {scenario.frames.length}
                </div>
              </div>
              <p className="text-frost/50 text-xs leading-relaxed">{frame?.detail}</p>
            </div>

            {/* Canvas */}
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: `${scenario.color}30`, backgroundColor: '#080412' }}
            >
              <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: `${scenario.color}20` }}>
                <span className="text-lg">{scenario.icon}</span>
                <span className="text-frost/70 text-xs font-semibold">{scenario.name}</span>
                <span className="text-frost/30 text-[10px] font-mono ml-auto">{scenario.regulatoryRef}</span>
              </div>
              <ReplayCanvas scenario={scenario} frameIdx={frameIdx} progress={transProgress} />
            </div>

            {/* Alert banner */}
            {frame?.alert && (
              <div className={`px-4 py-3 rounded-xl border text-xs font-mono leading-relaxed ${
                frame.phase === 'BLOCKED' || frame.phase === 'DRAINING'
                  ? 'bg-crimson/8 border-crimson/30 text-crimson'
                  : frame.phase === 'BLOCKED' && frame.nodes?.[0]?.protected
                  ? 'bg-jade/8 border-jade/30 text-jade'
                  : 'bg-amber/8 border-amber/30 text-amber'
              }`}>
                {frame.alert}
              </div>
            )}

            {/* Final verdict */}
            {isLastFrame && (
              <div
                className="rounded-xl border p-4 text-center"
                style={{
                  borderColor: `${scenario.color}40`,
                  backgroundColor: `${scenario.color}08`,
                  boxShadow: `0 0 30px ${scenario.glowColor}`,
                }}
              >
                <p className="text-3xl font-black mb-1" style={{ color: scenario.color }}>THREAT NEUTRALIZED</p>
                <p className="text-frost/50 text-sm font-mono">
                  {scenario.totalAmount} protected · {scenario.accountsInvolved} accounts frozen · STR auto-filed · {scenario.timeToDetect} total detection time
                </p>
              </div>
            )}

            {/* Playback controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg bg-grape/15 border border-grape/25 text-frost/60 hover:text-frost hover:bg-grape/25 text-xs font-mono transition-all"
              >
                ↺ Reset
              </button>
              <button
                onClick={playing ? () => setPlaying(false) : handlePlay}
                disabled={isLastFrame && !playing}
                className={`flex-1 py-2 rounded-lg border text-xs font-mono font-bold transition-all ${
                  playing
                    ? 'bg-amber/15 border-amber/30 text-amber hover:bg-amber/25'
                    : 'bg-jade/15 border-jade/30 text-jade hover:bg-jade/25'
                }`}
              >
                {playing ? '⏸ Pause' : isLastFrame ? '✓ Complete' : '▶ Play Simulation'}
              </button>
              <button
                onClick={handleStep}
                disabled={playing || isLastFrame}
                className="px-4 py-2 rounded-lg bg-grape/15 border border-grape/25 text-frost/60 hover:text-frost hover:bg-grape/25 text-xs font-mono transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Step →
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-grape/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${((frameIdx + (transProgress < 1 ? transProgress : 1)) / scenario.frames.length) * 100}%`,
                  background: scenario.color,
                  boxShadow: `0 0 8px ${scenario.glowColor}`,
                }}
              />
            </div>
          </div>

          {/* Right panel: layers + scenario info */}
          <div className="space-y-4">
            {/* Detection layers */}
            <div className="card">
              <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-3">AI Detection Stack</p>
              <div className="space-y-2">
                {ALL_LAYERS.map(layer => {
                  const fired = firedLayers.some(l => l.startsWith(layer.split(' ')[0] + ':') || l.includes(layer.split(':')[0].trim()));
                  return <LayerPill key={layer} text={layer} fired={fired} />;
                })}
              </div>
              {firedLayers.filter(l => l.includes('BEI') || l.includes('JA3') || l.includes('Federated')).map(l => (
                <div key={l} className="mt-2 px-3 py-2 rounded-lg bg-cyan/8 border border-cyan/25 text-cyan text-[10px] font-mono">
                  {l}
                </div>
              ))}
            </div>

            {/* Scenario details */}
            <div className="card space-y-3">
              <p className="text-frost/40 text-xs uppercase tracking-wider font-medium">Scenario Profile</p>
              {[
                { label: 'Attack Type', value: scenario.attackType },
                { label: 'Total Amount', value: scenario.totalAmount },
                { label: 'Accounts', value: scenario.accountsInvolved },
                { label: 'Transactions', value: scenario.transactionsCount },
                { label: 'First Detection', value: scenario.detectedAt },
                { label: 'Time to Block', value: scenario.timeToDetect },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <span className="text-frost/30 text-[10px] font-mono">{label}</span>
                  <span className="text-frost/80 text-[10px] font-mono font-semibold text-right">{value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-grape/10">
                <p className="text-frost/20 text-[9px] font-mono leading-relaxed">{scenario.regulatoryRef}</p>
              </div>
            </div>

            {/* Frame events */}
            <div className="card">
              <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-3">Attack Timeline</p>
              <div className="space-y-1">
                {scenario.frames.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => { setPlaying(false); setFrameIdx(i); setTransProgress(1); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                      i === frameIdx ? 'bg-grape/20 border border-grape/35' : 'hover:bg-grape/10 border border-transparent'
                    } ${ i > frameIdx ? 'opacity-40' : '' }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${ i <= frameIdx ? 'opacity-100' : 'opacity-30' }`}
                      style={{ backgroundColor: i < frameIdx ? '#34D399' : i === frameIdx ? f.phaseColor : '#6D28D9' }}
                    />
                    <div className="min-w-0">
                      <p className="text-frost/70 text-[10px] font-mono truncate">{f.title}</p>
                    </div>
                    {i < frameIdx && <span className="ml-auto text-jade text-[9px]">✓</span>}
                    {i === frameIdx && <span className="ml-auto text-orchid text-[9px]">◉</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
