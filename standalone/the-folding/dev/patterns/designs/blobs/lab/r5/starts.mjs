// lab/r5/starts.mjs — the START / RESULT lines of search.mjs runs as a variants file for view.mjs.
//   node lab/r5/starts.mjs out.json in1.txt [in2.txt ...]
import fs from 'node:fs';
const [dst, ...src] = process.argv.slice(2), V = [];
for (const f of src) {
  const tag = f.split('/').pop().replace(/\.txt$/, '');
  let k = 0;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = /^(START|RESULT) (.*)$/.exec(line);
    if (!m) continue;
    const r = JSON.parse(m[2]);
    V.push({ id: r.id, label: `${tag} ${m[1] === 'RESULT' ? 'best' : '#' + ++k}`, stroke: r.stroke });
  }
}
fs.writeFileSync(dst, JSON.stringify(V, null, 1));
console.log(`${V.length} variants -> ${dst}`);
