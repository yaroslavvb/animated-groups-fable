// dev/pick.mjs — a short list: node pick.mjs A:o:0 A:o:1 M1:**:3 ...  -> out/cands.json (in that order per id) and the --ids string
import fs from 'node:fs';
const out = {}, ids = [];
for (const a of process.argv.slice(2)) {
  const [name, id, k] = a.split(':');
  const f = JSON.parse(fs.readFileSync(new URL('./out/' + name + '.json', import.meta.url)));
  (out[id] = out[id] || []).push(f[id][+k]); ids.push(id);
}
fs.writeFileSync(new URL('./out/cands.json', import.meta.url), JSON.stringify(out, null, 1));
ids.sort((x, y) => Object.keys(out).indexOf(x) - Object.keys(out).indexOf(y));
console.log("'" + ids.join(',') + "'");
