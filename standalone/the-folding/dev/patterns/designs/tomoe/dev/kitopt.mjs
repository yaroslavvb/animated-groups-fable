// node dev/kitopt.mjs <id> '<start knobs json>' [--ms 15000] [--bare 0.44] [--minhead 0.19] [--cov 0.48,0.56] [--keys rA,gA,..]
// A coordinate search scored by kit.measure itself (the sheet's numbers, not a coarse raster): each step nudges one knob
// up or down and keeps it when the score drops. Score: bare over --bare, the smaller head under --minhead, the dark share
// outside --cov, solid over 0.55 (all heavily), minus a little for bigger heads. Short runs only (each eval ~0.6 s).
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, measure } from '../../../kit.js';
import { findWith } from '../design.js';
import { makeShapePrint, validateShapes, thinParts } from '../../../../../src/shapes.js';

const args = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else pos.push(args[i]); }
const g = BY_ID[pos[0]];
let cur = JSON.parse(pos[1] || '{}');
const BARE = +opt.bare || 0.44, MINH = +opt.minhead || 0.19, [C0, C1] = (opt.cov || '0.48,0.56').split(',').map(Number), budget = +opt.ms || 15000;
const keys = (opt.keys || 'rA,rB,gA,gB,dA,dB,curl,eyeA,eyeB').split(',');
const RANGE = { rA: [0.12, 0.34], rB: [0.12, 0.34], gA: [0.07, 0.16], gB: [0.045, 0.14], dA: [0, 0.45], dB: [0, 0.45], curl: [0, 0.6], eyeA: [0.3, 0.6], eyeB: [0.3, 0.6], heel: [0, 0.4] };
function score(k) {
  let res;
  try { res = findWith(g, k); } catch (e) { return null; }
  // the production rules and no part thinner than 0.03 tile sizes over more than 0.06 (a pinched neck, a hairline ring)
  const P = makeShapePrint(g, { key: 'x', shapes: res.shapes }), sz = Math.sqrt(g.domainArea);
  if (!validateShapes(P).ok) return null;
  const thin = thinParts(P, 0.03 * sz).filter((r) => r.length > 0.06 * sz).length;
  const m = measure(g, normalize(res.shapes), { per: 56 });
  if (m.overlap > 0) return null;
  const h = Math.min(res.info.rB, res.info.rA);
  const J = 5 * thin + 10 * Math.max(0, m.emptyDisc - BARE) + 10 * Math.max(0, MINH - h) + 6 * Math.max(0, C0 - m.coverage) + 6 * Math.max(0, m.coverage - C1) + 4 * Math.max(0, m.darkDisc - 0.55) - 0.3 * (res.info.rB + res.info.rA);
  return { J, m, thin, rB: res.info.rB, rA: res.info.rA };
}
let best = score(cur), t0 = Date.now(), step = 0.12, seed = 3;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
console.log(`start J ${best ? best.J.toFixed(3) : 'INVALID'} thin ${best && best.thin} bare ${best.m.emptyDisc} dark ${best.m.coverage} solid ${best.m.darkDisc} rB ${best.rB.toFixed(3)} rA ${best.rA.toFixed(3)}`);
while (Date.now() - t0 < budget) {
  const k = keys[Math.floor(rnd() * keys.length)], [lo, hi] = RANGE[k], base = cur[k] !== undefined ? cur[k] : (lo + hi) / 2;
  const nv = +Math.min(hi, Math.max(lo, base + (rnd() < 0.5 ? -1 : 1) * step * (hi - lo) * (0.5 + rnd()))).toFixed(3);
  const cand = { ...cur, [k]: nv }, r = score(cand);
  if (r && r.J < best.J - 1e-4) { cur = cand; best = r; console.log(`  J ${r.J.toFixed(3)} bare ${r.m.emptyDisc} dark ${r.m.coverage} solid ${r.m.darkDisc} rB ${r.rB.toFixed(3)} rA ${r.rA.toFixed(3)}  ${k}=${nv}`); }
}
console.log('BEST ' + JSON.stringify(cur));
