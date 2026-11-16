// catalog.js — signatures, and the tile each one is built from.
//
// A SIGNATURE is data: { o, cones: [n, ...], stars: [[corner, ...], ...], x } (handles, cone points, boundaries each
// with its corners in order, crosscaps). As plain text it is "*632", "3*3", "22x", "oo2*3*x" (* for the star, x for
// the cross, o for the ring): parse() and textOf(). tokensOf() lists its characters:
//   { t: 'o' | '*' | 'x', ref }       a wonder-ring, a kaleidoscope's star, a miracle's cross
//   { t: 'd', v, ref }                a digit; ref says which cone point or which corner of which star it is
// The reader may change it freely: addTo(), removeAt(), stepAt().
//
// domainOf() finds its tile. Many signatures have a hand-made one (FAMILIES: the kaleidoscopes, the gyration
// groups, the 17 plane types, the 14 spherical ones ...); any other that costs $2 or more gets the general tile
// (domains.js canonical). One that costs less than $2 and is not among the fourteen spherical types has no pattern
// at all (the book's proviso, p. 53): domainOf() returns null.
// The signature is never trusted: bind() compares the characters with what orbifold.js reads off the tile's glued
// edges and says which corner class, boundary, handle or crosscap each character stands for.

import { half, regular, mirrorAndMiracle, crossSphere, hemisphere, spindle, canonical } from './domains.js';
import { frac, fadd, fval, PRICE } from './orbifold.js';

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

// ---------------------------------------------------------------------------------------------------------------
// A signature as data.

const clone = (sig) => ({ o: sig.o, cones: sig.cones.slice(), stars: sig.stars.map((c) => c.slice()), x: sig.x });
/** How many places it takes on the ball of the 3D pane (a handle takes two). */
export const room = (sig) => 2 * sig.o + sig.x + sig.cones.length + sig.stars.length;
const length = (sig) => sig.o + sig.x + sig.cones.length + sig.stars.reduce((s, c) => s + 1 + c.length, 0);
/** What the page can show: something, at most twelve places on the ball, at most six corners on a mirror, fourteen characters. */
const fits = (sig) => length(sig) >= 1 && length(sig) <= 14 && room(sig) <= 12 && sig.stars.every((c) => c.length <= 6);

/** A signature from plain text ("22*3x"), or null. A ring next to a cross is read as two more crosses (o x = x x x). */
export function parse(text) {
  const s = String(text || '').trim().replace(/[∗＊]/g, '*').replace(/[×✕]/g, 'x').replace(/[○◦∘]/g, 'o');
  const m = /^(o*)([2-9]*)((?:\*[2-9]*)*)(x*)$/.exec(s);
  if (!m || !s) return null;
  const sig = { o: m[1].length, cones: [...m[2]].map(Number), stars: m[3] ? m[3].split('*').slice(1).map((d) => [...d].map(Number)) : [], x: m[4].length };
  if (sig.o && sig.x) { sig.x += 2 * sig.o; sig.o = 0; }
  return fits(sig) ? sig : null;
}
export const textOf = (sig) => 'o'.repeat(sig.o) + sig.cones.join('') + sig.stars.map((c) => '*' + c.join('')).join('') + 'x'.repeat(sig.x);
export function tokensOf(sig) {
  const out = [];
  for (let i = 0; i < sig.o; i++) out.push({ t: 'o', ref: { kind: 'o', i } });
  sig.cones.forEach((v, i) => out.push({ t: 'd', v, ref: { kind: 'cone', i } }));
  sig.stars.forEach((c, s) => { out.push({ t: '*', ref: { kind: 'star', s } }); c.forEach((v, i) => out.push({ t: 'd', v, ref: { kind: 'corner', s, i } })); });
  for (let i = 0; i < sig.x; i++) out.push({ t: 'x', ref: { kind: 'x', i } });
  return out;
}
/** Its price as a fraction (Table 3.1 of the book). */
export function costOf(sig) {
  let c = frac(2 * sig.o + sig.x + sig.stars.length);
  for (const n of sig.cones) c = fadd(c, PRICE.cone(n));
  for (const st of sig.stars) for (const n of st) c = fadd(c, PRICE.corner(n));
  return c;
}
/** The tile of a pattern with this signature, or null where no pattern has it. */
export function domainOf(sig) {
  const ex = fromText(textOf(sig));
  if (ex) return FAMILIES[ex.family].make(ex.params);
  if (fval(costOf(sig)) < 2) return null;          // under $2 and not one of the fourteen spherical types
  return canonical(sig);
}
/** What each character is, from the signature alone (for one that has no tile to compare with): as bind() answers, without the classes. */
export function structure(tokens) {
  return tokens.map((k) => (k.t === 'o' ? { t: 'o', k: k.ref.i } : k.t === 'x' ? { t: 'x', k: k.ref.i } : k.t === '*' ? { t: '*', star: k.ref.s }
    : k.ref.kind === 'cone' ? { t: 'd', role: 'cone', cls: null } : { t: 'd', role: 'corner', cls: null, star: k.ref.s }));
}

/**
 * The signature with one more thing: kind 'o' | 'x' | 'cone' | 'star' | 'corner'. A corner goes on the star `at`
 * points into (after the corner it points at), else on the last star. A crosscap next to handles turns each handle
 * into two crosscaps, and a handle next to a crosscap arrives as two crosscaps (the trade of tab 2, o x = x x x):
 * `traded` says so. Returns { sig, ref, traded } with ref the new character, or null where it cannot be added.
 */
export function addTo(sig, kind, at = null) {
  const s = clone(sig);
  let ref, traded = false;
  if (kind === 'o') { if (s.x) { s.x += 2; traded = true; ref = { kind: 'x', i: s.x - 1 }; } else { s.o++; ref = { kind: 'o', i: s.o - 1 }; } }
  else if (kind === 'x') { if (s.o) { s.x += 2 * s.o; s.o = 0; traded = true; } s.x++; ref = { kind: 'x', i: s.x - 1 }; }
  else if (kind === 'cone') { s.cones.push(2); ref = { kind: 'cone', i: s.cones.length - 1 }; }
  else if (kind === 'star') { s.stars.push([]); ref = { kind: 'star', s: s.stars.length - 1 }; }
  else if (kind === 'corner') {
    if (!s.stars.length) return null;
    const st = at && (at.kind === 'star' || at.kind === 'corner') ? at.s : s.stars.length - 1;
    const pos = at && at.kind === 'corner' && at.s === st ? at.i + 1 : s.stars[st].length;
    s.stars[st].splice(pos, 0, 2);
    ref = { kind: 'corner', s: st, i: pos };
  } else return null;
  return fits(s) ? { sig: s, ref, traded } : null;
}
/** The signature without the character `ref` (a star goes with its corners), or null if nothing would be left. */
export function removeAt(sig, ref) {
  const s = clone(sig);
  if (ref.kind === 'o') s.o--; else if (ref.kind === 'x') s.x--; else if (ref.kind === 'cone') s.cones.splice(ref.i, 1);
  else if (ref.kind === 'star') s.stars.splice(ref.s, 1); else s.stars[ref.s].splice(ref.i, 1);
  return length(s) >= 1 ? s : null;
}
/**
 * The signature with the digit `ref` one more or one less (2 .. 9), or null. In NN and *NN the two digits go
 * together: on a sphere two cone points, or the two corners of one mirror, must have the same order.
 */
export function stepAt(sig, ref, delta) {
  const s = clone(sig), list = ref.kind === 'cone' ? s.cones : ref.kind === 'corner' ? s.stars[ref.s] : null;
  if (!list) return null;
  const v = list[ref.i] + delta;
  if (!(v >= 2 && v <= 9)) return null;
  const alone = length(s) === (ref.kind === 'cone' ? 2 : 3) && list.length === 2 && list[0] === list[1];
  if (alone) { list[0] = v; list[1] = v; } else list[ref.i] = v;
  return s;
}
/** The index of the token that `ref` names. */
export const tokenAt = (tokens, ref) => tokens.findIndex((k) => k.ref.kind === ref.kind && (k.ref.i === ref.i || ref.i === undefined) && (k.ref.s === ref.s || ref.s === undefined));

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
