// test/patterns-shipped.test.js — the shape patterns that ship with the page (14 Nov 2026, the pattern round; SPEC 11):
// Paisley (the default), Soft commas and Tomoe (src/patterns/, the designs of dev/patterns/designs/ as they were judged),
// and the Comma, which is a print since then (src/patterns/comma.js; the owner's page comment 88289462 of 13 Nov: "I
// want to reuse the two different shades from "checkerboard" pattern for all patterns").
//
// For each of the three, in all 17 groups, the page's own print (printFor):
//   * is shown at all: printable (src/shapes.js: what printFor asks), and keeps the rules of a finished design:
//     validateShapes with GAP_MIN (dev/patterns/kit.js);
//   * is the group's, exactly: exactlyInvariant (a millionth of a mark either side of its outlines) and invariantUnder;
//   * is what the round asked for: half the paper or so dark (0.40 to 0.62 of a lattice cell), no bare patch wider
//     than half a tile (measureShapes' emptyDisc <= 0.5), nothing thinner than the 3D texture holds (thinParts at 1.5
//     texels: no run at all);
//   * comes from a find that gives the same motif twice, in a loose time bound, and the same motif as the design file
//     it was copied from (where dev/ is at hand: dev/patterns/suite.sh sends it, tools/test-all.mjs does not).
// A turned, scaled and shifted copy of each group, without presets (as test/pattern.test.js moves a group), still gets a
// printable print that the moved group keeps. The Comma: every group's is printable and keeps GAP_MIN; its tail is
// nowhere thinner than 1.5 texels (the comma of motif.js is: the control), and its outline is motif.js's but for the
// last of the tail. And the page's template lists the six in PATTERNS' order, with a swatch each.
//   node --test test/patterns-shipped.test.js        (about half a minute: the measures are fine grids)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GROUPS, BY_ID, elementsNear } from '../src/groups.js';
import { PATTERNS, DEFAULT_PATTERN, printFor, exactlyInvariant, invariantUnder } from '../src/pattern.js';
import { SHAPE_PATTERNS } from '../src/patterns/index.js';
import { find as commaFind, bluntComma, TIP_TEXELS } from '../src/patterns/comma.js';
import { GAP_MIN, MAX_VERTS, makeShapePrint, printable, validateShapes, measureShapes, thinParts, texelPitch, bakeShapes } from '../src/shapes.js';
import { motifFor, commaOutline, FILL_GAP } from '../src/motif.js';
import { sdfRead } from '../src/render3d.js';

const THREE = ['paisley', 'soft', 'tomoe'];
const modOf = (key) => SHAPE_PATTERNS.find((p) => p.meta.key === key);
// the design folders the three were copied from (dev/ is not on every test machine)
const DESIGN = { paisley: '../dev/patterns/designs/paisley/design.js', soft: '../dev/patterns/designs/blobs/design.js', tomoe: '../dev/patterns/designs/tomoe/design.js' };
const designs = {};
for (const k of THREE) { try { designs[k] = await import(DESIGN[k]); } catch { designs[k] = null; } }

/** The group carried to another place: x -> s R(th) x + v (reps conjugated, lattice and centre moved; no presets). As test/pattern.test.js. */
function moved(g, th, sc, v) {
  const co = sc * Math.cos(th), si = sc * Math.sin(th), A = [co, -si, si, co], d = co * co + si * si, Ai = [co / d, si / d, -si / d, co / d];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, N) => [M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3], M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3]];
  const reps = g.reps.map((r) => {
    const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]);
    return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] };
  });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]] };
}

/** The group carried by x -> A x + v, A any invertible 2x2 (rows [a, b, c, d]: a mirror, a shear too); no presets. */
function carried(g, A, v) {
  const dA = A[0] * A[3] - A[1] * A[2], Ai = [A[3] / dA, -A[1] / dA, -A[2] / dA, A[0] / dA];
  const mul = (M, p) => [M[0] * p[0] + M[1] * p[1], M[2] * p[0] + M[3] * p[1]];
  const mm = (M, N) => [M[0] * N[0] + M[1] * N[2], M[0] * N[1] + M[1] * N[3], M[2] * N[0] + M[3] * N[2], M[2] * N[1] + M[3] * N[3]];
  const reps = g.reps.map((r) => {
    const L = mm(mm(A, [r.a, r.b, r.c, r.d]), Ai), Lv = mul(L, v), At = mul(A, [r.tx, r.ty]);
    return { a: L[0], b: L[1], c: L[2], d: L[3], tx: -Lv[0] + At[0] + v[0], ty: -Lv[1] + At[1] + v[1] };
  });
  const e1 = mul(A, g.e1), e2 = mul(A, g.e2), cen = mul(A, g.center), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: [cen[0] + v[0], cen[1] + v[1]] };
}

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hundreds of elements of the group (not only the generators) keep the tone at generic points: bad points out of n. */
function elementsKeep(g, P, seed) {
  const L = Math.hypot(g.e1[0], g.e1[1]) + Math.hypot(g.e2[0], g.e2[1]), els = elementsNear(g, g.center[0], g.center[1], 2 * L), rnd = prng(seed);
  let bad = 0, n = 0;
  for (let i = 0; i < 3000 && n < 200; i++) {
    const x = g.center[0] + (2 * rnd() - 1) * L, y = g.center[1] + (2 * rnd() - 1) * L;
    if (P.margin(x, y) < 1e-3 * P.size) continue;
    n++;
    const t = P.tone(x, y);
    for (let k = 0; k < 8; k++) {
      const e = els[(rnd() * els.length) | 0], u = e.a * x + e.b * y + e.tx, v = e.c * x + e.d * y + e.ty;
      if (P.margin(u, v) < 1e-3 * P.size) continue;
      if (P.tone(u, v) !== t) bad++;
    }
  }
  return { bad, n, els: els.length };
}

test('shipped: the page\'s template lists PATTERNS — the select\'s options in the same order with the same labels, the pill names the default, one swatch per pattern', () => {
  const html = fs.readFileSync(new URL('../src/index.template.html', import.meta.url), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const select = html.match(/<select id="pattern"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(select, 'the template has the select #pattern');
  const options = [...select[1].matchAll(/<option value="([^"]+)">([^<]*)<\/option>/g)].map((m) => [m[1], m[2].trim()]);
  assert.deepEqual(options, PATTERNS.map((p) => [p.key, p.label]), 'the options are PATTERNS, in order (src/app.js syncPattern keeps their order and appends only a registered pattern)');
  assert.equal(options[0][0], DEFAULT_PATTERN, 'the first option is the default: before the script runs the select shows it');
  const label = html.match(/<span class="pat-label" id="pattern-label">([^<]*)<\/span>/);
  assert.equal(label && label[1], PATTERNS.find((p) => p.key === DEFAULT_PATTERN).label, 'the pill names the default before the script runs');
  for (const p of PATTERNS) assert.equal((html.match(new RegExp(`<svg class="pat-sw pat-sw-${p.key}"`, 'g')) || []).length, 1, `one swatch for ${p.key}`);
});

test('shipped: the selector\'s six in order — Paisley (the default), Soft commas, Tomoe, Checkerboard, Rings, Comma; the shape patterns of src/patterns/ are the first three and the last', () => {
  assert.deepEqual(PATTERNS.map((p) => [p.key, p.label]), [['paisley', 'Paisley'], ['soft', 'Soft commas'], ['tomoe', 'Tomoe'], ['checker', 'Checkerboard'], ['rings', 'Rings'], ['comma', 'Comma']]);
  assert.equal(DEFAULT_PATTERN, 'paisley');
  assert.deepEqual(SHAPE_PATTERNS.map((p) => p.meta.key), ['paisley', 'soft', 'tomoe', 'comma']);
  for (const p of SHAPE_PATTERNS) {
    assert.equal(PATTERNS.find((q) => q.key === p.meta.key), p.meta, `${p.meta.key}: the selector lists the module's own meta`);
    assert.ok(p.meta.hint.length > 10 && Object.isFrozen(p.meta), p.meta.key);
    assert.equal(typeof p.find, 'function');
  }
});

for (const key of THREE) {
  test(`shipped: ${key} in all 17 groups — printable, the kit's GAP_MIN, exactly the group's; 0.40 to 0.62 dark, no bare disc over 0.5, nothing thinner than the 3D texture holds; find is pure and quick`, (t) => {
    const M = modOf(key), rows = [];
    let worstMs = 0;
    for (const g of GROUPS) {
      const label = `${key} ${g.id}`, size = Math.sqrt(g.domainArea);
      // the find, twice: the same motif (a second call may come from a cache: it must not differ)
      const t0 = performance.now(), r1 = M.find(g), ms = performance.now() - t0, r2 = M.find(g);
      worstMs = Math.max(worstMs, ms);
      assert.deepEqual(r2.shapes, r1.shapes, `${label}: find gives the same motif twice`);
      assert.ok(ms < 1500, `${label}: find took ${ms.toFixed(0)} ms (the page asks it once per group; Chrome on the mini: Paisley's table 1 ms, Soft commas up to 16)`);
      const P = printFor(g, key);
      assert.ok(P && P.kind === 'shapes' && P.key === key && P.name === key, `${label}: the page's print`);
      assert.equal(printFor(g, key), P, `${label}: the same object every time`);
      assert.deepEqual(P.polys.map((q) => q.pts.length / 2).reduce((a, b) => a + b, 0), P.verts);
      assert.ok(P.verts <= MAX_VERTS, `${label}: ${P.verts} vertices`);
      // the rules: the page's (printable) and a finished design's (GAP_MIN)
      const pr = printable(P), V = validateShapes(P);
      assert.ok(pr.ok, `${label}: printable — ${pr.problems.join(' | ')}`);
      assert.ok(V.ok, `${label}: validateShapes with GAP_MIN — ${V.problems.join(' | ')}`);
      assert.ok(V.gap >= GAP_MIN, `${label}: copies ${V.gap} apart`);
      // exactly the group's
      assert.ok(exactlyInvariant(g, P, 30, 7), `${label}: exactlyInvariant`);
      assert.ok(invariantUnder(g, P, 200, 11), `${label}: invariantUnder`);
      const E = elementsKeep(g, P, 5 + GROUPS.indexOf(g));
      assert.ok(E.n >= 150 && E.bad === 0, `${label}: ${E.bad} of ${8 * E.n} element checks change the tone (${E.els} elements)`);
      // what the round asked for
      const m = measureShapes(P);
      assert.ok(m.overlap === 0, `${label}: copies overlap on ${m.overlap} of the plane`);
      assert.ok(m.coverage >= 0.40 && m.coverage <= 0.62, `${label}: ${m.coverage} of the plane is dark`);
      assert.ok(m.emptyDisc <= 0.5, `${label}: a bare disc ${m.emptyDisc} tile sizes across`);
      const pitch = texelPitch(g), thin = thinParts(P, 1.5 * pitch);
      assert.deepEqual(thin.map((r) => `${(r.length / pitch).toFixed(1)} texels of ${r.dark ? 'dark' : 'light'} under ${(r.width / pitch).toFixed(2)} at ${r.at.map((v) => v.toFixed(3))}`), [], `${label}: nothing thinner than 1.5 texels`);
      assert.ok(Math.abs(pitch - (bakeShapes(P, 16).pitch * 16) / 1024) < 1e-12 * size, `${label}: texelPitch is the texture's own`);
      // the design file it was copied from gives the same motif
      if (designs[key]) assert.deepEqual(designs[key].find(g), r1, `${label}: src/patterns/${key}.js and its design file give the same motif`);
      rows.push(`${g.id.padEnd(6)} dark ${m.coverage.toFixed(3)}  bare ${m.emptyDisc.toFixed(3)}  solid ${m.darkDisc.toFixed(3)}  gap ${V.gap.toFixed(3)}  ${String(P.verts).padStart(4)} pts  find ${ms.toFixed(1)} ms` + (size ? '' : ''));
    }
    t.diagnostic(`${key}: the design file ${designs[key] ? 'compared' : 'not here (dev/ was not sent): not compared'}; slowest find ${worstMs.toFixed(0)} ms`);
    for (const r of rows) t.diagnostic(r);
  });

  test(`shipped: ${key} for a turned, scaled and shifted copy of each group without presets — a printable print the moved group keeps`, () => {
    const rnd = prng(31 + THREE.indexOf(key));
    for (const g of GROUPS) {
      const th = 2 * Math.PI * rnd(), sc = 0.5 + 1.5 * rnd(), v = [4 * rnd() - 2, 4 * rnd() - 2], h = moved(g, th, sc, v);
      const label = `${key} ${g.id} turned ${th.toFixed(3)}, scaled ${sc.toFixed(3)}, shifted ${v.map((x) => x.toFixed(3))}`;
      const res = modOf(key).find(h);
      assert.ok(res && Array.isArray(res.shapes) && res.shapes.length, `${label}: a motif`);
      const P = makeShapePrint(h, { key, name: key, shapes: res.shapes });
      const pr = printable(P);
      assert.ok(pr.ok, `${label}: printable — ${pr.problems.join(' | ')}`);
      assert.ok(exactlyInvariant(h, P, 20, 3), `${label}: exactlyInvariant`);
      assert.ok(invariantUnder(h, P, 120, 13), `${label}: invariantUnder`);
      const m = measureShapes(P, { per: 28 });
      assert.ok(m.overlap === 0 && m.coverage > 0.3 && m.coverage < 0.7, `${label}: ${m.coverage} dark, overlap ${m.overlap}`);
    }
  });
}

test('shipped: the Comma is a print now — every group\'s comma of motif.js on the paper: printable, GAP_MIN, exactly the group\'s; its tail nowhere thinner than 1.5 texels and held by the 3D texture to its end (the comma of motif.js is thin for 26 texels and more, and loses 8 or more in 3D: the controls)', (t) => {
  let controls = 0;
  const rows = [];
  for (const g of GROUPS) {
    const label = `comma ${g.id}`, P = printFor(g, 'comma'), m0 = motifFor(g);
    assert.ok(P && P.kind === 'shapes' && P.key === 'comma', `${label}: a shape print`);
    assert.equal(printFor(g, 'Comma'), P);
    const pr = printable(P), V = validateShapes(P);
    assert.ok(pr.ok && V.ok, `${label}: ${[...pr.problems, ...V.problems].join(' | ')}`);
    assert.ok(V.gap >= FILL_GAP - 0.01, `${label}: the copies keep ${V.gap} (motif.js keeps FILL_GAP, ${FILL_GAP}, less the tail's width)`);
    assert.equal(V.stabilizer, 1, `${label}: one comma, at a generic place`);
    assert.ok(exactlyInvariant(g, P, 30, 17) && invariantUnder(g, P, 200, 19), `${label}: the group's`);
    const pitch = texelPitch(g), thin = thinParts(P, 1.5 * pitch);
    assert.deepEqual(thin.map((r) => `${(r.length / pitch).toFixed(1)} texels under ${(r.width / pitch).toFixed(2)}`), [], `${label}: nothing thinner than 1.5 texels`);
    // the control: motif.js's own comma as a print has the thin tail the Comma print rounds off
    const C = makeShapePrint(g, { shapes: m0.polylines.map((p) => Array.from(p)) }), thin0 = thinParts(C, 1.5 * pitch);
    if (thin0.length && thin0[0].length / pitch > 20) controls++;
    // the outline is motif.js's but for the end of the tail: every point within the tail's width w of motif.js's polygon,
    // and the points away from the tip exactly its points
    const w = TIP_TEXELS * pitch, poly = Array.from(m0.polylines[0]), n0 = poly.length / 2 - 1, pts = P.polys[0].pts;
    let far = 0, same = 0;
    for (let i = 0; i < pts.length; i += 2) {
      let d = Infinity;
      for (let k = 0; k < n0; k++) {
        const ax = poly[2 * k], ay = poly[2 * k + 1], bx = poly[2 * k + 2], by = poly[2 * k + 3], ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
        const u = l2 > 0 ? Math.max(0, Math.min(1, ((pts[i] - ax) * ex + (pts[i + 1] - ay) * ey) / l2)) : 0;
        d = Math.min(d, Math.hypot(pts[i] - ax - u * ex, pts[i + 1] - ay - u * ey));
      }
      far = Math.max(far, d);
      if (d < 1e-5 * P.size) same++;
    }
    assert.ok(far <= 1.01 * w, `${label}: a point of the Comma's outline lies ${(far / pitch).toFixed(2)} texels from motif.js's comma (the tail's width is ${TIP_TEXELS})`);
    assert.ok(same >= 0.8 * (pts.length / 2), `${label}: ${same} of ${pts.length / 2} points are motif.js's own`);
    // the 3D view holds the tail to its end: along the tail's middle line, from the tip inward, the texture read as the
    // shader reads it (render3d.js sdfRead, bilinear) is dark wherever the print is; motif.js's own comma loses the last
    // 8 to 22 texels of it (the control)
    const lostOf = (Q, wu) => {
      const tex = bakeShapes(Q), [e1x, e1y] = tex.e1, [e2x, e2y] = tex.e2, dd = e1x * e2y - e1y * e2x, [sx, sy] = m0.scale, ca = Math.cos(m0.angle), sa = Math.sin(m0.angle);
      let lost = 0, arc = 0, prev = null;
      for (let f = 0; f <= 1.2; f += 0.001) {
        const tt = 1 - Math.cos(f / 2), T = wu > 0 ? Math.pow(tt ** 4 + wu ** 4, 0.25) : tt, r = 1 - T / 2, ux = r * Math.sin(f / 2), uy = r * Math.cos(f / 2);
        const x = m0.at[0] + ca * sx * ux - sa * sy * uy, y = m0.at[1] + sa * sx * ux + ca * sy * uy;
        if (prev) arc += Math.hypot(x - prev[0], y - prev[1]);
        prev = [x, y];
        if (Q.tone(x, y) !== 1) continue;
        const u = x - tex.origin[0], v = y - tex.origin[1];
        if (sdfRead(tex, (u * e2y - v * e2x) / dd, (e1x * v - e1y * u) / dd) >= 0) lost = arc;
      }
      return lost / tex.pitch;
    };
    const lostNow = lostOf(P, w / Math.min(...m0.scale)), lostOld = lostOf(C, 0);
    assert.equal(lostNow, 0, `${label}: the 3D texture reads light on the last ${lostNow.toFixed(1)} texels of the tail`);
    assert.ok(lostOld > 5, `${label}: the control — motif.js's needle loses ${lostOld.toFixed(1)} texels in 3D`);
    // the find: pure, and the info says where the comma is
    assert.deepEqual(commaFind(g), commaFind(g));
    assert.deepEqual(commaFind(g).info.at, m0.at);
    const m = measureShapes(P, { per: 40 });
    rows.push(`${g.id.padEnd(6)} dark ${m.coverage.toFixed(3)}  bare ${m.emptyDisc.toFixed(3)}  gap ${V.gap.toFixed(3)}  tail ${(w / P.size).toFixed(4)} tile sizes; motif.js's comma thin for ${thin0.length ? (thin0[0].length / pitch).toFixed(0) : 0} texels`);
  }
  assert.ok(controls >= 15, `the comma of motif.js is thin in 3D in ${controls} groups (the control: it should be in most)`);
  for (const r of rows) t.diagnostic(r);
});

test('shipped: the Comma of a turned, scaled, shifted or mirrored copy of each group (no presets) is its page group\'s comma carried along — printable, exactly the moved group\'s, the same share of the tile; a group that is no copy is motif.js\'s to place (the review of 15 Nov 2026: motifFor threw for every such copy)', () => {
  const rnd = prng(53);
  for (const g of GROUPS) {
    const base = commaFind(g), P0 = printFor(g, 'comma');
    for (const mirror of [false, true]) {
      const th = 2 * Math.PI * rnd(), sc = 0.5 + 1.5 * rnd(), v = [4 * rnd() - 2, 4 * rnd() - 2];
      const co = sc * Math.cos(th), si = sc * Math.sin(th), A = mirror ? [co, si, si, -co] : [co, -si, si, co];
      const h = carried(g, A, v), label = `comma ${g.id} ${mirror ? 'mirrored, ' : ''}turned ${th.toFixed(3)}, scaled ${sc.toFixed(3)}`, size = Math.sqrt(h.domainArea);
      const res = commaFind(h);
      assert.equal(res.info.from, g.id, `${label}: carried from the page's ${g.id}`);
      const P = makeShapePrint(h, { key: 'comma', name: 'comma', shapes: res.shapes });
      const pr = printable(P);
      assert.ok(pr.ok, `${label}: printable — ${pr.problems.join(' | ')}`);
      assert.ok(exactlyInvariant(h, P, 20, 3) && invariantUnder(h, P, 120, 13), `${label}: the moved group's`);
      assert.ok(Math.abs(P.netArea / h.domainArea - P0.netArea / g.domainArea) < 1e-9, `${label}: ${(P.netArea / h.domainArea).toFixed(4)} of the tile, the page's ${(P0.netArea / g.domainArea).toFixed(4)}`);
      const q = base.shapes[0].pts, pts = res.shapes[0].pts;
      assert.equal(pts.length, q.length);
      let far = 0;
      for (let i = 0; i < q.length; i++) far = Math.max(far, Math.hypot(pts[i][0] - (A[0] * q[i][0] + A[1] * q[i][1] + v[0]), pts[i][1] - (A[2] * q[i][0] + A[3] * q[i][1] + v[1])));
      assert.ok(far < 1e-9 * size, `${label}: the page's comma carried along (${far.toExponential(1)} off)`);
      assert.ok(Math.abs(res.info.radius - sc * base.info.radius) < 1e-9 * size && Math.abs(res.info.tip - sc * base.info.tip) < 1e-12 * size, `${label}: its sizes`);
    }
  }
  // a sheared copy is no copy: motif.js's to place, and without presets it has no place (printFor then shows the sheet)
  const sheared = carried(BY_ID['2222'], [1, 0.3, 0, 1], [0, 0]);
  assert.throws(() => commaFind(sheared), `the sheared 2222 has no comma of its own`);
});

test('shipped: bluntComma — w = 0 is the unit comma of motif.js; the tail keeps w to its round end; the outline is closed and turns the right way', () => {
  const u = commaOutline(), b0 = bluntComma(0);
  assert.equal(b0.length, u.length / 2 - 1, 'the same points, without the repeated last one');
  b0.forEach((p, i) => assert.ok(Math.hypot(p[0] - u[2 * i], p[1] - u[2 * i + 1]) < 1e-12, `point ${i}`));
  for (const w of [0.004, 0.012, 0.03]) {
    const b = bluntComma(w);
    let area = 0;
    for (let i = 0; i < b.length; i++) { const p = b[i], q = b[(i + 1) % b.length]; area += p[0] * q[1] - q[0] * p[1]; }
    assert.ok(area > 0, `w ${w}: counter-clockwise`);
    // the round end: points on the half circle of diameter w at the tip, left of it
    const tipAt = b.findIndex((p) => Math.abs(p[0]) < 1e-12 && Math.abs(p[1] - 1) < 1e-12);
    assert.ok(tipAt > 0, `w ${w}: the tip (0, 1) is a point`);
    for (let k = 1; k < 7; k++) { const p = b[tipAt + k]; assert.ok(p[0] < 0 && Math.abs(Math.hypot(p[0], p[1] - (1 - w / 2)) - w / 2) < 1e-12, `w ${w}: the end is round (point ${k})`); }
    // every hollow point lies at least w (to rounding) inside the unit circle: the tail is that thick
    for (let i = tipAt + 7; i < tipAt + 7 + 24; i++) assert.ok(1 - Math.hypot(b[i][0], b[i][1]) >= w * (1 - 1e-9), `w ${w}: hollow point ${i - tipAt - 7}`);
  }
  assert.throws(() => bluntComma(-0.1), RangeError);
  assert.throws(() => bluntComma(0.6), RangeError);
});
