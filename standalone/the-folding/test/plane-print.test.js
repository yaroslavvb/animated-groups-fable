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
      const print = printFor(g, key), snow = g.fold === 'snowflake';
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
    const g = BY_ID[id], snow = g.fold === 'snowflake';
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
