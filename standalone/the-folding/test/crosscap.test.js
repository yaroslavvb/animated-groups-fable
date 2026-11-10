// Tests for src/folds/crosscap.js (SPEC 5.3 requirements 1-4 and SPEC 5.6): 22x x every preset x 20 seeded-random
// seeds x amp in {0, 1}. Every fold is built once; each check records its failures under a name, and the tests
// below assert that each list is empty. CROSSCAP_SEEDS widens the sweep: CROSSCAP_SEEDS=100 node --test test/crosscap.test.js
// Round 2 (at the end of the file): the anchor (SPEC 7) and the legibility of stage 2 (design 'acts').
import test from 'node:test';
import assert from 'node:assert/strict';
import { BY_ID, contains, elementsNear, symmetryElements } from '../src/groups.js';
import { apply, inverse, det, compose, classify } from '../src/geom.js';
import { makeWarp, buildDomain } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import createFold, { crosscapSchedule, crosscapMap, actsTiming, anchorCell, ACTS, DESIGN, ROOT_SHIFT, ROOT_MIN, PUFF_START, HINGE_END, HALF_END, ZIP_START, HALF_STOP,
  crosscapTimes, TIMES_NO_CREASE, WORK, MIDDLE_LABEL, DOUBLE_FROM, ACTS_FREE, FLAPS } from '../src/folds/crosscap.js';

/**
 * Which way 22x folds, BY DESIGN: -1, toward -z (the final fix of 10 Nov 2026, notes/integrator-final.md § 7; SPEC 5.3's
 * exception). Its flaps tuck under the sheet that holds still, which carries the comma, so that the comma ends on top
 * (src/folds/crosscap.js THE PAINT); round 3 folded toward +z ('over') and hid it under the top sheet. Every sign check
 * of this file is round 3's, multiplied by this constant.
 */
const DESIGN_UP = -1;

const group = BY_ID['22x'];
const SEEDS = Math.max(20, +process.env.CROSSCAP_SEEDS || 20);
const AMPS = [0, 1];
const STEPS = 200;
const PI = Math.PI;
const size = Math.sqrt(group.domainArea);

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

function* cases() {
  for (const [i, p] of group.presets.entries()) yield { label: `preset ${i} (${p.name})`, seed: p.seed, metric: p.metric, preset: i };
  const rnd = prng(424242);
  for (let k = 0; k < SEEDS; k++) {
    const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
    yield { label: `random seed ${k} (${seed[0].toFixed(4)}, ${seed[1].toFixed(4)})`, seed, metric: undefined, preset: -1 };
  }
}

const NAMES = ['api', 'identity', 'seams', 'seamsStages', 'continuity', 'smooth', 'boundaries', 'finite', 'invariance', 'pieces', 'upward', 'near', 'pillow'];
const failures = Object.fromEntries(NAMES.map((k) => [k, []]));
const fail = (name, msg) => { failures[name].push(msg); };
const show = (name) => failures[name].slice(0, 6).join('\n') + (failures[name].length > 6 ? `\n... ${failures[name].length} failures` : '');
const stats = { minRoot: Infinity, maxDeep: [0, 0], kinds: {}, trisBefore: 0, trisAfter: 0, maxTris: 0, folds: 0, vertices: 0, maxSeam: 0, maxSeamLocate: 0, maxStep: 0, maxStepRel: 0, maxAccRel: 0, maxInv: 0, invPoints: 0, single: 0, nearHalf: 0, maxDepth: 0, maxPieceGap: 0, stepRatio: 0,
  works: { one: 0, zero: 0, between: 0 }, minRest: Infinity, maxStopGap: 0 };

// ---- the schedule: its largest rates and accelerations per unit of t, measured on the schedule itself (the
//      schedule test below bounds them by fixed numbers, so a jump in the schedule cannot hide here). Round 3: the
//      schedule depends on the work of stage 1 (fold.work: 1 with a crease to fold, 0 for the Bowl), so the rates are
//      measured per work; TH1 ... SQ are those of work 1, the default.
const RATES = new Map();
function ratesOf(work = 1) {
  if (RATES.has(work)) return RATES.get(work);
  const R = { TH1: 0, TH2: 0, BE1: 0, BE2: 0, S1: 0, S2: 0, SQ: 0 };
  const N = 40000, h = 1 / N, S = (t) => crosscapSchedule(t, [0, 0, 0], work);
  let p = S(0), c = S(h);
  for (let k = 1; k < N; k++) {
    const nx = S((k + 1) * h);
    R.TH1 = Math.max(R.TH1, Math.abs(nx[0] - c[0]) / h, Math.abs(c[0] - p[0]) / h); R.BE1 = Math.max(R.BE1, Math.abs(nx[1] - c[1]) / h, Math.abs(c[1] - p[1]) / h);
    R.S1 = Math.max(R.S1, Math.abs(nx[2] - c[2]) / h, Math.abs(c[2] - p[2]) / h);
    R.TH2 = Math.max(R.TH2, Math.abs(nx[0] - 2 * c[0] + p[0]) / (h * h)); R.BE2 = Math.max(R.BE2, Math.abs(nx[1] - 2 * c[1] + p[1]) / (h * h));
    R.S2 = Math.max(R.S2, Math.abs(nx[2] - 2 * c[2] + p[2]) / (h * h));
    // s'^2 / (1 - s): bounded because the zip lands on a parabola; it bounds the acceleration of the twist (see below)
    if (nx[2] < 1) R.SQ = Math.max(R.SQ, ((nx[2] - p[2]) / (2 * h)) ** 2 / (1 - c[2]));
    p = c; c = nx;
  }
  RATES.set(work, R);
  return R;
}
const { TH1, TH2, BE1, BE2, S1, S2, SQ } = ratesOf(1);
// the two inner times of stage 1 with a crease: the hinges close (from here on the half-turn seams are closed); the
// puff starts. A fold's own times are fold.times (crosscapTimes(fold.work)).
const T_CLOSED = HINGE_END, T_PUFF = PUFF_START;

function checkFold(domain, mesh, label, amp, presetIndex) {
  const cells = mesh.cells, P = cells.length;
  const fold = createFold(group, domain, mesh, {});
  // everything below is checked on the mesh the fold hands back: the one that is drawn
  const fm = fold.mesh, { n, xy, cell } = fm;
  const kin = fold.kinematics, fr = fold.frame, map = fold.finalMap;
  // the fold's own times and the rates of its schedule (round 3: they depend on the work of stage 1)
  const TM = fold.times, R1 = ratesOf(fold.work);
  if (!(fold.work >= 0 && fold.work <= 1) || JSON.stringify(TM) !== JSON.stringify(crosscapTimes(fold.work))) fail('api', `${label}: work ${fold.work}, times ${JSON.stringify(TM)}`);
  stats.works[fold.work === 1 ? 'one' : fold.work === 0 ? 'zero' : 'between']++;
  stats.folds++; stats.vertices += n;
  if (P === 1) stats.single++;
  const depthMax = Math.max(1, ...kin.depth);
  stats.maxDepth = Math.max(stats.maxDepth, depthMax);
  const out = [0, 0, 0], o2 = [0, 0, 0], q = [0, 0];
  const diam = Math.hypot(mesh.bbox[2] - mesh.bbox[0], mesh.bbox[3] - mesh.bbox[1]);

  // ---- the interface
  // fold.mesh: the same pieces, creases and locator; the old vertices first, new ones in the middles of old edges
  // (finer triangles next to the great circle eta = 0); the same region, still one disc without T-junctions
  if (fm.cells !== mesh.cells || fm.creases !== mesh.creases || fm.locate !== mesh.locate || fm.domain !== mesh.domain) fail('api', `${label}: fold.mesh does not share pieces, creases and locate with the mesh`);
  if (!(fm.n >= mesh.n) || fm.xy.length !== 2 * fm.n || fm.cell.length !== fm.n || fm.tri.length !== 3 * fm.m || fm.triCell.length !== fm.m) fail('api', `${label}: fold.mesh arrays`);
  else {
    for (let v = 0; v < 2 * mesh.n; v++) if (fm.xy[v] !== mesh.xy[v]) { fail('api', `${label}: fold.mesh moved an old vertex`); break; }
    for (let v = 0; v < mesh.n; v++) if (fm.cell[v] !== mesh.cell[v]) { fail('api', `${label}: fold.mesh changed the piece of an old vertex`); break; }
    const census = (M) => {
      const count = new Map();
      let area = 0, minArea = Infinity;
      for (let t = 0; t < M.tri.length / 3; t++) {
        const a = M.tri[3 * t], b = M.tri[3 * t + 1], c = M.tri[3 * t + 2];
        const ar = ((M.xy[2 * b] - M.xy[2 * a]) * (M.xy[2 * c + 1] - M.xy[2 * a + 1]) - (M.xy[2 * b + 1] - M.xy[2 * a + 1]) * (M.xy[2 * c] - M.xy[2 * a])) / 2;
        area += ar; minArea = Math.min(minArea, ar);
        for (const [u, w] of [[a, b], [b, c], [c, a]]) { const k = u < w ? u * M.n + w : w * M.n + u; count.set(k, (count.get(k) || 0) + 1); }
      }
      let rim = 0, rimLen = 0, over = 0;
      for (const [k, c] of count) {
        if (c > 2) over++;
        if (c !== 1) continue;
        const u = Math.floor(k / M.n), w = k % M.n;
        rim++; rimLen += Math.hypot(M.xy[2 * u] - M.xy[2 * w], M.xy[2 * u + 1] - M.xy[2 * w + 1]);
      }
      return { area, minArea, edges: count.size, rim, rimLen, over, tris: M.tri.length / 3 };
    };
    const c0 = census(mesh), c1 = census(fm);
    stats.trisBefore += c0.tris; stats.trisAfter += c1.tris; stats.maxTris = Math.max(stats.maxTris, c1.tris);
    if (Math.abs(c1.area - c0.area) > 1e-6 * group.domainArea) fail('api', `${label}: fold.mesh covers ${c1.area}, the mesh ${c0.area}`);
    if (c1.minArea < -1e-12) fail('api', `${label}: fold.mesh has a triangle turned over (${c1.minArea})`);
    if (c1.over || c0.over) fail('api', `${label}: an edge with more than two triangles`);
    // a hanging vertex would show as extra rim: the rim is as long as before, and the mesh is still a disc
    if (Math.abs(c1.rimLen - c0.rimLen) > 1e-5 * size) fail('api', `${label}: the rim of fold.mesh is ${c1.rimLen} long, the mesh's ${c0.rimLen} (a T-junction?)`);
    if (fm.n - c1.edges + c1.tris !== mesh.n - c0.edges + c0.tris) fail('api', `${label}: Euler characteristic ${fm.n - c1.edges + c1.tris} after refining, ${mesh.n - c0.edges + c0.tris} before`);
    for (let t = 0; t < fm.m; t += 7) {
      const a = fm.tri[3 * t], b = fm.tri[3 * t + 1], c = fm.tri[3 * t + 2];
      if (fm.triCell[t] >= P) { fail('api', `${label}: triCell`); break; }
      // (a triangle of a micro-lobe can be too thin for locate to tell it from its neighbour: skip those)
      const ar = (fm.xy[2 * b] - fm.xy[2 * a]) * (fm.xy[2 * c + 1] - fm.xy[2 * a + 1]) - (fm.xy[2 * b + 1] - fm.xy[2 * a + 1]) * (fm.xy[2 * c] - fm.xy[2 * a]);
      if (ar > 1e-8 && mesh.locate((fm.xy[2 * a] + fm.xy[2 * b] + fm.xy[2 * c]) / 3, (fm.xy[2 * a + 1] + fm.xy[2 * b + 1] + fm.xy[2 * c + 1]) / 3) !== fm.triCell[t]) { fail('api', `${label}: a triangle of fold.mesh is not in its piece`); break; }
    }
  }
  if (fm.boundary.length !== mesh.boundary.length) fail('api', `${label}: fold.mesh.boundary length`);
  else {
    let finest = 0;
    fm.boundary.forEach((b, i) => {
      const b0 = mesh.boundary[i], e = domain.edges[i], M = b.cells.length - 1, m0 = b0.cells.length - 1, k = M / m0;
      if (b.edge !== i || b.cls !== b0.cls || b.kind !== b0.kind || !(b.pts instanceof Float32Array) || !(b.cells instanceof Uint16Array) || b.pts.length !== 2 * (M + 1)) { fail('api', `${label}: fold.mesh.boundary[${i}] record`); return; }
      if (!Number.isInteger(k) || k < 1 || M % 2) { fail('api', `${label}: edge ${i} resampled ${m0} -> ${M} steps`); return; }
      if (fm.boundary[e.partner].cells.length !== b.cells.length) fail('api', `${label}: partners of edge ${i} have different sample counts`);
      for (let j = 0; j <= M; j++) {
        const p = domain.edgePoint(i, j / M);
        if (Math.hypot(p[0] - b.pts[2 * j], p[1] - b.pts[2 * j + 1]) > 1e-6 || b.cells[j] >= P) { fail('api', `${label}: sample ${j} of edge ${i} is not on the edge`); break; }
        if (j > 0) finest = Math.max(finest, Math.hypot(b.pts[2 * j] - b.pts[2 * j - 2], b.pts[2 * j + 1] - b.pts[2 * j - 1]));
      }
    });
    if (!(finest < size / 60)) fail('api', `${label}: boundary samples ${finest / size} tile sizes apart`);
  }
  const st = fold.stops;
  if (!Array.isArray(st) || st.length !== 3 || st[0].t !== 0 || st[2].t !== 1 || st[1].t !== TM.halfStop || st[1].label !== MIDDLE_LABEL || st.some((s) => typeof s.label !== 'string' || !s.label)) fail('api', `${label}: stops ${JSON.stringify(st)}`);
  if (!(fold.duration >= 4 && fold.duration <= 7)) fail('api', `${label}: duration ${fold.duration}`);
  if (typeof fold.at(0.3) !== 'function' || fold.at(0.3)(xy[0], xy[1], cell[0], out) !== out || fold.at(0.8)(xy[0], xy[1], cell[0], out) !== out) fail('api', `${label}: at(t) must return fn(x, y, cell, out) -> out`);
  if (typeof fold.doubleLine !== 'function') fail('api', `${label}: no doubleLine`);

  // ---- 1. at(0) is the identity, exactly
  for (const t0 of [0, -0, -0.25, NaN]) {
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

  // ---- 2. seams close at t = 1: half-turn edges and glide edges, two ways of choosing the pieces
  let cx = 0, cy = 0;
  for (const p of domain.poly) { cx += p[0] / domain.poly.length; cy += p[1] / domain.poly.length; }
  const inwardPiece = (x, y) => {
    domain.warp.inv(x, y, q);
    const dx = cx - q[0], dy = cy - q[1], l = Math.hypot(dx, dy) || 1;
    domain.warp.fwd(q[0] + (1e-6 * dx) / l, q[1] + (1e-6 * dy) / l, q);
    return mesh.locate(q[0], q[1]);
  };
  /** Largest gap over the cut edges of one kind: 'half' (glued by a half-turn), 'glide', or both. */
  const seamGap = (F, viaLocate, kind) => {
    let gap = 0, min = Infinity;
    for (let i = 0; i < domain.edges.length; i++) {
      const e = domain.edges[i];
      if (e.kind !== 'cut') continue;
      const isGlide = det(e.g) < 0;
      if ((kind === 'half' && isGlide) || (kind === 'glide' && !isGlide)) continue;
      const bi = fold.mesh.boundary[i], bj = fold.mesh.boundary[e.partner], k = bi.cells.length, gi = inverse(e.g);
      let edgeMax = 0;
      for (let j = 0; j < k; j++) {
        const x = bi.pts[2 * j], y = bi.pts[2 * j + 1];
        apply(gi, x, y, q);
        const jj = e.rev ? k - 1 - j : j;
        if (Math.hypot(q[0] - bj.pts[2 * jj], q[1] - bj.pts[2 * jj + 1]) > 2e-6) gap = NaN;   // the partner's sample is the same point of the plane
        const x2 = q[0], y2 = q[1];
        const c1 = viaLocate ? inwardPiece(x, y) : bi.cells[j], c2 = viaLocate ? inwardPiece(x2, y2) : bj.cells[jj];
        F(x, y, c1, out); F(x2, y2, c2, o2);
        const d = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]);
        if (!(d <= gap)) gap = d;       // NaN sticks
        if (d > edgeMax) edgeMax = d;
      }
      min = Math.min(min, edgeMax);
    }
    return { gap, min };
  };
  const F1 = fold.at(1);
  const g1 = seamGap(F1, false).gap, g2 = seamGap(F1, true).gap;
  stats.maxSeam = Math.max(stats.maxSeam, g1 / size); stats.maxSeamLocate = Math.max(stats.maxSeamLocate, g2 / size);
  if (!(g1 < 1e-6 * size)) fail('seams', `${label}: seam gap ${g1} at t = 1 (pieces of the boundary samples)`);
  if (!(g2 < 1e-6 * size)) fail('seams', `${label}: seam gap ${g2} at t = 1 (pieces from mesh.locate of the nudged points)`);
  const hasHalf = domain.edges.some((e) => e.kind === 'cut' && det(e.g) > 0);
  if (!domain.edges.some((e) => e.kind === 'cut' && det(e.g) < 0)) fail('seams', `${label}: the tile has no glide edge`);
  // the half-turn seams close in stage 1 and stay closed; every glide seam is open until the very end
  for (const t of [TM.hingeEnd, TM.zipStart, (TM.zipStart + TM.halfEnd) / 2, TM.halfEnd, TM.halfStop, 0.6, 0.8, 0.97]) {
    const g = seamGap(fold.at(t), false, 'half').gap;
    if (!(g < 1e-6 * size)) fail('seamsStages', `${label}: half-turn seam gap ${g} at t = ${t}`);
  }
  if (hasHalf && !(seamGap(fold.at(0.5 * TM.hingeEnd), false, 'half').gap > 1e-3 * size)) fail('seamsStages', `${label}: the half-turn seams are closed half-way through stage 1`);
  for (const t of [TM.halfStop, 0.7, 0.9]) {
    const g = seamGap(fold.at(t), false, 'glide').min;
    if (!(g > 1e-4 * size)) fail('seamsStages', `${label}: a glide seam is already closed at t = ${t} (${g})`);
  }

  // ---- 3. continuity: 200 steps; the largest step is bounded by the speed of the motion, the largest second
  //         difference by its acceleration (a jump of the position or of the velocity would break one of them)
  const hz = fr.hz, gam = map.gamma, R = Math.hypot(fr.hx, hz * Math.max(1, gam));
  const speed1 = depthMax * R1.TH1 * (diam + kin.hMax) + R1.BE1 * kin.hMax;
  const accel1 = (depthMax * R1.TH2 + depthMax * depthMax * R1.TH1 * R1.TH1) * (diam + kin.hMax) + 2 * depthMax * R1.TH1 * R1.BE1 * kin.hMax + R1.BE2 * kin.hMax;
  // stage 2, per unit of s: |dF/ds| <= 1 + 1.5 pi, |d2F/ds2| <= 60 / (1 - s) for the twisting factor F (far half: 1 and 0)
  const KF = 1 + 1.5 * PI, dPds = KF * R + hz * Math.abs(gam - 1) + fr.hy * (2 + Math.abs(map.mu));
  const speed2 = R1.S1 * dPds;
  const accel2 = R1.S2 * dPds + R1.S1 * R1.S1 * 2 * KF * hz * Math.abs(gam - 1) + R1.SQ * 60 * R;
  const speed = Math.max(speed1, speed2), accel = Math.max(accel1, accel2);
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
  const steps = [];
  nonFinite += fill(1 / STEPS, B);
  worstStep = maxDiff(A, B); travelled += worstStep; steps.push(worstStep);
  for (let k = 2; k <= STEPS; k++) {
    nonFinite += fill(k / STEPS, C);
    const d = maxDiff(B, C), a2 = maxDiff2(A, B, C);
    travelled += d; steps.push(d);
    if (d > worstStep) worstStep = d;
    if (a2 > worstAcc) worstAcc = a2;
    const T = A; A = B; B = C; C = T;
  }
  stats.maxStep = Math.max(stats.maxStep, worstStep / diam);
  stats.maxStepRel = Math.max(stats.maxStepRel, worstStep / (speed / STEPS));
  stats.maxAccRel = Math.max(stats.maxAccRel, worstAcc / (accel / (STEPS * STEPS)));
  // "of the same order throughout": the largest step against the median step of the moving part
  const moving = steps.filter((d) => d > 1e-9 * size).sort((a, b) => a - b);
  stats.stepRatio = Math.max(stats.stepRatio, worstStep / moving[moving.length >> 1]);
  if (nonFinite) fail('finite', `${label}: ${nonFinite} non-finite positions over ${STEPS} steps`);
  if (!(worstStep <= (1.02 * speed) / STEPS)) fail('continuity', `${label}: a step of ${worstStep} (bound ${speed / STEPS})`);
  if (!(worstStep <= 0.05 * diam)) fail('continuity', `${label}: a step of ${(worstStep / diam).toFixed(4)} tile diameters`);
  if (!(worstStep <= 12 * moving[moving.length >> 1])) fail('continuity', `${label}: the largest step is ${(worstStep / moving[moving.length >> 1]).toFixed(1)} times the median step`);
  if (!(travelled > 0.2 * size)) fail('continuity', `${label}: nothing moves (${travelled})`);
  if (!(worstAcc <= (1.05 * accel) / (STEPS * STEPS))) fail('smooth', `${label}: second difference ${worstAcc} (bound ${accel / (STEPS * STEPS)})`);
  // at the ends, at the stage boundaries and at the inner times of stage 1: positions and velocities are continuous at a scale of 1e-5
  const E = 1e-5;
  for (const t0 of [0, TM.puffStart, TM.hingeEnd, TM.zipStart, TM.halfEnd, TM.halfStop, 1]) {
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
  // round 3 (finding 13): no pause. The zip starts while the puff is still landing, so nothing rests anywhere in
  // (0, 1): each of the 200 steps but the last two moves something by at least 1 % of the median step, and those two
  // (the landing: at rest only at t = 1 itself) move something. Round 2 had a pause of 12 steps that moved nothing at
  // all, and a landing in which the last 8 steps moved less than 1 %.
  {
    const med = steps.slice().sort((a, b) => a - b)[steps.length >> 1];
    let least = Infinity, at = -1;
    steps.forEach((d, i) => { if (i < STEPS - 2 && d < least) { least = d; at = i; } });
    stats.minRest = Math.min(stats.minRest, least / med);
    if (!(least >= 0.01 * med)) fail('boundaries', `${label}: the step to t = ${(at + 1) / STEPS} moves ${(least / med).toExponential(1)} median steps: the shape rests there`);
    if (!(steps[STEPS - 2] > 1e-6 * med && steps[STEPS - 1] > 1e-6 * med)) fail('boundaries', `${label}: the last steps do not move (${steps[STEPS - 2]}, ${steps[STEPS - 1]})`);
  }
  // ---- 4. more exact times: just inside the ends, the stage boundaries themselves, and beyond the ends
  for (const t of [1e-300, 1e-12, 1e-6, T_PUFF, T_CLOSED, HALF_END, HALF_STOP, ZIP_START, ZIP_START + 1e-12, TM.puffStart, TM.hingeEnd, TM.zipStart, TM.zipStart + 1e-12, TM.halfEnd - 1e-12, TM.halfEnd, 1 - 1e-12, 1, 1.5, Infinity]) {
    if (fill(t, A)) fail('finite', `${label}: non-finite positions at t = ${t}`);
    const F = fold.at(t);
    for (const b of fold.mesh.boundary) {
      for (let k = 0; k < b.cells.length; k++) {
        F(b.pts[2 * k], b.pts[2 * k + 1], b.cells[k], out);
        if (!Number.isFinite(out[0] + out[1] + out[2])) { fail('finite', `${label}: non-finite boundary point at t = ${t}`); break; }
      }
    }
    const dl = fold.doubleLine(t);
    if (!(dl instanceof Float32Array) || dl.length % 3 || dl.some((v) => !Number.isFinite(v))) fail('finite', `${label}: doubleLine(${t})`);
  }
  fill(1e-12, A); fill(0, B);
  if (maxDiff(A, B) > 1e-9) fail('boundaries', `${label}: at(1e-12) is not next to at(0)`);
  fill(1 - 1e-12, A); fill(1, B);
  if (maxDiff(A, B) > 1e-9) fail('boundaries', `${label}: at(1 - 1e-12) is not next to at(1)`);

  // ---- at(1) is invariant under the group: random points of the plane around the tile, the two glides, the
  //      half-turn and products of them; the piece handed over is whatever mesh.locate says (it does not matter)
  const rnd = prng(1000 + stats.folds);
  for (let k = 0; k < 60; k++) {
    // a point of the tile (a random point of a random triangle) or a point next to it
    let x, y;
    if (k % 3) {
      const t = Math.floor(rnd() * fm.m), a = fm.tri[3 * t], b = fm.tri[3 * t + 1], c = fm.tri[3 * t + 2];
      let u = rnd(), w = rnd();
      if (u + w > 1) { u = 1 - u; w = 1 - w; }
      x = xy[2 * a] + u * (xy[2 * b] - xy[2 * a]) + w * (xy[2 * c] - xy[2 * a]); y = xy[2 * a + 1] + u * (xy[2 * b + 1] - xy[2 * a + 1]) + w * (xy[2 * c + 1] - xy[2 * a + 1]);
    } else { x = mesh.bbox[0] + rnd() * (mesh.bbox[2] - mesh.bbox[0]); y = mesh.bbox[1] + rnd() * (mesh.bbox[3] - mesh.bbox[1]); }
    F1(x, y, mesh.locate(x, y), out);
    // every element of the group that moves the point by at most one lattice period: the half-turns about the
    // centres nearby, the glides along both families of axes (and their inverses), translations
    const elems = elementsNear(group, x, y, 1.05 * Math.max(group.e1[0], group.e2[1]), x, y);
    for (const g of elems) {
      const kind = classify(g).type;
      if (kind === 'identity') continue;
      stats.kinds[kind] = (stats.kinds[kind] || 0) + 1;
      apply(g, x, y, q);
      F1(q[0], q[1], mesh.locate(q[0], q[1]), o2);
      const d = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]);
      stats.maxInv = Math.max(stats.maxInv, d / size); stats.invPoints++;
      // (a point within 1e-12 of a side of the cell has a height that is the square root of a rounding error)
      if (!(d < 1e-7 * size)) { fail('invariance', `${label}: at(1) differs by ${d} between (${x}, ${y}) and its image under a ${classify(g).type}`); break; }
    }
    // and a wrong piece index does not matter either, at any time of stage 2 once the puff has landed
    for (const t of [TM.halfStop, 0.7, 1]) {
      const F = fold.at(t);
      F(x, y, mesh.locate(x, y), out); F(x, y, (mesh.locate(x, y) + 1) % P, o2);
      const d = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]);
      stats.maxPieceGap = Math.max(stats.maxPieceGap, d / size);
      if (!(d < 1e-7 * size)) { fail('pieces', `${label}: at(${t}) depends on the piece handed over: ${d}`); break; }
    }
  }

  // ---- the fold goes toward +z: at the start of stage 1 nothing dips below the plane and something rises (unless
  //      the tile is one piece: it only puffs); the half pillow lies on the fixed cell, the fixed sheet below.
  //      Round 3: a tile without a crease to fold (work < 1: the Bowl and its wavy and nudged cuts) puffs from t = 0
  //      on purpose (finding 2: the first frames must move); its flaps, if any, still rise.
  // BY DESIGN 22x folds toward -z (the final fix of 10 Nov 2026: src/folds/crosscap.js FLAPS = 'under', SPEC 5.3's
  // exception): the motion is round 3's mirrored in z = 0, so these are round 3's checks turned over with it (DESIGN_UP
  // = -1), not a sign the fold reports about itself; a fold that does not say 'under' fails here.
  const up = DESIGN_UP;
  if (fold.flaps !== 'under') fail('upward', `${label}: the fold reports flaps '${fold.flaps}', not the design's 'under'`);
  if (P > 1) {
    const F = fold.at(0.25 * T_PUFF);
    let top = -Infinity, low = 0;
    for (let v = 0; v < n; v++) { F(xy[2 * v], xy[2 * v + 1], cell[v], out); top = Math.max(top, up * out[2]); if (kin.depth[cell[v]] <= 1) low = Math.min(low, up * out[2]); }
    if (fold.work === 1 && low < -1e-7 * size) fail('upward', `${label}: a first-generation flap dips to z = ${low} at the start`);
    if (!(top > 1e-4 * size)) fail('upward', `${label}: nothing rises at the start`);
  }
  if (fold.work < 1) {
    // the puff answers at once: the fixed piece sags from the first instant
    const F = fold.at(0.02);
    let low = 0;
    for (let v = 0; v < n; v++) { F(xy[2 * v], xy[2 * v + 1], cell[v], out); if (cell[v] === kin.root) low = Math.min(low, up * out[2]); }
    if (!(low < -0.02 * (1 - fold.work) * kin.hMax)) fail('upward', `${label}: work ${fold.work}: the puff has not started at t = 0.02 (z ${low})`);
  }
  // the state between the two stages (fold.halfPillow = stage 1 complete) is half of the pillow; the motion passes
  // within 1.5 % of the cell of it at the middle stop (the zip has just begun there: no pause, finding 13)
  const FH = fold.halfPillow, FS = fold.at(TM.halfStop);
  let nearCount = 0;
  for (let v = 0; v < n; v++) {
    const x = xy[2 * v], y = xy[2 * v + 1];
    FS(x, y, cell[v], o2);
    FH(x, y, cell[v], out);
    const gapStop = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]) / Math.max(fr.hx, fr.hy);
    stats.maxStopGap = Math.max(stats.maxStopGap, gapStop);
    if (!(gapStop <= 0.015)) { fail('pillow', `${label}: at the middle stop a vertex is ${gapStop} cells from the half pillow`); break; }
    const xi = (out[0] - fr.xc) / fr.hx, eta = (out[1] - fr.yc) / fr.hy, zeta = (up * out[2]) / fr.hz;
    if (!(Math.abs(xi) <= 1 + 1e-6 && Math.abs(eta) <= 1 + 1e-6 && Math.abs(zeta) <= 1 + 1e-6)) { fail('pillow', `${label}: the half pillow leaves the fixed cell: (${xi}, ${eta}, ${zeta})`); break; }
    if (Math.abs(zeta * zeta - (1 - xi * xi) * (1 - eta * eta)) > 1e-6) { fail('pillow', `${label}: the half pillow is not the pillow: zeta^2 = ${zeta * zeta} at (${xi}, ${eta})`); break; }
    if (Math.abs(zeta) > 0.02 && (zeta > 0) !== !!(kin.depth[cell[v]] & 1)) { fail('pillow', `${label}: vertex ${v} of a depth-${kin.depth[cell[v]]} piece is at zeta = ${zeta}`); break; }
    if (eta < -1e-3) nearCount++;
  }
  if (nearCount) stats.nearHalf++;
  // the closed shape stays where the fixed cell is: within its footprint, on the far half of it
  for (let v = 0; v < n; v++) {
    F1(xy[2 * v], xy[2 * v + 1], cell[v], out);
    const M = (out[0] - fr.xc) / fr.hx, D = (out[1] - fr.yc) / fr.hy, V = out[2] / fr.hz;
    if (!(Math.abs(M) <= 1 + 1e-9 && D >= -1e-9 && D <= 1 + 1e-9 && Math.abs(V) <= 0.75 * gam)) { fail('near', `${label}: the closed shape leaves the far half of the fixed cell: (${M}, ${D}, ${V})`); break; }
  }
  // and the fixed cell is the cell of the seed, or the one in front of it when the seed is less than ROOT_SHIFT hy
  // behind the crease between the two
  {
    const sxi = (domain.seed[0] - fr.xc) / fr.hx, seta = (domain.seed[1] - fr.yc) / fr.hy;
    if (!(Math.abs(sxi) <= 1 + 1e-9 && seta >= -1 - 1e-9 && seta <= 1 + ROOT_SHIFT + 1e-9)) fail('near', `${label}: the seed is at (xi, eta) = (${sxi}, ${seta}) of the fixed cell`);
    stats.minRoot = Math.min(stats.minRoot, cells[kin.root].area / group.domainArea);
    for (let i = 0; i < P; i++) if (kin.depth[i] >= 2) stats.maxDeep[amp ? 1 : 0] = Math.max(stats.maxDeep[amp ? 1 : 0], cells[i].area / group.domainArea);
  }
  return fold;
}

const built = [];
for (const amp of AMPS) {
  const warp = makeWarp(group, amp);
  for (const c of cases()) {
    const label = `22x ${c.label} amp ${amp}`;
    try {
      const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp });
      const mesh = buildMesh(group, domain);
      const fold = checkFold(domain, mesh, label, amp, c.preset);
      if (c.preset >= 0) built.push({ amp, preset: c.preset, domain, mesh, fold });
    } catch (err) {
      fail('api', `${label}: threw ${err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err}`);
    }
  }
}

test('crosscap: the fold interface — mesh, three stops (0, the pause, 1), duration, at(t) -> fn(x, y, cell, out), doubleLine', () => assert.equal(failures.api.length, 0, show('api')));
test('crosscap 1: at(0) is the identity, exactly (vertices and boundary samples)', () => assert.equal(failures.identity.length, 0, show('identity')));
test('crosscap 2: seams close at t = 1 — half-turn edges and glide edges coincide within 1e-6 tile sizes (two ways of choosing the pieces)', () => assert.equal(failures.seams.length, 0, show('seams')));
test('crosscap 2b: the half-turn seams close in stage 1 and stay closed; every glide seam stays open until the end', () => assert.equal(failures.seamsStages.length, 0, show('seamsStages')));
test('crosscap 3: continuity — over 200 steps every step is within the speed bound, below 5 % of the tile, and at most 12 median steps', () => assert.equal(failures.continuity.length, 0, show('continuity')));
test('crosscap 3b: smoothness — second differences within the acceleration bound (no jump of the velocity)', () => assert.equal(failures.smooth.length, 0, show('smooth')));
test('crosscap 3c: no jump of position or velocity at t = 0, the inner times of stage 1, the two ends of the pause, 1 (steps of 1e-5); nothing moves in the pause', () => assert.equal(failures.boundaries.length, 0, show('boundaries')));
test('crosscap 4: no NaN / Infinity for any t, including the exact stage boundaries and beyond the ends', () => assert.equal(failures.finite.length, 0, show('finite')));
test('crosscap: at(1) is invariant under both glides, the half-turn and their products, at random points in and around the tile', () => assert.equal(failures.invariance.length, 0, show('invariance')));
test('crosscap: the piece index handed over does not matter in stage 2 (the map is a function of the pillow point)', () => assert.equal(failures.pieces.length, 0, show('pieces')));
test('crosscap: by design the fold goes toward -z (DESIGN_UP; the flaps tuck under the sheet that holds still)', () => assert.equal(failures.upward.length, 0, show('upward')));

test('crosscap: the direction is the design\'s, not the fold\'s own say — FLAPS is \'under\', every default fold reports it, its first-generation flaps go below the plane at the start and nothing of them above; round 3\'s direction (\'over\') fails the same check', () => {
  assert.equal(FLAPS, 'under', 'src/folds/crosscap.js FLAPS');
  const out = [0, 0, 0];
  // the extreme heights of the first-generation flaps at a quarter of the way to the puff, on the design's side (up)
  const flapSides = (fold) => {
    const kin = fold.kinematics, F = fold.at(0.25 * T_PUFF), M = fold.mesh;
    let own = 0, other = 0;
    for (let v = 0; v < M.n; v++) {
      if (kin.depth[M.cell[v]] !== 1) continue;
      F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out);
      own = Math.max(own, DESIGN_UP * out[2]); other = Math.max(other, -DESIGN_UP * out[2]);
    }
    return { own, other };
  };
  let checked = 0;
  for (const [i, p] of group.presets.entries()) {
    const domain = buildDomain(group, { seed: p.seed, metric: p.metric, warp: makeWarp(group, 0) });
    const mesh = buildMesh(group, domain);
    const fold = createFold(group, domain, mesh, { anchor: p.seed });
    assert.equal(fold.flaps, 'under', `${p.name}: the default fold`);
    if (fold.work < 1) continue;                               // the Bowl: no crease, no flap
    const d = flapSides(fold), o = flapSides(createFold(group, domain, mesh, { anchor: p.seed, flaps: 'over' }));
    assert.ok(d.own > 0.05 * size && d.other < 1e-7 * size, `${p.name}: its flaps go ${d.own / size} tile sizes to the design's side and ${d.other / size} to the other`);
    assert.ok(!(o.own > 0.05 * size && o.other < 1e-7 * size), `${p.name}: control: round 3's flaps ('over') pass the check (${o.own}, ${o.other})`);
    checked++;
  }
  assert.ok(checked >= 2, `${checked} presets with flaps checked`);
});
test('crosscap: at the pause the tile is half of the pillow over the fixed cell, the fixed sheet below', () => assert.equal(failures.pillow.length, 0, show('pillow')));
test('crosscap: the closed shape lies on the far half of the fixed cell, which is the cell of the seed or the one just in front of it', () => assert.equal(failures.near.length, 0, show('near')));

test('crosscap: the sweep really ran', () => {
  assert.equal(stats.folds, AMPS.length * (group.presets.length + SEEDS));
  assert.ok(stats.single >= 1, 'a tile of a single piece is covered');
  assert.ok(stats.nearHalf >= 10 && stats.nearHalf < stats.folds, `tiles with points in the near half of the pillow (the twisting part): ${stats.nearHalf}`);
  assert.ok(stats.maxDepth >= 2, 'the wavy cut produced pieces of depth 2');
  assert.ok(stats.invPoints > 10000 && stats.kinds.glide > 3000 && stats.kinds.rotation > 3000 && stats.kinds.translation > 1000, `invariance samples: ${stats.invPoints} ${JSON.stringify(stats.kinds)}`);
  assert.ok(stats.maxTris < 12000, `the finest mesh has ${stats.maxTris} triangles (the renderer sorts up to 20k)`);
  console.log(`      folds ${stats.folds} (${stats.vertices} vertices; triangles ${stats.trisBefore} -> ${stats.trisAfter} after refining next to the rim, at most ${stats.maxTris}), ${stats.single} of a single piece, ${stats.nearHalf} reaching into the near half; ` +
    `worst seam gap / size at t = 1: ${stats.maxSeam.toExponential(1)} (boundary pieces), ${stats.maxSeamLocate.toExponential(1)} (locate); ` +
    `invariance of at(1) at ${stats.invPoints} point pairs (${JSON.stringify(stats.kinds)}): worst ${stats.maxInv.toExponential(1)}; wrong piece: ${stats.maxPieceGap.toExponential(1)}`);
  assert.ok(stats.minRoot >= ROOT_MIN, `the fixed piece is at least ${stats.minRoot} of the tile`);
  console.log(`      fixed piece: at least ${stats.minRoot.toFixed(3)} of the tile; largest piece of depth >= 2: ${stats.maxDeep[0].toFixed(3)} of the tile with a straight cut, ${stats.maxDeep[1].toFixed(3)} with a wavy one`);
  console.log(`      largest step ${stats.maxStep.toFixed(4)} tile diameters = ${stats.maxStepRel.toFixed(3)} of the speed bound, at most ${stats.stepRatio.toFixed(1)} median steps; ` +
    `largest second difference ${stats.maxAccRel.toFixed(3)} of the acceleration bound; stage 1: hinges closed at t = ${T_CLOSED.toFixed(4)}, puff from ${T_PUFF.toFixed(4)}`);
  // round 3: both timings ran (the Bowl and its wavy cut have work 0), and nothing rested
  assert.ok(stats.works.zero >= 2 && stats.works.one >= 10, `works ${JSON.stringify(stats.works)}`);
  console.log(`      work of stage 1: ${JSON.stringify(stats.works)}; the smallest of the 200 steps is ${stats.minRest.toFixed(3)} median steps (no rest); ` +
    `at the middle stop the shape is within ${stats.maxStopGap.toFixed(4)} cells of the half pillow`);
});

test('crosscap: the timing — the flaps turn at once and land softly, the puff starts and lands softly, the zip starts while it lands (no pause), a short soft landing', () => {
  // round 3 (finding 13): the pause of round 2 (0.44 to 0.5, nothing moving) is gone and the time it took went to
  // the flaps; the zip begins while the puff lands, so the motion slows at the junction but never rests
  assert.ok(0 < PUFF_START && PUFF_START < HINGE_END && HINGE_END < ZIP_START && ZIP_START < HALF_END && HALF_STOP === HALF_END && HALF_END < 1);
  assert.ok(HALF_END - ZIP_START <= 0.06, 'the zip has only just begun at the middle stop');
  assert.ok(HINGE_END >= 0.4, 'the flaps (the fastest moment of the play) get at least 40 % of it (round 2: 36 %)');
  assert.ok(1 - ZIP_START >= 0.45, 'the zip is slow enough: at least 45 % of the play');
  const eq = (a, b) => assert.deepEqual([...a], b);
  eq(crosscapSchedule(0), [0, 0, 0]); eq(crosscapSchedule(-1), [0, 0, 0]); eq(crosscapSchedule(NaN), [0, 0, 0]);
  eq(crosscapSchedule(1), [PI, 1, 1]); eq(crosscapSchedule(2), [PI, 1, 1]);
  const z0 = crosscapSchedule(ZIP_START), h0 = crosscapSchedule(HALF_END);
  assert.ok(z0[0] === PI && z0[1] >= 0.9 && z0[1] < 1 && z0[2] === 0, `at the start of the zip: ${z0}`);
  assert.ok(h0[0] === PI && h0[1] === 1 && h0[2] > 0 && h0[2] <= 0.02, `at the middle stop the puff has landed and the zip has just begun: ${h0}`);
  assert.equal(crosscapSchedule(HINGE_END)[0], PI);
  assert.equal(crosscapSchedule(PUFF_START)[1], 0);
  let prev = crosscapSchedule(0);
  for (let k = 1; k <= 4000; k++) {
    const cur = crosscapSchedule(k / 4000);
    assert.ok(cur[0] >= prev[0] && cur[1] >= prev[1] && cur[2] >= prev[2] && cur[0] <= PI && cur[1] <= 1 && cur[2] <= 1, `monotonic at ${k / 4000}`);
    if (cur[2] > 0) assert.ok(cur[0] === PI && cur[1] >= 0.9, 'the zip starts only when the flaps are closed and the puff is landing');
    // as in the hinge fold: the two faces coincide only if theta = pi while beta = 0, so the puff is under way once
    // the flaps are within 12 degrees of closing; and it does not start while the flaps are below the vertical
    if (cur[0] > PI * (1 - 12 / 180)) assert.ok(cur[1] >= 0.08, `beta ${cur[1]} when theta is ${cur[0]}`);
    if (cur[1] > 0) assert.ok(cur[0] >= PI / 2, `theta ${cur[0]} when the puff starts`);
    prev = cur;
  }
  assert.ok(crosscapSchedule(HINGE_END)[1] >= 0.3, `beta ${crosscapSchedule(HINGE_END)[1]} when the flaps close`);
  // no jump: rates and accelerations within fixed bounds per unit of t
  assert.ok(TH1 < 4 * PI && BE1 < 7 && S1 < 3.5, `rates: theta ${TH1}, beta ${BE1}, s ${S1}`);
  assert.ok(TH2 < 30 * PI && BE2 < 100 && S2 < 30 && SQ < 60, `accelerations: theta ${TH2}, beta ${BE2}, s ${S2}; s'^2 / (1 - s) ${SQ}`);
  // zero speed only at the very end: at the start of the zip the puff still moves, when the puff lands the zip
  // already moves; no kink at the inner times
  const e = 1e-6;
  const rate = (t0) => { const a = crosscapSchedule(t0 - e), c = crosscapSchedule(t0 + e); return [(c[0] - a[0]) / (2 * e * PI), (c[1] - a[1]) / (2 * e), (c[2] - a[2]) / (2 * e)]; };
  { const a = crosscapSchedule(1 - e), b = crosscapSchedule(1); for (let k = 0; k < 3; k++) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `zero speed at 1: ${[...a]} ${[...b]}`); }
  assert.ok(rate(ZIP_START)[2] < 1e-3 && rate(ZIP_START)[1] > 0.5, `at the start of the zip the puff moves: ${rate(ZIP_START)}`);
  assert.ok(rate(HALF_END)[1] < 1e-3 && rate(HALF_END)[2] > 0.3, `when the puff lands the zip moves: ${rate(HALF_END)}`);
  let slowest = Infinity, where = 0;
  for (let k = 1; k < 990; k++) { const r = rate(k / 1000), m = Math.max(...r); if (m < slowest) { slowest = m; where = k / 1000; } }
  assert.ok(slowest > 0.25, `the schedule nearly rests at t = ${where} (largest rate ${slowest} per unit of t)`);
  for (const t0 of [PUFF_START, HINGE_END, ZIP_START, HALF_END, 0.3, 0.7]) {
    const a = crosscapSchedule(t0 - e), b = crosscapSchedule(t0), c = crosscapSchedule(t0 + e);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(c[k] - 2 * b[k] + a[k]) < 1e-9, `no kink at ${t0}`);
  }
  // the scrubber answers at once at t = 0
  assert.ok(crosscapSchedule(0.01)[0] > 0.05);
  console.log(`      with a crease: flaps to t = ${HINGE_END}, puff ${PUFF_START} - ${HALF_END}, zip from ${ZIP_START}; at the middle stop the zip is at ${h0[2].toFixed(4)}; slowest moment t = ${where} (rate ${slowest.toFixed(2)})`);
});

test('crosscap: the timing without a crease (work 0, the Bowl) — the puff starts at t = 0 at full rate and stage 1 ends after 22 % of the play; continuous in the work', () => {
  // round 3 (finding 2): the Bowl's tile is the cell itself, nothing to hinge: stage 1 is the puff alone
  const T0 = crosscapTimes(0), T1 = crosscapTimes(1);
  assert.deepEqual({ ...T0 }, { ...TIMES_NO_CREASE, halfStop: TIMES_NO_CREASE.halfEnd, work: 0 });
  assert.deepEqual({ ...T1 }, { hingeEnd: HINGE_END, puffStart: PUFF_START, halfEnd: HALF_END, zipStart: ZIP_START, halfStop: HALF_STOP, work: 1 });
  for (const bad of [NaN, -1, 2, undefined, 'x']) assert.deepEqual(crosscapTimes(bad), T1, `work ${bad} counts as 1`);
  assert.ok(T0.puffStart === 0 && T0.halfEnd <= 0.25 && T0.hingeEnd <= T0.zipStart && T0.zipStart < T0.halfEnd, JSON.stringify(T0));
  const S = (t, k) => crosscapSchedule(t, [0, 0, 0], k);
  // the puff answers at once (the scrubber and the first frames of a play move): full rate from t = 0
  assert.ok(S(0.005, 0)[1] / 0.005 > 0.8 / T0.halfEnd, `beta ${S(0.005, 0)[1]} at t = 0.005`);
  assert.deepEqual(S(T0.halfEnd, 0).slice(0, 2), [PI, 1]);
  assert.ok(S(T0.halfEnd, 0)[2] > 0 && S(T0.halfEnd, 0)[2] < 0.02, 'the zip has only just begun at the middle stop');
  const e = 1e-6;
  for (const k of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const T = crosscapTimes(k);
    assert.ok(T.puffStart >= 0 && T.puffStart < T.hingeEnd && T.hingeEnd <= T.zipStart && T.zipStart < T.halfEnd && T.halfEnd <= HALF_END && T.halfStop === T.halfEnd, `work ${k}: ${JSON.stringify(T)}`);
    let prev = S(0, k), rest = Infinity;
    for (let j = 1; j <= 2000; j++) {
      const t = j / 2000, cur = S(t, k);
      assert.ok(cur[0] >= prev[0] && cur[1] >= prev[1] && cur[2] >= prev[2], `work ${k}: monotonic at ${t}`);
      if (cur[2] > 0) assert.ok(cur[0] === PI && cur[1] >= 0.85, `work ${k}: the zip starts when the flaps are closed and the puff lands (${cur} at ${t})`);
      if (j < 1980) rest = Math.min(rest, Math.max((cur[0] - prev[0]) / PI, cur[1] - prev[1], cur[2] - prev[2]) * 2000);
      prev = cur;
    }
    // (the slowest moment before t = 0.99 is the zip's landing: for work 0 its stage 2 is the longest)
    assert.ok(rest > 0.1, `work ${k}: the schedule nearly rests (rate ${rest})`);
    for (const t0 of [T.puffStart || 0.5, T.hingeEnd, T.zipStart, T.halfEnd]) {
      const a = S(t0 - e, k), b = S(t0, k), c = S(t0 + e, k);
      for (let j = 0; j < 3; j++) assert.ok(Math.abs(c[j] - 2 * b[j] + a[j]) < 1e-8, `work ${k}: a kink at ${t0}`);
    }
  }
  // continuous in the work (a nudged Bowl has a little work): a change of 0.01 moves no parameter by more than 0.05
  for (let k = 0; k < 1; k += 0.01) {
    for (let j = 1; j < 200; j++) {
      const a = S(j / 200, k), b = S(j / 200, Math.min(1, k + 0.01));
      assert.ok(Math.abs(a[0] - b[0]) / PI < 0.05 && Math.abs(a[1] - b[1]) < 0.05 && Math.abs(a[2] - b[2]) < 0.05, `work ${k}: t = ${j / 200}: ${a} vs ${b}`);
    }
  }
  // (theta matters only for the flaps of a cut dragged away from the Bowl, whose anchor keeps this timing: they turn
  // over in 17 % of the play, 2.5 times as fast as with a crease, and land over 7 %)
  const R0 = ratesOf(0);
  assert.ok(R0.TH1 < 8 * PI && R0.BE1 < 7 && R0.S1 < 3.5 && R0.TH2 < 120 * PI && R0.BE2 < 100 && R0.S2 < 30 && R0.SQ < 60, `work 0: rates ${JSON.stringify(R0)}`);
  console.log(`      without a crease: ${JSON.stringify(T0)}; rates ${JSON.stringify(Object.fromEntries(Object.entries(R0).map(([k, v]) => [k, +v.toFixed(2)])))}`);
});

// ---------------------------------------------------------------------------------------------------------------
// The even map by itself
// ---------------------------------------------------------------------------------------------------------------

/** A point of the pillow from (xi, eta) and the sheet (+1 / -1). */
const pillowPoint = (xi, eta, sheet) => [xi, eta, sheet * Math.sqrt(Math.max(0, (1 - xi * xi) * (1 - eta * eta)))];

test('the even map: C(-P) = C(P) exactly; the far edge and the cone points stay where they are; profiles', () => {
  const map = crosscapMap('cleft');
  const rnd = prng(7), a = [0, 0, 0], b = [0, 0, 0];
  for (let k = 0; k < 2000; k++) {
    const P = pillowPoint(2 * rnd() - 1, 2 * rnd() - 1, rnd() < 0.5 ? 1 : -1);
    map.final(P[0], P[1], P[2], a); map.final(-P[0], -P[1], -P[2], b);
    assert.ok(a[0] === b[0] && a[1] === b[1] && a[2] === b[2], 'even');
    assert.ok(a.every(Number.isFinite));
  }
  assert.ok(Math.abs(map.L(1) - 1) < 1e-15 && map.L(0) === 0 && Math.abs(map.L(-0.3) + map.L(0.3)) < 1e-16, 'L is odd, L(1) = 1');
  assert.ok(Math.abs(map.D(1) - 1) < 1e-15 && map.D(0) === 0 && map.D(-0.3) === map.D(0.3), 'D is even, D(0) = 0, D(1) = 1');
  for (let k = 1; k <= 100; k++) assert.ok(map.L(k / 100) > map.L((k - 1) / 100) && map.D(k / 100) > map.D((k - 1) / 100), 'L and D increase on [0, 1]');
  // the far edge eta = 1 is fixed pointwise (so are the cone points at its two ends); the near edge lands on it, reversed
  for (const xi of [-1, -0.4, 0, 0.7, 1]) {
    map.final(xi, 1, 0, a);
    assert.ok(Math.abs(a[0] - xi) < 1e-12 && Math.abs(a[1] - 1) < 1e-12 && a[2] === 0, 'the far edge stays');
    map.final(xi, -1, 0, a);
    assert.ok(Math.abs(a[0] + xi) < 1e-12 && Math.abs(a[1] - 1) < 1e-12 && a[2] === 0, 'the near edge lands on the far edge, reversed');
  }
  assert.ok(map.mu > 0.2 && map.mu < 0.8, `the double line is short but visible: mu = ${map.mu}`);
});

test('the even map: the great circle eta = 0 goes four to one onto the double line; pinch points at its ends; the cone points are far from it', () => {
  const map = crosscapMap('cleft');
  const a = [0, 0, 0], b = [0, 0, 0];
  for (let k = 0; k <= 50; k++) {
    const xi = k / 50, zeta = Math.sqrt(1 - xi * xi);
    map.final(xi, 0, zeta, a);
    assert.ok(a[0] === 0 && a[2] === 0 && Math.abs(a[1] - map.mu * (1 - xi * xi)) < 1e-15, 'on the segment M = 0, V = 0, 0 <= D <= mu');
    for (const [s1, s2] of [[-1, 1], [1, -1], [-1, -1]]) { map.final(s1 * xi, 0, s2 * zeta, b); assert.ok(a[0] === b[0] && a[1] === b[1] && a[2] === b[2], 'four points, one image'); }
  }
  // the two cone points (the corners of the pillow) at (±1, 1, 0): at least 0.9 half-cells from the segment
  for (const xi of [-1, 1]) {
    map.final(xi, 1, 0, a);
    let dmin = Infinity;
    for (let k = 0; k <= 100; k++) dmin = Math.min(dmin, Math.hypot(a[0], a[1] - (map.mu * k) / 100, a[2]));
    assert.ok(dmin > 0.9, `cone point at distance ${dmin} from the double line`);
  }
});

test('the even map: an immersion of the projective plane away from the two pinch points, and one to one away from the double line', () => {
  const map = crosscapMap('cleft');
  const { hx, hy, hz } = { hx: group.e1[0] / 4, hy: group.e2[1] / 4, hz: DESIGN.cleft.plump * Math.min(group.e1[0], group.e2[1]) / 4 };
  const world = (P, out) => { map.final(P[0], P[1], P[2], out); out[0] *= hx; out[1] *= hy; out[2] *= hz; return out; };
  // --- immersion: the area of the image of a small patch of the pillow, divided by the area of the patch (both from
  //     the tangent vectors of the chart (xi, eta) of a sheet, by central differences: the chart is singular at the
  //     edges of the sheet, the ratio is not). Away from the two pinch points, which are (±1, 0, 0) and (0, 0, ±1).
  const crossNorm = (f, xi, eta, sheet, h) => {
    const a = f(pillowPoint(xi + h, eta, sheet), [0, 0, 0]), b = f(pillowPoint(xi - h, eta, sheet), [0, 0, 0]);
    const c = f(pillowPoint(xi, eta + h, sheet), [0, 0, 0]), d = f(pillowPoint(xi, eta - h, sheet), [0, 0, 0]);
    const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
    return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  };
  const pillowWorld = (P, out) => { out[0] = P[0] * hx; out[1] = P[1] * hy; out[2] = P[2] * hz; return out; };
  let minArea = Infinity, where = null, samples = 0;
  const N = 60, h = 1e-6;
  for (let i = 1; i < N; i++) {
    for (let j = 1; j < 2 * N; j++) {
      const xi = Math.cos((PI * i) / N), eta = Math.cos((PI * j) / (2 * N));       // Chebyshev nodes: dense near the edges of the sheet
      const pinch = Math.min(Math.hypot(Math.abs(xi) - 1, eta), Math.hypot(xi, eta));
      if (pinch < 0.12) continue;
      for (const sheet of [1, -1]) {
        const ratio = crossNorm(world, xi, eta, sheet, h) / crossNorm(pillowWorld, xi, eta, sheet, h);
        samples++;
        if (!(ratio >= minArea)) { minArea = ratio; where = [xi, eta, sheet]; }
      }
    }
  }
  assert.ok(minArea > 0.05, `the map squeezes the area by ${minArea} at ${where}`);
  // --- one to one: a grid on the far half of the pillow (a fundamental domain of the antipodal map); two points
  //     whose images are close are close on the pillow, or both next to the great circle eta = 0
  const pts = [], img = [];
  const G = 44;
  for (let i = 0; i <= G; i++) {
    for (let j = 0; j <= G; j++) {
      const xi = -Math.cos((PI * i) / G), eta = (1 - Math.cos((PI * j) / G)) / 2;
      for (const sheet of [1, -1]) {
        if (sheet < 0 && (i === 0 || i === G || j === G)) continue;      // the two sheets share the edges
        const P = pillowPoint(xi, eta, sheet);
        pts.push([P[0] * hx, P[1] * hy, P[2] * hz, eta]); img.push(world(P, [0, 0, 0]));
      }
    }
  }
  let worst = 0, pairs = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dImg = Math.hypot(img[i][0] - img[j][0], img[i][1] - img[j][1], img[i][2] - img[j][2]);
      if (dImg > 0.02 * hx) continue;
      if (pts[i][3] < 0.2 && pts[j][3] < 0.2) continue;                  // both near the rim eta = 0: the double line is there
      pairs++;
      const dPre = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]);
      worst = Math.max(worst, dPre / hx);
    }
  }
  assert.ok(worst < 0.25, `two points ${worst} half-cells apart on the pillow have images within 0.02`);
  console.log(`      immersion: smallest area ratio ${minArea.toFixed(3)} at (xi, eta, sheet) = ${where.map((v) => +v.toFixed(3))} over ${samples} samples; ` +
    `one to one: ${pts.length} points, ${pairs} close pairs of images away from the rim, their preimages at most ${worst.toFixed(3)} half-cells apart`);
});

// ---------------------------------------------------------------------------------------------------------------
// The presets
// ---------------------------------------------------------------------------------------------------------------

test('presets: one fixed cell (another cut only moves the seams over the closed shape); the closed shape is the same', () => {
  const ref = built.find((b) => b.amp === 0 && b.preset === 0).fold;
  for (const { amp, preset, fold } of built) {
    const f = fold.frame, r = ref.frame;
    assert.ok(Math.abs(f.xc - r.xc) < 1e-12 && Math.abs(f.yc - r.yc) < 1e-12 && f.sx === r.sx && f.sy === r.sy, `preset ${preset} amp ${amp}: fixed cell at (${f.xc}, ${f.yc}) instead of (${r.xc}, ${r.yc})`);
    // the same closed shape: at(1) of the same plane point, whichever fold computes it
    const a = [0, 0, 0], b = [0, 0, 0], rnd = prng(5 + preset);
    for (let k = 0; k < 50; k++) {
      const x = r.xc + (2 * rnd() - 1) * r.hx, y = r.yc + (2 * rnd() - 1) * r.hy;
      ref.at(1)(x, y, ref.mesh.locate(x, y), a); fold.at(1)(x, y, fold.mesh.locate(x, y), b);
      assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9, `preset ${preset} amp ${amp}: another closed shape`);
    }
    assert.deepEqual([...fold.doubleLine(1)], [...ref.doubleLine(1)]);
  }
});

test('the default cut "Pocket": one fold, the far half of the pillow, the mouth toward the default camera; the zip is an embedding until the rim closes', () => {
  const { domain, mesh: mesh0, fold } = built.find((b) => b.amp === 0 && b.preset === 0);
  const mesh = fold.mesh, kin = fold.kinematics, fr = fold.frame, out = [0, 0, 0];
  assert.ok(mesh.n > mesh0.n, 'the drawn mesh is finer than the mesh that was handed over');
  assert.equal(group.presets[0].name, 'Pocket');
  assert.equal(domain.poly.length, 4);
  assert.equal(mesh.cells.length, 2, 'two pieces, one crease');
  // two half-turn edges with a cone point in the middle of each, one pair of glide edges
  assert.equal(domain.edges.filter((e) => e.halfTurn).length, 2);
  assert.equal(domain.edges.filter((e) => det(e.g) < 0).length, 2);
  assert.equal(domain.conePoints.length, 2);
  // the fixed piece is the NEAR one (smaller y): the far flap folds over toward the camera
  const cyOf = (i) => { let s = 0, k = 0; for (let v = 0; v < mesh.n; v++) if (mesh.cell[v] === i) { s += mesh.xy[2 * v + 1]; k++; } return s / k; };
  assert.ok(cyOf(kin.root) < cyOf(1 - kin.root), 'the fixed piece is the near one');
  // between the stages (fold.halfPillow; the middle stop is within 1.5 % of it): exactly the far half of the pillow;
  // the glide edges are the rim eta = 0 (the mouth), which faces -y
  const FH = fold.halfPillow;
  for (let v = 0; v < mesh.n; v++) {
    FH(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], out);
    assert.ok((out[1] - fr.yc) / fr.hy > -1e-6, 'the pocket is the far half');
  }
  let rimWidth = 0, rimGape = 0;
  domain.edges.forEach((e, i) => {
    if (det(e.g) > 0) return;
    const b = fold.mesh.boundary[i];
    for (let j = 0; j < b.cells.length; j++) {
      FH(b.pts[2 * j], b.pts[2 * j + 1], b.cells[j], out);
      assert.ok(Math.abs(out[1] - fr.yc) < 1e-6, 'the mouth lies in the plane y = yc, the near end of the pocket');
      rimWidth = Math.max(rimWidth, Math.abs(out[0] - fr.xc)); rimGape = Math.max(rimGape, Math.abs(out[2]));
    }
  });
  assert.ok(Math.abs(rimWidth - fr.hx) < 1e-6 && Math.abs(rimGape - fr.hz) < 1e-3, `mouth ${2 * rimWidth} wide, ${2 * rimGape} high`);
  // the cone points are the two far corners, and they do not move in stage 2
  for (const c of domain.conePoints) {
    const piece = mesh.locate(c.x, c.y);
    FH(c.x, c.y, piece, out);
    const at = out.slice();
    assert.ok(Math.abs(Math.abs(at[0] - fr.xc) - fr.hx) < 1e-9 && Math.abs(at[1] - fr.yc - fr.hy) < 1e-9 && Math.abs(at[2]) < 1e-7, `cone point at ${at}`);
    for (const t of [0.6, 0.8, 1]) { fold.at(t)(c.x, c.y, piece, out); assert.ok(Math.hypot(out[0] - at[0], out[1] - at[1], out[2] - at[2]) < 1e-7, 'the cone points stay'); }
  }
  // stage 2: seen from above no triangle ever turns over (each sheet stays a graph over the plane), the fixed sheet
  // stays below and the flap above: the pocket is embedded until the rim meets itself at t = 1
  const tri = mesh.tri, m = mesh.m, pos = new Float64Array(3 * mesh.n);
  for (const t of [HALF_STOP, 0.55, 0.65, 0.75, 0.85, 0.93, 0.98, 0.995]) {
    const F = fold.at(t);
    for (let v = 0; v < mesh.n; v++) { F(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], out); pos.set(out, 3 * v); }
    let flipped = 0, wrongSide = 0;
    for (let k = 0; k < m; k++) {
      const a = tri[3 * k], b = tri[3 * k + 1], c = tri[3 * k + 2], odd = kin.depth[mesh.triCell[k]] & 1;
      const ar = (pos[3 * b] - pos[3 * a]) * (pos[3 * c + 1] - pos[3 * a + 1]) - (pos[3 * b + 1] - pos[3 * a + 1]) * (pos[3 * c] - pos[3 * a]);
      if (odd ? ar > 1e-12 : ar < -1e-12) flipped++;
      // (by design the whole motion is mirrored in z = 0, DESIGN_UP = -1: the fixed sheet above, the flap below)
      const zc = (DESIGN_UP * (pos[3 * a + 2] + pos[3 * b + 2] + pos[3 * c + 2])) / 3;
      if (odd ? zc < -1e-9 : zc > 1e-9) wrongSide++;
    }
    assert.equal(flipped, 0, `t = ${t}: ${flipped} triangles are turned over seen from above`);
    assert.equal(wrongSide, 0, `t = ${t}: ${wrongSide} triangles on the wrong side of the middle plane`);
  }
  // at t = 1 the rim (the glide edges) lies on the double line, and the double line is exactly its image
  const dl = fold.doubleLine(1), F1 = fold.at(1);
  assert.equal(dl.length % 3, 0);
  const tip = [dl[0], dl[1], dl[2]], inner = [dl[dl.length - 3], dl[dl.length - 2], dl[dl.length - 1]];
  assert.ok(Math.abs(tip[0] - fr.xc) < 1e-7 && Math.abs(tip[1] - fr.yc) < 1e-7 && Math.abs(inner[0] - fr.xc) < 1e-7 && Math.abs(inner[1] - fr.yc - fold.finalMap.mu * fr.hy) < 1e-7, `double line ${tip} -> ${inner}`);
  let lo = Infinity, hi = -Infinity;
  domain.edges.forEach((e, i) => {
    if (det(e.g) > 0) return;
    const b = fold.mesh.boundary[i];
    for (let j = 0; j < b.cells.length; j++) {
      F1(b.pts[2 * j], b.pts[2 * j + 1], b.cells[j], out);
      assert.ok(Math.abs(out[0] - fr.xc) < 1e-7 && Math.abs(out[2]) < 1e-7, 'the closed rim is on the double line');
      lo = Math.min(lo, out[1]); hi = Math.max(hi, out[1]);
    }
  });
  assert.ok(Math.abs(lo - tip[1]) < 1e-6 && Math.abs(hi - inner[1]) < 1e-6, `the rim covers the double line: [${lo}, ${hi}]`);
  // the four corners of the tile all go to the tip
  for (const p of domain.poly) { F1(p[0], p[1], mesh.locate(p[0], p[1]), out); assert.ok(Math.hypot(out[0] - tip[0], out[1] - tip[1], out[2]) < 1e-6, 'a corner of the tile is not at the tip'); }
});

test('dragging the seed of the default cut a little, in any direction, leaves the closed shape where it is; far enough away from the camera it hops one cell', () => {
  const ref = built.find((b) => b.amp === 0 && b.preset === 0).fold.frame, seed = group.presets[0].seed;
  const frameOf = (dx, dy, amp = 0) => {
    const domain = buildDomain(group, { seed: [seed[0] + dx, seed[1] + dy], warp: makeWarp(group, amp) });
    return createFold(group, domain, buildMesh(group, domain), {}).frame;
  };
  for (const amp of [0, 1]) {
    for (const [dx, dy] of [[0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1], [0.1, 0.06], [-0.1, 0.06], [0.3, -0.3], [-0.3, -0.05], [0.2, 0.03], [0, -0.6], [1e-7, 1e-7], [0, 1e-9]]) {
      const f = frameOf(dx, dy, amp);
      assert.ok(Math.abs(f.xc - ref.xc) < 1e-12 && Math.abs(f.yc - ref.yc) < 1e-12, `seed + (${dx}, ${dy}) amp ${amp}: the fixed cell moved to (${f.xc}, ${f.yc})`);
    }
  }
  const b = group.e2[1], a = group.e1[0];
  assert.ok(Math.abs(frameOf(0, 0.3).yc - ref.yc - b / 2) < 1e-12, 'half a cell further away the shape sits one cell further away');
  assert.ok(Math.abs(frameOf(0, -0.82).yc - ref.yc + b / 2) < 1e-12, 'toward the camera it takes almost a whole cell');
  assert.ok(Math.abs(frameOf(0.4, 0).xc - ref.xc - a / 2) < 1e-12 && Math.abs(frameOf(-0.4, 0).xc - ref.xc + a / 2) < 1e-12, 'sideways: at the creases');
});

test('doubleLine(t): empty until the sheets are about to meet along it (round 3: no dot floating in the open mouth), then growing out of the tip to the full double line; every point of it is a double point at t = 1', () => {
  const { fold, mesh } = built.find((b) => b.amp === 0 && b.preset === 1);     // the Bowl: the double line is inside the tile
  const fr = fold.frame, TM = fold.times;
  for (const t of [0, 0.1, TM.zipStart, TM.halfStop, TM.zipStart + 0.05]) assert.equal(fold.doubleLine(t).length, 0, `doubleLine(${t})`);
  let prev = 0, first = null, full = null;
  for (let k = 1; k <= 400; k++) {
    const t = TM.zipStart + (k / 400) * (1 - TM.zipStart), dl = fold.doubleLine(t);
    if (!dl.length) { assert.equal(prev, 0, `the line vanishes again at t = ${t}`); continue; }
    if (first === null) first = t;
    assert.ok(dl.length >= 6);
    assert.ok(Math.abs(dl[0] - fr.xc) < 1e-7 && Math.abs(dl[1] - fr.yc) < 1e-7 && Math.abs(dl[2]) < 1e-7, 'it starts at the tip');
    const len = Math.hypot(dl[dl.length - 3] - dl[0], dl[dl.length - 2] - dl[1], dl[dl.length - 1] - dl[2]);
    assert.ok(len >= prev - 1e-9, 'it grows');
    if (full === null && Math.abs(len - fold.finalMap.mu * fr.hy) < 1e-9) full = t;
    prev = len;
  }
  assert.ok(Math.abs(prev - fold.finalMap.mu * fr.hy) < 1e-6);
  // the Bowl's double line is real from the end of the pinch on (the bottom meridian is folded onto it, two to one):
  // it appears in the last 3 % of the pinch and is whole well before the roll and the fold back are done
  const tOf = (v) => TM.zipStart + (fold.actsFree + v * (1 - fold.actsFree)) * (1 - TM.zipStart);   // v: the time of the acts
  const pinchEnd = tOf(ACTS.pinch);
  assert.ok(first > tOf(0.5 * ACTS.pinch) && full <= pinchEnd + 1e-9, `the line appears at t = ${first}, whole at ${full} (the pinch ends at ${pinchEnd})`);
  // with the Pocket the rim closes onto it only at the end: drawn only while every point of the rim is within 3 % of
  // the cell of it (the lips are about to meet)
  {
    const { fold: fp, domain: dp } = built.find((b) => b.amp === 0 && b.preset === 0);
    const out = [0, 0, 0], gf = fp.frame;
    let shown = 0;
    for (let k = 0; k <= 200; k++) {
      const t = fp.times.zipStart + (k / 200) * (1 - fp.times.zipStart), dl = fp.doubleLine(t);
      let worst = 0;
      dp.edges.forEach((e, i) => {
        if (det(e.g) > 0) return;
        const b = fp.mesh.boundary[i];
        for (let j = 0; j < b.cells.length; j++) { fp.at(t)(b.pts[2 * j], b.pts[2 * j + 1], b.cells[j], out); worst = Math.max(worst, Math.hypot(out[0] - gf.xc, out[2])); }
      });
      if (dl.length) { shown++; assert.ok(worst <= 0.031 * Math.max(gf.hx, gf.hz * fp.finalMap.gamma), `Pocket t = ${t}: the line is drawn while the rim is ${worst} from it`); }
      else assert.ok(worst > 0.029 * Math.max(gf.hx, gf.hz * fp.finalMap.gamma) - 1e-12, `Pocket t = ${t}: the rim is ${worst} from the line, and it is not drawn`);
    }
    assert.ok(shown >= 3 && shown < 40, `the Pocket's line is drawn in ${shown} of 201 frames of the zip`);
  }
  // double points: each inner point of the line is the image of two different points of the Bowl (xi and -xi on the bottom meridian)
  const F1 = fold.at(1), a = [0, 0, 0], b = [0, 0, 0], dl = fold.doubleLine(1);
  for (const xi of [0.2, 0.5, 0.8]) {
    const x1 = fr.xc + xi * fr.hx, x2 = fr.xc - xi * fr.hx, y = fr.yc;
    F1(x1, y, mesh.locate(x1, y), a); F1(x2, y, mesh.locate(x2, y), b);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-9, 'two points of the tile, one image');
    let dmin = Infinity;
    for (let k = 0; k + 3 < dl.length; k += 3) {
      // distance from a to the segment k
      const ux = dl[k + 3] - dl[k], uy = dl[k + 4] - dl[k + 1], uz = dl[k + 5] - dl[k + 2], l2 = ux * ux + uy * uy + uz * uz;
      const s = Math.max(0, Math.min(1, ((a[0] - dl[k]) * ux + (a[1] - dl[k + 1]) * uy + (a[2] - dl[k + 2]) * uz) / l2));
      dmin = Math.min(dmin, Math.hypot(a[0] - dl[k] - s * ux, a[1] - dl[k + 1] - s * uy, a[2] - dl[k + 2] - s * uz));
    }
    assert.ok(dmin < 1e-6, `the double point is ${dmin} from the polyline`);
  }
});

test('the other designs (kept for comparison) are folds too: identity at 0, seams closed at 1, finite', () => {
  for (const design of ['stem', 'spec']) {
    for (const p of group.presets) {
      const domain = buildDomain(group, { seed: p.seed, warp: makeWarp(group, 0) });
      const mesh = buildMesh(group, domain);
      const fold = createFold(group, domain, mesh, { design });
      assert.equal(fold.design, design);
      const out = [0, 0, 0], o2 = [0, 0, 0], q = [0, 0];
      fold.at(0)(mesh.xy[0], mesh.xy[1], mesh.cell[0], out);
      assert.deepEqual(out, [mesh.xy[0], mesh.xy[1], 0]);
      for (const t of [0.3, HALF_STOP, 0.6, 0.8, 0.95, 1]) {
        const F = fold.at(t);
        for (let v = 0; v < mesh.n; v++) { F(mesh.xy[2 * v], mesh.xy[2 * v + 1], mesh.cell[v], out); assert.ok(Number.isFinite(out[0] + out[1] + out[2]), `${design} ${p.name} t ${t}`); }
      }
      const F1 = fold.at(1);
      domain.edges.forEach((e, i) => {
        if (e.kind !== 'cut') return;
        const bi = fold.mesh.boundary[i], bj = fold.mesh.boundary[e.partner], k = bi.cells.length, gi = inverse(e.g);
        for (let j = 0; j < k; j++) {
          apply(gi, bi.pts[2 * j], bi.pts[2 * j + 1], q);
          F1(bi.pts[2 * j], bi.pts[2 * j + 1], bi.cells[j], out); F1(q[0], q[1], bj.cells[e.rev ? k - 1 - j : j], o2);
          assert.ok(Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]) < 1e-6 * size, `${design} ${p.name}: seam`);
        }
      });
      assert.ok(fold.doubleLine(1).length >= 6);
    }
  }
});

test('group data: pgg with its two glides and half-turn; the presets lie in one cell', () => {
  const [gI, gR, gA, gB] = group.reps;
  assert.equal(classify(gI).type, 'identity');
  assert.equal(classify(gR).type, 'rotation');
  assert.equal(classify(gA).type, 'glide');
  assert.equal(classify(gB).type, 'glide');
  assert.ok(contains(group, compose(gA, gB)) && !contains(group.kaleido.group, gA) && contains(group.kaleido.group, gR));
  const [a, b] = [group.e1[0], group.e2[1]];
  for (const p of group.presets) assert.ok(p.seed[0] >= 0 && p.seed[0] < a / 2 && p.seed[1] > 0 && p.seed[1] <= b / 2, `${p.name}: seed ${p.seed}`);
  assert.equal(group.presets.length, 3);
  // round 3 (finding 18): the names are true of the tiles. "Pocket" and "Bowl" are congruent rectangles named by how
  // they fold: the Pocket's tile folds once (two pieces, one crease), the Bowl's is the cell itself (one piece, it
  // only puffs: a bowl); "Hexagon" has six corners
  const [pocket, bowl, hexagon] = group.presets.map((p) => { const d = buildDomain(group, { seed: p.seed, warp: makeWarp(group, 0) }); return { name: p.name, d, m: buildMesh(group, d) }; });
  assert.deepEqual([pocket.name, bowl.name, hexagon.name], ['Pocket', 'Bowl', 'Hexagon']);
  assert.ok(pocket.d.poly.length === 4 && pocket.m.cells.length === 2, 'the Pocket: a rectangle folded once');
  assert.ok(bowl.d.poly.length === 4 && bowl.m.cells.length === 1, 'the Bowl: a rectangle that only puffs');
  assert.equal(hexagon.d.poly.length, 6, 'the Hexagon has six corners');
});

test('with a diagonal metric (stretched tiles, longer flaps): identity, seams, finite, no jump', () => {
  const bad = [];
  let n = 0, deepest = 0, worstGap = 0, worstStep = 0;
  const rnd = prng(31337);
  for (const metric of [[1, 0, 4], [5, 0, 1], [1, 0, 1.7]]) {
    for (const amp of AMPS) {
      const warp = makeWarp(group, amp);
      const seeds = group.presets.map((p) => p.seed);
      for (let k = 0; k < 3; k++) seeds.push([group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf]);
      for (const seed of seeds) {
        const label = `metric [${metric}] seed (${seed.map((v) => v.toFixed(4))}) amp ${amp}`;
        const domain = buildDomain(group, { seed, metric, warp });
        assert.deepEqual(domain.metric, metric, `${label}: the metric was not accepted`);
        const fold = createFold(group, domain, buildMesh(group, domain), {}), M = fold.mesh;
        const diam = Math.hypot(M.bbox[2] - M.bbox[0], M.bbox[3] - M.bbox[1]);
        n++; deepest = Math.max(deepest, ...fold.kinematics.depth);
        const out = [0, 0, 0], o2 = [0, 0, 0], q = [0, 0];
        const F0 = fold.at(0);
        for (let v = 0; v < M.n; v++) { F0(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out); if (out[0] !== M.xy[2 * v] || out[1] !== M.xy[2 * v + 1] || out[2] !== 0) { bad.push(`${label}: at(0)`); break; } }
        const F1 = fold.at(1);
        let gap = 0;
        domain.edges.forEach((e, i) => {
          if (e.kind !== 'cut') return;
          const bi = M.boundary[i], bj = M.boundary[e.partner], m = bi.cells.length, gi = inverse(e.g);
          for (let j = 0; j < m; j++) {
            apply(gi, bi.pts[2 * j], bi.pts[2 * j + 1], q);
            F1(bi.pts[2 * j], bi.pts[2 * j + 1], bi.cells[j], out); F1(q[0], q[1], bj.cells[e.rev ? m - 1 - j : j], o2);
            const d = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]);
            if (!(d <= gap)) gap = d;
          }
        });
        worstGap = Math.max(worstGap, gap / size);
        if (!(gap < 1e-6 * size)) bad.push(`${label}: seam gap ${gap}`);
        let prev = new Float64Array(3 * M.n), cur = new Float64Array(3 * M.n), worst = 0, finite = true;
        const S = 80;
        for (let s = 0; s <= S; s++) {
          const F = fold.at(s / S);
          for (let v = 0, o = 0; v < M.n; v++, o += 3) {
            F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out);
            if (!Number.isFinite(out[0] + out[1] + out[2])) finite = false;
            cur[o] = out[0]; cur[o + 1] = out[1]; cur[o + 2] = out[2];
            if (s > 0) worst = Math.max(worst, Math.hypot(cur[o] - prev[o], cur[o + 1] - prev[o + 1], cur[o + 2] - prev[o + 2]));
          }
          const T = prev; prev = cur; cur = T;
        }
        worstStep = Math.max(worstStep, worst / diam);
        if (!finite) bad.push(`${label}: non-finite positions`);
        // (a chain of two flaps turning half a circle in the fold's hinge time, 42 % of the play with a crease: at most
        // 2 pi diam / hingeEnd per unit of t, times the rate 1.25)
        if (!(worst <= (2 * PI * 1.25 * diam) / (fold.times.hingeEnd * S))) bad.push(`${label}: a step of ${worst / diam} tile diameters in 1/${S}`);
      }
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 6).join('\n'));
  console.log(`      ${n} tiles with a diagonal metric: deepest piece ${deepest}, worst seam gap ${worstGap.toExponential(1)} sizes, largest step ${worstStep.toFixed(4)} tile diameters per 1/80`);
});

// ===============================================================================================================
// Round 2. The anchor (SPEC 7): the closed shape depends on the anchor alone
// ===============================================================================================================

const A2 = group.e1[0] / 2, B2 = group.e2[1] / 2;          // the kaleidoscope cells: [i A2, (i+1) A2] x [j B2, (j+1) B2]
const DC = DESIGN.cleft, HZ = (DC.plump * Math.min(A2, B2)) / 2;
const nLr = Math.sqrt(1 + DC.eps * DC.eps), nDr = 1 / (Math.sqrt(1 + DC.eps * DC.eps) - DC.eps);
const refL = (e) => (e * nLr) / Math.sqrt(e * e + DC.eps * DC.eps);
const refD = (e) => (Math.sqrt(e * e + DC.eps * DC.eps) - DC.eps) * nDr;
const mod2 = (k) => ((k % 2) + 2) % 2;

/**
 * The closed shape of 22x over the cell (i0, j0), written out from scratch (neither crosscap.js nor hinge.js): the
 * plane point is folded into the cell T by the mirrors of the kaleidoscope; its sheet is the parity of the number of
 * kaleidoscope lines between its cell and C0 (C0's own sheet underneath); then the cleft map in C0's frame (in an odd
 * column or row of cells the axis is reversed).
 */
function refClosed(x, y, i0, j0, out = [0, 0, 0]) {
  const i = Math.floor(x / A2), j = Math.floor(y / B2);
  const u = mod2(i) ? (i + 1) * A2 - x : x - i * A2, v = mod2(j) ? (j + 1) * B2 - y : y - j * B2;
  const X = (u - A2 / 2) / (A2 / 2), Y = (v - B2 / 2) / (B2 / 2);
  const zeta = (mod2(i - i0 + j - j0) ? 1 : -1) * Math.sqrt(Math.max(0, (1 - X * X) * (1 - Y * Y)));
  const xi = mod2(i0) ? -X : X, eta = mod2(j0) ? -Y : Y, l = refL(eta);
  out[0] = (i0 + 0.5) * A2 + (A2 / 2) * xi * l;
  out[1] = (j0 + 0.5) * B2 + (B2 / 2) * (refD(eta) + DC.mu * zeta * zeta);
  out[2] = HZ * DC.gamma * zeta * l;
  return out;
}

/** The point of the (warped) tile in the orbit of the plane point (x, y): g(x, y), with g(warp.inv(x, y)) inside the straight tile by a margin; null if none. */
function inTile(domain, x, y, out = [0, 0]) {
  const q = domain.warp.inv(x, y, [0, 0]), poly = domain.poly, s = [0, 0];
  let cx = 0, cy = 0, r = 0;
  for (const p of poly) { cx += p[0] / poly.length; cy += p[1] / poly.length; }
  for (const p of poly) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy));
  for (const g of elementsNear(group, cx, cy, r + 1e-6, q[0], q[1])) {
    apply(g, q[0], q[1], s);
    if (domain.contains(s[0], s[1], -1e-7 * size)) return apply(g, x, y, out);
  }
  return null;
}

const randomSeed = (rnd) => [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];

test('anchor (SPEC 7) 1: at t = 1 a plane point goes to the same place for 30 random seeds sharing one anchor, straight and wavy — the closed shape over the anchor\'s cell, computed from scratch', () => {
  // the anchors: the three presets, a hair (b/100) behind the centre of the cell, an anchor just behind a crease (the cell in front keeps it,
  // as it keeps the Pocket, whose seed lies ON that crease), and three random anchors well inside their own cells
  const rnd = prng(7007);
  const anchors = group.presets.map((p) => ({ a: p.seed.slice(), cell: [0, 0], label: p.name }));
  anchors.push({ a: [A2 / 2, 0.52 * B2], cell: [0, 0], label: 'a hair behind the centre of the cell' });
  anchors.push({ a: [A2 / 2, B2 + 0.05], cell: [0, 0], label: '0.05 behind the crease y = b/2' });
  for (let k = 0; k < 3; k++) {
    const i = Math.floor(rnd() * 4) - 1, j = Math.floor(rnd() * 4) - 1;
    anchors.push({ a: [(i + 0.1 + 0.8 * rnd()) * A2, (j + 0.35 + 0.6 * rnd()) * B2], cell: [i, j], label: `random anchor ${k}` });
  }
  const pts = [];
  for (let k = 0; k < 16; k++) pts.push(randomSeed(rnd));
  const q = [0, 0], out = [0, 0, 0], ref = [0, 0, 0];
  let folds = 0, compared = 0, worst = 0, longest = 0;
  for (const { a, cell: [i0, j0], label } of anchors) {
    const c0 = anchorCell(group, a), mid = apply(c0.iso, A2 / 2, B2 / 2);
    assert.ok(Math.abs(mid[0] - (i0 + 0.5) * A2) < 1e-12 && Math.abs(mid[1] - (j0 + 0.5) * B2) < 1e-12, `${label}: the anchor's cell is centred at ${mid}`);
    let line0 = null;
    for (let k = 0; k < 30; k++) {
      const seed = randomSeed(rnd), amp = k % 2;
      const domain = buildDomain(group, { seed, warp: makeWarp(group, amp) });
      const fold = createFold(group, domain, buildMesh(group, domain), { anchor: a });
      const tag = `${label}, seed (${seed.map((v) => v.toFixed(4))}) amp ${amp}`;
      folds++;
      assert.deepEqual(fold.anchor, a, `${tag}: fold.anchor`);
      longest = Math.max(longest, fold.kinematics.walk.length);
      assert.ok(Math.abs(fold.frame.xc - (i0 + 0.5) * A2) < 1e-12 && Math.abs(fold.frame.yc - (j0 + 0.5) * B2) < 1e-12, `${tag}: the closed shape sits at (${fold.frame.xc}, ${fold.frame.yc})`);
      const F1 = fold.at(1);
      for (const p of pts) {
        if (!inTile(domain, p[0], p[1], q)) continue;
        F1(q[0], q[1], fold.mesh.locate(q[0], q[1]), out);
        refClosed(p[0], p[1], i0, j0, ref);
        ref[2] *= DESIGN_UP;                                   // by design the mirror image in z = 0 of round 3's shape (FLAPS)
        const d = Math.hypot(out[0] - ref[0], out[1] - ref[1], out[2] - ref[2]);
        worst = Math.max(worst, d / size); compared++;
        assert.ok(d < 1e-7 * size, `${tag}: the plane point (${p}) (in the tile at (${q})) goes to ${out}, not to ${ref} (${d / size} tile sizes)`);
      }
      const dl = [...fold.doubleLine(1)];
      if (!line0) line0 = dl; else assert.deepEqual(dl, line0, `${tag}: another double line`);
    }
  }
  assert.ok(compared > 0.9 * folds * pts.length && longest >= 4, `${compared} points compared in ${folds} folds; longest walk ${longest} lines`);
  console.log(`      ${anchors.length} anchors x 30 seeds: ${compared} plane points, each where the closed shape over the anchor's cell puts it, worst ${worst.toExponential(1)} tile sizes; walks up to ${longest} lines`);
});

test('anchor (SPEC 7) 2: anchored folds are invariant at t = 1 under the half-turn, both glides and their products, at random interior points', () => {
  const rnd = prng(2718), q = [0, 0], out = [0, 0, 0], o2 = [0, 0, 0];
  let pairs = 0, worst = 0;
  const kinds = {};
  for (const p of group.presets) {
    for (let k = 0; k < 8; k++) {
      const seed = randomSeed(rnd), amp = k % 2;
      const domain = buildDomain(group, { seed, warp: makeWarp(group, amp) });
      const fold = createFold(group, domain, buildMesh(group, domain), { anchor: p.seed });
      const M = fold.mesh, F1 = fold.at(1);
      for (let n = 0; n < 25; n++) {
        const t = Math.floor(rnd() * M.m), a = M.tri[3 * t], b = M.tri[3 * t + 1], c = M.tri[3 * t + 2];
        let u = rnd(), w = rnd();
        if (u + w > 1) { u = 1 - u; w = 1 - w; }
        const x = M.xy[2 * a] + u * (M.xy[2 * b] - M.xy[2 * a]) + w * (M.xy[2 * c] - M.xy[2 * a]), y = M.xy[2 * a + 1] + u * (M.xy[2 * b + 1] - M.xy[2 * a + 1]) + w * (M.xy[2 * c + 1] - M.xy[2 * a + 1]);
        F1(x, y, M.locate(x, y), out);
        for (const g of elementsNear(group, x, y, 1.05 * Math.max(group.e1[0], group.e2[1]), x, y)) {
          const kind = classify(g).type;
          if (kind === 'identity') continue;
          kinds[kind] = (kinds[kind] || 0) + 1;
          apply(g, x, y, q);
          F1(q[0], q[1], M.locate(q[0], q[1]), o2);
          const d = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]);
          worst = Math.max(worst, d / size); pairs++;
          assert.ok(d < 1e-7 * size, `anchor ${p.name}, seed (${seed}) amp ${amp}: at(1) differs by ${d} between (${x}, ${y}) and its image under a ${kind}`);
        }
      }
    }
  }
  assert.ok(kinds.glide > 1000 && kinds.rotation > 500 && kinds.translation > 200, JSON.stringify(kinds));
  console.log(`      ${pairs} point pairs (${JSON.stringify(kinds)}): worst ${worst.toExponential(1)} tile sizes`);
});

test('anchor (SPEC 7) 3: along a seed path across one crease nothing jumps — in stage 1, in the pause and at t = 1 a plane point that stays in the tile does not move at all; in stage 2 it moves smoothly; without the anchor the shape hops', () => {
  const [P0, P1, P2] = group.presets.map((p) => p.seed);
  const paths = [
    { name: 'Bowl, across y = b/2', anchor: P1, from: P1, to: [A2 / 2, 1.15] },
    { name: 'Hexagon, across x = a/2', anchor: P2, from: P2, to: [A2 + 0.3, P2[1]] },
    { name: 'Pocket, across the crease its seed lies on', anchor: P0, from: [A2 / 2, 0.6], to: [A2 / 2, 1.2] },
  ];
  // the times: in stage 1, at the start of the zip, at the middle stop (the fold's own times: round 3, the Bowl's
  // stage 1 is shorter), in stage 2, at the end
  const timesOf = (P) => { const T = make(P, P.from, 0, true).fold.times; return [Math.min(0.2, 0.5 * T.halfEnd), T.halfStop, T.zipStart, 0.75, 0.9, 1]; };
  const N = 40, STILL = [true, true, true, false, false, true];
  const q = [0, 0], o1 = [0, 0, 0], o2 = [0, 0, 0];
  const make = (P, s, amp, anchored) => {
    const domain = buildDomain(group, { seed: s, warp: makeWarp(group, amp) });
    return { s, domain, fold: createFold(group, domain, buildMesh(group, domain), anchored ? { anchor: P.anchor } : {}) };
  };
  const along = (P, k, n) => [P.from[0] + (k / n) * (P.to[0] - P.from[0]), P.from[1] + (k / n) * (P.to[1] - P.from[1])];
  /** The largest move, at time t, of a plane point that lies inside both tiles (by 1e-4 tile sizes). */
  const moved = (A, B, t) => {
    const FA = A.fold.at(t), FB = B.fold.at(t), M = A.fold.mesh;
    let d = 0, n = 0;
    for (let v = 0; v < M.n; v += 3) {
      const x = M.xy[2 * v], y = M.xy[2 * v + 1];
      A.domain.warp.inv(x, y, q);
      if (!A.domain.contains(q[0], q[1], -1e-4 * size)) continue;
      B.domain.warp.inv(x, y, q);
      if (!B.domain.contains(q[0], q[1], -1e-4 * size)) continue;
      FA(x, y, M.cell[v], o1); FB(x, y, B.fold.mesh.locate(x, y), o2);
      d = Math.max(d, Math.hypot(o1[0] - o2[0], o1[1] - o2[1], o1[2] - o2[2])); n++;
    }
    assert.ok(n > 50, 'points in both tiles');
    return d;
  };
  const lines = [];
  for (const P of paths) {
    const TS = timesOf(P);
    for (const amp of [0, 1]) {
      const F = [];
      for (let k = 0; k <= N; k++) F.push(make(P, along(P, k, N), amp, true));
      const worst = TS.map(() => 0), at = TS.map(() => -1);
      let ds = 0;
      for (let k = 0; k < N; k++) {
        ds = Math.hypot(F[k + 1].s[0] - F[k].s[0], F[k + 1].s[1] - F[k].s[1]);
        TS.forEach((t, i) => { const d = moved(F[k], F[k + 1], t); if (d > worst[i]) { worst[i] = d; at[i] = k; } });
      }
      TS.forEach((t, i) => {
        if (STILL[i]) assert.ok(worst[i] < (t === 1 ? 1e-7 : 1e-8) * size, `${P.name} amp ${amp}: at t = ${t} a point that stays in the tile moves by ${worst[i] / size} tile sizes when the seed moves`);
        else {
          // stage 2 depends on how far the tile reaches into the near half: smoothly. A jump would not get smaller
          // when the step is cut into 8; a smooth change does.
          assert.ok(worst[i] < 6 * ds, `${P.name} amp ${amp}: at t = ${t} a point moves ${worst[i] / ds} times as far as the seed`);
          // the step with the largest move, cut into 8, and its worst eighth cut into 8 again: a jump keeps its size
          const refine = (k, n) => {
            let best = 0, kk = 8 * k, prev = make(P, along(P, 8 * k, 8 * n), amp, true);
            for (let m = 1; m <= 8; m++) { const cur = make(P, along(P, 8 * k + m, 8 * n), amp, true), d = moved(prev, cur, t); if (d > best) { best = d; kk = 8 * k + m - 1; } prev = cur; }
            return [best, kk];
          };
          const [s1, k1] = refine(at[i], N), [s2] = refine(k1, 8 * N);
          assert.ok(s1 < 0.6 * worst[i] + 1e-9 && s2 < 0.6 * s1 + 1e-9, `${P.name} amp ${amp}: at t = ${t} the move of ${worst[i]} between seeds ${at[i]} and ${at[i] + 1} does not shrink with the step (${s1} in an eighth, ${s2} in a 64th): a jump`);
        }
      });
      lines.push(`${P.name} amp ${amp}: ` + TS.map((t, i) => `t ${+t.toFixed(3)} ${STILL[i] ? (worst[i] / size).toExponential(0) : (worst[i] / ds).toFixed(1) + 'x'}`).join(', '));
    }
    // control: without the anchor the closed shape follows the seed (it hops by a cell at least once on the path)
    const a = make(P, P.from, 0, false), b = make(P, P.to, 0, false);
    assert.ok(Math.hypot(a.fold.frame.xc - b.fold.frame.xc, a.fold.frame.yc - b.fold.frame.yc) > 0.5 * Math.min(A2, B2), `${P.name}: without the anchor the shape should move with the seed`);
  }
  console.log('      the largest move per seed step of a point that stays in the tile (tile sizes; stage 2: times the seed\'s step):\n        ' + lines.join('\n        '));
});

test('anchor (SPEC 7) 4: anchor = seed is the fold without an anchor (a missing anchor means anchor = seed); a malformed anchor is no anchor', () => {
  const rnd = prng(31415), out = [0, 0, 0], ref = [0, 0, 0];
  const seeds = group.presets.map((p) => [p.seed, [0, 1]]);
  for (let k = 0; k < 10; k++) seeds.push([randomSeed(rnd), [0]]);
  let compared = 0;
  for (const [seed, amps] of seeds) {
    for (const amp of amps) {
      const domain = buildDomain(group, { seed, warp: makeWarp(group, amp) });
      const mesh = buildMesh(group, domain);
      const plain = createFold(group, domain, mesh, {}), anchored = createFold(group, domain, mesh, { anchor: domain.seed.slice() });
      assert.equal(plain.anchor, null);
      assert.deepEqual(anchored.anchor, domain.seed);
      assert.ok(Math.abs(plain.frame.xc - anchored.frame.xc) < 1e-12 && Math.abs(plain.frame.yc - anchored.frame.yc) < 1e-12, `seed (${seed}) amp ${amp}: the fixed cell`);
      const M = plain.mesh;
      for (const t of [0.1, 0.2, HALF_STOP, 0.6, 0.75, 0.9, 1]) {
        const F0 = plain.at(t), F1 = anchored.at(t);
        let worst = 0;
        for (let v = 0; v < M.n; v += 2) { F0(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], ref); F1(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out); worst = Math.max(worst, Math.hypot(out[0] - ref[0], out[1] - ref[1], out[2] - ref[2])); }
        assert.ok(worst <= 1e-9 * size, `seed (${seed}) amp ${amp} t = ${t}: anchor = seed moves a vertex ${worst / size} tile sizes away from the fold without an anchor`);
        compared++;
      }
      // malformed anchors are no anchor: the very same numbers
      for (const bad of [[NaN, 1], [1], 'x', { x: 1 }, [Infinity, 0], null]) {
        const f = createFold(group, domain, mesh, { anchor: bad });
        assert.equal(f.anchor, null);
        for (const t of [0.3, 0.75, 1]) {
          const F0 = plain.at(t), F1 = f.at(t);
          for (let v = 0; v < M.n; v += 17) { F0(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], ref); F1(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out); assert.ok(out.every((c, i) => Object.is(c, ref[i])), `anchor ${JSON.stringify(bad)}: not the fold without an anchor`); }
        }
      }
    }
  }
  assert.ok(compared >= 7 * 16);
});

test('anchor (SPEC 7) 5: the anchor\'s cell — the cell in front when the anchor is less than ROOT_SHIFT hy behind a crease and a quarter of its tile lies there, else its own; all presets share one', () => {
  const cellOf = (a, want, label) => {
    const c = apply(anchorCell(group, a).iso, A2 / 2, B2 / 2);
    assert.ok(Math.hypot(c[0] - want[0], c[1] - want[1]) < 1e-12, `${label}: the anchor (${a}) sits on the cell centred at (${c}), not (${want})`);
  };
  for (const p of group.presets) cellOf(p.seed, [A2 / 2, B2 / 2], p.name);
  // just behind the crease y = b/2 (its tile reaches over the crease): the cell in front; further back: its own
  cellOf([0.3, B2 + 0.02], [A2 / 2, B2 / 2], 'just behind the crease');
  cellOf([0.3, B2 + 0.3], [A2 / 2, 1.5 * B2], 'further back');
  // in front of the crease, and across the vertical creases: its own cell
  cellOf([0.3, B2 - 0.02], [A2 / 2, B2 / 2], 'in front of the crease');
  cellOf([A2 + 0.2, 0.5], [1.5 * A2, B2 / 2], 'across x = a/2');
  cellOf([-0.1, 0.5], [-A2 / 2, B2 / 2], 'across x = 0');
  // the point handed to the hinge kinematics lies inside that cell, next to the anchor
  for (const a of [...group.presets.map((p) => p.seed), [0.3, B2 + 0.02], [A2, B2]]) {
    const c = anchorCell(group, a), u = apply(inverse(c.iso), c.point[0], c.point[1]);
    assert.ok(u[0] > 0 && u[0] < A2 && u[1] > 0 && u[1] < B2 && Math.hypot(c.point[0] - a[0], c.point[1] - a[1]) < 0.3, `anchor (${a}): the point ${c.point}`);
  }
  assert.equal(anchorCell(group, [NaN, 0]), null);
  assert.equal(anchorCell(group, null), null);
});

// ===============================================================================================================
// Round 2. Stage 2 for the cuts that reach into the near half: pinch, roll, fold back (design 'acts')
// ===============================================================================================================

const v3sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const v3cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Does the segment p0 -> p1 pass through the triangle (a, b, c) (strictly inside both)? */
function segTri(p0, p1, a, b, c) {
  const e1 = v3sub(b, a), e2 = v3sub(c, a), d = v3sub(p1, p0), h = v3cross(d, e2), dt = v3dot(e1, h);
  if (Math.abs(dt) < 1e-15) return false;
  const f = 1 / dt, s = v3sub(p0, a), u = f * v3dot(s, h);
  if (u < 0 || u > 1) return false;
  const q = v3cross(s, e1), v = f * v3dot(d, q);
  if (v < 0 || u + v > 1) return false;
  const t = f * v3dot(e2, q);
  return t > 0 && t < 1;
}

/**
 * The parts of the drawn mesh in the near half (eta < -band at the pause) and in the far half (eta > band), and a
 * counter: how many near triangles pass through some far triangle at time t. (The band next to the great circle
 * eta = 0 is left out: that circle becomes the double line, where the closed shape crosses itself anyway.)
 */
function nearFar(fold, band = 0.15) {
  const M = fold.mesh, kin = fold.kinematics, p = [0, 0, 0], eta = new Float64Array(M.n);
  for (let v = 0; v < M.n; v++) { kin.pillow(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], p); eta[v] = fold.frame.sy * p[1]; }
  const near = [], far = [];
  for (let t = 0; t < M.m; t++) {
    const T = [M.tri[3 * t], M.tri[3 * t + 1], M.tri[3 * t + 2]];
    if (T.every((v) => eta[v] < -band)) near.push(T); else if (T.every((v) => eta[v] > band)) far.push(T);
  }
  const pos = new Float64Array(3 * M.n), out = [0, 0, 0], P = (v) => [pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]];
  const crossings = (t) => {
    const F = fold.at(t);
    for (let v = 0; v < M.n; v++) { F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out); pos[3 * v] = out[0]; pos[3 * v + 1] = out[1]; pos[3 * v + 2] = out[2]; }
    const H = 0.04, grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
    const box = (T) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const v of T) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], pos[3 * v + j]); hi[j] = Math.max(hi[j], pos[3 * v + j]); } return [lo.map((c) => Math.floor(c / H)), hi.map((c) => Math.floor(c / H))]; };
    far.forEach((T, i) => { const [lo, hi] = box(T); for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); } });
    const stamp = new Int32Array(far.length).fill(-1);
    let hits = 0;
    near.forEach((T, n) => {
      const [lo, hi] = box(T), a = T.map(P);
      let hit = false;
      for (let x = lo[0]; x <= hi[0] && !hit; x++) for (let y = lo[1]; y <= hi[1] && !hit; y++) for (let z = lo[2]; z <= hi[2] && !hit; z++) {
        for (const i of grid.get(key(x, y, z)) || []) {
          if (stamp[i] === n) continue;
          stamp[i] = n;
          const b = far[i].map(P);
          for (let e = 0; e < 3 && !hit; e++) hit = segTri(a[e], a[(e + 1) % 3], b[0], b[1], b[2]) || segTri(b[e], b[(e + 1) % 3], a[0], a[1], a[2]);
          if (hit) break;
        }
      }
      if (hit) hits++;
    });
    return hits;
  };
  return { near, far, crossings };
}
// (round 3: stage 2 starts at 0.45 with a crease and at 0.18 without one, the Bowl's: from 0.3 on)
const STAGE2_TIMES = [0.3, 0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99];

test('stage 2 (acts): the part of the tile in the near half never passes through the part in the far half — Bowl, Hexagon, a hair behind the centre of the cell, straight and wavy, and drags of 0.04 around the presets; round 1\'s twist does (control)', () => {
  const [P0, P1, P2] = group.presets.map((p) => p.seed);
  const tiles = [];
  for (const amp of AMPS) {
    // (round 3: the wave now bends every cut edge, core finding 1, and the WAVY Bowl's near part gets lobes on the
    // upper sheet: like the Bowl drags it lies on both sheets, so it is counted with them, below)
    for (const [name, seed] of [['Bowl', P1], ['Hexagon', P2], ['a hair behind the centre of the cell', [A2 / 2, 0.52 * B2]]]) tiles.push({ name, seed, anchor: seed, amp, strict: !(name !== 'Hexagon' && amp === 1) });
    for (const [name, P] of [['Pocket', P0], ['Bowl', P1], ['Hexagon', P2]]) {
      for (let k = 0; k < 8; k++) tiles.push({ name: `${name} dragged ${k * 45} deg`, seed: [P[0] + 0.04 * Math.cos((k * PI) / 4), P[1] + 0.04 * Math.sin((k * PI) / 4)], anchor: P, amp, strict: name !== 'Bowl' });
    }
    // round 3 (finding 3): the reviewer's generic cuts dragged from the default one (the app's anchor is then the Pocket's seed)
    tiles.push({ name: 'seed (0.5, 0.75) dragged from the Pocket', seed: [0.5, 0.75], anchor: P0, amp, strict: true });
  }
  const report = [];
  let acts = 0, twist = 0, actsLoose = 0, twistLoose = 0;
  for (const T of tiles) {
    const domain = buildDomain(group, { seed: T.seed, warp: makeWarp(group, T.amp) });
    const mesh = buildMesh(group, domain);
    const A = nearFar(createFold(group, domain, mesh, { anchor: T.anchor }));
    const B = nearFar(createFold(group, domain, mesh, { anchor: T.anchor, stage2: 'twist' }));
    const ca = STAGE2_TIMES.map((t) => A.crossings(t)), cb = STAGE2_TIMES.map((t) => B.crossings(t));
    const sa = ca.reduce((s, c) => s + c, 0), sb = cb.reduce((s, c) => s + c, 0);
    if (T.strict) { acts += sa; twist += sb; assert.equal(sa, 0, `${T.name} amp ${T.amp}: near triangles crossing the far part at t = ${STAGE2_TIMES}: ${ca}`); } else { actsLoose += sa; twistLoose += sb; }
    if (sa || !T.name.includes('dragged')) report.push(`${T.name} amp ${T.amp}: ${sa} (twist ${sb})`);
  }
  // the round 1 design passes the near part through the far part for the same tiles: the count has teeth
  assert.ok(twist >= 100, `round 1's twist: ${twist} crossings`);
  // drags of the Bowl toward the camera reach under the near rim into the cell in front: a few crossings while
  // the near part lands are left (the twist has ten times as many)
  assert.ok(actsLoose <= twistLoose / 10, `Bowl drags: ${actsLoose} crossings (twist ${twistLoose})`);
  console.log(`      near triangles passing through the far part, summed over t = ${STAGE2_TIMES[0]}..${STAGE2_TIMES[STAGE2_TIMES.length - 1]}: acts ${acts} (twist ${twist}) on ${tiles.filter((T) => T.strict).length} tiles; Bowl drags ${actsLoose} (twist ${twistLoose})\n        ` + report.join('\n        '));
});

// Round 3, finding 3: generic cuts dragged from the default one (what the owner does: the app's anchor is then the
// Pocket's seed) whose near part is most of the tile. Round 2's fold back slid the part onto its place at 38 degrees
// from the front, swung by a lift averaged over the mesh's VERTICES (biased by the mesh's grading, and jumping as a
// wavy cut is re-meshed): seed (0.2, 0.3) passed 113 / 82 near triangles through the far part (straight / wavy) and
// this set of 24 cuts 933. Now the lift is an area integral and the part lands straight down (or up) onto its place.
test('stage 2 (acts) on generic cuts dragged from the Pocket: the reviewer\'s seed (0.2, 0.3) and 24 random cuts in and around the fixed cell — far fewer near triangles pass through the far part than in round 2, and far fewer than round 1\'s twist', () => {
  const P0 = group.presets[0].seed, rnd = prng(99), cutsAt = [{ seed: [0.2, 0.3], amp: 0, cap: 20 }, { seed: [0.2, 0.3], amp: 1, cap: 45 }];
  for (let k = 0; k < 24; k++) cutsAt.push({ seed: [-0.1 + 0.85 * rnd(), 0.05 + 1.1 * rnd()], amp: k % 2 });
  const times = [...STAGE2_TIMES, 0.875, 0.925, 0.975];
  let acts = 0, twist = 0, worstName = '', worst = 0;
  const lines = [];
  for (const c of cutsAt) {
    const domain = buildDomain(group, { seed: c.seed, warp: makeWarp(group, c.amp) }), mesh = buildMesh(group, domain);
    const A = nearFar(createFold(group, domain, mesh, { anchor: P0 })), B = nearFar(createFold(group, domain, mesh, { anchor: P0, stage2: 'twist' }));
    const sa = times.reduce((s, t) => s + A.crossings(t), 0), sb = times.reduce((s, t) => s + B.crossings(t), 0);
    acts += sa; twist += sb;
    if (sa > worst) { worst = sa; worstName = `(${c.seed.map((v) => v.toFixed(3))}) amp ${c.amp}`; }
    if (c.cap !== undefined) { lines.push(`seed (${c.seed}) amp ${c.amp}: ${sa} (twist ${sb})`); assert.ok(sa <= c.cap, `seed (${c.seed}) amp ${c.amp}: ${sa} near triangles cross the far part (round 2: 113 / 82)`); }
  }
  assert.ok(acts <= 600, `24 + 2 generic cuts: ${acts} near triangles cross the far part (round 2: 933 on the 24)`);
  assert.ok(acts <= twist / 4, `generic cuts: ${acts} crossings, round 1's twist ${twist}`);
  console.log(`      ${lines.join('; ')}; all ${cutsAt.length} cuts: ${acts} (twist ${twist}), most in ${worstName}: ${worst}`);
});

test('stage 2: the "2" labels — the far corners of the fixed cell never move; the Bowl\'s two near corners stay in front of the tip until the swing back, then land on the diagonally opposite far corners at t = 1', () => {
  const out = [0, 0, 0];
  for (const amp of AMPS) {
    for (const p of group.presets) {
      const domain = buildDomain(group, { seed: p.seed, warp: makeWarp(group, amp) });
      const fold = createFold(group, domain, buildMesh(group, domain), { anchor: p.seed }), fr = fold.frame;
      const far = domain.conePoints.filter((c) => Math.abs(c.y - B2) < 1e-9), near = domain.conePoints.filter((c) => Math.abs(c.y) < 1e-9);
      // Pocket and Hexagon: two cone points, the far corners. Bowl (the cell itself): the four corners, two pairs
      assert.equal(far.length, 2, `${p.name}: the far corners are cone points`);
      assert.equal(near.length + far.length, domain.conePoints.length, `${p.name}: cone points ${domain.conePoints.map((c) => [c.x, c.y])}`);
      assert.equal(near.length, p.name === 'Bowl' ? 2 : 0, `${p.name}: near corners`);
      const TM = fold.times;
      for (const c of far) {
        const cell = fold.mesh.locate(c.x, c.y), at = fold.at(TM.halfStop)(c.x, c.y, cell, [0, 0, 0]);
        assert.ok(Math.abs(Math.abs(at[0] - fr.xc) - fr.hx) < 1e-7 && Math.abs(at[1] - fr.yc - fr.hy) < 1e-7 && Math.abs(at[2]) < 1e-6, `${p.name}: a cone point at ${at} at the middle stop, not a far corner`);
        for (const t of [TM.zipStart, 0.6, 0.7, 0.8, 0.9, 0.97, 1]) {
          fold.at(t)(c.x, c.y, cell, out);
          assert.ok(Math.hypot(out[0] - at[0], out[1] - at[1], out[2] - at[2]) < 1e-6 * size, `${p.name} amp ${amp}: a far cone point moves to ${out} at t = ${t}`);
        }
      }
      for (const c of near) {
        const cell = fold.mesh.locate(c.x, c.y);
        // its glide partner: the far corner diagonally opposite in the cell
        const partner = far.find((f) => Math.abs(f.x - c.x) > A2 / 2), target = fold.at(TM.halfStop)(partner.x, partner.y, fold.mesh.locate(partner.x, partner.y), [0, 0, 0]);
        let crossed = false;
        for (let k = 0; k <= 100; k++) {
          const u = k / 100, t = TM.zipStart + u * (1 - TM.zipStart);
          fold.at(t)(c.x, c.y, cell, out);
          const d = Math.hypot(out[0] - target[0], out[1] - target[1], out[2] - target[2]);
          // carried there by the motion, landing softly: well apart until t = 0.95, together at t = 1
          if (u <= 0.9) assert.ok(d > 0.02 * size, `${p.name} amp ${amp}: a near cone point already on its partner at t = ${t}`);
          if (u === 1) assert.ok(d < 1e-6 * size, `${p.name} amp ${amp}: a near cone point lands ${d} from its partner`);
          // in front of the tip (y < yc) while the front pouch rolls and until the swing back is half way; behind it after
          if (out[1] > fr.yc) crossed = true;
          // (round 3: "half way back" is the half way of the swing's move in y, out[4]; it runs ahead of the fold
          // back's clock, out[2], because the part then comes straight down onto its place)
          const del = actsTiming(u, fold.nearReach, [0, 0, 0, 0, 0], ACTS, fold.actsFree)[4];
          if (del < 0.45) assert.ok(out[1] < fr.yc, `${p.name} amp ${amp}: a near cone point at y = ${out[1]} at t = ${t}, before the swing back is half way`);
          if (del > 0.55) assert.ok(out[1] > fr.yc, `${p.name} amp ${amp}: a near cone point at y = ${out[1]} at t = ${t}, after the swing back is half way`);
        }
        assert.ok(crossed, `${p.name}: the near cone point never went over the tip`);
      }
    }
  }
});

test('stage 2: the Pocket (nothing in the near half) zips exactly as in round 1', () => {
  // Round 3: the wave now bends the Pocket's glide edges too (core, finding 1), so the WAVY Pocket reaches a little
  // into the near half: it is not round 1's zip any more, but its near part is small and passes through nothing
  {
    const p = group.presets[0], domain = buildDomain(group, { seed: p.seed, warp: makeWarp(group, 1) }), mesh = buildMesh(group, domain);
    const acts = createFold(group, domain, mesh, { anchor: p.seed });
    assert.ok(acts.nearReach < 0.35, `the wavy Pocket reaches ${acts.nearReach} into the near half`);
    const C = nearFar(acts), crossings = STAGE2_TIMES.map((t) => C.crossings(t));
    assert.equal(crossings.reduce((a, b) => a + b, 0), 0, `the wavy Pocket: near triangles crossing the far part at t = ${STAGE2_TIMES}: ${crossings}`);
  }
  for (const amp of [0]) {
    const p = group.presets[0], domain = buildDomain(group, { seed: p.seed, warp: makeWarp(group, amp) }), mesh = buildMesh(group, domain);
    const acts = createFold(group, domain, mesh, { anchor: p.seed }), twist = createFold(group, domain, mesh, { anchor: p.seed, stage2: 'twist' });
    assert.equal(acts.stage2, 'acts'); assert.equal(twist.stage2, 'twist');
    assert.ok(acts.nearReach < 1e-6, `nearReach ${acts.nearReach}`);
    const M = acts.mesh, out = [0, 0, 0], ref = [0, 0, 0];
    for (const t of [0.55, 0.65, 0.75, 0.85, 0.95]) {
      let worst = 0;
      for (let v = 0; v < M.n; v++) { acts.at(t)(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out); twist.at(t)(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], ref); worst = Math.max(worst, Math.hypot(out[0] - ref[0], out[1] - ref[1], out[2] - ref[2])); }
      assert.ok(worst < 1e-6 * size, `amp ${amp} t = ${t}: ${worst / size} tile sizes from round 1's zip`);
    }
    // and its double line grows with round 1's zip
    for (const t of [0.6, 0.8]) { const a = acts.doubleLine(t), b = twist.doubleLine(t); assert.ok(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9), `doubleLine(${t})`); }
  }
});

test('stage 2: the three acts — pinch, roll, fold back: in [0, 1], monotonic, smooth, at rest at both ends; the quick pinch only for tiles that reach into the near half', () => {
  const e = 1e-6;
  for (const nu of [0, 0.05, 0.2, ACTS.nu0, 0.79, 1]) {
    const a = actsTiming(0, nu), b = actsTiming(1, nu);
    assert.deepEqual([a[0], a[1], a[2]], [0, 0, 0]); assert.deepEqual([b[0], b[1], b[2]], [1, 1, 1]);
    let prev = actsTiming(0, nu);
    for (let k = 1; k <= 2000; k++) {
      const cur = actsTiming(k / 2000, nu);
      for (let j = 0; j < 3; j++) assert.ok(cur[j] >= prev[j] - 1e-15 && cur[j] <= 1, `nu ${nu}: act ${j} at ${k / 2000}`);
      prev = cur;
    }
    for (const u0 of [0, 1]) {
      const p = actsTiming(u0 === 0 ? 0 : 1 - e, nu), q = actsTiming(u0 === 0 ? e : 1, nu);
      for (let j = 0; j < 3; j++) assert.ok(Math.abs(q[j] - p[j]) < 1e-9, `nu ${nu}: act ${j} is not at rest at u = ${u0}`);
    }
    for (const u0 of [0.05, ACTS.pinch, ACTS.roll[0], ACTS.roll[1], ACTS.fold[0], 0.5, 0.8]) {
      const p = actsTiming(u0 - e, nu), c = actsTiming(u0, nu), q = actsTiming(u0 + e, nu);
      for (let j = 0; j < 3; j++) assert.ok(Math.abs(q[j] - 2 * c[j] + p[j]) < 1e-9, `nu ${nu}: act ${j} has a kink at ${u0}`);
    }
  }
  // nothing in the near half: the pinch is round 1's zip, crosscapSchedule's s
  for (let k = 0; k <= 100; k++) { const u = k / 100; assert.ok(Math.abs(actsTiming(u, 0)[0] - crosscapSchedule(ZIP_START + u * (1 - ZIP_START))[2]) < 1e-12); }
  // reaching far into it: the double line is closed before the roll is half done; the fold back begins when the roll
  // is more than half done, and has not swung the part past the tip (half way) when the roll is over. (The windows of
  // ACTS are measured from the middle stop: free = 0 reads them as they are.)
  const far = (u) => actsTiming(u, 1, [0, 0, 0, 0], ACTS, 0);
  assert.equal(far(ACTS.pinch)[0], 1);
  assert.ok(far(ACTS.pinch)[1] < 0.5 && far(ACTS.fold[0])[1] > 0.5 && far(ACTS.roll[1])[2] < 0.5, 'pinch, roll, fold back in this order');
  // round 3: the zip starts before the middle stop (no pause), at u = free of stage 2. Until then every tile zips
  // alike and nothing rolls or folds back (the middle stop depends on the anchor alone); after it the acts run as
  // above in the time v = (u - free) / (1 - free) that is left
  for (const free of [ACTS_FREE, (TIMES_NO_CREASE.halfEnd - TIMES_NO_CREASE.zipStart) / (1 - TIMES_NO_CREASE.zipStart)]) {
    assert.ok(free > 0.03 && free < 0.1, `free ${free}`);
    for (let k = 0; k <= 50; k++) {
      const u = (k / 50) * free, ref = actsTiming(u, 0, [0, 0, 0, 0], ACTS, free);
      for (const nu of [0.2, 0.6, 1]) { const a = actsTiming(u, nu, [0, 0, 0, 0], ACTS, free); assert.ok(a[0] === ref[0] && a[1] === 0 && a[2] === 0, `free ${free} u ${u} nu ${nu}: ${a}`); }
    }
    for (let k = 0; k <= 50; k++) {
      const v = k / 50, u = free + v * (1 - free), a = actsTiming(u, 1, [0, 0, 0, 0], ACTS, free), b = actsTiming(v, 1, [0, 0, 0, 0], ACTS, 0);
      assert.ok(Math.abs(a[1] - b[1]) < 1e-12 && Math.abs(a[2] - b[2]) < 1e-12 && a[0] >= b[0] - 1e-12, `free ${free} v ${v}: the acts are not those of free = 0 shifted (${a} vs ${b})`);
    }
    assert.equal(actsTiming(free + ACTS.pinch * (1 - free), 1, [0, 0, 0, 0], ACTS, free)[0], 1, 'the quick pinch is done at the same point of the acts');
  }
});

// Round 3: the reference is round 1's twist in round 2's timing (opts.timing 'round2'): with round 3's timing the
// twist itself is slower (a longer stage 2, and the zip's shorter landing lowers its top rate), so comparing with it
// would no longer tell whether stage 2 got faster than it was.
test('stage 2: no faster than round 1 — the largest vertex step of stage 2 is at most 1.15 times that of round 1\'s twist (in round 2\'s timing), on the presets and on random cuts', () => {
  const rnd = prng(1618);
  const seeds = [...group.presets.map((p) => p.seed), [A2 / 2, B2 / 2]];
  for (let k = 0; k < 6; k++) seeds.push(randomSeed(rnd));
  const N = 200, lines = [];
  const largest = (fold) => {
    const M = fold.mesh, out = [0, 0, 0];
    let prev = null, worst = 0;
    // stage 2 of this fold (round 3: it starts earlier, and for the Bowl much earlier)
    for (let k = Math.ceil(fold.times.zipStart * N); k <= N; k++) {
      const F = fold.at(k / N), cur = new Float64Array(3 * M.n);
      for (let v = 0; v < M.n; v++) { F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], out); cur[3 * v] = out[0]; cur[3 * v + 1] = out[1]; cur[3 * v + 2] = out[2]; }
      if (prev) for (let i = 0; i < 3 * M.n; i += 3) worst = Math.max(worst, Math.hypot(cur[i] - prev[i], cur[i + 1] - prev[i + 1], cur[i + 2] - prev[i + 2]));
      prev = cur;
    }
    return worst;
  };
  for (const seed of seeds) {
    const domain = buildDomain(group, { seed, warp: makeWarp(group, 0) }), mesh = buildMesh(group, domain);
    const a = largest(createFold(group, domain, mesh, {})), b = largest(createFold(group, domain, mesh, { stage2: 'twist', timing: 'round2' }));
    lines.push((a / b).toFixed(2));
    assert.ok(a <= 1.15 * b + 1e-12, `seed (${seed}): stage 2 moves a vertex ${a} per 1/${N}, round 1's twist ${b}`);
  }
  console.log(`      largest step of stage 2, acts / twist: ${lines.join(' ')}`);
});
