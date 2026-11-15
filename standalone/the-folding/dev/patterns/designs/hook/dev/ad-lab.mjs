// dev/ad-lab.mjs — the art director's bench (13 Nov 2026, the critique round): candidates of ad-cands.mjs, their coarse
// numbers (dark share, bare and solid disc in tile sizes, vertices, ms, share of one mark in the default tile, the
// near-symmetry of extra.mjs), written to out/lab.json for dev/lab.js (the sheet shows them in order).
//   node ad-lab.mjs [--per 26] [--sym] item item ...   item = <id> (every candidate) | <id>@<prefix> | cur:<id>
import fs from 'node:fs';
import { BY_ID, run, SPEC } from './lib.mjs';
import { CANDS } from './ad-cands.mjs';
import { bestInTile } from './intile.mjs';
import { nearSym } from './ad-sym.mjs';

const argv = process.argv.slice(2);
let per = 26, sym = false;
const items = [];
for (let i = 0; i < argv.length; i++) { if (argv[i] === '--per') per = +argv[++i]; else if (argv[i] === '--sym') sym = true; else items.push(argv[i]); }
const list = [];
for (const it of items) {
  if (it.startsWith('cur:')) { const id = it.slice(4); list.push([id, 'cur', { ...SPEC[id] }]); continue; }
  const [key, name] = it.split('@');
  if (!CANDS[key]) { console.log('no candidates for', key); continue; }
  const id = key.includes('#') ? key.split('#')[0] : BY_ID[key] ? key : key.replace(/[a-z]+$/, '');          // '*632b': a second set of candidates for *632
  for (const [n, s] of CANDS[key]()) if (!name || n.startsWith(name)) list.push([id, n, s]);
}
const out = {};
for (const [id, name, spec] of list) {
  (out[id] = out[id] || []).push({ ...spec, _name: name });
  try {
    const r = run(BY_ID[id], spec, { per });
    const flag = [r.coverage < 0.4 || r.coverage > 0.62 ? 'COV' : '', r.bare > 0.45 ? 'BARE' : '', r.solid > 0.7 ? 'SOLID' : '', r.overlap > 0.004 ? 'OVERLAP' : '', r.ms > 100 ? 'SLOW' : ''].filter(Boolean).join(' ');
    const ns = sym ? ' sym ' + nearSym(BY_ID[id], r.shapes).toFixed(3) : '';
    console.log(id.padEnd(6), name.padEnd(22), `dark ${r.coverage.toFixed(2)} bare ${r.bare.toFixed(2)} solid ${r.solid.toFixed(2)} verts ${String(r.verts).padStart(4)} loops ${r.loops} inTile ${bestInTile(BY_ID[id], r.shapes, 40).toFixed(2)} ${r.ms}ms${ns} ${r.plain ? 'PLAIN' : ''} ${flag} bareAt ${r.bareAt}`);
  } catch (e) { console.log(id.padEnd(6), name.padEnd(22), 'ERROR', e.message); }
}
fs.mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./out/lab.json', import.meta.url), JSON.stringify(out, null, 1));
console.log("IDS '" + list.map(([id]) => id).join(',') + "'");
