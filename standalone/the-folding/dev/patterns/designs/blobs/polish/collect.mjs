// polish/collect.mjs — the RESULT and START lines of a run of polish/remote.sh, best first; writes the best N as a
// variants file for lab/view.mjs (and polish/view2.mjs).
//   node polish/collect.mjs <results dir> [--top 8] [--out variants.json] [--starts 1] [--key bare]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2], opt = {};
for (let i = 3; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) opt[process.argv[i].slice(2)] = process.argv[++i];
const top = +opt.top || 8, rows = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort((a, b) => parseInt(a) - parseInt(b))) {
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    if (line.startsWith('RESULT ')) rows.push({ job: f, kind: 'R', ...JSON.parse(line.slice(7)) });
    else if (opt.starts === '1' && line.startsWith('START ')) { const r = JSON.parse(line.slice(6)); rows.push({ job: f, kind: 'S', ...r, score: r.searchScore }); }
  }
  const err = path.join(dir, f.replace('.txt', '.err'));
  if (fs.existsSync(err) && fs.statSync(err).size) console.log(`${f} stderr: ${fs.readFileSync(err, 'utf8').slice(0, 300)}`);
}
const key = opt.key || 'score';
if (opt.id) { const keep = rows.filter((r) => r.id === opt.id); rows.length = 0; rows.push(...keep); }
rows.sort((a, b) => (key === 'score' ? a.score - b.score : (a.m[key] ?? 9) - (b.m[key] ?? 9)));
const f3 = (v) => (typeof v === 'number' ? v.toFixed(3) : String(v));
for (const r of rows.slice(0, Math.max(top, 16))) {
  const m = r.m || {};
  console.log(`${r.job.padEnd(7)} ${r.kind} ${r.id} score ${f3(r.score)} cover ${f3(m.cover)} bare ${f3(m.bare)} solid ${f3(m.solid)} gap ${f3(m.gap)} thin ${f3(m.thin)} asym ${f3(m.asym)} inTile ${f3(m.inTile)} marks ${m.marks ?? ''} ${m.extra ? JSON.stringify(m.extra) : ''}`);
}
if (opt.out) {
  const V = rows.slice(0, top).map((r, i) => ({ id: r.id, stroke: r.stroke, label: `${i + 1} ${r.job} ${r.kind} b${f3(r.m.bare)}` }));
  fs.writeFileSync(opt.out, JSON.stringify(V, null, 1));
  console.log('wrote ' + opt.out);
}
