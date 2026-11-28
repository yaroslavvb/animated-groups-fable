// solid.js — the orbifold PQRS as a SOLID: the convex polyhedron whose surface is the orbifold itself.
// Pure: no DOM. It stands on flips.js (which stands on the engine of Two features, two handles).
//
// WHAT IT IS. Six arcs join the four cone points two and two without crossing: they cut the orbifold into four
// geodesic triangles, the faces of a tetrahedron. A tetrahedron with those six edge lengths in a space of the
// orbifold's own curvature (hyperbolic 3-space for a hyperbolic orbifold, ordinary space for 2222) has four faces
// congruent to the four triangles, glued the same way: its surface IS the orbifold, exactly, creased along the six
// arcs. Alexandrov's theorem says there is one such convex solid for every metric (flat ones included: a doubled
// quadrilateral), and it does not depend on any choice of loops. So the solid is the same whichever partition is
// "active": nothing here reads which loop is the cut, except to find the cone points.
//
// WHICH SIX ARCS. For every way to pair the cone points there are infinitely many loops; three loops that meet each
// other twice (a triangle of flips.js) give six arcs, the two seals of each. Only one triangle's arcs are the edges
// of a tetrahedron: the REDUCED one, in which no loop is longer than its twin. (A tetrahedron's edge is the
// shortest way between its ends, so an edge-loop is no longer than its twin; the reduced triangle is the only one
// left.) The cards' triangle is brought there by twin moves on the developed picture: `swaps` counts them.
// At a tie the solid is flat (a doubled quadrilateral) and both triangles give the same flat figure.
//
// HOW IT IS DRAWN. Hyperbolic: the vertices are found on the hyperboloid of R^{3,1}, moved so that their middle is
// the origin, and shown in the Poincaré BALL (radius 2 here, so that lengths near the middle are true): faces are
// caps of spheres, edges arcs of circles, and the corners look as pointed as their cone angles are. Flat: R^3.
//
//   const S = solidOf(state);                    state: the engine's (state.js)
//   S.kind                 'H' | 'E'
//   S.features             [i, j, k, l]: the face (i, j, k) is counter-clockwise seen from OUTSIDE; l is the fourth
//   S.dist[f][g]           the length of the edge between features f and g (the seal of the reduced triangle)
//   S.swaps                twin moves from the cards' triangle to the reduced one (0: the cards' seals are the edges)
//   S.vertex[f]            [x, y, z] of feature f, as drawn (the solid's own frame, its middle at the origin)
//   S.thick                the solid's thickness: the distance of vertex l from the plane of the face (i, j, k) (0: flat)
//   S.faces                four of { f: [a, b, c] (counter-clockwise seen from outside), P: [Pa, Pb, Pc] (the pair
//                          frame: hyperboloid points, or [x, y, 1] of the plane) }
//   S.point(y, out, hint)  where a point y of the pair frame (ANY lift) lies on the solid -> out = [x, y, z];
//                          returns the developed triangle it was found in (hand it back as `hint` for a near point)
//   S.trace(a, b, n)       the geodesic from a to b (pair frame) laid on the solid: Float32Array(3 m), with a point
//                          wherever it crosses an edge
//   S.mesh(levels)         { positions: Float64Array(3 n), triangles: Uint32Array(3 m), corners: Float64Array(9 m),
//                            face: Uint8Array(m) }: each face cut into 4^levels triangles by halving (so the
//                            triangles are of even hyperbolic size); vertices are not shared between faces
//   S.rotate(R)            turn the solid as drawn by the rotation R (row-major 9): vertex, point, trace, mesh follow
//
// The pair frame is the engine's frame of `state` (handles.js fourConeCentered / pillowCentered): the print's chart
// (print3d.js chartOf) takes the mesh's `corners` as they are.

import { layout, triangle } from './flips.js';

const PI = Math.PI;
const det3 = (a, b, c) => a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
const even = (j) => (((j % 2) + 2) % 2) === 0;
/** The scale of the ball as drawn: 2, so that near the middle a drawn length is the hyperbolic length. */
export const BALL = 2;

// ---- the two plane geometries, as far as this file needs them -------------------------------------------------------
// q is the "edge quantity" of two points: cosh of their distance (hyperbolic), the distance itself (flat).
const GEO = {
  H: {
    q: (u, v) => u[2] * v[2] - u[0] * v[0] - u[1] * v[1],
    dist: (q) => Math.acosh(Math.max(1, q)),
    ofDist: (d) => Math.cosh(d),
    norm: (v) => { const n = Math.sqrt(Math.max(1e-300, v[2] * v[2] - v[0] * v[0] - v[1] * v[1])); return [v[0] / n, v[1] / n, v[2] / n]; },
    /** The point at quantities qu from U and qv from V, to the left (or right) of U -> V. */
    third(U, V, qu, qv, left) {
      const quv = GEO.H.q(U, V), den = Math.max(1e-300, quv * quv - 1);
      const al = (qv * quv - qu) / den, be = (qu * quv - qv) / den;
      const cx = U[1] * V[2] - U[2] * V[1], cy = U[2] * V[0] - U[0] * V[2], cz = U[0] * V[1] - U[1] * V[0];
      const ga = (Math.sqrt(Math.max(0, al * al + be * be + 2 * al * be * quv - 1)) / Math.sqrt(den)) * (left ? 1 : -1);
      return GEO.H.norm([al * U[0] + be * V[0] + ga * cx, al * U[1] + be * V[1] + ga * cy, al * U[2] + be * V[2] - ga * cz]);
    },
    /** The point a share t of the way from u to v. */
    mix(u, v, t) {
      const d = GEO.H.dist(GEO.H.q(u, v));
      if (d < 1e-9) return [u[0] + t * (v[0] - u[0]), u[1] + t * (v[1] - u[1]), u[2] + t * (v[2] - u[2])];
      const a = Math.sinh((1 - t) * d) / Math.sinh(d), b = Math.sinh(t * d) / Math.sinh(d);
      return GEO.H.norm([a * u[0] + b * v[0], a * u[1] + b * v[1], a * u[2] + b * v[2]]);
    },
  },
  E: {
    q: (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]),
    dist: (q) => q,
    ofDist: (d) => d,
    norm: (v) => [v[0] / v[2], v[1] / v[2], 1],
    third(U, V, du, dv, left) {
      const duv = Math.max(1e-300, Math.hypot(V[0] - U[0], V[1] - U[1])), ex = (V[0] - U[0]) / duv, ey = (V[1] - U[1]) / duv;
      const a = (du * du - dv * dv + duv * duv) / (2 * duv), h = Math.sqrt(Math.max(0, du * du - a * a)) * (left ? 1 : -1);
      return [U[0] + a * ex - h * ey, U[1] + a * ey + h * ex, 1];
    },
    mix: (u, v, t) => [u[0] + t * (v[0] - u[0]), u[1] + t * (v[1] - u[1]), 1],
  },
};

/** cos(pi / n), exactly 0 for n = 2. */
const cosPi = (n) => (n === 2 ? 0 : Math.cos(PI / n));
const sinPi = (n) => Math.sin(PI / n);

/**
 * A loop runs round two seals, one in each pair; the seals' lengths fix each other. Given the quantity q of the seal
 * between cone points of orders (n1, n2), the quantity of the seal between the other two, of orders (n3, n4):
 *   cosh(L / 2) = sin(pi/n1) sin(pi/n2) cosh d12 - cos(pi/n1) cos(pi/n2) = the same with 3, 4      (flat: d34 = d12)
 */
export function partnerQuantity(kind, q, n1, n2, n3, n4) {
  if (kind === 'E') return q;
  const X = sinPi(n1) * sinPi(n2) * q - cosPi(n1) * cosPi(n2);
  return (X + cosPi(n3) * cosPi(n4)) / (sinPi(n3) * sinPi(n4));
}

/** cosh(L / 2) of the loop round a seal of quantity q between cone points of orders n1, n2 (flat: the seal's length). */
export function loopQuantity(kind, q, n1, n2) {
  return kind === 'E' ? q : sinPi(n1) * sinPi(n2) * q - cosPi(n1) * cosPi(n2);
}

// ---- the developed star of a triangulation ---------------------------------------------------------------------------
// T = { kind, G, f: [i, j, k, l] (features), P: [Pi, Pj, Pk] (the face (i, j, k), counter-clockwise), q: 4 x 4 by
// feature (the six edge quantities), orders: by feature }.

/** The fourth cone point developed across each side of the base face: [across i-j, across j-k, across k-i]. */
function wings(T) {
  const [i, j, k, l] = T.f, [Pi, Pj, Pk] = T.P, q = T.q, G = T.G;
  return [G.third(Pi, Pj, q[i][l], q[j][l], false), G.third(Pj, Pk, q[j][l], q[k][l], false), G.third(Pk, Pi, q[k][l], q[i][l], false)];
}

/**
 * One twin move, if any loop of the triangulation is longer than its twin: the pair of opposite edges (u-v | w-l)
 * gives way to the other diagonals of the two quadrilaterals round them. Returns the new T, or null when the
 * triangulation is reduced (no twin is shorter by more than `tol`, relative).
 */
function twinMove(T, tol) {
  const [i, j, k, l] = T.f, [Pi, Pj, Pk] = T.P, G = T.G, q = T.q, W = wings(T);
  // across side (u, v) the face's third corner w and the wing see each other along the twin of the edge w-l
  const tries = [
    { u: i, v: j, w: k, Pu: Pi, Pw: Pk, wing: W[0] },
    { u: j, v: k, w: i, Pu: Pj, Pw: Pi, wing: W[1] },
    { u: k, v: i, w: j, Pu: Pk, Pw: Pj, wing: W[2] },
  ];
  let best = null;
  for (const t of tries) {
    const qNew = G.q(t.Pw, t.wing), gain = (q[t.w][l] - qNew) / Math.max(1, Math.abs(q[t.w][l]));
    if (gain > tol && (!best || gain > best.gain)) best = { ...t, qNew, gain };
  }
  if (!best) return null;
  const { u, v, w, Pu, Pw, wing, qNew } = best, o = T.orders;
  const q2 = q.map((row) => row.slice());
  q2[w][l] = q2[l][w] = qNew;
  q2[u][v] = q2[v][u] = partnerQuantity(T.kind, qNew, o[w], o[l], o[u], o[v]);
  // the quadrilateral (u, l, v, w), counter-clockwise, now cut along w-l: the face (u, l, w), and v is the fourth
  return { ...T, f: [u, l, w, v], P: [Pu, wing, Pw], q: q2 };
}

/** The cards' triangle of a state as a developed triangulation (flips.js: the face (A, B, Y_{k+1}) and its wings). */
export function cardsTriangulation(state) {
  const K = layout(state), tr = triangle(state), k = tr.k, kind = K.kind, G = GEO[kind];
  const sY = even(k + 1) ? 2 : 3, sW = 5 - sY, perm = state.perm;
  const f = [perm[0], perm[1], perm[sY], perm[sW]];
  const Pi = K.X(0), Pj = K.X(1), Pk = K.Y(k + 1), Wjk = K.Y(k + 2), Wki = K.Y(k);
  const q = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  const put = (a, b, v) => { q[a][b] = v; q[b][a] = v; };
  put(f[0], f[1], G.q(Pi, Pj)); put(f[1], f[2], G.q(Pj, Pk)); put(f[2], f[0], G.q(Pk, Pi));
  put(f[0], f[3], G.q(Pi, Wki)); put(f[1], f[3], G.q(Pj, Wjk)); put(f[2], f[3], G.q(Pk, Wjk));
  const orders = [0, 0, 0, 0];
  for (let slot = 0; slot < 4; slot++) orders[perm[slot]] = state.orders[slot];
  return { kind, G, f, P: [Pi, Pj, Pk], q, orders };
}

/** The reduced triangulation of a state: the cards' one after as many twin moves as it takes. { T, swaps }. */
export function reducedTriangulation(state, { tol = 1e-10, max = 200 } = {}) {
  let T = cardsTriangulation(state), swaps = 0;
  for (; swaps < max; swaps++) {
    const next = twinMove(T, tol);
    if (!next) break;
    T = next;
  }
  return { T, swaps };
}

// ---- the tetrahedron in space ----------------------------------------------------------------------------------------

/** Four points of the hyperboloid of R^{3,1} ([x, y, z, t]) with the given cosh of distances; (0, 1, 2) counter-clockwise seen from +z, 3 below. */
function tetraH(c01, c02, c12, c03, c13, c23) {
  const sh = Math.sqrt(Math.max(1e-300, c01 * c01 - 1));
  const x2 = (c02 * c01 - c12) / sh, y2 = Math.sqrt(Math.max(1e-300, c02 * c02 - 1 - x2 * x2));
  const x3 = (c03 * c01 - c13) / sh, y3 = (c03 * c02 - c23 - x3 * x2) / y2;
  const z2 = c03 * c03 - 1 - x3 * x3 - y3 * y3, z3 = -Math.sqrt(Math.max(0, z2));
  // put the fourth point back on the hyperboloid (a flat solid's z^2 comes out a rounding error either side of 0)
  const t3 = Math.sqrt(1 + x3 * x3 + y3 * y3 + z3 * z3);
  return { V: [[0, 0, 0, 1], [sh, 0, 0, c01], [x2, y2, 0, c02], [x3, y3, z3, t3]], z2 };
}
/** The same in R^3 with the given distances. */
function tetraE(d01, d02, d12, d03, d13, d23) {
  const x2 = (d02 * d02 + d01 * d01 - d12 * d12) / (2 * d01), y2 = Math.sqrt(Math.max(1e-300, d02 * d02 - x2 * x2));
  const x3 = (d03 * d03 + d01 * d01 - d13 * d13) / (2 * d01), y3 = (d03 * d03 - d23 * d23 + x2 * x2 + y2 * y2 - 2 * x3 * x2) / (2 * y2);
  const z2 = d03 * d03 - x3 * x3 - y3 * y3;
  return { V: [[0, 0, 0], [d01, 0, 0], [x2, y2, 0], [x3, y3, -Math.sqrt(Math.max(0, z2))]], z2 };
}

/** Hyperboloid points of R^{3,1} moved by the boost that takes their middle (the normalised sum) to (0, 0, 0, 1). */
function centreH(V) {
  let cx = 0, cy = 0, cz = 0, ct = 0;
  for (const v of V) { cx += v[0]; cy += v[1]; cz += v[2]; ct += v[3]; }
  const n = Math.sqrt(Math.max(1e-300, ct * ct - cx * cx - cy * cy - cz * cz));
  cx /= n; cy /= n; cz /= n; ct /= n;
  const k = 1 / (1 + ct);
  return V.map((u) => {
    const dot = cx * u[0] + cy * u[1] + cz * u[2];
    return [u[0] + cx * (dot * k - u[3]), u[1] + cy * (dot * k - u[3]), u[2] + cz * (dot * k - u[3]), ct * u[3] - dot];
  });
}
function centreE(V) {
  const c = [0, 0, 0];
  for (const v of V) for (let a = 0; a < 3; a++) c[a] += v[a] / V.length;
  return V.map((v) => [v[0] - c[0], v[1] - c[1], v[2] - c[2]]);
}

const I9 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mul9 = (A, B) => { const C = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[3 * r + c] = A[3 * r] * B[c] + A[3 * r + 1] * B[3 + c] + A[3 * r + 2] * B[6 + c]; return C; };

/**
 * The solid of a state (see the head of the file). opts.rotation: the rotation (row-major 9) it is drawn with.
 */
export function solidOf(state, opts = {}) {
  const { T, swaps } = reducedTriangulation(state, opts);
  const { kind, G, f, P, q, orders } = T, [i, j, k, l] = f;
  const raw = kind === 'E'
    ? tetraE(q[i][j], q[i][k], q[j][k], q[i][l], q[j][l], q[k][l])
    : tetraH(q[i][j], q[i][k], q[j][k], q[i][l], q[j][l], q[k][l]);
  const C = kind === 'E' ? centreE(raw.V) : centreH(raw.V);         // by position in f
  const V = [null, null, null, null];                               // by feature
  f.forEach((ft, a) => { V[ft] = C[a]; });
  let R = opts.rotation ? Array.from(opts.rotation) : I9();

  /** A vector of the solid's space (R^{3,1} or R^3) as drawn: the ball point (times BALL), turned. */
  const show = (v, out) => {
    let x = v[0], y = v[1], z = v[2];
    if (kind === 'H') { const s = BALL / (1 + v[3]); x *= s; y *= s; z *= s; }
    out[0] = R[0] * x + R[1] * y + R[2] * z; out[1] = R[3] * x + R[4] * y + R[5] * z; out[2] = R[6] * x + R[7] * y + R[8] * z;
    return out;
  };

  const W = wings(T);
  const faces = [
    { f: [i, j, k], P: [P[0], P[1], P[2]] },
    { f: [j, i, l], P: [P[1], P[0], W[0]] },
    { f: [k, j, l], P: [P[2], P[1], W[1]] },
    { f: [i, k, l], P: [P[0], P[2], W[2]] },
  ];
  /** A developed triangle with what it takes to carry a point of it into space. */
  const dev = (ft, pts) => {
    const d = det3(pts[0], pts[1], pts[2]);
    return { f: ft, P: pts, d, next: [null, null, null] };
  };
  faces.forEach((fc, a) => { Object.assign(fc, dev(fc.f, fc.P)); fc.index = a; });
  const home = faces[0];
  const centroid = G.norm([home.P[0][0] + home.P[1][0] + home.P[2][0], home.P[0][1] + home.P[1][1] + home.P[2][1], home.P[0][2] + home.P[1][2] + home.P[2][2]]);

  /** The triangle across the side opposite corner m of a developed triangle (made once, then kept). */
  function across(t, m) {
    if (t.next[m]) return t.next[m];
    const a = (m + 1) % 3, b = (m + 2) % 3, fu = t.f[a], fv = t.f[b], fw = 6 - t.f[0] - t.f[1] - t.f[2];
    const wing = G.third(t.P[a], t.P[b], q[fu][fw], q[fv][fw], false);
    const n = dev([fv, fu, fw], [t.P[b], t.P[a], wing]);
    n.next[2] = t;                                                   // back across the side opposite the wing
    t.next[m] = n;
    return n;
  }
  /** The three side functions of a developed triangle at y: >= 0 inside (each is the barycentric weight times t.d). */
  const sides = (t, y, s) => { s[0] = det3(y, t.P[1], t.P[2]); s[1] = det3(t.P[0], y, t.P[2]); s[2] = det3(t.P[0], t.P[1], y); return s; };

  /**
   * Walk from a point `from` inside the developed triangle t along the straight way to y; returns the triangle that
   * holds y. onCross(point, tOld, tNew) is told every side crossed.
   */
  function walk(t, from, y, onCross) {
    const s0 = [0, 0, 0], s1 = [0, 0, 0];
    let a = from;
    for (let guard = 0; guard < 400; guard++) {
      sides(t, a, s0); sides(t, y, s1);
      const eps = 1e-10 * Math.abs(t.d) * (kind === 'H' ? y[2] : 1);
      let m = -1, tau = Infinity;
      for (let e = 0; e < 3; e++) {
        if (s1[e] >= -eps) continue;
        const den = s0[e] - s1[e], u = den > 0 ? Math.max(0, s0[e]) / den : 0;
        if (u < tau) { tau = u; m = e; }
      }
      if (m < 0) return t;
      const n = across(t, m);
      const x = G.norm([a[0] + tau * (y[0] - a[0]), a[1] + tau * (y[1] - a[1]), a[2] + tau * (y[2] - a[2])]);
      if (onCross) onCross(x, t, n);
      a = x; t = n;
    }
    return t;
  }
  /** The developed triangle that holds y (any lift): from `hint` if given (a triangle found for a near point). */
  function locate(y, hint = null) {
    if (hint) {
      const c = G.norm([hint.P[0][0] + hint.P[1][0] + hint.P[2][0], hint.P[0][1] + hint.P[1][1] + hint.P[2][1], hint.P[0][2] + hint.P[1][2] + hint.P[2][2]]);
      return walk(hint, c, y, null);
    }
    return walk(home, centroid, y, null);
  }
  /** A point y of the developed triangle t, in the solid's space (not yet shown). */
  const lift = (t, y) => {
    const a = det3(y, t.P[1], t.P[2]) / t.d, b = det3(t.P[0], y, t.P[2]) / t.d, c = det3(t.P[0], t.P[1], y) / t.d;
    const A = V[t.f[0]], B = V[t.f[1]], Cc = V[t.f[2]], n = A.length, v = new Array(n);
    for (let e = 0; e < n; e++) v[e] = a * A[e] + b * B[e] + c * Cc[e];
    if (kind === 'H') { const w = Math.sqrt(Math.max(1e-300, v[3] * v[3] - v[0] * v[0] - v[1] * v[1] - v[2] * v[2])); for (let e = 0; e < 4; e++) v[e] /= w; }
    return v;
  };
  function point(y, out = [0, 0, 0], hint = null) {
    const t = locate(y, hint);
    show(lift(t, y), out);
    return t;
  }

  /** The geodesic from a to b of the pair frame, on the solid: n steps, and a point at every edge it crosses. */
  function trace(a, b, n = 48) {
    const pts = [], tmp = [0, 0, 0];
    const push = (t, y) => { show(lift(t, y), tmp); pts.push(tmp[0], tmp[1], tmp[2]); };
    // (a may be a cone point, a corner of many triangles: the walk then turns through them at no cost)
    let prev = a, t = locate(a);
    push(t, a);
    for (let s = 1; s <= n; s++) {
      const y = s === n ? b : G.mix(a, b, s / n);
      t = walk(t, prev, y, (x, tOld) => push(tOld, x));
      push(t, y);
      prev = y;
    }
    return Float32Array.from(pts);
  }

  /** Each face cut into 4^levels triangles by halving its sides; see the head of the file. */
  function mesh(levels = 5) {
    const n = 1 << levels, perFace = ((n + 1) * (n + 2)) / 2, nV = 4 * perFace, nT = 4 * n * n;
    const positions = new Float64Array(3 * nV), triangles = new Uint32Array(3 * nT), corners = new Float64Array(9 * nT), face = new Uint8Array(nT);
    const chart = new Float64Array(3 * nV);                          // every vertex's point of the pair frame
    const id = (a, b) => (a * (2 * n + 3 - a)) / 2 + b;              // row a holds n + 1 - a points: b = 0 .. n - a
    const tmp = [0, 0, 0];
    let tri = 0;
    faces.forEach((fc, fi) => {
      const base = fi * perFace, at = (a, b) => 3 * (base + id(a, b));
      const set = (a, b, p) => { const o = at(a, b); chart[o] = p[0]; chart[o + 1] = p[1]; chart[o + 2] = p[2]; };
      const mid = (a1, b1, a2, b2, a, b) => {
        const o1 = at(a1, b1), o2 = at(a2, b2);
        set(a, b, G.norm([chart[o1] + chart[o2], chart[o1 + 1] + chart[o2 + 1], chart[o1 + 2] + chart[o2 + 2]]));
      };
      // grid point (a, b): a steps toward corner 1, b steps toward corner 2 (corner 0 at (0, 0))
      set(0, 0, fc.P[0]); set(n, 0, fc.P[1]); set(0, n, fc.P[2]);
      for (let s = n; s > 1; s >>= 1) {
        const h = s >> 1;
        for (let a = 0; a < n; a += s) for (let b = 0; a + b < n; b += s) {
          mid(a, b, a + s, b, a + h, b); mid(a, b, a, b + s, a, b + h); mid(a + s, b, a, b + s, a + h, b + h);
        }
      }
      for (let a = 0; a <= n; a++) for (let b = 0; a + b <= n; b++) {
        const o = at(a, b), y = [chart[o], chart[o + 1], chart[o + 2]];
        show(lift(fc, y), tmp);
        positions[o] = tmp[0]; positions[o + 1] = tmp[1]; positions[o + 2] = tmp[2];
      }
      const emit = (v0, v1, v2) => {
        triangles[3 * tri] = v0; triangles[3 * tri + 1] = v1; triangles[3 * tri + 2] = v2;
        for (let c = 0; c < 3; c++) { const o = 3 * [v0, v1, v2][c]; corners[9 * tri + 3 * c] = chart[o]; corners[9 * tri + 3 * c + 1] = chart[o + 1]; corners[9 * tri + 3 * c + 2] = chart[o + 2]; }
        face[tri++] = fi;
      };
      for (let a = 0; a < n; a++) for (let b = 0; a + b < n; b++) {
        emit(base + id(a, b), base + id(a + 1, b), base + id(a, b + 1));
        if (a + b < n - 1) emit(base + id(a + 1, b), base + id(a + 1, b + 1), base + id(a, b + 1));
      }
    });
    return { positions, triangles, corners, face, chart, perFace, n };
  }

  const dist = q.map((row, a) => row.map((v, b) => (a === b ? 0 : G.dist(v))));
  const api = {
    kind, features: f.slice(), orders: orders.slice(), swaps, quantity: q, dist, faces,
    /** the thickness: how far the fourth vertex stands from the plane of the base face (hyperbolic: arsinh of its z) */
    thick: kind === 'E' ? Math.sqrt(Math.max(0, raw.z2)) : Math.asinh(Math.sqrt(Math.max(0, raw.z2))),
    z2: raw.z2,
    get rotation() { return R.slice(); },
    get vertex() { return V.map((v) => show(v, [0, 0, 0])); },
    /** the vertices as the solid's own frame has them (no rotation): for a pose fit */
    get vertex0() { const keep = R; R = I9(); const out = V.map((v) => show(v, [0, 0, 0])); R = keep; return out; },
    rotate(M) { R = mul9(Array.from(M), R); return api; },
    setRotation(M) { R = Array.from(M); return api; },
    locate, point, trace, mesh,
    /** the geometry's helpers, for callers that sample curves: mix(u, v, t), q(u, v), norm(v) */
    G,
  };
  return api;
}
