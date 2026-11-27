// moves.js — the motion of one zip in the Zip it up tab. playZip() plays a short sequence of phases on the stage and then
// calls done(), which draws the tidy state that follows. Each phase builds a scene of its own: everything that does
// not take part is drawn as it stands (view.js), the piece being zipped is drawn here, in motion.
//
//   one polygon zipped to itself     Figure 8.1 first: the polygon inflates into a ball with one hole
//   one rim, arrows opposite         the hole closes like a purse; unzipped arcs of rim stay as eyelets (8.4, 8.6)
//   one rim, arrows the same way     all of the rim zipped: the crosscap of the Zippers tab (8.4); with rim left over: two
//                                    flaps grow over the hole and meet with a half twist (8.7)
//   two rims                         the two holes grow tubes that meet (8.3); rim left over stays as an eyelet
//                                    where they meet (8.8, 8.9)
//   two polygons                     they turn their two arrows to each other, meet, and settle into one polygon (8.5)
// Before a zip runs, the edges slide round their rim to where the motion needs them ("prep"): the two zips large,
// the rest small. Sliding edges along a rim changes nothing.

import { addCell, roundHole } from '../geo/scene.js';
import { SIZES } from '../geo/layouts.js';
import { addCrosscapFeature, addTube } from '../geo/features.js';
import { flatSite } from '../geo/sites.js';
import { sub, norm, scale, addScaled, smooth, ramp } from '../geo/vec.js';
import { zips } from './engine.js';
import { buildScene, drawBallStatic, fillEmpty, rimKeys, holeRadius, slots, ballOf } from './view.js';
import { addPurse, addStrap, addInflate, addCornerPoly, regularCorners } from './parts.js';
import { wordLines } from './draw.js';
import { THEME } from '../theme.js';

const TAU = 2 * Math.PI;
const GAP = 0.22;            // a left-over stretch of rim keeps this share of the turn while a zip runs
const mod1 = (x) => ((x % 1) + 1) % 1;

// ---- placements: where each edge of a word sits on its rim, as fractions of a turn
const uniform = (m, phase = 0) => Array.from({ length: m }, (_, k) => ({ f0: phase + k / m, f1: phase + (k + 1) / m }));
/** Shift a cyclic placement by whole turns so that it runs in order and lies near `ref`. */
function unwrapTo(target, ref) {
  const out = [];
  let prevEnd = -Infinity;
  target.forEach((t, k) => {
    let f0 = t.f0, len = t.f1 - t.f0;
    if (k === 0) f0 += Math.round((ref[0].f0 + ref[0].f1) / 2 - (t.f0 + t.f1) / 2);
    else { f0 += Math.round(prevEnd - f0); while (f0 < prevEnd - 1e-9) f0 += 1; while (f0 - prevEnd > 1 - 1e-9) f0 -= 1; }
    out.push({ f0, f1: f0 + len });
    prevEnd = f0 + len;
  });
  return out;
}
const mix = (a, b, u) => a.map((x, k) => ({ f0: x.f0 + (b[k].f0 - x.f0) * u, f1: x.f1 + (b[k].f1 - x.f1) * u }));
const moved = (a, b) => a.some((x, k) => Math.abs(x.f0 - b[k].f0) > 1e-3 || Math.abs(x.f1 - b[k].f1) > 1e-3);
/** `count` edges laid evenly on [f0, f1]. */
const within = (f0, f1, count) => Array.from({ length: count }, (_, k) => ({ f0: f0 + ((f1 - f0) * k) / count, f1: f0 + ((f1 - f0) * (k + 1)) / count }));

/** Line specs' edges for a word at a placement; uncovered stretches of the rim are drawn in a quiet line. */
function edgesOf(rim, pl, colorOf, { skip = null, senses = null } = {}) {
  const out = [];
  rim.forEach((e, k) => {
    if (skip && skip.has(k)) return;
    out.push({ id: e.id, s: senses ? senses[k] : e.s, f0: pl[k].f0, f1: pl[k].f1, color: e.s ? colorOf(e.id) : THEME.ink });
  });
  const order = pl.map((p, k) => k).sort((x, y) => pl[x].f0 - pl[y].f0);
  for (let i = 0; i < order.length; i++) {
    const a = pl[order[i]], b = pl[order[(i + 1) % order.length]], end = i + 1 < order.length ? b.f0 : b.f0 + 1;
    if (end - a.f1 > 2e-3) out.push({ id: null, s: 0, f0: a.f1, f1: end, color: THEME.soft });
  }
  return out;
}

export function playZip(a) {
  const { stage } = a;
  if (stage.R.reducedMotion) return null;
  let phases;
  try { phases = plan(a); } catch (err) { if (typeof console !== 'undefined') console.warn('playZip: no motion for this zip', err); phases = []; }
  if (!phases.length) phases = [pulse(a)];
  let i = 0, stop = null, over = false;
  const next = () => {
    if (over) return;
    if (i >= phases.length) { over = true; a.done(); return; }
    const ph = phases[i++];
    const step = ph.enter();
    stop = stage.animate(ph.seconds, (u) => { if (step) step(u); }, next);
  };
  next();
  return {
    cancel() { over = true; if (stop) stop(); },
    finish() { if (over) return; over = true; if (stop) stop(); a.done(); },
  };
}

/** No motion to show (a ball takes a piece in): the two arrows stand out for a moment, then the picture changes. */
function pulse(a) {
  return { seconds: 0.7, enter: () => { const k = a.before.comps.length, built = buildScene(a.before, a.looks, { colorOf: a.colorOf, n: k > 2 ? 30 : 40, hot: () => a.id }); a.stage.setScene(built.scene, built.frame, false); return null; } };
}

/** For the tools: enter every phase of a zip and step through it at once, no clock. Returns how many phases ran. */
export function dryRun(a) {
  const phases = plan(a);
  for (const ph of phases) { const step = ph.enter(); for (const u of [0, 0.3, 0.6, 1]) { if (step) step(u); a.stage.refresh(); } }
  return phases.length;
}

function plan(a) {
  let [A, B] = zips(a.before).get(a.id);
  if (A.c !== B.c) return planJoin(a, A, B);
  const ci = A.c, comp = a.before.comps[ci], k = a.before.comps.length, n = k > 2 ? 30 : 40, slot = slots(k).list[ci];
  const phases = [];
  let looksNow = a.looks;
  if (looksNow[ci].kind === 'poly') {
    const rim = comp.rims[0];
    phases.push(inflatePhase(a, ci, slot, n, rim));
    looksNow = a.looks.slice();
    looksNow[ci] = { kind: 'ball', rims: new Map([[rimKeys(comp)[0], 0]]), tubes: [], caps: [] };
  }
  if (A.r === B.r) phases.push(...sameRim(a, looksNow, ci, slot, n, A, B)); else phases.push(...twoRims(a, looksNow, ci, slot, n, A, B));
  phases.push({ seconds: a.info.gaping ? 1.0 : 0.45, enter: () => null });
  return phases;
}

/** A scene in which component ci is drawn by `draw(scene, L, taken, slot)` apart from its finished pieces. */
function sceneWith(a, looksNow, ci, n, skipKeys, draw) {
  const custom = new Map([[ci, (scene, comp, look, slot) => {
    const st = drawBallStatic(scene, comp, look, slot, n, { colorOf: a.colorOf, skipKeys });
    draw(scene, st.L, st.taken, slot);
    fillEmpty(scene, st.L, st.taken);
  }]]);
  const built = buildScene(a.before, looksNow, { colorOf: a.colorOf, n, custom });
  a.stage.setScene(built.scene, built.frame, false);
  return built.scene;
}

// ---- Figure 8.1
function inflatePhase(a, ci, slot, n, rim) {
  return {
    seconds: 1.35,
    enter: () => {
      let u = 0;
      const custom = new Map([[ci, (scene) => {
        const L = ballOf(slot, n, { rims: new Map([['', 0]]), tubes: [], caps: [] }), st = L.sites[0].site;
        const part = addInflate(scene, { center: slot.center, R: slot.R, m: rim.length, n0: st.n, e1: st.e1, e2: st.e2, rh: holeRadius(rim.length) * slot.R, progress: () => u });
        const pl = uniform(rim.length);
        scene.addLines((sc) => wordLines(sc, part.ring, part.n, edgesOf(rim, pl, a.colorOf), { size: 0.11 * slot.R, hot: () => a.id }));
      }]]);
      const built = buildScene(a.before, a.looks, { colorOf: a.colorOf, n, custom });
      a.stage.setScene(built.scene, built.frame, false);
      return (x) => { u = x; };
    },
  };
}

// ---- the edges slide to where the zip needs them; the hole takes the size the zip needs
function prepPhase(a, looksNow, ci, n, items, seconds = 0.5) {
  if (!items.some((it) => moved(it.from, it.to) || Math.abs(it.r0 - it.r1) > 1e-4)) return [];
  return [{
    seconds,
    enter: () => {
      let u = 0;
      sceneWith(a, looksNow, ci, n, new Set(items.map((it) => it.key)), (scene, L, taken, slot) => {
        for (const it of items) {
          taken.add(it.site);
          const cell = addCell(scene, { site: L.sites[it.site].site, boundary: L.sites[it.site].boundary, Rs: L.Rs, hole: roundHole(() => it.r0 + (it.r1 - it.r0) * smooth(u)) });
          scene.addLines((sc) => wordLines(sc, cell.rim, n, edgesOf(it.rim, mix(it.from, it.to, smooth(u)), a.colorOf), { size: 0.11 * slot.R, hot: () => a.id }));
        }
      });
      return (x) => { u = x; };
    },
  }];
}

// ---- one rim
function sameRim(a, looksNow, ci, slot, n, A, B) {
  if (A.p > B.p) [A, B] = [B, A];
  const comp = a.before.comps[ci], rim = comp.rims[A.r], m = rim.length, key = rimKeys(comp)[A.r], site = looksNow[ci].rims.get(key);
  const lenU = B.p - A.p - 1, lenW = m - 2 - lenU, r0 = holeRadius(m) * slot.R, midZ = (A.p + 0.5) / m;
  // the word as it lies now, read as one turn starting at z (edges before z in the list lie a turn further on)
  const from = uniform(m).map((x, k) => (k < A.p ? { f0: x.f0 + 1, f1: x.f1 + 1 } : x));
  const size = 0.11 * slot.R, skip = new Set([key]);
  // place the word: z, then U, then z', then W, each on its given stretch
  const place = (z, U, zz, W) => {
    const pl = new Array(m);
    pl[A.p] = z; pl[B.p] = zz;
    within(U[0], U[1], lenU).forEach((x, k) => { pl[A.p + 1 + k] = x; });
    within(W[0], W[1], lenW).forEach((x, k) => { pl[(B.p + 1 + k) % m] = x; });
    // unwrap in the word's own cyclic order, starting from z
    const order = []; for (let k = 0; k < m; k++) order.push((A.p + k) % m);
    const un = unwrapTo(order.map((k) => pl[k]), order.map((k) => from[k]));
    const out = new Array(m); order.forEach((k, i) => { out[k] = un[i]; });
    return out;
  };

  if (A.s !== B.s) {
    // the purse: gap W at the axis, z, gap U opposite, z'
    const gU = lenU ? GAP : 0, gW = lenW ? GAP : 0, axis = midZ - (0.5 + gW / 2 - gU / 2) / 2;
    const to = place({ f0: axis + gW / 2, f1: axis + 0.5 - gU / 2 }, [axis + 0.5 - gU / 2, axis + 0.5 + gU / 2], { f0: axis + 0.5 + gU / 2, f1: axis + 1 - gW / 2 }, [axis + 1 - gW / 2, axis + 1 + gW / 2]);
    return [
      ...prepPhase(a, looksNow, ci, n, [{ key, site, rim, from, to, r0, r1: r0 }]),
      {
        seconds: 1.3,
        enter: () => {
          let u = 0;
          sceneWith(a, looksNow, ci, n, skip, (scene, L, taken) => {
            taken.add(site);
            const cell = addPurse(scene, L, site, { r: r0, axisFrac: mod1(axis), gU, gW, progress: () => u });
            scene.addLines((sc) => wordLines(sc, cell.rim, n, edgesOf(rim, to, a.colorOf), { size, hot: () => a.id, arrows: () => 1 - ramp(u, 0.7, 0.95) }));
          });
          return (x) => { u = x; };
        },
      },
    ];
  }

  if (lenU + lenW === 0) {
    // all of the rim is zipped to itself crosswise: the crosscap of the Zippers tab
    return [{
      seconds: 1.5,
      enter: () => {
        let u = 0;
        sceneWith(a, looksNow, ci, n, skip, (scene, L, taken) => {
          taken.add(site);
          addCrosscapFeature(scene, L, site, { progress: () => u, color: a.colorOf(a.id), axis: TAU * from[A.p].f0, rh: r0, sense: A.s });
        });
        return (x) => { u = x; };
      },
    }];
  }

  // rim is left over: two flaps and a half twist
  const hw = n >= 40 ? 4 : 3, jz = Math.round(midZ * n), cz = jz / n, wz = (2 * hw) / n, rS = Math.max(r0, 0.3 * slot.R);
  const to = place({ f0: cz - wz / 2, f1: cz + wz / 2 }, [cz + wz / 2, cz + 0.5 - wz / 2], { f0: cz + 0.5 - wz / 2, f1: cz + 0.5 + wz / 2 }, [cz + 0.5 + wz / 2, cz + 1 - wz / 2]);
  const color = a.colorOf(a.id);
  return [
    ...prepPhase(a, looksNow, ci, n, [{ key, site, rim, from, to, r0, r1: rS }]),
    {
      seconds: 1.7,
      enter: () => {
        let u = 0;
        sceneWith(a, looksNow, ci, n, skip, (scene, L, taken) => {
          taken.add(site);
          const st = L.sites[site], cell = addCell(scene, { site: st.site, boundary: st.boundary, Rs: L.Rs, hole: roundHole(rS) });
          const strap = addStrap(scene, cell, st.site, { r: rS, n, jz, hw, bump: 0, progress: () => u });
          scene.addLines((sc) => wordLines(sc, cell.rim, n, edgesOf(rim, to, a.colorOf, { skip: new Set([A.p, B.p]) }), { size }));
          scene.addLines((sc) => strap.flaps.flatMap((fl, i) => stripEdge(sc, fl, color, (i === 0 ? A.s : B.s), size, 1 - ramp(u, 0.75, 0.95))));
        });
        return (x) => { u = x; };
      },
    },
  ];
}

/** The free end of a flap as a zip: its line, and an arrowhead lying in the flap. */
function stripEdge(sc, fl, color, sense, size, arrowAlpha) {
  const pts = [];
  for (let c = 0; c <= fl.cols; c++) pts.push(...sc.point(fl.end(c)));
  const out = [{ points: Float32Array.from(pts), color, width: 3, xray: 0.4 }];
  if (arrowAlpha > 0.01) {
    const c = fl.cols / 2, p = sc.point(fl.end(c)), t = scale(norm(sub(sc.point(fl.end(c + 1)), sc.point(fl.end(c - 1)))), sense);
    const back = sub(p, sc.point(fl.edge(fl.m - 1, c))), bl = Math.hypot(back[0], back[1], back[2]);
    if (bl > 1e-5) {
      const side = scale(back, 1 / bl), tip = addScaled(p, t, 0.5 * size), tail = addScaled(p, t, -0.4 * size);
      out.push({ points: Float32Array.from([...addScaled(tail, side, -0.45 * size), ...tip, ...addScaled(tail, side, 0.45 * size)]), color, width: 3.2, alpha: arrowAlpha, xray: 0.4 });
    }
  }
  return out;
}

// ---- two rims of one ball
function twoRims(a, looksNow, ci, slot, n, A, B) {
  const comp = a.before.comps[ci], look = looksNow[ci];
  const rimA = comp.rims[A.r], rimB = comp.rims[B.r], keys = rimKeys(comp), keyA = keys[A.r], keyB = keys[B.r];
  const sa = look.rims.get(keyA), sb = look.rims.get(keyB);
  const L0 = ballOf(slot, n, look);
  const jA = L0.sites[sa].toward.get(sb), jB = L0.sites[sb].toward.get(sa);
  if (jA === undefined || jB === undefined) return [];
  const isCross = A.s === B.s, gA = rimA.length > 1 ? GAP : 0, gB = rimB.length > 1 ? GAP : 0;
  const delta = gA || gB ? Math.PI * GAP : 0, back = 0.075 * slot.R;
  const cA = jA / n + 0.5, cB = isCross ? jB / n : jB / n - 0.5;      // the middle of each rim's left-over stretch
  const rT = (SIZES.rt + SIZES.f) * slot.R;
  const lay = (rim, p, c, g) => {
    const m = rim.length, order = []; for (let k = 0; k < m; k++) order.push((p + k) % m);
    const from = uniform(m).map((x, k) => (k < p ? { f0: x.f0 + 1, f1: x.f1 + 1 } : x));
    const raw = [{ f0: c + g / 2, f1: c + 1 - g / 2 }, ...within(c + 1 - g / 2, c + 1 + g / 2, m - 1)];
    const un = unwrapTo(raw, order.map((k) => from[k]));
    const to = new Array(m); order.forEach((k, i) => { to[k] = un[i]; });
    return { from, to };
  };
  const layA = lay(rimA, A.p, cA, gA), layB = lay(rimB, B.p, cB, gB);
  // where column c of a tube half ends: outside the window it is zipped, inside it stops short (the eyelet)
  const endOf = (g) => (c) => {
    const fc = c / n;
    if (g > 0 && Math.abs(fc - 0.5) < g / 2 - 1e-9) { const u = (fc - (0.5 - g / 2)) / g; return { psi: Math.PI - delta + 2 * delta * u, back: back * Math.sin(Math.PI * u) }; }
    const v = mod1(fc - (0.5 + g / 2)) / (1 - g);
    return { psi: Math.PI + delta + v * (TAU - 2 * delta), back: 0 };
  };
  // the word of a rim in the columns of its tube half: z first, then the rest in the window
  const columns = (rim, p, g, reversed) => {
    const m = rim.length, rest = []; for (let k = 1; k < m; k++) rest.push(rim[(p + k) % m]);
    const edges = [{ id: rim[p].id, s: reversed ? -rim[p].s : rim[p].s, f0: 0.5 + g / 2, f1: 1.5 - g / 2, color: a.colorOf(rim[p].id) }];
    const slotsIn = within(1.5 - g / 2, 1.5 + g / 2, m - 1);
    rest.forEach((e, k) => {
      const w = reversed ? slotsIn[m - 2 - k] : slotsIn[k];
      edges.push({ id: e.id, s: reversed ? -e.s : e.s, f0: w.f0, f1: w.f1, color: e.s ? a.colorOf(e.id) : THEME.ink });
    });
    return edges;
  };
  const size = 0.11 * slot.R;
  return [
    ...prepPhase(a, looksNow, ci, n, [
      { key: keyA, site: sa, rim: rimA, from: layA.from, to: layA.to, r0: holeRadius(rimA.length) * slot.R, r1: rT },
      { key: keyB, site: sb, rim: rimB, from: layB.from, to: layB.to, r0: holeRadius(rimB.length) * slot.R, r1: rT },
    ]),
    {
      seconds: 1.9,
      enter: () => {
        let u = 0;
        sceneWith(a, looksNow, ci, n, new Set([keyA, keyB]), (scene, L, taken) => {
          taken.add(sa); taken.add(sb);
          const tube = addTube(scene, L, sa, sb, { cross: isCross, progress: () => u, lines: false, endA: delta ? endOf(gA) : null, endB: delta ? endOf(gB) : null });
          const eA = columns(rimA, A.p, gA, false), eB = columns(rimB, B.p, gB, !isCross);
          const arrows = () => 1 - ramp(u, 0.8, 0.97);
          scene.addLines((sc) => wordLines(sc, tube.halfA.end, n, eA, { size, arrows, hot: () => a.id }));
          scene.addLines((sc) => wordLines(sc, tube.halfB.end, n, eB, { size, arrows, hot: () => a.id }));
        });
        return (x) => { u = x; };
      },
    },
  ];
}

// ---- two polygons become one (Figure 8.5)
/** The sides of a flat m-gon at `center`, as polylines in the plane: side k is the stretch of word edge k. */
function polyPaths(m, R, center) {
  const { pts, per } = regularCorners(m, R), C = pts.length, out = [];
  for (let k = 0; k < m; k++) { const path = []; for (let i = 0; i <= per; i++) { const p = pts[(k * per + i) % C]; path.push([center[0] + p[0], center[1] + p[1]]); } out.push(path); }
  return out;
}
/** N points round a closed chain of paths, the same number on each path. */
function sample(paths, K) {
  const out = [];
  for (const path of paths) for (let j = 0; j < K; j++) {
    const x = (j / K) * (path.length - 1), i = Math.min(path.length - 2, Math.floor(x)), t = x - i;
    out.push([path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t]);
  }
  return out;
}
const invWord = (w) => w.slice().reverse().map((e) => ({ id: e.id, s: -e.s || 0 }));

function planJoin(a, A, B) {
  if (a.looks[A.c].kind !== 'poly' || a.looks[B.c].kind !== 'poly') return [];
  const k = a.before.comps.length, S = slots(k), S2 = slots(k - 1);
  // P[0] and P[1] in the engine's order: when the arrows run the same way it is the second that is turned over
  const P = [A, B].map((X) => {
    const slot = S.list[X.c], word = a.before.comps[X.c].rims[0];
    return { ci: X.c, slot, word, m: word.length, p: X.p, paths: polyPaths(word.length, slot.R, slot.center), centre: slot.center.slice(0, 2) };
  });
  P[0].side = P[0].centre[0] <= P[1].centre[0] ? 0 : 1; P[1].side = 1 - P[0].side;      // 0: stands on the left
  const phases = [], z0 = P[0].slot.center[2] || 0;
  const drawBoth = (shapes) => new Map([
    [P[0].ci, (scene) => {
      for (const sh of shapes) {
        const K = Math.max(4, Math.round(120 / sh.word().length));
        const site = flatSite([0, 0, z0]);
        if (sh.lift) { const flat = site.toWorld; site.toWorld = (x, y, z, out, k2) => flat.call(site, x, y, z + sh.lift(), out, k2); }
        const poly = addCornerPoly(scene, { site, corners: () => sample(sh.paths(), K), K: 1, hub: sh.hub });
        scene.addLines((sc) => wordLines(sc, poly.ring, poly.n, edgesOf(sh.word(), uniform(sh.word().length), a.colorOf), { size: 0.11 * sh.R, hot: () => a.id }));
      }
    }],
    [P[1].ci, () => {}],
  ]);
  const show = (shapes) => { const built = buildScene(a.before, a.looks, { colorOf: a.colorOf, n: k > 2 ? 30 : 40, custom: drawBoth(shapes) }); a.stage.setScene(built.scene, built.frame, false); };

  // 1. if the two arrows run the same way, the right-hand piece is turned over
  const flipped = A.s === B.s;
  if (flipped) {
    const Q = P[1], cx = Q.centre[0];
    const mirrored = () => Q.paths.slice().reverse().map((path) => path.slice().reverse().map((p) => [2 * cx - p[0], p[1]]));
    const flippedWord = invWord(Q.word), flippedPaths = mirrored();
    let u = 0;
    phases.push({
      seconds: 0.55,
      enter: () => {
        const squash = (paths) => paths.map((path) => path.map((p) => [cx + (p[0] - cx) * Math.max(0.02, Math.abs(Math.cos(Math.PI * u))), p[1]]));
        show([
          { word: () => P[0].word, paths: () => P[0].paths, hub: () => P[0].centre, R: P[0].slot.R },
          { word: () => (u < 0.5 ? Q.word : flippedWord), paths: () => squash(u < 0.5 ? Q.paths : flippedPaths), hub: () => Q.centre, R: Q.slot.R },
        ]);
        return (x) => { u = x; };
      },
    });
    Q.word = flippedWord; Q.paths = flippedPaths; Q.p = Q.m - 1 - Q.p;
  }

  // 2. each piece turns its arrow toward the other and they meet half-way
  const reach = P.map((Q) => { const path = Q.paths[Q.p], e0 = path[0], e1 = path[path.length - 1], q = [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2]; return { dist: Math.hypot(q[0] - Q.centre[0], q[1] - Q.centre[1]), th: Math.atan2(q[1] - Q.centre[1], q[0] - Q.centre[0]) }; });
  // the first piece only turns where it stands; the second comes to it. M: the middle of the edge they will share
  const M = [P[0].centre[0] + (P[0].side === 0 ? reach[0].dist : -reach[0].dist), P[0].centre[1]];
  const hop = Math.abs(P[0].ci - P[1].ci) > 1 ? 0.5 * P[1].slot.R : 0;      // lift, when another piece stands in between
  const moves = P.map((Q, qi) => {
    const side = Q.side, dist = reach[qi].dist, th = reach[qi].th;
    let rot = (side === 0 ? 0 : Math.PI) - th;
    rot -= TAU * Math.round(rot / TAU);
    const to = [M[0] + (side === 0 ? -dist : dist), M[1]];
    return (path2, s) => { const c = Math.cos(rot * s), sn = Math.sin(rot * s), cx = Q.centre[0] + (to[0] - Q.centre[0]) * s, cy = Q.centre[1] + (to[1] - Q.centre[1]) * s; return path2.map((p) => { const x = p[0] - Q.centre[0], y = p[1] - Q.centre[1]; return [cx + x * c - y * sn, cy + x * sn + y * c]; }); };
  });
  const placed = (s) => P.map((Q, i) => Q.paths.map((path) => moves[i](path, s)));
  {
    let u = 0;
    phases.push({
      seconds: 0.8,
      enter: () => {
        show(P.map((Q, i) => ({ word: () => Q.word, paths: () => placed(smooth(u))[i], hub: () => moves[i]([Q.centre], smooth(u))[0], R: Q.slot.R, lift: i === 1 && hop ? () => hop * Math.sin(Math.PI * smooth(u)) : null })));
        return (x) => { u = x; };
      },
    });
  }

  // 3. one polygon: what is left of the two words, settling into a regular shape in its new place
  const merged = a.after.comps[a.info.to].rims[a.info.newRims[0]];
  if (merged && merged.length) {
    const fin = placed(1), union = [];
    for (let i = 1; i < P[0].m; i++) union.push(fin[0][(P[0].p + i) % P[0].m]);
    for (let i = 1; i < P[1].m; i++) union.push(fin[1][(P[1].p + i) % P[1].m]);
    const slot2 = S2.list[a.info.to], m2 = merged.length, target = polyPaths(m2, slot2.R, slot2.center);
    if (union.length === m2) {
      const K = Math.max(4, Math.round(120 / m2));
      let u = 0;
      const p0 = sample(union, K), p1 = sample(target, K), c1 = slot2.center;
      const polar = p0.map((p, i) => ({ r0: Math.hypot(p[0] - M[0], p[1] - M[1]), a0: Math.atan2(p[1] - M[1], p[0] - M[0]), r1: Math.hypot(p1[i][0] - c1[0], p1[i][1] - c1[1]), a1: Math.atan2(p1[i][1] - c1[1], p1[i][0] - c1[0]) }));
      let prev = 0;
      polar.forEach((q, i) => { let d = q.a1 - q.a0; d -= TAU * Math.round((d - prev) / TAU); if (i === 0) d -= TAU * Math.round(d / TAU); q.d = d; prev = d; });
      const pts = () => { const s = smooth(u), hx = M[0] + (c1[0] - M[0]) * s, hy = M[1] + (c1[1] - M[1]) * s; return polar.map((q) => { const r = q.r0 + (q.r1 - q.r0) * s, an = q.a0 + q.d * s; return [hx + r * Math.cos(an), hy + r * Math.sin(an)]; }); };
      phases.push({
        seconds: 0.75,
        enter: () => {
          const custom = new Map([
            [P[0].ci, (scene) => {
              const poly = addCornerPoly(scene, { site: flatSite([0, 0, z0]), corners: pts, K: 1, hub: () => { const s = smooth(u); return [M[0] + (slot2.center[0] - M[0]) * s, M[1] + (slot2.center[1] - M[1]) * s]; } });
              scene.addLines((sc) => wordLines(sc, poly.ring, poly.n, edgesOf(merged, uniform(m2), a.colorOf), { size: 0.11 * slot2.R }));
            }],
            [P[1].ci, () => {}],
          ]);
          const built = buildScene(a.before, a.looks, { colorOf: a.colorOf, n: k > 2 ? 30 : 40, custom });
          a.stage.setScene(built.scene, built.frame, false);
          return (x) => { u = x; };
        },
      });
    }
  }
  return phases;
}
