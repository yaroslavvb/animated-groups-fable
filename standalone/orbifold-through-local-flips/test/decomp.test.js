// The canonical decomposition of any signature: as many numbers as Thurston counts, the right area, the plane
// covered once, at the numbers a page opens with and at random ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAtlas, checkAtlas } from '../src/atlas.js';
import { classify, parse, defaultDecomp, defaultParams, resolve, countParams, encode, decode, cutList, hasTwist, checkDecomp, signatureOfDecomp, FLAT } from '../src/decomp.js';
import { coverFaults, rng } from './support.js';

const HYPERBOLIC = ['3333', '2223', '22222', '222222', '2345', '333*2x', '33*', '33*2', '33x', 'o33', 'o2', 'oo', 'ooo', 'xxx', '2xx', '*2223', '*22222', '*3333', '*23456',
  '3*22', '2*222', '3*222', '2*2222', '4*33', '*2*', '*2*3', '*3*', '***', '*2x', '*23x', '23x', '22*2', '22*23', '33*222', 'o*', 'o*2', 'o*23', '3xxx', '*2*2*2', '2*2*',
  '*22*', '*222*2', '23*45', '33*3', '2222223', '234*', 'xxxx', 'o2222'];

test('what a signature is: its geometry, and how many numbers of shape it has', () => {
  const want = { '*532': ['S', 'rigid', 0], '3*2': ['S', 'rigid', 0], '5x': ['S', 'rigid', 0], 22: ['S', 'rigid', 0], '*': ['S', 'rigid', 0], x: ['S', 'rigid', 0],
    632: ['E', 'rigid', 0], '*442': ['E', 'rigid', 0], '3*3': ['E', 'rigid', 0], 2222: ['E', 'flat', 2], o: ['E', 'flat', 2], '**': ['E', 'flat', 1], '*x': ['E', 'flat', 1],
    '22*': ['E', 'flat', 1], '22x': ['E', 'flat', 1], xx: ['E', 'flat', 1], '*2222': ['E', 'flat', 1], '2*22': ['E', 'flat', 1],
    237: ['H', 'rigid', 0], '*237': ['H', 'rigid', 0], '3*4': ['H', 'rigid', 0], '2*7': ['S', 'rigid', 0], 3333: ['H', 'pieces', 2], '333*2x': ['H', 'pieces', 7], oo: ['H', 'pieces', 6], '***': ['H', 'pieces', 3] };
  for (const [text, [geometry, mode, dim]] of Object.entries(want)) {
    const c = classify(parse(text));
    assert.equal(c.geometry, geometry, text); assert.equal(c.mode, mode, text);
    if (mode !== 'flat') assert.equal(c.dim, dim, text);
  }
  assert.equal(FLAT.length, 9);
  for (const text of ['5', '23', '*2', '*23']) assert.equal(classify(parse(text)).mode, 'none', text);
  assert.equal(parse('N*'), null);
  // 333*2x is the example of the transcript the page was built from: 4 lengths and 3 twists
  const D = defaultDecomp(parse('333*2x')), ids = cutList(D);
  assert.equal(ids.length, 4); assert.equal(ids.filter((id) => hasTwist(D, id)).length, 3);
});

for (const text of HYPERBOLIC) {
  test(`${text}: the canonical cut has Thurston's count of numbers and tiles the plane`, () => {
    const sig = parse(text), c = classify(sig);
    assert.equal(c.mode, 'pieces');
    const D = defaultDecomp(sig);
    checkDecomp(D);
    assert.equal(countParams(D), c.dim, 'numbers of shape');
    // the pieces carry the signature's features: its cone points, its corners, its crosscaps
    const census = signatureOfDecomp(D), down = (a) => a.slice().sort((p, q) => q - p).join('');
    assert.equal(down(census.cones), down(sig.cones), 'cone points');
    assert.equal(census.corners, sig.stars.flat().length, 'corners');
    assert.equal(census.x, sig.x, 'crosscaps');
    const back = decode(encode(D));
    assert.ok(back && encode(back) === encode(D), 'the decomposition reads back from its code');
    const rnd = rng(11 + text.length), random = {};
    for (const id of cutList(D)) { random[id] = { len: 0.8 + 3 * rnd() }; if (hasTwist(D, id)) random[id].tw = rnd() - 0.5; }
    for (const params of [defaultParams(D), random]) {
      const atlas = buildAtlas('H', resolve(D, params)), area = checkAtlas(atlas);
      assert.ok(Math.abs(area / (-2 * Math.PI * c.chi) - 1) < 1e-7, `area ${area} for Euler characteristic ${c.chi}`);
      assert.equal(coverFaults(atlas, { n: 60, radius: 4.2, spread: 1.8 }), 0, 'every point in one tile');
    }
  });
}
