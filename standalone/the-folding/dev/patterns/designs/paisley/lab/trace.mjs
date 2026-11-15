// lab/trace.mjs — what each round of find() did for one group (KNOBS.debug).
//   node dev/patterns/designs/paisley/lab/trace.mjs '*333' ['{"knob":value}']
import { BY_ID } from '../../../../../src/groups.js';
import { find, KNOBS, resetShapes } from '../design.js';
if (process.argv[3]) { for (const [k, v] of Object.entries(JSON.parse(process.argv[3]))) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(KNOBS[k], v); else KNOBS[k] = v; } resetShapes(); }
KNOBS.debug = (ev) => console.log((ev.t === 'start' ? '' : ev.t === 'round' ? '  ' : '      ') + JSON.stringify(ev));
const res = find(BY_ID[process.argv[2] || '*333']);
console.log(JSON.stringify(res.info));
