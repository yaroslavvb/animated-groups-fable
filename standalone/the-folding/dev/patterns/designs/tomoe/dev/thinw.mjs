import { GROUPS } from '../../../../../src/groups.js';
import { makeShapePrint, thinParts } from '../../../../../src/shapes.js';
import { find } from '../design.js';
const W = +(process.argv[2] || 0.03);
for (const g of GROUPS) { const s = Math.sqrt(g.domainArea), P = makeShapePrint(g, { key: 't', shapes: find(g).shapes }); const th = thinParts(P, W * s).filter((r) => r.length > 0.06 * s); console.log(g.id.padEnd(6), th.length ? th.slice(0, 4).map((r) => (r.dark ? 'dark' : 'light') + ' ' + (r.length / s).toFixed(3) + ' long, ' + (r.width / s).toFixed(4) + ' wide').join('; ') : 'none'); }
