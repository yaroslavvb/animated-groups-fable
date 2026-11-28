// clean.mjs: delete what `node shots.mjs` and the solver tools regenerate (scene and result JSON), keep the pictures.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
let n = 0, bytes = 0;
for (const f of fs.readdirSync(HERE)) {
  if (/^scene-.*\.json$/.test(f) || /\.result\.json$/.test(f) || /\.metrics\.json$/.test(f) || /^solver-.*\.scene\.json$/.test(f) || f === 'solver.before-sealcold.js') {
    const p = path.join(HERE, f); bytes += fs.statSync(p).size; fs.unlinkSync(p); n++;
  }
}
console.log(`removed ${n} files, ${(bytes / 1e6).toFixed(1)} MB`);
