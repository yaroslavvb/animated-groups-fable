// groupdata/roll.js — the four groups whose tile is rolled, bent or twisted shut rather than folded flat:
// o (torus), ** (annulus, shown as a tube), *x (Moebius band), xx (Klein bottle, figure-8 immersion).
// OWNER: the roll-fold agent. The lattice sizes set the 3D proportions; the orientation of each group in the plane
// sets what the default 3D view (from the -y side, 55 degrees up) shows.
//
// src/folds/roll.js reads every direction, period and axis from e1, e2 and reps, so nothing below is a convention it
// relies on — but the choices are deliberate (2026-11-09, after looking at both orientations of each group; ** turned
// on 10 Nov, round 4):
//   * o and xx: the tube that is rolled first points AT the viewer (its axis is the y direction), so one looks into it
//     and sees its cross-section: the circle of the torus, the figure 8 of the Klein bottle (which lies flat while it
//     closes, two scrolls side by side: src/folds/roll.js, TUNE.klein.flat).
//       o   e1 along x: the tile is rolled along x; the ring closes at the far left.
//       xx  glide axes are the vertical lines x = k b / 2: (x, y) -> (-x, y + A); the translation (b, 0) is bent into the
//           8; the ring turns an eighth of a turn while it closes (TUNE.klein.spin), so its seam closes at the front
//           left, 45 degrees from the front (round-4 verification, finding 2).
//   * ** lies ACROSS the view: mirrors are the vertical lines x = k w, the translation (0, b) rolls the strip along y,
//     so the tube's axis runs left to right and the finished tube is seen from the side, with the comma on its front
//     (round-3 finding 44: with the axis pointing away, the near rim drew 1.25 times the far one, a lampshade).
//   * The Moebius band's strip is horizontal (mirrors y = k w, glide (x, y) -> (x + T, w - y) and its translates): its
//     two ends curl toward the viewer and the seam closes in front.
//   * Proportions. R = radius of the ring; the ring stage makes the shape longer by sigma and thinner by sigma (area
//     kept), sigma = sqrt(wanted ratio / the lattice's own ratio); the wanted ratios are in TUNE in src/folds/roll.js.
//       o   tube radius L / 2 pi, ring length h2:                        R = 2.6 tube radii with sigma = 1.10
//       **  radius b / 2 pi, length w:                                   1.6 diameters long, isometric
//       *x  half-width w / 2, ring length T:                             R = 1.5 half-widths with sigma = 1.53
//           (the owner's comment of 13 Nov 2026, "*x visualizaiton is too narrow, I want the segment to be more balanced
//           between x repeats and y repeats": the tile is T x w = 1.2 x 0.6, 2 : 1 as **'s, no longer 1.6 x 0.3; the
//           plane shows about 2 tiles across and 4 up. A band from a strip this wide needs the stretch to keep R above
//           its half-width: the lattice alone gives R = 0.64 half-widths)
//       xx  the 8 has length b (half-length 0.187 b), ring length A:     R = 2.1 half-lengths with sigma = 1.14
//   * Every preset's seed is also its anchor (SPEC 7, 8 C3): presets with one seed (o, the two of *x: the anchor's foot
//     on the strip's centre line is the same) close onto the same shape, so choosing another cut while folded only
//     moves the seams. The placement table of the comma (src/groupdata/motif.js, tools/motif-place.mjs) is computed
//     from these data and preset 0: regenerate it after any change here.
//   * Captions (`topology`) say what the chip does not: the cone points and mirrors, as the other groups' do.

import { IDENT, iso } from '../geom.js';

/** Quadratic form [q11,q12,q22] in which the vectors u and v are orthonormal: Q = B^-T B^-1, B = [u v]. */
export function metricFromBasis(u, v, gram = [1, 0, 1]) {
  const det = u[0] * v[1] - u[1] * v[0];
  // rows of B^-1
  const r0 = [v[1] / det, -v[0] / det], r1 = [-u[1] / det, u[0] / det];
  const [g11, g12, g22] = gram; // Q = B^-T G B^-1
  const q = (i, j) => {
    const ri = [r0[i], r1[i]], rj = [r0[j], r1[j]];
    return ri[0] * (g11 * rj[0] + g12 * rj[1]) + ri[1] * (g12 * rj[0] + g22 * rj[1]);
  };
  return [q(0, 0), q(0, 1), q(1, 1)];
}

// o: e1 = (L, 0), e2 = (s, h2)
const oE1 = [0.72, 0], oE2 = [0.2, 1.56];
const oSeed = [(oE1[0] + oE2[0]) / 2, (oE1[1] + oE2[1]) / 2];

// **: mirrors x = k w, translation (0, b) along them
const ssB = 1.2, ssW = 0.6;

// *x: strip of width w between the mirrors y = k w; glide translation T along x
const sxT = 1.2, sxW = 0.6;

// xx: glide (x, y) -> (-x, y + A); translation (b, 0) across the glide axes
const xxB = 0.9, xxA = 1.7;

export default [
  {
    id: 'o', label: '○', hm: 'p1',
    shape: 'torus', topology: 'torus; no cone points, no mirrors',
    e1: oE1, e2: oE2,
    reps: [{ ...IDENT }],
    fold: 'torus', kaleido: null,
    viewHalf: 1.35,
    presets: [
      // A translation-only group has one Dirichlet shape per metric, so the cuts differ by the metric:
      { name: 'Parallelogram', seed: [...oSeed], metric: metricFromBasis(oE1, oE2) },
      { name: 'Slanted', seed: [...oSeed], metric: metricFromBasis(oE1, [oE1[0] + oE2[0], oE1[1] + oE2[1]]) },
      { name: 'Hexagon', seed: [...oSeed], metric: metricFromBasis(oE1, oE2, [1, 0.5, 1]) },
    ],
  },
  {
    id: '**', label: '∗∗', hm: 'pm',
    shape: 'tube', topology: 'annulus; both rims are mirrors',
    e1: [2 * ssW, 0], e2: [0, ssB],
    reps: [{ ...IDENT }, iso(-1, 0, 0, 1, 0, 0)],            // the mirror x = 0
    fold: 'cylinder', kaleido: null,
    viewHalf: 1.05, center: [ssW / 2, ssB / 2],
    presets: [
      { name: 'Strip', seed: [ssW / 2, ssB / 2] },
    ],
  },
  {
    id: 'xx', label: '××', hm: 'pg',
    shape: 'Klein bottle', topology: 'Klein bottle; non-orientable, no cone points, no mirrors',
    e1: [xxB, 0], e2: [0, 2 * xxA],
    reps: [{ ...IDENT }, iso(-1, 0, 0, 1, 0, xxA)],          // the glide (x, y) -> (-x, y + A)
    fold: 'klein', kaleido: null,
    viewHalf: 1.35, center: [xxB / 8, xxA / 2],
    presets: [
      { name: 'Rectangle', seed: [0, xxA / 2] },          // seed on a glide axis
      { name: 'Hexagon', seed: [xxB / 4, xxA / 2] },      // seed midway between two glide axes
    ],
  },
  {
    id: '*x', label: '∗×', hm: 'cm',
    shape: 'Möbius band', topology: 'Möbius band; non-orientable, its rim is a mirror',
    // centred cell 2T x 2w: mirrors y = k w, glide axes y = w / 2 + k w
    e1: [sxT, -sxW], e2: [sxT, sxW],
    reps: [{ ...IDENT }, iso(1, 0, 0, -1, 0, 0)],            // the mirror y = 0
    fold: 'mobius', kaleido: null,
    viewHalf: 1.15, center: [sxT / 2, sxW / 2],
    presets: [
      { name: 'Strip', seed: [sxT / 2, sxW / 2] },        // seed on the glide axis: a rectangle
      // seed half way to the mirror, distances measured with q22 / q11 = 1.5 T / w (diagonal: invariant under the point
      // group, so the cut stays a fundamental domain): an isosceles trapezoid whose glued sides lean 37 degrees,
      // tan = q22 w / 2 T = 0.75 (finding 45: with the plain metric the glued sides lean little; from this seed 14
      // degrees, 5 on the thin strip before 13 Nov)
      { name: 'Trapezoid', seed: [sxT / 2, sxW / 4], metric: [1, 0, (1.5 * sxT) / sxW] },
    ],
  },
];
