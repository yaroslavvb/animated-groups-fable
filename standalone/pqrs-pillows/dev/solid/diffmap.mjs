// diffmap.mjs a.png b.png [out.png]: where two pictures differ: a coarse map on the terminal, and (out) a picture of the differences
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { PNG } = require(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs`);
const [fa, fb, out] = process.argv.slice(2);
const a = PNG.sync.read(fs.readFileSync(fa)), b = PNG.sync.read(fs.readFileSync(fb));
const W = a.width, H = a.height, cols = 56, rows = 28, grid = new Int32Array(cols * rows), o = new PNG({ width: W, height: H });
let n = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = 4 * (y * W + x), d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
  const g = d > 8;
  if (g) { n++; grid[Math.floor((y * rows) / H) * cols + Math.floor((x * cols) / W)]++; }
  o.data[i] = g ? 255 : (a.data[i] + 510) / 3; o.data[i + 1] = g ? 0 : (a.data[i + 1] + 510) / 3; o.data[i + 2] = g ? 0 : (a.data[i + 2] + 510) / 3; o.data[i + 3] = 255;
}
console.log(`${n} pixels differ by more than 8 (${(100 * n / (W * H)).toFixed(3)} %)`);
for (let r = 0; r < rows; r++) console.log([...grid.subarray(r * cols, (r + 1) * cols)].map((v) => (v === 0 ? '.' : v < 20 ? '+' : '#')).join(''));
if (out) fs.writeFileSync(out, PNG.sync.write(o));
