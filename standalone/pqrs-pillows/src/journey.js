// journey.js — the solid cut along ONE partition's loop into its two pillows, and each pillow opened along its seal
// onto its crown. Pure: no DOM. For the journey  surface -> two pillows -> open crowns  of surface-model.js.
//
// The loop is chosen by the journey's own control, never by which slider was touched (his ask of Fri 27 Nov 2026,
// 22:55: switching between sliders changes nothing).
//
// HOW. The loop's own chart (pillow.js: Fermi coordinates about the loop, s the distance from it, theta along it) has
// the first pair's pillow on s < 0 and the second's on s > 0; a pillow is the strip between the loop and its ROOF,
// the seal's copies laid end to end (a convex strip: its corners are the cone points, of angle 2 pi / n <= pi).
// Every face of the solid is a triangle of the pattern's plane. It is cut into CELLS, each lying in one copy of one
// pillow's strip: a polygon is moved by the group until its middle lies in a strip (fold: turns about the copies of a
// pillow's first cone point, as pillow.js toPillow walks), cut by the strip's lines, and what sticks out goes round
// again. A cell's points then have true Fermi coordinates, hence a place on the crown
//     r = (L / 2 pi) cosh s,  phi = 2 pi theta / L        (pillow.js crownPoint; 2222: a tube)
// and, as points of their face, a place on the solid. The two sides of a seal are different cells, so the seal can
// open; the two sides of the loop are different cells, so the pillows can part.
//
//   const J = journeyOf(S, state, card);        S: solid.js solidOf(state); card: one of state.js cardsOf(state)
//   J.nVertices, J.triangles                     Uint32Array, counter-clockwise seen from outside
//   J.closed, J.crown                            Float64Array(3 n): each vertex on the solid (as S draws it), and on
//                                                the crowns (the loop's circle about the z axis, the first pair below)
//   J.pillow                                     Uint8Array(n): 0 the first pair's pillow, 1 the second's
//   J.corners                                    Float64Array(9 m): each corner's point of the pair frame (the print's chart)
//   J.loop                                       { closed, crown: Float64Array(3 k) } the loop, k points (its circle)
//   J.seals[k]                                   { closed, crownA, crownB } the seal of pillow k and its two copies on the crown
//   J.cones                                      [{ feature, pillow, closed: [x, y, z], crown: [x, y, z] } x 4]
//   J.degenerate                                 [bool, bool]: a pair of 2s in a hyperbolic orbifold has no pillow but its seal
//   J.cuff, J.rho, J.cells                       the loop's length, its circle's radius, how many cells there are
//   J.exact                                      both pillows' peaks lie inside the crown's rim (else a flange stands in)

import * as P from './pillow.js';
import { flip } from './flips.js';
import { fourConeCentered, invH } from '../../two-features-two-handles/src/handles.js';
import { mul, apply, inv } from '../../classification-of-surfaces/src/sym/geom.js';

const TAU = 2 * Math.PI;
const NO_COMMAS = [null, null, null, null];
const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
const det3 = (a, b, c) => a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);

// ---- the loop's chart, in both geometries ----------------------------------------------------------------------------
const CH = {
  H: {
    fermi: (Y) => [Math.asinh(Y[1]), Math.atanh(Y[0] / Y[2])],                  // [s, theta]
    point: (s, th) => P.fermiToHyperboloid(s, th),
    norm: (v) => { const n = Math.sqrt(Math.max(1e-300, v[2] * v[2] - v[0] * v[0] - v[1] * v[1])); return [v[0] / n, v[1] / n, v[2] / n]; },
    /** The turn by `ang` about the hyperboloid point C, as a matrix (pillow.js rotateAbout). */
    turn(C, ang) {
      const c = Math.cos(ang), s = Math.sin(ang), k = 1 - c;
      // X -> c X + (1 - c) d(X) C + s (C x X),  d(X) = X2 C2 - X0 C0 - X1 C1
      return [
        c - k * C[0] * C[0], -k * C[0] * C[1] - s * C[2], k * C[0] * C[2] + s * C[1],
        -k * C[1] * C[0] + s * C[2], c - k * C[1] * C[1], k * C[1] * C[2] - s * C[0],
        -k * C[2] * C[0] + s * C[1], -k * C[2] * C[1] - s * C[0], c + k * C[2] * C[2],
      ];
    },
    inverse: (M) => invH(M),
    /** The line through U and V as a function: > 0 to the left of U -> V; its value is sinh of the distance. */
    line(U, V) {
      const cx = U[1] * V[2] - U[2] * V[1], cy = U[2] * V[0] - U[0] * V[2], cz = U[0] * V[1] - U[1] * V[0];
      const n = Math.sqrt(Math.max(1e-300, cx * cx + cy * cy - cz * cz));
      return (Y) => (cx * Y[0] + cy * Y[1] + cz * Y[2]) / n;
    },
    dist: (u, v) => Math.acosh(Math.max(1, u[2] * v[2] - u[0] * v[0] - u[1] * v[1])),
  },
  E: {
    fermi: (Y) => [Y[1], Y[0]],
    point: (s, th) => [th, s, 1],
    norm: (v) => [v[0] / v[2], v[1] / v[2], 1],
    turn: (C) => [-1, 0, 2 * C[0], 0, -1, 2 * C[1], 0, 0, 1],                   // a half turn about C
    inverse: (M) => inv(M),
    line(U, V) {
      const cx = U[1] * V[2] - U[2] * V[1], cy = U[2] * V[0] - U[0] * V[2], cz = U[0] * V[1] - U[1] * V[0];
      const n = Math.hypot(cx, cy) || 1;
      return (Y) => (cx * Y[0] + cy * Y[1] + cz * Y[2]) / n;
    },
    dist: (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]),
  },
};

/**
 * The chart of a card's loop: the pillows' numbers (pillow.js orbifold), the motions between the state's pair frame
 * and the loop's chart, and the fold. card: state.js cardsOf(state)[i].
 */
export function chartOf(state, card) {
  let sX = state, Q = I3(), invQ = I3();
  if (!card.active) { const r = flip(state, card.key); sX = r.state; Q = r.Q; invQ = r.invQ; }
  const g = P.orbifold(sX.orders, sX.L, sX.tw), kind = g.kind, G = CH[kind], cuff = g.cuff;
  let toChart, fromChart;
  if (kind === 'H') {
    const Pm = fourConeCentered(sX.orders, sX.L, sX.tw, { commas: NO_COMMAS }).Pmat;
    toChart = mul(invH(Pm), Q); fromChart = mul(invQ, Pm);
  } else {
    const y0 = 0.5 / sX.L;                                        // the loop is drawn half way between the rows
    toChart = mul([1, 0, 0, 0, 1, -y0, 0, 0, 1], Q); fromChart = mul(invQ, [1, 0, 0, 0, 1, y0, 0, 0, 1]);
  }
  const pillows = [g.lower, g.upper], base = [g.thP, g.thR], side = [-1, 1], firstOrder = [g.orders[0], g.orders[2]];
  const degenerate = [!!g.lower.degenerate, !!g.upper.degenerate];

  /**
   * Fold a chart point into a pillow's strip: { k, M } with M the motion (of the group) applied, so that M Y lies in
   * pillow k's strip (0 <= side s <= roof); null if it is not found.
   */
  function fold(Y) {
    let p = [Y[0], Y[1], Y[2]], M = I3();
    for (let step = 0; step <= 400; step++) {
      if (kind === 'H') p = G.norm(p);
      let [s, th] = G.fermi(p);
      let k = s < 0 ? 0 : 1;
      if (degenerate[k]) {
        if (Math.abs(s) > 1e-13) {                                 // a (2, 2) pair has no inside: fold through it, a half turn about its first point
          const T = kind === 'H' ? G.turn(G.point(0, base[k]), Math.PI) : G.turn([base[k], 0]);
          p = apply(T, p); M = mul(T, M);
          continue;
        }
        k = 1 - k; s = 0;
      }
      const pl = pillows[k], sig = side[k] * s, thl = P.wrapSym(side[k] * (th - base[k]), cuff), h = pl.roofAt(Math.abs(thl));
      if (sig <= h * (1 + 1e-12) + 1e-13) return { k, M };
      // across the roof: the turn about the nearest copy of the pillow's first cone point that carries one copy of the seal onto the other
      const thC = th - side[k] * thl, ang = ((thl > 0 ? -1 : 1) * TAU) / firstOrder[k];
      const T = kind === 'H' ? G.turn(G.point(side[k] * pl.hP, thC), ang) : G.turn([thC, side[k] * pl.hP]);
      p = apply(T, p); M = mul(T, M);
    }
    return null;
  }

  /** The lines that bound pillow k's strip near the chart interval [th0, th1]: functions >= 0 inside. */
  function bounds(k, th0, th1) {
    const pl = pillows[k], sd = side[k], out = [(Y) => sd * (kind === 'H' ? Y[1] : Y[1])];        // the loop itself: sinh s (flat: s)
    const l0 = Math.min(sd * (th0 - base[k]), sd * (th1 - base[k])), l1 = Math.max(sd * (th0 - base[k]), sd * (th1 - base[k]));
    const m0 = Math.floor(l0 / cuff) - 1, m1 = Math.ceil(l1 / cuff) + 1;
    const at = (hgt, thl) => G.point(sd * hgt, base[k] + sd * thl);
    for (let m = m0; m <= m1; m++) {
      const Pm = at(pl.hP, m * cuff), Qm = at(pl.hQ, (m + 0.5) * cuff), Pn = at(pl.hP, (m + 1) * cuff);
      for (const [U, V, foot] of [[Pm, Qm, (m + 0.25) * cuff], [Qm, Pn, (m + 0.75) * cuff]]) {
        const f = G.line(U, V), inside = f(at(0, foot));
        if (Math.abs(inside) < 1e-12) continue;                    // (a seal that lies on the loop bounds nothing more)
        out.push(inside > 0 ? f : (Y) => -f(Y));
      }
    }
    return out;
  }

  return { state: sX, kind, G, g, cuff, rho: cuff / TAU, toChart, fromChart, pillows, base, side, degenerate, fold, bounds };
}

// ---- polygons ----------------------------------------------------------------------------------------------------------

/** A convex polygon cut by the line f = 0: [the part with f >= 0, the part with f <= 0] (either may be empty). */
function split(poly, f, norm, eps = 1e-10) {
  const n = poly.length, v = poly.map(f), inside = [], outside = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], fa = v[i], fb = v[(i + 1) % n];
    if (fa >= -eps) inside.push(a);
    if (fa <= eps) outside.push(a);
    if ((fa > eps && fb < -eps) || (fa < -eps && fb > eps)) {
      const x = norm([fb * a[0] - fa * b[0], fb * a[1] - fa * b[1], fb * a[2] - fa * b[2]].map((c) => c / (fb - fa)));
      inside.push(x); outside.push(x);
    }
  }
  return [inside, outside];
}
/** Is a polygon worth keeping: three corners that are not all on one line (size measured against `eps`)? */
function solidEnough(poly, eps) {
  if (poly.length < 3) return false;
  const a = poly[0];
  let best = 0;
  for (let i = 1; i + 1 < poly.length; i++) best = Math.max(best, Math.abs(det3(a, poly[i], poly[i + 1])));
  return best > eps * a[2] * a[2] * a[2];
}
const middle = (poly, norm) => norm(poly.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]));

/**
 * The cells of one face: polygons, each inside one copy of one pillow's strip. tri: the face's three corners in the
 * loop's chart. Returns [{ k, M, poly }]: poly is given in the strip's own place (the chart moved by M).
 */
export function cellsOf(C, tri, { max = 60 } = {}) {
  const G = C.G, cells = [], queue = [tri];
  let guard = 0;
  while (queue.length && guard++ < max) {
    const poly = queue.pop();
    if (!solidEnough(poly, 1e-9)) continue;
    const fd = C.fold(middle(poly, G.norm));
    if (!fd) continue;
    let inside = poly.map((p) => (C.kind === 'H' ? G.norm(apply(fd.M, p)) : apply(fd.M, p)));
    const ths = inside.map((p) => G.fermi(p)[1]), back = G.inverse(fd.M);
    for (const f of C.bounds(fd.k, Math.min(...ths), Math.max(...ths))) {
      const [inn, out] = split(inside, f, G.norm);
      if (solidEnough(out, 1e-7)) queue.push(out.map((p) => (C.kind === 'H' ? G.norm(apply(back, p)) : apply(back, p))));
      inside = inn;
      if (!solidEnough(inside, 1e-9)) break;
    }
    if (solidEnough(inside, 1e-9)) cells.push({ k: fd.k, M: fd.M, back, poly: inside });
  }
  return cells;
}

// ---- the journey's mesh ------------------------------------------------------------------------------------------------

/** The grid points of a triangle halved `levels` times: { pts: [[x, y, z]], tris: [[a, b, c]] } (a, b, c index pts). */
function halved(P0, P1, P2, levels, norm) {
  const n = 1 << levels, id = (a, b) => (a * (2 * n + 3 - a)) / 2 + b, pts = new Array(((n + 1) * (n + 2)) / 2);
  pts[id(0, 0)] = P0; pts[id(n, 0)] = P1; pts[id(0, n)] = P2;
  const mid = (u, v) => norm([u[0] + v[0], u[1] + v[1], u[2] + v[2]]);
  for (let s = n; s > 1; s >>= 1) {
    const h = s >> 1;
    for (let a = 0; a < n; a += s) for (let b = 0; a + b < n; b += s) {
      pts[id(a + h, b)] = mid(pts[id(a, b)], pts[id(a + s, b)]);
      pts[id(a, b + h)] = mid(pts[id(a, b)], pts[id(a, b + s)]);
      pts[id(a + h, b + h)] = mid(pts[id(a + s, b)], pts[id(a, b + s)]);
    }
  }
  const tris = [];
  for (let a = 0; a < n; a++) for (let b = 0; a + b < n; b++) {
    tris.push([id(a, b), id(a + 1, b), id(a, b + 1)]);
    if (a + b < n - 1) tris.push([id(a + 1, b), id(a + 1, b + 1), id(a, b + 1)]);
  }
  return { pts, tris };
}

/**
 * The solid S of `state` cut along the loop of `card` (see the head of the file).
 * opts.step: the triangles' size aimed at (a length of the pattern's plane; default 0.12: about 6,000 triangles for 3333).
 */
export function journeyOf(S, state, card, opts = {}) {
  const C = chartOf(state, card), G = C.G, kind = C.kind, cuff = C.cuff, step = opts.step ?? 0.12;
  const crownAt = (s, th, out) => (kind === 'H' ? P.crownPoint(cuff, s, th, 1, out) : P.tubePoint(cuff, s, th, 1, out));
  const toPair = (M, Y) => apply(M, Y);
  const closed = [], crown = [], pillow = [], tris = [], corners = [];
  let cells = 0;
  const tmp = [0, 0, 0];
  S.faces.forEach((face, fi) => {
    const tri = face.P.map((p) => (kind === 'H' ? G.norm(apply(C.toChart, p)) : apply(C.toChart, p)));
    for (const cell of cellsOf(C, tri)) {
      cells++;
      const home = mul(C.fromChart, cell.back);                   // the strip's place -> the state's pair frame
      const weld = new Map();
      const vertex = (Y) => {
        const key = `${Math.round(Y[0] * 2e7)},${Math.round(Y[1] * 2e7)}`;
        let v = weld.get(key);
        if (v !== undefined) return v;
        v = pillow.length;
        weld.set(key, v);
        const y = kind === 'H' ? G.norm(toPair(home, Y)) : toPair(home, Y), [s, th] = G.fermi(Y);
        S.place(fi, y, tmp); closed.push(tmp[0], tmp[1], tmp[2]);
        crownAt(s, th, tmp); crown.push(tmp[0], tmp[1], tmp[2]);
        pillow.push(cell.k);
        corners.push(y[0], y[1], y[2]);                            // by vertex for now; by corner below
        return v;
      };
      // a fan from the cell's middle, every fan triangle halved the same number of times (so they fit along the spokes)
      const c = middle(cell.poly, G.norm), n = cell.poly.length;
      let size = 0;
      for (let i = 0; i < n; i++) size = Math.max(size, G.dist(cell.poly[i], cell.poly[(i + 1) % n]), G.dist(c, cell.poly[i]));
      const levels = Math.max(1, Math.min(5, Math.ceil(Math.log2(size / step))));
      for (let i = 0; i < n; i++) {
        const a = cell.poly[i], b = cell.poly[(i + 1) % n];
        if (G.dist(a, b) < 1e-9) continue;
        const grid = halved(c, a, b, levels, G.norm), ids = grid.pts.map(vertex);
        for (const t of grid.tris) if (ids[t[0]] !== ids[t[1]] && ids[t[1]] !== ids[t[2]] && ids[t[0]] !== ids[t[2]]) tris.push(ids[t[0]], ids[t[1]], ids[t[2]]);
      }
    }
  });
  const nV = pillow.length, triangles = Uint32Array.from(tris), nT = triangles.length / 3, byCorner = new Float64Array(9 * nT);
  for (let t = 0; t < 3 * nT; t++) { const v = 3 * triangles[t]; byCorner[3 * t] = corners[v]; byCorner[3 * t + 1] = corners[v + 1]; byCorner[3 * t + 2] = corners[v + 2]; }

  // ---- the loop, the two seals, the four cone points: on the solid and on the crowns ----
  const onSolid = (Y, hint) => { const y = kind === 'H' ? G.norm(apply(C.fromChart, Y)) : apply(C.fromChart, Y), out = [0, 0, 0]; const t = S.point(y, out, hint); return { p: out, t }; };
  const line = (n, chartPoint, crownPoint) => {
    const a = new Float64Array(3 * (n + 1)), b = new Float64Array(3 * (n + 1));
    let hint = null;
    for (let i = 0; i <= n; i++) {
      const r = onSolid(chartPoint(i / n), hint);
      hint = r.t;
      a.set(r.p, 3 * i);
      b.set(crownPoint(i / n), 3 * i);
    }
    return [a, b];
  };
  const nLoop = opts.loopSteps ?? 96, nSeal = opts.sealSteps ?? 40, th0 = C.base[0];
  const [loopClosed, loopCrown] = line(nLoop, (u) => G.point(0, th0 + u * cuff), (u) => crownAt(0, th0 + u * cuff, [0, 0, 0]));
  const seals = [0, 1].map((k) => {
    const pl = C.pillows[k], sd = C.side[k], at = (x) => [sd * pl.roofAt(Math.abs(x)), C.base[k] + sd * x];
    const [cl, cA] = line(nSeal, (u) => G.point(...at(u * cuff / 2)), (u) => crownAt(...at(u * cuff / 2), [0, 0, 0]));
    const cB = new Float64Array(cA.length);
    for (let i = 0; i <= nSeal; i++) cB.set(crownAt(...at(-(i / nSeal) * cuff / 2), [0, 0, 0]), 3 * i);
    return { closed: cl, crownA: cA, crownB: cB };
  });
  const perm = C.state.perm, V = S.vertex;
  const cones = [0, 1, 2, 3].map((slot) => {
    const k = slot < 2 ? 0 : 1, pl = C.pillows[k], sd = C.side[k], first = slot % 2 === 0;
    return { feature: perm[slot], pillow: k, closed: V[perm[slot]].slice(), crown: crownAt(sd * (first ? pl.hP : pl.hQ), C.base[k] + (first ? 0 : sd * cuff / 2), [0, 0, 0]) };
  });
  const rim = kind === 'E' ? Infinity : P.sMax(cuff);
  return {
    kind, cuff, rho: C.rho, cells, nVertices: nV, triangles,
    closed: Float64Array.from(closed), crown: Float64Array.from(crown), pillow: Uint8Array.from(pillow), corners: byCorner,
    loop: { closed: loopClosed, crown: loopCrown }, seals, cones,
    degenerate: C.degenerate.slice(),
    exact: C.pillows.every((pl) => pl.degenerate || Math.max(pl.hP, pl.hQ) <= rim),
    chart: C,
  };
}
