// probe-leave.mjs — leaving a cut that is longer than its twin: what its card shows once another card's slider moves.
import * as S from '../../src/state.js';
for (const [sig, L, tw] of [['3333', 4.1, 0.2], ['3333', 7, 0.25], ['2345', 6, -0.3], ['2222', 1.8, 0.25]]) {
  const s0 = S.withNumbers(S.stateFor(sig), { L, tw }), key0 = S.keyOf(s0), other = S.CARD_KEYS.find((k) => k !== key0);
  const a = S.activate(s0, other).state, m = S.withNumbers(a, { L: a.L * 1.001 }), far = S.withNumbers(m, { tw: m.tw > 0 ? m.tw - 0.3 : m.tw + 0.3 });
  const show = (st) => { const c = S.cardsOf(st).find((x) => x.key === key0); return `${c.L.toFixed(3)} @ ${S.twistText(c.tw)}${c.minimal ? '' : ' (longer than its twin)'}`; };
  console.log(`${sig}: the card left: ${show(s0)}; after the other card's Length moved by 0.1 %: ${show(m)}; after its Twist moved by 0.3 more: ${show(far)}; back on it: ${(() => { const h = S.activate(far, key0).state; return h.L.toFixed(3) + ' @ ' + S.twistText(h.tw); })()}`);
}
