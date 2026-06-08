// src/pages/GraphView.jsx
import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function GraphView() {
  const svgRef = useRef();

  useEffect(() => {
    // Demo graph — replace with real data from GET /v1/rings
    const nodes = [
      { id: "HUB-001", risk: 0.95, role: "hub" },
      { id: "MUL-002", risk: 0.82, role: "mule" },
      { id: "MUL-003", risk: 0.78, role: "mule" },
      { id: "MUL-004", risk: 0.71, role: "mule" },
      { id: "BRG-005", risk: 0.65, role: "bridge" },
      { id: "LEG-006", risk: 0.12, role: "legitimate" },
    ];
    const links = [
      { source: "HUB-001", target: "MUL-002" },
      { source: "HUB-001", target: "MUL-003" },
      { source: "HUB-001", target: "MUL-004" },
      { source: "MUL-004", target: "BRG-005" },
      { source: "BRG-005", target: "LEG-006" },
    ];

    const W = 700, H = 420;
    const svg = d3.select(svgRef.current).attr("viewBox", `0 0 ${W} ${H}`);
    svg.selectAll("*").remove();

    const color = r => r > 0.85 ? "#DC2626" : r > 0.7 ? "#F97316" : r > 0.4 ? "#F59E0B" : "#10B981";

    const sim = d3.forceSimulation(nodes)
      .force("link",   d3.forceLink(links).id(d => d.id).distance(90))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(W / 2, H / 2));

    const link = svg.append("g").selectAll("line").data(links).enter().append("line")
      .attr("stroke", "#7B2FBE60").attr("stroke-width", 1.5);

    const node = svg.append("g").selectAll("g").data(nodes).enter().append("g")
      .call(d3.drag().on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                     .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
                     .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append("circle")
      .attr("r",    d => d.role === "hub" ? 18 : 12)
      .attr("fill", d => color(d.risk) + "30")
      .attr("stroke", d => color(d.risk))
      .attr("stroke-width", d => d.role === "hub" ? 3 : 1.5);

    node.append("text")
      .text(d => d.id)
      .attr("text-anchor", "middle")
      .attr("dy", "2.5em")
      .attr("fill", "#F5F3FF90")
      .attr("font-size", 9)
      .attr("font-family", "monospace");

    sim.on("tick", () => {
      link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-frost">Graph View</h1>
      <p className="text-frost/50 text-sm">Live mule account network topology — D3.js force-directed</p>
      <div className="card">
        <svg ref={svgRef} className="w-full" style={{ minHeight: 420, background: "rgba(18,8,46,0.6)", borderRadius: 8 }} />
        <p className="text-frost/30 text-xs mt-2 text-center">Demo graph — connect AI engine to load real ring data</p>
      </div>
    </div>
  );
}
