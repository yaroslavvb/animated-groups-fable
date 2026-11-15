// polish/eval.mjs — the candidates of some variants files for one group, measured on a fine grid (polish/an2.mjs at
// h 0.01: the search's grid of 0.02 misses narrow channels), best bare first among those whose gap is wide enough.
//   node polish/eval.mjs --id '**' [--h 0.01] [--gap 0.06] [--out best.json] [--top 6] file1.json file2.json ...
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { STROKES } from '../design.js';
import { analyse2 } from './an2.mjs';

const args = process.argv.slice(2), opt = {}, files = [];
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else files.push(args[i]);
const id = opt.id, g = BY_ID[id], h = +opt.h || 0.01, gapMin = +opt.gap || 0.06;
const cands = [{ label: 'table now', stroke: STROKES[id] }];
for (const f of files) for (const v of JSON.parse(fs.readFileSync(f, 'utf8'))) if (v.id === id) cands.push({ label: `${f.split('/').pop()} ${v.label}`, stroke: Array.isArray(v.stroke) && v.stroke.length === 1 ? v.stroke[0] : v.stroke });
const rows = cands.map((c) => { const m = analyse2(g, c.stroke, { h }); return { ...c, m }; });
rows.sort((a, b) => ((b.m.cgap >= gapMin) - (a.m.cgap >= gapMin)) || a.m.bare - b.m.bare);
for (const r of rows.slice(0, +opt.top || 12)) console.log(`${r.m.bare.toFixed(3)} cgap ${r.m.cgap.toFixed(3)} gap ${r.m.gap.toFixed(3)} thin ${r.m.thin.toFixed(3)} solid ${r.m.solid.toFixed(3)} cover ${r.m.cover.toFixed(3)} marks ${r.m.marks} ${r.m.blobs.map((b) => b.found ? `[a${b.share.toFixed(2)} y${b.asym.toFixed(2)} s${b.solid.toFixed(2)}]` : '[gone]').join('')}  ${r.label}`);
if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(rows.slice(0, +opt.top || 6).map((r) => ({ id, stroke: r.stroke, label: `${r.label} b${r.m.bare.toFixed(3)} cg${r.m.cgap.toFixed(3)}` })), null, 1));
