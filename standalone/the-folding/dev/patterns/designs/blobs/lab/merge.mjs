// lab/merge.mjs — the candidates of several searches side by side, scored anew with ONE set of weights, and the best
// of each group written as a strokes file.
//   node lab/merge.mjs <out strokes.json> name=file [name=file ...] [--pick '*632=name,o=name'] [--w '{"gapWant":0.07}'] [--variants out.json]
// A file is a search output (its "ALL {...}" line) or a plain { id: stroke } file. --variants writes every candidate
// as a panel list for view.mjs.
import fs from 'node:fs';
import { GROUPS, BY_ID } from '../../../../../src/groups.js';
import { analyse, score } from './measure.mjs';

const args = process.argv.slice(2), opt = {}, files = [];
let dst = null;
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
  else if (!dst) dst = args[i];
  else { const k = args[i].indexOf('='); files.push([args[i].slice(0, k), args[i].slice(k + 1)]); }
}
const W = opt.w ? JSON.parse(opt.w) : {}, pick = Object.fromEntries((opt.pick || '').split(',').filter(Boolean).map((s) => { const k = s.lastIndexOf('='); return [s.slice(0, k), s.slice(k + 1)]; }));
const cands = {};
for (const [name, file] of files) {
  const txt = fs.readFileSync(file, 'utf8'), line = txt.split('\n').find((l) => l.startsWith('ALL '));
  const ev = txt.split('\n').find((l) => l.startsWith('EVERY '));
  if (ev && opt.every === '1') { for (const r of JSON.parse(ev.slice(6))) (cands[r.id] = cands[r.id] || []).push({ name: name + r.seed, stroke: r.stroke }); continue; }
  const all = line ? JSON.parse(line.slice(4)) : JSON.parse(txt);
  for (const [id, r] of Object.entries(all)) (cands[id] = cands[id] || []).push({ name, stroke: r.stroke || r });
}
const out = {}, variants = [], only = opt.ids ? new Set(opt.ids.split(',')) : null;
for (const g of GROUPS) {
  if (only && !only.has(g.id)) continue;
  const list = cands[g.id] || [];
  let best = null;
  for (const c of list) {
    c.m = analyse(BY_ID[g.id], c.stroke, { h: 0.016, margin: opt.margin ? +opt.margin : undefined });
    c.s = score(c.m, W);
    const m = c.m, r = (v) => (v ?? 0).toFixed(3);
    console.log(`${g.id.padEnd(6)} ${c.name.padEnd(6)} score ${c.s.toFixed(3)}  bare ${r(m.bare)} gap ${r(m.gap)} solid ${r(m.solid)} asym ${r(m.asym)} dent ${r(m.dent)} in ${r(m.inTile)} nose ${r(m.nose)} cover ${r(m.cover)} level ${r(m.level)}${m.valid ? '' : ' INVALID'}`);
    variants.push({ id: g.id, label: `${g.id} ${c.name}`, stroke: c.stroke });
    if (pick[g.id] ? pick[g.id] === c.name : !best || c.s < best.s) best = c;
  }
  if (best) { out[g.id] = best.stroke; console.log(`${g.id.padEnd(6)} -> ${best.name}`); }
}
fs.writeFileSync(dst, JSON.stringify(out, null, 1));
if (opt.variants) fs.writeFileSync(opt.variants, JSON.stringify(variants));
console.log('wrote ' + dst);
