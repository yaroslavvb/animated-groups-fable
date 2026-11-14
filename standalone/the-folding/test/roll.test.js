// Tests for src/folds/roll.js (SPEC 5.3, 5.5): torus (o), cylinder (**), mobius (*x), klein (xx).
// Every preset of the four groups + 20 seeded-random seeds each, amp 0 and 1. Every fold is built once; each check
// records its failures under a name, and the tests below assert that each list is empty.
// The presets are checked on the mesh the fold wants (rollDensity), at every vertex; the random seeds on the default
// mesh, the exact checks (identity, seams, finiteness at the stage boundaries, shape) at every vertex and boundary
// sample, the motion profile on a spread of about 500 of them (the maps are smooth in x; the tile's rim is included).
//   ROLL_SEEDS=100 ROLL_AMPS=0,0.3,1 ROLL_SALT=3 node --test test/roll.test.js      widens the sweep
// These folds are built without opts.anchor (the v1 path: anchor = seed); the anchored path (SPEC 7, round 4) is
// tested in test/roll-anchor.test.js, the Klein bottle's design (flat 8, phase, spin) in test/klein.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BY_ID, contains, elementsNear, symmetryElements } from '../src/groups.js';
import { apply, inverse, compose, det, classify, isIdentity } from '../src/geom.js';
import { makeWarp, buildDomain } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import createFold, { rollDensity, rollSchedule, STAGE, sinc, cosc, figure8, J01, easeIn, easeOut } from '../src/folds/roll.js';

const IDS = ['o', '**', '*x', 'xx'];
const SEEDS = Math.max(20, +process.env.ROLL_SEEDS || 20);
const AMPS = process.env.ROLL_AMPS ? process.env.ROLL_AMPS.split(',').map(Number) : [0, 1];
const SALT = +process.env.ROLL_SALT || 0;
const TAU = 2 * Math.PI;

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
  for (const [i, p] of group.presets.entries()) yield { label: `${group.id} preset ${i} (${p.name})`, seed: p.seed, metric: p.metric, preset: true };
  const rnd = prng(977 + 31 * IDS.indexOf(group.id) + 7919 * SALT);
  for (let k = 0; k < SEEDS; k++) {
    const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
    yield { label: `${group.id} random seed ${k} (${seed[0].toFixed(4)}, ${seed[1].toFixed(4)})`, seed, metric: group.presets[k % group.presets.length].metric, preset: false };
  }
}

const NAMES = ['api', 'identity', 'seams', 'seamsOpen', 'stageSeam', 'continuity', 'order', 'spike', 'refine', 'boundaries', 'finite', 'limit',
  'invariance', 'shape', 'upward', 'near', 'embedded', 'isometry', 'mesh', 'doubleLine', 'proportions'];
const failures = {};
for (const k of NAMES) failures[k] = [];
const fail = (name, msg) => { failures[name].push(msg); };
const show = (name) => `${failures[name].length} failures, e.g.\n  ` + failures[name].slice(0, 6).join('\n  ');
const stats = { folds: 0, minStep: Infinity, maxSeam: 0, maxInv: 0, maxStep: 0, maxRatio: 0, maxShape: 0, minClear: Infinity, invChecks: 0, elements: 0, minZ: 0, maxTri: 0 };

/** Images of the points (xs: flat [x, y, ...]) under F, into pos (flat [x, y, z, ...]). */
function image(F, xs, pos, out) {
  for (let i = 0, j = 0; i < xs.length; i += 2, j += 3) {
    out[0] = out[1] = out[2] = NaN;
    F(xs[i], xs[i + 1], 0, out);
    pos[j] = out[0]; pos[j + 1] = out[1]; pos[j + 2] = out[2];
  }
  return pos;
}
/** Largest distance between corresponding points of two position arrays (NaN if any is not finite). */
function maxDist(a, b) {
  let m = 0;
  for (let j = 0; j < a.length; j += 3) {
    const d = Math.hypot(a[j] - b[j], a[j + 1] - b[j + 1], a[j + 2] - b[j + 2]);
    if (!(d <= m)) m = d;        // NaN sticks
  }
  return m;
}
/** Largest distance between the images of the points under two maps. */
function maxMove(F, G, xs, out) {
  return maxDist(image(F, xs, new Float64Array((xs.length / 2) * 3), out), image(G, xs, new Float64Array((xs.length / 2) * 3), out));
}

/**
 * The smallest distance in space between two vertices that are far apart in the plane (Infinity: nothing within
 * cellSize): the sheet does not touch itself. `glued` (optional): a plane vector; pairs that differ by it, up to
 * farPlane, are meant to touch (a seam that is already closed) and are skipped.
 */
function clearance(pos, xy, n, farPlane, cellSize, glued) {
  const grid = new Map();
  const key = (i, j, k) => (i * 73856093) ^ (j * 19349663) ^ (k * 83492791);
  for (let v = 0; v < n; v++) {
    const k = key(Math.floor(pos[3 * v] / cellSize), Math.floor(pos[3 * v + 1] / cellSize), Math.floor(pos[3 * v + 2] / cellSize));
    let a = grid.get(k);
    if (!a) { a = []; grid.set(k, a); }
    a.push(v);
  }
  let best = Infinity;
  for (let v = 0; v < n; v++) {
    const ci = Math.floor(pos[3 * v] / cellSize), cj = Math.floor(pos[3 * v + 1] / cellSize), ck = Math.floor(pos[3 * v + 2] / cellSize);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
      const a = grid.get(key(ci + di, cj + dj, ck + dk));
      if (!a) continue;
      for (const u of a) {
        if (u <= v) continue;
        const px = xy[2 * u] - xy[2 * v], py = xy[2 * u + 1] - xy[2 * v + 1];
        if (Math.hypot(px, py) < farPlane) continue;
        if (glued && (Math.hypot(px - glued[0], py - glued[1]) < farPlane || Math.hypot(px + glued[0], py + glued[1]) < farPlane)) continue;
        const d = Math.hypot(pos[3 * u] - pos[3 * v], pos[3 * u + 1] - pos[3 * v + 1], pos[3 * u + 2] - pos[3 * v + 2]);
        if (d < best) best = d;
      }
    }
  }
  return best;       // Infinity: nothing within cellSize
}

function checkFold(group, domain, mesh, label, amp, isPreset, rnd) {
  const size = Math.sqrt(group.domainArea);
  const fold = createFold(group, domain, mesh, isPreset ? {} : { density: false });
  const M = fold.mesh, { n, xy, tri } = M;
  const type = group.fold, P = fold.params;
  const out = [0, 0, 0], o2 = [0, 0, 0], q = [0, 0];
  stats.folds++; stats.maxTri = Math.max(stats.maxTri, tri.length / 3);

  // every point the app maps: the vertices (double coordinates of the Float32 values) and the boundary samples
  const verts = Float64Array.from(xy.subarray(0, 2 * n));
  const bpts = [];
  for (const b of M.boundary) for (let k = 0; k < b.pts.length; k++) bpts.push(b.pts[k]);
  const all = Float64Array.from([...verts, ...bpts]);
  // a spread of the vertices and of the rim, for the motion profile
  const pick = [], kv = Math.max(1, Math.round(n / (isPreset ? 900 : 380))), kb = isPreset ? 2 : 4;
  for (let v = 0; v < n; v += kv) pick.push(verts[2 * v], verts[2 * v + 1]);
  for (let i = 0; i < bpts.length; i += 2 * kb) pick.push(bpts[i], bpts[i + 1]);
  const sample = Float64Array.from(pick);
  const posA = new Float64Array((sample.length / 2) * 3), posB = new Float64Array(posA.length), posC = new Float64Array(posA.length);

  // ---- the interface
  if (M !== mesh) fail('mesh', `${label}: the fold did not keep the mesh it was given`);
  if (!(M.xy instanceof Float32Array) || !(M.tri instanceof Uint32Array) || !Array.isArray(M.boundary)) fail('api', `${label}: fold.mesh`);
  const st = fold.stops;
  if (!Array.isArray(st) || st.length < 2 || st[0].t !== 0 || st[st.length - 1].t !== 1 ||
    st.some((s, i) => typeof s.label !== 'string' || !s.label || (i > 0 && !(s.t > st[i - 1].t)))) fail('api', `${label}: stops ${JSON.stringify(st)}`);
  if (STAGE[type] && !(st.length === 3 && st[1].t === STAGE[type].t1)) fail('api', `${label}: the inner stop is not STAGE.t1`);
  if (!(fold.duration >= 4 && fold.duration <= 7)) fail('api', `${label}: duration ${fold.duration}`);
  if (typeof fold.at(0.3) !== 'function' || fold.at(0.3)(xy[0], xy[1], 0, out) !== out) fail('api', `${label}: at(t) must return fn(x, y, cell, out) -> out`);
  if (fold.type !== type) fail('api', `${label}: fold.type`);

  // ---- 1. at(0) is the identity, exactly
  for (const t0 of [0, -0, -0.25, NaN]) {
    const F = fold.at(t0);
    for (let i = 0; i < all.length; i += 2) {
      out[0] = out[1] = out[2] = NaN;
      F(all[i], all[i + 1], 0, out);
      if (out[0] !== all[i] || out[1] !== all[i + 1] || !Object.is(out[2], 0)) { fail('identity', `${label}: at(${t0}) moves the point ${all[i]}, ${all[i + 1]} to ${out}`); break; }
    }
  }

  // ---- 2. seams close at t = 1
  let cx = 0, cy = 0;
  for (const p of domain.poly) { cx += p[0] / domain.poly.length; cy += p[1] / domain.poly.length; }
  const inwardPiece = (x, y) => {
    domain.warp.inv(x, y, q);
    const dx = cx - q[0], dy = cy - q[1], l = Math.hypot(dx, dy) || 1;
    domain.warp.fwd(q[0] + (1e-6 * dx) / l, q[1] + (1e-6 * dy) / l, q);
    return M.locate(q[0], q[1]);
  };
  const byEdge = new Map(M.boundary.map((b) => [b.edge, b]));
  const seamGap = (F, viaLocate, only) => {
    let gap = 0, cuts = 0;
    for (let i = 0; i < domain.edges.length; i++) {
      const e = domain.edges[i];
      if (e.kind !== 'cut' || (only && !only(e))) continue;
      cuts++;
      const bi = byEdge.get(i), gi = inverse(e.g);
      for (let j = 0; j < bi.pts.length / 2; j++) {
        const x = bi.pts[2 * j], y = bi.pts[2 * j + 1];
        apply(gi, x, y, q);
        const x2 = q[0], y2 = q[1];
        F(x, y, viaLocate ? inwardPiece(x, y) : bi.cells[j], out); F(x2, y2, viaLocate ? inwardPiece(x2, y2) : 7, o2);
        const d = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]);
        if (!(d <= gap)) gap = d;
      }
    }
    return cuts ? gap : NaN;
  };
  const F1 = fold.at(1);
  const g1 = seamGap(F1, false), g2 = seamGap(F1, true);
  stats.maxSeam = Math.max(stats.maxSeam, g1 / size, g2 / size);
  if (!(g1 < 1e-6 * size)) fail('seams', `${label}: seam gap ${g1} at t = 1`);
  if (!(g2 < 1e-6 * size)) fail('seams', `${label}: seam gap ${g2} at t = 1 (pieces from mesh.locate of the nudged points)`);
  if (!(g1 < 1e-10 * size)) fail('seams', `${label}: seam gap ${g1}: the final map is not invariant to rounding`);
  if (!(seamGap(fold.at(0.5), false) > 1e-2 * size)) fail('seamsOpen', `${label}: the seams are already closed at t = 0.5`);
  if (!(seamGap(fold.at(0.97), false) > 1e-4 * size)) fail('seamsOpen', `${label}: the seams are already closed at t = 0.97`);

  // ---- 2b. two-stage folds: the first seam (the tube / the 8) is closed from the inner stop on
  if (STAGE[type]) {
    const closing = type === 'torus' ? [P.roll[0] * P.L, P.roll[1] * P.L] : [P.across[0] * P.period, P.across[1] * P.period];
    for (const t of [STAGE[type].t1, 0.6, 0.83, 1]) {
      const F = fold.at(t);
      let gap = 0;
      for (let i = 0; i < sample.length; i += 2) {
        F(sample[i], sample[i + 1], 0, out); F(sample[i] + closing[0], sample[i + 1] + closing[1], 0, o2);
        gap = Math.max(gap, Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]));
      }
      if (!(gap < 1e-10 * size)) fail('stageSeam', `${label}: at t = ${t} the first seam is open by ${gap}`);
    }
    const Fb = fold.at(STAGE[type].t2);
    let gap = 0;
    for (let i = 0; i < sample.length; i += 2) {
      Fb(sample[i], sample[i + 1], 0, out); Fb(sample[i] + closing[0], sample[i + 1] + closing[1], 0, o2);
      gap = Math.max(gap, Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]));
    }
    if (!(gap > 1e-4 * size)) fail('stageSeam', `${label}: the first seam is already closed when the ring starts`);
  }

  // ---- 3. continuity: 200 steps
  const STEPS = 200, per = new Float64Array(STEPS);
  let prev = image(fold.at(0), sample, posA, out), cur = posB;
  for (let i = 1; i <= STEPS; i++) {
    image(fold.at(i / STEPS), sample, cur, out);
    per[i - 1] = maxDist(prev, cur);
    const sw = prev; prev = cur; cur = sw;
  }
  let mx = 0, mean = 0;
  for (let i = 0; i < STEPS; i++) { if (!(per[i] <= mx)) mx = per[i]; mean += per[i] / STEPS; }
  if (!Number.isFinite(mx)) fail('finite', `${label}: a step of the motion is not finite`);
  stats.maxStep = Math.max(stats.maxStep, mx / size); stats.maxRatio = Math.max(stats.maxRatio, mx / mean);
  if (!(mx < 0.08 * size)) fail('continuity', `${label}: a step of 1/200 moves a vertex by ${(mx / size).toFixed(4)} tile sizes`);
  if (!(mx < 4 * mean)) fail('order', `${label}: largest step ${(mx / size).toFixed(4)} is ${(mx / mean).toFixed(1)} x the mean step`);
  for (let i = 0; i < STEPS; i++) {
    const nb = Math.max(i > 0 ? per[i - 1] : 0, i + 1 < STEPS ? per[i + 1] : 0);
    if (!(per[i] <= 1.6 * nb + 1e-9 * size)) fail('spike', `${label}: step ${i} moves ${(per[i] / size).toFixed(5)}, its neighbours at most ${(nb / size).toFixed(5)}`);
  }
  // the motion never rests between the ends: where the tube closes and the ring starts (the stages overlap) it slows
  // to about a tenth of its mean speed for a moment, and nowhere else below a third
  const S2 = STAGE[type];
  for (let i = 0; i < STEPS; i++) {
    const t = (i + 0.5) / STEPS, atJunction = S2 && t > S2.t2 - 0.04 && t < S2.t1 + 0.04;
    stats.minStep = Math.min(stats.minStep, per[i] / mean);
    if (!(per[i] > (atJunction ? 0.06 : 0.3) * mean)) fail('order', `${label}: the motion nearly stops at t = ${t.toFixed(4)} (${(per[i] / mean).toFixed(3)} of the mean step)`);
  }

  if (isPreset) {
    // a jump would not shrink with the step: 2000 steps must each be about a tenth of the 200-step ones
    const sub = sample.subarray(0, 2 * Math.floor(sample.length / 6)), sa = new Float64Array((sub.length / 2) * 3), sb = new Float64Array(sa.length);
    // the 200-step maximum of the same points, to compare like with like
    let coarse = 0, fine = 0, p = image(fold.at(0), sub, sa, out), c = sb;
    for (let i = 1; i <= 2000; i++) {
      image(fold.at(i / 2000), sub, c, out);
      const d = maxDist(p, c);
      if (!(d <= fine)) fine = d;
      const sw = p; p = c; c = sw;
    }
    p = image(fold.at(0), sub, sa, out); c = sb;
    for (let i = 1; i <= STEPS; i++) { image(fold.at(i / STEPS), sub, c, out); coarse = Math.max(coarse, maxDist(p, c)); const sw = p; p = c; c = sw; }
    mx = coarse;
    if (!(fine < 0.13 * mx + 1e-9 * size)) fail('refine', `${label}: with 2000 steps the largest step is ${(fine / size).toExponential(2)}, with 200 it is ${(mx / size).toExponential(2)}`);
  }

  // ---- 3b. no jump of position or velocity at the inner times (steps of 1e-3 and 1e-5)
  const inner = STAGE[type] ? [STAGE[type].t2, STAGE[type].t1, 0.5] : [0.25, 0.5, 0.75];
  for (const t of inner) {
    for (const h of [1e-3, 1e-5]) {
      image(fold.at(t - h), sample, posA, out); image(fold.at(t), sample, posB, out); image(fold.at(t + h), sample, posC, out);
      const jump = Math.max(maxDist(posA, posB), maxDist(posB, posC));
      let bend = 0;
      for (let j = 0; j < posA.length; j += 3) bend = Math.max(bend, Math.hypot(posC[j] - 2 * posB[j] + posA[j], posC[j + 1] - 2 * posB[j + 1] + posA[j + 1], posC[j + 2] - 2 * posB[j + 2] + posA[j + 2]));
      if (!(jump < 20 * h * size)) fail('boundaries', `${label}: position jumps by ${jump} within ${h} of t = ${t}`);
      if (!(bend < 3000 * h * h * size + 1e-12 * size)) fail('boundaries', `${label}: velocity jumps at t = ${t} (second difference ${bend} for h = ${h})`);
    }
  }
  // t -> 0 and t -> 1: the map tends to the identity / to the closed shape
  for (const h of [1e-3, 1e-6, 1e-9, 1e-12, 1e-300]) {
    const d0 = maxMove(fold.at(0), fold.at(h), sample, out), d1 = maxMove(fold.at(1), fold.at(1 - h), sample, out);
    if (!(d0 <= 20 * h * size + 1e-13 * size)) fail('limit', `${label}: at(${h}) is ${d0} from the identity`);
    if (h > 1e-15 && !(d1 <= 20 * h * size + 1e-13 * size)) fail('limit', `${label}: at(1 - ${h}) is ${d1} from at(1)`);
  }

  // ---- 4. finite for every t, the stage boundaries and beyond the ends included
  const keyTimes = [1e-300, 1e-9, 0.5, 1], moreTimes = [0, 1e-18, 1e-4, 0.1, 0.25, 1 / 3, 0.7, 0.9, 1 - 1e-9, 1 - 1e-16, 1 + 1e-9, 1.5, 3];
  if (STAGE[type]) { const S = STAGE[type]; keyTimes.push(S.t2, S.t1); moreTimes.push(S.t2 - 1e-15, S.t2 + 1e-15, S.t1 - 1e-15, S.t1 + 1e-15, (S.t1 + S.t2) / 2); }
  for (const [times, xs] of [[keyTimes, all], [moreTimes, sample]]) {
    for (const t of times) {
      const F = fold.at(t);
      for (let i = 0; i < xs.length; i += 2) {
        out[0] = out[1] = out[2] = NaN;
        F(xs[i], xs[i + 1], 0, out);
        if (!Number.isFinite(out[0] + out[1] + out[2])) { fail('finite', `${label}: at(${t}) of ${xs[i]}, ${xs[i + 1]} is ${out}`); break; }
      }
    }
  }
  if (maxMove(fold.at(1), fold.at(2), sample, out) !== 0) fail('finite', `${label}: at(2) differs from at(1)`);
  // far from the tile and with a nonsense cell index the map is still finite
  for (const p of [[1e3, -2e3], [-37.5, 12.25]]) {
    for (const t of [0.3, STAGE[type] ? STAGE[type].t1 : 0.5, 1]) {
      fold.at(t)(p[0], p[1], 65535, out);
      if (!Number.isFinite(out[0] + out[1] + out[2])) fail('finite', `${label}: at(${t}) of the far point ${p} is ${out}`);
    }
  }

  // ---- 5. at(1) is invariant under the group (every element that keeps the tile's strip, for the mirror groups)
  const sd = domain.seedActual;
  const diam = Math.hypot(M.bbox[2] - M.bbox[0], M.bbox[3] - M.bbox[1]);
  const mirrors = symmetryElements(group, sd[0], sd[1], 3 * diam).mirrors;
  const sameStrip = (x, y) => mirrors.every((m) => ((x - m.px) * -m.uy + (y - m.py) * m.ux) * ((sd[0] - m.px) * -m.uy + (sd[1] - m.py) * m.ux) > 0);
  const els = elementsNear(group, sd[0], sd[1], 2.2 * diam, sd[0], sd[1]).filter((g) => !isIdentity(g) && sameStrip(...apply(g, sd[0], sd[1])));
  stats.elements += els.length;
  if (els.length < 4) fail('invariance', `${label}: only ${els.length} group elements to test`);
  const pts = [];
  while (pts.length < 2 * 24) {
    const x = sd[0] + (2 * rnd() - 1) * diam, y = sd[1] + (2 * rnd() - 1) * diam;
    if (sameStrip(x, y)) pts.push(x, y);
  }
  for (const g of els) {
    if (!contains(group, g)) { fail('invariance', `${label}: test element not in the group`); continue; }
    for (let i = 0; i < pts.length; i += 2) {
      apply(g, pts[i], pts[i + 1], q);
      F1(pts[i], pts[i + 1], 0, out); F1(q[0], q[1], 0, o2);
      const d = Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]);
      stats.invChecks++;
      if (!(d <= stats.maxInv)) stats.maxInv = d;
      if (!(d < 1e-9 * size)) { fail('invariance', `${label}: at(1) differs by ${d} between a point and its image under ${JSON.stringify(classify(g))}`); break; }
    }
  }
  // ... and it is not invariant under anything else nearby: the fold glues nothing that the group does not
  if (isPreset && amp === 0) {
    const h = 0.31 * size;
    for (const [dx, dy] of [[h, 0], [0, h], [h * 0.6, h * 0.8]]) {
      let m = 0;
      for (let i = 0; i < pts.length; i += 2) { F1(pts[i], pts[i + 1], 0, out); F1(pts[i] + dx, pts[i + 1] + dy, 0, o2); m = Math.max(m, Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2])); }
      if (!(m > 1e-3 * size)) fail('invariance', `${label}: at(1) is invariant under the translation (${dx}, ${dy}), which is not in the group`);
    }
  }

  // ---- 6. the final shape is the named one
  const pos1 = new Float64Array(3 * n);
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < n; v++) {
    F1(verts[2 * v], verts[2 * v + 1], 0, out);
    for (let k = 0; k < 3; k++) { pos1[3 * v + k] = out[k]; if (out[k] < lo[k]) lo[k] = out[k]; if (out[k] > hi[k]) hi[k] = out[k]; }
  }
  let worst = 0;
  const C = P.center;
  if (type === 'torus') {
    for (let v = 0; v < n; v++) {
      const rr = Math.hypot(pos1[3 * v] - C[0], pos1[3 * v + 1] - C[1]) - P.ringRadius;
      worst = Math.max(worst, Math.abs(Math.hypot(rr, pos1[3 * v + 2] - C[2]) - P.tubeRadius));
    }
    if (Math.abs(C[2] - P.tubeRadius) > 1e-12) fail('shape', `${label}: the torus does not rest on the plane`);
  } else if (type === 'cylinder') {
    for (let v = 0; v < n; v++) {
      const along = (pos1[3 * v] - C[0]) * P.roll[0] + (pos1[3 * v + 1] - C[1]) * P.roll[1];
      worst = Math.max(worst, Math.abs(Math.hypot(along, pos1[3 * v + 2] - C[2]) - P.radius));
      // the coordinate across the roll (along the tube) is untouched
      worst = Math.max(worst, Math.abs((pos1[3 * v] - verts[2 * v]) * -P.roll[1] + (pos1[3 * v + 1] - verts[2 * v + 1]) * P.roll[0]));
    }
  } else if (type === 'mobius') {
    // every point lies on the ruling of its ring angle: (rho, z) = c (cos(phi / 2), +-sin(phi / 2)), |c| <= half-width
    for (let v = 0; v < n; v++) {
      const X = (pos1[3 * v] - C[0]) * P.across[0] + (pos1[3 * v + 1] - C[1]) * P.across[1];
      const Y = (pos1[3 * v] - C[0]) * P.along[0] + (pos1[3 * v + 1] - C[1]) * P.along[1];
      const phi = Math.atan2(Y, X), rho = Math.hypot(X, Y) - P.ringRadius, z = pos1[3 * v + 2] - C[2];
      const a = 0.5 * phi * P.twist;
      worst = Math.max(worst, Math.abs(rho * Math.sin(a) - z * Math.cos(a)), Math.max(0, Math.hypot(rho, z) - P.halfWidth * (1 + 1e-6) - (amp ? 0.2 * size : 0)));
    }
    if (!(P.halfWidth < P.ringRadius)) fail('shape', `${label}: the band reaches the axis of its ring`);
  } else if (type === 'klein') {
    // the surface lies in the tube of radius `reach` around the double circle and reaches its rim
    let far = 0;
    for (let v = 0; v < n; v++) {
      const rr = Math.hypot(pos1[3 * v] - C[0], pos1[3 * v + 1] - C[1]) - P.ringRadius;
      const d = Math.hypot(rr, pos1[3 * v + 2] - C[2]);
      far = Math.max(far, d);
      worst = Math.max(worst, d - P.reach);
    }
    worst = Math.max(worst, Math.abs(far - P.reach) - 2e-3 * size);     // the mesh has a vertex near the tip of a lobe
    if (!(P.reach < P.ringRadius)) fail('shape', `${label}: the 8 reaches the axis of its ring`);
  }
  stats.maxShape = Math.max(stats.maxShape, worst / size);
  if (!(worst < 1e-9 * size)) fail('shape', `${label}: the folded tile is ${worst} off its ${type}`);

  // ---- 7. the fold goes toward +z and stays where the tile was
  // (1e-6: a mesh vertex on a mirror has Float32 coordinates, so it can sit 1e-8 beyond the rim of the band)
  if (!(lo[2] > -1e-6 * size)) fail('upward', `${label}: at t = 1 the shape dips to z = ${lo[2]}`);
  if (!(hi[2] > 0.15 * size)) fail('upward', `${label}: at t = 1 the shape rises only to z = ${hi[2]}`);
  // (the tube of ** and the band of *x keep the strip between their mirrors, wherever in it the seed is: compare with the tile)
  const tc = [(M.bbox[0] + M.bbox[2]) / 2, (M.bbox[1] + M.bbox[3]) / 2];
  const off = Math.hypot((lo[0] + hi[0]) / 2 - tc[0], (lo[1] + hi[1]) / 2 - tc[1]);
  if (!(off < 0.3 * size)) fail('near', `${label}: the folded shape is centred ${(off / size).toFixed(3)} tile sizes from the middle of the tile`);
  if (type === 'torus' || type === 'klein') {
    // exactly: the ring is centred on the seed
    if (Math.hypot(C[0] - sd[0], C[1] - sd[1]) > 1e-12) fail('near', `${label}: the ring is not centred on the seed`);
  }
  for (const t of [0.2, 0.45, 0.7, 0.9]) {
    const F = fold.at(t);
    let zmin = Infinity, sx = 0, sy = 0;
    for (let i = 0; i < sample.length; i += 2) { F(sample[i], sample[i + 1], 0, out); if (out[2] < zmin) zmin = out[2]; sx += out[0]; sy += out[1]; }
    stats.minZ = Math.min(stats.minZ, zmin / size);
    if (!(zmin > -0.08 * size)) fail('upward', `${label}: at t = ${t} the sheet dips to z = ${(zmin / size).toFixed(3)} tile sizes`);
    const k = sample.length / 2;
    if (!(Math.hypot(sx / k - tc[0], sy / k - tc[1]) < 0.45 * size)) fail('near', `${label}: at t = ${t} the sheet has drifted ${(Math.hypot(sx / k - tc[0], sy / k - tc[1]) / size).toFixed(3)} tile sizes from the middle of the tile`);
  }

  // ---- 8. presets: the sheet never touches itself on the way (the Klein bottle: not before its 8 closes)
  if (isPreset) {
    const ts = type === 'klein' ? [0.1, 0.2, 0.3] : STAGE[type] ? [0.1, 0.2, 0.3, 0.55, 0.7, 0.85, 0.93] : [0.2, 0.4, 0.6, 0.8, 0.93];
    const pos = new Float64Array(3 * n);
    for (const t of ts) {
      const F = fold.at(t);
      for (let v = 0; v < n; v++) { F(verts[2 * v], verts[2 * v + 1], 0, out); pos[3 * v] = out[0]; pos[3 * v + 1] = out[1]; pos[3 * v + 2] = out[2]; }
      // from the inner stop on the torus is a closed tube: points that differ by e1 are meant to coincide
      const glued = type === 'torus' && t >= STAGE.torus.t2 ? [P.roll[0] * P.L, P.roll[1] * P.L] : null;
      const c = clearance(pos, verts, n, 0.2 * size, 0.012 * size, glued);
      stats.minClear = Math.min(stats.minClear, c / size);
      if (!(c > 0.008 * size)) fail('embedded', `${label}: at t = ${t} two parts of the sheet are ${(c / size).toFixed(4)} tile sizes apart`);
    }
  }

  // ---- 9. isometry where the fold claims it: the cylinder throughout, the first stage of torus and klein
  if (isPreset && type !== 'mobius') {
    const ts = type === 'cylinder' ? [0.3, 0.7, 1] : [0.5 * STAGE[type].t2, STAGE[type].t2];
    for (const t of ts) {
      const F = fold.at(t);
      let worstL = 0;
      for (let k = 0; k < tri.length; k += 3) {
        for (let e = 0; e < 3; e++) {
          const a = tri[k + e], b = tri[k + (e + 1) % 3];
          const L0 = Math.hypot(verts[2 * a] - verts[2 * b], verts[2 * a + 1] - verts[2 * b + 1]);
          if (L0 < 1e-3 * size) continue;
          F(verts[2 * a], verts[2 * a + 1], 0, out); F(verts[2 * b], verts[2 * b + 1], 0, o2);
          worstL = Math.max(worstL, Math.abs(Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]) / L0 - 1));
        }
      }
      if (!(worstL < 0.012)) fail('isometry', `${label}: at t = ${t} a mesh edge changes length by ${(100 * worstL).toFixed(2)} %`);
    }
  }

  // ---- klein: the glide axes of the tile end on the double circle
  if (type === 'klein') {
    if (typeof fold.doubleLine !== 'function') fail('doubleLine', `${label}: no doubleLine`);
    else {
      const lines = fold.doubleLine(1);
      let k = 0, w2 = 0;
      for (const ln of lines) {
        for (let i = 0; i < ln.length; i += 3, k++) w2 = Math.max(w2, Math.abs(Math.hypot(ln[i] - C[0], ln[i + 1] - C[1]) - P.ringRadius), Math.abs(ln[i + 2] - C[2]));
      }
      if (!(k >= 8)) fail('doubleLine', `${label}: the double line has ${k} points`);
      if (!(w2 < 1e-6 * size)) fail('doubleLine', `${label}: the double line is ${w2} off the circle`);
      const flat = fold.doubleLine(0);
      if (flat.length !== lines.length || flat.some((ln) => { for (let i = 2; i < ln.length; i += 3) if (ln[i] !== 0) return true; return false; })) fail('doubleLine', `${label}: doubleLine(0) is not in the plane`);
    }
  }

  // ---- proportions
  if (type === 'torus' && !(P.ringRadius / P.tubeRadius > 2.2 && P.ringRadius / P.tubeRadius < 3.2)) fail('proportions', `${label}: ring / tube = ${P.ringRadius / P.tubeRadius}`);
  if (type === 'mobius' && !(P.ringRadius / P.halfWidth >= 1.3 && P.ringRadius / P.halfWidth < 2.6)) fail('proportions', `${label}: ring / half-width = ${P.ringRadius / P.halfWidth}`);
  if (type === 'klein' && !(P.ringRadius / P.reach > 1.7 && P.ringRadius / P.reach < 2.8)) fail('proportions', `${label}: ring / reach = ${P.ringRadius / P.reach}`);
  // (*x's band is made from a 2 : 1 strip since 13 Nov 2026, the owner's "more balanced" *x: it needs 1.53, TUNE.mobius)
  if (P.stretch !== undefined && !(P.stretch >= 1 && P.stretch <= (type === 'mobius' ? 1.6 : 1.2))) fail('proportions', `${label}: stretch ${P.stretch}`);
}

// ---------------------------------------------------------------------------------------------------------------
// the sweep
// ---------------------------------------------------------------------------------------------------------------

const t0 = performance.now();
for (const id of IDS) {
  const group = BY_ID[id];
  const rnd = prng(4099 + IDS.indexOf(id) + 104729 * SALT);
  for (const amp of AMPS) {
    const warp = makeWarp(group, amp);
    for (const c of cases(group)) {
      const domain = buildDomain(group, { seed: c.seed, metric: c.metric, warp });
      const mesh = c.preset ? buildMesh(group, domain, { density: rollDensity(group) }) : buildMesh(group, domain);
      checkFold(group, domain, mesh, `${c.label}, amp ${amp}`, amp, c.preset, rnd);
    }
  }
}
const sweepMs = performance.now() - t0;

test('roll: the fold interface — mesh, stops with 0 and 1 (and the inner stop), duration, at(t) -> fn(x, y, cell, out)', () => assert.equal(failures.api.length, 0, show('api')));
test('roll 1: at(0) is the identity, exactly (vertices and boundary samples; also for t < 0 and NaN)', () => assert.equal(failures.identity.length, 0, show('identity')));
test('roll 2: seams close at t = 1 — glued boundary points coincide (to 1e-10 tile sizes; SPEC asks 1e-6)', () => assert.equal(failures.seams.length, 0, show('seams')));
test('roll 2b: the seams are open before the end (t = 0.5, t = 0.97)', () => assert.equal(failures.seamsOpen.length, 0, show('seamsOpen')));
test('roll 2c: torus and klein — the first seam (tube / figure 8) closes at the inner stop and stays closed', () => assert.equal(failures.stageSeam.length, 0, show('stageSeam')));
test('roll 3: continuity — over 200 steps no vertex moves more than 0.08 tile sizes in a step', () => assert.equal(failures.continuity.length, 0, show('continuity')));
test('roll 3b: the steps are of the same order throughout: largest < 4 x mean; the motion never rests, it only slows where the ring takes over', () => assert.equal(failures.order.length, 0, show('order')));
test('roll 3c: no isolated spike among the 200 steps', () => assert.equal(failures.spike.length, 0, show('spike')));
test('roll 3d: presets — with 2000 steps every step is ten times smaller (no hidden jump)', () => assert.equal(failures.refine.length, 0, show('refine')));
test('roll 3e: no jump of position or velocity at the stage boundaries (steps of 1e-3 and 1e-5)', () => assert.equal(failures.boundaries.length, 0, show('boundaries')));
test('roll 3f: t -> 0 tends to the identity and t -> 1 to the closed shape, linearly (no special-cased jump)', () => assert.equal(failures.limit.length, 0, show('limit')));
test('roll 4: no NaN / Infinity for any t, including the exact stage boundaries, tiny t and beyond the ends', () => assert.equal(failures.finite.length, 0, show('finite')));
test('roll: at(1) is invariant under every group element that keeps the strip, at random points — and under nothing else', () => assert.equal(failures.invariance.length, 0, show('invariance')));
test('roll: the folded tile lies exactly on its shape — torus, cylinder, Moebius rulings, the tube around the double circle', () => assert.equal(failures.shape.length, 0, show('shape')));
test('roll: the fold goes toward +z (on or above the plane at t = 1, never far below on the way)', () => assert.equal(failures.upward.length, 0, show('upward')));
test('roll: the folded shape stays where the tile was (centred on the seed)', () => assert.equal(failures.near.length, 0, show('near')));
test('roll: presets — the sheet never touches itself on the way', () => assert.equal(failures.embedded.length, 0, show('embedded')));
test('roll: isometric where it should be — the cylinder throughout, the first stage of torus and klein', () => assert.equal(failures.isometry.length, 0, show('isometry')));
test('roll: klein — doubleLine(1) lies on the double circle, doubleLine(0) in the plane', () => assert.equal(failures.doubleLine.length, 0, show('doubleLine')));
test('roll: proportions — ring / tube, ring / half-width, ring / reach and the stretch stay in their ranges', () => assert.equal(failures.proportions.length, 0, show('proportions')));
test('roll: a mesh built with rollDensity is used as it is', () => assert.equal(failures.mesh.length, 0, show('mesh')));

test('roll: the sweep really ran', () => {
  const expected = IDS.reduce((s, id) => s + (BY_ID[id].presets.length + SEEDS) * AMPS.length, 0);
  assert.equal(stats.folds, expected);
  assert.ok(stats.invChecks > 10000, `${stats.invChecks} invariance checks`);
  assert.ok(stats.maxTri <= 20000, `largest mesh ${stats.maxTri} triangles (the renderer sorts up to 20k)`);
  console.log(`  roll sweep: ${stats.folds} folds in ${(sweepMs / 1000).toFixed(1)} s; seam gap <= ${stats.maxSeam.toExponential(1)}, invariance <= ${stats.maxInv.toExponential(1)} (${stats.invChecks} checks, ${stats.elements} elements), ` +
    `off shape <= ${stats.maxShape.toExponential(1)} tile sizes; step <= ${stats.maxStep.toFixed(4)} tile sizes, max/mean <= ${stats.maxRatio.toFixed(2)}, min/mean >= ${stats.minStep.toFixed(3)}; clearance >= ${stats.minClear.toFixed(4)}; lowest z ${stats.minZ.toFixed(4)}; largest mesh ${stats.maxTri} triangles`);
});

// ---------------------------------------------------------------------------------------------------------------
// building blocks
// ---------------------------------------------------------------------------------------------------------------

test('sinc, cosc: smooth through 0 (series and closed form agree where they meet)', () => {
  for (const a of [0, 1e-300, 1e-9, 9.9e-5, 1e-4, 1.01e-4, 1e-3, 0.5, 3, -2]) {
    const s = a === 0 ? 1 : Math.sin(a) / a, c = Math.abs(a) < 1e-3 ? a / 2 - a ** 3 / 24 + a ** 5 / 720 : (2 * Math.sin(a / 2) ** 2) / a;      // no cancellation
    assert.ok(Math.abs(sinc(a) - s) < 1e-15, `sinc(${a})`);
    assert.ok(Math.abs(cosc(a) - c) <= 4e-16 * Math.abs(c), `cosc(${a}) = ${cosc(a)} vs ${c}`);
    assert.equal(sinc(-a), sinc(a)); assert.equal(cosc(-a), -cosc(a));
  }
  for (const a of [1e-5, 1e-4 - 1e-12, 1e-4 + 1e-12, 2e-4]) assert.ok(Math.abs(cosc(a) - (a / 2 - a ** 3 / 24)) < 1e-18);
  assert.equal(sinc(0), 1); assert.equal(cosc(0), 0);
});

test('easeIn / easeOut: 0 -> 1, monotone, C1, constant speed outside the ramp', () => {
  for (const f of [0.1, 0.3, 0.6]) {
    assert.equal(easeIn(0, f), 0); assert.equal(easeIn(1, f), 1); assert.equal(easeOut(0, f), 0); assert.equal(easeOut(1, f), 1);
    assert.equal(easeIn(-1, f), 0); assert.equal(easeIn(2, f), 1);
    let prev = 0, prevV = 0;
    const N = 4000, v = 1 / (1 - f / 2);
    for (let i = 1; i <= N; i++) {
      const x = i / N, y = easeIn(x, f), vel = (y - prev) * N;
      assert.ok(y >= prev, 'monotone');
      assert.ok(Math.abs(vel - prevV) < 6 / (f * N) + 1e-9 || i === 1, `velocity continuous at ${x} (f = ${f})`);
      if (x > f + 1 / N) assert.ok(Math.abs(vel - v) < 1e-9, 'constant speed after the ramp');
      assert.ok(Math.abs(easeOut(1 - x, f) - (1 - y)) < 1e-15);
      prev = y; prevV = vel;
    }
    assert.ok(easeIn(1e-3, f) < 1e-6, 'starts from rest');
  }
});

test('rollSchedule: stage 1 is done at the inner stop, stage 2 starts before it and has only just begun there', () => {
  for (const type of ['torus', 'klein']) {
    const S = STAGE[type];
    assert.ok(S.t2 > 0.2 && S.t2 < S.t1 && S.t1 < 0.6, type);
    assert.deepEqual(rollSchedule(type, 0), { a: 0, w: 0 });
    assert.deepEqual(rollSchedule(type, 1), { a: 1, w: 1 });
    assert.equal(rollSchedule(type, S.t1).a, 1);
    assert.equal(rollSchedule(type, S.t2).w, 0);
    assert.ok(rollSchedule(type, S.t2).a < 1 && rollSchedule(type, S.t2).a > 0.9, 'the first stage is nearly done when the ring starts');
    const w1 = rollSchedule(type, S.t1).w;
    assert.ok(w1 > 0 && w1 < 0.02, `${type}: at the inner stop the ring has turned ${(360 * w1).toFixed(1)} degrees`);
    let pa = 0, pw = 0;
    for (let i = 1; i <= 1000; i++) {
      const s = rollSchedule(type, i / 1000);
      assert.ok(s.a >= pa && s.w >= pw && s.a <= 1 && s.w <= 1, 'monotone');
      assert.ok(s.a - pa + s.w - pw > 2e-4, `${type}: the schedule never rests (t = ${i / 1000})`);
      pa = s.a; pw = s.w;
    }
  }
  assert.deepEqual(rollSchedule('cylinder', 0.3), { a: 0.3, w: 0.3 });
  assert.deepEqual(rollSchedule('mobius', 2), { a: 1, w: 1 });
});

test('figure8: J0(j01) = 0; the wave is isometric for every z, odd and periodic; at j01 it closes into an 8', () => {
  const wave = (F, tau) => {
    let x = 0, y = 0;
    for (let k = 1; k <= F.n; k++) { if (k & 1) y += F.c[k] * Math.sin(k * tau); else x += F.c[k] * Math.sin(k * tau); }
    return [x, y];
  };
  // b = 2 pi: s = tau. position(s) = (s J0, 0) + wave(s); its derivative is the unit vector at angle z cos(s)
  for (const z of [0, 0.3, 1, 2, J01]) {
    const F = figure8(z), h = 1e-5;
    for (const s of [0, 0.4, 1.3, 2.9, 4.4, 6.1]) {
      const a = wave(F, s - h), b = wave(F, s + h);
      const dx = (b[0] - a[0]) / (2 * h) + F.j0, dy = (b[1] - a[1]) / (2 * h);
      assert.ok(Math.abs(dx - Math.cos(z * Math.cos(s))) < 1e-9 && Math.abs(dy - Math.sin(z * Math.cos(s))) < 1e-9, `tangent at s = ${s}, z = ${z}`);
      const m = wave(F, -s), p = wave(F, s), per = wave(F, s + TAU);
      assert.ok(Math.abs(m[0] + p[0]) < 1e-15 && Math.abs(m[1] + p[1]) < 1e-15, 'odd');
      assert.ok(Math.abs(per[0] - p[0]) < 1e-13 && Math.abs(per[1] - p[1]) < 1e-13, 'periodic');
    }
  }
  assert.equal(figure8(0).j0, 1); assert.equal(figure8(0).n, 0); assert.equal(figure8(0).reach, 0);
  const F = figure8(J01);
  assert.equal(F.j0, 0);
  assert.ok(Math.abs(figure8(J01 * (1 - 1e-9)).j0) < 1e-8, 'J0 is continuous at its zero');
  // the 8: both glide-axis parameters (tau = 0 and tau = pi) are at the crossing; the lobes point along +-y
  const c0 = wave(F, 0), c1 = wave(F, Math.PI), tip = wave(F, Math.PI / 2);
  assert.ok(Math.hypot(...c0) < 1e-15 && Math.hypot(...c1) < 1e-14, 'the crossing');
  assert.ok(Math.abs(tip[0]) < 1e-15 && Math.abs(tip[1] - F.reach) < 1e-14 && Math.abs(F.reach / TAU - 0.18743546) < 1e-7, 'the tip of a lobe');
  // the two branches cross at 2 (j01 - pi/2) = 95.6 degrees; each lobe is simple (the curve is on one side of the crossing)
  for (let i = 1; i < 200; i++) assert.ok(wave(F, (Math.PI * i) / 200)[1] > 0, 'the first lobe is above the crossing');
});

// ---------------------------------------------------------------------------------------------------------------
// the mesh the fold wants, and a group that sits differently in the plane
// ---------------------------------------------------------------------------------------------------------------

test('roll: a mesh of default density is replaced by a finer one where the fold needs it; opts.density = false keeps it', () => {
  for (const id of IDS) {
    const group = BY_ID[id], want = rollDensity(group);
    assert.ok(want >= 56 && want <= 128, id);
    const domain = buildDomain(group, { seed: group.presets[0].seed, metric: group.presets[0].metric, warp: makeWarp(group, 0) });
    const coarse = buildMesh(group, domain), fine = buildMesh(group, domain, { density: want });
    const fold = createFold(group, domain, coarse, {});
    if (want > 70) {
      assert.notEqual(fold.mesh, coarse, id + ': a finer mesh');
      assert.equal(fold.mesh.tri.length, fine.tri.length, id + ': built with rollDensity');
    } else assert.equal(fold.mesh, coarse, id + ': the default mesh is fine enough');
    assert.equal(createFold(group, domain, fine, {}).mesh, fine, id);
    assert.equal(createFold(group, domain, coarse, { density: false }).mesh, coarse, id);
    assert.equal(createFold(group, domain, null, {}).mesh.tri.length, fine.tri.length, id + ': no mesh given: the fold builds one');
    assert.ok(fold.mesh.tri.length / 3 <= 14000, `${id}: ${fold.mesh.tri.length / 3} triangles`);
    // the same map whichever mesh it is given
    const a = [0, 0, 0], b = [0, 0, 0];
    createFold(group, domain, coarse, { density: false }).at(0.77)(0.3, 0.2, 0, a); fold.at(0.77)(0.3, 0.2, 0, b);
    assert.deepEqual(a, b);
  }
});

/** The group turned by `ang` about the origin (a plain copy: nothing in src/ is touched). */
function turned(group, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const R = { a: c, b: -s, c: s, d: c, tx: 0, ty: 0 }, Ri = inverse(R);
  const v = (p) => [c * p[0] - s * p[1], s * p[0] + c * p[1]];
  const g = { ...group, e1: v(group.e1), e2: v(group.e2), center: v(group.center),
    reps: group.reps.map((r) => compose(R, compose(r, Ri))),
    presets: group.presets.map((p) => {
      const out = { ...p, seed: v(p.seed) };
      if (p.metric) {            // Q' = R Q R^T
        const [q11, q12, q22] = p.metric;
        const m11 = c * (c * q11 - s * q12) - s * (c * q12 - s * q22), m12 = s * (c * q11 - s * q12) + c * (c * q12 - s * q22);
        const m22 = s * (s * q11 + c * q12) + c * (s * q12 + c * q22);
        out.metric = [m11, m12, m22];
      }
      return out;
    }) };
  g.warp = g;
  return g;
}

test('roll: nothing depends on how the group sits in the plane — turned by 37 and by 90 degrees the same shape comes out', () => {
  for (const id of IDS) {
    const group = BY_ID[id];
    for (const ang of [(37 * Math.PI) / 180, Math.PI / 2, -2.2]) {
      const G = turned(group, ang);
      for (const [pi, preset] of group.presets.entries()) {
        for (const amp of [0, 1]) {
          const d0 = buildDomain(group, { seed: preset.seed, metric: preset.metric, warp: makeWarp(group, amp) });
          const d1 = buildDomain(G, { seed: G.presets[pi].seed, metric: G.presets[pi].metric, warp: makeWarp(G, amp) });
          assert.ok(Math.abs(d1.area - group.domainArea) < 1e-9, `${id}: the turned tile`);
          const m1 = buildMesh(G, d1);
          const f0 = createFold(group, d0, buildMesh(group, d0), { density: false }), f1 = createFold(G, d1, m1, { density: false });
          const size = Math.sqrt(group.domainArea), out = [0, 0, 0], o2 = [0, 0, 0], q = [0, 0];
          // seams of the turned tile close
          const F1 = f1.at(1);
          let gap = 0, cuts = 0;
          for (const b of m1.boundary) {
            const e = d1.edges[b.edge];
            if (e.kind !== 'cut') continue;
            cuts++;
            const gi = inverse(e.g);
            for (let j = 0; j < b.pts.length; j += 2) {
              apply(gi, b.pts[j], b.pts[j + 1], q);
              F1(b.pts[j], b.pts[j + 1], 0, out); F1(q[0], q[1], 0, o2);
              gap = Math.max(gap, Math.hypot(out[0] - o2[0], out[1] - o2[1], out[2] - o2[2]));
            }
          }
          assert.ok(cuts >= 2 && gap < 1e-10 * size, `${id} turned by ${ang.toFixed(2)}, preset ${pi}, amp ${amp}: seam gap ${gap}`);
          // the same numbers
          for (const k of ['ringRadius', 'tubeRadius', 'radius', 'halfWidth', 'reach', 'stretch']) {
            if (f0.params[k] !== undefined) assert.ok(Math.abs(f0.params[k] - f1.params[k]) < 1e-12, `${id}: ${k}`);
          }
          // heights are the same at corresponding points at every t when the warp is off (the warp field of the turned
          // group is another field, so with amp > 0 only the shape can be compared)
          if (amp === 0) {
            const c = Math.cos(ang), s = Math.sin(ang);
            // the turned group may sit mirrored with respect to the line-direction convention of the fold: then the
            // fold is the mirror image, and heights still agree. Compare z and the distance from the seed's image.
            for (const t of [0.2, 0.45, 0.8, 1]) {
              const A = f0.at(t), B = f1.at(t);
              const sA = [0, 0, 0], sB = [0, 0, 0];
              A(d0.seedActual[0], d0.seedActual[1], 0, sA); B(d1.seedActual[0], d1.seedActual[1], 0, sB);
              let worst = 0;
              for (let v = 0; v < f0.mesh.n; v += 7) {
                const x = f0.mesh.xy[2 * v], y = f0.mesh.xy[2 * v + 1];
                A(x, y, 0, out); B(c * x - s * y, s * x + c * y, 0, o2);
                worst = Math.max(worst, Math.abs(Math.hypot(out[0] - sA[0], out[1] - sA[1], out[2] - sA[2]) - Math.hypot(o2[0] - sB[0], o2[1] - sB[1], o2[2] - sB[2])));
              }
              if (id === 'o' || id === '**') assert.ok(worst < 1e-9 * size, `${id} turned by ${ang.toFixed(2)}: preset ${pi}, t = ${t}: distances from the seed differ by ${worst}`);
            }
          }
          assert.ok(f1.at(0)(0.123, 0.456, 0, out) === out && out[0] === 0.123 && out[1] === 0.456 && Object.is(out[2], 0));
        }
      }
    }
  }
});

test('roll: createFold dispatches on group.fold and refuses the other fold types', () => {
  assert.throws(() => createFold(BY_ID['333'], null, null, {}), /unknown fold type/);
  for (const id of IDS) {
    const group = BY_ID[id];
    const domain = buildDomain(group, { seed: group.presets[0].seed, metric: group.presets[0].metric, warp: makeWarp(group, 0) });
    const fold = createFold(group, domain, buildMesh(group, domain), {});
    assert.equal(fold.type, group.fold);
    assert.equal(typeof fold.schedule(0.5).a, 'number');
    assert.ok(det(group.reps[0]) > 0);
  }
});
