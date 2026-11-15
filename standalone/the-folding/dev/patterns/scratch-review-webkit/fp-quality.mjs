// dev/patterns/scratch-review-webkit/fp-quality.mjs — the Paisley that WebKit (Safari) makes, held to the checks of
// test/patterns-shipped.test.js (which only ever sees node's): printable, GAP_MIN, exactly the group's, 0.40-0.62 dark,
// no bare disc over 0.5, nothing under 1.5 texels; beside Chrome's and node's for the same group.
//   node dev/patterns/scratch-review-webkit/fp-quality.mjs [key] [engines]     (default: paisley, node,chromium,webkit)
import fs from 'node:fs';
import path from 'node:path';
import { GROUPS } from '../../../src/groups.js';
import { exactlyInvariant } from '../../../src/pattern.js';
import { makeShapePrint, printable, validateShapes, measureShapes, thinParts, texelPitch, GAP_MIN } from '../../../src/shapes.js';

const dir = '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-webkit/fp';
const key = process.argv[2] || 'paisley', engines = (process.argv[3] || 'node,chromium,webkit').split(',');
const data = Object.fromEntries(engines.map((e) => [e, JSON.parse(fs.readFileSync(path.join(dir, `fp-${e}.json`), 'utf8')).motifs.out]));
const t0 = Date.now(), rows = [];
for (const g of GROUPS) {
  const cells = [];
  for (const e of engines) {
    const m = data[e][`${key} ${g.id}`];
    if (!m) { cells.push(`${e}: none`); continue; }
    const P = makeShapePrint(g, { key, name: key, shapes: m.polys });
    const pr = printable(P), V = validateShapes(P), ms = measureShapes(P), pitch = texelPitch(g), thin = thinParts(P, 1.5 * pitch);
    const inv = exactlyInvariant(g, P, 30, 7);
    const bad = [];
    if (!pr.ok) bad.push('NOT PRINTABLE ' + pr.problems.join('|'));
    if (!V.ok || V.gap < GAP_MIN) bad.push(`GAP ${V.gap.toFixed(4)} ${V.problems.join('|')}`);
    if (!inv) bad.push('NOT INVARIANT');
    if (!(ms.coverage >= 0.40 && ms.coverage <= 0.62)) bad.push(`DARK ${ms.coverage.toFixed(3)}`);
    if (!(ms.emptyDisc <= 0.5)) bad.push(`BARE ${ms.emptyDisc.toFixed(3)}`);
    if (ms.overlap) bad.push(`OVERLAP ${ms.overlap}`);
    if (thin.length) bad.push(`THIN ${thin.map((r) => (r.length / pitch).toFixed(1) + 'tx<' + (r.width / pitch).toFixed(2)).join(',')}`);
    cells.push(`${e}: dark ${ms.coverage.toFixed(3)} bare ${ms.emptyDisc.toFixed(3)} solid ${ms.darkDisc.toFixed(3)} gap ${V.gap.toFixed(3)} marks ${m.polys.length} ${bad.length ? '<<< ' + bad.join('; ') : 'ok'}`);
  }
  rows.push(`${g.id.padEnd(6)} ${cells.join(' | ')}`);
}
console.log(`${key}: the checks of test/patterns-shipped.test.js on each engine's motif (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
for (const r of rows) console.log(r);
