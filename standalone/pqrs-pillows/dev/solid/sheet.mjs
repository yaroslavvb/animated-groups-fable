// sheet.mjs out.png a.png b.png ...: pictures side by side (same height assumed), for one look at several states
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { PNG } = require(`${process.env.HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs`);
const [out, ...ins] = process.argv.slice(2);
const imgs = ins.map((f) => PNG.sync.read(fs.readFileSync(f)));
const H = Math.max(...imgs.map((i) => i.height)), W = imgs.reduce((s, i) => s + i.width, 0), o = new PNG({ width: W, height: H });
o.data.fill(255);
let x0 = 0;
for (const im of imgs) { for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) { const i = 4 * (y * im.width + x), j = 4 * (y * W + x0 + x); for (let c = 0; c < 4; c++) o.data[j + c] = im.data[i + c]; } x0 += im.width; }
fs.writeFileSync(out, PNG.sync.write(o));
