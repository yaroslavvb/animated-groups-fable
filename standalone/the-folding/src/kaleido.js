// kaleido.js — the four plane kaleidoscopes (reflection groups) as raw group data, plus point-group helpers.
// A raw group is {e1, e2, reps, cell?}: translation lattice basis, coset representatives of the lattice
// (so |reps| = order of the point group), and for a kaleidoscope its fundamental cell T
// (a counter-clockwise polygon bounded by mirror lines; every side lies on a mirror of the kaleidoscope).

import { IDENT, rot, refl, compose } from './geom.js';

export const S3 = Math.sqrt(3);

/** Rotations by 2*pi*k/n about the origin, k = 0..n-1. */
export function cyclic(n) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(k === 0 ? { ...IDENT } : rot((2 * Math.PI * k) / n));
  return out;
}

/** Dihedral point group about the origin: n rotations, then (mirror through origin at angle mirrorAng)∘rotation. */
export function dihedral(n, mirrorAng) {
  const R = cyclic(n);
  const M = refl(0, 0, mirrorAng);
  return R.concat(R.map((r) => compose(M, r)));
}

/** *2222 = pmm with mirrors x = k*a/2, y = k*b/2. Cell: the rectangle [0,a/2] x [0,b/2]. */
export function kRect(a, b) {
  return {
    e1: [a, 0], e2: [0, b],
    reps: [{ ...IDENT }, rot(Math.PI), refl(0, 0, Math.PI / 2), refl(0, 0, 0)],
    cell: [[0, 0], [a / 2, 0], [a / 2, b / 2], [0, b / 2]],
  };
}

/** *442 = p4m on the unit square lattice. Cell: (0,0) [4], (1/2,0) [2], (1/2,1/2) [4]. */
export function k442() {
  return { e1: [1, 0], e2: [0, 1], reps: dihedral(4, 0), cell: [[0, 0], [0.5, 0], [0.5, 0.5]] };
}

/** *442 on the lattice (1/2,1/2), (-1/2,1/2). Cell: (0,0) [4], (1/2,0) [4], (1/4,1/4) [2]. Contains p4g of the unit lattice. */
export function k442small() {
  return { e1: [0.5, 0.5], e2: [-0.5, 0.5], reps: dihedral(4, 0), cell: [[0, 0], [0.5, 0], [0.25, 0.25]] };
}

/** *632 = p6m on the hexagonal lattice (1,0), (1/2, sqrt3/2). Cell: (0,0) [6], (1/2,0) [2], (1/2, sqrt3/6) [3]. */
export function k632() {
  return { e1: [1, 0], e2: [0.5, S3 / 2], reps: dihedral(6, 0), cell: [[0, 0], [0.5, 0], [0.5, S3 / 6]] };
}

/** *333 = p3m1 on the same hexagonal lattice. Cell: the equilateral triangle (0,0), (1/2,-sqrt3/6), (1/2, sqrt3/6). */
export function k333() {
  return { e1: [1, 0], e2: [0.5, S3 / 2], reps: dihedral(3, Math.PI / 2), cell: [[0, 0], [0.5, -S3 / 6], [0.5, S3 / 6]] };
}
