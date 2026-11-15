// lab/mkvar.mjs — a variants file for view.mjs from RESULT lines of search.mjs: node lab/mkvar.mjs out.json label=file label=file ...
import fs from 'node:fs';
const [dst, ...pairs] = process.argv.slice(2), out = [];
for (const pr of pairs) {
  const [label, file] = pr.split('=');
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) if (line.startsWith('RESULT ')) { const r = JSON.parse(line.slice(7)); out.push({ id: r.id, label: `${r.id} ${label}`, stroke: r.stroke }); }
}
fs.writeFileSync(dst, JSON.stringify(out));
