/* The fixed-point sets of a clockwork group: where its rotation axes stand and
 * where its mirrors run. Two pages draw them — the billiards film, over the
 * pattern, and the designer, into the spacetime box — so the computation lives
 * here rather than twice.
 *
 * A rotation (det +1, M != I) fixes one point, u = (I - M)^-1 v. A reflection
 * (det -1) fixes a line: split v along the mirror direction d and the normal n;
 * the axis sits at half the normal component, and whatever is left along d is
 * the glide.
 *
 * Two things a first attempt always gets wrong, and the reason this is worth
 * sharing rather than rewriting:
 *
 *   - The enumeration runs over the LATTICE TRANSLATIONS as well as the ops. A
 *     fixed point is not a linear function of the translation: the centres of
 *     (M | m) as m runs over the lattice are (I - M)^-1 m, a lattice three
 *     times finer for a 3-fold. Translating one centre by the lattice would
 *     show a third of them.
 *   - One axis carries many elements — the same reflection composed with every
 *     translation along it. The line is a MIRROR as soon as one of them has no
 *     leftover slide, so "mirror or glide" is an AND over everything on the
 *     axis, not whichever element was met first.
 *
 * In spacetime a rotation centre is an AXIS, and a rotation that costs time is
 * a SCREW about it: `order` and `tau` are what the designer labels it with.
 * `free` says the rotation costs no time, i.e. it is a symmetry of every frozen
 * frame and not only of the film — the site draws those filled and the rest
 * hollow.
 */
"use strict";

const frac = (x) => ((x % 1) + 1) % 1;

const apply = (M, u) => [M[0][0] * u[0] + M[0][1] * u[1],
                         M[1][0] * u[0] + M[1][1] * u[1]];

const inv2 = (M) => {
  const d = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  return [[M[1][1] / d, -M[0][1] / d], [-M[1][0] / d, M[0][0] / d]];
};

const pick = (cols) =>
  (Math.hypot(cols[0][0], cols[0][1]) > 1e-9 ? cols[0] : cols[1]);

/* coefficients of v in the (possibly oblique) basis d, n */
function solve2(d, n, v) {
  const det = d[0] * n[1] - d[1] * n[0];
  return [(v[0] * n[1] - v[1] * n[0]) / det, (d[0] * v[1] - d[1] * v[0]) / det];
}

/* An integer matrix of determinant +1 other than the identity is a rotation of
 * finite order, and its trace alone says which: the eigenvalues are on the unit
 * circle, so the trace is 2cos(theta) and takes only these five values. */
const rotOrder = (M) => {
  const tr = M[0][0] + M[1][1];
  return tr === 1 ? 6 : tr === 0 ? 4 : tr === -1 ? 3 : 2;
};

/* Rotation centres and mirror/glide lines within reach of a view `span` cells
 * wide, all in LATTICE coordinates. Points carry the order of the largest
 * rotation about them and that rotation's time cost; lines carry a point on
 * them and a direction. */
export function elements(ops, span) {
  const n = span + 1;
  const seenPt = new Map(), seenLn = new Map();
  const pts = [], lns = [];
  for (const op of ops) {
    const M = op.M;
    const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
    const isI = M[0][0] === 1 && M[1][1] === 1 && !M[0][1] && !M[1][0];
    if (isI) continue;
    // +1 eigenvector: a nonzero column of M + I; -1 eigenvector: of M - I
    const d = det < 0 ? pick([[M[0][0] + 1, M[1][0]], [M[0][1], M[1][1] + 1]]) : null;
    const nn = det < 0 ? pick([[M[0][0] - 1, M[1][0]], [M[0][1], M[1][1] - 1]]) : null;
    const IM = det > 0
      ? inv2([[1 - M[0][0], -M[0][1]], [-M[1][0], 1 - M[1][1]]]) : null;
    const order = det > 0 ? rotOrder(M) : 0;
    for (let m1 = -3 * n; m1 <= 3 * n; m1++) {
      for (let m2 = -3 * n; m2 <= 3 * n; m2++) {
        const v = [op.v[0] + m1, op.v[1] + m2];
        if (det > 0) {
          const c = apply(IM, v);
          if (Math.abs(c[0]) > n + 1 || Math.abs(c[1]) > n + 1) continue;
          const key = [Math.round(c[0] * 60), Math.round(c[1] * 60)].join();
          const had = seenPt.get(key);
          const tau = frac(op.tau);
          // Does the rotation about this centre cost any time? A centre is
          // well defined by (M | v) alone — two elements with the same
          // spatial part and different taus would put a pure time
          // translation in the group, which none of these has. `free` is a
          // reading of the LABELLED rotation, so it moves whenever tau does:
          // a 6-fold at 1/3 of a period must not inherit the free-ness of the
          // half-turn that is one of its powers.
          if (had === undefined) {
            seenPt.set(key, pts.length);
            pts.push({ c, free: tau < 1e-9, order, tau });
          } else if (order > pts[had].order) {
            // The point's order is the largest rotation that fixes it, and the
            // time it costs is that rotation's, not a power's.
            pts[had].order = order;
            pts[had].tau = tau;
            pts[had].free = tau < 1e-9;
          } else if (order === pts[had].order && tau < pts[had].tau) {
            // A turn and its inverse both generate the axis and their costs sum
            // to a period, so a label has to choose; the smaller reading is the
            // canonical one and does not depend on the order of `ops`.
            pts[had].tau = tau;
            pts[had].free = tau < 1e-9;
          }
        } else {
          const co = solve2(d, nn, v);          // v = co[0] d + co[1] n
          const off = co[1] / 2;                // the axis's normal offset
          const base = [nn[0] * off, nn[1] * off];
          if (Math.abs(base[0]) > 2 * n || Math.abs(base[1]) > 2 * n) continue;
          const key = [Math.round(d[0] * 60), Math.round(d[1] * 60),
                       Math.round(off * 60)].join();
          const glide = Math.abs(frac(co[0] + 0.5) - 0.5) > 1e-6;
          const had = seenLn.get(key);
          if (had === undefined) {
            seenLn.set(key, lns.length);
            lns.push({ base, d, glide });
          } else if (!glide) {
            lns[had].glide = false;
          }
        }
      }
    }
  }
  return { pts, lns };
}
