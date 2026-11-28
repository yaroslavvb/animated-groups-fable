// probe-quarter.mjs — how the inactive cards' Twists behave BY FLIPS.JS'S RULE ALONE (every state made afresh, no
// naming carried: what cardsOf gave before withNumbers carried the naming of the far pairs).
import * as S from '../../src/state.js';
const fmt = (c) => `${c.key}${c.active ? '*' : ' '} ${c.L.toFixed(4)} @ ${c.tw >= 0 ? '+' : ''}${c.tw.toFixed(4)} [${c.index}] ${c.perm.join('')}`;
for (const [sig, tw] of [['3333', 0.05], ['3333', 0.2], ['2345', 0.1]]) {
  console.log(`${sig} at Twist ${tw}, Length swept:`);
  for (let L = 1.0; L <= 5.01; L += 0.5) { const st = { ...S.stateFor(sig), L, tw }; console.log(`  L ${L.toFixed(2)}: ` + S.cardsOf(st).map(fmt).join('   ')); }
}
for (const [sig, L] of [['3333', 3], ['2345', 2.5357], ['2222', 1]]) {
  console.log(`${sig} at Length ${L}, Twist swept:`);
  for (let i = -10; i <= 10; i++) { const tw = i / 20; const st = { ...S.stateFor(sig), L, tw }; console.log(`  tw ${tw >= 0 ? '+' : ''}${tw.toFixed(2)}: ` + S.cardsOf(st).map(fmt).join('   ')); }
}
// count the jumps of an inactive card's Twist over fine drags
function jumps(sig, fixed, sweep) {
  let prev = null, out = { tw: 0, L: 0, n: 0, worstL: 0 };
  for (let i = 0; i <= 2000; i++) {
    const u = i / 2000, st = { ...S.stateFor(sig), ...sweep(u, fixed) }, cards = S.cardsOf(st);
    if (prev) cards.forEach((c, x) => { if (c.active) return; out.n++; if (Math.abs(c.tw - prev[x].tw) > 0.05) out.tw++; const dL = Math.abs(c.L - prev[x].L); out.worstL = Math.max(out.worstL, dL); });
    prev = cards;
  }
  return out;
}
console.log('jumps of an inactive Twist (> 0.05 in one step of 1/2000 of the range):');
for (const sig of ['3333', '2345', '2223', '2222', '4444']) {
  const fam = S.stateFor(sig), flat = S.kindOf(fam) === 'E', [lo, hi] = flat ? [0.5, 2] : [0.4, 7];
  for (const tw of [0, 0.05, 0.2, -0.35]) { const j = jumps(sig, tw, (u, t) => ({ L: lo + u * (hi - lo), tw: t })); console.log(`  ${sig} Length drag at Twist ${tw}: ${j.tw} jump(s); largest Length step ${j.worstL.toExponential(1)}`); }
  for (const L of flat ? [0.7, 1, 1.6] : [1, fam.L, 4.1, 6]) { const j = jumps(sig, L, (u, l) => ({ L: l, tw: -0.5 + u })); console.log(`  ${sig} Twist drag at Length ${(+L).toFixed(3)}: ${j.tw} jump(s); largest Length step ${j.worstL.toExponential(1)}`); }
}
