// crosscap-paint.test.js — the cross-cap's paint holds still while the shape folds (the cross-cap paint fixer,
// 10 Nov 2026; notes/crosscap-paint.md).
//
// The owner, 10 Nov 2026: "crosscap vis is weird, It's like the surface, the painting jumped from one side of the
// surface to another at one point. Fix that." The round-3 comma (the big filled comma, qa/fill-judge.md) lay on the
// Pocket's flap: the flap turns over toward the camera, its swing plane holds the default camera's line of sight, so the
// whole comma squashed to a line at t ~ 0.23 and came back, mirrored, on the other side of the shape. With the Bowl and
// the Hexagon it lay on the near part that stage 2 rolls over (t ~ 0.73). tools/motif-place.mjs now holds the
// cross-cap's comma to the part of the sheet that no preset's fold turns over (STILL, a hard rule of the placement
// search): the far half of the cell the closed shape sits on. With round 3's flaps (toward +z) that sheet ended at the
// BOTTOM, the comma under the top sheet; since the final fix the flaps tuck under (FLAPS = 'under'), and the last two
// tests hold the comma on top at t = 1.
//
// Measured here APART from the tool (whose field is a grid of points): on the mesh the app draws (src/app.js buildScene:
// the fold's mesh with the comma cut in, tint bit 1), every filled triangle followed through the play in 1/120 steps:
//   turnsOver  the share of the comma's area whose triangle's normal turns more than STILL.turn (120) degrees away from
//              +z at some time (a sheet that passes edge-on and shows its other side: a flap, a rolled near part)
//   path       the area-weighted mean length of the path its centroid travels (tile sizes)
//   far        the largest distance any of it gets from where it started (tile sizes)
// and the same for the round-3 comma (a control: the measure sees the jump the owner saw).
import test from 'node:test';
import assert from 'node:assert/strict';
import { BY_ID } from '../src/groups.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import { createFold, foldMeshOptions, foldOptions } from '../src/folds/index.js';
import { buildScene, presetState } from '../src/app.js';
import { motifTintMesh, commaOutline } from '../src/motif.js';
import { viewFromAzEl, __test as R3 } from '../src/render3d.js';
import { FLAPS } from '../src/folds/crosscap.js';
import { PLACEMENTS } from '../src/groupdata/motif.js';
import { STILL } from '../tools/motif-place.mjs';

const G = BY_ID['22x'], size = Math.sqrt(G.domainArea), K = 120;
/** The round-3 table entry of 22x (the comma on the Pocket's flap), for the control. */
const ROUND3 = { at: [0.290221, 1.287773], angle: 5.334285, s: 0.334255 };

/** How the filled part of a drawn mesh M moves under fold: { turnsOver, maxTurn, path, far, area }. */
function paintMotion(M, fold) {
  const T = M.tri, tint = M.tint, tris = [];
  for (let i = 0; i < T.length; i += 3) {
    const a = T[i], b = T[i + 1], c = T[i + 2];
    if (!(tint[a] & 2 && tint[b] & 2 && tint[c] & 2)) continue;
    const ar = ((M.xy[2 * b] - M.xy[2 * a]) * (M.xy[2 * c + 1] - M.xy[2 * a + 1]) - (M.xy[2 * b + 1] - M.xy[2 * a + 1]) * (M.xy[2 * c] - M.xy[2 * a])) / 2;
    if (ar > 1e-12) tris.push([a, b, c, ar]);
  }
  const area = tris.reduce((s, q) => s + q[3], 0);
  const turn = new Float64Array(tris.length), path = new Float64Array(tris.length), far = new Float64Array(tris.length);
  const pos = new Float64Array(3 * M.n), o = [0, 0, 0];
  let prev = null, start = null;
  for (let k = 0; k <= K; k++) {
    const F = fold.at(k / K);
    for (let v = 0; v < M.n; v++) { F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], o); pos[3 * v] = o[0]; pos[3 * v + 1] = o[1]; pos[3 * v + 2] = o[2]; }
    const cen = new Float64Array(3 * tris.length);
    tris.forEach(([a, b, c], i) => {
      const ux = pos[3 * b] - pos[3 * a], uy = pos[3 * b + 1] - pos[3 * a + 1], uz = pos[3 * b + 2] - pos[3 * a + 2];
      const vx = pos[3 * c] - pos[3 * a], vy = pos[3 * c + 1] - pos[3 * a + 1], vz = pos[3 * c + 2] - pos[3 * a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l > 1e-18) turn[i] = Math.max(turn[i], (Math.acos(Math.max(-1, Math.min(1, nz / l))) * 180) / Math.PI);
      for (let d = 0; d < 3; d++) cen[3 * i + d] = (pos[3 * a + d] + pos[3 * b + d] + pos[3 * c + d]) / 3;
    });
    if (!start) start = cen;
    if (prev) for (let i = 0; i < tris.length; i++) {
      path[i] += Math.hypot(cen[3 * i] - prev[3 * i], cen[3 * i + 1] - prev[3 * i + 1], cen[3 * i + 2] - prev[3 * i + 2]);
      far[i] = Math.max(far[i], Math.hypot(cen[3 * i] - start[3 * i], cen[3 * i + 1] - start[3 * i + 1], cen[3 * i + 2] - start[3 * i + 2]));
    }
    prev = cen;
  }
  let over = 0, maxTurn = 0, mean = 0, maxFar = 0;
  tris.forEach((q, i) => { if (turn[i] > STILL.turn) over += q[3]; maxTurn = Math.max(maxTurn, turn[i]); mean += q[3] * path[i]; maxFar = Math.max(maxFar, far[i]); });
  return { turnsOver: over / area, maxTurn, path: mean / area / size, far: maxFar / size, area: area / G.domainArea };
}

/** The app's scene of a cut (a preset, or a drag of it: same anchor, another seed). */
function appScene(preset, seed, amp = 0) {
  const st = presetState(G, preset);
  return buildScene(G, { seed: seed || st.seed, metric: st.metric, amp, anchor: st.anchor });
}
/** A fold of a cut painted with any comma (for the control). */
function paintedFold(preset, comma, seed) {
  const st = presetState(G, preset);
  const D = buildDomain(G, { seed: seed || st.seed, metric: st.metric, warp: makeWarp(G, 0) });
  const fold = createFold(G, D, buildMesh(G, D, foldMeshOptions(G)), foldOptions({ anchor: st.anchor }));
  const unit = commaOutline(), k = unit.length / 2, pl = new Float32Array(2 * k), ca = Math.cos(comma.angle), sa = Math.sin(comma.angle);
  for (let i = 0; i < k; i++) { const x = comma.s * unit[2 * i], y = comma.s * unit[2 * i + 1]; pl[2 * i] = comma.at[0] + ca * x - sa * y; pl[2 * i + 1] = comma.at[1] + sa * x + ca * y; }
  return { M: motifTintMesh(G, fold.mesh, { polylines: [pl], at: comma.at, radius: comma.s }), fold };
}
const fmt = (r) => `turns over ${(100 * r.turnsOver).toFixed(1)} % (largest turn ${r.maxTurn.toFixed(0)} deg), path ${r.path.toFixed(2)}, farthest ${r.far.toFixed(2)} tile sizes`;

test('22x: the comma holds still in every preset — no part of it turns over, it travels at most 0.45 tile sizes (round 3: on the Pocket\'s flap, all of it turned over)', (t) => {
  assert.ok(STILL.folds.includes('crosscap') && STILL.turn === 120, 'the rule the table was made with');
  for (const [i, p] of G.presets.entries()) {
    const sc = appScene(i);
    const r = paintMotion(sc.M, sc.fold);
    t.diagnostic(`${p.name}: ${fmt(r)}; the comma is ${(100 * r.area).toFixed(1)} % of the tile`);
    assert.ok(r.area > 0.27, `${p.name}: the comma is drawn into the mesh (${(100 * r.area).toFixed(1)} % of the tile)`);
    assert.equal(r.turnsOver, 0, `${p.name}: ${fmt(r)}`);
    assert.ok(r.maxTurn <= 100, `${p.name}: its sheet turns by ${r.maxTurn.toFixed(1)} degrees (the puff makes the pillow's sides vertical: 90)`);
    assert.ok(r.path <= 0.45 && r.far <= 0.45, `${p.name}: ${fmt(r)}`);
  }
});

test('22x: a drag of the Bowl (seed (0.5, 0.75), the same anchor) holds still too; wavy presets at most 5 % turn over (a lobe of the wavy rim); the reviewer\'s drag of the Pocket (0.2, 0.3) at most 40 % (round 3: 77 %)', (t) => {
  const cases = [
    { name: 'Bowl dragged to (0.5, 0.75)', preset: 1, seed: [0.5, 0.75], amp: 0, max: 0 },
    { name: 'Pocket wavy', preset: 0, amp: 1, max: 0.05 },
    { name: 'Bowl wavy', preset: 1, amp: 1, max: 0.05 },
    { name: 'Hexagon wavy', preset: 2, amp: 1, max: 0.05 },
    // a drag carries part of the pattern across the tile's seams onto pieces that turn over: the seams slide over the
    // shape (SPEC 7), and some of the comma comes round with them. What stays put is the part in the still band.
    { name: 'Pocket dragged to (0.2, 0.3)', preset: 0, seed: [0.2, 0.3], amp: 0, max: 0.4 },
  ];
  for (const c of cases) {
    const sc = appScene(c.preset, c.seed, c.amp);
    const r = paintMotion(sc.M, sc.fold);
    t.diagnostic(`${c.name}: ${fmt(r)}`);
    assert.ok(r.turnsOver <= c.max, `${c.name}: ${fmt(r)}`);
  }
});

test('22x control: the round-3 comma (on the Pocket\'s flap) turns over almost all and travels a tile size — the measure sees the jump the owner saw', (t) => {
  const { M, fold } = paintedFold(0, ROUND3);
  const r = paintMotion(M, fold);
  t.diagnostic(`round-3 comma, Pocket: ${fmt(r)}`);
  assert.ok(r.turnsOver >= 0.95 && r.maxTurn >= 170, fmt(r));
  assert.ok(r.path >= 1, fmt(r));
  // and the table no longer holds it
  const e = PLACEMENTS['22x'];
  assert.ok(Math.hypot(e.at[0] - ROUND3.at[0], e.at[1] - ROUND3.at[1]) > 0.3, 'the table moved the comma off the flap');
});

// ---- FLAPS = 'under' (shipped since the final fix of 10 Nov 2026; notes/crosscap-paint.md, the fixer's option J): the
//      flaps tucked under the sheet that holds still, so the comma that sheet carries ends ON TOP. Round 3's 'over' put
//      the same comma under the top sheet (front 0, seen 8 %: 22x was an empty shell again, the verifiers' finding 1).
/** The share of the front-most layer that is comma, in the default view at t = 1 (the laptop's pane), of a drawn mesh. */
function frontShare(M, fold) {
  const F = fold.at(1), pos = new Float64Array(3 * M.n), o = [0, 0, 0], lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < M.n; v++) { F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], o); for (let c = 0; c < 3; c++) { pos[3 * v + c] = o[c]; lo[c] = Math.min(lo[c], o[c]); hi[c] = Math.max(hi[c], o[c]); } }
  const center = [0, 1, 2].map((c) => (lo[c] + hi[c]) / 2);
  let r2 = 0;
  for (let v = 0; v < M.n; v++) r2 = Math.max(r2, (pos[3 * v] - center[0]) ** 2 + (pos[3 * v + 1] - center[1]) ** 2 + (pos[3 * v + 2] - center[2]) ** 2);
  const W = 622, H = 550, NX = 200, NY = Math.ceil((NX * H) / W);
  const pv = R3.cameraMatrices(viewFromAzEl().q, 1, center, Math.sqrt(r2), W / H, R3.makeCamera()).pv;
  const sx = new Float64Array(M.n), sy = new Float64Array(M.n), sw = new Float64Array(M.n);
  for (let v = 0; v < M.n; v++) {
    const x = pos[3 * v], y = pos[3 * v + 1], z = pos[3 * v + 2], w = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
    sx[v] = ((pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / w * 0.5 + 0.5) * NX; sy[v] = (0.5 - (pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / w * 0.5) * NY; sw[v] = w;
  }
  const dep = new Float64Array(NX * NY).fill(Infinity), fill = new Uint8Array(NX * NY);
  for (let i = 0; i < M.tri.length; i += 3) {
    const a = M.tri[i], b = M.tri[i + 1], c = M.tri[i + 2], f = M.tint[a] & 2 ? 1 : 0;
    const den = (sy[b] - sy[c]) * (sx[a] - sx[c]) + (sx[c] - sx[b]) * (sy[a] - sy[c]);
    if (!(Math.abs(den) > 1e-12)) continue;
    for (let j = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[c]))); j <= Math.min(NY - 1, Math.ceil(Math.max(sy[a], sy[b], sy[c]))); j++) {
      for (let k = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[c]))); k <= Math.min(NX - 1, Math.ceil(Math.max(sx[a], sx[b], sx[c]))); k++) {
        const qx = k + 0.5, qy = j + 0.5;
        const l1 = ((sy[b] - sy[c]) * (qx - sx[c]) + (sx[c] - sx[b]) * (qy - sy[c])) / den, l2 = ((sy[c] - sy[a]) * (qx - sx[c]) + (sx[a] - sx[c]) * (qy - sy[c])) / den, l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const d = l1 * sw[a] + l2 * sw[b] + l3 * sw[c], p = j * NX + k;
        if (d < dep[p]) { dep[p] = d; fill[p] = f; }
      }
    }
  }
  let pix = 0, front = 0;
  for (let p = 0; p < NX * NY; p++) if (dep[p] < Infinity) { pix++; front += fill[p]; }
  return front / pix;
}

test('22x, flaps \'under\' (the shipped FLAPS): every position is the mirror image in z = 0 of round 3\'s flaps \'over\', at every t; the comma ends on top (at least 40 % of the front layer at t = 1), not turned over; it folds toward -z', (t) => {
  // shipped: 'under' (SPEC 5.3's exception for 22x; test/folds.test.js TOWARD). Both are built here; 'over' is printed
  assert.equal(FLAPS, 'under', 'src/folds/crosscap.js FLAPS');
  const ts = [1e-9, 0.05, 0.13, 0.233, 0.3, 0.42, 0.45, 0.49, 0.6, 0.73, 0.83, 0.95, 1 - 1e-9, 1];
  for (const amp of [0, 1]) for (const [i, p] of G.presets.entries()) {
    const st = presetState(G, i);
    const D = buildDomain(G, { seed: st.seed, metric: st.metric, warp: makeWarp(G, amp) });
    const mesh = buildMesh(G, D, foldMeshOptions(G));
    const over = createFold(G, D, mesh, { ...foldOptions({ anchor: st.anchor }), flaps: 'over' }), under = createFold(G, D, mesh, { ...foldOptions({ anchor: st.anchor }), flaps: 'under' });
    assert.equal(over.flaps, 'over'); assert.equal(under.flaps, 'under');
    const M = under.mesh, a = [0, 0, 0], b = [0, 0, 0];
    assert.equal(under.at(0)(M.xy[0], M.xy[1], M.cell[0], a)[2], 0, 'at(0) is still the identity');
    let worst = 0, dipped = 0;
    for (const tt of ts) {
      const Fo = over.at(tt), Fu = under.at(tt);
      for (let v = 0; v < M.n; v += 3) {
        Fo(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], a); Fu(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], b);
        worst = Math.max(worst, Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] + b[2]));
        if (tt <= 0.3) dipped = Math.min(dipped, b[2]);
      }
      const Lo = over.doubleLine(tt), Lu = under.doubleLine(tt);
      assert.equal(Lo.length, Lu.length);
      for (let k = 0; k < Lo.length; k++) assert.equal(Lu[k], k % 3 === 2 ? -Lo[k] : Lo[k]);
    }
    over.halfPillow(M.xy[2], M.xy[3], M.cell[1], a); under.halfPillow(M.xy[2], M.xy[3], M.cell[1], b);
    assert.ok(worst === 0 && a[0] === b[0] && a[1] === b[1] && a[2] === -b[2], `${p.name} amp ${amp}: not the mirror image (${worst})`);
    if (amp === 0 && i !== 1) assert.ok(dipped < -0.1 * size, `${p.name}: its flaps fold under, toward -z (lowest ${dipped})`);
    if (amp === 0) {
      const comma = { polylines: [motifPolyline()], at: PLACEMENTS['22x'].at, radius: PLACEMENTS['22x'].s };
      const Mu = motifTintMesh(G, under.mesh, comma), Mo = motifTintMesh(G, over.mesh, comma);
      const fu = frontShare(Mu, under), fo = frontShare(Mo, over), r = paintMotion(Mu, under);
      t.diagnostic(`${p.name}: the comma is ${(100 * fu).toFixed(1)} % of the front layer at t = 1 with the flaps under (shipped), ${(100 * fo).toFixed(1)} % with round 3's flaps over; under: ${fmt(r)}`);
      assert.ok(fu >= 0.4, `${p.name}: the comma is only ${(100 * fu).toFixed(1)} % of the front layer at t = 1 (round 3's 'over': ${(100 * fo).toFixed(1)} %)`);
      assert.equal(r.turnsOver, 0, `${p.name} under: ${fmt(r)}`);
    }
  }
});

test('22x as the app draws it (the final round\'s finding 1): at t = 1 every preset, straight and wavy, shows its comma on top — at least 40 % of the front layer in the default view (round 3\'s flaps over: 0 %)', (t) => {
  for (const amp of [0, 1]) for (const [i, p] of G.presets.entries()) {
    const sc = appScene(i, null, amp);
    const f = frontShare(sc.M, sc.fold);
    t.diagnostic(`${p.name} amp ${amp}: ${(100 * f).toFixed(1)} % of the front layer is comma`);
    assert.ok(f >= 0.4, `${p.name} amp ${amp}: only ${(100 * f).toFixed(1)} % of the front layer is comma at t = 1`);
  }
});

/** The table's comma as drawn (motifFor's outline, rebuilt here from the table entry). */
function motifPolyline() {
  const e = PLACEMENTS['22x'], unit = commaOutline(), k = unit.length / 2, pl = new Float32Array(2 * k), ca = Math.cos(e.angle), sa = Math.sin(e.angle);
  for (let i = 0; i < k; i++) { const x = e.s * unit[2 * i], y = e.s * e.stretch * unit[2 * i + 1]; pl[2 * i] = e.at[0] + ca * x - sa * y; pl[2 * i + 1] = e.at[1] + sa * x + ca * y; }
  pl[2 * k - 2] = pl[0]; pl[2 * k - 1] = pl[1];
  return pl;
}
