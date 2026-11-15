// lab/r3/aim.mjs — what the aimed commas reach in one round of one start (polish round): every grow() with its size,
// nearness and reward, while the round's `aim` event is on.
//   node lab/r3/aim.mjs <id> <start> [round]
import { BY_ID } from '../../../../../../src/groups.js';
import { find, KNOBS } from '../../design.lab.js';
const id = process.argv[2], start = +process.argv[3], round = +(process.argv[4] || 1);
KNOBS.onlyStart = start; if (process.env.NOSEATS) KNOBS.seats = 0;
let r = -1, inAim = false;
const rows = [];
KNOBS.debug = (ev) => { if (ev.t === 'round') { r = ev.round; inAim = false; if (r === round) console.log('round', JSON.stringify(ev)); } if (ev.t === 'aim' && r === round) console.log('aim', JSON.stringify(ev)); };
KNOBS.debugGrow = (g) => { if (r === round) rows.push(g); };
find(BY_ID[id]);
rows.sort((a, b) => b.s * b.s * b.rw - a.s * a.s * a.rw);
for (const g of rows.slice(0, 25)) console.log(`(${g.x0.toFixed(3)},${g.y0.toFixed(3)}) al ${g.al.toFixed(2)} e ${g.e} st ${g.st} s ${g.s.toFixed(3)} dn ${g.dn.toFixed(3)} rw ${g.rw.toFixed(2)}`);
console.log(rows.length, 'grows');
