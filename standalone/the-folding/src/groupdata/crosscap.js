// groupdata/crosscap.js — 22x (pgg): the projective plane with two cone points of order 2.
// Its half-turn subgroup p2 is an index-2 subgroup of the kaleidoscope kRect(a, b) below, whose doubled cell is
// the pillow; the two glides act on that pillow as the antipodal map. Fold type 'crosscap': fold the tile onto half
// of the pillow (hinge + puff), then zip the pillow's antipodal points together (a cross-cap).
// OWNER: the cross-cap agent may tune sizes, presets and text here.
//
// The lattice: the kaleidoscope cell is a/2 x b/2 = 0.65 x 0.9, and the default tile folds once into a pocket
// 0.65 wide and 0.45 deep, so the closed shape is about as long as it is wide (with the first lattice, 1.5 x 1.2,
// it was a fan 0.75 wide and 0.3 deep).
//
// How the presets were chosen (src/folds/crosscap.js keeps the kaleidoscope cell that holds the seed where it is;
// a seed ON a horizontal crease, or a little behind it, takes the cell on the near side of the crease):
//   * All three seeds lie in (or on the far side of) the cell [0, a/2] x [0, b/2], so choosing another cut while
//     the shape is closed leaves the shape where it is and only moves the seams.
//   * "Pocket", the default: the seed is the middle of that cell's FAR side. The tile is the rectangle
//     [0, a/2] x [b/4, 3b/4] with the two cone points in the middles of its short sides; it folds once, along the
//     line through them, into the far half of the pillow: a pocket whose open mouth faces the default camera
//     (which looks from -y). Closing that mouth is all that is left for the second stage, and nothing has to pass
//     through anything before the rim meets itself.
//   * "Bowl": the seed is the centre of the cell, the tile is the cell itself (cone points at its four corners,
//     no crease at all) and puffs into the lower half of the pillow. The four corners are two cone points, glued in
//     pairs by the glides: in stage 2 the far two stay put and the near two are carried onto them (crosscap.js,
//     design 'acts'). (Round 2 tried the seed b/100 further back: two cone points only, the far corners, like the
//     Pocket's and the Hexagon's; kept at the centre because test/hinge.test.js needs this one-piece tile and
//     test/motif.test.js samples around it: notes/crosscap-round2.md.) "Hexagon" is a generic cut.
//   * With an anchor (SPEC 7: the app passes the preset's seed) all three sit on that cell too (crosscap.js,
//     anchorCell), and a drag of the cut only slides the seams over the closed shape.

import { IDENT, rot, glide } from '../geom.js';
import { kRect } from '../kaleido.js';

const PI = Math.PI;
const a = 1.3, b = 1.8;

export default [
  {
    id: '22x', label: '22×', hm: 'pgg',
    shape: 'cross-cap', topology: 'projective plane with two cone points of order 2',
    e1: [a, 0], e2: [0, b],
    // half-turn at the origin; glide along y = b/4 by a/2; glide along x = a/4 by b/2
    reps: [{ ...IDENT }, rot(PI), glide(0, b / 4, 0, a / 2), glide(a / 4, 0, PI / 2, b / 2)],
    fold: 'crosscap',
    kaleido: kRect(a, b),          // contains the half-turn subgroup with index 2 (NOT the glides)
    warpGroup: kRect(a / 2, b / 2), // smallest kaleidoscope containing both pgg and kRect(a, b)
    viewHalf: 1.35,
    presets: [
      { name: 'Pocket', seed: [a / 4, b / 2] },
      { name: 'Bowl', seed: [a / 4, b / 4] },
      { name: 'Hexagon', seed: [0.3 * a, 0.36 * b] },
    ],
  },
];
