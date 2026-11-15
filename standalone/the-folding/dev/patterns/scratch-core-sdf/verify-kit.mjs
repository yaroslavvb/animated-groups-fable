// scratch-core-sdf/verify-kit.mjs — bakeSDF on what it is for: the orbit of a kit design's motif on the lattice cell of
// each of the 17 groups, held against the kit's own tone (kit.toneAt: W by counting, per element of the group).
//   node dev/patterns/scratch-core-sdf/verify-kit.mjs [design keys, default demo] [--size 128] [--rows]
// Per group: the copies and edges that reach the cell, the dark share, the texels whose tone disagrees with the kit
// (those within a step of 128 left out: they are ON an outline), the largest jump of the byte across the two seams of
// the cell against the largest jump the distance allows, and the time of a bake at 1024. With several designs: one
// line a design, and the rows of the groups that need a look (--rows: all rows).
import { GROUPS } from '../../../src/groups.js';
import { normalize, toneAt } from '../kit.js';
import { bakeSDF } from '../../../src/sdf.js';
import { cellOf, cellPolys, edgesOf } from './scene.mjs';

const args = process.argv.slice(2), keys = [];
let size = 128, rows = false;
for (let i = 0; i < args.length; i++) { if (args[i] === '--size') size = +args[++i]; else if (args[i] === '--rows') rows = true; else keys.push(args[i]); }
if (!keys.length) keys.push('demo');
if (keys.length === 1) rows = true;
const head = 'group   polys  edges  dark %   tone != kit   seam e1 (max allowed)   seam e2 (max allowed)   ms at 1024';

for (const key of keys) {
  let mod;
  try { mod = await import(`../designs/${key}/design.js`); } catch (e) { console.log(`${key}: cannot be loaded (${String(e.message).split('\n')[0]})`); continue; }
  const out = [];
  let worstBad = 0, total = 0, maxEdges = 0, maxMs = 0, flagged = 0, failed = 0, darkMin = 1, darkMax = 0;
  for (const group of GROUPS) {
    let N;
    try { N = normalize(mod.find(group).shapes); } catch (e) { failed++; out.push(`${group.id.padEnd(6)} find() threw: ${String(e.message).split('\n')[0]}`); continue; }
    const cell = cellOf(group), range = 0.03 * Math.sqrt(group.domainArea), polys = cellPolys(group, N, cell, range);
    const data = bakeSDF({ ...cell, size, range, polys }), { origin, e1, e2 } = cell;
    let bad = 0, dark = 0;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const s = (i + 0.5) / size, t = (j + 0.5) / size, v = data[j * size + i];
      if (v < 128) dark++;
      if (Math.abs(v - 128) <= 1) continue;
      if ((v < 128) !== (toneAt(group, N, origin[0] + s * e1[0] + t * e2[0], origin[1] + s * e1[1] + t * e2[1]) === 1)) bad++;
    }
    let seamA = 0, seamB = 0;
    for (let q = 0; q < size; q++) {
      seamA = Math.max(seamA, Math.abs(data[q * size] - data[q * size + size - 1]));
      seamB = Math.max(seamB, Math.abs(data[q] - data[(size - 1) * size + q]));
    }
    const capA = (127 * Math.hypot(...e1)) / size / range + 1, capB = (127 * Math.hypot(...e2)) / size / range + 1;
    const big = { ...cell, size: 1024, range, polys };
    let ms = Infinity;
    for (let q = 0; q < 3; q++) { const t0 = performance.now(); bakeSDF(big); ms = Math.min(ms, performance.now() - t0); }
    const look = bad > 0 || seamA > capA || seamB > capB, share = dark / (size * size);
    worstBad = Math.max(worstBad, bad); total += size * size; maxEdges = Math.max(maxEdges, edgesOf(polys)); maxMs = Math.max(maxMs, ms);
    darkMin = Math.min(darkMin, share); darkMax = Math.max(darkMax, share);
    if (look) flagged++;
    if (rows || look) out.push(`${group.id.padEnd(6)} ${String(polys.length).padStart(5)} ${String(edgesOf(polys)).padStart(6)}  ${(100 * share).toFixed(1).padStart(5)}   ${String(bad).padStart(6)}        ${String(seamA).padStart(4)} (${capA.toFixed(1)})            ${String(seamB).padStart(4)} (${capB.toFixed(1)})           ${ms.toFixed(1).padStart(6)}${look ? '   <-- LOOK' : ''}`);
  }
  console.log(`${key}${mod.meta && mod.meta.label ? ' (' + mod.meta.label + ')' : ''}: ${total} texels at size ${size}, range 0.03 tile sizes; dark ${(100 * darkMin).toFixed(0)}..${(100 * darkMax).toFixed(0)} %; at most ${maxEdges} edges; ` +
    `the slowest bake at 1024: ${maxMs.toFixed(1)} ms; tone against the kit: ${worstBad ? 'UP TO ' + worstBad + ' TEXELS DIFFER in a group' : 'no texel differs'}; ${flagged} groups to look at${failed ? '; find() failed for ' + failed : ''}`);
  if (out.length) { console.log(head); for (const l of out) console.log(l); }
}
