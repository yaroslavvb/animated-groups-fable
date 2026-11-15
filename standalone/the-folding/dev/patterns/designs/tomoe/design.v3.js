// dev/patterns/designs/tomoe/design.js — "Tomoe": every tile split by one S-curve into a dark comma and a light comma.
//
// The idea (the taijitu fills its disc with two commas, the mitsudomoe with three): take a fundamental domain D of the
// group and cut it in two along an S. The dark half is the motif; the light half is what is left. So the plane is all
// commas, half of them dark, with no background, and every comma has a round head with an eye and a tail.
//
// The rule, all in the frame of the tile (origin its centroid, x along e1, unit the tile size sqrt(domainArea)):
//   * D is the page's default tile (the Dirichlet tile of presets[0]), so that tile holds one whole dark comma and one
//     whole light one. A group without presets (a turned, scaled, shifted copy) gets the same tile from SEED, the
//     default seed in lattice coordinates relative to group.center (o: with the metric of its default cut).
//   * The S runs from the rim point a to the rim point b (KNOBS: a direction from the centroid, snapped to a vertex,
//     an edge's midpoint or a fraction along the edge). The dark comma is on its left, so the rim from b round to a
//     is the dark comma's back and the rim from a to b the light one's. a and b are where the gluing wants them: a
//     tile's edge and its partner carry complementary halves wherever possible, so across the rim a dark back meets
//     the neighbour's LIGHT back and the commas interlock (that puts the S's ends ON the 3-, 4- and 6-fold centres
//     and on the half-turn centres of half-turn edges; glide-paired edges get glide-related ends). A mirror cannot be
//     complementary: a dark back along a mirror leaves a channel, a light back merges with its mirror image.
//   * The S is a belt round two discs, the heads: from a it wraps the dark head HB (on its left), crosses over, wraps
//     the light head HA (on its right) and runs to b, as the taijitu's S does. HB sits against the LIGHT back just
//     after a, HA against the DARK back just after b (as near the S's end as the corner lets a disc come, then
//     dB / dA further on, a light-tail gap gB / dark-tail gap gA off the rim), as large as fits up to rB / rA; *x
//     places its two heads at the ends of its strip instead (pB, pA).
//   * The dark comma is the left side of the S inside D drawn INSET smaller, every corner rounded (a sharp corner of
//     the tile less, so the dark reaches into a 30 degree corner, but a tip stays 0.04 wide): copies keep a channel
//     2 INSET wide wherever dark would meet dark (along a mirror, at the corners where several commas meet).
//   * A light eye in the dark head, a dark eye in the light head (eyeB, eyeA: radius over the head's). Each eye sits in
//     the middle of what is left of its head (the point near the head's centre farthest from the outline) and keeps
//     RING_MIN of the head round it, so a head cut by the rim or the S never leaves a hairline ring.
//   * heel (where set): the dark comma's back corners - the tile corners inside the rim from b round to a - are rounded
//     with this radius instead of R_TILE. Only where dark meets dark across both edges of the corner (*2222's mirror
//     corners): there it turns two straight sides into one round back and only widens the channel into a small hub.
// The continuous knobs per group (rB, rA, dB, dA, gB, gA, curl, eyes) were found by dev/opt.mjs: a search scored by
// the bare and solid discs and the dark share, bigger heads preferred, then checked by eye (NOTES.md). The second run
// (13-14 Nov, the critique in CRITIQUE.md) re-tuned 2222, **, 22*, 2*22, 3*3, *333, 4*2, *x with dev/kitopt.mjs, which
// scores by kit.measure itself and refuses a motif that breaks src/shapes.js validateShapes or has a part thinner than
// 0.03 tile sizes (a pinched neck, a hairline ring): the 3D texture breaks such parts up.
import { buildDomain } from '../../../../src/domain.js';

export const meta = { key: 'tomoe', label: 'Tomoe', hint: 'every tile split by an S into a dark and a light comma, each with an eye' };

// ---- knobs ----------------------------------------------------------------------------------------------------------
/** Everything in tile sizes (sqrt(domainArea)). */
const INSET = 0.024;          // the dark comma is drawn this much inside the tile: channel 2 INSET where dark meets dark
const STEP = 0.012;           // sampling of curves
const R_TIP = 0.03, R_BLUNT = 0.06, R_IN = 0.05;   // rounding of the dark comma's corners: tail tip, blunt corners, concave
const R_TILE = 0.05;          // rounding of the inset tile's corners (a right angle; sharper corners get less)
const R_TIP_MIN = 0.02;       // ... but never less: the dark tip in a corner stays 0.04 wide
const RING_MIN = 0.045;       // an eye keeps this much of its head round it
const EYE_MIN = 0.025;        // an eye smaller than this (radius) is left out: a speck

const DEFAULTS = { rB: 0.25, rA: 0.23, dB: 0.06, dA: 0.06, dFrac: 0.7, gB: 0.06, gA: 0.085, rimGap: 0.03, margin: 0.03, between: 0.05, curl: 0, eyeB: 0.36, eyeA: 0.36 };

/** Per group: where the S starts (a) and ends (b), each [degrees from the tile's centroid, x along e1, snap]: snap 'v'
 *  the vertex nearest that direction, 'm' the edge midpoint nearest it, a number f the point f of the way along the
 *  edge the ray hits; then the head knobs (DEFAULTS above for any left out). Dimensionless: tile sizes, degrees. */
const KNOBS = {
  o: { a: [288.4, 'v'], b: [108.4, 'v'], rB: 0.32, rA: 0.268, dB: 0.165, dA: 0.009, gB: 0.129, gA: 0.145, curl: 0.371, eyeB: 0.452, eyeA: 0.442 },
  2222: { a: [142, 'm'], b: [322, 'm'], rB: 0.265, rA: 0.255, dB: 0.137, dA: 0.214, gB: 0.114, gA: 0.1, curl: 0.175, eyeB: 0.334, eyeA: 0.6 },
  '**': { a: [243.4, 'v'], b: [296.6, 'v'], rB: 0.294, rA: 0.268, dB: 0.159, dA: 0.429, gB: 0.045, gA: 0.142, curl: 0.16, eyeB: 0.571, eyeA: 0.392 },
  xx: { a: [270, 0.3], b: [90, 0.3], rB: 0.315, rA: 0.27, dB: 0.146, dA: 0.137, gB: 0.078, gA: 0.078, curl: 0.195, eyeB: 0.416, eyeA: 0.421 },
  '*x': { a: [190.6, 0.5], b: [10.6, 0.5], pB: [-0.7, -0.13], pA: [0.7, 0.13], margin: 0, rB: 0.304, rA: 0.279, curl: 0.304, eyeB: 0.3, eyeA: 0.55 },
  333: { a: [90, 'v'], b: [270, 'v'], rB: 0.32, rA: 0.269, dB: 0.45, dA: 0.05, gB: 0.055, gA: 0.079, curl: 0.035, eyeB: 0.389, eyeA: 0.429 },
  '22x': { a: [0, 'm'], b: [180, 'm'], rB: 0.301, rA: 0.288, dB: 0.253, dA: 0.276, gB: 0.09, gA: 0.112, curl: 0.291, eyeB: 0.348, eyeA: 0.487 },
  '22*': { a: [342.9, 'v'], b: [90, 'm'], rB: 0.251, rA: 0.222, dB: 0.095, dA: 0.079, gB: 0.071, gA: 0.077, curl: 0.392, eyeB: 0.58, eyeA: 0.3 },
  '*2222': { a: [322.4, 'v'], b: [37.6, 'v'], heel: 0.3, rB: 0.266, rA: 0.272, dB: 0.319, dA: 0.45, gB: 0.059, gA: 0.119, curl: 0.34, eyeB: 0.46, eyeA: 0.376 },
  '2*22': { a: [343.7, 'v'], b: [53, 'm'], rB: 0.34, rA: 0.268, dB: 0.285, dA: 0.45, gB: 0.123, gA: 0.098, curl: 0.155, eyeB: 0.446, eyeA: 0.38 },
  442: { a: [225, 'v'], b: [45, 'v'], rB: 0.225, rA: 0.225, dB: 0.16, dA: 0, gB: 0.105, gA: 0.077, curl: 0.52, eyeB: 0.404, eyeA: 0.423 },
  632: { a: [90, 'v'], b: [270, 'm'], rB: 0.32, rA: 0.283, dB: 0.363, dA: 0.339, gB: 0.116, gA: 0.07, curl: 0.088, eyeB: 0.317, eyeA: 0.355 },
  '3*3': { a: [90, 'v'], b: [190.9, 'v'], rB: 0.224, rA: 0.268, dB: 0.4, dA: 0.1, gB: 0.086, gA: 0.085, curl: 0.3, eyeB: 0.6, eyeA: 0.3 },
  '*333': { a: [300, 'v'], b: [60, 'v'], rB: 0.232, rA: 0.265, dB: 0.414, dA: 0.198, gB: 0.075, gA: 0.148, curl: 0.449, eyeB: 0.6, eyeA: 0.454 },
  '4*2': { a: [45, 'v'], b: [153.4, 'v'], rB: 0.251, rA: 0.276, dB: 0.429, dA: 0.147, gB: 0.085, gA: 0.131, curl: 0.477, eyeB: 0.6, eyeA: 0.3 },
  '*442': { a: [135, 'v'], b: [243.5, 'v'], rB: 0.32, rA: 0.274, dB: 0.44, dA: 0.084, gB: 0.086, gA: 0.15, curl: 0.41, eyeB: 0.6, eyeA: 0.3 },
  '*632': { a: [190.9, 'v'], b: [270, 'v'], rB: 0.212, rA: 0.23, dB: 0.355, dA: 0.45, gB: 0.045, gA: 0.09, curl: 0.493, eyeB: 0.482, eyeA: 0.306 },
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

// ---- the design -------------------------------------------------------------------------------------------------------
export function find(group) { return findWith(group, null); }

/** find with some knobs replaced (for the design's own experiments). */
export function findWith(group, over) {
  const D = tileFor(group), s = Math.sqrt(group.domainArea), c = centroid(D);
  const L = len(group.e1), u = [group.e1[0] / L, group.e1[1] / L], v = rot90(u);
  const dirOf = (deg) => { const f = (deg * Math.PI) / 180; return add([u[0] * Math.cos(f), u[1] * Math.cos(f)], v, Math.sin(f)); };
  const angOf = (p) => { const w = sub(p, c); return Math.atan2(dot(w, v), dot(w, u)); };
  const K = { ...DEFAULTS, ...(KNOBS[group.id] || {}), ...(over || {}) };
  const rimPoint = ([deg, snap]) => {
    const f = (deg * Math.PI) / 180, n = D.length;
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
  // The tile's corners are rounded by R_TILE (less where sharp). The HEELS - the corners inside the dark comma's back,
  // the rim from b round to a - get K.heel instead when it is set: where dark meets dark across both edges of a corner
  // (mirrors, and edges glued dark to dark), a big round heel only widens the channel into a small light hub, and it
  // turns the back of the dark comma from two straight sides with a corner into one round back.
  const rimPos = (p) => {                       // edge index + fraction along it
    let best = 0, bd = Infinity;
    for (let i = 0, n = D.length; i < n; i++) {
      const q = D[i], e = sub(D[(i + 1) % n], q), l2 = dot(e, e), t = Math.max(0, Math.min(1, dot(sub(p, q), e) / l2));
      const d = len(sub(p, add(q, e, t)));
      if (d < bd - 1e-12) { bd = d; best = i + (t > 1 - 1e-9 ? 1 : t); }
    }
    return mod(best, D.length);
  };
  const radii = D.map((p, i) => {
    const n = D.length, u1 = unit(sub(p, D[(i + n - 1) % n])), u2 = unit(sub(D[(i + 1) % n], p));
    const corner = Math.PI - Math.atan2(cross(u1, u2), dot(u1, u2));
    return Math.max(R_TIP_MIN, R_TILE * Math.min(1, corner / (Math.PI / 2))) * s;
  });
  if (K.heel) {
    const n = D.length, pa = rimPos(a), pb = rimPos(b), span = mod(pa - pb, n);
    for (let i = 0; i < n; i++) { const x = mod(i - pb, n); if (x > 1e-6 && x < span - 1e-6) radii[i] = K.heel * s; }
  }
  const Din = insetRounded(D, INSET * s, radii, R_TIP_MIN * s);
  // The heads. The dark head HB sits against the LIGHT back just after a (the rim leaving a counter-clockwise), the
  // light head HA against the DARK back just after b: so the S leaves a along the rim, a light tail's width off it,
  // wraps HB, crosses over, wraps HA and runs into b a dark tail's width off the rim, as the taijitu's S does.
  const edgeAt = (p) => {             // the edge that leaves p counter-clockwise
    let best = 0, bd = Infinity;
    for (let i = 0, n = D.length; i < n; i++) {
      const q = D[i], e = sub(D[(i + 1) % n], q), l2 = dot(e, e), t = Math.max(0, Math.min(1, dot(sub(p, q), e) / l2));
      const d = len(sub(p, add(q, e, t))) + (t > 1 - 1e-9 ? 1e-6 : 0);       // a vertex belongs to the edge it starts
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const head = (p, d, g, rMax) => {
    const n = D.length, i = edgeAt(p), q1 = D[(i + 1) % n], t = unit(sub(q1, D[i])), nIn = rot90(t);
    // the angle of the rim at p: a corner when p is a vertex, else a straight angle
    const atV = len(sub(p, D[i])) < 1e-9 * s, tPrev = unit(sub(D[i], D[(i + n - 1) % n]));
    const alpha = atV ? Math.PI - Math.atan2(cross(tPrev, t), dot(tPrev, t)) : Math.PI;
    let r = rMax * s, cc = null;
    for (let it = 0; it < 8; it++) {
      // as near p as the corner lets a disc of radius r + g, tangent to the edge, come; then d further on
      const dd = Math.min((r + g * s) / Math.tan(alpha / 2) + d * s, K.dFrac * len(sub(q1, p)));
      cc = add(add(p, t, dd), nIn, r + g * s);
      let dOther = Infinity;
      for (let j = 0, n = D.length; j < n; j++) {
        if (j === i) continue;
        const q = D[j], e = unit(sub(D[(j + 1) % n], q));
        dOther = Math.min(dOther, cross(e, sub(cc, q)));
      }
      const rr = Math.min(rMax * s, dOther - (INSET + K.margin) * s);
      if (Math.abs(rr - r) < 1e-6 * s) break;
      r = Math.max(0.05 * s, rr);
    }
    return { c: cc, r };
  };
  // or a head placed by hand: [x, y] in the tile's frame (tile sizes from the centroid, x along e1), as large as fits
  const atP = ([x, y], rMax) => {
    const cc = add(add(c, u, x * s), v, y * s);
    return { c: cc, r: Math.max(0.05 * s, Math.min(rMax * s, rimDist(D, cc) - (INSET + K.margin + K.rimGap) * s)) };
  };
  const HB = K.pB ? atP(K.pB, K.rB) : head(a, K.dB, K.gB, K.rB), HA = K.pA ? atP(K.pA, K.rA) : head(b, K.dA, K.gA, K.rA);
  { const dd = len(sub(HA.c, HB.c)), need = HB.r + HA.r + K.between * s; if (dd < need) { const k = Math.max(0.3, (dd - K.between * s) / (HB.r + HA.r)); HB.r *= k; HA.r *= k; } }
  const S = belt(a, b, HB, HA, { step: STEP * s, curl: K.curl });
  const W = 50 * s + len(sub(b, a));
  let dark = clipConvex(leftOf(S.pts, c, W), Din);
  dark = tidy(dark, 1e-9 * s);
  dark = densify(dark, STEP * s);
  dark = roundCorners(dark, { rTip: R_TIP * s, rBlunt: R_BLUNT * s, rIn: R_IN * s, step: STEP * s });
  const shapes = [{ pts: dark, hole: false }];
  // The eyes, each kept RING_MIN inside its head: a head clipped by the rim (or crowded by the S) must not leave a hairline
  // ring round its eye (the critique, 13 Nov: *442's light eye came within 0.002 of the head's edge; the 3D texture
  // breaks such a ring up). An eye that would be smaller than EYE_MIN is left out.
  const edgeDist = (p, P) => { let d = Infinity; for (let i = 0, n = P.length; i < n; i++) { const q = P[i], e = sub(P[(i + 1) % n], q), l2 = dot(e, e), t = l2 > 0 ? Math.max(0, Math.min(1, dot(sub(p, q), e) / l2)) : 0; d = Math.min(d, len(sub(p, add(q, e, t)))); } return d; };
  const insidePoly = (p, P) => { let inn = false; for (let i = 0, n = P.length, j = n - 1; i < n; j = i++) { const yi = P[i][1], yj = P[j][1]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < P[i][0] + ((p[1] - yi) * (P[j][0] - P[i][0])) / (yj - yi)) inn = !inn; } return inn; };
  // The eye sits in the middle of what is left of its head: the point within half the head's radius of its centre that is
  // farthest from the outline (on the right side of it). A head the rim or the S cuts on one side (*442's dark head
  // against its light tail) keeps a whole eye with a whole ring; an uncut head keeps its eye in the centre.
  const eyeAt = (c, r, room, ok) => {
    let best = c, bd = ok(c) ? room(c) : -Infinity;
    for (let k = 1; k <= 4; k++) for (let j = 0; j < 16; j++) {
      const f = (j * Math.PI) / 8, q = add(c, [Math.cos(f), Math.sin(f)], (k * r) / 8);
      if (!ok(q)) continue;
      const d = room(q); if (d > bd + 1e-9 * s) { bd = d; best = q; }
    }
    return { c: best, d: bd };
  };
  const EB = eyeAt(HB.c, S.rB, (p) => edgeDist(p, dark), (p) => insidePoly(p, dark));
  const EA = eyeAt(HA.c, S.rA, (p) => Math.min(edgeDist(p, dark), rimDist(D, p)), (p) => !insidePoly(p, dark) && rimDist(D, p) > 0);
  const eB = Math.min(K.eyeB * S.rB, EB.d - RING_MIN * s), eA = Math.min(K.eyeA * S.rA, EA.d - RING_MIN * s);
  if (K.eyeB > 0 && eB >= EYE_MIN * s) shapes.push({ pts: circle(EB.c, eB, STEP * s), hole: true });
  if (K.eyeA > 0 && eA >= EYE_MIN * s) shapes.push({ pts: circle(EA.c, eA, STEP * s), hole: false });
  let bx = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of D) { const w = sub(p, c), x = dot(w, u) / s, y = dot(w, v) / s; bx = [Math.min(bx[0], x), Math.min(bx[1], y), Math.max(bx[2], x), Math.max(bx[3], y)]; }
  return { shapes, info: { a, b, heads: [HB.c, HA.c], rB: S.rB / s, rA: S.rA / s, box: bx.map((x) => +x.toFixed(3)) } };
}
