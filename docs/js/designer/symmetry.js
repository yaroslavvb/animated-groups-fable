/* The fixed-point sets of a clockwork group: where its rotation axes stand and
 * where its mirrors run, and the diagram they make. Several pictures draw them
 * — the billiards animation over its pattern, and the designer both into the
 * spacetime box and over the little animation beside it — so the computation
 * lives here rather than three times, and so does the drawing that two of them
 * share (planeDiagram, at the foot of the file).
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
 * frame and not only of the animation — the site draws those filled and the rest
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

/* ---- the diagram ---------------------------------------------------------- */

/* The site's colour for a fixed-point set, and the ground it is cleared out of.
 * Both are the printed-plate ink and paper the rest of the designer uses. */
const AXIS = "#8a8578";
const GROUND = "#faf9f6";

/* Lines are drawn under the marks and under whatever else is on the page, so
 * they are a shade rather than a rule: eighteen mirrors at full strength are a
 * hatching, and the diagram is meant to be read THROUGH. */
const LINE_ALPHA = 0.6;

/* The picture those sets make in the PLANE — the mirrors solid, the glides
 * dashed, a marker at every rotation centre, filled when the turn is free and
 * hollow when it costs time.
 *
 * The projection is the caller's: a function from LATTICE coordinates to canvas
 * pixels, or null for a point it cannot place. That is the ONLY difference
 * between the designer's two pictures of the same diagram — the box wants the
 * floor of a perspective view, the animation looks straight down — so it is the
 * only thing passed in. What a 2-fold looks like, which line is dashed and how
 * far a mirror is drawn are statements about the group, and they are made here
 * once rather than in each view.
 *
 *   o.reach       how far along itself a line is drawn, in lattice units
 *   o.min, o.max  the lattice window the markers are kept inside
 *   o.lines       false to draw only the marks — which is how a caller lays the
 *   o.markers     ground first and then repeats the marks over what stands on
 *                 it, the only way a diagram under a dense pattern is legible
 *   o.alpha       for that second pass
 *   o.r           marker radius, in pixels
 */
export function planeDiagram(g, el, project, o) {
  const opt = o || {};
  const axis = opt.axis || AXIS;
  const ground = opt.ground || GROUND;
  const reach = opt.reach === undefined ? 2.2 : opt.reach;
  const min = opt.min === undefined ? -1 : opt.min;
  const max = opt.max === undefined ? 2 : opt.max;
  const r = opt.r === undefined ? 6 : opt.r;
  const alpha = opt.alpha === undefined ? 1 : opt.alpha;

  g.save();
  if (opt.lines !== false) {
    g.strokeStyle = axis;
    g.globalAlpha = alpha * LINE_ALPHA;
    for (const ln of el.lns) {
      g.lineWidth = ln.glide ? 1.1 : 1.7;
      g.setLineDash(ln.glide ? [6, 4] : []);
      const a = project([ln.base[0] - reach * ln.d[0], ln.base[1] - reach * ln.d[1]]);
      const b = project([ln.base[0] + reach * ln.d[0], ln.base[1] + reach * ln.d[1]]);
      // a mirror runs past the block it belongs to, so an end of one can be
      // somewhere the caller's projection has nothing to say about
      if (!a || !b) continue;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    }
    g.setLineDash([]);
  }
  if (opt.markers !== false) {
    g.globalAlpha = alpha;
    for (const p of el.pts) {
      if (p.c[0] < min || p.c[0] > max || p.c[1] < min || p.c[1] > max) continue;
      const q = project(p.c);
      if (q) marker(g, q, p, r, axis, ground);
    }
  }
  g.restore();
}

/* One rotation centre. Filled: the turn costs no time, so it is a symmetry of
 * every frozen frame as well as of the animation. The disc of ground under it
 * is not decoration — three mirrors meet at some of these points, and a mark
 * sitting in the crossing would read as a thickening of the lines. */
export function marker(g, at, p, r, axis, ground) {
  const rr = r === undefined ? 6 : r;
  const ink = axis || AXIS;
  const paper = ground || GROUND;
  g.beginPath();
  g.arc(at[0], at[1], rr + 2.5, 0, 2 * Math.PI);
  g.fillStyle = paper;
  g.fill();
  g.beginPath();
  if (p.order === 2) {
    // a 2-fold has no polygon: the book draws it as a lens, and a two-sided
    // one would be a line segment
    g.ellipse(at[0], at[1], rr, rr * 0.5, 0, 0, 2 * Math.PI);
  } else {
    for (let k = 0; k < p.order; k++) {
      const a = -Math.PI / 2 + k * 2 * Math.PI / p.order;
      g[k ? "lineTo" : "moveTo"](at[0] + rr * Math.cos(a), at[1] + rr * Math.sin(a));
    }
    g.closePath();
  }
  g.lineWidth = 1.5;
  g.strokeStyle = ink;
  g.fillStyle = p.free ? ink : paper;
  g.fill();
  if (!p.free) g.stroke();
}
