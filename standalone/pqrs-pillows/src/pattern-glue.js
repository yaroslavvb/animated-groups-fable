// pattern-glue.js — the Pattern pane of PQRS pillows: Two features, two handles' pane as it is (createPattern fed
// buildPatternModel(state)), with this page's quiet marking of the active partition, and the stillness of a flip.
//
//   const glue = createPatternGlue(canvas, { tip });
//   glue.show(state, { keepView })     draw the state (keepView: a slider moved; without it the pattern's first view)
//   glue.still(invQ)                   BEFORE show(next) on a flip: the picture stays where it is (view <- view . invQ,
//                                      as Two features, two handles' page.js pickPair does); still(invQ, next) does both
//   glue.reset()                       the pattern's first view
//   glue.redraw()                      after the pane was hidden (a tab), or resized
//   glue.pattern                       the createPattern object (state(), getView(), readPatch(): for checks)
//
// What is changed in the model (pairModel), and nothing else:
//   marks   the active partition's FIRST pair stays the engine's "brought out" pair: blue #0072B2, larger. Its SECOND
//           pair is painted orange #D55E00, smaller: the pane paints a corner class blue when its kind is 'cone' and
//           #D55E00 otherwise (pattern-ext.js drawMarks, pattern-gl.js isCone), so the second pair's two classes are
//           handed over with another kind ('cone-far'), on a copy: the engine's own objects are not touched.
//   lines   the two seals (the engine's treeSeg, farTreeSeg) thin, each in its pair's colour; the loop (cutSeg) thin,
//           ink at 60 %, not dashed. Three lines a tile, as the engine's own model has: the WebGL path keeps its room.
//   dots    none.

import {
  buildPatternModel, centredFor, GE, psuMul, psuInv, psuApplyDisc, psuToSO21, so21ToPSU,
} from '../../two-features-two-handles/src/handles.js';
import { createPattern, locateTilePSU } from '../../two-features-two-handles/src/pattern-ext.js';
import { mul, apply, det, I3 } from '../../classification-of-surfaces/src/sym/geom.js';

export const PAIR_BLUE = [0, 0.447, 0.698];        // #0072B2
export const PAIR_ORANGE = [0.835, 0.369, 0];      // #D55E00
const INK = [0.08, 0.09, 0.12];
export const SEAL_WIDTH = 1.7, LOOP_WIDTH = 1.2, LOOP_ALPHA = 0.6;

/** The engine's model of a state with this page's marks and lines (see the head of the file). Pure. */
export function pairModel(state, { dark = false } = {}) {
  const model = buildPatternModel(state, { dark });
  const built = centredFor(state, { dark });
  const A = model.A, first = new Set(model.marks || []);
  const classes = A.classes.map((c) => (c.n > 1 && c.kind === 'cone' && !first.has(c.id) ? { ...c, kind: 'cone-far' } : c));
  const lines = [];
  if (built.cutSeg) lines.push({ a: built.cutSeg[0], b: built.cutSeg[1], color: INK, width: LOOP_WIDTH, alpha: LOOP_ALPHA, steps: 8, role: 'loop' });
  if (built.farTreeSeg) lines.push({ a: built.farTreeSeg[0], b: built.farTreeSeg[1], color: PAIR_ORANGE, width: SEAL_WIDTH, alpha: 1, steps: 6, role: 'seal1' });
  if (built.treeSeg) lines.push({ a: built.treeSeg[0], b: built.treeSeg[1], color: PAIR_BLUE, width: SEAL_WIDTH, alpha: 1, steps: 6, role: 'seal0' });
  return { ...model, A: { ...A, classes }, lines, dots: [] };
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
  let pendingV = null;          // a flip is under way: the view the next model must be shown in

  /** The picture stays: the next show() draws its state where this one's pattern lies. */
  function still(invQ, nextState = null, o = {}) {
    const before = pendingV ? { V: pendingV } : pattern.getView();
    if (before && invQ && kind) {
      pendingV = kind === 'H'
        ? psuToSO21(psuMul(so21ToPSU(before.V, det(before.V) < 0), so21ToPSU(invQ, false)))
        : GE.fix(mul(before.V, invQ), 1);
    }
    if (nextState) show(nextState, o);
  }

  function show(state, { keepView = false } = {}) {
    const next = pairModel(state, { dark: isDark() }), nextKind = next.D.G.kind;
    if (pendingV && nextKind === kind) {
      // both draws happen in this task, so no frame shows the view the model starts with
      pattern.set(next);
      let V = pendingV;
      try { V = recentreStartView(V, next); } catch (err) { /* the bookkeeping is then done on the next set */ }
      pattern.setView({ V, base: I3.slice(), turned: false }, { moving: false, sync: true });
    } else {
      pattern.set(next, { keepView: !!keepView && nextKind === kind });
    }
    pendingV = null;
    model = next; kind = nextKind;
  }

  return {
    show,
    still,
    reset() { pendingV = null; pattern.resetView(); },
    redraw() { pattern.draw(); },
    pattern,
    get model() { return model; },
    get kind() { return kind; },
  };
}
