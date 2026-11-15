// designs/spiral/necks.mjs — per group: the narrowest place of the motif's outline (dark or bare), vertex to vertex,
// between places at least 0.3 tile sizes apart along the outline (so the taper of the tail's point is not counted).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GROUPS } from '../../../../src/groups.js';
const file = process.argv[2] || 'design.js';
const mod = await import(pathToFileURL(path.resolve(path.dirname(new URL(import.meta.url).pathname), file)).href);
const rows = [];
for (const g of GROUPS) {
  const ts = Math.sqrt(g.domainArea), res = mod.find(g), p = res.shapes[0].pts, n = p.length;
  let per = 0; const cum = [0];
  for (let i = 0; i < n; i++) { per += Math.hypot(p[(i + 1) % n][0] - p[i][0], p[(i + 1) % n][1] - p[i][1]); cum.push(per); }
  let best = Infinity, at = null;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    let d = Math.abs(cum[j] - cum[i]); d = Math.min(d, per - d);
    if (d < 0.3 * ts) continue;
    const e = Math.hypot(p[j][0] - p[i][0], p[j][1] - p[i][1]);
    if (e < best) { best = e; at = [i, j]; }
  }
  // is the neck dark (inside the polygon) or bare? test the midpoint
  const mx = (p[at[0]][0] + p[at[1]][0]) / 2, my = (p[at[0]][1] + p[at[1]][1]) / 2;
  let inn = false;
  for (let i = 0, j = n - 1; i < n; j = i++) if ((p[i][1] > my) !== (p[j][1] > my) && mx < p[i][0] + ((my - p[i][1]) * (p[j][0] - p[i][0])) / (p[j][1] - p[i][1])) inn = !inn;
  rows.push({ id: g.id, narrowest: +(best / ts).toFixed(4), what: inn ? 'dark' : 'bare', outline: +(per / ts).toFixed(2), slit: res.info.slit, turns: res.info.turns });
}
console.table(rows);
