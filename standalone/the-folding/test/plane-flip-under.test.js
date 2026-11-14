// test/plane-flip-under.test.js — the owner's comments of 13 Nov 2026 on the Tile step (** and 22*, checkerboard):
// "tiling should appear from below (away from camera) side to give the impression of yellow side being the reverse
// side" and "reverse side of the unfolding should look like it's coming from the reverse side".
//   replicate.js  cardState.under: 1 exactly while a copy that turns over (a reflection, a glide) moves; 0 for a turn or
//                 a slide, and for every settling card;
//   plane.js      such a card is drawn before the paper (the tile, and the landed copies on a white ground that hides it),
//                 with the paper's shade on it, deeper as it sinks; a turn or a slide passes over the tile; under a print
//                 a card of the first layer is the paper in its full tones (the front's teal, the back's sand: it never
//                 washes the tile out), a quiet card the plane's pale print on white.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID } from '../src/groups.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { createPlaneView } from '../src/plane.js';
import { replicationPlan, copyState, cardState } from '../src/replicate.js';
import { printFor } from '../src/pattern.js';
import { PRINT_FRONT, PRINT_BACK, INK, GROUND, hexToRgb } from '../src/palette.js';
import { recordingCanvas } from './tiling-frame.lib.js';

const FLIPS = new Set(['reflection', 'glide']);

function planOf(group, amp = 0) {
  const p = group.presets[0];
  const D = buildDomain(group, { seed: p.seed, metric: p.metric, warp: makeWarp(group, amp) });
  const seedA = D.seedActual;
  let rt = 0;
  for (const o of D.outline(Math.sqrt(group.domainArea) / 32)) {
    for (let i = 0; i < o.pts.length; i += 2) rt = Math.max(rt, Math.hypot(o.pts[i] - seedA[0], o.pts[i + 1] - seedA[1]));
  }
  const hw = group.viewHalf * 1.4, hh = group.viewHalf;
  const win = { cx: seedA[0], cy: seedA[1], hw, hh };
  const region = { cx: seedA[0], cy: seedA[1], hw: hw + 0.6 * group.viewHalf, hh: hh + 0.6 * group.viewHalf };
  return replicationPlan(group, D, { seedA, reach: rt, region, window: win });
}

test('a copy that turns over turns under the paper: under = 1 exactly while a reflection or a glide moves; 0 for a turn or a slide and for every settling card', () => {
  let flips = 0, others = 0, settles = 0;
  for (const group of GROUPS) {
    for (const amp of [0, 1]) {
      const plan = planOf(group, amp);
      for (const c of plan.copies) {
        if (c.index === 0 || c.phase < 0) continue;
        const flip = FLIPS.has(c.motion.kind);
        for (let j = 1; j < 20; j++) {
          const tau = c.t0 + ((c.t1 - c.t0) * j) / 20, cs = cardState(plan, c, copyState(plan, c, tau));
          assert.ok(cs, `${group.id}: copy ${c.index} shows while it moves`);
          assert.equal(cs.under, flip ? 1 : 0, `${group.id}: copy ${c.index} (${c.motion.kind}) at ${j}/20`);
          if (!flip) assert.equal(cs.lift, 0, `${group.id}: a ${c.motion.kind} stays in the plane`);
        }
        const st = cardState(plan, c, copyState(plan, c, c.t1 + 0.5 * plan.settle));
        assert.ok(st && st.under === 0 && st.lift === 0, `${group.id}: copy ${c.index} settles in the plane`);
        if (flip) flips++; else others++;
        settles++;
      }
    }
  }
  assert.ok(flips > 50 && others > 50 && settles > 100, `${flips} flips, ${others} turns and slides`);
});

const rgbaRe = (hex) => { const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 255)); return new RegExp(`^rgba\\(${r},${g},${b},([0-9.e-]+)\\)$`); };
const FRONT_PAPER = rgbaRe(PRINT_FRONT[0]), BACK_PAPER = rgbaRe(PRINT_BACK[0]), SHADE = rgbaRe(INK);

/** The plane of group id under the checkerboard, laptop-sized, and a frame at u. */
function planeOf(id) {
  const g = BY_ID[id], p = g.presets[0];
  const { canvas, rec } = recordingCanvas(620, 580);
  const P = createPlaneView(canvas, { hint: false });
  P.setScene({ group: g, domain: buildDomain(g, { seed: p.seed, metric: p.metric, warp: makeWarp(g, 0) }), interactive: g.fold !== 'snowflake', print: printFor(g, 'checker') });
  const frame = (u) => { P.setTiling(u); rec.calls.length = 0; P.render(); return rec.calls.filter((c) => c.op === 'fill').map((c) => ({ ...c, st: c.fillStyle.replace(/\s/g, '') })); };
  return { g, P, frame };
}

test('plane: a flip is drawn under the paper, sand side up once past edge-on, shaded; a turn or a slide over the tile; the tile keeps its colours (**, 22*, *x, xx, *2222, 2*22, 4*2)', () => {
  let flipsSeen = 0, oversSeen = 0;
  for (const id of ['**', '22*', '*x', 'xx', '*2222', '2*22', '4*2']) {
    const { P, frame } = planeOf(id);
    const plan = P.tilingPlan();
    for (const ph of plan.phases.filter((q) => q.wave === 1)) {
      const flip = /reflection/.test(ph.text);
      // past edge-on (the face that is up is the back) and before the landing
      const fills = frame(ph.t0 + 0.72 * (ph.t1 - ph.t0));
      const tile = fills.findIndex((c) => c.st === PRINT_FRONT[0]);
      assert.ok(tile >= 0, `${id} ${ph.text}: the tile's paper`);
      assert.equal(fills.filter((c) => c.st === PRINT_FRONT[0]).length, 1, `${id}: one tile`);
      if (flip) {
        // (the face that is up past edge-on is the hand of the tile it lands on: the back's sand for the default cuts)
        const card = fills.findIndex((c) => BACK_PAPER.test(c.st));
        assert.ok(card >= 0, `${id} ${ph.text}: the card shows the back (sand) past edge-on`);
        assert.ok(card < tile, `${id} ${ph.text}: the card is drawn before the tile's paper (under it)`);
        const ground = fills.findIndex((c) => c.st === GROUND && c.sub.every((s) => !s.curved));
        assert.ok(ground > card && ground < tile, `${id} ${ph.text}: the paper's white ground lies over the card, under the tile's print`);
        const shade = fills.findIndex((c, i) => i > card && i < tile && SHADE.test(c.st) && Number(SHADE.exec(c.st)[1]) > 0);
        assert.ok(shade > card, `${id} ${ph.text}: the paper's shade lies on the card`);
        flipsSeen++;
      } else {
        const card = fills.findIndex((c) => FRONT_PAPER.test(c.st) || BACK_PAPER.test(c.st));
        assert.ok(card > tile, `${id} ${ph.text}: a turn or a slide passes over the tile`);
        assert.ok(fills.every((c) => c.st !== GROUND || c.sub.some((s) => s.curved)), `${id} ${ph.text}: no ground under the copies while no card is under them`);
        oversSeen++;
      }
    }
    P.destroy();
  }
  assert.ok(flipsSeen >= 10 && oversSeen >= 4, `${flipsSeen} flips, ${oversSeen} turns and slides`);
});

test('plane: under a print a card of the first layer is the paper in its full tones, a quiet card of a later layer the pale print on white', () => {
  for (const id of ['**', '2222', '*2222']) {
    const { P, frame } = planeOf(id);
    const plan = P.tilingPlan();
    const first = plan.phases[0], late = plan.phases[plan.phases.length - 1];
    assert.ok(late.wave >= 2, `${id}: a later layer`);
    const a = frame((first.t0 + first.t1) / 2);
    assert.ok(a.some((c) => FRONT_PAPER.test(c.st) || BACK_PAPER.test(c.st)), `${id}: the first layer's card is the paper`);
    const b = frame(late.t0 + 0.6 * (late.t1 - late.t0));
    const white = /^rgba\(255,255,255,([0-9.e-]+)\)$/;
    assert.ok(b.some((c) => white.test(c.st)), `${id}: a quiet card is white paper`);
    assert.ok(!b.some((c) => FRONT_PAPER.test(c.st) || BACK_PAPER.test(c.st)), `${id}: no card of layer ${late.wave} in the full tones`);
    P.destroy();
  }
});
