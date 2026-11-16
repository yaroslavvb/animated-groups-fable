// test/journey.test.js — src/journey.js: one line through the three states of a pattern (15 Nov 2026).
// The owner: "Normally, the folded part is just the surface, but here [*632] there is a bit of confusion about which
// part lies in the folding and which part lies in the tiling. Unify those two. Also, maybe the Unfold and Tile buttons
// should be in the same place so I can first unfold and then tile."
//   the line      j = 0 the surface (t = 1), j = a the flat tile, j = 1 the pattern (tile = 1); a tile that is not
//                 flat has no copies; a kaleidoscope (no fold) has a = 0: its tile is its surface
//   the stops     the three main ones, named; the fold's own and the tiling's layers between them, never crowded
//   the buttons   nextTarget: Fold goes to the tile first when there are copies, Unfold stops at the tile, Tile goes on
//   the seconds   each half plays at its own speed; gathering is quicker
//   the groups    the 13 groups with zippers have a fold half, the 4 kaleidoscopes none (their fold is still)
import test from 'node:test';
import assert from 'node:assert/strict';
import { journeyLayout, journeyOf, stateOf, journeyStops, stopOf, nextTarget, normalizeState, segmentSeconds, TILE_AT, AT_STOP } from '../src/journey.js';
import { GROUPS, BY_ID, surfaceFacts } from '../src/groups.js';
import { buildDomain } from '../src/domain.js';
import { createFold } from '../src/folds/index.js';
import { normalizeStops } from '../src/timeline.js';

const L = journeyLayout(5, 6), K = journeyLayout(0, 6);

test('the layout: the tile in the middle of the track when there is a fold, at its start when there is none', () => {
  assert.deepEqual(L, { a: TILE_AT, fold: 5, tile: 6, seconds: 11 });
  assert.equal(TILE_AT, 0.5);
  assert.deepEqual(K, { a: 0, fold: 0, tile: 6, seconds: 6 });
  for (const bad of [NaN, -1, undefined, null, Infinity]) assert.equal(journeyLayout(bad, 4).a, 0, `a fold of ${bad} s is no fold`);
  assert.equal(journeyLayout(5, NaN).tile, 1, 'a tiling without a length still has a half of the track');
});

test('the invariant: a tile that is not flat has no copies; a missing tile is the pattern', () => {
  assert.deepEqual(normalizeState(0, 1), { t: 0, tile: 1 });
  assert.deepEqual(normalizeState(0, undefined), { t: 0, tile: 1 });
  assert.deepEqual(normalizeState(0, null), { t: 0, tile: 1 });
  assert.deepEqual(normalizeState(0, 0.3), { t: 0, tile: 0.3 });
  assert.deepEqual(normalizeState(0.4, 0.3), { t: 0.4, tile: 0 });
  assert.deepEqual(normalizeState(1, undefined), { t: 1, tile: 0 });
  assert.deepEqual(normalizeState(7, -2), { t: 1, tile: 0 });
  assert.deepEqual(normalizeState(NaN, 9), { t: 0, tile: 1 });
});

test('the line: journeyOf and stateOf are inverse on the states that exist, monotone, continuous through the tile', () => {
  assert.equal(journeyOf(L, 1, 0), 0); assert.equal(journeyOf(L, 0, 0), 0.5); assert.equal(journeyOf(L, 0, 1), 1);
  assert.equal(journeyOf(L, 0.5, 0.7), 0.25, 't wins over tile');
  assert.deepEqual(stateOf(L, 0), { t: 1, tile: 0 }); assert.deepEqual(stateOf(L, 0.5), { t: 0, tile: 0 }); assert.deepEqual(stateOf(L, 1), { t: 0, tile: 1 });
  for (const lay of [L, K, journeyLayout(7, 2)]) {
    let prev = null;
    for (let i = 0; i <= 2000; i++) {
      const j = i / 2000, s = stateOf(lay, j);
      assert.ok(s.t === 0 || s.tile === 0, `j = ${j}: one of the two is under way`);
      assert.ok(Math.abs(journeyOf(lay, s.t, s.tile) - j) < 1e-12, `j = ${j} comes back`);
      if (prev) {
        assert.ok(s.t <= prev.t && s.tile >= prev.tile, `j = ${j}: the fold opens, then the copies come`);
        assert.ok(prev.t - s.t <= 1.01 / (2000 * (lay.a || 1)) + 1e-12 && s.tile - prev.tile <= 1.01 / (2000 * (1 - lay.a)) + 1e-12, `j = ${j}: no jump`);
      }
      prev = s;
    }
  }
  // a kaleidoscope: the whole track is the tiling; a fold asked for is its tile (the surface)
  assert.deepEqual(stateOf(K, 0), { t: 0, tile: 0 }); assert.deepEqual(stateOf(K, 0.4), { t: 0, tile: 0.4 });
  assert.equal(journeyOf(K, 1, 0), 0, 'folded = the tile alone'); assert.equal(journeyOf(K, 0.3, 1), 0);
  for (const out of [-1, 2, NaN]) assert.ok(stateOf(L, out).t >= 0 && stateOf(L, out).tile >= 0, `j = ${out} is clamped`);
});

test('the stops: surface, tile, pattern — named and marked; the fold\'s and the layers\' own between them, never crowded', () => {
  const stops = journeyStops(L, [{ t: 0, label: 'flat' }, { t: 0.45, label: 'tube' }, { t: 1, label: 'torus' }], [{ t: 0.3, label: 'layer 1' }, { t: 0.5, label: 'layer 2' }, { t: 0.97, label: 'layer 3' }, { t: 1, label: 'tiled' }]);
  assert.deepEqual(stops.filter((s) => s.main).map((s) => [s.t, s.label]), [[0, 'surface'], [0.5, 'tile'], [1, 'pattern']]);
  assert.deepEqual(stops.filter((s) => !s.main).map((s) => [s.t, s.label]), [[0.275, 'tube'], [0.65, 'layer 1'], [0.75, 'layer 2']], 'a layer that ends 1.5 % short of the pattern has no stop of its own');
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i].t - stops[i - 1].t >= 0.06 - 1e-12, 'a magnet needs room');
  const k = journeyStops(K, [{ t: 0.5, label: 'never' }], [{ t: 0.4, label: 'layer 3' }]);
  assert.deepEqual(k.map((s) => [s.t, s.label, !!s.main]), [[0, 'tile = surface', true], [0.4, 'layer 3', false], [1, 'pattern', true]], 'a kaleidoscope: no fold half, its tile is the surface');
  // the timeline keeps the marks (and only them)
  const n = normalizeStops(stops);
  assert.deepEqual(n.filter((s) => s.main).map((s) => s.label), ['surface', 'tile', 'pattern']);
  assert.ok(n.filter((s) => !s.main).every((s) => !('main' in s)));
  assert.deepEqual(journeyStops(L).map((s) => s.label), ['surface', 'tile', 'pattern']);
});

test('where the thumb rests, and where a button plays to', () => {
  assert.equal(stopOf(L, 0), 'surface'); assert.equal(stopOf(L, 0.5), 'tile'); assert.equal(stopOf(L, 1), 'pattern');
  assert.equal(stopOf(L, 0.3), null); assert.equal(stopOf(L, 0.5 + 0.5 * AT_STOP), 'tile');
  assert.equal(stopOf(K, 0), 'tile', 'a kaleidoscope rests on its tile at the start of the track'); assert.equal(stopOf(K, 1), 'pattern');
  // Fold: from among the copies to the tile first, then on; Unfold: to the tile; Tile: to the pattern
  assert.equal(nextTarget(L, 1, 'surface'), 0.5); assert.equal(nextTarget(L, 0.7, 'surface'), 0.5);
  assert.equal(nextTarget(L, 0.5, 'surface'), 0); assert.equal(nextTarget(L, 0.2, 'surface'), 0); assert.equal(nextTarget(L, 0, 'surface'), 0);
  assert.equal(nextTarget(L, 0, 'pattern'), 0.5); assert.equal(nextTarget(L, 0.2, 'pattern'), 0.5);
  assert.equal(nextTarget(L, 0.5, 'pattern'), 1); assert.equal(nextTarget(L, 0.8, 'pattern'), 1); assert.equal(nextTarget(L, 1, 'pattern'), 1);
  assert.equal(nextTarget(K, 1, 'surface'), 0); assert.equal(nextTarget(K, 0, 'pattern'), 1);
});

test('the seconds: each half at its own speed; the copies are gathered quicker than they were made', () => {
  assert.equal(segmentSeconds(L, 0, 0.5), 5); assert.equal(segmentSeconds(L, 0.5, 0), 5); assert.equal(segmentSeconds(L, 0.25, 0.5), 2.5);
  assert.equal(segmentSeconds(L, 0.5, 1), 6); assert.equal(segmentSeconds(L, 0.75, 1), 3);
  assert.equal(segmentSeconds(L, 1, 0.5, 3), 2, 'gathering, three times as fast');
  assert.equal(segmentSeconds(L, 0.5, 1, 3), 6, 'making the copies is never hurried');
  assert.equal(segmentSeconds(L, 0.5, 0, 3), 5, 'nor is the fold');
  assert.equal(segmentSeconds(K, 1, 0, 1.5), 4); assert.equal(segmentSeconds(K, 0, 1, 1.5), 6);
});

test('the groups: 13 have zippers and a fold half; the 4 kaleidoscopes have none — their tile is their surface, a disk', () => {
  let folds = 0, still = 0;
  for (const g of GROUPS) {
    const p = g.presets[0], d = buildDomain(g, { seed: p.seed, metric: p.metric }), fold = createFold(g, d, null, { anchor: p.seed });
    const zippers = d.edges.filter((e) => e.kind !== 'mirror').length, lay = journeyLayout(fold.still ? 0 : fold.duration, 5);
    const f = surfaceFacts(g.id);
    if (g.fold === 'disc') {
      still++;
      assert.equal(zippers, 0, `${g.id}: every edge of the tile is a mirror`);
      assert.ok(fold.still === true && lay.a === 0, `${g.id}: nothing to zip, no fold half`);
      assert.deepEqual([f.handles, f.crosscaps, f.boundaries, f.cones.length, f.chi, f.sides], [0, 0, 1, 0, 1, 2], `${g.id}: a disk with corners only`);
      assert.equal(g.surface, 'disk');
      assert.ok(g.id.startsWith('*') && /^\*[2-9]+$/.test(g.id), `${g.id}: a kaleidoscope's symbol`);
    } else {
      folds++;
      assert.ok(zippers > 0, `${g.id}: the tile has zippers`);
      assert.ok(!fold.still && lay.a === TILE_AT, `${g.id}: a fold half`);
    }
  }
  assert.deepEqual([folds, still], [13, 4]);
  assert.deepEqual(GROUPS.filter((g) => g.fold === 'disc').map((g) => g.id).sort(), ['*2222', '*333', '*442', '*632']);
  assert.equal(BY_ID['*632'].topology, 'a punched sphere; its rim is a mirror with corners of order 6, 3, 2');
});
