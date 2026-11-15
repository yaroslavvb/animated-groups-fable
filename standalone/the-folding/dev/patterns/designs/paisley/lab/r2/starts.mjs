// lab/r2/starts.mjs — which start of the big comma won in each group, and the flaw of every start tried (kind: 'L' the
// largest comma of a curl range, 'C<i>' its tip in corner i of the tile, 'S<f>' a smaller copy), with the time of each
// family (node on the Intel).
//   node dev/patterns/designs/paisley/lab/r2/starts.mjs [ids] ['{"knob":value}']
import { GROUPS, BY_ID } from '../../../../../../src/groups.js';
import { find, KNOBS, resetShapes } from '../../design.js';
const ids = process.argv[2] ? process.argv[2].split(',') : GROUPS.map((g) => g.id);
if (process.argv[3]) { for (const [k, v] of Object.entries(JSON.parse(process.argv[3]))) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(KNOBS[k], v); else KNOBS[k] = v; } resetShapes(); }
let t0 = 0, times = [];
KNOBS.debug = (ev) => { if (ev.t === 'start') t0 = performance.now(); if (ev.t === 'end') times.push(performance.now() - t0); };
for (const id of ids) {
  find(BY_ID[id]);
  times = [];
  const T = performance.now(), I = find(BY_ID[id]).info, all = performance.now() - T;
  const win = I.tried.reduce((b, t, k) => (t.flaw < I.tried[b].flaw - 1e-9 ? k : b), 0);
  console.log(id.padEnd(6), `${all.toFixed(0)}ms`.padStart(6), I.tried.map((t, k) => `${k === win ? '*' : ''}${t.kind || ''}${t.e}:${t.flaw}(${t.bare}/${t.cover}/${t.marks})${times[k] ? '~' + times[k].toFixed(0) : ''}`).join('  '));
}
