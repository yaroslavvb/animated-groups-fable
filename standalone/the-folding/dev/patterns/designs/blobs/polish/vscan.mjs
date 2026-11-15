// polish/vscan.mjs — every candidate of some variants files for one group through the page's own checks (find() with
// the eye, src/shapes.js printable + validateShapes) and proto's measure (kit.js): the ones the page would show, best
// bare first.   node polish/vscan.mjs --id '*632' file1.json [file2.json ...] [--out ok.json]
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { makeShapePrint, printable, validateShapes } from '../../../../../src/shapes.js';
import { normalize, measure } from '../../../kit.js';
import { STROKES, find, meta } from '../design.js';

const args = process.argv.slice(2), opt = {}, files = [];
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else files.push(args[i]);
const id = opt.id, g = BY_ID[id], keep = STROKES[id], rows = [];
for (const f of files) for (const v of JSON.parse(fs.readFileSync(f, 'utf8'))) {
  if (v.id !== id) continue;
  const st = Array.isArray(v.stroke) && v.stroke.length === 1 ? v.stroke[0] : v.stroke;
  STROKES[id] = st;
  let res;
  try { res = find(g); } finally { STROKES[id] = keep; }
  const pr = makeShapePrint(g, { key: meta.key, name: meta.label, shapes: res.shapes });
  const p = printable(pr), val = validateShapes(pr), m = measure(g, normalize(res.shapes));
  rows.push({ id, stroke: st, label: `${f.split('/').pop()} ${v.label}`, ok: p.ok && val.ok, gap: val.gap, bare: m.emptyDisc, dark: m.coverage, overlap: m.overlap });
}
rows.sort((a, b) => (b.ok - a.ok) || a.bare - b.bare);
for (const r of rows) console.log(`${r.ok ? 'ok ' : 'BAD'} bare ${r.bare.toFixed(3)} gap ${(r.gap ?? 0).toFixed(3)} dark ${r.dark.toFixed(3)} overlap ${r.overlap}  ${r.label}`);
if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(rows.filter((r) => r.ok).map((r) => ({ id, stroke: r.stroke, label: `${r.label} b${r.bare} g${(r.gap ?? 0).toFixed(3)}` })), null, 1));
