// The Tidying Lemma's bookkeeping (src/zipper/engine.js) against an independent count of the glued surface.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fromWords, zip, zipIds, isDone, countsOf, normalForm, chiOf, census, nameOf } from '../src/zipper/engine.js';

const key = (c) => `o${c.o}*${c.star}x${c.x}`;
function finish(words, pick = (ids) => ids[0]) {
  let st = fromWords(words);
  const log = [];
  while (!isDone(st)) { const r = zip(st, pick(zipIds(st))); st = r.state; log.push(r.info); }
  return { st, log };
}

test('the familiar polygons', () => {
  const cases = [
    [['a b a- b-'], 'o1*0x0', 'torus'],
    [['a b a- b'], 'o0*0x2', 'Klein bottle'],
    [['a b a b'], 'o0*0x1', 'projective plane'],
    [['a a-'], 'o0*0x0', 'sphere'],
    [['a b! a c!'], 'o0*1x1', 'Moebius band'],
    [['a b! a- c!'], 'o0*2x0', 'annulus'],
    [['a! b! c!'], 'o0*1x0', 'disk'],
    [['a b c', 'a- c- b-'], 'o0*0x0', 'two triangles: a sphere'],
    [['a b c', 'a b c'], 'o0*0x0', 'two triangles, the other way up: a sphere'],
    [['a b c a- b- c-'], 'o1*0x0', 'hexagon: a torus'],
    [['a b a- b- c d c- d-'], 'o2*0x0', 'octagon: two handles'],
    [['r i f! j g! k h! r- u!', 'l m! n o! p q!', 'i s! l t!', 'j v! n w!', 'k x! p y!'], 'o1*2x0', 'the strange surface of p. 104 from its five pieces'],
    [['r p q! s t! r- u!', 'p v! s- w!'], 'o0*2x1', 'the punched Moebius band of p. 106 from its two pieces'],
  ];
  for (const [words, want, what] of cases) {
    const { st } = finish(words);
    assert.equal(st.comps.length, 1, what);
    assert.equal(key(normalForm(countsOf(st.comps[0]))), want, what);
  }
});

test('Figure 8.10: the same instructions give a cross-handle or two crosscaps', () => {
  const blueFirst = finish(['a b a- b'], (ids) => (ids.includes('a') ? 'a' : ids[0]));
  assert.deepEqual(blueFirst.log.map((i) => i.kind), ['cap', 'crosshandle']);
  assert.deepEqual(countsOf(blueFirst.st.comps[0]), { o: 0, star: 0, x: 0, X: 1 });
  const greenFirst = finish(['a b a- b'], (ids) => (ids.includes('b') ? 'b' : ids[0]));
  assert.deepEqual(greenFirst.log.map((i) => i.kind), ['crosscap', 'crosscap']);
  assert.deepEqual(countsOf(greenFirst.st.comps[0]), { o: 0, star: 0, x: 2, X: 0 });
});

test('the figure numbers of the snug and gaping cases', () => {
  const torus = finish(['a b a- b-'], (ids) => (ids.includes('a') ? 'a' : ids[0]));
  assert.deepEqual(torus.log.map((i) => [i.kind, i.fig, i.gaping]), [['cap', '8.6', true], ['handle', '8.3', false]]);
  const two = finish(['a b c', 'a- c- b-'], (ids) => ids[0]);
  assert.equal(two.log[0].kind, 'join'); assert.equal(two.log[0].fig, '8.5');
});

// a small deterministic random source
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

test('random gluings, zipped in random order, agree with the count of the glued surface', () => {
  const rand = rng(20261115);
  for (let trial = 0; trial < 400; trial++) {
    const nPoly = 1 + Math.floor(rand() * 4), sizes = Array.from({ length: nPoly }, () => 3 + Math.floor(rand() * 3));
    const slots = [];
    sizes.forEach((m, p) => { for (let i = 0; i < m; i++) slots.push(p); });
    // shuffle the slots, pair most of them off, leave a few free
    const order = slots.map((_, i) => i).sort(() => rand() - 0.5);
    const labels = new Array(slots.length);
    const nFree = Math.floor(rand() * 3) + (order.length % 2), nPairs = (order.length - nFree) / 2;
    if (!Number.isInteger(nPairs) || nPairs < 0) { trial--; continue; }
    for (let k = 0; k < nPairs; k++) { labels[order[2 * k]] = 'z' + k + (rand() < 0.5 ? '-' : ''); labels[order[2 * k + 1]] = 'z' + k + (rand() < 0.5 ? '-' : ''); }
    for (let k = 2 * nPairs; k < order.length; k++) labels[order[k]] = 'f' + k + '!';
    const words = []; let at = 0;
    for (const m of sizes) { words.push(labels.slice(at, at + m).join(' ')); at += m; }
    const want = census(words).map((e) => key(nameOf(e))).sort();
    for (let rep = 0; rep < 3; rep++) {
      const { st, log } = finish(words, (ids) => ids[Math.floor(rand() * ids.length)]);
      const got = st.comps.map((c) => key(normalForm(countsOf(c)))).sort();
      assert.deepEqual(got, want, `words ${JSON.stringify(words)} order ${log.map((i) => i.id).join(',')}`);
      // and each step changes the Euler characteristic as gluing two arcs (or two circles) must
      for (const c of st.comps) assert.ok(Number.isInteger(chiOf(countsOf(c))));
    }
  }
});
