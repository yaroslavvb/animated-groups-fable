// polish/peak-vs-solid.mjs — where would an eye go: the peak of u in the home blob (what find() knows already) against
// the centre of the blob's largest inscribed disc (polish/an2.mjs solidAt), per group: the distance between them, in
// tile sizes, and the inscribed disc's radius.
import { GROUPS } from '../../../../../src/groups.js';
import { STROKES, solve } from '../design.js';
import { analyse2 } from './an2.mjs';

for (const g of GROUPS) {
  const st = STROKES[g.id], S = solve(g, st, { h: 0.012 }), { fld, L } = S, { N1, a1x, a1y, a2x, a2y, det } = fld;
  const m = analyse2(g, st, { h: 0.012 });
  // the peak of the comp that holds the solid point (any copy of it)
  const [sx, sy] = m.solidAt, F = S.F;
  const I = Math.round((N1 * (sx * F.E2[1] - sy * F.E2[0])) / det), J = Math.round((fld.N2 * (F.E1[0] * sy - F.E1[1] * sx)) / det);
  const p = (((J % fld.N2) + fld.N2) % fld.N2) * N1 + (((I % N1) + N1) % N1);
  if (L.par[p] < 0) { console.log(g.id, 'solid point not dark'); continue; }
  const comp = L.byRoot.get(L.find(p)), pk = comp.peak, pi = pk % N1, pj = (pk - pi) / N1;
  // the peak's copy nearest the solid point: compare in the unwrapped coordinates of the union-find
  const ux = (pi + L.dx[pk] - L.dx[p] - pi) , uy = 0;
  const dI = (L.dx[pk] - L.dx[p]), dJ = (L.dy[pk] - L.dy[p]);
  const qx = (I + dI) * a1x + (J + dJ) * a2x, qy = (I + dI) * a1y + (J + dJ) * a2y;
  console.log(`${g.id.padEnd(6)} peak-to-solid ${Math.hypot(qx - sx, qy - sy).toFixed(3)}  solid r ${(m.solid / 2).toFixed(3)}  (${ux + uy})`);
}
