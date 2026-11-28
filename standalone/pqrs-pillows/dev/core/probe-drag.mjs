// probe-drag.mjs — an inactive card's Twist under REAL drags (each step from the state before it, as the page does).
import * as S from '../../src/state.js';
function drag(sig, start, step, n) {
  let st = S.withNumbers(S.stateFor(sig), start), prev = S.cardsOf(st);
  const out = { half: 0, whole: 0, twin: 0, worstL: 0, worstTw: 0, n: 0 };
  for (let i = 1; i <= n; i++) {
    st = S.withNumbers(st, step(i / n, st));
    const cards = S.cardsOf(st);
    cards.forEach((c, x) => {
      if (c.active) return;
      const dtw = Math.abs(c.tw - prev[x].tw), twin = c.index !== prev[x].index;
      out.n++; out.worstL = Math.max(out.worstL, Math.abs(c.L - prev[x].L));
      if (twin) out.twin++;
      else if (dtw > 0.9) out.whole++;
      else if (dtw > 0.2) out.half++;
      else out.worstTw = Math.max(out.worstTw, dtw);
    });
    prev = cards;
  }
  return out;
}
const say = (name, o) => console.log(`  ${name}: jumps by half a turn ${o.half}, whole-turn wraps ${o.whole}, changes of a loop for its twin ${o.twin}; largest ordinary step: Twist ${o.worstTw.toExponential(1)}, Length ${o.worstL.toExponential(1)}`);
for (const sig of ['3333', '2345', '2223', '2222', '4444', '2346']) {
  const fam = S.stateFor(sig), flat = S.kindOf(fam) === 'E', [lo, hi] = flat ? [0.5, 2] : [0.4, 7];
  for (const tw of [0, 0.05, 0.2, -0.35]) say(`${sig} Length drag ${lo} .. ${hi} at Twist ${tw}`, drag(sig, { L: lo, tw }, (u) => ({ L: lo + u * (hi - lo) }), 2000));
  for (const L of flat ? [0.7, 1, 1.6] : [1, fam.L, 4.1, 6]) say(`${sig} Twist drag -1/2 .. 1/2 at Length ${(+L).toFixed(3)}`, drag(sig, { L, tw: -0.5 }, (u) => ({ tw: -0.5 + u }), 2000));
}
