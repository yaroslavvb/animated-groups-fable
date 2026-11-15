// scratch (art-director round): the default tile of each group in tile units (origin = group.center): vertices,
// edge kinds, cone points, and the symmetry elements nearby.
//   node dev/patterns/designs/feet/scratch/tiles.mjs [--ids 632,3*3]
import { GROUPS, symmetryElements } from '../../../../../src/groups.js';
import { buildDomain } from '../../../../../src/domain.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const ids = opt.ids ? opt.ids.split(',') : GROUPS.map((g) => g.id);
const f = (v) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3);
for (const g of GROUPS) {
  if (!ids.includes(g.id)) continue;
  const ts = Math.sqrt(g.domainArea), O = g.center, L = (p) => [(p[0] - O[0]) / ts, (p[1] - O[1]) / ts];
  const p0 = g.presets[0];
  const d = buildDomain(g, { seed: p0.seed, metric: p0.metric });
  console.log(`${g.id}  preset0 '${p0.name || ''}'  seed ${L(p0.seed).map(f)}  e1 ${g.e1.map((v) => f(v / ts))} e2 ${g.e2.map((v) => f(v / ts))}  reps ${g.reps.length}`);
  d.poly.forEach((p, i) => { const q = L(p); console.log(`   v${i} (${f(q[0])}, ${f(q[1])})  edge ${d.edges[i].kind}  len ${f(d.edges[i].len / ts)}`); });
  for (const c of d.conePoints) { const q = L([c.x, c.y]); console.log(`   cone ${c.order} at (${f(q[0])}, ${f(q[1])})`); }
  const S = symmetryElements(g, O[0], O[1], 2.2 * ts);
  const cs = S.centers.map((c) => `${c.order}${c.onMirror ? 'm' : ''}@(${f(L([c.x, c.y])[0])},${f(L([c.x, c.y])[1])})`);
  console.log(`   centres within 2.2: ${cs.join(' ')}`);
}
