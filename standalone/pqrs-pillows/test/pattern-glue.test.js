// pattern-glue.test.js — the model the Pattern pane is fed (src/pattern-glue.js pairModel): marks by pair, the two
// seals and the loop thin, the engine's own objects left alone. (The view arithmetic of a flip needs a canvas: it is
// measured in the browser, dev/shell/check.mjs and tools/check.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { pairModel, PAIR_BLUE, PAIR_ORANGE, SEAL_WIDTH, LOOP_WIDTH, LOOP_ALPHA, createPatternGlue } from '../src/pattern-glue.js';
import { buildPatternModel, centredFor } from '../../two-features-two-handles/src/handles.js';
import { PRESETS, stateFor, activate, withNumbers } from '../src/state.js';

const hex = (c) => '#' + c.map((v) => Math.round(255 * v).toString(16).padStart(2, '0')).join('').toUpperCase();
const near = (G, p, q) => G.dist(p, q) < 1e-9;

test('the two colours are the page\'s: blue #0072B2, orange #D55E00', () => {
  assert.equal(hex(PAIR_BLUE), '#0072B2');
  assert.equal(hex(PAIR_ORANGE), '#D55E00');
  assert.equal(typeof createPatternGlue, 'function');
});

for (const sig of [...PRESETS, '2346']) {
  test(`${sig}: marks by pair, three thin lines, nothing of the engine's changed`, () => {
    let state = stateFor(sig);
    for (const step of ['own', '02|13', 'twist', '03|12', '01|23']) {
      if (step === 'twist') state = withNumbers(state, { tw: 0.13 });
      else if (step !== 'own') state = activate(state, step).state;
      const own = buildPatternModel(state), model = pairModel(state), built = centredFor(state), G = model.D.G;

      // marks: the first pair is the engine's brought-out pair (larger, blue: kind 'cone'); the second pair's two
      // classes carry another kind, which the pane paints #D55E00, and which is not 'corner' (that kind reads c.ends)
      const first = new Set(model.marks), cones = model.A.classes.filter((c) => c.n > 1);
      assert.equal(cones.length, 4, 'four cone classes');
      assert.equal(first.size, 2);
      for (const c of cones) {
        if (first.has(c.id)) assert.equal(c.kind, 'cone');
        else { assert.notEqual(c.kind, 'cone'); assert.notEqual(c.kind, 'corner'); }
      }
      assert.equal(cones.filter((c) => c.kind === 'cone').length, 2);
      // the brought-out classes are the cut's first pair: each has a corner of the tile at home[0] or home[1]
      for (const c of cones) {
        const at = (h) => c.verts.some((v) => near(G, model.D.verts[v], h));
        const isFirst = at(model.home[0]) || at(model.home[1]), isSecond = at(model.home[2]) || at(model.home[3]);
        assert.ok(isFirst !== isSecond, 'a cone class belongs to one pair');
        assert.equal(first.has(c.id), isFirst, `${sig} ${step}: the larger blue marks are the first pair's`);
      }
      // every mark keeps its direction
      assert.deepEqual(model.markRefs, own.markRefs);
      assert.equal(model.dimMarks, false);

      // the engine's own model is untouched, and so is everything else of it
      assert.ok(own.A.classes.filter((c) => c.n > 1).every((c) => c.kind === 'cone'));
      assert.ok(buildPatternModel(state).A.classes.filter((c) => c.n > 1).every((c) => c.kind === 'cone'));
      for (const k of ['maps', 'maps2', 'cls', 'stars', 'glides']) assert.deepEqual(model.A[k], own.A[k], `A.${k}`);
      for (const k of ['outline', 'tileEdges', 'firstV', 'cutPeriod']) assert.deepEqual(model[k], own[k], k);
      assert.deepEqual(model.design(), own.design(), 'the commas are the engine\'s');

      // lines: the loop thin, ink at 60 %, not dashed; the seals thin in their pair's colours; no more than the
      // engine's own three lines a tile (the WebGL path's room), and no dots
      assert.ok(model.lines.length <= 3 && model.lines.length >= 2);
      assert.ok(model.lines.length <= own.lines.length + 2);
      const by = Object.fromEntries(model.lines.map((l) => [l.role, l]));
      assert.ok(by.loop && by.seal0, 'the loop and the first seal are drawn');
      assert.equal(by.loop.width, LOOP_WIDTH); assert.ok(LOOP_WIDTH <= 1.3);
      assert.equal(by.loop.alpha, LOOP_ALPHA); assert.equal(LOOP_ALPHA, 0.6);
      assert.equal(by.loop.dash, undefined);
      assert.ok(by.loop.color.every((v) => v < 0.2), 'ink');
      assert.deepEqual(by.seal0.color, PAIR_BLUE);
      assert.ok(SEAL_WIDTH <= 2);
      assert.ok(near(G, by.seal0.a, built.treeSeg[0]) && near(G, by.seal0.b, built.treeSeg[1]));
      assert.ok(near(G, by.loop.a, built.cutSeg[0]) && near(G, by.loop.b, built.cutSeg[1]));
      if (by.seal1) {
        assert.deepEqual(by.seal1.color, PAIR_ORANGE);
        assert.ok(near(G, by.seal1.a, built.farTreeSeg[0]) && near(G, by.seal1.b, built.farTreeSeg[1]));
      }
      for (const l of model.lines) assert.ok(!l.once, 'drawn on every tile, so no line can jump to another copy at a flip');
      assert.deepEqual(model.dots, []);
    }
  });
}
