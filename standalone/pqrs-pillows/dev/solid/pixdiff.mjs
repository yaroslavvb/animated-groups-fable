// pixdiff.mjs a.png b.png [x0 y0 x1 y1]: how many pixels differ at all, and by how much at most (pngjs of the Codex runtime)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { PNG } = require(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs`);
const [fa, fb, ...box] = process.argv.slice(2);
const a = PNG.sync.read(fs.readFileSync(fa)), b = PNG.sync.read(fs.readFileSync(fb));
if (a.width !== b.width || a.height !== b.height) { console.log(`sizes differ: ${a.width}x${a.height} vs ${b.width}x${b.height}`); process.exit(1); }
const [x0, y0, x1, y1] = box.length === 4 ? box.map(Number) : [0, 0, a.width, a.height];
let n = 0, worst = 0, over8 = 0, sum = 0, tot = 0;
for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
  const i = 4 * (y * a.width + x); tot++;
  const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
  if (d) { n++; sum += d; if (d > worst) worst = d; if (d > 8) over8++; }
}
console.log(`${fa.split('/').pop()} vs ${fb.split('/').pop()}: ${n} of ${tot} pixels differ (${(100 * n / tot).toFixed(4)} %), ${over8} by more than 8, worst ${worst}, mean of the differing ${(n ? sum / n : 0).toFixed(2)}`);
