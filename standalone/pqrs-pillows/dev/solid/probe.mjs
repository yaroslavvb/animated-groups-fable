// probe.mjs — the solid of a few states, in numbers: is it flat where it should be, do the faces fit, is it reduced?
import { stateFor, withNumbers, cardsOf, activate } from '../../src/state.js';
import { solidOf, cardsTriangulation, reducedTriangulation, loopQuantity } from '../../src/solid.js';
import { triangle } from '../../src/flips.js';

const fmt = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function report(label, st) {
  const S = solidOf(st), tr = triangle(st);
  const names = 'PQRS', v = S.vertex;
  const d = (a, b) => fmt(S.dist[a][b]);
  console.log(`${label}: kind ${S.kind} swaps ${S.swaps} thick ${fmt(S.thick, 6)} z2 ${S.z2.toExponential(2)} base ${S.features.map((f) => names[f]).join('')}  reduced(cards) ${tr.reduced}`);
  console.log(`   edges PQ ${d(0, 1)} RS ${d(2, 3)} | PR ${d(0, 2)} QS ${d(1, 3)} | PS ${d(0, 3)} QR ${d(1, 2)}`);
  console.log('   vertices ' + v.map((p, f) => `${names[f]}(${p.map((x) => fmt(x, 3)).join(',')})`).join(' '));
  // chord lengths in the ball against the hyperbolic distance, as a sanity check of the embedding
  if (S.kind === 'H') {
    let worst = 0;
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const p = v[a].map((x) => x / 2), q = v[b].map((x) => x / 2);
      const pp = p[0] ** 2 + p[1] ** 2 + p[2] ** 2, qq = q[0] ** 2 + q[1] ** 2 + q[2] ** 2;
      const dh = Math.acosh(1 + (2 * dist3(p, q) ** 2) / ((1 - pp) * (1 - qq)));
      worst = Math.max(worst, Math.abs(dh - S.dist[a][b]));
    }
    console.log(`   ball distances agree with the edge lengths to ${worst.toExponential(2)}`);
  } else {
    let worst = 0;
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) worst = Math.max(worst, Math.abs(dist3(v[a], v[b]) - S.dist[a][b]));
    console.log(`   distances agree with the edge lengths to ${worst.toExponential(2)}`);
  }
  // the cards' seals against the edges
  const cards = cardsOf(st);
  for (const c of cards) {
    const G = S.G, s0 = G.dist(G.q(c.seals[0][0], c.seals[0][1])), s1 = G.dist(G.q(c.seals[1][0], c.seals[1][1]));
    const e0 = S.dist[c.pairs[0][0]][c.pairs[0][1]], e1 = S.dist[c.pairs[1][0]][c.pairs[1][1]];
    console.log(`   card ${c.key} L ${fmt(c.L)} tw ${fmt(c.tw)} seals ${fmt(s0)} ${fmt(s1)}  edges ${fmt(e0)} ${fmt(e1)} ${Math.abs(s0 - e0) + Math.abs(s1 - e1) < 1e-6 ? 'EDGE' : 'not an edge'} minimal ${c.minimal}`);
  }
  return S;
}

for (const sig of ['3333', '2345', '2223', '4444', '2222']) {
  const st = stateFor(sig);
  report(`${sig} default (L ${st.L}, tw ${st.tw})`, st);
}
let st = stateFor('3333');
for (const tw of [0.05, 0.125, 0.25, 0.4, 0.5, -0.1, -0.25]) report(`3333 tw ${tw}`, withNumbers(st, { tw }));
for (const L of [1, 4, 6]) report(`3333 L ${L} tw 0.25`, withNumbers(withNumbers(st, { tw: 0.25 }), { L }));
st = stateFor('2222');
for (const tw of [0.1, 0.25, 0.4]) report(`2222 tw ${tw}`, withNumbers(st, { tw }));
report('2222 L 1.8 tw .25', withNumbers(withNumbers(st, { tw: 0.25 }), { L: 1.8 }));
// activate the third card and move its twist
st = stateFor('3333');
const a = activate(st, '03|12');
report('3333 third card active', a.state);
for (const tw of [0.2, 0.3, 0.1, 0.0]) report(`3333 third card tw ${tw}`, withNumbers(a.state, { tw }));
