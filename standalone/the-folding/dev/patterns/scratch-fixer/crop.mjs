// crop.mjs (fixer) — a crop of one or more PNGs, side by side, each magnified (nearest neighbour): to look at edges.
//   node dev/patterns/scratch-fixer/crop.mjs --out x.png --x 100 --y 80 --w 60 --h 40 --k 8 a.png b.png [c.png]
import { readPNG, writePNG } from './pngdiff.mjs';
const args = process.argv.slice(2), opt = {}, files = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else files.push(args[i]); }
const x0 = +opt.x, y0 = +opt.y, w = +opt.w, h = +opt.h, k = +opt.k || 8, gap = 6;
const W = files.length * w * k + (files.length - 1) * gap, H = h * k, out = new Uint8Array(W * H * 4).fill(255);
files.forEach((f, n) => {
  const P = readPNG(f);
  for (let y = 0; y < H; y++) for (let x = 0; x < w * k; x++) {
    const sx = x0 + Math.floor(x / k), sy = y0 + Math.floor(y / k), si = 4 * (sy * P.w + sx), di = 4 * (y * W + n * (w * k + gap) + x);
    for (let c = 0; c < 4; c++) out[di + c] = P.data[si + c];
  }
});
writePNG(opt.out, W, H, out);
console.log('WROTE ' + opt.out);
