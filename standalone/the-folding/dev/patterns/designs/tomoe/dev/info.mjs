import { GROUPS } from '../../../../../src/groups.js';
import { find } from '../design.js';
for (const g of GROUPS) { const r = find(g); const s = Math.sqrt(g.domainArea); console.log(g.id.padEnd(6), 'rB', r.info.rB.toFixed(3), 'rA', r.info.rA.toFixed(3), 'box', JSON.stringify(r.info.box)); }
