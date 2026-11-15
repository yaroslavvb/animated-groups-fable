// cold.mjs — what the page does on the main thread the first time a design is shown for a group, in a fresh process
// (cold JIT): printFor (the design's find + makeShapePrint) and printUniforms (the 1024 bake) (review-math, 13 Nov 2026).
//   node dev/patterns/scratch-review-math/cold.mjs <design key> '<group id>' ['<group id>' ...]
import { pathToFileURL } from 'node:url';
const [key, ...ids] = process.argv.slice(2);
const t0 = performance.now();
const { registerPattern, printFor, printUniforms } = await import('../../../src/pattern.js');
const { BY_ID } = await import('../../../src/groups.js');
const mod = await import(pathToFileURL(new URL(`../designs/${key}/design.js`, import.meta.url).pathname).href);
registerPattern({ key: mod.meta.key, label: mod.meta.label }, mod.find);
const t1 = performance.now();
const out = [`${key}: modules ${(t1 - t0).toFixed(0)} ms`];
for (const id of ids) {
  const a = performance.now(), P = printFor(BY_ID[id], mod.meta.key), b = performance.now(), U = printUniforms(P), c = performance.now();
  out.push(`${id}: printFor ${(b - a).toFixed(1)} ms, bake ${(c - b).toFixed(1)} ms (${P.verts} vertices, texture ${U.tex.size})`);
}
console.log(out.join(' | '));
