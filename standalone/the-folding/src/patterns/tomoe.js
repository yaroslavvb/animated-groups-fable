// src/patterns/tomoe.js — "Tomoe": every tile split by one S-curve into a dark comma and a light comma.
// (Shipped 14 Nov 2026, the pattern round: dev/patterns/designs/tomoe/design.js as it was then, but for its imports;
// test/patterns-shipped.test.js holds the two to the same motif in every group. Its lab and notes stay in that folder.)
//
// The idea (the taijitu fills its disc with two commas, the mitsudomoe with three): take a fundamental domain D of the
// group and cut it in two along an S. The dark half is the motif; the light half is what is left. So the plane is all
// commas, half of them dark, with no background, and every comma has a round head with an eye and a tail.
//
// The rule, all in the frame of the tile (origin its centroid, x along e1, unit the tile size sqrt(domainArea)):
//   * D starts as the page's default tile (the Dirichlet tile of presets[0]); a group without presets (a turned, scaled,
//     shifted copy) gets the same tile from SEED, the default seed in lattice coordinates relative to group.center.
//   * The S runs from the rim point a to the rim point b (KNOBS: a direction from the centroid, snapped to a vertex,
//     an edge's midpoint or a fraction along the edge). The dark comma is on its left, so the rim from b round to a
//     is the dark comma's back and the rim from a to b the light one's. a and b are where the gluing wants them: a
//     tile's edge and its partner carry complementary halves wherever possible, so across the rim a dark back meets
//     the neighbour's LIGHT back and the commas interlock.
//   * The S is a belt round two discs, the heads: from a it wraps the dark head HB (on its left), crosses over, wraps
//     the light head HA (on its right) and runs to b, as the taijitu's S does (dB / dA along the rim, gB / gA off it,
//     as large as fits up to rB / rA; or placed by hand, pB / pA).
//   * The dark comma is the left side of the S inside D drawn INSET smaller, its corners rounded; a light eye in the
//     dark head, a dark eye in the light head, each in the middle of what is left of its head.
//   * NO STRAIGHT RIM (the judges of 14 Nov: "the white channel runs along the default tile's rim, so the print draws
//     the default cut"). The tile the S splits is not D but a BENT tile R: every glued edge of D becomes a smooth curve
//     (its dark stretches bulge out by BEND of their length, its light stretches in; a half-turn edge an S, odd about
//     its centre; a mirror stays straight), and the partner edge gets the group's image of that curve, so R is again a
//     fundamental domain. The whole split is carried from D into R by the map that moves D's rim onto R's and is
//     smooth inside (mean value coordinates). The commas' backs are curves and cross the default tile's sides.
//   * NO CHANNEL ALONG A MIRROR. Where the dark back lies on a mirror the dark does not run beside it:
//     - a BOW (**, *x, 22*, 2*22, *2222, whose mirror corners are right angles): the dark keeps inside a disc that
//       touches the mirror's inset line at one point, so two mirror images meet back to back there, a lens between;
//     - a DENT (3*3, 4*2, *333, *442, *632, whose sharp mirror corners a tail or heel must fill, or the corner is a
//       bare pool): in the middle of the stretch the dark back is pulled off the mirror (a sin^2 hump), so two mirror
//       images meet only near the corners, a leaf of light between them, and the dark does not fill the chamber.
// The continuous knobs per group (rB, rA, dB, dA, gB, gA, curl, eyes, bend, bows, dents) were found by searches scored
// by kit.measure, the production validator and thinParts, then checked by eye (NOTES.md, "Polish (14 Nov)"). Pure and
// deterministic; imports only the page's own src/ modules.
import { buildDomain } from '../domain.js';
import { elementsNear } from '../groups.js';

export const meta = { key: 'tomoe', label: 'Tomoe', hint: 'every tile split by an S into a dark and a light comma, each with an eye' };

// ---- knobs ----------------------------------------------------------------------------------------------------------
/** Everything in tile sizes (sqrt(domainArea)). */
const INSET = 0.024;          // the dark comma is drawn this much inside the tile: channel 2 INSET where dark meets dark
const STEP = 0.012;           // sampling of curves
const R_TIP = 0.03, R_BLUNT = 0.06, R_IN = 0.05;   // rounding of the dark comma's corners: tail tip, blunt corners, concave
const R_TILE = 0.05;          // rounding of the inset tile's corners (a right angle; sharper corners get less)
const R_TIP_MIN = 0.02;       // ... but never less: the dark tip in a corner stays 0.04 wide
const RING_MIN = 0.045;       // an eye keeps this much of its head round it
const EYE_MIN = 0.05;         // an eye smaller than this (radius) is left out: no free piece under 0.1 tile sizes

const DEFAULTS = { rB: 0.25, rA: 0.23, dB: 0.06, dA: 0.06, dFrac: 0.7, gB: 0.06, gA: 0.085, rimGap: 0.03, margin: 0.03, between: 0.05, curl: 0, eyeB: 0.36, eyeA: 0.36, bend: 0.1, bow: 1.6, kiss: 0.5 };

/** Per group: where the S starts (a) and ends (b), each [degrees from the tile's centroid, x along e1, snap]: snap 'v'
 *  the vertex nearest that direction, 'm' the edge midpoint nearest it, a number f the point f of the way along the
 *  edge the ray hits; then the head knobs (DEFAULTS above for any left out). Dimensionless: tile sizes, degrees. */
const KNOBS = {
  o: { a: [288.4, 'v'], b: [108.4, 'v'], rB: 0.32, rA: 0.301, dB: 0.165, dA: 0.009, gB: 0.129, gA: 0.145, curl: 0.415, eyeB: 0.452, eyeA: 0.38, bend: 0.16 },
  2222: { a: [142, 'm'], b: [322, 'm'], rB: 0.265, rA: 0.255, dB: 0.137, dA: 0.214, gB: 0.114, gA: 0.1, curl: 0.175, eyeB: 0.334, eyeA: 0.6, bend: 0.14 },
  '**': { a: [243.4, 'v'], b: [296.6, 'v'], rB: 0.283, rA: 0.3, dB: 0.189, dA: 0.444, gB: 0.045, gA: 0.138, curl: 0.22, eyeB: 0.571, eyeA: 0.513, bows: [[0.38, 2.555]] },
  xx: { a: [270, 0.3], b: [90, 0.3], rB: 0.315, rA: 0.27, dB: 0.146, dA: 0.137, gB: 0.078, gA: 0.078, curl: 0.195, eyeB: 0.416, eyeA: 0.421, bend: 0.14 },
  '*x': { a: [0, 'v'], b: [53.1, 'v'], rB: 0.283, rA: 0.281, dB: 0.159, dA: 0.429, gB: 0.045, gA: 0.076, curl: 0.274, eyeB: 0.571, eyeA: 0.554, bows: [[0.38, 1.827]] },
  333: { a: [90, 'v'], b: [270, 'v'], rB: 0.284, rA: 0.281, dB: 0.45, dA: 0.05, gB: 0.055, gA: 0.079, curl: 0.228, eyeB: 0.487, eyeA: 0.3 },
  '22x': { a: [0, 'm'], b: [180, 'm'], rB: 0.301, rA: 0.288, dB: 0.253, dA: 0.276, gB: 0.09, gA: 0.112, curl: 0.291, eyeB: 0.348, eyeA: 0.487, bend: 0.14 },
  '22*': { a: [342.9, 'v'], b: [90, 'm'], rB: 0.251, rA: 0.23, dB: 0.095, dA: 0.079, gB: 0.121, gA: 0.077, curl: 0.232, eyeB: 0.58, eyeA: 0.521, bows: [[0.5, 2.447]] },
  '*2222': { a: [322.4, 'v'], b: [37.6, 'v'], heel: 0.3, rB: 0.23, rA: 0.272, dB: 0.319, dA: 0.45, gB: 0.059, gA: 0.1, curl: 0.34, eyeB: 0.46, eyeA: 0.376, bows: [[0.5, 1.6], [0.857, 1.6], [0.353, 1.6]] },
  '2*22': { a: [343.7, 'v'], b: [53, 'm'], rB: 0.34, rA: 0.259, dB: 0.5, dA: 0.45, gB: 0.154, gA: 0.137, curl: 0.155, eyeB: 0.398, eyeA: 0.379, bows: [[1, 1.082], [0.5, 2.166], [0.305, 1.6]] },
  442: { a: [225, 'v'], b: [45, 'v'], rB: 0.225, rA: 0.225, dB: 0.16, dA: 0, gB: 0.105, gA: 0.077, curl: 0.52, eyeB: 0.404, eyeA: 0.423, bend: 0.12 },
  632: { a: [90, 'v'], b: [270, 'm'], rB: 0.32, rA: 0.283, dB: 0.363, dA: 0.339, gB: 0.116, gA: 0.07, curl: 0.088, eyeB: 0.317, eyeA: 0.355 },
  '3*3': { a: [90, 'v'], b: [190.9, 'v'], rB: 0.273, rA: 0.276, dB: 0.4, dA: 0.156, gB: 0.123, gA: 0.127, curl: 0.308, eyeB: 0.399, eyeA: 0.491, bows: [[0.5, 0]], dents: [[0.145, 0.998, 0.149]] },
  '*333': { a: [300, 'v'], b: [60, 'v'], rB: 0.264, rA: 0.259, dB: 0.453, dA: 0.198, gB: 0.139, gA: 0.148, curl: 0.281, eyeB: 0.413, eyeA: 0.416, bows: [[0.5, 0], [0.5, 1.515]], dents: [[0.12, 0.895, 0.153], [0.164, 0.85, 0.099]] },
  '4*2': { a: [45, 'v'], b: [153.4, 'v'], rB: 0.284, rA: 0.208, dB: 0.36, dA: 0.302, gB: 0.166, gA: 0.135, curl: 0.22, eyeB: 0.6, eyeA: 0.429, bows: [[0.5, 0]], dents: [[0.139, 0.88, 0.16]] },
  '*442': { a: [135, 'v'], b: [243.5, 'v'], rB: 0.32, rA: 0.274, dB: 0.44, dA: 0.084, gB: 0.1, gA: 0.15, curl: 0.407, eyeB: 0.409, eyeA: 0.498, bows: [[0.5, 0], [0.5, 0]], dents: [[0.1, 0.829, 0.16], [0, 0.9, 0.162]] },
  '*632': { a: [190.9, 'v'], b: [270, 'v'], rB: 0.212, rA: 0.276, dB: 0.355, dA: 0.175, gB: 0.045, gA: 0.102, curl: 0.493, eyeB: 0.482, eyeA: 0.482, bows: [[0.5, 0], [0.365, 0]], dents: [[0.045, 0.871, 0.161], [0.172, 0.958, 0.159]] },
};

/** The seed of the page's default tile in lattice coordinates relative to group.center (dev/seeds.mjs). */
const SEED = {
  o: [0, 0], 2222: [-0.25, -0.25], '**': [0, 0], xx: [-0.125, 0], '*x': [0, 0], 333: [0, -0.5], '22x': [-0.25, 0],
  '22*': [0, -0.125], '*2222': [-0.25, -0.25], '2*22': [-0.125, -0.125], 442: [0, -0.25], 632: [-0.086603, -0.326795],
  '3*3': [-0.057735, -0.38453], '*333': [0, -0.333333], '4*2': [-0.15, -0.15], '*442': [-0.333333, -0.166667],
  '*632': [-0.111111, -0.277778],
};

// ---- small geometry ---------------------------------------------------------------------------------------------------
const TAU = 2 * Math.PI;
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const add = (p, q, k = 1) => [p[0] + k * q[0], p[1] + k * q[1]];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
const cross = (p, q) => p[0] * q[1] - p[1] * q[0];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
const mod = (x, m) => ((x % m) + m) % m;
const rot90 = (v) => [-v[1], v[0]];
const applyG = (g, p) => [g.a * p[0] + g.b * p[1] + g.tx, g.c * p[0] + g.d * p[1] + g.ty];
const linInv = (g, v) => [g.a * v[0] + g.c * v[1], g.b * v[0] + g.d * v[1]];     // the inverse of an isometry's linear part

function area(P) { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; s += p[0] * q[1] - p[1] * q[0]; } return s / 2; }
function centroid(P) {
  let cx = 0, cy = 0, s = 0;
  for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n], w = p[0] * q[1] - p[1] * q[0]; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w; s += w; }
  return [cx / (3 * s), cy / (3 * s)];
}
/** Distance from p to the rim of the convex polygon P (p inside). */
function rimDist(P, p) {
  let d = Infinity;
  for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n], e = unit(sub(b, a)); d = Math.min(d, cross(e, sub(p, a))); }
  return d;
}
/** The first rim point of the convex polygon P from c (inside) along the unit direction w. */
function rayHit(P, c, w) {
  let best = Infinity;
  for (let i = 0, n = P.length; i < n; i++) {
    const a = P[i], e = sub(P[(i + 1) % n], a), den = cross(w, e);
    if (Math.abs(den) < 1e-15) continue;
    const ac = sub(a, c), t = cross(ac, e) / den, s = cross(ac, w) / den;
    if (t > 1e-12 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.min(best, t);
  }
  return add(c, w, best);
}

/** The metric in which u and v are orthonormal (src/groupdata/roll.js metricFromBasis), for o without presets. */
function metricFromBasis(u, v) {
  const det = u[0] * v[1] - u[1] * v[0], r0 = [v[1] / det, -v[0] / det], r1 = [-u[1] / det, u[0] / det];
  const q = (i, j) => r0[i] * r0[j] + r1[i] * r1[j];
  return [q(0, 0), q(0, 1), q(1, 1)];
}

/** A convex counter-clockwise polygon moved in by d, its corners rounded with radius r. */
function insetRounded(P, d, r, rMin = 0, stepDeg = 5) {
  const n = P.length, L = [];
  for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n], u = unit(sub(q, p)); L.push({ p: add(p, rot90(u), d), u }); }
  const V = [];
  for (let i = 0; i < n; i++) {
    const A = L[(i + n - 1) % n], B = L[i], den = cross(A.u, B.u), w = sub(B.p, A.p), t = cross(w, B.u) / den;
    V.push(add(A.p, A.u, t));
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = L[(i + n - 1) % n], B = L[i], v = V[i];
    const turn = Math.atan2(cross(A.u, B.u), dot(A.u, B.u));
    const room = 0.45 * Math.min(len(sub(V[(i + n - 1) % n], v)), len(sub(V[(i + 1) % n], v)));
    // a sharp corner gets a small radius (but a tip stays rMin * 2 wide), so the dark reaches into it
    const corner = Math.PI - turn, rc = typeof r === 'number' ? Math.max(rMin, r * Math.min(1, corner / (Math.PI / 2))) : r[i];
    const rr = Math.min(rc, room / Math.tan(turn / 2));
    if (!(rr > 1e-12) || turn < 1e-6) { out.push(v); continue; }
    const t = rr * Math.tan(turn / 2), p1 = add(v, A.u, -t), c = add(p1, rot90(A.u), rr);
    const a0 = Math.atan2(p1[1] - c[1], p1[0] - c[0]), k = Math.max(2, Math.ceil(turn / (stepDeg * Math.PI / 180)));
    for (let j = 0; j <= k; j++) { const f = a0 + (turn * j) / k; out.push([c[0] + rr * Math.cos(f), c[1] + rr * Math.sin(f)]); }
  }
  return out;
}

/** The tangent point on the circle (c, r) of a line through p; ccw: the circle is passed counter-clockwise; leave: the line runs from the circle to p. */
function tangentPoint(p, c, r, ccw, leave) {
  const v = sub(p, c), d = len(v), th = Math.atan2(v[1], v[0]);
  if (d <= r * 1.0001) return { ang: th, pt: add(c, [Math.cos(th), Math.sin(th)], r) };
  const be = Math.acos(r / d);
  for (const sg of [1, -1]) {
    const f = th + sg * be, T = add(c, [Math.cos(f), Math.sin(f)], r);
    const tan = ccw ? [-Math.sin(f), Math.cos(f)] : [Math.sin(f), -Math.cos(f)];
    const w = leave ? sub(p, T) : sub(T, p);
    if (dot(w, tan) > 0) return { ang: f, pt: T };
  }
  return { ang: th, pt: add(c, [Math.cos(th), Math.sin(th)], r) };
}
function arc(out, c, r, a0, sweep, step) {
  const k = Math.max(2, Math.ceil((Math.abs(sweep) * r) / step), Math.ceil(Math.abs(sweep) / (5 * Math.PI / 180)));
  for (let j = 0; j <= k; j++) { const f = a0 + (sweep * j) / k; out.push([c[0] + r * Math.cos(f), c[1] + r * Math.sin(f)]); }
}
function segment(out, p, q, step) {
  const k = Math.max(1, Math.ceil(len(sub(q, p)) / step));
  for (let j = 1; j <= k; j++) out.push(add(p, sub(q, p), j / k));
}

/**
 * The S: from a round HB = { c, r } (kept on the left), across, round HA (kept on the right), to b. curl in [0, 1):
 * the crossing leaves HB later and meets HA earlier than the straight inner tangent would, as a cubic.
 */
function belt(a, b, HB, HA, { step, curl = 0 }) {
  let rB = HB.r, rA = HA.r;
  const v = sub(HA.c, HB.c), d = len(v);
  if (d < (rB + rA) * 1.02) { const k = d / ((rB + rA) * 1.02); rB *= k; rA *= k; }
  const T1 = tangentPoint(a, HB.c, rB, true, false);
  const g0 = Math.acos(Math.min(1, (rB + rA) / d)), g = g0 * (1 - curl);
  const th2 = Math.atan2(v[1], v[0]) - g, th3 = th2 + Math.PI;
  const T4 = tangentPoint(b, HA.c, rA, false, true);
  const pts = [a];
  segment(pts, a, T1.pt, step);
  arc(pts, HB.c, rB, T1.ang, mod(th2 - T1.ang, TAU), step);
  const P0 = pts[pts.length - 1], P3 = add(HA.c, [Math.cos(th3), Math.sin(th3)], rA);
  if (curl > 1e-6) {
    const t0 = [-Math.sin(th2), Math.cos(th2)], h = 0.42 * len(sub(P3, P0)), C1 = add(P0, t0, h), C2 = add(P3, t0, -h);
    const k = Math.max(4, Math.ceil(len(sub(P3, P0)) / step));
    for (let j = 1; j < k; j++) {
      const t = j / k, m = 1 - t;
      pts.push([m * m * m * P0[0] + 3 * m * m * t * C1[0] + 3 * m * t * t * C2[0] + t * t * t * P3[0], m * m * m * P0[1] + 3 * m * m * t * C1[1] + 3 * m * t * t * C2[1] + t * t * t * P3[1]]);
    }
  } else segment(pts, P0, P3, step);
  arc(pts, HA.c, rA, th3, -mod(th3 - T4.ang, TAU), step);
  segment(pts, pts[pts.length - 1], b, step);
  const Q = dedupe(pts);
  return { pts: Q, rB, rA };
}
function dedupe(P, eps = 1e-12) {
  const out = [];
  for (const p of P) if (!out.length || len(sub(p, out[out.length - 1])) > eps) out.push(p);
  while (out.length > 1 && len(sub(out[0], out[out.length - 1])) <= eps) out.pop();
  return out;
}

/** The polygon left of the open curve S (its ends extended straight on), closed by a circle of radius W round o. */
function leftOf(S, o, W) {
  const n = S.length, dA = unit(sub(S[1], S[0])), dB = unit(sub(S[n - 1], S[n - 2]));
  const hit = (p, u) => { const w = sub(p, o), bq = dot(w, u), cq = dot(w, w) - W * W; return add(p, u, -bq + Math.sqrt(bq * bq - cq)); };
  const Xa = hit(S[0], [-dA[0], -dA[1]]), Xb = hit(S[n - 1], dB);
  const out = [Xa, ...S, Xb];
  const fa = Math.atan2(Xa[1] - o[1], Xa[0] - o[0]), fb = Math.atan2(Xb[1] - o[1], Xb[0] - o[0]);
  const sweep = mod(fa - fb, TAU), k = Math.max(2, Math.ceil(sweep / 0.3));
  for (let j = 1; j < k; j++) { const f = fb + (sweep * j) / k; out.push([o[0] + W * Math.cos(f), o[1] + W * Math.sin(f)]); }
  return out;
}

/** Sutherland-Hodgman: the polygon `subject` inside the convex counter-clockwise polygon `clip`. */
function clipConvex(subject, clip) {
  let P = subject;
  for (let i = 0, n = clip.length; i < n && P.length; i++) {
    const p = clip[i], e = sub(clip[(i + 1) % n], p);
    if (dot(e, e) < 1e-24) continue;
    const side = (z) => cross(e, sub(z, p));
    const out = [];
    for (let j = 0, m = P.length; j < m; j++) {
      const A = P[j], B = P[(j + 1) % m], sa = side(A), sb = side(B);
      if (sa >= 0) out.push(A);
      if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push(add(A, sub(B, A), t)); }
    }
    P = out;
  }
  return P;
}

/** Drop repeated points and points in the middle of a straight run. */
function tidy(P, eps) {
  const Q = dedupe(P, eps), out = [];
  for (let i = 0, n = Q.length; i < n; i++) {
    const u = unit(sub(Q[i], Q[(i + n - 1) % n])), w = unit(sub(Q[(i + 1) % n], Q[i]));
    if (Math.abs(cross(u, w)) < 1e-9 && dot(u, w) > 0) continue;
    out.push(Q[i]);
  }
  return out;
}

/** Long straight edges cut into pieces of at most `step` (so a corner's rounding can start inside one). */
function densify(P, step) {
  const out = [];
  for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; out.push(p); const k = Math.ceil(len(sub(q, p)) / step); for (let j = 1; j < k; j++) out.push(add(p, sub(q, p), j / k)); }
  return out;
}

/**
 * Round every corner of a closed, finely sampled polygon where the outline turns by more than minTurn at one vertex:
 * a convex corner sharper than sharpDeg gets rTip, a blunter one rBlunt, a concave one rIn.
 */
function roundCorners(P, { rTip, rBlunt, rIn, sharpDeg = 70, minTurnDeg = 14, step }) {
  const n = P.length, cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + len(sub(P[(i + 1) % n], P[i])));
  const total = cum[n];
  const corners = [];
  for (let i = 0; i < n; i++) {
    const u = unit(sub(P[i], P[(i + n - 1) % n])), w = unit(sub(P[(i + 1) % n], P[i]));
    const turn = Math.atan2(cross(u, w), dot(u, w));
    if (Math.abs(turn) > (minTurnDeg * Math.PI) / 180) corners.push({ i, s: cum[i], turn });
  }
  if (!corners.length) return P;
  const m = corners.length;
  corners.forEach((c, k) => {
    const prev = corners[(k + m - 1) % m], next = corners[(k + 1) % m];
    const room = 0.45 * Math.min(m > 1 ? mod(c.s - prev.s, total) : total, m > 1 ? mod(next.s - c.s, total) : total);
    const inner = Math.PI - Math.abs(c.turn);
    const r = c.turn < 0 ? rIn : inner < (sharpDeg * Math.PI) / 180 ? rTip : rBlunt;
    c.t = Math.min(r * Math.tan(Math.min(Math.abs(c.turn), 3.0) / 2), room);
  });
  const at = (s) => {
    s = mod(s, total);
    let lo = 0, hi = n;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    const p = P[lo], q = P[(lo + 1) % n], l = cum[lo + 1] - cum[lo], t = l > 0 ? (s - cum[lo]) / l : 0;
    return { pt: add(p, sub(q, p), t), dir: unit(sub(q, p)) };
  };
  const out = [];
  for (let k = 0; k < m; k++) {
    const c = corners[k], nx = corners[(k + 1) % m];
    const A = at(c.s - c.t), B = at(c.s + c.t);
    const phi = Math.acos(Math.max(-1, Math.min(1, dot(A.dir, B.dir))));
    const chord = len(sub(B.pt, A.pt)), rad = chord / (2 * Math.sin(phi / 2) || 1), h = (4 / 3) * Math.tan(phi / 4) * rad;
    const C1 = add(A.pt, A.dir, h), C2 = add(B.pt, B.dir, -h);
    const kk = Math.max(4, Math.ceil(phi / ((6 * Math.PI) / 180)), Math.ceil(chord / step));
    for (let j = 0; j <= kk; j++) {
      const t = j / kk, q = 1 - t;
      out.push([q * q * q * A.pt[0] + 3 * q * q * t * C1[0] + 3 * q * t * t * C2[0] + t * t * t * B.pt[0], q * q * q * A.pt[1] + 3 * q * q * t * C1[1] + 3 * q * t * t * C2[1] + t * t * t * B.pt[1]]);
    }
    const span = m === 1 ? total : mod(nx.s - c.s, total) || total;
    for (let j = 1; j < n; j++) {
      const idx = (c.i + j) % n, d = mod(cum[idx] - c.s, total);
      if (d >= span - nx.t - 1e-12) break;
      if (d > c.t + 1e-12) out.push(P[idx]);
    }
  }
  return out;
}

function circle(c, r, step) {
  const k = Math.max(20, Math.ceil((TAU * r) / step)), out = [];
  for (let j = 0; j < k; j++) { const f = (TAU * j) / k; out.push([c[0] + r * Math.cos(f), c[1] + r * Math.sin(f)]); }
  return out;
}

// ---- the tile ---------------------------------------------------------------------------------------------------------
function tileFor(group) {
  const { e1, e2 } = group, p0 = group.presets && group.presets[0];
  let seed, metric;
  if (p0 && p0.seed) { seed = p0.seed; metric = p0.metric; }
  else {
    const k = SEED[group.id] || [0.137, 0.071];
    seed = [group.center[0] + k[0] * e1[0] + k[1] * e2[0], group.center[1] + k[0] * e1[1] + k[1] * e2[1]];
    if (group.id === 'o') metric = metricFromBasis(e1, e2);
  }
  const d = buildDomain(group, { seed, metric });
  let poly = d.poly.map((p) => [p[0], p[1]]);
  if (area(poly) < 0) poly.reverse();
  // a vertex given twice (several bisectors through one centre, after rounding) or on a straight run is no corner
  return tidy(poly, 1e-4 * Math.sqrt(group.domainArea));
}

/**
 * How each edge of the tile D is glued: { kind: 'mirror' | 'half' | 'pair', j, g } — g the element that carries D to
 * its neighbour across edge i (so g maps edge j of D onto edge i). Found as the element that carries the midpoint of
 * some edge of D onto edge i's midpoint, D to the far side. An edge with no such element counts as a mirror (unbent).
 */
function gluing(group, D, s) {
  const n = D.length, mids = D.map((p, i) => add(p, sub(D[(i + 1) % n], p), 0.5)), c = centroid(D);
  let far = 0;
  for (const p of D) far = Math.max(far, len(sub(p, c)));
  // (loose: SEED is rounded to six places, so a moved group's tile is a hair off the page's; edge midpoints of two tiles
  // are never that close)
  const out = new Array(n).fill(null), tol = 2e-4 * s;
  for (const g of elementsNear(group, c[0], c[1], 2.5 * far, c[0], c[1])) {
    if (Math.abs(g.a - 1) + Math.abs(g.b) + Math.abs(g.c) + Math.abs(g.d - 1) < 1e-9 && Math.hypot(g.tx, g.ty) < tol) continue;
    const gc = applyG(g, c);
    for (let j = 0; j < n; j++) {
      const q = applyG(g, mids[j]);
      for (let i = 0; i < n; i++) {
        if (out[i] || len(sub(q, mids[i])) > tol) continue;
        if (cross(sub(D[(i + 1) % n], D[i]), sub(gc, D[i])) >= 0) continue;
        const det = g.a * g.d - g.b * g.c;
        out[i] = { j, g, kind: i === j ? (det < 0 ? 'mirror' : 'half') : 'pair' };
      }
    }
  }
  return out.map((o) => o || { kind: 'mirror' });
}

/**
 * The bend of the tile's rim: for every edge a displacement along its outward normal, as a function of t in [0, 1].
 * dark(i, t) tells the colour of the rim there. A pair of complementary edges: the dark stretches bulge out by `beta`
 * of their length (sin^2 bumps, flat at their ends), the light ones in (the partner edge gets the image of the curve,
 * which is the same rule). A half-turn edge: odd about its middle (dark half out). An edge dark on both sides (or a
 * pair that is not complementary): an S, odd about its middle. Light on both sides, and a mirror: straight.
 * Returns boundary samples Y (on D's rim, counter-clockwise) and their displacements V.
 */
function bendRim(D, glue, dark, ends, beta, s) {
  const n = D.length, E = D.map((p, i) => sub(D[(i + 1) % n], p)), Ls = E.map(len);
  const N = E.map((e) => unit([e[1], -e[0]]));                       // outward normals (D counter-clockwise)
  const runsOf = (i) => {                                           // maximal stretches of one colour, [u, v, dark]
    const cuts = [0, 1];
    for (const p of ends) { const t = p - i; if (t > 1e-9 && t < 1 - 1e-9) cuts.push(t); }   // the colour changes at a and b only
    cuts.sort((x, y) => x - y);
    const runs = [];
    for (let k = 0; k + 1 < cuts.length; k++) if (cuts[k + 1] - cuts[k] > 1e-9) runs.push([cuts[k], cuts[k + 1], dark(i, (cuts[k] + cuts[k + 1]) / 2)]);
    return runs;
  };
  const bump = (runs, L) => (t) => {
    for (const [u, v, dk] of runs) if (t >= u && t <= v) { const w = v - u, x = Math.sin((Math.PI * (t - u)) / w); return (dk ? 1 : -1) * beta * w * L * x * x; }
    return 0;
  };
  const sWave = (L) => (t) => { const x = Math.sin(Math.PI * t); return (beta * 0.5 * L * 2 * x * x * x * Math.cos(Math.PI * t)) / 0.6495; };
  const H = new Array(n).fill(null);                                 // per edge: t -> displacement vector
  for (let i = 0; i < n; i++) {
    const G = glue[i];
    if (G.kind === 'mirror') { H[i] = () => [0, 0]; continue; }
    const runs = runsOf(i), allLight = runs.every((r) => !r[2]), allDark = runs.every((r) => r[2]);
    if (G.kind === 'half') {
      let h;
      if (allLight) h = () => 0;
      else if (allDark) h = sWave(Ls[i]);
      else {                                                          // the colour of the first half, odd about the middle
        const dk = dark(i, 0.25), w = 0.5, L = Ls[i];
        h = (t) => { const tt = t <= 0.5 ? t : 1 - t, x = Math.sin((Math.PI * tt) / w), v = (dk ? 1 : -1) * beta * w * L * x * x; return t <= 0.5 ? v : -v; };
      }
      H[i] = (t) => { const v = h(t); return [v * N[i][0], v * N[i][1]]; };
      continue;
    }
    const j = G.j;
    if (j < i && glue[j].kind === 'pair' && glue[j].j === i) continue;   // the partner is the master
    // complementary? the colour at edge i's point and at its image on edge j differ everywhere
    const gi = G.g, proj = (k, p) => dot(sub(p, D[k]), E[k]) / (Ls[k] * Ls[k]);
    let comp = true;
    for (let k = 0; k < 16; k++) {
      const t = (k + 0.5) / 16, p = add(D[i], E[i], t), q = applyG({ a: gi.a, b: gi.c, c: gi.b, d: gi.d, tx: 0, ty: 0 }, sub(p, [gi.tx, gi.ty]));
      if (dark(i, t) === dark(j, Math.max(0, Math.min(1, proj(j, q))))) { comp = false; break; }
    }
    let h;
    if (comp) h = bump(runs, Ls[i]);
    else if (allLight && runsOf(j).every((r) => !r[2])) h = () => 0;
    else h = sWave(Ls[i]);
    H[i] = (t) => { const v = h(t); return [v * N[i][0], v * N[i][1]]; };
    if (j !== i) {
      // the partner: its point p' at t' goes to g(p') on edge i at t; its displacement is the image of edge i's there
      H[j] = (tp) => { const p = applyG(gi, add(D[j], E[j], tp)), t = Math.max(0, Math.min(1, proj(i, p))); return linInv(gi, H[i](t)); };
    }
  }
  const Y = [], V = [];
  for (let i = 0; i < n; i++) {
    const K = Math.max(8, Math.ceil(Ls[i] / (0.03 * s)));
    for (let k = 0; k < K; k++) { const t = k / K; Y.push(add(D[i], E[i], t)); V.push(H[i] ? H[i](t) : [0, 0]); }
  }
  return { Y, V };
}

/** Mean value coordinates (Floater; Hormann): the displacement at x inside the polygon Y, interpolated from V on its rim. */
function mvcMap(Y, V) {
  const n = Y.length, X = new Float64Array(n), Yy = new Float64Array(n), Vx = new Float64Array(n), Vy = new Float64Array(n);
  for (let k = 0; k < n; k++) { X[k] = Y[k][0]; Yy[k] = Y[k][1]; Vx[k] = V[k][0]; Vy[k] = V[k][1]; }
  let zero = true;
  for (let k = 0; k < n; k++) if (Vx[k] !== 0 || Vy[k] !== 0) { zero = false; break; }
  const dx = new Float64Array(n), dy = new Float64Array(n), r = new Float64Array(n), tn = new Float64Array(n);
  return (p) => {
    if (zero) return p;
    for (let k = 0; k < n; k++) {
      dx[k] = X[k] - p[0]; dy[k] = Yy[k] - p[1]; r[k] = Math.hypot(dx[k], dy[k]);
      if (r[k] < 1e-13) return [p[0] + Vx[k], p[1] + Vy[k]];
    }
    for (let k = 0; k < n; k++) {
      const q = (k + 1) % n, cr = dx[k] * dy[q] - dy[k] * dx[q], dt = dx[k] * dx[q] + dy[k] * dy[q], den = r[k] * r[q] + dt;
      if (den < 1e-14 * r[k] * r[q] && Math.abs(cr) < 1e-12) {        // p on the segment k, k + 1
        const t = r[k] / (r[k] + r[q]);
        return [p[0] + Vx[k] + t * (Vx[q] - Vx[k]), p[1] + Vy[k] + t * (Vy[q] - Vy[k])];
      }
      tn[k] = cr / den;
    }
    let sx = 0, sy = 0, sw = 0;
    for (let k = 0; k < n; k++) { const w = (tn[(k + n - 1) % n] + tn[k]) / r[k]; sx += w * Vx[k]; sy += w * Vy[k]; sw += w; }
    return [p[0] + sx / sw, p[1] + sy / sw];
  };
}

/** The convex region inside a bow: a disc of radius rho whose rim touches the point m, nu pointing away from the mirror,
 *  united with the half-plane beyond its centre; so it only bites near the mirror. Counter-clockwise. */
function bowRegion(m, nu, rho, far, step) {
  const c = add(m, nu, rho), tau = [nu[1], -nu[0]], out = [];
  const k = Math.max(16, Math.ceil((Math.PI * rho) / step));
  for (let j = 0; j <= k; j++) { const f = (Math.PI * j) / k; out.push(add(c, add([tau[0] * Math.cos(f), tau[1] * Math.cos(f)], nu, -Math.sin(f)), rho)); }
  out.push(add(add(c, tau, -rho), nu, far), add(add(c, tau, rho), nu, far));
  if (area(out) < 0) out.reverse();
  return out;
}

// ---- the design -------------------------------------------------------------------------------------------------------
export function find(group) { return findWith(group, null); }

/** find with some knobs replaced (for the design's own experiments). */
export function findWith(group, over) {
  const D = tileFor(group), s = Math.sqrt(group.domainArea), c = centroid(D), n = D.length;
  const L = len(group.e1), u = [group.e1[0] / L, group.e1[1] / L], v = rot90(u);
  const dirOf = (deg) => { const f = (deg * Math.PI) / 180; return add([u[0] * Math.cos(f), u[1] * Math.cos(f)], v, Math.sin(f)); };
  const angOf = (p) => { const w = sub(p, c); return Math.atan2(dot(w, v), dot(w, u)); };
  const K = { ...DEFAULTS, ...(KNOBS[group.id] || {}), ...(over || {}) };
  const rimPoint = ([deg, snap]) => {
    const f = (deg * Math.PI) / 180;
    const hit = rayHit(D, c, dirOf(deg));
    if (typeof snap === 'number') {                    // that fraction of the way along the edge the ray hits
      let i = 0, bd = Infinity;
      for (let j = 0; j < n; j++) { const q = D[j], e = sub(D[(j + 1) % n], q), t = dot(sub(hit, q), e) / dot(e, e), d = len(sub(hit, add(q, e, Math.max(0, Math.min(1, t))))); if (d < bd) { bd = d; i = j; } }
      return add(D[i], sub(D[(i + 1) % n], D[i]), snap);
    }
    let cands = null;
    if (snap === 'v') cands = D;
    else if (snap === 'm') cands = D.map((p, i) => add(p, sub(D[(i + 1) % n], p), 0.5));
    if (!cands) return hit;
    let best = null, bd = Infinity;
    for (const p of cands) { const d = Math.abs(mod(angOf(p) - f + Math.PI, TAU) - Math.PI); if (d < bd) { bd = d; best = p; } }
    return best;
  };
  const a = rimPoint(K.a || [180, null]), b = rimPoint(K.b || [0, null]);
  const rimPos = (p) => {                       // edge index + fraction along it
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const q = D[i], e = sub(D[(i + 1) % n], q), l2 = dot(e, e), t = Math.max(0, Math.min(1, dot(sub(p, q), e) / l2));
      const d = len(sub(p, add(q, e, t)));
      if (d < bd - 1e-12) { bd = d; best = i + (t > 1 - 1e-9 ? 1 : t); }
    }
    return mod(best, n);
  };
  const pa = rimPos(a), pb = rimPos(b), span = mod(pa - pb, n);
  const darkAt = (i, t) => mod(i + t - pb, n) < span;                // the dark back: the rim from b round to a
  // The tile's corners are rounded by R_TILE (less where sharp); the HEELS (the corners inside the dark back) get K.heel
  // instead when it is set.
  const radii = D.map((p, i) => {
    const u1 = unit(sub(p, D[(i + n - 1) % n])), u2 = unit(sub(D[(i + 1) % n], p));
    const corner = Math.PI - Math.atan2(cross(u1, u2), dot(u1, u2));
    return Math.max(R_TIP_MIN, R_TILE * Math.min(1, corner / (Math.PI / 2))) * s;
  });
  if (K.heel) for (let i = 0; i < n; i++) { const x = mod(i - pb, n); if (x > 1e-6 && x < span - 1e-6) radii[i] = K.heel * s; }
  let Din = insetRounded(D, INSET * s, radii, R_TIP_MIN * s);
  // The bows: on every mirror stretch of the dark back the dark keeps inside a disc that touches the inset line once.
  // K.bows lists [kiss, radius] for the mirror stretches of the dark back in their order from b round to a (kiss: where
  // along the stretch the bow touches, 0 at its end nearer b); a stretch not listed takes [K.kiss, K.bow]. K.dents lists
  // [from, to, depth] for the same stretches: between those fractions of the stretch the dark back is pulled away from
  // the mirror by up to depth tile sizes (a sin^2 hump, so it still touches the mirror at the stretch's ends, where a tail
  // or a heel fills a corner): two mirror images then meet in a leaf of light, not along a channel.
  const glue = gluing(group, D, s), bows = [], dents = [];
  for (let k = 0, nb = 0; k < n; k++) {
    const i = (Math.floor(pb) + k) % n;
    if (glue[i].kind !== 'mirror') continue;
    const e = sub(D[(i + 1) % n], D[i]), nu = rot90(unit(e));
    let t0 = -1, t1 = -1;
    for (let q = 0; q <= 200; q++) { const t = q / 200; if (darkAt(i, Math.min(Math.max(t, 1e-9), 1 - 1e-9))) { if (t0 < 0) t0 = t; t1 = t; } }
    if (t0 < 0 || t1 - t0 < 0.02) continue;
    const [kiss, bow] = (K.bows && K.bows[nb]) || [K.kiss, K.bow], dent = K.dents && K.dents[nb];
    nb++;
    if (dent && dent[2] > 0) dents.push({ P0: add(D[i], e, t0), e: unit(e), L: (t1 - t0) * len(e), nu, f0: dent[0], f1: dent[1], depth: dent[2] * s, lam: Math.max(2.5 * dent[2], 0.25) * s });
    if (!(bow > 0)) continue;
    const m = add(add(D[i], e, t0 + kiss * (t1 - t0)), nu, INSET * s), rho = bow * s;
    bows.push({ c: add(m, nu, rho), r: rho, nu, i });
    Din = clipConvex(Din, bowRegion(m, nu, rho, 20 * s, STEP * s));
  }
  /** The dents as a map: a point near a dented stretch moves away from its mirror (the band within lam of the inset line
   *  is pressed together, nothing is folded over: depth * 2 / lam < 1). */
  const dentMap = (p) => {
    let q = p;
    for (const T of dents) {
      const w = sub(q, T.P0), f = dot(w, T.e) / T.L, d = dot(w, T.nu) - INSET * s;
      if (f <= T.f0 || f >= T.f1 || d >= T.lam) continue;
      const x = Math.sin((Math.PI * (f - T.f0)) / (T.f1 - T.f0)), wgt = d <= 0 ? 1 : (1 - d / T.lam) ** 2;
      q = add(q, T.nu, T.depth * x * x * wgt);
    }
    return q;
  };
  const inBows = (p, r) => { let room = Infinity; for (const B of bows) { const w = sub(p, B.c); if (dot(w, B.nu) < 0) room = Math.min(room, B.r - len(w) - r); } return room; };
  // The heads. The dark head HB sits against the LIGHT back just after a (the rim leaving a counter-clockwise), the
  // light head HA against the DARK back just after b: so the S leaves a along the rim, a light tail's width off it,
  // wraps HB, crosses over, wraps HA and runs into b a dark tail's width off the rim, as the taijitu's S does.
  const edgeAt = (p) => {             // the edge that leaves p counter-clockwise
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const q = D[i], e = sub(D[(i + 1) % n], q), l2 = dot(e, e), t = Math.max(0, Math.min(1, dot(sub(p, q), e) / l2));
      const d = len(sub(p, add(q, e, t))) + (t > 1 - 1e-9 ? 1e-6 : 0);       // a vertex belongs to the edge it starts
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const head = (p, d, g, rMax) => {
    const i = edgeAt(p), q1 = D[(i + 1) % n], t = unit(sub(q1, D[i])), nIn = rot90(t);
    // the angle of the rim at p: a corner when p is a vertex, else a straight angle
    const atV = len(sub(p, D[i])) < 1e-9 * s, tPrev = unit(sub(D[i], D[(i + n - 1) % n]));
    const alpha = atV ? Math.PI - Math.atan2(cross(tPrev, t), dot(tPrev, t)) : Math.PI;
    let r = rMax * s, cc = null;
    for (let it = 0; it < 8; it++) {
      // as near p as the corner lets a disc of radius r + g, tangent to the edge, come; then d further on
      const dd = Math.min((r + g * s) / Math.tan(alpha / 2) + d * s, K.dFrac * len(sub(q1, p)));
      cc = add(add(p, t, dd), nIn, r + g * s);
      let dOther = Infinity;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const q = D[j], e = unit(sub(D[(j + 1) % n], q));
        dOther = Math.min(dOther, cross(e, sub(cc, q)));
      }
      const rr = Math.min(rMax * s, dOther - (INSET + K.margin) * s, r + inBows(cc, r) - K.margin * s);
      if (Math.abs(rr - r) < 1e-6 * s) break;
      r = Math.max(0.05 * s, rr);
    }
    return { c: cc, r };
  };
  // or a head placed by hand: [x, y] in the tile's frame (tile sizes from the centroid, x along e1), as large as fits
  const atP = ([x, y], rMax) => {
    const cc = add(add(c, u, x * s), v, y * s);
    let r = Math.max(0.05 * s, Math.min(rMax * s, rimDist(D, cc) - (INSET + K.margin + K.rimGap) * s));
    r = Math.max(0.05 * s, Math.min(r, r + inBows(cc, r) - K.margin * s));
    return { c: cc, r };
  };
  const HB = K.pB ? atP(K.pB, K.rB) : head(a, K.dB, K.gB, K.rB), HA = K.pA ? atP(K.pA, K.rA) : head(b, K.dA, K.gA, K.rA);
  { const dd = len(sub(HA.c, HB.c)), need = HB.r + HA.r + K.between * s; if (dd < need) { const k = Math.max(0.3, (dd - K.between * s) / (HB.r + HA.r)); HB.r *= k; HA.r *= k; } }
  const S = belt(a, b, HB, HA, { step: STEP * s, curl: K.curl });
  const W = 50 * s + len(sub(b, a));
  let dark = clipConvex(leftOf(S.pts, c, W), Din);
  dark = tidy(dark, 1e-9 * s);
  dark = densify(dark, STEP * s);
  dark = roundCorners(dark, { rTip: R_TIP * s, rBlunt: R_BLUNT * s, rIn: R_IN * s, step: STEP * s });
  if (dents.length) { dark = densify(dark, STEP * s).map(dentMap); HB.c = dentMap(HB.c); HA.c = dentMap(HA.c); }
  // The eyes, each kept RING_MIN inside its head: a head clipped by the rim (or crowded by the S) must not leave a hairline
  // ring round its eye. An eye that would be smaller than EYE_MIN is left out.
  const edgeDist = (p, P) => { let d = Infinity; for (let i = 0, m = P.length; i < m; i++) { const q = P[i], e = sub(P[(i + 1) % m], q), l2 = dot(e, e), t = l2 > 0 ? Math.max(0, Math.min(1, dot(sub(p, q), e) / l2)) : 0; d = Math.min(d, len(sub(p, add(q, e, t)))); } return d; };
  const insidePoly = (p, P) => { let inn = false; for (let i = 0, m = P.length, j = m - 1; i < m; j = i++) { const yi = P[i][1], yj = P[j][1]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < P[i][0] + ((p[1] - yi) * (P[j][0] - P[i][0])) / (yj - yi)) inn = !inn; } return inn; };
  // The eye sits in the middle of what is left of its head: the point within half the head's radius of its centre that is
  // farthest from the outline (on the right side of it).
  const eyeAt = (cc, r, room, ok) => {
    let best = cc, bd = ok(cc) ? room(cc) : -Infinity;
    for (let k = 1; k <= 4; k++) for (let j = 0; j < 16; j++) {
      const f = (j * Math.PI) / 8, q = add(cc, [Math.cos(f), Math.sin(f)], (k * r) / 8);
      if (!ok(q)) continue;
      const d = room(q); if (d > bd + 1e-9 * s) { bd = d; best = q; }
    }
    return { c: best, d: bd };
  };
  const EB = eyeAt(HB.c, S.rB, (p) => edgeDist(p, dark), (p) => insidePoly(p, dark));
  const EA = eyeAt(HA.c, S.rA, (p) => Math.min(edgeDist(p, dark), edgeDist(p, Din) + INSET * s), (p) => !insidePoly(p, dark) && rimDist(D, p) > 0);
  const eB = Math.min(K.eyeB * S.rB, EB.d - RING_MIN * s), eA = Math.min(K.eyeA * S.rA, EA.d - RING_MIN * s);
  // Into the bent tile: the rim of D moves onto the bent rim, and every point inside with it (mean value coordinates).
  const { Y, V } = bendRim(D, glue, darkAt, [pa, pb], K.bend, s);
  const psi = mvcMap(Y, V);
  const shapes = [{ pts: dark.map(psi), hole: false }];
  if (K.eyeB > 0 && eB >= EYE_MIN * s) shapes.push({ pts: circle(psi(EB.c), eB, STEP * s), hole: true });
  if (K.eyeA > 0 && eA >= EYE_MIN * s) shapes.push({ pts: circle(psi(EA.c), eA, STEP * s), hole: false });
  let bx = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of D) { const w = sub(p, c), x = dot(w, u) / s, y = dot(w, v) / s; bx = [Math.min(bx[0], x), Math.min(bx[1], y), Math.max(bx[2], x), Math.max(bx[3], y)]; }
  const mirrors = [];
  for (let i = 0; i < n; i++) if (glue[i].kind === 'mirror') mirrors.push([D[i], D[(i + 1) % n]]);
  return { shapes, info: { a, b, heads: [HB.c, HA.c], rB: S.rB / s, rA: S.rA / s, eyes: [eB / s, eA / s], box: bx.map((x) => +x.toFixed(3)), mirrors } };
}
