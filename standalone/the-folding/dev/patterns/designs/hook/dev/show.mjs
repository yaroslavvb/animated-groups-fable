// dev/show.mjs — merge out/<names>.json into out/cands.json and print the candidates' numbers: node show.mjs A B C
import fs from 'node:fs';
const all = {};
for (const n of process.argv.slice(2)) Object.assign(all, JSON.parse(fs.readFileSync(new URL('./out/' + n + '.json', import.meta.url))));
fs.writeFileSync(new URL('./out/cands.json', import.meta.url), JSON.stringify(all, null, 1));
const ids = [];
for (const id in all) { console.log(id); all[id].forEach((s, k) => { ids.push(id); console.log('  ' + k, JSON.stringify(s._m), 'a', s.a, 'b', s.b, 'phi', s.phi, 'r', s.r, s.rt ? 'rt ' + s.rt : ''); }); }
console.log("IDS '" + ids.join(',') + "'");
