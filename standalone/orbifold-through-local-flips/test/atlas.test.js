// The atlas: pieces glued along their ends, unrolled. Every way of closing an end must cover the plane exactly once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAtlas, checkAtlas, walk, locate } from '../src/atlas.js';
import { apply, I3, invOf } from '../src/h2.js';
import { coverFaults } from './support.js';

const L0 = 2 * Math.acosh(2);
const cuff = (len) => ({ t: 'cuff', len }), cone = (n) => ({ t: 'cone', n }), arc = (len) => ({ t: 'arc', len }), corner = (n) => ({ t: 'corner', n });
const pair = (part, end, twist, extra = {}) => ({ type: 'pair', part, end, twist, ...extra });

/** [name, kind, parts, Euler characteristic (hyperbolic) or area (flat)] */
const CASES = [
  ...[0, 0.13, -0.37, 0.5].map((tw) => ['3333, twist ' + tw, 'H', [
    { id: 'a', spec: { kind: 'P', ends: [cuff(L0), cone(3), cone(3)] }, glue: [pair(1, 0, tw), null, null], cut: ['c', null, null] },
    { id: 'b', spec: { kind: 'P', ends: [cuff(L0), cone(3), cone(3)] }, glue: [pair(0, 0, tw), null, null], cut: ['c', null, null] },
  ], -2 / 3]),
  ['2223: a cuff folded onto 2 2', 'H', [{ id: 'a', spec: { kind: 'P', ends: [cuff(2.2), cone(3), cone(2)] }, glue: [{ type: 'fold', twist: 0.17 }, null, null], cut: ['c', null, null] }], -1 + 1 / 3 + 1 / 2],
  ['o3: a handle', 'H', [{ id: 'a', spec: { kind: 'P', ends: [cuff(1.7), cuff(1.7), cone(3)] }, glue: [pair(0, 1, 0.21), pair(0, 0, 0.21), null], cut: ['h', 'h', null] }], -1 + 1 / 3],
  ['33x: a crosscap', 'H', [{ id: 'a', spec: { kind: 'P', ends: [cuff(2.0), cone(3), cone(3)] }, glue: [{ type: 'cap', cap: 'x' }, null, null], cut: ['c', null, null] }], -1 + 2 / 3],
  ['33*: a smooth mirror', 'H', [{ id: 'a', spec: { kind: 'P', ends: [cuff(2.0), cone(3), cone(3)] }, glue: [{ type: 'cap', cap: '*' }, null, null], cut: ['c', null, null] }], -1 + 2 / 3],
  ['33*2: a crown', 'H', [
    { id: 'a', spec: { kind: 'P', ends: [cuff(2.0), cone(3), cone(3)] }, glue: [pair(1, 0, 0.3), null, null], cut: ['c', null, null] },
    { id: 'b', spec: { kind: 'S', ends: [cuff(2.0), corner(2)] }, glue: [pair(0, 0, 0.3), null], cut: ['c', null] },
  ], -1 + 2 / 3 - 1 / 4],
  ['3*22: an arc along the mirror', 'H', [{ id: 'a', spec: { kind: 'S', ends: [cone(3), arc(1.2)] }, glue: [null, { type: 'mirror' }], cut: [null, 'd'] }], 2 - (2 / 3 + 1 + 1 / 4 + 1 / 4)],
  ['*22222: a pentagon', 'H', [{ id: 'a', spec: { kind: 'M', ends: [arc(1.0), corner(2), arc(1.3)] }, glue: [{ type: 'mirror' }, null, { type: 'mirror' }], cut: ['d1', null, 'd2'] }], 1 - 5 / 4],
  ['2222', 'E', [{ id: 'a', spec: { kind: 'A', len: 4, h: 2 }, glue: [{ type: 'fold', twist: 0 }, { type: 'fold', twist: 0.2 }], cut: ['c', 'c'] }], 8],
  ['o', 'E', [{ id: 'a', spec: { kind: 'A', len: 2, h: 2, halves: 1 }, glue: [pair(0, 1, 0.3), pair(0, 0, 0.3)], cut: ['c', 'c'] }], 4],
  ['**: a cylinder', 'E', [{ id: 'a', spec: { kind: 'A', len: 4, h: 2 }, glue: [{ type: 'cap', cap: '*' }, { type: 'cap', cap: '*' }], cut: ['c', 'c'] }], 8],
  ['*x: a cylinder', 'E', [{ id: 'a', spec: { kind: 'A', len: 4, h: 2 }, glue: [{ type: 'cap', cap: '*' }, { type: 'cap', cap: 'x' }], cut: ['c', 'c'] }], 8],
  ['*2222: a strip', 'E', [{ id: 'a', spec: { kind: 'R', len: 2, h: 2 }, glue: [{ type: 'mirror' }, { type: 'mirror' }], cut: ['c', 'c'] }], 4],
  ['22*: a strip', 'E', [{ id: 'a', spec: { kind: 'R', len: 2, h: 2 }, glue: [{ type: 'half' }, { type: 'half' }], cut: ['c', 'c'] }], 4],
  ['*x: a strip turned over', 'E', [{ id: 'a', spec: { kind: 'R', len: 2, h: 2 }, glue: [pair(0, 1, 0, { flip: true }), pair(0, 0, 0, { flip: true })], cut: ['c', 'c'] }], 4],
  ['**: a strip', 'E', [{ id: 'a', spec: { kind: 'R', len: 2, h: 2 }, glue: [pair(0, 1, 0), pair(0, 0, 0)], cut: ['c', 'c'] }], 4],
];

for (const [name, kind, parts, want] of CASES) {
  test(`${name}: edges match, the area is right, the plane is covered once`, () => {
    const atlas = buildAtlas(kind, parts);
    const area = checkAtlas(atlas);
    const expect = kind === 'H' ? -2 * Math.PI * want : want;
    assert.ok(Math.abs(area - expect) < 1e-8, `area ${area}, expected ${expect}`);
    assert.equal(coverFaults(atlas, { n: 120 }), 0);
  });
}

test('a point is found where it is: locate agrees with the walk', () => {
  const [, kind, parts] = CASES[5];
  const atlas = buildAtlas(kind, parts), inv = invOf(kind), tiles = walk(atlas, 0, { radius: 3.5, max: 4000 });
  for (const t of tiles.slice(0, 200)) {
    const p = apply(t.M, atlas.atoms[t.atom].at), loc = locate(atlas, { atom: 0, M: I3 }, p);
    assert.ok(loc, 'a tile middle was not found');
    assert.equal(loc.atom, t.atom);
    const z = apply(inv(loc.M), p), at = atlas.atoms[t.atom].at;
    assert.ok(atlas.G.dist(z, at) < 1e-7, 'found in another place of the atom');
  }
});
