// surface-model.test.js — what the Surface pane is handed (src/surface-model.js): the exact solid with every
// partition's seals and loop on it; the same picture whichever partition is the cut; a steady pose while sliders move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSurfaceModel, fitRigid, levelPose } from '../src/surface-model.js';
import { PRESETS, CARD_KEYS, stateFor, withNumbers, activate, cardsOf } from '../src/state.js';

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const far = (A, B) => Math.max(...A.map((p, f) => dist3(p, B[f])));
const twisted = (sig, tw, L = null) => { let st = withNumbers(stateFor(sig), { tw }); if (L) st = withNumbers(st, { L }); return st; };

test('a frame: one closed mesh of four faces, every partition\'s two seals and loop, four labelled cone points', () => {
  for (const sig of [...PRESETS, '2346']) {
    const sm = createSurfaceModel({ levels: 3 }).set(twisted(sig, 0.14)), f = sm.frame();
    const nT = f.triangles.length / 3;
    assert.equal(nT, 4 * 64);
    assert.equal(f.positions.length, 3 * f.nVertices);
    assert.equal(f.corners.length, 9 * nT);
    assert.equal(f.pillow.length, nT);
    assert.ok(f.pillow.every((v) => v === 0), 'one paper: no pillow is toned apart');
    assert.ok(Array.from(f.positions).every(Number.isFinite) && Array.from(f.corners).every(Number.isFinite));
    assert.ok(f.triangles.every((v) => v < f.nVertices));
    assert.equal(f.exact, true);
    assert.equal(f.kind, sig === '2222' ? 'E' : 'H');
    const cards = cardsOf(sm.state);
    for (let part = 0; part < 3; part++) {
      const seals = f.curves.filter((c) => c.id === 'seal' && c.part === part), loops = f.curves.filter((c) => c.id === 'loop' && c.part === part);
      assert.equal(seals.length, 2, `${sig}: two seals of partition ${part}`);
      assert.equal(loops.length, cards[part].onTree ? 0 : 1, `${sig}: the loop of partition ${part}`);
      for (const c of [...seals, ...loops]) { assert.equal(c.key, CARD_KEYS[part]); assert.ok(c.points.length >= 6 && Array.from(c.points).every(Number.isFinite)); }
      for (const c of loops) assert.equal(c.closed, true);
    }
    assert.deepEqual(f.marks.map((m) => m.id), ['P', 'Q', 'R', 'S']);
    assert.deepEqual(f.marks.map((m) => m.label), [0, 1, 2, 3].map((k) => 'PQRS'[k] + sig[k]));
    // the marks are the mesh's own corners, and everything lies inside the camera's frame
    const reach = Math.max(...f.marks.map((m) => Math.hypot(...m.p)));
    assert.ok(reach <= f.frame.radius && reach > 0.5 * f.frame.radius, `${sig}: the solid fills its frame (${reach} of ${f.frame.radius})`);
    for (let i = 0; i < f.positions.length; i += 3) assert.ok(Math.hypot(f.positions[i], f.positions[i + 1], f.positions[i + 2]) <= reach + 1e-6, 'no point lies further out than the cone points');
  }
});

test('the level pose of a cold start: the first pair below, its seal along y from -y, the other pair above', () => {
  for (const [sig, tw] of [['3333', 0], ['3333', 0.2], ['2345', 0.1], ['2222', 0.2], ['2223', 0.15]]) {
    const st = twisted(sig, tw), sm = createSurfaceModel({ levels: 2 }).set(st), V = sm.shown, [a, b, c, d] = st.perm;
    const m1 = [0, 1, 2].map((x) => (V[a][x] + V[b][x]) / 2), m2 = [0, 1, 2].map((x) => (V[c][x] + V[d][x]) / 2);
    assert.ok(m2[2] > m1[2], `${sig} tw ${tw}: the second pair's seal is above the first's`);
    assert.ok(Math.abs(m1[0] - m2[0]) < 1e-9 && Math.abs(m1[1] - m2[1]) < 1e-9, `${sig}: the axis through the two seals' middles is z`);
    assert.ok(Math.abs(V[b][0] - V[a][0]) < 1e-9 && V[b][1] > V[a][1], `${sig}: the first seal runs along y, its first point at -y`);
    if (tw === 0) for (const p of V) assert.ok(Math.abs(p[0]) < 1e-6, `${sig}: a flat solid stands in the y-z plane`);
  }
  // two cold starts are the same picture
  const A = createSurfaceModel({ levels: 3 }).set(twisted('2345', 0.2)).frame(), B = createSurfaceModel({ levels: 3 }).set(twisted('2345', 0.2)).frame();
  assert.deepEqual(Array.from(A.positions), Array.from(B.positions));
});

test('making another partition the cut changes nothing: handed the flipped state, the model draws the same picture', () => {
  for (const [sig, tw, L] of [['3333', 0.15, null], ['2345', -0.2, 3], ['2222', 0.3, null], ['2223', 0.12, null], ['3333', 0.25, 4.6]]) {
    const st = twisted(sig, tw, L), sm = createSurfaceModel({ levels: 3 }).set(st);
    // turn it a little first, as a reader would have by moving a slider
    sm.update(withNumbers(st, { tw: st.tw + 0.01 })); sm.update(st);
    const before = sm.frame(), P0 = Array.from(before.positions), shown0 = sm.shown;
    const curves0 = before.curves.map((c) => ({ id: c.id, part: c.part, mid: [c.points[3 * (c.points.length / 6 | 0)], c.points[3 * (c.points.length / 6 | 0) + 1], c.points[3 * (c.points.length / 6 | 0) + 2]] }));
    for (const key of ['02|13', '03|12', '01|23']) {
      sm.update(activate(st, key).state);
      const f = sm.frame();
      assert.ok(far(sm.shown, shown0) < 1e-6, `${sig} cut ${key}: the cone points stay (${far(sm.shown, shown0)})`);
      // the surface as a set of points: every mark, and the two seals of every colour, where they were
      for (let part = 0; part < 3; part++) {
        const ends = (fr) => fr.curves.filter((c) => c.id === 'seal' && c.part === part).map((c) => [[c.points[0], c.points[1], c.points[2]], [c.points[c.points.length - 3], c.points[c.points.length - 2], c.points[c.points.length - 1]]]);
        const was = ends(before), now = ends(f);
        for (const [p, q] of now) assert.ok(was.some(([u, v]) => (dist3(p, u) < 1e-5 && dist3(q, v) < 1e-5) || (dist3(p, v) < 1e-5 && dist3(q, u) < 1e-5)), `${sig} cut ${key}: a seal of partition ${part} joins the same two cone points`);
      }
      assert.equal(f.curves.length, before.curves.length);
      assert.equal(f.swaps >= 0, true);
    }
    // back on the first cut the mesh itself is the same, vertex for vertex
    sm.update(st);
    const back = Array.from(sm.frame().positions);
    let worst = 0;
    for (let i = 0; i < back.length; i++) worst = Math.max(worst, Math.abs(back[i] - P0[i]));
    assert.ok(worst < 1e-5, `${sig}: back on the first cut the vertices are where they were (${worst})`);
    assert.equal(curves0.length, sm.frame().curves.length);
  }
});

test('a slider moves the solid steadily: small steps, small moves, through the flat state too', () => {
  for (const sig of ['3333', '2345', '2222']) {
    const base = stateFor(sig), sm = createSurfaceModel({ levels: 2 }).set(withNumbers(base, { tw: 0.2 }));
    let last = sm.shown, worst = 0;
    // from a quarter-ish Twist down through 0 (flat: the diagonal seals give way to their twins) to the other side
    for (let i = 1; i <= 80; i++) {
      const tw = 0.2 - 0.005 * i;
      sm.update(withNumbers(base, { tw }), { hold: [0, 1] });
      const now = sm.shown, step = far(now, last);
      // near the flat state the thickness goes like the square root of the Twist: steps are larger there, never a jump
      worst = Math.max(worst, step);
      last = now;
    }
    const size = Math.max(...last.map((p) => Math.hypot(...p)));
    assert.ok(worst < 0.35 * size, `${sig}: no jump on the way through the flat state (largest step ${worst} of size ${size})`);
  }
});

test('while a card\'s slider moves, its pair that holds P stays put and the other pair turns against it', () => {
  const base = stateFor('3333'), sm = createSurfaceModel({ levels: 2 }).set(withNumbers(base, { tw: 0.1 })), start = sm.shown;
  for (let i = 1; i <= 15; i++) sm.update(withNumbers(base, { tw: 0.1 + 0.01 * i }), { hold: [0, 1] });
  const end = sm.shown, moved = end.map((p, f) => dist3(p, start[f]));
  assert.ok(moved[0] < 0.08 && moved[1] < 0.08, `P and Q are held (${moved[0]}, ${moved[1]})`);
  assert.ok(moved[2] > 3 * Math.max(moved[0], moved[1]) && moved[3] > 3 * Math.max(moved[0], moved[1]), `R and S turn (${moved[2]}, ${moved[3]})`);
  // without a hold the motion is shared out
  const sm2 = createSurfaceModel({ levels: 2 }).set(withNumbers(base, { tw: 0.1 }));
  for (let i = 1; i <= 15; i++) sm2.update(withNumbers(base, { tw: 0.1 + 0.01 * i }));
  const even = sm2.shown.map((p, f) => dist3(p, start[f]));
  assert.ok(Math.max(...even) < 2.5 * Math.min(...even), `shared out without a hold (${even})`);
});

test('relevel(): back to the level pose, with the turn that carries the new pose onto the old', () => {
  const base = stateFor('2345'), sm = createSurfaceModel({ levels: 2 }).set(withNumbers(base, { tw: 0.05 }));
  for (let i = 1; i <= 20; i++) sm.update(withNumbers(base, { tw: 0.05 + 0.012 * i }));
  const st = sm.state, held = sm.shown;
  const turn = sm.relevel();
  assert.ok(turn && turn.length === 9, 'a turn is handed back');
  const level = sm.shown, cold = createSurfaceModel({ levels: 2 }).set(st).shown;
  assert.ok(far(level, cold) < 1e-9, 'the level pose is a cold start\'s');
  // turn . (new pose) = the old pose
  for (let f = 0; f < 4; f++) {
    const p = level[f], q = [turn[0] * p[0] + turn[1] * p[1] + turn[2] * p[2], turn[3] * p[0] + turn[4] * p[1] + turn[5] * p[2], turn[6] * p[0] + turn[7] * p[1] + turn[8] * p[2]];
    assert.ok(dist3(q, held[f]) < 1e-9);
  }
  assert.equal(sm.relevel(), null, 'already level: nothing to turn');
});

test('another orbifold starts cold; the camera\'s frame is kept while the solid fits it', () => {
  const sm = createSurfaceModel({ levels: 2 }).set(stateFor('3333'));
  const r0 = sm.frame().frame.radius;
  sm.update(withNumbers(stateFor('3333'), { tw: 0.03 }));
  assert.equal(sm.frame().frame.radius, r0, 'a small move keeps the frame');
  sm.update(stateFor('2223'));
  const f = sm.frame();
  assert.ok(f.frame.radius < 0.8 * r0, '2223 is a smaller solid: its own frame');
  const cold = createSurfaceModel({ levels: 2 }).set(stateFor('2223'));
  assert.ok(far(sm.shown, cold.shown) < 1e-12, 'another signature is laid level, as a cold start');
});

test('fitRigid finds a rotation, with or without a shift; levelPose is a rotation', () => {
  const R = [0.36, 0.48, -0.8, -0.8, 0.6, 0, 0.48, 0.64, 0.6], A = [1, 0, 0, 0, 2, 0, 0, 0, 3, 1, 1, 1], B = [];
  for (let i = 0; i < 4; i++) for (let r = 0; r < 3; r++) B.push(R[3 * r] * A[3 * i] + R[3 * r + 1] * A[3 * i + 1] + R[3 * r + 2] * A[3 * i + 2] + (r === 0 ? 0.5 : 0));
  const fit = fitRigid(4, A, B);
  for (let k = 0; k < 9; k++) assert.ok(Math.abs(fit.R[k] - R[k]) < 1e-9);
  assert.ok(Math.abs(fit.t[0] - 0.5) < 1e-9);
  const B0 = B.map((v, i) => (i % 3 === 0 ? v - 0.5 : v)), about = fitRigid(4, A, B0, null, true);
  for (let k = 0; k < 9; k++) assert.ok(Math.abs(about.R[k] - R[k]) < 1e-9);
  assert.deepEqual(about.t, [0, 0, 0]);
  const V = [[0.3, -1, 0.2], [0.1, 1.1, -0.4], [-0.6, 0.2, 0.9], [0.5, 0.1, 0.8]], M = levelPose(V, 0, 1, 2, 3);
  const det = M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);
  assert.ok(Math.abs(det - 1) < 1e-12);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) assert.ok(Math.abs(M[3 * r] * M[3 * c] + M[3 * r + 1] * M[3 * c + 1] + M[3 * r + 2] * M[3 * c + 2] - (r === c ? 1 : 0)) < 1e-12);
});
