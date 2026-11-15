// which corners of which groups get bands or a swollen ring: node lab/corners.mjs [bare]
import { GROUPS } from '../../../../../src/groups.js';
import { find } from '../design.js';
const bare = process.argv[2] === 'bare';
for (const g0 of GROUPS) {
  const g = bare ? { id: g0.id, e1: g0.e1, e2: g0.e2, reps: g0.reps, cellArea: g0.cellArea, domainArea: g0.domainArea, center: g0.center } : g0;
  const i = find(g).info;
  console.log(g.id.padEnd(6), String(i.seat).padEnd(9), 'r', i.r, 'sig', i.sigma, 'A', i.stretch, 'moat', i.moat, '|', i.corners.filter((c) => c.beyond > 0.1).map((c) => `${c.depth}(+${c.beyond})${c.bands ? ':' + c.bands + 'b' : c.beyond > 0.19 ? ':swell' : ''}`).join(' '));
}
