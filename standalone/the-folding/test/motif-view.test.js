// motif-view.test.js — the big comma shows in the first 3D picture: at t = 1, in the default view, a good part of what
// one sees of every folded shape is the filled comma, and the placement table says how much.
//
// Why (10 Nov 2026). The owner's ask (9-10 Nov): "find a way to occupy more space on the Orbifold. Basically, right now
// there's a lot of empty space when I fold it, and there should be less empty space", "I meant for all the examples".
// The fill's verifier found (finding 2) that which of several equally large placements the table took was the grid's
// first, and that one of them rolls o's comma onto the torus's underside, out of the default view, with every test still
// green; and (finding 3) that *x was the emptiest shape. tools/motif-place.mjs now chooses among such ties by this very
// view (its seenShare); this file measures it APART from the tool: on the mesh the app draws (src/app.js buildScene: the
// fold's mesh with the comma cut in, tint bit 1 = fill), mapped at t = 1 (mapScene), through the renderer's own camera
// (its default view, viewFromAzEl(): az 0, el 55; the app's frame; the 3D pane of the laptop and of the phone),
// rasterised with the 4 front-most layers of every pixel:
//   front  share of the front-most layer that is comma (what one sees directly);
//   seen   every layer weighted by what shows through the layers before it (SURFACE_OPACITY each, as the translucent
//          surface is drawn): the share of the picture's ink that is comma.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID } from '../src/groups.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import { createFold, foldMeshOptions, foldOptions } from '../src/folds/index.js';
import { buildScene, mapScene } from '../src/app.js';
import { viewFromAzEl, __test as T } from '../src/render3d.js';
import { SURFACE_OPACITY } from '../src/palette.js';
import { motifFor, motifTintMesh, commaOutline } from '../src/motif.js';
import { PLACEMENTS } from '../src/groupdata/motif.js';
import { freeDirections } from '../tools/motif-place.mjs';

/** The floors where tools/motif-place.mjs chooses the place by this view (the table's entries with a view): well above
 *  a comma on the far side or underneath (8 to 18 % seen, 0 to 8 % front, among the tool's ties) and below the least
 *  of today's (*x 29 %, 3*3 28 %). Regenerating the table fixes a failure here. */
const SEEN_MIN = 0.22, FRONT_MIN = 0.2;
/** ... and for the shapes whose comma is not placed by the view: xx (by rule, across its glide seam; its two-lobe
 *  comma wraps the tube: 18 to 26 % front, 21 to 25 % seen from every azimuth, dev/fill-fix/az-sweep.mjs, so a new
 *  spin of the bottle cannot take it out of view) and the kaleidoscopes (folded, every layer's comma lies on the
 *  tile's: 26 to 29 %). Lower, so a fold that turns these shapes does not trip them; still far above an empty shell. */
const SEEN_MIN_FIXED = 0.17, FRONT_MIN_FIXED = 0.14;
const PANES = { laptop: [622, 550], phone: [364, 356] };
const LAYERS = 4;

/** front and seen (see the top) of a mapped scene { pos, M: the drawn mesh with its tint, frame }, in the renderer's
 *  default view (az 0, el 55 today). */
function commaInView({ pos, M, frame }, [W, H]) {
  const cam = T.cameraMatrices(viewFromAzEl().q, 1, frame.center, frame.radius, W / H, T.makeCamera());
  const pv = cam.pv, n = M.n, tint = M.tint;
  const NX = 240, NY = Math.ceil((240 * H) / W);
  const sx = new Float64Array(n), sy = new Float64Array(n), sw = new Float64Array(n);
  for (let v = 0; v < n; v++) {
    const x = pos[3 * v], y = pos[3 * v + 1], z = pos[3 * v + 2], w = pv[3] * x + pv[7] * y + pv[11] * z + pv[15];
    sx[v] = ((pv[0] * x + pv[4] * y + pv[8] * z + pv[12]) / w * 0.5 + 0.5) * NX;
    sy[v] = (0.5 - (pv[1] * x + pv[5] * y + pv[9] * z + pv[13]) / w * 0.5) * NY;
    sw[v] = w;
  }
  const cnt = new Uint8Array(NX * NY), dep = new Float64Array(NX * NY * LAYERS), fill = new Uint8Array(NX * NY * LAYERS);
  for (let i = 0; i < M.tri.length; i += 3) {
    const a = M.tri[i], b = M.tri[i + 1], c = M.tri[i + 2];
    const f = tint && tint[a] & 2 ? 1 : 0;
    const den = (sy[b] - sy[c]) * (sx[a] - sx[c]) + (sx[c] - sx[b]) * (sy[a] - sy[c]);
    if (!(Math.abs(den) > 1e-12)) continue;
    const i0 = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[c]))), i1 = Math.min(NX - 1, Math.ceil(Math.max(sx[a], sx[b], sx[c])));
    const j0 = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[c]))), j1 = Math.min(NY - 1, Math.ceil(Math.max(sy[a], sy[b], sy[c])));
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) {
      const qx = k + 0.5, qy = j + 0.5;
      const l1 = ((sy[b] - sy[c]) * (qx - sx[c]) + (sx[c] - sx[b]) * (qy - sy[c])) / den;
      const l2 = ((sy[c] - sy[a]) * (qx - sx[c]) + (sx[a] - sx[c]) * (qy - sy[c])) / den, l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      const d = l1 * sw[a] + l2 * sw[b] + l3 * sw[c], p = j * NX + k, o = p * LAYERS;
      let m = cnt[p];
      if (m === LAYERS) { if (d >= dep[o + LAYERS - 1]) continue; m = LAYERS - 1; } else cnt[p]++;
      let q = m;
      while (q > 0 && dep[o + q - 1] > d) { dep[o + q] = dep[o + q - 1]; fill[o + q] = fill[o + q - 1]; q--; }
      dep[o + q] = d; fill[o + q] = f;
    }
  }
  let pix = 0, front = 0, seen = 0, ink = 0;
  for (let p = 0; p < NX * NY; p++) {
    if (!cnt[p]) continue;
    pix++;
    if (fill[p * LAYERS]) front++;
    let w = SURFACE_OPACITY;
    for (let l = 0; l < cnt[p]; l++) { ink += w; if (fill[p * LAYERS + l]) seen += w; w *= 1 - SURFACE_OPACITY; }
  }
  return { front: front / pix, seen: seen / ink, pix };
}

/** The app's default scene of a group (preset 0, its anchor, Wavy 0) at t = 1. */
function appScene(g) {
  const p = g.presets[0];
  const scene = buildScene(g, { seed: p.seed, metric: p.metric, amp: 0, anchor: p.anchor || p.seed });
  mapScene(scene, 1);
  return scene;
}

test('the comma in view: at t = 1, in the default view, on the laptop and the phone, every shape shows its comma (front >= 20 %, seen >= 22 %; xx and the kaleidoscopes 14 %, 17 %)', (t) => {
  const rows = [];
  for (const g of GROUPS) {
    const scene = appScene(g);
    assert.ok(scene.M.tint && scene.M.motifTint, g.id + ': the drawn mesh carries the comma');
    const byView = !!(PLACEMENTS[g.id] && PLACEMENTS[g.id].view);
    const fMin = byView ? FRONT_MIN : FRONT_MIN_FIXED, sMin = byView ? SEEN_MIN : SEEN_MIN_FIXED;
    const how = byView ? ' — run node tools/motif-place.mjs' : '';
    for (const [name, pane] of Object.entries(PANES)) {
      const r = commaInView(scene, pane);
      assert.ok(r.pix > 1000, `${g.id} ${name}: the shape is in the picture (${r.pix} px)`);
      assert.ok(r.front >= fMin, `${g.id} ${name}: only ${(100 * r.front).toFixed(1)} % of the front layer is comma (the comma lies behind or under the shape?)${how}`);
      assert.ok(r.seen >= sMin, `${g.id} ${name}: only ${(100 * r.seen).toFixed(1)} % of what one sees is comma${how}`);
      if (name === 'laptop') rows.push(`${g.id} ${(100 * r.front).toFixed(0)}/${(100 * r.seen).toFixed(0)}`);
    }
  }
  t.diagnostic('front / seen, % (laptop): ' + rows.join(', '));
});

test('the comma in view: the table\'s `seen` is what the app draws (the tool measured the default view right, and on today\'s folds)', () => {
  for (const g of GROUPS) {
    const e = PLACEMENTS[g.id];
    if (!e || e.view === null) continue;                      // xx: placed by rule; the kaleidoscopes: no view term
    const r = commaInView(appScene(g), PANES.laptop);
    assert.ok(Math.abs(r.seen - e.seen) <= 0.02, `${g.id}: the table says ${(100 * e.seen).toFixed(1)} % seen, the drawn scene ${(100 * r.seen).toFixed(1)} % — run node tools/motif-place.mjs`);
  }
});

// The guard is not idle: slid along their strips (same size, same distance to every copy: the tool's ties), the strips'
// commas go out of view in places, and the table's place is the best of the slides, or nearly.
test('the comma in view: slid along its strip (a tie for size), o\'s, **\'s and *x\'s comma can leave the view; the table\'s place is about the best', (t) => {
  const unit = commaOutline();
  for (const id of ['o', '**', '*x']) {
    const g = BY_ID[id], m = motifFor(g), p = g.presets[0];
    const d = buildDomain(g, { seed: p.seed, metric: p.metric, warp: makeWarp(g, 0) });
    const fold = createFold(g, d, buildMesh(g, d, foldMeshOptions(g)), foldOptions({ anchor: p.anchor || p.seed }));
    const F = fold.at(1), o = [0, 0, 0];
    const at = (cx, cy) => {
      const k = unit.length / 2, pl = new Float32Array(2 * k), ca = Math.cos(m.angle), sa = Math.sin(m.angle);
      for (let i = 0; i < k; i++) { const x = m.scale[0] * unit[2 * i], y = m.scale[1] * unit[2 * i + 1]; pl[2 * i] = cx + ca * x - sa * y; pl[2 * i + 1] = cy + sa * x + ca * y; }
      const M = motifTintMesh(g, fold.mesh, { polylines: [pl], at: [cx, cy], radius: m.radius });
      const pos = new Float64Array(3 * M.n), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let v = 0; v < M.n; v++) {
        F(M.xy[2 * v], M.xy[2 * v + 1], M.cell[v], o);
        for (let c = 0; c < 3; c++) { pos[3 * v + c] = o[c]; lo[c] = Math.min(lo[c], o[c]); hi[c] = Math.max(hi[c], o[c]); }
      }
      const center = [0, 1, 2].map((c) => (lo[c] + hi[c]) / 2);
      let r2 = 0;
      for (let v = 0; v < M.n; v++) r2 = Math.max(r2, (pos[3 * v] - center[0]) ** 2 + (pos[3 * v + 1] - center[1]) ** 2 + (pos[3 * v + 2] - center[2]) ** 2);
      return commaInView({ pos, M, frame: { center, radius: Math.sqrt(r2) } }, PANES.laptop).seen;
    };
    const here = at(m.at[0], m.at[1]);
    const u = freeDirections(g)[0];             // o: x, across the tube (its underside); **: y; *x: x — along their strips
    const period = id === '*x' ? 3.2 : id === '**' ? 1.2 : 0.72;
    const slides = [];
    for (let k = 1; k < 12; k++) slides.push(at(m.at[0] + (period * k / 12) * u[0], m.at[1] + (period * k / 12) * u[1]));
    const lo = Math.min(...slides), hi = Math.max(here, ...slides);
    t.diagnostic(`${id}: seen ${(100 * here).toFixed(1)} % at the table's place; ${(100 * lo).toFixed(1)} .. ${(100 * hi).toFixed(1)} % slid along the strip`);
    assert.ok(lo < SEEN_MIN, `${id}: some slide of the comma would fail the guard (${(100 * lo).toFixed(1)} %)`);
    assert.ok(here >= 0.95 * hi, `${id}: the table's place (${(100 * here).toFixed(1)} %) is about the best of the slides (${(100 * hi).toFixed(1)} %)`);
  }
});
