// src/components/graph/NetworkGraph.jsx
//
// Two-level graph intelligence view:
//  - Level 1 (overview): Louvain communities rendered as glowing spheres,
//    sized by member count, colored by fraud rate. Inter-community edges
//    drawn as additive-blended arcs.
//  - Level 2 (drill-in): clicking a community force-simulates its member
//    accounts in 3D, nodes shaped/colored by risk + ring role, edges as
//    glowing lines with directional flow particles.
//
// Rendering: three.js, InstancedMesh for nodes (single draw call per shape),
// LineSegments for edges, sprite-based glow (no postprocessing dependency).
//
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { ArrowLeft, RotateCcw, ZoomIn, Info } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────
// Palette — derived from Nyxara's existing tailwind tokens
// ─────────────────────────────────────────────────────────────────────────
const COLOR = {
  bg: 0x0a0518,
  grape: 0x7b2fbe,
  orchid: 0xc084fc,
  cyan: 0x06b6d4,
  amber: 0xf59e0b,
  jade: 0x10b981,
  crimson: 0xdc2626,
  frost: 0xf5f3ff,
};

const RISK_COLOR = (r) => {
  if (r > 0.85) return COLOR.crimson;
  if (r > 0.7) return 0xf97316; // orange
  if (r > 0.4) return COLOR.amber;
  return COLOR.jade;
};

const ROLE_GEOMETRY_SCALE = {
  hub: 1.6,
  orchestrator: 1.6,
  coordinator: 1.4,
  bridge: 1.25,
  mule: 1.0,
  cycler: 1.0,
  relay: 0.9,
  member: 0.85,
  legitimate: 0.7,
};

// ─────────────────────────────────────────────────────────────────────────
// Demo data generators — used when no rings/clusters are supplied.
// Mirrors the shapes returned by /api/rings + /api/clusters so this drops
// in seamlessly once real data is wired up via props.
// ─────────────────────────────────────────────────────────────────────────
function genDemoClusters(n = 28) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const fraud = Math.pow(Math.random(), 2.2); // skew toward low fraud, long tail
    out.push({
      community_id: String(i),
      size: Math.floor(40 + Math.random() * Math.random() * 1400),
      fraud_rate: fraud,
      risk_level: fraud > 0.5 ? "HIGH" : fraud > 0.2 ? "MEDIUM" : "LOW",
    });
  }
  return out;
}

function genDemoAccounts(community, n) {
  const roles = ["hub", "mule", "mule", "mule", "bridge", "relay", "member", "legitimate"];
  const nodes = [];
  const hubCount = Math.max(1, Math.round(n * 0.04));
  for (let i = 0; i < n; i++) {
    const isHub = i < hubCount;
    const baseFraud = community.fraud_rate;
    const risk = Math.min(1, Math.max(0, baseFraud + (Math.random() - 0.5) * 0.4 + (isHub ? 0.15 : 0)));
    nodes.push({
      id: `ACC-${community.community_id}-${i.toString().padStart(4, "0")}`,
      risk,
      role: isHub ? "hub" : roles[Math.floor(Math.random() * roles.length)],
      in_ring: risk > 0.65,
    });
  }
  // Random-ish edges biased toward hubs
  const links = [];
  const hubIdx = nodes.map((n_, i) => (n_.role === "hub" ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < n; i++) {
    const degree = 1 + Math.floor(Math.random() * 3);
    for (let d = 0; d < degree; d++) {
      let target;
      if (hubIdx.length && Math.random() < 0.4) {
        target = hubIdx[Math.floor(Math.random() * hubIdx.length)];
      } else {
        target = Math.floor(Math.random() * n);
      }
      if (target !== i) links.push({ source: i, target });
    }
  }
  return { nodes, links };
}

// ─────────────────────────────────────────────────────────────────────────
// Small reusable: circular gradient texture for glow sprites
// ─────────────────────────────────────────────────────────────────────────
function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────
// Simple custom force layout (no extra dependency).
// Works in 3D for the drill-in view, 2D-ish (z≈0) for the overview.
// ─────────────────────────────────────────────────────────────────────────
function useForceLayout({ nodes, links, dims = 3, iterations = 220, spread = 1 }) {
  return useMemo(() => {
    const n = nodes.length;
    if (n === 0) return { positions: new Float32Array(0) };

    const positions = new Float32Array(n * 3);
    // init on a sphere/circle so it relaxes outward nicely
    for (let i = 0; i < n; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = spread * (0.4 + 0.6 * Math.random());
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = dims === 3 ? r * Math.cos(phi) * 0.6 : 0;
    }

    const idx = links
      .map((l) => [typeof l.source === "number" ? l.source : 0, typeof l.target === "number" ? l.target : 0])
      .filter(([a, b]) => a !== b && a < n && b < n);

    const repulsion = 1.0 / Math.max(1, Math.sqrt(n) * 0.12);
    const linkDist = 1.4;
    const center = 0.01;

    for (let it = 0; it < iterations; it++) {
      const alpha = 1 - it / iterations;
      const disp = new Float32Array(n * 3);

      // crude repulsion via grid bucketing for perf on large n
      const cell = 1.2;
      const grid = new Map();
      for (let i = 0; i < n; i++) {
        const cx = Math.floor(positions[i * 3] / cell);
        const cy = Math.floor(positions[i * 3 + 1] / cell);
        const cz = Math.floor(positions[i * 3 + 2] / cell);
        const key = `${cx},${cy},${cz}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
      }
      for (let i = 0; i < n; i++) {
        const cx = Math.floor(positions[i * 3] / cell);
        const cy = Math.floor(positions[i * 3 + 1] / cell);
        const cz = Math.floor(positions[i * 3 + 2] / cell);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              const key = `${cx + dx},${cy + dy},${cz + dz}`;
              const bucket = grid.get(key);
              if (!bucket) continue;
              for (const j of bucket) {
                if (j <= i) continue;
                let ddx = positions[i * 3] - positions[j * 3];
                let ddy = positions[i * 3 + 1] - positions[j * 3 + 1];
                let ddz = positions[i * 3 + 2] - positions[j * 3 + 2];
                let d2 = ddx * ddx + ddy * ddy + ddz * ddz + 0.01;
                const f = (repulsion / d2) * alpha;
                disp[i * 3] += ddx * f;
                disp[i * 3 + 1] += ddy * f;
                disp[i * 3 + 2] += ddz * f;
                disp[j * 3] -= ddx * f;
                disp[j * 3 + 1] -= ddy * f;
                disp[j * 3 + 2] -= ddz * f;
              }
            }
          }
        }
      }

      // link attraction
      for (const [a, b] of idx) {
        let ddx = positions[b * 3] - positions[a * 3];
        let ddy = positions[b * 3 + 1] - positions[a * 3 + 1];
        let ddz = positions[b * 3 + 2] - positions[a * 3 + 2];
        const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) || 0.001;
        const f = (dist - linkDist) * 0.06 * alpha;
        const nx = ddx / dist,
          ny = ddy / dist,
          nz = ddz / dist;
        disp[a * 3] += nx * f;
        disp[a * 3 + 1] += ny * f;
        disp[a * 3 + 2] += nz * f;
        disp[b * 3] -= nx * f;
        disp[b * 3 + 1] -= ny * f;
        disp[b * 3 + 2] -= nz * f;
      }

      for (let i = 0; i < n; i++) {
        disp[i * 3] -= positions[i * 3] * center;
        disp[i * 3 + 1] -= positions[i * 3 + 1] * center;
        disp[i * 3 + 2] -= positions[i * 3 + 2] * (dims === 3 ? center : center * 4);
        positions[i * 3] += disp[i * 3];
        positions[i * 3 + 1] += disp[i * 3 + 1];
        positions[i * 3 + 2] += disp[i * 3 + 2];
      }
    }

    return { positions };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, links.length, dims, iterations, spread]);
}

// ─────────────────────────────────────────────────────────────────────────
// Overview: communities as glowing spheres + arcs between them
// ─────────────────────────────────────────────────────────────────────────
function CommunityOverview({ communities, onSelect, hovered, setHovered }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

  // synthesize inter-community links by risk affinity (since we don't have
  // real cross-community edges at this aggregation level)
  const links = useMemo(() => {
    const out = [];
    const sorted = [...communities].sort((a, b) => b.fraud_rate - a.fraud_rate);
    for (let i = 0; i < sorted.length; i++) {
      const a = communities.indexOf(sorted[i]);
      const connections = sorted[i].fraud_rate > 0.5 ? 2 : 1;
      for (let c = 0; c < connections; c++) {
        const j = Math.floor(Math.random() * communities.length);
        if (j !== a) out.push({ source: a, target: j });
      }
    }
    return out;
  }, [communities]);

  const { positions } = useForceLayout({ nodes: communities, links, dims: 3, iterations: 180, spread: 9 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(COLOR.bg, 0.018);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 26);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // ── starfield backdrop ──────────────────────────────────
    const starGeo = new THREE.BufferGeometry();
    const starCount = 600;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 200;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 200 - 50;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x4c2a7a, size: 0.6, transparent: true, opacity: 0.5 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── edges (additive arcs) ───────────────────────────────
    const edgePositions = [];
    links.forEach(({ source, target }) => {
      const ax = positions[source * 3],
        ay = positions[source * 3 + 1],
        az = positions[source * 3 + 2];
      const bx = positions[target * 3],
        by = positions[target * 3 + 1],
        bz = positions[target * 3 + 2];
      // curved via simple midpoint lift
      const mx = (ax + bx) / 2,
        my = (ay + by) / 2,
        mz = (az + bz) / 2 + 1.5;
      const segs = 12;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs,
          t1 = (s + 1) / segs;
        const p0 = quadBezier(ax, ay, az, mx, my, mz, bx, by, bz, t0);
        const p1 = quadBezier(ax, ay, az, mx, my, mz, bx, by, bz, t1);
        edgePositions.push(...p0, ...p1);
      }
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edgePositions), 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: COLOR.grape,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    scene.add(edgeLines);

    // ── community spheres ───────────────────────────────────
    const group = new THREE.Group();
    scene.add(group);

    const glowTex = makeGlowTexture();
    const meshes = [];

    communities.forEach((c, i) => {
      const radius = 0.35 + Math.sqrt(c.size) * 0.045;
      const color = RISK_COLOR(c.fraud_rate);

      const geo = new THREE.SphereGeometry(radius, 24, 24);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.55,
        roughness: 0.35,
        metalness: 0.1,
        transparent: true,
        opacity: 0.92,
      });
      const sphere = new THREE.Mesh(geo, mat);
      sphere.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      sphere.userData = { community: c, baseScale: 1 };
      group.add(sphere);
      meshes.push(sphere);

      // glow sprite
      const spriteMat = new THREE.SpriteMaterial({
        map: glowTex,
        color,
        transparent: true,
        opacity: c.fraud_rate > 0.5 ? 0.55 : 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      const glowScale = radius * 6;
      sprite.scale.set(glowScale, glowScale, 1);
      sprite.position.copy(sphere.position);
      group.add(sprite);
    });

    // ── lighting ─────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x9b7bd6, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 15, 20);
    scene.add(dirLight);

    // ── raycasting for hover/click ──────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredMesh = null;

    function onPointerMove(e) {
      const rect = mount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshes);
      if (hits.length) {
        const m = hits[0].object;
        if (hoveredMesh !== m) {
          if (hoveredMesh) hoveredMesh.scale.set(1, 1, 1);
          hoveredMesh = m;
          setHovered(m.userData.community);
        }
        renderer.domElement.style.cursor = "pointer";
      } else {
        if (hoveredMesh) hoveredMesh.scale.set(1, 1, 1);
        hoveredMesh = null;
        setHovered(null);
        renderer.domElement.style.cursor = "grab";
      }
    }

    function onClick() {
      if (hoveredMesh) onSelect(hoveredMesh.userData.community);
    }

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onClick);

    // ── orbit-ish drag controls (lightweight, no extra deps) ─
    let isDragging = false;
    let prevX = 0,
      prevY = 0;
    let rotY = 0,
      rotX = 0;
    let targetDistance = 26;
    let distance = 26;

    function onDown(e) {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    }
    function onUp() {
      isDragging = false;
    }
    function onMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      rotY += dx * 0.005;
      rotX += dy * 0.005;
      rotX = Math.max(-1, Math.min(1, rotX));
      prevX = e.clientX;
      prevY = e.clientY;
    }
    function onWheel(e) {
      e.preventDefault();
      targetDistance += e.deltaY * 0.01;
      targetDistance = Math.max(8, Math.min(60, targetDistance));
    }

    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // ── render loop ──────────────────────────────────────────
    let raf;
    let t = 0;
    function animate() {
      t += 0.01;
      distance += (targetDistance - distance) * 0.08;
      camera.position.x = distance * Math.sin(rotY) * Math.cos(rotX);
      camera.position.z = distance * Math.cos(rotY) * Math.cos(rotX);
      camera.position.y = distance * Math.sin(rotX);
      camera.lookAt(0, 0, 0);

      // pulse high-risk communities
      meshes.forEach((m) => {
        const c = m.userData.community;
        if (c.fraud_rate > 0.5) {
          const pulse = 1 + Math.sin(t * 2 + m.position.x) * 0.06;
          m.scale.setScalar(pulse);
        }
      });

      group.rotation.y += 0.0008;
      stars.rotation.y += 0.0001;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    function onResize() {
      const w = mount.clientWidth,
        h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    stateRef.current = { renderer, mount };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      geoDisposeAll(scene);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communities, links, positions]);

  return <div ref={mountRef} className="w-full h-full" style={{ cursor: "grab" }} />;
}

// quadratic bezier helper
function quadBezier(ax, ay, az, mx, my, mz, bx, by, bz, t) {
  const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx;
  const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by;
  const z = (1 - t) * (1 - t) * az + 2 * (1 - t) * t * mz + t * t * bz;
  return [x, y, z];
}

function geoDisposeAll(scene) {
  scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Drill-in: account-level force graph for one community
// ─────────────────────────────────────────────────────────────────────────
function AccountGraph({ community, accounts, onNodeClick }) {
  const mountRef = useRef(null);

  const { nodes, links } = accounts;
  const { positions } = useForceLayout({ nodes, links, dims: 3, iterations: 200, spread: 7 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(COLOR.bg, 0.03);

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const n = nodes.length;

    // ── edges ────────────────────────────────────────────────
    const edgePos = new Float32Array(links.length * 6);
    const edgeColors = new Float32Array(links.length * 6);
    links.forEach((l, i) => {
      const a = l.source,
        b = l.target;
      edgePos[i * 6] = positions[a * 3];
      edgePos[i * 6 + 1] = positions[a * 3 + 1];
      edgePos[i * 6 + 2] = positions[a * 3 + 2];
      edgePos[i * 6 + 3] = positions[b * 3];
      edgePos[i * 6 + 4] = positions[b * 3 + 1];
      edgePos[i * 6 + 5] = positions[b * 3 + 2];

      const col = new THREE.Color(COLOR.grape);
      edgeColors[i * 6] = col.r;
      edgeColors[i * 6 + 1] = col.g;
      edgeColors[i * 6 + 2] = col.b;
      edgeColors[i * 6 + 3] = col.r;
      edgeColors[i * 6 + 4] = col.g;
      edgeColors[i * 6 + 5] = col.b;
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePos, 3));
    edgeGeo.setAttribute("color", new THREE.BufferAttribute(edgeColors, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    scene.add(edgeLines);

    // ── nodes via InstancedMesh (one draw call) ─────────────
    const geo = new THREE.IcosahedronGeometry(0.16, 1);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.3,
      metalness: 0.15,
      emissiveIntensity: 0.7,
    });
    const inst = new THREE.InstancedMesh(geo, mat, n);
    const dummy = new THREE.Object3D();
    const colorArr = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      const scale = (ROLE_GEOMETRY_SCALE[node.role] || 0.85) * (0.7 + node.risk * 0.6);
      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      const c = new THREE.Color(RISK_COLOR(node.risk));
      colorArr[i * 3] = c.r;
      colorArr[i * 3 + 1] = c.g;
      colorArr[i * 3 + 2] = c.b;
      inst.setColorAt(i, c);
    }
    inst.instanceColor = new THREE.InstancedBufferAttribute(colorArr, 3);
    scene.add(inst);

    // emissive needs per-instance — three's MeshStandardMaterial uses
    // instanceColor for `color`; fake emissive via a second additive layer
    const glowTex = makeGlowTexture();
    const glowGroup = new THREE.Group();
    const ringHubs = [];
    nodes.forEach((node, i) => {
      if (node.risk > 0.6 || node.role === "hub") {
        const c = new THREE.Color(RISK_COLOR(node.risk));
        const spriteMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: c,
          transparent: true,
          opacity: node.role === "hub" ? 0.6 : 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        const s = node.role === "hub" ? 1.4 : 0.9;
        sprite.scale.set(s, s, 1);
        sprite.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        glowGroup.add(sprite);
        if (node.role === "hub") ringHubs.push(sprite);
      }
    });
    scene.add(glowGroup);

    // ── lighting ─────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(8, 12, 16);
    scene.add(dirLight);

    // ── interaction: drag rotate + wheel zoom + click pick ──
    let isDragging = false,
      prevX = 0,
      prevY = 0;
    let rotY = 0,
      rotX = 0.15;
    let targetDistance = 18,
      distance = 18;

    function onDown(e) {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    }
    function onUp() {
      isDragging = false;
    }
    function onMove(e) {
      if (!isDragging) return;
      rotY += (e.clientX - prevX) * 0.005;
      rotX += (e.clientY - prevY) * 0.005;
      rotX = Math.max(-1.2, Math.min(1.2, rotX));
      prevX = e.clientX;
      prevY = e.clientY;
    }
    function onWheel(e) {
      e.preventDefault();
      targetDistance += e.deltaY * 0.008;
      targetDistance = Math.max(4, Math.min(40, targetDistance));
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function onClick(e) {
      const rect = mount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(inst);
      if (hits.length) {
        const id = hits[0].instanceId;
        onNodeClick?.(nodes[id]);
      }
    }

    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("click", onClick);

    let raf;
    let t = 0;
    function animate() {
      t += 0.01;
      distance += (targetDistance - distance) * 0.1;
      camera.position.x = distance * Math.sin(rotY) * Math.cos(rotX);
      camera.position.z = distance * Math.cos(rotY) * Math.cos(rotX);
      camera.position.y = distance * Math.sin(rotX);
      camera.lookAt(0, 0, 0);

      ringHubs.forEach((s, i) => {
        const pulse = 1.4 + Math.sin(t * 2.4 + i) * 0.25;
        s.scale.set(pulse, pulse, 1);
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    function onResize() {
      const w = mount.clientWidth,
        h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      geoDisposeAll(scene);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [community, nodes, links, positions]);

  return <div ref={mountRef} className="w-full h-full" style={{ cursor: "grab" }} />;
}

// ─────────────────────────────────────────────────────────────────────────
// Top-level component
// ─────────────────────────────────────────────────────────────────────────
export default function NetworkGraph({
  communities: communitiesProp,
  getCommunityAccounts, // optional: (community) => { nodes, links }
  height = 560,
}) {
  const communities = useMemo(() => communitiesProp?.length ? communitiesProp : genDemoClusters(), [communitiesProp]);

  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [pickedNode, setPickedNode] = useState(null);

  const accountData = useMemo(() => {
    if (!selected) return null;
    if (getCommunityAccounts) return getCommunityAccounts(selected);
    return genDemoAccounts(selected, Math.min(selected.size, 220));
  }, [selected, getCommunityAccounts]);

  const handleBack = useCallback(() => {
    setSelected(null);
    setPickedNode(null);
  }, []);

  const totalAccounts = useMemo(() => communities.reduce((s, c) => s + c.size, 0), [communities]);
  const totalEdges = useMemo(
    () => Math.round(communities.reduce((s, c) => s + c.size * (1.2 + c.fraud_rate * 4), 0)),
    [communities]
  );

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-grape/20" style={{ height, background: "#0a0518" }}>
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-night/90 to-transparent pointer-events-none">
        <div className="pointer-events-auto">
          {selected ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-frost/70 hover:text-orchid text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to communities
            </button>
          ) : (
            <div>
              <p className="text-frost text-sm font-semibold">Graph Intelligence</p>
              <p className="text-frost/40 text-xs font-mono">
                {communities.length} communities · {totalAccounts.toLocaleString()} accounts · ~{totalEdges.toLocaleString()} links
              </p>
            </div>
          )}
        </div>

        {selected && (
          <div className="pointer-events-auto text-right">
            <p className="text-frost text-sm font-semibold font-mono">Community {selected.community_id}</p>
            <p className="text-frost/40 text-xs">
              {selected.size.toLocaleString()} accounts ·{" "}
              <span style={{ color: `#${RISK_COLOR(selected.fraud_rate).toString(16).padStart(6, "0")}` }}>
                {(selected.fraud_rate * 100).toFixed(0)}% fraud rate
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Hover tooltip (overview) */}
      {!selected && hovered && (
        <div className="absolute top-16 left-4 z-10 bg-abyss/90 border border-grape/30 rounded-lg px-3 py-2 text-xs backdrop-blur-sm pointer-events-none">
          <p className="text-frost font-mono font-semibold">Community {hovered.community_id}</p>
          <p className="text-frost/50 mt-0.5">{hovered.size.toLocaleString()} accounts</p>
          <p className="mt-0.5" style={{ color: `#${RISK_COLOR(hovered.fraud_rate).toString(16).padStart(6, "0")}` }}>
            {(hovered.fraud_rate * 100).toFixed(1)}% fraud rate · {hovered.risk_level}
          </p>
          <p className="text-frost/30 text-[10px] mt-1 flex items-center gap-1">
            <ZoomIn className="w-3 h-3" /> Click to inspect accounts
          </p>
        </div>
      )}

      {/* Picked node detail (drill-in) */}
      {selected && pickedNode && (
        <div className="absolute bottom-4 left-4 z-10 bg-abyss/90 border border-grape/30 rounded-lg px-3 py-2 text-xs backdrop-blur-sm max-w-xs">
          <div className="flex items-center justify-between mb-1">
            <p className="text-frost font-mono font-semibold truncate">{pickedNode.id}</p>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{
                color: `#${RISK_COLOR(pickedNode.risk).toString(16).padStart(6, "0")}`,
                border: `1px solid #${RISK_COLOR(pickedNode.risk).toString(16).padStart(6, "0")}40`,
              }}
            >
              {pickedNode.role}
            </span>
          </div>
          <p className="text-frost/50">Risk score: {(pickedNode.risk * 100).toFixed(0)}</p>
          {pickedNode.in_ring && <p className="text-crimson mt-0.5">⚠ Ring member</p>}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-3 text-[10px] text-frost/40 bg-abyss/70 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-grape/10">
        <LegendDot color={COLOR.crimson} label="Block / Critical" />
        <LegendDot color={0xf97316} label="Flag" />
        <LegendDot color={COLOR.amber} label="Review" />
        <LegendDot color={COLOR.jade} label="Approve" />
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3" /> {selected ? "drag to rotate · scroll to zoom · click a node" : "drag to rotate · scroll to zoom · click a community"}
        </span>
      </div>

      {/* Graph canvas */}
      {!selected ? (
        <CommunityOverview communities={communities} onSelect={setSelected} hovered={hovered} setHovered={setHovered} />
      ) : (
        <AccountGraph community={selected} accounts={accountData} onNodeClick={setPickedNode} />
      )}
    </div>
  );
}

function LegendDot({ color, label }) {
  const hex = `#${color.toString(16).padStart(6, "0")}`;
  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full" style={{ background: hex, boxShadow: `0 0 6px ${hex}` }} />
      {label}
    </span>
  );
}