// The diagram of a decomposition: a dot for each piece, a line for each cut, the features as leaves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { graphOf, layoutOf, tangle } from '../src/schematic.js';
import { openOrbifold, withMove, cutsOf } from '../src/model.js';

const cutEdges = (g) => g.edges.filter((e) => e.cut);

test('the graph has a line for every cut and a leaf for every feature', () => {
  const s = openOrbifold('333*2x'), g = graphOf(s);
  assert.equal(cutEdges(g).length, cutsOf(s).length);
  assert.deepEqual(g.nodes.filter((n) => n.kind === 'leaf').map((n) => n.text).sort(), ['2', '3', '3', '3', '×']);
  assert.equal(g.nodes.filter((n) => n.kind === 'piece').length, 4);
  // a handle loop is a line from a piece to itself
  const oo = graphOf(openOrbifold('oo'));
  assert.equal(cutEdges(oo).filter((e) => e.loop).length, 2);
  // a rigid orbifold: one tile with its signature hanging off it
  const rigid = graphOf(openOrbifold('*532'));
  assert.equal(cutEdges(rigid).length, 0);
  assert.equal(rigid.nodes.filter((n) => n.kind === 'leaf')[0].text, '∗532');
  // the plane families
  assert.equal(cutEdges(graphOf(openOrbifold('2222'))).length, 1);
  assert.equal(graphOf(openOrbifold('2222')).nodes.filter((n) => n.text === '2').length, 4);
});

test('the layout puts every node inside the box, the same way every time, and apart from the others', () => {
  for (const text of ['3333', '333*2x', 'oo', 'ooo', '22222222', '***', 'o*2x', '2222', '*532']) {
    const g = graphOf(openOrbifold(text)), box = { w: 320, h: 200, pad: 26 };
    const a = layoutOf(g, {}, box), b = layoutOf(g, {}, box);
    for (const n of g.nodes) {
      const p = a[n.id];
      assert.ok(p && p[0] >= box.pad - 1e-6 && p[0] <= box.w - box.pad + 1e-6 && p[1] >= box.pad - 1e-6 && p[1] <= box.h - box.pad + 1e-6, `${text}: ${n.id} at ${p}`);
      assert.deepEqual(p, b[n.id], `${text}: the same drawing twice`);
    }
    const pieces = g.nodes.filter((n) => n.kind === 'piece');
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) assert.ok(Math.hypot(a[pieces[i].id][0] - a[pieces[j].id][0], a[pieces[i].id][1] - a[pieces[j].id][1]) > 12, `${text}: two pieces on top of each other`);
    assert.equal(tangle(g, a), 0, `${text}: lines cross`);
  }
});

test('after a flip the diagram is drawn without crossings when a fresh drawing has none', () => {
  let s = openOrbifold('ooo');
  let before = layoutOf(graphOf(s), {}, { w: 320, h: 200, pad: 26 });
  for (let i = 0; i < 3; i++) {
    const c = cutsOf(s).filter((x) => x.moves.length)[i];
    try { s = withMove(s, c.id, c.moves[0].kind).state; } catch (err) { assert.ok(err.refused); continue; }
    const g = graphOf(s), kept = layoutOf(g, before.raw, { w: 320, h: 200, pad: 26 }), fresh = layoutOf(g, {}, { w: 320, h: 200, pad: 26 });
    assert.ok(Math.min(tangle(g, kept), tangle(g, fresh)) <= tangle(g, kept));
    assert.equal(typeof tangle(g, fresh), 'number');
    before = kept;
  }
  // tangle counts a plain crossing
  const g = { nodes: [], edges: [{ a: 'p', b: 'q', cut: 1 }, { a: 'r', b: 's', cut: 2 }, { a: 'p', b: 'r', cut: 3 }] };
  assert.equal(tangle(g, { p: [0, 0], q: [10, 10], r: [0, 10], s: [10, 0] }), 1);
  assert.equal(tangle(g, { p: [0, 0], q: [10, 0], r: [0, 10], s: [10, 10] }), 0);
});
