// dev/tiles.mjs — print the default tile of every group: vertices (world), side lengths (tile sizes), the kind of each side.
import { GROUPS, classify, symmetryElements } from '../../../../../src/groups.js';
import { tileOf } from '../../../kit.js';
for (const g of GROUPS) {
  const t = tileOf(g), size = Math.sqrt(g.domainArea), P = t.poly, n = P.length;
  const E = t.domain.edges;
  console.log(`${g.id.padEnd(6)} size ${size.toFixed(4)} seed ${t.seed.map((v) => v.toFixed(3))} viewHalf ${g.viewHalf}`);
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], e = E[i], k = classify(e.g);
    const what = e.kind === 'mirror' ? 'MIRROR' : (k.type + (k.type === 'rotation' ? ' ' + k.order + ' @' + k.center.map((v) => v.toFixed(3)) : '') + ' ->' + e.partner);
    console.log(`   ${i}: (${a[0].toFixed(4)}, ${a[1].toFixed(4)}) -> len ${(Math.hypot(b[0] - a[0], b[1] - a[1]) / size).toFixed(3)}  ${what}`);
  }
}
