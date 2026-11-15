// lab/search.mjs — find the stroke of ONE group: random strokes (and strokes laid round the inside of the tile), then
// hill climbing from the best of them.
//   node lab/search.mjs --id 442 [--seed 1] [--samples 600] [--top 8] [--iters 900] [--h 0.022] [--w '{"bare":1}']
//                       [--init file.json] [--cover 0.5] [--pts 4] [--lobes 0] [--margin 0.04] [--snail 0.4] [--lim '{"th":[0,0]}']
// --pts: control points of the spine (4: a cubic Bezier; 6: can go once round the tile). --snail: the share of the
// random strokes that are laid round the tile, corner after corner. Prints one line: RESULT {"id", "stroke", "m", "score"}.
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { frameOf } from '../design.js';
import { analyse, score, tileInFrame } from './measure.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const id = opt.id, group = BY_ID[id];
if (!group) { console.error('no group ' + id); process.exit(2); }
const W = opt.w ? JSON.parse(opt.w) : {};
const H = +opt.h || 0.022, samples = opt.samples !== undefined ? +opt.samples : 600, top = +opt.top || 8, iters = +opt.iters || 900, cover = opt.cover ? +opt.cover : undefined;
const NP = +opt.pts || 4, LOBES = +opt.lobes || 0, SNAIL = opt.snail !== undefined ? +opt.snail : (NP > 4 ? 0.45 : 0);
const SOFTNESS = opt.soft ? +opt.soft : undefined, MARGIN = opt.margin ? +opt.margin : undefined;
let seed = (+opt.seed || 1) >>> 0;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const u = (a, b) => a + rnd() * (b - a);

const F = frameOf(group), tile = tileInFrame(group, F), NT = tile.length;
let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity, gx = 0, gy = 0;
for (const p of tile) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); gx += p[0] / NT; gy += p[1] / NT; }
const inTile = (x, y) => tile.every((a, i) => { const b = tile[(i + 1) % NT]; return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= 0; });
// the knobs as a vector: the control points of the spine, then rh, r0 / rh, th, q, then the lobes (x, y, r each)
const LIM = opt.lim ? JSON.parse(opt.lim) : {};
const B = { out: 0.35, rh: [0.08, 0.36], r0f: [0.15, 1], th: [0, 0.55], q: [0.8, 1.8], ...LIM };
const C = 2 * NP, D = C + 4 + 3 * LOBES;
const clamp = (v, [a, b]) => Math.min(b, Math.max(a, v));
function fix(v) {
  for (let k = 0; k < C; k += 2) { v[k] = clamp(v[k], [bx0 - B.out, bx1 + B.out]); v[k + 1] = clamp(v[k + 1], [by0 - B.out, by1 + B.out]); }
  v[C] = clamp(v[C], B.rh); v[C + 1] = clamp(v[C + 1], B.r0f); v[C + 2] = clamp(v[C + 2], B.th); v[C + 3] = clamp(v[C + 3], B.q);
  for (let k = 0; k < LOBES; k++) { const o = C + 4 + 3 * k; v[o] = clamp(v[o], [bx0, bx1]); v[o + 1] = clamp(v[o + 1], [by0, by1]); v[o + 2] = clamp(v[o + 2], [0.02, 0.3]); }
  return v;
}
const toStroke = (v) => {
  const st = { p: v.slice(0, C), rh: v[C], r0: v[C] * (v[C + 2] > 0.02 ? v[C + 1] : 1), th: v[C + 2] > 0.02 ? v[C + 2] : 0, q: v[C + 3] };
  if (SOFTNESS) st.soft = SOFTNESS;
  const lobes = [];
  for (let k = 0; k < LOBES; k++) { const o = C + 4 + 3 * k; if (v[o + 2] >= 0.06) lobes.push([v[o], v[o + 1], v[o + 2]]); }      // a lobe under 0.06 is switched off
  if (lobes.length) st.lobes = lobes;
  return st;
};
/** A stroke of a file as a vector; a spine with fewer control points is given more (the same curve, nearly). */
function fromStroke(s) {
  const p = s.p.slice();
  while (p.length < C) {                                     // insert the midpoint of the longest leg of the control polygon
    let best = 0, bl = -1;
    for (let i = 0; i + 3 < p.length; i += 2) { const l = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]); if (l > bl) { bl = l; best = i; } }
    p.splice(best + 2, 0, (p[best] + p[best + 2]) / 2, (p[best + 1] + p[best + 3]) / 2);
  }
  const v = [...p.slice(0, C), s.rh, (s.r0 ?? s.rh) / s.rh, s.th || 0, s.q || 1];
  for (let k = 0; k < LOBES; k++) { const l = (s.lobes || [])[k]; v.push(...(l || [gx, gy, 0.03])); }
  return v;
}
let evals = 0;
function cost(v, h = H) {
  evals++;
  const m = analyse(group, toStroke(v), { h, cover, quick: true, margin: MARGIN });
  return { s: score(m, W), m };
}
// where an end of the stroke can sit deep in a corner of the tile: on the corner's bisector, where the tile is just
// wide enough for a thin end (radius 0.05) and its margin
const corners = tile.map((v, i) => {
  const a = tile[(i + NT - 1) % NT], b = tile[(i + 1) % NT];
  const ux = a[0] - v[0], uy = a[1] - v[1], wx = b[0] - v[0], wy = b[1] - v[1], lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
  const half = Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (lu * lw)))) / 2;
  let hx = ux / lu + wx / lw, hy = uy / lu + wy / lw; const lh = Math.hypot(hx, hy) || 1; hx /= lh; hy /= lh;
  const d = Math.min((0.05 + (MARGIN ?? 0.04) + 0.02) / Math.sin(half), 0.4 * Math.min(lu, lw));
  return [v[0] + d * hx, v[1] + d * hy];
});
const inside = () => { let x, y; do { x = u(bx0, bx1); y = u(by0, by1); } while (!inTile(x, y)); return [x, y]; };
function profile(snail) {
  const v = snail ? [u(0.1, 0.22), u(0.5, 1), rnd() < 0.6 ? 0 : u(0.05, 0.3), u(0.9, 1.7)] : [u(B.rh[0] + 0.02, B.rh[1]), u(B.r0f[0], 1), rnd() < 0.5 ? 0 : u(0.1, 0.5), u(B.q[0], B.q[1])];
  for (let k = 0; k < LOBES; k++) { const q = inside(); v.push(q[0], q[1], rnd() < 0.3 ? 0.03 : u(0.08, 0.26)); }
  return v;
}
function randomVec() {
  const corner = (not) => { let k; do { k = Math.floor(rnd() * NT); } while (k === not); return k; };
  let a = inside(), d = inside();
  const mode = rnd();
  if (mode < 0.6) { const i = corner(-1), j = corner(i); d = [corners[j][0] + 0.04 * gauss(), corners[j][1] + 0.04 * gauss()]; if (mode < 0.35) a = [corners[i][0] + 0.04 * gauss(), corners[i][1] + 0.04 * gauss()]; }
  const v = [...a];
  for (let k = 1; k < NP - 1; k++) v.push(u(bx0 - 0.2, bx1 + 0.2), u(by0 - 0.2, by1 + 0.2));
  v.push(...d, ...profile(false));
  return fix(v);
}
/**
 * A stroke laid round the inside of the tile: from a head behind one corner, past every other corner in turn (or all
 * but the last few), to a thin end deep in a corner. The control points are NP points at equal steps along that path.
 */
function snailVec() {
  const i = Math.floor(rnd() * NT), dir = rnd() < 0.5 ? 1 : -1, skip = rnd() < 0.3 ? 1 + Math.floor(rnd() * Math.max(1, NT - 3)) : 0;
  const mu = u(0.72, 1.02), at = (j, f) => { const v = tile[((j % NT) + NT) % NT]; return [gx + f * (v[0] - gx), gy + f * (v[1] - gy)]; };
  const path = [];
  const nxt = at(i + dir, mu), hd = at(i, u(0.3, 0.6)), f0 = u(0.05, 0.25);
  path.push([hd[0] + f0 * (nxt[0] - hd[0]), hd[1] + f0 * (nxt[1] - hd[1])]);                            // the head: behind corner i, toward the next corner
  for (let k = 1; k < NT - skip; k++) path.push(at(i + dir * k, mu));
  const c = corners[skip ? (((i + dir * (NT - skip)) % NT) + NT) % NT : i];                              // the thin end: deep in a corner
  path.push([c[0] + 0.03 * gauss(), c[1] + 0.03 * gauss()]);
  // NP points at equal steps along the polyline
  const cum = [0];
  for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]));
  const v = [];
  for (let k = 0; k < NP; k++) {
    const want = (k / (NP - 1)) * cum[cum.length - 1];
    let m = 0; while (m < path.length - 2 && cum[m + 1] < want) m++;
    const f = (want - cum[m]) / Math.max(1e-9, cum[m + 1] - cum[m]);
    v.push(path[m][0] + f * (path[m + 1][0] - path[m][0]) + 0.03 * gauss(), path[m][1] + f * (path[m + 1][1] - path[m][1]) + 0.03 * gauss());
  }
  v.push(...profile(true));
  return fix(v);
}

const pool = [], seeded = [];
if (opt.init) {
  // { id: stroke } (one start), or [{ id, stroke, label }] (every variant of this group is a start of its own)
  const init = JSON.parse(fs.readFileSync(opt.init, 'utf8'));
  const list = Array.isArray(init) ? init.filter((e) => e.id === id).map((e) => e.stroke) : [init[id] && (init[id].stroke || init[id])];
  for (const s of list) if (s && !Array.isArray(s)) { const v = fix(fromStroke(s)); seeded.push({ v, ...cost(v) }); }
}
for (let k = 0; k < samples; k++) { const v = rnd() < SNAIL ? snailVec() : randomVec(); pool.push({ v, ...cost(v) }); }
pool.sort((a, b) => a.s - b.s);
// --local 1: only the given starts, with smaller steps (the search keeps the shape it is given and mends its numbers)
const LOCAL = opt.local === '1', SCALE = +opt.stepScale || (LOCAL ? 0.35 : 1);
const STEP0 = [];
for (let k = 0; k < NP; k++) STEP0.push(k === 0 || k === NP - 1 ? 0.1 : 0.14, k === 0 || k === NP - 1 ? 0.1 : 0.14);
STEP0.push(0.035, 0.12, 0.08, 0.2);
for (let k = 0; k < LOBES; k++) STEP0.push(0.1, 0.1, 0.04);
for (let k = 0; k < STEP0.length; k++) STEP0[k] *= SCALE;
let best = null;
const starts = LOCAL ? seeded : seeded.concat(pool.slice(0, top));
const every = [];
for (const start of starts) {
  let cur = { v: start.v.slice(), s: start.s, m: start.m }, step = 1, fails = 0;
  for (let it = 0; it < iters && step > 0.02; it++) {
    const v = cur.v.slice(), all = rnd() < 0.35;
    const k1 = Math.floor(rnd() * D), k2 = rnd() < 0.5 ? (k1 ^ 1) : Math.floor(rnd() * D);
    for (let k = 0; k < D; k++) if (all || k === k1 || k === k2) v[k] += step * STEP0[k] * gauss() * (all ? 0.5 : 1);
    fix(v);
    const c = cost(v);
    if (c.s < cur.s) { cur = { v, ...c }; fails = 0; step = Math.min(1.5, step * 1.15); } else if (++fails > 25) { step *= 0.7; fails = 0; }
  }
  every.push(cur);
  if (!best || cur.s < best.s) best = cur;
}
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const pack = (vv) => {
  const st = toStroke(vv), stroke = { p: st.p.map(r4), r0: r4(st.r0), rh: r4(st.rh), th: r4(st.th), q: r4(st.q) };
  if (st.lobes) stroke.lobes = st.lobes.map((l) => l.map(r4));
  if (cover !== undefined) stroke.cover = cover;
  if (SOFTNESS) stroke.soft = SOFTNESS;
  return stroke;
};
// --all 1: one line per start (each start's own optimum), so they can be looked at side by side
if (opt.all === '1') for (const e of every) console.log('START ' + JSON.stringify({ id, stroke: pack(e.v), searchScore: r4(e.s), m: { cover: r4(e.m.cover), bare: r4(e.m.bare), solid: r4(e.m.solid), gap: r4(e.m.gap), asym: r4(e.m.asym), wiggle: r4(e.m.wiggle || 0), valid: e.m.valid } }));
const fin = analyse(group, toStroke(best.v), { h: 0.016, cover, margin: MARGIN });
const stroke = pack(best.v);
console.log('RESULT ' + JSON.stringify({ id, stroke, score: r4(score(fin, W)), searchScore: r4(best.s), evals, m: Object.fromEntries(Object.entries(fin).map(([k, v]) => [k, typeof v === 'number' ? r4(v) : v])) }));
