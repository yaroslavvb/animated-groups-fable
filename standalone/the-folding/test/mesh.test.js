// Tests for src/mesh.js (SPEC 5.2): tile meshes, pieces, the hinge tree, locate, the boundary.
// All 17 groups x every preset x 30 seeded-random seeds x amp in {0, 1}. Every mesh is built once; each check
// records its failures under a name, and the tests below assert that each list is empty.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID, contains } from '../src/groups.js';
import { apply, inverse, compose, det, polyArea } from '../src/geom.js';
import { makeWarp, buildDomain } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';

// CORE_SEEDS / CORE_AMPS / CORE_SALT widen the sweep for stress runs, e.g. CORE_SEEDS=150 CORE_AMPS=0,0.5,1 node --test test/mesh.test.js
const SEEDS = Math.max(30, +process.env.CORE_SEEDS || 30);
const AMPS = process.env.CORE_AMPS ? process.env.CORE_AMPS.split(',').map(Number) : [0, 1];
const SALT = +process.env.CORE_SALT || 0;

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function* cases(group) {
  for (const [i, p] of group.presets.entries()) yield { label: `${group.id} preset ${i} (${p.name})`, seed: p.seed, metric: p.metric };
  const rnd = prng(4242 + GROUPS.indexOf(group) + 7919 * SALT);
  for (let k = 0; k < SEEDS; k++) {
    const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
    yield { label: `${group.id} random seed ${k} (${seed[0].toFixed(4)}, ${seed[1].toFixed(4)})`, seed, metric: group.presets[k % group.presets.length].metric };
  }
}

/** Seeds a hair away from the presets (many of which are degenerate): nearly-zero edges, nearly-tangent creases. */
function* nearPresets(group, offsets = [1e-3, 1e-6, 1e-9]) {
  for (const [i, p] of group.presets.entries()) {
    for (const off of offsets) {
      for (const [dx, dy] of [[1, 0], [0.6, 0.8], [-0.28, 0.96]]) {
        yield { label: `${group.id} preset ${i} + ${off}*(${dx}, ${dy})`, seed: [p.seed[0] + off * dx, p.seed[1] + off * dy], metric: p.metric };
      }
    }
  }
}
const SMALL_AMPS = [1e-9, 1e-6, 1e-3, 0.05];

const failures = {};
const stats = { meshes: 0, maxAreaErr: [0, 0], minHeight: Infinity, maxPieces: 0, multiPieceCells: 0, lobes: 0, maxTri: 0, maxRimGap: [0, 0], maxRimOff: [0, 0], tris: {} };
const fail = (name, msg) => { (failures[name] ||= []).push(msg); };
const NAMES = ['structure', 'area', 'inverted', 'watertight', 'simpleRim', 'pieces', 'tree', 'root', 'locate', 'boundary', 'parity', 'sheets', 'seams'];
for (const k of NAMES) failures[k] = [];

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function checkMesh(group, domain, mesh, label, ampValue) {
  const amp = ampValue === 0 ? 0 : 1;   // index for the tolerances and statistics
  const { n, xy, tri, m, triCell, cells } = mesh;
  const size = Math.sqrt(group.domainArea), P = cells.length;
  const T = group.kaleido ? group.kaleido.cell : null;
  stats.meshes++;
  stats.maxPieces = Math.max(stats.maxPieces, P);
  stats.maxTri = Math.max(stats.maxTri, m);

  // ---- structure
  if (!(xy instanceof Float32Array) || xy.length !== 2 * n) fail('structure', `${label}: xy`);
  if (!(tri instanceof Uint32Array) || tri.length !== 3 * m) fail('structure', `${label}: tri`);
  if (!(mesh.cell instanceof Uint16Array) || mesh.cell.length !== n) fail('structure', `${label}: cell`);
  if (!(triCell instanceof Uint16Array) || triCell.length !== m) fail('structure', `${label}: triCell`);
  if (mesh.root !== 0 || cells[0].parent !== -1 || cells[0].depth !== 0 || cells[0].hinge !== null) fail('structure', `${label}: root record`);
  const used = new Uint8Array(n), vertexPieces = Array.from({ length: n }, () => []);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let t = 0; t < m; t++) {
    if (triCell[t] >= P) fail('structure', `${label}: triCell out of range`);
    for (let e = 0; e < 3; e++) {
      const v = tri[3 * t + e];
      if (v >= n) { fail('structure', `${label}: vertex index out of range`); return; }
      used[v] = 1; vertexPieces[v].push(triCell[t]);
    }
  }
  for (let v = 0; v < n; v++) {
    if (!used[v]) fail('structure', `${label}: unused vertex ${v}`);
    else if (!vertexPieces[v].includes(mesh.cell[v])) fail('structure', `${label}: cell[${v}] is not a piece around the vertex`);
    else if (mesh.cell[v] !== Math.min(...vertexPieces[v])) fail('structure', `${label}: cell[${v}] is not the lowest piece around the vertex`);
    if (!Number.isFinite(xy[2 * v]) || !Number.isFinite(xy[2 * v + 1])) fail('structure', `${label}: non-finite vertex`);
    bx0 = Math.min(bx0, xy[2 * v]); bx1 = Math.max(bx1, xy[2 * v]); by0 = Math.min(by0, xy[2 * v + 1]); by1 = Math.max(by1, xy[2 * v + 1]);
  }
  if ([bx0, by0, bx1, by1].some((v, i) => Math.abs(v - mesh.bbox[i]) > 1e-6)) fail('structure', `${label}: bbox`);
  cells.forEach((c, i) => {
    if (c.index !== i) fail('structure', `${label}: cells[${i}].index`);
    if (c.parity !== (det(c.g) > 0 ? 0 : 1)) fail('structure', `${label}: parity of piece ${i}`);
    if (T) {
      const ok = c.poly && c.poly.length === T.length && c.poly.every((p, k) => { const q = apply(c.g, T[k][0], T[k][1]); return Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-12; });
      if (!ok) fail('structure', `${label}: cells[${i}].poly is not g(T)`);
      if (!contains(group.kaleido.group, c.g)) fail('structure', `${label}: cells[${i}].g is not a kaleidoscope element`);
    } else if (c.poly !== null || c.g.a !== 1 || c.g.b !== 0 || c.g.tx !== 0 || c.g.ty !== 0 || P !== 1) fail('structure', `${label}: pseudo-cell record`);
  });

  // ---- areas
  const area2 = new Float64Array(m), longest = new Float64Array(m), pieceArea = new Float64Array(P);
  let total = 0;
  for (let t = 0; t < m; t++) {
    const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
    area2[t] = (xy[2 * b] - xy[2 * a]) * (xy[2 * c + 1] - xy[2 * a + 1]) - (xy[2 * b + 1] - xy[2 * a + 1]) * (xy[2 * c] - xy[2 * a]);
    total += area2[t] / 2; pieceArea[triCell[t]] += area2[t] / 2;
    longest[t] = Math.max(Math.hypot(xy[2 * b] - xy[2 * a], xy[2 * b + 1] - xy[2 * a + 1]), Math.hypot(xy[2 * c] - xy[2 * b], xy[2 * c + 1] - xy[2 * b + 1]), Math.hypot(xy[2 * a] - xy[2 * c], xy[2 * a + 1] - xy[2 * c + 1]));
    // xy is Float32: a sliver thinner than its rounding (a few 1e-7) may come out with a tiny negative area; a triangle
    // that is really the wrong way round has a height of the order of the mesh size
    const height = area2[t] / (longest[t] || 1);
    if (height < stats.minHeight) stats.minHeight = height;
    if (height < -1e-6) fail('inverted', `${label}: triangle ${t} is inverted (height ${height})`);
  }
  const relErr = Math.abs(total - group.domainArea) / group.domainArea;
  stats.maxAreaErr[amp] = Math.max(stats.maxAreaErr[amp], relErr);
  if (relErr > (amp === 0 ? 1e-6 : 1e-3)) fail('area', `${label}: mesh area off by ${relErr.toExponential(2)} (relative)`);
  for (let p = 0; p < P; p++) {
    if (Math.abs(pieceArea[p] - cells[p].area) > 1e-6 * group.domainArea) fail('area', `${label}: area of piece ${p}`);
    if (!(cells[p].area >= 1e-13)) fail('area', `${label}: piece ${p} is dust (${cells[p].area})`);
  }

  // ---- watertight: every edge has one or two triangles with opposite directions, the rim is one closed loop, V - E + F = 1
  const edges = new Map();
  for (let t = 0; t < m; t++) {
    for (let e = 0; e < 3; e++) {
      const u = tri[3 * t + e], v = tri[3 * t + (e + 1) % 3];
      const key = Math.min(u, v) * n + Math.max(u, v);
      let rec = edges.get(key);
      if (!rec) { rec = { u, v, t: [], fwd: 0, bwd: 0 }; edges.set(key, rec); }
      rec.t.push(t);
      if (u < v) rec.fwd++; else rec.bwd++;
    }
  }
  const rim = [];
  let nonManifold = 0;
  for (const rec of edges.values()) {
    if (rec.t.length === 1) rim.push(rec);
    else if (rec.t.length !== 2 || rec.fwd !== 1 || rec.bwd !== 1) nonManifold++;
  }
  if (nonManifold) fail('watertight', `${label}: ${nonManifold} non-manifold or inconsistently oriented edges`);
  if (n - edges.size + m !== 1) fail('watertight', `${label}: Euler characteristic ${n - edges.size + m} (cracks or holes)`);
  const rimDeg = new Map();
  let rimLen = 0;
  for (const r of rim) {
    rimDeg.set(r.u, (rimDeg.get(r.u) || 0) + 1); rimDeg.set(r.v, (rimDeg.get(r.v) || 0) + 1);
    rimLen += Math.hypot(xy[2 * r.u] - xy[2 * r.v], xy[2 * r.u + 1] - xy[2 * r.v + 1]);
  }
  if ([...rimDeg.values()].some((d) => d !== 2)) fail('watertight', `${label}: the rim is not a simple closed curve`);
  {
    // ... and it is ONE loop (a second loop is a hole, or an island) ...
    const next = new Map();
    for (const r of rim) for (const [p, q] of [[r.u, r.v], [r.v, r.u]]) { if (!next.has(p)) next.set(p, []); next.get(p).push(q); }
    const seen = new Set();
    let loops = 0;
    for (const start of next.keys()) {
      if (seen.has(start)) continue;
      loops++;
      const stack = [start];
      while (stack.length) { const p = stack.pop(); if (seen.has(p)) continue; seen.add(p); for (const q of next.get(p)) stack.push(q); }
    }
    if (loops !== 1) fail('watertight', `${label}: the rim consists of ${loops} loops`);
    // ... without a T-junction: no rim vertex lies on a rim edge it is not an end of. (Two triangles that share an
    // edge of the fine mesh must end on it at the same vertex; where they do not, the mesh has a slit of zero width.)
    const tol = 4e-7 * Math.max(1, Math.abs(xy[0]), Math.abs(xy[1]));      // Float32 coordinates
    let tj = 0, first = '';
    for (const r of rim) {
      const ax = xy[2 * r.u], ay = xy[2 * r.u + 1], dx = xy[2 * r.v] - ax, dy = xy[2 * r.v + 1] - ay, len = Math.hypot(dx, dy);
      if (!(len > 40 * tol)) continue;
      for (const z of rimDeg.keys()) {
        if (z === r.u || z === r.v) continue;
        const px = xy[2 * z] - ax, py = xy[2 * z + 1] - ay, along = (px * dx + py * dy) / len;
        if (along <= 20 * tol || along >= len - 20 * tol || Math.abs(px * dy - py * dx) / len > tol) continue;
        if (!tj++) first = `rim vertex ${z} (${xy[2 * z]}, ${xy[2 * z + 1]}) lies on the rim edge ${r.u}-${r.v}`;
      }
    }
    if (tj) fail('simpleRim', `${label}: ${tj} T-junction(s) on the rim; ${first}`);
    // ... and no rim vertex is outside the tile by more than the sagitta of a rim chord (a cut point sits on the true
    // boundary; only the corner of two chords at a corner of the tile is off it)
    const y = [0, 0];
    let worst = 0, worstV = -1;
    for (const v of rimDeg.keys()) {
      domain.warp.inv(xy[2 * v], xy[2 * v + 1], y);
      let s = -Infinity;
      for (const e of domain.edges) s = Math.max(s, e.nx * y[0] + e.ny * y[1] - e.c);
      if (Math.abs(s) > worst) { worst = Math.abs(s); worstV = v; }
    }
    stats.maxRimOff[amp] = Math.max(stats.maxRimOff[amp], worst / size);
    if (worst > (amp === 0 ? 3e-6 : 1e-2 * size)) fail('simpleRim', `${label}: rim vertex ${worstV} is ${worst} from the boundary of the tile`);
  }
  let outlineLen = 0;
  for (const b of mesh.boundary) for (let i = 2; i < b.pts.length; i += 2) outlineLen += Math.hypot(b.pts[i] - b.pts[i - 2], b.pts[i + 1] - b.pts[i - 1]);
  // the rim is inscribed in the boundary: as long as the outline to 0.1 %. (Until 2026-11-09 the bound was 2 %, and a
  // spike of triangles along a nearly straight corner of the tile, 2.1 % of rim, was the only thing it ever caught.)
  if (Math.abs(rimLen - outlineLen) > (amp === 0 ? 1e-5 : 3e-3) * outlineLen) fail('watertight', `${label}: rim length ${rimLen} vs outline ${outlineLen}`);

  // ---- pieces: connected, inside their cell, pieces of one cell do not touch along an edge
  const uf = Int32Array.from({ length: m }, (_, i) => i);
  const find = (t) => { while (uf[t] !== t) { uf[t] = uf[uf[t]]; t = uf[t]; } return t; };
  const adjacency = new Map();   // "a,b" (a < b) -> list of edges shared by pieces a and b
  for (const rec of edges.values()) {
    if (rec.t.length !== 2) continue;
    const pa = triCell[rec.t[0]], pb = triCell[rec.t[1]];
    if (pa === pb) uf[find(rec.t[0])] = find(rec.t[1]);
    else {
      const key = Math.min(pa, pb) + ',' + Math.max(pa, pb);
      if (!adjacency.has(key)) adjacency.set(key, []);
      adjacency.get(key).push(rec);
      if (cells[pa].cellId === cells[pb].cellId) fail('pieces', `${label}: pieces ${pa} and ${pb} of one cell share an edge`);
    }
  }
  const compOf = new Map();
  for (let t = 0; t < m; t++) {
    const r = find(t), p = triCell[t];
    if (!compOf.has(p)) compOf.set(p, r); else if (compOf.get(p) !== r) { fail('pieces', `${label}: piece ${p} is not connected`); break; }
  }
  if (compOf.size !== P) fail('pieces', `${label}: ${P - compOf.size} pieces without triangles`);
  if (T) {
    for (let t = 0; t < m; t++) {
      const q = cells[triCell[t]].poly, k = q.length, s = cells[triCell[t]].parity ? -1 : 1;
      for (let e = 0; e < 3; e++) {
        const x = xy[2 * tri[3 * t + e]], y = xy[2 * tri[3 * t + e] + 1];
        for (let i = 0; i < k; i++) {
          const a = q[i], b = q[(i + 1) % k];
          const side = s * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (side < -1e-6) { fail('pieces', `${label}: triangle ${t} of piece ${triCell[t]} leaves its cell by ${-side}`); e = 3; t = m; break; }
        }
      }
    }
    const byCell = new Map();
    for (const c of cells) byCell.set(c.cellId, (byCell.get(c.cellId) || 0) + 1);
    for (const k of byCell.values()) if (k > 1) stats.multiPieceCells++;
  }

  // ---- tree: connected, acyclic, no orphans; hinge lines
  if (adjacency.size !== P - 1) fail('tree', `${label}: ${P} pieces but ${adjacency.size} hinged pairs (not a tree)`);
  if (mesh.creases.length !== P - 1) fail('tree', `${label}: ${mesh.creases.length} creases for ${P} pieces`);
  for (let i = 1; i < P; i++) {
    const c = cells[i], p = c.parent;
    if (!(Number.isInteger(p) && p >= 0 && p < i)) { fail('tree', `${label}: piece ${i} has parent ${p}`); continue; }
    if (c.depth !== cells[p].depth + 1) fail('tree', `${label}: depth of piece ${i}`);
    const shared = adjacency.get(p + ',' + i);
    const h = c.hinge;
    if (!h) { fail('tree', `${label}: piece ${i} has no hinge`); continue; }
    if (!shared) { fail('tree', `${label}: piece ${i} is an orphan (shares no edge with its parent ${p})`); continue; }
    const dx = h.bx - h.ax, dy = h.by - h.ay, len = Math.hypot(dx, dy);
    if (!(len > 1e-9)) { fail('tree', `${label}: hinge of piece ${i} has no extent`); continue; }
    let lo = Infinity, hi = -Infinity, off = 0;
    for (const rec of shared) {
      for (const v of [rec.u, rec.v]) {
        const t = ((xy[2 * v] - h.ax) * dx + (xy[2 * v + 1] - h.ay) * dy) / (len * len);
        off = Math.max(off, Math.abs((xy[2 * v] - h.ax) * dy - (xy[2 * v + 1] - h.ay) * dx) / len);
        lo = Math.min(lo, t); hi = Math.max(hi, t);
      }
    }
    if (off > 1e-6) fail('tree', `${label}: shared edges of piece ${i} are ${off} off its hinge line`);
    // the hinge spans the shared edges exactly, except that a micro-lobe's hinge is padded to 1e-3 sizes
    const padded = len < 1.001e-3 * size;
    if (lo < -1e-5 / len || hi > 1 + 1e-5 / len || (!padded && (lo > 1e-5 / len || hi < 1 - 1e-5 / len))) fail('tree', `${label}: hinge extent of piece ${i}: [${lo}, ${hi}]`);
    // the piece lies to the left of a -> b, its parent to the right; reflecting its cell in the hinge gives the parent's cell
    const cen = (q) => q.reduce((s, v) => [s[0] + v[0] / q.length, s[1] + v[1] / q.length], [0, 0]);
    const ci = cen(c.poly), cp = cen(cells[p].poly);
    const sideI = dx * (ci[1] - h.ay) - dy * (ci[0] - h.ax), sideP = dx * (cp[1] - h.ay) - dy * (cp[0] - h.ax);
    if (!(sideI > 0 && sideP < 0)) fail('tree', `${label}: piece ${i} is not on the left of its hinge`);
    const rx = ci[0] - 2 * (-(ci[0] - h.ax) * dy + (ci[1] - h.ay) * dx) * (-dy) / (len * len);
    const ry = ci[1] - 2 * (-(ci[0] - h.ax) * dy + (ci[1] - h.ay) * dx) * dx / (len * len);
    if (Math.hypot(rx - cp[0], ry - cp[1]) > 1e-7) fail('tree', `${label}: the hinge of piece ${i} does not mirror its cell onto the parent's cell`);
    const cr = mesh.creases.find((k) => k.b === i);
    if (!cr || cr.a !== p || !(cr.pts instanceof Float32Array) || Math.hypot(cr.pts[0] - h.ax, cr.pts[1] - h.ay) > 1e-6 || Math.hypot(cr.pts[2] - h.bx, cr.pts[3] - h.by) > 1e-6) fail('tree', `${label}: crease record of piece ${i}`);
    if (c.area < 0.02 * group.domainArea) stats.lobes++;
  }

  // ---- root and locate
  const sw = domain.warp.fwd(domain.seed[0], domain.seed[1]);
  if (mesh.locate(sw[0] + 1e-6 * 0.3713, sw[1] + 1e-6 * 0.9285) !== 0) fail('root', `${label}: the root is not the piece of the seed`);
  for (let t = 0; t < m; t++) {
    if (area2[t] <= 2e-6 * longest[t]) continue;   // slivers thinner than Float32 resolves: the centroid may round across an edge
    const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
    const got = mesh.locate((xy[2 * a] + xy[2 * b] + xy[2 * c]) / 3, (xy[2 * a + 1] + xy[2 * b + 1] + xy[2 * c + 1]) / 3);
    if (got !== triCell[t]) { fail('locate', `${label}: centroid of triangle ${t} (piece ${triCell[t]}) located in piece ${got}`); break; }
  }

  // ---- boundary: the outline per edge, on the rim of the mesh, each sample with a piece that is really there
  const outline = domain.outline(size / 40);
  if (mesh.boundary.length !== domain.edges.length) fail('boundary', `${label}: boundary length`);
  // with a wavy cut the rim is a polygon inscribed in the true boundary: its sagitta reaches ~0.75 % of the tile size
  // where the fine triangles are largest (the middle of a kaleidoscope cell)
  const tolRim = amp === 0 ? 2e-6 : 1e-2 * size;
  mesh.boundary.forEach((b, i) => {
    const e = domain.edges[i];
    if (b.edge !== i || b.cls !== e.cls || b.kind !== e.kind) fail('boundary', `${label}: boundary[${i}] header`);
    if (!(b.pts instanceof Float32Array) || !(b.cells instanceof Uint16Array) || b.cells.length * 2 !== b.pts.length) { fail('boundary', `${label}: boundary[${i}] arrays`); return; }
    if (b.pts.length !== outline[i].pts.length || b.pts.some((v, k) => v !== outline[i].pts[k])) fail('boundary', `${label}: boundary[${i}].pts is not the outline`);
    for (let j = 0; j < b.cells.length; j++) {
      const px = b.pts[2 * j], py = b.pts[2 * j + 1], pc = b.cells[j];
      if (pc >= P) { fail('boundary', `${label}: boundary piece out of range`); return; }
      let dAny = Infinity, dOwn = Infinity;
      for (const r of rim) {
        const d = segDist(px, py, xy[2 * r.u], xy[2 * r.u + 1], xy[2 * r.v], xy[2 * r.v + 1]);
        if (d < dAny) dAny = d;
        if (triCell[r.t[0]] === pc && d < dOwn) dOwn = d;
      }
      if (dOwn > 2 * tolRim + 2e-6) {
        // the piece may touch the rim only at a vertex (a cell corner at a cone point): measure to all of its edges
        for (const r of edges.values()) {
          if (triCell[r.t[0]] !== pc && (r.t.length < 2 || triCell[r.t[1]] !== pc)) continue;
          const d = segDist(px, py, xy[2 * r.u], xy[2 * r.u + 1], xy[2 * r.v], xy[2 * r.v + 1]);
          if (d < dOwn) dOwn = d;
        }
      }
      stats.maxRimGap[amp] = Math.max(stats.maxRimGap[amp], dAny / size);
      if (dAny > tolRim) { fail('boundary', `${label}: boundary point ${j} of edge ${i} is ${dAny} from the rim of the mesh`); return; }
      if (dOwn > 2 * tolRim + 2e-6) { fail('boundary', `${label}: boundary point ${j} of edge ${i} is ${dOwn} from its piece ${pc}`); return; }
    }
  });

  // ---- hinge groups: front and back each cover the cell once; sheets alternate with depth; seams fold together
  if (group.fold === 'hinge' || group.fold === 'crosscap') {
    const areaT = polyArea(T);
    let even = 0, odd = 0;
    for (const c of cells) if (c.parity) odd += c.area; else even += c.area;
    const tol = (amp === 0 ? 1e-6 : 1e-3) * areaT;
    if (group.fold === 'hinge' && (Math.abs(even - areaT) > tol || Math.abs(odd - areaT) > tol)) fail('parity', `${label}: even ${even}, odd ${odd}, cell ${areaT}`);
    if (group.fold === 'crosscap' && Math.abs(even + odd - areaT) > tol) fail('parity', `${label}: total ${even + odd}, cell ${areaT}`);
    const rootInv = inverse(cells[0].g);
    for (const c of cells) {
      if (((c.parity ^ cells[0].parity) & 1) !== (c.depth & 1)) fail('sheets', `${label}: parity of piece ${c.index} does not alternate with depth`);
      if (group.fold === 'hinge' && contains(group, compose(c.g, rootInv)) !== (c.depth % 2 === 0)) fail('sheets', `${label}: sheet of piece ${c.index}`);
    }
    // glued boundary points have the same T-coordinates, on the same sheet unless they sit on a glued side of T
    const glued = group.kaleido.glued, u = [0, 0], u2 = [0, 0], x2 = [0, 0];
    const sideDist = (p) => {
      let d = Infinity;
      for (let k = 0; k < T.length; k++) if (glued[k]) d = Math.min(d, segDist(p[0], p[1], T[k][0], T[k][1], T[(k + 1) % T.length][0], T[(k + 1) % T.length][1]));
      return d;
    };
    mesh.boundary.forEach((b, i) => {
      const e = domain.edges[i];
      if (e.kind !== 'cut') return;
      // 22x: a glide is not in the kaleidoscope; it acts on the pillow as the antipodal map: T-coordinates are
      // reflected through the centre of T and the sheet changes
      const antipodal = group.fold === 'crosscap' && det(e.g) < 0;
      const tc = [T.reduce((q, v) => q + v[0], 0) / T.length, T.reduce((q, v) => q + v[1], 0) / T.length];
      const bj = mesh.boundary[e.partner], k = b.cells.length, gi = inverse(e.g);
      for (let j = 0; j < k; j++) {
        const jj = e.rev ? k - 1 - j : j;
        apply(gi, b.pts[2 * j], b.pts[2 * j + 1], x2);
        if (Math.hypot(x2[0] - bj.pts[2 * jj], x2[1] - bj.pts[2 * jj + 1]) > 1e-6) { fail('seams', `${label}: partner sample mismatch on edge ${i}`); return; }
        const c1 = cells[b.cells[j]], c2 = cells[bj.cells[jj]];
        apply(inverse(c1.g), b.pts[2 * j], b.pts[2 * j + 1], u);
        apply(inverse(c2.g), bj.pts[2 * jj], bj.pts[2 * jj + 1], u2);
        if (antipodal) {
          if (Math.hypot(2 * tc[0] - u[0] - u2[0], 2 * tc[1] - u[1] - u2[1]) > 1e-5) { fail('seams', `${label}: glide-glued points of edge ${i} (sample ${j}) are not antipodal on the pillow`); return; }
          if ((c1.depth & 1) === (c2.depth & 1) && sideDist(u) > 1e-5) { fail('seams', `${label}: glide-glued points of edge ${i} (sample ${j}) land on the same sheet`); return; }
          continue;
        }
        if (Math.hypot(u[0] - u2[0], u[1] - u2[1]) > 1e-5) { fail('seams', `${label}: glued points of edge ${i} (sample ${j}) fold to different points of T: ${Math.hypot(u[0] - u2[0], u[1] - u2[1])}`); return; }
        if ((c1.depth & 1) !== (c2.depth & 1) && sideDist(u) > 1e-5) { fail('seams', `${label}: glued points of edge ${i} (sample ${j}) land on different sheets, ${sideDist(u)} from a glued side`); return; }
      }
    });
  }
}

// ---- build everything once
let extraMeshes = 0;
function run(group, amp, c, warp) {
  const label = `${c.label} amp ${amp}`;
  try {
    const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp });
    const mesh = c.density || c.draft ? buildMesh(group, domain, { density: c.density, draft: c.draft }) : buildMesh(group, domain);
    if (amp === 0 && !c.draft && c.label.includes('preset 0 (')) stats.tris[group.id] = [mesh.m, mesh.n, mesh.cells.length];
    checkMesh(group, domain, mesh, label, amp);
  } catch (err) {
    fail('structure', `${label}: threw ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`);
  }
}
for (const group of GROUPS) {
  stats.tris[group.id] = [];
  for (const amp of AMPS) {
    const warp = makeWarp(group, amp);
    for (const c of cases(group)) run(group, amp, c, warp);
    for (const c of nearPresets(group)) { run(group, amp, c, warp); extraMeshes++; }
  }
  // the "Wavy" slider passes through tiny amplitudes: lobes thinner than any tolerance must not break anything
  for (const amp of SMALL_AMPS) {
    const warp = makeWarp(group, amp);
    for (const [i, p] of group.presets.entries()) { run(group, amp, { label: `${group.id} preset ${i} (${p.name})`, seed: p.seed, metric: p.metric }, warp); extraMeshes++; }
    for (const c of nearPresets(group, [1e-6])) { run(group, amp, c, warp); extraMeshes++; }
  }
}

// Seeds at which the mesh of 2026-11-09 morning was broken (found by test/verify-topology.test.js, test/verify-robust.test.js
// and dev/corefix-scan.mjs; about 1 wavy tile in 600). Absolute coordinates: they mean what they did only while the
// lattices in src/groupdata keep their sizes; the sweeps above do not depend on that.
//   slit    a T-junction on the rim next to a corner of the tile: a cut point made by one tile edge lay outside another
//           tile edge that no corner of its fine triangle was outside of, and the triangle across the fine edge cut it again
//   island  a corner of the tile a hair from a crease: its tip showed in one long thin fine triangle only (through a
//           lobe across the crease), cut off from the rest of the tile; two pieces hung in the air
//   hole    the cut dips across a crease between two neighbouring vertices of the fine mesh and takes in the vertex
//           behind: the notch was meshed shut along the crease, the rest of it was a hole
//   spike   a nearly straight corner of the tile, or a cut meeting a mirror along a grid line: a fine edge crossed
//           one cut twice and then another, and the chord of the clipping joined two different arcs of the first:
//           a thin triangle outside the tile, the rim 0.2 to 2 % too long. (The last one, on a coarse grid: a short
//           tile edge along a long fine edge. The fine edge has a lobe of the tile, and the half of it left of the
//           lobe has a notch of the short tile edge: the halves of a split edge were not looked at again.)
//   needle  a line of the fine mesh a hair INSIDE a tile edge (22x "Pocket", the seed 1e-9 to 1e-6 off): the strip
//           between the two ended, at the corner of the tile, in a point 4e-5 past the corner — the chord along the
//           tile edge was cut where straight coordinates put the corner, the fine edge beside it where the corner is —
//           and the rim ran out to it and back
const BROKEN = [
  ['slit', '442', [1.0412949716672302, 0.028129406459629525], 1],
  ['slit', '442', [0.5000000005403024, 8.414710154240665e-10], 1],
  ['slit', '442', [0.5162090719130434, 0.025244131352015236], 1],
  ['slit', '2222', [-0.5133490037638694, 1.4451173793058842], 1],
  ['slit', '22x', [1.1903342579025775, 1.0130437532672658], 1],
  ['slit', '22x', [0.6910707462346182, 0.7096936793066562], 1],
  ['slit', '22x', [0.636539277783595, 0.46648775520734487], 1],
  // ** was turned a quarter turn on 10 Nov (src/groupdata/roll.js: mirrors x = k w, translation (0, b); it was mirrors
  // y = k w, translation (b, 0)), so its seed is re-pinned through the map (x, y) -> (y, x) that carries the old group
  // onto the new one: the same place of the strip (it was [1.6181752597913146, 0.9288813577964901]). The wave there is
  // not the one the slit was found with (round 3 chose new waves, notes/core-round3.md #1), and no seed of the turned **
  // reproduces the slit today: 4000 tiles of it at amp 1 meshed with the clipping of that morning restored (one pass,
  // by the edges the three corners are outside of; with and without the halving of long crossed edges) have no
  // T-junction (integrator, 10 Nov). Like the other amp-1 seeds above it now checks a place, not the old configuration.
  ['slit', '**', [0.9288813577964901, 1.6181752597913146], 1],
  ['slit', '**', null, 0.99],
  ['slit', '*x', null, 0.64],
  ['island', '632', [1.8031497699208558, -0.38512483477134285], 1],
  ['island', '632', [-0.3379141288343819, 0.6026236054905875], 0.5],
  ['island', '632', [1.1109899157192558, -0.17160423580098916], 1],
  ['hole', '4*2', [-0.08078490202315158, 0.9114033472258598], 1],
  ['hole', '4*2', [1.2587194381281734, 0.2799061996862292], 1],
  ['spike', '442', [0.5201925285160542, 0.5619209067430347], 0.7],
  ['spike', '*x', [1.1645371303893626, 0.7311138883465901], 1],
  ['spike', '*x', [0.6435900277923793, 1.0521734974347055], 0.75],
  ['spike', 'xx', [0.40705087794922296, 1.4525680829770864], 1, 13],
  ['needle', '22x', [0.3250000006, 0.9000000008], 1],
  ['needle', '22x', [0.32500006, 0.90000008], 1],
  ['needle', '22x', [0.3250006, 0.9000008], 1],
];
// (the needle again, whatever the size of the lattice of 22x is by now. While its glide axes are y = b/4 and x = a/4,
// the tile of the seed (a/4, b/2) is the rectangle [0, a/2] x [b/4, 3b/4], and y = 3b/4 is the middle line of a
// kaleidoscope cell: a line of the fine mesh.)
{
  const g = BY_ID['22x'], a = g.e1[0], b = g.e2[1];
  for (const off of [1e-9, -1e-9, 1e-7, 1e-6]) for (const amp of [1, 0.4]) BROKEN.push(['needle', '22x', [a / 4 + 0.6 * off, b / 2 + 0.8 * off], amp]);
}
for (const [what, id, seed, amp, density] of BROKEN) {
  const group = BY_ID[id], p0 = group.presets[0];
  // (a mesh of another density is checked like the rest, but the accuracy figures printed below are for the default one)
  const kept = density ? [[...stats.maxAreaErr], [...stats.maxRimGap], [...stats.maxRimOff]] : null;
  run(group, amp, { label: `${id} ${seed ? `seed (${seed[0]}, ${seed[1]})` : 'preset 0'}${density ? ` density ${density}` : ''} [once a ${what}]`, seed: seed || p0.seed, metric: seed ? undefined : p0.metric, density }, makeWarp(group, amp));
  if (kept) [stats.maxAreaErr, stats.maxRimGap, stats.maxRimOff] = kept;
  extraMeshes++;
}

// Round 3, finding #12: the draft meshes the app may build for the frames of a drag ({ draft: true }) are checked like
// every other mesh above (structure, disc, rim, pieces, tree, locate, boundary, sheets, seams), for the presets and the
// random seeds at amp 0 and 1. (The accuracy figures printed below are for the full meshes.)
{
  const kept = [[...stats.maxAreaErr], [...stats.maxRimGap], [...stats.maxRimOff]];
  for (const group of GROUPS) {
    for (const amp of [0, 1]) {
      const warp = makeWarp(group, amp);
      for (const c of cases(group)) { run(group, amp, { ...c, label: `${c.label} [draft]`, draft: true }, warp); extraMeshes++; }
    }
  }
  [stats.maxAreaErr, stats.maxRimGap, stats.maxRimOff] = kept;
}

const show = (name) => failures[name].slice(0, 6).join('\n') + (failures[name].length > 6 ? `\n... ${failures[name].length} failures` : '');

test('mesh: arrays, indices, per-vertex pieces, bbox, piece records', () => assert.equal(failures.structure.length, 0, show('structure')));
test('mesh: triangle areas sum to the domain area (1e-6 at amp 0, 1e-3 at amp 1); piece areas add up', () => assert.equal(failures.area.length, 0, show('area')));
test('mesh: no inverted triangles', () => assert.equal(failures.inverted.length, 0, show('inverted')));
test('mesh: welded and watertight — manifold edges, one closed rim, Euler characteristic 1', () => assert.equal(failures.watertight.length, 0, show('watertight')));
test('mesh: the rim is a simple polygon on the boundary of the tile — no T-junction (slit), no vertex off the boundary', () => assert.equal(failures.simpleRim.length, 0, show('simpleRim')));
test('mesh: every piece is connected and lies in its kaleidoscope cell', () => assert.equal(failures.pieces.length, 0, show('pieces')));
test('mesh: the piece graph is a tree without orphans; hinges lie on the shared crease, piece on the left', () => assert.equal(failures.tree.length, 0, show('tree')));
test('mesh: the root is the piece of the (nudged) warped seed', () => assert.equal(failures.root.length, 0, show('root')));
test('mesh: locate(centroid of a triangle) is that triangle\'s piece', () => assert.equal(failures.locate.length, 0, show('locate')));
test('mesh: boundary is the outline, lies on the rim of the mesh, and its pieces are really there', () => assert.equal(failures.boundary.length, 0, show('boundary')));
test('mesh: hinge groups — even and odd pieces each cover the cell once (crosscap: together once)', () => assert.equal(failures.parity.length, 0, show('parity')));
test('mesh: hinge groups — sheets alternate with depth', () => assert.equal(failures.sheets.length, 0, show('sheets')));
test('mesh: hinge groups and 22x — glued boundary points fold to the same point of the cell on the same sheet (22x glides: antipodal)', () => assert.equal(failures.seams.length, 0, show('seams')));

test('mesh: locate at points on, next to and far from the tile is what a search of ALL triangles gives', () => {
  // The rule of locate (src/mesh.js): the kaleidoscope cell of the point decides; in that cell the piece of the nearest
  // triangle, if it is within tau = 0.03 sqrt(domainArea); otherwise (the cell holds no piece that near) the piece of the
  // nearest triangle of the whole mesh. Here the nearest triangles are found by brute force. Points: every boundary
  // sample and cone point (on the rim, a rounding error to either side — the bucket grids of locate end there), rim
  // vertices pushed 1e-7 ... 0.3 sizes outward, and a grid over three times the bounding box.
  const pd = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  };
  let points = 0, viaCell = 0, viaAll = 0, outsideGrid = 0;
  for (const group of GROUPS) {
    if (!group.kaleido) continue;
    const size = Math.sqrt(group.domainArea), tau = 0.03 * size;
    for (const p of [group.presets[0], group.presets[group.presets.length - 1]]) {
      for (const amp of [0, 1]) {
        const d = buildDomain(group, { seed: p.seed, metric: p.metric, warp: makeWarp(group, amp) });
        const mesh = buildMesh(group, d);
        const { xy, tri, triCell, cells, m } = mesh, P = cells.length;
        const label = `${group.id} ${p.name} amp ${amp}`;
        /** Distance from the point to every piece. */
        const pieceDist = (px, py) => {
          const dist = new Float64Array(P).fill(Infinity);
          for (let t = 0; t < m; t++) {
            const k = triCell[t];
            const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
            const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1], cx = xy[2 * c], cy = xy[2 * c + 1];
            const inside = (bx - ax) * (py - ay) - (by - ay) * (px - ax) >= 0 && (cx - bx) * (py - by) - (cy - by) * (px - bx) >= 0 && (ax - cx) * (py - cy) - (ay - cy) * (px - cx) >= 0;
            const dd = inside ? 0 : Math.min(pd(px, py, ax, ay, bx, by), pd(px, py, bx, by, cx, cy), pd(px, py, cx, cy, ax, ay));
            if (dd < dist[k]) dist[k] = dd;
          }
          return dist;
        };
        /** The cells (by cellId) that hold the point: one, or two or more for a point on a crease (to 1e-9). */
        const cellsOf = (px, py) => {
          const set = new Set();
          for (const c of cells) {
            if (set.has(c.cellId)) continue;
            const q = c.poly, s = c.parity ? -1 : 1;
            let inside = true;
            for (let i = 0; i < q.length && inside; i++) {
              const a = q[i], b = q[(i + 1) % q.length];
              if (s * ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]) < -1e-9) inside = false;
            }
            if (inside) set.add(c.cellId);
          }
          return set;
        };
        const check = (px, py, what) => {
          const got = mesh.locate(px, py);
          points++;
          assert.ok(Number.isInteger(got) && got >= 0 && got < P, `${label}: locate of ${what} (${px}, ${py}) = ${got}`);
          const all = pieceDist(px, py), dAll = Math.min(...all);
          const own = cellsOf(px, py);           // a point on a crease is in two cells (or more): either may answer
          const nearestIn = (cellId) => cells.reduce((mn, c, k) => (c.cellId === cellId && all[k] < mn ? all[k] : mn), Infinity);
          const eps = 1e-6 * size;               // the mesh of the test is Float32, locate works on the Float64 positions
          // answered by a cell that holds the point (a piece of it is within tau, give or take), or by the whole mesh
          // (no piece of such a cell is within tau, give or take)
          const mine = cells[got].cellId, dMine = nearestIn(mine);
          const okCell = own.has(mine) && dMine < 1.05 * tau && all[got] <= dMine + eps;
          const okAll = (own.size === 0 || [...own].some((c) => nearestIn(c) > 0.95 * tau)) && all[got] <= dAll + eps;
          if (okCell) viaCell++; else if (okAll) viaAll++;
          assert.ok(okCell || okAll, `${label}: locate of ${what} (${px}, ${py}) = piece ${got} at distance ${all[got]}; cells that hold the point: [${[...own]}], nearest piece of each at [${[...own].map(nearestIn)}]; nearest piece of all: ${[...all].indexOf(dAll)} at ${dAll}`);
        };
        for (const b of mesh.boundary) for (let j = 0; j < b.cells.length; j++) check(b.pts[2 * j], b.pts[2 * j + 1], `sample ${j} of boundary[${b.edge}]`);
        for (const c of d.conePoints) check(c.x, c.y, 'a cone point');
        const [x0, y0, x1, y1] = mesh.bbox, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        for (let v = 0; v < mesh.n; v += 7) {
          const dx = xy[2 * v] - cx, dy = xy[2 * v + 1] - cy, l = Math.hypot(dx, dy) || 1;
          for (const r of [1e-7, 1e-4, 0.01, 0.3]) check(xy[2 * v] + (r * size * dx) / l, xy[2 * v + 1] + (r * size * dy) / l, `vertex ${v} pushed out by ${r} sizes`);
        }
        for (let i = 0; i <= 12; i++) {
          for (let j = 0; j <= 12; j++) {
            const px = cx + ((i - 6) / 6) * 1.5 * (x1 - x0), py = cy + ((j - 6) / 6) * 1.5 * (y1 - y0);
            if (px < x0 || px > x1 || py < y0 || py > y1) outsideGrid++;
            check(px, py, 'a grid point');
          }
        }
        check(x1 + 40 * size, y0 - 25 * size, 'a point far away');
      }
    }
  }
  console.log(`      ${points} points: ${viaCell} answered by the point's own cell, ${viaAll} by the whole mesh; ${outsideGrid} grid points outside the bounding box`);
  assert.ok(points > 20000 && viaCell > 5000 && viaAll > 3000 && outsideGrid > 3000, 'the sweep is thinner than it claims');
});

test('mesh: the wavy cut really produces lobes and cells with several pieces (the triangle-search path of locate is used)', () => {
  assert.equal(stats.meshes, GROUPS.reduce((s, g) => s + AMPS.length * (g.presets.length + SEEDS), 0) + extraMeshes);
  assert.ok(stats.lobes > 50, `lobes: ${stats.lobes}`);
  assert.ok(stats.multiPieceCells > 10, `cells with several pieces: ${stats.multiPieceCells}`);
  assert.ok(stats.maxTri <= 9000, `largest mesh has ${stats.maxTri} triangles`);
  console.log(`      meshes ${stats.meshes}, max relative area error amp0 ${stats.maxAreaErr[0].toExponential(1)} amp1 ${stats.maxAreaErr[1].toExponential(1)}, ` +
    `min triangle height ${stats.minHeight.toExponential(1)}, max pieces ${stats.maxPieces}, lobes ${stats.lobes}, multi-piece cells ${stats.multiPieceCells}, ` +
    `max triangles ${stats.maxTri}, max rim gap / size amp0 ${stats.maxRimGap[0].toExponential(1)} amp1 ${stats.maxRimGap[1].toExponential(1)}, ` +
    `rim vertex furthest from the boundary / size amp0 ${stats.maxRimOff[0].toExponential(1)} amp1 ${stats.maxRimOff[1].toExponential(1)}`);
  console.log('      triangles / vertices / pieces at preset 0, amp 0: ' + GROUPS.map((g) => `${g.id} ${stats.tris[g.id].join('/')}`).join('  '));
});

test('mesh: kaleidoscopes are a single flat piece (the cell itself); roll groups are one pseudo-cell', () => {
  for (const id of ['*2222', '*442', '*333', '*632']) {
    const g = BY_ID[id];
    for (const amp of [0, 1]) {
      const mesh = buildMesh(g, buildDomain(g, { seed: g.presets[0].seed, warp: makeWarp(g, amp) }));
      assert.equal(mesh.cells.length, 1, id);
      assert.equal(mesh.creases.length, 0, id);
      assert.ok(Math.abs(mesh.cells[0].area - polyArea(g.kaleido.cell)) < 1e-9, id);
      // the warp slides points along the mirrors: the mesh is exactly the cell
      const q = mesh.cells[0].poly, b = mesh.bbox;
      assert.ok(Math.abs(b[0] - Math.min(...q.map((p) => p[0]))) < 1e-6 && Math.abs(b[3] - Math.max(...q.map((p) => p[1]))) < 1e-6, id);
    }
  }
  for (const id of ['o', '**', 'xx', '*x']) {
    const g = BY_ID[id];
    const mesh = buildMesh(g, buildDomain(g, { seed: g.presets[0].seed, metric: g.presets[0].metric, warp: makeWarp(g, 1) }));
    assert.equal(mesh.cells.length, 1, id);
    assert.equal(mesh.cells[0].poly, null, id);
    assert.equal(mesh.locate(123, -45), 0, id);
    assert.ok(mesh.boundary.every((b) => b.cells.every((c) => c === 0)), id);
  }
});

test('mesh: density option; a translated seed gives the translated mesh', () => {
  const g = BY_ID['442'];
  const d = buildDomain(g, { seed: [0.3, 0.12] });
  const coarse = buildMesh(g, d, { density: 10 }), fine = buildMesh(g, d, { density: 30 }), def = buildMesh(g, d);
  assert.ok(coarse.m < def.m && def.m < fine.m, `${coarse.m} < ${def.m} < ${fine.m}`);
  assert.equal(coarse.cells.length, def.cells.length);
  const o = BY_ID['o'], od = buildDomain(o, o.presets[0]);
  assert.ok(buildMesh(o, od, { density: 80 }).m > buildMesh(o, od).m);
  const far = buildMesh(g, buildDomain(g, { seed: [0.3 + 3, 0.12 - 2] }));
  assert.equal(far.m, def.m);
  assert.equal(far.cells.length, def.cells.length);
  assert.ok(Math.abs(far.bbox[0] - def.bbox[0] - 3) < 1e-6 && Math.abs(far.bbox[1] - def.bbox[1] + 2) < 1e-6);
  const bs = buildMesh(g, d, { boundaryStep: 0.01 });
  assert.ok(bs.boundary[0].pts.length > def.boundary[0].pts.length);
});

test('mesh: the shortcut for vertices deep inside the tile (no warp.inv for them) changes nothing, bit for bit (finding #12)', () => {
  // buildMesh skips warp.inv for a vertex that lies deeper inside every edge line than any point is displaced; a warp
  // that does not tell its peak gets no shortcut. The two meshes must be the same, array for array.
  const rnd = prng(1212), same = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  let meshes = 0;
  for (const group of GROUPS) {
    const dens = group.kaleido ? {} : { density: 88 };
    for (const amp of [0.3, 1]) {
      const warp = makeWarp(group, amp), plain = { ...warp, peak: undefined };
      const seeds = group.presets.map((p) => ({ seed: p.seed, metric: p.metric }));
      for (let k = 0; k < 4; k++) seeds.push({ seed: [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf] });
      for (const S of seeds) {
        const d = buildDomain(group, { ...S, warp });
        const a = buildMesh(group, d, dens), b = buildMesh(group, { ...d, warp: plain }, dens);
        const label = `${group.id} amp ${amp} seed (${S.seed})`;
        assert.ok(same(a.xy, b.xy) && same(a.tri, b.tri) && same(a.triCell, b.triCell) && same(a.cell, b.cell), `${label}: arrays`);
        assert.equal(JSON.stringify(a.cells), JSON.stringify(b.cells), `${label}: pieces`);
        a.boundary.forEach((e, i) => assert.ok(same(e.cells, b.boundary[i].cells), `${label}: boundary pieces`));
        meshes++;
      }
    }
  }
  assert.ok(meshes > 200, `${meshes} meshes`);
});

test('mesh: the rim follows a wavy boundary within 0.6 % of the tile size, drafts too — the cuts the tests-math verifier found at 1.06-1.56 % (other salts of the sweep) are pinned, with a sweep of salt 11 (final fix, 10 Nov 2026)', () => {
  const rimGapOf = (domain, mesh) => {
    const { xy, tri } = mesh, cnt = new Map();
    for (let t = 0; t < tri.length / 3; t++) for (let e = 0; e < 3; e++) { const u = tri[3 * t + e], v = tri[3 * t + (e + 1) % 3], k = u < v ? u * 1e7 + v : v * 1e7 + u; cnt.set(k, (cnt.get(k) || 0) + 1); }
    const rim = [];
    for (const [k, c] of cnt) if (c === 1) rim.push([Math.floor(k / 1e7), k % 1e7]);
    let worst = 0;
    for (const b of mesh.boundary) for (let j = 0; j < b.pts.length; j += 2) {
      let d = Infinity;
      for (const [u, v] of rim) d = Math.min(d, segDist(b.pts[j], b.pts[j + 1], xy[2 * u], xy[2 * u + 1], xy[2 * v], xy[2 * v + 1]));
      worst = Math.max(worst, d);
    }
    return worst / Math.sqrt(domain.group.domainArea);
  };
  const seedOf = (g, salt, k) => { const rnd = prng(4242 + GROUPS.indexOf(g) + 7919 * salt); let s; for (let i = 0; i <= k; i++) s = [g.center[0] + (2 * rnd() - 1) * g.viewHalf, g.center[1] + (2 * rnd() - 1) * g.viewHalf]; return s; };
  // [group, salt, seed index, draft, what the verifier measured]
  const pinned = [['333', 11, 1, true, 0.0116], ['632', 11, 1, true, 0.0141], ['3*3', 11, 41, true, 0.0119], ['632', 7, 3, false, 0.0106], ['632', 2, 6, true, 0.0154], ['632', 9, 17, true, 0.0155]];
  let worst = 0, n = 0;
  for (const [id, salt, k, draft, was] of pinned) {
    const g = BY_ID[id], seed = seedOf(g, salt, k);
    const d = buildDomain(g, { seed, metric: g.presets[k % g.presets.length].metric, warp: makeWarp(g, 1) });
    const gap = rimGapOf(d, buildMesh(g, d, { draft }));
    assert.ok(gap < 0.006, `${id} salt ${salt} seed ${k} (${seed.map((v) => v.toFixed(4))}) ${draft ? 'draft' : 'full'}: the rim strays ${(100 * gap).toFixed(2)} % (it was ${(100 * was).toFixed(2)} %)`);
    worst = Math.max(worst, gap); n++;
  }
  for (const g of GROUPS) {
    if (g.fold === 'snowflake') continue;
    for (let k = 0; k < 12; k++) {
      const seed = seedOf(g, 11, k), d = buildDomain(g, { seed, metric: g.presets[k % g.presets.length].metric, warp: makeWarp(g, 1) });
      for (const draft of [true, false]) {
        const gap = rimGapOf(d, buildMesh(g, d, { draft }));
        assert.ok(gap < 0.006, `${g.id} salt 11 seed ${k} ${draft ? 'draft' : 'full'}: the rim strays ${(100 * gap).toFixed(2)} %`);
        worst = Math.max(worst, gap); n++;
      }
    }
  }
  console.log(`      ${n} wavy meshes: the rim within ${(100 * worst).toFixed(2)} % of the boundary`);
});

test('mesh: a draft mesh (the frames of a drag) has under 55 % of the triangles and costs well under the full one (finding #12)', () => {
  // the structure of draft meshes is checked with all the others above; here their size, and their time against the
  // full mesh (the smaller of: the fastest of nine builds, the median CPU time; printed, and held to 80 %: 0.35-0.71 on
  // a lab box, the small meshes of *x and 22x gaining least, where the boundary's share of the work is largest)
  let worstRatio = 0, worstLabel = '';
  const rows = [];
  for (const group of GROUPS) {
    const p = group.presets[0], warp = makeWarp(group, 1), dens = group.kaleido ? undefined : ({ o: 88, '**': 60, '*x': 80, xx: 104 })[group.id] || 56;
    const d = buildDomain(group, { seed: p.seed, metric: p.metric, warp });
    const full = buildMesh(group, d, { density: dens }), draft = buildMesh(group, d, { density: dens, draft: true });
    assert.ok(draft.m < 0.55 * full.m, `${group.id}: draft ${draft.m} triangles, full ${full.m}`);
    assert.deepEqual(draft.boundary.map((b) => [...b.pts]), full.boundary.map((b) => [...b.pts]), `${group.id}: the same boundary samples`);
    // full and draft builds taken in turn, nine of each, so both see the same load of a shared machine (final fix,
    // 10 Nov: five of one and then five of the other once measured a 0.6 ms kaleidoscope's draft at 1.29 of its
    // full mesh on a busy box; the bound is unchanged)
    const runs = { full: { times: [], cpu: [] }, draft: { times: [], cpu: [] } };
    for (let k = 0; k < 9; k++) {
      for (const [name, opts] of [['full', { density: dens }], ['draft', { density: dens, draft: true }]]) {
        const c0 = process.cpuUsage(), t0 = performance.now();
        buildMesh(group, d, opts);
        runs[name].times.push(performance.now() - t0); const c1 = process.cpuUsage(c0); runs[name].cpu.push((c1.user + c1.system) / 1000);
      }
    }
    const cost = ({ times, cpu }) => { times.sort((a, b) => a - b); cpu.sort((a, b) => a - b); return Math.min(times[0], cpu[4]); };
    const tf = cost(runs.full), td = cost(runs.draft);
    rows.push(`${group.id} ${tf.toFixed(1)}->${td.toFixed(1)}`);
    if (td / tf > worstRatio) { worstRatio = td / tf; worstLabel = group.id; }
  }
  console.log(`      wavy preset 0, full -> draft (ms): ${rows.join('  ')}; worst ratio ${worstRatio.toFixed(2)} (${worstLabel})`);
  assert.ok(worstRatio < 0.8, `a draft mesh costs ${worstRatio.toFixed(2)} of the full one (${worstLabel})`);
});

test('performance: buildDomain + buildMesh stays under 30 ms for every group at default density', () => {
  // Seven builds of every preset, straight and wavy. The median of the wall-clock times is printed: it is what a build
  // takes on this machine right now, and on a shared machine that is mostly the other work (measured 2026-11-09 on
  // the Intel: worst median 8.6 ms with this measurement running alone, 20 ms inside the whole suite at a load
  // average of 12; 3.4 ms on a lab box). What the code costs, whatever else runs, is the smaller of two figures: the
  // FASTEST of the seven builds, and the median CPU time of this process over a build. That is held to the 30 ms of
  // the SPEC.
  let worst = 0, worstLabel = '', worstCost = 0, costLabel = '';
  const rows = [];
  for (const group of GROUPS) {
    let groupWorst = 0;
    for (const amp of [0, 1]) {
      const warp = makeWarp(group, amp);
      for (const p of group.presets) {
        const run = () => { const d = buildDomain(group, { seed: p.seed, metric: p.metric, warp }); return buildMesh(group, d); };
        run(); run();
        const times = [], cpu = [];
        for (let k = 0; k < 7; k++) {
          const c0 = process.cpuUsage(), t0 = performance.now();
          run();
          const t1 = performance.now(), c1 = process.cpuUsage(c0);
          times.push(t1 - t0); cpu.push((c1.user + c1.system) / 1000);
        }
        times.sort((a, b) => a - b); cpu.sort((a, b) => a - b);
        const med = times[3], cost = Math.min(times[0], cpu[3]);
        groupWorst = Math.max(groupWorst, med);
        if (med > worst) { worst = med; worstLabel = `${group.id} ${p.name} amp ${amp}`; }
        if (cost > worstCost) { worstCost = cost; costLabel = `${group.id} ${p.name} amp ${amp}`; }
      }
    }
    rows.push(`${group.id} ${groupWorst.toFixed(1)}`);
  }
  console.log(`      worst median build ${worst.toFixed(2)} ms (${worstLabel}); per group (ms): ${rows.join('  ')}; worst cost (fastest build or median CPU time) ${worstCost.toFixed(2)} ms (${costLabel})`);
  assert.ok(worstCost < 30, `worst case ${worstCost.toFixed(1)} ms (${costLabel}): the fastest of seven builds, or the median CPU time of a build`);
});
