// measure.mjs — the numbers quoted in NOTES.md.  node dev/core/measure.mjs
import * as S from '../../src/state.js';
const time = (f, reps) => { const t0 = performance.now(); for (let i = 0; i < reps; i++) f(i); return (performance.now() - t0) / reps; };
const st = S.withNumbers(S.stateFor('3333'), { L: 2.2, tw: 0.13 });
time((i) => S.cardsOf(st), 2000);
console.log('cardsOf:      ', (time(() => S.cardsOf(st), 5000) * 1000).toFixed(1), 'us');
console.log('withNumbers:  ', (time((i) => S.withNumbers(st, { tw: -0.4 + 0.0001 * i }), 5000) * 1000).toFixed(1), 'us');
console.log('pillowsOf:    ', (time(() => S.pillowsOf(st), 5000) * 1000).toFixed(1), 'us');
console.log('toHash:       ', (time(() => S.toHash(st, { j: 1, az: 10, el: 5 }), 5000) * 1000).toFixed(1), 'us');
const flipped = S.activate(st, '02|13').state;
console.log('toHash (tri): ', (time(() => S.toHash(flipped, {}), 5000) * 1000).toFixed(1), 'us');
console.log('fromHash:     ', (time(() => S.fromHash('#k=3333&m=0123&l=2.2&tw=0.13&j=1'), 2000) * 1000).toFixed(1), 'us');
const t1 = performance.now(); S.fromHash('#k=3333&m=1203&l=3.85&tw=0.25'); console.log('fromHash, another pair, first time:', (performance.now() - t1).toFixed(1), 'ms');
console.log('fromHash, another pair, again:    ', (time(() => S.fromHash('#k=3333&m=1203&l=3.85&tw=0.25'), 200) * 1000).toFixed(1), 'us');
const keys = ['02|13', '03|12', '01|23'];
let cur = st; const ta = []; for (let i = 0; i < 12; i++) { const t0 = performance.now(); cur = S.activate(cur, keys[i % 3]).state; ta.push(performance.now() - t0); }
console.log('activate:     ', ta.map((v) => v.toFixed(0)).join(' '), 'ms');
const t2 = performance.now(); S.stateFor('5678'); console.log('stateFor, a signature not seen before:', (performance.now() - t2).toFixed(1), 'ms');
// a flip leaves the slider's range
for (const [sig, L, tw] of [['3333', 0.4, 0], ['3333', 7, 0], ['3333', 7, 0.25], ['9999', 0.4, 0], ['2222', 2, 0], ['2222', 0.5, 0.5]]) {
  const s0 = S.withNumbers(S.stateFor(sig), { L, tw });
  console.log(`${sig} at L ${L} tw ${tw}:`, S.cardsOf(s0).map((c) => `${c.key}${c.active ? '*' : ''} ${c.L.toFixed(3)} @ ${S.twistText(c.tw)} range [${c.lRange.map((v) => +v.toFixed(3))}]`).join('  '));
}
// leaving a cut that is longer than its twin: the card just left drops to the twin at the first move of another slider
{
  const s0 = S.withNumbers(S.stateFor('3333'), { L: 4.1, tw: 0.2 }), c0 = S.cardsOf(s0);
  const a = S.activate(s0, '02|13').state, c1 = S.cardsOf(a), m = S.withNumbers(a, { L: a.L + 1e-6 }), c2 = S.cardsOf(m);
  console.log('3333 at L 4.1 tw 0.2: the active card is minimal?', c0[0].minimal);
  console.log('  cards:                 ', c0.map((c) => `${c.L.toFixed(3)} @ ${S.twistText(c.tw)}`).join('   '));
  console.log('  after activating 02|13:', c1.map((c) => `${c.L.toFixed(3)} @ ${S.twistText(c.tw)}`).join('   '));
  console.log('  after its Length +1e-6:', c2.map((c) => `${c.L.toFixed(3)} @ ${S.twistText(c.tw)}`).join('   '));
}
// the pale colours of the two inactive cards change places when the active Twist crosses 0
{
  const a = S.cardsOf(S.withNumbers(S.stateFor('3333'), { tw: 0.01 })), b = S.cardsOf(S.withNumbers(S.stateFor('3333'), { tw: -0.01 }));
  console.log('3333, pairs at Twist +0.01:', JSON.stringify(a.map((c) => c.pairs)), ' at -0.01:', JSON.stringify(b.map((c) => c.pairs)));
}

// where the active card's loop is longer than its twin, over a Twist drag of 401 steps
for (const [sig, L] of [['2222', null], ['3333', null], ['2223', null], ['2345', null], ['4444', null], ['3333', 4.1], ['3333', 7], ['2222', 1.8]]) {
  let n = 0;
  for (let i = 0; i <= 400; i++) { const s0 = { ...S.stateFor(sig), tw: -0.5 + i / 400 }; if (L) s0.L = L; if (!S.cardsOf(s0).find((c) => c.active).minimal) n++; }
  console.log(`${sig} at Length ${(L || S.stateFor(sig).L).toFixed(3)}: the cut is longer than its twin at ${n} of 401 Twists`);
}
