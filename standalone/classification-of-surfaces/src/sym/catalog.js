// catalog.js — the examples of the Symmetries tab: signatures and the tile each one is built from.
//
// A FAMILY turns a few numbers into a tile (domains.js) and into the signature's characters ("tokens"):
//   { t: 'o' | '*' | 'x' }            a wonder-ring, a kaleidoscope's star, a miracle's cross
//   { t: 'd', v, p }                  a digit; p = which of the family's numbers it shows (the reader can change it)
// An example is a family with its numbers, written as plain text: "*632", "3*3", "22x", "oo" (* for the star, x for
// the cross, o for the ring). fromText() reads such a text; PRESETS lists the ones the page offers.
// The signature is never trusted: bind() compares the characters with what orbifold.js reads off the tile's glued
// edges and says which corner class, boundary, handle or crosscap each character stands for.

import { half, regular, mirrorAndMiracle, crossSphere, hemisphere, spindle } from './domains.js';

const TAU = 2 * Math.PI;
const O = { t: 'o' }, S = { t: '*' }, X = { t: 'x' };
const d = (v, p) => ({ t: 'd', v, p });
const all = (n, l) => new Array(n).fill(l);

export const FAMILIES = {
  hemi: { make: () => hemisphere(), tokens: () => [S] },
  lune: { make: ([n]) => half([n, 1, n, 1], all(4, 'm')), tokens: ([n]) => [S, d(n, 0), d(n, 0)] },
  kal: { make: (v) => half(v, all(v.length, 'm')), tokens: (v) => [S, ...v.map(d)] },
  spin: { make: ([n]) => spindle(n), tokens: ([n]) => [d(n, 0), d(n, 0)] },
  rot: { make: (v) => half(v, all(v.length, 's')), tokens: (v) => v.map(d) },
  gyro1: { make: ([p]) => half([p, 2, 2], ['s', 'm', 's']), tokens: ([p]) => [d(p, 0), S] },
  gyro: { make: ([p, q]) => half([p, 2, 2 * q], ['s', 'm', 's']), tokens: ([p, q]) => [d(p, 0), S, d(q, 1)] },
  paa: { make: ([p, a]) => half([2, a, 2, p], ['m', 'm', 's', 's']), tokens: ([p, a]) => [d(p, 0), S, d(a, 1), d(a, 1)] },
  pqs: { make: ([p, q]) => half([p, q, 2, 2], ['s', 's', 'm', 's']), tokens: ([p, q]) => [d(p, 0), d(q, 1), S] },
  pqx: { make: ([p, q]) => half([p, q, 2, 2], ['s', 's', 'g', 's']), tokens: ([p, q]) => [d(p, 0), d(q, 1), X] },
  ann0: { make: () => half([2, 2, 2, 2], ['m', 's', 'm', 's']), tokens: () => [S, S] },
  ann1: { make: ([a]) => half([2 * a, 2, 2, 2], ['m', 's', 'm', 's']), tokens: ([a]) => [S, d(a, 0), S] },
  pants: { make: () => half(all(6, 2), ['m', 's', 'm', 's', 'm', 's']), tokens: () => [S, S, S] },
  tor: { make: () => regular('a b a- b-', TAU / 4), tokens: () => [O] },
  torn: { make: ([n]) => regular('a b a- b-', TAU / (4 * n)), tokens: ([n]) => [O, d(n, 0)] },
  oo: { make: () => regular('a b a- b- c d c- d-', TAU / 8), tokens: () => [O, O] },
  klein: { make: () => regular('a a b b', TAU / 4), tokens: () => [X, X] },
  kleinn: { make: ([n]) => regular('a a b b', TAU / (4 * n)), tokens: ([n]) => [d(n, 0), X, X] },
  xxx: { make: () => regular('a a b b c c', TAU / 6), tokens: () => [X, X, X] },
  cm: { make: () => mirrorAndMiracle(), tokens: () => [S, X] },
  x1: { make: () => crossSphere(1), tokens: () => [X] },
  nx: { make: ([n]) => crossSphere(n), tokens: ([n]) => [d(n, 0), X] },
};

/** An example from its plain-text signature, or null: { family, params, text }. */
export function fromText(text) {
  const s = String(text || '').trim().replace(/[∗＊]/g, '*').replace(/[×✕]/g, 'x').replace(/[○◦∘]/g, 'o');
  const D = (ch) => Number(ch), ex = (family, params) => ({ family, params, text: toText(FAMILIES[family].tokens(params)) });
  let m;
  if (s === '*') return ex('hemi', []);
  if ((m = /^\*([2-9])\1$/.exec(s))) return ex('lune', [D(m[1])]);
  if ((m = /^\*([2-9]{3,6})$/.exec(s))) return ex('kal', [...m[1]].map(D));
  if ((m = /^([2-9])\1$/.exec(s))) return ex('spin', [D(m[1])]);
  if ((m = /^([2-9]{3,6})$/.exec(s))) return ex('rot', [...m[1]].map(D));
  if ((m = /^([2-9])\*$/.exec(s))) return ex('gyro1', [D(m[1])]);
  if ((m = /^([2-9])\*([2-9])$/.exec(s))) return ex('gyro', [D(m[1]), D(m[2])]);
  if ((m = /^([2-9])\*([2-9])\2$/.exec(s))) return ex('paa', [D(m[1]), D(m[2])]);
  if ((m = /^([2-9])([2-9])\*$/.exec(s))) return ex('pqs', [D(m[1]), D(m[2])]);
  if ((m = /^([2-9])([2-9])x$/.exec(s))) return ex('pqx', [D(m[1]), D(m[2])]);
  if (s === '**') return ex('ann0', []);
  if ((m = /^\*([2-9])\*$/.exec(s))) return ex('ann1', [D(m[1])]);
  if (s === '***') return ex('pants', []);
  if (s === 'o') return ex('tor', []);
  if ((m = /^o([2-9])$/.exec(s))) return ex('torn', [D(m[1])]);
  if (s === 'oo') return ex('oo', []);
  if (s === 'xx') return ex('klein', []);
  if ((m = /^([2-9])xx$/.exec(s))) return ex('kleinn', [D(m[1])]);
  if (s === 'xxx') return ex('xxx', []);
  if (s === '*x') return ex('cm', []);
  if (s === 'x') return ex('x1', []);
  if ((m = /^([2-9])x$/.exec(s))) return ex('nx', [D(m[1])]);
  return null;
}
export const toText = (tokens) => tokens.map((k) => (k.t === 'd' ? String(k.v) : k.t)).join('');
export const toPretty = (tokens) => tokens.map((k) => (k.t === 'd' ? String(k.v) : k.t === '*' ? '∗' : k.t === 'x' ? '×' : '○')).join('');

/** The example one step away: the family's number p changed by delta (2 .. 9), or null. */
export function stepParam(example, p, delta) {
  const v = example.params[p] + delta;
  if (!(v >= 2 && v <= 9)) return null;
  const params = example.params.slice();
  params[p] = v;
  return { family: example.family, params, text: toText(FAMILIES[example.family].tokens(params)) };
}

export const PRESETS = [
  { group: 'S', title: 'On the sphere', list: ['*532', '532', '*432', '432', '*332', '332', '3*2', '*225', '225', '2*5', '*55', '55', '5*', '5x', '*', 'x'] },
  { group: 'E', title: 'On the plane', list: ['*632', '632', '*442', '442', '4*2', '*333', '333', '3*3', '*2222', '2222', '2*22', '22*', '22x', '**', '*x', 'xx', 'o'] },
  { group: 'H', title: 'On the hyperbolic plane', list: ['*732', '732', '*642', '4*3', '*3333', '*2223', '2223', '*22222', '23x', '*3*', '***', 'o2', 'xxx', 'oo'] },
];
export const ALL = PRESETS.flatMap((g) => g.list);

/**
 * Tie every character of a signature to what the tile's analysis found (orbifold.js analyse). Returns one entry per
 * token: { t: 'o', k } the k-th handle, { t: 'x', k } the k-th crosscap, { t: '*', star } a boundary,
 * { t: 'd', role: 'cone' | 'corner', cls, star? } a corner class. Throws if the signature is not the tile's.
 */
export function bind(tokens, A) {
  const out = new Array(tokens.length).fill(null);
  let i = 0, o = 0, x = 0;
  while (i < tokens.length && tokens[i].t === 'o') { out[i] = { t: 'o', k: o++ }; i++; }
  const coneIdx = [];
  while (i < tokens.length && tokens[i].t === 'd') coneIdx.push(i++);
  const groups = [];
  while (i < tokens.length && tokens[i].t === '*') {
    const g = { at: i, digits: [] };
    i++;
    while (i < tokens.length && tokens[i].t === 'd') g.digits.push(i++);
    groups.push(g);
  }
  while (i < tokens.length && tokens[i].t === 'x') { out[i] = { t: 'x', k: x++ }; i++; }
  if (i !== tokens.length) throw new Error('bind: the signature is not in the order rings, digits, stars, crosses');
  if (o !== A.surface.o || x !== A.surface.x) throw new Error(`bind: the tile zips up to ${A.surface.o} handles and ${A.surface.x} crosscaps, the signature says ${o} and ${x}`);
  // cone points
  const free = A.cones.slice();
  for (const t of coneIdx) {
    const k = free.findIndex((id) => A.classes[id].n === tokens[t].v);
    if (k < 0) throw new Error('bind: no cone point of order ' + tokens[t].v);
    out[t] = { t: 'd', role: 'cone', cls: free[k] };
    free.splice(k, 1);
  }
  if (free.length) throw new Error('bind: the tile has cone points the signature does not list');
  // boundaries, each read round in either direction from any corner
  const left = A.stars.map((s, k) => k);
  for (const g of groups) {
    const want = g.digits.map((t) => tokens[t].v), m = want.length;
    let found = null;
    for (const k of left) {
      const have = A.stars[k].corners;
      if (have.length !== m) continue;
      if (m === 0) { found = { k, ids: [] }; break; }
      for (const dir of [1, -1]) for (let r = 0; r < m && !found; r++) {
        const ids = want.map((_, q) => have[(((r + dir * q) % m) + m) % m]);
        if (ids.every((id, q) => A.classes[id].n === want[q])) found = { k, ids };
      }
      if (found) break;
    }
    if (!found) throw new Error('bind: no boundary with corners ' + want.join(' '));
    left.splice(left.indexOf(found.k), 1);
    out[g.at] = { t: '*', star: found.k };
    g.digits.forEach((t, q) => { out[t] = { t: 'd', role: 'corner', cls: found.ids[q], star: found.k }; });
  }
  if (left.length) throw new Error('bind: the tile has a boundary the signature does not list');
  return out;
}
