// state.js — the page's state for four cone points P, Q, R, S: presets and typed orders, the three partition
// cards, activation (a flip that moves nothing), the cut's numbers, the address, the two pillows in numbers.
// Pure: no DOM. It stands on the engine of Two features, two handles (handles.js), on flips.js and on pillow.js.
//
// WORDS
//   state      the engine's: { k, perm, orders, L, tw, b, tau, thetas, print } and, after a flip, tri (flips.js).
//              perm[slot] is the feature in slot A, B, C, D; A, B are the picked pair (drawn blue, below the loop in
//              space), C, D the far pair (orange, above). L, tw are the numbers of the CUT: the loop that parts them.
//              (2222: the engine's L is the picked pair's spacing, half the loop.)
//   feature    0..3 = P, Q, R, S: the digits of the signature in the order typed. A state never renames them.
//   partition  one of the three ways to pair the four: keys '01|23', '02|13', '03|12' (PQ|RS, PR|QS, PS|QR).
//   card       a partition with the Length and Twist its loop has: the numbers the engine would hold if that loop
//              were the cut. The three loops are the triangle of flips.js; the active card is the cut itself.
//
// A state is never changed in place: activate and withNumbers return another one (or the same, if nothing moved).
//
// WHICH LOOPS THE TWO INACTIVE CARDS SHOW. The triangle of flips.js, carried in state.tri through flips AND through
// slider moves: three loops that deform continuously. A flip keeps all three (a click on a card and a click back
// return the same numbers). A slider move keeps them too, except where the cut's Twist passes the value at which a
// loop and its twin are equally long: there the loop gives way to the twin (the Length continues, the Twist changes
// sign). A state that starts on its natural triangle (every preset does; in each pairing the shortest loop that
// meets the cut twice) therefore stays on the natural one, which changes at Twist 0. The naming of each inactive
// card's far pair, free by half a turn, is carried as well, so its Twist runs continuously through [-1/2, 1/2].
//
// EXPORTS (SPEC § 3.1)
//   PRESETS, CARD_KEYS, DEFAULT_UI
//   stateFor(text) -> state | null            four cone points of orders 2..9, at the engine's defaults
//   kindOf(state) -> 'H' | 'E'                featureOrder(state, f), featureName(f), featureLabel(state, f), keyOf(state)
//   cardsOf(state) -> [card, card, card]      in the fixed order of CARD_KEYS
//   activate(state, key) -> { state, invQ, Q, before, changed }
//   withNumbers(state, { L, tw }) -> state
//   toHash(state, ui) -> '#k=…'               fromHash(text) -> { state, ui } | null
//   pillowsOf(state) -> [pillow, pillow]      the first pair's, the second pair's
//   lengthRange(kind, L), lengthText(L), twistText(tw)

import { FAMILIES, normalizeFamilyKey, defaultCommas, retiePrint, linkedPrint } from '../../two-features-two-handles/src/handles.js';
import { I3 } from '../../classification-of-surfaces/src/sym/geom.js';
import { triangle, flip, pairingKey, triText, triFrom } from './flips.js';
import { orbifold, sMax } from './pillow.js';

const PI = Math.PI, TAU = 2 * PI;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** The chips of the page, in their order. */
export const PRESETS = ['2222', '3333', '2223', '2345', '4444'];
/** The three partitions, in the order of the cards: PQ|RS, PR|QS, PS|QR. */
export const CARD_KEYS = ['01|23', '02|13', '03|12'];
/**
 * The journey's stop and the turntable's view when the address says nothing. SPEC § 1.4 says az -20, el 14; the
 * integrator made it az 70 (27 Nov): the renderer's az 0 looks ALONG the pose's y axis, which is the first pair's
 * seal, so at -20 the doubled square of 3333 and the flat envelope of 2222 stood edge-on. 70 = 90 - 20: the seal
 * across the screen, P to the left, turned by the spec's 20 degrees (the view of Twist of 2222's solid).
 */
export const DEFAULT_UI = Object.freeze({ j: 0, az: 70, el: 14 });

// The Length slider's own range, and how far a Length may go at all. A flip can lead outside the slider's range
// (seen: 0.11 to 11.4 from 0.4 .. 7), so a card's range follows its number by 8 %, up to the outer limits.
const BASE_RANGE = { H: [0.4, 7], E: [0.5, 2] };
const HARD_RANGE = { H: [0.05, 16], E: [0.2, 5] };
const TW_RANGE = [-0.5, 0.5];

// ---- features, kinds ------------------------------------------------------------------------------------------------

/** 'P' | 'Q' | 'R' | 'S' for feature 0..3. */
export const featureName = (f) => 'PQRS'[f];
/** The order of feature f (0..3 = P, Q, R, S as typed). */
export const featureOrder = (state, f) => state.orders[state.perm.indexOf(f)];
/** A feature as the page writes it: the letter with its order, "P3". */
export const featureLabel = (state, f) => `${featureName(f)}${featureOrder(state, f)}`;
/** 'E' for 2222 (the plane), 'H' for every other four orders (the hyperbolic plane). */
export const kindOf = (state) => (state.orders.every((n) => n === 2) ? 'E' : 'H');
/** The active partition's key: the pairing of the state's own cut. */
export const keyOf = (state) => pairingKey([[state.perm[0], state.perm[1]], [state.perm[2], state.perm[3]]]);

const defaultThetas = (k) => defaultCommas(k).map((sp) => (sp ? sp.theta : 0));

/**
 * The state of four cone points as typed ("3333", "2 3 4 6", "2,2,2,2"): the engine's family for that signature at
 * its default numbers (the shape the Classification of Surfaces page draws). null for anything that is not four
 * digits 2..9. The key keeps the order typed: 2345 and 5432 are two families (P is the first digit typed).
 */
export function stateFor(text) {
  if (text == null) return null;
  const s = String(text).replace(/[\s,;·]+/g, '');
  if (!/^[2-9]{4}$/.test(s)) return null;
  let k = null;
  try { k = normalizeFamilyKey(s); } catch (err) { k = null; }
  const fam = k && FAMILIES[k];
  if (!fam || (fam.mode !== 'cones' && fam.mode !== 'pillow') || !/^[0-3]{4}$/.test(fam.defaultM || '')) return null;
  const perm = fam.defaultM.split('').map(Number);
  return { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L: fam.defaultL, tw: fam.defaultTw, b: 0, tau: 0, thetas: defaultThetas(k), print: null };
}

// ---- the cards ------------------------------------------------------------------------------------------------------

/**
 * The range of a Length slider that shows the Length L: [0.4, max(7, 1.08 L)] (2222: [0.5, max(2, 1.08 L)]), as
 * SPEC § 1.3 has it, with two additions for the Lengths a flip leads to: below the slider's own least the range
 * reaches 8 % under L, and the 8 % stop at the outer limits ([0.05, 16]; 2222: [0.2, 5]) unless L itself is beyond.
 */
export function lengthRange(kind, L) {
  const [b0, b1] = BASE_RANGE[kind] || BASE_RANGE.H, [h0, h1] = HARD_RANGE[kind] || HARD_RANGE.H;
  if (!(L > 0)) return [b0, b1];
  return [L >= b0 ? b0 : Math.min(L, Math.max(h0, 0.92 * L)), Math.max(b1, L, Math.min(h1, 1.08 * L))];
}

const sorted = (pair) => pair.slice().sort((a, b) => a - b);

/**
 * The three partition cards, in the FIXED order of CARD_KEYS (01|23, 02|13, 03|12), whichever is the cut.
 *   key      the pairing, "02|13"
 *   pairs    [[f, f], [f, f]]: pairs[0] is the pair that is picked (blue, below) once this card is active,
 *            pairs[1] the other (orange); each pair in increasing feature number (perm has the slot order)
 *   L, tw    the Length and Twist of this card's loop: the numbers the engine holds when it is the cut (the active
 *            card's are the state's own). 2222: L is the pair's spacing, half the loop
 *   length   the length of the closed curve (2 L on 2222)
 *   active   it is the cut;   minimal: it is no longer than its twin
 *   lRange   [lo, hi] for its Length slider (lengthRange);   twRange: [-0.5, 0.5]
 *   seals    [[p, q], [p, q]]: an arc joining the two cone points of pairs[0], one joining those of pairs[1]
 *   seg      one period of the loop's line, two points;   ends: its two points on the unit circle (2222: null,
 *            and dir its direction);   onTree: 'picked' | 'far' | null (a pair of 2s: the loop is that pair's seal
 *            run twice, and seg is that seal)
 *   id, index, perm, orders   'cut' | 'lo' | 'hi' in the triangle (these change places; the key does not), the
 *            loop's number, and the slots and orders of the state it leads to
 * Points are the engine's (hyperboloid [x, y, z]; plane [x, y, 1]) in the frame the engine draws THIS state in.
 */
export function cardsOf(state) {
  const tr = triangle(state), kind = tr.kind;
  return CARD_KEYS.map((key) => {
    const lp = tr.loops.find((l) => l.key === key);
    if (!lp) throw new Error(`state: the triangle has no loop for the partition ${key}`);
    return {
      key, pairs: [sorted(lp.pairing[0]), sorted(lp.pairing[1])],
      L: lp.L, tw: lp.tw, length: lp.length,
      active: lp.id === 'cut', minimal: lp.minimal,
      lRange: lengthRange(kind, lp.L), twRange: TW_RANGE.slice(),
      seals: lp.seals, seg: lp.seg, ends: lp.ends, dir: lp.dir, onTree: lp.onTree,
      id: lp.id, index: lp.index, perm: lp.perm.slice(), orders: lp.orders.slice(),
    };
  });
}

/** A partition named in any way ("13|02", [[0, 2], [1, 3]], two features [0, 2]) -> its key. Throws on what is none. */
function keyFrom(key) {
  let pairs = null;
  if (typeof key === 'string') {
    const m = /^([0-3])([0-3])\|([0-3])([0-3])$/.exec(key.trim());
    if (m) pairs = [[+m[1], +m[2]], [+m[3], +m[4]]];
  } else if (Array.isArray(key) && key.length === 2 && Array.isArray(key[0]) && Array.isArray(key[1])) pairs = key;
  else if (Array.isArray(key) && key.length === 2) pairs = [key, [0, 1, 2, 3].filter((f) => !key.includes(f))];
  const flat = pairs ? pairs.flat() : [];
  if (!pairs || pairs.some((pr) => pr.length !== 2) || flat.some((f) => !Number.isInteger(f) || f < 0 || f > 3) || new Set(flat).size !== 4) throw new Error(`state: no such partition: ${JSON.stringify(key)}`);
  return pairingKey(pairs);
}

/**
 * Make another partition the active one: a flip (flips.js), with the print tied anew to the new cut (the engine's
 * retiePrint, as page.js does after a pick). Nothing of the geometry changes.
 *   key      a card's key, "02|13" (any listing of the pairing will do)
 * Returns { state, invQ, Q, before, changed }:
 *   state    the new state; it carries the triangle (state.tri), so that activating the old key again returns the
 *            old numbers, and three activations round return home
 *   invQ, Q  Q takes the old state's frame to the new one's. The new pattern carried by invQ lies where the old
 *            one lay: the page sets view <- view . invQ (page.js pickPair), and nothing moves on the screen
 *   before   the state as it was;   changed: false when `key` is already the cut (then `state` IS the state given)
 */
export function activate(state, key) {
  const want = keyFrom(key);
  if (want === keyOf(state)) return { state, invQ: I3.slice(), Q: I3.slice(), before: state, changed: false };
  const r = flip(state, want), next = r.state;
  try { next.print = retiePrint(next, state); } catch (err) { next.print = state.print || null; }
  return { state: next, invQ: r.invQ, Q: r.Q, before: state, changed: true };
}

/** x brought into (-1/2, 1/2]: a Twist is read up to whole turns. */
const wrapTurn = (x) => x - Math.ceil(x - 0.5);

/**
 * The triangle's index once the cut's Twist has moved from tw0 to tw1: the SAME triangle (the same two other loops,
 * deformed), except that a loop which was no longer than its twin and now is longer gives way to that twin. Within
 * a pairing a loop's length grows with |tw + j / 2| (flips.js neighbour), so loop k is no longer than its twin
 * k + 2 when tw + k / 2 >= -1/2, and loop k + 1 no longer than its twin k - 1 when tw + k / 2 <= 0: the two are
 * equally long at the crossing, which is why the card's Length continues there. From a natural triangle this is
 * the natural triangle again (k = -1 for tw >= 0, k = 0 below). A loop that already was longer than its twin (the
 * cut a flip has just left, where that cut was long) stays: nothing jumps.
 */
function carriedIndex(k, tw0, tw1) {
  const E = 1e-12;
  for (let i = 0; i < 4; i++) {
    const lo = (tw) => tw + k / 2 >= -0.5 - E, hi = (tw) => tw + k / 2 <= E;
    if (lo(tw0) && !lo(tw1)) k += 1; else if (hi(tw0) && !hi(tw1)) k -= 1; else break;
  }
  return k;
}

/**
 * The moved state `next` (no triangle yet) with the far pairs of its two other loops named so that their Twists
 * CONTINUE those the cards of `state` showed. The triangle is the one carried (carriedIndex); for each of its
 * two other loops there are two ways to name the far pair, half a turn apart, and the one is taken whose Twist is
 * nearer (up to whole turns) to
 *   the Twist its card showed, if it is the same loop (the same number in the fan of loops that meet the cut twice);
 *   minus the Twist its card showed, if the card's loop has given way to its twin (at Twist 0 the twin is the
 *   mirror image: the Length continues, the Twist changes sign).
 */
function continued(state, next) {
  let before;
  try { before = triangle(state); } catch (err) { return next; }
  const was = new Map(before.loops.filter((lp) => lp.id !== 'cut').map((lp) => [lp.key, lp])), cap = (HARD_RANGE[before.kind] || HARD_RANGE.H)[1];
  let k = carriedIndex(before.k, state.tw, next.tw), named;
  try {
    for (let guard = 0; guard < 64; guard++) {
      named = [0, 1].map((parity) => triangle({ ...next, tri: { k, lo: parity, hi: parity } }));          // the two namings of each far pair
      // A loop longer than its twin is kept (it is the cut a flip has just left) only up to the longest Length the
      // page lets a cut have (16; 2222: 5): beyond it the twin takes its place. Without this bound a chain of flips
      // and drags could carry a card's loop further and further from the shortest of its pairing (seen in
      // dev/core/fuzz.mjs: Lengths of 92).
      const [, lo, hi] = named[0].loops;
      if (!lo.minimal && lo.L > cap) k += 1; else if (!hi.minimal && hi.L > cap) k -= 1; else break;
    }
  } catch (err) { return next; }
  const index = (id) => {
    const i = id === 'lo' ? 1 : 2, now = named[0].loops[i], old = was.get(now.key);
    if (!old) return null;
    const want = old.index === now.index ? old.tw : -old.tw, d = named.map((tr) => Math.abs(wrapTurn(tr.loops[i].tw - want)));
    return named[d[0] <= d[1] ? 0 : 1].tri[id] + 0;
  };
  return { ...next, tri: { k, lo: index('lo'), hi: index('hi'), L: next.L, tw: next.tw } };
}

/**
 * Move the cut's numbers: its Length, its Twist, or both. Clamped: the Length to the active card's range
 * (lengthRange of the Length the state has now; pass { lRange } to clamp to a range a slider holds through a drag),
 * the Twist to [-1/2, 1/2]. Returns the state itself when nothing moved.
 *
 * The other two cards CONTINUE: they keep their loops, and each loop's far pair keeps its naming, so their Lengths
 * and Twists move continuously under a drag (a Twist wraps by a whole turn at the ends of [-1/2, 1/2]). One thing
 * changes a card's loop: when the cut's Twist passes the value at which that loop and its twin are equally long (for
 * the natural triangle: Twist 0), the loop gives way to the twin: the Length continues, the Twist changes sign.
 * So from a natural triangle the cards are always the natural triangle's (in each pairing the shortest loop that
 * meets the cut twice). The state returned carries this as state.tri, stamped with the new numbers.
 */
export function withNumbers(state, { L, tw } = {}, { lRange = null } = {}) {
  const range = lRange || lengthRange(kindOf(state), state.L);
  const L1 = Number.isFinite(L) ? clamp(L, range[0], range[1]) : state.L;
  const tw1 = Number.isFinite(tw) ? clamp(tw, TW_RANGE[0], TW_RANGE[1]) : state.tw;
  if (L1 === state.L && tw1 === state.tw) return state;
  const { tri, ...rest } = state;
  return continued(state, { ...rest, L: L1, tw: tw1 });
}

// ---- the address ----------------------------------------------------------------------------------------------------
// #k=<sig>&m=<perm>&l=<L, 3 dec>&tw=<4 dec>[&tri=k.lo.hi][&j=<journey 0..2, 2 dec>][&v=<az>%2C<el>]
// "#" alone is 3333 at the engine's defaults. Only the characters [A-Za-z0-9_.=%&/-] are written.

/** A number as the address writes it: `dec` decimals at most, no trailing zeros, never "-0". */
const num = (x, dec) => { const n = Number(Number(x).toFixed(dec)); return Object.is(n, -0) || n === 0 ? '0' : String(n); };
/** A number read from the address that prints as the family's default IS the default. */
const snap = (v, def, dec) => (num(v, dec) === num(def, dec) ? def : v);
/** The Length and Twist a reload makes of the address's two texts (null where a text is no number). */
function numbersFrom(fam, lText, twText) {
  const hard = HARD_RANGE[fam.kind === 'E' ? 'E' : 'H'], l = parseFloat(lText), t = parseFloat(twText);
  return {
    L: Number.isFinite(l) ? snap(clamp(l, hard[0], hard[1]), fam.defaultL, 3) : null,
    tw: Number.isFinite(t) ? snap(clamp(t, TW_RANGE[0], TW_RANGE[1]), fam.defaultTw, 4) : null,
  };
}
const wrapDeg = (a) => a - 360 * Math.ceil(a / 360 - 0.5);          // into (-180, 180]
const stampFits = (t, state) => typeof t.L !== 'number' || (Math.abs(t.L - state.L) <= 1e-12 * Math.max(1, state.L) && Math.abs(t.tw - state.tw) <= 1e-12);

/**
 * The carried triangle as the address needs it, or '' where a reload without it shows the same three cards (the
 * state carries none, its stamp has lapsed, or the rule gives the same triangle at the address's rounded numbers).
 * The indices written are those the triangle has AT the rounded numbers (where a Twist stands at the very end of
 * its range the rounding can carry it to the other end, a whole turn on: the index then differs by 2), so that the
 * address of a reloaded state is the same address.
 */
function triForAddress(state, L, tw) {
  const t = state.tri;
  if (!t || !Number.isInteger(t.k) || !stampFits(t, state)) return '';
  try {
    const shown = triangle(state).tri, { tri, ...bare } = state, there = { ...bare, L, tw };          // there: what a reload makes of the address
    const kept = triangle({ ...there, tri: { k: shown.k, lo: shown.lo, hi: shown.hi } }).tri, byRule = triangle(there).tri;
    return byRule.k === kept.k && byRule.lo === kept.lo && byRule.hi === kept.hi ? '' : triText(kept);
  } catch (err) { return triText(t); }
}

/**
 * The address of a state and of what the page shows of it.
 *   ui   { j: the journey 0..2 (0 surface, 1 two pillows, 2 open crowns), az, el: the turntable's view in degrees }
 *        j = 0 and the view of DEFAULT_UI (or none) are left out.
 */
export function toHash(state, ui = {}) {
  const fam = FAMILIES[state.k] || { defaultM: '', defaultL: NaN, defaultTw: NaN, kind: kindOf(state) };
  const l = num(state.L, 3), tw = num(state.tw, 4), perm = state.perm.join('');
  const read = numbersFrom(fam, l, tw);
  const tri = triForAddress(state, read.L ?? state.L, read.tw ?? state.tw);
  const home = state.k === '3333' && perm === fam.defaultM && l === num(fam.defaultL, 3) && tw === num(fam.defaultTw, 4) && !tri;
  const parts = home ? [] : [`k=${state.k}`, `m=${perm}`, `l=${l}`, `tw=${tw}`];
  if (tri) parts.push(`tri=${tri}`);
  const j = Number.isFinite(ui && ui.j) ? num(clamp(ui.j, 0, 2), 2) : '0';
  if (j !== '0') parts.push(`j=${j}`);
  if (ui && Number.isFinite(ui.az) && Number.isFinite(ui.el)) {
    const az = num(wrapDeg(ui.az), 1), el = num(clamp(ui.el, -90, 90), 1);
    if (az !== num(DEFAULT_UI.az, 1) || el !== num(DEFAULT_UI.el, 1)) parts.push(`v=${az}%2C${el}`);
  }
  return '#' + parts.join('&');
}

/**
 * Read an address ("#k=2346&m=0132&l=2.559&tw=0", with or without the "#", or a whole URL): { state, ui }.
 * Nothing after the "#" is 3333 at the engine's defaults; a part that is missing or unreadable is the family's
 * default (m: a permutation of 0123; l, tw clamped; a number that prints as the default IS the default).
 * null when k is there and is not four cone points of orders 2..9.
 *   state.tri   as the address has it, stamped with the numbers read: it goes on with the sliders, as after a flip
 *   state.print the print a pick of that pair leaves (the engine's linkedPrint, as page.js does for a link)
 *   ui          { j, az, el }, DEFAULT_UI where the address says nothing
 */
export function fromHash(text) {
  const raw = String(text == null ? '' : text), at = raw.indexOf('#'), body = at >= 0 ? raw.slice(at + 1) : raw;
  let params;
  try { params = new URLSearchParams(body); } catch (err) { return null; }
  const kText = params.get('k');
  const st = stateFor(kText == null || kText === '' ? '3333' : kText);
  if (!st) return null;
  const fam = FAMILIES[st.k], m = params.get('m') || '';
  if (/^[0-3]{4}$/.test(m) && new Set(m).size === 4 && m !== fam.defaultM) {
    st.perm = m.split('').map(Number);
    st.orders = st.perm.map((c) => fam.baseOrders[c]);
    let linked = null;
    try { linked = linkedPrint(st.k, st.perm); } catch (err) { linked = null; }
    if (linked) { st.thetas = linked.thetas.slice(); st.print = linked.print; }
  }
  const read = numbersFrom(fam, params.get('l'), params.get('tw'));
  if (read.L !== null) st.L = read.L;
  if (read.tw !== null) st.tw = read.tw;
  // the carried triangle: three whole numbers (lo, hi may be "_"); kept only if the three loops it names are sound
  const tri = triFrom(params.get('tri') || '');
  if (tri && [tri.k, tri.lo, tri.hi].every((v) => v === null || Math.abs(v) <= 40)) {
    const withTri = { ...st, tri: { k: tri.k, lo: tri.lo, hi: tri.hi, L: st.L, tw: st.tw } };
    try {
      const tr = triangle(withTri);
      if (tr.loops.every((lp) => Number.isFinite(lp.L) && lp.L > 0 && lp.L < 60 && Math.abs(lp.tw) <= 0.5 + 1e-9 && lp.seg.every((p) => p.every(Number.isFinite)))) st.tri = withTri.tri;
    } catch (err) { /* an address's triangle the engine cannot lay out: the natural one will do */ }
  }
  const ui = { ...DEFAULT_UI }, jv = parseFloat(params.get('j')), v = (params.get('v') || '').split(',').map(parseFloat);
  if (Number.isFinite(jv)) ui.j = clamp(jv, 0, 2);
  if (v.length === 2 && v.every(Number.isFinite)) { ui.az = wrapDeg(v[0]); ui.el = clamp(v[1], -90, 90); }
  return { state: st, ui };
}

// ---- the two pillows, in numbers (SPEC § 1.5) ------------------------------------------------------------------------

/**
 * The two pillows of a state: [the first (picked) pair's, the second pair's]. Each:
 *   features    [f, f] in slot order (A, B | C, D), and orders [p, q], angles [2 pi / p, 2 pi / q] likewise
 *   loop        the length of the loop they are joined along (2222: 2 L)
 *   seal        the distance between the pillow's two cone points
 *   heights     [hP, hQ]: how far each cone point stands from the loop;   least: the least distance loop to seal
 *   area        (hyperbolic: 2 pi (1 - 1/p - 1/q); 2222: 1 each), areaOverPi
 *   degenerate  a pair of 2s in a hyperbolic orbifold: no area, the seal lies on the loop
 *   exact       both peaks lie within the rim arsinh(2 pi / loop) of the crown, so the open crown is exact in space;
 *               rim that distance (2222: Infinity), excess how far the higher peak passes it (0 if exact)
 *   kind        'H' | 'E'
 */
export function pillowsOf(state) {
  const g = orbifold(state.orders, state.L, state.tw), rim = g.kind === 'E' ? Infinity : sMax(g.cuff);
  return [g.lower, g.upper].map((pl, i) => {
    const orders = [state.orders[2 * i], state.orders[2 * i + 1]], peak = Math.max(pl.hP, pl.hQ);
    return {
      features: [state.perm[2 * i], state.perm[2 * i + 1]], orders, angles: orders.map((n) => TAU / n),
      loop: g.cuff, seal: pl.d, heights: [pl.hP, pl.hQ], least: pl.m,
      area: pl.area, areaOverPi: pl.area / PI,
      degenerate: !!pl.degenerate, exact: peak <= rim, rim, excess: Math.max(0, peak - rim), kind: g.kind,
    };
  });
}

// ---- numbers as the cards write them --------------------------------------------------------------------------------

/** A Length with three decimals: "2.634". */
export const lengthText = (L) => Number(L).toFixed(3);
/** A Twist in turns, signed, three decimals, with a true minus and never a "-0.000": "+0.250", "−0.125", "+0.000". */
export const twistText = (tw) => { const t = Number(Number(tw).toFixed(3)); return `${t < 0 ? '−' : '+'}${Math.abs(t).toFixed(3)}`; };
