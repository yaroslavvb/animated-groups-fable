import * as P from '../../src/pillow.js';
import { createSurfaceModel } from '../../src/surface-model.js';
import { flip } from '../../src/flips.js';
import { stateFor } from '../../src/state.js';
const t0 = performance.now();
for (const sig of ['3333', '2345', '2223', '2222', '4444']) {
  const state = stateFor(sig);
  const sm = createSurfaceModel({ nVertices: 2600 });
  let t = performance.now();
  sm.set(state);
  const f0 = sm.frame(0), f1 = sm.frame(1), f2 = sm.frame(2);
  console.log(sig, 'orders', state.orders.join(''), 'L', state.L.toFixed(4), 'tw', state.tw, 'perm', state.perm.join(''), '| set', (performance.now() - t).toFixed(0), 'ms | nV', f0.nVertices, 'tri', f0.triangles.length / 3, 'version', f0.version, f1.version, f2.version,
    'strain', (100 * f0.stats.strainMean).toFixed(3) + ' %', 'max', (100 * f0.stats.strainMax).toFixed(2) + ' %', 'radius', f0.frame.radius.toFixed(3), 'gap', f0.gap.toFixed(3), 'deg', f0.degenerate, 'exact', f0.exact, 'curves', f0.curves.length, f1.curves.length, f2.curves.length);
  for (const key of ['02|13', '03|12', '01|23']) {
    const cur = sm.state, full = { ...state, ...cur };
    const r = flip(sm._engineState || state, key);
    t = performance.now();
    const res = sm.flip(r.state, { invQ: r.invQ, before: sm._engineState || state });
    sm._engineState = r.state;
    const fr = sm.frame(0);
    console.log('   flip to', key, 'L', r.state.L.toFixed(4), 'tw', r.state.tw.toFixed(4), 'perm', r.state.perm.join(''), 'cold', res.cold, (performance.now() - t).toFixed(0), 'ms', 'strain', (100 * fr.stats.strainMean).toFixed(3) + ' %', 'max', (100 * fr.stats.strainMax).toFixed(2) + ' %', 'turn', res.turn.map((v) => v.toFixed(2)).join(' '));
  }
}
console.log('total', (performance.now() - t0).toFixed(0), 'ms');
