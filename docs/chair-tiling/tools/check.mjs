// Re-runs the two checks the page depends on, against the page's own geometry.
//
//   node docs/chair-tiling/tools/check.mjs
//
// (a) at every level the 8^n chairs partition the supertile 2^n * C exactly;
// (b) every facet shared by two of them satisfies the matching rule:
//     the two marks point at the same corner and their types are complementary
//     (purple-filled with purple-hollow, blue with blue).
// These are the same statements as verify.py steps (a) and (c); running them
// here proves the JavaScript port agrees with the verified python model.
import {COMPLEMENT, FACETS, SYMBOLS} from '../marking.data.mjs';
import {INSTANCE_FLOATS, buildChairMesh, buildPatch, placementCells, placementFacets} from '../tiling.mjs';

let failures = 0;
const check = (ok, what) => { if (!ok) { failures++; console.log(`FAIL  ${what}`); } else console.log(`ok    ${what}`); };

// The eight marks meeting at a site must be one of each symbol, three per site.
const sites = new Map();
for (const f of FACETS) {
  const key = `${f[6]},${f[7]},${f[8]}`;
  if (!sites.has(key)) sites.set(key, []);
  sites.get(key).push(SYMBOLS[f[9]]);
}
check(sites.size === 8, `8 sites (got ${sites.size})`);
check([...sites.values()].every(s => s.length === 3 && new Set(s).size === 3),
  'each site carries one purple-filled, one purple-hollow and one blue mark');

const mesh = buildChairMesh();
check(mesh.vertexCount === 96 && mesh.indices.length === 144, `mesh: 24 quads (${mesh.vertexCount} vertices, ${mesh.indices.length} indices)`);
// Every quad must be a unit square whose winding agrees with its outward normal.
let wound = true;
for (let q = 0; q < 24; q++) {
  const p = i => mesh.positions.subarray((q * 4 + i) * 3, (q * 4 + i) * 3 + 3);
  const [a, b, c] = [p(0), p(1), p(2)];
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const n = mesh.normals.subarray(q * 4 * 3, q * 4 * 3 + 3);
  if (cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] <= 0) { wound = false; console.log(`      quad ${q} is wound the wrong way`); }
}
check(wound, 'all 24 quads wound counter-clockwise as seen from outside');

for (let level = 1; level <= 3; level++) {
  const patch = buildPatch(level);
  check(patch.count === 8 ** level, `level ${level}: ${patch.count} chairs`);

  // (a) the cells partition the supertile.
  const owner = new Map();
  let overlap = 0;
  for (let i = 0; i < patch.count; i++) {
    const o = i * INSTANCE_FLOATS;
    const m = [...patch.data.subarray(o, o + 9)], t = [...patch.data.subarray(o + 9, o + 12)];
    for (const cell of placementCells(m, t)) {
      const key = cell.join(',');
      if (owner.has(key)) overlap++;
      owner.set(key, i);
    }
  }
  const side = 2 ** (level + 1), notch = side / 2;
  let expected = 0;
  for (let x = 0; x < side; x++) for (let y = 0; y < side; y++) for (let z = 0; z < side; z++) {
    if (x >= notch && y >= notch && z >= notch) continue;
    expected++;
    if (!owner.has(`${x},${y},${z}`)) { failures++; console.log(`FAIL  level ${level}: cell ${x},${y},${z} uncovered`); }
  }
  check(overlap === 0 && owner.size === expected, `level ${level}: ${owner.size} cells, exact partition of 2^${level}C (no overlaps)`);

  // (b) the matching rule on every shared facet.
  const seen = new Map();
  let contacts = 0, violations = 0;
  for (let i = 0; i < patch.count; i++) {
    const o = i * INSTANCE_FLOATS;
    const m = [...patch.data.subarray(o, o + 9)], t = [...patch.data.subarray(o + 9, o + 12)];
    for (const [key, mark] of placementFacets(m, t)) {
      const [cell, n] = key.split('|');
      const other = cell.split(',').map((v, k) => Number(v) + Number(n.split(',')[k])).join(',');
      const back = `${other}|${n.split(',').map(v => -Number(v)).join(',')}`;
      const partner = seen.get(back);
      if (partner) {
        contacts++;
        if (partner.site !== mark.site || COMPLEMENT[SYMBOLS[partner.symbol]] !== SYMBOLS[mark.symbol]) violations++;
      }
      seen.set(key, mark);
    }
  }
  check(violations === 0, `level ${level}: ${contacts} shared facets, ${violations} violations of the matching rule`);
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
