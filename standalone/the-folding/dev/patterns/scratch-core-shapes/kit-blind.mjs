// scratch: where the kit's overlap number is blind. For a design as it is now: kit.measure().overlap beside what
// src/shapes.js finds (validateShapes: do two copies cross; measureShapes: the share covered twice).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BY_ID } from '../../../src/groups.js';
import { normalize, measure, stabilizerOrder } from '../kit.js';
import { makeShapePrint, validateShapes, measureShapes } from '../../../src/shapes.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const key = process.argv[2] || 'blobs', ids = (process.argv[3] || '442,632,*442,*632,333').split(',');
const mod = await import(pathToFileURL(path.resolve(here, '../designs', key, 'design.js')).href);
for (const id of ids) {
  const g = BY_ID[id];
  let res; try { res = mod.find(g); } catch (e) { console.log(id, 'throws', e.message); continue; }
  const N = normalize(res.shapes), P = makeShapePrint(g, { shapes: res.shapes }), V = validateShapes(P);
  const K = measure(g, N, { per: 24 }), M = measureShapes(P, { per: 24 });
  console.log(id.padEnd(6), '| kit: stabiliser', stabilizerOrder(g, N), 'overlap', K.overlap, 'coverage', K.coverage, '| shapes.js: stabiliser', V.stabilizer, 'overlap', M.overlap, 'coverage', M.coverage, 'exact', M.coverageExact, '|', V.ok ? 'ok' : V.problems[0]);
}
