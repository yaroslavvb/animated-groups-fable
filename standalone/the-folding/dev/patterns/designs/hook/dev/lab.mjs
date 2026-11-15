// dev/lab.mjs — the second run's bench (13 Nov 2026, evening): candidate hooks, written to out/lab.json for dev/lab.js
// (the sheet shows them in order), with their coarse numbers and the share of the best copy of the motif that lies in
// the default tile.
//   node lab.mjs [--per 30] item item ...      an item is
//     <id>            every candidate of cands.mjs for that group (world coordinates, seeds.mjs hook / jhook)
//     <id>@<name>     one of them by name (a prefix is enough)
//     cur:<id>        the SPEC entry of design.js
//     <file>:<id>:<k> the k-th spec of out/<file>.json (a search's output)
import fs from 'node:fs';
import { BY_ID, run, SPEC } from './lib.mjs';
import { hook, jhook } from './seeds.mjs';
import { CANDS } from './cands.mjs';
import { bestInTile } from './intile.mjs';

const argv = process.argv.slice(2);
let per = 26;
const items = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--per') per = +argv[++i]; else items.push(argv[i]); }
if (!items.length) items.push(...Object.keys(CANDS));

const list = [];                                               // [id, name, spec]
for (const it of items) {
  const p = it.split(':');
  if (p[0] === 'cur') list.push([p[1], 'cur', { ...SPEC[p[1]] }]);
  else if (p[0] === 'old') {                                   // old:<id>: the SPEC row of out/design.r5.js (the first run's last)
    const src = fs.readFileSync(new URL('./out/design.r5.js', import.meta.url), 'utf8');
    const line = src.split('\n').find((l) => l.trim().startsWith(`'${p[1]}':`));
    list.push([p[1], 'old', Function('return ' + line.slice(line.indexOf('{'), line.lastIndexOf('}') + 1))()]);
  }
  else if (p.length === 3) { const f = JSON.parse(fs.readFileSync(new URL('./out/' + p[0] + '.json', import.meta.url))); const s = { ...f[p[1]][+p[2]] }; delete s._m; list.push([p[1], it, s]); }
  else {
    const [id, name] = it.split('@');
    for (const [n, s] of CANDS[id](hook, jhook)) if (!name || n.startsWith(name)) list.push([id, n, s]);
  }
}
const out = {};
for (const [id, name, spec] of list) {
  (out[id] = out[id] || []).push({ ...spec, _name: name });
  try {
    const r = run(BY_ID[id], spec, { per });
    const flag = [r.coverage < 0.4 || r.coverage > 0.62 ? 'COV' : '', r.bare > 0.45 ? 'BARE' : '', r.solid > 0.7 ? 'SOLID' : '', r.overlap > 0.004 ? 'OVERLAP' : '', r.ms > 100 ? 'SLOW' : ''].filter(Boolean).join(' ');
    console.log(id.padEnd(6), name.padEnd(16), `dark ${r.coverage.toFixed(2)} bare ${r.bare.toFixed(2)} solid ${r.solid.toFixed(2)} verts ${String(r.verts).padStart(4)} loops ${r.loops} inTile ${bestInTile(BY_ID[id], r.shapes, 40).toFixed(2)} ${r.ms}ms ${r.plain ? 'PLAIN' : ''} ${flag}`);
  } catch (e) { console.log(id.padEnd(6), name.padEnd(16), 'ERROR', e.message); }
}
fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./out/lab.json', import.meta.url), JSON.stringify(out, null, 1));
const ids = []; for (const [id] of list) ids.push(id);
console.log("IDS '" + ids.join(',') + "'");
