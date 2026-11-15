// test/pattern.test.js — the prints of src/pattern.js (13 Nov 2026): the checkerboard and the rings of every group.
//
// What a print must be: a two-tone pattern of the plane that EVERY element of the group leaves as it is (so it is a
// pattern of the orbifold: the tile's share closes without a break across every seam, and a piece of a re-cut tile,
// carried by an element of the group, lands in register). That is tested here against the group itself (hundreds of
// elements, not only the generators the finder used), with planted faults that the same check notices. And the two
// places a print is drawn — the canvas paths of fillPrint, the shader's uniforms — are tied to the one tone function.
//   node --test test/pattern.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, BY_ID, elementsNear, symmetryElements } from '../src/groups.js';
import { PATTERNS, DEFAULT_PATTERN, SHEET_PATTERN, resolvePattern, printFor, printCached, printUniforms, fillPrint, invariantUnder, exactlyInvariant, CHECKS_ACROSS, RINGS_ACROSS, registerPattern, allPatterns } from '../src/pattern.js';
// the shape patterns (the end of this file): the motif of the test's own pattern, the rules, the texture and the renderer's twins of its shader
import { commaOutline } from '../src/motif.js';
import { validateShapes, bakeShapes } from '../src/shapes.js';
import { sdfSample, sdfDistance } from '../src/sdf.js';
import { sdfRead, sdfTone } from '../src/render3d.js';

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

/** Is the tone the same at the four points a hair away from (x, y)? (a point next to a line where the tone changes is skipped) */
function steady(P, x, y, d) {
  const t = P.tone(x, y);
  return P.tone(x + d, y) === t && P.tone(x - d, y) === t && P.tone(x, y + d) === t && P.tone(x, y - d) === t;
}

// 14 Nov 2026, the pattern round (SPEC 11): the selector's six, Paisley first and the default (it was the checkerboard,
// first of three: changed on purpose); the Comma is a print (it was none: the owner's page comment 88289462, "reuse the
// two different shades from "checkerboard" pattern for all patterns"); the sheet, the picture before the prints, is no
// pattern one can choose. test/patterns-shipped.test.js tests the shape patterns themselves.
test('patterns: the selector\'s six, Paisley first and the default; names resolve, old ones too; the comma is a print, the sheet is none', () => {
  assert.deepEqual(PATTERNS.map((p) => p.key), ['paisley', 'soft', 'tomoe', 'checker', 'rings', 'comma']);
  assert.equal(DEFAULT_PATTERN, 'paisley');
  assert.equal(SHEET_PATTERN, 'sheet');
  for (const p of PATTERNS) { assert.ok(p.label && p.hint); assert.equal(resolvePattern(p.key), p.key); assert.equal(resolvePattern(p.label), p.key); }
  assert.equal(resolvePattern('CHECKERBOARD'), 'checker');
  assert.equal(resolvePattern(' Rings '), 'rings');
  for (const old of ['blobs', 'Soft commas', 'SOFT COMMAS', ' soft ']) assert.equal(resolvePattern(old), 'soft', old);
  for (const bad of [null, undefined, '', 'tartan', 7, {}, 'sheet', SHEET_PATTERN]) assert.equal(resolvePattern(bad), null, String(bad));
  const g = BY_ID['333'];
  assert.equal(printFor(g, 'comma').kind, 'shapes', 'the comma is a print (since 14 Nov 2026)');
  assert.equal(printFor(g, SHEET_PATTERN), null, 'the sheet has no print');
  assert.equal(printFor(g, 'tartan'), null);
  assert.equal(printFor(null, 'checker'), null);
  assert.equal(printFor(g, 'checker'), printFor(g, 'Checkerboard'), 'the same object every time');
  assert.equal(printFor(g, 'paisley'), printFor(g, 'Paisley'));
});

test('prints: every group has a checkerboard and rings, and every element of the group leaves them as they are', (t) => {
  let checked = 0;
  const rows = [];
  for (const g of GROUPS) {
    const size = Math.sqrt(g.domainArea);
    for (const key of ['checker', 'rings']) {
      const P = printFor(g, key), label = `${g.id} ${key}`;
      assert.ok(P, `${label}: there is one`);
      assert.equal(P.key, key);
      assert.ok(P.kind === 'linear' || P.kind === 'rings', label);
      assert.ok(['checks', 'triangles', 'hexagons', 'stripes', 'rings'].includes(P.name), `${label}: name ${P.name}`);
      // the finder's own check, wider, from other points
      assert.ok(invariantUnder(g, P, 500, 31), `${label}: the generators keep it`);
      assert.ok(invariantUnder(g, P, 500, 977), `${label}: the generators keep it (other points)`);
      // the sharp check: a millionth of a mark either side of the print's own lines
      assert.ok(exactlyInvariant(g, P, 60, 5), `${label}: exactly, at its own lines`);
      assert.ok(exactlyInvariant(g, P, 60, 4711), `${label}: exactly, at its own lines (other points)`);
      // ... and against the group itself: every element that moves the window's centre within two lattice lengths
      const L = Math.hypot(g.e1[0], g.e1[1]) + Math.hypot(g.e2[0], g.e2[1]);
      const els = elementsNear(g, g.center[0], g.center[1], 2 * L);
      assert.ok(els.length >= 9, `${label}: ${els.length} elements`);
      const rnd = prng(101 + GROUPS.indexOf(g)), d = 0.02 * P.cell;
      let pts = 0;
      for (let i = 0; i < 4000 && pts < 60; i++) {
        const x = g.center[0] + (2 * rnd() - 1) * L, y = g.center[1] + (2 * rnd() - 1) * L;
        if (!steady(P, x, y, d)) continue;
        pts++;
        const tone = P.tone(x, y);
        assert.ok(tone === 0 || tone === 1, `${label}: tone ${tone}`);
        for (const e of els) {
          const u = e.a * x + e.b * y + e.tx, v = e.c * x + e.d * y + e.ty;
          if (!steady(P, u, v, 0.5 * d)) continue;
          assert.equal(P.tone(u, v), tone, `${label}: the element ${JSON.stringify(e)} changes the tone at (${x}, ${y})`);
          checked++;
        }
      }
      assert.ok(pts >= 60, `${label}: ${pts} points`);
      // two tones, both there: the share of dark over a lattice cell
      let dark = 0, n = 0;
      for (let i = 0; i < 160; i++) for (let j = 0; j < 160; j++) { const s = (i + 0.37) / 160, u = (j + 0.61) / 160; dark += P.tone(s * g.e1[0] + u * g.e2[0], s * g.e1[1] + u * g.e2[1]); n++; }
      const share = dark / n;
      assert.ok(share > 0.2 && share < 0.6, `${label}: ${(100 * share).toFixed(1)} % dark`);
      // the marks are of a size one can see on a tile and count: between a tenth and four tenths of the tile's size
      assert.ok(P.cell > 0.1 * size && P.cell < 0.4 * size, `${label}: a mark is ${(P.cell / size).toFixed(3)} tile sizes`);
      rows.push(`${g.id.padEnd(6)} ${key.padEnd(8)} ${P.name.padEnd(10)} mark ${(P.cell / size).toFixed(3)}  dark ${(100 * share).toFixed(0)} %`);
    }
    // the checkerboard is checks or triangles wherever the lattice allows two even tones; hexagons only with 6-fold centres
    const c = printFor(g, 'checker');
    if (c.name === 'hexagons') assert.ok(['632', '*632'].includes(g.id), `${g.id}: hexagons`);
    if (['333', '3*3', '*333'].includes(g.id)) assert.equal(c.name, 'triangles', g.id);
    if (!['333', '3*3', '*333', '632', '*632'].includes(g.id)) assert.equal(c.name, 'checks', g.id);
  }
  assert.ok(checked > 17 * 2 * 300, `${checked} element checks`);
  assert.ok(CHECKS_ACROSS > 3 && RINGS_ACROSS > 3);
  for (const r of rows) t.diagnostic(r);
});

test('prints: control — a print that the group does not keep is noticed (shifted, turned, scaled by a hair)', () => {
  let caught = 0, tried = 0;
  for (const id of ['2222', '22x', 'xx', '*x', '442', '333', '*632']) {
    const g = BY_ID[id], P = printFor(g, 'checker');
    const f = P.forms.map((q) => q.slice());
    const make = (forms) => {
      const F = forms;
      const used = (k) => F[k][0] !== 0 || F[k][1] !== 0;
      return { key: 'checker', kind: 'linear', forms: F, cell: P.cell, tone: (x, y) => { let k = 0; for (let i = 0; i < 3; i++) if (used(i)) k += Math.floor(F[i][0] * x + F[i][1] * y + F[i][2]); return k & 1; } };
    };
    assert.ok(invariantUnder(g, make(f), 300), `${id}: the print as found passes the control's own tone function`);
    // shifted by a third of a mark along the first form
    const shifted = f.map((q) => q.slice()); shifted[0][2] += 0.31;
    // turned by 7 degrees
    const co = Math.cos(0.12), si = Math.sin(0.12);
    const turned = f.map((q) => [co * q[0] - si * q[1], si * q[0] + co * q[1], q[2]]);
    // marks 3 % smaller
    const scaled = f.map((q) => [1.03 * q[0], 1.03 * q[1], q[2]]);
    for (const [name, bad] of [['shifted', shifted], ['turned', turned], ['scaled', scaled]]) {
      tried++;
      // (a shift along one family of lines can be a symmetry of a group that has no reflection or turn pinning it: o is not tried)
      if (!invariantUnder(g, make(bad), 300)) caught++;
      else assert.ok(name === 'shifted', `${id}: a ${name} print passes`);
    }
  }
  assert.ok(caught >= tried - 3, `${caught} of ${tried} planted faults caught`);
});

/** The group carried to another place: x -> s R(th) x + v (reps conjugated, lattice and centre moved). */
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

test('prints: the finder is exact wherever the group sits — turned, scaled and shifted copies of all 17 (the review of 13 Nov: a grid laid from the origin, a hair off the group\'s own centres, had passed the sieve)', () => {
  const rnd = prng(2026);
  let n = 0;
  for (const g of GROUPS) {
    for (let k = 0; k < 14; k++) {
      const th = k < 3 ? [0.3, 1, 3.66][k] : rnd() * 2 * Math.PI, sc = k < 2 ? 1 : 0.4 + 2.2 * rnd(), v = k % 3 === 0 ? [0, 0] : [3 * rnd() - 1.5, 3 * rnd() - 1.5];
      const h = moved(g, th, sc, v), label = `${g.id} turned ${th.toFixed(3)}, scaled ${sc.toFixed(3)}, shifted ${v.map((x) => x.toFixed(3))}`;
      for (const key of ['checker', 'rings']) {
        const P = printFor(h, key);
        assert.ok(P, `${label}: a ${key}`);
        assert.ok(exactlyInvariant(h, P, 40, 99 + k), `${label}: the ${key} is exact`);
        // ... and against elements of the group at generic points, with no margin at all: at most a point in a thousand
        // may sit within rounding of a line
        const els = elementsNear(h, h.center[0], h.center[1], 3 * Math.sqrt(h.cellArea)), L = Math.sqrt(h.cellArea);
        let bad = 0;
        for (let i = 0; i < 400; i++) {
          const x = h.center[0] + (2 * rnd() - 1) * 2 * L, y = h.center[1] + (2 * rnd() - 1) * 2 * L, e = els[(rnd() * els.length) | 0];
          if (P.tone(e.a * x + e.b * y + e.tx, e.c * x + e.d * y + e.ty) !== P.tone(x, y)) bad++;
        }
        assert.ok(bad <= 1, `${label}: the ${key} changes tone under an element at ${bad} of 400 points`);
        assert.ok(P.cell > 0.1 * Math.sqrt(h.domainArea) && P.cell < 0.4 * Math.sqrt(h.domainArea), `${label}: a mark of ${(P.cell / Math.sqrt(h.domainArea)).toFixed(3)} tile sizes`);
        n++;
      }
    }
  }
  assert.ok(n === 17 * 14 * 2);
  // control: a print one hundredth of a mark off passes the sieve and is caught by the sharp check
  const g = BY_ID['*442'], P = printFor(g, 'checker'), f = P.forms.map((q) => q.slice());
  f[0][2] += 0.01;
  const used = (k) => f[k][0] !== 0 || f[k][1] !== 0;
  const off = { key: 'checker', kind: 'linear', forms: f, cell: P.cell, tone: (x, y) => { let k = 0; for (let i = 0; i < 3; i++) if (used(i)) k += Math.floor(f[i][0] * x + f[i][1] * y + f[i][2]); return k & 1; } };
  assert.equal(invariantUnder(g, off, 300), true, 'the sieve does not see a hundredth of a mark');
  assert.equal(exactlyInvariant(g, off), false, 'the sharp check does');
});

test('prints: the shader\'s uniforms carry the same forms; an unused form multiplies by one', () => {
  const U0 = printUniforms(null);
  assert.equal(U0.mode, 0);
  for (const g of GROUPS) {
    const c = printFor(g, 'checker'), U = printUniforms(c);
    assert.equal(U.mode, 1, g.id);
    assert.ok(U.L instanceof Float32Array && U.L.length === 9 && U.A.length === 4 && U.I.length === 4 && U.O.length === 3);
    c.forms.forEach((f, k) => {
      const used = f[0] !== 0 || f[1] !== 0;
      assert.ok(Math.abs(U.L[3 * k] - f[0]) < 1e-5 * (1 + Math.abs(f[0])) && Math.abs(U.L[3 * k + 1] - f[1]) < 1e-5 * (1 + Math.abs(f[1])), `${g.id}: form ${k}`);
      // sin(pi (0 + 1/2)) = 1: the factor of a form that is not used
      if (!used) assert.equal(U.L[3 * k + 2], 0.5, `${g.id}: form ${k} is not used`);
      else assert.ok(Math.abs(U.L[3 * k + 2] - f[2]) < 1e-5 * (1 + Math.abs(f[2])));
    });
    // the shader's formula, in JavaScript: dark <=> the product of the square waves sign(sin(pi c_k)) is negative
    const rnd = prng(5 + GROUPS.indexOf(g));
    for (let i = 0; i < 200; i++) {
      const x = g.center[0] + 2 * rnd() - 1, y = g.center[1] + 2 * rnd() - 1;
      if (!steady(c, x, y, 0.03 * c.cell)) continue;
      let p = 1;
      for (let k = 0; k < 3; k++) p *= Math.sign(Math.sin(Math.PI * (U.L[3 * k] * x + U.L[3 * k + 1] * y + U.L[3 * k + 2])));
      assert.equal(p < 0 ? 1 : 0, c.tone(x, y), `${g.id}: the shader's product at (${x}, ${y})`);
    }
    const r = printFor(g, 'rings'), V = printUniforms(r);
    if (r.kind === 'rings') {
      assert.equal(V.mode, 2, g.id);
      assert.ok(Math.abs(V.O[2] * r.width - 1) < 1e-5, `${g.id}: 1 / width`);
      // the basis is reduced and obtuse (the nearest centre of a point of the cell is one of its four corners), and the
      // inverse is the inverse
      const a = r.a, b = r.b;
      assert.ok(a[0] * b[0] + a[1] * b[1] <= 1e-12, `${g.id}: a.b <= 0`);
      assert.ok(Math.abs(r.inv[0] * a[0] + r.inv[1] * a[1] - 1) < 1e-9 && Math.abs(r.inv[2] * a[0] + r.inv[3] * a[1]) < 1e-9 && Math.abs(r.inv[0] * b[0] + r.inv[1] * b[1]) < 1e-9 && Math.abs(r.inv[2] * b[0] + r.inv[3] * b[1] - 1) < 1e-9, `${g.id}: inv`);
      // the shader's distance (the four corners of the cell) is the distance to the nearest centre (a brute-force search)
      for (let i = 0; i < 120; i++) {
        const x = g.center[0] + 2 * rnd() - 1, y = g.center[1] + 2 * rnd() - 1;
        let best = Infinity;
        for (let m = -6; m <= 6; m++) for (let n = -6; n <= 6; n++) {
          const dx = x - r.origin[0], dy = y - r.origin[1];
          const s0 = Math.round(r.inv[0] * dx + r.inv[1] * dy), t0 = Math.round(r.inv[2] * dx + r.inv[3] * dy);
          best = Math.min(best, Math.hypot(dx - (s0 + m) * a[0] - (t0 + n) * b[0], dy - (s0 + m) * a[1] - (t0 + n) * b[1]));
        }
        const c0 = best / r.width;
        if (Math.abs(c0 - Math.round(c0)) < 0.02) continue;
        assert.equal(Math.floor(c0) & 1, r.tone(x, y), `${g.id}: rings at (${x}, ${y})`);
      }
    } else assert.equal(V.mode, 1, `${g.id}: stripes`);
  }
});

// ---- the canvas: fillPrint's paths against the tone ------------------------------------------------------------------

/** A 2D context that records what is filled: [{ path: [[x, y], ...][], clips: [[x, y][]], rule }]. */
function recorder() {
  let path = [], cur = null;
  const stack = [];
  let clips = [];
  const fills = [];
  return {
    fills,
    set fillStyle(v) { this._fill = v; }, get fillStyle() { return this._fill; },
    beginPath() { path = []; cur = null; },
    moveTo(x, y) { cur = [[x, y]]; path.push(cur); },
    lineTo(x, y) { if (!cur) { cur = []; path.push(cur); } cur.push([x, y]); },
    closePath() { cur = null; },
    save() { stack.push(clips.slice()); },
    restore() { clips = stack.pop() || []; },
    clip() { clips = clips.concat([path.map((p) => p.slice())]); },
    fill(rule) { fills.push({ path: path.map((p) => p.slice()), clips: clips.slice(), rule: rule || 'nonzero', style: this._fill }); },
  };
}
function inPoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
const evenOdd = (subs, x, y) => subs.reduce((k, p) => k + (inPoly(p, x, y) ? 1 : 0), 0) % 2 === 1;

test('prints: fillPrint draws exactly the dark tone — through the plane\'s window and through a card\'s turn and flip', () => {
  const maps = [
    { name: 'the window', A: { a: 90, b: 0, c: 0, d: -90, tx: 300, ty: 280 } },                       // y up -> y down
    { name: 'a card turned 40 degrees and flipped', A: { a: 70 * Math.cos(0.7), b: 70 * Math.sin(0.7), c: 70 * Math.sin(0.7), d: -70 * Math.cos(0.7), tx: 210, ty: 190 } },
    { name: 'a card seen edge-on (squeezed to a third)', A: { a: 30, b: 0, c: 0, d: -90, tx: 150, ty: 140 } },
  ];
  let compared = 0;
  for (const g of GROUPS) {
    for (const key of ['checker', 'rings']) {
      const P = printFor(g, key);
      const box = [g.center[0] - 0.9, g.center[1] - 0.8, g.center[0] + 0.9, g.center[1] + 0.8];
      for (const M of maps) {
        const c = recorder(), A = M.A;
        fillPrint(c, P, (x, y, out) => { out[0] = A.a * x + A.b * y + A.tx; out[1] = A.c * x + A.d * y + A.ty; return out; }, box, '#123456');
        assert.ok(c.fills.length >= 1, `${g.id} ${key}: something is filled`);
        for (const f of c.fills) { assert.equal(f.rule, 'evenodd', `${g.id} ${key}: the even-odd rule`); assert.equal(f.style, '#123456'); }
        if (P.kind === 'linear') assert.equal(c.fills.length, 1, `${g.id} ${key}: one path for all the bands`);
        const rnd = prng(77 + GROUPS.indexOf(g));
        let n = 0;
        for (let i = 0; i < 3000 && n < 150; i++) {
          const x = box[0] + rnd() * (box[2] - box[0]), y = box[1] + rnd() * (box[3] - box[1]);
          if (!steady(P, x, y, 0.06 * P.cell)) continue;             // (the rings are 56-gons: a hair off the circle)
          n++;
          const px = A.a * x + A.b * y + A.tx, py = A.c * x + A.d * y + A.ty;
          let dark = false;
          for (const f of c.fills) if (f.clips.every((cl) => cl.some((poly) => inPoly(poly, px, py))) && evenOdd(f.path, px, py)) dark = true;
          assert.equal(dark ? 1 : 0, P.tone(x, y), `${g.id} ${key}, ${M.name}: the canvas and the tone differ at (${x.toFixed(4)}, ${y.toFixed(4)})`);
          compared++;
        }
        assert.ok(n >= 100, `${g.id} ${key}: ${n} points`);
      }
    }
  }
  assert.ok(compared > 17 * 2 * 3 * 100, `${compared} points compared`);
});

// ====================================================================================================================
// Shape patterns (13 Nov 2026, the pattern round): the registry, and a registered pattern against everything above
// ====================================================================================================================
// A shape pattern is registered at run time (registerPattern); its print is the orbit of a motif under the group
// (src/shapes.js). The test's own pattern is a comma at a generic place found by a rule that speaks only of the
// group's lattice, centre and elements — so it exists, carried along, for a group that was moved about.

/** The distance from the point to its nearest image under the group that is another point. */
function roomAt(group, x, y) {
  let D = Infinity;
  for (const g of elementsNear(group, x, y, 1.01 * Math.max(Math.hypot(group.e1[0], group.e1[1]), Math.hypot(group.e2[0], group.e2[1])), x, y)) {
    const d = Math.hypot(g.a * x + g.b * y + g.tx - x, g.c * x + g.d * y + g.ty - y);
    if (d > 1e-7 * Math.sqrt(group.domainArea) && d < D) D = d;
  }
  return D;
}
const UNIT_COMMA = commaOutline();
/** find(group) of the test's pattern: of the 49 places centre + a e1 + b e2 the roomiest, and there a comma as big as its room. */
function testCommaFind(group) {
  let best = null;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    const a = (i + 0.37) / 7 - 0.5, b = (j + 0.61) / 7 - 0.5;
    const x = group.center[0] + a * group.e1[0] + b * group.e2[0], y = group.center[1] + a * group.e1[1] + b * group.e2[1], D = roomAt(group, x, y);
    if (!best || D > best.D * (1 + 1e-6)) best = { x, y, D };
  }
  // the unit comma lies in the unit disc: scaled by s it stays within s of its place, and the places are D apart
  const s = 0.5 * (best.D - 0.04 * Math.sqrt(group.domainArea)), th = Math.atan2(group.e1[1], group.e1[0]) + 0.7, co = s * Math.cos(th), si = s * Math.sin(th), pts = [];
  for (let i = 0; i + 2 < UNIT_COMMA.length; i += 2) pts.push([best.x + co * UNIT_COMMA[i] - si * UNIT_COMMA[i + 1], best.y + si * UNIT_COMMA[i] + co * UNIT_COMMA[i + 1]]);
  return { shapes: [{ pts }], info: { at: [best.x, best.y], scale: s } };
}
/** A second one, for the fill rule: a ring ON the rotation centre nearest the window's centre, so k copies lie on each other. */
function testRingFind(group) {
  const L = Math.hypot(group.e1[0], group.e1[1]) + Math.hypot(group.e2[0], group.e2[1]), cs = symmetryElements(group, group.center[0], group.center[1], L).centers;
  if (!cs.length) throw new Error('testring: the group has no rotation centre');
  const c = cs.slice().sort((p, q) => Math.hypot(p.x - group.center[0], p.y - group.center[1]) - Math.hypot(q.x - group.center[0], q.y - group.center[1]))[0];
  const r = 0.4 * roomAt(group, c.x, c.y), circle = (rad, n) => Array.from({ length: n }, (_, i) => [c.x + rad * Math.cos((2 * Math.PI * i) / n), c.y + rad * Math.sin((2 * Math.PI * i) / n)]);
  return { shapes: [{ pts: circle(r, 144) }, { pts: circle(0.5 * r, 72), hole: true }], info: { at: [c.x, c.y], order: c.order } };
}

const before = allPatterns().length;
const TEST = registerPattern({ key: 'testcomma', label: 'Test comma', hint: 'a comma at a generic place' }, testCommaFind);
const RING = registerPattern({ key: 'testring' }, testRingFind);

test('shape patterns: the registry — registerPattern adds to allPatterns(), refuses a key that is taken (the six built in, their old names, the sheet); PATTERNS stays the six; names resolve', () => {
  assert.equal(before, 6);
  assert.deepEqual(TEST, { key: 'testcomma', label: 'Test comma', hint: 'a comma at a generic place' });
  assert.deepEqual(RING, { key: 'testring', label: 'testring', hint: '' }, 'the label defaults to the key');
  assert.ok(Object.isFrozen(TEST) && Object.isFrozen(RING));
  const all = allPatterns();
  assert.deepEqual(all.map((p) => p.key), ['paisley', 'soft', 'tomoe', 'checker', 'rings', 'comma', 'testcomma', 'testring'], 'the built-in ones, then the registered ones in the order they came');
  PATTERNS.forEach((p, i) => assert.equal(all[i], p));
  assert.equal(all[6], TEST);
  assert.notEqual(allPatterns(), all, 'a new array each time');
  assert.deepEqual(PATTERNS.map((p) => p.key), ['paisley', 'soft', 'tomoe', 'checker', 'rings', 'comma'], 'PATTERNS itself is the frozen list of six');
  assert.ok(Object.isFrozen(PATTERNS));
  assert.equal(DEFAULT_PATTERN, 'paisley');
  // names
  assert.equal(resolvePattern('testcomma'), 'testcomma');
  assert.equal(resolvePattern('  TestComma '), 'testcomma', 'case and blanks do not matter');
  assert.equal(resolvePattern('Test comma'), 'testcomma', 'a label is taken for its key');
  assert.equal(resolvePattern('testring'), 'testring');
  assert.equal(resolvePattern('tartan'), null);
  // a key that is taken: a pattern's own, a label, an alias that resolvePattern knows
  for (const key of ['checker', 'rings', 'comma', 'testcomma', 'testring', 'checkerboard', 'checks', 'check', 'ring', 'bands', 'commas', 'motif',
    'paisley', 'soft', 'tomoe', 'blobs', SHEET_PATTERN]) {
    assert.throws(() => registerPattern({ key, label: 'Another' }, testCommaFind), /is taken/, `the key '${key}'`);
  }
  // a key that is no key: it must be lower case (resolvePattern lowers what it is given) and fit the URL hash
  for (const key of ['', 'Paisley', '9lives', 'two words', 'a*b', 'ä', 'x'.repeat(25), null, undefined, 7, {}]) {
    assert.throws(() => registerPattern({ key, label: 'Bad' }, testCommaFind), /a key is lower-case/, `the key ${JSON.stringify(key)}`);
  }
  assert.throws(() => registerPattern(null, testCommaFind), /a key is lower-case/);
  assert.throws(() => registerPattern({ key: 'nofind', label: 'No find' }), TypeError);
  assert.throws(() => registerPattern({ key: 'nofind', label: 'No find' }, { shapes: [] }), TypeError);
  assert.deepEqual(allPatterns().map((p) => p.key), ['paisley', 'soft', 'tomoe', 'checker', 'rings', 'comma', 'testcomma', 'testring'], 'a refusal adds nothing');
  // a key of 24 characters with digits, - and _ is one
  const long = registerPattern({ key: 'a-1_' + 'z'.repeat(20), label: '  Long  ', hint: 7 }, testCommaFind);
  assert.deepEqual([long.key.length, long.label, long.hint], [24, 'Long', '']);
  assert.equal(resolvePattern(long.key), long.key);
  assert.equal(allPatterns().length, 9);
  // the print: a shape print, the same object every time, under its key and under its label
  const g = BY_ID['333'], P = printFor(g, 'testcomma');
  assert.ok(P && Object.isFrozen(P));
  assert.deepEqual([P.kind, P.key, P.name], ['shapes', 'testcomma', 'testcomma']);
  assert.equal(printFor(g, 'Test comma'), P, 'the same object every time');
  assert.equal(printFor(g, 'TESTCOMMA'), P);
  assert.deepEqual(P.info.at.length, 2, 'find\'s info is kept');
  assert.notEqual(printFor(BY_ID['442'], 'testcomma'), P, 'a print of its own for every group');
  assert.equal(printFor(g, 'checker').kind, 'linear', 'the built-in prints are what they were');
  assert.equal(printFor(g, 'comma').key, 'comma', 'the comma is a shape print (14 Nov 2026)');
  // printCached: asked once, the answer is kept (the page makes the other groups' prints while it is idle)
  const g2 = BY_ID['*2222'];
  assert.equal(printCached(g2, 'testcomma'), false);
  printFor(g2, 'testcomma');
  assert.equal(printCached(g2, 'testcomma'), true);
  assert.equal(printCached(g2, 'Test comma'), true, 'any name of it');
  assert.equal(printCached(g2, 'tartan'), true, 'an unknown key: nothing to make');
});

test('shape patterns: a find that throws, or a motif that cannot be used, gives no print and ONE warning (the app then shows the comma)', () => {
  const calls = { n: 0 };
  registerPattern({ key: 'testthrows', label: 'Throws' }, (group) => { calls.n++; if (group.id !== '442') throw new Error('no spec for ' + group.id); return testCommaFind(group); });
  registerPattern({ key: 'testempty', label: 'Empty' }, () => ({ shapes: [] }));
  registerPattern({ key: 'testnothing', label: 'Nothing' }, () => undefined);
  registerPattern({ key: 'testnan', label: 'NaN' }, (group) => ({ shapes: [{ pts: [[0, 0], [1, NaN], [0, 1]] }] }));
  const said = [], warn = console.warn;
  console.warn = (...a) => { said.push(a.join(' ')); };
  try {
    const g = BY_ID['2222'];
    assert.equal(printFor(g, 'testthrows'), null);
    assert.equal(said.length, 1, 'one warning');
    assert.match(said[0], /testthrows/); assert.match(said[0], /2222/); assert.match(said[0], /no spec for 2222/); assert.match(said[0], /comma/);
    assert.equal(printFor(g, 'testthrows'), null);
    assert.equal(printFor(g, 'Throws'), null);
    assert.deepEqual([said.length, calls.n], [1, 1], 'asked again: no second warning, find is not called again');
    // another group: its own answer (and its own warning, if it has none either)
    assert.equal(printFor(BY_ID['442'], 'testthrows').kind, 'shapes', 'the group it has a motif for');
    assert.equal(printFor(BY_ID['*x'], 'testthrows'), null);
    assert.equal(said.length, 2);
    // motifs that cannot be used
    assert.equal(printFor(g, 'testempty'), null); assert.match(said[2], /testempty.*no polygon/);
    assert.equal(printFor(g, 'testnothing'), null); assert.match(said[3], /testnothing.*no \{ shapes \}/);
    assert.equal(printFor(g, 'testnan'), null); assert.match(said[4], /testnan.*not a finite number/);
    assert.equal(said.length, 5);
    for (const k of ['testempty', 'testnothing', 'testnan']) assert.equal(printFor(g, k), null);
    assert.equal(said.length, 5, 'each said once');
    // the others are not disturbed
    assert.equal(printFor(g, 'testcomma').kind, 'shapes');
    assert.equal(printFor(g, 'checker').kind, 'linear');
    // testring has no motif for a group without rotation centres: no print there, a print elsewhere
    assert.equal(printFor(BY_ID.o, 'testring'), null); assert.match(said[5], /no rotation centre/);
    assert.equal(printFor(BY_ID['632'], 'testring').kind, 'shapes');
  } finally { console.warn = warn; }
});

test('shape patterns: a motif that breaks the rules is not shown — copies that cross, a polygon that crosses itself, copies the 3D texture would run together; ONE warning names the problem (the review of 13 Nov: nothing checked a design before the page showed it)', () => {
  /** The roomiest of 49 places (no element fixes it), and D, the distance to its nearest image. */
  const roomiest = (group) => {
    let best = null;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const a = (i + 0.37) / 7 - 0.5, b = (j + 0.61) / 7 - 0.5;
      const x = group.center[0] + a * group.e1[0] + b * group.e2[0], y = group.center[1] + a * group.e1[1] + b * group.e2[1], D = roomAt(group, x, y);
      if (!best || D > best.D * (1 + 1e-6)) best = { x, y, D };
    }
    return best;
  };
  /** A disc of radius (k D - gap) / 2 at the roomiest place: its copies are k D - 2 r apart. */
  const discFind = (gapSizes, k = 1) => (group) => {
    const best = roomiest(group), r = (k * best.D - gapSizes * Math.sqrt(group.domainArea)) / 2;
    return { shapes: [{ pts: Array.from({ length: 96 }, (_, i) => [best.x + r * Math.cos((2 * Math.PI * i) / 96), best.y + r * Math.sin((2 * Math.PI * i) / 96)]) }] };
  };
  registerPattern({ key: 'testcross' }, discFind(0, 1.3));                 // copies overlap
  registerPattern({ key: 'testnear' }, discFind(0.001));                   // 0.001 tile sizes apart: under 2 texels of the texture
  registerPattern({ key: 'testclose' }, discFind(0.012));                  // 0.012: the texture holds it; GAP_MIN (0.02) does not
  registerPattern({ key: 'testbowtie' }, (group) => {                    // two lobes of unequal size, small, at the roomiest place
    const { x, y, D } = roomiest(group), a = 0.1 * D;
    return { shapes: [{ pts: [[x, y], [x + a, y + 0.6 * a], [x + a, y], [x, y + a]] }] };
  });
  const said = [], warn = console.warn;
  console.warn = (...m) => { said.push(m.join(' ')); };
  try {
    for (const id of ['2222', 'o', '*632']) {
      const g = BY_ID[id], n = said.length;
      assert.equal(printFor(g, 'testcross'), null, `${id}: copies that cross`);
      assert.match(said[n], new RegExp(`testcross.*${id.replace('*', '\\*')}.*breaks the rules.*cross`));
      assert.equal(printFor(g, 'testnear'), null, `${id}: copies the texture runs together`);
      assert.match(said[n + 1], /testnear.*breaks the rules.*come within 0\.001\d* tile sizes/);
      assert.equal(printFor(g, 'testbowtie'), null, `${id}: a polygon that crosses itself`);
      assert.match(said[n + 2], /testbowtie.*breaks the rules.*crosses itself/);
      // a gap the texture holds is shown: GAP_MIN is a rule of the designs (dev/patterns/kit.js), which they are told of
      const P = printFor(g, 'testclose');
      assert.ok(P && P.kind === 'shapes', `${id}: 0.012 tile sizes apart is shown`);
      const V = validateShapes(P);
      assert.ok(!V.ok && /come within 0\.012\d* tile sizes/.test(V.problems[0]), `${id}: ... while validateShapes, with GAP_MIN, says so`);
      assert.equal(said.length, n + 3, `${id}: one warning each`);
      // asked again: the same answer, nothing said again
      for (const k of ['testcross', 'testnear', 'testbowtie']) assert.equal(printFor(g, k), null);
      assert.equal(printFor(g, 'testclose'), P);
      assert.equal(said.length, n + 3);
    }
  } finally { console.warn = warn; }
});

test('shape prints: a registered pattern\'s print is the group\'s in every group — the generators, the sharp check on its outlines, hundreds of elements; it keeps the rules', (t) => {
  let checked = 0;
  const rows = [];
  for (const g of GROUPS) {
    const P = printFor(g, 'testcomma'), label = `${g.id} testcomma`, size = Math.sqrt(g.domainArea);
    assert.ok(P, `${label}: there is one`);
    assert.deepEqual([P.kind, P.key], ['shapes', 'testcomma']);
    const V = validateShapes(P);
    assert.deepEqual(V.problems, [], `${label}: the motif keeps the rules`);
    assert.equal(V.stabilizer, 1, label);
    assert.ok(invariantUnder(g, P, 500, 31), `${label}: the generators keep it`);
    assert.ok(invariantUnder(g, P, 500, 977), `${label}: the generators keep it (other points)`);
    assert.ok(exactlyInvariant(g, P, 60, 5), `${label}: exactly, at its own outlines`);
    assert.ok(exactlyInvariant(g, P, 60, 4711), `${label}: exactly, at its own outlines (other points)`);
    const L = Math.hypot(g.e1[0], g.e1[1]) + Math.hypot(g.e2[0], g.e2[1]);
    const els = elementsNear(g, g.center[0], g.center[1], 2 * L);
    assert.ok(els.length >= 9, `${label}: ${els.length} elements`);
    const rnd = prng(301 + GROUPS.indexOf(g)), d = 0.02 * P.cell;
    let pts = 0, darkPts = 0;
    for (let i = 0; i < 4000 && pts < 60; i++) {
      const x = g.center[0] + (2 * rnd() - 1) * L, y = g.center[1] + (2 * rnd() - 1) * L;
      if (!steady(P, x, y, d)) continue;
      pts++;
      const tone = P.tone(x, y);
      assert.ok(tone === 0 || tone === 1, `${label}: tone ${tone}`);
      darkPts += tone;
      for (const e of els) {
        const u = e.a * x + e.b * y + e.tx, v = e.c * x + e.d * y + e.ty;
        if (!steady(P, u, v, 0.5 * d)) continue;
        assert.equal(P.tone(u, v), tone, `${label}: the element ${JSON.stringify(e)} changes the tone at (${x}, ${y})`);
        checked++;
      }
    }
    assert.ok(pts >= 60, `${label}: ${pts} points`);
    // two tones, both there: the share of dark over a lattice cell is the motif's area in the tile's
    let dark = 0, n = 0;
    for (let i = 0; i < 160; i++) for (let j = 0; j < 160; j++) { const s = (i + 0.37) / 160, u = (j + 0.61) / 160; dark += P.tone(s * g.e1[0] + u * g.e2[0], s * g.e1[1] + u * g.e2[1]); n++; }
    const share = dark / n, exact = P.netArea / g.domainArea;
    assert.ok(Math.abs(share - exact) < 0.012, `${label}: ${(100 * share).toFixed(1)} % dark, the motif's area is ${(100 * exact).toFixed(1)} % of the tile`);
    assert.ok(share > 0.04 && share < 0.6, `${label}: ${(100 * share).toFixed(1)} % dark`);
    assert.ok(P.cell > 0.1 * size && P.cell < 0.8 * size, `${label}: a mark is ${(P.cell / size).toFixed(3)} tile sizes`);
    rows.push(`${g.id.padEnd(6)} testcomma  mark ${(P.cell / size).toFixed(3)}  dark ${(100 * share).toFixed(0)} %  gap ${V.gap.toFixed(3)}`);
  }
  assert.ok(checked > 17 * 300, `${checked} element checks`);
  for (const r of rows) t.diagnostic(r);
});

/** A shape print carried along with its group: the pattern's own find, asked for the moved group. */
const carriedPrint = (g, th, sc, v) => { const h = moved(g, th, sc, v); return { h, P: printFor(h, 'testcomma') }; };
/** The move that turns by th and scales by sc about the point c. */
const about = (c, th, sc) => [c[0] - sc * (Math.cos(th) * c[0] - Math.sin(th) * c[1]), c[1] - sc * (Math.sin(th) * c[0] + Math.cos(th) * c[1])];

test('shape prints: control — a print that the group does not keep is noticed (the print of the group shifted, turned, scaled; by a hair: the sharp check)', () => {
  let caught = 0, tried = 0;
  for (const id of ['2222', '22x', 'xx', '*x', '442', '333', '*632']) {
    const g = BY_ID[id], P = printFor(g, 'testcomma');
    assert.ok(invariantUnder(g, P, 300) && exactlyInvariant(g, P), `${id}: the print as found passes`);
    // the print of the same group laid elsewhere is a shape print too, with a tone and a margin of its own — but not this group's
    const faults = [
      ['shifted by a third of a mark', carriedPrint(g, 0, 1, [0.6 * 0.31 * P.cell, 0.8 * 0.31 * P.cell]).P],
      ['turned by 7 degrees', carriedPrint(g, 0.12, 1, about(g.center, 0.12, 1)).P],
      ['3 % larger', carriedPrint(g, 0, 1.03, about(g.center, 0, 1.03)).P],
    ];
    for (const [name, bad] of faults) {
      tried++;
      assert.equal(bad.kind, 'shapes');
      if (!invariantUnder(g, bad, 300)) caught++;
      assert.equal(exactlyInvariant(g, bad), false, `${id}: a print ${name} passes the sharp check`);
    }
    // off by a thousandth of a mark: the sieve at generic points does not see it, the sharp check does
    const hair = carriedPrint(g, 0, 1, [0.6e-3 * P.cell, 0.8e-3 * P.cell]).P;
    assert.equal(invariantUnder(g, hair, 300), true, `${id}: the sieve does not see a thousandth of a mark`);
    assert.equal(exactlyInvariant(g, hair), false, `${id}: the sharp check does`);
    assert.equal(exactlyInvariant(g, hair, 40, 811), false, `${id}: from other points too`);
  }
  assert.equal(caught, tried, `${caught} of ${tried} gross faults caught by the sieve`);
});

// (the review of 15 Nov 2026: with `return done >= samples` made `return true`, or with one side of each outline looked
// at, the suite stayed green; the shipped prints lean on this check)
test('shape prints: the sharp check reads BOTH sides of an outline, and passes nothing it could not read', () => {
  /** Inside one of the motif's own polygons (not a copy), and the distance to their outlines. */
  const inOwn = (P, x, y) => P.polys.some((Q) => { const p = Q.pts; let inn = false; for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) { const yi = p[2 * i + 1], yj = p[2 * j + 1]; if ((yi > y) !== (yj > y) && x < p[2 * i] + ((y - yi) * (p[2 * j] - p[2 * i])) / (yj - yi)) inn = !inn; } return inn; });
  const toOwn = (P, x, y) => {
    let m = Infinity;
    for (const Q of P.polys) { const p = Q.pts, n = p.length / 2; for (let k = 0, l = n - 1; k < n; l = k++) { const ax = p[2 * l], ay = p[2 * l + 1], ex = p[2 * k] - ax, ey = p[2 * k + 1] - ay, l2 = ex * ex + ey * ey, s = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0; m = Math.min(m, Math.hypot(ax + s * ex - x, ay + s * ey - y)); } }
    return m;
  };
  for (const id of ['o', '2222', '*x', '632']) {
    const g = BY_ID[id], P = printFor(g, 'testcomma'), [tx, ty] = g.e1;
    assert.ok(exactlyInvariant(g, { ...P }), `${id}: the print as found passes`);
    // 1. dark exactly where the print is, and in a thin band round the outside of the motif's copy one step along e1:
    //    every point on the dark side of the motif's outlines keeps its tone under every generator, but the light side
    //    does not (translated by e1 it lands in the band) — a print the group does not keep
    const w = 0.01 * P.cell;
    const banded = { ...P, tone: (x, y) => (P.tone(x, y) || (!inOwn(P, x - tx, y - ty) && toOwn(P, x - tx, y - ty) < w) ? 1 : 0) };
    assert.equal(exactlyInvariant(g, banded), false, `${id}: a print the group keeps on the dark side of its outlines only passes the sharp check`);
    assert.equal(exactlyInvariant(g, banded, 40, 811), false, `${id}: from other points too`);
    //    ... and the other way round: light in a thin band round the inside of that copy — the light side is kept, the
    //    dark side is not
    const hollowed = { ...P, tone: (x, y) => (P.tone(x, y) && !(inOwn(P, x - tx, y - ty) && toOwn(P, x - tx, y - ty) < w) ? 1 : 0) };
    assert.equal(exactlyInvariant(g, hollowed), false, `${id}: a print the group keeps on the light side of its outlines only passes the sharp check`);
    // 2. the print's tone moved off its outlines (the outlines it gives stay put): no point beside an outline has two
    //    tones, so there is nothing to look at — and nothing read is nothing passed (in 2222 and 632 the moved print is
    //    not the group's)
    let moved = null;
    for (let i = 0; i < 12 && !moved; i++) for (let j = 0; j < 12 && !moved; j++) {
      const dx = (i / 12) * g.e1[0] + (j / 12) * g.e2[0], dy = (i / 12) * g.e1[1] + (j / 12) * g.e2[1];
      let clear = true;
      for (const Q of P.polys) for (let k = 0; k < Q.pts.length && clear; k += 2) if (P.tone(Q.pts[k] - dx, Q.pts[k + 1] - dy) || P.margin(Q.pts[k] - dx, Q.pts[k + 1] - dy) < 0.05 * P.cell) clear = false;
      if (clear) moved = { ...P, tone: (x, y) => P.tone(x - dx, y - dy) };
    }
    assert.ok(moved, `${id}: a shift that leaves the motif's outlines in the light`);
    assert.equal(exactlyInvariant(g, moved), false, `${id}: a print whose tone does not follow its outlines passes the sharp check unread`);
  }
});

test('shape prints: a registered pattern exists wherever the group sits — turned, scaled and shifted copies of all 17, each the print of its own group', () => {
  const rnd = prng(4026);
  let n = 0;
  for (const g of GROUPS) {
    const P0 = printFor(g, 'testcomma');
    for (let k = 0; k < 8; k++) {
      const th = k < 3 ? [0.3, 1, 3.66][k] : rnd() * 2 * Math.PI, sc = k < 2 ? 1 : 0.4 + 2.2 * rnd(), v = k % 3 === 0 ? [0, 0] : [3 * rnd() - 1.5, 3 * rnd() - 1.5];
      const { h, P } = carriedPrint(g, th, sc, v), label = `${g.id} turned ${th.toFixed(3)}, scaled ${sc.toFixed(3)}, shifted ${v.map((x) => x.toFixed(3))}`;
      assert.ok(P && P.kind === 'shapes', `${label}: a print`);
      assert.deepEqual(validateShapes(P).problems, [], `${label}: the motif keeps the rules`);
      // the same motif, carried along: the same share of the tile, the same number of points
      assert.ok(Math.abs(P.netArea / h.domainArea - P0.netArea / g.domainArea) < 1e-6, `${label}: the motif's share of the tile is ${P.netArea / h.domainArea}, at home ${P0.netArea / g.domainArea}`);
      assert.equal(P.verts, P0.verts, label);
      assert.ok(exactlyInvariant(h, P, 40, 99 + k), `${label}: exact`);
      assert.ok(invariantUnder(h, P, 120, 5 + k), `${label}: the generators keep it`);
      const els = elementsNear(h, h.center[0], h.center[1], 3 * Math.sqrt(h.cellArea)), L = Math.sqrt(h.cellArea);
      let bad = 0;
      for (let i = 0; i < 400; i++) {
        const x = h.center[0] + (2 * rnd() - 1) * 2 * L, y = h.center[1] + (2 * rnd() - 1) * 2 * L, e = els[(rnd() * els.length) | 0];
        if (P.tone(e.a * x + e.b * y + e.tx, e.c * x + e.d * y + e.ty) !== P.tone(x, y)) bad++;
      }
      assert.ok(bad <= 1, `${label}: the print changes tone under an element at ${bad} of 400 points`);
      // ... and its texture is the moved print's: read as the shader reads it
      if (k < 2) {
        const T = printUniforms(P).tex, diag = Math.max(Math.hypot(T.e1[0] + T.e2[0], T.e1[1] + T.e2[1]), Math.hypot(T.e1[0] - T.e2[0], T.e1[1] - T.e2[1])) / T.size;
        const d = T.e1[0] * T.e2[1] - T.e1[1] * T.e2[0];
        for (let i = 0; i < 300; i++) {
          const x = h.center[0] + (2 * rnd() - 1) * 2 * L, y = h.center[1] + (2 * rnd() - 1) * 2 * L;
          if (P.margin(x, y) <= diag) continue;
          const qx = x - T.origin[0], qy = y - T.origin[1];
          assert.equal(sdfSample(T.data, T.size, (qx * T.e2[1] - qy * T.e2[0]) / d, (T.e1[0] * qy - T.e1[1] * qx) / d) < 128 ? 1 : 0, P.tone(x, y), `${label}: the texture at (${x}, ${y})`);
        }
      }
      n++;
    }
  }
  assert.equal(n, 17 * 8);
});

test('shape prints: the shader\'s uniforms — mode 3, the texture baked once, its cell and origin; the tone the renderer draws from them is the print\'s', (t) => {
  let compared = 0, worst = 0;
  for (const g of GROUPS) {
    const P = printFor(g, 'testcomma'), U = printUniforms(P), label = `${g.id} testcomma`;
    assert.equal(U.mode, 3, label);
    assert.ok(U.L instanceof Float32Array && U.L.length === 9 && U.A instanceof Float32Array && U.A.length === 4 && U.I instanceof Float32Array && U.I.length === 4 && U.O instanceof Float32Array && U.O.length === 3, label);
    const T = U.tex;
    assert.equal(T, bakeShapes(P), `${label}: the print's own texture`);
    assert.equal(printUniforms(P).tex, T, `${label}: baked once — the same object at every call (the renderer uploads only another one)`);
    assert.equal(printUniforms(P).tex.data, T.data);
    // what render3d.js setStyle asks of a shape print (notes/patterns-renderer.md)
    assert.ok(Number.isInteger(T.size) && T.size >= 1 && (T.size & (T.size - 1)) === 0, `${label}: a size of ${T.size}`);
    assert.ok(T.data instanceof Uint8Array && T.data.length === T.size * T.size && T.range > 0 && Number.isFinite(T.range), label);
    for (const a of [U.L, U.A, U.I, U.O]) for (const v of a) assert.ok(Number.isFinite(v), label);
    // A = the texture's cell, I = the rows of its inverse, O = (origin, range)
    const f = Math.fround, near = (a, b) => Math.abs(a - b) <= 1e-6 * (1 + Math.abs(b));
    assert.deepEqual(Array.from(U.A), [T.e1[0], T.e1[1], T.e2[0], T.e2[1]].map(f), `${label}: A`);
    assert.deepEqual(Array.from(U.O), [T.origin[0], T.origin[1], T.range].map(f), `${label}: O`);
    assert.ok(near(U.I[0] * T.e1[0] + U.I[1] * T.e1[1], 1) && near(U.I[2] * T.e1[0] + U.I[3] * T.e1[1], 0) && near(U.I[0] * T.e2[0] + U.I[1] * T.e2[1], 0) && near(U.I[2] * T.e2[0] + U.I[3] * T.e2[1], 1), `${label}: I is the inverse of the cell`);
    // the cell of the texture is a cell of the group's lattice
    const dd = g.e1[0] * g.e2[1] - g.e1[1] * g.e2[0];
    for (const w of [T.e1, T.e2]) for (const c of [(w[0] * g.e2[1] - w[1] * g.e2[0]) / dd, (g.e1[0] * w[1] - g.e1[1] * w[0]) / dd]) assert.ok(Math.abs(c - Math.round(c)) < 1e-9, `${label}: the texture's cell is on the lattice`);
    assert.ok(Math.abs(Math.abs(T.e1[0] * T.e2[1] - T.e1[1] * T.e2[0]) - g.cellArea) < 1e-9 * g.cellArea, `${label}: one cell`);
    // the shader's arithmetic in JavaScript, on the uniforms as it gets them (single precision), with the renderer's
    // own twins: lattice coordinates, one read, the ramp. Where the outline is more than a texel away the tone is the print's.
    const rnd = prng(700 + GROUPS.indexOf(g)), L = Math.hypot(g.e1[0], g.e1[1]) + Math.hypot(g.e2[0], g.e2[1]);
    const diag = Math.max(Math.hypot(T.e1[0] + T.e2[0], T.e1[1] + T.e2[1]), Math.hypot(T.e1[0] - T.e2[0], T.e1[1] - T.e2[1])) / T.size;
    let n = 0;
    for (let i = 0; i < 1500; i++) {
      const x = f(g.center[0] + (2 * rnd() - 1) * L), y = f(g.center[1] + (2 * rnd() - 1) * L);      // (a vertex's paper point is single precision too)
      const qx = f(x - U.O[0]), qy = f(y - U.O[1]), s = f(f(U.I[0] * qx) + f(U.I[1] * qy)), u = f(f(U.I[2] * qx) + f(U.I[3] * qy));
      const sd = sdfRead(U.tex, s, u), m = P.margin(x, y), tone = P.tone(x, y);
      assert.ok(Math.abs(sd - sdfDistance(sdfSample(T.data, T.size, s, u), T.range)) < 1e-12, `${label}: the renderer's read is src/sdf.js's`);
      if (m < T.range - diag) worst = Math.max(worst, Math.abs(sd - (tone ? -m : m)) / T.pitch);
      if (m <= diag + 0.1 * T.pitch) continue;
      n++; compared++;
      // a pixel a tenth of a texel across (magnified), one texel across, and four (the print small on the screen: no hard edge left, the right side of grey)
      assert.equal(sdfTone(sd, 0.1 * T.pitch, U.O[2]), tone, `${label}: the tone drawn at (${x}, ${y}), ${(m / T.pitch).toFixed(2)} texels from an outline`);
      if (m > diag + 0.6 * T.pitch) assert.equal(sdfTone(sd, T.pitch, U.O[2]), tone, `${label}: at a pixel a texel across`);
      assert.equal(sdfTone(sd, 4 * T.pitch, U.O[2]) > 0.5 ? 1 : 0, tone, `${label}: at a pixel four texels across`);
    }
    assert.ok(n > 900, `${label}: ${n} points`);
  }
  assert.ok(compared > 17 * 900);
  t.diagnostic(`${compared} points; the distance the shader reads is off by ${worst.toFixed(3)} texels at most (the texture's bilinear read near a corner)`);
  // the built-in prints and no print are what they were
  assert.equal(printUniforms(null).mode, 0);
  assert.equal(printUniforms(printFor(BY_ID['333'], 'checker')).mode, 1);
  assert.equal(printUniforms(printFor(BY_ID['333'], 'checker')).tex, undefined);
});

/** The winding number of the recorded subpaths round a point: what the NONZERO rule asks. */
function windingOf(subs, x, y) {
  let w = 0;
  for (const p of subs) for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[j], b = p[i];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) w += b[1] > a[1] ? 1 : -1;
  }
  return w;
}
/** Is the point filled by a recorded fill? By the rule the fill was made with, inside every clip. */
const filledBy = (f, x, y) => f.clips.every((cl) => cl.some((poly) => inPoly(poly, x, y))) && (f.rule === 'evenodd' ? evenOdd(f.path, x, y) : windingOf(f.path, x, y) !== 0);

test('shape prints: fillPrint draws exactly the dark tone of a shape print — one path, the nonzero rule; through the plane\'s window and through a card\'s turn and flip', () => {
  const maps = [
    { name: 'the window', A: { a: 90, b: 0, c: 0, d: -90, tx: 300, ty: 280 } },                       // y up -> y down
    { name: 'a card turned 40 degrees and flipped', A: { a: 70 * Math.cos(0.7), b: 70 * Math.sin(0.7), c: 70 * Math.sin(0.7), d: -70 * Math.cos(0.7), tx: 210, ty: 190 } },
    { name: 'a card seen edge-on (squeezed to a third)', A: { a: 30, b: 0, c: 0, d: -90, tx: 150, ty: 140 } },
    { name: 'a card that is not flipped, turned 100 degrees', A: { a: 60 * Math.cos(1.75), b: -60 * Math.sin(1.75), c: 60 * Math.sin(1.75), d: 60 * Math.cos(1.75), tx: 100, ty: 120 } },
  ];
  let compared = 0, rings = 0, wrongRule = 0;
  for (const g of GROUPS) {
    for (const key of ['testcomma', 'testring']) {
      const P = printFor(g, key);
      if (!P) { assert.ok(key === 'testring' && ['o', '**', 'xx', '*x'].includes(g.id), `${g.id} ${key}: no print`); continue; }
      const box = [g.center[0] - 0.9, g.center[1] - 0.8, g.center[0] + 0.9, g.center[1] + 0.8];
      for (const M of maps) {
        const c = recorder(), A = M.A;
        fillPrint(c, P, (x, y, out) => { out[0] = A.a * x + A.b * y + A.tx; out[1] = A.c * x + A.d * y + A.ty; return out; }, box, '#123456');
        assert.equal(c.fills.length, 1, `${g.id} ${key}: ONE path for all the copies`);
        assert.equal(c.fills[0].rule, 'nonzero', `${g.id} ${key}: the nonzero rule`);
        assert.equal(c.fills[0].style, '#123456');
        assert.equal(c.fills[0].clips.length, 0, 'fillPrint clips nothing for a shape print: the caller does');
        const rnd = prng(177 + GROUPS.indexOf(g));
        let n = 0;
        for (let i = 0; i < 3000 && n < 150; i++) {
          const x = box[0] + rnd() * (box[2] - box[0]), y = box[1] + rnd() * (box[3] - box[1]);
          if (P.margin(x, y) < 1e-6 * P.size) continue;                  // (on an outline: either tone)
          n++;
          const px = A.a * x + A.b * y + A.tx, py = A.c * x + A.d * y + A.ty, tone = P.tone(x, y);
          assert.equal(filledBy(c.fills[0], px, py) ? 1 : 0, tone, `${g.id} ${key}, ${M.name}: the canvas and the tone differ at (${x.toFixed(4)}, ${y.toFixed(4)})`);
          // the ring lies k times on itself (k = the order of its centre): the even-odd rule would leave it bare for an even k
          if (key === 'testring' && tone && !evenOdd(c.fills[0].path, px, py)) wrongRule++;
          compared++;
        }
        assert.ok(n >= 150, `${g.id} ${key}: ${n} points`);
      }
      if (key === 'testring') rings++;
    }
  }
  assert.equal(rings, 13, 'the thirteen groups with rotation centres');
  assert.ok(compared === (17 + 13) * 4 * 150, `${compared} points compared`);
  assert.ok(wrongRule > 300, `the rule matters: by the even-odd rule ${wrongRule} dark points of the rings would be bare`);
  // no print: nothing is drawn; the built-in prints still go by the even-odd rule
  const c = recorder();
  fillPrint(c, null, (x, y, out) => out, [0, 0, 1, 1], '#000');
  assert.equal(c.fills.length, 0);
  fillPrint(c, printFor(BY_ID['442'], 'checker'), (x, y, out) => { out[0] = x; out[1] = y; return out; }, [0, 0, 1, 1], '#000');
  assert.equal(c.fills[0].rule, 'evenodd');
});
