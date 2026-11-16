// test/tiling3d.test.js — src/tiling3d.js: the pattern in the 3D pane (15 Nov 2026), the copies of the tile made and
// gathered as the plane makes them. All 17 groups, every preset, straight and wavy.
//   the patch     a round patch of the plan's copies about the tile, closed under parents, bounded
//   the mesh      K copies of one flat mesh of the tile: paper coordinates per vertex, no tint (every copy is the paper)
//   the motions   every copy starts ON its parent and lands ON its place, in the plane; on its way it is moved RIGIDLY
//                 (distances kept: a motion of space), its view from above is exactly the plane's card (copyState.A);
//                 a reflection or a glide stays UNDER the paper (z <= 0, below it half way), a turn or a slide OVER it
//                 (z >= 0, a hair above); a mirror image lands with its back up
//   the picture   mapTiling3D: the tile alone at u = 0, every copy flat at u = 1, nothing jumps in between, a copy that
//                 is not made yet is a point; the frame grows with what is shown
//   the lines     app.js tilingLines: the copies in the picture, under the tile's own edges
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID } from '../src/groups.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { replicationPlan, copyState } from '../src/replicate.js';
import { buildTiling3D, mapTiling3D, tilingPatch, copyPlace, placePoint, T3_LIMITS, OVER, START_S } from '../src/tiling3d.js';
import { buildScene, mapScene, tilingLines, WIDTHS, patternLabelFade, PATTERN_LABELS } from '../src/app.js';

/** The plan as the plane makes it for a laptop window centred on the tile (test/replicate.test.js setup). */
function planOf(group, D) {
  const seedA = D.seedActual;
  let rt = 0;
  for (const o of D.outline(Math.sqrt(group.domainArea) / 32)) {
    for (let i = 0; i < o.pts.length; i += 2) rt = Math.max(rt, Math.hypot(o.pts[i] - seedA[0], o.pts[i + 1] - seedA[1]));
  }
  const hw = group.viewHalf * 1.4, hh = group.viewHalf;
  const win = { cx: seedA[0], cy: seedA[1], hw, hh };
  const region = { cx: seedA[0], cy: seedA[1], hw: hw + 0.6 * group.viewHalf, hh: hh + 0.6 * group.viewHalf };
  return replicationPlan(group, D, { seedA, reach: rt, region, window: win });
}
function* tiles() {
  for (const group of GROUPS) {
    for (let pi = 0; pi < group.presets.length; pi++) {
      for (const amp of group.fold === 'disc' ? [0] : [0, 1]) {
        const p = group.presets[pi];
        const D = buildDomain(group, { seed: p.seed, metric: p.metric, warp: makeWarp(group, amp) });
        yield { group, D, plan: planOf(group, D), tag: `${group.id} preset ${pi} amp ${amp}` };
      }
    }
  }
}
const lin = (g, x, y) => [g.a * x + g.b * y + g.tx, g.c * x + g.d * y + g.ty];

test('the patch: the tile and its copies in a round patch, every copy with its parent, never more than the limit', () => {
  let patches = 0, most = 0;
  for (const { group, D, plan, tag } of tiles()) {
    const T = buildTiling3D(group, D, plan);
    const idx = new Set(T.copies.map((c) => c.index));
    assert.equal(T.copies[0].index, 0, `${tag}: the tile first`);
    assert.ok(T.copies.length >= 3, `${tag}: ${T.copies.length} copies`);
    assert.ok(T.copies.length <= T3_LIMITS.copies + 1, `${tag}: ${T.copies.length} copies`);
    for (const c of T.copies) {
      if (c.index === 0) continue;
      assert.ok(idx.has(c.parent), `${tag}: copy ${c.index} is shown without its parent`);
      assert.ok(c.phase >= 0 && c.depth <= plan.waves, `${tag}: copy ${c.index} is one of the window's`);
      const q = lin(c.g, T.centre[0], T.centre[1]);
      assert.ok(Math.hypot(q[0] - T.centre[0], q[1] - T.centre[1]) <= T3_LIMITS.reach * T.radius + 1e-9, `${tag}: copy ${c.index} lies outside the patch`);
    }
    // every side pairing's copy (the first layer) is in the picture: they are the tile's own neighbours
    for (const c of plan.copies) if (c.depth === 1 && c.phase >= 0) assert.ok(idx.has(c.index), `${tag}: the neighbour ${c.index} is missing`);
    assert.deepEqual(tilingPatch(plan, T.centre, T.radius).map((c) => c.index), T.copies.map((c) => c.index), `${tag}: the same patch again`);
    patches++; most = Math.max(most, T.copies.length);
  }
  assert.ok(patches >= 17 && most > 20, `${patches} patches, the largest of ${most} copies`);
});

test('the mesh: K copies of one flat mesh of the tile — paper coordinates on every vertex, no tint: every copy is the paper itself', () => {
  for (const { group, D, plan, tag } of tiles()) {
    const T = buildTiling3D(group, D, plan), K = T.copies.length, nv = T.nv, mt = T.m / K;
    assert.ok(Number.isInteger(mt) && T.n === K * nv && T.pos.length === 3 * T.n && T.uv.length === 2 * T.n && !('tint' in T) && T.tri.length === 3 * T.m, tag);
    assert.ok(T.m <= 20000, `${tag}: ${T.m} triangles (the renderer sorts at most 20k)`);
    for (let k = 0; k < K; k++) {
      for (let i = 3 * k * mt; i < 3 * (k + 1) * mt; i++) assert.ok(T.tri[i] >= k * nv && T.tri[i] < (k + 1) * nv, `${tag}: a triangle of copy ${k} reaches into another`);
      for (let v = 0; v < nv; v += Math.max(1, nv >> 4)) {
        assert.equal(T.uv[2 * (k * nv + v)], T.xy[2 * v]); assert.equal(T.uv[2 * (k * nv + v) + 1], T.xy[2 * v + 1]);
      }
    }
    // the flat mesh covers the tile: its area is the tile's
    let area = 0;
    for (let i = 0; i < 3 * mt; i += 3) {
      const a = T.tri[i], b = T.tri[i + 1], c = T.tri[i + 2];
      area += 0.5 * ((T.xy[2 * b] - T.xy[2 * a]) * (T.xy[2 * c + 1] - T.xy[2 * a + 1]) - (T.xy[2 * c] - T.xy[2 * a]) * (T.xy[2 * b + 1] - T.xy[2 * a + 1]));
    }
    assert.ok(Math.abs(area - group.domainArea) < 0.012 * group.domainArea, `${tag}: the mesh's area ${area} for a tile of ${group.domainArea}`);
  }
});

test('the motions: a copy starts on its parent and lands on its place; on its way it is moved rigidly, a flip under the paper, a turn or a slide over it', () => {
  const seen = { reflection: 0, glide: 0, rotation: 0, translation: 0 };
  let worstRigid = 0, deepest = 0;
  for (const { group, D, plan, tag } of tiles()) {
    const T = buildTiling3D(group, D, plan), size = T.size, xy = T.xy, nv = T.nv;
    // a handful of tile points: the mesh's own vertices
    const pts = [];
    for (let v = 0; v < nv; v += Math.max(1, Math.floor(nv / 9))) pts.push([xy[2 * v], xy[2 * v + 1]]);
    const P = (pl, q) => placePoint(pl, q[0], q[1], [0, 0, 0]);
    for (const c of T.copies) {
      if (c.index === 0) continue;
      const par = plan.copies[c.parent], kind = c.motion.kind, label = `${tag}: copy ${c.index} (${kind})`;
      assert.equal(copyPlace(plan, c, c.t0 - 1e-6, size, T.dipOf), null, `${label} is not made before its time`);
      assert.equal(copyPlace(plan, c, c.t0, size, T.dipOf), null, `${label} is in the picture before it has left its parent`);
      // it enters the picture ON its parent (within the hair START_S of its way), and ends on its own place, in the plane
      const x0 = Math.cbrt(START_S / 10) * 1.02, p0 = copyPlace(plan, c, c.t0 + x0 * (c.t1 - c.t0), size, T.dipOf), p1 = copyPlace(plan, c, c.t1, size, T.dipOf);
      assert.ok(p0 && p0.s > START_S && p0.s < 1.3 * START_S, `${label} enters at s = ${p0 && p0.s}`);
      for (const q of pts) {
        const a = P(p0, q), wantA = lin(par.g, q[0], q[1]), b = P(p1, q), wantB = lin(c.g, q[0], q[1]);
        assert.ok(Math.hypot(a[0] - wantA[0], a[1] - wantA[1], a[2]) < 0.02 * size, `${label} does not start on its parent (${Math.hypot(a[0] - wantA[0], a[1] - wantA[1], a[2]) / size} tile sizes off)`);
        assert.ok(Math.hypot(b[0] - wantB[0], b[1] - wantB[1], b[2]) < 1e-9 * size, `${label} does not land on its place`);
      }
      assert.equal(p1.kind, 'rest');
      let low = 0, high = 0;
      for (let i = 1; i < 24; i++) {
        const tau = c.t0 + ((c.t1 - c.t0) * i) / 24, pl = copyPlace(plan, c, tau, size, T.dipOf), st = copyState(plan, c, tau);
        assert.equal(pl.kind, kind === 'reflection' || kind === 'glide' ? 'under' : 'over', label);
        const img = pts.map((q) => P(pl, q));
        // seen from above it is the plane's card, exactly
        pts.forEach((q, k) => { const w = lin(st.A, q[0], q[1]); assert.ok(Math.hypot(img[k][0] - w[0], img[k][1] - w[1]) < 1e-12 * size + 1e-15, `${label}: its view from above is not the plane's card`); });
        // rigid: every distance kept (to 1e-6 tile sizes: the mesh's points are single precision, and one that sits
        // on a mirror line a rounding error to the wrong side of it is turned the other way about the line)
        for (let k = 1; k < pts.length; k++) {
          const d0 = Math.hypot(pts[k][0] - pts[0][0], pts[k][1] - pts[0][1]), d1 = Math.hypot(img[k][0] - img[0][0], img[k][1] - img[0][1], img[k][2] - img[0][2]);
          worstRigid = Math.max(worstRigid, Math.abs(d1 - d0) / size);
          assert.ok(Math.abs(d1 - d0) < 1e-6 * size, `${label} is stretched at ${i}/24: ${d0} -> ${d1}`);
        }
        for (const p of img) { low = Math.min(low, p[2]); high = Math.max(high, p[2]); }
      }
      if (kind === 'reflection' || kind === 'glide') {
        assert.ok(high <= 1e-9 * size, `${label} rises ${high / size} tile sizes above the paper`);
        assert.ok(low < -0.05 * size, `${label} never goes under the paper (${low / size})`);
        deepest = Math.min(deepest, low / size);
      } else {
        assert.ok(low >= 0, `${label} dips under the paper`);
        assert.ok(high > 0.5 * OVER * size && high < 3 * OVER * size, `${label} is lifted ${high / size} tile sizes`);
      }
      seen[kind]++;
    }
  }
  assert.ok(seen.reflection > 100 && seen.glide > 20 && seen.rotation > 100 && seen.translation > 100, JSON.stringify(seen));
  console.log(`copies: ${JSON.stringify(seen)}; distances kept to ${worstRigid.toExponential(1)} tile sizes; the deepest flip ${deepest.toFixed(2)} tile sizes under the paper`);
});

test('a mirror image lands with its back up: its triangles run clockwise seen from above; a copy of the tile\'s own hand counter-clockwise', () => {
  let backs = 0, fronts = 0;
  for (const { group, D, plan, tag } of tiles()) {
    const T = mapTiling3D(buildTiling3D(group, D, plan), 1), K = T.copies.length, mt = T.m / K;
    for (let k = 0; k < K; k++) {
      let area = 0;
      for (let i = 3 * k * mt; i < 3 * (k + 1) * mt; i += 3) {
        const a = 3 * T.tri[i], b = 3 * T.tri[i + 1], c = 3 * T.tri[i + 2];
        area += (T.pos[b] - T.pos[a]) * (T.pos[c + 1] - T.pos[a + 1]) - (T.pos[c] - T.pos[a]) * (T.pos[b + 1] - T.pos[a + 1]);
      }
      const det = T.copies[k].index === 0 ? 1 : T.copies[k].det;
      assert.ok(det * area > 0, `${tag}: copy ${T.copies[k].index} (det ${det}) lies with the wrong side up`);
      if (det < 0) backs++; else fronts++;
    }
  }
  assert.ok(backs > 200 && fronts > 400, `${backs} with the back up, ${fronts} with the front up`);
});

test('the picture: the tile alone at u = 0, every copy flat on its place at u = 1; in between nothing jumps, and a copy not yet made is a point', () => {
  let worstStep = 0, worstFrame = 0;
  for (const { group, D, plan, tag } of tiles()) {
    const T = buildTiling3D(group, D, plan), nv = T.nv, K = T.copies.length, size = T.size;
    mapTiling3D(T, 0);
    assert.equal(T.shown, 1, `${tag}: at u = 0 the tile alone`);
    for (let v = 0; v < nv; v++) assert.ok(T.pos[3 * v] === Math.fround(T.xy[2 * v]) && T.pos[3 * v + 1] === Math.fround(T.xy[2 * v + 1]) && T.pos[3 * v + 2] === 0, `${tag}: the tile where it is`);
    for (let k = 1; k < K; k++) for (let v = 1; v < nv; v++) {
      const o = 3 * (k * nv + v), o0 = 3 * k * nv;
      assert.ok(T.pos[o] === T.pos[o0] && T.pos[o + 1] === T.pos[o0 + 1] && T.pos[o + 2] === 0, `${tag}: copy ${k}, not made yet, is not a point`);
    }
    assert.ok(Math.abs(T.frame.radius - T.radius) < 1e-6 * size && Math.hypot(T.frame.center[0] - T.centre[0], T.frame.center[1] - T.centre[1], T.frame.center[2]) < 1e-6 * size, `${tag}: the frame at u = 0 is the tile's`);
    const r0 = T.frame.radius;
    // 1200 steps: positions and frame. No jump: a copy's largest step is at most 4 times its mean step (the easing
    // alone gives 1.9; a later layer's half-turn about a far centre is fast, but it is even)
    const N = 1200;
    let prev = Float32Array.from(T.pos), prevShown = T.copies.map((c, k) => k === 0), prevFrame = T.frame;
    const sum = new Float64Array(K), cnt = new Float64Array(K), top = new Float64Array(K);
    for (let i = 1; i <= N; i++) {
      mapTiling3D(T, i / N);
      const tau = (i / N) * plan.T, shown = T.copies.map((c) => c.index === 0 || copyPlace(plan, c, tau, size, T.dipOf) !== null);
      for (let k = 0; k < K; k++) {
        if (!shown[k] || !prevShown[k]) continue;                 // (a copy appears ON its parent: nothing is seen to jump)
        let d = 0;
        for (let v = 0; v < nv; v += 7) {
          const o = 3 * (k * nv + v);
          d = Math.max(d, Math.hypot(T.pos[o] - prev[o], T.pos[o + 1] - prev[o + 1], T.pos[o + 2] - prev[o + 2]) / size);
        }
        if (d > 0) { sum[k] += d; cnt[k]++; if (d > top[k]) top[k] = d; }
        if (d > worstStep) worstStep = d;
      }
      for (let j = 0; j < T.pos.length; j += 97) assert.ok(Number.isFinite(T.pos[j]), `${tag}: a position is not finite at u = ${i / N}`);
      const df = (Math.abs(T.frame.radius - prevFrame.radius) + Math.hypot(T.frame.center[0] - prevFrame.center[0], T.frame.center[1] - prevFrame.center[1], T.frame.center[2] - prevFrame.center[2])) / size;
      if (df > worstFrame) worstFrame = df;
      assert.ok(df < 0.3, `${tag}: the frame jumps ${df} tile sizes at u = ${i / N}`);
      prev = Float32Array.from(T.pos); prevShown = shown; prevFrame = T.frame;
    }
    for (let k = 1; k < K; k++) {
      assert.ok(cnt[k] >= 8, `${tag}: copy ${T.copies[k].index} was seen moving in ${cnt[k]} steps only`);
      assert.ok(top[k] <= 4 * (sum[k] / cnt[k]), `${tag}: copy ${T.copies[k].index} jumps: a step of ${top[k]} tile sizes, the mean ${sum[k] / cnt[k]}`);
    }
    assert.equal(T.shown, K, `${tag}: at u = 1 every copy`);
    for (let k = 0; k < K; k++) {
      const g = T.copies[k].g;
      for (let v = 0; v < nv; v += 5) {
        const w = lin(g, T.xy[2 * v], T.xy[2 * v + 1]), o = 3 * (k * nv + v);
        assert.ok(Math.hypot(T.pos[o] - w[0], T.pos[o + 1] - w[1]) < 1e-5 * size && T.pos[o + 2] === 0, `${tag}: copy ${T.copies[k].index} is not flat on its place at u = 1`);
      }
    }
    // (the copies' centres lie within `reach` tile radii and each reaches one radius further; the frame is the sphere
    // about the centre of their box, which is a little more than the smallest one)
    assert.ok(T.frame.radius > 1.5 * r0 && T.frame.radius < (T3_LIMITS.reach + 1.6) * T.radius, `${tag}: the frame at u = 1 holds the patch (${T.frame.radius / T.radius} tile radii)`);
  }
  console.log(`the largest step of a point over 1/1200 of the tiling: ${worstStep.toFixed(3)} tile sizes; of the frame: ${worstFrame.toFixed(3)}`);
});

test('the lines of the pattern: the copies in the picture under the tile\'s own edges; a copy under the paper does not show through it; labels fade as the camera backs off', () => {
  for (const id of ['333', '*632', '**', 'xx', '2*22']) {
    const g = BY_ID[id], p = g.presets[0];
    const scene = buildScene(g, { seed: p.seed, metric: p.metric, anchor: p.seed, pattern: 'checker' });
    mapScene(scene, 0);
    const plan = planOf(g, scene.domain), T = buildTiling3D(g, scene.domain, plan, { edges: scene.edges });
    assert.equal(T.outlines.length, (T.copies.length - 1) * scene.edges.length, `${id}: an outline per edge per copy`);
    // nothing but the tile at u = 0: its edges, and the creases of the fold to come
    mapTiling3D(T, 0);
    let lines = tilingLines(scene, T, 0, 1);
    assert.equal(lines.filter((l) => l.width === WIDTHS.edge).length, scene.edges.length, `${id}: the tile's own edges`);
    assert.equal(lines.filter((l) => l.width !== WIDTHS.edge && !l.dashed).length, 0, `${id}: no copy at u = 0`);
    // the first copy on its way
    const ph = plan.phases[0], u = (ph.t0 + 0.5 * (ph.t1 - ph.t0)) / plan.T;
    mapTiling3D(T, u);
    lines = tilingLines(scene, T, u, 1);
    const moving = T.outlines.filter((L) => L.shown && L.moving);
    assert.ok(moving.length >= scene.edges.length && moving.every((L) => L.depth === 1), `${id}: a copy of the first layer on its way`);
    const flip = moving[0].under;
    assert.equal(flip, /reflection|glide/.test(ph.text), `${id}: ${ph.text}`);
    const copyLines = lines.filter((l) => l.width !== WIDTHS.edge && !l.dashed);
    assert.equal(copyLines.length, T.outlines.filter((L) => L.shown).length);
    if (flip) assert.ok(copyLines.every((l) => l.xray === 0), `${id}: under the paper, hidden by it`);
    else assert.ok(copyLines.every((l) => l.xray > 0), `${id}: over the paper`);
    assert.ok(lines.slice(-scene.edges.length).every((l) => l.width === WIDTHS.edge), `${id}: the tile's edges are drawn last, on top`);
    for (const l of lines) for (let i = 0; i < l.points.length; i++) assert.ok(Number.isFinite(l.points[i]), `${id}: a line point is not finite`);
    // every copy landed: the creases are gone, every outline thin
    mapTiling3D(T, 1);
    lines = tilingLines(scene, T, 1, 1);
    assert.equal(lines.filter((l) => l.dashed).length, 0, `${id}: no crease in the pattern`);
    assert.equal(lines.length, T.outlines.length + scene.edges.length);
  }
  assert.equal(patternLabelFade(1), 1); assert.equal(patternLabelFade(PATTERN_LABELS[0]), 1); assert.equal(patternLabelFade(PATTERN_LABELS[1]), 0); assert.equal(patternLabelFade(9), 0);
  let prev = 1;
  for (let z = 1; z <= 4; z += 0.01) { const a = patternLabelFade(z); assert.ok(a <= prev + 1e-12 && prev - a < 0.03, `the labels fade smoothly at ${z}`); prev = a; }
});
