// dev/patterns/scratch-review-webkit/ulp-each.mjs — which Math function's last bit moves Paisley's motif: each one nudged
// alone (the next double for about a third of its arguments), the groups whose motif moves by more than 1e-9.
//   node dev/patterns/scratch-review-webkit/ulp-each.mjs
import { GROUPS } from '../../../src/groups.js';
import * as paisley from '../../../src/patterns/paisley.js';

const FNS = ['cos', 'sin', 'hypot', 'acos', 'atan', 'atan2', 'asin', 'tan', 'cbrt', 'exp', 'pow', 'sqrt'];
const orig = Object.fromEntries(FNS.map((f) => [f, Math[f]]));
const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer);
// (results every libm gives exactly — 0, ±1, ±π, ±π/2, ±π/4, an argument 0 or ±1 — are left alone: only generic last bits move)
const EXACT = new Set([0, 1, -1, Math.PI, -Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4]);
const nudged = (f) => function (...a) {
  const y = orig[f].apply(Math, a);
  if (!Number.isFinite(y) || EXACT.has(y) || a.some((v) => v === 0 || v === 1 || v === -1)) return y;
  f64[0] = a[0]; if (u64[0] % 3n !== 0n) return y;
  f64[0] = y; u64[0] += 1n; return f64[0];
};
const motif = (g) => { paisley.resetShapes(); return paisley.find(g).shapes.map((s) => (s.pts || s).flat()); };
const base = GROUPS.map(motif);
const moved = (a, b) => a.length !== b.length || a.some((p, j) => p.length !== b[j].length || p.some((v, k) => Math.abs(v - b[j][k]) > 1e-9));
for (const f of FNS) {
  Math[f] = nudged(f);
  let res;
  try { res = GROUPS.map(motif); } finally { Math[f] = orig[f]; }
  const changed = GROUPS.filter((g, i) => moved(base[i], res[i])).map((g) => g.id);
  console.log(`${f.padEnd(6)} ${changed.length} groups move: ${changed.join(' ')}`);
}
