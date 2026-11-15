// cell.mjs — the cell of p and the comma of the table, in the cell's own frame (dev): origin p, the WORLD axes, unit =
// the tile size, headings from the world x axis. What one needs to place a comma by hand (view2.mjs "L").
//   node cell.mjs <ids>
import { buildModel, knobsFor, TABLE, frameOf, toWorld } from './design.js';
import { BY_ID } from './lab.mjs';
import { classify } from '../../../../src/groups.js';
for (const id of process.argv[2].split(',')) {
  const g = BY_ID[id], K = knobsFor(g), M = buildModel(g, { ...K, light: [] }), F = M.F, c = 1, s = 0;
  const loc = (w) => { const x = (w[0] - M.p[0]) / F.size, y = (w[1] - M.p[1]) / F.size; return [+(c * x + s * y).toFixed(3), +(-s * x + c * y).toFixed(3)]; };
  const row = TABLE[id], h = toWorld(g, F.A, [row[2], row[3]]);
  console.log(id, 'cell', JSON.stringify(M.poly.map(loc)));
  console.log(id, 'walls', M.walls.map((w) => `${w.type}${w.L ? ' L' + (w.L / F.size).toFixed(2) : ''}`).join(' | '));
  console.log(id, 'e1ang', +F.e1ang.toFixed(4), 'comma L (world axes, heading from x)', JSON.stringify([...loc(h), +(row[4] + F.e1ang).toFixed(4), row[5], row[6], row[7], row[8]]));
  // the rotation centres and mirror lines near the cell, in the same frame
  const cs = new Map();
  for (const e of M.near) { const k = classify(e); if (k.type === 'rotation') { const q = loc(k.center); const key = q.join(','); if (!cs.has(key) || cs.get(key) < k.order) cs.set(key, k.order); } }
  console.log(id, 'centres', [...cs.entries()].filter(([k]) => { const [x, y] = k.split(',').map(Number); return Math.hypot(x, y) < 1.6; }).map(([k, o]) => o + '@' + k).join(' '));
}
