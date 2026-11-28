// frame-cost.mjs: what frame(j) costs at the page's size.
import { createSurfaceModel } from '../../src/surface-model.js';
import { stateFor } from '../../src/state.js';
const st = stateFor('3333'), sm = createSurfaceModel({ nVertices: 2600 }); sm.set(st);
const time = (f, n = 300) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(i); return ((performance.now() - t0) / n).toFixed(3); };
console.log('frame(0)', time(() => sm.frame(0)), 'ms; frame(1)', time(() => sm.frame(1)), 'ms; frame(1.5)', time(() => sm.frame(1.5)), 'ms; frame(2)', time(() => sm.frame(2)), 'ms');
console.log('update with a Twist step + frame(0) (corners redone):', time((i) => { sm.update({ ...st, tw: 0.001 * (i % 50) }, 0); sm.frame(0); }, 100), 'ms (budget 0: two sweeps)');
