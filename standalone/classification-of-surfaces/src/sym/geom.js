// geom.js — the three geometries a repeating pattern can live in, behind one small interface.
//
//   S  the sphere            points are unit vectors (x, y, z)
//   E  the Euclidean plane   points are (x, y, 1)
//   H  the hyperbolic plane  points are on the hyperboloid x^2 + y^2 - z^2 = -1, z > 0
//
// In all three a symmetry is a 3 x 3 matrix (flat, row-major, 9 numbers) acting on those vectors, so the code that
// builds a group and draws its pattern does not care which one it is in. geometry(kind) returns:
//   polar(d, th)             the point at distance d from the origin (0, 0, 1) in the direction th
//   dist(a, b), mix(a, b, t) distance, and the point a fraction t of the way along the straight line from a to b
//   fit(a0, a1, b0, b1, rev) the motion that takes the segment a0 -> a1 onto b0 -> b1; rev: it also turns the plane over
//   reflect(a, b)            the mirror in the line through a and b
//   rotate(p, ang)           the turn about p (counter-clockwise seen from outside / above)
//   translate(a, b)          the slide along the line a b that takes a to b
//   angle(p, a, b)           the angle at p between the directions to a and to b
//   lineDist(p, a, b)        the distance from p to the whole line through a and b
//   fix(M)                   M put back onto the group of motions (after many products it has drifted off)

export const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export function mul(A, B) {
  const C = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[3 * r + c] = A[3 * r] * B[c] + A[3 * r + 1] * B[3 + c] + A[3 * r + 2] * B[6 + c];
  return C;
}
export const apply = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
export const det = (M) => M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);
export function inv(M) {
  const d = det(M);
  return [
    (M[4] * M[8] - M[5] * M[7]) / d, (M[2] * M[7] - M[1] * M[8]) / d, (M[1] * M[5] - M[2] * M[4]) / d,
    (M[5] * M[6] - M[3] * M[8]) / d, (M[0] * M[8] - M[2] * M[6]) / d, (M[2] * M[3] - M[0] * M[5]) / d,
    (M[3] * M[7] - M[4] * M[6]) / d, (M[1] * M[6] - M[0] * M[7]) / d, (M[0] * M[4] - M[1] * M[3]) / d,
  ];
}
const cols = (t, n, p) => [t[0], n[0], p[0], t[1], n[1], p[1], t[2], n[2], p[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function geometry(kind) {
  const sgn = kind === 'S' ? 1 : kind === 'H' ? -1 : 0;
  const form = (u, v) => u[0] * v[0] + u[1] * v[1] + sgn * u[2] * v[2];
  const G = { kind, sgn, origin: [0, 0, 1], form };

  G.norm = (v) => {
    if (kind === 'E') return [v[0] / v[2], v[1] / v[2], 1];
    const l = Math.sqrt(Math.abs(form(v, v))) || 1, s = v[2] < 0 && kind === 'H' ? -1 : 1;
    return [(s * v[0]) / l, (s * v[1]) / l, (s * v[2]) / l];
  };
  G.polar = (d, th) => {
    const c = Math.cos(th), s = Math.sin(th);
    if (kind === 'S') return [Math.sin(d) * c, Math.sin(d) * s, Math.cos(d)];
    if (kind === 'H') return [Math.sinh(d) * c, Math.sinh(d) * s, Math.cosh(d)];
    return [d * c, d * s, 1];
  };
  // through the chord (the difference vector): exact for near points, where acos and acosh of the product lose half the digits
  G.dist = (a, b) => {
    const d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    if (kind === 'S') return 2 * Math.asin(Math.min(1, Math.hypot(d[0], d[1], d[2]) / 2));
    if (kind === 'H') return 2 * Math.asinh(Math.sqrt(Math.max(0, form(d, d))) / 2);
    return Math.hypot(d[0], d[1]);
  };
  G.mix = (a, b, t) => G.norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);

  /** The unit tangent at p that points toward q. */
  G.toward = (p, q) => {
    let t;
    if (kind === 'E') t = [q[0] - p[0], q[1] - p[1], 0];
    else { const k = form(q, p) / form(p, p); t = [q[0] - k * p[0], q[1] - k * p[1], q[2] - k * p[2]]; }
    const l = Math.sqrt(Math.max(1e-300, kind === 'E' ? t[0] * t[0] + t[1] * t[1] : form(t, t)));
    return [t[0] / l, t[1] / l, t[2] / l];
  };
  /** The frame at p whose first axis points toward q: the matrix with columns (tangent, left normal, p). */
  G.frame = (p, q) => {
    const t = G.toward(p, q);
    let n;
    if (kind === 'E') n = [-t[1], t[0], 0];
    else { n = cross(p, t); if (kind === 'H') n[2] = -n[2]; }
    return cols(t, n, p);
  };
  G.fit = (a0, a1, b0, b1, rev = false) => mul(mul(G.frame(b0, b1), [1, 0, 0, 0, rev ? -1 : 1, 0, 0, 0, 1]), inv(G.frame(a0, a1)));
  G.reflect = (a, b) => G.fit(a, b, a, b, true);
  G.rotate = (p, ang) => {
    const q = G.dist(p, G.origin) > 1e-3 ? G.origin : G.polar(0.5, 0), F = G.frame(p, q), c = Math.cos(ang), s = Math.sin(ang);
    return mul(mul(F, [c, -s, 0, s, c, 0, 0, 0, 1]), inv(F));
  };
  G.translate = (a, b) => {
    if (G.dist(a, b) < 1e-12) return I3.slice();
    return mul(mul(G.frame(b, a), [-1, 0, 0, 0, -1, 0, 0, 0, 1]), inv(G.frame(a, b)));
  };
  G.angle = (p, a, b) => {
    const ta = G.toward(p, a), tb = G.toward(p, b);
    return Math.acos(clamp(kind === 'E' ? ta[0] * tb[0] + ta[1] * tb[1] : form(ta, tb), -1, 1));
  };
  G.lineDist = (p, a, b) => {
    const F = G.frame(a, b), n = [F[1], F[4], F[7]];
    if (kind === 'E') return Math.abs((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]);
    const s = Math.abs(form(p, n));
    return kind === 'S' ? Math.asin(clamp(s, 0, 1)) : Math.asinh(s);
  };
  /** The foot of the perpendicular from p onto the line through a and b. */
  G.foot = (p, a, b) => {
    const F = G.frame(a, b), n = [F[1], F[4], F[7]];
    if (kind === 'E') { const s = (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]; return [p[0] - s * n[0], p[1] - s * n[1], 1]; }
    const s = form(p, n);
    return G.norm([p[0] - s * n[0], p[1] - s * n[1], p[2] - s * n[2]]);
  };
  /**
   * The exact motion nearest to a matrix that is one up to rounding. Products of many motions drift off the group
   * (on the hyperbolic plane the drift grows like e^distance); this puts a matrix back: where the origin goes, which
   * way the x direction goes, and whether the plane is turned over are kept, the rest is rebuilt.
   */
  G.fix = (M) => {
    const sign = det(M) < 0 ? -1 : 1;
    if (kind === 'E') { const l = Math.hypot(M[0], M[3]) || 1, a = M[0] / l, c = M[3] / l; return [a, -sign * c, M[2], c, sign * a, M[5], 0, 0, 1]; }
    const p = G.norm([M[2], M[5], M[8]]);
    let t = [M[0], M[3], M[6]];
    const k = form(t, p) / form(p, p);
    t = [t[0] - k * p[0], t[1] - k * p[1], t[2] - k * p[2]];
    const l = Math.sqrt(Math.max(1e-300, form(t, t)));
    t = [t[0] / l, t[1] / l, t[2] / l];
    const n = cross(p, t);
    if (kind === 'H') n[2] = -n[2];
    return cols(t, [sign * n[0], sign * n[1], sign * n[2]], p);
  };
  /** Area of a convex polygon (counter-clockwise vertices). */
  G.area = (verts) => {
    const n = verts.length;
    if (kind === 'E') { let a = 0; for (let i = 0; i < n; i++) { const p = verts[i], q = verts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
    let sum = 0;
    for (let i = 0; i < n; i++) sum += G.angle(verts[i], verts[(i + n - 1) % n], verts[(i + 1) % n]);
    return kind === 'S' ? sum - (n - 2) * Math.PI : (n - 2) * Math.PI - sum;
  };
  return G;
}

/** Which geometry a polygon with these interior angles lives in (by its angle sum). */
export function kindOfAngles(angles) {
  const excess = angles.reduce((s, a) => s + a, 0) - (angles.length - 2) * Math.PI;
  return excess > 1e-9 ? 'S' : excess < -1e-9 ? 'H' : 'E';
}
