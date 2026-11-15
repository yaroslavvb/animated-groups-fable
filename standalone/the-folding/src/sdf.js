// sdf.js — a signed-distance texture of one lattice cell, baked from polygons (13 Nov 2026, the pattern round).
// Pure: no DOM, no WebGL, no imports. The 3D renderer prints a "shape print" (the orbit of a motif under the group,
// dev/patterns/kit.js) on the folding paper by sampling this texture: one fetch per pixel, and an edge stays crisp at
// any zoom, because a texel holds the DISTANCE to the outline, not coverage.
//
//   bakeSDF({ origin, e1, e2, size, range, polys })  -> Uint8Array(size * size)
//   sdfSample(data, size, s, t)                      -> 0..255, the shader's fetch: bilinear between texel centres, repeating
//   sdfDistance(value, range)                        -> world units, the shader's decode: (value - 128) / 127 * range
//
// The texture
//   covers the parallelogram origin + s e1 + t e2, 0 <= s, t < 1. Texel (i, j) = column i, row j, index j * size + i;
//   its CENTRE is the world point origin + ((i + 0.5) / size) e1 + ((j + 0.5) / size) e2. Row 0 comes first, which is
//   what texImage2D takes without a flip (R8, RED, UNSIGNED_BYTE; UNPACK_ALIGNMENT 1 unless size is a multiple of 4):
//   with LINEAR and REPEAT, texture(sdf, vec2(s, t)).r * 255.0 is sdfSample(data, size, s, t).
//   The lattice may be skew, its two vectors of different length, det(e1, e2) of either sign.
// The polygons
//   polys = [{ pts, hole }], pts = Float64Array [x0, y0, x1, y1, ...] or [[x, y], ...] in WORLD coordinates, closed
//   implicitly (no repeated last point). The CALLER lists every polygon (every copy of the motif) that covers a part
//   of the parallelogram or comes within `range` of it (src/shapes.js copiesIn, for the cell's box widened by the
//   range): nothing is wrapped here. Polygons may coincide (the same shape listed k times: a motif that sits on a
//   mirror or a rotation centre).
// The value
//   W(x) = the number of outer polygons that x is inside, minus the number of holes that x is inside. DARK <=> W(x) > 0.
//   sd(x) = the Euclidean distance in world units from x to the nearest outline (the nearest point of any edge of any
//           polygon), NEGATIVE where dark.
//   value = round(128 + 127 * clamp(sd / range, -1, 1)): 128 on an outline, 1 deep in the dark, 255 far out in the light
//   (0 never occurs). EXACT in the band |sd| <= range (the rounding to a byte is the only error), saturated outside it.
//   So `range` is also the resolution: one step of the byte is range / 127. A few texels is a good range.
//
// Input that breaks the rules (nothing crashes):
//   * The `hole` flag decides what a polygon counts, NOT the direction its points run in: an outer polygon listed
//     clockwise by mistake is as dark as one listed counter-clockwise, a hole listed counter-clockwise is a hole, and a
//     mirrored copy of a motif (a reflection reverses the direction) needs no re-ordering. This is W of kit.js.
//   * A point that repeats the one before it (also the first point repeated as the last) is dropped. A polygon without
//     area (fewer than three different points, or all of them on one line) is left out: it bounds nothing, so it is no
//     outline either.
//   * Polygons that overlap without coinciding: the tone is still W > 0, but their edges INSIDE the dark stay
//     outlines (sd is 0 on them), so the print shows a hairline where two copies overlap. kit.js measure().overlap
//     is the check that a design has none.
//   * A hole listed twice in an outer polygon listed once is still that hole (W = -1), but an island in it sinks
//     (W = 1 - 2 + 1 = 0): copies of a motif coincide as a whole, or not at all.
//   * A polygon that crosses itself: a part it winds around twice counts twice (kit.js, which counts crossings, would
//     count it not at all).
//   * Throws: a point that is no finite number, a size that is no integer in 1..MAX_SIZE, a range that is not a
//     positive length, e1 and e2 on one line.
// What a texture cannot hold: a part of the print thinner than about one texel. The bytes are right at the texel
//   centres, but the fetch between them no longer sees it: the needle point of a comma's tail ends a few texels early
//   (and may leave a speck). A stroke 1.5 texels wide keeps its tone all along its centre line (there is a test).
//
// How. Exact, and the cost follows the area of the band, not the number of edges an outline is chopped into:
//   sign      In texel space, row by row: an edge adds +1 or -1 at the first texel right of the place where it crosses
//             the row's centre line (the row index j with v0 <= j < v1, so a vertex ON a centre line counts once), and
//             the running sum along the row is W. Texel space is mirrored when det(e1, e2) < 0, and a polygon may run
//             either way: the crossings of a polygon are weighted by the sign of its area THERE, so "inside" counts
//             +1 for an outer polygon and -1 for a hole whatever the two orientations are.
//   distance  Every edge visits the texels of ONE rectangle, from -m0 to length + m1 along the edge and +-range across
//             it, with the exact point-to-segment distance, and a texel keeps its minimum. Why that is every texel
//             of the band: if the nearest outline point of x is INSIDE an edge, x is in that edge's own strip (m = 0).
//             If it is a VERTEX, x lies in the wedge between the two normals there, on the convex side; when the
//             outline turns by theta at the vertex, the half of the wedge next to an edge reaches at most
//             range * sin(theta / 2) past that edge's end: that is m. So a smooth outline cut into short edges costs
//             about 2 * range * length texel visits, not pi * range^2 for every edge.
//   The three loops are three small functions (crossings, strip, finish): the first bake of a page runs on code the
//   engine has not optimised yet, and small functions that are called per edge get there sooner than one long one
//   (measured: the first bake of a fresh process took half the time).
//   Measured 13 Nov 2026 (node 25, Intel i9-9880H of 2019, a busy machine), 6016 edges that cover 42 % of the cell,
//   range 8 texels: about 5 ms at size 512 and 9 ms at 1024 (range 32 texels: 24 ms; the same outline cut into
//   24064 edges: 12 ms); the first bake of a fresh process about 25 ms at 1024, 16 ms at 512. The page's comma on the
//   lattice cell of *632 (48 copies, 4416 edges): 6 ms at 1024. Half of a bake at 1024 is the last pass over the texels.

/** The largest texture side bakeSDF accepts (a guard against a size passed in the wrong unit, not a limit of the method). */
export const MAX_SIZE = 8192;

const SLIVER = 2e-12;       // a polygon whose area is under this share of its perimeter squared has no area

function pointsOf(P) {
  const src = P && (P.pts || P);
  if (!src || typeof src.length !== 'number') throw new TypeError('bakeSDF: a polygon is { pts: Float64Array | [[x, y], ...], hole }');
  return src;
}

/**
 * The sign. The edge (u0, v0) -> (u1, v1) of texel space (texel centres at the integers) adds s (a rising edge: -s)
 * at the first texel at or right of each place where it crosses the centre line of a row j, v0 <= j < v1 (falling:
 * v1 <= j < v0; a level edge crosses none). A crossing left of the row counts for all of it, one right of it for none.
 */
function crossings(wind, size, u0, v0, u1, v1, s) {
  let fa, fb;
  if (v0 < v1) { fa = Math.ceil(v0); fb = Math.ceil(v1) - 1; s = -s; } else { fa = Math.ceil(v1); fb = Math.ceil(v0) - 1; }
  if (fa < 0) fa = 0;
  if (fb > size - 1) fb = size - 1;
  if (!(fa <= fb)) return;
  const du = u1 - u0, dv = v1 - v0, jb = fb | 0;
  for (let r = fa | 0; r <= jb; r++) {
    const c = Math.ceil(u0 + ((r - v0) / dv) * du);
    if (c < size) wind[r * size + (c > 0 ? c | 0 : 0)] += s;
  }
}

/**
 * The distance. The texels of one edge's rectangle keep the smaller of what they hold and their squared distance to
 * the edge, in units of the range. The edge starts at (u0, v0) of texel space and is L long; at the texel (i, r)
 *     along the edge  t = cA (i - u0) + cB (r - v0)   (0 at its start, L at its end)
 *     across it       p = pA (i - u0) + pB (r - v0)
 * and the rectangle is LO <= t <= HI, -1 <= p <= 1. idet = 1 / (cA pB - cB pA) = 1 / det of the two texel steps;
 * flatA: a coefficient of i below it means the line runs along the rows.
 */
function strip(dist, size, u0, v0, cA, cB, pA, pB, LO, HI, L, idet, flatA) {
  const last = size - 1;
  // the rows it reaches:  r - v0 = (cA p - pA t) * idet  at its four corners. (No slack of their own: LO and HI carry
  // one, and a texel that a rounding drops at p = +-1 is one range away, where the byte is saturated anyway.)
  const kA = -pA * idet, kP = Math.abs(cA * idet), r0 = kA * LO, r1 = kA * HI;
  let fa = Math.ceil(v0 + (r0 < r1 ? r0 : r1) - kP), fb = Math.floor(v0 + (r0 < r1 ? r1 : r0) + kP);
  if (fa < 0) fa = 0;
  if (fb > last) fb = last;
  if (!(fa <= fb)) return;
  // the texels of row r:  max(aLo, pLo) + ... <= i <= min(aHi, pHi) + ..., each bound linear in r. A pair of sides
  // that runs (nearly) along the rows gives no bound on i: the rows above are its bound.
  let aLo = -Infinity, aHi = Infinity, aK = 0, pLo = -Infinity, pHi = Infinity, pK = 0;
  if (Math.abs(cA) > flatA) {
    const q = 1 / cA, base = u0 + cB * v0 * q, x1 = LO * q, x2 = HI * q;
    aK = -cB * q;
    if (x1 < x2) { aLo = base + x1; aHi = base + x2; } else { aLo = base + x2; aHi = base + x1; }
  }
  if (Math.abs(pA) > flatA) {
    const q = 1 / pA, base = u0 + pB * v0 * q;
    pK = -pB * q;
    if (q > 0) { pLo = base - q; pHi = base + q; } else { pLo = base + q; pHi = base - q; }
  }
  const T0 = -(cA * u0 + cB * v0), P0 = -(pA * u0 + pB * v0), jb = fb | 0;
  for (let r = fa | 0; r <= jb; r++) {
    let lo = aLo + aK * r, hi = aHi + aK * r;
    const l2 = pLo + pK * r, h2 = pHi + pK * r;
    if (l2 > lo) lo = l2;
    if (h2 < hi) hi = h2;
    if (lo < 0) lo = 0;
    if (hi > last) hi = last;
    if (!(lo <= hi)) continue;
    const i1 = Math.floor(hi) | 0, tr = T0 + cB * r, pr = P0 + pB * r;
    for (let i = Math.ceil(lo) | 0, idx = r * size + i; i <= i1; i++, idx++) {
      const t = tr + cA * i, pp = pr + pA * i;
      const over = t < 0 ? t : t > L ? t - L : 0;                        // how far past an end of the edge
      const d2 = pp * pp + over * over;
      if (d2 < dist[idx]) dist[idx] = d2;
    }
  }
}

/** The bytes: W by a running sum along each row, the distance from its square (1 = at the range or beyond). */
function finish(dist, wind, size) {
  const out = new Uint8Array(size * size);
  for (let j = 0, idx = 0; j < size; j++) {
    let w = 0;
    for (let i = 0; i < size; i++, idx++) {
      w += wind[idx];
      const d2 = dist[idx], lv = d2 < 1 ? 127 * Math.sqrt(d2) : 127;
      out[idx] = w > 0 ? 128.5 - lv : 128.5 + lv;                        // the store drops the fraction: round(128 -+ lv)
    }
  }
  return out;
}

/**
 * The signed-distance texture of the lattice cell origin + s e1 + t e2 (0 <= s, t < 1) for the polygons `polys`
 * (world coordinates; the caller lists every copy that covers a part of the cell or comes within `range` of it).
 * Returns a new Uint8Array(size * size): texel (i, j) at index j * size + i, 128 on an outline, below 128 in the dark.
 */
export function bakeSDF({ origin = [0, 0], e1, e2, size, range, polys } = {}) {
  if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE) throw new RangeError(`bakeSDF: size must be an integer from 1 to ${MAX_SIZE}`);
  if (!(range > 0) || range === Infinity) throw new RangeError('bakeSDF: range must be a positive length');
  if (!origin || !e1 || !e2) throw new TypeError('bakeSDF: origin, e1 and e2 are [x, y]');
  if (polys == null) polys = [];
  if (typeof polys.length !== 'number') throw new TypeError('bakeSDF: polys is a list of polygons');
  const ox = +origin[0], oy = +origin[1], e1x = +e1[0], e1y = +e1[1], e2x = +e2[0], e2y = +e2[1];
  const det = e1x * e2y - e1y * e2x;
  if (!(ox - ox === 0 && oy - oy === 0) || !(Math.abs(det) > 1e-12 * Math.hypot(e1x, e1y) * Math.hypot(e2x, e2y))) {
    throw new RangeError('bakeSDF: origin, e1 and e2 must be finite, e1 and e2 not on one line');
  }

  // world -> texel space, where the centre of texel (i, j) is the point (i, j):  u = m11 (x - ox) + m12 (y - oy) - 0.5
  const k0 = size / det;
  const m11 = e2y * k0, m12 = -e2x * k0, m21 = -e1y * k0, m22 = e1x * k0;
  // one texel step along a row (a) and from a row to the next (b), as world vectors in units of the range
  const q0 = 1 / (size * range);
  const ax = e1x * q0, ay = e1y * q0, bx = e2x * q0, by = e2y * q0;
  const idet = 1 / (ax * by - ay * bx);
  // The slack at the two ends of an edge's rectangle, in ranges: a ten-millionth of a texel (and of a range at least
  // 1e-12), far more than any rounding here. Without it a texel centre exactly on the normal through a vertex where the
  // outline runs straight on can fall, by the last bit, in neither of the two strips that meet there (there is a test).
  const tau = Math.max(1e-7 * Math.max(Math.hypot(ax, ay), Math.hypot(bx, by)), 1e-12);
  const flatA = 1e-9 * Math.hypot(ax, ay);

  const dist = new Float32Array(size * size).fill(1);     // (distance / range)^2, the minimum so far
  const wind = new Int16Array(size * size);               // the steps of W along each row, at the texels where it changes

  let cap = 0;
  for (let p = 0; p < polys.length; p++) {
    const src = pointsOf(polys[p]), c = typeof src[0] === 'number' ? src.length >> 1 : src.length;
    if (c > cap) cap = c;
  }
  // one polygon at a time: its points (world), their texel coordinates, the edges' unit vectors and lengths (in
  // ranges), and at every vertex half the chord between the two unit vectors that meet there = sin(turn / 2)
  const X = new Float64Array(cap), Y = new Float64Array(cap), U = new Float64Array(cap), V = new Float64Array(cap);
  const DX = new Float64Array(cap), DY = new Float64Array(cap), LN = new Float64Array(cap), HS = new Float64Array(cap);

  for (let p = 0; p < polys.length; p++) {
    const P = polys[p], src = pointsOf(P), flat = typeof src[0] === 'number';
    if (flat && (src.length & 1)) throw new TypeError('bakeSDF: a flat list of points has an odd length');
    const count = flat ? src.length >> 1 : src.length;
    let n = 0;
    for (let i = 0; i < count; i++) {
      let x, y;
      if (flat) { x = +src[2 * i]; y = +src[2 * i + 1]; } else { const pt = src[i]; x = pt ? +pt[0] : NaN; y = pt ? +pt[1] : NaN; }
      if (!(x - x === 0 && y - y === 0)) throw new TypeError('bakeSDF: a polygon has a point that is not a finite number');
      if (n > 0 && x === X[n - 1] && y === Y[n - 1]) continue;
      X[n] = x; Y[n] = y; n++;
    }
    while (n > 1 && X[n - 1] === X[0] && Y[n - 1] === Y[0]) n--;
    if (n < 3) continue;

    for (let k = 0; k < n; k++) {
      const x = X[k] - ox, y = Y[k] - oy;
      U[k] = m11 * x + m12 * y - 0.5; V[k] = m21 * x + m22 * y - 0.5;
    }
    let area2 = 0, per = 0;
    for (let k = 0, j = n - 1; k < n; j = k++) per += Math.abs(U[k] - U[j]) + Math.abs(V[k] - V[j]);
    for (let k = 1; k + 1 < n; k++) area2 += (U[k] - U[0]) * (V[k + 1] - V[0]) - (U[k + 1] - U[0]) * (V[k] - V[0]);
    if (!(Math.abs(area2) > SLIVER * per * per)) continue;
    // the factor that turns the winding number of texel space (+1 or -1 inside) into +1 for an outer polygon, -1 for a hole
    const w = (area2 > 0) === !P.hole ? 1 : -1;

    for (let k = 0; k < n; k++) {
      const j = k + 1 === n ? 0 : k + 1, ex = X[j] - X[k], ey = Y[j] - Y[k];
      let L = Math.sqrt(ex * ex + ey * ey);
      if (!(L > 1e-150 && L < 1e150)) L = Math.hypot(ex, ey);           // the squares left the range of a double
      DX[k] = ex / L; DY[k] = ey / L; LN[k] = L / range;
    }
    for (let k = 0, j = n - 1; k < n; j = k++) {
      const hx = DX[k] - DX[j], hy = DY[k] - DY[j];
      HS[k] = 0.5 * Math.sqrt(hx * hx + hy * hy);
    }

    for (let k = 0; k < n; k++) {
      const j = k + 1 === n ? 0 : k + 1, dx = DX[k], dy = DY[k];
      crossings(wind, size, U[k], V[k], U[j], V[j], w);
      strip(dist, size, U[k], V[k], ax * dx + ay * dy, bx * dx + by * dy, dx * ay - dy * ax, dx * by - dy * bx,
        -(HS[k] + tau), LN[k] + HS[j] + tau, LN[k], idet, flatA);
    }
  }
  return finish(dist, wind, size);
}

/**
 * The shader's fetch: the texture at the lattice coordinates (s, t), bilinear between texel centres, repeating in both
 * directions (LINEAR, REPEAT). A number in [0, 255]; at a texel centre ((i + 0.5) / size, (j + 0.5) / size) the texel itself.
 */
export function sdfSample(data, size, s, t) {
  const x = s * size - 0.5, y = t * size - 0.5;
  const xf = Math.floor(x), yf = Math.floor(y), fx = x - xf, fy = y - yf;
  let i0 = xf % size, j0 = yf % size;
  if (i0 < 0) i0 += size;
  if (j0 < 0) j0 += size;
  const i1 = i0 + 1 < size ? i0 + 1 : 0, r0 = j0 * size, r1 = (j0 + 1 < size ? j0 + 1 : 0) * size;
  const top = data[r0 + i0] + (data[r0 + i1] - data[r0 + i0]) * fx;
  const bot = data[r1 + i0] + (data[r1 + i1] - data[r1 + i0]) * fx;
  return top + (bot - top) * fy;
}

/** The shader's decode: the signed distance in world units of a texture value (128 -> 0, 255 -> +range, 1 -> -range). */
export function sdfDistance(value, range) {
  return ((value - 128) / 127) * range;
}
