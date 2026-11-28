// layers.mjs — how many layers the bake needs over Length (overlapping commas), and what it costs
import { createPrint3d } from '../../src/print3d.js';
import { FAMILIES, normalizeFamilyKey, defaultCommas } from '../../../two-features-two-handles/src/handles.js';
function stateFor(text, over = {}) { const k = normalizeFamilyKey(text), fam = FAMILIES[k], perm = fam.defaultM.split('').map(Number); return { k, perm, orders: perm.map((c) => fam.baseOrders[c]), L: fam.defaultL, tw: fam.defaultTw, b: 0, tau: 0, thetas: defaultCommas(k).map((sp) => (sp ? sp.theta : 0)), print: null, ...over }; }
for (const key of ['3333', '2345', '2223', '2222', '4444']) {
  const rows = [];
  for (const L of key === '2222' ? [0.5, 0.7, 1, 1.4, 2] : [0.4, 0.7, 1, 1.5, 2, 2.6, 3.5, 5, 7]) for (const tw of [0, 0.3]) {
    const p3 = createPrint3d(); p3.bake(stateFor(key, { L, tw: tw + 0.001 }), { size: 512 });
    const t0 = performance.now(), pr = p3.bake(stateFor(key, { L, tw }), { size: 512 }), ms = performance.now() - t0;
    rows.push(`L ${L} tw ${tw}: ${pr.info.layers} layer(s), ${pr.info.polys} outlines, ${ms.toFixed(1)} ms`);
  }
  console.log(key + '\n  ' + rows.join('\n  '));
}
