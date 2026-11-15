// lab/notes-table.mjs — the numbers table of NOTES.md from the official rows.json (prints markdown rows).
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const kind = { pair: 'pair', 'rotation 2': 'half-turn', 'rotation 3': 'rotation 3', 'rotation 4': 'rotation 4', 'rotation 6': 'rotation 6', glide: 'glide' };
const esc = (id) => id.replace(/\*/g, '\\*');
for (const x of rows) {
  const i = x.info || {}, c = i.comma || {}, f2 = (v) => (v == null ? '—' : (+v).toFixed(2)), f3 = (v) => (+v).toFixed(3);
  const b = x.emptyDisc > 0.45 ? '**' + f3(x.emptyDisc) + '**' : f3(x.emptyDisc);
  console.log(`| ${esc(x.id)} | ${f3(x.coverage)} | ${b} | ${f3(x.darkDisc)} | ${x.verts} | ${x.ms} | ${kind[c.partner] || c.partner}${x.id === '*x' ? ' (thin strip)' : ''} | ${f2(i.lambda)} | ${f2(i.channel)} | ${f2(c.head)} |`);
}
