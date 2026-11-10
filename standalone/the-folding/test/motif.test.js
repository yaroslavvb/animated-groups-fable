// motif.js — the glyph is chiral, sits at a generic point, its copies keep their distance, and its pieces inside any
// tile add up to exactly one glyph (the tile is a fundamental domain).
//
// ONE BIG COMMA (10 Nov 2026). The owner asked, 9-10 Nov 2026: "find a way to occupy more space on the Orbifold.
// Basically, right now there's a lot of empty space when I fold it, and there should be less empty space", then "I
// meant for all the examples." The fill judge's decision (qa/fill-judge.md): one comma per tile covering 30 % of it (the
// strip groups less), placed by an offline search (tools/motif-place.mjs writes src/groupdata/motif.js), filled in 3D.
// For that ask, the three tests of the old small-glyph contract are rewritten to the new one:
//   * "one closed glyph per group ... inside its bounding disc" capped the radius at SIZE_CAP sqrt(domainArea) and
//     VIEW_CAP viewHalf (0.19 and 0.105: 1 to 6 % of the tile); the big comma's cap is FILL_RCAP viewHalf (0.34);
//   * "a generic point — copies never touch each other, a mirror, a rotation centre, or cross a glide axis" bounded a
//     DISC round the glyph by K_CLEAR of half the distance to the nearest copy and kept it off every glide axis; the
//     big comma keeps its OUTLINE FILL_GAP sqrt(domainArea) from every copy (a disc rule caps it near 5 %), so it still
//     touches no mirror and no rotation centre, but it may cross a glide axis (xx's comma straddles one on purpose; the
//     glide's copy keeps its distance all the same);
//   * "the default picture shows one whole glyph inside the tile, clear of the seed handle": a comma of 30 % cannot keep
//     clear of the handle (which is drawn over it) and pokes out of most default tiles by a sliver; now 13 groups hold at
//     least 97.5 % of it in the default tile (the judge: 98 to 100 %), the strips and xx by design less.
// The other tests are as they were. The new ones check the table (fresh: as the tool would write it now), the coverage,
// the distance and the cap, xx's two-lobe seam comma, the guard for a stale table, and the comma filled into the fold
// meshes (motifTintMesh: the two tint bits).
// The fix-up of 10 Nov 2026 (the verifier's findings 1-3, notes/fill.md): the share in the default tile is measured
// EXACTLY here (the drawn outline clipped by the tile; a 90 x 90 grid let 22*'s 97.3 % pass a 97.5 % bar) and must be
// the judge's 98 %; the gap is measured on the drawn outline and must be FILL_GAP itself (it was 0.95 of it: *x's comma
// came 0.0694 from its mirror image); the table is also stale when the folded default tile it was seen on has moved
// (entry.view). That the comma shows in the default 3D view is test/motif-view.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GROUPS, BY_ID, elementsNear, symmetryElements } from '../src/groups.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { buildMesh } from '../src/mesh.js';
import { createFold, foldMeshOptions, foldOptions } from '../src/folds/index.js';
import { det } from '../src/geom.js';
import { motifFor, motifInTile, motifTintMesh, commaOutline, placementKey, fnv1a, placeAcrossSeam, FILL_TARGET, FILL_GAP, FILL_RCAP,
  FILL_STRETCH, SEAM_GROUPS, SEAM_LOBES, SEAM_SCALE, SEAM_STRETCH } from '../src/motif.js';
import { PLACEMENTS, PLACEMENT_SOURCE } from '../src/groupdata/motif.js';
import { searchGroup, tableGroups, viewKey, freeDirections, exactShare, SHARE_OK } from '../tools/motif-place.mjs';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const lengthOf = (pl) => { let s = 0; for (let i = 2; i < pl.length; i += 2) s += Math.hypot(pl[i] - pl[i - 2], pl[i + 1] - pl[i - 1]); return s; };
const isIdent = (g) => Math.abs(g.a - 1) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.abs(g.c) < 1e-9 && Math.abs(g.tx) < 1e-9 && Math.abs(g.ty) < 1e-9;
const STRIPS = { o: 0.27, '**': 0.27, '*x': 0.19, xx: 0.19 };     // the least cover of the strip groups (the judge: 29, 28, 21, 20 %)

/** One-sided Hausdorff distance from the points of A to the points of B (both flat arrays). */
function hausdorff(A, B) {
  let worst = 0;
  for (let i = 0; i < A.length; i += 2) {
    let best = Infinity;
    for (let j = 0; j < B.length; j += 2) { const d = (A[i] - B[j]) ** 2 + (A[i + 1] - B[j + 1]) ** 2; if (d < best) best = d; }
    if (best > worst) worst = best;
  }
  return Math.sqrt(worst);
}
function areaCentroid(P) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i + 2 < P.length; i += 2) {
    const w = P[i] * P[i + 3] - P[i + 2] * P[i + 1];
    a += w; cx += (P[i] + P[i + 2]) * w; cy += (P[i + 1] + P[i + 3]) * w;
  }
  return { area: a / 2, cx: cx / (3 * a), cy: cy / (3 * a) };
}
// ---- geometry written apart from motif.js ----
/** The outline P (flat, closed: last point = first) moved by the isometry g. */
function moved(P, g) {
  const Q = new Float64Array(P.length);
  for (let i = 0; i < P.length; i += 2) { Q[i] = g.a * P[i] + g.b * P[i + 1] + g.tx; Q[i + 1] = g.c * P[i] + g.d * P[i + 1] + g.ty; }
  return Q;
}
/** Is (x, y) inside the closed outline P, and how far is it from it? */
function sideOf(P, x, y) {
  let inside = false, d2 = Infinity;
  for (let i = 0; i + 3 < P.length; i += 2) {
    const ax = P[i], ay = P[i + 1], bx = P[i + 2], by = P[i + 3];
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0;
    d2 = Math.min(d2, (ax + u * ex - x) ** 2 + (ay + u * ey - y) ** 2);
  }
  return { inside, dist: Math.sqrt(d2) };
}
/** The distance between two closed outlines, or 0 when they cross or one holds the other. */
function outlineDistance(P, Q) {
  const cross = (ax, ay, bx, by, cx, cy, dx, dy) => {
    const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
  };
  for (let i = 0; i + 3 < P.length; i += 2) for (let k = 0; k + 3 < Q.length; k += 2) if (cross(P[i], P[i + 1], P[i + 2], P[i + 3], Q[k], Q[k + 1], Q[k + 2], Q[k + 3])) return 0;
  if (sideOf(Q, P[0], P[1]).inside || sideOf(P, Q[0], Q[1]).inside) return 0;
  let d = Infinity;
  for (let i = 0; i < P.length; i += 2) d = Math.min(d, sideOf(Q, P[i], P[i + 1]).dist);
  for (let i = 0; i < Q.length; i += 2) d = Math.min(d, sideOf(P, Q[i], Q[i + 1]).dist);
  return d;
}
/**
 * Share of the area of the closed outline P (last point = first) inside the straight convex tile D, exactly: P clipped
 * by the half-plane of each edge in turn (the clipped outline may run along an edge twice; its area is still exact).
 */
function shareInTile(P, D) {
  let poly = [];
  for (let i = 0; i + 3 < P.length; i += 2) poly.push([P[i], P[i + 1]]);
  const area = (Q) => { let s = 0; for (let i = 0; i < Q.length; i++) { const p = Q[i], q = Q[(i + 1) % Q.length]; s += p[0] * q[1] - q[0] * p[1]; } return Math.abs(s) / 2; };
  const whole = area(poly);
  for (const e of D.edges) {
    const out = [], f = (p) => e.c - (e.nx * p[0] + e.ny * p[1]);
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
      if (fp >= 0) out.push(p);
      if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    }
    poly = out;
    if (!poly.length) return 0;
  }
  return area(poly) / whole;
}

test('the comma: a closed counter-clockwise outline inside the unit disc', () => {
  const P = commaOutline();
  assert.equal(P[0], P[P.length - 2]); assert.equal(P[1], P[P.length - 1]);
  const c = areaCentroid(P);
  assert.ok(Math.abs(c.area - Math.PI / 2) < 0.01, 'half of the disc: ' + c.area);     // the classic yin-yang half
  let rmax = 0;
  for (let i = 0; i < P.length; i += 2) rmax = Math.max(rmax, Math.hypot(P[i], P[i + 1]));
  assert.ok(rmax <= 1 + 1e-12 && rmax > 1 - 1e-9, 'bounding circle is the unit circle');
  // steps are small: the outline is smooth at the size it is drawn
  for (let i = 2; i < P.length; i += 2) assert.ok(Math.hypot(P[i] - P[i - 2], P[i + 1] - P[i - 1]) < 0.09);
});

test('the comma is clearly handed and has no rotational symmetry', () => {
  const P = commaOutline();
  const { cx, cy } = areaCentroid(P);
  const n = P.length / 2;
  const turned = (theta, mirror) => {
    const Q = new Float64Array(P.length), c = Math.cos(theta), s = Math.sin(theta);
    for (let i = 0; i < n; i++) {
      let x = P[2 * i] - cx; const y = P[2 * i + 1] - cy;
      if (mirror) x = -x;
      Q[2 * i] = cx + c * x - s * y; Q[2 * i + 1] = cy + s * x + c * y;
    }
    return Q;
  };
  // a congruence of the shape with its mirror image would have to match the area centroids, so it is one of these
  let bestMirror = Infinity, bestTurn = Infinity;
  for (let d = 0; d < 360; d += 1) {
    const th = (d * Math.PI) / 180;
    bestMirror = Math.min(bestMirror, Math.max(hausdorff(P, turned(th, true)), hausdorff(turned(th, true), P)));
    if (d >= 15 && d <= 345) bestTurn = Math.min(bestTurn, Math.max(hausdorff(P, turned(th, false)), hausdorff(turned(th, false), P)));
  }
  assert.ok(bestMirror > 0.25, 'no mirror image fits within a quarter of the radius: ' + bestMirror.toFixed(3));
  assert.ok(bestTurn > 0.25, 'no rotation fits within a quarter of the radius: ' + bestTurn.toFixed(3));
});

// Rewritten for the owner's ask of 9-10 Nov 2026 (see the top): the caps are the big comma's.
test('motifFor: one closed glyph per group, the same object every time, inside its disc, within the big comma\'s caps', () => {
  for (const g of GROUPS) {
    const m = motifFor(g);
    assert.equal(motifFor(g), m, g.id + ' cached');
    assert.ok(m.polylines.length === 1 && m.polylines[0] instanceof Float32Array && m.polylines[0].length >= 8 && m.polylines[0].length % 2 === 0, g.id);
    assert.deepEqual(m.closed, [true]);
    const [sx, sy] = m.scale;
    assert.ok(sx > 0 && sy >= sx, g.id + ': stretched along its head -> tail axis, never squeezed');
    assert.equal(m.radius, Math.max(sx, sy), g.id + ': the disc that holds the unit comma so scaled');
    const stretch = g.id === 'xx' ? SEAM_STRETCH : FILL_STRETCH[g.id] || 1;
    assert.ok(Math.abs(sy / sx - stretch) < 1e-9, `${g.id}: stretched ${sy / sx}, the rule says ${stretch}`);
    // the table's commas: radius at most FILL_RCAP viewHalf; xx's seam comma is two lobes wide (its own rule, below)
    if (!m.seam) assert.ok(m.radius <= FILL_RCAP * g.viewHalf + 1e-9, `${g.id}: radius ${(m.radius / g.viewHalf).toFixed(3)} viewHalf`);
    // big: on a phone, where the plane is about 226 px square (113 px per viewHalf), at least 15 px across... in radius
    assert.ok((m.radius * 113) / g.viewHalf >= 15, `${g.id}: radius ${((m.radius * 113) / g.viewHalf).toFixed(1)} px on a phone`);
    const pl = m.polylines[0];
    for (let i = 0; i < pl.length; i += 2) {
      assert.ok(Number.isFinite(pl[i]) && Number.isFinite(pl[i + 1]), g.id);
      assert.ok(Math.hypot(pl[i] - m.at[0], pl[i + 1] - m.at[1]) <= m.radius * (1 + 1e-5), g.id + ' inside the disc');
    }
    assert.equal(pl[0], pl[pl.length - 2]); assert.equal(pl[1], pl[pl.length - 1]);
  }
});

// Rewritten for the owner's ask of 9-10 Nov 2026 (see the top): the outline keeps FILL_GAP, not a disc.
test('motifFor: copies keep FILL_GAP apart (outline to outline), so no comma meets a mirror or a rotation centre', () => {
  for (const g of GROUPS) {
    const m = motifFor(g), P = Float64Array.from(m.polylines[0]), size = Math.sqrt(g.domainArea), gap = FILL_GAP * size;
    const [x, y] = m.at;
    // measured on the outline as it is drawn (the tool measures its last `fit` there too; 1e-4: the Float32 points)
    let nearest = Infinity;
    for (const e of elementsNear(g, x, y, 2 * m.radius + gap, x, y)) {
      if (isIdent(e)) continue;
      nearest = Math.min(nearest, outlineDistance(P, moved(P, e)));
    }
    assert.ok(nearest >= (1 - 1e-4) * gap, `${g.id}: two copies ${(nearest / size).toFixed(5)} tile sizes apart (gap ${FILL_GAP})`);
    const sym = symmetryElements(g, x, y, 2 * m.radius + size);
    for (const mi of sym.mirrors) {
      const s = (px, py) => (px - mi.px) * -mi.uy + (py - mi.py) * mi.ux;
      const s0 = Math.sign(s(P[0], P[1]));
      let dmin = Infinity;
      for (let i = 0; i < P.length; i += 2) { assert.equal(Math.sign(s(P[i], P[i + 1])), s0, `${g.id}: a mirror crosses the comma`); dmin = Math.min(dmin, Math.abs(s(P[i], P[i + 1]))); }
      assert.ok(dmin >= 0.45 * gap, `${g.id}: ${(dmin / size).toFixed(4)} from a mirror`);
    }
    for (const c of sym.centers) {
      const sd = sideOf(P, c.x, c.y);
      assert.ok(!sd.inside && sd.dist >= 0.45 * gap, `${g.id}: a rotation centre of order ${c.order} ${(sd.dist / size).toFixed(4)} from the comma (inside: ${sd.inside})`);
    }
  }
});

// Rewritten for the owner's ask of 9-10 Nov 2026 (see the top): most of the comma, not all of it, clear handle or not.
// Measured exactly since the fix-up (10 Nov): the judge's bar, 98 %.
test('motifFor: the default tile holds at least 98 % of the comma (exactly) for the 13 groups that are not strips, and the table says so', (t) => {
  let held = 0;
  const rows = [];
  assert.equal(SHARE_OK, 0.98);
  for (const g of GROUPS) {
    const m = motifFor(g), p0 = g.presets[0];
    const d = buildDomain(g, { seed: p0.seed, metric: p0.metric, warp: makeWarp(g, 0) });
    const share = shareInTile(Float64Array.from(m.polylines[0]), d);
    rows.push(`${g.id} ${(100 * share).toFixed(2)}`);
    let curve = share;
    if (!m.seam) {
      // the tool measures the comma's curve (4 x as fine as the drawn outline), this test the drawn polygon: they agree
      // to 5e-4; the table holds the tool's number (4 decimals)
      const e = PLACEMENTS[g.id];
      curve = exactShare(d, m.at[0], m.at[1], m.angle, m.scale[0], m.scale[1] / m.scale[0]);
      assert.ok(Math.abs(curve - e.inTile) <= 6e-5, `${g.id}: the curve lies ${curve.toFixed(5)} in the tile, the table says ${e.inTile}`);
      assert.ok(Math.abs(share - curve) < 5e-4, `${g.id}: the drawn polygon ${share.toFixed(5)}, the curve ${curve.toFixed(5)}`);
    }
    // the strips: o, ** and *x cannot reach the target (their caps or gaps come first; where they sit along the strip is
    // chosen for the 3D view, test/motif-view.test.js), xx straddles its glide seam on purpose
    if (g.id in STRIPS) { t.diagnostic(`${g.id}: ${(100 * share).toFixed(1)} % in the default tile (a strip${m.seam ? ', across its glide seam' : ''})`); continue; }
    assert.ok(curve >= SHARE_OK, `${g.id}: only ${(100 * curve).toFixed(4)} % of the comma's curve in the default tile`);
    assert.ok(share >= SHARE_OK - 5e-4, `${g.id}: only ${(100 * share).toFixed(3)} % of the drawn comma in the default tile`);
    held++;
  }
  assert.equal(held, 13);
  t.diagnostic('in the default tile, %: ' + rows.join(', '));
});

test('motifInTile: the pieces inside any tile add up to exactly one glyph, lie in the tile and end on its boundary', () => {
  const rand = rng(20261109);
  let tiles = 0, cutTiles = 0;
  for (const g of GROUPS) {
    const m = motifFor(g), size = Math.sqrt(g.domainArea);
    const whole = m.polylines.reduce((s, pl) => s + lengthOf(pl), 0);
    for (const amp of [0, 1]) {
      const warp = makeWarp(g, amp);
      for (let pi = 0; pi < g.presets.length; pi++) {
        const p = g.presets[pi];
        for (let k = 0; k < 14; k++) {
          const seed = k === 0 ? p.seed : [p.seed[0] + (rand() - 0.5) * 2.4 * size, p.seed[1] + (rand() - 0.5) * 2.4 * size];
          const d = buildDomain(g, { seed, metric: p.metric, warp });
          const pieces = motifInTile(g, d, m);
          tiles++;
          if (pieces.length > 1) cutTiles++;
          const tag = `${g.id} preset ${pi} seed ${seed.map((v) => v.toFixed(3))} amp ${amp}`;
          let total = 0;
          const q = [0, 0];
          const sideOfTile = (x, y) => {
            warp.inv(x, y, q);
            let s = -Infinity;
            for (const e of d.edges) s = Math.max(s, e.nx * q[0] + e.ny * q[1] - e.c);
            return s;
          };
          for (const pl of pieces) {
            assert.ok(pl instanceof Float32Array && pl.length >= 4, tag);
            total += lengthOf(pl);
            for (let i = 0; i < pl.length; i += 2) assert.ok(sideOfTile(pl[i], pl[i + 1]) < 2e-5 * size, tag + ' piece point inside the tile');
            const n = pl.length;
            const closed = pl[0] === pl[n - 2] && pl[1] === pl[n - 1];
            if (!closed) {
              assert.ok(Math.abs(sideOfTile(pl[0], pl[1])) < 2e-5 * size, tag + ' piece starts on the boundary');
              assert.ok(Math.abs(sideOfTile(pl[n - 2], pl[n - 1])) < 2e-5 * size, tag + ' piece ends on the boundary');
            }
          }
          assert.ok(Math.abs(total - whole) < 0.004 * whole, `${tag}: pieces measure ${total.toFixed(5)}, one glyph ${whole.toFixed(5)}`);
        }
      }
    }
  }
  assert.ok(cutTiles > tiles / 4, `the sample really cuts glyphs (${cutTiles} of ${tiles} tiles)`);
});

test('motifInTile: default motif argument, and the pattern does not depend on the seed or the wave', () => {
  const g = GROUPS.find((x) => x.id === '333');
  const a = motifFor(g);
  const d = buildDomain(g, { seed: [0.41, 0.07], warp: makeWarp(g, 0.6) });
  const p1 = motifInTile(g, d), p2 = motifInTile(g, d, a);
  assert.equal(p1.length, p2.length);
  assert.deepEqual(Array.from(p1[0]), Array.from(p2[0]));
  assert.equal(motifFor(g), a);
});

// ---------------------------------------------------------------------------------------------------------------
// the big comma (qa/fill-judge.md): the table, the coverage, xx, the stale-table guard
// ---------------------------------------------------------------------------------------------------------------

test('the placement table is fresh: every entry was computed from today\'s group data, by today\'s tools/motif-place.mjs', () => {
  const tool = fs.readFileSync(fileURLToPath(new URL('../tools/motif-place.mjs', import.meta.url)), 'utf8');
  const how = 'src/groupdata/motif.js is stale: run  node tools/motif-place.mjs';
  assert.equal(PLACEMENT_SOURCE, fnv1a(tool), `tools/motif-place.mjs changed since the table was written — ${how}`);
  const want = GROUPS.filter((g) => !SEAM_GROUPS.has(g.id)).map((g) => g.id).sort();
  assert.deepEqual(Object.keys(PLACEMENTS).sort(), want, `the table holds every group but the seam groups — ${how}`);
  assert.deepEqual(tableGroups().map((g) => g.id).sort(), want);
  for (const id of want) {
    const g = BY_ID[id], e = PLACEMENTS[id], m = motifFor(g);
    assert.equal(e.key, placementKey(g), `${id}: the group data (lattice, reps, viewHalf, default tile) or the rules changed — ${how}`);
    // the place along a strip, and among the places wholly in the tile, was chosen for the default 3D view at t = 1:
    // the table is stale too when the fold puts the default tile elsewhere (src/folds/*.js) or the view changed
    assert.equal(e.view, viewKey(g), `${id}: the folded default tile (src/folds, src/mesh.js) or the default view changed — ${how}`);
    assert.equal(e.view === null, g.fold === 'snowflake', `${id}: only a kaleidoscope has no view term`);
    assert.equal(m.info.source, 'table', id);
    assert.equal(m.info.fresh, true, id);
    // motifFor draws exactly the table's comma
    assert.deepEqual(m.at, e.at, id);
    assert.equal(m.angle, e.angle, id);
    assert.deepEqual(m.scale, [e.s, e.s * e.stretch], id);
    assert.equal(e.stretch, FILL_STRETCH[id] || 1, `${id}: stretch`);
  }
  // the key changes with what the search reads: a lattice moved by a millionth is not the table's group any more
  const o = BY_ID.o, moved1 = { ...o, e1: [o.e1[0] * (1 + 2e-6), o.e1[1]] };
  assert.notEqual(placementKey(moved1), placementKey(o));
  assert.equal(placementKey({ ...o }), placementKey(o), 'a copy of the same data has the same key');
});

test('tools/motif-place.mjs is deterministic and reproduces the table (*632; ** whose place along its strip is chosen by the view)', () => {
  for (const id of ['*632', '**']) {
    const g = BY_ID[id];
    const a = searchGroup(g), b = searchGroup(g), e = PLACEMENTS[id];
    assert.deepEqual(a, b, id + ': the same inputs, the same entry');
    assert.equal(a.key, e.key, id);
    assert.equal(a.view, e.view, id);
    for (const k of ['angle', 's', 'fit', 'radius', 'cover', 'inTile', 'seen']) assert.ok(Math.abs(a[k] - e[k]) <= 1e-6, `${id} ${k}: ${a[k]} vs the table's ${e[k]}`);
    assert.ok(Math.hypot(a.at[0] - e.at[0], a.at[1] - e.at[1]) <= 1e-6, `${id} at: ${a.at} vs ${e.at}`);
  }
});

test('the comma slides along its strip without changing size: the free directions are the vectors the point group fixes', () => {
  const dirs = (id) => freeDirections(BY_ID[id]).map((u) => u.map((v) => Math.round(Math.abs(v) * 1e9) / 1e9));
  assert.deepEqual(dirs('o'), [[1, 0], [0, 1]], 'o: any translation');
  assert.deepEqual(dirs('**'), [[0, 1]], '**: along its mirrors');
  assert.deepEqual(dirs('*x'), [[1, 0]], '*x: along its mirrors');
  assert.deepEqual(dirs('xx'), [[0, 1]], 'xx: along its glide axes');
  for (const g of GROUPS) if (!['o', '**', '*x', 'xx'].includes(g.id)) assert.deepEqual(freeDirections(g), [], g.id + ': a rotation or two mirror directions fix nothing');
  // and it is true: slid along a free direction the comma keeps its distance to every copy, to the last digit of the bisection
  for (const id of ['o', '**', '*x']) {
    const g = BY_ID[id], m = motifFor(g), P = Float64Array.from(m.polylines[0]), size = Math.sqrt(g.domainArea);
    const near = (Q, at) => { let d = Infinity; for (const e of elementsNear(g, at[0], at[1], 2 * m.radius + size, at[0], at[1])) if (!isIdent(e)) d = Math.min(d, outlineDistance(Q, moved(Q, e))); return d; };
    const d0 = near(P, m.at);
    for (const u of freeDirections(g)) {
      const sh = 0.37 * size, Q = P.map((v, i) => v + sh * u[i % 2]);
      assert.ok(Math.abs(near(Q, [m.at[0] + sh * u[0], m.at[1] + sh * u[1]]) - d0) < 1e-6 * size, `${id}: slid along ${u}`);
    }
  }
});

test('the big comma covers FILL_TARGET (30 %) of the tile; the strips the most their gap allows (o, ** >= 27 %, *x, xx >= 19 %)', (t) => {
  const rows = [];
  for (const g of GROUPS) {
    const m = motifFor(g), cover = Math.abs(areaCentroid(m.polylines[0]).area) / g.domainArea;
    rows.push(`${g.id} ${(100 * cover).toFixed(1)}`);
    assert.ok(cover <= FILL_TARGET + 0.002, `${g.id}: ${(100 * cover).toFixed(2)} % is more than the target`);
    if (g.id in STRIPS) { assert.ok(cover >= STRIPS[g.id], `${g.id}: ${(100 * cover).toFixed(2)} %`); continue; }
    assert.ok(cover >= FILL_TARGET - 0.002, `${g.id}: ${(100 * cover).toFixed(2)} %, not the target ${FILL_TARGET}`);
    // the table's own number agrees with the outline drawn
    assert.ok(Math.abs(PLACEMENTS[g.id].cover - cover) < 0.003, `${g.id}: the table says ${PLACEMENTS[g.id].cover}`);
  }
  // the strips are as big as their gap or their cap allows: the table's `fit` is their scale
  for (const id of ['o', '**', '*x']) assert.equal(PLACEMENTS[id].s, PLACEMENTS[id].fit, id);
  t.diagnostic('cover, % of the tile: ' + rows.join(', '));
});

test('xx: the seam comma is two lobes wide — across the glide seam, astride the middle glide axis, between the axes on either side, 2.6 x 1.4 the one-lobe comma', () => {
  const XX = BY_ID.xx, m = motifFor(XX), size = Math.sqrt(XX.domainArea);
  assert.ok(SEAM_GROUPS.has('xx') && m.seam && m.info.seam && m.info.tier === 3 && m.info.lobes === SEAM_LOBES && SEAM_LOBES === 2);
  // the rule: the one-lobe comma placed in the two-lobe room, SEAM_SCALE across and SEAM_STRETCH more along
  const base = placeAcrossSeam(XX, commaOutline(), 2).radius;
  assert.ok(Math.abs(m.scale[0] - SEAM_SCALE * base) < 1e-12 && Math.abs(m.scale[1] - SEAM_SCALE * SEAM_STRETCH * base) < 1e-12, `scale ${m.scale}`);
  assert.equal(SEAM_SCALE, 2.6); assert.equal(SEAM_STRETCH, 1.4);
  // the default tile and its seam: the cut edge glued by the glide, the axis through its middle
  const p0 = XX.presets[0], d = buildDomain(XX, { seed: p0.seed, warp: makeWarp(XX, 0) });
  const seam = d.edges.findIndex((e, i) => e.kind === 'cut' && det(e.g) < 0 && i === m.info.edge);
  assert.ok(seam >= 0, 'the seam is a glide-sewn cut edge');
  const A = d.poly[seam], B = d.poly[(seam + 1) % d.poly.length], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
  const axes = symmetryElements(XX, mx, my, 2 * size).glides;
  const off = (gl, x, y) => (x - gl.px) * -gl.uy + (y - gl.py) * gl.ux;
  const mid = axes.reduce((a, b) => (Math.abs(off(b, mx, my)) < Math.abs(off(a, mx, my)) ? b : a));
  assert.ok(Math.abs(off(mid, mx, my)) < 1e-9, 'a glide axis runs through the middle of the seam');
  const P = m.polylines[0];
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < P.length; i += 2) { const w = off(mid, P[i], P[i + 1]); lo = Math.min(lo, w); hi = Math.max(hi, w); }
  assert.ok(lo < 0 && hi > 0, `the comma straddles the middle glide axis (${lo.toFixed(3)} .. ${hi.toFixed(3)})`);
  // every other axis parallel to it leaves the comma on one side: it spans the two lobes round the middle axis, no more
  for (const gl of axes) {
    if (gl === mid) continue;
    const s0 = Math.sign(off(gl, P[0], P[1]));
    for (let i = 0; i < P.length; i += 2) assert.equal(Math.sign(off(gl, P[i], P[i + 1])), s0, 'outline inside the two lobes');
  }
  // the seam crosses it: the default tile holds a piece at the seam and the glide image of the rest at its partner
  const pieces = motifInTile(XX, d, m);
  assert.equal(pieces.length, 2, 'two pieces');
  const onEdge = (x, y) => d.edges.findIndex((e) => Math.abs(e.nx * x + e.ny * y - e.c) < 1e-6);
  const ends = pieces.map((pl) => [onEdge(pl[0], pl[1]), onEdge(pl[pl.length - 2], pl[pl.length - 1])]);
  assert.deepEqual(ends.map((e) => e[0]).sort((a, b) => a - b), [seam, d.edges[seam].partner].sort((a, b) => a - b), 'one piece on the seam, one on its partner');
  for (const [a, b] of ends) assert.equal(a, b, 'each piece ends twice on one edge');
  // its cover (19.5 % with today's lattice) and its distance to its copies are tested with every group's, above
});

test('a stale table: motifFor keeps the place and turn but shrinks the comma until its copies keep FILL_GAP; a missing entry falls back to the small comma', () => {
  const o = BY_ID.o, k = 0.85;
  const shrunk = { ...o, e1: [o.e1[0] * k, o.e1[1] * k], e2: [o.e2[0] * k, o.e2[1] * k], cellArea: o.cellArea * k * k, domainArea: o.domainArea * k * k, center: [o.center[0] * k, o.center[1] * k] };
  shrunk.warp = shrunk;
  const warns = [], warn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  let m, m2;
  try { m = motifFor(shrunk); m2 = motifFor(shrunk); } finally { console.warn = warn; }
  assert.equal(m2, m, 'cached');
  assert.equal(warns.length, 1, 'one warning');
  assert.match(warns[0], /stale.*motif-place\.mjs/);
  assert.equal(m.info.source, 'table'); assert.equal(m.info.fresh, false);
  const e = PLACEMENTS.o;
  assert.deepEqual(m.at, e.at); assert.equal(m.angle, e.angle);
  assert.ok(m.scale[0] < e.s, `shrunk: ${m.scale[0]} < ${e.s}`);
  const P = Float64Array.from(m.polylines[0]), size = Math.sqrt(shrunk.domainArea);
  let nearest = Infinity;
  for (const g of elementsNear(shrunk, m.at[0], m.at[1], 2 * m.radius + size, m.at[0], m.at[1])) if (!isIdent(g)) nearest = Math.min(nearest, outlineDistance(P, moved(P, g)));
  assert.ok(nearest >= 0.95 * FILL_GAP * size, `the shrunk comma's copies are ${(nearest / size).toFixed(4)} tile sizes apart`);
  // a group the table does not know: the v1 placement (src/motif.js place), one warning
  const lost = { ...BY_ID['333'], id: '333-unlisted' };
  console.warn = (...a) => warns.push(a.join(' '));
  try { m = motifFor(lost); } finally { console.warn = warn; }
  assert.equal(m.info.source, 'v1');
  assert.match(warns[1], /missing from the table/);
});

// ---------------------------------------------------------------------------------------------------------------
// the comma filled into the fold meshes: motifTintMesh, every fold (two tint bits: 1 ghost, 2 fill)
// ---------------------------------------------------------------------------------------------------------------

test('motifTintMesh, every group: area kept, no triangle of mixed tint, fill bit exactly inside the comma, ghost bit kept, crossing points paired, new points on their triangle\'s piece', (t) => {
  const rand = rng(1110);
  const area2 = (xy, a, b, c) => (xy[2 * b] - xy[2 * a]) * (xy[2 * c + 1] - xy[2 * a + 1]) - (xy[2 * b + 1] - xy[2 * a + 1]) * (xy[2 * c] - xy[2 * a]);
  let meshes = 0, worstArea = 0, classified = 0, onCrease = 0;
  for (const g of GROUPS) {
    const m = motifFor(g), size = Math.sqrt(g.domainArea), comma = Math.abs(areaCentroid(m.polylines[0]).area);
    const seeds = [{ seed: g.presets[0].seed, metric: g.presets[0].metric }];
    seeds.push({ seed: [g.center[0] + (2 * rand() - 1) * 0.7 * g.viewHalf, g.center[1] + (2 * rand() - 1) * 0.7 * g.viewHalf] });
    for (const c of seeds) for (const amp of [0, 1]) {
      const tag = `${g.id} seed ${c.seed.map((v) => v.toFixed(3))} amp ${amp}`;
      const d = buildDomain(g, { seed: c.seed, metric: c.metric, warp: makeWarp(g, amp) });
      const tile = g.fold === 'snowflake' ? null : buildMesh(g, d, foldMeshOptions(g));
      const fold = createFold(g, d, tile, foldOptions({ anchor: g.presets[0].anchor || g.presets[0].seed }));
      const M = fold.mesh, T = motifTintMesh(g, M, m);
      assert.ok(T && T.motifTint === true, `${tag}: the mesh holds the comma`);
      meshes++;
      // the mesh's own vertices first, unchanged; then the crossing points two by two (inside, outside)
      assert.deepEqual(Array.from(T.xy.subarray(0, 2 * M.n)), Array.from(M.xy.subarray(0, 2 * M.n)), tag);
      assert.deepEqual(Array.from(T.cell.subarray(0, M.n)), Array.from(M.cell.subarray(0, M.n)), tag);
      assert.ok(T.tint instanceof Uint8Array && T.tint.length === T.n && T.cell.length === T.n && T.xy.length === 2 * T.n, tag);
      assert.ok(T.triCell.length === T.tri.length / 3 && T.m === T.tri.length / 3, tag);
      assert.ok(T.tri.length / 3 <= 20000, `${tag}: ${T.tri.length / 3} triangles`);
      for (let v = M.n; v < T.n; v += 2) {
        assert.equal(T.xy[2 * v], T.xy[2 * v + 2]); assert.equal(T.xy[2 * v + 1], T.xy[2 * v + 3]);
        assert.equal(T.tint[v] & 2, 2); assert.equal(T.tint[v + 1] & 2, 0); assert.equal(T.tint[v] & 1, T.tint[v + 1] & 1);
      }
      // bit 0 is the mesh's own (a star's mirror images), bit 1 the comma
      for (let v = 0; v < M.n; v++) assert.equal(T.tint[v] & 1, M.tint ? M.tint[v] & 1 : 0, `${tag}: the ghost bit of vertex ${v}`);
      // area kept, triangles counter-clockwise, one tint per triangle; the filled area is one comma per cell
      let a0 = 0, a1 = 0, filled = 0;
      for (let i = 0; i < M.tri.length; i += 3) a0 += area2(M.xy, M.tri[i], M.tri[i + 1], M.tri[i + 2]);
      for (let i = 0; i < T.tri.length; i += 3) {
        const a = T.tri[i], b = T.tri[i + 1], e = T.tri[i + 2], ar = area2(T.xy, a, b, e);
        assert.ok(ar > -1e-12 * size * size, `${tag}: an inverted triangle`);
        a1 += ar;
        assert.ok(T.tint[a] === T.tint[b] && T.tint[b] === T.tint[e], `${tag}: a triangle of mixed tint`);
        if (T.tint[a] & 2) filled += ar;
      }
      assert.ok(Math.abs(a1 - a0) <= 1e-7 * Math.abs(a0), `${tag}: area ${a1} vs ${a0}`);
      const cells = g.fold === 'snowflake' ? fold.cellMaps.length : 1;     // a star holds one comma per cell
      worstArea = Math.max(worstArea, Math.abs(filled / 2 - cells * comma) / (cells * comma));
      assert.ok(Math.abs(filled / 2 - cells * comma) <= 0.02 * cells * comma, `${tag}: filled ${filled / 2} vs ${cells} x ${comma}`);
      // each of the mesh's own vertices has the fill bit exactly when it lies inside a copy (checked apart from
      // motif.js, away from the outline by more than 1e-6 tile sizes)
      const bb = M.bbox || [Infinity, Infinity, -Infinity, -Infinity];
      if (!M.bbox) for (let v = 0; v < M.n; v++) { bb[0] = Math.min(bb[0], M.xy[2 * v]); bb[1] = Math.min(bb[1], M.xy[2 * v + 1]); bb[2] = Math.max(bb[2], M.xy[2 * v]); bb[3] = Math.max(bb[3], M.xy[2 * v + 1]); }
      const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, R = Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2;
      const copies = elementsNear(g, cx, cy, R + 1.01 * m.radius, m.at[0], m.at[1]).map((e) => ({ P: moved(m.polylines[0], e), ox: e.a * m.at[0] + e.b * m.at[1] + e.tx, oy: e.c * m.at[0] + e.d * m.at[1] + e.ty }));
      for (let v = 0; v < M.n; v += 3) {
        const x = M.xy[2 * v], y = M.xy[2 * v + 1];
        let inside = false, near = false;
        for (const C of copies) {
          if (Math.hypot(x - C.ox, y - C.oy) > 1.001 * m.radius) continue;
          const s = sideOf(C.P, x, y);
          if (s.dist < 1e-6 * size) near = true;
          if (s.inside) inside = true;
        }
        if (near) continue;
        classified++;
        assert.equal(T.tint[v] & 2, inside ? 2 : 0, `${tag}: the vertex (${x}, ${y}) is ${inside ? 'inside' : 'outside'} the comma`);
      }
      // a new point moves with its triangle: its piece is the triangle's, or it lies on a crease where both pieces' maps
      // agree (to within what float32 coordinates allow: the mesh's own crease vertices show gaps up to 3e-8 too)
      const F = fold.at(0.5), p = [0, 0, 0], q = [0, 0, 0];
      for (let tr = 0; tr < T.tri.length / 3; tr++) {
        for (let k = 0; k < 3; k++) {
          const v = T.tri[3 * tr + k];
          if (v < M.n || T.cell[v] === T.triCell[tr]) continue;
          F(T.xy[2 * v], T.xy[2 * v + 1], T.cell[v], p); F(T.xy[2 * v], T.xy[2 * v + 1], T.triCell[tr], q);
          assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-6 * size, `${tag}: a crossing point off its triangle's piece moves apart from it`);
          onCrease++;
        }
      }
      assert.equal(T.motifCut.bad, 0, `${tag}: ${T.motifCut.bad} triangles left whole (the cut was inconsistent)`);
      for (const key of ['boundary', 'cells', 'creases', 'locate', 'bbox', 'root']) assert.equal(T[key], M[key], `${tag}: ${key}`);
    }
  }
  t.diagnostic(`${meshes} meshes; filled area within ${(100 * worstArea).toFixed(2)} % of the commas; ${classified} vertices classified; ${onCrease} crossing points shared across a crease`);
  // a mesh that no comma meets: nothing to fill (a small triangle at a 3-fold centre of 333, which every comma keeps clear of)
  const lone = { n: 3, xy: Float32Array.from([-0.01, -0.01, 0.01, -0.01, 0, 0.01]), tri: Uint32Array.from([0, 1, 2]), cell: new Uint16Array(3), bbox: [-0.01, -0.01, 0.01, 0.01] };
  assert.equal(motifTintMesh(BY_ID['333'], lone, motifFor(BY_ID['333'])), null);
});

test('motifTintMesh: an outline point lying exactly on a mesh edge (it coincides with the crossing there) is cut cleanly — the three dragged cuts where a triangle was left whole, of mixed tint (final fix, 10 Nov: the tests-math verifier, FOLDS_WALK=100 and the 600-step walk)', async () => {
  const { buildScene } = await import('../src/app.js');
  const walkSeed = (g, k) => [g.center[0] + 0.95 * g.viewHalf * Math.sin((2 * Math.PI * 3 * k) / 600 + 0.4), g.center[1] + 0.95 * g.viewHalf * Math.sin((2 * Math.PI * 2 * k) / 600 + 1.1)];
  const cases = [['xx', [1.3808521945804193, 2.026794771978526], 0.7], ['o', walkSeed(BY_ID.o, 170), 1], ['xx', walkSeed(BY_ID.xx, 311), 0.7]];
  for (const [id, seed, amp] of cases) {
    const g = BY_ID[id], p = g.presets[0];
    const M = buildScene(g, { seed, metric: p.metric, amp, anchor: p.seed.slice() }).M;
    const tag = `${id} seed (${seed.map((v) => v.toFixed(6))}) amp ${amp}`;
    assert.ok(M.motifTint === true && M.motifCut.triangles > 100, `${tag}: the comma is cut into the mesh`);
    assert.equal(M.motifCut.bad, 0, `${tag}: no triangle left whole`);
    let mixed = 0;
    for (let i = 0; i < M.tri.length; i += 3) { const a = M.tri[i], b = M.tri[i + 1], c = M.tri[i + 2]; if (((M.tint[a] ^ M.tint[b]) | (M.tint[b] ^ M.tint[c])) & 2) mixed++; }
    assert.equal(mixed, 0, `${tag}: triangles of mixed fill tint`);
  }
});
