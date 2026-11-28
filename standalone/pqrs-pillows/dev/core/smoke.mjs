// smoke.mjs — the seeded pure modules load and give the numbers the prototypes gave.  node dev/core/smoke.mjs
import * as H from '../../../two-features-two-handles/src/handles.js';
import * as F from '../../src/flips.js';
import * as P from '../../src/pillow.js';

for (const text of ['2222', '3333', '2223', '2345', '4444', '2346']) {
  const k = H.normalizeFamilyKey(text), fam = H.FAMILIES[k], perm = fam.defaultM.split('').map(Number);
  const st = { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L: fam.defaultL, tw: fam.defaultTw, b: 0, tau: 0, thetas: [0, 0, 0, 0], print: null };
  const t0 = performance.now();
  const tr = F.triangle(st);
  const dt = performance.now() - t0;
  console.log(text, 'mode', fam.mode, 'kind', fam.kind, 'm', fam.defaultM, 'orders', st.orders.join(''), 'L', st.L.toFixed(6), 'k', tr.k, 'natural', tr.natural, `(${dt.toFixed(2)} ms)`);
  for (const lp of tr.loops) console.log('   ', lp.id.padEnd(3), lp.key, 'pairing', JSON.stringify(lp.pairing), 'perm', lp.perm.join(''), 'L', lp.L.toFixed(6), '@', lp.tw.toFixed(6), 'length', lp.length.toFixed(6), 'minimal', lp.minimal, 'onTree', lp.onTree, 'ends', lp.ends ? 'yes' : 'null', 'tri', lp.triIndex);
  const g = P.orbifold(st.orders, st.L, st.tw);
  console.log('    pillows: lower', { hP: +g.lower.hP.toFixed(6), hQ: +g.lower.hQ.toFixed(6), d: +g.lower.d.toFixed(6), area: +g.lower.area.toFixed(6), deg: g.lower.degenerate }, 'upper', { hP: +g.upper.hP.toFixed(6), hQ: +g.upper.hQ.toFixed(6), d: +g.upper.d.toFixed(6), area: +g.upper.area.toFixed(6), deg: g.upper.degenerate }, 'cuff', g.cuff.toFixed(6), 'sMax', g.kind === 'E' ? 'inf' : P.sMax(g.cuff).toFixed(6));
}
// timing of triangle()
{
  const st = { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 2.2, tw: 0.13, b: 0, tau: 0, thetas: [0, 0, 0, 0] };
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) F.triangle({ ...st, tw: -0.4 + 0.0004 * i });
  console.log('triangle(): ', ((performance.now() - t0) / 2000 * 1000).toFixed(1), 'us per call');
}
