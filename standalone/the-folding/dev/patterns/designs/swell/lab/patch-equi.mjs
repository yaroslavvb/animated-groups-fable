// lab/patch-equi.mjs — one-off: no grid point exactly on a tile's rim (an offset of 0.37 step), and ties between seats
// broken by the order they were found in (both so that a turned, scaled, shifted group gets the same seat).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), file = path.resolve(here, '../design.js');
let s = fs.readFileSync(file, 'utf8');
const rep = (a, b, n0 = 1) => { const n = s.split(a).length - 1; if (n !== n0) throw new Error('pattern found ' + n + ' times: ' + a.slice(0, 80)); s = s.split(a).join(b); };
rep(`  for (let j = Math.ceil(b0 / step); j * step <= b1; j++) for (let i = Math.ceil(a0 / step); i * step <= a1; i++) {
    const x = c[0] + i * step * ux + j * step * vx, y = c[1] + i * step * uy + j * step * vy;`,
`  // the grid is offset by 0.37 of a step: no point of it lies exactly on the rim of a tile (where rounding would decide)
  for (let j = Math.ceil(b0 / step - 0.37); (j + 0.37) * step <= b1; j++) for (let i = Math.ceil(a0 / step - 0.37); (i + 0.37) * step <= a1; i++) {
    const x = c[0] + (i + 0.37) * step * ux + (j + 0.37) * step * vx, y = c[1] + (i + 0.37) * step * uy + (j + 0.37) * step * vy;`);
rep(`  const keep = (c, k) => { const P = pools[k]; P.push(c); if (P.length >= 4 * K.topN) { P.sort((a, b) => b.area - a.area); P.length = K.topN; floors[k] = P[K.topN - 1].area; } };`,
`  let found = 0;
  const byArea = (a, b) => (Math.abs(a.area - b.area) > 1e-9 ? b.area - a.area : a.idx - b.idx);     // ties: the first found
  const keep = (c, k) => { const P = pools[k]; c.idx = found++; P.push(c); if (P.length >= 4 * K.topN) { P.sort(byArea); P.length = K.topN; floors[k] = P[K.topN - 1].area + 1e-9; } };`);
rep(`  const all = pools.flatMap((P) => P.sort((a, b) => b.area - a.area).slice(0, K.topN));`, `  const all = pools.flatMap((P) => P.sort(byArea).slice(0, K.topN));`);
rep(`  const keep = (c, k) => { const P = pools[k]; P.push(c); if (P.length >= 4 * K.topN) { P.sort((x, y) => y.area - x.area); P.length = K.topN; floors[k] = P[K.topN - 1].area; } };`,
`  let found = 0;
  const byArea = (a, b) => (Math.abs(a.area - b.area) > 1e-9 ? b.area - a.area : a.idx - b.idx);
  const keep = (c, k) => { const P = pools[k]; c.idx = found++; P.push(c); if (P.length >= 4 * K.topN) { P.sort(byArea); P.length = K.topN; floors[k] = P[K.topN - 1].area + 1e-9; } };`);
rep(`  const all = pools.flatMap((P) => P.sort((x, y) => y.area - x.area).slice(0, K.topN));`, `  const all = pools.flatMap((P) => P.sort(byArea).slice(0, K.topN));`);
fs.writeFileSync(file, s);
console.log('patched');
