// lab/join.mjs — several { id: stroke } files into one (later files win): node lab/join.mjs out.json a.json b.json ...
import fs from 'node:fs';
const [dst, ...src] = process.argv.slice(2), out = {};
for (const f of src) for (const [id, st] of Object.entries(JSON.parse(fs.readFileSync(f, 'utf8')))) out[id] = st.stroke || st;
fs.writeFileSync(dst, JSON.stringify(out, null, 1));
console.log(`${Object.keys(out).length} strokes in ${dst}`);
