// The moves. A flip is a change of coordinates: the group must be the same before and after, to the last digit that
// can be asked. Checked on the groups themselves (support.js samePattern), move by move and along chains.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAtlas, checkAtlas, atomIn } from '../src/atlas.js';
import { classify, parse, defaultDecomp, defaultParams, countParams, cutList, hasTwist, resolve, decode } from '../src/decomp.js';
import { movesOf, applyMove, LIMIT } from '../src/moves.js';
import { samePattern, rng } from './support.js';

/** Is the pattern after a move the pattern before it? */
function moveCheck(D, P, res) {
  const oldParts = resolve(D, P), A = buildAtlas('H', oldParts), newParts = resolve(res.D, res.params), B = buildAtlas('H', newParts);
  checkAtlas(B);
  const oid = Object.keys(res.olds)[0], nid = Object.keys(res.charts)[0];
  const ra = A.parts[oldParts.findIndex((p) => p.id === oid)].atoms[0], rb = B.parts[newParts.findIndex((p) => p.id === nid)].atoms[0];
  return samePattern(A, ra, atomIn(A, ra, res.olds[oid]), B, rb, atomIn(B, rb, res.charts[nid]));
}
const open = (text) => { const sig = parse(text), D = defaultDecomp(sig); return { sig, D, P: defaultParams(D), dim: classify(sig).dim }; };

test('each kind of cut offers the move that belongs to it', () => {
  const offers = (text) => { const { D } = open(text); return cutList(D).map((id) => movesOf(D, id).map((m) => m.kind).join('+')).join(' '); };
  assert.equal(offers('3333'), 'A');                      // a cuff between two pairs of pants
  assert.equal(offers('o33'), 'A S');                     // ... and a handle loop
  assert.equal(offers('oo'), 'A S S');
  assert.equal(offers('333*2x'), 'pop  A A');             // a cuff in front of a mirror; a crosscap has none
  assert.equal(offers('***'), 'pop pop pop');
  assert.equal(offers('*22222'), 'F F');                  // arcs between mirror polygons
  assert.equal(offers('xxx'), '  ');
});

const FIRST = ['3333', '2223', '22222', '333*2x', '33*', '33*2', '33*22', 'o33', '*2223', '*22222', '3*22', '2*222', '4*33', '23*45', '***', 'o*', '*2*3', '234*', '2*2*', '22*23', 'oo', '333x', 'o2', '2*2222'];
for (const text of FIRST) {
  test(`${text}: every move it offers at first keeps the pattern and the count of numbers`, () => {
    const { D, P, dim } = open(text);
    let did = 0;
    for (const id of cutList(D)) for (const m of movesOf(D, id)) {
      const res = applyMove(D, P, id, m.kind), chk = moveCheck(D, P, res);
      assert.ok(chk.ok, `${id} ${m.kind}: ${chk.why}`);
      assert.equal(countParams(res.D), dim, `${id} ${m.kind}: numbers of shape`);
      did++;
    }
    // these have no move at first: a smooth mirror alone, an arc along one mirror, a cuff between two crowns
    if (!['33*', 'o*', '234*', '3*22', '2*222', '*2*3'].includes(text)) assert.ok(did > 0, 'no move was offered');
  });
}

test('the edge flip goes round the three pairings and comes back to the same numbers', () => {
  for (const text of ['3333', '2223', '2345', '22222']) {
    const { D, P } = open(text), id = cutList(D)[0];
    const rnd = rng(3);
    P[id].len = 1.2 + rnd(); P[id].tw = 0.31;
    let d = D, p = P;
    const pairings = [];
    for (let i = 0; i < 3; i++) { const r = applyMove(d, p, id, 'A'); d = r.D; p = r.params; pairings.push(r.params[id].len); }
    assert.ok(Math.abs(pairings[0] - P[id].len) > 1e-3 && Math.abs(pairings[1] - P[id].len) > 1e-3, `${text}: the two other pairings are other curves`);
    assert.ok(Math.abs(p[id].len - P[id].len) < 1e-8, `${text}: the length came back (${p[id].len} for ${P[id].len})`);
    // the twist comes back up to the half turn a fold does not see
    const dt = Math.abs(p[id].tw - P[id].tw), folded = text !== '2345' && text !== '3333';
    assert.ok(dt < 1e-8 || Math.abs(dt - 1) < 1e-8 || (folded && Math.abs(dt - 0.5) < 1e-8), `${text}: the twist came back (${p[id].tw} for ${P[id].tw})`);
  }
});

test('pop and merge undo each other', () => {
  for (const text of ['33*2', '***', '333*2x', '23*45']) {
    const { D, P } = open(text), id = cutList(D).find((c) => movesOf(D, c).some((m) => m.kind === 'pop'));
    const popped = applyMove(D, P, id, 'pop');
    const arc = cutList(popped.D).find((c) => movesOf(popped.D, c).some((m) => m.kind === 'merge'));
    assert.ok(arc, `${text}: the arcs offer to close again`);
    const merged = applyMove(popped.D, popped.params, arc, 'merge');
    assert.equal(cutList(merged.D).length, cutList(D).length, text);
    const cuff = cutList(merged.D).find((c) => !(c in P) || merged.D.cuts[c].type === 'cuff' && movesOf(merged.D, c).some((m) => m.kind === 'pop'));
    assert.ok(Math.abs(merged.params[cuff].len - P[id].len) < 1e-8, `${text}: the cuff has its length again`);
  }
});

test('a move that would make a cut too long to draw is turned down, and says so', () => {
  const { D, P } = open('oo');
  const theta = applyMove(D, P, cutList(D)[0], 'A');                       // the three cuffs of a theta: 7.05, 2.63, 2.63
  assert.ok(theta.params[cutList(theta.D)[0]].len > 7 && theta.params[cutList(theta.D)[0]].len < 7.1);
  let err = null;
  try { applyMove(theta.D, theta.params, cutList(theta.D)[1], 'A'); } catch (e) { err = e; }
  assert.ok(err && err.refused, 'refused');
  assert.equal(err.cut, 'cuff'); assert.equal(err.limit, LIMIT.cuff); assert.ok(err.len > LIMIT.cuff);
});

test('an edge flip whose next pairing is too long takes the one after, when that one fits', () => {
  // o33 cut as a theta: the pairing next round from cut 2 would be a cuff of 9.61, the one after is 9.03
  const D = decode('uu-Pu0.u1.n3_Pu0.n3.u1'), ids = cutList(D), P = { [ids[0]]: { len: 4.3973, tw: -0.437 }, [ids[1]]: { len: 1.9248, tw: -0.4411 } };
  const r = applyMove(D, P, ids[1], 'A');
  assert.ok(r.info.skipped > LIMIT.cuff && r.info.skipped < 9.7, `skipped ${r.info.skipped}`);
  assert.ok(r.params[ids[1]].len < LIMIT.cuff && r.params[ids[1]].len > 9, `took ${r.params[ids[1]].len}`);
  // asked for by name, the long pairing is refused
  const other = r.info.pairing === 'X' ? 'Y' : 'X';
  assert.throws(() => applyMove(D, P, ids[1], 'A', { pairing: other }), (e) => e.refused === true);
});

test('chains of moves at random numbers keep the pattern', () => {
  const rnd = rng(5);
  let moves = 0, refused = 0;
  const byKind = {};
  for (const text of ['3333', '2345', '333*2x', 'o33', '33*2', '2*2222', '*22222', '23*45', '***', 'o*2', '22*23', '2xx']) {
    const { sig, dim } = open(text);
    for (let trial = 0; trial < 2; trial++) {
      let D = defaultDecomp(sig), P = defaultParams(D);
      if (trial) for (const id of cutList(D)) { P[id].len = 0.9 + 2.2 * rnd(); if (hasTwist(D, id)) P[id].tw = rnd() - 0.5; }
      for (let step = 0; step < 6; step++) {
        const able = [];
        for (const id of cutList(D)) for (const m of movesOf(D, id)) able.push([id, m.kind]);
        if (!able.length) break;
        const [id, kind] = able[Math.floor(rnd() * able.length)];
        let res;
        try { res = applyMove(D, P, id, kind); } catch (err) { if (err.refused) { refused++; continue; } throw new Error(`${text}, ${kind} on ${id}: ${err.message}`); }
        // a cuff of 7 and more is a sliver whose far end is known to few digits: the pattern is checked where it can be
        if (cutList(res.D).every((c) => res.params[c].len < 7) && cutList(D).every((c) => P[c].len < 7)) {
          const chk = moveCheck(D, P, res);
          assert.ok(chk.ok, `${text}, ${kind} on ${id}: ${chk.why}`);
        }
        assert.equal(countParams(res.D), dim);
        moves++; byKind[kind] = (byKind[kind] || 0) + 1;
        D = res.D; P = res.params;
      }
    }
  }
  assert.ok(moves > 80, `only ${moves} moves were made`);
  for (const kind of ['A', 'S', 'pop', 'merge', 'F', 'slide']) assert.ok(byKind[kind] > 0, `no ${kind} move was tried (${JSON.stringify(byKind)}, ${refused} refused)`);
});
