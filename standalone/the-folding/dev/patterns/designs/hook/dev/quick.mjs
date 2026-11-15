// dev/quick.mjs — the coarse numbers of every spec of out/<name>.json:  node quick.mjs seeds [per]
import fs from 'node:fs';
import { BY_ID, run } from './lib.mjs';
const f = JSON.parse(fs.readFileSync(new URL('./out/' + (process.argv[2] || 'cands') + '.json', import.meta.url)));
const per = +process.argv[3] || 18, ids = [];
for (const id in f) f[id].forEach((sp, k) => {
  ids.push(id);
  try { const m = run(BY_ID[id], sp, { per }); console.log(id.padEnd(6), k, `dark ${m.coverage.toFixed(2)} bare ${m.bare.toFixed(2)} solid ${m.solid.toFixed(2)} trim ${m.trimmed.toFixed(2)} loops ${m.loops} verts ${m.verts} ${m.ms}ms`); }
  catch (e) { console.log(id.padEnd(6), k, 'ERROR', e.message); }
});
console.log("IDS '" + ids.join(',') + "'");
