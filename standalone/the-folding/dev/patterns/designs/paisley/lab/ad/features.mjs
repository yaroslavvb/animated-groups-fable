// lab/ad/features.mjs — the art director's counts for the critique: per group and per mark, how long, how wide the
// head, and how much of the tail is thinner than 0.04 tile sizes (rule c of the brief). Works for v1 (info.head, info.e)
// by rebuilding the taper from KNOBS.shape.
//   node dev/patterns/designs/paisley/lab/ad/features.mjs [design file relative to this folder, default ../../design.v1.js]
import { GROUPS } from '../../../../../../src/groups.js';
const file = process.argv[2] || '../../design.v1.js';
const { find, KNOBS } = await import(file);
const K = KNOBS.shape;
let all = 0, small = 0, thin = 0;
for (const G of GROUPS) {
  const I = find(G).info, out = [];
  for (let k = 0; k < I.marks; k++) {
    const e = I.e[k], d = I.head[k], q = K.taper0 + (K.taper1 - K.taper0) * e, cEnd = Math.acos(Math.pow(K.tip, 1 / q));
    // the share of the spine where the tail is under 0.04 wide: d * cos(cEnd t)^q < 0.04
    const r = 0.04 / d, t = r >= 1 ? 0 : Math.acos(Math.pow(r, 1 / q)) / cEnd;
    out.push(`${I.long[k].toFixed(2)} long, head ${d.toFixed(2)}, e ${e}, tail under 0.04 for the last ${(100 * (1 - Math.min(1, t))).toFixed(0)}%`);
    all++; if (I.long[k] < 0.3) small++; if (1 - t > 0.4) thin++;
  }
  console.log(G.id.padEnd(6), `${I.marks} marks:`, out.join(' | '));
}
console.log(`marks ${all}; shorter than 0.30: ${small}; tail under 0.04 for more than 40% of the spine: ${thin}`);
