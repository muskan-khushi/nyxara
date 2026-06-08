// src/pages/GraphView.jsx
import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import NetworkGraph   from "../components/graph/NetworkGraph";
import RingViewer     from "../components/graph/RingViewer";
import CommunityView  from "../components/graph/CommunityView";
import { RefreshCw, Network, GitBranch, Share2 } from "lucide-react";

const TABS = [
  { id: "network",    label: "Network Graph", icon: Network },
  { id: "rings",      label: "Ring Topology", icon: GitBranch },
  { id: "community",  label: "Communities",   icon: Share2 },
];

function buildGraphFromRings(rings) {
  const nodeMap = new Map();
  const links   = [];

  rings.forEach(ring => {
    Object.entries(ring.roles || {}).forEach(([acctId, role]) => {
      if (!nodeMap.has(acctId)) {
        nodeMap.set(acctId, {
          id:       acctId,
          risk:     ring.fraud_rate * 0.9 + 0.1 * Math.random(),
          role,
          in_ring:  true,
          ring_id:  ring.ring_id,
          shape:    ring.shape,
        });
      }
    });

    const accounts = ring.accounts || [];
    const hub      = ring.hub_node;

    if (ring.shape === "STAR" && hub) {
      accounts.filter(a => a !== hub).forEach(mule => {
        links.push({ source: hub, target: mule });
      });
    } else {
      for (let i = 0; i < accounts.length - 1; i++) {
        links.push({ source: accounts[i], target: accounts[i + 1] });
      }
      if (ring.shape === "CYCLE" && accounts.length > 1) {
        links.push({ source: accounts[accounts.length - 1], target: accounts[0] });
      }
    }
  });

  return {
    nodes: Array.from(nodeMap.values()),
    links,
  };
}

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

      const fetchedRings = rRes.status === "fulfilled"
        ? (rRes.value.data.rings || [])
        : [];

      const fetchedCommunities = cRes.status === "fulfilled"
        ? (cRes.value.data.clusters || [])
        : [];

      setRings(fetchedRings);
      setCommunities(fetchedCommunities);
      setGraphData(buildGraphFromRings(fetchedRings));
      setLastRefresh(new Date());
    } catch (e) {
      setError("Could not load graph data. Is the AI engine running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statsBar = [
    { label: "Rings",       value: rings.length,                        color: "text-orchid" },
    { label: "Ring Nodes",  value: graphData.nodes.length,              color: "text-cyan" },
    { label: "Communities", value: communities.length,                  color: "text-amber" },
    { label: "High-Risk",   value: communities.filter(c => c.fraud_rate > 0.5).length, color: "text-crimson" },
  ];

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-frost">Graph View</h1>
          <p className="text-frost/50 text-sm mt-0.5">
            Mule account network topology — GNN-detected rings &amp; Louvain communities
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-frost/30 text-xs font-mono">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="btn-outline text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {statsBar.map(({ label, value, color }) => (
          <div key={label} className="card py-3 text-center">
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
            <p className="text-frost/40 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-amber/10 border border-amber/30 text-amber rounded-lg px-4 py-3 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-abyss rounded-lg p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all ${
              tab === id
                ? "bg-grape text-white shadow"
                : "text-frost/50 hover:text-frost"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card min-h-[520px]">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-frost/30 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading graph data...
          </div>
        ) : (
          <>
            {tab === "network" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-frost/60 text-sm">
                    {graphData.nodes.length} nodes · {graphData.links.length} edges
                    {selected && (
                      <span className="ml-3 text-orchid font-mono">
                        Selected: {selected.id} ({selected.role})
                      </span>
                    )}
                  </p>
                  <div className="flex gap-3 text-[10px] text-frost/40">
                    {[
                      { icon: "◆", label: "Hub/Orchestrator" },
                      { icon: "▲", label: "Bridge" },
                      { icon: "●", label: "Mule/Member" },
                    ].map(({ icon, label }) => (
                      <span key={label}>{icon} {label}</span>
                    ))}
                  </div>
                </div>
                {graphData.nodes.length > 0 ? (
                  <NetworkGraph
                    nodes={graphData.nodes}
                    links={graphData.links}
                    onNodeClick={setSelected}
                    height={480}
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 text-frost/30 text-sm text-center">
                    <div>
                      <p className="text-4xl mb-3">🕸️</p>
                      <p>No ring data yet. Run <code className="text-orchid">training/run_all.py</code> to detect rings.</p>
                    </div>
                  </div>
                )}

                {/* Selected node detail */}
                {selected && (
                  <div className="bg-night/60 rounded-lg border border-grape/30 p-3 text-sm grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-frost/40 text-xs">Account</p>
                      <p className="text-frost font-mono">{selected.id}</p>
                    </div>
                    <div>
                      <p className="text-frost/40 text-xs">Risk Score</p>
                      <p className="font-mono font-bold" style={{
                        color: selected.risk > 0.85 ? "#DC2626" : selected.risk > 0.7 ? "#F97316" : "#F59E0B"
                      }}>
                        {(selected.risk * 100).toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-frost/40 text-xs">Role</p>
                      <p className="text-orchid font-medium capitalize">{selected.role}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "rings" && <RingViewer rings={rings} />}

            {tab === "community" && <CommunityView communities={communities} />}
          </>
        )}
      </div>
    </div>
  );
}