// The nine plane orbifolds with a number of shape, and the sphere and the rigid ones the page shows without a cut.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAtlas, checkAtlas, walk, locate } from '../src/atlas.js';
import { apply, mul, I3, invOf } from '../src/h2.js';
import { FAMILIES, flatDecomp, flatDefaults, flatParts, flatMoves, flatMove } from '../src/flat.js';
import { rigidAtlas } from '../src/rigid.js';
import { parse } from '../src/decomp.js';
import { coverFaults, rng } from './support.js';

/** Every image of the point x0 of atom `home` under the atlas's group, within `radius`. */
const orbit = (atlas, home, x0, radius) => walk(atlas, home, { radius, max: 20000 }).filter((t) => t.atom === home).map((t) => apply(t.M, x0));

for (const family of Object.keys(FAMILIES)) for (const view of FAMILIES[family].views) {
  test(`${family}, cut along its ${view}: covers the plane once at its fixed area, and its move keeps the pattern`, () => {
    const rnd = rng(9 + family.length);
    let D = flatDecomp(family, view), P = flatDefaults(D);
    for (let step = 0; step < 7; step++) {
      if (step === 3) { P = { c0: { ...P.c0, len: P.c0.len * (0.7 + 0.6 * rnd()) } }; if (P.c0.tw !== undefined) P.c0.tw = rnd() - 0.5; }
      const atlas = buildAtlas('E', flatParts(D, P));
      checkAtlas(atlas);
      assert.ok(Math.abs(atlas.area - FAMILIES[family].area) < 1e-9, `area ${atlas.area}`);
      assert.equal(coverFaults(atlas, { n: 60 }), 0, `step ${step}: every point in one tile`);
      const mv = flatMoves(D)[0];
      if (!mv) { assert.ok(['22x', 'xx', '2*22'].includes(family), 'a move was expected'); break; }
      const res = flatMove(D, P, mv.kind);
      // the orbit of a point, before and after, is one set of points. The move's chart carries the NEW piece's chart
      // into the old one's; an atom has a chart of its own, laid in its piece's by Ci (and back by C)
      const inv = invOf('E'), x0 = [0.31, 0.47, 1], before = orbit(atlas, 0, x0, 16);
      const next = buildAtlas('E', flatParts(res.D, res.params));
      const toNew = mul(mul(next.atoms[0].C, inv(res.chart)), atlas.atoms[0].Ci), toOld = inv(toNew);
      const y0 = apply(toNew, x0), loc = locate(next, { atom: 0, M: I3 }, y0);
      assert.ok(loc, 'the point was not found after the move');
      const after = orbit(next, loc.atom, apply(inv(loc.M), y0), 24).map((q) => apply(toOld, apply(loc.M, q)));
      const within = (list) => list.filter((p) => Math.hypot(p[0], p[1]) < 9), has = (list, p) => list.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-7);
      for (const p of within(before)) assert.ok(has(after, p), `step ${step} (${mv.kind}): a point of the pattern is gone`);
      for (const q of within(after)) assert.ok(has(before, q), `step ${step} (${mv.kind}): a point that was not in the pattern`);
      D = res.D; P = res.params;
    }
  });
}

test('2222: the flip takes the three pairings of the four half-turn points in turn', () => {
  let D = flatDecomp('2222'), P = flatDefaults(D);
  const names = [D.pts.join('')];
  for (let i = 0; i < 3; i++) { const r = flatMove(D, P, 'A'); D = r.D; P = r.params; names.push(D.pts.join('')); }
  const pairing = (s) => [[s.slice(0, 2), s.slice(2, 4)], [s.slice(4, 6), s.slice(6)]].map((x) => x.sort().join('')).sort().join('|');            // bottom two | top two
  assert.equal(new Set(names.slice(0, 3).map(pairing)).size, 3, 'three different pairings');
  assert.equal(pairing(names[3]), pairing(names[0]), 'and round again');
  assert.ok(Math.abs(P.c0.len - 4) < 1e-9);
});

test('the rigid ones: one tile, the whole sphere covered, the right count of tiles', () => {
  const order = { '*532': 120, 532: 60, '*432': 48, '3*2': 24, '*22': 4, 55: 5, '5*': 10, '5x': 10, '*': 2, x: 2 };
  for (const [text, n] of Object.entries(order)) {
    const a = rigidAtlas(parse(text)), tiles = walk(a, 0, { radius: Infinity, max: 9000 });
    assert.equal(a.kind, 'S', text);
    assert.equal(tiles.length, n, `${text}: tiles`);
    assert.ok(Math.abs((tiles.length * a.area) / (4 * Math.PI) - 1) < 1e-6, `${text}: the sphere is covered once`);
  }
  for (const text of ['*632', '632', '4*2', '333', '3*3', '237', '*237', '4*3']) {
    const a = rigidAtlas(parse(text));
    assert.equal(a.atoms.length, 1, text);
    assert.ok(a.atoms[0].shapes.length > 0, `${text}: a print`);
    assert.equal(a.kind, text.includes('7') || text === '4*3' ? 'H' : 'E', text);
    assert.equal(coverFaults(a, { n: 40, radius: a.kind === 'H' ? 4.5 : 12, spread: a.kind === 'H' ? 1.5 : 4 }), 0, `${text}: covered once`);
  }
});
