// scratch-core-sdf/cold.mjs — the FIRST bake of a fresh process (what the page pays when a shape print is first shown):
// the code is not yet compiled by the optimising tiers. Then the next five, as they warm up.
//   node dev/patterns/scratch-core-sdf/cold.mjs [size, default 1024] [module, default ../../../src/sdf.js]
import { blobs, edgesOf } from './scene.mjs';

const size = +process.argv[2] || 1024, mod = process.argv[3] || '../../../src/sdf.js';
const { bakeSDF } = await import(mod);
const polys = blobs();
const spec = { origin: [0, 0], e1: [1, 0], e2: [0, 1], size, range: 8 / size, polys };
const ms = [];
let sum = 0;
for (let i = 0; i < 6; i++) { const t0 = performance.now(); const d = bakeSDF(spec); ms.push((performance.now() - t0).toFixed(1)); sum += d[12345 % d.length]; }
let h = 0;
for (const v of bakeSDF(spec)) h = (h * 31 + v) >>> 0;
console.log(`${mod.split('/').pop()}: ${edgesOf(polys)} edges, size ${size}, range 8 texels: first bake ${ms[0]} ms, then ${ms.slice(1).join(', ')} ms   (checksum ${h})`);
