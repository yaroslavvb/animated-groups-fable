// groupdata/kaleido.js — the four kaleidoscopes. Every side of the tile is a mirror, so there is nothing to cut
// and nothing to glue: the orbifold IS the flat tile. Fold type 'snowflake': the star of tiles around one corner
// folds along its mirrors (like a paper snowflake) onto the single tile.
// OWNER: the snowflake agent may tune sizes and text here.
//
// What the two optional fields are for (src/folds/snowflake.js):
//   center   the centre of the plane view's window. The fold's patch is the star of cells around the corner of the
//            kaleidoscope cell with the largest order; among several such corners it takes the one nearest `center`.
//            So `center` is put ON that corner: the star sits in the middle of the window, and the stars of the
//            other corners of the same kind tile the plane around it.
//   seed     the seed of the one preset = which cell of the star is the tile. Chosen so that the folding reads well
//            from the default view (the viewer looks along +y): the first crease is level, or as level as the
//            mirrors allow, the far half of the star comes toward the viewer first, and every later fold lands
//            toward the front left, where the finished stack ends up.

import { kRect, k442, k333, k632, S3 } from '../kaleido.js';

function fromKaleido(k, extra) {
  const c = k.cell;
  const seed = extra.seed || [c.reduce((s, p) => s + p[0], 0) / c.length, c.reduce((s, p) => s + p[1], 0) / c.length];
  return { ...extra, e1: k.e1, e2: k.e2, reps: k.reps, fold: 'snowflake', kaleido: k, presets: [{ name: 'The only tile', seed }] };
}

export default [
  // star = the lattice cell [0, 1.3] x [0, 1] around its centre (0.65, 0.5); tile = its front left quarter.
  // Folds: top half down toward the viewer, then the right half over to the left.
  fromKaleido(kRect(1.3, 1.0), {
    id: '*2222', label: '∗2222', hm: 'pmm',
    shape: 'rectangle', topology: 'disc with four mirror corners of order 2', viewHalf: 1.25,
  }),
  // star = the unit square around its centre (0.5, 0.5), eight triangles; tile = (1/2,1/2), (0,1/2), (0,0).
  // Folds: half (top down), quarter (right over left), then the diagonal — the way a square napkin is folded.
  fromKaleido(k442(), {
    id: '*442', label: '∗442', hm: 'p4m',
    shape: '45-45-90 triangle', topology: 'disc with mirror corners of order 4, 4, 2', viewHalf: 1.1,
    seed: [1 / 6, 1 / 3],
  }),
  // star = the hexagon of six triangles around the 3-fold centre (1/2, sqrt3/6); tile = the kaleidoscope cell itself.
  // Folds: hexagon -> trapezoid -> rhombus -> triangle.
  fromKaleido(k333(), {
    id: '*333', label: '∗333', hm: 'p3m1',
    shape: 'equilateral triangle', topology: 'disc with three mirror corners of order 3', viewHalf: 1.1,
    center: [0.5, S3 / 6],
  }),
  // star = the hexagon of twelve triangles around the 6-fold centre (0, 0); tile = (0,0), (-1/2,-sqrt3/6), (-1/4,-sqrt3/4).
  // Folds: hexagon -> trapezoid -> kite -> equilateral triangle -> its half, the 30-60-90 triangle.
  // viewHalf 0.85 (the plane agent's suggestion): the tiles are the smallest of all groups; the window still shows
  // the whole star (circumradius 0.58) with a ring of neighbours.
  fromKaleido(k632(), {
    id: '*632', label: '∗632', hm: 'p6m',
    shape: '30-60-90 triangle', topology: 'disc with mirror corners of order 6, 3, 2', viewHalf: 0.85,
    center: [0, 0], seed: [-1 / 4, (-5 * S3) / 36],
  }),
];

export { S3 };
