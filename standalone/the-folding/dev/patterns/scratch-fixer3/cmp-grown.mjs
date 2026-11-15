// dev/patterns/scratch-fixer3/cmp-grown.mjs — Paisley's grown motifs of two machines (grown.mjs json) side by side, and
// against Chrome on the mini (the WebKit reviewer's fp-chromium.json, the built page of 00:05) and WebKit (fp-webkit.json).
//   node dev/patterns/scratch-fixer3/cmp-grown.mjs <a.json> <b.json>
import fs from 'node:fs';

const [fa, fb] = process.argv.slice(2);
const A = JSON.parse(fs.readFileSync(fa, 'utf8')), B = JSON.parse(fs.readFileSync(fb, 'utf8'));
const FP = '/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/review-webkit/fp/';
const C = JSON.parse(fs.readFileSync(FP + 'fp-chromium.json', 'utf8')).motifs.out, K = JSON.parse(fs.readFileSync(FP + 'fp-webkit.json', 'utf8')).motifs.out;
const flat = (shapes) => shapes.map((s) => s.pts.flat());
const cmp = (a, b) => {
  if (a.length !== b.length) return `${a.length} vs ${b.length} marks`;
  let mx = 0;
  for (let i = 0; i < a.length; i++) { if (a[i].length !== b[i].length) return `mark ${i}: ${a[i].length / 2} vs ${b[i].length / 2} points`; for (let k = 0; k < a[i].length; k++) mx = Math.max(mx, Math.abs(a[i][k] - b[i][k])); }
  return mx === 0 ? 'identical' : `max |d| ${mx.toExponential(2)}`;
};
console.log(`${A.arch} node ${A.node}  vs  ${B.arch} node ${B.node}`);
for (const id of Object.keys(A.out)) {
  const a = A.out[id], b = B.out[id], ch = C['paisley ' + id], wk = K['paisley ' + id];
  const chPolys = ch ? ch.polys.map((p) => p.pts) : null, wkPolys = wk ? wk.polys.map((p) => p.pts) : null;
  console.log(id.padEnd(6), `A~B: ${cmp(flat(a.shapes), flat(b.shapes)).padEnd(26)} flaw ${String(a.flaw).padEnd(6)} / ${String(b.flaw).padEnd(6)} cover ${a.info.cover}/${b.info.cover} bare ${a.info.bare}/${b.info.bare} marks ${a.info.marks}/${b.info.marks}`,
    `| A~chrome: ${chPolys ? cmp(flat(a.shapes), chPolys) : 'n/a'} | B~chrome: ${chPolys ? cmp(flat(b.shapes), chPolys) : 'n/a'} | A~webkit: ${wkPolys ? cmp(flat(a.shapes), wkPolys) : 'n/a'}`);
}
