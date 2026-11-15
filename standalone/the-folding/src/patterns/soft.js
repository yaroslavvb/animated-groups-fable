// src/patterns/soft.js — "Soft commas" (pattern key soft; the design folder is dev/patterns/designs/blobs): the
// Poincare series of a comma-shaped bump.
// (Shipped 14 Nov 2026, the pattern round: dev/patterns/designs/blobs/design.js as it was then, but for its imports;
// test/patterns-shipped.test.js holds the two to the same motif in every group. Its lab and notes stay in that folder.)
//
//   u(x) = sum over ALL g of the group of k(g^-1 x),      dark = { u > c }
//
// k is a soft brush stroke: a chain of round Gaussian bumps along a curling spine, a big one at the head and smaller
// and smaller ones down the tail. Whatever k is, every element of the group keeps u, so the level set is a pattern of
// the orbifold; c is the level at which the wanted share of the plane (half) is dark. Where two copies come near each
// other their bumps add up and the blobs swell toward one another, so the outline is nowhere a drawn curve: it is one
// smooth level line of one smooth function. A deep narrow dip at the middle of the (big) comma's head makes its EYE, a
// light hole that tells the head from the tail on a closed shape too.
//
// The motif that is handed back is ONE connected blob of every orbit of blobs (their copies under the group are all
// the others), as closed polygons on the exact level line (marching squares on a grid of the lattice, then every
// vertex moved onto u = c by Newton steps and the line re-sampled by its curvature); the eye is a hole of it.
//
// Everything is computed in the group's own frame, so a group that is turned, scaled and shifted gets the same blobs
// turned, scaled and shifted: origin = a rotation centre of the group (the fixed point of its first rotation among
// `reps`), or the foot of `center` on the first mirror or glide axis, or `center`; x axis along e1; unit of length =
// the tile size sqrt(domainArea). The stroke of each group is a row of dimensionless numbers in that frame (STROKES).
//
// One stroke per tile, so one big comma per tile, in 13 groups. In the four whose tile is a narrow triangle with a
// mirror or a corner of many copies on every side (3*3, *333, *442, *632) one mark per tile fused with its mirror
// images into bones, daggers and stars; there a row holds a big comma and one or two small ones per tile, every one
// clear of the mirrors (the polish of 14 Nov 2026, the judges' ask: "fill the chamber with two smaller commas as
// paisley does").

import { classify } from '../groups.js';

export const meta = { key: 'soft', label: 'Soft commas', hint: 'big soft commas with an eye, half the paper dark' };

// ---- the brush -------------------------------------------------------------------------------------------------
/** sigma of a bump / the radius of the stroke where it sits: how soft the brush is. */
export const SOFT = 0.55;
/** Bumps follow one another at this many sigmas along the spine. */
const STEP = 0.6;
/** A bump ends at this many sigmas (it is lowered so that it ends at zero: u is continuous). */
const KCUT = 3.6, ECUT = Math.exp(-KCUT * KCUT / 2), ENORM = 1 / (1 - ECUT);
/** The radius of the tail's tip, in tile sizes. */
const R_TIP = 0.03;
/** The share of the plane that is dark, unless a stroke says otherwise. */
export const COVER = 0.5;
/** The grid u is sampled on: its step in tile sizes. */
const H_GRID = 0.016;
/**
 * The EYE in the head of the (big) comma: a light hole of about this radius (tile sizes) where u is highest in the
 * head (eyeBead), made by a deep narrow dip of u there (depth EYE_DEPTH bump amplitudes, sigma = radius / EYE_SIGMAS).
 * 0: no eye. A row may say `eye: 0` (its first stroke) to have none. (The judges of 14 Nov 2026: bigcomma's eye was the
 * best landmark of the round on the closed shapes.)
 */
export const EYE = 0.065;
const EYE_DEPTH = 4.5, EYE_SIGMAS = 1.8;

/**
 * The stroke of a group, in its own frame (lengths in tile sizes):
 *   p           the spine, from the head end to the tail's tip: the control points [x0, y0, x1, y1, ...] of a clamped
 *               cubic B-spline (four points: a cubic Bezier curve; six: a curve that can go once round a tile)
 *   r0, rh, th  the radius at the head end, the largest radius, and where along the spine (0..1 of its length) that is
 *   q           how the radius falls from there to the tip: 1 - w^q  (1: a straight taper, 2: fat for longer)
 *   rt          the radius of the tail's tip (default R_TIP): larger for a blunt tip where many tails meet (3*3, *632)
 *   lobes       round bumps beside the spine, [[x, y, radius], ...]: where a blob must reach into a third corner
 *   cover       the dark share (default COVER)
 *   eye         the radius of the eye in the head (default EYE; 0: none); read from the first stroke only
 * A row may be an ARRAY of strokes (the big comma first): k is their sum, and every one of them gives a blob of its own
 * per tile.
 */
export const STROKES = {
  default: { p: [0.3, 0.3, 0.7, 0.2, 0.9, 0.6, 0.6, 0.9], r0: 0.2, rh: 0.2, th: 0, q: 1 },
  // TABLE-BEGIN (written by lab/settable.mjs and polish/setrows.mjs from searches: lab/search.mjs, polish/search2.mjs,
  // polish/psearch.mjs; the rows of 14 Nov 2026 are the polish after the judges, NOTES.md "Polish (14 Nov)")
  o: { p: [-0.065, -0.455, -0.03, -0.484, -0.441, 0.196, 0.376, 0.686], r0: 0.228, rh: 0.228, th: 0, q: 1.015 },
  '2222': { p: [0.448, 0.624, -0.026, 0.686, 0.01, -0.66, 0.869, 0.198], r0: 0.276, rh: 0.276, th: 0, q: 0.8 },
  // ** (14 Nov): a comma whose head sits low and whose tail rises and curls over (bare 0.464 -> 0.436)
  '**': { p: [0.3791, -0.4097, -0.1191, 0.9005, 0.5263, 0.7942, 0.6414, 0.1543], r0: 0.2264, rh: 0.2264, th: 0, q: 0.8013 },
  xx: { p: [-0.023, 0.386, 0.43, 0.016, -0.18, -0.592, -0.343, -0.642], r0: 0.265, rh: 0.265, th: 0, q: 1.045 },
  // *x (14 Nov): the strip of 13 Nov (1.2 x 0.6) holds ONE comma per tile, a boteh whose tail curls back clear of the
  // mirror; the glide turns it over in the next tile (it had two near-copies per tile, which read at half the period)
  '*x': { p: [-0.5749, 0.1012, 0.1529, 0.3233, 0.3689, 0.3286, 0.366, 0.729, -0.1892, 0.6293], r0: 0.3065, rh: 0.3065, th: 0, q: 0.8659 },
  '333': { p: [0.766, 0.11, 0.678, -0.721, 2.106, 0.424, 1.559, -0.118], r0: 0.336, rh: 0.336, th: 0, q: 0.897 },
  '22x': { p: [0.507, 1.392, 0.389, 1.749, -0.258, 0.36, 0.722, 0.79], r0: 0.25, rh: 0.25, th: 0, q: 0.8 },
  // 22* (second pair of eyes, 13 Nov 2026): the comma of 22x, seated in the half-strip between two mirrors (0.90 x 1.11,
  // a 2-fold centre in the middle of either side) instead of in the page's 3.3 : 1 Pillowcase, where it was a swoosh;
  // 14 Nov: the same comma mended by searches on proto's own measure (bare 0.480 -> 0.442)
  '22*': { p: [0.5047, 1.3516, 0.1371, 1.1664, -0.2719, 0.4032, 0.827, 0.7762], r0: 0.2071, rh: 0.2071, th: 0, q: 0.8 },
  // *2222 (14 Nov): the C-hook, fatter where the four copies meet at a mirror corner (bare 0.480 -> 0.404)
  '*2222': { p: [0.2639, 0.6139, 0.9892, 0.771, 0.9851, 0.4824, 1.0176, 0.0445, 0.4526, 0.1295, 0.1051, 0.1424], r0: 0.1843, rh: 0.1843, th: 0, q: 0.8 },
  // 2*22 (second pair of eyes, 13 Nov 2026): a fat curled comma seated in the half of a mirror rectangle cut across its
  // long side (0.82 x 1.22, the 2-fold centre in the middle of the cut) instead of in the page's 2.7 : 1 Pocket, where it
  // was a swoosh (r6/mk2s22.mjs, then lab/search.mjs --local); 14 Nov: mended by a search on a fine grid (bare 0.505 ->
  // 0.455; proto's own measure would not go lower without the copies meeting at the mirror corners)
  '2*22': { p: [0.8511, 0.4841, 0.7021, 0.3363, -0.1845, -0.0776, 0.7881, -0.2626], r0: 0.2458, rh: 0.2458, th: 0, q: 0.8 },
  '442': { p: [0.22, 0.71, 1.343, 1.1, 0.651, -0.106, 0.082, 0.096], r0: 0.193, rh: 0.193, th: 0, q: 1.283 },
  // 632 (14 Nov): six commas whirl round each 6-fold centre, bodies (not tail tips) next to it: no starburst
  '632': { p: [1.4988, 0.3119, 1.5824, 0.7865, 2.5291, 0.4963, 2.5607, 0.1892], r0: 0.2238, rh: 0.2238, th: 0, q: 1.2306, rt: 0.04 },
  // 3*3, *333, *442, *632 (14 Nov): a big comma (its eye in its head) and one or two small ones per tile, all clear of
  // the mirrors, in place of one mark that fused with its mirror images into bones, crosses and suns
  '3*3': [
    { p: [1.2535, 0.4556, 0.844, 0.1777, 1.23, 0.2158, 0.1375, 0.096], r0: 0.206, rh: 0.206, th: 0, q: 1.4223, rt: 0.04 },
    { p: [2.0339, 0.1608, 2.0086, 0.3823, 1.8382, 0.2518, 1.2534, 0.0848], r0: 0.1048, rh: 0.1285, th: 0.424, q: 1.0625, rt: 0.04 },
  ],
  '*333': [
    { p: [0.8356, -0.1255, 1.1558, 0.068, 1.1055, -0.2305, 1.2214, -0.5934], r0: 0.224, rh: 0.2415, th: 0.0343, q: 0.9777, rt: 0.045 },
    { p: [1.1639, 0.4981, 1.1529, 0.4356, 1.2574, 0.2386, 0.6244, 0.2746], r0: 0.1058, rh: 0.1058, th: 0, q: 0.8, rt: 0.045 },
    { p: [0.2068, 0.0072, 0.2517, -0.1286, 0.4251, 0.0017, 0.581, 0.1314], r0: 0.0575, rh: 0.0575, th: 0.1382, q: 1.4571, rt: 0.045 },
  ],
  // 4*2 (second pair of eyes, 13 Nov 2026): the comma of 442, seated in the square between the 4-fold centre and a *2
  // corner (side 1, mirrors on two sides), so four commas swirl round each 4-fold centre (r6/mk42.mjs); 14 Nov: a search
  // from it that keeps the swirl and reaches into the *2 corners (bare 0.500 -> 0.399)
  '4*2': { p: [0.4038, 1.4367, 1.101, 0.475, 0.9622, 0.6656, 1.5137, 1.2012], r0: 0.1418, rh: 0.1418, th: 0.0287, q: 0.8121 },
  '*442': [
    { p: [0.2856, 1.1236, 0.5529, 0.8751, 0.8232, 1.1117, 1.2208, 1.3507], r0: 0.2065, rh: 0.2376, th: 0.0369, q: 1.0109, rt: 0.045 },
    { p: [0.0942, 0.2357, 0.1054, 0.5515, 0.0079, 0.7132, 0.4499, 0.5743], r0: 0.0566, rh: 0.0656, th: 0.0952, q: 1.3503, rt: 0.045 },
  ],
  '*632': [
    { p: [-0.9742, -1.2239, -1.0989, -0.8544, -0.9637, -0.9434, -0.1611, -0.1584], r0: 0.1805, rh: 0.2169, th: 0.142, q: 0.8, rt: 0.04 },
    { p: [-1.5682, -1.0558, -1.4178, -0.9062, -1.3436, -1.0843, -1.2491, -1.3515], r0: 0.0833, rh: 0.0833, th: 0.0382, q: 0.8973, rt: 0.04 },
  ],
  // TABLE-END
};

/**
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

/** The first stroke of a group's entry (an entry is one stroke, or an array of strokes: one blob of each per tile). */
export const firstStroke = (k) => (Array.isArray(k) ? k[0] : k);

/** The bumps of a stroke (or of every stroke of an array): Float64Array [x, y, sigma, amplitude] per bump, in the frame. */
export function strokeBeads(k, soft) {
  if (Array.isArray(k)) {
    const parts = k.map((s) => strokeBeads(s, soft)), out = new Float64Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  soft = soft ?? k.soft ?? SOFT;
  const { r0 = k.rh, rh, th = 0, q = 1, rt = R_TIP } = k;
  const amp = Math.exp(1 / (2 * soft * soft));             // a long even stroke has u = 1 at its radius
  const S = spine(k), M = S.n, len = S.len;
  const radius = (t) => {
    if (t < th) { const z = t / th, f0 = (r0 - rt) / (rh - rt); return rt + (rh - rt) * (f0 + (1 - f0) * z * z * (3 - 2 * z)); }
    const w = Math.min(1, (t - th) / (1 - th));
    return rt + (rh - rt) * (1 - Math.pow(w, q));
  };
  const out = [];
  out.push(S.x[0], S.y[0], soft * radius(0), 0.8 * amp);   // the round end of the head
  const a = amp * STEP / Math.sqrt(2 * Math.PI);
  for (let t = 0; t <= 1;) {
    const sg = soft * radius(t), f = t * M, m = Math.min(M - 1, Math.floor(f)), fr = f - m;
    out.push(S.x[m] + fr * (S.x[m + 1] - S.x[m]), S.y[m] + fr * (S.y[m + 1] - S.y[m]), sg, a);
    t += (STEP * sg) / len;
  }
  for (const [x, y, r] of k.lobes || []) out.push(x, y, soft * r, amp);     // a round bump beside the spine: alone, a disc of radius r
  return Float64Array.from(out);
}

// ---- the group's own frame -----------------------------------------------------------------------------------------
/** { s, ox, oy, ux, uy, E1, E2, reps }: frame point (p, q) = world point o + s (p u + q u_perp); lattice and reps in the frame. */
export function frameOf(group) {
  const e1 = group.e1, e2 = group.e2, s = Math.sqrt(group.domainArea), L1 = Math.hypot(e1[0], e1[1]);
  const ux = e1[0] / L1, uy = e1[1] / L1;
  let o = null;
  for (const r of group.reps) {
    if (r.a * r.d - r.b * r.c > 0 && Math.hypot(r.a - 1, r.b) > 1e-6) {       // a rotation: its centre
      const m00 = 1 - r.a, m01 = -r.b, m10 = -r.c, m11 = 1 - r.d, dd = m00 * m11 - m01 * m10;
      o = [(r.tx * m11 - m01 * r.ty) / dd, (m00 * r.ty - m10 * r.tx) / dd];
      break;
    }
  }
  if (!o) {
    const c = group.center || [(e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2];
    const r = group.reps.find((g) => g.a * g.d - g.b * g.c < 0);
    if (r) {                                                                  // a mirror or a glide: the foot of the centre on its axis
      const k = classify(r), t = (c[0] - k.point[0]) * k.dir[0] + (c[1] - k.point[1]) * k.dir[1];
      o = [k.point[0] + t * k.dir[0], k.point[1] + t * k.dir[1]];
    } else o = [c[0], c[1]];
  }
  const toF = (X, Y, out = [0, 0]) => { const dx = X - o[0], dy = Y - o[1]; out[0] = (dx * ux + dy * uy) / s; out[1] = (-dx * uy + dy * ux) / s; return out; };
  const toW = (p, q, out = [0, 0]) => { out[0] = o[0] + s * (p * ux - q * uy); out[1] = o[1] + s * (p * uy + q * ux); return out; };
  const reps = group.reps.map((r) => {
    // linear part U^T A U, U = [u u_perp]; translation U^T (A o + t - o) / s
    const a = r.a * ux + r.b * uy, c = r.c * ux + r.d * uy;                    // A u
    const b = -r.a * uy + r.b * ux, d = -r.c * uy + r.d * ux;                  // A u_perp
    const wx = r.a * o[0] + r.b * o[1] + r.tx - o[0], wy = r.c * o[0] + r.d * o[1] + r.ty - o[1];
    return { a: ux * a + uy * c, b: ux * b + uy * d, c: -uy * a + ux * c, d: -uy * b + ux * d, tx: (wx * ux + wy * uy) / s, ty: (-wx * uy + wy * ux) / s };
  });
  return { s, ox: o[0], oy: o[1], ux, uy, E1: [L1 / s, 0], E2: [(e2[0] * ux + e2[1] * uy) / s, (-e2[0] * uy + e2[1] * ux) / s], reps, toF, toW };
}

// ---- u on a grid of the lattice (a torus) ----------------------------------------------------------------------------
/**
 * u at the points i a1 + j a2 (a1 = E1 / N1, a2 = E2 / N2) of one lattice cell: { U, N1, N2, a1, a2 }. `into`: a U of
 * the same grid to add the beads to (the eye's dip, added to the comma's field without computing that again).
 */
export function fieldOnTorus(F, beads, h = H_GRID, into = null) {
  const { E1, E2, reps } = F;
  const N1 = Math.max(8, Math.ceil(Math.hypot(E1[0], E1[1]) / h)), N2 = Math.max(8, Math.ceil(Math.hypot(E2[0], E2[1]) / h));
  const a1x = E1[0] / N1, a1y = E1[1] / N1, a2x = E2[0] / N2, a2y = E2[1] / N2;
  const det = E1[0] * E2[1] - E1[1] * E2[0];
  const k1 = (N1 * Math.hypot(E2[0], E2[1])) / Math.abs(det), k2 = (N2 * Math.hypot(E1[0], E1[1])) / Math.abs(det);
  const U = into && into.length === N1 * N2 ? into : new Float64Array(N1 * N2);
  for (const r of reps) {
    for (let b = 0; b < beads.length; b += 4) {
      const bx = beads[b], by = beads[b + 1], sg = beads[b + 2], amp = beads[b + 3] * ENORM;
      const x = r.a * bx + r.b * by + r.tx, y = r.c * bx + r.d * by + r.ty;
      const rad = KCUT * sg, rad2 = rad * rad, inv = -1 / (2 * sg * sg);
      const ci = (N1 * (x * E2[1] - y * E2[0])) / det, cj = (N2 * (E1[0] * y - E1[1] * x)) / det;
      const i0 = Math.ceil(ci - k1 * rad), i1 = Math.floor(ci + k1 * rad), j0 = Math.ceil(cj - k2 * rad), j1 = Math.floor(cj + k2 * rad);
      for (let j = j0; j <= j1; j++) {
        const row = (((j % N2) + N2) % N2) * N1, qx = j * a2x - x, qy = j * a2y - y;
        for (let i = i0; i <= i1; i++) {
          const dx = qx + i * a1x, dy = qy + i * a1y, d2 = dx * dx + dy * dy;
          if (d2 < rad2) U[row + (((i % N1) + N1) % N1)] += amp * (Math.exp(d2 * inv) - ECUT);
        }
      }
    }
  }
  return { U, N1, N2, a1x, a1y, a2x, a2y, det };
}

/** The level above which the share `cover` of the samples lies. */
export function levelFor(U, cover) {
  const srt = Float64Array.from(U).sort();
  const k = Math.min(srt.length - 1, Math.max(0, Math.round((1 - cover) * srt.length)));
  return k > 0 ? (srt[k] + srt[k - 1]) / 2 : srt[0];
}

/**
 * The blobs of { u > c } on the torus: union-find over the dark samples, each with its place relative to the root of
 * its blob, so a blob that runs round the torus (an endless band) is noticed.
 * { par, dx, dy, find, comps: [{ root, area, peak, wraps, stab, orbit }] } (comps by falling area).
 */
export function labelTorus(fld, c, F) {
  const { U, N1, N2 } = fld, n = N1 * N2;
  const par = new Int32Array(n).fill(-1), dx = new Int32Array(n), dy = new Int32Array(n);
  for (let p = 0; p < n; p++) if (U[p] > c) par[p] = p;
  const find = (p) => {
    let r = p, tx = 0, ty = 0;
    while (par[r] !== r) { tx += dx[r]; ty += dy[r]; r = par[r]; }
    let q = p;
    while (q !== r && par[q] !== r) { const nq = par[q], ox = dx[q], oy = dy[q]; dx[q] = tx; dy[q] = ty; par[q] = r; tx -= ox; ty -= oy; q = nq; }
    return r;
  };
  const wrapAt = [];
  const union = (p, q, sx, sy) => {                         // pos(q) - pos(p) = (sx, sy)
    const rp = find(p), rq = find(q);
    if (rp === rq) { if (dx[q] - dx[p] !== sx || dy[q] - dy[p] !== sy) wrapAt.push(p); return; }
    par[rq] = rp; dx[rq] = sx - dx[q] + dx[p]; dy[rq] = sy - dy[q] + dy[p];
  };
  for (let j = 0; j < N2; j++) for (let i = 0; i < N1; i++) {
    const p = j * N1 + i;
    if (par[p] < 0) continue;
    const q = j * N1 + ((i + 1) % N1); if (par[q] >= 0) union(p, q, 1, 0);
    const w = ((j + 1) % N2) * N1 + i; if (par[w] >= 0) union(p, w, 0, 1);
  }
  const area = new Map(), peak = new Map();
  for (let p = 0; p < n; p++) {
    if (par[p] < 0) continue;
    const r = find(p);
    area.set(r, (area.get(r) || 0) + 1);
    const k = peak.get(r);
    if (k === undefined || U[p] > U[k]) peak.set(r, p);
  }
  const wraps = new Set(wrapAt.map((p) => find(p)));
  const comps = [...area.keys()].map((root) => ({ root, area: area.get(root), peak: peak.get(root), wraps: wraps.has(root), stab: 1, orbit: -1 }));
  comps.sort((p, q) => q.area - p.area || p.root - q.root);
  const L = { par, dx, dy, find, comps, byRoot: new Map(comps.map((k) => [k.root, k])) };
  if (F) orbits(fld, L, F);
  return L;
}

/** The sample nearest a frame point, on the torus. */
function sampleAt(fld, F, x, y) {
  const { N1, N2, det } = fld, { E1, E2 } = F;
  const i = Math.round((N1 * (x * E2[1] - y * E2[0])) / det), j = Math.round((N2 * (E1[0] * y - E1[1] * x)) / det);
  return (((j % N2) + N2) % N2) * N1 + (((i % N1) + N1) % N1);
}

/** Which blobs are copies of which (comp.orbit), and how many elements keep a blob as it is (comp.stab; 1 = an asymmetric blob). */
function orbits(fld, L, F) {
  const { N1, a1x, a1y, a2x, a2y } = fld;
  let n = 0;
  for (const k of L.comps) {
    const i = k.peak % N1, j = (k.peak - i) / N1, x = i * a1x + j * a2x, y = i * a1y + j * a2y;
    let stab = 0;
    for (const r of F.reps) {
      const p = sampleAt(fld, F, r.a * x + r.b * y + r.tx, r.c * x + r.d * y + r.ty);
      if (L.par[p] < 0) continue;
      const other = L.byRoot.get(L.find(p));
      if (other === k) stab++;
      else if (k.orbit < 0 && other.orbit >= 0) k.orbit = other.orbit;
    }
    k.stab = Math.max(1, stab);
    if (k.orbit < 0) k.orbit = n++;
  }
  L.orbits = n;
  return L;
}

// ---- the outline of one blob ------------------------------------------------------------------------------------------
/**
 * The loops round one blob, in grid coordinates: [{ pts: [i, j, ...], area }], the largest first. The blob is the one of
 * root `root`; of its lattice translates, the one whose sample `at` sits at the grid place (I0, J0).
 */
function traceBlob(fld, L, root, c, at, I0, J0) {
  const { U, N1, N2 } = fld, { par, dx, dy, find } = L;
  find(at);
  const ri = I0 - dx[at], rj = J0 - dy[at];                 // where this copy's root sits
  const wrap = (I, J) => (((J % N2) + N2) % N2) * N1 + (((I % N1) + N1) % N1);
  const isIn = (I, J) => { const p = wrap(I, J); return par[p] >= 0 && find(p) === root && ri + dx[p] === I && rj + dy[p] === J; };
  const OFF = 1 << 15, BIG = 1 << 17;
  const key = (type, I, J) => ((I + OFF) * BIG + (J + OFF)) * 2 + type;       // type 0: the edge (I,J)-(I+1,J); 1: (I,J)-(I,J+1)
  const cross = (type, I, J) => {
    const I2 = type ? I : I + 1, J2 = type ? J + 1 : J;
    const ua = U[wrap(I, J)], ub = U[wrap(I2, J2)];
    let t = (c - ua) / (ub - ua);
    if (!(t > 0.02 && t < 0.98)) t = Math.min(0.98, Math.max(0.02, Number.isFinite(t) ? t : 0.5));
    return [I + t * (I2 - I), J + t * (J2 - J)];
  };
  // segments of every cell that has a corner in the blob: from edge -> to edge, the blob on the left
  const next = new Map(), cells = new Set();
  // the edges of the cell (I, J): 0 bottom, 1 right, 2 top, 3 left
  const edgeKey = (I, J, e) => (e === 0 ? key(0, I, J) : e === 1 ? key(1, I + 1, J) : e === 2 ? key(0, I, J + 1) : key(1, I, J));
  const SEG = [[], [[0, 3]], [[1, 0]], [[1, 3]], [[2, 1]], [[0, 3], [2, 1]], [[2, 0]], [[2, 3]], [[3, 2]], [[0, 2]], [[1, 0], [3, 2]], [[1, 2]], [[3, 1]], [[0, 1]], [[3, 0]], []];
  const n = N1 * N2;
  for (let p = 0; p < n; p++) {
    if (par[p] < 0 || find(p) !== root) continue;
    const I0 = ri + dx[p], J0 = rj + dy[p];
    for (let cj = J0 - 1; cj <= J0; cj++) for (let ci = I0 - 1; ci <= I0; ci++) {
      const ck = (ci + OFF) * BIG + (cj + OFF);
      if (cells.has(ck)) continue;
      cells.add(ck);
      const bits = (isIn(ci, cj) ? 1 : 0) | (isIn(ci + 1, cj) ? 2 : 0) | (isIn(ci + 1, cj + 1) ? 4 : 0) | (isIn(ci, cj + 1) ? 8 : 0);
      for (const [e0, e1] of SEG[bits]) next.set(edgeKey(ci, cj, e0), edgeKey(ci, cj, e1));
    }
  }
  const point = (k) => { const type = k % 2, rest = (k - type) / 2, J = (rest % BIG) - OFF, I = (rest - (J + OFF)) / BIG - OFF; return cross(type, I, J); };
  const loops = [];
  for (const start of [...next.keys()]) {
    if (!next.has(start)) continue;
    const pts = [];
    let k = start, guard = 0;
    while (next.has(k) && guard++ < 1e6) { const p = point(k); pts.push(p[0], p[1]); const nk = next.get(k); next.delete(k); k = nk; }
    if (pts.length < 6) continue;
    let A = 0;
    for (let i = 0, m = pts.length / 2; i < m; i++) { const j = (i + 1) % m; A += pts[2 * i] * pts[2 * j + 1] - pts[2 * j] * pts[2 * i + 1]; }
    loops.push({ pts, area: A / 2 });
  }
  loops.sort((p, q) => Math.abs(q.area) - Math.abs(p.area));
  return loops;
}

/** Every copy of every bump that reaches the box [x0, y0, x1, y1] of the frame, in buckets: evaluate u and its gradient. */
function exactField(F, beads, box) {
  const { E1, E2, reps } = F, det = E1[0] * E2[1] - E1[1] * E2[0];
  const g = 0.12, x0 = box[0], y0 = box[1], nx = Math.max(1, Math.ceil((box[2] - x0) / g)), ny = Math.max(1, Math.ceil((box[3] - y0) / g));
  const buckets = Array.from({ length: nx * ny }, () => []);
  const list = [];
  for (const r of reps) for (let b = 0; b < beads.length; b += 4) {
    const bx = beads[b], by = beads[b + 1], sg = beads[b + 2], amp = beads[b + 3] * ENORM, rad = KCUT * sg;
    const x = r.a * bx + r.b * by + r.tx, y = r.c * bx + r.d * by + r.ty;
    // lattice translates m E1 + n E2 that bring it within `rad` of the box: the box's corners in lattice coordinates
    let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (const [cx, cy] of [[box[0] - rad, box[1] - rad], [box[2] + rad, box[1] - rad], [box[2] + rad, box[3] + rad], [box[0] - rad, box[3] + rad]]) {
      const u = ((cx - x) * E2[1] - (cy - y) * E2[0]) / det, v = (E1[0] * (cy - y) - E1[1] * (cx - x)) / det;
      s0 = Math.min(s0, u); s1 = Math.max(s1, u); t0 = Math.min(t0, v); t1 = Math.max(t1, v);
    }
    for (let m = Math.ceil(s0); m <= Math.floor(s1); m++) for (let n = Math.ceil(t0); n <= Math.floor(t1); n++) {
      const px = x + m * E1[0] + n * E2[0], py = y + m * E1[1] + n * E2[1];
      if (px < box[0] - rad || px > box[2] + rad || py < box[1] - rad || py > box[3] + rad) continue;
      const id = list.length / 4;
      list.push(px, py, sg, amp);
      const bi0 = Math.max(0, Math.floor((px - rad - x0) / g)), bi1 = Math.min(nx - 1, Math.floor((px + rad - x0) / g));
      const bj0 = Math.max(0, Math.floor((py - rad - y0) / g)), bj1 = Math.min(ny - 1, Math.floor((py + rad - y0) / g));
      for (let bj = bj0; bj <= bj1; bj++) for (let bi = bi0; bi <= bi1; bi++) buckets[bj * nx + bi].push(id);
    }
  }
  const out = [0, 0, 0];
  /** [u, du/dx, du/dy] at a frame point of the box. */
  return (x, y) => {
    const bi = Math.min(nx - 1, Math.max(0, Math.floor((x - x0) / g))), bj = Math.min(ny - 1, Math.max(0, Math.floor((y - y0) / g)));
    let u = 0, gx = 0, gy = 0;
    for (const id of buckets[bj * nx + bi]) {
      const dx = x - list[4 * id], dy = y - list[4 * id + 1], sg = list[4 * id + 2], d2 = dx * dx + dy * dy;
      if (d2 >= KCUT * KCUT * sg * sg) continue;
      const e = list[4 * id + 3] * Math.exp(-d2 / (2 * sg * sg));
      u += e - list[4 * id + 3] * ECUT; gx -= (e * dx) / (sg * sg); gy -= (e * dy) / (sg * sg);
    }
    out[0] = u; out[1] = gx; out[2] = gy;
    return out;
  };
}

/** Segments of the outline: no longer than SEG_MAX, turning at most TURN_MAX radians each, no shorter than SEG_MIN (tile sizes). */
const SEG_MAX = 0.022, SEG_MIN = 0.004, TURN_MAX = 0.14;
/** All the vertices of a motif together: at most this many (the kit's limit is 2400). */
const MAX_POINTS = 2000;

/** A loop (frame coordinates, flat) put ON the level line u = c and re-sampled by its curvature (`coarse` > 1: fewer points). */
function refineLoop(pts, uAt, c, h, coarse = 1) {
  const onto = (x, y, out) => {
    for (let it = 0; it < 3; it++) {
      const f = uAt(x, y), g2 = f[1] * f[1] + f[2] * f[2];
      if (!(g2 > 1e-12)) break;
      let k = (c - f[0]) / g2, sx = k * f[1], sy = k * f[2];
      const sl = Math.hypot(sx, sy);
      if (sl > 0.6 * h) { sx *= (0.6 * h) / sl; sy *= (0.6 * h) / sl; }
      x += sx; y += sy;
      if (sl < 1e-7) break;
    }
    out[0] = x; out[1] = y;
    return out;
  };
  const m = pts.length / 2, P = new Float64Array(2 * m), o = [0, 0];
  for (let i = 0; i < m; i++) { onto(pts[2 * i], pts[2 * i + 1], o); P[2 * i] = o[0]; P[2 * i + 1] = o[1]; }
  // the wanted step at every vertex, from the turning there
  const seg = new Float64Array(m), want = new Float64Array(m);
  for (let i = 0; i < m; i++) { const j = (i + 1) % m; seg[i] = Math.hypot(P[2 * j] - P[2 * i], P[2 * j + 1] - P[2 * i + 1]); }
  const curv = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const a = (i + m - 1) % m, b = (i + 1) % m;
    const ax = P[2 * i] - P[2 * a], ay = P[2 * i + 1] - P[2 * a + 1], bx = P[2 * b] - P[2 * i], by = P[2 * b + 1] - P[2 * i + 1];
    const turn = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    curv[i] = turn / Math.max(1e-9, (seg[a] + seg[i]) / 2);
  }
  for (let i = 0; i < m; i++) {                               // the largest curvature within two vertices: tips are sharp and short
    let k = 0;
    for (let d = -2; d <= 2; d++) k = Math.max(k, curv[(i + d + m) % m]);
    want[i] = coarse * Math.min(SEG_MAX, Math.max(SEG_MIN, TURN_MAX / Math.max(1e-9, k)));
  }
  let total = 0;
  for (let i = 0; i < m; i++) total += (seg[i] * 2) / (want[i] + want[(i + 1) % m]);
  const n = Math.max(8, Math.round(total)), unit = total / n, out = [];
  let acc = 0, nextAt = 0, count = 0;
  for (let i = 0; i < m && count < n; i++) {
    const j = (i + 1) % m, w = (seg[i] * 2) / (want[i] + want[j]);
    while (nextAt <= acc + w + 1e-12 && count < n) {
      const f = w > 0 ? Math.min(1, Math.max(0, (nextAt - acc) / w)) : 0;
      onto(P[2 * i] + f * (P[2 * j] - P[2 * i]), P[2 * i + 1] + f * (P[2 * j + 1] - P[2 * i + 1]), o);
      out.push([o[0], o[1]]);
      count++; nextAt = count * unit;
    }
    acc += w;
  }
  return out;
}

// ---- the whole thing ---------------------------------------------------------------------------------------------------
/**
 * The blobs of a stroke on a group: the field, its level, the blobs and which of them are copies of which.
 * { F, beads, fld, c, cover, L, ok }: ok = every blob is bounded (the lab and find() both start here).
 */
export function solve(group, stroke, { h = H_GRID, cover, settle = true, extra = null, base = null } = {}) {
  // base: an earlier solve of the same stroke on the same grid; then only the `extra` beads are added to its field
  const F = base ? base.F : frameOf(group), own = base ? base.beads : strokeBeads(stroke);
  const beads = extra ? Float64Array.from([...own, ...extra]) : own;
  const fld = base && extra ? fieldOnTorus(F, Float64Array.from(extra), h, Float64Array.from(base.fld.U)) : fieldOnTorus(F, beads, h);
  const srt = Float64Array.from(fld.U).sort(), n = srt.length;
  const levelAt = (cv) => { const k = Math.min(n - 1, Math.max(1, Math.round((1 - cv) * n))); return (srt[k] + srt[k - 1]) / 2; };
  let cv = cover ?? firstStroke(stroke).cover ?? COVER, c = levelAt(cv), L = labelTorus(fld, c, F);
  const bounded = (M) => M.comps.every((k) => !k.wraps);
  const wanted = cv;
  // a stroke whose blobs run into one another at the wanted share: less dark, until every blob is an island
  for (let guard = 0; settle && !bounded(L) && guard < 40 && cv > 0.1; guard++) { cv -= 0.01; c = levelAt(cv); L = labelTorus(fld, c, F); }
  return { F, beads, fld, c, cover: cv, wanted, L, levelAt, ok: bounded(L) };
}

/** Where the stroke is fattest: the home of its blob, in the frame. */
function homeOf(stroke) {
  stroke = firstStroke(stroke);
  const S = spine(stroke, 64), i = Math.round((stroke.th || 0) * S.n);
  return [S.x[i], S.y[i]];
}

/**
 * One blob of every orbit of blobs: of all its copies (and their lattice translates) the one that comes nearest the
 * stroke's home (the one the home lies in, as a rule), so the choice does not hang on rounding.
 * [{ comp, at, I, J, d }] by distance from home: the sample `at` of the blob sits at the grid place (I, J).
 */
function pickBlobs(S, stroke) {
  const { F, fld, L } = S, { N1, N2, a1x, a1y, a2x, a2y, det } = fld, [hx, hy] = homeOf(stroke);
  const hi = (N1 * (hx * F.E2[1] - hy * F.E2[0])) / det, hj = (N2 * (F.E1[0] * hy - F.E1[1] * hx)) / det;
  const best = new Map();
  for (let p = 0, n = N1 * N2; p < n; p++) {
    if (L.par[p] < 0) continue;
    const k = L.byRoot.get(L.find(p)), i = p % N1, j = (p - i) / N1;
    const I = i + N1 * Math.round((hi - i) / N1), J = j + N2 * Math.round((hj - j) / N2);
    const d = Math.hypot((I - hi) * a1x + (J - hj) * a2x, (I - hi) * a1y + (J - hj) * a2y), b = best.get(k.orbit);
    if (!b || d < b.d) best.set(k.orbit, { comp: k, at: p, I, J, d });
  }
  return [...best.values()].sort((p, q) => p.d - q.d);
}

/**
 * The dip that makes the eye: [x, y, sigma, amplitude] in the frame, at the highest u within 1.6 head radii of the
 * head of the first stroke (the middle of the big comma's round head), or null: no eye, or no dark place there.
 */
function eyeBead(S, stroke) {
  const st = firstStroke(stroke), r = st.eye ?? EYE;
  if (!(r > 0) || !S.ok) return null;
  const { F, fld, L } = S, { U, N1, N2, a1x, a1y, a2x, a2y, det } = fld, [hx, hy] = homeOf(stroke);
  const R = 1.6 * Math.max(st.r0 ?? st.rh, st.rh);
  const ci = (N1 * (hx * F.E2[1] - hy * F.E2[0])) / det, cj = (N2 * (F.E1[0] * hy - F.E1[1] * hx)) / det;
  const k1 = (N1 * Math.hypot(F.E2[0], F.E2[1])) / Math.abs(det), k2 = (N2 * Math.hypot(F.E1[0], F.E1[1])) / Math.abs(det);
  let best = -Infinity, bx = 0, by = 0;
  for (let J = Math.ceil(cj - k2 * R); J <= Math.floor(cj + k2 * R); J++) for (let I = Math.ceil(ci - k1 * R); I <= Math.floor(ci + k1 * R); I++) {
    const x = I * a1x + J * a2x, y = I * a1y + J * a2y;
    if ((x - hx) * (x - hx) + (y - hy) * (y - hy) > R * R) continue;
    const p = (((J % N2) + N2) % N2) * N1 + (((I % N1) + N1) % N1);
    if (L.par[p] >= 0 && U[p] > best) { best = U[p]; bx = x; by = y; }
  }
  if (best === -Infinity) return null;
  const soft = st.soft ?? SOFT;
  return [bx, by, r / EYE_SIGMAS, -EYE_DEPTH * Math.exp(1 / (2 * soft * soft))];
}

export function find(group) {
  const stroke = STROKES[group.id] || STROKES.default;
  let S = solve(group, stroke);
  const eye = eyeBead(S, stroke);
  if (eye) S = solve(group, stroke, { extra: eye, base: S });
  const { F, fld, L, c } = S;
  let shapes = [], blobs = 0, sym = 0;
  if (S.ok) {
    const rings = [];
    for (const { comp: k, at, I, J } of pickBlobs(S, stroke)) {
      if (k.stab > 1) sym++;
      const loops = traceBlob(fld, L, k.root, c, at, I, J);
      if (!loops.length) continue;
      blobs++;
      // the blob's box in the frame, for the exact field
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const flat = loops.map((lp) => {
        const q = new Float64Array(lp.pts.length);
        for (let i = 0; i < lp.pts.length; i += 2) {
          const x = lp.pts[i] * fld.a1x + lp.pts[i + 1] * fld.a2x, y = lp.pts[i] * fld.a1y + lp.pts[i + 1] * fld.a2y;
          q[i] = x; q[i + 1] = y;
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
        return q;
      });
      const pad = 2 * H_GRID, uAt = exactField(F, S.beads, [x0 - pad, y0 - pad, x1 + pad, y1 + pad]);
      flat.forEach((q, li) => rings.push({ q, uAt, hole: li > 0 }));
    }
    // the outline, re-sampled; coarser if the vertices would be too many
    for (let coarse = 1; coarse < 6; coarse *= 1.5) {
      shapes = [];
      for (const r of rings) {
        const ring = refineLoop(r.q, r.uAt, c, H_GRID, coarse);
        if (ring.length >= 3) shapes.push({ pts: ring.map(([x, y]) => F.toW(x, y)), hole: r.hole });
      }
      if (shapes.reduce((n, sh) => n + sh.pts.length, 0) <= MAX_POINTS) break;
    }
  }
  return { shapes, info: { cover: S.cover, level: c, blobs, symmetric: sym, bounded: S.ok } };
}
