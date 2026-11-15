// designs/spiral/turns.mjs — the sharpest turns of a motif's outline, and its narrowest necks. node turns.mjs '<id>' [design.js]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BY_ID } from '../../../../src/groups.js';

const id = process.argv[2] || '333', file = process.argv[3] || 'design.js';
const here = path.dirname(new URL(import.meta.url).pathname);
const [f, q] = file.split('?');
const mod = await import(pathToFileURL(path.resolve(here, f)).href + (q ? '?' + q : ''));
const g = BY_ID[id], ts = Math.sqrt(g.domainArea);
const res = mod.find(g), p = res.shapes[0].pts, n = p.length;
const rows = [];
for (let i = 0; i < n; i++) {
  const a = p[i], b = p[(i + 1) % n], c = p[(i + 2) % n];
  let d = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]);
  while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  rows.push({ i: (i + 1) % n, deg: +(d * 180 / Math.PI).toFixed(1), at: b.map((v) => +(v / ts).toFixed(3)).join(','), seg: +(Math.hypot(b[0] - a[0], b[1] - a[1]) / ts).toFixed(4), next: +(Math.hypot(c[0] - b[0], c[1] - b[1]) / ts).toFixed(4) });
}
rows.sort((x, y) => Math.abs(y.deg) - Math.abs(x.deg));
console.log(id, 'verts', n, JSON.stringify(res.info));
console.table(rows.slice(0, 8));
// the narrowest places: for a sample of vertices, the nearest vertex at least 12 % of the outline away along it
let per = 0; const cum = [0];
for (let i = 0; i < n; i++) { per += Math.hypot(p[(i + 1) % n][0] - p[i][0], p[(i + 1) % n][1] - p[i][1]); cum.push(per); }
const necks = [];
for (let i = 0; i < n; i++) {
  let best = Infinity, bj = -1;
  for (let j = 0; j < n; j++) {
    let d = Math.abs(cum[j] - cum[i]); d = Math.min(d, per - d);
    if (d < 0.25 * ts) continue;
    const e = Math.hypot(p[j][0] - p[i][0], p[j][1] - p[i][1]);
    if (e < best) { best = e; bj = j; }
  }
  necks.push({ i, j: bj, w: +(best / ts).toFixed(4), at: p[i].map((v) => +(v / ts).toFixed(3)).join(',') });
}
necks.sort((x, y) => x.w - y.w);
console.log('narrowest (dark or bare, vertex to vertex, 0.25 tile sizes apart along the outline):');
console.table(necks.slice(0, 6));
