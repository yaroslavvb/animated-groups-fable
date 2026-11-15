// polish/search2.mjs — lab/search.mjs for an entry of K strokes (a big comma and smaller ones per tile): random strokes
// in the tile (or the starts of a file), then hill climbing on polish/an2.mjs score2.
//   node polish/search2.mjs --id '*442' [--k 2] [--seed 1] [--samples 400] [--top 6] [--iters 900] [--h 0.022]
//        [--w '{"bare":1}'] [--init file.json] [--local 1] [--stepScale 0.35] [--cover 0.5] [--pts 4] [--rt 0.04]
//        [--rh0 0.1,0.34] [--rh1 0.05,0.2]
// Prints START lines (with --all 1) and one RESULT {"id", "stroke": [..], "m", "score"} line. polish-soft, 14 Nov 2026.
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { frameOf } from '../design.js';
import { tileInFrame } from '../lab/measure.mjs';
import { analyse2, score2 } from './an2.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const id = opt.id, group = BY_ID[id];
if (!group) { console.error('no group ' + id); process.exit(2); }
const W = opt.w ? JSON.parse(opt.w) : {};
const K = +opt.k || 2, NP = +opt.pts || 4, H = +opt.h || 0.022, samples = opt.samples !== undefined ? +opt.samples : 400;
const top = +opt.top || 6, iters = +opt.iters || 900, cover = opt.cover ? +opt.cover : undefined, RT = opt.rt ? +opt.rt : undefined;
const RH = [opt.rh0 ? opt.rh0.split(',').map(Number) : [0.1, 0.34], opt.rh1 ? opt.rh1.split(',').map(Number) : [0.05, 0.2], [0.05, 0.2], [0.05, 0.2]];
let seed = (+opt.seed || 1) >>> 0;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const u = (a, b) => a + rnd() * (b - a);

const F = frameOf(group), tile = tileInFrame(group, F), NT = tile.length;
let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
for (const p of tile) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
const inTile = (x, y) => tile.every((a, i) => { const b = tile[(i + 1) % NT]; return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= 0; });
const OUT = opt.out ? +opt.out : 0.2;
const C = 2 * NP, PER = C + 4, D = K * PER;
const clamp = (v, [a, b]) => Math.min(b, Math.max(a, v));
function fix(v) {
  for (let s = 0; s < K; s++) {
    const o = s * PER;
    for (let k = 0; k < C; k += 2) { v[o + k] = clamp(v[o + k], [bx0 - OUT, bx1 + OUT]); v[o + k + 1] = clamp(v[o + k + 1], [by0 - OUT, by1 + OUT]); }
    v[o + C] = clamp(v[o + C], RH[s]); v[o + C + 1] = clamp(v[o + C + 1], [0.15, 1]); v[o + C + 2] = clamp(v[o + C + 2], [0, 0.5]); v[o + C + 3] = clamp(v[o + C + 3], [0.8, 2]);
  }
  return v;
}
const toStrokes = (v) => {
  const out = [];
  for (let s = 0; s < K; s++) {
    const o = s * PER, st = { p: v.slice(o, o + C), rh: v[o + C], r0: v[o + C] * (v[o + C + 2] > 0.02 ? v[o + C + 1] : 1), th: v[o + C + 2] > 0.02 ? v[o + C + 2] : 0, q: v[o + C + 3] };
    if (RT !== undefined) st.rt = RT;
    if (s === 0 && cover !== undefined) st.cover = cover;
    out.push(st);
  }
  return out;
};
function fromStroke(s) {
  const p = s.p.slice();
  while (p.length < C) {
    let best = 0, bl = -1;
    for (let i = 0; i + 3 < p.length; i += 2) { const l = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]); if (l > bl) { bl = l; best = i; } }
    p.splice(best + 2, 0, (p[best] + p[best + 2]) / 2, (p[best + 1] + p[best + 3]) / 2);
  }
  return [...p.slice(0, C), s.rh, (s.r0 ?? s.rh) / s.rh, s.th || 0, s.q || 1];
}
let evals = 0;
function cost(v, h = H) {
  evals++;
  const m = analyse2(group, toStrokes(v), { h, cover, quick: true });
  return { s: score2(m, W), m };
}
const inside = () => { let x, y; do { x = u(bx0, bx1); y = u(by0, by1); } while (!inTile(x, y)); return [x, y]; };
// the corners of the tile: where a disc of radius r keeps `margin` from both sides of corner i (on its bisector)
const corners = tile.map((v, i) => {
  const a = tile[(i + NT - 1) % NT], b = tile[(i + 1) % NT];
  const ux = a[0] - v[0], uy = a[1] - v[1], wx = b[0] - v[0], wy = b[1] - v[1], lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
  const half = Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (lu * lw)))) / 2;
  let hx = ux / lu + wx / lw, hy = uy / lu + wy / lw; const lh = Math.hypot(hx, hy) || 1;
  return { v, hx: hx / lh, hy: hy / lh, half, side: Math.min(lu, lw) };
});
const cornerPt = (i, r, margin = 0.03) => { const c = corners[i], d = Math.min((r + margin) / Math.sin(c.half), 0.6 * c.side); return [c.v[0] + d * c.hx, c.v[1] + d * c.hy]; };
// the incentre (for a triangle; the centroid of the corners otherwise)
let ix = 0, iy = 0;
if (NT === 3) { let ws = 0; for (let i = 0; i < 3; i++) { const p = tile[(i + 1) % 3], q = tile[(i + 2) % 3], w = Math.hypot(p[0] - q[0], p[1] - q[1]); ix += w * tile[i][0]; iy += w * tile[i][1]; ws += w; } ix /= ws; iy /= ws; }
else { for (const p of tile) { ix += p[0] / NT; iy += p[1] / NT; } }
const MODE = opt.mode || 'corners';
function randomVec() {
  const v = [];
  if (MODE === 'corners') {
    // the big comma: its head about the incentre, its tail toward a corner; the small ones: a head in another corner
    const i0 = Math.floor(rnd() * NT);
    const push = (head, tail, rh, s) => {
      v.push(...head);
      for (let k = 1; k < NP - 1; k++) { const f = k / (NP - 1); v.push(head[0] + f * (tail[0] - head[0]) + 0.18 * gauss(), head[1] + f * (tail[1] - head[1]) + 0.18 * gauss()); }
      v.push(...tail, rh, u(0.7, 1), rnd() < 0.7 ? 0 : u(0.05, 0.25), u(0.9, 1.7));
    };
    const r0 = u(RH[0][0] + 0.04, RH[0][1]);
    push([ix + 0.08 * gauss(), iy + 0.08 * gauss()], ((p) => [p[0] + 0.03 * gauss(), p[1] + 0.03 * gauss()])(cornerPt(i0, 0.04 + 0.03 * rnd())), r0, 0);
    for (let s = 1; s < K; s++) {
      let j; do { j = Math.floor(rnd() * NT); } while (j === i0 && rnd() < 0.8);
      const r1 = u(RH[s][0], RH[s][1]), head = cornerPt(j, r1, 0.03 + 0.04 * rnd());
      const ang = 2 * Math.PI * rnd(), L = u(0.2, 0.55);
      let tail = [head[0] + L * Math.cos(ang), head[1] + L * Math.sin(ang)];
      if (!inTile(tail[0], tail[1])) tail = [(head[0] + ix) / 2 + 0.1 * gauss(), (head[1] + iy) / 2 + 0.1 * gauss()];
      push(head, tail, r1, s);
    }
    return fix(v);
  }
  for (let s = 0; s < K; s++) {
    const a = inside(), d = inside();
    v.push(...a);
    for (let k = 1; k < NP - 1; k++) { const q = inside(); v.push(q[0] + 0.15 * gauss(), q[1] + 0.15 * gauss()); }
    v.push(...d);
    v.push(u(RH[s][0], RH[s][1]), u(0.6, 1), rnd() < 0.6 ? 0 : u(0.05, 0.3), u(0.9, 1.7));
  }
  return fix(v);
}
const seeded = [], pool = [];
if (opt.init) {
  // [{ id, stroke: [s0, s1, ...], label }] (each entry of this group with K strokes is a start), or { id: [..] }
  const init = JSON.parse(fs.readFileSync(opt.init, 'utf8'));
  const list = Array.isArray(init) ? init.filter((e) => e.id === id).map((e) => e.stroke) : [init[id]];
  for (const s of list) if (Array.isArray(s) && s.length === K) { const v = fix(s.flatMap(fromStroke)); seeded.push({ v, ...cost(v) }); }
}
for (let k = 0; k < samples; k++) { const v = randomVec(); pool.push({ v, ...cost(v) }); }
pool.sort((a, b) => a.s - b.s);
const LOCAL = opt.local === '1', SCALE = +opt.stepScale || (LOCAL ? 0.35 : 1);
const STEP0 = [];
for (let s = 0; s < K; s++) {
  for (let k = 0; k < NP; k++) STEP0.push(k === 0 || k === NP - 1 ? 0.1 : 0.14, k === 0 || k === NP - 1 ? 0.1 : 0.14);
  STEP0.push(0.035, 0.12, 0.08, 0.2);
}
for (let k = 0; k < STEP0.length; k++) STEP0[k] *= SCALE;
let best = null;
const starts = LOCAL ? seeded : seeded.concat(pool.slice(0, top));
const every = [];
for (const start of starts) {
  let cur = { v: start.v.slice(), s: start.s, m: start.m }, step = 1, fails = 0;
  for (let it = 0; it < iters && step > 0.02; it++) {
    const v = cur.v.slice(), all = rnd() < 0.3, s0 = Math.floor(rnd() * K);
    const k1 = s0 * PER + Math.floor(rnd() * PER), k2 = rnd() < 0.5 ? (k1 ^ 1) : Math.floor(rnd() * D);
    for (let k = 0; k < D; k++) if (all || k === k1 || k === k2) v[k] += step * STEP0[k] * gauss() * (all ? 0.5 : 1);
    fix(v);
    const c = cost(v);
    if (c.s < cur.s) { cur = { v, ...c }; fails = 0; step = Math.min(1.5, step * 1.15); } else if (++fails > 25) { step *= 0.7; fails = 0; }
  }
  every.push(cur);
  if (!best || cur.s < best.s) best = cur;
}
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const pack = (vv) => toStrokes(vv).map((st) => {
  const o = { p: st.p.map(r4), r0: r4(st.r0), rh: r4(st.rh), th: r4(st.th), q: r4(st.q) };
  if (st.rt !== undefined) o.rt = st.rt;
  if (st.cover !== undefined) o.cover = st.cover;
  return o;
});
const summary = (m) => ({ cover: r4(m.cover), bare: r4(m.bare), solid: r4(m.solid), gap: r4(m.gap), thin: r4(m.thin), marks: m.marks, merged: m.merged, dCentre: r4(m.dCentre ?? 0), valid: m.valid,
  extra: (m.blobs || []).map((b) => (b.found ? [r4(b.share), r4(b.asym), r4(b.solid)] : 'gone')) });
if (opt.all === '1') for (const e of every) console.log('START ' + JSON.stringify({ id, stroke: pack(e.v), searchScore: r4(e.s), m: summary(e.m) }));
if (best) {
  const fin = analyse2(group, toStrokes(best.v), { h: 0.016, cover });
  console.log('RESULT ' + JSON.stringify({ id, stroke: pack(best.v), score: r4(score2(fin, W)), searchScore: r4(best.s), evals, m: summary(fin) }));
}
