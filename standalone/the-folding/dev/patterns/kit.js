// dev/patterns/kit.js — the design kit of the pattern round of 13 Nov 2026 (the owner: "come up with some patterns which
// are more like a comma but they fill more of the space, and they reuse the idea of the checkerboard by giving different
// tints to the two sides"). Pure (no DOM): the helpers a pattern DESIGN is drawn and measured with before it becomes a
// print of src/pattern.js. Used by dev/patterns/proto.html (in a browser) and by node scripts alike.
//
// A DESIGN is a module  dev/patterns/designs/<key>/design.js  with
//   export const meta = { key, label, hint };          // label: the selector's word, at most 12 characters
//   export function find(group) -> { shapes, info? }   // pure, deterministic, well under 100 ms a group
// where `shapes` is the MOTIF: a list of closed polygons { pts: [[x, y], ...], hole?: boolean } in the WORLD coordinates
// of that group (src/groups.js). The DARK tone of the plane is the union of g(motif) over ALL elements g of the group:
//     W(x) = sum over g, over polygons P of the motif:  +1 if x is inside g(P) and P is no hole, -1 if P is a hole
//     dark  <=>  W(x) > 0
// so the print is the group's by construction, whatever the motif. Rules a motif keeps:
//   * two copies g(motif), h(motif) either coincide as sets (a motif that sits ON a rotation centre or a mirror and has
//     that symmetry itself) or are DISJOINT, at least GAP_MIN * sqrt(domainArea) apart;
//   * a hole lies inside an outer polygon of the same motif;
//   * a polygon has at least 3 points, no repeated last point, no self-crossing; all of them together at most
//     MAX_VERTS vertices.
//
//   normalize(shapes)                  -> N = { polys: [{ pts: Float64Array, hole, box }], cx, cy, R, verts }
//   orbitElements(group, N, box)       -> the elements g whose copy g(motif) can touch the world box [x0, y0, x1, y1]
//   fillOrbit(c, group, N, map, box)   -> one path of every copy in the box, filled by the nonzero rule in c.fillStyle
//   toneAt(group, N, x, y)             -> 0 | 1
//   measure(group, N, opts?)           -> { coverage, emptyDisc, darkDisc, minGap, overlap, verts }
//   tileOf(group)                      -> the default tile (buildDomain of presets[0]): { poly, seed, domain }
//   comma(opts?), placed(pts, T)       -> the unit comma of src/motif.js as [[x, y], ...]; a polygon moved by T

import { elementsNear, latticeCoords } from '../../src/groups.js';
import { buildDomain } from '../../src/domain.js';
import { commaOutline } from '../../src/motif.js';

export const GAP_MIN = 0.02;
export const MAX_VERTS = 2400;

function signedArea(p) {
  let s = 0;
  for (let i = 0, n = p.length / 2; i < n; i++) { const j = (i + 1) % n; s += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; }
  return s / 2;
}

/** Outer polygons counter-clockwise, holes clockwise; the bounding circle of the whole motif. */
export function normalize(shapes) {
  const polys = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, verts = 0;
  for (const s of shapes || []) {
    let src = s.pts || s;
    if (!src || !src.length) continue;
    let flat = typeof src[0] === 'number' ? Array.from(src) : src.flatMap((p) => [p[0], p[1]]);
    let n = flat.length / 2;
    if (n > 3 && Math.hypot(flat[0] - flat[2 * n - 2], flat[1] - flat[2 * n - 1]) < 1e-12) { flat = flat.slice(0, 2 * n - 2); n--; }
    if (n < 3) continue;
    if (!flat.every(Number.isFinite)) throw new Error('kit.normalize: a polygon has a point that is not a number');
    const hole = !!s.hole;
    let pts = Float64Array.from(flat);
    const A = signedArea(pts);
    if ((A < 0) !== hole) { const r = new Float64Array(2 * n); for (let i = 0; i < n; i++) { r[2 * i] = pts[2 * (n - 1 - i)]; r[2 * i + 1] = pts[2 * (n - 1 - i) + 1]; } pts = r; }
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) { box[0] = Math.min(box[0], pts[2 * i]); box[1] = Math.min(box[1], pts[2 * i + 1]); box[2] = Math.max(box[2], pts[2 * i]); box[3] = Math.max(box[3], pts[2 * i + 1]); }
    x0 = Math.min(x0, box[0]); y0 = Math.min(y0, box[1]); x1 = Math.max(x1, box[2]); y1 = Math.max(y1, box[3]);
    polys.push({ pts, hole, box, area: Math.abs(A) });
    verts += n;
  }
  if (!polys.length) return { polys, cx: 0, cy: 0, R: 0, verts: 0 };
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let R = 0;
  for (const P of polys) for (let i = 0; i < P.pts.length; i += 2) R = Math.max(R, Math.hypot(P.pts[i] - cx, P.pts[i + 1] - cy));
  return { polys, cx, cy, R, verts };
}

/** The elements g of the group whose copy of the motif can touch the box [x0, y0, x1, y1]. */
export function orbitElements(group, N, box) {
  const mx = (box[0] + box[2]) / 2, my = (box[1] + box[3]) / 2, r = Math.hypot(box[2] - box[0], box[3] - box[1]) / 2;
  return elementsNear(group, mx, my, r + N.R, N.cx, N.cy);
}

/**
 * One path of every copy of the motif that can touch the world box, filled by the NONZERO rule (so coincident copies
 * are one shape, and a hole stays a hole). map(x, y, out) -> out: world point -> canvas point, any affine map.
 */
export function fillOrbit(c, group, N, map, box, fillStyle) {
  if (!N.polys.length) return 0;
  const o = [0, 0], els = orbitElements(group, N, box);
  c.beginPath();
  for (const g of els) {
    const flip = g.a * g.d - g.b * g.c < 0;
    for (const P of N.polys) {
      const p = P.pts, n = p.length / 2;
      for (let k = 0; k < n; k++) {
        const i = flip ? n - 1 - k : k;                      // a mirrored copy is walked backwards: outer stays outer
        const x = p[2 * i], y = p[2 * i + 1];
        map(g.a * x + g.b * y + g.tx, g.c * x + g.d * y + g.ty, o);
        if (k) c.lineTo(o[0], o[1]); else c.moveTo(o[0], o[1]);
      }
      c.closePath();
    }
  }
  if (fillStyle) c.fillStyle = fillStyle;
  c.fill('nonzero');
  return els.length;
}

function inside(p, x, y) {                                    // even-odd crossing test of one simple polygon
  let inn = false;
  for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
    const yi = p[2 * i + 1], yj = p[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < p[2 * i] + ((y - yi) * (p[2 * j] - p[2 * i])) / (yj - yi)) inn = !inn;
  }
  return inn;
}

/** W(x) of the header: how many copies of the motif cover the point (holes subtract). */
export function windingAt(group, N, x, y) {
  let w = 0;
  const st = [0, 0];
  for (const r of group.reps) {
    // g = translate(v) o r covers x  <=>  r^-1(x - v) is in the motif; r^-1(x - v) = r^-1(x) - (a lattice vector)
    const dx = x - r.tx, dy = y - r.ty;
    const zx = r.a * dx + r.c * dy, zy = r.b * dx + r.d * dy;          // r^-1(x): the transpose of the linear part
    latticeCoords(group, zx - N.cx, zy - N.cy, st);
    const m0 = Math.round(st[0]), n0 = Math.round(st[1]);
    for (let m = m0 - 2; m <= m0 + 2; m++) for (let n = n0 - 2; n <= n0 + 2; n++) {
      const px = zx - m * group.e1[0] - n * group.e2[0], py = zy - m * group.e1[1] - n * group.e2[1];
      if (Math.hypot(px - N.cx, py - N.cy) > N.R) continue;
      for (const P of N.polys) {
        if (px < P.box[0] || px > P.box[2] || py < P.box[1] || py > P.box[3]) continue;
        if (inside(P.pts, px, py)) w += P.hole ? -1 : 1;
      }
    }
  }
  return w;
}
export function toneAt(group, N, x, y) { return windingAt(group, N, x, y) > 0 ? 1 : 0; }

/** Exact Euclidean distance transform of a grid (Felzenszwalb): d[i] = distance (in cells) to the nearest cell with on[i]. */
function edt(on, w, h) {
  const INF = 1e20, f = new Float64Array(Math.max(w, h)), d = new Float64Array(w * h), v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
  const pass = (n, get, set) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s;
      for (;;) { const p = v[k]; s = (get(q) + q * q - (get(p) + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
      if (s <= z[k]) { v[k] = q; z[k] = -INF; z[k + 1] = INF; } else { k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; set(q, (q - p) * (q - p) + get(p)); }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = on[y * w + x] ? 0 : INF;
    const col = f.slice(0, h);
    pass(h, (i) => col[i], (i, val) => { d[i * w + x] = val; });
  }
  for (let y = 0; y < h; y++) {
    const row = d.slice(y * w, y * w + w);
    pass(w, (i) => row[i], (i, val) => { d[y * w + i] = val; });
  }
  for (let i = 0; i < d.length; i++) d[i] = Math.sqrt(d[i]);
  return d;
}

/**
 * The numbers a design is judged by, all lengths in units of the tile's size sqrt(domainArea):
 *   coverage   the share of the plane that is dark (0..1)
 *   emptyDisc  the DIAMETER of the largest disc that holds no dark point (how big the largest bare patch is)
 *   darkDisc   the diameter of the largest disc that is all dark (how fat the fattest blob is)
 *   overlap    the share of the plane covered by two different copies at once (must be 0; coincident copies do not count)
 *   verts      vertices of the motif
 * Sampled on a square grid of `per` points per tile size over a window of the plane; good to about 1 / per.
 */
export function measure(group, N, { per = 56 } = {}) {
  const size = Math.sqrt(group.domainArea), h = size / per;
  const L = Math.max(Math.hypot(group.e1[0], group.e1[1]), Math.hypot(group.e2[0], group.e2[1]));
  const half = Math.min(1.1 * L + 1.2 * size, 3.4 * size), pad = 1.3 * size;
  const w = Math.ceil((2 * (half + pad)) / h), x0 = group.center[0] - half - pad, y0 = group.center[1] - half - pad;
  const dark = new Uint8Array(w * w), light = new Uint8Array(w * w);
  let over = 0, inner = 0, nd = 0;
  const stab = stabilizerOrder(group, N);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h, W = windingAt(group, N, x, y);
    const t = W > 0 ? 1 : 0;
    dark[j * w + i] = t; light[j * w + i] = 1 - t;
  }
  // the dark share and the overlap over exactly ONE lattice cell (a square window is no whole number of periods: the
  // core agent measured it up to 8 % off, 13 Nov 2026)
  {
    const m = Math.max(48, Math.min(260, Math.round(per * Math.sqrt(group.cellArea) / size)));
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const s = (i + 0.5) / m, t = (j + 0.5) / m;
      const W = windingAt(group, N, group.center[0] + (s - 0.5) * group.e1[0] + (t - 0.5) * group.e2[0], group.center[1] + (s - 0.5) * group.e1[1] + (t - 0.5) * group.e2[1]);
      inner++; if (W > 0) nd++; if (W > stab) over++;
    }
  }
  const dToDark = edt(dark, w, w), dToLight = edt(light, w, w);
  let emptyR = 0, darkR = 0;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h;
    if (Math.abs(x - group.center[0]) > half || Math.abs(y - group.center[1]) > half) continue;
    emptyR = Math.max(emptyR, dToDark[j * w + i]); darkR = Math.max(darkR, dToLight[j * w + i]);
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { coverage: r3(nd / inner), emptyDisc: r3((2 * emptyR * h) / size), darkDisc: r3((2 * darkR * h) / size), overlap: r3(over / inner), verts: N.verts, stabilizer: stab };
}

/**
 * How many elements of the group map the motif ONTO ITSELF (1 for a motif at a generic place): every vertex of g(motif)
 * lies on the motif's outline. (Until 16:58 on 13 Nov 2026 this counted the elements that fix the centre of the motif's
 * bounding box, which is wrong both ways - the core agent's finding: a rosette on a 3-fold centre has its box centre off
 * the centre, and a lopsided motif whose box happens to be centred on a centre is not symmetric.)
 */
export function stabilizerOrder(group, N) {
  const tol = 1e-6 * Math.sqrt(group.domainArea);
  const onOutline = (x, y) => {
    for (const P of N.polys) for (let i = 0, n = P.pts.length / 2, j = n - 1; i < n; j = i++) {
      const ax = P.pts[2 * j], ay = P.pts[2 * j + 1], ex = P.pts[2 * i] - ax, ey = P.pts[2 * i + 1] - ay, l2 = ex * ex + ey * ey;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0;
      if (Math.hypot(x - ax - t * ex, y - ay - t * ey) <= tol) return true;
    }
    return false;
  };
  let k = 0;
  for (const g of elementsNear(group, N.cx, N.cy, 2 * N.R, N.cx, N.cy)) {
    let same = true;
    for (const P of N.polys) for (let i = 0; i < P.pts.length && same; i += 2) same = onOutline(g.a * P.pts[i] + g.b * P.pts[i + 1] + g.tx, g.c * P.pts[i] + g.d * P.pts[i + 1] + g.ty);
    if (same) k++;
  }
  return Math.max(1, k);
}

const tiles = new WeakMap();
/** The tile the page opens with: the Dirichlet tile of the group's first preset. { poly: [[x, y]...], seed, domain } */
export function tileOf(group) {
  let t = tiles.get(group);
  if (!t) { const domain = buildDomain(group, { seed: group.presets[0].seed, metric: group.presets[0].metric }); t = { poly: domain.poly, seed: domain.seed, domain }; tiles.set(group, t); }
  return t;
}

/** The unit comma of src/motif.js as [[x, y], ...]: head at the bottom, tail tip at (0, 1), the back toward +x, in the unit disc. */
export function comma(opts) {
  const o = commaOutline(opts), out = [];
  for (let i = 0; i + 2 < o.length; i += 2) out.push([o[i], o[i + 1]]);
  return out;
}

/** A polygon moved: scaled by (sx, sy) (sy defaults to sx; flip mirrors it first), turned by `angle`, shifted to `at`. */
export function placed(pts, { at = [0, 0], angle = 0, sx = 1, sy = sx, flip = false } = {}) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return pts.map(([x, y]) => { const u = (flip ? -x : x) * sx, v = y * sy; return [at[0] + c * u - s * v, at[1] + s * u + c * v]; });
}
