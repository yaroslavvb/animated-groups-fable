// The model the page drives: opening a signature, moving a number, flipping a cut, the print through all of it, the
// address that brings a state back, and the way back from a flip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openOrbifold, spell, withParam, withMove, relaid, cutsOf, sidesOf, crowdOf, linkOf, readLink, rangeOf, LIMIT, CROWD_MAX } from '../src/model.js';
import { crowding } from '../src/print.js';
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
      assert.ok(r.made.length > 0 && r.gone.length > 0);
      assert.equal(r.state.shapes.flat().length, s.shapes.flat().length, `${c.id} ${m.kind}: a comma came or went`);
      // the state after the flip has an address of its own, and comes back from it
      const l2 = readLink('#' + linkOf(r.state)), s2 = openOrbifold(l2.k, l2.saved);
      assert.equal(linkOf(s2), linkOf(r.state), `${c.id} ${m.kind}: the flipped state reads back`);
      // a number moved after a flip moves the commas a little, and changes none of them: nothing is laid afresh
      // (the first step after the flip is a step like the next one: no comma jumps to a new place)
      const c2 = cutsOf(r.state)[0], s3 = withParam(r.state, c2.id, 'len', c2.len * 1.01), s4 = withParam(s3, c2.id, 'len', c2.len * 1.02);
      assert.equal(s3.motifs.length, r.state.motifs.length);
      const G = s3.atlas.G, step = (p, q) => { let top = 0; q.shapes.forEach((list, a) => list.forEach((sh, j) => { assert.equal(sh.size, p.shapes[a][j].size, `${c.id} ${m.kind}: a comma changed its size`); top = Math.max(top, G.dist(sh.c, p.shapes[a][j].c)); })); return top; };
      const d1 = step(r.state, s3), d2 = step(s3, s4);
      assert.ok(d1 < 2.5 * d2 + 2e-3, `${c.id} ${m.kind}: the first 1 % step after the flip moved a comma by ${d1}, the next by ${d2}`);
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

/** The shape of a comma as distances between some of its points: the same for two commas exactly when one is the other moved. */
const shapeOf = (G, sh) => { const k = [0, 7, 15, 23, 31, 40], out = []; for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) out.push(G.dist(sh.pts[k[i] % sh.pts.length], sh.pts[k[j] % sh.pts.length])); return out; };

test('a comma is only ever moved: no number and no flip changes its shape or its size, and none comes or goes', () => {
  const rnd = rng(8);
  for (const text of ['3333', '2223', '333*2x', 'o33', '33*2', '32*54', '***', '*22222', '2222', 'o', '**', '*x']) {
    let s = openOrbifold(text);
    const first = s.shapes.flat().map((sh) => shapeOf(s.atlas.G, sh)).sort((a, b) => a[0] - b[0] || a[1] - b[1]), count = first.length;
    assert.ok(count > 0, text);
    for (let i = 0; i < 14; i++) {
      const cuts = cutsOf(s), c = cuts[Math.floor(rnd() * cuts.length)], pick = rnd();
      if (pick < 0.35) s = withParam(s, c.id, 'len', c.len * (0.8 + 0.5 * rnd()));
      else if (pick < 0.6 && c.twist) s = withParam(s, c.id, 'tw', rnd() - 0.5);
      else if (c.moves.length) { try { s = withMove(s, c.id, c.moves[Math.floor(rnd() * c.moves.length)].kind).state; } catch (err) { assert.ok(err.refused, `${text}: ${err.message}`); } }
      const now = s.shapes.flat().map((sh) => shapeOf(s.atlas.G, sh)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      assert.equal(now.length, count, `${text}, step ${i + 1}: there were ${count} commas and there are ${now.length}`);
      now.forEach((d, k) => d.forEach((x, j) => assert.ok(Math.abs(x - first[k][j]) < 1e-7, `${text}, step ${i + 1}: a comma has changed its shape (${x} for ${first[k][j]})`)));
    }
  }
});

test('the print is laid so that no two commas touch, a flip leaves it as crowded as it was, and a Length stops before they run into each other', () => {
  for (const text of ['3333', '2223', '22222', '333*2x', 'o33', 'oo', '33*2', '***', '*22222', '32*54', '2222', 'o', '*2222', '**', '22*', '*x']) {
    const s = openOrbifold(text);
    assert.equal(crowdOf(s), 0, `${text}: commas touch as the print is laid`);
    for (const c of cutsOf(s)) {
      // a Length taken as far as its slider goes, both ways
      for (const end of rangeOf(s, c.id, 'len')) {
        const t = withParam(s, c.id, 'len', end);
        assert.ok(crowdOf(t) <= CROWD_MAX + 1e-6, `${text} ${c.id}: at ${t.params[c.id].len} the commas run ${crowdOf(t)} into each other`);
        if (t.limited) assert.ok(Math.abs(t.params[c.id].len - end) > 1e-3 && crowdOf(t) > CROWD_MAX - 0.05, `${text} ${c.id}: stopped at ${t.params[c.id].len} with the commas ${crowdOf(t)} into each other`);
        else assert.ok(Math.abs(t.params[c.id].len - end) < 1e-9);
      }
      for (const m of c.moves) {
        let r;
        try { r = withMove(s, c.id, m.kind); } catch (err) { assert.ok(err.refused); continue; }
        assert.ok(Math.abs(crowding(r.state.atlas, r.state.shapes).worst - crowdOf(s)) < 1e-6, `${text} ${c.id} ${m.kind}: the flip changed how crowded the print is`);
      }
    }
  }
});

test('a Twist is never stopped, and a state more crowded than the limit may still move the way that is no worse', () => {
  let s = openOrbifold('3333');
  const c = cutsOf(s)[0];
  s = withMove(s, c.id, 'A').state;
  for (const tw of [-0.5, -0.2, 0.3, 0.5]) { const t = withParam(s, c.id, 'tw', tw); assert.equal(t.params[c.id].tw, tw); assert.ok(!t.limited); }
  // crowded on purpose: a twist after a flip carries commas over each other
  const crowded = withParam(s, c.id, 'tw', 0.31), before = crowdOf(crowded);
  const moved = withParam(crowded, c.id, 'len', crowded.params[c.id].len * 1.02);
  assert.ok(crowdOf(moved) <= Math.max(CROWD_MAX, before) + 1e-6);
});

test('the print laid afresh, when asked for, has no two commas touching', () => {
  let s = openOrbifold('333*2x');
  s = withMove(s, cutsOf(s)[0].id, 'pop').state;
  s = withParam(s, cutsOf(s)[2].id, 'tw', 0.37);
  const fresh = relaid(s);
  assert.equal(crowdOf(fresh), 0);
  assert.ok(fresh.shapes.flat().length > 0);
  assert.equal(linkOf(fresh), linkOf(s));
  assert.equal(relaid(openOrbifold('*532')).mode, 'rigid');
});

test('what a cut parts: the special points on its two sides', () => {
  const s = openOrbifold('333*2x'), cuts = cutsOf(s);
  assert.deepEqual(cuts.map((c) => c.parts && c.parts.join(' | ')), ['∗2 | 333×', null, '∗2× | 333', '3∗2× | 33']);
  const sides = sidesOf(s, cuts[3].id);
  assert.equal(Object.values(sides.marks).filter((x) => x === 1).length, 2);            // the two cone points 3 3
  assert.equal(Object.values(sides.marks).filter((x) => x === 0).length, 2);            // the third, and the mirror's corner
  // every mark of the atlas is on one side or the other
  for (const atom of s.atlas.atoms) for (const mk of atom.marks) assert.ok(sides.marks[mk.which === undefined ? `${mk.part}:${mk.end}` : `${mk.part}:${mk.end}:${mk.which}`] !== undefined);
  assert.equal(sidesOf(s, cuts[1].id), null);                                           // a crosscap parts nothing
  for (const text of ['oo', '***', 'o', '**', '*x']) for (const c of cutsOf(openOrbifold(text))) assert.equal(c.parts, null, `${text} ${c.id}`);
  assert.deepEqual(cutsOf(openOrbifold('3333'))[0].parts, ['33', '33']);
  assert.deepEqual(cutsOf(openOrbifold('2223'))[0].parts.slice().sort(), ['22', '32']);
  assert.deepEqual(cutsOf(openOrbifold('2222'))[0].parts, ['22', '22']);
  assert.deepEqual(cutsOf(openOrbifold('*2222'))[0].parts, ['∗22', '∗22']);
  // after a flip the same special points are parted another way
  const flipped = withMove(openOrbifold('3333'), 'c0', 'A').state;
  assert.deepEqual(cutsOf(flipped)[0].parts, ['33', '33']);
});

test('a link opens the same orbifold cut the same way, with the print laid as that decomposition first has it and moved to the numbers', () => {
  const a = withParam(withParam(openOrbifold('3333'), 'c0', 'len', 3.1), 'c0', 'tw', 0.2);
  const link = readLink('#' + linkOf(a)), b = openOrbifold(link.k, link.saved);
  assert.equal(linkOf(b), linkOf(a));
  const G = a.atlas.G;
  a.shapes.forEach((list, atom) => list.forEach((sh, j) => assert.ok(G.dist(sh.c, b.shapes[atom][j].c) < 1e-3 && sh.size === b.shapes[atom][j].size, 'the print of the link is the print of the page')));
});

test('a number is kept inside what can be drawn', () => {
  const s = openOrbifold('3333'), c = cutsOf(s)[0], r = rangeOf(s, c.id, 'len');
  assert.equal(withParam(s, c.id, 'len', 1e-9).params[c.id].len, r[0]);
  const long = withParam(s, c.id, 'len', 99);
  assert.ok(long.limited && long.params[c.id].len > c.len * 1.3 && long.params[c.id].len < r[1], `stopped at ${long.params[c.id].len}`);
  assert.equal(withParam(s, c.id, 'tw', 3).params[c.id].tw, 0.5);
  assert.equal(withParam(s, 'nope', 'len', 2), s);
  const flat = openOrbifold('**'), f = cutsOf(flat)[0], fr = rangeOf(flat, f.id, 'len');
  assert.ok(fr[0] < f.len && f.len < fr[1]);
  // a cut a flip has made shorter than a slider goes keeps its place, and the slider reaches to it
  const far = withMove(openOrbifold('2223'), 'c0', 'A').state, made = cutsOf(far)[0];
  assert.ok(made.len < 0.6 && rangeOf(far, made.id, 'len')[0] === made.len, `the flip made ${made.len}`);
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
