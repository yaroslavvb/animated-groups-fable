// lab/r3/shapecost.mjs — what building the comma shapes costs, cold (a fresh process) and warm.
import { glyph } from '../../design.js';
const t0 = performance.now();
let n = 0;
for (let k = 0; k <= 20; k += 2) for (const st of [0, 1]) { glyph(k / 16, st, st ? 16 : 7); n++; }
const t1 = performance.now();
for (let k = 1; k <= 19; k += 2) for (const st of [0, 1]) { glyph(k / 16, st, st ? 16 : 7); n++; }
const t2 = performance.now();
console.log(`${n} shapes: the first 22 cold ${(t1 - t0).toFixed(1)} ms, the next 20 ${(t2 - t1).toFixed(1)} ms`);
