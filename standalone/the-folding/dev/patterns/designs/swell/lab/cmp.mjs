// lab/cmp.mjs — kit.measure against the lab's scanline measure, for one group
import { BY_ID } from '../../../../../src/groups.js';
import { normalize, measure, windingAt } from '../../../kit.js';
import { find } from '../design.js';
const id = process.argv[2] || '2222', g = BY_ID[id], res = find(g), N = normalize(res.shapes);
const t0 = performance.now(), m = measure(g, N);
console.log(id, 'kit.measure', JSON.stringify(m), (performance.now() - t0).toFixed(0) + 'ms', 'info.coverage', res.info.coverage);
let area = 0; for (const P of N.polys) area += (P.hole ? -1 : 1) * P.area;
console.log('polygon area / domainArea', (area / g.domainArea).toFixed(4), 'polys', N.polys.length, N.polys.map((P) => (P.hole ? 'hole ' : '') + P.area.toFixed(4)).join(', '));
