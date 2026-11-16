// domains.js — one TILE of a pattern (a fundamental region of its symmetry group) and how its edges are used.
//
// A domain is { G, verts, edges, at, clear }:
//   G       the geometry (geom.js): sphere, plane or hyperbolic plane
//   verts   the tile's corners, counter-clockwise (the inside is on the left of every edge); edge i runs
//           from verts[i] to verts[i + 1]. A corner may be flat (angle pi): that only splits an edge in two
//   edges   edge i is { mirror: true }        a mirror of the pattern: the neighbouring tile is the mirror image
//                   or { to: j, rev }         glued to edge j. rev = false: by a motion that keeps the plane's
//                                             sense (the two arrows run opposite ways round the tile, a ... a^-1);
//                                             rev = true: by one that turns it over (both the same way, a ... a)
//   at      a point well inside, moved by every symmetry: where the motif is drawn
//   face    (optional, on the sphere) the point that faces the eye at first, when that should not be `at`
//   clear   its distance to the nearest edge
//
// Almost every domain here is built the same way (half()): a polygon P with angles pi / d round an inscribed circle,
// each edge a MIRROR or a SEAM. All mirrors: P is the tile, the group is the kaleidoscope. Otherwise the tile is P
// together with its image in one seam, and every other seam is glued to its own image: by the turn that the two
// seam reflections make together ('s'), or by that turn followed by a flip of the edge ('g', a glide).

import { geometry, kindOfAngles, apply } from './geom.js';

const TAU = 2 * Math.PI;

export function makeDomain(G, verts, edges, extra = {}) {
  const n = verts.length, D = { G, verts, edges, n, ...extra };
  if (!D.at) {
    const s = [0, 0, 0];
    verts.forEach((v, i) => { const w = 1 + 0.31 * Math.sin(1 + 2.3 * i); s[0] += w * v[0]; s[1] += w * v[1]; s[2] += w * v[2]; });
    D.at = G.norm(s);
  }
  D.clear = Math.min(...verts.map((v, i) => G.lineDist(D.at, v, verts[(i + 1) % n])));
  return D;
}

/**
 * The polygon with interior angles pi / divs[i] (divs[i] >= 1, not necessarily whole) whose edges all touch one
 * circle about the origin. Which geometry it lives in follows from the angles. Returns { G, verts, r }.
 */
export function inscribed(divs) {
  const half = divs.map((d) => Math.PI / (2 * d));
  const kind = kindOfAngles(divs.map((d) => Math.PI / d)), G = geometry(kind);
  const scale = (r) => (kind === 'S' ? Math.cos(r) : kind === 'H' ? Math.cosh(r) : 1);
  const phiOf = (r) => half.map((a) => Math.asin(Math.min(1, Math.cos(a) / scale(r))));
  const total = (r) => phiOf(r).reduce((s, p) => s + 2 * p, 0);
  let r = 1;
  if (kind === 'H') { let lo = 0, hi = 14; for (let i = 0; i < 90; i++) { const m = (lo + hi) / 2; if (total(m) > TAU) lo = m; else hi = m; } r = (lo + hi) / 2; }
  if (kind === 'S') { let lo = 0, hi = Math.min(...half); for (let i = 0; i < 90; i++) { const m = (lo + hi) / 2; if (total(m) < TAU) lo = m; else hi = m; } r = (lo + hi) / 2; }
  const phi = phiOf(r), verts = [];
  let th = -2 * phi[0] - Math.PI / 2;        // the first edge touches the circle straight below the origin: it lies level
  for (let i = 0; i < divs.length; i++) {
    th += phi[i];
    const c = Math.cos(phi[i]);
    const d = kind === 'S' ? Math.atan2(Math.sin(r), Math.cos(r) * c) : kind === 'H' ? Math.atanh(Math.min(0.9999999, Math.tanh(r) / c)) : r / c;
    verts.push(G.polar(d, th));
    th += phi[i];
  }
  return { G, verts, r };
}

/**
 * half(divs, labels): the polygon with angles pi / divs[i]; labels[i] says what edge i (from corner i to corner
 * i + 1) is: 'm' a mirror, 's' a seam, 'g' a seam glued with a flip. See the head of this file.
 */
export function half(divs, labels) {
  const P = inscribed(divs), G = P.G, V = P.verts, n = V.length;
  const k = labels.findIndex((l) => l !== 'm');
  const extra = { at: G.polar(0.0001, 0.3), base: { verts: V, r: P.r } };
  if (k < 0) return makeDomain(G, V, labels.map(() => ({ mirror: true })), extra);
  const at = (j) => V[((j % n) + n) % n], lab = (j) => labels[((j % n) + n) % n];
  const rho = G.reflect(at(k), at(k + 1));
  const verts = [], edges = [];
  for (let q = 0; q <= n - 1; q++) verts.push(at(k + 1 + q));                 // P's corners, from the far end of the seam round to its near end
  for (let q = 1; q <= n - 2; q++) verts.push(apply(rho, at(k - q)));         // and back along the mirror image
  const m = 2 * n - 2;
  for (let q = 0; q < m; q++) {
    const e = q <= n - 2 ? k + 1 + q : k - 1 - (q - (n - 1)), l = lab(e);     // which edge of P this is (itself or its image)
    edges.push(l === 'm' ? { mirror: true } : { to: 2 * n - 3 - q, rev: l === 'g' });
  }
  return makeDomain(G, verts, edges, extra);
}

/** A regular polygon with interior angle theta, its edges glued by a word such as "a b a- b-" ("a a": the same way round). */
export function regular(word, theta) {
  const toks = word.trim().split(/\s+/), n = toks.length;
  const P = inscribed(new Array(n).fill(Math.PI / theta));
  const edges = toks.map((t, i) => {
    const id = t.replace(/-$/, ''), j = toks.findIndex((u, q) => q !== i && u.replace(/-$/, '') === id);
    if (j < 0) throw new Error('regular: the letter ' + id + ' must come twice');
    return { to: j, rev: t.endsWith('-') === toks[j].endsWith('-') };
  });
  return makeDomain(P.G, P.verts, edges, { at: P.G.polar(0.0001, 0.3) });
}

/** A mirror and a miracle on the plane (the book's Figure 2.10): a triangle, its base a mirror, its legs glued by a glide. */
export function mirrorAndMiracle() {
  const G = geometry('E');
  return makeDomain(G, [[-1, 0, 1], [1, 0, 1], [0, 1.15, 1]], [{ mirror: true }, { to: 2, rev: true }, { to: 1, rev: true }], { at: [0.08, 0.36, 1] });
}

/**
 * N x on the sphere: the top of a segment of an orange, 2 pi / N wide. Its two sides are glued by the turn about
 * the pole; the two halves of its piece of the equator are glued by a slide along the equator that swaps north and
 * south. N = 1: the whole northern hemisphere, each point of the equator glued to the opposite one.
 */
export function crossSphere(N) {
  const G = geometry('S'), Q = Math.PI / 2;
  if (N === 1) {
    const verts = [0, 1, 2, 3].map((i) => G.polar(Q, (i * Math.PI) / 2));
    return makeDomain(G, verts, [{ to: 2, rev: true }, { to: 3, rev: true }, { to: 0, rev: true }, { to: 1, rev: true }], { at: G.polar(0.45, 0.8), face: G.polar(1.02, 0.8) });
  }
  const verts = [G.polar(0, 0), G.polar(Q, 0), G.polar(Q, Math.PI / N), G.polar(Q, TAU / N)];
  return makeDomain(G, verts, [{ to: 3, rev: false }, { to: 2, rev: true }, { to: 1, rev: true }, { to: 0, rev: false }], { at: G.polar(0.75, 0.9 * (Math.PI / N)) });
}

/** N N on the sphere: a segment of an orange, 2 pi / N wide, its two sides glued by the turn about the poles. */
export function spindle(N) {
  const G = geometry('S'), Q = Math.PI / 2;
  const verts = [G.polar(0, 0), G.polar(Q, 0), G.polar(Math.PI, 0), G.polar(Q, TAU / N)];
  return makeDomain(G, verts, [{ to: 3, rev: false }, { to: 2, rev: false }, { to: 1, rev: false }, { to: 0, rev: false }], { at: G.polar(Q - 0.42, 0.8 * (Math.PI / N)) });
}

/** One mirror on the sphere: the northern hemisphere, the equator a mirror. */
export function hemisphere() {
  const G = geometry('S'), Q = Math.PI / 2;
  return makeDomain(G, [0, 1, 2].map((i) => G.polar(Q, (i * TAU) / 3)), [{ mirror: true }, { mirror: true }, { mirror: true }], { at: G.polar(0.5, 0.8), face: G.polar(1.02, 0.8) });
}
