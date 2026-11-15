// dev/patterns/designs/bigcomma/shapes.mjs — a gallery of unit commas: rows = ab (degrees), columns = lam, for one tau.
//   node dev/patterns/designs/bigcomma/shapes.mjs --out <png> [--tau 16] [--abs 90,75,60,45,32] [--lams 2.4,3,4,5.5,8]
import { unitComma, sampleComma } from './design.js';
import { canvas, fill, writePng } from './png.mjs';

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
const DEG = Math.PI / 180;
const taus = (opt.tau || '16').split(',').map(Number);
const abs = (opt.abs || '90,75,60,45,32').split(',').map(Number);
const lams = (opt.lams || '2.4,3,4,5.5,8').split(',').map(Number);
const cell = 230, cv = canvas(lams.length * cell, abs.length * taus.length * cell);
let r = 0;
for (const tau of taus) for (const ab of abs) {
  lams.forEach((lam, c) => {
    const u = unitComma(lam, ab * DEG, tau * DEG);
    if (!u) return;
    const pts = sampleComma(u, 0.03);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const s = (cell - 24) / Math.max(x1 - x0, y1 - y0), ox = c * cell + cell / 2 - (s * (x0 + x1)) / 2, oy = r * cell + cell / 2 + (s * (y0 + y1)) / 2;
    const eye = []; for (let i = 0; i < 40; i++) eye.push([ox + s * 0.36 * Math.cos((i * Math.PI) / 20), oy - s * 0.36 * Math.sin((i * Math.PI) / 20)]);
    fill(cv, [pts.map((p) => [ox + s * p[0], oy - s * p[1]]), eye], [79, 163, 151]);
  });
  r++;
}
writePng(cv, opt.out);
console.log('rows (tau, ab):', taus.flatMap((t) => abs.map((a) => `${t}/${a}`)).join('  '), '| cols lam:', lams.join(' '));
