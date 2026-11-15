// lab/r3/look.mjs — one group in detail (polish round, 14 Nov 2026): the tile's corners (angle, order of the point),
// every start tried (flaw, bare, dark, marks), the rounds of the winner, its marks and where its largest bare disc is.
//   node lab/r3/look.mjs <id> [knobs-json] [design]
import { BY_ID } from '../../../../../../src/groups.js';
const id = process.argv[2], knobs = process.argv[3] ? JSON.parse(process.argv[3]) : null;
const mod = await import('../../' + (process.argv[4] || 'design.lab.js'));
const { find, KNOBS } = mod;
if (knobs) { for (const [k, v] of Object.entries(knobs)) { if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(KNOBS[k], v); else KNOBS[k] = v; } if (mod.resetShapes) mod.resetShapes(); }
const G = BY_ID[id];
const evs = [];
KNOBS.debug = (ev) => evs.push(ev);
find(G);
evs.length = 0;
const t0 = performance.now(), res = find(G), ms = performance.now() - t0;
KNOBS.debug = null;
const I = res.info;
// split the events per family
const fams = [];
for (const ev of evs) { if (ev.t === 'start') fams.push([]); if (fams.length) fams[fams.length - 1].push(ev); }
const end = (f) => f.find((e) => e.t === 'end');
const tile = fams.length && end(fams[0]) ? end(fams[0]).tile : null;
if (tile) {
  const n = tile.length;
  console.log('tile', tile.map((p, i) => {
    const a = tile[(i + n - 1) % n], b = tile[(i + 1) % n], ax = a[0] - p[0], ay = a[1] - p[1], bx = b[0] - p[0], by = b[1] - p[1];
    const ang = (Math.acos((ax * bx + ay * by) / Math.hypot(ax, ay) / Math.hypot(bx, by)) * 180) / Math.PI;
    return `#${i}(${p[0].toFixed(2)},${p[1].toFixed(2)})${ang.toFixed(0)}°`;
  }).join(' '));
}
console.log(`${id}: ${ms.toFixed(0)} ms, ${I.marks} marks, dark ${I.cover} bare ${I.bare} stop ${I.stop} scale ${I.scale}`);
console.log('marks', I.long.map((l, k) => `${l}/${I.head[k]}${I.st[k] ? 's' : 'l'}@${I.e[k]}`).join('  '));
I.tried.forEach((t, k) => console.log(`  start ${k}: ${t.kind} e ${t.e} f ${t.f} flaw ${t.flaw} bare ${t.bare} dark ${t.cover} marks ${t.marks} tiny ${t.tiny}`));
// the winner's family: the one whose end matches the result
const win = fams.find((f) => { const e = end(f); return e && Math.abs(e.bare - I.bare) < 1e-3 && Math.abs(e.cover - I.cover) < 1e-3; });
if (win) for (const ev of win) {
  if (ev.t === 'start') console.log(`  big: e ${ev.e} s ${ev.s} long ${ev.long}`);
  else if (ev.t === 'round') console.log(`  round ${ev.round}: bare ${ev.bare} dark ${ev.cover} at (${ev.b}) seats ${ev.seats.length}`);
  else if (ev.t === 'fit') console.log(`    fit ${ev.from}${ev.corner ? ' corner' : ''} st ${ev.st} at (${ev.x},${ev.y}) e ${ev.e} s ${ev.s0}->${ev.s} long ${ev.long} gap ${ev.gap}`);
  else if (ev.t === 'nofit') console.log('    no fit');
  else if (ev.t === 'aim') console.log(`    aim: ${JSON.stringify(ev)}`);
  else if (ev.t === 'end') console.log(`  end: bare ${ev.bare} at (${ev.at}) self ${ev.self} dark ${ev.cover}`);
}
