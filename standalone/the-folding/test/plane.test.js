// plane.js — the parts that can be checked without a browser: the window mapping, relative dragging, the clamp to the
// window, stable seam colours, matching chevrons, glyph orientation, the tint parity, and that every frame draws.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID, symmetryElements, elementsNear, contains } from '../src/groups.js';
import { inverse, det, apply } from '../src/geom.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { motifFor } from '../src/motif.js';
import { CLASS_COLORS, GROUND, ACCENT, INK, MOTIF_COLOR, MOTIF_ALPHA_PLANE } from '../src/palette.js';
import { createPlaneView, assignEdgeColors, edgeMarks, glyphOrientation, chamberParity, unionBoundary, tileCopies,
  inradius, seamKey, HINT_CUT, HINT_MIRRORS, chevronFit, chevronSize, glyphReach, tintedCopies, isIdentity, followCentre,
  boundsOf, CHEVRON_SHARE, CHEVRON_MIN, FREEZE_SLOP, SMALL_PANE, MOTIF_FILL, planeScale, zoomShare, ZOOM_SHARE, ZOOM_FULL, ZOOM_NONE } from '../src/plane.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * A window with a hand-driven clock and animation frames (the glide of the plane's window needs them):
 * advance(dt) moves the clock; run(ts) runs the frame callbacks waiting now (skipping any cancelled meanwhile).
 */
function fakeWindow({ reduce = false } = {}) {
  let T = 1000, id = 0;
  const queue = new Map();
  const win = {
    devicePixelRatio: 1,
    performance: { now: () => T },
    requestAnimationFrame(cb) { id++; queue.set(id, cb); return id; },
    cancelAnimationFrame(i) { queue.delete(i); },
    matchMedia: (q) => ({ matches: reduce && /reduce/.test(q) }),
  };
  const run = (ts = T) => { const ids = [...queue.keys()]; for (const i of ids) { const cb = queue.get(i); if (!cb) continue; queue.delete(i); cb(ts); } return ids.length; };
  return { win, run, advance(dt) { T += dt; }, frame(dt = 1000 / 60) { T += dt; return run(T); }, now: () => T, pending: () => queue.size };
}

/** A canvas that records what is drawn on it and lets the test fire pointer and key events (`win`: see fakeWindow). */
function fakeCanvas(w, h, win) {
  const calls = [], state = {};
  const ctx = new Proxy({}, {
    get(t, prop) {
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 6.2 });
      if (prop in state) return state[prop];
      return (...args) => { calls.push({ op: prop, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle, lineWidth: state.lineWidth }); };
    },
    set(t, prop, v) { state[prop] = v; return true; },
  });
  const listeners = {};
  const canvas = {
    width: w, height: h, clientWidth: w, clientHeight: h, style: {}, attrs: {}, captured: null,
    ownerDocument: win ? { defaultView: win } : undefined,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    hasAttribute(k) { return k in this.attrs; },
    setPointerCapture(id) { this.captured = id; },
    releasePointerCapture() { this.captured = null; },
    focus() {},
    fire(type, e = {}) { let prevented = false; for (const f of listeners[type] || []) f({ type, preventDefault() { prevented = true; }, ...e }); return prevented; },
    listeners,
  };
  return { canvas, calls };
}

function sceneOf(id, presetIndex = 0, amp = 0, seed) {
  const group = BY_ID[id], p = group.presets[presetIndex];
  const warp = makeWarp(group, amp);
  const domain = buildDomain(group, { seed: seed || p.seed, metric: p.metric, warp });
  return { group, domain, preset: p, warp };
}

/** [minx, miny, maxx, maxy] of the tile's true (warped) outline, computed here from domain.outline. */
function tileBox(domain) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const o of domain.outline(domain.size / 64)) {
    for (let i = 0; i < o.pts.length; i += 2) {
      b[0] = Math.min(b[0], o.pts[i]); b[1] = Math.min(b[1], o.pts[i + 1]); b[2] = Math.max(b[2], o.pts[i]); b[3] = Math.max(b[3], o.pts[i + 1]);
    }
  }
  return b;
}

// The final fix of 10 Nov (the fresh-eyes verifier: on a 148 px phone plane the 2*22 tile was 49 x 19 px, mostly under
// its handle, qa/final-verify-fresh-eyes/p375/B6-2s22-t0.png): a small pane zooms in.
test('window: a small pane zooms in so that a tile takes at least 0.3 of its short side (fading out between 240 and 400 px, continuous); a laptop\'s pane and a kaleidoscope never zoom; every preset tile still fits inside the window', () => {
  assert.equal(zoomShare(ZOOM_FULL), ZOOM_SHARE); assert.equal(zoomShare(100), ZOOM_SHARE); assert.equal(zoomShare(ZOOM_NONE), 0); assert.equal(zoomShare(900), 0);
  for (const g of GROUPS) {
    const size = Math.sqrt(g.domainArea);
    let prev = null;
    for (let m = 120; m <= 700; m += 0.5) {
      const s = planeScale(g, m), plain = m / (2 * g.viewHalf);
      assert.ok(s >= plain - 1e-12, `${g.id} ${m}: never zoomed out`);
      assert.ok(size * s >= zoomShare(m) * m - 1e-9, `${g.id} ${m}: the tile is ${(size * s).toFixed(1)} px`);
      if (m >= ZOOM_NONE) assert.equal(s, plain, `${g.id} ${m}: no zoom`);
      assert.equal(planeScale(g, m, false), plain, `${g.id} ${m}: no zoom without a cut`);
      if (prev !== null) assert.ok(Math.abs(s - prev) < 0.01 * s, `${g.id}: the scale jumps at ${m} px`);
      prev = s;
    }
  }
  // the laptop pane (622 x 580): unchanged; the phone panes: the tile at least 0.3 of the short side
  for (const g of GROUPS) assert.equal(planeScale(g, 580), 290 / g.viewHalf, `${g.id}: the laptop's scale`);
  assert.ok(Math.sqrt(BY_ID['2*22'].domainArea) * planeScale(BY_ID['2*22'], 148) >= 44, '2*22 on a 148 px plane');
  // in the view: a 148 px pane, every preset straight and wavy, the tile inside the window; a kaleidoscope as v1
  for (const g of GROUPS) {
    for (let pi = 0; pi < g.presets.length; pi++) for (const amp of [0, 1]) {
      const { canvas } = fakeCanvas(148, 148);
      const P = createPlaneView(canvas), sc = sceneOf(g.id, pi, amp), snow = g.fold === 'snowflake';
      P.setScene({ group: g, domain: sc.domain, interactive: !snow });
      const b = tileBox(sc.domain), lo = P.toCss(b[0], b[1]), hi = P.toCss(b[2], b[3]), tag = `${g.id} preset ${pi} amp ${amp}`;
      assert.ok(lo[0] >= 0 && hi[0] <= 148 && hi[1] >= 0 && lo[1] <= 148, `${tag}: the tile (${lo.map((v) => v.toFixed(1))} .. ${hi.map((v) => v.toFixed(1))}) is inside the 148 px window`);
      const o = P.toWorld(74, 74), r = P.toCss(o[0] + 1, o[1]);
      assert.ok(Math.abs(r[0] - 74 - planeScale(g, 148, !snow)) < 1e-9, `${tag}: the scale`);
      P.destroy();
    }
  }
});

// Round 3 (findings 11, 23, 38): the window is centred on the current tile, not on group.center (which left the default
// tiles of 333, 632, 3*3 in the lower third, under the phone hint). The scale and orientation are those of v1.
test('window: the short side shows 2 viewHalf (zoomed in on a small pane: planeScale), y is up, centred on the tile (or the snowflake patch); toWorld inverts toCss', () => {
  for (const [w, h] of [[400, 300], [226, 226], [300, 520], [620, 580], [148, 148]]) {
    for (const g of GROUPS) {
      for (let pi = 0; pi < g.presets.length; pi++) {
        for (const amp of [0, 1]) {
          const { canvas } = fakeCanvas(w, h);
          const P = createPlaneView(canvas);
          const sc = sceneOf(g.id, pi, amp);
          P.setScene({ group: g, domain: sc.domain });
          const b = tileBox(sc.domain), tag = `${g.id} preset ${pi} amp ${amp} ${w}x${h}`;
          const c = P.toCss((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
          // (a wavy outline is sampled in steps of a few px, so its box is known to a fraction of a pixel)
          const tol = amp ? 0.5 : 1e-6;
          assert.ok(Math.abs(c[0] - w / 2) < tol && Math.abs(c[1] - h / 2) < tol, `${tag}: the tile is centred (${c.map((v) => v.toFixed(3))})`);
          const s = planeScale(g, Math.min(w, h)), m = Math.min(w, h) / 2, o = P.toWorld(w / 2, h / 2);
          if (Math.min(w, h) >= ZOOM_NONE) assert.equal(s, m / g.viewHalf, `${tag}: a large pane shows 2 viewHalf across its short side`);
          const r = P.toCss(o[0] + 1, o[1] + 1);
          assert.ok(Math.abs(r[0] - (w / 2 + s)) < 1e-9 && Math.abs(r[1] - (h / 2 - s)) < 1e-9, tag + ': y is up, the scale is planeScale');
          const back = P.toWorld(r[0], r[1]);
          assert.ok(Math.abs(back[0] - (o[0] + 1)) < 1e-12 && Math.abs(back[1] - (o[1] + 1)) < 1e-12, tag);
          P.destroy();
        }
      }
    }
  }
  // the kaleidoscopes: the snowflake patch (here: the tiles around the tile's corner of highest order) is centred
  for (const id of ['*2222', '*333', '*442', '*632']) {
    const { canvas } = fakeCanvas(226, 226);
    const P = createPlaneView(canvas);
    const sc = sceneOf(id), d = sc.domain;
    const top = d.conePoints.reduce((a, q) => (q.order > a.order ? q : a));
    const star = elementsNear(sc.group, top.x, top.y, 1e-6, top.x, top.y).map((g) => d.poly.map((p) => apply(g, p[0], p[1])));
    P.setScene({ group: sc.group, domain: d, star, interactive: false });
    const xs = star.flat().map((p) => p[0]), ys = star.flat().map((p) => p[1]);
    const c = P.toCss((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
    assert.ok(Math.abs(c[0] - 113) < 1e-6 && Math.abs(c[1] - 113) < 1e-6, id + ': the patch is centred');
    P.destroy();
  }
});

test('a hidden canvas (no CSS box) keeps its size: resize is a no-op until it shows again', () => {
  const { canvas } = fakeCanvas(300, 200);
  const P = createPlaneView(canvas);
  P.setScene({ group: BY_ID['442'], domain: sceneOf('442').domain });
  const before = [canvas.width, canvas.height, ...P.toCss(0.5, 0.5)];
  const shown = canvas.getBoundingClientRect;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  P.resize(); P.resize(); P.render();
  assert.deepEqual([canvas.width, canvas.height, ...P.toCss(0.5, 0.5)], before);
  assert.equal(canvas.style.width, undefined, 'nothing pinned');
  canvas.getBoundingClientRect = shown;
  P.resize();
  assert.deepEqual([canvas.width, canvas.height, ...P.toCss(0.5, 0.5)], before);
});

test('the canvas is set up for dragging: touch-action none, focusable, labelled; destroy removes every listener', () => {
  const { canvas } = fakeCanvas(300, 300);
  const P = createPlaneView(canvas);
  assert.equal(canvas.style.touchAction, 'none');
  assert.equal(canvas.attrs.tabindex, '0');
  P.setScene({ group: BY_ID['333'], domain: sceneOf('333').domain });
  assert.match(canvas.attrs['aria-label'], /333/);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown']) assert.ok(canvas.listeners[type].length === 1, type);
  P.destroy();
  for (const type of Object.keys(canvas.listeners)) assert.equal(canvas.listeners[type].length, 0, type + ' removed');
});

test('every group, preset and wave amount draws: ground first, enough tile copies to cover the canvas', () => {
  const rand = rng(7);
  for (const [w, h] of [[624, 552], [226, 226]]) {
    for (const g of GROUPS) {
      for (let pi = 0; pi < g.presets.length; pi++) {
        for (const amp of [0, 1]) {
          const { canvas, calls } = fakeCanvas(w, h);
          const P = createPlaneView(canvas);
          const sc = sceneOf(g.id, pi, amp);
          calls.length = 0;
          P.setScene({ group: g, domain: sc.domain, motif: motifFor(g) });
          P.render();
          const tag = `${g.id} preset ${pi} amp ${amp} ${w}x${h}`;
          const first = calls.find((c) => c.op === 'fillRect');
          assert.ok(first && first.fillStyle === GROUND && first.args[2] === w && first.args[3] === h, tag + ' white ground');
          for (const c of calls) for (const a of c.args) if (typeof a === 'number') assert.ok(Number.isFinite(a), `${tag}: ${c.op} got a non-finite number`);
          // tiling: every point of the canvas lies in one of the copies that are drawn
          const D = P.debug();
          const q = [0, 0], y = [0, 0];
          for (let k = 0; k < 40; k++) {
            const pw = P.toWorld(rand() * w, rand() * h);
            let hits = 0;
            for (const e of D.copies) {
              apply(inverse(e), pw[0], pw[1], q);
              sc.warp.inv(q[0], q[1], y);
              if (sc.domain.contains(y[0], y[1], 1e-9)) hits++;
            }
            assert.ok(hits >= 1, `${tag}: canvas point ${pw.map((v) => v.toFixed(3))} is not covered by a drawn tile`);
          }
          P.destroy();
        }
      }
    }
  }
});

test('relative drag: the seed follows the pointer displacement, from wherever the press lands', () => {
  for (const amp of [0, 1]) {
    for (const id of ['333', 'o', '22x', '2222']) {
      const { canvas } = fakeCanvas(500, 400);
      const sc = sceneOf(id, 0, amp);
      const log = [];
      const P = createPlaneView(canvas, { onSeed: (x, y, phase) => log.push([x, y, phase]) });
      P.setScene({ group: sc.group, domain: sc.domain });
      const s = 400 / (2 * sc.group.viewHalf);
      const a0 = sc.domain.seedActual;
      canvas.fire('pointerdown', { pointerId: 5, pointerType: 'touch', clientX: 40, clientY: 350, button: 0 });   // far from the handle
      assert.equal(canvas.captured, 5, 'pointer captured');
      assert.ok(P.isDragging());
      canvas.fire('pointermove', { pointerId: 5, clientX: 52, clientY: 344 });
      canvas.fire('pointermove', { pointerId: 9, clientX: 300, clientY: 10 });        // another finger: ignored
      canvas.fire('pointermove', { pointerId: 5, clientX: 70, clientY: 320 });
      canvas.fire('pointerup', { pointerId: 5, clientX: 70, clientY: 320 });
      assert.ok(!P.isDragging());
      assert.deepEqual(log.map((l) => l[2]), ['start', 'move', 'move', 'end'], id);
      assert.ok(Math.hypot(log[0][0] - sc.domain.seed[0], log[0][1] - sc.domain.seed[1]) < 1e-7, id + ' start reports the seed');
      const last = log[log.length - 1];
      const got = sc.warp.fwd(last[0], last[1]);                                     // seeds are reported in straight coordinates
      assert.ok(Math.abs(got[0] - (a0[0] + 30 / s)) < 1e-7 && Math.abs(got[1] - (a0[1] + 30 / s)) < 1e-7,
        `${id} amp ${amp}: handle moved by ${[(got[0] - a0[0]) * s, (got[1] - a0[1]) * s].map((v) => v.toFixed(3))} px, pointer by 30, -30`);
      P.destroy();
    }
  }
});

test('drag: a tap reports start and end only; the right mouse button does nothing; a cancelled touch ends the drag', () => {
  const { canvas } = fakeCanvas(300, 300);
  const sc = sceneOf('442');
  const log = [];
  const P = createPlaneView(canvas, { onSeed: (x, y, phase) => log.push(phase) });
  P.setScene({ group: sc.group, domain: sc.domain });
  canvas.fire('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 2, clientX: 10, clientY: 10 });
  assert.deepEqual(log, []);
  canvas.fire('pointerdown', { pointerId: 1, pointerType: 'pen', button: 0, clientX: 10, clientY: 10 });
  canvas.fire('pointerup', { pointerId: 1, clientX: 10, clientY: 10 });
  assert.deepEqual(log, ['start', 'end']);
  log.length = 0;
  canvas.fire('pointerdown', { pointerId: 2, pointerType: 'touch', button: 0, clientX: 10, clientY: 10 });
  canvas.fire('pointermove', { pointerId: 2, clientX: 30, clientY: 10 });
  canvas.fire('pointercancel', { pointerId: 2 });
  assert.deepEqual(log, ['start', 'move', 'end']);
  assert.ok(!P.isDragging());
});

test('drag: the seed stays inside the window, and comes back at once when the pointer turns', () => {
  for (const [w, h] of [[226, 226], [624, 400]]) {
    for (const g of GROUPS) {
      const { canvas } = fakeCanvas(w, h);
      const sc = sceneOf(g.id);
      let last = null;
      const P = createPlaneView(canvas, { onSeed: (x, y) => { last = [x, y]; } });
      P.setScene({ group: g, domain: sc.domain });
      canvas.fire('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 });
      canvas.fire('pointermove', { pointerId: 1, clientX: 100 + 5000, clientY: 100 - 3000 });
      const far = P.toCss(last[0], last[1]);
      const m = Math.min(w, h) / 2;
      assert.ok(far[0] <= w / 2 + m - 7 && far[0] >= w / 2 + m - 16 && far[1] >= h / 2 - m + 7 && far[1] <= h / 2 - m + 16,
        `${g.id} ${w}x${h}: stopped at ${far.map((v) => v.toFixed(1))}`);
      canvas.fire('pointermove', { pointerId: 1, clientX: 100 + 5000 - 20, clientY: 100 - 3000 + 20 });
      const back = P.toCss(last[0], last[1]);
      assert.ok(Math.abs(far[0] - back[0] - 20) < 1e-6 && Math.abs(back[1] - far[1] - 20) < 1e-6, g.id + ' no dead zone after hitting the wall');
      canvas.fire('pointerup', { pointerId: 1, clientX: 100 + 5000 - 20, clientY: 100 - 3000 + 20 });
      P.destroy();
    }
  }
});

test('drag across a mirror with a live rebuild: the pointer is never stuck at the clamped seed', () => {
  for (const id of ['**', '*x', '22*', '3*3', '*632']) {
    const { canvas } = fakeCanvas(500, 500);
    let sc = sceneOf(id);
    const g = sc.group;
    const reported = [];
    const P = createPlaneView(canvas, {
      onSeed(x, y, phase) {
        if (phase === 'start') return;
        reported.push([x, y]);
        P.setScene({ group: g, domain: buildDomain(g, { seed: [x, y], metric: sc.preset.metric, warp: sc.warp }) });
      },
    });
    P.setScene({ group: g, domain: sc.domain });
    const s = 500 / (2 * g.viewHalf), start = sc.domain.seed.slice();
    canvas.fire('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, clientX: 250, clientY: 250 });
    for (let k = 1; k <= 120; k++) canvas.fire('pointermove', { pointerId: 1, clientX: 250 + k, clientY: 250 - 0.7 * k });
    canvas.fire('pointerup', { pointerId: 1, clientX: 370, clientY: 250 - 84 });
    const last = reported[reported.length - 1];
    assert.ok(Math.abs(last[0] - (start[0] + 120 / s)) < 1e-9 && Math.abs(last[1] - (start[1] + 84 / s)) < 1e-9, id + ' the raw seed followed the pointer all the way');
    P.destroy();
  }
});

test('keyboard: arrow keys nudge the seed (start, move, end); other keys are left alone', () => {
  const { canvas } = fakeCanvas(400, 400);
  const sc = sceneOf('2222');
  const log = [];
  const P = createPlaneView(canvas, { onSeed: (x, y, phase) => log.push([x, y, phase]) });
  P.setScene({ group: sc.group, domain: sc.domain });
  assert.equal(canvas.fire('keydown', { key: ' ' }), false, 'Space is not taken');
  assert.equal(log.length, 0);
  assert.equal(canvas.fire('keydown', { key: 'ArrowRight' }), true);
  assert.deepEqual(log.map((l) => l[2]), ['start', 'move', 'end']);
  const s = 400 / (2 * sc.group.viewHalf);
  assert.ok(Math.abs(log[1][0] - sc.domain.seed[0] - 7 / s) < 1e-9 && Math.abs(log[1][1] - sc.domain.seed[1]) < 1e-9);
  log.length = 0;
  canvas.fire('keydown', { key: 'ArrowUp', shiftKey: true });
  assert.ok(Math.abs(log[1][1] - sc.domain.seed[1] - 28 / s) < 1e-9);
});

test('hint: one line until the first drag; a different line where nothing can be cut; can be switched off', () => {
  const texts = (calls) => calls.filter((c) => c.op === 'fillText').map((c) => c.args[0]);
  {
    const { canvas, calls } = fakeCanvas(300, 300);
    const sc = sceneOf('333');
    const P = createPlaneView(canvas, {});
    P.setScene({ group: sc.group, domain: sc.domain });
    calls.length = 0; P.render();
    assert.deepEqual(texts(calls), [HINT_CUT]);
    canvas.fire('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, clientX: 10, clientY: 10 });
    calls.length = 0; P.render();
    assert.deepEqual(texts(calls), [HINT_CUT], 'a press alone does not dismiss it');
    canvas.fire('pointermove', { pointerId: 1, clientX: 20, clientY: 10 });
    canvas.fire('pointerup', { pointerId: 1, clientX: 20, clientY: 10 });
    calls.length = 0; P.render();
    assert.deepEqual(texts(calls), []);
  }
  {
    const { canvas, calls } = fakeCanvas(300, 300);
    const sc = sceneOf('*632');
    const P = createPlaneView(canvas);
    P.setScene({ group: sc.group, domain: sc.domain });
    calls.length = 0; P.render();
    assert.deepEqual(texts(calls), [HINT_MIRRORS]);
    P.hideHint(); calls.length = 0; P.render();
    assert.deepEqual(texts(calls), []);
  }
  {
    const { canvas, calls } = fakeCanvas(300, 300);
    const sc = sceneOf('333');
    const P = createPlaneView(canvas, { hint: false });
    P.setScene({ group: sc.group, domain: sc.domain });
    calls.length = 0; P.render();
    assert.deepEqual(texts(calls), []);
  }
});

test('seam colours: fresh = edge.cls; partners share colour and ticks; distinct seams differ', () => {
  for (const g of GROUPS) {
    for (let pi = 0; pi < g.presets.length; pi++) {
      for (const amp of [0, 1]) {
        const d = sceneOf(g.id, pi, amp).domain;
        assert.equal(assignEdgeColors(d, null), d);
        const byColor = new Map();
        d.edges.forEach((e, i) => {
          if (e.kind !== 'cut') { assert.equal(e.color, -1); assert.equal(e.ticks, 0); return; }
          assert.equal(e.color, e.cls % CLASS_COLORS.length, `${g.id}/${pi}: a fresh tile is coloured by class`);
          const p = d.edges[e.partner];
          assert.equal(p.color, e.color); assert.equal(p.ticks, e.ticks); assert.equal(p.seam, e.seam);
          assert.equal(e.seam, seamKey(e.g));
          assert.equal(e.ticks === 0, e.partner === i, `${g.id}/${pi}: chevrons exactly on seams between two different edges`);
          if (e.ticks) assert.ok(e.ticks >= 1 && e.ticks <= 3);
          byColor.set(e.color, e.seam);
        });
        if (d.classes <= CLASS_COLORS.length) assert.equal(byColor.size, d.classes, `${g.id}/${pi}: one colour per seam`);
      }
    }
  }
});

test('seam colours survive dragging: a seam keeps its colour and its chevrons as long as it exists', () => {
  const rand = rng(99);
  let kept = 0, relabelled = 0;
  for (const g of GROUPS) {
    const p0 = g.presets[0], size = Math.sqrt(g.domainArea);
    const warp = makeWarp(g, 0.5);
    let seed = p0.seed.slice();
    let prev = assignEdgeColors(buildDomain(g, { seed, metric: p0.metric, warp }), null);
    let dir = rand() * 6.283;
    for (let k = 0; k < 500; k++) {
      dir += (rand() - 0.5) * 0.9;
      seed = [prev.seed[0] + 0.012 * size * Math.cos(dir), prev.seed[1] + 0.012 * size * Math.sin(dir)];
      const d = buildDomain(g, { seed, metric: p0.metric, warp });
      const clsBefore = new Map();
      for (const e of prev.edges) if (e.kind === 'cut') clsBefore.set(seamKey(e.g), e.cls);
      assignEdgeColors(d, prev);
      const old = new Map();
      for (const e of prev.edges) if (e.kind === 'cut') old.set(e.seam, e);
      const used = new Map();
      for (const e of d.edges) {
        if (e.kind !== 'cut') continue;
        assert.equal(d.edges[e.partner].color, e.color);
        const o = old.get(e.seam);
        if (o) {
          assert.equal(e.color, o.color, `${g.id} step ${k}: a seam changed colour`);
          if (o.ticks && e.ticks) assert.equal(e.ticks, o.ticks, `${g.id} step ${k}: a seam changed its chevrons`);
          kept++;
          if (clsBefore.get(e.seam) !== e.cls) relabelled++;
        }
        if (used.has(e.color)) assert.equal(used.get(e.color), e.seam, `${g.id} step ${k}: two seams share a colour`);
        used.set(e.color, e.seam);
      }
      prev = d;
    }
  }
  assert.ok(kept > 5000);
  assert.ok(relabelled > 50, `the walk does cross renumberings of edge.cls (${relabelled}) — which is why edge.color exists`);
});

test('chevrons: the marks of two sewn edges are images of each other under the gluing, and point canonically', () => {
  const rand = rng(4242);
  let chevrons = 0, folds = 0;
  for (const g of GROUPS) {
    const size = Math.sqrt(g.domainArea);
    for (let pi = 0; pi < g.presets.length; pi++) {
      const p = g.presets[pi];
      for (const amp of [0, 1]) {
        const warp = makeWarp(g, amp);
        for (let k = 0; k < 10; k++) {
          const seed = k === 0 ? p.seed : [p.seed[0] + (rand() - 0.5) * 2 * size, p.seed[1] + (rand() - 0.5) * 2 * size];
          const d = assignEdgeColors(buildDomain(g, { seed, metric: p.metric, warp }), null);
          const marks = edgeMarks(d);
          const byEdge = new Map(marks.map((m) => [m.edge, m]));
          const tol = amp ? 1e-6 * size : 1e-9 * size;
          d.edges.forEach((e, i) => {
            const m = byEdge.get(i);
            if (e.kind !== 'cut') { assert.equal(m, undefined); return; }
            assert.ok(m, `${g.id}: cut edge ${i} has a mark`);
            assert.equal(m.color, e.color);
            const gi = inverse(e.g);
            const q = apply(gi, m.x, m.y);
            if (e.partner === i) {
              folds++;
              assert.equal(m.kind, 'fold');
              assert.ok(Math.hypot(q[0] - m.x, q[1] - m.y) < tol, `${g.id}: the fold mark is the fixed point of the half-turn`);
              return;
            }
            chevrons++;
            const mj = byEdge.get(e.partner);
            assert.equal(m.kind, 'chevron'); assert.equal(mj.kind, 'chevron'); assert.equal(m.count, mj.count);
            assert.ok(Math.abs(Math.hypot(m.dx, m.dy) - 1) < 1e-9);
            assert.ok(Math.hypot(q[0] - mj.x, q[1] - mj.y) < tol, `${g.id} preset ${pi} amp ${amp}: mark of edge ${i} does not land on its partner's`);
            const vx = gi.a * m.dx + gi.b * m.dy, vy = gi.c * m.dx + gi.d * m.dy;
            assert.ok(Math.hypot(vx - mj.dx, vy - mj.dy) < (amp ? 2e-3 : 1e-9), `${g.id} preset ${pi} amp ${amp}: chevron directions do not match (${vx.toFixed(4)}, ${vy.toFixed(4)}) vs (${mj.dx.toFixed(4)}, ${mj.dy.toFixed(4)})`);
            if (amp === 0) {
              const a = d.poly[i], b = d.poly[(i + 1) % d.poly.length];
              const along = (m.dx * (b[0] - a[0]) + m.dy * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
              assert.ok(Math.abs(Math.abs(along) - 1) < 1e-9, 'a chevron points along its edge');
              if (det(e.g) < 0) assert.ok(along > 0, `${g.id}: glide seams point counter-clockwise on both edges`);
            }
          });
        }
      }
    }
  }
  assert.ok(chevrons > 1000 && folds > 200);
});

test('rotation glyphs: the field of glyphs is invariant under the group, and symmetric in every mirror through a centre', () => {
  for (const g of GROUPS) {
    const sym = symmetryElements(g, g.center[0], g.center[1], 1.6);
    if (!sym.centers.length) continue;
    const ang = glyphOrientation(g);
    const els = elementsNear(g, g.center[0], g.center[1], 1.2);
    const mod = (a, per) => { let d = a % per; if (d < 0) d += per; return Math.min(d, per - d); };
    for (const c of sym.centers.slice(0, 24)) {
      const a = ang(c.x, c.y, c.order), per = (2 * Math.PI) / c.order;
      assert.ok(Number.isFinite(a));
      for (const e of els) {
        const x = e.a * c.x + e.b * c.y + e.tx, y = e.c * c.x + e.d * c.y + e.ty;
        const vx = e.a * Math.cos(a) + e.b * Math.sin(a), vy = e.c * Math.cos(a) + e.d * Math.sin(a);
        assert.ok(mod(Math.atan2(vy, vx) - ang(x, y, c.order), per) < 1e-6, `${g.id}: glyph of order ${c.order} at (${c.x.toFixed(3)}, ${c.y.toFixed(3)}) is not carried to its image`);
      }
      for (const m of sym.mirrors) {
        if (Math.abs((c.x - m.px) * -m.uy + (c.y - m.py) * m.ux) > 1e-6) continue;
        const th = Math.atan2(m.uy, m.ux);
        assert.ok(mod(2 * th - a - a, per) < 1e-6, `${g.id}: glyph at a mirror is not symmetric in it`);
      }
    }
  }
});

test('tint: crossing a mirror flips the parity, so the same tiles of the plane stay tinted', () => {
  const rand = rng(31);
  for (const g of GROUPS) {
    const sym = symmetryElements(g, g.center[0], g.center[1], 2.5 * g.viewHalf);
    const base = motifFor(g).at;
    if (!sym.mirrors.length) { assert.equal(chamberParity(sym.mirrors, 0.3, 0.2, base[0], base[1]), 1); continue; }
    const p0 = g.presets[0], warp = makeWarp(g, 0);
    for (let k = 0; k < 6; k++) {
      const d1 = buildDomain(g, { seed: [g.center[0] + (rand() - 0.5) * g.viewHalf, g.center[1] + (rand() - 0.5) * g.viewHalf], metric: p0.metric, warp });
      // the mirror image of the seed in the nearest mirror: the tile the handle jumps to when it is dragged across
      const dist = (mm) => (d1.seed[0] - mm.px) * -mm.uy + (d1.seed[1] - mm.py) * mm.ux;
      const m = sym.mirrors.reduce((a, b) => (Math.abs(dist(b)) < Math.abs(dist(a)) ? b : a));
      const s = dist(m);
      const seed2 = [d1.seed[0] + 2 * s * m.uy, d1.seed[1] - 2 * s * m.ux];
      const d2 = buildDomain(g, { seed: seed2, metric: p0.metric, warp });
      const e1 = chamberParity(sym.mirrors, d1.seed[0], d1.seed[1], base[0], base[1]);
      const e2 = chamberParity(sym.mirrors, d2.seed[0], d2.seed[1], base[0], base[1]);
      assert.equal(e1, -e2, g.id + ' one mirror between the two seeds');
      // a point of the plane is tinted or not, whichever of the two tiles is current
      for (let j = 0; j < 12; j++) {
        const x = g.center[0] + (rand() - 0.5) * g.viewHalf, y = g.center[1] + (rand() - 0.5) * g.viewHalf;
        const tinted = (d, eps) => {
          for (const e of elementsNear(g, x, y, 3 * Math.sqrt(g.domainArea), d.seed[0], d.seed[1])) {
            const q = apply(inverse(e), x, y);
            if (d.contains(q[0], q[1], -1e-7)) return det(e) * eps < 0;
          }
          return null;                           // on an edge
        };
        const t1 = tinted(d1, e1), t2 = tinted(d2, e2);
        if (t1 !== null && t2 !== null) assert.equal(t1, t2, `${g.id}: the tint of (${x.toFixed(3)}, ${y.toFixed(3)}) flipped when the seed crossed a mirror`);
      }
    }
  }
});

test('small helpers: inradius, unionBoundary, tileCopies', () => {
  const rect = [{ nx: 1, ny: 0, c: 2 }, { nx: -1, ny: 0, c: 0 }, { nx: 0, ny: 1, c: 0.5 }, { nx: 0, ny: -1, c: 0 }];
  assert.ok(Math.abs(inradius(rect) - 0.25) < 1e-12);
  for (const id of ['*632', '*333', '*442', '*2222']) {
    const d = sceneOf(id).domain;
    let per = 0;
    for (const e of d.edges) per += e.len;
    assert.ok(Math.abs(inradius(d.edges) - Math.min((2 * d.area) / per, 9)) < 1e-9 || id === '*2222', id + ' triangle: r = 2A/P');
  }
  assert.ok(Math.abs(inradius(sceneOf('*2222').domain.edges) - 0.25) < 1e-9);
  const sq = (x, y) => [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
  assert.equal(unionBoundary([sq(0, 0), sq(1, 0), sq(0, 1), sq(1, 1)]).length, 8);
  const sc = sceneOf('333');
  const copies = tileCopies(sc.group, sc.domain.seedActual, 0.6, 0.5, 0.5, 0.01, 0.01);
  assert.ok(copies.length >= 1 && copies.every((e) => contains(sc.group, e)));
});

test('the scene can be replaced and cleared; an already coloured domain is left alone', () => {
  const { canvas, calls } = fakeCanvas(300, 300);
  const P = createPlaneView(canvas);
  P.render();
  const a = sceneOf('333'), b = sceneOf('333', 2);
  P.setScene({ group: a.group, domain: a.domain });
  P.render();
  const colors = a.domain.edges.map((e) => e.color);
  P.setScene({ group: a.group, domain: a.domain, star: [[[0, 0], [1, 0], [0, 1]], Float32Array.from([1, 0, 1, 1, 0, 1])] });
  P.render();
  assert.deepEqual(a.domain.edges.map((e) => e.color), colors);
  P.setScene({ group: b.group, domain: b.domain });
  P.render();
  assert.ok(b.domain.edges.every((e) => e.color !== undefined));
  const o = sceneOf('o', 1);
  P.setScene({ group: o.group, domain: o.domain });
  P.render();
  calls.length = 0;
  P.setScene(null);
  P.render();
  assert.equal(calls.filter((c) => c.op === 'fillRect').length, 1);
  assert.equal(calls.filter((c) => c.op === 'stroke').length, 0);
});

// ---------------------------------------------------------------------------------------------------------------
// Round 3 (qa/round3-triage.md § plane): the window follows the tile (11, 20, 23, 38), contract C2 (30, 36), the ring
// handle (21), chevrons that scale (22), the tint of the current tile (40), quieter lines (41), a second finger (42).
// ---------------------------------------------------------------------------------------------------------------

const textsOf = (calls) => calls.filter((c) => c.op === 'fillText').map((c) => c.args[0]);
const down = (canvas, id, x, y, more = {}) => canvas.fire('pointerdown', { pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, ...more });
const move = (canvas, id, x, y) => canvas.fire('pointermove', { pointerId: id, clientX: x, clientY: y });
const up = (canvas, id, x, y) => canvas.fire('pointerup', { pointerId: id, clientX: x, clientY: y });

test('C2: interactive false — no handle, no drags, no keys, no hint, default cursor, an image out of the tab order; and back', () => {
  const { canvas, calls } = fakeCanvas(300, 300);
  const log = [];
  const P = createPlaneView(canvas, { onSeed: (x, y, phase) => log.push(phase) });
  const k = sceneOf('*632');
  P.setScene({ group: k.group, domain: k.domain, interactive: false });
  calls.length = 0; P.render();
  assert.equal(calls.filter((c) => c.op === 'stroke' && c.strokeStyle === ACCENT).length, 0, 'no handle');
  assert.deepEqual(textsOf(calls), [], 'no hint');
  assert.equal(canvas.style.cursor, 'default');
  assert.equal(canvas.attrs.role, 'img'); assert.equal(canvas.attrs.tabindex, '-1');
  assert.doesNotMatch(canvas.attrs['aria-label'], /[Dd]rag|arrow/);
  assert.match(canvas.attrs['aria-label'], /∗632|\*632/);
  down(canvas, 1, 100, 100, { isPrimary: true }); move(canvas, 1, 140, 120); up(canvas, 1, 140, 120);
  assert.equal(canvas.fire('keydown', { key: 'ArrowRight' }), false, 'the arrow keys are left to the page');
  assert.deepEqual(log, []); assert.ok(!P.isDragging());
  assert.equal(P.debug().interactive, false);

  // the same view, another group, interactive again (the default)
  const c = sceneOf('333');
  P.setScene({ group: c.group, domain: c.domain });
  calls.length = 0; P.render();
  assert.equal(calls.filter((cl) => cl.op === 'stroke' && cl.strokeStyle === ACCENT).length, 1, 'the handle ring');
  assert.equal(canvas.style.cursor, 'grab'); assert.equal(canvas.attrs.role, 'application'); assert.equal(canvas.attrs.tabindex, '0');
  assert.match(canvas.attrs['aria-label'], /arrow keys/);
  down(canvas, 2, 100, 100, { isPrimary: true }); move(canvas, 2, 120, 100); up(canvas, 2, 120, 100);
  assert.deepEqual(log, ['start', 'move', 'end']);

  // a drag cut short by a scene that is not interactive ends there: one 'end' at the new tile's seed, nothing after
  P.destroy();
  log.length = 0;
  const ends = [];
  const P2 = createPlaneView(canvas, { onSeed: (x, y, phase) => { log.push(phase); if (phase === 'end') ends.push([x, y]); } });
  P2.setScene({ group: c.group, domain: c.domain });
  down(canvas, 3, 100, 100, { isPrimary: true }); move(canvas, 3, 130, 100);
  P2.setScene({ group: k.group, domain: k.domain, interactive: false });
  assert.ok(!P2.isDragging());
  move(canvas, 3, 160, 100); up(canvas, 3, 160, 100);
  assert.deepEqual(log.filter((p) => p !== 'start' && p !== 'move').length, 1, 'the drag ended once');
  assert.deepEqual(ends[0], k.domain.seed);
  P2.destroy();
});

test('window: a cut chosen from outside is centred; the same cut made wavy leaves the window alone', () => {
  for (const g of GROUPS) {
    const { canvas } = fakeCanvas(226, 226);
    const P = createPlaneView(canvas);
    const a = sceneOf(g.id, 0);
    P.setScene({ group: g, domain: a.domain });
    const v0 = P.getView();
    assert.deepEqual(v0.home, [v0.cx, v0.cy], g.id + ': home is the centre the cut was shown at');
    const aw = sceneOf(g.id, 0, 1);
    P.setScene({ group: g, domain: aw.domain });
    const v1 = P.getView();
    assert.ok(v1.cx === v0.cx && v1.cy === v0.cy, g.id + ': Wavy moved the window');
    for (let pi = 1; pi < g.presets.length; pi++) {
      const b = sceneOf(g.id, pi);
      P.setScene({ group: g, domain: b.domain });
      const bb = tileBox(b.domain), c = P.toCss((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2);
      assert.ok(Math.abs(c[0] - 113) < 1e-6 && Math.abs(c[1] - 113) < 1e-6, `${g.id} preset ${pi}: centred on its tile`);
      const v = P.getView();
      assert.deepEqual(v.home, [v.cx, v.cy], `${g.id} preset ${pi}: the seed's leash moved with it`);
    }
    P.destroy();
  }
});

test('drag with a live rebuild: the window follows the tile, which stays in its inner part; the seed stays on its leash', () => {
  for (const [w, h] of [[226, 226], [622, 550]]) {
    for (const g of GROUPS) {
      for (const [dx, dy] of [[1, -1], [-1, 1], [1, 0], [0, 1]]) {
        const { canvas } = fakeCanvas(w, h);
        const sc = sceneOf(g.id);
        const seeds = [];
        const P = createPlaneView(canvas, {
          onSeed(x, y, phase) {
            if (phase !== 'move') return;
            seeds.push([x, y]);
            P.setScene({ group: g, domain: buildDomain(g, { seed: [x, y], metric: sc.preset.metric, warp: sc.warp }) });
          },
        });
        P.setScene({ group: g, domain: sc.domain });
        const v0 = P.getView(), half = P.debug().clampHalf;
        let prev = v0, moved = 0;
        down(canvas, 1, w / 2, h / 2, { isPrimary: true });
        for (let k = 1; k <= 40; k++) {
          move(canvas, 1, w / 2 + 15 * k * dx, h / 2 + 15 * k * dy);
          const D = P.debug(), lo = P.toCss(D.box[0], D.box[3]), hi = P.toCss(D.box[2], D.box[1]), m = D.inset - 1e-6;
          const tag = `${g.id} ${w}x${h} toward (${dx}, ${dy}) step ${k}`;
          const fitsX = hi[0] - lo[0] <= w - 2 * D.inset, fitsY = hi[1] - lo[1] <= h - 2 * D.inset;
          assert.ok(fitsX && fitsY, tag + ': the tile is wider than the inner part of the window');
          assert.ok(lo[0] >= m && lo[1] >= m && hi[0] <= w - m && hi[1] <= h - m,
            `${tag}: the tile's box ${[...lo, ...hi].map((v) => v.toFixed(1))} leaves the inner part (inset ${D.inset.toFixed(1)})`);
          // only as far as needed: a window that moved holds the tile against the inner part's edge on that side
          const v = P.getView();
          if (v.cx !== prev.cx) { moved++; assert.ok(Math.abs(v.cx > prev.cx ? hi[0] - (w - D.inset) : lo[0] - D.inset) < 1e-6, tag + ': moved further than needed (x)'); }
          if (v.cy !== prev.cy) { moved++; assert.ok(Math.abs(v.cy > prev.cy ? lo[1] - D.inset : hi[1] - (h - D.inset)) < 1e-6, tag + ': moved further than needed (y)'); }
          prev = v;
        }
        assert.ok(moved > 0, `${g.id}: a drag to the end of the leash moved the window`);
        up(canvas, 1, w / 2 + 600 * dx, h / 2 + 600 * dy);
        for (const s of seeds) {
          assert.ok(Math.abs(s[0] - v0.home[0]) <= half + 1e-9 && Math.abs(s[1] - v0.home[1]) <= half + 1e-9, `${g.id}: the seed left its leash`);
        }
        const last = seeds[seeds.length - 1];
        if (dx) assert.ok(Math.abs(Math.abs(last[0] - v0.home[0]) - half) < 1e-9, `${g.id}: the seed went to the end of its leash`);
        P.destroy();
      }
    }
  }
});

test('after the window followed a drag to the end of the leash the pattern still fills it: copies, lines, centres', () => {
  const rand = rng(77);
  let lines = 0, centres = 0;
  for (const [w, h] of [[226, 226], [622, 550]]) {
    for (const g of GROUPS) {
      for (const [dx, dy] of [[1, -1], [-1, 1]]) {
        const { canvas, calls } = fakeCanvas(w, h);
        const sc = sceneOf(g.id);
        let dom = sc.domain;
        const P = createPlaneView(canvas, {
          hint: false,
          onSeed(x, y, phase) { if (phase === 'move') { dom = buildDomain(g, { seed: [x, y], metric: sc.preset.metric, warp: sc.warp }); P.setScene({ group: g, domain: dom }); } },
        });
        P.setScene({ group: g, domain: dom });
        const v0 = P.getView();
        down(canvas, 1, w / 2, h / 2, { isPrimary: true });
        for (let k = 1; k <= 40; k++) move(canvas, 1, w / 2 + 15 * k * dx, h / 2 + 15 * k * dy);
        up(canvas, 1, w / 2 + 600 * dx, h / 2 + 600 * dy);
        const v = P.getView(), tag = `${g.id} ${w}x${h} toward (${dx}, ${dy})`;
        assert.ok(Math.hypot(v.cx - v0.cx, v.cy - v0.cy) * v.s > 5, tag + ': the window did follow');
        calls.length = 0; P.render();
        const D = P.debug(), q = [0, 0], y = [0, 0];
        for (let k = 0; k < 30; k++) {                    // tile copies cover the canvas
          const pw = P.toWorld(rand() * w, rand() * h);
          let hits = 0;
          for (const e of D.copies) { apply(inverse(e), pw[0], pw[1], q); sc.warp.inv(q[0], q[1], y); if (dom.contains(y[0], y[1], 1e-9)) hits++; }
          assert.ok(hits >= 1, `${tag}: a canvas point is not covered by a drawn tile`);
        }
        // every mirror and glide line crossing the canvas is drawn across all of it; every centre in it has a glyph
        const c0 = P.toWorld(w / 2, h / 2), R = Math.hypot(w, h) / (2 * v.s);
        const sym = symmetryElements(g, c0[0], c0[1], R);
        const segs = [];
        let cur = null;
        for (const cl of calls) {
          if (cl.op === 'moveTo') cur = [cl.args[0], cl.args[1]];
          else if (cl.op === 'lineTo' && cur) { segs.push([cur[0], cur[1], cl.args[0], cl.args[1]]); cur = [cl.args[0], cl.args[1]]; }
        }
        const drawnLine = (m) => {
          const P0 = P.toCss(m.px, m.py), ux = m.ux, uy = -m.uy;
          return segs.some(([ax, ay, bx, by]) => {
            const L = Math.hypot(bx - ax, by - ay);
            if (L < Math.hypot(w, h)) return false;
            const off = Math.abs((bx - ax) * (P0[1] - ay) - (by - ay) * (P0[0] - ax)) / L;
            const par = Math.abs((bx - ax) * uy - (by - ay) * ux) / L;
            if (off > 0.01 || par > 1e-6) return false;
            // the segment reaches past the canvas on both sides
            const t = (x, yy) => ((x - ax) * (bx - ax) + (yy - ay) * (by - ay)) / L;
            const ts = [[0, 0], [w, 0], [0, h], [w, h]].map(([x, yy]) => t(x, yy));
            return Math.min(...ts) >= 0 && Math.max(...ts) <= L;
          });
        };
        for (const m of [...sym.mirrors, ...sym.glides]) {
          // only lines that cross the canvas
          const P0 = P.toCss(m.px, m.py), ux = m.ux, uy = -m.uy;
          const sides = [[0, 0], [w, 0], [0, h], [w, h]].map(([x, yy]) => Math.sign((x - P0[0]) * uy - (yy - P0[1]) * ux));
          if (Math.min(...sides) === Math.max(...sides)) continue;
          lines++;
          assert.ok(drawnLine(m), `${tag}: a ${sym.mirrors.includes(m) ? 'mirror' : 'glide axis'} across the canvas is not drawn`);
        }
        // a glyph's centre: the mean of its vertices (the copy of the first one that closes the path left out)
        const centreOfSub = (s) => {
          const pts = s.slice();
          while (pts.length > 1 && Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]) < 1e-9) pts.pop();
          return [pts.reduce((a, pt) => a + pt[0], 0) / pts.length, pts.reduce((a, pt) => a + pt[1], 0) / pts.length];
        };
        const glyphs = paintedPaths(calls).filter((p) => p.op === 'fill' && p.fillStyle === INK)
          .flatMap((p) => p.subs.filter((s) => Array.isArray(s)).map(centreOfSub));
        for (const cn of sym.centers) {
          const p = P.toCss(cn.x, cn.y);
          if (p[0] < 1 || p[1] < 1 || p[0] > w - 1 || p[1] > h - 1) continue;
          centres++;
          assert.ok(glyphs.some((gp) => Math.hypot(gp[0] - p[0], gp[1] - p[1]) < 1.5), `${tag}: the centre at ${p.map((x) => x.toFixed(1))} has no glyph`);
        }
        P.destroy();
      }
    }
  }
  assert.ok(lines > 200 && centres > 500, `${lines} lines, ${centres} centres checked`);
});

test('keys with a live rebuild follow like a drag: the window is not re-centred on every nudge', () => {
  for (const id of ['333', '2222', 'o', '632']) {
    const { canvas } = fakeCanvas(400, 400);
    const sc = sceneOf(id), g = sc.group;
    const P = createPlaneView(canvas, {
      onSeed(x, y, phase) { if (phase === 'move') P.setScene({ group: g, domain: buildDomain(g, { seed: [x, y], metric: sc.preset.metric, warp: sc.warp }) }); },
    });
    P.setScene({ group: g, domain: sc.domain });
    const v0 = P.getView();
    for (let i = 0; i < 3; i++) canvas.fire('keydown', { key: 'ArrowRight' });
    const v1 = P.getView();
    assert.ok(v1.cx === v0.cx && v1.cy === v0.cy, id + ': a nudge of 21 px moved the window');
    assert.deepEqual(v1.home, v0.home);
    P.destroy();
  }
});

test('the window glides: smooth, no overshoot, exact at rest, one picture per frame, the drag unaffected; reduced motion jumps', () => {
  const fw = fakeWindow();
  const { canvas, calls } = fakeCanvas(390, 390, fw.win);
  const g = BY_ID['333'];
  const reported = [];
  const P = createPlaneView(canvas, { onSeed: (x, y, phase) => { if (phase === 'move') reported.push([x, y]); } });
  P.setScene({ group: g, domain: sceneOf('333', 0).domain });
  fw.frame();
  const start = P.getView();
  assert.ok(!start.gliding, 'a new group is shown at once');
  P.setScene({ group: g, domain: sceneOf('333', 2).domain });       // a preset: glide to its tile
  const target = P.getView().target;
  assert.ok(P.getView().gliding);
  assert.deepEqual([P.getView().cx, P.getView().cy], [start.cx, start.cy], 'nothing moves before the next frame');
  const dist0 = Math.hypot(start.cx - target[0], start.cy - target[1]) * start.s;
  assert.ok(dist0 > 10, `the preset is ${dist0.toFixed(1)} px away`);
  const u = [(target[0] - start.cx) / dist0, (target[1] - start.cy) / dist0];
  let prev = [start.cx, start.cy], frames = 0, maxStep = 0, prevAlong = 0;
  while (P.getView().gliding && frames < 120) {
    calls.length = 0;
    fw.frame();
    frames++;
    const v = P.getView();
    const step = Math.hypot(v.cx - prev[0], v.cy - prev[1]) * v.s, along = ((v.cx - start.cx) * u[0] + (v.cy - start.cy) * u[1]) * v.s;
    maxStep = Math.max(maxStep, step);
    assert.ok(along >= prevAlong - 1e-9 && along <= dist0 + 1e-9, `frame ${frames}: the glide went back or past its target (${along.toFixed(3)} of ${dist0.toFixed(3)} px)`);
    assert.ok(Math.abs(((v.cx - start.cx) * -u[1] + (v.cy - start.cy) * u[0]) * v.s) < 1e-6, 'it moves on the straight line to its target');
    assert.equal(calls.filter((c) => c.op === 'fillRect').length, 1, 'one picture per frame');
    const c = P.toCss(v.cx, v.cy);
    assert.ok(Math.abs(c[0] - 195) < 1e-9 && Math.abs(c[1] - 195) < 1e-9, 'toCss describes the frame on screen');
    prev = [v.cx, v.cy]; prevAlong = along;
  }
  assert.ok(frames >= 8 && frames <= 45, `it rests after ${frames} frames`);
  assert.deepEqual([P.getView().cx, P.getView().cy], target, 'exactly at its target');
  assert.ok(maxStep < 0.2 * dist0, `no frame jumps: largest step ${maxStep.toFixed(2)} of ${dist0.toFixed(2)} px`);
  assert.equal(fw.pending(), 0, 'at rest nothing is drawn any more');

  // the owner draws in a frame (render after its own setScene): the plane's frame callback does not draw it again
  P.setScene({ group: g, domain: sceneOf('333', 0).domain });
  fw.advance(16); calls.length = 0;
  P.render();
  fw.run(fw.now());
  assert.equal(calls.filter((c) => c.op === 'fillRect').length, 1, 'one picture in a frame the owner drew');
  for (let i = 0; i < 60 && P.getView().gliding; i++) fw.frame();

  // during a glide a drag still moves the seed by exactly the pointer's displacement
  P.setScene({ group: g, domain: sceneOf('333', 1).domain });
  const s = P.getView().s, seed0 = sceneOf('333', 1).domain.seedActual;
  down(canvas, 4, 50, 50, { isPrimary: true });
  for (let i = 1; i <= 6; i++) { move(canvas, 4, 50 + 5 * i, 50 - 5 * i); fw.frame(); }
  up(canvas, 4, 80, 20); fw.frame();
  const last = reported[reported.length - 1];
  assert.ok(Math.abs(last[0] - (seed0[0] + 30 / s)) < 1e-9 && Math.abs(last[1] - (seed0[1] + 30 / s)) < 1e-9, 'the glide added to the drag');
  P.destroy();

  // prefers-reduced-motion: the window jumps
  const fr = fakeWindow({ reduce: true });
  const f2 = fakeCanvas(390, 390, fr.win);
  const Q = createPlaneView(f2.canvas);
  Q.setScene({ group: g, domain: sceneOf('333', 0).domain });
  Q.setScene({ group: g, domain: sceneOf('333', 2).domain });
  const q = Q.getView();
  assert.ok(!q.gliding && q.cx === q.target[0] && q.cy === q.target[1]);
  Q.destroy();
});

test('a second finger freezes the drag until every finger is up (finding 42)', () => {
  const sc = sceneOf('333');
  const setup = () => {
    const { canvas } = fakeCanvas(400, 400);
    const log = [];
    const P = createPlaneView(canvas, { onSeed: (x, y, phase) => log.push([x, y, phase]) });
    P.setScene({ group: sc.group, domain: sc.domain });
    return { canvas, log, P, s: 400 / (2 * sc.group.viewHalf) };
  };
  const seed = sc.domain.seed;
  {
    // a pinch: the second finger lands before the first has moved FREEZE_SLOP px; the cut goes back and stays
    const { canvas, log, P } = setup();
    down(canvas, 1, 200, 200, { isPrimary: true }); move(canvas, 1, 204, 200);
    down(canvas, 2, 260, 200, { isPrimary: false });
    assert.ok(P.isDragging());
    for (let i = 1; i <= 10; i++) { move(canvas, 1, 204 - 4 * i, 200); move(canvas, 2, 260 + 4 * i, 200); }
    up(canvas, 2, 300, 200); move(canvas, 1, 100, 100);
    up(canvas, 1, 100, 100);
    assert.deepEqual(log.map((l) => l[2]), ['start', 'move', 'move', 'end']);
    for (const i of [2, 3]) assert.ok(Math.hypot(log[i][0] - seed[0], log[i][1] - seed[1]) < 1e-9, 'back where the drag began');
    assert.ok(!P.isDragging());
    // and the next finger drags again
    log.length = 0;
    down(canvas, 3, 200, 200, { isPrimary: true }); move(canvas, 3, 230, 200); up(canvas, 3, 230, 200);
    assert.deepEqual(log.map((l) => l[2]), ['start', 'move', 'end']);
    P.destroy();
  }
  {
    // a real drag, then a palm: the cut stays where the drag had taken it
    const { canvas, log, P, s } = setup();
    down(canvas, 1, 200, 200, { isPrimary: true }); move(canvas, 1, 240, 200);
    down(canvas, 2, 300, 300);
    move(canvas, 1, 300, 250); up(canvas, 1, 300, 250);
    const ph = log.map((l) => l[2]);
    assert.deepEqual(ph, ['start', 'move', 'end']);
    assert.ok(Math.abs(log[2][0] - (seed[0] + 40 / s)) < 1e-9 && Math.abs(log[2][1] - seed[1]) < 1e-9, 'frozen where it was');
    // the second finger is still down: nothing starts until it is up
    log.length = 0;
    down(canvas, 4, 200, 200); move(canvas, 4, 230, 200); up(canvas, 4, 230, 200);
    move(canvas, 2, 320, 300);
    assert.deepEqual(log, [], 'blocked while a finger of the gesture is down');
    up(canvas, 2, 320, 300);
    down(canvas, 5, 200, 200); move(canvas, 5, 220, 200); up(canvas, 5, 220, 200);
    assert.deepEqual(log.map((l) => l[2]), ['start', 'move', 'end']);
    P.destroy();
  }
  {
    // the second finger's 'up' went elsewhere: the next gesture's first finger (isPrimary) starts afresh
    const { canvas, log, P } = setup();
    down(canvas, 1, 200, 200, { isPrimary: true }); down(canvas, 2, 260, 200); up(canvas, 1, 200, 200);
    log.length = 0;
    down(canvas, 6, 200, 200, { isPrimary: true }); move(canvas, 6, 230, 200); up(canvas, 6, 230, 200);
    assert.deepEqual(log.map((l) => l[2]), ['start', 'move', 'end']);
    P.destroy();
  }
  {
    // a press that started no drag (the scene took none) and was released elsewhere leaves nothing behind: a later
    // press, even a synthetic one without isPrimary, drags
    const { canvas, log, P } = setup();
    P.setScene({ group: sc.group, domain: sc.domain, interactive: false });
    down(canvas, 8, 200, 200);
    P.setScene({ group: sc.group, domain: sc.domain });
    down(canvas, 9, 200, 200); move(canvas, 9, 230, 200); up(canvas, 9, 230, 200);
    assert.deepEqual(log.map((l) => l[2]), ['start', 'move', 'end']);
    P.destroy();
  }
  assert.ok(FREEZE_SLOP >= 6 && FREEZE_SLOP <= 16);
});

/** Replays the canvas calls into the paths that were filled or stroked: [{ op, fillStyle, strokeStyle, lineWidth, subs }]. */
function paintedPaths(calls) {
  const out = [];
  let subs = [], cur = null;
  for (const c of calls) {
    const a = c.args;
    if (c.op === 'beginPath') { subs = []; cur = null; }
    else if (c.op === 'moveTo') { cur = [[a[0], a[1]]]; subs.push(cur); }
    else if (c.op === 'lineTo') { if (!cur) { cur = []; subs.push(cur); } cur.push([a[0], a[1]]); }
    else if (c.op === 'quadraticCurveTo') {
      const p0 = cur[cur.length - 1];
      for (let k = 1; k <= 8; k++) { const t = k / 8, s = 1 - t; cur.push([s * s * p0[0] + 2 * s * t * a[0] + t * t * a[2], s * s * p0[1] + 2 * s * t * a[1] + t * t * a[3]]); }
    } else if (c.op === 'arc') { cur = { arc: [a[0], a[1], a[2]] }; subs.push(cur); cur = null; }
    else if (c.op === 'closePath') { if (cur && cur.length) cur.push(cur[0].slice()); }
    else if (c.op === 'fill' || c.op === 'stroke') out.push({ op: c.op, fillStyle: c.fillStyle, strokeStyle: c.strokeStyle, lineWidth: c.lineWidth, subs: subs.slice() });
  }
  return out;
}
function segDist(p, q, a, b) {   // distance between the segments pq and ab
  const d = (x, s, t) => {
    const vx = t[0] - s[0], vy = t[1] - s[1], l = vx * vx + vy * vy;
    const u = l ? Math.max(0, Math.min(1, ((x[0] - s[0]) * vx + (x[1] - s[1]) * vy) / l)) : 0;
    return Math.hypot(x[0] - s[0] - u * vx, x[1] - s[1] - u * vy);
  };
  const cross = (o, s, t) => (s[0] - o[0]) * (t[1] - o[1]) - (s[1] - o[1]) * (t[0] - o[0]);
  if (cross(p, q, a) * cross(p, q, b) < 0 && cross(a, b, p) * cross(a, b, q) < 0) return 0;
  return Math.min(d(p, a, b), d(q, a, b), d(a, p, q), d(b, p, q));
}

test('chevrons: the count of every seam, at most 40 % of the edge, 3 px clear of the vertex glyphs, matching across the seam', () => {
  let clusters = 0, slid = 0, closest = Infinity;
  for (const [w, minEdge] of [[622, 0], [226, 0], [178, 20]]) {
    for (const g of GROUPS) {
      for (let pi = 0; pi < g.presets.length; pi++) {
        for (const amp of [0, 1]) {
          const { canvas, calls } = fakeCanvas(w, w);
          const P = createPlaneView(canvas, { hint: false });
          const sc = sceneOf(g.id, pi, amp), d = sc.domain;
          P.setScene({ group: g, domain: d });
          calls.length = 0; P.render();
          const D = P.debug(), tag = `${g.id} preset ${pi} amp ${amp} ${w}px`;
          const paths = paintedPaths(calls);
          // the glyphs (ink fills) and the drawn chevron clusters (strokes in a seam colour, thinner than the tile's
          // bold edges, made of 3-point polylines)
          const glyphs = paths.filter((p) => p.op === 'fill' && p.fillStyle === INK).flatMap((p) => p.subs.filter((s) => Array.isArray(s)));
          const drawn = paths.filter((p) => p.op === 'stroke' && CLASS_COLORS.includes(p.strokeStyle) && p.lineWidth < D.metrics.edge - 0.1 &&
            p.subs.length && p.subs.every((s) => Array.isArray(s) && s.length === 3));
          const fitted = D.chevrons.filter((ch) => ch.fit);
          assert.equal(drawn.length, fitted.length, tag + ': one stroke per fitted cluster');
          for (const ch of D.chevrons) {
            const e = d.edges[ch.edge];
            assert.equal(ch.mark.count, e.ticks, tag + ': the mark carries the seam\'s count');
            if (!ch.fit) { assert.ok(ch.edgePx < minEdge, `${tag}: the chevrons of a ${ch.edgePx.toFixed(1)} px edge were left out`); continue; }
            clusters++;
            const f = ch.fit;
            assert.equal(f.count, e.ticks, tag + ': never fewer chevrons than the seam has');
            assert.ok(f.f >= CHEVRON_MIN - 1e-12 && f.f <= 1);
            assert.ok(f.span <= CHEVRON_SHARE * ch.edgePx + 1e-9, `${tag}: a cluster of ${f.span.toFixed(1)} px on a ${ch.edgePx.toFixed(1)} px edge`);
            assert.ok(ch.edgePx / 2 + f.offset - f.span / 2 >= ch.clear[0] - 1e-9 && ch.edgePx / 2 - f.offset - f.span / 2 >= ch.clear[1] - 1e-9, tag + ': within the clear part of the edge');
            if (Math.abs(f.offset) > 1e-9) slid++;
            // matching: the partner edge's cluster is its image under the gluing
            const pj = D.chevrons.find((c2) => c2.edge === e.partner);
            assert.ok(pj && pj.fit && Math.abs(pj.fit.f - f.f) < 1e-6 && pj.fit.count === f.count, tag + ': the partner draws the same cluster');
            const im = apply(inverse(e.g), ch.at.x, ch.at.y);
            assert.ok(Math.hypot(im[0] - pj.at.x, im[1] - pj.at.y) < (amp ? 1e-6 : 1e-9) * d.size, `${tag}: the clusters of edge ${ch.edge} and ${e.partner} do not match under the gluing`);
          }
          // drawn: each cluster has its count of chevrons, and stays 3 px clear of every glyph's ink
          const counts = drawn.map((p) => p.subs.length).sort();
          assert.deepEqual(counts, fitted.map((ch) => ch.fit.count).sort(), tag + ': chevrons drawn per cluster');
          for (const p of drawn) {
            for (const sub of p.subs) {
              for (let i = 0; i + 1 < sub.length; i++) {
                for (const gl of glyphs) {
                  for (let j = 0; j + 1 < gl.length; j++) {
                    const gap = segDist(sub[i], sub[i + 1], gl[j], gl[j + 1]) - p.lineWidth / 2;
                    closest = Math.min(closest, gap);
                    assert.ok(gap >= 3 - 1e-6, `${tag}: a chevron comes ${gap.toFixed(2)} px near a glyph`);
                  }
                }
              }
            }
          }
          P.destroy();
        }
      }
    }
  }
  assert.ok(clusters > 400 && slid > 4, `${clusters} clusters, ${slid} slid away from a glyph`);
  assert.ok(closest < 6, `the test does look at chevrons next to glyphs (closest ${closest.toFixed(2)} px)`);
});

test('chevronFit and glyphReach', () => {
  const size = chevronSize(2.9);
  for (const count of [1, 2, 3]) {
    let prevF = 0;
    for (let L = 4; L <= 200; L += 0.5) {
      const f = chevronFit(L, count, size, 6, 3);
      if (!f) { assert.equal(prevF, 0, `count ${count}: it fits at a shorter edge but not at ${L}`); continue; }
      assert.equal(f.count, count);
      assert.ok(f.f >= prevF - 1e-12 && f.f <= 1 && f.f >= CHEVRON_MIN, 'grows with the edge, up to full size');
      assert.ok(f.span <= Math.min(CHEVRON_SHARE * L, L - 9) + 1e-9);
      assert.ok(L / 2 + f.offset - f.span / 2 >= 6 - 1e-9 && L / 2 - f.offset - f.span / 2 >= 3 - 1e-9);
      if (L / 2 - f.span / 2 >= 6) assert.equal(f.offset, 0, 'in the middle whenever it fits there');
      prevF = f.f;
    }
    assert.equal(prevF, 1, 'full size on a long edge');
  }
  assert.equal(chevronFit(10, 3, size, 3, 3), null, 'too short: none rather than fewer');
  // glyphReach: the polygon's support function (its farthest vertex along the direction), the lens within its axes
  for (const order of [3, 4, 6]) {
    const R = (order === 3 ? 1.36 : order === 4 ? 1.24 : 1.16) * 5;
    for (let k = 0; k < 24; k++) {
      const th = (k * Math.PI) / 12 + 0.1, ang = 0.7;
      let best = -Infinity;
      for (let j = 0; j < order; j++) best = Math.max(best, R * Math.cos(ang + (2 * Math.PI * j) / order - th));
      assert.ok(Math.abs(glyphReach(order, ang, 5, th) - best) < 1e-12);
    }
  }
  assert.ok(Math.abs(glyphReach(2, 0.3, 5, 0.3) - 7) < 1e-12 && Math.abs(glyphReach(2, 0.3, 5, 0.3 + Math.PI / 2) - 3.3) < 1e-12);
  // followCentre and boundsOf
  assert.deepEqual(followCentre([0, 0, 1, 1], 0.5, 0.5, 2, 2), [0.5, 0.5]);
  assert.deepEqual(followCentre([2, 0, 3, 1], 0, 0.5, 2, 2), [1, 0.5]);
  assert.deepEqual(followCentre([-9, 0, 9, 1], 0, 0.5, 2, 2), [0, 0.5]);
  assert.deepEqual(boundsOf(Float64Array.from([1, 2, -3, 4, 0, -1])), [-3, -1, 1, 4]);
  assert.deepEqual(boundsOf([[[1, 2], [-3, 4]], [[0, -1]]]), [-3, -1, 1, 4]);
});

test('the handle is a ring: nothing fills its middle, so the comma or the edge under it stays visible (finding 21)', () => {
  for (const id of ['632', '4*2', '*x', '333', '22*']) {
    for (const pi of [0, BY_ID[id].presets.length - 1]) {
      for (const w of [226, 622]) {
        const { canvas, calls } = fakeCanvas(w, w);
        const P = createPlaneView(canvas, { hint: false });
        const sc = sceneOf(id, pi);
        P.setScene({ group: sc.group, domain: sc.domain });
        const h = P.toCss(sc.domain.seedActual[0], sc.domain.seedActual[1]);
        const atHandle = (s) => s.arc && Math.hypot(s.arc[0] - h[0], s.arc[1] - h[1]) < 1e-6;
        for (const dragging of [false, true]) {
          if (dragging) down(canvas, 1, 10, 10, { isPrimary: true });
          calls.length = 0; P.render();
          const paths = paintedPaths(calls).filter((p) => p.subs.some(atHandle));
          const ring = paths.filter((p) => p.op === 'stroke' && p.strokeStyle === ACCENT);
          assert.equal(ring.length, 1, `${id}: the ring`);
          const r = ring[0].subs.find(atHandle).arc[2];
          assert.ok(r >= 4.9 && r <= 7.6, `${id}: ring radius ${r}`);
          for (const p of paths.filter((q) => q.op === 'fill')) {
            const arcs = p.subs.filter(atHandle).map((s) => s.arc[2]).sort((a, b) => a - b);
            if (arcs.length === 1) {      // the pin-point at the seed: a dot, the rest of the middle stays open
              assert.ok(arcs[0] <= 0.27 * r, `${id}: a disc of radius ${arcs[0]} fills the middle of the handle`);
              continue;
            }
            assert.ok(dragging && arcs.length === 2 && arcs[0] >= r - ring[0].lineWidth, `${id}: something fills the middle of the handle`);
            assert.match(p.fillStyle, /rgba\(.*,0\.1\d*\)$/, 'the halo while dragging is faint');
          }
          // the tile's bold edges are drawn after the handle: a seed next to an edge does not cut it
          const iRing = calls.findIndex((cl) => cl.op === 'stroke' && cl.strokeStyle === ACCENT);
          const iEdge = calls.findIndex((cl) => cl.op === 'stroke' && cl.lineWidth === P.debug().metrics.edge);
          assert.ok(iRing >= 0 && iEdge > iRing, `${id}: the bold edges are drawn over the handle`);
        }
        P.destroy();
      }
    }
  }
});

test('the current tile is never tinted: it looks the same on either side of a mirror (finding 40)', () => {
  let odd = 0;
  for (const id of ['22*', '*x', '4*2', '**', '3*3', '2*22']) {
    const g = BY_ID[id];
    const sym = symmetryElements(g, g.center[0], g.center[1], 2 * g.viewHalf);
    const m = sym.mirrors[0];
    const p0 = g.presets[0];
    for (const side of [-1, 1]) {
      // a seed just off a mirror, on either side of it
      const t = 0.37 * Math.sqrt(g.domainArea), off = side * 0.12 * Math.sqrt(g.domainArea);
      const seed = [m.px + t * m.ux - off * m.uy, m.py + t * m.uy + off * m.ux];
      const d = buildDomain(g, { seed, metric: p0.metric, warp: makeWarp(g, 0) });
      const { canvas } = fakeCanvas(400, 400);
      const P = createPlaneView(canvas);
      P.setScene({ group: g, domain: d });
      const D = P.debug();
      if (D.parity < 0) odd++;
      assert.ok(D.copies.some((e) => isIdentity(e)), id + ': the tile itself is among the copies');
      assert.ok(!D.tinted.some((e) => isIdentity(e)), `${id}: the current tile is tinted (side ${side})`);
      const expect = D.copies.filter((e) => det(e) * D.parity < 0 && !isIdentity(e));
      assert.equal(D.tinted.length, expect.length, id + ': every other copy of the other hand is tinted');
      P.destroy();
    }
  }
  assert.ok(odd >= 3, 'the seeds include the side of the mirror where the tile would have been tinted');
  assert.deepEqual(tintedCopies([{ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }, { a: -1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }, { a: 1, b: 0, c: 0, d: 1, tx: 1, ty: 0 }], -1).length, 1);
});

test('quieter lines: glide axes lighter on a small pane, the copies\' outlines lighter with Wavy (finding 41)', () => {
  for (const id of ['4*2', '*632', 'xx', '22x']) {
    const at = (w, amp) => {
      const { canvas } = fakeCanvas(w, w);
      const P = createPlaneView(canvas);
      const sc = sceneOf(id, 0, amp);
      P.setScene({ group: sc.group, domain: sc.domain });
      const M = P.debug().metrics;
      P.destroy();
      return M;
    };
    const small = at(226, 0), big = at(624, 0), wavy = at(226, 1);
    assert.ok(small.small && !big.small && SMALL_PANE > 226 && SMALL_PANE < 360);
    assert.ok(small.glideAlpha <= 0.62 + 1e-9 && small.glideAlpha >= 0.3, `${id}: glide alpha ${small.glideAlpha} on a phone`);
    assert.ok(big.glideAlpha >= 0.5, `${id}: glide alpha ${big.glideAlpha} on a laptop`);
    assert.equal(small.outlineAlpha, 0.85, 'a straight cut keeps its outlines');
    assert.ok(wavy.outlineAlpha <= 0.5 && wavy.outlineAlpha >= 0.4, `${id}: outline alpha ${wavy.outlineAlpha} at Wavy 1`);
  }
});

test('the commas are filled lighter than before: MOTIF_COLOR at 0.40 over white (the big comma, 10 Nov 2026), opaque, every group', () => {
  // the owner's ask of 9-10 Nov 2026 made the comma 6 to 10 times bigger (qa/fill-judge.md): at the old 0.54 the plane
  // turned heavy; at 0.40 the mirrors, the dashed glide axes and the centre glyphs stay on top
  assert.equal(MOTIF_ALPHA_PLANE, 0.4);
  const c = [1, 3, 5].map((i) => parseInt(MOTIF_COLOR.slice(i, i + 2), 16));
  assert.equal(MOTIF_FILL, `rgb(${c.map((v) => Math.round(0.4 * v + 0.6 * 255)).join(',')})`);
  for (const g of GROUPS) {
    const { canvas, calls } = fakeCanvas(400, 400);
    const P = createPlaneView(canvas);
    P.setScene({ group: g, domain: sceneOf(g.id).domain, motif: motifFor(g) });
    P.render();
    const fills = calls.filter((x) => x.op === 'fill' && x.fillStyle === MOTIF_FILL);
    assert.ok(fills.length >= 1, `${g.id}: the commas are filled in the motif's colour`);
    P.destroy();
  }
});
