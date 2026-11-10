// domain.js — the tile of a wallpaper group: Dirichlet domain of a seed, its edge gluings, and the "wavy cut" warp.
// SPEC 5.1.  Plain ES module; depends only on geom.js and groups.js.
//
//   makeWarp(group, amp)                      -> { amp, fwd(x, y, out), inv(x, y, out), ... }
//   clampSeed(group, x, y)                    -> [x, y]
//   buildDomain(group, { seed, metric, warp }) -> Domain
//
// Conventions worth knowing downstream:
//   * Edge half-planes are NORMALISED: (nx, ny) is a Euclidean unit vector, so nx*x + ny*y - c is the signed
//     distance (straight coordinates) from the edge line, negative inside the tile.
//   * inverse(g_i) maps edge i onto its partner j. For an orientation-PRESERVING g (translation, rotation) the
//     direction of travel along the boundary is reversed (start -> end of j); for an orientation-REVERSING g
//     (glide; and trivially a mirror) it is kept (start -> start). `edges[i].rev` says which.

import { inverse, det, isoEquals, polyArea } from './geom.js';
import { elementsNear, symmetryElements, latticeCoords } from './groups.js';

const TAU = 2 * Math.PI;

// ---------------------------------------------------------------------------------------------------------------
// Warp
// ---------------------------------------------------------------------------------------------------------------

/** Peak displacement at amp = 1, as a fraction of sqrt(domainArea). */
export const WARP_PEAK = 0.085;
/** Target wavelength of the waves, in units of sqrt(domainArea). */
const WARP_WAVELENGTH = 0.75;
/** The scale is reduced, if necessary, until the sampled Jacobian determinant at amp = 1 is at least this. */
const WARP_JAC_FLOOR = 0.45;
/** Generic phases of the base modes (radians). */
const PHASES = [0.7, 2.1, 3.9, 5.3, 1.3, 4.6];

const fieldCache = new WeakMap();

/** The symmetrised field of a group: v(x) = sum_f A_f cos(theta_f) + B_f sin(theta_f), theta_f = 2 pi (m_f s + n_f t). */
function fieldOf(group) {
  let F = fieldCache.get(group);
  if (!F) { F = buildField(group); fieldCache.set(group, F); }
  return F;
}

function buildField(group) {
  const { e1, e2, reps } = group;
  const dd = e1[0] * e2[1] - e1[1] * e2[0];
  // reciprocal basis: b_i . e_j = delta_ij ; lattice coordinates s = x . b1, t = x . b2
  const b1 = [e2[1] / dd, -e2[0] / dd], b2 = [-e1[1] / dd, e1[0] / dd];
  const size = Math.sqrt(group.domainArea);
  const K = 1 / (WARP_WAVELENGTH * size);
  const J = reps.length <= 2 ? 4 : reps.length <= 4 ? 3 : 2;
  const range = Math.ceil(1.6 * K * Math.max(Math.hypot(e1[0], e1[1]), Math.hypot(e2[0], e2[1]))) + 2;

  // integer frequency (m, n) <-> wave vector kappa = m b1 + n b2 ; image of (m, n) under the linear part of a rep
  const kap = (m, n) => [m * b1[0] + n * b2[0], m * b1[1] + n * b2[1]];
  const image = (r, m, n) => {
    const k = kap(m, n);
    const kx = r.a * k[0] + r.b * k[1], ky = r.c * k[0] + r.d * k[1];
    return [Math.round(kx * e1[0] + ky * e1[1]), Math.round(kx * e2[0] + ky * e2[1])];
  };
  const canon = (m, n) => (m < 0 || (m === 0 && n < 0)) ? [-m, -n, -1] : [m, n, 1];
  const keyOf = (m, n) => m + ',' + n;

  // --- choose J base modes: directions spread over the half circle, |kappa| close to K, in distinct point-group orbits
  const used = new Set();
  const base = [];
  for (let j = 0; j < J; j++) {
    const ang = 0.4 + (Math.PI * j) / J;
    const tx = K * Math.cos(ang), ty = K * Math.sin(ang);
    let best = null, bestD = Infinity;
    for (let m = -range; m <= range; m++) {
      for (let n = -range; n <= range; n++) {
        if (m === 0 && n === 0) continue;
        const c = canon(m, n);
        if (used.has(keyOf(c[0], c[1]))) continue;
        const k = kap(m, n);
        // compare against +target and -target (a mode and its negative are the same wave)
        const d = Math.min(Math.hypot(k[0] - tx, k[1] - ty), Math.hypot(k[0] + tx, k[1] + ty));
        if (d < bestD - 1e-12) { bestD = d; best = [m, n]; }
      }
    }
    for (const r of reps) {
      const im = image(r, best[0], best[1]);
      const c = canon(im[0], im[1]);
      used.add(keyOf(c[0], c[1]));
    }
    base.push(best);
  }

  // --- symmetrise each base mode:  v = (1/|reps|) sum_k L_k w0(g_k^-1 x),  w0 = c sin(2 pi kappa.x + phi), c transverse
  const symmetrise = (m, n, phi) => {
    const k = kap(m, n), kl = Math.hypot(k[0], k[1]);
    const amp = 1 / kl;                                   // equal slope contribution from every base mode
    const cx = (-k[1] / kl) * amp, cy = (k[0] / kl) * amp;
    const acc = new Map();
    for (const r of reps) {
      const kx = r.a * k[0] + r.b * k[1], ky = r.c * k[0] + r.d * k[1];     // L kappa
      const im = [Math.round(kx * e1[0] + ky * e1[1]), Math.round(kx * e2[0] + ky * e2[1])];
      let ph = phi - TAU * (kx * r.tx + ky * r.ty);
      let vx = r.a * cx + r.b * cy, vy = r.c * cx + r.d * cy;               // L c
      const c = canon(im[0], im[1]);
      if (c[2] < 0) { vx = -vx; vy = -vy; ph = -ph; }                        // sin(-th + ph) = -sin(th - ph)
      const key = keyOf(c[0], c[1]);
      let e = acc.get(key);
      if (!e) { e = { m: c[0], n: c[1], ax: 0, ay: 0, bx: 0, by: 0 }; acc.set(key, e); }
      const cp = Math.cos(ph), sp = Math.sin(ph);
      e.ax += vx * sp; e.ay += vy * sp; e.bx += vx * cp; e.by += vy * cp;    // sin(th + ph) = sin th cos ph + cos th sin ph
    }
    let power = 0;
    for (const e of acc.values()) {
      e.ax /= reps.length; e.ay /= reps.length; e.bx /= reps.length; e.by /= reps.length;
      power += e.ax * e.ax + e.ay * e.ay + e.bx * e.bx + e.by * e.by;
    }
    return { modes: [...acc.values()], rms: Math.sqrt(power / 2), amp };
  };

  // The waves: for a group with cut edges, chosen so that every cut edge of every preset bends (chosenWaves, below);
  // for the kaleidoscopes (no cut edge), or if that finds nothing, the generic choice: J base modes with fixed phases.
  const choice = chosenWaves(group, { b1, b2, K, J, symmetrise, keyOf, size });
  let modes = choice ? choice.waves : null;
  if (!modes) {
    const merged = new Map();
    base.forEach((mn, j) => {
      // a phase can be nearly cancelled by the symmetrisation: take the better of phi and phi + pi/2, then renormalise
      const s1 = symmetrise(mn[0], mn[1], PHASES[j % PHASES.length]);
      const s2 = symmetrise(mn[0], mn[1], PHASES[j % PHASES.length] + Math.PI / 2);
      // (For many modes the two come out EQUAL — every mode of o, the mirror pairs of **, xx, *x, 333, 3*3, *333 — and
      // their computed values differ in the last bit or not at all, one way in one JavaScript engine and the other way
      // in the next. A bare comparison then gave the same group one wavy cut in node and another in the browser. A tie
      // goes to the first phase.)
      const s = s2.rms > s1.rms * (1 + 1e-9) ? s2 : s1;
      const gain = s.rms > 1e-12 ? (s.amp / Math.SQRT2) / s.rms : 0;
      for (const e of s.modes) {
        const key = keyOf(e.m, e.n);
        let t = merged.get(key);
        if (!t) { t = { m: e.m, n: e.n, ax: 0, ay: 0, bx: 0, by: 0 }; merged.set(key, t); }
        t.ax += e.ax * gain; t.ay += e.ay * gain; t.bx += e.bx * gain; t.by += e.by * gain;
      }
    });
    modes = [...merged.values()].filter((e) => Math.abs(e.ax) + Math.abs(e.ay) + Math.abs(e.bx) + Math.abs(e.by) > 1e-12);
  }

  const nf = modes.length;
  const F = {
    b1, b2, nf, size,
    M: modes.reduce((s, e) => Math.max(s, e.m), 1), N: modes.reduce((s, e) => Math.max(s, Math.abs(e.n)), 1),
    mm: Int32Array.from(modes, (e) => e.m), nn: Int32Array.from(modes, (e) => Math.abs(e.n)),
    sg: Float64Array.from(modes, (e) => (e.n < 0 ? -1 : 1)),
    ax: Float64Array.from(modes, (e) => e.ax), ay: Float64Array.from(modes, (e) => e.ay),
    bx: Float64Array.from(modes, (e) => e.bx), by: Float64Array.from(modes, (e) => e.by),
    kx: Float64Array.from(modes, (e) => TAU * (e.m * b1[0] + e.n * b2[0])),
    ky: Float64Array.from(modes, (e) => TAU * (e.m * b1[1] + e.n * b2[1])),
    base, A: 1, peakRaw: 0, jacMin: 1,
    // how the waves were chosen (diagnostics: warp.waves): null for the generic choice
    choice: choice ? { band: choice.band, rel: choice.rel, bands: choice.bands, waves: nf } : null,
  };
  F.cs = new Float64Array(F.M + 1); F.ss = new Float64Array(F.M + 1);
  F.ct = new Float64Array(F.N + 1); F.st = new Float64Array(F.N + 1);

  // --- scale: peak displacement WARP_PEAK * size at amp = 1, reduced if the Jacobian determinant would get too small
  const G = 16 * Math.max(F.M, F.N) + 8;
  const o = new Float64Array(6);
  let peak = 0;
  const samples = [], bendSamples = [];
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      const s = (i + 0.37) / G, t = (j + 0.61) / G;
      const x = s * e1[0] + t * e2[0], y = s * e1[1] + t * e2[1];
      evalField(F, x, y, o);
      peak = Math.max(peak, Math.hypot(o[0], o[1]));
      samples.push(o[2] + o[5], o[2] * o[5] - o[3] * o[4]);   // trace and determinant of Dv
      // every second sample each way (8 per shortest wave): Dv and the size of D²v, for the bound `bend` of makeWarp
      if (!(i & 1) && !(j & 1)) bendSamples.push(o[2], o[3], o[4], o[5], evalBend(F, x, y));
    }
  }
  F.bendSamples = Float64Array.from(bendSamples);
  F.peakRaw = peak;
  let A = peak > 0 ? (WARP_PEAK * size) / peak : 0;
  const minDet = (a) => {
    let mn = Infinity;
    for (let i = 0; i < samples.length; i += 2) mn = Math.min(mn, 1 + a * samples[i] + a * a * samples[i + 1]);
    return mn;
  };
  for (let it = 0; it < 60 && minDet(A) < WARP_JAC_FLOOR; it++) A *= 0.97;
  F.A = A;
  F.jacMin = minDet(A);
  F.peak = A * peak;
  return F;
}

// ---------------------------------------------------------------------------------------------------------------
// The waves of a group with cut edges (round 3, finding #1: "Wavy at 1 leaves many cut edges straight")
// ---------------------------------------------------------------------------------------------------------------
//
// A transverse wave c sin(kappa . x) bends a straight segment only through the part of kappa ALONG the segment (it
// pushes points across the segment there); a wave travelling across it slides points along it and leaves it straight.
// So with a few waves of fixed phases some cut edges came out nearly straight, and nothing can bend an edge that lies
// on a line the field happens to be symmetric in: with only even m among the frequencies of 22x the field had the
// extra translation e1/2, which turns the glides into mirrors of the field, and the default tile's glide edges lie on
// them. Here the waves are chosen for the cut edges the person sees: every preset's, and a few fixed probe tiles' (so
// that a dragged cut stays wavy too). The first-order bow of a segment, the largest distance of psi(segment) from its
// chord, is A * max_s |n . v(s) - (the straight line through its two ends)|: linear in the weights of the waves, so it
// is one matrix per group. A seeded random search over choices of J wave orbits, their phases and weights looks for
// the largest smallest bow (each edge against its target, per unit rms); the best few are refined and re-ranked by
// their true peak, which sets the scale A. Short waves make long edges crinkly, so the orbits come from the band
// |kappa| in [0.75, hi] K with hi = 1.3, then 1.6, then 1.9, until a band is enough; and the lowest band within
// WAVE_NEAR of the best is taken. (The strip of *x is 0.43 tile sizes wide: a wave that bends the edges across it is
// one wavelength across the strip, 1.73 K.) The frequencies must span the reciprocal lattice: no extra translation.
// Deterministic: integer-ordered candidates, a seeded generator, scores compared with a margin of 1e-9 (relative), so
// node and browsers pick the same waves. Cost: 3-15 ms per group, once (the field is cached), before the scaling.

/** Tries of the random search per band; the best WAVE_KEEP are refined and re-ranked by their peak. */
const WAVE_TRIES = 800, WAVE_KEEP = 4;
/** The bands of |kappa| the waves come from, in units of K: from WAVE_LO to each of WAVE_BANDS in turn. */
const WAVE_LO = 0.75, WAVE_BANDS = [1.3, 1.6, 1.9], WAVE_HI = WAVE_BANDS[WAVE_BANDS.length - 1];
/** A band is enough when its field bends every edge by this fraction of its target (target 1 = the peak displacement). */
const WAVE_ENOUGH = 0.6;
/** Of the bands tried, the lowest whose field reaches this fraction of the best one's is taken. */
const WAVE_NEAR = 0.85;
/** Target of a cut edge: the peak displacement for an edge at least WAVE_EDGE_REF tile sizes long, (L / ref)^2 of it below. */
const WAVE_EDGE_REF = 0.4;
/** Probe tiles: fixed seeds in the plane's window; their cut edges (at least 0.25 tile sizes) count at this weight. */
const WAVE_PROBES = 6, WAVE_PROBE_WEIGHT = 0.5;
/** Interior samples per edge. */
const WAVE_SAMPLES = 16;
/**
 * The chosen field keeps det D psi >= WAVE_JAC at amp 1 (on the coarse grid of the search): a gentle warp (no area
 * shrinks by more than a quarter), whose waves read as waves rather than crinkles, and for which warp.bend, the bound
 * mesh.js works with, stays within a few times the true second derivative (test/domain.test.js holds it to 4).
 */
const WAVE_JAC = 0.75;

/** A small seeded generator (mulberry32): the same numbers in every engine. */
function seeded(a) {
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gcdInt = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

/** The cut edges the waves are chosen for: [{ax, ay, dx, dy, t, probe}] (straight coordinates; t = the target). */
function fieldEdges(group, size) {
  const out = [];
  const add = (seed, metric, weight, minLen) => {
    let d;
    try { d = buildDomain(group, { seed, metric }); } catch (err) { return; }
    const n = d.poly.length;
    d.edges.forEach((e, i) => {
      if (e.kind !== 'cut' || e.partner < i || e.len < minLen * size) return;      // one edge of each glued pair
      const a = d.poly[i], b = d.poly[(i + 1) % n];
      out.push({ ax: a[0], ay: a[1], dx: b[0] - a[0], dy: b[1] - a[1], t: weight * Math.min(1, (e.len / (WAVE_EDGE_REF * size)) ** 2), probe: weight < 1 });
    });
  };
  for (const p of group.presets) add(p.seed, p.metric, 1, 0.1);
  if (out.length) {
    const rnd = seeded(0x51ed5eed);
    for (let q = 0; q < WAVE_PROBES; q++) {
      const seed = [group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf];
      add(seed, group.presets[q % group.presets.length].metric, WAVE_PROBE_WEIGHT, 0.25);
    }
  }
  return out;
}

/**
 * cos and sin of m s + n t for 0 <= m <= M, |n| <= N from four calls of the trigonometric functions (the recurrences
 * of evalField): tb.at(s, t), then tb.cos(m, n), tb.sin(m, n).
 */
function trigTables(M, N) {
  const cs = new Float64Array(M + 1), ss = new Float64Array(M + 1), ct = new Float64Array(N + 1), st = new Float64Array(N + 1);
  return {
    at(s, t) {
      const c1 = Math.cos(s), s1 = Math.sin(s), c2 = Math.cos(t), s2 = Math.sin(t);
      cs[0] = 1; ss[0] = 0; ct[0] = 1; st[0] = 0;
      for (let k = 1; k <= M; k++) { cs[k] = cs[k - 1] * c1 - ss[k - 1] * s1; ss[k] = ss[k - 1] * c1 + cs[k - 1] * s1; }
      for (let k = 1; k <= N; k++) { ct[k] = ct[k - 1] * c2 - st[k - 1] * s2; st[k] = st[k - 1] * c2 + ct[k - 1] * s2; }
    },
    cos(m, n) { return n >= 0 ? cs[m] * ct[n] - ss[m] * st[n] : cs[m] * ct[-n] + ss[m] * st[-n]; },
    sin(m, n) { return n >= 0 ? ss[m] * ct[n] + cs[m] * st[n] : ss[m] * ct[-n] - cs[m] * st[-n]; },
  };
}

/**
 * The waves chosen for the cut edges of the group: { waves: [{m, n, ax, ay, bx, by}] (v = sum a cos theta + b sin theta),
 * band, rel, bands: [[hi, rel], ...] } (rel: the smallest first-order bow / target over the edges, in units of the
 * peak), or null when the group has no cut edge (the kaleidoscopes) or no candidate passed.
 */
function chosenWaves(group, { b1, b2, K, J, symmetrise, keyOf, size }) {
  const edges = fieldEdges(group, size);
  if (!edges.length) return null;
  const { e1, e2 } = group;

  // ---- the pool: one (m, n) per orbit of the point group (and of -1), |kappa| in [WAVE_LO, WAVE_HI] K, integer order
  const R = Math.ceil(WAVE_HI * K * Math.max(Math.hypot(e1[0], e1[1]), Math.hypot(e2[0], e2[1]))) + 2;
  const pool = [], seen = new Set();
  for (let m = 0; m <= R; m++) {
    for (let n = -R; n <= R; n++) {
      if (m === 0 && n <= 0) continue;
      const kl = Math.hypot(m * b1[0] + n * b2[0], m * b1[1] + n * b2[1]);
      if (kl < WAVE_LO * K || kl > WAVE_HI * K || seen.has(keyOf(m, n))) continue;
      // the orbit's frequencies, with the coefficients of its two bases (phase 0 and pi/2)
      const fr = new Map();
      for (const e of symmetrise(m, n, 0).modes) fr.set(keyOf(e.m, e.n), { m: e.m, n: e.n, a: [e.ax, e.ay, e.bx, e.by], b: [0, 0, 0, 0] });
      for (const e of symmetrise(m, n, Math.PI / 2).modes) {
        const k = keyOf(e.m, e.n);
        if (!fr.has(k)) fr.set(k, { m: e.m, n: e.n, a: [0, 0, 0, 0], b: [0, 0, 0, 0] });
        fr.get(k).b = [e.ax, e.ay, e.bx, e.by];
      }
      for (const k of fr.keys()) seen.add(k);
      seen.add(keyOf(m, n));
      const F = [...fr.values()];
      let g00 = 0, g01 = 0, g11 = 0;              // mean squares of the two bases and of their product
      for (const f of F) for (let i = 0; i < 4; i++) { g00 += f.a[i] * f.a[i] / 2; g01 += f.a[i] * f.b[i] / 2; g11 += f.b[i] * f.b[i] / 2; }
      pool.push({ m, n, kl, F, G: [g00, g01, g11] });
    }
  }
  const P = pool.length;
  if (P < J) return null;

  // ---- D[(e * NI + k) * 2P + 2j + basis]: the detrended normal component of orbit j along edge e at sample k
  const NI = WAVE_SAMPLES, KS = NI + 1, E = edges.length;
  let Mp = 1, Np = 1;
  for (const p of pool) for (const f of p.F) { Mp = Math.max(Mp, f.m); Np = Math.max(Np, Math.abs(f.n)); }
  const tb = trigTables(Mp, Np);
  const D = new Float64Array(E * NI * 2 * P), f0 = new Float64Array(2 * P * (KS + 1));
  for (let e = 0; e < E; e++) {
    const ed = edges[e], l = Math.hypot(ed.dx, ed.dy), nx = -ed.dy / l, ny = ed.dx / l;
    for (let k = 0; k <= KS; k++) {
      const x = ed.ax + (k / KS) * ed.dx, y = ed.ay + (k / KS) * ed.dy;
      tb.at(TAU * (x * b1[0] + y * b1[1]), TAU * (x * b2[0] + y * b2[1]));
      for (let j = 0; j < P; j++) {
        let u0 = 0, u1 = 0;
        for (const f of pool[j].F) {
          const c = tb.cos(f.m, f.n), si = tb.sin(f.m, f.n);
          u0 += nx * (f.a[0] * c + f.a[2] * si) + ny * (f.a[1] * c + f.a[3] * si);
          u1 += nx * (f.b[0] * c + f.b[2] * si) + ny * (f.b[1] * c + f.b[3] * si);
        }
        f0[(2 * j) * (KS + 1) + k] = u0; f0[(2 * j + 1) * (KS + 1) + k] = u1;
      }
    }
    for (let i = 0; i < 2 * P; i++) {
      const o = i * (KS + 1), first = f0[o], last = f0[o + KS];
      for (let k = 1; k < KS; k++) D[(e * NI + k - 1) * 2 * P + i] = f0[o + k] - first - (k / KS) * (last - first);
    }
  }

  // ---- a candidate: J orbits act[], phases ph[], relative weights rr[]; orbit act[i] gets rms rr[i] / |kappa| / sqrt 2
  const w = new Float64Array(2 * J);
  const weigh = (act, ph, rr) => {
    for (let i = 0; i < act.length; i++) {
      const p = pool[act[i]], c = Math.cos(ph[i]), s = Math.sin(ph[i]);
      const rms = Math.sqrt(Math.max(0, c * c * p.G[0] + 2 * c * s * p.G[1] + s * s * p.G[2]));
      if (!(rms > 1e-9 / p.kl)) return false;                     // this phase is (nearly) cancelled by the symmetry
      const g = (rr[i] / p.kl / Math.SQRT2) / rms;
      w[2 * i] = g * c; w[2 * i + 1] = g * s;
    }
    return true;
  };
  const rmsOf = (act) => {
    let q = 0;
    for (let i = 0; i < act.length; i++) {
      const G = pool[act[i]].G, a = w[2 * i], b = w[2 * i + 1];
      q += a * a * G[0] + 2 * a * b * G[1] + b * b * G[2];
    }
    return Math.sqrt(q);
  };
  /** min over the edges of (first-order bow / target), per unit rms, for the weights in w; -1 once it cannot exceed `bar` */
  const score = (act, bar) => {
    const rms = rmsOf(act), stop = bar * rms;
    let mn = Infinity;
    for (let e = 0; e < E; e++) {
      const te = edges[e].t, cap = mn * te;           // past cap this edge cannot lower the minimum
      let mx = 0;
      for (let k = 0; k < NI; k++) {
        const o = (e * NI + k) * 2 * P;
        let s = 0;
        for (let i = 0; i < act.length; i++) s += D[o + 2 * act[i]] * w[2 * i] + D[o + 2 * act[i] + 1] * w[2 * i + 1];
        if (s < 0) s = -s;
        if (s > mx) { mx = s; if (mx >= cap) break; }
      }
      if (mx / te < mn) { mn = mx / te; if (mn <= stop) return -1; }
    }
    return mn / rms;
  };
  /** the merged waves of the weights in w */
  const wavesOf = (act) => {
    const merged = new Map();
    for (let i = 0; i < act.length; i++) {
      const a = w[2 * i], b = w[2 * i + 1];
      for (const f of pool[act[i]].F) {
        const key = keyOf(f.m, f.n);
        let t = merged.get(key);
        if (!t) { t = { m: f.m, n: f.n, ax: 0, ay: 0, bx: 0, by: 0 }; merged.set(key, t); }
        t.ax += a * f.a[0] + b * f.b[0]; t.ay += a * f.a[1] + b * f.b[1]; t.bx += a * f.a[2] + b * f.b[2]; t.by += a * f.a[3] + b * f.b[3];
      }
    }
    const all = [...merged.values()];
    let big = 0;
    for (const e of all) big = Math.max(big, Math.abs(e.ax) + Math.abs(e.ay) + Math.abs(e.bx) + Math.abs(e.by));
    return all.filter((e) => Math.abs(e.ax) + Math.abs(e.ay) + Math.abs(e.bx) + Math.abs(e.by) > 1e-9 * big);
  };
  /** true when the frequencies span the reciprocal lattice, i.e. the field has no translation beyond the lattice's */
  const spans = (list) => {
    let g = 0;
    for (let i = 0; i < list.length && g !== 1; i++) for (let j = i + 1; j < list.length && g !== 1; j++) g = gcdInt(g, list[i].m * list[j].n - list[i].n * list[j].m);
    return g === 1;
  };
  const orbitFreqs = (act) => { const fs = []; for (const j of act) for (const f of pool[j].F) fs.push(f); return fs; };
  /** peak |v| and the smallest det D psi at the scale that makes it WARP_PEAK size, on a grid of 6 samples per wave */
  const peakOf = (waves) => {
    let M = 1, N = 1;
    for (const e of waves) { M = Math.max(M, e.m); N = Math.max(N, Math.abs(e.n)); }
    const G = 6 * Math.max(M, N) + 6, gt = trigTables(M, N);
    const kx = waves.map((e) => TAU * (e.m * b1[0] + e.n * b2[0])), ky = waves.map((e) => TAU * (e.m * b1[1] + e.n * b2[1]));
    const tr = new Float64Array(G * G), dt = new Float64Array(G * G);
    let peak = 0;
    for (let i = 0; i < G; i++) {
      for (let j = 0; j < G; j++) {
        gt.at(TAU * (i + 0.37) / G, TAU * (j + 0.61) / G);
        let vx = 0, vy = 0, xx = 0, xy = 0, yx = 0, yy = 0;
        for (let f = 0; f < waves.length; f++) {
          const e = waves[f], c = gt.cos(e.m, e.n), si = gt.sin(e.m, e.n);
          vx += e.ax * c + e.bx * si; vy += e.ay * c + e.by * si;
          const dx = e.bx * c - e.ax * si, dy = e.by * c - e.ay * si;
          xx += dx * kx[f]; xy += dx * ky[f]; yx += dy * kx[f]; yy += dy * ky[f];
        }
        const h = Math.hypot(vx, vy);
        if (h > peak) peak = h;
        tr[i * G + j] = xx + yy; dt[i * G + j] = xx * yy - xy * yx;
      }
    }
    const A = peak > 0 ? (WARP_PEAK * size) / peak : 0;
    let det = Infinity;
    for (let i = 0; i < tr.length; i++) det = Math.min(det, 1 + A * tr[i] + A * A * dt[i]);
    return { peak, det };
  };
  /** a candidate judged at its true peak: { waves, rel } or null (an extra translation, or det D psi below WAVE_JAC) */
  const judge = (c) => {
    if (!weigh(c.act, c.ph, c.rr)) return null;
    const waves = wavesOf(c.act);
    if (!spans(waves)) return null;
    const pk = peakOf(waves);
    if (!(pk.det >= WAVE_JAC)) return null;
    return { waves, rel: (c.sc * rmsOf(c.act)) / pk.peak };
  };
  /** coordinate search on the phases and weights of a candidate (rms score) */
  const refine = (c) => {
    let ph = c.ph.slice(), rr = c.rr.slice(), cur = c.sc;
    for (const step of [0.4, 0.2, 0.1, 0.05]) {
      for (let i = 0; i < c.act.length; i++) {
        for (const [dp, fr] of [[step, 1], [-step, 1], [0, 1 + step], [0, 1 / (1 + step)]]) {
          const ph2 = ph.slice(), rr2 = rr.slice();
          ph2[i] += dp; rr2[i] *= fr;
          if (!weigh(c.act, ph2, rr2)) continue;
          const s2 = score(c.act, cur * (1 + 1e-9));
          if (s2 > cur * (1 + 1e-9)) { cur = s2; ph = ph2; rr = rr2; }
        }
      }
    }
    return { act: c.act, ph, rr, sc: cur };
  };
  /** the best field from the orbits `allowed`: { waves, rel } or null */
  const searchBand = (allowed) => {
    const rnd = seeded(0x2545F491), NA = allowed.length;
    const top = [];                   // { key, c, act, ph, rr, sc }, best first (quantised score, then try number)
    for (let c = 0; c < WAVE_TRIES; c++) {
      const act = [];
      while (act.length < J) { const j = allowed[Math.floor(rnd() * NA)]; if (!act.includes(j)) act.push(j); }
      act.sort((a, b) => a - b);
      const ph = act.map(() => TAU * rnd()), rr = act.map(() => 0.5 + rnd());
      if (!spans(orbitFreqs(act)) || !weigh(act, ph, rr)) continue;
      const bar = top.length === WAVE_KEEP ? top[WAVE_KEEP - 1].sc : 0;
      const sc = score(act, bar);
      if (!(sc > bar)) continue;
      top.push({ key: Math.round(sc * 1e9), c, act, ph, rr, sc });
      top.sort((p, q) => q.key - p.key || p.c - q.c);
      if (top.length > WAVE_KEEP) top.pop();
    }
    let best = null;
    for (const c of top) {
      const r = judge(refine(c)) || judge(c);
      if (r && (!best || r.rel > best.rel * (1 + 1e-9))) best = r;
    }
    return best;
  };

  // ---- the bands, lowest first, until one is enough; then the lowest within WAVE_NEAR of the best
  const results = [];
  for (const hi of WAVE_BANDS) {
    const allowed = [];
    for (let j = 0; j < P; j++) if (pool[j].kl <= hi * K) allowed.push(j);
    if (allowed.length < J) continue;
    const r = searchBand(allowed);
    if (!r) continue;
    results.push({ ...r, band: hi });
    if (r.rel >= WAVE_ENOUGH) break;
  }
  if (!results.length) return null;
  let bestRel = 0;
  for (const r of results) bestRel = Math.max(bestRel, r.rel);
  const pick = results.find((r) => r.rel >= WAVE_NEAR * bestRel);
  return { waves: pick.waves, band: pick.band, rel: pick.rel, bands: results.map((r) => [r.band, r.rel]) };
}

/** o[0..1] = v(x, y);  o[2..5] = Dv = [dvx/dx, dvx/dy, dvy/dx, dvy/dy]. No trigonometry beyond four calls. */
function evalField(F, x, y, o) {
  const s = TAU * (x * F.b1[0] + y * F.b1[1]), t = TAU * (x * F.b2[0] + y * F.b2[1]);
  const cs = F.cs, ss = F.ss, ct = F.ct, st = F.st;
  const c1 = Math.cos(s), s1 = Math.sin(s), c2 = Math.cos(t), s2 = Math.sin(t);
  cs[0] = 1; ss[0] = 0; ct[0] = 1; st[0] = 0;
  for (let k = 1; k <= F.M; k++) { cs[k] = cs[k - 1] * c1 - ss[k - 1] * s1; ss[k] = ss[k - 1] * c1 + cs[k - 1] * s1; }
  for (let k = 1; k <= F.N; k++) { ct[k] = ct[k - 1] * c2 - st[k - 1] * s2; st[k] = st[k - 1] * c2 + ct[k - 1] * s2; }
  let vx = 0, vy = 0, xx = 0, xy = 0, yx = 0, yy = 0;
  const { mm, nn, sg, ax, ay, bx, by, kx, ky } = F;
  for (let f = 0; f < F.nf; f++) {
    const m = mm[f], n = nn[f], g = sg[f];
    const co = cs[m] * ct[n] - g * ss[m] * st[n];
    const si = ss[m] * ct[n] + g * cs[m] * st[n];
    vx += ax[f] * co + bx[f] * si;
    vy += ay[f] * co + by[f] * si;
    const dx = bx[f] * co - ax[f] * si, dy = by[f] * co - ay[f] * si;   // d/dtheta
    xx += dx * kx[f]; xy += dx * ky[f]; yx += dy * kx[f]; yy += dy * ky[f];
  }
  o[0] = vx; o[1] = vy; o[2] = xx; o[3] = xy; o[4] = yx; o[5] = yy;
  return o;
}

/**
 * How strongly v bends at (x, y): |D²v[u, u]| <= the value returned, for every unit vector u (the two components of
 * v have the Hessians -sum_f k_f k_f^T w_f; the bound is the length of the vector of their spectral radii).
 */
function evalBend(F, x, y) {
  const s = TAU * (x * F.b1[0] + y * F.b1[1]), t = TAU * (x * F.b2[0] + y * F.b2[1]);
  const cs = F.cs, ss = F.ss, ct = F.ct, st = F.st;
  const c1 = Math.cos(s), s1 = Math.sin(s), c2 = Math.cos(t), s2 = Math.sin(t);
  cs[0] = 1; ss[0] = 0; ct[0] = 1; st[0] = 0;
  for (let k = 1; k <= F.M; k++) { cs[k] = cs[k - 1] * c1 - ss[k - 1] * s1; ss[k] = ss[k - 1] * c1 + cs[k - 1] * s1; }
  for (let k = 1; k <= F.N; k++) { ct[k] = ct[k - 1] * c2 - st[k - 1] * s2; st[k] = st[k - 1] * c2 + ct[k - 1] * s2; }
  let pxx = 0, pxy = 0, pyy = 0, qxx = 0, qxy = 0, qyy = 0;
  const { mm, nn, sg, ax, ay, bx, by, kx, ky } = F;
  for (let f = 0; f < F.nf; f++) {
    const m = mm[f], n = nn[f], g = sg[f];
    const co = cs[m] * ct[n] - g * ss[m] * st[n], si = ss[m] * ct[n] + g * cs[m] * st[n];
    const wx = ax[f] * co + bx[f] * si, wy = ay[f] * co + by[f] * si;
    const xx = kx[f] * kx[f], xy = kx[f] * ky[f], yy = ky[f] * ky[f];
    pxx += xx * wx; pxy += xy * wx; pyy += yy * wx;
    qxx += xx * wy; qxy += xy * wy; qyy += yy * wy;
  }
  const rp = Math.abs(pxx + pyy) / 2 + Math.hypot((pxx - pyy) / 2, pxy), rq = Math.abs(qxx + qyy) / 2 + Math.hypot((qxx - qyy) / 2, qxy);
  return Math.hypot(rp, rq);
}

/** `bend` is the largest sampled value times this (the samples are 1/8 of the shortest wave apart). */
const BEND_SAFETY = 1.25;

/**
 * The wavy-cut diffeomorphism psi(x) = x + amp * A * v(x), equivariant under `group`: psi(g x) = g psi(x).
 * Returns { amp, fwd(x, y, out), inv(x, y, out[, gx, gy]) } (gx, gy: optional starting guess for the inverse) plus diagnostics:
 *   vec(x, y, out)        the displacement amp * A * v(x)
 *   jac(x, y, out4)       D psi = [dx'/dx, dx'/dy, dy'/dx, dy'/dy]; returns its determinant
 *   peak                  largest displacement (world units) at this amp;  jacMin  sampled minimum of det D psi
 *   bend                  an upper bound of |D²(psi^-1)[u, u]| over all points and unit vectors u: along a straight
 *                         segment of length L (actual coordinates) the straight coordinates psi^-1 leave their chord by
 *                         at most bend * L² / 8. mesh.js uses it to tell which fine edges can cross a cut twice.
 *   waves                 how the waves were chosen (see chosenWaves): { band, rel, bands, waves } — the band of |kappa|
 *                         taken (in units of 1 / (0.75 sqrt(domainArea))), the smallest first-order bow / target over the
 *                         cut edges it was chosen for, every band tried, the number of waves; null for the generic
 *                         choice (the kaleidoscopes) and at amp 0
 */
export function makeWarp(group, amp = 0) {
  amp = Math.max(0, Math.min(1, +amp || 0));
  if (amp === 0) {
    return {
      amp: 0, group, peak: 0, jacMin: 1, bend: 0, identity: true, waves: null,
      fwd(x, y, out = [0, 0]) { out[0] = x; out[1] = y; return out; },
      inv(x, y, out = [0, 0]) { out[0] = x; out[1] = y; return out; },
      vec(x, y, out = [0, 0]) { out[0] = 0; out[1] = 0; return out; },
      jac(x, y, out) { if (out) { out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 1; } return 1; },
    };
  }
  const F = fieldOf(group);
  const e = amp * F.A;
  const o = new Float64Array(6);
  // Newton converges quadratically: after a step shorter than 3e-9 sizes the remaining error is below 1e-16 sizes
  const tol2 = (3e-9 * F.size) ** 2;
  // D²(psi^-1)[u, u] = -(D psi)^-1 D²psi[(D psi)^-1 u, (D psi)^-1 u]:  at most  e |D²v| / sigma_min(D psi)^3
  let bend = 0;
  for (let B = F.bendSamples, i = 0; i < B.length; i += 5) {
    const a = 1 + e * B[i], b = e * B[i + 1], c = e * B[i + 2], d = 1 + e * B[i + 3];
    const q = a * a + b * b + c * c + d * d, dt = a * d - b * c;
    const s2 = (q - Math.sqrt(Math.max(0, q * q - 4 * dt * dt))) / 2;       // smallest singular value of D psi, squared
    const v = (e * B[i + 4]) / (s2 * Math.sqrt(s2));
    if (v > bend) bend = v;
  }
  bend *= BEND_SAFETY;
  return {
    amp, group, peak: amp * F.peak, jacMin: 1 - amp * amp * (1 - F.jacMin), bend, identity: false, waves: F.choice,
    fwd(x, y, out = [0, 0]) {
      evalField(F, x, y, o);
      out[0] = x + e * o[0]; out[1] = y + e * o[1];
      return out;
    },
    inv(x, y, out = [0, 0], gx, gy) {
      // Newton on  p + e v(p) - x = 0  (3-4 steps), started from one fixed-point step or from the caller's guess (gx, gy)
      let px = gx, py = gy;
      if (gx === undefined) { evalField(F, x, y, o); px = x - e * o[0]; py = y - e * o[1]; }
      for (let it = 0; it < 20; it++) {
        evalField(F, px, py, o);
        const fx = px + e * o[0] - x, fy = py + e * o[1] - y;
        const a = 1 + e * o[2], b = e * o[3], c = e * o[4], d = 1 + e * o[5];
        const dt = a * d - b * c;
        const sx = (d * fx - b * fy) / dt, sy = (a * fy - c * fx) / dt;
        px -= sx; py -= sy;
        if (sx * sx + sy * sy < tol2) break;
      }
      out[0] = px; out[1] = py;
      return out;
    },
    vec(x, y, out = [0, 0]) {
      evalField(F, x, y, o);
      out[0] = e * o[0]; out[1] = e * o[1];
      return out;
    },
    jac(x, y, out) {
      evalField(F, x, y, o);
      const a = 1 + e * o[2], b = e * o[3], c = e * o[4], d = 1 + e * o[5];
      if (out) { out[0] = a; out[1] = b; out[2] = c; out[3] = d; }
      return a * d - b * c;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Symmetry elements near the central lattice cell (cached per group) and seed clamping
// ---------------------------------------------------------------------------------------------------------------

const symCache = new WeakMap();

function symOf(group) {
  let S = symCache.get(group);
  if (!S) {
    const l1 = Math.hypot(group.e1[0], group.e1[1]), l2 = Math.hypot(group.e2[0], group.e2[1]);
    const el = symmetryElements(group, group.center[0], group.center[1], 1.5 * (l1 + l2));
    S = { mirrors: el.mirrors, centers: el.centers, delta: 0.06 * Math.sqrt(group.domainArea) };
    symCache.set(group, S);
  }
  return S;
}

/** Lattice vector T with p - T in the central cell (lattice coordinates of p - T - center in [-1/2, 1/2]). */
function latticeShift(group, x, y) {
  const st = latticeCoords(group, x - group.center[0], y - group.center[1]);
  const m = Math.round(st[0]), n = Math.round(st[1]);
  return [m * group.e1[0] + n * group.e2[0], m * group.e1[1] + n * group.e2[1]];
}

/** A seed must be two finite numbers, and not so large that a lattice period drowns in their rounding. */
const SEED_LIMIT = 1e9;
const usableSeed = (x, y) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= SEED_LIMIT && Math.abs(y) <= SEED_LIMIT;

/**
 * Move a seed off the loci where it has a non-trivial stabiliser: at least delta = 0.06 sqrt(domainArea) from every
 * mirror line (pushed along the normal) and every rotation centre (pushed radially). A seed exactly on such a locus
 * is pushed to a fixed generic side. A seed that is already clear is returned unchanged.
 * A seed that is no seed at all (NaN, infinite, beyond 1e9) is replaced by the seed of the group's first preset, so
 * the result is always usable.
 */
export function clampSeed(group, x, y) {
  if (!usableSeed(x, y)) [x, y] = group.presets[0].seed;
  const S = symOf(group);
  if (!S.mirrors.length && !S.centers.length) return [x, y];
  const T = latticeShift(group, x, y);
  let px = x - T[0], py = y - T[1];
  const delta = S.delta, target = delta * (1 + 1e-7), tiny = 1e-9 * Math.sqrt(group.domainArea);
  const nudgeX = px + 0.1 * tiny * 0.3713, nudgeY = py + 0.1 * tiny * 0.9285;
  let moved = false;

  for (let round = 0; round < 4; round++) {
    let changed = false;
    // --- mirrors: exact projection onto the intersection of the half-planes  n_i . x >= c_i  on the seed's own side
    const cons = [];
    let violated = false;
    for (const m of S.mirrors) {
      let nx = -m.uy, ny = m.ux;
      let d = (px - m.px) * nx + (py - m.py) * ny;
      if (Math.abs(d) > 10 * delta) continue;
      if (Math.abs(d) < tiny) d = (nudgeX - m.px) * nx + (nudgeY - m.py) * ny || 1;
      if (d < 0) { nx = -nx; ny = -ny; }
      const c = m.px * nx + m.py * ny + target;
      cons.push([nx, ny, c]);
      if (px * nx + py * ny < m.px * nx + m.py * ny + delta) violated = true;
    }
    if (violated) {
      const feasible = (qx, qy) => cons.every((k) => qx * k[0] + qy * k[1] >= k[2] - 1e-12);
      let best = null, bestD = Infinity;
      const consider = (qx, qy) => {
        const d2 = (qx - px) ** 2 + (qy - py) ** 2;
        if (d2 < bestD && feasible(qx, qy)) { bestD = d2; best = [qx, qy]; }
      };
      for (const k of cons) {
        const s = k[2] - (px * k[0] + py * k[1]);
        if (s > 0) consider(px + s * k[0], py + s * k[1]);
      }
      if (!best) {
        for (let i = 0; i < cons.length; i++) {
          for (let j = i + 1; j < cons.length; j++) {
            const a = cons[i], b = cons[j], dt = a[0] * b[1] - a[1] * b[0];
            if (Math.abs(dt) < 1e-9) continue;
            consider((a[2] * b[1] - a[1] * b[2]) / dt, (a[0] * b[2] - a[2] * b[0]) / dt);
          }
        }
      }
      if (best) { px = best[0]; py = best[1]; changed = true; }
    }
    // --- rotation centres: radial push
    for (const c of S.centers) {
      let dx = px - c.x, dy = py - c.y;
      let d = Math.hypot(dx, dy);
      if (d >= delta) continue;
      if (d < tiny) { dx = 0.3713; dy = 0.9285; d = Math.hypot(dx, dy); }
      px = c.x + (dx / d) * target; py = c.y + (dy / d) * target;
      changed = true;
    }
    if (!changed) break;
    moved = true;
  }
  return moved ? [px + T[0], py + T[1]] : [x, y];
}

// ---------------------------------------------------------------------------------------------------------------
// Dirichlet domain
// ---------------------------------------------------------------------------------------------------------------

const MERGE = 1e-9;        // vertices closer than this are one vertex
const CLIP_EPS = 1e-12;    // a vertex this close to a bisector counts as on it

function validMetric(group, metric) {
  if (!metric || metric.length !== 3) return false;
  const [q11, q12, q22] = metric;
  if (![q11, q12, q22].every(Number.isFinite)) return false;
  if (!(q11 > 0) || !(q11 * q22 - q12 * q12 > 1e-12 * q11 * q22)) return false;
  const tol = 1e-7 * Math.max(q11, q22);
  for (const r of group.reps) {
    // L^T Q L
    const m11 = r.a * (q11 * r.a + q12 * r.c) + r.c * (q12 * r.a + q22 * r.c);
    const m12 = r.a * (q11 * r.b + q12 * r.d) + r.c * (q12 * r.b + q22 * r.d);
    const m22 = r.b * (q11 * r.b + q12 * r.d) + r.d * (q12 * r.b + q22 * r.d);
    if (Math.abs(m11 - q11) > tol || Math.abs(m12 - q12) > tol || Math.abs(m22 - q22) > tol) return false;
  }
  return true;
}

/** Clip the labelled convex polygon (pts, lab) by n.x <= c; lab[i] labels the edge pts[i] -> pts[i+1]. */
function clipLabeled(P, nx, ny, c, label) {
  const { pts, lab } = P;
  const n = pts.length;
  const s = new Array(n);
  let out = 0;
  for (let i = 0; i < n; i++) { s[i] = nx * pts[i][0] + ny * pts[i][1] - c; if (s[i] > CLIP_EPS) out++; }
  if (out === 0) return;
  if (out === n) { P.pts = []; P.lab = []; return; }
  const np = [], nl = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const pin = s[i] <= CLIP_EPS, qin = s[j] <= CLIP_EPS;
    if (pin && qin) { np.push(pts[i]); nl.push(lab[i]); } else if (pin) {
      np.push(pts[i]);
      if (s[i] >= -CLIP_EPS) nl.push(label);          // leaving exactly at a vertex: the cut starts here
      else {
        nl.push(lab[i]);
        const t = s[i] / (s[i] - s[j]);
        np.push([pts[i][0] + t * (pts[j][0] - pts[i][0]), pts[i][1] + t * (pts[j][1] - pts[i][1])]);
        nl.push(label);
      }
    } else if (qin) {
      if (s[j] >= -CLIP_EPS) continue;                 // entering exactly at a vertex: no new point
      const t = s[i] / (s[i] - s[j]);
      np.push([pts[i][0] + t * (pts[j][0] - pts[i][0]), pts[i][1] + t * (pts[j][1] - pts[i][1])]);
      nl.push(lab[i]);
    }
  }
  P.pts = np; P.lab = nl;
}

/** Drop zero-length edges (their label goes with them). */
function dropShort(P) {
  const { pts, lab } = P;
  const n = pts.length, np = [], nl = [];
  for (let i = 0; i < n; i++) {
    const q = pts[(i + 1) % n];
    if (Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]) > MERGE) { np.push(pts[i]); nl.push(lab[i]); }
  }
  P.pts = np; P.lab = nl;
}

function dirichlet(group, px, py, Q, R) {
  const els = elementsNear(group, px, py, R, px, py);
  const [q11, q12, q22] = Q;
  const pQp = px * (q11 * px + q12 * py) + py * (q12 * px + q22 * py);
  const nb = [];
  for (const g of els) {
    const qx = g.a * px + g.b * py + g.tx, qy = g.c * px + g.d * py + g.ty;
    const dx = qx - px, dy = qy - py;
    if (dx * dx + dy * dy < 1e-18) continue;                       // the identity (the seed has trivial stabiliser)
    let nx = q11 * dx + q12 * dy, ny = q12 * dx + q22 * dy;
    let c = (qx * (q11 * qx + q12 * qy) + qy * (q12 * qx + q22 * qy) - pQp) / 2;
    const l = Math.hypot(nx, ny);
    nx /= l; ny /= l; c /= l;
    nb.push({ g, nx, ny, c, d: c - (nx * px + ny * py) });        // d = distance from the seed to the bisector
  }
  nb.sort((u, v) => u.d - v.d);
  const B = 4 * R;
  const P = { pts: [[px - B, py - B], [px + B, py - B], [px + B, py + B], [px - B, py + B]], lab: [-1, -1, -1, -1] };
  for (let k = 0; k < nb.length; k++) {
    clipLabeled(P, nb[k].nx, nb[k].ny, nb[k].c, k);
    if (P.pts.length < 3) break;
  }
  dropShort(P);
  return { P, nb };
}

/**
 * The tile of `group` for a seed: its Dirichlet domain, with the gluing of its edges.  See SPEC 5.1 for the fields.
 * Extra fields (not in the SPEC): edges[i].rev, edges[i].len, edges[i].mid (straight coordinates), domain.size
 * (= sqrt(domainArea)), domain.seedActual (the warped seed; domain.seed is the clamped seed in straight coordinates),
 * domain.edgePoint(i, t, out).
 * Always a tile: a closed polygon with at least three edges, every one of them glued (its area is domainArea to
 * 1e-7 while the seed is within some thousand lattice periods of the origin; further out rounding takes over). A seed
 * that is no seed (missing, NaN, infinite, beyond 1e9: see clampSeed) gives the tile of the group's first preset.
 * conePoints lists a rotation centre when it is ON the tile to 1e-9, the tolerance its vertices are merged at.
 */
export function buildDomain(group, { seed, metric, warp } = {}) {
  const s0 = seed || group.presets[0].seed;
  const [px, py] = clampSeed(group, s0[0], s0[1]);
  const Q = validMetric(group, metric) ? [metric[0], metric[1], metric[2]] : [1, 0, 1];
  const W = warp || makeWarp(group, 0);
  const { e1, e2 } = group;
  const diam = Math.max(Math.hypot(e1[0] + e2[0], e1[1] + e2[1]), Math.hypot(e1[0] - e2[0], e1[1] - e2[1]),
    Math.hypot(e1[0], e1[1]), Math.hypot(e2[0], e2[1]));

  let P = null, nb = null, area = 0;
  for (let R = 2.5 * diam, attempt = 0; attempt < 3; attempt++, R *= 2) {
    ({ P, nb } = dirichlet(group, px, py, Q, R));
    area = P.pts.length >= 3 ? polyArea(P.pts) : 0;
    if (P.lab.every((l) => l >= 0) && Math.abs(area - group.domainArea) < 1e-6 * group.domainArea) break;
  }

  // --- pair the edges; an edge without a partner (numerical dust at a degenerate vertex) is collapsed to a point
  let pts = P.pts, gs = P.lab.map((l) => nb[l]);
  let partner = [];
  const bounded = pts.length >= 3 && gs.every(Boolean);        // every side is a bisector, none is the clipping square
  for (let guard = 0; bounded && guard < 8; guard++) {
    const n = pts.length;
    partner = new Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      if (partner[i] >= 0) continue;
      const gi = inverse(gs[i].g);
      for (let j = i; j < n; j++) {
        if (partner[j] < 0 && isoEquals(gs[j].g, gi, 1e-7)) { partner[i] = j; partner[j] = i; break; }
      }
    }
    const bad = partner.indexOf(-1);
    if (bad < 0) break;
    const a = pts[bad], b = pts[(bad + 1) % n];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    pts = pts.slice(); gs = gs.slice();
    pts[(bad + 1) % n] = mid;
    pts.splice(bad, 1); gs.splice(bad, 1);
  }
  // Never an empty, open or half-glued tile. (It takes a seed so far from the origin that its coordinates no longer
  // resolve the tile, millions of lattice periods out; the plane view keeps the seed in its window.) The tile of the
  // first preset instead.
  if (!bounded || pts.length < 3 || partner.length !== pts.length || partner.includes(-1)) {
    const p0 = group.presets[0].seed, q0 = clampSeed(group, p0[0], p0[1]);
    if (px === q0[0] && py === q0[1]) throw new Error(`buildDomain: no tile for the group ${group.id}`);
    return buildDomain(group, { seed: p0, metric, warp });
  }

  const n = pts.length;
  const poly = pts.map((p) => [p[0], p[1]]);
  const edges = [];
  for (let i = 0; i < n; i++) {
    const g = gs[i].g, D = det(g);
    const a = poly[i], b = poly[(i + 1) % n];
    const isMirror = D < 0 && partner[i] === i;
    edges.push({
      g, kind: isMirror ? 'mirror' : 'cut', partner: partner[i], cls: -1,
      halfTurn: D > 0 && Math.abs(g.a + 1) < 1e-9 && Math.abs(g.b) < 1e-9,
      nx: gs[i].nx, ny: gs[i].ny, c: gs[i].c,
      rev: D > 0, len: Math.hypot(b[0] - a[0], b[1] - a[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    });
  }
  let classes = 0;
  for (let i = 0; i < n; i++) {
    if (edges[i].kind !== 'cut' || edges[i].cls >= 0) continue;
    edges[i].cls = classes; edges[edges[i].partner].cls = classes; classes++;
  }

  const size = Math.sqrt(group.domainArea);
  const tmp = [0, 0];
  const domain = {
    group, seed: [px, py], seedActual: W.fwd(px, py), metric: Q, warp: W, poly, edges, classes, area: polyArea(poly), size,
    contains(x, y, eps = 0) {
      for (let i = 0; i < n; i++) if (edges[i].nx * x + edges[i].ny * y - edges[i].c > eps) return false;
      return true;
    },
    /** Point of edge i at parameter t in [0, 1] (start -> end), in ACTUAL (warped) coordinates. */
    edgePoint(i, t, out = [0, 0]) {
      const a = poly[i], b = poly[(i + 1) % n];
      return W.fwd((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1], out);   // exact at t = 0 and t = 1
    },
    outline(maxStep = size / 32) {
      const res = [];
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        // an even number of steps (the midpoint is a sample), the same for both partners of a glued pair
        const len = edges[Math.min(i, edges[i].partner)].len;
        const m = Math.max(2, 2 * Math.ceil(len / (2 * maxStep) - 1e-9));
        const out = new Float32Array(2 * (m + 1));
        for (let k = 0; k <= m; k++) {
          const t = k / m;
          W.fwd((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1], tmp);
          out[2 * k] = tmp[0]; out[2 * k + 1] = tmp[1];
        }
        res.push({ edge: i, pts: out });
      }
      return res;
    },
    conePoints: [],
  };

  // --- rotation centres on the boundary of the tile (fixed by the warp, so straight = actual coordinates)
  const S = symOf(group);
  if (S.centers.length) {
    const T = latticeShift(group, px, py);
    const seen = new Set();
    for (const c of S.centers) {
      // the centres are cached around the central cell; try the seed's cell and its neighbours
      for (let du = -1; du <= 1; du++) {
        for (let dv = -1; dv <= 1; dv++) {
          const x = c.x + T[0] + du * e1[0] + dv * e2[0], y = c.y + T[1] + du * e1[1] + dv * e2[1];
          // ON the tile to the tolerance its vertices are merged at, not looser: a seed a hair off a symmetric
          // position has rotation centres a hair OUTSIDE the tile (the glued twin of a cone point on a tiny edge
          // elsewhere), and they are not cone points of this tile
          let worst = -Infinity;
          for (let i = 0; i < n; i++) worst = Math.max(worst, edges[i].nx * x + edges[i].ny * y - edges[i].c);
          if (Math.abs(worst) > MERGE) continue;
          const key = Math.round(x * 1e6) + ',' + Math.round(y * 1e6);
          if (seen.has(key)) continue;
          seen.add(key);
          domain.conePoints.push({ x, y, order: c.order, onMirror: c.onMirror });
        }
      }
    }
  }
  return domain;
}

