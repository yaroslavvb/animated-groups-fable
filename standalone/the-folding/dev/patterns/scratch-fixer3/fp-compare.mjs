// dev/patterns/scratch-fixer3/fp-compare.mjs (a copy of the WebKit reviewer's, its folder OUT/fixer3/fp) — the motifs of node, Chrome and WebKit side by side: which prints
// differ between engines, by how much; and which Math functions give other doubles.
//   node dev/patterns/scratch-review-webkit/fp-compare.mjs [dir]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/fixer3/fp';
const load = (e) => { try { return JSON.parse(fs.readFileSync(path.join(dir, `fp-${e}.json`), 'utf8')); } catch { return null; } };
const N = load('node'), C = load('chromium'), K = load('webkit');
const cmp = (a, b) => {
  if (!a || !b) return a === b ? 'same' : `one is null (${!!a} ${!!b})`;
  if (a.kind !== b.kind) return `kind ${a.kind} / ${b.kind}`;
  if (a.kind !== 'shapes') return JSON.stringify(a) === JSON.stringify(b) ? 'same' : 'linear/rings differ: ' + JSON.stringify(a).slice(0, 80) + ' | ' + JSON.stringify(b).slice(0, 80);
  if (JSON.stringify(a.polys) === JSON.stringify(b.polys)) return 'same';
  const pa = a.polys, pb = b.polys;
  let note = `polys ${pa.length}/${pb.length}, verts ${a.verts}/${b.verts}, area ${a.netArea.toFixed(5)}/${b.netArea.toFixed(5)} (${((b.netArea / a.netArea - 1) * 100).toFixed(2)} %)`;
  if (pa.length === pb.length && pa.every((P, i) => P.pts.length === pb[i].pts.length)) {
    let mx = 0;
    for (let i = 0; i < pa.length; i++) for (let j = 0; j < pa[i].pts.length; j++) mx = Math.max(mx, Math.abs(pa[i].pts[j] - pb[i].pts[j]));
    note += `, same shape counts, max |dx| ${mx.toExponential(2)}`;
  } else note += ', DIFFERENT OUTLINES';
  return note;
};
console.log(`node ${N && N.version}; chromium ${C && C.version}; webkit ${K && K.version}`);
const keys = Object.keys((N || C).motifs.out);
let sameNC = 0, sameCK = 0;
const rows = [];
for (const k of keys) {
  const nc = N && C ? cmp(N.motifs.out[k], C.motifs.out[k]) : 'n/a', ck = C && K ? cmp(C.motifs.out[k], K.motifs.out[k]) : 'n/a';
  if (nc === 'same') sameNC++;
  if (ck === 'same') sameCK++;
  if (nc !== 'same' || ck !== 'same') rows.push(`  ${k.padEnd(14)} node~chrome: ${nc}\n  ${''.padEnd(14)} chrome~webkit: ${ck}`);
}
console.log(`${keys.length} prints: node = chrome in ${sameNC}; chrome = webkit in ${sameCK}`);
for (const r of rows) console.log(r);
if (C && K) {
  console.log('-- Math: results that are not the same double (of ' + C.math.cos.length + ' each), chrome vs webkit:');
  const line = [];
  for (const f of Object.keys(C.math)) { let d = 0, ulps = 0; for (let i = 0; i < C.math[f].length; i++) { const a = C.math[f][i], b = K.math[f][i]; if (!Object.is(a, b) && !(Number.isNaN(a) && Number.isNaN(b))) { d++; } } line.push(`${f} ${d}`); }
  console.log('   ' + line.join(', '));
  if (K.log && K.log.length) console.log('webkit console: ' + JSON.stringify(K.log.slice(0, 8)));
  const msC = C.motifs.ms, msK = K.motifs.ms, ks = Object.keys(msK);
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  for (const p of ['paisley', 'soft', 'tomoe', 'comma']) {
    const kk = ks.filter((k) => k.startsWith(p + ' '));
    console.log(`-- setGroup with ${p}, first ask: chrome median ${med(kk.map((k) => msC[k])).toFixed(1)} max ${Math.max(...kk.map((k) => msC[k])).toFixed(1)}; webkit median ${med(kk.map((k) => msK[k])).toFixed(1)} max ${Math.max(...kk.map((k) => msK[k])).toFixed(1)} ms`);
  }
}
