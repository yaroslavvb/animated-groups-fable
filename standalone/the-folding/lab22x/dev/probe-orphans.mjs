// probe-orphans.mjs — does a sheet carry vertices no triangle uses? (they would widen the frame of the views)
import { CUTS, MOTIONS, buildSheet } from '../src/motions.js';
import { piecesGeometry } from '../src/looks.js';
for (const c of CUTS) for (const m of MOTIONS) {
  const S = buildSheet(c.index, m.key), used = new Uint8Array(S.n);
  for (const i of S.tri) used[i] = 1;
  let orphans = 0; for (let i = 0; i < S.n; i++) if (!used[i]) orphans++;
  // vertices used by triangles of more than one tag
  const tags = new Map();
  for (let t = 0; t < S.tri.length / 3; t++) for (let e = 0; e < 3; e++) { const v = S.tri[3 * t + e]; if (!tags.has(v)) tags.set(v, new Set()); tags.get(v).add(S.triTag[t]); }
  let multi = 0, mismatch = 0;
  for (const [v, s] of tags) { if (s.size > 1) multi++; if (!s.has(S.tag[v])) mismatch++; }
  console.log(c.name, m.key, 'n', S.n, 'orphans', orphans, 'multi-tag vertices', multi, 'vertex tag not among its triangles', mismatch, 'pieces n', piecesGeometry(S).n, 'tags', S.tags.length);
}
