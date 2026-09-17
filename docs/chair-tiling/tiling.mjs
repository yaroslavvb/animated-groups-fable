// The marked chair, its 24 facets and the eight-child substitution.
//
// Pure geometry and combinatorics: no WebGL, no DOM, so `tools/check.mjs` can
// re-run the matching rule over a whole patch in node. Every number here comes
// from `marking.data.mjs`, generated from the verified `verify/marking.json`.
import {CENTROID, CHAIR_CELLS, CHILDREN, FACETS} from './marking.data.mjs';

// Facet record layout in FACETS: cell x3, outward normal x3, site x3, symbol.
const CYCLIC = [[1, 2], [2, 0], [0, 1]];

// Column-major 3x3 multiply: c = a * b, both column-major.
export function mul3(a, b) {
  const c = new Array(9);
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      c[col * 3 + row] = a[row] * b[col * 3] + a[3 + row] * b[col * 3 + 1] + a[6 + row] * b[col * 3 + 2];
    }
  }
  return c;
}

export function apply3(m, v) {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ];
}

export const IDENTITY3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// One chair: 24 unit squares, each with a local (u, v) frame whose (1, 1)
// corner is the marked site. The arrow is drawn in that frame, along the
// diagonal from (0, 0) to (1, 1), so it always points at the site.
export function buildChairMesh() {
  const positions = [], normals = [], uvs = [], marks = [], indices = [];
  for (const f of FACETS) {
    const cell = [f[0], f[1], f[2]], normal = [f[3], f[4], f[5]], site = [f[6], f[7], f[8]], symbol = f[9];
    const axis = normal.findIndex(v => v !== 0);
    const sign = normal[axis];
    const [au, av] = CYCLIC[axis];
    const plane = cell[axis] + (sign > 0 ? 1 : 0);
    // The site's own (u, v) corner, as 0 or 1 offsets from the cell.
    const su = site[au] - cell[au], sv = site[av] - cell[av];
    // e_u x e_v = e_axis for this cyclic choice, so this order is
    // counter-clockwise seen from outside when the normal points along +axis.
    const order = sign > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
    const base = positions.length / 3;
    for (const [i, j] of order) {
      const p = [0, 0, 0];
      p[axis] = plane; p[au] = cell[au] + i; p[av] = cell[av] + j;
      positions.push(p[0], p[1], p[2]);
      normals.push(normal[0], normal[1], normal[2]);
      uvs.push(i === su ? 1 : 0, j === sv ? 1 : 0);
      marks.push(symbol);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    marks: new Float32Array(marks),
    indices: new Uint16Array(indices),
    vertexCount: positions.length / 3,
  };
}

// Instance layout, 17 floats: column 0, 1, 2 of the rotation, translation,
// accumulated explode offset, then (top-level slot, central-at-its-parent).
export const INSTANCE_FLOATS = 17;

// The level-n patch: the supertile 2^n * C cut into 8^n unit chairs.
// A placement (M, u) means the chair occupies M(C) + u.
export function buildPatch(level) {
  const count = 8 ** level;
  let cur = new Float32Array(INSTANCE_FLOATS * count);
  let next = count > 1 ? new Float32Array(INSTANCE_FLOATS * count) : cur;
  cur.set([...IDENTITY3, 0, 0, 0, 0, 0, 0, 0, 0]);
  let live = 1;

  for (let k = level; k >= 1; k--) {
    const half = 2 ** (k - 1);
    let out = 0;
    for (let p = 0; p < live; p++) {
      const o = p * INSTANCE_FLOATS;
      const M = [cur[o], cur[o + 1], cur[o + 2], cur[o + 3], cur[o + 4], cur[o + 5], cur[o + 6], cur[o + 7], cur[o + 8]];
      const u = [cur[o + 9], cur[o + 10], cur[o + 11]];
      const ex = [cur[o + 12], cur[o + 13], cur[o + 14]];
      const topSlot = cur[o + 15];
      // Centroid of the parent chair, which occupies M(2^k C) + u.
      const pc = apply3(M, CENTROID.map(g => g * 2 * half));
      for (let i = 0; i < 8; i++) {
        const ch = CHILDREN[i];
        const L = ch.slice(0, 9);
        const cm = mul3(M, L);
        const ct = apply3(M, [ch[9] * half, ch[10] * half, ch[11] * half]);
        // Centroid of the child chair, which occupies cm(2^(k-1) C) + ct + u.
        const cc = apply3(cm, CENTROID.map(g => g * half));
        const q = out * INSTANCE_FLOATS;
        for (let r = 0; r < 9; r++) next[q + r] = cm[r];
        for (let r = 0; r < 3; r++) next[q + 9 + r] = ct[r] + u[r];
        for (let r = 0; r < 3; r++) next[q + 12 + r] = ex[r] + cc[r] + ct[r] - pc[r];
        next[q + 15] = k === level ? i : topSlot;
        next[q + 16] = ch[12];
        out++;
      }
    }
    live = out;
    if (k > 1) { const t = cur; cur = next; next = t; }
    else cur = next;
  }
  if (level === 0) live = 1;
  const size = 2 ** (level + 1);

  // How much bigger the patch gets when the explode offsets are applied in
  // full, so the camera can back off by the same factor.
  const half = size / 2, arm = Math.sqrt(3);
  let packed = 0, exploded = 0;
  for (let p = 0; p < live; p++) {
    const o = p * INSTANCE_FLOATS;
    const m = [...cur.subarray(o, o + 9)];
    const c = apply3(m, [1, 1, 1]).map((v, i) => v + cur[o + 9 + i] - half);
    packed = Math.max(packed, Math.hypot(...c));
    exploded = Math.max(exploded, Math.hypot(...c.map((v, i) => v + cur[o + 12 + i])));
  }
  const explodeRatio = (exploded * 1.05 + arm) / (packed + arm);

  return {data: cur.subarray(0, live * INSTANCE_FLOATS), count: live, level, size, explodeRatio};
}

// The cells a placement covers, for the self-check in tools/check.mjs.
export function placementCells(m, t) {
  const cells = [];
  for (const c of CHAIR_CELLS) {
    const lo = apply3(m, c), hi = apply3(m, [c[0] + 1, c[1] + 1, c[2] + 1]);
    cells.push([0, 1, 2].map(i => Math.min(lo[i], hi[i]) + t[i]));
  }
  return cells;
}

// The 24 marked facets of a placement, as "cell|normal" -> symbol index.
export function placementFacets(m, t) {
  const out = new Map();
  for (const f of FACETS) {
    const lo = apply3(m, [f[0], f[1], f[2]]), hi = apply3(m, [f[0] + 1, f[1] + 1, f[2] + 1]);
    const cell = [0, 1, 2].map(i => Math.min(lo[i], hi[i]) + t[i]);
    const n = apply3(m, [f[3], f[4], f[5]]);
    const site = apply3(m, [f[6], f[7], f[8]]).map((v, i) => v + t[i]);
    out.set(`${cell}|${n}`, {symbol: f[9], site: site.join(',')});
  }
  return out;
}
