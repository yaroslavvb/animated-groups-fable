// h2.js — the small kernel under everything: motions of the hyperbolic plane and of the Euclidean plane as 3 x 3
// matrices (flat, row-major, as in the Classification page's geom.js, whose geometry() this builds on), and the
// hyperbolic plane's points and lines as vectors of R^{2,1}.
//
//   point  p   <p, p> = -1, p[2] > 0     (the hyperboloid x^2 + y^2 - z^2 = -1)
//   line   n   <n, n> = +1               the line { x : <x, n> = 0 }; n is its LEFT normal for the way it is walked
//
// with <u, v> = u0 v0 + u1 v1 - u2 v2. One operation does all of incidence:
//
//   perp(u, v) = unit( J (u x v) )       the vector orthogonal to both
//     two points                the line through them
//     a point and a line        the perpendicular dropped from the point
//     two lines that miss       their common perpendicular
//     two lines that cross      the point where they cross      (the result is then a point, not a line)
//
// A FRAME is a motion written as where it takes the standard frame: the origin (0, 0, 1) heading along +x. Its
// columns are (heading, left normal, position).

import { geometry, mul, apply, inv as inv3, I3 } from '../../classification-of-surfaces/src/sym/geom.js';

export { mul, apply, I3 };
export const H = geometry('H');
export const E = geometry('E');
export const S = geometry('S');
export const geomOf = (kind) => (kind === 'H' ? H : kind === 'E' ? E : S);

export const mdot = (u, v) => u[0] * v[0] + u[1] * v[1] - u[2] * v[2];
export const mcross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], -(u[0] * v[1] - u[1] * v[0])];
export const isPt = (u) => mdot(u, u) < 0;
/** A vector scaled to a point (z > 0) or to a line's unit normal, whichever it is. */
export function unit(u) {
  const q = mdot(u, u);
  if (q < 0) { const k = (u[2] < 0 ? -1 : 1) / Math.sqrt(-q); return [u[0] * k, u[1] * k, u[2] * k]; }
  const k = 1 / Math.sqrt(q || 1e-300);
  return [u[0] * k, u[1] * k, u[2] * k];
}
export const perp = (u, v) => unit(mcross(u, v));
/** The point where two lines that are square to each other meet (or any two crossing lines). */
export const meet = (n1, n2) => unit(mcross(n1, n2));

// ---- motions
/** The inverse of a hyperbolic motion: J M^T J, exact. */
export const invH = (M) => [M[0], M[3], -M[6], M[1], M[4], -M[7], -M[2], -M[5], M[8]];
export const invOf = (kind) => (kind === 'H' ? invH : inv3);
export const rot = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
export const ROT_PI = [-1, 0, 0, 0, -1, 0, 0, 0, 1];
export const REFL_X = [1, 0, 0, 0, -1, 0, 0, 0, 1];
/** The slide by d along the x axis, in the hyperbolic plane ('H') or the Euclidean one ('E'). */
export const tx = (kind, d) => (kind === 'H' ? [Math.cosh(d), 0, Math.sinh(d), 0, 1, 0, Math.sinh(d), 0, Math.cosh(d)] : [1, 0, d, 0, 1, 0, 0, 0, 1]);
export const mul3 = (A, B, C) => mul(mul(A, B), C);
export const mulAll = (...Ms) => Ms.reduce((a, b) => mul(a, b));
/** The mirror in the hyperbolic line with unit normal n. */
export function reflectH(n) {
  const s = [1, 1, -1], R = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) R[3 * r + c] = (r === c ? 1 : 0) - 2 * n[r] * s[c] * n[c];
  return R;
}
/** The frame at p heading along the unit tangent t (kind 'H'). */
export const frameAt = (p, t) => { const n = mcross(p, t); return [t[0], n[0], p[0], t[1], n[1], p[1], t[2], n[2], p[2]]; };
/** The frame at p heading toward q. */
export const frameToward = (kind, p, q) => geomOf(kind).frame(p, q);
export const posOf = (F) => [F[2], F[5], F[8]];
export const headOf = (F) => [F[0], F[3], F[6]];
export const leftOf = (F) => [F[1], F[4], F[7]];

/** The vector a hyperbolic motion (not turning the plane over) keeps: a slide's axis as its left normal, a turn's centre. */
export function fixedVec(M) {
  const Mi = invH(M);
  const v = [-(M[5] - Mi[5]) / 2, (M[2] - Mi[2]) / 2, (M[3] - Mi[3]) / 2];
  if (v[0] * v[0] + v[1] * v[1] + v[2] * v[2] > 1e-18) return unit(v);
  // a half turn (or the identity): the centre is the column of M + I that is largest
  let best = null, bn = 0;
  for (let c = 0; c < 3; c++) { const col = [M[c] + (c === 0 ? 1 : 0), M[3 + c] + (c === 1 ? 1 : 0), M[6 + c] + (c === 2 ? 1 : 0)], q = col[0] * col[0] + col[1] * col[1] + col[2] * col[2]; if (q > bn) { bn = q; best = col; } }
  return unit(best);
}
/** How far a slide slides (its translation length), from its trace. */
export const slideLength = (M) => Math.acosh(Math.max(1, (M[0] + M[4] + M[8] - 1) / 2));
/** The turn about the point p by angle a (counter-clockwise). */
export const turnAbout = (p, a) => { const F = frameAt(p, tangentAt(p)); return mul3(F, rot(a), invH(F)); };
/** Some unit tangent at p. */
export function tangentAt(p) {
  const e = Math.abs(p[0]) < Math.abs(p[1]) ? [1, 0, 0] : [0, 1, 0], k = mdot(e, p);
  return unit([e[0] + k * p[0], e[1] + k * p[1], e[2] + k * p[2]]);
}
/** The point of the line n nearest the origin, and the frame there heading so that n is the left normal. */
export function frameOnLine(n, p0) {
  const o = p0 || [0, 0, 1], k = mdot(o, n), p = unit([o[0] - k * n[0], o[1] - k * n[1], o[2] - k * n[2]]);
  return frameAt(p, mcross(n, p));
}
/** Where a point x that lies on the axis of the frame F sits along it (its signed distance from the frame's position). */
export function coordOn(kind, F, x) {
  const q = apply(invOf(kind)(F), x);
  return kind === 'H' ? Math.asinh(q[0] / Math.sqrt(1 + q[1] * q[1])) : q[0] / q[2];
}
/** A point's two coordinates in the frame F: along its axis, and its distance to the left of it. */
export function coordsIn(kind, F, x) {
  const q = apply(invOf(kind)(F), x);
  if (kind === 'H') return [Math.asinh(q[0] / Math.sqrt(1 + q[1] * q[1])), Math.asinh(q[1])];      // not atanh(x / z): far along the axis that loses every digit
  return [q[0] / q[2], q[1] / q[2]];
}
export const distH = (a, b) => H.dist(a, b);
/** The distance between two lines that miss each other. */
export const lineGap = (n1, n2) => Math.acosh(Math.max(1, Math.abs(mdot(n1, n2))));
/** The line through two points, as its left normal when walked from a to b. */
export const lineThrough = (a, b) => unit(mcross(a, b));
/** How far a matrix is from another, entry by entry, relative to their size. */
export function matDiff(A, B) {
  let d = 0, s = 1;
  for (let i = 0; i < 9; i++) { d = Math.max(d, Math.abs(A[i] - B[i])); s = Math.max(s, Math.abs(A[i]), Math.abs(B[i])); }
  return d / s;
}
/**
 * If F1^{-1} F2 is a slide along the x axis followed by a half turn (two frames on one line, heading opposite ways,
 * as the two sides of a cut see it), the slide; else null.
 */
export function slideBetween(kind, F1, F2, tol = 1e-6) {
  const M = mul(mul(invOf(kind)(F1), F2), ROT_PI);
  const d = kind === 'H' ? Math.asinh(M[2]) : M[2];
  return matDiff(M, tx(kind, d)) < tol ? d : null;
}
/** If F1^{-1} F2 is a slide along the x axis (two frames on one line heading the same way), the slide; else null. */
export function shiftBetween(kind, F1, F2, tol = 1e-6) {
  const M = mul(invOf(kind)(F1), F2);
  const d = kind === 'H' ? Math.asinh(M[2]) : M[2];
  return matDiff(M, tx(kind, d)) < tol ? d : null;
}
/** A number brought into (-1/2, 1/2] by whole steps. */
export const wrapHalf = (t) => { let r = t - Math.round(t); if (r <= -0.5) r += 1; return r === 0 ? 0 : r; };

// ---- motions as pairs (c, w): the 2 x 2 matrix c - m(w) of SL(2, R), w a vector of R^{2,1}.
// The slide by d along the line with left normal n is (cosh d/2, sinh d/2 n); the turn by a about the point p is
// (cos a/2, sin a/2 p). They multiply like quaternions, with the Minkowski products:
//   (c1, w1)(c2, w2) = (c1 c2 + <w1, w2>, c1 w2 + c2 w1 + w1 x w2)
// A product of motions that reach far is taken here, not on the 3 x 3 matrices: those have entries of the size
// e^(2 distance) that cancel in a product, these of the size e^distance that do not; and a motion's axis or centre
// is simply w, its length 2 acosh |c|.
const add3 = (a, b, c) => [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]];
const sc = (u, k) => [u[0] * k, u[1] * k, u[2] * k];
export const qMul = (a, b) => ({ c: a.c * b.c + mdot(a.w, b.w), w: add3(sc(b.w, a.c), sc(a.w, b.c), mcross(a.w, b.w)) });
export const qInv = (a) => ({ c: a.c, w: [-a.w[0], -a.w[1], -a.w[2]] });
export const qOne = () => ({ c: 1, w: [0, 0, 0] });
export const qSlide = (n, d) => ({ c: Math.cosh(d / 2), w: sc(n, Math.sinh(d / 2)) });
export const qTurn = (p, a) => ({ c: Math.cos(a / 2), w: sc(p, Math.sin(a / 2)) });
export const qMulAll = (...qs) => qs.reduce((a, b) => qMul(a, b));
export const qConj = (q, k) => qMul(qMul(k, q), qInv(k));
export const qPow = (q, n) => { let r = qOne(); const b = n < 0 ? qInv(q) : q; for (let i = 0; i < Math.abs(n); i++) r = qMul(r, b); return r; };
/** Where the motion takes a vector (a point, or a line's normal). */
export const qAct = (q, v) => qMul(qMul(q, { c: 0, w: v }), qInv(q)).w;
/** The motion as a 3 x 3 matrix. */
export function qMat(q0) {
  // c^2 - <w, w> is 1 only up to the rounding of its two terms, which are of the size of the motion; the matrix is
  // the motion times that number, so the pair is first brought to length 1 in the arithmetic it is used in
  const k = 1 / Math.sqrt(Math.abs(q0.c * q0.c - mdot(q0.w, q0.w)) || 1), q = { c: q0.c * k, w: [q0.w[0] * k, q0.w[1] * k, q0.w[2] * k] };
  const a = qAct(q, [1, 0, 0]), b = qAct(q, [0, 1, 0]), c = qAct(q, [0, 0, 1]);
  return [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
}
/** A slide's length; and the vector a motion keeps: a slide's axis as the left normal of the way it slides, a turn's centre. */
export const qLen = (q) => 2 * Math.acosh(Math.max(1, Math.abs(q.c)));
export const qAxis = (q) => unit(q.c < 0 ? [-q.w[0], -q.w[1], -q.w[2]] : q.w);
/** How far (c, w) is from being the identity motion (which is (1, 0) and (-1, 0)). */
export const qOff = (q) => Math.hypot(Math.abs(q.c) - 1, q.w[0], q.w[1], q.w[2]) / Math.max(1, Math.abs(q.c));
/** A 3 x 3 motion (not turning the plane over) as such a pair. */
export function qOfMat(M) {
  const c = Math.sqrt(Math.max(0, M[0] + M[4] + M[8] + 1)) / 2, Mi = invH(M);
  if (c < 1e-7) { let best = null, bn = 0; for (let k = 0; k < 3; k++) { const col = [M[k] + (k === 0 ? 1 : 0), M[3 + k] + (k === 1 ? 1 : 0), M[6 + k] + (k === 2 ? 1 : 0)], n2 = col[0] * col[0] + col[1] * col[1] + col[2] * col[2]; if (n2 > bn) { bn = n2; best = col; } } return { c: 0, w: unit(best) }; }
  const v = [-(M[5] - Mi[5]) / 2, (M[2] - Mi[2]) / 2, (M[3] - Mi[3]) / 2];
  return { c, w: sc(v, 1 / (2 * c)) };
}
