// custom.js — a typed signature as one of this page's families (the text field after the chips). Pure: no DOM, no engine.
//
// The page cuts an orbifold between two pairs of FEATURES, so it takes exactly four of them. A feature is
//   a cone point          a digit before any star
//   a mirror              a star, with the digits after it as its corners
//   a crosscap            a cross
//   one side of a handle  a ring is two features, o+ and o-
// The engine (handles.js) builds four shapes of orbifold, with any orders 2 .. 9 in them:
//   four cone points                          2345     mode 'cones'
//   three cone points and a mirror            234*     mode 'cone-star'
//   three cone points, a mirror, one corner   234*5    mode 'cone-star3'
//   three cone points and a crosscap          234x     mode 'cone-x'
//   a handle and two cone points              o23      mode 'handle'
// (2222 alone is flat: the page's own Euclidean family, which handles.js knows by name.)
//
// Since Thu 26 Nov 2026 the page shows every other signature too (his ask: "allow modifying more orbifolds, more
// than just 2 pairs ones like 2222 … Also support other orbifolds which don't have these parameters. In that case,
// the pair controls are just disabled"):
//   five or six cone points                   22233    mode 'multi' (multi.js): a cut, a Length and a Twist a pair
//   any other signature that has a pattern    237, ∗2222, 3∗3, oo    mode 'still': the Classification of Surfaces
//                                             page's pattern and surface, with the pair controls switched off
// What is left has no pattern at all (one cone point alone, two of different orders): whyNot() says so.
//
// The signature's grammar is the Classification of Surfaces page's (catalog.js parse); readSignature() takes it as
// people type it.

import { parse, textOf, tokensOf, tokenAt, domainOf, whyNot as noPattern } from '../../classification-of-surfaces/src/sym/catalog.js';
import { multiSpec } from './multi.js';

/**
 * A signature as people type it, or null for what is none: spaces and commas anywhere; ∗ or *; × or x or X; ○ or o
 * or O or 0; and the rings and crosses wherever they were put (their place says nothing: catalog.js writes rings
 * first and crosses last). What is left must read as digits 2 .. 9, then stars, each with its digits. Nothing typed
 * is the empty signature.
 */
export function readSignature(text) {
  const s = String(text == null ? '' : text).replace(/[\s,;·]+/g, '').replace(/[∗＊⋆✱]/g, '*').replace(/[×✕✖X]/g, 'x').replace(/[○◦∘◯oO0]/g, 'o');
  if (!/^[2-9*xo]*$/.test(s)) return null;
  const count = (ch) => s.split(ch).length - 1;
  return parse('o'.repeat(count('o')) + s.replace(/[ox]/g, '') + 'x'.repeat(count('x')));
}

/** What was typed as catalog.js writes it ("3 3 3 ∗ 3" is "333*3"), or null for what is no signature. */
export const canonText = (text) => { const sig = readSignature(text); return sig ? textOf(sig) : null; };

/** The features of a signature, in reading order: rings (two each), cone points, mirrors, crosses. */
export function featuresOf(sig) {
  const out = [];
  for (let i = 0; i < sig.o; i++) out.push({ t: 'o', side: '+' }, { t: 'o', side: '-' });
  for (const n of sig.cones) out.push({ t: 'cone', n });
  for (const corners of sig.stars) out.push({ t: 'star', corners: corners.slice() });
  for (let i = 0; i < sig.x; i++) out.push({ t: 'x' });
  return out;
}

/** A feature as the page writes it on a button: 3, ∗, ∗5, ×, o⁺, o⁻. */
export const featureLabel = (f) => (f.t === 'cone' ? String(f.n) : f.t === 'star' ? '∗' + f.corners.join('') : f.t === 'x' ? '×' : f.side === '+' ? 'o⁺' : 'o⁻');

/** A signature as the page's chips write it: 234∗5, 234×, o23. */
export const prettyOf = (sig) => 'o'.repeat(sig.o) + sig.cones.join('') + sig.stars.map((c) => '∗' + c.join('')).join('') + '×'.repeat(sig.x);

/**
 * What handles.js needs to build a signature, or null where it cannot:
 *   { k, label, mode, baseOrders, featLabels, featIdx?, corner? }
 * The features are numbered as the engine's own families number them: the cuff second among three cone points
 * (333∗ is 3, ∗, 3, 3), the two sides of the handle first (o33 is o⁺, o⁻, 3, 3).
 */
export function specOf(sig) {
  if (!sig) return null;
  const c = sig.cones, k = textOf(sig), label = prettyOf(sig);
  const cuffs = sig.o + sig.stars.length + sig.x;
  if (cuffs === 0 && c.length === 4) {
    if (c.every((n) => n === 2)) return null;          // flat: the Euclidean 2222
    return { k, label, mode: 'cones', baseOrders: c.slice(), featLabels: c.map(String) };
  }
  if (cuffs !== 1) return null;
  if (sig.o === 1 && c.length === 2) return { k, label, mode: 'handle', baseOrders: [0, 0, c[0], c[1]], featLabels: ['o⁺', 'o⁻', String(c[0]), String(c[1])] };
  if (c.length !== 3) return null;
  const base = { k, label, baseOrders: [c[0], 0, c[1], c[2]], featIdx: 1 };
  if (sig.x === 1) return { ...base, mode: 'cone-x', featLabels: [String(c[0]), '×', String(c[1]), String(c[2])] };
  if (sig.stars.length === 1) {
    const corners = sig.stars[0];
    if (corners.length === 0) return { ...base, mode: 'cone-star', featLabels: [String(c[0]), '∗', String(c[1]), String(c[2])] };
    if (corners.length === 1) return { ...base, mode: 'cone-star3', corner: corners[0], featLabels: [String(c[0]), '∗' + corners[0], String(c[1]), String(c[2])] };
  }
  return null;
}

/** The same from text as typed ("234*5", "234∗5", "2 3 4 x"); null for what is no signature or what the engine cannot build. */
export const customSpec = (text) => specOf(readSignature(text));

/**
 * How many numbers an orbifold's shape has (the dimension of its space of shapes): 3 for each handle and crosscap
 * beyond a sphere, 2 for each cone point, 1 for each corner, counted as -3 chi + 2 cones + corners with chi the
 * Euler characteristic of the surface under it (a mirror is a hole). 0 or less: rigid.
 */
export function movesOf(sig) {
  // on the plane a pattern's size is no shape, and a torus, a Klein bottle, a band keep numbers the count below misses
  const flat = { o: 2, xx: 1, '**': 1, '*x': 1, 2222: 2, '*2222': 1, '22*': 1, '22x': 1, '2*22': 1 }[textOf(sig)];
  if (flat !== undefined) return flat;
  const corners = sig.stars.reduce((s, c) => s + c.length, 0);
  return Math.max(0, -3 * (2 - 2 * sig.o - sig.x - sig.stars.length) + 2 * sig.cones.length + corners);
}

/**
 * A signature the page shows without pair controls: any that has a pattern (catalog.js domainOf) and is neither
 * four features of the engine's shapes nor five or six cone points.
 *   { k, label, mode: 'still', kind: 'S' | 'E' | 'H', featLabels, parts (for surface.js buildSurface), moves, rigid }
 */
export function stillSpec(sig) {
  if (!sig || featuresOf(sig).length === 0 || textOf(sig) === '2222' || specOf(sig) || multiSpec(sig)) return null;          // (nothing typed is no orbifold to show)
  let D = null;
  try { D = domainOf(sig); } catch (err) { D = null; }
  if (!D) return null;
  const parts = [];
  for (let i = 0; i < sig.o; i++) parts.push({ t: 'o' });
  for (const n of sig.cones) parts.push({ t: 'cone', n });
  for (const corners of sig.stars) parts.push({ t: 'star', corners: corners.slice() });
  for (let i = 0; i < sig.x; i++) parts.push({ t: 'x' });
  const featLabels = parts.map((p) => (p.t === 'cone' ? String(p.n) : p.t === 'star' ? '∗' + p.corners.join('') : p.t === 'x' ? '×' : 'o'));
  const moves = movesOf(sig);
  return { k: textOf(sig), label: prettyOf(sig), mode: 'still', kind: D.G.kind, featLabels, parts, moves, rigid: moves === 0 || D.G.kind === 'S' };
}

/** How the page shows a signature: 'pairs' (four features), 'multi' (five or six cone points), 'still', or null. */
export const kindOf = (sig) => (!sig ? null : textOf(sig) === '2222' || specOf(sig) ? 'pairs' : multiSpec(sig) ? 'multi' : stillSpec(sig) ? 'still' : null);
/** Does the page show this signature at all? */
export const shows = (sig) => !!kindOf(sig);

/**
 * Why the page cannot show a signature, and the nearest ones it can:
 *   { kind, m, n, tries: [text, ...] }
 * kind: 'empty'    nothing typed
 *       'cone'     one cone point alone (order m)          'cones'    two cone points of different orders (m, n)
 *       'corner'   a mirror with one corner alone          'corners'  a mirror with two corners of different orders
 *       'none'     no pattern, for another reason
 * (the four shapes the book's proviso leaves out: no pattern folds up to them). null where it can be shown.
 */
export function whyNot(sig) {
  if (!sig || shows(sig)) return null;
  if (featuresOf(sig).length === 0) return { kind: 'empty', tries: ['2345', '22233', '237', '*2222'] };
  let w = null;
  try { w = noPattern(sig); } catch (err) { w = null; }
  if (!w) return { kind: 'none', tries: [] };
  return { kind: w.kind, m: w.m, n: w.n, tries: w.tries.map((t) => t.text).filter((t) => shows(parse(t))).slice(0, 4) };
}

/**
 * Index in catalog.js `tokensOf(readSignature(text))` of the orbifold feature at the user's cursor `[selStart, selEnd]`
 * inside the loose text `text`, or `null` when empty, invalid, or spanning multiple features.
 */
export function cursorTokenIndex(text, selStart = null, selEnd = null) {
  const raw = String(text == null ? '' : text);
  if (!raw.trim()) return null;
  const sig = readSignature(raw);
  if (!sig) return null;
  const tokens = tokensOf(sig);
  if (!tokens.length) return null;

  const rawRefs = new Array(raw.length).fill(null);
  let oCount = 0, xCount = 0, coneIdx = 0, curStar = -1, cornerIdx = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (/[\s,;·]/.test(ch)) continue;
    if (/[○◦∘◯oO0]/.test(ch)) rawRefs[i] = { kind: 'o', i: oCount++ };
    else if (/[×✕✖xX]/.test(ch)) rawRefs[i] = { kind: 'x', i: xCount++ };
    else if (/[∗＊⋆✱*]/.test(ch)) {
      rawRefs[i] = { kind: 'star', s: ++curStar };
      cornerIdx = 0;
    } else if (/[2-9]/.test(ch)) {
      rawRefs[i] = curStar < 0
        ? { kind: 'cone', i: coneIdx++ }
        : { kind: 'corner', s: curStar, i: cornerIdx++ };
    } else {
      return null;
    }
  }

  let s0 = typeof selStart === 'number' && Number.isFinite(selStart) ? Math.max(0, Math.min(raw.length, selStart)) : raw.length;
  let s1 = typeof selEnd === 'number' && Number.isFinite(selEnd) ? Math.max(0, Math.min(raw.length, selEnd)) : s0;
  if (s1 < s0) [s0, s1] = [s1, s0];

  let rawIdx = -1;
  if (s1 > s0) {
    const inside = [];
    for (let i = s0; i < s1; i++) if (rawRefs[i]) inside.push(i);
    if (inside.length > 1) return null;
    if (inside.length === 1) rawIdx = inside[0];
  }
  if (rawIdx < 0) {
    if (s0 > 0 && rawRefs[s0 - 1]) rawIdx = s0 - 1;
    else if (s0 < raw.length && rawRefs[s0]) rawIdx = s0;
    else {
      for (let i = s0 - 1; i >= 0; i--) {
        if (rawRefs[i]) { rawIdx = i; break; }
      }
      if (rawIdx < 0) {
        for (let i = s0; i < raw.length; i++) {
          if (rawRefs[i]) { rawIdx = i; break; }
        }
      }
    }
  }
  if (rawIdx < 0 || !rawRefs[rawIdx]) return null;

  let ref = rawRefs[rawIdx];
  if (oCount > 0 && xCount > 0) {
    if (ref.kind === 'o') ref = { kind: 'x', i: Math.min(sig.x - 1, 2 * ref.i) };
    else if (ref.kind === 'x') ref = { kind: 'x', i: Math.min(sig.x - 1, 2 * oCount + ref.i) };
  }
  const idx = tokenAt(tokens, ref);
  return idx >= 0 ? idx : null;
}
