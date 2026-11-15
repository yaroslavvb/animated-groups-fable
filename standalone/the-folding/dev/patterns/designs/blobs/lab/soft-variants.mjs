// lab/soft-variants.mjs — one stroke at several softnesses, as a variants file for view.mjs.
import fs from 'node:fs';
const [src, id, dst] = process.argv.slice(2);
const all = JSON.parse(fs.readFileSync(src, 'utf8')), st = all[id].stroke || all[id];
const out = [0.35, 0.45, 0.55, 0.7, 0.85, 1.0].map((soft) => ({ id, label: `${id} soft ${soft}`, stroke: { ...st, soft } }));
fs.writeFileSync(dst, JSON.stringify(out));
