// lab/r3/look-bare.mjs — look.mjs for a group WITHOUT presets (the tests' path): the tile is the cell of the deepest hole.
//   node lab/r3/look-bare.mjs <id> [knobs-json]
import { BY_ID } from '../../../../../../src/groups.js';
import { find, KNOBS } from '../../design.lab.js';
const id = process.argv[2], knobs = process.argv[3] ? JSON.parse(process.argv[3]) : null;
if (knobs) Object.assign(KNOBS, knobs);
const G0 = BY_ID[id], G = { id: G0.id, e1: G0.e1, e2: G0.e2, reps: G0.reps, cellArea: G0.cellArea, domainArea: G0.domainArea, center: G0.center };
const evs = [];
KNOBS.debug = (ev) => evs.push(ev);
const res = find(G);
KNOBS.debug = null;
const I = res.info;
console.log(`${id} (no presets): ${I.marks} marks, dark ${I.cover} bare ${I.bare} stop ${I.stop}; marks ${I.long.map((l, k) => `${l}/${I.head[k]}${I.st[k] ? 's' : ''}@${I.e[k]}`).join(' ')}`);
I.tried.forEach((t) => console.log(`  start ${t.k}: ${t.kind} e ${t.e} f ${t.f} flaw ${t.flaw} bare ${t.bare} dark ${t.cover} marks ${t.marks}`));
const ends = evs.filter((e) => e.t === 'end');
if (ends.length) { const e = ends[0]; console.log('tile', JSON.stringify(e.tile)); }
