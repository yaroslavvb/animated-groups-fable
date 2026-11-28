// fuzz.mjs — random sessions (sliders, flips, reloads through the address) against the invariants of state.js.
//   node dev/core/fuzz.mjs [sessions = 60] [steps = 40] [seed = 1]
import * as S from '../../src/state.js';
import * as F from '../../src/flips.js';
const N = parseInt(process.argv[2] || '60', 10), STEPS = parseInt(process.argv[3] || '40', 10);
let seed = parseInt(process.argv[4] || '1', 10) >>> 0;
const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const SIGS = ['2222', '3333', '2223', '2345', '4444', '2346', '2233', '9999', '2229', '3322', '7352'];
const stats = { steps: 0, activations: 0, moves: 0, reloads: 0, bad: [], maxL: 0, minL: Infinity, tri: 0, worstReload: 0 };
const fail = (what, st, extra = '') => { if (stats.bad.length < 12) stats.bad.push(`${what}: ${st.k} m=${st.perm.join('')} L=${st.L} tw=${st.tw} tri=${F.triText(st.tri)} ${extra}`); };
function check(st, where) {
  let cards;
  try { cards = S.cardsOf(st); } catch (err) { fail(`cardsOf throws (${err.message}) ${where}`, st); return null; }
  if (cards.map((c) => c.key).join() !== S.CARD_KEYS.join()) fail('keys ' + where, st);
  if (cards.filter((c) => c.active).length !== 1) fail('active ' + where, st);
  for (const c of cards) {
    if (!(Number.isFinite(c.L) && c.L > 0 && Number.isFinite(c.tw) && Math.abs(c.tw) <= 0.5 + 1e-9)) fail(`numbers of card ${c.key} ${where}`, st, `${c.L} @ ${c.tw}`);
    if (!(c.lRange[0] <= c.L && c.L <= c.lRange[1])) fail(`range of card ${c.key} ${where}`, st, `${c.L} in ${c.lRange}`);
    if (!c.seg.flat().every(Number.isFinite) || !c.seals.flat(2).every(Number.isFinite)) fail(`geometry of card ${c.key} ${where}`, st);
    stats.maxL = Math.max(stats.maxL, c.L); stats.minL = Math.min(stats.minL, c.L);
  }
  const h = S.toHash(st, { j: rnd() * 2, az: rnd() * 360 - 180, el: rnd() * 60 - 30 });
  if (!/^#[A-Za-z0-9_.=%&/-]*$/.test(h)) fail('address characters ' + where, st, h);
  if (/&tri=/.test(h)) stats.tri++;
  const two = S.pillowsOf(st);
  if (!two.every((p) => [p.loop, p.seal, p.heights[0], p.heights[1], p.area].every(Number.isFinite))) fail('pillows ' + where, st);
  return { cards, h };
}
const t0 = Date.now();
for (let s = 0; s < N; s++) {
  let st = S.stateFor(pick(SIGS));
  for (let i = 0; i < STEPS; i++) {
    stats.steps++;
    const u = rnd(), kind = S.kindOf(st), [lo, hi] = S.lengthRange(kind, st.L);
    try {
      if (u < 0.15) { st = S.activate(st, pick(S.CARD_KEYS)).state; stats.activations++; }
      else if (u < 0.5) { st = S.withNumbers(st, { tw: Math.max(-0.5, Math.min(0.5, st.tw + (rnd() - 0.5) * (rnd() < 0.3 ? 1 : 0.05))) }); stats.moves++; }
      else if (u < 0.85) { st = S.withNumbers(st, { L: lo + rnd() * (hi - lo) }); stats.moves++; }
      else if (u < 0.9) { st = S.withNumbers(st, { L: pick([lo, hi, 0, 1e9, NaN]), tw: pick([-0.5, 0.5, 0, 7, -7]) }); stats.moves++; }
      else {
        // a reload through the address: the same cards, to the rounding of the address
        const before = check(st, 'before a reload');
        const back = S.fromHash(before.h);
        stats.reloads++;
        if (!back) { fail('fromHash null', st, before.h); continue; }
        const after = S.cardsOf(back.state);
        after.forEach((c, x) => {
          const c0 = before.cards[x], dL = Math.abs(c.L - c0.L) / Math.max(1, c0.L), dT = Math.abs(c.tw - c0.tw);
          // (a Twist at the very end of its range may come back at the other end: the same Twist)
          const dTw = Math.min(dT, Math.abs(dT - 1));
          stats.worstReload = Math.max(stats.worstReload, dL, dTw);
          // (a loop under 0.5 long beside a long cut winds fast: the address's 4 decimals of the cut's Twist move its Twist by more)
          if (c.active !== c0.active || c.index !== c0.index || dL > 0.02 || (dTw > 0.02 && c0.L >= 0.5)) fail(`card ${c.key} after a reload`, st, `${c0.L} @ ${c0.tw} [${c0.index}] -> ${c.L} @ ${c.tw} [${c.index}]  ${before.h}`);
        });
        if (S.toHash(back.state, back.ui) !== before.h) fail('the address of the reloaded state', st, `${before.h} -> ${S.toHash(back.state, back.ui)}`);
        st = back.state;
      }
    } catch (err) { fail(`throws: ${err.message}`, st); break; }
    check(st, `after step ${i}`);
  }
}
console.log(`${N} sessions, ${stats.steps} steps (${stats.activations} activations, ${stats.moves} slider moves, ${stats.reloads} reloads) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`Lengths seen on the cards: ${stats.minL.toFixed(4)} .. ${stats.maxL.toFixed(3)}; addresses with tri: ${stats.tri}; a card across a reload differs by at most ${stats.worstReload.toExponential(1)} (Length relative, Twist)`);
console.log(stats.bad.length ? `PROBLEMS (${stats.bad.length} shown):\n  ` + stats.bad.join('\n  ') : 'no invariant broken');
process.exitCode = stats.bad.length ? 1 : 0;
