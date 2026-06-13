// src/pages/Landing.jsx
// Nyxara — AI-Powered Mule Account Detection Platform
// Landing/intro page with animated hero, feature showcase, and demo CTA

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ── Particle canvas for background atmosphere ── */
function ParticleField() {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    const particles = [];
    const W = () => canvas.width;
    const H = () => canvas.height;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    window.addEventListener("resize", resize);
    resize();

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * 1400,
        y: Math.random() * 800,
        r: Math.random() * 1.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    const draw = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(123,47,190,${0.12 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(192,132,252,${p.opacity})`;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.7 }}
    />
  );
}

/* ── Animated counter ── */
function AnimatedNumber({ target, suffix = "", duration = 2000 }) {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 400);
    return () => { clearTimeout(timeout); cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return <>{value.toLocaleString()}{suffix}</>;
}

/* ── Detection layer card ── */
function LayerCard({ layer, label, description, delay }) {
  return (
    <div
      className="group relative p-5 rounded-xl border border-grape/20 bg-abyss/60 backdrop-blur-sm 
                 hover:border-grape/60 hover:bg-abyss/90 transition-all duration-300 cursor-default"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-grape/15 border border-grape/30 
                        flex items-center justify-center group-hover:bg-grape/25 transition-colors">
          <span className="text-orchid font-mono font-bold text-sm">{String(layer).padStart(2, "0")}</span>
        </div>
        <div>
          <h3 className="text-frost font-semibold text-sm mb-1">{label}</h3>
          <p className="text-frost/50 text-xs leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-grape/40 to-transparent 
                      opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

/* ── Risk pulse indicator ── */
function RiskPulse({ score = 0.87, decision = "BLOCK" }) {
  const colors = { BLOCK: "#DC2626", FLAG: "#F97316", REVIEW: "#F59E0B", APPROVE: "#10B981" };
  const color = colors[decision];

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: `${40 + i * 26}px`,
            height: `${40 + i * 26}px`,
            borderColor: color,
            opacity: 0.15 / i,
            animation: `ping ${1.5 + i * 0.4}s cubic-bezier(0,0,0.2,1) infinite`,
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}
      <div
        className="relative w-16 h-16 rounded-full flex items-center justify-center border-2"
        style={{ backgroundColor: `${color}20`, borderColor: color }}
      >
        <span className="text-white font-bold font-mono text-lg">{Math.round(score * 100)}</span>
      </div>
    </div>
  );
}

const LAYERS = [
  { layer: 1, label: "Temporal Graph Network", description: "GraphSAGE + GAT captures dormant-to-active mule lifecycle patterns across time" },
  { layer: 2, label: "Contrastive Transformer", description: "Self-supervised fraud embeddings from unlabeled data — +0.062 AUC uplift" },
  { layer: 3, label: "Stacked Ensemble", description: "XGBoost + LightGBM + CatBoost with a logistic meta-learner for tabular signals" },
  { layer: 4, label: "Variational AutoEncoder", description: "Zero-day mule detection via reconstruction error on unseen behavioral patterns" },
  { layer: 5, label: "LineMVGNN", description: "Dual-view graph: account nodes AND transaction edges analyzed simultaneously" },
  { layer: 6, label: "SHAP + LLM Narration", description: "Every flag produces a legally appropriate FIU-IND compliant STR draft" },
];

const STATS = [
  { value: 9082, suffix: "", label: "Training accounts", sub: "9,082 rows × 3,924 features" },
  { value: 98, suffix: ".2%", label: "AUC-ROC", sub: "On held-out test set" },
  { value: 0, suffix: "₹0", label: "Infrastructure cost", sub: "100% free & open source", isRupee: true },
  { value: 6, suffix: "", label: "AI detection layers", sub: "GNN · Ensemble · VAE · BEI" },
];

export default function Landing() {
  const navigate = useNavigate();
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-night text-frost overflow-x-hidden">
      {/* ── Hero Section ── */}
      <section className="relative min-h-screen flex flex-col">
        <ParticleField />

        {/* Radial glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: "900px",
            height: "600px",
            background: "radial-gradient(ellipse at center, rgba(123,47,190,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-grape/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-grape/20 border border-grape/40 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="#C084FC" strokeWidth="1.2" fill="none"/>
                <circle cx="8" cy="8" r="2" fill="#C084FC"/>
              </svg>
            </div>
            <span className="text-lg font-bold">Nyx<span className="text-orchid">ara</span></span>
            <span className="text-[10px] font-mono text-grape/60 border border-grape/30 rounded px-1.5 py-0.5">v1.0</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-frost/60">
            <a href="#detection" className="hover:text-frost transition-colors">Detection</a>
            <a href="#architecture" className="hover:text-frost transition-colors">Architecture</a>
            <a href="#compliance" className="hover:text-frost transition-colors">Compliance</a>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 bg-grape hover:bg-grape/80 
                       text-white text-sm font-medium rounded-lg transition-all duration-150"
          >
            <span>Open Platform</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7H11M7 3L11 7L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-grape/30 
                          bg-grape/10 text-xs text-orchid mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-orchid animate-pulse" />
            Aligned with I4C-RBIH MoU · May 2026 · National Hackathon
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight max-w-4xl">
            Where others see{" "}
            <span className="relative">
              <span className="text-orchid">transactions</span>
              <span
                className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orchid to-transparent"
              />
            </span>
            ,{" "}
            <br className="hidden md:block" />
            Nyxara reads the{" "}
            <span className="text-grape">shadow network.</span>
          </h1>

          <p className="text-frost/60 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
            India's most advanced AI platform for mule account detection. 6-layer neural stack,
            real-time graph intelligence, and FIU-IND compliant STR generation — deployed at ₹0 infrastructure cost.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="group flex items-center gap-3 px-8 py-3.5 bg-grape hover:bg-grape/90 
                         text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-grape/20"
            >
              Launch Dashboard
              <svg
                width="16" height="16" viewBox="0 0 16 16" fill="none"
                className="group-hover:translate-x-1 transition-transform"
              >
                <path d="M3 8H13M8 3L13 8L8 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={() => navigate("/analyzer")}
              className="flex items-center gap-2 px-8 py-3.5 border border-grape/40 hover:border-grape 
                         text-orchid hover:text-white rounded-xl transition-all duration-200"
            >
              Try Account Analyzer
            </button>
          </div>

          {/* Live demo indicator */}
          <div className="mt-12 flex items-center gap-2 text-xs text-frost/30">
            <span className="w-1.5 h-1.5 rounded-full bg-jade animate-pulse" />
            Demo credentials: admin@nyxara.ai · nyxara2026
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="relative z-10 flex justify-center pb-8">
          <div className="flex flex-col items-center gap-2 text-frost/20 text-xs animate-bounce">
            <span>scroll</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </section>

      {/* ── Stats Section ── */}
      <section ref={statsRef} className="relative py-20 border-y border-grape/10 bg-abyss/40">
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-bold font-mono text-orchid mb-1">
                  {statsVisible ? (
                    stat.isRupee ? "₹0" : <><AnimatedNumber target={stat.value} suffix="" duration={1800 + i * 200} />{stat.suffix}</>
                  ) : "—"}
                </div>
                <div className="text-frost/80 font-semibold text-sm mb-1">{stat.label}</div>
                <div className="text-frost/30 text-xs">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Detection Stack ── */}
      <section id="detection" className="py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-grape/20 
                            bg-grape/5 text-xs text-orchid mb-4">
              6-Layer AI Stack
            </div>
            <h2 className="text-4xl font-bold mb-4">Each layer sees what the others miss.</h2>
            <p className="text-frost/50 max-w-xl mx-auto">
              A 2025 systematic review of 57 fraud detection studies found ensemble + graph hybrids
              outperform single models by 8–15% AUC. Nyxara stacks six.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {LAYERS.map((l, i) => (
              <LayerCard key={l.layer} {...l} delay={i * 80} />
            ))}
          </div>

          {/* Risk score formula */}
          <div className="mt-12 p-6 rounded-2xl border border-grape/20 bg-abyss/60">
            <p className="text-xs text-frost/40 font-mono mb-3 uppercase tracking-wider">Final Risk Fusion Formula</p>
            <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
              <span className="text-frost/60">finalRisk =</span>
              {[
                { label: "GNN", weight: "0.35", color: "#7B2FBE" },
                { label: "Ensemble", weight: "0.25", color: "#C084FC" },
                { label: "VAE", weight: "0.20", color: "#06B6D4" },
                { label: "BEI", weight: "0.12", color: "#F59E0B" },
                { label: "Graph", weight: "0.08", color: "#10B981" },
              ].map((f, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-frost/40">+</span>}
                  <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: `${f.color}20`, color: f.color }}>
                    {f.weight}×{f.label}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Architecture Section ── */}
      <section id="architecture" className="py-24 px-8 bg-abyss/20">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-xs text-orchid font-mono mb-3 uppercase tracking-wider">Real-Time Intelligence</div>
              <h2 className="text-4xl font-bold mb-6 leading-tight">
                From transaction to STR in <span className="text-orchid">&lt;100ms</span>
              </h2>
              <p className="text-frost/50 mb-8 leading-relaxed">
                Nyxara's microservice architecture runs GNN scoring, Behavioral Entropy Index,
                Louvain community detection, and blockchain audit in a parallel pipeline —
                WebSocket-pushing alerts to compliance officers in real time.
              </p>

              <div className="space-y-4">
                {[
                  { icon: "🧠", label: "AI Engine", sub: "GNN + Ensemble + VAE · Port 8001", color: "text-orchid" },
                  { icon: "🛡", label: "Cybersec Engine", sub: "BEI + JA3 + Device Graph · Port 8002", color: "text-cyan" },
                  { icon: "⛓", label: "Blockchain Audit", sub: "Merkle tree + SHA-256 chain · Port 8003", color: "text-jade" },
                  { icon: "⚡", label: "Node.js Backend", sub: "Orchestration + WebSocket · Port 8080", color: "text-amber" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-night/40 border border-grape/10 hover:border-grape/30 transition-colors">
                    <span className="text-2xl">{s.icon}</span>
                    <div>
                      <div className={`font-semibold text-sm ${s.color}`}>{s.label}</div>
                      <div className="text-frost/40 text-xs font-mono">{s.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live risk preview */}
            <div className="flex flex-col items-center gap-6">
              <div className="relative p-8 rounded-2xl bg-night border border-grape/20 w-full max-w-sm">
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-jade animate-pulse" />
                  <span className="text-xs text-frost/30">Live</span>
                </div>
                <p className="text-frost/50 text-xs mb-6 font-mono">Account: ACC-7832</p>
                <div className="flex justify-center mb-6">
                  <RiskPulse score={0.87} decision="BLOCK" />
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: "GNN", val: 0.91, color: "#7B2FBE" },
                    { label: "Ensemble", val: 0.85, color: "#C084FC" },
                    { label: "VAE", val: 0.78, color: "#06B6D4" },
                    { label: "BEI", val: 0.62, color: "#F59E0B" },
                    { label: "Graph", val: 0.94, color: "#10B981" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-frost/40 text-xs font-mono w-16">{label}</span>
                      <div className="flex-1 h-1.5 bg-grape/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${val * 100}%`, background: color }}
                        />
                      </div>
                      <span className="text-frost/60 text-xs font-mono w-8 text-right">{Math.round(val * 100)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 p-3 rounded-lg bg-crimson/10 border border-crimson/20">
                  <p className="text-crimson text-xs font-mono font-bold">⚠ BLOCK — Ring membership detected</p>
                  <p className="text-crimson/60 text-xs mt-1">Community fraud rate: 83% · 6-node STAR ring</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Compliance Section ── */}
      <section id="compliance" className="py-24 px-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="text-xs text-orchid font-mono mb-3 uppercase tracking-wider">Regulatory Alignment</div>
          <h2 className="text-4xl font-bold mb-4">Built for India's compliance stack</h2>
          <p className="text-frost/50 max-w-2xl mx-auto mb-12">
            Every decision is cryptographically sealed. Every flag becomes a draft STR.
            Aligned with PMLA 2002, FIU-IND guidelines, and the I4C-RBIH MoU signed May 12, 2026.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Blockchain Audit",
                sub: "SHA-256 hash chain + Merkle tree",
                body: "Every risk score is cryptographically sealed. No score can be altered retroactively — tamper detection in real time.",
                badge: "Immutable",
                badgeColor: "text-jade bg-jade/10 border-jade/20",
              },
              {
                title: "STR Auto-Draft",
                sub: "FIU-IND format · PMLA 2002",
                body: "LLM-generated Suspicious Transaction Reports with FATF risk indicator mapping and SHAP attribution. Human review required.",
                badge: "Compliant",
                badgeColor: "text-orchid bg-orchid/10 border-orchid/20",
              },
              {
                title: "Explainable AI",
                sub: "SHAP waterfall · Graph context",
                body: "Every flag ships with SHAP feature attribution, ring topology explanation, and plain-English compliance narrative.",
                badge: "Transparent",
                badgeColor: "text-cyan bg-cyan/10 border-cyan/20",
              },
            ].map((c, i) => (
              <div key={i} className="p-6 rounded-2xl bg-abyss border border-grape/20 text-left hover:border-grape/50 transition-colors">
                <div className={`inline-flex text-xs px-2 py-0.5 rounded border font-mono mb-4 ${c.badgeColor}`}>
                  {c.badge}
                </div>
                <h3 className="font-bold text-frost mb-1">{c.title}</h3>
                <p className="text-orchid/60 text-xs font-mono mb-3">{c.sub}</p>
                <p className="text-frost/50 text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-8 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(123,47,190,0.08) 0%, transparent 70%)" }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-5xl font-bold mb-6">
            The shadow network has a pattern.
            <br />
            <span className="text-orchid">Nyxara reads it.</span>
          </h2>
          <p className="text-frost/50 mb-10">
            Built for National Level Hackathon · June 2026 · Team Nyxara
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-3 px-10 py-4 bg-grape hover:bg-grape/90 
                       text-white font-bold text-lg rounded-xl transition-all duration-200 
                       shadow-2xl shadow-grape/30 hover:shadow-grape/50"
          >
            Enter the Platform
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10H16M10 4L16 10L10 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <p className="mt-4 text-frost/20 text-sm">
            admin@nyxara.ai · nyxara2026 · All services run locally
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-grape/10 py-8 px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-frost/30 text-sm">
            <span className="text-frost/50 font-semibold">Nyx<span className="text-orchid/60">ara</span></span>
            <span>·</span>
            <span>AI-Powered Mule Account Detection</span>
            <span>·</span>
            <span>₹0 Infrastructure</span>
          </div>
          <div className="text-frost/20 text-xs font-mono">
            Research citations: arXiv:2404.00060 · MDPI Algorithms 18(12):770 · AI 2025;6(4):69
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}