// surface-model.test.js — the orbifold in space: closed surface, pose, journey, slider frames, the carry through a flip.
//   node --test test/surface-model.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/pillow.js';
import { createSurfaceModel, fitRigid } from '../src/surface-model.js';
import { createSurface } from '../src/solver.js';
import { flip } from '../src/flips.js';
import { fourConeCentered } from '../../two-features-two-handles/src/handles.js';

// The states the page opens with (the engine's defaults; PROTO-SPEC D1–D3) and the flat one.
const engineState = (k, perm, orders, L, tw = 0) => ({ k, perm, orders, L, tw, b: 0, tau: 0, thetas: [0, 0, 0, 0], print: null });
const STATES = {
  3333: engineState('3333', [0, 1, 2, 3], [3, 3, 3, 3], 2.6339157938496336),
  2345: engineState('2345', [0, 1, 3, 2], [2, 3, 5, 4], 2.535705814997194),
  2223: engineState('2223', [3, 0, 1, 2], [3, 2, 2, 2], 1.3169578969248166),
  2222: engineState('2222', [0, 1, 2, 3], [2, 2, 2, 2], 1, 0),
};
const N = 1400;                                       // vertices asked for in these tests (the page: 2600)
/**
 * Settle until the model is at rest (solver.js settles a cold start over several calls and catches a drag up by
 * itself; at rest on a grid made for another Length the model starts again cold on the right one, which settles too).
 */
function rest(sm, max = 4000) {
  for (let i = 0; i < max; i++) {
    const r = sm.restarts, was = sm.settling;
    sm.settle(50);
    if (!was && sm.restarts === r) return i;          // it was at rest and stayed there
  }
  return max;
}
const models = {};
const modelOf = (id) => {
  if (!models[id]) { models[id] = createSurfaceModel({ nVertices: N }); models[id].set(STATES[id]); rest(models[id]); }
  return models[id];
};
const at = (a, v) => [a[3 * v], a[3 * v + 1], a[3 * v + 2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const cellOf = (mesh) => { let m = 0; for (let e = 0; e < mesh.nEdges; e++) m = Math.max(m, mesh.restLength[e]); return m; };
const markPoints = (fr) => { const out = []; for (const m of fr.marks) out[m.feature] = at(fr.positions, m.vertex); return out; };
/** The volume the frame's triangles enclose (positive: counter-clockwise seen from outside, so a print is not mirrored). */
const volumeOf = (fr) => {
  let vol = 0;
  const X = fr.positions;
  for (let t = 0; t < fr.triangles.length / 3; t++) {
    const a = 3 * fr.triangles[3 * t], b = 3 * fr.triangles[3 * t + 1], c = 3 * fr.triangles[3 * t + 2];
    vol += X[a] * (X[b + 1] * X[c + 2] - X[b + 2] * X[c + 1]) - X[a + 1] * (X[b] * X[c + 2] - X[b + 2] * X[c]) + X[a + 2] * (X[b] * X[c + 1] - X[b + 1] * X[c]);
  }
  return vol / 6;
};

function closure(fr) {
  // on the vertices of the CLOSED surface: every edge in exactly two triangles, once each way; Euler characteristic
  const used = new Set(), edges = new Map();
  let bad = 0;
  for (let t = 0; t < fr.triangles.length / 3; t++) for (let c = 0; c < 3; c++) {
    const a = fr.closedOf[fr.triangles[3 * t + c]], b = fr.closedOf[fr.triangles[3 * t + (c + 1) % 3]];
    used.add(a); used.add(b);
    if (a === b) { bad++; continue; }
    const key = a < b ? `${a}_${b}` : `${b}_${a}`, e = edges.get(key) || [0, 0];
    e[a < b ? 0 : 1]++; edges.set(key, e);
  }
  for (const e of edges.values()) if (e[0] !== 1 || e[1] !== 1) bad++;
  return { bad, euler: used.size - edges.size + fr.triangles.length / 3 };
}

for (const id of ['3333', '2345', '2223', '2222']) {
  test(`${id}: after set() the surface is closed (Euler 2), finite, near isometric; the three stops share one vertex set`, () => {
    const sm = modelOf(id), st = STATES[id], f0 = sm.frame(0), f1 = sm.frame(1), f2 = sm.frame(2), mesh = sm.mesh;
    const cl = closure(f0);
    assert.equal(cl.bad, 0, 'every edge of the closed surface lies in two triangles, once each way');
    assert.equal(cl.euler, 2);
    for (const fr of [f0, f1, f2]) {
      assert.equal(fr.version, f0.version); assert.equal(fr.nVertices, f0.nVertices); assert.equal(fr.positions.length, 3 * f0.nVertices);
      assert.equal(fr.triangles, f0.triangles); assert.equal(fr.corners.length, 3 * fr.triangles.length);
      for (let i = 0; i < fr.positions.length; i++) assert.ok(Number.isFinite(fr.positions[i]), 'positions finite');
      for (let i = 0; i < fr.triangles.length; i++) assert.ok(fr.triangles[i] < fr.nVertices);
      // no triangle has corners on both pillows
      for (let t = 0; t < fr.triangles.length / 3; t++) for (let c = 0; c < 3; c++) assert.equal(fr.vertexPillow[fr.triangles[3 * t + c]], fr.pillow[t]);
    }
    // the stretch, measured here on the closed positions against the mesh's exact rest lengths
    const X = sm.closed;
    let sum = 0, worstLong = 0;
    for (let e = 0; e < mesh.nEdges; e++) {
      const d = dist(at(X, mesh.edges[2 * e]), at(X, mesh.edges[2 * e + 1]));
      sum += Math.abs(d / mesh.restLength[e] - 1); worstLong = Math.max(worstLong, d - mesh.restLength[e]);
    }
    if (id === '2222') {
      assert.equal(f0.kind, 'E'); assert.equal(f0.exact, true); assert.equal(f0.stats.strainMean, 0);
      assert.ok(worstLong < 1e-9, 'flat: no chord is longer than its exact length (the solid only folds)');
      assert.ok(sum / mesh.nEdges < 1e-12, 'flat at L = 1, tw = 0: every edge exact');
      assert.equal(f0.stats.onCreases, 0, 'the doubled square: the grid already follows the folds, no vertex is moved');
    } else {
      assert.equal(f0.kind, 'H');
      // solver.js stops polishing at a cap on purpose (full convergence notches the seals): 0.8-1.1 % at the presets
      assert.ok(sum / mesh.nEdges < 0.015, `mean stretch ${(100 * sum / mesh.nEdges).toFixed(3)} % is under 1.5 %`);
      assert.ok(Math.abs(f0.stats.strainMean - sum / mesh.nEdges) < 1e-9, 'stats.strainMean is that number');
      assert.ok(f0.stats.strainMax >= f0.stats.strainMean);
    }
    assert.deepEqual(f0.degenerate, [st.orders[0] === 2 && st.orders[1] === 2 && id !== '2222', st.orders[2] === 2 && st.orders[3] === 2 && id !== '2222']);
    // (the integrator, 27 Nov: stop 0 has the closed solid's own, tighter frame; from stop 1 on one frame holds the rest)
    assert.ok(f0.frame.radius > 0 && f0.frame.radius <= f1.frame.radius * 1.0001 && f2.frame.radius === f1.frame.radius, 'the closed solid\'s frame at stop 0, one frame radius from stop 1 on');
    assert.ok(f0.frame.radius > 0.5 * f1.frame.radius, 'the two frames are of one order');
    // every point of the journey stays inside the camera's frame
    for (const fr of [f0, f1, f2]) for (let v = 0; v < fr.nVertices; v++) assert.ok(dist(at(fr.positions, v), fr.frame.center) <= fr.frame.radius * 1.0001);
  });
}

test('activating another partition turns nothing on the screen; flipping back holds it there; relevel() lays the cut level', () => {
  for (const id of ['3333', '2345', '2222']) {
    const sm = createSurfaceModel({ nVertices: N }), st = STATES[id], flat = id === '2222', tol = (c) => (flat ? 1e-6 : c);
    sm.set(st); rest(sm);
    assert.equal(sm.hold, null, 'a cold start holds nothing');
    const f0 = sm.frame(0), old = markPoints(f0);
    const r = flip(st, '02|13');
    sm.flip(r.state, { invQ: r.invQ, before: st }); rest(sm);
    const f1 = sm.frame(0), now = markPoints(f1), cell = cellOf(sm.mesh);
    for (let f = 0; f < 4; f++) assert.ok(dist(now[f], old[f]) < tol(cell), `${id}: feature ${f} moved on the screen by ${dist(now[f], old[f]).toExponential(2)}`);
    assert.ok(sm.hold !== null, 'held');
    assert.ok(dist(f1.frame.center, f0.frame.center) < 0.3 * f0.frame.radius, `${id}: the camera keeps its frame (moved ${dist(f1.frame.center, f0.frame.center).toFixed(3)})`);
    // and back to the first partition: still where it was
    const b = flip(r.state, '01|23');
    sm.flip(b.state, { invQ: b.invQ, before: r.state }); rest(sm);
    const again = markPoints(sm.frame(0));
    for (let f = 0; f < 4; f++) assert.ok(dist(again[f], old[f]) < tol(2 * cell), `${id}: after flipping back feature ${f} stands ${dist(again[f], old[f]).toExponential(2)} off`);
    // relevel: the cut's own pose again, the hold handed back
    const h = sm.relevel();
    assert.ok(h && h.R.length === 9 && h.t.length === 3);
    assert.equal(sm.hold, null);
    const lv = markPoints(sm.frame(0)), p = sm.state.perm, d = [lv[p[1]][0] - lv[p[0]][0], lv[p[1]][1] - lv[p[0]][1]];
    assert.ok(d[1] / Math.hypot(...d) > 0.995, `${id}: level again, the first seal along y`);
    assert.equal(sm.relevel(), null, 'nothing more to drop');
  }
});

test('the world frame: loop level about the z axis, first pair below, its seal along y from -y', () => {
  for (const id of ['3333', '2345', '2223', '2222']) {
    const sm = modelOf(id), fr = sm.frame(0), mk = markPoints(fr), st = STATES[id];
    const [Pp, Qp, Rp, Sp] = [0, 1, 2, 3].map((slot) => mk[st.perm[slot]]);
    const loop = fr.curves.find((c) => c.id === 'loop');
    let cx = 0, cy = 0, cz = 0, zSpread = 0;
    for (const v of loop.chain) { cx += fr.positions[3 * v]; cy += fr.positions[3 * v + 1]; cz += fr.positions[3 * v + 2]; }
    cx /= loop.chain.length; cy /= loop.chain.length; cz /= loop.chain.length;
    for (const v of loop.chain) zSpread = Math.max(zSpread, Math.abs(fr.positions[3 * v + 2] - cz));
    const size = sm.frame(1).frame.radius;       // the journey's frame, as when these bounds were set (stop 0 has a tighter one now)
    assert.ok(Math.hypot(cx, cy, cz) < 0.05 * size, `${id}: the loop is centred on the origin (${cx.toFixed(3)}, ${cy.toFixed(3)}, ${cz.toFixed(3)})`);
    assert.ok(zSpread < 0.2 * size, `${id}: the loop is about level (spread ${zSpread.toFixed(3)})`);
    assert.ok(Pp[2] <= 1e-6 && Qp[2] <= 1e-6, `${id}: P, Q below the loop`);
    // (a (2, 2) pair lies ON the loop: level with it, not above)
    const slack = fr.degenerate[1] ? 0.06 * size : 1e-6;
    assert.ok(Rp[2] >= -slack && Sp[2] >= -slack, `${id}: R, S above (${Rp[2].toFixed(4)}, ${Sp[2].toFixed(4)})`);
    // seen from above (P and Q need not be equally high: 2345's first pillow is {2, 3})
    const d = [Qp[0] - Pp[0], Qp[1] - Pp[1]], len = Math.hypot(...d);
    assert.ok(d[1] / len > 0.995, `${id}: the first seal runs along +y (${(d[1] / len).toFixed(4)})`);
    assert.ok(Pp[1] < 0 && Qp[1] > 0);
  }
});

test('the journey: the pillows part along the axis by the gap, then each seal opens onto the exact crown', () => {
  for (const id of ['3333', '2345', '2223', '2222']) {
    const sm = modelOf(id), f0 = sm.frame(0), f1 = sm.frame(1), f2 = sm.frame(2), fh = sm.frame(0.5), mesh = sm.mesh, O = sm.crown;
    if (id !== '2222') assert.equal(O, mesh.open.positions, 'the crowns are pillow.js\'s exact ones');
    assert.ok(f0.gap > 0.1 * f0.frame.radius, 'a gap that shows both rims');
    let worst1 = 0, worst2 = 0, worstH = 0;
    for (let v = 0; v < f0.nVertices; v++) {
      const sgn = f0.vertexPillow[v] ? 1 : -1;
      worst1 = Math.max(worst1, Math.abs(f1.positions[3 * v] - f0.positions[3 * v]), Math.abs(f1.positions[3 * v + 1] - f0.positions[3 * v + 1]), Math.abs(f1.positions[3 * v + 2] - f0.positions[3 * v + 2] - sgn * f0.gap / 2));
      worstH = Math.max(worstH, Math.abs(fh.positions[3 * v + 2] - f0.positions[3 * v + 2] - sgn * f0.gap / 4));
    }
    assert.ok(worst1 < 1e-5, `${id}: at stop 1 each pillow has moved by half the gap along z and not otherwise (${worst1})`);
    assert.ok(worstH < 1e-5, `${id}: half way they are half way`);
    // stop 2: the open crowns (pillow.js's exact ones), parted. The frame's first vertices are the mesh's open vertices.
    for (let v = 0; v < mesh.open.nVertices; v++) {
      const k = f0.vertexPillow[v];
      if (f0.degenerate[k]) continue;
      worst2 = Math.max(worst2, Math.abs(f2.positions[3 * v] - O[3 * v]), Math.abs(f2.positions[3 * v + 1] - O[3 * v + 1]), Math.abs(f2.positions[3 * v + 2] - O[3 * v + 2] - (k ? 1 : -1) * f0.gap / 2));
    }
    assert.ok(worst2 < 1e-5, `${id}: at stop 2 every vertex of a pillow with an inside is on its crown (${worst2})`);
    // the seals: closed up to stop 1 (one curve each, its two copies on one line), open after it (two curves each)
    const seals = (fr) => fr.curves.filter((c) => c.id.startsWith('seal'));
    assert.equal(seals(f1).length, 2);
    assert.equal(seals(f2).length, 2 + f0.degenerate.filter((d) => !d).length);
    assert.equal(f0.curves.filter((c) => c.id === 'loop').length, 1);
    assert.equal(f1.curves.filter((c) => c.id === 'loop').length, f0.degenerate.some(Boolean) ? 1 : 2);
    for (const c of f2.curves) for (const v of c.chain) { assert.ok(v < f2.nVertices); assert.equal(f2.vertexPillow[v], c.pillow, 'a curve rides one pillow'); }
    // a (2, 2) pillow has no triangles and nothing to open: its seal is the same segment at stops 1 and 2
    f0.degenerate.forEach((deg, k) => {
      if (!deg) return;
      assert.ok(!Array.from(f0.pillow).includes(k), 'no triangles of its own');
      const seal = f2.curves.find((c) => c.id === `seal${k}`);
      for (const v of seal.chain) assert.ok(dist(at(f2.positions, v), at(f1.positions, v)) < 1e-6);
      // and it lies on the loop: joined, every vertex of the other pillow's rim is a vertex of this seal
      const loop = f0.curves.find((c) => c.id === 'loop');
      assert.equal(loop.pillow, 1 - k);
      for (const v of loop.chain) {
        let best = Infinity;
        for (const u of seal.chain) best = Math.min(best, dist(at(f0.positions, v), at(f0.positions, u)));
        assert.ok(best < 1e-6, 'the folded rim lies on the seal');
      }
    });
    // half way through the opening nothing is torn: no side is longer than twice what it is at the ends, and all but a
    // few keep 0.3 of their length (a straight mix shortens a side that swings round, by cos of half its swing; the
    // few are sides at a crumple of the relaxed shape, which the crown does not have)
    const fm = sm.frame(1.5);
    let short = 0, sides = 0, ratioHi = 0;
    for (let t = 0; t < f0.triangles.length / 3; t++) for (let c = 0; c < 3; c++) {
      const a = f0.triangles[3 * t + c], b = f0.triangles[3 * t + (c + 1) % 3];
      const d1 = dist(at(f1.positions, a), at(f1.positions, b)), d2 = dist(at(f2.positions, a), at(f2.positions, b)), dm = dist(at(fm.positions, a), at(fm.positions, b));
      const lo = Math.min(d1, d2), hi = Math.max(d1, d2);
      if (lo > 1e-6) { sides++; if (dm < 0.3 * lo) short++; ratioHi = Math.max(ratioHi, dm / hi); }
    }
    assert.ok(short <= 0.01 * sides && ratioHi < 2, `${id}: mid-opening: ${short} of ${sides} sides under 0.3 of their length, the longest ${ratioHi.toFixed(2)} of its own`);
  }
});

test('corners: each triangle is small in the engine\'s pair frame, and the marks sit on the engine\'s cone points', () => {
  for (const id of ['3333', '2345', '2223', '2222']) {
    const sm = modelOf(id), fr = sm.frame(0), st = STATES[id], mesh = sm.mesh, flat = id === '2222', cell = cellOf(mesh);
    const C = fr.corners;
    const hd = (a, b) => (flat ? Math.hypot(C[a] - C[b], C[a + 1] - C[b + 1]) : Math.acosh(Math.max(1, C[a + 2] * C[b + 2] - C[a] * C[b] - C[a + 1] * C[b + 1])));
    let worstOn = 0, worstSide = 0;
    for (let t = 0; t < fr.triangles.length / 3; t++) for (let c = 0; c < 3; c++) {
      const k = 9 * t + 3 * c, k2 = 9 * t + 3 * ((c + 1) % 3);
      worstOn = Math.max(worstOn, flat ? Math.abs(C[k + 2] - 1) : Math.abs(C[k] * C[k] + C[k + 1] * C[k + 1] - C[k + 2] * C[k + 2] + 1) / (C[k + 2] * C[k + 2]));
      worstSide = Math.max(worstSide, hd(k, k2));
    }
    assert.ok(worstOn < 1e-9, `${id}: corners on the hyperboloid (${worstOn})`);
    assert.ok(worstSide < cell * (flat ? 1.6 : 1.0001) + 1e-6, `${id}: no triangle's side is longer in the chart than the longest edge (${worstSide.toFixed(4)} against ${cell.toFixed(4)})`);
    // the cone points: the corner of a triangle at a mark is the engine's home point of that slot, or its copy by whole turns of the loop
    const home = flat ? [[-st.L / 2, 0, 1], [st.L / 2, 0, 1], [-st.L / 2 + 2 * st.L * st.tw, 1 / st.L, 1], [st.L / 2 + 2 * st.L * st.tw, 1 / st.L, 1]]
      : fourConeCentered(st.orders, st.L, st.tw, { commas: [null, null, null, null] }).home;
    for (const m of fr.marks) {
      if (fr.degenerate[m.pillow]) continue;                                    // a (2, 2) pillow has no triangle to carry a print
      let best = Infinity;
      for (let i = 0; i < fr.triangles.length; i++) {
        if (fr.triangles[i] !== m.vertex) continue;
        const h = home[m.slot];
        best = Math.min(best, flat ? Math.min(Math.hypot(C[3 * i] - h[0], C[3 * i + 1] - h[1]), Math.hypot(C[3 * i] - h[0] - 2 * st.L, C[3 * i + 1] - h[1]), Math.hypot(C[3 * i] - h[0] + 2 * st.L, C[3 * i + 1] - h[1]))
          : Math.acosh(Math.max(1, C[3 * i + 2] * h[2] - C[3 * i] * h[0] - C[3 * i + 1] * h[1])));
      }
      // slots A and C stand in the middle lift (theta = -cuff/4); B and D may be taken one turn of the loop over
      if (m.slot === 0 || m.slot === 2) assert.ok(best < 1e-6, `${id}: mark ${m.id} (slot ${m.slot}) is ${best} from the engine's point`);
      else assert.ok(Number.isFinite(best));
    }
    assert.deepEqual(fr.marks.map((m) => m.id).sort(), ['P', 'Q', 'R', 'S']);
    for (const m of fr.marks) { assert.equal(m.feature, st.perm[m.slot]); assert.equal(m.pair, m.slot < 2 ? 0 : 1); assert.equal(m.id, 'PQRS'[m.feature]); assert.equal(m.order, st.orders[m.slot]); assert.equal(m.label, `${m.id}${m.order}`); }
  }
});

test('2222 with a Twist: the mesh follows the solid\'s creases; every side that stays in one face has its exact length', () => {
  const rows = [];
  for (const [L, tw] of [[1, 0.25], [1.2, 0.1], [0.8, -0.3], [1, 0.05], [Math.pow(4 / 3, 0.25), 0.25]]) {
    const count = (follow) => {
      const sm = createSurfaceModel({ nVertices: N, followCreases: follow });
      sm.set({ ...STATES[2222], L, tw });
      const fr = sm.frame(0), C = fr.corners;
      let folded = 0, sides = 0, worstLong = 0;
      for (let t = 0; t < fr.triangles.length / 3; t++) for (let c = 0; c < 3; c++) {
        const c2 = (c + 1) % 3, a = fr.triangles[3 * t + c], b = fr.triangles[3 * t + c2];
        const plane = Math.hypot(C[9 * t + 3 * c] - C[9 * t + 3 * c2], C[9 * t + 3 * c + 1] - C[9 * t + 3 * c2 + 1]), chord = dist(at(fr.positions, a), at(fr.positions, b));
        sides++; worstLong = Math.max(worstLong, chord - plane);
        if (plane - chord > 1e-6) folded++;
      }
      // the surface is still closed: copies of one closed vertex are one point
      const seen = new Map();
      let apart = 0;
      for (let v = 0; v < fr.nVertices; v++) { const c = fr.closedOf[v], p = at(fr.positions, v); if (seen.has(c)) apart = Math.max(apart, dist(p, seen.get(c))); else seen.set(c, p); }
      const cl = closure(fr);
      assert.equal(cl.bad, 0); assert.equal(cl.euler, 2);
      assert.ok(apart < 1e-6, `copies of a closed vertex ${apart} apart`);
      assert.ok(worstLong < 1e-6, 'no chord is longer than its length in the plane (the solid only folds)');
      for (let i = 0; i < fr.positions.length; i++) assert.ok(Number.isFinite(fr.positions[i]));
      return { folded, sides };
    };
    const on = count(true), off = count(false);
    rows.push(`L ${L.toFixed(3)} tw ${tw}: ${on.folded} of ${on.sides} sides cross a crease (grid as it comes: ${off.folded})`);
    assert.ok(on.folded <= 0.25 * off.folded && on.folded <= 0.01 * on.sides, rows[rows.length - 1]);
  }
});

test('two cold starts give identical positions', () => {
  for (const id of ['3333', '2223', '2222']) {
    const a = createSurfaceModel({ nVertices: 900 }), b = createSurfaceModel({ nVertices: 900 });
    // compared at rest: a cold start settles over several calls, cut by time; at rest it is a function of the state
    a.set(STATES[id]); rest(a); b.set(STATES[id]); rest(b);
    const fa = a.frame(0), fb = b.frame(0);
    assert.deepEqual(fa.positions, fb.positions);
    // and the same model set again, after it has been elsewhere
    a.update({ ...STATES[id], tw: 0.2 }, 2); a.set(STATES[id]); rest(a);
    assert.deepEqual(a.frame(0).positions, fb.positions);
    assert.deepEqual(a.frame(2).positions, b.frame(2).positions);
  }
});

test('update(): a small Twist step moves no vertex more than a few mesh cells, and the upper pillow turns against the lower', () => {
  const sm = createSurfaceModel({ nVertices: N }), st = STATES[3333];
  sm.set(st); rest(sm);
  const mesh = sm.mesh, cell = cellOf(mesh), before = Float64Array.from(sm.closed), v0 = sm.frame(0).version, c0 = sm.frame(0).cornersVersion;
  sm.update({ ...st, tw: 0.01 }, 4);
  let worst = 0;
  for (let v = 0; v < mesh.nVertices; v++) worst = Math.max(worst, dist(at(before, v), at(sm.closed, v)));
  assert.ok(worst < 3 * cell, `one step of 0.01 turn moved a vertex by ${worst.toFixed(4)} (cell ${cell.toFixed(4)})`);
  assert.ok(worst > 1e-6, 'and it did move');
  const f = sm.frame(0);
  assert.ok(f.cornersVersion > c0, 'the corners changed with the Twist');
  assert.equal(f.nVertices, sm.frame(2).nVertices);
  assert.ok(f.version >= v0);
  // a drag: 25 steps to a quarter turn, then rest; the seals end square to each other within a few degrees
  let stepWorst = 0, prev = Float64Array.from(sm.closed);
  for (let i = 2; i <= 25; i++) {
    sm.update({ ...st, tw: i / 100 }, 3);
    for (let v = 0; v < mesh.nVertices; v++) stepWorst = Math.max(stepWorst, dist(at(prev, v), at(sm.closed, v)));
    prev = Float64Array.from(sm.closed);
  }
  assert.ok(stepWorst < 3 * cell, `the worst step of the drag moved a vertex by ${stepWorst.toFixed(4)}`);
  for (let i = 0; i < 40; i++) sm.update({ ...st, tw: 0.25 }, 3);
  rest(sm);
  const fr = sm.frame(0), mk = markPoints(fr);
  const a = [mk[1][0] - mk[0][0], mk[1][1] - mk[0][1]], b = [mk[3][0] - mk[2][0], mk[3][1] - mk[2][1]];
  const ang = (Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]) * 180) / Math.PI;
  assert.ok(Math.abs(Math.abs(ang) - 90) < 12, `at a quarter turn the seals stand at ${ang.toFixed(1)} degrees seen from above`);
  assert.ok(ang > 0, 'the upper pillow turns counter-clockwise seen from above for Twist > 0');
  assert.ok(fr.stats.strainMean < 0.01, `mean stretch after the drag ${(100 * fr.stats.strainMean).toFixed(3)} %`);
  // Length: the neck's girth follows
  sm.update({ ...st, tw: 0.25, L: 2.2 }, 4);
  for (let i = 0; i < 20; i++) sm.update({ ...st, tw: 0.25, L: 2.2 }, 3);
  rest(sm);
  const loop = sm.frame(0).curves.find((c) => c.id === 'loop'), p = sm.frame(0).positions;
  let girth = 0;
  for (let i = 0; i < loop.chain.length; i++) girth += dist(at(p, loop.chain[i]), at(p, loop.chain[(i + 1) % loop.chain.length]));
  assert.ok(Math.abs(girth / 2.2 - 1) < 0.02, `the loop measures ${girth.toFixed(4)} on the mesh at Length 2.2`);
});

test('a jump of Length is caught up by the solver, never shown crossed, and at rest the grid is made for the new Length', () => {
  const sm = createSurfaceModel({ nVertices: N }), st = STATES[3333];
  sm.set(st); rest(sm);
  const grid0 = `${sm.mesh.nTheta}x${sm.mesh.nS}`;
  sm.update({ ...st, L: 7, tw: 0.3 }, 2);                       // far from the grid and the shape it has
  let fr = sm.frame(0);
  for (let i = 0; i < fr.positions.length; i++) assert.ok(Number.isFinite(fr.positions[i]));
  rest(sm);
  fr = sm.frame(0);
  assert.ok(Math.abs(sm.mesh.L - 7) < 1e-12 && Math.abs(sm.mesh.tw - 0.3) < 1e-12, `it stands at the numbers asked (${sm.mesh.L}, ${sm.mesh.tw})`);
  assert.notEqual(`${sm.mesh.nTheta}x${sm.mesh.nS}`, grid0, 'on a grid for the new Length');
  assert.ok(fr.stats.strainMean < 0.025, `mean stretch ${(100 * fr.stats.strainMean).toFixed(2)} % at rest`);
  assert.equal(closure(fr).euler, 2);
  assert.ok(!sm.solver.stats().crossed, 'the solver did not give up on a crossed surface');
  // a small step does not restart
  const r = sm.restarts;
  sm.update({ ...st, L: 6.9, tw: 0.3 }, 3); rest(sm);
  assert.equal(sm.restarts, r);
});

for (const id of ['3333', '2345', '2223', '2222']) {
  test(`${id}: a flip keeps the surface: each cone point stays within a mesh cell, the six tip distances within 5 %`, () => {
    const flat = id === '2222';
    for (const key of ['02|13', '03|12']) {
      const sm = createSurfaceModel({ nVertices: N }), st = STATES[id];
      sm.set(st);
      const f0 = sm.frame(0), old = markPoints(f0), cell = cellOf(sm.mesh), v0 = f0.version, c0 = f0.cornersVersion;
      const r = flip(st, key);
      const res = sm.flip(r.state, { invQ: r.invQ, before: st });
      assert.equal(res.cold, false, `${id} ${key}: the surface was carried, not started cold`);
      const T = res.turn, sh = res.shift;
      // a rotation
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        let d = 0;
        for (let k = 0; k < 3; k++) d += T[3 * i + k] * T[3 * j + k];
        assert.ok(Math.abs(d - (i === j ? 1 : 0)) < 1e-9);
      }
      const det = T[0] * (T[4] * T[8] - T[5] * T[7]) - T[1] * (T[3] * T[8] - T[5] * T[6]) + T[2] * (T[3] * T[7] - T[4] * T[6]);
      assert.ok(Math.abs(det - 1) < 1e-9, 'no reflection');
      const f1 = sm.frame(0), now = markPoints(f1);
      assert.ok(f1.version >= v0 && f1.cornersVersion > c0, 'the corners are the new cut\'s (the triangles may be the same ones)');
      for (let i = 0; i < f1.positions.length; i++) assert.ok(Number.isFinite(f1.positions[i]));
      const cl = closure(f1);
      assert.equal(cl.bad, 0); assert.equal(cl.euler, 2);
      // the outside is still the outside (the carry did not mirror the surface): the enclosed volume keeps its sign and size
      const vol0 = volumeOf(f0), vol1 = volumeOf(f1);
      if (flat) assert.ok(vol0 > -1e-9 && vol1 > -1e-9 && Math.abs(vol1 - vol0) < 1e-6, `volumes ${vol0}, ${vol1}`);
      else assert.ok(vol0 > 0 && vol1 > 0 && Math.abs(vol1 / vol0 - 1) < 0.15, `${id} ${key}: the volume went from ${vol0.toFixed(4)} to ${vol1.toFixed(4)}`);
      // nothing turns on the screen (his ask, 27 Nov 22:30): the flip hands out no turn, the hold takes the move up
      assert.ok(T.every((v, i) => Math.abs(v - (i % 4 === 0 ? 1 : 0)) < 1e-12) && sh.every((v) => v === 0), `${id} ${key}: no turn`);
      assert.ok(res.moved && res.moved.turn.length === 9, 'the move of the model\'s own frame is reported');
      // so each feature stays where it stood (undoing the identity turn: as the test read before the hold)
      let worst = 0;
      for (let f = 0; f < 4; f++) {
        const q = [now[f][0] - sh[0], now[f][1] - sh[1], now[f][2] - sh[2]];
        const back = [T[0] * q[0] + T[3] * q[1] + T[6] * q[2], T[1] * q[0] + T[4] * q[1] + T[7] * q[2], T[2] * q[0] + T[5] * q[1] + T[8] * q[2]];
        worst = Math.max(worst, dist(back, old[f]));
      }
      // (flat: exact up to the square root of rounding: a solid that should be flat comes out 1e-8 thick)
      assert.ok(worst < (flat ? 1e-6 : cell), `${id} ${key}: a cone point moved by ${worst.toExponential(2)} (cell ${cell.toFixed(4)})`);
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
        const d0 = dist(old[a], old[b]), d1 = dist(now[a], now[b]);
        assert.ok(Math.abs(d1 / d0 - 1) < (flat ? 1e-6 : 0.05), `${id} ${key}: the chord between features ${a} and ${b} went from ${d0.toFixed(4)} to ${d1.toFixed(4)}`);
      }
      // the new pose IN THE MODEL'S FRAME (the screen keeps the old one through the hold): first pair below, along y
      const hd = sm.hold, inModel = (w) => {
        if (!hd) return w;
        const a = w[0] - hd.t[0], b = w[1] - hd.t[1], c = w[2] - hd.t[2], R = hd.R;
        return [R[0] * a + R[3] * b + R[6] * c, R[1] * a + R[4] * b + R[7] * c, R[2] * a + R[5] * b + R[8] * c];
      };
      const nm = now.map(inModel);
      const p = r.state.perm, d = [nm[p[1]][0] - nm[p[0]][0], nm[p[1]][1] - nm[p[0]][1]];
      assert.ok(d[1] / Math.hypot(...d) > 0.995, 'the new first seal lies along y, seen from above');
      // the new first pair is below the new far pair (where the four tips lie in one plane, as after 3333's flip to
      // the diagonal pairing at Twist 0, they are all level with the loop: not above is all that can be asked)
      assert.ok(nm[p[0]][2] + nm[p[1]][2] <= nm[p[2]][2] + nm[p[3]][2] + 0.1 * f1.frame.radius, 'the new first pair is not above the far pair');
      if (!flat) assert.ok(f1.stats.strainMean < 0.012, `${id} ${key}: mean stretch after the flip ${(100 * f1.stats.strainMean).toFixed(3)} %`);
      // marks follow the features, colours follow the pairs of the new cut
      for (const m of f1.marks) { assert.equal(m.feature, p[m.slot]); assert.equal(m.id, 'PQRS'[m.feature]); }
    }
  });
}

test('flip and flip back returns the shape (cone points within two cells); a flip without its frames falls back to a cold start', () => {
  const sm = createSurfaceModel({ nVertices: N }), st = STATES[3333];
  sm.set(st);
  const old = markPoints(sm.frame(0)), cell = cellOf(sm.mesh);
  const r1 = flip(st, '03|12'), a = sm.flip(r1.state, { invQ: r1.invQ, before: st });
  const r2 = flip(r1.state, '01|23'), b = sm.flip(r2.state, { invQ: r2.invQ, before: r1.state });
  assert.equal(a.cold, false); assert.equal(b.cold, false);
  assert.ok(Math.abs(r2.state.L - st.L) < 1e-9 && Math.abs(r2.state.tw - st.tw) < 1e-9);
  const now = markPoints(sm.frame(0));
  // back in the old cut's pose up to the names within the pairs: compare the six distances and the pose of the first seal
  for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) assert.ok(Math.abs(dist(now[x], now[y]) / dist(old[x], old[y]) - 1) < 0.05);
  const A = new Float64Array(12), B = new Float64Array(12);
  for (let f = 0; f < 4; f++) { A.set(old[f], 3 * f); B.set(now[f], 3 * f); }
  const fit = fitRigid(4, A, B, null);
  let worst = 0;
  for (let f = 0; f < 4; f++) {
    const o = old[f], q = [fit.R[0] * o[0] + fit.R[1] * o[1] + fit.R[2] * o[2] + fit.t[0], fit.R[3] * o[0] + fit.R[4] * o[1] + fit.R[5] * o[2] + fit.t[1], fit.R[6] * o[0] + fit.R[7] * o[1] + fit.R[8] * o[2] + fit.t[2]];
    worst = Math.max(worst, dist(q, now[f]));
  }
  assert.ok(worst < 2 * cell, `after there and back the tips are ${worst.toFixed(4)} off (cell ${cell.toFixed(4)})`);
  // no frames, or frames of another state: a cold start, the identity
  const c = sm.flip(r1.state, {});
  assert.equal(c.cold, true); assert.deepEqual(c.turn, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const d = sm.flip(r2.state, { invQ: r2.invQ, before: { ...r1.state, orders: [2, 3, 5, 4] } });
  assert.equal(d.cold, true);
  // a `before` a slider step away from where the model stands (a frame the page skipped): made up, then carried
  sm.set(st);
  const near = { ...st, tw: 0.004 }, r3 = flip(near, '02|13'), e = sm.flip(r3.state, { invQ: r3.invQ, before: near });
  assert.equal(e.cold, false);
  assert.ok(Math.abs(sm.state.L - r3.state.L) < 1e-12 && Math.abs(sm.state.tw - r3.state.tw) < 1e-12);
  const fr = sm.frame(0);
  for (let i = 0; i < fr.positions.length; i++) assert.ok(Number.isFinite(fr.positions[i]));
});

test('fitRigid finds any rotation, large ones too, and never a reflection', () => {
  const pts = [[0.3, -1.2, 0.4], [1.1, 0.2, -0.7], [-0.6, 0.9, 1.3], [0.2, 0.1, -1.5], [-1.4, -0.3, 0.2]];
  for (const [axis, angle] of [[[0, 0, 1], 0.3], [[1, 0, 0], Math.PI], [[0.6, 0, 0.8], 3.0], [[0, 1, 0], -2.2], [[0.36, 0.48, 0.8], 1e-7]]) {
    const [x, y, z] = axis, c = Math.cos(angle), s = Math.sin(angle), k = 1 - c;
    const R = [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k], t = [0.5, -2, 1];
    const A = new Float64Array(15), B = new Float64Array(15);
    pts.forEach((p, i) => { A.set(p, 3 * i); B.set([R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + t[0], R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + t[1], R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + t[2]], 3 * i); });
    const fit = fitRigid(5, A, B, null);
    for (let i = 0; i < 9; i++) assert.ok(Math.abs(fit.R[i] - R[i]) < 1e-9, `rotation by ${angle} about ${axis}`);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(fit.t[i] - t[i]) < 1e-9);
  }
});

test('the solver behind the PROTO-SPEC interface: set, settle, update, positions, mesh, adoptPositions, stats', () => {
  const g = P.suggestGrid([3, 3, 3, 3], 2, 900), surf = createSurface({ nTheta: g.nTheta, nS: g.nS });
  const toRest = (s) => { for (let i = 0; i < 4000 && s.settling; i++) s.settle(50); };
  surf.set([3, 3, 3, 3], 2, 0.125); toRest(surf);
  const m = surf.mesh, s = surf.stats();
  assert.equal(surf.positions.length, 3 * m.nVertices);
  assert.ok(s.strainMean < 0.015 && s.strainMax < 0.25, `strain mean ${s.strainMean}, max ${s.strainMax}`);
  assert.equal(s.crossed, false);
  const first = Float64Array.from(surf.positions);
  // deterministic: the same numbers settled in other slices of time give the same shape at rest
  const again = createSurface({ nTheta: g.nTheta, nS: g.nS });
  again.set([3, 3, 3, 3], 2, 0.125, 5); for (let i = 0; i < 20000 && again.settling; i++) again.settle(1);
  assert.deepEqual(Float64Array.from(again.positions), first, 'deterministic');
  surf.update(2.05, 0.13, 3); toRest(surf);
  assert.equal(surf.mesh.L, 2.05); assert.equal(surf.mesh.tw, 0.13);
  for (let i = 0; i < surf.positions.length; i++) assert.ok(Number.isFinite(surf.positions[i]));
  // adoptPositions keeps what it is given (a flip's carry) and settles gently from there
  surf.adoptPositions(first, 0);
  let moved = 0;
  for (let i = 0; i < first.length; i++) moved = Math.max(moved, Math.abs(surf.positions[i] - first[i]));
  assert.ok(moved < 0.05, `adoptPositions moved a coordinate by ${moved.toFixed(4)}`);
  toRest(surf);
  for (let i = 0; i < surf.positions.length; i++) assert.ok(Number.isFinite(surf.positions[i]));
  assert.throws(() => surf.adoptPositions(new Float64Array(3)));
  assert.throws(() => createSurface().set([2, 2, 2, 2], 1, 0), 'the flat orbifold is the page\'s exact module, not this solver');
});
