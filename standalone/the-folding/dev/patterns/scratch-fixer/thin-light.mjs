// thin-light.mjs (fixer) — the LIGHT thin parts (slits, gaps inside a motif) of a design at a few widths, in texels.
//   node dev/patterns/scratch-fixer/thin-light.mjs stress '*632,o'
import { BY_ID } from '../../../src/groups.js';
import { makeShapePrint, thinParts, bakeShapes } from '../../../src/shapes.js';
const [key = 'stress', ids = '*632,o'] = process.argv.slice(2);
const M = await import(`../designs/${key}/design.js`);
for (const id of ids.split(',')) {
  const g = BY_ID[id], p = makeShapePrint(g, { key, shapes: M.find(g).shapes }), pitch = bakeShapes(p).pitch;
  for (const t of [1.5, 2, 3, 4]) {
    const light = thinParts(p, t * pitch).filter((r) => !r.dark);
    console.log(`${key} ${id} at ${t} texels: ${light.length} light runs` + (light.length ? `, thinnest ${Math.min(...light.map((r) => r.width / pitch)).toFixed(2)} texels` : ''));
  }
}
