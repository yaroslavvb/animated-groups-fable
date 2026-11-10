// verify-robust.test.js — independent verification of src/domain.js and src/mesh.js (SPEC 4, 5.1, 5.2).
// Lens: ROBUSTNESS, WARP AND MESH.  Written by a verifier, not by the owner of the code under test.
//
// What is attacked
//   presets      every preset of every group at amp 0, 0.25, 0.5, 1
//   mirror       seeds on / a hair off a mirror line of G                      (before clamping)
//   centre       seeds on / a hair off a rotation centre of G, and at the clamp radius  (before clamping)
//   crease       seeds on / a hair off a mirror of the kaleidoscope that is NOT a mirror of G (never clamped:
//                the tile is then degenerate or nearly so — ties, edges of length 1e-13 .. 1e-4, sliver pieces)
//   glide        seeds on / a hair off a glide axis (never clamped)
//   symmetric    exact symmetric positions: cell centroid / incentre / side midpoints, lattice half points,
//                images of the presets under the kaleidoscope's point group
//   far          seeds several lattice periods outside the central cell (4 .. 30 periods)
//   random       a few seeded-random seeds at amp 0.25, 0.5, 1 (the owner's suite sweeps amp 0 and 1 only)
//   wavy         preset 0 of every group along the "Wavy" slider: amp 1e-9 .. 0.95 (lobes appear and vanish on the way)
//   density      preset 0 of every group with the density option of buildMesh well below and above its default
//   pinned       seeds found by the wider sweeps (dev/verify-robust-tj.mjs, VR_LEVEL=2, VR_WAVY=100) that broke something
//   extreme      seeds 1e3 .. 1e7 periods away: reported in a test of their own (the plane view keeps the seed in
//                its window, so this is outside the contract; it documents where precision runs out)
//
// What is checked for every case (each check has a name; a test at the bottom asserts that its failure list is empty)
//   throws        buildDomain / buildMesh / outline / locate must not throw
//   domain        polygon finite, convex, counter-clockwise, no edge shorter than 1e-9, seed strictly inside
//   area          domain.area = group.domainArea (1e-7)
//   clamp         domain.seed = clampSeed(seed) and is at least delta from every mirror and rotation centre of G
//   gluing        partners, equal lengths, inverse(g) maps the end points of edge i onto those of its partner, kinds, classes,
//                 every edge is the bisector of the seed and g(seed), cone points are rotation centres on the boundary
//   tiling        400 random points (through warp.inv) lie in exactly one tile g(D); so do points 1e-7 .. 1e-3 sizes
//                 from every corner and edge midpoint of the tile
//   warp          fwd(inv(x)) = x at the same points
//   outline       outline(maxStep) for several maxStep: one entry per edge, Float32, even number of steps <= maxStep,
//                 consecutive edges share the corner exactly (closed), points are warp.fwd of the straight subdivision
//   outline-ccw   the loop is counter-clockwise and encloses exactly group.domainArea (glued partners carry
//                 congruent polylines, so the chord error cancels: the outline polygon is itself a tile)
//   outline-simple no self-intersection, no point visited twice
//   mesh-structure arrays, indices, piece records, bbox, per-vertex piece
//   mesh-area     triangle areas sum to domainArea (1e-6 at amp 0, 1e-3 otherwise), piece areas add up, no dust pieces
//   mesh-inverted no inverted triangle; no point covered by two triangles
//   mesh-weld     manifold edges, Euler characteristic 1, the rim is one simple closed curve, no T-junction on the rim,
//                 every rim vertex lies on the tile boundary
//   tree          every piece is connected; the piece graph (pieces that share a triangle edge) is connected and
//                 acyclic; parent / depth are a breadth-first tree from the root; no piece is an orphan (each shares an
//                 edge with its parent); hinges lie on the shared crease with the piece on the left
//   root          the root is the piece of the nudged warped seed
//   locate        mesh.locate = brute-force point-in-triangle search at 300 random interior points, and at the
//                 centroid of every triangle; any query returns a valid piece index
//   boundary      boundary[] is the outline per edge; boundary[].cells are valid pieces that are really there
//   parity        hinge groups: even-parity pieces and odd-parity pieces each have total area = area(T);
//                 22x: together area(T), and the two sheets together cover T once pointwise
//   seams         glued boundary samples get pieces whose cells correspond under the gluing (same T-coordinates)
//
// ALL THREE FINDINGS BELOW WERE FAULTS OF THE CODE AND ARE FIXED (2026-11-09 afternoon, notes/core.md): addTriangle
// clips by every tile edge that a vertex of the clipped polygon is outside of, and every fine edge that the cut crosses
// twice is split (that removed the island, and a rarer hole that this sweep had not met); nearestTriangle searches the
// buckets in rings; a seed that is no seed gives the first preset's tile. One check of THIS file was wrong and was
// changed: "cone points" in checkDomain counted every rotation centre within 1e-7 of the boundary as a cone point
// that must be listed. A centre 1e-9 ... 1e-7 OUTSIDE the tile is not one (see the strict test in
// test/verify-topology.test.js); the check now has the merge tolerance of buildDomain as its grey zone.
//
// FINDINGS, 2026-11-09 (as written by the verifier; the tests that failed were left failing for the fixer):
//   1. "robust mesh: welded ..." and "robust mesh: pieces are connected ... tree ..."  —  src/mesh.js, addTriangle.
//      The half-planes a fine triangle is clipped by are taken from its three own vertices (u = om[a] | om[b] | om[c]).
//      With a wavy cut, a cut point made by one tile edge can lie strictly outside ANOTHER tile edge that none of the
//      three vertices is outside of (next to a tile corner, where a fine edge leaves through one warped edge and crosses
//      the continuation of the other). That triangle keeps the point; its neighbour, which does clip by the second
//      edge, cuts the shared fine edge again somewhere else. Result: a T-junction (the two neighbours no longer share
//      the edge: a slit in the rim that runs into an interior vertex), a rim vertex up to 1e-3 sizes outside the tile,
//      and in one case (632, pinned) six triangles at a corner that share no edge with the rest of the mesh: Euler
//      characteristic 2, two spurious pieces, one of them attached by the orphan fallback. About 1 wavy (amp 1) tile
//      in 600 (dev/verify-robust-tj.mjs: 12 of 7650 random seeds at amp 1, none of 15300 at amp 0.25 / 0.5; the
//      Wavy-slider sweep, VR_WAVY=100, met it at amp 0.125 and 0.64 too).
//   2. "robust locate speed ..."  —  src/mesh.js, nearestTriangle: `fx < 0 || fy < 0 || fx > n || fy > n` sends every
//      query outside the bucket grid's bounding square, even by a rounding error, to a scan of all triangles; and a
//      point whose own kaleidoscope cell holds no piece goes to the whole-mesh search first. Points ON the tile
//      boundary do both: every Float32 sample of some mirror edges of 2*22, the cone points, the corner samples.
//      40 - 140 microseconds a call instead of 0.5 - 1.5 on the Intel (20 - 35 instead of 0.2 on a lab box): as slow as,
//      or up to 3 times slower than, a brute-force scan of all triangles. 292 of the 4906 boundary samples and cone
//      points of the hinge groups' presets; 165 of 576 in 2*22.
//   3. "robust args: a non-finite seed ..."  —  src/domain.js, buildDomain: seed [NaN, 0] gives a domain with
//      poly = [], area 0 and no error; buildMesh then throws "TypeError: adj[p] is not iterable".
//
// Environment: VR_LEVEL=2 widens the adversarial sweep; VR_RANDOM=<n> random seeds per group (default 4);
// VR_SALT=<n> reseeds; VR_ONLY=<id,id> restricts the groups; VR_TIMING=0 skips the timing test;
// VR_WAVY=<n> sweeps the Wavy slider in n steps for every preset and 3 random seeds per group (lighter checks);
// VR_BASE=0 skips the standard cases (to run a VR_WAVY sweep alone).
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID, elementsNear, symmetryElements, contains } from '../src/groups.js';
import { apply, inverse, det, polyArea, classify, isoEquals } from '../src/geom.js';
import { makeWarp, clampSeed, buildDomain } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';

const LEVEL = +process.env.VR_LEVEL || 1;
const RANDOM = process.env.VR_RANDOM !== undefined ? +process.env.VR_RANDOM : 4;
const SALT = +process.env.VR_SALT || 0;
const ONLY = process.env.VR_ONLY ? process.env.VR_ONLY.split(',') : null;
const TIMING = process.env.VR_TIMING !== '0';
const WAVY = +process.env.VR_WAVY || 0;
const BASE = process.env.VR_BASE !== '0';
const THE_GROUPS = GROUPS.filter((g) => !ONLY || ONLY.includes(g.id));

const PRESET_AMPS = [0, 0.25, 0.5, 1];
const RANDOM_AMPS = [0.25, 0.5, 1];

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

// ---------------------------------------------------------------------------------------------------------------
// failure registry
// ---------------------------------------------------------------------------------------------------------------

const CHECKS = ['throws', 'domain', 'area', 'clamp', 'gluing', 'tiling', 'warp', 'outline', 'outline-ccw', 'outline-simple',
  'mesh-structure', 'mesh-area', 'mesh-inverted', 'mesh-weld', 'tree', 'root', 'locate', 'boundary', 'parity', 'seams'];
const failures = Object.fromEntries(CHECKS.map((k) => [k, []]));
const stats = {
  cases: 0, byClass: {}, maxAreaErr0: 0, maxAreaErrW: 0, maxOutlineAreaErr: 0, minEdge: Infinity, minPiece: Infinity, maxPieces: 0,
  maxTri: 0, locatePoints: 0, tilingPoints: 0, slow: [], coarseSelfX: 0, shortEdges: 0, microPieces: 0, orphanFallbacks: 0,
};

// ---------------------------------------------------------------------------------------------------------------
// small geometry helpers (independent of the code under test)
// ---------------------------------------------------------------------------------------------------------------

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = px - ax - t * dx, ey = py - ay - t * dy;
  return ex * ex + ey * ey;
}

/** Depth of (x, y) inside the counter-clockwise convex polygon: min signed distance to its edge lines (> 0 inside). */
function polyDepth(poly, x, y) {
  let mn = Infinity;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const s = (dx * (y - a[1]) - dy * (x - a[0])) / Math.hypot(dx, dy);
    if (s < mn) mn = s;
  }
  return mn;
}

/** Distance from (x, y) to the boundary of a polygon given as [[x, y], ...]. */
function polyBoundaryDist(poly, x, y) {
  let mn = Infinity;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const d = segDist(x, y, a[0], a[1], b[0], b[1]);
    if (d < mn) mn = d;
  }
  return mn;
}

const orient = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

const sameLine = (a, b) => Math.abs(a.ux * b.uy - a.uy * b.ux) < 1e-7 && Math.abs(-(b.px - a.px) * a.uy + (b.py - a.py) * a.ux) < 1e-7;

// ---------------------------------------------------------------------------------------------------------------
// the attack: seeds
// ---------------------------------------------------------------------------------------------------------------

/** Up to `max` lines nearest the point (cx, cy), preferring distinct directions. */
function nearestLines(lines, cx, cy, max) {
  const scored = lines.map((m) => {
    let ang = Math.atan2(m.uy, m.ux);
    if (ang < -1e-9) ang += Math.PI;
    if (ang >= Math.PI - 1e-9) ang -= Math.PI;
    return { m, d: Math.abs(-(cx - m.px) * m.uy + (cy - m.py) * m.ux), dir: Math.round(ang * 1e4) };
  }).sort((a, b) => a.d - b.d || a.dir - b.dir);
  const out = [], dirs = new Set();
  for (const s of scored) if (out.length < max && !dirs.has(s.dir)) { dirs.add(s.dir); out.push(s.m); }
  for (const s of scored) if (out.length < max && !out.includes(s.m)) out.push(s.m);
  return out;
}

function attackSeeds(group) {
  const out = [];
  const size = Math.sqrt(group.domainArea), delta = 0.06 * size;
  const [cx, cy] = group.center, { e1, e2 } = group;
  const lsum = Math.hypot(e1[0], e1[1]) + Math.hypot(e2[0], e2[1]);
  const el = symmetryElements(group, cx, cy, 0.75 * lsum);
  const metric = group.presets[0].metric;
  const add = (cls, desc, x, y) => out.push({ cls, desc, seed: [x, y], metric });
  const wide = LEVEL >= 2;

  // --- mirrors of G: the seed is clamped to delta from the line, on its own side (or a fixed side when exactly on it)
  const mirrors = nearestLines(el.mirrors, cx, cy, wide ? 3 : 2);
  mirrors.forEach((m, i) => {
    const nx = -m.uy, ny = m.ux;
    for (const [ti, t] of [0.2137 * size, 0].entries()) {
      for (const off of wide ? [0, 1e-14, -1e-14, 1e-11, -1e-9, 1e-7, -1e-5, 0.5 * delta, -0.999 * delta] : [0, 1e-13, -1e-9, 1e-5]) {
        add('mirror', `mirror ${i} (through ${m.px}, ${m.py} dir ${m.ux}, ${m.uy}) at t${ti} offset ${off}`, m.px + t * m.ux + off * nx, m.py + t * m.uy + off * ny);
      }
    }
  });

  // --- rotation centres of G: clamped radially to delta
  const cs = el.centers.map((c) => ({ c, d: Math.hypot(c.x - cx, c.y - cy) })).sort((a, b) => a.d - b.d || a.c.x - b.c.x || a.c.y - b.c.y);
  const centres = [], kinds = new Set();
  for (const s of cs) { const k = s.c.order + (s.c.onMirror ? '*' : ''); if (!kinds.has(k)) { kinds.add(k); centres.push(s.c); } }
  for (const s of cs) if (centres.length < (wide ? 5 : 3) && !centres.includes(s.c)) centres.push(s.c);
  centres.slice(0, wide ? 5 : 3).forEach((c, i) => {
    const polar = wide
      ? [[0, 0], [1e-14, 0], [1e-12, 1.0], [1e-9, Math.PI / 6], [1e-9, 2.2], [1e-6, Math.PI / 4], [1e-3 * size, Math.PI / 3], [0.999 * delta, Math.PI / 6], [0.999 * delta, 4.0], [1.001 * delta, 0], [1.001 * delta, Math.PI / 2]]
      : [[0, 0], [1e-13, 0], [1e-9, 1.0], [1e-5, Math.PI / 4], [0.999 * delta, Math.PI / 6], [1.001 * delta, 0]];
    for (const [r, th] of polar) add('centre', `centre ${i} (${c.x}, ${c.y}) order ${c.order}${c.onMirror ? ' on a mirror' : ''} + ${r} at angle ${th}`, c.x + r * Math.cos(th), c.y + r * Math.sin(th));
  });

  // --- creases: mirrors of the kaleidoscope that are not mirrors of G. Never clamped.
  if (group.kaleido) {
    const kel = symmetryElements(group.kaleido.group, cx, cy, 0.75 * lsum);
    const creases = nearestLines(kel.mirrors.filter((m) => !el.mirrors.some((g) => sameLine(g, m))), cx, cy, wide ? 4 : 2);
    creases.forEach((m, i) => {
      const nx = -m.uy, ny = m.ux;
      for (const [ti, t] of [0.2137 * size, 0, -0.5871 * size].slice(0, wide ? 3 : 2).entries()) {
        for (const off of wide ? [0, 1e-14, -1e-14, 1e-12, -1e-12, 1e-10, -1e-10, 3e-10, 1e-9, -1e-9, 1e-8, -1e-7, 1e-6, -1e-5, 1e-4, -1e-3] : [0, 1e-13, -1e-13, 1e-9, -1e-9, 1e-5, -1e-5]) {
          add('crease', `crease ${i} (through ${m.px}, ${m.py} dir ${m.ux}, ${m.uy}) at t${ti} offset ${off}`, m.px + t * m.ux + off * nx, m.py + t * m.uy + off * ny);
        }
      }
    });
  }

  // --- glide axes. Never clamped.
  nearestLines(el.glides, cx, cy, wide ? 3 : 2).forEach((m, i) => {
    const nx = -m.uy, ny = m.ux;
    for (const off of wide ? [0, 1e-14, -1e-12, 1e-9, -1e-6, 1e-4] : [0, 1e-12, -1e-6]) {
      add('glide', `glide axis ${i} (through ${m.px}, ${m.py} dir ${m.ux}, ${m.uy}) offset ${off}`, m.px + 0.1731 * size * m.ux + off * nx, m.py + 0.1731 * size * m.uy + off * ny);
    }
  });

  // --- exact symmetric positions
  add('symmetric', 'lattice origin', 0, 0);
  add('symmetric', 'cell centre', cx, cy);
  add('symmetric', 'e1/2', e1[0] / 2, e1[1] / 2);
  add('symmetric', 'e2/2', e2[0] / 2, e2[1] / 2);
  add('symmetric', '(e1+e2)/4', (e1[0] + e2[0]) / 4, (e1[1] + e2[1]) / 4);
  add('symmetric', '(e1-e2)/4', (e1[0] - e2[0]) / 4, (e1[1] - e2[1]) / 4);
  add('symmetric', '(e1+e2)/3', (e1[0] + e2[0]) / 3, (e1[1] + e2[1]) / 3);
  // the border of the central lattice cell, where the lattice shift of clampSeed rounds one way or the other
  add('symmetric', 'centre + e1/2', cx + e1[0] / 2, cy + e1[1] / 2);
  add('symmetric', 'centre - e2/2', cx - e2[0] / 2, cy - e2[1] / 2);
  add('symmetric', 'centre + (e1+e2)/2', cx + (e1[0] + e2[0]) / 2, cy + (e1[1] + e2[1]) / 2);
  add('symmetric', 'centre - (e1-e2)/2 + 1e-13', cx - (e1[0] - e2[0]) / 2 + 1e-13, cy - (e1[1] - e2[1]) / 2 - 1e-13);
  if (group.kaleido) {
    const T = group.kaleido.cell, k = T.length;
    const cen = [T.reduce((s, p) => s + p[0], 0) / k, T.reduce((s, p) => s + p[1], 0) / k];
    add('symmetric', 'centroid of the kaleidoscope cell', cen[0], cen[1]);
    if (k === 3) {
      const l = [0, 1, 2].map((i) => Math.hypot(T[(i + 1) % 3][0] - T[(i + 2) % 3][0], T[(i + 1) % 3][1] - T[(i + 2) % 3][1])), L = l[0] + l[1] + l[2];
      add('symmetric', 'incentre of the kaleidoscope cell', (l[0] * T[0][0] + l[1] * T[1][0] + l[2] * T[2][0]) / L, (l[0] * T[0][1] + l[1] * T[1][1] + l[2] * T[2][1]) / L);
    }
    for (let i = 0; i < k; i++) add('symmetric', `midpoint of side ${i} of the kaleidoscope cell`, (T[i][0] + T[(i + 1) % k][0]) / 2, (T[i][1] + T[(i + 1) % k][1]) / 2);
  }
  // images of the presets under the point group of the kaleidoscope (or of G): the same tiles, moved or mirrored
  const reps = (group.kaleido ? group.kaleido.group : group).reps;
  group.presets.forEach((p, pi) => {
    reps.slice(1, wide ? reps.length : 3).forEach((r, ri) => {
      const q = apply(r, p.seed[0], p.seed[1]);
      out.push({ cls: 'symmetric', desc: `image of preset ${pi} (${p.name}) under point-group element ${ri + 1}`, seed: q, metric: p.metric });
    });
  });

  // --- far outside the central cell
  const p0 = group.presets[0];
  const far = (m, n) => [p0.seed[0] + m * e1[0] + n * e2[0], p0.seed[1] + m * e1[1] + n * e2[1]];
  for (const [m, n] of wide ? [[4, -3], [-9, 2], [25, 17], [-30, -29]] : [[4, -3], [25, 17]]) {
    const q = far(m, n);
    out.push({ cls: 'far', desc: `preset 0 + ${m} e1 + ${n} e2`, seed: q, metric: p0.metric, lattice: [m, n] });
  }
  out.push({ cls: 'far', desc: 'generic point far away', seed: [cx + 7.1234 * lsum, cy - 5.8712 * lsum], metric: p0.metric });
  out.push({ cls: 'far', desc: 'generic point far away (2)', seed: [cx - 11.377 * lsum, cy + 13.019 * lsum], metric: p0.metric });
  return out;
}

// Seeds that broke something in the wider sweeps. The first three are absolute coordinates: they stay meaningful only
// while the lattice sizes in src/groupdata/hinge.js and crosscap.js stay as they were on 2026-11-09. The last two are
// pinned by preset because the roll agent was still tuning the lattices of src/groupdata/roll.js that afternoon; they
// may stop reproducing when those change (the *x one already did once).
const PINNED = [
  { id: '442', seed: [0.5162090719130434, 0.025244131352015236], amp: 1, why: 'T-junction on the rim next to the tile corner (0.8127, 0.1847)' },
  { id: '22x', seed: [0.636539277783595, 0.46648775520734487], amp: 1, why: 'T-junction on the rim next to the tile corner (0.5896, 0.0061)' },
  { id: '632', seed: [1.8031497699208558, -0.38512483477134285], amp: 1, why: 'T-junction on the rim next to the tile corner (2.0002, -0.4848), and an island of 6 triangles cut off at the corner (1.5802, -0.2425)' },
  { id: '**', preset: 0, amp: 0.99, why: 'T-junction on the rim where the wavy cut meets the mirror (found with VR_WAVY=100; roll.js of 15:11)' },
  { id: '*x', preset: 0, amp: 0.64, why: 'T-junction on the rim where the wavy cut meets the mirror (found with VR_WAVY=100; roll.js of 15:11)' },
];
const WAVY_AMPS = [1e-9, 1e-6, 1e-3, 0.03, 0.125, 0.3, 0.44, 0.625, 0.75, 0.875, 0.95];

function* allCases(group) {
  if (BASE) {
    for (const [i, p] of group.presets.entries()) {
      for (const amp of PRESET_AMPS) yield { cls: 'preset', desc: `preset ${i} (${p.name})`, seed: p.seed, metric: p.metric, amp };
    }
    // every attack seed at amp 0 with the full battery. At amp 1 the tile is the same polygon, so the domain-level
    // probes are thinned (light), and the classes whose seed is clamped to a generic position anyway (mirror, centre)
    // or merely translated (far) run every second seed. VR_LEVEL=2 runs everything in full.
    let k = 0;
    for (const c of attackSeeds(group)) {
      yield { ...c, amp: 0 };
      const thin = LEVEL < 2 && (c.cls === 'mirror' || c.cls === 'centre' || c.cls === 'far');
      if (!thin || k++ % 2 === 0) yield { ...c, amp: 1, light: LEVEL < 2 };
    }
    const rnd = prng(90001 + 131 * GROUPS.indexOf(group) + 7919 * SALT);
    for (let k = 0; k < RANDOM; k++) {
      const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
      const metric = group.presets[k % group.presets.length].metric;
      for (const amp of RANDOM_AMPS) yield { cls: 'random', desc: `random seed ${k}`, seed, metric, amp };
    }
    const p0 = group.presets[0];
    for (const amp of WAVY_AMPS) yield { cls: 'wavy', desc: `preset 0 (${p0.name}) along the Wavy slider`, seed: p0.seed, metric: p0.metric, amp, light: true };
    // the density option: N of the fine triangulation of a cell (default 22), or grid steps of a roll group (default 56)
    for (const density of group.kaleido ? [5, 13, 37] : [14, 33, 111]) {
      for (const amp of [0, 1]) yield { cls: 'density', desc: `preset 0 (${p0.name}) with density ${density}`, seed: p0.seed, metric: p0.metric, amp, density, light: true };
    }
    for (const q of PINNED) {
      if (q.id !== group.id) continue;
      const pp = q.preset !== undefined ? group.presets[q.preset] : null;
      yield { cls: 'pinned', desc: q.why, seed: pp ? pp.seed : q.seed, metric: pp ? pp.metric : q.metric, amp: q.amp };
    }
  }
  if (WAVY > 0) {
    const rnd = prng(31337 + 17 * GROUPS.indexOf(group) + 7919 * SALT);
    const seeds = group.presets.map((p, i) => ({ desc: `preset ${i} (${p.name})`, seed: p.seed, metric: p.metric }));
    for (let k = 0; k < 3; k++) seeds.push({ desc: `random seed ${k}`, seed: [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf], metric: group.presets[k % group.presets.length].metric });
    for (const q of seeds) for (let k = 1; k <= WAVY; k++) yield { cls: 'wavy', desc: `${q.desc} along the Wavy slider, step ${k} of ${WAVY}`, seed: q.seed, metric: q.metric, amp: k / WAVY, light: true };
  }
}

const labelOf = (group, c) => `${group.id} seed [${c.seed[0]}, ${c.seed[1]}]${c.metric ? ` metric [${c.metric.join(', ')}]` : ''} amp ${c.amp}${c.density ? ` density ${c.density}` : ''} {${c.cls}: ${c.desc}}`;

// ---------------------------------------------------------------------------------------------------------------
// domain checks
// ---------------------------------------------------------------------------------------------------------------

function checkDomain(group, c, d, label, F) {
  const size = Math.sqrt(group.domainArea), delta = 0.06 * size;
  const n = d.poly.length;
  if (!(n >= 3) || d.edges.length !== n) { F('domain', `${label}: polygon with ${n} vertices and ${d.edges.length} edges`); return false; }
  for (const p of d.poly) if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) { F('domain', `${label}: non-finite vertex`); return false; }
  const [px, py] = d.seed;
  const mag = Math.max(1, Math.abs(px), Math.abs(py));     // rounding grows with the size of the coordinates

  // area
  if (!(Math.abs(d.area - group.domainArea) < 1e-7 * mag)) F('area', `${label}: domain.area ${d.area} vs group.domainArea ${group.domainArea} (diff ${(d.area - group.domainArea).toExponential(2)})`);
  if (!(Math.abs(polyArea(d.poly) - d.area) < 1e-12 * mag * mag)) F('area', `${label}: domain.area ${d.area} is not the area of domain.poly ${polyArea(d.poly)}`);

  // convex, counter-clockwise, no short edges, seed strictly inside
  for (let i = 0; i < n; i++) {
    const a = d.poly[i], b = d.poly[(i + 1) % n], q = d.poly[(i + 2) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(len > 1e-9)) F('domain', `${label}: edge ${i} has length ${len} (<= 1e-9: must be merged)`);
    if (len < stats.minEdge) stats.minEdge = len;
    if (len < 1e-6 * size) stats.shortEdges++;
    if (!((b[0] - a[0]) * (q[1] - b[1]) - (b[1] - a[1]) * (q[0] - b[0]) > -1e-12 * mag)) F('domain', `${label}: reflex corner at vertex ${(i + 1) % n}`);
  }
  if (!(polyDepth(d.poly, px, py) > 1e-3 * delta)) F('domain', `${label}: the seed is not inside the tile (depth ${polyDepth(d.poly, px, py)})`);
  if (!d.contains(px, py, -1e-3 * delta)) F('domain', `${label}: contains(seed) is false`);

  // clamping: domain.seed is clampSeed(input) and has clearance delta from every mirror and centre of G
  const cl = clampSeed(group, c.seed[0], c.seed[1]);
  if (cl[0] !== px || cl[1] !== py) F('clamp', `${label}: domain.seed (${px}, ${py}) is not clampSeed(seed) (${cl[0]}, ${cl[1]})`);
  const again = clampSeed(group, px, py);
  if (again[0] !== px || again[1] !== py) F('clamp', `${label}: clampSeed is not idempotent: (${px}, ${py}) -> (${again[0]}, ${again[1]})`);
  const moved = Math.hypot(px - c.seed[0], py - c.seed[1]);
  const near = symmetryElements(group, px, py, 4 * delta + moved);
  let clearance = Infinity, clearIn = Infinity;
  for (const m of near.mirrors) {
    clearance = Math.min(clearance, Math.abs(-(px - m.px) * m.uy + (py - m.py) * m.ux));
    clearIn = Math.min(clearIn, Math.abs(-(c.seed[0] - m.px) * m.uy + (c.seed[1] - m.py) * m.ux));
  }
  for (const q of near.centers) {
    clearance = Math.min(clearance, Math.hypot(px - q.x, py - q.y));
    clearIn = Math.min(clearIn, Math.hypot(c.seed[0] - q.x, c.seed[1] - q.y));
  }
  if (!(clearance >= delta - 1e-12 * mag)) F('clamp', `${label}: clamped seed (${px}, ${py}) is ${clearance / delta} delta from a mirror or centre`);
  if (clearIn >= delta * (1 + 1e-9) && moved !== 0) F('clamp', `${label}: a clear seed (clearance ${clearIn / delta} delta) was moved by ${moved}`);
  if (!(moved < 6 * delta + 1e-9 * mag)) F('clamp', `${label}: the seed was moved by ${moved / delta} delta`);

  // gluing. buildDomain merges vertices closer than 1e-9 (SPEC 5.1): next to a merged corner the end points of glued
  // edges correspond to about 2e-9 only, so the tolerance is 5e-9, not 1e-9
  const [q11, q12, q22] = d.metric;
  const tolG = 5e-9 * mag;
  let classes = 0;
  const perClass = new Map();
  for (let i = 0; i < n; i++) {
    const e = d.edges[i], j = e.partner;
    if (!(Number.isInteger(j) && j >= 0 && j < n)) { F('gluing', `${label}: edge ${i} has partner ${j}`); continue; }
    const f = d.edges[j];
    if (f.partner !== i) F('gluing', `${label}: partner of partner of edge ${i} is ${f.partner}`);
    if (!contains(group, e.g, 1e-6 * mag)) F('gluing', `${label}: g of edge ${i} is not in the group`);
    if (!isoEquals(f.g, inverse(e.g), 1e-7 * mag)) F('gluing', `${label}: partner ${j} of edge ${i} does not carry the inverse element`);
    const a = d.poly[i], b = d.poly[(i + 1) % n], a2 = d.poly[j], b2 = d.poly[(j + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), len2 = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]);
    if (!(Math.abs(len - len2) < tolG)) F('gluing', `${label}: edge ${i} has length ${len}, its partner ${j} has ${len2}`);
    if (e.len !== undefined && !(Math.abs(e.len - len) < 1e-12 * mag)) F('gluing', `${label}: edges[${i}].len`);
    const gi = inverse(e.g), ia = apply(gi, a[0], a[1]), ib = apply(gi, b[0], b[1]);
    const D = det(e.g);
    const [ta, tb] = D > 0 ? [b2, a2] : [a2, b2];       // rotations and translations reverse the direction of travel, glides keep it
    const miss = Math.max(Math.hypot(ia[0] - ta[0], ia[1] - ta[1]), Math.hypot(ib[0] - tb[0], ib[1] - tb[1]));
    if (!(miss < tolG)) F('gluing', `${label}: inverse(g) maps the end points of edge ${i} ${miss.toExponential(2)} away from those of edge ${j}`);
    if (e.rev !== undefined && e.rev !== (D > 0)) F('gluing', `${label}: rev flag of edge ${i}`);
    const cg = classify(e.g);
    if (e.kind === 'mirror') {
      if (cg.type !== 'reflection' || j !== i || e.cls !== -1 || e.halfTurn) F('gluing', `${label}: mirror edge ${i} (${cg.type}, partner ${j}, cls ${e.cls})`);
    } else if (e.kind === 'cut') {
      if (cg.type === 'reflection' || cg.type === 'identity') F('gluing', `${label}: cut edge ${i} carries a ${cg.type}`);
      if (!(e.cls >= 0 && e.cls < d.classes) || f.cls !== e.cls) F('gluing', `${label}: class of edge ${i}: ${e.cls} / ${f.cls} of ${d.classes}`);
      const half = cg.type === 'rotation' && cg.order === 2;
      if (e.halfTurn !== half) F('gluing', `${label}: halfTurn flag of edge ${i}`);
      if (half) {
        if (j !== i) F('gluing', `${label}: half-turn edge ${i} is glued to ${j}`);
        if (!(Math.hypot(cg.center[0] - (a[0] + b[0]) / 2, cg.center[1] - (a[1] + b[1]) / 2) < tolG)) F('gluing', `${label}: the centre of half-turn edge ${i} is not its midpoint`);
      } else if (j === i) F('gluing', `${label}: edge ${i} (${cg.type}) is glued to itself`);
      if (!perClass.has(e.cls)) { perClass.set(e.cls, new Set()); classes++; }
      perClass.get(e.cls).add(i).add(j);
    } else F('gluing', `${label}: edge ${i} has kind ${e.kind}`);
    // the edge is the Q-bisector of the seed and g(seed); normalised outward normal
    const q = apply(e.g, px, py);
    const nx = q11 * (q[0] - px) + q12 * (q[1] - py), ny = q12 * (q[0] - px) + q22 * (q[1] - py), nl = Math.hypot(nx, ny);
    if (!(Math.abs(Math.hypot(e.nx, e.ny) - 1) < 1e-12)) F('gluing', `${label}: normal of edge ${i} is not a unit vector`);
    if (!(Math.abs(nx * e.ny - ny * e.nx) < 1e-9 * nl * mag && nx * e.nx + ny * e.ny > 0)) F('gluing', `${label}: normal of edge ${i} is not Q(g(seed) - seed)`);
    for (const v of [a, b]) {
      if (!(Math.abs(e.nx * v[0] + e.ny * v[1] - e.c) < tolG)) F('gluing', `${label}: an end point of edge ${i} is ${Math.abs(e.nx * v[0] + e.ny * v[1] - e.c)} off its line`);
      const dp = (v[0] - px) * (q11 * (v[0] - px) + q12 * (v[1] - py)) + (v[1] - py) * (q12 * (v[0] - px) + q22 * (v[1] - py));
      const dq = (v[0] - q[0]) * (q11 * (v[0] - q[0]) + q12 * (v[1] - q[1])) + (v[1] - q[1]) * (q12 * (v[0] - q[0]) + q22 * (v[1] - q[1]));
      // squared distances: a point delta off the bisector differs by 2 delta |g(seed) - seed|
      if (!(Math.abs(dp - dq) < 4 * tolG * Math.max(1, nl))) F('gluing', `${label}: an end point of edge ${i} is not equidistant from the seed and g(seed) (squared Q-distances differ by ${Math.abs(dp - dq).toExponential(2)})`);
    }
  }
  if (classes !== d.classes) F('gluing', `${label}: ${classes} classes found, domain.classes = ${d.classes}`);
  for (const [k, set] of perClass) if (set.size > 2) F('gluing', `${label}: class ${k} holds ${set.size} edges`);

  // cone points: the rotation centres of G ON the boundary, each listed once. buildDomain merges vertices closer than
  // 1e-9 (SPEC 5.1), so "on" has that much play and no more: a centre within 0.5e-9 of the boundary must be listed, one
  // further than 1e-8 from it must not be, and in between either answer is right. (A seed 1e-9 .. 1e-7 off a crease
  // has rotation centres that far OUTSIDE the tile: the glued twins of the cone points on its tiny edges. They are
  // not cone points of this tile. This check used to count everything within 1e-7 as "on the boundary", as
  // buildDomain did until 2026-11-09; test/verify-topology.test.js has the strict test.)
  let rmax = 0;
  for (const v of d.poly) rmax = Math.max(rmax, Math.hypot(v[0] - px, v[1] - py));
  const around = symmetryElements(group, px, py, rmax + 0.01);
  const must = around.centers.filter((q) => Math.abs(polyDepth(d.poly, q.x, q.y)) < 0.5e-9 + 1e-13 * mag);
  const may = around.centers.filter((q) => Math.abs(polyDepth(d.poly, q.x, q.y)) < 1e-8 * mag);
  if (d.conePoints.length < must.length || d.conePoints.length > may.length) F('gluing', `${label}: ${d.conePoints.length} cone points listed, ${must.length} rotation centres lie on the boundary${may.length > must.length ? ` (${may.length} within 1e-8 of it)` : ''}`);
  for (const q of must) {
    if (!d.conePoints.some((p) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-7 * mag)) F('gluing', `${label}: rotation centre (${q.x}, ${q.y}) on the boundary is not listed`);
  }
  d.conePoints.forEach((p, k) => {
    const q = may.find((r) => Math.hypot(p.x - r.x, p.y - r.y) < 1e-7 * mag);
    if (!q) F('gluing', `${label}: cone point (${p.x}, ${p.y}) is not a rotation centre within 1e-8 of the boundary (depth ${polyDepth(d.poly, p.x, p.y).toExponential(2)})`);
    else if (p.order !== q.order || p.onMirror !== q.onMirror) F('gluing', `${label}: cone point (${q.x}, ${q.y}) order / onMirror`);
    if (d.conePoints.some((r, j) => j < k && Math.hypot(p.x - r.x, p.y - r.y) < 1e-7 * mag)) F('gluing', `${label}: cone point (${p.x}, ${p.y}) is listed twice`);
  });
  for (const q of around.centers) if (polyDepth(d.poly, q.x, q.y) > 1e-7 * mag) F('gluing', `${label}: rotation centre (${q.x}, ${q.y}) is interior to the tile`);
  return true;
}

/** Tiling property and warp round trip. */
function checkTiling(group, d, label, rnd, F, nRandom) {
  const [sx, sy] = d.seed, size = Math.sqrt(group.domainArea);
  const mag = Math.max(1, Math.abs(sx), Math.abs(sy));
  const n = d.poly.length;
  let rmax = 0;
  for (const v of d.poly) rmax = Math.max(rmax, Math.hypot(v[0] - sx, v[1] - sy));
  const W = 1.5 * group.viewHalf;
  // a probe lies within max(W sqrt2, rmax + 1e-3 sizes) of the seed, the tile holding it within rmax of the probe
  const els = elementsNear(group, sx, sy, Math.max(W * Math.SQRT2, rmax) + rmax + 0.2 * size + 1e-6, sx, sy);
  const inv = els.map(inverse), img = els.map((g) => apply(g, sx, sy));
  // tiles fit to the merge tolerance of buildDomain (1e-9 per merged vertex), so "on the boundary" means within 5e-9
  const eps = 5e-9 * mag, r2 = (rmax + 1e-6) ** 2;
  const y = [0, 0], z = [0, 0], w = [0, 0];
  let bad = 0;
  const probe = (y0, y1, what) => {
    let loose = 0, strict = 0;
    for (let k = 0; k < els.length; k++) {
      const p = img[k], dx = y0 - p[0], dy = y1 - p[1];
      if (dx * dx + dy * dy > r2) continue;                 // the tile g(D) lies within rmax of g(seed)
      apply(inv[k], y0, y1, z);
      const depth = polyDepth(d.poly, z[0], z[1]);
      if (depth >= -eps) loose++;
      if (depth >= eps) strict++;
      if (Math.abs(depth) > 1e-7 * mag && d.contains(z[0], z[1], 0) !== (depth > 0) && bad++ < 2) F('tiling', `${label}: contains() disagrees with domain.poly at (${z[0]}, ${z[1]}), depth ${depth}`);
    }
    stats.tilingPoints++;
    // a tiling up to eps: no gap wider than eps (some tile holds the point, loosely) and no overlap deeper than eps
    // (at most one tile holds it strictly). Within eps of an edge anything from (1, 0) to (several, 0) is legitimate.
    if (!(loose >= 1 && strict <= 1) && bad++ < 3) F('tiling', `${label}: ${what} (${y0}, ${y1}) [straight coordinates] lies in ${loose} tiles (to within ${eps.toExponential(0)}), deeper than that inside ${strict}`);
  };
  for (let k = 0; k < nRandom; k++) {
    const x0 = sx + (2 * rnd() - 1) * W, x1 = sy + (2 * rnd() - 1) * W;
    d.warp.inv(x0, x1, y);                                   // x in g psi(D) = psi(g D)  <=>  g^-1 psi^-1(x) in D
    d.warp.fwd(y[0], y[1], w);
    const rt = Math.hypot(w[0] - x0, w[1] - x1);
    if (!(rt < 1e-11 * mag) && bad++ < 3) F('warp', `${label}: fwd(inv(x)) is ${rt.toExponential(2)} from x = (${x0}, ${x1})`);
    probe(y[0], y[1], `random point (${x0}, ${x1}) -> psi^-1`);
  }
  // around every corner and edge midpoint of the tile: where a mis-merged vertex or a dropped edge would show
  for (let i = 0; i < n; i++) {
    const a = d.poly[i], b = d.poly[(i + 1) % n];
    for (const [vx, vy, what] of [[a[0], a[1], `corner ${i}`], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, `midpoint of edge ${i}`]]) {
      for (const r of [1e-7, 1e-5, 1e-3]) {
        for (let k = 0; k < 5; k++) {
          const th = 0.2917 + (2 * Math.PI * k) / 5;
          probe(vx + r * size * Math.cos(th), vy + r * size * Math.sin(th), `point ${r} sizes from ${what}`);
        }
      }
    }
  }
}

/** outline(maxStep): structure, closure, orientation, enclosed area, simplicity. Returns the loop of the finest outline. */
function checkOutline(group, d, maxStep, label, F, strictSimple = true) {
  const size = Math.sqrt(group.domainArea), n = d.poly.length;
  const mag = Math.max(1, Math.abs(d.seed[0]), Math.abs(d.seed[1]));
  const what = `outline(${maxStep === undefined ? '' : maxStep})`;
  const out = d.outline(maxStep);
  if (!Array.isArray(out) || out.length !== n) { F('outline', `${label}: ${what} has ${out && out.length} entries for ${n} edges`); return null; }
  const step = maxStep === undefined ? size / 32 : maxStep;
  const lx = [], ly = [], w = [0, 0];
  const tolP = 1e-6 * mag;
  for (let i = 0; i < n; i++) {
    const o = out[i];
    if (!o || o.edge !== i || !(o.pts instanceof Float32Array) || o.pts.length < 6 || o.pts.length % 2) { F('outline', `${label}: ${what}[${i}] is malformed`); return null; }
    const m = o.pts.length / 2 - 1;
    if (m % 2) F('outline', `${label}: ${what}[${i}] has an odd number of steps (${m})`);
    const a = d.poly[i], b = d.poly[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(len / m <= step * (1 + 1e-9) + 1e-12)) F('outline', `${label}: ${what}[${i}] has steps of ${len / m} > maxStep ${step}`);
    if (out[d.edges[i].partner].pts.length !== o.pts.length) F('outline', `${label}: ${what}[${i}] and its partner have different numbers of samples`);
    let worst = 0;
    for (let k = 0; k <= m; k++) {
      if (!Number.isFinite(o.pts[2 * k]) || !Number.isFinite(o.pts[2 * k + 1])) { F('outline', `${label}: ${what}[${i}] has a non-finite point`); return null; }
      d.warp.fwd(a[0] + (k / m) * (b[0] - a[0]), a[1] + (k / m) * (b[1] - a[1]), w);
      worst = Math.max(worst, Math.hypot(o.pts[2 * k] - w[0], o.pts[2 * k + 1] - w[1]));
      if (k < m) { lx.push(o.pts[2 * k]); ly.push(o.pts[2 * k + 1]); }
    }
    if (!(worst < tolP)) F('outline', `${label}: ${what}[${i}] is ${worst.toExponential(2)} from warp.fwd of the straight edge`);
    const nx = out[(i + 1) % n].pts;
    if (o.pts[2 * m] !== nx[0] || o.pts[2 * m + 1] !== nx[1]) F('outline', `${label}: ${what}: edge ${i} does not end where edge ${(i + 1) % n} starts (the loop is not closed)`);
    // glued partner: inverse(g) maps sample k of edge i onto sample (m - k) (rotations, translations) or k (glides) of edge j
    const e = d.edges[i], gi = inverse(e.g), pj = out[e.partner].pts, rev = det(e.g) > 0;
    if (pj.length === o.pts.length) {
      let wj = 0;
      for (let k = 0; k <= m; k++) {
        apply(gi, o.pts[2 * k], o.pts[2 * k + 1], w);
        const kk = rev ? m - k : k;
        wj = Math.max(wj, Math.hypot(pj[2 * kk] - w[0], pj[2 * kk + 1] - w[1]));
      }
      if (!(wj < 2 * tolP)) F('outline', `${label}: ${what}: samples of edge ${i} do not map onto those of its partner ${e.partner} under inverse(g) (${wj.toExponential(2)})`);
    }
  }
  // counter-clockwise, enclosing exactly the domain area (the chord errors of glued partners cancel)
  const N = lx.length;
  let area = 0;
  for (let i = 0; i < N; i++) { const j = i + 1 === N ? 0 : i + 1; area += lx[i] * ly[j] - ly[i] * lx[j]; }
  area /= 2;
  if (!(area > 0)) F('outline-ccw', `${label}: ${what} is not counter-clockwise (signed area ${area})`);
  const errA = Math.abs(area - group.domainArea);
  if (errA > stats.maxOutlineAreaErr && mag < 2) stats.maxOutlineAreaErr = errA;
  if (!(errA < 3e-6 * mag * size)) F('outline-ccw', `${label}: ${what} encloses ${area}, the domain area is ${group.domainArea} (diff ${(area - group.domainArea).toExponential(2)})`);

  // simple: drop consecutive duplicates (an edge shorter than Float32 resolves), then no repeated point, no crossing
  const qx = [], qy = [];
  for (let i = 0; i < N; i++) {
    const k = qx.length;
    if (k && qx[k - 1] === lx[i] && qy[k - 1] === ly[i]) continue;
    qx.push(lx[i]); qy.push(ly[i]);
  }
  while (qx.length > 1 && qx[0] === qx[qx.length - 1] && qy[0] === qy[qy.length - 1]) { qx.pop(); qy.pop(); }
  const M = qx.length;
  const seen = new Map();
  for (let i = 0; i < M; i++) {
    const key = qx[i] + ',' + qy[i];
    if (seen.has(key)) { if (strictSimple) F('outline-simple', `${label}: ${what} visits the point (${qx[i]}, ${qy[i]}) twice (loop positions ${seen.get(key)} and ${i} of ${M})`); else stats.coarseSelfX++; break; }
    seen.set(key, i);
  }
  // the loop never doubles back on itself (a spike)
  for (let i = 0; i < M && strictSimple; i++) {
    const i0 = i === 0 ? M - 1 : i - 1, i1 = i + 1 === M ? 0 : i + 1;
    const ux = qx[i] - qx[i0], uy = qy[i] - qy[i0], vx = qx[i1] - qx[i], vy = qy[i1] - qy[i];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (lu < 1e-5 * mag || lv < 1e-5 * mag) continue;       // too short for Float32 to give a direction
    if (ux * vx + uy * vy < 0 && Math.abs(ux * vy - uy * vx) < 2e-3 * lu * lv) { F('outline-simple', `${label}: ${what} doubles back on itself at (${qx[i]}, ${qy[i]})`); break; }
  }
  const res = 4e-7 * mag;      // crossings this close to an end point are Float32 rounding of a very short edge, not geometry
  outer:
  for (let i = 0; i < M; i++) {
    const ax = qx[i], ay = qy[i], i1 = i + 1 === M ? 0 : i + 1, bx = qx[i1], by = qy[i1];
    for (let j = i + 2; j < M; j++) {
      const j1 = j + 1 === M ? 0 : j + 1;
      if (j1 === i) continue;
      const cx = qx[j], cy = qy[j], ex = qx[j1], ey = qy[j1];
      if (Math.max(cx, ex) < Math.min(ax, bx) || Math.min(cx, ex) > Math.max(ax, bx) || Math.max(cy, ey) < Math.min(ay, by) || Math.min(cy, ey) > Math.max(ay, by)) continue;
      const d1 = orient(cx, cy, ex, ey, ax, ay), d2 = orient(cx, cy, ex, ey, bx, by), d3 = orient(ax, ay, bx, by, cx, cy), d4 = orient(ax, ay, bx, by, ex, ey);
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        const t = d1 / (d1 - d2), ix = ax + t * (bx - ax), iy = ay + t * (by - ay);
        const nearEnd = Math.min(Math.hypot(ix - ax, iy - ay), Math.hypot(ix - bx, iy - by), Math.hypot(ix - cx, iy - cy), Math.hypot(ix - ex, iy - ey));
        if (nearEnd < res) continue;
        if (strictSimple) F('outline-simple', `${label}: ${what} crosses itself at (${ix}, ${iy}): segments ${i} and ${j} of ${M}`); else stats.coarseSelfX++;
        break outer;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// mesh checks
// ---------------------------------------------------------------------------------------------------------------

function checkMesh(group, c, d, mesh, label, rnd, F, nLocate = 300) {
  const amp = c.amp;
  const size = Math.sqrt(group.domainArea);
  // a coarser mesh (density option) has longer chords along the wavy boundary: its sagitta grows with the square
  const coarse = c.density ? Math.max(1, ((group.kaleido ? 22 : 56) / c.density) ** 2) : 1;
  const mag = Math.max(1, Math.abs(d.seed[0]), Math.abs(d.seed[1]));
  const res32 = 1.2e-7 * mag;                 // Float32 resolution of a coordinate
  const { n, xy, tri, cells } = mesh;
  const T = group.kaleido ? group.kaleido.cell : null;

  // ---- structure
  if (!Number.isInteger(n) || !(xy instanceof Float32Array) || xy.length !== 2 * n) { F('mesh-structure', `${label}: xy / n`); return; }
  if (!(tri instanceof Uint32Array) || tri.length % 3) { F('mesh-structure', `${label}: tri`); return; }
  const m = tri.length / 3;
  if (mesh.m !== undefined && mesh.m !== m) F('mesh-structure', `${label}: mesh.m`);
  if (!(mesh.cell instanceof Uint16Array) || mesh.cell.length !== n) { F('mesh-structure', `${label}: cell`); return; }
  if (!Array.isArray(cells) || cells.length < 1) { F('mesh-structure', `${label}: cells`); return; }
  const P = cells.length;
  if (m < 1) { F('mesh-structure', `${label}: the mesh has no triangles`); return; }
  if (!Number.isInteger(mesh.root) || mesh.root < 0 || mesh.root >= P) { F('mesh-structure', `${label}: root ${mesh.root}`); return; }
  for (let i = 0; i < xy.length; i++) if (!Number.isFinite(xy[i])) { F('mesh-structure', `${label}: non-finite vertex coordinate`); return; }
  for (let i = 0; i < tri.length; i++) if (tri[i] >= n) { F('mesh-structure', `${label}: vertex index out of range`); return; }
  stats.maxPieces = Math.max(stats.maxPieces, P);
  stats.maxTri = Math.max(stats.maxTri, m);

  // per-triangle piece: the documented extra `triCell`, else by locating the centroid
  let triCell = mesh.triCell;
  if (!(triCell instanceof Uint16Array) || triCell.length !== m) {
    triCell = new Uint16Array(m);
    for (let t = 0; t < m; t++) {
      const a = tri[3 * t], b = tri[3 * t + 1], q = tri[3 * t + 2];
      triCell[t] = mesh.locate((xy[2 * a] + xy[2 * b] + xy[2 * q]) / 3, (xy[2 * a + 1] + xy[2 * b + 1] + xy[2 * q + 1]) / 3);
    }
  }
  for (let t = 0; t < m; t++) if (triCell[t] >= P) { F('mesh-structure', `${label}: triangle piece out of range`); return; }

  const used = new Uint8Array(n);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let t = 0; t < m; t++) for (let e = 0; e < 3; e++) used[tri[3 * t + e]] = 1;
  let unused = 0, wrongCell = 0;
  for (let v = 0; v < n; v++) {
    if (!used[v]) unused++;
    if (mesh.cell[v] >= P) wrongCell++;
    bx0 = Math.min(bx0, xy[2 * v]); bx1 = Math.max(bx1, xy[2 * v]); by0 = Math.min(by0, xy[2 * v + 1]); by1 = Math.max(by1, xy[2 * v + 1]);
  }
  if (unused) F('mesh-structure', `${label}: ${unused} vertices belong to no triangle`);
  if (wrongCell) F('mesh-structure', `${label}: ${wrongCell} vertices carry an invalid piece index`);
  // SPEC: cell[v] is a piece around the vertex ("for a vertex on a crease: either neighbour")
  {
    const around = Array.from({ length: n }, () => null);
    for (let t = 0; t < m; t++) for (let e = 0; e < 3; e++) { const v = tri[3 * t + e]; (around[v] ||= new Set()).add(triCell[t]); }
    let badV = -1;
    for (let v = 0; v < n; v++) if (around[v] && !around[v].has(mesh.cell[v])) { badV = v; break; }
    if (badV >= 0) F('mesh-structure', `${label}: cell[${badV}] = ${mesh.cell[badV]} is not a piece around that vertex`);
  }
  if (!Array.isArray(mesh.bbox) || [bx0, by0, bx1, by1].some((v, i) => !(Math.abs(v - mesh.bbox[i]) < 1e-6 * mag))) F('mesh-structure', `${label}: bbox ${mesh.bbox} vs [${bx0}, ${by0}, ${bx1}, ${by1}]`);
  for (let i = 0; i < P; i++) {
    const q = cells[i];
    if (q.index !== i) F('mesh-structure', `${label}: cells[${i}].index = ${q.index}`);
    if (!q.g || q.parity !== (det(q.g) > 0 ? 0 : 1)) F('mesh-structure', `${label}: parity of piece ${i}`);
    if (T) {
      const ok = q.poly && q.poly.length === T.length && q.poly.every((p, k) => { const u = apply(q.g, T[k][0], T[k][1]); return Math.hypot(p[0] - u[0], p[1] - u[1]) < 1e-12 * mag; });
      if (!ok) F('mesh-structure', `${label}: cells[${i}].poly is not g(T)`);
      if (!contains(group.kaleido.group, q.g, 1e-6 * mag)) F('mesh-structure', `${label}: cells[${i}].g is not an element of the kaleidoscope`);
    } else if (q.poly !== null || P !== 1 || !isoEquals(q.g, { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 })) F('mesh-structure', `${label}: pseudo-cell record`);
  }

  // ---- areas, orientation
  const area2 = new Float64Array(m), longest = new Float64Array(m), pieceArea = new Float64Array(P);
  const cenX = new Float64Array(P), cenY = new Float64Array(P);
  let total = 0, inverted = 0, worstH = 0;
  for (let t = 0; t < m; t++) {
    const a = tri[3 * t], b = tri[3 * t + 1], q = tri[3 * t + 2];
    const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1], qx = xy[2 * q], qy = xy[2 * q + 1];
    const a2 = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
    area2[t] = a2; total += a2 / 2; pieceArea[triCell[t]] += a2 / 2;
    cenX[triCell[t]] += (a2 / 2) * (ax + bx + qx) / 3; cenY[triCell[t]] += (a2 / 2) * (ay + by + qy) / 3;
    longest[t] = Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(qx - bx, qy - by), Math.hypot(ax - qx, ay - qy));
    // xy is Float32: a sliver thinner than its rounding can come out with a tiny negative area; a triangle that is
    // really the wrong way round has a negative height of the order of the mesh size
    const h = a2 / (longest[t] || 1);
    if (h < -8 * res32) { inverted++; if (h < worstH) worstH = h; }
  }
  if (inverted) F('mesh-inverted', `${label}: ${inverted} inverted triangles (worst height ${worstH.toExponential(2)})`);
  const relErr = Math.abs(total - group.domainArea) / group.domainArea;
  if (mag < 2) { if (amp === 0) stats.maxAreaErr0 = Math.max(stats.maxAreaErr0, relErr); else stats.maxAreaErrW = Math.max(stats.maxAreaErrW, relErr); }
  if (!(relErr < (amp === 0 ? 1e-6 * mag : 1e-3 * coarse))) F('mesh-area', `${label}: triangle areas sum to ${total}, domain area ${group.domainArea} (relative error ${relErr.toExponential(2)})`);
  let sumPieces = 0;
  for (let p = 0; p < P; p++) {
    sumPieces += cells[p].area;
    if (!(Math.abs(pieceArea[p] - cells[p].area) < 1e-6 * group.domainArea * mag)) F('mesh-area', `${label}: cells[${p}].area ${cells[p].area} vs its triangles ${pieceArea[p]}`);
    if (!(cells[p].area > 0)) F('mesh-area', `${label}: piece ${p} has area ${cells[p].area}`);
    if (cells[p].area < stats.minPiece) stats.minPiece = cells[p].area;
    if (cells[p].area < 1e-10) stats.microPieces++;
  }
  if (!(Math.abs(sumPieces - group.domainArea) < (amp === 0 ? 1e-6 * mag : 1e-3 * coarse) * group.domainArea)) F('mesh-area', `${label}: piece areas sum to ${sumPieces}`);

  // ---- edges: manifold, Euler characteristic, rim
  const eIdx = new Map();
  let eu = new Int32Array(2 * m + 64), ev = new Int32Array(2 * m + 64), et0 = new Int32Array(2 * m + 64), et1 = new Int32Array(2 * m + 64), ecnt = new Uint8Array(2 * m + 64), edir = new Int8Array(2 * m + 64), ne = 0;
  for (let t = 0; t < m; t++) {
    for (let e = 0; e < 3; e++) {
      const u = tri[3 * t + e], v = tri[3 * t + (e + 1) % 3];
      const lo = u < v ? u : v, hi = u < v ? v : u, key = lo * n + hi;
      let k = eIdx.get(key);
      if (k === undefined) {
        if (ne === eu.length) { const g = (A) => { const B = new A.constructor(2 * A.length); B.set(A); return B; }; eu = g(eu); ev = g(ev); et0 = g(et0); et1 = g(et1); ecnt = g(ecnt); edir = g(edir); }
        k = ne++; eIdx.set(key, k); eu[k] = u; ev[k] = v; et0[k] = t; et1[k] = -1;
      } else if (ecnt[k] === 1) et1[k] = t;
      ecnt[k]++; edir[k] += u < v ? 1 : -1;
    }
  }
  let nonManifold = 0, degenerate = 0;
  const rim = [];
  for (let k = 0; k < ne; k++) {
    if (eu[k] === ev[k]) degenerate++;
    if (ecnt[k] === 1) rim.push(k);
    else if (ecnt[k] !== 2 || edir[k] !== 0) nonManifold++;
  }
  if (degenerate) F('mesh-weld', `${label}: ${degenerate} triangle edges join a vertex to itself`);
  if (nonManifold) F('mesh-weld', `${label}: ${nonManifold} non-manifold or inconsistently oriented edges`);
  if (n - ne + m !== 1) F('mesh-weld', `${label}: Euler characteristic V - E + F = ${n - ne + m} (cracks, holes or unwelded vertices)`);
  const rimDeg = new Map();
  for (const k of rim) { rimDeg.set(eu[k], (rimDeg.get(eu[k]) || 0) + 1); rimDeg.set(ev[k], (rimDeg.get(ev[k]) || 0) + 1); }
  let badDeg = 0;
  for (const dg of rimDeg.values()) if (dg !== 2) badDeg++;
  if (badDeg) F('mesh-weld', `${label}: ${badDeg} rim vertices do not have exactly two rim edges (the rim is not a simple closed curve)`);
  else {
    // ... and it is ONE loop
    const next = new Map();
    for (const k of rim) { for (const [a, b] of [[eu[k], ev[k]], [ev[k], eu[k]]]) { if (!next.has(a)) next.set(a, []); next.get(a).push(b); } }
    const seenV = new Set();
    let loops = 0;
    for (const start of next.keys()) {
      if (seenV.has(start)) continue;
      loops++;
      let prev = -1, cur = start;
      for (let guard = 0; guard <= next.size; guard++) {
        seenV.add(cur);
        const nb = next.get(cur), nx = nb[0] !== prev ? nb[0] : nb[1];
        prev = cur; cur = nx;
        if (cur === start) break;
      }
    }
    if (loops !== 1) F('mesh-weld', `${label}: the rim consists of ${loops} closed loops`);
  }
  // unwelded duplicates: two different vertices at the same Float64-rounded position are fine only if truly distinct
  // points; here: no two vertices of one triangle coincide beyond Float32
  // T-junctions: a rim vertex lying on a rim edge it is not an end of (two fine triangles disagree about a cut point)
  {
    let tj = null;
    const tolT = 2 * res32;
    for (const v of rimDeg.keys()) {
      const px = xy[2 * v], py = xy[2 * v + 1];
      for (const k of rim) {
        const a = eu[k], b = ev[k];
        if (a === v || b === v) continue;
        const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1];
        if (px < Math.min(ax, bx) - tolT || px > Math.max(ax, bx) + tolT || py < Math.min(ay, by) - tolT || py > Math.max(ay, by) + tolT) continue;
        if (Math.hypot(px - ax, py - ay) < 1e-5 * mag || Math.hypot(px - bx, py - by) < 1e-5 * mag) continue;
        if (segDist(px, py, ax, ay, bx, by) < tolT) { tj = `rim vertex ${v} (${px}, ${py}) lies on the rim edge ${a}-${b} [(${ax}, ${ay}) - (${bx}, ${by})]`; break; }
      }
      if (tj) break;
    }
    if (tj) F('mesh-weld', `${label}: T-junction / slit on the rim: ${tj}`);
  }
  // every rim vertex is on the tile boundary (a cut point is an exact crossing; chord-chord cuts at a tile corner are
  // within the sagitta of the wavy edge), and the rim is as long as the outline
  {
    const y = [0, 0];
    const tolRim = amp === 0 ? 20 * res32 : 1e-2 * size * coarse;
    let worst = 0, worstV = -1;
    for (const v of rimDeg.keys()) {
      d.warp.inv(xy[2 * v], xy[2 * v + 1], y);
      const dist = polyBoundaryDist(d.poly, y[0], y[1]);
      if (dist > worst) { worst = dist; worstV = v; }
    }
    if (worst > tolRim) F('mesh-weld', `${label}: rim vertex ${worstV} (${xy[2 * worstV]}, ${xy[2 * worstV + 1]}) is ${worst.toExponential(2)} from the tile boundary`);
  }

  // ---- pieces and their graph, from the triangles alone
  const uf = Int32Array.from({ length: m }, (_, i) => i);
  const find = (t) => { while (uf[t] !== t) { uf[t] = uf[uf[t]]; t = uf[t]; } return t; };
  const shared = new Map();        // a * P + b (a < b)  ->  edge indices shared by pieces a and b
  for (let k = 0; k < ne; k++) {
    if (ecnt[k] !== 2) continue;
    const pa = triCell[et0[k]], pb = triCell[et1[k]];
    if (pa === pb) { const r1 = find(et0[k]), r2 = find(et1[k]); if (r1 !== r2) uf[r1] = r2; } else {
      const key = Math.min(pa, pb) * P + Math.max(pa, pb);
      if (!shared.has(key)) shared.set(key, []);
      shared.get(key).push(k);
      if (cells[pa].cellId !== undefined && cells[pa].cellId === cells[pb].cellId) F('tree', `${label}: pieces ${pa} and ${pb} of one kaleidoscope cell share an edge (they are one piece)`);
    }
  }
  const comp = new Map();
  let disconnected = 0;
  for (let t = 0; t < m; t++) { const r = find(t), p = triCell[t]; if (!comp.has(p)) comp.set(p, r); else if (comp.get(p) !== r) disconnected++; }
  if (disconnected) F('tree', `${label}: a piece is not connected (${disconnected} triangles outside the first component of their piece)`);
  if (comp.size !== P) F('tree', `${label}: ${P - comp.size} pieces have no triangles`);
  // triangles lie in the cell of their piece
  if (T) {
    let worst = 0, worstT = -1;
    for (let t = 0; t < m; t++) {
      const q = cells[triCell[t]].poly, k = q.length, s = cells[triCell[t]].parity ? -1 : 1;
      for (let e = 0; e < 3; e++) {
        const x = xy[2 * tri[3 * t + e]], y = xy[2 * tri[3 * t + e] + 1];
        for (let i = 0; i < k; i++) {
          const a = q[i], b = q[(i + 1) % k];
          const side = -s * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (side > worst) { worst = side; worstT = t; }
        }
      }
    }
    if (worst > 8 * res32) F('tree', `${label}: triangle ${worstT} of piece ${triCell[worstT]} leaves its kaleidoscope cell by ${worst.toExponential(2)}`);
  }
  // the graph: connected and acyclic
  const adj = Array.from({ length: P }, () => []);
  for (const key of shared.keys()) { const a = Math.floor(key / P), b = key % P; adj[a].push(b); adj[b].push(a); }
  const dist = new Int32Array(P).fill(-1);
  const queue = [mesh.root];
  dist[mesh.root] = 0;
  for (let i = 0; i < queue.length; i++) for (const q of adj[queue[i]]) if (dist[q] < 0) { dist[q] = dist[queue[i]] + 1; queue.push(q); }
  if (queue.length !== P) {
    const lost = [];
    for (let p = 0; p < P; p++) if (dist[p] < 0) lost.push(`${p} (area ${cells[p].area.toExponential(2)})`);
    F('tree', `${label}: ${P - queue.length} of ${P} pieces are not connected to the root through shared triangle edges: pieces ${lost.slice(0, 5).join(', ')}`);
  }
  if (shared.size !== P - 1) F('tree', `${label}: ${P} pieces but ${shared.size} hinged pairs (the piece graph is not a tree)`);
  if (!Array.isArray(mesh.creases) || mesh.creases.length !== P - 1) F('tree', `${label}: ${mesh.creases && mesh.creases.length} creases for ${P} pieces`);
  // the records: parent / depth / hinge
  if (cells[mesh.root].parent !== -1 || cells[mesh.root].depth !== 0 || cells[mesh.root].hinge !== null) F('tree', `${label}: root record`);
  for (let i = 0; i < P; i++) {
    if (i === mesh.root) continue;
    const q = cells[i], p = q.parent;
    if (!(Number.isInteger(p) && p >= 0 && p < P && p !== i)) { F('tree', `${label}: piece ${i} has parent ${p}`); continue; }
    if (q.depth !== cells[p].depth + 1) F('tree', `${label}: depth of piece ${i} is ${q.depth}, its parent ${p} has ${cells[p].depth}`);
    // following parents reaches the root
    let hops = 0, k = i;
    while (k !== mesh.root && hops <= P) { k = cells[k].parent; hops++; if (!(k >= 0 && k < P)) break; }
    if (k !== mesh.root) { F('tree', `${label}: the parents of piece ${i} do not lead to the root`); continue; }
    if (dist[i] >= 0 && q.depth !== dist[i]) F('tree', `${label}: depth of piece ${i} is ${q.depth}, its distance from the root in the piece graph is ${dist[i]}`);
    const sh = shared.get(Math.min(p, i) * P + Math.max(p, i));
    const h = q.hinge;
    if (!h || ![h.ax, h.ay, h.bx, h.by].every(Number.isFinite)) { F('tree', `${label}: piece ${i} has no hinge`); continue; }
    if (!sh) { stats.orphanFallbacks++; F('tree', `${label}: piece ${i} (area ${q.area.toExponential(2)}) is an orphan: it shares no triangle edge with its parent ${p}`); continue; }
    const dx = h.bx - h.ax, dy = h.by - h.ay, len = Math.hypot(dx, dy);
    if (!(len > 1e-9)) { F('tree', `${label}: the hinge of piece ${i} has no extent`); continue; }
    let lo = Infinity, hi = -Infinity, off = 0;
    for (const e of sh) for (const v of [eu[e], ev[e]]) {
      const t = ((xy[2 * v] - h.ax) * dx + (xy[2 * v + 1] - h.ay) * dy) / (len * len);
      off = Math.max(off, Math.abs((xy[2 * v] - h.ax) * dy - (xy[2 * v + 1] - h.ay) * dx) / len);
      lo = Math.min(lo, t); hi = Math.max(hi, t);
    }
    if (off > 8 * res32) F('tree', `${label}: the edges piece ${i} shares with its parent are ${off.toExponential(2)} off its hinge line`);
    const slack = 20 * res32 / len;
    if (lo < -slack || hi > 1 + slack) F('tree', `${label}: the shared edges of piece ${i} reach beyond its hinge segment: [${lo}, ${hi}]`);
    if (len > 1.01e-3 * size && (lo > slack || hi < 1 - slack)) F('tree', `${label}: the hinge of piece ${i} is longer than the shared crease segment: [${lo}, ${hi}]`);
    // the piece lies to the LEFT of a -> b, its parent to the right
    if (pieceArea[i] > 0 && pieceArea[p] > 0) {
      const sI = (dx * (cenY[i] / pieceArea[i] - h.ay) - dy * (cenX[i] / pieceArea[i] - h.ax)) / len;
      const sP = (dx * (cenY[p] / pieceArea[p] - h.ay) - dy * (cenX[p] / pieceArea[p] - h.ax)) / len;
      if (sI < -8 * res32) F('tree', `${label}: piece ${i} lies to the right of its hinge a -> b (centroid ${sI.toExponential(2)})`);
      if (q.poly && cells[p].poly) {
        const cen = (poly) => poly.reduce((s, v) => [s[0] + v[0] / poly.length, s[1] + v[1] / poly.length], [0, 0]);
        const ci = cen(q.poly), cp = cen(cells[p].poly);
        if (!(dx * (ci[1] - h.ay) - dy * (ci[0] - h.ax) > 0 && dx * (cp[1] - h.ay) - dy * (cp[0] - h.ax) < 0)) F('tree', `${label}: the cell of piece ${i} is not on the left of its hinge, or its parent's cell not on the right`);
      } else if (sP > 8 * res32) F('tree', `${label}: the parent of piece ${i} lies on the left of the hinge`);
    }
    const cr = mesh.creases.find((k2) => k2.b === i);
    if (!cr || cr.a !== p || !(cr.pts instanceof Float32Array) || cr.pts.length !== 4 || Math.hypot(cr.pts[0] - h.ax, cr.pts[1] - h.ay) > 8 * res32 || Math.hypot(cr.pts[2] - h.bx, cr.pts[3] - h.by) > 8 * res32) F('tree', `${label}: crease record of piece ${i}`);
  }

  // ---- root
  const sw = d.warp.fwd(d.seed[0], d.seed[1]);
  const rootGot = mesh.locate(sw[0] + 1e-6 * 0.3713, sw[1] + 1e-6 * 0.9285);
  if (rootGot !== mesh.root) F('root', `${label}: locate(nudged warped seed) = ${rootGot}, root = ${mesh.root}`);

  // ---- locate against brute force
  const tx0 = new Float32Array(m), tx1 = new Float32Array(m), ty0 = new Float32Array(m), ty1 = new Float32Array(m);
  for (let t = 0; t < m; t++) {
    const a = tri[3 * t], b = tri[3 * t + 1], q = tri[3 * t + 2];
    tx0[t] = Math.min(xy[2 * a], xy[2 * b], xy[2 * q]); tx1[t] = Math.max(xy[2 * a], xy[2 * b], xy[2 * q]);
    ty0[t] = Math.min(xy[2 * a + 1], xy[2 * b + 1], xy[2 * q + 1]); ty1[t] = Math.max(xy[2 * a + 1], xy[2 * b + 1], xy[2 * q + 1]);
  }
  const margin = 20 * res32;
  /** Brute force: [triangle that contains the point with all three edge distances > margin, number of triangles containing it]. */
  let bruteCount = 0;
  const brute = (px, py) => {
    let hit = -1;
    bruteCount = 0;
    for (let t = 0; t < m; t++) {
      if (px < tx0[t] || px > tx1[t] || py < ty0[t] || py > ty1[t]) continue;
      const a = tri[3 * t], b = tri[3 * t + 1], q = tri[3 * t + 2];
      const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1], qx = xy[2 * q], qy = xy[2 * q + 1];
      const e0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / (Math.hypot(bx - ax, by - ay) || 1);
      const e1 = ((qx - bx) * (py - by) - (qy - by) * (px - bx)) / (Math.hypot(qx - bx, qy - by) || 1);
      const e2 = ((ax - qx) * (py - qy) - (ay - qy) * (px - qx)) / (Math.hypot(ax - qx, ay - qy) || 1);
      if (e0 > margin && e1 > margin && e2 > margin) { bruteCount++; hit = t; }
    }
    return hit;
  };
  // 300 random interior points, uniform over the mesh: a triangle picked by area, a random point of it — and then the
  // triangle is forgotten: the brute-force search over ALL triangles decides where the point lies
  const cum = new Float64Array(m);
  let run = 0;
  for (let t = 0; t < m; t++) { run += Math.max(area2[t], 0); cum[t] = run; }
  let accepted = 0, locBad = 0, overlap = 0;
  for (let tries = 0; tries < 20 * nLocate && accepted < nLocate; tries++) {
    const target = rnd() * run;
    let lo = 0, hi = m - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; }
    let r1 = rnd(), r2 = rnd();
    if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    const va = tri[3 * lo], vb = tri[3 * lo + 1], vc = tri[3 * lo + 2];
    const px = xy[2 * va] + r1 * (xy[2 * vb] - xy[2 * va]) + r2 * (xy[2 * vc] - xy[2 * va]);
    const py = xy[2 * va + 1] + r1 * (xy[2 * vb + 1] - xy[2 * va + 1]) + r2 * (xy[2 * vc + 1] - xy[2 * va + 1]);
    const t = brute(px, py);
    if (t < 0) continue;                                    // within the margin of an edge: no verdict
    accepted++;
    if (bruteCount > 1 && overlap++ < 1) F('mesh-inverted', `${label}: the point (${px}, ${py}) lies strictly inside ${bruteCount} triangles (overlap)`);
    const got = mesh.locate(px, py);
    if (got !== triCell[t] && locBad++ < 2) F('locate', `${label}: locate(${px}, ${py}) = ${got}, brute force finds triangle ${t} of piece ${triCell[t]}`);
  }
  stats.locatePoints += accepted;
  if (accepted < nLocate) F('locate', `${label}: only ${accepted} of ${20 * nLocate} random points of the mesh fell strictly inside a triangle`);
  // the centroid of every triangle (slivers thinner than Float32 resolves excepted)
  for (let t = 0; t < m; t++) {
    if (area2[t] <= 40 * res32 * longest[t]) continue;
    const a = tri[3 * t], b = tri[3 * t + 1], q = tri[3 * t + 2];
    const got = mesh.locate((xy[2 * a] + xy[2 * b] + xy[2 * q]) / 3, (xy[2 * a + 1] + xy[2 * b + 1] + xy[2 * q + 1]) / 3);
    if (got !== triCell[t]) { F('locate', `${label}: the centroid of triangle ${t} (piece ${triCell[t]}, area ${(area2[t] / 2).toExponential(2)}) is located in piece ${got}`); break; }
  }
  // any query returns a valid piece: on the rim, just outside, far away
  for (const [qx, qy, what] of [[bx0 - 3 * size, by0 - 2 * size, 'a point far outside'], [bx1 + 1e-7, by1 + 1e-7, 'the bbox corner'], [(bx0 + bx1) / 2, by1 + 0.5 * size, 'a point above the tile'], [1e6, -1e6, '(1e6, -1e6)'], [xy[0], xy[1], 'vertex 0']]) {
    const got = mesh.locate(qx, qy);
    if (!(Number.isInteger(got) && got >= 0 && got < P)) F('locate', `${label}: locate of ${what} (${qx}, ${qy}) = ${got}`);
  }

  // ---- boundary
  const outline = d.outline(size / 40);
  const tolRim = amp === 0 ? 20 * res32 : 1e-2 * size * coarse;
  if (!Array.isArray(mesh.boundary) || mesh.boundary.length !== d.edges.length) F('boundary', `${label}: boundary has ${mesh.boundary && mesh.boundary.length} entries for ${d.edges.length} edges`);
  else {
    mesh.boundary.forEach((b, i) => {
      const e = d.edges[i];
      if (b.edge !== i || b.cls !== e.cls || b.kind !== e.kind) F('boundary', `${label}: boundary[${i}] header (${b.edge}, ${b.cls}, ${b.kind})`);
      if (!(b.pts instanceof Float32Array) || !(b.cells instanceof Uint16Array) || b.cells.length * 2 !== b.pts.length) { F('boundary', `${label}: boundary[${i}] arrays`); return; }
      if (b.pts.length !== outline[i].pts.length || b.pts.some((v, k) => v !== outline[i].pts[k])) F('boundary', `${label}: boundary[${i}].pts is not domain.outline(size / 40)[${i}].pts`);
      for (let j = 0; j < b.cells.length; j++) {
        const px = b.pts[2 * j], py = b.pts[2 * j + 1], pc = b.cells[j];
        if (!(pc < P)) { F('boundary', `${label}: boundary[${i}].cells[${j}] = ${pc} is not a piece (${P} pieces)`); return; }
        let dAny = Infinity, dOwn = Infinity;
        for (const k of rim) {
          const dd = segDist(px, py, xy[2 * eu[k]], xy[2 * eu[k] + 1], xy[2 * ev[k]], xy[2 * ev[k] + 1]);
          if (dd < dAny) dAny = dd;
          if (triCell[et0[k]] === pc && dd < dOwn) dOwn = dd;
        }
        if (dOwn > 2 * tolRim) {
          // the piece may touch the rim at a vertex only (a cell corner at a cone point): measure to all of its edges
          for (let k = 0; k < ne; k++) {
            if (triCell[et0[k]] !== pc && (et1[k] < 0 || triCell[et1[k]] !== pc)) continue;
            const dd = segDist(px, py, xy[2 * eu[k]], xy[2 * eu[k] + 1], xy[2 * ev[k]], xy[2 * ev[k] + 1]);
            if (dd < dOwn) dOwn = dd;
          }
        }
        if (dAny > tolRim) { F('boundary', `${label}: boundary point ${j} of edge ${i} (${px}, ${py}) is ${dAny.toExponential(2)} from the rim of the mesh`); return; }
        if (dOwn > 2 * tolRim) { F('boundary', `${label}: boundary point ${j} of edge ${i} (${px}, ${py}) is ${dOwn.toExponential(2)} from its piece ${pc}`); return; }
        // the point lies in (the closure of) the kaleidoscope cell of its piece
        if (T) {
          const q = cells[pc].poly, s = cells[pc].parity ? -1 : 1;
          let outside = 0;
          for (let k = 0; k < q.length; k++) {
            const a = q[k], bb = q[(k + 1) % q.length];
            outside = Math.max(outside, -s * ((bb[0] - a[0]) * (py - a[1]) - (bb[1] - a[1]) * (px - a[0])) / Math.hypot(bb[0] - a[0], bb[1] - a[1]));
          }
          if (outside > 1e-5 * mag) { F('boundary', `${label}: boundary point ${j} of edge ${i} (${px}, ${py}) is ${outside.toExponential(2)} outside the kaleidoscope cell of its piece ${pc}`); return; }
        }
      }
    });
  }

  // ---- parity (hinge: front and back each cover T once; 22x: together once)
  if (group.fold === 'hinge' || group.fold === 'crosscap') {
    const areaT = polyArea(T);
    let even = 0, odd = 0;
    for (const q of cells) if (q.parity) odd += q.area; else even += q.area;
    const tol = (amp === 0 ? 1e-6 * mag : 1e-3 * coarse) * areaT;
    if (group.fold === 'hinge' && !(Math.abs(even - areaT) < tol && Math.abs(odd - areaT) < tol)) F('parity', `${label}: even pieces ${even}, odd pieces ${odd}, area(T) = ${areaT}`);
    if (group.fold === 'crosscap' && !(Math.abs(even + odd - areaT) < tol)) F('parity', `${label}: even + odd = ${even + odd}, area(T) = ${areaT}`);
    // sheets alternate with depth
    for (const q of cells) if (((q.parity ^ cells[mesh.root].parity) & 1) !== (q.depth & 1)) { F('parity', `${label}: the parity of piece ${q.index} does not alternate with its depth`); break; }
    // pointwise: a point u of T is covered once by the even cells and once by the odd cells of the tile (hinge);
    // 22x: u on the even sheet or its antipode on the odd sheet, exactly one of the two. The kaleidoscope cells are
    // enumerated here, independently of the mesh; then the mesh must have the piece of every covered point.
    const tc = [T.reduce((q, v) => q + v[0], 0) / T.length, T.reduce((q, v) => q + v[1], 0) / T.length];
    let rT = 0, rD = 0;
    for (const v of T) rT = Math.max(rT, Math.hypot(v[0] - tc[0], v[1] - tc[1]));
    for (const v of d.poly) rD = Math.max(rD, Math.hypot(v[0] - d.seed[0], v[1] - d.seed[1]));
    const kEls = elementsNear(group.kaleido.group, d.seed[0], d.seed[1], rD + rT + 0.2 * size, tc[0], tc[1]);
    const tolC = amp === 0 ? 40 * res32 : 1.5e-2 * size * coarse;
    const yy = [0, 0], xx = [0, 0];
    let cover = 0, miss = 0;
    for (let k = 0; k < 60; k++) {
      let u0, u1;
      if (T.length === 3) { let r1 = rnd(), r2 = rnd(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; } u0 = T[0][0] + r1 * (T[1][0] - T[0][0]) + r2 * (T[2][0] - T[0][0]); u1 = T[0][1] + r1 * (T[1][1] - T[0][1]) + r2 * (T[2][1] - T[0][1]); } else { const r1 = rnd(), r2 = rnd(); u0 = T[0][0] + r1 * (T[1][0] - T[0][0]) + r2 * (T[3][0] - T[0][0]); u1 = T[0][1] + r1 * (T[1][1] - T[0][1]) + r2 * (T[3][1] - T[0][1]); }
      if (polyBoundaryDist(T, u0, u1) < 40 * res32) continue;
      const count = [0, 0], inside = [];
      let nearRim = false;
      for (const g of kEls) {
        const par = det(g) > 0 ? 0 : 1, anti = group.fold === 'crosscap' && par === 1;
        apply(g, anti ? 2 * tc[0] - u0 : u0, anti ? 2 * tc[1] - u1 : u1, xx);
        d.warp.inv(xx[0], xx[1], yy);
        const depth = polyDepth(d.poly, yy[0], yy[1]);
        if (Math.abs(depth) < tolC) { nearRim = true; break; }
        if (depth > 0) { count[par]++; inside.push([g, xx[0], xx[1]]); }
      }
      if (nearRim) continue;
      const ok = group.fold === 'hinge' ? count[0] === 1 && count[1] === 1 : count[0] + count[1] === 1;
      if (!ok && cover++ < 1) F('parity', `${label}: the point u = (${u0}, ${u1}) of T is covered ${count[0]} times by even cells and ${count[1]} times by odd cells of the tile`);
      // the mesh has that point, in a piece of that cell
      for (const [g, x0, x1] of inside) {
        const got = mesh.locate(x0, x1);
        if (!(got < P) || !isoEquals(cells[got].g, g, 1e-7 * mag)) { if (miss++ < 1) F('parity', `${label}: the point (${x0}, ${x1}) lies ${tolC.toExponential(1)} inside the tile, in the kaleidoscope cell [${g.a}, ${g.b}, ${g.c}, ${g.d}, ${g.tx}, ${g.ty}], but locate gives piece ${got} of another cell`); }
        else if (brute(x0, x1) < 0 && amp === 0) {
          // on an edge of the mesh (within the margin) is fine; nowhere near a triangle is not
          let near = Infinity;
          for (let t = 0; t < m; t++) { if (x0 < tx0[t] - margin || x0 > tx1[t] + margin || x1 < ty0[t] - margin || x1 > ty1[t] + margin) continue; near = 0; break; }
          if (near > 0 && miss++ < 1) F('parity', `${label}: the point (${x0}, ${x1}) lies inside the tile but in no triangle of the mesh`);
        }
      }
    }

    // ---- seams: glued boundary samples get pieces whose cells correspond under the gluing
    const glued = group.kaleido.glued, u = [0, 0], u2 = [0, 0], x2 = [0, 0];
    const sideDist = (p) => {
      let dd = Infinity;
      for (let k = 0; k < T.length; k++) if (glued[k]) dd = Math.min(dd, segDist(p[0], p[1], T[k][0], T[k][1], T[(k + 1) % T.length][0], T[(k + 1) % T.length][1]));
      return dd;
    };
    const tolS = 1e-5 * mag;
    if (Array.isArray(mesh.boundary) && mesh.boundary.length === d.edges.length) {
      mesh.boundary.forEach((b, i) => {
        const e = d.edges[i];
        if (e.kind !== 'cut' || !(b.cells instanceof Uint16Array)) return;
        const antipodal = group.fold === 'crosscap' && det(e.g) < 0;     // 22x: a glide acts on the pillow as the antipodal map
        const bj = mesh.boundary[e.partner], k = b.cells.length, gi = inverse(e.g), rev = det(e.g) > 0;
        if (!bj || bj.cells.length !== k) { F('seams', `${label}: boundary[${i}] and its partner have different lengths`); return; }
        for (let j = 0; j < k; j++) {
          const jj = rev ? k - 1 - j : j;
          apply(gi, b.pts[2 * j], b.pts[2 * j + 1], x2);
          if (Math.hypot(x2[0] - bj.pts[2 * jj], x2[1] - bj.pts[2 * jj + 1]) > 20 * res32) { F('seams', `${label}: sample ${j} of edge ${i} does not map onto sample ${jj} of its partner ${e.partner}`); return; }
          if (!(b.cells[j] < P && bj.cells[jj] < P)) return;
          const c1 = cells[b.cells[j]], c2 = cells[bj.cells[jj]];
          apply(inverse(c1.g), b.pts[2 * j], b.pts[2 * j + 1], u);
          apply(inverse(c2.g), bj.pts[2 * jj], bj.pts[2 * jj + 1], u2);
          if (antipodal) {
            if (Math.hypot(2 * tc[0] - u[0] - u2[0], 2 * tc[1] - u[1] - u2[1]) > tolS) { F('seams', `${label}: glide-glued samples ${j} / ${jj} of edges ${i} / ${e.partner} are not antipodal on the pillow (pieces ${b.cells[j]}, ${bj.cells[jj]})`); return; }
            if ((c1.depth & 1) === (c2.depth & 1) && sideDist(u) > tolS) { F('seams', `${label}: glide-glued samples ${j} / ${jj} of edges ${i} / ${e.partner} land on the same sheet`); return; }
            continue;
          }
          if (Math.hypot(u[0] - u2[0], u[1] - u2[1]) > tolS) { F('seams', `${label}: glued samples ${j} / ${jj} of edges ${i} / ${e.partner} (pieces ${b.cells[j]}, ${bj.cells[jj]}) fold to points of T ${Math.hypot(u[0] - u2[0], u[1] - u2[1]).toExponential(2)} apart`); return; }
          if ((c1.depth & 1) !== (c2.depth & 1) && sideDist(u) > tolS) { F('seams', `${label}: glued samples ${j} / ${jj} of edges ${i} / ${e.partner} land on different sheets, ${sideDist(u).toExponential(2)} from a glued side of T`); return; }
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// run every case once
// ---------------------------------------------------------------------------------------------------------------

const warps = new Map();
function warpOf(group, amp) {
  const key = group.id + '|' + amp;
  if (!warps.has(key)) warps.set(key, makeWarp(group, amp));
  return warps.get(key);
}

function runCase(group, c, index) {
  const label = labelOf(group, c);
  const F = (name, msg) => { failures[name].push({ group: group.id, cls: c.cls, msg }); };
  const rnd = prng(0x9E3779B1 ^ (index * 2654435761) ^ (SALT * 97));
  stats.cases++;
  stats.byClass[c.cls] = (stats.byClass[c.cls] || 0) + 1;
  let d, mesh;
  const t0 = performance.now();
  try {
    d = buildDomain(group, { seed: c.seed, metric: c.metric, warp: warpOf(group, c.amp) });
    mesh = c.density ? buildMesh(group, d, { density: c.density }) : buildMesh(group, d);
  } catch (err) {
    F('throws', `${label}: buildDomain / buildMesh threw ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`);
    return;
  }
  const dt = performance.now() - t0;
  stats.slow.push([dt, label]);
  if (stats.slow.length > 400) { stats.slow.sort((a, b) => b[0] - a[0]); stats.slow.length = 12; }
  try {
    if (!checkDomain(group, c, d, label, F)) return;
    const size = Math.sqrt(group.domainArea);
    checkTiling(group, d, label, rnd, F, c.light ? 40 : 400);
    checkOutline(group, d, size / 40, label, F);
    if (!c.light) {
      checkOutline(group, d, undefined, label, F);
      checkOutline(group, d, size / 11, label, F);
      checkOutline(group, d, 100 * size, label, F, false);      // two steps per edge: structure and area only
    }
    checkMesh(group, c, d, mesh, label, rnd, F, c.light ? 60 : 300);
  } catch (err) {
    F('throws', `${label}: a check threw ${err && err.stack ? err.stack.split('\n').slice(0, 4).join(' | ') : err}`);
  }
}

let caseIndex = 0;
for (const group of THE_GROUPS) for (const c of allCases(group)) runCase(group, c, caseIndex++);

function show(name) {
  const list = failures[name];
  if (!list.length) return '';
  const by = new Map();
  for (const f of list) { const k = `${f.group} ${f.cls}`; by.set(k, (by.get(k) || 0) + 1); }
  const head = `${list.length} failures of check "${name}" — by group and class: ${[...by].map(([k, v]) => `${k}: ${v}`).join(', ')}`;
  // one example per (group, class), then more
  const seen = new Set(), ex = [];
  for (const f of list) { const k = `${f.group} ${f.cls}`; if (!seen.has(k)) { seen.add(k); ex.push(f.msg); } }
  for (const f of list) if (ex.length < 14 && !ex.includes(f.msg)) ex.push(f.msg);
  return head + '\n' + ex.slice(0, 14).join('\n');
}

const TITLES = {
  'throws': 'robust: nothing throws',
  'domain': 'robust domain: polygon is finite, convex, counter-clockwise, without edges <= 1e-9, seed inside',
  'area': 'robust domain: area = group.domainArea (1e-7)',
  'clamp': 'robust domain: the seed is clamped to delta from every mirror and rotation centre, clear seeds untouched, idempotent',
  'gluing': 'robust domain: partners, lengths, inverse(g) maps edge onto partner, kinds, classes, bisectors, cone points',
  'tiling': 'robust domain: tiling property at 400 random points through warp.inv and at points around every corner and edge midpoint',
  'warp': 'robust warp: fwd(inv(x)) = x',
  'outline': 'robust outline: per-edge structure, step <= maxStep, closed, follows warp.fwd, partners correspond',
  'outline-ccw': 'robust outline: counter-clockwise and encloses exactly the domain area',
  'outline-simple': 'robust outline: no self-intersection, no point visited twice',
  'mesh-structure': 'robust mesh: arrays, indices, piece records, bbox',
  'mesh-area': 'robust mesh: triangle areas sum to the domain area (1e-6 at amp 0, 1e-3 with a wavy cut), piece areas add up',
  'mesh-inverted': 'robust mesh: no inverted and no overlapping triangles',
  'mesh-weld': 'robust mesh: welded — manifold, Euler characteristic 1, simple rim without T-junctions, rim on the tile boundary',
  'tree': 'robust mesh: pieces are connected, the piece graph is a tree, no orphans, no piece cut off from the root, hinges',
  'root': 'robust mesh: the root is the piece of the nudged warped seed',
  'locate': 'robust mesh: locate agrees with brute-force point-in-triangle search (300 random interior points + all centroids)',
  'boundary': 'robust mesh: boundary[] is the outline; boundary[].cells are valid pieces that are really there',
  'parity': 'robust mesh: even / odd parity areas = area(T) for hinge groups (22x: together), each sheet covers T once pointwise',
  'seams': 'robust mesh: glued boundary samples get pieces whose cells correspond under the gluing',
};
for (const name of CHECKS) test(TITLES[name], () => assert.equal(failures[name].length, 0, show(name)));

test('robust: the sweep really covered what it claims', () => {
  stats.slow.sort((a, b) => b[0] - a[0]);
  console.log(`      cases ${stats.cases} (${Object.entries(stats.byClass).map(([k, v]) => `${k} ${v}`).join(', ')}); tiling probes ${stats.tilingPoints}, locate probes ${stats.locatePoints}`);
  console.log(`      shortest edge ${stats.minEdge.toExponential(2)}, tiles with an edge < 1e-6 sizes ${stats.shortEdges}, smallest piece ${stats.minPiece.toExponential(2)}, pieces < 1e-10 ${stats.microPieces}, max pieces ${stats.maxPieces}, max triangles ${stats.maxTri}, pieces attached by the orphan fallback ${stats.orphanFallbacks}`);
  console.log(`      max relative mesh area error: amp 0 ${stats.maxAreaErr0.toExponential(1)}, wavy ${stats.maxAreaErrW.toExponential(1)}; max |outline area - domain area| ${stats.maxOutlineAreaErr.toExponential(1)}; coarse (2 steps / edge) outlines that cross themselves ${stats.coarseSelfX}`);
  console.log(`      slowest single builds (cold, untimed-quality): ${stats.slow.slice(0, 4).map(([t, l]) => `${t.toFixed(1)} ms ${l}`).join(' || ')}`);
  if (!ONLY && BASE) {
    assert.ok(stats.cases >= 1500, `only ${stats.cases} cases`);
    for (const cls of ['preset', 'mirror', 'centre', 'crease', 'glide', 'symmetric', 'far']) assert.ok(stats.byClass[cls] > 20, `class ${cls}: ${stats.byClass[cls]}`);
    assert.ok(stats.shortEdges > 20, `the near-crease seeds must produce nearly degenerate tiles (edges < 1e-6 sizes): ${stats.shortEdges}`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// far seeds: a seed moved by a lattice vector must give the translated tile and the same mesh combinatorics
// ---------------------------------------------------------------------------------------------------------------

test('robust: a seed moved by a lattice vector gives the translated tile (edges, classes, cone points, pieces)', () => {
  const bad = [];
  for (const group of THE_GROUPS) {
    for (const [pi, p] of group.presets.entries()) {
      for (const amp of [0, 1]) {
        const warp = warpOf(group, amp);
        const base = buildDomain(group, { seed: p.seed, metric: p.metric, warp });
        const bm = buildMesh(group, base);
        for (const [mm, nn] of [[1, 0], [0, -1], [4, -3], [25, 17], [-30, -29]]) {
          const L = [mm * group.e1[0] + nn * group.e2[0], mm * group.e1[1] + nn * group.e2[1]];
          const label = `${group.id} preset ${pi} (${p.name}) amp ${amp} + ${mm} e1 + ${nn} e2`;
          const mag = Math.max(1, Math.abs(L[0]), Math.abs(L[1]));
          let d, mesh;
          try { d = buildDomain(group, { seed: [p.seed[0] + L[0], p.seed[1] + L[1]], metric: p.metric, warp }); mesh = buildMesh(group, d); } catch (err) { bad.push(`${label}: threw ${err}`); continue; }
          if (d.poly.length !== base.poly.length) { bad.push(`${label}: ${d.poly.length} edges, the base tile has ${base.poly.length}`); continue; }
          // the polygon may start at another vertex: find the rotation
          const n = base.poly.length;
          let shift = -1;
          for (let s = 0; s < n && shift < 0; s++) if (Math.hypot(d.poly[s][0] - L[0] - base.poly[0][0], d.poly[s][1] - L[1] - base.poly[0][1]) < 1e-9 * mag) shift = s;
          if (shift < 0) { bad.push(`${label}: no vertex of the tile is the translate of vertex 0 of the base tile`); continue; }
          let worst = 0;
          for (let i = 0; i < n; i++) worst = Math.max(worst, Math.hypot(d.poly[(i + shift) % n][0] - L[0] - base.poly[i][0], d.poly[(i + shift) % n][1] - L[1] - base.poly[i][1]));
          if (worst > 1e-9 * mag) bad.push(`${label}: vertices are ${worst.toExponential(2)} from the translated base tile`);
          for (let i = 0; i < n; i++) {
            const e = d.edges[(i + shift) % n], f = base.edges[i];
            if (e.kind !== f.kind || e.halfTurn !== f.halfTurn || (e.partner - shift + n) % n !== f.partner) { bad.push(`${label}: edge ${i} differs from the base tile (kind / halfTurn / partner)`); break; }
          }
          if (d.classes !== base.classes) bad.push(`${label}: ${d.classes} classes, base ${base.classes}`);
          if (d.conePoints.length !== base.conePoints.length) bad.push(`${label}: ${d.conePoints.length} cone points, base ${base.conePoints.length}`);
          else for (const q of base.conePoints) if (!d.conePoints.some((r) => Math.hypot(r.x - L[0] - q.x, r.y - L[1] - q.y) < 1e-7 * mag && r.order === q.order && r.onMirror === q.onMirror)) { bad.push(`${label}: cone point (${q.x}, ${q.y}) has no translate`); break; }
          if (mesh.cells.length !== bm.cells.length) bad.push(`${label}: ${mesh.cells.length} pieces, base ${bm.cells.length}`);
          // kaleidoscope cells are lattice-periodic, so the fine mesh is the same; the grid of the roll groups hangs on the
          // Float32 bounding box and may shift by a rounding error
          if (group.kaleido ? amp === 0 && mesh.tri.length !== bm.tri.length : Math.abs(mesh.tri.length - bm.tri.length) > 0.02 * bm.tri.length) bad.push(`${label}: ${mesh.tri.length / 3} triangles, base ${bm.tri.length / 3}`);
          // with a wavy cut the corner of the rim is a chord-chord cut, which depends on the numbering of the edges:
          // the two meshes agree to the sagitta there, not to rounding
          const tolB = amp === 0 ? 1e-6 * mag : 1e-2 * Math.sqrt(group.domainArea);
          for (let k = 0; k < 4; k++) if (Math.abs(mesh.bbox[k] - L[k % 2] - bm.bbox[k]) > tolB) { bad.push(`${label}: bbox differs by ${Math.abs(mesh.bbox[k] - L[k % 2] - bm.bbox[k]).toExponential(2)}`); break; }
        }
      }
    }
  }
  assert.equal(bad.length, 0, `${bad.length} failures\n` + bad.slice(0, 12).join('\n'));
});

test('robust: a seed mapped by an element of G gives the mapped tile (same shape, same pieces)', () => {
  const bad = [];
  const rnd = prng(424242 + SALT);
  for (const group of THE_GROUPS) {
    const els = elementsNear(group, group.center[0], group.center[1], 2.5 * group.viewHalf);
    for (const [pi, p] of group.presets.entries()) {
      const base = buildDomain(group, { seed: p.seed, metric: p.metric });
      const baseSorted = base.edges.map((e) => e.len).sort((a, b) => a - b);
      const bm = buildMesh(group, base);
      for (let k = 0; k < 6; k++) {
        const g = els[Math.floor(rnd() * els.length)];
        const q = apply(g, p.seed[0], p.seed[1]);
        const label = `${group.id} preset ${pi} (${p.name}) mapped by the element [${g.a}, ${g.b}, ${g.c}, ${g.d}, ${g.tx}, ${g.ty}] -> seed [${q[0]}, ${q[1]}]`;
        // a preset on a mirror or centre is clamped to a fixed side: then the clamped seeds need not correspond
        const cl = clampSeed(group, p.seed[0], p.seed[1]);
        const clamped = cl[0] !== p.seed[0] || cl[1] !== p.seed[1];
        let d, mesh;
        try { d = buildDomain(group, { seed: q, metric: p.metric }); mesh = buildMesh(group, d); } catch (err) { bad.push(`${label}: threw ${err}`); continue; }
        if (Math.abs(d.area - group.domainArea) > 1e-7) bad.push(`${label}: area ${d.area}`);
        if (clamped) continue;
        // the metric of a preset is invariant under the point group only when buildDomain accepts it; either way the
        // tile of g(seed) is g(tile): same edge lengths, same number of pieces
        const sorted = d.edges.map((e) => e.len).sort((a, b) => a - b);
        if (sorted.length !== baseSorted.length || sorted.some((v, i) => Math.abs(v - baseSorted[i]) > 1e-9)) bad.push(`${label}: edge lengths [${sorted.map((v) => v.toFixed(6))}] vs base [${baseSorted.map((v) => v.toFixed(6))}]`);
        else {
          for (const v of base.poly) {
            const w = apply(g, v[0], v[1]);
            if (!d.poly.some((u) => Math.hypot(u[0] - w[0], u[1] - w[1]) < 1e-9)) { bad.push(`${label}: g(vertex) is not a vertex of the tile of g(seed)`); break; }
          }
        }
        if (group.kaleido && mesh.cells.length !== bm.cells.length) {
          // g maps kaleidoscope cells onto cells (hinge groups; for 22x the glides do not): the piece counts agree
          if (group.fold !== 'crosscap' || det(g) > 0) bad.push(`${label}: ${mesh.cells.length} pieces, base ${bm.cells.length}`);
        }
      }
    }
  }
  assert.equal(bad.length, 0, `${bad.length} failures\n` + bad.slice(0, 12).join('\n'));
});

// ---------------------------------------------------------------------------------------------------------------
// extreme seeds: where does precision run out?  (outside the contract: the plane view keeps the seed in its window)
// ---------------------------------------------------------------------------------------------------------------

test('robust (information): seeds 1e3 .. 1e7 lattice periods away — where the domain stops being exact', () => {
  const rows = [];
  for (const group of THE_GROUPS) {
    const p = group.presets[0];
    let firstBad = null;
    for (const k of [1e3, 1e4, 1e5, 1e6, 1e7]) {
      const seed = [p.seed[0] + k * group.e1[0] - (k - 1) * group.e2[0], p.seed[1] + k * group.e1[1] - (k - 1) * group.e2[1]];
      let verdict = 'ok';
      try {
        const d = buildDomain(group, { seed, metric: p.metric });
        const base = buildDomain(group, { seed: p.seed, metric: p.metric });
        if (d.poly.length !== base.poly.length) verdict = `${d.poly.length} edges instead of ${base.poly.length}`;
        else if (Math.abs(d.area - group.domainArea) > 1e-6 * group.domainArea) verdict = `area off by ${((d.area - group.domainArea) / group.domainArea).toExponential(1)}`;
        else if (d.edges.some((e, i) => d.edges[e.partner].partner !== i)) verdict = 'unpaired edges';
      } catch (err) { verdict = `throws ${err.message}`; }
      if (verdict !== 'ok' && !firstBad) firstBad = `${k.toExponential(0)}: ${verdict}`;
    }
    rows.push(`${group.id} ${firstBad || 'ok to 1e7'}`);
  }
  console.log('      first failure by distance (lattice periods): ' + rows.join('  |  '));
});

// ---------------------------------------------------------------------------------------------------------------
// the checks have teeth: corrupted objects must be caught (so that a green run means something)
// ---------------------------------------------------------------------------------------------------------------

test('robust: the checks have teeth — deliberately corrupted domains, outlines and meshes are caught', () => {
  const group = BY_ID['2222'];
  const c = { cls: 'teeth', desc: 'mutation control', seed: [0.2, 0.33], metric: undefined, amp: 0 };
  const label = 'teeth';
  const d = buildDomain(group, { seed: c.seed, warp: warpOf(group, 0) });
  const mesh = buildMesh(group, d);
  const P = mesh.cells.length, n = d.poly.length;
  assert.ok(P >= 3, `the control mesh needs several pieces (${P})`);
  const fired = (run) => { const map = new Map(); run((name, msg) => { if (!map.has(name)) map.set(name, []); map.get(name).push(msg); }); return map; };
  const all = (dd, mm) => fired((F) => { checkDomain(group, c, dd, label, F); checkTiling(group, dd, label, prng(1), F, 400); checkOutline(group, dd, undefined, label, F); checkMesh(group, c, dd, mm, label, prng(2), F); });
  const expect = (map, name, what, pattern) => {
    assert.ok(map.has(name), `${what}: check "${name}" did not fire (fired: ${[...map.keys()].join(', ') || 'nothing'})`);
    if (pattern) assert.ok(map.get(name).some((m) => pattern.test(m)), `${what}: check "${name}" fired, but not with ${pattern}: ${map.get(name)[0]}`);
  };
  // control: untouched objects pass every check
  const clean = all(d, mesh);
  assert.equal(clean.size, 0, `the control case fails: ${[...clean].map(([k, v]) => `${k}: ${v[0]}`).join(' || ')}`);

  // --- domain
  let m = all({ ...d, poly: d.poly.map((q, i) => (i === 1 ? [q[0] + 1e-6, q[1]] : q)) }, mesh);
  expect(m, 'area', 'a vertex moved by 1e-6'); expect(m, 'gluing', 'a vertex moved by 1e-6'); expect(m, 'tiling', 'a vertex moved by 1e-6');
  m = all({ ...d, edges: d.edges.map((e, i) => (i === 0 ? { ...e, partner: (e.partner + 1) % n } : e)) }, mesh);
  expect(m, 'gluing', 'a wrong partner');
  m = all({ ...d, conePoints: d.conePoints.slice(1) }, mesh);
  expect(m, 'gluing', 'a cone point missing', /cone points listed/);
  m = all({ ...d, seed: [d.seed[0] + 1e-3, d.seed[1]] }, mesh);
  expect(m, 'clamp', 'a seed that is not clampSeed(input)'); expect(m, 'gluing', 'edges that are not bisectors of the seed');
  m = all({ ...d, area: d.area * (1 + 1e-6) }, mesh);
  expect(m, 'area', 'area off by 1e-6');

  // --- outline
  const mutateOutline = (fn) => ({ ...d, outline: (step) => fn(d.outline(step)) });
  m = all(mutateOutline((o) => o.map((e) => { const pts = new Float32Array(e.pts.length); for (let k = 0; k < pts.length / 2; k++) { pts[2 * k] = e.pts[e.pts.length - 2 - 2 * k]; pts[2 * k + 1] = e.pts[e.pts.length - 1 - 2 * k]; } return { edge: e.edge, pts }; }).reverse().map((e, i) => ({ edge: i, pts: e.pts }))), mesh);
  expect(m, 'outline-ccw', 'a clockwise outline', /not counter-clockwise/);
  m = all(mutateOutline((o) => { const e = o[0], pts = Float32Array.from(e.pts); const k = pts.length / 2 >> 1; pts[2 * k] += 10 * (d.seed[0] - pts[2 * k]); pts[2 * k + 1] += 10 * (d.seed[1] - pts[2 * k + 1]); o[0] = { edge: 0, pts }; return o; }), mesh);
  expect(m, 'outline-simple', 'an outline with a sample thrown across the tile', /crosses itself/);
  m = all(mutateOutline((o) => { const e = o[0], pts = Float32Array.from(e.pts); pts[pts.length - 2] += 1e-4; o[0] = { edge: 0, pts }; return o; }), mesh);
  expect(m, 'outline', 'an outline that is not closed', /not closed/);
  m = all(mutateOutline((o) => { const e = o[1], pts = Float32Array.from(e.pts), k = 2 * (pts.length / 2 >> 1); [pts[k], pts[k + 2]] = [pts[k + 2], pts[k]]; [pts[k + 1], pts[k + 3]] = [pts[k + 3], pts[k + 1]]; o[1] = { edge: 1, pts }; return o; }), mesh);
  expect(m, 'outline-simple', 'an outline with two samples swapped', /doubles back/);

  // --- mesh
  const tri = () => Uint32Array.from(mesh.tri), triCell = () => Uint16Array.from(mesh.triCell);
  let t = tri(); [t[31], t[32]] = [t[32], t[31]];
  m = all(d, { ...mesh, tri: t });
  expect(m, 'mesh-inverted', 'a flipped triangle'); expect(m, 'mesh-weld', 'a flipped triangle');
  m = all(d, { ...mesh, tri: mesh.tri.slice(0, -3), triCell: mesh.triCell.slice(0, -1), m: mesh.m - 1 });
  expect(m, 'mesh-weld', 'a missing triangle'); expect(m, 'mesh-area', 'a missing triangle');
  // a triangle doubled: overlap
  { const t2 = new Uint32Array(mesh.tri.length + 3); t2.set(mesh.tri); t2.set(mesh.tri.subarray(0, 3), mesh.tri.length); const c2 = new Uint16Array(mesh.m + 1); c2.set(mesh.triCell); c2[mesh.m] = mesh.triCell[0];
    m = all(d, { ...mesh, tri: t2, triCell: c2, m: mesh.m + 1 }); expect(m, 'mesh-weld', 'a doubled triangle'); }
  // a triangle moved to another piece
  { const c2 = triCell(); let k = 0; while (c2[k] !== 0) k++; c2[k] = P - 1;
    m = all(d, { ...mesh, triCell: c2 }); expect(m, 'tree', 'a triangle assigned to the wrong piece'); expect(m, 'locate', 'a triangle assigned to the wrong piece'); }
  m = all(d, { ...mesh, locate: () => mesh.root });
  expect(m, 'locate', 'a locate that always answers the root', /brute force/);
  m = all(d, { ...mesh, locate: (x, y) => (mesh.locate(x, y) + 1) % P });
  expect(m, 'locate', 'a locate that is off by one'); expect(m, 'root', 'a locate that is off by one');
  m = all(d, { ...mesh, boundary: mesh.boundary.map((b) => ({ ...b, cells: Uint16Array.from(b.cells, () => P) })) });
  expect(m, 'boundary', 'boundary cells out of range', /is not a piece/);
  m = all(d, { ...mesh, boundary: mesh.boundary.map((b) => ({ ...b, cells: Uint16Array.from(b.cells, (v) => (v + 1) % P) })) });
  expect(m, 'boundary', 'boundary cells of the wrong pieces'); expect(m, 'seams', 'boundary cells of the wrong pieces');
  m = all(d, { ...mesh, boundary: mesh.boundary.slice(1) });
  expect(m, 'boundary', 'a boundary entry missing');
  m = all(d, { ...mesh, cells: mesh.cells.map((q, i) => (i === 1 ? { ...q, parity: 1 - q.parity } : q)) });
  expect(m, 'parity', 'a flipped parity'); expect(m, 'mesh-structure', 'a flipped parity');
  // a piece hung on a piece it does not touch
  { let a = -1, b = -1;
    for (let i = 1; i < P && a < 0; i++) for (let j = 0; j < P; j++) { if (j === i || j === mesh.cells[i].parent || mesh.cells[j].parent === i) continue; a = i; b = j; break; }
    if (a >= 0) { m = all(d, { ...mesh, cells: mesh.cells.map((q, i) => (i === a ? { ...q, parent: b, depth: mesh.cells[b].depth + 1 } : q)) }); expect(m, 'tree', 'a piece hung on a piece it does not touch', /orphan|depth|parents/); } }
  m = all(d, { ...mesh, cells: mesh.cells.map((q, i) => (i === 1 ? { ...q, hinge: { ax: q.hinge.bx, ay: q.hinge.by, bx: q.hinge.ax, by: q.hinge.ay } } : q)) });
  expect(m, 'tree', 'a hinge pointing the other way', /left of its hinge|right of its hinge|crease record/);
  m = all(d, { ...mesh, root: 1 });
  expect(m, 'root', 'a wrong root'); expect(m, 'tree', 'a wrong root');
  // a rim vertex pulled 1e-3 into the tile
  { const xy = Float32Array.from(mesh.xy); const use = new Map();
    for (let k = 0; k < mesh.m; k++) for (let e = 0; e < 3; e++) { const u = mesh.tri[3 * k + e], v = mesh.tri[3 * k + (e + 1) % 3], key = Math.min(u, v) * mesh.n + Math.max(u, v); use.set(key, (use.get(key) || 0) + 1); }
    let v = -1; for (const [key, cnt] of use) if (cnt === 1) { v = key % mesh.n; break; }
    xy[2 * v] += (d.seed[0] - xy[2 * v]) * 5e-3; xy[2 * v + 1] += (d.seed[1] - xy[2 * v + 1]) * 5e-3;
    m = all(d, { ...mesh, xy }); expect(m, 'mesh-weld', 'a rim vertex pulled into the tile', /from the tile boundary/); }
  m = all(d, { ...mesh, xy: Float32Array.from(mesh.xy, (v) => v * 1.00001) });
  expect(m, 'mesh-area', 'a mesh scaled by 1.00001');
  // a T-junction: one of the two triangles at an interior edge is split at the middle of that edge, the other is not
  { const use = new Map();
    for (let k = 0; k < mesh.m; k++) for (let e = 0; e < 3; e++) { const u = mesh.tri[3 * k + e], v = mesh.tri[3 * k + (e + 1) % 3], key = Math.min(u, v) * mesh.n + Math.max(u, v); if (!use.has(key)) use.set(key, []); use.get(key).push([k, e]); }
    let pick = null;
    for (const list of use.values()) if (list.length === 2) { const [k, e] = list[0]; const u = mesh.tri[3 * k + e], v = mesh.tri[3 * k + (e + 1) % 3]; if (Math.hypot(mesh.xy[2 * u] - mesh.xy[2 * v], mesh.xy[2 * u + 1] - mesh.xy[2 * v + 1]) > 0.02) { pick = [k, e]; break; } }
    const [k, e] = pick, u = mesh.tri[3 * k + e], v = mesh.tri[3 * k + (e + 1) % 3], w = mesh.tri[3 * k + (e + 2) % 3], nv = mesh.n;
    const xy = new Float32Array(2 * nv + 2); xy.set(mesh.xy); xy[2 * nv] = (mesh.xy[2 * u] + mesh.xy[2 * v]) / 2; xy[2 * nv + 1] = (mesh.xy[2 * u + 1] + mesh.xy[2 * v + 1]) / 2;
    const t2 = new Uint32Array(mesh.tri.length + 3); t2.set(mesh.tri); t2.set([u, nv, w], 3 * k); t2.set([nv, v, w], mesh.tri.length);
    const c2 = new Uint16Array(mesh.m + 1); c2.set(mesh.triCell); c2[mesh.m] = mesh.triCell[k];
    const cell = new Uint16Array(nv + 1); cell.set(mesh.cell); cell[nv] = mesh.triCell[k];
    m = all(d, { ...mesh, n: nv + 1, xy, tri: t2, triCell: c2, cell, m: mesh.m + 1 });
    expect(m, 'mesh-weld', 'a T-junction', /T-junction/); }
});

// ---------------------------------------------------------------------------------------------------------------
// determinism, inputs left alone
// ---------------------------------------------------------------------------------------------------------------

test('robust: rebuilding is deterministic (bit-identical, whatever was built in between) and leaves its inputs alone', () => {
  for (const group of THE_GROUPS) {
    const frozen = JSON.stringify([group.presets, group.reps, group.e1, group.e2, group.center, group.kaleido && group.kaleido.cell]);
    const p = group.presets[group.presets.length - 1];
    const seed = [p.seed[0] + 0.0137, p.seed[1] - 0.0071], seedCopy = seed.slice(), metric = p.metric && p.metric.slice();
    const build = (amp) => { const d = buildDomain(group, { seed, metric, warp: makeWarp(group, amp) }); return [d, buildMesh(group, d)]; };
    const [d1, m1] = build(1);
    build(0); build(0.5); buildMesh(group, buildDomain(group, { seed: [seed[0] + 0.31, seed[1] + 0.17], warp: makeWarp(group, 1) }));
    const [d2, m2] = build(1);
    assert.deepEqual(d2.poly, d1.poly, group.id);
    assert.deepEqual(d2.edges.map((e) => [e.partner, e.cls, e.kind, e.halfTurn, e.nx, e.ny, e.c]), d1.edges.map((e) => [e.partner, e.cls, e.kind, e.halfTurn, e.nx, e.ny, e.c]), group.id);
    assert.ok(m1.n === m2.n && m1.xy.every((v, i) => v === m2.xy[i]), `${group.id}: xy differs between two identical builds`);
    assert.ok(m1.tri.length === m2.tri.length && m1.tri.every((v, i) => v === m2.tri[i]), `${group.id}: tri differs between two identical builds`);
    assert.deepEqual(m2.cells.map((q) => [q.parent, q.depth, q.parity, q.area]), m1.cells.map((q) => [q.parent, q.depth, q.parity, q.area]), group.id);
    assert.ok(m1.boundary.every((b, i) => b.cells.every((v, k) => v === m2.boundary[i].cells[k])), `${group.id}: boundary cells differ between two identical builds`);
    assert.deepEqual(seed, seedCopy, `${group.id}: the seed array was modified`);
    assert.equal(JSON.stringify([group.presets, group.reps, group.e1, group.e2, group.center, group.kaleido && group.kaleido.cell]), frozen, `${group.id}: the group record was modified`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// metrics: any quadratic form invariant under the point group is in the contract of buildDomain
// ---------------------------------------------------------------------------------------------------------------

test('robust: anisotropic invariant metrics give valid tiles (aspect up to 100) and meshes (aspect up to 6)', () => {
  // SPEC 5.1: any positive form invariant under the point group is a valid metric. The presets use aspect ~2 only.
  // [metric, full]: full = also the mesh checks (a needle 100 times longer than wide is not a sensible mesh test)
  const sink = [];
  const diag = [[[1, 0, 4], true], [[25, 0, 1], true], [[1, 0, 400], false], [[1e4, 0, 1], false]];
  const skew = [[[1, 0.6, 1], true], [[2, -1.3, 1], true], [[1, 0.95, 1], true], [[3, 5, 9], true], [[1, -0.9995, 1], false]];
  const plan = { 'o': diag.concat(skew), '2222': diag.concat(skew), '**': diag, 'xx': diag, '*x': diag, '22x': diag, '22*': diag, '*2222': diag, '2*22': diag };
  let cases = 0, slowest = 0, slowestLabel = '';
  for (const [id, metrics] of Object.entries(plan)) {
    const group = BY_ID[id];
    if (!THE_GROUPS.includes(group)) continue;
    for (const [metric, full] of metrics) {
      for (const [pi, p] of group.presets.entries()) {
        for (const amp of [0, 1]) {
          const c = { cls: 'metric', desc: `preset ${pi} seed with metric [${metric}]`, seed: [p.seed[0] + 0.011, p.seed[1] + 0.007], metric, amp };
          const label = labelOf(group, c);
          const F = (name, msg) => sink.push(`[${name}] ${msg}`);
          cases++;
          try {
            const t0 = performance.now();
            const d = buildDomain(group, { seed: c.seed, metric, warp: warpOf(group, amp) });
            const dt = performance.now() - t0;
            if (dt > slowest) { slowest = dt; slowestLabel = label; }
            if (d.metric[0] !== metric[0] || d.metric[1] !== metric[1] || d.metric[2] !== metric[2]) { F('domain', `${label}: the invariant metric was ignored (domain.metric = [${d.metric}])`); continue; }
            if (!checkDomain(group, c, d, label, F)) continue;
            checkTiling(group, d, label, prng(cases), F, 200);
            checkOutline(group, d, undefined, label, F);
            if (full) checkMesh(group, c, d, buildMesh(group, d), label, prng(cases + 7), F);
          } catch (err) { F('throws', `${label}: ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`); }
        }
      }
    }
  }
  if (cases) console.log(`      ${cases} cases; slowest buildDomain ${slowest.toFixed(1)} ms (${slowestLabel})`);
  assert.equal(sink.length, 0, `${sink.length} failures in ${cases} cases\n` + sink.slice(0, 12).join('\n'));
});

// ---------------------------------------------------------------------------------------------------------------
// warp: dense scan (the owner's test samples 6000 random points per group)
// ---------------------------------------------------------------------------------------------------------------

test('robust warp: dense scan of one lattice cell — Jacobian determinant >= 0.35 at amp 0.25 / 0.5 / 1, peak 7-10 % of the tile size, displacement linear in amp', () => {
  const rows = [];
  for (const group of THE_GROUPS) {
    const size = Math.sqrt(group.domainArea), G = 150;
    const w1 = warpOf(group, 1), wh = warpOf(group, 0.5), wq = warpOf(group, 0.25);
    let min1 = Infinity, minH = Infinity, minQ = Infinity, max1 = -Infinity, peak = 0, lin = 0;
    const v1 = [0, 0], v2 = [0, 0];
    for (let i = 0; i < G; i++) {
      for (let j = 0; j < G; j++) {
        const s = (i + 0.5) / G, t = (j + 0.5) / G;
        const x = s * group.e1[0] + t * group.e2[0], y = s * group.e1[1] + t * group.e2[1];
        const d1 = w1.jac(x, y);
        if (d1 < min1) min1 = d1;
        if (d1 > max1) max1 = d1;
        minH = Math.min(minH, wh.jac(x, y)); minQ = Math.min(minQ, wq.jac(x, y));
        w1.vec(x, y, v1);
        peak = Math.max(peak, Math.hypot(v1[0], v1[1]));
        if ((i + j) % 7 === 0) { wq.vec(x, y, v2); lin = Math.max(lin, Math.hypot(v1[0] - 4 * v2[0], v1[1] - 4 * v2[1])); }
      }
    }
    rows.push(`${group.id} ${min1.toFixed(3)}..${max1.toFixed(3)} peak ${(peak / size).toFixed(4)}`);
    assert.ok(min1 >= 0.35 && minH >= 0.35 && minQ >= 0.35, `${group.id}: min det D psi = ${min1} (amp 1), ${minH} (amp 0.5), ${minQ} (amp 0.25)`);
    assert.ok(minQ >= minH - 1e-9 && minH >= min1 - 1e-9, `${group.id}: the smallest determinant should not get worse as amp shrinks: ${minQ}, ${minH}, ${min1}`);
    assert.ok(peak / size > 0.07 && peak / size < 0.10, `${group.id}: peak displacement ${(peak / size).toFixed(4)} of the tile size`);
    assert.ok(Math.abs(w1.peak - peak) < 0.01 * size, `${group.id}: warp.peak ${w1.peak} vs scanned ${peak}`);
    assert.ok(w1.jacMin <= min1 + 0.02 && w1.jacMin >= min1 - 0.02, `${group.id}: warp.jacMin ${w1.jacMin} vs scanned ${min1}`);
    assert.ok(lin < 1e-12, `${group.id}: displacement is not linear in amp (${lin})`);
  }
  console.log('      det D psi (amp 1) and peak displacement / size: ' + rows.join('  |  '));
});

// ---------------------------------------------------------------------------------------------------------------
// arguments
// ---------------------------------------------------------------------------------------------------------------

test('robust args: makeWarp clamps amp to [0, 1]; amp 0 is the identity object', () => {
  const g = BY_ID['442'];
  for (const [amp, want] of [[-1, 0], [0, 0], [2, 1], [NaN, 0], [undefined, 0], [null, 0], [Infinity, 1], ['0.5', 0.5]]) assert.equal(makeWarp(g, amp).amp, want, `amp ${amp}`);
  const w = makeWarp(g, 0);
  assert.deepEqual(w.fwd(0.3, 0.7), [0.3, 0.7]);
  assert.deepEqual(w.inv(-5.5, 11), [-5.5, 11]);
});

test('robust args: a non-finite seed must not give an empty tile (throw, or fall back to a valid one)', () => {
  const bad = [];
  for (const group of THE_GROUPS) {
    for (const seed of [[NaN, 0], [0.3, NaN], [Infinity, 0], [NaN, NaN]]) {
      let d;
      try { d = buildDomain(group, { seed, metric: group.presets[0].metric }); } catch (err) { continue; }          // a clean throw is acceptable
      if (!(d.poly.length >= 3 && Math.abs(d.area - group.domainArea) < 1e-7 && d.seed.every(Number.isFinite))) bad.push(`${group.id} seed [${seed}]: buildDomain returned poly with ${d.poly.length} vertices, area ${d.area}, seed [${d.seed}]`);
    }
  }
  assert.equal(bad.length, 0, `${bad.length} failures\n` + bad.slice(0, 8).join('\n'));
});

// ---------------------------------------------------------------------------------------------------------------
// locate speed: "locate must be fast"; "nearest piece if on / just outside the edge"  (SPEC 5.2)
// ---------------------------------------------------------------------------------------------------------------

test('robust locate speed: boundary samples and cone points are located without scanning every triangle', { skip: !TIMING }, () => {
  // Load-independent: per point, the fastest of 5 single calls of mesh.locate is compared with the fastest of 5
  // brute-force scans over ALL triangles of the same mesh (nearest triangle by distance), timed in the same loop.
  // A point that costs more than 30 % of a full scan (and more than 4 microseconds) is "slow". Interior points cost
  // about 1 % of a scan. The points are the mesh's own boundary samples (mesh.boundary[i].pts, every second one) and
  // the cone points of the tile: on the tile boundary, a rounding error inside or outside.
  const rows = [], slowList = [];
  let nPoints = 0, nSlow = 0;
  for (const group of THE_GROUPS) {
    if (!group.kaleido || group.fold === 'snowflake') continue;
    let gPts = 0, gSlow = 0, gWorst = 0, gInterior = 0, gScan = 0;
    for (const [pi, p] of group.presets.entries()) {
      for (const amp of [0, 1]) {
        const d = buildDomain(group, { seed: p.seed, metric: p.metric, warp: warpOf(group, amp) });
        const mesh = buildMesh(group, d);
        if (mesh.cells.length < 2) continue;
        const { xy, tri } = mesh, m = tri.length / 3;
        const scan = (px, py) => {
          let best = Infinity, bt = -1;
          for (let t = 0; t < m; t++) {
            const a = tri[3 * t], b = tri[3 * t + 1], q = tri[3 * t + 2];
            const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1], qx = xy[2 * q], qy = xy[2 * q + 1];
            let dd;
            if ((bx - ax) * (py - ay) - (by - ay) * (px - ax) >= 0 && (qx - bx) * (py - by) - (qy - by) * (px - bx) >= 0 && (ax - qx) * (py - qy) - (ay - qy) * (px - qx) >= 0) dd = 0;
            else dd = Math.min(segDist2(px, py, ax, ay, bx, by), segDist2(px, py, bx, by, qx, qy), segDist2(px, py, qx, qy, ax, ay));
            if (dd < best) { best = dd; bt = t; }
          }
          return bt;
        };
        const fastest = (fn, px, py) => { let mn = Infinity; for (let k = 0; k < 5; k++) { const t0 = performance.now(); fn(px, py); const dt = performance.now() - t0; if (dt < mn) mn = dt; } return mn * 1000; };
        const pts = [];
        for (const b of mesh.boundary) for (let j = 0; j < b.cells.length; j += 2) pts.push([b.pts[2 * j], b.pts[2 * j + 1], `boundary[${b.edge}] (${b.kind}) sample ${j}`]);
        for (const q of d.conePoints) pts.push([q.x, q.y, `cone point of order ${q.order}`]);
        // warm both up
        for (let k = 0; k < 60; k++) { const q = pts[k % pts.length]; scan(q[0], q[1]); mesh.locate(q[0], q[1]); }
        // interior reference: centroids
        let ti = 0, ni = 0;
        for (let t = 0; t < m; t += Math.max(1, m >> 6)) { const a = tri[3 * t], b = tri[3 * t + 1], q = tri[3 * t + 2]; ti += fastest(mesh.locate, (xy[2 * a] + xy[2 * b] + xy[2 * q]) / 3, (xy[2 * a + 1] + xy[2 * b + 1] + xy[2 * q + 1]) / 3); ni++; }
        let ts = 0;
        for (const [px, py, what] of pts) {
          const tl = fastest(mesh.locate, px, py), tb = fastest(scan, px, py);
          ts += tb; gPts++;
          if (tl / tb > gWorst) gWorst = tl / tb;
          if (tl > 0.3 * tb && tl > 4) { gSlow++; if (slowList.length < 400) slowList.push(`${group.id} preset ${pi} (${p.name}) amp ${amp}: ${what} (${px}, ${py}): locate ${tl.toFixed(1)} us, a scan of all ${m} triangles ${tb.toFixed(1)} us`); }
        }
        gInterior = Math.max(gInterior, ti / ni); gScan = Math.max(gScan, ts / pts.length);
      }
    }
    nPoints += gPts; nSlow += gSlow;
    rows.push(`${group.id}: ${gSlow} of ${gPts} slow (worst ${gWorst.toFixed(2)} of a scan; interior ${gInterior.toFixed(2)} us, scan ${gScan.toFixed(0)} us)`);
  }
  console.log('      boundary samples and cone points that cost > 30 % of a full scan: ' + rows.join('  |  '));
  const byGroup = new Map();
  for (const l of slowList) { const k = l.split(' ')[0]; if (!byGroup.has(k)) byGroup.set(k, l); }
  assert.equal(nSlow, 0, `${nSlow} of ${nPoints} points are located by (what costs as much as) a scan of every triangle\n` + [...byGroup.values()].join('\n'));
});

// ---------------------------------------------------------------------------------------------------------------
// timing: buildDomain + buildMesh, median of 20, every group
// ---------------------------------------------------------------------------------------------------------------

test('robust timing: buildDomain + buildMesh (median of 20) stays under 30 ms for every group, preset and amp 0 / 1', { skip: !TIMING }, () => {
  // The machine is shared: other test files run at the same time. Wall-clock medians then measure the scheduler, so
  // every run is timed twice — wall clock and CPU time of this process — and a case is flagged when BOTH medians
  // are over 30 ms (after up to two repeats). Both are printed.
  const rows = [], over = [];
  const measure = (run) => {
    run(); run();
    const wall = [], cpu = [];
    for (let k = 0; k < 20; k++) {
      const c0 = process.cpuUsage(), t0 = performance.now();
      run();
      const t1 = performance.now(), c1 = process.cpuUsage(c0);
      wall.push(t1 - t0); cpu.push((c1.user + c1.system) / 1000);
    }
    wall.sort((a, b) => a - b); cpu.sort((a, b) => a - b);
    return { wall: (wall[9] + wall[10]) / 2, cpu: (cpu[9] + cpu[10]) / 2, best: wall[0] };
  };
  let worstAll = 0;
  for (const group of THE_GROUPS) {
    let worst = null, worstLabel = '';
    for (const [i, p] of group.presets.entries()) {
      for (const amp of [0, 1]) {
        const warp = warpOf(group, amp);
        const run = () => buildMesh(group, buildDomain(group, { seed: p.seed, metric: p.metric, warp }));
        let r = measure(run);
        for (let again = 0; again < 2 && Math.min(r.wall, r.cpu) > 30; again++) { const r2 = measure(run); if (Math.min(r2.wall, r2.cpu) < Math.min(r.wall, r.cpu)) r = r2; }
        if (!worst || Math.min(r.wall, r.cpu) > Math.min(worst.wall, worst.cpu)) { worst = r; worstLabel = `preset ${i} amp ${amp}`; }
        if (Math.min(r.wall, r.cpu) > 30) over.push(`${group.id} preset ${i} (${p.name}) amp ${amp}: median wall ${r.wall.toFixed(1)} ms, median CPU ${r.cpu.toFixed(1)} ms, fastest ${r.best.toFixed(1)} ms`);
      }
    }
    worstAll = Math.max(worstAll, Math.min(worst.wall, worst.cpu));
    rows.push(`${group.id} ${worst.wall.toFixed(1)} / ${worst.cpu.toFixed(1)} / ${worst.best.toFixed(1)} (${worstLabel})`);
  }
  console.log('      worst case per group, ms — median wall / median CPU / fastest run: ' + rows.join('  |  '));
  console.log(`      worst median over all groups: ${worstAll.toFixed(1)} ms (limit 30)`);
  assert.equal(over.length, 0, 'over 30 ms:\n' + over.join('\n'));
});
