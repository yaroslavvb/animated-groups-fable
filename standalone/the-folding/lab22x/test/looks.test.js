// looks.test.js — the geometry behind the lab's views: pieces, the checkerboard, the cutaway, the slices, the
// crossing carried back to the paper.
//   node --test lab22x/test/looks.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUP, CUTS, buildSheet, positionsAt } from '../src/motions.js';
import { LOOKS, baseGeometry, piecesGeometry, checkerGeometry, createCutter, createSlicer, clipPolylineY, crossingOnPaper,
  PIECE_COLORS, PIECE_HEX, PAPER, CHECKER, CROSS_HEX, CROSS_RGB } from '../src/looks.js';
import { createSelfX, jitterPlane } from '../src/selfx.js';

const sheets = [buildSheet(2, 'acts'), buildSheet(2, 'recut'), buildSheet(1, 'recut'), buildSheet(0, 'acts')];
const paperOf = (S, G) => {
  const P = new Float64Array(2 * G.n);
  for (let i = 0; i < G.n; i++) { const g = S.paperAffine(G.tag[i]), u = G.uv[2 * i], v = G.uv[2 * i + 1]; P[2 * i] = g.a * u + g.b * v + g.tx; P[2 * i + 1] = g.c * u + g.d * v + g.ty; }
  return P;
};
const areaOf = (P, tri, t) => { const a = tri[t], b = tri[t + 1], c = tri[t + 2]; return ((P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * b + 1] - P[2 * a + 1]) * (P[2 * c] - P[2 * a])) / 2; };

test('the looks and their colours', () => {
  assert.deepEqual(LOOKS.map((l) => l.key), ['xray', 'paper', 'pieces', 'checker', 'ribs', 'cutaway']);
  for (const l of LOOKS) assert.ok(l.label && l.note);
  assert.equal(CROSS_HEX.toLowerCase(), '#d55e00');
  assert.equal(CROSS_RGB.length, 3);
  assert.equal(PIECE_COLORS.length, PIECE_HEX.length);
  assert.ok(PIECE_COLORS.length >= 5 && PIECE_COLORS.length <= 16, 'the renderer has 16 palette colours');
  assert.equal(CHECKER.length, 2);
  for (const c of [...PIECE_COLORS, ...CHECKER, PAPER]) { assert.equal(c.front.length, 3); assert.equal(c.back.length, 3); }
  // the vermilion of the crossing is not one of the piece colours
  assert.ok(!PIECE_HEX.map((h) => h.toLowerCase()).includes(CROSS_HEX.toLowerCase()));
});

test('pieces: one flat colour per rigid piece, no vertex shared between two', () => {
  for (const S of sheets) {
    const B = baseGeometry(S), G = piecesGeometry(S);
    assert.equal(B.tri, S.tri);
    assert.equal(G.tri.length, S.tri.length);
    assert.ok(G.n >= S.n);
    for (let t = 0; t < G.tri.length / 3; t++) {
      const part = S.tags[S.triTag[t]].part;
      for (let e = 0; e < 3; e++) {
        const i = G.tri[3 * t + e];
        assert.equal(G.src[i], S.tri[3 * t + e], 'the same corner of the sheet');
        assert.equal(G.tint[i], 4 + (part % PIECE_COLORS.length));
        assert.equal(G.tag[i], S.triTag[t]);
      }
    }
    assert.equal(new Set(Array.from(G.tint)).size, Math.min(S.parts, PIECE_COLORS.length), `${S.cut.name} ${S.key}: a colour per piece`);
  }
});

test('the checkerboard is printed on the paper: the same area, two colours, squares of the grid', () => {
  for (const S of sheets) {
    const step = S.size / 6, G = checkerGeometry(S, step), P = paperOf(S, G);
    let area = 0;
    const byTint = [0, 0];
    for (let t = 0; t < G.tri.length; t += 3) {
      const ar = areaOf(P, G.tri, t);
      assert.ok(ar > 0, 'counter-clockwise on the paper');
      area += ar;
      const tint = G.tint[G.tri[t]];
      assert.ok(tint === 4 || tint === 5);
      assert.equal(G.tint[G.tri[t + 1]], tint); assert.equal(G.tint[G.tri[t + 2]], tint);
      byTint[tint - 4] += ar;
      // the triangle lies in one square of the grid, of the right parity
      const cx = (P[2 * G.tri[t]] + P[2 * G.tri[t + 1]] + P[2 * G.tri[t + 2]]) / 3, cy = (P[2 * G.tri[t] + 1] + P[2 * G.tri[t + 1] + 1] + P[2 * G.tri[t + 2] + 1]) / 3;
      const i = Math.floor(cx / step), j = Math.floor(cy / step);
      assert.equal(tint - 4, (((i + j) % 2) + 2) % 2);
      for (let e = 0; e < 3; e++) {
        const x = P[2 * G.tri[t + e]], y = P[2 * G.tri[t + e] + 1];
        assert.ok(x > i * step - 1e-6 && x < (i + 1) * step + 1e-6 && y > j * step - 1e-6 && y < (j + 1) * step + 1e-6);
      }
    }
    assert.ok(Math.abs(area / GROUP.domainArea - 1) < 1e-6, `${S.cut.name} ${S.key}: area ${area}`);
    assert.ok(byTint[0] > 0.3 * area && byTint[1] > 0.3 * area, 'both colours');
    // and it rides with the paper: flat at t = 0
    const pos = new Float32Array(3 * G.n);
    positionsAt(S, 0, G.uv, G.tag, pos);
    for (let i = 0; i < G.n; i++) assert.ok(Math.hypot(pos[3 * i] - P[2 * i], pos[3 * i + 1] - P[2 * i + 1], pos[3 * i + 2]) < 1e-6);
  }
});

test('the cutaway keeps what is behind the plane, and its section lies in the plane', () => {
  const S = sheets[0], pos = new Float32Array(3 * S.n), cut = createCutter(S.tri, S.n);
  for (const t of [0.5, 0.8, 1]) {
    positionsAt(S, t, S.uv, S.tag, pos);
    let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < 3 * S.n; i += 3) { lo = Math.min(lo, pos[i]); hi = Math.max(hi, pos[i]); }
    for (const f of [0.25, 0.5, 0.71]) {
      const y0 = lo + f * (hi - lo), c = cut(pos, y0);
      assert.equal(c.indices.length % 3, 0);
      assert.ok(c.indices.length > 0 && c.indices.length < 2 * S.tri.length);
      let area = 0, behind = 0;
      const A = (P, a, b, d) => Math.hypot(
        (P[3 * b + 1] - P[3 * a + 1]) * (P[3 * d + 2] - P[3 * a + 2]) - (P[3 * b + 2] - P[3 * a + 2]) * (P[3 * d + 1] - P[3 * a + 1]),
        (P[3 * b + 2] - P[3 * a + 2]) * (P[3 * d] - P[3 * a]) - (P[3 * b] - P[3 * a]) * (P[3 * d + 2] - P[3 * a + 2]),
        (P[3 * b] - P[3 * a]) * (P[3 * d + 1] - P[3 * a + 1]) - (P[3 * b + 1] - P[3 * a + 1]) * (P[3 * d] - P[3 * a])) / 2;
      for (let k = 0; k < c.indices.length; k += 3) {
        for (let e = 0; e < 3; e++) { const i = c.indices[k + e]; assert.ok(i < c.vertices); assert.ok(c.positions[3 * i + 1] >= y0 - 1e-6, 'nothing in front of the plane'); }
        area += A(c.positions, c.indices[k], c.indices[k + 1], c.indices[k + 2]);
      }
      // the kept area is the area of the part of the surface behind the plane
      for (let k = 0; k < S.tri.length; k += 3) {
        const ys = [pos[3 * S.tri[k] + 1], pos[3 * S.tri[k + 1] + 1], pos[3 * S.tri[k + 2] + 1]];
        const full = A(pos, S.tri[k], S.tri[k + 1], S.tri[k + 2]), n = ys.filter((y) => y >= y0).length;
        if (n === 3) behind += full;
        else if (n > 0) {
          // the share of a triangle cut by a plane: one corner alone on its side cuts off the share u * v
          const alone = n === 1 ? ys.findIndex((y) => y >= y0) : ys.findIndex((y) => y < y0);
          const o = ys[alone], p = ys[(alone + 1) % 3], q = ys[(alone + 2) % 3], share = ((y0 - o) / (p - o)) * ((y0 - o) / (q - o));
          behind += full * (n === 1 ? share : 1 - share);
        }
      }
      assert.ok(Math.abs(area - behind) < 1e-5 * (1 + behind), `t = ${t}, plane ${f}: kept ${area}, behind ${behind}`);
      assert.ok(c.section.length > 0);
      for (const line of c.section) { assert.ok(line.length >= 6); for (let k = 1; k < line.length; k += 3) assert.ok(Math.abs(line[k] - y0) < 1e-6); }
    }
    // a plane in front of everything keeps everything; one behind everything keeps nothing
    assert.equal(cut(pos, lo - 1).indices.length, S.tri.length);
    assert.equal(cut(pos, hi + 1).indices.length, 0);
  }
});

test('the slices lie in their planes, and a closed surface is sliced in closed curves', () => {
  const S = sheets[0], pos = new Float32Array(3 * S.n), slice = createSlicer(S.tri, S.n);
  const y0 = S.frame.yc, dy = S.frame.hy / 5;
  for (const t of [0, 0.4, 1]) {
    positionsAt(S, t, S.uv, S.tag, pos);
    const r = slice(pos, y0, dy);
    assert.ok(r.lines.length > 0, `t = ${t}`);
    let total = 0;
    for (const line of r.lines) {
      assert.ok(line.length >= 6);
      const k = (line[1] - y0) / dy;
      assert.ok(Math.abs(k - Math.round(k)) < 1e-4, 'in a plane y = y0 + k dy');
      for (let i = 1; i < line.length; i += 3) assert.ok(Math.abs(line[i] - line[1]) < 1e-6, 'one plane per curve');
      for (let i = 3; i < line.length; i += 3) total += Math.hypot(line[i] - line[i - 3], line[i + 1] - line[i - 2], line[i + 2] - line[i - 1]);
    }
    assert.ok(total > S.size, 'curves of some length');
    if (t === 0) {
      // flat: the tile is convex here, so every plane cuts it in one straight segment
      const planes = new Set(r.lines.map((l) => Math.round((l[1] - y0) / dy)));
      assert.equal(planes.size, r.lines.length, 'one curve per plane on the flat tile');
    }
  }
});

test('clipPolylineY keeps the part behind the plane, cut at the plane', () => {
  const line = Float32Array.from([0, -1, 0, 0, 1, 0, 1, 1, 0, 1, -1, 0, 2, -1, 0, 2, 3, 0]);
  const parts = clipPolylineY(line, 0);
  assert.equal(parts.length, 2);
  assert.deepEqual(Array.from(parts[0]), [0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0]);
  assert.deepEqual(Array.from(parts[1]), [2, 0, 0, 2, 3, 0]);
  assert.equal(clipPolylineY(line, 5).length, 0);
  assert.deepEqual(Array.from(clipPolylineY(line, -2)[0]), Array.from(line));
});

test('the crossing carried back to the paper: two curves of the tile, each as long on the paper as in space', () => {
  const S = sheets[0], J = jitterPlane(S.uv, S.tri, S.triTag), X = createSelfX(S.tri), pos = new Float32Array(3 * S.n);
  // the Hexagon as one piece, at 66 %: it is crossing
  positionsAt(S, 0.66, J, S.tag, pos);
  const r = X.compute(pos, S.size);
  assert.ok(r.count > 0 && r.length / S.size > 0.3);
  const P = crossingOnPaper(r, pos, J, S.tri, S.triTag, S, null);
  assert.ok(P.length >= 8 * r.count);
  // inside the tile's bounding box, and on the paper nearly as long as in space, twice over (the fold is nearly an isometry)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, len = 0;
  for (const p of S.domain.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let s = 0; s < 2 * r.count; s++) {
    for (let e = 0; e < 2; e++) {
      const x = P[4 * s + 2 * e], y = P[4 * s + 2 * e + 1];
      assert.ok(x > x0 - 1e-6 && x < x1 + 1e-6 && y > y0 - 1e-6 && y < y1 + 1e-6, 'on the tile');
    }
    len += Math.hypot(P[4 * s + 2] - P[4 * s], P[4 * s + 3] - P[4 * s + 1]);
  }
  assert.ok(len > 1.2 * r.length && len < 3.5 * r.length, `paper ${len}, space ${r.length}`);
  // the names of the cuts are what the page shows
  assert.deepEqual(CUTS.map((c) => c.name), ['Pocket', 'Bowl', 'Hexagon']);
});
