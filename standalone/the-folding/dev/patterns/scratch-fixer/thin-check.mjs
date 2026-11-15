// thin-check.mjs (fixer) — src/shapes.js thinParts on the designs on disk: the parts thinner than 1.5 texels of the 3D
// texture, the longest run in texels. node dev/patterns/scratch-fixer/thin-check.mjs [a,b] ['*632,o']   (short)
import fs from 'node:fs';
import { BY_ID } from '../../../src/groups.js';
import { makeShapePrint, thinParts, bakeShapes } from '../../../src/shapes.js';
const dir = new URL('../designs/', import.meta.url);
const keys = process.argv[2] ? process.argv[2].split(',') : fs.readdirSync(dir).filter((k) => fs.existsSync(new URL(k + '/design.js', dir)));
const ids = (process.argv[3] || '*632,o,333,22x').split(',');
for (const k of keys) {
  let M;
  try { M = await import(new URL(k + '/design.js', dir)); } catch (e) { console.log(`${k}: does not load`); continue; }
  const out = [];
  for (const id of ids) {
    try {
      const g = BY_ID[id], p = makeShapePrint(g, { key: k, shapes: M.find(g).shapes }), pitch = bakeShapes(p, 1024).pitch;
      const a = performance.now(), r = thinParts(p, 1.5 * pitch), ms = performance.now() - a;
      const top = r[0];
      out.push(`${id}: ${r.length} runs` + (top ? `, longest ${(top.length / pitch).toFixed(1)} texels (${top.dark ? 'dark' : 'light'}, thinnest ${(top.width / pitch).toFixed(2)} texels near ${top.at.map((v) => v.toFixed(3)).join(', ')})` : '') + ` [${ms.toFixed(0)} ms]`);
    } catch (e) { out.push(`${id}: ${String(e.message).split('\n')[0]}`); }
  }
  console.log(`${k}\n  ${out.join('\n  ')}`);
}
