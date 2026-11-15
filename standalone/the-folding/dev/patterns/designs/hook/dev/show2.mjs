// dev/show2.mjs — the candidates of several out/<name>.json files side by side: node show2.mjs M1 M2 ...  -> out/cands.json (per id: all, best J first)
import fs from 'node:fs';
const all = {};
for (const n of process.argv.slice(2)) { const f = JSON.parse(fs.readFileSync(new URL('./out/' + n + '.json', import.meta.url))); for (const id in f) for (const s of f[id]) (all[id] = all[id] || []).push({ ...s, _from: n }); }
const ids = [];
for (const id in all) {
  all[id].sort((x, y) => x._m.J - y._m.J);
  console.log(id);
  all[id].forEach((s, k) => { ids.push(id); const m = s._m; console.log(`  ${k} ${s._from.padEnd(3)} J ${m.J.toFixed(2)} dark ${m.dark.toFixed(2)} bare ${m.bare.toFixed(2)} solid ${m.solid.toFixed(2)} inT ${m.inTile.toFixed(2)} trim ${m.trim.toFixed(2)} loops ${m.loops} | a ${s.a} b ${s.b} phi ${s.phi} r ${s.r}${s.u ? ' J' : ''}${s.dr ? ' dot ' + s.dr : ''}${s.dots ? ' dots' : ''}`); });
}
fs.writeFileSync(new URL('./out/cands.json', import.meta.url), JSON.stringify(all, null, 1));
console.log("IDS '" + ids.join(',') + "'");
