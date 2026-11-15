// scratch-core-sdf/bench.mjs — how long a bake takes on this machine. One short run:  node dev/patterns/scratch-core-sdf/bench.mjs
// The scene of the brief: about 6000 edges (64 blobs of 94 edges that fill 42 % of the unit cell), at 512 and at 1024,
// for ranges of 4 to 32 texels; then the page's own comma on the lattice cell of three groups, as the print module would bake it.
import os from 'node:os';
import { bakeSDF } from '../../../src/sdf.js';
import { BY_ID } from '../../../src/groups.js';
import { normalize } from '../kit.js';
import { find } from '../designs/demo/design.js';
import { blobs, cellOf, cellPolys, edgesOf } from './scene.mjs';

function time(spec, runs = 9, warm = 3) {
  for (let i = 0; i < warm; i++) bakeSDF(spec);
  const ms = [];
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); bakeSDF(spec); ms.push(performance.now() - t0); }
  ms.sort((a, b) => a - b);
  return { best: ms[0], median: ms[runs >> 1] };
}
const f = (x) => x.toFixed(1).padStart(6);

console.log(`node ${process.version}, ${os.cpus()[0].model}, load ${os.loadavg().map((x) => x.toFixed(1)).join(' ')}`);
const scene = blobs();
for (const size of [512, 1024]) {
  const t = time({ origin: [0, 0], e1: [1, 0], e2: [0, 1], size, range: 8 / size, polys: [] });
  console.log(`no polygons at all, size ${size} (the cost of the buffers and of the last pass): ${f(t.best)} best, ${f(t.median)} median`);
}
console.log(`\nblobs: ${edgesOf(scene)} edges in the unit cell`);
console.log('  size  range(texels)   best ms  median ms');
for (const size of [512, 1024]) {
  for (const r of [4, 8, 16, 32]) {
    const t = time({ origin: [0, 0], e1: [1, 0], e2: [0, 1], size, range: r / size, polys: scene });
    console.log(`  ${String(size).padStart(4)}  ${String(r).padStart(6)}        ${f(t.best)}    ${f(t.median)}`);
  }
}
// the same scene chopped four times finer (24064 edges): the cost follows the band, not the number of edges
const fine = scene.map((P) => {
  const n = P.pts.length / 2, pts = new Float64Array(8 * n);
  for (let k = 0; k < n; k++) for (let q = 0; q < 4; q++) {
    const j = (k + 1) % n, t = q / 4;
    pts[2 * (4 * k + q)] = P.pts[2 * k] + t * (P.pts[2 * j] - P.pts[2 * k]); pts[2 * (4 * k + q) + 1] = P.pts[2 * k + 1] + t * (P.pts[2 * j + 1] - P.pts[2 * k + 1]);
  }
  return { pts, hole: false };
});
{
  const t = time({ origin: [0, 0], e1: [1, 0], e2: [0, 1], size: 1024, range: 8 / 1024, polys: fine });
  console.log(`  1024       8        ${f(t.best)}    ${f(t.median)}   (every edge cut in four: ${edgesOf(fine)} edges)`);
}

console.log('\nthe comma of the page (designs/demo) on the lattice cell, range 0.03 tile sizes');
console.log('  group   edges  size   best ms  median ms');
for (const id of ['o', '22x', '4*2', '*632']) {
  const group = BY_ID[id], N = normalize(find(group).shapes), cell = cellOf(group), range = 0.03 * Math.sqrt(group.domainArea);
  const polys = cellPolys(group, N, cell, range);
  for (const size of [512, 1024]) {
    const t = time({ ...cell, size, range, polys }, 7, 2);
    console.log(`  ${id.padEnd(6)} ${String(edgesOf(polys)).padStart(6)}  ${String(size).padStart(4)}   ${f(t.best)}    ${f(t.median)}`);
  }
}
