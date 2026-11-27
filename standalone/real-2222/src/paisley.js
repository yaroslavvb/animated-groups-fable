// paisley.js — the print of every pattern on this page: Paisley, as on Classification of Surfaces.
//
// His ask, Thu 26 Nov 2026 (week 48): "for the pages in … twist-of-2222, make the patterns' visual style match what
// is done in … classification-of-surfaces", and a few minutes later: "Specifically, by visual style, I mean the
// paisley pattern. I want the twist of the 2-2-2-2 pattern to match what is done in the classification of surfaces
// page". Until then this page had commas of its own: a pair of them hugging each half-turn centre, in three sizes.
//
// The print is not copied here. design() is that page's own function (its src/sym/motifs.js): "a big comma in the
// middle of each cell, and a smaller one in every corner that has room", drawn on ONE tile from nothing but that
// tile's corners, and carried to every other tile by the symmetries. This file hands it this page's tiles and lays
// the result out. So a change to the print over there arrives here with the next build, and test/paisley.test.js
// holds the two together.
//
// What a tile is, group by group (tile coordinates: x along the row, y up):
//   2222   a domino across a row of centres: the cell above it and its twin below, [0, l] x [-w, w]. The centres of
//          that row sit in the middle of its two long sides. At twist 0 that is the tile of Classification of
//          Surfaces, the same way up. A BLOCK is the dominoes along one row: two rows of cells. A twist slides whole
//          blocks along the rows between them, so every comma keeps its shape and its place in its block
//   o      one cell, [0, l] x [0, w]; a twist slides each row of cells along the row of lattice points under it
//   **     one cell between two mirrors            *x     one cell between two mirrors, its sides joined by a glide
//   22*    the domino of 2222, between two mirrors
//   442    a square of two right triangles (the tile of Classification of Surfaces, turned an eighth)
//
// A placed comma is { kind: 'big' | 'small', ar, ai, bx, by, mir }: the point u of the unit comma UNIT[kind] lies at
// b + a * u (complex numbers; mir: u is mirrored first). A motion of the plane is { cs, sn, refl, tx, ty }:
// z -> (cs + i sn) * (refl ? conj(z) : z) + (tx + i ty).

import { design } from '../../classification-of-surfaces/src/sym/motifs.js';
import { geometry } from '../../classification-of-surfaces/src/sym/geom.js';

const E = geometry('E');
const H3 = (p) => [p[0], p[1], 1];
const QUARTER = Math.PI / 2;

/** That page's design on cells of the plane: [{ verts: [[x, y], ...] counter-clockwise, at: [x, y], twin? }]. */
export function cosDesign(cells) {
  const D = { G: E, n: cells[0].verts.length, cells: cells.map((c) => ({ verts: c.verts.map(H3), at: H3(c.at), twin: !!c.twin })) };
  return design(D).map((sh) => ({ pts: sh.pts.map((p) => [p[0], p[1]]), min: sh.min }));
}

/** A shape about the mean of its points, its farthest point at distance 1. */
function centred(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  let far = 0;
  for (const p of pts) far = Math.max(far, Math.hypot(p[0] - cx, p[1] - cy));
  return pts.map((p) => [(p[0] - cx) / far, (p[1] - cy) / far]);
}

const rect = (x0, y0, x1, y1, twin = false) => ({ verts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], at: [(x0 + x1) / 2, (y0 + y1) / 2], twin });

// The two commas of the design, read off the design itself (a long cell has both): nothing of their shape is
// written down here.
const REF = cosDesign([rect(0, 0, 2.4, 1)]);
export const UNIT = {
  big: centred(REF.find((s) => s.min < 5).pts),
  small: centred(REF.find((s) => s.min > 5).pts),
};
if (UNIT.big.length === UNIT.small.length) throw new Error('paisley: the two commas of the design cannot be told apart');

/** The similarity that takes the unit shape U (mean 0) onto P, point for point: P ~ b + a U. */
function fit(U, P) {
  let bx = 0, by = 0;
  for (const p of P) { bx += p[0]; by += p[1]; }
  bx /= P.length; by /= P.length;
  let re = 0, im = 0, nn = 0;
  for (let i = 0; i < U.length; i++) {
    const ux = U[i][0], uy = U[i][1], px = P[i][0] - bx, py = P[i][1] - by;
    re += px * ux + py * uy; im += py * ux - px * uy; nn += ux * ux + uy * uy;
  }
  return { ar: re / nn, ai: im / nn, bx, by };
}

/** The distance from a cell's middle to its nearest edge. */
function roomOf(cell) {
  const { verts: V, at } = cell;
  let room = Infinity;
  for (let i = 0; i < V.length; i++) {
    const a = V[i], b = V[(i + 1) % V.length], ex = b[0] - a[0], ey = b[1] - a[1];
    room = Math.min(room, Math.abs(ex * (at[1] - a[1]) - ey * (at[0] - a[0])) / Math.hypot(ex, ey));
  }
  return room;
}

// A corner comma is there or not: the design leaves it out below a size (a square cell has none, a cell half
// again as long as it is wide has four). On this page a cell changes shape under the finger, so the corner commas
// would pop in at one length. They grow in instead: CORNER_AT is the size (over the cell's room) at which the design
// first draws one, found by asking the design; a comma is at full size 12 % above it, and is left out while it
// would be under a tenth of its size (a speck).
const smallOf = (x) => { const f = cosDesign([rect(0, 0, x, 1)]).find((s) => s.min > 5); return f ? Math.hypot(fit(UNIT.small, f.pts).ar, fit(UNIT.small, f.pts).ai) / 0.5 : 0; };
export const CORNER_AT = (() => {
  let lo = 1, hi = 2.4;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (smallOf(mid) > 0) hi = mid; else lo = mid; }
  return smallOf(hi);
})();
const cornerEase = (size) => { const u = (size - CORNER_AT) / (0.12 * CORNER_AT), v = u < 0 ? 0 : u > 1 ? 1 : u, k = v * v * (3 - 2 * v); return k < 0.1 ? 0 : k; };

/**
 * The print of one tile, as placed commas, in the tile's own coordinates. cells as for cosDesign.
 * ease: the corner commas grow in from nothing (for a tile whose shape changes under the finger).
 * Each comma carries `cell`, the index of its cell.
 */
export function tilePrint(cells, { ease = false } = {}) {
  const out = [];
  let ci = -1;
  for (const sh of cosDesign(cells)) {
    const kind = sh.pts.length === UNIT.big.length ? 'big' : sh.pts.length === UNIT.small.length ? 'small' : null;
    if (!kind) throw new Error('paisley: a shape of the design is neither of its two commas');
    if (kind === 'big') ci++;
    const f = fit(UNIT[kind], sh.pts), it = { kind, cell: ci, ar: f.ar, ai: f.ai, bx: f.bx, by: f.by, mir: false };
    if (kind === 'small' && ease) {
      const k = cornerEase(Math.hypot(f.ar, f.ai) / roomOf(cells[ci]));
      if (k <= 0) continue;
      it.ar *= k; it.ai *= k;
    }
    out.push(it);
  }
  return out;
}

/** A placed comma turned by the angle d about the point c. */
function turned(it, c, d) {
  const cs = Math.cos(d), sn = Math.sin(d), x = it.bx - c[0], y = it.by - c[1];
  return { ...it, ar: cs * it.ar - sn * it.ai, ai: sn * it.ar + cs * it.ai, bx: c[0] + cs * x - sn * y, by: c[1] + sn * x + cs * y };
}

/** A placed comma carried by a motion of the plane. */
export function carry(it, M) {
  const ai = M.refl ? -it.ai : it.ai, by = M.refl ? -it.by : it.by;
  return {
    kind: it.kind, mir: M.refl ? !it.mir : it.mir,
    ar: M.cs * it.ar - M.sn * ai, ai: M.sn * it.ar + M.cs * ai,
    bx: M.cs * it.bx - M.sn * by + M.tx, by: M.sn * it.bx + M.cs * by + M.ty,
  };
}
export const carryAll = (tile, maps) => { const out = []; for (const M of maps) for (const it of tile) out.push(carry(it, M)); return out; };
export const sizeOf = (it) => Math.hypot(it.ar, it.ai);

/** The outline of a placed comma: [[x, y], ...]. */
export function outline(it) {
  const U = UNIT[it.kind], out = new Array(U.length), s = it.mir ? -1 : 1;
  for (let i = 0; i < U.length; i++) { const ux = U[i][0], uy = s * U[i][1]; out[i] = [it.bx + it.ar * ux - it.ai * uy, it.by + it.ai * ux + it.ar * uy]; }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The tiles and the motions that carry them, group by group

const shift = (tx, ty) => ({ cs: 1, sn: 0, refl: false, tx, ty });
const half = (tx, ty) => ({ cs: -1, sn: 0, refl: false, tx, ty });          // z -> -z + t: the half-turn about t / 2
const flipY = (tx, ty, cs = 1) => ({ cs, sn: 0, refl: true, tx, ty });       // z -> +-conj(z) + t

/** The big comma of a cell, turned back by q quarter-turns (so that a frame turned by q quarters prints the same). */
const unturn = (tile, cells, q90, extra = () => 0) => tile.map((it) => {
  if (it.kind !== 'big') return it;
  const d = -q90 * QUARTER + extra(it);
  return d ? turned(it, cells[it.cell].at, d) : it;
});

/**
 * 2222: the domino across a row of centres. The frame: the origin at a centre of that row, x along the row.
 *   l, w    a cell is l wide and w tall (l w = 1)
 *   bits    which of the eight prints of one grid of cells this is: 1 the dominoes that stand upright are those whose
 *           left centre is the odd one; 2 the blocks lie round the OTHER rows of centres (the ones w above); 4 the
 *           twin's big comma is turned half round (the tile then has its two cells side by side: the tile of a frame
 *           a quarter-turn away)
 *   q90     quarter-turns of the frame in the pane (see unturn)
 */
export function tile2222(l, w, bits = 0, q90 = 0) {
  const cells = [rect(0, 0, l, w), rect(0, -w, l, 0, true)];
  return unturn(tilePrint(cells, { ease: true }), cells, q90, (it) => (it.cell === 1 && (bits & 4) ? Math.PI : 0));
}
/** The dominoes of 2222 that reach into the box { x0, x1, y0, y1 } of the frame. s: how far a row is slid past the row under it. */
export function maps2222({ l, w, s, bits = 0 }, box) {
  const phi = bits & 1, beta = (bits >> 1) & 1, out = [];
  const m0 = Math.floor((box.y0 - (beta + 1) * w) / (2 * w)), m1 = Math.ceil((box.y1 - (beta - 1) * w) / (2 * w));
  for (let m = m0; m <= m1; m++) {
    const r = beta + 2 * m, xm = r * s, ym = r * w;
    const k0 = Math.floor((box.x0 - xm) / l) - 1, k1 = Math.ceil((box.x1 - xm) / l);
    for (let k = k0; k <= k1; k++) out.push(((k + phi) & 1) === 0 ? shift(xm + k * l, ym) : half(xm + (k + 1) * l, ym));
  }
  return out;
}

/** o: one cell; row j of cells is slid j s along the rows. */
export function tileO(l, w, q90 = 0) {
  const cells = [rect(0, 0, l, w)];
  return unturn(tilePrint(cells, { ease: true }), cells, q90);
}
export function mapsO({ l, w, s }, box) {
  const out = [];
  for (let j = Math.floor(box.y0 / w) - 1; j <= Math.ceil(box.y1 / w); j++) {
    for (let k = Math.floor((box.x0 - j * s) / l) - 1; k <= Math.ceil((box.x1 - j * s) / l); k++) out.push(shift(j * s + k * l, j * w));
  }
  return out;
}

/** ** and *x: one cell between the mirrors y = 0 and y = w. */
export function tileBand(l, w) { return tilePrint([rect(0, 0, l, w)], { ease: true }); }
export function mapsBand(g, { l, w }, box) {
  const out = [];
  for (let r = Math.floor(box.y0 / w) - 1; r <= Math.ceil(box.y1 / w); r++) {
    for (let m = Math.floor(box.x0 / l) - 1; m <= Math.ceil(box.x1 / l); m++) {
      const over = g === '*x' ? ((m + r) & 1) !== 0 : (r & 1) !== 0;
      out.push(over ? flipY(m * l, (r + 1) * w) : shift(m * l, r * w));
    }
  }
  return out;
}

/** 22*: the domino of 2222 across the row of half-turn centres y = 0; mirrors at y = +-w. */
export function tile22s(l, w) { return tilePrint([rect(0, 0, l, w), rect(0, -w, l, 0, true)], { ease: true }); }
export function maps22s({ l, w }, box) {
  const out = [];
  for (let k = Math.floor((box.y0 - w) / (2 * w)); k <= Math.ceil((box.y1 + w) / (2 * w)); k++) {
    for (let m = Math.floor(box.x0 / l) - 1; m <= Math.ceil(box.x1 / l); m++) {
      const up = (m & 1) === 0;
      if ((k & 1) === 0) out.push(up ? shift(m * l, 2 * k * w) : half((m + 1) * l, 2 * k * w));
      else out.push(up ? flipY(m * l, 2 * k * w) : flipY((m + 1) * l, 2 * k * w, -1));
    }
  }
  return out;
}

/**
 * 442: the unit square of two right triangles, cut along the diagonal from (0, 0) to (1, 1), both of them quarter-turn
 * centres. The design is made the way Classification of Surfaces makes it (the long side level, the first triangle
 * above it, its twin the mirror image below) and then turned an eighth, so the two pages show one picture.
 */
export function tile442() {
  const r2 = Math.SQRT2, h = r2 / 2, inY = h * (r2 - 1), cells = [
    { verts: [[0, 0], [r2, 0], [h, h]], at: [h, inY] },
    { verts: [[h, -h], [r2, 0], [0, 0]], at: [h, -inY], twin: true },
  ];
  const turn = { cs: Math.SQRT1_2, sn: Math.SQRT1_2, refl: false, tx: 0, ty: 0 };
  return tilePrint(cells).map((it) => ({ ...carry(it, turn), cell: it.cell }));
}
export function maps442(box) {
  const out = [];
  for (let r = Math.floor(box.y0) - 1; r <= Math.ceil(box.y1); r++) {
    for (let m = Math.floor(box.x0) - 1; m <= Math.ceil(box.x1); m++) {
      const ax = 2 * Math.floor((m + 1) / 2), ay = 2 * Math.floor((r + 1) / 2), dm = m - ax, dr = r - ay;
      if (dm === 0 && dr === 0) out.push(shift(ax, ay));
      else if (dm === -1 && dr === 0) out.push({ cs: 0, sn: 1, refl: false, tx: ax, ty: ay });
      else if (dm === -1 && dr === -1) out.push(half(ax, ay));
      else out.push({ cs: 0, sn: -1, refl: false, tx: ax, ty: ay });
    }
  }
  return out;
}

/**
 * Every comma of a group's print that reaches into a box of its frame.
 *   g      '2222' | 'o' | '**' | '*x' | '22*' | '442'
 *   P      { l, w, s, bits, q90 } as the group needs them
 *   box    { x0, x1, y0, y1 } in the frame (a margin of one cell is added by the walks above)
 */
export function printOf(g, P, box) {
  if (g === '2222') return carryAll(tile2222(P.l, P.w, P.bits || 0, P.q90 || 0), maps2222(P, box));
  if (g === 'o') return carryAll(tileO(P.l, P.w, P.q90 || 0), mapsO(P, box));
  if (g === '**' || g === '*x') return carryAll(tileBand(P.l, P.w), mapsBand(g, P, box));
  if (g === '22*') return carryAll(tile22s(P.l, P.w), maps22s(P, box));
  if (g === '442') return carryAll(tile442(), maps442(box));
  return [];
}

/**
 * A print in the pane. The frame the print is made in has its origin at the pane point `base` and its x axis along
 * the unit vector vh; paneBox is in pane coordinates.
 */
export function placedInPane(g, P, base, vh, paneBox) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [px, py] of [[paneBox.x0, paneBox.y0], [paneBox.x1, paneBox.y0], [paneBox.x1, paneBox.y1], [paneBox.x0, paneBox.y1]]) {
    const dx = px - base[0], dy = py - base[1], qx = dx * vh[0] + dy * vh[1], qy = dy * vh[0] - dx * vh[1];
    if (qx < x0) x0 = qx; if (qx > x1) x1 = qx;
    if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
  }
  const M = { cs: vh[0], sn: vh[1], refl: false, tx: base[0], ty: base[1] };
  return printOf(g, P, { x0, x1, y0, y1 }).map((it) => carry(it, M));
}

/** Do two prints put the same commas inside a box? (Every comma of either whose middle is in the box has its like in the other.) */
export function samePrint(A, B, box, tol = 1e-6) {
  const inBox = (it) => it.bx > box.x0 && it.bx < box.x1 && it.by > box.y0 && it.by < box.y1;
  const like = (it, list) => list.some((q) => q.kind === it.kind && q.mir === it.mir && Math.abs(q.bx - it.bx) < tol && Math.abs(q.by - it.by) < tol && Math.abs(q.ar - it.ar) < tol && Math.abs(q.ai - it.ai) < tol);
  return A.every((it) => !inBox(it) || like(it, B)) && B.every((it) => !inBox(it) || like(it, A));
}

/**
 * What a print looks like inside a box, as text: equal for two prints exactly when they put the same commas there.
 * Used to keep the picture when another pair is picked, and by the tests.
 */
export function signature(placed, box, digits = 4) {
  const rows = [];
  for (const it of placed) {
    if (it.bx < box.x0 || it.bx > box.x1 || it.by < box.y0 || it.by > box.y1) continue;
    rows.push([it.kind[0], it.mir ? 'm' : 'p', it.bx.toFixed(digits), it.by.toFixed(digits), it.ar.toFixed(digits), it.ai.toFixed(digits)].join(' ').replace(/-0\.0+(?= |$)/g, (z) => z.slice(1)));
  }
  rows.sort();
  return rows.join(';');
}

// ---------------------------------------------------------------------------------------------------------------
// The print on the paper of the 3D pane: the signed distance to the commas over one cell of the pattern
// (The Folding's renderer, render3d.js mode 3)

function sdPolygon(poly, x, y) {
  let d2 = Infinity, inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], ay = poly[j][1], bx = poly[i][0], by = poly[i][1];
    const ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
    const tt = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
    const px = wx - tt * ex, py = wy - tt * ey, q = px * px + py * py;
    if (q < d2) d2 = q;
    if ((ay > y) !== (by > y) && x < ax + ((y - ay) * ex) / ey) inside = !inside;
  }
  const d = Math.sqrt(d2);
  return inside ? -d : d;
}

export const FIELD_HALF = 2.2;        // a unit comma's field covers [-2.2, 2.2]^2: the comma (within 1) and room round it
/** The signed distance to each unit comma (negative inside), sampled on an n x n grid: { big, small }. */
export function unitFields(n = 208) {
  const make = (U) => {
    const data = new Float32Array(n * n), step = (2 * FIELD_HALF) / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = sdPolygon(U, -FIELD_HALF + (i + 0.5) * step, -FIELD_HALF + (j + 0.5) * step);
    return { n, half: FIELD_HALF, data };
  };
  return { big: make(UNIT.big), small: make(UNIT.small) };
}
function fieldAt(F, x, y) {
  const n = F.n, u = ((x + F.half) / (2 * F.half)) * n - 0.5, v = ((y + F.half) / (2 * F.half)) * n - 0.5;
  if (!(u >= 0 && v >= 0 && u <= n - 1 && v <= n - 1)) return Math.max(0.6, Math.hypot(x, y) - 1);
  const i = Math.min(n - 2, Math.floor(u)), j = Math.min(n - 2, Math.floor(v)), fx = u - i, fy = v - j, d = F.data, o = j * n + i;
  return (d[o] * (1 - fx) + d[o + 1] * fx) * (1 - fy) + (d[o + n] * (1 - fx) + d[o + n + 1] * fx) * fy;
}

export const PRINT_RANGE = 0.08;      // where the print's texture saturates, in paper units

/** The signed distance from (x, y) to one placed comma. */
export function commaDistance(fields, it, x, y) {
  const r2 = it.ar * it.ar + it.ai * it.ai, dx = x - it.bx, dy = y - it.by;
  const ux = (it.ar * dx + it.ai * dy) / r2, uy = (it.ar * dy - it.ai * dx) / r2;
  return Math.sqrt(r2) * fieldAt(fields[it.kind], ux, it.mir ? -uy : uy);
}
/** The signed distance from (x, y) to the nearest of the placed commas (slow: for the tests). */
export function printDistance(fields, placed, x, y) {
  let best = 1e3;
  for (const it of placed) { const d = commaDistance(fields, it, x, y); if (d < best) best = d; }
  return best;
}

/**
 * One cell of a pattern as the renderer's shape print: the cell spanned by a and b from the origin, `size` texels a
 * side, written into `data` (a Uint8Array of size * size; a new one when none is given). placed: every comma that
 * comes within PRINT_RANGE of the cell (printOf over the cell's box).
 * -> { mode: 3, A, I, O, tex: { size, data, range } }
 */
export function printTexture(fields, placed, a, b, size = 256, data = null) {
  const det = a[0] * b[1] - a[1] * b[0], I = [b[1] / det, -b[0] / det, -a[1] / det, a[0] / det];
  const out = data && data.length === size * size ? data : new Uint8Array(size * size);
  const range = PRINT_RANGE, G = 32, bins = new Array(G * G);
  // each comma goes into the bins of the cell (G x G of them) it can colour
  for (let n = 0; n < placed.length; n++) {
    const it = placed[n], reach = sizeOf(it) + 1.25 * range;
    const sc = I[0] * it.bx + I[1] * it.by, tc = I[2] * it.bx + I[3] * it.by;
    const ds = reach * Math.hypot(I[0], I[1]), dt = reach * Math.hypot(I[2], I[3]);
    const i0 = Math.max(0, Math.floor((sc - ds) * G)), i1 = Math.min(G - 1, Math.floor((sc + ds) * G));
    const j0 = Math.max(0, Math.floor((tc - dt) * G)), j1 = Math.min(G - 1, Math.floor((tc + dt) * G));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) (bins[j * G + i] || (bins[j * G + i] = [])).push(it);
  }
  for (let j = 0; j < size; j++) {
    const t = (j + 0.5) / size, bj = Math.min(G - 1, Math.floor(t * G)) * G;
    for (let i = 0; i < size; i++) {
      const s = (i + 0.5) / size, list = bins[bj + Math.min(G - 1, Math.floor(s * G))];
      let d = range;
      if (list) { const x = s * a[0] + t * b[0], y = s * a[1] + t * b[1]; for (let n = 0; n < list.length; n++) { const q = commaDistance(fields, list[n], x, y); if (q < d) d = q; } }
      const v = Math.round(128 + 127 * Math.max(-1, Math.min(1, d / range)));
      out[j * size + i] = v < 1 ? 1 : v > 255 ? 255 : v;
    }
  }
  return {
    mode: 3,
    A: Float32Array.of(a[0], a[1], b[0], b[1]),
    I: Float32Array.of(I[0], I[1], I[2], I[3]),
    O: Float32Array.of(0, 0, range),
    tex: { size, data: out, range },
  };
}

/** The box of the frame that holds the cell spanned by a and b from the origin. */
export function cellBox(a, b) {
  const xs = [0, a[0], b[0], a[0] + b[0]], ys = [0, a[1], b[1], a[1] + b[1]];
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
