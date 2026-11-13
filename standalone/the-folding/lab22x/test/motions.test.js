// motions.test.js — the lab's sheets: every cut x motion is the whole tile, starts flat on the paper, ends on The
// Folding's closed shape, moves continuously, and crosses itself when (and only when) the page says so.
//   node --test lab22x/test/motions.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUP, CUTS, MOTIONS, buildSheet, positionsAt } from '../src/motions.js';
import { createSelfX, jitterPlane } from '../src/selfx.js';
import { buildDomain, makeWarp } from '../../src/domain.js';
import { buildMesh } from '../../src/mesh.js';
import createFold from '../../src/folds/crosscap.js';

const size = Math.sqrt(GROUP.domainArea);
const NONE = 0.004;                       // tile widths: below this the sheet is not crossing (as the page)

/** The paper point of every vertex of a sheet. */
function paper(S) {
  const P = new Float64Array(2 * S.n);
  for (let i = 0; i < S.n; i++) {
    const g = S.paperAffine(S.tag[i]), u = S.uv[2 * i], v = S.uv[2 * i + 1];
    P[2 * i] = g.a * u + g.b * v + g.tx; P[2 * i + 1] = g.c * u + g.d * v + g.ty;
  }
  return P;
}
/** The crossing length (tile widths) at each of n + 1 moments, on the detector's own triangulation. */
function profile(S, n) {
  const J = jitterPlane(S.uv, S.tri, S.triTag), X = createSelfX(S.tri), pos = new Float32Array(3 * S.n), out = [];
  for (let k = 0; k <= n; k++) { positionsAt(S, k / n, J, S.tag, pos); out.push(X.compute(pos, S.size).length / S.size); }
  return out;
}

test('the group, the cuts, the motions', () => {
  assert.equal(GROUP.id, '22x');
  assert.deepEqual(CUTS.map((c) => c.name), ['Pocket', 'Bowl', 'Hexagon']);
  assert.deepEqual(MOTIONS.map((m) => m.key), ['acts', 'twist', 'recut']);
});

for (const cut of CUTS) {
  // the reference: The Folding's own fold of this cut, closed
  const dom = buildDomain(GROUP, { seed: cut.seed, warp: makeWarp(GROUP, 0) });
  const ref = createFold(GROUP, dom, buildMesh(GROUP, dom, {}), { anchor: cut.seed });
  const F1 = ref.at(1);
  for (const m of MOTIONS) {
    const name = `${cut.name} / ${m.key}`;
    const S = buildSheet(cut.index, m.key);

    test(`${name}: the sheet is the whole tile, once, the right way up`, () => {
      const P = paper(S);
      let area = 0;
      for (let t = 0; t < S.tri.length; t += 3) {
        const a = S.tri[t], b = S.tri[t + 1], c = S.tri[t + 2];
        const ar = ((P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * b + 1] - P[2 * a + 1]) * (P[2 * c] - P[2 * a])) / 2;
        assert.ok(ar > 0, 'counter-clockwise on the paper');
        area += ar;
      }
      assert.ok(Math.abs(area / GROUP.domainArea - 1) < 1e-6, `area ${area}`);
      assert.equal(S.triTag.length, S.tri.length / 3);
      assert.equal(S.tag.length, S.n);
      const used = new Uint8Array(S.n);
      for (const i of S.tri) used[i] = 1;
      assert.ok(used.every((u) => u === 1), 'every vertex is a corner of a triangle');
      assert.ok(S.size > 0 && Math.abs(S.size - size) < 1e-12);
    });

    test(`${name}: flat on the paper at t = 0, The Folding's closed shape at t = 1`, () => {
      const P = paper(S), pos = new Float32Array(3 * S.n), o = [0, 0, 0];
      positionsAt(S, 0, S.uv, S.tag, pos);
      for (let i = 0; i < S.n; i++) assert.ok(Math.hypot(pos[3 * i] - P[2 * i], pos[3 * i + 1] - P[2 * i + 1], pos[3 * i + 2]) < 1e-6, `vertex ${i} at t = 0`);
      positionsAt(S, 1, S.uv, S.tag, pos);
      let worst = 0;
      for (let i = 0; i < S.n; i++) {
        F1(P[2 * i], P[2 * i + 1], ref.mesh.locate(P[2 * i], P[2 * i + 1]), o);
        worst = Math.max(worst, Math.hypot(pos[3 * i] - o[0], pos[3 * i + 1] - o[1], pos[3 * i + 2] - o[2]));
      }
      assert.ok(worst < 1e-5, `largest distance from The Folding's closed shape: ${worst}`);
    });

    test(`${name}: the motion is continuous and finite`, () => {
      const a = new Float32Array(3 * S.n), b = new Float32Array(3 * S.n), dt = 1e-4;
      for (let k = 0; k < 97; k++) {
        const t = (k / 97) * (1 - dt);
        positionsAt(S, t, S.uv, S.tag, a); positionsAt(S, t + dt, S.uv, S.tag, b);
        for (let i = 0; i < 3 * S.n; i += 3) {
          assert.ok(Number.isFinite(a[i] + a[i + 1] + a[i + 2]), `finite at t = ${t}`);
          const d = Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]);
          assert.ok(d < 0.02 * S.size, `a jump of ${d / S.size} tile widths at t = ${t}`);
        }
      }
    });

    test(`${name}: lines, cone points, stops`, () => {
      assert.ok(S.duration >= 7 && S.duration < 13);
      assert.equal(S.stops[0].t, 0);
      assert.equal(S.stops[S.stops.length - 1].t, 1);
      for (let i = 1; i < S.stops.length; i++) assert.ok(S.stops[i].t > S.stops[i - 1].t);
      assert.ok(S.foldFrom >= 0 && S.foldFrom < 1 && S.clipFrom >= S.foldFrom && S.clipFrom < 1);
      assert.equal(S.cones.length > 0, true);
      for (const t of [0, 0.13, 0.5, 0.77, 1]) {
        for (const L of S.lines) {
          assert.ok(['seam', 'rim', 'crease'].includes(L.kind));
          const out = new Float32Array(3 * L.tag.length);
          positionsAt(S, t, L.uv, L.tag, out);
          assert.ok(out.every(Number.isFinite), `${L.kind} line at t = ${t}`);
          const st = L.style(t);
          assert.ok(st === null || (st.width > 0 && st.alpha >= 0 && st.alpha <= 1));
        }
        for (const ax of S.axis(t)) assert.ok(ax.length >= 6 && Array.from(ax).every(Number.isFinite));
      }
      // the double line is drawn on the closed shape
      assert.ok(S.axis(1).length >= 1);
    });
  }
}

test('the Pocket never passes through itself, whatever the motion', () => {
  for (const m of MOTIONS) {
    const L = profile(buildSheet(0, m.key), 60);
    assert.ok(Math.max(...L) < NONE, `${m.key}: ${Math.max(...L)}`);
  }
});

test('Re-cut first never passes through itself', () => {
  for (const cut of CUTS) {
    const S = buildSheet(cut.index, 'recut'), L = profile(S, 120);
    assert.ok(Math.max(...L) < NONE, `${cut.name}: ${Math.max(...L)} at ${L.indexOf(Math.max(...L)) / 120}`);
  }
});

test('Re-cut first: the pieces are carried by elements of the group, one after the other, then the Pocket folds', () => {
  const pocket = buildSheet(0, 'acts').domain;
  for (const [ci, parts, moves] of [[1, 2, 1], [2, 5, 4]]) {
    const S = buildSheet(ci, 'recut');
    assert.equal(S.parts, parts);
    const mv = S.map.moves.filter((m) => m.to > m.from);
    assert.equal(mv.length, moves);
    for (let i = 0; i < mv.length; i++) {
      assert.ok(mv[i].to <= S.foldFrom + 1e-9, 'every move ends before the fold starts');
      if (i) assert.ok(mv[i].from >= mv[i - 1].to - 1e-9, 'one after the other');
      assert.ok(typeof mv[i].text === 'string' && mv[i].text.length > 3);
    }
    // the pieces tile the tile; carried into place they tile the Pocket
    let area = 0;
    for (const p of S.map.pieces) {
      let a = 0;
      for (let i = 0; i < p.poly.length; i++) { const q = p.poly[i], r = p.poly[(i + 1) % p.poly.length]; a += q[0] * r[1] - q[1] * r[0]; }
      area += Math.abs(a) / 2;
    }
    assert.ok(Math.abs(area / GROUP.domainArea - 1) < 1e-9, `pieces: ${area}`);
    // at the moment the fold starts every vertex is flat, inside the Pocket
    const pos = new Float32Array(3 * S.n);
    positionsAt(S, S.foldFrom, S.uv, S.tag, pos);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pocket.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let i = 0; i < S.n; i++) {
      assert.ok(Math.abs(pos[3 * i + 2]) < 1e-6, 'flat');
      assert.ok(pos[3 * i] > x0 - 1e-6 && pos[3 * i] < x1 + 1e-6 && pos[3 * i + 1] > y0 - 1e-6 && pos[3 * i + 1] < y1 + 1e-6, 'in the Pocket');
    }
  }
});

test('one piece: the Bowl and the Hexagon pass through themselves, from when the page says, and end on the double line', () => {
  const N = 240;
  for (const [ci, key, lo, hi] of [[1, 'acts', 0.36, 0.40], [2, 'acts', 0.57, 0.62], [1, 'twist', 0.51, 0.56], [2, 'twist', 0.66, 0.71]]) {
    const S = buildSheet(ci, key), L = profile(S, N);
    const first = L.findIndex((v) => v >= NONE) / N;
    assert.ok(first > lo && first < hi, `${CUTS[ci].name} ${key}: first crossing at ${first}`);
    for (let k = Math.round(first * N); k <= N; k++) assert.ok(L[k] >= NONE, `${CUTS[ci].name} ${key}: crossing to the end (t = ${k / N})`);
    const axis = (S.fold.finalMap.mu * S.frame.hy) / S.size;
    assert.ok(Math.abs(L[N] - axis) < 0.02, `${CUTS[ci].name} ${key}: at the end ${L[N]}, the double line ${axis}`);
    assert.ok(Math.max(...L) > 1.5 * axis, 'more than the double line on the way');
  }
});

test('positionsAt takes any point of the paper with its tag (the checkerboard, the detector)', () => {
  const S = buildSheet(2, 'recut'), pos = new Float32Array(3 * S.n), mid = new Float32Array(3);
  for (const t of [0, 0.3, 0.6, 1]) {
    positionsAt(S, t, S.uv, S.tag, pos);
    // the centroid of a triangle goes to the centroid of its corners at t = 0 (flat), and stays near it later
    for (let T = 0; T < S.tri.length; T += 3 * 37) {
      const a = S.tri[T], b = S.tri[T + 1], c = S.tri[T + 2];
      const uv = Float64Array.from([(S.uv[2 * a] + S.uv[2 * b] + S.uv[2 * c]) / 3, (S.uv[2 * a + 1] + S.uv[2 * b + 1] + S.uv[2 * c + 1]) / 3]);
      positionsAt(S, t, uv, Uint16Array.from([S.triTag[T / 3]]), mid);
      const d = Math.hypot(mid[0] - (pos[3 * a] + pos[3 * b] + pos[3 * c]) / 3, mid[1] - (pos[3 * a + 1] + pos[3 * b + 1] + pos[3 * c + 1]) / 3, mid[2] - (pos[3 * a + 2] + pos[3 * b + 2] + pos[3 * c + 2]) / 3);
      assert.ok(d < (t === 0 ? 1e-6 : 0.02 * S.size), `t = ${t}, triangle ${T / 3}: ${d}`);
    }
  }
});
