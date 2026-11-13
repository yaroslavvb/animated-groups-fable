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
import { GROUPS, BY_ID, elementsNear } from '../src/groups.js';
import { PATTERNS, DEFAULT_PATTERN, resolvePattern, printFor, printUniforms, fillPrint, invariantUnder, exactlyInvariant, CHECKS_ACROSS, RINGS_ACROSS } from '../src/pattern.js';

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

test('patterns: three of them, the checkerboard first and the default; names resolve', () => {
  assert.deepEqual(PATTERNS.map((p) => p.key), ['checker', 'rings', 'comma']);
  assert.equal(DEFAULT_PATTERN, 'checker');
  for (const p of PATTERNS) { assert.ok(p.label && p.hint); assert.equal(resolvePattern(p.key), p.key); assert.equal(resolvePattern(p.label), p.key); }
  assert.equal(resolvePattern('CHECKERBOARD'), 'checker');
  assert.equal(resolvePattern(' Rings '), 'rings');
  for (const bad of [null, undefined, '', 'tartan', 7, {}]) assert.equal(resolvePattern(bad), null, String(bad));
  const g = BY_ID['333'];
  assert.equal(printFor(g, 'comma'), null, 'the comma is no print');
  assert.equal(printFor(g, 'tartan'), null);
  assert.equal(printFor(null, 'checker'), null);
  assert.equal(printFor(g, 'checker'), printFor(g, 'Checkerboard'), 'the same object every time');
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
