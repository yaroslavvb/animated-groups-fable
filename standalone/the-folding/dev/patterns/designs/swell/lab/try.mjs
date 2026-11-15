// lab/try.mjs — build the design for some groups in node and print the time and the info (no drawing).
//   node lab/try.mjs [ids] [--set key=value,...]
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import * as D from '../design.js';

const args = process.argv.slice(2);
const ids = args[0] && !args[0].startsWith('--') ? args[0].split(',') : GROUPS.map((g) => g.id);
const si = args.indexOf('--set');
if (si >= 0) for (const kv of args[si + 1].split(',')) { const [k, v] = kv.split('='); D.KNOBS[k] = v.includes(';') ? v.split(';').map(Number) : Number.isNaN(+v) ? v : +v; }
for (const id of ids) {
  const g = BY_ID[id];
  const t0 = performance.now();
  try {
    const b = D.build(g);
    const ms = performance.now() - t0;
    const pts = b.shapes.reduce((s, p) => s + p.pts.length, 0);
    console.log(id.padEnd(6), (ms.toFixed(0) + 'ms').padStart(6), 'loops', b.shapes.length, 'pts', pts, JSON.stringify(b.info));
  } catch (e) {
    console.log(id.padEnd(6), 'ERROR', e.message, e.stack.split('\n').slice(1, 3).join(' | '));
  }
}
