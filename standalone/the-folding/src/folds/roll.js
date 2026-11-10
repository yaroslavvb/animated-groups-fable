// folds/roll.js — the four folds that roll, bend and twist the tile shut instead of folding it flat (SPEC 5.3, 5.5, 7):
//   'torus' (o)   'cylinder' (**)   'mobius' (*x)   'klein' (xx)
// One module; the default export dispatches on group.fold.
//
// Every map here is "bend with growing curvature". Three building blocks, each analytic in its parameters and equal
// to the flat plane when they are 0 (sinc-type functions carry the limit, there is no division by a curvature):
//
//   roll      a coordinate x is wound onto a circle of curvature k that rests on the plane and opens upward:
//                 x -> (x sinc(kx), x cosc(kx)),     sinc(a) = sin a / a,   cosc(a) = (1 - cos a) / a.
//             Isometric. k = 2 pi / period closes it.
//   ring      a tube with axis coordinate y and cross-section (q1, q2) = (radial, up) is bent into a horizontal ring:
//                 ring angle Th = w 2 pi y / A  (w: 0 -> 1),   centre line length sigma y,   cross-section / sigma
//                 X = D(w) - sigma y cosc(Th) + (q1 / sigma) cos Th,   Y = sigma y sinc(Th) + (q1 / sigma) sin Th,   Z = q2 / sigma,
//             where D(w) = (sigma A / 2) g(pi w), g(a) = (1 - sinc a) / a, slides the ring so that it ends up centred on
//             the roll's centre. At w = 1 this is the circle of radius R = sigma A / (2 pi), exactly periodic in y with
//             period A. sigma = 1 + (sigma_f - 1) w is a gentle area-preserving change of proportions (longer by sigma,
//             thinner by sigma): it makes the ring sigma_f^2 times slimmer than the lattice alone would (sigma_f 1.10-1.16).
//   figure 8  the curve whose tangent angle is z cos(tau), tau = 2 pi s / b (s = arclength). Its drift over one period
//             is b J0(z): the straight line at z = 0, a wave that steepens and overhangs in between, and a CLOSED
//             figure 8 exactly when z is the first zero j01 of the Bessel function J0. By Jacobi-Anger
//                 x(s) = s J0(z) + (b / 2 pi) sum_{n even >= 2} c_n sin(n tau),     c_n = 2 (-1)^floor(n/2) J_n(z) / n,
//                 y(s) =           (b / 2 pi) sum_{n odd}       c_n sin(n tau),
//             so the 8 is an odd, b-periodic function of s and the whole homotopy is isometric along s.
//
//   cylinder  roll along the mirror direction (period b). The two mirror edges of the strip become the rims.
//   torus     roll along e1 (the tube), then ring along the tube, while the tube is twisted by -2 pi s/L per turn
//             (a shear x -> x - w s y / h2 before the roll), e2 = (s, h2) in the frame of e1 = (L, 0).
//             Final map = torus(2 pi (x - s y / h2) / L, 2 pi y / h2): invariant under e1 and e2.
//   mobius    the strip between two mirrors, c = distance from its centre line (a glide axis): ring along the strip
//             with the cross-section (c, 0) turned by Th / 2. Final: (R + c cos(Th/2)) (cos Th, sin Th), c sin(Th/2),
//             invariant under the glide (c, y) -> (-c, y + T).
//   klein     figure 8 across the glide axes (s = distance from a glide axis, so that the glide s -> -s is the half-turn
//             of the 8 about its crossing), then ring along the glide axis with the 8 turned by Th / 2 about its
//             crossing. Final: the figure-8 Klein bottle, invariant under the glide (y, s) -> (y + A, -s) and under
//             s -> s + b. The two classes of glide axes land on the double circle. Three turns make the motion legible
//             from the default camera (round 4; TUNE.klein; the judge's design of 9 Nov kept: qa/klein-judge.md):
//               flat   the 8 lies down while it closes: a quarter turn about its crossing on a cosine ramp in time
//                      (t 0.12 -> 0.6, 62 degrees at the inner stop), so the tube shows two scrolls side by side
//                      meeting along the dashed glide axis, each half of the tile in its own lobe, and the flat 8 at
//                      its near end, instead of an 8 seen edge-on, a needle (round-3 finding 28);
//               phase  during the ring stage a further turn that grows with the ring: with 0.5 the end of the tile at
//                      +A/2 (the head of the comma that straddles the glide seam, motif.js) keeps its 8 and the end at
//                      -A/2 (the comma's other part) makes the whole half turn, so one end visibly turns over to meet
//                      the other;
//               spin   the whole ring turns about the vertical through its centre while it closes (half a quarter
//                      turn, eased in), so the seam, which would close at the far left of the default view, closes at
//                      the front left, 45 degrees from the front: the tube's surface there, with the two parts of the
//                      comma, faces the camera, and the 8s at the two ends, which a seam in front would show edge-on,
//                      are seen at 0.41 of face-on when they join.
//             flat -1/2 + phase 1/2 give at t = 1 exactly the bottle of v1, turned about the vertical by the spin; its 8
//             lies flat at the seam, the joined comma on the two lobes. The lowest point of the cross-sections stays
//             on the plane: the lift is the 8's support in the downward direction over the turns present along the
//             tube (exactly the lobe's half-length once one of them is upright, from the middle of the ring stage on).
//
// Nothing here assumes how the group sits in the plane: directions, periods and axes are read from group.e1, e2, reps
// (test: the group turned by 37 and 90 degrees). A line direction (mirror, glide axis) is taken pointing right or
// straight up; with that, a ring closes on the side of the tile given by TUNE side (see the groupdata header for what
// the default 3D view, az 0 el 55 from the -y side, then sees). All folds go toward +z; the folded shape stays on or
// above the plane z = 0. The comma (motif.js, one big comma per tile since round 4) lies on the side of each closed roll
// that faces the default camera: share of it in the front layer, with the ported table of 10 Nov (src/groupdata/motif.js,
// 02:28): the band 100 %, the tube 96 %, the torus 86 %, the bottle 54 % (it wraps both lobes in front); the same for
// every cut, since the closed shape depends on the anchor alone; dev/roll4/commaview.mjs measures it (round-3 finding 27).
//
// THE ANCHOR (SPEC 7, the anchor contract; round-3 finding 4, the fix-up of the round-4 verification). opts.anchor =
// [x, y] is the plane point the app sets when a group or a preset is chosen (preset.anchor ?? preset.seed) and keeps
// while the cut is dragged or made wavy. It is a point of the PATTERN (actual coordinates: the motif does not move with
// the wave either). Phi_c denotes the closed map (t = 1) centred on the point c; it is G-invariant (for ** and *x:
// invariant under the strip's own symmetries, and the plane is folded into one strip by the group). With p the warped
// seed (domain.seedActual), the tile is pulled back next to the anchor, rolled there, and carried back:
//     F_t(x) = M_t( R_t^{c(t)}( g^-1 x ) ),   g in G,  M_0 = g on the plane,  M_1 = the identity,  c: g^-1 p -> a.
// (o, *x, xx write it with the translation part of g alone: R_t^{c(t)}(x - v), the cross-section turned a further
// beta(t): 0 -> pi when g reverses orientation; at t = 1 that is R_1^a(g^-1 x) exactly.)
// R_t^c is the roll centred on c (everything above). As the centre moves from g^-1 p (the symmetric curl of v1 near
// t = 0) to the anchor, the sheet slides round the shape by the material offset a - g^-1 p: g is chosen to keep that
// slide within HALF A TURN in every direction where it is a slide (the verifier's "whirl": with translations only,
// *x slid up to a full turn while it closed and xx up to 286 degrees; now <= 180 for every group), using
// orientation-reversing elements too; the reflection they need is done without turning the tile over where the roll
// itself can do it (*x, xx):
//   o    g = tau_v, v the lattice vector that rounds the lattice coordinates of p - a: the slides round the tube and
//        along the ring are at most half a turn (2 pi times the rounded-off coordinate at t = 1). Both slides, and the
//        travel to the anchor (M_t = tau_{(1-w) v}), go with the ring (w): stage 1 is v1's tube at the seed, closing on
//        top (SPEC 5.3); the closed tube then rolls round its own core while it bends.
//   xx   v = k b across + m A along, k and m rounded. m even: g = tau_v. m odd: g = tau_v o (the reflection in a glide
//        axis), and the reflection is the 8's half turn about its crossing (s -> -s): the 8 turns a further half turn
//        with the ring, against the phase, so the OTHER end of the tube holds and its partner turns over. Across, the
//        centre stays on p - v (the 8's phase is the material's own, nothing slides) and the shape travels to the
//        anchor rigidly at constant speed; along, the centre slides with the ring and the way back is tau_{(1-w) v}.
//   *x   v = j T along (j rounded) + the offset of the seed's strip from the anchor's across. tau_v in G: g = tau_v;
//        else g = tau_v o (the reflection in the anchor strip's centre line), a glide or a mirror image of the anchor,
//        and the band's segment turns over about its centre line (the reflection c -> -c) in the first `flap` of the
//        fold, while the tile crosses to the anchor's strip: for a neighbouring strip this is a page turn over the
//        mirror between them. The centre slides along with t. fold.mirrored = true for a tile an ODD number of strips
//        from the anchor's (final fix, 10 Nov: the band's colours flipped when the cut crossed a mirror): it is the
//        mirror image of a tile of the anchor's strip, so its normals are reversed at t = 1 and the app swaps the
//        colours; fold.mirroredAt(t) swaps while the segment is edge-on when it turns over, else with its slide
//        across. (params.flip is not the test: a glide image of the anchor in its own strip is reached by a drag
//        along the strip, which slides the band's front/back seam continuously and needs no swap.)
//   **   g = tau_v or tau_v o r_l with l the mirror that bounds the anchor's strip on the seed's side (when the strips
//        are an odd number of mirrors apart): M_t = tau_{o(t)} o Rot(l at height h0(t), pi (1 - f(t))), the tile turns
//        over the mirror like a page (f: 0 -> 1 over the first half) and lands, paper reversed, on the anchor's strip;
//        the axis is lifted to half the rolled sheet's height so nothing dips below the plane. o(t): along the mirrors
//        (1 - u) v, across them (1 - f) v. fold.mirrored = true for such a tile (SPEC 8 C3: the app swaps the surface
//        colours, so the closed tube looks the same), and fold.mirroredAt(t) says WHEN: 0 until the page nears
//        edge-on, 1 after (the flat tile keeps its colour; round-4 finding 4 asks the app to use it).
// At t = 1 this is Phi_a(g^-1 x) = Phi_a(x) (the G-invariant extension): every plane point goes to the same place for
// every seed and every wave, so the folded shape and its comma stay put while the coloured seams slide over it.
// For 0 < t < 1, F_t is continuous in the seed, except where g changes (fold.anchorImage, the image a + v of the anchor
// the tile is rolled onto, changes) while a slide is under way. Such a switch is unavoidable if the slide is to stay
// bounded (the seed half a turn from the anchor either way) and remains for the slides of the ring stage (o, xx, *x:
// along the ring; o, **: round the tube); it is gone where nothing slides: o and xx in stage 1, xx across the glide
// axes at every t, *x and ** across any mirror once the turn over is done (t >= flap: 0.6 and 0.5). dev/roll5/switch.mjs
// measures it. Without opts.anchor (or with a malformed one) g is the identity and the centre is p throughout: exactly
// the v1 fold (anchor = seed). While the cross-section of *x or xx makes its further half turn, the lift that keeps the
// lowest point on the plane is rounded where the end that rests on the plane changes (liftShare, liftFor: eps; never
// lower than exact; for *x in step with the turn's speed, so nothing is left once it is done).
//
// Timing. The timeline eases a whole play at both ends, so at(t) itself runs at constant speed: the scrubber answers
// at once at t = 0 and the steps are of one order throughout. Only the inner junction of the two-stage folds is shaped
// (rollSchedule): the first stage brakes into the inner stop while the ring is already picking up speed, so the motion
// slows there (to about a tenth of its mean speed, for a moment) but never rests, and at the stop the ring has turned
// only 6 degrees: the stop still shows a tube.
//
// The sheet never meets itself on the way (test "embedded"; no spiral offset is needed): a line across the tube's
// axis meets the tile in a chord no longer than the period, because the tile and its translate do not overlap, and
// the curvature only reaches 2 pi / period at the end.
//
// Exports
//   default createFold(group, domain, mesh, opts) -> Fold             (SPEC 5.3; opts.anchor, SPEC 7)
//       opts.anchor    [x, y]: see THE ANCHOR. fold.anchor = the anchor used (or null); fold.anchorImage = the copy of
//                      the anchor the tile is rolled onto (** : g a; o, *x, xx: a + v), or null; fold.mirrored (** and
//                      *x: true when the tile lies an odd number of mirrors from the anchor's strip, so its closed
//                      shape shows its other side) and fold.mirroredAt(t) (** and *x: 0 -> 1 across the edge-on moment
//                      of the turn over, for *x without one with its slide across; 0 throughout for other tiles);
//                      params.flip (*x, xx: the cross-section turns a further half turn: a glide or mirror image of the
//                      anchor is nearest); params.strips (*x: the seed's strip minus the anchor's).
//       opts.density   grid steps wanted for the tile mesh (default: rollDensity(group)); `false` keeps the mesh as given.
//       If the mesh that is passed in is coarser than that, the fold builds its own (buildMesh with that density) and
//       returns it as fold.mesh — pass { density: rollDensity(group) } to buildMesh and nothing is built twice.
//       opts.tune      overrides of TUNE[type] (experiments: dev/roll4/, dev/roll5/).
//       Fold has, beyond the SPEC: type, params (the numbers of the shape), schedule(t) (the stage parameters) and,
//       for klein, doubleLine(t): the two glide-axis lines of the tile, mapped (they become the double circle).
//   rollDensity(group)          the buildMesh density this fold wants (the tube / the 8 must not look faceted)
//   rollSchedule(type, t)       { a, w }: stage parameters of the two-stage folds (a: tube / 8, w: ring), C2 in t
//   STAGE                       { torus: { t1, t2 }, klein: { t1, t2 } }: the inner stop t1; the ring starts at t2 < t1
//   sinc, cosc, figure8, J01, easeIn, easeOut      the building blocks (for the tests)

import { classify, det } from '../geom.js';
import { elementsNear, latticeCoords } from '../groups.js';
import { buildMesh } from '../mesh.js';
import { VIEW0, SWAP_HALF, edgeOnWindow } from './hinge.js';

const PI = Math.PI, TAU = 2 * Math.PI;

/** First zero of the Bessel function J0: the wave with tangent angle z cos(tau) closes into a figure 8 at z = J01. */
export const J01 = 2.404825557695773;
const N8 = 22;                       // harmonics of the 8 that are kept (J_n(2.4) / n < 1e-20 beyond)

// ---------------------------------------------------------------------------------------------------------------
// Tuning. Proportions come from the lattices in src/groupdata/roll.js; these are the targets and the timing.
// ---------------------------------------------------------------------------------------------------------------

const TUNE = {
  // t1: the inner stop (the tube / the 8 is closed). The first stage brakes over the last `brake` of t before it;
  // the ring starts `overlap` before it and reaches its constant speed `accel` later: the motion never rests,
  // and at the stop the ring has only just begun (a few degrees).
  // ratio: wanted ring radius / tube radius. The ring stage makes the shape longer by sigma and thinner by sigma
  // (sigma: 1 -> sigma_f, area kept); sigma_f = sqrt(ratio / the lattice's own ratio), between 1 and maxStretch.
  // side: -1 puts the ring's centre on the other side of the seed. spin: as for klein (0: the ring closes at the far
  // left of the default view; the big comma wraps the top of the tube near that seam, whichever way the ring turns).
  // (An anchored tile's slides round the tube and along the ring, and its way to the anchor, go with the ring: THE ANCHOR.)
  torus: { duration: 6, t1: 0.45, brake: 0.13, overlap: 0.06, accel: 0.13, ratio: 2.6, maxStretch: 1.2, side: 1, density: 88 },
  // flap: the share of the fold over which a tile an odd number of mirrors from the anchor turns over (THE ANCHOR).
  cylinder: { duration: 4, density: 60, flap: 0.5 },
  // ratio: wanted ring radius / half-width of the band. twist: +1 / -1, the sense of the half twist.
  // flap: the share of the fold over which an anchored tile crosses to the anchor's strip and, when a glide or a mirror
  // image of the anchor is the nearest, turns its segment over (THE ANCHOR); flipEps rounds the lift while it turns,
  // in step with its speed (liftShare: second differences 0.0101 -> 0.0016 tile sizes per 1/200 with flap 0.6, no
  // flipped tile above the unflipped ones' 0.0015; dev/roll5/sweep.mjs).
  mobius: { duration: 5.5, ratio: 2.3, maxStretch: 1.2, twist: 1, side: 1, density: 80, flap: 0.6, flipEps: 0.4 },
  // ratio: wanted ring radius / half-length of the 8. twist: the sense in which the 8 turns along the ring.
  // phase (designer A, 9 Nov 2026), in half turns: an extra turn of the 8 about its crossing that grows with the
  // ring stage, the same all along the tube: with 0.5 the end of the tile at +A/2 keeps its 8 as the tube had it
  // and the end at -A/2 makes the whole half turn (one sees one end turn over to meet the other).
  // flat (round 4), in quarter turns: the turn of the 8 about its crossing while it closes, on a cosine ramp in time
  // from flatFrom to flatTo: -1 lays it on the plane with each half of the tile in its own lobe (finding 28). It ends
  // early in the ring stage, when the chord of the tile has shrunk (turned faster while the sheet is still wide, its far
  // edge would sweep a long arc: steps of 0.028 and second differences of 0.0046 tile sizes against the 0.025 and
  // 0.0012 of test/folds.test.js); at the inner stop it has turned 62 of the 90 degrees.
  // spin (round 4), in quarter turns: a turn of the whole ring about the vertical through its centre during the ring
  // stage, eased in over the first spinEase of it: the seam, which would close at the far left of the default view,
  // closes at the front left. 0.5: 45 degrees from the front (fix-up of the round-4 verification, finding 2): the
  // tube's surface there, with the two parts of the comma, faces the camera, and the 8s at the two ends are seen at
  // 0.41 of face-on when they join (0.574 sin 45 degrees; 0.75 put the seam 22.5 degrees from the front, where the
  // end that turns over was an edge-on sliver from t = 0.8 to 0.97 and the joined 8 two thin ellipses, 0.22).
  // With flat -1 and phase 0.5 the closed bottle is v1's point for point, turned about the vertical by the spin.
  // flipEps: the rounding of the lift while an anchored tile turns its 8 a further half turn (liftFor; THE ANCHOR).
  klein: { duration: 7, t1: 0.42, brake: 0.13, overlap: 0.06, accel: 0.13, ratio: 2.1, maxStretch: 1.2, twist: -1, side: 1, density: 104,
    phase: 0.5, flat: -1, flatFrom: 0.12, flatTo: 0.6, spin: 0.5, spinEase: 0.3, flipEps: 0.25 },
};

/** The inner stop of the two-stage folds: stage 1 ends at t1, stage 2 starts at t2 < t1. */
export const STAGE = {
  torus: { t1: TUNE.torus.t1, t2: TUNE.torus.t1 - TUNE.torus.overlap },
  klein: { t1: TUNE.klein.t1, t2: TUNE.klein.t1 - TUNE.klein.overlap },
};

// ---------------------------------------------------------------------------------------------------------------
// Small functions
// ---------------------------------------------------------------------------------------------------------------

/** sin(a) / a, smooth through 0. */
export function sinc(a) {
  const q = a * a;
  return q < 1e-8 ? 1 - q / 6 : Math.sin(a) / a;
}
/** (1 - cos a) / a, smooth through 0 (odd in a). */
export function cosc(a) {
  if (a * a < 1e-8) return a * (0.5 - (a * a) / 24);
  const h = Math.sin(a / 2);
  return (2 * h * h) / a;
}
/** (1 - sinc a) / a, smooth through 0 (odd in a). */
function gsinc(a) {
  const q = a * a;
  return q < 1e-4 ? a * (1 / 6 - q * (1 / 120 - q / 5040)) : (1 - Math.sin(a) / a) / a;
}
/** Integral of the velocity ramp 3y^2 - 2y^3 (0 before 0, 1 after 1). */
const ramp = (y) => (y <= 0 ? 0 : y >= 1 ? y - 0.5 : y * y * y * (1 - y / 2));
/** 0 -> 1 on [0, 1]: a smooth start over the first fraction f, then constant speed. C2; zero velocity at 0 only. */
export function easeIn(x, f) { return x <= 0 ? 0 : x >= 1 ? 1 : (f * ramp(x / f)) / (1 - f / 2); }
/** 0 -> 1 on [0, 1]: constant speed, then a smooth stop over the last fraction f. C2; zero velocity at 1 only. */
export function easeOut(x, f) { return 1 - easeIn(1 - x, f); }
/** 0 -> 1 on [0, 1], C2 with zero velocity and acceleration at both ends (6x^5 - 15x^4 + 10x^3). */
const smoother = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (10 + x * (6 * x - 15)));

/**
 * Stage parameters at time t, both C2 in t: a (stage 1: the tube / the 8 closes, done at t1) and w (stage 2: the ring).
 * The play of the whole motion is eased by the timeline, so the stages run at constant speed and only the inner
 * junction is shaped: stage 1 brakes into t1 while stage 2 is already picking up speed.
 */
export function rollSchedule(type, t, out = { a: 0, w: 0 }) { return schedule(TUNE[type] || {}, t, out); }

function schedule(T, t, out) {
  t = t <= 0 ? 0 : t >= 1 ? 1 : t;
  if (!(T.t1 > 0)) { out.a = t; out.w = t; return out; }        // one stage: constant speed
  const t2 = T.t1 - T.overlap;
  out.a = easeOut(t / T.t1, T.brake / T.t1);
  out.w = easeIn((t - t2) / (1 - t2), T.accel / (1 - t2));
  return out;
}

/** The tuning of a fold type, with the overrides of opts.tune (for experiments: dev/roll4/). */
const tuned = (type, opts) => (opts && opts.tune ? { ...TUNE[type], ...opts.tune } : TUNE[type]);

/** Bessel functions J_0 .. J_N of z (power series; meant for |z| <= 3), into out. */
function besselJ(z, N, out) {
  const h = z / 2, h2 = h * h;
  let lead = 1;                                  // h^n / n!
  for (let n = 0; n <= N; n++) {
    if (n > 0) lead *= h / n;
    let term = lead, sum = lead;
    for (let m = 1; m < 60; m++) {
      term *= -h2 / (m * (m + n));
      sum += term;
      if (Math.abs(term) < 1e-19) break;
    }
    out[n] = sum;
  }
  return out;
}

/**
 * The figure-8 homotopy at stage z in [0, J01], for a period b = 2 pi (scale the result by b / 2 pi):
 *   returns { j0, c: Float64Array(N8 + 1), n, reach } with
 *   wave(tau) = (sum_{n even} c[n] sin(n tau), sum_{n odd} c[n] sin(n tau)),  position = (s J0, 0) + wave,
 *   reach = wave_y(pi / 2): the height of a crest (at z = J01: the half-length of the 8).
 */
export function figure8(z) {
  const J = besselJ(z, N8, new Float64Array(N8 + 1));
  const c = new Float64Array(N8 + 1);
  let n = 0, reach = 0;
  for (let k = 1; k <= N8; k++) {
    c[k] = ((k >> 1) & 1 ? -2 : 2) * J[k] / k;
    if (Math.abs(c[k]) > 1e-18) n = k;
    if (k & 1) reach += (2 * J[k]) / k;        // sin(k pi / 2) = (-1)^((k-1)/2) cancels the sign of c[k]
  }
  return { j0: z === J01 ? 0 : J[0], c, n, reach };
}

function identityMap(x, y, cell, out) { out[0] = x; out[1] = y; out[2] = 0; return out; }

/** Unit vector along (x, y), with rounding dust (|component| < 1e-12) removed so that axis-parallel stays exact. */
function unit(x, y) {
  const l = Math.hypot(x, y);
  let ux = x / l, uy = y / l;
  if (Math.abs(ux) < 1e-12) { ux = 0; uy = uy < 0 ? -1 : 1; }
  if (Math.abs(uy) < 1e-12) { uy = 0; ux = ux < 0 ? -1 : 1; }
  return [ux, uy];
}
/** The direction of a LINE (a mirror, a glide axis) as a unit vector, with a fixed sense: pointing right, or straight up. */
function lineDir(x, y) {
  const u = unit(x, y);
  return u[0] < 0 || (u[0] === 0 && u[1] < 0) ? [-u[0], -u[1]] : u;
}

/** Length of the shortest lattice vector parallel to the unit vector (ux, uy); Infinity if there is none nearby. */
function latticePeriod(group, ux, uy) {
  const { e1, e2 } = group;
  let best = Infinity;
  for (let m = -6; m <= 6; m++) {
    for (let n = -6; n <= 6; n++) {
      if (!m && !n) continue;
      const x = m * e1[0] + n * e2[0], y = m * e1[1] + n * e2[1], l = Math.hypot(x, y);
      if (Math.abs(x * uy - y * ux) < 1e-9 * l && l < best) best = l;
    }
  }
  return best;
}

function findRep(group, type) {
  for (const r of group.reps) {
    if (det(r) > 0) continue;
    const c = classify(r);
    if (c.type === type) return c;
  }
  throw new Error(`roll fold: group ${group.id} has no ${type} among its coset representatives`);
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** [min, max] of the tile's outline projected on the unit vector (dx, dy) (the outline holds the extreme points). */
function extent(mesh, dx, dy) {
  let lo = Infinity, hi = -Infinity;
  const take = (x, y) => { const s = x * dx + y * dy; if (s < lo) lo = s; if (s > hi) hi = s; };
  if (mesh && Array.isArray(mesh.boundary) && mesh.boundary.length) {
    for (const b of mesh.boundary) for (let i = 0; i < b.pts.length; i += 2) take(b.pts[i], b.pts[i + 1]);
  } else if (mesh && mesh.xy) {
    for (let i = 0; i < 2 * mesh.n; i += 2) take(mesh.xy[i], mesh.xy[i + 1]);
  }
  return lo <= hi ? [lo, hi] : [0, 0];
}

// ---------------------------------------------------------------------------------------------------------------
// The anchor (SPEC 7): which copy of the closed shape the tile folds onto, and the rigid motion that takes it there
// ---------------------------------------------------------------------------------------------------------------

/** opts.anchor as two finite numbers, or null (missing or malformed: anchor = seed, the v1 behaviour). */
function anchorOf(a) {
  if (!a || typeof a === 'string' || !(a.length >= 2)) return null;
  const x = Number(a[0]), y = Number(a[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/**
 * The anchored frame of the cylinder (**; THE ANCHOR at the top): { anchor, p, image, start, end, gi, v, flap, mirrored }.
 * (o, *x and xx pull back by a translation and turn the cross-section where a reflection is needed: pullBy.)
 *   p        the warped seed;  image = g a (the image of the anchor next to the seed; null without an anchor)
 *            start = g^-1 p and end = the anchor: where the roll is centred at t = 0 and t = 1
 *   gi       g^-1 as {a, b, c, d, tx, ty}, or null (no anchor: g = identity, start = end = p, the v1 fold)
 *   v        the translation part of g = tau_v (o r_l)
 *   flap     null, or the mirror l of g = tau_v o r_l: { nx, ny, c, m } (the line n.x = c; m = +-1: the anchor lies on
 *            the side where m (n.x - c) > 0)
 * strip: { nx, ny, m0, w } (** and *x): the mirrors n.x = m0 + k w; g must carry the anchor into the seed's strip.
 * reflections: may g reverse orientation (**)? Otherwise g is a translation.
 */
function anchorFrame(group, domain, opts, { strip = null, reflections = false } = {}) {
  const p = domain.seedActual || domain.seed;
  const a = anchorOf(opts && opts.anchor);
  const none = { anchor: null, p, image: null, start: p, end: p, gi: null, v: [0, 0], flap: null, mirrored: false };
  if (!a) return none;
  const stripOf = strip ? (x, y) => Math.floor((x * strip.nx + y * strip.ny - strip.m0) / strip.w) : null;
  const sd = domain.seed || p, want = stripOf ? stripOf(sd[0], sd[1]) : 0;
  const size = Math.sqrt(group.domainArea);
  let best = null, bd = Infinity, bx = 0, by = 0;
  for (let R = 2.5 * size; !best && R <= 80 * size; R *= 2) {
    for (const g of elementsNear(group, p[0], p[1], R, a[0], a[1])) {
      if (!reflections && det(g) < 0) continue;
      const gx = g.a * a[0] + g.b * a[1] + g.tx, gy = g.c * a[0] + g.d * a[1] + g.ty;
      if (stripOf && stripOf(gx, gy) !== want) continue;
      const d = Math.hypot(gx - p[0], gy - p[1]);
      // the nearest image; exact ties (a seed half-way between two images) go to the lower-left one
      if (d < bd - 1e-12 * size || (d <= bd + 1e-12 * size && (gx < bx - 1e-12 || (Math.abs(gx - bx) <= 1e-12 && gy < by)))) {
        best = g; bd = d; bx = gx; by = gy;
      }
    }
  }
  if (!best) return none;
  if (det(best) > 0) {
    const v = [best.tx, best.ty];                                  // the linear part is the identity (no rotations here)
    return { anchor: a, p, image: [bx, by], start: [p[0] - v[0], p[1] - v[1]], end: a, gi: { a: 1, b: 0, c: 0, d: 1, tx: -v[0], ty: -v[1] }, v, flap: null, mirrored: false };
  }
  // g = tau_v o r_l: l the mirror that bounds the anchor's strip on the seed's side
  const { nx, ny } = strip, ka = stripOf(a[0], a[1]);
  const c = strip.m0 + (want > ka ? ka + 1 : ka) * strip.w;
  const r = { a: 1 - 2 * nx * nx, b: -2 * nx * ny, c: -2 * nx * ny, d: 1 - 2 * ny * ny, tx: 2 * c * nx, ty: 2 * c * ny };
  const ra = [r.a * a[0] + r.b * a[1] + r.tx, r.c * a[0] + r.d * a[1] + r.ty];
  const v = [bx - ra[0], by - ra[1]];
  const gi = { a: r.a, b: r.b, c: r.c, d: r.d, tx: r.tx - (r.a * v[0] + r.b * v[1]), ty: r.ty - (r.c * v[0] + r.d * v[1]) };   // r(x - v)
  const start = [gi.a * p[0] + gi.b * p[1] + gi.tx, gi.c * p[0] + gi.d * p[1] + gi.ty];
  const m = a[0] * nx + a[1] * ny - c > 0 ? 1 : -1;
  return { anchor: a, p, image: [bx, by], start, end: a, gi, v, flap: { nx, ny, c, m }, mirrored: true };
}

/**
 * The anchored pull-back of o, *x and xx (THE ANCHOR): the tile is carried back by the translation v, rolled about a
 * centre that slides from start = p - v to the anchor, and carried forward again. flip: tau_v is not in G (the image of
 * the anchor nearest the seed is a glide or mirror image): the fold adds a half turn of the cross-section that does the
 * reflection. image = a + v.
 */
function pullBy(a, p, v, flip) {
  return { anchor: a, p, v, flip, start: [p[0] - v[0], p[1] - v[1]], end: a, image: [a[0] + v[0], a[1] + v[1]] };
}

/** Is (x, y) a translation of the group (a vector of its lattice)? */
function isLattice(group, x, y) {
  const c = latticeCoords(group, x, y);
  return Math.abs(c[0] - Math.round(c[0])) < 1e-9 && Math.abs(c[1] - Math.round(c[1])) < 1e-9;
}

/**
 * The page turn of a mirrored tile (THE ANCHOR, M_t for g = tau_v o r_l): rotates out (x, y, z) about the mirror line
 * lifted to height h0 by phi (pi: the reflection in l on the plane; 0: nothing), in the sense that lifts the anchor's
 * side toward +z for 0 < phi < pi. A point at height z in [0, 2 h0] stays at or above the plane.
 */
function turnPage(F, phi, h0, out) {
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const e = out[0] * F.nx + out[1] * F.ny - F.c, d = F.m * e, z = out[2] - h0;
  const d2 = d * cp - z * sp, s = F.m * (d2 - d);
  out[0] += s * F.nx; out[1] += s * F.ny; out[2] = h0 + d * sp + z * cp;
}

// ---------------------------------------------------------------------------------------------------------------
// The mesh: fine enough that a tube does not look faceted
// ---------------------------------------------------------------------------------------------------------------

/** The buildMesh density (grid steps across the longer side of the tile's bounding box) this fold wants. */
export function rollDensity(group) {
  const T = TUNE[group.fold];
  return T ? T.density : 56;
}

/** Grid steps across the longer side of the mesh's bounding box, estimated from its largest triangle. */
function meshSteps(mesh) {
  const { xy, tri } = mesh;
  let amax = 0;
  for (let i = 0; i < tri.length; i += 3) {
    const a = tri[i], b = tri[i + 1], c = tri[i + 2];
    const ar = (xy[2 * b] - xy[2 * a]) * (xy[2 * c + 1] - xy[2 * a + 1]) - (xy[2 * b + 1] - xy[2 * a + 1]) * (xy[2 * c] - xy[2 * a]);
    if (ar > amax) amax = ar;                   // a full grid cell is two triangles of doubled area step^2
  }
  const bb = mesh.bbox;
  return amax > 0 ? Math.max(bb[2] - bb[0], bb[3] - bb[1]) / Math.sqrt(amax) : 0;
}

/** The mesh to draw: the one given if it is fine enough (or opts.density is false), else one built with the wanted density. */
function fineMesh(group, domain, mesh, opts) {
  const want = opts && opts.density !== undefined ? opts.density : tuned(group.fold, opts).density;
  if (!mesh || !mesh.tri) return buildMesh(group, domain, want ? { density: want } : {});
  if (!want || meshSteps(mesh) >= 0.82 * want) return mesh;
  return buildMesh(group, domain, { density: want });
}

/** The mirrors of a group with one family of parallel mirrors: { dx, dy (along them, lineDir), nx, ny, m0, w }. */
function mirrorStrips(group) {
  const mir = findRep(group, 'reflection');
  const [dx, dy] = lineDir(mir.dir[0], mir.dir[1]);
  const nx = -dy, ny = dx;
  return { dx, dy, nx, ny, m0: mir.point[0] * nx + mir.point[1] * ny, w: latticePeriod(group, nx, ny) / 2 };
}

// ---------------------------------------------------------------------------------------------------------------
// cylinder (**)
// ---------------------------------------------------------------------------------------------------------------

function cylinderFold(group, domain, mesh, opts) {
  const T = tuned('cylinder', opts);
  const S = mirrorStrips(group), dx = S.dx, dy = S.dy;           // the roll direction: along the mirrors
  const b = latticePeriod(group, dx, dy);                        // the translation that closes the tube
  const AF = anchorFrame(group, domain, opts, { strip: S, reflections: true });
  const gi = AF.gi, flap = AF.flap;
  const cS = AF.start[0] * dx + AF.start[1] * dy, cE = AF.end[0] * dx + AF.end[1] * dy;
  const kf = TAU / b, fl = clamp(Number(T.flap) || 0.5, 0.05, 1);
  // the pulled-back tile's extent along the roll (the lifted page-turn axis needs the rolled sheet's height)
  const ext = flap ? extent(mesh, dx, dy) : null, vd = AF.v[0] * dx + AF.v[1] * dy;
  // the way back: along the mirrors with the roll (u), across them with the page turn (f), so that once it is done the
  // tiles on the two sides of any mirror fold alike (the across parts of v differ there; THE ANCHOR)
  const vn = AF.v[0] * S.nx + AF.v[1] * S.ny;
  const zOf = (xi, k) => (Math.abs(k * xi) >= PI ? 2 / k : Math.abs(xi * cosc(k * xi)));
  const p0 = AF.end;
  return {
    mesh, type: 'cylinder', duration: T.duration, anchor: AF.anchor, anchorImage: AF.image, mirrored: AF.mirrored,
    stops: [{ t: 0, label: 'flat' }, { t: 1, label: 'tube' }],
    params: { roll: [dx, dy], period: b, radius: b / TAU, center: [p0[0], p0[1], b / TAU] },
    schedule(t) { return schedule(T, t, { a: 0, w: 0 }); },
    /**
     * How far the surface colours are swapped at t (0: front is front; 1: swapped, as fold.mirrored asks for the closed
     * tube): 0 until the page turn nears edge-on (phi = pi / 2, t = flap / 2), 1 after it, a smooth cross-fade over
     * the 36 degrees of the turn around edge-on. Without a page turn, 0 throughout.
     */
    mirroredAt(t) {
      if (!flap) return 0;
      const u = t > 0 ? (t >= 1 ? 1 : t) : 0;
      return smoother((smoother(u / fl) - 0.4) / 0.2);
    },
    at(t) {
      if (!(t > 0)) return identityMap;
      const u = t >= 1 ? 1 : t, k = u * kf;
      const c0 = gi ? cS + u * (cE - cS) : cS;
      const f = smoother(u / fl), ox = (1 - u) * vd * dx + (1 - f) * vn * S.nx, oy = (1 - u) * vd * dy + (1 - f) * vn * S.ny;
      let phi = 0, h0 = 0;
      if (flap) {
        phi = PI * (1 - f);
        h0 = 0.5 * Math.max(zOf(ext[0] - vd - c0, k), zOf(ext[1] - vd - c0, k));
      }
      return (x, y, cell, out) => {
        let qx = x, qy = y;
        if (gi) { qx = gi.a * x + gi.b * y + gi.tx; qy = gi.c * x + gi.d * y + gi.ty; }
        const xi = qx * dx + qy * dy - c0, a = k * xi;
        const m = xi * sinc(a) - xi;                             // how far the point moves along the roll direction
        out[0] = qx + m * dx; out[1] = qy + m * dy; out[2] = xi * cosc(a);
        if (flap && phi > 0) turnPage(flap, phi, h0, out);
        if (gi) { out[0] += ox; out[1] += oy; }
        return out;
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// torus (o)
// ---------------------------------------------------------------------------------------------------------------

function torusFold(group, domain, mesh, opts) {
  const T = tuned('torus', opts), side = T.side < 0 ? -1 : 1;
  const L = Math.hypot(group.e1[0], group.e1[1]);
  const [ux, uy] = unit(side * group.e1[0], side * group.e1[1]); // roll direction (around the tube); the ring's centre ends up on its far side
  const vx = -uy, vy = ux;                                       // tube axis
  let s = group.e2[0] * ux + group.e2[1] * uy, h2 = group.e2[0] * vx + group.e2[1] * vy;
  if (h2 < 0) { s = -s; h2 = -h2; }
  s -= L * Math.round(s / L);                                    // the smallest twist: |s| <= L / 2
  const sigF = clamp(Math.sqrt((T.ratio * L) / h2), 1, T.maxStretch), R = (sigF * h2) / TAU, r = L / (TAU * sigF);
  const k1f = TAU / L, shf = s / h2, kpf = TAU / h2, spinF = (PI / 2) * (Number(T.spin) || 0);
  const sch = { a: 0, w: 0 };
  // THE ANCHOR: v rounds the lattice coordinates of p - a, so the tile slides round the tube and along the ring by at
  // most half a turn each; both slides, and the travel to the anchor, go with the ring (w): stage 1 is v1's tube at
  // the seed, closing on top, and the closed tube then rolls round its own core while it bends
  const p = domain.seedActual || domain.seed, an = anchorOf(opts && opts.anchor);
  let AN = null;
  if (an) {
    const lc = latticeCoords(group, p[0] - an[0], p[1] - an[1]), m = Math.round(lc[0]), n = Math.round(lc[1]);
    AN = pullBy(an, p, [m * group.e1[0] + n * group.e2[0], m * group.e1[1] + n * group.e2[1]], false);
  }
  const C = AN ? AN.end : p;
  return {
    mesh, type: 'torus', duration: T.duration, anchor: AN ? AN.anchor : null, anchorImage: AN ? AN.image : null,
    stops: [{ t: 0, label: 'flat' }, { t: T.t1, label: 'tube' }, { t: 1, label: 'torus' }],
    params: { roll: [ux, uy], axis: [vx, vy], L, s, h2, tubeRadius: r, ringRadius: R, stretch: sigF, center: [C[0], C[1], r] },
    schedule(t) { return schedule(T, t, { a: 0, w: 0 }); },
    at(t) {
      if (!(t > 0)) return identityMap;
      const { a, w } = schedule(T, t, sch);
      let x0 = p[0], y0 = p[1], ox = 0, oy = 0, vx0 = 0, vy0 = 0;
      if (AN) {
        x0 = AN.start[0] + w * (AN.end[0] - AN.start[0]); y0 = AN.start[1] + w * (AN.end[1] - AN.start[1]);
        vx0 = AN.v[0]; vy0 = AN.v[1]; ox = (1 - w) * vx0; oy = (1 - w) * vy0;
      }
      const k1 = a * k1f, sh = w * shf, kp = w * kpf;
      const sig = 1 + (sigF - 1) * w, del = 0.5 * sig * h2 * gsinc(PI * w);
      const thin = 1 / sig;
      const psi = spinF * w, cps = Math.cos(psi), sps = Math.sin(psi);
      return (x, y, cell, out) => {
        let qx = x, qy = y;
        if (AN) { qx = x - vx0; qy = y - vy0; }
        const px = qx - x0, py = qy - y0;
        const eta = px * vx + py * vy, xi = px * ux + py * uy - sh * eta;
        const th = k1 * xi, xs = thin * xi, rho = xs * sinc(th);
        const ph = kp * eta, se = sig * eta;
        let X = del - se * cosc(ph) + rho * Math.cos(ph), Y = se * sinc(ph) + rho * Math.sin(ph);
        if (psi !== 0) { const X2 = X * cps - Y * sps; Y = X * sps + Y * cps; X = X2; }
        out[0] = x0 + X * ux + Y * vx + ox; out[1] = y0 + X * uy + Y * vy + oy; out[2] = xs * cosc(th);
        return out;
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// mobius (*x)
// ---------------------------------------------------------------------------------------------------------------

/**
 * The largest |sin| over the turns [alLo, alHi] of the band's segments: 1 if an upright one is among them, else
 * sin(|mid| + h) (mid: the middle of the range from the nearest multiple of pi, h: its half-width), the larger end.
 * eps > 0 (a flipping anchored tile) rounds |mid| to sqrt(mid^2 + eps^2): while the segment turns over fast, the
 * lowest corner passes from one end of the tile to the other without a kink in the lift (a jump of velocity of the
 * whole band); the band then rests at most eps x its half-width above the plane. eps = 0: exact, as in v1.
 */
function liftShare(alLo, alHi, eps) {
  if (Math.ceil((alLo - PI / 2) / PI - 1e-12) * PI + PI / 2 <= alHi + 1e-12) return 1;
  if (!(eps > 0)) return Math.max(Math.abs(Math.sin(alLo)), Math.abs(Math.sin(alHi)));
  const c = 0.5 * (alLo + alHi), mid = c - PI * Math.round(c / PI), h = 0.5 * (alHi - alLo);
  return Math.sin(Math.min(PI / 2, Math.sqrt(mid * mid + eps * eps) + h));
}

function mobiusFold(group, domain, mesh, opts) {
  const T = tuned('mobius', opts), side = T.side < 0 ? -1 : 1;
  const S = mirrorStrips(group), dx = S.dx, dy = S.dy;           // along the strip
  const nx = -side * dy, ny = side * dx;                         // across it: the seed's part of the ring ends up on this side
  const Tg = latticePeriod(group, dx, dy) / 2;                   // the glide's translation
  const wS = S.w;                                                // distance between neighbouring mirrors
  const m0 = side * S.m0;                                        // mirrors: n.x = m0 + k wS
  const stripOf = (x, y) => Math.floor((x * nx + y * ny - m0) / wS);
  // THE ANCHOR: v = j T along + (the strip offset) across, j rounded, so the tile slides along the ring by at most half
  // a turn; when tau_v is not in G (a glide or a mirror image of the anchor is nearest), the band's segment turns over
  // about its centre line in the first `flap` of the fold, in the sense that lifts the edge away from the anchor's strip
  // (for a neighbouring strip: a page turn over the mirror between them), while the tile crosses to the anchor's strip
  const p = domain.seedActual || domain.seed, an = anchorOf(opts && opts.anchor);
  let AN = null, kS = 0;
  if (an) {
    const sd = domain.seed || p;
    kS = stripOf(sd[0], sd[1]) - stripOf(an[0], an[1]);
    const j = Math.round(((p[0] - an[0]) * dx + (p[1] - an[1]) * dy) / Tg);
    const v = [j * Tg * dx + kS * wS * nx, j * Tg * dy + kS * wS * ny];
    AN = pullBy(an, p, v, !isLattice(group, v[0], v[1]));
  }
  // the strip that is rolled: the seed's (v1), or the anchor's, onto which the tile is pulled back
  const ref = AN ? an : domain.seed;
  const strip = stripOf(ref[0], ref[1]);
  const cAxis = m0 + (strip + 0.5) * wS;                         // the strip's centre line: a glide axis
  const st = AN ? AN.start : p, en = AN ? AN.end : p;
  const eS = st[0] * dx + st[1] * dy, eE = en[0] * dx + en[1] * dy;
  const sigF = clamp(Math.sqrt((T.ratio * wS * PI) / Tg), 1, T.maxStretch), R = (sigF * Tg) / TAU, hw = wS / (2 * sigF);
  const ktf = TAU / Tg, chi = T.twist < 0 ? -0.5 : 0.5;
  const fl = clamp(Number(T.flap) || 0.5, 0.05, 1), sgn = kS < 0 ? -1 : 1, flipEps = clamp(Number(T.flipEps) || 0, 0, 0.6);
  const foot = (e) => [cAxis * nx + e * dx, cAxis * ny + e * dy];
  const C = foot(eE);
  // the tile's extent along the strip (pulled back): the twist there decides how far the band must be lifted
  const vD = AN ? AN.v[0] * dx + AN.v[1] * dy : 0, vN = AN ? AN.v[0] * nx + AN.v[1] * ny : 0;
  const v0x = AN ? AN.v[0] : 0, v0y = AN ? AN.v[1] : 0;
  const extD = extent(mesh, dx, dy);
  // the colours (THE ANCHOR, *x): a tile an odd number of mirrors from the anchor's strip is the mirror image of a tile
  // of that strip, so at t = 1 it covers the band with every normal reversed: the app swaps the surface colours for it
  // (fold.mirrored), and the band keeps its colours when the cut is dragged across a mirror. A slide switch along the
  // strip (params.flip toggling with the strip fixed) changes nothing at t = 1 and needs no swap.
  const oddStrip = !!AN && kS % 2 !== 0;
  let swap = null;                                               // [lo, hi]: the times of the swap (mirroredAt)
  /** The swap of a tile whose segment turns over: where the segment at the centre of the roll (on the strip's centre
   *  line, carried back by v) is first seen edge-on from the default camera, else at the middle of the turn. */
  const turnWindow = (at) => {
    const h = 1e-4 * Math.sqrt(group.domainArea), o = [0, 0, 0], u = [0, 0, 0], q = [0, 0, 0];
    const facing = (t) => {
      const [fx, fy] = foot(eS + t * (eE - eS)), x = fx + v0x, y = fy + v0y, F = at(t);
      F(x, y, 0, o); F(x + h, y, 0, u); F(x, y + h, 0, q);
      const ax = u[0] - o[0], ay = u[1] - o[1], az = u[2] - o[2], bx = q[0] - o[0], by = q[1] - o[1], bz = q[2] - o[2];
      const n0 = ay * bz - az * by, n1 = az * bx - ax * bz, n2 = ax * by - ay * bx;
      return (n0 * VIEW0[0] + n1 * VIEW0[1] + n2 * VIEW0[2]) / (Math.hypot(n0, n1, n2) || 1);
    };
    return edgeOnWindow(facing, fl - SWAP_HALF, 0.5 * fl);
  };
  return {
    mesh, type: 'mobius', duration: T.duration, anchor: AN ? AN.anchor : null, anchorImage: AN ? AN.image : null, mirrored: oddStrip,
    stops: [{ t: 0, label: 'flat' }, { t: 1, label: 'Möbius band' }],
    params: { along: [dx, dy], across: [nx, ny], glide: Tg, width: wS, axis: cAxis, ringRadius: R, halfWidth: hw, stretch: sigF, twist: 2 * chi, flip: !!(AN && AN.flip), flap: fl, strips: kS, center: [C[0], C[1], hw] },
    schedule(t) { return schedule(T, t, { a: 0, w: 0 }); },
    /**
     * How far the surface colours are swapped at t (0: front is front; 1: swapped, as fold.mirrored asks for the closed
     * band), 0 throughout for a tile of the anchor's strip or an even number of strips away. A mirrored tile whose
     * segment turns over (params.flip) swaps while that segment, at the centre of the roll, is seen edge-on from the
     * default camera (turnWindow; 0.08 of t); one that only slides across to the anchor's strip (a translation of the
     * group carries it there, nothing turns over) fades with its slide over the whole `flap` (at most 1/60 per 1/200).
     * 1 from t = flap on either way, so a drag across a mirror changes nothing, colours included, once the turn is done.
     */
    mirroredAt(t) {
      if (!oddStrip) return 0;
      const u = t > 0 ? (t >= 1 ? 1 : t) : 0;
      if (!AN.flip) return smoother(u / fl);
      if (!swap) swap = turnWindow(at);
      return smoother((u - swap[0]) / (swap[1] - swap[0]));
    },
    at,
  };

  function at(t) {
    if (!(t > 0)) return identityMap;
    const w = t >= 1 ? 1 : t;
    const e0 = AN ? eS + w * (eE - eS) : eS, [bx, by] = foot(e0);  // foot of the centre on the centre line
    let ox = 0, oy = 0, beta = 0, eps = 0;
    if (AN) {
      // along: back with the slide; across: back over the first `flap`, with the flip
      const f = smoother(w / fl), x = w < fl ? w / fl : 1;
      ox = (1 - w) * vD * dx + (1 - f) * vN * nx; oy = (1 - w) * vD * dy + (1 - f) * vN * ny;
      // eps in step with the speed of the turn (16 x^2 (1 - x)^2 = (8 / 15) smootherstep'): nothing left once it is
      // done, so the tile then folds exactly as its neighbour across the mirror does
      if (AN.flip) { beta = sgn * PI * f; eps = flipEps * 16 * x * x * (1 - x) * (1 - x); }
    }
    const kt = w * ktf, sig = 1 + (sigF - 1) * w, del = 0.5 * sig * Tg * gsinc(PI * w), thin = 1 / sig;
    // the band's lowest corner stays on the plane: lift = half-width x the largest |sin| of the turn over the tile
    // (sin(pi w / 2) for a tile centred on the roll, as in v1; 1 once the twist spans a half turn, so at t = 1)
    const a1 = chi * kt * (extD[0] - vD - e0) + beta, a2 = chi * kt * (extD[1] - vD - e0) + beta;
    const lift = 0.5 * wS * thin * liftShare(Math.min(a1, a2), Math.max(a1, a2), eps);
    return (x, y, cell, out) => {
      let qx = x, qy = y;
      if (AN) { qx = x - v0x; qy = y - v0y; }
      const c = thin * (qx * nx + qy * ny - cAxis), eta = qx * dx + qy * dy - e0;
      const th = kt * eta, al = chi * th + beta, se = sig * eta;
      const q1 = c * Math.cos(al);
      const X = del - se * cosc(th) + q1 * Math.cos(th), Y = se * sinc(th) + q1 * Math.sin(th);
      out[0] = bx + X * nx + Y * dx + ox; out[1] = by + X * ny + Y * dy + oy; out[2] = lift + c * Math.sin(al);
      return out;
    };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// klein (xx)
// ---------------------------------------------------------------------------------------------------------------

const NS8 = 96;                      // samples of the 8 over one period, for its support (the lift)

function kleinFold(group, domain, mesh, opts) {
  const T = tuned('klein', opts), side = T.side < 0 ? -1 : 1;
  const gl = findRep(group, 'glide');
  const [ax, ay] = lineDir(gl.dir[0], gl.dir[1]);                // along the glide axes: the tube axis
  const sx = side * ay, sy = -side * ax;                         // across them: bent into the 8; the seed's part of the ring ends up on this side
  const A = Math.abs(gl.dist);                                   // the glide's translation
  const b = latticePeriod(group, sx, sy);                        // translation across the axes = length of the 8
  const sRef = gl.point[0] * sx + gl.point[1] * sy;              // glide axes: s = sRef + k b / 2
  // THE ANCHOR: v = k b across + m A along, both rounded, so the tile slides along the ring by at most half a turn.
  // m odd (tau_v is not in G: a glide image of the anchor is nearest): the 8 turns a further half turn about its
  // crossing with the ring, against the phase, so that the OTHER end holds (the glide's reflection, s -> -s, is the
  // half turn of the 8). Across, nothing slides: the 8's phase is the material's own (tau), so the centre stays on
  // the pulled-back seed and the shape travels across to the anchor rigidly, at constant speed.
  const p = domain.seedActual || domain.seed, an = anchorOf(opts && opts.anchor);
  let AN = null;
  if (an) {
    const k = Math.round(((p[0] - an[0]) * sx + (p[1] - an[1]) * sy) / b), m = Math.round(((p[0] - an[0]) * ax + (p[1] - an[1]) * ay) / A);
    const v = [k * b * sx + m * A * ax, k * b * sy + m * A * ay];
    AN = pullBy(an, p, v, !isLattice(group, v[0], v[1]));
  }
  const v0x = AN ? AN.v[0] : 0, v0y = AN ? AN.v[1] : 0;
  const scale = b / TAU, ks = TAU / b;
  const reach0 = scale * figure8(J01).reach;                     // half-length of the closed 8 before the ring stage thins it
  const sigF = clamp(Math.sqrt((T.ratio * reach0 * TAU) / A), 1, T.maxStretch), R = (sigF * A) / TAU, reach1 = reach0 / sigF;
  const ktf = TAU / A, chi = T.twist < 0 ? -0.5 : 0.5;
  const phase = PI * (Number(T.phase) || 0);
  const rhoF = (PI / 2) * (Number(T.flat) || 0), flatA = clamp(Number(T.flatFrom) || 0, 0, 0.98), flatB = clamp(Number(T.flatTo) || 1, flatA + 0.01, 1);   // times
  const spinF = (PI / 2) * (Number(T.spin) || 0), spinEase = clamp(Number(T.spinEase) || 0, 0, 0.9);
  // the centre: across, fixed on the pulled-back seed; along, from it to the anchor with the ring (THE ANCHOR)
  const st = AN ? AN.start : p;
  const ss = st[0] * sx + st[1] * sy, sa = st[0] * ax + st[1] * ay;
  const dA = AN ? AN.end[0] * ax + AN.end[1] * ay - sa : 0;
  const vS = AN ? AN.v[0] * sx + AN.v[1] * sy : 0, vA = AN ? AN.v[0] * ax + AN.v[1] * ay : 0;
  const travelS = AN ? (an[0] - p[0]) * sx + (an[1] - p[1]) * sy : 0;
  const flipSign = phase > 0 ? -1 : 1;                           // the extra half turn goes against the phase
  const flipEps = clamp(Number(T.flipEps) || 0, 0, 0.6);
  // the pulled-back tile's extent across and along the axes (for the lift)
  const extS = extent(mesh, sx, sy), extA = extent(mesh, ax, ay);
  extS[0] -= vS; extS[1] -= vS; extA[0] -= vA; extA[1] -= vA;
  const sch = { a: 0, w: 0 }, ws = new Float64Array(2 * NS8);

  /**
   * How high the tube must be lifted so that no cross-section dips below the plane: the 8's support in the downward
   * direction, max over the turns `al` present along the tube (an interval), plus what the drift (s J0, the open
   * wave) can add. Exact (the lobe's half-length) when the 8 is closed and the turns include an upright one.
   * eps > 0 (an anchored tile that turns its 8 a further half turn): the support is even and pi-periodic in al and
   * falls from upright to flat (dev/roll5/support-check.mjs), so its max over the range is its value at the turn
   * nearest upright, u - h from it (u: the middle's distance from upright, h: the half-width); u is rounded where it
   * peaks (the middle passing a flat 8, where the nearest end changes) to pi/2 - sqrt((pi/2 - u)^2 + eps^2): never
   * more than u, so never too low, and the lift has no kink there while the 8 turns fast.
   */
  const liftFor = (F, Cs, n8, j0, alLo, alHi, dsMax, reachNow, eps = 0) => {
    let best = -Infinity;
    const support = (al) => {
      const sn = Math.sin(al), cs = Math.cos(al);
      if (Math.abs(sn) < 1e-15) return reachNow;               // upright (or upside down): the crest, exactly
      let m = -Infinity, km = 0;
      for (let k = 0; k < NS8; k++) { const v = -(ws[2 * k] * sn + ws[2 * k + 1] * cs); if (v > m) { m = v; km = k; } }
      // a parabola through the best sample and its neighbours, then the wave at its top
      const at = (tau) => {
        let wx = 0, wy = 0;
        for (let n = 1; n <= n8; n++) { const v = Cs[n] * Math.sin(n * tau); if (n & 1) wy += v; else wx += v; }
        return -(wx * sn + wy * cs);
      };
      const h = TAU / NS8, f0 = at((km - 1) * h), f2 = at((km + 1) * h), den = f0 - 2 * m + f2;
      if (den < 0) { const off = (0.5 * (f0 - f2)) / den; if (Math.abs(off) < 1) m = Math.max(m, at((km + off) * h)); }
      return m;
    };
    if (eps > 0) {
      const c = 0.5 * (alLo + alHi), h = 0.5 * (alHi - alLo), u = Math.abs(c - PI * Math.round(c / PI)), r = PI / 2 - u;
      best = support(Math.max(0, PI / 2 - Math.sqrt(r * r + eps * eps) - h));
    } else {
      for (let k = Math.ceil(alLo / PI - 1e-12); k * PI <= alHi + 1e-12; k++) best = Math.max(best, reachNow);
      if (best < reachNow) {
        const nA = Math.min(24, 1 + Math.ceil((alHi - alLo) / (PI / 24)));
        for (let i = 0; i <= nA; i++) best = Math.max(best, support(alLo + ((alHi - alLo) * i) / nA));
      }
    }
    let sMax = 0;
    if (dsMax > 0 && j0 !== 0) {
      for (let i = 0; i <= 8; i++) sMax = Math.max(sMax, Math.abs(Math.sin(alLo + ((alHi - alLo) * i) / 8)));
      if (Math.ceil((alLo - PI / 2) / PI - 1e-12) * PI + PI / 2 <= alHi + 1e-12) sMax = 1;
    }
    return best + dsMax * Math.abs(j0) * sMax;
  };

  /** The map at time t (stage parameters a, w), centred on (x0, y0), moved by (ox, oy) at the end; beta: the extra turn
   *  (eps: the rounding of the lift while it turns, see liftFor). */
  const mapFor = (t, a, w, x0, y0, ox, oy, beta, eps = 0) => {
    const F = figure8(a >= 1 ? J01 : a * J01);
    const kt = w * ktf, sig = 1 + (sigF - 1) * w, del = 0.5 * sig * A * gsinc(PI * w), thin = 1 / sig, ph = phase * w + beta;
    const xf = (t - flatA) / (flatB - flatA);
    const rho = rhoF * (xf <= 0 ? 0 : xf >= 1 ? 1 : 0.5 - 0.5 * Math.cos(PI * xf));
    const n8 = F.n, j0 = thin * F.j0, reachNow = thin * scale * F.reach;
    const C = new Float64Array(n8 + 1);
    for (let k = 1; k <= n8; k++) C[k] = thin * scale * F.c[k];
    const s0 = x0 * sx + y0 * sy - sRef;
    // the lift: a crest stays on the plane (v1: the 8 upright all along); with the 8 turned, its support
    let lift = reachNow;
    if (rho !== 0 || ph !== 0) {
      for (let k = 0; k < NS8; k++) {
        const tau = (TAU * k) / NS8;
        let wx = 0, wy = 0;
        for (let n = 1; n <= n8; n++) { const v = C[n] * Math.sin(n * tau); if (n & 1) wy += v; else wx += v; }
        ws[2 * k] = wx; ws[2 * k + 1] = wy;
      }
      const c0a = x0 * ax + y0 * ay, c0s = x0 * sx + y0 * sy;
      const t1 = rho + ph + chi * kt * (extA[0] - c0a), t2 = rho + ph + chi * kt * (extA[1] - c0a);
      const dsMax = Math.max(Math.abs(extS[0] - c0s), Math.abs(extS[1] - c0s));
      lift = liftFor(F, C, n8, j0, Math.min(t1, t2), Math.max(t1, t2), dsMax, reachNow, eps);
    }
    const psi = spinF * (spinEase > 0 ? easeIn(w, spinEase) : w), cps = Math.cos(psi), sps = Math.sin(psi);
    return (x, y, cell, out) => {
      let qx = x, qy = y;
      if (AN) { qx = x - v0x; qy = y - v0y; }
      const px = qx - x0, py = qy - y0;
      const xi = px * ax + py * ay, ds = px * sx + py * sy;       // along the tube; across, from the centre
      const tau = ks * (ds + s0);
      // the wave: (sum over even n, sum over odd n) of C[n] sin(n tau), by the three-term recurrence
      const s1 = Math.sin(tau), c2 = 2 * Math.cos(tau);
      let sm = 0, sn = s1, q1 = ds * j0, q2 = 0;
      for (let k = 1; k <= n8; k++) {
        if (k & 1) q2 += C[k] * sn; else q1 += C[k] * sn;
        const nx = c2 * sn - sm; sm = sn; sn = nx;
      }
      // the ring, the cross-section turned by half the ring angle about its centre (and by rho, phase: see TUNE)
      const th = kt * xi, al = rho + chi * th + ph, ca = Math.cos(al), sa = Math.sin(al), se = sig * xi;
      const r1 = q1 * ca - q2 * sa, r2 = q1 * sa + q2 * ca;
      let X = del - se * cosc(th) + r1 * Math.cos(th), Y = se * sinc(th) + r1 * Math.sin(th);
      if (psi !== 0) { const X2 = X * cps - Y * sps; Y = X * sps + Y * cps; X = X2; }
      out[0] = x0 + X * sx + Y * ax + ox; out[1] = y0 + X * sy + Y * ay + oy; out[2] = lift + r2;
      return out;
    };
  };

  // the two classes of glide axes inside the tile: at the end both lie on the double circle
  let axisLines = null;
  const findAxisLines = () => {
    const size = domain.size || Math.sqrt(group.domainArea), warp = domain.warp, tmp = [0, 0];
    const inside = (x, y) => { warp.inv(x, y, tmp); return domain.contains(tmp[0], tmp[1], 1e-9); };
    const lines = [];
    const x0 = p[0], y0 = p[1], s0 = x0 * sx + y0 * sy - sRef;
    const k0 = Math.round(s0 / (b / 2)), reach = A + b, N = Math.ceil((2 * reach * 48) / size);
    for (let k = k0 - 2; k <= k0 + 2; k++) {
      const off = (k * b) / 2 - s0;                               // the axis s = sRef + k b / 2, measured from the seed
      const px = (xi) => x0 + xi * ax + off * sx, py = (xi) => y0 + xi * ay + off * sy;
      const edge = (xiIn, xiOut) => {                            // where the axis leaves the tile, by bisection
        for (let it = 0; it < 30; it++) { const m = (xiIn + xiOut) / 2; if (inside(px(m), py(m))) xiIn = m; else xiOut = m; }
        return xiIn;
      };
      let run = [], prevIn = false, prevXi = -reach;
      for (let i = 0; i <= N + 1; i++) {
        const xi = -reach + (2 * reach * i) / N, isIn = i <= N && inside(px(xi), py(xi));
        if (isIn && !prevIn && i > 0) { const e = edge(xi, prevXi); run.push(px(e), py(e)); }
        if (isIn) run.push(px(xi), py(xi));
        if (!isIn && prevIn) {
          const e = edge(prevXi, xi); run.push(px(e), py(e));
          if (run.length >= 4) lines.push(Float64Array.from(run));
          run = [];
        }
        prevIn = isIn; prevXi = xi;
      }
    }
    return lines;
  };

  const Cn = AN ? AN.end : p;
  return {
    mesh, type: 'klein', duration: T.duration, anchor: AN ? AN.anchor : null, anchorImage: AN ? AN.image : null,
    stops: [{ t: 0, label: 'flat' }, { t: T.t1, label: 'figure-8 tube' }, { t: 1, label: 'Klein bottle' }],
    params: { axis: [ax, ay], across: [sx, sy], glide: A, period: b, reach: reach1, ringRadius: R, stretch: sigF, twist: 2 * chi, flat: rhoF, flatTimes: [flatA, flatB], spin: spinF, flip: !!(AN && AN.flip), center: [Cn[0], Cn[1], reach1] },
    schedule(t) { return schedule(T, t, { a: 0, w: 0 }); },
    at(t) {
      if (!(t > 0)) return identityMap;
      const { a, w } = schedule(T, t, sch);
      const tt = t >= 1 ? 1 : t;
      if (!AN) return mapFor(tt, a, w, p[0], p[1], 0, 0, 0);
      const ca = sa + w * dA, os = vS + tt * travelS, oa = (1 - w) * vA;
      const beta = AN.flip ? flipSign * PI * w : 0, eps = AN.flip ? flipEps * Math.sin(0.5 * PI * w) : 0;
      return mapFor(tt, a, w, ss * sx + ca * ax, ss * sy + ca * ay, os * sx + oa * ax, os * sy + oa * ay, beta, eps);
    },
    /** The glide-axis lines of the tile at time t (3D polylines): the double circle of the bottle once the 8 is closed. */
    doubleLine(t) {
      if (!axisLines) axisLines = findAxisLines();
      const F = this.at(t), o = [0, 0, 0];
      return axisLines.map((ln) => {
        const pts = new Float32Array((ln.length / 2) * 3);
        for (let i = 0, j = 0; i < ln.length; i += 2, j += 3) { F(ln[i], ln[i + 1], 0, o); pts[j] = o[0]; pts[j + 1] = o[1]; pts[j + 2] = o[2]; }
        return pts;
      });
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------

const MAKERS = { torus: torusFold, cylinder: cylinderFold, mobius: mobiusFold, klein: kleinFold };

export default function createFold(group, domain, mesh, opts = {}) {
  const make = MAKERS[group.fold];
  if (!make) throw new Error(`roll fold: unknown fold type "${group.fold}" (group ${group.id})`);
  return make(group, domain, fineMesh(group, domain, mesh, opts), opts);
}
