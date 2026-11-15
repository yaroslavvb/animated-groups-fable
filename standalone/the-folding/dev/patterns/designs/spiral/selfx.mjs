// designs/spiral/selfx.mjs — where does the outline of a group's motif cross itself? node selfx.mjs '<id>' [design.js?knobs]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BY_ID } from '../../../../src/groups.js';

const id = process.argv[2] || '*x', file = process.argv[3] || 'design.js';
const here = path.dirname(new URL(import.meta.url).pathname);
const [f, q] = file.split('?');
const mod = await import(pathToFileURL(path.resolve(here, f)).href + (q ? '?' + q : ''));
const g = BY_ID[id], ts = Math.sqrt(g.domainArea);
const res = mod.find(g), p = res.shapes[0].pts, n = p.length;
const cross = (a, b, c, d) => {
  const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
  const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]), d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
  return d1 * d2 < 0 && d3 * d4 < 0;
};
console.log(id, 'verts', n, 'info', JSON.stringify(res.info));
for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
  if (i === 0 && j === n - 1) continue;
  if (cross(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) console.log('cross', i, j, 'of', n, 'at', p[i].map((v) => (v / ts).toFixed(3)).join(','), '|', p[j].map((v) => (v / ts).toFixed(3)).join(','));
}
