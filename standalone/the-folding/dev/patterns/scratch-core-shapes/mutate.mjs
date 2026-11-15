// scratch (core-shapes): do the tests of test/shapes.test.js notice a fault planted in src/shapes.js? Runs INSIDE a throwaway
// copy of the workspace on the mini (mutate.sh makes it): each fault is written into the copy's src/shapes.js, the test
// file is run, the file is put back. Never run this in the workspace itself.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!process.cwd().includes('the-folding-suite')) { console.error('mutate.mjs runs in a throwaway copy only'); process.exit(2); }
const file = 'src/shapes.js', orig = fs.readFileSync(file, 'utf8');
const MUT = [
  ['tone: W != 0 instead of W > 0', 'tone: (x, y) => (winding(x, y) > 0 ? 1 : 0)', 'tone: (x, y) => (winding(x, y) !== 0 ? 1 : 0)'],
  ['a hole counts +1', 'sign: polys[i].hole ? -1 : 1', 'sign: 1'],
  ['only the lattice translate at the origin is looked at', 'const noff = 2 * tl.length,', 'const noff = 2,'],
  ['the reduced point one lattice vector off its cell', 'const qx = fs * ux + ft * vx, qy = fs * uy + ft * vy;\n      for (let o = 0; o < noff; o += 2) {', 'const qx = fs * ux + ft * vx + ux, qy = fs * uy + ft * vy + uy;\n      for (let o = 0; o < noff; o += 2) {'],
  ['the bounding circle of the tone a fifth too small (in area)', 'const R2 = R * R * (1 + 1e-9);', 'const R2 = 0.8 * R * R;'],
  ['the slab below the right one', 'if (sl >= P.S) sl = P.S - 1;', 'sl = sl > 0 ? sl - 1 : 0;'],
  ['fillShapes: a mirrored copy is not walked backwards', 'const i = flip ? n - 1 - k : k, x = p[2 * i], y = p[2 * i + 1];', 'const i = k, x = p[2 * i], y = p[2 * i + 1];'],
  ['copiesIn: a mirrored copy is not listed backwards', 'const i = flip ? n - 1 - k : k, x = g.a * p[2 * i]', 'const i = k, x = g.a * p[2 * i]'],
  ['margin: the search stops a cell too early', 'if (mlen[o] - rho - R >= best) break;', 'if (mlen[o] - R >= best) break;'],
  ['margin: a copy is ruled out by its centre alone', "const px = qx - moff[2 * o], py = qy - moff[2 * o + 1], lim = best + R;", "const px = qx - moff[2 * o], py = qy - moff[2 * o + 1], lim = best;"],
  ['shapeElements: half the bounding circle', 'R2 = (R * (1 + 1e-9) + pad) ** 2;', 'R2 = (0.5 * R) ** 2;'],
  ['shapeElements: the first lattice row is left out', 'out[0] = Math.ceil(Math.min(a0, a1) + Math.min(b0, b1) - 1e-9);', 'out[0] = Math.ceil(Math.min(a0, a1) + Math.min(b0, b1) - 1e-9) + 1;'],
  ['polygons are not turned the right way round', 'const back = (A < 0) !== hole;', 'const back = false;'],
  ['no two copies ever coincide', 'if (coincides(g)) { res.stabilizer++; continue; }', 'if (g === null) { res.stabilizer++; continue; }'],
  ['a copy inside another is not looked for', 'if (d > touch && g.dist <= 2 * R && !inside) {', 'if (d < 0) {'],
  ['the gap rule at half its distance', 'else if (min < gapW - touch) problems.push(', 'else if (min < 0.5 * gapW) problems.push('],
  ['the last edge and the first are taken for strangers', 'if (i === 0 && j === n - 1) continue;', ''],
  ['a hole need not lie in a polygon', "if (P.hole && w < 1) {", "if (P.hole && w < -5) {"],
  ['coverage sampled over four fifths of a cell', 'const s = (i + 0.5) / ns, t = (j + 0.5) / nt, W = print.winding(', 'const s = (0.8 * (i + 0.5)) / ns, t = (j + 0.5) / nt, W = print.winding('],
  ['the distance transform adds lengths, not squares', 'd[q] = (q - p) * (q - p) + f[p]; }', 'd[q] = Math.abs(q - p) + f[p]; }'],
  ['coverageExact given although copies overlap', 'coverageExact: E.disjoint ? print.netArea', 'coverageExact: true ? print.netArea'],
  ['the bounding circle is the box\'s, not the smallest', 'return R <= Rb ? [cx, cy, R] : [bx, by, Rb];', 'return [bx, by, Rb];'],
  ['overlap counts every W above 1', 'if (W > stab) over++;', 'if (W > 1) over++;'],
  ['the pair search gives up on chunks too early', 'if (da >= best2) break;', 'if (da >= 0.25 * best2) break;'],
  ['the motif itself is taken for another copy', "continue;   // the motif itself", "{}   // the motif itself"],
  ['a point that repeats the one before it is kept', 'if (n && Math.hypot(x - flat[2 * n - 2], y - flat[2 * n - 1]) < same) continue;', ''],
  ['the window of the two discs is half a tile', 'const half = Math.min(1.1 * L + 1.2 * size, 3.4 * size), pad = 1.3 * size;', 'const half = 0.5 * size, pad = 1.3 * size;'],
  ['2400 vertices are too many already', 'if (verts > MAX_VERTS) problems.push(', 'if (verts >= MAX_VERTS) problems.push('],
  ['a polygon may lie in another', "if (!P.hole && w !== 0) {", "if (!P.hole && w > 5) {"],
  ['the polygons of a motif may cross', "+ Number.MIN_VALUE, hit) <= touch2) {", "+ Number.MIN_VALUE, hit) < 0) {"],
  ['a polygon may cross itself', "X[j + 1], Y[j + 1]) > tol2) continue;", "X[j + 1], Y[j + 1]) >= 0) continue;"],
  ['a polygon without area passes', "problems.push(`polygon ${k} has no area`); res.disjoint = false; return; }", "return; }"],
  ['margin: the first copy only', 'for (let o = 0; o < nm; o++) {', 'for (let o = 0; o < 1; o++) {'],
  ['a point repeated at the end is kept', 'while (n > 1 && Math.hypot(flat[0] - flat[2 * n - 2], flat[1] - flat[2 * n - 1]) < same) n--;', ''],
];
let caught = 0, survived = 0, broken = 0;
for (const [name, from, to] of MUT) {
  const k = orig.split(from).length - 1;
  if (k !== 1) { console.log(`?? ${name}: the text to change occurs ${k} times`); broken++; continue; }
  fs.writeFileSync(file, orig.replace(from, to));
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'test/shapes.test.js'], { encoding: 'utf8', timeout: 180000 });
  const failed = (r.stdout.match(/^not ok \d+/gm) || []).map((s) => s.replace('not ok ', ''));
  if (failed.length || r.status !== 0) { caught++; console.log(`caught    ${name}  (tests ${failed.join(', ') || 'exit ' + r.status})`); }
  else { survived++; console.log(`SURVIVED  ${name}`); }
}
fs.writeFileSync(file, orig);
const base = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'test/shapes.test.js'], { encoding: 'utf8', timeout: 180000 });
console.log(`the file as it is: ${base.status === 0 ? 'all tests pass' : 'TESTS FAIL'}`);
console.log(`${caught} caught, ${survived} survived, ${broken} not applied, of ${MUT.length}`);
