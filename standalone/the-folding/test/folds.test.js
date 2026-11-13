// test/folds.test.js — the generic fold tests of SPEC 5.3, for all 17 groups, through the one door the app uses
// (src/folds/index.js), plus the pure half of src/app.js (what the 3D pane is given to draw). OWNER: integrator.
//
// Sweep: every group x every preset + 10 seeded-random seeds x amp in {0, 1}. Every fold is built once; each check
// records its failures under a name, and the tests at the bottom assert that each list is empty.
//   FOLDS_SEEDS=60 node --test test/folds.test.js      widens the sweep (2118 folds, about a minute)
//   FOLDS_WALK=600 node --test test/folds.test.js      lengthens the drag walk of the last-but-two test (10 200 scenes)
//
// What "continuity" means here (SPEC 5.3, requirement 3). The fold modules have their own, sharper tests of their
// own motions; this file asks the same three things of all of them, on about 250 points per fold (a spread of mesh
// vertices and of boundary samples, the far corners among them):
//   small     over 200 equal steps of t no point moves more than MAX_STEP tile sizes in a step;
//   no jump   a jump is a displacement that does not shrink when time is cut finer. The six largest steps, the first,
//             the last, and the steps at every stop are each cut into 32: none of the parts may move a point by more
//             than a sixteenth of the LARGEST whole step of the motion (a motion of bounded speed moves at most a
//             thirty-second of it; a jump hidden in the step stays as large as it is);
//   even      the second difference p(t+h) - 2 p(t) + p(t-h), h = 1/200, stays below MAX_BEND tile sizes: for a
//             smooth motion it is acceleration x h^2, a jump of size J anywhere shows up as J.
// "Of the same order throughout" is NOT tested as largest / smallest step: the hinge folds puff for the last fifth of
// the time (ten times slower than the flaps turn), the cross-cap's zip slows to a crawl at its end (round 3: it no
// longer pauses at its middle stop) and the snowflake rests at every stop, all on purpose (notes/hinge.md,
// notes/crosscap-round3.md, notes/snowflake.md).

import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID, symmetryElements } from '../src/groups.js';
import { apply, inverse } from '../src/geom.js';
import { makeWarp, buildDomain } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import createFoldDefault, { createFold, buildFold, foldMeshOptions, foldOptions, FOLD_TYPES } from '../src/folds/index.js';
import { FOLD_END, PUFF_START } from '../src/folds/hinge.js';
import { HINGE_END, PUFF_START as CC_PUFF_START, HALF_END, ZIP_START, HALF_STOP } from '../src/folds/crosscap.js';
import { STAGE, rollDensity } from '../src/folds/roll.js';
import { buildScene, mapScene, sceneLines, sceneMarkers, seamGap, resolveGroupId, creaseAlpha, creaseFade, ghostColor, lineScale, DEFAULT_GROUP, WIDTHS, MOTIF_ALPHA, motifFade,
  zoomBetween, ZOOM_HOME_SECONDS, hintState, HINT_TEXT, surfaceStyle, surfaceMix } from '../src/app.js';
import { SURFACE_FRONT, SURFACE_BACK, SURFACE_GHOST, MOTIF_FILL_3D, MIRROR_COLOR, classColor, hexToRgb } from '../src/palette.js';

const SEEDS = Math.max(10, +process.env.FOLDS_SEEDS || 10);
const AMPS = [0, 1];
const STEPS = 200;
const PARTS = 32;      // the watched steps are cut into this many parts for the jump test

// The bounds, in tile sizes (sqrt(domainArea)), per fold type. They were set in v1 as the largest value seen over a
// sweep with 60 random seeds per group (FOLDS_SEEDS=60; the "sweep really ran" test prints the values of the current
// run) with about half as much again, so a seed nobody has tried has room and a jump has none. Today's maxima (the final
// fix of 10 Nov 2026, FOLDS_SEEDS=60, the same at 40 and 120 seeds: they come from fixed cases, the presets):
//                 largest step in 1/200     largest second difference
//   hinge              0.032                     0.00092      a far corner of a flap: half a turn in 0.8 of the time
//   cross-cap          0.047                     0.0057       its flap takes 0.36 of the time; round 3's timing
//   torus              0.037                     0.0023       (the long tile of the cut "Slanted")
//   cylinder           0.0077                    0.000095
//   klein              0.018                     0.0011       round 4's design (the 8 lies down, the ring spins)
//   mobius             0.012                     0.00019
//   snowflake          0.16                      0.013        the patch is the star of 2n tiles, and its far corner
//                                                             swings through half a turn in a quarter of the time
// The cross-cap's and the Klein bottle's second differences now sit 5 % and 8 % under their bounds (v1's maxima were
// 0.0038 and 0.00070): rounds 3 and 4 redesigned those motions and the bounds were kept, not raised. Their maxima do not
// grow with more seeds, so the margin is a fixed case's, not luck's; a change to either motion has no room left here.
const MAX_STEP = { hinge: 0.05, crosscap: 0.08, torus: 0.065, cylinder: 0.015, mobius: 0.02, klein: 0.025, snowflake: 0.24 };
const MAX_BEND = { hinge: 0.0016, crosscap: 0.006, torus: 0.0045, cylinder: 0.0003, mobius: 0.0005, klein: 0.0012, snowflake: 0.02 };
// "Toward +z": how high the motion must rise above the plane of the tile, as a multiple of how far it dips below it.
// The hinge folds puff their fixed sheet downward (the -z side is the outside of the pillow) and rise 1.8 times as
// far or more; the rolls and the snowflake hardly go below the plane at all. The cross-cap is the exception that
// is allowed: with any cut but its default one, stage 2 turns the near half of the pillow over, through both sides
// (notes/crosscap.md); 0.70 is the smallest ratio seen.
const RISE = { hinge: 1, crosscap: 0.5, torus: 1, cylinder: 1, mobius: 1, klein: 1, snowflake: 1 };
// Which side each fold goes to: +1 toward +z, the viewer (SPEC 5.3), for every fold but the cross-cap, which goes
// toward -z BY DESIGN since the final fix of 10 Nov 2026 (src/folds/crosscap.js FLAPS = 'under', SPEC 5.3's exception;
// notes/integrator-final.md § 7): its flaps tuck under the sheet that holds still, so that the comma that sheet carries
// ends on top. The check below is the same for both: the motion must reach 0.03 tile sizes to its side, and that side
// must be at least RISE times the other (for the cross-cap exactly round 3's check, mirrored with the motion).
const TOWARD = { hinge: 1, crosscap: -1, torus: 1, cylinder: 1, mobius: 1, klein: 1, snowflake: 1 };

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
  for (const [i, p] of group.presets.entries()) yield { label: `${group.id} preset ${i} (${p.name})`, seed: p.seed, metric: p.metric, preset: i };
  const rnd = prng(4242 + 97 * GROUPS.indexOf(group));
  for (let k = 0; k < SEEDS; k++) {
    const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
    yield { label: `${group.id} random seed ${k} (${seed[0].toFixed(4)}, ${seed[1].toFixed(4)})`, seed, metric: undefined, preset: -1 };
  }
}

const NAMES = ['api', 'mesh', 'identity', 'seams', 'small', 'jump', 'even', 'finite', 'pure', 'upward', 'near', 'locate',
  'scene', 'sceneSeams', 'colours', 'markers', 'flatScene', 'fill'];
const failures = Object.fromEntries(NAMES.map((k) => [k, []]));
let sink = failures;                       // the control test at the bottom points this at a list of its own
const fail = (name, msg) => { sink[name].push(msg); };
const show = (name) => failures[name].slice(0, 6).join('\n') + (failures[name].length > 6 ? `\n... ${failures[name].length} failures` : '');
const stats = {
  folds: 0, byType: {}, seamPairs: 0, maxSeam: 0, maxSeamLocate: 0, vertices: 0, maxTriangles: 0, scenes: 0, markerChecks: 0, fillScenes: 0, maxFilled: 0,
  step: {}, bend: {}, part: {}, rise: {}, ms: 0,
};
const bump = (obj, key, v) => { if (!(obj[key] >= v)) obj[key] = v; };

/** The times at which a module changes its formula (its stops, its inner stage boundaries), for the finite test. */
function specialTimes(group, fold) {
  const ts = new Set([0, 1]);
  for (const s of fold.stops) ts.add(s.t);
  if (group.fold === 'hinge') { ts.add(FOLD_END); ts.add(PUFF_START); }
  if (group.fold === 'crosscap') {
    for (const t of [HINGE_END, CC_PUFF_START, HALF_END, ZIP_START, HALF_STOP]) ts.add(t);
    // round 3: each cross-cap fold has its own inner times (fold.times; a cut without a crease, the Bowl, differs)
    const T = fold.times || {};
    for (const k of ['hingeEnd', 'puffStart', 'halfEnd', 'zipStart', 'halfStop']) if (Number.isFinite(T[k])) ts.add(T[k]);
  }
  if (STAGE[group.fold]) { ts.add(STAGE[group.fold].t1); ts.add(STAGE[group.fold].t2); }
  if (Array.isArray(fold.folds)) for (const f of fold.folds) { ts.add(f.t0); ts.add(f.t1); }
  const out = new Set();
  for (const t of ts) for (const d of [0, 1e-12, -1e-12, 1e-9, -1e-9, 1e-6, -1e-6, 1e-3, -1e-3]) { const u = t + d; if (u >= 0 && u <= 1) out.add(u); }
  return [...out].sort((a, b) => a - b);
}

/** What the orbifold's name says its special points are: '2*22' -> ['2', '∗2', '∗2']; 'xx' -> []. */
function specialPoints(id) {
  const out = [];
  let mirror = false;
  for (const ch of id) {
    if (ch === '*') mirror = true;
    else if (/[2-9]/.test(ch)) out.push((mirror ? '∗' : '') + ch);
  }
  return out.sort();
}

function checkFold(group, c, amp, viaIndex, tamper = null) {
  const label = `${c.label} amp ${amp}`;
  const size = Math.sqrt(group.domainArea);
  const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp: makeWarp(group, amp) });
  // two ways in: the mesh handed over (as src/app.js does), or built by the index
  let mesh = null, fold;
  if (viaIndex) fold = buildFold(group, domain, {});
  else {
    mesh = group.fold === 'snowflake' ? null : buildMesh(group, domain, foldMeshOptions(group));
    fold = createFold(group, domain, mesh, {});
  }
  if (tamper) fold = tamper(fold, size);       // (the control test: a fold with a planted fault)
  stats.folds++; stats.byType[group.fold] = (stats.byType[group.fold] || 0) + 1;
  const M = fold.mesh;

  // ---- the interface (SPEC 5.3) and what the renderer needs of the mesh
  if (!M || !(M.xy instanceof Float32Array) || !(M.tri instanceof Uint32Array) || !M.cell || !Array.isArray(M.boundary) || typeof M.locate !== 'function') {
    fail('api', `${label}: fold.mesh lacks xy / tri / cell / boundary / locate`);
    return;
  }
  const n = M.n, xy = M.xy, cell = M.cell, tri = M.tri;
  if (!Number.isInteger(n) || n < 3 || xy.length < 2 * n || cell.length < n) fail('mesh', `${label}: n = ${n}, xy ${xy.length}, cell ${cell.length}`);
  if (tri.length % 3 || tri.length < 3) fail('mesh', `${label}: ${tri.length} triangle indices`);
  for (let i = 0; i < tri.length; i++) if (!(tri[i] < n)) { fail('mesh', `${label}: triangle index ${tri[i]} >= n`); break; }
  if (tri.length / 3 > 20000) fail('mesh', `${label}: ${tri.length / 3} triangles (the renderer sorts at most 20k)`);
  if (M.tint && M.tint.length < n) fail('mesh', `${label}: tint shorter than n`);
  stats.vertices += n; bump(stats, 'maxTriangles', tri.length / 3);
  for (let v = 0; v < 2 * n; v++) if (!Number.isFinite(xy[v])) { fail('mesh', `${label}: a vertex of the flat mesh is not finite`); break; }
  // counter-clockwise triangles (the renderer's front side). The vertices are Float32: a sliver of a lobe a few 1e-7
  // wide (a seed that close to a crease) can come out clockwise by rounding alone, so a triangle only counts when its
  // doubled area is negative beyond what rounding its corners can do (8 ulp x its longest side).
  {
    let cw = 0, worst = 0;
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i], b = tri[i + 1], d = tri[i + 2];
      const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1], dx = xy[2 * d], dy = xy[2 * d + 1];
      const ar = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
      const side = Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(dx - bx, dy - by), Math.hypot(ax - dx, ay - dy));
      const ulp = 1.2e-7 * Math.max(1, Math.abs(ax), Math.abs(ay), Math.abs(bx), Math.abs(by), Math.abs(dx), Math.abs(dy));
      if (ar < -8 * ulp * side) { cw++; worst = Math.min(worst, ar); }
    }
    if (cw) fail('mesh', `${label}: ${cw} clockwise triangles in the flat mesh (doubled area down to ${worst})`);
  }
  const seenEdge = new Set();
  for (const b of M.boundary) {
    if (!b || !(b.pts instanceof Float32Array) || !b.cells || b.cells.length !== b.pts.length / 2 || !(b.edge >= 0 && b.edge < domain.edges.length)) { fail('mesh', `${label}: a boundary entry is malformed`); continue; }
    if (seenEdge.has(b.edge)) fail('mesh', `${label}: edge ${b.edge} appears twice in the boundary`);
    seenEdge.add(b.edge);
    if (b.kind !== domain.edges[b.edge].kind) fail('mesh', `${label}: boundary[${b.edge}].kind`);
  }
  if (seenEdge.size !== domain.edges.length) fail('mesh', `${label}: the boundary has ${seenEdge.size} of the tile's ${domain.edges.length} edges`);
  if (mesh && ['torus', 'cylinder', 'mobius', 'klein'].includes(group.fold) && M !== mesh) fail('api', `${label}: the roll fold rebuilt a mesh that was built with foldMeshOptions`);

  const stops = fold.stops;
  if (!Array.isArray(stops) || stops.length < 2 || stops[0].t !== 0 || stops[stops.length - 1].t !== 1) fail('api', `${label}: stops must run from t = 0 to t = 1`);
  else {
    for (let i = 0; i < stops.length; i++) {
      if (typeof stops[i].label !== 'string' || !stops[i].label) fail('api', `${label}: stop ${i} has no label`);
      if (i && !(stops[i].t > stops[i - 1].t + 0.02)) fail('api', `${label}: stops ${i - 1} and ${i} are not increasing (${stops[i - 1].t}, ${stops[i].t})`);
    }
  }
  if (!(fold.duration >= 4 && fold.duration <= 7)) fail('api', `${label}: duration ${fold.duration} s (SPEC: 4-7)`);
  for (const t of [0, 0.37, 1]) if (typeof fold.at(t) !== 'function') { fail('api', `${label}: at(${t}) is not a function`); return; }

  const out = [0, 0, 0], o2 = [0, 0, 0];
  const bsamples = [];                       // every boundary sample: [x, y, cell]
  for (const b of M.boundary) for (let k = 0; k < b.cells.length; k++) bsamples.push([b.pts[2 * k], b.pts[2 * k + 1], b.cells[k]]);

  // ---- 1. at(0) is the identity, exactly
  {
    const F = fold.at(0);
    let bad = 0;
    for (let v = 0; v < n; v++) {
      out[0] = out[1] = out[2] = NaN;
      F(xy[2 * v], xy[2 * v + 1], cell[v], out);
      if (out[0] !== xy[2 * v] || out[1] !== xy[2 * v + 1] || out[2] !== 0) bad++;
    }
    for (const [x, y, p] of bsamples) {
      out[0] = out[1] = out[2] = NaN;
      F(x, y, p, out);
      if (out[0] !== x || out[1] !== y || out[2] !== 0) bad++;
    }
    if (bad) fail('identity', `${label}: at(0) moves ${bad} points`);
  }

  // ---- 2. seams close: glued boundary points coincide at t = 1
  {
    const F = fold.at(1), warp = domain.warp, poly = domain.poly, q = [0, 0], s = [0, 0];
    let cx = 0, cy = 0;
    for (const p of poly) { cx += p[0] / poly.length; cy += p[1] / poly.length; }
    /** the piece of the plane point (x, y) on the boundary: mesh.locate of the point nudged into the tile */
    const pieceAt = (x, y) => {
      warp.inv(x, y, s);
      const dx = cx - s[0], dy = cy - s[1], l = Math.hypot(dx, dy) || 1;
      warp.fwd(s[0] + (1e-6 * dx) / l, s[1] + (1e-6 * dy) / l, s);
      return M.locate(s[0], s[1]);
    };
    const byEdge = new Map(M.boundary.map((b) => [b.edge, b]));
    domain.edges.forEach((e, i) => {
      if (e.kind !== 'cut') return;
      const b = byEdge.get(i), gi = inverse(e.g);
      if (!b) return;
      let worst = 0, worstLocate = 0;
      for (let k = 0; k < b.cells.length; k++) {
        const x = b.pts[2 * k], y = b.pts[2 * k + 1];
        apply(gi, x, y, q);                                  // x' = g^-1 x lies on the partner edge
        const pq = pieceAt(q[0], q[1]);
        F(q[0], q[1], pq, o2);
        F(x, y, b.cells[k], out);                            // the piece the mesh stored for the sample
        worst = Math.max(worst, Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]));
        F(x, y, pieceAt(x, y), out);                         // the piece located afresh
        const d = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]);
        worstLocate = Math.max(worstLocate, Number.isFinite(d) ? d : Infinity);
        stats.seamPairs++;
      }
      if (!(worst < 1e-6 * size)) fail('seams', `${label}: edge ${i} is ${worst / size} tile sizes from its partner at t = 1`);
      if (!(worstLocate < 1e-6 * size)) fail('seams', `${label}: edge ${i}, pieces by locate: ${worstLocate / size} tile sizes from its partner at t = 1`);
      bump(stats, 'maxSeam', worst / size); bump(stats, 'maxSeamLocate', worstLocate / size);
    });
  }

  // ---- the points the motion is watched on
  const pts = [];
  {
    const stride = Math.max(1, Math.floor(n / 120));
    for (let v = 0; v < n; v += stride) pts.push([xy[2 * v], xy[2 * v + 1], cell[v]]);
    for (const b of M.boundary) {
      const m = b.cells.length;
      for (let k = 0; k < m; k += 4) pts.push([b.pts[2 * k], b.pts[2 * k + 1], b.cells[k]]);
      pts.push([b.pts[2 * m - 2], b.pts[2 * m - 1], b.cells[m - 1]]);
    }
    // the four extreme vertices: the far corners move the most
    let iA = 0, iB = 0, iC = 0, iD = 0;
    for (let v = 1; v < n; v++) {
      if (xy[2 * v] < xy[2 * iA]) iA = v; if (xy[2 * v] > xy[2 * iB]) iB = v;
      if (xy[2 * v + 1] < xy[2 * iC + 1]) iC = v; if (xy[2 * v + 1] > xy[2 * iD + 1]) iD = v;
    }
    for (const v of [iA, iB, iC, iD]) pts.push([xy[2 * v], xy[2 * v + 1], cell[v]]);
  }
  const NP = pts.length;
  const sample = (t, arr) => {
    const F = fold.at(t);
    let bad = 0;
    for (let i = 0; i < NP; i++) {
      out[0] = out[1] = out[2] = NaN;
      F(pts[i][0], pts[i][1], pts[i][2], out);
      if (!Number.isFinite(out[0] + out[1] + out[2])) bad++;
      arr[3 * i] = out[0]; arr[3 * i + 1] = out[1]; arr[3 * i + 2] = out[2];
    }
    return bad;
  };
  const dist = (a, b) => {
    let m = 0;
    for (let i = 0; i < 3 * NP; i += 3) { const d = Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]); if (d > m) m = d; }
    return m;
  };

  // ---- 3. continuity
  let zTop = -Infinity, zBottom = Infinity;
  {
    let a = new Float64Array(3 * NP), b = new Float64Array(3 * NP), d2 = new Float64Array(3 * NP);
    const steps = new Float64Array(STEPS);
    let nonFinite = sample(0, a), maxStep = 0, maxBend = 0;
    let prev = null;
    for (let i = 1; i <= STEPS; i++) {
      nonFinite += sample(i / STEPS, b);
      steps[i - 1] = dist(a, b);
      if (steps[i - 1] > maxStep) maxStep = steps[i - 1];
      for (let k = 2; k < 3 * NP; k += 3) { if (b[k] > zTop) zTop = b[k]; if (b[k] < zBottom) zBottom = b[k]; }
      if (prev) {
        for (let k = 0; k < 3 * NP; k += 3) {
          const s2 = Math.hypot(b[k] - 2 * a[k] + prev[k], b[k + 1] - 2 * a[k + 1] + prev[k + 1], b[k + 2] - 2 * a[k + 2] + prev[k + 2]);
          if (s2 > maxBend) maxBend = s2;
        }
      }
      const tmp = prev || d2; prev = a; a = b; b = tmp;
    }
    if (nonFinite) fail('finite', `${label}: ${nonFinite} points are not finite on the grid of ${STEPS} steps`);
    if (!(maxStep <= MAX_STEP[group.fold] * size)) fail('small', `${label}: a point moves ${maxStep / size} tile sizes in 1/${STEPS} (limit ${MAX_STEP[group.fold]})`);
    if (!(maxBend <= MAX_BEND[group.fold] * size)) fail('even', `${label}: second difference ${maxBend / size} tile sizes (limit ${MAX_BEND[group.fold]})`);
    bump(stats.step, group.fold, maxStep / size); bump(stats.bend, group.fold, maxBend / size);

    // no jump: cut the largest steps, the two ends and the steps at the stops into PARTS each
    const watch = new Set([0, STEPS - 1]);
    [...steps.keys()].sort((i, j) => steps[j] - steps[i]).slice(0, 6).forEach((i) => watch.add(i));
    for (const s of stops) for (const i of [Math.floor(s.t * STEPS) - 1, Math.floor(s.t * STEPS), Math.ceil(s.t * STEPS)]) if (i >= 0 && i < STEPS) watch.add(i);
    const u = new Float64Array(3 * NP), w = new Float64Array(3 * NP);
    for (const i of watch) {
      sample(i / STEPS, u);
      let worst = 0;
      for (let j = 1; j <= PARTS; j++) {
        sample((i + j / PARTS) / STEPS, j % 2 ? w : u);
        worst = Math.max(worst, dist(u, w));
      }
      if (!(worst <= (2 / PARTS) * maxStep)) fail('jump', `${label}: 1/${PARTS} of the step ${i} / ${STEPS} moves a point ${worst / size} tile sizes; the largest whole step is ${maxStep / size}`);
      bump(stats.part, group.fold, (worst * PARTS) / maxStep);
    }
  }

  // ---- 4. finite, also at and next to the times where a module changes its formula; every vertex
  {
    const rnd = prng(77 + stats.folds);
    const ts = specialTimes(group, fold);
    for (let i = 0; i < 6; i++) ts.push(rnd());
    let bad = 0, where = -1;
    for (const t of ts) {
      const F = fold.at(t);
      if (typeof F !== 'function') { bad++; where = t; continue; }
      for (let v = 0; v < n; v++) {
        out[0] = out[1] = out[2] = NaN;
        F(xy[2 * v], xy[2 * v + 1], cell[v], out);
        if (!Number.isFinite(out[0] + out[1] + out[2])) { bad++; where = t; }
      }
      for (const [x, y, p] of bsamples) {
        out[0] = out[1] = out[2] = NaN;
        F(x, y, p, out);
        if (!Number.isFinite(out[0] + out[1] + out[2])) { bad++; where = t; }
      }
    }
    if (bad) fail('finite', `${label}: ${bad} values are not finite (last at t = ${where})`);
  }

  // ---- at(t) hands out independent functions: the app holds one while it asks for another (the seam readout)
  {
    const F1 = fold.at(0.31), p = pts[NP >> 1], before = [0, 0, 0], after = [0, 0, 0];
    F1(p[0], p[1], p[2], before);
    const F2 = fold.at(0.83);
    F2(p[0], p[1], p[2], out);
    fold.at(1)(p[0], p[1], p[2], out);
    F1(p[0], p[1], p[2], after);
    if (before[0] !== after[0] || before[1] !== after[1] || before[2] !== after[2]) fail('pure', `${label}: at(0.31) gives another point after at(0.83) was asked for`);
  }

  // ---- toward +z (the cross-cap: toward -z, TOWARD), and the folded shape stays near where the tile was
  {
    const side = TOWARD[group.fold];
    if (side !== 1 && side !== -1) fail('upward', `${label}: no direction for the fold type ${group.fold}`);
    // its own side: zTop for a fold toward +z; for one toward -z the same check with z turned over
    const zUp = side === -1 ? -zBottom : zTop, zDown = side === -1 ? -zTop : zBottom, word = side === -1 ? 'below' : 'above';
    if (!(zUp > 0.03 * size)) fail('upward', `${label}: the motion never goes ${word} the plane by more than ${zUp / size} tile sizes`);
    if (!(zUp >= -RISE[group.fold] * zDown - 1e-9 * size)) fail('upward', `${label}: it reaches ${-zDown / size} tile sizes to the wrong side of the plane but only ${zUp / size} ${word}`);
    if (zDown < -1e-9 * size) { if (!(stats.rise[group.fold] <= zUp / -zDown)) stats.rise[group.fold] = zUp / -zDown; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let v = 0; v < n; v++) { x0 = Math.min(x0, xy[2 * v]); x1 = Math.max(x1, xy[2 * v]); y0 = Math.min(y0, xy[2 * v + 1]); y1 = Math.max(y1, xy[2 * v + 1]); }
    const diag = Math.hypot(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const F = fold.at(1);
    let far = 0;
    for (let v = 0; v < n; v++) {
      F(xy[2 * v], xy[2 * v + 1], cell[v], out);
      far = Math.max(far, Math.hypot(out[0] - mx, out[1] - my, out[2]));
    }
    // every point of the folded shape within one diagonal of the flat mesh from its centre
    if (!(far <= diag)) fail('near', `${label}: the folded shape reaches ${far / diag} diagonals from the centre of the flat mesh`);
  }

  // ---- locate: the piece it returns for a point of the mesh moves that point with its triangle
  if (group.fold !== 'snowflake') {
    const rnd = prng(31 + stats.folds), F = fold.at(0.6), m = tri.length / 3, acc = [0, 0, 0];
    let bad = 0, worst = 0;
    for (let k = 0; k < 40; k++) {
      const t = Math.floor(rnd() * m), a = tri[3 * t], b = tri[3 * t + 1], d = tri[3 * t + 2];
      const x = (xy[2 * a] + xy[2 * b] + xy[2 * d]) / 3, y = (xy[2 * a + 1] + xy[2 * b + 1] + xy[2 * d + 1]) / 3;
      const p = M.locate(x, y);
      if (!Number.isInteger(p) || p < 0) { bad++; continue; }
      acc[0] = acc[1] = acc[2] = 0;
      for (const v of [a, b, d]) { F(xy[2 * v], xy[2 * v + 1], cell[v], out); acc[0] += out[0] / 3; acc[1] += out[1] / 3; acc[2] += out[2] / 3; }
      F(x, y, p, out);
      const dd = Math.hypot(out[0] - acc[0], out[1] - acc[1], out[2] - acc[2]);
      if (!(dd < 0.03 * size)) bad++;
      if (dd > worst) worst = dd;
    }
    if (bad) fail('locate', `${label}: ${bad} of 40 centroids are moved away from their triangle with the piece of locate (worst ${worst / size} tile sizes)`);
  } else {
    // the star: a point of the base tile gets the lid, any other point its cell
    const base = M.cells[0].poly;
    const cxy = [(base[0][0] + base[1][0] + base[2][0]) / 3, (base[0][1] + base[1][1] + base[2][1]) / 3];
    if (M.locate(cxy[0], cxy[1]) !== M.lid) fail('locate', `${label}: a point of the base tile is not given the lid`);
    for (let i = 1; i < M.cells.length; i++) {
      const p = M.cells[i].poly, x = (p[0][0] + p[1][0] + p[2][0]) / 3, y = (p[0][1] + p[1][1] + p[2][1]) / 3;
      if (M.locate(x, y) !== i) { fail('locate', `${label}: the centre of cell ${i} is located in piece ${M.locate(x, y)}`); break; }
    }
  }
  return { domain, fold };
}

// ---- the pure half of src/app.js: what the renderer is handed, for the same cuts ------------------------------------

function checkScene(group, c, amp, prevDomain) {
  const label = `${c.label} amp ${amp}`;
  const scene = buildScene(group, { seed: c.seed, metric: c.metric, amp }, prevDomain);
  const size = scene.size;
  stats.scenes++;
  if (scene.M !== scene.fold.mesh || scene.pos.length !== 3 * scene.n) fail('scene', `${label}: the scene does not draw fold.mesh`);
  // the comma filled into the drawn mesh (motifTintMesh, every fold): two-bit tint, every cut consistent, the triangles
  // counter-clockwise (to within float32 rounding, as the fold mesh's above) and within the renderer's budget
  {
    const M = scene.M, xy = M.xy, tri = M.tri;
    stats.fillScenes++;
    if (!M.motifTint || !(M.tint instanceof Uint8Array) || M.tint.length !== M.n) fail('fill', `${label}: the comma is not filled into the mesh`);
    else {
      if (!M.motifCut || M.motifCut.bad !== 0) fail('fill', `${label}: ${M.motifCut && M.motifCut.bad} triangles could not be cut`);
      let cw = 0, mixed = 0, filled = 0;
      for (let i = 0; i < tri.length; i += 3) {
        const a = tri[i], b = tri[i + 1], d = tri[i + 2];
        const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1], dx = xy[2 * d], dy = xy[2 * d + 1];
        const ar = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
        const side = Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(dx - bx, dy - by), Math.hypot(ax - dx, ay - dy));
        const ulp = 1.2e-7 * Math.max(1, Math.abs(ax), Math.abs(ay), Math.abs(bx), Math.abs(by), Math.abs(dx), Math.abs(dy));
        if (ar < -8 * ulp * side) cw++;
        if (M.tint[a] !== M.tint[b] || M.tint[b] !== M.tint[d]) mixed++;
        if (M.tint[a] & 2) filled++;
      }
      if (cw) fail('fill', `${label}: ${cw} clockwise triangles in the filled mesh`);
      if (mixed) fail('fill', `${label}: ${mixed} triangles of mixed tint`);
      if (!filled) fail('fill', `${label}: no triangle of the comma`);
      if (tri.length / 3 > 20000) fail('fill', `${label}: ${tri.length / 3} triangles (the renderer sorts at most 20k)`);
      bump(stats, 'maxFilled', tri.length / 3);
    }
  }
  if (scene.stops !== scene.fold.stops || scene.duration !== scene.fold.duration) fail('scene', `${label}: stops / duration are not the fold's`);
  if ((group.fold === 'snowflake') !== Array.isArray(scene.star)) fail('scene', `${label}: star`);
  // one bold line per edge of the tile. A tile that is re-cut first (xx, 22x: src/folds/recut.js; 13 Nov 2026) is drawn
  // in runs, one per stretch of an edge on one piece (the pieces come apart on the way): every run names its edge, and
  // every edge has at least one
  const recut = !!scene.M.recut;
  if (!recut && scene.edges.length !== scene.domain.edges.length) fail('scene', `${label}: ${scene.edges.length} boundary lines for ${scene.domain.edges.length} edges`);
  if (recut && new Set(scene.edges.map((e) => e.edge)).size !== scene.domain.edges.length) fail('scene', `${label}: the runs of a re-cut tile cover ${new Set(scene.edges.map((e) => e.edge)).size} of ${scene.domain.edges.length} edges`);
  if (recut !== !!(scene.fold.recut && group.fold !== 'snowflake')) fail('scene', `${label}: fold.recut and mesh.recut disagree`);
  // colours: a mirror in ink, a cut edge in the colour of its seam, the same on both partners
  const byEdge = new Map(scene.edges.map((e) => [e.edge, e]));
  scene.domain.edges.forEach((e, i) => {
    const L = byEdge.get(i);
    if (!L) return;
    if ((e.kind === 'mirror') !== L.mirror) fail('colours', `${label}: edge ${i} mirror flag`);
    if (e.kind === 'mirror' && L.color.join() !== hexToRgb(MIRROR_COLOR).join()) fail('colours', `${label}: the mirror edge ${i} is not ink`);
    // a tile with no tile before it (a named cut, a new group) is coloured by class number: the same picture every time
    if (e.kind === 'cut' && !prevDomain && L.color.join() !== hexToRgb(classColor(e.cls)).join()) fail('colours', `${label}: edge ${i} of a fresh tile is not in the colour of its class ${e.cls}`);
    if (e.kind === 'cut') {
      const P = byEdge.get(e.partner);
      if (!P || P.color.join() !== L.color.join()) fail('colours', `${label}: edge ${i} and its partner ${e.partner} have different colours`);
      for (const [j, o] of scene.domain.edges.entries()) {
        if (o.kind === 'cut' && o.cls !== e.cls && byEdge.get(j) && byEdge.get(j).color.join() === L.color.join() && scene.domain.classes <= 8) fail('colours', `${label}: seams ${e.cls} and ${o.cls} share a colour`);
      }
    }
  });

  const times = [...new Set([0, 0.2, 0.5, 0.8, 1, ...scene.stops.map((s) => s.t)])].sort((a, b) => a - b);
  for (const t of times) {
    mapScene(scene, t);
    if (scene.nonFinite) fail('scene', `${label}: ${scene.nonFinite} points are not finite at t = ${t}`);
    const f = scene.frame;
    if (!f || !(f.radius > 0.1 * size && f.radius < 4 * size) || !Number.isFinite(f.center[0] + f.center[1] + f.center[2])) fail('scene', `${label}: frame at t = ${t}: ${JSON.stringify(f)}`);
    const lines = sceneLines(scene, 1), marks = sceneMarkers(scene, 1);
    let bad = 0;
    for (const l of lines) {
      if (!(l.points instanceof Float32Array) || l.points.length < 6 || l.points.length % 3 || !(l.width > 0) || !Array.isArray(l.color) || l.color.length !== 3) { bad++; continue; }
      for (let i = 0; i < l.points.length; i++) if (!Number.isFinite(l.points[i])) { bad++; break; }
      // every line lies in the bounding sphere of the surface (the double line of the cross-cap: on the surface too)
      for (let i = 0; i < l.points.length; i += 3) {
        if (Math.hypot(l.points[i] - f.center[0], l.points[i + 1] - f.center[1], l.points[i + 2] - f.center[2]) > f.radius + 0.02 * size) { bad++; break; }
      }
    }
    // every marker is labelled, but for a copy of an orbifold point whose label has faded out (sceneMarkers, finding 29)
    for (const m of marks) if (!Number.isFinite(m.p[0] + m.p[1] + m.p[2]) || !(m.size > 0) || (!m.label && !(m.labelAlpha < 0.02))) bad++;
    if (bad) fail('scene', `${label}: ${bad} lines or markers are malformed, not finite or off the surface at t = ${t}`);
    const edgeLines = lines.filter((l) => l.width === WIDTHS.edge).length;
    if (edgeLines !== scene.edges.length) fail('scene', `${label}: ${edgeLines} bold lines for ${scene.edges.length} edges at t = ${t}`);
    const creaseLines = lines.filter((l) => l.dashed && l.width === WIDTHS.crease).length;
    // (a re-cut tile shows the home tile's creases only once the home tile begins to fold: fold.creaseAlpha)
    // (... and the home tile itself, of which no piece moves, shows them as the fold module's own fold does)
    const moving = recut && scene.fold.recut.movers > 0;
    if (!moving && t < 0.2 && creaseLines !== scene.creases.length) fail('scene', `${label}: ${creaseLines} crease lines for ${scene.creases.length} creases at t = ${t}`);
    if (moving && t <= scene.fold.foldFrom && creaseLines !== 0) fail('scene', `${label}: creases are drawn at t = ${t}, before the re-cut tile folds (from ${scene.fold.foldFrom})`);
    if (t === 1 && creaseLines !== 0) fail('scene', `${label}: creases are still drawn at t = 1`);
    if (t === 0) {
      // flat: everything in the plane, the boundary where the tile's outline is, the cone points where the domain has them
      for (const l of lines) for (let i = 2; i < l.points.length; i += 3) if (l.points[i] !== 0) { fail('flatScene', `${label}: a line leaves the plane at t = 0`); break; }
      for (let i = 2; i < scene.pos.length; i += 3) if (scene.pos[i] !== 0) { fail('flatScene', `${label}: the surface leaves the plane at t = 0`); break; }
      if (marks.length !== scene.domain.conePoints.length) fail('flatScene', `${label}: ${marks.length} markers for ${scene.domain.conePoints.length} cone points at t = 0`);
      if (scene.motif.length < 1) fail('flatScene', `${label}: no piece of the motif in the tile`);
    }
    if (t === 1) {
      const gap = seamGap(scene);
      if (scene.domain.classes === 0 ? gap !== null : !(gap < 1e-6)) fail('sceneSeams', `${label}: seam gap ${gap} at t = 1`);
      // folded up, the markers that are left are the special points the orbifold's name lists
      const got = marks.map((m) => m.label).sort().join(' '), want = specialPoints(group.id).join(' ');
      stats.markerChecks++;
      if (got !== want) fail('markers', `${label}: at t = 1 the markers are [${got}], the orbifold ${group.id} has [${want}]`);
    } else if (t > 0 && t < 0.2 && scene.domain.classes > 0) {
      if (!(seamGap(scene) > 1e-3)) fail('sceneSeams', `${label}: the seams are already closed at t = ${t}`);
    }
  }
  return scene.domain;
}

// ---- the sweep ------------------------------------------------------------------------------------------------------

const t0 = performance.now();
for (const group of GROUPS) {
  for (const amp of AMPS) {
    let prev = null, k = 0;
    for (const c of cases(group)) {
      checkFold(group, c, amp, k % 2 === 1);
      // the scene of every preset, and of every third random seed (one tile's seams lending colours to the next)
      if (c.preset >= 0 || k % 3 === 0) prev = checkScene(group, c, amp, prev);
      k++;
    }
  }
}
stats.ms = performance.now() - t0;

test('folds: every group has a fold module, and the index refuses a fold type it does not know', () => {
  assert.equal(GROUPS.length, 17);
  for (const g of GROUPS) assert.ok(FOLD_TYPES.includes(g.fold), `${g.id}: fold type ${g.fold}`);
  assert.deepEqual([...new Set(GROUPS.map((g) => g.fold))].sort(), [...FOLD_TYPES].sort(), 'every fold type is used by a group');
  assert.equal(createFoldDefault, createFold);
  const g = BY_ID['333'], domain = buildDomain(g, { seed: g.presets[0].seed });
  assert.throws(() => createFold({ ...g, fold: 'origami' }, domain), /no fold module/);
  for (const id of ['o', '**', '*x', 'xx']) assert.deepEqual(foldMeshOptions(BY_ID[id]), { density: rollDensity(BY_ID[id]) }, `${id}: the roll fold's own density`);
  for (const id of ['333', '22x', '*632']) assert.deepEqual(foldMeshOptions(BY_ID[id]), {}, `${id}: the default mesh`);
});

test('folds: the anchor (SPEC 7) — foldOptions passes two finite numbers on as a fresh [x, y], drops anything else, keeps the other options', () => {
  const a = [0.25, -1.5], o = { anchor: a, chirality: -1 };
  const f = foldOptions(o);
  assert.deepEqual(f, { anchor: [0.25, -1.5], chirality: -1 });
  assert.notEqual(f.anchor, a, 'the anchor is copied');
  assert.equal(o.anchor, a, 'the options handed in are not changed');
  assert.deepEqual(foldOptions({ anchor: Float32Array.of(1, 2) }).anchor, [1, 2], 'a typed array');
  assert.deepEqual(foldOptions({ anchor: [3, 4, 5] }).anchor, [3, 4], 'the first two numbers');
  for (const bad of [undefined, null, [], [1], [NaN, 1], [1, Infinity], [undefined, 2], '12', 'ab', { x: 1, y: 2 }, 5, true]) {
    const got = foldOptions({ anchor: bad, k: 1 });
    assert.equal('anchor' in got, false, `anchor ${JSON.stringify(bad)} is dropped`);
    assert.equal(got.k, 1);
  }
  assert.deepEqual(foldOptions(null), {});
  assert.deepEqual(foldOptions(undefined), {});
  // createFold hands the module these options (the snowflake fold shows its chirality option on the fold)
  const g = BY_ID['*632'], domain = buildDomain(g, { seed: g.presets[0].seed });
  for (const chi of [1, -1]) assert.equal(createFold(g, domain, null, { chirality: chi, anchor: [NaN, 0] }).chirality, chi, `chirality ${chi} reaches the module`);
});

test('app: buildScene hands the anchor to the fold; anchor = seed is the fold without an anchor (SPEC 7: a missing anchor means anchor = seed)', () => {
  const rnd = prng(2026);
  let compared = 0;
  for (const g of GROUPS) {
    const size = Math.sqrt(g.domainArea), p0 = g.presets[0];
    // the scene records what it handed over; nothing, or something malformed, is no anchor
    const A = [p0.seed[0] + 0.01, p0.seed[1] - 0.02];
    assert.deepEqual(buildScene(g, { seed: p0.seed, metric: p0.metric, anchor: A }).anchor, A, `${g.id}: scene.anchor`);
    assert.equal(buildScene(g, { seed: p0.seed, metric: p0.metric }).anchor, null, `${g.id}: no anchor`);
    assert.equal(buildScene(g, { seed: p0.seed, metric: p0.metric, anchor: [NaN, 1] }).anchor, null, `${g.id}: a malformed anchor`);
    // generic seeds (away from every crease of the kaleidoscope, where "the cell holding the seed" is not in doubt)
    for (let k = 0; k < 3; k++) {
      const seed = [g.center[0] + (2 * rnd() - 1) * g.viewHalf, g.center[1] + (2 * rnd() - 1) * g.viewHalf];
      if (g.kaleido) {
        const m = symmetryElements(g.kaleido.group, seed[0], seed[1], 2 * size).mirrors;
        if (m.some((l) => Math.abs((seed[0] - l.px) * l.uy - (seed[1] - l.py) * l.ux) < 1e-3 * size)) continue;
      }
      const domain = buildDomain(g, { seed, metric: p0.metric, warp: makeWarp(g, 0) });
      const mesh = g.fold === 'snowflake' ? null : buildMesh(g, domain, foldMeshOptions(g));
      const plain = createFold(g, domain, mesh, {}), anchored = createFold(g, domain, mesh, { anchor: domain.seed.slice() });
      // the scene of the same cut with that anchor draws that fold (recut: false — the fold module's own motion; a
      // scene that re-cuts first is compared with createFold({ recut: true }) in test/recut.test.js)
      const scene = buildScene(g, { seed, metric: p0.metric, amp: 0, anchor: domain.seed.slice(), recut: false });
      const M = plain.mesh, out = [0, 0, 0], ref = [0, 0, 0];
      for (const t of [0.25, 0.5, 0.75, 1]) {
        const F0 = plain.at(t), F1 = anchored.at(t), F2 = scene.fold.at(t);
        let worst = 0;
        for (let v = 0; v < M.n; v += Math.max(1, Math.floor(M.n / 60))) {
          F0(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], ref);
          F1(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out);
          worst = Math.max(worst, Math.hypot(out[0] - ref[0], out[1] - ref[1], out[2] - ref[2]));
          F2(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out);
          worst = Math.max(worst, Math.hypot(out[0] - ref[0], out[1] - ref[1], out[2] - ref[2]));
        }
        assert.ok(worst <= 1e-9 * size, `${g.id} seed (${seed.map((v) => v.toFixed(4))}) t = ${t}: anchor = seed moves a vertex ${worst / size} tile sizes away from the fold without an anchor`);
        compared++;
      }
    }
  }
  assert.ok(compared >= 17 * 4, `${compared} comparisons`);
});

test('folds: the fold interface for all 17 groups — mesh to draw, stops from 0 to 1 with labels, duration 4-7 s, at(t) -> fn', () => assert.equal(failures.api.length, 0, show('api')));
test('folds: fold.mesh is drawable — finite, counter-clockwise, indices in range, at most 20k triangles, one boundary line per edge', () => assert.equal(failures.mesh.length, 0, show('mesh')));
test('folds 1: at(0) is the identity, exactly (every vertex and boundary sample)', () => assert.equal(failures.identity.length, 0, show('identity')));
test('folds 2: seams close — at t = 1 every cut edge lies on its partner within 1e-6 tile sizes (pieces as stored, and by locate)', () => assert.equal(failures.seams.length, 0, show('seams')));
test('folds 3: continuity — over 200 steps no point moves more than the fold type\'s bound in a step', () => assert.equal(failures.small.length, 0, show('small')));
test('folds 3b: no jump — cut into 32, no part of the largest steps, the first, the last or the steps at the stops moves more than 1/16 of the largest step', () => assert.equal(failures.jump.length, 0, show('jump')));
test('folds 3c: even — second differences over 200 steps stay within the fold type\'s bound', () => assert.equal(failures.even.length, 0, show('even')));
test('folds 4: no NaN / Infinity for any t in [0, 1], including the stops, the inner stage boundaries and 1e-12 either side', () => assert.equal(failures.finite.length, 0, show('finite')));
test('folds: at(t) of one time is not disturbed by asking for another', () => assert.equal(failures.pure.length, 0, show('pure')));
test('folds: folding goes toward +z (the cross-cap toward -z, by design: TOWARD)', () => assert.equal(failures.upward.length, 0, show('upward')));
test('folds: the folded shape stays near where the tile was', () => assert.equal(failures.near.length, 0, show('near')));
test('folds: mesh.locate gives the piece that moves a point with its triangle (the motif is drawn through it)', () => assert.equal(failures.locate.length, 0, show('locate')));

test('app scene: surface, lines and markers are finite and on the shape at every stop; one bold line per edge; creases gone at t = 1', () => assert.equal(failures.scene.length, 0, show('scene')));
test('app scene: at t = 0 everything lies in the plane, one marker per cone point of the tile, the motif is there', () => assert.equal(failures.flatScene.length, 0, show('flatScene')));
test('app scene: sewn edges share a colour, different seams differ, mirrors are ink', () => assert.equal(failures.colours.length, 0, show('colours')));
test('app scene: the seam readout — open on the way, closed (< 1e-6) at t = 1, none for the kaleidoscopes', () => assert.equal(failures.sceneSeams.length, 0, show('sceneSeams')));
test('app scene: folded up, the markers left are exactly the cone points and mirror corners in the orbifold\'s name', () => assert.equal(failures.markers.length, 0, show('markers')));
test('app scene: the comma is filled into every drawn mesh (two-bit tint, every cut consistent, counter-clockwise, within 20k triangles)', (t) => {
  assert.equal(failures.fill.length, 0, show('fill'));
  assert.equal(stats.fillScenes, stats.scenes);
  t.diagnostic(`${stats.fillScenes} scenes; largest filled mesh ${stats.maxFilled} triangles`);
});

test('folds: the sweep really ran', (t) => {
  const presets = GROUPS.reduce((s, g) => s + g.presets.length, 0);
  assert.equal(stats.folds, (presets + 17 * SEEDS) * AMPS.length);
  assert.deepEqual(Object.keys(stats.byType).sort(), [...FOLD_TYPES].sort());
  assert.ok(stats.seamPairs > 50000, `${stats.seamPairs} glued pairs of boundary points were compared`);
  assert.ok(stats.scenes >= presets * AMPS.length && stats.markerChecks === stats.scenes);
  assert.ok(stats.maxSeam < 1e-6 && stats.maxSeamLocate < 1e-6);
  const f = (o) => Object.entries(o).map(([k, v]) => `${k} ${v.toPrecision(2)}`).join(', ');
  t.diagnostic(`${stats.folds} folds, ${stats.scenes} scenes, ${stats.seamPairs} seam pairs in ${Math.round(stats.ms)} ms; largest mesh ${stats.maxTriangles} triangles`);
  t.diagnostic(`worst seam at t = 1: ${stats.maxSeam.toExponential(1)} tile sizes (pieces by locate: ${stats.maxSeamLocate.toExponential(1)})`);
  t.diagnostic(`largest step per 1/${STEPS}, tile sizes: ${f(stats.step)}`);
  t.diagnostic(`largest second difference, tile sizes: ${f(stats.bend)}`);
  t.diagnostic(`largest 1/${PARTS} of a watched step x ${PARTS} / largest whole step (1 = constant speed; the test allows 2): ${f(stats.part)}`);
  t.diagnostic(`rise above the plane / dip below it, smallest: ${f(stats.rise)}`);
});

test('control: a planted jump, an open seam, a moved start, a NaN at a stop and a fold that goes down are each noticed', () => {
  const g = BY_ID['333'], c = { label: 'control 333', seed: g.presets[0].seed, metric: undefined, preset: 0 };
  const before = JSON.stringify(stats);
  const realFailures = NAMES.reduce((sum, k) => sum + failures[k].length, 0);
  const run = (tamper) => {
    const got = Object.fromEntries(NAMES.map((k) => [k, []]));
    sink = got;
    try { checkFold(g, c, 0, false, tamper); } finally { sink = failures; Object.assign(stats, JSON.parse(before)); }   // the sweep's own lists and numbers stay as they were
    return got;
  };
  const names = (got) => NAMES.filter((k) => got[k].length).join(' ');
  // the real fold: nothing
  assert.equal(names(run(null)), '');
  const wrap = (change) => (fold, size) => ({ ...fold, at: (t) => { const F = fold.at(t); return (x, y, cell, out) => { F(x, y, cell, out); change(t, x, y, cell, out, size); return out; }; } });
  // a jump of 0.004 tile sizes right after t = 0 (the first step is watched)
  let got = run(wrap((t, x, y, cell, out, size) => { if (t > 0) out[2] += 0.004 * size; }));
  assert.ok(got.jump.length && !got.small.length, 'a jump at the start: ' + names(got));
  // a jump of 0.003 tile sizes in mid-motion, in a step that is not among the largest: the second difference shows it
  got = run(wrap((t, x, y, cell, out, size) => { if (t > 0.9025) out[0] += 0.003 * size; }));
  assert.ok(got.even.length, 'a jump in mid-motion: ' + names(got));
  // a seam left 3e-6 tile sizes open: one piece is shifted at t = 1
  got = run(wrap((t, x, y, cell, out, size) => { if (t >= 1 && cell === 1) out[0] += 3e-6 * size; }));
  assert.equal(names(got), 'seams');
  // at(0) is not exactly the identity
  got = run(wrap((t, x, y, cell, out) => { if (t === 0) out[2] = 1e-300; }));
  assert.ok(got.identity.length, 'a moved start: ' + names(got));
  // NaN exactly at the last stop, for one vertex
  got = run(wrap((t, x, y, cell, out) => { if (t === 1 && x > 0.99) out[1] = NaN; }));
  assert.ok(got.finite.length, 'a NaN at t = 1: ' + names(got));
  // the same motion, downward
  got = run(wrap((t, x, y, cell, out) => { out[2] = -out[2]; }));
  assert.equal(names(got), 'upward');
  // the cross-cap goes toward -z by design (TOWARD): its real fold passes here, and the same fold squashed flat (it never
  // reaches 0.03 tile sizes to its side) is noticed. Its flaps' direction itself ('under' against round 3's 'over', which
  // the closed shape's symmetry in z = 0 hides from this whole-motion check) is test/crosscap.test.js's 'by design' test.
  {
    const gx = BY_ID['22x'], cx = { label: 'control 22x', seed: gx.presets[0].seed, metric: gx.presets[0].metric, preset: 0 };
    const runX = (tamper) => {
      const gotX = Object.fromEntries(NAMES.map((k) => [k, []]));
      sink = gotX;
      try { checkFold(gx, cx, 0, false, tamper); } finally { sink = failures; Object.assign(stats, JSON.parse(before)); }
      return gotX;
    };
    assert.equal(names(runX(null)), '', 'the real 22x fold passes');
    assert.equal(names(runX(wrap((t, x, y, cell, out) => { out[2] *= 0.01; }))), 'upward', 'a 22x fold that hardly leaves the plane');
  }
  // a function that shares its state with the next one asked for
  got = run((fold) => { let last = 0; return { ...fold, at: (t) => { last = t; return (x, y, cell, out) => fold.at(last)(x, y, cell, out); } }; });
  assert.ok(got.pure.length, 'shared state: ' + names(got));
  assert.equal(NAMES.reduce((sum, k) => sum + failures[k].length, 0), realFailures, 'the real lists are untouched');
});

test('app: a drag session — the seed wanders over mirrors, rotation centres and creases while the wave changes; every step rebuilds from the tile before', (t) => {
  // What dragging in the plane does: the seed moves a little, the scene is rebuilt with the previous tile at hand
  // (its seams lend their colours), t is kept. The path is a Lissajous curve through the whole window; every sixth
  // step sits exactly on, or 1e-12 ... 1e-5 beside, a rotation centre of the pattern or a corner of its kaleidoscope
  // (where creases cross), which is where a tile degenerates. FOLDS_WALK=600 lengthens the walk.
  const STEPS_WALK = Math.max(36, +process.env.FOLDS_WALK || 36);
  const OFF = [0, 1e-12, 1e-9, 1e-7, 1e-5];
  let steps = 0, kept = 0, born = 0, worstGap = 0;
  const drift = {};          // per fold type: how far the folded shape's centre wanders over the walk (tile sizes)
  for (const group of GROUPS) {
    const [cx, cy] = group.center, r = 0.95 * group.viewHalf;
    const special = symmetryElements(group, cx, cy, 1.3 * group.viewHalf).centers.map((c) => [c.x, c.y]);
    if (group.kaleido) for (const c of symmetryElements(group.kaleido.group, cx, cy, 1.3 * group.viewHalf).centers) special.push([c.x, c.y]);
    for (const p of group.presets) special.push(p.seed);
    // as in the app: preset 0 was chosen (its seed is the anchor), then the cut is dragged and waved; the anchor stays
    let prev = null, metric = group.presets[0].metric, home = null;
    const anchor = group.presets[0].seed.slice();
    for (let k = 0; k < STEPS_WALK; k++) {
      let seed = [cx + r * Math.sin((2 * Math.PI * 3 * k) / STEPS_WALK + 0.4), cy + r * Math.sin((2 * Math.PI * 2 * k) / STEPS_WALK + 1.1)];
      if (k % 6 === 0 && special.length) {
        const q = special[(k / 6) % special.length], off = OFF[(k / 6) % OFF.length], a = 0.7 * k;
        seed = [q[0] + off * Math.cos(a), q[1] + off * Math.sin(a)];
      }
      const amp = [0, 0.35, 1, 0.7][k % 4];
      const label = `${group.id} step ${k} seed (${seed[0]}, ${seed[1]}) amp ${amp}`;
      let scene;
      assert.doesNotThrow(() => { scene = buildScene(group, { seed, metric, amp, anchor }, prev); }, label);
      assert.deepEqual(scene.anchor, anchor, `${label}: the anchor reaches the fold`);
      assert.ok(scene.M.motifTint && scene.M.motifCut.bad === 0, `${label}: the comma is filled, every cut consistent`);
      steps++;
      // seams that were there before keep their colour; partners agree
      const old = new Map();
      if (prev) for (const e of prev.edges) if (e.kind === 'cut') old.set(e.seam, e.color);
      for (const e of scene.domain.edges) {
        if (e.kind !== 'cut') continue;
        assert.equal(scene.domain.edges[e.partner].color, e.color, `${label}: partners share a colour`);
        if (old.has(e.seam)) { kept++; assert.equal(e.color, old.get(e.seam), `${label}: a seam that stays keeps its colour`); } else born++;
      }
      mapScene(scene, 0.37);
      assert.equal(scene.nonFinite, 0, `${label}: finite at t = 0.37`);
      mapScene(scene, 1);
      assert.equal(scene.nonFinite, 0, `${label}: finite at t = 1`);
      if (!home) home = scene.frame.center.slice();
      bump(drift, group.fold, Math.hypot(scene.frame.center[0] - home[0], scene.frame.center[1] - home[1], scene.frame.center[2] - home[2]) / scene.size);
      const gap = seamGap(scene);
      if (gap !== null) { assert.ok(gap < 1e-6, `${label}: seam gap ${gap} at t = 1`); worstGap = Math.max(worstGap, gap); }
      assert.equal(sceneMarkers(scene, 1).map((m) => m.label).sort().join(' '), specialPoints(group.id).join(' '), `${label}: the markers at t = 1`);
      for (const l of sceneLines(scene, 1)) for (let i = 0; i < l.points.length; i++) assert.ok(Number.isFinite(l.points[i]), `${label}: a line point is not finite`);
      prev = scene.domain;
    }
  }
  assert.ok(kept > steps && born > 17, `${kept} seams kept their colour, ${born} were new`);
  t.diagnostic(`${steps} steps over 17 groups; ${kept} seams carried over with their colour, ${born} new ones; worst seam gap ${worstGap.toExponential(1)}`);
  // printed, not asserted here: every fold honours the anchor now, and that its closed shape stays put over a drag is
  // asserted where each fold is tested (test/hinge.test.js and test/crosscap.test.js 'anchor (SPEC 7) 1',
  // test/roll-anchor.test.js 'anchor 1'); this line shows how far the drawn shape wanders over this walk (the
  // snowflake's 8 is its star re-based to the seed's tile, by design)
  t.diagnostic('folded shape (t = 1) wandering over the walk with one anchor, tile sizes: ' + Object.entries(drift).map(([k, v]) => `${k} ${v.toPrecision(2)}`).join(', '));
});

test('app: a folded kaleidoscope shows one comma per pile — each copy of the motif fades as its flap lands, smoothly; at t = 1 only the tile\'s own copy is drawn', () => {
  const rnd = prng(632);
  let piles = 0, stopsSeen = 0;
  for (const g of GROUPS) {
    const p0 = g.presets[0];
    if (g.fold !== 'snowflake') {
      // the other groups: every comma at full strength, all the time
      for (const amp of [0, 1]) {
        const scene = buildScene(g, { seed: p0.seed, metric: p0.metric, amp, anchor: p0.seed });
        for (const t of [0, 0.5, 1]) {
          mapScene(scene, t);
          const ls = sceneLines(scene, 1).filter((l) => l.width === WIDTHS.motif);
          assert.equal(ls.length, scene.motif.length, `${g.id} amp ${amp} t = ${t}: every comma is drawn`);
          assert.ok(ls.every((l) => l.alpha === MOTIF_ALPHA), `${g.id}: at full strength`);
        }
      }
      continue;
    }
    const seeds = [p0.seed];
    for (let k = 0; k < 3; k++) seeds.push([g.center[0] + (2 * rnd() - 1) * 0.6 * g.viewHalf, g.center[1] + (2 * rnd() - 1) * 0.6 * g.viewHalf]);
    for (const seed of seeds) for (const amp of [0, 1]) {
      const scene = buildScene(g, { seed, metric: p0.metric, amp, anchor: p0.seed });
      const label = `${g.id} seed (${seed.map((v) => v.toFixed(3))}) amp ${amp}`, size = scene.size;
      const stops = scene.stops.map((s) => s.t), cells = scene.fold.mesh.cells.length;
      // every cell but the tile has its copies, each fading in the second part of one stage between two stops
      assert.equal(new Set(scene.motif.map((m) => m.copy)).size, cells, `${label}: a copy of the motif on every cell of the star`);
      for (const m of scene.motif) {
        if (m.copy === 0) { assert.equal(m.fade, null, `${label}: the tile's own copy never fades`); continue; }
        assert.ok(Array.isArray(m.fade) && stops.includes(m.fade[1]) && m.fade[0] > 0 && m.fade[0] < m.fade[1], `${label}: copy ${m.copy} fades in [${m.fade}] (stops ${stops})`);
        const k = stops.indexOf(m.fade[1]);
        assert.ok(Math.abs(m.fade[0] - (stops[k - 1] + 0.45 * (stops[k] - stops[k - 1]))) < 1e-12, `${label}: copy ${m.copy} starts to fade as its flap comes down`);
      }
      // continuous and never coming back: over 400 steps no copy changes its opacity by more than 0.04 at once
      for (const m of scene.motif) {
        let prev = MOTIF_ALPHA * motifFade(m.fade, 0);
        assert.equal(prev, MOTIF_ALPHA, `${label}: copy ${m.copy} is drawn in full at t = 0`);
        for (let i = 1; i <= 400; i++) {
          const a = MOTIF_ALPHA * motifFade(m.fade, i / 400);
          assert.ok(a <= prev + 1e-12 && prev - a < 0.04 && a >= 0, `${label}: copy ${m.copy} at t = ${i / 400}: opacity ${prev} -> ${a}`);
          prev = a;
        }
      }
      // at every stop: no two drawn copies on top of each other (no ribbon), and every faded copy lies (in the plane)
      // exactly under a drawn one (folding along mirrors maps the pattern onto itself: nothing leaves the picture)
      const onTop = (a, b) => {
        if (a.part !== b.part || a.out.length !== b.out.length) return false;
        let d = 0;
        for (let i = 0; i < a.out.length; i += 3) d = Math.max(d, Math.hypot(a.out[i] - b.out[i], a.out[i + 1] - b.out[i + 1]));
        return d < 1e-6 * size;
      };
      for (const t of stops) {
        mapScene(scene, t);
        stopsSeen++;
        const lines = sceneLines(scene, 1).filter((l) => l.width === WIDTHS.motif);
        const drawn = scene.motif.filter((m) => motifFade(m.fade, t) > 0.999), faded = scene.motif.filter((m) => motifFade(m.fade, t) < 0.001);
        assert.equal(drawn.length + faded.length, scene.motif.length, `${label}: at the stop t = ${t} every copy is either drawn or gone`);
        assert.equal(lines.length, drawn.length, `${label}: t = ${t}: the faded copies are not handed to the renderer`);
        for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) {
          if (onTop(drawn[i], drawn[j])) { piles++; assert.fail(`${label}: t = ${t}: copies ${drawn[i].copy} and ${drawn[j].copy} are both drawn on the same spot`); }
        }
        for (const f of faded) assert.ok(drawn.some((d) => onTop(d, f)), `${label}: t = ${t}: copy ${f.copy} is gone and no drawn copy lies at its place`);
        if (t === 1) assert.ok(drawn.length > 0 && drawn.every((m) => m.copy === 0) && lines.every((l) => l.alpha === MOTIF_ALPHA), `${label}: folded, only the tile's own copy is drawn, in full`);
      }
    }
  }
  assert.equal(piles, 0);
  assert.ok(stopsSeen >= 4 * 4 * 2 * 3, `${stopsSeen} stops looked at`);
});

test('app: after a group change the zoom glides back to 1 — exact ends, steady in log zoom, eased, never past either end', () => {
  assert.ok(ZOOM_HOME_SECONDS >= 0.2 && ZOOM_HOME_SECONDS <= 0.6, `${ZOOM_HOME_SECONDS} s: quick, but a glide`);
  for (const z0 of [3.2, 2.5, 1.37, 0.8, 0.5]) {
    assert.equal(zoomBetween(z0, 1, 0), z0, `${z0}: starts where it was`);
    assert.equal(zoomBetween(z0, 1, -0.3), z0);
    assert.equal(zoomBetween(z0, 1, 1), 1, `${z0}: ends exactly at 1`);
    assert.equal(zoomBetween(z0, 1, 1.7), 1);
    assert.ok(Math.abs(zoomBetween(z0, 1, 0.5) - Math.sqrt(z0)) < 1e-12, `${z0}: half way in log zoom at half time`);
    let prev = z0, maxStep = 0, firstStep = 0, lastStep = 0;
    for (let i = 1; i <= 100; i++) {
      const z = zoomBetween(z0, 1, i / 100), step = Math.abs(Math.log(z) - Math.log(prev));
      assert.ok((z0 > 1 ? z <= prev + 1e-15 && z >= 1 : z >= prev - 1e-15 && z <= 1), `${z0}: monotone, between the ends, at ${i / 100}`);
      maxStep = Math.max(maxStep, step);
      if (i === 1) firstStep = step;
      if (i === 100) lastStep = step;
      prev = z;
    }
    const total = Math.abs(Math.log(z0));
    assert.ok(maxStep <= 1.51 * total / 100, `${z0}: no jump (largest step ${maxStep / total} of the way)`);
    assert.ok(firstStep < 0.05 * maxStep && lastStep < 0.05 * maxStep, `${z0}: it eases in and out`);
  }
  assert.equal(zoomBetween(1, 1, 0.4), 1);
});

test('app: the hint over the plane — the cut hint until the first drag; none for the kaleidoscopes (SPEC 8 C1: nothing to cut)', () => {
  for (const g of GROUPS) {
    const kal = g.fold === 'snowflake';
    for (const dragged of [false, true]) {
      const h = hintState(g, dragged);
      assert.equal(h.text, HINT_TEXT, `${g.id}: the words`);
      assert.equal(h.hidden, kal || dragged, `${g.id} dragged ${dragged}: hidden`);
    }
  }
  assert.equal(HINT_TEXT, 'drag to move the cut');
});

test('app: group ids from a URL hash', () => {
  assert.equal(DEFAULT_GROUP, '333');
  for (const g of GROUPS) {
    assert.equal(resolveGroupId(g.id), g.id);
    assert.equal(resolveGroupId(g.label), g.id, `the display label ${g.label}`);
    assert.equal(resolveGroupId(' ' + g.id.toUpperCase() + ' '), g.id);
    assert.equal(resolveGroupId(g.id.replace(/\*/g, 's')), g.id, 's stands for *');
    assert.equal(resolveGroupId(encodeURIComponent(g.id)) === g.id || /%/.test(encodeURIComponent(g.id)), true);
  }
  for (const bad of [null, undefined, '', '  ', '123', 'p3', '33', 'constructor', '__proto__', 'toString']) assert.equal(resolveGroupId(bad), null, String(bad));
});

test('app: creases fade out as the fold completes; line widths follow the pane', () => {
  for (const type of FOLD_TYPES) {
    assert.equal(creaseAlpha(type, 0), 1, type);
    let prev = 1;
    for (let i = 1; i <= 100; i++) {
      const a = creaseAlpha(type, i / 100);
      assert.ok(a <= prev + 1e-12 && a >= 0 && a <= 1, `${type}: creaseAlpha is monotone at ${i / 100}`);
      assert.ok(prev - a < 0.06, `${type}: creaseAlpha has no jump at ${i / 100}`);
      prev = a;
    }
  }
  for (const type of ['hinge', 'crosscap', 'snowflake']) assert.equal(creaseAlpha(type, 1), 0, type);
  // the star of a kaleidoscope: grey mirror images until the last fold begins, the tile's own colour when it is done.
  // Every fold carries the comma filled in (motifTintMesh: tint bit 1, drawn in the renderer's `fill`, MOTIF_FILL_3D;
  // the owner's ask of 9-10 Nov 2026, qa/fill-judge.md), so the ghost colour (tint bit 0) is the star's alone again:
  // until 10 Nov xx's filled comma was drawn in the ghost colour (MOTIF_FILL_3D) and this test said so.
  assert.deepEqual(MOTIF_FILL_3D, [0.33, 0.55, 0.55], 'the fill: a deep teal, the surface\'s own hue');
  for (const g of GROUPS) {
    const scene = buildScene(g, { seed: g.presets[0].seed, metric: g.presets[0].metric, amp: 0 });
    assert.ok(scene.M.motifTint === true && scene.M.tint.length === scene.n, `${g.id}: the comma is filled into the mesh`);
    const bits = new Set(scene.M.tint);
    assert.ok(bits.has(2) || bits.has(3), `${g.id}: some of the sheet is the comma (tint bit 1)`);
    assert.equal(bits.has(1) || bits.has(3), g.fold === 'snowflake', `${g.id}: tint bit 0 (ghost) only on a star`);
    const last = scene.stops[scene.stops.length - 2].t;
    let prev = null;
    for (let i = 0; i <= 50; i++) {
      mapScene(scene, i / 50);
      const c = ghostColor(scene);
      if (g.fold !== 'snowflake') assert.deepEqual(c, SURFACE_GHOST, `${g.id} at ${i / 50}`);
      else if (i / 50 <= last) assert.deepEqual(c, SURFACE_GHOST, `${g.id} at ${i / 50}`);
      if (prev) for (let k = 0; k < 3; k++) assert.ok(Math.abs(c[k] - prev[k]) < 0.05, `${g.id}: the ghost colour has no jump at ${i / 50}`);
      prev = c;
    }
    if (g.fold === 'snowflake') { assert.ok(last > 0.3 && last < 0.9, `${g.id}: the last fold starts at ${last}`); assert.deepEqual(prev, SURFACE_FRONT, `${g.id} at t = 1`); }
  }
  assert.equal(lineScale(520, 900), 1);
  assert.equal(lineScale(366, 358), 0.72, 'a phone pane: thinner, but not below 0.72');
  assert.equal(lineScale(2000, 2000), 1.1);
  assert.equal(lineScale(0, 0), 1);
});

test('app: the surface colours follow fold.mirroredAt(t) (SPEC 9 C3 addition; notes/roll-round4.md finding 4) — a ** tile one strip across from the anchor turns its page over: front at t = 0, swapped at t = 1, blended without a jump; so do the hinge folds with a mirror and *x (final fix); fold.mirrored alone swaps at every t', () => {
  const g = BY_ID['**'], p = g.presets[0], anchor = p.seed.slice();
  const across = buildScene(g, { seed: [0.9, 0.62], metric: p.metric, anchor });
  const home = buildScene(g, { seed: p.seed, metric: p.metric, anchor });
  assert.equal(across.fold.mirrored, true, 'the tile lies a mirror away from the anchor: its paper ends up turned over');
  assert.equal(typeof across.fold.mirroredAt, 'function', '** says when it turns over');
  const plain = { front: SURFACE_FRONT, back: SURFACE_BACK }, swapped = { front: SURFACE_BACK, back: SURFACE_FRONT };
  assert.deepEqual(surfaceStyle(across.fold, 0), plain, 'flat: the tile shows its front, as in the plane');
  assert.deepEqual(surfaceStyle(across.fold, 1), swapped, 'closed: swapped, so the tube looks as the anchor\'s does');
  for (const t of [0, 0.5, 1]) assert.deepEqual(surfaceStyle(home.fold, t), plain, `an unmirrored tile at t = ${t}`);
  // the blend: monotone, in [0, 1], spread over several frames (no colour jump), done while the page is edge-on
  let prev = 0, prevFront = SURFACE_FRONT, maxStep = 0, from = null, to = null;
  for (let k = 1; k <= 200; k++) {
    const t = k / 200, m = surfaceMix(across.fold, t), f = surfaceStyle(across.fold, t).front;
    assert.ok(m >= 0 && m <= 1 && m >= prev - 1e-12, `mix ${m} at t = ${t} after ${prev}`);
    for (let c = 0; c < 3; c++) maxStep = Math.max(maxStep, Math.abs(f[c] - prevFront[c]) / Math.abs(SURFACE_BACK[c] - SURFACE_FRONT[c] || 1));
    if (from === null && m > 0.05) from = t;
    if (to === null && m > 0.95) to = t;
    prev = m; prevFront = f;
  }
  assert.ok(maxStep <= 0.25, `the colour changes by at most a quarter of the swap per 1/200 of the fold (${maxStep.toFixed(3)})`);
  assert.ok(from !== null && to !== null && to - from >= 6 / 200, `the swap is spread over t ${from} .. ${to}`);
  // the hinge folds and *x say when too (final fix, 10 Nov: until then a hinge fold had no mirroredAt, the app swapped
  // at every t and this test said so, so the flat tile turned pale the moment the cut crossed a mirror,
  // qa/final-verify-owner-asks/mirror-22s-t0-after.png; *x had neither, and its band changed colour at the crossing,
  // crossing-sx-largest.png). Each group's preset 0, the seed reflected in the nearest mirror of the group: front at
  // t = 0 as in the plane, swapped at t = 1, blended without a jump; the preset's own tile never swaps.
  for (const id of ['22*', '2*22', '3*3', '4*2', '*x', '**']) {
    const h = BY_ID[id], hp = h.presets[0], anchor = (hp.anchor || hp.seed).slice(), size = Math.sqrt(h.domainArea);
    const { mirrors } = symmetryElements(h, hp.seed[0], hp.seed[1], 2 * size);
    let best = null;
    for (const L of mirrors) { const nx = -L.uy, ny = L.ux, d = (hp.seed[0] - L.px) * nx + (hp.seed[1] - L.py) * ny; if (!best || Math.abs(d) < Math.abs(best.d)) best = { d, nx, ny }; }
    const seed = [hp.seed[0] - 2 * best.d * best.nx, hp.seed[1] - 2 * best.d * best.ny];
    const below = buildScene(h, { seed, metric: hp.metric, anchor }), own = buildScene(h, { seed: hp.seed, metric: hp.metric, anchor });
    assert.equal(below.fold.mirrored, true, `${id}: the seed's mirror image is mirrored`);
    assert.equal(typeof below.fold.mirroredAt, 'function', `${id}: says when it swaps`);
    assert.deepEqual(surfaceStyle(below.fold, 0), plain, `${id}: flat, the tile shows its front, as in the plane`);
    assert.deepEqual(surfaceStyle(below.fold, 1), swapped, `${id}: closed, swapped`);
    for (const t of [0, 0.5, 1]) assert.deepEqual(surfaceStyle(own.fold, t), plain, `${id}: the preset's own tile at t = ${t}`);
    let p2 = 0, f2 = SURFACE_FRONT, step = 0, a0 = null, a1 = null;
    for (let k = 1; k <= 200; k++) {
      const t = k / 200, m = surfaceMix(below.fold, t), f = surfaceStyle(below.fold, t).front;
      assert.ok(m >= 0 && m <= 1 && m >= p2 - 1e-12, `${id}: mix ${m} at t = ${t} after ${p2}`);
      for (let c = 0; c < 3; c++) step = Math.max(step, Math.abs(f[c] - f2[c]) / Math.abs(SURFACE_BACK[c] - SURFACE_FRONT[c] || 1));
      if (a0 === null && m > 0.05) a0 = t;
      if (a1 === null && m > 0.95) a1 = t;
      p2 = m; f2 = f;
    }
    assert.ok(step <= 0.25, `${id}: the colour changes by at most a quarter of the swap per 1/200 (${step.toFixed(3)})`);
    assert.ok(a0 !== null && a1 !== null && a1 - a0 >= 6 / 200, `${id}: the swap is spread over t ${a0} .. ${a1}`);
  }
  // anything that is not a fold or not a number swaps nothing; fold.mirrored without mirroredAt swaps at every t
  for (const t of [0, 0.5, 1]) assert.equal(surfaceMix({ mirrored: true }, t), 1);
  for (const f of [null, undefined, {}, { mirrored: 1 }, { mirroredAt: () => NaN }, { mirroredAt: () => -3 }]) assert.equal(surfaceMix(f, 0.5), 0);
  assert.equal(surfaceMix({ mirroredAt: () => 7 }, 0.5), 1);
});

test('app: the cross-cap\'s creases fade in a window that follows the fold\'s own times (from half the time its flaps take to its middle stop; notes/crosscap-round3.md) — a drag keeps the window', () => {
  const g = BY_ID['22x'];
  const windows = new Map();
  const rnd = prng(2202);
  for (const p of g.presets) {
    const anchor = (p.anchor || p.seed).slice();
    const seeds = [p.seed];
    for (let k = 0; k < 6; k++) seeds.push([g.center[0] + (2 * rnd() - 1) * 0.8 * g.viewHalf, g.center[1] + (2 * rnd() - 1) * 0.8 * g.viewHalf]);
    let first = null;
    for (const seed of seeds) for (const amp of [0, 1]) {
      // (recut: false: the cross-cap's own fold, every cut as one sheet; re-cut first has fold.creaseAlpha, test/recut.test.js)
      const s = buildScene(g, { seed, metric: p.metric, amp, anchor, recut: false });
      const T = s.fold.times, w = creaseFade('crosscap', s.fold), label = `${p.name} seed (${seed.map((v) => v.toFixed(3))}) amp ${amp}`;
      assert.deepEqual(w, [0.5 * T.hingeEnd, T.halfEnd], label);
      if (!first) first = w; else assert.deepEqual(w, first, `${label}: the window depends on the anchor alone`);
      assert.equal(creaseAlpha('crosscap', 0, s.fold), 1, label);
      assert.equal(creaseAlpha('crosscap', w[0], s.fold), 1, label);
      assert.equal(creaseAlpha('crosscap', T.halfEnd, s.fold), 0, `${label}: gone at the middle stop`);
      let prev = 1;
      for (let k = 1; k <= 200; k++) {
        const a = creaseAlpha('crosscap', k / 200, s.fold);
        assert.ok(a >= 0 && a <= prev + 1e-12 && prev - a < 0.06, `${label}: alpha ${a} at ${k / 200} after ${prev}`);
        prev = a;
      }
      mapScene(s, T.halfEnd);
      assert.ok(sceneLines(s, 1).every((l) => !(l.dashed && l.width === WIDTHS.crease)), `${label}: no crease is drawn at the middle stop`);
    }
    windows.set(p.name, first);
  }
  assert.ok(windows.get('Bowl')[1] < 0.3 && windows.get('Pocket')[1] > 0.45, `the Bowl (no crease to fold) fades early: ${JSON.stringify([...windows])}`);
  // without usable times, and for the other folds: the fixed windows
  assert.deepEqual(creaseFade('crosscap', null), creaseFade('crosscap', { times: { hingeEnd: NaN, halfEnd: 0.4 } }));
  assert.deepEqual(creaseFade('hinge', { times: { hingeEnd: 0.1, halfEnd: 0.2 } }), creaseFade('hinge'));
  assert.equal(creaseFade('torus'), null);
});

test('app: the frames of a drag use the draft mesh (notes/core-round3.md #12) — about half the triangles, the same boundary samples, and the full mesh built when the drag ends draws the outline where the draft did', () => {
  const rnd = prng(1212);
  let scenes = 0, worst = 0, ratio = 0;
  for (const g of GROUPS) {
    const p = g.presets[0], anchor = (p.anchor || p.seed).slice();
    if (g.fold === 'snowflake') {
      const s = buildScene(g, { seed: p.seed, metric: p.metric, anchor, draft: true });
      assert.equal(s.draft, false, `${g.id}: a kaleidoscope takes no drags, so no draft`);
      continue;
    }
    const seeds = [p.seed];
    for (let k = 0; k < 3; k++) seeds.push([g.center[0] + (2 * rnd() - 1) * 0.8 * g.viewHalf, g.center[1] + (2 * rnd() - 1) * 0.8 * g.viewHalf]);
    for (const seed of seeds) for (const amp of [0, 1]) {
      const label = `${g.id} seed (${seed.map((v) => v.toFixed(3))}) amp ${amp}`;
      const D = buildScene(g, { seed, metric: p.metric, amp, anchor, draft: true });
      const F = buildScene(g, { seed, metric: p.metric, amp, anchor });
      scenes++;
      assert.ok(D.draft === true && F.draft === false, label);
      assert.ok(D.M.motifTint && D.M.motifCut.bad === 0, `${label}: the draft carries the filled comma too`);
      const r = (D.M.tri.length / 3) / (F.M.tri.length / 3);
      ratio = Math.max(ratio, r);
      assert.ok(r < 0.75, `${label}: the draft has ${(100 * r).toFixed(0)} % of the triangles`);
      assert.equal(D.edges.length, F.edges.length, label);
      D.edges.forEach((e, i) => assert.deepEqual(e.pts, F.edges[i].pts, `${label}: edge ${i}: the same boundary samples`));
      for (const t of [0.25, 0.5, 0.75, 1]) {
        mapScene(D, t); mapScene(F, t);
        assert.equal(D.nonFinite + F.nonFinite, 0, `${label} t ${t}: finite`);
        D.edges.forEach((e, i) => {
          const a = e.out, b = F.edges[i].out;
          for (let j = 0; j < a.length; j += 3) worst = Math.max(worst, Math.hypot(a[j] - b[j], a[j + 1] - b[j + 1], a[j + 2] - b[j + 2]) / F.size);
        });
        if (t === 1) { const gap = seamGap(D); if (gap !== null) assert.ok(gap < 1e-6, `${label}: the draft's seams close (${gap})`); }
      }
    }
  }
  assert.ok(worst < 1e-3, `at the end of a drag the outline moves ${worst.toExponential(2)} tile sizes (bound 1e-3)`);
  assert.ok(scenes >= 13 * 8, `${scenes} draft scenes`);
});
