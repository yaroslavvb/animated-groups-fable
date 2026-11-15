// polish/halfstep.mjs — does the *x print read at half its period? The share of the dark that stays dark under
// isometries that are NOT in the group: the translation by half the glide step, and that translation composed with the
// flip across the glide axis (what would make two commas per tile near-copies of each other). Chance is about the dark
// share (0.5); 1 is an exact symmetry. judge-math measured 0.888 for the old *x (two near-copies per tile).
//   node polish/halfstep.mjs [--design path]
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, toneAt } from '../../../kit.js';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const D = await import(opt.design ? new URL(opt.design, `file://${process.cwd()}/`).href : '../design.js');
const g = BY_ID['*x'], N = normalize(D.find(g).shapes);
const T = g.e1[0], w = g.e2[1];                              // glide step T (along x), strip width w (mirrors y = k w)
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const maps = {
  'half step (x + T/2)': (x, y) => [x + T / 2, y],
  'half step, flipped (x + T/2, w - y)': (x, y) => [x + T / 2, w - y],
  'quarter step (x + T/4)': (x, y) => [x + T / 4, y],
};
const pts = [];
for (let k = 0; k < 4000; k++) { const x = rnd() * 2 * T, y = rnd() * 2 * w; if (toneAt(g, N, x, y)) pts.push([x, y]); }
for (const [name, f] of Object.entries(maps)) {
  let keep = 0;
  for (const [x, y] of pts) { const [u, v] = f(x, y); keep += toneAt(g, N, u, v); }
  console.log(`${name.padEnd(36)} dark kept ${(keep / pts.length).toFixed(3)}`);
}
