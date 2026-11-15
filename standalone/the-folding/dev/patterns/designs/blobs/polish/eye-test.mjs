// polish/eye-test.mjs — find() with an eye in the head of every stroke of some groups: the hole's radius (from its
// area), the outline's vertices, and a variants file for polish/view2.mjs.
//   node polish/eye-test.mjs --ids 'o,xx,333' --eye 0.07 [--d 0.1] [--out polish/eye.json]
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { STROKES, find } from '../design.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const r = +opt.eye || 0.07, d = opt.d !== undefined ? +opt.d : undefined;
const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const j = (i + 1) % p.length; s += p[i][0] * p[j][1] - p[j][0] * p[i][1]; } return Math.abs(s / 2); };
const V = [];
for (const id of opt.ids.split(',')) {
  const g = BY_ID[id], base = STROKES[id];
  const withEye = (s) => ({ ...s, eye: d === undefined ? [r] : [r, d] });
  const st = Array.isArray(base) ? base.map((s, k) => (k === 0 ? withEye(s) : s)) : withEye(base);
  STROKES[id] = st;
  const t0 = performance.now(), res = find(g), ms = performance.now() - t0;
  STROKES[id] = base;
  const s = Math.sqrt(g.domainArea);
  const holes = res.shapes.filter((p) => p.hole).map((p) => Math.sqrt(area(p.pts) / Math.PI) / s);
  console.log(`${id.padEnd(6)} ${ms.toFixed(0).padStart(4)} ms  polys ${res.shapes.length}  holes r ${holes.map((h) => h.toFixed(3)).join(' ')}  pts ${res.shapes.reduce((n, p) => n + p.pts.length, 0)}  cover ${res.info.cover.toFixed(3)}`);
  V.push({ id, stroke: st, label: `${id} eye ${r}` });
}
if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(V, null, 1));
