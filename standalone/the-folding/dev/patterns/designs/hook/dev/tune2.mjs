// dev/tune2.mjs — the search for hook specs, in two stages (run it on the mini: bash remote.sh tune2.mjs ...).
//   node tune2.mjs --ids 442,333 [--seed 1] [--nr 3000] [--keep 3] [--evals 150] [--par 3] [--out name] [--wt 0.4] [k=v ...]
// Stage 1, a cheap proxy on the sharp spine A-B-C: sigma = least distance between two copies' spines, rho = the covering
// radius of the spines' orbit, inTile = the share of the spine inside the default tile.
// Stage 2, the real thing: the motif of design.js and its coarse measure (lib.mjs), a local random search on
// (B, th, a, b, phi, r). Writes out/<name>.json: { id: [spec, ...] } best first, each with its numbers in `_m`.
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BY_ID, run } from './lib.mjs';
import { elementsNear } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';
import { frameOrigin, motifOf } from '../design.js';

const argv = process.argv.slice(2), arg = {}, opt = { gap: 0.12, rmin: 0.13, rcap: 0.19, amin: 0.8, amax: 2.1, bmin: 0.42, bmax: 1.1, ratio: 1.45, phimin: 60, phimax: 120, covlo: 0.47, covhi: 0.58, rlo: 0.1, rhi: 0.3, per: 18, taper: 1, ta: 0.8, tvar: 0, bold: 0.15, wtrim: 1.5 };
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { const k = argv[i].slice(2); arg[k] = argv[i + 1] && !argv[i + 1].startsWith('--') && !argv[i + 1].includes('=') ? argv[++i] : '1'; }
  else if (argv[i].includes('=')) { const [k, v] = argv[i].split('='); opt[k] = +v; }
}
const ids = (arg.ids || '442').split(','), NR = +(arg.nr || 3000), KEEP = +(arg.keep || 3), EVALS = +(arg.evals || 150), PAR = +(arg.par || 3), WT = +(arg.wt ?? 0.4);
const outName = arg.out || 'cands';
const here = fileURLToPath(new URL('.', import.meta.url));
const DEG = Math.PI / 180;

if (!arg.worker) {                                             // the master: one worker per group, PAR at a time
  fs.mkdirSync(here + 'out', { recursive: true });
  const queue = ids.slice(), result = {};
  const next = () => new Promise((resolve) => {
    const id = queue.shift();
    if (id === undefined) return resolve();
    const t0 = Date.now();
    const ch = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker', '--ids', id, ...argv.filter((a, i) => !(a === '--ids' || argv[i - 1] === '--ids'))], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    ch.stdout.on('data', (d) => { buf += d; });
    ch.on('close', () => {
      try { result[id] = JSON.parse(buf.split('\n').filter((l) => l.startsWith('RESULT ')).pop().slice(7)); } catch (e) { result[id] = []; console.log(id, 'FAILED', buf.slice(-300)); }
      console.log(`# ${id} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      for (const c of result[id]) console.log('   ' + JSON.stringify(c));
      resolve(next());
    });
  });
  await Promise.all(Array.from({ length: PAR }, next));
  const ordered = {}; for (const id of ids) ordered[id] = result[id] || [];
  fs.writeFileSync(here + 'out/' + outName + '.json', JSON.stringify(ordered, null, 1));
  process.exit(0);
}

// ---------------------------------------------------------------- a worker: one group
let seed = (+(arg.seed || 1)) >>> 0;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function segSeg(p1, p2, p3, p4) {
  const d = (p, a, b) => { const bx = b[0] - a[0], by = b[1] - a[1], L2 = bx * bx + by * by; let t = L2 > 0 ? ((p[0] - a[0]) * bx + (p[1] - a[1]) * by) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * bx, p[1] - a[1] - t * by); };
  const o = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (o(p1, p2, p3) * o(p1, p2, p4) < 0 && o(p3, p4, p1) * o(p3, p4, p2) < 0) return 0;
  return Math.min(d(p1, p3, p4), d(p2, p3, p4), d(p3, p1, p2), d(p4, p1, p2));
}
function ptSeg(px, py, a, b) { const bx = b[0] - a[0], by = b[1] - a[1], L2 = bx * bx + by * by; let t = L2 > 0 ? ((px - a[0]) * bx + (py - a[1]) * by) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - a[0] - t * bx, py - a[1] - t * by); }
const mv = (g, q) => [g.a * q[0] + g.b * q[1] + g.tx, g.c * q[0] + g.d * q[1] + g.ty];

const id = ids[0], group = BY_ID[id], size = Math.sqrt(group.domainArea), O = frameOrigin(group), { e1, e2 } = group;
const tile = tileOf(group), ang1 = Math.atan2(e1[1], e1[0]);
const n = 14, samples = [];
for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const s = (i + 0.5) / n, t = (j + 0.5) / n; samples.push([O[0] + s * e1[0] + t * e2[0], O[1] + s * e1[1] + t * e2[1]]); }
const cc = [O[0] + (e1[0] + e2[0]) / 2, O[1] + (e1[1] + e2[1]) / 2], cr = Math.max(Math.hypot(e1[0] + e2[0], e1[1] + e2[1]), Math.hypot(e1[0] - e2[0], e1[1] - e2[1])) / 2;
const all = elementsNear(group, cc[0], cc[1], cr + (opt.amax + opt.bmax + 0.5) * size + cr, cc[0], cc[1]);
// the copy of a spine that lies best in the default tile: B is moved by the element that takes it into the tile
function spine(p) {
  const B = [O[0] + p[0] * e1[0] + p[1] * e2[0], O[1] + p[0] * e1[1] + p[1] * e2[1]];
  const a0 = ang1 + p[2] * DEG, a1 = a0 + p[5] * DEG;
  return [[B[0] + p[3] * size * Math.cos(a0), B[1] + p[3] * size * Math.sin(a0)], B, [B[0] + p[4] * size * Math.cos(a1), B[1] + p[4] * size * Math.sin(a1)]];
}
function inTileShare(A, B, C) {
  let k = 0, m = 0;
  for (let i = 0; i <= 8; i++) { const q = i / 8; m += 2; if (tile.domain.contains(A[0] + (B[0] - A[0]) * q, A[1] + (B[1] - A[1]) * q)) k++; if (tile.domain.contains(C[0] + (B[0] - C[0]) * q, C[1] + (B[1] - C[1]) * q)) k++; }
  return k / m;
}
function proxy(p) {
  const [A, B, C] = spine(p), Lh = (p[3] + p[4]) * size;
  let sigma = Infinity, best = 0;
  const copies = [], Rc = cr + Lh + 0.4 * size, Rs = 2 * Lh + 0.6 * size;
  for (const g of all) {
    const b = mv(g, B), dc = Math.hypot(b[0] - cc[0], b[1] - cc[1]), db = Math.hypot(b[0] - B[0], b[1] - B[1]);
    if (dc > Rc && db > Rs) continue;
    const a = mv(g, A), c = mv(g, C);
    if (dc <= Rc) { copies.push([a, b, c]); if (WT > 0) best = Math.max(best, inTileShare(a, b, c)); }
    if (db > Rs || (Math.abs(g.a - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.hypot(g.tx, g.ty) < 1e-9)) continue;
    sigma = Math.min(sigma, segSeg(A, B, a, b), segSeg(A, B, b, c), segSeg(B, C, a, b), segSeg(B, C, b, c));
  }
  sigma /= size;
  const r = Math.min(opt.rcap, (sigma - opt.gap) / 2);
  let rho = 0, cov = 0;
  for (const x of samples) {
    let d = Infinity;
    for (const c of copies) { const v = Math.min(ptSeg(x[0], x[1], c[0], c[1]), ptSeg(x[0], x[1], c[1], c[2])); if (v < d) d = v; }
    d /= size;
    if (d > rho) rho = d;
    if (d < r) cov++;
  }
  cov /= samples.length;
  const bare = Math.max(2 * (rho - r), 1.2 * opt.gap);
  return bare + 3 * Math.max(0, 0.44 - cov) + 1.5 * Math.max(0, cov - 0.6) + 5 * Math.max(0, opt.rmin - r) + 0.6 * Math.max(0, opt.ratio - p[3] / p[4]) + 2 * Math.max(0, 2.3 * r - p[4]) + WT * (1 - best);
}
const fixedPhi = opt.phi;
const clampP = (p, wrap = true) => {
  if (wrap) { p[0] -= Math.floor(p[0]); p[1] -= Math.floor(p[1]); }
  p[2] = ((p[2] % 360) + 360) % 360;
  p[3] = Math.max(opt.amin, Math.min(opt.amax, p[3])); p[4] = Math.max(opt.bmin, Math.min(opt.bmax, p[4]));
  const sg = p[5] < 0 ? -1 : 1; p[5] = sg * (fixedPhi || Math.max(opt.phimin, Math.min(opt.phimax, Math.abs(p[5]))));
  if (p.length > 6) p[6] = Math.max(opt.rlo, Math.min(opt.rhi, p[6]));
  if (p.length > 7) p[7] = opt.tvar ? Math.max(0.2, Math.min(1, p[7])) : (arg.seeds ? p[7] : opt.taper);
  if (p.length > 8 && p[8] > 0) { p[8] = Math.max(Math.max(0.09, 0.8 * p[6]), Math.min(Math.min(0.28, 1.7 * p[6]), p[8])); p[9] = Math.max(opt.gap, Math.min(2.5 * opt.gap, p[9])); p[10] = Math.max(-0.2, Math.min(0.2, p[10])); }
  return p;
};
// stage 1
let pool = [];
for (let k = 0; k < (arg.seeds ? 0 : NR); k++) {
  const p = clampP([rnd(), rnd(), 360 * rnd(), opt.amin + (opt.amax - opt.amin) * rnd(), opt.bmin + (opt.bmax - opt.bmin) * rnd(), (rnd() < 0.5 ? -1 : 1) * (opt.phimin + (opt.phimax - opt.phimin) * rnd())]);
  pool.push({ p, s: proxy(p) });
}
pool.sort((x, y) => x.s - y.s);
let best = [];
for (const c of pool.slice(0, 12)) {
  let p = c.p.slice(), s = c.s;
  const step = [0.08, 0.08, 20, 0.25, 0.2, 12];
  for (let it = 0; it < 300; it++) {
    const q = p.slice(), k = it % 6, f = Math.pow(0.5, Math.floor(it / 60));
    if (it % 7 === 6) for (let m = 0; m < 6; m++) q[m] += (rnd() * 2 - 1) * step[m] * f * 0.6; else q[k] += (rnd() * 2 - 1) * step[k] * f;
    clampP(q);
    const v = proxy(q);
    if (v < s) { p = q; s = v; }
  }
  best.push({ p, s });
}
best.sort((x, y) => x.s - y.s);
let seeds = [];
for (const c of best) { if (seeds.some((o) => Math.abs(o.s - c.s) < 0.004)) continue; seeds.push(c); if (seeds.length >= KEEP) break; }
if (arg.seeds) {
  const file = JSON.parse(fs.readFileSync(here + 'out/' + arg.seeds + '.json', 'utf8'));
  seeds = (file[id] || []).map((sp) => {
    const g = sp.gap ?? opt.gap;
    let dr = sp.dr ?? 0, dg = sp.dg ?? g, b = sp.b;
    if (!dr && arg.dot) { dr = sp.r; b = Math.max(opt.bmin, sp.b - 2 * dr - dg); }       // a dot is added: the short stroke makes room
    return { spec: sp, p: [sp.B[0], sp.B[1], sp.th, sp.a, b, sp.phi, sp.r, sp.rt ? sp.rt / sp.r : 1, dr, dg, sp.dx ?? 0] };
  });
}

// stage 2
// the element that brings the hook best into the default tile: the spec is rewritten for that copy (same pattern)
function seat(p) {
  const [A, B, C] = spine(p);
  let bestG = null, bs = -1;
  for (const g of all) { const a = mv(g, A), b = mv(g, B), c = mv(g, C), v = inTileShare(a, b, c); if (v > bs + 1e-9) { bs = v; bestG = g; } }
  const g = bestG, b = mv(g, B), a = mv(g, A), c = mv(g, C);
  const dd = e1[0] * e2[1] - e1[1] * e2[0], bx = b[0] - O[0], by = b[1] - O[1];
  const q = p.slice();
  q[0] = (bx * e2[1] - by * e2[0]) / dd; q[1] = (e1[0] * by - e1[1] * bx) / dd;
  const tA = Math.atan2(a[1] - b[1], a[0] - b[0]), tC = Math.atan2(c[1] - b[1], c[0] - b[0]);
  q[2] = (tA - ang1) / DEG; let ph = (tC - tA) / DEG; while (ph > 180) ph -= 360; while (ph < -180) ph += 360; q[5] = ph;
  return q;
}
let extra = {};
const specOf = (p) => { const s = { ...extra, B: [+p[0].toFixed(4), +p[1].toFixed(4)], th: +p[2].toFixed(2), phi: +p[5].toFixed(2), a: +p[3].toFixed(3), b: +p[4].toFixed(3), r: +p[6].toFixed(3) }; if (p[7] < 0.999) { s.rt = +(p[6] * p[7]).toFixed(3); s.ta = extra.ta ?? opt.ta; } else { delete s.rt; }
  if (p[8] > 0) { s.dr = +p[8].toFixed(3); s.dg = +p[9].toFixed(3); if (Math.abs(p[10]) > 5e-4) s.dx = +p[10].toFixed(3); else delete s.dx; } else { delete s.dr; delete s.dg; delete s.dx; }
  return s; };
function real(p, detail) {
  const spec = specOf(p);
  let m;
  try { m = run(group, spec, { per: opt.per }); } catch (e) { return detail ? { J: 9, err: e.message } : 9; }
  // the share of the outline's vertices inside the default tile
  let k = 0, tot = 0;
  for (const s of m.shapes) for (const q of s.pts) { tot++; if (tile.domain.contains(q[0], q[1], 1e-9)) k++; }
  const inT = tot ? k / tot : 0;
  const J = Math.max(m.bare, 0.25) + 5 * Math.max(0, opt.covlo - m.coverage) + 5 * Math.max(0, m.coverage - opt.covhi) + 2 * Math.max(0, m.solid - 0.5) +
    WT * (1 - inT) + 0.5 * Math.max(0, opt.ratio - p[3] / p[4]) + (m.loops !== 1 ? 0.3 : 0) + 3 * m.overlap + opt.wtrim * m.trimmed + 3 * Math.max(0, opt.bold - p[6]);
  return detail ? { J: +J.toFixed(3), dark: m.coverage, bare: m.bare, solid: m.solid, inTile: +inT.toFixed(2), trim: m.trimmed, loops: m.loops, ms: m.ms } : J;
}
const out = [];
for (const c of seeds) {
  let p;
  if (c.spec) {                                               // a seed of the file: as it is
    extra = { ...c.spec }; delete extra._m; for (const k of ['B', 'th', 'phi', 'a', 'b', 'r', 'rt', 'dr', 'dg', 'dx']) delete extra[k];
    if (extra.gap === undefined) extra.gap = opt.gap;
    p = c.p.slice();
  } else {
    extra = { gap: opt.gap };
    p = seat(c.p); p.push(0.16); p.push(opt.taper); p.push(0, opt.gap, 0); clampP(p, false);
    // r first: the stroke that gives about 0.53 dark
    let lo = opt.rlo, hi = opt.rhi;
    for (let it = 0; it < 6; it++) { p[6] = (lo + hi) / 2; const d = real(p, true); if ((d.dark ?? 1) > 0.53) hi = p[6]; else lo = p[6]; }
  }
  let s = real(p);
  const step = [0.04, 0.04, 8, 0.15, 0.12, fixedPhi ? 0 : 8, 0.02, opt.tvar ? 0.2 : 0, p[8] > 0 ? 0.03 : 0, p[8] > 0 ? 0.04 : 0, p[8] > 0 ? 0.05 : 0];
  const sc = opt.step ?? 1; for (let m = 0; m < step.length; m++) step[m] *= sc;
  for (let it = 0; it < EVALS; it++) {
    const q = p.slice(), f = Math.pow(0.6, Math.floor((4 * it) / EVALS));
    if (it % 3 === 0) for (let m = 0; m < q.length; m++) q[m] += (rnd() * 2 - 1) * step[m] * f * 0.5; else { const k = Math.floor(rnd() * q.length); q[k] += (rnd() * 2 - 1) * step[k] * f; }
    clampP(q, false);
    const v = real(q);
    if (v < s) { p = q; s = v; }
  }
  if (!c.spec) { p = seat(p); clampP(p, false); }
  const spec = specOf(p); spec._m = real(p, true);
  out.push(spec);
}
out.sort((x, y) => x._m.J - y._m.J);
console.log('RESULT ' + JSON.stringify(out));
