// scratch: tone() and margin() calls a second on a motif of 300 vertices (the page's comma drawn with 300 points), and
// what makeShapePrint, validateShapes and measureShapes cost, on this machine.
import { BY_ID, GROUPS } from '../../../src/groups.js';
import { motifFor, commaOutline } from '../../../src/motif.js';
import { makeShapePrint, validateShapes, measureShapes, fillShapes, copiesIn } from '../../../src/shapes.js';
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const unit = commaOutline({ nBack: 150, nHollow: 75, nHead: 75 });
let worst = Infinity, tMake = 0, tVal = 0, tMeas = 0;
for (const g of GROUPS) {
  const m = motifFor(g), co = Math.cos(m.angle), si = Math.sin(m.angle), pts = [];
  for (let i = 0; i + 2 < unit.length; i += 2) { const x = m.scale[0] * unit[i], y = m.scale[1] * unit[i + 1]; pts.push([m.at[0] + co * x - si * y, m.at[1] + si * x + co * y]); }
  let t0 = performance.now();
  const P = makeShapePrint(g, { shapes: [pts] });
  tMake += performance.now() - t0;
  t0 = performance.now(); validateShapes(P); tVal += performance.now() - t0;
  const rnd = prng(9), N = 50000, xy = new Float64Array(2 * N), L = Math.hypot(...g.e1) + Math.hypot(...g.e2);
  for (let i = 0; i < N; i++) { xy[2 * i] = g.center[0] + (2 * rnd() - 1) * L; xy[2 * i + 1] = g.center[1] + (2 * rnd() - 1) * L; }
  let best = Infinity, s = 0;
  for (let round = 0; round < 4; round++) { const t = performance.now(); for (let i = 0; i < N; i++) s += P.tone(xy[2 * i], xy[2 * i + 1]); best = Math.min(best, performance.now() - t); }
  const t1 = performance.now(); for (let i = 0; i < 5000; i++) s += P.margin(xy[2 * i], xy[2 * i + 1]); const mr = 5000 / ((performance.now() - t1) / 1000);
  const rate = N / (best / 1000); worst = Math.min(worst, rate);
  let line = `${g.id.padEnd(6)} ${P.verts} points, ${String(g.reps.length).padStart(2)} representatives: tone ${(rate / 1e6).toFixed(2)} M/s, margin ${(mr / 1e3).toFixed(0)} k/s`;
  if (['o', '2222', '*x', '*632'].includes(g.id)) { t0 = performance.now(); const M = measureShapes(P); const dt = performance.now() - t0; tMeas += dt; line += `; measureShapes ${dt.toFixed(0)} ms (dark ${M.coverage}, exact ${M.coverageExact.toFixed(4)})`; }
  console.log(line);
}
console.log(`slowest tone ${(worst / 1e6).toFixed(2)} M/s; makeShapePrint ${(tMake / 17).toFixed(2)} ms, validateShapes ${(tVal / 17).toFixed(2)} ms a group (300 points)`);
