// catalog.js — signatures, and the tile each one is built from.
//
// A SIGNATURE is data: { o, cones: [n, ...], stars: [[corner, ...], ...], x } (handles, cone points, boundaries each
// with its corners in order, crosscaps); all empty is a signature too (no symmetry: the whole sphere is one tile). As plain text it is "*632", "3*3", "22x", "oo2*3*x" (* for the star, x for
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

import { half, regular, mirrorAndMiracle, crossSphere, hemisphere, spindle, canonical, trivial } from './domains.js';
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
/** What the page can show: at most twelve places on the ball, at most six corners on a mirror, fourteen characters. Nothing at all is fine. */
const fits = (sig) => length(sig) <= 14 && room(sig) <= 12 && sig.stars.every((c) => c.length <= 6);
export const EMPTY = Object.freeze({ o: 0, cones: Object.freeze([]), stars: Object.freeze([]), x: 0 });
export const isEmpty = (sig) => length(sig) === 0;

/**
 * A signature from plain text ("22*3x"), or null. A ring next to a cross is read as two more crosses (o x = x x x).
 * "1" is the empty signature, as the book writes it (a pattern with no symmetry but leaving it alone); so is "".
 */
export function parse(text) {
  const s = String(text == null ? '' : text).trim().replace(/[∗＊]/g, '*').replace(/[×✕]/g, 'x').replace(/[○◦∘]/g, 'o').replace(/^1$/, '');
  const m = /^(o*)([2-9]*)((?:\*[2-9]*)*)(x*)$/.exec(s);
  if (!m) return null;
  const sig = { o: m[1].length, cones: [...m[2]].map(Number), stars: m[3] ? m[3].split('*').slice(1).map((d) => [...d].map(Number)) : [], x: m[4].length };
  if (sig.o && sig.x) { sig.x += 2 * sig.o; sig.o = 0; }
  return fits(sig) ? sig : null;
}
export const textOf = (sig) => 'o'.repeat(sig.o) + sig.cones.join('') + sig.stars.map((c) => '*' + c.join('')).join('') + 'x'.repeat(sig.x);
/** The same for an address: the empty signature is written 1. */
export const linkOf = (sig) => textOf(sig) || '1';
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
// ---- one signature, many spellings (the book, pp. 231-232, "Which signatures are really the same?"): the digits
// before the star may be written in any order; a star's digits may be read from any of them, and backwards (all
// stars at once if there is no cross to turn one over alone); the stars may come in any order. canon() picks one
// spelling: larger numbers first, as the book writes its plane types ("using *632 rather than *236", p. 30).
const larger = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i] === undefined) return 1; if (b[i] === undefined) return -1; if (a[i] !== b[i]) return b[i] - a[i]; } return 0; };   // sorts the larger reading first
const round = (c) => (c.length ? c.map((_, r) => c.slice(r).concat(c.slice(0, r))).sort(larger)[0] : []);                  // a ring of digits, read from where it reads largest
const lists = (a, b) => { for (let i = 0; i < a.length; i++) { const d = larger(a[i], b[i]); if (d) return d; } return 0; };
export function canon(sig) {
  const flip = (c) => c.slice().reverse(), sorted = (stars) => stars.slice().sort(larger);
  const fwd = sorted(sig.stars.map(round)), back = sorted(sig.stars.map((c) => round(flip(c))));
  const each = sorted(sig.stars.map((c) => [round(c), round(flip(c))].sort(larger)[0]));
  const stars = sig.x > 0 || sig.stars.length <= 1 ? each : lists(fwd, back) <= 0 ? fwd : back;
  return { o: sig.o, cones: sig.cones.slice().sort((a, b) => b - a), stars, x: sig.x };
}
/** Are two signatures the same, written differently? */
export const sameAs = (a, b) => textOf(canon(a)) === textOf(canon(b));
let BOOK = null;
/** How the page writes a signature: as the book's own list has it where it is there (*225, not *522), else larger numbers first. */
export function spelled(sig) {
  if (!BOOK) { BOOK = new Map(); for (const t of ALL) BOOK.set(textOf(canon(parse(t))), t); }
  const c = textOf(canon(sig));
  return BOOK.get(c) || c;
}

/** The tile of a pattern with this signature, or null where no pattern has it. */
export function domainOf(sig) {
  if (isEmpty(sig)) return trivial();
  // a hand-made tile, looked for under every spelling (the characters shown are tied to it by bind(), whatever their order)
  const ex = fromText(textOf(sig)) || fromText(spelled(sig)) || fromText(textOf(canon(sig)));
  if (ex) return FAMILIES[ex.family].make(ex.params);
  if (fval(costOf(sig)) < 2) return null;          // under $2 and not one of the fourteen spherical types
  return canonical(sig);
}
/**
 * For a signature no pattern has: why, and the nearest ones that do have one. Under $2 only four shapes fail (the
 * book's proviso, pp. 53 and 57): one cone point, two of different orders, and the same two for the corners of one
 * mirror. Returns { kind: 'cone' | 'cones' | 'corner' | 'corners', m, n, tries: [{ text, how }] }, how = 'order'
 * (the same characters, a digit moved across the star), 'equal' (one digit changed) or 'more' (one character added).
 */
export function whyNot(sig) {
  if (domainOf(sig)) return null;
  const tries = [], seen = new Set([textOf(sig)]);
  const offer = (s, how) => { if (!s || !fits(s)) return; const t = spelled(s); if (seen.has(t) || !domainOf(s)) return; seen.add(t); tries.push({ text: t, how }); };
  const digits = sig.cones.concat(...sig.stars), mk = (cones, stars) => ({ o: sig.o, cones, stars, x: sig.x });
  // the same characters in another order: each digit before the star or after it
  if (sig.stars.length === 1 && digits.length <= 4) {
    for (let mask = 0; mask < 1 << digits.length; mask++) offer(mk(digits.filter((_, i) => mask & (1 << i)), [digits.filter((_, i) => !(mask & (1 << i)))]), 'order');
  }
  const star = sig.stars.length === 1, list = star ? sig.stars[0] : sig.cones, put = (l) => (star ? mk(sig.cones, [l]) : mk(l, sig.stars));
  if (list.length === 2) { offer(put([list[0], list[0]]), 'equal'); offer(put([list[1], list[1]]), 'equal'); offer(put([list[0], list[1], 2]), 'more'); }
  if (list.length === 1) { offer(put([list[0], list[0]]), 'more'); if (!star) { offer(mk(sig.cones, [[]]), 'more'); offer({ ...mk(sig.cones, []), x: 1 }, 'more'); } }
  return { kind: star ? (list.length === 1 ? 'corner' : 'corners') : list.length === 1 ? 'cone' : 'cones', m: list[0], n: list[1], tries };
}

/** What each character is, from the signature alone (for one that has no tile to compare with): as bind() answers, without the classes. */
export function structure(tokens) {
  return tokens.map((k) => (k.t === 'o' ? { t: 'o', k: k.ref.i } : k.t === 'x' ? { t: 'x', k: k.ref.i } : k.t === '*' ? { t: '*', star: k.ref.s }
    : k.ref.kind === 'cone' ? { t: 'd', role: 'cone', cls: null } : { t: 'd', role: 'corner', cls: null, star: k.ref.s }));
}

/**
 * The signature with one more thing, put in AFTER the character `at` (a ref; null: at the end; 'start': before
 * everything), as a typed character goes in after the cursor. kind:
 *   'o' | 'x'      a handle, a crosscap (their places in a signature are fixed: rings first, crosses last)
 *   'star'         a mirror: after the mirror the cursor is in, else last
 *   'cone'         a cone point of order `value`: after the cone point the cursor is on, else last (first at 'start')
 *   'corner'       a corner of order `value` on the mirror the cursor is in (after the corner it is on, first if it
 *                  is on the star itself), else at the end of the last mirror; null if there is no mirror
 *   'digit'        what a typed digit means where the cursor is: a corner if the cursor is in a mirror, a cone
 *                  point if it is among the rings and cone points or at the start; at the end (or on a cross) a
 *                  corner of the last mirror if there is one, else a cone point. So signatures can be typed as read.
 * A crosscap next to handles turns each handle into two crosscaps, and a handle next to a crosscap arrives as two
 * crosscaps (the trade of the Tidy surfaces tab, o x = x x x): `traded` says so. Returns { sig, ref, traded } with ref the new
 * character, or null where it cannot be added.
 */
export function addTo(sig, kind, at = null, value = 2) {
  const s = clone(sig), on = at && at !== 'start' ? at : null;
  let ref, traded = false;
  if (!(value >= 2 && value <= 9)) return null;
  if (kind === 'digit') kind = at === 'start' || (on && (on.kind === 'o' || on.kind === 'cone')) ? 'cone' : on && (on.kind === 'star' || on.kind === 'corner') ? 'corner' : s.stars.length ? 'corner' : 'cone';
  if (kind === 'o') { if (s.x) { s.x += 2; traded = true; ref = { kind: 'x', i: s.x - 1 }; } else { s.o++; ref = { kind: 'o', i: s.o - 1 }; } }
  else if (kind === 'x') { if (s.o) { s.x += 2 * s.o; s.o = 0; traded = true; } s.x++; ref = { kind: 'x', i: s.x - 1 }; }
  else if (kind === 'cone') {
    const pos = at === 'start' || (on && on.kind === 'o') ? 0 : on && on.kind === 'cone' ? on.i + 1 : s.cones.length;
    s.cones.splice(pos, 0, value);
    ref = { kind: 'cone', i: pos };
  } else if (kind === 'star') {
    const pos = at === 'start' ? 0 : on && (on.kind === 'star' || on.kind === 'corner') ? on.s + 1 : s.stars.length;
    s.stars.splice(pos, 0, []);
    ref = { kind: 'star', s: pos };
  } else if (kind === 'corner') {
    if (!s.stars.length) return null;
    const st = on && (on.kind === 'star' || on.kind === 'corner') ? on.s : s.stars.length - 1;
    const pos = on && on.kind === 'corner' ? on.i + 1 : on && on.kind === 'star' ? 0 : s.stars[st].length;
    s.stars[st].splice(pos, 0, value);
    ref = { kind: 'corner', s: st, i: pos };
  } else return null;
  return fits(s) ? { sig: s, ref, traded } : null;
}
/** The signature without the character `ref` (a star goes with its corners). The last one may go too: the empty signature. */
export function removeAt(sig, ref) {
  const s = clone(sig);
  if (ref.kind === 'o') s.o--; else if (ref.kind === 'x') s.x--; else if (ref.kind === 'cone') s.cones.splice(ref.i, 1);
  else if (ref.kind === 'star') {
    // As in a line of text: the star goes and its numbers stay, and they now belong to what stands before them, the
    // star before or the cone points (*632 without its star is 632: the mirrors gone, the turns kept). Where that
    // would pass the page's limits (six corners to a mirror), the star takes its numbers with it.
    const [corners] = s.stars.splice(ref.s, 1), kept = clone(s);
    if (ref.s > 0) kept.stars[ref.s - 1].push(...corners); else kept.cones.push(...corners);
    return corners.length && fits(kept) ? kept : s;
  } else s.stars[ref.s].splice(ref.i, 1);
  return s;
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
