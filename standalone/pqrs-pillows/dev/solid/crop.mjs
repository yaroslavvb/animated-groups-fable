// crop.mjs in.png out.png x y w h [scale]: a crop, enlarged by an integer factor
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { PNG } = require(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs`);
const [fi, fo, x0, y0, w, h, sc = 1] = process.argv.slice(2).map((v, i) => (i < 2 ? v : Number(v)));
const a = PNG.sync.read(fs.readFileSync(fi)), o = new PNG({ width: w * sc, height: h * sc });
for (let y = 0; y < h * sc; y++) for (let x = 0; x < w * sc; x++) {
  const i = 4 * ((y0 + Math.floor(y / sc)) * a.width + x0 + Math.floor(x / sc)), j = 4 * (y * w * sc + x);
  for (let c = 0; c < 4; c++) o.data[j + c] = a.data[i + c];
}
fs.writeFileSync(fo, PNG.sync.write(o));
