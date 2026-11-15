// summarize.mjs — the table of designs-measure.test.js, per design (review-math, 13 Nov 2026).
//   node dev/patterns/scratch-review-math/summarize.mjs <designs-measure.json> [--rows key]
import { readFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const showRows = process.argv.indexOf('--rows') > 0 ? process.argv[process.argv.indexOf('--rows') + 1] : null;
const by = new Map();
for (const r of rows) { if (!by.has(r.key)) by.set(r.key, []); by.get(r.key).push(r); }
const f = (v, d = 3) => (v == null || !Number.isFinite(v) ? String(v) : v.toFixed(d));
const mx = (a, k) => a.reduce((m, r) => (r[k] != null && Number.isFinite(r[k]) ? Math.max(m, r[k]) : m), -Infinity);
const mn = (a, k) => a.reduce((m, r) => (r[k] != null && Number.isFinite(r[k]) ? Math.min(m, r[k]) : m), Infinity);
const arg = (a, k, best) => a.reduce((b, r) => (r[k] != null && Number.isFinite(r[k]) && (b == null || best(r[k], b[k])) ? r : b), null);
for (const [key, a] of by) {
  const refused = a.filter((r) => r.load || r.find || r.make), notOk = a.filter((r) => r.ok === false);
  const dCov = a.map((r) => (r.cov != null && r.kitCov != null ? Math.abs(r.cov - r.kitCov) : null)).filter((v) => v != null);
  const dCovEx = a.map((r) => (r.cov != null && r.covExact != null ? Math.abs(r.cov - r.covExact) : null)).filter((v) => v != null);
  const dEmpty = a.map((r) => (r.empty != null && r.kitEmpty != null ? Math.abs(r.empty - r.kitEmpty) : null)).filter((v) => v != null);
  const dDark = a.map((r) => (r.dark != null && r.kitDark != null ? Math.abs(r.dark - r.kitDark) : null)).filter((v) => v != null);
  const dTex = a.map((r) => (r.texShare != null ? r.texShare - r.exactShare : null)).filter((v) => v != null);
  const neck = arg(a, 'neckTexels', (x, y) => x < y), btw = arg(a, 'betweenTexels', (x, y) => x < y), gap = arg(a, 'gapTexels', (x, y) => x < y);
  const slow = arg(a, 'findMs', (x, y) => x > y), bake = arg(a, 'bakeMs', (x, y) => x > y), fill = arg(a, 'fillVerts', (x, y) => x > y);
  console.log(`${key.padEnd(9)} groups ${a.length}, refused ${refused.length}, not ok ${notOk.length}${notOk.length ? ' (' + notOk.map((r) => r.g).join(' ') + ')' : ''}`);
  console.log(`   coverage: prod-vs-kit max |d| ${f(Math.max(...dCov))}, prod-vs-exact max |d| ${f(Math.max(...dCovEx))}; range ${f(mn(a, 'cov'))}..${f(mx(a, 'cov'))}; overlap max ${f(mx(a, 'overlap'))} (kit ${f(mx(a, 'kitOverlap'))}); empty disc |d| ${f(Math.max(...dEmpty))}, dark disc |d| ${f(Math.max(...dDark))}`);
  console.log(`   texture: tone mismatches ${a.reduce((s, r) => s + (r.texBad || 0), 0)} of ${a.reduce((s, r) => s + (r.texN || 0), 0)}; dark share texture - exact: ${f(Math.min(...dTex), 4)}..${f(Math.max(...dTex), 4)}; bake max ${f(bake && bake.bakeMs, 1)} ms (${bake && bake.g})`);
  console.log(`   thinnest: neck ${f(neck && neck.neckTexels, 2)} texels (${neck && neck.g}), between polygons ${f(btw && btw.betweenTexels, 2)} (${btw && btw.g}), between copies ${f(gap && gap.gapTexels, 2)} (${gap && gap.g}); texel ${f(mn(a, 'pitch'), 4)}..${f(mx(a, 'pitch'), 4)} tile`);
  console.log(`   find max ${f(slow && slow.findMs, 0)} ms (${slow && slow.g}); one plane fill max ${fill && fill.fillVerts} vertices (${fill && fill.g}, ${fill && fill.fillCopies} copies)`);
  for (const r of notOk) console.log(`   ${r.g}: ${r.problems.join(' | ').slice(0, 300)}`);
  for (const r of refused) console.log(`   ${r.g}: REFUSED ${r.load || r.find || r.make}`);
  if (showRows === key) for (const r of a) console.log(`     ${r.g.padEnd(6)} cov ${r.cov} kit ${r.kitCov} exact ${f(r.covExact)} | empty ${r.empty}/${r.kitEmpty} dark ${r.dark}/${r.kitDark} | tex ${f(r.texShare, 4)} exact ${f(r.exactShare, 4)} | neck ${f(r.neckTexels, 1)} btw ${f(r.betweenTexels, 1)} gap ${f(r.gapTexels, 1)} | find ${r.findMs} bake ${r.bakeMs} fill ${r.fillVerts}`);
}
