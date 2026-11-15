// dev/patterns/designs/tomoe/engine.js — the geometry of the Tomoe design (pure; no DOM). design.js holds the rules.
//
// A tile D (convex polygon, counter-clockwise) is split by ONE curve S that runs from the rim point a to the rim point b:
// the DARK comma is on the left of S, the LIGHT comma on its right (so the rim from b round to a, counter-clockwise, is
// the dark comma's back and the rim from a to b the light one's). S is a belt round two discs, the heads:
//     a -> (tangent) -> round the dark head HB, keeping it on the left -> (inner tangent) -> round the light head HA,
//     keeping it on the right -> (tangent) -> b
// which is the taijitu's S when the heads touch in the middle and a, b lie on them. The dark comma is that side of S
// inside the tile drawn `inset` smaller (so copies of the comma keep a channel 2 * inset wide wherever dark meets dark
// across the rim), with every corner rounded. All lengths here are in the units of the points given.

const TAU = 2 * Math.PI;
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const add = (p, q, k = 1) => [p[0] + k * q[0], p[1] + k * q[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
const mod = (x, m) => ((x % m) + m) % m;

export function area(P) { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; s += p[0] * q[1] - p[1] * q[0]; } return s / 2; }
export function centroid(P) {
  let cx = 0, cy = 0, s = 0;
  for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n], w = p[0] * q[1] - p[1] * q[0]; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w; s += w; }
  return [cx / (3 * s), cy / (3 * s)];
}

/** A convex counter-clockwise polygon moved in by d, its corners rounded with radius r (a number, or one per vertex). */
export function insetRounded(P, d, r, stepDeg = 5) {
  const n = P.length, L = [];
  for (let i = 0; i < n; i++) {                                   // the edge lines, moved in
    const p = P[i], q = P[(i + 1) % n], u = unit(sub(q, p)), nrm = [-u[1], u[0]];
    L.push({ p: add(p, nrm, d), u });
  }
  const V = [];
  for (let i = 0; i < n; i++) {                                   // vertex i = line i-1 x line i
    const A = L[(i + n - 1) % n], B = L[i], den = A.u[0] * B.u[1] - A.u[1] * B.u[0];
    const w = sub(B.p, A.p), t = (w[0] * B.u[1] - w[1] * B.u[0]) / den;
    V.push(add(A.p, A.u, t));
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = L[(i + n - 1) % n], B = L[i], v = V[i];
    const turn = Math.atan2(A.u[0] * B.u[1] - A.u[1] * B.u[0], A.u[0] * B.u[0] + A.u[1] * B.u[1]);   // > 0: convex
    let rr = typeof r === 'number' ? r : r[i];
    const room = 0.45 * Math.min(len(sub(V[(i + n - 1) % n], v)), len(sub(V[(i + 1) % n], v)));
    rr = Math.min(rr, room / Math.tan(turn / 2));
    if (!(rr > 1e-9) || turn < 1e-6) { out.push(v); continue; }
    const t = rr * Math.tan(turn / 2), p1 = add(v, A.u, -t), c = add(p1, [-A.u[1], A.u[0]], rr);
    const a0 = Math.atan2(p1[1] - c[1], p1[0] - c[0]), k = Math.max(2, Math.ceil(turn / (stepDeg * Math.PI / 180)));
    for (let j = 0; j <= k; j++) { const f = a0 + (turn * j) / k; out.push([c[0] + rr * Math.cos(f), c[1] + rr * Math.sin(f)]); }
  }
  return out;
}

/** The tangent point on the circle (c, r) of a line through p; `ccw`: the circle is passed counter-clockwise (on the left). `leave`: the line runs from the circle to p. */
function tangentPoint(p, c, r, ccw, leave) {
  const v = sub(p, c), d = len(v), th = Math.atan2(v[1], v[0]);
  if (d <= r * 1.0001) return { ang: th, pt: add(c, [Math.cos(th), Math.sin(th)], r) };
  const be = Math.acos(r / d);
  for (const sgn of [1, -1]) {
    const f = th + sgn * be, T = add(c, [Math.cos(f), Math.sin(f)], r);
    const tan = ccw ? [-Math.sin(f), Math.cos(f)] : [Math.sin(f), -Math.cos(f)];       // direction of travel on the circle
    const w = leave ? sub(p, T) : sub(T, p);
    if (w[0] * tan[0] + w[1] * tan[1] > 0) return { ang: f, pt: T };
  }
  return { ang: th, pt: add(c, [Math.cos(th), Math.sin(th)], r) };
}

function arc(out, c, r, a0, sweep, step) {                       // sweep > 0: counter-clockwise
  const k = Math.max(2, Math.ceil(Math.abs(sweep) * r / step), Math.ceil(Math.abs(sweep) / (5 * Math.PI / 180)));
  for (let j = 0; j <= k; j++) { const f = a0 + (sweep * j) / k; out.push([c[0] + r * Math.cos(f), c[1] + r * Math.sin(f)]); }
}

/**
 * The curve S: from a round HB = { c, r } (on its left), across, round HA (on its right), to b. `curl` in [0, 1) lets
 * the curve hug each head further than the straight inner tangent would (0: the straight belt) and cross over in an S.
 * Returns { pts, dirA, dirB }: the points and the unit directions of travel at its two ends.
 */
export function belt(a, b, HB, HA, { step = 0.012, curl = 0 } = {}) {
  let rB = HB.r, rA = HA.r;
  const v = sub(HA.c, HB.c), d = len(v);
  if (d < (rB + rA) * 1.0005) { const k = d / ((rB + rA) * 1.0005); rB *= k; rA *= k; }
  const T1 = tangentPoint(a, HB.c, rB, true, false);
  const g0 = Math.acos(Math.min(1, (rB + rA) / d));
  const g = g0 * (1 - curl);                                      // curl: leave later than the tangent point
  const th2 = Math.atan2(v[1], v[0]) - g;                          // the angle on HB where the curve leaves it
  const T4 = tangentPoint(b, HA.c, rA, false, true);
  const pts = [];
  if (len(sub(a, T1.pt)) > 1e-9) pts.push(a);
  arc(pts, HB.c, rB, T1.ang, mod(th2 - T1.ang, TAU), step);
  const th3 = th2 + Math.PI;                                       // ... and where it meets HA (the same radial direction, reversed)
  const P0 = pts[pts.length - 1], P3 = add(HA.c, [Math.cos(th3), Math.sin(th3)], rA);
  if (curl > 1e-6) {                                               // an S across: a cubic with the circles' tangents at its ends
    const t0 = [-Math.sin(th2), Math.cos(th2)], h = 0.42 * len(sub(P3, P0));
    const C1 = add(P0, t0, h), C2 = add(P3, t0, -h), k = Math.max(4, Math.ceil(len(sub(P3, P0)) / step));
    for (let j = 1; j < k; j++) {
      const t = j / k, m = 1 - t;
      pts.push([m * m * m * P0[0] + 3 * m * m * t * C1[0] + 3 * m * t * t * C2[0] + t * t * t * P3[0], m * m * m * P0[1] + 3 * m * m * t * C1[1] + 3 * m * t * t * C2[1] + t * t * t * P3[1]]);
    }
  }
  arc(pts, HA.c, rA, th3, -mod(th3 - T4.ang, TAU), step);
  if (len(sub(b, T4.pt)) > 1e-9) pts.push(b);
  const n = pts.length;
  return { pts, dirA: unit(sub(pts[1], pts[0])), dirB: unit(sub(pts[n - 1], pts[n - 2])) };
}

/** The polygon "left of the curve S", closed far away (a circle of radius W round o). */
export function leftOf(S, o, W) {
  const hit = (p, u) => { const w = sub(p, o), bq = w[0] * u[0] + w[1] * u[1], cq = w[0] * w[0] + w[1] * w[1] - W * W; return add(p, u, -bq + Math.sqrt(bq * bq - cq)); };
  const Xa = hit(S.pts[0], [-S.dirA[0], -S.dirA[1]]), Xb = hit(S.pts[S.pts.length - 1], S.dirB);
  const out = [Xa, ...S.pts, Xb];
  const fa = Math.atan2(Xa[1] - o[1], Xa[0] - o[0]), fb = Math.atan2(Xb[1] - o[1], Xb[0] - o[0]);
  const sweep = mod(fa - fb, TAU), k = Math.max(2, Math.ceil(sweep / 0.5));
  for (let j = 1; j < k; j++) { const f = fb + (sweep * j) / k; out.push([o[0] + W * Math.cos(f), o[1] + W * Math.sin(f)]); }
  return out;
}

/** Sutherland-Hodgman: the polygon `subject` inside the convex counter-clockwise polygon `clip`. */
export function clipConvex(subject, clip) {
  let P = subject;
  for (let i = 0, n = clip.length; i < n && P.length; i++) {
    const p = clip[i], q = clip[(i + 1) % n], ex = q[0] - p[0], ey = q[1] - p[1];
    if (ex * ex + ey * ey < 1e-24) continue;
    const side = (z) => ex * (z[1] - p[1]) - ey * (z[0] - p[0]);              // > 0: inside
    const out = [];
    for (let j = 0, m = P.length; j < m; j++) {
      const A = P[j], B = P[(j + 1) % m], sa = side(A), sb = side(B);
      if (sa >= 0) out.push(A);
      if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]); }
    }
    P = out;
  }
  return P;
}

/** Drop repeated points and points in the middle of a straight run. */
export function tidy(P, eps = 1e-9) {
  let Q = [];
  for (const p of P) if (!Q.length || len(sub(p, Q[Q.length - 1])) > eps) Q.push(p);
  while (Q.length > 1 && len(sub(Q[0], Q[Q.length - 1])) <= eps) Q.pop();
  const out = [];
  for (let i = 0, n = Q.length; i < n; i++) {
    const a = Q[(i + n - 1) % n], b = Q[i], c = Q[(i + 1) % n];
    const u = unit(sub(b, a)), w = unit(sub(c, b));
    if (Math.abs(u[0] * w[1] - u[1] * w[0]) < 1e-7 && u[0] * w[0] + u[1] * w[1] > 0) continue;
    out.push(b);
  }
  return out;
}

/**
 * Round every corner of a closed polygon whose direction turns by more than `minTurn` at one vertex: a convex corner
 * sharper than `sharpDeg` gets the radius rTip, a blunter one rBlunt, a concave one rIn. The polygon's curves are
 * expected to be sampled finely (a few degrees a vertex).
 */
export function roundCorners(P, { rTip, rBlunt, rIn, sharpDeg = 62, minTurn = 14 * Math.PI / 180, step = 0.01 }) {
  const n = P.length, cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + len(sub(P[(i + 1) % n], P[i])));
  const total = cum[n];
  const at = (s) => {                                              // the point and the direction at arc length s
    s = mod(s, total);
    let lo = 0, hi = n;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const p = P[lo], q = P[(lo + 1) % n], l = cum[lo + 1] - cum[lo], t = l > 0 ? (s - cum[lo]) / l : 0;
    return { pt: [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])], dir: unit(sub(q, p)), seg: lo };
  };
  const corners = [];
  for (let i = 0; i < n; i++) {
    const u = unit(sub(P[i], P[(i + n - 1) % n])), w = unit(sub(P[(i + 1) % n], P[i]));
    const turn = Math.atan2(u[0] * w[1] - u[1] * w[0], u[0] * w[0] + u[1] * w[1]);
    if (Math.abs(turn) > minTurn) corners.push({ i, s: cum[i], turn });
  }
  if (!corners.length) return P;
  const m = corners.length;
  corners.forEach((c, k) => {
    const prev = corners[(k + m - 1) % m], next = corners[(k + 1) % m];
    const room = 0.47 * Math.min(mod(c.s - prev.s, total) || total, mod(next.s - c.s, total) || total);
    const inner = Math.PI - Math.abs(c.turn);                      // the corner's own angle
    const r = c.turn < 0 ? rIn : (inner < sharpDeg * Math.PI / 180 ? rTip : rBlunt);
    c.t = Math.min(r * Math.tan(Math.abs(c.turn) / 2), room);
  });
  const out = [];
  for (let k = 0; k < m; k++) {
    const c = corners[k], next = corners[(k + 1) % m];
    const A = at(c.s - c.t), B = at(c.s + c.t);
    const phi = Math.acos(Math.max(-1, Math.min(1, A.dir[0] * B.dir[0] + A.dir[1] * B.dir[1])));
    const chord = len(sub(B.pt, A.pt)), rad = chord / (2 * Math.sin(phi / 2) || 1), h = (4 / 3) * Math.tan(phi / 4) * rad;
    const C1 = add(A.pt, A.dir, h), C2 = add(B.pt, B.dir, -h), kk = Math.max(4, Math.ceil(phi / (6 * Math.PI / 180)), Math.ceil(chord / step));
    for (let j = 0; j <= kk; j++) {
      const t = j / kk, q = 1 - t;
      out.push([q * q * q * A.pt[0] + 3 * q * q * t * C1[0] + 3 * q * t * t * C2[0] + t * t * t * B.pt[0], q * q * q * A.pt[1] + 3 * q * q * t * C1[1] + 3 * q * t * t * C2[1] + t * t * t * B.pt[1]]);
    }
    // the polygon's own vertices up to the next corner's rounding
    const s0 = c.s + c.t, s1 = c.s + mod(next.s - c.s, total) - next.t || (c.s + total - next.t);
    const end = m === 1 ? c.s + total - c.t : s1;
    for (let i = B.seg + 1; ; i++) {
      const s = cum[mod(i, n)] + Math.floor(i / n) * total + (cum[mod(i, n)] < s0 - Math.floor(i / n) * total - 1e-12 && i < n ? 0 : 0);
      const sAbs = cum[mod(i, n)] + (i >= n ? total : 0) + (cum[mod(i, n)] + (i >= n ? total : 0) < s0 ? total : 0);
      if (sAbs >= end - 1e-12 || i > B.seg + 2 * n) break;
      out.push(P[mod(i, n)]);
    }
  }
  return out;
}

/** A circle as a polygon. */
export function circle(c, r, step = 0.012) {
  const k = Math.max(24, Math.ceil((TAU * r) / step)), out = [];
  for (let j = 0; j < k; j++) { const f = (TAU * j) / k; out.push([c[0] + r * Math.cos(f), c[1] + r * Math.sin(f)]); }
  return out;
}

/** Does the closed polygon cross itself? (plain O(n^2); for the tests of the design) */
export function selfCrossing(P) {
  const n = P.length, o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const a = P[i], b = P[(i + 1) % n], c = P[j], d = P[(j + 1) % n];
    if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return true;
  }
  return false;
}
