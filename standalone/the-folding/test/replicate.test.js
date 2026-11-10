// test/replicate.test.js — the replication plan of src/replicate.js (node --test test/replicate.test.js; the whole suite:
// node tools/test-all.mjs).
//   exact       every copy is g(D) for an element of the group; it starts on its parent (A(0) = parent) and lands
//               exactly (A(1) = g); the planned copies cover every tile of the window, once (a random point of the
//               window lies in exactly one); the motion is continuous (no step of the corners larger than 3x the mean
//               step), and the timing is ordered;
//   the cards   what plane.js draws for a copy on its way (cardState) never jumps: no position step larger than 4x
//               the mean, opacity, face and lift steps <= 0.06;
//   the URL     tile=<u>;
//   the final fix (10 Nov 2026): the side pairings' order does not change under a drag (edgeKey; control: by edge
//               index it does), a kept length (opts.total) keeps the first layer and fills the rest, the later
//               layers' cards are quiet, and the words end when the last copy lands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID } from '../src/groups.js';
import { contains, elementsNear } from '../src/groups.js';
import { compose, apply } from '../src/geom.js';
import { buildDomain, makeWarp } from '../src/domain.js';
import { tileCopies, assignEdgeColors } from '../src/plane.js';
import { replicationPlan, copyState, cardState, planCaption, REP_TIMING, LOCK_RANGE } from '../src/replicate.js';

let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const close = (g, h, eps = 1e-9) => ['a', 'b', 'c', 'd', 'tx', 'ty'].every((k) => Math.abs(g[k] - h[k]) < eps);

function setup(group, p, amp, seedXY) {
  const D = buildDomain(group, { seed: seedXY || p.seed, metric: p.metric, warp: makeWarp(group, amp) });
  const seedA = D.seedActual;
  let rt = 0;
  for (const o of D.outline(Math.sqrt(group.domainArea) / 32)) {
    for (let i = 0; i < o.pts.length; i += 2) rt = Math.max(rt, Math.hypot(o.pts[i] - seedA[0], o.pts[i + 1] - seedA[1]));
  }
  const hw = group.viewHalf * 1.4, hh = group.viewHalf;          // a laptop-like window, wider than tall
  const win = { cx: seedA[0], cy: seedA[1], hw, hh };
  const region = { cx: seedA[0], cy: seedA[1], hw: hw + 0.6 * group.viewHalf, hh: hh + 0.6 * group.viewHalf };
  const plan = replicationPlan(group, D, { seedA, reach: rt, region, window: win });
  return { D, seedA, rt, win, plan };
}

test('the replication plan is exact for every group, preset, wave and a few dragged seeds', () => {
  const rows = [];
  for (const group of GROUPS) {
    const size = Math.sqrt(group.domainArea);
    for (let pi = 0; pi < group.presets.length; pi++) {
      const p = group.presets[pi];
      for (const amp of [0, 1]) {
        const seeds = [null];
        if (group.fold !== 'snowflake') for (let k = 0; k < 3; k++) seeds.push([p.seed[0] + (rnd() - 0.5) * 0.6 * size, p.seed[1] + (rnd() - 0.5) * 0.6 * size]);
        for (const s of seeds) {
          const { D, seedA, rt, win, plan } = setup(group, p, amp, s);
          const where = `${group.id} preset ${pi} amp ${amp} seed ${s ? s.map((v) => v.toFixed(3)) : 'preset'}`;
          // 1. every copy is an element of the group; parent and side pairing compose to it; A(0), A(1)
          for (const c of plan.copies) {
            assert.ok(contains(group, c.g), `${where}: copy ${c.index} is not in the group`);
            if (c.index === 0) continue;
            const par = plan.copies[c.parent];
            assert.ok(close(compose(par.g, plan.gens[c.gen].g), c.g), `${where}: copy ${c.index} is not parent ∘ g_${c.gen}`);
            assert.ok(close(compose(par.g, c.motion.at(0)), par.g, 1e-12), `${where}: copy ${c.index} does not start on its parent`);
            assert.strictEqual(c.motion.at(1), plan.gens[c.gen].g, `${where}: m(1) is not the side pairing itself`);
            assert.equal(c.depth, par.depth + 1);
          }
          // 2. every tile of the window is planned, within the layers the window gets
          const want = tileCopies(group, seedA, rt, win.cx, win.cy, win.hw, win.hh);
          const keys = new Map(plan.copies.map((c) => [c.key, c]));
          const key = (g) => { const r = (v) => Math.round(v * 1e6) || 0; return [g.a, g.b, g.c, g.d, g.tx, g.ty].map(r).join(','); };
          for (const g of want) {
            const c = keys.get(key(g));
            assert.ok(c, `${where}: a tile of the window is not planned`);
            assert.ok(c.depth <= plan.waves, `${where}: a tile of the window lands after the last layer`);
            assert.ok(c.t1 <= plan.T - plan.settle + 1e-9);
          }
          // 3. tiling: random points of the window lie in exactly one planned copy (straight coordinates)
          const E = D.edges;
          for (let k = 0; k < 60; k++) {
            const x = win.cx + (rnd() * 2 - 1) * win.hw, y = win.cy + (rnd() * 2 - 1) * win.hh;
            let n = 0;
            for (const c of plan.copies) {
              const g = c.g, dx = x - g.tx, dy = y - g.ty, u = g.a * dx + g.c * dy, v = g.b * dx + g.d * dy;
              let inside = true;
              for (let i = 0; i < E.length && inside; i++) if (E[i].nx * u + E[i].ny * v - E[i].c > 0) inside = false;
              if (inside) n++;
            }
            assert.equal(n, 1, `${where}: the point (${x}, ${y}) lies in ${n} copies`);
          }
          // 4. the motion is continuous: 200 steps of s, the polygon's corners never jump
          const q = [0, 0], r = [0, 0];
          for (const c of plan.copies) {
            if (c.index === 0 || c.depth > 2) continue;
            const par = plan.copies[c.parent];
            let steps = [], prev = null;
            for (let j = 0; j <= 200; j++) {
              const A = compose(par.g, c.motion.at(j / 200));
              const pts = D.poly.map((v) => apply(A, v[0], v[1], [0, 0]));
              if (prev) steps.push(Math.max(...pts.map((p2, i) => Math.hypot(p2[0] - prev[i][0], p2[1] - prev[i][1]))));
              prev = pts;
            }
            const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
            assert.ok(Math.max(...steps) <= 3 * mean + 1e-12, `${where}: copy ${c.index} jumps`);
          }
          // 5. timing and words
          for (let i = 0; i < plan.phases.length; i++) {
            const ph = plan.phases[i];
            assert.ok(ph.t1 > ph.t0 && (i === 0 || ph.t0 >= plan.phases[i - 1].t1 - 1e-12));
            assert.ok(typeof ph.text === 'string' && ph.text.length > 3, `${where}: phase ${i} has no words`);
          }
          for (const st of plan.stops) assert.ok(st.t > 0 && st.t <= 1);
          // the states: hidden before, landed after, exact at the end
          for (const c of plan.copies) {
            if (c.index === 0) continue;
            if (c.t1 > c.t0) assert.equal(copyState(plan, c, c.t0 - 1e-9).phase, 'hidden');
            const end = copyState(plan, c, plan.T);
            assert.equal(end.phase, 'landed');
            assert.strictEqual(end.A, c.g);                    // exactly the element, not a computed approximation
          }
          assert.equal(planCaption(plan, plan.T), '');
          if (!s && amp === 0) rows.push(`${group.id} p${pi}: ${plan.waves} layers, ${plan.phases.length} phases, ${plan.T.toFixed(2)} s, ${want.length} tiles; ${plan.phases.slice(0, 3).map((p2) => p2.text).join(' | ')}`);
        }
      }
    }
  }
  console.log(rows.join('\n'));
});

// The port (10 Nov 2026): what plane.js draws for a copy on its way (replicate.js cardState: where the card is, its
// opacity, which face is up, how high a flip lifts it) never jumps — not inside a phase, not where the copy leaves its
// parent (it appears there, transparent), not where it lands (the card lies exactly on its tile and fades into the
// plain tiling drawn under it), not at the end of its settle (gone at opacity 0). Sampled for every copy the window
// needs (the copies deeper than its layers land off screen and are never drawn: plane.js inView), 17 groups x every
// preset x amp 0 / 1 x the preset seed and a dragged one; 200 samples through the motion, 100 through the settle.
test('the cards are continuous: position, opacity, face and lift never jump, from leaving the parent to settling into the tiling', () => {
  let cards = 0, worstK = 0, worstPos = 0, flips = 0;
  for (const group of GROUPS) {
    const size = Math.sqrt(group.domainArea);
    for (let pi = 0; pi < group.presets.length; pi++) {
      const p = group.presets[pi];
      for (const amp of [0, 1]) {
        const seeds = [null];
        if (group.fold !== 'snowflake') seeds.push([p.seed[0] + (rnd() - 0.5) * 0.6 * size, p.seed[1] + (rnd() - 0.5) * 0.6 * size]);
        for (const s of seeds) {
          const { D, plan } = setup(group, p, amp, s);
          const where = `${group.id} preset ${pi} amp ${amp} seed ${s ? s.map((v) => v.toFixed(3)) : 'preset'}`;
          const corners = (A) => D.poly.map((v) => apply(A, v[0], v[1], [0, 0]));
          const far = (P, Q) => Math.max(...P.map((q, i) => Math.hypot(q[0] - Q[i][0], q[1] - Q[i][1])));
          for (const c of plan.copies) {
            if (c.index === 0 || c.phase < 0) continue;
            assert.ok(c.t1 > c.t0, `${where}: copy ${c.index} has no time to move`);
            const par = plan.copies[c.parent];
            // samples: just before its phase, 200 through the motion, 100 through the settle, just after
            const taus = [c.t0 - 1e-6];
            for (let j = 0; j <= 200; j++) taus.push(c.t0 + ((c.t1 - c.t0) * j) / 200);
            for (let j = 1; j <= 100; j++) taus.push(c.t1 + (plan.settle * j) / 100 - (j === 100 ? 1e-9 : 0));
            taus.push(c.t1 + plan.settle + 1e-6);
            let prev = null, prevPts = corners(par.g);
            const steps = [];
            for (const tau of taus) {
              const cs = cardState(plan, c, copyState(plan, c, tau));
              const cur = cs ? { k: cs.k, back: cs.back, lift: cs.lift } : { k: 0, back: null, lift: 0 };
              if (cs) {
                assert.ok(cs.k >= 0 && cs.k <= 1 && cs.back >= 0 && cs.back <= 1 && cs.lift >= 0 && cs.lift <= 1, `${where}: copy ${c.index} at ${tau}: ${JSON.stringify(cur)}`);
                const pts = corners(cs.A);
                steps.push(far(pts, prevPts));
                prevPts = pts;
              }
              if (prev) {
                const dk = Math.abs(cur.k - prev.k);
                worstK = Math.max(worstK, dk);
                assert.ok(dk <= 0.06, `${where}: copy ${c.index}'s opacity jumps by ${dk.toFixed(3)} at tau ${tau.toFixed(4)}`);
                if (cur.back !== null && prev.back !== null) assert.ok(Math.abs(cur.back - prev.back) <= 0.06, `${where}: copy ${c.index} turns its face at once at ${tau.toFixed(4)}`);
                assert.ok(Math.abs(cur.lift - prev.lift) <= 0.06, `${where}: copy ${c.index}'s lift jumps at ${tau.toFixed(4)}`);
              }
              prev = cur;
            }
            // the first card lies on the parent, the last one on the copy's own tile, exactly
            assert.equal(cardState(plan, c, copyState(plan, c, taus[0])), null, `${where}: copy ${c.index} shows before its phase`);
            assert.equal(cardState(plan, c, copyState(plan, c, taus[taus.length - 1])), null, `${where}: copy ${c.index} is still a card after its settle`);
            const first = cardState(plan, c, copyState(plan, c, c.t0));
            assert.ok(first && first.k === 0 && far(corners(first.A), corners(par.g)) < 1e-9 * size, `${where}: copy ${c.index} does not start on its parent, transparent`);
            const landing = cardState(plan, c, copyState(plan, c, c.t1));
            assert.ok(landing && landing.A === c.g && landing.k === 1 && landing.lift === 0, `${where}: copy ${c.index} does not land on g(D) at full strength`);
            // where it is: no step larger than 4 x the mean step of the motion (ease and the flip's sin π s: 2.95 at most)
            const moving = steps.filter((d) => d > 0);
            const mean = moving.reduce((a, b) => a + b, 0) / Math.max(1, moving.length);
            const big = Math.max(...steps);
            if (mean > 0) worstPos = Math.max(worstPos, big / mean);
            assert.ok(big <= 4 * mean + 1e-12, `${where}: copy ${c.index} (${c.motion.kind}) jumps: a step of ${(big / size).toFixed(4)} tile sizes, the mean ${(mean / size).toFixed(4)}`);
            if (c.motion.kind === 'reflection' || c.motion.kind === 'glide') flips++;
            cards++;
          }
        }
      }
    }
  }
  assert.ok(flips > 100 && cards > 1500, `${cards} cards, ${flips} flips`);
  assert.ok(REP_TIMING.lift > 0 && REP_TIMING.settle > 0);
  console.log(`cards ${cards} (flips ${flips}): the largest opacity step ${worstK.toFixed(4)}, the largest position step ${worstPos.toFixed(2)} x the mean`);
});

test('the URL carries the replication: tile=<u>, 3 decimals, absent at 1, between wavy and t', async () => {
  const { encodeHash, decodeHash, HASH_KEYS, WRAPPER_HASH } = await import('../src/app.js');
  assert.deepEqual(HASH_KEYS, ['g', 'cut', 'seed', 'wavy', 'tile', 't', 'view']);
  assert.equal(encodeHash({ g: '333' }), '#g=333', 'no tile: the tiling as always');
  assert.equal(encodeHash({ g: '333', tile: 1 }), '#g=333');
  assert.equal(encodeHash({ g: '333', tile: 0 }), '#g=333&tile=0');
  assert.equal(encodeHash({ g: '333', tile: 0.123456 }), '#g=333&tile=0.123');
  assert.equal(encodeHash({ g: '333', tile: 0.9996 }), '#g=333', 'rounds to 1: left out');
  assert.equal(encodeHash({ g: '4*2', cut: 1, wavy: 0.5, tile: 0.25, t: 0.5 }), '#g=4%2A2&cut=1&wavy=0.5&tile=0.25&t=0.5');
  assert.match(encodeHash({ g: '*632', tile: 0.4 }), WRAPPER_HASH);
  assert.equal(decodeHash('#g=333').tile, 1);
  assert.equal(decodeHash('#333').tile, 1, 'legacy links: tiled');
  assert.equal(decodeHash('#g=333&tile=0.25').tile, 0.25);
  assert.equal(decodeHash('#g=333&tile=7').tile, 1, 'clamped');
  assert.equal(decodeHash('#g=333&tile=-1').tile, 0, 'clamped');
  const bad = decodeHash('#g=333&tile=1e-3');
  assert.equal(bad.tile, 1); assert.deepEqual(bad.dropped, ['tile'], 'not a plain decimal: dropped');
  for (const u of [0, 0.001, 0.25, 0.5, 0.999]) assert.equal(decodeHash(encodeHash({ g: '22x', tile: u })).tile, u, 'round trip');
});

// ---- the final fix (10 Nov 2026): what a drag must not change --------------------------------------------------------
/** A plan for a domain with the plane's window, centred on `at` (so that two tiles of one drag share it). */
function planAt(group, D, at, timing, total) {
  const seedA = D.seedActual;
  let rt = 0;
  for (const o of D.outline(Math.sqrt(group.domainArea) / 32)) for (let i = 0; i < o.pts.length; i += 2) rt = Math.max(rt, Math.hypot(o.pts[i] - seedA[0], o.pts[i + 1] - seedA[1]));
  const hw = group.viewHalf * 1.4, hh = group.viewHalf;
  const win = { cx: at[0], cy: at[1], hw, hh };
  const region = { cx: at[0], cy: at[1], hw: hw + 0.6 * group.viewHalf, hh: hh + 0.6 * group.viewHalf };
  return replicationPlan(group, D, { seedA, reach: rt, region, window: win, timing, total });
}
const pairKey = (D) => D.edges.map((e) => { const r = (v) => Math.round(v * 1e6); return [e.g.a, e.g.b, e.g.c, e.g.d, e.g.tx, e.g.ty].map(r).join(','); }).sort().join(';');
/** The first layer as it plays: per phase, its side pairing (as a set of elements) — what the person sees act, in order. */
const firstLayer = (plan) => plan.phases.filter((p) => p.wave === 1).map((p) => plan.copies.filter((c) => c.phase === p.index).map((c) => c.key).sort().join('|'));
/** Who comes out of whom in the first two layers: copy key <- parent key. */
const parents = (plan) => new Map(plan.copies.filter((c) => c.depth >= 1 && c.depth <= 2).map((c) => [c.key, plan.copies[c.parent].key]));

test('finding 5: a drag keeps the order of the side pairings — the first layer plays the same turns in the same order, and every copy of the first two layers keeps its parent, while the tile\'s edges are renumbered (control: by edge index the order changes)', () => {
  let steps = 0, renumbered = 0, compared = 0;
  const rnd2 = (() => { let s = 777; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
  for (const group of GROUPS) {
    if (group.fold === 'snowflake') continue;
    const size = Math.sqrt(group.domainArea);
    for (const [pi, p] of group.presets.entries()) {
      for (const amp of [0, 1]) {
        const warp = makeWarp(group, amp), ang = 2 * Math.PI * rnd2();
        let prev = buildDomain(group, { seed: p.seed, metric: p.metric, warp });
        assignEdgeColors(prev, null);
        let prevPlan = planAt(group, prev, p.seed);
        for (let k = 1; k <= 24; k++) {
          const seed = [p.seed[0] + 0.006 * k * size * Math.cos(ang), p.seed[1] + 0.006 * k * size * Math.sin(ang)];
          const D = buildDomain(group, { seed, metric: p.metric, warp });
          assignEdgeColors(D, prev);
          const plan = planAt(group, D, p.seed);
          steps++;
          const where = `${group.id} preset ${pi} amp ${amp} step ${k}`;
          // the same side pairings (the same combinatorics): the same first layer, in the same order, the same parents
          if (pairKey(D) === pairKey(prev)) {
            if (D.edges.some((e, i) => !prev.edges[i] || e.g.tx !== prev.edges[i].g.tx || e.g.ty !== prev.edges[i].g.ty || e.g.a !== prev.edges[i].g.a)) renumbered++;
            assert.deepEqual(firstLayer(plan), firstLayer(prevPlan), `${where}: the first layer plays other turns, or in another order`);
            const a = parents(plan), b = parents(prevPlan);
            for (const [key, par] of a) if (b.has(key)) { compared++; assert.equal(par, b.get(key), `${where}: copy ${key} comes out of another parent`); }
          }
          prev = D; prevPlan = plan;
        }
      }
    }
  }
  assert.ok(steps > 500 && compared > 5000 && renumbered > 20, `${steps} steps, ${compared} parents compared, ${renumbered} steps renumbered the edges`);
  // CONTROL: the verifier's drag of 333 (qa/v4-fresh-eyes/E3-drag-jump-paused.png): one 4-px step, the same side
  // pairings, renumbered edges. By edge index (the order before the fix) the first layer swaps its turns; now it does not.
  const g = BY_ID['333'];
  const D1 = buildDomain(g, { seed: [0.627, 0.064], warp: makeWarp(g, 0) }), D2 = buildDomain(g, { seed: [0.641, 0.071], warp: makeWarp(g, 0) });
  assignEdgeColors(D1, null); assignEdgeColors(D2, D1);
  assert.equal(pairKey(D1), pairKey(D2), 'the control drag keeps the side pairings');
  const at = [0.634, 0.0675];
  assert.notDeepEqual(firstLayer(planAt(g, D2, at, { order: 'edge' })), firstLayer(planAt(g, D1, at, { order: 'edge' })), 'control: by edge index the first layer reorders');
  assert.deepEqual(firstLayer(planAt(g, D2, at)), firstLayer(planAt(g, D1, at)), 'by edgeKey it does not');
  console.log(`order: ${steps} drag steps, ${renumbered} with renumbered edges, ${compared} parents kept`);
});

test('finding 5: a kept length (opts.total) — the first layer keeps its timing exactly, the later layers fill the rest, every copy still lands by the end; outside LOCK_RANGE the plan takes its own length', () => {
  let kept = 0, refused = 0;
  for (const group of GROUPS) {
    if (group.fold === 'snowflake') continue;
    const size = Math.sqrt(group.domainArea);
    for (const p of group.presets) {
      const D0 = buildDomain(group, { seed: p.seed, metric: p.metric, warp: makeWarp(group, 0) });
      const P0 = planAt(group, D0, p.seed);
      assert.equal(P0.locked, false, 'no length asked: the plan\'s own');
      for (const [dx, dy] of [[0.11, 0.07], [-0.09, 0.13], [0.2, -0.15]]) {
        const D = buildDomain(group, { seed: [p.seed[0] + dx * size, p.seed[1] + dy * size], metric: p.metric, warp: makeWarp(group, 0) });
        const own = planAt(group, D, p.seed), P = planAt(group, D, p.seed, undefined, P0.T);
        const where = `${group.id} ${p.name} (${dx}, ${dy})`;
        // the first layer is as in the plan's own timing
        const f1 = own.phases.filter((q) => q.wave === 1), g1 = P.phases.filter((q) => q.wave === 1);
        assert.deepEqual(g1.map((q) => [q.t0, q.t1]), f1.map((q) => [q.t0, q.t1]), `${where}: the first layer is re-timed`);
        if (P.locked) {
          kept++;
          assert.ok(Math.abs(P.T - P0.T) < 1e-9, `${where}: the length ${P.T} is not the kept ${P0.T}`);
          for (let i = 1; i < P.phases.length; i++) assert.ok(P.phases[i].t0 >= P.phases[i - 1].t1 - 1e-12 && P.phases[i].t1 > P.phases[i].t0, `${where}: phase ${i} out of order`);
          for (const c of P.copies) { assert.ok(c.t1 <= P.T - P.settle + 1e-9); if (c.index) assert.equal(copyState(P, c, P.T).phase, 'landed', `${where}: copy ${c.index} has not landed at the end`); }
          for (let i = 1; i < P.stops.length; i++) assert.ok(P.stops[i].t > P.stops[i - 1].t);
          assert.equal(P.stops[P.stops.length - 1].t, 1);
        } else {
          refused++;
          assert.ok(Math.abs(P.T - own.T) < 1e-9, `${where}: refused, the plan's own length`);
        }
      }
      // far outside the range: refused
      const far = planAt(group, D0, p.seed, undefined, 0.2 * P0.T);
      assert.ok(!far.locked && Math.abs(far.T - P0.T) < 1e-9, `${group.id}: a fifth of the length is refused`);
    }
  }
  assert.ok(kept > 60, `${kept} kept, ${refused} refused`);
  assert.ok(LOCK_RANGE[0] < 1 && LOCK_RANGE[1] > 1);
  console.log(`kept length: ${kept} plans kept it, ${refused} took their own`);
});

test('findings 8, 10: the cards of the later layers are quiet (cardState.quiet = 1 deeper than the split, 0 in the first layer), for their whole life', () => {
  let quiet = 0, loud = 0;
  for (const id of ['333', '2222', '*632', '4*2', 'xx', '22x', 'o']) {
    const group = BY_ID[id], { plan } = setup(group, group.presets[0], 0, null);
    for (const c of plan.copies) {
      if (c.index === 0 || c.phase < 0) continue;
      const want = c.depth > plan.timing.split ? 1 : 0;
      for (const tau of [c.t0, (c.t0 + c.t1) / 2, c.t1, c.t1 + plan.settle / 2]) {
        const cs = cardState(plan, c, copyState(plan, c, tau));
        if (!cs) continue;
        assert.equal(cs.quiet, want, `${id}: copy ${c.index} (layer ${c.depth}) at ${tau}: quiet ${cs.quiet}`);
        if (want) quiet++; else loud++;
      }
    }
  }
  assert.ok(quiet > 500 && loud > 40, `${quiet} quiet card states, ${loud} in the first layer`);
});

test('finding 14: the words end when the last copy has landed (plan.landed), not after its settle', () => {
  for (const group of GROUPS) {
    const { plan } = setup(group, group.presets[0], 0, null);
    const last = plan.phases[plan.phases.length - 1];
    assert.ok(Math.abs(plan.landed - last.t1) < 1e-12 && plan.landed < plan.T, `${group.id}: landed ${plan.landed}, T ${plan.T}`);
    assert.equal(planCaption(plan, plan.landed - 1e-6), last.text, `${group.id}: the last phase's words until it lands`);
    assert.equal(planCaption(plan, plan.landed), '', `${group.id}: no words once every copy has landed`);
    assert.equal(planCaption(plan, (plan.landed + plan.T) / 2), '', `${group.id}: none while the last copies settle`);
    // what a layer is, said once: in the first later layer's words, not again
    const later = plan.phases.filter((p) => p.wave > plan.timing.split);
    if (later.length) {
      assert.match(later[0].text, new RegExp(`^layer ${later[0].wave} \\(words of length ${later[0].wave} in the side pairings\\) · `), `${group.id}: "${later[0].text}"`);
      for (const p of later.slice(1)) assert.match(p.text, new RegExp(`^layer ${p.wave} · `), `${group.id}: "${p.text}"`);
      for (const p of later) assert.equal(p.short, `layer ${p.wave} of ${plan.waves}`, `${group.id}: the short words of layer ${p.wave}`);
    }
  }
});
