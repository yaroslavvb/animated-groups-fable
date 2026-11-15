// exp/check.mjs — a design module through the production validator, all 17 groups: ms, vertices, gap, stabilizer, info.
//   node dev/patterns/designs/spiral/exp/check.mjs <module path relative to this folder> [ids]
import { GROUPS } from '../../../../../src/groups.js';
import { makeShapePrint, validateShapes } from '../../../../../src/shapes.js';

const mod = await import(new URL(process.argv[2] || './curl.js', import.meta.url).href);
const only = process.argv[3] ? process.argv[3].split(',') : null;
const rows = [];
for (const g of GROUPS) {
  if (only && !only.includes(g.id)) continue;
  const t0 = performance.now();
  let res, err = '';
  try { res = mod.find(g); } catch (e) { err = String(e.message || e).slice(0, 80); }
  const ms = +(performance.now() - t0).toFixed(1);
  if (!res) { rows.push({ id: g.id, ms, err }); continue; }
  const pr = makeShapePrint(g, { key: 'x', shapes: res.shapes }), v = validateShapes(pr);
  rows.push({ id: g.id, ms, verts: pr.verts, ok: v.ok, gap: +(v.gap || 0).toFixed(3), stab: v.stabilizer, problems: v.problems.join('; ').slice(0, 60), info: JSON.stringify(res.info).slice(0, 90) });
}
console.table(rows);
