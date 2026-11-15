// polish/psearch.mjs — a last, slow local search on proto.mjs's own measure: find() (eye and all) + kit.js measure
// (the bare disc exactly as proto reports it), with polish/an2.mjs on a fine grid for what must not get worse (the gap
// between copies, the head, the hand) and its smooth bare stand-in to move across the measure's plateaus.
//   node polish/psearch.mjs --id '22*' --init variants.json [--iters 250] [--step 0.2] [--seed 1] [--pts 4]
// Prints START (per start) and RESULT lines like the other searches.
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, measure } from '../../../kit.js';
import { STROKES, find } from '../design.js';
import { analyse2 } from './an2.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const id = opt.id, g = BY_ID[id], iters = +opt.iters || 250, STEP = +opt.step || 0.2;
let seed = (+opt.seed || 1) >>> 0;
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const keep = STROKES[id];
function cost(st) {
  STROKES[id] = st;
  let res;
  try { res = find(g); } finally { STROKES[id] = keep; }
  if (!res.shapes.length) return { s: 99 };
  const m = measure(g, normalize(res.shapes)), a = analyse2(g, st, { h: 0.012, tau: 0.2 });
  const b = a.blobs[0] || {};
  let s = m.emptyDisc + 60 * (a.softBare || 0);
  s += 20 * Math.max(0, (opt.cgap ? +opt.cgap : 0.055) - a.cgap) + 10 * (m.overlap > 0 ? 1 : 0) + 5 * (a.valid ? 0 : 1);
  s += 3 * Math.max(0, (opt.asym ? +opt.asym : 0.2) - (b.asym || 0)) + 3 * Math.max(0, (opt.head ? +opt.head : 0.5) - (b.solid || 0));
  s += 2 * Math.max(0, (b.length || 0) - (opt.len ? +opt.len : 1.35));
  return { s, bare: m.emptyDisc, dark: m.coverage, cgap: a.cgap, asym: b.asym, solid: b.solid, soft: a.softBare };
}
const pack = (st) => ({ p: st.p.map(r4), r0: r4(st.r0 ?? st.rh), rh: r4(st.rh), th: r4(st.th || 0), q: r4(st.q || 1), ...(st.rt !== undefined ? { rt: st.rt } : {}) });
const starts = JSON.parse(fs.readFileSync(opt.init, 'utf8')).filter((v) => v.id === id).map((v) => (Array.isArray(v.stroke) ? v.stroke[0] : v.stroke));
let best = null;
for (const s0 of starts) {
  let cur = { st: pack(s0), ...cost(s0) }, step = 1, fails = 0;
  for (let it = 0; it < iters && step > 0.05; it++) {
    const st = JSON.parse(JSON.stringify(cur.st)), k = Math.floor(rnd() * (st.p.length + 3));
    const all = rnd() < 0.3;
    for (let i = 0; i < st.p.length; i++) if (all || i === k || i === (k ^ 1)) st.p[i] += STEP * step * 0.1 * gauss() * (all ? 0.5 : 1);
    if (all || k === st.p.length) { st.rh *= Math.exp(STEP * step * 0.08 * gauss()); st.r0 = st.rh; }
    if (all || k === st.p.length + 1) st.q = Math.min(2, Math.max(0.8, st.q + STEP * step * 0.2 * gauss()));
    const c = cost(st);
    if (c.s < cur.s) { cur = { st: pack(st), ...c }; fails = 0; step = Math.min(1.5, step * 1.1); } else if (++fails > 15) { step *= 0.7; fails = 0; }
  }
  console.log('START ' + JSON.stringify({ id, stroke: [cur.st], searchScore: r4(cur.s), m: { bare: cur.bare, cover: cur.dark, gap: r4(cur.cgap), asym: r4(cur.asym || 0), solid: r4(cur.solid || 0), soft: r4(cur.soft || 0) } }));
  if (!best || cur.s < best.s) best = cur;
}
console.log('RESULT ' + JSON.stringify({ id, stroke: [best.st], score: r4(best.s), m: { bare: best.bare, cover: best.dark, gap: r4(best.cgap), asym: r4(best.asym || 0), solid: r4(best.solid || 0) } }));
