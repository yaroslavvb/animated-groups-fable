// test/app-url.test.js — the pure parts of src/app.js that round 3 added (SPEC 7 URL state contract, SPEC 8 C1-C3,
// finding 29). OWNER: ui-app. The browser half (a real wrapper stand-in, real clicks) is dev/ui3-url-loop.mjs.
//
//   the hash      encodeHash / decodeHash: every parameter round-trips at its precision, defaults are left out, the
//                 id's * is %2A, every hash written passes the spacesheep viewer's filter, legacy #<id> links load,
//                 malformed values are dropped (and nothing else with them)
//   the view      viewToUrl / viewFromUrl: az / el as R.setView takes them, plus the turn about the line of sight
//   presets       presetState: the anchor is preset.anchor ?? preset.seed (C3)
//   features      groupFeatures: #app[data-features] (C1), checked against the tiles themselves
//   colours       surfaceStyle: front and back swap for fold.mirrored (C3)
//   the hint      hintState: none for the kaleidoscopes (C1)
//   labels        coneClasses / sceneMarkers: one label per point of the orbifold, copies fade, never pop (29)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GROUPS, BY_ID } from '../src/groups.js';
import { makeWarp, buildDomain } from '../src/domain.js';
import { viewFromAzEl } from '../src/render3d.js';
import { SURFACE_FRONT, SURFACE_BACK } from '../src/palette.js';
import {
  encodeHash, decodeHash, encodeGroupId, WRAPPER_HASH, HASH_KEYS, HASH_THROTTLE_MS, HASH_BUDGET, hashInterval, hashWriteDelay, DEFAULT_VIEW, DEFAULT_GROUP,
  viewToUrl, viewFromUrl, viewAngle, presetState, groupFeatures, FEATURES, surfaceStyle, hintState, HINT_TEXT,
  buildScene, mapScene, sceneMarkers, coneClasses, labelFade, LABEL_FADE, TURN_MIN_DEG, sceneLines, WIDTHS, EDGE_XRAY, KALEIDO_EDGE_XRAY,
} from '../src/app.js';

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
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
/** What mapScene does for the cone points alone (the rest of the scene is not needed for the markers). */
function placeCones(scene, t) {
  const F = scene.fold.at(t);
  for (const c of scene.cones) F(c.x, c.y, c.cell, c.p);
  return scene;
}
/** '2*22' -> ['2', '∗2', '∗2'] (as test/folds.test.js) */
function specialPoints(id) {
  const out = [];
  let mirror = false;
  for (const ch of id) { if (ch === '*') mirror = true; else if (/[2-9]/.test(ch)) out.push((mirror ? '∗' : '') + ch); }
  return out.sort();
}

// ---- the hash ------------------------------------------------------------------------------------------------------

test('url: the format — g always, every other key only when it is not its default, in the order of SPEC 7, * as %2A', () => {
  // (10 Nov 2026, the replication step: `tile` joined the contract between wavy and t; qa/rep-judge.md.
  //  13 Nov 2026, the pattern selector: `pat` right after g, written when it is not the default, the checkerboard)
  assert.deepEqual(HASH_KEYS, ['g', 'pat', 'cut', 'seed', 'wavy', 'tile', 't', 'view']);
  assert.equal(encodeHash({ g: '333', pat: 'checker' }), '#g=333', 'the checkerboard is the default pattern: not written');
  assert.equal(encodeHash({ g: '333', pat: 'comma' }), '#g=333&pat=comma');
  assert.equal(encodeHash({ g: '333', pat: 'rings', cut: 1, t: 0.5 }), '#g=333&pat=rings&cut=1&t=0.5', 'pat right after g');
  assert.equal(encodeHash({ g: '333', pat: 'Checkerboard' }), '#g=333', 'a label is taken for its key');
  assert.equal(encodeHash({ g: '333', pat: 'tartan' }), '#g=333', 'an unknown pattern is not written');
  assert.equal(decodeHash('#g=333').pat, 'checker', 'no pat: the default');
  assert.equal(decodeHash('#g=333&pat=comma').pat, 'comma');
  assert.equal(decodeHash('#g=333&pat=RINGS').pat, 'rings', 'case does not matter');
  assert.deepEqual([decodeHash('#g=333&pat=tartan&t=0.5').pat, decodeHash('#g=333&pat=tartan&t=0.5').dropped, decodeHash('#g=333&pat=tartan&t=0.5').t], ['checker', ['pat'], 0.5], 'an unknown pattern is dropped, the rest counts');
  assert.match(encodeHash({ g: '*632', pat: 'comma', cut: 0, t: 1 }), WRAPPER_HASH);
  assert.equal(encodeHash({ g: '333' }), '#g=333');
  assert.equal(encodeHash({ g: '333', cut: 0, seed: null, wavy: 0, t: 0, view: { ...DEFAULT_VIEW } }), '#g=333', 'defaults are left out');
  assert.equal(encodeHash({ g: '*632' }), '#g=%2A632');
  assert.equal(encodeHash({ g: '2*22' }), '#g=2%2A22');
  assert.equal(encodeGroupId('**'), '%2A%2A');
  assert.equal(encodeHash({ g: '333', cut: 2 }), '#g=333&cut=2');
  assert.equal(encodeHash({ g: '333', seed: [0.123456, -0.5] }), '#g=333&seed=0.1235/-0.5');
  assert.equal(encodeHash({ g: '333', wavy: 0.37 }), '#g=333&wavy=0.37');
  assert.equal(encodeHash({ g: '333', t: 0.5 }), '#g=333&t=0.5');
  assert.equal(encodeHash({ g: '333', tile: 0.25 }), '#g=333&tile=0.25');
  assert.equal(encodeHash({ g: '333', tile: 1 }), '#g=333', 'tile 1 (the tiling as always) is the default');
  assert.equal(encodeHash({ g: '333', tile: 0 }), '#g=333&tile=0', 'tile 0 (the tile alone) is written');
  assert.equal(encodeHash({ g: '333', tile: null }), '#g=333', 'no tile: 1');
  assert.equal(encodeHash({ g: '333', view: { az: 30, el: 20, zoom: 1.5, roll: 0 } }), '#g=333&view=30/20/1.5');
  assert.equal(encodeHash({ g: '333', view: { az: 0, el: 55, zoom: 1, roll: 12.5 } }), '#g=333&view=0/55/1/12.5', 'roll only when it is not 0');
  assert.equal(encodeHash({ g: '4*2', cut: 1, seed: [0.2, 0.3], wavy: 1, t: 1, view: { az: -40.26, el: 12, zoom: 2.346, roll: -3 } }),
    '#g=4%2A2&cut=1&seed=0.2/0.3&wavy=1&t=1&view=-40.3/12/2.35/-3', 'all keys, in order');
  assert.equal(encodeHash({ g: '4*2', cut: 1, seed: [0.2, 0.3], wavy: 1, tile: 0.5, t: 1, view: { az: -40.26, el: 12, zoom: 2.346, roll: -3 } }),
    '#g=4%2A2&cut=1&seed=0.2/0.3&wavy=1&tile=0.5&t=1&view=-40.3/12/2.35/-3', 'tile between wavy and t');
  // rounding: seed 4 decimals, t 3, wavy 2, angles 1, zoom 2; nothing written as -0 or with an exponent
  assert.equal(encodeHash({ g: '333', t: 0.12345 }), '#g=333&t=0.123');
  assert.equal(encodeHash({ g: '333', t: 0.9996 }), '#g=333&t=1');
  assert.equal(encodeHash({ g: '333', tile: 0.12345 }), '#g=333&tile=0.123', 'tile: 3 decimals');
  assert.equal(encodeHash({ g: '333', tile: 0.9996 }), '#g=333', 'a tile that rounds to 1 is left out');
  assert.equal(encodeHash({ g: '333', tile: 0.0004 }), '#g=333&tile=0', 'one that rounds to 0 is written as 0');
  assert.equal(encodeHash({ g: '333', t: 0.0004, wavy: 0.004 }), '#g=333', 'what rounds to a default is left out');
  assert.equal(encodeHash({ g: '333', seed: [-0.00001, 1e-7] }), '#g=333&seed=0/0');
  assert.equal(encodeHash({ g: '333', view: { az: 179.96, el: 55, zoom: 1, roll: 0 } }), '#g=333&view=180/55/1');
  assert.equal(encodeHash({ g: '333', view: { az: -180, el: 55, zoom: 1, roll: 0 } }), '#g=333&view=180/55/1', '-180 and 180 are one azimuth');
  assert.equal(encodeHash({ g: '333', view: { az: 360.04, el: 55, zoom: 1.004, roll: -0.04 } }), '#g=333', 'az 360 = 0, zoom 1.004 = 1');
  assert.equal(encodeHash({ g: '333', t: 7, wavy: -1 }), '#g=333&t=1', 'out of range: clamped');
  assert.equal(encodeHash({ g: '333', tile: -2 }), '#g=333&tile=0', 'tile out of range: clamped');
  assert.equal(encodeHash({ g: '333', tile: 9 }), '#g=333');
  assert.ok(HASH_THROTTLE_MS >= 150 && HASH_THROTTLE_MS <= 400, 'about 250 ms');
  assert.ok(HASH_BUDGET.calls <= 90 && HASH_BUDGET.ms >= 30000, 'under Safari\'s 100 history calls per 30 s');
});

test('url: the write policy — one write per 250 ms while the state changes, at once when a gesture ends, never over the cap, and never stalled for long', () => {
  assert.equal(hashInterval(0), HASH_THROTTLE_MS);
  assert.equal(hashInterval(HASH_BUDGET.from), HASH_THROTTLE_MS);
  assert.ok(hashInterval(HASH_BUDGET.calls) > hashInterval(HASH_BUDGET.from + 1));
  assert.equal(hashWriteDelay(1000, []), 0, 'the first write: at once');
  assert.equal(hashWriteDelay(1000, [900]), 150, '250 ms after the last one');
  assert.equal(hashWriteDelay(1000, [900], true), 0, 'a gesture that ends: at once');
  const full = Array.from({ length: HASH_BUDGET.calls }, (_, i) => 100 + i);
  assert.equal(hashWriteDelay(5000, full, true), 100 + HASH_BUDGET.ms - 5000, 'a full window: even an urgent write waits for its oldest');
  // a simulated page: the state changes every frame for minutes (a long drag, plays one after another), and a gesture
  // ends every 1.7 s (an urgent write); the writer is the page's (the hash changes every time)
  for (const urgentEvery of [0, 1700, 300]) {
    const writes = [], all = [];
    let timer = null;
    const write = (now, urgent) => {
      while (writes.length && now - writes[0] >= HASH_BUDGET.ms) writes.shift();
      const wait = hashWriteDelay(now, writes, urgent);
      if (wait > 0) { if (!timer || urgent) timer = { at: now + wait, urgent }; return; }
      timer = null; writes.push(now); all.push(now);
    };
    let nextUrgent = urgentEvery || Infinity;
    for (let now = 0; now <= 180000; now += 16) {
      if (timer && now >= timer.at) { const u = timer.urgent; timer = null; write(now, u); }
      if (now >= nextUrgent) { write(now, true); nextUrgent += urgentEvery; } else if (!timer) write(now, false);
    }
    let most = 0, gap = 0;
    for (let i = 0, j = 0; i < all.length; i++) { while (all[i] - all[j] >= HASH_BUDGET.ms) j++; most = Math.max(most, i - j + 1); if (i) gap = Math.max(gap, all[i] - all[i - 1]); }
    assert.ok(most <= HASH_BUDGET.calls, `urgent every ${urgentEvery} ms: ${most} writes in 30 s (cap ${HASH_BUDGET.calls})`);
    assert.ok(urgentEvery === 300 || gap <= 1300, `urgent every ${urgentEvery} ms: the address waited ${gap} ms at most`);
    assert.ok(all[1] - all[0] <= HASH_THROTTLE_MS + 16, 'at first, every 250 ms');
  }
});

/** A random state of a group, as the page would write it (values already at the precision of the hash). */
function randomState(group, rnd) {
  const snow = group.fold === 'snowflake';
  const u = { g: group.id, cut: Math.floor(rnd() * group.presets.length), seed: null, wavy: 0, tile: 1, t: 0, view: null };
  if (!snow && rnd() < 0.6) u.seed = [round(group.center[0] + (2 * rnd() - 1) * group.viewHalf, 4), round(group.center[1] + (2 * rnd() - 1) * group.viewHalf, 4)];
  if (!snow && rnd() < 0.6) u.wavy = round(rnd(), 2);
  if (rnd() < 0.35) u.tile = Math.min(0.999, round(rnd(), 3));          // the replication paused part-way (1 = tiled)
  if (rnd() < 0.8) u.t = round(rnd(), 3);
  if (rnd() < 0.15) u.t = 1;
  const angle = () => { const a = round(360 * rnd() - 180, 1); return a <= -180 ? a + 360 : a; };   // in (-180, 180]
  if (rnd() < 0.8) u.view = { az: angle(), el: round(180 * rnd() - 90, 1), zoom: round(0.5 + 2.7 * rnd(), 2), roll: rnd() < 0.5 ? 0 : angle() };
  if (u.view && Math.abs(u.view.el) === 90) u.view.az = 0;                // looking straight down or up: az is 0 by convention
  return u;
}

test('url: every parameter round-trips — decode(encode(state)) is the state, and encoding again gives the same text', () => {
  const rnd = prng(907);
  let n = 0;
  for (const group of GROUPS) {
    for (let k = 0; k < 150; k++) {
      const u = randomState(group, rnd);
      const h = encodeHash(u), d = decodeHash(h);
      assert.ok(d && !d.legacy, `${h}: decodes`);
      assert.deepEqual(d.dropped, [], `${h}: nothing dropped`);
      assert.equal(d.g, u.g, h);
      assert.equal(d.cut, u.cut, `${h}: cut`);
      assert.deepEqual(d.seed, u.seed, `${h}: seed`);
      assert.equal(d.wavy, u.wavy, `${h}: wavy`);
      assert.equal(d.t, u.t, `${h}: t`);
      assert.equal(d.tile, u.tile, `${h}: tile`);
      const v = u.view && !(u.view.az === 0 && u.view.el === 55 && u.view.zoom === 1 && u.view.roll === 0) ? u.view : null;
      if (v) {
        assert.ok(d.view, `${h}: a view`);
        for (const key of ['az', 'el', 'zoom', 'roll']) assert.ok(Math.abs(d.view[key] - v[key]) < 1e-9, `${h}: view ${key} ${d.view[key]} for ${v[key]}`);
      } else assert.equal(d.view, null, `${h}: the default view writes nothing`);
      assert.equal(encodeHash(d), h, `${h}: encodes again to itself`);
      assert.match(h, WRAPPER_HASH, `${h}: the spacesheep viewer takes it`);
      n++;
    }
  }
  assert.equal(n, 17 * 150);
  // every value of tile the page can write, 0 to 0.999 in steps of 0.001, comes back as itself
  for (let i = 0; i < 1000; i++) { const v = i / 1000, h = encodeHash({ g: '22x', tile: v }); assert.equal(decodeHash(h).tile, v, h); assert.match(h, WRAPPER_HASH); }
  for (const h of ['#g=333', '#333', '#4*2', '#*632', '#g=%2A632&t=0.5']) assert.equal(decodeHash(h).tile, 1, `${h}: no tile = tiled`);
});

test('url: every group id, in every spelling a person or an old link may use', () => {
  for (const g of GROUPS) {
    assert.equal(decodeHash(encodeHash({ g: g.id })).g, g.id);
    assert.match(encodeHash({ g: g.id }), WRAPPER_HASH, `${g.id}: the viewer takes the hash`);
    assert.equal(decodeHash('#g=' + g.id).g, g.id, `${g.id}: a raw * after g=`);
    assert.equal(decodeHash('#g=' + g.id.replace(/\*/g, 's')).g, g.id, `${g.id}: s for *`);
    assert.equal(decodeHash('g=' + g.label).g, g.id, `${g.id}: the display label, no #`);
    // legacy #<id>
    for (const legacy of ['#' + g.id, '#' + encodeURIComponent(g.id), '#' + g.id.replace(/\*/g, 's'), '#' + encodeURIComponent(g.label), '#' + g.id.toUpperCase()]) {
      const d = decodeHash(legacy);
      assert.ok(d && d.legacy && d.g === g.id, `${legacy} -> ${JSON.stringify(d)}`);
      assert.equal(d.t, 0); assert.equal(d.cut, 0); assert.equal(d.seed, null); assert.equal(d.view, null);
    }
  }
  for (const [h, id] of [['#333', '333'], ['#4*2', '4*2'], ['#*632', '*632'], ['#%2A632', '*632'], ['#s632', '*632'], ['#∗632', '*632'],
    ['#%E2%88%97632', '*632'], ['#22X', '22x'], ['#22×', '22x'], ['#O', 'o'], ['#ss', '**'], ['#sx', '*x'], ['#xx', 'xx']]) {
    const d = decodeHash(h);
    assert.ok(d && d.legacy && d.g === id, `${h} -> ${JSON.stringify(d)}`);
  }
  // the viewer refuses the old spelling with a *: the page must rewrite it (it does: it writes %2A)
  assert.doesNotMatch('#*632', WRAPPER_HASH);
  assert.doesNotMatch('#4*2', WRAPPER_HASH);
  assert.match('#g=%2A632&seed=0.1/-0.2&view=1/2/3/4', WRAPPER_HASH);
  for (const bad of ['#a,b', '#a:b', '#a~b', '#a+b', '#a b']) assert.doesNotMatch(bad, WRAPPER_HASH, bad);
});

test('url: malformed hashes name nothing; a malformed value is dropped and the rest of the hash still counts', () => {
  for (const none of [null, undefined, '', '#', '#  ', '#nonsense', '#123', '#p3', '#__proto__', '#constructor', '#g=nonsense', '#g=', '#g=__proto__',
    '#foo=bar', '#=5', '#&&', '#%E0%A4%A']) {
    assert.equal(decodeHash(none), null, String(none));
  }
  const d0 = decodeHash('#t=0.5');
  assert.ok(d0 && d0.g === DEFAULT_GROUP && d0.t === 0.5, 'no g: the default group');
  const cases = [
    ['#g=333&t=abc', 't'], ['#g=333&t=1e-3', 't'], ['#g=333&t=+0.5', 't'], ['#g=333&t=0x1', 't'], ['#g=333&t=Infinity', 't'], ['#g=333&t=NaN', 't'],
    ['#g=333&t=', 't'], ['#g=333&t=0.5.5', 't'], ['#g=333&t=--1', 't'],
    ['#g=333&cut=3', 'cut'], ['#g=333&cut=-1', 'cut'], ['#g=333&cut=1.5', 'cut'], ['#g=333&cut=one', 'cut'], ['#g=%2A632&cut=1', 'cut'],
    ['#g=333&seed=0.5', 'seed'], ['#g=333&seed=0.5/0.5/1', 'seed'], ['#g=333&seed=a/b', 'seed'], ['#g=333&seed=1e3/0', 'seed'], ['#g=333&seed=99999/0', 'seed'],
    ['#g=333&seed=/0.5', 'seed'],
    ['#g=333&tile=abc', 'tile'], ['#g=333&tile=1e-3', 'tile'], ['#g=333&tile=', 'tile'], ['#g=333&tile=0.5/0.5', 'tile'], ['#g=333&tile=+0.5', 'tile'],
    ['#g=333&wavy=lots', 'wavy'], ['#g=333&view=10/20', 'view'], ['#g=333&view=1/2/3/4/5', 'view'], ['#g=333&view=a/20/1', 'view'], ['#g=333&view=10/20/', 'view'],
  ];
  for (const [h, key] of cases) {
    const d = decodeHash(h);
    assert.ok(d && (d.g === '333' || d.g === '*632'), `${h}: still names its group`);
    assert.deepEqual(d.dropped, [key], `${h}: drops ${key}`);
    const dflt = { cut: 0, seed: null, wavy: 0, tile: 1, t: 0, view: null }[key];
    assert.deepEqual(d[key], dflt, `${h}: ${key} takes its default`);
  }
  // the other keys survive a bad one
  const d1 = decodeHash('#g=2222&cut=1&seed=0.1/0.2&wavy=0.5&t=bad&view=10/20/1.5');
  assert.deepEqual([d1.g, d1.cut, d1.seed, d1.wavy, d1.t, d1.view && d1.view.az, d1.dropped], ['2222', 1, [0.1, 0.2], 0.5, 0, 10, ['t']]);
  // out of range: clamped, not dropped
  const dt = decodeHash('#g=333&tile=2'), dt2 = decodeHash('#g=333&tile=-0.5&t=0.3');
  assert.deepEqual([dt.tile, dt.dropped, dt2.tile, dt2.t, dt2.dropped], [1, [], 0, 0.3, []], 'tile out of range: clamped, not dropped');
  const d2 = decodeHash('#g=333&t=2&wavy=1.5&view=370/100/9/-190');
  assert.deepEqual([d2.t, d2.wavy, d2.view.az, d2.view.el, d2.view.zoom, d2.view.roll, d2.dropped], [1, 1, 10, 90, 3.2, 170, []]);
  const d3 = decodeHash('#g=333&t=-0.5&view=0/-120/0.1');
  assert.deepEqual([d3.t, d3.view.el, d3.view.zoom], [0, -90, 0.5]);
  // keys: case-insensitive; the first of two wins; unknown ones ignored; plain decimals like 1. and .5 are numbers
  const d4 = decodeHash('#G=333&T=.5&t=0.9&colour=red&wavy=1.');
  assert.deepEqual([d4.g, d4.t, d4.wavy, d4.dropped], ['333', 0.5, 1, []]);
  // percent escapes in values are read; a broken escape is taken as it stands (and then judged)
  assert.equal(decodeHash('#g=333&t=0%2E5').t, 0.5);
  assert.deepEqual(decodeHash('#g=333&t=0%2').dropped, ['t']);
});

// ---- the view ------------------------------------------------------------------------------------------------------

test('url view: az / el are where the eye is (as R.setView takes them); roll is the turn about the line of sight; the inverse is exact', () => {
  for (let az = -180; az <= 180; az += 15) {
    for (const el of [-89, -60, -30, -5, 0, 5, 20, 55, 75, 89]) {
      const v = viewToUrl({ ...viewFromAzEl(az, el), zoom: 1.7 });
      assert.ok(Math.abs(((v.az - az + 540) % 360) - 180) < 1e-7, `az ${az} el ${el}: az ${v.az}`);
      assert.ok(Math.abs(v.el - el) < 1e-7, `az ${az} el ${el}: el ${v.el}`);
      assert.ok(Math.abs(v.roll) < 1e-7, `az ${az} el ${el}: roll ${v.roll}`);
      assert.equal(v.zoom, 1.7);
    }
  }
  assert.deepEqual(viewToUrl(viewFromAzEl()), { az: 0, el: 55, zoom: 1, roll: 0 }, 'the default view');
  // looking straight down / up: az is 0 and the roll holds the turn
  for (const el of [90, -90]) {
    const v = viewToUrl(viewFromAzEl(40, el));
    assert.ok(v.az === 0 && Math.abs(Math.abs(v.el) - 90) < 1e-6, JSON.stringify(v));
    assert.ok(viewAngle(viewFromUrl(v).q, viewFromAzEl(40, el).q) < 1e-6, `el ${el}: the same view back`);
  }
  // random orientations (rolled, upside down, …): exact inverse; at the precision of the hash within 0.2 degrees
  const rnd = prng(55);
  let worst = 0;
  for (let k = 0; k < 3000; k++) {
    let q = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    const n = Math.hypot(...q); q = q.map((c) => c / n);
    const zoom = 0.5 + 2.7 * rnd();
    const u = viewToUrl({ q, zoom });
    assert.ok(u.el >= -90 && u.el <= 90 && u.az > -180 && u.az <= 180 && u.roll > -180 && u.roll <= 180, JSON.stringify(u));
    const back = viewFromUrl(u);
    assert.ok(viewAngle(back.q, q) < 1e-6, `exact inverse: ${viewAngle(back.q, q)} degrees`);
    assert.equal(back.zoom, zoom);
    const d = decodeHash(encodeHash({ g: '333', view: u }));
    const restored = d.view ? viewFromUrl(d.view) : viewFromUrl(DEFAULT_VIEW);
    const err = viewAngle(restored.q, q);
    worst = Math.max(worst, err);
    assert.ok(err < 0.2, `through the hash: ${err} degrees for ${JSON.stringify(u)}`);
    assert.ok(Math.abs(restored.zoom - Math.min(3.2, Math.max(0.5, zoom))) <= 0.0051, 'zoom to 0.01');
  }
  assert.ok(worst > 0.001, 'the rounding was exercised');
  assert.ok(TURN_MIN_DEG >= 1 && TURN_MIN_DEG <= 5);
});

// ---- presets, features, colours, hint --------------------------------------------------------------------------------

test('presets (C3): choosing a preset sets its seed, its metric and the anchor preset.anchor ?? preset.seed', () => {
  let explicit = 0;
  for (const g of GROUPS) {
    g.presets.forEach((p, i) => {
      const s = presetState(g, i);
      assert.equal(s.presetIndex, i); assert.equal(s.cutIndex, i);
      assert.deepEqual(s.seed, p.seed);
      assert.deepEqual(s.metric, p.metric ? p.metric : undefined);
      if (p.metric) assert.notEqual(s.metric, p.metric, 'the metric is copied');
      assert.deepEqual(s.anchor, p.anchor ? [p.anchor[0], p.anchor[1]] : [p.seed[0], p.seed[1]], `${g.id} ${p.name}: anchor`);
      if (p.anchor) explicit++;
    });
    assert.equal(presetState(g, 99).presetIndex, g.presets.length - 1, 'clamped');
    assert.equal(presetState(g, -3).presetIndex, 0);
    assert.equal(presetState(g, 'x').presetIndex, 0);
  }
  const fake = { presets: [{ name: 'A', seed: [1, 2] }, { name: 'B', seed: [3, 4], anchor: [5, 6] }, { name: 'C', seed: [7, 8], anchor: [NaN, 1] }] };
  assert.deepEqual(presetState(fake, 1).anchor, [5, 6]);
  assert.deepEqual(presetState(fake, 2).anchor, [7, 8], 'a malformed anchor: the seed');
  // finding 15: the presets whose seed lies on a crease carry the anchor of the cell their siblings share
  assert.ok(explicit >= 2, `${explicit} presets with an explicit anchor`);
});

test('features (C1): #app[data-features] from the orbifold symbol, and true of the tiles', () => {
  const want = {
    'o': 'seams', '**': 'seams mirrors', '*x': 'seams mirrors', 'xx': 'seams double', '2222': 'seams cones', '22*': 'seams mirrors cones',
    '2*22': 'seams mirrors cones corners', '22x': 'seams cones double', '333': 'seams cones', '3*3': 'seams mirrors cones corners',
    '*333': 'mirrors corners', '442': 'seams cones', '4*2': 'seams mirrors cones corners', '*442': 'mirrors corners', '632': 'seams cones',
    '*632': 'mirrors corners', '*2222': 'mirrors corners',
  };
  assert.deepEqual(FEATURES, ['seams', 'mirrors', 'cones', 'corners', 'double']);
  for (const g of GROUPS) {
    assert.equal(groupFeatures(g).join(' '), want[g.id], g.id);
    for (const p of g.presets) {
      const d = buildDomain(g, { seed: p.seed, metric: p.metric, warp: makeWarp(g, 0) });
      const f = new Set(groupFeatures(g));
      assert.equal(f.has('seams'), d.edges.some((e) => e.kind === 'cut'), `${g.id} ${p.name}: seams`);
      assert.equal(f.has('mirrors'), d.edges.some((e) => e.kind === 'mirror'), `${g.id} ${p.name}: mirrors`);
      assert.equal(f.has('cones'), d.conePoints.some((c) => !c.onMirror), `${g.id} ${p.name}: cones`);
      assert.equal(f.has('corners'), d.conePoints.some((c) => c.onMirror), `${g.id} ${p.name}: corners`);
    }
    const scene = buildScene(g, { seed: g.presets[0].seed, metric: g.presets[0].metric });
    assert.equal(groupFeatures(g).includes('double'), typeof scene.fold.doubleLine === 'function', `${g.id}: double = the fold has a double line`);
  }
});

test('colours (C3): a fold whose paper ends up turned over (fold.mirrored) gets front and back swapped', () => {
  assert.deepEqual(surfaceStyle({ mirrored: true }), { front: SURFACE_BACK, back: SURFACE_FRONT });
  for (const f of [{}, { mirrored: false }, { mirrored: 1 }, null, undefined]) assert.deepEqual(surfaceStyle(f), { front: SURFACE_FRONT, back: SURFACE_BACK });
  // 22*: its mirror y = 0.4; the anchor is the default preset's seed (above it), the seed is dragged below it
  const g = BY_ID['22*'], p = g.presets[0];
  const above = buildScene(g, { seed: p.seed, metric: p.metric, anchor: p.seed });
  const below = buildScene(g, { seed: [p.seed[0], 0.8 - p.seed[1]], metric: p.metric, anchor: p.seed });
  const plain = buildScene(g, { seed: [p.seed[0], 0.8 - p.seed[1]], metric: p.metric });
  assert.equal(above.fold.mirrored === true, false, 'on the anchor\'s side: not mirrored');
  assert.equal(below.fold.mirrored, true, 'across the mirror from the anchor: mirrored');
  assert.equal(plain.fold.mirrored === true, false, 'no anchor (anchor = seed): not mirrored');
  assert.deepEqual(surfaceStyle(below.fold), { front: SURFACE_BACK, back: SURFACE_FRONT });
});

test('hint (C1): "drag to move the cut" until the first drag; the kaleidoscopes have nothing to cut and no hint', () => {
  for (const g of GROUPS) {
    const kal = g.fold === 'snowflake';
    for (const dragged of [false, true]) {
      const h = hintState(g, dragged);
      assert.equal(h.text, HINT_TEXT);
      assert.equal(h.hidden, kal || dragged, `${g.id} dragged ${dragged}`);
    }
  }
  const tpl = fs.readFileSync(new URL('../src/index.template.html', import.meta.url), 'utf8');
  const m = tpl.match(/id="hint"[^>]*>([^<]*)</);
  assert.ok(m && m[1].trim() === HINT_TEXT, `the template's #hint reads "${m && m[1]}"`);
});

test('outline (5, the snowflake fixer\'s request): a kaleidoscope\'s mirror outline shows through a flap at 0.85; every other bold edge as before', () => {
  assert.ok(KALEIDO_EDGE_XRAY >= 0.8 && KALEIDO_EDGE_XRAY < 1 && EDGE_XRAY === 0.42);
  for (const g of GROUPS) {
    const p = g.presets[0], scene = buildScene(g, { seed: p.seed, metric: p.metric, anchor: p.anchor || p.seed });
    mapScene(scene, 0.9);
    const bold = sceneLines(scene, 1).filter((l) => l.width === WIDTHS.edge);
    assert.equal(bold.length, scene.edges.length, g.id);
    scene.edges.forEach((e, i) => {
      const want = e.mirror && g.fold === 'snowflake' ? KALEIDO_EDGE_XRAY : EDGE_XRAY;
      assert.ok(bold.some((l) => l.points === e.out && l.xray === want), `${g.id} edge ${i} (${e.mirror ? 'mirror' : 'seam'}): x-ray ${want}`);
    });
  }
});

// ---- one label per point of the orbifold (finding 29) ---------------------------------------------------------------

test('labels: the cone points of a tile fall into exactly the points the orbifold\'s name lists (coneClasses)', () => {
  const rnd = prng(29);
  let tiles = 0;
  for (const g of GROUPS) {
    const seeds = g.presets.map((p) => ({ seed: p.seed, metric: p.metric }));
    for (let k = 0; k < 8; k++) seeds.push({ seed: [g.center[0] + (2 * rnd() - 1) * g.viewHalf, g.center[1] + (2 * rnd() - 1) * g.viewHalf] });
    for (const s of seeds) {
      for (const amp of [0, 1]) {
        const d = buildDomain(g, { ...s, warp: makeWarp(g, amp) });
        const cones = d.conePoints, cls = coneClasses(g, cones);
        const firsts = [];
        cls.forEach((c, i) => { if (cls.indexOf(c) === i) firsts.push((cones[i].onMirror ? '∗' : '') + cones[i].order); });
        assert.deepEqual(firsts.sort(), specialPoints(g.id), `${g.id} seed ${s.seed} amp ${amp}: one class per point of the orbifold`);
        cls.forEach((c, i) => { const j = cls.indexOf(c); assert.ok(cones[j].order === cones[i].order && cones[j].onMirror === cones[i].onMirror); });
        tiles++;
      }
    }
  }
  assert.ok(tiles > 17 * 2 * 8);
});

test('labels: one label per point of the orbifold — the first copy always, a later copy fades as it nears an earlier one, continuously; one marker per point at t = 1', () => {
  assert.ok(LABEL_FADE[0] > 0.02 && LABEL_FADE[1] > LABEL_FADE[0] && LABEL_FADE[1] <= 0.6);
  assert.equal(labelFade(LABEL_FADE[0]), 0); assert.equal(labelFade(LABEL_FADE[1]), 1); assert.equal(labelFade(0), 0); assert.equal(labelFade(5), 1);
  const rnd = prng(2929);
  let copiesSeen = 0, fadesSeen = 0, worstStep = 0, worstCarried = 0;
  for (const g of GROUPS) {
    const cuts = g.presets.map((p) => ({ seed: p.seed, metric: p.metric, anchor: p.anchor || p.seed, name: p.name }));
    for (let k = 0; k < 2; k++) cuts.push({ seed: [g.center[0] + (2 * rnd() - 1) * g.viewHalf, g.center[1] + (2 * rnd() - 1) * g.viewHalf], anchor: g.presets[0].seed, name: 'random ' + k });
    for (const c of cuts) for (const amp of [0, 1]) {
      const scene = buildScene(g, { seed: c.seed, metric: c.metric, amp, anchor: c.anchor });
      const label = `${g.id} ${c.name} amp ${amp}`, size = scene.size, nCls = new Set(scene.cones.map((x) => x.cls)).size;
      if (scene.cones.length === nCls) continue;                   // no copies (rolls, kaleidoscopes): nothing fades
      const prev = new Map();
      for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        placeCones(scene, t);
        const marks = sceneMarkers(scene, 1);
        const firsts = marks.filter((m) => m.labelAlpha === undefined), copies = marks.filter((m) => m.labelAlpha !== undefined);
        assert.equal(firsts.length, nCls, `${label} t = ${t}: one first copy per point`);
        assert.ok(firsts.every((m) => m.label && !m.label.includes('​')), `${label}: the first copies are labelled plainly`);
        assert.equal(marks.slice(0, firsts.length).every((m) => m.labelAlpha === undefined), true, 'the first copies come first');
        const tags = new Set();
        for (const m of copies) {
          copiesSeen++;
          assert.ok(m.labelAlpha >= 0 && m.labelAlpha <= 1);
          if (m.labelAlpha < 0.02) assert.equal(m.label, '', `${label} t = ${t}: a faded copy has no label`);
          else { assert.ok(m.label.endsWith('​'), 'a copy\'s label is tagged'); assert.ok(!tags.has(m.label), 'tags are distinct'); tags.add(m.label); }
          if (m.labelAlpha > 0 && m.labelAlpha < 1) fadesSeen++;
        }
        // a copy's label is full far from every earlier copy, and gone near one
        const cones = scene.cones;
        for (let a = 0; a < cones.length; a++) {
          let d = Infinity;
          for (let b = 0; b < a; b++) if (cones[b].cls === cones[a].cls) d = Math.min(d, Math.hypot(cones[b].p[0] - cones[a].p[0], cones[b].p[1] - cones[a].p[1], cones[b].p[2] - cones[a].p[2]));
          if (d === Infinity) continue;
          const tagged = marks.find((m) => m.label && m.label.endsWith('​'.repeat(a + 1)) && !m.label.endsWith('​'.repeat(a + 2)));
          if (d < LABEL_FADE[0] * size) assert.ok(!tagged, `${label} t = ${t}: copy ${a} is ${d / size} from an earlier one and still labelled`);
          if (d > LABEL_FADE[1] * size) assert.ok(tagged && !(tagged.labelAlpha < 1), `${label} t = ${t}: copy ${a} is ${d / size} away from the others and not labelled in full`);
          // continuity: the opacity follows the distance smoothly
          // (13 Nov 2026: while a tile of xx or 22x is re-cut first, src/folds/recut.js, a piece is carried to its place
          // by an element of the group, about a tile's width in a second — the motion the 22x lab showed. A copy's
          // label then fades in the few frames in which its piece lands next to its partner: continuous, since
          // labelFade is continuous in the distance and the distance in t, but quick. That stage has its own bound.)
          const carried = !!scene.fold.recut && t <= scene.fold.foldFrom + 1e-9;
          const al = labelFade(d / size), was = prev.get(a);
          if (was !== undefined) { if (carried) worstCarried = Math.max(worstCarried, Math.abs(al - was)); else worstStep = Math.max(worstStep, Math.abs(al - was)); }
          prev.set(a, al);
        }
        if (t === 1) assert.equal(marks.map((m) => m.label).sort().join(' '), specialPoints(g.id).join(' '), `${label}: at t = 1 one labelled marker per point`);
      }
    }
  }
  assert.ok(copiesSeen > 1000 && fadesSeen > 100, `${copiesSeen} copies, ${fadesSeen} fading`);
  assert.ok(worstStep < 0.35, `the largest change of a copy's label opacity in 1/200 of t is ${worstStep}`);
  assert.ok(worstCarried < 0.9, `while a piece of a re-cut tile is carried, the largest change of a copy's label opacity in 1/200 of t is ${worstCarried} (it must fade, not pop)`);
});

test('labels: the reviewer\'s cases (29) — once the copies have closed up, one visible label per point of the orbifold, well before t = 1', () => {
  // the hinge pillows: the reviewer saw two labels overprint from t = 0.72 to 0.79 (632 Triangle, 1280 x 800); the
  // cross-cap's corners meet at the end of its zip ("four 2-labels until t = 1", 22x Bowl). The time the copies close
  // up is read off each fold's own motion (the fold modules set their timing): the first t of a 1/200 grid from which
  // every copy stays within LABEL_FADE[0] of an earlier copy of its point up to t = 1.
  const cases = [['632', 'Triangle'], ['22*', 'Pillowcase'], ['4*2', 'Triangle'], ['3*3', 'Triangle'], ['442', 'Triangle'], ['333', 'Rhombus'], ['442', 'Square'], ['22x', 'Bowl']];
  for (const [id, name] of cases) {
    const g = BY_ID[id], p = g.presets.find((q) => q.name === name);
    assert.ok(p, `${id} has a preset ${name}`);
    for (const amp of [0, 1]) {
      const scene = buildScene(g, { seed: p.seed, metric: p.metric, amp, anchor: p.anchor || p.seed });
      const closed = (t) => {
        placeCones(scene, t);
        return scene.cones.every((c, i) => {
          let d = Infinity;
          for (let j = 0; j < i; j++) if (scene.cones[j].cls === c.cls) d = Math.min(d, Math.hypot(scene.cones[j].p[0] - c.p[0], scene.cones[j].p[1] - c.p[1], scene.cones[j].p[2] - c.p[2]));
          return d === Infinity || d < LABEL_FADE[0] * scene.size;
        });
      };
      let from = 1;
      while (from > 0 && closed(Math.round((from - 0.005) * 1000) / 1000)) from = Math.round((from - 0.005) * 1000) / 1000;
      assert.ok(from < 0.99, `${id} ${name} amp ${amp}: the copies close up at t = ${from}, not just at the end`);
      for (let t = from; t <= 1 + 1e-9; t += 0.005) {
        placeCones(scene, t);
        const visible = sceneMarkers(scene, 1).filter((m) => m.label && !(m.labelAlpha < 0.05)).map((m) => m.label.replace(/​/g, ''));
        assert.deepEqual(visible.sort(), specialPoints(id), `${id} ${name} amp ${amp} t = ${t}: visible labels`);
      }
      placeCones(scene, 0);
      assert.equal(sceneMarkers(scene, 1).length, scene.cones.length, `${id} ${name}: at t = 0 every corner keeps its dot`);
    }
  }
});
