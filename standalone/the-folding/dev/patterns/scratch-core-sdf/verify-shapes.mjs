// scratch-core-sdf/verify-shapes.mjs — the production path, end to end, against the shapes module's OWN numbers:
//   makeShapePrint(group, design) -> copiesIn(print, the cell's box widened by the range) -> bakeSDF
// and at every texel centre the byte against round(128 + 127 clamp(sd / range)) with sd = -+ print.margin(x, y), the sign
// from print.tone(x, y): src/shapes.js's exact distance and tone, which share no code with src/sdf.js.
//   node dev/patterns/scratch-core-sdf/verify-shapes.mjs [design keys, default demo] [--size 96] [--texels 8]
// --texels: the range in texels of the cell's shorter side (default 8). One line a design; a group that needs a look gets a row.
import { GROUPS } from '../../../src/groups.js';
import { makeShapePrint, copiesIn } from '../../../src/shapes.js';
import { bakeSDF } from '../../../src/sdf.js';
import { cellOf, edgesOf } from './scene.mjs';

const args = process.argv.slice(2), keys = [];
let size = 96, texels = 8;
for (let i = 0; i < args.length; i++) { if (args[i] === '--size') size = +args[++i]; else if (args[i] === '--texels') texels = +args[++i]; else keys.push(args[i]); }
if (!keys.length) keys.push('demo');

for (const key of keys) {
  let mod;
  try { mod = await import(`../designs/${key}/design.js`); } catch (e) { console.log(`${key}: cannot be loaded (${String(e.message).split('\n')[0]})`); continue; }
  let total = 0, off1 = 0, worst = 0, wrongTone = 0, maxEdges = 0, failed = 0, band = 0, ms = 0;
  const rows = [];
  for (const group of GROUPS) {
    let print;
    try { print = makeShapePrint(group, { key, shapes: mod.find(group).shapes }); } catch (e) { failed++; rows.push(`  ${group.id}: ${String(e.message).split('\n')[0]}`); continue; }
    const cell = cellOf(group), { origin, e1, e2 } = cell;
    const range = (texels * Math.min(Math.hypot(...e1), Math.hypot(...e2))) / size;
    const xs = [origin[0], origin[0] + e1[0], origin[0] + e2[0], origin[0] + e1[0] + e2[0]], ys = [origin[1], origin[1] + e1[1], origin[1] + e2[1], origin[1] + e1[1] + e2[1]];
    const polys = copiesIn(print, [Math.min(...xs) - range, Math.min(...ys) - range, Math.max(...xs) + range, Math.max(...ys) + range]);
    const t0 = performance.now(), data = bakeSDF({ ...cell, size, range, polys });
    ms = Math.max(ms, performance.now() - t0);
    let gOff = 0, gWorst = 0, gTone = 0;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const s = (i + 0.5) / size, t = (j + 0.5) / size, x = origin[0] + s * e1[0] + t * e2[0], y = origin[1] + s * e1[1] + t * e2[1];
      const m = print.margin(x, y), sd = print.tone(x, y) ? -m : m, got = data[j * size + i];
      const want = Math.round(128 + 127 * Math.max(-1, Math.min(1, sd / range))), d = Math.abs(want - got);
      if (m <= range) band++;
      if (d > gWorst) gWorst = d;
      if (d) gOff++;
      if ((got < 128) !== (want < 128) && m > range / 127) gTone++;
    }
    total += size * size; off1 += gOff; worst = Math.max(worst, gWorst); wrongTone += gTone; maxEdges = Math.max(maxEdges, edgesOf(polys));
    if (gWorst > 1 || gTone) rows.push(`  ${group.id}: largest difference ${gWorst} steps, ${gOff} texels differ, ${gTone} of the wrong tone   <-- LOOK`);
  }
  console.log(`${key}: ${total} texels (size ${size}, range ${texels} texels, ${(100 * band / Math.max(1, total)).toFixed(0)} % in the band), at most ${maxEdges} edges, ${ms.toFixed(1)} ms the slowest bake; ` +
    `against shapes.js margin and tone: largest difference ${worst} step(s), ${off1} texels a step off (${(100 * off1 / Math.max(1, total)).toFixed(3)} %), ${wrongTone} of the wrong tone${failed ? `; ${failed} groups without a print` : ''}`);
  for (const r of rows.slice(0, 8)) console.log(r);
}
