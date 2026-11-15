// dev/patterns/scratch-fixer3/sym-debug.mjs — the fixer (15 Nov 2026): the half-turns of 2222's Paisley print, from its
// coset representatives, and how many generic points each keeps (the symmetry test's control found 0.996).
//   node dev/patterns/scratch-fixer3/sym-debug.mjs
import { BY_ID } from '../../../src/groups.js';
import { printFor } from '../../../src/pattern.js';

const g = BY_ID['2222'], P = printFor(g, 'paisley');
console.log('e1', g.e1, 'e2', g.e2, 'center', g.center, 'size', P.size);
for (const r of g.reps) console.log('rep', JSON.stringify(r));
function agree(L, w, n) {
  let a = 0x9e3779b9 >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const Lc = Math.hypot(...g.e1) + Math.hypot(...g.e2);
  let same = 0, done = 0, bad = [];
  for (let i = 0; i < 20 * n && done < n; i++) {
    const x = g.center[0] + (2 * rnd() - 1) * Lc, y = g.center[1] + (2 * rnd() - 1) * Lc;
    if (P.margin(x, y) < 1e-3 * P.size) continue;
    const u = L[0] * x + L[1] * y + w[0], v = L[2] * x + L[3] * y + w[1];
    if (P.margin(u, v) < 1e-3 * P.size) continue;
    done++;
    if (P.tone(u, v) === P.tone(x, y)) same++; else if (bad.length < 3) bad.push([x, y, u, v, P.tone(x, y), P.tone(u, v), P.margin(x, y), P.margin(u, v)]);
  }
  return { share: same / done, done, bad };
}
const half = g.reps.find((r) => r.a === -1 && r.d === -1);
console.log('the rep half-turn', JSON.stringify(agree([-1, 0, 0, -1], [half.tx, half.ty], 1500)));
console.log('w = (-0.0001, 0.0028)', JSON.stringify(agree([-1, 0, 0, -1], [-0.0001, 0.0028], 1500)));
console.log('identity', JSON.stringify(agree([1, 0, 0, 1], [0, 0], 1500)));
