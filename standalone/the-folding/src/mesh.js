// mesh.js — triangle mesh of the (warped) tile, cut along the kaleidoscope's mirror lines into rigid "pieces"
// that form a tree of hinges.  SPEC 5.2.  Plain ES module; depends only on geom.js and groups.js.
//
//   buildMesh(group, domain, { density, boundaryStep, draft } = {}) -> Mesh
//     density       N of the fine triangulation of a kaleidoscope cell (default 22), or the number of grid steps
//                   across the longer side of the bounding box for the roll groups (default 56)
//     boundaryStep  largest step of the boundary samples, straight coordinates (default sqrt(domainArea) / 40)
//     draft         true: a quick mesh for the frames of a drag (finding #12): DRAFT_DENSITY of the density it would
//                   have (about 0.42 of the triangles, 2-2.5 times as fast); the same structure (a disc, pieces, tree,
//                   locate, boundary) and the same boundary samples. Build the full mesh again when the drag ends.
//                   (A roll fold rebuilds a mesh it finds too coarse unless its opts say { density: false }.)
//
// Beyond the SPEC's fields the mesh carries:
//   m                       number of triangles
//   triCell: Uint16Array(m) the piece of every TRIANGLE (a vertex on a crease belongs to two pieces, a triangle to one)
//   cells[i].cellId         index of the kaleidoscope cell the piece lies in (pieces of one cell share g, poly, cellId)
//   group, domain
//
// Things worth knowing downstream:
//   * Pieces are numbered breadth-first from the root: root === 0 and cells[i].parent < i for every i > 0.
//   * cell[v] of a vertex on a crease is the LOWEST piece index around it (the piece nearest the root).
//   * cells[i].poly lists g applied to the vertices of T in T's order, so side k of poly is side k of T (`glued[k]`);
//     for an orientation-reversing g that order is clockwise. Pieces of one cell share the same g object: do not mutate.
//   * T-coordinates u = inverse(g)(x) of a mesh vertex or boundary sample can lie a rounding error OUTSIDE T
//     (a vertex on a crease: ~1e-16; a boundary sample: up to ~1e-7, the samples are Float32). Clamp distances to
//     the sides of T at 0 before taking square roots.
//   * With a wavy cut the rim of the mesh is a polygon inscribed in the true boundary (its vertices are exact
//     crossings of the fine edges with the warped tile edges). Between vertices it deviates from `boundary` by the
//     sagitta; a chord farther than RIM_SAG (0.25 % of sqrt(domainArea)) from the boundary gets the boundary's points
//     in between (final fix, 10 Nov: without that a draft mesh's rim strayed up to 1.6 %, a full one's up to 1.06 %),
//     so the rim stays within 0.35 % of it (3,900 wavy tiles, drafts and full meshes, dev/final-fix/rim-probe.mjs).
//     At amp 0 the rim is exact. At a corner of the tile the rim has a vertex on both tile edges (the true corner)
//     where that lies in the fine triangle the corner of two chords would be in, else the corner of two chords, on
//     one of the two tile edges and within the sagitta of the other.
//   * The mesh is a disc: every edge has one or two triangles, the rim is one simple closed polygon (no T-junction,
//     no hole), every piece is connected. A fine edge that the cut crosses twice (a lobe or a notch within one edge)
//     gets a vertex in between, and a long fine edge that the cut crosses is halved, so with a wavy cut the mesh has
//     vertices that the fine triangulation has not.
//   * A piece can be very small (a lobe a few 1e-7 wide when the cut is almost tangent to a crease). Its triangles
//     may be degenerate in Float32 `xy` (zero area): guard normalisations.
//   * hinge {ax, ay, bx, by} spans the shared crease segment; for a micro-lobe it is padded to 1e-3 sqrt(domainArea)
//     so the two points always define the line well.
//   * locate(x, y) decides by the kaleidoscope CELL of the point first (exact geometry), then by the nearest
//     triangle of that cell. Glued boundary points therefore get pieces whose cells correspond under the gluing,
//     which is what makes seams close exactly at the end of a fold. A point with no piece of its own cell within
//     0.03 sqrt(domainArea) (outside the tile, or a rounding error across a mirror edge) gets the piece of the
//     nearest triangle of the whole mesh. A point in, on or next to the tile costs a few buckets of a grid (under a
//     microsecond on the rim, about two at 0.03 sqrt(domainArea) from it). Further out the search widens with the
//     distance: a point a tile size away costs as much as a scan of all triangles (tens of microseconds).

import { IDENT, apply, det } from './geom.js';
import { elementsNear } from './groups.js';

const S_EPS = 1e-10;          // a vertex this close (straight coordinates) to a tile edge line counts as ON it
const WELD = 1e-9;            // vertices of adjacent cells closer than this are one vertex
// Pieces smaller than this are numerical dust and are dropped with their triangles. (The SPEC says 1e-10; a real
// micro-lobe at a nearly degenerate tile corner can be smaller than that, and dropping it would leave the boundary
// points inside it without a piece in their own cell, so only true dust goes.)
const MIN_PIECE_AREA = 1e-13;
const NUDGE = 1e-6;
// The rim's chords (buildMesh, "the rim's chords"): one farther than RIM_SAG tile sizes from the true boundary is split
// at the boundary's own point, RIM_DEPTH times at most.
const RIM_SAG = 2.5e-3, RIM_DEPTH = 4;

/** Is (x, y) in the convex polygon (either orientation), at most `eps` outside it? */
function inConvex(poly, x, y, eps) {
  let pos = false, neg = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const s = ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / l;
    if (s > eps) pos = true; else if (s < -eps) neg = true;
  }
  return !(pos && neg);
}

// ---------------------------------------------------------------------------------------------------------------
// Fine triangulation of the kaleidoscope cell T, graded toward its sides (cached per kaleidoscope and density)
// ---------------------------------------------------------------------------------------------------------------

const templates = new WeakMap();

function fineTemplate(kaleido, N) {
  let byN = templates.get(kaleido);
  if (!byN) { byN = new Map(); templates.set(kaleido, byN); }
  let tpl = byN.get(N);
  if (tpl) return tpl;
  const T = kaleido.cell;
  const uv = [], tri = [], border = [];
  if (T.length === 3) {
    // barycentric grid (N - i - j, i, j) / N, mapped by lambda -> lambda^2 / sum(lambda^2): spacing shrinks quadratically at the sides
    const id = (i, j) => (i * (2 * N + 3 - i)) / 2 + j;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N - i; j++) {
        const k = N - i - j, s = k * k + i * i + j * j;
        const w0 = (k * k) / s, w1 = (i * i) / s, w2 = (j * j) / s;
        uv.push(w0 * T[0][0] + w1 * T[1][0] + w2 * T[2][0], w0 * T[0][1] + w1 * T[1][1] + w2 * T[2][1]);
        border.push(i === 0 || j === 0 || k === 0 ? 1 : 0);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N - i; j++) {
        tri.push(id(i, j), id(i + 1, j), id(i, j + 1));
        if (i + j <= N - 2) tri.push(id(i + 1, j), id(i + 1, j + 1), id(i, j + 1));
      }
    }
  } else {
    // parallelogram / rectangle: Chebyshev-like nodes (1 - cos(pi s)) / 2 in each direction
    const node = (i) => (1 - Math.cos((Math.PI * i) / N)) / 2;
    const id = (i, j) => i * (N + 1) + j;
    const ux = T[1][0] - T[0][0], uy = T[1][1] - T[0][1], vx = T[3][0] - T[0][0], vy = T[3][1] - T[0][1];
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const s = node(i), t = node(j);
        uv.push(T[0][0] + s * ux + t * vx, T[0][1] + s * uy + t * vy);
        border.push(i === 0 || j === 0 || i === N || j === N ? 1 : 0);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
        if ((i + j) & 1) tri.push(a, b, d, b, c, d); else tri.push(a, b, c, a, c, d);
      }
    }
  }
  let cx = 0, cy = 0;
  for (const p of T) { cx += p[0] / T.length; cy += p[1] / T.length; }
  let rad = 0;
  for (const p of T) rad = Math.max(rad, Math.hypot(p[0] - cx, p[1] - cy));
  let maxEdge = 0;            // the longest edge of the fine mesh
  for (let t = 0; t < tri.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const p = tri[t + e], q = tri[t + (e + 1) % 3];
      maxEdge = Math.max(maxEdge, Math.hypot(uv[2 * p] - uv[2 * q], uv[2 * p + 1] - uv[2 * q + 1]));
    }
  }
  tpl = { nv: uv.length / 2, uv: Float64Array.from(uv), tri: Uint32Array.from(tri), border: Uint8Array.from(border), cen: [cx, cy], rad, maxEdge };
  byN.set(N, tpl);
  return tpl;
}

// ---------------------------------------------------------------------------------------------------------------
// Point / triangle helpers for the locator
// ---------------------------------------------------------------------------------------------------------------

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = px - ax - t * dx, ey = py - ay - t * dy;
  return ex * ex + ey * ey;
}

/** Squared distance from (px, py) to the counter-clockwise triangle t of (xy, tri); 0 inside. */
function triDist2(xy, tri, t, px, py) {
  const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
  const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1], cx = xy[2 * c], cy = xy[2 * c + 1];
  const e0 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const e1 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const e2 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  if (e0 >= 0 && e1 >= 0 && e2 >= 0) return 0;
  return Math.min(segDist2(px, py, ax, ay, bx, by), segDist2(px, py, bx, by, cx, cy), segDist2(px, py, cx, cy, ax, ay));
}

/** Uniform bucket grid over a list of triangles, for nearest-triangle queries. */
function makeGrid(xy, tri, list) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let k = 0; k < list.length; k++) {
    for (let e = 0; e < 3; e++) {
      const v = tri[3 * list[k] + e], x = xy[2 * v], y = xy[2 * v + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const n = Math.max(1, Math.min(24, Math.round(Math.sqrt(list.length / 3))));
  const span = Math.max(x1 - x0, y1 - y0, 1e-12) * (1 + 1e-9);
  const inv = n / span;
  const range = (t, out) => {
    let ax = Infinity, ay = Infinity, bx = -Infinity, by = -Infinity;
    for (let e = 0; e < 3; e++) {
      const v = tri[3 * t + e], x = xy[2 * v], y = xy[2 * v + 1];
      if (x < ax) ax = x; if (x > bx) bx = x; if (y < ay) ay = y; if (y > by) by = y;
    }
    const cl = (f) => (f < 0 ? 0 : f > n - 1 ? n - 1 : f);
    out[0] = cl(Math.floor((ax - x0) * inv)); out[1] = cl(Math.floor((bx - x0) * inv));
    out[2] = cl(Math.floor((ay - y0) * inv)); out[3] = cl(Math.floor((by - y0) * inv));
  };
  const start = new Int32Array(n * n + 1), r = [0, 0, 0, 0];
  for (let k = 0; k < list.length; k++) {
    range(list[k], r);
    for (let iy = r[2]; iy <= r[3]; iy++) for (let ix = r[0]; ix <= r[1]; ix++) start[iy * n + ix + 1]++;
  }
  for (let b = 0; b < n * n; b++) start[b + 1] += start[b];
  const fill = start.slice(0, n * n), items = new Int32Array(start[n * n]);
  for (let k = 0; k < list.length; k++) {
    range(list[k], r);
    for (let iy = r[2]; iy <= r[3]; iy++) for (let ix = r[0]; ix <= r[1]; ix++) items[fill[iy * n + ix]++] = list[k];
  }
  return { x0, y0, inv, n, start, items };
}

let nearestD2 = 0;   // squared distance found by the last nearestTriangle call

/**
 * Triangle containing the point, else the nearest one. `A` = {tris: Int32Array of triangle indices, grid: null}.
 * The buckets are searched in rings around the bucket of the point (for a point outside the grid: the bucket nearest
 * to it) until no bucket further out can hold anything closer. A point in or next to the mesh — a boundary sample a
 * rounding error outside the grid's bounding square included — costs one or two rings, never a scan of every triangle.
 */
function nearestTriangle(xy, tri, A, px, py) {
  if (!A.grid) A.grid = makeGrid(xy, tri, A.tris);
  const g = A.grid, n = g.n, start = g.start, items = g.items, inv = g.inv;
  const fx = (px - g.x0) * inv, fy = (py - g.y0) * inv;
  const ix = fx < 0 ? 0 : fx >= n ? n - 1 : Math.floor(fx), iy = fy < 0 ? 0 : fy >= n ? n - 1 : Math.floor(fy);
  let best = -1, bd = Infinity;
  for (let r = 0; ; r++) {
    const x0 = ix - r, x1 = ix + r, y0 = iy - r, y1 = iy + r;
    const ya = y0 < 0 ? 0 : y0, yb = y1 > n - 1 ? n - 1 : y1, xa = x0 < 0 ? 0 : x0, xb = x1 > n - 1 ? n - 1 : x1;
    for (let jy = ya; jy <= yb; jy++) {
      // the top and bottom rows of the ring are whole, the rows in between contribute their two ends
      const step = jy === y0 || jy === y1 || x1 === x0 ? 1 : x1 - x0;
      for (let jx = step === 1 ? xa : x0; jx <= xb; jx += step) {
        if (jx < 0) continue;
        const b = jy * n + jx;
        for (let k = start[b]; k < start[b + 1]; k++) {
          const d = triDist2(xy, tri, items[k], px, py);
          if (d < bd) { bd = d; best = items[k]; if (d === 0) { nearestD2 = 0; return best; } }
        }
      }
    }
    // a triangle not seen yet lies beyond a wall of the block (walls on the border of the grid have nothing behind them)
    let gap = Infinity;
    if (x0 > 0 && fx - x0 < gap) gap = fx - x0;
    if (x1 < n - 1 && x1 + 1 - fx < gap) gap = x1 + 1 - fx;
    if (y0 > 0 && fy - y0 < gap) gap = fy - y0;
    if (y1 < n - 1 && y1 + 1 - fy < gap) gap = y1 + 1 - fy;
    if (gap === Infinity || (best >= 0 && bd * inv * inv <= gap * gap)) break;
  }
  nearestD2 = bd;
  return best;
}

/**
 * locate(x, y) -> piece.  First the kaleidoscope cell that contains the point (by the cells' side half-planes: exact
 * geometry, which is what makes glued boundary points fold together exactly). A cell that the tile covers completely
 * answers at once; otherwise the piece of that cell's triangle containing — or within `tau` of — the point. A point
 * with nothing of its own cell near it (outside the tile, or in a region too small to be meshed) gets the nearest
 * triangle of the whole mesh.  A module-level factory, so the closure keeps none of buildMesh's scratch arrays alive.
 */
function makeLocate(cellInfo, xy64, tri, triCell, nPieces, tau) {
  if (nPieces === 1) return () => 0;
  const nInfo = cellInfo.length, tau2 = tau * tau;
  let all = null;
  return (x, y) => {
    for (let i = 0; i < nInfo; i++) {
      const C = cellInfo[i];
      let inside = true;
      for (let s = 0; s < C.k; s++) if (C.nx[s] * x + C.ny[s] * y - C.c[s] > 0) { inside = false; break; }
      if (!inside) continue;
      if (C.full) return C.pieces[0];
      const t = nearestTriangle(xy64, tri, C, x, y);
      if (nearestD2 <= tau2) return triCell[t];
      break;
    }
    if (!all) all = { tris: Int32Array.from({ length: triCell.length }, (_, t) => t), grid: null };
    return triCell[nearestTriangle(xy64, tri, all, x, y)];
  };
}

/**
 * For a warp that does not say how strongly it bends (warp.bend, see makeWarp): the largest second difference of
 * warp.inv over a grid in the box, with a wide margin. An upper bound of |D²(psi^-1)[u, u]| for unit vectors u.
 */
function estimateBend(warp, x0, y0, x1, y1, size) {
  const h = 2e-3 * size, a = [0, 0], b = [0, 0], c = [0, 0];
  let worst = 0;
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      const x = x0 + ((i + 0.37) / 12) * (x1 - x0), y = y0 + ((j + 0.61) / 12) * (y1 - y0);
      warp.inv(x, y, b);
      for (const [ux, uy] of [[1, 0], [0, 1], [Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2]]) {
        warp.inv(x + h * ux, y + h * uy, a); warp.inv(x - h * ux, y - h * uy, c);
        worst = Math.max(worst, Math.hypot(a[0] - 2 * b[0] + c[0], a[1] - 2 * b[1] + c[1]) / (h * h));
      }
    }
  }
  return 2 * worst;
}

// ---------------------------------------------------------------------------------------------------------------
// buildMesh
// ---------------------------------------------------------------------------------------------------------------

/** The density factor of a draft mesh (see the header). */
export const DRAFT_DENSITY = 0.65;

export function buildMesh(group, domain, { density, boundaryStep, draft = false } = {}) {
  const thin = draft ? DRAFT_DENSITY : 1;
  const warp = domain.warp, ident = warp.amp === 0;
  const E = domain.edges, H = E.length;
  const hx = new Float64Array(H), hy = new Float64Array(H), hc = new Float64Array(H);
  for (let h = 0; h < H; h++) { hx[h] = E[h].nx; hy[h] = E[h].ny; hc[h] = E[h].c; }
  const size = Math.sqrt(group.domainArea);
  const outline = domain.outline(boundaryStep || size / 40);

  // bounding box of the warped tile (padded: the piecewise-linear tile may stick out a hair between samples)
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const o of outline) {
    for (let i = 0; i < o.pts.length; i += 2) {
      const x = o.pts[i], y = o.pts[i + 1];
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }
  const pad = 0.02 * size;
  bx0 -= pad; by0 -= pad; bx1 += pad; by1 += pad;

  // ---- vertex store: actual coordinates X, straight coordinates Y, signed distances S to the tile's edge lines
  let cap = 4096, nv = 0;
  let X = new Float64Array(2 * cap), Y = new Float64Array(2 * cap), S = new Float64Array(H * cap);
  // om: the edge lines the vertex is outside of; oom: on or outside. For the edges that cross a cut twice (below):
  // nm: the cuts (not mirrors) it is outside of, on, or less than nearD inside of — only an edge with both ends that
  // near one cut can have a notch of it; fm: the edge lines it is more than nearD outside of — no edge from there to a
  // vertex on or outside the same line comes back inside it
  let st = new Uint8Array(cap), om = new Int32Array(cap), oom = new Int32Array(cap), nm = new Int32Array(cap), fm = new Int32Array(cap);
  let oc = new Uint8Array(cap);
  let orig = new Uint8Array(cap);   // 1: a vertex of the fine mesh (or a split point); 0: a cut point
  let gen = new Uint8Array(cap);    // 0, or for a split point (see splitOf): one more than the higher of its edge's two ends
  let nearD = 0, mir = 0;           // mir: the mirror edges of the tile
  for (let h = 0; h < H; h++) if (E[h].kind === 'mirror') mir |= 1 << h;
  const grow = () => {
    cap *= 2;
    const cp = (A, B) => { B.set(A); return B; };
    X = cp(X, new Float64Array(2 * cap)); Y = cp(Y, new Float64Array(2 * cap)); S = cp(S, new Float64Array(H * cap));
    st = cp(st, new Uint8Array(cap)); om = cp(om, new Int32Array(cap)); oom = cp(oom, new Int32Array(cap)); nm = cp(nm, new Int32Array(cap));
    fm = cp(fm, new Int32Array(cap)); oc = cp(oc, new Uint8Array(cap)); orig = cp(orig, new Uint8Array(cap));
    gen = cp(gen, new Uint8Array(cap));
  };
  const addVertex = (x, y) => {
    if (nv === cap) grow();
    X[2 * nv] = x; X[2 * nv + 1] = y;
    oc[nv] = (x < bx0 ? 1 : 0) | (x > bx1 ? 2 : 0) | (y < by0 ? 4 : 0) | (y > by1 ? 8 : 0);
    orig[nv] = 1;
    return nv++;
  };
  const tmp = [0, 0];
  const classify = (v, y0, y1) => {
    Y[2 * v] = y0; Y[2 * v + 1] = y1;
    let m1 = 0, m2 = 0, m3 = 0, m4 = 0;
    const o = v * H;
    for (let h = 0; h < H; h++) {
      const s = hx[h] * y0 + hy[h] * y1 - hc[h];
      S[o + h] = s;
      if (s > S_EPS) m1 |= 1 << h;
      if (s >= -S_EPS) m2 |= 1 << h;
      if (s > -nearD) m3 |= 1 << h;
      if (s > nearD) m4 |= 1 << h;
    }
    om[v] = m1; oom[v] = m2; nm[v] = m3 & ~mir; fm[v] = m4 & m1; st[v] = 1;
  };
  // A vertex further inside every edge line than any point is displaced (deepBar, straight coordinates) is inside the
  // tile whatever psi^-1 does to it: all its masks are 0 without warp.inv, and nothing else is read from it unless a cut
  // or a halving takes it as an end, which first makes it exact (the same warp.inv call prep would have made, so the
  // mesh is the same, bit for bit). Its signed distances meanwhile hold -Infinity, which every test in the clipping
  // reads as "inside" (finding #12: most vertices of a wavy mesh are such, and their warp.inv was half the build).
  let deepBar = -1;
  const setDeep = () => {
    const pk = warp.peak;
    deepBar = ident || !(Number.isFinite(pk) && pk > 0) ? -1 : 1.25 * pk + nearD + S_EPS + 1e-9 * size;
  };
  const prep = (v) => {
    if (st[v]) return;
    if (ident) { classify(v, X[2 * v], X[2 * v + 1]); return; }
    const x = X[2 * v], y = X[2 * v + 1];
    let deep = deepBar > 0;
    for (let h = 0; deep && h < H; h++) if (hx[h] * x + hy[h] * y - hc[h] >= -deepBar) deep = false;
    if (deep) {
      om[v] = 0; oom[v] = 0; nm[v] = 0; fm[v] = 0; st[v] = 2;
      for (let h = 0, o = v * H; h < H; h++) S[o + h] = -Infinity;
    } else { warp.inv(x, y, tmp); classify(v, tmp[0], tmp[1]); }
  };
  /** A deep vertex made exact (see prep). */
  const exact = (v) => { if (st[v] === 2) { warp.inv(X[2 * v], X[2 * v + 1], tmp); classify(v, tmp[0], tmp[1]); } };

  // ---- cut points on edges, cached by (lower id, higher id, half-plane): both neighbours of an edge get the same vertex.
  // The cut is the EXACT crossing of the segment with the warped tile edge (a bracketed secant iteration on
  // s_h(psi^-1(x(t)))), so the rim of the mesh has its vertices on the true boundary and crosses every crease where the
  // true boundary does. That holds for a chord too (a segment between two cut points, standing for the arc of a tile
  // edge between them): its crossing with the NEXT tile edge is where the chord really meets that edge, not where a
  // straight-coordinate interpolation along the chord would put it. The two differ along the chord by up to
  // bend L² / 8, and when a line of the fine mesh runs a hair inside a tile edge (the default cut of 22x) the chord
  // lies a hair beside a fine edge whose own crossing is exact: the rim turned back on itself there, a needle of no
  // width past the corner of the tile. A point of a chord counts as ON the tile edge the chord stands for.
  const cuts = new Map();
  const exactCrossing = (lo, hi, h, t) => {
    const x0 = X[2 * lo], y0 = X[2 * lo + 1], dx = X[2 * hi] - x0, dy = X[2 * hi + 1] - y0;
    const u0 = Y[2 * lo], v0 = Y[2 * lo + 1], du = Y[2 * hi] - u0, dv = Y[2 * hi + 1] - v0;
    let ta = 0, fa = S[lo * H + h], tb = 1, fb = S[hi * H + h], side = 0, te = t;
    for (let it = 0; it < 16; it++) {
      te = t;
      warp.inv(x0 + t * dx, y0 + t * dy, tmp, u0 + t * du, v0 + t * dv);
      const f = hx[h] * tmp[0] + hy[h] * tmp[1] - hc[h];
      if (Math.abs(f) < 1e-12) break;
      if ((f < 0) === (fa < 0)) { ta = t; fa = f; if (side === -1) fb /= 2; side = -1; } else { tb = t; fb = f; if (side === 1) fa /= 2; side = 1; }
      t = ta - (fa * (tb - ta)) / (fb - fa);
    }
    return te;      // tmp holds psi^-1 of the point at te
  };
  const cut = (p, q, h) => {
    const lo = p < q ? p : q, hi = p < q ? q : p;
    const key = (lo * 2097152 + hi) * 32 + h;
    let v = cuts.get(key);
    if (v !== undefined) return v;
    exact(lo); exact(hi);
    const sl = S[lo * H + h];
    let t = sl / (sl - S[hi * H + h]), y0, y1;
    if (!ident) { t = exactCrossing(lo, hi, h, t); y0 = tmp[0]; y1 = tmp[1]; } else {
      y0 = Y[2 * lo] + t * (Y[2 * hi] - Y[2 * lo]); y1 = Y[2 * lo + 1] + t * (Y[2 * hi + 1] - Y[2 * lo + 1]);
    }
    v = addVertex(X[2 * lo] + t * (X[2 * hi] - X[2 * lo]), X[2 * lo + 1] + t * (X[2 * hi + 1] - X[2 * lo + 1]));
    orig[v] = 0;
    classify(v, y0, y1);
    let on = 1 << h;                                             // exactly ON the line that made it ...
    if (!orig[lo] && !orig[hi]) on |= oom[lo] & ~om[lo] & oom[hi] & ~om[hi];      // ... and a point of a chord on the chord's line
    if (on & (on - 1)) { for (let k = 0; k < H; k++) if ((on >> k) & 1) S[v * H + k] = 0; } else S[v * H + h] = 0;
    om[v] &= ~on; oom[v] |= on; fm[v] &= ~on;
    cuts.set(key, v);
    return v;
  };

  // ---- clip one fine triangle (counter-clockwise ids a, b, c) to the tile and emit the result
  const triOut = [], triCellOut = [];
  const minArea2 = 1e-20;     // drops only what is degenerate to rounding (collinear fans); thin lobes keep their triangles
  const emit = (a, b, c, cellId) => {
    const ar = (X[2 * b] - X[2 * a]) * (X[2 * c + 1] - X[2 * a + 1]) - (X[2 * b + 1] - X[2 * a + 1]) * (X[2 * c] - X[2 * a]);
    if (ar > minArea2) { triOut.push(a, b, c); triCellOut.push(cellId); }
  };
  // The polygon is clipped by every edge line that one of ITS OWN vertices lies outside of, round after round, until
  // none does. The three corners of the triangle alone do not say which lines these are: with a wavy cut an exact
  // crossing on one tile edge can lie outside another tile edge that no corner is outside of (the fine edge is a
  // curve in straight coordinates and bulges across it, next to a corner of the tile), and a line can be crossed
  // again after a later cut. Whatever happens to a fine edge is then decided by that edge alone — its two ends and the
  // cut points made on it, taken in the same order — so the two triangles that share it agree on every vertex on it:
  // no T-junction, no slit. A point of a chord counts as on the tile edge the chord stands for, so cutting a chord
  // never puts a point back outside that edge, and every cut takes a part of the polygon away, so the rounds end (two
  // or three at most; PASSES is a guard).
  const PASSES = 8, NMAX = 120;                        // far more than ever needed: a polygon has 3 to 7 vertices
  let P = new Int32Array(2 * NMAX), Q = new Int32Array(2 * NMAX);
  const addTriangle = (a, b, c, cellId) => {
    if (oc[a] & oc[b] & oc[c]) return;                 // all three beyond one side of the tile's bounding box
    prep(a); prep(b); prep(c);
    if (oom[a] & oom[b] & oom[c]) return;              // all three on or outside one edge line
    let u = om[a] | om[b] | om[c];
    if (u === 0) { emit(a, b, c, cellId); return; }    // all three inside or on the boundary
    let n = 3;
    P[0] = a; P[1] = b; P[2] = c;
    for (let pass = 0; u !== 0 && n >= 3 && pass < PASSES; pass++) {
      for (let h = 0; h < H && n >= 3 && n < NMAX; h++) {
        if (!(u & (1 << h))) continue;
        let m = 0, w = 0;                              // w: the lines some vertex of the clipped polygon is outside of
        for (let i = 0; i < n; i++) {
          const p = P[i], q = P[i + 1 === n ? 0 : i + 1];
          const sp = S[p * H + h], sq = S[q * H + h];
          if (sp <= S_EPS) { Q[m++] = p; w |= om[p]; }
          if ((sp < -S_EPS && sq > S_EPS) || (sp > S_EPS && sq < -S_EPS)) { const v = cut(p, q, h); Q[m++] = v; w |= om[v]; }
        }
        const t = P; P = Q; Q = t; n = m; u = w;
      }
    }
    if (!ident && n >= 3) { fineA = a; fineB = b; fineC = c; if (refineChords(n)) { earClip(cellId); return; } }
    for (let i = 1; i + 1 < n; i++) emit(P[0], P[i], P[i + 1], cellId);
  };

  // ---- the rim's chords (final fix, 10 Nov 2026). Between two of its vertices on one cut edge the rim is a chord of the
  // true boundary, which bulges from it by the sagitta: up to 1.6 % of the tile size where a draft mesh's triangles are
  // largest, 1.06 % for a rare full mesh, against the 1 % test/mesh.test.js holds every mesh to (the tests-math
  // verifier, qa/final-verify-tests-math/draft-rim.log). Halving long crossed edges (below) does not bound it: a chord
  // runs across a whole triangle. So a chord of the clipped polygon farther than RIM_SAG from the boundary's own point
  // between its ends — the image under psi of the straight midpoint, exactly on the boundary — gets that point, and
  // the halves likewise (RIM_DEPTH times at most); the polygon is then triangulated by ear clipping (it need not be
  // convex any more: the boundary can bulge into it). The boundary between two crossings of one fine triangle's edges
  // stays inside that triangle (an edge it crosses twice is split first), so the new points are inside it too, and the
  // chord is this polygon's alone: no T-junction. A polygon without such a chord keeps its fan (the same mesh, bit for
  // bit). At amp 0 the rim is exact.
  const R = [], rimTol = RIM_SAG * size, wf = [0, 0];
  let fineA = 0, fineB = 0, fineC = 0;              // the fine triangle being clipped: a new point must lie in it
  const inFine = (x, y) => {
    const e = -1e-12 * size * size;
    const s = (p, q) => (X[2 * q] - X[2 * p]) * (y - X[2 * p + 1]) - (X[2 * q + 1] - X[2 * p + 1]) * (x - X[2 * p]);
    return s(fineA, fineB) >= e && s(fineB, fineC) >= e && s(fineC, fineA) >= e;
  };
  /** Is v exactly on the cut line h (a cut point, a chord point, a vertex on the boundary)? */
  const onCut = (v, h) => st[v] === 1 && Math.abs(S[v * H + h]) <= S_EPS;
  /** The straight point of line h nearest (y0, y1) (the lines' normals need not be unit: a metric). */
  const toLine = (h, y0, y1, out) => {
    const s = (hx[h] * y0 + hy[h] * y1 - hc[h]) / (hx[h] * hx[h] + hy[h] * hy[h]);
    out[0] = y0 - s * hx[h]; out[1] = y1 - s * hy[h];
    return out;
  };
  /** A new vertex at the straight point (y0, y1) of the boundary (on the lines in `lines`, a bit mask). */
  const boundaryVertex = (y0, y1, lines) => {
    warp.fwd(y0, y1, wf);
    const w = addVertex(wf[0], wf[1]);
    orig[w] = 0;
    classify(w, y0, y1);
    for (let h = 0; h < H; h++) if ((lines >> h) & 1) { S[w * H + h] = 0; om[w] &= ~(1 << h); oom[w] |= 1 << h; fm[w] &= ~(1 << h); }
    return w;
  };
  /**
   * A corner of two chords: a vertex exactly on cut line h2 that counts as on line h1 only as a point of a chord of h1
   * (cut, above), off it by that chord's sagitta. With a long chord that put the rim's corner up to 1 % of the tile
   * size beyond the tile's (333 in a draft, the tests-math verifier, salt 11). It is replaced by the true corner of the
   * two edges when that lies in the fine triangle (the chord, and so the vertex, is this polygon's alone).
   */
  const trueCorner = (v) => {
    if (st[v] !== 1) return v;
    let h1 = -1, h2 = -1;
    for (let h = 0; h < H; h++) {
      if (Math.abs(S[v * H + h]) > S_EPS) continue;
      const g = Math.abs(hx[h] * Y[2 * v] + hy[h] * Y[2 * v + 1] - hc[h]) / Math.hypot(hx[h], hy[h]);
      if (g <= 1e-9 * size) h2 = h; else if (g > rimTol) h1 = h;
    }
    if (h1 < 0 || h2 < 0) return v;
    const det = hx[h1] * hy[h2] - hy[h1] * hx[h2];
    if (!(Math.abs(det) > 1e-12)) return v;
    const y0 = (hc[h1] * hy[h2] - hy[h1] * hc[h2]) / det, y1 = (hx[h1] * hc[h2] - hc[h1] * hx[h2]) / det;
    for (let h = 0; h < H; h++) if (h !== h1 && h !== h2 && hx[h] * y0 + hy[h] * y1 - hc[h] > S_EPS) return v;   // not a corner of the tile
    warp.fwd(y0, y1, wf);
    if (!inFine(wf[0], wf[1])) return v;
    return boundaryVertex(y0, y1, (1 << h1) | (1 << h2));
  };
  /** R := P[0..n-1] with the points of the boundary inserted into its long chords (and a corner of two chords put
   *  where the tile's corner is); true when anything changed. */
  const refineChords = (n) => {
    R.length = 0;
    let added = false;
    for (let i = 0; i < n; i++) { const v = trueCorner(P[i]); if (v !== P[i]) added = true; R.push(v); }
    const C = R.slice();
    R.length = 0;
    for (let i = 0; i < n; i++) {
      const u = C[i], v = C[i + 1 === n ? 0 : i + 1];
      R.push(u);
      for (let h = 0; h < H; h++) {
        if (E[h].kind === 'cut' && onCut(u, h) && onCut(v, h)) { if (arcPoints(u, v, h, 0)) added = true; break; }
      }
    }
    return added;
  };
  const ym = [0, 0];
  /** Push onto R the points of the boundary strictly between u and v (both on cut line h), in order; true if any. */
  const arcPoints = (u, v, h, depth) => {
    if (depth >= RIM_DEPTH) return false;
    toLine(h, (Y[2 * u] + Y[2 * v]) / 2, (Y[2 * u + 1] + Y[2 * v + 1]) / 2, ym);   // (a chord point is off the line)
    warp.fwd(ym[0], ym[1], wf);
    const ux = X[2 * u], uy = X[2 * u + 1], dx = X[2 * v] - ux, dy = X[2 * v + 1] - uy, L = Math.hypot(dx, dy);
    if (!(L > 0) || !(Math.abs(dx * (wf[1] - uy) - dy * (wf[0] - ux)) > rimTol * L) || !inFine(wf[0], wf[1])) return false;
    const w = boundaryVertex(ym[0], ym[1], 1 << h);
    arcPoints(u, w, h, depth + 1); R.push(w); arcPoints(w, v, h, depth + 1);
    return true;
  };
  const cross3 = (a, b, c) => (X[2 * b] - X[2 * a]) * (X[2 * c + 1] - X[2 * a + 1]) - (X[2 * b + 1] - X[2 * a + 1]) * (X[2 * c] - X[2 * a]);
  /** Ear clipping of the counter-clockwise polygon R; a vertex on an ear's sides blocks it. (Stuck — never seen — the
   *  rest is fanned, as before.) */
  const earClip = (cellId) => {
    const idx = R.slice();
    while (idx.length > 3) {
      let cut = -1;
      for (let i = 0; i < idx.length && cut < 0; i++) {
        const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
        if (!(cross3(a, b, c) > minArea2)) continue;
        let empty = true;
        for (const p of idx) {
          if (p === a || p === b || p === c) continue;
          if (cross3(a, b, p) >= 0 && cross3(b, c, p) >= 0 && cross3(c, a, p) >= 0) { empty = false; break; }
        }
        if (empty) cut = i;
      }
      if (cut < 0) break;
      const a = idx[(cut + idx.length - 1) % idx.length], b = idx[cut], c = idx[(cut + 1) % idx.length];
      emit(a, b, c, cellId);
      idx.splice(cut, 1);
    }
    for (let i = 1; i + 1 < idx.length; i++) emit(idx[0], idx[i], idx[i + 1], cellId);
  };

  // ---- edges that cross the boundary TWICE. The clipping above reads off the two ends of an edge what happens along
  // it: both inside — all of it is; both beyond one tile edge — none of it is. With a wavy cut that can be wrong
  // within one edge of the fine mesh, most easily next to a crease, where the fine triangles are long and thin:
  //   a lobe   both ends on or outside the boundary, the tile reaches across in between (a bump of one tile edge, or
  //            the tip of a corner of the tile). Across a crease it is a piece the mesh would not have: boundary points
  //            on the bump find no piece in their own cell. Next to a crease it can be the only link between a part
  //            of the tile and the rest: an island of a few triangles, pieces hanging in the air.
  //   a notch  neither end is outside a cut, and the cut dips across in between (the other end may be outside ANOTHER
  //            tile edge). If the notch holds a vertex of the fine mesh the mesh gets a hole there: closed all round,
  //            where the tile is open to the outside. If the edge leaves the tile further on, the chord that the
  //            clipping draws for this cut joins two different arcs of it: a spike of triangles outside the tile.
  // Every such edge — of the fine mesh, and one drawn across a triangle by a split — gets a vertex at the deepest
  // point of the lobe or notch, and the triangles at the edge are split there. After that every edge crosses every
  // cut once at most where it matters, as the clipping takes for granted: a cut runs through a triangle in ONE arc,
  // from one edge to another, and the chord between the two crossings stands for it. Taking the lobes without the
  // notches would also tilt the area: the chords of the rim cut bumps off and fill dips in, and for glued partners
  // the two cancel.
  // The search is exact up to its resolution. warp.bend bounds the second derivative of every s_h along a straight
  // segment (c = bend * length²), so  s_h(t) >= chord - c t (1 - t) / 2  and  <= chord + c t (1 - t) / 2  between two
  // samples: where the bounds allow no crossing nothing is sampled, the rest is halved, DEPTH times at most (a lobe or
  // notch shallower than c / 2^(2 DEPTH + 3) can be missed: at most 2e-5 tile sizes, on the longest fine edges).
  // A mirror edge of the tile is straight in actual coordinates too (the warp slides points along it), so it is
  // crossed once at most: only the cuts count.
  const DEPTH = 5, GEN = 4;
  const bend = ident ? 0 : (Number.isFinite(warp.bend) && warp.bend >= 0 ? warp.bend : estimateBend(warp, bx0, by0, bx1, by1, size));
  const splits = new Map();
  const sS = new Float64Array((DEPTH + 4) * H), sY = new Float64Array((DEPTH + 4) * 2), pb = new Float64Array(2 * H);
  // the edge being searched: its ends; what for (a lobe, or a notch of one of the cuts in eMask); its c
  let eLo = 0, eHi = 0, eOut = false, eMask = 0, eC = 0;
  let fT = 0, fT0 = 0, fT1 = 0, fS = 0, fA = 0, fB = 0;  // the find: parameter and slot, and the interval it was found in
  const sampleAt = (t, slot, s0, s1) => {              // slot <- the point at t; the guess: halfway between two samples
    const x = X[2 * eLo] + t * (X[2 * eHi] - X[2 * eLo]), y = X[2 * eLo + 1] + t * (X[2 * eHi + 1] - X[2 * eLo + 1]);
    warp.inv(x, y, tmp, (sY[2 * s0] + sY[2 * s1]) / 2, (sY[2 * s0 + 1] + sY[2 * s1 + 1]) / 2);
    sY[2 * slot] = tmp[0]; sY[2 * slot + 1] = tmp[1];
    for (let h = 0, o = slot * H; h < H; h++) sS[o + h] = hx[h] * tmp[0] + hy[h] * tmp[1] - hc[h];
  };
  /** How far the sample is into the lobe (strictly inside every edge line) or the notch (outside a cut of eMask): > 0 if it is. */
  const depthOf = (slot) => {
    const o = slot * H;
    let d = eOut ? Infinity : -Infinity;
    for (let h = 0; h < H; h++) {
      if (eOut) { if (-sS[o + h] < d) d = -sS[o + h]; } else if (((eMask >> h) & 1) && sS[o + h] > d) d = sS[o + h];
    }
    return d - S_EPS;
  };
  /** No lobe (no notch) between two samples a parameter step dt apart: the bounds leave no room for one. */
  const cleared = (s0, s1, dt) => {
    const o0 = s0 * H, o1 = s1 * H, c = eC * dt * dt;
    for (let h = 0; h < H; h++) {
      const a = sS[o0 + h], b = sS[o1 + h], d = b - a;
      if (eOut) {
        if ((c > 2 * Math.abs(d) ? (a + b) / 2 - c / 8 - (d * d) / (2 * c) : (a < b ? a : b)) >= -S_EPS) return true;
      } else if (((eMask >> h) & 1) && (c > 2 * Math.abs(d) ? (a + b) / 2 + c / 8 + (d * d) / (2 * c) : (a > b ? a : b)) > S_EPS) return false;
    }
    return !eOut;
  };
  const search = (t0, s0, t1, s1, level) => {
    const tm = (t0 + t1) / 2, sm = 2 + level;
    sampleAt(tm, sm, s0, s1);
    if (depthOf(sm) > 0) { fT = tm; fS = sm; fT0 = t0; fT1 = t1; fA = s0; fB = s1; return true; }
    if (level + 1 >= DEPTH) return false;
    const dt = (t1 - t0) / 2;
    return (!cleared(s0, sm, dt) && search(t0, s0, tm, sm, level + 1)) || (!cleared(sm, s1, dt) && search(tm, sm, t1, s1, level + 1));
  };
  /** Take up the edge lo-hi: is there a lobe (out), or a notch of one of the cuts in `mask`? */
  const begin = (lo, hi, out, mask) => {
    exact(lo); exact(hi);                              // (an end in the deep inside never gets here: its masks are 0)
    const dx = X[2 * hi] - X[2 * lo], dy = X[2 * hi + 1] - X[2 * lo + 1];
    eLo = lo; eHi = hi; eOut = out; eMask = mask; eC = bend * (dx * dx + dy * dy);
    for (let h = 0; h < H; h++) { sS[h] = S[lo * H + h]; sS[H + h] = S[hi * H + h]; }
    sY[0] = Y[2 * lo]; sY[1] = Y[2 * lo + 1]; sY[2] = Y[2 * hi]; sY[3] = Y[2 * hi + 1];
  };
  /** The edge taken up: a new vertex in its lobe or notch, or -1. */
  const twice = () => {
    if (!search(0, 0, 1, 1, 0)) return -1;
    const lo = eLo, hi = eHi, out = eOut, dx = X[2 * hi] - X[2 * lo], dy = X[2 * hi + 1] - X[2 * lo + 1];
    // one step toward the deepest point: the parabolas through the find and the two samples around it
    const A = fA * H, M = fS * H, B = fB * H;
    for (let h = 0; h < H; h++) { pb[2 * h] = -3 * sS[A + h] + 4 * sS[M + h] - sS[B + h]; pb[2 * h + 1] = 2 * sS[A + h] - 4 * sS[M + h] + 2 * sS[B + h]; }
    let best = -Infinity, jBest = 8;
    for (let j = 1; j < 16; j++) {
      const u = j / 16;
      let d = out ? Infinity : -Infinity;
      for (let h = 0; h < H; h++) {
        const q = sS[A + h] + (pb[2 * h] + pb[2 * h + 1] * u) * u;
        if (out) { if (-q < d) d = -q; } else if (((eMask >> h) & 1) && q > d) d = q;
      }
      if (d > best) { best = d; jBest = j; }
    }
    let t = fT, slot = fS;
    if (jBest !== 8) {
      const t2 = fT0 + (jBest / 16) * (fT1 - fT0), s2 = DEPTH + 3;
      sampleAt(t2, s2, fA, fB);
      if (depthOf(s2) > depthOf(fS)) { t = t2; slot = s2; }
    }
    const v = addVertex(X[2 * lo] + t * dx, X[2 * lo + 1] + t * dy);
    classify(v, sY[2 * slot], sY[2 * slot + 1]);
    return v;
  };
  /**
   * -1, or the vertex that splits the edge a-b (both ends prepared). The answer depends on the edge alone and is kept,
   * so the two triangles at the edge split it at the same vertex. An edge with one end strictly inside and the other
   * strictly outside is split only for a notch of another cut.
   */
  const splitOf = (a, b) => {
    if (gen[a] >= GEN || gen[b] >= GEN) return -1;
    const out = oom[a] !== 0 && oom[b] !== 0 && (om[a] | om[b]) !== 0;
    let mask = 0;
    if (out) {
      // both ends on or outside the boundary, one of them outside: a lobe? (Not if both are beyond one side of the
      // bounding box, or on or beyond one mirror: a mirror is straight. Not if one is far beyond a line that the other
      // is on or beyond too: the bound below would say the same.)
      if ((oc[a] & oc[b]) || (oom[a] & oom[b] & mir) || (fm[a] & oom[b]) || (fm[b] & oom[a])) return -1;
    } else {
      // an end inside, or both on the boundary: a notch of a cut that neither end is outside of, and both are near?
      mask = nm[a] & nm[b] & ~(om[a] | om[b]);
      if (mask === 0) return -1;
    }
    const lo = a < b ? a : b, hi = a < b ? b : a;
    begin(lo, hi, out, mask);
    if (cleared(0, 1, 1)) return -1;                   // the bounds settle most edges: no sample, nothing to remember
    const key = lo * 2097152 + hi;
    let v = splits.get(key);
    if (v === undefined) {
      v = twice();
      if (v >= 0) gen[v] = 1 + (gen[a] > gen[b] ? gen[a] : gen[b]);
      splits.set(key, v);
    }
    return v;
  };
  /**
   * A triangle of the fine mesh (as addLong below leaves it), or a part of one: split at the first of its edges that
   * has a lobe or a notch, and the two parts likewise — the halves of the split edge and the edge drawn across the
   * triangle are edges like any other (a lobe of the tile on a long edge has the notch of the next tile edge on one
   * of its halves, when a short tile edge lies along the fine edge). Every split is the answer of splitOf for an
   * edge, the same for the two triangles at the edge, so the parts fit. It ends: a split point is of a higher
   * generation than both ends of its edge (a vertex of the fine mesh: 0), every edge it makes — the two halves, the
   * edge drawn across — therefore of a higher generation than the edge split, and an edge with an end of generation
   * GEN is left alone. The limit is needed: next to a corner of the tile, a vertex of the fine mesh a hair inside one
   * cut sends every edge toward the corner across that cut twice (a notch), and the edge from each notch to the vertex
   * beyond the corner has the tip of the corner on it (a lobe), which draws the next edge toward the corner. (Of
   * 102,000 wavy meshes one got that far: 79,906 split points of generation 1, 35 of generation 2, five of
   * generation 3, one of generation 4. Its notches were 2e-5 to 9e-4 deep; an edge with only the tip of a corner on
   * it, its ends beyond two different tile edges, is clipped right without a split.)
   */
  const addFine = (a, b, c, cellId) => {
    if (oc[a] & oc[b] & oc[c]) return;                 // all three beyond one side of the tile's bounding box
    prep(a); prep(b); prep(c);
    if (fm[a] & fm[b] & fm[c]) return;                 // all three far beyond one edge line
    let v;
    if ((v = splitOf(a, b)) >= 0) { addFine(a, v, c, cellId); addFine(v, b, c, cellId); return; }
    if ((v = splitOf(b, c)) >= 0) { addFine(a, b, v, cellId); addFine(a, v, c, cellId); return; }
    if ((v = splitOf(c, a)) >= 0) { addFine(a, b, v, cellId); addFine(v, b, c, cellId); return; }
    addTriangle(a, b, c, cellId);
  };

  // ---- long edges that a cut crosses ONCE. Between two crossings the rim is a straight chord and the cut is not:
  // a chord of length L leaves it by up to bend L² / 8 (by about 0.4 of that in fact: warp.bend is a bound). In the
  // middle of a kaleidoscope cell, where the fine triangles are largest, that came to 0.8 % of the tile size, and to
  // 1.5 % in the worst position. So before anything else an edge of the fine mesh that a cut crosses, and that is
  // long by this measure, is halved, and its two triangles with it: the edges this draws across them cross the cut as
  // well and give the rim a vertex in between. One halving, of the edges of the fine mesh only — halving whatever is
  // long and crossed, the drawn edges too, never ends: the medians of a triangle keep drawing each other. What it
  // leaves is then treated like a fine mesh that came that way (addFine looks at all its edges, the halves and the
  // drawn ones included — the middle of an edge can land in a notch).
  const SAG = 6e-3;                                    // the sagitta, by the bound and in tile sizes, that makes an edge long
  const longC = 8 * SAG * size, halves = new Map();
  /** -1, or the vertex at the middle of the edge a-b of the fine mesh (both ends prepared): the same for both its triangles. */
  const halfOf = (a, b) => {
    if (!((oom[a] === 0 && (om[b] & ~mir) !== 0) || (oom[b] === 0 && (om[a] & ~mir) !== 0))) return -1;      // one end inside, the other beyond a cut
    const dx = X[2 * b] - X[2 * a], dy = X[2 * b + 1] - X[2 * a + 1];
    if (bend * (dx * dx + dy * dy) <= longC) return -1;
    const lo = a < b ? a : b, hi = a < b ? b : a, key = lo * 2097152 + hi;
    let v = halves.get(key);
    if (v === undefined) {
      exact(lo); exact(hi);
      const x = (X[2 * lo] + X[2 * hi]) / 2, y = (X[2 * lo + 1] + X[2 * hi + 1]) / 2;
      warp.inv(x, y, tmp, (Y[2 * lo] + Y[2 * hi]) / 2, (Y[2 * lo + 1] + Y[2 * hi + 1]) / 2);
      const y0 = tmp[0], y1 = tmp[1];
      v = addVertex(x, y);
      classify(v, y0, y1);
      halves.set(key, v);
    }
    return v;
  };
  /** A triangle of the fine mesh, with a wavy cut. `marks`: its edges not yet asked for halving (bit 0: a-b, 1: b-c, 2: c-a). */
  const addLong = (a, b, c, marks, cellId) => {
    if (oc[a] & oc[b] & oc[c]) return;                 // all three beyond one side of the tile's bounding box
    prep(a); prep(b); prep(c);
    let v;
    if ((marks & 1) && (v = halfOf(a, b)) >= 0) { addLong(a, v, c, marks & 4, cellId); addLong(v, b, c, marks & 2, cellId); return; }
    if ((marks & 2) && (v = halfOf(b, c)) >= 0) { addLong(a, b, v, marks & 1, cellId); addLong(a, v, c, marks & 4, cellId); return; }
    if ((marks & 4) && (v = halfOf(c, a)) >= 0) { addLong(a, b, v, marks & 1, cellId); addLong(v, b, c, marks & 2, cellId); return; }
    addFine(a, b, c, cellId);
  };

  // ---- cells and their fine triangles
  const kal = group.kaleido;
  const cellList = [];        // {g, poly, cen}
  if (kal) {
    const N = Math.max(2, Math.round(thin * (density || 22)));
    const tpl = fineTemplate(kal, N);
    const T = kal.cell;
    nearD = (bend * tpl.maxEdge * tpl.maxEdge) / 2;    // an edge with an end further inside a cut than this cannot cross it twice
    setDeep();
    const halfDiag = Math.hypot(bx1 - bx0, by1 - by0) / 2;
    const cands = elementsNear(kal.group, (bx0 + bx1) / 2, (by0 + by1) / 2, halfDiag + tpl.rad, tpl.cen[0], tpl.cen[1]);
    // tolerant weld of the vertices on cell sides: buckets of width WH, neighbours probed near bucket borders
    const WH = Math.max(1e-6, (2 * halfDiag + 4 * tpl.rad) / 4e6), wtol = WELD / WH;
    const wx = bx0 - 2 * tpl.rad - WH, wy = by0 - 2 * tpl.rad - WH;
    const weld = new Map();
    const probe = (ix, iy, x, y) => {
      const v = weld.get(ix * 4194304 + iy);
      return v !== undefined && Math.abs(X[2 * v] - x) < WELD && Math.abs(X[2 * v + 1] - y) < WELD ? v : -1;
    };
    const borderVertex = (x, y) => {
      const fx = (x - wx) / WH, fy = (y - wy) / WH;
      const ix = Math.floor(fx), iy = Math.floor(fy), rx = fx - ix, ry = fy - iy;
      const ax = rx < wtol ? -1 : rx > 1 - wtol ? 1 : 0, ay = ry < wtol ? -1 : ry > 1 - wtol ? 1 : 0;
      let v = probe(ix, iy, x, y);
      if (v < 0 && ax) v = probe(ix + ax, iy, x, y);
      if (v < 0 && ay) v = probe(ix, iy + ay, x, y);
      if (v < 0 && ax && ay) v = probe(ix + ax, iy + ay, x, y);
      if (v < 0) { v = addVertex(x, y); weld.set(ix * 4194304 + iy, v); }
      return v;
    };
    const loc = new Int32Array(tpl.nv);
    for (const k of cands) {
      const poly = T.map((p) => apply(k, p[0], p[1]));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      if (x0 > bx1 || x1 < bx0 || y0 > by1 || y1 < by0) continue;
      const cellId = cellList.length;
      cellList.push({ g: { a: k.a, b: k.b, c: k.c, d: k.d, tx: k.tx, ty: k.ty }, poly, cen: apply(k, tpl.cen[0], tpl.cen[1]) });
      const uv = tpl.uv;
      for (let i = 0; i < tpl.nv; i++) {
        const x = k.a * uv[2 * i] + k.b * uv[2 * i + 1] + k.tx, y = k.c * uv[2 * i] + k.d * uv[2 * i + 1] + k.ty;
        loc[i] = tpl.border[i] ? borderVertex(x, y) : addVertex(x, y);
      }
      const tt = tpl.tri, flip = det(k) < 0;
      for (let t = 0; t < tt.length; t += 3) {
        const a = loc[tt[t]], b = loc[tt[flip ? t + 2 : t + 1]], c = loc[tt[flip ? t + 1 : t + 2]];
        if (ident) addTriangle(a, b, c, cellId); else addLong(a, b, c, 7, cellId);
      }
    }
  } else {
    // one pseudo-cell: a regular grid over the bounding box, ~56 steps across the longer side
    const steps = Math.max(2, Math.round(thin * (density || 56)));
    const w = bx1 - bx0, hgt = by1 - by0, step = Math.max(w, hgt) / steps;
    const gx = Math.max(1, Math.ceil(w / step - 1e-9)), gy = Math.max(1, Math.ceil(hgt / step - 1e-9));
    cellList.push({ g: { ...IDENT }, poly: null, cen: [(bx0 + bx1) / 2, (by0 + by1) / 2] });
    for (let j = 0; j <= gy; j++) for (let i = 0; i <= gx; i++) addVertex(bx0 + (i * w) / gx, by0 + (j * hgt) / gy);
    const id = (i, j) => j * (gx + 1) + i;
    nearD = (bend * ((w / gx) ** 2 + (hgt / gy) ** 2)) / 2;      // as above; the longest edge is the diagonal of a grid cell
    setDeep();
    // (a cut meets a mirror at a right angle, so with the mirrors along the grid it runs ALONG a grid line there and
    // can cross it twice: the grid needs the look at its edges as much as the thin triangles of a kaleidoscope cell)
    const add = ident ? addTriangle : (a, b, c, cellId) => addLong(a, b, c, 7, cellId);
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
        if ((i + j) & 1) { add(a, b, d, 0); add(b, c, d, 0); } else { add(a, b, c, 0); add(a, c, d, 0); }
      }
    }
  }

  // ---- pieces: connected components of triangles that share an edge within one cell; hinges across cells
  let m = triCellOut.length;
  const triPiece = new Int32Array(m);        // provisional piece id per triangle
  let nPieces = 1;
  const hingeList = [];                      // t1, t2, lo, hi  (triangles of different cells sharing the edge lo-hi)
  if (kal) {
    const uf = new Int32Array(m);
    for (let t = 0; t < m; t++) uf[t] = t;
    const find = (t) => { while (uf[t] !== t) { uf[t] = uf[uf[t]]; t = uf[t]; } return t; };
    let tsize = 16;
    while (tsize < 6 * m) tsize *= 2;
    const mask = tsize - 1, klo = new Int32Array(tsize).fill(-1), khi = new Int32Array(tsize), kt = new Int32Array(tsize);
    for (let t = 0; t < m; t++) {
      for (let e = 0; e < 3; e++) {
        const u = triOut[3 * t + e], v = triOut[3 * t + (e === 2 ? 0 : e + 1)];
        const lo = u < v ? u : v, hi = u < v ? v : u;
        let s = (Math.imul(lo, 73856093) ^ Math.imul(hi, 19349663)) & mask;
        while (klo[s] !== -1 && (klo[s] !== lo || khi[s] !== hi)) s = (s + 1) & mask;
        if (klo[s] === -1) { klo[s] = lo; khi[s] = hi; kt[s] = t; continue; }
        const t2 = kt[s];
        if (triCellOut[t2] === triCellOut[t]) { const r1 = find(t), r2 = find(t2); if (r1 !== r2) uf[r1] = r2; } else hingeList.push(t2, t, lo, hi);
      }
    }
    const idOf = new Map();
    for (let t = 0; t < m; t++) {
      const r = find(t);
      let id = idOf.get(r);
      if (id === undefined) { id = idOf.size; idOf.set(r, id); }
      triPiece[t] = id;
    }
    nPieces = idOf.size;
  }
  const pieceArea = new Float64Array(nPieces), pieceCell = new Int32Array(nPieces);
  for (let t = 0; t < m; t++) {
    const a = triOut[3 * t], b = triOut[3 * t + 1], c = triOut[3 * t + 2];
    pieceArea[triPiece[t]] += ((X[2 * b] - X[2 * a]) * (X[2 * c + 1] - X[2 * a + 1]) - (X[2 * b + 1] - X[2 * a + 1]) * (X[2 * c] - X[2 * a])) / 2;
    pieceCell[triPiece[t]] = triCellOut[t];
  }

  // ---- drop dust pieces, compact triangles and vertices
  const alive = new Int32Array(nPieces).fill(-1);
  let nAlive = 0;
  for (let p = 0; p < nPieces; p++) if (pieceArea[p] >= MIN_PIECE_AREA) alive[p] = nAlive++;
  const vmap = new Int32Array(nv).fill(-1);
  let mAlive = 0;
  for (let t = 0; t < m; t++) if (alive[triPiece[t]] >= 0) mAlive++;
  const tri = new Uint32Array(3 * mAlive), triCell = new Uint16Array(mAlive);
  let n = 0, mm = 0;
  for (let t = 0; t < m; t++) {
    const p = alive[triPiece[t]];
    if (p < 0) continue;
    for (let e = 0; e < 3; e++) {
      const v = triOut[3 * t + e];
      if (vmap[v] < 0) vmap[v] = n++;
      tri[3 * mm + e] = vmap[v];
    }
    triCell[mm++] = p;
  }
  m = mm;
  const xy64 = new Float64Array(2 * n);
  for (let v = 0; v < nv; v++) if (vmap[v] >= 0) { xy64[2 * vmap[v]] = X[2 * v]; xy64[2 * vmap[v] + 1] = X[2 * v + 1]; }
  const pArea = new Float64Array(nAlive), pCell = new Int32Array(nAlive);
  for (let p = 0; p < nPieces; p++) if (alive[p] >= 0) { pArea[alive[p]] = pieceArea[p]; pCell[alive[p]] = pieceCell[p]; }
  nPieces = nAlive;

  // ---- hinge segments between pieces (all shared edges of two pieces lie on one crease line: keep their extent)
  const links = new Map();        // a * nPieces + b (a < b) -> {a, b, px, py, ux, uy, t0, t1}
  for (let i = 0; i < hingeList.length; i += 4) {
    // provisional ids were assigned before compaction: go through `alive`
    const pa = alive[triPiece[hingeList[i]]], pb = alive[triPiece[hingeList[i + 1]]];
    if (pa < 0 || pb < 0 || pa === pb) continue;
    const lo = hingeList[i + 2], hi = hingeList[i + 3];
    const a = Math.min(pa, pb), b = Math.max(pa, pb), key = a * nPieces + b;
    let L = links.get(key);
    if (!L) {
      // the crease is a side of the pieces' cells: take the line from the cell polygon, not from a (possibly tiny) edge
      const q = cellList[pCell[a]].poly, mx = (X[2 * lo] + X[2 * hi]) / 2, my = (X[2 * lo + 1] + X[2 * hi + 1]) / 2;
      let bestD = Infinity;
      for (let k = 0; k < q.length; k++) {
        const u = q[k], w = q[(k + 1) % q.length], dx = w[0] - u[0], dy = w[1] - u[1], l = Math.hypot(dx, dy);
        const d = Math.abs((mx - u[0]) * dy - (my - u[1]) * dx) / l;
        if (d < bestD) { bestD = d; L = { a, b, px: u[0], py: u[1], ux: dx / l, uy: dy / l, t0: Infinity, t1: -Infinity }; }
      }
      links.set(key, L);
    }
    for (const v of [lo, hi]) {
      const t = (X[2 * v] - L.px) * L.ux + (X[2 * v + 1] - L.py) * L.uy;
      if (t < L.t0) L.t0 = t;
      if (t > L.t1) L.t1 = t;
    }
  }
  const adj = Array.from({ length: nPieces }, () => []);
  const minHinge = 1e-3 * size;   // a micro-lobe's hinge still spans a usable segment of its crease line
  for (const L of links.values()) {
    if (L.t1 - L.t0 < minHinge) { const mid = (L.t0 + L.t1) / 2; L.t0 = mid - minHinge / 2; L.t1 = mid + minHinge / 2; }
    adj[L.a].push(L); adj[L.b].push(L);
  }

  // ---- locator: the kaleidoscope cell of a point by its side half-planes, then (several pieces in one cell) its nearest triangle
  const cellInfo = [];            // cells that hold pieces: {cellId, nx, ny, c, pieces, tris, grid}
  const infoOf = new Map();
  for (let p = 0; p < nPieces; p++) {
    let C = infoOf.get(pCell[p]);
    if (!C) {
      const cl = cellList[pCell[p]];
      C = { cellId: pCell[p], k: 0, nx: [], ny: [], c: [], pieces: [], tris: null, grid: null, fill: 0, full: false };
      if (cl.poly) {
        const q = cl.poly, k = q.length;
        for (let i = 0; i < k; i++) {
          const a = q[i], b = q[(i + 1) % k];
          let nx = b[1] - a[1], ny = a[0] - b[0];
          const l = Math.hypot(nx, ny);
          nx /= l; ny /= l;
          let c = nx * a[0] + ny * a[1];
          if (nx * cl.cen[0] + ny * cl.cen[1] - c > 0) { nx = -nx; ny = -ny; c = -c; }
          C.nx.push(nx); C.ny.push(ny); C.c.push(c);
        }
        C.k = k;
      }
      infoOf.set(pCell[p], C);
      cellInfo.push(C);
    }
    C.pieces.push(p);
  }
  // a cell that the tile covers completely (one piece with the whole cell's area) needs no search; the others
  // keep the list of their triangles
  const cellArea = kal ? kal.group.domainArea : 0;
  for (const C of cellInfo) C.full = C.k > 0 && C.pieces.length === 1 && pArea[C.pieces[0]] > cellArea * (1 - 1e-9);
  if (cellInfo.some((C) => !C.full)) {
    const count = new Map();
    for (let t = 0; t < m; t++) { const id = pCell[triCell[t]]; count.set(id, (count.get(id) || 0) + 1); }
    for (const C of cellInfo) { C.tris = C.full ? null : new Int32Array(count.get(C.cellId)); C.fill = 0; }
    for (let t = 0; t < m; t++) { const C = infoOf.get(pCell[triCell[t]]); if (C.tris) C.tris[C.fill++] = t; }
  }
  const locateRaw = makeLocate(cellInfo, xy64, tri, triCell, nPieces, 0.03 * size);

  // ---- tree: breadth-first from the piece that holds the (nudged) warped seed
  warp.fwd(domain.seed[0], domain.seed[1], tmp);
  const rootRaw = locateRaw(tmp[0] + NUDGE * 0.3713, tmp[1] + NUDGE * 0.9285);
  const order = new Int32Array(nPieces).fill(-1);   // provisional -> final
  const seq = [];                                   // final -> provisional
  const parentRaw = new Int32Array(nPieces).fill(-1), depth = new Int32Array(nPieces), hingeRaw = new Array(nPieces).fill(null);
  const visit = (p, par, L) => { order[p] = seq.length; seq.push(p); parentRaw[p] = par; depth[p] = par < 0 ? 0 : depth[par] + 1; hingeRaw[p] = L; };
  const bfs = (from) => {
    for (let i = from; i < seq.length; i++) {
      const p = seq[i];
      for (const L of adj[p]) { const q = L.a === p ? L.b : L.a; if (order[q] < 0) visit(q, p, L); }
    }
  };
  visit(rootRaw, -1, null);
  bfs(0);
  // numerical dust can leave a piece unattached: hinge it to a tree piece across its nearest crease line
  for (let p = 0; p < nPieces; p++) {
    if (order[p] >= 0) continue;
    const C = infoOf.get(pCell[p]), cl = cellList[pCell[p]];
    let bestSide = -1, bestPar = rootRaw, bestD = Infinity, lo = Infinity, hi = -Infinity;
    for (let s = 0; s < C.k; s++) {
      // the cell across side s, and a tree piece in it
      const mx = cl.cen[0] - 2 * (C.nx[s] * cl.cen[0] + C.ny[s] * cl.cen[1] - C.c[s]) * C.nx[s];
      const my = cl.cen[1] - 2 * (C.nx[s] * cl.cen[0] + C.ny[s] * cl.cen[1] - C.c[s]) * C.ny[s];
      const D = cellInfo.find((F) => Math.hypot(cellList[F.cellId].cen[0] - mx, cellList[F.cellId].cen[1] - my) < 1e-6);
      const par = D ? D.pieces.find((q) => order[q] >= 0) : undefined;
      if (par === undefined) continue;
      let dmin = Infinity;
      for (let t = 0; t < m; t++) {
        if (triCell[t] !== p) continue;
        for (let e = 0; e < 3; e++) {
          const v = tri[3 * t + e];
          dmin = Math.min(dmin, Math.abs(C.nx[s] * xy64[2 * v] + C.ny[s] * xy64[2 * v + 1] - C.c[s]));
        }
      }
      if (dmin < bestD) { bestD = dmin; bestSide = s; bestPar = par; }
    }
    const s = bestSide < 0 ? 0 : bestSide;
    const ux = -C.ny[s], uy = C.nx[s], px = C.nx[s] * C.c[s], py = C.ny[s] * C.c[s];
    for (let t = 0; t < m; t++) {
      if (triCell[t] !== p) continue;
      for (let e = 0; e < 3; e++) {
        const v = tri[3 * t + e], tt = (xy64[2 * v] - px) * ux + (xy64[2 * v + 1] - py) * uy;
        if (tt < lo) lo = tt;
        if (tt > hi) hi = tt;
      }
    }
    const from = seq.length;
    visit(p, bestPar, { a: bestPar, b: p, px, py, ux, uy, t0: lo, t1: hi });
    bfs(from);
  }

  // ---- final piece records, in breadth-first order
  for (let t = 0; t < m; t++) triCell[t] = order[triCell[t]];
  for (const C of cellInfo) C.pieces = C.pieces.map((p) => order[p]);
  const cells = [], creases = [];
  for (let i = 0; i < nPieces; i++) {
    const p = seq[i], cl = cellList[pCell[p]], L = hingeRaw[p];
    let hinge = null;
    if (L) {
      let ax = L.px + L.t0 * L.ux, ay = L.py + L.t0 * L.uy, bx = L.px + L.t1 * L.ux, by = L.py + L.t1 * L.uy;
      // the piece (its cell) lies to the LEFT of a -> b
      if ((bx - ax) * (cl.cen[1] - ay) - (by - ay) * (cl.cen[0] - ax) < 0) { [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; }
      hinge = { ax, ay, bx, by };
      creases.push({ a: order[parentRaw[p]], b: i, pts: Float32Array.of(ax, ay, bx, by) });
    }
    cells.push({
      index: i, g: cl.g, parity: det(cl.g) > 0 ? 0 : 1, poly: cl.poly, area: pArea[p],
      parent: parentRaw[p] < 0 ? -1 : order[parentRaw[p]], depth: depth[p], hinge, cellId: pCell[p],
    });
  }
  const root = 0;
  const locate = locateRaw;

  // ---- per-vertex piece (lowest piece index among the triangles around the vertex), positions, bounding box
  const cell = new Uint16Array(n).fill(65535);
  for (let t = 0; t < m; t++) {
    for (let e = 0; e < 3; e++) { const v = tri[3 * t + e]; if (triCell[t] < cell[v]) cell[v] = triCell[t]; }
  }
  const xy = new Float32Array(xy64);
  let mx0 = Infinity, my0 = Infinity, mx1 = -Infinity, my1 = -Infinity;
  for (let v = 0; v < n; v++) {
    const x = xy64[2 * v], y = xy64[2 * v + 1];
    if (x < mx0) mx0 = x; if (x > mx1) mx1 = x; if (y < my0) my0 = y; if (y > my1) my1 = y;
  }

  // ---- the tile outline per edge, each point with the piece of the point nudged toward the tile's interior
  let ccx = 0, ccy = 0;
  for (const p of domain.poly) { ccx += p[0] / H; ccy += p[1] / H; }
  const boundary = outline.map((o) => {
    const i = o.edge, a = domain.poly[i], b = domain.poly[(i + 1) % H], k = o.pts.length / 2;
    const pc = new Uint16Array(k);
    for (let j = 0; j < k; j++) {
      const t = j / (k - 1);
      const sx = (1 - t) * a[0] + t * b[0], sy = (1 - t) * a[1] + t * b[1];
      const dx = ccx - sx, dy = ccy - sy, l = Math.hypot(dx, dy) || 1;
      warp.fwd(sx + (NUDGE * dx) / l, sy + (NUDGE * dy) / l, tmp);
      pc[j] = locateRaw(tmp[0], tmp[1]);
    }
    return { edge: i, cls: E[i].cls, kind: E[i].kind, pts: o.pts, cells: pc };
  });

  return {
    n, xy, cell, tri, m, triCell,
    cells, root, locate, boundary, creases, bbox: [mx0, my0, mx1, my1], group, domain,
  };
}
