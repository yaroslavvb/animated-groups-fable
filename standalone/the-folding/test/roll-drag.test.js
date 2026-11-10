// test/roll-drag.test.js — the rolls (o, **, *x, xx) as the app plays them for a DRAGGED cut: opts.anchor = the
// preset's anchor (SPEC 7, 8 C3), the seed anywhere in the plane's window (the round-4 roll verification, findings 1,
// 3, 4 and 5: qa/verify-rolls/r4; the construction: THE ANCHOR at the top of src/folds/roll.js).
//   1. the whirl: the sheet slides round the shape by at most half a turn in every direction where it slides (the
//      ring of o, xx, *x; the tube of o, **), whatever the seed; xx and *x use glide and mirror images for it
//      (params.flip), and o, *x, xx roll onto the copy a + v of the anchor that fold.anchorImage reports;
//   2. smooth: per type, the largest step and second difference per 1/200 of t (test/folds.test.js's measure) stay
//      within bounds set from a sweep of the window (dev/roll5/probe.mjs: o 0.046 / 0.0029, ** 0.049 / 0.0039,
//      *x 0.042 / 0.0016, xx 0.044 / 0.0029 tile sizes; the bounds about 20 % above), with the cases the verifier
//      filmed among the seeds; finite throughout, on or above the plane;
//   3. switches: where nothing slides, a drag of the cut changes nothing: xx across a glide axis at every t, o and xx
//      along in stage 1, *x and ** across any mirror once the turn over is done (t >= flap);
//   4. o: the tube of stage 1 closes on top (its seam in the upper half at the inner stop) for every seed;
//   5. **: fold.mirroredAt(t), the share by which the surface colours are swapped: 0 until the page nears edge-on,
//      1 after, monotone; 0 throughout for a tile that does not turn over; no other roll swaps colours.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BY_ID, latticeCoords, contains } from '../src/groups.js';
import { iso, det } from '../src/geom.js';
import { makeWarp, buildDomain } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import createFold, { STAGE } from '../src/folds/roll.js';
import { VIEW0 } from '../src/folds/hinge.js';

const IDS = ['o', '**', '*x', 'xx'];
const SEEDS = Math.max(10, +process.env.ROLL_DRAG_SEEDS || 10);
// largest step / second difference per 1/200 of t, tile sizes (anchored, the window; v1's are in test/folds.test.js)
const BOUND = { o: [0.058, 0.0036], '**': [0.06, 0.0047], '*x': [0.053, 0.002], xx: [0.055, 0.0036] };
// the cases of the verifier's films (qa/verify-rolls/r4/drag-*.png)
const FILMED = { o: [[0.6, 1.7], [0.82, 0.78]], '**': [[0.9, 0.62], [1.45, 0.62]], '*x': [[0.85, 0.4], [1.76, 0.17], [1.2, -0.75]], xx: [[0.1, 2.3], [1.262, 2.192]] };

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dist3 = (u, w) => Math.hypot(u[0] - w[0], u[1] - w[1], u[2] - w[2]);
const anchorOf = (g, i = 0) => (g.presets[i].anchor || g.presets[i].seed).slice();
const windowSeeds = (g, n, salt) => {
  const rnd = prng(31337 + 101 * IDS.indexOf(g.id) + salt), out = [];
  for (let k = 0; k < n; k++) out.push([g.center[0] + (2 * rnd() - 1) * g.viewHalf, g.center[1] + (2 * rnd() - 1) * g.viewHalf]);
  return out;
};
function fold(g, seed, { amp = 0, anchor = anchorOf(g), density = 20, preset = 0 } = {}) {
  const domain = buildDomain(g, { seed, metric: g.presets[preset].metric, warp: makeWarp(g, amp) });
  const mesh = buildMesh(g, domain, { density });
  return { domain, mesh, fold: createFold(g, domain, mesh, { anchor, density: false }), size: Math.sqrt(g.domainArea) };
}
/** The mirrors of ** and *x as { nx, ny, w } (n.x = k w), from the group data (groupdata/roll.js: through the origin). */
const mirrorsOf = (g) => (g.id === '**' ? { nx: 1, ny: 0, w: g.e1[0] / 2 } : g.id === '*x' ? { nx: 0, ny: 1, w: Math.abs(g.e2[1]) } : null);
const stripOf = (S, x, y) => Math.floor((x * S.nx + y * S.ny) / S.w);

// ---------------------------------------------------------------------------------------------------------------
// 1. the whirl
// ---------------------------------------------------------------------------------------------------------------

test('drag 1: the sheet slides round the shape by at most half a turn, whatever the seed (o, *x, xx: images of the anchor under glides and mirrors too)', (tc) => {
  const report = [];
  for (const id of IDS) {
    const g = BY_ID[id], a = anchorOf(g), size = Math.sqrt(g.domainArea);
    let worst = 0, flips = 0, n = 0;
    for (const seed of windowSeeds(g, 400, 1)) {
      const { domain, fold: f } = fold(g, seed, { density: 6 });
      const p = domain.seedActual, im = f.anchorImage, P = f.params;
      assert.ok(im && f.anchor && f.anchor[0] === a[0] && f.anchor[1] === a[1], `${id} seed ${seed}: anchor and its image are reported`);
      const off = [p[0] - im[0], p[1] - im[1]];                 // the tile's centre from the copy of the anchor it rolls onto
      const along = (u) => off[0] * u[0] + off[1] * u[1];
      let turns;                                                // the slides, in turns
      if (id === 'o') {
        const lc = latticeCoords(g, off[0], off[1]);            // the closed torus is torus(2 pi lattice coordinates)
        turns = [lc[0], lc[1]];
      } else if (id === '**') turns = [along(P.roll) / P.period];
      else if (id === '*x') turns = [along(P.along) / P.glide];
      else turns = [along(P.axis) / P.glide];
      for (const s of turns) worst = Math.max(worst, Math.abs(s));
      for (const s of turns) assert.ok(Math.abs(s) <= 0.5 + 1e-9, `${id} seed (${seed.map((v) => v.toFixed(4))}): slides ${(360 * s).toFixed(1)} degrees`);
      // the copy of the anchor is a group image of it (o, xx, *x: a + v; flip exactly when tau_v is not in G)
      if (id !== '**') {
        const v = [im[0] - a[0], im[1] - a[1]], inG = contains(g, iso(1, 0, 0, 1, v[0], v[1]));
        assert.equal(!!P.flip, !inG && id !== 'o', `${id} seed ${seed}: params.flip ${P.flip} for v = ${v}`);
        if (P.flip) flips++;
        // for *x, a + v lies in the seed's strip; for xx and o nothing more is asked
        if (id === '*x') { const S = mirrorsOf(g); assert.equal(stripOf(S, im[0], im[1]), stripOf(S, domain.seed[0], domain.seed[1]), `*x seed ${seed}: a + v in the seed's strip`); }
      }
      n++;
    }
    if (id === 'xx' || id === '*x') assert.ok(flips > n / 4, `${id}: ${flips} of ${n} tiles roll onto a glide or mirror image`);
    report.push(`${id} ${(360 * worst).toFixed(0)} degrees`);
    void size;
  }
  tc.diagnostic(`largest slide over 400 seeds: ${report.join(', ')}`);
});

// ---------------------------------------------------------------------------------------------------------------
// 2. smooth, finite, upward
// ---------------------------------------------------------------------------------------------------------------

const motion = {};
for (const id of IDS) {
  test(`drag 2 (${id}): the anchored motion of dragged cuts is smooth — step <= ${BOUND[id][0]}, second difference <= ${BOUND[id][1]} tile sizes per 1/200 — finite, on or above the plane`, () => {
    const g = BY_ID[id], seeds = [...FILMED[id], ...windowSeeds(g, SEEDS, 2)];
    let worstStep = 0, worstBend = 0, minZ = Infinity, at = '';
    const o = [0, 0, 0];
    for (const seed of seeds) {
      for (const amp of [0, 1]) {
        const { mesh: M, fold: f, size } = fold(g, seed, { amp });
        const pts = [];
        for (const b of M.boundary) for (let j = 0; j < b.pts.length; j += 4) pts.push(b.pts[j], b.pts[j + 1]);
        for (let v = 0; v < M.n; v += Math.max(1, Math.floor(M.n / 250))) pts.push(M.xy[2 * v], M.xy[2 * v + 1]);
        const np = pts.length / 2;
        const pos = (t) => { const F = f.at(t), P = new Float64Array(3 * np); for (let i = 0; i < np; i++) { F(pts[2 * i], pts[2 * i + 1], 0, o); P[3 * i] = o[0]; P[3 * i + 1] = o[1]; P[3 * i + 2] = o[2]; } return P; };
        let A = pos(0), B = null;
        for (let k = 1; k <= 200; k++) {
          const C = pos(k / 200);
          let s = 0, b = 0;
          for (let i = 0; i < 3 * np; i += 3) {
            assert.ok(Number.isFinite(C[i] + C[i + 1] + C[i + 2]), `${id} seed ${seed} amp ${amp}: not finite at t = ${k / 200}`);
            s = Math.max(s, Math.hypot(C[i] - A[i], C[i + 1] - A[i + 1], C[i + 2] - A[i + 2]));
            if (B) b = Math.max(b, Math.hypot(C[i] - 2 * A[i] + B[i], C[i + 1] - 2 * A[i + 1] + B[i + 1], C[i + 2] - 2 * A[i + 2] + B[i + 2]));
            minZ = Math.min(minZ, C[i + 2] / size);
          }
          if (s / size > worstStep) { worstStep = s / size; at = `seed (${seed.map((v) => v.toFixed(3))}) amp ${amp} t ${k / 200}`; }
          worstBend = Math.max(worstBend, b / size);
          B = A; A = C;
        }
      }
    }
    motion[id] = { worstStep, worstBend, minZ };
    assert.ok(worstStep <= BOUND[id][0], `${id}: a step of 1/200 moves a point ${worstStep.toFixed(4)} tile sizes (${at})`);
    assert.ok(worstBend <= BOUND[id][1], `${id}: second difference ${worstBend.toFixed(5)} tile sizes per 1/200`);
    assert.ok(minZ > -1e-6, `${id}: dips to z = ${minZ} tile sizes`);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// 3. switches that change nothing
// ---------------------------------------------------------------------------------------------------------------

/** Two seeds a hair either side of the point q along the unit vector u, their folds, and points of both tiles near q. */
function straddle(g, q, u, { h = 1e-7, density = 16 } = {}) {
  const A = fold(g, [q[0] - h * u[0], q[1] - h * u[1]], { density }), B = fold(g, [q[0] + h * u[0], q[1] + h * u[1]], { density });
  const pts = [];
  const size = A.size;
  for (const [dx, dy] of [[0, 0], [0.12, 0.05], [-0.1, 0.08], [0.06, -0.12], [-0.08, -0.07]]) {
    const x = q[0] + dx * size, y = q[1] + dy * size;
    if (A.domain.contains(x, y, -1e-6) && B.domain.contains(x, y, -1e-6)) pts.push([x, y]);
  }
  return { A, B, pts, size };
}

test('drag 3a: xx — dragging the cut across a glide axis (the copy of the anchor changes across) changes nothing at any t; along, nothing in stage 1', () => {
  const g = BY_ID.xx, a = anchorOf(g), o1 = [0, 0, 0], o2 = [0, 0, 0];
  const { fold: f0 } = fold(g, a, { density: 6 });
  const P = f0.params, [sx, sy] = P.across, [ax, ay] = P.axis, b = P.period, A = P.glide;
  let across = 0, along = 0, switches = 0;
  for (const k of [-1, 1]) {
    for (const m of [-0.3, 0.1, 0.4]) {
      // the switch line across: (p - a).s = (k - 1/2) b or (k + 1/2) b
      const ds = (k > 0 ? k - 0.5 : k + 0.5) * b, q = [a[0] + ds * sx + m * A * ax, a[1] + ds * sy + m * A * ay];
      const { A: F, B: G, pts, size } = straddle(g, q, [sx, sy]);
      assert.notDeepEqual(F.fold.anchorImage, G.fold.anchorImage, 'a switch across');
      switches++;
      for (const t of [0.15, 0.3, STAGE.klein.t1, 0.6, 0.8, 0.95, 1]) {
        const X = F.fold.at(t), Y = G.fold.at(t);
        for (const [x, y] of pts) { X(x, y, 0, o1); Y(x, y, 0, o2); across = Math.max(across, dist3(o1, o2) / size); }
      }
    }
    // along: the switch line (p - a).a = (k -+ 1/2) A, in stage 1 (before the ring starts)
    const da = (k > 0 ? k - 0.5 : k + 0.5) * A, q = [a[0] + 0.13 * b * sx + da * ax, a[1] + 0.13 * b * sy + da * ay];
    const { A: F, B: G, pts, size } = straddle(g, q, [ax, ay]);
    assert.notEqual(!!F.fold.params.flip, !!G.fold.params.flip, 'along, the switch changes between a translate and a glide image');
    for (const t of [0.1, 0.25, STAGE.klein.t2 - 1e-3]) {
      const X = F.fold.at(t), Y = G.fold.at(t);
      for (const [x, y] of pts) { X(x, y, 0, o1); Y(x, y, 0, o2); along = Math.max(along, dist3(o1, o2) / size); }
    }
  }
  assert.ok(switches >= 6);
  assert.ok(across < 1e-6, `across a glide axis the fold moves by ${across} tile sizes`);
  assert.ok(along < 1e-6, `along, in stage 1, the fold moves by ${along} tile sizes`);
});

test('drag 3b: o — in stage 1 a switch of the copy of the anchor changes nothing (the tube forms at the seed)', () => {
  const g = BY_ID.o, a = anchorOf(g), o1 = [0, 0, 0], o2 = [0, 0, 0];
  let worst = 0, n = 0;
  for (const [lx, ly, ux, uy] of [[0.5, 0.2, 1, 0], [-0.5, 0.3, 1, 0], [0.25, 0.5, 0, 1], [0.1, -0.5, 0, 1]]) {
    // a point where a lattice coordinate of p - a is half an integer
    const q = [a[0] + lx * g.e1[0] + ly * g.e2[0], a[1] + lx * g.e1[1] + ly * g.e2[1]];
    // move across that line: along the dual direction of the coordinate that is half an integer
    const e = ux ? g.e2 : g.e1, nrm = Math.hypot(e[1], e[0]), u = [e[1] / nrm, -e[0] / nrm];
    const { A: F, B: G, pts, size } = straddle(g, q, u);
    if (F.fold.anchorImage.join() === G.fold.anchorImage.join()) continue;
    n++;
    for (const t of [0.1, 0.25, STAGE.torus.t2 - 1e-3]) {
      const X = F.fold.at(t), Y = G.fold.at(t);
      for (const [x, y] of pts) { X(x, y, 0, o1); Y(x, y, 0, o2); worst = Math.max(worst, dist3(o1, o2) / size); }
    }
  }
  assert.ok(n >= 3, `${n} switches crossed`);
  assert.ok(worst < 1e-6, `in stage 1 the fold moves by ${worst} tile sizes at a switch`);
});

test('drag 3c: *x and ** — once the turn over is done (t >= flap), the tiles on the two sides of any mirror fold alike', () => {
  const o1 = [0, 0, 0], o2 = [0, 0, 0];
  for (const id of ['*x', '**']) {
    const g = BY_ID[id], a = anchorOf(g), S = mirrorsOf(g), ka = stripOf(S, a[0], a[1]);
    const { fold: f0 } = fold(g, a, { density: 6 });
    const flap = id === '*x' ? f0.params.flap : 0.5;
    // (*x's lift is rounded only while a tile turns over, in step with the turn's speed: nothing is left at t = flap)
    const tol = 1e-9;
    let worst = 0, worstEnd = 0, n = 0, before = 0;
    const along = [S.ny, -S.nx];
    for (const k of [ka - 2, ka - 1, ka + 1, ka + 2, ka + 3]) {
      for (const m of [-0.35, 0.15]) {
        // a point on the mirror n.x = k w, a way along it from the anchor
        const per = id === '*x' ? f0.params.glide : f0.params.period;
        const q = [k * S.w * S.nx + (a[0] * along[0] + a[1] * along[1] + m * per) * along[0], k * S.w * S.ny + (a[0] * along[0] + a[1] * along[1] + m * per) * along[1]];
        const F = fold(g, [q[0] - 1e-7 * S.nx, q[1] - 1e-7 * S.ny], { density: 16 }), G = fold(g, [q[0] + 1e-7 * S.nx, q[1] + 1e-7 * S.ny], { density: 16 });
        // points of the lower tile near the mirror and their mirror images (in the upper tile)
        const pairs = [];
        for (const [dx, dy] of [[0.04, 0.02], [0.1, -0.05], [-0.06, 0.08], [0.2, 0.01]]) {
          const x = q[0] - Math.abs(dx) * F.size * S.nx + dy * F.size * along[0], y = q[1] - Math.abs(dx) * F.size * S.ny + dy * F.size * along[1];
          const e = x * S.nx + y * S.ny - k * S.w, rx = x - 2 * e * S.nx, ry = y - 2 * e * S.ny;
          if (F.domain.contains(x, y, -1e-6) && G.domain.contains(rx, ry, -1e-6)) pairs.push([x, y, rx, ry]);
        }
        if (!pairs.length) continue;
        n++;
        for (const t of [flap, 0.5 * (flap + 1), 0.9, 1]) {
          const X = F.fold.at(t), Y = G.fold.at(t);
          for (const [x, y, rx, ry] of pairs) {
            X(x, y, 0, o1); Y(rx, ry, 0, o2);
            const d = dist3(o1, o2) / F.size;
            if (t === 1) worstEnd = Math.max(worstEnd, d); else worst = Math.max(worst, d);
          }
        }
        const X = F.fold.at(0.25 * flap), Y = G.fold.at(0.25 * flap);
        for (const [x, y, rx, ry] of pairs) { X(x, y, 0, o1); Y(rx, ry, 0, o2); before = Math.max(before, dist3(o1, o2) / F.size); }
      }
    }
    assert.ok(n >= 6, `${id}: ${n} mirror crossings compared`);
    assert.ok(worst < tol, `${id}: after the turn over the two sides differ by ${worst} tile sizes`);
    assert.ok(worstEnd < 1e-9, `${id}: at t = 1 the two sides differ by ${worstEnd} tile sizes`);
    assert.ok(before > 1e-3, `${id}: before the turn over they do differ (${before}): the test sees the crossing`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// 4. the torus's first seam closes on top
// ---------------------------------------------------------------------------------------------------------------

test('drag 4: o — at the inner stop the tube of stage 1 has closed on top (its seam in the upper half) for every dragged seed', () => {
  const g = BY_ID.o, o1 = [0, 0, 0], q = [0, 0];
  let lowest = Infinity, n = 0;
  for (const seed of [...FILMED.o, ...windowSeeds(g, 24, 4)]) {
    const { domain, mesh: M, fold: f, size } = fold(g, seed, { density: 16 });
    const r = f.params.tubeRadius * f.params.stretch, F = f.at(STAGE.torus.t1);
    void q; void size;
    for (const b of M.boundary) {
      const e = domain.edges[b.edge];
      if (e.kind !== 'cut' || det(e.g) < 0) continue;
      // edges sewn by a translation with a part along e1 (round the tube): the seam of stage 1
      const lc = latticeCoords(g, e.g.tx, e.g.ty);
      if (Math.abs(Math.round(lc[0])) < 1) continue;
      for (let j = 0; j < b.pts.length; j += 2) { F(b.pts[j], b.pts[j + 1], 0, o1); lowest = Math.min(lowest, o1[2] / r); n++; }
    }
  }
  assert.ok(n > 100, `${n} seam points`);
  assert.ok(lowest > 1, `a point of the stage-1 seam lies at ${lowest.toFixed(3)} tube radii: below the tube's axis`);
});

// ---------------------------------------------------------------------------------------------------------------
// 5. the colours of a tile that turns over (**)
// ---------------------------------------------------------------------------------------------------------------

test('drag 5: ** — fold.mirroredAt(t) is 0 until the page nears edge-on, 1 after it, monotone; 0 throughout for a tile that does not turn over; no other roll swaps colours', () => {
  const g = BY_ID['**'];
  let mirrored = 0, plain = 0;
  const o1 = [0, 0, 0], o2 = [0, 0, 0], o3 = [0, 0, 0];
  for (const seed of [...FILMED['**'], ...windowSeeds(g, 40, 5)]) {
    const { domain, fold: f, size } = fold(g, seed, { density: 8 });
    assert.equal(typeof f.mirroredAt, 'function');
    let prev = -1;
    for (let k = 0; k <= 200; k++) {
      const m = f.mirroredAt(k / 200);
      assert.ok(m >= 0 && m <= 1 && m >= prev - 1e-15, `seed ${seed}: mirroredAt(${k / 200}) = ${m}`);
      prev = m;
    }
    if (!f.mirrored) { plain++; assert.equal(f.mirroredAt(1), 0); continue; }
    mirrored++;
    assert.equal(f.mirroredAt(0), 0); assert.equal(f.mirroredAt(1), 1);
    // where the swap is half done, the turning tile is seen edge-on from above: its normal is horizontal
    let lo = 0, hi = 1;
    for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (f.mirroredAt(mid) < 0.5) lo = mid; else hi = mid; }
    const F = f.at(lo), p = domain.seedActual, h = 0.05 * size;
    F(p[0], p[1], 0, o1); F(p[0] + h, p[1], 0, o2); F(p[0], p[1] + h, 0, o3);
    const u = [o2[0] - o1[0], o2[1] - o1[1], o2[2] - o1[2]], v = [o3[0] - o1[0], o3[1] - o1[1], o3[2] - o1[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    assert.ok(Math.abs(n[2]) / Math.hypot(...n) < 0.15, `seed ${seed}: at t = ${lo.toFixed(3)} the page's normal is ${n.map((c) => c.toFixed(3))}`);
    // swapped only after the page has passed 0.6 pi .. 0.4 pi of its turn: 0 before t = 0.2, 1 after t = 0.3
    assert.equal(f.mirroredAt(0.2), 0); assert.equal(f.mirroredAt(0.3), 1);
  }
  assert.ok(mirrored >= 8 && plain >= 8, `${mirrored} mirrored, ${plain} plain`);
  for (const id of ['o', 'xx']) {
    for (const seed of windowSeeds(BY_ID[id], 8, 6)) {
      const { fold: f } = fold(BY_ID[id], seed, { density: 6 });
      assert.ok(!f.mirrored && (f.mirroredAt === undefined || f.mirroredAt(1) === 0), `${id}: no colour swap`);
    }
  }
});

/** The renderer's normal of the sheet at the plane point (x, y) under F: (dF e_x) x (dF e_y), unit (CCW triangles). */
function sheetNormal(F, x, y, h) {
  const o = F(x, y, 0, [0, 0, 0]), u = F(x + h, y, 0, [0, 0, 0]), v = F(x, y + h, 0, [0, 0, 0]);
  const a = [u[0] - o[0], u[1] - o[1], u[2] - o[2]], b = [v[0] - o[0], v[1] - o[1], v[2] - o[2]];
  const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], l = Math.hypot(...n);
  return { p: o, n: n.map((c) => c / l) };
}

test('drag 5b: *x — a tile an odd number of mirrors from the anchor\'s strip is mirrored, and its colours are swapped by fold.mirroredAt(t): 0 at t = 0, 1 from the end of the flap on, monotone, no jump; edge-on when its segment turns over; so the band keeps its colours when the cut is dragged across a mirror (final fix, 10 Nov: qa/final-verify-owner-asks/crossing-sx-largest.png)', () => {
  const g = BY_ID['*x'], S = mirrorsOf(g), a = anchorOf(g), ka = stripOf(S, a[0], a[1]);
  const fl = 0.6;   // TUNE.mobius.flap
  let turned = 0, slid = 0, plain = 0, crossings = 0;
  for (const seed of [...FILMED['*x'], [0.8, -0.15], [2.4, -0.15], [0.8, 0.45], [2.4, 0.45], ...windowSeeds(g, 40, 7)]) {
    const { domain, fold: f, size } = fold(g, seed, { density: 8 });
    const odd = (stripOf(S, domain.seed[0], domain.seed[1]) - ka) % 2 !== 0;
    assert.equal(f.mirrored, odd, `seed ${seed}: mirrored exactly when the strip is an odd number of mirrors away`);
    assert.equal(typeof f.mirroredAt, 'function');
    let prev = -1, step = 0;
    for (let k = 0; k <= 200; k++) {
      const m = f.mirroredAt(k / 200);
      assert.ok(m >= 0 && m <= 1 && m >= prev - 1e-15, `seed ${seed}: mirroredAt(${k / 200}) = ${m}`);
      if (k) step = Math.max(step, m - prev);
      prev = m;
    }
    if (!odd) { plain++; assert.equal(f.mirroredAt(0.5) + f.mirroredAt(1), 0, `seed ${seed}: an unmirrored tile swaps nothing`); continue; }
    assert.equal(f.mirroredAt(0), 0, `seed ${seed}: flat, the tile shows its front`);
    assert.equal(f.mirroredAt(fl), 1); assert.equal(f.mirroredAt(1), 1);
    assert.ok(step <= 0.25, `seed ${seed}: the swap moves ${step.toFixed(3)} per 1/200 of t`);
    if (f.params.flip) {
      turned++;
      // half swapped where the turning segment is seen edge-on from the default camera (VIEW0: az 0, el 55): the sheet
      // at the centre of the roll (the twist adds nothing there), on the strip's centre line, carried back by
      // v = anchorImage - anchor. (It turns toward the camera or away from it, so that is 55 or 125 degrees into its
      // turn; at 90, edge-on from above, the camera would see its back for a moment: teal, pale, teal.)
      let lo = 0, hi = 1;
      for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (f.mirroredAt(mid) < 0.5) lo = mid; else hi = mid; }
      const P = f.params, d = P.along, nn = P.across, p = domain.seedActual;
      const v = [f.anchorImage[0] - a[0], f.anchorImage[1] - a[1]];
      const eS = (p[0] - v[0]) * d[0] + (p[1] - v[1]) * d[1], e0 = eS + lo * (a[0] * d[0] + a[1] * d[1] - eS);
      const xc = [P.axis * nn[0] + e0 * d[0] + v[0], P.axis * nn[1] + e0 * d[1] + v[1]];
      const { n } = sheetNormal(f.at(lo), xc[0], xc[1], 1e-4 * size);
      const facing = n[0] * VIEW0[0] + n[1] * VIEW0[1] + n[2] * VIEW0[2];
      assert.ok(Math.abs(facing) < 0.02, `seed ${seed}: at t = ${lo.toFixed(3)} the turning segment's normal ${n.map((c) => c.toFixed(3))} faces the camera by ${facing.toFixed(3)}`);
      assert.ok(lo > 0.15 && lo < 0.45, `seed ${seed}: half swapped at t = ${lo}`);
      { const F0 = sheetNormal(f.at(0.5 * lo), xc[0], xc[1], 1e-4 * size).n, F1 = sheetNormal(f.at(Math.min(0.6, 1.3 * lo)), xc[0], xc[1], 1e-4 * size).n;
        assert.ok(F0[0] * VIEW0[0] + F0[1] * VIEW0[1] + F0[2] * VIEW0[2] > 0, `seed ${seed}: before the swap the camera sees the segment's front`);
        assert.ok(F1[0] * VIEW0[0] + F1[1] * VIEW0[1] + F1[2] * VIEW0[2] < 0, `seed ${seed}: after it, its back (now in the front colour)`); }
    } else {
      slid++;
      assert.ok(step <= 1 / 60, `seed ${seed}: a tile that only slides across fades gently (${step.toFixed(4)} per 1/200)`);
    }
  }
  assert.ok(turned >= 4 && slid >= 2 && plain >= 8, `${turned} turned over, ${slid} slid across, ${plain} not mirrored`);
  // the colours the person sees across a mirror: seeds p and its mirror image r(p) give the same band from t = flap on
  // (and at t = 1), with every normal reversed; the swap undoes that, so the shown side is the same at matching points
  for (const seed of [[0.8, 0.15], [0.95, 0.2], [0.6, 0.08], [1.7, 0.18], [2.2, 0.1], [1.1, -0.2], [0.4, 0.4]]) {
    const m = Math.round((seed[1] * S.ny) / S.w) * S.w;                    // the mirror y = m nearest the seed
    const twin = [seed[0], 2 * m - seed[1]];
    const A = fold(g, seed, { density: 8 }), B = fold(g, twin, { density: 8 });
    assert.notEqual(A.fold.mirrored, B.fold.mirrored, `seeds ${seed} and ${twin}: one of the two is mirrored`);
    for (const t of [fl, 0.8, 1]) {
      const FA = A.fold.at(t), FB = B.fold.at(t), sA = 1 - 2 * A.fold.mirroredAt(t), sB = 1 - 2 * B.fold.mirroredAt(t);
      for (const [dx, dy] of [[0, 0], [0.1, 0.03], [-0.15, -0.04], [0.2, -0.02]]) {
        const x = A.domain.seedActual[0] + dx, y = A.domain.seedActual[1] + dy;
        const nA = sheetNormal(FA, x, y, 1e-4), nB = sheetNormal(FB, x, 2 * m - y, 1e-4);
        assert.ok(dist3(nA.p, nB.p) < 1e-9 * A.size, `seed ${seed} t ${t}: the point and its mirror image go to one place (${dist3(nA.p, nB.p)})`);
        const shown = (nA.n[0] * nB.n[0] + nA.n[1] * nB.n[1] + nA.n[2] * nB.n[2]) * sA * sB;
        assert.ok(shown > 0.999, `seed ${seed} t ${t}: the side shown at (${x.toFixed(3)}, ${y.toFixed(3)}) changes when the cut crosses the mirror (${shown})`);
        crossings++;
      }
    }
  }
  assert.ok(crossings >= 80, `${crossings} matching points compared`);
});

test('drag: the sweep really ran', (t) => {
  for (const id of IDS) assert.ok(motion[id], `${id} motion measured`);
  t.diagnostic('anchored, dragged cuts (window seeds + the filmed ones), per 1/200 of t, tile sizes: ' +
    IDS.map((id) => `${id} step ${motion[id].worstStep.toFixed(4)} (bound ${BOUND[id][0]}), second difference ${motion[id].worstBend.toFixed(5)} (${BOUND[id][1]}), lowest z ${motion[id].minZ.toFixed(5)}`).join('; '));
});
