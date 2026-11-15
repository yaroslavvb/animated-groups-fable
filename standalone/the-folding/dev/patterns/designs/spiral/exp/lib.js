// exp/lib.js — the helpers of the curl prototypes (copied from design.v1.js, exported).
import { buildDomain } from '../../../../../src/domain.js';

export const TAU = 2 * Math.PI;
export const SEEDS = {
  'o': [0, 0], '2222': [-0.25, -0.25], '**': [0, 0], 'xx': [-0.125, 0], '*x': [0, 0], '333': [0, -0.5], '22x': [-0.25, 0],
  '22*': [0, -0.125], '*2222': [-0.25, -0.25], '2*22': [-0.125, -0.125], '442': [0, -0.25],
  '632': [-0.0866025404, -0.3267949192], '3*3': [-0.0577350269, -0.3845299462], '*333': [0, -1 / 3], '4*2': [-0.15, -0.15],
  '*442': [-1 / 3, -1 / 6], '*632': [-1 / 9, -5 / 18],
};
export function tilePolygon(group) {
  const pre = group.presets && group.presets[0];
  const { e1, e2 } = group, center = group.center || [(e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2];
  let seed, metric;
  if (pre) { seed = pre.seed; metric = pre.metric; } else {
    const st = SEEDS[group.id] || [0, 0];
    seed = [center[0] + st[0] * e1[0] + st[1] * e2[0], center[1] + st[0] * e1[1] + st[1] * e2[1]];
    if (group.reps.length === 1) {
      const det = e1[0] * e2[1] - e1[1] * e2[0], r0 = [e2[1] / det, -e2[0] / det], r1 = [-e1[1] / det, e1[0] / det];
      metric = [r0[0] * r0[0] + r1[0] * r1[0], r0[0] * r0[1] + r1[0] * r1[1], r0[1] * r0[1] + r1[1] * r1[1]];
    }
  }
  let d;
  try { d = buildDomain(group, { seed, metric }); } catch (e) { d = buildDomain(group, { seed: [center[0] + 0.137 * e1[0] + 0.071 * e2[0], center[1] + 0.137 * e1[1] + 0.071 * e2[1]] }); }
  return d.poly.map((p) => [p[0], p[1]]);
}
export function sidesOf(poly0, eps) {
  const poly = [];
  for (let i = 0; i < poly0.length; i++) { const a = poly0[i], b = poly0[(i + 1) % poly0.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) > eps) poly.push([a[0], a[1]]); }
  const S = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    const nx = dy / len, ny = -dx / len;
    S.push({ nx, ny, h: nx * a[0] + ny * a[1], len, ang: Math.atan2(ny, nx) });
  }
  return { poly, S };
}
export function insetPolygon(poly, S, d) {
  let P = poly.map((p) => [p[0], p[1]]);
  for (const s of S) {
    const c = s.h - d, Q = [];
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length];
      const sp = s.nx * p[0] + s.ny * p[1] - c, sq = s.nx * q[0] + s.ny * q[1] - c;
      if (sp <= 0) Q.push(p);
      if ((sp <= 0) !== (sq <= 0)) { const w = sp / (sp - sq); Q.push([p[0] + w * (q[0] - p[0]), p[1] + w * (q[1] - p[1])]); }
    }
    P = Q;
    if (P.length < 3) break;
  }
  return P;
}
export function shapeOf(poly) {
  let A = 0, cx = 0, cy = 0, ixx = 0, iyy = 0, ixy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], w = p[0] * q[1] - q[0] * p[1];
    A += w; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w;
    ixx += (p[0] * p[0] + p[0] * q[0] + q[0] * q[0]) * w; iyy += (p[1] * p[1] + p[1] * q[1] + q[1] * q[1]) * w;
    ixy += (p[0] * q[1] + 2 * p[0] * p[1] + 2 * q[0] * q[1] + q[0] * p[1]) * w;
  }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  const sxx = ixx / (12 * A) - cx * cx, syy = iyy / (12 * A) - cy * cy, sxy = ixy / (24 * A) - cx * cy;
  const mean = (sxx + syy) / 2, dev = Math.hypot((sxx - syy) / 2, sxy);
  const aspect = Math.sqrt((mean + dev) / Math.max(1e-12 * mean, mean - dev));
  return { cx, cy, aspect, angle: aspect > 1 + 1e-6 ? 0.5 * Math.atan2(2 * sxy, sxx - syy) : 0, area: A };
}
export function chebyshev(S, scale) {
  const n = S.length, tol = 1e-9 * scale;
  let best = -1; const sols = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const a = S[i], b = S[j], c = S[k];
    const det = a.nx * (b.ny - c.ny) - a.ny * (b.nx - c.nx) + (b.nx * c.ny - b.ny * c.nx);
    if (Math.abs(det) < 1e-9) continue;
    const x = (a.h * (b.ny - c.ny) - a.ny * (b.h - c.h) + (b.h * c.ny - b.ny * c.h)) / det;
    const y = (a.nx * (b.h - c.h) - a.h * (b.nx - c.nx) + (b.nx * c.h - b.h * c.nx)) / det;
    const r = a.h - a.nx * x - a.ny * y;
    if (r <= 0) continue;
    let ok = true;
    for (const s of S) if (s.nx * x + s.ny * y + r > s.h + tol) { ok = false; break; }
    if (!ok) continue;
    sols.push([x, y, r]);
    if (r > best) best = r;
  }
  let cx = 0, cy = 0, m = 0;
  for (const s of sols) if (s[2] > best - 1e-7 * scale) { cx += s[0]; cy += s[1]; m++; }
  return { r: best, cx: cx / m, cy: cy / m };
}
export function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
export function smax(a, b, k) { return -smin(-a, -b, k); }
export function sdConvex(P, x, y) {
  let d2 = Infinity, out = false;
  for (let i = 0, n = P.length; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey;
    let t = l2 > 0 ? ((x - a[0]) * ex + (y - a[1]) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - a[0] - t * ex, dy = y - a[1] - t * ey, q = dx * dx + dy * dy;
    if (q < d2) d2 = q;
    if (ex * (y - a[1]) - ey * (x - a[0]) < 0) out = true;
  }
  return out ? Math.sqrt(d2) : -Math.sqrt(d2);
}
export function traceLoops(F, nx, ny, x0, y0, g) {
  const H = (i, j) => 2 * (j * nx + i), V = (i, j) => 2 * (j * nx + i) + 1;
  const next = new Map(), pos = new Map();
  const at = (k) => {
    if (pos.has(k)) return;
    const c = k >> 1, i = c % nx, j = (c - i) / nx, f0 = F[c], f1 = k & 1 ? F[c + nx] : F[c + 1], t = f0 / (f0 - f1);
    pos.set(k, k & 1 ? [x0 + i * g, y0 + (j + t) * g] : [x0 + (i + t) * g, y0 + j * g]);
  };
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const a = F[j * nx + i], b = F[j * nx + i + 1], c = F[(j + 1) * nx + i + 1], d = F[(j + 1) * nx + i];
    const dk = [a < 0, b < 0, c < 0, d < 0];
    if (dk[0] === dk[1] && dk[1] === dk[2] && dk[2] === dk[3]) continue;
    const E = [H(i, j), V(i + 1, j), H(i, j + 1), V(i, j)];
    const out = [], inn = [];
    for (let e = 0; e < 4; e++) { if (dk[e] && !dk[(e + 1) % 4]) out.push(e); if (!dk[e] && dk[(e + 1) % 4]) inn.push(e); }
    const link = (e1, e2) => { at(E[e1]); at(E[e2]); next.set(E[e1], E[e2]); };
    if (out.length === 1) link(out[0], inn[0]);
    else { const mid = (a + b + c + d) / 4 < 0; for (const e of out) link(e, mid ? (e + 1) % 4 : (e + 3) % 4); }
  }
  const loops = [], seen = new Set();
  for (const k0 of next.keys()) {
    if (seen.has(k0)) continue;
    const L = [];
    let k = k0;
    while (k !== undefined && !seen.has(k)) { seen.add(k); L.push(pos.get(k)); k = next.get(k); }
    if (L.length >= 3) loops.push(L);
  }
  return loops;
}
export function thinLoop(L, tol) {
  const n = L.length;
  if (n < 8) return L;
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) { const d = Math.hypot(L[i][0] - L[0][0], L[i][1] - L[0][1]); if (d > fd) { fd = d; far = i; } }
  const keep = new Uint8Array(n); keep[0] = keep[far] = 1;
  const rec = (a, b) => {
    const A = L[a], B = L[b % n], dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = l > 0 ? Math.abs((L[i][0] - A[0]) * dy - (L[i][1] - A[1]) * dx) / l : Math.hypot(L[i][0] - A[0], L[i][1] - A[1]);
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; rec(a, bi); rec(bi, b); }
  };
  rec(0, far); rec(far, n);
  return L.filter((_, i) => keep[i]);
}
export const loopArea = (L) => { let s = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
