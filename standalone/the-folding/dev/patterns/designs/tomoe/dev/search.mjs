// node dev/search.mjs <id> [--ms 60000] [--start '<knobs json>'] [--keys rA,rB,..] [--seed 1] [--out file.json]
//                            [--bare 0.42] [--cov 0.46,0.58] [--minhead 0.2] [--hug 0.6] [--per 44]
// A coordinate search over the knobs of one group of the polish of 14 Nov, scored by kit.measure (dark share, bare and
// solid discs), the production validator (a motif it refuses is never kept), THIN at 1.5 texels of the 3D texture, the
// size of the heads, and how long the dark comma HUGS a mirror (outline within 0.03 tile sizes of the inset line: a
// channel along the mirror). RUN IT REMOTELY (dev/remote.sh): one search keeps a core busy for its whole --ms.
// Keys of the bows: k0, r0, k1, r1, ... (kiss, radius of the i-th mirror stretch of the dark back from b).
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, measure } from '../../../kit.js';
import { findWith } from '../design.js';
import { makeShapePrint, validateShapes, thinParts, BAKE_SIZE } from '../../../../../src/shapes.js';

const args = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else pos.push(args[i]); }
const id = pos[0], g = BY_ID[id], sz = Math.sqrt(g.domainArea);
let cur = JSON.parse(opt.start || '{}');
const BARE = +opt.bare || 0.42, MINH = +opt.minhead || 0.2, HUG = opt.hug !== undefined ? +opt.hug : 0.6, PER = +opt.per || 44;
const HEADW = +opt.headw || 10, EYEW = +opt.eyew || 0;
const [C0, C1] = (opt.cov || '0.46,0.58').split(',').map(Number), budget = +opt.ms || 60000;
const RANGE = { rA: [0.12, 0.38], rB: [0.12, 0.38], gA: [0.04, 0.2], gB: [0.04, 0.2], dA: [0, 0.5], dB: [0, 0.5], curl: [0, 0.6], eyeA: [0.3, 0.62], eyeB: [0.3, 0.62], heel: [0, 0.4], bend: [0.06, 0.2] };
for (let k = 0; k < 4; k++) { RANGE['k' + k] = [0, 1]; RANGE['r' + k] = [0.4, 4]; RANGE['u' + k] = [0, 0.45]; RANGE['w' + k] = [0.55, 1]; RANGE['p' + k] = [0, 0.25]; }
const keys = (opt.keys || 'rA,rB,gA,gB,dA,dB,curl,eyeA,eyeB').split(',');
let seed = +opt.seed || 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function reduced(e1, e2) {
  let u = e1.slice(), v = e2.slice();
  for (let it = 0; it < 50; it++) {
    if (Math.hypot(...u) > Math.hypot(...v)) [u, v] = [v, u];
    const m = Math.round((u[0] * v[0] + u[1] * v[1]) / (u[0] * u[0] + u[1] * u[1]));
    if (m === 0) break;
    v = [v[0] - m * u[0], v[1] - m * u[1]];
  }
  return [u, v];
}
const [ru, rv] = reduced(g.e1, g.e2), pitch = Math.max(Math.hypot(...ru), Math.hypot(...rv)) / BAKE_SIZE;

/** knobs with the flat bow keys folded into K.bows */
function knobs(k) {
  const out = { ...(k.base || {}) }, bows = (out.bows || []).map((b) => b.slice()), dents = (out.dents || []).map((d) => d.slice());
  for (const [key, val] of Object.entries(k)) {
    if (key === 'base') continue;
    const m = /^([kruwp])(\d)$/.exec(key);
    if (!m) { out[key] = val; continue; }
    const i = +m[2];
    if (m[1] === 'k' || m[1] === 'r') { bows[i] = bows[i] || [0.5, 1.6]; bows[i][m[1] === 'k' ? 0 : 1] = val; }
    else { dents[i] = dents[i] || [0.15, 0.85, 0]; dents[i]['uwp'.indexOf(m[1])] = val; }
  }
  if (bows.length) out.bows = Array.from(bows, (b) => b || [0.5, 1.6]);
  if (dents.length) out.dents = Array.from(dents, (d) => d || [0.15, 0.85, 0]);
  return out;
}
function hugLength(shapes, mirrors) {
  const P = shapes[0].pts, lim = (0.024 + 0.03) * sz;
  let L = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    for (const [A, B] of mirrors) {
      const e = [B[0] - A[0], B[1] - A[1]], l2 = e[0] * e[0] + e[1] * e[1], t = ((m[0] - A[0]) * e[0] + (m[1] - A[1]) * e[1]) / l2;
      if (t < 0 || t > 1) continue;
      if (Math.abs(e[0] * (m[1] - A[1]) - e[1] * (m[0] - A[0])) / Math.sqrt(l2) < lim) { L += Math.hypot(q[0] - p[0], q[1] - p[1]); break; }
    }
  }
  return L / sz;
}
function score(k) {
  let res;
  try { res = findWith(g, knobs(k)); } catch (e) { return null; }
  const P = makeShapePrint(g, { key: 'x', shapes: res.shapes });
  if (!validateShapes(P).ok) return null;
  const thinTex = thinParts(P, 1.5 * pitch).filter((r) => r.length / pitch > 6).length;
  const thin3 = thinParts(P, 0.03 * sz).filter((r) => r.length > 0.06 * sz).length;
  const m = measure(g, normalize(res.shapes), { per: PER });
  if (m.overlap > 0) return null;
  const hug = hugLength(res.shapes, res.info.mirrors || []);
  const h = Math.min(res.info.rB, res.info.rA);
  const eMin = Math.min(...res.info.eyes.map((e) => (e > 0 ? e : 0)));
  const J = 12 * Math.max(0, m.emptyDisc - BARE) + 6 * Math.max(0, C0 - m.coverage) + 6 * Math.max(0, m.coverage - C1) + 4 * Math.max(0, m.darkDisc - 0.6)
    + 5 * thinTex + 2 * thin3 + HEADW * Math.max(0, MINH - h) - 0.4 * (res.info.rB + res.info.rA) + HUG * hug + EYEW * Math.max(0, 0.06 - eMin);
  return { J, m, thinTex, thin3, hug, rB: res.info.rB, rA: res.info.rA, eyes: res.info.eyes };
}
const fmt = (r) => `J ${r.J.toFixed(3)} bare ${r.m.emptyDisc} dark ${r.m.coverage} solid ${r.m.darkDisc} hug ${r.hug.toFixed(2)} thin ${r.thinTex}/${r.thin3} rB ${r.rB.toFixed(3)} rA ${r.rA.toFixed(3)} eyes ${r.eyes.map((e) => e.toFixed(3)).join('/')}`;
let best = score(cur);
const t0 = Date.now();
console.log(`${id} start ${best ? fmt(best) : 'INVALID'}`);
if (!best) best = { J: Infinity };
let step = 0.15, tries = 0;
while (Date.now() - t0 < budget) {
  tries++;
  const cand = { ...cur }, nk = rnd() < 0.3 ? 2 : 1;
  for (let q = 0; q < nk; q++) {
    const k = keys[Math.floor(rnd() * keys.length)], [lo, hi] = RANGE[k], base = cand[k] !== undefined ? cand[k] : (lo + hi) / 2;
    cand[k] = +Math.min(hi, Math.max(lo, base + (rnd() < 0.5 ? -1 : 1) * step * (hi - lo) * (0.3 + rnd()))).toFixed(3);
  }
  const r = score(cand);
  if (r && r.J < best.J - 1e-4) { cur = cand; best = r; console.log(`  ${id} ${fmt(r)}`); }
  if (tries % 60 === 0) step = Math.max(0.03, step * 0.8);
}
console.log(`${id} BEST ${best.J === Infinity ? 'none' : fmt(best)}`);
console.log(`${id} KNOBS ${JSON.stringify(knobs(cur))}`);
if (opt.out) fs.writeFileSync(opt.out, JSON.stringify({ id, knobs: knobs(cur), flat: cur, best: best.J === Infinity ? null : { J: best.J, m: best.m, hug: best.hug, rB: best.rB, rA: best.rA, thinTex: best.thinTex } }, null, 1));
