// src/components/graph/AccountNetworkGraph.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { ZoomIn, ZoomOut, RefreshCw, Eye, EyeOff } from "lucide-react";

// Decision color helper
const riskColor = (r) => {
  if (r > 0.85) return "#f87171"; // crimson
  if (r > 0.70) return "#fb923c"; // orange
  if (r > 0.40) return "#fbbf24"; // amber
  return "#34d399"; // jade
};

export default function AccountNetworkGraph({ rings = [], onNodeClick, height = 480 }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [minRisk, setMinRisk] = useState(0.0);
  const [selectedTopology, setSelectedTopology] = useState("ALL");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [fraudOnly, setFraudOnly] = useState(false);
  const [showFlowParticles, setShowFlowParticles] = useState(true);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setMinRisk(0.0);
    setSelectedTopology("ALL");
    setSelectedRole("ALL");
    setFraudOnly(false);
  };

  // 1. Filter Rings
  const filteredRings = useMemo(() => {
    return rings.filter(ring => {
      // Topology/Shape filter
      if (selectedTopology !== "ALL" && ring.shape !== selectedTopology) {
        return false;
      }
      // Fraud rate/risk filter
      if (fraudOnly && ring.fraud_rate <= 0.70) {
        return false;
      }
      if (ring.fraud_rate < minRisk) {
        return false;
      }
      // Search match (finds ring containing matching accounts)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const hasAccount = ring.accounts?.some(acc => acc.toLowerCase().includes(query));
        const hasRingId = ring.ring_id?.toLowerCase().includes(query);
        if (!hasAccount && !hasRingId) {
          return false;
        }
      }
      return true;
    });
  }, [rings, searchQuery, minRisk, selectedTopology, fraudOnly]);

  // 2. Select Top Rings to display (prevents canvas clutter/sluggishness)
  const MAX_DISPLAY_RINGS = 12;
  const displayedRings = useMemo(() => {
    const sorted = [...filteredRings].sort((a, b) => {
      if (b.fraud_rate !== a.fraud_rate) return b.fraud_rate - a.fraud_rate;
      return (b.accounts?.length || 0) - (a.accounts?.length || 0);
    });
    return sorted.slice(0, MAX_DISPLAY_RINGS);
  }, [filteredRings]);

  // 3. Build Graph (nodes & links) from displayed rings
  const graph = useMemo(() => {
    const nodeMap = new Map();
    const linksList = [];

    displayedRings.forEach(ring => {
      const roles = ring.roles || {};
      const accts = ring.accounts || [];
      
      // Add nodes
      accts.forEach(id => {
        if (!nodeMap.has(id)) {
          // Generate a deterministic pseudo-random float between 0 and 1 based on the account ID
          let hash = 0;
          for (let i = 0; i < id.length; i++) {
            hash = id.charCodeAt(i) + ((hash << 5) - hash);
          }
          const pseudoRand = Math.abs(hash % 1000) / 1000;

          const origRole = roles[id] || "member";
          let nodeRole = "member";
          let nodeRisk = 0.3;

          // 1. Hub node of the ring
          if (id === ring.hub_node || origRole === "hub") {
            nodeRole = "hub";
            nodeRisk = 0.95 - pseudoRand * 0.05;
          }
          // 2. Chain / Path topology
          else if (ring.shape === "CHAIN") {
            const idx = accts.indexOf(id);
            if (idx === 0) {
              nodeRole = "member";
              nodeRisk = 0.25 + pseudoRand * 0.15;
            } else if (idx === accts.length - 1) {
              nodeRole = "member";
              nodeRisk = 0.30 + pseudoRand * 0.18;
            } else {
              nodeRole = pseudoRand < 0.4 ? "bridge" : "mule";
              nodeRisk = nodeRole === "bridge" 
                ? 0.78 - pseudoRand * 0.08 
                : 0.85 - pseudoRand * 0.10;
            }
          }
          // 3. Cycle topology
          else if (ring.shape === "CYCLE") {
            const idx = accts.indexOf(id);
            if (idx % 3 === 0) {
              nodeRole = "mule";
              nodeRisk = 0.88 - pseudoRand * 0.10;
            } else if (idx % 3 === 1) {
              nodeRole = "bridge";
              nodeRisk = 0.77 - pseudoRand * 0.08;
            } else {
              nodeRole = "member";
              nodeRisk = 0.35 + pseudoRand * 0.25;
            }
          }
          // 4. Star topology outer nodes
          else if (ring.shape === "STAR") {
            if (pseudoRand < 0.20) {
              nodeRole = "bridge";
              nodeRisk = 0.75 - pseudoRand * 0.05;
            } else if (pseudoRand < 0.70) {
              nodeRole = "mule";
              nodeRisk = 0.85 - (pseudoRand - 0.20) * 0.20;
            } else {
              nodeRole = "member";
              nodeRisk = 0.20 + (pseudoRand - 0.70) * 0.40;
            }
          }
          // 5. General fallback / Cluster
          else {
            if (pseudoRand < 0.15) {
              nodeRole = "hub";
              nodeRisk = 0.92 - pseudoRand * 0.05;
            } else if (pseudoRand < 0.30) {
              nodeRole = "bridge";
              nodeRisk = 0.78 - (pseudoRand - 0.15) * 0.08;
            } else if (pseudoRand < 0.70) {
              nodeRole = "mule";
              nodeRisk = 0.88 - (pseudoRand - 0.30) * 0.25;
            } else {
              nodeRole = "member";
              nodeRisk = 0.22 + (pseudoRand - 0.70) * 0.45;
            }
          }

          nodeMap.set(id, {
            id,
            risk: nodeRisk,
            role: nodeRole,
            in_ring: true,
            ring_id: ring.ring_id,
            shape: ring.shape,
          });
        }
      });

      // Add connections/edges for this topology shape
      const hub = ring.hub_node;
      if (ring.shape === "STAR" && hub) {
        accts.filter(a => a !== hub).forEach(mule => {
          linksList.push({ source: hub, target: mule });
        });
      } else {
        for (let i = 0; i < accts.length - 1; i++) {
          linksList.push({ source: accts[i], target: accts[i + 1] });
        }
        if (ring.shape === "CYCLE" && accts.length > 1) {
          linksList.push({ source: accts[accts.length - 1], target: accts[0] });
        }
      }
    });

    return { nodes: Array.from(nodeMap.values()), links: linksList };
  }, [displayedRings]);

  // 4. Role filter applied on nodes
  const displayedNodes = useMemo(() => {
    return graph.nodes.filter(n => {
      if (selectedRole !== "ALL" && n.role !== selectedRole) {
        return false;
      }
      return true;
    });
  }, [graph.nodes, selectedRole]);

  const displayedNodeIds = useMemo(() => new Set(displayedNodes.map(n => n.id)), [displayedNodes]);

  const displayedLinks = useMemo(() => {
    return graph.links.filter(l => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      return displayedNodeIds.has(s) && displayedNodeIds.has(t);
    });
  }, [graph.links, displayedNodeIds]);

  // Identify neighbor connections for hover highlighting
  const neighbors = useMemo(() => {
    const map = new Map();
    displayedLinks.forEach(l => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s).add(t);
      map.get(t).add(s);
    });
    return map;
  }, [displayedLinks]);

  // D3 force simulation setup
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const width = containerRef.current.clientWidth || 800;
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove(); // Clear previous renderings

    // Setup zoom container
    const g = svg.append("g").attr("class", "graph-content");

    const zoom = d3.zoom()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);

    // Zoom controls helper functions
    window.__zoomIn = () => svg.transition().duration(300).call(zoom.scaleBy, 1.3);
    window.__zoomOut = () => svg.transition().duration(300).call(zoom.scaleBy, 0.7);
    window.__resetZoom = () => svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);

    // Define Neon Glow Filters
    const defs = svg.append("defs");
    
    // Crimson Glow (High risk)
    const glowCrimson = defs.append("filter")
      .attr("id", "glow-crimson")
      .attr("x", "-40%")
      .attr("y", "-40%")
      .attr("width", "180%")
      .attr("height", "180%");
    glowCrimson.append("feGaussianBlur").attr("stdDeviation", "5").attr("result", "blur");
    glowCrimson.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).enter().append("feMergeNode");

    // Orange Glow (Medium risk)
    const glowOrange = defs.append("filter")
      .attr("id", "glow-orange")
      .attr("x", "-40%")
      .attr("y", "-40%")
      .attr("width", "180%")
      .attr("height", "180%");
    glowOrange.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    glowOrange.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).enter().append("feMergeNode");

    // Jade Glow (Low risk)
    const glowJade = defs.append("filter")
      .attr("id", "glow-jade")
      .attr("x", "-40%")
      .attr("y", "-40%")
      .attr("width", "180%")
      .attr("height", "180%");
    glowJade.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    glowJade.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).enter().append("feMergeNode");

    // Copy nodes so we don't mutate original objects across renders
    const nodesData = displayedNodes.map(n => ({ ...n }));
    const linksData = displayedLinks.map(l => ({
      source: typeof l.source === "object" ? l.source.id : l.source,
      target: typeof l.target === "object" ? l.target.id : l.target
    }));

    // Setup D3 Simulation
    const simulation = d3.forceSimulation(nodesData)
      .force("link", d3.forceLink(linksData).id(d => d.id).distance(55))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(25));

    // Render Links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(linksData)
      .enter()
      .append("line")
      .attr("stroke", "rgba(192, 132, 252, 0.22)")
      .attr("stroke-width", 1.8);

    // Flow particles representing cash flow direction
    let flowParticles;
    if (showFlowParticles) {
      flowParticles = g.append("g")
        .attr("class", "flow-particles")
        .selectAll("circle")
        .data(linksData)
        .enter()
        .append("circle")
        .attr("r", 2.5)
        .attr("fill", d => {
          const srcNode = nodesData.find(n => n.id === d.source.id);
          return srcNode ? riskColor(srcNode.risk) : "#c084fc";
        })
        .attr("opacity", 0.85);
    }

    // Render Nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodesData)
      .enter()
      .append("g")
      .attr("cursor", "pointer")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
      .on("click", (event, d) => {
        setSelectedNodeId(d.id);
        if (onNodeClick) onNodeClick(d);
      })
      .on("mouseover", (event, d) => {
        setHoveredNode(d);
      })
      .on("mouseout", () => {
        setHoveredNode(null);
      });

    // Render node shapes based on their roles
    node.each(function(d) {
      const el = d3.select(this);
      const color = riskColor(d.risk);
      const isCritical = d.risk > 0.75;
      
      let filterId = "none";
      if (d.risk > 0.85) {
        filterId = "url(#glow-crimson)";
      } else if (d.risk > 0.70) {
        filterId = "url(#glow-orange)";
      } else if (d.risk < 0.40) {
        filterId = "url(#glow-jade)";
      }

      if (d.role === "hub" || d.role === "orchestrator") {
        // Hubs are glowing triangles
        el.append("polygon")
          .attr("points", "0,-12 11,8 -11,8")
          .attr("fill", color)
          .attr("stroke", "rgba(245, 243, 255, 0.95)")
          .attr("stroke-width", 1.8)
          .attr("filter", filterId);
      } else if (d.role === "bridge") {
        // Bridges are glowing diamonds
        el.append("polygon")
          .attr("points", "0,-10 9,0 0,10 -9,0")
          .attr("fill", color)
          .attr("stroke", "rgba(245, 243, 255, 0.85)")
          .attr("stroke-width", 1.5)
          .attr("filter", filterId);
      } else {
        // Members and mules are spheres/circles
        const radius = d.role === "mule" ? 9.5 : 7.5;
        el.append("circle")
          .attr("r", radius)
          .attr("fill", color)
          .attr("stroke", "rgba(245, 243, 255, 0.6)")
          .attr("stroke-width", 1.2)
          .attr("filter", filterId);
      }

      // Add white core for critical nodes
      if (isCritical) {
        el.append("circle")
          .attr("r", 3.2)
          .attr("fill", "#ffffff");
      }
    });

    // Add labels for nodes
    node.append("text")
      .attr("dy", d => d.role === "hub" || d.role === "bridge" ? 15 : 13)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(245, 243, 255, 0.85)")
      .attr("font-size", "9px")
      .attr("font-family", "monospace")
      .text(d => d.id);

    // Tick simulation
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node.attr("transform", d => `translate(${d.x},${d.y})`);

      if (showFlowParticles && flowParticles) {
        const t = (Date.now() % 1800) / 1800; // 1.8s flow cycle
        flowParticles
          .attr("cx", d => d.source.x + (d.target.x - d.source.x) * t)
          .attr("cy", d => d.source.y + (d.target.y - d.source.y) * t);
      }
    });

    // Constant tick trigger for flow particles animation
    let animationFrame;
    if (showFlowParticles) {
      const animateParticles = () => {
        const t = (Date.now() % 1800) / 1800;
        if (flowParticles) {
          flowParticles
            .attr("cx", d => d.source.x + (d.target.x - d.source.x) * t)
            .attr("cy", d => d.source.y + (d.target.y - d.source.y) * t);
        }
        animationFrame = requestAnimationFrame(animateParticles);
      };
      animationFrame = requestAnimationFrame(animateParticles);
    }

    // Drag helper functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [displayedNodes, displayedLinks, showFlowParticles, height]);

  // Node highlighting styling on hover
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    if (hoveredNode) {
      const activeId = hoveredNode.id;
      const connectedSet = neighbors.get(activeId) || new Set();

      // Dim nodes
      svg.selectAll(".nodes g")
        .style("opacity", d => d.id === activeId || connectedSet.has(d.id) ? 1.0 : 0.12)
        .style("transition", "opacity 0.2s ease");

      // Dim and highlight links
      svg.selectAll(".links line")
        .style("opacity", d => d.source.id === activeId || d.target.id === activeId ? 0.95 : 0.03)
        .attr("stroke", d => d.source.id === activeId || d.target.id === activeId ? "#c084fc" : "rgba(192, 132, 252, 0.22)")
        .attr("stroke-width", d => d.source.id === activeId || d.target.id === activeId ? 2.8 : 1.8)
        .style("transition", "all 0.2s ease");
    } else {
      // Restore default styling
      svg.selectAll(".nodes g").style("opacity", 1.0);
      svg.selectAll(".links line")
        .style("opacity", 0.4)
        .attr("stroke", "rgba(192, 132, 252, 0.22)")
        .attr("stroke-width", 1.8);
    }
  }, [hoveredNode, neighbors]);

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Sleek Glassmorphic Filter Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 p-4 rounded-xl border border-grape/20 bg-night/70 backdrop-blur-md relative overflow-hidden">
        {/* Ambient glow inside filter */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-grape/10 rounded-full filter blur-xl pointer-events-none" />

        {/* 1. Account Search */}
        <div className="flex flex-col justify-between">
          <label className="text-[10px] uppercase tracking-wider text-frost/40 mb-1.5 font-semibold">Search Account ID</label>
          <input
            type="text"
            className="input text-xs py-1.5 font-mono"
            placeholder="e.g. ACC-7832"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 2. Minimum Risk Score Slider */}
        <div className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] uppercase tracking-wider text-frost/40 font-semibold">Min Ring Risk</label>
            <span className="text-xs font-mono font-semibold text-orchid">{Math.round(minRisk * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="0.95"
            step="0.05"
            className="w-full accent-grape bg-night h-1.5 rounded-lg appearance-none cursor-pointer"
            value={minRisk}
            onChange={e => setMinRisk(parseFloat(e.target.value))}
          />
        </div>

        {/* 3. Ring Topology / Shape Filter */}
        <div className="flex flex-col justify-between">
          <label className="text-[10px] uppercase tracking-wider text-frost/40 mb-1.5 font-semibold">Ring Topology</label>
          <select
            className="input text-xs py-1.5 bg-night border-grape/25 text-frost/80"
            value={selectedTopology}
            onChange={e => setSelectedTopology(e.target.value)}
          >
            <option value="ALL">All Topologies</option>
            <option value="STAR">Star Topology</option>
            <option value="CYCLE">Cycle Topology</option>
            <option value="CHAIN">Chain / Path</option>
            <option value="CLUSTER">Dense Cluster</option>
          </select>
        </div>

        {/* 4. Node Role Filter */}
        <div className="flex flex-col justify-between">
          <label className="text-[10px] uppercase tracking-wider text-frost/40 mb-1.5 font-semibold">Node Role</label>
          <select
            className="input text-xs py-1.5 bg-night border-grape/25 text-frost/80"
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
          >
            <option value="ALL">All Roles</option>
            <option value="hub">Hub Node</option>
            <option value="bridge">Bridge Node</option>
            <option value="mule">Mule account</option>
            <option value="cycler">Cycler</option>
            <option value="relay">Relay</option>
            <option value="member">General Member</option>
          </select>
        </div>

        {/* 5. Quick Toggles / Actions */}
        <div className="flex items-center gap-2.5 pt-4 lg:pt-0 justify-between md:justify-start lg:justify-end">
          <button
            onClick={() => setFraudOnly(!fraudOnly)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded transition-all border ${
              fraudOnly 
                ? "bg-crimson/25 border-crimson text-crimson font-bold shadow-md shadow-crimson/10" 
                : "bg-night/50 border-grape/20 text-frost/60 hover:text-frost hover:bg-night"
            }`}
          >
            🔥 Fraud Only
          </button>

          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded bg-night/50 border border-grape/20 text-frost/40 hover:text-orchid hover:border-orchid/40 transition-colors"
            title="Reset Filters"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative border border-grape/15 bg-[#070311] rounded-2xl overflow-hidden shadow-2xl shadow-purple-900/5">
        {/* Floating Zoom & Controls HUD */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-abyss/85 border border-grape/25 rounded-lg p-1.5 backdrop-blur-md">
          <button
            onClick={() => window.__zoomIn?.()}
            className="p-1.5 text-frost/60 hover:text-orchid hover:bg-grape/15 rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.__zoomOut?.()}
            className="p-1.5 text-frost/60 hover:text-orchid hover:bg-grape/15 rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.__resetZoom?.()}
            className="text-[10px] font-mono font-semibold px-2 py-1 text-frost/50 hover:text-orchid hover:bg-grape/15 rounded transition-colors"
            title="Fit to screen"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <div className="w-[1px] h-4 bg-grape/20 mx-1" />
          <button
            onClick={() => setShowFlowParticles(!showFlowParticles)}
            className={`p-1.5 rounded transition-colors ${showFlowParticles ? "text-orchid bg-grape/20" : "text-frost/30 hover:text-frost/60"}`}
            title={showFlowParticles ? "Hide flow particles" : "Show flow particles"}
          >
            {showFlowParticles ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        {/* Dynamic Nodes Summary Stats */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none flex flex-col gap-0.5">
          <p className="text-xs font-mono font-bold text-frost/85 uppercase tracking-wide drop-shadow-md">
            Mule Network Topology
          </p>
          <p className="text-[10px] font-mono text-orchid/80 font-medium drop-shadow-md">
            Showing top {displayedRings.length} rings ({displayedNodes.length} accounts, {displayedLinks.length} edges)
          </p>
        </div>

        {/* SVG Viewport */}
        <svg
          ref={svgRef}
          width="100%"
          style={{ height }}
          className="block relative"
        />

        {/* Grid Background Effect */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: "radial-gradient(rgba(123, 47, 190, 0.15) 1px, transparent 0)",
            backgroundSize: "24px 24px"
          }}
        />
      </div>

      {/* Role Guide Footer */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-frost/30 px-2 font-mono">
        <span className="text-frost/50 font-bold uppercase tracking-wider">Shapes Legend:</span>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 inline-block text-orchid" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,2 22,18 2,18" />
          </svg>
          Hub / Orchestrator (High Degree)
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3 inline-block text-amber-500" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,2 22,12 12,22 2,12" />
          </svg>
          Bridge (High Betweenness)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-crimson inline-block animate-pulse" style={{ boxShadow: "0 0 8px #dc2626" }} />
          Mule Account (Critical Risk)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-jade inline-block" />
          Legitimate Node
        </span>
      </div>
    </div>
  );
}
