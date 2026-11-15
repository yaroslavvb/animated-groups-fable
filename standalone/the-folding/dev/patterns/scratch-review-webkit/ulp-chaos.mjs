// dev/patterns/scratch-review-webkit/ulp-chaos.mjs — does a pattern's find give the same motif when Math.cos, sin,
// hypot, acos, atan, atan2, asin, tan, cbrt, exp, pow return the next double now and then (as JavaScriptCore's or another
// CPU's libm does: WebKit and Chrome disagree on the last bit of 4 to 38 % of these, measured)? In node, no browser.
//   node dev/patterns/scratch-review-webkit/ulp-chaos.mjs [keys]      (default: paisley,soft,tomoe,comma)
import { GROUPS } from '../../../src/groups.js';
import * as paisley from '../../../src/patterns/paisley.js';
import * as soft from '../../../src/patterns/soft.js';
import * as tomoe from '../../../src/patterns/tomoe.js';
import * as comma from '../../../src/patterns/comma.js';

const MODS = { paisley, soft, tomoe, comma };
const keys = (process.argv[2] || 'paisley,soft,tomoe,comma').split(',');
const FNS = ['cos', 'sin', 'hypot', 'acos', 'atan', 'atan2', 'asin', 'tan', 'cbrt', 'exp', 'pow'];
const orig = Object.fromEntries(FNS.map((f) => [f, Math[f]]));
const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer);
// the next double away from zero, for about a third of the arguments (chosen by the arguments' own bits: deterministic);
// results every libm gives exactly (0, ±1, ±π, ±π/2, ±π/4, or an argument 0 or ±1) are left alone
const EXACT = new Set([0, 1, -1, Math.PI, -Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4]);
function nudged(f) {
  return function (...a) {
    const y = orig[f].apply(Math, a);
    if (!Number.isFinite(y) || EXACT.has(y) || a.some((v) => v === 0 || v === 1 || v === -1)) return y;
    f64[0] = a[0]; const h = Number(u64[0] % 3n);
    if (h !== 0) return y;
    f64[0] = y; u64[0] += 1n; return f64[0];
  };
}
const flat = (r) => r.shapes.map((s) => (s.pts || s).flat ? (s.pts || s).flat() : Array.from(s.pts || s));
const run = (M, g) => { if (M.resetShapes) M.resetShapes(); return flat(M.find(g)); };
for (const key of keys) {
  const M = MODS[key], base = GROUPS.map((g) => run(M, g));
  for (const f of FNS) Math[f] = nudged(f);
  let after;
  try { after = GROUPS.map((g) => run(M, g)); } finally { for (const f of FNS) Math[f] = orig[f]; }
  const again = GROUPS.map((g) => run(M, g));
  const rows = [];
  let changed = 0;
  GROUPS.forEach((g, i) => {
    const a = base[i], b = after[i];
    let note;
    if (a.length !== b.length || a.some((p, j) => p.length !== b[j].length)) note = `DIFFERENT OUTLINES (${a.map((p) => p.length / 2).join('+')} vs ${b.map((p) => p.length / 2).join('+')} points)`;
    else { let mx = 0; a.forEach((p, j) => p.forEach((v, k) => { mx = Math.max(mx, Math.abs(v - b[j][k])); })); note = `max |dx| ${mx.toExponential(1)}`; if (mx > 1e-9) note += ' <<<'; }
    if (/<<<|DIFF/.test(note)) changed++;
    rows.push(`${g.id}: ${note}`);
  });
  const stable = again.every((a, i) => JSON.stringify(a) === JSON.stringify(base[i]));
  console.log(`${key}: ${changed} of 17 groups change by more than 1e-9 tile sizes when the libm's last bit moves (unperturbed run repeated: ${stable ? 'the same' : 'DIFFERENT'})`);
  console.log('  ' + rows.join(';  '));
}
