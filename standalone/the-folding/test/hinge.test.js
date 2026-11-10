// Tests for src/folds/hinge.js (SPEC 5.3 requirements 1-4 and SPEC 5.4): the eight hinge groups x every preset x
// 20 seeded-random seeds x amp in {0, 1}. Every fold is built once; each check records its failures under a name,
// and the tests below assert that each list is empty. HINGE_SEEDS widens the sweep: HINGE_SEEDS=100 node --test test/hinge.test.js
// The last section tests the anchor contract of SPEC 7 (opts.anchor): ANCHOR_SEEDS (default 30) random seeds per
// anchor, every hinge group, every preset as the anchor, amp 0 and 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID, elementsNear, symmetryElements } from '../src/groups.js';
import { apply, inverse, det, polyArea, refl, compose } from '../src/geom.js';
import { makeWarp, buildDomain, clampSeed } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import createFold, { hingeKinematics, hingeSchedule, FOLD_END, PUFF_START, PAGE_END, pageTurn, VIEW0, SWAP_HALF } from '../src/folds/hinge.js';

const HINGE = ['2222', '22*', '2*22', '442', '4*2', '333', '3*3', '632'];
const SEEDS = Math.max(20, +process.env.HINGE_SEEDS || 20);
const AMPS = [0, 1];
const STEPS = 200;
const PI = Math.PI;

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

function* cases(group, salt = 0) {
  for (const [i, p] of group.presets.entries()) yield { label: `${group.id} preset ${i} (${p.name})`, seed: p.seed, metric: p.metric, preset: true };
  const rnd = prng(9001 + 31 * GROUPS.indexOf(group) + 7919 * salt);
  for (let k = 0; k < SEEDS; k++) {
    const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
    yield { label: `${group.id} random seed ${k} (${seed[0].toFixed(4)}, ${seed[1].toFixed(4)})`, seed, metric: undefined, preset: false };
  }
}

const NAMES = ['api', 'root', 'identity', 'seams', 'seamsStayClosed', 'continuity', 'smooth', 'boundaries', 'finite', 'footprint', 'tiling', 'upward',
  'pillow', 'creases', 'height'];
const failures = Object.fromEntries(NAMES.map((k) => [k, []]));
const fail = (name, msg) => { failures[name].push(msg); };
const show = (name) => failures[name].slice(0, 6).join('\n') + (failures[name].length > 6 ? `\n... ${failures[name].length} failures` : '');
const stats = { maxBoundaryStep: 0, maxDeep: 0, minRoot: Infinity, rerooted: 0, folds: 0, maxSeam: 0, maxSeamLocate: 0, maxStep: 0, maxStepRel: 0, maxAccRel: 0, maxDepth: [0, 0], lobes: 0, dust: 0, maxCrease: 0, vertices: 0 };

// The a-priori bounds of the motion, per unit of t: the largest rates and accelerations of the two ramps theta(t)
// and beta(t), measured on the schedule itself. (The schedule test below bounds them by fixed numbers, so a jump in
// the schedule cannot hide here.)
let TH1 = 0, TH2 = 0, BE1 = 0, BE2 = 0;
{
  const N = 20000, h = 1 / N;
  let p = hingeSchedule(0), c = hingeSchedule(h);
  for (let k = 1; k < N; k++) {
    const nx = hingeSchedule((k + 1) * h);
    TH1 = Math.max(TH1, Math.abs(c[0] - p[0]) / h, Math.abs(nx[0] - c[0]) / h); BE1 = Math.max(BE1, Math.abs(c[1] - p[1]) / h, Math.abs(nx[1] - c[1]) / h);
    TH2 = Math.max(TH2, Math.abs(nx[0] - 2 * c[0] + p[0]) / (h * h)); BE2 = Math.max(BE2, Math.abs(nx[1] - 2 * c[1] + p[1]) / (h * h));
    p = c; c = nx;
  }
}

function inPolygon(poly, x, y, eps) {
  // convex polygon in either orientation
  let pos = false, neg = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const s = ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s > eps) pos = true;
    if (s < -eps) neg = true;
  }
  return !(pos && neg);
}

function checkFold(group, domain, mesh, label, amp, isPreset) {
  const size = Math.sqrt(group.domainArea);
  const { n, xy, cell, tri, m, triCell, cells } = mesh;
  const P = cells.length;
  const fold = createFold(group, domain, mesh, {});
  const kin = fold.kinematics;
  stats.folds++; stats.vertices += n;
  // the tree as the fold sees it: rooted at kin.root, the main piece of the seed's own kaleidoscope cell
  const depthOf = kin.depth;
  const depthMax = Math.max(1, ...depthOf);
  stats.maxDepth[amp ? 1 : 0] = Math.max(stats.maxDepth[amp ? 1 : 0], ...depthOf);
  const areaT0 = polyArea(group.kaleido.cell);
  for (let i = 0; i < P; i++) {
    if (depthOf[i] >= 2) { stats.lobes++; stats.maxDeep = Math.max(stats.maxDeep, cells[i].area / areaT0); }
    if (i !== kin.root && kin.parent[i] < 0) fail('root', `${label}: piece ${i} is not attached to the tree of the fold`);
    else if (i !== kin.root && depthOf[i] !== depthOf[kin.parent[i]] + 1) fail('root', `${label}: depth of piece ${i}`);
    // the hinge tree of the fold is the hinge tree of the mesh (the same pairs), only rooted elsewhere
    if (i !== kin.root && cells[i].parent !== kin.parent[i] && cells[kin.parent[i]].parent !== i) fail('root', `${label}: pieces ${i} and ${kin.parent[i]} are not hinged in the mesh`);
  }
  if (kin.parent[kin.root] !== -1 || depthOf[kin.root] !== 0) fail('root', `${label}: root record`);
  if (amp === 0 && kin.root !== mesh.root) fail('root', `${label}: with a straight cut the fixed piece must be mesh.root`);
  // the fixed piece lies in the kaleidoscope cell of the (nudged) seed and is the main part of that cell
  {
    const gi = inverse(cells[kin.root].g), u = apply(gi, domain.seed[0] + 1e-6 * 0.3713, domain.seed[1] + 1e-6 * 0.9285);
    if (!inPolygon(group.kaleido.cell, u[0], u[1], 1e-12)) fail('root', `${label}: the fixed piece is not in the cell of the seed`);
    stats.minRoot = Math.min(stats.minRoot, cells[kin.root].area / areaT0);
    if (group.fold === 'hinge' && !(cells[kin.root].area > (amp ? 0.6 : 1 - 1e-9) * areaT0)) fail('root', `${label}: the fixed piece covers only ${cells[kin.root].area / areaT0} of its cell`);
    if (amp && kin.root !== mesh.root) stats.rerooted++;
  }
  const out = [0, 0, 0], o2 = [0, 0, 0], q = [0, 0];
  const diam = Math.hypot(mesh.bbox[2] - mesh.bbox[0], mesh.bbox[3] - mesh.bbox[1]);

  // ---- the interface
  // fold.mesh: the same vertices, triangles and pieces; the boundary resampled finer, old samples kept in place
  const fm = fold.mesh;
  if (fm.xy !== mesh.xy || fm.tri !== mesh.tri || fm.cell !== mesh.cell || fm.cells !== mesh.cells || fm.creases !== mesh.creases || fm.locate !== mesh.locate || fm.n !== mesh.n) fail('api', `${label}: fold.mesh does not share the arrays of the mesh`);
  if (fm.boundary.length !== mesh.boundary.length) fail('api', `${label}: fold.mesh.boundary length`);
  else {
    let finest = 0;
    fm.boundary.forEach((b, i) => {
      const b0 = mesh.boundary[i], e = domain.edges[i], M = b.cells.length - 1, m0 = b0.cells.length - 1, k = M / m0;
      if (b.edge !== i || b.cls !== b0.cls || b.kind !== b0.kind || !(b.pts instanceof Float32Array) || !(b.cells instanceof Uint16Array) || b.pts.length !== 2 * (M + 1)) { fail('api', `${label}: fold.mesh.boundary[${i}] record`); return; }
      if (!Number.isInteger(k) || k < 1 || M % 2) { fail('api', `${label}: edge ${i} resampled ${m0} -> ${M} steps`); return; }
      if (fm.boundary[e.partner].cells.length !== b.cells.length) fail('api', `${label}: partners of edge ${i} have different sample counts`);
      for (let j = 0; j <= m0; j++) if (b.pts[2 * k * j] !== b0.pts[2 * j] || b.pts[2 * k * j + 1] !== b0.pts[2 * j + 1] || b.cells[k * j] !== b0.cells[j]) { fail('api', `${label}: edge ${i} lost its old sample ${j}`); break; }
      for (let j = 0; j <= M; j++) {
        const p = domain.edgePoint(i, j / M);
        if (Math.hypot(p[0] - b.pts[2 * j], p[1] - b.pts[2 * j + 1]) > 1e-6 || b.cells[j] >= P) { fail('api', `${label}: sample ${j} of edge ${i} is not on the edge`); break; }
        if (j > 0) finest = Math.max(finest, Math.hypot(b.pts[2 * j] - b.pts[2 * j - 2], b.pts[2 * j + 1] - b.pts[2 * j - 1]));
      }
    });
    stats.maxBoundaryStep = Math.max(stats.maxBoundaryStep, finest / size);
    if (!(finest < size / 60)) fail('api', `${label}: boundary samples ${finest / size} tile sizes apart`);
  }
  if (!Array.isArray(fold.stops) || fold.stops.length < 2 || fold.stops[0].t !== 0 || fold.stops[fold.stops.length - 1].t !== 1 ||
    fold.stops.some((s, i) => typeof s.label !== 'string' || (i > 0 && !(s.t > fold.stops[i - 1].t)))) fail('api', `${label}: stops`);
  if (!(fold.duration >= 4 && fold.duration <= 7)) fail('api', `${label}: duration ${fold.duration}`);
  if (typeof fold.at(0.3) !== 'function' || fold.at(0.3)(xy[0], xy[1], cell[0], out) !== out) fail('api', `${label}: at(t) must return fn(x, y, cell, out) -> out`);

  // ---- 1. at(0) is the identity, exactly
  for (const t0 of [0, -0, -0.25]) {
    const F = fold.at(t0);
    for (let v = 0; v < n; v++) {
      out[0] = out[1] = out[2] = NaN;
      F(xy[2 * v], xy[2 * v + 1], cell[v], out);
      if (out[0] !== xy[2 * v] || out[1] !== xy[2 * v + 1] || !Object.is(out[2], 0)) { fail('identity', `${label}: at(${t0}) moves vertex ${v}: ${out}`); break; }
    }
    for (const b of fold.mesh.boundary) {
      for (let k = 0; k < b.cells.length; k++) {
        F(b.pts[2 * k], b.pts[2 * k + 1], b.cells[k], out);
        if (out[0] !== b.pts[2 * k] || out[1] !== b.pts[2 * k + 1] || !Object.is(out[2], 0)) { fail('identity', `${label}: at(${t0}) moves a boundary point`); break; }
      }
    }
  }

  // ---- 2. seams close at t = 1 (and stay closed from FOLD_END on, while the shape puffs)
  let cx = 0, cy = 0;
  for (const p of domain.poly) { cx += p[0] / domain.poly.length; cy += p[1] / domain.poly.length; }
  const inwardPiece = (x, y) => {
    // the piece of the point nudged 1e-6 toward the interior of the tile (through straight coordinates)
    domain.warp.inv(x, y, q);
    const dx = cx - q[0], dy = cy - q[1], l = Math.hypot(dx, dy) || 1;
    domain.warp.fwd(q[0] + (1e-6 * dx) / l, q[1] + (1e-6 * dy) / l, q);
    return mesh.locate(q[0], q[1]);
  };
  const seamGap = (F, viaLocate) => {
    let gap = 0;
    for (let i = 0; i < domain.edges.length; i++) {
      const e = domain.edges[i];
      if (e.kind !== 'cut') continue;
      const bi = fold.mesh.boundary[i], bj = fold.mesh.boundary[e.partner], k = bi.cells.length, gi = inverse(e.g);
      for (let j = 0; j < k; j++) {
        const x = bi.pts[2 * j], y = bi.pts[2 * j + 1];
        apply(gi, x, y, q);
        // the partner's sample with the matching index is the same point of the plane
        const jj = e.rev ? k - 1 - j : j;
        if (Math.hypot(q[0] - bj.pts[2 * jj], q[1] - bj.pts[2 * jj + 1]) > 2e-6) gap = NaN;
        const x2 = q[0], y2 = q[1];
        const c1 = viaLocate ? inwardPiece(x, y) : bi.cells[j];
        const c2 = viaLocate ? inwardPiece(x2, y2) : bj.cells[e.rev ? k - 1 - j : j];
        F(x, y, c1, out); F(x2, y2, c2, o2);
        const d = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]);
        if (!(d <= gap)) gap = d;       // NaN sticks
      }
    }
    return gap;
  };
  const F1 = fold.at(1);
  const g1 = seamGap(F1, false), g2 = seamGap(F1, true);
  stats.maxSeam = Math.max(stats.maxSeam, g1 / size); stats.maxSeamLocate = Math.max(stats.maxSeamLocate, g2 / size);
  if (!(g1 < 1e-6 * size)) fail('seams', `${label}: seam gap ${g1} at t = 1 (pieces of the boundary samples)`);
  if (!(g2 < 1e-6 * size)) fail('seams', `${label}: seam gap ${g2} at t = 1 (pieces from mesh.locate of the nudged points)`);
  for (const t of [FOLD_END, 0.8, 0.93]) {
    const g = seamGap(fold.at(t), false);
    if (!(g < 1e-6 * size)) fail('seamsStayClosed', `${label}: seam gap ${g} at t = ${t}`);
  }
  if (domain.classes > 0 && !(seamGap(fold.at(0.5), false) > 1e-3 * size)) fail('seamsStayClosed', `${label}: the seams are already closed at t = 0.5`);

  // ---- 3. continuity: 200 steps; the largest step is bounded by the speed of the motion, the largest second
  //         difference by its acceleration (a jump of the position or of the velocity would break one of them)
  const speed = depthMax * TH1 * (diam + kin.hMax) + BE1 * kin.hMax;
  const accel = (depthMax * TH2 + depthMax * depthMax * TH1 * TH1) * (diam + kin.hMax) + 2 * depthMax * TH1 * BE1 * kin.hMax + BE2 * kin.hMax;
  let A = new Float64Array(3 * n), B = new Float64Array(3 * n), C = new Float64Array(3 * n);
  const fill = (t, arr) => {
    const F = fold.at(t);
    let bad = 0;
    for (let v = 0, k = 0; v < n; v++, k += 3) {
      out[0] = out[1] = out[2] = NaN;
      F(xy[2 * v], xy[2 * v + 1], cell[v], out);
      if (!Number.isFinite(out[0] + out[1] + out[2])) bad++;
      arr[k] = out[0]; arr[k + 1] = out[1]; arr[k + 2] = out[2];
    }
    return bad;
  };
  const maxDiff = (a, b) => { let d = 0; for (let k = 0; k < 3 * n; k += 3) d = Math.max(d, Math.hypot(a[k] - b[k], a[k + 1] - b[k + 1], a[k + 2] - b[k + 2])); return d; };
  const maxDiff2 = (a, b, c) => { let d = 0; for (let k = 0; k < 3 * n; k += 3) d = Math.max(d, Math.hypot(a[k] - 2 * b[k] + c[k], a[k + 1] - 2 * b[k + 1] + c[k + 1], a[k + 2] - 2 * b[k + 2] + c[k + 2])); return d; };
  let worstStep = 0, worstAcc = 0, travelled = 0, nonFinite = fill(0, A);
  nonFinite += fill(1 / STEPS, B);
  worstStep = maxDiff(A, B); travelled += worstStep;
  for (let k = 2; k <= STEPS; k++) {
    nonFinite += fill(k / STEPS, C);
    const d = maxDiff(B, C), a2 = maxDiff2(A, B, C);
    travelled += d;
    if (d > worstStep) worstStep = d;
    if (a2 > worstAcc) worstAcc = a2;
    const T = A; A = B; B = C; C = T;
  }
  stats.maxStep = Math.max(stats.maxStep, worstStep / diam);
  stats.maxStepRel = Math.max(stats.maxStepRel, worstStep / (speed / STEPS));
  stats.maxAccRel = Math.max(stats.maxAccRel, worstAcc / (accel / (STEPS * STEPS)));
  if (nonFinite) fail('finite', `${label}: ${nonFinite} non-finite positions over ${STEPS} steps`);
  if (!(worstStep <= (1.02 * speed) / STEPS)) fail('continuity', `${label}: a step of ${worstStep} (bound ${speed / STEPS})`);
  if (!(worstStep <= 0.05 * diam)) fail('continuity', `${label}: a step of ${(worstStep / diam).toFixed(4)} tile diameters`);
  if (P > 1 && !(travelled > 0.2 * size)) fail('continuity', `${label}: nothing moves (${travelled})`);
  if (!(worstAcc <= (1.05 * accel) / (STEPS * STEPS))) fail('smooth', `${label}: second difference ${worstAcc} (bound ${accel / (STEPS * STEPS)})`);
  // at the ends and at the two inner times: positions and velocities are continuous at a scale of 1e-5
  const E = 1e-5;
  for (const t0 of [0, PUFF_START, FOLD_END, 1]) {
    const ta = Math.max(0, t0 - E), tb = Math.min(1, t0 + E);
    nonFinite = fill(ta, A) + fill(t0, B) + fill(tb, C);
    if (nonFinite) fail('finite', `${label}: non-finite positions next to t = ${t0}`);
    const d = Math.max(maxDiff(A, B), maxDiff(B, C));
    if (!(d <= 1.02 * speed * E + 1e-13)) fail('boundaries', `${label}: a jump of ${d} at t = ${t0} (bound ${speed * E})`);
    if (t0 > 0 && t0 < 1) {
      const a2 = maxDiff2(A, B, C);
      if (!(a2 <= 1.05 * accel * E * E + 1e-13)) fail('boundaries', `${label}: the velocity jumps at t = ${t0}: second difference ${a2} (bound ${accel * E * E})`);
    }
  }
  // 4. more exact times: just inside the ends, the inner times themselves, and beyond the ends
  for (const t of [1e-300, 1e-12, 1e-6, PUFF_START, FOLD_END, 1 - 1e-12, 1, 1.5, Infinity]) {
    if (fill(t, A)) fail('finite', `${label}: non-finite positions at t = ${t}`);
    const F = fold.at(t);
    for (const b of fold.mesh.boundary) {
      for (let k = 0; k < b.cells.length; k++) {
        F(b.pts[2 * k], b.pts[2 * k + 1], b.cells[k], out);
        if (!Number.isFinite(out[0] + out[1] + out[2])) { fail('finite', `${label}: non-finite boundary point at t = ${t}`); break; }
      }
    }
  }
  fill(1e-12, A); fill(0, B);
  if (maxDiff(A, B) > 1e-9) fail('boundaries', `${label}: at(1e-12) is not next to at(0)`);
  fill(1 - 1e-12, A); fill(1, B);
  if (maxDiff(A, B) > 1e-9) fail('boundaries', `${label}: at(1 - 1e-12) is not next to at(1)`);

  // ---- folded flat (theta = pi, beta = 0): everything lies on the root cell, even depth face up, odd depth face down
  const flat = kin.pose(PI, 0);
  const rootPoly = cells[kin.root].poly;
  const X = new Float64Array(2 * n);
  for (let v = 0; v < n; v++) {
    flat(xy[2 * v], xy[2 * v + 1], cell[v], out);
    X[2 * v] = out[0]; X[2 * v + 1] = out[1];
    if (Math.abs(out[2]) > 1e-9) { fail('footprint', `${label}: vertex ${v} is at height ${out[2]} when folded flat`); break; }
    if (!inPolygon(rootPoly, out[0], out[1], 1e-6)) { fail('footprint', `${label}: vertex ${v} (piece ${cell[v]}) leaves the root cell when folded flat`); break; }
  }
  // per triangle, with the triangle's own piece (a vertex on a crease is shared by two pieces)
  const pt = [[0, 0], [0, 0], [0, 0]];
  const sheetArea = [0, 0];
  const folded = new Float64Array(6 * m);
  let notRigid = false, wrongWay = false;
  for (let t = 0; t < m; t++) {
    for (let e = 0; e < 3; e++) {
      const v = tri[3 * t + e];
      flat(xy[2 * v], xy[2 * v + 1], triCell[t], out);
      pt[e][0] = out[0]; pt[e][1] = out[1];
      folded[6 * t + 2 * e] = out[0]; folded[6 * t + 2 * e + 1] = out[1];
    }
    const a2 = (pt[1][0] - pt[0][0]) * (pt[2][1] - pt[0][1]) - (pt[1][1] - pt[0][1]) * (pt[2][0] - pt[0][0]);
    const odd = depthOf[triCell[t]] & 1;
    sheetArea[odd] += Math.abs(a2) / 2;
    const flatArea2 = (xy[2 * tri[3 * t + 1]] - xy[2 * tri[3 * t]]) * (xy[2 * tri[3 * t + 2] + 1] - xy[2 * tri[3 * t] + 1]) - (xy[2 * tri[3 * t + 1] + 1] - xy[2 * tri[3 * t] + 1]) * (xy[2 * tri[3 * t + 2]] - xy[2 * tri[3 * t]]);
    // a vertex on a crease can sit a Float32 rounding (1e-7) across it, and then lands mirrored: areas agree to ~1e-8
    if (!notRigid && Math.abs(Math.abs(a2) - Math.abs(flatArea2)) > 1e-7 * size) { notRigid = true; fail('footprint', `${label}: triangle ${t} changes its area when folded flat (not rigid): ${Math.abs(a2) / 2} vs ${Math.abs(flatArea2) / 2}`); }
    if (!wrongWay && Math.abs(a2) > 1e-6 * size * size && (a2 > 0) === !!odd) { wrongWay = true; fail('footprint', `${label}: triangle ${t} of a depth-${depthOf[triCell[t]]} piece faces the wrong way when folded flat`); }
  }
  // same-parity pieces tile T without overlap: each sheet has the area of T, and random points of the root cell
  // are covered exactly once by each sheet
  const areaT = polyArea(group.kaleido.cell);
  const tolA = (amp ? 2e-3 : 1e-6) * areaT;
  if (Math.abs(sheetArea[0] - areaT) > tolA || Math.abs(sheetArea[1] - areaT) > tolA) fail('tiling', `${label}: sheet areas ${sheetArea} for a cell of ${areaT}`);
  if (isPreset || amp === 0) {
    const rnd = prng(77 + n);
    const T0 = rootPoly;
    let multi = 0, none = 0;
    const SAMPLES = isPreset ? 160 : 40;
    for (let s = 0; s < SAMPLES; s++) {
      // a random point of the root cell (a triangle or a parallelogram), kept 1 % of the size away from its sides
      let a = rnd(), b = rnd();
      let px, py;
      if (T0.length === 3) { if (a + b > 1) { a = 1 - a; b = 1 - b; } px = T0[0][0] + a * (T0[1][0] - T0[0][0]) + b * (T0[2][0] - T0[0][0]); py = T0[0][1] + a * (T0[1][1] - T0[0][1]) + b * (T0[2][1] - T0[0][1]); }
      else { px = T0[0][0] + a * (T0[1][0] - T0[0][0]) + b * (T0[3][0] - T0[0][0]); py = T0[0][1] + a * (T0[1][1] - T0[0][1]) + b * (T0[3][1] - T0[0][1]); }
      const count = [0, 0];
      let nearEdge = false;
      for (let t = 0; t < m && !nearEdge; t++) {
        const x0 = folded[6 * t], y0 = folded[6 * t + 1], x1 = folded[6 * t + 2], y1 = folded[6 * t + 3], x2 = folded[6 * t + 4], y2 = folded[6 * t + 5];
        let e0 = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0), e1 = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1), e2 = (x0 - x2) * (py - y2) - (y0 - y2) * (px - x2);
        const ar = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
        if (ar < 0) { e0 = -e0; e1 = -e1; e2 = -e2; }
        const tolE = 1e-7 * size * size;
        if (e0 > tolE && e1 > tolE && e2 > tolE) count[depthOf[triCell[t]] & 1]++;
        else if (e0 > -tolE && e1 > -tolE && e2 > -tolE && Math.abs(ar) > 1e-12) nearEdge = true;   // on an edge of the mesh: an undecidable sample
      }
      if (nearEdge) continue;
      if (count[0] > 1 || count[1] > 1) multi++;
      // with a wavy cut the rim of the mesh is a polygon inscribed in the true boundary: slits of up to 1 % of the size are expected
      if ((count[0] === 0 || count[1] === 0) && amp === 0) none++;
    }
    if (multi) fail('tiling', `${label}: ${multi} of ${SAMPLES} points of the cell are covered twice by one sheet (pieces overlap when folded)`);
    if (none) fail('tiling', `${label}: ${none} of ${SAMPLES} points of the cell are not covered by a sheet`);
  }

  // ---- folding goes toward +z: without the puff nothing ever dips below the plane at the start, and the first
  //      generation of flaps never does
  for (const th of [0.05, 0.3, PI / 2, 0.9 * PI]) {
    const F = kin.pose(th, 0);
    let top = -Infinity, low = 0, lowAt = -1;
    for (let v = 0; v < n; v++) {
      F(xy[2 * v], xy[2 * v + 1], cell[v], out);
      top = Math.max(top, out[2]);
      if ((th <= 0.3 || depthOf[cell[v]] <= 1) && out[2] < low) { low = out[2]; lowAt = v; }
    }
    // (a corner vertex a rounding error outside its piece moves as the piece two creases away would: 1e-9)
    if (low < -1e-7 * size) fail('upward', `${label}: vertex ${lowAt} (depth ${depthOf[cell[lowAt]]}) is at z = ${low} for theta = ${th}`);
    if (P > 1 && !(top > 1e-4 * size)) fail('upward', `${label}: nothing rises for theta = ${th}`);
  }
  // with the puff: the root sheet goes down (it is the outside of the finished shape), and at the end the two sheets
  // lie on opposite sides of the plane
  for (let v = 0; v < n; v++) {
    F1(xy[2 * v], xy[2 * v + 1], cell[v], out);
    const odd = depthOf[cell[v]] & 1;
    if (odd ? out[2] < -0.01 * kin.hMax : out[2] > 0.01 * kin.hMax) { fail('upward', `${label}: at t = 1 vertex ${v} of a depth-${depthOf[cell[v]]} piece is at z = ${out[2]}`); break; }
  }

  // ---- pillow coordinates: unpillow(pillow(p)) = pose(pi, 1)(p); ranges; the greatest height
  let zTop = 0, badRange = '', badUn = 0, tooHigh = 0, wrongSheet = 0;
  for (let v = 0; v < n; v++) {
    const x = xy[2 * v], y = xy[2 * v + 1];
    kin.pillow(x, y, cell[v], o2);
    if (!(Math.abs(o2[0]) <= 1 + 1e-6 && Math.abs(o2[1]) <= 1 + 1e-6 && Math.abs(o2[2]) <= kin.zMax * (1 + 1e-6))) badRange = String(o2);
    zTop = Math.max(zTop, Math.abs(o2[2]));
    if (Math.abs(o2[2]) > 0.02 * kin.zMax && (o2[2] > 0) !== !!(depthOf[cell[v]] & 1)) wrongSheet++;
    kin.unpillow(o2[0], o2[1], o2[2], o2);
    F1(x, y, cell[v], out);
    badUn = Math.max(badUn, Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]));
    tooHigh = Math.max(tooHigh, Math.abs(out[2]) - kin.hMax);
  }
  if (badRange) fail('pillow', `${label}: pillow coordinates out of range: ${badRange}`);
  if (wrongSheet) fail('pillow', `${label}: ${wrongSheet} vertices have Z on the wrong side for their depth`);
  if (badUn > 1e-12) fail('pillow', `${label}: unpillow(pillow(p)) differs from at(1)(p) by ${badUn}`);
  if (tooHigh > 1e-6 * kin.hMax) fail('height', `${label}: |z| exceeds hMax ${kin.hMax} by ${tooHigh}`);
  if (!(zTop > 0.97 * kin.zMax)) fail('height', `${label}: the mesh only reaches ${zTop / kin.zMax} of the greatest height`);

  // ---- a point next to a crease gets the same position from both pieces, at every t (the crease is a hinge, and a
  //      point across it moves as the piece across it does)
  const times = [0.2, 0.5, FOLD_END, 0.9, 1];
  const Fs = times.map((t) => fold.at(t));
  for (const cr of mesh.creases) {
    const [ax, ay, bx, by] = cr.pts;
    const len = Math.hypot(bx - ax, by - ay);
    if (!(len > 0)) continue;
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    // only where both pieces really border the point: skip the padded hinges of micro-lobes
    if (cells[cr.b].area < 1e-6 * group.domainArea || len < 2e-3 * size) continue;
    for (const s of [0.5, 0.31]) {
      const mx = ax + s * (bx - ax), my = ay + s * (by - ay);
      for (const off of [0, 1e-9, -1e-9, 3e-7, -3e-7, 1e-5, -1e-5]) {
        const x = mx + off * nx, y = my + off * ny;
        for (let i = 0; i < times.length; i++) {
          Fs[i](x, y, cr.a, out); Fs[i](x, y, cr.b, o2);
          const d = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]);
          stats.maxCrease = Math.max(stats.maxCrease, d / size); stats.dust++;
          if (!(d < 1e-7 * size)) { fail('creases', `${label}: a point ${off} off the crease of pieces ${cr.a} | ${cr.b} is ${d} apart in the two pieces at t = ${times[i]}`); break; }
        }
      }
    }
  }
}

for (const id of HINGE) {
  const group = BY_ID[id];
  for (const amp of AMPS) {
    const warp = makeWarp(group, amp);
    for (const c of cases(group)) {
      const label = `${c.label} amp ${amp}`;
      try {
        const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp });
        const mesh = buildMesh(group, domain);
        checkFold(group, domain, mesh, label, amp, c.preset);
      } catch (err) {
        fail('api', `${label}: threw ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`);
      }
    }
  }
}

test('hinge: the fold interface — mesh, stops with 0 and 1, duration, at(t) -> fn(x, y, cell, out)', () => assert.equal(failures.api.length, 0, show('api')));
test('hinge: the fixed piece is the main piece of the seed\'s cell (mesh.root for a straight cut); the tree is the mesh\'s, re-rooted', () => assert.equal(failures.root.length, 0, show('root')));
test('hinge 1: at(0) is the identity, exactly (vertices and boundary samples)', () => assert.equal(failures.identity.length, 0, show('identity')));
test('hinge 2: seams close at t = 1 — glued boundary points coincide within 1e-6 tile sizes (two ways of choosing the pieces)', () => assert.equal(failures.seams.length, 0, show('seams')));
test('hinge 2b: the seams are closed from FOLD_END on (the shape only puffs), and open before', () => assert.equal(failures.seamsStayClosed.length, 0, show('seamsStayClosed')));
test('hinge 3: continuity — over 200 steps every step is within the speed bound of the motion', () => assert.equal(failures.continuity.length, 0, show('continuity')));
test('hinge 3b: smoothness — second differences within the acceleration bound (no jump of the velocity)', () => assert.equal(failures.smooth.length, 0, show('smooth')));
test('hinge 3c: no jump of position or velocity at t = 0, PUFF_START, FOLD_END, 1 (steps of 1e-5)', () => assert.equal(failures.boundaries.length, 0, show('boundaries')));
test('hinge 4: no NaN / Infinity for any t, including the exact stage boundaries and beyond the ends', () => assert.equal(failures.finite.length, 0, show('finite')));
test('hinge: folded flat, every piece lies on the root cell — rigid, even depth face up, odd depth face down', () => assert.equal(failures.footprint.length, 0, show('footprint')));
test('hinge: folded flat, the pieces of each sheet tile the cell without overlap', () => assert.equal(failures.tiling.length, 0, show('tiling')));
test('hinge: the fold goes toward +z; at t = 1 the root sheet is below the plane, the other sheet above', () => assert.equal(failures.upward.length, 0, show('upward')));
test('hinge: pillow coordinates — ranges, unpillow(pillow(p)) = at(1)(p)', () => assert.equal(failures.pillow.length, 0, show('pillow')));
test('hinge: the height stays within hMax and the mesh reaches it', () => assert.equal(failures.height.length, 0, show('height')));
test('hinge: a point next to a crease moves the same whichever of the two pieces it is given', () => assert.equal(failures.creases.length, 0, show('creases')));

test('hinge: the sweep really ran, and the wavy cut produced pieces of depth 2', () => {
  assert.equal(stats.folds, HINGE.reduce((s, id) => s + AMPS.length * (BY_ID[id].presets.length + SEEDS), 0));
  assert.equal(stats.maxDepth[0], 1, 'with a straight cut the root piece is the whole cell and every other piece is hinged to it');
  assert.ok(stats.maxDepth[1] >= 2 && stats.lobes > 20, `depth with a wavy cut ${stats.maxDepth[1]}, pieces of depth >= 2: ${stats.lobes}`);
  assert.ok(stats.dust > 1000, `crease samples: ${stats.dust}`);
  // with the fold's own root every piece of depth >= 2 is a small lobe (it never has to swing through the others)
  assert.ok(stats.maxDeep < 0.12, `largest piece of depth >= 2: ${stats.maxDeep} of the cell`);
  assert.ok(stats.rerooted >= 1, 'some wavy tiles have the warped seed in another piece than the main one');
  console.log(`      boundary of fold.mesh: samples at most ${stats.maxBoundaryStep.toFixed(4)} tile sizes apart`);
  console.log(`      fixed piece: at least ${stats.minRoot.toFixed(3)} of its cell; differs from mesh.root in ${stats.rerooted} wavy tiles; largest piece of depth >= 2: ${stats.maxDeep.toFixed(4)} of the cell`);
  console.log(`      folds ${stats.folds} (${stats.vertices} vertices), worst seam gap / size at t = 1: ${stats.maxSeam.toExponential(1)} (boundary pieces), ` +
    `${stats.maxSeamLocate.toExponential(1)} (locate); largest step ${stats.maxStep.toFixed(4)} tile diameters = ${stats.maxStepRel.toFixed(3)} of the speed bound; ` +
    `largest second difference ${stats.maxAccRel.toFixed(3)} of the acceleration bound; max depth amp 0 / 1: ${stats.maxDepth.join(' / ')}; ` +
    `pieces of depth >= 2: ${stats.lobes}; crease samples ${stats.dust}, worst disagreement / size ${stats.maxCrease.toExponential(1)}`);
});

test('hinge: the timing — theta 0 -> pi by FOLD_END, beta 0 -> 1 from PUFF_START; the puff is well under way before the faces meet', () => {
  assert.ok(0 < PUFF_START && PUFF_START < FOLD_END && FOLD_END < 1);
  assert.deepEqual(hingeSchedule(0), [0, 0]);
  assert.deepEqual(hingeSchedule(1), [PI, 1]);
  assert.equal(hingeSchedule(FOLD_END)[0], PI);
  assert.equal(hingeSchedule(PUFF_START)[1], 0);
  let prev = hingeSchedule(0);
  for (let k = 1; k <= 2000; k++) {
    const cur = hingeSchedule(k / 2000);
    assert.ok(cur[0] >= prev[0] && cur[1] >= prev[1] && cur[0] <= PI && cur[1] <= 1, `monotonic at ${k / 2000}`);
    // the two faces coincide only if theta = pi while beta = 0: the puff is under way once the flaps are within 12
    // degrees of closing, and well under way when they close
    if (cur[0] > PI * (1 - 12 / 180)) assert.ok(cur[1] >= 0.08, `beta ${cur[1]} when theta is ${cur[0]}`);
    // and the puff does not start while the flaps are still below the vertical (it would show as a ridge along every crease)
    if (cur[1] > 0) assert.ok(cur[0] >= PI / 2, `theta ${cur[0]} when the puff starts`);
    prev = cur;
  }
  assert.ok(hingeSchedule(FOLD_END)[1] >= 0.3, `beta ${hingeSchedule(FOLD_END)[1]} when the flaps close`);
  // no jump in the schedule: rates and accelerations stay within fixed bounds (per unit of t), also across the inner times
  assert.ok(TH1 < 2.5 * PI && BE1 < 3, `rates: theta ${TH1}, beta ${BE1}`);
  assert.ok(TH2 < 12 * PI && BE2 < 14, `accelerations: theta ${TH2}, beta ${BE2}`);
  for (const t0 of [PUFF_START, FOLD_END, 0.6 * FOLD_END, PUFF_START + 0.4 * (1 - PUFF_START)]) {
    const e = 1e-7, a = hingeSchedule(t0 - e), b = hingeSchedule(t0), c = hingeSchedule(t0 + e);
    assert.ok(Math.abs(a[0] - b[0]) < 10 * e && Math.abs(c[0] - b[0]) < 10 * e && Math.abs(a[1] - b[1]) < 4 * e && Math.abs(c[1] - b[1]) < 4 * e, `continuous at ${t0}`);
    assert.ok(Math.abs(c[0] - 2 * b[0] + a[0]) < 1e-9 && Math.abs(c[1] - 2 * b[1] + a[1]) < 1e-9, `no kink at ${t0}`);
  }
});

test('hinge: the profile of every cell — greatest value of prod sqrt(d_s / D_s), heights, pillow box', () => {
  const expectZ = { '2222': 0.25, '22*': 0.5, '2*22': 1, '442': Math.sqrt(1 / 27), '4*2': 0.5, '333': Math.sqrt(1 / 27), '3*3': 0.5, '632': Math.sqrt(1 / 27) };
  for (const id of HINGE) {
    const group = BY_ID[id];
    const mesh = buildMesh(group, buildDomain(group, { seed: group.presets[0].seed }));
    const kin = hingeKinematics(group, mesh);
    assert.ok(Math.abs(kin.zMax - expectZ[id]) < 1e-9, `${id}: zMax ${kin.zMax}`);
    assert.ok(Math.abs(kin.hMax - kin.H * kin.zMax) < 1e-12 && kin.hMax > 0, id);
    // pleasantly plump: the greatest height is about half the inradius of the cell (0.4-0.9 of it: never close to the
    // inradius itself, where the cone points would turn into spikes) ...
    const inr = kin.geometry.inradius;
    assert.ok(kin.hMax > 0.4 * inr && kin.hMax <= 0.9 * inr, `${id}: hMax ${kin.hMax} for an inradius of ${inr}`);
    const T = group.kaleido.cell;
    // ... and a closed pillow (every side of T glued) is a quarter to 0.45 of the longest side of T thick, so that none
    // reads as a flat triangle from the default view (round 3, finding 37: 632 and 442 were 0.20 and 0.23 at half the
    // inradius; now 0.31 and 0.25)
    if (group.kaleido.glued.every(Boolean)) {
      const longest = Math.max(...T.map((p, i) => Math.hypot(T[(i + 1) % T.length][0] - p[0], T[(i + 1) % T.length][1] - p[1])));
      const thick = (2 * kin.hMax) / longest;
      assert.ok(thick >= 0.25 && thick <= 0.45, `${id}: the closed shape is ${thick.toFixed(3)} of the longest side of T thick`);
    }
    const xs = T.map((p) => p[0]), ys = T.map((p) => p[1]);
    assert.ok(Math.abs(kin.box.cx - (Math.min(...xs) + Math.max(...xs)) / 2) < 1e-12 && Math.abs(kin.box.hy - (Math.max(...ys) - Math.min(...ys)) / 2) < 1e-12, id);
    assert.equal(kin.pieces, mesh.cells.length);
    // opts.plump scales the height
    assert.ok(Math.abs(hingeKinematics(group, mesh, { plump: 0.3 }).hMax - 0.3 * inr) < 1e-12, id);
  }
});

test('hingeKinematics: pose(0, 0) is the identity; pose is continuous in theta and beta; a wrong piece index does not throw', () => {
  const group = BY_ID['333'];
  const domain = buildDomain(group, { seed: [0.42, 0.06], warp: makeWarp(group, 1) });
  const mesh = buildMesh(group, domain);
  const kin = hingeKinematics(group, mesh);
  const a = [0, 0, 0], b = [0, 0, 0];
  kin.pose(0, 0)(0.3, 0.1, 0, a);
  assert.deepEqual(a, [0.3, 0.1, 0]);
  for (let v = 0; v < mesh.n; v += 7) {
    const x = mesh.xy[2 * v], y = mesh.xy[2 * v + 1], c = mesh.cell[v];
    for (const [th, be] of [[0, 0], [0.7, 0], [0.7, 0.4], [PI, 0.4], [PI, 1], [2.5, 1]]) {
      kin.pose(th, be)(x, y, c, a); kin.pose(th + 1e-7, be + 1e-7)(x, y, c, b);
      assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-5, `continuity at theta ${th}, beta ${be}`);
      assert.ok(Number.isFinite(a[0] + a[1] + a[2]));
    }
  }
  for (const c of [65535, -1, NaN, 1e9]) { kin.pose(1, 1)(0.3, 0.1, c, a); assert.ok(Number.isFinite(a[0] + a[1] + a[2]), `piece ${c}`); }
  kin.pillow(0.3, 0.1, 65535, a);
  assert.ok(Number.isFinite(a[0] + a[1] + a[2]));
  // a point far outside the tile stays finite too
  kin.pose(2, 0.5)(40, -30, 0, a);
  assert.ok(Number.isFinite(a[0] + a[1] + a[2]));
});

test('hingeKinematics on 22x (the tile covers HALF the pillow): half-turn seams coincide, glide seams are antipodal', () => {
  const group = BY_ID['22x'];
  const T = group.kaleido.cell;
  const failuresX = [];
  let single = 0, withOdd = 0, n = 0, maxErr = 0;
  for (const amp of AMPS) {
    const warp = makeWarp(group, amp);
    for (const c of cases(group, 3)) {
      const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp });
      const mesh = buildMesh(group, domain);
      const kin = hingeKinematics(group, mesh);
      n++;
      if (mesh.cells.length === 1) single++;
      if (kin.depth.some((d) => d & 1)) withOdd++;
      assert.ok(Math.abs(kin.zMax - 0.25) < 1e-9);
      const a = [0, 0, 0], b = [0, 0, 0], q = [0, 0];
      // finite everywhere, pillow in range, on the right sheet
      for (const [th, be] of [[0, 0], [1, 0], [2, 0.5], [PI, 1]]) {
        const F = kin.pose(th, be);
        for (let v = 0; v < mesh.n; v++) {
          F(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], a);
          if (!Number.isFinite(a[0] + a[1] + a[2])) { failuresX.push(`${c.label} amp ${amp}: non-finite pose(${th}, ${be})`); break; }
        }
      }
      const closed = kin.pose(PI, 1);
      for (let v = 0; v < mesh.n; v++) {
        const x = mesh.xy[2 * v], y = mesh.xy[2 * v + 1];
        kin.pillow(x, y, mesh.cell[v], a);
        if (!(Math.abs(a[0]) <= 1 + 1e-6 && Math.abs(a[1]) <= 1 + 1e-6 && Math.abs(a[2]) <= 0.25 + 1e-7)) { failuresX.push(`${c.label} amp ${amp}: pillow out of range ${a}`); break; }
        // Z = -+ sqrt((1 - X^2)(1 - Y^2)) / 4 for the rectangle with four glued sides
        const zz = Math.sqrt(Math.max(0, (1 - a[0] * a[0]) * (1 - a[1] * a[1]))) / 4;
        if (Math.abs(Math.abs(a[2]) - zz) > 1e-6) { failuresX.push(`${c.label} amp ${amp}: |Z| ${Math.abs(a[2])} is not sqrt((1-X^2)(1-Y^2))/4 = ${zz}`); break; }
        kin.unpillow(a[0], a[1], a[2], b);
        closed(x, y, mesh.cell[v], a);
        if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 1e-12) { failuresX.push(`${c.label} amp ${amp}: unpillow(pillow) != pose(pi, 1)`); break; }
      }
      // glued boundary points: the same pillow point for a half-turn, the antipodal point for a glide
      domain.edges.forEach((e, i) => {
        if (e.kind !== 'cut') return;
        const bi = mesh.boundary[i], bj = mesh.boundary[e.partner], k = bi.cells.length, gi = inverse(e.g), anti = det(e.g) < 0 ? -1 : 1;
        for (let j = 0; j < k; j++) {
          apply(gi, bi.pts[2 * j], bi.pts[2 * j + 1], q);
          kin.pillow(bi.pts[2 * j], bi.pts[2 * j + 1], bi.cells[j], a);
          kin.pillow(q[0], q[1], bj.cells[e.rev ? k - 1 - j : j], b);
          const d = Math.hypot(a[0] - anti * b[0], a[1] - anti * b[1], a[2] - anti * b[2]);
          maxErr = Math.max(maxErr, d);
          if (!(d < 1e-6)) { failuresX.push(`${c.label} amp ${amp}: edge ${i} sample ${j}: pillow ${a} vs ${anti < 0 ? 'antipode of ' : ''}${b}`); return; }
        }
      });
      // the default export works on it too (the cross-cap fold does its own second stage)
      const fold = createFold(group, domain, mesh, {});
      fold.at(0.5)(mesh.xy[0], mesh.xy[1], mesh.cell[0], a);
      if (!Number.isFinite(a[0] + a[1] + a[2])) failuresX.push(`${c.label} amp ${amp}: createFold`);
    }
  }
  assert.equal(failuresX.length, 0, failuresX.slice(0, 6).join('\n'));
  assert.ok(single >= 1, 'a tile that is a single piece (no hinge at all) is covered');
  assert.ok(withOdd >= 1, 'tiles with pieces on the second sheet are covered');
  console.log(`      22x: ${n} tiles, ${single} of a single piece, ${withOdd} with pieces on the second sheet, worst pillow mismatch ${maxErr.toExponential(1)}; cell ${T.map((p) => p.join(',')).join(' ')}`);
});

test('hinge with a skew metric (the tile need not contain its cell: large pieces of depth 2 and more) — identity, seams, finite, bounded steps', () => {
  const METRICS = { '2222': [[1, 0.6, 1], [1, 0, 4], [3, -1.2, 1]], '22*': [[1, 0, 4], [5, 0, 1]], '2*22': [[1, 0, 5], [4, 0, 1]] };
  const bad = [];
  let deepest = 0, largestDeep = 0, n = 0;
  for (const [id, metrics] of Object.entries(METRICS)) {
    const group = BY_ID[id], size = Math.sqrt(group.domainArea), areaT = polyArea(group.kaleido.cell);
    const rnd = prng(31337 + GROUPS.indexOf(group));
    for (const metric of metrics) {
      for (const amp of AMPS) {
        const warp = makeWarp(group, amp);
        const seeds = group.presets.map((p) => p.seed);
        for (let k = 0; k < 6; k++) seeds.push([group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf]);
        for (const seed of seeds) {
          const label = `${id} metric [${metric}] seed (${seed.map((v) => v.toFixed(4))}) amp ${amp}`;
          const domain = buildDomain(group, { seed, metric, warp });
          assert.deepEqual(domain.metric, metric, `${label}: the metric was not accepted`);
          const mesh = buildMesh(group, domain);
          const fold = createFold(group, domain, mesh, {}), kin = fold.kinematics;
          n++;
          const depthMax = Math.max(1, ...kin.depth);
          deepest = Math.max(deepest, depthMax);
          for (let i = 0; i < kin.pieces; i++) if (kin.depth[i] >= 2) largestDeep = Math.max(largestDeep, mesh.cells[i].area / areaT);
          const out = [0, 0, 0], o2 = [0, 0, 0], q = [0, 0];
          // 1. identity
          const F0 = fold.at(0);
          for (let v = 0; v < mesh.n; v++) { F0(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], out); if (out[0] !== mesh.xy[2 * v] || out[1] !== mesh.xy[2 * v + 1] || out[2] !== 0) { bad.push(`${label}: at(0)`); break; } }
          // 2. seams
          const F1 = fold.at(1);
          let gap = 0;
          domain.edges.forEach((e, i) => {
            if (e.kind !== 'cut') return;
            const bi = fold.mesh.boundary[i], bj = fold.mesh.boundary[e.partner], m = bi.cells.length, gi = inverse(e.g);
            for (let j = 0; j < m; j++) {
              apply(gi, bi.pts[2 * j], bi.pts[2 * j + 1], q);
              F1(bi.pts[2 * j], bi.pts[2 * j + 1], bi.cells[j], out); F1(q[0], q[1], bj.cells[e.rev ? m - 1 - j : j], o2);
              const d = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]);
              if (!(d <= gap)) gap = d;
            }
          });
          if (!(gap < 1e-6 * size)) bad.push(`${label}: seam gap ${gap}`);
          // 3, 4. finite, and every step within the speed bound of a chain of depthMax hinges
          const diam = Math.hypot(mesh.bbox[2] - mesh.bbox[0], mesh.bbox[3] - mesh.bbox[1]);
          const speed = depthMax * TH1 * (diam + kin.hMax) + BE1 * kin.hMax;
          let prev = new Float64Array(3 * mesh.n), cur = new Float64Array(3 * mesh.n), worst = 0, finite = true;
          for (let s = 0; s <= 100; s++) {
            const F = fold.at(s / 100);
            for (let v = 0, o = 0; v < mesh.n; v++, o += 3) {
              F(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], out);
              if (!Number.isFinite(out[0] + out[1] + out[2])) finite = false;
              cur[o] = out[0]; cur[o + 1] = out[1]; cur[o + 2] = out[2];
              if (s > 0) worst = Math.max(worst, Math.hypot(cur[o] - prev[o], cur[o + 1] - prev[o + 1], cur[o + 2] - prev[o + 2]));
            }
            const T = prev; prev = cur; cur = T;
          }
          if (!finite) bad.push(`${label}: non-finite positions`);
          if (!(worst <= (1.02 * speed) / 100)) bad.push(`${label}: a step of ${worst} (bound ${speed / 100})`);
        }
      }
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 6).join('\n'));
  assert.ok(deepest >= 2, `deepest piece ${deepest}`);
  console.log(`      ${n} tiles with a skew metric: deepest piece ${deepest}, largest piece of depth >= 2: ${largestDeep.toFixed(3)} of the cell`);
});

test('presets: the closed shapes of a group sit on ONE cell, every preset with the anchor the app passes (contract C3: preset.anchor ?? preset.seed), so another cut only moves the seams; an explicit anchor only for a seed on a crease of that cell; the mirror rim opens toward the default camera', () => {
  let explicit = 0;
  for (const id of HINGE) {
    const group = BY_ID[id], T = group.kaleido.cell, glued = group.kaleido.glued, size = Math.sqrt(group.domainArea), areaT = polyArea(T);
    const cen = (q) => q.reduce((s, v) => [s[0] + v[0] / q.length, s[1] + v[1] / q.length], [0, 0]);
    let shared = null;
    const fixed = new Map();      // preset -> centre of its fixed cell with a straight cut
    for (const amp of AMPS) {
      for (const p of group.presets) {
        const mesh = buildMesh(group, buildDomain(group, { seed: p.seed, metric: p.metric, warp: makeWarp(group, amp) }));
        const kin = hingeKinematics(group, mesh);                                       // no anchor: the seed's own fixed cell
        const anchored = hingeKinematics(group, mesh, { anchor: p.anchor || p.seed });  // what the app hands the fold (C3)
        const rootC = cen(mesh.cells[kin.root].poly);
        const C0 = T.map((q) => apply(anchored.anchorIso, q[0], q[1])), c = cen(C0);
        const poly = C0;              // the cell the closed shape sits on; its mouth is checked below
        // the fixed cell does not depend on the wave
        if (amp === 0) fixed.set(p, rootC); else assert.ok(Math.hypot(rootC[0] - fixed.get(p)[0], rootC[1] - fixed.get(p)[1]) < 1e-9, `${id} ${p.name}: the fixed cell changes with the wavy cut`);
        if (!shared) shared = c;
        assert.ok(Math.hypot(c[0] - shared[0], c[1] - shared[1]) < 1e-9, `${id} ${p.name}: the closed shape sits on the cell at (${c}) instead of (${shared})`);
        if (!p.anchor) {
          // the seed's own cell is the shared cell
          assert.ok(Math.hypot(rootC[0] - shared[0], rootC[1] - shared[1]) < 1e-9, `${id} ${p.name}: fixed cell at (${rootC}) instead of (${shared}): it needs an anchor`);
        } else {
          if (amp === 0) explicit++;
          // only where it is needed: the nudged seed lies in the reflection of the shared cell in one of its glued sides,
          // and the seed lies ON that side (a symmetric cut)
          const u = apply(inverse(anchored.anchorIso), p.seed[0], p.seed[1]), ua = apply(inverse(anchored.anchorIso), p.anchor[0], p.anchor[1]);
          let onSide = -1, inner = Infinity;
          for (let k = 0; k < T.length; k++) {
            const a = T[k], b = T[(k + 1) % T.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const d = ((b[0] - a[0]) * (u[1] - a[1]) - (b[1] - a[1]) * (u[0] - a[0])) / l;      // > 0 inside (T is CCW)
            if (Math.abs(d) < 1e-12) onSide = k;
            inner = Math.min(inner, ((b[0] - a[0]) * (ua[1] - a[1]) - (b[1] - a[1]) * (ua[0] - a[0])) / l);
          }
          assert.ok(onSide >= 0 && glued[onSide], `${id} ${p.name}: an explicit anchor, but the seed is not on a glued side of the shared cell`);
          assert.ok(Math.hypot(rootC[0] - shared[0], rootC[1] - shared[1]) > 0.1 * size, `${id} ${p.name}: an explicit anchor that is not needed`);
          // the anchor lies well inside the shared cell, and the walk to the seed crosses that one crease
          assert.ok(inner > 0.05 * size, `${id} ${p.name}: the anchor is only ${inner} inside the shared cell`);
          assert.ok(anchored.walk.length === 1 && anchored.walk[0].glued && !anchored.mirrored, `${id} ${p.name}: walk of ${anchored.walk.length} lines`);
          if (amp === 0) {
            // the tile is the shared cell and its reflection in that crease: two pieces of one cell each; the piece in
            // the shared cell does not move while the hinges turn (the other half folds over onto it)
            assert.equal(mesh.cells.length, 2, `${id} ${p.name}: pieces`);
            for (const cl of mesh.cells) assert.ok(Math.abs(cl.area - areaT) < 1e-9, `${id} ${p.name}: a piece of area ${cl.area}, not one cell`);
            const out = [0, 0, 0];
            for (const th of [0.4, 1.3, 2.2, 3.0, PI]) {
              const F = anchored.pose(th, 0);
              for (let v = 0; v < mesh.n; v++) {
                const x = mesh.xy[2 * v], y = mesh.xy[2 * v + 1];
                if (!inPolygon(C0, x, y, -1e-9)) continue;
                F(x, y, mesh.cell[v], out);
                assert.ok(Math.hypot(out[0] - x, out[1] - y, out[2]) < 1e-12, `${id} ${p.name}: a point of the shared cell moves at theta ${th}`);
              }
            }
          }
        }
        // the open (mirror) sides of the fixed cell face the viewer: their outward normals point toward -y
        for (let k = 0; k < T.length; k++) {
          if (glued[k]) continue;
          const a = poly[k], b = poly[(k + 1) % T.length];
          let nx = b[1] - a[1], ny = a[0] - b[0];
          const l = Math.hypot(nx, ny), mx = (a[0] + b[0]) / 2 - c[0], my = (a[1] + b[1]) / 2 - c[1];
          if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
          if (id === '2*22') continue;      // two open sides at a right angle: checked below through the open corner
          assert.ok(ny / l < -0.5, `${id} ${p.name}: the mouth faces (${(nx / l).toFixed(2)}, ${(ny / l).toFixed(2)})`);
        }
        if (id === '2*22') {
          // the open corner (both sides open) is the near right corner of the fixed cell
          const k = T.findIndex((_, i) => !glued[i] && !glued[(i + T.length - 1) % T.length]);
          assert.ok(k >= 0 && poly[k][1] < c[1] && poly[k][0] > c[0], `${id} ${p.name}: open corner at (${poly[k]})`);
        }
      }
    }
  }
  assert.ok(explicit >= 1, 'the presets with an explicit anchor were checked');
});

// ===============================================================================================================
// SPEC 7, the anchor contract: createFold(group, domain, mesh, { anchor }) — at t = 1 the shape depends on the anchor
// only; at 0 < t < 1 it moves continuously while the seed crosses a crease. Everything the checks compare with is
// computed here from group.kaleido alone (nothing of src/folds/hinge.js is used to make the reference).
// ===============================================================================================================

const ANCHOR_SEEDS = Math.max(30, +process.env.ANCHOR_SEEDS || 30);
const NUDGE = [1e-6 * 0.3713, 1e-6 * 0.9285];       // the nudge of mesh.js, also applied to the anchor (SPEC 7)
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/**
 * The anchors the tests use for a group, as { name, seed: the anchor }: every preset's seed (any plane point is an
 * anchor; several lie ON a crease) and, for a preset that carries one, its explicit anchor (contract C3: the app
 * passes preset.anchor ?? preset.seed).
 */
const anchorsOf = (group) => group.presets.flatMap((p) => (p.anchor ? [p, { name: `${p.name} (its anchor)`, seed: p.anchor }] : [p]));

/**
 * The kaleidoscope of a group by itself: the sides of T (inward unit normal, offset, D_s = the largest distance from T
 * to the side, glued or not, the reflection in it) and fold(x, y) -> { u, v, par, g }: the point folded into T, the
 * number of GLUED reflections that took mod 2 (its sheet relative to T), and the isometry g of its cell (g(u, v) = (x, y)).
 */
function kaleidoRef(group) {
  const T = group.kaleido.cell, n = T.length, glued = group.kaleido.glued, sides = [];
  for (let i = 0; i < n; i++) {
    const p = T[i], q = T[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy);
    const nx = -dy / l, ny = dx / l, c = nx * p[0] + ny * p[1];
    let D = 0;
    for (const v of T) D = Math.max(D, nx * v[0] + ny * v[1] - c);
    sides.push({ nx, ny, c, D, glued: !!glued[i], s: refl(p[0], p[1], Math.atan2(dy, dx)) });
  }
  const fold = (x, y) => {
    let u = x, v = y, par = 0, g = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    for (let it = 0; it < 100000; it++) {
      let hit = -1, worst = -1e-13;
      for (let i = 0; i < n; i++) { const d = sides[i].nx * u + sides[i].ny * v - sides[i].c; if (d < worst) { worst = d; hit = i; } }
      if (hit < 0) break;
      [u, v] = apply(sides[hit].s, u, v);
      if (sides[hit].glued) par ^= 1;
      g = compose(g, sides[hit].s);
    }
    return { u, v, par, g };
  };
  const cen = T.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n], [0, 0]);
  const cellKey = (x, y) => { const c = apply(fold(x, y).g, cen[0], cen[1]); return Math.round(c[0] * 1e7) + ',' + Math.round(c[1] * 1e7); };
  return { T, sides, fold, cen, cellKey };
}

/**
 * SPEC 7: where the closed shape of the anchor puts the plane point (x, y): (g_C0(u), ∓ H prod over glued sides of
 * sqrt(d_s / D_s)), minus on the anchor's sheet (an even number of glued lines between the point's cell and C0).
 * It is invariant under the group (whose elements are the products of an even number of glued reflections).
 */
function closedMap(K, anchor, H) {
  const A = K.fold(anchor[0] + NUDGE[0], anchor[1] + NUDGE[1]);
  return (x, y, out = [0, 0, 0]) => {
    const f = K.fold(x, y);
    let h = H;
    for (const s of K.sides) if (s.glued) h *= Math.sqrt(Math.max(0, s.nx * f.u + s.ny * f.v - s.c) / s.D);
    const w = apply(A.g, f.u, f.v);
    out[0] = w[0]; out[1] = w[1]; out[2] = (f.par ^ A.par) ? h : -h;
    return out;
  };
}

/** Random points of the tile in ACTUAL coordinates, kept `margin` inside it (in straight coordinates). */
function tilePoints(domain, count, rnd, margin) {
  const P = domain.poly, q = [0, 0], out = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const v of P) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
  for (let tries = 0; tries < 60 * count && out.length < count; tries++) {
    const sx = x0 + rnd() * (x1 - x0), sy = y0 + rnd() * (y1 - y0);
    if (!domain.contains(sx, sy, -margin)) continue;
    domain.warp.fwd(sx, sy, q);
    out.push([q[0], q[1]]);
  }
  return out;
}

/** Is the actual point (x, y) in the tile, `margin` inside it (straight coordinates)? */
const inTile = (domain, x, y, margin, q = [0, 0]) => { domain.warp.inv(x, y, q); return domain.contains(q[0], q[1], -margin); };

/** The point of the orbit of the plane point (x, y) under the group that lies in the tile, `margin` inside it; or null. */
function orbitPointInTile(group, domain, x, y, margin) {
  const s = domain.seedActual, q = [0, 0];
  let R = 0;
  for (const v of domain.poly) { domain.warp.fwd(v[0], v[1], q); R = Math.max(R, Math.hypot(q[0] - s[0], q[1] - s[1])); }
  for (const g of elementsNear(group, s[0], s[1], R + 0.3 * Math.sqrt(group.domainArea), x, y)) {
    const p = apply(g, x, y);
    if (inTile(domain, p[0], p[1], margin, q)) return p;
  }
  return null;
}

/** Positions of every vertex at time t (Float64Array(3n)); counts the non-finite ones into bad[0]. */
function positions(fold, mesh, t, arr, bad) {
  const F = fold.at(t), o = [0, 0, 0];
  for (let v = 0, k = 0; v < mesh.n; v++, k += 3) {
    o[0] = o[1] = o[2] = NaN;
    F(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], o);
    if (!Number.isFinite(o[0] + o[1] + o[2])) bad[0]++;
    arr[k] = o[0]; arr[k + 1] = o[1]; arr[k + 2] = o[2];
  }
  return arr;
}
const maxMove = (a, b) => { let d = 0; for (let k = 0; k < a.length; k += 3) d = Math.max(d, Math.hypot(a[k] - b[k], a[k + 1] - b[k + 1], a[k + 2] - b[k + 2])); return d; };

/** Where the fold puts the seams at time t: the largest gap between glued boundary samples (two ways of choosing the pieces). */
function anchoredSeamGap(domain, mesh, fold, t) {
  const F = fold.at(t), q = [0, 0], a = [0, 0, 0], b = [0, 0, 0];
  let cx = 0, cy = 0, gap = 0;
  for (const p of domain.poly) { cx += p[0] / domain.poly.length; cy += p[1] / domain.poly.length; }
  const inward = (x, y) => {
    domain.warp.inv(x, y, q);
    const dx = cx - q[0], dy = cy - q[1], l = Math.hypot(dx, dy) || 1;
    domain.warp.fwd(q[0] + (1e-6 * dx) / l, q[1] + (1e-6 * dy) / l, q);
    return mesh.locate(q[0], q[1]);
  };
  domain.edges.forEach((e, i) => {
    if (e.kind !== 'cut') return;
    const bi = fold.mesh.boundary[i], bj = fold.mesh.boundary[e.partner], k = bi.cells.length, gi = inverse(e.g);
    for (let j = 0; j < k; j++) {
      const x = bi.pts[2 * j], y = bi.pts[2 * j + 1], jj = e.rev ? k - 1 - j : j;
      const p = apply(gi, x, y);
      F(x, y, bi.cells[j], a); F(p[0], p[1], bj.cells[jj], b);
      let d = dist3(a, b);
      F(x, y, inward(x, y), a); F(p[0], p[1], inward(p[0], p[1]), b);
      d = Math.max(d, dist3(a, b));
      if (!(d <= gap)) gap = d;
    }
  });
  return gap;
}

test('anchor (SPEC 7) 1: at t = 1 every plane point goes where the anchor says — the same place for 30 random seeds and both waves (every hinge group, every preset\'s seed and explicit anchor as the anchor); SPEC 5.3 holds for the anchored fold', () => {
  const bad = [];
  const note = (msg) => { if (bad.length < 60) bad.push(msg); };
  const st = { folds: 0, motion: 0, mirrored: 0, mirroredGroups: new Set(), walk: 0, maxWalk: 0, generic: 0, vertex: 0, fixed: 0, fixedN: 0, fixedSkip: 0, seam: 0, structure: 0, ratio: 0 };
  for (const id of HINGE) {
    const group = BY_ID[id], size = Math.sqrt(group.domainArea), K = kaleidoRef(group), anchors = anchorsOf(group);
    const rnd = prng(5150 + 97 * GROUPS.indexOf(group));
    // fixed plane points: the seeds of the presets and four more points of the window
    const fixedPts = group.presets.map((p) => p.seed.slice());
    for (let k = 0; k < 4; k++) fixedPts.push([group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf]);
    const firstImage = new Map();     // `${preset}|${point}` -> its image the first time it was seen (any seed, either wave)
    let refs = null;
    for (const amp of AMPS) {
      const warp = makeWarp(group, amp);
      for (let k = 0; k < ANCHOR_SEEDS; k++) {
        const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
        const label0 = `${id} amp ${amp} seed (${seed.map((v) => v.toFixed(4))})`;
        let domain, mesh;
        try { domain = buildDomain(group, { seed, warp }); mesh = buildMesh(group, domain); } catch (e) { note(`${label0}: the tile: ${e}`); continue; }
        const pts = tilePoints(domain, 40, rnd, 1e-4 * size);
        const v1 = createFold(group, domain, mesh, {});
        anchors.forEach((p, pi) => {
          const label = `${label0} anchor ${p.name}`;
          let fold;
          try { fold = createFold(group, domain, mesh, { anchor: p.seed }); } catch (e) { note(`${label}: createFold threw ${e && e.stack}`); return; }
          const kin = fold.kinematics, out = [0, 0, 0], ref = [0, 0, 0];
          if (!refs) refs = anchors.map((q) => closedMap(K, q.seed, kin.H));
          const F = refs[pi], F1 = fold.at(1);
          st.folds++; st.walk += kin.walk.length; st.maxWalk = Math.max(st.maxWalk, kin.walk.length);
          if (kin.mirrored) { st.mirrored++; st.mirroredGroups.add(id); }
          if (!fold.anchor || fold.anchor[0] !== p.seed[0] || fold.anchor[1] !== p.seed[1]) note(`${label}: fold.anchor is ${fold.anchor}`);
          if (fold.mirrored !== kin.mirrored) note(`${label}: fold.mirrored ${fold.mirrored} but kin.mirrored ${kin.mirrored}`);
          // the frame's bookkeeping, against the kaleidoscope: the sheet of the root relative to the anchor's cell, and
          // eps = det(k) (-1)^(glued reflections in k) for the element k that carries the root's cell onto C0
          {
            const A = K.fold(p.seed[0] + NUDGE[0], p.seed[1] + NUDGE[1]), rc = apply(mesh.cells[kin.root].g, K.cen[0], K.cen[1]), Rf = K.fold(rc[0], rc[1]);
            const flip = A.par ^ Rf.par, eps = det(A.g) * det(Rf.g) * (flip ? -1 : 1);
            if (kin.flip !== flip || kin.mirrored !== (eps < 0)) note(`${label}: flip ${kin.flip} / mirrored ${kin.mirrored}, expected ${flip} / ${eps < 0}`);
            if (K.cellKey(...apply(kin.anchorIso, K.cen[0], K.cen[1])) !== K.cellKey(p.seed[0] + NUDGE[0], p.seed[1] + NUDGE[1])) note(`${label}: anchorIso is not the anchor's cell`);
            for (let i = 0; i < kin.pieces; i++) if (kin.sheet[i] !== ((kin.depth[i] + flip) & 1)) { note(`${label}: sheet of piece ${i}`); break; }
          }
          // (a) generic points of the tile: at(1) is the closed map of the anchor
          for (const [x, y] of pts) {
            F1(x, y, mesh.locate(x, y), out); F(x, y, ref);
            const d = dist3(out, ref) / size;
            st.generic = Math.max(st.generic, d);
            if (!(d < 1e-9)) { note(`${label}: at(1) puts (${x}, ${y}) at ${out}, the anchor's shape at ${ref}`); break; }
          }
          // (b) the fixed plane points: the point of each orbit that lies in this tile goes to one place for every seed and
          //     wave. (Several preset seeds lie ON a crease, where the puff is the square root of a rounding error:
          //     1e-17 there becomes 2e-9; the random points are generic.)
          fixedPts.forEach((x0, j) => {
            const X = orbitPointInTile(group, domain, x0[0], x0[1], 1e-6 * size);
            if (!X) { st.fixedSkip++; return; }
            F1(X[0], X[1], mesh.locate(X[0], X[1]), out);
            F(x0[0], x0[1], ref);
            const key = pi + '|' + j, first = firstImage.get(key);
            if (!first) firstImage.set(key, out.slice());
            const d = Math.max(dist3(out, ref), first ? dist3(out, first) : 0) / size, tol = j < group.presets.length ? 1e-7 : 1e-9;
            st.fixed = Math.max(st.fixed, d); st.fixedN++;
            if (!(d < tol)) note(`${label}: the plane point (${x0}) goes to ${out} (first seen at ${first}; the anchor's shape: ${ref})`);
          });
          // SPEC 5.3 (1): at(0) is the identity, exactly (vertices and boundary samples)
          const F0 = fold.at(0);
          for (let v = 0; v < mesh.n; v++) {
            F0(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], out);
            if (out[0] !== mesh.xy[2 * v] || out[1] !== mesh.xy[2 * v + 1] || !Object.is(out[2], 0)) { note(`${label}: at(0) moves vertex ${v}`); break; }
          }
          // SPEC 5.3 (2): seams close at t = 1 (and stay closed from FOLD_END on)
          for (const t of [1, FOLD_END]) {
            const gap = anchoredSeamGap(domain, mesh, fold, t) / size;
            st.seam = Math.max(st.seam, gap);
            if (!(gap < 1e-6)) note(`${label}: seam gap ${gap} tile sizes at t = ${t}`);
          }
          // SPEC 5.3 (4): finite at the stops, the inner times and beyond the ends
          const nb = [0];
          const tmp = new Float64Array(3 * mesh.n);
          for (const t of [1e-300, 1e-9, PUFF_START, FOLD_END, 1 - 1e-12, 1, 7]) positions(fold, mesh, t, tmp, nb);
          if (nb[0]) note(`${label}: ${nb[0]} non-finite positions`);
          // the rest for one anchor per tile (the anchors take turns): the heavier checks
          if (pi !== k % anchors.length) return;
          st.motion++;
          // (c) every vertex. A Float32 vertex on a mirror edge or a crease sits a rounding error (1e-8) off it, and next
          //     to a corner the square-root profile of the puff turns that into up to ~1e-4 of the size
          let worstV = 0;
          for (let v = 0; v < mesh.n; v++) { F1(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], out); F(mesh.xy[2 * v], mesh.xy[2 * v + 1], ref); worstV = Math.max(worstV, dist3(out, ref) / size); }
          st.vertex = Math.max(st.vertex, worstV);
          if (!(worstV < 5e-4)) note(`${label}: a vertex is ${worstV} tile sizes from the anchor's shape at t = 1`);
          // pillow coordinates in the anchored form: unpillow(pillow(p)) = at(1)(p); Z has the sign of the piece's sheet
          let badUn = 0, wrongSheet = 0;
          for (let v = 0; v < mesh.n; v++) {
            const x = mesh.xy[2 * v], y = mesh.xy[2 * v + 1];
            kin.pillow(x, y, mesh.cell[v], ref);
            if (Math.abs(ref[2]) > 0.02 * kin.zMax && (ref[2] > 0) !== (kin.sheet[mesh.cell[v]] === 1)) wrongSheet++;
            kin.unpillow(ref[0], ref[1], ref[2], ref);
            F1(x, y, mesh.cell[v], out);
            badUn = Math.max(badUn, dist3(out, ref));
          }
          if (badUn > 1e-12 || wrongSheet) note(`${label}: unpillow(pillow) differs by ${badUn}; ${wrongSheet} vertices with Z on the wrong sheet`);
          // the structure: at(t) = frame(theta(t), phi(t)) applied to the fold without the anchor (which the main sweep
          // tests), exactly; phi = pageTurn(t) turns the mirrors of the walk (the page turn, final fix of 10 Nov)
          for (const t of [0.07, 0.3, 0.45, 0.5, PUFF_START + 0.01, 0.7, FOLD_END, 0.93, 1]) {
            const theta = hingeSchedule(t)[0], M = kin.frame(theta, undefined, pageTurn(t)), Fa = fold.at(t), Fv = v1.at(t);
            let worst = 0;
            for (let v = 0; v < mesh.n; v += 3) {
              Fa(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], out); Fv(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], ref);
              const X = M[0] * ref[0] + M[1] * ref[1] + M[2] * ref[2] + M[3], Y = M[4] * ref[0] + M[5] * ref[1] + M[6] * ref[2] + M[7], Z = M[8] * ref[0] + M[9] * ref[1] + M[10] * ref[2] + M[11];
              worst = Math.max(worst, Math.hypot(out[0] - X, out[1] - Y, out[2] - Z));
            }
            st.structure = Math.max(st.structure, worst / size);
            if (!(worst < 1e-11 * size)) note(`${label}: at(${t}) is not frame(theta) · (the fold without anchor): ${worst}`);
          }
          // folded flat (theta = pi, beta = 0): every vertex lies on the anchor's cell, at height 0
          {
            const C0 = group.kaleido.cell.map((q) => apply(kin.anchorIso, q[0], q[1])), flat = kin.pose(PI, 0);
            for (let v = 0; v < mesh.n; v++) {
              flat(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], out);
              if (Math.abs(out[2]) > 1e-9 || !inPolygon(C0, out[0], out[1], 1e-6)) { note(`${label}: folded flat, vertex ${v} is at ${out}, off the anchor's cell`); break; }
            }
          }
          // SPEC 5.3 (3): continuity in t. The largest steps of 100, each cut into 16: a jump would stay in one piece of
          // it, a smooth motion splits evenly (largest piece <= 1/8 of the step). Next to t = 0, 1 and the inner times
          // the motion is as fast as anywhere else.
          {
            const STEPS = 100, A = new Float64Array(3 * mesh.n), B = new Float64Array(3 * mesh.n), C = new Float64Array(3 * mesh.n), steps = [];
            positions(fold, mesh, 0, A, nb);
            for (let s = 1; s <= STEPS; s++) { positions(fold, mesh, s / STEPS, B, nb); steps.push([maxMove(A, B), s]); A.set(B); }
            steps.sort((a, b) => b[0] - a[0]);
            const largest = steps[0][0];
            for (const [d, s] of steps.slice(0, 5)) {
              let worst = 0;
              positions(fold, mesh, (s - 1) / STEPS, A, nb);
              for (let j = 1; j <= 16; j++) { positions(fold, mesh, (s - 1 + j / 16) / STEPS, B, nb); worst = Math.max(worst, maxMove(A, B)); A.set(B); }
              st.ratio = Math.max(st.ratio, worst / d);
              if (!(worst <= d / 8 + 1e-12)) note(`${label}: the step to t = ${s / STEPS} (${d}) has a piece of ${worst}: a jump`);
            }
            for (const t0 of [0, PUFF_START, PAGE_END, FOLD_END, 1]) {
              const E = 1e-6;
              positions(fold, mesh, Math.max(0, t0 - E), A, nb); positions(fold, mesh, t0, B, nb); positions(fold, mesh, Math.min(1, t0 + E), C, nb);
              const d = Math.max(maxMove(A, B), maxMove(B, C));
              if (!(d <= 3 * largest * STEPS * E + 1e-12)) note(`${label}: a jump of ${d} next to t = ${t0} (steps of 1/100 move ${largest} at most)`);
            }
            if (nb[0]) note(`${label}: non-finite positions while moving`);
          }
        });
      }
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 8).join('\n'));
  assert.equal(st.folds, HINGE.reduce((s, id) => s + AMPS.length * ANCHOR_SEEDS * anchorsOf(BY_ID[id]).length, 0), 'every fold was built');
  // the sweep met long walks, and eps = -1 exactly in the four groups whose cell has a mirror side
  assert.ok(st.maxWalk >= 6 && st.walk / st.folds > 2, `walks: mean ${st.walk / st.folds}, longest ${st.maxWalk}`);
  assert.deepEqual([...st.mirroredGroups].sort(), ['22*', '2*22', '3*3', '4*2'].sort(), 'tiles that fold the other way round (eps = -1)');
  assert.ok(st.fixedN > 20 * HINGE.length && st.fixedSkip < st.fixedN / 4, `fixed points checked ${st.fixedN}, not in the tile ${st.fixedSkip}`);
  console.log(`      ${st.folds} anchored folds (${st.motion} with the motion checks): walk mean ${(st.walk / st.folds).toFixed(1)} lines, longest ${st.maxWalk}; eps = -1 in ${st.mirrored}; ` +
    `at t = 1 vs the anchor's shape: generic points ${st.generic.toExponential(1)}, fixed plane points ${st.fixed.toExponential(1)} (${st.fixedN} checks), vertices ${st.vertex.toExponential(1)} tile sizes; ` +
    `seams ${st.seam.toExponential(1)}; frame · v1 = anchored to ${st.structure.toExponential(1)}; largest piece of a largest step ${st.ratio.toFixed(3)} of it`);
});

/**
 * A straight seed path from the anchor across exactly ONE crease (a glued line of the kaleidoscope) and no mirror of
 * the group, clear of rotation centres, along which the clamp moves no seed. Found with kaleidoRef alone.
 * -> { a, b, s1, dir, clearance } (s1 = distance of the crossing from the anchor), or null.
 */
function onePath(group, K, anchor) {
  const cellSize = Math.sqrt(Math.abs(polyArea(K.T))), size = Math.sqrt(group.domainArea);
  const a = [anchor[0] + NUDGE[0], anchor[1] + NUDGE[1]], key0 = K.cellKey(a[0], a[1]), par0 = K.fold(a[0], a[1]).par;
  const V = [];
  for (const g of elementsNear(group.kaleido.group, a[0], a[1], 3 * cellSize + 1, K.T[0][0], K.T[0][1])) for (const p of K.T) V.push(apply(g, p[0], p[1]));
  let best = null;
  for (let k = 0; k < 96; k++) {
    const ang = (2 * PI * k) / 96, d = [Math.cos(ang), Math.sin(ang)], at = (s) => [a[0] + s * d[0], a[1] + s * d[1]];
    const ds = 0.005 * cellSize, changes = [];
    let prev = key0;
    for (let s = ds; s < 2.4 * cellSize && changes.length < 2; s += ds) { const key = K.cellKey(...at(s)); if (key !== prev) { changes.push(s); prev = key; } }
    if (!changes.length) continue;
    let lo = changes[0] - ds, hi = changes[0];
    for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (K.cellKey(...at(mid)) === key0) lo = mid; else hi = mid; }
    const s1 = (lo + hi) / 2, s2 = changes.length > 1 ? changes[1] - ds : s1 + cellSize;
    if (s1 < 0.05 * cellSize || K.fold(...at(hi + 1e-9)).par === par0) continue;   // not a crease (a mirror keeps the sheet)
    const end = s1 + 0.45 * (s2 - s1), b = at(end);
    let clear = Infinity;
    for (const v of V) {
      const t = Math.max(0, Math.min(end, (v[0] - a[0]) * d[0] + (v[1] - a[1]) * d[1]));
      clear = Math.min(clear, Math.hypot(v[0] - a[0] - t * d[0], v[1] - a[1] - t * d[1]));
    }
    let moved = false;
    for (let j = 0; j <= 48 && !moved; j++) { const p = at((j / 48) * end), c = clampSeed(group, p[0], p[1]); moved = Math.hypot(c[0] - p[0], c[1] - p[1]) > 1e-12; }
    if (moved || clear < 0.15 * size) continue;
    if (!best || clear > best.clearance * size) best = { a: anchor.slice(), b, s1, end, dir: d, clearance: clear / size };
  }
  return best;
}

test('anchor (SPEC 7) 2: at t = 0.5 the shape moves continuously while the seed crosses a crease — a plane point that stays in the tile keeps its place (every hinge group, every preset\'s seed and explicit anchor, both waves); without the anchor it hops', () => {
  const bad = [];
  const note = (msg) => { if (bad.length < 60) bad.push(msg); };
  const T = 0.5, st = { paths: 0, tiles: 0, common: 0, worst: 0, v1min: Infinity, centre: 0 };
  for (const id of HINGE) {
    const group = BY_ID[id], size = Math.sqrt(group.domainArea), K = kaleidoRef(group);
    for (const p of anchorsOf(group)) {
      const path = onePath(group, K, p.seed);
      if (!path) { note(`${id} ${p.name}: no seed path across one crease was found`); continue; }
      const along = (s) => [path.a[0] + s * path.dir[0], path.a[1] + s * path.dir[1]];
      const ss = [];
      for (let j = 0; j <= 24; j++) ss.push((j / 24) * path.end);
      const cs = Math.sqrt(Math.abs(polyArea(K.T)));
      for (const e of [-1e-4, -1e-7, 1e-7, 1e-4]) ss.push(path.s1 + e * cs);
      ss.sort((x, y) => x - y);
      for (const amp of AMPS) {
        st.paths++;
        const warp = makeWarp(group, amp), rnd = prng(31 + st.paths);
        let prev = null, v1jump = 0;
        for (const s of ss) {
          const seed = along(s), label = `${id} ${p.name} amp ${amp}: seed ${s.toFixed(7)} along (${path.dir.map((v) => v.toFixed(3))})`;
          const domain = buildDomain(group, { seed, warp }), mesh = buildMesh(group, domain);
          const fold = createFold(group, domain, mesh, { anchor: p.seed }), v1 = createFold(group, domain, mesh, {});
          st.tiles++;
          // the walk: no line before the crossing, the crease after it
          const wantWalk = s < path.s1 ? 0 : 1, kin = fold.kinematics;
          if (kin.walk.length !== wantWalk || (wantWalk && !kin.walk[0].glued) || kin.flip !== wantWalk || kin.mirrored) note(`${label}: walk of ${kin.walk.length} lines (glued ${kin.walk.map((l) => l.glued)}), flip ${kin.flip}, expected ${wantWalk}`);
          const Fa = fold.at(T), Fv = v1.at(T), o = [0, 0, 0];
          // the centre of the folded surface (area-weighted)
          let cx = 0, cy = 0, cz = 0, ar = 0;
          for (let t = 0; t < mesh.m; t++) {
            const v0 = mesh.tri[3 * t], v1i = mesh.tri[3 * t + 1], v2 = mesh.tri[3 * t + 2];
            const w = Math.abs((mesh.xy[2 * v1i] - mesh.xy[2 * v0]) * (mesh.xy[2 * v2 + 1] - mesh.xy[2 * v0 + 1]) - (mesh.xy[2 * v1i + 1] - mesh.xy[2 * v0 + 1]) * (mesh.xy[2 * v2] - mesh.xy[2 * v0])) / 2;
            for (const v of [v0, v1i, v2]) { Fa(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.triCell[t], o); cx += (w * o[0]) / 3; cy += (w * o[1]) / 3; cz += (w * o[2]) / 3; }
            ar += w;
          }
          const cur = { s, domain, mesh, Fa, Fv, c: [cx / ar, cy / ar, cz / ar] };
          if (prev) {
            const ds = s - prev.s;
            const dc = dist3(cur.c, prev.c);
            st.centre = Math.max(st.centre, dc / ds);
            if (!(dc <= 10 * ds + 1e-9 * size)) note(`${label}: the folded surface's centre moves ${dc} for a seed step of ${ds}`);
            // plane points in both tiles: the same position from both folds
            const a = [0, 0, 0], b = [0, 0, 0];
            let n = 0;
            for (const [x, y] of tilePoints(prev.domain, 60, rnd, 1e-3 * size)) {
              if (!inTile(cur.domain, x, y, 1e-3 * size)) continue;
              n++;
              prev.Fa(x, y, prev.mesh.locate(x, y), a); cur.Fa(x, y, cur.mesh.locate(x, y), b);
              const d = dist3(a, b) / size;
              st.worst = Math.max(st.worst, d);
              if (!(d < 1e-9)) { note(`${label}: the plane point (${x}, ${y}) moves ${d} tile sizes for a seed step of ${ds}`); break; }
              prev.Fv(x, y, prev.mesh.locate(x, y), a); cur.Fv(x, y, cur.mesh.locate(x, y), b);
              v1jump = Math.max(v1jump, dist3(a, b) / size);
            }
            st.common += n;
            if (n < 10) note(`${label}: only ${n} plane points in both tiles`);
          }
          prev = cur;
        }
        st.v1min = Math.min(st.v1min, v1jump);
        // the control: without the anchor the shape hops over the crease (v1), so the checks above would see a hop
        if (!(v1jump > 0.1)) note(`${id} ${p.name} amp ${amp}: without the anchor the shape moves only ${v1jump} tile sizes at the crease — the check has no teeth here`);
      }
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 8).join('\n'));
  assert.equal(st.paths, AMPS.length * HINGE.reduce((s, id) => s + anchorsOf(BY_ID[id]).length, 0));
  console.log(`      ${st.paths} seed paths across one crease (${st.tiles} tiles): ${st.common} plane points in consecutive tiles move at most ${st.worst.toExponential(1)} tile sizes at t = 0.5 ` +
    `(without the anchor at least ${st.v1min.toFixed(2)} somewhere on every path); the folded surface's centre moves at most ${st.centre.toFixed(2)} x the seed`);
});

test('anchor (SPEC 7) 2b: across a MIRROR of the group (22*, 2*22, 3*3, 4*2), the page turn — from PAGE_END on the tile and its mirror image fold alike (a drag across a mirror changes nothing); the mirrored one swaps its colours (mirroredAt) from 0 at t = 0 to 1 by PAGE_END, smoothly, where its fixed piece is seen edge-on from the default camera (final fix, 10 Nov: qa/final-verify-owner-asks/crossing-22s.png, mirror-22s-t0-after.png)', () => {
  const bad = [];
  const note = (msg) => { if (bad.length < 60) bad.push(msg); };
  const st = { pairs: 0, points: 0, worstAfter: 0, minBefore: Infinity, swaps: 0, crossings: 0, fallbacks: 0, worstFacing: 0, maxMix: 0 };
  const facingOf = (fold, t, seed) => {
    // the image normal of the fixed piece (rigid and flat before the puff), by finite differences of at(t): independent
    // of the frame bookkeeping. CCW plane frame -> the renderer's normal.
    const h = 1e-4, x = seed[0] + NUDGE[0] * 10, y = seed[1] + NUDGE[1] * 10, F = fold.at(t), r = fold.kinematics.root;
    const o = F(x, y, r, [0, 0, 0]), u = F(x + h, y, r, [0, 0, 0]), v = F(x, y + h, r, [0, 0, 0]);
    const a = [u[0] - o[0], u[1] - o[1], u[2] - o[2]], b = [v[0] - o[0], v[1] - o[1], v[2] - o[2]];
    const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], l = Math.hypot(...n);
    return (n[0] * VIEW0[0] + n[1] * VIEW0[1] + n[2] * VIEW0[2]) / l;
  };
  for (const id of ['22*', '2*22', '3*3', '4*2']) {
    const group = BY_ID[id], size = Math.sqrt(group.domainArea), rnd = prng(2626 + GROUPS.indexOf(group));
    for (const p of anchorsOf(group)) {
      const seeds = [p.seed.map((v, i) => v + (i ? 0.011 : 0.017) * size)];
      for (let k = 0; k < 8; k++) seeds.push([group.center[0] + (2 * rnd() - 1) * 0.8 * group.viewHalf, group.center[1] + (2 * rnd() - 1) * 0.8 * group.viewHalf]);
      for (const q of seeds) {
        // a drag across the mirror of the group nearest q: the seed just on q's side of it (0.1 tile sizes, beyond the
        // clamp's 0.06) and its image in the mirror
        const { mirrors } = symmetryElements(group, q[0], q[1], 2 * size);
        let m = null;
        for (const L of mirrors) { const nx = -L.uy, ny = L.ux, d = (q[0] - L.px) * nx + (q[1] - L.py) * ny; if (!m || Math.abs(d) < Math.abs(m.d)) m = { d, nx, ny, px: L.px, py: L.py }; }
        if (!m) continue;
        const r = (x, y) => { const e = (x - m.px) * m.nx + (y - m.py) * m.ny; return [x - 2 * e * m.nx, y - 2 * e * m.ny]; };
        const sg = m.d < 0 ? -1 : 1, off = (sg * 0.1 * size) - m.d;
        const s0 = [q[0] + off * m.nx, q[1] + off * m.ny], s1 = r(s0[0], s0[1]);
        for (const amp of AMPS) {
          const warp = makeWarp(group, amp), label = `${id} anchor ${p.name} amp ${amp}: seed (${s0.map((v) => v.toFixed(3))}) and its mirror image`;
          const dA = buildDomain(group, { seed: s0, warp }), mA = buildMesh(group, dA), fA = createFold(group, dA, mA, { anchor: p.seed });
          const dB = buildDomain(group, { seed: s1, warp }), mB = buildMesh(group, dB), fB = createFold(group, dB, mB, { anchor: p.seed });
          // the claim holds where the drag changes the walk by the mirror alone (one walk = the other + that mirror);
          // where the line of sight from the anchor sweeps a corner of the kaleidoscope on the mirror, the walks differ
          // more (the rotation-centre exception of SPEC 7)
          const wA = fA.kinematics.walk, wB = fB.kinematics.walk, [sh, lg] = wA.length < wB.length ? [wA, wB] : [wB, wA];
          const same = (P, Q) => Math.abs(P.px - Q.px) + Math.abs(P.py - Q.py) + Math.abs(P.dx - Q.dx) + Math.abs(P.dy - Q.dy) < 1e-9;
          if (!(lg.length === sh.length + 1 && !lg[sh.length].glued && sh.every((L, i) => same(L, lg[i])))) { st.corner = (st.corner || 0) + 1; continue; }
          st.pairs++;
          if (fA.mirrored === fB.mirrored) { note(`${label}: mirrored ${fA.mirrored} / ${fB.mirrored}: one mirror apart, exactly one should be`); continue; }
          // the shapes: equal from PAGE_END on, different before it (the page turn is under way)
          const pts = tilePoints(dA, 40, rnd, 2e-3 * size);
          const a = [0, 0, 0], b = [0, 0, 0];
          for (const t of [0.1, 0.25, 0.4, PAGE_END, 0.6, FOLD_END, 0.9, 1]) {
            const FA = fA.at(t), FB = fB.at(t);
            let worst = 0;
            for (const [x, y] of pts) {
              const [rx, ry] = r(x, y);
              FA(x, y, mA.locate(x, y), a); FB(rx, ry, mB.locate(rx, ry), b);
              worst = Math.max(worst, dist3(a, b) / size);
            }
            st.points += pts.length;
            if (t >= PAGE_END) { st.worstAfter = Math.max(st.worstAfter, worst); if (!(worst < 1e-9)) note(`${label}: at t = ${t} a point and its mirror image land ${worst} tile sizes apart`); }
            else st.minBefore = Math.min(st.minBefore, worst);
          }
          // the colours: the mirrored one swaps, the other never
          const M = fA.mirrored ? fA : fB, U = fA.mirrored ? fB : fA, Ms = fA.mirrored ? s0 : s1;
          let prev = 0, maxStep = 0, from = null, to = null;
          for (let k = 0; k <= 200; k++) {
            const t = k / 200, mx = M.mirroredAt(t), mu = U.mirroredAt(t);
            if (mu !== 0) { note(`${label}: the unmirrored tile swaps ${mu} at t = ${t}`); break; }
            if (!(mx >= 0 && mx <= 1 && mx >= prev - 1e-12)) { note(`${label}: mirroredAt(${t}) = ${mx} after ${prev}`); break; }
            if (k) maxStep = Math.max(maxStep, mx - prev);
            if (from === null && mx > 0.05) from = t;
            if (to === null && mx > 0.95) to = t;
            prev = mx;
          }
          st.swaps++; st.maxMix = Math.max(st.maxMix, maxStep);
          if (M.mirroredAt(0) !== 0 || M.mirroredAt(PAGE_END) !== 1 || M.mirroredAt(0.7) !== 1 || M.mirroredAt(1) !== 1) note(`${label}: mirroredAt at 0 / PAGE_END / 0.7 / 1: ${[0, PAGE_END, 0.7, 1].map((t) => M.mirroredAt(t))}`);
          if (!(maxStep <= 0.25) || !(to - from >= 6 / 200)) note(`${label}: the swap moves ${maxStep} per 1/200 over t ${from} .. ${to}`);
          // where: the fixed piece turns away from the camera at tc = window end - SWAP_HALF (or no crossing: t = 0.2)
          const tc = M.swapWindow[1] - SWAP_HALF, e = 2e-4;
          const before = facingOf(M, tc - e, Ms), at = facingOf(M, tc, Ms), after = facingOf(M, tc + e, Ms);
          if (Math.abs(tc - 0.4 * PAGE_END) < 1e-12 && before > 0 && after > 0) {
            st.fallbacks++;
            let crossing = false;
            for (let k = 1; k <= 100 && !crossing; k++) if (!(facingOf(M, (k / 100) * (PAGE_END - SWAP_HALF), Ms) > 0)) crossing = true;
            if (crossing) note(`${label}: no swap at the moment the fixed piece turns away from the camera`);
          } else {
            st.crossings++; st.worstFacing = Math.max(st.worstFacing, Math.abs(at));
            if (!(before > 0 && after < 0 && Math.abs(at) < 1e-3)) note(`${label}: at t = ${tc} the fixed piece faces the camera by ${before} / ${at} / ${after}`);
          }
        }
      }
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 8).join('\n'));
  assert.ok(st.pairs >= 60 && st.crossings >= 40 && (st.corner || 0) < st.pairs / 4, `${st.pairs} pairs (${st.corner || 0} skipped: a corner swept), ${st.crossings} swaps at a crossing`);
  assert.ok(st.minBefore > 0.01, `before PAGE_END the two differ (the page turn is under way): at least ${st.minBefore}`);
  console.log(`      ${st.pairs} seed pairs across a mirror (${st.corner || 0} more skipped: the walks differ by a swept corner): from PAGE_END on the two shapes agree to ${st.worstAfter.toExponential(1)} tile sizes (before it they differ by >= ${st.minBefore.toFixed(3)}); ` +
    `${st.swaps} colour swaps, <= ${st.maxMix.toFixed(3)} per 1/200, ${st.crossings} centred where the fixed piece turns away from the camera (|facing| <= ${st.worstFacing.toExponential(1)}), ${st.fallbacks} with no such moment`);
});

test('anchor (SPEC 7) 3: no anchor, a malformed one, or the seed itself as the anchor give exactly the v1 fold', () => {
  for (const id of HINGE) {
    const group = BY_ID[id], rnd = prng(808 + GROUPS.indexOf(group));
    const cases = group.presets.flatMap((p) => AMPS.map((amp) => ({ seed: p.seed, amp })));
    for (let k = 0; k < 6; k++) cases.push({ seed: [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf], amp: 0 });
    for (const c of cases) {
      const domain = buildDomain(group, { seed: c.seed, warp: makeWarp(group, c.amp) }), mesh = buildMesh(group, domain);
      const ref = createFold(group, domain, mesh, {});
      const label = `${id} seed (${c.seed.map((v) => v.toFixed(4))}) amp ${c.amp}`;
      const variants = [[undefined, null], [null, null], [[NaN, 1], null], [[1, Infinity], null], ['ab', null], [[0.3], null], [{ x: 1 }, null],
        [domain.seed.slice(), domain.seed], [Float64Array.from(domain.seed), domain.seed]];
      for (const [anchor, used] of variants) {
        const f = createFold(group, domain, mesh, anchor === undefined ? {} : { anchor });
        const kin = f.kinematics;
        assert.deepEqual(f.anchor, used, `${label}: fold.anchor for ${JSON.stringify(anchor)}`);
        assert.ok(kin.walk.length === 0 && !kin.mirrored && f.mirrored === false && kin.flip === 0 && kin.anchorIso === kin.rootIso, `${label}: the frame for ${JSON.stringify(anchor)}`);
        for (const t of [0, 0.2, 0.55, FOLD_END, 0.9, 1]) {
          const A = f.at(t), B = ref.at(t), a = [0, 0, 0], b = [0, 0, 0];
          for (let v = 0; v < mesh.n; v++) {
            A(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], a); B(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], b);
            if (!Object.is(a[0], b[0]) || !Object.is(a[1], b[1]) || !Object.is(a[2], b[2])) assert.fail(`${label}: anchor ${JSON.stringify(anchor)} changes vertex ${v} at t = ${t}: ${a} vs ${b}`);
          }
        }
      }
    }
  }
});

test('anchor (SPEC 7) 4: hingeKinematics on 22x with an anchor (for the cross-cap) — the closed half-pillow is the anchor\'s; half-turn seams meet, glide seams are antipodal in pillow coordinates', () => {
  const group = BY_ID['22x'], K = kaleidoRef(group), size = Math.sqrt(group.domainArea);
  const bad = [];
  let n = 0, worst = 0, withWalk = 0;
  for (const amp of AMPS) {
    const warp = makeWarp(group, amp);
    for (const c of cases(group, 5)) {
      const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp }), mesh = buildMesh(group, domain);
      for (const p of group.presets) {
        const kin = hingeKinematics(group, mesh, { anchor: p.seed }), label = `${c.label} amp ${amp} anchor ${p.name}`;
        const F = closedMap(K, p.seed, kin.H), closed = kin.pose(PI, 1), a = [0, 0, 0], b = [0, 0, 0], q = [0, 0];
        n++;
        if (kin.walk.length) withWalk++;
        if (kin.mirrored) bad.push(`${label}: 22x has no mirror, yet eps = -1`);
        for (const [x, y] of tilePoints(domain, 30, prng(n), 1e-4 * size)) {
          closed(x, y, mesh.locate(x, y), a); F(x, y, b);
          worst = Math.max(worst, dist3(a, b) / size);
          if (!(dist3(a, b) < 1e-9 * size)) { bad.push(`${label}: pose(pi, 1) is not the anchor's half pillow at (${x}, ${y})`); break; }
        }
        for (let v = 0; v < mesh.n; v++) {
          kin.pillow(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], a);
          kin.unpillow(a[0], a[1], a[2], b);
          closed(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], a);
          if (dist3(a, b) > 1e-12) { bad.push(`${label}: unpillow(pillow) != pose(pi, 1)`); break; }
        }
        domain.edges.forEach((e, i) => {
          if (e.kind !== 'cut') return;
          const bi = mesh.boundary[i], bj = mesh.boundary[e.partner], k = bi.cells.length, gi = inverse(e.g), anti = det(e.g) < 0 ? -1 : 1;
          for (let j = 0; j < k; j++) {
            apply(gi, bi.pts[2 * j], bi.pts[2 * j + 1], q);
            kin.pillow(bi.pts[2 * j], bi.pts[2 * j + 1], bi.cells[j], a);
            kin.pillow(q[0], q[1], bj.cells[e.rev ? k - 1 - j : j], b);
            if (!(Math.hypot(a[0] - anti * b[0], a[1] - anti * b[1], a[2] - anti * b[2]) < 1e-6)) { bad.push(`${label}: edge ${i} sample ${j}: pillow ${a} vs ${anti < 0 ? 'the antipode of ' : ''}${b}`); return; }
          }
        });
      }
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 6).join('\n'));
  assert.ok(withWalk > n / 3, `walks on 22x: ${withWalk} of ${n}`);
  console.log(`      22x: ${n} anchored kinematics (${withWalk} with a walk): pose(pi, 1) vs the anchor's half pillow ${worst.toExponential(1)} tile sizes`);
});

// ===============================================================================================================
// Round 3: the presets and the captions of the eight hinge groups (qa/round3-triage.md, section "hinge")
// ===============================================================================================================

test('presets (contract C3, finding 15): with the anchor the app passes (preset.anchor ?? preset.seed), choosing another preset at t = 1 leaves the closed shape where it is — the same image of every plane point and the same camera frame — at both waves', () => {
  const bad = [];
  let compared = 0, frames = 0;
  for (const id of HINGE) {
    const group = BY_ID[id], size = Math.sqrt(group.domainArea), rnd = prng(1515 + GROUPS.indexOf(group));
    const pts = [];
    for (let k = 0; k < 8; k++) pts.push([group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf]);
    for (const amp of AMPS) {
      const warp = makeWarp(group, amp);
      let first = null;
      for (const p of group.presets) {
        const domain = buildDomain(group, { seed: p.seed, metric: p.metric, warp }), mesh = buildMesh(group, domain);
        const fold = createFold(group, domain, mesh, { anchor: p.anchor || p.seed });
        const F = fold.at(1), M = fold.mesh, out = [0, 0, 0];
        // the camera frame of src/app.js (mapScene): the centre and the extent of the box around the vertex positions
        const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        for (let v = 0; v < M.n; v++) {
          F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out);
          for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], out[a]); hi[a] = Math.max(hi[a], out[a]); }
        }
        const frame = [0, 1, 2].map((a) => (lo[a] + hi[a]) / 2), extent = [0, 1, 2].map((a) => hi[a] - lo[a]);
        // where fixed plane points go (the point of each orbit that lies in this tile)
        const images = pts.map(([x, y]) => {
          const X = orbitPointInTile(group, domain, x, y, 1e-6 * size);
          if (!X) return null;
          F(X[0], X[1], mesh.locate(X[0], X[1]), out);
          return out.slice();
        });
        if (!first) { first = { p, frame, extent, images }; continue; }
        const label = `${id} amp ${amp}: ${first.p.name} -> ${p.name}`;
        const df = dist3(frame, first.frame) / size, de = dist3(extent, first.extent) / size;
        frames++;
        if (!(df < 0.01 && de < 0.02)) bad.push(`${label}: the camera frame's centre moves ${df.toFixed(4)} tile sizes, its box changes by ${de.toFixed(4)}`);
        images.forEach((im, j) => {
          if (!im || !first.images[j]) return;
          compared++;
          const d = dist3(im, first.images[j]) / size;
          if (!(d < 1e-9)) bad.push(`${label}: the plane point (${pts[j]}) goes to (${im}) instead of (${first.images[j]})`);
        });
      }
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 8).join('\n'));
  assert.ok(compared > 100 && frames >= 2 * 14, `plane points compared ${compared}, frames ${frames}`);
});

test('preset names are true of their straight tiles and distinct within a group; every side of a preset tile shows (findings 16, 17, 18)', () => {
  /** The outline of a straight tile: sides, interior angles (degrees), parallel side pairs, bounding box. */
  const shapeOf = (poly) => {
    const n = poly.length, d = poly.map((a, i) => [poly[(i + 1) % n][0] - a[0], poly[(i + 1) % n][1] - a[1]]);
    const sides = d.map((v) => Math.hypot(v[0], v[1])), scale = Math.max(...sides);
    const eq = (a, b) => Math.abs(a - b) < 1e-9 * scale;
    const angles = d.map((v, i) => { const u = d[(i + n - 1) % n]; return 180 - (Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]) * 180) / PI; });
    let parallelPairs = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(d[i][0] * d[j][1] - d[i][1] * d[j][0]) < 1e-9 * sides[i] * sides[j]) parallelPairs++;
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const allEqual = sides.every((s) => eq(s, sides[0])), allRight = angles.every((a) => Math.abs(a - 90) < 1e-7);
    // a quadrilateral standing on a vertex: one diagonal upright (vertical) and the other level
    const upright = n === 4 && [0, 1].some((i) => Math.abs(poly[i][0] - poly[i + 2][0]) < 1e-9 * scale && Math.abs(poly[i + 1][1] - poly[(i + 3) % 4][1]) < 1e-9 * scale);
    const kite = n === 4 && ((eq(sides[0], sides[1]) && eq(sides[2], sides[3])) || (eq(sides[1], sides[2]) && eq(sides[3], sides[0])));
    return { n, sides, angles, eq, parallelPairs, allEqual, allRight, upright, kite, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  };
  const CLAIMS = {
    Triangle: (s) => s.n === 3,
    Equilateral: (s) => s.n === 3 && s.allEqual,
    Quad: (s) => s.n === 4,
    Rhombus: (s) => s.n === 4 && s.allEqual,
    Square: (s) => s.n === 4 && s.allEqual && s.allRight,
    Diamond: (s) => s.n === 4 && s.allEqual && s.upright,
    Kite: (s) => s.kite && !s.allEqual,
    Trapezoid: (s) => s.n === 4 && s.parallelPairs === 1,
    Pentagon: (s) => s.n === 5,
    Hexagon: (s) => s.n === 6,
    Tall: (s) => s.height > s.width,
  };
  // names that say how the tile folds (Envelope, Book, Pillowcase, Pocket) or where its seed lies (In between)
  const NO_CLAIM = new Set(['Envelope', 'Book', 'Pillowcase', 'Pocket', 'In between']);
  let checked = 0;
  for (const id of HINGE) {
    const group = BY_ID[id], size = Math.sqrt(group.domainArea), names = group.presets.map((p) => p.name);
    assert.equal(new Set(names).size, names.length, `${id}: two presets share a name (${names.join(', ')})`);
    for (const p of group.presets) {
      const s = shapeOf(buildDomain(group, { seed: p.seed, metric: p.metric }).poly);
      const what = `${s.n} sides ${s.sides.map((v) => v.toFixed(3)).join(' ')}, angles ${s.angles.map((v) => v.toFixed(1)).join(' ')}`;
      // every side and every corner shows: no side shorter than 15 % of the tile size, no corner flatter than 155 degrees
      assert.ok(Math.min(...s.sides) >= 0.15 * size && Math.max(...s.angles) <= 155, `${id} ${p.name}: ${what}`);
      if (NO_CLAIM.has(p.name)) continue;
      assert.ok(CLAIMS[p.name], `${id} ${p.name}: a name this test does not know; add what it claims to CLAIMS`);
      assert.ok(CLAIMS[p.name](s), `${id} ${p.name}: the name is not true of the tile (${what})`);
      checked++;
    }
  }
  assert.ok(checked >= 16, `names checked: ${checked}`);
});

test('captions (finding 19): the eight hinge groups in one pattern, read off the orbifold symbol — cone points before the ∗, mirror corners after it, every order named (the kaleidoscopes\' captions follow it too)', () => {
  const WORD = ['', 'one', 'two', 'three', 'four'];
  const list = (orders, one, many) => {
    if (orders.length === 1) return `a ${one} of order ${orders[0]}`;
    if (orders.every((o) => o === orders[0])) return `${WORD[orders.length]} ${many} of order ${orders[0]}`;
    return `${many} of order ${orders.join(', ')}`;
  };
  for (const id of HINGE) {
    const star = id.indexOf('*');
    const cones = [...(star < 0 ? id : id.slice(0, star))].map(Number), corners = star < 0 ? null : [...id.slice(star + 1)].map(Number);
    let want;
    if (!corners) want = `sphere with ${list(cones, 'cone point', 'cone points')}`;
    else {
      const parts = [];
      if (cones.length) parts.push(list(cones, 'cone point', 'cone points'));
      if (corners.length) parts.push(list(corners, 'mirror corner', 'mirror corners'));
      want = `disc with ${parts.join(' and ')}` + (corners.length ? '' : '; its rim is a mirror');
    }
    assert.equal(BY_ID[id].topology, want, id);
  }
});
