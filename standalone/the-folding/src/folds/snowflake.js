// snowflake.js — the fold of the four kaleidoscopes *2222, *442, *333, *632 (SPEC 5.3, 5.7).
//
// Every side of the tile is a mirror: nothing is cut, nothing is glued, the orbifold IS the flat tile. So the fold
// shows the plane folding onto the tile along its mirrors, the way a paper snowflake is folded before it is cut.
//
//   patch     the star of the 2n cells around the corner of the tile with the largest order n (12, 8, 6 or 4 cells);
//   sequence  fold the patch in half along a mirror through that corner, again and again, each time over the top
//             (+z), until one sector is left: the tile. With m sectors left the crease is the mirror after the first
//             ceil(m / 2) of them, so the tile's own sector never moves;
//   paper     every cell is one rigid flat piece. The sheets of the folded stack lie one spacing apart; a fold turns
//             its flap about a line at half the height of the stack it makes, so the flap lands exactly on top and no
//             sheet ever meets another. The sheets that run through a crease are joined there by a thin round
//             spine (a strip of the mesh that has no width while the patch is flat).
//
//   createFold(group, domain, mesh, opts) -> { mesh, stops, duration, at(t), star, ... }
//     mesh    the fold's OWN mesh of the star (the argument, the mesh of the single tile, is not used): pieces
//             0 … 2n-1 are the cells (mesh.cells), piece 0 the base tile (the cell that holds the seed), `tint` 0 on
//             the base tile and 1 elsewhere, `boundary` = the base tile's mirror edges, `creases` = the mirrors
//             through the corner.
//     star    the cell polygons of the patch in the plane, star[0] = the base tile (for the plane view's outline)
//     opts    { density, spacing, spines, chirality }   all optional (see createFold)
//
// Pieces beyond the cells. at(t)(x, y, piece, out) also knows pieces that carry no cell of their own; their indices
// (>= mesh.cells.length) only ever appear in mesh.cell, in boundary[].cells, in creases[].b and as a result of
// mesh.locate, i.e. where a piece index is handed straight back to at(t):
//   rows of a spine     the vertices of the spine strips;
//   crease pieces       creases[j].b: the middle between the two sides of the crease. Before the crease is folded
//                       that is the paper itself; afterwards it is the axis of the fold, so all the creases that
//                       end up along one folded edge of the stack are drawn as ONE line. During the last fold each
//                       also drifts up by what it lacks to the top of the stack: folded, every mirror of the star
//                       lies on a side of the tile, and its crease line ends exactly under the tile's bold outline;
//   the lid             mesh.lid: stays over the base tile, at the height of the top sheet that covers it.
//                       mesh.locate of a point of the base tile gives this piece (the motif drawn on the tile rides on
//                       the top sheet). The base tile's own surface is piece 0 and never moves.
//   outline pieces      mesh.outline[i] (= boundary[i].cells): one per side of the base tile. Every sheet of the stack
//                       carries the tile's outline at the same place and the one that shows is the top one, so the
//                       outline rides on top, never buried under the sheets. On top of the TALLER stack: a side of
//                       the tile is also the edge of the neighbouring stack, which can hold more sheets than the
//                       tile's own (*632 after its third fold: 8 against 4; *333 after its second: 4 against 2) and
//                       whose folded edge bulges over the side. So each corner of the tile is lifted to the top of
//                       the tallest stack that meets there (the pivot meets them all), and each side runs straight
//                       between its two corners: the outline lies on the topmost paper along it at every stop and
//                       never reads as a crease (a hidden line is drawn grey, like the dashed creases under it).
//                       Between stops the corners rise with the lid. The cone-point markers take these pieces too.
//
// Which way round. The first crease is one of the two mirrors of the base tile at the corner. It is chosen for the
// default viewer, who looks along +y: the more level crease (a flap that turns about a crease pointing at the eye is
// seen edge-on half way), and, three times as important, the one that leaves the tile's half of the patch on the
// near side, so that the far half comes toward the eye. `opts.chirality` = +1 / -1 forces the counter-clockwise /
// clockwise choice.

import { compose, inverse, apply, det, rot, refl } from '../geom.js';
import { elementsNear } from '../groups.js';

/** Distance between neighbouring sheets of the folded stack, in units of the tile size sqrt(domainArea). */
export const LAYER_SPACING = 0.008;

const TRI_DENSITY = 16;        // subdivisions of a side of a triangular cell
const QUAD_DENSITY = 14;       // subdivisions of the longer side of a rectangular cell
const SPINE_ROWS = 6;          // facets across a spine (half a turn)
const RAMP = 0.32;             // share of a fold spent speeding up (and again slowing down)
const LID_FROM = (110 * Math.PI) / 180;   // the lid starts rising to the new top sheet when the flap has turned this far
const WORDS = { 2: 'half', 3: 'third', 4: 'quarter', 6: 'sixth', 8: 'eighth', 12: 'twelfth' };

/**
 * Progress of one fold, 0 -> 1 for u in [0, 1]: the speed rises smoothly from rest (a smoothstep ramp), stays
 * constant, and falls back to rest — speed and acceleration are continuous and both vanish at the two ends.
 */
export function ease(u) {
  if (!(u > 0)) return 0;
  if (u >= 1) return 1;
  const V = 1 / (1 - RAMP);
  if (u < RAMP) { const x = u / RAMP; return V * RAMP * x * x * x * (1 - x / 2); }
  if (u > 1 - RAMP) { const x = (1 - u) / RAMP; return 1 - V * RAMP * x * x * x * (1 - x / 2); }
  return V * (u - RAMP / 2);
}

/**
 * The folding sequence for a corner of order n, in sectors (sector k spans the angles [k, k + 1] * pi / n, the
 * base tile is sector 0). Returns
 *   folds[f] = { c, m, moving, from, layerBefore, axisLayer, sheets }
 *       m sectors are left before the fold, the crease is the ray c * pi / n (c = ceil(m / 2)), `moving` lists the
 *       sectors (cells) of the flap, from[k] is the sector cell k lies over before the fold, layerBefore[k] its
 *       sheet in the stack (0 = bottom); the flap turns about a line at height axisLayer (in sheets) and the
 *       stack has `sheets` sheets afterwards;
 *   layer[k]  the sheet of cell k in the final stack (0 for the base tile, all different).
 */
export function foldPlan(n) {
  const S = 2 * n;
  const loc = Array.from({ length: S }, (_, k) => k);
  const layer = new Array(S).fill(0);
  const count = new Array(S).fill(1);
  const folds = [];
  let m = S;
  while (m > 1) {
    const c = Math.ceil(m / 2);
    let H = 0, Hs = 0;                   // sheets in the flap / in the stack it lands on
    for (let j = c; j < m; j++) { H = Math.max(H, count[j]); Hs = Math.max(Hs, count[2 * c - 1 - j]); }
    const top = H + Hs - 1;
    const from = loc.slice(), layerBefore = layer.slice(), moving = [];
    for (let k = 0; k < S; k++) {
      if (loc[k] < c) continue;
      moving.push(k);
      layer[k] = top - layer[k];
      loc[k] = 2 * c - 1 - loc[k];
    }
    for (let j = c; j < m; j++) { count[2 * c - 1 - j] += count[j]; count[j] = 0; }
    folds.push({ c, m, moving, from, layerBefore, axisLayer: top / 2, sheets: H + Hs });
    m = c;
  }
  return { folds, layer, sectors: S };
}

// ---------------------------------------------------------------------------------------------------------------
// geometry of the star
// ---------------------------------------------------------------------------------------------------------------

function centroidOf(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0] / poly.length; y += p[1] / poly.length; }
  return [x, y];
}

/** The kaleidoscope element g with (x, y) in g(T): the cell that holds the point (the most interior one on a tie). */
function cellOfPoint(kal, x, y) {
  const T = kal.cell, K = T.length, cen = centroidOf(T);
  let rad = 0;
  for (const p of T) rad = Math.max(rad, Math.hypot(p[0] - cen[0], p[1] - cen[1]));
  let best = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }, bestS = -Infinity;      // (T itself if nothing is found: a point that is not finite)
  for (let grow = 1; grow <= 4 && bestS === -Infinity; grow *= 2) {
    for (const g of elementsNear(kal.group, x, y, rad * 1.001 * grow, cen[0], cen[1])) {
      const u = apply(inverse(g), x, y);
      let s = Infinity;
      for (let i = 0; i < K; i++) {
        const a = T[i], b = T[(i + 1) % K], dx = b[0] - a[0], dy = b[1] - a[1];
        s = Math.min(s, (dx * (u[1] - a[1]) - dy * (u[0] - a[0])) / Math.hypot(dx, dy));
      }
      if (s > bestS) { bestS = s; best = g; }
    }
  }
  return { a: best.a, b: best.b, c: best.c, d: best.d, tx: best.tx, ty: best.ty };
}

/** Order of corner i of the mirror polygon T: its interior angle is pi / order. */
function cornerOrder(T, i) {
  const K = T.length, p = T[i], a = T[(i + 1) % K], b = T[(i + K - 1) % K];
  const ax = a[0] - p[0], ay = a[1] - p[1], bx = b[0] - p[0], by = b[1] - p[1];
  return Math.round(Math.PI / Math.atan2(Math.abs(ax * by - ay * bx), ax * bx + ay * by));
}

/** The corner of T the star is built around: the largest order; among those, the one nearest group.center. */
function pivotCorner(group) {
  const T = group.kaleido.cell;
  let best = 0, bestN = 0, bestD = Infinity;
  for (let i = 0; i < T.length; i++) {
    const n = cornerOrder(T, i), d = Math.hypot(T[i][0] - group.center[0], T[i][1] - group.center[1]);
    if (n > bestN || (n === bestN && d < bestD - 1e-9)) { best = i; bestN = n; bestD = d; }
  }
  return { index: best, order: bestN };
}

/** One triangulation of T (uniform; every cell of the star is a copy of it, so stacked sheets have coinciding triangles). */
function template(T, density) {
  const uv = [], tri = [];
  if (T.length === 3) {
    const N = Math.max(1, Math.round(density || TRI_DENSITY));
    const id = (i, j) => (i * (2 * N + 3 - i)) / 2 + j;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N - i; j++) {
        const k = N - i - j;
        uv.push((k * T[0][0] + i * T[1][0] + j * T[2][0]) / N, (k * T[0][1] + i * T[1][1] + j * T[2][1]) / N);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N - i; j++) {
        tri.push(id(i, j), id(i + 1, j), id(i, j + 1));
        if (i + j <= N - 2) tri.push(id(i + 1, j), id(i + 1, j + 1), id(i, j + 1));
      }
    }
  } else {
    const ux = T[1][0] - T[0][0], uy = T[1][1] - T[0][1], vx = T[3][0] - T[0][0], vy = T[3][1] - T[0][1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    const N = Math.max(1, Math.round(density || QUAD_DENSITY)), step = Math.max(lu, lv) / N;
    const nu = Math.max(1, Math.round(lu / step)), nv = Math.max(1, Math.round(lv / step));
    const id = (i, j) => i * (nv + 1) + j;
    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j <= nv; j++) uv.push(T[0][0] + (i / nu) * ux + (j / nv) * vx, T[0][1] + (i / nu) * uy + (j / nv) * vy);
    }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
        if ((i + j) & 1) tri.push(a, b, d, b, c, d); else tri.push(a, b, c, a, c, d);
      }
    }
  }
  return { uv, tri };
}

// ---------------------------------------------------------------------------------------------------------------
// rigid motions of space as 3 x 4 matrices [R | t], row-major in arrays of 12
// ---------------------------------------------------------------------------------------------------------------

const IDENT12 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

/** Right-handed rotation with cos c, sin s about the horizontal line through (ax, ay, az) with unit direction (ex, ey, 0). */
function axisRotation(ax, ay, az, ex, ey, c, s, out) {
  const k = 1 - c;
  const r00 = c + k * ex * ex, r01 = k * ex * ey, r02 = s * ey;
  const r11 = c + k * ey * ey, r12 = -s * ex;
  const r20 = -s * ey, r21 = s * ex;
  out[0] = r00; out[1] = r01; out[2] = r02; out[3] = ax - (r00 * ax + r01 * ay + r02 * az);
  out[4] = r01; out[5] = r11; out[6] = r12; out[7] = ay - (r01 * ax + r11 * ay + r12 * az);
  out[8] = r20; out[9] = r21; out[10] = c; out[11] = az - (r20 * ax + r21 * ay + c * az);
  return out;
}

/** out = A∘B (B first). */
function mul12(A, B, out) {
  for (let r = 0; r < 3; r++) {
    const a0 = A[4 * r], a1 = A[4 * r + 1], a2 = A[4 * r + 2];
    out[4 * r] = a0 * B[0] + a1 * B[4] + a2 * B[8];
    out[4 * r + 1] = a0 * B[1] + a1 * B[5] + a2 * B[9];
    out[4 * r + 2] = a0 * B[2] + a1 * B[6] + a2 * B[10];
    out[4 * r + 3] = a0 * B[3] + a1 * B[7] + a2 * B[11] + A[4 * r + 3];
  }
  return out;
}

const flat = (x, y, cell, out = [0, 0, 0]) => { out[0] = x; out[1] = y; out[2] = 0; return out; };

/** How well a first crease reads from the default view; ny = y of its unit normal on the base tile's side. */
export function creaseScore(ny) { return (ny < 0 ? 3 : 1) * Math.abs(ny); }

// ---------------------------------------------------------------------------------------------------------------
// the fold
// ---------------------------------------------------------------------------------------------------------------

/**
 * opts.density    subdivisions of a cell's side (default 16 for triangles, 14 along the longer side of a rectangle)
 * opts.spacing    distance between sheets in units of sqrt(domainArea) (default LAYER_SPACING)
 * opts.spines     false: no spine strips, only the flat cells (default true)
 * opts.chirality  +1 | -1: force which mirror of the base tile is the first crease (default: by the viewer, see above)
 */
export default function createFold(group, domain, coreMesh, opts = {}) {
  const kal = group.kaleido;
  if (!kal || !kal.cell) throw new Error('snowflake fold: group ' + group.id + ' has no kaleidoscope cell');
  const T = kal.cell, K = T.length;
  const size = Math.sqrt(group.domainArea);
  const sp = (opts.spacing > 0 ? opts.spacing : LAYER_SPACING) * size;

  // ---- the base tile g0(T) and the corner the star is built around
  let seed = (domain && domain.seed) || group.presets[0].seed;
  if (!Number.isFinite(seed[0] + seed[1])) seed = group.presets[0].seed;
  const g0 = cellOfPoint(kal, seed[0], seed[1]);
  const piv = pivotCorner(group), n = piv.order, S = 2 * n, alpha = Math.PI / n;
  const P = apply(g0, T[piv.index][0], T[piv.index][1]);
  const Ea = apply(g0, T[(piv.index + 1) % K][0], T[(piv.index + 1) % K][1]);
  const Eb = apply(g0, T[(piv.index + K - 1) % K][0], T[(piv.index + K - 1) % K][1]);
  // E1: far end of the tile's clockwise-most side at the corner, E2: of its counter-clockwise-most side
  const pos0 = det(g0) > 0, E1 = pos0 ? Ea : Eb, E2 = pos0 ? Eb : Ea;
  const th1 = Math.atan2(E1[1] - P[1], E1[0] - P[0]), th2 = Math.atan2(E2[1] - P[1], E2[0] - P[0]);
  // first crease along side 1 (sectors counted counter-clockwise, chi = +1) or along side 2 (clockwise, chi = -1)?
  // ny = the y component of the crease's unit normal on the tile's side: cos(th1) for side 1, -cos(th2) for side 2.
  // |ny| says how level the crease is (0: it points at the default viewer and its flap is seen edge-on half way);
  // ny < 0 says the tile's half is the near one, so the flap comes toward the viewer.
  let chi = creaseScore(-Math.cos(th2)) > creaseScore(Math.cos(th1)) + 1e-9 ? -1 : 1;
  if (opts.chirality === 1 || opts.chirality === -1) chi = opts.chirality;
  const theta = chi > 0 ? th1 : th2;
  const F0 = chi > 0 ? E1 : E2, F1 = chi > 0 ? E2 : E1;     // far ends of spoke 0 and spoke 1

  // ---- sectors: sector k spans the world angles theta + chi * [k, k + 1] * alpha; its cell is Rk(base tile)
  const Rk = [], spokeEnd = [];
  for (let k = 0; k < S; k++) {
    Rk.push(k % 2 === 0 ? rot(chi * k * alpha, P[0], P[1]) : refl(P[0], P[1], theta + (chi * (k + 1) * alpha) / 2));
    spokeEnd.push(k % 2 === 0 ? apply(Rk[k], F0[0], F0[1]) : apply(Rk[k], F1[0], F1[1]));   // spoke k: between sectors k-1 and k
  }
  // pieces in breadth-first order from the base tile: sectors 0, 1, S-1, 2, S-2, …, n
  const sectorOf = [0];
  for (let d = 1; d < n; d++) sectorOf.push(d, S - d);
  sectorOf.push(n);
  const pieceOf = new Array(S);
  sectorOf.forEach((k, p) => { pieceOf[k] = p; });

  // ---- the mesh of the star: one copy of T's triangulation per cell, no vertex shared between cells
  const tpl = template(T, opts.density), nvT = tpl.uv.length / 2, ntT = tpl.tri.length / 3;
  const cells = [];
  const xy64 = [], cellV = [], tintV = [], tri = [], triCell = [];
  const tmp = [0, 0];
  for (let p = 0; p < S; p++) {
    const k = sectorOf[p], g = compose(Rk[k], g0), flip = det(g) < 0, base = xy64.length / 2;
    for (let i = 0; i < nvT; i++) { apply(g, tpl.uv[2 * i], tpl.uv[2 * i + 1], tmp); xy64.push(tmp[0], tmp[1]); cellV.push(p); tintV.push(p === 0 ? 0 : 1); }
    for (let t = 0; t < ntT; t++) {
      const a = base + tpl.tri[3 * t], b = base + tpl.tri[3 * t + 1], c = base + tpl.tri[3 * t + 2];
      if (flip) tri.push(a, c, b); else tri.push(a, b, c);
      triCell.push(p);
    }
    const poly = T.map((q) => apply(g, q[0], q[1]));
    const parentK = k === 0 ? -1 : (k <= n ? k - 1 : (k + 1) % S), hingeSpoke = k <= n ? k : (k + 1) % S;
    let hinge = null;
    if (k !== 0) {
      const cen = centroidOf(poly), Q = spokeEnd[hingeSpoke];
      const left = (Q[0] - P[0]) * (cen[1] - P[1]) - (Q[1] - P[1]) * (cen[0] - P[0]) > 0;
      hinge = left ? { ax: P[0], ay: P[1], bx: Q[0], by: Q[1] } : { ax: Q[0], ay: Q[1], bx: P[0], by: P[1] };
    }
    cells.push({
      index: p, g, parity: flip ? 1 : 0, poly, area: group.domainArea,
      parent: parentK < 0 ? -1 : pieceOf[parentK], depth: Math.min(k, S - k), hinge, cellId: p, sector: k, layer: 0,
    });
  }

  // ---- the folds, in world coordinates
  const plan = foldPlan(n), NF = plan.folds.length;
  for (let k = 0; k < S; k++) cells[pieceOf[k]].layer = plan.layer[k];
  const sectorPoly = (k) => cells[pieceOf[k]].poly;
  const folds = plan.folds.map((f) => {
    const w = theta + chi * f.c * alpha, dx = Math.cos(w), dy = Math.sin(w);
    let reach = 0;                                           // how far the flap reaches from the crease
    for (let k = 0; k < S; k++) {
      if (f.from[k] < f.c) continue;
      for (const q of sectorPoly(f.from[k])) reach = Math.max(reach, Math.abs(dx * (q[1] - P[1]) - dy * (q[0] - P[0])));
    }
    const moves = new Uint8Array(S);
    for (const k of f.moving) moves[k] = 1;
    // the flap is on the left of the direction (ex, ey), so a right-handed turn about it lifts the flap toward +z
    const full = axisRotation(P[0], P[1], f.axisLayer * sp, chi * dx, chi * dy, -1, 0, new Array(12));
    return { ...f, moves, ex: chi * dx, ey: chi * dy, az: f.axisLayer * sp, reach, full, angle: w };
  });

  // ---- spines: the sheet that runs through a crease bends there round a half cylinder about the fold's axis.
  // Spoke j (between sectors j-1 and j) is creased by exactly one fold: the one that moves one of the two sectors.
  const useSpines = opts.spines !== false;
  const spokes = [];
  for (let j = 0; j < S; j++) {
    const k0 = (j + S - 1) % S, k1 = j;
    let fi = -1;
    for (let f = 0; f < NF; f++) if (folds[f].moves[k0] !== folds[f].moves[k1]) { fi = f; break; }
    const still = fi >= 0 && folds[fi].moves[k0] ? k1 : k0, flap = still === k0 ? k1 : k0;
    const radius = fi >= 0 ? (folds[fi].axisLayer - folds[fi].layerBefore[still]) * sp : 0;
    spokes.push({ j, k0, k1, fold: fi, still, flap, radius, end: spokeEnd[j] });
  }

  // ---- the outline: the base tile's sides (all mirrors) as the domain draws them (with the wave up they still lie
  // on the straight sides: the warp slides points along the mirrors and keeps the corners), each running straight
  // between two corners whose height is the top of the tallest stack that meets there
  const basePoly = cells[0].poly, tol = 1e-6 * size;
  const outline = domain && typeof domain.outline === 'function' ? domain.outline(size / 40) : basePoly.map((a, i) => {
    const b = basePoly[(i + 1) % K], m = 16, pts = new Float32Array(2 * (m + 1));
    for (let j = 0; j <= m; j++) { pts[2 * j] = a[0] + (j / m) * (b[0] - a[0]); pts[2 * j + 1] = a[1] + (j / m) * (b[1] - a[1]); }
    return { edge: i, pts };
  });
  // tops[f][p]: the top sheet of the stack over the place of sector p after f folds (-1: no paper there any more)
  const tops = [];
  for (let f = 0; f <= NF; f++) {
    const cnt = new Array(S).fill(0);
    for (let k = 0; k < S; k++) cnt[f < NF ? plan.folds[f].from[k] : 0]++;
    tops.push(cnt.map((c) => c - 1));
  }
  // the places a corner belongs to: the pivot, all of them; the far end of spoke 0 (1), the tile's and the one
  // across spoke 0 (1); any other corner, the tile's alone
  const near = (q, r) => Math.hypot(q[0] - r[0], q[1] - r[1]) < tol;
  const placesOf = (q) => (near(q, P) ? tops[0].map((_, p) => p) : near(q, spokeEnd[0]) ? [0, S - 1] : near(q, spokeEnd[1]) ? [0, 1] : [0]);
  const cornerTops = (q) => { const pl = placesOf(q); return tops.map((top) => pl.reduce((h, p) => Math.max(h, top[p]), 0)); };
  const cornerAt = (x, y) => basePoly.find((q) => near(q, [x, y])) || [x, y];     // exact, not the Float32 sample
  const sides = outline.map((o) => {
    const m = o.pts.length / 2, A = cornerAt(o.pts[0], o.pts[1]), B = cornerAt(o.pts[2 * m - 2], o.pts[2 * m - 1]);
    return { A, B, hA: cornerTops(A), hB: cornerTops(B) };     // hA[f]: the corner's height in sheets after f folds
  });

  // ---- transforms. Piece q (a cell, or one row of a spine) in stage f: turn by frac[f][q] * phi about fold f's axis, after pre[f][q].
  // Piece indices: 0 … S-1 the cells; then the rows of the spines; then one crease piece per spoke; the lid; last
  // one outline piece per side of the base tile.
  const rows = useSpines ? SPINE_ROWS : 0;
  const CR = S + (useSpines ? S * (rows - 1) : 0), LID = CR + S, OUT = LID + 1, NP = OUT + sides.length;
  const virtualOf = (j, i) => S + j * (rows - 1) + (i - 1);          // row i = 1 … rows-1 of spoke j's spine
  const pre = [], frac = [];
  for (let f = 0; f < NF; f++) { pre.push(new Array(CR)); frac.push(new Float64Array(CR)); }
  const history = (q, moveIn, ownFold, ownFrac) => {
    let cur = IDENT12;
    for (let f = 0; f < NF; f++) {
      pre[f][q] = cur;
      if (f === ownFold) {
        frac[f][q] = ownFrac;
        const a = Math.PI * ownFrac, F = folds[f];
        cur = mul12(axisRotation(P[0], P[1], F.az, F.ex, F.ey, Math.cos(a), Math.sin(a), new Array(12)), cur, new Array(12));
      } else if (folds[f].moves[moveIn]) { frac[f][q] = 1; cur = mul12(folds[f].full, cur, new Array(12)); }
    }
    return cur;
  };
  const final = new Array(CR);
  for (let k = 0; k < S; k++) final[pieceOf[k]] = history(pieceOf[k], k, -1, 0);
  if (useSpines) {
    for (const s of spokes) for (let i = 1; i < rows; i++) final[virtualOf(s.j, i)] = history(virtualOf(s.j, i), s.still, s.fold, i / rows);
  }

  // ---- the spine strips of the mesh (all rows of a strip lie on the spoke while the patch is flat)
  const cellTriangles = tri.length / 3;
  if (useSpines) {
    const along = Math.max(2, Math.round((opts.density || (K === 3 ? TRI_DENSITY : QUAD_DENSITY)) / 2));
    const o3 = [0, 0, 0], q3 = [0, 0, 0], r3 = [0, 0, 0];
    const image = (M, x, y, out) => { out[0] = M[0] * x + M[1] * y + M[3]; out[1] = M[4] * x + M[5] * y + M[7]; out[2] = M[8] * x + M[9] * y + M[11]; return out; };
    for (const s of spokes) {
      if (s.fold < 0 || !(s.radius > 0)) continue;
      const base = xy64.length / 2;
      for (let i = 0; i <= rows; i++) {
        const piece = i === 0 ? pieceOf[s.still] : i === rows ? pieceOf[s.flap] : virtualOf(s.j, i);
        for (let a = 0; a <= along; a++) {
          xy64.push(P[0] + (a / along) * (s.end[0] - P[0]), P[1] + (a / along) * (s.end[1] - P[1]));
          cellV.push(piece); tintV.push(1);
        }
      }
      // winding: the strip continues the still cell, so its first facet must face the way that cell faces
      // (compared in the folded state, where the strip has opened; all later folds move the two together)
      const id = (i, a) => base + i * (along + 1) + a;
      const M0 = final[pieceOf[s.still]], M1 = final[virtualOf(s.j, 1)];
      image(M0, P[0], P[1], o3); image(M0, s.end[0], s.end[1], q3); image(M1, P[0], P[1], r3);
      const ux = q3[0] - o3[0], uy = q3[1] - o3[1], uz = q3[2] - o3[2];       // along the spoke
      const vx = r3[0] - o3[0], vy = r3[1] - o3[1], vz = r3[2] - o3[2];       // across: row 0 -> row 1
      const swap = (uy * vz - uz * vy) * M0[2] + (uz * vx - ux * vz) * M0[6] + (ux * vy - uy * vx) * M0[10] < 0;
      const owner = pieceOf[s.still];
      for (let i = 0; i < rows; i++) {
        for (let a = 0; a < along; a++) {
          const A = id(i, a), B = id(i, a + 1), C = id(i + 1, a + 1), D = id(i + 1, a);
          if (swap) tri.push(A, C, B, A, D, C); else tri.push(A, B, C, A, C, D);
          triCell.push(owner, owner);
        }
      }
    }
  }

  // ---- typed arrays
  const nV = xy64.length / 2, nTri = tri.length / 3;
  const xy = new Float32Array(xy64), cell = Uint16Array.from(cellV), tint = Uint8Array.from(tintV);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let v = 0; v < nV; v++) {
    const x = xy[2 * v], y = xy[2 * v + 1];
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }

  // ---- locate: the base tile first (its rim included) — a point of it is given the lid, i.e. it is drawn on the
  // top sheet over the tile; any other point gets the cell of its direction from the corner
  const baseSign = cells[0].parity ? -1 : 1;
  const locate = (x, y) => {
    let inside = true;
    for (let i = 0; i < K && inside; i++) {
      const a = basePoly[i], b = basePoly[(i + 1) % K], dx = b[0] - a[0], dy = b[1] - a[1];
      if (baseSign * (dx * (y - a[1]) - dy * (x - a[0])) < -tol * Math.hypot(dx, dy)) inside = false;
    }
    if (inside) return LID;
    let lam = chi * (Math.atan2(y - P[1], x - P[0]) - theta);
    lam -= 2 * Math.PI * Math.floor(lam / (2 * Math.PI));
    const f = lam / alpha, k = Math.min(S - 1, Math.floor(f));
    let p = pieceOf[k];
    if (f - k < 1e-9) p = Math.min(p, pieceOf[(k + S - 1) % S]); else if (k + 1 - f < 1e-9) p = Math.min(p, pieceOf[(k + 1) % S]);
    return p;
  };

  // ---- boundary: the base tile's edges (all mirrors), side i on outline piece OUT + i; creases: the 2n mirrors
  // through the corner
  const boundary = outline.map((o, i) => ({ edge: o.edge, cls: -1, kind: 'mirror', pts: o.pts, cells: new Uint16Array(o.pts.length / 2).fill(OUT + i) }));
  // creases[j]: a = the cell on the side that stays when the crease is folded, b = the crease piece (draw with b);
  // cells = the two cells it separates, fold = the index of the fold that creases it
  const creases = spokes.map((s) => ({
    a: pieceOf[s.still], b: CR + s.j, pts: Float32Array.of(P[0], P[1], s.end[0], s.end[1]),
    cells: [pieceOf[s.k0], pieceOf[s.k1]], spoke: s.j, fold: s.fold,
  }));

  const mesh = {
    n: nV, xy, cell, tri: Uint32Array.from(tri), m: nTri, triCell: Uint16Array.from(triCell), tint,
    cells, root: 0, locate, boundary, creases, bbox: [bx0, by0, bx1, by1], group, domain,
    cellTriangles,            // the first cellTriangles triangles are the cells; the rest are the spine strips
    lid: LID, pieces: NP,     // the piece that rides on top of the stack over the base tile; how many pieces at(t) knows
    outline: sides.map((_, i) => OUT + i),   // outline[i]: the piece of side i of the tile (= boundary[i].cells)
  };

  // ---- the lid: the top sheet over the base tile is sheet topBefore[f] before fold f and topAfter[f] after it
  const topBefore = folds.map((f) => f.from.reduce((c, j) => c + (j === 0 ? 1 : 0), 0) - 1);
  const topAfter = folds.map((f, i) => (i + 1 < NF ? topBefore[i + 1] : S - 1));
  const creaseEnds = spokes.map((s) => [9 * pieceOf[s.still], 9 * pieceOf[s.flap]]);
  // how far below the top sheet a folded crease ends: its two cells end as sheets plan.layer[k0] and plan.layer[k1]
  const creaseLack = spokes.map((s) => (S - 1 - (plan.layer[s.k0] + plan.layer[s.k1]) / 2) * sp);

  // ---- time: one stage per fold; bigger flaps take a little longer (duration ~ sqrt of the flap's reach)
  let wsum = 0;
  for (const f of folds) wsum += Math.sqrt(f.reach);
  const T0 = [0];
  for (let f = 0; f < NF; f++) T0.push(f === NF - 1 ? 1 : T0[f] + Math.sqrt(folds[f].reach) / wsum);
  const stops = [{ t: 0, label: 'flat' }];
  for (let f = 0; f < NF; f++) {
    const left = folds[f].c, parts = S / left;
    stops.push({ t: T0[f + 1], label: f === NF - 1 ? 'folded' : (WORDS[parts] || '1/' + parts) });
  }

  // ---- distinct turning fractions of a stage (1 for the flap, i / rows for the rows of a spine being bent)
  const fracs = [1];
  for (let i = 1; i < rows; i++) fracs.push(i / rows);

  function at(t) {
    t = +t;
    if (!(t > 0)) return flat;
    if (t > 1) t = 1;
    let f = NF - 1;
    for (let i = 0; i < NF; i++) if (t <= T0[i + 1]) { f = i; break; }
    const u = (t - T0[f]) / (T0[f + 1] - T0[f]);
    const phi = Math.PI * ease(u), F = folds[f], preF = pre[f], fracF = frac[f];
    // the rotations of this stage: by phi for the flap, by a share of phi for each row of the spines being bent
    const rots = new Array(fracs.length);
    for (let i = 0; i < fracs.length; i++) {
      let c, s;
      if (u <= 0) { c = 1; s = 0; } else if (u >= 1 && i === 0) { c = -1; s = 0; } else { c = Math.cos(phi * fracs[i]); s = Math.sin(phi * fracs[i]); }
      rots[i] = axisRotation(P[0], P[1], F.az, F.ex, F.ey, c, s, new Array(12));
    }
    // per piece the 3 x 3 numbers that take (x, y, 1) to its position
    const M = new Float64Array(9 * NP), W = new Array(12);
    for (let q = 0; q < CR; q++) {
      const fr = fracF[q];
      let A = preF[q];
      if (fr > 0) A = mul12(fr === 1 ? rots[0] : rots[Math.round(fr * rows)], A, W);
      const o = 9 * q;
      M[o] = A[0]; M[o + 1] = A[1]; M[o + 2] = A[3];
      M[o + 3] = A[4]; M[o + 4] = A[5]; M[o + 5] = A[7];
      M[o + 6] = A[8]; M[o + 7] = A[9]; M[o + 8] = A[11];
    }
    // the lid: over the base tile, on the top sheet; it rises to the new top while the flap comes down on it
    const late = (phi - LID_FROM) / (Math.PI - LID_FROM), rise = u >= 1 ? 1 : late <= 0 ? 0 : late * late * (3 - 2 * late);
    const lid = 9 * LID, lidZ = (topBefore[f] + (topAfter[f] - topBefore[f]) * rise) * sp;
    M[lid] = 1; M[lid + 4] = 1; M[lid + 8] = lidZ;
    // a crease piece: half way between the two cells the crease separates (they agree until it is folded). During
    // the last fold it also drifts up, in step with the lid, by what it lacks to the top of the stack: every crease
    // ends on a side of the tile, exactly under the tile's outline.
    const lift = f === NF - 1 ? rise : 0;
    for (let j = 0; j < S; j++) {
      const a = creaseEnds[j][0], b = creaseEnds[j][1], o = 9 * (CR + j);
      for (let i = 0; i < 9; i++) M[o + i] = 0.5 * (M[a + i] + M[b + i]);
      M[o + 8] += lift * creaseLack[j];
    }
    // the outline: side i over its own place, its height running straight between its corners, which rise with the lid
    for (let i = 0; i < sides.length; i++) {
      const s = sides[i], o = 9 * (OUT + i);
      const za = (s.hA[f] + (s.hA[f + 1] - s.hA[f]) * rise) * sp, zb = (s.hB[f] + (s.hB[f + 1] - s.hB[f]) * rise) * sp;
      const dx = s.B[0] - s.A[0], dy = s.B[1] - s.A[1], l2 = dx * dx + dy * dy, gz = l2 > 0 ? (zb - za) / l2 : 0;
      M[o] = 1; M[o + 4] = 1; M[o + 6] = gz * dx; M[o + 7] = gz * dy; M[o + 8] = za - gz * (s.A[0] * dx + s.A[1] * dy);
    }
    return (x, y, piece, out = [0, 0, 0]) => {
      const o = piece >= 0 && piece < NP ? 9 * piece : 0;      // an unknown piece is treated as the base tile
      out[0] = M[o] * x + M[o + 1] * y + M[o + 2];
      out[1] = M[o + 3] * x + M[o + 4] * y + M[o + 5];
      out[2] = M[o + 6] * x + M[o + 7] * y + M[o + 8];
      return out;
    };
  }

  return {
    mesh, stops, duration: 2.2 + 1.2 * NF, at,
    star: cells.map((c) => (c.parity ? c.poly.slice().reverse() : c.poly).map((q) => [q[0], q[1]])),
    // extras
    pivot: [P[0], P[1]], order: n, spacing: sp, chirality: chi, pieces: NP, lid: LID, outline: mesh.outline,
    // cellMaps[i]: the element of the group that carries the base tile onto cell i (so a figure drawn in the base
    // tile can be copied onto every cell of the star, piece i)
    cellMaps: cells.map((c) => compose(c.g, inverse(g0))),
    folds: folds.map((f, i) => ({
      t0: T0[i], t1: T0[i + 1], angle: f.angle, axisHeight: f.az, cells: f.moving.map((k) => pieceOf[k]), sheets: f.sheets,
      lidFrom: topBefore[i], lidTo: topAfter[i],
    })),
  };
}
