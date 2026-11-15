// lab/r3/winners.mjs — the WINNERS table of design.js (polish round, 14 Nov 2026): runs the full search (KNOBS.table
// off) for each of the 17 groups, prints the table's rows, then checks that the design WITH its table gives exactly
// the same motif (every point) and how long each takes.
//   node lab/r3/winners.mjs [make|check]
import { GROUPS } from '../../../../../../src/groups.js';
import { find, KNOBS } from '../../design.js';
const mode = process.argv[2] || 'check';
const rows = [], full = new Map();
for (const g of GROUPS) {
  KNOBS.table = false;
  const t0 = performance.now(), r = find(g), ms = performance.now() - t0;
  full.set(g.id, r);
  const w = r.info.won, kind = ['L', 'P', 'C', 'S', 'CS'][w[2]] + (w[2] === 1 ? `${w[3]}${w[4]}` : w[2] === 2 || w[2] === 4 ? w[3] : '') + (w[5] ? ' quick' : '');
  rows.push(`  [${w.join(', ')}],   // ${g.id} (${kind}; the search: ${ms.toFixed(0)} ms here)`);
}
if (mode === 'make') { console.log('const WINNERS = [\n' + rows.join('\n') + '\n];'); process.exit(0); }
KNOBS.table = true;
KNOBS.pinned = false;              // (15 Nov: the start of the table grown, not GROWN drawn — lab/r3/grown.mjs checks that)
let bad = 0;
for (const g of GROUPS) {
  let ms = Infinity, r;
  for (let k = 0; k < 2; k++) { const t0 = performance.now(); r = find(g); ms = Math.min(ms, performance.now() - t0); }
  const a = full.get(g.id).shapes, b = r.shapes;
  const same = a.length === b.length && a.every((s, i) => s.pts.length === b[i].pts.length && s.pts.every((p, j) => p[0] === b[i].pts[j][0] && p[1] === b[i].pts[j][1]));
  if (!same || !r.info.looked) bad++;
  console.log(g.id.padEnd(6), r.info.looked ? 'table ' : 'SEARCH', same ? 'same' : 'DIFFERENT', `${ms.toFixed(1)} ms`);
}
console.log(bad ? `${bad} groups differ or missed the table` : 'all 17 from the table, the same motifs');
