// lab/r3/grown.mjs — the GROWN table of design.js (15 Nov 2026, after the WebKit review of the round): what the start of
// WINNERS grows into, mark by mark, for each of the 17 default tiles, exactly as the search leaves it (KNOBS.pinned off);
// then a check that the design DRAWING the table gives the same motif, every point, as growing it does — on the machine
// that made the table; elsewhere the growing may differ (that is why the table exists), the drawing does not.
//   node lab/r3/grown.mjs make      print the table (made in node on the mini, arm64; node on the Intel grows the same marks)
//   node lab/r3/grown.mjs check     table against growing, and the times
//   node lab/r3/grown.mjs json <file>   every group's grown motif and flaw as JSON (to compare two machines)
import fs from 'node:fs';
import os from 'node:os';
import { GROUPS } from '../../../../../../src/groups.js';
import { find, KNOBS } from '../../design.js';

const mode = process.argv[2] || 'check';
const grow = (g) => { KNOBS.pinned = false; try { return find(g); } finally { KNOBS.pinned = true; } };
const flawOf = (r) => (r.info.tried.length ? Math.min(...r.info.tried.map((t) => t.flaw)) : null);
if (mode === 'make') {
  const rows = GROUPS.map((g) => {
    const r = grow(g), I = r.info;
    if (!I.looked) throw new Error(`${g.id}: not in WINNERS — the table has no start for it`);
    return `  [${I.cover}, ${I.bare}, '${I.stop}', ${I.scale}, [   // ${g.id} (flaw ${flawOf(r)})\n` + I.grown.map((m) => `    [${m.join(', ')}]`).join(',\n') + ']],';
  });
  console.log(`// (lab/r3/grown.mjs make, ${os.arch()}, node ${process.version})`);
  console.log('const GROWN = [\n' + rows.join('\n') + '\n];');
  process.exit(0);
}
if (mode === 'json') {
  const out = {};
  for (const g of GROUPS) { const r = grow(g); out[g.id] = { flaw: flawOf(r), info: r.info, shapes: r.shapes }; }
  fs.writeFileSync(process.argv[3], JSON.stringify({ arch: os.arch(), node: process.version, out }));
  console.log(`written: ${process.argv[3]}`);
  process.exit(0);
}
let bad = 0;
for (const g of GROUPS) {
  const t0 = performance.now(), a = grow(g), msGrow = performance.now() - t0;
  let ms = Infinity, b;
  for (let k = 0; k < 3; k++) { const t1 = performance.now(); b = find(g); ms = Math.min(ms, performance.now() - t1); }
  const same = a.shapes.length === b.shapes.length && a.shapes.every((s, i) => s.pts.length === b.shapes[i].pts.length && s.pts.every((p, j) => p[0] === b.shapes[i].pts[j][0] && p[1] === b.shapes[i].pts[j][1]));
  if (!same || !b.info.pinned) bad++;
  console.log(g.id.padEnd(6), b.info.pinned ? 'drawn ' : 'GROWN ', same ? 'same' : 'DIFFERENT', `grown ${msGrow.toFixed(1)} ms, drawn ${ms.toFixed(2)} ms`);
}
console.log(`${os.arch()} node ${process.version}: ` + (bad ? `${bad} groups differ from growing or missed the table` : 'all 17 drawn from the table, the same motifs as growing'));
