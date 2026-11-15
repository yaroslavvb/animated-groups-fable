// polish/pmeasure.mjs — proto.mjs's numbers in node: find() of design.js (eye and all), then kit.js normalize + measure,
// the very function proto.html calls (dark share, bare disc, solid disc, overlap, vertices). Rows may be replaced for
// the run by a { id: stroke | [strokes] } file, or by the candidates of a variants file (one line each).
//   node polish/pmeasure.mjs --ids '22*,2*22' [--rows file.json] [--variants file.json] [--cover 0.53]
import fs from 'node:fs';
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, measure } from '../../../kit.js';
import { STROKES, find } from '../design.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const runs = [];
if (opt.variants) for (const v of JSON.parse(fs.readFileSync(opt.variants, 'utf8'))) runs.push({ id: v.id, stroke: v.stroke, label: v.label });
else {
  const rows = opt.rows ? JSON.parse(fs.readFileSync(opt.rows, 'utf8')) : {};
  for (const id of opt.ids.split(',')) runs.push({ id, stroke: rows[id] || STROKES[id], label: rows[id] ? 'file' : 'table' });
}
for (const r of runs) {
  const keep = STROKES[r.id];
  let st = Array.isArray(r.stroke) && r.stroke.length === 1 ? r.stroke[0] : r.stroke;
  if (opt.cover) st = Array.isArray(st) ? st.map((s, k) => (k ? s : { ...s, cover: +opt.cover })) : { ...st, cover: +opt.cover };
  STROKES[r.id] = st;
  const t0 = performance.now(), res = find(BY_ID[r.id]), ms = performance.now() - t0;
  STROKES[r.id] = keep;
  const m = measure(BY_ID[r.id], normalize(res.shapes));
  console.log(`${r.id.padEnd(6)} dark ${m.coverage.toFixed(3)} bare ${m.emptyDisc.toFixed(3)} solid ${m.darkDisc.toFixed(3)} overlap ${m.overlap} verts ${m.verts} ${ms.toFixed(0)} ms  ${r.label || ''}`);
}
