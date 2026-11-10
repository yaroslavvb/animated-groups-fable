// geom.js — plane isometries and small 2D helpers. Plain ES module, no dependencies.
// World plane: x to the right, y up. An isometry g is {a,b,c,d,tx,ty}:
//   g(x, y) = (a*x + b*y + tx, c*x + d*y + ty),  with [[a,b],[c,d]] orthogonal.

export const EPS = 1e-9;

export function iso(a, b, c, d, tx = 0, ty = 0) { return { a, b, c, d, tx, ty }; }
export const IDENT = Object.freeze(iso(1, 0, 0, 1, 0, 0));

export function trans(tx, ty) { return iso(1, 0, 0, 1, tx, ty); }

/** Rotation by angle theta (radians, counter-clockwise) about the point (cx, cy). */
export function rot(theta, cx = 0, cy = 0) {
  const a = Math.cos(theta), c = Math.sin(theta), b = -c, d = a;
  return iso(a, b, c, d, cx - a * cx - b * cy, cy - c * cx - d * cy);
}

/** Rotation by 2*pi/n about (cx, cy). */
export function rotN(n, cx = 0, cy = 0) { return rot((2 * Math.PI) / n, cx, cy); }

/** Reflection across the line through (px, py) whose direction makes angle ang (radians) with +x. */
export function refl(px, py, ang) {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const a = 2 * ux * ux - 1, b = 2 * ux * uy, c = b, d = 2 * uy * uy - 1;
  return iso(a, b, c, d, px - a * px - b * py, py - c * px - d * py);
}

/** Reflection across the line through the two points p and q. */
export function reflThrough(p, q) {
  return refl(p[0], p[1], Math.atan2(q[1] - p[1], q[0] - p[0]));
}

/** Glide: reflect across the line through (px,py) with direction angle ang, then translate dist along it. */
export function glide(px, py, ang, dist) {
  const g = refl(px, py, ang);
  g.tx += dist * Math.cos(ang);
  g.ty += dist * Math.sin(ang);
  return g;
}

/** compose(g, h) = g∘h : x -> g(h(x)). */
export function compose(g, h) {
  return iso(
    g.a * h.a + g.b * h.c, g.a * h.b + g.b * h.d,
    g.c * h.a + g.d * h.c, g.c * h.b + g.d * h.d,
    g.a * h.tx + g.b * h.ty + g.tx, g.c * h.tx + g.d * h.ty + g.ty);
}

export function inverse(g) {
  // linear part is orthogonal: inverse = transpose
  return iso(g.a, g.c, g.b, g.d, -(g.a * g.tx + g.c * g.ty), -(g.b * g.tx + g.d * g.ty));
}

/** Apply g to (x, y); writes into out (array of length >= 2) and returns it. */
export function apply(g, x, y, out = [0, 0]) {
  out[0] = g.a * x + g.b * y + g.tx;
  out[1] = g.c * x + g.d * y + g.ty;
  return out;
}

export function det(g) { return g.a * g.d - g.b * g.c; }

export function isoEquals(g, h, eps = 1e-7) {
  return Math.abs(g.a - h.a) < eps && Math.abs(g.b - h.b) < eps && Math.abs(g.c - h.c) < eps &&
    Math.abs(g.d - h.d) < eps && Math.abs(g.tx - h.tx) < eps && Math.abs(g.ty - h.ty) < eps;
}

export function isIdentity(g, eps = 1e-7) { return isoEquals(g, IDENT, eps); }

/**
 * Classify an isometry.
 * Returns one of
 *   {type:'identity'}
 *   {type:'translation', vec:[tx,ty]}
 *   {type:'rotation', angle, order, center:[x,y]}          (order = smallest n in {2,3,4,6,...} with n*angle = 0 mod 2pi)
 *   {type:'reflection', point:[x,y], dir:[ux,uy]}          (the mirror line passes through point with unit direction dir)
 *   {type:'glide', point:[x,y], dir:[ux,uy], dist}         (axis through point; translation dist*dir along it, dist may be negative)
 */
export function classify(g, eps = 1e-7) {
  const D = det(g);
  if (D > 0) {
    if (Math.abs(g.a - 1) < eps && Math.abs(g.b) < eps) {
      if (Math.abs(g.tx) < eps && Math.abs(g.ty) < eps) return { type: 'identity' };
      return { type: 'translation', vec: [g.tx, g.ty] };
    }
    const angle = Math.atan2(g.c, g.a);
    // centre solves (I - L) x = t
    const m00 = 1 - g.a, m01 = -g.b, m10 = -g.c, m11 = 1 - g.d;
    const dd = m00 * m11 - m01 * m10;
    const cx = (g.tx * m11 - m01 * g.ty) / dd, cy = (m00 * g.ty - m10 * g.tx) / dd;
    let order = 0;
    for (let n = 2; n <= 12; n++) {
      const k = (n * angle) / (2 * Math.PI);
      if (Math.abs(k - Math.round(k)) < 1e-6) { order = n; break; }
    }
    return { type: 'rotation', angle, order, center: [cx, cy] };
  }
  // orientation reversing: axis direction is the +1 eigenvector of the linear part
  const half = Math.atan2(g.c, g.a) / 2;
  const ux = Math.cos(half), uy = Math.sin(half);
  const par = g.tx * ux + g.ty * uy;
  const px = (g.tx - par * ux) / 2, py = (g.ty - par * uy) / 2;
  if (Math.abs(par) < eps) return { type: 'reflection', point: [px, py], dir: [ux, uy] };
  return { type: 'glide', point: [px, py], dir: [ux, uy], dist: par };
}

// ---- small vector helpers -------------------------------------------------

export function cross2(ax, ay, bx, by) { return ax * by - ay * bx; }
export function dist2(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

/** Signed area of a polygon given as [[x,y],...] (positive when counter-clockwise). */
export function polyArea(poly) {
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    s += p[0] * q[1] - p[1] * q[0];
  }
  return s / 2;
}

export function polyCentroid(poly) {
  let cx = 0, cy = 0, s = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const w = p[0] * q[1] - p[1] * q[0];
    cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w; s += w;
  }
  return [cx / (3 * s), cy / (3 * s)];
}

/**
 * Clip a convex polygon [[x,y],...] by the half-plane n·x <= c (n = [nx,ny]).
 * Returns a new polygon (possibly empty). eps keeps points on the line.
 */
export function clipHalfPlane(poly, nx, ny, c, eps = 1e-12) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const sp = nx * p[0] + ny * p[1] - c, sq = nx * q[0] + ny * q[1] - c;
    const pin = sp <= eps, qin = sq <= eps;
    if (pin) out.push(p);
    if (pin !== qin) {
      const t = sp / (sp - sq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}
