// dev/kitm.mjs — the kit's own measure (the numbers the sheet prints) of variants, in node:  node kitm.mjs <id> [per]
import { BY_ID } from './lib.mjs';
import { hook, jhook } from './seeds.mjs';
import { VARIANTS } from './variants.mjs';
import { motifOf } from '../design.js';
import { normalize, measure } from '../../../kit.js';
const id = process.argv[2], per = +process.argv[3] || 56, g = BY_ID[id];
for (const [name, sp] of VARIANTS[id](hook, jhook)) {
  const t0 = performance.now(), mo = motifOf(g, sp), N = normalize(mo.shapes), m = measure(g, N, { per });
  let area = 0; for (const P of N.polys) area += P.hole ? -P.area : P.area;
  console.log(name.padEnd(34), `dark ${m.coverage} bare ${m.emptyDisc} solid ${m.darkDisc} overlap ${m.overlap} verts ${m.verts} | area/tile ${(area / g.domainArea).toFixed(3)} ${mo.plain ? 'PLAIN' : ''} ${Math.round(performance.now() - t0)} ms`);
}
