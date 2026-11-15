// scratch: shapes.js against kit.js on the page's comma, all 17 groups; speed
import { GROUPS } from '../../../src/groups.js';
import { motifFor, commaOutline } from '../../../src/motif.js';
import { normalize, windingAt } from '../kit.js';
import { makeShapePrint, validateShapes, measureShapes, shapeElements } from '../../../src/shapes.js';

function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const t00 = Date.now();
for (const g of GROUPS) {
  const m = motifFor(g), shapes = m.polylines.map((p) => ({ pts: p }));
  const P = makeShapePrint(g, { key: 'demo', name: 'commas', shapes });
  const N = normalize(m.polylines.map((p) => ({ pts: Array.from(p) })));
  const rnd = prng(11), L = Math.hypot(...g.e1) + Math.hypot(...g.e2);
  let diff = 0, n = 0, near = 0;
  for (let i = 0; i < 1500; i++) {
    const x = g.center[0] + (2 * rnd() - 1) * L, y = g.center[1] + (2 * rnd() - 1) * L;
    if (P.margin(x, y) < 1e-7) { near++; continue; }
    n++;
    if (P.winding(x, y) !== windingAt(g, N, x, y)) diff++;
  }
  // speed
  const pts = new Float64Array(20000);
  for (let i = 0; i < pts.length; i++) pts[i] = (i & 1 ? g.center[1] : g.center[0]) + (2 * rnd() - 1) * L;
  let s = 0; const t0 = performance.now();
  for (let rep = 0; rep < 10; rep++) for (let i = 0; i < pts.length; i += 2) s += P.tone(pts[i], pts[i + 1]);
  const dt = performance.now() - t0, rate = (10 * pts.length / 2) / (dt / 1000);
  const t1 = performance.now(); let sm = 0;
  for (let i = 0; i < 4000; i += 2) sm += P.margin(pts[i], pts[i + 1]);
  const mrate = 2000 / ((performance.now() - t1) / 1000);
  const t2 = performance.now();
  const V = validateShapes(P);
  const tv = performance.now() - t2;
  console.log(g.id.padEnd(6), 'verts', P.verts, 'R', (P.R / P.size).toFixed(3), 'kit R', (N.R / P.size).toFixed(3), '| winding differs from kit at', diff, 'of', n, '| tone', (rate / 1e6).toFixed(2), 'M/s  margin', (mrate / 1e3).toFixed(0), 'k/s | dark', (s / (10 * pts.length / 2)).toFixed(3),
    '| validate', V.ok, 'gap', V.gap.toFixed(4), 'stab', V.stabilizer, tv.toFixed(1) + ' ms', V.problems.join('; '));
}
console.log('total', Date.now() - t00, 'ms');
