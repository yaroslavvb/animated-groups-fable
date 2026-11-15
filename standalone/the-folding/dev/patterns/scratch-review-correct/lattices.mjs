// scratch (review-correct): the 17 groups' lattices and reps, and how long the four shape prints take in node (one process).
//   node dev/patterns/scratch-review-correct/lattices.mjs
import { GROUPS } from '../../../src/groups.js';
import { printFor } from '../../../src/pattern.js';

const ang = (v) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;
for (const g of GROUPS) {
  const l1 = Math.hypot(...g.e1), l2 = Math.hypot(...g.e2);
  const between = ang(g.e2) - ang(g.e1);
  const times = [];
  for (const key of ['paisley', 'soft', 'tomoe', 'comma']) {
    const t0 = performance.now(); const P = printFor(g, key); times.push(`${key} ${(performance.now() - t0).toFixed(1)}${P ? '' : ' NULL'}`);
  }
  console.log(`${g.id.padEnd(6)} e1 ${g.e1.map((v) => v.toFixed(3))} e2 ${g.e2.map((v) => v.toFixed(3))} |e1| ${l1.toFixed(3)} |e2| ${l2.toFixed(3)} angle ${between.toFixed(1)}  reps ${g.reps.length}  presets ${g.presets.length}  ${times.join(', ')} ms`);
}
