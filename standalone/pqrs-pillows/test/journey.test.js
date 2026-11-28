// journey.test.js — the solid cut along one partition's loop and opened onto the crowns (src/journey.js), and the
// journey's frames (src/surface-model.js frame(j, part)): the cells cover the orbifold once, every point has its true
// place on a crown, and the loop the journey parts along is its own choice, not the cut's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { journeyOf, chartOf, cellsOf } from '../src/journey.js';
import { solidOf } from '../src/solid.js';
import { createSurfaceModel } from '../src/surface-model.js';
import { stateFor, withNumbers, activate, cardsOf, toHash, fromHash, CARD_KEYS } from '../src/state.js';

const dist3 = (A, i, B, j) => Math.hypot(A[3 * i] - B[3 * j], A[3 * i + 1] - B[3 * j + 1], A[3 * i + 2] - B[3 * j + 2]);
const twisted = (sig, tw, L = null) => { let st = withNumbers(stateFor(sig), { tw }); if (L) st = withNumbers(st, { L }); return st; };
const areaOf = (sig) => (sig === '2222' ? 2 : 2 * Math.PI * (2 - [...sig].reduce((s, d) => s + 1 / Number(d), 0)));
const CASES = [['3333', 0.15, null], ['3333', 0, null], ['2345', 0.2, null], ['2223', 0.12, null], ['2222', 0.2, null], ['4444', -0.3, 2.2], ['3333', 0.25, 4.5]];

test('the cells cover the orbifold exactly once: the crowns\' area is the orbifold\'s, and no triangle lies on two pillows', () => {
  for (const [sig, tw, L] of CASES) {
    const st = twisted(sig, tw, L), S = solidOf(st);
    for (const card of cardsOf(st)) {
      const J = journeyOf(S, st, card);
      let area = 0;
      for (let t = 0; t < J.triangles.length; t += 3) {
        const [a, b, c] = [J.triangles[t], J.triangles[t + 1], J.triangles[t + 2]];
        assert.ok(J.pillow[a] === J.pillow[b] && J.pillow[b] === J.pillow[c], `${sig} ${card.key}: a triangle of one pillow`);
        const la = dist3(J.crown, a, J.crown, b), lb = dist3(J.crown, b, J.crown, c), lc = dist3(J.crown, c, J.crown, a), sp = (la + lb + lc) / 2;
        area += Math.sqrt(Math.max(0, sp * (sp - la) * (sp - lb) * (sp - lc)));
      }
      if (J.exact) assert.ok(Math.abs(area / areaOf(sig) - 1) < 0.012, `${sig} tw ${tw} loop ${card.key}: the crowns' area ${area} is the orbifold's ${areaOf(sig)}`);
      assert.ok(J.cells >= 4 && J.cells <= 40, `${sig} ${card.key}: ${J.cells} cells`);
      assert.ok(J.closed.every(Number.isFinite) && J.crown.every(Number.isFinite) && J.corners.every(Number.isFinite));
      const n = [0, 1].map((k) => J.pillow.reduce((s, v) => s + (v === k ? 1 : 0), 0));
      for (let k = 0; k < 2; k++) assert.equal(n[k] === 0, J.degenerate[k], `${sig} ${card.key}: pillow ${k} has points unless it is a pair of 2s`);
    }
  }
});

test('every point keeps its place: on the solid where its chart point lands, on the crown at its true distances', () => {
  for (const [sig, tw, L] of [['3333', 0.15, null], ['2345', 0.2, null], ['2222', 0.2, null]]) {
    const st = twisted(sig, tw, L), S = solidOf(st), J = journeyOf(S, st, cardsOf(st)[0]), G = S.G, o = [0, 0, 0];
    let worstSolid = 0, worstCrown = 0, checked = 0;
    for (let t = 0; t < J.triangles.length / 3; t += 7) {
      const ids = [J.triangles[3 * t], J.triangles[3 * t + 1], J.triangles[3 * t + 2]];
      const ys = [0, 1, 2].map((c) => [J.corners[9 * t + 3 * c], J.corners[9 * t + 3 * c + 1], J.corners[9 * t + 3 * c + 2]]);
      ys.forEach((y, c) => { S.point(y, o); worstSolid = Math.max(worstSolid, Math.hypot(o[0] - J.closed[3 * ids[c]], o[1] - J.closed[3 * ids[c] + 1], o[2] - J.closed[3 * ids[c] + 2])); });
      // the crown is isometric: a side's chord on it is its length in the pattern's plane, less a little for the bend
      for (let c = 0; c < 3; c++) {
        const d = G.dist(G.q(ys[c], ys[(c + 1) % 3])), chord = dist3(J.crown, ids[c], J.crown, ids[(c + 1) % 3]);
        if (d > 1e-3) { worstCrown = Math.max(worstCrown, Math.abs(chord / d - 1)); checked++; }
      }
    }
    assert.ok(worstSolid < 1e-7, `${sig}: a vertex is where its chart point lands on the solid (${worstSolid})`);
    assert.ok(checked > 300 && worstCrown < 0.02, `${sig}: sides keep their length on the crown (worst ${worstCrown} of ${checked})`);
  }
});

test('the loop, the seals and the cone points: on the solid and on the crowns', () => {
  for (const [sig, tw] of [['3333', 0.15], ['2345', 0.1], ['2222', 0.25]]) {
    const st = twisted(sig, tw), S = solidOf(st), V = S.vertex;
    cardsOf(st).forEach((card, part) => {
      const J = journeyOf(S, st, card), nL = J.loop.closed.length / 3;
      assert.ok(dist3(J.loop.closed, 0, J.loop.closed, nL - 1) < 1e-6, `${sig} ${card.key}: the loop closes on the solid`);
      for (let i = 0; i < nL; i += 9) {
        assert.ok(Math.abs(Math.hypot(J.loop.crown[3 * i], J.loop.crown[3 * i + 1]) - J.rho) < 1e-9 && Math.abs(J.loop.crown[3 * i + 2]) < 1e-9, 'on the crowns the loop is the circle of circumference L');
      }
      assert.ok(Math.abs(J.rho * 2 * Math.PI - card.length) < 1e-9 * card.length, `${sig} ${card.key}: that circle is as long as the loop`);
      // the two pairs of this partition, one a pillow
      const pairs = J.cones.reduce((acc, c) => { acc[c.pillow].push(c.feature); return acc; }, [[], []]).map((p) => p.sort().join('')).sort();
      assert.deepEqual(pairs, CARD_KEYS[part].split('|').sort(), `${sig} ${card.key}: a pillow holds a pair of this partition`);
      for (const c of J.cones) assert.ok(Math.hypot(c.closed[0] - V[c.feature][0], c.closed[1] - V[c.feature][1], c.closed[2] - V[c.feature][2]) < 1e-12);
      J.seals.forEach((sl, k) => {
        const n = sl.closed.length / 3, mine = J.cones.filter((c) => c.pillow === k);
        // a seal runs between its pillow's two cone points; its two copies on the crown share both ends
        const ends = [[sl.closed[0], sl.closed[1], sl.closed[2]], [sl.closed[3 * n - 3], sl.closed[3 * n - 2], sl.closed[3 * n - 1]]];
        for (const e of ends) assert.ok(mine.some((c) => Math.hypot(e[0] - c.closed[0], e[1] - c.closed[1], e[2] - c.closed[2]) < 1e-6), `${sig} ${card.key}: seal ${k} ends at a cone point`);
        assert.ok(dist3(sl.crownA, 0, sl.crownB, 0) < 1e-9 && dist3(sl.crownA, n - 1, sl.crownB, n - 1) < 1e-9, 'the two sides of an open seal meet at the peaks');
        if (!J.degenerate[k]) assert.ok(dist3(sl.crownA, n >> 1, sl.crownB, n >> 1) > 0.05, 'and stand apart between them');
      });
    });
  }
});

test('the journey\'s frames: parted along the axis by the gap, then each point on its crown; one mesh for the whole way', () => {
  for (const [sig, tw] of [['3333', 0.15], ['2222', 0.2], ['2345', 0.1]]) {
    const st = twisted(sig, tw), sm = createSurfaceModel({ levels: 3 }).set(st);
    const f0 = sm.frame(0, 1), f1 = sm.frame(1, 1), fh = sm.frame(0.5, 1), f2 = sm.frame(2, 1);
    assert.equal(f0.journey, undefined, 'the closed surface is the solid\'s own mesh');
    assert.ok(f1.version !== f0.version && f1.version === fh.version && f1.version === f2.version, `${sig}: one mesh for the journey, another than the closed one`);
    assert.equal(f1.journey.part, 1);
    assert.equal(f1.positions.length, f2.positions.length);
    assert.ok(Array.from(f1.positions).every(Number.isFinite) && Array.from(f2.positions).every(Number.isFinite));
    // parted: within a pillow nothing moved against anything else; the two pillows stand `gap` further apart
    const pil = f1.journey.vertexPillow, J = journeyOf(sm.solid, st, cardsOf(st)[1]);
    const pick = [0, 1].map((k) => [...pil.keys()].filter((v) => pil[v] === k).filter((v, i) => i % 97 === 0));
    for (const k of [0, 1]) for (let a = 0; a + 1 < pick[k].length; a++) {
      const u = pick[k][a], v = pick[k][a + 1];
      assert.ok(Math.abs(dist3(f1.positions, u, f1.positions, v) - dist3(J.closed, u, J.closed, v)) < 1e-5, `${sig}: a pillow parts in one piece`);
      // opened: the same two points stand as far apart as on the crown
      assert.ok(Math.abs(dist3(f2.positions, u, f2.positions, v) - dist3(J.crown, u, J.crown, v)) < 1e-5, `${sig}: an open pillow is its crown`);
    }
    const u = pick[0][0], v = pick[1][0], shift = (fr) => [0, 1, 2].map((x) => (fr.positions[3 * v + x] - J.closed[3 * v + x]) - (fr.positions[3 * u + x] - J.closed[3 * u + x]));
    assert.ok(Math.abs(Math.hypot(...shift(f1)) - f1.journey.gap) < 1e-5, `${sig}: at the second stop the pillows are the gap apart`);
    assert.ok(Math.abs(Math.hypot(...shift(fh)) - 0.5 * f1.journey.gap) < 1e-5, `${sig}: half way, half the gap`);
    assert.ok(f1.frame.radius >= f0.frame.radius && f2.frame.radius >= f1.frame.radius - 1e-9, 'the camera makes room');
    // lines: this partition's loop on both rims and its seals; the others gone after the first quarter
    assert.ok(f1.curves.every((c) => c.part === 1), `${sig}: at the second stop only the parted partition's lines are left`);
    assert.equal(f1.curves.filter((c) => c.id === 'loop').length, 2);
    assert.equal(f1.curves.filter((c) => c.id === 'seal').length, 2);
    assert.equal(f2.curves.filter((c) => c.id === 'seal').length, 4, 'an open seal has two sides');
    const early = sm.frame(0.1, 1);
    assert.ok(early.curves.some((c) => c.part !== 1 && c.fade > 0 && c.fade < 1), 'the other partitions\' lines fade out on the way');
    assert.deepEqual(f1.marks.map((m) => m.label), f0.marks.map((m) => m.label));
  }
});

test('the journey parts along the loop it was told, whichever partition is the cut', () => {
  const st = twisted('3333', 0.15), reach = (fr) => fr.marks.map((m) => m.p);
  for (const part of [0, 1, 2]) {
    const sm = createSurfaceModel({ levels: 2 }).set(st), base = reach(sm.frame(1, part)), gap = sm.frame(1, part).journey.gap;
    for (const key of CARD_KEYS) {
      sm.update(activate(st, key).state);
      const now = sm.frame(1, part), far = Math.max(...reach(now).map((p, i) => Math.hypot(p[0] - base[i][0], p[1] - base[i][1], p[2] - base[i][2])));
      assert.ok(far < 1e-5, `parted along partition ${part} with ${key} as the cut: the cone points stand where they stood (${far})`);
      assert.ok(Math.abs(now.journey.gap - gap) < 1e-9);
      assert.equal(now.journey.key, CARD_KEYS[part]);
    }
    sm.update(st);
  }
  // and another loop is another picture
  const sm = createSurfaceModel({ levels: 2 }).set(st), a = reach(sm.frame(1, 0)), b = reach(sm.frame(1, 2));
  assert.ok(Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1], p[2] - b[i][2]))) > 0.05);
});

test('a pair of 2s: no pillow of its own, the other pillow is the whole surface, and the fold goes through it', () => {
  const st = twisted('2223', 0.12), S = solidOf(st);
  const card = cardsOf(st).find((c) => c.onTree), J = journeyOf(S, st, card);
  assert.ok(card, '2223 has a partition with a pair of 2s');
  assert.equal(J.degenerate.filter(Boolean).length, 1);
  const k = J.degenerate.indexOf(true);
  assert.ok(J.pillow.every((v) => v === 1 - k), 'every point is the other pillow\'s');
  // its seal lies on the loop: on the crowns, on the loop's circle
  const sl = J.seals[k];
  for (let i = 0; i < sl.crownA.length / 3; i += 5) assert.ok(Math.abs(Math.hypot(sl.crownA[3 * i], sl.crownA[3 * i + 1]) - J.rho) < 1e-9 && Math.abs(sl.crownA[3 * i + 2]) < 1e-9);
  const sm = createSurfaceModel({ levels: 2 }).set(st), f = sm.frame(1, CARD_KEYS.indexOf(card.key));
  assert.equal(f.curves.filter((c) => c.id === 'loop').length, 1, 'the loop is drawn on the one pillow that has a rim');
});

test('the fold: a chart point and its image under a turn about a cone point fold to the same place', () => {
  const st = twisted('2345', 0.1), card = cardsOf(st)[0], C = chartOf(st, card), G = C.G;
  for (const [s, th] of [[0.3, 0.2], [-0.4, 1.1], [1.9, 0.4], [-2.2, -0.9], [0.05, 3.3]]) {
    const Y = G.point(s, th), f = C.fold(Y);
    assert.ok(f, 'a point is folded');
    const Z = G.norm([0, 1, 2].map((r) => f.M[3 * r] * Y[0] + f.M[3 * r + 1] * Y[1] + f.M[3 * r + 2] * Y[2])), [s2, th2] = G.fermi(Z);
    const side = C.side[f.k], pl = C.pillows[f.k];
    assert.ok(side * s2 >= -1e-9, `the folded point lies on its pillow's side of the loop (${s2})`);
    let thl = side * (th2 - C.base[f.k]); thl -= C.cuff * Math.ceil(thl / C.cuff - 0.5);
    assert.ok(side * s2 <= pl.roofAt(Math.abs(thl)) + 1e-9, 'and under its roof');
  }
  // a face's cells are polygons with at least three corners, each on one pillow
  const S = solidOf(st), tri = S.faces[0].P.map((p) => G.norm([0, 1, 2].map((r) => C.toChart[3 * r] * p[0] + C.toChart[3 * r + 1] * p[1] + C.toChart[3 * r + 2] * p[2])));
  const cells = cellsOf(C, tri);
  assert.ok(cells.length >= 2 && cells.every((c) => c.poly.length >= 3 && (c.k === 0 || c.k === 1)));
});

test('the address carries the loop the journey parts along, only where the journey is under way', () => {
  const st = stateFor('3333');
  assert.equal(toHash(st, { j: 1, jp: 2 }), '#j=1&jp=2');
  assert.equal(toHash(st, { j: 1, jp: 0 }), '#j=1');
  assert.equal(toHash(st, { j: 0, jp: 2 }), '#', 'on the closed surface the choice shows nothing: it is left out');
  assert.equal(fromHash('#k=2345&j=1.5&jp=1').ui.jp, 1);
  assert.equal(fromHash('#k=2345&j=1.5').ui.jp, 0);
  assert.equal(fromHash('#k=2345&j=1.5&jp=7').ui.jp, 0);
  const back = fromHash(toHash(withNumbers(stateFor('2345'), { tw: 0.1 }), { j: 2, jp: 2 }));
  assert.deepEqual([back.ui.j, back.ui.jp], [2, 2]);
});
