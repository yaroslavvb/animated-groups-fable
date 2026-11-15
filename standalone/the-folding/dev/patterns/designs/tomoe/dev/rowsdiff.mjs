// node dev/rowsdiff.mjs <old rows.json> <new rows.json> — proto's numbers side by side (a markdown table for NOTES.md),
// plus the worst values of the new set.
import fs from 'node:fs';

const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const old = Object.fromEntries(a.map((r) => [r.id, r]));
const f = (x) => (x === undefined || x === null ? '-' : (+x).toFixed(3));
console.log('| group | dark (v3 → now) | bare ⌀ | solid ⌀ | verts | ms |');
console.log('|---|---|---|---|---|---|');
for (const r of b) {
  const o = old[r.id] || {};
  const id = r.id.replace(/\*/g, '\\*');
  console.log(`| ${id} | ${f(o.coverage)} → **${f(r.coverage)}** | ${f(o.emptyDisc)} → **${f(r.emptyDisc)}** | ${f(o.darkDisc)} → **${f(r.darkDisc)}** | ${r.verts} | ${r.ms} |`);
}
const w = (k, fn) => b.reduce((m, r) => fn(m, r[k]), b[0][k]);
console.log(`\nworst: dark ${w('coverage', Math.min)} – ${w('coverage', Math.max)}, bare max ${w('emptyDisc', Math.max)}, solid max ${w('darkDisc', Math.max)}, verts max ${w('verts', Math.max)}, ms max ${w('ms', Math.max)}`);
