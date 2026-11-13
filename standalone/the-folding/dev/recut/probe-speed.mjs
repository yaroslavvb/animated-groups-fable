// dev/recut/probe-speed.mjs — how long a rebuild takes (the frames of a drag use the draft mesh): node dev/recut/probe-speed.mjs
import { GROUPS, BY_ID } from '../../src/groups.js';
import { buildScene, mapScene } from '../../src/app.js';
for (const id of ['xx', '22x', '333', 'o', '*x']) {
  const g = BY_ID[id];
  for (const pattern of ['checker', 'comma']) for (const draft of [true, false]) for (const recut of [true, false]) {
    if (!recut && !['xx', '22x'].includes(id)) continue;
    const p = g.presets[g.presets.length - 1], anchor = (p.anchor || p.seed).slice();
    let best = Infinity, map = Infinity, tris = 0;
    for (let k = 0; k < 12; k++) {
      const seed = [p.seed[0] + 0.01 * k, p.seed[1] - 0.007 * k];
      const t0 = performance.now();
      const s = buildScene(g, { seed, metric: p.metric, amp: 0.5, anchor, draft, pattern, recut });
      const t1 = performance.now();
      mapScene(s, 0.6);
      const t2 = performance.now();
      best = Math.min(best, t1 - t0); map = Math.min(map, t2 - t1); tris = s.M.tri.length / 3;
    }
    console.log(`${id.padEnd(4)} ${pattern.padEnd(8)} ${draft ? 'draft' : 'full '} ${recut ? 'recut ' : 'direct'}: build ${best.toFixed(1)} ms, map ${map.toFixed(1)} ms, ${tris} triangles`);
  }
}
