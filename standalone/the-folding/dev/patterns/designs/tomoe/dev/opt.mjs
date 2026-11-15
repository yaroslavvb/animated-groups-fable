// node dev/opt.mjs <id> [--n 160] [--base '{"a":[..],"b":[..]}'] [--per 22] [--seed 1]
// A random search, then a local one, over the head knobs of one group (the S's ends fixed by --base or KNOBS):
// scored by a coarse measure (bare disc, solid disc, dark share) and the size of the heads. Prints the best few as
// JSON lines to paste into KNOBS. Keep runs short (one group, a few seconds).
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, windingAt } from '../../../kit.js';
import { findWith } from '../design.js';

const args = process.argv.slice(2), opt = {};
const id = args[0];
for (let i = 1; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const g = BY_ID[id], s = Math.sqrt(g.domainArea);
const base = opt.base ? JSON.parse(opt.base) : {};
const N0 = +opt.n || 400, per = +opt.per || 26;
let seed = +opt.seed || 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function edt(on, w, h) {
  const INF = 1e20, n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), out = new Float64Array(w * h);
  const pass = (len) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s2 = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s2 <= z[k]) { k--; s2 = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s2; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = on[y * w + x] ? 0 : INF; pass(h); for (let y = 0; y < h; y++) out[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = out[y * w + x]; pass(w); for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]); }
  return out;
}
function selfCross(P) {
  const n = P.length, o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const a = P[i], b = P[(i + 1) % n], c = P[j], d = P[(j + 1) % n];
    if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return true;
  }
  return false;
}
// the window: one lattice cell around the centre, plus margins; the discs are read inside the cell's box
const L = Math.max(Math.hypot(...g.e1), Math.hypot(...g.e2), Math.hypot(g.e1[0] + g.e2[0], g.e1[1] + g.e2[1]));
const half = Math.min(0.6 * L + 0.4 * s, 2.4 * s), pad = 0.7 * s, h = s / per;
const Wg = Math.ceil((2 * (half + pad)) / h), x0 = g.center[0] - half - pad, y0 = g.center[1] - half - pad, padc = Math.round(pad / h);
import { elementsNear } from '../../../../../src/groups.js';
/** The winding number of the orbit on the grid (row j, column i: the point x0 + (i + .5) h, y0 + (j + .5) h), by scanlines. */
function windGrid(N) {
  const Wd = new Int16Array(Wg * Wg);
  const mx = x0 + (Wg * h) / 2, my = y0 + (Wg * h) / 2, rad = (Wg * h) / Math.SQRT2;
  const els = elementsNear(g, mx, my, rad + N.R, N.cx, N.cy);
  for (const e of els) {
    const flip = e.a * e.d - e.b * e.c < 0 ? -1 : 1;
    for (const P of N.polys) {
      const p = P.pts, n = p.length / 2, sg = flip;            // outer: +1 inside (CCW), hole: -1 (CW); a mirror flips both
      let px = e.a * p[2 * n - 2] + e.b * p[2 * n - 1] + e.tx, py = e.c * p[2 * n - 2] + e.d * p[2 * n - 1] + e.ty;
      for (let k = 0; k < n; k++) {
        const qx = e.a * p[2 * k] + e.b * p[2 * k + 1] + e.tx, qy = e.c * p[2 * k] + e.d * p[2 * k + 1] + e.ty;
        // rows whose centre line y lies in [min, max) of the edge
        const v0 = (py - y0) / h - 0.5, v1 = (qy - y0) / h - 0.5;
        if (v0 !== v1) {
          const up = v1 > v0, lo = Math.max(0, Math.ceil(Math.min(v0, v1))), hi = Math.min(Wg - 1, Math.ceil(Math.max(v0, v1)) - 1);
          for (let j = lo; j <= hi; j++) {
            const t = (j - v0) / (v1 - v0), x = px + t * (qx - px), i = Math.max(0, Math.ceil((x - x0) / h - 0.5));
            if (i < Wg) Wd[j * Wg + i] += up ? -sg : sg;
          }
        }
        px = qx; py = qy;
      }
    }
  }
  for (let j = 0; j < Wg; j++) { let acc = 0; for (let i = 0; i < Wg; i++) { acc += Wd[j * Wg + i]; Wd[j * Wg + i] = acc; } }
  return Wd;
}
function score(over) {
  let res;
  try { res = findWith(g, withPos(over)); } catch (e) { return null; }
  if (selfCross(res.shapes[0].pts)) return null;
  const N = normalize(res.shapes);
  const Wd = windGrid(N);
  const dark = new Uint8Array(Wg * Wg), light = new Uint8Array(Wg * Wg);
  for (let k = 0; k < Wg * Wg; k++) { const t = Wd[k] > 0 ? 1 : 0; dark[k] = t; light[k] = 1 - t; }
  const dD = edt(dark, Wg, Wg), dL = edt(light, Wg, Wg);
  let bare = 0, solid = 0, nd = 0, nn = 0;
  for (let j = padc; j < Wg - padc; j++) for (let i = padc; i < Wg - padc; i++) { const k = j * Wg + i; nd += dark[k]; nn++; if (dD[k] > bare) bare = dD[k]; if (dL[k] > solid) solid = dL[k]; }
  bare = (2 * bare) / per; solid = (2 * solid) / per;
  // the dark share, exactly: the motif's net area over the tile's (its copies are disjoint, one per tile)
  let net = 0; for (const P of N.polys) net += (P.hole ? -1 : 1) * P.area;
  const cov = net / g.domainArea, rB = res.info.rB, rA = res.info.rA;
  // --minhead r: the smaller head must be at least r (tile sizes), weight 6 (13 Nov, the critique: specks for heads)
  const J = 3 * Math.max(0, bare - (+opt.bare || 0.40)) + 1.5 * Math.max(0, solid - 0.6) + 2 * Math.max(0, 0.46 - cov) + (+opt.covw || 2) * Math.max(0, cov - (+opt.covmax || 0.58)) - (+opt.headw || 0.35) * (rB + rA) - 0.15 * Math.min(rB, rA) + 6 * Math.max(0, (+opt.minhead || 0) - Math.min(rB, rA));
  return { J, bare, solid, cov, rB, rA };
}
const SPACE = { rB: [0.14, 0.32], rA: [0.14, 0.32], dB: [0, 0.45], dA: [0, 0.45], gB: [+opt.gBmin || 0.045, 0.13], gA: [+opt.gAmin || 0.07, 0.15], curl: [0, 0.6], eyeB: [0.3, 0.6], eyeA: [0.3, 0.55] };
// --pos: search the heads' positions too (pB, pA in the tile's frame, inside the tile's box)
if (opt.pos) {
  const t = findWith(g, base).info.box;
  SPACE.xB = [t[0], t[2]]; SPACE.yB = [t[1], t[3]]; SPACE.xA = [t[0], t[2]]; SPACE.yA = [t[1], t[3]]; SPACE.rimGap = [0.0, 0.08];
}
const keys = Object.keys(SPACE);
const pick = () => { const o = { ...base }; for (const k of keys) o[k] = +(SPACE[k][0] + rnd() * (SPACE[k][1] - SPACE[k][0])).toFixed(3); return o; };
const withPos = (o) => (opt.pos ? { ...o, pB: [o.xB, o.yB], pA: [o.xA, o.yA] } : o);
// --bases '[{...}, {...}]': several structures (the S's ends a, b, and any fixed knob); each gets an equal share of time
const bases = opt.bases ? JSON.parse(opt.bases) : [base];
const budget = +opt.ms || 12000, share = budget / bases.length;
const T0 = Date.now();
bases.forEach((bse, bi) => {
  const t0 = Date.now();
  const pickB = () => ({ ...pick(), ...bse });
  let pool = [];
  for (let n = 0; n < N0 && Date.now() - t0 < 0.55 * share; n++) { const o = pickB(), r = score(o); if (r) pool.push({ o, r }); }
  pool.sort((p, q) => p.r.J - q.r.J);
  for (const start of pool.slice(0, 3)) {
    let cur = start;
    for (let it = 0; it < 80 && Date.now() - t0 < share; it++) {
      const o = { ...cur.o };
      const free = keys.filter((k) => !(k in bse)), k = free[Math.floor(rnd() * free.length)], span = SPACE[k][1] - SPACE[k][0];
      o[k] = +Math.min(SPACE[k][1], Math.max(SPACE[k][0], o[k] + (rnd() - 0.5) * 0.3 * span)).toFixed(3);
      const r = score(o);
      if (r && r.J < cur.r.J) { cur = { o, r }; pool.push(cur); }
    }
  }
  pool.sort((p, q) => p.r.J - q.r.J);
  const seen = new Set();
  console.log(`base ${bi} ${JSON.stringify(bse)}  (${pool.length} scored)`);
  for (const { o, r } of pool) {
    const key = JSON.stringify(o); if (seen.has(key)) continue; seen.add(key);
    console.log(`  J ${r.J.toFixed(3)} bare ${r.bare.toFixed(3)} solid ${r.solid.toFixed(3)} cov ${r.cov.toFixed(3)} rB ${r.rB.toFixed(3)} rA ${r.rA.toFixed(3)}  ${JSON.stringify(Object.fromEntries(keys.filter((k) => !(k in bse)).map((k) => [k, o[k]])))}`);
    if (seen.size >= (+opt.top || 2)) break;
  }
});
console.log(`(${Date.now() - T0} ms)`);
