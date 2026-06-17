// src/pages/RiskAtlas.jsx
// National Mule Risk Atlas — India choropleth bubble map

import { useState, useEffect, useRef } from 'react';
import { INDIA_STATES, INDIA_OUTLINE, NATIONAL_STATS, RISK_COLORS } from '../data/indiaMapData';

/* ── Mini sparkline ── */
function Spark({ data, color = '#A78BFA', w = 60, h = 24 }) {
  if (!data?.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 2) + 1;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Animated counter ── */
function Counter({ target, prefix = '', suffix = '', duration = 1200, className = '' }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const isNum = typeof target === 'number';
    if (!isNum) { setVal(target); return; }
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return <span className={className}>{prefix}{typeof val === 'number' ? val.toLocaleString() : val}{suffix}</span>;
}

/* ── Pulsing ring (SVG animated) ── */
function PulseRing({ cx, cy, color, size }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={size + 4} fill="none" stroke={color} strokeWidth="1" opacity="0.4">
        <animate attributeName="r" values={`${size + 4};${size + 16};${size + 4}`} dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={size + 10} fill="none" stroke={color} strokeWidth="0.5" opacity="0.2">
        <animate attributeName="r" values={`${size + 10};${size + 22};${size + 10}`} dur="2s" begin="0.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" begin="0.5s" repeatCount="indefinite" />
      </circle>
    </>
  );
}

export default function RiskAtlas() {
  const [hovered, setHovered] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const mapRef = useRef(null);

  const filteredStates = INDIA_STATES.filter(s =>
    filter === 'ALL' || s.riskLevel === filter
  );

  const handleStateHover = (state, e) => {
    setHovered(state);
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      setPopupPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const nationalTotals = {
    rings: INDIA_STATES.reduce((a, s) => a + s.activeRings, 0),
    criticalCount: INDIA_STATES.filter(s => s.riskLevel === 'CRITICAL').length,
    highCount: INDIA_STATES.filter(s => s.riskLevel === 'HIGH').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">National Mule Risk Atlas</h1>
          <p className="text-frost/40 text-sm mt-1 font-medium">Live geospatial mule density intelligence — I4C MuleHunter alignment</p>
        </div>
        <div className="flex items-center gap-2">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(level => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                filter === level
                  ? level === 'CRITICAL' ? 'bg-crimson/20 border-crimson/50 text-crimson shadow-[0_0_10px_rgba(225,29,72,0.3)]'
                  : level === 'HIGH' ? 'bg-orange/20 border-orange/50 text-orange shadow-[0_0_10px_rgba(249,115,22,0.3)]'
                  : level === 'MEDIUM' ? 'bg-amber/20 border-amber/50 text-amber shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                  : level === 'LOW' ? 'bg-jade/20 border-jade/50 text-jade shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-grape/20 border-grape/50 text-orchid shadow-[0_0_10px_rgba(192,132,252,0.3)]'
                  : 'bg-black/40 border-white/5 text-frost/40 hover:border-white/20 hover:text-white'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* National stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 animate-slide-up delay-100">
        {[
          { label: 'Active Rings', value: NATIONAL_STATS.totalRings, color: 'text-crimson text-shadow-[0_0_10px_rgba(225,29,72,0.5)]', prefix: '' },
          { label: 'Amount at Risk', value: NATIONAL_STATS.totalAmountAtRisk, color: 'text-orange-400', prefix: '' },
          { label: 'Critical States', value: nationalTotals.criticalCount, color: 'text-crimson', prefix: '' },
          { label: 'High-Risk States', value: nationalTotals.highCount, color: 'text-orange-400', prefix: '' },
          { label: 'STRs Today', value: NATIONAL_STATS.strsFiledToday, color: 'text-amber', prefix: '' },
          { label: 'Accounts Frozen', value: NATIONAL_STATS.accountsFrozen, color: 'text-orchid', prefix: '' },
          { label: 'Avg Detection', value: NATIONAL_STATS.avgDetectionTime, color: 'text-jade', prefix: '' },
          { label: 'Banks Onboarded', value: NATIONAL_STATS.banksOnboarded, color: 'text-cyan', prefix: '' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card py-3 text-center">
            <p className={`text-xl font-bold font-mono ${color} mb-0.5`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            <p className="text-frost/30 text-[9px] uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Map — 3 cols */}
        <div className="xl:col-span-3">
          <div className="card p-0 overflow-hidden" style={{ background: '#08040f' }}>
            <div className="px-4 py-3 border-b border-grape/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-jade animate-pulse" />
                <span className="text-frost/60 text-xs font-semibold">Live Risk Distribution — India</span>
              </div>
              <div className="flex items-center gap-4">
                {Object.entries(RISK_COLORS).map(([level, c]) => (
                  <div key={level} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.fill }} />
                    <span className="text-frost/30 text-[9px] font-mono">{level}</span>
                  </div>
                ))}
              </div>
            </div>

            <div ref={mapRef} className="relative" style={{ height: 520 }}>
              <svg
                viewBox="0 0 580 650"
                style={{ width: '100%', height: '100%', display: 'block' }}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(109,40,217,0.06)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="580" height="650" fill="url(#grid)" />

                {/* India outline */}
                <path
                  d={INDIA_OUTLINE}
                  fill="rgba(109,40,217,0.06)"
                  stroke="rgba(167,139,250,0.25)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />

                {/* Pulse rings for critical/high states */}
                {INDIA_STATES.filter(s => ['CRITICAL', 'HIGH'].includes(s.riskLevel)).map(s => {
                  const rc = RISK_COLORS[s.riskLevel];
                  const size = 6 + s.riskScore * 18;
                  return (
                    <PulseRing key={`pulse-${s.id}`} cx={s.cx} cy={s.cy} color={rc.fill} size={size} />
                  );
                })}

                {/* State bubbles */}
                {INDIA_STATES.map(state => {
                  const rc = RISK_COLORS[state.riskLevel];
                  const r = 6 + state.riskScore * 18;
                  const isHov = hovered?.id === state.id;
                  const dimmed = filter !== 'ALL' && state.riskLevel !== filter;
                  return (
                    <g
                      key={state.id}
                      style={{ cursor: 'pointer', opacity: dimmed ? 0.2 : 1, transition: 'opacity 0.3s' }}
                      onMouseEnter={(e) => handleStateHover(state, e)}
                      onMouseMove={(e) => handleStateHover(state, e)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {/* Glow bg */}
                      <circle
                        cx={state.cx} cy={state.cy} r={r + 6}
                        fill={rc.glow}
                        opacity={isHov ? 1 : 0.4}
                      />
                      {/* Main bubble */}
                      <circle
                        cx={state.cx} cy={state.cy} r={r}
                        fill={`${rc.fill}30`}
                        stroke={rc.fill}
                        strokeWidth={isHov ? 2 : 1.2}
                        style={{ filter: isHov ? `drop-shadow(0 0 8px ${rc.fill})` : 'none' }}
                      />
                      {/* Risk fill */}
                      <circle
                        cx={state.cx} cy={state.cy} r={r * state.riskScore}
                        fill={`${rc.fill}50`}
                      />
                      {/* State code label */}
                      <text
                        x={state.cx} y={state.cy + 1}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="rgba(245,243,255,0.9)" fontSize="7"
                        fontWeight="bold" fontFamily="Inter, sans-serif"
                      >
                        {state.code}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Hover popup */}
              {hovered && (
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    left: Math.min(popupPos.x + 12, 480),
                    top: Math.max(popupPos.y - 10, 10),
                  }}
                >
                  <div className="bg-abyss/95 border border-grape/40 rounded-xl p-4 w-64 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-frost font-bold text-sm">{hovered.name}</p>
                      <span
                        className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border"
                        style={{
                          color: RISK_COLORS[hovered.riskLevel].fill,
                          borderColor: `${RISK_COLORS[hovered.riskLevel].fill}40`,
                          backgroundColor: `${RISK_COLORS[hovered.riskLevel].fill}15`,
                        }}
                      >
                        {hovered.riskLevel}
                      </span>
                    </div>

                    <div className="space-y-2 mb-3">
                      {[
                        { label: 'Risk Score', value: `${Math.round(hovered.riskScore * 100)}%` },
                        { label: 'Active Rings', value: hovered.activeRings },
                        { label: 'Amount at Risk', value: hovered.amountAtRisk },
                        { label: 'Top Attack', value: hovered.topMuleType },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-frost/40 text-[10px]">{label}</span>
                          <span className="text-frost/80 text-[10px] font-mono font-semibold">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-grape/15">
                      <p className="text-frost/30 text-[9px] mb-1">7-day alert trend</p>
                      <Spark data={hovered.alertsTrend} color={RISK_COLORS[hovered.riskLevel].fill} w={200} h={28} />
                    </div>

                    <div className="mt-2 pt-2 border-t border-grape/15">
                      <p className="text-frost/30 text-[9px] mb-1">Banks affected</p>
                      <div className="flex flex-wrap gap-1">
                        {hovered.banksAffected.map(b => (
                          <span key={b} className="text-[8px] font-mono px-1.5 py-0.5 bg-grape/15 border border-grape/25 rounded text-orchid">{b}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: ranked states */}
        <div className="space-y-4">
          <div className="card">
            <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-4">Top Risk States</p>
            <div className="space-y-3">
              {[...INDIA_STATES]
                .sort((a, b) => b.riskScore - a.riskScore)
                .slice(0, 8)
                .map((state, rank) => {
                  const rc = RISK_COLORS[state.riskLevel];
                  return (
                    <div
                      key={state.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all hover:bg-grape/8 ${
                        hovered?.id === state.id ? 'bg-grape/10' : ''
                      }`}
                      onMouseEnter={() => setHovered(state)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <span className="text-frost/20 font-mono text-xs w-4">{rank + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-frost/80 text-xs font-medium truncate">{state.name}</span>
                          <span className="text-[9px] font-mono font-bold" style={{ color: rc.fill }}>
                            {Math.round(state.riskScore * 100)}%
                          </span>
                        </div>
                        <div className="h-1 bg-grape/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${state.riskScore * 100}%`, backgroundColor: rc.fill }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-mono font-bold text-frost/60">{state.activeRings}</p>
                        <p className="text-[8px] text-frost/25">rings</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Attack type breakdown */}
          <div className="card">
            <p className="text-frost/40 text-xs uppercase tracking-wider font-medium mb-3">Attack Typology</p>
            <div className="space-y-2">
              {[
                { type: 'Smurfing Ring', count: 8, color: '#FB7185' },
                { type: 'UPI Ghost Mule', count: 6, color: '#C084FC' },
                { type: 'RAT Cycle', count: 4, color: '#FBBF24' },
                { type: 'SIM Swap', count: 4, color: '#38BDF8' },
                { type: 'Dormant Takeover', count: 6, color: '#34D399' },
              ].map(({ type, count, color }) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-frost/60 text-xs flex-1">{type}</span>
                  <span className="text-xs font-mono font-bold" style={{ color }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* I4C alignment */}
          <div className="bg-jade/5 border border-jade/20 rounded-xl p-4">
            <p className="text-jade text-xs font-semibold mb-1">I4C MuleHunter Aligned</p>
            <p className="text-frost/40 text-[10px] leading-relaxed">
              Geospatial risk intelligence mapped against RBI Innovation Hub MuleHunter benchmark criteria for cross-state coordination.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
