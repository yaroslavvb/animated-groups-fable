// flat2222.js — the flat orbifold 2222 in space, exactly: the solid of Twist of 2222 (a disphenoid: a tetrahedron
// whose opposite edges are equal; a doubled rectangle or parallelogram when it is flat). No solver.
// Pure: no DOM, no imports.
//
// The first block is COPIED from his own module
//   gyroscope/reports/2026-11/2026-11-24-twist-of-2222/src/twist2222.js   (comb, coords2, dot2, lattice,
//   reduceSuperbase, solid, toStage, mapF)
// unchanged in what it computes. The second block is the map of pillow-math NOTES § 5.1 from the pillows' chart
// onto that solid, in the page's world frame.
//
// Convention (math-2222.md "2222-LT", the engine's pillowCentered): area 2; ell = L = |AB| (HALF the loop);
// centres A = (0, 0), B = (ell, 0), C = (s, w), D = (s + ell, w) with w = 1 / ell, s = 2 ell tw.
//
// EXPORTS
//   flatSolid(L, tw, { cut })         the solid and the pose: { S, L, tw, cut, cuff, thP, sP, turnOver, corners }
//   flatPoint(F, theta, s, out)       the point of space of the orbifold-chart point (s, theta)
//   flatFace(F, theta, s)             which of the solid's four faces holds it (a key; for tests);  flatCell: the lattice triangle
//   flatPositions(F, mesh)            { closed: Float64Array (3 per closed vertex), open: Float64Array (3 per open vertex) }
//                                     for a pillow.js mesh of the same (L, tw): the closed solid; the two copies of a
//                                     seal vertex are one point
//   flatCrossings(F, th0, s0, th1, s1) where a straight chart segment meets the solid's creases
//   flatSealAngle(F)                  the angle between the seals P -> Q and R -> S, degrees
//   solid, mapF, toStage, reduceSuperbase, lattice     the copied functions

// ---- copied from twist2222.js ---------------------------------------------------------------------------------------
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
const det2 = (a, b) => a[0] * b[1] - a[1] * b[0];
const comb = (r, e) => [r[0] * e[0][0] + r[1] * e[1][0], r[0] * e[0][1] + r[1] * e[1][1]];

function coords2(p, u1, u2) {
  const d = det2(u1, u2);
  return [det2(p, u2) / d, det2(u1, p) / d];
}

export function lattice(ell, t) {
  const w = 1 / ell;
  const s = 2 * ell * t;
  return {
    ell, t, w, s,
    A: [0, 0], B: [ell, 0], C: [s, w], D: [s + ell, w],
    e1: [ell, 0], e2: [s, w],
    a: [2 * ell, 0], b: [2 * s, 2 * w],
  };
}

export function reduceSuperbase(e1, e2, tol = 1e-13) {
  let va = [1, 0], vb = [0, 1], vc = [-1, -1];
  const e = [e1, e2];
  const ineg = (a) => [a[0] ? -a[0] : 0, a[1] ? -a[1] : 0];
  const iz = (x) => (x === 0 ? 0 : x);
  const isub = (a, b) => [iz(a[0] - b[0]), iz(a[1] - b[1])];
  for (let iter = 0; iter < 100000; iter++) {
    const A = comb(va, e), B = comb(vb, e), C = comb(vc, e);
    if (dot2(A, B) > tol) {
      [va, vb, vc] = [va, ineg(vb), isub(vb, va)];
    } else if (dot2(A, C) > tol) {
      [va, vb, vc] = [va, isub(vc, va), ineg(vc)];
    } else if (dot2(B, C) > tol) {
      [va, vb, vc] = [isub(vc, vb), vb, ineg(vc)];
    } else {
      return { R: [va, vb, vc], flips: iter };
    }
  }
  throw new Error('reduceSuperbase did not converge');
}

export function solid(ell, t, { tol = 1e-13, minConorm = 0 } = {}) {
  const lat = lattice(ell, t);
  const e1 = lat.e1, e2 = lat.e2;
  const { R, flips } = reduceSuperbase(e1, e2, tol);
  const [[ma, na], [mb, nb]] = R;
  const va = comb(R[0], [e1, e2]);
  const vb = comb(R[1], [e1, e2]);
  const vc = comb(R[2], [e1, e2]);
  const X = -dot2(vb, vc);
  const Y = -dot2(va, vc);
  const Z = -dot2(va, vb);
  const sigma = ma * nb - na * mb;
  const ex = ((na >> 1) & 1) ? -1 : 1;
  const ey = ((mb >> 1) & 1) ? -1 : 1;
  const ez = sigma * ex * ey;

  const Xd = Math.max(X, minConorm);
  const Yd = Math.max(Y, minConorm);
  const Zd = Math.max(Z, minConorm);
  const x = ex * Math.sqrt(Xd);
  const y = ey * Math.sqrt(Yd);
  const z = ez * Math.sqrt(Zd);
  const box = {
    A: [-x / 2, -y / 2, -z / 2],
    B: [-x / 2, y / 2, z / 2],
    C: [x / 2, -y / 2, z / 2],
    D: [x / 2, y / 2, -z / 2],
  };
  const r = Math.sqrt(Yd + Zd);
  const cph = (Yd - Zd) / (Yd + Zd);
  const sph = (-2 * sigma * ex * Math.sqrt(Yd * Zd)) / (Yd + Zd);
  const abf = {
    A: [-x / 2, -r / 2, 0],
    B: [-x / 2, r / 2, 0],
    C: [x / 2, -(r / 2) * cph, -(r / 2) * sph],
    D: [x / 2, (r / 2) * cph, (r / 2) * sph],
  };
  return {
    lat, R, flips, va, vb, vc,
    X, Y, Z, sigma, ex, ey, ez,
    x, y, z, r, cph, sph,
    box, abf,
  };
}

// Stage display coordinates: (x_stage, y_stage, z_stage) = (Y_abf, Z_abf, X_abf)
export const toStage = (p) => [p[1], p[2], p[0]];

// Plane point p (in pair's lattice coordinates, origin A at (0,0)) -> solid vertex in `frame` ('abf' or 'box').
export function mapF(p, S, frame = 'abf') {
  const [al, be] = coords2(p, S.va, S.vb);
  const i = Math.floor(al), j = Math.floor(be);
  const fa = al - i, fb = be - j;
  let corners, wts;
  if (fa >= fb) {
    corners = [[i, j], [i + 1, j], [i + 1, j + 1]];
    wts = [1 - fa, fa - fb, fb];
  } else {
    corners = [[i, j], [i + 1, j + 1], [i, j + 1]];
    wts = [1 - fb, fa, fb - fa];
  }
  const V = S[frame];
  const names = corners.map(([ci, cj]) => 'ABCD'[(ci & 1) + 2 * (cj & 1)]);
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const vk = V[names[k]];
    out[0] += wts[k] * vk[0];
    out[1] += wts[k] * vk[1];
    out[2] += wts[k] * vk[2];
  }
  return out;
}

// ---- the pillows' chart onto the solid (pillow-math NOTES § 5.1) ----------------------------------------------------
//
// The orbifold chart of pillow.js: the loop is s = 0, {P, Q} on s < 0 at theta = -+ cuff/4, cuff = 2 L; the rows are
// 1 / L apart and the loop sits at the share `cut` of the way (the engine: 1/2), so s_P = -cut / L.
//   plane point (A at the origin) = (theta - theta_P, s - s_P);   q = toStage(mapF(plane point));   point = (-q[1], q[0], q[2])
// The last step is a quarter turn about the vertical: the seal PQ lies along y with P at -y, as on the crowns; the
// loop is level at z = 0 (cut 1/2). Where the solid comes out with the first pair on top, it is turned over about
// the y axis (a half turn: the seal PQ stays where it is), so that the first pair is always below.

/** The solid of the engine's state (L = |AB|, tw) and its pose. */
export function flatSolid(L, tw, { cut = 0.5, minConorm = 0 } = {}) {
  // minConorm > 0 gives a flat state a little thickness, as Twist of 2222 draws it (4e-4 there); 0 is exact
  const S = solid(L, tw, { minConorm }), cuff = 2 * L, thP = -cuff / 4, sP = -cut / L;
  const F = { S, L, tw, cut, cuff, thP, sP, turnOver: false, corners: null };
  F.turnOver = S.abf.A[0] > 0;                       // X_abf is the height: the first pair must be below
  const pt = (nm) => place(F, S.abf[nm], [0, 0, 0]);
  F.corners = { P: pt('A'), Q: pt('B'), R: pt('C'), S: pt('D') };
  return F;
}

function place(F, abf, out) {
  // toStage: (Y_abf, Z_abf, X_abf); then (x, y, z) = (-q[1], q[0], q[2]) = (-Z_abf, Y_abf, X_abf)
  const x = -abf[2], y = abf[1], z = abf[0];
  if (F.turnOver) { out[0] = -x; out[1] = y; out[2] = -z; } else { out[0] = x; out[1] = y; out[2] = z; }
  return out;
}

/** The point of space of the orbifold-chart point (s, theta) (theta may be any lift). */
export function flatPoint(F, theta, s, out = [0, 0, 0]) {
  return place(F, mapF([theta - F.thP, s - F.sP], F.S), out);
}

/** A key of the face of the solid (one of four) that holds the chart point; a point on a crease gets either side's. */
export function flatFace(F, theta, s) {
  const [al, be] = coords2([theta - F.thP, s - F.sP], F.S.va, F.S.vb);
  const i = Math.floor(al), j = Math.floor(be), lower = al - i >= be - j;
  // the face is named by its three corners' kinds; the kinds of a triangle's corners depend on the parities only
  return `${i & 1}${j & 1}${lower ? 'a' : 'b'}`;
}

/** The same, exactly: [i, j, lower] of the triangle of the reduced lattice that holds the chart point (this lift). */
export function flatCell(F, theta, s) {
  const [al, be] = coords2([theta - F.thP, s - F.sP], F.S.va, F.S.vb);
  const i = Math.floor(al), j = Math.floor(be);
  return [i, j, al - i >= be - j ? 1 : 0];
}

/**
 * The creases that the straight chart segment from (s0, theta0) to (s1, theta1) crosses (the lifts as given): a list
 * of t in (0, 1), the share of the way at which each of the solid's fold lines is met. Empty: the segment lies in
 * one face, and its chord on the solid has its own length.
 */
export function flatCrossings(F, theta0, s0, theta1, s1, eps = 1e-9) {
  const va = F.S.va, vb = F.S.vb;
  const [a0, b0] = coords2([theta0 - F.thP, s0 - F.sP], va, vb), [a1, b1] = coords2([theta1 - F.thP, s1 - F.sP], va, vb);
  const out = [];
  // the lines al = n run along vb, be = n along va, al - be = n along vc. A line along one of the three is a fold
  // unless the other two are square to each other (their conorm is 0): then the solid is flat there
  const folds = [F.S.Y > 1e-12, F.S.X > 1e-12, F.S.Z > 1e-12];
  const fam = [[a0, a1], [b0, b1], [a0 - b0, a1 - b1]];
  for (let k = 0; k < 3; k++) {
    if (!folds[k]) continue;
    const [f0, f1] = fam[k];
    const lo = Math.min(f0, f1), hi = Math.max(f0, f1);
    for (let n = Math.ceil(lo + eps); n <= Math.floor(hi - eps); n++) out.push((n - f0) / (f1 - f0));
  }
  return out;
}

/**
 * The closed solid on a pillow.js mesh of 2222 at the same (L, tw):
 * closed[3 v] for the closed vertices, open[3 v] for the open ones (the two copies of a seal vertex are one point).
 */
export function flatPositions(F, mesh, out = {}) {
  const o = mesh.open, nO = o.nVertices, nC = mesh.nVertices;
  const open = out.open && out.open.length === 3 * nO ? out.open : new Float64Array(3 * nO);
  const closed = out.closed && out.closed.length === 3 * nC ? out.closed : new Float64Array(3 * nC);
  const p = [0, 0, 0];
  for (let v = 0; v < nO; v++) { flatPoint(F, o.theta[v], o.s[v], p); open[3 * v] = p[0]; open[3 * v + 1] = p[1]; open[3 * v + 2] = p[2]; }
  for (let v = 0; v < nC; v++) { flatPoint(F, mesh.theta[v], mesh.s[v], p); closed[3 * v] = p[0]; closed[3 * v + 1] = p[1]; closed[3 * v + 2] = p[2]; }
  out.open = open; out.closed = closed;
  return out;
}

/** The angle between the two seals, P -> Q against R -> S, in degrees (0..180). */
export function flatSealAngle(F) {
  const { P, Q, R, S } = F.corners;
  const a = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]], b = [S[0] - R[0], S[1] - R[1], S[2] - R[2]];
  const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** The six distances between the corners: { PQ, RS, PR, QS, PS, QR }. */
export function flatTipDistances(F) {
  const c = F.corners, d = (a, b) => Math.hypot(c[a][0] - c[b][0], c[a][1] - c[b][1], c[a][2] - c[b][2]);
  return { PQ: d('P', 'Q'), RS: d('R', 'S'), PR: d('P', 'R'), QS: d('Q', 'S'), PS: d('P', 'S'), QR: d('Q', 'R') };
}
