// lab/exact.mjs — is the pattern's symmetry group EXACTLY the group? Every isometry of a large family of suspects
// (translations by sixths, quarters and fifths of the lattice; rotations by multiples of 30 and 45 degrees and
// reflections in lines every 15 degrees, about a grid of points of the cell and the group's own special points) that
// is NOT in the group must change the tone somewhere. Also: every element of the group keeps it (a sample).
//   node dev/patterns/designs/paisley/lab/exact.mjs
import { GROUPS, contains, elementsNear, symmetryElements } from '../../../../../src/groups.js';
import { normalize, toneAt } from '../../../kit.js';
import { find } from '../design.js';
let seed = 7;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
let worst = 0, total = 0, broken = 0;
for (const G of GROUPS) {
  const N = normalize(find(G).shapes), u = Math.sqrt(G.domainArea);
  const pts = [];
  for (let i = 0; i < 160; i++) { const s = rnd(), t = rnd(); pts.push([G.center[0] + (s - 0.5) * G.e1[0] + (t - 0.5) * G.e2[0], G.center[1] + (s - 0.5) * G.e1[1] + (t - 0.5) * G.e2[1]]); }
  const tones = pts.map((p) => toneAt(G, N, p[0], p[1]));
  // the group keeps the tone
  for (const g of elementsNear(G, G.center[0], G.center[1], 3 * u)) for (let i = 0; i < 12; i++) { const p = pts[i]; if (toneAt(G, N, g.a * p[0] + g.b * p[1] + g.tx, g.c * p[0] + g.d * p[1] + g.ty) !== tones[i]) broken++; }
  // suspects
  const base = Math.atan2(G.e1[1], G.e1[0]), special = [];
  for (const d of [2, 3, 4, 6]) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) special.push([G.center[0] + ((i / d) - 0.5) * G.e1[0] + ((j / d) - 0.5) * G.e2[0], G.center[1] + ((i / d) - 0.5) * G.e1[1] + ((j / d) - 0.5) * G.e2[1]]);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) special.push([(i / 6) * G.e1[0] + (j / 6) * G.e2[0], (i / 6) * G.e1[1] + (j / 6) * G.e2[1]]);
  const sym = symmetryElements(G, G.center[0], G.center[1], 1.2 * Math.max(Math.hypot(...G.e1), Math.hypot(...G.e2)));
  for (const c of sym.centers) special.push([c.x, c.y]);
  for (const m of sym.mirrors.concat(sym.glides)) special.push([m.px, m.py]);
  const suspects = [];
  for (const d of [2, 3, 4, 5, 6]) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) if (i || j) suspects.push({ a: 1, b: 0, c: 0, d: 1, tx: (i / d) * G.e1[0] + (j / d) * G.e2[0], ty: (i / d) * G.e1[1] + (j / d) * G.e2[1] });
  for (const P of special) {
    for (let k = 1; k < 24; k++) { const th = (k * Math.PI) / 12, a = Math.cos(th), c = Math.sin(th); if (k % 2 && k % 3) continue; suspects.push({ a, b: -c, c, d: a, tx: P[0] - a * P[0] + c * P[1], ty: P[1] - c * P[0] - a * P[1] }); }
    for (let k = 0; k < 12; k++) { const th = base + (k * Math.PI) / 12, ux = Math.cos(th), uy = Math.sin(th), a = 2 * ux * ux - 1, b = 2 * ux * uy, d = 2 * uy * uy - 1;
      for (const sl of [0, 0.5, 1 / 3, 0.25]) { const l1 = Math.hypot(...G.e1) * sl; suspects.push({ a, b, c: b, d, tx: P[0] - a * P[0] - b * P[1] + l1 * ux, ty: P[1] - b * P[0] - d * P[1] + l1 * uy }); } }
  }
  let extra = 0, tested = 0, hardest = 0;
  for (const h of suspects) {
    if (contains(G, h, 1e-6)) continue;
    tested++;
    let k = 0, differs = false;
    for (; k < pts.length; k++) { const p = pts[k]; if (toneAt(G, N, h.a * p[0] + h.b * p[1] + h.tx, h.c * p[0] + h.d * p[1] + h.ty) !== tones[k]) { differs = true; break; } }
    if (!differs) extra++;
    hardest = Math.max(hardest, k);
  }
  total += tested; worst = Math.max(worst, extra);
  console.log(G.id.padEnd(6), 'suspects not in the group', tested, ' that keep the pattern:', extra, ' (most points agreed before one differed:', hardest + ')');
}
console.log(`suspects ${total}; kept by a pattern (must be 0): ${worst}; tones broken by the group itself (must be 0): ${broken}`);
