// lab/r5/quick.mjs — find() on every group: blobs, symmetric blobs, specks, vertices, ms (no measuring: fast).
//   node lab/r5/quick.mjs [--ids a,b]
import { GROUPS, BY_ID } from '../../../../../../src/groups.js';
import { find } from '../../design.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const j = (i + 1) % p.length; s += p[i][0] * p[j][1] - p[j][0] * p[i][1]; } return Math.abs(s / 2); };
for (const id of ids) {
  const g = BY_ID[id];
  find(g);
  const t0 = performance.now(), r = find(g), ms = performance.now() - t0;
  const A = g.domainArea, verts = r.shapes.reduce((n, s) => n + s.pts.length, 0);
  const shares = r.shapes.map((s) => (s.hole ? -1 : 1) * area(s.pts) / A);
  const flags = [];
  if (r.info.symmetric) flags.push(`${r.info.symmetric} symmetric`);
  if (!r.info.bounded) flags.push('unbounded');
  if (shares.some((a) => Math.abs(a) < 0.02)) flags.push('speck');
  if (verts > 2400) flags.push('verts');
  console.log(`${id.padEnd(6)} ${ms.toFixed(1).padStart(6)} ms  ${String(verts).padStart(4)} pts  cover ${r.info.cover.toFixed(3)}  polys ${shares.map((a) => a.toFixed(3)).join(' ')}${flags.length ? '   !! ' + flags.join(', ') : ''}`);
}
