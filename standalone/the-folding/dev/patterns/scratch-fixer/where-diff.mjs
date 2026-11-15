// where-diff.mjs (fixer) — where two sheets of dev/recut/sheet.mjs differ: per pixel, its cell and its place in the cell.
//   node dev/patterns/scratch-fixer/where-diff.mjs a.png b.png
import { readPNG } from './pngdiff.mjs';
const [fa, fb] = process.argv.slice(2), A = readPNG(fa), B = readPNG(fb);
const ids = 'o,2222,**,xx,*x,333,22x,22*,*2222,2*22,442,632,3*3,*333,4*2,*442,*632'.split(',');
for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
  const i = 4 * (y * A.w + x), m = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
  if (!m) continue;
  const cx = Math.floor((x - 10) / 388), cy = Math.floor((y - 10) / 261), u = (x - 10) - 388 * cx, v = (y - 10) - 261 * cy;
  console.log(`${ids[cy * 3 + cx] || '?'} at (${u}, ${v}) of its cell: ${u < 190 ? 'left half (plane)' : 'right half (fold)'}, diff ${m}`);
}
