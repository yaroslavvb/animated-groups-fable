// lab/r3/cold.mjs — find() cold (the first call in a fresh process: no shape built, nothing compiled) and warm, for the
// groups named, each in its own fresh module instance (a query string re-imports design.js).
//   node lab/r3/cold.mjs '*632,2*22'
import { BY_ID } from '../../../../../../src/groups.js';
const ids = (process.argv[2] || '*632').split(',');
let n = 0;
for (const id of ids) {
  const mod = await import('../../design.js?fresh=' + n++);
  const t0 = performance.now(); mod.find(BY_ID[id]); const t1 = performance.now(); mod.find(BY_ID[id]); const t2 = performance.now();
  console.log(id.padEnd(6), `first ${(t1 - t0).toFixed(1)} ms, again ${(t2 - t1).toFixed(1)} ms`);
}
