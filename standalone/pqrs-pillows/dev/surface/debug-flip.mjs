import { createSurfaceModel } from '../../src/surface-model.js';
import { flip } from '../../src/flips.js';
const st = { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 2.6339157938496336, tw: 0, b: 0, tau: 0, thetas: [0, 0, 0, 0], print: null };
for (const key of ['02|13', '03|12']) {
  const sm = createSurfaceModel({ nVertices: 1400 });
  sm.set(st);
  const f0 = sm.frame(0);
  console.log('before', f0.marks.map((m) => `${m.id}(slot ${m.slot}) ${Array.from(f0.positions.slice(3 * m.vertex, 3 * m.vertex + 3)).map((v) => v.toFixed(3)).join(',')}`).join(' | '));
  const r = flip(st, key), res = sm.flip(r.state, { invQ: r.invQ, before: st });
  const f1 = sm.frame(0);
  console.log(key, 'new perm', r.state.perm.join(''), 'orders', r.state.orders.join(''), 'L', r.state.L.toFixed(4), 'tw', r.state.tw.toFixed(4), 'cold', res.cold);
  console.log('after ', f1.marks.map((m) => `${m.id}(slot ${m.slot}) ${Array.from(f1.positions.slice(3 * m.vertex, 3 * m.vertex + 3)).map((v) => v.toFixed(3)).join(',')}`).join(' | '));
  const loop = f1.curves.find((c) => c.id === 'loop'); let zmin = 1e9, zmax = -1e9;
  for (const v of loop.chain) { zmin = Math.min(zmin, f1.positions[3 * v + 2]); zmax = Math.max(zmax, f1.positions[3 * v + 2]); }
  console.log('loop z range', zmin.toFixed(3), zmax.toFixed(3), 'stats', f1.stats.strainMean.toFixed(5), f1.stats.strainMax.toFixed(4));
}
