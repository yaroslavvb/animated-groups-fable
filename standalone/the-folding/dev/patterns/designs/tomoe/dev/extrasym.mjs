// node dev/extrasym.mjs — does any isometry OUTSIDE the group keep the print? (criterion a: the pattern's symmetry
// group is exactly the group). Candidates: translations by half lattice vectors, half-turns and 3-, 4-, 6-fold turns
// about the tile's vertices, edge midpoints and centroid, mirrors through those points at 12 directions. A candidate
// that is IN the group is skipped; one that keeps the tone at all 400 sample points is reported.
import { GROUPS, contains } from '../../../../../src/groups.js';
import { normalize, toneAt, tileOf } from '../../../kit.js';
import { find } from '../design.js';

let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const g of GROUPS) {
  const N = normalize(find(g).shapes), t = tileOf(g), P = t.poly, n = P.length, s = Math.sqrt(g.domainArea);
  const pts = [...P];
  for (let i = 0; i < n; i++) pts.push([(P[i][0] + P[(i + 1) % n][0]) / 2, (P[i][1] + P[(i + 1) % n][1]) / 2]);
  pts.push([P.reduce((a, p) => a + p[0], 0) / n, P.reduce((a, p) => a + p[1], 0) / n]);
  const cands = [];
  for (const [a, b] of [[0.5, 0], [0, 0.5], [0.5, 0.5]]) cands.push({ a: 1, b: 0, c: 0, d: 1, tx: a * g.e1[0] + b * g.e2[0], ty: a * g.e1[1] + b * g.e2[1], what: `translate ${a}e1+${b}e2` });
  for (const p of pts) {
    for (const k of [2, 3, 4, 6]) { const f = (2 * Math.PI) / k, co = Math.cos(f), si = Math.sin(f); cands.push({ a: co, b: -si, c: si, d: co, tx: p[0] - co * p[0] + si * p[1], ty: p[1] - si * p[0] - co * p[1], what: `turn 1/${k} about (${p[0].toFixed(2)},${p[1].toFixed(2)})` }); }
    for (let j = 0; j < 12; j++) { const f = (j * Math.PI) / 12, co = Math.cos(2 * f), si = Math.sin(2 * f); cands.push({ a: co, b: si, c: si, d: -co, tx: p[0] - co * p[0] - si * p[1], ty: p[1] - si * p[0] + co * p[1], what: `mirror ${(j * 15)} deg through (${p[0].toFixed(2)},${p[1].toFixed(2)})` }); }
  }
  const S = []; for (let k = 0; k < 400; k++) S.push([g.center[0] + (2 * rnd() - 1) * 1.5 * s, g.center[1] + (2 * rnd() - 1) * 1.5 * s]);
  const tone0 = S.map(([x, y]) => toneAt(g, N, x, y));
  const extra = [];
  let inG = 0, inGkept = 0;
  for (const T of cands) {
    if (contains(g, T, 1e-6)) {          // the sieve's own check: an element of the group must keep the tone
      inG++; let ok = true;
      for (let k = 0; k < S.length && ok; k++) { const [x, y] = S[k]; ok = toneAt(g, N, T.a * x + T.b * y + T.tx, T.c * x + T.d * y + T.ty) === tone0[k]; }
      if (ok) inGkept++;
      continue;
    }
    let same = true;
    for (let k = 0; k < S.length && same; k++) { const [x, y] = S[k]; same = toneAt(g, N, T.a * x + T.b * y + T.tx, T.c * x + T.d * y + T.ty) === tone0[k]; }
    if (same) extra.push(T.what);
  }
  const dk = tone0.reduce((a, b) => a + b, 0);
  console.log(`${g.id.padEnd(6)} ${cands.length} candidates, ${inG} in the group (${inGkept} keep the tone); samples dark ${dk}/400; extra symmetries: ${extra.length ? extra.slice(0, 3).join('; ') : 'none'}`);
}
