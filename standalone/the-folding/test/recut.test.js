// test/recut.test.js — "re-cut first" (src/folds/recut.js, 13 Nov 2026): the motion of the two shapes that pass through
// themselves, the Klein bottle (xx) and the cross-cap (22x).
//
// The claim that matters is the owner's reason for the motion: NO PAPER PASSES THROUGH PAPER. It is measured here with
// the 22x lab's detector (src/selfx.js) over the whole motion, for every preset, random cuts, straight and wavy — and
// the same detector is shown to find the crossing in the fold modules' own one-sheet motion of the same cuts (the
// control), so "never crosses" is a finding, not a blind spot. The rest is the fold contract of SPEC 5.3, asked of the
// re-cut fold: the identity at t = 0, the tile's seams closed at t = 1, no jump, nothing non-finite; and what a re-cut
// is: the pieces are the tile, each carried rigidly by an element of the group onto the home tile, which they fill once.
//   RECUT_SEEDS=12 node --test test/recut.test.js     widens the sweep
//   node --test test/recut.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID, contains, elementsNear } from '../src/groups.js';
import { inverse, apply, classify, det } from '../src/geom.js';
import { makeWarp, buildDomain } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import { createFold, foldMeshOptions, canRecut } from '../src/folds/index.js';
import createRecut, { RECUT_FOLDS, recutHome, carry, moveText, MOVE_SECONDS, RECUT_MAX_SECONDS, DROP_SHARE, HOP } from '../src/folds/recut.js';
import { createSelfX, jitterPlane, rimTriangles } from '../src/selfx.js';
import { buildScene, mapScene, sceneLines, foldCaption, planeRecut, recutActive, WIDTHS } from '../src/app.js';

const SEEDS = Math.max(3, +process.env.RECUT_SEEDS || 3);
const IDS = ['22x', 'xx'];

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
  const home = group.presets[0];
  for (const [i, p] of group.presets.entries()) yield { label: `${group.id} ${p.name}`, seed: p.seed, metric: p.metric, anchor: p.anchor || p.seed, preset: i };
  const rnd = prng(7001 + 13 * GROUPS.indexOf(group));
  for (let k = 0; k < SEEDS; k++) {
    const seed = [group.center[0] + (2 * rnd() - 1) * 0.7 * group.viewHalf, group.center[1] + (2 * rnd() - 1) * 0.7 * group.viewHalf];
    // (the app's anchor is the seed of the preset last chosen: the home's here; one case in three has no anchor at all)
    yield { label: `${group.id} random ${k} (${seed[0].toFixed(4)}, ${seed[1].toFixed(4)})`, seed, metric: undefined, anchor: k % 3 === 2 ? undefined : home.seed, preset: -1 };
  }
}

function build(group, c, amp, opts = {}) {
  const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp: makeWarp(group, amp) });
  const mesh = buildMesh(group, domain, { ...foldMeshOptions(group), ...(opts.draft ? { draft: true } : {}) });
  const o = { recut: opts.recut !== false };
  if (c.anchor) o.anchor = c.anchor.slice();
  if (opts.draft) o.density = false;
  return { domain, fold: createFold(group, domain, mesh, o) };
}

/** Positions of the mesh's vertices (or of other plane points of the same pieces) at t. */
function place(fold, t, xy, cell, out) {
  const F = fold.at(t), o = [0, 0, 0], n = cell.length;
  for (let v = 0; v < n; v++) { F(xy[2 * v], xy[2 * v + 1], cell[v], o); out[3 * v] = o[0]; out[3 * v + 1] = o[1]; out[3 * v + 2] = o[2]; }
  return out;
}

/**
 * How much of the sheet passes through itself, over the motion: the largest total length of the lines along which two
 * sheets cross, in tile widths, at `steps` + 1 moments. The detector's own triangulation (the interior points moved a
 * little, so a crossing that runs along mesh edges is found), and the triangles within `rim` tile sizes of a piece's
 * outline left out: a rim that ENDS on another sheet touches it, and on a faceted mesh it dips through the facets by
 * the facets' own sag, which is no passing through.
 */
function crossing(fold, size, steps, rim = 0.03) {
  const M = fold.mesh, n = M.n;
  const uv = jitterPlane(M.xy, M.tri, M.triCell);
  const X = createSelfX(M.tri, { skip: rimTriangles(M.tri, n, { xy: M.xy, within: rim * size }) });
  const pos = new Float32Array(3 * n);
  let max = 0, at = 0;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    place(fold, t, uv, M.cell, pos);
    const L = X.compute(pos, size).length / size;
    if (L > max) { max = L; at = t; }
  }
  return { max, at };
}
/** Below this many tile widths the sheet is not crossing (the lab's own threshold). */
const NONE = 0.004;

test('re-cut: the two shapes that pass through themselves have it, and only they; every other fold is the module\'s own', () => {
  assert.deepEqual([...RECUT_FOLDS].sort(), ['crosscap', 'klein']);
  for (const g of GROUPS) {
    assert.equal(canRecut(g), IDS.includes(g.id), g.id);
    const p = g.presets[g.presets.length - 1];
    const domain = buildDomain(g, { seed: p.seed, metric: p.metric, warp: makeWarp(g, 0) });
    const mesh = g.fold === 'snowflake' ? null : buildMesh(g, domain, foldMeshOptions(g));
    const plain = createFold(g, domain, mesh, { anchor: (p.anchor || p.seed).slice() });
    const asked = createFold(g, domain, mesh, { anchor: (p.anchor || p.seed).slice(), recut: true });
    assert.equal(!!plain.recut, false, `${g.id}: the module's own fold has no recut`);
    assert.equal(!!asked.recut, IDS.includes(g.id), `${g.id}: recut asked for`);
    if (!IDS.includes(g.id)) {
      // the same motion: the same positions for a spread of vertices
      const M = plain.mesh, a = [0, 0, 0], b = [0, 0, 0];
      assert.equal(asked.mesh.n, M.n, g.id);
      for (const t of [0.3, 1]) {
        const F0 = plain.at(t), F1 = asked.at(t);
        for (let v = 0; v < M.n; v += Math.max(1, Math.floor(M.n / 40))) { F0(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], a); F1(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], b); assert.deepEqual(b, a, `${g.id} t = ${t}`); }
      }
    }
  }
  // the home tile: the group's default cut, built once
  for (const id of IDS) {
    const g = BY_ID[id];
    const H = recutHome(g, (group, domain, mesh, opts) => createFold(group, domain, mesh, opts), foldMeshOptions(g));
    assert.equal(H.name, g.presets[0].name);
    assert.deepEqual(H.seed, [g.presets[0].seed[0], g.presets[0].seed[1]]);
    let a2 = 0;
    for (let i = 0; i < H.poly.length; i++) { const p = H.poly[i], q = H.poly[(i + 1) % H.poly.length]; a2 += p[0] * q[1] - p[1] * q[0]; }
    assert.ok(Math.abs(a2 / 2 - g.domainArea) < 1e-9, `${id}: the home tile is a tile`);
  }
  assert.equal(BY_ID['22x'].presets[0].name, 'Pocket');
  assert.equal(BY_ID['xx'].presets[0].name, 'Rectangle');
});

test('re-cut: carry(element, s) is the identity at 0, the element at 1, rigid in between, and never below the paper', () => {
  const g = BY_ID['22x'], size = Math.sqrt(g.domainArea);
  const els = [...g.reps.slice(1), { a: 1, b: 0, c: 0, d: 1, tx: g.e1[0], ty: g.e1[1] }];
  for (const e of els) {
    const c = classify(e);
    c.hop = HOP * size;
    // a piece: a few points on one side of the axis, as recut.js sets the motion up for it
    const pts = [[0.21, 0.37], [0.3, 0.52], [0.12, 0.6], [0.26, 0.44]];
    if (c.type === 'rotation') c.turn = Math.abs(c.angle);
    if (c.type === 'glide' || c.type === 'reflection') {
      const nx = -c.dir[1], ny = c.dir[0];
      let lo = Infinity, hi = -Infinity, mean = 0;
      for (const p of pts) { const b = (p[0] - c.point[0]) * nx + (p[1] - c.point[1]) * ny; lo = Math.min(lo, b); hi = Math.max(hi, b); mean += b / pts.length; }
      c.sigma = mean >= 0 ? 1 : -1; c.lift = Math.max(0, c.sigma > 0 ? -lo : hi) + 0.05 * size;
    }
    const at = (s, p) => { const m = carry(c, s); return [m[0] * p[0] + m[1] * p[1] + m[2], m[3] * p[0] + m[4] * p[1] + m[5], m[6] * p[0] + m[7] * p[1] + m[8]]; };
    for (const p of pts) {
      const a = at(0, p), b = at(1, p), q = apply(e, p[0], p[1]);
      assert.ok(Math.hypot(a[0] - p[0], a[1] - p[1], a[2]) < 1e-12, `${c.type}: the identity at s = 0`);
      assert.ok(Math.hypot(b[0] - q[0], b[1] - q[1], b[2]) < 1e-12, `${c.type}: the element at s = 1`);
    }
    for (let k = 1; k < 40; k++) {
      const s = k / 40, P0 = at(s, pts[0]), P1 = at(s, pts[1]), P2 = at(s, pts[2]);
      // rigid: distances kept
      assert.ok(Math.abs(Math.hypot(P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]) - Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])) < 1e-12, `${c.type}: rigid at s = ${s}`);
      assert.ok(Math.abs(Math.hypot(P2[0] - P0[0], P2[1] - P0[1], P2[2] - P0[2]) - Math.hypot(pts[2][0] - pts[0][0], pts[2][1] - pts[0][1])) < 1e-12);
      for (const p of pts) assert.ok(at(s, p)[2] > 0, `${c.type}: above the paper at s = ${s}`);
    }
    assert.ok(moveText(c).length > 4);
  }
  assert.equal(moveText({ type: 'identity' }), 'stays');
});

/**
 * The runs of the tile's outline, each sample carried by ITS piece's element: how far outside the home tile it lands.
 * A stub of a run on the wrong piece lands outside (the review of 13 Nov found one, 0.019 tile sizes long). The one
 * exception: a speck that is left out (below DROP_SHARE of the tile, a pinhole) — its rim stays on the run of the
 * piece next to it, a speck's depth outside; such a sample lies in a copy of the home that has no piece.
 * -> { worst (not on a speck), speck (the deepest on a speck), specks (samples on specks), left (share left out) }, tile sizes
 */
function runsOffPiece(group, fold) {
  const M = fold.mesh, R = fold.recut, tags = M.cells, H = R.home.poly, size = Math.sqrt(group.domainArea);
  let h2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length]; h2 += a[0] * b[1] - a[1] * b[0]; cx += a[0] / H.length; cy += a[1] / H.length; }
  const sg = h2 < 0 ? -1 : 1;                        // (a home copy carried by a glide runs clockwise)
  const outside = (x, y) => { let worst = 0; for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); worst = Math.max(worst, (-sg * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]))) / l); } return worst; };
  const keyOf = (g) => [g.a, g.b, g.c, g.d, g.tx, g.ty].map((v) => Math.round(v * 1e6)).join();
  const kept = new Set(R.pieces.map((p) => keyOf(p.element)));
  let others = null, worst = 0, speck = 0, specks = 0;
  for (const r of M.boundaryRuns) {
    for (let k = 0; k < r.cells.length; k++) {
      const px = r.pts[2 * k], py = r.pts[2 * k + 1];
      const g = tags[r.cells[k]].g, d = outside(g.a * px + g.b * py + g.tx, g.c * px + g.d * py + g.ty);
      if (d < 2e-5 * size) continue;                 // (float32 samples: a hair off the cut)
      if (!others) others = elementsNear(group, cx, cy, 6 * size, cx, cy).filter((e) => !kept.has(keyOf(e)));
      if (others.some((e) => outside(e.a * px + e.b * py + e.tx, e.c * px + e.d * py + e.ty) <= 2e-5 * size)) { speck = Math.max(speck, d); specks++; } else worst = Math.max(worst, d);
    }
  }
  return { worst: worst / size, speck: speck / size, specks, left: 1 - R.pieces.reduce((s, p) => s + p.area, 0) / group.domainArea };
}

// ---- the sweep: every preset and random cuts, straight and wavy -----------------------------------------------------

const stats = { folds: 0, movers: 0, maxPieces: 0, maxStep: 0, maxCross: 0, seamPairs: 0, maxSeam: 0, types: {} };
const failures = { mesh: [], identity: [], seams: [], pieces: [], continuity: [], finite: [], api: [], cross: [] };
const fail = (k, m) => failures[k].push(m);
const show = (k) => failures[k].slice(0, 6).join('\n') + (failures[k].length > 6 ? `\n... ${failures[k].length} failures` : '');

function check(group, c, amp) {
  const label = `${c.label} amp ${amp}${c.anchor ? '' : ' (no anchor)'}`;
  const size = Math.sqrt(group.domainArea);
  const { domain, fold } = build(group, c, amp);
  const M = fold.mesh, R = fold.recut;
  stats.folds++;
  if (!R || !M.recut) { fail('api', `${label}: no re-cut`); return; }
  const n = M.n, xy = M.xy, cell = M.cell, tri = M.tri, tags = M.cells;
  stats.movers += R.movers; stats.maxPieces = Math.max(stats.maxPieces, R.pieces.length);
  for (const p of R.pieces) stats.types[p.type] = (stats.types[p.type] || 0) + 1;

  // ---- the mesh: drawable; the tile, cut into pieces that share no vertex
  if (!(xy instanceof Float32Array) || !(tri instanceof Uint32Array) || !Array.isArray(M.boundary) || typeof M.locate !== 'function') { fail('api', `${label}: mesh`); return; }
  if (tri.length / 3 > 20000) fail('mesh', `${label}: ${tri.length / 3} triangles`);
  let area = 0, cw = 0;
  const partOfVertex = new Int32Array(n).fill(-1);
  for (let i = 0; i < tri.length; i += 3) {
    const a = tri[i], b = tri[i + 1], d = tri[i + 2];
    if (!(a < n && b < n && d < n)) { fail('mesh', `${label}: index out of range`); break; }
    const ar = (xy[2 * b] - xy[2 * a]) * (xy[2 * d + 1] - xy[2 * a + 1]) - (xy[2 * b + 1] - xy[2 * a + 1]) * (xy[2 * d] - xy[2 * a]);
    const side = Math.max(Math.hypot(xy[2 * b] - xy[2 * a], xy[2 * b + 1] - xy[2 * a + 1]), Math.hypot(xy[2 * d] - xy[2 * b], xy[2 * d + 1] - xy[2 * b + 1]));
    if (ar < -8 * 1.2e-7 * 4 * side) cw++;
    area += ar / 2;
    const tg = M.triCell[i / 3];
    if (cell[a] !== tg || cell[b] !== tg || cell[d] !== tg) fail('mesh', `${label}: a triangle's corners are not of its tag`);
    for (const v of [a, b, d]) {
      const part = tags[cell[v]].part;
      if (partOfVertex[v] >= 0 && partOfVertex[v] !== part) fail('mesh', `${label}: a vertex is shared by two pieces`);
      partOfVertex[v] = part;
    }
  }
  if (cw) fail('mesh', `${label}: ${cw} clockwise triangles`);
  // (a wavy outline is a polyline; a piece smaller than DROP_SHARE of the tile is left out)
  const tol = amp ? 1.5e-3 : 1e-6 + R.pieces.length * DROP_SHARE;
  if (Math.abs(area / group.domainArea - 1) > tol) fail('mesh', `${label}: the pieces have ${(area / group.domainArea).toFixed(7)} of the tile's area`);
  for (const tg of tags) if (!(tg.part >= 0 && tg.part < R.pieces.length) || !contains(group, tg.g)) fail('mesh', `${label}: a tag's piece or element`);

  // ---- 1. the identity at t = 0, exactly
  {
    const F = fold.at(0), o = [0, 0, 0];
    let bad = 0;
    for (let v = 0; v < n; v++) { o[0] = o[1] = o[2] = NaN; F(xy[2 * v], xy[2 * v + 1], cell[v], o); if (o[0] !== xy[2 * v] || o[1] !== xy[2 * v + 1] || o[2] !== 0) bad++; }
    for (const b of M.boundary) for (let k = 0; k < b.cells.length; k++) { F(b.pts[2 * k], b.pts[2 * k + 1], b.cells[k], o); if (o[0] !== b.pts[2 * k] || o[1] !== b.pts[2 * k + 1] || o[2] !== 0) bad++; }
    if (bad) fail('identity', `${label}: at(0) moves ${bad} points`);
  }

  // ---- 2. the tile's own seams close at t = 1 (the samples' stored tags, and tags located afresh)
  {
    const F = fold.at(1), a = [0, 0, 0], b2 = [0, 0, 0], q = [0, 0];
    const byEdge = new Map(M.boundary.map((b) => [b.edge, b]));
    if (byEdge.size !== domain.edges.length) fail('mesh', `${label}: boundary has ${byEdge.size} of ${domain.edges.length} edges`);
    domain.edges.forEach((e, i) => {
      if (e.kind !== 'cut') return;
      const b = byEdge.get(i), gi = inverse(e.g);
      let worst = 0;
      for (let k = 0; k < b.cells.length; k++) {
        const x = b.pts[2 * k], y = b.pts[2 * k + 1];
        apply(gi, x, y, q);
        F(q[0], q[1], M.locate(q[0], q[1]), b2);
        F(x, y, b.cells[k], a);
        worst = Math.max(worst, Math.hypot(a[0] - b2[0], a[1] - b2[1], a[2] - b2[2]));
        F(x, y, M.locate(x, y), a);
        worst = Math.max(worst, Math.hypot(a[0] - b2[0], a[1] - b2[1], a[2] - b2[2]));
        stats.seamPairs++;
      }
      stats.maxSeam = Math.max(stats.maxSeam, worst / size);
      if (!(worst < 1e-6 * size)) fail('seams', `${label}: edge ${i} is ${worst / size} tile sizes from its partner at t = 1`);
    });
  }

  // ---- what a re-cut is: at the moment the fold begins, every piece lies where its element carries it, in the plane,
  //      and the pieces fill the home tile once
  {
    const pos = place(fold, R.tau0, xy, cell, new Float64Array(3 * n));
    let worst = 0;
    for (let v = 0; v < n; v++) {
      const g = tags[cell[v]].g, x = g.a * xy[2 * v] + g.b * xy[2 * v + 1] + g.tx, y = g.c * xy[2 * v] + g.d * xy[2 * v + 1] + g.ty;
      worst = Math.max(worst, Math.hypot(pos[3 * v] - x, pos[3 * v + 1] - y, pos[3 * v + 2]));
    }
    if (!(worst < 1e-9 * size)) fail('pieces', `${label}: when the fold begins a point is ${worst / size} tile sizes from where its element carries it`);
    // the home: the pieces' images cover it once (points of a grid over its box: in exactly one triangle, or on an edge)
    const H = R.home.poly;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of H) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    // (a home copy carried by a glide runs clockwise: the sign of its area sets the side that is inside)
    let h2 = 0;
    for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length]; h2 += a[0] * b[1] - a[1] * b[0]; }
    const sg = h2 < 0 ? -1 : 1;
    const inHome = (x, y, m) => { for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length]; if (sg * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) < m) return false; } return true; };
    const rnd = prng(31 + stats.folds);
    let holes = 0, doubles = 0, probes = 0;
    for (let i = 0; i < 60; i++) {
      const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
      if (!inHome(x, y, 0.01 * size * size)) continue;                 // well inside (the test is a cross product: an area)
      probes++;
      let hits = 0;
      for (let k = 0; k < tri.length; k += 3) {
        const a = 3 * tri[k], b = 3 * tri[k + 1], d = 3 * tri[k + 2];
        const s1 = (pos[b] - pos[a]) * (y - pos[a + 1]) - (pos[b + 1] - pos[a + 1]) * (x - pos[a]);
        const s2 = (pos[d] - pos[b]) * (y - pos[b + 1]) - (pos[d + 1] - pos[b + 1]) * (x - pos[b]);
        const s3 = (pos[a] - pos[d]) * (y - pos[d + 1]) - (pos[a + 1] - pos[d + 1]) * (x - pos[d]);
        // (a piece carried by a reflection or a glide lies face down: its triangles run clockwise there)
        if ((s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0)) hits++;
      }
      if (hits === 0) holes++; else if (hits > 1) doubles++;
    }
    // (a probe that falls exactly on an edge is in no triangle's inside; a wavy tile's dropped speck is a pinhole)
    if (probes < 20) fail('pieces', `${label}: ${probes} probes`);
    if (holes > (amp ? 2 : 1) || doubles) fail('pieces', `${label}: of ${probes} points of the home tile, ${holes} lie in no piece and ${doubles} in two`);
  }

  // ---- every piece has its triangles (a piece smaller than a mesh triangle too: the review of 13 Nov found one left
  //      out), with the area its outline says; and every run of the tile's outline, carried by ITS piece, lies in the
  //      home tile (a stub of a run on the wrong piece would land outside: the same review)
  {
    const meshArea = new Float64Array(R.pieces.length);
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i], b = tri[i + 1], d = tri[i + 2];
      meshArea[tags[M.triCell[i / 3]].part] += 0.5 * ((xy[2 * b] - xy[2 * a]) * (xy[2 * d + 1] - xy[2 * a + 1]) - (xy[2 * b + 1] - xy[2 * a + 1]) * (xy[2 * d] - xy[2 * a]));
    }
    for (const p of R.pieces) {
      if (!(meshArea[p.part] > 0)) fail('pieces', `${label}: piece ${p.part} (${(100 * p.area / group.domainArea).toFixed(4)} % of the tile) has no triangle`);
      else if (Math.abs(meshArea[p.part] - p.area) > (amp ? 2e-3 : 1e-7) * group.domainArea) fail('pieces', `${label}: piece ${p.part}: its triangles have ${meshArea[p.part]} of area, its outline ${p.area}`);
    }
    const O = runsOffPiece(group, fold);
    if (O.worst > 0) fail('mesh', `${label}: a sample of a run, carried by its piece, lands ${O.worst.toExponential(2)} tile sizes outside the home tile`);
    // the specks that are left out: a few times DROP_SHARE together at most, none deeper than a hundredth of a tile
    if (O.specks && !(O.left > 1e-9)) fail('mesh', `${label}: ${O.specks} samples lie on a speck that is left out, but the pieces have all of the tile's area`);
    if (!(O.left < 8 * DROP_SHARE) || !(O.speck < 0.01)) fail('mesh', `${label}: ${(100 * O.left).toFixed(4)} % of the tile is left out; a speck ${O.speck.toExponential(2)} tile sizes deep`);
    stats.specks = Math.max(stats.specks || 0, O.speck);
  }

  // ---- the pieces: one stays or none, the movers one after another, in the order half-turns, translations, glides
  {
    const P = R.pieces, mv = P.filter((p) => p.moves);
    if (mv.length !== R.movers) fail('api', `${label}: movers`);
    if (P.filter((p) => !p.moves).length > 1) fail('pieces', `${label}: two pieces stay`);
    const rank = (p) => (p.type === 'rotation' ? 1 : p.type === 'translation' ? 2 : 3);
    for (let i = 0; i < mv.length; i++) {
      const p = mv[i];
      if (!(p.from >= 0 && p.to > p.from && p.to <= R.tau0 + 1e-12)) fail('pieces', `${label}: the window of piece ${i} is [${p.from}, ${p.to}] (the fold begins at ${R.tau0})`);
      if (i && !(p.from >= mv[i - 1].to - 1e-12)) fail('pieces', `${label}: piece ${i} starts before piece ${i - 1} has landed`);
      if (i && rank(p) < rank(mv[i - 1])) fail('pieces', `${label}: the order of the pieces`);
      if (!['rotation', 'translation', 'glide', 'reflection'].includes(p.type) || !contains(group, p.element)) fail('pieces', `${label}: piece ${i} is carried by no element of the group`);
      if (!(p.area > DROP_SHARE * group.domainArea)) fail('pieces', `${label}: a piece of ${(p.area / group.domainArea).toExponential(1)} of the tile was kept`);
    }
    const share = P.reduce((s, p) => s + p.area, 0) / group.domainArea;
    if (Math.abs(share - 1) > tol) fail('pieces', `${label}: the pieces' areas add up to ${share.toFixed(6)} tiles`);
    if (!(fold.duration >= 4 && fold.duration <= 7 + RECUT_MAX_SECONDS + 1e-9)) fail('api', `${label}: duration ${fold.duration}`);
    if (Math.abs(fold.duration - (R.foldSeconds + R.seconds)) > 1e-9 || Math.abs(R.tau0 - (R.movers ? R.seconds / fold.duration : 0)) > 1e-12) fail('api', `${label}: the timing does not add up`);
    if (R.movers && !(R.seconds <= RECUT_MAX_SECONDS + 1e-9 && R.seconds >= 0.1 * MOVE_SECONDS)) fail('api', `${label}: ${R.seconds} s of moves`);
    if (fold.foldFrom !== R.tau0) fail('api', `${label}: foldFrom`);
    const st = fold.stops;
    if (st[0].t !== 0 || st[st.length - 1].t !== 1) fail('api', `${label}: stops`);
    for (let i = 1; i < st.length; i++) if (!(st[i].t > st[i - 1].t + 0.02) || !st[i].label) fail('api', `${label}: stops ${i - 1}, ${i}: ${st[i - 1].t}, ${st[i].t}`);
    if (R.movers && !st.some((s) => Math.abs(s.t - R.tau0) < 1e-12 && /re-cut into the/.test(s.label))) fail('api', `${label}: no stop where the fold begins`);
    if (R.home.name !== group.presets[0].name) fail('api', `${label}: home ${R.home.name}`);
    if (c.anchor && c.preset >= 0 && Math.hypot(R.home.element.tx, R.home.element.ty) + Math.abs(R.home.element.a - 1) > 1e-12) fail('api', `${label}: a preset's home is not the home tile itself`);
  }

  // ---- 3. continuity: no jump. 200 steps; the largest steps, the steps round every stop and round the start and the
  //      end of every piece's move are cut into 32: no part moves a point by more than a sixteenth of the largest
  //      whole step (a motion of bounded speed moves a thirty-second of it; a jump stays as large as it is)
  {
    const STEPS = 200, PARTS = 32;
    const ids = [];
    for (let v = 0; v < n; v += Math.max(1, Math.floor(n / 150))) ids.push(v);
    // (each piece's far corners move the most)
    const far = new Map();
    for (let v = 0; v < n; v++) { const p = tags[cell[v]].part, d = Math.hypot(xy[2 * v] - domain.seed[0], xy[2 * v + 1] - domain.seed[1]); if (!far.has(p) || d > far.get(p)[0]) far.set(p, [d, v]); }
    for (const [, v] of far.values()) ids.push(v);
    const sx = new Float32Array(2 * ids.length), sc = new Uint16Array(ids.length);
    ids.forEach((v, i) => { sx[2 * i] = xy[2 * v]; sx[2 * i + 1] = xy[2 * v + 1]; sc[i] = cell[v]; });
    const sample = (t) => place(fold, t, sx, sc, new Float64Array(3 * ids.length));
    const dist = (a, b) => { let m = 0; for (let i = 0; i < a.length; i += 3) m = Math.max(m, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2])); return m; };
    const steps = new Float64Array(STEPS);
    let prev = sample(0), maxStep = 0, bad = 0, zMin = Infinity;
    for (let i = 1; i <= STEPS; i++) {
      const cur = sample(i / STEPS);
      for (let k = 0; k < cur.length; k++) if (!Number.isFinite(cur[k])) bad++;
      // (while the pieces are carried they stay on or above the paper)
      if (i / STEPS <= R.tau0) for (let k = 2; k < cur.length; k += 3) zMin = Math.min(zMin, cur[k]);
      steps[i - 1] = dist(prev, cur); maxStep = Math.max(maxStep, steps[i - 1]);
      prev = cur;
    }
    if (bad) fail('finite', `${label}: ${bad} non-finite positions on the grid of ${STEPS} steps`);
    if (zMin < -1e-9 * size) fail('pieces', `${label}: a carried piece dips ${-zMin / size} tile sizes below the paper`);
    stats.maxStep = Math.max(stats.maxStep, maxStep / size);
    // a piece crosses a tile in about a second: at most 0.75 tile sizes in 1/200 of the play
    if (!(maxStep <= 0.75 * size)) fail('continuity', `${label}: a point moves ${maxStep / size} tile sizes in 1/${STEPS}`);
    const watch = new Set([0, STEPS - 1]);
    [...steps.keys()].sort((a, b) => steps[b] - steps[a]).slice(0, 6).forEach((i) => watch.add(i));
    const marks = fold.stops.map((s) => s.t);
    for (const p of R.pieces) if (p.moves) marks.push(p.from, p.to);
    for (const tm of marks) for (const i of [Math.floor(tm * STEPS) - 1, Math.floor(tm * STEPS), Math.ceil(tm * STEPS)]) if (i >= 0 && i < STEPS) watch.add(i);
    for (const i of watch) {
      let u = sample(i / STEPS), worst = 0;
      for (let j = 1; j <= PARTS; j++) { const w = sample((i + j / PARTS) / STEPS); worst = Math.max(worst, dist(u, w)); u = w; }
      if (!(worst <= (2 / PARTS) * maxStep + 1e-12 * size)) fail('continuity', `${label}: 1/${PARTS} of the step ${i} / ${STEPS} moves a point ${worst / size} tile sizes; the largest whole step is ${maxStep / size}`);
    }
    // finite at the special times and a hair either side
    const o = [0, 0, 0];
    for (const tm of [0, 1, R.tau0, ...marks]) for (const dlt of [0, 1e-12, -1e-12, 1e-9, -1e-9, 1e-6, -1e-6]) {
      const t = tm + dlt;
      if (t < 0 || t > 1) continue;
      const F = fold.at(t);
      for (let i = 0; i < ids.length; i += 7) { o[0] = o[1] = o[2] = NaN; F(sx[2 * i], sx[2 * i + 1], sc[i], o); if (!Number.isFinite(o[0] + o[1] + o[2])) { fail('finite', `${label}: not finite at t = ${t}`); break; } }
    }
    // at(t) of one time is not disturbed by asking for another
    const Fa = fold.at(0.4 * R.tau0 || 0.2), before = [0, 0, 0], after = [0, 0, 0];
    Fa(sx[0], sx[1], sc[0], before); fold.at(0.9); fold.at(0.1 * R.tau0); Fa(sx[0], sx[1], sc[0], after);
    if (before.join() !== after.join()) fail('api', `${label}: at(t) is disturbed by a later at()`);
  }

  // ---- the lines: the runs of the outline each ride on one piece; the cuts lie in the tile; the styles
  {
    for (const r of M.boundaryRuns) {
      const parts = new Set([...r.cells].map((tg) => tags[tg].part));
      if (parts.size !== 1 || r.pts.length !== 2 * r.cells.length || r.cells.length < 2) fail('mesh', `${label}: a run of edge ${r.edge} rides on ${parts.size} pieces`);
    }
    const runPts = M.boundaryRuns.reduce((s, r) => s + r.cells.length, 0), allPts = M.boundary.reduce((s, b) => s + b.cells.length, 0);
    if (runPts < allPts) fail('mesh', `${label}: the runs hold ${runPts} of the outline's ${allPts} samples`);
    const tmp = [0, 0];
    for (const cu of M.cuts) {
      if (cu.pts.length !== 2 * cu.cells.length) fail('mesh', `${label}: a cut's cells`);
      for (let k = 0; k < cu.cells.length; k++) {
        domain.warp.inv(cu.pts[2 * k], cu.pts[2 * k + 1], tmp);
        if (!domain.contains(tmp[0], tmp[1], 1e-5 * size)) { fail('mesh', `${label}: a cut leaves the tile`); break; }
        if (tags[cu.cells[k]].part !== cu.part) { fail('mesh', `${label}: a cut's piece`); break; }
      }
    }
    if ((R.movers > 0) !== (M.cuts.length > 0)) fail('mesh', `${label}: ${R.movers} movers and ${M.cuts.length} cuts`);
    // the cuts once each (cutsFlat): every cut runs through the tile with a piece on either side, so `cuts` holds it
    // twice; no two lines of cutsFlat lie on each other, and every sample of `cuts` lies on one of them
    {
      const lenOf = (p) => { let L = 0; for (let k = 2; k < p.length; k += 2) L += Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]); return L; };
      const onSeg = (c, x, y, tolD) => { const n2 = c.pts.length; const ax = c.pts[0], ay = c.pts[1], bx = c.pts[n2 - 2], by = c.pts[n2 - 1], l = Math.hypot(bx - ax, by - ay), u = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (l * l); return u > -1e-3 && u < 1 + 1e-3 && Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) / l < tolD; };
      const two = M.cuts.reduce((s, c) => s + lenOf(c.pts), 0), one = M.cutsFlat.reduce((s, c) => s + lenOf(c.pts), 0);
      if ((M.cuts.length > 0) !== (M.cutsFlat.length > 0)) fail('mesh', `${label}: ${M.cuts.length} cuts, ${M.cutsFlat.length} flat`);
      if (one > 0 && Math.abs(two / one - 2) > 0.08) fail('mesh', `${label}: the cuts are ${two.toFixed(4)} long, drawn once ${one.toFixed(4)} (twice that is expected)`);
      // (two cuts may CROSS, where four copies of the home meet: only a line ALONG another one is one cut drawn twice)
      const dirOf = (c) => { const n2 = c.pts.length, dx = c.pts[n2 - 2] - c.pts[0], dy = c.pts[n2 - 1] - c.pts[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
      for (const c of M.cutsFlat) {
        const n2 = c.pts.length, d = dirOf(c);
        if (!onSeg(c, (c.pts[0] + c.pts[n2 - 2]) / 2, (c.pts[1] + c.pts[n2 - 1]) / 2, 1e-4 * size)) fail('mesh', `${label}: a flat cut line is not straight`);
        for (const o of M.cutsFlat) {
          if (o === c) continue;
          const e = dirOf(o);
          if (Math.abs(d[0] * e[1] - d[1] * e[0]) > 1e-3) continue;
          for (const u of [0.25, 0.5, 0.75]) if (onSeg(o, c.pts[0] + u * (c.pts[n2 - 2] - c.pts[0]), c.pts[1] + u * (c.pts[n2 - 1] - c.pts[1]), 1e-4 * size)) { fail('mesh', `${label}: two flat cut lines lie on each other`); break; }
        }
      }
      for (const c of M.cuts) for (let k = 0; k < c.cells.length; k += 3) if (!M.cutsFlat.some((o) => onSeg(o, c.pts[2 * k], c.pts[2 * k + 1], 1e-4 * size))) { fail('mesh', `${label}: a cut is missing from the flat cuts`); break; }
    }
    // the creases: a re-cut tile has none before the home tile folds; the home tile itself has its own from the flat tile on
    if (R.movers ? (fold.creaseAlpha(0) !== 0 || fold.creaseAlpha(R.tau0) !== 0) : fold.creaseAlpha(0) !== 1) fail('api', `${label}: creaseAlpha at the start: ${fold.creaseAlpha(0)}`);
    if (fold.creaseAlpha(1) > 1e-9) fail('api', `${label}: creaseAlpha at the end`);
    const c0 = fold.cutStyle(0), c1 = fold.cutStyle(1);
    if (!c0.dashed || !(c0.alpha > 0.5) || !(c1.alpha > 0.1 && c1.alpha < c0.alpha)) fail('api', `${label}: cutStyle`);
    const s0 = fold.stage(0), s1 = fold.stage(1), sm = fold.stage(R.tau0 + 0.5 * (1 - R.tau0));
    if (s0.stage !== 'flat' || s1.stage !== 'closed' || sm.stage !== 'fold') fail('api', `${label}: stage`);
    if (R.movers) { const sr = fold.stage(0.5 * R.tau0); if (sr.stage !== 'recut' || !(sr.piece >= 1 && sr.piece <= R.movers) || sr.of !== R.movers || !sr.text) fail('api', `${label}: stage in the re-cut`); }
    const L = fold.doubleLine(0.5 * R.tau0);
    if (R.movers && L.length) fail('api', `${label}: a double line before the fold begins`);
    if (!fold.doubleLine(1).length) fail('api', `${label}: no double line at t = 1`);
  }
  return fold;
}

const crossed = [];
for (const id of IDS) {
  const group = BY_ID[id], size = Math.sqrt(group.domainArea);
  let k = 0;
  for (const c of cases(group)) {
    for (const amp of [0, 1]) {
      const fold = check(group, c, amp);
      // no paper passes through paper: every preset, and every other random cut (the detector is the slow part)
      if (fold && (c.preset >= 0 || k % 2 === 0)) {
        const X = crossing(fold, size, id === 'xx' ? 50 : 80);
        stats.maxCross = Math.max(stats.maxCross, X.max);
        crossed.push(`${c.label} amp ${amp}: ${X.max.toFixed(4)}`);
        if (!(X.max < NONE)) fail('cross', `${c.label} amp ${amp}: the sheet passes through itself along ${X.max.toFixed(3)} tile widths at t = ${X.at.toFixed(3)}`);
      }
    }
    k++;
  }
}

test('re-cut: the mesh is the tile cut into pieces that share no vertex; every tag names a piece and an element of the group', () => assert.equal(failures.mesh.length, 0, show('mesh')));
test('re-cut 1: at(0) is the identity, exactly', () => assert.equal(failures.identity.length, 0, show('identity')));
test('re-cut 2: the tile\'s own seams close at t = 1 within 1e-6 tile sizes (stored tags and locate)', () => assert.equal(failures.seams.length, 0, show('seams')));
test('re-cut: when the fold begins every piece lies where its element carries it, and the pieces fill the home tile once; they move one after another, never below the paper', () => assert.equal(failures.pieces.length, 0, show('pieces')));
test('re-cut 3: continuity — no jump at any stop or at the start or end of any piece\'s move; a piece crosses a tile in about a second', () => assert.equal(failures.continuity.length, 0, show('continuity')));
test('re-cut 4: nothing non-finite, also a hair either side of every stop and every move', () => assert.equal(failures.finite.length, 0, show('finite')));
test('re-cut: the fold interface — stops, duration, the timing adds up, stage / cutStyle / creaseAlpha / doubleLine', () => assert.equal(failures.api.length, 0, show('api')));
test('re-cut: NO PAPER PASSES THROUGH PAPER — the whole motion, every preset and random cuts, straight and wavy', (t) => {
  assert.equal(failures.cross.length, 0, show('cross'));
  assert.ok(crossed.length >= 2 * 2 * (2 + Math.ceil(SEEDS / 2)), `${crossed.length} motions measured`);
  t.diagnostic(`${crossed.length} motions measured; the most that crosses anywhere: ${stats.maxCross.toFixed(4)} tile widths (none: below ${NONE})`);
});

test('re-cut: control — the detector finds the crossing in the fold modules\' own one-sheet motion of the same cuts', () => {
  // (what the re-cut is for: dev/recut/probe-direct.mjs prints these for every cut)
  for (const [id, preset] of [['22x', 1], ['22x', 2], ['xx', 1]]) {
    const g = BY_ID[id], p = g.presets[preset], size = Math.sqrt(g.domainArea);
    const { fold } = build(g, { seed: p.seed, metric: p.metric, anchor: p.anchor || p.seed }, 0, { recut: false });
    assert.equal(!!fold.recut, false);
    const X = crossing(fold, size, 60);
    assert.ok(X.max > 0.2, `${id} ${p.name}, folded as one sheet: the sheet passes through itself along ${X.max.toFixed(3)} tile widths (the detector must see it)`);
  }
  // and the two home tiles, folded as they are, cross nowhere: nothing to re-cut
  for (const id of IDS) {
    const g = BY_ID[id], p = g.presets[0], size = Math.sqrt(g.domainArea);
    const { fold } = build(g, { seed: p.seed, metric: p.metric, anchor: p.anchor || p.seed }, 0);
    assert.equal(fold.recut.movers, 0, `${id} ${p.name}: no piece moves`);
    assert.equal(fold.recut.tau0, 0);
    assert.equal(foldCaption(fold, 0.3), '', 'nothing to say');
    assert.ok(crossing(fold, size, 60).max < NONE, `${id} ${p.name}: the home tile folds with nothing passing through`);
  }
});

test('re-cut: the sweep really ran', (t) => {
  assert.ok(stats.folds >= 2 * 2 * (2 + SEEDS), `${stats.folds} folds`);
  assert.ok(stats.movers > 3 * stats.folds / 2, `${stats.movers} moving pieces`);
  assert.ok(stats.types.rotation > 0 && stats.types.glide > 0 && stats.types.translation > 0 && stats.types.identity > 0, JSON.stringify(stats.types));
  assert.ok(stats.seamPairs > 5000, `${stats.seamPairs} seam pairs`);
  t.diagnostic(`${stats.folds} folds, ${stats.movers} moving pieces (at most ${stats.maxPieces} pieces in a tile): ${JSON.stringify(stats.types)}`);
  t.diagnostic(`largest step per 1/200: ${stats.maxStep.toFixed(3)} tile sizes; worst seam ${stats.maxSeam.toExponential(1)} tile sizes`);
});

test('re-cut: the anchor (SPEC 7) — the closed shape is the same for every cut that shares the anchor, and a preset\'s home is the home tile itself', () => {
  for (const id of IDS) {
    const g = BY_ID[id], size = Math.sqrt(g.domainArea), rnd = prng(404 + id.length);
    for (const p of g.presets) {
      const anchor = (p.anchor || p.seed).slice();
      // fixed points of the plane, and where the closed shape puts them
      const pts = [];
      for (let i = 0; i < 12; i++) pts.push([g.center[0] + (2 * rnd() - 1) * 0.5, g.center[1] + (2 * rnd() - 1) * 0.5]);
      let ref = null;
      for (let k = 0; k < 6; k++) {
        const seed = k === 0 ? p.seed : [p.seed[0] + (2 * rnd() - 1) * 0.3, p.seed[1] + (2 * rnd() - 1) * 0.3];
        const { domain, fold } = build(g, { seed, metric: p.metric, anchor }, k % 2);
        assert.ok(Math.hypot(fold.recut.home.element.tx, fold.recut.home.element.ty) < 1e-12, `${id} ${p.name}: the home tile itself`);
        const F = fold.at(1), o = [0, 0, 0], q = [0, 0], here = [];
        for (const pt of pts) {
          // the copy of the point in this tile
          let found = false;
          for (const e of [{ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }, ...nearby(g, pt)]) {
            apply(e, pt[0], pt[1], q);
            const s = [0, 0];
            domain.warp.inv(q[0], q[1], s);
            if (!domain.contains(s[0], s[1], -1e-6 * size)) continue;
            F(q[0], q[1], fold.mesh.locate(q[0], q[1]), o);
            here.push(o.slice()); found = true;
            break;
          }
          if (!found) here.push(null);
        }
        if (!ref) ref = here;
        else here.forEach((h, i) => { if (h && ref[i]) assert.ok(Math.hypot(h[0] - ref[i][0], h[1] - ref[i][1], h[2] - ref[i][2]) < 1e-6 * size, `${id} ${p.name}: a plane point lands elsewhere for another cut`); });
      }
    }
  }
});
function nearby(g, pt) {
  const out = [];
  const L = Math.hypot(g.e1[0], g.e1[1]) + Math.hypot(g.e2[0], g.e2[1]);
  for (const r of g.reps) for (let m = -3; m <= 3; m++) for (let n = -3; n <= 3; n++) {
    const e = { a: r.a, b: r.b, c: r.c, d: r.d, tx: r.tx + m * g.e1[0] + n * g.e2[0], ty: r.ty + m * g.e1[1] + n * g.e2[1] };
    if (Math.hypot(e.a * pt[0] + e.b * pt[1] + e.tx - g.center[0], e.c * pt[0] + e.d * pt[1] + e.ty - g.center[1]) < 2 * L) out.push(e);
  }
  return out;
}

test('re-cut: the pieces and their timing do not depend on the mesh — the draft of a drag and the full mesh move alike', () => {
  for (const id of IDS) {
    const g = BY_ID[id], rnd = prng(9 + id.length), size = Math.sqrt(g.domainArea);
    for (let k = 0; k < 4; k++) {
      const c = { seed: [g.center[0] + (2 * rnd() - 1) * 0.6 * g.viewHalf, g.center[1] + (2 * rnd() - 1) * 0.6 * g.viewHalf], anchor: g.presets[0].seed };
      for (const amp of [0, 1]) {
        const D = build(g, c, amp, { draft: true }).fold, F = build(g, c, amp).fold;
        assert.equal(D.recut.pieces.length, F.recut.pieces.length, `${id} ${k} amp ${amp}: the same pieces`);
        D.recut.pieces.forEach((p, i) => {
          const q = F.recut.pieces[i];
          assert.equal(p.type, q.type);
          assert.ok(Math.abs(p.area - q.area) < 1e-12 && Math.abs(p.from - q.from) < 1e-12 && Math.abs(p.to - q.to) < 1e-12, `${id} ${k} amp ${amp}: piece ${i}: area ${p.area} / ${q.area}, window [${p.from}, ${p.to}] / [${q.from}, ${q.to}]`);
        });
        assert.equal(D.duration, F.duration);
        // a point of the outline is in the same place at the same time
        const b = F.mesh.boundary[0], o1 = [0, 0, 0], o2 = [0, 0, 0];
        for (const t of [0.5 * F.recut.tau0, 0.6, 1]) {
          const F1 = D.at(t), F2 = F.at(t);
          for (let j = 0; j < b.cells.length; j += 5) {
            F1(b.pts[2 * j], b.pts[2 * j + 1], D.mesh.locate(b.pts[2 * j], b.pts[2 * j + 1]), o1); F2(b.pts[2 * j], b.pts[2 * j + 1], F.mesh.locate(b.pts[2 * j], b.pts[2 * j + 1]), o2);
            assert.ok(Math.hypot(o1[0] - o2[0], o1[1] - o2[1], o1[2] - o2[2]) < 1e-9 * size, `${id} ${k} amp ${amp} t = ${t}`);
          }
        }
      }
    }
  }
});

test('re-cut: every line of the outline rides on its own piece, and every piece has its line — the cuts the review of 13 Nov named, and random ones, draft and full', () => {
  const one = (id, seed, amp, anchor, draft) => {
    const g = BY_ID[id];
    const F = build(g, { seed, metric: undefined, anchor }, amp, { draft }).fold;
    return { g, F, O: runsOffPiece(g, F) };
  };
  // xx, wavy, the Hexagon's anchor: a third piece's sliver (0.02 % of the tile) lay between two samples of the outline,
  // and the next piece's run had started with a stub on it, 0.019 tile sizes off its piece
  for (const draft of [true, false]) {
    const { g, F, O } = one('xx', [0.03759, -0.15272], 0.65, BY_ID.xx.presets[1].seed, draft);
    assert.equal(F.recut.pieces.length, 5, 'five pieces, one of them a sliver');
    const sliver = F.recut.pieces.find((p) => p.area < 1e-3 * g.domainArea);
    assert.ok(sliver && sliver.area > DROP_SHARE * g.domainArea, 'the sliver is a piece');
    assert.ok(F.mesh.boundaryRuns.some((r) => r.part === sliver.part), `draft ${draft}: the sliver has a run of its own`);
    assert.equal(O.worst, 0, `draft ${draft}: no stub on the wrong piece`);
    assert.equal(O.specks, 0);
  }
  // 22x, straight: a corner of the tile, 0.004 % of it, lies across a cut: left out (below DROP_SHARE), and the three
  // samples on its rim are the only ones that land outside the home tile
  {
    const { O } = one('22x', [0.98201, 1.90749], 0, BY_ID['22x'].presets[0].seed, false);
    assert.equal(O.worst, 0);
    assert.ok(O.specks >= 1 && O.specks <= 6 && O.left > 1e-5 && O.left < DROP_SHARE && O.speck < 0.006, `the speck: ${O.specks} samples, ${O.left.toExponential(2)} of the tile, ${O.speck.toExponential(2)} deep`);
  }
  // random cuts: no stub anywhere; every piece (two or more: each reaches the outline) has a run
  let folds = 0, slivers = 0, deepest = 0;
  for (const id of ['xx', '22x']) {
    const g = BY_ID[id], rnd = prng(4242 + id.length);
    for (let k = 0; k < 90; k++) {
      const seed = [g.center[0] + (2 * rnd() - 1) * 0.8 * g.viewHalf, g.center[1] + (2 * rnd() - 1) * 0.8 * g.viewHalf];
      const amp = [0, 0.65, 1][k % 3], pi = k % (g.presets.length + 1), anchor = pi < g.presets.length ? g.presets[pi].seed : undefined;
      for (const draft of [true, false]) {
        const { F, O } = one(id, seed, amp, anchor, draft), label = `${id} (${seed[0].toFixed(5)}, ${seed[1].toFixed(5)}) amp ${amp} anchor ${anchor ? pi : 'none'}${draft ? ' draft' : ''}`;
        folds++;
        assert.equal(O.worst, 0, `${label}: a sample of a run lands outside the home tile, not on a speck`);
        assert.ok(O.speck < 0.01 && O.left < 8 * DROP_SHARE, `${label}: left out ${O.left.toExponential(2)}, a speck ${O.speck.toExponential(2)} deep`);
        deepest = Math.max(deepest, O.speck);
        const R = F.recut;
        if (R.pieces.length > 1) for (const p of R.pieces) {
          if (p.area < 1e-3 * g.domainArea) slivers++;
          assert.ok(F.mesh.boundaryRuns.some((r) => r.part === p.part), `${label}: piece ${p.part} (${(100 * p.area / g.domainArea).toFixed(4)} % of the tile) has no line of the outline`);
        }
        // the runs are the outline: the same length, sample for sample (the cut points come twice)
        const len = (L) => L.reduce((s, r) => { for (let i = 2; i < r.pts.length; i += 2) s += Math.hypot(r.pts[i] - r.pts[i - 2], r.pts[i + 1] - r.pts[i - 1]); return s; }, 0);
        assert.ok(Math.abs(len(F.mesh.boundaryRuns) - len(F.mesh.boundary)) < 1e-5 * Math.sqrt(g.domainArea), `${label}: the runs are as long as the outline`);
      }
    }
  }
  assert.equal(folds, 360);
  assert.ok(slivers >= 8, `the sweep met slivers (${slivers})`);
  assert.ok(deepest < 0.01);
});

test('app: a scene re-cuts first by default; its lines, the plane\'s overlay and the words over the fold pane', () => {
  for (const id of IDS) {
    const g = BY_ID[id], size = Math.sqrt(g.domainArea);
    for (const [i, p] of g.presets.entries()) {
      const anchor = (p.anchor || p.seed).slice();
      const scene = buildScene(g, { seed: p.seed, metric: p.metric, anchor, pattern: 'checker' });
      const { fold } = build(g, { seed: p.seed, metric: p.metric, anchor }, 0);
      assert.ok(scene.fold.recut, `${id} ${p.name}: the scene's fold re-cuts`);
      assert.equal(scene.fold.recut.movers, fold.recut.movers);
      assert.equal(scene.print && scene.print.key, 'checker');
      assert.equal(scene.motif.length, 0, 'a print: no comma');
      assert.equal(scene.M.tint, undefined, 'no comma cut into the mesh');
      // the same motion as createFold({ recut: true }): the same mesh, the same tags, the same places at every time
      assert.equal(scene.M.n, fold.mesh.n, `${id} ${p.name}: the same mesh`);
      assert.deepEqual(scene.M.cell, fold.mesh.cell);
      const o1 = [0, 0, 0], o2 = [0, 0, 0];
      for (const t of [0.5 * fold.recut.tau0, fold.recut.tau0, 0.7, 1]) {
        const F1 = scene.fold.at(t), F2 = fold.at(t);
        for (let v = 0; v < scene.M.n; v += Math.max(1, Math.floor(scene.M.n / 50))) {
          F1(scene.M.xy[2 * v], scene.M.xy[2 * v + 1], scene.M.cell[v], o1); F2(scene.M.xy[2 * v], scene.M.xy[2 * v + 1], fold.mesh.cell[v], o2);
          assert.ok(Math.hypot(o1[0] - o2[0], o1[1] - o2[1], o1[2] - o2[2]) < 1e-12 * size, `${id} ${p.name} t = ${t}`);
        }
      }
      // closed, a point of the tile is in one place whichever piece is asked for it (locate: the piece it lies deepest in)
      {
        const F = scene.fold.at(1);
        for (let v = 0; v < scene.M.n; v += Math.max(1, Math.floor(scene.M.n / 80))) {
          F(scene.M.xy[2 * v], scene.M.xy[2 * v + 1], scene.M.cell[v], o1); F(scene.M.xy[2 * v], scene.M.xy[2 * v + 1], scene.M.locate(scene.M.xy[2 * v], scene.M.xy[2 * v + 1]), o2);
          assert.ok(Math.hypot(o1[0] - o2[0], o1[1] - o2[1], o1[2] - o2[2]) < 1e-6 * size, `${id} ${p.name}: closed, a vertex's own tag and locate agree`);
        }
      }
      const moving = fold.recut.movers > 0;
      assert.equal(!!planeRecut(scene), moving, `${id} ${p.name}: the plane's overlay only when a piece moves`);
      assert.equal(i === 0, !moving, `${id} ${p.name}: the default cut is the home tile`);
      if (!moving) {
        assert.equal(scene.cuts.length, 0); assert.equal(scene.cutsFlat.length, 0); assert.equal(foldCaption(scene.fold, 0), '');
        // the home tile shows its creases as the fold module's own fold does: there on the flat tile (the review of 13 Nov:
        // the default cut of 22x had lost its dashed crease at t = 0)
        const direct = buildScene(g, { seed: p.seed, metric: p.metric, anchor, pattern: 'checker', recut: false });
        for (const t of [0, 0.005, 0.02, 0.2, 0.4, 0.6, 1]) {
          mapScene(scene, t); mapScene(direct, t);
          const cr = (sc) => sceneLines(sc, 1).filter((l) => l.dashed && l.width === WIDTHS.crease).map((l) => l.alpha.toFixed(6)).join();
          assert.equal(cr(scene), cr(direct), `${id} ${p.name} t = ${t}: the creases of the home tile, as the fold module's own`);
        }
        if (id === '22x') { mapScene(scene, 0); assert.ok(sceneLines(scene, 1).some((l) => l.dashed && l.width === WIDTHS.crease && l.alpha === 1), 'the Pocket shows its crease on the flat tile'); }
        continue;
      }
      const PR = planeRecut(scene);
      assert.equal(PR.name, g.presets[0].name);
      assert.ok(PR.home.length >= 4 && PR.cuts.length === scene.cutsFlat.length && PR.cuts.length > 0 && scene.cuts.length > scene.cutsFlat.length, 'the plane is told each cut once');
      // the cut lines: dashed on the flat tile, in the plane; there while the pieces move; fainter when all is closed
      const cutsAt = (t) => { mapScene(scene, t); return sceneLines(scene, 1).filter((l) => Math.abs(l.width / Math.max(1, 0.85) - WIDTHS.cut * scene.fold.cutStyle(t).width) < 1e-9 && l.points.length >= 6 && l.color.join() !== '0,0,0'); };
      mapScene(scene, 0);
      const flat = sceneLines(scene, 1).filter((l) => l.dashed && Math.abs(l.width - WIDTHS.cut) < 1e-9);
      assert.equal(flat.length, scene.cutsFlat.length, `${id} ${p.name}: the cuts are drawn dashed on the flat tile, each once`);
      for (const l of flat) for (let k = 2; k < l.points.length; k += 3) assert.equal(l.points[k], 0);
      assert.ok(cutsAt(0.5 * fold.recut.tau0).length >= scene.cuts.length);
      // the piece that is being carried, for the plane: its outline on the tile (its share of the tile's area), and where
      // it lands: inside the home tile, the same shape
      assert.equal(PR.active, null, 'no time given: no active piece');
      assert.equal(planeRecut(scene, 0).active, null, 'flat: nothing moves yet');
      assert.equal(planeRecut(scene, 0.9).active, null, 'while the home tile folds: nothing is carried');
      const area2 = (poly) => { let s = 0; for (let k = 0; k < poly.length; k++) { const a = poly[k], b = poly[(k + 1) % poly.length]; s += a[0] * b[1] - a[1] * b[0]; } return Math.abs(s) / 2; };
      const inHome = (x, y) => { let sg = 0; for (let k = 0; k < PR.home.length; k++) { const a = PR.home[k], b = PR.home[(k + 1) % PR.home.length], cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (Math.abs(cr) < 1e-9) continue; if (sg && Math.sign(cr) !== sg) return false; sg = Math.sign(cr); } return true; };
      for (const q of fold.recut.pieces.filter((x) => x.moves)) {
        const A = recutActive(scene, 0.5 * (q.from + q.to));
        assert.ok(A && A.part === q.part, `${id} ${p.name}: the piece that moves at the middle of its window`);
        assert.ok(Math.abs(area2(A.from) - q.area) < 1e-9 && Math.abs(area2(A.to) - q.area) < 1e-9, `${id} ${p.name}: the outline has the piece's area`);
        for (const pt of A.to) assert.ok(inHome(pt[0], pt[1]), `${id} ${p.name}: the piece lands inside the home tile`);
        assert.deepEqual(planeRecut(scene, 0.5 * (q.from + q.to)).active, A);
      }
      // the words
      assert.match(foldCaption(scene.fold, 0), new RegExp(`re-cuts the tile into the ${PR.name}`));
      assert.match(foldCaption(scene.fold, 0.5 * fold.recut.tau0), /^re-cut, piece \d of \d: /);
      assert.match(foldCaption(scene.fold, 0.5 * fold.recut.tau0, true), /^re-cut \d\/\d: /);
      assert.match(foldCaption(scene.fold, 0.8), /no paper passes through paper/);
      assert.equal(foldCaption(scene.fold, 1), '');
      // the short words (a phone): one line of the 3D pane of a 320 px window at every moment — 40 characters at most
      // (39 measured 266 px of its 284; the 43 of "the Rectangle folds: nothing passes through" took two lines)
      for (let i = 0; i <= 200; i++) {
        const w = foldCaption(scene.fold, i / 200, true);
        assert.ok(w.length <= 40 && !/ about /.test(w), `${id} ${p.name} t = ${i / 200}: the short words "${w}" (${w.length} characters)`);
        assert.equal(w === '', foldCaption(scene.fold, i / 200) === '', 'short and long words show at the same moments');
      }
      assert.match(foldCaption(scene.fold, 0.8, true), new RegExp(`^${PR.name} folds: nothing passes through$`));
      assert.match(foldCaption(scene.fold, 0, true), new RegExp(`^re-cut into the ${PR.name} first$`));
      // the comma, too, rides on the pieces: its outline is cut where the piece changes
      const comma = buildScene(g, { seed: p.seed, metric: p.metric, anchor, pattern: 'comma' });
      assert.ok(comma.M.motifTint && comma.M.motifCut.bad === 0, `${id} ${p.name}: the comma is cut into the re-cut mesh`);
      for (const m of comma.motif) assert.equal(new Set([...m.cells].map((tg) => comma.M.cells[tg].part)).size, 1, `${id} ${p.name}: a piece of the comma's outline rides on one piece`);
    }
  }
  // no re-cut where none is asked for
  const g = BY_ID['22x'], p = g.presets[2];
  const plain = buildScene(g, { seed: p.seed, anchor: p.seed.slice(), recut: false });
  assert.equal(!!plain.fold.recut, false);
  assert.equal(planeRecut(plain), null);
  assert.equal(plain.cuts.length, 0);
  assert.equal(det(g.reps[2]) < 0, true);
});

void createRecut;
