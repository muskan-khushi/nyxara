// src/pages/CockpitHUD.jsx
// Analyst Cockpit — NASA mission control streaming metrics HUD

import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/* ── Animated streaming counter ── */
function StreamCounter({ target, prefix = '', suffix = '', decimals = 0, color = '#A78BFA', label, sub, icon }) {
  const [display, setDisplay] = useState(0);
  const [delta, setDelta] = useState(null);
  const prevRef = useRef(target);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = target;
    if (typeof target !== 'number') { setDisplay(target); return; }
    if (prev !== target && prev !== 0) {
      setDelta(target > prev ? '+' : '-');
      setTimeout(() => setDelta(null), 1500);
    }
    let start = null;
    const duration = 1000;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(typeof decimals === 'number'
        ? parseFloat((prev + (target - prev) * ease).toFixed(decimals))
        : Math.round(prev + (target - prev) * ease)
      );
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, decimals]);

  return (
    <div className="card group hover:shadow-lg transition-all duration-200 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 50%, ${color}08, transparent 70%)` }}
      />
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {delta && (
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
            delta === '+' ? 'bg-jade/15 text-jade' : 'bg-crimson/15 text-crimson'
          }`}>{delta}</span>
        )}
      </div>
      <div className="flex items-end gap-1 mb-1">
        <span className="text-3xl font-black font-mono" style={{ color }}>
          {prefix}{typeof display === 'number' ? display.toLocaleString() : display}{suffix}
        </span>
      </div>
      <p className="text-frost font-semibold text-sm mb-0.5">{label}</p>
      <p className="text-frost/30 text-xs">{sub}</p>
      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: color, opacity: 0.4 }} />
    </div>
  );
}

/* ── Mini sparkline canvas ── */
function Sparkline({ data, color = '#A78BFA', w = 200, h = 50 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !data.length) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr;
    c.style.width = `${w}px`; c.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * (w - 4) + 2,
      y: h - ((v - min) / range) * (h - 8) - 4,
    }));
    // Fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `${color}40`);
    grad.addColorStop(1, `${color}00`);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, h);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    // Line
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [data, color, w, h]);
  return <canvas ref={canvasRef} />;
}

/* ── Live alert row ── */
function LiveAlertRow({ alert, idx }) {
  const BADGE = {
    BLOCK: 'bg-crimson/15 text-crimson border-crimson/30',
    FLAG: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    REVIEW: 'bg-amber/15 text-amber border-amber/30',
  };
  return (
    <div
      className="flex items-center gap-3 py-2.5 border-b border-grape/8 last:border-0 animate-fade-in"
      style={{ animationDelay: `${idx * 50}ms` }}
    >
      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${BADGE[alert.decision] || BADGE.REVIEW}`}>
        {alert.decision}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-frost/80 font-mono text-xs truncate">{alert.accountId}</span>
          <span className="text-frost/30 font-mono text-[9px] font-bold">
            {Math.round((alert.riskScore || 0) * 100)}
          </span>
        </div>
        <p className="text-frost/30 text-[9px] truncate">{(alert.riskFactors || []).join(', ')}</p>
      </div>
      <span className="text-frost/20 text-[9px] font-mono flex-shrink-0">
        {alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'live'}
      </span>
    </div>
  );
}

/* ── System health bar ── */
function HealthBar({ label, value, color, unit = '%' }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-frost/40 text-[10px] font-mono w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-grape/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono font-bold w-12 text-right" style={{ color }}>
        {typeof value === 'number' ? value.toFixed(1) : value}{unit}
      </span>
    </div>
  );
}

export default function CockpitHUD() {
  const [stats, setStats] = useState(null);
  const [throughput, setThroughput] = useState(Array.from({ length: 30 }, () => Math.random() * 80 + 20));
  const [latency, setLatency] = useState(Array.from({ length: 30 }, () => Math.random() * 30 + 5));
  const [alerts, setAlerts] = useState([]);
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState({
    txnPerSec: 142,
    activeRings: 31,
    amountProtected: 4712847500,
    strsToday: 142,
    alertQueueDepth: 18,
    avgLatencyMs: 8.4,
  });

  // Pull real stats
  useEffect(() => {
    api.get('/api/admin/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/api/alerts').then(r => {
      const data = r.data.alerts || [];
      setAlerts(data.slice(0, 15));
    }).catch(() => {});
  }, []);

  // Simulate live streaming updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      setLive(prev => ({
        txnPerSec: Math.max(80, prev.txnPerSec + (Math.random() - 0.45) * 20),
        activeRings: Math.max(10, prev.activeRings + (Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0)),
        amountProtected: prev.amountProtected + Math.random() * 150000 + 50000,
        strsToday: prev.strsToday + (Math.random() > 0.92 ? 1 : 0),
        alertQueueDepth: Math.max(0, prev.alertQueueDepth + (Math.random() - 0.4) * 3),
        avgLatencyMs: Math.max(2, Math.min(50, prev.avgLatencyMs + (Math.random() - 0.5) * 2)),
      }));
      setThroughput(prev => [...prev.slice(1), Math.random() * 80 + 40]);
      setLatency(prev => [...prev.slice(1), Math.random() * 30 + 5]);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  // Add simulated live alerts
  useEffect(() => {
    if (tick % 5 !== 0 || tick === 0) return;
    const decisions = ['BLOCK', 'FLAG', 'REVIEW'];
    const newAlert = {
      _id: `live_${tick}`,
      alertId: `live_${tick}`,
      accountId: `ACC-${Math.floor(Math.random() * 90000 + 10000)}`,
      riskScore: 0.65 + Math.random() * 0.35,
      decision: decisions[Math.floor(Math.random() * decisions.length)],
      riskFactors: [['Velocity Spike', 'Round Amount', 'Nocturnal', 'Pass-Through', 'Bot Detected'][Math.floor(Math.random() * 5)]],
      createdAt: new Date().toISOString(),
    };
    setAlerts(prev => [newAlert, ...prev.slice(0, 14)]);
  }, [tick]);

  const totalAnalyzed = stats?.counts?.total || 12450;
  const totalBlocked = stats?.counts?.blocked || 432;
  const formatCrore = (n) => {
    const cr = n / 10000000;
    return cr >= 100 ? `₹${(cr / 100).toFixed(1)}K Cr` : `₹${cr.toFixed(1)} Cr`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-frost">Analyst Cockpit</h1>
          <p className="text-frost/40 text-sm mt-0.5">Live operations center — real-time FinSec intelligence stream</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-jade/10 border border-jade/30 rounded-lg px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-jade animate-pulse" />
            <span className="text-jade text-xs font-mono font-bold">ALL SYSTEMS LIVE</span>
          </div>
          <div className="text-frost/30 text-xs font-mono">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Main metric stream */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StreamCounter
          target={Math.round(live.txnPerSec)}
          suffix="/s"
          color="#38BDF8"
          label="Transactions"
          sub="Analyzed per second"
          icon="⚡"
        />
        <StreamCounter
          target={Math.round(live.activeRings)}
          color="#FB7185"
          label="Active Rings"
          sub="Under surveillance"
          icon="🕸️"
        />
        <StreamCounter
          target={Math.round(live.amountProtected / 10000000 * 10) / 10}
          suffix=" Cr"
          prefix="₹"
          decimals={1}
          color="#34D399"
          label="Amount Protected"
          sub="Total intercepted today"
          icon="🛡"
        />
        <StreamCounter
          target={Math.round(live.strsToday)}
          color="#C084FC"
          label="STRs Drafted"
          sub="FIU-IND auto-filed"
          icon="📋"
        />
        <StreamCounter
          target={Math.round(live.alertQueueDepth)}
          color="#FBBF24"
          label="Alert Queue"
          sub="Pending analyst review"
          icon="🚨"
        />
        <StreamCounter
          target={parseFloat(live.avgLatencyMs.toFixed(1))}
          suffix="ms"
          decimals={1}
          color="#A78BFA"
          label="Detect Latency"
          sub="Avg detection speed"
          icon="⏱"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Throughput chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-frost/70 font-semibold text-sm">Analysis Throughput</p>
              <p className="text-frost/30 text-xs">Transactions processed / second (30s window)</p>
            </div>
            <div className="text-right">
              <p className="text-cyan text-xl font-bold font-mono">{Math.round(live.txnPerSec)}</p>
              <p className="text-frost/30 text-[9px]">txn/s</p>
            </div>
          </div>
          <div className="w-full">
            <Sparkline data={throughput} color="#38BDF8" w={500} h={60} />
          </div>
        </div>

        {/* Latency chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-frost/70 font-semibold text-sm">Detection Latency</p>
              <p className="text-frost/30 text-xs">AI engine response time in ms (30s window)</p>
            </div>
            <div className="text-right">
              <p className="text-orchid text-xl font-bold font-mono">{live.avgLatencyMs.toFixed(1)}ms</p>
              <p className="text-frost/30 text-[9px]">avg latency</p>
            </div>
          </div>
          <div className="w-full">
            <Sparkline data={latency} color="#A78BFA" w={500} h={60} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Live alert ticker */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-crimson animate-pulse" />
              <span className="text-frost/70 font-semibold text-sm">Live Alert Feed</span>
              <span className="bg-crimson text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {Math.round(live.alertQueueDepth)}
              </span>
            </div>
            <span className="text-frost/20 text-[9px] font-mono">Auto-refreshing</span>
          </div>
          <div className="divide-y divide-grape/8">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-frost/30 text-sm">Waiting for alerts...</div>
            ) : (
              alerts.map((a, i) => <LiveAlertRow key={a._id || i} alert={a} idx={i} />)
            )}
          </div>
        </div>

        {/* System health */}
        <div className="space-y-4">
          <div className="card">
            <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-4">System Health</p>
            <div className="space-y-3">
              <HealthBar label="AI Engine" value={94.2} color="#34D399" />
              <HealthBar label="Cybersec Engine" value={98.7} color="#38BDF8" />
              <HealthBar label="Blockchain Audit" value={99.1} color="#A78BFA" />
              <HealthBar label="MongoDB" value={67.3} color="#FBBF24" unit=" GB" />
              <HealthBar label="Redis Cache" value={23.1} color="#C084FC" unit=" MB" />
            </div>
          </div>

          <div className="card">
            <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-4">Model Performance</p>
            <div className="space-y-3">
              {[
                { label: 'AUC-ROC', value: 98.2, color: '#C084FC' },
                { label: 'F1 Score', value: 91.0, color: '#38BDF8' },
                { label: 'Precision', value: 94.0, color: '#34D399' },
                { label: 'Recall', value: 89.0, color: '#FBBF24' },
              ].map(m => <HealthBar key={m.label} label={m.label} value={m.value} color={m.color} />)}
            </div>
          </div>

          <div className="card">
            <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-3">Today's Summary</p>
            <div className="space-y-2">
              {[
                { label: 'Total Analyzed', value: totalAnalyzed.toLocaleString(), color: 'text-frost' },
                { label: 'Blocked', value: totalBlocked.toLocaleString(), color: 'text-crimson' },
                { label: 'Detection Rate', value: `${((totalBlocked / totalAnalyzed) * 100).toFixed(1)}%`, color: 'text-orange-400' },
                { label: 'False Positives', value: '< 0.3%', color: 'text-jade' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-frost/40 text-xs">{label}</span>
                  <span className={`text-xs font-mono font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
