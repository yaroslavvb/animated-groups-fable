// folds/crosscap.js — fold type 'crosscap' (SPEC 5.3, 5.6, 7): 22x (pgg), the projective plane with two cone points.
//
// The half-turns of pgg form the group 2222 of the kaleidoscope kRect(a, b); its orbifold is the PILLOW, two copies
// of the cell T joined along all four sides. The glides of pgg act on that pillow as the antipodal map. So:
//
//   stage 1   the tile folds, by the rigid hinges of src/folds/hinge.js, onto HALF of the pillow and puffs
//             (hingeKinematics; the tile's area is one cell). The half-turn seams close here.
//   a pause
//   stage 2   the pillow is pushed through an EVEN map C (C(-P) = C(P)), so antipodal points meet: the glide seams
//             close and the surface is a cross-cap.
//
// Coordinates. (xi, eta, zeta) are the normalised world coordinates of a point of the puffed pillow, measured from
// the centre of the fixed cell: x = xc + hx xi, y = yc + hy eta, z = hz zeta, with |xi|, |eta| <= 1 and
// zeta^2 = (1 - xi^2)(1 - eta^2) (zeta < 0 on the sheet of the fixed piece). The antipodal map is P -> -P.
//
// The even map (design 'cleft', the one used; see notes/crosscap.md for the two it was compared with):
//
//     x = xc + hx · xi · L(eta)                     L odd, L(1) = 1
//     y = yc + hy · ( D(eta) + mu · zeta^2 )        D even, D(0) = 0, D(1) = 1,   0 < mu < 1
//     z =      hz · gamma · zeta · L(eta)
//
// It is the classical cross-cap (X, Y, Z) -> (XY, X^2 + mu Z^2, XZ) in disguise (L = id, D = square give exactly
// that), turned so that it stays close to the identity on the FAR half of the pillow (eta > 0): the far edge
// eta = 1 with the two cone points at its ends does not move at all. The great circle eta = 0 is folded four to
// one onto the segment x = xc, z = 0, yc <= y <= yc + mu hy: the line of self-intersection. Its ends are the two
// pinch points: the tip (xi = ±1: the middles of the two short sides of the pillow) and the inner end (xi = 0: the
// top and the bottom of the pillow). Everywhere else the map is an immersion of the projective plane, and the cone
// points (the four corners of the pillow, in antipodal pairs) are far from the double line. From above the shape
// is a heart: two lobes with a cleft between them that runs from the tip to the inner pinch point.
//
// With the default cut ("Pocket": a rectangle folded once) the half pillow of stage 1 is exactly that far half, a
// pocket whose open mouth is the great circle eta = 0 and faces the default camera. Stage 2 then moves next to
// nothing but the mouth: its two corners are drawn together into the tip while the lips sink onto the double
// line, each point of the upper lip meeting the point of the lower lip diagonally opposite. Nothing passes
// through anything until the rim closes at the very end.
//
// THE NEAR PART (stage 2 design 'acts', the default; 'twist' is round 1's). Any other cut gives another half of the
// same pillow and ends in the same shape; whatever lies in the NEAR half (eta < 0) ends at the image of its antipode,
// C(P) = C(-P): it has to be turned over (P -> -P is a point reflection: no rigid motion does it). The near part of
// a point P = (xi, eta, zeta) ends where its MIRROR point P* = (xi, -eta, zeta) ends, turned half a circle about the
// double line: C(P) = R(pi) C(P*), R = rotation about the line x = xc, z = 0. Stage 2 is played as three acts:
//   1 pinch      the great circle eta = 0 closes onto the double line, from both sides: the far part zips as the
//                Pocket does, the near part (shrinking like the far part's mirror image) is drawn into a front
//                pouch that hangs from the double line, IN FRONT of the tip: only a neck next to the double line
//                takes the cleft's backward shift mu zeta^2 (ACTS.neck); the body gets it as it folds back.
//   2 roll       the front pouch turns half a circle about the double line (in front of the tip, where nothing is),
//                ends up on the other side of the plane and mirrored left to right.
//   3 fold back  it swings back over the tip (up and over, like a page, keeping its bulge; fold.lift says to which
//                side) and lands on the far part: the glide seams close last, as in the Pocket. Round 3: its move back
//                in y is done at ACTS.landY of it and the swing peaks late, so it comes straight down (or up) onto its
//                place (both sheets of the closed heart are graphs over the plane); fold.lift is an AREA integral over
//                the near part (round 2 averaged over the mesh's vertices, which are graded toward the cell sides).
// The pinch is quicker the further the tile reaches into the near half (fold.nearReach; 0 for the Pocket, whose
// stage 2 is round 1's exactly), so the roll happens about a pinched double line instead of wringing the middle of
// the tile. Measured (test/crosscap.test.js): for Bowl and Hexagon, straight and wavy, and for drags of 0.04 around
// the Pocket and the Hexagon, no triangle of the near part passes through the far part outside a band next to the
// double line, at any time of stage 2 (drags of the Bowl toward the camera graze for an instant while landing: their
// near part lies on both sheets).
// 'twist' (opts.stage2 = 'twist'): the near part is twisted about the depth axis like a sweet wrapper while it slides
// back THROUGH the far part (round 1; hard to read with "Bowl" and "Hexagon": notes/crosscap-round2.md).
//
// THE ANCHOR (SPEC 7). opts.anchor = [x, y] (straight coordinates; the app passes the seed of the preset last chosen):
// the closed shape then sits on one kaleidoscope cell C0 that depends on the anchor alone (anchorCell): the cell that
// the rule of round 1 keeps fixed for the anchor's OWN tile (the tile with seed = anchor) — the cell of the anchor,
// or the one in front of it when the anchor is less than ROOT_SHIFT hy behind a crease and a quarter of its tile lies
// there (so the Pocket, whose seed is ON a crease, is the far half of the cell in front, as in round 1). Stage 1 is
// the anchored hinge kinematics (src/folds/hinge.js, THE ANCHORED FORM) walking from a point of C0 next to the anchor;
// the pillow coordinates and the frame of stage 2 are those of C0 (kin.anchorIso), never of the seed's cell, so at
// t = 1 every plane point goes to the same place for every seed and every wave: dragging the cut makes the seams
// slide over a shape that stays put. Without an anchor (or a malformed one) the fold is round 1's: anchor = seed.
//
// THE TIMING (round 3). No pause: the zip starts while the puff is still landing, and the rim closes with a short
// landing. Stage 1 takes time in proportion to its work (fold.work, from the anchor's own tile): a tile with a crease
// to fold turns its flaps over 42 % of the play; a tile with none (the Bowl, the cell itself) puffs from t = 0 and
// is half of the pillow after 22 %. The middle stop is where the puff lands; its label says what is true of every
// cut there: the glide seams are open (every other seam is closed).
//
// Exports
//   default createFold(group, domain, mesh, opts) -> Fold      (SPEC 5.3) plus fold.doubleLine(t), fold.kinematics,
//                                                              fold.frame, fold.finalMap, fold.anchor, fold.stage2,
//                                                              fold.nearReach, fold.lift, fold.work, fold.times,
//                                                              fold.halfPillow
//   crosscapSchedule(t, out, work?) -> [theta, beta, s]        the timing (work 1 by default)
//   crosscapTimes(work) -> { hingeEnd, puffStart, halfEnd, zipStart, halfStop, work }
//   actsTiming(u, nearReach, out) -> [sigma, kappa, delta, c]  the three acts at the time u in [0, 1] of stage 2
//   PUFF_START, HINGE_END, HALF_END, ZIP_START, HALF_STOP      with a crease: the puff starts, the hinges close, the
//                                                              zip starts, the puff lands = the middle stop
//   TIMES_NO_CREASE, WORK, RAMPS, MIDDLE_LABEL, DOUBLE_FROM    the timing without a crease, the work scale, the ramps,
//                                                              the middle stop's name, when the double line appears
//   ACTS, ACTS_FREE                                            the windows of the three acts
//   crosscapMap(design, params)                                the even map by itself (for tests and notes)
//   anchorCell(group, anchor, metric) -> { iso, point } | null the cell C0 of an anchor (SPEC 7)

import { inverse, polyArea, clipHalfPlane } from '../geom.js';
import { buildDomain } from '../domain.js';
import { hingeKinematics, refineBoundary, kaleidoWalk } from './hinge.js';

const PI = Math.PI;

// The times below are those of a tile with a crease to fold (stage 1 has hinge work: fold.work = 1, every preset
// but "Bowl"); crosscapTimes(work) gives them for any tile (round 3, findings 2 and 13).
/** Stage 1: the hinges reach pi here (the half-turn seams are closed from here on). */
export const HINGE_END = 0.42;
/** Stage 1: the puff starts here (the flaps are then 112 degrees up). */
export const PUFF_START = 0.21;
/** Stage 1 (hinges + puff) ends here: the tile is half of the pillow. The middle stop. */
export const HALF_END = 0.49;
/** Stage 2 (the zip) starts here, while the puff is still landing: the motion slows there but never rests. */
export const ZIP_START = 0.45;
/** The middle stop: the puff has landed (the zip has just begun: 1.3 % of it). */
export const HALF_STOP = HALF_END;
/** The name of the middle stop (the scrubber's aria text): true of every cut there, whatever its seams. */
export const MIDDLE_LABEL = 'glide seams open';
/** The double line is drawn from the moment the sheets that meet along it are this close to meeting (pinch / zip). */
export const DOUBLE_FROM = 0.97;

const IDENTITY = (x, y, cell, out) => { out[0] = x; out[1] = y; out[2] = 0; return out; };
const smooth = (q) => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q));

// ---------------------------------------------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------------------------------------------
//
// The timeline eases a whole play at both ends (easePlay), so the motion itself runs at a constant pace and only
// its inner junctions are shaped (as in roll.js): the flaps turn at a constant rate from the first instant and land
// softly; the puff starts softly while they are past the vertical; the zip starts while the puff is still landing,
// so nothing rests between the two stages; the rim closes with a short soft landing just before the play ends.
// Stage 1 takes time in proportion to its work: a tile with no crease in the anchor's own tile ("Bowl", fold.work =
// 0) has nothing to hinge, so its puff starts at once and the zip follows after a fifth of the play.

// A ramp 0 -> 1 on [0, 1]: a parabola over the first `ea`, a constant rate, a parabola over the last `eb`
// (zero speed at an end that has a parabola). C1.
const rampF = (u, ea, eb) => {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const r = 1 / (1 - ea / 2 - eb / 2);
  return u < ea ? (r / (2 * ea)) * u * u : u <= 1 - eb ? r * (u - ea / 2) : 1 - (r / (2 * eb)) * (1 - u) * (1 - u);
};
const ramp = (ea, eb) => (u) => rampF(u, ea, eb);
/** The shapes of the ramps: the flaps land over the last 40 % of their turn; the puff starts softly over the first
 *  30 % (with a crease) and lands over the last 40 %; the zip starts over the first 25 % and lands over the last 15 %. */
export const RAMPS = Object.freeze({ hingeLand: 0.4, puffEase: 0.3, puffLand: 0.4, zipEase: 0.25, zipLand: 0.15 });
const hingeRamp = ramp(0, RAMPS.hingeLand), zipRamp = ramp(RAMPS.zipEase, RAMPS.zipLand);

/** The times of a tile with no crease to fold (work 0: the puff alone, from t = 0). */
export const TIMES_NO_CREASE = Object.freeze({ hingeEnd: 0.17, puffStart: 0, halfEnd: 0.22, zipStart: 0.18 });
/** Hinge work: the share of the anchor's tile outside the anchor's cell, mapped to [0, 1] by smoothstep over WORK. */
export const WORK = Object.freeze([0.02, 0.12]);

/**
 * The times of the motion for stage-1 work k in [0, 1] (fold.work; anything else counts as 1): { hingeEnd,
 * puffStart, halfEnd, zipStart, halfStop, work }. Each is (1 - k) x the time without a crease + k x the time with
 * one, so k = 1 gives HINGE_END, PUFF_START, HALF_END, ZIP_START, HALF_STOP exactly. halfStop = halfEnd.
 */
export function crosscapTimes(k = 1) {
  k = k >= 0 && k <= 1 ? k : 1;
  const T0 = TIMES_NO_CREASE, mix = (a, b) => (1 - k) * a + k * b;
  const halfEnd = mix(T0.halfEnd, HALF_END);
  return { hingeEnd: mix(T0.hingeEnd, HINGE_END), puffStart: mix(T0.puffStart, PUFF_START), halfEnd, zipStart: mix(T0.zipStart, ZIP_START), halfStop: halfEnd, work: k };
}

/** Round 2's timing (a pause from 0.44 to 0.5, a long landing), kept for comparison: opts.timing = 'round2'. */
export const TIMES_ROUND2 = Object.freeze({ hingeEnd: 0.36, puffStart: 0.19, halfEnd: 0.44, zipStart: 0.5, halfStop: 0.47, work: 1 });
const round2Puff = ramp(0.3, 0.4), round2Zip = ramp(0.3, 0.5);
function round2Schedule(t, out) {
  const T = TIMES_ROUND2;
  if (!(t > 0)) { out[0] = 0; out[1] = 0; out[2] = 0; return out; }
  if (t >= T.halfEnd) { out[0] = PI; out[1] = 1; out[2] = t >= 1 ? 1 : round2Zip((t - T.zipStart) / (1 - T.zipStart)); return out; }
  out[0] = t >= T.hingeEnd ? PI : PI * hingeRamp(t / T.hingeEnd);
  out[1] = round2Puff((t - T.puffStart) / (T.halfEnd - T.puffStart));
  out[2] = 0;
  return out;
}

/**
 * out = [theta, beta, s]: hinge angle in [0, pi], puff in [0, 1], progress of the zip in [0, 1], for stage-1 work k
 * (default 1). C1 in t on (0, 1), with bounded acceleration for every k. The puff is a blend: (1 - k) x a puff that
 * starts at t = 0 at full rate + k x a puff that starts softly at puffStart, both landing at halfEnd.
 */
export function crosscapSchedule(t, out = [0, 0, 0], k = 1, T = crosscapTimes(k)) {
  if (!(t > 0)) { out[0] = 0; out[1] = 0; out[2] = 0; return out; }
  if (t >= 1) { out[0] = PI; out[1] = 1; out[2] = 1; return out; }
  const w = T.work;
  out[0] = t >= T.hingeEnd ? PI : PI * hingeRamp(t / T.hingeEnd);
  if (t >= T.halfEnd) out[1] = 1;
  else {
    const soft = rampF((t - T.puffStart) / (T.halfEnd - T.puffStart), RAMPS.puffEase, RAMPS.puffLand);
    out[1] = w === 1 ? soft : (1 - w) * rampF(t / T.halfEnd, 0, RAMPS.puffLand) + w * soft;
  }
  out[2] = t > T.zipStart ? zipRamp((t - T.zipStart) / (1 - T.zipStart)) : 0;
  return out;
}

/**
 * The three acts of stage 2 (design 'acts'), in units of the time of stage 2, u = (t - ZIP_START) / (1 - ZIP_START):
 *   nu0        a tile that reaches this far into the near half (nearReach = |L(eta)| at its nearest point) gets
 *              the whole pinch inside `pinch`; nearReach 0 (the Pocket) zips over all of stage 2, as in round 1
 *   pinch      the window of the pinch for such a tile
 *   roll       the window of the roll (the part next to the double line follows as the pinch closes it)
 *   fold       the window of the fold back; it ends with stage 2
 *   lift       how high the folding part swings: its far edge rises by lift x half the way it travels
 *   neck       the front pouch keeps the double line's backward shift (mu zeta^2, the cleft) only on a neck this
 *              wide in eta next to the double line until it folds back: its body hangs IN FRONT of the tip while
 *              it rolls, instead of reaching back over the double line into the far part
 */
export const ACTS = Object.freeze({ nu0: 0.5, pinch: 0.3, roll: Object.freeze([0.08, 0.6]), fold: Object.freeze([0.35, 1]), lift: 0.8, neck: 0.2, landY: 0.9 });
// Round 3: the fold back lands over its last quarter, not half (the rim closes just before the play ends); it starts
// a little earlier (0.35, when the roll is just past half way) and LANDS STRAIGHT DOWN (or up): its move back in y is
// done at landY of it, and the swing (lift, raised from 0.5 to 0.8) peaks later and comes down steeply, so the
// pouch comes onto the far part from above (both sheets of the closed shape are graphs over the plane) instead of
// sliding onto it at 38 degrees from the front, through whatever stands in front of its place (finding 3).
const pinchRamp = ramp(0.3, 0.45), rollRamp = ramp(0.35, 0.35), foldRamp = ramp(0.3, 0.25);
/**
 * fold.lift = LIFT_GAIN x (the area mean of -zeta over the near part, weighted by |L(eta)|) / (that of |zeta|), clamped
 * to [-1, 1]. Where a dragged cut's near part moves from one sheet to the other, the lift changes sign; gain x
 * ACTS.lift sets how fast the shape then changes with the seed (anchor test 3 allows 6 times the seed's step).
 */
export const LIFT_GAIN = 2;
/** u (time of stage 2) of the middle stop for a tile with a crease: until then every tile zips alike (see actsTiming). */
export const ACTS_FREE = (HALF_STOP - ZIP_START) / (1 - ZIP_START);

/**
 * out = [sigma, kappa, delta, c, back] at the time u in [0, 1] of stage 2 for a tile that reaches nearReach into the
 * near half: sigma the pinch (the great circle eta = 0 closes onto the double line; the far part's progress), kappa
 * the roll, delta the fold back, c the share of the quick pinch (0: sigma is round 1's zip, crosscapSchedule's s),
 * back the fold back's move in y (done at ACTS.landY of it: round 3). All in [0, 1], 0 at u = 0 and 1 at u = 1, C1
 * in u, with zero speed at both ends.
 * Round 3: the zip starts before the middle stop (no pause), at u = `free` of stage 2. Until then sigma is the zip
 * for every tile and nothing rolls or folds back, so the shape at the middle stop depends on the anchor alone (like
 * the whole of stage 1); the windows of ACTS are measured in the time after it, v = (u - free) / (1 - free), and the
 * quick pinch shrinks what is left of the zip: sigma = 1 - (1 - zip(u)) (1 - c pinch(v)). free = 0: round 2's windows.
 */
export function actsTiming(u, nearReach, out = [0, 0, 0, 0, 0], P = ACTS, free = ACTS_FREE) {
  const U = u > 0 ? (u < 1 ? u : 1) : 0;
  const c = smooth((nearReach > 0 ? nearReach : 0) / P.nu0);
  const v = free > 0 && free < 1 ? (U <= free ? 0 : (U - free) / (1 - free)) : U;
  const z = zipRamp(U), q = c * pinchRamp(v / P.pinch);
  out[0] = q === 0 ? z : 1 - (1 - z) * (1 - q);
  out[1] = rollRamp((v - P.roll[0]) / (P.roll[1] - P.roll[0]));
  out[2] = foldRamp((v - P.fold[0]) / (P.fold[1] - P.fold[0]));
  out[3] = c;
  // the move back in y of the fold back: done at landY of it (then the part comes straight down onto its place)
  out[4] = P.landY < 1 ? rampF(out[2] / P.landY, 0, 0.3) : out[2];
  return out;
}

/** ACTS with the fields of opts.acts that are valid (for comparing timings in dev/fold-demo.html: &opts={"acts":{...}}). */
function actsParams(o) {
  if (!o || typeof o !== 'object') return ACTS;
  const P = { ...ACTS };
  const win = (w) => Array.isArray(w) && w.length === 2 && w.every(Number.isFinite) && w[0] >= 0 && w[0] < w[1] && w[1] <= 1;
  if (Number.isFinite(o.nu0) && o.nu0 > 0) P.nu0 = o.nu0;
  if (Number.isFinite(o.pinch) && o.pinch > 0 && o.pinch <= 1) P.pinch = o.pinch;
  if (Number.isFinite(o.lift)) P.lift = o.lift;
  if (Number.isFinite(o.landY) && o.landY > 0 && o.landY <= 1) P.landY = o.landY;
  if (Number.isFinite(o.neck) && o.neck > 0) P.neck = o.neck;
  if (win(o.roll)) P.roll = o.roll.slice();
  if (win(o.fold) && o.fold[1] === 1) P.fold = o.fold.slice();
  return P;
}

// ---------------------------------------------------------------------------------------------------------------
// The even maps
// ---------------------------------------------------------------------------------------------------------------

/**
 * Parameters of the designs. eps shapes the two profiles: L(eta) = eta sqrt(1 + eps^2) / sqrt(eta^2 + eps^2) and
 * D(eta) = (sqrt(eta^2 + eps^2) - eps) / (sqrt(1 + eps^2) - eps); eps = Infinity gives L = eta, D = eta^2.
 * mu: length of the double line as a fraction of the depth hy (negative: it sticks out in front, design 'stem').
 * gamma: the greatest height of the closed shape is about gamma / 2 of the pillow's.
 */
export const DESIGN = {
  cleft: { mu: 0.58, eps: 0.8, gamma: 1.9, plump: 0.6 },
  stem: { mu: -0.45, eps: Infinity, gamma: 1.9, plump: 0.6 },
  spec: { plump: 0.56 },
};

/**
 * crosscapMap(design, params) -> { L(eta), D(eta), final(xi, eta, zeta, out) -> out = (M, Dp, V), mu, gamma }
 * in normalised units: the world position is (xc + hx M, yc + hy Dp, hz V).
 */
export function crosscapMap(design = 'cleft', params = {}) {
  const P = { ...(DESIGN[design] || DESIGN.cleft), ...params };
  if (design === 'spec') {
    // SPEC 5.6 as written: q(X, Y, Z) = (XY, 2ZX, Z^2 - X^2) on the pillow with |Z| = |zeta| / 4 <= 1/4, then a
    // linear map: a quarter turn about the vertical (the keel, the image of the two sides xi = ±1, stays parallel
    // to them, on the centre line), the keel lifted to the plane of the rim, and the height stretched by k.
    const k = P.k === undefined ? 2.5 : P.k;
    return {
      design, ...P, mu: 1 / 16,
      L: (e) => e, D: (e) => e * e,
      final(xi, eta, zeta, out) {
        const Z = zeta / 4, qx = xi * eta, qy = 2 * Z * xi, qz = Z * Z - xi * xi;
        out[0] = -2 * qy; out[1] = qx; out[2] = k * (qz + 1);
        return out;
      },
    };
  }
  const eps = P.eps, mu = P.mu, gamma = P.gamma;
  const fin = Number.isFinite(eps);
  const nL = fin ? Math.sqrt(1 + eps * eps) : 1, nD = fin ? 1 / (Math.sqrt(1 + eps * eps) - eps) : 1;
  const L = fin ? (e) => (e * nL) / Math.sqrt(e * e + eps * eps) : (e) => e;
  const D = fin ? (e) => (Math.sqrt(e * e + eps * eps) - eps) * nD : (e) => e * e;
  return {
    design, ...P, L, D,
    final(xi, eta, zeta, out) {
      const l = L(eta);
      out[0] = xi * l; out[1] = D(eta) + mu * zeta * zeta; out[2] = gamma * zeta * l;
      return out;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The fixed cell
// ---------------------------------------------------------------------------------------------------------------

const BOUNDARY_STEP = 1 / 120;      // outline samples at most this far apart (in sqrt(domainArea)), as in hinge.js

/**
 * A seed in the near part of its cell, less than ROOT_SHIFT hy behind the crease (hy: a quarter of the cell's
 * depth), keeps the cell in FRONT of that crease fixed, as long as the tile has at least ROOT_MIN of its area there.
 */
export const ROOT_SHIFT = 0.5, ROOT_MIN = 0.25;

/**
 * The piece that stays put. Normally the largest piece of the tile in the kaleidoscope cell of the seed, as in
 * hinge.js (a seed on a crease is nudged toward +x and toward the camera, -y). The exception, see ROOT_SHIFT: the
 * default cut has its seed exactly on a crease, and a rule that goes by the seed's own cell alone would make the
 * folded shape hop one cell back as soon as the seed is dragged a hair away from the camera. So the cell in front
 * keeps its claim for a while: a small drag of the default seed in any direction leaves the folded shape where it
 * is, and the default pocket opens toward the camera. (With an anchor the closed shape sits on the anchor's cell,
 * anchorCell, whatever the seed; the fixed piece then only decides which piece the hinge tree is rooted at.)
 */
function pickRoot(group, mesh) {
  const seed = mesh.domain && mesh.domain.seed, T = group.kaleido.cell, n = T.length;
  if (!seed) return undefined;
  let y0 = Infinity, y1 = -Infinity, total = 0;
  for (const p of T) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (const c of mesh.cells) total += c.area;
  const inv = mesh.cells.map((c) => inverse(c.g));
  /** The largest piece in the cell that holds the point, or -1. */
  const largestAt = (px, py) => {
    let best = -1, bestArea = -1;
    for (let i = 0; i < inv.length; i++) {
      const q = inv[i], u = q.a * px + q.b * py + q.tx, v = q.c * px + q.d * py + q.ty;
      let inside = true;
      for (let k = 0; k < n && inside; k++) {
        const a = T[k], b = T[(k + 1) % n];
        if ((b[0] - a[0]) * (v - a[1]) - (b[1] - a[1]) * (u - a[0]) < -1e-12) inside = false;
      }
      if (inside && mesh.cells[i].area > bestArea) { bestArea = mesh.cells[i].area; best = i; }
    }
    return best;
  };
  const sx = seed[0] + 1e-6 * 0.3713;
  const front = largestAt(sx, seed[1] - (ROOT_SHIFT * (y1 - y0)) / 2);
  if (front >= 0 && mesh.cells[front].area >= ROOT_MIN * total) return front;
  const own = largestAt(sx, seed[1] - 1e-6 * 0.9285);
  return own >= 0 ? own : undefined;
}

/** opts.anchor as two finite numbers, or null (missing or malformed: anchor = seed, the round 1 behaviour). */
function anchorOf(a) {
  if (!a || typeof a === 'string' || !(a.length >= 2)) return null;
  const x = Number(a[0]), y = Number(a[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/** The isometry (T -> world) of the kaleidoscope cell that holds (x, y), or null. */
function cellIsoAt(group, x, y) {
  const w = kaleidoWalk(group, [x, y], [x, y]);
  return w ? w.g0 : null;
}

/** Area of the convex polygon `poly` inside the cell g(T). */
function areaInCell(poly, g, T) {
  const C = T.map((p) => [g.a * p[0] + g.b * p[1] + g.tx, g.c * p[0] + g.d * p[1] + g.ty]);
  let cx = 0, cy = 0;
  for (const p of C) { cx += p[0] / C.length; cy += p[1] / C.length; }
  let P = poly.map((p) => [p[0], p[1]]);
  for (let i = 0; i < C.length && P.length >= 3; i++) {
    const a = C[i], b = C[(i + 1) % C.length];
    let nx = b[1] - a[1], ny = a[0] - b[0], c = nx * a[0] + ny * a[1];
    if (nx * cx + ny * cy > c) { nx = -nx; ny = -ny; c = -c; }        // keep the side of the cell's centre
    P = clipHalfPlane(P, nx, ny, c);
  }
  return P.length >= 3 ? Math.abs(polyArea(P)) : 0;
}

const anchorCache = new Map();
const ANCHOR_CACHE_MAX = 64;

/**
 * The kaleidoscope cell C0 the closed shape sits on for an anchor (SPEC 7): round 1's rule for the fixed cell
 * (pickRoot) applied to the anchor's OWN straight tile (the tile with seed = anchor, the given metric, no wave), so it
 * depends on the anchor alone: the cell in front of the anchor when the anchor is less than ROOT_SHIFT hy behind a
 * crease and at least ROOT_MIN of its tile lies there, else the anchor's own cell (nudged toward +x and -y, as
 * pickRoot nudges a seed). -> { iso: the cell's isometry (T -> world), point: a point of the cell next to the anchor,
 * inside it by a margin larger than the nudge of hinge.js, outside: the share of the anchor's tile that lies outside
 * C0 (what stage 1 has to fold over: 0 for "Bowl", 0.5 for "Pocket") } — `point` is what hingeKinematics is handed as
 * ITS anchor, so the walk of the anchored kinematics starts in C0. With anchor = seed, C0 is pickRoot's cell for that tile.
 */
export function anchorCell(group, anchor, metric) {
  if (!group || !group.kaleido) return null;
  const a = anchorOf(anchor);
  if (!a) return null;
  const key = `${group.id}|${a[0]}|${a[1]}|${Array.isArray(metric) ? metric.join(',') : ''}`;
  if (anchorCache.has(key)) return anchorCache.get(key);
  const T = group.kaleido.cell;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of T) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  let poly = null;
  try { poly = buildDomain(group, { seed: a, metric }).poly; } catch (e) { poly = null; }
  const sx = a[0] + 1e-6 * 0.3713;
  let g = null;
  const area = poly ? Math.abs(polyArea(poly)) : 0;
  const front = cellIsoAt(group, sx, a[1] - (ROOT_SHIFT * (y1 - y0)) / 2);
  if (front && poly && areaInCell(poly, front, T) >= ROOT_MIN * area) g = front;
  if (!g) g = cellIsoAt(group, sx, a[1] - 1e-6 * 0.9285);
  let hit = null;
  if (g) {
    // the anchor's T-coordinates, clamped into T shrunk by a margin (T is a rectangle in its own coordinates)
    const q = inverse(g), m = 1e-5 * Math.max(x1 - x0, y1 - y0);
    const u = Math.min(x1 - m, Math.max(x0 + m, q.a * a[0] + q.b * a[1] + q.tx));
    const v = Math.min(y1 - m, Math.max(y0 + m, q.c * a[0] + q.d * a[1] + q.ty));
    const outside = area > 0 ? Math.min(1, Math.max(0, 1 - areaInCell(poly, g, T) / area)) : 1;
    hit = Object.freeze({ iso: g, point: Object.freeze([g.a * u + g.b * v + g.tx, g.c * u + g.d * v + g.ty]), outside });
  }
  if (anchorCache.size >= ANCHOR_CACHE_MAX) anchorCache.delete(anchorCache.keys().next().value);
  anchorCache.set(key, hit);
  return hit;
}

// ---------------------------------------------------------------------------------------------------------------
// The fold
// ---------------------------------------------------------------------------------------------------------------

/**
 * Bands next to the great circle eta = 0 in which the mesh is refined, widest first, one level after the other: an
 * edge whose middle is closer to that circle than the number (in units of eta) is cut in half if it leads toward
 * or away from the circle (edges that run along it are left alone: the surface bends ACROSS the double line).
 * The fine mesh of mesh.js is graded toward the SIDES of a cell and is coarsest along its centre line, which is
 * exactly where the cross-cap folds the surface four to one: left as it is, the walls of the cleft are a handful
 * of large flat facets.
 */
const REFINE = [0.3, 0.15, 0.06];
/** An edge is cut only if its two ends differ in their distance from the circle by more than this share of the band. */
const REFINE_SPAN = 0.2;

/**
 * The mesh with finer triangles next to the lines of the plane that fold onto the great circle eta = 0: the centre
 * lines y = yc + 2 k hy of the kaleidoscope cells. Whether an edge is cut depends on the edge alone, and a triangle
 * with one, two or three cut sides is cut in two, three or four, so the mesh stays conforming (no T-junction).
 * The old vertices keep their indices; a new one sits in the middle of an old edge and takes the piece of a
 * triangle it was made for (the lowest index around it, the convention of mesh.js). Pieces, creases, boundary,
 * locate are untouched. Returns the mesh itself when there is nothing to do.
 */
export function refineNearRim(mesh, yc, hy, bands = REFINE) {
  if (!bands || !bands.length || !(hy > 0)) return mesh;
  let n = mesh.n, m = mesh.tri.length / 3;
  const xs = Array.from(mesh.xy.subarray(0, 2 * n)), cs = Array.from(mesh.cell.subarray(0, n));
  let tri = Array.from(mesh.tri), tc = mesh.triCell ? Array.from(mesh.triCell) : null;
  if (!tc) { tc = new Array(m); for (let t = 0; t < m; t++) tc[t] = Math.min(cs[tri[3 * t]], cs[tri[3 * t + 1]], cs[tri[3 * t + 2]]); }
  const dist = (y) => { const e = (y - yc) / hy; return Math.abs(e - 2 * Math.round(e / 2)); };
  let changed = false;
  for (const band of bands) {
    const mid = new Map();        // lo * n + hi -> the vertex in the middle of the edge
    const key = (u, v) => (u < v ? u * n + v : v * n + u);
    const mark = (u, v) => {
      if (dist((xs[2 * u + 1] + xs[2 * v + 1]) / 2) < band && Math.abs(dist(xs[2 * u + 1]) - dist(xs[2 * v + 1])) > REFINE_SPAN * band) mid.set(key(u, v), -1);
    };
    for (let t = 0; t < m; t++) {
      const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
      mark(a, b); mark(b, c); mark(c, a);
    }
    if (!mid.size) continue;
    changed = true;
    const n0 = n;
    const midOf = (u, v, piece) => {
      const k = u < v ? u * n0 + v : v * n0 + u;
      let w = mid.get(k);
      if (w === undefined) return -1;
      if (w < 0) { w = n++; xs.push((xs[2 * u] + xs[2 * v]) / 2, (xs[2 * u + 1] + xs[2 * v + 1]) / 2); cs.push(piece); mid.set(k, w); } else if (piece < cs[w]) cs[w] = piece;
      return w;
    };
    const out = [], oc = [];
    const put = (a, b, c, piece) => { out.push(a, b, c); oc.push(piece); };
    const d2 = (u, v) => (xs[2 * u] - xs[2 * v]) ** 2 + (xs[2 * u + 1] - xs[2 * v + 1]) ** 2;
    for (let t = 0; t < m; t++) {
      let a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
      const p = tc[t];
      let ab = midOf(a, b, p), bc = midOf(b, c, p), ca = midOf(c, a, p);
      const k = (ab >= 0) + (bc >= 0) + (ca >= 0);
      if (k === 0) { put(a, b, c, p); continue; }
      if (k === 3) { put(a, ab, ca, p); put(ab, b, bc, p); put(ca, bc, c, p); put(ab, bc, ca, p); continue; }
      // turn the triangle so that the pattern is: k = 1, the side a-b is cut; k = 2, the sides a-b and b-c are cut
      if (k === 1) {
        if (bc >= 0) { [a, b, c] = [b, c, a]; ab = bc; } else if (ca >= 0) { [a, b, c] = [c, a, b]; ab = ca; }
        put(a, ab, c, p); put(ab, b, c, p);
        continue;
      }
      if (ab < 0) { [a, b, c] = [b, c, a]; ab = bc; bc = ca; } else if (bc < 0) { [a, b, c] = [c, a, b]; bc = ab; ab = ca; }
      put(ab, b, bc, p);
      if (d2(ab, c) <= d2(a, bc)) { put(a, ab, c, p); put(ab, bc, c, p); } else { put(a, ab, bc, p); put(a, bc, c, p); }
    }
    tri = out; tc = oc; m = oc.length;
  }
  if (!changed) return mesh;
  return { ...mesh, n, xy: Float32Array.from(xs), cell: Uint16Array.from(cs), tri: Uint32Array.from(tri), m, triCell: Uint16Array.from(tc) };
}

export default function createFold(group, domain, mesh, opts = {}) {
  opts = opts || {};
  const design = DESIGN[opts.design] ? opts.design : 'cleft';
  const stage2 = opts.stage2 === 'twist' || design === 'spec' ? (design === 'spec' ? 'spec' : 'twist') : 'acts';
  const params = {};
  for (const k of ['mu', 'eps', 'gamma', 'plump', 'k']) if (Number.isFinite(opts[k]) || opts[k] === Infinity) params[k] = opts[k];
  const map = crosscapMap(design, params);
  const root = Number.isInteger(opts.root) ? opts.root : pickRoot(group, mesh);
  // SPEC 7: with an anchor, the closed shape sits on the anchor's cell C0; the hinge kinematics walk from a point of C0
  const anchor = anchorOf(opts.anchor), dom = domain || mesh.domain || {};
  const c0 = anchor ? anchorCell(group, anchor, dom.metric) : null;
  const kin = hingeKinematics(group, mesh, { plump: map.plump, root, anchor: c0 ? c0.point : undefined });
  // the work of stage 1 (round 3): how much of the anchor's own tile (the seed's, without an anchor) lies outside its
  // cell and has to be folded over. It depends on the anchor alone, so dragging the cut does not change the timing.
  const own = c0 || (dom.seed ? anchorCell(group, dom.seed, dom.metric) : null);
  const legacy = opts.timing === 'round2';          // round 2's timing, for comparison (TIMES_ROUND2)
  const work = legacy ? 1 : opts.work >= 0 && opts.work <= 1 ? opts.work : own ? smooth((own.outside - WORK[0]) / (WORK[1] - WORK[0])) : 1;
  const TM = legacy ? TIMES_ROUND2 : crosscapTimes(work);
  const schedule = legacy ? (t, out) => round2Schedule(t, out) : (t, out) => crosscapSchedule(t, out, work, TM);

  // the frame of the fixed cell (C0 with an anchor): centre, half sizes, and the signs that turn pillow coordinates
  // into world directions
  const r = kin.anchorIso, { cx, cy, hx, hy } = kin.box, hz = kin.hMax, iz = 1 / kin.zMax;
  const xc = r.a * cx + r.b * cy + r.tx, yc = r.c * cx + r.d * cy + r.ty;
  const sx = r.a < 0 ? -1 : 1, sy = r.d < 0 ? -1 : 1;
  const twist = opts.twist === -1 ? -1 : 1;
  const { L, D, final } = map, gamma = map.gamma === undefined ? 1 : map.gamma, mu = map.mu;
  const closedPillow = kin.pose(PI, 1);
  const p = [0, 0, 0], c3 = [0, 0, 0];

  /** The closed shape: the even map of the pillow point of (x, y). Does not depend on `cell`. */
  const closed = (x, y, cell, out) => {
    kin.pillow(x, y, cell, p);
    final(sx * p[0], sy * p[1], p[2] * iz, c3);
    out[0] = xc + hx * c3[0]; out[1] = yc + hy * c3[1]; out[2] = hz * c3[2];
    return out;
  };

  const step = opts.boundaryStep === undefined ? BOUNDARY_STEP * Math.sqrt(group.domainArea) : opts.boundaryStep;
  const bands = opts.refine === false ? null : Array.isArray(opts.refine) ? opts.refine : design === 'spec' ? null : REFINE;
  const drawn = refineBoundary(domain || mesh.domain, refineNearRim(mesh, yc, hy, bands), step);

  // how far the tile reaches into the near half (the part that is turned over in stage 2), and which way that part
  // is lifted as it folds back: +1 when it comes from the lower sheet (turned over, it passes above the far part)
  // (round 3: the lift is an integral over the AREA of the near part, triangle by triangle, so it changes continuously
  // with the cut; round 2 averaged over the mesh's vertices, and a wavy cut's vertex set changes from one drag step to
  // the next: the lift jumped by up to 0.09)
  let nearReach = 0, liftNum = 0, liftDen = 0;
  if (stage2 === 'acts') {
    const nv = drawn.n, wz = new Float64Array(nv), wa = new Float64Array(nv);
    const visit = (x, y, cell) => {
      kin.pillow(x, y, cell, p);
      const eta = sy * p[1];
      if (!(eta < 0)) return -1;
      const l = -L(eta);
      if (l > nearReach) nearReach = l;
      return l;
    };
    for (let v = 0; v < nv; v++) {
      const l = visit(drawn.xy[2 * v], drawn.xy[2 * v + 1], drawn.cell[v]);
      if (l > 0) { const zeta = p[2] * iz; wz[v] = -zeta * l; wa[v] = Math.abs(zeta) * l; }
    }
    for (const b of drawn.boundary) for (let j = 0; j < b.cells.length; j++) visit(b.pts[2 * j], b.pts[2 * j + 1], b.cells[j]);
    const T = drawn.tri, X = drawn.xy;
    for (let k = 0; k < T.length; k += 3) {
      const a = T[k], b = T[k + 1], c = T[k + 2];
      const ar = Math.abs((X[2 * b] - X[2 * a]) * (X[2 * c + 1] - X[2 * a + 1]) - (X[2 * b + 1] - X[2 * a + 1]) * (X[2 * c] - X[2 * a])) / 6;
      liftNum += ar * (wz[a] + wz[b] + wz[c]); liftDen += ar * (wa[a] + wa[b] + wa[c]);
    }
  }
  // (a tile whose near part lies mostly on one sheet swings all the way to that side; an even mix does not swing)
  const lift = liftDen > 0 ? Math.max(-1, Math.min(1, (LIFT_GAIN * liftNum) / liftDen)) : 1;
  const tm = [0, 0, 0, 0, 0], AP = actsParams(opts.acts);
  // the time of stage 2 at the middle stop: until then every tile zips alike (actsTiming); round 2: none
  const FREE = legacy ? 0 : (TM.halfStop - TM.zipStart) / (1 - TM.zipStart);

  /** Stage 2 at time u in (0, 1) of it; s = the zip's progress (crosscapSchedule). */
  function zipAt(s, u) {
    const w = 1 - s;
    if (stage2 === 'spec') {
      return (x, y, cell, out) => {
        kin.pillow(x, y, cell, p);
        const xi = sx * p[0], eta = sy * p[1], zeta = p[2] * iz;
        final(xi, eta, zeta, c3);
        out[0] = xc + hx * (w * xi + s * c3[0]); out[1] = yc + hy * (w * eta + s * c3[1]); out[2] = hz * (w * zeta + s * c3[2]);
        return out;
      };
    }
    if (stage2 === 'twist') {
      const rr = 1 + s * (gamma - 1);
      return (x, y, cell, out) => {
        kin.pillow(x, y, cell, p);
        const xi = sx * p[0], eta = sy * p[1], zeta = p[2] * iz;
        final(xi, eta, zeta, c3);
        const l = L(eta), a = hx * xi, b = hz * zeta * rr;
        if (l >= 0) {
          const f = w + s * l;
          out[0] = xc + f * a; out[2] = f * b;
        } else {
          // the near half: the factor goes from 1 to L(eta) < 0 around the origin of the complex plane, not through it
          const rho = w - s * l, ang = PI * smooth((-s * l) / rho) * twist;
          const fr = rho * Math.cos(ang), fi = rho * Math.sin(ang);
          out[0] = xc + fr * a - fi * b; out[2] = fi * a + fr * b;
        }
        out[1] = yc + hy * (w * eta + s * c3[1]);
        return out;
      };
    }
    // design 'acts': the pinch (sigma) for every point; the near part also rolls (kappa) and folds back (delta)
    actsTiming(u, nearReach, tm, AP, FREE);
    const sig = tm[0], kap = tm[1], del = tm[2], ws = 1 - sig, rr = 1 + sig * (gamma - 1);
    // the swing of the fold back: up (or down) and back, highest at del = 0.71, then straight down onto its place
    const liftK = lift * AP.lift * hy * Math.sin(PI * del * del);
    const back = tm[4];                                                  // the move back in y, done at landY
    return (x, y, cell, out) => {
      kin.pillow(x, y, cell, p);
      const xi = sx * p[0], eta = sy * p[1], zeta = p[2] * iz, z2 = zeta * zeta;
      const a = hx * xi, b = hz * zeta * rr;
      if (eta >= 0) {
        // the far part: the zip of the Pocket (round 1's stage 2 at the pinch's progress)
        const f = ws + sig * L(eta);
        out[0] = xc + f * a; out[2] = f * b;
        out[1] = yc + hy * (ws * eta + sig * (D(eta) + mu * z2));
        return out;
      }
      // the near part: pinched like the far part's mirror image, rolled about the double line, folded back
      const l = -L(eta), f = ws + sig * l, half = -ws * eta + sig * D(eta);
      // the roll waits for the pinch next to the double line (gate 0 there until sigma = 1), as the twist did
      const gate = ws > 0 ? (sig * l) / (sig * l + ws) : 1, ang = twist * PI * kap * smooth(gate);
      const co = Math.cos(ang), si = ang === twist * PI ? 0 : Math.sin(ang);
      out[0] = xc + f * (co * a - si * b);
      // it swings to the side the tile's near part mostly went to (fold.lift), all of it together: points that swing
      // to their own side instead (up from the lower sheet, down from the upper one) cross more, measured
      out[2] = f * (si * a + co * b) + liftK * half;
      // the cleft's backward shift: all of it next to the double line (continuity), on the body only as it folds back
      const wn = 1 - smooth(-eta / AP.neck), shift = wn + (1 - wn) * del;
      out[1] = yc + hy * (sig * mu * z2 * shift + (2 * back - 1) * half);
      return out;
    };
  }

  // the double line: the image of the great circle eta = 0 (design 'spec': of xi = 0), as a polyline
  const DL = 9;
  const lineClosed = new Float32Array(3 * DL);
  for (let i = 0; i < DL; i++) {
    const u = i / (DL - 1);
    if (design === 'spec') final(0, Math.sqrt(1 - u * u), u, c3); else final(Math.sqrt(1 - u), 0, Math.sqrt(u), c3);
    lineClosed[3 * i] = xc + hx * c3[0]; lineClosed[3 * i + 1] = yc + hy * c3[1]; lineClosed[3 * i + 2] = hz * c3[2];
  }
  const sched = [0, 0, 0], zq = [0, 0, 0], zh = [0, 0, 0];
  /** How much of the double line is drawn when the pinch (or the zip) has got to s: none until the sheets are within
   *  DOUBLE_FROM of meeting, then it grows out of the tip (smoothly), the whole line when they meet. */
  const lineShare = (s) => (s >= 1 ? 1 : s * smooth((s - DOUBLE_FROM) / (1 - DOUBLE_FROM)));

  return {
    // the mesh to draw: finer triangles where the surface folds onto the double line, finer outline (as in hinge.js)
    mesh: drawn,
    // the middle stop: the tile is half of the pillow; every seam but the glide seams is closed (a tile without
    // half-turn edges, "Bowl", has only glide seams). Round 2 called it "half pillow"; with the default cut that half
    // reads as a tube from the default camera, so the label says what is true of every cut.
    stops: [{ t: 0, label: 'flat' }, { t: TM.halfStop, label: MIDDLE_LABEL }, { t: 1, label: 'cross-cap' }],
    duration: 7,
    at(t) {
      if (!(t > 0)) return IDENTITY;
      if (t >= 1) return closed;
      schedule(t, sched);
      const one = sched[0] === PI && sched[1] === 1 ? closedPillow : kin.pose(sched[0], sched[1]);
      if (!(sched[2] > 0)) return one;
      const Z = zipAt(sched[2], (t - TM.zipStart) / (1 - TM.zipStart));
      if (one === closedPillow) return Z;
      // the zip has started while stage 1 is still landing: its move away from the half pillow is added to stage 1
      return (x, y, cell, out) => {
        Z(x, y, cell, zq); closedPillow(x, y, cell, zh); one(x, y, cell, out);
        out[0] += zq[0] - zh[0]; out[1] += zq[1] - zh[1]; out[2] += zq[2] - zh[2];
        return out;
      };
    },
    /**
     * The line of self-intersection as a polyline (Float32Array of 3k numbers): at t = 1 the true double line of the
     * closed shape. Before, only once the sheets that meet along it are within 3 % of meeting (the rim of the Pocket
     * in the last moments of the zip; for a cut that reaches into the near half, the end of the pinch, after which the
     * line is a true double line): then it grows out of the tip along the final line. Empty before (round 3: it no
     * longer floats in the open mouth).
     */
    doubleLine(t) {
      if (!(t > TM.zipStart)) return new Float32Array(0);
      if (t >= 1) return lineClosed.slice();
      let s = schedule(t, sched)[2];
      if (stage2 === 'acts') s = actsTiming((t - TM.zipStart) / (1 - TM.zipStart), nearReach, tm, AP, FREE)[0];
      const k = lineShare(s);
      if (!(k > 0)) return new Float32Array(0);
      const out = new Float32Array(3 * DL);
      for (let i = 0; i < DL; i++) {
        out[3 * i] = xc + k * (lineClosed[3 * i] - xc); out[3 * i + 1] = yc + k * (lineClosed[3 * i + 1] - yc); out[3 * i + 2] = k * lineClosed[3 * i + 2];
      }
      return out;
    },
    /** Stage 1's work in [0, 1]: 0 = no crease in the anchor's tile (the puff alone, from t = 0), 1 = a crease to fold. */
    work,
    /** The times of this fold (crosscapTimes(work)): hingeEnd, puffStart, halfEnd, zipStart, halfStop. */
    times: TM,
    /** The time u of stage 2 at the middle stop: the three acts run after it (actsTiming's `free`). */
    actsFree: FREE,
    /** The state between the two stages, half of the pillow; at the middle stop the zip has done 1.3 % (0.6 % for the Bowl). */
    halfPillow: closedPillow,
    kinematics: kin,
    design,
    /** 'acts' (the default), 'twist' (round 1) or 'spec': how stage 2 moves the part of the tile in the near half. */
    stage2,
    /** |L(eta)| at the point of the tile nearest the camera at the pause (0: the tile is the far half, the Pocket). */
    nearReach,
    /** Which way the near part is lifted while it folds back: +1 up (it comes from the lower sheet), -1 down. */
    lift,
    /** The anchor the closed shape is placed by (SPEC 7), as given, or null (anchor = seed: round 1). */
    anchor: c0 ? anchor : null,
    finalMap: map,
    /** The frame of the closed shape: normalised (M, Dp, V) -> world (xc + hx M, yc + hy Dp, hz V); signs of the pillow axes. */
    frame: { xc, yc, hx, hy, hz, sx, sy },
  };
}
