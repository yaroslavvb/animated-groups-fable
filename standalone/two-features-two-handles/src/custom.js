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
// Anything else gets its reason in its own numbers and the nearest signatures that do work: whyNot().
//
// The signature's grammar is the Classification of Surfaces page's (catalog.js parse); readSignature() takes it as
// people type it.

import { parse, textOf } from '../../2026-11-15-classification-of-surfaces/src/sym/catalog.js';

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

/** Does the page show this signature: one of the engine's shapes, or the flat 2222? */
export const shows = (sig) => !!sig && (textOf(sig) === '2222' || !!specOf(sig));

/**
 * Why the page cannot show a signature, and the nearest ones it can:
 *   { kind, count, tries: [text, ...] }
 * kind: 'empty'    nothing typed
 *       'few'      fewer than four features (count of them)
 *       'many'     more than four
 *       'corners'  four features, one of them a mirror with two or more corners
 *       'cuffs'    four features, more than one of them a mirror, a crosscap or a handle
 * null where it can be shown.
 */
export function whyNot(sig) {
  if (!sig || shows(sig)) return null;
  const feats = featuresOf(sig), count = feats.length;
  const tries = [], seen = new Set();
  const offer = (s) => { if (!s || !shows(s)) return; const t = textOf(s); if (!seen.has(t)) { seen.add(t); tries.push(t); } };
  const mk = (o, cones, stars, x) => ({ o, cones, stars, x });
  const twos = (n) => new Array(Math.max(0, n)).fill(2);
  if (count === 0) {
    for (const t of ['2345', '334*', '245*3', '237x', 'o25']) offer(parse(t));
    return { kind: 'empty', count, tries };
  }
  const cuffs = sig.o + sig.stars.length + sig.x;
  // the same cone points and ONE of its cuffs, filled up with half-turn points (or cut down) to four features
  const withOne = (o, stars, x) => {
    const room = 4 - 2 * o - stars.length - x;
    offer(mk(o, sig.cones.slice(0, room).concat(twos(room - sig.cones.length)), stars, x));
  };
  if (cuffs === 0) withOne(0, [], 0);
  if (sig.o) withOne(1, [], 0);
  for (const corners of sig.stars) { withOne(0, [corners.slice(0, 1)], 0); if (corners.length) withOne(0, [[]], 0); }
  if (sig.x) withOne(0, [], 1);
  const kind = count < 4 ? 'few' : count > 4 ? 'many' : cuffs > 1 ? 'cuffs' : 'corners';
  return { kind, count, tries: tries.slice(0, 4) };
}
