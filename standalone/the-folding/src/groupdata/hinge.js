// groupdata/hinge.js — the eight groups that are index-2 subgroups of a kaleidoscope.
// Their orbifold is two copies (front/back) of the kaleidoscope cell T, glued along the sides of T that are
// NOT mirrors of the group and open along the sides that are. Fold type 'hinge': fold the tile flat along the
// kaleidoscope's mirror lines (rigid hinges), then puff it open.  OWNER: the hinge-fold agent may tune
// lattice sizes, presets and text here; keep ids, reps conventions and the kaleido cells consistent (test/groups.test.js).
//
// How the presets were chosen (src/folds/hinge.js folds every piece onto the kaleidoscope cell that holds the seed,
// and with an anchor, SPEC 7, closes the shape over the anchor's cell):
//   * presets[0] is a tile of two cells with one crease, a sheet folded in half (2222 excepted: its default is the
//     envelope, four flaps over the cell).
//   * The closed shapes of all presets of a group sit on ONE cell (the "shared cell"), so choosing another cut while
//     the shape is folded leaves the shape where it is and only moves the seams. The app hands every fold
//     opts.anchor = preset.anchor ?? preset.seed (contract C3, SPEC 8).
//   * A preset whose seed lies ON a crease is a cut symmetric in that crease; the fixed cell of such a seed is the one
//     on the +(0.37, 0.93) side of the crease (the nudge of mesh.js). Where that is not the shared cell (4*2 Diamond,
//     3*3 Kite, 632 Kite) the preset carries an explicit `anchor`, the centroid of the shared cell: the tile is the
//     shared cell and its reflection in the crease, the shared cell stays flat throughout the fold and the other half
//     folds over onto it. test/hinge.test.js checks all of this.
//   * In the four groups with a mirror rim (22*, 2*22, 4*2, 3*3) the shared cell has its mirror side toward the
//     default camera (which looks from -y, 55 degrees up), so the mouth of the folded shape opens toward the viewer.
//   * Every name is true of its straight tile (round 3, findings 16-18): `node dev/hinge3-shapes.mjs` lists them.

import { IDENT, rot, refl, glide, compose } from '../geom.js';
import { cyclic, kRect, k442, k442small, k632, k333, S3 } from '../kaleido.js';

const PI = Math.PI;
const R4 = cyclic(4);
const R3 = cyclic(3);
const Md = refl(0.25, 0.25, (3 * PI) / 4); // the mirror x + y = 1/2 of p4g
const M0 = refl(0, 0, 0);

export default [
  {
    id: '2222', label: '2222', hm: 'p2',
    shape: 'pillow', topology: 'sphere with four cone points of order 2',
    e1: [1.3, 0], e2: [0, 1.0],
    reps: [{ ...IDENT }, rot(PI)],
    fold: 'hinge', kaleido: kRect(1.3, 1.0),
    viewHalf: 1.25,
    presets: [
      { name: 'Envelope', seed: [0.325, 0.25] },
      { name: 'Book', seed: [0.325, 0] },
      { name: 'Hexagon', seed: [0.2, 0.33] },
    ],
  },
  {
    id: '22*', label: '22∗', hm: 'pmg',
    shape: 'pillowcase', topology: 'disc with two cone points of order 2; its rim is a mirror',
    e1: [1.3, 0], e2: [0, 1.6],
    // half-turn at the origin, mirror y = 0.4, glide along x = 0
    reps: [{ ...IDENT }, rot(PI), refl(0, 0.4, 0), glide(0, 0, PI / 2, 0.8)],
    fold: 'hinge', kaleido: kRect(1.3, 0.8),
    viewHalf: 1.35,
    // every seed lies in the cell [0.65, 1.3] x [0.4, 0.8], whose mirror side is the NEAR one (y = 0.4): the mouth
    // of the folded pillowcase faces the default camera. Pentagon: a mirror side, two sides glued by the translation
    // and two half-turn sides (three seams), every side at least a third of the tile size
    presets: [
      { name: 'Pillowcase', seed: [0.65, 0.6] },
      { name: 'Trapezoid', seed: [0.975, 0.6] },
      { name: 'Pentagon', seed: [0.74, 0.49] },
    ],
  },
  {
    id: '2*22', label: '2∗22', hm: 'cmm',
    shape: 'corner pocket', topology: 'disc with a cone point of order 2 and two mirror corners of order 2',
    e1: [0.8, 0.6], e2: [-0.8, 0.6], // centred rectangular cell 1.6 x 1.2
    reps: [{ ...IDENT }, rot(PI), refl(0, 0, PI / 2), refl(0, 0, 0)],
    fold: 'hinge', kaleido: kRect(0.8, 0.6),
    viewHalf: 1.2, center: [0.4, 0.3],   // the window is centred on the cone point of the default tile
    // every seed lies in the cell [0.4, 0.8] x [0, 0.3], whose open corner (0.8, 0) is the near right one
    presets: [
      { name: 'Pocket', seed: [0.4, 0.15] },
      { name: 'Quad', seed: [0.6, 0.15] },
      { name: 'Tall', seed: [0.72, 0.2] },
    ],
  },
  {
    id: '442', label: '442', hm: 'p4',
    shape: 'triangular pillow', topology: 'sphere with cone points of order 4, 4, 2',
    e1: [1, 0], e2: [0, 1],
    reps: R4,
    fold: 'hinge', kaleido: k442(),
    viewHalf: 1.1, center: [0.25, 0.5],
    // every seed lies in the cell (0,0) (0,1/2) (1/2,1/2)
    presets: [
      { name: 'Square', seed: [0.25, 0.25] },
      { name: 'Triangle', seed: [0, 0.25] },
      { name: 'Pentagon', seed: [0.12, 0.3] },
    ],
  },
  {
    id: '4*2', label: '4∗2', hm: 'p4g',
    shape: 'cone pouch', topology: 'disc with a cone point of order 4 and a mirror corner of order 2',
    e1: [1, 0], e2: [0, 1],
    reps: R4.concat(R4.map((r) => compose(Md, r))),
    fold: 'hinge', kaleido: k442small(),
    viewHalf: 1.1,
    // the shared cell (1/2,1/2) (0,1/2) (1/4,1/4), next to the 4-fold centre (1/2, 1/2): its mirror side faces the
    // default camera (down-left). A seed inside it gives a quadrilateral with right angles at the cone point and at
    // the mirror corner, which is a kite only when it is the square (round 3, finding 16): hence "Quad". A seed on its
    // side x = y gives the Triangle, one on its side y = 1/2 the square Diamond: the shared cell and its reflection in
    // that crease (explicit anchor, see the top).
    presets: [
      { name: 'Triangle', seed: [0.35, 0.35] },
      { name: 'Quad', seed: [0.24, 0.41] },
      { name: 'Diamond', seed: [0.25, 0.5], anchor: [0.25, 5 / 12] },
    ],
  },
  {
    id: '333', label: '333', hm: 'p3',
    shape: 'triangular pillow', topology: 'sphere with three cone points of order 3',
    e1: [1, 0], e2: [0.5, S3 / 2],
    reps: R3,
    fold: 'hinge', kaleido: k333(),
    viewHalf: 1.1,
    // every seed lies in the cell (1,0) (1/2,-sqrt3/6) (1/2,sqrt3/6)
    presets: [
      { name: 'Rhombus', seed: [0.5, 0] },
      { name: 'In between', seed: [0.58, 0.06] },
      { name: 'Hexagon', seed: [2 / 3, 0] },
    ],
  },
  {
    id: '3*3', label: '3∗3', hm: 'p31m',
    shape: 'cone pouch', topology: 'disc with a cone point of order 3 and a mirror corner of order 3',
    e1: [1, 0], e2: [0.5, S3 / 2],
    reps: R3.concat(R3.map((r) => compose(M0, r))),
    fold: 'hinge', kaleido: k632(),
    viewHalf: 1.1,
    // the shared cell (1,0) (1/2,0) (1/2,sqrt3/6), whose mirror side is y = 0, the near one. Kite: the seed on the
    // cell's hypotenuse (as 632's Kite): the shared cell and its reflection in that crease (explicit anchor, see the top)
    presets: [
      { name: 'Triangle', seed: [0.5, 0.1] },
      { name: 'Kite', seed: [0.75, 0.25 / S3], anchor: [2 / 3, S3 / 18] },
    ],
  },
  {
    id: '632', label: '632', hm: 'p6',
    shape: 'triangular pillow', topology: 'sphere with cone points of order 6, 3, 2',
    e1: [1, 0], e2: [0.5, S3 / 2],
    reps: cyclic(6),
    fold: 'hinge', kaleido: k632(),
    viewHalf: 1.1,
    // the shared cell (1,0) (1/2,0) (1/2,sqrt3/6). Kite: the seed on its hypotenuse, the shared cell and its
    // reflection in that crease (explicit anchor, see the top)
    presets: [
      { name: 'Triangle', seed: [0.5, 0.15] },
      { name: 'Equilateral', seed: [0.7, 0] },
      { name: 'Kite', seed: [0.75, 0.25 / S3], anchor: [2 / 3, S3 / 18] },
      { name: 'Pentagon', seed: [0.67, 0.08] },
    ],
  },
];
