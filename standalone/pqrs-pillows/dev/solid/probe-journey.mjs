// probe-journey.mjs — the journey's cells in numbers: how many, do they cover each face, are the crown points right?
import { stateFor, withNumbers, cardsOf, activate } from '../../src/state.js';
import { solidOf } from '../../src/solid.js';
import { journeyOf, chartOf, cellsOf } from '../../src/journey.js';
import * as P from '../../src/pillow.js';

const dist3 = (a, b, i, j) => Math.hypot(a[3 * i] - b[3 * j], a[3 * i + 1] - b[3 * j + 1], a[3 * i + 2] - b[3 * j + 2]);
for (const [sig, tw, L] of [['3333', 0.15, null], ['3333', 0, null], ['2345', 0.2, null], ['2223', 0.12, null], ['2222', 0.2, null], ['2222', 0, null], ['3333', 0.25, 4.5], ['4444', -0.3, 2.2]]) {
  let st = withNumbers(stateFor(sig), { tw });
  if (L) st = withNumbers(st, { L });
  const S = solidOf(st), cards = cardsOf(st);
  for (const card of cards) {
    const t0 = performance.now();
    let J;
    try { J = journeyOf(S, st, card); } catch (err) { console.log(sig, tw, card.key, 'FAILED', err.message); continue; }
    const ms = performance.now() - t0;
    // area: the triangles' areas on the crown against the orbifold's area (hyperbolic: 2 pi (2 - sum 1/n) ... ; flat: 2)
    let areaCrown = 0, worst = 0, n0 = 0, n1 = 0;
    for (let t = 0; t < J.triangles.length; t += 3) {
      const [a, b, c] = [J.triangles[t], J.triangles[t + 1], J.triangles[t + 2]];
      const la = dist3(J.crown, J.crown, a, b), lb = dist3(J.crown, J.crown, b, c), lc = dist3(J.crown, J.crown, c, a), sp = (la + lb + lc) / 2;
      areaCrown += Math.sqrt(Math.max(0, sp * (sp - la) * (sp - lb) * (sp - lc)));
      if (J.pillow[a] !== J.pillow[b] || J.pillow[b] !== J.pillow[c]) worst++;
    }
    for (let v = 0; v < J.nVertices; v++) (J.pillow[v] ? n1++ : n0++);
    const want = sig === '2222' ? 2 : 2 * Math.PI * (2 - [...sig].reduce((s, d) => s + 1 / Number(d), 0));
    console.log(`${sig} tw ${tw}${L ? ' L ' + L : ''} loop ${card.key}: ${J.cells} cells, ${J.nVertices} vertices (${n0} + ${n1}), ${J.triangles.length / 3} triangles, crown area ${areaCrown.toFixed(4)} of ${want.toFixed(4)} (${J.exact ? 'exact crowns' : 'past the rim'}), mixed triangles ${worst}, degenerate ${J.degenerate}, ${ms.toFixed(1)} ms`);
  }
}
