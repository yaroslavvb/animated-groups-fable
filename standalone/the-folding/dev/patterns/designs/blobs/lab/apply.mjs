// lab/apply.mjs — the strokes of a search (the "ALL {...}" line that search-all.mjs prints) as a plain { id: stroke } file,
// and a table of their numbers.
//   node lab/apply.mjs <search output> <strokes.json> [--merge <older strokes.json>] [--only id,id]
// With --merge, ids that the search does not have (or --only leaves out) are taken from the older file.
import fs from 'node:fs';
const [src, dst, ...rest] = process.argv.slice(2), opt = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[++i];
const line = fs.readFileSync(src, 'utf8').split('\n').find((l) => l.startsWith('ALL '));
if (!line) { console.error('no ALL line in ' + src); process.exit(1); }
const all = JSON.parse(line.slice(4)), out = opt.merge ? JSON.parse(fs.readFileSync(opt.merge, 'utf8')) : {};
const only = opt.only ? new Set(opt.only.split(',')) : null;
for (const [id, r] of Object.entries(all)) {
  if (only && !only.has(id)) continue;
  out[id] = r.stroke;
  const m = r.m;
  console.log(`${id.padEnd(6)} score ${String(r.score).padEnd(7)} cover ${m.cover} bare ${m.bare} solid ${m.solid} gap ${m.gap} thin ${m.thin} inTile ${m.inTile} dent ${m.dent} len ${m.length} marks ${m.marks}${m.valid ? '' : ' INVALID'}`);
}
fs.writeFileSync(dst, JSON.stringify(out, null, 1));
console.log('wrote ' + dst + ' (' + Object.keys(out).length + ' strokes)');
