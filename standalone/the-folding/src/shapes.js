// shapes.js — the "shape prints": the third kind of print (src/pattern.js has 'linear' and 'rings'). Pure: no DOM, no
// WebGL; its one import is src/sdf.js (bakeShapes). The production form of dev/patterns/kit.js, the kit the designs of
// the round were drawn with.
//
// Why (13 Nov 2026, the owner: "come up with some patterns which are more like a comma but they fill more of the space,
// and they reuse the idea of the checkerboard by giving different tints to the two sides"): the checkerboard covers the
// paper but its marks are small and symmetric, so one cannot follow a part of the tile through the fold; the comma has
// a direction and a hand but leaves most of the surface bare. A shape print is big asymmetric marks that fill the
// surface, printed like the checkerboard (opaque paper, front teal, back sand, two tones each).
//
// The print is the ORBIT of a MOTIF, a few closed polygons, under the group:
//     W(x) = sum over ALL elements g of the group, over the polygons P of the motif:
//                +1 if x is inside g(P) and P is an outer polygon, -1 if P is a hole
//     dark  <=>  W(x) > 0
// so it is the group's by construction, whatever the motif: a pattern of the orbifold, which closes without a break
// across every seam of every cut. ("Inside" a polygon is the crossing rule, as in kit.js.) The rules a motif keeps
// (kit.js's header; validateShapes checks them, makeShapePrint does not):
//   * two copies g(motif), h(motif) either COINCIDE as sets (a motif that sits ON a rotation centre or a mirror and has
//     that symmetry itself) or are DISJOINT, at least GAP_MIN * sqrt(domainArea) apart, outline to outline;
//   * a hole lies inside an outer polygon of the same motif;
//   * a polygon has at least 3 points and does not cross itself; all together at most MAX_VERTS vertices;
// and three that the kit's header leaves unsaid (its measure().overlap counts the first of them):
//   * the polygons of one motif do not cross, touch or lie on each other (an outer polygon in a hole is an island: fine);
//   * a polygon does not touch itself (a pinch, a slit, a spike without width) and has an area.
// Under these rules W is 0 or the order of the motif's stabiliser everywhere, and every outline is a line between dark
// and light, so the three places a print is drawn agree: tone() here, the canvas path of fillShapes (the NONZERO rule),
// and the distance texture that src/sdf.js bakes from copiesIn (an outline INSIDE the dark would show there as a hairline).
//
//   GAP_MIN = 0.02, MAX_VERTS = 2400
//   makeShapePrint(group, { key, name, shapes, info })  -> Print (frozen; throws for a motif that cannot be used)
//   shapeElements(print, box)                           -> [{ a, b, c, d, tx, ty, rep }]: every element g whose copy
//                                                          g(motif) can touch the world box [x0, y0, x1, y1], each once
//   fillShapes(c, print, map, box, fillStyle, tol?)     -> the dark tone over the box as ONE path, c.fill('nonzero');
//                                                          tol > 0: the outline simplified to within tol (the plane)
//   copiesIn(print, box)                                -> [{ pts, hole, box }]: the polygons of those copies, in world
//                                                          coordinates (what src/sdf.js bakeSDF takes)
//   bakeShapes(print, size = BAKE_SIZE)                 -> the print's distance texture for the 3D renderer: a frozen
//                                                          { size, data, range, origin, e1, e2, pitch }; the SAME object
//                                                          every time while it is kept (see bakeShapes)
//   BAKE_SIZE = 1024, BAKE_RANGE = 6, BAKE_KEEP = 6
//   validateShapes(print, { gap })                      -> { ok, problems: [string], gap, stabilizer }
//   printable(print)                                    -> the same, with the gap the 3D texture holds (TEXELS_APART
//                                                          texels): what src/pattern.js printFor asks before it shows a print
//   texelPitch({ e1, e2 }, size = BAKE_SIZE)            -> the side of a texel of a print's texture, from the lattice alone
//   thinParts(print, width)                             -> [{ length, width, at, dark }]: where the motif is thinner than
//                                                          width (a needle, a slit): what the 3D texture cuts short
//   measureShapes(print, { per, center })               -> { coverage, coverageExact, emptyDisc, darkDisc, overlap,
//                                                            verts, stabilizer }
//
// A Print (the same kind of object as the prints of pattern.js):
//   key, kind 'shapes', name, info
//   cell             the size of one mark in world units: sqrt(net area of the motif: outer polygons minus holes)
//   tone(x, y)       0 (light) | 1 (dark):  W > 0
//   winding(x, y)    W
//   margin(x, y)     the distance in world units from the point to the nearest outline of ANY copy of the motif (>= 0)
//   polys            [{ pts: Float64Array [x0, y0, x1, y1, ...], hole, box: [x0, y0, x1, y1], area }]: outer polygons
//                    counter-clockwise, holes clockwise, no repeated point. READ ONLY: tone, winding and margin work
//                    on their own copy.
//   cx, cy, R        the bounding circle of the motif (the smallest one);  verts
//   e1, e2, inv      the lattice, and the rows of [e1 e2]^-1: (x, y) = s e1 + t e2 with s = inv[0] x + inv[1] y,
//                    t = inv[2] x + inv[3] y
//   reps             copies of the group's coset representatives: every element is translate(m e1 + n e2) o reps[k]
//   size             sqrt(domainArea), the unit the rules are stated in;   netArea
// A print keeps nothing else of the group: it works for any { e1, e2, reps } (a group moved about by a test).
//
// Speed. tone() is called hundreds of thousands of times (the tests, measureShapes, the checks of the rasteriser), so
// nothing is allocated per call: for each coset representative r the point is carried back by r^-1 in one affine map
// straight into lattice coordinates (on a REDUCED basis of the lattice), reduced to the cell around the motif's centre,
// and only the few lattice translates whose bounding circle can hold it are looked at; inside a polygon's box the
// crossing test reads the edges of one horizontal slab, not the whole outline. A few million calls a second.

import { bakeSDF } from './sdf.js';

export const GAP_MIN = 0.02;
export const MAX_VERTS = 2400;

/** Two successive points of an outline nearer than this are one point: in world units, and in tile sizes. */
const SAME_POINT = 1e-12, SAME_POINT_SIZES = 1e-9;
/** "Coincide": every vertex of one copy lies within this many tile sizes of the other's outline. */
const COINCIDE = 1e-6;
/** Two outlines nearer than this many tile sizes touch. */
const TOUCH = 1e-9;
/** Edges per bounding box in the distance searches. */
const CHUNK = 8;
/** validateShapes looks at the outlines of a motif of up to this many vertices (the rule is MAX_VERTS). */
const CHECK_VERTS = 40000;

// ---------------------------------------------------------------------------------------------------------------
// Reading a motif
// ---------------------------------------------------------------------------------------------------------------

function signedArea(p) {
  let s = 0;
  for (let i = 0, n = p.length >> 1; i < n; i++) { const j = i + 1 === n ? 0 : i + 1; s += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; }
  return s / 2;
}

/**
 * The polygons of a motif: [{ pts, hole, box, area }], outer polygons counter-clockwise, holes clockwise. `shapes` is a
 * list of { pts, hole? } or of bare point lists; a point list is [[x, y], ...] or flat [x0, y0, x1, y1, ...] (any array,
 * a typed one too: the polylines of src/motif.js). A point that repeats the one before it (also the first point given
 * again as the last) is dropped; what is left with fewer than 3 points is left out.
 */
function readPolygons(shapes, same) {
  if (shapes == null || typeof shapes[Symbol.iterator] !== 'function') throw new Error('makeShapePrint: `shapes` is a list of polygons { pts: [[x, y], ...], hole? }');
  const polys = [];
  let k = -1;
  for (const s of shapes) {
    k++;
    if (s == null) continue;
    const src = s.pts != null ? s.pts : s;
    const len = src.length;
    if (!(len > 0)) continue;
    let flat;
    if (typeof src[0] === 'number') {
      if (len % 2) throw new Error(`makeShapePrint: polygon ${k} has an odd number of coordinates`);
      flat = Float64Array.from(src);
    } else {
      flat = new Float64Array(2 * len);
      for (let i = 0; i < len; i++) { const p = src[i]; flat[2 * i] = p == null ? NaN : +p[0]; flat[2 * i + 1] = p == null ? NaN : +p[1]; }
    }
    for (let i = 0; i < flat.length; i++) if (!Number.isFinite(flat[i])) throw new Error(`makeShapePrint: polygon ${k} has a point that is not a finite number`);
    let n = 0;
    for (let i = 0; i < flat.length; i += 2) {
      const x = flat[i], y = flat[i + 1];
      if (n && Math.hypot(x - flat[2 * n - 2], y - flat[2 * n - 1]) < same) continue;
      flat[2 * n] = x; flat[2 * n + 1] = y; n++;
    }
    while (n > 1 && Math.hypot(flat[0] - flat[2 * n - 2], flat[1] - flat[2 * n - 1]) < same) n--;
    if (n < 3) continue;
    const hole = !!s.hole, pts = new Float64Array(2 * n), A = signedArea(flat.subarray(0, 2 * n));
    const back = (A < 0) !== hole;                                    // outer polygons counter-clockwise, holes clockwise
    for (let i = 0; i < n; i++) { const j = back ? n - 1 - i : i; pts[2 * i] = flat[2 * j]; pts[2 * i + 1] = flat[2 * j + 1]; }
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) {
      const x = pts[2 * i], y = pts[2 * i + 1];
      if (x < box[0]) box[0] = x; if (x > box[2]) box[2] = x; if (y < box[1]) box[1] = y; if (y > box[3]) box[3] = y;
    }
    polys.push({ pts, hole, box, area: Math.abs(A) });
  }
  if (!polys.length) throw new Error('makeShapePrint: the motif has no polygon with three or more points');
  return polys;
}

/** What a print keeps of a group: { e1, e2, inv, reps, cellArea }. Throws when there is no lattice. */
function readGroup(group) {
  const ok = (v) => v != null && Number.isFinite(+v[0]) && Number.isFinite(+v[1]);
  if (!group || !ok(group.e1) || !ok(group.e2)) throw new Error('makeShapePrint: the group has no lattice (e1, e2)');
  const e1 = [+group.e1[0], +group.e1[1]], e2 = [+group.e2[0], +group.e2[1]], d = e1[0] * e2[1] - e1[1] * e2[0];
  if (!(Math.abs(d) > 1e-12 * Math.hypot(e1[0], e1[1]) * Math.hypot(e2[0], e2[1]))) throw new Error('makeShapePrint: e1 and e2 of the group lie on one line');
  if (!group.reps || !(group.reps.length > 0)) throw new Error('makeShapePrint: the group has no coset representatives (reps)');
  const reps = [];
  for (const r of group.reps) {
    const q = { a: +r.a, b: +r.b, c: +r.c, d: +r.d, tx: +r.tx, ty: +r.ty };
    if (!Number.isFinite(q.a + q.b + q.c + q.d + q.tx + q.ty) || !(Math.abs(q.a * q.d - q.b * q.c) > 1e-9)) throw new Error('makeShapePrint: a coset representative of the group is no isometry');
    reps.push(Object.freeze(q));
  }
  return { e1, e2, inv: [e2[1] / d, -e2[0] / d, -e1[1] / d, e1[0] / d], reps, cellArea: Math.abs(d) };
}

/** Gauss reduction: [ux, uy, vx, vy], a basis of the lattice of e1 and e2 with |u| <= |v| and |u.v| <= |u|^2 / 2. */
function reducedBasis(e1, e2) {
  let ux = e1[0], uy = e1[1], vx = e2[0], vy = e2[1];
  for (let it = 0; it < 200; it++) {
    if (ux * ux + uy * uy > vx * vx + vy * vy) { let t = ux; ux = vx; vx = t; t = uy; uy = vy; vy = t; }
    const m = Math.round((ux * vx + uy * vy) / (ux * ux + uy * uy));
    if (!m) break;
    vx -= m * ux; vy -= m * uy;
  }
  return [ux, uy, vx, vy];
}

/**
 * The smallest circle that holds every vertex: [cx, cy, R] (Welzl's incremental construction on a fixed shuffle;
 * R is then measured, so the circle holds the motif whatever the rounding did). A symmetry of the motif fixes its centre.
 */
function enclosingCircle(polys) {
  let n = 0;
  for (const P of polys) n += P.pts.length >> 1;
  const X = new Float64Array(n), Y = new Float64Array(n);
  let m = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const P of polys) for (let i = 0; i < P.pts.length; i += 2) {
    const x = P.pts[i], y = P.pts[i + 1];
    X[m] = x; Y[m] = y; m++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  let seed = 0x2545F491;
  for (let i = n - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((seed / 4294967296) * (i + 1));
    let t = X[i]; X[i] = X[j]; X[j] = t; t = Y[i]; Y[i] = Y[j]; Y[j] = t;
  }
  const eps2 = (1e-13 * Math.hypot(x1 - x0, y1 - y0)) ** 2;
  let cx = X[0], cy = Y[0], r2 = 0;
  const out = (i) => { const dx = X[i] - cx, dy = Y[i] - cy; return dx * dx + dy * dy > r2 * (1 + 1e-12) + eps2; };
  const two = (i, j) => { cx = (X[i] + X[j]) / 2; cy = (Y[i] + Y[j]) / 2; r2 = ((X[i] - X[j]) ** 2 + (Y[i] - Y[j]) ** 2) / 4; };
  for (let i = 1; i < n; i++) {
    if (!out(i)) continue;
    cx = X[i]; cy = Y[i]; r2 = 0;
    for (let j = 0; j < i; j++) {
      if (!out(j)) continue;
      two(i, j);
      for (let k = 0; k < j; k++) {
        if (!out(k)) continue;
        const bx = X[j] - X[i], by = Y[j] - Y[i], gx = X[k] - X[i], gy = Y[k] - Y[i], d = 2 * (bx * gy - by * gx);
        const b2 = bx * bx + by * by, g2 = gx * gx + gy * gy;
        if (Math.abs(d) > 1e-14 * (b2 + g2)) {
          const ux = (gy * b2 - by * g2) / d, uy = (bx * g2 - gx * b2) / d;
          cx = X[i] + ux; cy = Y[i] + uy; r2 = ux * ux + uy * uy;
        } else {                                                     // three points on a line: the two farthest apart
          const jk = (X[j] - X[k]) ** 2 + (Y[j] - Y[k]) ** 2;
          if (b2 >= g2 && b2 >= jk) two(i, j); else if (g2 >= jk) two(i, k); else two(j, k);
        }
      }
    }
  }
  const reach = (px, py) => { let r = 0; for (let i = 0; i < n; i++) { const d = Math.hypot(X[i] - px, Y[i] - py); if (d > r) r = d; } return r; };
  // never worse than the circle round the middle of the box (kit.js's), whatever rounding did to the construction
  const bx = (x0 + x1) / 2, by = (y0 + y1) / 2, Rb = reach(bx, by), R = Number.isFinite(cx + cy) ? reach(cx, cy) : Infinity;
  return R <= Rb ? [cx, cy, R] : [bx, by, Rb];
}

// ---------------------------------------------------------------------------------------------------------------
// Outlines: closed coordinate lists with the boxes of their chunks (distance searches) and their slabs (inside tests)
// ---------------------------------------------------------------------------------------------------------------

/**
 * An outline for the distance searches: X, Y of n + 1 points (the first one again at the end), moved by (-ox, -oy);
 * its box; and the boxes cb of its chunks of CHUNK successive edges (edge i runs from point i to point i + 1).
 */
function outlineOf(pts, ox = 0, oy = 0) {
  const n = pts.length >> 1, X = new Float64Array(n + 1), Y = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { X[i] = pts[2 * i] - ox; Y[i] = pts[2 * i + 1] - oy; }
  X[n] = X[0]; Y[n] = Y[0];
  return boxed({ n, X, Y, x0: 0, y0: 0, x1: 0, y1: 0, nc: Math.ceil(n / CHUNK), cb: new Float64Array(4 * Math.ceil(n / CHUNK)) });
}
function boxed(O) {
  const { n, X, Y, cb } = O;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let c = 0; c < O.nc; c++) {
    let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
    const end = Math.min(n, (c + 1) * CHUNK);
    for (let i = c * CHUNK; i <= end; i++) {
      const x = X[i], y = Y[i];
      if (x < a0) a0 = x; if (x > a1) a1 = x; if (y < b0) b0 = y; if (y > b1) b1 = y;
    }
    cb[4 * c] = a0; cb[4 * c + 1] = b0; cb[4 * c + 2] = a1; cb[4 * c + 3] = b1;
    if (a0 < x0) x0 = a0; if (a1 > x1) x1 = a1; if (b0 < y0) y0 = b0; if (b1 > y1) y1 = b1;
  }
  O.x0 = x0; O.y0 = y0; O.x1 = x1; O.y1 = y1;
  return O;
}
/** The outline O carried by the isometry g: a new outline (a mirror turns the way its points run; distances do not mind). */
function carried(O, g) {
  const n = O.n, X = new Float64Array(n + 1), Y = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) { X[i] = g.a * O.X[i] + g.b * O.Y[i] + g.tx; Y[i] = g.c * O.X[i] + g.d * O.Y[i] + g.ty; }
  return boxed({ n, X, Y, x0: 0, y0: 0, x1: 0, y1: 0, nc: O.nc, cb: new Float64Array(4 * O.nc) });
}

/**
 * The slabs of an outline, for the crossing test: the box's height cut into S horizontal slabs, and for each slab the
 * edges that reach into it, as [ya, yb, xa, (xb - xa) / (yb - ya)] in D (start[s] .. start[s + 1]). A point's slab
 * holds every edge whose height range holds the point's height: the slab of a height is a monotone function of it.
 * About two edges per slab for a round shape. A comb, whose every edge runs the whole height, gets few slabs instead of
 * a table of n^2 entries (it is then as slow as counting every edge, and as right).
 */
function slabsOf(O) {
  const { n, X, Y } = O, y0 = O.y0, h = O.y1 - y0;
  let rise = 0;                                                       // the heights of all edges, in box heights: 2 for a convex shape
  for (let i = 0; i < n; i++) rise += Math.abs(Y[i + 1] - Y[i]);
  const S = h > 0 ? Math.max(1, Math.min(2048, n >> 1, Math.floor((6 * n * h) / rise))) : 1, invH = h > 0 ? S / h : 0;
  const slab = (y) => { const s = ((y - y0) * invH) | 0; return s < 0 ? 0 : s >= S ? S - 1 : s; };
  const start = new Int32Array(S + 1);
  for (let i = 0; i < n; i++) {
    if (Y[i] === Y[i + 1]) continue;
    const a = slab(Math.min(Y[i], Y[i + 1])), b = slab(Math.max(Y[i], Y[i + 1]));
    for (let s = a; s <= b; s++) start[s + 1]++;
  }
  for (let s = 0; s < S; s++) start[s + 1] += start[s];
  const D = new Float64Array(4 * start[S]), fill = start.slice(0, S);
  for (let i = 0; i < n; i++) {
    if (Y[i] === Y[i + 1]) continue;
    const a = slab(Math.min(Y[i], Y[i + 1])), b = slab(Math.max(Y[i], Y[i + 1])), k = (X[i + 1] - X[i]) / (Y[i + 1] - Y[i]);
    for (let s = a; s <= b; s++) { const e = 4 * fill[s]++; D[e] = Y[i]; D[e + 1] = Y[i + 1]; D[e + 2] = X[i]; D[e + 3] = k; }
  }
  return { S, invH, start, D };
}

/** The squared distance from the point to the outline O where it is under best2, else best2. */
function outlineDist2(O, x, y, best2) {
  let dx = x < O.x0 ? O.x0 - x : x > O.x1 ? x - O.x1 : 0, dy = y < O.y0 ? O.y0 - y : y > O.y1 ? y - O.y1 : 0;
  if (dx * dx + dy * dy >= best2) return best2;
  const { cb, X, Y, n, nc } = O;
  for (let c = 0, b = 0; c < nc; c++, b += 4) {
    dx = x < cb[b] ? cb[b] - x : x > cb[b + 2] ? x - cb[b + 2] : 0;
    dy = y < cb[b + 1] ? cb[b + 1] - y : y > cb[b + 3] ? y - cb[b + 3] : 0;
    if (dx * dx + dy * dy >= best2) continue;
    const end = c * CHUNK + CHUNK < n ? c * CHUNK + CHUNK : n;
    for (let i = c * CHUNK; i < end; i++) {
      const ax = X[i], ay = Y[i], ex = X[i + 1] - ax, ey = Y[i + 1] - ay, l2 = ex * ex + ey * ey;
      let t = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const qx = x - ax - t * ex, qy = y - ay - t * ey, d2 = qx * qx + qy * qy;
      if (d2 < best2) best2 = d2;
    }
  }
  return best2;
}

function pointSeg2(x, y, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  let t = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const qx = x - ax - t * ex, qy = y - ay - t * ey;
  return qx * qx + qy * qy;
}
/** Do the open segments ab and cd cross at one point inside both? */
function properCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
/** The squared distance between the segments ab and cd (0 when they cross). */
function segSeg2(ax, ay, bx, by, cx, cy, dx, dy) {
  if (properCross(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(pointSeg2(ax, ay, cx, cy, dx, dy), pointSeg2(bx, by, cx, cy, dx, dy), pointSeg2(cx, cy, ax, ay, bx, by), pointSeg2(dx, dy, ax, ay, bx, by));
}
/** The squared distance between the boxes p[i .. i + 3] and q[j .. j + 3] ([x0, y0, x1, y1]; 0 when they meet). */
function boxBox2(p, i, q, j) {
  const dx = p[i] > q[j + 2] ? p[i] - q[j + 2] : q[j] > p[i + 2] ? q[j] - p[i + 2] : 0;
  const dy = p[i + 1] > q[j + 3] ? p[i + 1] - q[j + 3] : q[j + 1] > p[i + 3] ? q[j + 1] - p[i + 3] : 0;
  return dx * dx + dy * dy;
}

/**
 * The squared distance between the outlines A and B where it is under limit2, else limit2. `hit`, when given, gets the
 * two nearest edges: hit.seg = [ax, ay, bx, by, cx, cy, dx, dy].
 */
function pairDist2(A, B, limit2, hit) {
  const whole = (O) => [O.x0, O.y0, O.x1, O.y1], wa = whole(A), wb = whole(B);
  if (boxBox2(wa, 0, wb, 0) >= limit2) return limit2;
  // the chunks of each that reach the other's box at all, the nearest first: the first pair then sets a bound that
  // rules out nearly all the others
  const near = (O, w) => {
    const list = [];
    for (let c = 0; c < O.nc; c++) { const d = boxBox2(O.cb, 4 * c, w, 0); if (d < limit2) list.push([d, c]); }
    return list.sort((p, q) => p[0] - q[0]);
  };
  const la = near(A, wb), lb = near(B, wa);
  let best2 = limit2;
  for (const [da, ca] of la) {
    if (da >= best2) break;
    const ea = Math.min(A.n, (ca + 1) * CHUNK);
    // this chunk's partners, nearest first
    const part = [];
    for (const [db, cb] of lb) { if (db >= best2) break; const d = boxBox2(A.cb, 4 * ca, B.cb, 4 * cb); if (d < best2) part.push([d, cb]); }
    part.sort((p, q) => p[0] - q[0]);
    for (const [d, cb] of part) {
      if (d >= best2) break;
      const eb = Math.min(B.n, (cb + 1) * CHUNK);
      for (let i = ca * CHUNK; i < ea; i++) for (let j = cb * CHUNK; j < eb; j++) {
        const d2 = segSeg2(A.X[i], A.Y[i], A.X[i + 1], A.Y[i + 1], B.X[j], B.Y[j], B.X[j + 1], B.Y[j + 1]);
        if (d2 < best2) { best2 = d2; if (hit) hit.seg = [A.X[i], A.Y[i], A.X[i + 1], A.Y[i + 1], B.X[j], B.Y[j], B.X[j + 1], B.Y[j + 1]]; }
      }
    }
  }
  return best2;
}
/**
 * Where the two segments [ax, ay, bx, by, cx, cy, dx, dy] of pairDist2's hit.seg are nearest each other (for a message):
 * the point where they cross, else the middle between an end of one and its foot on the other.
 */
function nearestPoint(s) {
  const [ax, ay, bx, by, cx, cy, dx, dy] = s;
  if (properCross(ax, ay, bx, by, cx, cy, dx, dy)) {
    const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx), t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
    return [ax + t * (bx - ax), ay + t * (by - ay)];
  }
  let best = [ax, ay], b2 = Infinity;
  for (const [x, y, px, py, qx, qy] of [[ax, ay, cx, cy, dx, dy], [bx, by, cx, cy, dx, dy], [cx, cy, ax, ay, bx, by], [dx, dy, ax, ay, bx, by]]) {
    const ex = qx - px, ey = qy - py, l2 = ex * ex + ey * ey, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - px) * ex + (y - py) * ey) / l2)) : 0;
    const fx = px + t * ex, fy = py + t * ey, d2 = (x - fx) ** 2 + (y - fy) ** 2;
    if (d2 < b2) { b2 = d2; best = [(x + fx) / 2, (y + fy) / 2]; }
  }
  return best;
}

/** Crossing rule: is the point inside the polygon whose flat point list is p? (Used where speed does not matter.) */
function insideFlat(p, x, y) {
  let inn = false;
  for (let i = 0, n = p.length >> 1, j = n - 1; i < n; j = i++) {
    const yi = p[2 * i + 1], yj = p[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < p[2 * i] + ((y - yi) * (p[2 * j] - p[2 * i])) / (yj - yi)) inn = !inn;
  }
  return inn;
}

// ---------------------------------------------------------------------------------------------------------------
// The print
// ---------------------------------------------------------------------------------------------------------------

/** The lattice vectors w = i u + j v, none longer than `bound`, that `keep(x, y)` keeps: [[x, y, |w|], ...], shortest first. */
function latticeWithin(ux, uy, vx, vy, bound, keep) {
  const D = Math.abs(ux * vy - uy * vx), I = Math.ceil((bound * Math.hypot(vx, vy)) / D) + 1, J = Math.ceil((bound * Math.hypot(ux, uy)) / D) + 1;
  if (!((2 * I + 1) * (2 * J + 1) <= 400000)) throw new Error('makeShapePrint: the motif is hundreds of lattice cells across');
  const list = [];
  for (let i = -I; i <= I; i++) for (let j = -J; j <= J; j++) {
    const x = i * ux + j * vx, y = i * uy + j * vy;
    if (keep(x, y)) list.push([x, y, Math.hypot(x, y)]);
  }
  list.sort((p, q) => p[2] - q[2]);
  return list;
}

/**
 * tone, winding and margin of the orbit of the polygons under { e1, e2, reps }, on a private copy of the points
 * (relative to the centre of the bounding circle).
 */
function compile(polys, cx, cy, R, e1, e2, reps) {
  const [ux, uy, vx, vy] = reducedBasis(e1, e2), D = ux * vy - uy * vx, nr = reps.length;
  // per representative r: the point x -> q = r^-1(x) - centre, straight in lattice coordinates on (u, v):
  //   s = A[0] x + A[1] y + A[2],  t = A[3] x + A[4] y + A[5]      (q = s u + t v)
  // g = translate(w) o r covers x  <=>  r^-1(x) - (a lattice vector) is in the motif: the lattice is the point group's.
  const A = new Float64Array(6 * nr);
  for (let k = 0; k < nr; k++) {
    const r = reps[k], dr = r.a * r.d - r.b * r.c;
    const ia = r.d / dr, ib = -r.b / dr, ic = -r.c / dr, id = r.a / dr;                    // the inverse of the linear part
    const ox = -(ia * r.tx + ib * r.ty) - cx, oy = -(ic * r.tx + id * r.ty) - cy;
    A[6 * k] = (ia * vy - ic * vx) / D; A[6 * k + 1] = (ib * vy - id * vx) / D; A[6 * k + 2] = (ox * vy - oy * vx) / D;
    A[6 * k + 3] = (ux * ic - uy * ia) / D; A[6 * k + 4] = (ux * id - uy * ib) / D; A[6 * k + 5] = (ux * oy - uy * ox) / D;
  }
  // q is reduced to the cell C = { s u + t v : |s|, |t| <= 1/2 }; a translate q - w can lie in the bounding circle only
  // for the lattice vectors w within R of C
  const hx = (Math.abs(ux) + Math.abs(vx)) / 2, hy = (Math.abs(uy) + Math.abs(vy)) / 2;
  const rho = Math.max(Math.hypot(ux + vx, uy + vy), Math.hypot(ux - vx, uy - vy)) / 2;       // the cell's corners are this far out
  const corner = [[ux + vx, uy + vy], [vx - ux, vy - uy], [-ux - vx, -uy - vy], [ux - vx, uy - vy]].map((p) => [p[0] / 2, p[1] / 2]);
  const toCell = (x, y) => {
    const s = (x * vy - y * vx) / D, t = (ux * y - uy * x) / D;
    if (Math.abs(s) <= 0.5 && Math.abs(t) <= 0.5) return 0;
    let d2 = Infinity;
    for (let i = 0; i < 4; i++) { const p = corner[i], q = corner[(i + 1) % 4]; d2 = Math.min(d2, pointSeg2(x, y, p[0], p[1], q[0], q[1])); }
    return Math.sqrt(d2);
  };
  const slack = 1e-9 * (R + rho);
  const tl = latticeWithin(ux, uy, vx, vy, R + rho + slack, (x, y) => Math.abs(x) <= hx + R + slack && Math.abs(y) <= hy + R + slack && toCell(x, y) <= R + slack);
  const noff = 2 * tl.length, offs = new Float64Array(noff);
  tl.forEach((w, i) => { offs[2 * i] = w[0]; offs[2 * i + 1] = w[1]; });
  // margin: the copy of q itself is no farther than rho + R, so only the lattice vectors up to 2 rho + 2 R can be nearer
  const ml = latticeWithin(ux, uy, vx, vy, 2 * rho + 2 * R + slack, (x, y) => Math.hypot(x, y) <= 2 * rho + 2 * R + slack);
  const nm = ml.length, moff = new Float64Array(2 * nm), mlen = new Float64Array(nm);
  ml.forEach((w, i) => { moff[2 * i] = w[0]; moff[2 * i + 1] = w[1]; mlen[i] = w[2]; });

  const np = polys.length, outs = polys.map((P) => outlineOf(P.pts, cx, cy));
  const Q = outs.map((O, i) => { const s = slabsOf(O); return { x0: O.x0, y0: O.y0, x1: O.x1, y1: O.y1, S: s.S, invH: s.invH, start: s.start, D: s.D, sign: polys[i].hole ? -1 : 1 }; });
  const R2 = R * R * (1 + 1e-9);

  function winding(x, y) {
    let W = 0;
    for (let k = 0, b = 0; k < nr; k++, b += 6) {
      const s = A[b] * x + A[b + 1] * y + A[b + 2], t = A[b + 3] * x + A[b + 4] * y + A[b + 5];
      const fs = s - Math.round(s), ft = t - Math.round(t);
      const qx = fs * ux + ft * vx, qy = fs * uy + ft * vy;
      for (let o = 0; o < noff; o += 2) {
        const px = qx - offs[o], py = qy - offs[o + 1];
        if (px * px + py * py > R2) continue;
        for (let i = 0; i < np; i++) {
          const P = Q[i];
          if (px < P.x0 || px > P.x1 || py < P.y0 || py > P.y1) continue;
          let sl = ((py - P.y0) * P.invH) | 0;
          if (sl >= P.S) sl = P.S - 1;
          const Dd = P.D, end = 4 * P.start[sl + 1];
          let inn = 0;
          for (let e = 4 * P.start[sl]; e < end; e += 4) {
            const ya = Dd[e];
            if ((ya > py) !== (Dd[e + 1] > py) && px < Dd[e + 2] + (py - ya) * Dd[e + 3]) inn ^= 1;
          }
          if (inn) W += P.sign;
        }
      }
    }
    return W;
  }

  function margin(x, y) {
    let best = Infinity, best2 = Infinity;
    for (let k = 0, b = 0; k < nr; k++, b += 6) {
      const s = A[b] * x + A[b + 1] * y + A[b + 2], t = A[b + 3] * x + A[b + 4] * y + A[b + 5];
      const fs = s - Math.round(s), ft = t - Math.round(t);
      const qx = fs * ux + ft * vx, qy = fs * uy + ft * vy;
      for (let o = 0; o < nm; o++) {
        if (mlen[o] - rho - R >= best) break;                         // sorted by length: all the later ones are farther still
        const px = qx - moff[2 * o], py = qy - moff[2 * o + 1], lim = best + R;
        if (px * px + py * py >= lim * lim) continue;                  // the whole copy lies within R of its centre
        for (let i = 0; i < np; i++) best2 = outlineDist2(outs[i], px, py, best2);
        best = Math.sqrt(best2);
      }
    }
    return best;
  }

  return { winding, tone: (x, y) => (winding(x, y) > 0 ? 1 : 0), margin };
}

/**
 * The shape print of a group: the orbit of the motif `shapes` (a list of closed polygons { pts: [[x, y], ...], hole? }
 * in the world coordinates of the group) under all of its elements. See the top of the file for the Print.
 * Throws an Error for a motif that cannot be used: no polygon with 3 or more points, a coordinate that is not a finite
 * number, a group without a lattice. Whether the motif keeps the RULES is validateShapes' question, not this one's.
 */
export function makeShapePrint(group, { key = 'shapes', name = 'shapes', shapes, info } = {}) {
  const G = readGroup(group), domainArea = G.cellArea / G.reps.length, size = Math.sqrt(domainArea);
  const polys = readPolygons(shapes, Math.max(SAME_POINT, SAME_POINT_SIZES * size));
  let verts = 0, netArea = 0;
  for (const P of polys) { verts += P.pts.length >> 1; netArea += P.hole ? -P.area : P.area; }
  const [cx, cy, R] = enclosingCircle(polys);
  const f = compile(polys, cx, cy, R, G.e1, G.e2, G.reps);
  return Object.freeze({
    key, kind: 'shapes', name, info: Object.freeze({ ...(info || {}) }),
    cell: Math.sqrt(Math.max(0, netArea)),
    tone: f.tone, winding: f.winding, margin: f.margin,
    polys: Object.freeze(polys.map((P) => Object.freeze({ pts: P.pts, hole: P.hole, box: Object.freeze(P.box), area: P.area }))),   // (compile took its own copy)
    cx, cy, R, verts,
    e1: Object.freeze(G.e1), e2: Object.freeze(G.e2), inv: Object.freeze(G.inv), reps: Object.freeze(G.reps),
    size, netArea,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// The copies of the motif near a box
// ---------------------------------------------------------------------------------------------------------------

/** The whole-number ranges [m0, m1, n0, n1] that hold every lattice vector m e1 + n e2 in the rectangle [x0, x1] x [y0, y1]. */
function latticeBounds(inv, x0, y0, x1, y1, out) {
  const a0 = inv[0] * x0, a1 = inv[0] * x1, b0 = inv[1] * y0, b1 = inv[1] * y1;
  const c0 = inv[2] * x0, c1 = inv[2] * x1, d0 = inv[3] * y0, d1 = inv[3] * y1;
  out[0] = Math.ceil(Math.min(a0, a1) + Math.min(b0, b1) - 1e-9); out[1] = Math.floor(Math.max(a0, a1) + Math.max(b0, b1) + 1e-9);
  out[2] = Math.ceil(Math.min(c0, c1) + Math.min(d0, d1) - 1e-9); out[3] = Math.floor(Math.max(c0, c1) + Math.max(d0, d1) + 1e-9);
  if (!((out[1] - out[0] + 1) * (out[3] - out[2] + 1) <= 4e6)) throw new Error('shapes.js: the box holds millions of copies of the motif');
  return out;
}

/**
 * Every element g of the group whose copy g(motif) can touch the world box [x0, y0, x1, y1], each once, as
 * { a, b, c, d, tx, ty, rep } (rep = the index of its coset representative in print.reps). "Can touch": the copy's
 * bounding circle and the box of its polygons' boxes both meet the box, so a few of the copies listed at the rim of the
 * box stay outside it; none that reaches in is left out.
 */
export function shapeElements(print, box) {
  const out = [];
  if (!print || !box) return out;
  const x0 = Math.min(box[0], box[2]), x1 = Math.max(box[0], box[2]), y0 = Math.min(box[1], box[3]), y1 = Math.max(box[1], box[3]);
  if (!Number.isFinite(x0 + x1 + y0 + y1)) return out;
  const { e1, e2, inv, reps, polys, cx, cy, R } = print, rg = [0, 0, 0, 0];
  const pad = 1e-12 * (R + Math.abs(x0) + Math.abs(x1) + Math.abs(y0) + Math.abs(y1)), R2 = (R * (1 + 1e-9) + pad) ** 2;   // (a hair generous)
  for (let k = 0; k < reps.length; k++) {
    const r = reps[k], gx = r.a * cx + r.b * cy + r.tx, gy = r.c * cx + r.d * cy + r.ty;
    // the box of r(motif): the corners of each polygon's box carried along, cut down to the bounding circle's box
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const P of polys) {
      const b = P.box;
      for (let q = 0; q < 4; q++) {
        const px = q & 1 ? b[2] : b[0], py = q & 2 ? b[3] : b[1], X = r.a * px + r.b * py + r.tx, Y = r.c * px + r.d * py + r.ty;
        if (X < bx0) bx0 = X; if (X > bx1) bx1 = X; if (Y < by0) by0 = Y; if (Y > by1) by1 = Y;
      }
    }
    bx0 = Math.max(bx0, gx - R) - pad; bx1 = Math.min(bx1, gx + R) + pad; by0 = Math.max(by0, gy - R) - pad; by1 = Math.min(by1, gy + R) + pad;
    // the translations w for which [bx0, bx1] + w meets [x0, x1], and likewise in y
    latticeBounds(inv, x0 - bx1, y0 - by1, x1 - bx0, y1 - by0, rg);
    for (let m = rg[0]; m <= rg[1]; m++) for (let n = rg[2]; n <= rg[3]; n++) {
      const wx = m * e1[0] + n * e2[0], wy = m * e1[1] + n * e2[1];
      if (bx0 + wx > x1 || bx1 + wx < x0 || by0 + wy > y1 || by1 + wy < y0) continue;
      const px = gx + wx, py = gy + wy, dx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0, dy = py < y0 ? y0 - py : py > y1 ? py - y1 : 0;
      if (dx * dx + dy * dy > R2) continue;
      out.push({ a: r.a, b: r.b, c: r.c, d: r.d, tx: r.tx + wx, ty: r.ty + wy, rep: k });
    }
  }
  return out;
}

/** Every element g with |g(centre of the motif) - (x, y)| <= radius, each once, with that distance as `dist`. */
function elementsAbout(print, x, y, radius) {
  const { e1, e2, inv, reps, cx, cy } = print, rg = [0, 0, 0, 0], out = [];
  for (let k = 0; k < reps.length; k++) {
    const r = reps[k], gx = r.a * cx + r.b * cy + r.tx, gy = r.c * cx + r.d * cy + r.ty;
    latticeBounds(inv, x - radius - gx, y - radius - gy, x + radius - gx, y + radius - gy, rg);
    for (let m = rg[0]; m <= rg[1]; m++) for (let n = rg[2]; n <= rg[3]; n++) {
      const wx = m * e1[0] + n * e2[0], wy = m * e1[1] + n * e2[1], dist = Math.hypot(gx + wx - x, gy + wy - y);
      if (dist <= radius) out.push({ a: r.a, b: r.b, c: r.c, d: r.d, tx: r.tx + wx, ty: r.ty + wy, rep: k, dist });
    }
  }
  return out;
}

/**
 * The motif's polygons simplified to within `tol` world units, for a picture whose pixel is much larger than the
 * motif's finest step (the plane's canvas, at a quarter of a device pixel: the stress design keeps 220 of its 1982
 * vertices at the plane's scale of *442, the paisley 154 of 485). Douglas-Peucker on each closed polygon, from its first
 * point and the point farthest from it; the points kept are points of the outline, so a copy stays inside the circle and
 * the boxes shapeElements culls by. A polygon left with fewer than three points (it is under 2 tol across) is left out.
 * [{ pts, hole, box }] as print.polys; cached per print and tolerance (rounded down to a power of two).
 */
const simplerOf = new WeakMap();
function simplifiedPolys(print, tol) {
  const q = Math.pow(2, Math.floor(Math.log2(tol)));
  if (!(q > 0) || !Number.isFinite(q)) return print.polys;
  let m = simplerOf.get(print);
  if (!m) { m = new Map(); simplerOf.set(print, m); }
  let out = m.get(q);
  if (out) return out;
  out = [];
  for (const P of print.polys) {
    const p = P.pts, n = p.length >> 1;
    if (n <= 3) { out.push(P); continue; }
    let f = 0, far = -1;
    for (let i = 1; i < n; i++) { const d = (p[2 * i] - p[0]) ** 2 + (p[2 * i + 1] - p[1]) ** 2; if (d > far) { far = d; f = i; } }
    const keep = new Uint8Array(n), stack = [0, f, f, n], q2 = q * q;
    keep[0] = 1; keep[f] = 1;
    while (stack.length) {
      const b = stack.pop(), a = stack.pop(), bb = b === n ? 0 : b;
      const ax = p[2 * a], ay = p[2 * a + 1], bx = p[2 * bb], by = p[2 * bb + 1];
      let worst = -1, at = -1;
      for (let i = a + 1; i < b; i++) {
        const d = pointSeg2(p[2 * i], p[2 * i + 1], ax, ay, bx, by);
        if (d > worst) { worst = d; at = i; }
      }
      if (at >= 0 && worst > q2) { keep[at] = 1; stack.push(a, at, at, b); }
    }
    let k = 0;
    for (let i = 0; i < n; i++) k += keep[i];
    if (k === n) { out.push(P); continue; }
    if (k < 3) continue;
    const pts = new Float64Array(2 * k);
    for (let i = 0, j = 0; i < n; i++) if (keep[i]) { pts[j++] = p[2 * i]; pts[j++] = p[2 * i + 1]; }
    out.push(Object.freeze({ pts, hole: P.hole, box: P.box }));
  }
  out = Object.freeze(out);
  m.set(q, out);
  return out;
}

/**
 * Fill the DARK tone of the print over the world box [x0, y0, x1, y1] on the 2D context `c`, in `fillStyle`: every
 * copy of the motif that can touch the box, as ONE path, filled by the NONZERO rule.
 *   map(x, y, out) -> out   world point -> canvas point; any affine map (the plane's window, which flips y; a card of
 *                           the replication on its way, which also turns and flips)
 *   tol                     0 (the default): the motif's own outline; > 0: its outline simplified to within tol world
 *                           units (simplifiedPolys: the plane draws at a quarter of a device pixel)
 * A mirrored copy is walked backwards, so every outer polygon runs the same way round on the canvas and every hole the
 * other way: coincident copies add up to one shape, and a hole stays a hole. The caller clips (to the pane, to a tile).
 * Uses beginPath, moveTo, lineTo, closePath and fill of `c` and sets c.fillStyle, nothing else. Returns the number of
 * copies in the path.
 */
export function fillShapes(c, print, map, box, fillStyle, tol = 0) {
  if (!print) return 0;
  const els = shapeElements(print, box), polys = tol > 0 ? simplifiedPolys(print, tol) : print.polys;
  const o = [0, 0];
  c.beginPath();
  for (const g of els) {
    const flip = g.a * g.d - g.b * g.c < 0;
    for (const P of polys) {
      const p = P.pts, n = p.length >> 1;
      for (let k = 0; k < n; k++) {
        const i = flip ? n - 1 - k : k, x = p[2 * i], y = p[2 * i + 1];
        const q = map(g.a * x + g.b * y + g.tx, g.c * x + g.d * y + g.ty, o) || o;
        if (k) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]);
      }
      c.closePath();
    }
  }
  if (fillStyle != null) c.fillStyle = fillStyle;
  c.fill('nonzero');
  return els.length;
}

/**
 * The polygons of every copy of the motif that can touch the world box (the copies of shapeElements, in its order;
 * the polygons of a copy in the order of print.polys), in world coordinates: [{ pts: Float64Array, hole, box }], outer
 * polygons counter-clockwise and holes clockwise (a mirrored copy is listed backwards). What src/sdf.js bakeSDF takes:
 * give it the cell's box widened by the texture's range.
 */
export function copiesIn(print, box) {
  const out = [];
  if (!print) return out;
  for (const g of shapeElements(print, box)) {
    const flip = g.a * g.d - g.b * g.c < 0;
    for (const P of print.polys) {
      const p = P.pts, n = p.length >> 1, pts = new Float64Array(2 * n);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k < n; k++) {
        const i = flip ? n - 1 - k : k, x = g.a * p[2 * i] + g.b * p[2 * i + 1] + g.tx, y = g.c * p[2 * i] + g.d * p[2 * i + 1] + g.ty;
        pts[2 * k] = x; pts[2 * k + 1] = y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      out.push({ pts, hole: P.hole, box: [x0, y0, x1, y1] });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The texture: what the 3D renderer prints (render3d.js setStyle({ print: { mode: 3, ..., tex } }))
// ---------------------------------------------------------------------------------------------------------------

/** The side, in texels, of the texture bakeShapes makes when it is told none. A megabyte; a power of two (the mip levels then nest). */
export const BAKE_SIZE = 1024;
/** The range of a baked texture in texel pitches (a pitch: the longer side of a texel). */
export const BAKE_RANGE = 6;
/** How many textures bakeShapes keeps: the ones asked for last (17 groups times a dozen patterns would be 200 MB). */
export const BAKE_KEEP = 6;

const baked = [];                                                     // [{ print, tex }], the one asked for last at the end

/**
 * The print's signed-distance texture over one cell of its lattice (src/sdf.js bakeSDF over every copy of the motif
 * that comes within the range of the cell), as the renderer's third print mode takes it. A frozen
 *   { size, data, range, origin, e1, e2, pitch }
 *   data            Uint8Array(size * size): texel (i, j) at index j * size + i, its centre at the world point
 *                   origin + ((i + 0.5) / size) e1 + ((j + 0.5) / size) e2; 128 on an outline, below it in the dark tone,
 *                   sd = (value - 128) / 127 * range (src/sdf.js). Never write into it: the renderer keeps it by
 *                   reference and restores a lost context from it.
 *   e1, e2          the cell of the TEXTURE: a reduced basis of the print's lattice (the two shortest vectors, between
 *                   60 and 120 degrees apart), NOT always the group's e1, e2 — *x is given on a rhombus of 21 degrees,
 *                   whose texels would be slivers. The texture repeats under both, as the print does.
 *   origin          the corner of the cell whose middle is the centre of the motif (any point would do)
 *   pitch           the longer side of a texel, in world units;   range = BAKE_RANGE * pitch
 * The same object every time for the same print and size, while it is among the BAKE_KEEP textures asked for last
 * (the renderer uploads a texture when the data array is another one: asking again per frame costs nothing); a print
 * that was dropped is baked again when it comes back, a few milliseconds.
 * What a texture of 1024 holds: a texel is 0.0015 (o) to 0.0036 (*632) tile sizes; a mark or a gap thinner than about
 * two texels is not held (GAP_MIN, 0.02 tile sizes, is 5 texels and more).
 */
export function bakeShapes(print, size = BAKE_SIZE) {
  if (!print || print.kind !== 'shapes' || typeof print.margin !== 'function') throw new TypeError('bakeShapes: the print is no shape print (makeShapePrint)');
  if (!Number.isInteger(size) || size < 2) throw new RangeError('bakeShapes: size is a whole number of texels, 2 or more');
  for (let i = baked.length - 1; i >= 0; i--) {
    const k = baked[i];
    if (k.print !== print || k.tex.size !== size) continue;
    if (i !== baked.length - 1) { baked.splice(i, 1); baked.push(k); }
    return k.tex;
  }
  const [ux, uy, vx, vy] = reducedBasis(print.e1, print.e2);
  const pitch = Math.max(Math.hypot(ux, uy), Math.hypot(vx, vy)) / size, range = BAKE_RANGE * pitch;
  const ox = print.cx - (ux + vx) / 2, oy = print.cy - (uy + vy) / 2;
  // every copy that comes within the range of the cell: those that can touch the cell's box, widened by the range
  const x0 = ox + Math.min(0, ux, vx, ux + vx), x1 = ox + Math.max(0, ux, vx, ux + vx), y0 = oy + Math.min(0, uy, vy, uy + vy), y1 = oy + Math.max(0, uy, vy, uy + vy);
  const pad = range * (1 + 1e-9);
  const data = bakeSDF({ origin: [ox, oy], e1: [ux, uy], e2: [vx, vy], size, range, polys: copiesIn(print, [x0 - pad, y0 - pad, x1 + pad, y1 + pad]) });
  const tex = Object.freeze({ size, data, range, origin: Object.freeze([ox, oy]), e1: Object.freeze([ux, uy]), e2: Object.freeze([vx, vy]), pitch });
  baked.push({ print, tex });
  while (baked.length > BAKE_KEEP) baked.shift();
  return tex;
}

// ---------------------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------------------

const fmt = (v) => (Math.round(v * 1e4) / 1e4).toString();

/** Two edges of the outline O that are not neighbours and cross or touch (nearer than tol): { x, y, cross } or null. */
function selfTouch(O, tol2) {
  const { n, X, Y, cb, nc } = O;
  if (n < 4) return null;
  for (let ca = 0; ca < nc; ca++) for (let c2 = ca; c2 < nc; c2++) {
    if (boxBox2(cb, 4 * ca, cb, 4 * c2) > tol2) continue;
    const ea = Math.min(n, (ca + 1) * CHUNK), eb = Math.min(n, (c2 + 1) * CHUNK);
    for (let i = ca * CHUNK; i < ea; i++) for (let j = Math.max(c2 * CHUNK, i + 2); j < eb; j++) {
      if (i === 0 && j === n - 1) continue;                            // the last edge ends where the first begins
      if (segSeg2(X[i], Y[i], X[i + 1], Y[i + 1], X[j], Y[j], X[j + 1], Y[j + 1]) > tol2) continue;
      const s = [X[i], Y[i], X[i + 1], Y[i + 1], X[j], Y[j], X[j + 1], Y[j + 1]], p = nearestPoint(s);
      return { x: p[0], y: p[1], cross: properCross(...s) };
    }
  }
  return null;
}

/**
 * What validateShapes and measureShapes both need to know of a print: the problems (strings), the smallest distance
 * between the outlines of two different copies (world units), the order of the motif's stabiliser, and whether the dark
 * parts of the copies are disjoint (so that areas add up).
 */
function examine(print, gap) {
  const { polys, size, R, cx, cy, verts } = print, np = polys.length;
  const touch = TOUCH * size, touch2 = touch * touch, same2 = (COINCIDE * size) ** 2, gapW = gap * size;
  const problems = [];
  const res = { problems, gap: Infinity, stabilizer: 1, disjoint: true };
  const at = (p) => `(${fmt(p[0])}, ${fmt(p[1])})`;

  if (!polys.some((P) => !P.hole)) { problems.push('the motif has no outer polygon'); res.disjoint = false; }
  if (verts > MAX_VERTS) problems.push(`the motif has ${verts} vertices: more than ${MAX_VERTS}`);
  if (verts > CHECK_VERTS) { problems.push(`its outlines were not looked at (more than ${CHECK_VERTS} vertices)`); res.disjoint = false; res.gap = NaN; return res; }

  const M = polys.map((P) => outlineOf(P.pts));
  // each polygon by itself
  polys.forEach((P, k) => {
    if (!(P.area > 1e-12 * (P.box[2] - P.box[0] + P.box[3] - P.box[1]) ** 2)) { problems.push(`polygon ${k} has no area`); res.disjoint = false; return; }
    // (a spike without width is caught here too: the edge after it starts on the edge before it)
    const t = selfTouch(M[k], touch2);
    if (t) { problems.push(`polygon ${k} ${t.cross ? 'crosses' : 'touches'} itself near ${at([t.x, t.y])}`); res.disjoint = false; }
  });
  // the polygons of one motif: no two outlines meet; an outer polygon lies in the light, a hole in the dark
  let meet = false;
  for (let i = 0; i < np; i++) for (let j = i + 1; j < np; j++) {
    const hit = {};
    if (pairDist2(M[i], M[j], touch2 * (1 + 1e-9) + Number.MIN_VALUE, hit) <= touch2) {
      meet = true; res.disjoint = false;
      problems.push(`polygons ${i} and ${j} of the motif cross or touch near ${at(nearestPoint(hit.seg))}`);
    }
  }
  if (!meet) {
    polys.forEach((P, j) => {
      let w = 0;
      for (let i = 0; i < np; i++) if (i !== j && insideFlat(polys[i].pts, P.pts[0], P.pts[1])) w += polys[i].hole ? -1 : 1;
      if (P.hole && w < 1) { problems.push(`polygon ${j}, a hole, does not lie inside an outer polygon of the motif`); res.disjoint = false; }
      if (!P.hole && w !== 0) { problems.push(`polygon ${j} lies ${w > 0 ? 'inside another polygon' : 'in a hole that is in no polygon'} of the motif`); res.disjoint = false; }
    });
  }

  // the copies. By symmetry it is enough to hold the motif itself against every other copy g(motif) that can come
  // near; the nearest first. A translate by the shortest lattice vector is a different copy no farther than that.
  const [ux, uy] = reducedBasis(print.e1, print.e2), lambda = Math.hypot(ux, uy);
  const near = (x, y, tol2) => { for (let i = 0; i < np; i++) if (outlineDist2(M[i], x, y, tol2 * (1 + 1e-9) + Number.MIN_VALUE) <= tol2) return true; return false; };
  const coincides = (g) => {
    // every vertex and the middle of every edge of g(motif) on the motif's outline, and of g^-1(motif) too
    const dg = g.a * g.d - g.b * g.c, ia = g.d / dg, ib = -g.b / dg, ic = -g.c / dg, id = g.a / dg;
    for (let i = 0; i < np; i++) {
      const O = M[i];
      for (let k = 0; k < O.n; k++) for (let h = 0; h < 2; h++) {
        const x = h ? (O.X[k] + O.X[k + 1]) / 2 : O.X[k], y = h ? (O.Y[k] + O.Y[k + 1]) / 2 : O.Y[k];
        if (!near(g.a * x + g.b * y + g.tx, g.c * x + g.d * y + g.ty, same2)) return false;
        const u = x - g.tx, v = y - g.ty;
        if (!near(ia * u + ib * v, ic * u + id * v, same2)) return false;
      }
    }
    return true;
  };
  // how far the vertices of g(motif) lie from the motif's outline at most, where that is under lim (else Infinity)
  const strays = (g, lim) => {
    let worst2 = 0;
    for (let i = 0; i < np; i++) for (let k = 0, O = M[i]; k < O.n; k++) {
      const x = g.a * O.X[k] + g.b * O.Y[k] + g.tx, y = g.c * O.X[k] + g.d * O.Y[k] + g.ty;
      let d2 = lim * lim;
      for (let j = 0; j < np; j++) d2 = outlineDist2(M[j], x, y, d2);
      if (d2 >= lim * lim) return Infinity;
      if (d2 > worst2) worst2 = d2;
    }
    return Math.sqrt(worst2);
  };
  const windingOfMotif = (x, y) => { let w = 0; for (const P of polys) if (insideFlat(P.pts, x, y)) w += P.hole ? -1 : 1; return w; };
  const cand = elementsAbout(print, cx, cy, 2 * R + lambda + touch).sort((p, q) => p.dist - q.dist);
  let min = lambda, minSeg = null, close = 0, inside = null, almost = Infinity;
  for (const g of cand) {
    if (g.dist - 2 * R >= min && g.dist > 2 * R) break;
    if (Math.abs(g.a - 1) + Math.abs(g.b) + Math.abs(g.c) + Math.abs(g.d - 1) < 1e-9 && Math.hypot(g.tx, g.ty) < 1e-9 * size) continue;   // the motif itself
    if (coincides(g)) { res.stabilizer++; continue; }
    // a copy that all but coincides: the motif sits on a centre or a mirror and has its symmetry only roughly
    if (almost === Infinity && g.dist <= 0.1 * R) almost = strays(g, 0.05 * R);
    const C = M.map((O) => carried(O, g)), lim = Math.max(min, gapW), hit = {};
    let d2 = lim * lim * (1 + 1e-12);
    for (let i = 0; i < np; i++) for (let j = 0; j < np; j++) d2 = pairDist2(M[i], C[j], d2, hit);
    const d = Math.sqrt(d2);
    if (d < min) { min = d; if (hit.seg) minSeg = hit.seg; }
    if (d < gapW - touch) close++;
    if (d > touch && g.dist <= 2 * R && !inside) {
      // apart, outline from outline: one may still lie inside the other
      for (let j = 0; j < np && !inside; j++) if (windingOfMotif(C[j].X[0], C[j].Y[0]) > 0) inside = [C[j].X[0], C[j].Y[0]];
    }
  }
  res.gap = min;
  const where = minSeg ? ` near ${at(nearestPoint(minSeg))}` : '';
  if (almost < Infinity) {
    const off = almost / size;
    problems.push(`the motif has a symmetry of the group only roughly: a copy of it strays up to ${off < 1e-3 ? off.toExponential(1) : fmt(off)} tile sizes from the motif itself ("coincide" is within ${COINCIDE.toExponential(0)}); on a rotation centre or a mirror it must have that symmetry exactly`);
  }
  if (min <= touch) { problems.push(`two copies of the motif cross or touch${where}`); res.disjoint = false; }
  else if (min < gapW - touch) problems.push(`two copies of the motif come within ${fmt(min / size)} tile sizes of each other${where}: the rule is ${fmt(gap)}` + (close > 2 ? ` (${close} neighbours are too near)` : ''));
  if (inside) { problems.push(`a copy of the motif lies inside another near ${at(inside)}`); res.disjoint = false; }
  return res;
}

/**
 * Does the motif of the print keep the rules (the top of the file)? { ok, problems, gap, stabilizer }:
 *   problems     what is wrong, one line each, with a place where there is one; ok <=> there is none
 *   gap          the smallest distance between the outlines of two different copies that do not coincide, in tile sizes
 *                (0 when they cross or touch; never more than the shortest lattice vector)
 *   stabilizer   how many elements of the group leave the motif as it is (1 for a motif at a generic place)
 * opts.gap is the distance two copies must keep, in tile sizes (GAP_MIN). "Coincide": every vertex and the middle of
 * every edge of one lies within 1e-6 tile sizes of the other's outline, both ways. A motif that sits on a centre or a
 * mirror and has that symmetry only roughly (made symmetric by a method that is not exact) is told so: its copies there
 * do not coincide, they cross.
 */
export function validateShapes(print, { gap = GAP_MIN } = {}) {
  const r = examine(print, gap);
  return { ok: r.problems.length === 0, problems: r.problems, gap: r.gap / print.size, stabilizer: r.stabilizer };
}

/** The texels (of a BAKE_SIZE texture of the print's cell) two copies must keep between them, or the 3D view runs them together. */
export const TEXELS_APART = 2;
/**
 * The side of a texel of a print's texture, in world units (bakeShapes' `pitch`), from the lattice alone: { e1, e2 } of a
 * group or of a print, at `size` texels a cell. A motif can be drawn for the texture before its print is made (14 Nov
 * 2026: the Comma's tail, src/patterns/comma.js, is kept a few texels thick to its end).
 */
export function texelPitch(lattice, size = BAKE_SIZE) {
  const [ux, uy, vx, vy] = reducedBasis(lattice.e1, lattice.e2);
  return Math.max(Math.hypot(ux, uy), Math.hypot(vx, vy)) / size;
}
/**
 * May the print be SHOWN (src/pattern.js printFor)? validateShapes, with the gap the 3D texture can hold, TEXELS_APART
 * texels of a BAKE_SIZE texture of this print's cell (0.003 tile sizes in o, 0.0073 in *632), in place of GAP_MIN, the
 * wider gap a DESIGN keeps (dev/patterns/kit.js; proto.mjs and app-sheet.mjs report that one). What it refuses would be
 * drawn wrong: copies that cross, touch or lie in each other or that the texture would run together, a polygon that
 * touches itself or has no area, a hole outside its polygon, a symmetry kept only roughly (an outline inside the dark is
 * a hairline in 3D, and the plane and the 3D view disagree), more than MAX_VERTS vertices. { ok, problems, gap, stabilizer }.
 */
export function printable(print) {
  return validateShapes(print, { gap: (TEXELS_APART * texelPitch(print)) / print.size });
}

/**
 * Where the motif is THINNER than `width` (world units): a needle's tip, a neck, a slit, a gap between two polygons of
 * one motif. A picture whose pixel is about width / 1.5 across cannot hold such a part: the 3D view's distance texture
 * (a texel is bakeShapes(print).pitch; the reviews of 13 Nov measured that it holds nothing under about 1.5 texels)
 * cuts a needle's tip short or breaks it into specks, while the plane draws it whole. Not a rule (validateShapes'
 * rules say nothing of it): a measurement for the designs, which app-sheet.mjs prints.
 * Along every outline of the motif, at steps of width / 4, the thickness at a point p is its distance to the nearest
 * point q of an outline ACROSS from it: of another polygon of the motif, or of its own outline farther along it than
 * 1.5 |p - q| (so a gentle bend is no thin part, and a round blob of diameter d is a part of width d). The points
 * thinner than `width` make runs: [{ length, width, at: [x, y], dark }], the longest first, in world units: `length`
 * the run's length along the outline (a needle: both of its sides, about twice what a texture with texels of
 * width / 1.5 loses of it), `width` the thinnest place and `at` where it is, `dark` whether the thin part is dark (a
 * needle, a neck) or light (a slit, the gap between an island and its hole). Copies of the motif are not looked at:
 * the gap between copies is validateShapes' rule.
 */
export function thinParts(print, width) {
  const polys = print.polys, np = polys.length, M = polys.map((P) => outlineOf(P.pts)), runs = [];
  if (!(width > 0)) return runs;
  const cum = M.map((O) => { const c = new Float64Array(O.n + 1); for (let i = 0; i < O.n; i++) c[i + 1] = c[i] + Math.hypot(O.X[i + 1] - O.X[i], O.Y[i + 1] - O.Y[i]); return c; });
  const w2 = width * width, step = width / 4, ARC = 1.5;              // (a little under pi / 2: across a round blob, too)
  const windingOfMotif = (x, y) => { let w = 0; for (const P of polys) if (insideFlat(P.pts, x, y)) w += P.hole ? -1 : 1; return w; };
  for (let i = 0; i < np; i++) {
    const O = M[i], C = cum[i], L = C[O.n], mine = [];
    let cur = null, lastA = -Infinity;
    for (let e = 0; e < O.n; e++) {
      const len = C[e + 1] - C[e], k = Math.max(1, Math.ceil(len / step));
      for (let s = 0; s < k; s++) {
        const u = s / k, px = O.X[e] + u * (O.X[e + 1] - O.X[e]), py = O.Y[e] + u * (O.Y[e + 1] - O.Y[e]), a = C[e] + u * len;
        let best = w2, bx = 0, by = 0;
        for (let j = 0; j < np; j++) {
          const Q = M[j], CQ = cum[j], LQ = CQ[Q.n], cb = Q.cb;
          for (let c = 0, b = 0; c < Q.nc; c++, b += 4) {
            const dx = px < cb[b] ? cb[b] - px : px > cb[b + 2] ? px - cb[b + 2] : 0, dy = py < cb[b + 1] ? cb[b + 1] - py : py > cb[b + 3] ? py - cb[b + 3] : 0;
            if (dx * dx + dy * dy >= best) continue;
            const end = Math.min(Q.n, (c + 1) * CHUNK);
            for (let f = c * CHUNK; f < end; f++) {
              const ax = Q.X[f], ay = Q.Y[f], ex = Q.X[f + 1] - ax, ey = Q.Y[f + 1] - ay, l2 = ex * ex + ey * ey;
              let t = l2 > 0 ? ((px - ax) * ex + (py - ay) * ey) / l2 : 0;
              if (t < 0) t = 0; else if (t > 1) t = 1;
              const qx = ax + t * ex, qy = ay + t * ey, d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
              if (d2 >= best) continue;
              if (j === i) {                                           // its own outline: only a point across from it
                const sep0 = Math.abs(CQ[f] + t * Math.sqrt(l2) - a), sep = Math.min(sep0, LQ - sep0);
                if (!(sep > ARC * Math.sqrt(d2) * (1 + 1e-9) + 1e-12 * L)) continue;
              }
              best = d2; bx = qx; by = qy;
            }
          }
        }
        // (a run goes on over one point that is not thin: the tip of a needle itself has no point across from it)
        if (best < w2) {
          const d = Math.sqrt(best);
          if (!cur || a - lastA > 2.01 * step) { cur = { a0: a, a1: a, width: d, at: [px, py], mid: [(px + bx) / 2, (py + by) / 2] }; mine.push(cur); }
          else { cur.a1 = a; if (d < cur.width) { cur.width = d; cur.at = [px, py]; cur.mid = [(px + bx) / 2, (py + by) / 2]; } }
          lastA = a;
        }
      }
    }
    // a run through the outline's first point is one run
    if (mine.length > 1 && mine[0].a0 <= 2.01 * step && mine[mine.length - 1].a1 >= L - 2.01 * step) {
      const first = mine.shift(), last = mine[mine.length - 1];
      last.a1 = L + first.a1;
      if (first.width < last.width) { last.width = first.width; last.at = first.at; last.mid = first.mid; }
    }
    for (const r of mine) runs.push({ length: Math.min(L, r.a1 - r.a0 + step), width: r.width, at: r.at, dark: windingOfMotif(r.mid[0], r.mid[1]) > 0 });
  }
  return runs.sort((p, q) => q.length - p.length);
}

// ---------------------------------------------------------------------------------------------------------------
// The numbers a design is judged by
// ---------------------------------------------------------------------------------------------------------------

/** One pass of the distance transform of Felzenszwalb and Huttenlocher: d[q] = min over p of (q - p)^2 + f[p]. */
function parabolas(f, n, d, v, z) {
  let k = -1;
  for (let q = 0; q < n; q++) {
    if (f[q] === Infinity) continue;
    let s = -Infinity;
    while (k >= 0) {
      const p = v[k];
      s = (f[q] + q * q - (f[p] + p * p)) / (2 * (q - p));
      if (s <= z[k]) k--; else break;
    }
    if (k < 0) s = -Infinity;
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  if (k < 0) { for (let q = 0; q < n; q++) d[q] = Infinity; return; }
  for (let q = 0, j = 0; q < n; q++) { while (z[j + 1] < q) j++; const p = v[j]; d[q] = (q - p) * (q - p) + f[p]; }
}
/** The exact Euclidean distance, in cells, from every cell of a w x h grid to the nearest cell where on[] is not 0. */
function distanceTransform(on, w, h) {
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), out = new Float64Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = on[y * w + x] ? 0 : Infinity;
    parabolas(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x];
    parabolas(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}

/**
 * The numbers a design is judged by (kit.js's measure), lengths in units of the tile's size sqrt(domainArea):
 *   coverage       the share of the plane that is dark, sampled over exactly ONE cell of the lattice (kit.js samples a
 *                  square window, which is no whole number of periods: its share is off by up to 8 % of itself)
 *   coverageExact  netArea / (stabilizer * domainArea): the same share from the polygons' areas, when the dark parts of
 *                  the copies are disjoint (no two cross, touch or lie inside each other); else null
 *   emptyDisc      the DIAMETER of the largest disc that holds no dark point (how big the largest bare patch is)
 *   darkDisc       the diameter of the largest disc that is all dark (how fat the fattest mark is)
 *   overlap        the share of the plane covered by two different copies at once (must be 0; coincident copies do not
 *                  count: W > stabilizer)
 *   verts          vertices of the motif;   stabilizer: how many elements of the group leave the motif as it is
 * Sampled on grids of `per` points per tile size: good to about 1 / per. The two discs are measured on a square window
 * round opts.center (default: the centre of the motif; with a group's own centre the samples are kit.js's).
 */
export function measureShapes(print, { per = 56, center = null } = {}) {
  const { size, e1, e2 } = print, h = size / per, E = examine(print, 0), stab = E.stabilizer;
  // coverage and overlap: one cell of the lattice, on its reduced basis
  const [ux, uy, vx, vy] = reducedBasis(e1, e2);
  const ns = Math.max(4, Math.ceil(Math.hypot(ux, uy) / h)), nt = Math.max(4, Math.ceil(Math.hypot(vx, vy) / h));
  let nd = 0, over = 0;
  for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) {
    const s = (i + 0.5) / ns, t = (j + 0.5) / nt, W = print.winding(s * ux + t * vx, s * uy + t * vy);
    if (W > 0) nd++;
    if (W > stab) over++;
  }
  // the two discs: a square window that holds a whole tile's worth of every kind of place, and a rim so that the
  // distances inside it are right
  const L = Math.max(Math.hypot(e1[0], e1[1]), Math.hypot(e2[0], e2[1]));
  const half = Math.min(1.1 * L + 1.2 * size, 3.4 * size), pad = 1.3 * size;
  const mx = center ? center[0] : print.cx, my = center ? center[1] : print.cy;
  const w = Math.ceil((2 * (half + pad)) / h), x0 = mx - half - pad, y0 = my - half - pad;
  const dark = new Uint8Array(w * w), light = new Uint8Array(w * w);
  let anyDark = false, anyLight = false;
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    const t = print.winding(x0 + (i + 0.5) * h, y0 + (j + 0.5) * h) > 0 ? 1 : 0;
    dark[j * w + i] = t; light[j * w + i] = 1 - t;
    if (t) anyDark = true; else anyLight = true;
  }
  let emptyR = 0, darkR = 0;
  const toDark = distanceTransform(dark, w, w), toLight = distanceTransform(light, w, w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
    if (Math.abs(x0 + (i + 0.5) * h - mx) > half || Math.abs(y0 + (j + 0.5) * h - my) > half) continue;
    if (toDark[j * w + i] > emptyR) emptyR = toDark[j * w + i];
    if (toLight[j * w + i] > darkR) darkR = toLight[j * w + i];
  }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return {
    coverage: r3(nd / (ns * nt)),
    coverageExact: E.disjoint ? print.netArea / (stab * size * size) : null,
    emptyDisc: anyDark ? r3((2 * emptyR * h) / size) : Infinity,
    darkDisc: anyLight ? r3((2 * darkR * h) / size) : Infinity,
    overlap: r3(over / (ns * nt)),
    verts: print.verts,
    stabilizer: stab,
  };
}
