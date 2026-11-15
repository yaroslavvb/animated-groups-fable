p = 'design.js'
s = open(p).read()
a = s.index("/** The spine of a stroke: n + 1 points at equal steps of its length. { x, y, len } */")
b = s.index("/** The bumps of a stroke:")
new = r'''/**
 * A point of the clamped uniform cubic B-spline of the control points P = [x0, y0, x1, y1, ...] (four points: the cubic
 * Bezier curve of them), at u in [0, points - 3]. de Boor's algorithm.
 */
function splineAt(P, u, out) {
  const n = P.length / 2, segs = n - 3, knot = (i) => Math.min(segs, Math.max(0, i - 3));
  const j = Math.min(segs - 1, Math.max(0, Math.floor(u))) + 3;
  const dx = [P[2 * j - 6], P[2 * j - 4], P[2 * j - 2], P[2 * j]], dy = [P[2 * j - 5], P[2 * j - 3], P[2 * j - 1], P[2 * j + 1]];
  for (let r = 1; r <= 3; r++) for (let i = 3; i >= r; i--) {
    const g = j - 3 + i, a = (u - knot(g)) / (knot(g + 4 - r) - knot(g));
    dx[i] = (1 - a) * dx[i - 1] + a * dx[i]; dy[i] = (1 - a) * dy[i - 1] + a * dy[i];
  }
  out[0] = dx[3]; out[1] = dy[3];
  return out;
}

/** The spine of a stroke: n + 1 points at equal steps of its length. { x, y, len } */
export function spine(k, n = 256) {
  const P = k.p, segs = P.length / 2 - 3, M = 4 * n, o = [0, 0];
  const bx = new Float64Array(M + 1), by = new Float64Array(M + 1), cum = new Float64Array(M + 1);
  for (let m = 0; m <= M; m++) {
    splineAt(P, (segs * m) / M, o);
    bx[m] = o[0]; by[m] = o[1];
    if (m) cum[m] = cum[m - 1] + Math.hypot(bx[m] - bx[m - 1], by[m] - by[m - 1]);
  }
  const len = cum[M], x = new Float64Array(n + 1), y = new Float64Array(n + 1);
  for (let i = 0, m = 0; i <= n; i++) {
    const want = (i / n) * len;
    while (m < M - 1 && cum[m + 1] < want) m++;
    const f = cum[m + 1] > cum[m] ? Math.min(1, Math.max(0, (want - cum[m]) / (cum[m + 1] - cum[m]))) : 0;
    x[i] = bx[m] + f * (bx[m + 1] - bx[m]); y[i] = by[m] + f * (by[m + 1] - by[m]);
  }
  return { x, y, len, n };
}

'''
s = s[:a] + new + s[b:]
old = """ *   p           the spine, a cubic Bezier curve: [x0, y0, x1, y1, x2, y2, x3, y3], from the head end to the tail's tip"""
new = """ *   p           the spine, from the head end to the tail's tip: the control points [x0, y0, x1, y1, ...] of a clamped
 *               cubic B-spline (four points: a cubic Bezier curve; six: a curve that can go once round a tile)"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
