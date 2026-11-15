// lib.mjs — the reviewer's own brute force for shape prints (review-math, 13 Nov 2026). Independent of src/shapes.js:
// the elements come from src/groups.js elementsNear, "inside" is its own crossing test, distances its own loops.
import { GROUPS, BY_ID, elementsNear, symmetryElements } from '../../../src/groups.js';
import { commaOutline } from '../../../src/motif.js';

export { GROUPS, BY_ID };

export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A copy of a group moved by the similarity M(x) = s R(th) x + v, or with refl: s R(th) F x + v (F: (x, y) -> (x, -y)). */
export function movedGroup(g, { th = 0, s = 1, v = [0, 0], refl = false } = {}) {
  const c = Math.cos(th), sn = Math.sin(th);
  // linear part of M: s R F^refl
  const Ma = s * c, Mb = s * (refl ? sn : -sn), Mc = s * sn, Md = s * (refl ? -c : c);
  const det = Ma * Md - Mb * Mc;
  const Ia = Md / det, Ib = -Mb / det, Ic = -Mc / det, Id = Ma / det;
  const M = (p) => [Ma * p[0] + Mb * p[1] + v[0], Mc * p[0] + Md * p[1] + v[1]];
  const Mlin = (p) => [Ma * p[0] + Mb * p[1], Mc * p[0] + Md * p[1]];
  const conj = (r) => {
    // M r M^-1: linear  M L I, translation  M(r(M^-1(0))) ... computed directly
    const La = r.a, Lb = r.b, Lc = r.c, Ld = r.d;
    // L' = M L M^-1
    const t1a = Ma * La + Mb * Lc, t1b = Ma * Lb + Mb * Ld, t1c = Mc * La + Md * Lc, t1d = Mc * Lb + Md * Ld;
    const a = t1a * Ia + t1b * Ic, b = t1a * Ib + t1b * Id, cc = t1c * Ia + t1d * Ic, d = t1c * Ib + t1d * Id;
    // t' = M(t_r) + v - L' v  (M r M^-1 (x) = M(L M^-1 x + t) ... )
    const mt = Mlin([r.tx, r.ty]);
    return { a, b, c: cc, d, tx: mt[0] + v[0] - (a * v[0] + b * v[1]), ty: mt[1] + v[1] - (cc * v[0] + d * v[1]) };
  };
  const e1 = Mlin(g.e1), e2 = Mlin(g.e2);
  const h = { id: g.id + "'", e1, e2, reps: g.reps.map(conj), center: M(g.center), presets: g.presets, viewHalf: g.viewHalf * s };
  h.cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  h.domainArea = h.cellArea / h.reps.length;
  return { h, M, Mlin };
}

/** Even-odd crossing test of a flat polygon. */
export function insideFlat(p, x, y) {
  let inn = false;
  for (let i = 0, n = p.length >> 1, j = n - 1; i < n; j = i++) {
    const yi = p[2 * i + 1], yj = p[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < p[2 * i] + ((y - yi) * (p[2 * j] - p[2 * i])) / (yj - yi)) inn = !inn;
  }
  return inn;
}

/** The motif as flat polygons with its bounding circle (centre of the box; R measured). */
export function flatMotif(shapes) {
  const polys = shapes.map((s) => ({ pts: Float64Array.from(s.pts.flatMap((p) => [p[0], p[1]])), hole: !!s.hole }));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const P of polys) for (let i = 0; i < P.pts.length; i += 2) { x0 = Math.min(x0, P.pts[i]); x1 = Math.max(x1, P.pts[i]); y0 = Math.min(y0, P.pts[i + 1]); y1 = Math.max(y1, P.pts[i + 1]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let R = 0;
  for (const P of polys) for (let i = 0; i < P.pts.length; i += 2) R = Math.max(R, Math.hypot(P.pts[i] - cx, P.pts[i + 1] - cy));
  return { polys, cx, cy, R };
}

const inv = (g) => { const dt = g.a * g.d - g.b * g.c, a = g.d / dt, b = -g.b / dt, c = -g.c / dt, d = g.a / dt; return { a, b, c, d, tx: -(a * g.tx + b * g.ty), ty: -(c * g.tx + d * g.ty) }; };

/** W by brute force: every element g with |g(centre) - x| <= R, the polygons that hold g^-1(x). */
export function bruteW(group, F, x, y) {
  let W = 0;
  for (const g of elementsNear(group, x, y, F.R * (1 + 1e-7) + 1e-12, F.cx, F.cy)) {
    const h = inv(g), px = h.a * x + h.b * y + h.tx, py = h.c * x + h.d * y + h.ty;
    for (const P of F.polys) if (insideFlat(P.pts, px, py)) W += P.hole ? -1 : 1;
  }
  return W;
}

function segDist2(x, y, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  let t = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = x - ax - t * ex, qy = y - ay - t * ey;
  return qx * qx + qy * qy;
}
/** The distance to the nearest outline of any copy, brute force, looked for up to `reach` (else reach). */
export function bruteMargin(group, F, x, y, reach) {
  let best2 = reach * reach;
  for (const g of elementsNear(group, x, y, F.R + reach, F.cx, F.cy)) {
    const h = inv(g), px = h.a * x + h.b * y + h.tx, py = h.c * x + h.d * y + h.ty;
    for (const P of F.polys) {
      const p = P.pts, n = p.length >> 1;
      for (let i = 0, j = n - 1; i < n; j = i++) { const d2 = segDist2(px, py, p[2 * j], p[2 * j + 1], p[2 * i], p[2 * i + 1]); if (d2 < best2) best2 = d2; }
    }
  }
  return Math.sqrt(best2);
}

/** A canvas context that records the path and the fill rule. */
export function recorder() {
  const c = { subs: [], cur: null, fills: [], fillStyle: null };
  c.beginPath = () => { c.subs = []; c.cur = null; };
  c.moveTo = (x, y) => { c.cur = [[x, y]]; c.subs.push(c.cur); };
  c.lineTo = (x, y) => { if (!c.cur) { c.cur = [[x, y]]; c.subs.push(c.cur); } else c.cur.push([x, y]); };
  c.closePath = () => { c.cur = null; };
  c.fill = (rule) => { c.fills.push({ rule: rule || 'nonzero', path: c.subs.slice(), style: c.fillStyle }); };
  return c;
}
/** The nonzero winding number of recorded subpaths round a point. */
export function windingOf(subs, x, y) {
  let w = 0;
  for (const p of subs) for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[j], b = p[i];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) w += b[1] > a[1] ? 1 : -1;
  }
  return w;
}

/** The elements of the group that fix the point c: [{ kind: 'rot', ang } | { kind: 'refl', axis }]. */
export function stabilizerOf(group, c) {
  const out = [];
  for (const g of elementsNear(group, c[0], c[1], 1e-9 * Math.sqrt(group.domainArea), c[0], c[1])) {
    const det = g.a * g.d - g.b * g.c;
    if (det > 0) out.push({ kind: 'rot', ang: Math.atan2(g.c, g.a) });
    else out.push({ kind: 'refl', axis: Math.atan2(g.c, g.a) / 2 });
  }
  return out;
}

/** A closed curve about c invariant under the stabilizer of c in the group: r(th) = r0 (1 + avg over h of phi(h th)). */
export function rosette(group, c, r0, N, { amp = 0.22, seed = 5, phase0 = null } = {}) {
  const stab = stabilizerOf(group, c);
  const rnd = prng(seed), A = [], P = [];
  for (let m = 1; m <= 12; m++) { A.push((amp * (0.5 + rnd())) / m); P.push(2 * Math.PI * rnd()); }
  const phi = (t) => { let s = 0; for (let m = 1; m <= 12; m++) s += A[m - 1] * Math.cos(m * t + P[m - 1]); return s; };
  const f = (t) => { let s = 0; for (const h of stab) s += phi(h.kind === 'rot' ? t + h.ang : 2 * h.axis - t); return 1 + s / stab.length; };
  // vertices at angles that the stabilizer permutes: from a mirror's axis when there is one, N a multiple of 2k
  const refl = stab.find((h) => h.kind === 'refl'), base = phase0 != null ? phase0 : refl ? refl.axis : 0.123;
  const pts = [];
  for (let i = 0; i < N; i++) { const t = base + (2 * Math.PI * i) / N; const r = r0 * f(t); pts.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]); }
  return { pts, order: stab.length };
}

/** The unit comma of src/motif.js placed: scale s, turn th, at p, optionally mirrored. */
export function commaAt(p, s, th, flip = false) {
  const o = commaOutline(), c = Math.cos(th), sn = Math.sin(th), pts = [];
  for (let i = 0; i + 2 < o.length; i += 2) { const u = (flip ? -o[i] : o[i]) * s, v = o[i + 1] * s; pts.push([p[0] + c * u - sn * v, p[1] + sn * u + c * v]); }
  return pts;
}

/** The distance from p to the nearest other point of its orbit. */
export function roomAt(group, x, y) {
  let D = Infinity;
  const L = Math.max(Math.hypot(...group.e1), Math.hypot(...group.e2));
  for (const g of elementsNear(group, x, y, 1.01 * L, x, y)) {
    const d = Math.hypot(g.a * x + g.b * y + g.tx - x, g.c * x + g.d * y + g.ty - y);
    if (d > 1e-7 * Math.sqrt(group.domainArea) && d < D) D = d;
  }
  return D;
}

export { symmetryElements, elementsNear };
