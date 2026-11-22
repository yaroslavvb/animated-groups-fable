// Studio: the mathematics, checked without a browser.
//
//   node --test docs/shubnikov/studio/tests/studio.test.mjs
//
// The claim the page makes is that every design, whatever is in it, has the
// symmetry of its census class.  So the test does what a reader would: takes
// designs (the presets, and random ones), carries random spacetime points by
// every element of the group, and checks F(g.z) = (-1)^s F(z).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildGroup, compileFrame, componentsAt, inkAt, applyElement, toCart, rotationCentres, describeElement,
  encodeDesign, decodeDesign, normaliseDesign, layerVanishes, sdShape, SHAPES, stateAt,
  shapeBound, hitTest, waveTerms, newMove, MOVES,
} from '../studio-core.mjs';
import { PRESETS, randomDesign, censusFilm } from '../studio-presets.mjs';
import { indexCensus, expandClass, colourAt } from '../../shub-field.mjs';

const census = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/census.json', import.meta.url)), 'utf8'));
const CLASS = 'g95-n2-3';
const group = buildGroup(census, CLASS);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Largest violation of the law over random points and all elements: the ground
 * G and the stamp ink S change sign with the inks, the stamp cover A and the
 * inverter field I do not.
 */
function symmetryDefect(design, grp, samples = 60, seed = 7) {
  const rnd = rng(seed);
  let worst = 0, scale = 0;
  const frames = new Map();
  const frameAt = (t) => {
    const key = t.toFixed(9);
    if (!frames.has(key)) frames.set(key, compileFrame(design, grp, t));
    return frames.get(key);
  };
  for (let i = 0; i < samples; i++) {
    const [X, Y] = toCart(grp, [rnd() * 2 - 1, rnd() * 2 - 1]);
    const t = rnd();
    const c0 = componentsAt(frameAt(t), X, Y);
    scale = Math.max(scale, ...c0.map(Math.abs));
    for (const el of grp.elements) {
      const [gx, gy, gt] = applyElement(el, X, Y, t);
      const c1 = componentsAt(frameAt(gt), gx, gy);
      const sign = el.s ? -1 : 1;
      worst = Math.max(worst, Math.abs(c1[0] - sign * c0[0]), Math.abs(c1[1] - c0[1]),
        Math.abs(c1[2] - sign * c0[2]), Math.abs(c1[3] - c0[3]));
      assert.equal(inkAt(frameAt(gt), gx, gy).ink + 0, sign * inkAt(frameAt(t), X, Y).ink + 0);
    }
  }
  return { worst, scale };
}

test('g95-n2-3: eight elements, the ones the page describes', () => {
  assert.equal(group.elements.length, 8);
  assert.equal(group.m, 2);
  assert.deepEqual(group.u, [0, 0]);
  const first = group.elements[0];
  assert.ok(first.isIdentity && first.tau === 0 && first.s === 0, 'the seed itself comes first');
  const has = (pred) => group.elements.some(pred);
  // a quarter turn counter-clockwise with a quarter loop keeps the inks
  assert.ok(has((e) => e.M[0][0] === 0 && e.M[0][1] === -1 && e.M[1][0] === 1 && Math.abs(e.tau - 0.25) < 1e-12 && e.s === 0));
  // a half turn on its own swaps them, and so does half a loop on its own
  assert.ok(has((e) => e.M[0][0] === -1 && e.M[1][1] === -1 && e.tau === 0 && e.s === 1));
  assert.ok(has((e) => e.isIdentity && Math.abs(e.tau - 0.5) < 1e-12 && e.s === 1));
  // a quarter turn the other way with a quarter loop swaps
  assert.ok(has((e) => e.M[0][1] === 1 && e.M[1][0] === -1 && Math.abs(e.tau - 0.25) < 1e-12 && e.s === 1));
});

test('the elements close under composition, and the ink shift is a homomorphism', () => {
  const key = (M, v, tau) => `${M.flat().join(',')}|${v.map((x) => Math.round((((x % 1) + 1) % 1) * 24) % 24).join(',')}|${Math.round((((tau % 1) + 1) % 1) * 24) % 24}`;
  const table = new Map(group.elements.map((e) => [key(e.M, e.v, e.tau), e.s]));
  for (const a of group.elements) {
    for (const b of group.elements) {
      const M = [
        [a.M[0][0] * b.M[0][0] + a.M[0][1] * b.M[1][0], a.M[0][0] * b.M[0][1] + a.M[0][1] * b.M[1][1]],
        [a.M[1][0] * b.M[0][0] + a.M[1][1] * b.M[1][0], a.M[1][0] * b.M[0][1] + a.M[1][1] * b.M[1][1]],
      ];
      const v = [a.M[0][0] * b.v[0] + a.M[0][1] * b.v[1] + a.v[0], a.M[1][0] * b.v[0] + a.M[1][1] * b.v[1] + a.v[1]];
      const k = key(M, v, a.tau + b.tau);
      assert.ok(table.has(k), `product missing: ${k}`);
      // the lattice part of the product carries u; here u = 0
      assert.equal(table.get(k), (a.s + b.s) % 2);
    }
  }
});

test('rotation centres: two 4-fold and two 2-fold per cell, every one an anti-centre', () => {
  const centres = rotationCentres(group);
  const at = (x, y) => centres.find((c) => Math.abs(c.c[0] - x) < 1e-6 && Math.abs(c.c[1] - y) < 1e-6);
  assert.equal(centres.length, 4);
  assert.equal(at(0, 0).order, 4);
  assert.equal(at(0.5, 0.5).order, 4);
  assert.equal(at(0.5, 0).order, 2);
  assert.equal(at(0, 0.5).order, 2);
  for (const c of centres) assert.equal(c.kind, 'anti');
  // the smallest counter-clockwise quarter turn that keeps the inks costs a quarter loop
  assert.ok(Math.abs(at(0, 0).step.tau - 0.25) < 1e-12 && at(0, 0).step.s === 0);
});

test('every element has a description', () => {
  const words = group.elements.map(describeElement);
  assert.equal(new Set(words).size, 8);
  assert.ok(words.includes('quarter turn ↺ · ¼ loop later · same inks'));
  assert.ok(words.includes('half turn · inks swapped'));
  assert.ok(words.includes('½ loop later · inks swapped'));
});

test('shapes: negative at the centre region, positive outside the bound', () => {
  SHAPES.forEach((def, type) => {
    const layer = { sh: def.id, r: 0.2, a: def.a ? def.a[2] : 0.5, n: def.n ? def.n[2] : 5, q: def.q ? def.q[2] : 0 };
    const bound = shapeBound(layer);
    let inside = 0;
    for (let i = 0; i < 400; i++) {
      const th = (i / 400) * 2 * Math.PI;
      const out = sdShape(type, 1.02 * bound * Math.cos(th), 1.02 * bound * Math.sin(th), layer.r, layer.a, layer.n, layer.q);
      assert.ok(out > 0, `${def.id}: a point outside its bound is inside the shape`);
      for (const f of [0.2, 0.5, 0.8]) {
        if (sdShape(type, f * layer.r * Math.cos(th), f * layer.r * Math.sin(th), layer.r, layer.a, layer.n, layer.q) < 0) inside += 1;
      }
    }
    assert.ok(inside > 20, `${def.id}: has an inside`);
  });
});

test('shapes: the distance is 1-Lipschitz enough to be used as one', () => {
  const rnd = rng(3);
  SHAPES.forEach((def, type) => {
    const p = [0.2, def.a ? def.a[2] : 0.5, def.n ? def.n[2] : 5, def.q ? def.q[2] : 0];
    for (let i = 0; i < 300; i++) {
      const x = rnd() * 0.6 - 0.3, y = rnd() * 0.6 - 0.3;
      const dx = (rnd() - 0.5) * 0.01, dy = (rnd() - 0.5) * 0.01;
      const d0 = sdShape(type, x, y, ...p), d1 = sdShape(type, x + dx, y + dy, ...p);
      // the ellipse's is an approximation and steepens near its centre; the rest are bounds
      const slack = def.id === 'ellipse' ? 3 : 1.0001;
      assert.ok(Math.abs(d1 - d0) <= slack * Math.hypot(dx, dy) + 1e-12, `${def.id} at ${x},${y}`);
    }
  });
});

test('presets: each has the symmetry of the class', () => {
  assert.ok(PRESETS.length >= 6);
  for (const preset of PRESETS) {
    const design = normaliseDesign(preset.design, CLASS);
    const { worst, scale } = symmetryDefect(design, group, 40, 11);
    assert.ok(scale > 1e-3, `${preset.id}: the field is not flat`);
    assert.ok(worst < 1e-6 * Math.max(1, scale), `${preset.id}: defect ${worst} against scale ${scale}`);
  }
});

test('presets: no layer is cancelled by the group', () => {
  for (const preset of PRESETS) {
    const design = normaliseDesign(preset.design, CLASS);
    design.L.forEach((layer, i) => {
      assert.equal(layerVanishes(layer, group), false, `${preset.id} layer ${i}`);
    });
  }
});

test('random designs: the symmetry holds whatever is drawn', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const design = normaliseDesign(randomDesign(seed), CLASS);
    assert.ok(design.L.length >= 1);
    const { worst, scale } = symmetryDefect(design, group, 24, seed);
    assert.ok(worst < 1e-6 * Math.max(1, scale), `seed ${seed}: defect ${worst} against scale ${scale}`);
  }
});

test('the group forces a still shape, and a half-loop motion, to nothing', () => {
  const still = normaliseDesign({ L: [{ k: 's', role: 'f', sh: 'disc', r: 0.1, at: [0.2, 0.1] }] }, CLASS).L[0];
  assert.equal(layerVanishes(still, group), true);
  const even = normaliseDesign({ L: [{ k: 's', role: 'f', sh: 'disc', r: 0.1, at: [0.2, 0.1], mv: [{ m: 'o', r: 0.1, k: 2 }] }] }, CLASS).L[0];
  assert.equal(layerVanishes(even, group), true);
  const odd = normaliseDesign({ L: [{ k: 's', role: 'f', sh: 'disc', r: 0.1, at: [0.2, 0.1], mv: [{ m: 'o', r: 0.1, k: 1 }] }] }, CLASS).L[0];
  assert.equal(layerVanishes(odd, group), false);
  // a round stamp pulsing on a rotation centre is its own negative
  const centred = normaliseDesign({ L: [{ k: 's', role: 's', sh: 'disc', r: 0.1, at: [0, 0], mv: [{ m: 'p', amt: 0.5, k: 1 }] }] }, CLASS).L[0];
  assert.equal(layerVanishes(centred, group), true);
  // a wave must run an odd number of times round the loop
  assert.equal(waveTerms({ k: 'w', p: [1, 0], nu: 2, amp: 0.1, ph: 0 }, group, 0.1).length, 0);
  assert.equal(waveTerms({ k: 'w', p: [1, 0], nu: 1, amp: 0.1, ph: 0 }, group, 0.1).length, 4);
});

test('the census film is reproduced by nine waves', () => {
  const design = normaliseDesign(censusFilm(group.cls), CLASS);
  assert.equal(design.L.length, group.cls.modes.length);
  const indexed = indexCensus(JSON.parse(JSON.stringify(census)));
  const field = expandClass(indexed, indexed.byId.get(CLASS));
  const rnd = rng(5);
  let agree = 0, total = 0;
  for (let i = 0; i < 400; i++) {
    const x0 = rnd(), x1 = rnd(), t = rnd();
    const frame = compileFrame(design, group, t);
    const F = componentsAt(frame, x0, x1)[0];
    const colour = colourAt(field, x0, x1, t * group.m);   // the census counts film periods
    if (Math.abs(F) < 0.02) continue;
    total += 1;
    // census colour 0 is the dark ink
    if ((F > 0) === (colour === 1)) agree += 1;
  }
  assert.ok(total > 300);
  assert.equal(agree, total, `${agree} of ${total} points agree with the census film`);
});

test('a design survives its own link', () => {
  for (const preset of PRESETS) {
    const design = normaliseDesign(preset.design, CLASS);
    const text = encodeDesign(design);
    assert.match(text, /^[A-Za-z0-9_-]+$/);
    const back = decodeDesign(text, CLASS);
    assert.deepEqual(JSON.parse(JSON.stringify(back)), JSON.parse(JSON.stringify(normaliseDesign(JSON.parse(JSON.stringify(design)), CLASS))));
    assert.equal(encodeDesign(back), text, `${preset.id}: encoding is stable`);
  }
  assert.throws(() => decodeDesign('***', CLASS));
});

test('every move kind is evaluated and periodic', () => {
  for (const def of MOVES) {
    const layer = normaliseDesign({ L: [{ k: 's', sh: 'comma', r: 0.1, at: [0.1, 0.2], mv: [newMove(def.id)] }] }, CLASS).L[0];
    const a = stateAt(layer, 0.3, group), b = stateAt(layer, 1.3, group);
    assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.scale - b.scale) < 1e-9, def.id);
    assert.ok(Math.abs(Math.cos(a.ang) - Math.cos(b.ang)) < 1e-9, def.id);
  }
});

test('hit test finds the copy under a point', () => {
  const design = normaliseDesign({ L: [{ k: 's', role: 's', sh: 'disc', r: 0.08, at: [0.3, 0.1], mv: [{ m: 'o', r: 0.05, k: 1 }] }] }, CLASS);
  const frame = compileFrame(design, group, 0.2);
  for (const copy of frame.shapes[0].copies) {
    const hit = hitTest(frame, copy.ox + 2, copy.oy - 1, 0);
    assert.ok(hit, 'a translate of every copy is found');
    assert.equal(hit.shape, frame.shapes[0]);
  }
  assert.equal(hitTest(frame, 0.5, 0.5, 0), null);
});

test('other two-colour classes of the census build and keep their symmetry', () => {
  const ids = census.classes.filter((c) => c.n === 2).map((c) => c.id);
  assert.equal(ids.length, 307);
  let checked = 0;
  for (let i = 0; i < ids.length; i += 9) {
    const g = buildGroup(census, ids[i]);
    const design = normaliseDesign(randomDesign(100 + i), ids[i]);
    const { worst, scale } = symmetryDefect(design, g, 10, i);
    assert.ok(worst < 2e-6 * Math.max(1, scale), `${ids[i]}: defect ${worst} against scale ${scale}`);
    checked += 1;
  }
  assert.ok(checked >= 30);
});
