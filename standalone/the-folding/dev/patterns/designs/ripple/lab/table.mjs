// the table of NOTES.md: node dev/patterns/designs/ripple/lab/table.mjs <rows.json of proto.mjs>
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { find } from '../design.js';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
console.log('| group | seat | comma r | long | stretch (plane x own) | dark | bare | solid | pts | ms (mini) | corners beyond the ring |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  const g = BY_ID[r.id], i = find(g).info;
  const corners = i.corners.filter((c) => c.beyond > 0.19).map((c) => (c.bands ? `${c.bands} band${c.bands > 1 ? 's' : ''}` : 'swell') + ` (+${c.beyond.toFixed(2)})`).join(', ') || 'pools';
  const long = (2 * i.r * i.sigma * Math.sqrt(i.stretch)).toFixed(2);
  console.log(`| ${g.id.replace(/\*/g, '\\*')} | ${i.seat} | ${i.r.toFixed(3)} | ${long} | ${i.stretch.toFixed(2)} x ${i.sigma} | ${r.coverage.toFixed(3)} | ${r.emptyDisc.toFixed(3)} | ${r.darkDisc.toFixed(3)} | ${r.verts} | ${r.ms} | ${corners} |`);
}
const mm = (k) => [Math.min(...rows.map((r) => r[k])), Math.max(...rows.map((r) => r[k]))];
console.log('\nranges: dark', mm('coverage'), 'bare', mm('emptyDisc'), 'solid', mm('darkDisc'), 'pts', mm('verts'), 'ms', mm('ms'));
