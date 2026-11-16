// groupdata/kaleido.js — the four kaleidoscopes. Every side of the tile is a mirror, so there is nothing to cut
// and nothing to glue: the orbifold IS the flat tile, a disk (∗, a punched sphere) with a corner point at each corner.
// Fold type 'disc' (src/folds/disc.js, 15 Nov 2026): nothing folds. The copies of the tile round it are the tiling's:
// the journey's tiling half makes them, each turned over its mirror line, and folds them back (src/journey.js).
// (Until 15 Nov the fold type was 'snowflake': the star of tiles round one corner folded onto the tile. The owner:
// "Normally, the folded part is just the surface, but here there is a bit of confusion about which part lies in the
// folding and which part lies in the tiling.")
//
// What the two optional fields are for:
//   center   the centre of the plane view's window. It is put ON the corner of the kaleidoscope cell with the largest
//            order: the tiles round that corner fill the middle of the window.
//   seed     the seed of the one preset = which cell round that corner is the tile.

import { kRect, k442, k333, k632, S3 } from '../kaleido.js';

function fromKaleido(k, extra) {
  const c = k.cell;
  const seed = extra.seed || [c.reduce((s, p) => s + p[0], 0) / c.length, c.reduce((s, p) => s + p[1], 0) / c.length];
  return { ...extra, e1: k.e1, e2: k.e2, reps: k.reps, fold: 'disc', kaleido: k, presets: [{ name: 'The only tile', seed }] };
}

export default [
  // star = the lattice cell [0, 1.3] x [0, 1] around its centre (0.65, 0.5); tile = its front left quarter.
  // Folds: top half down toward the viewer, then the right half over to the left.
  fromKaleido(kRect(1.3, 1.0), {
    id: '*2222', label: '∗2222',
    shape: 'rectangle', surface: 'disk', topology: 'a punched sphere; its rim is a mirror with four corners of order 2', viewHalf: 1.25,
  }),
  // star = the unit square around its centre (0.5, 0.5), eight triangles; tile = (1/2,1/2), (0,1/2), (0,0).
  // Folds: half (top down), quarter (right over left), then the diagonal — the way a square napkin is folded.
  fromKaleido(k442(), {
    id: '*442', label: '∗442',
    shape: '45-45-90 triangle', surface: 'disk', topology: 'a punched sphere; its rim is a mirror with corners of order 4, 4, 2', viewHalf: 1.1,
    seed: [1 / 6, 1 / 3],
  }),
  // star = the hexagon of six triangles around the 3-fold centre (1/2, sqrt3/6); tile = the kaleidoscope cell itself.
  // Folds: hexagon -> trapezoid -> rhombus -> triangle.
  fromKaleido(k333(), {
    id: '*333', label: '∗333',
    shape: 'equilateral triangle', surface: 'disk', topology: 'a punched sphere; its rim is a mirror with three corners of order 3', viewHalf: 1.1,
    center: [0.5, S3 / 6],
  }),
  // star = the hexagon of twelve triangles around the 6-fold centre (0, 0); tile = (0,0), (-1/2,-sqrt3/6), (-1/4,-sqrt3/4).
  // Folds: hexagon -> trapezoid -> kite -> equilateral triangle -> its half, the 30-60-90 triangle.
  // viewHalf 0.85 (the plane agent's suggestion): the tiles are the smallest of all groups; the window still shows
  // the whole star (circumradius 0.58) with a ring of neighbours.
  fromKaleido(k632(), {
    id: '*632', label: '∗632',
    shape: '30-60-90 triangle', surface: 'disk', topology: 'a punched sphere; its rim is a mirror with corners of order 6, 3, 2', viewHalf: 0.85,
    center: [0, 0], seed: [-1 / 4, (-5 * S3) / 36],
  }),
];

export { S3 };
