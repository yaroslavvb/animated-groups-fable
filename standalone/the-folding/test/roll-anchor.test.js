// test/roll-anchor.test.js — SPEC 7, the anchor contract, for the rolls o, **, *x, xx (round-3 finding 4; the
// construction is at the top of src/folds/roll.js, THE ANCHOR).
// For every group, every preset's seed as the anchor (what the app passes, SPEC 8 C3), ANCHOR_SEEDS (default 30)
// seeded-random seeds over the plane view's window, amp 0 and 1:
//   1. at t = 1 every plane point goes where the anchor's own closed map puts it (the fold of the anchor's tile, amp 0,
//      the point first carried into the anchor's strip by the group): the same for every seed and wave;
//   2. SPEC 5.3 for the anchored fold: at(0) is the identity, the seams close, the motion is continuous and finite, it
//      stays above the plane;
//   3. continuity in the seed for 0 < t < 1 while the image of the anchor next to the seed stays the same;
//   4. no anchor, or a malformed one, is the v1 fold bit for bit; anchor = seed is the v1 fold;
//   5. ** and *x mark a tile an odd number of mirrors from the anchor as mirrored (fold.mirrored); o and xx never.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BY_ID, elementsNear } from '../src/groups.js';
import { apply, inverse, det } from '../src/geom.js';
import { makeWarp, buildDomain } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import createFold, { STAGE } from '../src/folds/roll.js';

const IDS = ['o', '**', '*x', 'xx'];
const SEEDS = Math.max(30, +process.env.ANCHOR_SEEDS || 30);

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

/** The mirrors of ** and *x as { nx, ny, m0, w } (n.x = m0 + k w), or null. */
function strips(group) {
  const r = group.reps.find((g) => det(g) < 0);
  if (!r || group.id === 'xx') return null;
  // the reflection's mirror through the origin-ish: its normal is the -1 eigenvector of the linear part
  const nx0 = Math.sqrt(Math.max(0, (1 - r.a) / 2)), ny0 = Math.sqrt(Math.max(0, (1 - r.d) / 2)) * (r.b > 0 ? -1 : 1);
  const l = Math.hypot(nx0, ny0), nx = nx0 / l, ny = ny0 / l;
  // mirrors: the fixed lines of the orientation-reversing elements that fix a point
  const near = elementsNear(group, 0, 0, 4, 0, 0).filter((g) => det(g) < 0);
  const offs = [];
  for (const g of near) {
    // fixed points exist iff the translation part is along n: then the mirror is n.x = (t.n) / 2
    const tn = g.tx * nx + g.ty * ny, tt = -g.tx * ny + g.ty * nx;
    if (Math.abs(tt) < 1e-9) offs.push(tn / 2);
  }
  offs.sort((a, b) => a - b);
  let w = Infinity;
  for (let i = 1; i < offs.length; i++) if (offs[i] - offs[i - 1] > 1e-9) w = Math.min(w, offs[i] - offs[i - 1]);
  return { nx, ny, m0: offs[0], w };
}
const stripOf = (S, x, y) => Math.floor((x * S.nx + y * S.ny - S.m0) / S.w + 1e-12);

/** Seeds: every preset's own, then random ones over the window of the plane view. */
function seedsFor(group) {
  const rnd = prng(20261110 + 97 * IDS.indexOf(group.id));
  const out = [];
  for (let k = 0; k < SEEDS; k++) out.push([group.center[0] + (2 * rnd() - 1) * group.viewHalf, group.center[1] + (2 * rnd() - 1) * group.viewHalf]);
  return out;
}

const failures = { reference: [], identity: [], seams: [], motion: [], finite: [], upward: [], seed: [], v1: [], mirrored: [] };
const fail = (k, m) => failures[k].push(m);
const show = (k) => `${failures[k].length} failures, e.g.\n  ` + failures[k].slice(0, 6).join('\n  ');
const stats = { folds: 0, points: 0, worstRef: 0, worstRim: 0, worstSeam: 0, maxStep: 0, maxRatio: 0, minZ: Infinity, mirrored: 0, seedSteps: 0, worstSeed: 0 };

for (const id of IDS) {
  const group = BY_ID[id], size = Math.sqrt(group.domainArea), S = strips(group);
  const rnd = prng(4711 + IDS.indexOf(id));
  for (const [pi, preset] of group.presets.entries()) {
    const a = preset.anchor || preset.seed;
    // the reference: the anchor's own tile, amp 0, folded with the anchor
    const dA = buildDomain(group, { seed: a, metric: preset.metric, warp: makeWarp(group, 0) });
    const refFold = createFold(group, dA, buildMesh(group, dA), { anchor: a, density: false });
    const R1 = refFold.at(1);
    const ka = S ? stripOf(S, a[0], a[1]) : 0;
    const q = [0, 0], o = [0, 0, 0], r = [0, 0, 0];
    /** The reference image of a plane point: carried into the anchor's strip by an element of the group first. */
    const reference = (x, y, out, toward) => {
      let px = x, py = y;
      // the strip of a point on a mirror (a Float32 vertex of the rim lies up to 3e-8 beyond it): judged a hair inside
      const l = toward ? Math.hypot(toward[0] - x, toward[1] - y) || 1 : 1;
      const sx = toward ? x + (1e-6 * size * (toward[0] - x)) / l : x, sy = toward ? y + (1e-6 * size * (toward[1] - y)) / l : y;
      if (S && stripOf(S, sx, sy) !== ka) {
        const h = elementsNear(group, a[0], a[1], 3 * size + Math.hypot(x - a[0], y - a[1]), sx, sy).find((g) => { apply(g, sx, sy, q); return stripOf(S, q[0], q[1]) === ka; });
        apply(h, x, y, q); px = q[0]; py = q[1];
      }
      return R1(px, py, 0, out);
    };
    for (const seed of seedsFor(group)) {
      for (const amp of [0, 1]) {
        const tag = `${id} anchor ${pi} (${preset.name}) seed (${seed[0].toFixed(4)}, ${seed[1].toFixed(4)}) amp ${amp}`;
        const domain = buildDomain(group, { seed, metric: preset.metric, warp: makeWarp(group, amp) });
        const mesh = buildMesh(group, domain);
        const fold = createFold(group, domain, mesh, { anchor: a, density: false });
        stats.folds++;
        if (!(fold.anchor && fold.anchor[0] === a[0] && fold.anchor[1] === a[1])) fail('reference', `${tag}: fold.anchor ${fold.anchor}`);
        const M = fold.mesh, F1 = fold.at(1);
        // ---- 1. at t = 1: where the anchor says, at every vertex and at random points of the seed's strip
        const pts = [];
        for (let v = 0; v < M.n; v += 7) pts.push([M.xy[2 * v], M.xy[2 * v + 1]]);
        for (let k = 0; k < 24; k++) {
          const x = domain.seedActual[0] + (2 * rnd() - 1) * 1.5 * size, y = domain.seedActual[1] + (2 * rnd() - 1) * 1.5 * size;
          if (!S || stripOf(S, x, y) === stripOf(S, domain.seed[0], domain.seed[1])) pts.push([x, y]);
        }
        // (a Float32 vertex of the rim lies up to 5e-8 beyond its mirror, where two images under the group differ by
        // twice that: such points are held to 1e-6 tile sizes, every other one to 1e-12)
        const onMirror = (x, y) => { if (!S) return false; const u = (x * S.nx + y * S.ny - S.m0) / S.w; return Math.abs(u - Math.round(u)) * S.w < 1e-6 * size; };
        let worst = 0, at = null, worstRim = 0;
        for (const [x, y] of pts) {
          F1(x, y, 0, o); reference(x, y, r, domain.seed);
          const d = dist3(o, r);
          if (onMirror(x, y)) { worstRim = Math.max(worstRim, d); if (!(d < 1e-6 * size)) fail('reference', `${tag}: at t = 1 the rim point (${x}, ${y}) lands ${d / size} tile sizes from where the anchor puts it`); continue; }
          if (!(d <= worst)) { worst = d; at = [x, y]; }
          stats.points++;
        }
        stats.worstRim = Math.max(stats.worstRim, worstRim / size);
        stats.worstRef = Math.max(stats.worstRef, worst / size);
        if (!(worst < 1e-12 * size)) fail('reference', `${tag}: at t = 1 the point (${at}) lands ${worst / size} tile sizes from where the anchor puts it`);
        // ---- 5. mirrored exactly when the seed's strip and the anchor's are an odd number of mirrors apart (** and *x:
        //        such a tile is the mirror image of one of the anchor's strip, its closed shape shows its other side;
        //        until the final fix of 10 Nov *x was never mirrored and its band changed colour when the cut crossed a
        //        mirror, qa/final-verify-owner-asks/crossing-sx-largest.png)
        const odd = S ? (stripOf(S, domain.seed[0], domain.seed[1]) - ka) % 2 !== 0 : false;
        const wantMirrored = (id === '**' || id === '*x') && odd;
        if (!!fold.mirrored !== wantMirrored) fail('mirrored', `${tag}: fold.mirrored ${fold.mirrored}, want ${wantMirrored}`);
        if (fold.mirrored) stats.mirrored++;
        // ---- 2. SPEC 5.3 for the anchored fold
        const F0 = fold.at(0);
        for (let v = 0; v < M.n; v += 5) {
          F0(M.xy[2 * v], M.xy[2 * v + 1], 0, o);
          if (o[0] !== M.xy[2 * v] || o[1] !== M.xy[2 * v + 1] || !Object.is(o[2], 0)) { fail('identity', `${tag}: at(0) moves a vertex`); break; }
        }
        let gap = 0;
        for (const b of M.boundary) {
          const e = domain.edges[b.edge];
          if (e.kind !== 'cut') continue;
          const gi = inverse(e.g);
          for (let j = 0; j < b.pts.length; j += 2) {
            apply(gi, b.pts[j], b.pts[j + 1], q);
            F1(b.pts[j], b.pts[j + 1], 0, o); F1(q[0], q[1], 0, r);
            gap = Math.max(gap, dist3(o, r));
          }
        }
        stats.worstSeam = Math.max(stats.worstSeam, gap / size);
        if (!(gap < 1e-10 * size)) fail('seams', `${tag}: seam gap ${gap / size} tile sizes at t = 1`);
        // motion: 200 steps over a spread of vertices; finite at the stops and stage boundaries; above the plane
        const sample = [];
        for (let v = 0; v < M.n; v += Math.max(1, Math.floor(M.n / 300))) sample.push(M.xy[2 * v], M.xy[2 * v + 1]);
        for (const b of M.boundary) for (let j = 0; j < b.pts.length; j += 8) sample.push(b.pts[j], b.pts[j + 1]);
        const K = sample.length / 2, prev = new Float64Array(3 * K), cur = new Float64Array(3 * K);
        for (let i = 0; i < K; i++) { prev[3 * i] = sample[2 * i]; prev[3 * i + 1] = sample[2 * i + 1]; prev[3 * i + 2] = 0; }
        let mx = 0, mean = 0, zmin = Infinity;
        for (let s = 1; s <= 200; s++) {
          const F = fold.at(s / 200);
          let step = 0;
          for (let i = 0; i < K; i++) {
            F(sample[2 * i], sample[2 * i + 1], 0, o);
            if (!Number.isFinite(o[0] + o[1] + o[2])) { fail('finite', `${tag}: not finite at t = ${s / 200}`); break; }
            step = Math.max(step, Math.hypot(o[0] - prev[3 * i], o[1] - prev[3 * i + 1], o[2] - prev[3 * i + 2]));
            cur[3 * i] = o[0]; cur[3 * i + 1] = o[1]; cur[3 * i + 2] = o[2];
            if (o[2] < zmin) zmin = o[2];
          }
          prev.set(cur);
          mx = Math.max(mx, step); mean += step / 200;
        }
        stats.maxStep = Math.max(stats.maxStep, mx / size); stats.maxRatio = Math.max(stats.maxRatio, mx / mean); stats.minZ = Math.min(stats.minZ, zmin / size);
        if (!(mx < 0.08 * size)) fail('motion', `${tag}: a step of 1/200 moves a point ${(mx / size).toFixed(4)} tile sizes`);
        if (!(mx < 5 * mean)) fail('motion', `${tag}: largest step ${(mx / mean).toFixed(2)} x the mean`);
        if (!(zmin > -0.02 * size)) fail('upward', `${tag}: dips to z = ${(zmin / size).toFixed(4)} tile sizes`);
        const times = [1e-12, 0.5, 1, 1 - 1e-12];
        if (STAGE[group.fold]) times.push(STAGE[group.fold].t1, STAGE[group.fold].t2, STAGE[group.fold].t1 + 1e-12);
        for (const t of times) {
          const F = fold.at(t);
          for (let i = 0; i < K; i++) { F(sample[2 * i], sample[2 * i + 1], 0, o); if (!Number.isFinite(o[0] + o[1] + o[2])) { fail('finite', `${tag}: not finite at t = ${t}`); break; } }
        }
        // no jump of position or velocity where a stage starts or ends (and where the page turn of ** ends, t = 0.5)
        const inner = STAGE[group.fold] ? [STAGE[group.fold].t2, STAGE[group.fold].t1] : [0.5];
        const A = new Float64Array(3 * K), B = new Float64Array(3 * K), C = new Float64Array(3 * K);
        const img = (t, arr) => { const F = fold.at(t); for (let i = 0; i < K; i++) { F(sample[2 * i], sample[2 * i + 1], 0, o); arr[3 * i] = o[0]; arr[3 * i + 1] = o[1]; arr[3 * i + 2] = o[2]; } };
        for (const t of inner) {
          for (const h of [1e-3, 1e-5]) {
            img(t - h, A); img(t, B); img(t + h, C);
            let jump = 0, bend = 0;
            for (let j = 0; j < 3 * K; j += 3) {
              jump = Math.max(jump, Math.hypot(B[j] - A[j], B[j + 1] - A[j + 1], B[j + 2] - A[j + 2]), Math.hypot(C[j] - B[j], C[j + 1] - B[j + 1], C[j + 2] - B[j + 2]));
              bend = Math.max(bend, Math.hypot(C[j] - 2 * B[j] + A[j], C[j + 1] - 2 * B[j + 1] + A[j + 1], C[j + 2] - 2 * B[j + 2] + A[j + 2]));
            }
            if (!(jump < 20 * h * size)) fail('motion', `${tag}: position jumps by ${jump} within ${h} of t = ${t}`);
            if (!(bend < 3000 * h * h * size + 1e-12 * size)) fail('motion', `${tag}: velocity jumps at t = ${t} (second difference ${bend} for h = ${h})`);
          }
        }
        let zEnd = Infinity;
        for (let v = 0; v < M.n; v++) { F1(M.xy[2 * v], M.xy[2 * v + 1], 0, o); zEnd = Math.min(zEnd, o[2]); }
        if (!(zEnd > -1e-6 * size)) fail('upward', `${tag}: at t = 1 the shape dips to z = ${zEnd}`);
      }
    }
    // ---- 3. continuity in the seed (t = 0.25, 0.5, 0.75): a short straight path; where the image of the anchor next
    // to the seed (fold.anchorImage) stays the same, a fixed point of the tile moves by no more than a multiple of the step
    for (let k = 0; k < 6; k++) {
      const p0 = [group.center[0] + (2 * rnd() - 1) * 0.8 * group.viewHalf, group.center[1] + (2 * rnd() - 1) * 0.8 * group.viewHalf];
      const ang = TAU_RND(rnd), h = 0.002 * size;
      let prevFold = null, prevImg = null;
      const x0 = p0[0] + 0.02 * size, y0 = p0[1] - 0.015 * size;     // a point near the path (inside the tile all along)
      for (let s = 0; s <= 40; s++) {
        const seed = [p0[0] + s * h * Math.cos(ang), p0[1] + s * h * Math.sin(ang)];
        const domain = buildDomain(group, { seed, metric: preset.metric, warp: makeWarp(group, 0) });
        const fold = createFold(group, domain, buildMesh(group, domain), { anchor: a, density: false });
        const img = fold.anchorImage ? fold.anchorImage.join() : '';
        if (prevFold && img === prevImg && domain.contains(x0, y0, -1e-6)) {
          for (const t of [0.25, 0.5, 0.75]) {
            prevFold.at(t)(x0, y0, 0, o); fold.at(t)(x0, y0, 0, r);
            const d = dist3(o, r);
            stats.seedSteps++; stats.worstSeed = Math.max(stats.worstSeed, d / h);
            if (!(d < 12 * h)) fail('seed', `${id} anchor ${pi}: at t = ${t} a step of ${h.toExponential(1)} of the seed moves a point ${d.toExponential(2)}`);
          }
        }
        prevFold = fold; prevImg = img;
      }
    }
  }
  // ---- 4. no anchor or a malformed one: v1 bit for bit; anchor = seed (amp 0): v1
  for (const [pi, preset] of group.presets.entries()) {
    for (const amp of [0, 1]) {
      const domain = buildDomain(group, { seed: preset.seed, metric: preset.metric, warp: makeWarp(group, amp) });
      const mesh = buildMesh(group, domain);
      const plain = createFold(group, domain, mesh, { density: false });
      const variants = [{ anchor: null }, { anchor: [NaN, 1] }, { anchor: 'ab' }, { anchor: [1] }];
      if (amp === 0) variants.push({ anchor: domain.seed.slice() });
      for (const v of variants) {
        const f = createFold(group, domain, mesh, { ...v, density: false });
        const exact = !(amp === 0 && Array.isArray(v.anchor) && v.anchor.length === 2 && Number.isFinite(v.anchor[0]));
        const o = [0, 0, 0], r = [0, 0, 0];
        for (const t of [0.2, 0.5, 0.8, 1]) {
          const F = f.at(t), G = plain.at(t);
          let worst = 0;
          for (let i = 0; i < mesh.n; i += 11) { F(mesh.xy[2 * i], mesh.xy[2 * i + 1], 0, o); G(mesh.xy[2 * i], mesh.xy[2 * i + 1], 0, r); worst = Math.max(worst, dist3(o, r)); }
          if (exact ? worst !== 0 : !(worst < 1e-12 * Math.sqrt(group.domainArea))) fail('v1', `${id} preset ${pi} amp ${amp} anchor ${JSON.stringify(v.anchor)} t = ${t}: ${worst} from the fold without an anchor`);
        }
        if (exact && f.anchor !== null) fail('v1', `${id}: fold.anchor should be null for ${JSON.stringify(v.anchor)}`);
      }
    }
  }
}
function TAU_RND(rnd) { return 2 * Math.PI * rnd(); }

test('anchor 1: at t = 1 every plane point goes where the anchor puts it — the same for every seed and wave (o, **, *x, xx; every preset as the anchor)', () => assert.equal(failures.reference.length, 0, show('reference')));
test('anchor 2a: the anchored fold starts as the identity, exactly', () => assert.equal(failures.identity.length, 0, show('identity')));
test('anchor 2b: the anchored fold closes every seam at t = 1 (1e-10 tile sizes)', () => assert.equal(failures.seams.length, 0, show('seams')));
test('anchor 2c: the anchored motion is continuous (200 steps: none above 0.08 tile sizes or 5 x the mean; no jump of position or velocity at the stage boundaries) and finite at the stops', () => {
  assert.equal(failures.motion.length, 0, show('motion'));
  assert.equal(failures.finite.length, 0, show('finite'));
});
test('anchor 2d: the anchored fold stays above the plane (the page turn of a mirrored ** tile included)', () => assert.equal(failures.upward.length, 0, show('upward')));
test('anchor 3: continuous in the seed for 0 < t < 1 while the image of the anchor next to the seed stays the same', () => assert.equal(failures.seed.length, 0, show('seed')));
test('anchor 4: no anchor or a malformed one is the v1 fold bit for bit; anchor = seed is the v1 fold', () => assert.equal(failures.v1.length, 0, show('v1')));
test('anchor 5: ** and *x mark a tile an odd number of mirrors from the anchor\'s strip as mirrored (fold.mirrored: its closed shape shows its other side); o and xx never', () => assert.equal(failures.mirrored.length, 0, show('mirrored')));
test('anchor: the sweep really ran', (t) => {
  const anchors = IDS.reduce((s, id) => s + BY_ID[id].presets.length, 0);
  assert.equal(stats.folds, anchors * SEEDS * 2);
  assert.ok(stats.mirrored > 20, `${stats.mirrored} mirrored ** and *x tiles`);
  assert.ok(stats.seedSteps > 200, `${stats.seedSteps} seed steps compared`);
  t.diagnostic(`${stats.folds} anchored folds, ${stats.points} points: worst distance from the anchor's closed map ${stats.worstRef.toExponential(1)} tile sizes (Float32 rim points ${stats.worstRim.toExponential(1)}); ` +
    `seam gap <= ${stats.worstSeam.toExponential(1)}; step <= ${stats.maxStep.toFixed(4)} tile sizes (max/mean ${stats.maxRatio.toFixed(2)}); lowest z ${stats.minZ.toFixed(4)}; ` +
    `${stats.mirrored} mirrored; seed steps: worst ${stats.worstSeed.toFixed(2)} x the step`);
});
