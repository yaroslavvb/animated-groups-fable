// pattern-glue.test.js — the model the Pattern pane is fed (src/pattern-glue.js pairModel): ALL THREE partitions at
// once, each in its own colour (two bold seals and a thin loop), the four cone points marked alike, the engine's own
// objects left alone; and the same lines whichever partition is the cut. (The view arithmetic of a flip needs a
// canvas: it is measured in the browser, tools/check.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { pairModel, SEAL_WIDTH, LOOP_WIDTH, LOOP_ALPHA, createPatternGlue } from '../src/pattern-glue.js';
import { PART_RGB, PART_HEX } from '../src/colors.js';
import { buildPatternModel, centredFor } from '../../two-features-two-handles/src/handles.js';
import { PRESETS, CARD_KEYS, stateFor, activate, withNumbers, cardsOf } from '../src/state.js';

const near = (G, p, q) => G.dist(p, q) < 1e-9;

test('three colours, one a partition: blue, vermillion, purple', () => {
  assert.deepEqual(PART_HEX, ['#0072B2', '#D55E00', '#882E72']);
  assert.equal(PART_RGB.length, 3);
  assert.equal(typeof createPatternGlue, 'function');
});

for (const sig of [...PRESETS, '2346']) {
  test(`${sig}: every partition's two seals and its loop, in its colour; four marks alike; nothing of the engine's changed`, () => {
    let state = stateFor(sig);
    for (const step of ['own', '02|13', 'twist', '03|12', '01|23']) {
      if (step === 'twist') state = withNumbers(state, { tw: 0.13 });
      else if (step !== 'own') state = activate(state, step).state;
      const own = buildPatternModel(state), model = pairModel(state), built = centredFor(state), G = model.D.G, cards = cardsOf(state);

      // marks: the four cone points alike (the pane's kind 'cone', all four brought out)
      const cones = model.A.classes.filter((c) => c.n > 1);
      assert.equal(cones.length, 4, 'four cone classes');
      assert.ok(cones.every((c) => c.kind === 'cone'));
      assert.deepEqual([...model.marks].sort(), cones.map((c) => c.id).sort());
      assert.deepEqual(model.markRefs, own.markRefs);

      // the engine's own model is untouched, and so is everything else of it
      for (const k of ['maps', 'maps2', 'cls', 'stars', 'glides', 'classes']) assert.deepEqual(model.A[k], own.A[k], `A.${k}`);
      for (const k of ['outline', 'tileEdges', 'firstV', 'cutPeriod']) assert.deepEqual(model[k], own[k], k);
      assert.deepEqual(model.design(), own.design(), 'the commas are the engine\'s');

      // lines: for each card two seals (bold) and, unless a pair of 2s makes the loop its seal, a loop (thin)
      const seals = model.lines.filter((l) => l.role === 'seal'), loops = model.lines.filter((l) => l.role === 'loop');
      assert.equal(seals.length, 6);
      assert.equal(loops.length, cards.filter((c) => !c.onTree).length);
      assert.ok(model.lines.indexOf(loops[loops.length - 1]) < model.lines.indexOf(seals[0]), 'loops under, seals over');
      for (const l of model.lines) {
        assert.deepEqual(l.color, PART_RGB[l.part], 'a line wears its partition\'s colour');
        assert.ok(!l.once, 'drawn on every tile, so no line can jump to another copy at a flip');
        assert.equal(l.dash, undefined);
      }
      for (const l of seals) assert.equal(l.width, SEAL_WIDTH);
      for (const l of loops) { assert.equal(l.width, LOOP_WIDTH); assert.equal(l.alpha, LOOP_ALPHA); }
      assert.ok(LOOP_WIDTH < SEAL_WIDTH && SEAL_WIDTH <= 2.4);
      cards.forEach((card) => {
        const part = CARD_KEYS.indexOf(card.key), mine = seals.filter((l) => l.part === part);
        assert.equal(mine.length, 2);
        mine.forEach((l, i) => assert.ok(near(G, l.a, card.seals[i][0]) && near(G, l.b, card.seals[i][1])));
      });
      // the cut's own lines are where the engine draws them
      const cut = cards.find((c) => c.active), part = CARD_KEYS.indexOf(cut.key);
      const cutSeal = seals.find((l) => l.part === part);
      // (2222: the engine draws the first pair's seal two spacings long, the whole row; the card's seal is one of them)
      assert.ok(near(G, cutSeal.a, built.treeSeg[0]) && (G.kind === 'E' || near(G, cutSeal.b, built.treeSeg[1])));
      const cutLoop = loops.find((l) => l.part === part);
      if (cutLoop) assert.ok(near(G, cutLoop.a, built.cutSeg[0]) && near(G, cutLoop.b, built.cutSeg[1]));
      assert.deepEqual(model.dots, []);
    }
  });
}

test('a flip changes no line: the same curves of the orbifold, in the same colours', async () => {
  // A line may be handed over on another copy of the tile after a flip (the pane draws every copy), so the lines are
  // compared where copies do not matter: on the solid, by the middle's distances to the four named cone points.
  const { solidOf } = await import('../src/solid.js');
  const sign = (S, l) => {
    const G = S.G, mid = [0, 0, 0], V = S.vertex;
    S.point(G.mix(l.a, l.b, l.role === 'seal' ? 0.5 : 0.37), mid);
    return V.map((v) => Math.hypot(v[0] - mid[0], v[1] - mid[1], v[2] - mid[2]));
  };
  for (const sig of ['3333', '2345', '2222']) {
    const state = withNumbers(stateFor(sig), { tw: 0.11 }), before = pairModel(state), S0 = solidOf(state);
    for (const key of ['02|13', '03|12']) {
      const r = activate(state, key), after = pairModel(r.state), S1 = solidOf(r.state);
      assert.equal(after.lines.length, before.lines.length);
      for (const l of after.lines.filter((x) => x.role === 'seal')) {
        const mine = sign(S1, l), same = before.lines.filter((m) => m.role === 'seal' && m.part === l.part).map((m) => sign(S0, m));
        assert.ok(same.some((sg) => sg.every((d, f) => Math.abs(d - mine[f]) < 1e-6)), `${sig} -> ${key}: a seal of partition ${l.part} is where it was`);
      }
      // the three loops keep their lengths and colours
      const len = (model, part) => { const l = model.lines.find((x) => x.role === 'loop' && x.part === part); return l ? model.D.G.dist(l.a, l.b) : null; };
      for (let part = 0; part < 3; part++) {
        const a = len(before, part), b = len(after, part);
        assert.equal(a === null, b === null);
        if (a !== null) assert.ok(Math.abs(a - b) < 1e-7, `${sig} -> ${key}: the loop of partition ${part} keeps its length`);
      }
    }
  }
});
