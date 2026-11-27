// flat.js — the nine Euclidean orbifolds that have a number of shape. Each is ONE flat piece closed up on itself:
//
//   an annulus (pieces.js 'A': a cylinder of circumference len and height h) whose two ends are closed by
//     a fold onto two half-turn points, a mirror, or a crosscap; or glued to each other (the torus);
//   a strip between two mirrors ('R': width len, height h) whose two ends are closed by a mirror, by a half-turn
//     point, or glued to each other, straight (the annulus between two mirrors) or turned over (the Mobius band).
//
// The one cut is the cylinder's waist (a cuff) or the strip's (an arc). The area is fixed, so the height follows
// from the length; that is the scale every Euclidean pattern is free in.
//
//   2222   a cylinder folded shut at both ends        Length and Twist     the flip re-pairs the four points
//   o      a cylinder glued end to end                Length and Twist     the swap takes the loop across
//   **  *x  22*   cuff view / arc view               Length               pop and merge turn one into the other
//   *2222  a strip between two more mirrors           Length               the flip takes the other pair of mirrors
//   22x  xx  2*22                                     Length               no move
//
// A flat decomposition is D = { mode: 'flat', family, view, cuts: { c0 }, pts }; pts names the four half-turn points
// of 2222 as they sit on the cylinder (bottom two, top two), so that the flip can take the pairings in turn.

import { wrapHalf, I3 } from './h2.js';

const TAU = 2 * Math.PI;
export const FAMILIES = {
  2222: { area: 8, len: 4, views: ['cuff'], twist: true },
  o: { area: 4, len: 2, views: ['cuff'], twist: true },
  '**': { area: 8, len: 4, views: ['cuff', 'arc'] },
  '*x': { area: 8, len: 4, views: ['cuff', 'arc'] },
  '22*': { area: 8, len: 4, views: ['cuff', 'arc'] },
  '22x': { area: 8, len: 4, views: ['cuff'] },
  xx: { area: 8, len: 4, views: ['cuff'] },
  '*2222': { area: 4, len: 2, views: ['arc'] },
  '2*22': { area: 4, len: 2, views: ['arc'] },
};

export function flatDecomp(family, view) {
  const F = FAMILIES[family];
  if (!F) throw new Error('flatDecomp: no such family ' + family);
  const v = F.views.includes(view) ? view : F.views[0];
  const D = { mode: 'flat', family, view: v, cuts: { c0: { id: 'c0', type: v } } };
  if (family === '2222') D.pts = ['n0', 'n1', 'n2', 'n3'];
  return D;
}
export const flatTwist = (D) => !!FAMILIES[D.family].twist;
/** The length the cut has at first, in this view (the other view's default is the same shape). */
export function flatDefaults(D) {
  const F = FAMILIES[D.family], len = D.view === F.views[0] ? F.len : otherLen(D.family, F.len);
  return { c0: F.twist ? { len, tw: 0 } : { len } };
}
/**
 * The other view's length for this view's: a cylinder len round and h high is a strip h wide between its two mirrors
 * (**), or a strip 2 h wide and len / 2 tall lying across it (22*, *x). Both formulas are their own inverses.
 */
const otherLen = (family, len) => (family === '**' ? 1 : 2) * FAMILIES[family].area / len;

/** The parts buildAtlas('E', ...) takes. */
export function flatParts(D, params) {
  const F = FAMILIES[D.family], p = params.c0, len = p.len, h = F.area / len, tw = p.tw || 0;
  const one = (spec, glue) => [{ id: 'flat', spec, glue, cut: ['c0', 'c0'] }];
  const fold = (t) => ({ type: 'fold', twist: t }), cap = (c) => ({ type: 'cap', cap: c }), self = (k, extra = {}) => ({ type: 'pair', part: 0, end: k, ...extra });
  if (D.view === 'cuff') {
    const A = { kind: 'A', len, h, halves: D.family === 'o' ? 1 : 2 };
    switch (D.family) {
      case '2222': return one(A, [fold(0), fold(tw)]);
      case 'o': return one(A, [self(1, { twist: tw }), self(0, { twist: tw })]);
      case '**': return one(A, [cap('*'), cap('*')]);
      case '*x': return one(A, [cap('*'), cap('x')]);
      case '22*': return one(A, [fold(0), cap('*')]);
      case '22x': return one(A, [fold(0), cap('x')]);
      case 'xx': return one(A, [cap('x'), cap('x')]);
      default: throw new Error('flatParts: ' + D.family + ' has no cuff view');
    }
  }
  const R = { kind: 'R', len, h };
  switch (D.family) {
    case '**': return one(R, [self(1), self(0)]);
    case '*x': return one(R, [self(1, { flip: true }), self(0, { flip: true })]);
    case '22*': return one(R, [{ type: 'half' }, { type: 'half' }]);
    case '*2222': return one(R, [{ type: 'mirror' }, { type: 'mirror' }]);
    case '2*22': return one(R, [{ type: 'half' }, { type: 'mirror' }]);
    default: throw new Error('flatParts: ' + D.family + ' has no arc view');
  }
}

/** Which moves the one cut offers. */
export function flatMoves(D) {
  if (D.family === '2222') return [{ kind: 'A', label: 're-pair its four neighbours' }];
  if (D.family === 'o') return [{ kind: 'S', label: 'swap the handle loop' }];
  if (D.family === '*2222') return [{ kind: 'F', label: 'flip to the other diagonal' }];
  if (FAMILIES[D.family].views.length === 2) return [D.view === 'cuff' ? { kind: 'pop', label: 'open into an arc' } : { kind: 'merge', label: 'close into a cuff' }];
  return [];
}

const rotBy = (c, s, tx0 = 0, ty0 = 0) => [c, -s, tx0, s, c, ty0, 0, 0, 1];
/** The shortest of f(n) over whole n in a class (n = start, start +- step, ...), which has one minimum. */
function shortestIn(f, start, step) {
  let n = start, best = f(start);
  for (const dir of [1, -1]) for (let m = start + dir * step; Math.abs(m) <= 40; m += dir * step) { const l = f(m); if (l < best - 1e-12) { best = l; n = m; } else break; }
  return n;
}

/**
 * A flat move: { D, params, chart, info }. chart carries the NEW piece's chart into the old one's, so that the
 * pattern can be left where it was.
 */
export function flatMove(D0, params0, kind) {
  const D = JSON.parse(JSON.stringify(D0)), F = FAMILIES[D.family], p = params0.c0, len = p.len, h = F.area / len, tw = p.tw || 0;
  const want = kind || (flatMoves(D)[0] || {}).kind;
  if (!flatMoves(D).some((m) => m.kind === want)) throw new Error('move: the cut offers no such move');
  if (D.family === 'o') {
    // the lattice: u = (len, 0) along the cut, v = (-tw len, h) across it. The new cut: the shortest v + n u
    const u = [len, 0], v = [-tw * len, h];
    const n = shortestIn((m) => Math.hypot(v[0] + m * u[0], v[1] + m * u[1]), 0, 1), w = [v[0] + n * u[0], v[1] + n * u[1]];
    const L = Math.hypot(w[0], w[1]), c = w[0] / L, s = w[1] / L;
    return { D, params: { c0: { len: L, tw: wrapHalf((u[0] * c + u[1] * s) / L) } }, chart: rotBy(c, s), info: { kind: 'S', n, len: L, cuts: ['c0'] } };
  }
  if (D.family === '2222') {
    // half-turn points: 0, p = (len / 2, 0) below; q = (-tw len, h), q + p above. The new cut runs from 0 to a point above
    const P = [len / 2, 0], Q = [-tw * len, h];
    // which point above: the three pairings of the four points in turn (by their names)
    const [a0, a1, b0, b1] = D.pts, sorted = D.pts.slice().sort(), first = sorted[0];
    const partner = { [a0]: a1, [a1]: a0, [b0]: b1, [b1]: b0 }, cur = sorted.indexOf(partner[first]) - 1;
    const after = (top) => { const m = { [a0]: top, [top]: a0 }, rest = D.pts.filter((x) => x !== a0 && x !== top); m[rest[0]] = rest[1]; m[rest[1]] = rest[0]; return sorted.indexOf(m[first]) - 1; };
    const parity = after(b0) === (cur + 1) % 3 ? 0 : 1;
    const n = shortestIn((m) => Math.hypot(Q[0] + m * P[0], Q[1] + m * P[1]), parity, 2), w = [Q[0] + n * P[0], Q[1] + n * P[1]];
    const half = Math.hypot(w[0], w[1]), L = 2 * half, c = w[0] / half, s = w[1] / half;
    // new points: 0 and w below; -p (which is a1) and w - p above
    D.pts = [a0, parity ? b1 : b0, a1, parity ? b0 : b1];
    return { D, params: { c0: { len: L, tw: wrapHalf((P[0] * c + P[1] * s) / L) } }, chart: rotBy(c, s), info: { kind: 'A', n, len: L, cuts: ['c0'] } };
  }
  if (D.family === '*2222') return { D, params: { c0: { len: h } }, chart: rotBy(0, 1, len, 0), info: { kind: 'F', len: h, cuts: ['c0'] } };
  if (F.views.length === 2) {
    const toArc = D.view === 'cuff';
    D.view = toArc ? 'arc' : 'cuff'; D.cuts.c0.type = D.view;
    if (D.family === '**') {
      // cylinder len x h, mirrors below and above  <->  strip h wide and len tall
      const chart = toArc ? [0, 1, 0, -1, 0, h, 0, 0, 1] : [0, -1, len, 1, 0, 0, 0, 0, 1];
      return { D, params: { c0: { len: h } }, chart, info: { kind: toArc ? 'pop' : 'merge', len: h, cuts: ['c0'] } };
    }
    if (toArc) {
      // cylinder len x h  ->  strip 2 h wide and len / 2 tall, lying across the cylinder
      const chart = D.family === '22*' ? [0, -1, 0, 1, 0, -h, 0, 0, 1] : [0, -1, 0, 1, 0, 0, 0, 0, 1];
      return { D, params: { c0: { len: 2 * h } }, chart, info: { kind: 'pop', len: 2 * h, cuts: ['c0'] } };
    }
    // strip len wide and h tall  ->  cylinder 2 h round and len / 2 high: the inverse of the above
    const H2 = len / 2, chart = D.family === '22*' ? [0, 1, H2, -1, 0, 0, 0, 0, 1] : [0, 1, 0, -1, 0, 0, 0, 0, 1];
    return { D, params: { c0: { len: 2 * h } }, chart, info: { kind: 'merge', len: 2 * h, cuts: ['c0'] } };
  }
  throw new Error('move: nothing to do');
}
export { TAU, I3 };
