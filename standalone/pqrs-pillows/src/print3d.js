// print3d.js — the pattern's own commas on the Surface pane (SPEC 1.6, 3.4). Pure: no DOM, runs under node.
//
//   const p3 = createPrint3d();                       // ({ centre: 'pair' }: the disc of the pair frame itself, no slide)
//   const print = p3.bake(state, { size: 1024 });     // -> what surface-pane's setPrint takes, or null (then: plain tones)
//   const uv = p3.chartOf(frame.corners);             // Float32Array, 2 per corner (6 per triangle): surface-pane's `uv`
//
// What is baked. The comma outlines are the engine's, as the Pattern pane draws them: centredFor(state).shapes[i].pts
// (hyperboloid points in the pair frame; plane points [x, y, 1] for 2222), one outline a comma of the orbifold. Every
// other copy is its image under the group, and the copies are found with the Pattern pane's own tile walk,
// pattern-ext.js tilesPSU(D, A, { focus: the chart's middle, radius, extraSamples: comma points }): one motion M a
// tile, the copy is M · outline. They are written in DISC coordinates (x / (1 + z), y / (1 + z)) into ONE
// signed-distance texture (The Folding's sdf.js bakeSDF) of the chart cell that holds the Poincaré disc:
//   origin (-1, -1), e1 (2, 0), e2 (0, 2).
// (The disc is the pair frame's, slid so that its centre is "the middle" described below; createPrint3d({ centre:
// 'pair' }) keeps the pair frame's own disc, to the letter of SPEC 1.6, at the price of a coarser print on short loops.)
// A texel is 2 / size of the disc; the range is RANGE_TEXELS texels. Where commas overlap the texture holds their
// union, as the Pattern pane draws it (layersOf below).
//
// The chart. A corner's chart point is a disc point of its hyperboloid point. The print is the same on every image
// of a triangle under the group, and the disc thins toward its rim (at distance d from the middle the scale is
// 1 / cosh^2(d / 2) of the middle's), so each TRIANGLE is first brought as near the middle as the group can bring it:
// its three corners are moved together by motions of the group, each step taking the one that brings their sum
// nearest the middle, until none does: a descent to the Dirichlet region of the middle. The candidate motions are
// found per state: for each of a spread of points of the tile, the motion of the group that brings THAT point nearest
// the middle (the point is put into the engine's tile with pattern-ext.js locateTilePSU, then every tile of the walk
// is tried), and besides them the few motions that move the middle least. (The motions that move the middle least
// are not enough alone: with two cone points close to the middle they are all words in those two turns, and a far
// triangle is never brought home. Seen on 3333 at Length 7, Twist -0.5.) A triangle that the descent leaves outside
// what was baked (a corner handed over on a far lift) is first put into the engine's tile, then folded again.
// Only copies of the commas that come within `radius` of the middle are baked: the radius is the farthest that the
// spread of points lands after the fold, plus MARGIN.
// THE MIDDLE is not the pair frame's origin (the middle of the first pair's seal) but the middle of the NECK: a
// point of the loop's collar half way between the two pillows' highest points across the loop, at the place along
// the loop from which the farthest cone point is nearest (neckMiddle below). The disc is the pair frame's, slid there
// (one fixed motion C of the plane, the same in bake and in chartOf; print.info.centre is that point). For a short
// loop the two pillows hang at the two ends of a long thin neck, and from the first pair's seal the other pillow is
// twice as far: measured on 3333 at Length 0.4, the fold reaches 4.77 from the seal's middle and 2.46 from the neck's
// (dev/pane/NOTES.md has the sweep).
//
// 2222: the plane. The group is the half turns about the cone-point lattice A + Z a + Z b (a = B - A, b = C - A, the
// engine's home points); its translations are 2 a, 2 b, and ONE cell of that lattice is baked (a reduced basis of it, so
// the texels are not slivers at a large Twist; the texture repeats under both vectors, as the print does). The copies
// are the outline, its half turn about A, and their translates that reach the cell. Chart point = plane point.
//
// bake and chartOf go together: chartOf folds with the motions of the state that was baked LAST (or prepared last:
// p3.prepare(state)), so hand it the corners of that same state. If a page skips a bake while a slider is dragged it
// keeps the chart of the baked state too (surface-pane's showFrame without `uv` keeps the last one).
//
// Two data arrays a size are written in turn: the renderer keeps a texture's array by reference and uploads only when
// it is handed ANOTHER array (render3d.js), and must not see the array it holds change. The same state and size asked
// again return the same print object (no bake, no upload).

import { centredFor, invH, psuToSO21 } from '../../two-features-two-handles/src/handles.js';
import { tilesPSU, locateTilePSU } from '../../two-features-two-handles/src/pattern-ext.js';
import { bakeSDF } from '../../the-folding/src/sdf.js';

export const PRINT_SIZE = 1024;          // the texture's side at rest
export const PRINT_SIZE_DRAG = 512;      // ... while a slider is dragged
export const RANGE_TEXELS = 6;           // the signed distance is exact this many texels either side of an outline (The Folding's BAKE_RANGE)
const N_NEAR = 12;                       // the fold's candidates: these many motions that move the middle least, and one for each sample of the tile
const N_FOLD = 72;                       // ... at most these many in all
const R_WALK = 4.2;                      // the first tile walk's radius (hyperbolic), enough to choose the fold's motions
const R_CAP = 6.2;                       // no copy is baked from further out: there a comma is under two texels of a 1024 texture
const MARGIN = 0.7;                      // added to the fold's reach: a triangle's size, the spacing of the comma samples, the range
const FOLD_STEPS = 24;
const MAX_LAYERS = 6;                    // overlapping commas are baked in at most these many layers (each a pass over the texture)

const printIds = new WeakMap();
let nextPrintId = 1;
function keyOf(state) {
  let id = 'own';
  const pr = state.print;
  if (pr && typeof pr === 'object') { id = printIds.get(pr); if (!id) { id = nextPrintId++; printIds.set(pr, id); } }
  return [state.k, (state.perm || []).join(''), state.L, state.tw, (state.thetas || []).join(','), id].join('|');
}

const fermi = (s, th) => { const cs = Math.cosh(s); return [Math.sinh(th) * cs, Math.sinh(s), Math.cosh(th) * cs]; };
const mulV = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
/** A vector of positive height put back on the hyperboloid. */
const onH = (p) => { const n = Math.sqrt(Math.max(1e-300, p[2] * p[2] - p[0] * p[0] - p[1] * p[1])); return [p[0] / n, p[1] / n, p[2] / n]; };

/** The fold: the triangle of hyperboloid points (9 numbers at o in `a`) moved, as one, toward the origin. In place. */
function foldTri(a, o, G, n) {
  for (let step = 0; step < FOLD_STEPS; step++) {
    const sx = a[o] + a[o + 3] + a[o + 6], sy = a[o + 1] + a[o + 4] + a[o + 7], sz = a[o + 2] + a[o + 5] + a[o + 8];
    let best = sz * (1 - 1e-9), bi = -1;
    for (let i = 0, g = 6; i < n; i++, g += 9) {
      const z = G[g] * sx + G[g + 1] * sy + G[g + 2] * sz;       // the height of the moved sum: cosh of its distance, summed
      if (z < best) { best = z; bi = i; }
    }
    if (bi < 0) return step;
    const g = 9 * bi;
    for (let c = 0; c < 9; c += 3) {
      const x = a[o + c], y = a[o + c + 1], z = a[o + c + 2];
      a[o + c] = G[g] * x + G[g + 1] * y + G[g + 2] * z;
      a[o + c + 1] = G[g + 3] * x + G[g + 4] * y + G[g + 5] * z;
      a[o + c + 2] = G[g + 6] * x + G[g + 7] * y + G[g + 8] * z;
    }
  }
  return FOLD_STEPS;
}

/**
 * Points spread over one tile, as hyperboloid points of the pair frame: the engine's tile (its middle, its corners,
 * points between), and a grid of the collar's chart over one turn of the loop (the lift pillow.js's meshes are on).
 */
function tileSamples(state, c) {
  const at = c.D.at, V = c.D.verts, pts = [at, ...V];
  for (let i = 0; i < V.length; i++) {
    const a = V[i], b = V[(i + 1) % V.length];
    pts.push(onH([a[0] + b[0], a[1] + b[1], a[2] + b[2]]));
    for (const w of [1 / 3, 2 / 3]) pts.push(onH([at[0] + w * (a[0] - at[0]), at[1] + w * (a[1] - at[1]), at[2] + w * (a[2] - at[2])]));
  }
  if (c.Pmat) {
    const inv = invH(c.Pmat), h = c.home.map((p) => Math.asinh(mulV(inv, p)[1]));
    const lo = Math.min(h[0], h[1], 0), hi = Math.max(h[2], h[3], 0), L = state.L;
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 8; j++) pts.push(mulV(c.Pmat, fermi(lo + ((hi - lo) * j) / 8, -L / 2 + (L * i) / 16)));
  }
  return pts;
}

const mul3 = (A, B) => { const C = new Array(9); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) C[3 * r + k] = A[3 * r] * B[k] + A[3 * r + 1] * B[3 + k] + A[3 * r + 2] * B[6 + k]; return C; };
/** The slide of the plane that takes the hyperboloid point p to the origin (0, 0, 1), and the one that takes the origin to p. */
const slideTo0 = (p) => { const [x, y, z] = p, k = 1 / (z + 1); return [1 + x * x * k, x * y * k, -x, x * y * k, 1 + y * y * k, -y, -x, -y, z]; };
const slideFrom0 = (p) => { const [x, y, z] = p, k = 1 / (z + 1); return [1 + x * x * k, x * y * k, x, x * y * k, 1 + y * y * k, y, x, y, z]; };

/**
 * The middle of the neck, as a hyperboloid point of the pair frame (see the head of the file): in the collar's chart
 * (s across the loop, theta along it, period L) the point at s = half way between the two pillows' highest points,
 * and at the theta from which the farthest of the four cone points is nearest (48 places round the loop are tried;
 * of equally good ones the nearest to half the Twist's slide). At Twist 0 that is under the middle of the first
 * pair's seal; at Twist 1/2, where the cone points stand two and two above one another, between the two stacks.
 */
function neckMiddle(state, c) {
  if (!c.Pmat) return [0, 0, 1];
  const inv = invH(c.Pmat), L = state.L, q = c.home.map((p) => mulV(inv, p));
  const h = q.map((v) => Math.asinh(v[1])), u = q.map((v) => Math.atanh(v[0] / v[2]));
  const lo = Math.max(-h[0], -h[1], 0), hi = Math.max(h[2], h[3], 0), s0 = (hi - lo) / 2, want = (state.tw * L) / 2;
  let best = Infinity, th0 = want;
  for (let i = 0; i < 48; i++) {
    const th = want + (L * i) / 48;
    let far = 0;
    for (let k = 0; k < 4; k++) {
      let d = th - u[k]; d -= L * Math.round(d / L);
      const a = Math.sinh(d / 2), b = Math.sinh((s0 - h[k]) / 2), dist = 2 * Math.asinh(Math.sqrt(Math.cosh(s0) * Math.cosh(h[k]) * a * a + b * b));
      if (dist > far) far = dist;
    }
    let off = th - want; off -= L * Math.round(off / L);
    if (far < best - 1e-9 || (far < best + 1e-9 && Math.abs(off) < Math.abs(th0 - want) - 1e-12)) { best = far; th0 = want + off; }
  }
  return onH(mulV(c.Pmat, fermi(s0, th0)));
}

function prepareH(state, c, key, opts = {}) {
  const extra = [];
  for (const sh of c.shapes) for (let i = 0; i < sh.pts.length; i += 5) extra.push(sh.pts[i]);
  const centre = opts.centre === 'pair' ? [0, 0, 1] : neckMiddle(state, c), C = slideTo0(centre), Ci = slideFrom0(centre);
  const focus = [centre[0] / (1 + centre[2]), centre[1] / (1 + centre[2])];
  const walk = (radius) => tilesPSU(c.D, c.A, { focus, radius, max: 4200, ms: 400, extraSamples: extra });
  let tiles = walk(R_WALK), walked = R_WALK;
  // The fold's motions, in the chart's frame (C g C^-1).
  // (1) for each sample p of the tile: p0 = t^-1 p, its copy in the engine's tile (locateTilePSU gives t); the walked
  //     tile M whose copy M p0 lies nearest the middle; the motion is M t^-1.
  const samples = tileSamples(state, c), CM = tiles.map((t) => mul3(C, t.M)), picked = new Map();
  const isId = (g) => Math.abs(g[0] - 1) + Math.abs(g[4] - 1) + Math.abs(g[8] - 1) + Math.abs(g[1]) + Math.abs(g[2]) + Math.abs(g[5]) < 1e-9;
  for (const p of samples) {
    const tInv = invH(psuToSO21(locateTilePSU(c.D, c.A, [p[0] / (1 + p[2]), p[1] / (1 + p[2])]).g)), p0 = mulV(tInv, p);
    let best = Infinity, bi = -1;
    for (let i = 0; i < CM.length; i++) { const m = CM[i], z = m[6] * p0[0] + m[7] * p0[1] + m[8] * p0[2]; if (z < best) { best = z; bi = i; } }
    if (bi < 0) continue;
    const g = mul3(mul3(CM[bi], tInv), Ci);
    if (!isId(g)) picked.set(g.map((x) => Math.round(x * 1e6)).join(','), g);
  }
  // (2) the few motions of the walk that move the middle least (a motion g moves the origin to height g[8] = cosh of how far)
  const nearest = tiles.map((t) => mul3(mul3(C, t.M), Ci)).filter((g) => !isId(g)).sort((p, q) => p[8] - q[8]).slice(0, N_NEAR);
  for (const g of nearest) picked.set(g.map((x) => Math.round(x * 1e6)).join(','), g);
  const near = [...picked.values()].sort((p, q) => p[8] - q[8]).slice(0, N_FOLD);
  const n = near.length, G = new Float64Array(9 * n);
  for (let i = 0; i < n; i++) G.set(near[i], 9 * i);
  // how far from the middle a point of the tile lands after the fold
  const tri = new Float64Array(9);
  let zMax = 1;
  for (const p of samples) {
    const q = mulV(C, p);
    for (let k = 0; k < 9; k++) tri[k] = q[k % 3];
    foldTri(tri, 0, G, n);
    if (tri[2] > zMax) zMax = tri[2];
  }
  const reach = Math.acosh(zMax), radius = Math.min(R_CAP, reach + MARGIN);
  if (radius > walked) { tiles = walk(radius); walked = radius; }
  return { key, kind: 'H', c, C, Ci, centre, G, n, tiles, reach, radius, zHome: 3 * Math.cosh(reach + 0.5 * MARGIN) };
}

function prepareE(state, c, key) {
  const [A, B, C] = c.home;
  let e1 = [2 * (B[0] - A[0]), 2 * (B[1] - A[1])], e2 = [2 * (C[0] - A[0]), 2 * (C[1] - A[1])];
  // a reduced basis of the same lattice (Gauss): the shorter vector first, the other within half of it
  for (let it = 0; it < 64; it++) {
    if (e1[0] * e1[0] + e1[1] * e1[1] > e2[0] * e2[0] + e2[1] * e2[1]) { const t = e1; e1 = e2; e2 = t; }
    const m = Math.round((e1[0] * e2[0] + e1[1] * e2[1]) / (e1[0] * e1[0] + e1[1] * e1[1]));
    if (!m) break;
    e2 = [e2[0] - m * e1[0], e2[1] - m * e1[1]];
  }
  if (e1[0] * e2[1] - e1[1] * e2[0] < 0) e2 = [-e2[0], -e2[1]];
  // the cell's middle on the middle of the engine's tile (any point would do)
  const mid = c.D.at, origin = [mid[0] - (e1[0] + e2[0]) / 2, mid[1] - (e1[1] + e2[1]) / 2];
  return { key, kind: 'E', c, origin, e1, e2, centre: [A[0], A[1]] };
}

function polysH(P) {
  const polys = [];
  for (const t of P.tiles) {
    if (t.d > P.radius) continue;
    const M = mul3(P.C, t.M);
    for (const sh of P.c.shapes) {
      const pts = sh.pts, n = pts.length, a = new Float64Array(2 * n);
      for (let i = 0; i < n; i++) {
        const p = pts[i], x = M[0] * p[0] + M[1] * p[1] + M[2] * p[2], y = M[3] * p[0] + M[4] * p[1] + M[5] * p[2], z = M[6] * p[0] + M[7] * p[1] + M[8] * p[2];
        a[2 * i] = x / (1 + z); a[2 * i + 1] = y / (1 + z);
      }
      polys.push({ pts: a });
    }
  }
  return polys;
}

function polysE(P, range) {
  const { origin, e1, e2, centre } = P, det = e1[0] * e2[1] - e1[1] * e2[0];
  const I = [e2[1] / det, -e2[0] / det, -e1[1] / det, e1[0] / det];      // rows of [e1 e2]^-1
  const padS = range * Math.hypot(I[0], I[1]) * 1.001, padT = range * Math.hypot(I[2], I[3]) * 1.001;
  const polys = [];
  for (const sh of P.c.shapes) for (let half = 0; half < 2; half++) {
    const pts = sh.pts, n = pts.length, base = new Float64Array(2 * n);
    let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = half ? 2 * centre[0] - pts[i][0] : pts[i][0], y = half ? 2 * centre[1] - pts[i][1] : pts[i][1];
      base[2 * i] = x; base[2 * i + 1] = y;
      const s = I[0] * (x - origin[0]) + I[1] * (y - origin[1]), t = I[2] * (x - origin[0]) + I[3] * (y - origin[1]);
      if (s < s0) s0 = s; if (s > s1) s1 = s; if (t < t0) t0 = t; if (t > t1) t1 = t;
    }
    for (let i = Math.ceil(-padS - s1); i <= Math.floor(1 + padS - s0); i++) for (let j = Math.ceil(-padT - t1); j <= Math.floor(1 + padT - t0); j++) {
      const dx = i * e1[0] + j * e2[0], dy = i * e1[1] + j * e2[1], a = new Float64Array(2 * n);
      for (let k = 0; k < n; k++) { a[2 * k] = base[2 * k] + dx; a[2 * k + 1] = base[2 * k + 1] + dy; }
      polys.push({ pts: a });
    }
  }
  return polys;
}

/** Is the point (x, y) inside the polygon a = [x0, y0, x1, y1, ...]? (even-odd) */
function inside(a, x, y) {
  let c = false;
  for (let i = 0, n = a.length, j = n - 2; i < n; j = i, i += 2) {
    const yi = a[i + 1], yj = a[j + 1];
    if ((yi > y) !== (yj > y) && x < ((a[j] - a[i]) * (y - yi)) / (yj - yi) + a[i]) c = !c;
  }
  return c;
}
/**
 * Commas that OVERLAP (a comma rides rigid with its cone point, so far from the family's own Length two can come to
 * lie over one another; the Pattern pane shows their union). bakeSDF takes every outline as an outline, so the part
 * of one comma's outline that lies inside another would show as a hairline of half tone. The outlines are therefore
 * sorted into layers in which none overlaps another; each layer is baked by itself and the layers are joined by the
 * smaller byte (the union's distance outside, the deeper comma's inside). One layer, one bake, where nothing overlaps:
 * that is found from the few outlines nearest the middle alone (an overlap repeats under the group).
 * polys: [{ pts: Float64Array }]; mid: the chart's middle; near: how many outlines to try first.
 * Returns the layers, a list of lists of polygons.
 */
function layersOf(polys, mid, near) {
  const n = polys.length;
  if (n < 2) return [polys];
  const box = new Float64Array(4 * n), order = new Array(n), far = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const a = polys[k].pts;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < a.length; i += 2) { if (a[i] < x0) x0 = a[i]; if (a[i] > x1) x1 = a[i]; if (a[i + 1] < y0) y0 = a[i + 1]; if (a[i + 1] > y1) y1 = a[i + 1]; }
    box[4 * k] = x0; box[4 * k + 1] = y0; box[4 * k + 2] = x1; box[4 * k + 3] = y1;
    order[k] = k; far[k] = Math.hypot((x0 + x1) / 2 - mid[0], (y0 + y1) / 2 - mid[1]);
  }
  const overlap = (p, q) => {
    if (box[4 * p] > box[4 * q + 2] || box[4 * q] > box[4 * p + 2] || box[4 * p + 1] > box[4 * q + 3] || box[4 * q + 1] > box[4 * p + 3]) return false;
    const a = polys[p].pts, b = polys[q].pts;
    for (let i = 0; i < a.length; i += 6) if (a[i] >= box[4 * q] && a[i] <= box[4 * q + 2] && a[i + 1] >= box[4 * q + 1] && a[i + 1] <= box[4 * q + 3] && inside(b, a[i], a[i + 1])) return true;
    for (let i = 0; i < b.length; i += 6) if (b[i] >= box[4 * p] && b[i] <= box[4 * p + 2] && b[i + 1] >= box[4 * p + 1] && b[i + 1] <= box[4 * p + 3] && inside(a, b[i], b[i + 1])) return true;
    return false;
  };
  order.sort((p, q) => far[p] - far[q]);
  let any = false;
  for (let i = 0; i < Math.min(near, n) && !any; i++) for (let k = 0; k < n && !any; k++) if (k !== order[i] && overlap(order[i], k)) any = true;
  if (!any) return [polys];
  // every pair, then the least layer free of a polygon's overlapping neighbours
  const layer = new Int32Array(n).fill(-1), layers = [];
  for (let p = 0; p < n; p++) {
    let used = 0;
    for (let q = 0; q < p; q++) if (layer[q] < 30 && overlap(p, q)) used |= 1 << layer[q];
    let l = 0;
    while (used & (1 << l)) l++;
    if (l >= MAX_LAYERS) l = MAX_LAYERS - 1;        // (commas piled deeper than that keep a hairline in the last layer)
    layer[p] = l;
    (layers[l] || (layers[l] = [])).push(polys[p]);
  }
  return layers;
}

export function createPrint3d(opts = {}) {
  const bufs = new Map();              // size -> { a, b, turn }
  let cur = null;                      // the state prepared last: its fold (H) or its lattice (E)
  let last = null;                     // the print made last: { key, size, print }

  /** The fold (or the lattice) of a state, without a bake. bake calls it. */
  function prepare(state) {
    const key = keyOf(state);
    if (cur && cur.key === key) return cur;
    const c = centredFor(state);
    cur = c.D.G.kind === 'E' ? prepareE(state, c, key) : prepareH(state, c, key, opts);
    return cur;
  }

  /** The print of a state as surface-pane's setPrint takes it: { size, data, range, origin, e1, e2 } (+ kind, key, info), or null. */
  function bake(state, { size = PRINT_SIZE } = {}) {
    try {
      const P = prepare(state);
      if (last && last.key === P.key && last.size === size) return last.print;
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      let origin, e1, e2, range, polys;
      if (P.kind === 'E') {
        origin = P.origin; e1 = P.e1; e2 = P.e2;
        range = (RANGE_TEXELS * Math.max(Math.hypot(e1[0], e1[1]), Math.hypot(e2[0], e2[1]))) / size;
        polys = polysE(P, range);
      } else {
        origin = [-1, -1]; e1 = [2, 0]; e2 = [0, 2];
        range = (RANGE_TEXELS * 2) / size;
        polys = polysH(P);
      }
      const mid = [origin[0] + (e1[0] + e2[0]) / 2, origin[1] + (e1[1] + e2[1]) / 2];
      const layers = layersOf(polys, mid, 3 * Math.max(1, P.c.shapes.length));
      let slot = bufs.get(size);
      if (!slot) { slot = { a: new Uint8Array(size * size), b: new Uint8Array(size * size), turn: 0 }; bufs.set(size, slot); }
      const data = slot.turn ? slot.b : slot.a;
      slot.turn ^= 1;
      data.set(bakeSDF({ origin, e1, e2, size, range, polys: layers[0] }));
      for (let l = 1; l < layers.length; l++) {
        const more = bakeSDF({ origin, e1, e2, size, range, polys: layers[l] });
        for (let i = 0; i < data.length; i++) if (more[i] < data[i]) data[i] = more[i];
      }
      let edges = 0;
      for (const p of polys) edges += p.pts.length >> 1;
      const info = { kind: P.kind, polys: polys.length, layers: layers.length, edges, tiles: P.kind === 'H' ? P.tiles.length : 0, fold: P.kind === 'H' ? P.n : 0, reach: P.kind === 'H' ? P.reach : 0, radius: P.kind === 'H' ? P.radius : 0, centre: P.kind === 'H' ? P.centre.slice() : null, ms: (typeof performance !== 'undefined' ? performance.now() : 0) - t0 };
      const print = { size, data, range, origin: origin.slice(), e1: e1.slice(), e2: e2.slice(), kind: P.kind, key: P.key, info };
      last = { key: P.key, size, print };
      return print;
    } catch (err) {
      if (typeof console !== 'undefined') console.warn('print3d: no print for this state (' + (err && err.message) + ')');
      return null;
    }
  }

  /** A triangle (chart frame, 9 numbers) the descent left far out: put into the engine's own tile, then folded again. */
  function home(tri) {
    const { C, Ci, c, G, n } = cur, s = onH(mulV(Ci, [tri[0] + tri[3] + tri[6], tri[1] + tri[4] + tri[7], tri[2] + tri[5] + tri[8]]));
    const m = mul3(mul3(C, invH(psuToSO21(locateTilePSU(c.D, c.A, [s[0] / (1 + s[2]), s[1] / (1 + s[2])]).g))), Ci);
    for (let k = 0; k < 9; k += 3) {
      const x = tri[k], y = tri[k + 1], z = tri[k + 2];
      tri[k] = m[0] * x + m[1] * y + m[2] * z; tri[k + 1] = m[3] * x + m[4] * y + m[5] * z; tri[k + 2] = m[6] * x + m[7] * y + m[8] * z;
    }
    foldTri(tri, 0, G, n);
  }

  /**
   * The chart points of a frame's corners: `corners` holds 9 numbers a triangle (three points of the pair frame:
   * hyperboloid [x, y, z], or [x, y, 1] of the plane for 2222); returns 2 numbers a corner (6 a triangle).
   * Of the state baked (or prepared) last; before any, the plain disc point with no fold.
   */
  function chartOf(corners, out = null) {
    const m = Math.floor(corners.length / 9), uv = out && out.length === 6 * m ? out : new Float32Array(6 * m);
    if (cur && cur.kind === 'E') {
      for (let t = 0, o = 0, q = 0; t < 3 * m; t++, o += 3, q += 2) { const w = corners[o + 2] || 1; uv[q] = corners[o] / w; uv[q + 1] = corners[o + 1] / w; }
      return uv;
    }
    const G = cur ? cur.G : null, n = cur ? cur.n : 0, C = cur ? cur.C : null, tri = new Float64Array(9);
    for (let t = 0, o = 0, q = 0; t < m; t++, o += 9, q += 6) {
      if (C) for (let k = 0; k < 9; k += 3) {
        const x = corners[o + k], y = corners[o + k + 1], z = corners[o + k + 2];
        tri[k] = C[0] * x + C[1] * y + C[2] * z; tri[k + 1] = C[3] * x + C[4] * y + C[5] * z; tri[k + 2] = C[6] * x + C[7] * y + C[8] * z;
      } else for (let k = 0; k < 9; k++) tri[k] = corners[o + k];
      if (n) {
        foldTri(tri, 0, G, n);
        if (tri[2] + tri[5] + tri[8] > cur.zHome) home(tri);         // (rare: a corner handed over on a far lift)
      }
      for (let k = 0; k < 3; k++) { const d = 1 + tri[3 * k + 2]; uv[q + 2 * k] = tri[3 * k] / d; uv[q + 2 * k + 1] = tri[3 * k + 1] / d; }
    }
    return uv;
  }

  return { bake, chartOf, prepare, get current() { return cur; } };
}
