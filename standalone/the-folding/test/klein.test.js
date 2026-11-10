// test/klein.test.js — xx (pg), the Klein bottle, made to show what the glide does: the judge's decision of 9 Nov 2026
// (qa/klein-judge.md, design A, "the seam-crossing comma"; notes/klein.md), kept through round 4 (notes/roll-round4.md)
// and the big filled comma (qa/fill-judge.md, ported into src/motif.js):
//   src/motif.js       SEAM_GROUPS: xx's comma straddles the tile's glide-sewn edge, so the tile holds a piece of it at
//                      its +A/2 edge (the head) and the glide image of the rest at its -A/2 edge. Its placement, its
//                      size and the 3D fill (motifTintMesh) are tested for every group in test/motif.test.js; here
//                      only what the fold relies on: the head is at the end of the tube that holds its 8.
//   src/folds/roll.js  TUNE.klein: flat -1 (the 8 lies down while it closes, two scrolls side by side on the plane;
//                      round-3 finding 28), phase 0.5 (the end at +A/2 keeps its 8, the end at -A/2 turns it over by
//                      pi w), spin 0.5 (the ring turns about the vertical while it closes: the seam closes at the front
//                      left, 45 degrees from the front; the round-4 verification, finding 2: with 0.75, 22.5 degrees from
//                      the front, the 8s at the seam were seen edge-on). The closed bottle is v1's (flat 0, phase 0,
//                      spin 0) turned about the vertical by the spin. An anchored tile pulled back by a glide turns its
//                      8 a further half turn, so that the other end holds: test/roll-drag.test.js.
//   src/app.js         (ui-app's file) draws fold.mesh with the comma cut in. The last test checks that scene.
// Every preset and 20 seeded-random seeds, amp 0 and 1, unless a test says otherwise. No static import of src/app.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID, symmetryElements } from '../src/groups.js';
import { apply, inverse, compose, det, trans } from '../src/geom.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import { motifFor, motifInTile, commaOutline, SEAM_GROUPS } from '../src/motif.js';
import createRoll, { STAGE, rollDensity, rollSchedule } from '../src/folds/roll.js';

const XX = BY_ID.xx;
const SIZE = Math.sqrt(XX.domainArea);
const DENSITY = rollDensity(XX);                 // what the app asks buildMesh for (folds/index.js foldMeshOptions)
const AMPS = [0, 1];

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

// every preset, then 20 random seeds over the window of the plane view
const CASES = XX.presets.map((p, i) => ({ label: `preset ${i} (${p.name})`, seed: p.seed.slice(), metric: p.metric, anchor: p.seed.slice() }));
{
  const rnd = prng(20261109);
  for (let k = 0; k < 20; k++) {
    const seed = [XX.center[0] + (2 * rnd() - 1) * XX.viewHalf, XX.center[1] + (2 * rnd() - 1) * XX.viewHalf];
    CASES.push({ label: `random seed ${k} (${seed[0].toFixed(4)}, ${seed[1].toFixed(4)})`, seed, metric: XX.presets[k % XX.presets.length].metric, anchor: XX.presets[k % XX.presets.length].seed.slice() });
  }
}

/** Domain, mesh (the density the app uses) and fold of a case, built once. */
const built = new Map();
function build(c, amp) {
  const key = `${c.label}|${amp}`;
  let b = built.get(key);
  if (!b) {
    const domain = buildDomain(XX, { seed: c.seed, metric: c.metric, warp: makeWarp(XX, amp) });
    const mesh = buildMesh(XX, domain, { density: DENSITY });
    b = { domain, mesh, fold: createRoll(XX, domain, mesh, {}), tag: `${c.label}, amp ${amp}` };
    built.set(key, b);
  }
  return b;
}
function* everyCase() { for (const c of CASES) for (const amp of AMPS) yield { c, amp, ...build(c, amp) }; }

const dist3 = (u, w) => Math.hypot(u[0] - w[0], u[1] - w[1], u[2] - w[2]);

// ---------------------------------------------------------------------------------------------------------------
// the comma across the seam (plane): what the fold relies on (test/motif.test.js tests the placement itself)
// ---------------------------------------------------------------------------------------------------------------

test('xx glyph: only xx straddles a seam; in the default tile one piece ends on the glide-sewn edge at +A/2 (the end of the tube that holds its 8) and the glide image of the rest on its partner at -A/2', () => {
  assert.deepEqual([...SEAM_GROUPS], ['xx']);
  for (const g of GROUPS) assert.equal(!!motifFor(g).seam, g.id === 'xx', g.id);
  const m = motifFor(XX);
  const { domain: d, fold } = build(CASES[0], 0), P = fold.params;
  const pieces = motifInTile(XX, d, m);
  assert.equal(pieces.length, 2, 'two pieces');
  // which edge each piece ends on; the two edges are partners, sewn by an orientation-reversing element
  const onEdge = (x, y) => d.edges.findIndex((e) => Math.abs(e.nx * x + e.ny * y - e.c) < 1e-6);
  const ends = pieces.map((pl) => { const k = pl.length / 2; return [onEdge(pl[0], pl[1]), onEdge(pl[2 * k - 2], pl[2 * k - 1])]; });
  for (const [a, b] of ends) { assert.ok(a >= 0 && a === b, 'each piece ends twice on one edge'); assert.ok(det(d.edges[a].g) < 0, 'that edge is sewn by a glide'); }
  assert.equal(d.edges[ends[0][0]].partner, ends[1][0], 'the two pieces end on the two edges of one seam');
  // the glide carries the end points of one piece onto those of the other
  const e = d.edges[ends[0][0]], gi = inverse(e.g), q = [0, 0];
  const A = pieces[0], B = pieces[1], kA = A.length / 2, kB = B.length / 2;
  for (const i of [0, kA - 1]) {
    apply(gi, A[2 * i], A[2 * i + 1], q);
    const dmin = Math.min(Math.hypot(q[0] - B[0], q[1] - B[1]), Math.hypot(q[0] - B[2 * kB - 2], q[1] - B[2 * kB - 1]));
    assert.ok(dmin < 1e-6 * SIZE, `an end point of one piece is glued to one of the other (${dmin})`);
  }
  // the comma's centre lies beyond the tile's +A/2 edge, along the fold's tube axis from the seed: the head (the part
  // inside, at that edge) rides on the end that holds its 8, the rest (its glide image, at -A/2) on the end that turns
  const along = (m.at[0] - P.center[0]) * P.axis[0] + (m.at[1] - P.center[1]) * P.axis[1];
  assert.ok(along > P.glide / 2 && along < P.glide / 2 + m.radius, `the comma's centre is ${along} along the tube from the seed (A/2 = ${P.glide / 2})`);
});

// ---------------------------------------------------------------------------------------------------------------
// the klein fold: flat -1, phase 0.5, spin 0.5
// ---------------------------------------------------------------------------------------------------------------

const V1 = { flat: 0, phase: 0, spin: 0 };       // the fold of v1 (round 2), for comparison

test('klein: at(1) is invariant under the glide, its inverse and the translations, and every seam closes', () => {
  const glide = XX.reps.find((r) => det(r) < 0);
  const e1 = trans(XX.e1[0], XX.e1[1]), e2 = trans(XX.e2[0], XX.e2[1]);
  const elements = [['the glide', glide], ['its inverse', inverse(glide)], ['e1', e1], ['-e1', inverse(e1)], ['e2', e2], ['the glide after e1', compose(glide, e1)]];
  const rnd = prng(7), u = [0, 0, 0], w = [0, 0, 0], q = [0, 0];
  let worst = 0, worstSeam = 0, glideEdges = 0;
  for (const { domain: d, mesh: M, fold, tag } of everyCase()) {
    const F1 = fold.at(1), sd = d.seedActual;
    for (let i = 0; i < 200; i++) {
      const x = sd[0] + (2 * rnd() - 1) * 1.5 * SIZE, y = sd[1] + (2 * rnd() - 1) * 1.5 * SIZE;
      F1(x, y, 0, u);
      assert.ok(Number.isFinite(u[0] + u[1] + u[2]), tag);
      for (const [name, g] of elements) {
        apply(g, x, y, q); F1(q[0], q[1], 0, w);
        const dd = dist3(u, w);
        worst = Math.max(worst, dd);
        assert.ok(dd < 1e-9 * SIZE, `${tag}: at(1) of (${x}, ${y}) and of its image under ${name} differ by ${dd}`);
      }
    }
    // SPEC 5.3 (2): the glued boundary points meet, for the glide-sewn edges and the translation-sewn ones
    for (const b of M.boundary) {
      const e = d.edges[b.edge];
      if (e.kind !== 'cut') continue;
      if (det(e.g) < 0) glideEdges++;
      const gi = inverse(e.g);
      for (let j = 0; j < b.pts.length; j += 2) {
        apply(gi, b.pts[j], b.pts[j + 1], q);
        F1(b.pts[j], b.pts[j + 1], 0, u); F1(q[0], q[1], 0, w);
        worstSeam = Math.max(worstSeam, dist3(u, w));
      }
    }
    assert.ok(worstSeam < 1e-10 * SIZE, `${tag}: seam gap ${worstSeam}`);
  }
  assert.ok(glideEdges >= 2 * CASES.length * AMPS.length, `glide-sewn edges were checked (${glideEdges})`);
});

test('klein: at(0) is the identity; the motion is continuous (200 steps and the inner stops), finite everywhere, and stays on or above the plane', () => {
  const u = [0, 0, 0];
  for (const { mesh: M, fold, tag } of everyCase()) {
    const F0 = fold.at(0);
    for (let v = 0; v < M.n; v += 13) { F0(M.xy[2 * v], M.xy[2 * v + 1], 0, u); assert.deepEqual(u, [M.xy[2 * v], M.xy[2 * v + 1], 0]); }
    const ts = [];
    for (let i = 0; i <= 200; i++) ts.push(i / 200);
    ts.push(STAGE.klein.t1, STAGE.klein.t2, STAGE.klein.t1 - 1e-15, STAGE.klein.t2 + 1e-15, 1e-300, 1 - 1e-16);
    ts.sort((a, b) => a - b);
    let prev = null, maxStep = 0, minZ = Infinity;
    for (const tt of ts) {
      const F = fold.at(tt), cur = new Float64Array(3 * Math.ceil(M.n / 9));
      for (let v = 0, j = 0; v < M.n; v += 9, j += 3) {
        F(M.xy[2 * v], M.xy[2 * v + 1], 0, u);
        assert.ok(Number.isFinite(u[0] + u[1] + u[2]), `${tag}: not finite at t = ${tt}`);
        cur[j] = u[0]; cur[j + 1] = u[1]; cur[j + 2] = u[2]; minZ = Math.min(minZ, u[2]);
      }
      if (prev) for (let j = 0; j < cur.length; j += 3) maxStep = Math.max(maxStep, Math.hypot(cur[j] - prev[j], cur[j + 1] - prev[j + 1], cur[j + 2] - prev[j + 2]));
      prev = cur;
    }
    assert.ok(maxStep < 0.06 * SIZE, `${tag}: a vertex jumps ${maxStep / SIZE} tile sizes in a step`);
    // the lift is the 8's support over the turns present along the tube (sampled while they are not upright): the
    // lowest cross-section rests on the plane to within the sampling (v1 dipped 6e-6 tile sizes where the stages overlap)
    assert.ok(minZ > -1e-4 * SIZE, `${tag}: dips below the plane (${minZ})`);
  }
});

test('klein: until the 8 starts to lie down it is v1 exactly; at t = 1 it is v1\'s bottle turned about the vertical through its centre by the spin', () => {
  const ax = [0, 0, 0], bx = [0, 0, 0], rnd = prng(11);
  for (const { domain: d, mesh: M, fold, tag } of everyCase()) {
    const v1 = createRoll(XX, d, M, { density: false, tune: V1 });
    assert.equal(v1.mesh, M);
    const tFlat = fold.params.flatTimes[0];
    assert.ok(tFlat > 0.05 && tFlat < STAGE.klein.t2, `the 8 starts to lie down at t = ${tFlat}, while it closes`);
    for (const tt of [0.02, 0.5 * tFlat, tFlat]) {
      const F = fold.at(tt), G = v1.at(tt);
      for (let v = 0; v < M.n; v += 11) {
        F(M.xy[2 * v], M.xy[2 * v + 1], 0, ax); G(M.xy[2 * v], M.xy[2 * v + 1], 0, bx);
        assert.ok(ax[0] === bx[0] && ax[1] === bx[1] && ax[2] === bx[2], `${tag}: at(${tt}) differs from v1`);
      }
    }
    // at t = 1: flat -1/2 turn + phase 1/2 turn = v1's turn of the 8, and the spin turns the ring about the vertical
    // through its centre (the seed): point for point
    const P = fold.params, [x0, y0] = P.center;
    assert.deepEqual(P.center, v1.params.center);
    // the seam closes 30 to 60 degrees from the front (the spin turns it from the far left): its 8s are seen at least
    // 0.29 of face-on (0.574 sin 30 degrees), and the tube's surface there, with the comma's two parts, faces the camera
    assert.ok(Math.abs(P.flat + Math.PI / 2) < 1e-15 && P.spin >= Math.PI / 6 - 1e-15 && P.spin <= Math.PI / 3 + 1e-15, `flat ${P.flat}, spin ${P.spin}`);
    const F = fold.at(1), G = v1.at(1), c = Math.cos(P.spin), s = Math.sin(P.spin);
    for (let i = 0; i < 100; i++) {
      const x = x0 + (2 * rnd() - 1) * SIZE, y = y0 + (2 * rnd() - 1) * SIZE;
      F(x, y, 0, ax); G(x, y, 0, bx);
      const rx = x0 + c * (bx[0] - x0) - s * (bx[1] - y0), ry = y0 + s * (bx[0] - x0) + c * (bx[1] - y0);
      const dd = Math.hypot(ax[0] - rx, ax[1] - ry, ax[2] - bx[2]);
      assert.ok(dd < 1e-9 * SIZE, `${tag}: at(1) is not v1's bottle turned by the spin (${dd})`);
    }
  }
});

test('klein: the 8 lies down while it closes (62 degrees at the inner stop, flat from flatTo on, at the +A/2 end ever after); the end at -A/2 is turned by pi w relative to it', () => {
  const pc = [0, 0, 0], pt = [0, 0, 0], pa = [0, 0, 0], pb = [0, 0, 0];
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  for (const { fold, tag } of everyCase()) {
    const P = fold.params, [x0, y0] = P.center, [ax, ay] = P.axis, [sx, sy] = P.across, A = P.glide, b = P.period;
    const [fa, fb] = P.flatTimes, rho = (t) => { const x = Math.min(1, Math.max(0, (t - fa) / (fb - fa))); return Math.abs(P.flat) * (0.5 - 0.5 * Math.cos(Math.PI * x)); };
    const ts = [STAGE.klein.t1, 0.5, fb, 0.7, 0.8, 0.9, 0.95, 1];
    // the glide axis nearest the seed: the 8 crosses itself there, its lobes reach their tips a quarter period across
    const gl = symmetryElements(XX, x0, y0, b).glides.filter((g) => Math.abs(g.ux * ay - g.uy * ax) < 1e-9);
    const off = (g) => (x0 - g.px) * sx + (y0 - g.py) * sy;
    const g0 = gl.reduce((best, g) => (Math.abs(off(g)) < Math.abs(off(best)) ? g : best));
    const fx = x0 - off(g0) * sx, fy = y0 - off(g0) * sy;                  // the foot of the seed on that axis
    // the tip of a lobe seen from the crossing, at an end of the tile, in that end's cross-section: [along the
    // horizontal normal of the tube there, up]; the tube's direction from two nearby points of the axis
    const turn = (F, end) => {
      const cx = fx + end * (A / 2) * ax, cy = fy + end * (A / 2) * ay;    // the crossing at that end
      F(cx, cy, 0, pc); F(cx + (b / 4) * sx, cy + (b / 4) * sy, 0, pt);
      F(cx - 1e-4 * ax, cy - 1e-4 * ay, 0, pa); F(cx + 1e-4 * ax, cy + 1e-4 * ay, 0, pb);
      const tx = pb[0] - pa[0], ty = pb[1] - pa[1], tl = Math.hypot(tx, ty);
      const vx = pt[0] - pc[0], vy = pt[1] - pc[1], vz = pt[2] - pc[2];
      return { side: (vx * -ty + vy * tx) / tl, up: vz, ahead: (vx * tx + vy * ty) / tl };
    };
    for (const tt of ts) {
      const F = fold.at(tt), w = rollSchedule('klein', tt).w;
      const h = turn(F, 1), k = turn(F, -1);
      assert.ok(Math.abs(h.ahead) < 1e-6 * SIZE && Math.abs(k.ahead) < 1e-6 * SIZE, `${tag}: at t = ${tt} the cross-sections are not square to the tube`);
      // the 8 at +A/2: turned from upright by the flat turn alone (it holds through the ring stage); the line through
      // its lobes' tips, so the angle is taken mod pi (a quarter period from an odd glide axis is the lower lobe)
      const fromUp = Math.atan2(Math.abs(h.side), Math.abs(h.up));
      assert.ok(Math.abs(fromUp - rho(tt)) < 1e-6, `${tag}: at t = ${tt} the 8 at +A/2 is ${fromUp} from upright, not ${rho(tt)}`);
      if (tt >= fb) assert.ok(Math.abs(h.up) < 1e-9 * SIZE, `${tag}: at t = ${tt} the 8 at +A/2 does not lie flat`);
      // the 8 at -A/2, relative to it: pi w
      const rel = Math.abs(wrap(Math.atan2(k.side, k.up) - Math.atan2(h.side, h.up)));
      assert.ok(Math.abs(rel - Math.PI * w) < 1e-6, `${tag}: at t = ${tt} the 8 at -A/2 is turned by ${rel} relative to the one at +A/2, not pi w = ${Math.PI * w}`);
    }
    // 62 degrees of the quarter turn at the inner stop
    assert.ok(Math.abs(rho(STAGE.klein.t1) - (62 * Math.PI) / 180) < 0.02, `at the inner stop the 8 has turned ${(180 / Math.PI) * rho(STAGE.klein.t1)} degrees`);
  }
});

test('the unit comma: a closed outline (the glyph motifTintMesh cuts along)', () => {
  const u = commaOutline();
  assert.equal(u[0], u[u.length - 2]); assert.equal(u[1], u[u.length - 1]);
});

// ---------------------------------------------------------------------------------------------------------------
// the scene the app draws (src/app.js, ui-app's file)
// ---------------------------------------------------------------------------------------------------------------

test('xx scene (app.js): draws fold.mesh with the comma cut in; flat at t = 0; seams and the comma close at t = 1', async () => {
  const app = await import('../src/app.js');
  for (const c of CASES) {
    for (const amp of AMPS) {
      const sc = app.buildScene(XX, { seed: c.seed, metric: c.metric, amp, anchor: c.anchor }), tag = `${c.label}, amp ${amp}`;
      assert.equal(sc.M, sc.fold.mesh, 'the scene draws fold.mesh');
      assert.ok(sc.M.motifTint && sc.M.tint.length === sc.n, `${tag}: the comma is cut into the mesh`);
      app.mapScene(sc, 0);
      for (let v = 0; v < sc.n; v += 7) {
        assert.equal(sc.pos[3 * v], sc.M.xy[2 * v]); assert.equal(sc.pos[3 * v + 1], sc.M.xy[2 * v + 1]); assert.equal(sc.pos[3 * v + 2], 0);
      }
      app.mapScene(sc, 1);
      const gap = app.seamGap(sc);
      assert.ok(gap < 1e-6, `${tag}: seam gap ${gap}`);
      // every end of a comma piece lies on a cut edge; at t = 1 it meets the end glued to it
      const d = sc.domain, F = sc.fold.at(1), u = [0, 0, 0], w = [0, 0, 0], q = [0, 0], tmp = [0, 0];
      const ends = [];
      for (const pl of motifInTile(XX, d, motifFor(XX))) {
        const k = pl.length / 2;
        if (pl[0] !== pl[2 * k - 2] || pl[1] !== pl[2 * k - 1]) ends.push([pl[0], pl[1]], [pl[2 * k - 2], pl[2 * k - 1]]);
      }
      if (c === CASES[0]) assert.ok(ends.length >= 4, `${tag}: the default cut cuts the comma`);
      for (const [x, y] of ends) {
        let ei = -1, best = Infinity;
        d.warp.inv(x, y, tmp);
        d.edges.forEach((e, i) => { const s = Math.abs(e.nx * tmp[0] + e.ny * tmp[1] - e.c); if (s < best) { best = s; ei = i; } });
        assert.ok(best < 1e-6 * SIZE, `${tag}: a piece ends off the boundary (${best})`);
        apply(inverse(d.edges[ei].g), x, y, q);
        let match = Infinity;
        for (const [x2, y2] of ends) match = Math.min(match, Math.hypot(q[0] - x2, q[1] - y2));
        assert.ok(match < 1e-5 * SIZE, `${tag}: the glued point of a piece's end is not an end (${match})`);
        F(x, y, 0, u); F(q[0], q[1], 0, w);
        assert.ok(dist3(u, w) < 1e-6 * SIZE, `${tag}: the two ends do not meet at t = 1`);
      }
    }
  }
});
