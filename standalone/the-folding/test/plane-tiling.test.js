// test/plane-tiling.test.js — the plane view's replication step (contract C2 addition, 10 Nov 2026; qa/rep-judge.md):
// setTiling / getTiling / tilingPlan / tilingCaption / options.onTilingPlan, checked without a browser on a canvas that
// records what is drawn (as test/plane.test.js does). The plan itself is checked in test/replicate.test.js.
//   u = 1        the plane as always: nothing of the replication is drawn or built, also after a replication was shown
//   the plan     built when the replication shows; its duration, stops and phases; the owner hears of it once per plan
//   the words    one phase's words at a time ('' at u = 1); the short words on a small pane
//   drawing      every group, every preset, straight and wavy, two pane sizes: every stage draws without an error
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID } from '../src/groups.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { createPlaneView, CAPTION_SMALL } from '../src/plane.js';

/** A canvas that records the drawing calls, each painting call with the styles it paints with. */
const PAINTS = { fill: ['fillStyle', 'globalAlpha'], fillRect: ['fillStyle', 'globalAlpha'], fillText: ['fillStyle', 'font', 'globalAlpha'],
  stroke: ['strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'globalAlpha', 'shadowColor', 'shadowBlur'], drawImage: ['globalAlpha'] };
const DEFAULTS = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalAlpha: 1,
  shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, font: '10px sans-serif' };
function fakeCanvas(w, h) {
  const calls = [], stack = [];
  let state = { ...DEFAULTS };
  const ctx = new Proxy({}, {
    get(t, prop) {
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 6.2 });
      if (prop === 'save') return () => { stack.push({ ...state }); calls.push({ op: 'save', args: [] }); };
      if (prop === 'restore') return () => { if (stack.length) state = stack.pop(); calls.push({ op: 'restore', args: [] }); };
      if (prop in state) return state[prop];
      return (...args) => {
        const c = { op: prop, args: args.map((a) => (typeof a === 'number' ? Math.round(a * 1e6) / 1e6 : a)) };
        for (const k of PAINTS[prop] || []) c[k] = state[k];
        calls.push(c);
      };
    },
    set(t, prop, v) { state[prop] = v; return true; },
  });
  const canvas = {
    width: w, height: h, clientWidth: w, clientHeight: h, style: {}, attrs: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    addEventListener() {}, removeEventListener() {},
    setAttribute(k, v) { this.attrs[k] = String(v); }, hasAttribute(k) { return k in this.attrs; },
  };
  return { canvas, calls };
}

function sceneOf(id, presetIndex = 0, amp = 0, seed) {
  const group = BY_ID[id], p = group.presets[presetIndex];
  const domain = buildDomain(group, { seed: seed || p.seed, metric: p.metric, warp: makeWarp(group, amp) });
  return { group, domain, interactive: group.fold !== 'snowflake' };
}
/** The calls of one render (the recorder is emptied first). */
function frame(P, calls) { calls.length = 0; P.render(); return calls.slice(); }

test('u = 1 is the plane as always: nothing of the replication is built or drawn, also after one was shown (and faded)', () => {
  for (const g of GROUPS) {
    for (const amp of g.fold === 'snowflake' ? [0] : [0, 1]) {
      for (const [w, h] of [[620, 580], [226, 226]]) {
        const sc = sceneOf(g.id, 0, amp), tag = `${g.id} amp ${amp} ${w}x${h}`;
        const A = fakeCanvas(w, h), plansA = [];
        const PA = createPlaneView(A.canvas, { hint: false, onTilingPlan: (i) => plansA.push(i) });
        PA.setScene(sc);
        const want = frame(PA, A.calls);
        assert.deepEqual(PA.getTiling(), { u: 1, fade: 0 }, `${tag}: a new view shows the tiling`);
        assert.equal(plansA.length, 0, `${tag}: no plan is built while u = 1`);
        assert.ok(want.length > 50, `${tag}: the plane draws`);
        // another view of the same scene: a replication shown at several stages, a replay's fade, then u = 1 again
        const B = fakeCanvas(w, h), plansB = [];
        const PB = createPlaneView(B.canvas, { hint: false, onTilingPlan: (i) => plansB.push(i) });
        PB.setScene(sc);
        const shown = [];
        for (const [u, f] of [[0, 0], [0.37, 0], [0.8, 0], [0.9999, 0], [1, 0.5], [1, 1]]) { PB.setTiling(u, f); shown.push(frame(PB, B.calls)); }
        assert.equal(plansB.length, 1, `${tag}: the owner hears of the plan once`);
        for (const f of shown) assert.notDeepEqual(f, want, `${tag}: a stage of the replication draws something else than the plane as always`);
        PB.setTiling(1, 0);
        assert.deepEqual(PB.getTiling(), { u: 1, fade: 0 });
        const back = frame(PB, B.calls);
        assert.deepEqual(back, want, `${tag}: u = 1 again draws exactly what a view that never replicated draws`);
        PA.destroy(); PB.destroy();
      }
    }
  }
});

test('the plan, its words and the owner\'s callback: stops in u, one phase\'s words at a time, the short words on a small pane', () => {
  for (const g of GROUPS) {
    const sc = sceneOf(g.id, 0, 0);
    const big = fakeCanvas(620, 580), small = fakeCanvas(300, 300), infos = [];
    const P = createPlaneView(big.canvas, { hint: false, onTilingPlan: (i) => infos.push(i) });
    const Q = createPlaneView(small.canvas, { hint: false });           // (its window is smaller: a plan of its own)
    assert.equal(P.tilingPlan(), null, `${g.id}: no scene, no plan`);
    assert.equal(P.tilingCaption(0), '', `${g.id}: no scene, no words`);
    P.setScene(sc); Q.setScene(sc);
    // the value: clamped, a non-number ignored
    P.setTiling(-1); assert.deepEqual(P.getTiling(), { u: 0, fade: 0 });
    P.setTiling(2, 7); assert.deepEqual(P.getTiling(), { u: 1, fade: 1 });
    P.setTiling(NaN); assert.deepEqual(P.getTiling(), { u: 1, fade: 1 }, `${g.id}: NaN changes nothing`);
    P.setTiling(0.5, 'x'); assert.deepEqual(P.getTiling(), { u: 0.5, fade: 0 });
    frame(P, big.calls);
    assert.equal(infos.length, 1, `${g.id}: the first frame of the replication builds the plan and says so`);
    const info = infos[0], plan = P.tilingPlan();
    assert.deepEqual(plan, info, `${g.id}: tilingPlan() is what the owner was told`);
    assert.ok(info.duration > 2 && info.duration < 10, `${g.id}: ${info.duration} s`);
    assert.ok(info.layers >= 2 && info.layers <= 14, `${g.id}: ${info.layers} layers`);
    assert.equal(info.stops[info.stops.length - 1].t, 1); assert.equal(info.stops[info.stops.length - 1].label, 'tiled');
    for (let i = 1; i < info.stops.length; i++) assert.ok(info.stops[i].t > info.stops[i - 1].t && info.stops[i].t <= 1, `${g.id}: the stops increase`);
    for (let i = 0; i < info.phases.length; i++) {
      const ph = info.phases[i];
      assert.ok(ph.t0 >= 0 && ph.t1 > ph.t0 && ph.t1 < 1 && (i === 0 || ph.t0 >= info.phases[i - 1].t1 - 1e-12), `${g.id}: phase ${i} in order`);
      assert.equal(P.tilingCaption((ph.t0 + ph.t1) / 2), ph.text, `${g.id}: the words in the middle of phase ${i}`);
    }
    const qinfo = Q.tilingPlan();
    for (let i = 0; i < qinfo.phases.length; i++) {
      const ph = qinfo.phases[i], short = Q.tilingCaption((ph.t0 + ph.t1) / 2);
      assert.ok(short.length > 3 && short.length <= ph.text.length, `${g.id}: phase ${i}'s short words "${short}" for "${ph.text}"`);
      if (ph.wave >= 2) assert.match(short, new RegExp(`^layer ${ph.wave} of ${qinfo.layers}$`), `${g.id}: a later layer's short words "${short}"`);
      else assert.doesNotMatch(short, /about|layer/, `${g.id}: a first-layer phase's short words name the kind alone: "${short}"`);
    }
    assert.ok(300 < CAPTION_SMALL && 580 >= CAPTION_SMALL, 'the panes are on either side of CAPTION_SMALL');
    assert.equal(P.tilingCaption(0), info.phases[0].text, `${g.id}: at u = 0 the first side pairing's words`);
    assert.equal(P.tilingCaption(1), '', `${g.id}: no words once the tiling is complete`);
    assert.equal(P.tilingCaption(), P.tilingCaption(0.5), `${g.id}: the words now`);
    // the first layer names its side pairing in orbifold terms
    assert.match(info.phases[0].text, /^(half-turns? about an? 2-fold centres?|rotations? by [±−]?\d?π(\/\d+)? about an? \d-fold centres?|reflections? in (a mirror|mirrors)|glide reflections?|translations?)$/,
      `${g.id}: "${info.phases[0].text}"`);
    // more frames of the same tile: no new plan
    for (const u of [0, 0.2, 0.6, 0.99]) { P.setTiling(u); frame(P, big.calls); }
    assert.equal(infos.length, 1, `${g.id}: one plan for one tile`);
    // a new tile (a dragged cut): a new plan; the owner hears of it if its timing differs
    if (g.fold !== 'snowflake') {
      const size = Math.sqrt(g.domainArea), p = g.presets[0].seed;
      P.setScene(sceneOf(g.id, 0, 0, [p[0] + 0.21 * size, p[1] - 0.13 * size]));
      frame(P, big.calls);
      const now = P.tilingPlan();
      const same = now.duration === info.duration && now.stops.length === info.stops.length && now.stops.every((s, i) => Math.abs(s.t - info.stops[i].t) < 1e-5);
      assert.equal(infos.length, same ? 1 : 2, `${g.id}: the owner hears of a new plan exactly when its timing changed`);
    }
    P.destroy(); Q.destroy();
  }
});

/** A canvas whose context only counts its calls and checks that every number handed to it is finite (fast). */
function checkingCanvas(w, h) {
  const out = { calls: 0, bad: null }, state = { ...DEFAULTS }, fns = new Map();
  const ctx = new Proxy({}, {
    get(t, prop) {
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 6.2 });
      if (prop in state) return state[prop];
      let f = fns.get(prop);
      if (!f) {
        f = (...args) => { out.calls++; for (const a of args) if (typeof a === 'number' && !Number.isFinite(a) && !out.bad) out.bad = `${String(prop)}(${args.join(', ')})`; };
        fns.set(prop, f);
      }
      return f;
    },
    set(t, prop, v) { state[prop] = v; if (typeof v === 'number' && !Number.isFinite(v) && !out.bad) out.bad = `${String(prop)} = ${v}`; return true; },
  });
  const canvas = {
    width: w, height: h, clientWidth: w, clientHeight: h, style: {}, attrs: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    addEventListener() {}, removeEventListener() {},
    setAttribute(k, v) { this.attrs[k] = String(v); }, hasAttribute(k) { return k in this.attrs; },
  };
  return { canvas, out };
}

test('every group, every preset, straight and wavy, a laptop\'s and a phone\'s pane: every stage of the replication draws, with finite numbers only', () => {
  let frames = 0;
  for (const g of GROUPS) {
    for (let pi = 0; pi < g.presets.length; pi++) {
      for (const amp of g.fold === 'snowflake' ? [0] : [0, 1]) {
        for (const [w, h] of [[620, 580], [226, 226]]) {
          const { canvas, out } = checkingCanvas(w, h);
          const P = createPlaneView(canvas, { hint: false });
          P.setScene(sceneOf(g.id, pi, amp));
          P.setTiling(0);
          const plan = P.tilingPlan();
          const us = [0, 1e-6, 0.5, 1 - 1e-6];
          for (const s of plan.stops) us.push(Math.max(0, s.t - 1e-6), Math.min(1, s.t + 1e-6));
          for (const ph of plan.phases) us.push(ph.t0, (ph.t0 + ph.t1) / 2);
          for (const u of us) {
            P.setTiling(u);
            const before = out.calls;
            P.render();
            const tag = `${g.id} preset ${pi} amp ${amp} ${w}x${h} u ${u}`;
            assert.ok(out.calls - before > 20, `${tag}: ${out.calls - before} calls`);
            assert.equal(out.bad, null, `${tag}: ${out.bad}`);
            frames++;
          }
          P.setTiling(1, 0.5); P.render(); frames++;                  // a replay's fade
          assert.equal(out.bad, null);
          P.destroy();
        }
      }
    }
  }
  assert.ok(frames > 1000, `${frames} frames`);
});

// ---- the final fix (10 Nov 2026): a drag during the step, the quiet later layers, the step's frame on a phone -------
import { recordingCanvas, STYLE } from './tiling-frame.lib.js';
import { CLASS_COLORS } from '../src/palette.js';
import { STEP_PAD, STEP_SCALE, STEP_FRAME_MS } from '../src/plane.js';
import { sidePairingMotion } from '../src/replicate.js';

/** The centroids (css px) of the cards drawn in a frame: every subpath of a white paper fill. */
function cardCentroids(calls) {
  const out = [];
  for (const c of calls) {
    if (c.op !== 'fill' || !STYLE.paper.test(c.fillStyle.replace(/\s/g, ''))) continue;
    for (const sp of c.sub) { if (sp.curved || sp.length < 3) continue; let x = 0, y = 0; for (const p of sp) { x += p[0]; y += p[1]; } out.push([x / sp.length, y / sp.length]); }
  }
  return out;
}
/** The largest distance from a card of one frame to the nearest card of the other (both ways); Infinity if one has none. */
function cardJump(A, B) {
  if (!A.length && !B.length) return 0;
  if (!A.length || !B.length) return Infinity;
  const one = (X, Y) => Math.max(...X.map((p) => Math.min(...Y.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])))));
  return Math.max(one(A, B), one(B, A));
}
/** A paused replication of a scene, dragged by the person in 1-px pointer steps: per step the plan's length, the
 *  first layer's words and the cards drawn. `timing`: setTilingTiming (the control). */
function dragWhilePaused(id, seed, dirPx, steps, { timing = null, phase = 1 } = {}) {
  const g = BY_ID[id], p = g.presets[0];
  const { canvas, rec, dispatch } = recordingCanvas(620, 580);
  let P = null, prev = null;
  const build = (s) => buildDomain(g, { seed: s, metric: p.metric, warp: makeWarp(g, 0) });
  P = createPlaneView(canvas, { hint: false, onSeed: (x, y) => { const D = build([x, y]); P.setScene({ group: g, domain: D, interactive: true }); prev = D; } });
  if (timing) P.setTilingTiming(timing);
  prev = build(seed);
  P.setScene({ group: g, domain: prev, interactive: true });
  P.setTiling(0.5); P.render();
  const ph = P.tilingPlan().phases[phase], u = (ph.t0 + ph.t1) / 2;
  P.setTiling(u);
  const pairs = (D) => D.edges.map((e) => [e.g.a, e.g.b, e.g.c, e.g.d, e.g.tx, e.g.ty].map((v) => Math.round(v * 1e6)).join(',')).sort().join(';');
  const frameNow = () => { rec.calls.length = 0; P.render(); const plan = P.tilingPlan(); return { T: plan.duration, words: plan.phases.filter((q) => q.wave === 1).map((q) => q.text).join(' | '), cards: cardCentroids(rec.calls), seed: prev.seed.slice(), pairs: pairs(prev) }; };
  const out = [frameNow()];
  const x0 = 310, y0 = 290;
  dispatch('pointerdown', { clientX: x0, clientY: y0 });
  for (let k = 1; k <= steps; k++) { dispatch('pointermove', { clientX: x0 + k * dirPx[0], clientY: y0 + k * dirPx[1] }); out.push(frameNow()); }
  dispatch('pointerup', { clientX: x0 + steps * dirPx[0], clientY: y0 + steps * dirPx[1] });
  out.push(frameNow());
  P.destroy();
  return { u, frames: out };
}

test('finding 5: a drag while the replication is paused keeps it — the same length, the same first layer, no card jumps (control: the edge-index order jumps); the verifier\'s 333 drag and every group with a cut', (t) => {
  const rows = [];
  // the verifier's drag (qa/v4-fresh-eyes/E3-drag-jump-paused.png): 333 paused in its first layer, from (0.627, 0.064)
  // toward (0.641, 0.071): 4-px steps there renumbered the edges, and the copies jumped to another 3-fold centre
  const cases = [['333', [0.627, 0.064], [1, -0.5], 40, 1], ['333', [0.627, 0.064], [1, -0.5], 40, 0], ['2222', [0.373, 0.282], [1, -0.66], 40, 1]];
  for (const g of GROUPS) if (g.fold !== 'snowflake') cases.push([g.id, g.presets[0].seed, [0.8, 0.6], 30, 1]);
  let regrown = 0, stepsAll = 0;
  for (const [id, seed, dir, n, phase] of cases) {
    const { frames } = dragWhilePaused(id, seed, dir, n, { phase });
    let worst = 0, lengths = new Set(frames.map((f) => f.T.toFixed(9))), words = new Set(frames.map((f) => f.words));
    // (where the tile's side pairings themselves change — an edge shrinks away and another neighbour takes its place —
    // the first layer is made of other copies: a new plan, as a hinge fold hops when its walk sweeps a centre; counted)
    for (let k = 1; k < frames.length; k++) { stepsAll++; if (frames[k].pairs !== frames[k - 1].pairs) { regrown++; continue; } worst = Math.max(worst, cardJump(frames[k - 1].cards, frames[k].cards)); }
    const moved = Math.hypot(frames[frames.length - 1].seed[0] - frames[0].seed[0], frames[frames.length - 1].seed[1] - frames[0].seed[1]);
    rows.push(`${id} phase ${phase}: cards move <= ${worst.toFixed(2)} px per 1-px step, ${lengths.size} length(s), ${new Set(frames.map((f) => f.pairs)).size} set(s) of side pairings, the seed moved ${moved.toFixed(3)}`);
    assert.ok(moved > 0.01, `${id}: the drag moved the seed (${moved})`);
    assert.equal(lengths.size, 1, `${id}: the length changed during the drag: ${[...lengths].join(', ')}`);
    assert.ok(frames.every((f) => f.cards.length > 0), `${id}: a frame without a moving card`);
    // a 1-px step moves a card by about a pixel (the tile itself changes shape under the finger: allow 6)
    assert.ok(worst <= 6, `${id} phase ${phase}: a card jumps ${worst.toFixed(1)} px in a 1-px step of the drag`);
  }
  t.diagnostic(rows.join('\n'));
  t.diagnostic(`${regrown} of ${stepsAll} steps changed the tile's side pairings (a new plan there)`);
  assert.ok(regrown <= 0.05 * stepsAll, `${regrown} of ${stepsAll} steps changed the side pairings`);
  // the kept length was needed: along this drag of 2222 (the same side pairings throughout) the plan's own length
  // changes, a layer more in the window (5.70 -> 6.42 s); asked afresh at every step (setTilingTiming(null) lets go
  // of the kept length), the view re-times, which is what jumped before the fix
  {
    const g = BY_ID['2222'], p = g.presets[0], lens = [], pairsSeen = new Set();
    const { canvas, dispatch } = recordingCanvas(620, 580);
    let Q = null, D = null;
    const build = (s) => buildDomain(g, { seed: s, metric: p.metric, warp: makeWarp(g, 0) });
    Q = createPlaneView(canvas, { hint: false, onSeed: (x, y) => { D = build([x, y]); Q.setScene({ group: g, domain: D, interactive: true }); } });
    D = build(p.seed); Q.setScene({ group: g, domain: D, interactive: true });
    dispatch('pointerdown', { clientX: 310, clientY: 290 });
    for (let k = 0; k <= 40; k++) {
      if (k) dispatch('pointermove', { clientX: 310 + k, clientY: 290 - 0.5 * k });
      Q.setTiling(1); Q.setTilingTiming(null); Q.setTiling(0.3);
      lens.push(Q.tilingPlan().duration.toFixed(6));
      pairsSeen.add(D.edges.map((e) => [e.g.a, e.g.b, e.g.c, e.g.d, e.g.tx, e.g.ty].map((v) => Math.round(v * 1e6)).join(',')).sort().join(';'));
    }
    Q.destroy();
    t.diagnostic(`2222 along a drag, its own lengths: ${[...new Set(lens)].join(', ')} s (${pairsSeen.size} set(s) of side pairings)`);
    assert.ok(new Set(lens).size >= 2 && pairsSeen.size === 1, 'control: without the kept length this drag would re-time the replication');
    // and with it (the same drag, paused): one length
    const { frames } = dragWhilePaused('2222', p.seed, [1, -0.5], 40, { phase: 1 });
    assert.equal(new Set(frames.map((f) => f.T.toFixed(9))).size, 1, 'the kept length holds through that drag');
  }
  // CONTROL: the order before the fix (by edge index) makes the verifier's 333 drag jump
  const { frames } = dragWhilePaused('333', [0.627, 0.064], [1, -0.5], 40, { timing: { order: 'edge' }, phase: 1 });
  let worst = 0;
  for (let k = 1; k < frames.length; k++) if (frames[k].pairs === frames[k - 1].pairs) worst = Math.max(worst, cardJump(frames[k - 1].cards, frames[k].cards));
  assert.ok(worst > 30, `control: by edge index the 333 drag jumps (${worst.toFixed(1)} px)`);
});

test('findings 8, 10: the later layers\' cards are quiet — in a later layer the frame has no seam colour but the tile\'s own (the first layer\'s cards carry them)', () => {
  const coloured = (calls) => calls.filter((c) => c.op === 'stroke' && CLASS_COLORS.includes(String(c.strokeStyle))).length;
  let checked = 0;
  for (const g of GROUPS) {
    const sc = sceneOf(g.id, 0, 0);
    const { canvas, rec } = recordingCanvas(620, 580);
    const P = createPlaneView(canvas, { hint: false });
    P.setScene(sc);
    P.setTiling(0); rec.calls.length = 0; P.render();
    const own = coloured(rec.calls), plan = P.tilingPlan();
    const late = plan.phases.filter((p) => p.wave >= 3);
    if (late.length) {
      const ph = late[0], u = (ph.t0 + ph.t1) / 2;
      P.setTiling(u); rec.calls.length = 0; P.render();
      const cards = cardCentroids(rec.calls).length;
      assert.ok(cards > 0, `${g.id}: cards are drawn in layer ${ph.wave}`);
      assert.equal(coloured(rec.calls), own, `${g.id}: layer ${ph.wave}'s cards draw seam colours`);
      checked++;
    }
    // the first layer's cards still carry the seam colours (the explanation), where the tile has seams
    const f = plan.phases[0];
    P.setTiling((f.t0 + f.t1) / 2); rec.calls.length = 0; P.render();
    if (sc.domain.edges.some((e) => e.kind !== 'mirror')) assert.ok(coloured(rec.calls) > own, `${g.id}: the first layer's card has no seam colours`);
    P.destroy();
  }
  assert.ok(checked >= 12, `${checked} groups with a third layer`);
});

/** A window for the plane: requestAnimationFrame that the test steps by hand, a clock, the media queries. */
function fakeWindow() {
  const W = { now: 0, queue: [], id: 0 };
  W.win = {
    devicePixelRatio: 1,
    performance: { now: () => W.now },
    requestAnimationFrame: (f) => { W.queue.push(f); return ++W.id; },
    cancelAnimationFrame: () => {},
    matchMedia: () => ({ matches: false }),
  };
  W.step = (ms = 1000 / 60) => { W.now += ms; const q = W.queue; W.queue = []; for (const f of q) f(W.now); };
  return W;
}

test('findings 2, 6: on a phone\'s pane the step\'s frame shows the tile and its first layer\'s paths between the words and the bar, eases in and out smoothly, and gives back exactly the window as always', () => {
  const insets = { top: 30, bottom: 48 }, Wpx = 226, Hpx = 226;
  const rows = [];
  for (const g of GROUPS) {
    const sc = sceneOf(g.id, 0, 0);
    // 1. the frame (no window: it is there at once)
    const A = recordingCanvas(Wpx, Hpx), PA = createPlaneView(A.canvas, { hint: false });
    PA.setScene(sc); PA.render();
    const before = PA.getView(), baseCalls = (A.rec.calls.length = 0, PA.render(), JSON.stringify(A.rec.calls));
    PA.setStepFrame(insets); PA.setTiling(0.3); PA.render();
    const F = PA.getStepFrame();
    assert.ok(F.frame && F.mix === 1, `${g.id}: the frame is on`);
    // every point of the tile and of its first layer's copies along their whole paths (s by 0.05), on screen
    const ring = sc.domain.outline(Math.sqrt(g.domainArea) / 40);
    let lo = Infinity, hi = -Infinity, left = Infinity, right = -Infinity;
    const q = [0, 0];
    for (const e of sc.domain.edges) {
      const m = sidePairingMotion(g, e.g);
      for (let s = 0; s <= 1.0001; s += 0.05) {
        const M = m.at(Math.min(1, s));
        for (const o of ring) for (let i = 0; i < o.pts.length; i += 2) {
          PA.toCss(M.a * o.pts[i] + M.b * o.pts[i + 1] + M.tx, M.c * o.pts[i] + M.d * o.pts[i + 1] + M.ty, q);
          lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); left = Math.min(left, q[0]); right = Math.max(right, q[0]);
        }
      }
    }
    const atLeast = F.frame.s <= STEP_SCALE[0] * F.s0 + 1e-9;      // the scale's floor: the frame may not reach
    rows.push(`${g.id} ${(F.frame.s / F.s0).toFixed(2)}x: y ${lo.toFixed(0)}..${hi.toFixed(0)}, x ${left.toFixed(0)}..${right.toFixed(0)}`);
    if (!atLeast) {
      // between the words and the bar, inside the pane (the frame is fitted at a few times of the paths: STEP_PAD of slack)
      assert.ok(lo >= insets.top - 0.5 && hi <= Hpx - insets.bottom + 0.5 && left >= -0.5 && right <= Wpx + 0.5,
        `${g.id}: the first layer reaches y ${lo.toFixed(1)}..${hi.toFixed(1)} (free ${insets.top}..${Hpx - insets.bottom}), x ${left.toFixed(1)}..${right.toFixed(1)}`);
    }
    // 2. off again: exactly the window as always, and exactly its picture
    PA.setStepFrame(null); PA.setTiling(1); PA.render();
    const after = PA.getView();
    assert.ok(after.s === before.s && after.cx === before.cx && after.cy === before.cy, `${g.id}: the window as always is not given back exactly`);
    A.rec.calls.length = 0; PA.render();
    assert.equal(JSON.stringify(A.rec.calls), baseCalls, `${g.id}: the picture after the step's frame is not the picture before it`);
    PA.destroy();
    // 3. eased (with a window and its frames): the scale and the centre move in small, even steps, none at the ends
    if (['333', '2222', '*632', 'xx'].includes(g.id)) {
      const FW = fakeWindow(), B = recordingCanvas(Wpx, Hpx);
      B.canvas.ownerDocument = { defaultView: FW.win, createElement: () => recordingCanvas(Wpx, Hpx).canvas };
      const PB = createPlaneView(B.canvas, { hint: false });
      PB.setScene(sc); PB.render();
      const s0 = PB.getView().s, path = [];
      PB.setStepFrame(insets); PB.setTiling(0.3);
      for (let k = 0; k < 40; k++) { FW.step(); path.push(PB.getView()); }
      const target = PB.getStepFrame().frame;
      const last = path[path.length - 1];
      assert.ok(Math.abs(last.s - target.s) < 1e-9 && Math.abs(last.cx - target.cx) < 1e-9 && Math.abs(last.cy - target.cy) < 1e-9, `${g.id}: the frame is reached`);
      const steps = [];
      for (let k = 1; k < path.length; k++) steps.push(Math.abs(Math.log(path[k].s / path[k - 1].s)) + Math.hypot(path[k].cx - path[k - 1].cx, path[k].cy - path[k - 1].cy) * path[k].s / Wpx);
      const total = steps.reduce((a, b) => a + b, 0), big = Math.max(...steps), frames = Math.ceil(STEP_FRAME_MS / (1000 / 60));
      if (total > 1e-6) {
        assert.ok(big <= 2.2 * (total / frames), `${g.id}: a step of the frame's ease is ${big.toFixed(4)}, the mean ${(total / frames).toFixed(4)}`);
        assert.ok(steps[0] <= 0.25 * big && steps[frames - 2] <= 0.25 * big, `${g.id}: the ease starts and stops softly (${steps[0].toFixed(4)}, ${steps[frames - 2].toFixed(4)} against ${big.toFixed(4)})`);
      }
      // and back
      PB.setStepFrame(null);
      for (let k = 0; k < 40; k++) FW.step();
      const back = PB.getView();
      assert.ok(back.s === s0, `${g.id}: the scale as always is given back exactly`);
      PB.destroy();
    }
  }
  console.log('the step\'s frame on a 226-px pane (scale against the window as always; where the first layer reaches):\n  ' + rows.join('\n  '));
});
