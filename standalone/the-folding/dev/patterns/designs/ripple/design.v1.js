// dev/patterns/designs/ripple/design.js — "Ripples": the comma and its echoes (the pattern round of 13 Nov 2026).
//
// THE IDEA. One comma per tile, as on the page, and round it the bands at equal distance from its outline, alternately
// light and dark, out to where they meet the bands of the next comma: a light MOAT, a dark RING, and in the deep corners
// of the comma's cell further bands. The cell is the set of points nearer to this comma than to any other copy (its
// Voronoi cell), so the bands of neighbours meet band to band; a thin light CHANNEL along the cell's border keeps the
// copies apart, and a light POOL lies where three or more cells meet. Every band is the comma, inflated: the moat and
// the ring carry its direction and its hand, and the plane is covered.
//
// THE RULE. find() reads the group's lattice and coset representatives, and the page's default tile when the group has
// presets (the comma is seated whole inside that tile; without presets the rule below still gives a motif). No table.
//   1. THE TILE T: the default tile (presets[0]); without presets the Dirichlet tile of the point that lies farthest
//      from all its own copies (deepSeed).
//   2. THE METRIC: distances are measured after a linear map A (symmetric, det 1) that the point group allows and that
//      makes T about ASPECT times longer than wide (metricOf): a strip's tile is five times longer than wide, and a
//      comma in it is a stretched comma, as the page's is in *x. A is the identity for every group with a 3-, 4- or
//      6-fold centre. "Design plane" below is the plane after A; what is drawn is carried back by A^-1.
//   3. THE SEAT AND THE COMMA (fitComma, a small linear program per turn and stretch of the comma): the largest comma
//      that fits a seat with its moat, the ring's neck and half a channel to spare, SLACK of it, moved to where the
//      seat's deepest corner is shallowest. Three seats are tried:
//        tile      T itself (the comma's cell is then about T);
//        strip     T, a thin strip (the ringed comma would be less than WIDE across): no ring on the long side the
//                  comma turns its back to;
//        roomiest  the Dirichlet tile of the roomiest place of T (roomiest), the comma kept inside T: taken when its
//                  score beats the tile's by ROOMY (a tile with thin corners: 632, 3*3, 4*2, the rhombus of 333).
//      score = r^2 sigma^BETA - NU * (bands the deepest corner needs).
//   4. THE DISTANCES, on a grid in the comma's own frame (so the motif turns with the group): the exact signed distance
//      d1 to the comma (sdfGrid); for every other copy of the comma near by, its distance by a look-up in the same
//      grid, moved by that element; a mirror's border is its line, exactly. t1 = the distance on the paper to the
//      nearest border of the cell, less half a channel.
//   5. THE BANDS: light for d1 < moat, dark to moat + RING, the same all round. Beyond the ring each corner of the cell
//      (a connected piece of it there) is, by its depth: a light POOL; or the ring SWELLs into it and the pool stays
//      POOL deep; or light and dark bands, as few as leave a last dark band no deeper than TIP, which runs to the
//      corner's tip (the petals round a rotation centre or a mirror corner).
//   6. THE OUTLINES: an opening by a disc of radius THIN (no dark piece is narrower than 2 THIN, every convex corner is
//      round, the slivers where a band meets a channel at a flat angle are gone), pieces under SPECK left out, then the
//      zero line by marching squares, thinned to EPS. The comma itself is drawn from its own formula.
// The copies of the motif keep CHANNEL (0.05 tile sizes) apart, 2.5 times the kit's GAP_MIN.
// See NOTES.md for the knobs, the numbers and what is weak; lab/ for the tools the design was looked at with.

import { elementsNear } from '../../../../src/groups.js';
import { buildDomain } from '../../../../src/domain.js';
import { clipHalfPlane, polyCentroid } from '../../../../src/geom.js';
import { comma } from '../../kit.js';

export const meta = { key: 'ripple', label: 'Ripples', hint: 'a comma and its echoes: bands at equal distance from it, out to the next comma' };

/** Every length is in tile sizes, sqrt(domainArea), unless it says otherwise. */
export const KNOBS = Object.freeze({
  HEAD: 0.5,          // the comma's head radius, in comma radii (0.5: the yin-yang half)
  MOAT: 0.36,         // width of the light moat round the comma, in comma radii
  RING: 0.135,        // width of the dark ring
  NECK: 0.055,        // least width of the dark ring, where the comma comes nearest its cell's border
  WIDE: 0.22,         // a comma less than this across (a thin strip's) gives up the ring along the strip's long sides,
  GAP: 0.035,         // and comes this near the channel there
  INSIDE: 0.02,       // the comma keeps this far inside the default tile when its cell is not the tile
  ROOMY: 1.1,         // the roomiest place of the tile is the seat when its score is this much better than the tile's
  POOL: 0.18,         // a corner of the cell no deeper than this beyond the ring is a light pool
  SWELL: 0.11,        // a corner up to this much deeper: the ring swells into it (not at the channels), the pool stays POOL deep
  LIGHT: 0.09,        // a deeper corner: width of its light bands,
  DARK: 0.15,         // of its dark bands,
  TIP: 0.45,          // and the most of its last dark band, which runs to the corner's tip (as few bands as that allows)
  PETAL: 0.008,       // ... a tip whose core (THIN inside its outline) is smaller than this, in tile areas, takes the band before it in
  CHANNEL: 0.05,      // width of the light channel between two cells
  THIN: 0.02,         // radius of the opening: no dark piece is narrower than twice this, convex corners are this round
  SPECK: 0.02,        // a dark piece smaller than this (in tile areas) is left out
  ASPECT: 1.25,       // the seat is made this much longer than wide, at most (the comma's own proportion)
  KAPPA: 2.4,         // ... but the map A stretches by at most this
  SIGMAS: [1, 1.2, 1.45],   // stretches of the comma along its own axis that are tried,
  STRETCH: 2.9,       // as long as the comma on the paper is stretched no more than this in all (KAPPA alone may exceed it)
  BETA: 0.35,         // a stretched comma must be this much larger to be chosen: size = r^2 * sigma^BETA
  SLACK: 0.94,        // the comma is this much of the largest that fits: the rest is room to balance the corners
  NU: 0.012,          // score = size - NU * (the number of bands the seat's deepest corner needs beyond the ring)
  STEP: 0.011,        // grid step
  CELLS: 46000,       // most grid points
  SEG: 0.02,          // longest segment of a curved outline
  EPS: 0.0005,        // an outline keeps within this of the marching-squares line
});

const BIG = 1e9;

// ---- small helpers -------------------------------------------------------------------------------------------------

function moments(P) {
  let A = 0, cx = 0, cy = 0, ixx = 0, ixy = 0, iyy = 0;
  for (let i = 0, n = P.length; i < n; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % n], w = x0 * y1 - x1 * y0;
    A += w; cx += (x0 + x1) * w; cy += (y0 + y1) * w;
    ixx += (x0 * x0 + x0 * x1 + x1 * x1) * w; iyy += (y0 * y0 + y0 * y1 + y1 * y1) * w;
    ixy += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * w;
  }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  return { area: A, cx, cy, mxx: ixx / (12 * A) - cx * cx, mxy: ixy / (24 * A) - cx * cy, myy: iyy / (12 * A) - cy * cy };
}

/** affine maps as [a, b, c, d, tx, ty]: (x, y) -> (a x + b y + tx, c x + d y + ty) */
function mul(g, h) {
  return [g[0] * h[0] + g[1] * h[2], g[0] * h[1] + g[1] * h[3], g[2] * h[0] + g[3] * h[2], g[2] * h[1] + g[3] * h[3],
    g[0] * h[4] + g[1] * h[5] + g[4], g[2] * h[4] + g[3] * h[5] + g[5]];
}
function inv(g) {
  const dt = g[0] * g[3] - g[1] * g[2], a = g[3] / dt, b = -g[1] / dt, c = -g[2] / dt, d = g[0] / dt;
  return [a, b, c, d, -(a * g[4] + b * g[5]), -(c * g[4] + d * g[5])];
}

// ---- 1. the seat ---------------------------------------------------------------------------------------------------

/** The point of the plane farthest from all its own copies (a kaleidoscope: the incentre of the chamber). */
function deepSeed(group) {
  const { e1, e2, center } = group;
  const L = Math.hypot(e1[0], e1[1]) + Math.hypot(e2[0], e2[1]);
  const els = elementsNear(group, center[0], center[1], 2.2 * L, center[0], center[1])
    .filter((g) => Math.abs(g.a - 1) + Math.abs(g.b) + Math.abs(g.tx) + Math.abs(g.ty) > 1e-9 * L || g.a * g.d - g.b * g.c < 0);
  const f = (s, t) => {
    const x = center[0] + s * e1[0] + t * e2[0], y = center[1] + s * e1[1] + t * e2[1];
    let m = Infinity;
    for (const g of els) { const dx = g.a * x + g.b * y + g.tx - x, dy = g.c * x + g.d * y + g.ty - y, d = dx * dx + dy * dy; if (d < m) m = d; }
    return m;
  };
  const N = 24;
  let bs = 0, bt = 0, bv = -1;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const s = (i + 0.37) / N - 0.5, t = (j + 0.61) / N - 0.5, v = f(s, t);
    if (v > bv * (1 + 1e-9)) { bv = v; bs = s; bt = t; }
  }
  for (let step = 0.5 / N, it = 0; it < 14; it++, step *= 0.6) {
    for (const [ds, dt] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const v = f(bs + ds * step, bt + dt * step);
      if (v > bv * (1 + 1e-9)) { bv = v; bs += ds * step; bt += dt * step; }
    }
  }
  return [center[0] + bs * e1[0] + bt * e2[0], center[1] + bs * e1[1] + bt * e2[1]];
}

function seatOf(group) {
  const p0 = group.presets && group.presets.length ? group.presets[0] : null;
  const D = p0 ? buildDomain(group, { seed: p0.seed, metric: p0.metric }) : buildDomain(group, { seed: deepSeed(group) });
  const poly = D.poly.map((p) => [p[0], p[1]]);
  if (moments(poly).area < 0) poly.reverse();
  return poly;
}

/**
 * The roomiest place of the tile T (a convex polygon) for a comma that stays inside it: the point p of T where a disc
 * about p is largest that keeps mD from the border of p's own Dirichlet tile (half way to its nearest copy) and mT from
 * the border of T; and that Dirichlet tile. Distances are taken after the map A; the tile is returned in the design plane.
 */
function roomiest(group, T, A, Ai, mD, mT) {
  const m = moments(T), L = Math.hypot(group.e1[0], group.e1[1]) + Math.hypot(group.e2[0], group.e2[1]);
  const els = elementsNear(group, m.cx, m.cy, 2.2 * L, m.cx, m.cy)
    .filter((g) => Math.abs(g.a - 1) + Math.abs(g.b) + Math.abs(g.tx) + Math.abs(g.ty) > 1e-9 * L || g.a * g.d - g.b * g.c < 0);
  const n = T.length, ex = [], ey = [], ec = [], ef = [];
  for (let i = 0; i < n; i++) {
    const p = T[i], q = T[(i + 1) % n], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    ex.push((q[1] - p[1]) / l); ey.push(-(q[0] - p[0]) / l); ec.push(ex[i] * p[0] + ey[i] * p[1]);
    ef.push(1 / Math.hypot(Ai[0] * ex[i] + Ai[2] * ey[i], Ai[1] * ex[i] + Ai[3] * ey[i]));      // a distance from this side, after A
  }
  const f = (x, y) => {
    let edge = Infinity;
    for (let i = 0; i < n; i++) { const d = (ec[i] - ex[i] * x - ey[i] * y) * ef[i]; if (d < edge) edge = d; }
    if (edge < 0) return -Infinity;
    let best = Infinity;
    for (const g of els) { const dx = g.a * x + g.b * y + g.tx - x, dy = g.c * x + g.d * y + g.ty - y, u = A[0] * dx + A[1] * dy, v = A[2] * dx + A[3] * dy, d = u * u + v * v; if (d < best) best = d; }
    return Math.min(Math.sqrt(best) / 2 - mD, edge - mT);
  };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of T) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const N = 20, tie = 1e-9 * L;
  let bx = m.cx, by = m.cy, bv = f(m.cx, m.cy);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = x0 + ((i + 0.5) / N) * (x1 - x0), y = y0 + ((j + 0.5) / N) * (y1 - y0), v = f(x, y);
    if (v > bv + tie) { bv = v; bx = x; by = y; }
  }
  for (let step = Math.max(x1 - x0, y1 - y0) / N, it = 0; it < 14; it++, step *= 0.6) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const x = bx + dx * step, y = by + dy * step, v = f(x, y);
      if (v > bv + tie) { bv = v; bx = x; by = y; }
    }
  }
  // its Dirichlet tile in the design plane
  const ax = A[0] * bx + A[1] * by, ay = A[2] * bx + A[3] * by, R = 4 * L;
  let D = [[ax - R, ay - R], [ax + R, ay - R], [ax + R, ay + R], [ax - R, ay + R]];
  const near = els.map((g) => { const x = g.a * bx + g.b * by + g.tx, y = g.c * bx + g.d * by + g.ty; return [A[0] * x + A[1] * y, A[2] * x + A[3] * y]; })
    .sort((p, q) => (p[0] - ax) ** 2 + (p[1] - ay) ** 2 - (q[0] - ax) ** 2 - (q[1] - ay) ** 2);
  for (const q of near) {
    const dx = q[0] - ax, dy = q[1] - ay, l = Math.hypot(dx, dy);
    if (l < 1e-9 * L) continue;
    D = clipHalfPlane(D, dx / l, dy / l, ((q[0] * q[0] + q[1] * q[1]) - (ax * ax + ay * ay)) / (2 * l));
    if (D.length < 3) return null;
  }
  // drop repeated corners
  const out = [];
  for (let i = 0; i < D.length; i++) { const q = D[(i + 1) % D.length]; if (Math.hypot(q[0] - D[i][0], q[1] - D[i][1]) > 1e-9 * L) out.push(D[i]); }
  return out.length >= 3 ? out : null;
}

// ---- 2. the metric -------------------------------------------------------------------------------------------------

/** The linear map A (symmetric, det 1) of the header, its inverse, the seat's long axis and how much A stretches. */
function metricOf(group, P, K) {
  const m = moments(P);
  let a = 0, b = 0, d = 0;
  for (const r of group.reps) {                                   // L M L^T, averaged over the point group
    a += r.a * (m.mxx * r.a + m.mxy * r.b) + r.b * (m.mxy * r.a + m.myy * r.b);
    b += r.a * (m.mxx * r.c + m.mxy * r.d) + r.b * (m.mxy * r.c + m.myy * r.d);
    d += r.c * (m.mxx * r.c + m.mxy * r.d) + r.d * (m.mxy * r.c + m.myy * r.d);
  }
  const tr = a + d, df = Math.hypot(a - d, 2 * b), l1 = (tr + df) / 2, l2 = (tr - df) / 2;
  const kappa = Math.sqrt(l1 / Math.max(l2, 1e-12 * l1));           // how much longer than wide the seat is
  let vx = 1, vy = 0;
  if (df > 1e-9 * tr) { const ang = 0.5 * Math.atan2(2 * b, a - d); vx = Math.cos(ang); vy = Math.sin(ang); }
  const ku = Math.min(K.KAPPA, Math.max(1, kappa / K.ASPECT));
  const s1 = 1 / Math.sqrt(ku), s2 = Math.sqrt(ku);                // A shrinks the long axis v and widens the other
  const mk = (p, q) => [p * vx * vx + q * vy * vy, (p - q) * vx * vy, (p - q) * vx * vy, p * vy * vy + q * vx * vx];
  return { A: mk(s1, s2), Ai: mk(s2, s1), ku, kappa, axis: [vx, vy] };
}

// ---- 3. the comma --------------------------------------------------------------------------------------------------

/** max r with  nx.p + ny.p + hh r <= bb  for every edge: the best vertex of a tiny linear program */
function lpMax(nx, ny, hh, bb, tol) {
  const E = nx.length;
  let best = null;
  for (let i = 0; i < E; i++) for (let j = i + 1; j < E; j++) for (let k = j + 1; k < E; k++) {
    const m0 = ny[j] * hh[k] - hh[j] * ny[k], m1 = nx[j] * hh[k] - hh[j] * nx[k], m2 = nx[j] * ny[k] - ny[j] * nx[k];
    const det = nx[i] * m0 - ny[i] * m1 + hh[i] * m2;
    if (Math.abs(det) < 1e-12) continue;
    const r = (nx[i] * (ny[j] * bb[k] - bb[j] * ny[k]) - ny[i] * (nx[j] * bb[k] - bb[j] * nx[k]) + bb[i] * m2) / det;
    if (!(r > 0) || (best && r <= best.r)) continue;
    const px = (bb[i] * m0 - ny[i] * (bb[j] * hh[k] - hh[j] * bb[k]) + hh[i] * (bb[j] * ny[k] - ny[j] * bb[k])) / det;
    const py = (nx[i] * (bb[j] * hh[k] - hh[j] * bb[k]) - bb[i] * m1 + hh[i] * (nx[j] * bb[k] - bb[j] * nx[k])) / det;
    let ok = true;
    for (let q = 0; q < E; q++) if (nx[q] * px + ny[q] * py + hh[q] * r > bb[q] + tol) { ok = false; break; }
    if (ok) best = { px, py, r };
  }
  return best;
}

/** The sides of a convex polygon (counter-clockwise) as rows of the fit: outward unit normal, offset, kind. */
function sides(P, kind) {
  const out = [];
  for (let i = 0, n = P.length; i < n; i++) {
    const p = P[i], q = P[(i + 1) % n], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (!(l > 0)) continue;
    const nx = (q[1] - p[1]) / l, ny = -(q[0] - p[0]) / l;
    out.push({ nx, ny, c: nx * p[0] + ny * p[1], kind: typeof kind === 'function' ? kind(nx, ny) : kind });
  }
  return out;
}

/**
 * The comma of a seat (design plane). rows: the lines it keeps clear of, each of a kind
 *   0  a side of its cell, with the ring: the comma, its moat, the ring's neck and half a channel fit before it
 *   1  a side of its cell, without the ring: the comma comes within GAP of the channel
 *   3  a long side of a thin strip: 1 where the comma's back faces it, else 0
 *   2  a side of the default tile, where the cell is not the tile: the comma stays INSIDE it
 * V: the corners of the seat. For every turn and stretch the largest comma that fits, SLACK of it, moved to where the
 * seat's deepest corner is shallowest; the best by size, less a fine for the bands a deep corner needs.
 */
function fitComma(rows, V, M, size, alphas, K) {
  const E = rows.length, nx = new Float64Array(E), ny = new Float64Array(E), room = new Float64Array(E), extra = new Float64Array(E), paper = new Float64Array(E);
  const { A } = M;
  for (let i = 0; i < E; i++) {
    const w = rows[i];
    nx[i] = w.nx; ny[i] = w.ny;
    // a distance d across this line in the design plane is d / |A n| on the paper
    paper[i] = Math.hypot(A[0] * w.nx + A[2] * w.ny, A[1] * w.nx + A[3] * w.ny);
  }
  const U = comma({ head: K.HEAD, nBack: 12, nHollow: 6, nHead: 6 }), nU = U.length;
  const hh = new Float64Array(E), list = [];
  let top = 0;
  for (const sigma of K.SIGMAS) {
    if (sigma > 1 && sigma * M.ku > K.STRETCH) continue;
    for (const alpha of alphas) {
      const ca = Math.cos(alpha), sa = Math.sin(alpha);
      for (let i = 0; i < E; i++) {
        // kind 3: a long side of a thin strip: the ring is left out on the side the comma's back faces
        let kind = rows[i].kind;
        if (kind === 3) kind = nx[i] * ca + ny[i] * sa > 0 ? 1 : 0;
        room[i] = rows[i].c - (kind === 0 ? K.CHANNEL / 2 + K.NECK : kind === 1 ? K.CHANNEL / 2 + K.GAP : K.INSIDE) * size * paper[i];
        extra[i] = kind === 0 ? K.MOAT : 0;
      }
      for (let i = 0; i < E; i++) {
        let h = -Infinity;
        for (let j = 0; j < nU; j++) { const x = U[j][0], y = U[j][1], v = nx[i] * (ca * x - sa * sigma * y) + ny[i] * (sa * x + ca * sigma * y); if (v > h) h = v; }
        hh[i] = h * 1.012 + extra[i];                               // 1.012: the coarse outline is a little inside the comma
      }
      const s = lpMax(nx, ny, hh, room, 1e-9 * size);
      if (!s) continue;
      const s0 = s.r * s.r * Math.pow(sigma, K.BETA);
      if (s0 > top) top = s0;
      list.push({ sigma, alpha, r: s.r, px: s.px, py: s.py, hh: Array.from(hh), room: Array.from(room), s0 });
    }
  }
  const ux = new Float64Array(nU), uy = new Float64Array(nU), nV = V.length;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of V) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  let best = null;
  for (const cnd of list) {
    if (cnd.s0 < 0.5 * top) continue;
    const r = K.SLACK * cnd.r, ca = Math.cos(cnd.alpha), sa = Math.sin(cnd.alpha);
    for (let j = 0; j < nU; j++) { ux[j] = U[j][0]; uy[j] = cnd.sigma * U[j][1]; }
    // how deep the seat's deepest corner is with the comma at p
    const deepAt = (px, py) => {
      let d = 0;
      for (let q = 0; q < nV; q++) { const dx = (V[q][0] - px) / r, dy = (V[q][1] - py) / r, v = distToPoly(ux, uy, ca * dx + sa * dy, -sa * dx + ca * dy); if (v > d) d = v; }
      return d * r;
    };
    let F = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    for (let i = 0; i < E && F.length >= 3; i++) F = clipHalfPlane(F, nx[i], ny[i], cnd.room[i] - cnd.hh[i] * r);
    let p = [cnd.px, cnd.py], dp;
    if (F.length >= 3 && Math.abs(moments(F).area) > 1e-14 * size * size) {
      const inF = (x, y) => { for (let i = 0; i < E; i++) if (nx[i] * x + ny[i] * y > cnd.room[i] - cnd.hh[i] * r + 1e-12 * size) return false; return true; };
      p = polyCentroid(F); dp = deepAt(p[0], p[1]);
      let wide = 0;                                                 // how far apart two places of the comma can be
      for (const q of F) for (const q2 of F) wide = Math.max(wide, Math.hypot(q[0] - q2[0], q[1] - q2[1]));
      for (let step = wide / 4, it = 0; it < 5; it++, step /= 2) {
        for (let guard = 0, moved = true; moved && guard < 3; guard++) {
          moved = false;
          for (const [ex, ey] of [[ca, sa], [-ca, -sa], [-sa, ca], [sa, -ca]]) {      // along and across the comma
            const x = p[0] + ex * step, y = p[1] + ey * step;
            if (!inF(x, y)) continue;
            const d = deepAt(x, y);
            if (d < dp - 1e-9 * size) { dp = d; p = [x, y]; moved = true; }
          }
        }
      }
    } else dp = deepAt(p[0], p[1]);
    const e2 = K.MOAT * r + K.RING * size;
    const over = Math.max(0, (dp - e2) / size - K.POOL) / (K.LIGHT + K.DARK);
    const score = (r * r * Math.pow(cnd.sigma, K.BETA)) / (size * size) - K.NU * over;
    if (!best || score > best.score + 1e-7) best = { score, r, sigma: cnd.sigma, alpha: cnd.alpha, p, deep: dp };
  }
  return best;
}

// ---- 4. distances on a grid ----------------------------------------------------------------------------------------

/** Signed distance to the closed polygon (kx, ky) at the points (u0 + i h, v0 + j h): negative inside. */
function sdfGrid(kx, ky, u0, v0, h, nu, nv) {
  const n = kx.length, CH = 6, nc = Math.ceil(n / CH);
  const ccx = new Float64Array(nc), ccy = new Float64Array(nc), ccr = new Float64Array(nc);
  for (let c = 0; c < nc; c++) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let s = c * CH; s <= Math.min(n, (c + 1) * CH); s++) { const x = kx[s % n], y = ky[s % n]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    ccx[c] = (x0 + x1) / 2; ccy[c] = (y0 + y1) / 2; ccr[c] = Math.hypot(x1 - x0, y1 - y0) / 2;
  }
  const out = new Float64Array(nu * nv), xs = [];
  let last = 0;
  for (let j = 0; j < nv; j++) {
    const y = v0 + j * h;
    xs.length = 0;
    for (let s = 0; s < n; s++) {
      const t = (s + 1) % n, ya = ky[s], yb = ky[t];
      if ((ya > y) !== (yb > y)) xs.push(kx[s] + ((y - ya) * (kx[t] - kx[s])) / (yb - ya));
    }
    xs.sort((p, q) => p - q);
    let xi = 0;
    for (let i = 0; i < nu; i++) {
      const x = u0 + i * h;
      let best = Infinity;
      for (let cc = 0; cc < nc; cc++) {
        const c = cc === 0 ? last : (cc <= last ? cc - 1 : cc);    // the chunk that was nearest for the last point first
        const dc = Math.hypot(x - ccx[c], y - ccy[c]) - ccr[c];
        if (dc > 0 && dc * dc >= best) continue;
        const sEnd = Math.min(n, (c + 1) * CH);
        let improved = false;
        for (let s = c * CH; s < sEnd; s++) {
          const t = (s + 1) % n, ax = kx[s], ay = ky[s], bx = kx[t] - ax, by = ky[t] - ay, px = x - ax, py = y - ay;
          let q = (px * bx + py * by) / (bx * bx + by * by);
          q = q < 0 ? 0 : q > 1 ? 1 : q;
          const dx = px - q * bx, dy = py - q * by, d2 = dx * dx + dy * dy;
          if (d2 < best) { best = d2; improved = true; }
        }
        if (improved) last = c;
      }
      while (xi < xs.length && xs[xi] < x) xi++;
      out[j * nu + i] = xi & 1 ? -Math.sqrt(best) : Math.sqrt(best);
    }
  }
  return out;
}

function distToPoly(kx, ky, x, y) {
  let best = Infinity;
  for (let s = 0, n = kx.length; s < n; s++) {
    const t = (s + 1) % n, ax = kx[s], ay = ky[s], bx = kx[t] - ax, by = ky[t] - ay, px = x - ax, py = y - ay;
    let q = (px * bx + py * by) / (bx * bx + by * by);
    q = q < 0 ? 0 : q > 1 ? 1 : q;
    const d2 = (px - q * bx) ** 2 + (py - q * by) ** 2;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

/** 4-connected components of the grid points with on[i] != 0: labels 1.., 0 elsewhere. Returns the count. */
function label(on, nu, nv, lab) {
  let count = 0;
  const stack = [];
  for (let s = 0; s < nu * nv; s++) {
    if (!on[s] || lab[s]) continue;
    count++; lab[s] = count; stack.push(s);
    while (stack.length) {
      const q = stack.pop(), i = q % nu, j = (q - i) / nu;
      if (i > 0 && on[q - 1] && !lab[q - 1]) { lab[q - 1] = count; stack.push(q - 1); }
      if (i < nu - 1 && on[q + 1] && !lab[q + 1]) { lab[q + 1] = count; stack.push(q + 1); }
      if (j > 0 && on[q - nu] && !lab[q - nu]) { lab[q - nu] = count; stack.push(q - nu); }
      if (j < nv - 1 && on[q + nu] && !lab[q + nu]) { lab[q + nu] = count; stack.push(q + nu); }
    }
  }
  return count;
}

/** The closed lines phi = 0 of a grid function (negative on the grid's rim): [{ pts: [u, v, ...] (grid units), hole }]. */
function contours(phi, nu, nv) {
  const nE = 2 * nu * nv, na = new Int32Array(nE).fill(-1), nb = new Int32Array(nE).fill(-1);
  const link = (p, q) => { if (na[p] < 0) na[p] = q; else nb[p] = q; if (na[q] < 0) na[q] = p; else nb[q] = p; };
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
    const s = j * nu + i, f0 = phi[s], f1 = phi[s + 1], f2 = phi[s + nu + 1], f3 = phi[s + nu];
    const k = (f0 > 0 ? 1 : 0) | (f1 > 0 ? 2 : 0) | (f2 > 0 ? 4 : 0) | (f3 > 0 ? 8 : 0);
    if (k === 0 || k === 15) continue;
    const e0 = 2 * s, e1 = 2 * (s + 1) + 1, e2 = 2 * (s + nu), e3 = 2 * s + 1;   // bottom, right, top, left
    switch (k) {
      case 1: case 14: link(e3, e0); break;
      case 2: case 13: link(e0, e1); break;
      case 3: case 12: link(e3, e1); break;
      case 4: case 11: link(e1, e2); break;
      case 6: case 9: link(e0, e2); break;
      case 7: case 8: link(e3, e2); break;
      case 5: if (f0 + f1 + f2 + f3 > 0) { link(e0, e1); link(e2, e3); } else { link(e3, e0); link(e1, e2); } break;
      case 10: if (f0 + f1 + f2 + f3 > 0) { link(e3, e0); link(e1, e2); } else { link(e0, e1); link(e2, e3); } break;
      default: break;
    }
  }
  const seen = new Uint8Array(nE), loops = [];
  for (let start = 0; start < nE; start++) {
    if (na[start] < 0 || seen[start]) continue;
    const pts = [];
    let prev = -1, cur = start, guard = 0;
    while (cur >= 0 && !seen[cur] && guard++ < nE) {
      seen[cur] = 1;
      const s = cur >> 1, i = s % nu, j = (s - i) / nu;
      if (cur & 1) { const fa = phi[s], fb = phi[s + nu]; pts.push(i, j + fa / (fa - fb)); } else { const fa = phi[s], fb = phi[s + 1]; pts.push(i + fa / (fa - fb), j); }
      const nxt = na[cur] !== prev ? na[cur] : nb[cur];
      prev = cur; cur = nxt;
    }
    if (pts.length < 6) continue;
    // a hole has the light side inside: test the grid point at the positive end of the first crossing
    const s = start >> 1, i = s % nu, j = (s - i) / nu;
    const pos = phi[s] > 0 ? [i, j] : (start & 1 ? [i, j + 1] : [i + 1, j]);
    let inn = false;
    for (let a = 0, n = pts.length / 2, b = n - 1; a < n; b = a++) {
      const ya = pts[2 * a + 1], yb = pts[2 * b + 1];
      if ((ya > pos[1]) !== (yb > pos[1]) && pos[0] < pts[2 * a] + ((pos[1] - ya) * (pts[2 * b] - pts[2 * a])) / (yb - ya)) inn = !inn;
    }
    loops.push({ pts, hole: !inn });
  }
  return loops;
}

/** Fewer points on a closed line: each chord at most maxSeg long (a straight run: any length), the dropped points within eps of it. */
function simplify(pts, eps, maxSeg) {
  const n = pts.length / 2;
  if (n < 8) return pts;
  // start at the sharpest turn, so a corner stays a corner
  let s0 = 0, worst = -1;
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    const ux = pts[2 * i] - pts[2 * a], uy = pts[2 * i + 1] - pts[2 * a + 1], vx = pts[2 * b] - pts[2 * i], vy = pts[2 * b + 1] - pts[2 * i + 1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    if (lu < 1e-12 || lv < 1e-12) continue;
    const turn = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)) * Math.min(lu, lv);
    if (turn > worst) { worst = turn; s0 = i; }
  }
  const X = (k) => pts[2 * ((s0 + k) % n)], Y = (k) => pts[2 * ((s0 + k) % n) + 1];
  const out = [];
  let a = 0;
  while (a < n) {
    out.push(X(a), Y(a));
    let b = a + 1;
    while (b < n) {
      const c = b + 1, ax = X(a), ay = Y(a), dx = X(c) - ax, dy = Y(c) - ay, l = Math.hypot(dx, dy);
      const tol = l > maxSeg ? eps / 12 : eps;                      // beyond maxSeg only a straight run goes on
      let ok = l > 1e-12;
      for (let k = a + 1; ok && k < c; k++) {
        const px = X(k) - ax, py = Y(k) - ay, t = (px * dx + py * dy) / (l * l);
        if (t < 0 || t > 1 || Math.abs(px * dy - py * dx) > tol * l) ok = false;
      }
      if (!ok) break;
      b = c;
    }
    a = b;
  }
  return out;
}

// ---- the design ----------------------------------------------------------------------------------------------------

export function find(group, knobs) {
  const K = knobs ? { ...KNOBS, ...knobs } : KNOBS, size = Math.sqrt(group.domainArea);
  const T = seatOf(group);
  const M = metricOf(group, T, K), { A, Ai } = M, lam = Math.sqrt(M.ku);
  const toDesign = ([x, y]) => [A[0] * x + A[1] * y, A[2] * x + A[3] * y];
  const Ta = T.map(toDesign);
  const alphas = [];
  const e1d = toDesign(group.e1), e2d = toDesign(group.e2);
  if (M.ku > 1.08) {                                               // a stretched plane: the comma lies along the long axis,
    let [vx, vy] = M.axis;                                         // first with its tail toward e1 (or e2): so a turned group gets the turned comma
    const d1 = vx * e1d[0] + vy * e1d[1], d2 = vx * e2d[0] + vy * e2d[1];
    if ((Math.abs(d1) > 1e-6 * Math.hypot(e1d[0], e1d[1]) ? d1 : d2) < 0) { vx = -vx; vy = -vy; }
    const a0 = Math.atan2(-vx, vy);
    alphas.push(a0, a0 + Math.PI);
  } else {
    const a0 = Math.atan2(e1d[1], e1d[0]);
    for (let k = 0; k < 72; k++) alphas.push(a0 + (k * Math.PI) / 36);
  }
  // the seat: the tile ...
  let seat = Ta, mode = 'tile';
  let fit = fitComma(sides(Ta, 0), Ta, M, size, alphas, K);
  // ... a thin strip: without the ring along the long side the comma turns its back to ...
  if (fit && M.ku > 1.08 && (1.5 * fit.r) / lam < K.WIDE * size) {
    const long = (nx, ny) => (Math.hypot(A[0] * nx + A[2] * ny, A[1] * nx + A[3] * ny) > 1.2 ? 3 : 0);
    const f2 = fitComma(sides(Ta, long), Ta, M, size, alphas, K);
    if (f2) { fit = f2; mode = 'strip'; }
  }
  // ... or the roomiest place of the tile, when that is clearly better (a tile with thin corners)
  if (group.presets && group.presets.length) {
    const D = roomiest(group, T, A, Ai, (0.3 * K.MOAT + K.NECK + K.CHANNEL / 2) * size, K.INSIDE * size);
    if (D) {
      const f2 = fitComma(sides(D, 0).concat(sides(Ta, 2)), D, M, size, alphas, K);
      if (f2 && (!fit || f2.score > K.ROOMY * fit.score)) { fit = f2; seat = D; mode = 'roomiest'; }
    }
  }
  if (!fit) throw new Error('ripple: no room for a comma in the tile of ' + group.id);
  const { r, sigma, alpha, p } = fit;
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  // local frame of the comma: (u, v) -> design plane p + R (u, v) -> paper A^-1 (...)
  const L2D = [ca, -sa, sa, ca, p[0], p[1]];
  const L2W = mul([Ai[0], Ai[1], Ai[2], Ai[3], 0, 0], L2D), W2L = inv(L2W);
  const B = [A[0] * ca + A[1] * sa, -A[0] * sa + A[1] * ca, A[2] * ca + A[3] * sa, -A[2] * sa + A[3] * ca];   // A R: a local gradient -> the paper's
  const Bi = [L2W[0], L2W[1], L2W[2], L2W[3]];                                                               // A^-1 R: a local step -> the paper's

  // the comma, finely
  const seg = 0.6 * K.SEG * size;
  const U = comma({ head: K.HEAD, nBack: Math.max(24, Math.ceil((Math.PI * r * (1 + sigma)) / 2 / seg)), nHollow: Math.max(14, Math.ceil((Math.PI * r * (1 - K.HEAD) * (1 + sigma)) / 2 / seg)), nHead: Math.max(14, Math.ceil((Math.PI * r * K.HEAD * (1 + sigma)) / 2 / seg)) });
  const nK = U.length, kx = new Float64Array(nK), ky = new Float64Array(nK);
  let Rk = 0;
  for (let i = 0; i < nK; i++) { kx[i] = r * U[i][0]; ky[i] = r * sigma * U[i][1]; Rk = Math.max(Rk, Math.hypot(kx[i], ky[i])); }

  // how deep the cell can be: no point of the plane is farther from its nearest comma than a corner of the seat is
  let depth = (1 - K.HEAD) * r * sigma;
  for (const q of seat) { const u = ca * (q[0] - p[0]) + sa * (q[1] - p[1]), v = -sa * (q[0] - p[0]) + ca * (q[1] - p[1]); depth = Math.max(depth, distToPoly(kx, ky, u, v)); }
  depth *= 1.04;
  const c = K.CHANNEL * size, rho = K.THIN * size;
  let h = K.STEP * size;
  { const pad0 = depth + 2 * lam * (c / 2 + rho + 4 * h) + 3 * h, w = (1 + K.HEAD) * r + 2 * pad0, t = 2 * r * sigma + 2 * pad0; if ((w / h) * (t / h) > K.CELLS) h = Math.sqrt((w * t) / K.CELLS); }
  const ZONE = rho + 4 * h;                                        // how far inside a border the distance to it is kept
  const TH = 2 * lam * (c / 2 + ZONE);                             // beyond this difference of distances a border is farther
  const pad = depth + TH + 3 * h;
  const bu0 = -K.HEAD * r - pad, bu1 = r + pad, bv0 = -r * sigma - pad, bv1 = r * sigma + pad;
  const nu = Math.ceil((bu1 - bu0) / h) + 1, nv = Math.ceil((bv1 - bv0) / h) + 1, NN = nu * nv;
  const d1 = sdfGrid(kx, ky, bu0, bv0, h, nu, nv);
  const gU = new Float64Array(NN), gV = new Float64Array(NN);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const s = j * nu + i, il = i > 0 ? s - 1 : s, ir = i < nu - 1 ? s + 1 : s, jl = j > 0 ? s - nu : s, jr = j < nv - 1 ? s + nu : s;
    gU[s] = (d1[ir] - d1[il]) / ((ir - il) * h); gV[s] = (d1[jr] - d1[jl]) / (((jr - jl) / nu) * h);
  }

  // the neighbours: every other copy of the comma that can come within 2 * depth of it
  const cw = [L2W[4], L2W[5]];
  const reach = 2 * (Rk + pad);
  const els = elementsNear(group, cw[0], cw[1], (reach + 2 * Rk) * lam * 1.02, cw[0], cw[1]);
  const mn = new Float64Array(NN).fill(BIG), t1 = new Float64Array(NN).fill(ZONE);
  const live = new Uint8Array(NN);
  for (let s = 0; s < NN; s++) live[s] = d1[s] <= depth + TH ? 1 : 0;
  const inU = 0.45 * r, inV = -0.1 * r * sigma;                    // a point inside the comma
  let neighbours = 0, mirrors = 0;
  for (const g of els) {
    const gl = mul(W2L, mul([g.a, g.b, g.c, g.d, g.tx, g.ty], L2W));
    const dt = gl[0] * gl[3] - gl[1] * gl[2];
    if (dt > 0 && Math.abs(gl[0] - 1) < 1e-9 && Math.abs(gl[1]) < 1e-9 && Math.hypot(gl[4], gl[5]) < 1e-9 * size) continue;   // the identity
    if (Math.hypot(gl[4], gl[5]) > reach + 2 * Rk) continue;
    if (dt < 0) {
      const th = Math.atan2(gl[2], gl[0]) / 2, ax = Math.cos(th), ay = Math.sin(th), par = gl[4] * ax + gl[5] * ay;
      if (Math.abs(par) < 1e-7 * size) {                             // a mirror: the border is its line, exactly
        let nxl = -ay, nyl = ax, c0 = (nxl * (gl[4] - par * ax) + nyl * (gl[5] - par * ay)) / 2;
        if (nxl * inU + nyl * inV - c0 < 0) { nxl = -nxl; nyl = -nyl; c0 = -c0; }
        const f = Math.hypot(B[0] * nxl + B[1] * nyl, B[2] * nxl + B[3] * nyl);
        mirrors++;
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
          const s = j * nu + i;
          if (!live[s]) continue;
          const dl = nxl * (bu0 + i * h) + nyl * (bv0 + j * h) - c0, t = dl / f - c / 2;
          if (2 * dl < mn[s]) mn[s] = 2 * dl;
          if (t < t1[s]) t1[s] = t;
        }
        continue;
      }
    }
    neighbours++;
    const gi = inv(gl);
    for (let j = 0; j < nv; j++) {
      const y0 = bv0 + j * h;
      let yu = gi[0] * bu0 + gi[1] * y0 + gi[4], yv = gi[2] * bu0 + gi[3] * y0 + gi[5];
      const du = gi[0] * h, dv = gi[2] * h;
      for (let i = 0, s = j * nu; i < nu; i++, s++, yu += du, yv += dv) {
        if (!live[s]) continue;
        const fu = (yu - bu0) / h, fv = (yv - bv0) / h;
        if (!(fu >= 0 && fv >= 0 && fu < nu - 1 && fv < nv - 1)) continue;
        const iu = fu | 0, iv = fv | 0, a = fu - iu, b = fv - iv, q = iv * nu + iu;
        const dg = (1 - b) * ((1 - a) * d1[q] + a * d1[q + 1]) + b * ((1 - a) * d1[q + nu] + a * d1[q + nu + 1]);
        const diff = dg - d1[s];
        if (diff < mn[s]) mn[s] = diff;
        if (diff >= TH) continue;
        const pu = (1 - b) * ((1 - a) * gU[q] + a * gU[q + 1]) + b * ((1 - a) * gU[q + nu] + a * gU[q + nu + 1]);
        const pv = (1 - b) * ((1 - a) * gV[q] + a * gV[q + 1]) + b * ((1 - a) * gV[q + nu] + a * gV[q + nu + 1]);
        const wu = gl[0] * pu + gl[1] * pv - gU[s], wv = gl[2] * pu + gl[3] * pv - gV[s];
        const nrm = Math.max(0.35, Math.hypot(B[0] * wu + B[1] * wv, B[2] * wu + B[3] * wv));
        const t = diff / nrm - c / 2;
        if (t < t1[s]) t1[s] = t;
      }
    }
  }

  // the bands: the moat and the ring are the same all round; beyond the ring each corner of the cell has its own
  const e1 = K.MOAT * r, e2 = e1 + K.RING * size;
  const cell = new Uint8Array(NN), on = new Uint8Array(NN), lab = new Int32Array(NN);
  for (let s = 0; s < NN; s++) { cell[s] = live[s] && mn[s] > 0 ? 1 : 0; on[s] = cell[s] && d1[s] > e2 ? 1 : 0; }
  const nPool = label(on, nu, nv, lab);
  // per corner: nPer = -1: a pool beyond `swell` (the ring's outer edge there); else nPer + 1 dark bands, the last to the tip
  const deep = new Float64Array(nPool + 1), nPer = new Int32Array(nPool + 1).fill(-1), swell = new Float64Array(nPool + 1), corners = [];
  const members = [], mask = new Uint8Array(NN), stack = [];
  for (let q = 0; q <= nPool; q++) members.push([]);
  for (let s = 0; s < NN; s++) if (lab[s]) { members[lab[s]].push(s); if (d1[s] > deep[lab[s]]) deep[lab[s]] = d1[s]; }
  for (let q = 1; q <= nPool; q++) {
    const rem = (deep[q] - e2) / size;
    if (rem > K.POOL + K.SWELL) {
      // as few bands as leave a tip no deeper than TIP; but the tip must be a piece worth drawing: a thin corner
      // (12 cells round a 6-fold mirror corner) takes the band before it into its tip, and if there is none the ring
      // swells into the corner instead
      for (let n = Math.max(0, Math.ceil((rem - K.LIGHT - K.TIP) / (K.LIGHT + K.DARK))); n >= 0; n--) {
        const from = e2 + (n * (K.LIGHT + K.DARK) + K.LIGHT) * size + rho;
        // the cores of the tip's pieces (a corner with several tips has several): the largest must be worth drawing
        for (const s of members[q]) mask[s] = d1[s] >= from && t1[s] >= rho ? 1 : 0;
        let most = 0;
        for (const s0 of members[q]) {
          if (mask[s0] !== 1) continue;
          let cnt = 0;
          mask[s0] = 2; stack.push(s0);
          while (stack.length) {
            const u = stack.pop(), i = u % nu, j = (u - i) / nu;
            cnt++;
            if (i > 0 && mask[u - 1] === 1) { mask[u - 1] = 2; stack.push(u - 1); }
            if (i < nu - 1 && mask[u + 1] === 1) { mask[u + 1] = 2; stack.push(u + 1); }
            if (j > 0 && mask[u - nu] === 1) { mask[u - nu] = 2; stack.push(u - nu); }
            if (j < nv - 1 && mask[u + nu] === 1) { mask[u + nu] = 2; stack.push(u + nu); }
          }
          if (cnt > most) most = cnt;
        }
        for (const s of members[q]) mask[s] = 0;
        if (most * h * h >= K.PETAL * size * size) { nPer[q] = n; break; }
      }
    }
    if (nPer[q] < 0 && rem > K.POOL) swell[q] = (rem - K.POOL) * size;
    if (rem > 0.03 && members[q].length > 8) corners.push({ depth: +(deep[q] / size).toFixed(3), beyond: +rem.toFixed(3), bands: nPer[q] + 1, swell: +(swell[q] / size).toFixed(3) });
  }
  // the ring just below a swollen corner must know of the swell (its outer edge is further out there): carry the
  // corner's label a little way down into the ring
  const under = new Int32Array(NN);
  {
    const floor = e2 - (rho + 4 * h) * lam;
    let front = [];
    for (let q = 1; q <= nPool; q++) if (swell[q] > 0) for (const s of members[q]) front.push(s);
    while (front.length) {
      const next = [];
      for (const s of front) {
        const q = lab[s] || under[s], i = s % nu, j = (s - i) / nu;
        for (const t of [i > 0 ? s - 1 : -1, i < nu - 1 ? s + 1 : -1, j > 0 ? s - nu : -1, j < nv - 1 ? s + nu : -1]) {
          if (t < 0 || lab[t] || under[t] || !cell[t] || d1[t] <= floor) continue;
          under[t] = q; next.push(t);
        }
      }
      front = next;
    }
  }
  const phi = new Float64Array(NN);
  for (let s = 0; s < NN; s++) {
    if (!live[s] || mn[s] <= -TH) { phi[s] = -1; continue; }
    const d = d1[s], q = lab[s];
    let val;
    if (!cell[s]) val = BIG;
    else if (!q) val = Math.min(d - e1, e2 + (under[s] ? swell[under[s]] * Math.min(1, Math.max(0, mn[s] / (4 * ZONE))) : 0) - d);
    else if (nPer[q] < 0) val = e2 + swell[q] * Math.min(1, Math.max(0, mn[s] / (4 * ZONE))) - d;   // the swell fades toward the channels
    else {
      const wl = K.LIGHT * size, wd = K.DARK * size, x = d - e2, k = Math.floor(x / (wl + wd)), y = x - k * (wl + wd);
      if (k >= nPer[q]) { const xt = x - nPer[q] * (wl + wd); val = xt < wl ? -Math.min(xt, wl - xt) : xt - wl; }
      else if (y < wl) val = -Math.min(y, wl - y);
      else val = Math.min(y - wl, wl + wd - y);
    }
    // a width in the design plane, on the paper
    if (val < BIG) val /= Math.max(0.4, Math.hypot(B[0] * gU[s] + B[1] * gV[s], B[2] * gU[s] + B[3] * gV[s]));
    phi[s] = Math.min(val, t1[s]);
  }

  // the opening: a point stays dark when a disc of radius rho, all dark, covers it
  {
    const wr = Math.ceil((rho * lam + 2 * h) / h), offs = [];
    for (let dj = -wr; dj <= wr; dj++) for (let di = -wr; di <= wr; di++) {
      const l = Math.hypot(Bi[0] * di * h + Bi[1] * dj * h, Bi[2] * di * h + Bi[3] * dj * h);
      if (l <= rho + 1.5 * h && (di || dj)) offs.push(di, dj, l);
    }
    const out = new Float64Array(NN);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const s = j * nu + i, f = phi[s];
      if (f <= 0 || f >= rho) { out[s] = f; continue; }
      let u = -h;
      for (let o = 0; o < offs.length; o += 3) {
        const ii = i + offs[o], jj = j + offs[o + 1];
        if (ii < 0 || jj < 0 || ii >= nu || jj >= nv) continue;
        const fy = phi[jj * nu + ii];
        if (fy >= rho && fy - offs[o + 2] > u) u = fy - offs[o + 2];
      }
      out[s] = Math.min(f, u + 0.08 * h);
    }
    phi.set(out);
  }
  for (let i = 0; i < nu; i++) { phi[i] = Math.min(phi[i], -1e-6); phi[(nv - 1) * nu + i] = Math.min(phi[(nv - 1) * nu + i], -1e-6); }
  for (let j = 0; j < nv; j++) { phi[j * nu] = Math.min(phi[j * nu], -1e-6); phi[j * nu + nu - 1] = Math.min(phi[j * nu + nu - 1], -1e-6); }

  const debug = K.DEBUG ? { nu, nv, h, pools: Array.from(lab), d1: Array.from(d1), cell: Array.from(cell), phi: Array.from(phi), nPer: Array.from(nPer), deep: Array.from(deep) } : undefined;
  // leave out the specks
  lab.fill(0);
  for (let s = 0; s < NN; s++) on[s] = phi[s] > 0 ? 1 : 0;
  const nDark = label(on, nu, nv, lab), cnt = new Int32Array(nDark + 1);
  for (let s = 0; s < NN; s++) if (lab[s]) cnt[lab[s]]++;
  let dropped = 0;
  for (let q = 1; q <= nDark; q++) if (cnt[q] * h * h < K.SPECK * size * size) { cnt[q] = -1; dropped++; }
  for (let s = 0; s < NN; s++) if (lab[s] && cnt[lab[s]] < 0) phi[s] = -1e-6;

  // outlines
  const shapes = [];
  const toWorld = (u, v) => [L2W[0] * u + L2W[1] * v + L2W[4], L2W[2] * u + L2W[3] * v + L2W[5]];
  { const pts = []; for (let i = 0; i < nK; i++) pts.push(toWorld(kx[i], ky[i])); shapes.push({ pts, hole: false }); }
  let verts = nK;
  for (const lp of contours(phi, nu, nv)) {
    for (let i = 0; i < lp.pts.length; i += 2) { lp.pts[i] = bu0 + lp.pts[i] * h; lp.pts[i + 1] = bv0 + lp.pts[i + 1] * h; }
    const sp = simplify(lp.pts, K.EPS * size, K.SEG * size / lam);
    if (sp.length < 6) continue;
    const pts = [];
    for (let i = 0; i < sp.length; i += 2) pts.push(toWorld(sp[i], sp[i + 1]));
    verts += pts.length;
    shapes.push({ pts, hole: lp.hole });
  }
  const r3 = (x) => Math.round(1000 * x) / 1000;
  return {
    shapes,
    info: {
      r: r3(r / size), sigma, stretch: r3(M.ku), seat: mode, turn: r3(alpha), moat: r3(e1 / size), ring: r3((e2 - e1) / size), depth: r3(depth / 1.04 / size),
      at: toWorld(0, 0), debug, grid: [nu, nv], step: r3(h / size), neighbours, mirrors, corners, dropped, verts,
    },
  };
}
