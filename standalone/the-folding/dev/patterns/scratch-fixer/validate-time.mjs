// validate-time.mjs (fixer) — what validateShapes costs per group for the designs on disk (it would run in printFor, once
// per group and pattern), next to find and makeShapePrint; and which designs break the rules now (GAP_MIN, and the
// texture's 2 texels). node dev/patterns/scratch-fixer/validate-time.mjs [a,b,c]   (a short run: well under 20 s)
import fs from 'node:fs';
import { GROUPS } from '../../../src/groups.js';
import { makeShapePrint, validateShapes, GAP_MIN } from '../../../src/shapes.js';

const dir = new URL('../designs/', import.meta.url);
const keys = process.argv[2] ? process.argv[2].split(',') : fs.readdirSync(dir).filter((k) => fs.existsSync(new URL(k + '/design.js', dir)));
const t = () => performance.now();
for (const k of keys) {
  let M;
  try { M = await import(new URL(k + '/design.js', dir)); } catch (e) { console.log(`${k}: does not load: ${String(e.message).split('\n')[0]}`); continue; }
  let worstV = 0, sumV = 0, worstF = 0, n = 0;
  const bad = [];
  for (const g of GROUPS) {
    try {
      let a = t(); const f = M.find(g); const tf = t() - a;
      const p = makeShapePrint(g, { key: k, shapes: f.shapes });
      a = t(); const v = validateShapes(p, { gap: 0.005 }); const tv = t() - a;
      const v2 = validateShapes(p, { gap: GAP_MIN });
      worstV = Math.max(worstV, tv); sumV += tv; worstF = Math.max(worstF, tf); n++;
      if (!v.ok) bad.push(`${g.id}: ${v.problems[0]}`);
      else if (!v2.ok) bad.push(`${g.id} (GAP_MIN only): ${v2.problems[0]}`);
    } catch (e) { bad.push(`${g.id}: find throws: ${String(e.message).split('\n')[0]}`); }
  }
  console.log(`${k}: validate ${(sumV / Math.max(1, n)).toFixed(1)} ms a group (worst ${worstV.toFixed(1)}), find worst ${worstF.toFixed(0)} ms` + (bad.length ? `\n   ${bad.slice(0, 4).join('\n   ')}${bad.length > 4 ? `\n   ... ${bad.length - 4} more` : ''}` : ''));
}
