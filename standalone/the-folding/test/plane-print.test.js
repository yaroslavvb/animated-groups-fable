// test/plane-print.test.js — the plane under a print (13 Nov 2026; src/plane.js, src/pattern.js): what is drawn where,
// on a canvas that records its calls. The geometry of the print itself is test/pattern.test.js's; here: the print takes
// the commas' place, the tile is the paper's front, the copies of the other hand show its back, the replication's cards
// carry the print, and a re-cut shows its home tile and its cuts.
//   node --test test/plane-print.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID } from '../src/groups.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { createPlaneView, MOTIF_FILL, PRINT_PALE, PRINT_PALE_BACK } from '../src/plane.js';
import { printFor } from '../src/pattern.js';
import { makeShapePrint } from '../src/shapes.js';
import { motifFor } from '../src/motif.js';
import { PRINT_FRONT, PRINT_BACK, RECUT_COLOR, INK, ACCENT_SOFT } from '../src/palette.js';
import { buildScene, planeRecut } from '../src/app.js';

/** A canvas that records what is drawn on it (as test/plane.test.js's). */
function fakeCanvas(w, h) {
  const calls = [], state = {};
  const ctx = new Proxy({}, {
    get(t, prop) {
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 6.2 });
      if (prop in state) return state[prop];
      return (...args) => { calls.push({ op: prop, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle, lineWidth: state.lineWidth, globalAlpha: state.globalAlpha }); };
    },
    set(t, prop, v) { state[prop] = v; return true; },
  });
  const canvas = {
    width: w, height: h, clientWidth: w, clientHeight: h, style: {}, attrs: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    addEventListener() {}, removeEventListener() {},
    setAttribute(k, v) { this.attrs[k] = String(v); }, hasAttribute(k) { return k in this.attrs; },
    setPointerCapture() {}, releasePointerCapture() {}, focus() {},
  };
  return { canvas, calls };
}
const fills = (calls, style) => calls.filter((c) => c.op === 'fill' && c.fillStyle === style);
const hasMirrorImages = (g) => g.reps.some((r) => r.a * r.d - r.b * r.c < 0);

function domainOf(g, i = 0, amp = 0) {
  const p = g.presets[i];
  return buildDomain(g, { seed: p.seed, metric: p.metric, warp: makeWarp(g, amp) });
}

test('plane: under a print the commas are gone, the print covers the plane, the tile is the paper\'s front, the other hand its back', () => {
  assert.ok(/^rgba\(/.test(PRINT_PALE) && /^rgba\(/.test(PRINT_PALE_BACK) && PRINT_PALE !== PRINT_PALE_BACK, 'two pale tones, see-through');
  assert.equal(PRINT_FRONT.length, 2); assert.equal(PRINT_BACK.length, 2);
  for (const g of GROUPS) {
    for (const key of ['checker', 'rings']) {
      const print = printFor(g, key), snow = g.fold === 'disc';
      const { canvas, calls } = fakeCanvas(560, 520);
      const P = createPlaneView(canvas, { hint: false });
      P.setScene({ group: g, domain: domainOf(g), interactive: !snow, print });
      calls.length = 0;
      P.render();
      const label = `${g.id} ${key}`;
      assert.equal(fills(calls, MOTIF_FILL).length, 0, `${label}: no comma`);
      const pale = fills(calls, PRINT_PALE), back = fills(calls, PRINT_PALE_BACK);
      assert.ok(pale.length >= 1 && pale.every((c) => c.args[0] === 'evenodd'), `${label}: the print, pale, by the even-odd rule`);
      // the copies of the other hand: there are some exactly when the group has a reflection or a glide
      assert.equal(back.length > 0, hasMirrorImages(g), `${label}: the paper's back on the tiles of the other hand`);
      // the tile: the light front tone under the dark one, instead of the soft accent
      assert.equal(fills(calls, PRINT_FRONT[0]).length, 1, `${label}: the tile's paper`);
      assert.ok(fills(calls, PRINT_FRONT[1]).length >= 1 && fills(calls, PRINT_FRONT[1]).every((c) => c.args[0] === 'evenodd'), `${label}: the tile's print`);
      assert.equal(fills(calls, ACCENT_SOFT).length, 0, `${label}: no accent wash over the print`);
      // the order: the plane's print, then the tile's paper, then the tile's print
      const iPale = calls.indexOf(pale[0]), iPaper = calls.indexOf(fills(calls, PRINT_FRONT[0])[0]), iPrint = calls.indexOf(fills(calls, PRINT_FRONT[1])[0]);
      assert.ok(iPale < iPaper && iPaper < iPrint, `${label}: plane, paper, print`);
      // every clip is undone (save / restore balance), so nothing later is drawn inside a tile's clip
      assert.equal(calls.filter((c) => c.op === 'save').length, calls.filter((c) => c.op === 'restore').length, `${label}: save / restore`);
      P.destroy();
    }
  }
});

test('plane: without a print the picture is the comma\'s, as before; switching back and forth draws each afresh', () => {
  const g = BY_ID['22x'], domain = domainOf(g, 2);
  const { canvas, calls } = fakeCanvas(560, 520);
  const P = createPlaneView(canvas, { hint: false });
  P.setScene({ group: g, domain });
  calls.length = 0; P.render();
  assert.ok(fills(calls, MOTIF_FILL).length >= 1, 'commas');
  assert.equal(fills(calls, PRINT_PALE).length + fills(calls, PRINT_PALE_BACK).length + fills(calls, PRINT_FRONT[0]).length, 0, 'no print');
  assert.equal(fills(calls, ACCENT_SOFT).length, 1, 'the tile\'s soft accent');
  P.setScene({ group: g, domain, print: printFor(g, 'checker') });
  calls.length = 0; P.render();
  assert.equal(fills(calls, MOTIF_FILL).length, 0);
  assert.ok(fills(calls, PRINT_PALE).length >= 1 && fills(calls, PRINT_PALE_BACK).length >= 1);
  P.setScene({ group: g, domain, print: printFor(g, 'rings') });
  calls.length = 0; P.render();
  assert.ok(fills(calls, PRINT_PALE).length >= 1, 'rings: one fill per centre\'s cell');
  P.setScene({ group: g, domain, print: null });
  calls.length = 0; P.render();
  assert.ok(fills(calls, MOTIF_FILL).length >= 1, 'the commas are back');
  assert.equal(fills(calls, PRINT_PALE).length, 0);
  P.destroy();
});

test('plane: the replication under a print — landed copies and cards carry the print, in the colour of the face that is up; no commas', () => {
  for (const id of ['2222', '22x', '*x', '333', '*442']) {
    const g = BY_ID[id], snow = g.fold === 'disc';
    const { canvas, calls } = fakeCanvas(560, 520);
    const P = createPlaneView(canvas, { hint: false });
    P.setScene({ group: g, domain: domainOf(g), interactive: !snow, print: printFor(g, 'checker') });
    const plan = P.tilingPlan();
    assert.ok(plan && plan.duration > 0, id);
    let palest = 0, backs = 0;
    for (const u of [0, 0.08, 0.2, 0.45, 0.7, 0.95]) {
      P.setTiling(u);
      calls.length = 0;
      P.render();
      assert.equal(fills(calls, MOTIF_FILL).length, 0, `${id} u = ${u}: no comma on a card`);
      assert.equal(fills(calls, PRINT_FRONT[0]).length, 1, `${id} u = ${u}: the tile's paper`);
      palest += fills(calls, PRINT_PALE).length; backs += fills(calls, PRINT_PALE_BACK).length;
      assert.equal(calls.filter((c) => c.op === 'save').length, calls.filter((c) => c.op === 'restore').length, `${id} u = ${u}: save / restore`);
    }
    assert.ok(palest >= 3, `${id}: the print on landed copies and cards (${palest} fills)`);
    assert.equal(backs > 0, hasMirrorImages(g), `${id}: the back's colour where a copy is turned over`);
    // complete: the plane as always
    P.setTiling(1);
    calls.length = 0; P.render();
    assert.ok(fills(calls, PRINT_PALE).length >= 1);
    P.destroy();
  }
});

test('plane: a re-cut shows its home tile dotted and its cuts dashed, over the tile; none without a re-cut', () => {
  const g = BY_ID['22x'], p = g.presets[2];
  const scene = buildScene(g, { seed: p.seed, anchor: p.seed.slice(), pattern: 'checker' });
  const R = planeRecut(scene);
  assert.ok(R && R.home.length === 4 && R.cuts.length > 0);
  const { canvas, calls } = fakeCanvas(560, 520);
  const P = createPlaneView(canvas, { hint: false });
  P.setScene({ group: g, domain: scene.domain, print: scene.print, recut: R });
  calls.length = 0; P.render();
  const dashes = calls.filter((c) => c.op === 'setLineDash' && c.args[0].length === 2);
  assert.ok(dashes.length >= 2, 'a dashed and a dotted line');
  const strokesOf = (style) => calls.filter((c) => c.op === 'stroke' && c.strokeStyle === style);
  assert.ok(strokesOf(RECUT_COLOR).length >= 1, 'the cuts');
  // the home's outline: four corners, closed, stroked in ink after the tile's own fill
  const iPaper = calls.indexOf(fills(calls, PRINT_FRONT[0])[0]);
  const inkAfter = calls.filter((c, i) => i > iPaper && c.op === 'stroke' && c.strokeStyle === INK && c.lineWidth < 2.2);
  assert.ok(inkAfter.length >= 1, 'the home tile\'s dotted outline, over the tile');
  // the dash patterns are reset: nothing after them is drawn dashed by accident
  const lastDash = calls.filter((c) => c.op === 'setLineDash').pop();
  assert.deepEqual(lastDash.args[0], [], 'the dash is reset');
  // the piece that is being carried: its place in the home tile filled softly, the piece outlined on the tile
  const A = planeRecut(scene, 0.5 * (scene.fold.recut.pieces[1].from + scene.fold.recut.pieces[1].to)).active;
  assert.ok(A && A.from.length >= 3 && A.to.length === A.from.length);
  const count = () => calls.filter((c) => c.op === 'fill' && /^rgba\(15,118,110,0\.26\)$/.test(String(c.fillStyle))).length;
  assert.equal(count(), 0, 'none while no piece moves');
  P.setRecutActive(A);
  calls.length = 0; P.render();
  assert.equal(count(), 1, 'the landing place, in a soft accent');
  P.setRecutActive(null);
  calls.length = 0; P.render();
  assert.equal(count(), 0, 'gone when the piece has landed');
  // the same tile without a re-cut: no such lines
  P.setScene({ group: g, domain: scene.domain, print: scene.print, recut: null });
  calls.length = 0; P.render();
  assert.equal(strokesOf(RECUT_COLOR).length, 0);
  // the home tile itself needs none
  const home = buildScene(g, { seed: g.presets[0].seed, anchor: g.presets[0].seed.slice(), pattern: 'checker' });
  assert.equal(planeRecut(home), null);
  P.destroy();
});

// ---- a shape print (src/shapes.js; 13 Nov 2026, the pattern round) -----------------------------------------------------

/** A recording canvas as fakeCanvas, that also records globalCompositeOperation, with a document that makes more of them. */
function fakeDocCanvas(w, h) {
  const made = [];
  const make = (cw, ch) => {
    const calls = [], state = { globalCompositeOperation: 'source-over' };
    const ctx = new Proxy({}, {
      get(t, prop) {
        if (prop === 'measureText') return (str) => ({ width: String(str).length * 6.2 });
        if (prop in state) return state[prop];
        return (...args) => { calls.push({ op: prop, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle, globalAlpha: state.globalAlpha, gco: state.globalCompositeOperation }); };
      },
      set(t, prop, v) { state[prop] = v; return true; },
    });
    const canvas = {
      width: cw, height: ch, clientWidth: cw, clientHeight: ch, style: {}, attrs: {}, calls,
      getContext: () => ctx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: cw, height: ch }),
      addEventListener() {}, removeEventListener() {},
      setAttribute(k, v) { this.attrs[k] = String(v); }, hasAttribute(k) { return k in this.attrs; },
      setPointerCapture() {}, releasePointerCapture() {}, focus() {},
    };
    return canvas;
  };
  const doc = { defaultView: null, createElement: () => { const cv = make(1, 1); made.push(cv); return cv; } };
  const canvas = make(w, h);
  canvas.ownerDocument = doc;
  return { canvas, calls: canvas.calls, made };
}
const commaPrint = (g) => {
  const m = motifFor(g);
  return makeShapePrint(g, { key: 'demo', name: 'demo', shapes: m.polylines.map((p) => ({ pts: Array.from(p) })) });
};
const pathOps = (calls) => calls.filter((c) => c.op === 'lineTo' || c.op === 'moveTo').length;

test('plane: a shape print is filled ONCE per window into three layers (dark, pale, pale back) and every frame draws them; a new window or print fills them anew; the built-in prints are drawn as before', () => {
  for (const id of ['*442', '22x', '632']) {
    const g = BY_ID[id], snow = g.fold === 'disc', print = commaPrint(g);
    const { canvas, calls, made } = fakeDocCanvas(560, 520);
    const P = createPlaneView(canvas, { hint: false });
    P.setScene({ group: g, domain: domainOf(g), interactive: !snow, print });
    calls.length = 0;
    P.render();
    assert.equal(P.stats.printBuilds, 1, `${id}: one filling`);
    // the layers: the dark tone in the tile's front colour, by the nonzero rule; the pale ones made from it
    const dark = made.find((cv) => cv.calls.some((c) => c.op === 'fill' && c.fillStyle === PRINT_FRONT[1] && c.args[0] === 'nonzero'));
    assert.ok(dark && dark.width === 560 && dark.height === 520, `${id}: the dark layer, the canvas's size`);
    const tinted = (style) => made.find((cv) => cv.calls.some((c) => c.op === 'fillRect' && c.fillStyle === style && c.gco === 'source-in') &&
      cv.calls.some((c) => c.op === 'drawImage' && c.args[0] === dark));
    const pale = tinted(PRINT_PALE), paleBack = tinted(PRINT_PALE_BACK);
    assert.ok(pale && paleBack, `${id}: the pale teal and the pale sand, composited from the dark layer`);
    // the frame: no path of the print on the plane's own canvas, the layers drawn instead (under the clips)
    assert.equal(fills(calls, PRINT_PALE).length + fills(calls, PRINT_PALE_BACK).length + fills(calls, PRINT_FRONT[1]).length, 0, `${id}: no fill of the print on the canvas`);
    const images = calls.filter((c) => c.op === 'drawImage').map((c) => c.args[0]);
    assert.ok(images.includes(pale) && images.includes(dark), `${id}: the pale layer over the plane, the dark one in the tile`);
    assert.equal(images.includes(paleBack), hasMirrorImages(g), `${id}: the sand layer where the copies of the other hand are`);
    assert.equal(fills(calls, PRINT_FRONT[0]).length, 1, `${id}: the tile's paper`);
    assert.equal(calls.filter((c) => c.op === 'save').length, calls.filter((c) => c.op === 'restore').length, `${id}: save / restore`);
    // the next frames, and the Tile step (the window stays): nothing filled again; the cards fill their own share
    const layerOps = () => [dark, pale, paleBack].reduce((n, cv) => n + pathOps(cv.calls) + cv.calls.filter((c) => c.op === 'fillRect').length, 0);
    const before = layerOps();
    calls.length = 0;
    P.render(); P.setTiling(0.5); P.render(); P.setTiling(1); P.render();
    assert.equal(P.stats.printBuilds, 1, `${id}: the same window, the same layers`);
    assert.equal(layerOps(), before, `${id}: no layer drawn again`);
    assert.ok(fills(calls, PRINT_PALE).length + fills(calls, PRINT_PALE_BACK).length >= 1, `${id}: the cards of the Tile step fill their share`);
    // another window (the pane's size): filled anew, at the new size
    canvas.width = canvas.clientWidth = 600;
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 520 });
    P.resize();
    assert.equal(P.stats.printBuilds, 2, `${id}: a new window`);
    assert.equal(dark.width, 600);
    // another print of the same group: anew
    P.setScene({ group: g, domain: domainOf(g), interactive: !snow, print: commaPrint(g) });
    P.render();
    assert.equal(P.stats.printBuilds, 3, `${id}: a new print`);
    // a built-in print: drawn on the canvas as before, and the layers' memory is given back
    P.setScene({ group: g, domain: domainOf(g), interactive: !snow, print: printFor(g, 'checker') });
    calls.length = 0; P.render();
    assert.equal(P.stats.printBuilds, 3, `${id}: the checkerboard has no layers`);
    assert.ok(fills(calls, PRINT_PALE).length >= 1 && fills(calls, PRINT_PALE).every((c) => c.args[0] === 'evenodd'), `${id}: the checkerboard, filled as before`);
    assert.equal(dark.width, 0, `${id}: the layers are given back`);
    P.destroy();
  }
});

test('plane: a shape print without a document (node) is filled on the canvas itself, outline simplified to a quarter of a device pixel', () => {
  const g = BY_ID['*442'], print = commaPrint(g);
  const { canvas, calls } = fakeCanvas(560, 520);
  const P = createPlaneView(canvas, { hint: false });
  P.setScene({ group: g, domain: domainOf(g), interactive: false, print });
  calls.length = 0; P.render();
  const pale = fills(calls, PRINT_PALE), dark = fills(calls, PRINT_FRONT[1]);
  assert.ok(pale.length === 1 && pale[0].args[0] === 'nonzero', 'the plane: one path, the nonzero rule');
  assert.ok(dark.length === 1 && dark[0].args[0] === 'nonzero', 'the tile');
  // fewer points than the motif has, per copy (the comma of the page: about 300 points; a quarter pixel at 250 px a unit)
  const iPale = calls.indexOf(pale[0]);
  let k = iPale - 1, moves = 0, lines = 0;
  for (; k >= 0 && calls[k].op !== 'beginPath'; k--) { if (calls[k].op === 'moveTo') moves++; else if (calls[k].op === 'lineTo') lines++; }
  assert.ok(moves > 10, `${moves} outlines`);
  assert.ok((moves + lines) / moves < 0.8 * print.verts, `about ${((moves + lines) / moves).toFixed(0)} points an outline, of ${print.verts}`);
  P.destroy();
});

test('plane: under a shape print the cards of the Tile step fill ONE world-space Path2D (the tile\'s share of the print), made once per tile, print and scale, under each card\'s own transform', () => {
  class FakePath2D { constructor() { this.subs = 0; this.points = 0; } moveTo() { this.subs++; this.points++; } lineTo() { this.points++; } closePath() {} }
  for (const id of ['333', '*442']) {
    const g = BY_ID[id], snow = g.fold === 'disc', print = commaPrint(g);
    const { canvas, calls } = fakeDocCanvas(560, 520);
    canvas.ownerDocument.defaultView = { Path2D: FakePath2D };
    const P = createPlaneView(canvas, { hint: false });
    P.setScene({ group: g, domain: domainOf(g), interactive: !snow, print });
    const paths = new Set();
    let cardFills = 0;
    for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      P.setTiling(u);
      calls.length = 0;
      P.render();
      calls.forEach((c, i) => {
        if (c.op !== 'fill' || !(c.args[0] instanceof FakePath2D)) return;
        cardFills++; paths.add(c.args[0]);
        // a card of the first layer carries the paper's own dark tone (front teal, back sand: the owner's comments of
        // 13 Nov, cdf3fb6), a quiet card of a later layer the plane's pale tones
        assert.ok([PRINT_FRONT[1], PRINT_BACK[1], PRINT_PALE, PRINT_PALE_BACK].includes(c.fillStyle), `${id} u = ${u}: the paper's dark tone or a pale tone (got ${c.fillStyle})`);
        assert.equal(c.args[1], 'nonzero');
        assert.equal(calls[i - 1].op, 'setTransform', `${id} u = ${u}: under the card's own transform`);
      });
      // ... and no card builds a path of the print point by point any more
      assert.equal(fills(calls, PRINT_PALE).filter((c) => c.args[0] === 'nonzero').length + fills(calls, PRINT_PALE_BACK).filter((c) => c.args[0] === 'nonzero').length, 0, `${id} u = ${u}`);
      assert.equal(calls.filter((c) => c.op === 'save').length, calls.filter((c) => c.op === 'restore').length, `${id} u = ${u}: save / restore`);
    }
    assert.ok(cardFills >= 3, `${id}: ${cardFills} cards`);
    assert.equal(paths.size, 1, `${id}: one path for every card of every frame`);
    const [path] = paths;
    assert.ok(path.subs >= 1 && path.points > path.subs * 10, `${id}: the copies of the motif near the tile (${path.subs} outlines, ${path.points} points)`);
    // another print: another path
    P.setScene({ group: g, domain: domainOf(g), interactive: !snow, print: commaPrint(g) });
    P.setTiling(0.5); calls.length = 0; P.render();
    const again = calls.filter((c) => c.op === 'fill' && c.args[0] instanceof FakePath2D).map((c) => c.args[0]);
    assert.ok(again.length >= 1 && again.every((q) => q === again[0]) && again[0] !== path, `${id}: a new print, a new path`);
    P.destroy();
  }
});
