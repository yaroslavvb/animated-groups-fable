// The model the page drives: opening a signature, moving a number, flipping a cut, the print through all of it, the
// address that brings a state back, and the way back from a flip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openOrbifold, spell, withParam, withMove, cutsOf, linkOf, readLink, rangeOf, LIMIT } from '../src/model.js';
import { mul, apply, invOf } from '../src/h2.js';
import { printKept, rng } from './support.js';

const WITH_CUTS = ['3333', '2223', '22222', '333*2x', 'o33', 'oo', '33*2', '*22222', '3*22', '23*45', '***', '2222', 'o', '*2222', '**', '22*', '*x', '22x', 'xx', '2*22'];

test('what is typed: one spelling, and what the page can do with it', () => {
  assert.deepEqual(spell('2345'), { text: '5432', mode: 'pieces' });
  assert.deepEqual(spell('237'), { text: '732', mode: 'rigid' });
  assert.deepEqual(spell('∗532'), { text: '*532', mode: 'rigid' });
  assert.deepEqual(spell('2222'), { text: '2222', mode: 'flat' });
  assert.equal(spell('5').mode, 'none');
  assert.equal(spell('3x*'), null);
  const none = openOrbifold('23');
  assert.equal(none.mode, 'none');
  assert.ok(none.why.tries.length > 0, 'a signature with no pattern is told which ones nearby have one');
  assert.equal(openOrbifold('hello').why.kind, 'text');
});

test('the transcript\'s example: 333*2x has 4 lengths and 3 twists', () => {
  const cuts = cutsOf(openOrbifold('333*2x'));
  assert.equal(cuts.length, 4);
  assert.equal(cuts.filter((c) => c.twist).length, 3);
  assert.deepEqual(cuts.map((c) => c.what), ['cuff', 'crosscap', 'cuff', 'cuff']);
  assert.deepEqual(cuts.map((c) => c.moves.map((m) => m.kind).join()), ['pop', '', 'A', 'A']);
});

for (const text of WITH_CUTS) {
  test(`${text}: the address brings the state back; every flip leaves every comma where it was`, () => {
    const s = openOrbifold(text);
    assert.notEqual(s.mode, 'none');
    const link = readLink('#' + linkOf(s));
    assert.equal(linkOf(openOrbifold(link.k, link.saved)), linkOf(s));
    for (const c of cutsOf(s)) for (const m of c.moves) {
      const r = withMove(s, c.id, m.kind), kept = printKept(s, r.state, r.carry);
      assert.equal(kept.missing, 0, `${c.id} ${m.kind}: ${kept.missing} of ${kept.n} commas moved`);
      assert.ok(r.state.tied && !r.state.reinked);
      assert.ok(r.made.length > 0 && r.gone.length > 0);
      // the state after the flip has an address of its own, and comes back from it
      const l2 = readLink('#' + linkOf(r.state)), s2 = openOrbifold(l2.k, l2.saved);
      assert.equal(linkOf(s2), linkOf(r.state), `${c.id} ${m.kind}: the flipped state reads back`);
      // the first number moved after a flip inks the print afresh, and says so once
      const c2 = cutsOf(r.state)[0], s3 = withParam(r.state, c2.id, 'len', c2.len * 1.05), s4 = withParam(s3, c2.id, 'len', c2.len * 1.1);
      assert.ok(s3.reinked && !s3.tied && !s4.reinked);
      assert.ok(s3.shapes.flat().length > 0);
    }
  });
}

test('chains of flips keep every comma, through corners that land on corners', () => {
  // 2222 at its square default puts a comma's middle exactly on a corner of the next pieces: the case that showed a
  // comma's direction must not be measured against a point it lies on
  for (const text of ['2222', 'o', '*2222', '**', '3333', '22222', '***', '*22222', '2223x', '22*33', '2*2222', 'o2']) {
    let s = openOrbifold(text);
    for (let i = 0; i < 8; i++) {
      const able = cutsOf(s).filter((c) => c.moves.length);
      if (!able.length) break;
      const c = able[i % able.length], m = c.moves[i % c.moves.length];
      let r;
      try { r = withMove(s, c.id, m.kind); } catch (err) { assert.ok(err.refused, `${text} flip ${i + 1}: ${err.message}`); break; }
      const kept = printKept(s, r.state, r.carry);
      assert.equal(kept.missing, 0, `${text}, flip ${i + 1} (${m.kind}): ${kept.missing} of ${kept.n} commas moved`);
      s = r.state;
    }
  }
});

test('the way back from a flip is the flip\'s own carry, the other way round', () => {
  for (const text of ['3333', '333*2x', 'o33', '***', '*22222', '2222', '**']) {
    const s = openOrbifold(text);
    for (const c of cutsOf(s)) for (const m of c.moves) {
      const r = withMove(s, c.id, m.kind), G = s.atlas.G, inv = invOf(s.atlas.kind);
      for (let a = 0; a < s.atlas.atoms.length; a++) {
        const fwd = r.carry(a);
        if (!fwd) continue;
        const back = r.back(fwd.atom);
        assert.ok(back, `${text} ${c.id} ${m.kind}: no way back from atom ${fwd.atom}`);
        // a point of the old atom a, carried forward and back, lands on a point of the old atlas that is the same
        // point of the pattern: the same place of an atom of the same kind
        const p = s.atlas.atoms[a].at, q = apply(back.M, apply(fwd.M, p));
        // back.M o fwd.M carries atom a's chart into atom back.atom's chart; it is a symmetry of the pattern as laid
        // from back.atom, so the image of a's middle is the middle of a tile of atom a, or of its mirror twin
        const twin = s.atlas.atoms[a].twin;
        const d = Math.min(...[a, twin].filter((x) => x != null && x !== false).map((x) => dist(s.atlas, back.atom, q, x)));
        assert.ok(d < 1e-6, `${text} ${c.id} ${m.kind}: back and forth is ${d} off`);
      }
      assert.equal(r.back(-1), null);
    }
  }
});
/** How far the point q of atom `from`'s chart is from the middle of the nearest tile of atom `kind`. */
import { locate } from '../src/atlas.js';
import { I3 } from '../src/h2.js';
function dist(atlas, from, q, kind) {
  const loc = locate(atlas, { atom: from, M: I3 }, q);
  if (!loc || loc.atom !== kind) return Infinity;
  return atlas.G.dist(apply(invOf(atlas.kind)(loc.M), q), atlas.atoms[kind].at);
}

test('a slider moved in small steps moves every comma in small steps', () => {
  // the middle of a piece (where its big comma is printed) must move smoothly with the piece: found as the middle of
  // the largest circle that fits, it jumped along long pieces (33*2 at 1.12 of its first length, by 0.19).
  // A comma of a corner may come or go, but only at next to no size: it grows in as its corner opens.
  for (const text of ['33*2', '333*2x', '22222', '3333', '32*54', '***', '*22222', 'o33', '2222', '**']) {
    const s0 = openOrbifold(text);
    for (const c of cutsOf(s0)) {
      let s = s0, prev = null;
      const steps = [];
      for (let i = 0; i <= 24; i++) {
        s = withParam(s, c.id, 'len', c.len * (1 + 0.01 * i));
        const G = s.atlas.G, now = s.shapes.map((list) => list.map((sh) => ({ c: sh.c, p: sh.pts[0], size: sh.size })));
        if (prev) {
          let top = 0;
          now.forEach((list, a) => {
            const used = new Set();
            for (const q of list) {
              let best = -1, bd = 0.06;
              prev[a].forEach((o, j) => { const d = G.dist(q.c, o.c); if (!used.has(j) && d < bd) { bd = d; best = j; } });
              if (best < 0) { assert.ok(q.size < 0.03, `${text} ${c.id}, step ${i}: a comma of size ${q.size.toFixed(3)} came from nowhere`); continue; }
              used.add(best);
              top = Math.max(top, bd, G.dist(q.p, prev[a][best].p), Math.abs(q.size - prev[a][best].size));
            }
            prev[a].forEach((o, j) => { if (!used.has(j)) assert.ok(o.size < 0.03, `${text} ${c.id}, step ${i}: a comma of size ${o.size.toFixed(3)} went`); });
          });
          steps.push(top);
        }
        prev = now;
      }
      const sorted = steps.slice().sort((a, b) => a - b), median = sorted[12], top = sorted[23];
      assert.ok(top < 0.05 && top < 3 * median + 2e-3, `${text} ${c.id}: one 1 % step of its length moves a comma by ${top.toFixed(4)}, the usual step by ${median.toFixed(4)}`);
    }
  }
});

test('a number is kept inside what can be drawn', () => {
  const s = openOrbifold('3333'), c = cutsOf(s)[0], r = rangeOf(s, c.id, 'len');
  assert.equal(withParam(s, c.id, 'len', 1e-9).params[c.id].len, r[0]);
  assert.equal(withParam(s, c.id, 'len', 99).params[c.id].len, r[1]);
  assert.equal(withParam(s, c.id, 'tw', 3).params[c.id].tw, 0.5);
  assert.equal(withParam(s, 'nope', 'len', 2), s);
  const flat = openOrbifold('**'), f = cutsOf(flat)[0], fr = rangeOf(flat, f.id, 'len');
  assert.ok(fr[0] < f.len && f.len < fr[1]);
});

test('a flip that cannot be drawn is refused with the length it would make and the limit', () => {
  let s = openOrbifold('oo');
  s = withMove(s, cutsOf(s)[0].id, 'A').state;
  assert.throws(() => withMove(s, cutsOf(s)[1].id, 'A'), (e) => e.refused === true && e.cut === 'cuff' && e.limit === LIMIT.cuff && e.len > LIMIT.cuff);
  assert.throws(() => withMove(openOrbifold('*532'), 'c0', 'A'), /no cuts/);
});

test('an address for another orbifold, or with numbers that cannot be, falls back to the canonical cut', () => {
  const good = openOrbifold('3333');
  const wrong = openOrbifold('3333', { d: 'uu-Pu1.u1.u0_Pu0.n3.n3', p: [[2, 0], [2, 0]] });        // o33's cut
  assert.equal(linkOf(wrong), linkOf(good));
  const wild = openOrbifold('3333', readLink('#k=3333&d=u-Pu0.n3.n3_Pu0.n3.n3&p=999_7').saved);
  assert.ok(cutsOf(wild)[0].len < 10);
  assert.equal(readLink(''), null);
  assert.equal(readLink('#nothing'), null);
});

test('random numbers and random flips: the model never throws anything but a refusal', () => {
  const rnd = rng(21);
  let flips = 0, refused = 0;
  for (const text of ['3333', '333*2x', 'o33', '33*2', '32*54', '***', '2223x', '2222', 'o', '22*']) {
    let s = openOrbifold(text);
    for (let i = 0; i < 12; i++) {
      const cuts = cutsOf(s), c = cuts[Math.floor(rnd() * cuts.length)];
      if (rnd() < 0.5) { const r = rangeOf(s, c.id, 'len'); s = withParam(s, c.id, 'len', Math.min(4.5, r[0] * 2 + rnd() * 3)); if (c.twist) s = withParam(s, c.id, 'tw', rnd() - 0.5); continue; }
      if (!c.moves.length) continue;
      try { s = withMove(s, c.id, c.moves[Math.floor(rnd() * c.moves.length)].kind).state; flips++; } catch (err) { assert.ok(err.refused, `${text}: ${err.message}`); refused++; }
    }
  }
  assert.ok(flips > 20, `${flips} flips, ${refused} refused`);
});
