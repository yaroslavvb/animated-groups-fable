// shares.mjs — how the plane splits: dark frame, light comma, light grout (dev, run 3 critique).
//   node r3/shares.mjs [ids]
import { build, knobsFor } from '../design.js';
import { BY_ID, GROUPS } from '../lab.mjs';
const ids = process.argv[2] ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
for (const id of ids) {
  const g = BY_ID[id], K = knobsFor(g);
  const a = build(g, K), b = build(g, { ...K, light: [] });
  const dark = a.info.cover, cell = b.info.cover;
  console.log(id.padEnd(6), 'dark frame', dark.toFixed(3), 'light comma', (cell - dark).toFixed(3), 'grout', (1 - cell).toFixed(3), 'head', a.info.head.join(','), 'tail', a.info.tail.join(','));
}
