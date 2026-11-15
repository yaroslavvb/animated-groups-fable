// lab/ad/trace2.mjs — as lab/trace.mjs, with the tails' own account (KNOBS.debugTail).
//   node dev/patterns/designs/paisley/lab/ad/trace2.mjs '*632' [rounds to show, default 1]
import { BY_ID } from '../../../../../../src/groups.js';
import { find, KNOBS } from '../../design.js';
let round = -1;
const show = +(process.argv[3] || 1);
KNOBS.debug = (ev) => { if (ev.t === 'round') round = ev.round; if (ev.t === 'start') round = -1; if (round < show) console.log((ev.t === 'start' ? '' : ev.t === 'round' ? '  ' : '      ') + JSON.stringify(ev).slice(0, 300)); };
KNOBS.debugTail = (ev) => { if (round < show) console.log('          tail ' + JSON.stringify(ev)); };
const res = find(BY_ID[process.argv[2] || '*632']);
console.log(JSON.stringify(res.info).slice(0, 400));
