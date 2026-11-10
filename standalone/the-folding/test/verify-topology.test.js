// verify-topology.test.js — INDEPENDENT topology check of the tile, its gluing and its mesh (verifier lens).
//
// It shares no logic with domain.test.js / mesh.test.js: the isometry helpers, the element classification, the
// edge pairing, the vertex cycles, the group-orbit test and the PRNG below are all written from scratch, and the
// expected values are the orbifold symbols themselves.
//
// For all 17 groups x every preset x 25 seeded-random seeds, the polygon `domain.poly` with the gluing data
// `domain.edges` is glued up combinatorially and the result must be the orbifold named by `group.id`:
//
//   (a) vertex cycles under the edge pairings (mirror edges end a cycle; a half-turn edge is folded at its midpoint,
//       which becomes a vertex of angle pi). The angle sum of an interior cycle is 2 pi / n, of a cycle that ends on
//       mirrors pi / n, n a positive integer; the cone orders n > 1 and the mirror-corner orders n > 1 are the digits
//       of the orbifold symbol.
//   (b) Euler characteristic V - E + F of the glued surface: sphere 2, disc 1, projective plane 1, and 0 for the
//       torus, Klein bottle, annulus and Moebius band.
//   (c) orientability: a glued pair that keeps the direction of travel (= an orientation-reversing element) exists
//       exactly when the symbol contains x.
//   (d) number of mirror boundary components = number of * in the symbol.
//   plus: Domain.conePoints is exactly the set of cone points and mirror corners found in (a).
//
// Beyond that: the wavy tile (amp 1); an extended sweep (far-away seeds, seeds on the special loci, other invariant
// metrics, seeds a hair off the degenerate presets, seeds bisected to the last bit onto a change of the tile's shape);
// the mesh as a cell complex (a disc with a simple rim on the tile boundary, cut into discs that form a tree of hinges
// whose reflections compose correctly, glued boundary samples folding together); the doubled kaleidoscope cell of the
// hinge groups; and controls that show each check notices a deliberately broken input.
//
// Two tests failed against the code as verified on 2026-11-09 (everything else was green):
//   * "mesh at amp 1: ... no T-junction"  — buildMesh left a slit in the mesh for about 0.2 % of random seeds at amp 1
//     (see SLIT_SEEDS below for the seeds and for what went wrong in addTriangle);
//   * "Domain.conePoints lists only rotation centres ON the tile ..." — for a seed within 1e-7 of a degenerate position
//     conePoints also listed the glued twin of a cone point although it lies up to 1e-7 outside the tile.
// Both were faults of the code, not of the tests, and were fixed the same afternoon (notes/core.md): addTriangle now
// clips by every tile edge that a vertex of the clipped polygon is outside of, until none is, and buildDomain takes a
// centre for a cone point only when it is on the tile to 1e-9, the tolerance its vertices are merged at. All green.
// (The same evening "mesh: a disc whose rim is the tile boundary ..." caught one more, when 22x got a default cut whose
// edges run along lines of the fine mesh: the rim ran 4e-5 past a corner of the tile and back. A fault of the code
// again — a chord of the rim was cut by the next tile edge where straight coordinates put the corner, not where the
// chord meets that edge — fixed in src/mesh.js; "needle" in test/mesh.test.js pins it.)
//
// Run alone:   node --test test/verify-topology.test.js
// A table of what was derived for every preset:   VERIFY_TOPOLOGY_DUMP=1 node --test test/verify-topology.test.js
// A wider sweep:   VERIFY_SEEDS=2000 VERIFY_MESH_SEEDS=40 VERIFY_AMPS=0,0.3,1 VERIFY_BISECTIONS=60 node --test test/verify-topology.test.js
// One tile / one mesh by hand:   node dev/verify-topology-probe.mjs <id> <x> <y> [amp]
//                                node dev/verify-topology-rimprobe.mjs <id> <x> <y> [amp] [vertex ids ...]

import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID } from '../src/groups.js';
import { makeWarp, buildDomain } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';

const TAU = 2 * Math.PI;
const N_SEEDS = Math.max(25, +process.env.VERIFY_SEEDS || 25);
const MESH_SEEDS = Math.max(4, +process.env.VERIFY_MESH_SEEDS || 4);
const MESH_AMPS = process.env.VERIFY_AMPS ? process.env.VERIFY_AMPS.split(',').map(Number) : [0, 1];
const BISECTIONS = Math.max(5, +process.env.VERIFY_BISECTIONS || 5);

// ---------------------------------------------------------------------------------------------------------------
// Expected values, written out by hand from the orbifold symbols (Conway): digits before any * are cone points,
// digits after a * are corners of that mirror boundary, x is a cross-cap, o a handle.
// ---------------------------------------------------------------------------------------------------------------

const EXPECT = {
  'o':     { hm: 'p1',   surface: 'torus',            chi: 0, orientable: true,  rims: 0, cones: [],           corners: [] },
  '2222':  { hm: 'p2',   surface: 'sphere',           chi: 2, orientable: true,  rims: 0, cones: [2, 2, 2, 2], corners: [] },
  '**':    { hm: 'pm',   surface: 'annulus',          chi: 0, orientable: true,  rims: 2, cones: [],           corners: [] },
  'xx':    { hm: 'pg',   surface: 'Klein bottle',     chi: 0, orientable: false, rims: 0, cones: [],           corners: [] },
  '*x':    { hm: 'cm',   surface: 'Möbius band',      chi: 0, orientable: false, rims: 1, cones: [],           corners: [] },
  '333':   { hm: 'p3',   surface: 'sphere',           chi: 2, orientable: true,  rims: 0, cones: [3, 3, 3],    corners: [] },
  '22x':   { hm: 'pgg',  surface: 'projective plane', chi: 1, orientable: false, rims: 0, cones: [2, 2],       corners: [] },
  '22*':   { hm: 'pmg',  surface: 'disc',             chi: 1, orientable: true,  rims: 1, cones: [2, 2],       corners: [] },
  '*2222': { hm: 'pmm',  surface: 'disc',             chi: 1, orientable: true,  rims: 1, cones: [],           corners: [2, 2, 2, 2] },
  '2*22':  { hm: 'cmm',  surface: 'disc',             chi: 1, orientable: true,  rims: 1, cones: [2],          corners: [2, 2] },
  '442':   { hm: 'p4',   surface: 'sphere',           chi: 2, orientable: true,  rims: 0, cones: [4, 4, 2],    corners: [] },
  '632':   { hm: 'p6',   surface: 'sphere',           chi: 2, orientable: true,  rims: 0, cones: [6, 3, 2],    corners: [] },
  '3*3':   { hm: 'p31m', surface: 'disc',             chi: 1, orientable: true,  rims: 1, cones: [3],          corners: [3] },
  '*333':  { hm: 'p3m1', surface: 'disc',             chi: 1, orientable: true,  rims: 1, cones: [],           corners: [3, 3, 3] },
  '4*2':   { hm: 'p4g',  surface: 'disc',             chi: 1, orientable: true,  rims: 1, cones: [4],          corners: [2] },
  '*442':  { hm: 'p4m',  surface: 'disc',             chi: 1, orientable: true,  rims: 1, cones: [],           corners: [4, 4, 2] },
  '*632':  { hm: 'p6m',  surface: 'disc',             chi: 1, orientable: true,  rims: 1, cones: [],           corners: [6, 3, 2] },
};

/** The same data read mechanically off the symbol (a second derivation of the table above). */
function parseSymbol(id) {
  let handles = 0, caps = 0, rim = null;
  const cones = [], rims = [];
  for (const ch of id) {
    if (ch === 'o') handles++;
    else if (ch === 'x') caps++;
    else if (ch === '*') { rim = []; rims.push(rim); }
    else if (ch >= '2' && ch <= '9') (rim || cones).push(+ch);
    else throw new Error(`unexpected character ${ch} in orbifold symbol ${id}`);
  }
  const corners = rims.flat();
  // Conway's "cost": the symbol of a plane group costs exactly 2
  const cost = 2 * handles + caps + rims.length + cones.reduce((s, k) => s + (1 - 1 / k), 0) + corners.reduce((s, k) => s + (1 - 1 / k) / 2, 0);
  return { handles, caps, cones, corners, rims: rims.length, chi: 2 - 2 * handles - caps - rims.length, orientable: caps === 0, cost };
}

const desc = (list) => [...list].sort((a, b) => b - a);
const sameList = (a, b) => a.length === b.length && desc(a).every((v, i) => v === desc(b)[i]);

/** The orbifold symbol of a glued surface from what was measured (digits in descending order, as in the ids). */
function symbolOf({ chi, orientable, rimCorners, cones }) {
  const b = rimCorners.length;
  let s = '';
  if (orientable) {
    const handles = (2 - chi - b) / 2;
    if (!Number.isInteger(handles) || handles < 0) return `?(chi ${chi}, ${b} rims, orientable)`;
    s += 'o'.repeat(handles);
  }
  s += desc(cones).join('');
  for (const rc of rimCorners) s += '*' + desc(rc).join('');
  if (!orientable) {
    const caps = 2 - chi - b;
    if (caps < 1) return `?(chi ${chi}, ${b} rims, non-orientable)`;
    s += 'x'.repeat(caps);
  }
  return s;
}

// ---------------------------------------------------------------------------------------------------------------
// Small independent helpers (deliberately not src/geom.js)
// ---------------------------------------------------------------------------------------------------------------

const act = (g, p) => [g.a * p[0] + g.b * p[1] + g.tx, g.c * p[0] + g.d * p[1] + g.ty];
const detOf = (g) => g.a * g.d - g.b * g.c;
/** x -> g(h(x)) */
const mul = (g, h) => ({
  a: g.a * h.a + g.b * h.c, b: g.a * h.b + g.b * h.d, c: g.c * h.a + g.d * h.c, d: g.c * h.b + g.d * h.d,
  tx: g.a * h.tx + g.b * h.ty + g.tx, ty: g.c * h.tx + g.d * h.ty + g.ty,
});
/** Largest distance between the images of three points in general position, scaled to the tile: 0 iff g = h. */
function isoDistance(g, h, scale = 1) {
  let d = 0;
  for (const q of [[0, 0], [scale, 0], [0, scale]]) { const u = act(g, q), w = act(h, q); d = Math.max(d, Math.hypot(u[0] - w[0], u[1] - w[1])); }
  return d;
}

/** Inverse of an affine map by the general 2x2 formula (does not assume the linear part is orthogonal). */
function invAffine(g) {
  const D = detOf(g);
  const a = g.d / D, b = -g.b / D, c = -g.c / D, d = g.a / D;
  return { a, b, c, d, tx: -(a * g.tx + b * g.ty), ty: -(c * g.tx + d * g.ty) };
}

/** Reflection across the line through the points p and q. */
function mirrorThrough(p, q) {
  const dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy;
  const a = (dx * dx - dy * dy) / l2, b = (2 * dx * dy) / l2;
  return { a, b, c: b, d: -a, tx: p[0] - a * p[0] - b * p[1], ty: p[1] - b * p[0] + a * p[1] };
}

/** What kind of plane isometry is g?  (own classification) */
function kindOf(g) {
  const ortho = Math.abs(g.a * g.a + g.c * g.c - 1) + Math.abs(g.b * g.b + g.d * g.d - 1) + Math.abs(g.a * g.b + g.c * g.d);
  if (!(ortho < 1e-9)) return { type: 'not an isometry' };
  if (detOf(g) > 0) {
    const ang = Math.atan2(g.c, g.a);
    if (Math.abs(ang) < 1e-9) return Math.hypot(g.tx, g.ty) < 1e-9 ? { type: 'identity' } : { type: 'translation' };
    // fixed point: (I - L) x = t
    const m00 = 1 - g.a, m01 = -g.b, m10 = -g.c, m11 = 1 - g.d, dd = m00 * m11 - m01 * m10;
    const turns = TAU / Math.abs(ang);
    return {
      type: 'rotation', angle: ang, order: Math.abs(turns - Math.round(turns)) < 1e-6 ? Math.round(turns) : 0,
      center: [(g.tx * m11 - m01 * g.ty) / dd, (m00 * g.ty - m10 * g.tx) / dd],
    };
  }
  // orientation-reversing: g(g(x)) = x + (L t + t), twice the glide vector
  const sx = g.a * g.tx + g.b * g.ty + g.tx, sy = g.c * g.tx + g.d * g.ty + g.ty;
  return Math.hypot(sx, sy) < 2e-9 ? { type: 'reflection' } : { type: 'glide', shift: [sx / 2, sy / 2] };
}

/** Is the vector (wx, wy) in the translation lattice of the group? */
function inLattice(group, wx, wy, eps = 1e-8) {
  const { e1, e2 } = group, dd = e1[0] * e2[1] - e1[1] * e2[0];
  const s = (wx * e2[1] - wy * e2[0]) / dd, t = (e1[0] * wy - e1[1] * wx) / dd;
  return Math.abs(s - Math.round(s)) < eps && Math.abs(t - Math.round(t)) < eps;
}

/** Is the isometry g an element of the group?  (some coset representative with the same linear part, up to the lattice) */
function inGroup(group, g) {
  return group.reps.some((r) => Math.abs(r.a - g.a) + Math.abs(r.b - g.b) + Math.abs(r.c - g.c) + Math.abs(r.d - g.d) < 1e-7 && inLattice(group, g.tx - r.tx, g.ty - r.ty, 1e-7));
}

/** Are the points u and v in one orbit of the group? */
function sameOrbit(group, u, v) {
  return group.reps.some((r) => { const w = act(r, v); return inLattice(group, u[0] - w[0], u[1] - w[1]); });
}

/** Stabiliser of the point p in the group: its order, the order of its rotation subgroup, whether it holds a reflection. */
function stabiliser(group, p) {
  let order = 0, rotations = 0, mirror = false;
  for (const r of group.reps) {
    const w = act(r, p);
    if (!inLattice(group, p[0] - w[0], p[1] - w[1])) continue;     // translate(p - r(p)) o r fixes p
    order++;
    if (detOf(r) > 0) rotations++; else mirror = true;
  }
  return { order, rotations, mirror };
}

/** Deterministic PRNG (xorshift32), seeded from a string. */
function rngFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = (h >>> 0) || 0x9E3779B9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Gluing up one tile
// ---------------------------------------------------------------------------------------------------------------

const GLUE_TOL = 1e-8;      // inverse(g) must land the ends of an edge on polygon vertices this closely
const RESOLVED = 1e-6;      // a tile whose shortest edge is longer than this has no feature near any tolerance

/**
 * Glue the polygon domain.poly by domain.edges[i].g and measure the result.
 * Returns { ok, problems: [{check, msg}], n, classes: [{type, members, mids, sum, order, points}], V, E, F, chi,
 *           orientable, rims, rimCorners, cones, corners, symbol, expectedCones: [{x, y, order, onMirror}], ... }.
 * `problems` lists everything that contradicts a proper gluing; the checks are named so each test can pick its own.
 */
function glueUp(group, domain) {
  const P = domain.poly, E = domain.edges;
  const n = Array.isArray(P) ? P.length : 0;
  const R = { n, problems: [], classes: [], glueError: 0, lineError: 0, minEdge: Infinity, angleError: 0 };
  const bad = (check, msg) => R.problems.push({ check, msg });
  if (n < 3 || !Array.isArray(E) || E.length !== n) { bad('polygon', `poly has ${n} vertices, edges has ${E && E.length} entries`); return R; }
  const nx = (i) => (i + 1) % n, pv = (i) => (i + n - 1) % n;
  const [sx, sy] = domain.seed;

  // ---- 0. the polygon: counter-clockwise, strictly convex; interior angles
  const angle = [];
  let total = 0;
  for (let v = 0; v < n; v++) {
    const a = P[pv(v)], b = P[v], c = P[nx(v)];
    const ux = c[0] - b[0], uy = c[1] - b[1], wx = a[0] - b[0], wy = a[1] - b[1];
    const cr = ux * wy - uy * wx;                 // > 0 at a convex corner of a counter-clockwise polygon
    angle.push(Math.atan2(cr, ux * wx + uy * wy));
    total += angle[v];
    R.minEdge = Math.min(R.minEdge, Math.hypot(ux, uy));
    if (!(cr > 0)) bad('polygon', `corner ${v} is not strictly convex (cross product ${cr})`);
  }
  if (Math.abs(total - (n - 2) * Math.PI) > 1e-9) bad('polygon', `interior angles sum to ${total}, not (n - 2) pi = ${(n - 2) * Math.PI}`);
  R.resolved = R.minEdge > RESOLVED;
  // an angle is as accurate as the vertex positions divided by the length of the shortest edge
  const angleTol = 1e-9 + 1e-13 / R.minEdge;

  // ---- 1. each edge's element, read by this file's own classification
  const K = E.map((e) => kindOf(e.g));
  const isMirror = (e) => K[e].type === 'reflection';
  const isHalf = (e) => K[e].type === 'rotation' && Math.abs(Math.abs(K[e].angle) - Math.PI) < 1e-9;

  // ---- 2. the pairing, from the geometry alone: where does inverse(g) put the two ends of edge i?
  const nearest = (p) => {
    let best = -1, bd = Infinity;
    for (let v = 0; v < n; v++) { const d = Math.hypot(P[v][0] - p[0], P[v][1] - p[1]); if (d < bd) { bd = d; best = v; } }
    return [best, bd];
  };
  const img = [];     // img[i] = { j, kept, va, vb }: edge i lands on edge j; its start on vertex va, its end on vertex vb
  for (let i = 0; i < n; i++) {
    const e = E[i], k = K[i];
    img.push(null);
    if (k.type === 'not an isometry' || k.type === 'identity') { bad('pairing', `edge ${i}: g is ${k.type}`); continue; }
    if (!inGroup(group, e.g)) bad('pairing', `edge ${i}: g is not an element of the group`);
    const h = invAffine(e.g);
    const [va, da] = nearest(act(h, P[i])), [vb, db] = nearest(act(h, P[nx(i)]));
    R.glueError = Math.max(R.glueError, da, db);
    if (da > GLUE_TOL || db > GLUE_TOL) { bad('pairing', `edge ${i}: inverse(g) does not put its ends on polygon vertices (off by ${da.toExponential(2)}, ${db.toExponential(2)})`); continue; }
    let j, kept;
    if (vb === nx(va)) { j = va; kept = true; } else if (va === nx(vb)) { j = vb; kept = false; } else {
      bad('pairing', `edge ${i}: inverse(g) puts its ends on vertices ${va} and ${vb}, which are not the ends of one edge`);
      continue;
    }
    img[i] = { j, kept, va, vb };
    // direction of travel: reversed by a translation or rotation, kept by a glide (and trivially by a mirror)
    if (kept !== (detOf(e.g) < 0)) bad('pairing', `edge ${i}: direction of travel ${kept ? 'kept' : 'reversed'} although det g = ${detOf(e.g)}`);
    if (e.partner !== j) bad('pairing', `edge ${i}: partner is ${e.partner}, but inverse(g) maps the edge onto edge ${j}`);
    if (e.rev !== undefined && e.rev !== !kept) bad('pairing', `edge ${i}: rev flag ${e.rev} but the direction is ${kept ? 'kept' : 'reversed'}`);
    // g really leads out of the tile through this edge: both ends on the line n.x = c, the seed inside, g(seed) outside
    // (an edge shorter than 1e-9 is merged away by buildDomain, which moves the ends of its neighbours by that much)
    for (const q of [P[i], P[nx(i)]]) {
      const off = Math.abs(e.nx * q[0] + e.ny * q[1] - e.c);
      R.lineError = Math.max(R.lineError, off);
      if (off > GLUE_TOL) bad('pairing', `edge ${i}: an end is ${off.toExponential(2)} off the line n.x = c`);
    }
    const gs = act(e.g, [sx, sy]);
    if (!(e.nx * sx + e.ny * sy - e.c < 0) || !(e.nx * gs[0] + e.ny * gs[1] - e.c > 0)) bad('pairing', `edge ${i}: the seed and g(seed) are not on opposite sides of the edge`);
    // kinds and flags
    if ((e.kind === 'mirror') !== isMirror(i)) bad('flags', `edge ${i}: kind '${e.kind}' but g is a ${k.type}`);
    if (e.kind !== 'mirror' && e.kind !== 'cut') bad('flags', `edge ${i}: kind '${e.kind}'`);
    if (!!e.halfTurn !== isHalf(i)) bad('flags', `edge ${i}: halfTurn ${e.halfTurn} but g is a ${k.type}${k.type === 'rotation' ? ' of order ' + k.order : ''}`);
    if (isMirror(i) && !(j === i && kept)) bad('pairing', `edge ${i}: a reflection that does not fix its edge pointwise`);
    if (isHalf(i)) {
      const mid = [(P[i][0] + P[nx(i)][0]) / 2, (P[i][1] + P[nx(i)][1]) / 2];
      if (!(j === i && !kept)) bad('pairing', `edge ${i}: a half-turn that does not flip its own edge`);
      if (Math.hypot(k.center[0] - mid[0], k.center[1] - mid[1]) > 1e-9) bad('pairing', `edge ${i}: the half-turn centre is not the midpoint of the edge`);
    }
    if (!isMirror(i) && !isHalf(i) && j === i) bad('pairing', `edge ${i}: glued to itself by a ${k.type}`);
  }
  if (img.some((m) => !m)) return R;
  for (let i = 0; i < n; i++) {
    const j = img[i].j;
    if (img[j].j !== i) bad('pairing', `edge ${i} lands on edge ${j}, but edge ${j} lands on edge ${img[j].j}`);
    if (isoDistance(invAffine(E[i].g), E[j].g) > 1e-7) bad('pairing', `edge ${i}: its partner ${j} does not carry inverse(g)`);
  }
  // glue classes
  {
    const pairs = new Map();
    let want = 0;
    for (let i = 0; i < n; i++) {
      const e = E[i], j = img[i].j;
      if (isMirror(i)) { if (e.cls !== -1) bad('flags', `mirror edge ${i} has cls ${e.cls}`); continue; }
      if (j >= i) want++;
      if (!(Number.isInteger(e.cls) && e.cls >= 0 && e.cls < domain.classes)) bad('flags', `cut edge ${i} has cls ${e.cls} (classes = ${domain.classes})`);
      if (E[j].cls !== e.cls) bad('flags', `edges ${i} and ${j} are glued but have classes ${e.cls} and ${E[j].cls}`);
      const key = Math.min(i, j);
      if (pairs.has(e.cls) && pairs.get(e.cls) !== key) bad('flags', `class ${e.cls} is used by two different glued pairs`);
      pairs.set(e.cls, key);
    }
    if (domain.classes !== want) bad('flags', `classes = ${domain.classes}, but there are ${want} glued pairs (half-turn edges included)`);
  }
  if (R.problems.some((p) => p.check === 'pairing')) return R;

  // ---- 3. vertex cycles. A walk stands at vertex v about to cross edge e (one of the two edges at v); crossing puts it
  // on the partner edge at the glued vertex, and it goes on through the OTHER edge there. A mirror edge cannot be crossed.
  const cross = (v, e) => [v === e ? img[e].va : img[e].vb, img[e].j];
  const otherEdge = (v, e) => (e === v ? pv(v) : e === pv(v) ? v : -1);
  const walk = (v0, e0) => {
    const members = [v0];
    let v = v0, e = e0;
    for (let step = 0; step <= 4 * n + 8; step++) {
      if (isMirror(e)) return { members, stop: 'mirror', edge: e, vertex: v };
      const [v2, e2] = cross(v, e);
      const e3 = otherEdge(v2, e2);
      if (e3 < 0) return { members, stop: 'broken' };
      if (v2 === v0 && e3 === e0) return { members, stop: 'closed' };
      members.push(v2);
      v = v2; e = e3;
    }
    return { members, stop: 'runaway' };
  };
  const classOf = new Array(n).fill(-1);
  const addClass = (C) => {
    for (const v of C.members) {
      if (classOf[v] >= 0) bad('cycle', `vertex ${v} occurs twice in the vertex cycles`);
      classOf[v] = R.classes.length;
    }
    R.classes.push(C);
  };
  // cycles that end on mirrors: start at a vertex of a mirror edge and walk away from that edge
  for (let v = 0; v < n; v++) {
    if (classOf[v] >= 0) continue;
    const ein = pv(v), eout = v;
    let from, w;
    if (isMirror(ein)) { from = ein; w = walk(v, eout); } else if (isMirror(eout)) { from = eout; w = walk(v, ein); } else continue;
    if (w.stop !== 'mirror') { bad('cycle', `the vertex cycle from vertex ${v} on mirror edge ${from} ${w.stop === 'closed' ? 'closes without reaching a second mirror' : 'is ' + w.stop}`); continue; }
    addClass({ type: 'mirror', members: w.members, mids: [], ends: [from, w.edge] });
  }
  // interior cycles
  for (let v = 0; v < n; v++) {
    if (classOf[v] >= 0) continue;
    const w = walk(v, v);
    if (w.stop !== 'closed') { bad('cycle', `the vertex cycle from vertex ${v} ${w.stop === 'mirror' ? 'runs into mirror edge ' + w.edge : 'is ' + w.stop}`); continue; }
    addClass({ type: 'interior', members: w.members, mids: [], ends: null });
    // walking the other way round must give the same cycle
    const back = walk(v, pv(v));
    if (back.stop !== 'closed' || [...back.members].sort().join() !== [...w.members].sort().join()) bad('cycle', `the vertex cycle of vertex ${v} differs when walked the other way`);
  }
  // the midpoint of a half-turn edge: a vertex of the folded edge, alone in its cycle, with angle pi
  for (let i = 0; i < n; i++) if (isHalf(i)) R.classes.push({ type: 'interior', members: [], mids: [i], ends: null });
  if (classOf.includes(-1)) { bad('cycle', `vertices ${classOf.map((c, v) => (c < 0 ? v : -1)).filter((v) => v >= 0)} are in no vertex cycle`); return R; }

  // ---- 3b. the same classes by union-find over the glued edge ends, and (resolved tiles) by the group's orbits
  {
    const uf = Array.from({ length: n }, (_, v) => v);
    const find = (v) => { while (uf[v] !== v) v = uf[v] = uf[uf[v]]; return v; };
    for (let i = 0; i < n; i++) {
      if (isMirror(i)) continue;
      uf[find(i)] = find(img[i].va);
      uf[find(nx(i))] = find(img[i].vb);
    }
    for (let u = 0; u < n; u++) {
      for (let v = u + 1; v < n; v++) {
        const walked = classOf[u] === classOf[v];
        if (walked !== (find(u) === find(v))) bad('cycle', `vertices ${u} and ${v}: the cycle walk and the union of glued ends disagree`);
        if (R.resolved && walked !== sameOrbit(group, P[u], P[v])) bad('orbit', `vertices ${u} and ${v} are ${walked ? '' : 'not '}in one vertex cycle but are ${walked ? 'not ' : ''}in one orbit of the group`);
      }
    }
  }

  // ---- 4. angle sums, orders, stabilisers
  R.expectedCones = [];
  for (const C of R.classes) {
    C.points = C.members.map((v) => P[v]).concat(C.mids.map((i) => [(P[i][0] + P[nx(i)][0]) / 2, (P[i][1] + P[nx(i)][1]) / 2]));
    C.sum = C.members.reduce((s, v) => s + angle[v], 0) + Math.PI * C.mids.length;
    const full = C.type === 'mirror' ? Math.PI : TAU;
    C.order = Math.round(full / C.sum);
    const err = C.order >= 1 ? Math.abs(C.sum - full / C.order) : Infinity;
    R.angleError = Math.max(R.angleError, err);
    C.what = `${C.type === 'mirror' ? 'mirror' : 'interior'} cycle of ${C.mids.length ? 'the midpoint of edge ' + C.mids[0] : 'vertices ' + C.members.join(', ')}`;
    if (!(err <= angleTol)) bad('angle', `${C.what}: angle sum ${C.sum} = ${C.type === 'mirror' ? 'pi' : '2 pi'} / ${(full / C.sum).toFixed(9)}, not ${C.type === 'mirror' ? 'pi' : '2 pi'} / integer`);
    else if (![1, 2, 3, 4, 6].includes(C.order)) bad('angle', `${C.what}: order ${C.order} is not crystallographic`);
    // the group's own verdict on these points: an interior cycle of order n has the cyclic stabiliser of order n,
    // a mirror cycle of order n the dihedral one of order 2n
    for (const p of C.points) {
      if (R.resolved) {
        const S = stabiliser(group, p);
        const want = C.type === 'mirror' ? { order: 2 * C.order, rotations: C.order, mirror: true } : { order: C.order, rotations: C.order, mirror: false };
        if (S.order !== want.order || S.rotations !== want.rotations || S.mirror !== want.mirror) {
          bad('stabiliser', `${C.what} has order ${C.order}, but the stabiliser of (${p[0]}, ${p[1]}) has ${S.order} elements, ${S.rotations} rotations${S.mirror ? ', with reflections' : ''}`);
        }
      }
      if (C.order >= 2) R.expectedCones.push({ x: p[0], y: p[1], order: C.order, onMirror: C.type === 'mirror' });
    }
  }
  // the midpoints of half-turn edges must not be glued to anything else
  if (R.resolved) {
    for (const C of R.classes) {
      if (!C.mids.length) continue;
      for (const D of R.classes) {
        if (D !== C && D.points.some((q) => sameOrbit(group, C.points[0], q))) bad('orbit', `the midpoint of half-turn edge ${C.mids[0]} is in the orbit of another vertex cycle`);
      }
    }
  }

  // ---- 5. the glued surface: V - E + F with one face
  R.V = R.classes.length;
  R.mirrorEdges = 0; R.pairs = 0; R.halfEdges = 0;
  for (let i = 0; i < n; i++) {
    if (isMirror(i)) R.mirrorEdges++;                 // stays an edge of the rim
    else if (isHalf(i)) R.halfEdges++;                // its two halves are glued to each other: one edge
    else if (img[i].j > i) R.pairs++;                 // two edges glued into one
  }
  R.E = R.mirrorEdges + R.pairs + R.halfEdges;
  R.F = 1;
  R.chi = R.V - R.E + R.F;

  // ---- 6. orientability: the surface is orientable exactly when every glued pair reverses the direction of travel
  R.keptPairs = [];
  for (let i = 0; i < n; i++) if (!isMirror(i) && img[i].kept && img[i].j > i) R.keptPairs.push([i, img[i].j]);
  R.orientable = R.keptPairs.length === 0;
  R.reversingElement = E.some((e, i) => !isMirror(i) && detOf(e.g) < 0);

  // ---- 7. mirror boundary components: mirror edges joined end to end through the mirror cycles
  {
    const mc = R.classes.map((C, k) => (C.type === 'mirror' ? k : -1)).filter((k) => k >= 0);
    const uf = new Map(mc.map((k) => [k, k]));
    const find = (k) => { while (uf.get(k) !== k) k = uf.get(k); return k; };
    const degree = new Map(mc.map((k) => [k, 0]));
    for (let i = 0; i < n; i++) {
      if (!isMirror(i)) continue;
      const a = classOf[i], b = classOf[nx(i)];
      if (R.classes[a].type !== 'mirror' || R.classes[b].type !== 'mirror') { bad('rim', `mirror edge ${i} ends in an interior vertex cycle`); continue; }
      degree.set(a, degree.get(a) + 1); degree.set(b, degree.get(b) + 1);
      uf.set(find(a), find(b));
    }
    for (const k of mc) if (degree.get(k) !== 2) bad('rim', `the mirror cycle of vertices ${R.classes[k].members.join(', ')} is met by ${degree.get(k)} mirror-edge ends, not 2`);
    const comps = new Map();
    for (const k of mc) { const r = find(k); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(k); }
    R.rimCorners = [...comps.values()].map((ks) => ks.map((k) => R.classes[k].order).filter((o) => o > 1));
    R.rims = comps.size;
  }
  R.cones = R.classes.filter((C) => C.type === 'interior' && C.order > 1).map((C) => C.order);
  R.corners = R.classes.filter((C) => C.type === 'mirror' && C.order > 1).map((C) => C.order);
  R.symbol = symbolOf(R);
  // the orbifold Euler characteristic of a plane group vanishes
  R.orbChi = R.chi - R.cones.reduce((s, k) => s + (1 - 1 / k), 0) - R.corners.reduce((s, k) => s + (1 - 1 / k) / 2, 0);
  R.ok = true;
  return R;
}

/** Signed distance from a point to the tile in straight coordinates: negative inside, 0 on the boundary. */
function outsideBy(domain, x, y) {
  let worst = -Infinity;
  for (const e of domain.edges) worst = Math.max(worst, e.nx * x + e.ny * y - e.c);
  return worst;
}

/**
 * Domain.conePoints against the cone points and corners of (a).
 * `slack`: a listed centre that is not one of them is tolerated when it lies no further than this outside the tile.
 */
function conePointMismatch(group, domain, R, slack = 0) {
  const out = [], got = domain.conePoints, want = R.expectedCones;
  if (!Array.isArray(got)) return ['conePoints is not an array'];
  const used = new Array(got.length).fill(false);
  for (const w of want) {
    const k = got.findIndex((p, i) => !used[i] && Math.hypot(p.x - w.x, p.y - w.y) < 1e-8);
    if (k < 0) { out.push(`missing: the ${w.onMirror ? 'mirror corner' : 'cone point'} of order ${w.order} at (${w.x}, ${w.y})`); continue; }
    used[k] = true;
    if (got[k].order !== w.order) out.push(`(${w.x}, ${w.y}): order ${got[k].order}, the angle sum says ${w.order}`);
    if (got[k].onMirror !== w.onMirror) out.push(`(${w.x}, ${w.y}): onMirror ${got[k].onMirror}, the vertex cycle ${w.onMirror ? 'ends on mirrors' : 'is interior'}`);
  }
  got.forEach((p, i) => {
    if (used[i]) return;
    const d = outsideBy(domain, p.x, p.y);
    if (d > slack) out.push(`extra: (${p.x}, ${p.y}) order ${p.order} onMirror ${p.onMirror} is listed, but it lies ${d.toExponential(3)} outside the tile, not on its boundary`);
    else if (!(slack > 0)) out.push(`extra: (${p.x}, ${p.y}) order ${p.order} onMirror ${p.onMirror} is listed, but it is no vertex of a cycle of order > 1 and no midpoint of a half-turn edge (or it is listed twice)`);
  });
  for (const p of got) {
    if (!(Number.isFinite(p.x) && Number.isFinite(p.y))) { out.push('non-finite cone point'); continue; }
    const S = stabiliser(group, [p.x, p.y]);
    if (S.rotations !== p.order || S.mirror !== p.onMirror) out.push(`(${p.x}, ${p.y}) order ${p.order} onMirror ${p.onMirror}: the group fixes it by ${S.rotations} rotations${S.mirror ? ' and by reflections' : ''}`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The cases
// ---------------------------------------------------------------------------------------------------------------

const lit = (v) => (v === undefined ? 'undefined' : JSON.stringify(v));
const repro = (group, c, amp = 0) => `buildDomain(BY_ID['${group.id}'], { seed: ${lit(c.seed)}, metric: ${lit(c.metric)}, warp: makeWarp(BY_ID['${group.id}'], ${amp}) })`;

/** A random positive quadratic form averaged over the point group: invariant under every representative. */
function invariantMetric(group, rnd) {
  const th = Math.PI * rnd(), l1 = 0.6 + 1.4 * rnd(), l2 = 0.6 + 1.4 * rnd();
  const c = Math.cos(th), s = Math.sin(th);
  const q = [l1 * c * c + l2 * s * s, (l1 - l2) * c * s, l1 * s * s + l2 * c * c];
  let m11 = 0, m12 = 0, m22 = 0;
  for (const r of group.reps) {     // L^T Q L
    m11 += r.a * (q[0] * r.a + q[1] * r.c) + r.c * (q[1] * r.a + q[2] * r.c);
    m12 += r.a * (q[0] * r.b + q[1] * r.d) + r.c * (q[1] * r.b + q[2] * r.d);
    m22 += r.b * (q[0] * r.b + q[1] * r.d) + r.d * (q[1] * r.b + q[2] * r.d);
  }
  const k = group.reps.length;
  return [m11 / k, m12 / k, m22 / k];
}

const DIRS = [[0.6, 0.8], [-0.8, 0.6], [1, 0]];
const NEAR_OFFSETS = [1e-3, 1e-5];                              // a hair off: every feature is still far above any tolerance
const HAIR_OFFSETS = [1e-7, 1e-8, 1e-9, 1e-10, 1e-12];    // closer than the tolerances inside domain.js

/**
 * main: every preset and N_SEEDS random seeds in the plane view's window.
 * extended: far-away seeds, other invariant metrics, the special loci and seeds 1e-3 / 1e-5 off them and off the presets.
 * hair: seeds 1e-7 ... 1e-12 off the presets and the special loci.
 */
function casesOf(group) {
  const main = [], extended = [], hair = [];
  group.presets.forEach((p, i) => main.push({ label: `preset ${i} (${p.name})`, seed: p.seed, metric: p.metric, preset: i }));
  const rnd = rngFrom(`verify-topology|${group.id}|seeds`);
  for (let k = 0; k < N_SEEDS; k++) {
    const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
    main.push({ label: `random seed ${k}`, seed, metric: group.presets[k % group.presets.length].metric, random: k });
  }
  const rx = rngFrom(`verify-topology|${group.id}|extended`);
  // far from the origin (the plane view keeps the seed in its window, but nothing in buildDomain says it must be)
  for (let k = 0; k < 6; k++) {
    const far = k < 3 ? 12 : 400;
    extended.push({ label: `far seed ${k}`, seed: [group.center[0] + (2 * rx() - 1) * far, group.center[1] + (2 * rx() - 1) * far], metric: undefined });
  }
  // other invariant metrics (a general form for o and 2222, an axis-aligned one for the rectangular groups, a multiple
  // of the Euclidean one for the rest)
  for (let k = 0; k < 8; k++) {
    extended.push({
      label: `metric ${k}`, metric: invariantMetric(group, rx), wantsMetric: true,
      seed: [group.center[0] + (2 * rx() - 1) * group.viewHalf, group.center[1] + (2 * rx() - 1) * group.viewHalf],
    });
  }
  // the special loci: lattice points, half-lattice points, the kaleidoscope cell's corners, side midpoints and a
  // point on each side, the cell's centre
  const special = [[0, 0], group.center, [group.e1[0] / 2, group.e1[1] / 2], [group.e2[0] / 2, group.e2[1] / 2], [(group.e1[0] + group.e2[0]) / 3, (group.e1[1] + group.e2[1]) / 3]];
  if (group.kaleido) {
    const T = group.kaleido.cell;
    T.forEach((p, i) => { const q = T[(i + 1) % T.length]; special.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], [p[0] + 0.3 * (q[0] - p[0]), p[1] + 0.3 * (q[1] - p[1])]); });
    special.push([T.reduce((s, p) => s + p[0], 0) / T.length, T.reduce((s, p) => s + p[1], 0) / T.length]);
  }
  const bases = group.presets.map((p, i) => ({ name: `preset ${i}`, at: p.seed, metric: p.metric }))
    .concat(special.map((p, k) => ({ name: `special point ${k}`, at: p, metric: undefined })));
  for (const b of bases) {
    if (!b.name.startsWith('preset')) extended.push({ label: b.name, seed: [b.at[0], b.at[1]], metric: b.metric });
    for (const [list, offsets] of [[extended, NEAR_OFFSETS], [hair, HAIR_OFFSETS]]) {
      for (const off of offsets) {
        DIRS.forEach(([dx, dy], d) => list.push({ label: `${b.name} + ${off} * (${dx}, ${dy})`, seed: [b.at[0] + off * dx, b.at[1] + off * dy], metric: b.metric, off, dir: d }));
      }
    }
  }
  return { main, extended, hair };
}

const warpCache = new Map();
function warpOf(group, amp) {
  const key = group.id + '|' + amp;
  if (!warpCache.has(key)) warpCache.set(key, makeWarp(group, amp));
  return warpCache.get(key);
}

const built = new Map();
/** All cases of a group, each with its tile (amp 0) glued up. Built once. */
function resultsOf(group) {
  if (built.has(group.id)) return built.get(group.id);
  const lists = casesOf(group);
  const all = [];
  for (const kind of ['main', 'extended', 'hair']) {
    for (const c of lists[kind]) {
      let domain = null, R;
      try {
        domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp: warpOf(group, 0) });
        R = glueUp(group, domain);
      } catch (err) {
        R = { problems: [{ check: 'crash', msg: `threw ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}` }], classes: [] };
      }
      all.push({ ...c, kind, domain, R, repro: repro(group, c) });
    }
  }
  built.set(group.id, all);
  return all;
}

/** Collect the failures of `pick(case) -> [messages]` over a group's cases and assert there are none. */
function expectClean(group, kinds, pick) {
  const lines = [];
  let cases = 0;
  for (const c of resultsOf(group)) {
    if (!kinds.includes(c.kind)) continue;
    cases++;
    for (const m of pick(c)) lines.push(`${group.id} ${c.label}: ${m}\n      repro: ${c.repro}`);
  }
  assert.ok(cases > 0, `${group.id}: no cases`);
  assert.equal(lines.length, 0, `${lines.length} failure(s) in ${cases} cases of ${group.id}:\n    ${lines.slice(0, 12).join('\n    ')}${lines.length > 12 ? `\n    ... and ${lines.length - 12} more` : ''}`);
}

const problemsOf = (c, checks) => c.R.problems.filter((p) => checks.includes(p.check) || p.check === 'crash').map((p) => `[${p.check}] ${p.msg}`);
/** A measurement can only be judged when the gluing itself went through; a broken gluing is reported by the gluing test. */
const measured = (c, fn) => (c.R.ok ? fn(c.R) : ['the tile could not be glued up (see the gluing test)']);

async function perGroup(t, fn) {
  for (const group of GROUPS) await t.test(group.id, () => fn(group));
}

// ---------------------------------------------------------------------------------------------------------------
// Tests: the glued tile
// ---------------------------------------------------------------------------------------------------------------

test('expected values: the hand-written table agrees with the orbifold symbols, and every symbol costs 2', () => {
  assert.equal(GROUPS.length, 17);
  assert.deepEqual(GROUPS.map((g) => g.id).sort(), Object.keys(EXPECT).sort());
  for (const [id, want] of Object.entries(EXPECT)) {
    const s = parseSymbol(id);
    assert.ok(sameList(s.cones, want.cones) && sameList(s.corners, want.corners), `${id}: cone points / corners`);
    assert.equal(s.chi, want.chi, `${id}: Euler characteristic`);
    assert.equal(s.orientable, want.orientable, `${id}: orientability`);
    assert.equal(s.rims, want.rims, `${id}: rims`);
    assert.ok(Math.abs(s.cost - 2) < 1e-12, `${id}: cost ${s.cost}`);
    assert.equal(want.orientable, !id.includes('x'), id);
    assert.equal(want.rims, id.split('*').length - 1, id);
    // and back: the symbol composed from the measured quantities is the id
    const rimCorners = id.split('*').slice(1).map((part) => [...part].filter((ch) => ch >= '2' && ch <= '9').map(Number));
    assert.equal(symbolOf({ chi: want.chi, orientable: want.orientable, rimCorners, cones: want.cones }), id);
    // the crystallographic name and the caption the page shows belong to the same orbifold
    assert.equal(BY_ID[id].hm, want.hm, `${id}: Hermann-Mauguin name`);
    assert.ok(BY_ID[id].topology.startsWith(want.surface), `${id}: caption "${BY_ID[id].topology}" should start with "${want.surface}"`);
  }
});

test('the sweep: every preset and at least 25 random seeds per group, all tiles built', () => {
  for (const group of GROUPS) {
    const all = resultsOf(group);
    const main = all.filter((c) => c.kind === 'main');
    assert.equal(main.filter((c) => c.preset !== undefined).length, group.presets.length, group.id);
    assert.ok(main.filter((c) => c.random !== undefined).length >= 25, group.id);
    for (const c of all) assert.ok(c.domain, `${group.id} ${c.label}: buildDomain threw: ${c.R.problems[0] && c.R.problems[0].msg}\n      repro: ${c.repro}`);
  }
});

test('gluing: inverse(g) maps every edge onto an edge of the tile; partner, kind, halfTurn, cls and classes say the same', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['main'], (c) => {
    const out = problemsOf(c, ['polygon', 'pairing', 'flags']);
    if (!c.domain) return out;
    // one tile per group element: its area is the lattice cell's divided by the order of the point group
    const P = c.domain.poly;
    let area = 0;
    for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; area += (p[0] * q[1] - p[1] * q[0]) / 2; }
    const want = Math.abs(group.e1[0] * group.e2[1] - group.e1[1] * group.e2[0]) / group.reps.length;
    if (Math.abs(area - want) > 1e-9 || Math.abs(c.domain.area - want) > 1e-9) out.push(`the polygon has area ${area} (domain.area ${c.domain.area}), one tile of the group has ${want}`);
    return out;
  }));
});

test('(a) vertex cycles close up; the walk, the union of glued ends and the group orbits give the same classes', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['main'], (c) => problemsOf(c, ['cycle', 'orbit'])));
});

test('(a) angle sums: 2 pi / n around every interior cycle, pi / n at every mirror cycle, n = the order of the stabiliser', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['main'], (c) => problemsOf(c, ['angle', 'stabiliser'])));
});

test('(a) cone points and mirror corners are the digits of the orbifold symbol', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['main'], (c) => measured(c, (R) => {
    const want = EXPECT[group.id], out = [];
    if (!sameList(R.cones, want.cones)) out.push(`cone points [${desc(R.cones)}], expected [${want.cones}]`);
    if (!sameList(R.corners, want.corners)) out.push(`mirror corners [${desc(R.corners)}], expected [${want.corners}]`);
    if (Math.abs(R.orbChi) > 1e-12) out.push(`orbifold Euler characteristic ${R.orbChi}, expected 0`);
    return out;
  })));
});

test('(b) Euler characteristic V - E + F of the glued surface', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['main'], (c) => measured(c, (R) => (R.chi === EXPECT[group.id].chi ? [] :
    [`V - E + F = ${R.V} - ${R.E} + ${R.F} = ${R.chi}, expected ${EXPECT[group.id].chi} (${EXPECT[group.id].surface})`]))));
});

test('(c) orientability: a direction-keeping glued pair (an orientation-reversing element) exists iff the symbol contains x', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['main'], (c) => measured(c, (R) => {
    const out = [];
    if (R.orientable !== EXPECT[group.id].orientable) out.push(`glued surface is ${R.orientable ? 'orientable' : 'non-orientable'} (direction-keeping pairs: ${JSON.stringify(R.keptPairs)})`);
    if (R.reversingElement !== group.id.includes('x')) out.push(`an orientation-reversing glue element ${R.reversingElement ? 'exists' : 'does not exist'}`);
    if (R.reversingElement === R.orientable) out.push('the determinants of the glue elements and the directions of the glued pairs disagree');
    return out;
  })));
});

test('(d) mirror boundary components = number of * in the symbol', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['main'], (c) => {
    const out = problemsOf(c, ['rim']);
    if (c.R.ok && c.R.rims !== EXPECT[group.id].rims) out.push(`${c.R.rims} mirror boundary component(s), expected ${EXPECT[group.id].rims}`);
    if (c.R.ok && (c.R.mirrorEdges > 0) !== group.id.includes('*')) out.push(`${c.R.mirrorEdges} mirror edges`);
    return out;
  }));
});

test('the glued tile is the orbifold named by the group id', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['main'], (c) => measured(c, (R) => (R.symbol === group.id ? [] : [`glues up to ${R.symbol}`]))));
});

test('Domain.conePoints = the cone points and mirror corners found by the vertex cycles (positions, orders, onMirror)', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['main'], (c) => measured(c, (R) => conePointMismatch(group, c.domain, R))));
});

test('wavy cut (amp 1): same polygon and gluing; the corner angles of the warped tile still add up per vertex cycle; cone points stay put', async (t) => {
  await perGroup(t, (group) => {
    const W = warpOf(group, 1);
    const J = [0, 0, 0, 0], a = [0, 0], b = [0, 0], o = [0, 0];
    expectClean(group, ['main'], (c) => measured(c, (R) => {
      const out = [];
      const d1 = buildDomain(group, { seed: c.seed, metric: c.metric, warp: W });
      const P = d1.poly, n = P.length;
      // the straight polygon and its gluing do not depend on the warp
      try {
        assert.deepEqual(d1.poly, c.domain.poly);
        assert.deepEqual(d1.edges.map((e) => [e.kind, e.partner, e.cls, e.halfTurn, e.g]), c.domain.edges.map((e) => [e.kind, e.partner, e.cls, e.halfTurn, e.g]));
        assert.deepEqual(d1.conePoints, c.domain.conePoints);
      } catch (err) { out.push('poly / edges / conePoints differ between amp 0 and amp 1'); return out; }
      // corner angle of the warped tile at vertex v: between the images, under D psi at the vertex, of the two edge directions
      const warped = [];
      for (let v = 0; v < n; v++) {
        const p = P[v], q = P[(v + 1) % n], r = P[(v + n - 1) % n];
        W.jac(p[0], p[1], J);
        const ux = J[0] * (q[0] - p[0]) + J[1] * (q[1] - p[1]), uy = J[2] * (q[0] - p[0]) + J[3] * (q[1] - p[1]);
        const wx = J[0] * (r[0] - p[0]) + J[1] * (r[1] - p[1]), wy = J[2] * (r[0] - p[0]) + J[3] * (r[1] - p[1]);
        warped.push(Math.atan2(ux * wy - uy * wx, ux * wx + uy * wy));
        // the same angle from the warped edges themselves (one-sided second differences of the boundary curve)
        const h = 1e-4;
        const onEdge = (i, u, out) => { const e0 = P[i], e1 = P[(i + 1) % n]; return W.fwd((1 - u) * e0[0] + u * e1[0], (1 - u) * e0[1] + u * e1[1], out); };
        const tangent = (i, t0, sgn) => {
          onEdge(i, t0, o); onEdge(i, t0 + sgn * h, a); onEdge(i, t0 + 2 * sgn * h, b);
          return [(-3 * o[0] + 4 * a[0] - b[0]) / 2, (-3 * o[1] + 4 * a[1] - b[1]) / 2];
        };
        const tu = tangent(v, 0, 1), tw = tangent((v + n - 1) % n, 1, -1);
        const fd = Math.atan2(tu[0] * tw[1] - tu[1] * tw[0], tu[0] * tw[0] + tu[1] * tw[1]);
        if (Math.abs(fd - warped[v]) > 1e-5) out.push(`vertex ${v}: corner angle of the warped tile ${warped[v]} from warp.jac, ${fd} from the boundary curve`);
      }
      for (const C of R.classes) {
        if (!C.members.length) continue;
        const sum = C.members.reduce((s, v) => s + warped[v], 0);
        const full = C.type === 'mirror' ? Math.PI : TAU;
        if (Math.abs(sum - full / C.order) > 1e-8) out.push(`cycle of vertices ${C.members.join(', ')}: warped corner angles sum to ${sum}, straight ones to ${C.sum} (= ${C.type === 'mirror' ? 'pi' : '2 pi'} / ${C.order})`);
      }
      // the warped tile is still a tile, so its outline is a closed counter-clockwise curve that encloses the same area
      {
        const size = Math.sqrt(group.domainArea), O = d1.outline(size / 160);
        let area = 0, gap = 0;
        if (O.length !== n) out.push(`outline() has ${O.length} pieces for ${n} edges`);
        else {
          for (let i = 0; i < n; i++) {
            const q = O[i].pts, k = q.length / 2, r = O[(i + 1) % n].pts;
            if (O[i].edge !== i) out.push(`outline()[${i}].edge is ${O[i].edge}`);
            for (let j = 0; j + 1 < k; j++) area += (q[2 * j] * q[2 * j + 3] - q[2 * j + 1] * q[2 * j + 2]) / 2;
            gap = Math.max(gap, Math.hypot(q[2 * k - 2] - r[0], q[2 * k - 1] - r[1]));
            W.fwd(P[i][0], P[i][1], o);
            gap = Math.max(gap, Math.hypot(q[0] - o[0], q[1] - o[1]));
          }
          if (gap > 2e-6 * Math.max(1, size)) out.push(`the outline is not closed corner to corner (gap ${gap.toExponential(2)})`);
          if (Math.abs(area - group.domainArea) > 3e-4 * group.domainArea) out.push(`the outline of the warped tile encloses ${area}, a tile has area ${group.domainArea}`);
        }
      }
      // cone points and corners are fixed by the warp ("actual = straight coordinates")
      for (const p of R.expectedCones) {
        W.fwd(p.x, p.y, o);
        if (Math.hypot(o[0] - p.x, o[1] - p.y) > 1e-10) out.push(`the warp moves the ${p.onMirror ? 'corner' : 'cone point'} (${p.x}, ${p.y}) by ${Math.hypot(o[0] - p.x, o[1] - p.y)}`);
      }
      return out.map((m) => m + `\n      (amp 1: ${repro(group, c, 1)})`);
    }));
  });
});

test('extended sweep: far-away seeds, the special loci, seeds 1e-3 and 1e-5 off them and off the presets, other invariant metrics — same orbifold, same cone points', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['extended'], (c) => {
    const out = c.R.problems.map((p) => `[${p.check}] ${p.msg}`);
    if (!c.R.ok) return out.length ? out : ['the tile could not be glued up'];
    const R = c.R, want = EXPECT[group.id];
    if (R.symbol !== group.id) out.push(`glues up to ${R.symbol} (chi ${R.chi}, cones [${R.cones}], corners [${R.corners}], ${R.rims} rims)`);
    if (R.chi !== want.chi) out.push(`Euler characteristic ${R.chi}, expected ${want.chi}`);
    out.push(...conePointMismatch(group, c.domain, R));
    if (Math.abs(c.domain.area - group.domainArea) > 1e-7) out.push(`area ${c.domain.area}, expected ${group.domainArea}`);
    if (c.wantsMetric && !c.domain.metric.every((q, i) => Math.abs(q - c.metric[i]) < 1e-12)) out.push(`the invariant metric [${c.metric}] was not used (domain.metric = [${c.domain.metric}])`);
    return out;
  }));
});

test('seeds 1e-7 ... 1e-12 off the presets and the special loci: the tile still glues up to the right orbifold and no cone point is missing', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['hair'], (c) => {
    // the orbit / stabiliser / exact-angle cross-checks are switched off by glueUp for tiles with edges below 1e-6
    const out = c.R.problems.filter((p) => p.check !== 'angle').map((p) => `[${p.check}] ${p.msg}`);
    if (!c.R.ok) return out.length ? out : ['the tile could not be glued up'];
    const R = c.R;
    if (R.symbol !== group.id) out.push(`glues up to ${R.symbol} (chi ${R.chi}, cones [${R.cones}], corners [${R.corners}], ${R.rims} rims)`);
    if (Math.abs(c.domain.area - group.domainArea) > 1e-7) out.push(`area ${c.domain.area}, expected ${group.domainArea}`);
    // a rotation centre up to 1e-7 outside the tile is tolerated here; the next test is the strict one
    out.push(...conePointMismatch(group, c.domain, R, 1.5e-7));
    return out;
  }));
});

/** The set of elements that bound the tile: it changes exactly where an edge of the tile appears or vanishes. */
function shapeOf(group, seed, metric) {
  const d = buildDomain(group, { seed, metric, warp: warpOf(group, 0) });
  return d.poly.length + '|' + d.edges.map((e) => [e.g.a, e.g.b, e.g.c, e.g.tx, e.g.ty].map((v) => v.toFixed(6)).join(',')).sort().join('|');
}

const bisectStats = { found: 0, sidesChange: 0, tiles: 0, shortest: Infinity };

test('edges at the point of vanishing: seeds bisected to the last bit onto a change of the tile\'s shape still glue up to the right orbifold', async (t) => {
  await perGroup(t, (group) => {
    const rnd = rngFrom(`verify-topology|${group.id}|bisect`), lines = [];
    const metric = group.presets[0].metric;
    for (let k = 0; k < BISECTIONS; k++) {
      // two seeds a fraction of the window apart; skip the pair if the tile has the same shape at both
      const A = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
      const B = [A[0] + (2 * rnd() - 1) * 0.5 * group.viewHalf, A[1] + (2 * rnd() - 1) * 0.5 * group.viewHalf];
      const at = (u) => [A[0] + u * (B[0] - A[0]), A[1] + u * (B[1] - A[1])];
      const s0 = shapeOf(group, A, metric);
      if (shapeOf(group, B, metric) === s0) continue;
      let lo = 0, hi = 1;
      for (let it = 0; it < 90; it++) {
        const mid = (lo + hi) / 2;
        if (mid === lo || mid === hi) break;
        if (shapeOf(group, at(mid), metric) === s0) lo = mid; else hi = mid;
      }
      bisectStats.found++;
      if (shapeOf(group, at(lo), metric).split('|')[0] !== shapeOf(group, at(hi), metric).split('|')[0]) bisectStats.sidesChange++;
      // the two seeds on either side of the change, and a few floats and a few 1e-12 ... 1e-8 around them
      const us = new Set([lo, hi]);
      for (const j of [1, 2, 3, 5, 9]) { us.add(lo - j * 2 ** -53); us.add(hi + j * 2 ** -53); }
      for (const e of [1e-13, 1e-12, 1e-11, 1e-10, 3e-10, 1e-9, 3e-9, 1e-8, 1e-7]) { us.add(lo - e); us.add(hi + e); }
      for (const u of us) {
        const c = { seed: at(u), metric };
        const where = `${group.id} bisection ${k} at ${u}`;
        const how = `\n      repro: ${repro(group, c)}`;
        let d, R;
        try { d = buildDomain(group, { seed: c.seed, metric, warp: warpOf(group, 0) }); R = glueUp(group, d); } catch (err) { lines.push(`${where}: threw ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}${how}`); continue; }
        bisectStats.tiles++;
        bisectStats.shortest = Math.min(bisectStats.shortest, R.minEdge);
        const out = R.problems.filter((q) => q.check !== 'angle').map((q) => `[${q.check}] ${q.msg}`);
        if (R.ok) {
          if (R.symbol !== group.id) out.push(`glues up to ${R.symbol} (chi ${R.chi}, cones [${R.cones}], corners [${R.corners}], ${R.rims} rims)`);
          out.push(...conePointMismatch(group, d, R, 1.5e-7));
        } else if (!out.length) out.push('the tile could not be glued up');
        if (Math.abs(d.area - group.domainArea) > 1e-7) out.push(`area ${d.area}, expected ${group.domainArea}`);
        for (const msg of out) lines.push(`${where}: ${msg}${how}`);
      }
    }
    assert.equal(lines.length, 0, `${lines.length} failure(s) for ${group.id}:\n    ${lines.slice(0, 10).join('\n    ')}${lines.length > 10 ? `\n    ... and ${lines.length - 10} more` : ''}`);
  });
  t.diagnostic(`bisections: ${bisectStats.found} changes of shape located (${bisectStats.sidesChange} change the number of sides), ${bisectStats.tiles} tiles glued around them, shortest edge met ${bisectStats.shortest.toExponential(2)}`);
  assert.ok(bisectStats.found >= 20 && bisectStats.sidesChange >= 5, JSON.stringify(bisectStats));
});

test('Domain.conePoints lists only rotation centres ON the tile (within 1e-8), also for seeds a hair off a degenerate position', async (t) => {
  await perGroup(t, (group) => expectClean(group, ['main', 'extended', 'hair'], (c) => {
    if (!c.domain) return [];
    const out = [];
    for (const p of c.domain.conePoints) {
      const d = outsideBy(c.domain, p.x, p.y);
      if (Math.abs(d) > 1e-8) out.push(`conePoints lists (${p.x}, ${p.y}) order ${p.order}, which lies ${d.toExponential(3)} ${d > 0 ? 'outside' : 'inside'} the tile (domain.contains(x, y, 1e-8) is ${c.domain.contains(p.x, p.y, 1e-8)})`);
    }
    return out;
  }));
});

test('accuracy of the main sweep: glued ends meet to 1e-9, angle sums are exact to 1e-9, every tile is resolved', (t) => {
  let glue = 0, ang = 0, minEdge = Infinity, tiles = 0, unresolved = 0;
  for (const group of GROUPS) {
    for (const c of resultsOf(group)) {
      if (!c.R.ok || c.kind !== 'main') continue;
      tiles++;
      glue = Math.max(glue, c.R.glueError, c.R.lineError);
      minEdge = Math.min(minEdge, c.R.minEdge);
      if (!c.R.resolved) unresolved++;                           // the orbit and stabiliser cross-checks were skipped for it
      if (c.R.minEdge > 1e-4) ang = Math.max(ang, c.R.angleError);  // an angle is as exact as the positions over the shortest edge
    }
  }
  const count = (kind) => GROUPS.reduce((s, g) => s + resultsOf(g).filter((c) => c.kind === kind).length, 0);
  t.diagnostic(`tiles glued: ${tiles} main (${N_SEEDS} random seeds per group), ${count('extended')} extended, ${count('hair')} a hair off degenerate; largest glue error ${glue.toExponential(2)}, largest angle-sum error ${ang.toExponential(2)}, shortest edge ${minEdge.toExponential(2)}, ${unresolved} unresolved`);
  assert.ok(tiles >= 17 * 26);
  assert.ok(glue < 1e-9, `largest distance between inverse(g)(edge end) and the vertex it is glued to: ${glue}`);
  assert.ok(ang < 1e-9, `largest angle-sum error: ${ang}`);
  // with the default 25 seeds every tile is resolved; a sweep of thousands may meet a tile with an edge below 1e-6
  assert.ok(unresolved <= tiles / 1000, `${unresolved} of ${tiles} tiles of the main sweep have an edge shorter than 1e-6 (shortest: ${minEdge})`);
});

// ---------------------------------------------------------------------------------------------------------------
// Tests: the mesh as a cell complex
// ---------------------------------------------------------------------------------------------------------------

/**
 * The triangle mesh of a tile must be a disc (edge-manifold, consistently oriented, one rim, V - E + F = 1) whose rim
 * is the tile's boundary; its pieces must be discs that form a tree, any two neighbours being mirror images in the
 * crease between them; and the reflections in the hinges, composed from the root, must carry every piece's
 * kaleidoscope cell onto the root's (that is what a hinge fold by pi does).
 */
function meshProblems(group, domain, mesh, amp) {
  const out = [];
  const { xy, tri } = mesh;
  const size = Math.sqrt(group.domainArea);
  const n = xy.length / 2, m = tri.length / 3, cells = mesh.cells, NP = cells.length;
  const pieceOf = mesh.triCell;
  if (mesh.n !== n) out.push(`mesh.n = ${mesh.n} but xy holds ${n} vertices`);
  if (!pieceOf || pieceOf.length !== m) { out.push('mesh.triCell (the piece of every triangle) is missing'); return { out, pieces: NP, triangles: m }; }
  const pt = (v) => [xy[2 * v], xy[2 * v + 1]];

  // ---- edges of the complex
  const edges = new Map();       // lo * n + hi -> { lo, hi, tris, fwd, back }
  const used = new Uint8Array(n);
  let area = 0, inverted = 0;
  for (let t = 0; t < m; t++) {
    const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
    if (a === b || b === c || c === a || Math.max(a, b, c) >= n) { out.push(`triangle ${t} has vertices ${a}, ${b}, ${c}`); continue; }
    if (pieceOf[t] >= NP) out.push(`triangle ${t} belongs to piece ${pieceOf[t]} of ${NP}`);
    used[a] = used[b] = used[c] = 1;
    const ar = ((xy[2 * b] - xy[2 * a]) * (xy[2 * c + 1] - xy[2 * a + 1]) - (xy[2 * b + 1] - xy[2 * a + 1]) * (xy[2 * c] - xy[2 * a])) / 2;
    area += ar;
    // clockwise beyond what Float32 rounding of a sliver's corners can do (xy is Float32: about 1e-7 at these coordinates)
    const longest = Math.max(Math.hypot(xy[2 * b] - xy[2 * a], xy[2 * b + 1] - xy[2 * a + 1]), Math.hypot(xy[2 * c] - xy[2 * b], xy[2 * c + 1] - xy[2 * b + 1]), Math.hypot(xy[2 * a] - xy[2 * c], xy[2 * a + 1] - xy[2 * c + 1]));
    if (2 * ar < -1e-6 * longest) inverted++;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const lo = Math.min(u, v), hi = Math.max(u, v), key = lo * n + hi;
      let e = edges.get(key);
      if (!e) { e = { lo, hi, tris: [], fwd: 0, back: 0 }; edges.set(key, e); }
      e.tris.push(t);
      if (u === lo) e.fwd++; else e.back++;
    }
  }
  if (inverted) out.push(`${inverted} clockwise triangles`);
  let V = 0;
  for (let v = 0; v < n; v++) V += used[v];
  if (V !== n) out.push(`${n - V} of the ${n} vertices are used by no triangle`);

  // ---- manifold, oriented, connected, one rim, a disc
  const uf = Int32Array.from({ length: m }, (_, t) => t);
  const find = (t) => { while (uf[t] !== t) t = uf[t] = uf[uf[t]]; return t; };
  const rimNext = new Map(), rimPrev = new Map();
  let rimEdges = 0, nonManifold = 0, misoriented = 0, pinched = 0;
  for (const e of edges.values()) {
    if (e.tris.length === 2) {
      if (e.fwd !== 1 || e.back !== 1) misoriented++;
      uf[find(e.tris[0])] = find(e.tris[1]);
    } else if (e.tris.length === 1) {
      rimEdges++;
      const [u, v] = e.fwd ? [e.lo, e.hi] : [e.hi, e.lo];     // direction of travel in its triangle: counter-clockwise round the mesh
      if (rimNext.has(u) || rimPrev.has(v)) pinched++;
      rimNext.set(u, v); rimPrev.set(v, u);
    } else nonManifold++;
  }
  if (nonManifold) out.push(`${nonManifold} edges are shared by more than two triangles`);
  if (misoriented) out.push(`${misoriented} interior edges are run in the same direction by both their triangles`);
  if (pinched) out.push(`the rim passes ${pinched} times through a vertex it has already visited (pinched mesh)`);
  let comps = 0;
  for (let t = 0; t < m; t++) if (find(t) === t) comps++;
  if (comps !== 1) out.push(`the mesh has ${comps} connected components`);
  const chi = V - edges.size + m;
  if (chi !== 1) out.push(`Euler characteristic of the mesh V - E + F = ${V} - ${edges.size} + ${m} = ${chi}, a disc has 1`);
  let loops = 0, rimLen = 0, rimArea = 0;
  {
    const seen = new Set();
    for (const start of rimNext.keys()) {
      if (seen.has(start)) continue;
      loops++;
      let v = start;
      for (let guard = 0; guard <= rimEdges && !seen.has(v); guard++) {
        seen.add(v);
        const w = rimNext.get(v);
        if (w === undefined) { out.push(`the rim breaks off at vertex ${v}`); break; }
        const p = pt(v), q = pt(w);
        rimLen += Math.hypot(q[0] - p[0], q[1] - p[1]);
        rimArea += (p[0] * q[1] - p[1] * q[0]) / 2;
        v = w;
      }
    }
  }
  if (loops !== 1) out.push(`the rim of the mesh consists of ${loops} loops`);
  // the rim is a simple polygon: no rim vertex lies on a rim edge it is not an end of. (Where it does, two triangles
  // that share an edge geometrically were cut at different points of it: a T-junction, i.e. a slit of zero width.)
  {
    const rv = [...rimNext.keys()];
    let tj = 0, first = '';
    for (const [u, w] of rimNext) {
      const ax = xy[2 * u], ay = xy[2 * u + 1], dx = xy[2 * w] - ax, dy = xy[2 * w + 1] - ay, l2 = dx * dx + dy * dy;
      if (!(l2 > 1e-24)) continue;
      const len = Math.sqrt(l2), tol = 4e-7 * Math.max(1, Math.abs(ax), Math.abs(ay));      // Float32 coordinates
      for (const z of rv) {
        if (z === u || z === w) continue;
        const px = xy[2 * z] - ax, py = xy[2 * z + 1] - ay, along = (px * dx + py * dy) / len;
        if (along <= 20 * tol || along >= len - 20 * tol) continue;
        if (Math.abs(px * dy - py * dx) / len > tol) continue;
        if (!tj++) first = `rim vertex ${z} (${xy[2 * z]}, ${xy[2 * z + 1]}) lies on the rim edge ${u} -> ${w} [(${ax}, ${ay}) -> (${xy[2 * w]}, ${xy[2 * w + 1]})], ${along.toExponential(2)} from its start`;
      }
    }
    if (tj) out.push(`the rim of the mesh is not a simple polygon: ${tj} T-junction(s) / slit(s); ${first}`);
    // ... and no two rim edges cross. (All triangles counter-clockwise + a simple rim = the mesh lies flat without overlap.)
    const segs = [...rimNext].map(([u, w]) => [xy[2 * u], xy[2 * u + 1], xy[2 * w], xy[2 * w + 1], u, w]);
    const side = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    let crossings = 0;
    for (let i = 0; i < segs.length; i++) {
      const [ax, ay, bx, by, u, w] = segs[i], eps = 1e-6 * Math.hypot(bx - ax, by - ay);
      for (let j = i + 1; j < segs.length; j++) {
        const [cx, cy, dx, dy, u2, w2] = segs[j];
        if (u2 === u || u2 === w || w2 === u || w2 === w) continue;
        if (Math.max(cx, dx) < Math.min(ax, bx) || Math.min(cx, dx) > Math.max(ax, bx) || Math.max(cy, dy) < Math.min(ay, by) || Math.min(cy, dy) > Math.max(ay, by)) continue;
        const s1 = side(ax, ay, bx, by, cx, cy), s2 = side(ax, ay, bx, by, dx, dy), eps2 = 1e-6 * Math.hypot(dx - cx, dy - cy);
        const s3 = side(cx, cy, dx, dy, ax, ay), s4 = side(cx, cy, dx, dy, bx, by);
        if (((s1 > eps && s2 < -eps) || (s1 < -eps && s2 > eps)) && ((s3 > eps2 && s4 < -eps2) || (s3 < -eps2 && s4 > eps2))) crossings++;
      }
    }
    if (crossings) out.push(`the rim of the mesh crosses itself ${crossings} time(s)`);
  }
  const areaTol = amp === 0 ? 1e-6 : 2e-3;
  if (Math.abs(area - group.domainArea) > areaTol * group.domainArea) out.push(`triangle areas sum to ${area}, the tile has ${group.domainArea}`);
  if (Math.abs(rimArea - group.domainArea) > areaTol * group.domainArea) out.push(`the rim encloses ${rimArea} (counter-clockwise positive), the tile has ${group.domainArea}`);

  // ---- the rim is the boundary of the tile
  const P = domain.poly, E = domain.edges, H = P.length;
  if (amp === 0) {
    // every rim edge lies on one edge of the polygon, and every edge of the polygon is covered exactly once
    const cover = new Array(H).fill(0);
    let stray = 0;
    for (const [u, w] of rimNext) {
      const p = pt(u), q = pt(w);
      let best = -1, bd = Infinity;
      for (let i = 0; i < H; i++) {
        const d = Math.max(Math.abs(E[i].nx * p[0] + E[i].ny * p[1] - E[i].c), Math.abs(E[i].nx * q[0] + E[i].ny * q[1] - E[i].c));
        if (d < bd) { bd = d; best = i; }
      }
      if (bd > 2e-6) { stray++; continue; }
      cover[best] += Math.hypot(q[0] - p[0], q[1] - p[1]);
    }
    if (stray) out.push(`${stray} rim edges of the mesh do not lie on an edge of the tile (a crack or a gap)`);
    for (let i = 0; i < H; i++) {
      const a = P[i], b = P[(i + 1) % H], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (Math.abs(cover[i] - len) > 3e-5) out.push(`tile edge ${i} has length ${len}, the rim of the mesh covers ${cover[i]} of it`);
    }
  } else {
    // every rim vertex is on the warped boundary, up to the sagitta of an inscribed chord (corners of two chords)
    const y = [0, 0];
    let worstOut = 0, worstIn = 0;
    for (const u of rimNext.keys()) {
      domain.warp.inv(xy[2 * u], xy[2 * u + 1], y);
      const d = outsideBy(domain, y[0], y[1]);
      worstOut = Math.max(worstOut, d); worstIn = Math.max(worstIn, -d);
    }
    meshStats.rimOut = Math.max(meshStats.rimOut, worstOut / size); meshStats.rimIn = Math.max(meshStats.rimIn, worstIn / size);
    if (worstOut > 0.02 * size) out.push(`a rim vertex lies ${(worstOut / size).toFixed(4)} tile sizes outside the warped tile`);
    if (worstIn > 0.02 * size) out.push(`a rim vertex lies ${(worstIn / size).toFixed(4)} tile sizes inside the warped tile (a crack)`);
  }

  // ---- pieces: discs, in a tree, neighbours mirror images in their crease
  const pv = Array.from({ length: NP }, () => new Set()), pe = Array.from({ length: NP }, () => new Set()), pf = new Int32Array(NP);
  const pcx = new Float64Array(NP), pcy = new Float64Array(NP), pa = new Float64Array(NP);
  for (let t = 0; t < m; t++) {
    const k = pieceOf[t], a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
    pf[k]++;
    pv[k].add(a).add(b).add(c);
    for (const [u, v] of [[a, b], [b, c], [c, a]]) pe[k].add(Math.min(u, v) * n + Math.max(u, v));
    const ar = Math.abs((xy[2 * b] - xy[2 * a]) * (xy[2 * c + 1] - xy[2 * a + 1]) - (xy[2 * b + 1] - xy[2 * a + 1]) * (xy[2 * c] - xy[2 * a])) / 2 + 1e-300;
    pa[k] += ar; pcx[k] += ar * (xy[2 * a] + xy[2 * b] + xy[2 * c]) / 3; pcy[k] += ar * (xy[2 * a + 1] + xy[2 * b + 1] + xy[2 * c + 1]) / 3;
  }
  for (let k = 0; k < NP; k++) {
    if (!pf[k]) { out.push(`piece ${k} has no triangles`); continue; }
    const c = pv[k].size - pe[k].size + pf[k];
    if (c !== 1) out.push(`piece ${k}: V - E + F = ${pv[k].size} - ${pe[k].size} + ${pf[k]} = ${c}, a disc has 1`);
    if (cells[k].index !== k) out.push(`cells[${k}].index = ${cells[k].index}`);
    if (cells[k].parity !== (detOf(cells[k].g) > 0 ? 0 : 1)) out.push(`piece ${k}: parity ${cells[k].parity} but det g = ${detOf(cells[k].g)}`);
  }
  const neighbours = new Map();      // a * NP + b (a < b) for every two pieces that share an edge
  for (const e of edges.values()) {
    if (e.tris.length !== 2) continue;
    const a = pieceOf[e.tris[0]], b = pieceOf[e.tris[1]];
    if (a === b) continue;
    const key = Math.min(a, b) * NP + Math.max(a, b);
    if (!neighbours.has(key)) {
      neighbours.set(key, 1);
      if (cells[a].parity === cells[b].parity) out.push(`pieces ${a} and ${b} share an edge but have the same parity`);
    }
    // g_b o inverse(g_a) must be the reflection in the line of the shared edge
    const rho = mul(cells[b].g, invAffine(cells[a].g));
    if (kindOf(rho).type !== 'reflection') { out.push(`pieces ${a} and ${b} share an edge, but their cells are not mirror images of each other`); continue; }
    for (const v of [e.lo, e.hi]) {
      const p = pt(v), q = act(rho, p);
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 4e-6) out.push(`pieces ${a} and ${b}: vertex ${v} of their shared edge is ${(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2).toExponential(2)} off the mirror between their cells`);
    }
  }
  // every piece is connected through shared edges
  {
    const pu = Int32Array.from({ length: m }, (_, t) => t);
    const pfind = (t) => { while (pu[t] !== t) t = pu[t] = pu[pu[t]]; return t; };
    for (const e of edges.values()) if (e.tris.length === 2 && pieceOf[e.tris[0]] === pieceOf[e.tris[1]]) pu[pfind(e.tris[0])] = pfind(e.tris[1]);
    const roots = new Map();
    for (let t = 0; t < m; t++) { const r = pfind(t); if (!roots.has(pieceOf[t])) roots.set(pieceOf[t], new Set()); roots.get(pieceOf[t]).add(r); }
    for (const [k, s] of roots) if (s.size !== 1) out.push(`piece ${k} falls into ${s.size} parts`);
  }
  if (neighbours.size !== NP - 1) out.push(`${NP} pieces with ${neighbours.size} neighbour pairs: not a tree`);
  if (mesh.root !== 0 || cells[0].parent !== -1 || cells[0].hinge !== null) out.push('the root record is not piece 0 without parent and hinge');
  {
    // the root is the piece that holds the warped seed: some triangle of piece 0 contains it (or comes within a hair of it)
    const sd = domain.warp.fwd(domain.seed[0], domain.seed[1], [0, 0]);
    let best = Infinity;
    for (let t = 0; t < m && best > 0; t++) {
      if (pieceOf[t] !== mesh.root) continue;
      const a = pt(tri[3 * t]), b = pt(tri[3 * t + 1]), c = pt(tri[3 * t + 2]);
      const e0 = (b[0] - a[0]) * (sd[1] - a[1]) - (b[1] - a[1]) * (sd[0] - a[0]), e1 = (c[0] - b[0]) * (sd[1] - b[1]) - (c[1] - b[1]) * (sd[0] - b[0]), e2 = (a[0] - c[0]) * (sd[1] - c[1]) - (a[1] - c[1]) * (sd[0] - c[0]);
      const lmax = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - b[0], c[1] - b[1]), Math.hypot(a[0] - c[0], a[1] - c[1]));
      best = Math.min(best, Math.max(0, -Math.min(e0, e1, e2) / lmax));        // 0 inside; else roughly the distance outside
    }
    if (best > 3e-6) out.push(`the warped seed is ${best.toExponential(2)} away from every triangle of the root piece`);
    if (mesh.locate(sd[0] + 1e-6 * 0.3713, sd[1] + 1e-6 * 0.9285) !== mesh.root) out.push('locate(the nudged warped seed) is not the root piece');
  }
  // the tree of parents, and the holonomy of the hinges
  const hol = new Array(NP).fill(null);
  hol[0] = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  let orphans = 0;
  for (let k = 1; k < NP; k++) {
    const c = cells[k], par = c.parent;
    if (!(Number.isInteger(par) && par >= 0 && par < k)) { out.push(`piece ${k} has parent ${par}`); continue; }
    if (c.depth !== cells[par].depth + 1) out.push(`piece ${k}: depth ${c.depth}, its parent has ${cells[par].depth}`);
    meshStats.maxDepth = Math.max(meshStats.maxDepth, c.depth);
    if (!neighbours.has(Math.min(k, par) * NP + Math.max(k, par))) orphans++;
    const h = c.hinge;
    if (!h || !(Math.hypot(h.bx - h.ax, h.by - h.ay) > 1e-9 * size)) { out.push(`piece ${k} has no usable hinge`); continue; }
    if (!hol[par]) continue;
    hol[k] = mul(hol[par], mirrorThrough([h.ax, h.ay], [h.bx, h.by]));
    const want = mul(cells[0].g, invAffine(c.g));
    const d = isoDistance(hol[k], want, size);
    if (d > 1e-7 * size) out.push(`piece ${k} (depth ${c.depth}): the reflections in the hinges from the root compose to a map that is ${d.toExponential(2)} away from g_root o inverse(g_piece)`);
    // the piece lies to the left of a -> b
    const side = (h.bx - h.ax) * (pcy[k] / pa[k] - h.ay) - (h.by - h.ay) * (pcx[k] / pa[k] - h.ax);
    if (!(side > -2e-7 * Math.hypot(h.bx - h.ax, h.by - h.ay))) out.push(`piece ${k} lies to the right of its hinge a -> b`);
    // and the crease list has it
    if (!mesh.creases.some((cr) => cr.a === par && cr.b === k && Math.hypot(cr.pts[0] - h.ax, cr.pts[1] - h.ay) < 1e-5 && Math.hypot(cr.pts[2] - h.bx, cr.pts[3] - h.by) < 1e-5)) out.push(`piece ${k}: no crease record {a: ${par}, b: ${k}} with its hinge`);
  }
  if (orphans) out.push(`${orphans} pieces are hinged to a parent they share no edge with`);
  if (mesh.creases.length !== NP - 1) out.push(`${mesh.creases.length} creases for ${NP} pieces`);
  // per-vertex pieces
  {
    const touch = Array.from({ length: n }, () => []);
    for (let t = 0; t < m; t++) for (let e = 0; e < 3; e++) touch[tri[3 * t + e]].push(pieceOf[t]);
    let wrong = 0;
    for (let v = 0; v < n; v++) if (used[v] && !touch[v].includes(mesh.cell[v])) wrong++;
    if (wrong) out.push(`mesh.cell names a piece that does not touch the vertex, for ${wrong} vertices`);
  }
  // boundary records follow the tile's edges
  if (mesh.boundary.length !== H) out.push(`mesh.boundary has ${mesh.boundary.length} entries for ${H} edges`);
  else {
    mesh.boundary.forEach((b, i) => {
      if (b.edge !== i || b.kind !== E[i].kind || b.cls !== E[i].cls) out.push(`mesh.boundary[${i}] is {edge: ${b.edge}, kind: ${b.kind}, cls: ${b.cls}}, the tile's edge is {kind: ${E[i].kind}, cls: ${E[i].cls}}`);
      if (b.cells.length !== b.pts.length / 2 || b.cells.some((k) => k >= NP)) out.push(`mesh.boundary[${i}].cells`);
    });
  }
  return { out, pieces: NP, triangles: m, chi };
}

/**
 * mesh.boundary against the kaleidoscope picture. Folding a point x of piece c into the cell is u = inverse(g_c)(x), on the
 * front or back sheet by the parity of c. For the gluing of the tile to be the gluing of the folded shape:
 *   - a sample on a mirror edge must fold onto an OPEN side of the cell (the rim);
 *   - a sample on a cut edge and the sample it is glued to must fold to the same point, on the same sheet unless the
 *     point is on a GLUED side of the cell (where the sheets are joined);
 *   - 22x, glide edges: the two samples fold to antipodal points of the pillow: u' = 2 centre - u on the other sheet.
 */
function seamProblems(group, domain, mesh) {
  const out = [];
  if (!group.kaleido) return out;
  const T = group.kaleido.cell, glued = group.kaleido.glued, k = T.length, cells = mesh.cells, E = domain.edges;
  const cen = [T.reduce((s, p) => s + p[0], 0) / k, T.reduce((s, p) => s + p[1], 0) / k];
  const TOL = 1e-5;
  const sideDist = (u, s) => {      // signed distance to the line of side s, positive inside the counter-clockwise cell
    const p = T[s], q = T[(s + 1) % k];
    return ((q[0] - p[0]) * (u[1] - p[1]) - (q[1] - p[1]) * (u[0] - p[0])) / Math.hypot(q[0] - p[0], q[1] - p[1]);
  };
  const onSide = (u, wantGlued) => T.some((_, s) => glued[s] === wantGlued && Math.abs(sideDist(u, s)) < TOL);
  const fold = (x, piece) => act(invAffine(cells[piece].g), x);
  let shown = 0;
  const say = (msg) => { if (shown++ < 4) out.push(msg); };
  for (let i = 0; i < E.length; i++) {
    const B = mesh.boundary[i], m = B.pts.length / 2 - 1, kind = kindOf(E[i].g).type;
    const j = E[i].partner, Bj = mesh.boundary[j], keep = detOf(E[i].g) < 0, h = invAffine(E[i].g);
    if (Bj.pts.length !== B.pts.length) { say(`edges ${i} and ${j} are glued but have ${m + 1} and ${Bj.pts.length / 2} boundary samples`); continue; }
    for (let s = 0; s <= m; s++) {
      const x = [B.pts[2 * s], B.pts[2 * s + 1]], a = B.cells[s], u = fold(x, a);
      for (let t = 0; t < k; t++) if (sideDist(u, t) < -TOL) { say(`sample ${s} of edge ${i} is given piece ${a}, but lies ${(-sideDist(u, t)).toExponential(2)} outside that piece's kaleidoscope cell`); break; }
      if (kind === 'reflection') {
        if (!onSide(u, false)) say(`sample ${s} of mirror edge ${i} does not fold onto an open side of the kaleidoscope cell`);
        continue;
      }
      const sj = keep ? s : m - s;
      const x2 = [Bj.pts[2 * sj], Bj.pts[2 * sj + 1]], b = Bj.cells[sj], u2 = fold(x2, b);
      const hx = act(h, x);
      if (Math.hypot(hx[0] - x2[0], hx[1] - x2[1]) > 4e-6) { say(`sample ${s} of edge ${i} is not carried by inverse(g) onto sample ${sj} of edge ${j} (off by ${Math.hypot(hx[0] - x2[0], hx[1] - x2[1]).toExponential(2)})`); continue; }
      const sameSheet = cells[a].parity === cells[b].parity;
      if (!keep) {
        const d = Math.hypot(u[0] - u2[0], u[1] - u2[1]);
        if (d > TOL) say(`sample ${s} of edge ${i} (piece ${a}) and its glued partner (sample ${sj} of edge ${j}, piece ${b}) fold to points ${d.toExponential(2)} apart in the kaleidoscope cell`);
        else if (!sameSheet && !onSide(u, true)) say(`sample ${s} of edge ${i} (piece ${a}) and its glued partner (piece ${b}) fold to the same point but on opposite sheets, away from any glued side`);
      } else {
        const d = Math.hypot(2 * cen[0] - u[0] - u2[0], 2 * cen[1] - u[1] - u2[1]);
        if (d > TOL) say(`sample ${s} of glide edge ${i} (piece ${a}) and its glued partner (piece ${b}) do not fold to antipodal points of the pillow (off by ${d.toExponential(2)})`);
        else if (sameSheet && !onSide(u, true)) say(`sample ${s} of glide edge ${i} and its glued partner fold to antipodal points on the SAME sheet`);
      }
    }
  }
  if (shown > out.length) out.push(`... and ${shown - out.length} more boundary samples`);
  return out;
}

const meshStats = { meshes: 0, maxPieces: 0, multi: 0, maxDepth: 0, rimOut: 0, rimIn: 0 };

test('mesh: a disc whose rim is the tile boundary, cut into discs that form a tree; hinge reflections compose to g_root o inverse(g_piece); glued boundary samples fold together', async (t) => {
  await perGroup(t, (group) => {
    const lines = [];
    // every preset, the first random seeds, and each preset moved by 1e-7 and by 1e-9 (tile edges far shorter than a mesh triangle)
    const cases = resultsOf(group).filter((c) => (c.kind === 'main' && (c.preset !== undefined || c.random < MESH_SEEDS)) ||
      (c.kind === 'hair' && c.label.startsWith('preset') && c.dir === 0 && (c.off === 1e-7 || c.off === 1e-9 || process.env.VERIFY_MESH_HAIR)));
    assert.ok(cases.length >= group.presets.length + 4);
    for (const c of cases) {
      for (const amp of MESH_AMPS) {
        const where = `${group.id} ${c.label} amp ${amp}`;
        const how = `\n      repro: buildMesh(BY_ID['${group.id}'], ${repro(group, c, amp)})`;
        let res;
        try {
          const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp: warpOf(group, amp) });
          const mesh = buildMesh(group, domain);
          res = meshProblems(group, domain, mesh, amp);
          res.out.push(...seamProblems(group, domain, mesh));
          // (b) again, on the mesh: gluing the rim of a disc changes V - E by what it does to the rim, and the rim is the
          // boundary of the polygon, however finely subdivided: chi(glued mesh) = chi(mesh) + (V - E of the glued rim)
          if (c.R.ok && res.chi + (c.R.V - c.R.E) !== EXPECT[group.id].chi) res.out.push(`the glued mesh has Euler characteristic ${res.chi} + (${c.R.V} - ${c.R.E}) = ${res.chi + c.R.V - c.R.E}, expected ${EXPECT[group.id].chi}`);
        } catch (err) { lines.push(`${where}: threw ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}${how}`); continue; }
        meshStats.meshes++;
        meshStats.maxPieces = Math.max(meshStats.maxPieces, res.pieces);
        if (res.pieces > 1) meshStats.multi++;
        if (!group.kaleido && res.pieces !== 1) res.out.push(`${res.pieces} pieces in a group without a kaleidoscope`);
        if (group.fold === 'snowflake' && res.pieces !== 1) res.out.push(`${res.pieces} pieces in a kaleidoscope's own tile`);
        for (const msg of res.out) lines.push(`${where}: ${msg}${how}`);
      }
    }
    assert.equal(lines.length, 0, `${lines.length} failure(s) for ${group.id}:\n    ${lines.slice(0, 10).join('\n    ')}${lines.length > 10 ? `\n    ... and ${lines.length - 10} more` : ''}`);
  });
  t.diagnostic(`meshes checked: ${meshStats.meshes}, ${meshStats.multi} with several pieces (up to ${meshStats.maxPieces}), deepest tree ${meshStats.maxDepth}; at amp 1 rim vertices up to ${meshStats.rimOut.toExponential(2)} outside / ${meshStats.rimIn.toExponential(2)} inside the warped tile (tile sizes)`);
  assert.ok(meshStats.meshes >= 17 * 2 * 5 && meshStats.multi > 50 && meshStats.maxPieces >= 4 && meshStats.maxDepth >= 2, `the mesh sweep is too thin: ${JSON.stringify(meshStats)}`);
});

// Seeds at which buildMesh, at amp 1, left a slit in the mesh until the fix of 2026-11-09 (found by scanning random seeds with
// dev/verify-topology-tjunction-scan.mjs; the 442 seed next to a rotation centre was first met by verify-robust.test.js).
// What happens there, read off the mesh (dev/verify-topology-rimprobe.mjs prints it): near a corner of the wavy tile a
// fine triangle is cut by tile edge A exactly on its own edge, at a point that lies a sagitta OUTSIDE tile edge B; none
// of the triangle's three own vertices is outside B, so B never clips it. Its neighbour across that edge has a vertex
// outside B and is cut by B further in. The two then disagree about where their shared edge ends: a T-junction.
const SLIT_SEEDS = [
  ['442', [1.0412949716672302, 0.028129406459629525]],
  ['442', [0.5000000005403024, 8.414710154240665e-10]],
  ['2222', [-0.5133490037638694, 1.4451173793058842]],
  ['22x', [1.1903342579025775, 1.0130437532672658]],
  ['22x', [0.6910707462346182, 0.7096936793066562]],       // random seed 8 of this file's own sweep
  // re-pinned for the turned ** of 10 Nov through (x, y) -> (y, x), which carries the old group onto the new one (it was
  // [1.6181752597913146, 0.9288813577964901]); see test/mesh.test.js BROKEN: no seed of the turned ** with today's wave
  // reproduces the slit, so this checks the same place of the strip, not the old configuration
  ['**', [0.9288813577964901, 1.6181752597913146]],
];

test('mesh at amp 1: neighbouring triangles agree where the tile boundary cuts their shared edge — the rim is a simple polygon, no T-junction', async (t) => {
  const byGroup = new Map(GROUPS.map((g) => [g.id, []]));
  for (const [id, seed] of SLIT_SEEDS) byGroup.get(id).push({ label: `seed (${seed[0]}, ${seed[1]})`, seed, metric: undefined });
  // and the first random seeds of the main sweep, twice as many as the full mesh test takes
  for (const group of GROUPS) for (const c of resultsOf(group)) if (c.kind === 'main' && c.random < 2 * MESH_SEEDS) byGroup.get(group.id).push(c);
  let meshes = 0;
  await perGroup(t, (group) => {
    const lines = [];
    for (const c of byGroup.get(group.id)) {
      const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp: warpOf(group, 1) });
      const mesh = buildMesh(group, domain);
      const res = meshProblems(group, domain, mesh, 1);
      meshes++;
      for (const msg of res.out.concat(seamProblems(group, domain, mesh))) lines.push(`${group.id} ${c.label} amp 1: ${msg}\n      repro: buildMesh(BY_ID['${group.id}'], ${repro(group, c, 1)})`);
    }
    assert.equal(lines.length, 0, `${lines.length} failure(s) for ${group.id}:\n    ${lines.join('\n    ')}`);
  });
  t.diagnostic(`meshes checked at amp 1: ${meshes}`);
});

// ---------------------------------------------------------------------------------------------------------------
// Tests: the kaleidoscope picture of the hinge groups
// ---------------------------------------------------------------------------------------------------------------

/**
 * Two copies of the kaleidoscope cell T (front and back), joined along the sides marked `glued`, open along the others:
 * the same data as (a)-(d), derived from group.kaleido alone.
 */
function doubledCell(group) {
  const T = group.kaleido.cell, glued = group.kaleido.glued, k = T.length;
  const cones = [], corners = [];
  let V = 0;
  for (let i = 0; i < k; i++) {
    const a = T[(i + k - 1) % k], b = T[i], c = T[(i + 1) % k];
    const th = Math.atan2((c[0] - b[0]) * (a[1] - b[1]) - (c[1] - b[1]) * (a[0] - b[0]), (c[0] - b[0]) * (a[0] - b[0]) + (c[1] - b[1]) * (a[1] - b[1]));
    const before = glued[(i + k - 1) % k], after = glued[i];
    if (before && after) { V += 1; cones.push(Math.round(TAU / (2 * th))); }                // the two sheets wrap round the corner
    else if (before || after) { V += 1; corners.push(Math.round(Math.PI / (2 * th))); }      // the two sheets open like a book
    else { V += 2; corners.push(Math.round(Math.PI / th), Math.round(Math.PI / th)); }       // each sheet keeps its own corner
  }
  const nGlued = glued.filter(Boolean).length, E = nGlued + 2 * (k - nGlued);
  // rims: maximal runs of open sides; a run closes into one loop through both sheets, a fully open cell has two loops
  let rims = 0;
  if (nGlued === 0) rims = 2; else for (let i = 0; i < k; i++) if (!glued[i] && glued[(i + k - 1) % k]) rims++;
  return { cones: cones.filter((o) => o > 1), corners: corners.filter((o) => o > 1), chi: V - E + 2, rims };
}

test('hinge groups: two copies of the kaleidoscope cell joined along the glued sides are the orbifold of the group (22x: its double cover 2222)', () => {
  for (const group of GROUPS) {
    if (group.fold !== 'hinge' && group.fold !== 'crosscap') continue;
    const D = doubledCell(group), want = EXPECT[group.fold === 'crosscap' ? '2222' : group.id];
    assert.ok(sameList(D.cones, want.cones), `${group.id}: cone points [${D.cones}] of the doubled cell, expected [${want.cones}]`);
    assert.ok(sameList(D.corners, want.corners), `${group.id}: mirror corners [${D.corners}] of the doubled cell, expected [${want.corners}]`);
    assert.equal(D.chi, want.chi, `${group.id}: Euler characteristic of the doubled cell`);
    assert.equal(D.rims, want.rims, `${group.id}: rims of the doubled cell`);
    // the tile is as large as the two sheets together (22x: as one sheet, the antipodal map halves the pillow)
    const cellArea = group.kaleido.group.domainArea;
    assert.ok(Math.abs(group.domainArea - (group.fold === 'crosscap' ? 1 : 2) * cellArea) < 1e-12, `${group.id}: tile area ${group.domainArea}, cell area ${cellArea}`);
  }
  for (const group of GROUPS) {
    if (group.fold !== 'snowflake') continue;
    assert.ok(group.kaleido.glued.every((g) => !g), `${group.id}: a kaleidoscope glues nothing`);
    assert.ok(Math.abs(group.domainArea - group.kaleido.group.domainArea) < 1e-12, group.id);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Controls: the instrument itself
// ---------------------------------------------------------------------------------------------------------------

test('control: the tile of the rotation subgroup of a group with mirrors or glides glues up to the rotation subgroup\'s orbifold', () => {
  // the symbol is measured, not copied: the same lattice with the orientation-reversing elements left out gives another orbifold
  const plus = { '**': 'o', 'xx': 'o', '*x': 'o', '22x': '2222', '22*': '2222', '*2222': '2222', '2*22': '2222', '3*3': '333', '*333': '333', '4*2': '442', '*442': '442', '*632': '632' };
  for (const [id, want] of Object.entries(plus)) {
    const G = BY_ID[id], reps = G.reps.filter((r) => detOf(r) > 0);
    assert.equal(reps.length * 2, G.reps.length, id);
    const H = { ...G, id: id + ' (rotations only)', reps, domainArea: G.cellArea / reps.length, kaleido: null, warp: null };
    const rnd = rngFrom('control|' + id);
    for (let k = 0; k < 4; k++) {
      const seed = [G.center[0] + (2 * rnd() - 1) * G.viewHalf, G.center[1] + (2 * rnd() - 1) * G.viewHalf];
      const d = buildDomain(H, { seed });
      const R = glueUp(H, d);
      assert.ok(R.ok && R.problems.length === 0, `${H.id} seed ${seed}: ${R.problems.map((q) => q.msg).join('; ')}`);
      assert.equal(R.symbol, want, `${H.id} seed ${seed}`);
      assert.equal(R.chi, EXPECT[want].chi);
      assert.deepEqual(conePointMismatch(H, d, R), [], `${H.id} seed ${seed}`);
    }
  }
});

test('control: a wrong edge element, a wrong partner, a moved vertex and a wrong cone-point list are all noticed', () => {
  const G = BY_ID['2222'], d = buildDomain(G, { seed: [0.2, 0.33] });
  const clone = (edit) => {
    const c = { ...d, poly: d.poly.map((q) => q.slice()), edges: d.edges.map((e) => ({ ...e, g: { ...e.g } })), conePoints: d.conePoints.map((q) => ({ ...q })) };
    edit(c);
    return c;
  };
  const R0 = glueUp(G, d);
  assert.ok(R0.ok && R0.problems.length === 0 && R0.symbol === '2222');
  assert.deepEqual(conePointMismatch(G, d, R0), []);
  const checksOf = (c) => glueUp(G, c).problems.map((q) => q.check);
  // an element of the group, but the wrong one for this edge
  assert.ok(checksOf(clone((c) => { const e = c.edges.find((q) => !q.halfTurn); e.g.tx += G.e1[0]; e.g.ty += G.e1[1]; })).includes('pairing'));
  assert.ok(checksOf(clone((c) => { c.edges[0].partner = (c.edges[0].partner + 1) % c.edges.length; })).includes('pairing'));
  assert.ok(checksOf(clone((c) => { c.poly[0][0] += 1e-6; })).includes('pairing'));
  assert.ok(checksOf(clone((c) => { c.edges[0].halfTurn = !c.edges[0].halfTurn; })).includes('flags'));
  assert.ok(checksOf(clone((c) => { c.edges[0].kind = 'mirror'; })).includes('flags'));
  assert.ok(checksOf(clone((c) => { c.classes += 1; })).includes('flags'));
  // not an element of the group at all: a half-turn edge declared a mirror by its element
  assert.ok(checksOf(clone((c) => { const e = c.edges.find((q) => q.halfTurn), a = c.poly[c.edges.indexOf(e)], b = c.poly[(c.edges.indexOf(e) + 1) % c.poly.length]; e.g = mirrorThrough(a, b); })).includes('pairing'));
  // cone points
  assert.ok(conePointMismatch(G, clone((c) => { c.conePoints.pop(); }), R0).some((m) => m.startsWith('missing')));
  assert.ok(conePointMismatch(G, clone((c) => { c.conePoints[0].order = 4; }), R0).length > 0);
  assert.ok(conePointMismatch(G, clone((c) => { c.conePoints[0].onMirror = true; }), R0).length > 0);
  assert.ok(conePointMismatch(G, clone((c) => { c.conePoints.push({ x: 0.1, y: 0.1, order: 2, onMirror: false }); }), R0).some((m) => m.startsWith('extra')));
  assert.ok(conePointMismatch(G, clone((c) => { c.conePoints.push({ ...c.conePoints[0] }); }), R0).some((m) => m.startsWith('extra')));
});

test('control: a crack, a hole, a flipped triangle, a wrong hinge and a wrong boundary piece are all noticed in a mesh', () => {
  const G = BY_ID['2222'], d = buildDomain(G, { seed: G.presets[0].seed }), M = buildMesh(G, d);
  assert.deepEqual(meshProblems(G, d, M, 0).out, []);
  assert.deepEqual(seamProblems(G, d, M), []);
  assert.ok(M.cells.length >= 3);
  const copy = (edit) => {
    const c = {
      ...M, xy: Float32Array.from(M.xy), tri: Uint32Array.from(M.tri), triCell: Uint16Array.from(M.triCell), cell: Uint16Array.from(M.cell),
      cells: M.cells.map((q) => ({ ...q, hinge: q.hinge && { ...q.hinge } })), boundary: M.boundary.map((b) => ({ ...b, cells: Uint16Array.from(b.cells) })),
      creases: M.creases.map((q) => ({ ...q })),
    };
    return edit(c) || c;
  };
  // rim vertices of the mesh, and a triangle with none of them
  const m = M.tri.length / 3, count = new Map();
  for (let t = 0; t < m; t++) for (let e = 0; e < 3; e++) { const u = M.tri[3 * t + e], v = M.tri[3 * t + (e + 1) % 3], key = Math.min(u, v) + ',' + Math.max(u, v); count.set(key, (count.get(key) || 0) + 1); }
  const onRim = new Set();
  for (const [key, c] of count) if (c === 1) key.split(',').forEach((v) => onRim.add(+v));
  let inner = -1;
  for (let t = 0; t < m && inner < 0; t++) if (![0, 1, 2].some((e) => onRim.has(M.tri[3 * t + e]))) inner = t;
  assert.ok(inner >= 0);
  // a crack: one triangle gets its own copy of an interior vertex
  const cracked = copy((c) => {
    const v = c.tri[3 * inner], nv = c.xy.length / 2;
    const xy = new Float32Array(2 * nv + 2); xy.set(c.xy); xy[2 * nv] = c.xy[2 * v]; xy[2 * nv + 1] = c.xy[2 * v + 1];
    const cell = new Uint16Array(nv + 1); cell.set(c.cell); cell[nv] = c.triCell[inner];
    c.tri[3 * inner] = nv;
    return { ...c, xy, cell, n: nv + 1 };
  });
  assert.ok(meshProblems(G, d, cracked, 0).out.length > 0, 'crack');
  // a hole: an interior triangle is missing
  const holed = copy((c) => {
    const tri = new Uint32Array(3 * m - 3), triCell = new Uint16Array(m - 1);
    for (let t = 0, k = 0; t < m; t++) { if (t === inner) continue; tri.set(c.tri.subarray(3 * t, 3 * t + 3), 3 * k); triCell[k++] = c.triCell[t]; }
    return { ...c, tri, triCell, m: m - 1 };
  });
  assert.ok(meshProblems(G, d, holed, 0).out.some((msg) => msg.includes('Euler') || msg.includes('loops')), 'hole');
  // a flipped triangle
  assert.ok(meshProblems(G, d, copy((c) => { const u = c.tri[3 * inner]; c.tri[3 * inner] = c.tri[3 * inner + 1]; c.tri[3 * inner + 1] = u; }), 0).out.length > 0, 'flip');
  // a hinge moved off its crease
  assert.ok(meshProblems(G, d, copy((c) => { c.cells[1].hinge.ax += 0.01; c.cells[1].hinge.ay += 0.013; }), 0).out.some((msg) => msg.includes('hinges')), 'hinge');
  // a piece given the wrong sheet
  assert.ok(meshProblems(G, d, copy((c) => { c.cells[1].parity ^= 1; }), 0).out.length > 0, 'parity');
  // a boundary sample filed under a piece of another cell
  const wrongPiece = copy((c) => {
    const b = c.boundary.find((q) => q.kind === 'cut'), s = b.cells.length >> 1;
    b.cells[s] = c.cells.findIndex((q) => isoDistance(q.g, c.cells[b.cells[s]].g) > 1e-6);
  });
  assert.ok(seamProblems(G, d, wrongPiece).length > 0, 'boundary piece');
});

// ---------------------------------------------------------------------------------------------------------------

test('dump of the derived signatures (set VERIFY_TOPOLOGY_DUMP=1)', { skip: !process.env.VERIFY_TOPOLOGY_DUMP }, () => {
  const rows = [];
  for (const group of GROUPS) {
    for (const c of resultsOf(group)) {
      if (c.kind !== 'main' || (c.preset === undefined && !process.env.VERIFY_TOPOLOGY_DUMP_ALL)) continue;
      const R = c.R;
      if (!R.ok) { rows.push(`${group.id.padEnd(6)} ${c.label.padEnd(26)} NOT GLUED: ${R.problems.map((p) => p.msg).join('; ')}`); continue; }
      const cyc = R.classes.map((C) => `${C.type === 'mirror' ? 'm' : 'i'}${C.mids.length ? 'mid' + C.mids[0] : '{' + C.members.join(',') + '}'}:${C.order}`).join(' ');
      rows.push(`${group.id.padEnd(6)} ${c.label.padEnd(26)} n=${R.n} V=${R.V} E=${R.E} (mirror ${R.mirrorEdges}, pairs ${R.pairs}, half-turn ${R.halfEdges}) chi=${R.chi} ${R.orientable ? 'orientable' : 'non-orientable'} rims=${R.rims} -> ${R.symbol.padEnd(6)} conePoints=${c.domain.conePoints.length}  ${cyc}`);
    }
  }
  console.log('\n' + rows.join('\n') + '\n');
});
