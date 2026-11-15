// dev/patterns/designs/paisley/design.js — "Paisley": a FAMILY of commas per fundamental domain, as on a paisley cloth.
// The big comma first (the largest one the default tile holds whole), then smaller commas dropped, one after another,
// into the largest bare disc that remains, each turned, and curled or uncurled, to fit the room it finds, down to a floor.
//
// The comma: a round head and a tail that tapers along a curling spine to a point. One family with one knob `e`: at
// e = 0 the tail curls half a turn round the head, more tightly toward its tip (the page's own comma, a little
// fatter); as e grows the same tail uncurls and lengthens, until at e = 1 it is an even arc of 70 degrees — the comma
// of a long room or a thin corner, into which its tip can run. Every comma of the motif has the SAME hand (the tail
// always curls to the left of head -> tail), so in the plane every comma of the other hand is the work of a mirror
// or a glide of the group. No comma has a symmetry of its own and the big one is the only mark of its size,
// so the pattern's symmetry group is the group and no larger one (lab/exact.mjs asks 139 000 other isometries).
//
// How it stays a pattern of the orbifold and never overlaps:
//   * the motif is a list of commas; the print is the union of all their copies under the group (kit.js);
//   * a comma born at the point p lives inside the Dirichlet cell of p (all points nearer p than any copy of p),
//     shrunk by half a channel: its own copies lie in the neighbouring cells, a channel away. The big comma's cell is
//     the page's default tile when the group has presets (so that tile holds it whole), else the cell of the group's
//     deepest hole (the point farthest from its own copies);
//   * against the commas already there it keeps the channel by an exact distance between the outlines.
//
// How a comma is placed (find, below):
//   1. the big one: the largest comma the tile holds, for every turn and curl a small linear program (`inscribe`);
//      it counts by its area, less when it leaves a corner of the tile far away;
//   2. then, round after round: the largest bare disc of the plane (a distance grid over the tile and a margin); the
//      seats in and around it where a head has most room; for each seat a convex ROOM that keeps a channel from every
//      outline point there, and the largest comma in it (the same program), besides commas grown on the grid, which
//      may wind round a neighbour; the fit that ends the bare disc with the largest area wins, is checked exactly
//      against the outlines and added. Small commas are only taken while a bare disc is still too large;
//   3. the big comma is tried in up to three curls when the first cloth has a flaw (a bare disc too large, specks,
//      too dark or too light); the least flawed cloth is kept.
// The second version (13 Nov 2026, after the critique in CRITIQUE.md: "the fillers are specks", "they make figures"):
//   * at most four marks, none under 0.22 tile sizes long or with a head under 0.12 across; a disc only a speck could
//     end is given up and the next one looked at;
//   * a small mark is cut STOUT (a shorter spine, a fatter tail that keeps its width nearly to the tip, as type is cut
//     sturdier at small sizes), so its hook reads where a tile is 120 px across; a big one stays slender;
//   * the big comma is curled no further than e = 3/8 (a curled big comma is a bean, and its mirror image looks like
//     a translate of it), and it is also tried with its TIP PINNED in a thin corner of the tile, tip in one corner and
//     head at a wider one, and made smaller (0.92, 0.84, 0.76): in a kaleidoscope the corners then get commas of a
//     fair size, not specks;
//   * the first start is grown in full; when its cloth has a flaw every other start is grown quickly and the two best
//     of those once more in full (the greedy rounds are touchy: many starts looked at lightly beat a few looked at hard).
// Everything is computed in a frame of the group itself (origin group.center, x along e1, unit sqrt(domainArea)), so
// a turned, scaled or shifted group gets the turned, scaled, shifted pattern. No table per group: one rule for all 17.

import { elementsNear } from '../../../../src/groups.js';
import { buildDomain } from '../../../../src/domain.js';

export const meta = { key: 'paisley', label: 'Paisley', hint: 'a big comma and smaller ones nestled around it, as on a paisley cloth' };

/** The knobs; every length is in tile sizes (sqrt(domainArea)) unless it says otherwise. */
export const KNOBS = {
  // the comma, in units of its head's radius: the spine's length and total turn at e = 0 and e = 1; where along the
  // spine it turns (late > 0: more toward the tip; late < 0: by the head, the tail running out straight; 0: a circular
  // arc); the taper's exponent at e = 0 and e = 1 (2: the yin-yang's own; less: a fatter tail); the tip's radius
  shape: { L0: 4.2, L1: 5.8, turn0: 180, turn1: 70, late0: 0.4, late1: 0, taper0: 1.7, taper1: 1.7, tip: 0.08 },
  // the STOUT comma: the same glyph cut for a small size (as type is cut sturdier at small sizes): a shorter spine and
  // a fatter tail that keeps its width nearly to the tip, so its hook still reads where a tile is 120 px across
  stout: { L0: 3.1, L1: 3.9, turn0: 170, turn1: 85, late0: 0.45, late1: 0.25, taper0: 1.3, taper1: 1.3, tip: 0.11 },
  slenderMin: 0.2,         // a comma whose head is under this across is always the stout one ...
  stoutMax: 0.26,          // ... and one whose head is over this, always the slender one (a big stout comma is a bean)
  channel: 0.07,           // bare channel between two marks
  own: 0.06,               // ... and between a mark and its own copies (its mirror image, its turned copies): half of it on each side of the cell's edge
  curlBias: 0.15,          // area counts (1 + curlBias (1 - e)) times when two fits are compared: uncurl only where it pays
  solidMax: 0.62,          // the head's diameter is at most this
  bigMargin: 0.05,         // the big comma stays this far inside its tile (half a channel at least)
  farOk: 0.25, farPow: 1.5, // the big comma's area counts (farOk / d)^farPow times when the tile's emptiest corner is d > farOk from it
  ratioNext: 0.85,         // every later comma's head is at most this times the big one's
  bareNeed: 0.4,           // while a bare disc is larger than this, marks down to `floor` are taken; after that only ...
  floor: 0.22,             // no comma shorter than this ...
  headMin: 0.12,           // ... or with a head under this across: a bare disc that only a smaller one could end is given up
  floorWant: 0.28,         // ... marks at least this long
  coverStop: 0.58,         // ... and none at all once the dark share is this
  seatMin: 0.03,           // no comma where the room for its head is under this radius
  seatReach: 2,            // the head may sit this many radii of the bare disc from its middle (a tail reaches into a thin corner)
  seats: 3,                // how many seats are tried for one bare disc
  roomReach: 1.2,          // a seat's room is looked for this far round it
  nearPow: 2,              // a fit that stays d from the middle of the bare disc, too far to end it, counts (ok / d)^nearPow times
  progress: 0.8,           // ... and one that stays further from the middle than this share of the disc's radius does not count
  bareGoal: 0.36,          // stop when no bare disc is larger than this (diameter) ...
  coverGoal: 0.45,         // ... and the dark share has reached this
  maxMarks: 4,
  // tails into corners: a bare disc whose middle is this near a point fixed by an element (a mirror corner, a centre
  // of rotation, a mirror) is also offered commas laid TIP FIRST, the chord head -> tip pointing at that middle
  tipSpecial: 0.06,
  tails: false,            // (the lab: tails laid tip first by the greedy rounds; they never won in the 17 groups, 13 Nov, and cost a third of the time)
  tipProbe: 0.2, tipRoomMin: 0.004, tipDirs: 3,   // ... in the directions where a tip has most room this far out
  tipSeat: 0.22,           // ... the comma living in the Dirichlet cell (and the convex room) of the point this far out along the direction
  tipReach: [0.12, 0.2],   // ... its tip's middle at most this far from the middle of the disc along the direction
  rOkTip: 0.13,            // ... and it counts fully only when it comes this near the middle (a head-on fit: bareNeed / 2)
  nearPowCorner: 2,        // ... and (rOkTip / d)^nearPowCorner times when it stays d away
  debug: null,             // for the lab: a function that is told what each round did
  // the big comma is tried in a few curls (ranges of e in eighths), each grown into a family; the best cloth is kept.
  // Not under e = 3/8 (nor pinned ones, pinCurls): curled that far, a big comma is a bean, and its mirror image looks
  // like a translate of it (the second critic, 13 Nov: *2222 then kept 85 % of its tone under a half translation, 78 %
  // without; 4*2 85 and 78)
  startCurls: [[3, 4], [5, 6], [7, 8]],
  startShare: 0.6,         // ... a curl whose big comma is under this share of the best one's worth is not tried
  pinAngle: 100, pinReach: 0.08, pinCurls: [3, 8], pinShare: 0.45,   // ... then the big comma with its tip in a corner of the tile under pinAngle degrees (curls in eighths; dropped when under pinShare of the largest one's worth)
  headReach: 0.14,         // ... and with its tip there and the near edge of its head this near a wider corner
  pinMargin: 0.03, pinThin: 40,   // ... a comma pinned in a corner under pinThin degrees keeps only this from the tile's sides (the own channel's half), others bigMargin
  bigScales: [0.92, 0.84, 0.76],   // ... then the largest comma made smaller (in the middle of where it fits), which leaves the corners room for commas of a fair size
  flawOk: 0.1,             // ... and none at all once a cloth is this good
  fullAgain: 2,            // ... the best this many of the quick families are grown again in full
  startsOfKind: 2,         // ... at most this many starts of each kind besides the largest commas (pinned in a corner, corner to corner, made smaller)
  budgetBare: 0.5, budgetMin: 0.8,   // a mark that takes the dark share over coverHi is shrunk, to this share of its size at most, unless a bare disc larger than budgetBare needs it whole
  tinyLong: 0.3, wBare: 10, wCover: 5, coverLo: 0.42, coverHi: 0.6, wTiny: 0.05, wMarks: 0.03, wSmall: 0.6, wDark: 0.1,   // the flaws of a cloth, weighed (wTiny per mark under tinyLong; wMarks per mark beyond two; wSmall per share the big comma was made smaller; wDark: a little credit for the dark share)
  grid: 64,                // cells per tile size of the distance grid
  roomTurns: 24, growTurns: 18,   // turns tried for a comma in a seat's room, and grown from a seat
  pad: 0.65,               // the grid reaches this far beyond the tile
  seg: 0.016,              // outline segments are at most this long ...
  segAngle: 7,             // ... and turn at most this many degrees
};

const TAU = 2 * Math.PI;

// ---------------------------------------------------------------------------------------------------------------
// The comma. Unit = the head's radius; the head's centre is the origin, the tail leaves upward (+y) and curls left.
// It is the union of the discs of radius w(t) along the spine, w falling from 1 at the head to `tip` at the end.
// ---------------------------------------------------------------------------------------------------------------
const SHAPES = new Map();
/** For the lab: forget the cached shapes after KNOBS.shape was changed. */
export function resetShapes() { SHAPES.clear(); }
const E_STEPS = 16;
function shapeOf(e, st = 0) {
  const ek = Math.max(0, Math.min(E_STEPS, Math.round(e * E_STEPS))), key = ek + (st ? 100 : 0);
  let S = SHAPES.get(key);
  if (S) return S;
  e = ek / E_STEPS;
  const K = st ? KNOBS.stout : KNOBS.shape, L = K.L0 + (K.L1 - K.L0) * e, Th = ((K.turn0 + (K.turn1 - K.turn0) * e) * Math.PI) / 180, m = K.late0 + (K.late1 - K.late0) * e, q = K.taper0 + (K.taper1 - K.taper0) * e;
  const cEnd = Math.acos(Math.pow(K.tip, 1 / q));               // w(1) = tip
  const w = (t) => Math.pow(Math.cos(cEnd * t), q), dw = (t) => -q * cEnd * Math.sin(cEnd * t) * Math.pow(Math.cos(cEnd * t), q - 1);
  const th = (t) => Math.PI / 2 + Th * ((1 - m) * t + m * t * t);
  const N = 360, sub = 2, P = new Float64Array(2 * (N + 1));
  for (let i = 1; i <= N; i++) {
    let x = P[2 * i - 2], y = P[2 * i - 1];
    const t0 = (i - 1) / N, dt = 1 / N / sub;
    for (let k = 0; k < sub; k++) {
      const a = th(t0 + k * dt), b = th(t0 + (k + 0.5) * dt), c = th(t0 + (k + 1) * dt);
      x += (L * dt * (Math.cos(a) + 4 * Math.cos(b) + Math.cos(c))) / 6; y += (L * dt * (Math.sin(a) + 4 * Math.sin(b) + Math.sin(c))) / 6;
    }
    P[2 * i] = x; P[2 * i + 1] = y;
  }
  const right = new Float64Array(2 * (N + 1)), left = new Float64Array(2 * (N + 1));
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = th(t), wt = dw(t) / L, ww = w(t), s = Math.sqrt(Math.max(0, 1 - wt * wt)), tx = Math.cos(a), ty = Math.sin(a);
    // where the disc at t touches the envelope: tilted forward by the taper
    right[2 * i] = P[2 * i] + ww * (-wt * tx + s * ty); right[2 * i + 1] = P[2 * i + 1] + ww * (-wt * ty - s * tx);
    left[2 * i] = P[2 * i] + ww * (-wt * tx - s * ty); left[2 * i + 1] = P[2 * i + 1] + ww * (-wt * ty + s * tx);
  }
  const d = [];
  const arc = (cx, cy, r, a0, a1, n) => { while (a1 < a0) a1 += TAU; for (let i = 1; i < n; i++) { const f = a0 + ((a1 - a0) * i) / n; d.push(cx + r * Math.cos(f), cy + r * Math.sin(f)); } };
  d.push(left[0], left[1]);
  arc(0, 0, 1, Math.atan2(left[1], left[0]), Math.atan2(right[1], right[0]), 120);                   // round the head's back
  for (let i = 0; i <= N; i++) d.push(right[2 * i], right[2 * i + 1]);                                // up the tail's outer side
  const ex = P[2 * N], ey = P[2 * N + 1];
  arc(ex, ey, w(1), Math.atan2(right[2 * N + 1] - ey, right[2 * N] - ex), Math.atan2(left[2 * N + 1] - ey, left[2 * N] - ex), 22);  // round the tip
  for (let i = N; i > 0; i--) d.push(left[2 * i], left[2 * i + 1]);                                   // back down the hollow
  const dense = Float64Array.from(d);
  let A = 0, reach = 0;
  for (let i = 0, n = dense.length / 2; i < n; i++) { const j = (i + 1) % n; A += dense[2 * i] * dense[2 * j + 1] - dense[2 * j] * dense[2 * i + 1]; reach = Math.max(reach, Math.hypot(dense[2 * i], dense[2 * i + 1])); }
  const discs = [];
  for (const t of [0, 0.2, 0.4, 0.6, 0.8]) { const i = Math.round(t * N); discs.push([P[2 * i], P[2 * i + 1], w(t)]); }
  // its length: the largest distance between two points of the outline (on a thinned copy)
  const thin = decimate(dense, 1, 0.5, 20);
  let span = 0;
  for (let i = 0; i < thin.length; i += 2) for (let j = i + 2; j < thin.length; j += 2) span = Math.max(span, Math.hypot(thin[i] - thin[j], thin[i + 1] - thin[j + 1]));
  // how wide the tail is along the spine (in head radii, at t = 0.5, 0.7, 0.85): for the lab's count of thin tails
  // the spine's end (the middle of the tip) and the tip's radius: for a comma laid tip first into a corner
  S = { e, st: st ? 1 : 0, L, turn: Th, dense, coarse: decimate(dense, 1, 0.42, 15), area: A / 2, reach, span, discs, wAt: [w(0.5), w(0.7), w(0.85)], end: [ex, ey], tipR: w(1) };
  SHAPES.set(key, S);
  return S;
}
/** For the lab: the outline of the unit comma (head radius 1) of curl e, slender (st 0) or stout (st 1), and its sizes. */
export function glyph(e, st = 0) { const S = shapeOf(e, st); return { pts: S.dense, span: S.span, area: S.area, reach: S.reach, wAt: S.wAt }; }

/** A closed outline thinned: between two kept points the path is at most `step` long (after scaling) and turns at most `deg` degrees. */
function decimate(d, scale, step, deg) {
  const n = d.length / 2, out = [d[0], d[1]], lim = (deg * Math.PI) / 180;
  let len = 0, turn = 0, last = 0;
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n, dx = d[2 * j] - d[2 * k], dy = d[2 * j + 1] - d[2 * k + 1], l = Math.hypot(dx, dy) * scale, dir = Math.atan2(dy, dx);
    let dt = 0;
    if (len > 0) { dt = Math.abs(dir - last); if (dt > Math.PI) dt = TAU - dt; }
    if (len > 0 && (len + l > step || turn + dt > lim)) { out.push(d[2 * k], d[2 * k + 1]); len = l; turn = 0; } else { len += l; turn += dt; }
    last = dir;
  }
  return Float64Array.from(out);
}

/** The unit points placed: scaled by s, turned by al, the head's centre at (cx, cy). */
function place(unit, cx, cy, al, s, out) {
  const ca = Math.cos(al) * s, sa = Math.sin(al) * s, n = unit.length;
  out = out || new Float64Array(n);
  for (let i = 0; i < n; i += 2) { const x = unit[i], y = unit[i + 1]; out[i] = cx + ca * x - sa * y; out[i + 1] = cy + sa * x + ca * y; }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Convex polygons: Dirichlet cells and their half-planes
// ---------------------------------------------------------------------------------------------------------------
function clip(poly, nx, ny, c) {                               // keep n.x <= c
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n], sp = nx * p[0] + ny * p[1] - c, sq = nx * q[0] + ny * q[1] - c;
    if (sp <= 0) out.push(p);
    if ((sp <= 0) !== (sq <= 0)) { const t = sp / (sp - sq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
  }
  return out;
}
/** The Dirichlet cell of the point (px, py): nearer to it than to any of its copies g(p), g in els (flat, 6 per element). */
function dirichlet(px, py, els, reach) {
  const B = reach;
  let P = [[px - B, py - B], [px + B, py - B], [px + B, py + B], [px - B, py + B]];
  for (let k = 0; k < els.length; k += 6) {
    const qx = els[k] * px + els[k + 1] * py + els[k + 4], qy = els[k + 2] * px + els[k + 3] * py + els[k + 5];
    const dx = qx - px, dy = qy - py, d = Math.hypot(dx, dy);
    if (d < 1e-9 || d > 2.9 * B) continue;
    P = clip(P, dx / d, dy / d, ((px + qx) * dx + (py + qy) * dy) / (2 * d));
    if (P.length < 3) break;
  }
  return P;
}
/** Outward half-planes [nx, ny, c] (n.x <= c inside) of a convex polygon, moved inward by `margin`. */
function halfPlanes(poly, margin) {
  let A = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
  const sgn = A >= 0 ? 1 : -1, out = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy);
    if (l < 1e-7) continue;
    const nx = (sgn * dy) / l, ny = (-sgn * dx) / l;
    out.push(nx, ny, nx * p[0] + ny * p[1] - margin);
  }
  return Float64Array.from(out);
}
/** min over g != 1 of |g(p) - p| (the identity is not in `els`): 0 on a mirror or a rotation centre. */
function selfDistance(px, py, els) {
  let best = Infinity;
  for (let k = 0; k < els.length; k += 6) {
    const dx = els[k] * px + els[k + 1] * py + els[k + 4] - px, dy = els[k + 2] * px + els[k + 3] * py + els[k + 5] - py, d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// ---------------------------------------------------------------------------------------------------------------
// The largest comma of a given shape and turn in a convex region: a linear program in (x, y, s), solved by looking
// at every corner of its feasible set (three sides at a time)
// ---------------------------------------------------------------------------------------------------------------
const LP_A = new Float64Array(3 * 80), LP_B = new Float64Array(80);
/**
 * hp: the region's half-planes; width (optional): for each, how far the region reaches back from that side. The comma
 * must be larger than sMin to be of use: with `width` a quick bound (the comma's extent across each side against the
 * region's) drops most turns before the program is solved. Returns { s, x, y } or null.
 */
function inscribe(hp, unit, al, sCap, slack, sMin = 0, width = null, pin = null) {
  const m = hp.length / 3, ca = Math.cos(al), sa = Math.sin(al), nu = unit.length, A = LP_A, B = LP_B;
  if (m + 2 > 80) return null;
  for (let j = 0; j < m; j++) {
    const nx = hp[3 * j], ny = hp[3 * j + 1], ux = nx * ca + ny * sa, uy = -nx * sa + ny * ca;         // n . R(al) p
    let h = -Infinity, l = Infinity;
    for (let i = 0; i < nu; i += 2) { const v = ux * unit[i] + uy * unit[i + 1]; if (v > h) h = v; if (v < l) l = v; }
    if (width && width[j] <= sMin * (h - l)) return null;
    A[3 * j] = nx; A[3 * j + 1] = ny; A[3 * j + 2] = h + slack; B[j] = hp[3 * j + 2];
  }
  A[3 * m] = 0; A[3 * m + 1] = 0; A[3 * m + 2] = 1; B[m] = sCap;
  let M = m + 1;
  // pin = [nx, ny, c, px, py, k] (or a list of them): the point (px, py) of the unit comma, moved k head radii along -n,
  // held on the inner side n . x <= c (a tip in a corner: k = 0; the near edge of the head at a corner: (0, 0), k = 1)
  const pins = pin ? (Array.isArray(pin[0]) ? pin : [pin]) : [];
  for (const q of pins) { A[3 * M] = q[0]; A[3 * M + 1] = q[1]; A[3 * M + 2] = q[0] * (ca * q[3] - sa * q[4]) + q[1] * (sa * q[3] + ca * q[4]) - (q[5] || 0); B[M] = q[2]; M++; }
  let best = -1, bx = 0, by = 0, cnt = 0;
  for (let i = 0; i < M; i++) for (let j = i + 1; j < M; j++) {
    const a1 = A[3 * i], b1 = A[3 * i + 1], c1 = A[3 * i + 2], a2 = A[3 * j], b2 = A[3 * j + 1], c2 = A[3 * j + 2], d1 = B[i], d2 = B[j];
    const m12 = a1 * b2 - a2 * b1, mbc = b1 * c2 - b2 * c1, mac = a1 * c2 - a2 * c1, mdb = d1 * b2 - d2 * b1, mdc = d1 * c2 - d2 * c1, mad = a1 * d2 - a2 * d1;
    for (let k = j + 1; k < M; k++) {
      const a3 = A[3 * k], b3 = A[3 * k + 1], c3 = A[3 * k + 2], d3 = B[k];
      const det = a3 * mbc - b3 * mac + c3 * m12;
      if (det < 1e-12 && det > -1e-12) continue;
      const s = (a3 * -mdb - b3 * mad + d3 * m12) / det;
      if (s <= sMin || s < best - 1e-7) continue;
      const x = (d3 * mbc - b3 * mdc + c3 * mdb) / det, y = (a3 * mdc - d3 * mac + c3 * mad) / det;
      let ok = true;
      for (let q = 0; q < M; q++) if (A[3 * q] * x + A[3 * q + 1] * y + A[3 * q + 2] * s > B[q] + 1e-9) { ok = false; break; }
      if (!ok) continue;
      if (s > best + 1e-7) { best = s; bx = x; by = y; cnt = 1; } else { bx += x; by += y; cnt++; if (s > best) best = s; }
    }
  }
  return best > 0 ? { s: best, x: bx / cnt, y: by / cnt } : null;
}

// ---------------------------------------------------------------------------------------------------------------
// The distance grid
// ---------------------------------------------------------------------------------------------------------------
function edt(dark, w, h, out) {                                // exact Euclidean distance to the nearest dark cell, in cells
  // down the columns: the distance to the nearest dark cell of the same column, squared (two sweeps; the frame is dark)
  const INF = 1e12;
  for (let x = 0; x < w; x++) {
    let d = INF;
    for (let y = 0, o = x; y < h; y++, o += w) { d = dark[o] ? 0 : d + 1; out[o] = d; }
    d = INF;
    for (let y = h - 1, o = (h - 1) * w + x; y >= 0; y--, o -= w) { d = dark[o] ? 0 : d + 1; const m = d < out[o] ? d : out[o]; out[o] = m * m; }
  }
  // along the rows: the lower envelope of the parabolas (Felzenszwalb and Huttenlocher)
  const f = new Float64Array(w), v = new Int32Array(w), z = new Float64Array(w + 1);
  for (let y = 0, r = 0; y < h; y++, r += w) {
    for (let x = 0; x < w; x++) f[x] = out[r + x];
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < w; q++) {
      let s;
      for (;;) { const p = v[k]; s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
      if (s <= z[k]) { v[k] = q; z[k] = -INF; z[k + 1] = INF; } else { k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    }
    k = 0;
    for (let q = 0; q < w; q++) { while (z[k + 1] < q) k++; const p = v[k]; out[r + q] = Math.sqrt((q - p) * (q - p) + f[p]); }
  }
  return out;
}

/** Mark the cells whose centre lies in the polygon (flat points, in cells). */
function stamp(dark, w, h, p, n2) {
  const n = n2 / 2;
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { const y = p[2 * i + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const r0 = Math.max(0, Math.ceil(y0 - 0.5)), r1 = Math.min(h - 1, Math.floor(y1 - 0.5));
  const xs = [];
  for (let r = r0; r <= r1; r++) {
    const y = r + 0.5;
    xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = p[2 * i + 1], yj = p[2 * j + 1];
      if ((yi > y) !== (yj > y)) xs.push(p[2 * i] + ((y - yi) * (p[2 * j] - p[2 * i])) / (yj - yi));
    }
    xs.sort((u, q) => u - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil(xs[k] - 0.5)), c1 = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let c = c0; c <= c1; c++) dark[r * w + c] = 1;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Exact distances between outlines
// ---------------------------------------------------------------------------------------------------------------
function pointIn(p, x, y) {
  let inn = false;
  for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
    const yi = p[2 * i + 1], yj = p[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < p[2 * i] + ((y - yi) * (p[2 * j] - p[2 * i])) / (yj - yi)) inn = !inn;
  }
  return inn;
}
/**
 * Smallest distance from the vertices of P to the outline Q, looked at only where it can be under `lim`. When it is,
 * NEAR holds the pair: the vertex of P, then the point of Q.
 */
const NEAR = [0, 0, 0, 0];
const ROOM_SECTORS = 24, SECTOR_C = new Float64Array(ROOM_SECTORS), SECTOR_S = new Float64Array(ROOM_SECTORS), SECTOR_D = new Float64Array(ROOM_SECTORS);
for (let k = 0; k < ROOM_SECTORS; k++) { SECTOR_C[k] = Math.cos((k * TAU) / ROOM_SECTORS); SECTOR_S[k] = Math.sin((k * TAU) / ROOM_SECTORS); }
function vertsToOutline(P, Q, qcx, qcy, qr, lim) {
  let best = lim * lim;
  const nq = Q.length / 2, np = P.length / 2;
  for (let i = 0; i < np; i++) {
    const x = P[2 * i], y = P[2 * i + 1];
    if (Math.hypot(x - qcx, y - qcy) > qr + lim) continue;
    for (let k = 0, l = nq - 1; k < nq; l = k++) {
      const ax = Q[2 * l], ay = Q[2 * l + 1], ex = Q[2 * k] - ax, ey = Q[2 * k + 1] - ay, l2 = ex * ex + ey * ey;
      let t = l2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = ax + t * ex - x, dy = ay + t * ey - y, d = dx * dx + dy * dy;
      if (d < best) { best = d; NEAR[0] = x; NEAR[1] = y; NEAR[2] = ax + t * ex; NEAR[3] = ay + t * ey; }
    }
  }
  return Math.sqrt(best);
}

// ---------------------------------------------------------------------------------------------------------------
// find
// ---------------------------------------------------------------------------------------------------------------
export function find(group) {
  const K = KNOBS, c = K.channel;
  const u = Math.sqrt(group.domainArea), l1 = Math.hypot(group.e1[0], group.e1[1]);
  const ex = group.e1[0] / l1, ey = group.e1[1] / l1, Ox = group.center[0], Oy = group.center[1];
  const toLocal = (x, y) => [((x - Ox) * ex + (y - Oy) * ey) / u, (-(x - Ox) * ey + (y - Oy) * ex) / u];
  const localEls = (wx, wy, radius) => {                        // the elements g != 1 with |g(w) - w| <= radius, in the local frame
    const list = elementsNear(group, wx, wy, radius, wx, wy), out = new Float64Array(6 * list.length);
    let k = 0;
    for (const g of list) {
      // x_world = O + u R xi  =>  xi' = R^T L R xi + R^T (L O + t - O) / u,  R = [ex -ey; ey ex]
      const a = g.a * ex + g.b * ey, b2 = -g.a * ey + g.b * ex, c2 = g.c * ex + g.d * ey, d = -g.c * ey + g.d * ex;   // L R
      const tx = g.a * Ox + g.b * Oy + g.tx - Ox, ty = g.c * Ox + g.d * Oy + g.ty - Oy;
      const la = ex * a + ey * c2, lb = ex * b2 + ey * d, lc = -ey * a + ex * c2, ld = -ey * b2 + ex * d;
      const ltx = (ex * tx + ey * ty) / u, lty = (-ey * tx + ex * ty) / u;
      if (Math.abs(la - 1) < 1e-9 && Math.abs(ld - 1) < 1e-9 && Math.abs(lb) < 1e-9 && Math.abs(lc) < 1e-9 && Math.abs(ltx) < 1e-9 && Math.abs(lty) < 1e-9) continue;
      out[k++] = la; out[k++] = lb; out[k++] = lc; out[k++] = ld; out[k++] = ltx; out[k++] = lty;
    }
    return out.subarray(0, k);
  };

  // ---- the tile of the big comma --------------------------------------------------------------------------------
  let tile = null, seated = 'tile';
  if (group.presets && group.presets[0] && group.presets[0].seed) {
    try { tile = buildDomain(group, { seed: group.presets[0].seed, metric: group.presets[0].metric }).poly.map((p) => toLocal(p[0], p[1])); } catch (err) { tile = null; }
  }
  if (!tile || tile.length < 3) {
    seated = 'hole';
    const L = (l1 + Math.hypot(group.e2[0], group.e2[1])) / u;
    const els0 = localEls(Ox, Oy, (2.2 * L + 1) * u);
    const lat = (s, t) => toLocal(Ox + s * group.e1[0] + t * group.e2[0], Oy + s * group.e1[1] + t * group.e2[1]);
    let q = null, qs = -1;
    for (const [s, t] of [[0.137, 0.291], [0.31, 0.12], [-0.21, 0.37], [0.43, -0.17], [-0.33, -0.29], [0.07, 0.45]]) {
      const p = lat(s, t), v = selfDistance(p[0], p[1], els0);
      if (v > qs + 1e-9) { qs = v; q = p; }
    }
    const T0 = dirichlet(q[0], q[1], els0, 1.6 * L + 1);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, mx = 0, my = 0;
    for (const p of T0) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); mx += p[0] / T0.length; my += p[1] / T0.length; }
    const hp0 = halfPlanes(T0, 0), inT0 = (x, y) => { for (let j = 0; j < hp0.length; j += 3) if (hp0[j] * x + hp0[j + 1] * y > hp0[j + 2] + 1e-9) return false; return true; };
    let best = -1, bp = q;
    const score = (x, y) => selfDistance(x, y, els0) - 0.004 * Math.hypot(x - mx, y - my);
    for (let j = 0; j <= 28; j++) for (let i = 0; i <= 28; i++) {
      const x = x0 + ((x1 - x0) * i) / 28, y = y0 + ((y1 - y0) * j) / 28;
      if (!inT0(x, y)) continue;
      const v = score(x, y);
      if (v > best + 1e-9) { best = v; bp = [x, y]; }
    }
    for (let step = Math.max(x1 - x0, y1 - y0) / 28, it = 0; it < 40 && step > 1e-5; it++) {       // climb to the top of the hole
      let moved = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
        const v = score(bp[0] + dx * step, bp[1] + dy * step);
        if (v > best + 1e-10) { best = v; bp = [bp[0] + dx * step, bp[1] + dy * step]; moved = true; }
      }
      if (!moved) step /= 2;
    }
    tile = dirichlet(bp[0], bp[1], els0, 1.6 * L + 1);
  }
  let tcx = 0, tcy = 0, rT = 0, bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const p of tile) { tcx += p[0] / tile.length; tcy += p[1] / tile.length; bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
  for (const p of tile) rT = Math.max(rT, Math.hypot(p[0] - tcx, p[1] - tcy));
  const els = localEls(Ox + u * (tcx * ex - tcy * ey), Oy + u * (tcx * ey + tcy * ex), (2 * rT + 3.2) * u);
  const tileHP = halfPlanes(tile, 0);
  const weight = (S) => S.area * (1 + K.curlBias * (1 - S.e));
  const sCap = K.solidMax / 2;

  // ---- the big comma: the largest the tile holds, over turns; one for each of a few curls ---------------------------
  const starts = [];
  {
    const hp = halfPlanes(tile, K.bigMargin);
    const fit = (al, e) => {
      const S = shapeOf(e), r = inscribe(hp, S.coarse, al, sCap, 0.012);
      if (!r) return null;
      // how far the emptiest corner of the tile is left from the comma: a comma that reaches into the corners counts more
      const ca = Math.cos(al) * r.s, sa = Math.sin(al) * r.s, cu = S.coarse;
      let far = 0;
      for (const v of tile) {
        let m = Infinity;
        for (let i = 0; i < cu.length; i += 2) { const dx = r.x + ca * cu[i] - sa * cu[i + 1] - v[0], dy = r.y + sa * cu[i] + ca * cu[i + 1] - v[1], d = dx * dx + dy * dy; if (d < m) m = d; }
        if (m > far) far = m;
      }
      far = Math.sqrt(far);
      r.al = al; r.e = S.e; r.obj = r.s * r.s * weight(S) * (far <= K.farOk ? 1 : Math.pow(K.farOk / far, K.farPow));
      return r;
    };
    const perE = [];
    for (let k = 0; k <= 8; k++) {
      let best = null;
      for (let i = 0; i < 72; i++) { const r = fit((i * TAU) / 72, k / 8); if (r && (!best || r.obj > best.obj * (1 + 1e-6))) best = r; }
      perE.push(best);
    }
    let top = 0;
    for (const [k0, k1] of K.startCurls) for (let k = k0; k <= k1; k++) if (perE[k] && perE[k].obj > top) top = perE[k].obj;
    for (const [k0, k1] of K.startCurls) {
      let best = null;
      for (let k = k0; k <= k1; k++) if (perE[k] && (!best || perE[k].obj > best.obj * (1 + 1e-6))) best = perE[k];
      if (!best || best.obj < K.startShare * top) continue;
      for (let da = TAU / 144, it = 0; it < 6; it++, da /= 2) for (const al of [best.al + da, best.al - da]) { const r = fit(al, best.e); if (r && r.obj > best.obj * (1 + 1e-6)) best = r; }
      starts.push({ x: best.x, y: best.y, al: best.al, e: best.e, s: best.s, obj: best.obj, f: 1 });
    }
    starts.sort((p, q) => q.obj - p.obj);
    const n0 = starts.length;
    // the big comma laid with its TIP IN A THIN CORNER of the tile (a centre or a corner of mirrors, where only a tail
    // gets in): the same program with one more side, the tip's middle at most pinReach beyond the nearest place it fits
    const nv = tile.length, cornerStarts = [], pairStarts = [], vx = [];
    for (let i = 0; i < nv; i++) {                              // each corner of the tile: where, its angle, the way into the tile
      const v = tile[i], a = tile[(i + nv - 1) % nv], b = tile[(i + 1) % nv];
      const ax = a[0] - v[0], ay = a[1] - v[1], bx = b[0] - v[0], by = b[1] - v[1], la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 1e-9 || lb < 1e-9) continue;
      const phi = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))));
      let ux = ax / la + bx / lb, uy = ay / la + by / lb;
      const lu = Math.hypot(ux, uy); ux /= lu; uy /= lu;
      vx.push({ i, v, phi, ux, uy });
    }
    // the largest comma (over curls in eighths and 72 turns) with its pins; refined in the turn
    // (a comma pinned in a corner keeps only the own channel from the tile's sides: with bigMargin its tip could not
    // get into a corner of 30 degrees nearer than 0.27, and twelve tips round a 6-fold corner left it bare)
    // (only round a corner thinner than pinThin: elsewhere the wider margin left more room for the commas after it)
    const hpThin = halfPlanes(tile, K.pinMargin);
    const marginOf = (c) => (c.phi < (K.pinThin * Math.PI) / 180 ? K.pinMargin : K.bigMargin);
    const pinned = (pinsOf, hpP) => {
      let best = null;
      for (let k = K.pinCurls[0]; k <= K.pinCurls[1]; k++) {
        const S = shapeOf(k / 8), pin = pinsOf(S);
        for (let j = 0; j < 72; j++) {
          const al = (j * TAU) / 72, r = inscribe(hpP, S.coarse, al, sCap, 0.012, 0, null, pin);
          if (!r) continue;
          r.obj = r.s * r.s * weight(S);
          if (!best || r.obj > best.obj * (1 + 1e-6)) { best = r; best.al = al; best.e = S.e; best.pin = pin; }
        }
      }
      if (!best) return null;
      for (let da = TAU / 144, it = 0; it < 5; it++, da /= 2) for (const al of [best.al + da, best.al - da]) {
        const S = shapeOf(best.e), r = inscribe(hpP, S.coarse, al, sCap, 0.012, 0, null, best.pin);
        if (r && r.s * r.s * weight(S) > best.obj * (1 + 1e-6)) { r.obj = r.s * r.s * weight(S); r.al = al; r.e = best.e; r.pin = best.pin; best = r; }
      }
      return best;
    };
    const tipPin = (c, S) => [c.ux, c.uy, c.ux * c.v[0] + c.uy * c.v[1] + (marginOf(c) + 0.02) / Math.sin(c.phi / 2) + K.pinReach, S.end[0], S.end[1], 0];
    const headPin = (c, m) => [c.ux, c.uy, c.ux * c.v[0] + c.uy * c.v[1] + m / Math.sin(c.phi / 2) + K.headReach, 0, 0, 1];
    for (const T of vx) {
      if (T.phi > (K.pinAngle * Math.PI) / 180) continue;
      const hpT = marginOf(T) === K.pinMargin ? hpThin : hp;
      // the tip in corner T ...
      const one = pinned((S) => tipPin(T, S), hpT);
      if (one && one.obj >= K.pinShare * starts[0].obj) cornerStarts.push({ x: one.x, y: one.y, al: one.al, e: one.e, s: one.s, obj: one.obj, f: 1, corner: T.i, phi: T.phi });
      // ... and the head at a wider corner W too: one comma that spans the tile from corner to corner
      for (const W of vx) {
        if (W === T || W.phi < T.phi - 1e-6 || (Math.abs(W.phi - T.phi) < 1e-6 && W.i < T.i)) continue;
        const two = pinned((S) => [tipPin(T, S), headPin(W, marginOf(T))], hpT);
        if (two && two.obj >= K.pinShare * starts[0].obj) pairStarts.push({ x: two.x, y: two.y, al: two.al, e: two.e, s: two.s, obj: two.obj, f: 1, corner: T.i, head: W.i, phi: T.phi });
      }
    }
    // the thinnest corner first (a head never fills it; of corners alike, the larger comma first)
    const byCorner = (p, q) => (Math.abs(p.phi - q.phi) > 1e-6 ? p.phi - q.phi : q.obj - p.obj);
    pairStarts.sort(byCorner);
    cornerStarts.sort(byCorner);
    // the same big commas made smaller, each where the tile has most room for it (the program with a capped size puts
    // it in the middle of the places it fits): a corner that only a speck could reach gets room for a comma
    const scaled = [];
    for (const f of K.bigScales) {                              // (of the largest comma of all)
      const b = starts[0], r = inscribe(hp, shapeOf(b.e).coarse, b.al, f * b.s, 0.012);
      if (r && r.s > 0.98 * f * b.s) scaled.push({ x: r.x, y: r.y, al: b.al, e: b.e, s: r.s, obj: b.obj * f * f, f });
    }
    // the starts: the largest comma of each curl range, then the first few pinned ones of each kind, the smaller ones
    const n = K.startsOfKind;
    for (const s of [...pairStarts.slice(0, n), ...cornerStarts.slice(0, n), ...scaled]) starts.push(s);
  }
  if (!starts.length) return { shapes: [], info: { error: 'no room for a comma' } };

  // ---- the grid: distance to the nearest dark point, over the tile and a margin ------------------------------------
  const h = 1 / K.grid, gx0 = bx0 - K.pad, gy0 = by0 - K.pad, gw = Math.ceil((bx1 - bx0 + 2 * K.pad) / h), gh = Math.ceil((by1 - by0 + 2 * K.pad) / h);
  const wcx = gx0 + (gw * h) / 2, wcy = gy0 + (gh * h) / 2, wr = Math.hypot(gw * h, gh * h) / 2;
  // the cells of the tile (the dark share is counted on them), and with them the cells of a rim of a cell and a half
  // round it: the largest bare disc is often centred ON a corner or a side of the tile (a rotation centre, a mirror)
  const cells = [], rim = [];
  for (let j = 1; j < gh - 1; j++) for (let i = 1; i < gw - 1; i++) {
    const x = gx0 + (i + 0.5) * h, y = gy0 + (j + 0.5) * h;
    let out = -Infinity;
    for (let q = 0; q < tileHP.length; q += 3) out = Math.max(out, tileHP[q] * x + tileHP[q + 1] * y - tileHP[q + 2]);
    if (out <= 1e-9) cells.push(j * gw + i);
    if (out <= 1.5 * h) rim.push(j * gw + i);
  }
  const dark = new Uint8Array(gw * gh), D = new Float64Array(gw * gh);
  const selfCache = new Float32Array(gw * gh).fill(-1);          // per cell, when first asked: how far the cell is from its own copies
  const selfAt = (i, j) => { const o = j * gw + i; let v = selfCache[o]; if (v < 0) { v = selfDistance(gx0 + (i + 0.5) * h, gy0 + (j + 0.5) * h, els); selfCache[o] = v; } return v; };
  let tmp = new Float64Array(4096);
  const need = c / h + 0.8;                                    // in cells; the grid measures to cell centres, up to 0.71 of a cell inside a mark: that much slack, the exact check follows

  // ---- a family: the big comma, then smaller ones, each in the largest bare disc that remains -----------------------
  // Q: how hard a family looks (FULL, or QUICK: a third of the work, to rank the starts)
  const FULL = { seats: K.seats, roomTurns: K.roomTurns, growTurns: K.growTurns, growAt: 5, curlStep: 1, refine: 5 };
  const QUICK = { seats: 2, roomTurns: 16, growTurns: 10, growAt: 3, curlStep: 2, refine: 3 };
  let Q = FULL;
  const family = (big, q = FULL) => {
    Q = q;
    dark.fill(0);
    for (let i = 0; i < gw; i++) { dark[i] = 1; dark[(gh - 1) * gw + i] = 1; }         // beyond the grid nothing is known: a dark frame
    for (let j = 0; j < gh; j++) { dark[j * gw] = 1; dark[j * gw + gw - 1] = 1; }
    const marks = [], copies = [];                             // copies: every copy of every mark that reaches the grid, fine outlines
    const addMark = (mk) => {
      const S = shapeOf(mk.e, mk.st);
      mk.pts = place(decimate(S.dense, mk.s, K.seg, K.segAngle), mk.x, mk.y, mk.al, mk.s);
      mk.long = mk.s * S.span;
      const n = mk.pts.length, mr = S.reach * mk.s;
      if (tmp.length < n) tmp = new Float64Array(n);
      for (let g = -6; g < els.length; g += 6) {               // g = -6: the identity (it is not in `els`)
        const id = g < 0;
        const cx = id ? mk.x : els[g] * mk.x + els[g + 1] * mk.y + els[g + 4], cy = id ? mk.y : els[g + 2] * mk.x + els[g + 3] * mk.y + els[g + 5];
        if (Math.hypot(cx - wcx, cy - wcy) > wr + mr) continue;
        const P = id ? mk.pts : new Float64Array(n);
        for (let i = 0; i < n; i += 2) {
          if (!id) { const x = mk.pts[i], y = mk.pts[i + 1]; P[i] = els[g] * x + els[g + 1] * y + els[g + 4]; P[i + 1] = els[g + 2] * x + els[g + 3] * y + els[g + 5]; }
          tmp[i] = (P[i] - gx0) / h; tmp[i + 1] = (P[i + 1] - gy0) / h;
        }
        stamp(dark, gw, gh, tmp, n);
        copies.push({ pts: P, cx, cy, r: mr });
      }
      marks.push(mk);
    };
    const dAt = (x, y) => {                                     // bilinear, in cells; 0 beyond the grid
      const fx = (x - gx0) / h - 0.5, fy = (y - gy0) / h - 0.5, i = Math.floor(fx), j = Math.floor(fy);
      if (i < 0 || j < 0 || i >= gw - 1 || j >= gh - 1) return 0;
      const ax = fx - i, ay = fy - j, o = j * gw + i;
      return ((1 - ax) * D[o] + ax * D[o + 1]) * (1 - ay) + ((1 - ax) * D[o + gw] + ax * D[o + gw + 1]) * ay;
    };
    let khp = null;
    const feasible = (S, x0, y0, al, s) => {
      const ca = Math.cos(al) * s, sa = Math.sin(al) * s, cu = S.coarse, ncu = cu.length;
      for (const d of S.discs) {                                // the discs inside the comma: quick, and they see a mark swallowed whole
        if (dAt(x0 + ca * d[0] - sa * d[1], y0 + sa * d[0] + ca * d[1]) < need + (s * d[2]) / h) return false;
      }
      for (let i = 0; i < ncu; i += 2) {
        const x = x0 + ca * cu[i] - sa * cu[i + 1], y = y0 + sa * cu[i] + ca * cu[i + 1];
        for (let q = 0; q < khp.length; q += 3) if (khp[q] * x + khp[q + 1] * y > khp[q + 2]) return false;
        if (dAt(x, y) < need) return false;
      }
      return true;
    };
    /** How near the comma comes to the point (bx, by): the smallest distance from its outline (coarse). */
    const nearest = (S, x0, y0, al, s, bx, by) => {
      const ca = Math.cos(al) * s, sa = Math.sin(al) * s, cu = S.coarse;
      let m = Infinity;
      for (let i = 0; i < cu.length; i += 2) { const dx = x0 + ca * cu[i] - sa * cu[i + 1] - bx, dy = y0 + sa * cu[i] + ca * cu[i + 1] - by, d = dx * dx + dy * dy; if (d < m) m = d; }
      return Math.sqrt(m);
    };
    /**
     * The room of a seat: a convex polygon round it, inside its Dirichlet cell (hp: already half a channel in), that
     * keeps a channel from every outline point of every mark there. One side for each of ROOM_SECTORS directions n:
     * n . (x - seat) <= d - channel, d = the smallest n . (q - seat) over the outline points q in that direction's
     * sector. A comma is then fitted into it exactly (the linear program of `inscribe`).
     */
    const roomOf = (px, py, hp) => {
      const R = K.roomReach, R2 = R * R, d = SECTOR_D.fill(R);
      for (const C of copies) {
        if (Math.hypot(C.cx - px, C.cy - py) > C.r + R) continue;
        const P = C.pts;
        for (let i = 0; i < P.length; i += 2) {
          const vx = P[i] - px, vy = P[i + 1] - py;
          if (vx * vx + vy * vy > R2) continue;
          let k = Math.round((Math.atan2(vy, vx) * ROOM_SECTORS) / TAU);
          if (k < 0) k += ROOM_SECTORS;
          const pr = vx * SECTOR_C[k] + vy * SECTOR_S[k];
          if (pr < d[k]) d[k] = pr;
        }
      }
      let P = [[px - R, py - R], [px + R, py - R], [px + R, py + R], [px - R, py + R]];
      for (let q = 0; q < hp.length && P.length >= 3; q += 3) P = clip(P, hp[q], hp[q + 1], hp[q + 2]);
      for (let k = 0; k < ROOM_SECTORS && P.length >= 3; k++) if (d[k] < R) P = clip(P, SECTOR_C[k], SECTOR_S[k], SECTOR_C[k] * px + SECTOR_S[k] * py + d[k] - c);
      if (P.length < 3) return null;
      const hpP = halfPlanes(P, 0), width = new Float64Array(hpP.length / 3);
      for (let j = 0; j < width.length; j++) { let w = 0; for (const v of P) { const t = hpP[3 * j + 2] - hpP[3 * j] * v[0] - hpP[3 * j + 1] * v[1]; if (t > w) w = t; } width[j] = w; }
      return { hp: hpP, width };
    };
    let bare = 0, bareAll = 0, cover = 0, stop = '', topAt = -1;
    // a bare disc that no comma of a fair size can end is given up (with its copies: x, y, radius) and the next one is
    // looked at; it still counts as a flaw of the cloth
    const lost = [];
    const giveUp = (x, y, r) => {
      for (let g = -6; g < els.length; g += 6) {
        const gx = g < 0 ? x : els[g] * x + els[g + 1] * y + els[g + 4], gy = g < 0 ? y : els[g + 2] * x + els[g + 3] * y + els[g + 5];
        if (Math.hypot(gx - wcx, gy - wcy) <= wr) lost.push(gx, gy, r);
      }
    };
    const census = () => {                                      // the largest bare disc of the tile that is not given up (centre cell, diameter), the largest of all, and the dark share
      edt(dark, gw, gh, D);
      let best = -1, bo = -1, nd = 0, top = 0;
      for (let k = 0; k < cells.length; k++) if (dark[cells[k]]) nd++;
      for (let k = 0; k < rim.length; k++) {
        const o = rim[k];
        if (dark[o]) continue;
        if (D[o] > top) { top = D[o]; topAt = o; }
        const i = o % gw, j = (o - i) / gw, x = gx0 + (i + 0.5) * h, y = gy0 + (j + 0.5) * h, d = D[o] * h - 1e-4 * Math.hypot(x - tcx, y - tcy);
        if (d <= best + 1e-9) continue;
        let gone = false;
        for (let q = 0; q < lost.length; q += 3) { const dx = lost[q] - x, dy = lost[q + 1] - y; if (dx * dx + dy * dy < lost[q + 2] * lost[q + 2]) { gone = true; break; } }
        if (!gone) { best = d; bo = o; }
      }
      cover = nd / cells.length; bare = bo < 0 ? 0 : 2 * D[bo] * h; bareAll = 2 * top * h;
      return bo;
    };
    addMark({ x: big.x, y: big.y, al: big.al, e: big.e, st: 0, s: big.s });
    if (K.debug) K.debug({ t: 'start', e: big.e, s: +big.s.toFixed(3), long: +marks[0].long.toFixed(2) });
    const sNext = Math.min(sCap, K.ratioNext * big.s);
    for (let round = 0; marks.length < K.maxMarks && round < K.maxMarks + 3; round++) {
      const bo = census(), bareR = bare / 2;
      if (bo < 0 || (bare <= K.bareGoal && cover >= K.coverGoal)) { stop = 'goals'; break; }
      if (bare <= K.bareNeed && cover >= K.coverStop) { stop = 'cover'; break; }
      const bi0 = bo % gw, bj0 = (bo - bi0) / gw, bx = gx0 + (bi0 + 0.5) * h, by = gy0 + (bj0 + 0.5) * h;
      // the seats: the points in and around that disc where the head of a new mark has most room (its own copies count:
      // there is none on a mirror or a rotation centre). The best one inside the disc, and the best ones around it.
      const seatR = K.seatReach * bareR, rc = Math.ceil(seatR / h), cand = [];
      for (let j = Math.max(1, bj0 - rc); j <= Math.min(gh - 2, bj0 + rc); j++) for (let i = Math.max(1, bi0 - rc); i <= Math.min(gw - 2, bi0 + rc); i++) {
        const x = gx0 + (i + 0.5) * h, y = gy0 + (j + 0.5) * h, dd = Math.hypot(x - bx, y - by);
        if (dd > seatR) continue;
        const d = D[j * gw + i] * h - c;
        if (d < K.seatMin) continue;
        const e = Math.min(d, (selfAt(i, j) - K.own) / 2);
        // a seat must be near enough for a comma of its size to reach the middle part of the disc
        if (e >= K.seatMin && dd <= 0.5 * bareR + 6 * e) cand.push([e - 1e-4 * dd, x, y]);
      }
      cand.sort((p, q) => q[0] - p[0] || p[1] - q[1] || p[2] - q[2]);
      const seats = [], apart = (s) => seats.every((t) => Math.hypot(t[1] - s[1], t[2] - s[2]) > Math.max(0.1, 1.6 * t[0]));
      for (const s of cand) if (Math.hypot(s[1] - bx, s[2] - by) <= bareR) { seats.push(s); break; }
      for (const s of cand) { if (seats.length >= Q.seats) break; if (apart(s)) seats.push(s); }
      if (K.debug) K.debug({ t: 'round', round, bare: +bare.toFixed(3), cover: +cover.toFixed(3), b: [+bx.toFixed(3), +by.toFixed(3)], cand: cand.length, seats: seats.map((q) => q.map((v) => +v.toFixed(3))) });
      // candidates: where the head sits, which way the tail leaves, how far it uncurls; each grown as far as it goes.
      // A fit counts by its area when it comes near enough to the middle of the bare disc to end it (no bare disc
      // larger than bareNeed is left there), and by less the further away it stays; one that does not come into the
      // disc does not count.
      let best = null;
      // a disc whose middle is a point fixed by an element (a corner of mirrors, a centre, a mirror): no head can sit
      // there, the marks round it are copies of one another, and only a mark that comes near ends it
      const corner = selfDistance(bx, by, els) < K.tipSpecial;
      const rOk = corner ? K.rOkTip : K.bareNeed / 2 - 0.01, nPow = corner ? K.nearPowCorner : K.nearPow, reward = (d) => (d <= rOk ? 1 : Math.pow(rOk / d, nPow));
      // a comma of either cut: the slender one only with a head of at least slenderMin, the stout one only up to stoutMax
      const capOf = (st) => (st ? Math.min(sNext, K.stoutMax / 2) : sNext), minOf = (st) => (st ? 0 : K.slenderMin / 2);
      const grow = (x0, y0, al, e, st, hp) => {
        const S = shapeOf(e, st), wS = weight(S), cap = capOf(st);
        khp = hp;
        // the reward is at most 1: a fit that cannot beat the best even with all of it is dropped at once
        let lo = Math.max(best ? Math.sqrt(best.obj / wS) * 1.003 : K.seatMin * 0.6, minOf(st));
        if (lo > cap || !feasible(S, x0, y0, al, lo)) return;
        let hi = lo;
        for (;;) { hi = Math.min(cap, lo * 1.3); if (hi <= lo || !feasible(S, x0, y0, al, hi)) break; lo = hi; }
        if (hi > lo) for (let it = 0; it < 6; it++) { const mid = (lo + hi) / 2; if (feasible(S, x0, y0, al, mid)) lo = mid; else hi = mid; }
        const dn = nearest(S, x0, y0, al, lo, bx, by);
        if (dn > K.progress * bareR) return;
        const obj = lo * lo * wS * reward(dn);
        if (!best || obj > best.obj) best = { x: x0, y: y0, al, e: S.e, st, s: lo, obj, hp, room: null };
      };
      const fitIn = (room, hp, al, e, st) => {                  // the largest comma of this turn, curl and cut in the room
        const S = shapeOf(e, st), wS = weight(S);
        const r = inscribe(room.hp, S.coarse, al, capOf(st), 0.012, Math.max(best ? Math.sqrt(best.obj / wS) : 0, minOf(st)), room.width);
        if (!r) return;
        const dn = nearest(S, r.x, r.y, al, r.s, bx, by);
        if (dn > K.progress * bareR) return;
        const obj = r.s * r.s * wS * reward(dn);
        if (!best || obj > best.obj) best = { x: r.x, y: r.y, al, e: S.e, st, s: r.s, obj, hp, room };
      };
      for (const seat of seats) {
        const hp = halfPlanes(dirichlet(seat[1], seat[2], els, 3), K.own / 2), r0 = seat[0], slender = r0 >= 0.4 * K.slenderMin;
        // fitted exactly into the seat's convex room ...
        const room = roomOf(seat[1], seat[2], hp);
        if (room) for (let st = 1; st >= (slender ? 0 : 1); st--) for (let k = 0; k <= 4; k += Q.curlStep) for (let a = 0; a < Q.roomTurns; a++) fitIn(room, hp, (a * TAU) / Q.roomTurns, k / 4, st);
        // ... and grown on the grid from the seat, where a tail may also wind round a neighbour
        for (let cI = 0; cI < Q.growAt; cI++) {
          const x0 = cI ? seat[1] + 0.5 * r0 * Math.cos((cI * TAU) / 4) : seat[1], y0 = cI ? seat[2] + 0.5 * r0 * Math.sin((cI * TAU) / 4) : seat[2];
          for (let st = 1; st >= (slender ? 0 : 1); st--) for (let k = 0; k <= 4; k += Q.curlStep) for (let a = 0; a < Q.growTurns; a++) grow(x0, y0, (a * TAU) / Q.growTurns, k / 4, st, hp);
        }
      }
      // ... and, round a fixed point, laid TIP FIRST: the tip on a ray from the middle, as near it as the tip's width
      // has room (ray: the room for a tip every 0.02 from 0.04 out), the chord head -> tip aimed at the middle (or
      // `off` beside it); the body grows outward. In a thin corner only a tail gets near the middle.
      if (corner && K.tails) {
        const tipRoom = (x, y) => Math.min(dAt(x, y) * h - c, (selfDistance(x, y, els) - K.own) / 2);
        // (the grid is known round the tile only: of directions with the same room, the one toward the tile is taken)
        const ND = 48, tr = new Float64Array(ND), dirs = [], toTile = Math.atan2(tcy - by, tcx - bx);
        for (let k = 0; k < ND; k++) tr[k] = tipRoom(bx + K.tipProbe * Math.cos((k * TAU) / ND), by + K.tipProbe * Math.sin((k * TAU) / ND));
        for (let n = 0; n < K.tipDirs; n++) {                     // the directions with most room for a tip, well apart
          let bk = -1, bv = K.tipRoomMin;
          for (let k = 0; k < ND; k++) {
            const th = (k * TAU) / ND;
            if (dirs.some((t) => Math.cos(t - th) > 0.87)) continue;
            const v = tr[k] + 2e-3 * Math.cos(th - toTile);
            if (tr[k] > K.tipRoomMin && v > bv + 1e-9) { bv = v; bk = k; }
          }
          if (bk < 0) break;
          const a = tr[(bk + ND - 1) % ND], b = tr[bk], d = tr[(bk + 1) % ND], den = a - 2 * b + d;
          dirs.push(((bk + (den < -1e-9 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - d)) / den)) : 0)) * TAU) / ND);
        }
        // the largest comma of a turn, curl and cut in the convex room of a point just off the middle, its TIP held
        // within `reach` of the middle along the direction (the same exact program as the big comma's)
        let nTail = 0;
        const fitPin = (room, hp, al, e, st, ux, uy, reach) => {
          const S = shapeOf(e, st), wS = weight(S);
          const r = inscribe(room.hp, S.coarse, al, capOf(st), 0.012, Math.max(best ? Math.sqrt(best.obj / wS) : 0, minOf(st)), room.width, [ux, uy, ux * bx + uy * by + reach, S.end[0], S.end[1]]);
          if (!r) return;
          nTail++;
          const dn = nearest(S, r.x, r.y, al, r.s, bx, by);
          if (dn > K.progress * bareR) return;
          const obj = r.s * r.s * wS * reward(dn);
          if (!best || obj > best.obj) best = { x: r.x, y: r.y, al, e: S.e, st, s: r.s, obj, hp, room, tail: true };
        };
        for (const th of dirs) {
          const ux = Math.cos(th), uy = Math.sin(th), px = bx + K.tipSeat * ux, py = by + K.tipSeat * uy;
          const hp = halfPlanes(dirichlet(px, py, els, 3), K.own / 2), room = roomOf(px, py, hp);
          if (!room) continue;
          for (const reach of K.tipReach) for (let st = 1; st >= 0; st--) for (let k = 1; k <= 4; k++) for (let a = 0; a < 30; a++) fitPin(room, hp, (a * TAU) / 30, k / 4, st, ux, uy, reach);
        }
        if (K.debug) K.debug({ t: 'tails', dirs: dirs.map((t) => +t.toFixed(3)), fits: nTail });
      }
      if (!best) { if (K.debug) K.debug({ t: 'nofit' }); giveUp(bx, by, 0.9 * bareR); continue; }
      for (let dp = 0.4 * best.s, da = TAU / 72, it = 0; it < Q.refine; it++, dp /= 2, da /= 2) {
        for (let rep = 0; rep < 3; rep++) {
          const b0 = best, hp = b0.hp, st = b0.st;
          if (b0.room) {
            fitIn(b0.room, hp, b0.al + da, b0.e, st); fitIn(b0.room, hp, b0.al - da, b0.e, st);
            if (it < 2) { if (b0.e + 1 / E_STEPS <= 1) fitIn(b0.room, hp, best.al, b0.e + 1 / E_STEPS, st); if (b0.e - 1 / E_STEPS >= 0) fitIn(b0.room, hp, best.al, b0.e - 1 / E_STEPS, st); }
          }
          grow(best.x + dp, best.y, best.al, best.e, st, hp); grow(best.x - dp, best.y, best.al, best.e, st, hp); grow(best.x, best.y + dp, best.al, best.e, st, hp); grow(best.x, best.y - dp, best.al, best.e, st, hp);
          grow(best.x, best.y, best.al + da, best.e, st, hp); grow(best.x, best.y, best.al - da, best.e, st, hp);
          if (it < 3) { if (best.e + 1 / E_STEPS <= 1) grow(best.x, best.y, best.al, best.e + 1 / E_STEPS, st, hp); if (best.e - 1 / E_STEPS >= 0) grow(best.x, best.y, best.al, best.e - 1 / E_STEPS, st, hp); }
          if (best === b0) break;
        }
      }
      // the exact check against every outline near: where the channel is not there, step away and shrink a little
      const mk = { x: best.x, y: best.y, al: best.al, e: best.e, st: best.st, s: best.s }, S = shapeOf(mk.e, mk.st), mid = decimate(S.dense, mk.s, 0.03, 12);
      khp = best.hp;
      const settle = () => {
        let gap = 0;
        for (let it = 0; it < 16; it++) {
          const P = place(mid, mk.x, mk.y, mk.al, mk.s), mr = S.reach * mk.s;
          let nx = 0, ny = 0;
          gap = c + 0.02;
          for (let i = 0; i < P.length; i += 2) for (let q = 0; q < khp.length; q += 3) {              // its cell
            const v = khp[q] * P[i] + khp[q + 1] * P[i + 1] - khp[q + 2];
            if (v > 1e-9 && c - v < gap) { gap = c - v; nx = -khp[q]; ny = -khp[q + 1]; }
          }
          for (const C of copies) {                                                                     // the marks there
            if (Math.hypot(C.cx - mk.x, C.cy - mk.y) > C.r + mr + gap) continue;
            if (pointIn(C.pts, P[0], P[1]) || pointIn(P, C.pts[0], C.pts[1])) { gap = -1; break; }
            const d1 = vertsToOutline(P, C.pts, C.cx, C.cy, C.r, gap);
            if (d1 < gap) { gap = d1; nx = NEAR[0] - NEAR[2]; ny = NEAR[1] - NEAR[3]; }
            const d2 = vertsToOutline(C.pts, P, mk.x, mk.y, mr, gap);
            if (d2 < gap) { gap = d2; nx = NEAR[2] - NEAR[0]; ny = NEAR[3] - NEAR[1]; }
          }
          if (gap >= c - 5e-4) break;
          if (gap < 0) { mk.s *= 0.85; continue; }
          const l = Math.hypot(nx, ny) || 1;
          mk.x += (nx / l) * (c - gap + 0.002); mk.y += (ny / l) * (c - gap + 0.002); mk.s *= 0.985;
        }
        return gap;
      };
      let gap = settle();
      // the dark budget: a mark that would make the cloth too dark is made smaller (a mark's area IS its share of the
      // tile, whose area is 1), about the point of it that is nearest the middle of the bare disc
      const area = S.area * mk.s * mk.s;
      if (gap >= c - 5e-4 && bare <= K.budgetBare && cover + area > K.coverHi) {
        const f = Math.max(K.budgetMin, Math.sqrt(Math.max(0, K.coverHi - cover) / area)), P = place(mid, mk.x, mk.y, mk.al, mk.s);
        let m = Infinity, qx = mk.x, qy = mk.y;
        for (let i = 0; i < P.length; i += 2) { const d = (P[i] - bx) * (P[i] - bx) + (P[i + 1] - by) * (P[i + 1] - by); if (d < m) { m = d; qx = P[i]; qy = P[i + 1]; } }
        mk.x = qx + f * (mk.x - qx); mk.y = qy + f * (mk.y - qy); mk.s *= f;
        gap = settle();
      }
      if (K.debug) K.debug({ t: 'fit', from: best.room ? 'room' : best.tail ? 'tail' : 'grid', corner, st: mk.st, x: +mk.x.toFixed(3), y: +mk.y.toFixed(3), al: +mk.al.toFixed(2), e: mk.e, s0: +best.s.toFixed(3), s: +mk.s.toFixed(3), long: +(mk.s * S.span).toFixed(3), gap: +gap.toFixed(4), near: +nearest(S, mk.x, mk.y, mk.al, mk.s, bx, by).toFixed(3) });
      // no speck: a disc that only a comma under the floor could end is given up; small marks only while a bare disc is
      // still too large
      if (gap < c - 5e-4 || 2 * mk.s < K.headMin || mk.s * S.span < (bare > K.bareNeed ? K.floor : K.floorWant)) { giveUp(bx, by, 0.9 * bareR); continue; }
      // ... and none that would make the cloth too dark
      if (bare <= K.bareNeed && cover + S.area * mk.s * mk.s > K.coverHi + 1e-3) { stop = 'cover'; break; }
      addMark(mk);
    }
    if (!stop) stop = marks.length >= K.maxMarks ? 'max' : 'floor';
    census();
    if (K.debug) { const i = topAt % gw, j = (topAt - i) / gw; K.debug({ t: 'end', bare: +bareAll.toFixed(3), cover: +cover.toFixed(3), at: [+(gx0 + (i + 0.5) * h).toFixed(3), +(gy0 + (j + 0.5) * h).toFixed(3)], self: +selfAt(i, j).toFixed(3), tile: tile.map((p) => p.map((v) => +v.toFixed(3))) }); }
    // what is wrong with the cloth: a bare disc too large, the dark share out of its band, small marks, a big comma
    // made smaller than the tile holds
    const tiny = marks.filter((m) => m.long < K.tinyLong).length;
    // (in this order: no bare disc over bareNeed, the dark share in its band, the big comma as large as the tile holds,
    // few marks and few small ones; of two cloths alike, the darker)
    const flaw = K.wBare * Math.max(0, bareAll - K.bareNeed) + K.wCover * (Math.max(0, K.coverLo - cover) + Math.max(0, cover - K.coverHi)) + K.wTiny * tiny + K.wMarks * Math.max(0, marks.length - 2) + K.wSmall * (1 - (big.f || 1)) - K.wDark * (cover - 0.5);
    return { marks, bare: bareAll, cover, stop, tiny, flaw, f: big.f || 1 };
  };

  // the big comma that fits best first, grown in full; when its cloth has a flaw, every other start is grown QUICKLY (a
  // third of the work: the greedy rounds are touchy, so many starts looked at lightly beat a few looked at hard), the
  // best `fullAgain` of them once more in full, and the least flawed cloth of all is kept
  let fam = null;
  const tried = [];
  const take = (k, q) => {
    const f = family(starts[k], q);
    tried.push({ kind: (starts[k].head !== undefined ? 'P' + starts[k].corner + starts[k].head : starts[k].corner !== undefined ? 'C' + starts[k].corner : starts[k].f < 1 ? 'S' + starts[k].f : 'L') + (q === QUICK ? 'q' : ''), e: starts[k].e, f: starts[k].f, flaw: +f.flaw.toFixed(3), bare: +f.bare.toFixed(3), cover: +f.cover.toFixed(3), marks: f.marks.length, tiny: f.tiny });
    if (!fam || f.flaw < fam.flaw - 1e-9) fam = f;
    return f;
  };
  if (typeof K.onlyStart === 'number') take(Math.min(K.onlyStart, starts.length - 1), FULL);   // the lab: one start alone
  else {
    take(0, FULL);
    if (fam.flaw > K.flawOk && starts.length > 1) {
      const quick = [];
      for (let k = 1; k < starts.length; k++) quick.push([take(k, QUICK).flaw, k]);
      quick.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      for (let j = 0; j < Math.min(K.fullAgain, quick.length) && fam.flaw > K.flawOk; j++) take(quick[j][1], FULL);
    }
  }

  // ---- out: world coordinates --------------------------------------------------------------------------------------
  const shapes = fam.marks.map((mk) => {
    const pts = [];
    for (let i = 0; i < mk.pts.length; i += 2) pts.push([Ox + u * (mk.pts[i] * ex - mk.pts[i + 1] * ey), Oy + u * (mk.pts[i] * ey + mk.pts[i + 1] * ex)]);
    return { pts, hole: false };
  });
  return {
    shapes,
    info: {
      seated, stop: fam.stop, marks: fam.marks.length, cover: +fam.cover.toFixed(3), bare: +fam.bare.toFixed(3),
      long: fam.marks.map((m) => +m.long.toFixed(2)), head: fam.marks.map((m) => +(2 * m.s).toFixed(2)), e: fam.marks.map((m) => +m.e.toFixed(2)), st: fam.marks.map((m) => m.st || 0), scale: fam.f, tried,
    },
  };
}
