// the numbers with presets and without, for a set of knobs: node lab/both.mjs '{"POOL":0.19}'
import { GROUPS } from '../../../../../src/groups.js';
import { normalize } from '../../../kit.js';
import { fastMeasure } from './raster.mjs';
import { find } from '../design.js';
const kn = process.argv[2] ? JSON.parse(process.argv[2]) : undefined;
const W = { dark: [1, 0], bare: 0, solid: 0 }, B = { dark: [1, 0], bare: 0, solid: 0 };
for (const g0 of GROUPS) {
  const bare = { id: g0.id, e1: g0.e1, e2: g0.e2, reps: g0.reps, cellArea: g0.cellArea, domainArea: g0.domainArea, center: g0.center };
  const a = fastMeasure(g0, normalize(find(g0, kn).shapes)), b = fastMeasure(bare, normalize(find(bare, kn).shapes));
  for (const [m, S] of [[a, W], [b, B]]) { S.dark = [Math.min(S.dark[0], m.coverage, m.exact), Math.max(S.dark[1], m.coverage, m.exact)]; S.bare = Math.max(S.bare, m.emptyDisc); S.solid = Math.max(S.solid, m.darkDisc); }
  console.log(g0.id.padEnd(6), 'presets: dark', a.coverage, 'area', a.exact, 'bare', a.emptyDisc, 'solid', a.darkDisc, ' | none: dark', b.coverage, 'area', b.exact, 'bare', b.emptyDisc, 'solid', b.darkDisc);
}
console.log('presets', JSON.stringify(W), ' none', JSON.stringify(B));
