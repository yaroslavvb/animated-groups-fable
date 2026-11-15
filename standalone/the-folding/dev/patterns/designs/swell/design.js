// dev/patterns/designs/swell/design.js — "Swell": interlocking commas, each inflated into the room around it.
//
// THE COMMA. A tapered stroke (the union of discs along a spine: a round head, a tail that thins to a point) whose tail
// winds round the head of a PARTNER: the copy of the comma under one element g of the group (a half-turn gives the
// yin-yang pair, a rotation of order n a tomoe, a glide a chain, and in a group without rotations a translation a
// running wave: the tail wraps part of the way round the next copy's head). So the bay of every comma holds a
// neighbour's head, which is what keeps a comma a comma when it swells (seatSingle). Where no copy can reach into a
// bay — a kaleidoscope's chamber, whose neighbours are mirror images — the tile holds a PAIR of commas that nest in
// each other, a big one and one at beta of its size (seatPair). A strip too thin for either (*x) holds one long comma.
// (The review of 13 Nov 2026: translation partners, no tails pinned to tile corners, a stronger bare-place weight; see
// NOTES.md "After the critique".)
//
// THE SWELL. A point is dark when it is clearly nearer to its own comma than to any other:
//     D_own(x) < LAMBDA * D_other(x) - half a channel        (D: distance counted in the comma's local thickness)
// LAMBDA is found per group for the dark share, and raised where a bare place wider than bareMax would be left. In a
// chamber (and in a tile with a side on a mirror, where it leaves a clearly smaller bare place) the commas instead fill
// their rooms in plain distance with LAMBDA = 1, up to channels of one width found for the dark share: a corner of a
// chamber is as near a mirror image as the comma, so LAMBDA < 1 would leave it bare.
//
// Pure and deterministic. Reads group.e1, e2, reps, domainArea, center, and presets[0] when there is one (the page's
// default tile: the heads are sought in it); without presets the same tile from a table of seeds in lattice
// coordinates, so a turned, scaled, shifted copy of a group gets the turned, scaled, shifted motif.
import { elementsNear, contains } from '../../../../src/groups.js';
import { buildDomain } from '../../../../src/domain.js';

export const meta = { key: 'swell', label: 'Swell', hint: 'interlocking commas, each swollen into the room around it' };

// ---- knobs (dimensionless: lengths in tile sizes u = sqrt(domainArea), angles in radians) -------------------------
export const KNOBS = {
  // the comma before it swells
  taper: 0.6,          // the radius falls from the head (t = 0) to the tip (t = 1) as ((1 + cos pi t) / 2) ^ taper ...
  pFloor: 0.07,        // ... but never below this share of the head's radius (the tip)
  gap: 0.08,           // commas (and a comma and its own tail) keep this far apart where they are seated ...
  lean: 0.75,          // ... and then their radii are multiplied by this: the swell gives the room back, evenly
  tipMin: 0.03,        // the least radius of a disc of the comma (its tip: no hairline)
  sweeps: [2.5, 3.2],           // how far the tail winds round the partner's head
  rws: [0.2, 0.35, 0.5, 0.65, 0.9, 1.2],     // the distance from the partner's head at which the tip ends (beyond the head's own: the tail reaches out)
  pairKs: [0.6, 0.8, 1.3],      // ... in a pair: this share of the head-to-head distance ...
  pairRws: [0.18],              // ... or these distances
  singlePins: 0,       // 1: a single comma's tail may also end in a corner of the tile (run 2; off since the review)
  pinIn: 0.07,         // a tail may also end in a corner of the tile: this far from both sides of it ...
  pinSweep: [1.3, 5.0],         // ... after winding this far round the partner's head (a pair: pinSweepPair)
  pinSweepPair: [0.6, 5.5],
  pinTurn: 0.9,        // ... round the head of a rotation partner of order n, at least this share of 2 pi / n
  pinMs: [0.3, 1, 3],           // ... with these dives (0.3: round the head first, then out to the corner)
  thin: { sweeps: [0.3, 0.55, 0.8], rws: [1.4, 1.8, 2.2], pinSweep: [0.15, 1.3], dMax: 3, rMin: 0.06, singlePins: 1, acrossPrune: 0 },   // the seat of a strip too thin to nest in
  acrossPrune: 1,      // a partner whose head lies across a mirror is not tried (the tail cannot reach it): saves time
  ms: [1, 3],                   // the dive: 1 leaves the head sideways, 3 heads for the partner first
  partners: 4,         // the nearest images of the head tried as its partner's head
  hStep: 0.2,          // the grid of head positions tried, over the default tile
  topN: 40,            // the seats of largest area weighed by the bare place they leave ...
  probeStep: 0.3, probeB0: 0.4, probeW: 25,    // ... probed on a grid of this step and at the tile's corners: a penalty probeW (bare - probeB0)^2
                                               // (run 2: 0.5 and 10; the review: without pins the stronger weight closes
                                               // 2222 0.51 -> 0.38, 442 0.52 -> 0.44, 632 0.50 -> 0.43, and the marks curl more)
  pairGap: 0.08,       // the gap of the two commas of a pair where they are seated
  pairProbeB0: 0.5, pairProbeW: 10,            // the pair's own bare-place weight (run 2's: the stronger one made *2222 pebbles)
  dMin: 0.35, dMax: 2.5,        // the partner's head this far away
  rMin: 0.1,           // the head's radius at least this
  lenMin: 0.6,         // the comma at least this long (its spine)
  searchDiscs: 14, discs: 30, crowd: 1.6,     // discs along the spine (crowded toward the tip: disc i at 1 - (1 - i/(n-1))^crowd)
  refine: 4,           // rounds of local refinement of the best seat
  // a pair (a chamber, o, **): two commas in the tile, each winding round the other's head
  beta: 0.7,           // the second comma's radii, in the first one's
  pStep: 0.16,         // the grid of head positions tried in the chamber
  // the swell
  target: 0.56,        // the share of the plane that is dark ...
  cap: 0.62,           // ... and the most it may be where LAMBDA is raised to close a bare place
  bareMax: 0.42,       // no bare place wider than this, as far as the cap allows
  lamMin: 0.05,
  channel: 0.06,       // the least channel between two marks
  kappa: 0.5,          // the gauge: a disc of the comma weighs its radius + kappa head radii
  nearCopies: 16,
  grid: 56,            // samples per tile size
  pad: 0.5,            // the window: the commas' box and this much around it
  reach: 0.75,         // a point farther than this from its own comma is never dark
  round: 8,            // passes of blur of the field before its outline is taken
  roundMargin: 14,     // ... where the commas swell by one channel width (their Voronoi outline has lumps)
  step: 0.014,         // spacing of the outline's points
  smooth: 6,           // passes of smoothing of the outline
  mirrorMargin: 1,     // the commas of a tile with a side on a mirror fill their rooms too where LAMBDA leaves a bare place ...
  marginGain: 0,       // ... and this swell leaves one smaller by this much (run 2: 0.05; at 0, 2*22's yin-yang is two
                       // C-shaped commas instead of a rounded rectangle with a slit, bare 0.48 -> 0.455; no other group moves)
  marginReach: 1.6,    // (in this swell a point this far from every comma of its own may still be dark: the far corners)
  chamberMargin: 1,    // a chamber's pair fills its room up to one channel width (found for the dark share) instead of LAMBDA
  plain: 0,            // 1: a point must also be nearer in plain distance (leaves a no-man's land between a head and a tail)
  ramp: 0.6, rampMin: 0.25,     // in a chamber the channel narrows within ramp of a corner, to rampMin of it (a sharp corner keeps a tip)
  thinBelow: 0.24,     // a tile whose inradius is below this is a thin strip (*x)
  transSweeps: [0.8, 1.2, 1.6],          // in a group without rotations a tail may wind this far round the head of a TRANSLATED copy
  chamberSingle: 0,    // 1: a chamber (and o, ** when they fall back) holds ONE comma winding round an empty point, not a pair
  selfFar: 0,          // > 0: the part of a comma farther than this share of its length from a point's nearest disc is, to
                       // the swell, another comma: the bay between its head and its own tail keeps a channel
};

// The seed of each group's default tile in lattice coordinates relative to group.center (the page's presets[0]):
// used when a group comes without presets (a turned, scaled, shifted copy), so that it gets the same tile.
const SEED = {
  'o': [0, 0], '2222': [-0.25, -0.25], '**': [0, 0], 'xx': [-0.125, 0], '*x': [0, 0], '333': [0, -0.5], '22x': [-0.25, 0],
  '22*': [0, -0.125], '*2222': [-0.25, -0.25], '2*22': [-0.125, -0.125], '442': [0, -0.25],
  '632': [-0.08660254037844388, -0.3267949192431122], '3*3': [-0.05773502691896257, -0.38452994616207486],
  '*333': [0, -1 / 3], '4*2': [-0.15, -0.15], '*442': [-1 / 3, -1 / 6], '*632': [-1 / 9, -5 / 18],
};

const hyp = Math.hypot;

// ---------------------------------------------------------------------------------------------------------------
// The tile the heads are sought in
// ---------------------------------------------------------------------------------------------------------------

function basisMetric(u, v) {                      // the quadratic form in which u and v are orthonormal
  const det = u[0] * v[1] - u[1] * v[0];
  const r0 = [v[1] / det, -v[0] / det], r1 = [-u[1] / det, u[0] / det];
  return [r0[0] * r0[0] + r1[0] * r1[0], r0[0] * r0[1] + r1[0] * r1[1], r0[1] * r0[1] + r1[1] * r1[1]];
}

function clip(poly, nx, ny, c) {                  // keep n.x <= c
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n], sp = nx * p[0] + ny * p[1] - c, sq = nx * q[0] + ny * q[1] - c;
    if (sp <= 0) out.push(p);
    if ((sp <= 0) !== (sq <= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
  }
  return out;
}

/** Dirichlet polygon of a seed (own code: the fallback when buildDomain cannot be used). */
function dirichletPoly(group, seed, Q = [1, 0, 1]) {
  const [px, py] = seed, size = Math.sqrt(group.domainArea);
  const L = hyp(group.e1[0], group.e1[1]) + hyp(group.e2[0], group.e2[1]);
  let poly = [[px - 4 * L, py - 4 * L], [px + 4 * L, py - 4 * L], [px + 4 * L, py + 4 * L], [px - 4 * L, py + 4 * L]];
  const els = elementsNear(group, px, py, 3 * L, px, py);
  const q = (x, y) => x * (Q[0] * x + Q[1] * y) + y * (Q[1] * x + Q[2] * y);
  const hs = [];
  for (const g of els) {
    const qx = g.a * px + g.b * py + g.tx, qy = g.c * px + g.d * py + g.ty, dx = qx - px, dy = qy - py;
    if (dx * dx + dy * dy < 1e-18 * size * size) continue;
    let nx = Q[0] * dx + Q[1] * dy, ny = Q[1] * dx + Q[2] * dy, c = (q(qx, qy) - q(px, py)) / 2;
    const l = hyp(nx, ny); nx /= l; ny /= l; c /= l;
    hs.push([nx, ny, c, c - (nx * px + ny * py)]);
  }
  hs.sort((a, b) => a[3] - b[3]);
  for (const h of hs) { poly = clip(poly, h[0], h[1], h[2]); if (poly.length < 3) break; }
  return poly;
}

function polyArea(poly) { let s = 0; for (let i = 0, n = poly.length; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; s += p[0] * q[1] - p[1] * q[0]; } return s / 2; }
function polyCentroid(poly) {
  let cx = 0, cy = 0, s = 0;
  for (let i = 0, n = poly.length; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n], w = p[0] * q[1] - p[1] * q[0]; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w; s += w; }
  return Math.abs(s) < 1e-300 ? [poly[0][0], poly[0][1]] : [cx / (3 * s), cy / (3 * s)];
}

/** The page's default tile (a convex polygon, counter-clockwise, no dust corners). */
export function seatTile(group) {
  let seed = null, metric;
  const p0 = group.presets && group.presets[0];
  if (p0 && p0.seed) { seed = p0.seed; metric = p0.metric; } else {
    const k = SEED[group.id] || [0.137, 0.291];
    seed = [group.center[0] + k[0] * group.e1[0] + k[1] * group.e2[0], group.center[1] + k[0] * group.e1[1] + k[1] * group.e2[1]];
    if (group.reps.length === 1) metric = basisMetric(group.e1, group.e2);
  }
  let poly = null;
  try { poly = buildDomain(group, { seed, metric }).poly.map((p) => [p[0], p[1]]); } catch (e) { poly = null; }
  if (!poly || poly.length < 3) poly = dirichletPoly(group, seed, metric);
  if (polyArea(poly) < 0) poly.reverse();
  const size = Math.sqrt(group.domainArea), eps = 1e-4 * size;
  const out = [];
  for (const q of poly) if (!out.length || hyp(q[0] - out[out.length - 1][0], q[1] - out[out.length - 1][1]) > eps) out.push(q);
  while (out.length > 3 && hyp(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= eps) out.pop();
  for (let i = 0; i < out.length && out.length > 3;) {
    const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-4 * hyp(b[0] - a[0], b[1] - a[1]) * hyp(c[0] - b[0], c[1] - b[1])) out.splice(i, 1); else i++;
  }
  return out;
}

/** Is every side of the tile a mirror of the group (a kaleidoscope's chamber)? */
function isChamber(group, T, any = false) {
  for (let i = 0; i < T.length; i++) {
    const p = T[i], q = T[(i + 1) % T.length], ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const c2 = Math.cos(2 * ang), s2 = Math.sin(2 * ang);
    const g = { a: c2, b: s2, c: s2, d: -c2, tx: p[0] - (c2 * p[0] + s2 * p[1]), ty: p[1] - (s2 * p[0] - c2 * p[1]) };
    const m = contains(group, g, 1e-6);
    if (any && m) return true;
    if (!any && !m) return false;
  }
  return !any;
}

/** Points of a square grid in the frame of e1 (so it turns with the group), inside the polygon T by at least `inset`. */
function gridIn(group, T, step, inset) {
  const le = hyp(group.e1[0], group.e1[1]), ux = group.e1[0] / le, uy = group.e1[1] / le, vx = -uy, vy = ux;
  const c = polyCentroid(T);
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (const p of T) { const a = (p[0] - c[0]) * ux + (p[1] - c[1]) * uy, b = (p[0] - c[0]) * vx + (p[1] - c[1]) * vy; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const edges = [];
  for (let i = 0; i < T.length; i++) {
    const p = T[i], q = T[(i + 1) % T.length], dx = q[0] - p[0], dy = q[1] - p[1], l = hyp(dx, dy);
    if (l > 1e-12) edges.push([dy / l, -dx / l, (dy / l) * p[0] + (-dx / l) * p[1]]);
  }
  const out = [];
  // the grid is offset by 0.37 of a step: no point of it lies exactly on the rim of a tile (where rounding would decide)
  for (let j = Math.ceil(b0 / step - 0.37); (j + 0.37) * step <= b1; j++) for (let i = Math.ceil(a0 / step - 0.37); (i + 0.37) * step <= a1; i++) {
    const x = c[0] + (i + 0.37) * step * ux + (j + 0.37) * step * vx, y = c[1] + (i + 0.37) * step * uy + (j + 0.37) * step * vy;
    let ok = true;
    for (const e of edges) if (e[2] - e[0] * x - e[1] * y < inset) { ok = false; break; }
    if (ok) out.push([x, y]);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The comma: a tapered stroke whose spine starts at the head and winds around the partner's head
// ---------------------------------------------------------------------------------------------------------------

function profileOf(n, K) {
  const ts = new Float64Array(n), P = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = 1 - Math.pow(1 - i / (n - 1), K.crowd);
    ts[i] = t; P[i] = Math.max(Math.pow(0.5 * (1 + Math.cos(Math.PI * t)), K.taper), K.pFloor);
  }
  return { ts, P, n };
}

const FINE = 48;
const fineX = new Float64Array(FINE + 1), fineY = new Float64Array(FINE + 1), fineL = new Float64Array(FINE + 1);

/**
 * The spine, from the head h around the partner's head p: in polar coordinates about p, the angle a0 + sgn sweep s and
 * the distance rw + (D - rw) (1 - s)^m (D = |h - p|, s from 0 at the head to 1 at the tip). m = 1 leaves the head
 * sideways (the yin-yang); a larger m dives toward the partner first and then winds round it (a partner far away). The
 * discs sit at the shares ts of its length. Returns D.
 */
function spineInto(h, p, sweep, rw, m, sgn, pr, X, Y) {
  const dx = h[0] - p[0], dy = h[1] - p[1], D = Math.sqrt(dx * dx + dy * dy);
  let cx = dx / D, cy = dy / D;                                     // the direction from p, turned step by step
  const da = (sgn * sweep) / FINE, cr = Math.cos(da), sr = Math.sin(da);
  for (let j = 0; j <= FINE; j++) {
    const w = 1 - j / FINE, rho = rw + (D - rw) * (m === 1 ? w : m === 3 ? w * w * w : Math.pow(w, m));
    const x = p[0] + rho * cx, y = p[1] + rho * cy;
    fineX[j] = x; fineY[j] = y;
    if (j) { const ax = x - fineX[j - 1], ay = y - fineY[j - 1]; fineL[j] = fineL[j - 1] + Math.sqrt(ax * ax + ay * ay); } else fineL[0] = 0;
    const nx = cx * cr - cy * sr; cy = cx * sr + cy * cr; cx = nx;
  }
  const L = fineL[FINE];
  for (let i = 0, j = 0; i < pr.n; i++) {
    const want = pr.ts[i] * L;
    while (j < FINE - 1 && fineL[j + 1] < want) j++;
    const seg = fineL[j + 1] - fineL[j], f = seg > 0 ? Math.min(1, Math.max(0, (want - fineL[j]) / seg)) : 0;
    X[i] = fineX[j] + f * (fineX[j + 1] - fineX[j]); Y[i] = fineY[j] + f * (fineY[j + 1] - fineY[j]);
  }
  return D;
}

/** The area of a stroke of head radius r0 (a half disc for the head, and the band along the spine). */
function strokeArea(pr, X, Y, r0, scale = 1) {
  let a = 0;
  for (let i = 1; i < pr.n; i++) a += (pr.P[i] + pr.P[i - 1]) * hyp(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  return scale * r0 * a + (Math.PI / 2) * (scale * r0) ** 2;
}
function spineLength(pr, X, Y) { let L = 0; for (let i = 1; i < pr.n; i++) L += hyp(X[i] - X[i - 1], Y[i] - Y[i - 1]); return L; }

/** The largest head radius r0 for which the stroke (radii r0 P) keeps `gap` from its own far part and from its copies. */
function headRadius(pr, X, Y, copies, gap, limit) {
  const n = pr.n, P = pr.P, ts = pr.ts;
  let r0 = limit;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (ts[j] - ts[i] < 0.45) continue;
    const v = (hyp(X[i] - X[j], Y[i] - Y[j]) - gap) / (P[i] + P[j]);
    if (v < r0) { r0 = v; if (r0 <= 0) return 0; }
  }
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += X[i]; my += Y[i]; }
  mx /= n; my /= n;
  let R = 0;
  for (let i = 0; i < n; i++) R = Math.max(R, hyp(X[i] - mx, Y[i] - my));
  const reach = 2 * (R + r0) + gap;
  for (const g of copies) {
    const cx = g.a * mx + g.b * my + g.tx, cy = g.c * mx + g.d * my + g.ty;
    if ((cx - mx) ** 2 + (cy - my) ** 2 > reach * reach) continue;
    for (let j = 0; j < n; j++) {
      const x = g.a * X[j] + g.b * Y[j] + g.tx, y = g.c * X[j] + g.d * Y[j] + g.ty, Pj = P[j];
      for (let i = 0; i < n; i++) {
        const dx = X[i] - x, dy = Y[i] - y, lim = r0 * (P[i] + Pj) + gap;
        if (dx * dx + dy * dy >= lim * lim) continue;
        const v = (Math.sqrt(dx * dx + dy * dy) - gap) / (P[i] + Pj);
        if (v < r0) { r0 = v; if (r0 <= 0) return 0; }
      }
    }
  }
  return r0;
}

/**
 * The widest bare place the commas leave BEFORE they swell, as a diameter, probed at a few points (the corners, the
 * middles of the sides and the centre of the tile, the rotation centres near it, a coarse grid): twice the largest
 * distance from a probe to the nearest comma (any copy). Cheap; it is what tells a yin-yang that leaves a 6-fold
 * centre bare from a tomoe round it.
 */
function probeBare(strokes, copies, probes) {
  let worst = 0;
  for (const q of probes) {
    let d = Infinity;
    for (const S of strokes) for (const g of copies) {
      const cx = g.a * S.mx + g.b * S.my + g.tx, cy = g.c * S.mx + g.d * S.my + g.ty;
      if (hyp(q[0] - cx, q[1] - cy) - S.R >= d) continue;
      for (let i = 0; i < S.n; i++) {
        const x = g.a * S.X[i] + g.b * S.Y[i] + g.tx, y = g.c * S.X[i] + g.d * S.Y[i] + g.ty, v = hyp(q[0] - x, q[1] - y) - S.r[i];
        if (v < d) d = v;
      }
    }
    if (d > worst) worst = d;
  }
  return 2 * worst;
}
/** A stroke as probeBare wants it: positions, radii, centre and radius of its bounding circle. */
function strokeOf(pr, X, Y, r0) {
  const n = pr.n, r = new Float64Array(n), Xs = Float64Array.from(X), Ys = Float64Array.from(Y);
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { r[i] = r0 * pr.P[i]; mx += X[i]; my += Y[i]; }
  mx /= n; my /= n;
  let R = 0;
  for (let i = 0; i < n; i++) R = Math.max(R, hyp(X[i] - mx, Y[i] - my) + r[i]);
  return { X: Xs, Y: Ys, r, n, mx, my, R };
}

/** The probes of a tile: its corners, the middles of its sides, its centre, the rotation centres in it, a coarse grid. */
function probesOf(group, T, K) {
  const u = Math.sqrt(group.domainArea), out = [];
  const c = polyCentroid(T);
  out.push(c);
  for (let i = 0; i < T.length; i++) { const p = T[i], q = T[(i + 1) % T.length]; out.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]); }
  for (const p of gridIn(group, T, K.probeStep * u, 0)) out.push(p);
  return out;
}

const isIdentity = (g, h, eps) => Math.abs(g.a - 1) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.abs(g.c) < 1e-9 && hyp(g.tx, g.ty) < eps;
const IDENT = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const isReflection = (g, eps) => {
  if (g.a * g.d - g.b * g.c > 0) return false;
  const tx = g.a * g.tx + g.b * g.ty + g.tx, ty = g.c * g.tx + g.d * g.ty + g.ty;      // g o g is a translation by this
  return hyp(tx, ty) < eps;
};
/** A glide whose axis is a mirror of the group (in ** and the like): no partner, its head lies across the mirror. */
const isMirrorGlide = (group, g) => {
  if (g.a * g.d - g.b * g.c > 0) return false;
  const vx = (g.a * g.tx + g.b * g.ty + g.tx) / 2, vy = (g.c * g.tx + g.d * g.ty + g.ty) / 2;     // half of g o g: the glide's own shift
  return contains(group, { a: g.a, b: g.b, c: g.c, d: g.d, tx: g.tx - vx, ty: g.ty - vy }, 1e-6);
};
const isTranslation = (g) => Math.abs(g.a - 1) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.abs(g.c) < 1e-9;

/**
 * The seat of ONE comma (a group that is not a kaleidoscope). The head h on a grid over the default tile; the partner g
 * among the nearest images of h (no mirror: a stroke cannot wind round a head across a mirror); the sweep, the radius
 * rw it ends at round the partner's head, the dive m, the hand; the head radius as large as the copies allow. The
 * seats of largest area are then weighed by the bare place they leave (probeBare), and the best one refined.
 */
export function seatSingle(group, T, K = KNOBS) {
  const u = Math.sqrt(group.domainArea), gap = K.gap * u, pr = profileOf(K.searchDiscs, K), A = group.domainArea;
  const X = new Float64Array(pr.n), Y = new Float64Array(pr.n);
  const le = hyp(group.e1[0], group.e1[1]), ex = group.e1[0] / le, ey = group.e1[1] / le, vx = -ey, vy = ex;
  const reachEls = 2 * K.dMax * u + 2.5 * u;
  const nearOf = (h) => elementsNear(group, h[0], h[1], reachEls, h[0], h[1]).filter((g) => !isIdentity(g, h, 1e-9 * u));
  // two pools of seats, each kept to its topN by area: 0 free tails, 1 tails that end in a corner of the tile (a seat
  // that cannot beat the topN-th of its pool is not measured)
  const pools = [[], []], floors = [-1, -1];
  let found = 0;
  const byArea = (a, b) => (Math.abs(a.area - b.area) > 1e-9 ? b.area - a.area : a.idx - b.idx);     // ties: the first found
  const keep = (c, k) => { const P = pools[k]; c.idx = found++; P.push(c); if (P.length >= 4 * K.topN) { P.sort(byArea); P.length = K.topN; floors[k] = P[K.topN - 1].area + 1e-9; } };
  const tryOne = (h, g, sweep, rw, m, sgn, copies, prune = -1) => {
    const p = [g.a * h[0] + g.b * h[1] + g.tx, g.c * h[0] + g.d * h[1] + g.ty];
    const D = hyp(h[0] - p[0], h[1] - p[1]);
    spineInto(h, p, sweep, rw * u, m, sgn, pr, X, Y);
    if (spineLength(pr, X, Y) < K.lenMin * u) return null;
    if (prune >= 0 && strokeArea(pr, X, Y, 0.5 * D) / A <= floors[prune]) return null;
    const r0 = headRadius(pr, X, Y, copies, gap, 0.5 * D);
    if (r0 < K.rMin * u) return null;
    return { h, g, p, sweep, rw, m, sgn, r0, D, area: strokeArea(pr, X, Y, r0) / A };
  };
  // 1. every seat on the grid, by area
  const heads = gridIn(group, T, K.hStep * u, 0.02 * u), pins = pinsOf(T, K, u);
  // a group without rotations (o, **, xx, *x) may nest by a TRANSLATION: the tail wraps part of the way round the head
  // of the next copy, on the side away from that copy's own tail (a running wave). (Run 2 had no translation partners,
  // so o and ** fell back to a pair, which the swell made into kidneys and potatoes: the review of 13 Nov.)
  const hasRot = group.reps.some((r) => r.a * r.d - r.b * r.c > 0 && !(Math.abs(r.a - 1) < 1e-9 && Math.abs(r.b) < 1e-9 && Math.abs(r.c) < 1e-9 && Math.abs(r.d - 1) < 1e-9));
  const transOk = !!(K.transSweeps && K.transSweeps.length) && !hasRot;
  for (const h of heads) {
    const near = nearOf(h), parts = [];
    // the mirrors near h: a partner whose head lies across one cannot be wound round (the tail would cross the mirror and
    // meet its own mirror image; headRadius would say 0 after all the work)
    // (not in a thin strip: there a short pinned tail bends toward a far partner without reaching the mirror)
    const mirrors = K.acrossPrune ? near.filter((g) => isReflection(g, 1e-7 * u)) : [];
    const across = (px, py) => mirrors.some((s) => {
      const ax = s.a * h[0] + s.b * h[1] + s.tx - h[0], ay = s.c * h[0] + s.d * h[1] + s.ty - h[1];
      const bx = s.a * px + s.b * py + s.tx - px, by = s.c * px + s.d * py + s.ty - py;
      return ax * bx + ay * by < 0;
    });
    for (const g of near) {
      // no mirror (a stroke cannot wind round a head across one); a translation only where transOk (above)
      if (isReflection(g, 1e-7 * u) || (isTranslation(g) && !transOk) || isMirrorGlide(group, g)) continue;
      const qx = g.a * h[0] + g.b * h[1] + g.tx - h[0], qy = g.c * h[0] + g.d * h[1] + g.ty - h[1], d = hyp(qx, qy);
      if (d < K.dMin * u || d > K.dMax * u) continue;
      if (across(h[0] + qx, h[1] + qy)) continue;
      // the angle to e1 breaks ties of distance (a translation by +v and by -v always tie): -v lies ON the branch cut of
      // atan2, where rounding in a turned copy of the group flips pi to -pi, so pi is folded onto -pi (the review: a moved
      // xx got another seat)
      let ang = Math.atan2(qx * vx + qy * vy, qx * ex + qy * ey);
      if (ang > Math.PI - 1e-7) ang -= 2 * Math.PI;
      parts.push({ g, d, ang });
    }
    parts.sort((a, b) => (Math.abs(a.d - b.d) > 1e-9 * u ? a.d - b.d : a.ang - b.ang));
    let nPart = Math.min(K.partners, parts.length);                // ... and a tie at the cut is never split
    while (nPart < parts.length && Math.abs(parts[nPart].d - parts[nPart - 1].d) <= 1e-9 * u) nPart++;
    for (const { g } of parts.slice(0, nPart)) {
      const trans = isTranslation(g);
      for (const sweep of trans ? K.transSweeps : K.sweeps) for (const rw of K.rws) for (const m of K.ms) for (let sgn = 1; sgn >= -1; sgn -= 2) {
        const c = tryOne(h, g, sweep, rw, m, sgn, near, 0);
        if (c) { c.near = near; keep(c, 0); }
      }
      // ... and the tails that end in a corner of the tile (where the room narrows: a tail fits there, a head does not).
      // Off since the review of 13 Nov: a tail pinned to a corner wraps only 70 - 80 degrees round its partner's head, the
      // swell then fills the bay, and 632 became a starburst, 4*2 and 3*3 pebbles, 22* a bottle with a knob; without pins
      // they are tomoe and yin-yangs, and the bare places of 4*2 and 3*3 shrank (0.47 -> 0.32, 0.51 -> 0.37).
      if (!K.singlePins) continue;
      const p = [g.a * h[0] + g.b * h[1] + g.tx, g.c * h[0] + g.d * h[1] + g.ty];
      const ang = Math.abs(Math.atan2(g.c, g.a)), order = g.a * g.d - g.b * g.c > 0 && ang > 1e-6 ? Math.round((2 * Math.PI) / ang) : Infinity;
      const PS = trans ? { pinSweep: [K.transSweeps[0], K.transSweeps[K.transSweeps.length - 1]] }
        : { pinSweep: [Number.isFinite(order) ? Math.min(K.pinSweep[0], (K.pinTurn * 2 * Math.PI) / order) : K.pinSweep[0], K.pinSweep[1]] };
      for (const q of pins) for (let sgn = 1; sgn >= -1; sgn -= 2) {
        const w = pinOf(h, p, q, sgn, u, PS);
        if (w) for (const m of K.pinMs) { const c = tryOne(h, g, w.sweep, w.rw, m, sgn, near, 1); if (c) { c.near = near; keep(c, 1); } }
      }
    }
  }
  const all = pools.flatMap((P) => P.sort(byArea).slice(0, K.topN));
  if (!all.length) return null;
  // 2. the best of each pool by area, weighed by the bare place they leave
  const probes = probesOf(group, T, K);
  const scoreOf = (c) => {
    spineInto(c.h, c.p, c.sweep, c.rw * u, c.m, c.sgn, pr, X, Y);
    const bare = probeBare([strokeOf(pr, X, Y, c.r0)], [IDENT, ...c.near], probes) / u;
    c.bare0 = bare;
    c.score = c.area - K.probeW * Math.max(0, bare - K.probeB0) ** 2;
    return c.score;
  };
  let best = null;
  for (const c of all) { scoreOf(c); if (!best || c.score > best.score + 1e-9) best = c; }
  // 3. refinement: the head moved a little (the partner is the same element), the sweep and the end radius changed
  let st = 0.5 * K.hStep * u, ds = 0.2, dr = 0.05;
  for (let round = 0; round < K.refine; round++, st /= 2, ds /= 2, dr /= 2) {
    const b0 = best, near = nearOf(b0.h);
    for (let ia = -1; ia <= 1; ia++) for (let ib = -1; ib <= 1; ib++) for (let is = -1; is <= 1; is++) for (let ir = -1; ir <= 1; ir++) {
      if (!ia && !ib && !is && !ir) continue;
      const h = [b0.h[0] + st * (ia * ex + ib * vx), b0.h[1] + st * (ia * ey + ib * vy)];
      const c = tryOne(h, b0.g, b0.sweep + is * ds, b0.rw + ir * dr, b0.m, b0.sgn, near);
      if (!c) continue;
      c.near = near;
      if (scoreOf(c) > best.score + 1e-9) best = c;
    }
  }
  return best;
}

/** The corners of the tile, each moved inward along its bisector until a tip fits: where a tail may end. */
export function pinsOf(T, K, u) {
  const out = [], n = T.length;
  for (let j = 0; j < n; j++) {
    const p = T[j], a = T[(j + n - 1) % n], b = T[(j + 1) % n];
    const ax = a[0] - p[0], ay = a[1] - p[1], bx = b[0] - p[0], by = b[1] - p[1], la = hyp(ax, ay), lb = hyp(bx, by);
    const ang = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))));
    let ux = ax / la + bx / lb, uy = ay / la + by / lb; const lu = hyp(ux, uy); ux /= lu; uy /= lu;
    const d = (K.pinIn * u) / Math.sin(ang / 2);
    out.push([p[0] + ux * d, p[1] + uy * d]);
  }
  return out;
}
/** The sweep and the end radius of a spine from h round p that ends at the point q, going round the sgn way. */
export function pinOf(h, p, q, sgn, u, K) {
  const a0 = Math.atan2(h[1] - p[1], h[0] - p[0]), a1 = Math.atan2(q[1] - p[1], q[0] - p[0]), TAU = 2 * Math.PI;
  const s = (((sgn * (a1 - a0)) % TAU) + TAU) % TAU;
  if (s < K.pinSweep[0] || s > K.pinSweep[1]) return null;
  return { sweep: s, rw: hyp(q[0] - p[0], q[1] - p[1]) / u };
}

/** The distance from (x, y) to each wall of the chamber T (positive inside). */
function wallsOf(T) {
  const out = [];
  for (let i = 0; i < T.length; i++) {
    const p = T[i], q = T[(i + 1) % T.length], dx = q[0] - p[0], dy = q[1] - p[1], l = hyp(dx, dy);
    if (l > 1e-12) out.push([dy / l, -dx / l, (dy / l) * p[0] + (-dx / l) * p[1]]);
  }
  return out;
}

/**
 * The seat of a PAIR of commas in a kaleidoscope's chamber T: A with its head at a, winding round B's head at b, and B
 * (radii beta times A's) winding round A's head, the same way round (a yin-yang). Both stay inside the chamber by half
 * a gap (so a comma keeps a gap from its mirror images), and apart from each other. Weighed by the bare place left, as
 * the single seat is (a corner of the chamber is where 2n chambers meet: its bare place is the probe's distance twice).
 */
export function seatPair(group, T, K = KNOBS) {
  const u = Math.sqrt(group.domainArea), gap = K.pairGap * u, pr = profileOf(K.searchDiscs, K), n = pr.n, P = pr.P, beta = K.beta, A = group.domainArea;
  const XA = new Float64Array(n), YA = new Float64Array(n), XB = new Float64Array(n), YB = new Float64Array(n);
  const W = wallsOf(T), pins = pinsOf(T, K, u), PK = { pinSweep: K.pinSweepPair };
  // the least head: rMin, or less in a thin tile (the strip of *x is 0.43 tile sizes wide): a share of its inradius
  let inr = Infinity;
  { const c = polyCentroid(T); for (const w of W) inr = Math.min(inr, w[2] - w[0] * c[0] - w[1] * c[1]); }
  const rMin = Math.min(K.rMin * u, 0.35 * inr), pts = gridIn(group, T, Math.min(K.pStep * u, 0.45 * inr), Math.min(0.08 * u, 0.5 * inr));
  const pools = [[], []], floors = [-1, -1];
  let found = 0;
  const byArea = (a, b) => (Math.abs(a.area - b.area) > 1e-9 ? b.area - a.area : a.idx - b.idx);
  const keep = (c, k) => { const P = pools[k]; c.idx = found++; P.push(c); if (P.length >= 4 * K.topN) { P.sort(byArea); P.length = K.topN; floors[k] = P[K.topN - 1].area + 1e-9; } };
  // single (K.chamberSingle, the review of 13 Nov): ONE comma, its tail winding round the empty point b — a pair is two
  // marks per chamber, and the mirrors make 12 to 24 pieces of lace round every corner of it
  const single = !!K.chamberSingle;
  const tryOne = (a, b, sa, sb, ra, rb, m, sgn, prune = -1) => {
    const D = hyp(a[0] - b[0], a[1] - b[1]);
    spineInto(a, b, sa, ra * u, m, sgn, pr, XA, YA);
    if (spineLength(pr, XA, YA) < K.lenMin * u) return null;
    if (!single) spineInto(b, a, sb, rb * u, m, sgn, pr, XB, YB);
    let r0 = single ? D : (D - gap) / (1 + beta);
    const areaOf = (r) => (strokeArea(pr, XA, YA, r) + (single ? 0 : strokeArea(pr, XB, YB, r, beta))) / A;
    if (prune >= 0 && areaOf(r0) <= floors[prune]) return null;
    for (let i = 0; i < n && r0 > 0; i++) for (const w of W) {
      const dA = w[2] - w[0] * XA[i] - w[1] * YA[i], dB = single ? Infinity : w[2] - w[0] * XB[i] - w[1] * YB[i];
      if (dA < 0.5 * gap || dB < 0.5 * gap) return null;
      const vA = (dA - 0.5 * gap) / P[i], vB = (dB - 0.5 * gap) / (beta * P[i]);
      if (vA < r0) r0 = vA; if (vB < r0) r0 = vB;
    }
    for (let i = 0; i < n && r0 > 0; i++) for (let j = 0; j < n; j++) {
      if (!single) { const v = (hyp(XA[i] - XB[j], YA[i] - YB[j]) - gap) / (P[i] + beta * P[j]); if (v < r0) r0 = v; }
      if (j > i && pr.ts[j] - pr.ts[i] >= 0.45) {
        const s = (hyp(XA[i] - XA[j], YA[i] - YA[j]) - gap) / (P[i] + P[j]);
        if (s < r0) r0 = s;
        if (!single) { const t = (hyp(XB[i] - XB[j], YB[i] - YB[j]) - gap) / (beta * (P[i] + P[j])); if (t < r0) r0 = t; }
      }
    }
    if (r0 < rMin) return null;
    return { a, b, sa, sb, ra, rb, m, sgn, r0, D, area: areaOf(r0), single };
  };
  for (const a of pts) for (const b of pts) {
    const d = hyp(a[0] - b[0], a[1] - b[1]);
    if (d < K.dMin * u || a === b) continue;
    const rws = K.pairKs.map((k) => (k * d) / u).concat(K.pairRws);
    for (const s of K.sweeps) for (const rw of rws) for (const m of K.ms) for (let sgn = 1; sgn >= -1; sgn -= 2) {
      const c = tryOne(a, b, s, s, rw, rw, m, sgn, 0);
      if (c) keep(c, 0);
    }
    // ... and the pairs whose two tails end in two corners of the tile (single: the one tail in a corner)
    if (single) for (const qa of pins) for (let sgn = 1; sgn >= -1; sgn -= 2) {
      const wa = pinOf(a, b, qa, sgn, u, PK);
      if (wa) for (const m of K.pinMs) { const c = tryOne(a, b, wa.sweep, wa.sweep, wa.rw, wa.rw, m, sgn, 1); if (c) keep(c, 1); }
    }
    if (!single) for (const qa of pins) for (const qb of pins) {
      if (qa === qb) continue;
      for (let sgn = 1; sgn >= -1; sgn -= 2) {
        const wa = pinOf(a, b, qa, sgn, u, PK), wb = wa && pinOf(b, a, qb, sgn, u, PK);
        if (wb) for (const m of K.pinMs) { const c = tryOne(a, b, wa.sweep, wb.sweep, wa.rw, wb.rw, m, sgn, 1); if (c) keep(c, 1); }
      }
    }
  }
  const all = pools.flatMap((P) => P.sort(byArea).slice(0, K.topN));
  if (!all.length) return null;
  const probes = probesOf(group, T, K);
  const scoreOf = (c) => {
    spineInto(c.a, c.b, c.sa, c.ra * u, c.m, c.sgn, pr, XA, YA);
    const SA = strokeOf(pr, XA, YA, c.r0), strokes = [SA];
    if (!single) { spineInto(c.b, c.a, c.sb, c.rb * u, c.m, c.sgn, pr, XB, YB); strokes.push(strokeOf(pr, XB, YB, beta * c.r0)); }
    // the chamber's mirror images: the nearest dark across a wall is the probe's own distance (a corner, a side) — so
    // the probes are looked at with the identity alone, and a probe ON a wall counts twice its distance anyway
    const bare = probeBare(strokes, [IDENT], probes) / u;
    c.bare0 = bare;
    c.score = c.area - K.pairProbeW * Math.max(0, bare - K.pairProbeB0) ** 2;
    return c.score;
  };
  let best = null;
  for (const c of all) { scoreOf(c); if (!best || c.score > best.score + 1e-9) best = c; }
  const le = hyp(group.e1[0], group.e1[1]), ex = group.e1[0] / le, ey = group.e1[1] / le, vx = -ey, vy = ex;
  let st = 0.5 * K.pStep * u, ds = 0.2, dr = 0.05;
  const take = (c) => { if (c && scoreOf(c) > best.score + 1e-9) best = c; };
  for (let round = 0; round < K.refine + 1; round++, st /= 2, ds /= 2, dr /= 2) {
    const b0 = best;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (!i && !j) continue;
      const mv = [st * (i * ex + j * vx), st * (i * ey + j * vy)];
      take(tryOne([b0.a[0] + mv[0], b0.a[1] + mv[1]], b0.b, b0.sa, b0.sb, b0.ra, b0.rb, b0.m, b0.sgn));
      take(tryOne(b0.a, [b0.b[0] + mv[0], b0.b[1] + mv[1]], b0.sa, b0.sb, b0.ra, b0.rb, b0.m, b0.sgn));
    }
    for (const [x, y] of [[ds, 0], [-ds, 0], [0, ds], [0, -ds]]) take(tryOne(b0.a, b0.b, b0.sa + x, b0.sb + y, b0.ra, b0.rb, b0.m, b0.sgn));
    for (const [x, y] of [[dr, 0], [-dr, 0], [0, dr], [0, -dr]]) take(tryOne(b0.a, b0.b, b0.sa, b0.sb, b0.ra + x, b0.rb + y, b0.m, b0.sgn));
  }
  return best;
}

/** A site: the discs of one comma at full resolution, { x, y, r, n, r0, cx, cy, R }. */
function siteOf(h, p, sweep, rw, m, sgn, r0, K, u, scale = 1) {
  const pr = profileOf(K.discs, K), x = new Float64Array(pr.n), y = new Float64Array(pr.n), r = new Float64Array(pr.n);
  spineInto(h, p, sweep, rw * u, m, sgn, pr, x, y);
  for (let i = 0; i < pr.n; i++) r[i] = Math.max(K.lean * scale * r0 * pr.P[i], K.tipMin * u);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pr.n; i++) { x0 = Math.min(x0, x[i] - r[i]); y0 = Math.min(y0, y[i] - r[i]); x1 = Math.max(x1, x[i] + r[i]); y1 = Math.max(y1, y[i] + r[i]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let R = 0;
  for (let i = 0; i < pr.n; i++) R = Math.max(R, hyp(x[i] - cx, y[i] - cy) + r[i]);
  return { x, y, r, t: pr.ts, n: pr.n, r0: K.lean * scale * r0, cx, cy, R };
}

// ---------------------------------------------------------------------------------------------------------------
// The field: the distances to the own commas and to the nearest other copy, on a grid around them
// ---------------------------------------------------------------------------------------------------------------

export function field(group, sites, K = KNOBS, cover = null) {
  const size = Math.sqrt(group.domainArea), h = size / K.grid, pad = K.pad * size, far = K.reach * size;
  const le = hyp(group.e1[0], group.e1[1]), ux = group.e1[0] / le, uy = group.e1[1] / le, vx = -uy, vy = ux;
  let a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
  for (const S of sites) for (let k = 0; k < S.n; k++) {
    const a = S.x[k] * ux + S.y[k] * uy, b = S.x[k] * vx + S.y[k] * vy;
    a0 = Math.min(a0, a - S.r[k]); b0 = Math.min(b0, b - S.r[k]); a1 = Math.max(a1, a + S.r[k]); b1 = Math.max(b1, b + S.r[k]);
  }
  a0 -= pad; b0 -= pad; a1 += pad; b1 += pad;
  if (cover) for (const p of cover) {                                // ... and the whole of this polygon (a chamber: its corners)
    const a = p[0] * ux + p[1] * uy, b = p[0] * vx + p[1] * vy, m = 0.1 * size;
    a0 = Math.min(a0, a - m); b0 = Math.min(b0, b - m); a1 = Math.max(a1, a + m); b1 = Math.max(b1, b + m);
  }
  const nx = Math.ceil((a1 - a0) / h) + 1, ny = Math.ceil((b1 - b0) / h) + 1;
  const gx = a0 * ux + b0 * vx, gy = a0 * uy + b0 * vy;              // node (i, j) is g + i h u + j h v
  // the motif's centre and radius; the copies that can matter
  let mx = 0, my = 0, cnt = 0;
  for (const S of sites) { mx += S.cx; my += S.cy; cnt++; }
  mx /= cnt; my /= cnt;
  let MR = 0;
  for (const S of sites) MR = Math.max(MR, hyp(S.cx - mx, S.cy - my) + S.R);
  const winR = hyp(a1 - a0, b1 - b0) / 2, wcx = (a0 + a1) / 2 * ux + (b0 + b1) / 2 * vx, wcy = (a0 + a1) / 2 * uy + (b0 + b1) / 2 * vy;
  const copies = [];
  for (const g of elementsNear(group, wcx, wcy, winR + MR + far, mx, my)) {
    const ox = g.a * mx + g.b * my + g.tx, oy = g.c * mx + g.d * my + g.ty;
    if (isIdentity(g, null, 1e-9 * size)) continue;
    for (const S of sites) {
      const x = new Float64Array(S.n), y = new Float64Array(S.n);
      for (let i = 0; i < S.n; i++) { x[i] = g.a * S.x[i] + g.b * S.y[i] + g.tx; y[i] = g.c * S.x[i] + g.d * S.y[i] + g.ty; }
      copies.push({ x, y, r: S.r, n: S.n, ox: g.a * S.cx + g.b * S.cy + g.tx, oy: g.c * S.cx + g.d * S.cy + g.ty, R: S.R, w: null, g, d: hyp(ox - mx, oy - my) });
    }
  }
  copies.sort((a, b) => a.d - b.d);
  const kap = K.kappa;
  const weights = (S) => { const w = new Float64Array(S.n); for (let i = 0; i < S.n; i++) w[i] = 1 / (S.r[i] + kap * S.r0); return w; };
  const siteW = sites.map(weights);
  for (const C of copies) C.w = siteW[sites.findIndex((S) => S.r === C.r)];
  const N = nx * ny, m = sites.length;
  const own = sites.map(() => new Float32Array(N)), eown = sites.map(() => new Float32Array(N)), iwo = sites.map(() => new Float32Array(N));
  const oth = new Float32Array(N), eoth = new Float32Array(N), iwt = new Float32Array(N);
  // the comma's OWN far part (discs more than selfFar of its length from the nearest one): to the swell it is another
  // comma, so the bay between a head and its own tail keeps a channel and the comma keeps its curl (13 Nov, review)
  const DT = K.selfFar || 0;
  const sfar = DT ? sites.map(() => new Float32Array(N)) : null, isfar = DT ? sites.map(() => new Float32Array(N)) : null, esfar = DT ? sites.map(() => new Float32Array(N)) : null;
  for (let j = 0; j < ny; j++) {
    const rx = gx + j * h * vx, ry = gy + j * h * vy;
    for (let i = 0; i < nx; i++) {
      const px = rx + i * h * ux, py = ry + i * h * uy, q = j * nx + i;
      let emin = Infinity;
      for (let s = 0; s < m; s++) {
        const S = sites[s], iw = siteW[s];
        let d1 = Infinity, e1 = Infinity, w1 = iw[0], k1 = 0, ke = 0;
        for (let k = 0; k < S.n; k++) {
          const dx = px - S.x[k], dy = py - S.y[k], qq = dx * dx + dy * dy, lim = S.r[k] + Math.max(e1, d1 / iw[k]);
          if (qq >= lim * lim && lim > 0) continue;
          const e = Math.sqrt(qq) - S.r[k], d = e * iw[k];
          if (d < d1) { d1 = d; w1 = iw[k]; k1 = k; } if (e < e1) { e1 = e; ke = k; }
        }
        own[s][q] = d1; eown[s][q] = e1; iwo[s][q] = w1;
        if (e1 < emin) emin = e1;
        if (DT) {
          const t1 = S.t[k1], te = S.t[ke];
          let d3 = Infinity, w3 = iw[0], e3 = Infinity;
          for (let k = 0; k < S.n; k++) {
            const gaugeFar = Math.abs(S.t[k] - t1) >= DT, plainFar = Math.abs(S.t[k] - te) >= DT;
            if (!gaugeFar && !plainFar) continue;
            const dx = px - S.x[k], dy = py - S.y[k], e = Math.sqrt(dx * dx + dy * dy) - S.r[k];
            if (gaugeFar) { const d = e * iw[k]; if (d < d3) { d3 = d; w3 = iw[k]; } }
            if (plainFar && e < e3) e3 = e;
          }
          sfar[s][q] = d3; isfar[s][q] = w3; esfar[s][q] = e3;
        }
      }
      if (emin > far) { oth[q] = 0; eoth[q] = 0; iwt[q] = siteW[0][0]; continue; }
      let d2 = Infinity, e2 = Infinity, w2 = siteW[0][0];
      for (const C of copies) {
        const ax = px - C.ox, ay = py - C.oy;
        const t = C.R + Math.max(e2, d2 * (C.r[0] + kap * sites[0].r0));      // no disc of this copy can be nearer
        if (t > 0 && ax * ax + ay * ay >= t * t) continue;
        const X = C.x, Y = C.y, iw = C.w;
        for (let k = 0; k < C.n; k++) {
          const bx = px - X[k], by = py - Y[k], qq = bx * bx + by * by, lim = C.r[k] + Math.max(e2, d2 / iw[k]);
          if (qq >= lim * lim && lim > 0) continue;
          const e = Math.sqrt(qq) - C.r[k], d = e * iw[k];
          if (d < d2) { d2 = d; w2 = iw[k]; } if (e < e2) e2 = e;
        }
      }
      oth[q] = d2; eoth[q] = e2; iwt[q] = w2;
    }
  }
  const near = [];
  for (const C of copies) { if (!near.includes(C.g)) near.push(C.g); if (near.length >= K.nearCopies) break; }
  // a chamber: each node's distance to the nearest corner of it (the channels narrow toward the corners: rule)
  let dv = null;
  if (cover) {
    dv = new Float32Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const px = gx + i * h * ux + j * h * vx, py = gy + i * h * uy + j * h * vy;
      let d = Infinity;
      for (const p of cover) { const v = (px - p[0]) ** 2 + (py - p[1]) ** 2; if (v < d) d = v; }
      dv[j * nx + i] = Math.sqrt(d);
    }
  }
  return { own, eown, iwo, oth, eoth, iwt, sfar, isfar, esfar, m, nx, ny, h, fr: { ox: gx, oy: gy, ux, uy, vx, vy }, copies: copies.length, near, dv };
}

/**
 * The rule, positive on the dark tone (roughly the distance to its rim). For each own comma s, against the nearest of
 * everything else (the other copies, and the other comma of the motif when there are two): dark when CLEARLY nearer
 * to s, in the gauge and in plain distance,
 *     (lam * D_other - D_s) / (lam / w_other + 1 / w_s)  >  w / 2    and    (lam * d_other - d_s) / (lam + 1)  >  w / 2
 * (the left sides are the distance to the line where the two sides are equal, so a channel is at least w wide). The
 * comma itself is always dark.
 */
export function ruleAt(F, q, R) {
  const lam = R.lam, m = F.m;
  let best = -Infinity;
  for (let s = 0; s < m; s++) {
    let Do = F.oth[q], Eo = F.eoth[q], Wo = F.iwt[q];
    for (let t = 0; t < m; t++) if (t !== s && F.own[t][q] < Do) { Do = F.own[t][q]; Wo = F.iwo[t][q]; }
    for (let t = 0; t < m; t++) if (t !== s && F.eown[t][q] < Eo) Eo = F.eown[t][q];
    if (F.sfar) {                                   // the comma's own far part counts as another comma (its bay stays open)
      if (F.sfar[s][q] < Do) { Do = F.sfar[s][q]; Wo = F.isfar[s][q]; }
      if (F.esfar[s][q] < Eo) Eo = F.esfar[s][q];
    }
    const o = F.own[s][q], e = F.eown[s][q], io = F.iwo[s][q];
    let v = R.plainOnly ? (lam * Eo - e) / (lam + 1) : (lam * Do - o) / (lam * Wo + io);
    if (R.plain && !R.plainOnly) { const u = (lam * Eo - e) / (lam + 1); if (u < v) v = u; }
    v -= 0.5 * (F.dv ? R.w * Math.min(1, Math.max(R.rampMin, F.dv[q] / R.ramp)) : R.w);
    if (-e > v) v = -e;
    if (v > best) best = v;
  }
  return best;
}
function share(F, R, area) {
  let c = 0;
  for (let i = 0, n = F.oth.length; i < n; i++) if (ruleAt(F, i, R) > 0) c++;
  return (c * F.h * F.h) / area;
}

/**
 * The widest bare place the rule leaves, as a diameter: twice the largest distance from a point of the motif's own room
 * (nearer to one of its commas than to any copy) to the dark tone, its own or that of one of the nearest copies (their
 * dark tone is the image of this one: looked up at the point carried back). With `field`, the tone is where it is > 0.
 */
function bareOf(F, R, floor, fld = null) {
  const { nx, ny, h } = F, { ox, oy, ux, uy, vx, vy } = F.fr, INF = 1e20, M = Math.max(nx, ny);
  const d = new Float64Array(nx * ny), f = new Float64Array(M), v = new Int32Array(M), z = new Float64Array(M + 1), q = new Float64Array(M);
  const pass = (n) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let i = 1; i < n; i++) {
      let s;
      for (;;) { const p = v[k]; s = (q[i] + i * i - (q[p] + p * p)) / (2 * i - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
      if (s <= z[k]) { v[k] = i; z[k] = -INF; z[k + 1] = INF; } else { k++; v[k] = i; z[k] = s; z[k + 1] = INF; }
    }
    k = 0;
    for (let i = 0; i < n; i++) { while (z[k + 1] < i) k++; const p = v[k]; f[i] = (i - p) * (i - p) + q[p]; }
  };
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) q[j] = (fld ? fld[j * nx + i] : ruleAt(F, j * nx + i, R)) > 0 ? 0 : INF;
    pass(ny);
    for (let j = 0; j < ny; j++) d[j * nx + i] = f[j];
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) q[i] = d[j * nx + i];
    pass(nx);
    for (let i = 0; i < nx; i++) d[j * nx + i] = f[i];
  }
  const lim = (0.5 * floor / h) ** 2;
  let best = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    let b = d[k];
    if (b <= lim || b <= best) continue;
    let mine = false;
    for (let s = 0; s < F.m; s++) if (F.eown[s][k] < F.eoth[k]) { mine = true; break; }
    if (!mine) continue;
    const x = ox + h * (i * ux + j * vx), y = oy + h * (i * uy + j * vy);
    for (const g of F.near) {
      const dx = x - g.tx, dy = y - g.ty, X = g.a * dx + g.c * dy - ox, Y = g.b * dx + g.d * dy - oy;     // the point carried back by g
      const a = Math.round((X * ux + Y * uy) / h), w = Math.round((X * vx + Y * vy) / h);
      if (a < 0 || w < 0 || a >= nx || w >= ny) continue;
      if (d[w * nx + a] < b) { b = d[w * nx + a]; if (b <= best) break; }
    }
    if (b > best) best = b;
  }
  return best > lim ? 2 * Math.sqrt(best) * h : floor;
}

/** The field clamped to a band of `band` and blurred `passes` times (3 x 3 binomial): rounds every corner of its zero set. */
function soften(f, nx, ny, band, passes) {
  let a = new Float32Array(f.length), b = new Float32Array(f.length);
  for (let i = 0; i < f.length; i++) a[i] = f[i] > band ? band : f[i] < -band ? -band : f[i];
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = j * nx + i; b[q] = 0.25 * (a[i > 0 ? q - 1 : q] + a[i < nx - 1 ? q + 1 : q]) + 0.5 * a[q]; }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = j * nx + i; a[q] = 0.25 * (b[j > 0 ? q - nx : q] + b[j < ny - 1 ? q + nx : q]) + 0.5 * b[q]; }
  }
  return a;
}

// ---------------------------------------------------------------------------------------------------------------
// The outline: marching squares, smoothing, resampling
// ---------------------------------------------------------------------------------------------------------------

/** Closed loops of the level set  f = 0  ( f > 0 inside, kept on the left ): [{ pts: [[x, y], ...], area }]. */
export function contours(f, nx, ny, fr, h) {
  const next = new Map(), pt = new Map();
  const V = (i, j) => (i <= 0 || j <= 0 || i >= nx - 1 || j >= ny - 1 ? -1 : f[j * nx + i]);       // a ring of "outside"
  const edgeH = (i, j) => 2 * (j * nx + i), edgeV = (i, j) => 2 * (j * nx + i) + 1;
  const cross = (id, i0, j0, i1, j1) => {
    if (pt.has(id)) return;
    const a = V(i0, j0), b = V(i1, j1), t = a / (a - b);
    const ga = (i0 + t * (i1 - i0)) * h, gb = (j0 + t * (j1 - j0)) * h;
    pt.set(id, [fr.ox + ga * fr.ux + gb * fr.vx, fr.oy + ga * fr.uy + gb * fr.vy]);
  };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v0 = V(i, j), v1 = V(i + 1, j), v2 = V(i + 1, j + 1), v3 = V(i, j + 1);
    const code = (v0 > 0 ? 1 : 0) | (v1 > 0 ? 2 : 0) | (v2 > 0 ? 4 : 0) | (v3 > 0 ? 8 : 0);
    if (code === 0 || code === 15) continue;
    const B = edgeH(i, j), T = edgeH(i, j + 1), L = edgeV(i, j), Rr = edgeV(i + 1, j);
    const seg = (a, b) => {
      for (const id of [a, b]) {
        if (id === B) cross(id, i, j, i + 1, j); else if (id === T) cross(id, i, j + 1, i + 1, j + 1);
        else if (id === L) cross(id, i, j, i, j + 1); else cross(id, i + 1, j, i + 1, j + 1);
      }
      next.set(a, b);
    };
    switch (code) {
      case 1: seg(B, L); break; case 2: seg(Rr, B); break; case 4: seg(T, Rr); break; case 8: seg(L, T); break;
      case 3: seg(Rr, L); break; case 6: seg(T, B); break; case 12: seg(L, Rr); break; case 9: seg(B, T); break;
      case 7: seg(T, L); break; case 11: seg(Rr, T); break; case 13: seg(B, Rr); break; case 14: seg(L, B); break;
      case 5: if (v0 + v1 + v2 + v3 > 0) { seg(B, Rr); seg(T, L); } else { seg(B, L); seg(T, Rr); } break;
      case 10: if (v0 + v1 + v2 + v3 > 0) { seg(L, B); seg(Rr, T); } else { seg(Rr, B); seg(L, T); } break;
      default: break;
    }
  }
  const loops = [], seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const pts = [];
    let id = start, guard = 0;
    while (!seen.has(id) && guard++ < 1e6) { seen.add(id); pts.push(pt.get(id)); id = next.get(id); if (id === undefined) break; }
    if (id !== start || pts.length < 3) continue;
    loops.push({ pts, area: polyArea(pts) });
  }
  return loops;
}

/** A closed polyline resampled at equal steps of arc length (about `step`). */
function resample(pts, step) {
  const n = pts.length, cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; cum[i + 1] = cum[i] + hyp(q[0] - p[0], q[1] - p[1]); }
  const L = cum[n], m = Math.max(8, Math.round(L / step)), out = [];
  let k = 0;
  for (let i = 0; i < m; i++) {
    const s = (i * L) / m;
    while (k < n - 1 && cum[k + 1] < s) k++;
    const t = cum[k + 1] > cum[k] ? (s - cum[k]) / (cum[k + 1] - cum[k]) : 0, p = pts[k], q = pts[(k + 1) % n];
    out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
  }
  return out;
}

/** Taubin smoothing of a closed polyline (no shrinking): `passes` pairs of a +0.5 and a -0.53 Laplacian step. */
function smoothLoop(pts, passes) {
  const n = pts.length;
  let x = Float64Array.from(pts, (p) => p[0]), y = Float64Array.from(pts, (p) => p[1]);
  let u = new Float64Array(n), v = new Float64Array(n);
  const stepOnce = (w) => {
    for (let i = 0; i < n; i++) {
      const a = i ? i - 1 : n - 1, b = i + 1 < n ? i + 1 : 0;
      u[i] = x[i] + w * ((x[a] + x[b]) / 2 - x[i]); v[i] = y[i] + w * ((y[a] + y[b]) / 2 - y[i]);
    }
    [x, u] = [u, x]; [y, v] = [v, y];
  };
  for (let p = 0; p < passes; p++) { stepOnce(0.5); stepOnce(-0.53); }
  const out = [];
  for (let i = 0; i < n; i++) out.push([x[i], y[i]]);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The swell and find
// ---------------------------------------------------------------------------------------------------------------

/** The swollen commas of the sites: { shapes, rule, bare, coverage, field }. */
export function swell(group, sites, K = KNOBS, opts = {}) {
  const size = Math.sqrt(group.domainArea), A = group.domainArea;
  const F = field(group, sites, K, opts.cover || null);
  const R = { lam: 1, w: K.channel * size, plain: K.plain, ramp: K.ramp * size, rampMin: K.rampMin };
  const solve = (lo, hi, want) => { for (let it = 0; it < 14; it++) { R.lam = (lo + hi) / 2; if (share(F, R, A) < want) lo = R.lam; else hi = R.lam; } R.lam = (lo + hi) / 2; };
  const bmax = K.bareMax * size;
  let bare;
  if (opts.margin) {
    R.plainOnly = true;          // ... in plain distance: weighed, a heavy head across a mirror would claim this side of it
    // a chamber: the commas fill their rooms up to channels of one width, found for the dark share (the corners of
    // the chamber are reached; LAMBDA < 1 would leave them bare, a corner being as near a mirror image as the comma)
    let lo = 0.02 * size, hi = 0.45 * size;
    for (let it = 0; it < 14; it++) { R.w = (lo + hi) / 2; if (share(F, R, A) > K.target) lo = R.w; else hi = R.w; }
    R.w = (lo + hi) / 2;
    bare = bareOf(F, R, 0.5 * bmax);
  } else if (share(F, R, A) > K.target) solve(K.lamMin, 1, K.target);
  const lamCov = R.lam;
  if (bare === undefined) bare = bareOf(F, R, 0.5 * bmax);
  if (!opts.margin && bare > bmax && R.lam < 1) {
    R.lam = 1;
    let lamCap = 1;
    if (share(F, R, A) > K.cap) { solve(lamCov, 1, K.cap); lamCap = R.lam; }
    if (bareOf(F, R, 0.5 * bmax) <= bmax) { let lo = lamCov, hi = lamCap; for (let it = 0; it < 6; it++) { R.lam = (lo + hi) / 2; if (bareOf(F, R, 0.5 * bmax) > bmax) lo = R.lam; else hi = R.lam; } R.lam = hi; }
    bare = bareOf(F, R, 0.5 * bmax);
  }
  let f = new Float32Array(F.oth.length);
  for (let i = 0; i < f.length; i++) f[i] = ruleAt(F, i, R);
  if (K.round > 0) {
    const band = 2.5 * F.h;
    f = soften(f, F.nx, F.ny, opts.margin ? 2 * band : band, opts.margin ? K.roundMargin : K.round);      // a Voronoi outline has lumps where the nearest disc changes: more rounding
    for (let i = 0; i < f.length; i++) for (let s = 0; s < F.m; s++) { const e = -F.eown[s][i]; if (e > f[i]) f[i] = e > band ? band : e; }
  }
  const bareOut = bareOf(F, R, 0.5 * bmax, f);
  const loops = contours(f, F.nx, F.ny, F.fr, F.h);
  loops.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  const shapes = [];
  let area = 0;
  for (const L of loops) {
    if (Math.abs(L.area) < 2e-3 * group.domainArea) continue;
    let pts = resample(L.pts, 0.6 * F.h);
    pts = smoothLoop(pts, K.smooth);
    pts = resample(pts, K.step * size);
    shapes.push({ pts, hole: L.area < 0 });
    area += polyArea(pts);
  }
  return { shapes, rule: R, bare: bareOut, bareRule: bare, coverage: area / group.domainArea, field: F };
}

/** The whole of it, for the lab: the tile, the seat, the commas' discs, the swollen outline, the numbers. */
export function build(group, K = KNOBS) {
  const size = Math.sqrt(group.domainArea);
  const T = seatTile(group);
  const chamber = isChamber(group, T);
  // a tile thinner than this (the strip of *x) has room neither for a comma that winds round its partner's head nor
  // for a pair: it goes straight to the long comma below
  let inr = Infinity;
  { const c = polyCentroid(T); for (const w of wallsOf(T)) inr = Math.min(inr, w[2] - w[0] * c[0] - w[1] * c[1]); }
  const thin = !chamber && inr < K.thinBelow * size;
  let sites, seat = chamber || thin ? null : seatSingle(group, T, K), pair = !seat && !thin;
  // a kaleidoscope, or a group whose copies cannot nest (o, **: translations and mirrors only): a pair in the tile
  if (pair) seat = seatPair(group, T, K);
  if (thin) pair = false;
  if (!seat && !chamber) {
    // a strip too thin for either (*x, 0.43 tile sizes between its mirrors): one long comma that bends toward its
    // partner's head without winding round it
    seat = seatSingle(group, T, { ...K, ...K.thin });
    pair = false;
  }
  if (!seat) throw new Error('swell: no seat for the commas of ' + group.id);
  if (pair) {
    sites = [siteOf(seat.a, seat.b, seat.sa, seat.ra, seat.m, seat.sgn, seat.r0, K, size)];
    if (!seat.single) sites.push(siteOf(seat.b, seat.a, seat.sb, seat.rb, seat.m, seat.sgn, seat.r0, K, size, K.beta));
  } else {
    sites = [siteOf(seat.h, seat.p, seat.sweep, seat.rw, seat.m, seat.sgn, seat.r0, K, size)];
  }
  // the swell: by LAMBDA; in a chamber by one channel width (a corner of a chamber is as near a mirror image as the comma:
  // LAMBDA < 1 leaves it bare); in a tile with a side on a mirror by the channel too, where that leaves a clearly
  // smaller bare place than LAMBDA does
  let W;
  if (pair && chamber && K.chamberMargin) W = swell(group, sites, { ...K, reach: K.marginReach }, { margin: true, cover: T });
  else {
    W = swell(group, sites, K);
    if (K.mirrorMargin && !chamber && W.bare > K.bareMax * size && (K.mirrorMargin > 1 || isChamber(group, T, true))) {
      const W2 = swell(group, sites, { ...K, reach: K.marginReach }, { margin: true, cover: T });
      if (W2.bare < W.bare - K.marginGain * size) W = W2;
    }
  }
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  // one record of all the discs, for the lab's drawing
  const all = { x: [], y: [], r: [] };
  for (const S of sites) for (let i = 0; i < S.n; i++) { all.x.push(S.x[i]); all.y.push(S.y[i]); all.r.push(S.r[i]); }
  let cx = 0, cy = 0; for (let i = 0; i < all.x.length; i++) { cx += all.x[i]; cy += all.y[i]; } cx /= all.x.length; cy /= all.x.length;
  let R = 0; for (let i = 0; i < all.x.length; i++) R = Math.max(R, hyp(all.x[i] - cx, all.y[i] - cy) + all.r[i]);
  const site = { x: all.x, y: all.y, r: all.r, n: all.x.length, cx, cy, R };
  return {
    shapes: W.shapes,
    info: {
      lambda: r4(W.rule.lam), channel: r4(W.rule.w / size), bare: r4(W.bare / size), coverage: r4(W.coverage), commas: sites.length,
      comma: pair
        ? { head: r4(seat.r0 / size), D: r4(seat.D / size), sweep: r4(seat.sa), rw: r4(seat.ra), m: seat.m, hand: seat.sgn, area: r4(seat.area), bare0: r4(seat.bare0), partner: 'pair' }
        : { head: r4(seat.r0 / size), D: r4(seat.D / size), sweep: r4(seat.sweep), rw: r4(seat.rw), m: seat.m, hand: seat.sgn, area: r4(seat.area), bare0: r4(seat.bare0), partner: partnerKind(seat.g) },
      copies: W.field.copies, grid: [W.field.nx, W.field.ny],
    },
    site, tile: T, seat, swelled: W,
  };
}

function partnerKind(g) {
  const det = g.a * g.d - g.b * g.c;
  if (det < 0) return 'glide';
  if (Math.abs(g.a - 1) < 1e-9 && Math.abs(g.b) < 1e-9) return 'translation';
  const ang = Math.atan2(g.c, g.a);
  return 'rotation ' + Math.round((2 * Math.PI) / Math.abs(ang));
}

const cache = new WeakMap();

/** The motif of a group: { shapes: [{ pts: [[x, y], ...], hole }], info }. The same object for the same group object. */
export function find(group) {
  let hit = cache.get(group);
  if (!hit) { const b = build(group); hit = { shapes: b.shapes, info: b.info }; cache.set(group, hit); }
  return hit;
}
