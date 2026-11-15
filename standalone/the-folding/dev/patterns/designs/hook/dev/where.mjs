// dev/where.mjs — where is the largest bare disc of a lab spec? node where.mjs <id> <k> [per]
// Prints its centre and diameter (tile sizes) and its distance to the group's rotation centres and mirrors near it.
import fs from 'node:fs';
import { BY_ID, run } from './lib.mjs';
import { symmetryElements } from '../../../../../src/groups.js';
const id = process.argv[2], k = +process.argv[3] || 0, per = +process.argv[4] || 40;
const L = JSON.parse(fs.readFileSync(new URL('./out/lab.json', import.meta.url)));
const g = BY_ID[id], size = Math.sqrt(g.domainArea), spec = L[id][k];
const r = run(g, spec, { per });
const [x, y] = r.bareAt;
console.log(id, spec._name, 'bare', r.bare, 'at', x, y);
const sym = symmetryElements(g, x, y, 1.5 * size);
for (const c of sym.centers.map((c) => ({ ...c, d: Math.hypot(c.x - x, c.y - y) / size })).sort((a, b) => a.d - b.d).slice(0, 4)) console.log('  centre', c.order, c.x.toFixed(3), c.y.toFixed(3), 'at', c.d.toFixed(3));
for (const m of sym.mirrors.map((m) => ({ ...m, d: Math.abs((x - m.px) * -m.uy + (y - m.py) * m.ux) / size })).sort((a, b) => a.d - b.d).slice(0, 3)) console.log('  mirror dir', m.ux.toFixed(3), m.uy.toFixed(3), 'at', m.d.toFixed(3));
