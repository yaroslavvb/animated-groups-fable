// pattern-glue.js — the Pattern pane of PQRS pillows: Two features, two handles' pane as it is (createPattern fed
// buildPatternModel(state)), with ALL THREE partitions drawn on it at all times, and the stillness of a flip.
//
//   const glue = createPatternGlue(canvas, { tip });
//   glue.show(state, { keepView })     draw the state (keepView: a slider moved; without it the pattern's first view)
//   glue.still(invQ)                   a flip happened: NOTHING is drawn (the pane keeps the model it shows), the motion
//                                      is remembered, and the next show() lays the new cut's model where the picture
//                                      is (view <- view . invQ, as Two features, two handles' page.js pickPair does)
//   glue.reset()                       the pattern's first view
//   glue.redraw()                      after the pane was hidden (a tab), or resized
//   glue.pattern                       the createPattern object (state(), getView(), readPatch(): for checks)
//
// What is changed in the model (pairModel), and nothing else:
//   lines   for each of the three cards (state.js cardsOf), in the partition's own colour (colors.js): its two seals
//           bold and its loop thin. They are the same geodesics of the orbifold whichever partition is the cut, so a
//           flip redraws them where they were (his ask, Fri 27 Nov 2026, 22:55: the lines keep their colours, and
//           switching between sliders changes nothing).
//   marks   the four cone points alike: the pane's blue marks, all four brought out. (A pair is shown by its seal.)
//   D.clear 2222 only: the tile's room, by which the pane sizes marks and thins lines, is made the orbifold's own (below)
//   dots    none.

import {
  buildPatternModel, GE, psuMul, psuInv, psuApplyDisc, psuToSO21, so21ToPSU,
} from '../../two-features-two-handles/src/handles.js';
import { createPattern, locateTilePSU } from '../../two-features-two-handles/src/pattern-ext.js';
import { mul, apply, det, I3 } from '../../classification-of-surfaces/src/sym/geom.js';
import { cardsOf, CARD_KEYS } from './state.js';
import { PART_RGB } from './colors.js';

export const SEAL_WIDTH = 2, LOOP_WIDTH = 1, LOOP_ALPHA = 0.6;

/** The engine's model of a state with this page's marks and lines (see the head of the file). Pure. */
export function pairModel(state, { dark = false } = {}) {
  const model = buildPatternModel(state, { dark });
  const A = model.A, cones = A.classes.filter((c) => c.n > 1 && c.kind === 'cone').map((c) => c.id);
  const loops = [], seals = [];
  let cards = [];
  try { cards = cardsOf(state); } catch (err) { cards = []; }
  for (const card of cards) {
    const part = CARD_KEYS.indexOf(card.key), color = PART_RGB[part];
    if (!card.onTree && card.seg) loops.push({ a: card.seg[0], b: card.seg[1], color, width: LOOP_WIDTH, alpha: LOOP_ALPHA, steps: 8, role: 'loop', part });
    for (const seal of card.seals || []) seals.push({ a: seal[0], b: seal[1], color, width: SEAL_WIDTH, alpha: 1, steps: 6, role: 'seal', part });
  }
  // 2222 (the pane's canvas path): the pane sizes a mark, and thins a line, by the tile's own room D.clear, and the
  // engine's tile is another polygon for every cut (0.50, 0.47, 0.41 for one and the same 2222). So the marks would
  // change size when another card is touched. The room handed over is the orbifold's own instead: half the shortest
  // seal, which is 0.495 of it at the opening state, as the engine's tile has it there.
  let D = model.D;
  if (D.G.kind === 'E' && cards.length) {
    let least = Infinity;
    for (const card of cards) for (const seal of card.seals || []) least = Math.min(least, Math.hypot(seal[0][0] - seal[1][0], seal[0][1] - seal[1][1]));
    if (Number.isFinite(least) && least > 0) D = { ...D, clear: 0.495 * least };
  }
  return { ...model, D, marks: cones, lines: [...loops, ...seals], dots: [] };
}

/** Two features, two handles' page.js recentreStartView, copied: the view times the symmetry that brings the tile under the middle of the view home. */
function recentreStartView(Vstart, model) {
  const { D, A } = model, kind = D.G.kind;
  if (kind === 'E') {
    let Vc = Vstart.slice();
    const far = (M) => { const p = apply(M, D.at); return p[0] * p[0] + p[1] * p[1]; };
    for (let guard = 0; guard < 120; guard++) {
      let best = -1, bd = far(Vc) - 1e-9;
      for (let i = 0; i < D.n; i++) { const d = far(mul(Vc, A.maps[i])); if (d < bd) { bd = d; best = i; } }
      if (best < 0) break;
      Vc = mul(Vc, A.maps[best]);
    }
    return GE.fix(Vc, 1);
  }
  if (kind !== 'H') return Vstart;
  let vPsu = so21ToPSU(Vstart, det(Vstart) < 0);
  const { g } = locateTilePSU(D, A, psuApplyDisc(psuInv(vPsu), [0, 0]));
  vPsu = psuMul(vPsu, g);
  return psuToSO21(vPsu);
}

export function createPatternGlue(canvas, opts = {}) {
  const pattern = createPattern(canvas, opts.tip ? { tip: opts.tip } : {});
  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => !!(mq && mq.matches);
  let model = null, kind = null;
  // Flips since the picture was last drawn: the motion from the frame the pane draws in to the frame of the state
  // that will be shown next (the product of the flips' invQ, in order). A FLIP DRAWS NOTHING: the pane goes on
  // showing the model it has, untouched, so no pixel can change when another card is touched. The motion is used
  // when a slider next moves: the new cut's model is then laid where the picture was (view <- view . pending), at
  // the reader's view as it is at that moment (they may have slid the pattern meanwhile).
  let pending = null;

  /** A flip happened (invQ: the new state's frame carried back to the old one's). Nothing is drawn. */
  function still(invQ, nextState = null, o = {}) {
    if (invQ && kind) pending = pending ? mul(pending, invQ) : invQ.slice();
    if (nextState) show(nextState, o);
  }

  function show(state, { keepView = false } = {}) {
    const next = pairModel(state, { dark: isDark() }), nextKind = next.D.G.kind;
    const before = pending && keepView && nextKind === kind ? pattern.getView() : null;
    if (before && before.V) {
      let V = kind === 'H'
        ? psuToSO21(psuMul(so21ToPSU(before.V, det(before.V) < 0), so21ToPSU(pending, false)))
        : GE.fix(mul(before.V, pending), 1);
      // both draws happen in this task, so no frame shows the view the model starts with
      pattern.set(next);
      try { V = recentreStartView(V, next); } catch (err) { /* the bookkeeping is then done on the next set */ }
      pattern.setView({ V, base: I3.slice(), turned: false }, { moving: false, sync: true });
    } else {
      pattern.set(next, { keepView: !!keepView && nextKind === kind });
    }
    pending = null;
    model = next; kind = nextKind;
  }

  return {
    show,
    still,
    reset() { pending = null; pattern.resetView(); },
    redraw() { pattern.draw(); },
    pattern,
    get model() { return model; },
    get kind() { return kind; },
    /** Is a flip waiting for the next slider move (the pane still shows the cut it drew last)? */
    get waiting() { return !!pending; },
  };
}
