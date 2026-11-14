// test/bottle.test.js — xx (pg) folds into the CLASSIC Klein bottle (src/folds/bottle.js; 14 Nov 2026, the owner: "I
// expected to see a Klein bottle and only one surface; however, if I look through it, I see two surfaces"). What this
// file holds the fold to:
//   the shape     one tube: the pieces of its keel add up, the keel closes, the proportions stay sane;
//   the map       the identity at 0; at 1 invariant under the group, so every tile closes; the two rims of the default
//                 tile lie ON the body's wall, point for point (the glide seam is sewn through the wall);
//   the motion    three moves (flap, roll, hook), each seam closing when its move ends; smooth; on or above the plane;
//   no crossing   the default tile folds with no paper passing through paper (the detector of the 22x lab);
//   the anchor    the closed shape is the same for every cut that shares the anchor; a cut far from it comes back;
//   the app       the scene of xx draws this fold, and says what each move does.
// (The figure-8 bottle this replaced stays in src/folds/roll.js and its tests, test/klein.test.js, test/roll*.test.js.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { BY_ID } from '../src/groups.js';
import { apply, inverse, compose } from '../src/geom.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import { createFold, foldMeshOptions } from '../src/folds/index.js';
import createBottle, { bottleShape, SHAPE, TUNE } from '../src/folds/bottle.js';
import { createSelfX, jitterPlane, rimTriangles } from '../src/selfx.js';
import { buildScene, mapScene, foldCaption } from '../src/app.js';

const XX = BY_ID.xx, SIZE = Math.sqrt(XX.domainArea);
const B = Math.hypot(XX.e1[0], XX.e1[1]), A = Math.abs(XX.reps[1].ty);        // 0.9 across the glide axes, 1.7 along
const HOME = XX.presets[0];
const NONE = 0.004;                                                            // tile widths: below this nothing is crossing

function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function make(group, seed, anchor, amp = 0, opts = {}) {
  const domain = buildDomain(group, { seed, warp: makeWarp(group, amp) });
  const mesh = buildMesh(group, domain, foldMeshOptions(group));
  return { domain, mesh, fold: createBottle(group, domain, mesh, anchor ? { anchor, ...opts } : opts) };
}
const home = make(XX, HOME.seed, HOME.seed);
const dist = (u, w) => Math.hypot(u[0] - w[0], u[1] - w[1], u[2] - w[2]);
/** Positions of plane points (xy, 2n) at t -> Float64Array(3n). */
function place(fold, t, xy, out = new Float64Array((xy.length / 2) * 3)) {
  const F = fold.at(t), o = [0, 0, 0];
  for (let i = 0, j = 0; i < xy.length; i += 2, j += 3) { F(xy[i], xy[i + 1], 0, o); out[j] = o[0]; out[j + 1] = o[1]; out[j + 2] = o[2]; }
  return out;
}
/** The largest gap between the sewn partners of a tile's cut edges of one kind (glide: orientation-reversing) at t. */
function seamGap(domain, mesh, fold, t, wantGlide) {
  const F = fold.at(t), o = [0, 0, 0], o2 = [0, 0, 0], q = [0, 0];
  let gap = 0, n = 0;
  for (const b of mesh.boundary) {
    const e = domain.edges[b.edge];
    if (e.kind !== 'cut') continue;
    const glide = e.g.a * e.g.d - e.g.b * e.g.c < 0;
    if (wantGlide !== null && glide !== wantGlide) continue;
    const gi = inverse(e.g);
    for (let j = 0; j < b.pts.length; j += 2) {
      apply(gi, b.pts[j], b.pts[j + 1], q);
      F(b.pts[j], b.pts[j + 1], 0, o); F(q[0], q[1], 0, o2);
      gap = Math.max(gap, dist(o, o2)); n++;
    }
  }
  return { gap, n };
}

// ---------------------------------------------------------------------------------------------------------------
// the shape
// ---------------------------------------------------------------------------------------------------------------

test('the bottle: one tube — the keel\'s pieces add up to the tile, the neck is narrower than the body, every arc is wider than the neck', () => {
  const S = bottleShape(B, A);
  assert.equal(S.L.length, 11); assert.equal(S.names.length, 11);
  let Q = 0, len = 0;
  for (let i = 0; i < 11; i++) { assert.ok(S.L[i] > 0, `${S.names[i]}: ${S.L[i]}`); Q += S.L[i]; len += S.len[i]; }
  assert.ok(Math.abs(Q - S.Q) < 1e-12 && Math.abs(len - A) < 1e-12, 'the pieces are the whole tile, rim to rim');
  assert.ok(Math.abs(S.eta[0] + A / 2) < 1e-12 && Math.abs(S.eta[11] - A / 2) < 1e-12);
  for (let i = 0; i < 11; i++) assert.ok(S.eta[i + 1] > S.eta[i]);
  // proportions (in units of b: SHAPE)
  assert.ok(Math.abs(S.Rb - SHAPE.Rb * B) < 1e-12 && Math.abs(S.rn - SHAPE.rn * B) < 1e-12);
  assert.ok(S.rn < 0.6 * S.Rb && S.rn > 0.3 * S.Rb, 'a neck, not a thread');
  assert.ok(Math.abs(S.g - (S.Rb - S.rn)) < 1e-12, 'the gap between the neck inside and the wall');
  assert.ok(S.rho2 > 1.08 * S.rn && S.rho3 > 1.08 * S.rn && S.hook > 1.08 * S.rn, 'no arc tighter than the neck is wide');
  assert.ok(2 * S.hook > S.Rb + S.rn, 'the neck comes down clear of the body');
  // the paper: stretched across by 2 pi r / b, along by sigma — gently
  assert.ok(S.sigma > 1 && S.sigma < 1.2, `stretch along ${S.sigma}`);
  assert.ok(Math.abs(S.mu1 - (2 * Math.PI * S.Rb) / B) < 1e-12 && S.mu1 < 1.35, `stretch across on the body ${S.mu1}`);
  assert.ok((2 * Math.PI * S.rn) / B > 0.5, 'the neck is not squeezed to less than half');
  // the held row is in the body
  assert.ok(S.ref > S.eta[4] && S.ref < S.eta[5]);
  // other tiles of the same proportions give the same bottle, scaled
  const S2 = bottleShape(2 * B, 2 * A);
  assert.ok(Math.abs(S2.Q - 2 * S.Q) < 1e-9 && Math.abs(S2.sigma - S.sigma) < 1e-12);
  // and a tile far too short or too long for it is refused, with words
  assert.throws(() => bottleShape(B, 0.6 * A), /bottle: the tile is too short/);
  assert.throws(() => bottleShape(B, 3 * A), /bottle: the tile is too long/);
  assert.throws(() => bottleShape(B, A, { ...SHAPE, rn: SHAPE.Rb * 1.1 }), /narrower than the body/);
  assert.throws(() => bottleShape(B, A, { ...SHAPE, hook: 0.1 }), /bottle:/);
});

// ---------------------------------------------------------------------------------------------------------------
// the map at the two ends
// ---------------------------------------------------------------------------------------------------------------

test('the fold interface: type klein, the mesh as given, four stops, 7 s, the three moves in order', () => {
  const f = home.fold;
  assert.equal(f.type, 'klein');
  assert.equal(f.mesh, home.mesh, 'a mesh built with foldMeshOptions is used as it is');
  assert.equal(f.duration, TUNE.duration); assert.ok(f.duration >= 4 && f.duration <= 7);
  assert.deepEqual(f.stops.map((s) => s.t), [0, TUNE.tF, TUNE.tR, 1]);
  assert.deepEqual(f.stops.map((s) => s.label), ['flat', 'folded over', 'tube in a tube', 'Klein bottle']);
  assert.deepEqual(f.anchor, HOME.seed.slice());
  assert.equal(f.params.moved, false); assert.equal(f.params.flip, false);
  // the schedule: each move 0 -> 1, monotone, in order, overlapping the next by TUNE.ov
  let prev = { f: 0, a: 0, h: 0 };
  for (let k = 0; k <= 400; k++) {
    const t = k / 400, s = f.schedule(t);
    for (const key of ['f', 'a', 'h']) { assert.ok(s[key] >= prev[key] - 1e-15 && s[key] >= 0 && s[key] <= 1, `${key} at ${t}`); }
    assert.ok(s.f >= s.a && s.a >= s.h, `in order at ${t}`);
    prev = s;
  }
  assert.equal(f.schedule(0).f, 0); assert.equal(f.schedule(TUNE.tF).f, 1); assert.equal(f.schedule(TUNE.tR).a, 1); assert.equal(f.schedule(1).h, 1);
  assert.equal(f.schedule(TUNE.tF - TUNE.ov).a, 0); assert.ok(f.schedule(TUNE.tF).a > 0, 'the roll has begun when the flap lands');
  assert.equal(f.schedule(TUNE.tR - TUNE.ov).h, 0); assert.ok(f.schedule(TUNE.tR).h > 0, 'the hook has begun when the tube closes');
  // the words
  assert.equal(f.stage(0).stage, 'flat'); assert.equal(f.stage(0.1).stage, 'flap'); assert.equal(f.stage(0.45).stage, 'roll');
  assert.equal(f.stage(0.8).stage, 'hook'); assert.equal(f.stage(1).stage, 'closed');
  for (const t of [0.1, 0.45, 0.8, 1]) assert.ok(f.stage(t).text.length > 10);
});

test('at(0) is the identity, exactly; just after 0 the sheet has hardly moved', () => {
  const M = home.mesh, o = [0, 0, 0];
  for (const t of [0, -1, NaN]) {
    const F = home.fold.at(t);
    for (let i = 0; i < M.n; i += 7) { F(M.xy[2 * i], M.xy[2 * i + 1], 0, o); assert.ok(o[0] === M.xy[2 * i] && o[1] === M.xy[2 * i + 1] && o[2] === 0); }
  }
  const P = place(home.fold, 1e-7, M.xy);
  for (let i = 0; i < M.n; i++) assert.ok(Math.hypot(P[3 * i] - M.xy[2 * i], P[3 * i + 1] - M.xy[2 * i + 1], P[3 * i + 2]) < 1e-5 * SIZE);
});

test('at(1) is invariant under the glide, its inverse and the translations, at random points of the plane; every seam of the default tile closes to 1e-10', () => {
  const rnd = prng(20261114), F = home.fold.at(1), o = [0, 0, 0], o2 = [0, 0, 0], q = [0, 0];
  const glide = XX.reps[1], els = [glide, inverse(glide), compose(glide, glide), { a: 1, b: 0, c: 0, d: 1, tx: XX.e1[0], ty: XX.e1[1] }, { a: 1, b: 0, c: 0, d: 1, tx: -XX.e1[0], ty: -XX.e1[1] }];
  let worst = 0;
  for (let k = 0; k < 600; k++) {
    const x = -3 + 6 * rnd(), y = -4 + 9 * rnd();
    F(x, y, 0, o);
    assert.ok(Number.isFinite(o[0] + o[1] + o[2]));
    for (const g of els) { apply(g, x, y, q); F(q[0], q[1], 0, o2); worst = Math.max(worst, dist(o, o2)); }
  }
  assert.ok(worst < 1e-10 * SIZE, `largest difference ${worst}`);
  // and under nothing else: a half-turn or the mirror image moves points
  F(0.2, 0.5, 0, o); F(-0.2, 0.5, 0, o2);
  assert.ok(dist(o, o2) > 0.05 * SIZE, 'the mirror in a glide axis is not in the group');
  const s = seamGap(home.domain, home.mesh, home.fold, 1, null);
  assert.ok(s.n > 100 && s.gap < 1e-10 * SIZE, `seam gap ${s.gap} over ${s.n} sewn pairs`);
});

test('the two rims of the default tile end ON the body\'s wall at t = 1, one from outside and one from inside: the glide seam is sewn through the wall', () => {
  const { domain, mesh, fold } = home, W = fold.params.wall, ax = fold.params.axis, o = [0, 0, 0], F = fold.at(1);
  // distance of a point from the body's axis (a line along `axis` through W.point)
  const off = (p) => { const dx = p[0] - W.point[0], dy = p[1] - W.point[1], al = dx * ax[0] + dy * ax[1]; return { r: Math.hypot(dx - al * ax[0], dy - al * ax[1], p[2] - W.point[2]), al }; };
  let n = 0, worst = 0, lo = Infinity, hi = -Infinity;
  for (const b of mesh.boundary) {
    const e = domain.edges[b.edge];
    if (e.kind !== 'cut' || e.g.a * e.g.d - e.g.b * e.g.c > 0) continue;       // the glide-sewn edges: the two rims
    for (let j = 0; j < b.pts.length; j += 2) {
      F(b.pts[j], b.pts[j + 1], 0, o);
      const d = off(o);
      worst = Math.max(worst, Math.abs(d.r - W.radius)); lo = Math.min(lo, d.al); hi = Math.max(hi, d.al); n++;
    }
  }
  // (the mesh's own boundary samples lie within 1e-7 of the tile's edge)
  assert.ok(n > 60 && worst < 1e-6 * SIZE, `a rim point lies ${worst} off the wall (${n} points)`);
  // exactly, on the edges themselves: along = anchor +- A/2
  const c0 = fold.params.center, acr0 = fold.params.across, half = fold.params.glide / 2;
  for (const sgn of [1, -1]) for (let k = 0; k <= 64; k++) {
    const s = -0.5 * B + (B * k) / 64;
    F(c0[0] + s * acr0[0] + sgn * half * ax[0], c0[1] + s * acr0[1] + sgn * half * ax[1], 0, o);
    assert.ok(Math.abs(off(o).r - W.radius) < 1e-12, `on the wall: ${off(o).r - W.radius}`);
  }
  // the curve is a saddle on the cylinder of the body, about as long along the body as the neck is wide
  const P = fold.params;
  assert.ok(hi - lo > 1.9 * P.neckRadius && hi - lo < 2.6 * P.neckRadius, `the curve spans ${hi - lo} along the body`);
  // just inside either rim the paper is on its own side of the wall: the outer neck outside, the inner neck inside
  const acr = P.across, A2 = P.glide / 2, c = fold.params.center;
  let out = 0, inn = 0;
  for (let k = 0; k < 40; k++) {
    const s = -0.45 * B + (0.9 * B * k) / 39;
    F(c[0] + s * acr[0] + (A2 - 0.06) * ax[0], c[1] + s * acr[1] + (A2 - 0.06) * ax[1], 0, o); if (off(o).r > W.radius) out++;
    F(c[0] + s * acr[0] - (A2 - 0.06) * ax[0], c[1] + s * acr[1] - (A2 - 0.06) * ax[1], 0, o); if (off(o).r < W.radius) inn++;
  }
  assert.equal(out, 40, 'the neck arrives from outside'); assert.equal(inn, 40, 'its other end waits inside');
  // fold.doubleLine(1): the same curve, twice (the tile's two glide edges), and flat lines of the tile at t = 0
  const L1 = fold.doubleLine(1), L0 = fold.doubleLine(0);
  assert.equal(L1.length, 2); assert.equal(L0.length, 2);
  for (const ln of L1) for (let i = 0; i < ln.length; i += 3) assert.ok(Math.abs(off([ln[i], ln[i + 1], ln[i + 2]]).r - W.radius) < 1e-5 * SIZE);
  for (const ln of L0) for (let i = 2; i < ln.length; i += 3) assert.equal(ln[i], 0);
});

test('the closed shape: a body of the body\'s radius, a neck of the neck\'s, resting on the plane, centred on the anchor, toward +across the hook', () => {
  const { mesh, fold } = home, P = fold.params, W = P.wall, ax = P.axis, acr = P.across;
  const X = place(fold, 1, mesh.xy);
  let zmin = Infinity, zmax = -Infinity, sLo = Infinity, sHi = -Infinity, aLo = Infinity, aHi = -Infinity;
  for (let i = 0; i < mesh.n; i++) {
    const z = X[3 * i + 2], s = (X[3 * i] - P.center[0]) * acr[0] + (X[3 * i + 1] - P.center[1]) * acr[1], al = (X[3 * i] - P.center[0]) * ax[0] + (X[3 * i + 1] - P.center[1]) * ax[1];
    zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); sLo = Math.min(sLo, s); sHi = Math.max(sHi, s); aLo = Math.min(aLo, al); aHi = Math.max(aHi, al);
  }
  // (the lowest and highest vertices are within a facet's sag of the floor and of the top of the body)
  assert.ok(zmin > -1e-9 && zmin < 1e-3 * SIZE && Math.abs(zmax - 2 * P.bodyRadius) < 2e-3 * SIZE, `heights ${zmin} .. ${zmax}`);
  assert.ok(Math.abs(sLo + sHi) < 0.02 * SIZE && Math.abs(aLo + aHi) < 0.02 * SIZE, `centred on the anchor: across ${sLo} .. ${sHi}, along ${aLo} .. ${aHi}`);
  assert.ok(sHi - sLo < 0.8 * B && aHi - aLo < 0.6 * A, 'smaller than the tile');
  // on the body's cylinder the rows are circles of the body's radius about its axis (rows half way up the body)
  const o = [0, 0, 0], F = fold.at(1), S = P.shape, mid = 0.5 * (S.eta[4] + S.eta[5]);
  for (let k = 0; k < 48; k++) {
    const s = -0.5 * B + (B * k) / 48;
    F(P.center[0] + s * acr[0] + mid * ax[0], P.center[1] + s * acr[1] + mid * ax[1], 0, o);
    const dx = o[0] - W.point[0], dy = o[1] - W.point[1], al = dx * ax[0] + dy * ax[1];
    assert.ok(Math.abs(Math.hypot(dx - al * ax[0], dy - al * ax[1], o[2] - W.point[2]) - P.bodyRadius) < 1e-9);
  }
  // on the hook the rows are circles of the neck's radius: any two opposite points are a neck's width apart
  const hk = 0.5 * (S.eta[7] + S.eta[8]), o2 = [0, 0, 0];
  for (let k = 0; k < 12; k++) {
    const s = -0.5 * B + (B * k) / 24;
    F(P.center[0] + s * acr[0] + hk * ax[0], P.center[1] + s * acr[1] + hk * ax[1], 0, o);
    F(P.center[0] + (s + B / 2) * acr[0] + hk * ax[0], P.center[1] + (s + B / 2) * acr[1] + hk * ax[1], 0, o2);
    assert.ok(Math.abs(dist(o, o2) - 2 * P.neckRadius) < 1e-9, 'a diameter of the neck');
  }
  // the hook is on the +across side of the body
  F(P.center[0] + hk * ax[0], P.center[1] + hk * ax[1], 0, o);
  assert.ok((o[0] - W.point[0]) * acr[0] + (o[1] - W.point[1]) * acr[1] > P.bodyRadius * 0.5);
});

// ---------------------------------------------------------------------------------------------------------------
// the motion
// ---------------------------------------------------------------------------------------------------------------

test('move 1, the flap: an isometry (paper bends, nothing stretches); the part that is not the flap lies still in the plane; the flap lands over the sheet, the gap between them the neck-to-wall gap', () => {
  const { mesh, fold } = home, P = fold.params, S = P.shape, ax = P.axis;
  const tri = mesh.tri, xy = mesh.xy;
  const t = TUNE.tF - TUNE.ov;                                    // the roll has not begun
  for (const tt of [0.4 * t, t]) {
    const X = place(fold, tt, xy);
    let worst = 0;
    for (let k = 0; k < tri.length; k += 3 * 5) {
      for (let e = 0; e < 3; e++) {
        const a = tri[k + e], b = tri[k + (e + 1) % 3];
        const d0 = Math.hypot(xy[2 * a] - xy[2 * b], xy[2 * a + 1] - xy[2 * b + 1]), d1 = Math.hypot(X[3 * a] - X[3 * b], X[3 * a + 1] - X[3 * b + 1], X[3 * a + 2] - X[3 * b + 2]);
        // a chord of the bent zone is shorter than the arc by its sagitta: second order in the mesh step
        worst = Math.max(worst, Math.abs(d1 - d0) / d0);
      }
    }
    assert.ok(worst < 0.02, `edge lengths change by ${worst} at t = ${tt}`);
    // rows beyond the rim of the base have not moved
    for (let i = 0; i < mesh.n; i++) {
      const eta = (xy[2 * i] - P.center[0]) * ax[0] + (xy[2 * i + 1] - P.center[1]) * ax[1];
      if (eta > S.eta[4] + 1e-9) assert.ok(Math.hypot(X[3 * i] - xy[2 * i], X[3 * i + 1] - xy[2 * i + 1], X[3 * i + 2]) < 1e-9, 'the sheet beyond the fold lies still');
      else if (eta < S.eta[3]) assert.ok(X[3 * i + 2] > 1e-4, 'the flap is up');
    }
  }
  // landed (f = 1; the roll has begun, hardly): the flap's rows lie level, about the gap above the sheet, turned over
  const X = place(fold, TUNE.tF, xy);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < mesh.n; i++) {
    const eta = (xy[2 * i] - P.center[0]) * ax[0] + (xy[2 * i + 1] - P.center[1]) * ax[1], s = (xy[2 * i] - P.center[0]) * P.across[0] + (xy[2 * i + 1] - P.center[1]) * P.across[1];
    if (eta < S.eta[2] && Math.abs(s) < 0.05 * B) { lo = Math.min(lo, X[3 * i + 2]); hi = Math.max(hi, X[3 * i + 2]); }
  }
  assert.ok(lo > 0.7 * (P.bodyRadius - P.neckRadius) && hi < 1.05 * (P.bodyRadius - P.neckRadius), `the flap lies ${lo} .. ${hi} above the sheet`);
});

test('move 2, the roll: the translation seam closes when the tube closes (to 1e-10) and stays closed; move 3, the hook: the glide seam is open until the very end', () => {
  const { domain, mesh, fold } = home;
  assert.ok(seamGap(domain, mesh, fold, 0.5 * TUNE.tR, false).gap > 0.05 * SIZE, 'open while it rolls');
  for (const t of [TUNE.tR, 0.5 * (TUNE.tR + 1), 0.93, 1]) {
    const s = seamGap(domain, mesh, fold, t, false);
    assert.ok(s.n > 50 && s.gap < 1e-10 * SIZE, `the translation seam at t = ${t}: ${s.gap}`);
  }
  let prev = Infinity;
  for (const t of [TUNE.tR, 0.7, 0.8, 0.9, 0.97, 0.995]) {
    const s = seamGap(domain, mesh, fold, t, true);
    assert.ok(s.gap > 1e-4 * SIZE, `the glide seam is still open at t = ${t}`);
    assert.ok(s.gap < prev, 'and closing');
    prev = s.gap;
  }
  assert.ok(seamGap(domain, mesh, fold, 1, true).gap < 1e-10 * SIZE);
  // a tube in a tube at the stop: the flap's rows are circles of the neck's radius inside circles of the body's
  const P = fold.params, S = P.shape, ax = P.axis, acr = P.across, F = fold.at(TUNE.tR), o = [0, 0, 0], o2 = [0, 0, 0];
  const inner = 0.5 * (S.eta[0] + S.eta[1]), body = 0.5 * (S.eta[4] + S.eta[5]);
  for (const [eta, want] of [[inner, 2 * P.neckRadius], [body, 2 * P.bodyRadius]]) {
    for (let k = 0; k < 8; k++) {
      const s = (B * k) / 16;
      F(P.center[0] + s * acr[0] + eta * ax[0], P.center[1] + s * acr[1] + eta * ax[1], 0, o);
      F(P.center[0] + (s - B / 2) * acr[0] + eta * ax[0], P.center[1] + (s - B / 2) * acr[1] + eta * ax[1], 0, o2);
      // (the hook has just begun, and with it the shear of the rows near a rim: 1e-9 here)
      assert.ok(Math.abs(dist(o, o2) - want) < 1e-6 * SIZE, `a diameter at the stop: ${dist(o, o2)} against ${want}`);
    }
  }
});

test('the default tile moves evenly: 200 steps, none above 0.025 tile sizes, second differences within 0.0014; finite; on or above the plane; no jump at the stops', () => {
  const { mesh, fold } = home, N = 200, n = mesh.n;
  const frames = [];
  for (let k = 0; k <= N; k++) frames.push(place(fold, k / N, mesh.xy));
  let step = 0, bend = 0, zmin = Infinity;
  for (let k = 0; k <= N; k++) {
    const X = frames[k];
    for (let i = 0; i < 3 * n; i += 3) {
      assert.ok(Number.isFinite(X[i] + X[i + 1] + X[i + 2]), `finite at ${k / N}`);
      zmin = Math.min(zmin, X[i + 2]);
      if (k > 0) step = Math.max(step, Math.hypot(X[i] - frames[k - 1][i], X[i + 1] - frames[k - 1][i + 1], X[i + 2] - frames[k - 1][i + 2]));
      if (k > 0 && k < N) bend = Math.max(bend, Math.hypot(frames[k + 1][i] - 2 * X[i] + frames[k - 1][i], frames[k + 1][i + 1] - 2 * X[i + 1] + frames[k - 1][i + 1], frames[k + 1][i + 2] - 2 * X[i + 2] + frames[k - 1][i + 2]));
    }
  }
  assert.ok(step / SIZE < 0.025, `largest step ${step / SIZE}`);
  assert.ok(bend / SIZE < 0.0014, `largest second difference ${bend / SIZE}`);
  assert.ok(zmin > -1e-9, `lowest point ${zmin}`);
  // no jump of position or velocity at the stops and where a move begins
  for (const t0 of [TUNE.tF - TUNE.ov, TUNE.tF, TUNE.tR - TUNE.ov, TUNE.tR]) {
    const h = 1e-5, a = place(fold, t0 - h, mesh.xy), b = place(fold, t0, mesh.xy), c = place(fold, t0 + h, mesh.xy);
    let d1 = 0, d2 = 0;
    for (let i = 0; i < 3 * n; i += 3) {
      d1 = Math.max(d1, Math.hypot(b[i] - a[i], b[i + 1] - a[i + 1], b[i + 2] - a[i + 2]), Math.hypot(c[i] - b[i], c[i + 1] - b[i + 1], c[i + 2] - b[i + 2]));
      d2 = Math.max(d2, Math.hypot(c[i] - 2 * b[i] + a[i], c[i + 1] - 2 * b[i + 1] + a[i + 1], c[i + 2] - 2 * b[i + 2] + a[i + 2]));
    }
    assert.ok(d1 < 6 * h * SIZE, `position at ${t0}: ${d1}`);
    assert.ok(d2 < 0.02 * d1 + 1e-12, `velocity at ${t0}: ${d2} against a step of ${d1}`);
  }
  // one time is not disturbed by asking for another
  const F = fold.at(0.5), o = [0, 0, 0], o2 = [0, 0, 0];
  F(0.1, 0.4, 0, o); fold.at(0.9)(0.3, 1.2, 0, o2); F(0.1, 0.4, 0, o2);
  assert.deepEqual(o, o2);
});

// ---------------------------------------------------------------------------------------------------------------
// no paper passes through paper
// ---------------------------------------------------------------------------------------------------------------

test('NO PAPER PASSES THROUGH PAPER: the default tile, 100 moments, the lab\'s detector (the rims within 0.03 tile sizes of the outline left out, as in test/recut.test.js: at t = 1 they end ON the wall)', () => {
  const { mesh, fold } = home, n = mesh.n;
  const uv = jitterPlane(mesh.xy, mesh.tri, mesh.triCell);
  const X = createSelfX(mesh.tri, { skip: rimTriangles(mesh.tri, n, { xy: mesh.xy, within: 0.03 * SIZE }) });
  const pos = new Float32Array(3 * n);
  let max = 0, at = 0;
  for (let s = 0; s <= 100; s++) {
    const P = place(fold, s / 100, uv);
    pos.set(P);
    const L = X.compute(pos, SIZE).length / SIZE;
    if (L > max) { max = L; at = s / 100; }
  }
  assert.ok(max < NONE, `the sheet passes through itself along ${max} tile widths at t = ${at}`);
  // the control: the same measure on a cut moved a quarter of the glide along finds the neck going through the wall
  const moved = make(XX, [HOME.seed[0], HOME.seed[1] + A / 4], HOME.seed);
  const uv2 = jitterPlane(moved.mesh.xy, moved.mesh.tri, moved.mesh.triCell), n2 = moved.mesh.n;
  const X2 = createSelfX(moved.mesh.tri, { skip: rimTriangles(moved.mesh.tri, n2, { xy: moved.mesh.xy, within: 0.03 * SIZE }) });
  const pos2 = new Float32Array(3 * n2);
  pos2.set(place(moved.fold, 1, uv2));
  const L2 = X2.compute(pos2, SIZE).length / SIZE;
  // all the way round the neck: 2 pi rn, in tile widths
  assert.ok(Math.abs(L2 - (2 * Math.PI * moved.fold.params.neckRadius) / SIZE) < 0.06, `the moved cut crosses along ${L2} tile widths`);
});

// ---------------------------------------------------------------------------------------------------------------
// the anchor, other cuts
// ---------------------------------------------------------------------------------------------------------------

test('the anchor (SPEC 7): at t = 1 every plane point goes where the anchor puts it, whatever the cut — dragged, wavy, a glide or a lattice away; such a cut starts as the identity and its seams close', () => {
  const rnd = prng(7), F0 = home.fold.at(1), o = [0, 0, 0], o2 = [0, 0, 0];
  const seeds = [[0.225, 0.85], [0.3, 0.2], [-0.4, 1.5], [0.05, 2.6], [1.3, 0.9], [-1.1, -0.9], [0.4, 4.1]];
  for (let k = 0; k < 6; k++) seeds.push([-2 + 4 * rnd(), -2 + 5 * rnd()]);
  let moved = 0, flipped = 0;
  for (const seed of seeds) for (const amp of [0, 1]) {
    const c = make(XX, seed, HOME.seed, amp), label = `seed (${seed[0].toFixed(3)}, ${seed[1].toFixed(3)}) amp ${amp}`;
    if (c.fold.params.moved) moved++;
    if (c.fold.params.flip) flipped++;
    const F1 = c.fold.at(1);
    let worst = 0;
    for (let i = 0; i < c.mesh.n; i += 3) {
      F1(c.mesh.xy[2 * i], c.mesh.xy[2 * i + 1], 0, o); F0(c.mesh.xy[2 * i], c.mesh.xy[2 * i + 1], 0, o2);
      worst = Math.max(worst, dist(o, o2));
    }
    assert.ok(worst < 1e-9 * SIZE, `${label}: ${worst} from where the anchor puts it`);
    assert.ok(seamGap(c.domain, c.mesh, c.fold, 1, null).gap < 1e-9 * SIZE, `${label}: seams`);
    // the start: exactly the identity at 0, and continuous into it
    const Fz = c.fold.at(0), Fe = c.fold.at(1e-7);
    for (let i = 0; i < c.mesh.n; i += 11) {
      Fz(c.mesh.xy[2 * i], c.mesh.xy[2 * i + 1], 0, o); assert.ok(o[0] === c.mesh.xy[2 * i] && o[1] === c.mesh.xy[2 * i + 1] && o[2] === 0);
      Fe(c.mesh.xy[2 * i], c.mesh.xy[2 * i + 1], 0, o); assert.ok(Math.hypot(o[0] - c.mesh.xy[2 * i], o[1] - c.mesh.xy[2 * i + 1], o[2]) < 1e-4 * SIZE, `${label}: continuous at 0`);
    }
    // finite and continuous all the way (60 steps: no step above 0.2 tile sizes; the far cuts travel back to the anchor)
    let prev = place(c.fold, 0, c.mesh.xy), big = 0;
    for (let s = 1; s <= 60; s++) {
      const cur = place(c.fold, s / 60, c.mesh.xy);
      for (let i = 0; i < cur.length; i += 3) {
        assert.ok(Number.isFinite(cur[i] + cur[i + 1] + cur[i + 2]), `${label}: finite at ${s / 60}`);
        big = Math.max(big, Math.hypot(cur[i] - prev[i], cur[i + 1] - prev[i + 1], cur[i + 2] - prev[i + 2]));
      }
      prev = cur;
    }
    // (a cut moved along the glide axes holds paper beyond a rim, which is drawn over to the other end of the tube;
    // a cut a lattice vector or a glide away also travels back: no jump, but long ways)
    const far = Math.hypot(seed[0] - HOME.seed[0], seed[1] - HOME.seed[1]);
    assert.ok(big < (0.2 + 0.08 * far) * SIZE, `${label}: a step of ${big / SIZE} tile sizes`);
  }
  assert.ok(moved >= 6 && flipped >= 3, `${moved} cuts a lattice or a glide away, ${flipped} of them turned over`);
  // no anchor: the cut is its own (anchor = seed)
  const own = make(XX, [0.3, 0.2], null), same = make(XX, [0.3, 0.2], [0.3, 0.2]);
  assert.equal(own.fold.anchor, null); assert.equal(own.fold.anchorImage, null);
  own.fold.at(0.6)(0.1, 0.3, 0, o); same.fold.at(0.6)(0.1, 0.3, 0, o2);
  assert.deepEqual(o, o2);
  assert.deepEqual(same.fold.anchorImage, [0.3, 0.2]);
});

test('nothing depends on how the group sits in the plane: turned by 37 and 90 degrees the same bottle comes out, turned', () => {
  for (const ang of [(37 * Math.PI) / 180, Math.PI / 2, -2.2]) {
    const c = Math.cos(ang), s = Math.sin(ang), R = { a: c, b: -s, c: s, d: c, tx: 0, ty: 0 }, Ri = inverse(R), v = (p) => [c * p[0] - s * p[1], s * p[0] + c * p[1]];
    const G = { ...XX, e1: v(XX.e1), e2: v(XX.e2), center: v(XX.center), reps: XX.reps.map((r) => compose(R, compose(r, Ri))), presets: XX.presets.map((p) => ({ ...p, seed: v(p.seed) })) };
    G.warp = G;
    const t = make(G, G.presets[0].seed, G.presets[0].seed);
    assert.ok(Math.abs(t.fold.params.bodyRadius - home.fold.params.bodyRadius) < 1e-12 && Math.abs(t.fold.params.stretch - home.fold.params.stretch) < 1e-12);
    const o = [0, 0, 0], o2 = [0, 0, 0];
    for (const tt of [0.2, 0.5, 0.8, 1]) {
      const F = home.fold.at(tt), Ft = t.fold.at(tt);
      let worst = 0;
      for (let i = 0; i < home.mesh.n; i += 17) {
        const x = home.mesh.xy[2 * i], y = home.mesh.xy[2 * i + 1], q = v([x, y]);
        F(x, y, 0, o); Ft(q[0], q[1], 0, o2);
        const w = v([o[0], o[1]]);
        worst = Math.max(worst, Math.hypot(w[0] - o2[0], w[1] - o2[1], o[2] - o2[2]));
      }
      // (a group turned by an odd angle may hook to the other side: the sense of `across` is fixed by the page, not the group)
      const mirrored = Math.abs(t.fold.params.across[0] * v(home.fold.params.across)[0] + t.fold.params.across[1] * v(home.fold.params.across)[1] + 1) < 1e-9;
      if (!mirrored) assert.ok(worst < 1e-9 * SIZE, `turned by ${ang.toFixed(2)} at t = ${tt}: ${worst}`);
      else assert.ok(seamGap(t.domain, t.mesh, t.fold, 1, null).gap < 1e-9 * SIZE);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// the app
// ---------------------------------------------------------------------------------------------------------------

test('the app: xx folds into this bottle (through the index, re-cut on); the default tile has nothing to re-cut and says what each move does; the Hexagon is re-cut first', () => {
  const dom = buildDomain(XX, { seed: HOME.seed, warp: makeWarp(XX, 0) });
  const f = createFold(XX, dom, null, { anchor: HOME.seed.slice(), recut: true });
  assert.equal(f.recut.movers, 0); assert.equal(f.recut.home.name, 'Rectangle');
  assert.equal(f.homeFold.type, 'klein'); assert.equal(typeof f.homeFold.params.wall, 'object', 'the home fold is the classic bottle');
  assert.deepEqual(f.stops.map((s) => s.label), ['flat', 'folded over', 'tube in a tube', 'Klein bottle']);
  // the words over the fold pane: one line per move, a short one for a phone
  assert.equal(foldCaption(f, 0), '');
  const words = [0.1, 0.45, 0.8, 1].map((t) => foldCaption(f, t)), short = [0.1, 0.45, 0.8, 1].map((t) => foldCaption(f, t, true));
  assert.equal(new Set(words).size, 4, 'four different lines');
  for (const w of words) assert.ok(w.length > 12 && w.length <= 70, w);
  for (const w of short) assert.ok(w.length > 8 && w.length <= 36, `short: ${w}`);
  assert.match(words[0], /folds over/); assert.match(words[1], /tube/); assert.match(words[2], /neck/); assert.match(words[3], /wall/);
  // the Hexagon: pieces first, then the same fold; its words are the re-cut's
  const g = XX.presets[1], dh = buildDomain(XX, { seed: g.seed, warp: makeWarp(XX, 0) });
  const fh = createFold(XX, dh, null, { anchor: g.seed.slice(), recut: true });
  assert.ok(fh.recut.movers >= 1);
  assert.match(foldCaption(fh, 0), /re-cuts the tile into the Rectangle/);
  assert.match(foldCaption(fh, 0.5 * (fh.recut.tau0 + 1)), /Rectangle folds/);
  // the scene of the app: mapped at every stop, finite, on the bottle at the end
  const scene = buildScene(XX, { seed: HOME.seed.slice(), anchor: HOME.seed.slice(), pattern: 'checker' });
  for (const s of scene.stops) { mapScene(scene, s.t); assert.equal(scene.nonFinite, 0, `stop ${s.label}`); }
  mapScene(scene, 1);
  assert.ok(scene.axis.length >= 1, 'the dashed curve is drawn');
});
