// test/plane-tiling-cover.test.js — the replication step as the plane view DRAWS it (the final fix, 10 Nov 2026; the
// tests-math verifier's finding 11: no test checked the drawn replication against the group or the real window).
// src/plane.js createPlaneView draws on a recording canvas (the same code the app runs, with the scene the app builds:
// src/app.js buildScene), and every frame is read back from its drawing calls and checked against the GROUP, apart from
// replicate.js's own plan (test/tiling-frame.lib.js analyseFrame, ported from dev/v4-tests-math-tiling-lib.mjs):
//   * every drawn copy outline is g(D) for an element g of the group, one of the window's tiles (elementsNear), once;
//   * every card is a tile of the window (settling) or h o m_i(s) for a side pairing g_i and s in [0, 1] (moving), and a
//     moving card leaves a parent that has landed (or lies outside the window);
//   * landed copies never overlap; from the end of the last layer on, and at u = 1, the drawn copies cover 2000 sampled
//     points of the window exactly once, and they are exactly the window's tiles;
//   * the set of landed copies only grows with u; at u = 1 - 1e-6 it is the set the plane draws at u = 1;
//   * in the middle of a phase the words name what the moving cards do.
// 17 groups x every preset x amp 0 / 1 x a laptop's pane, a phone's pane (226 px, with the replication's frame that the
// app sets there: setStepFrame) and one dragged cut. CONTROL: planted defects in copies of a frame's calls are caught.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS } from '../src/groups.js';
import { createPlaneView, CAPTION_SMALL } from '../src/plane.js';
import { motifFor } from '../src/motif.js';
import { buildScene, presetState } from '../src/app.js';
import { recordingCanvas, analyseFrame, sidePairings, expectedWords, captionKinds } from './tiling-frame.lib.js';

function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The insets the app reserves on a phone's plane while the step shows (src/app.js STEP_INSETS). */
const PHONE_FRAME = { top: 30, bottom: 48 };
const SIZES = [[620, 580, null], [226, 226, PHONE_FRAME]];

/** One case: every frame of the replication of one scene in one pane. Returns { frames, problems: [..], ... }. */
function runCase(g, sc, [W, H, frame], label, controls) {
  const snow = g.fold === 'snowflake', sides = sidePairings(sc.domain), out = { frames: 0, problems: [], words: 0, cards: 0, moving: 0 };
  const { canvas, rec } = recordingCanvas(W, H);
  const P = createPlaneView(canvas, { hint: false });
  P.setScene({ group: g, domain: sc.domain, motif: motifFor(g), star: sc.star || undefined, interactive: !snow });
  if (frame) P.setStepFrame(frame);
  P.setTiling(0);
  const plan = P.tilingPlan();
  const lastLayer = plan.stops.length >= 2 ? plan.stops[plan.stops.length - 2].t : 0;
  const us = new Set([0, 1e-6, 0.5, 1 - 1e-6, 1, Math.min(1 - 1e-6, lastLayer + 1e-6)]);
  for (const ph of plan.phases) { us.add(ph.t0 + 0.3 * (ph.t1 - ph.t0)); us.add((ph.t0 + ph.t1) / 2); }
  for (const stp of plan.stops) { us.add(Math.max(0, stp.t - 1e-6)); us.add(Math.min(1, stp.t + 1e-6)); }
  const list = [...us].filter((u) => u >= 0 && u <= 1).sort((a, b) => a - b);
  let prevKeys = null;
  const endKeys = {}, rnd = prng(17 + label.length);
  for (const u of list) {
    P.setTiling(u);
    rec.calls.length = 0;
    P.render();
    const o = P.toWorld(W / 2, H / 2), o1 = P.toWorld(W / 2 + 1, H / 2);
    const view = { W, H, cx: o[0], cy: o[1], s: 1 / (o1[0] - o[0]) };
    const end = u >= lastLayer + 1e-7;
    const r = analyseFrame(rec.calls, view, { group: g, domain: sc.domain, sides, rnd, points: end ? 2000 : 200 });
    out.frames++; out.cards += r.cards; out.moving += r.cardsMoving;
    const local = [...new Set(r.problems)];
    const hist = r.cover.hist, over = Object.keys(hist).filter((n) => Number(n) > 1).reduce((a, n) => a + hist[n], 0);
    if (over) local.push(`${over} sampled points lie in 2+ drawn copies`);
    const keys = new Set(r.keys);
    if (end) {
      if (hist[0]) local.push(`at the end ${hist[0]} of ${r.cover.points} sampled points lie in no drawn copy`);
      if (r.copies !== r.want) local.push(`at the end ${r.copies} copies are drawn, the window has ${r.want} tiles`);
      if (u === 1 - 1e-6) endKeys.before = keys;
      if (u === 1) endKeys.after = keys;
    }
    if (prevKeys) for (const k of prevKeys) if (!keys.has(k)) { local.push(`a landed copy is gone at u = ${u}`); break; }
    const ph = plan.phases.find((p) => Math.abs(u - (p.t0 + p.t1) / 2) < 1e-12);
    if (ph && r.motions && r.motions.length) {
      const cap = P.tilingCaption(u), exp = expectedWords(r.motions, g), small = Math.min(W, H) < CAPTION_SMALL;
      out.words++;
      if (ph.wave === 1 && !small && cap !== exp.long) local.push(`the words "${cap}" but the cards do "${exp.long}"`);
      const ck = captionKinds(cap), same = ck && ck.size === exp.kinds.size && [...ck].every((k) => exp.kinds.has(k));
      if (!(small && ph.wave >= 2) && !same) local.push(`the words "${cap}" name other kinds than the cards do (${[...exp.kinds].join('; ')})`);
    }
    // CONTROL: on the first case of the run, planted defects in copies of the calls must be caught
    if (controls && !controls.done && end && u === 1 - 1e-6) {
      const clone = () => rec.calls.map((c) => ({ ...c, sub: c.sub.map((s2) => { const a = s2.map((p) => p.slice()); a.closed = s2.closed; a.curved = s2.curved; return a; }) }));
      const outlineCall = (cs) => cs.find((c) => c.op === 'stroke' && /^rgba\(138,138,147,/.test(c.strokeStyle.replace(/\s/g, '')));
      const run = (cs) => analyseFrame(cs, view, { group: g, domain: sc.domain, sides, rnd: prng(5), points: 2000 });
      let cs = clone(); outlineCall(cs).sub.splice(1, 1);
      controls.missing = (run(cs).cover.hist[0] || 0) > 0;
      cs = clone(); const oc = outlineCall(cs); oc.sub.push(oc.sub[2].map((p) => p.slice()));
      controls.twice = run(cs).problems.some((p) => /twice/.test(p));
      cs = clone(); const oc2 = outlineCall(cs), d = 0.3 * Math.sqrt(g.domainArea) * view.s; oc2.sub[3] = oc2.sub[3].map((p) => [p[0] + d, p[1]]);
      controls.slid = run(cs).problems.some((p) => /NOT in the group|not among/.test(p));
      controls.done = true;
    }
    if (controls && !controls.turnedDone && r.cardsMoving > 2 && u > 0.05) {
      const cs = rec.calls.map((c) => ({ ...c, sub: c.sub.map((s2) => { const a = s2.map((p) => p.slice()); a.closed = s2.closed; a.curved = s2.curved; return a; }) }));
      const c0 = Math.cos(0.05), s0 = Math.sin(0.05);
      for (const pc of cs.filter((c) => c.op === 'fill' && /^rgba\(255,255,255,/.test(c.fillStyle.replace(/\s/g, '')))) pc.sub = pc.sub.map((s2) => { const a = s2.map((p) => [c0 * p[0] - s0 * p[1], s0 * p[0] + c0 * p[1]]); a.closed = s2.closed; return a; });
      controls.turned = analyseFrame(cs, view, { group: g, domain: sc.domain, sides, rnd: prng(5), points: 200 }).problems.some((p) => /no h o m_i|not an affine|stretched|VISIBLE/.test(p));
      controls.turnedDone = true;
    }
    prevKeys = keys;
    for (const p of local) out.problems.push(`${label} u ${u.toFixed(6)}: ${p}`);
  }
  if (endKeys.before && endKeys.after && [...endKeys.before].sort().join(';') !== [...endKeys.after].sort().join(';')) out.problems.push(`${label}: the copies drawn at u = 1 - 1e-6 and at u = 1 differ`);
  P.destroy();
  return out;
}

test('the drawn replication is the group\'s tiling: every outline g(D) with g in G, once; every card a tile or h o m_i(s); no overlap; the end covers the window exactly once; the words name what moves — 17 groups, every preset, amp 0/1, a laptop and a phone pane (with the step\'s frame), one dragged cut', (t) => {
  let frames = 0, cases = 0, cards = 0, moving = 0, words = 0;
  const problems = [], controls = {};
  for (const g of GROUPS) {
    const snow = g.fold === 'snowflake', rnd = prng(4242 + g.id.length * 977 + g.id.charCodeAt(0) * 31);
    for (let pi = 0; pi < g.presets.length; pi++) {
      const st = presetState(g, pi);
      for (const amp of snow ? [0] : [0, 1]) {
        const sc = buildScene(g, { seed: st.seed, metric: st.metric, amp, anchor: st.anchor });
        for (const size of SIZES) {
          const r = runCase(g, sc, size, `${g.id} preset ${pi} amp ${amp} ${size[0]}x${size[1]}`, cases === 0 ? controls : null);
          frames += r.frames; cards += r.cards; moving += r.moving; words += r.words; cases++;
          problems.push(...r.problems);
        }
      }
      if (!snow && pi === 0) {
        const seed = [st.seed[0] + (2 * rnd() - 1) * 0.5 * g.viewHalf, st.seed[1] + (2 * rnd() - 1) * 0.5 * g.viewHalf];
        const sc = buildScene(g, { seed, metric: st.metric, amp: 0, anchor: st.anchor });
        const r = runCase(g, sc, SIZES[0], `${g.id} dragged ${seed.map((v) => v.toFixed(3)).join('/')}`, null);
        frames += r.frames; cards += r.cards; moving += r.moving; words += r.words; cases++;
        problems.push(...r.problems);
      }
    }
  }
  t.diagnostic(`${cases} cases, ${frames} frames, ${words} phases' words read against the cards; cards ${cards} (${moving} in motion)`);
  assert.equal(problems.length, 0, problems.slice(0, 8).join('\n') + (problems.length > 8 ? `\n... ${problems.length} problems` : ''));
  assert.ok(frames > 1500 && moving > 2000 && words > 300, `${frames} frames, ${moving} moving cards, ${words} words`);
  // the controls: planted defects in a frame's calls are caught
  assert.ok(controls.missing, 'control: a landed copy left out at the end is noticed (a hole)');
  assert.ok(controls.twice, 'control: a copy drawn twice is noticed');
  assert.ok(controls.slid, 'control: a copy slid by 0.3 tile sizes is noticed (not an element of the group)');
  assert.ok(controls.turned, 'control: cards turned by 0.05 rad about a wrong point are noticed');
});
