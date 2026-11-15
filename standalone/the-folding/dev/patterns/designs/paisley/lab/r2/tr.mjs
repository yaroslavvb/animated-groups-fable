// lab/r2/tr.mjs — what each family of find() did for one group (KNOBS.debug): the start, every round's bare disc and
// the fit, and where the largest bare disc is at the end (with the tile's corners, local frame, tile sizes).
//   node dev/patterns/designs/paisley/lab/r2/tr.mjs '*442' ['{"knob":value}'] [--design design.js]
import { BY_ID } from '../../../../../../src/groups.js';
const args = process.argv.slice(2);
const di = args.indexOf('--design');
const mod = await import('../../' + (di >= 0 ? args[di + 1] : 'design.js'));
const rest = di >= 0 ? args.filter((a, i) => i !== di && i !== di + 1) : args;
if (rest[1]) { for (const [k, v] of Object.entries(JSON.parse(rest[1]))) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(mod.KNOBS[k], v); else mod.KNOBS[k] = v; } if (mod.resetShapes) mod.resetShapes(); }
let tileSaid = false;
mod.KNOBS.debug = (ev) => {
  if (ev.t === 'end' && ev.tile) { if (!tileSaid) { console.log('tile', JSON.stringify(ev.tile)); tileSaid = true; } delete ev.tile; }
  if (ev.t === 'round') delete ev.seats;
  console.log((ev.t === 'start' ? '' : ev.t === 'round' || ev.t === 'end' ? '  ' : '      ') + JSON.stringify(ev));
};
const res = mod.find(BY_ID[rest[0] || '*442']);
const I = res.info;
console.log(JSON.stringify({ marks: I.marks, long: I.long, head: I.head, st: I.st, e: I.e, scale: I.scale, bare: I.bare, cover: I.cover }));
console.log('tried', JSON.stringify(I.tried));
