// scratch: measureShapes on a design of the round as it is now (do real motifs go through; what does it cost)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GROUPS } from '../../../src/groups.js';
import { makeShapePrint, validateShapes, measureShapes } from '../../../src/shapes.js';
const here = path.dirname(fileURLToPath(import.meta.url)), key = process.argv[2] || 'paisley';
const mod = await import(pathToFileURL(path.resolve(here, '../designs', key, 'design.js')).href);
let total = 0;
for (const g of GROUPS) {
  let res; try { res = mod.find(g); } catch (e) { console.log(g.id, 'throws', e.message); continue; }
  const P = makeShapePrint(g, { key, shapes: res.shapes }), t0 = performance.now(), M = measureShapes(P), dt = performance.now() - t0, V = validateShapes(P);
  total += dt;
  console.log(`${g.id.padEnd(6)} ${String(P.verts).padStart(4)} pts ${P.polys.length} polys  dark ${M.coverage.toFixed(3)} (exact ${M.coverageExact === null ? 'none' : M.coverageExact.toFixed(4)})  bare ${M.emptyDisc.toFixed(3)}  solid ${M.darkDisc.toFixed(3)}  overlap ${M.overlap}  W ${M.stabilizer}  gap ${V.gap.toFixed(4)}  ${dt.toFixed(0)} ms  ${V.ok ? 'ok' : V.problems[0]}`);
}
console.log(`${key}: measureShapes took ${total.toFixed(0)} ms for the 17 groups`);
