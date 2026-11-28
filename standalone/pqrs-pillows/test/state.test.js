// state.test.js — the contract of src/state.js (SPEC § 3.1): presets and typed orders, the three cards, activation,
// the cut's numbers and the coupling of the cards, the address, the two pillows in numbers.
//   node --test test/state.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/state.js';
import * as F from '../src/flips.js';
import * as P from '../src/pillow.js';
import { FAMILIES, GH, GE, centredFor, pairLength, hgt, pairDistance } from '../../two-features-two-handles/src/handles.js';
import { apply } from '../../classification-of-surfaces/src/sym/geom.js';

const TAU = 2 * Math.PI;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (off by ${Math.abs(a - b).toExponential(2)}, allowed ${tol})`);
const geo = (st) => (S.kindOf(st) === 'E' ? GE : GH);
const onH = (v) => [v[0], v[1], Math.sqrt(1 + v[0] * v[0] + v[1] * v[1])];
const carry = (st, M, p) => (S.kindOf(st) === 'E' ? apply(M, p) : onH(apply(M, p)));
const cardOf = (st, key) => S.cardsOf(st).find((c) => c.key === key);
/** A triangle's three indices (Math.round gives -0 for a small negative number: the same index). */
const triple = (t) => [t.k, t.lo, t.hi].map((v) => v + 0);
const SIGS = [...S.PRESETS, '2346'];
/** States away from the defaults: (signature, Length, Twist). */
const MOVED = [['3333', 2.2, 0.13], ['3333', 4.1, 0.2], ['2345', 1.7, -0.31], ['2223', 1.6, 0.1], ['2222', 1.2, 0.1], ['2222', 0.8, -0.37], ['4444', 2.5, 0.42], ['2346', 3.3, -0.07], ['2233', 1.9, 0.27], ['9999', 3.1, -0.44]];
const moved = ([sig, L, tw]) => S.withNumbers(S.stateFor(sig), { L, tw });

test('presets and typed orders: four cone points at the engine\'s defaults', () => {
  assert.deepEqual(S.PRESETS, ['2222', '3333', '2223', '2345', '4444']);
  assert.deepEqual(S.CARD_KEYS, ['01|23', '02|13', '03|12']);
  for (const sig of SIGS) {
    const st = S.stateFor(sig), fam = FAMILIES[sig];
    assert.ok(st, sig);
    assert.equal(st.k, sig);
    assert.deepEqual(st.perm.slice().sort(), [0, 1, 2, 3]);
    assert.equal(st.perm.join(''), fam.defaultM);
    assert.deepEqual(st.orders, st.perm.map((c) => fam.baseOrders[c]));
    assert.equal(st.L, fam.defaultL);
    assert.equal(st.tw, 0);
    assert.equal(st.b, 0); assert.equal(st.tau, 0); assert.equal(st.print, null);
    assert.equal(st.thetas.length, 4);
    assert.equal(S.kindOf(st), sig === '2222' ? 'E' : 'H');
    // P, Q, R, S are the digits as typed, whatever the slots
    for (let f = 0; f < 4; f++) { assert.equal(S.featureOrder(st, f), Number(sig[f])); assert.equal(S.featureLabel(st, f), 'PQRS'[f] + sig[f]); }
  }
  assert.deepEqual([0, 1, 2, 3].map(S.featureName), ['P', 'Q', 'R', 'S']);
  near(S.stateFor('3333').L, 2 * Math.acosh(2), 1e-15);
  near(S.stateFor('2223').L, Math.acosh(2), 1e-15);
  assert.equal(S.stateFor('2223').perm.join(''), '3012');
  assert.equal(S.stateFor('2222').L, 1);
  near(S.stateFor('2346').L, 2.559249, 1e-6);
  // loose spellings name the same family; the order typed is kept
  for (const t of ['2 3 4 6', '2,3,4,6', ' 2346 ', '23 46']) assert.equal(S.stateFor(t).k, '2346', t);
  assert.equal(S.stateFor('6432').k, '6432');
  assert.equal(S.featureOrder(S.stateFor('6432'), 0), 6);
  // what is not four cone points of orders 2..9
  for (const t of ['', ' ', null, undefined, '333', '22222', '333*', '*333', 'o33', '333x', '2341', '234a', '2340', '23456', 'abcd', '2.345', 2345.5]) assert.equal(S.stateFor(t), null, String(t));
  assert.equal(S.stateFor(2345).k, '2345');
});

test('cardsOf: three cards in the fixed order 01|23, 02|13, 03|12, each with its loop\'s numbers', () => {
  for (const st of [...SIGS.map(S.stateFor), ...MOVED.map(moved)]) {
    const cards = S.cardsOf(st), tr = F.triangle(st), kind = S.kindOf(st), G = geo(st), where = `${st.k} L ${st.L} tw ${st.tw}`;
    assert.deepEqual(cards.map((c) => c.key), S.CARD_KEYS, where);
    assert.deepEqual(cards.filter((c) => c.active).map((c) => c.key), [S.keyOf(st)], where);
    for (const c of cards) {
      const lp = tr.loops.find((l) => l.key === c.key);
      assert.equal(c.L, lp.L); assert.equal(c.tw, lp.tw); assert.equal(c.length, lp.length); assert.equal(c.minimal, lp.minimal);
      assert.equal(c.length, kind === 'E' ? 2 * c.L : c.L, 'the closed curve: 2 L on 2222');
      if (c.active) { assert.equal(c.L, st.L); assert.equal(c.tw, st.tw); assert.equal(c.id, 'cut'); }
      // pairs: the partition the key names, each pair in increasing order
      assert.deepEqual(c.pairs.flat().slice().sort(), [0, 1, 2, 3]);
      assert.equal(F.pairingKey(c.pairs), c.key);
      for (const pr of c.pairs) assert.ok(pr[0] < pr[1]);
      // ranges: the slider's own, and the card's Length is always inside
      assert.deepEqual(c.twRange, [-0.5, 0.5]);
      assert.ok(c.lRange[0] <= c.L && c.L <= c.lRange[1], `${where} ${c.key}: L ${c.L} in ${c.lRange}`);
      if (kind === 'E') { if (c.L >= 0.5 && c.L <= 2 / 1.08) assert.deepEqual(c.lRange, [0.5, 2]); }
      else if (c.L >= 0.4 && c.L <= 7 / 1.08) assert.deepEqual(c.lRange, [0.4, 7]);
      // geometry for drawing: two arcs between cone points, each giving the loop's Length (F1; on the plane the arc is the Length)
      assert.equal(c.seals.length, 2);
      c.seals.forEach((seal, i) => {
        const d = G.dist(seal[0], seal[1]), n = c.orders.slice(2 * i, 2 * i + 2);
        near(kind === 'E' ? d : pairLength(n[0], n[1], d), c.L, 1e-9, `${where} ${c.key} seal ${i}`);
      });
      assert.equal(c.seg.length, 2);
      assert.ok(c.seg.flat().every(Number.isFinite));
      if (kind === 'E') { assert.equal(c.ends, null); assert.equal(c.dir.length, 2); }
      else { assert.equal(c.ends.length, 2); for (const e of c.ends) near(Math.hypot(e[0], e[1]), 1, 1e-9, 'an end lies on the circle'); }
      // the slots and orders of the state it leads to
      assert.deepEqual(c.orders, c.perm.map((f) => S.featureOrder(st, f)));
      assert.deepEqual(c.pairs, [[c.perm[0], c.perm[1]], [c.perm[2], c.perm[3]]].map((p) => p.slice().sort()));
    }
    // the active card's seals are the engine's own cone points A-B and C-D
    const home = centredFor(st).home, act = cards.find((c) => c.active);
    [[0, 1], [2, 3]].forEach((sl, i) => sl.forEach((s, x) => near(G.dist(act.seals[i][x], home[s]), 0, 1e-9, `${where}: seal ${i} end ${x} is the engine's cone point`)));
  }
  // the numbers the brief was given for 3333
  const c = S.cardsOf(S.stateFor('3333'));
  near(c[0].L, 2.633916, 1e-6); near(c[0].tw, 0, 1e-12);
  near(c[1].L, 2.633916, 1e-6); near(c[1].tw, 0, 1e-12);
  near(c[2].L, 3.849695, 1e-6); near(c[2].tw, 0.25, 1e-12);
  // 2222: the engine's L is the pair's spacing
  const e = S.cardsOf(S.stateFor('2222'));
  assert.deepEqual(e.map((x) => +x.L.toFixed(6)), [1, 1, 1.414214]);
  assert.deepEqual(e.map((x) => x.lRange), [[0.5, 2], [0.5, 2], [0.5, 2]]);
  // a range follows a Length that a flip led outside the slider's own
  assert.deepEqual(S.lengthRange('H', 9), [0.4, 9.72]);
  near(S.lengthRange('H', 0.2)[0], 0.184, 1e-12); assert.equal(S.lengthRange('H', 0.2)[1], 7);
  assert.deepEqual(S.lengthRange('H', 30), [0.4, 30]);
  assert.deepEqual(S.lengthRange('E', 2.06), [0.5, 2.06 * 1.08]);
  // inside the slider's own range the least stays put; the 8 % stop at the outer limits
  assert.deepEqual(S.lengthRange('H', 0.4), [0.4, 7]);
  assert.deepEqual(S.lengthRange('H', 3), [0.4, 7]);
  assert.deepEqual(S.lengthRange('H', 15.5), [0.4, 16]);
  assert.deepEqual(S.lengthRange('H', 0.051), [0.05, 7]);
  assert.deepEqual(S.lengthRange('H', 0.03), [0.03, 7]);
  assert.deepEqual(S.lengthRange('E', 0.5), [0.5, 2]);
  assert.deepEqual(S.lengthRange('E', 1), [0.5, 2]);
});

test('cardsOf: pairs[0] is the picked pair once the card is active; a pair of 2s is said', () => {
  for (const st of [S.stateFor('3333'), S.stateFor('2345'), moved(MOVED[0]), moved(MOVED[4])]) {
    for (const c of S.cardsOf(st)) {
      const next = S.activate(st, c.key).state;
      assert.deepEqual([next.perm[0], next.perm[1]].sort(), c.pairs[0], `${st.k} ${c.key}`);
      assert.deepEqual(next.perm, c.perm);
      assert.deepEqual(next.orders, c.orders);
    }
  }
  // 2223: every partition has a pair of 2s on one side
  for (const c of S.cardsOf(S.stateFor('2223'))) {
    assert.ok(c.onTree === 'picked' || c.onTree === 'far', c.key);
    const twos = c.onTree === 'picked' ? c.pairs[0] : c.pairs[1];
    assert.deepEqual(twos.map((f) => S.featureOrder(S.stateFor('2223'), f)), [2, 2]);
    near(GH.dist(c.seg[0], c.seg[1]), c.L / 2, 1e-9, 'the loop is that pair\'s seal run twice');
  }
  assert.ok(S.cardsOf(S.stateFor('3333')).every((c) => c.onTree === null));
});

test('activate: a flip that changes the cut and nothing else; flip back and three round return home', () => {
  let nStates = 0, worstBack = 0, worstRound = 0, worstFace = 0, worstCards = 0;
  for (const st of [...SIGS.map(S.stateFor), ...MOVED.map(moved)]) {
    nStates++;
    const where = `${st.k} L ${st.L} tw ${st.tw}`, snapshot = JSON.stringify(st), cards0 = S.cardsOf(st), G = geo(st), tr0 = F.triangle(st);
    // the cut itself: nothing happens
    const same = S.activate(st, S.keyOf(st));
    assert.equal(same.changed, false); assert.equal(same.state, st); assert.equal(same.before, st);
    assert.deepEqual(Array.from(same.invQ), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const others = S.CARD_KEYS.filter((k) => k !== S.keyOf(st));
    for (const key of others) {
      const r = S.activate(st, key), next = r.state;
      assert.equal(r.changed, true); assert.equal(r.before, st);
      assert.equal(JSON.stringify(st), snapshot, 'the state given is left as it was');
      assert.equal(S.keyOf(next), key, where);
      assert.equal(next.k, st.k);
      assert.ok(next.tri && Number.isInteger(next.tri.k) && next.tri.L === next.L && next.tri.tw === next.tw, 'the triangle is carried, stamped');
      assert.ok(next.print && Array.isArray(next.print.specs), 'the print is tied anew (retiePrint)');
      assert.ok(Math.abs(next.tw) <= 0.5);
      // the numbers are the card's
      const c = cards0.find((x) => x.key === key);
      near(next.L, c.L, 1e-12); near(next.tw, c.tw, 1e-12);
      // every card keeps its numbers: only `active` has moved
      for (const c1 of S.cardsOf(next)) {
        const c0 = cards0.find((x) => x.key === c1.key);
        worstCards = Math.max(worstCards, Math.abs(c1.L - c0.L), Math.abs(c1.tw - c0.tw));
        near(c1.L, c0.L, 1e-9, `${where} -> ${key}: card ${c1.key} Length`);
        near(c1.tw, c0.tw, 1e-9, `${where} -> ${key}: card ${c1.key} Twist`);
        assert.equal(c1.active, c1.key === key);
        assert.deepEqual(c1.pairs, c0.pairs, 'a card names its pairs the same way from every state round the face');
      }
      // the face of the triangle does not move: the new face, carried back by invQ, is the old one
      const face1 = F.triangle(next).face.map((p) => carry(st, r.invQ, p));
      for (const p of face1) { const d = Math.min(...tr0.face.map((q) => G.dist(p, q))); worstFace = Math.max(worstFace, d); near(d, 0, 1e-9, `${where} -> ${key}: a corner of the face moved`); }
      // Q and invQ are inverse motions
      const probe = tr0.face[2];
      near(G.dist(carry(st, r.invQ, carry(st, r.Q, probe)), probe), 0, 1e-9, 'invQ undoes Q');
      // and back: the same numbers, the same slots, the same comma angles
      const back = S.activate(next, S.keyOf(st)).state;
      worstBack = Math.max(worstBack, Math.abs(back.L - st.L), Math.abs(back.tw - st.tw));
      near(back.L, st.L, 1e-9, `${where} -> ${key} -> back: Length`);
      near(back.tw, st.tw, 1e-9, `${where} -> ${key} -> back: Twist`);
      assert.deepEqual(back.perm, st.perm); assert.deepEqual(back.orders, st.orders);
      back.thetas.forEach((t, i) => near(t, st.thetas[i], 1e-9, 'comma angle'));
    }
    // three activations round, both ways
    for (const round of [others, others.slice().reverse()]) {
      let cur = st;
      for (const key of [...round, S.keyOf(st)]) cur = S.activate(cur, key).state;
      worstRound = Math.max(worstRound, Math.abs(cur.L - st.L), Math.abs(cur.tw - st.tw));
      near(cur.L, st.L, 1e-9, `${where}: three round, Length`);
      near(cur.tw, st.tw, 1e-9, `${where}: three round, Twist`);
      assert.deepEqual(cur.perm, st.perm);
      cur.thetas.forEach((t, i) => near(t, st.thetas[i], 1e-9, 'comma angle'));
    }
  }
  console.log(`    activate: ${nStates} states; flip and back off by ${worstBack.toExponential(1)}, three round ${worstRound.toExponential(1)}, a card's numbers across a flip ${worstCards.toExponential(1)}, the face ${worstFace.toExponential(1)}`);
});

test('activate: any listing of a partition names it; what is none throws', () => {
  const st = moved(MOVED[0]), want = S.activate(st, '02|13').state;
  for (const key of ['13|02', '20|31', '31|20', ' 02|13 ', [[0, 2], [1, 3]], [[3, 1], [2, 0]], [0, 2], [1, 3], [3, 1]]) {
    const got = S.activate(st, key).state;
    assert.equal(got.L, want.L); assert.equal(got.tw, want.tw); assert.deepEqual(got.perm, want.perm);
  }
  for (const bad of ['', '01|22', '01|24', '0123', 'lo', null, undefined, 1, [0, 0], [[0, 1], [1, 2]], [0, 1, 2]]) assert.throws(() => S.activate(st, bad), /no such partition/, String(bad));
});

test('withNumbers: the cut\'s Length and Twist, clamped; the three loops go on', () => {
  const st = S.stateFor('3333');
  assert.equal(S.withNumbers(st, {}), st, 'nothing asked: the same state');
  assert.equal(S.withNumbers(st, { L: st.L, tw: st.tw }), st);
  assert.equal(S.withNumbers(st, { L: NaN, tw: undefined }), st);
  assert.equal(S.withNumbers(st), st);
  const snapshot = JSON.stringify(st);
  const a = S.withNumbers(st, { L: 3.1 }), b = S.withNumbers(st, { tw: -0.2 }), c = S.withNumbers(st, { L: 1.5, tw: 0.4 });
  assert.equal(JSON.stringify(st), snapshot, 'the state given is left as it was');
  assert.equal(a.L, 3.1); assert.equal(a.tw, 0);
  assert.equal(b.L, st.L); assert.equal(b.tw, -0.2);
  assert.equal(c.L, 1.5); assert.equal(c.tw, 0.4);
  for (const x of [a, b, c]) { assert.deepEqual(x.perm, st.perm); assert.deepEqual(x.orders, st.orders); assert.equal(x.k, st.k); assert.deepEqual(x.thetas, st.thetas); }
  // clamped to the ranges
  assert.equal(S.withNumbers(st, { L: 99 }).L, 7);
  assert.equal(S.withNumbers(st, { L: 0.01 }).L, 0.4);
  assert.equal(S.withNumbers(st, { L: -3 }).L, 0.4);
  assert.equal(S.withNumbers(st, { tw: 0.7 }).tw, 0.5);
  assert.equal(S.withNumbers(st, { tw: -9 }).tw, -0.5);
  const flat = S.stateFor('2222');
  assert.equal(S.withNumbers(flat, { L: 99 }).L, 2);
  assert.equal(S.withNumbers(flat, { L: 0.1 }).L, 0.5);
  // a range a slider holds through a drag
  assert.equal(S.withNumbers(st, { L: 9 }, { lRange: [0.4, 9.72] }).L, 9);
  // after a flip to a Length outside the slider's own range the range has followed, and the Length stays reachable
  const long = S.activate(S.withNumbers(st, { L: 0.4 }), '03|12').state;
  assert.ok(long.L > 7, `a flip from the shortest cut leads past 7: ${long.L}`);
  assert.equal(S.withNumbers(long, { L: long.L + 1e-3 }).L, long.L + 1e-3);
  assert.ok(S.withNumbers(long, { L: 99 }).L <= Math.max(16, long.L) + 1e-12);
  // after a flip, a move of either number keeps the three loops: from a state on its natural triangle whose cut is
  // no longer than its twin they are the natural triangle's again
  const flipped = S.activate(moved(MOVED[0]), '02|13').state;
  assert.ok(flipped.tri);
  for (const mv of [{ L: flipped.L * 1.01 }, { tw: flipped.tw > 0 ? flipped.tw - 0.01 : flipped.tw + 0.01 }]) {
    const next = S.withNumbers(flipped, mv);
    assert.equal(F.triangle(next).natural, true);
    assert.deepEqual([next.tri.L, next.tri.tw], [next.L, next.tw], 'the triangle is stamped with the new numbers');
    assert.equal(S.keyOf(next), S.keyOf(flipped));
    assert.equal(next.print, flipped.print, 'the print stays tied to the cut');
  }
  // leaving a cut that is longer than its twin (3333 at Length 4.1, Twist 0.2): the card just left keeps its loop
  // when another card's slider moves (the natural triangle would put the twin, 3.707 long, in its place)
  const long0 = moved(MOVED[1]), there = S.activate(long0, '02|13').state, on = S.withNumbers(there, { L: there.L + 1e-6 });
  assert.equal(S.cardsOf(long0)[0].minimal, false);
  near(S.cardsOf(on)[0].L, 4.1, 1e-4, 'the card just left keeps its Length');
  near(S.cardsOf(on)[0].tw, 0.2, 1e-4, 'and its Twist');
  assert.equal(F.triangle(on).natural, false);
  near(2 * Math.acosh(F.triangle(on).loops.find((lp) => lp.key === '01|23').partner), 3.706781, 1e-4, 'its twin is the shorter one');
  const homeAgain = S.activate(on, '01|23').state;
  near(homeAgain.L, 4.1, 1e-4, 'and going back to it finds it where it was left'); near(homeAgain.tw, 0.2, 1e-4);
  assert.equal(S.withNumbers(flipped, { L: flipped.L, tw: flipped.tw }), flipped, 'nothing moved: the triangle is kept');
});

test('the coupling: after a move of the active card the other two cards are the triangle\'s, and true', () => {
  let n = 0, worst = 0;
  for (const base of MOVED.map(moved)) for (const key of S.CARD_KEYS) {
    // touch a slider of card `key`: first it is made active, then its number moves
    const act = S.activate(base, key).state;
    for (const mv of [{ L: act.L * 1.07 }, { tw: act.tw > 0 ? act.tw - 0.05 : act.tw + 0.05 }, { L: act.L * 0.95, tw: act.tw > 0 ? act.tw - 0.11 : act.tw + 0.11 }]) {
      const st = S.withNumbers(act, mv), cards = S.cardsOf(st), tr = F.triangle(st);
      n++;
      // the triangle is the natural one exactly when neither inactive loop is longer than its twin
      assert.equal(tr.natural || Math.abs(st.tw) < 1e-9, tr.loops[1].minimal && tr.loops[2].minimal, `${st.k} L ${st.L} tw ${st.tw}: natural ${tr.natural}`);
      for (const c of cards) {
        const lp = tr.loops.find((l) => l.key === c.key);
        assert.equal(c.L, lp.L); assert.equal(c.tw, lp.tw);
        assert.equal(c.active, c.key === key);
        // true: the flip to that card gives exactly the numbers the card showed
        const there = F.flip(st, c.key).state;
        worst = Math.max(worst, Math.abs(there.L - c.L), Math.abs(there.tw - c.tw));
        near(there.L, c.L, 1e-12); near(there.tw, c.tw, 1e-12);
        // and the loop has that length whichever way it is measured: the one-line closed form of flips.js
        if (!c.active) near(F.neighbour(st, c.index).L, c.L, 1e-9, `${st.k} ${c.key}: closed form`);
      }
      // the three Lengths satisfy the relation of the triangle (the cubic; Heron on the plane)
      near(tr.residual, 0, 1e-9, 'trace relation');
    }
  }
  console.log(`    coupling: ${n} moved states x 3 cards; a card against the flip to it: ${worst.toExponential(1)}`);
});

test('a drag of Twist through 0 (and across the whole range) keeps every card\'s Length continuous', () => {
  const lines = [];
  for (const [sig, L] of [['3333', null], ['2345', null], ['2223', null], ['2222', null], ['3333', 4.1], ['2346', 1.1], ['2222', 1.7]]) {
    const base = L ? S.withNumbers(S.stateFor(sig), { L }) : S.stateFor(sig);
    // (a) straight through 0: the two sides agree in every card's Length; one card's loop has given way to its twin
    const eps = 1e-7, lo = S.cardsOf(S.withNumbers(base, { tw: -eps })), hi = S.cardsOf(S.withNumbers(base, { tw: eps })), at0 = S.cardsOf(S.withNumbers(base, { tw: 0 }));
    let swapped = 0;
    for (let i = 0; i < 3; i++) {
      near(lo[i].L, hi[i].L, 1e-5, `${sig}: card ${lo[i].key} Length either side of Twist 0`);
      near(at0[i].L, hi[i].L, 1e-5, `${sig}: card ${lo[i].key} Length at Twist 0`);
      assert.equal(lo[i].key, hi[i].key);
      if (lo[i].index !== hi[i].index) swapped++; else near(lo[i].tw, hi[i].tw, 1e-5, `${sig}: card ${lo[i].key} Twist either side of 0`);
    }
    assert.equal(swapped, 1, `${sig}: exactly one card's loop gives way to its twin at Twist 0`);
    // ... and that card's Twist changes sign: the twin is the mirror image
    {
      const e2 = 2e-3, a = S.cardsOf(S.withNumbers(base, { tw: -e2 })), b = S.cardsOf(S.withNumbers(base, { tw: e2 }));
      const i = [0, 1, 2].find((x) => a[x].index !== b[x].index);
      near(a[i].tw, -b[i].tw, 0.02, `${sig}: card ${a[i].key}: the twin has the opposite Twist`);
      near(a[i].L, b[i].L, 0.02 * Math.max(1, base.L), `${sig}: card ${a[i].key}: and the same Length`);
      // dragged through 0 and back, the card shows what it showed
      const there = S.withNumbers(S.withNumbers(base, { tw: e2 }), { tw: -e2 }), again = S.withNumbers(there, { tw: e2 });
      near(S.cardsOf(there)[i].tw, a[i].tw, 1e-9, `${sig}: through 0 from the other side`);
      near(S.cardsOf(again)[i].tw, b[i].tw, 1e-9, `${sig}: and back`);
    }
    // (b) the whole drag, -1/2 .. 1/2 in steps of 0.001: no card's Length jumps (the largest step is of the size of the steps away from 0)
    let prev = null, worst = 0, worstAt0 = 0, nSwaps = 0;
    for (let i = -500; i <= 500; i++) {
      const tw = i / 1000, cards = S.cardsOf(S.withNumbers(base, { tw }));
      assert.deepEqual(cards.map((c) => c.key), S.CARD_KEYS);
      assert.ok(cards.every((c) => Math.abs(c.tw) <= 0.5 + 1e-12));
      if (prev) cards.forEach((c, x) => {
        const d = Math.abs(c.L - prev[x].L);
        worst = Math.max(worst, d);
        if (i === 0 || i === 1) worstAt0 = Math.max(worstAt0, d);
        if (c.index !== prev[x].index && !c.active) nSwaps++;
      });
      prev = cards;
    }
    // d(Length') / d(Twist) is at most about 2 L (a loop that runs along the cut gains twice what the far pair slides): 0.001 of a turn moves a Length by less than 0.0025 L
    const bound = 0.0025 * Math.max(1, base.L) * (S.kindOf(base) === 'E' ? 2 : 1);
    assert.ok(worst < bound, `${sig} L ${base.L}: the largest step of a card's Length over the drag is ${worst}, allowed ${bound}`);
    assert.ok(worstAt0 <= worst + 1e-15);
    lines.push(`${sig} L ${base.L.toFixed(3)}: largest step ${worst.toExponential(2)} (at Twist 0: ${worstAt0.toExponential(2)}), ${nSwaps} change(s) of a loop for its twin`);
  }
  for (const l of lines) console.log('    ' + l);
});

test('under a real drag (each step from the state before) an inactive card\'s Twist is continuous: whole-turn wraps and the twin change only', () => {
  /** A drag of n steps; counts, over the two inactive cards: jumps of about half a turn, wraps of a whole turn, changes of a loop for its twin. */
  const drag = (sig, start, step, n) => {
    let st = S.withNumbers(S.stateFor(sig), start), prev = S.cardsOf(st);
    const out = { half: 0, whole: 0, twin: 0, worstTw: 0, worstL: 0 };
    for (let i = 1; i <= n; i++) {
      st = S.withNumbers(st, step(i / n));
      const cards = S.cardsOf(st);
      cards.forEach((c, x) => {
        if (c.active) return;
        assert.ok(Math.abs(c.tw) <= 0.5 + 1e-12);
        const d = Math.abs(c.tw - prev[x].tw);
        out.worstL = Math.max(out.worstL, Math.abs(c.L - prev[x].L));
        if (c.index !== prev[x].index) { out.twin++; near(c.tw, -prev[x].tw, 0.02, `${sig}: the twin's Twist is the mirror image`); }
        else if (d > 0.9) out.whole++;
        else if (d > 0.2) out.half++;
        else out.worstTw = Math.max(out.worstTw, d);
      });
      prev = cards;
    }
    return out;
  };
  const lines = [];
  for (const sig of [...S.PRESETS, '2346']) {
    const fam = S.stateFor(sig), flat = S.kindOf(fam) === 'E', [lo, hi] = flat ? [0.5, 2] : [0.4, 5];
    for (const tw of [0, 0.05, 0.2, -0.35]) {
      const o = drag(sig, { L: lo, tw }, (u) => ({ L: lo + u * (hi - lo) }), 1000);
      assert.equal(o.half, 0, `${sig}: a Length drag at Twist ${tw}: no jump by half a turn`);
      assert.equal(o.twin, 0, `${sig}: a Length drag changes no loop for its twin`);
      assert.ok(o.worstTw < 0.05, `${sig}: a Length drag at Twist ${tw}: largest step of an inactive Twist ${o.worstTw}`);
      lines.push(`${sig} Length ${lo} .. ${hi} at Twist ${tw}: ${o.whole} whole-turn wrap(s), largest step ${o.worstTw.toExponential(1)}`);
    }
    for (const L of flat ? [0.7, 1, 1.6] : [1, fam.L, 3.5]) {
      const o = drag(sig, { L, tw: -0.5 }, (u) => ({ tw: -0.5 + u }), 1000);
      assert.equal(o.half, 0, `${sig}: a Twist drag at Length ${L}: no jump by half a turn`);
      assert.equal(o.twin, 1, `${sig}: a Twist drag at Length ${L}: one card's loop gives way to its twin, once, at Twist 0`);
      assert.ok(o.worstTw < 0.1, `${sig}: a Twist drag at Length ${L}: largest step of an inactive Twist ${o.worstTw}`);          // (beside a long cut the loops across are short and wind fast)
      lines.push(`${sig} Twist -1/2 .. 1/2 at Length ${(+L).toFixed(3)}: ${o.whole} whole-turn wrap(s), largest step ${o.worstTw.toExponential(1)}`);
    }
  }
  console.log(`    ${lines.length} drags of 1000 steps: no jump by half a turn; ` + lines.filter((l) => !/ 0 whole/.test(l)).length + ' of them wrap by a whole turn somewhere');
  // by flips.js's rule alone (each state made afresh) the same drag jumps: the naming is what withNumbers adds
  let jumps = 0, prev = null;
  for (let i = 0; i <= 1000; i++) {
    const st = { ...S.stateFor('3333'), L: 0.4 + (4.6 * i) / 1000, tw: 0.05 }, cards = S.cardsOf(st);
    if (prev) cards.forEach((c, x) => { if (!c.active && Math.abs(c.tw - prev[x].tw) > 0.2 && Math.abs(c.tw - prev[x].tw) < 0.9) jumps++; });
    prev = cards;
  }
  assert.ok(jumps > 0, 'by the rule alone the Twist of an inactive card jumps by half a turn where it passes a quarter turn');
});

test('the address: grammar, the allowed characters, defaults', () => {
  assert.equal(S.toHash(S.stateFor('3333')), '#');
  assert.equal(S.toHash(S.stateFor('3333'), S.DEFAULT_UI), '#');
  assert.equal(S.toHash(S.stateFor('2346')), '#k=2346&m=0132&l=2.559&tw=0');
  assert.equal(S.toHash(S.stateFor('2222')), '#k=2222&m=0123&l=1&tw=0');
  assert.equal(S.toHash(S.stateFor('2223')), '#k=2223&m=3012&l=1.317&tw=0');
  assert.equal(S.toHash(moved(['3333', 2.2, 0.13])), '#k=3333&m=0123&l=2.2&tw=0.13');
  assert.equal(S.toHash(moved(['2345', 1.23456, -0.123456])), '#k=2345&m=0132&l=1.235&tw=-0.1235');
  assert.equal(S.toHash(S.withNumbers(S.stateFor('3333'), { tw: 1e-9 })), '#', 'a Twist that prints as 0 is the default');
  // just below 0 the diagonal card's loop is the other twin: the address says so (and never writes "-0")
  assert.equal(S.toHash(S.withNumbers(S.stateFor('3333'), { tw: -1e-9 })), '#k=3333&m=0123&l=2.634&tw=0&tri=0.-1.0');
  near(S.cardsOf(S.fromHash('#k=3333&m=0123&l=2.634&tw=0&tri=0.-1.0').state)[2].tw, -0.25, 1e-9, 'the twin of the diagonal loop reads minus a quarter turn');
  // the journey and the view; a comma travels as %2C
  assert.equal(S.toHash(S.stateFor('3333'), { j: 1 }), '#j=1');
  assert.equal(S.toHash(S.stateFor('2346'), { j: 1.5, az: 30, el: 20 }), '#k=2346&m=0132&l=2.559&tw=0&j=1.5&v=30%2C20');
  assert.equal(S.toHash(S.stateFor('3333'), { j: 0, az: 55, el: 16 }), '#');
  assert.equal(S.toHash(S.stateFor('3333'), { j: 7, az: 350.04, el: 123 }), '#j=2&v=-10%2C90');
  assert.equal(S.toHash(S.stateFor('3333'), { az: 12.345, el: -3.21 }), '#v=12.3%2C-3.2');
  // "#" alone, nothing, or parts that cannot be read: 3333 at the engine's defaults
  for (const t of ['#', '', null, undefined, '#tutorial', '#m=zzzz&l=abc&tw=', '#k=']) assert.deepEqual(S.fromHash(t), { state: S.stateFor('3333'), ui: { j: 0, jp: 0, az: 55, el: 16 } }, String(t));
  // not four cone points: null
  for (const t of ['#k=333*', '#k=22222', '#k=o33', '#k=33', '#k=hello', '#k=2341&m=0123']) assert.equal(S.fromHash(t), null, t);
  // only the allowed characters, for every state this file makes
  const all = [...SIGS.map(S.stateFor), ...MOVED.map(moved)];
  for (const st of all.slice()) for (const key of S.CARD_KEYS) all.push(S.activate(st, key).state);
  for (const st of all) for (const ui of [undefined, { j: 0.37, az: -151.3, el: 44.4 }]) {
    const h = S.toHash(st, ui);
    assert.match(h, /^#[A-Za-z0-9_.=%&/-]*$/, h);
    assert.match(h, /^#(k=[2-9]{4}&m=[0-3]{4}&l=[0-9.]+&tw=-?[0-9.]+(&tri=-?\d+\.(-?\d+|_)\.(-?\d+|_))?)?(&?j=[0-9.]+)?(&?v=-?[0-9.]+%2C-?[0-9.]+)?$/, h);
  }
});

test('the address: round trips (the five presets, a typed signature, a flipped state, a state with tri)', () => {
  // at the defaults the state comes back exactly: a number that prints as the family's default IS the default
  for (const sig of SIGS) {
    const st = S.stateFor(sig), back = S.fromHash(S.toHash(st, { j: 2, az: 40, el: -10 }));
    assert.deepEqual(back.state, st, sig);
    assert.deepEqual(back.ui, { j: 2, jp: 0, az: 40, el: -10 });
    assert.equal(S.fromHash(`#k=${sig}`).state.L, FAMILIES[sig].defaultL);
  }
  assert.equal(S.fromHash('#k=3333&m=0123&l=2.634&tw=0').state.L, 2 * Math.acosh(2));
  assert.equal(S.fromHash('#k=3333&m=0123&l=2.6339&tw=0.00004').state.L, 2 * Math.acosh(2));
  assert.equal(S.fromHash('#k=3333&m=0123&l=2.6339&tw=0.00004').state.tw, 0);
  assert.equal(S.fromHash('#k=3333&m=0123&l=2.635&tw=0').state.L, 2.635);
  // moved states: the numbers come back as printed (3 and 4 decimals), and the address of what came back is the same address
  for (const m of MOVED) {
    const st = moved(m), h = S.toHash(st), back = S.fromHash(h).state;
    assert.equal(back.k, st.k); assert.deepEqual(back.perm, st.perm); assert.deepEqual(back.orders, st.orders);
    near(back.L, st.L, 5.0001e-4); near(back.tw, st.tw, 5.0001e-5);
    assert.equal(S.toHash(back), h);
    assert.deepEqual(S.fromHash(S.toHash(back)).state, back, 'a state read from an address round-trips exactly');
  }
  // flipped states, with and without a triangle to carry: the same cards after a reload
  let withTri = 0, without = 0;
  for (const st0 of [...SIGS.map(S.stateFor), ...MOVED.map(moved)]) for (const key of S.CARD_KEYS) {
    const st = S.activate(st0, key).state;
    if (st === st0) continue;
    const h = S.toHash(st), back = S.fromHash(h).state, where = `${h} (from ${st0.k} L ${st0.L} tw ${st0.tw})`;
    if (/&tri=/.test(h)) withTri++; else without++;
    assert.equal(back.k, st.k); assert.deepEqual(back.perm, st.perm, where); assert.deepEqual(back.orders, st.orders);
    near(back.L, st.L, 5.0001e-4, where); near(back.tw, st.tw, 5.0001e-5, where);
    assert.equal(S.toHash(back), h, 'the address of what came back is the same address');
    // the same triangle: the same three loops, by their numbers in the fan and the naming of their far pairs
    assert.deepEqual(triple(F.triangle(back).tri), triple(F.triangle(st).tri), where);
    const c0 = S.cardsOf(st), c1 = S.cardsOf(back);
    for (let i = 0; i < 3; i++) {
      assert.equal(c1[i].active, c0[i].active);
      assert.deepEqual(c1[i].pairs, c0[i].pairs, where);
      // (a loop that runs far along a short cut moves a great deal with the cut's rounded numbers: relative, not absolute)
      near(c1[i].L, c0[i].L, 4e-3 * Math.max(1, c0[i].L), `${where}: card ${c0[i].key} Length`);
      near(c1[i].tw, c0[i].tw, 4e-3, `${where}: card ${c0[i].key} Twist`);
    }
    // a triangle from the address is stamped with the numbers read, and goes on with the sliders as after a flip:
    // a small move of the Length moves every card a little
    if (back.tri) {
      assert.equal(back.tri.L, back.L); assert.equal(back.tri.tw, back.tw);
      const mv = S.withNumbers(back, { L: back.L * 1.0001 }), c2 = S.cardsOf(mv);
      assert.deepEqual([mv.tri.L, mv.tri.tw], [mv.L, mv.tw]);
      for (let i = 0; i < 3; i++) { assert.equal(c2[i].index, c1[i].index, `${where}: card ${c1[i].key} keeps its loop`); near(c2[i].L, c1[i].L, 2e-2 * Math.max(1, c1[i].L), `${where}: card ${c1[i].key} Length after a small move`); }
    }
    // and the way home still leads home
    const home = S.activate(back, S.keyOf(st0)).state;
    near(home.L, st0.L, 4e-3 * Math.max(1, st0.L), `${where}: back to the first cut, Length`);
    near(home.tw, st0.tw, 4e-3, `${where}: back to the first cut, Twist`);
  }
  assert.ok(withTri > 0 && without > 0, `both kinds occurred: ${withTri} addresses with tri, ${without} without`);
  console.log(`    flipped states: ${withTri} addresses carry tri, ${without} need none`);
  // the two the task names
  assert.equal(S.toHash(S.activate(S.stateFor('3333'), '03|12').state), '#k=3333&m=1203&l=3.85&tw=0.25');
  assert.equal(S.toHash(S.activate(S.stateFor('3333'), '02|13').state), '#k=3333&m=2031&l=2.634&tw=0&tri=0.-1.-1');
  const t = S.fromHash('#k=3333&m=2031&l=2.634&tw=0&tri=0.-1.-1').state;
  assert.deepEqual(triple(t.tri), [0, -1, -1]);
  // there and back at the defaults is the default address again
  assert.equal(S.toHash(S.activate(S.activate(S.stateFor('3333'), '03|12').state, '01|23').state), '#');
});

test('the address: clamps, parts that cannot be read, a whole URL', () => {
  assert.equal(S.fromHash('#k=3333&l=99').state.L, 16);
  assert.equal(S.fromHash('#k=3333&l=0.0001').state.L, 0.05);
  assert.equal(S.fromHash('#k=2222&l=99').state.L, 5);
  assert.equal(S.fromHash('#k=2222&l=0.01').state.L, 0.2);
  assert.equal(S.fromHash('#k=3333&tw=3').state.tw, 0.5);
  assert.equal(S.fromHash('#k=3333&tw=-0.75').state.tw, -0.5);
  assert.equal(S.fromHash('#k=2345&m=0120&l=2&tw=0.1').state.perm.join(''), '0132', 'm must be a permutation of 0123');
  assert.equal(S.fromHash('#k=2345&m=01234').state.perm.join(''), '0132');
  for (const bad of ['x', '1.2.3.4', '999.0.0', '1e9.0.0', '-1', '_._._', '0.999.0']) assert.equal(S.fromHash(`#k=3333&m=2031&l=2.634&tw=0&tri=${bad}`).state.tri, undefined, bad);
  assert.deepEqual(S.fromHash('#k=3333&m=2031&l=2.634&tw=0&tri=0._._').state.tri, { k: 0, lo: null, hi: null, L: 2 * Math.acosh(2), tw: 0 });
  const u = S.fromHash('https://spacesheep.dev/@yaroslavvb/pqrs-pillows#k=2222&m=0123&l=1.2&tw=0.1&j=0.5&v=30,20');
  assert.equal(u.state.k, '2222'); assert.equal(u.state.L, 1.2); assert.equal(u.state.tw, 0.1);
  assert.deepEqual(u.ui, { j: 0.5, jp: 0, az: 30, el: 20 }, 'a plain comma in v is read too');
  assert.deepEqual(S.fromHash('k=2346&j=9&v=400%2C-200').ui, { j: 2, jp: 0, az: 40, el: -90 });
  assert.deepEqual(S.fromHash('#k=2346&j=x&v=1').ui, { j: 0, jp: 0, az: 55, el: 16 });
  // a link to another pair than the family's own opens with a print and four comma angles
  const st = S.fromHash('#k=3333&m=1203&l=3.85&tw=0.25').state;
  assert.equal(st.thetas.length, 4); assert.ok(st.thetas.every(Number.isFinite));
  assert.ok(centredFor(st).shapes.length > 0, 'the engine draws it');
});

test('pillowsOf: the two pillows in numbers (SPEC 1.5), from pillow.js', () => {
  for (const st of [...SIGS.map(S.stateFor), ...MOVED.map(moved)]) {
    const two = S.pillowsOf(st), kind = S.kindOf(st), where = `${st.k} L ${st.L}`;
    assert.equal(two.length, 2);
    assert.deepEqual(two.map((p) => p.features), [[st.perm[0], st.perm[1]], [st.perm[2], st.perm[3]]]);
    assert.deepEqual(two.map((p) => p.orders), [[st.orders[0], st.orders[1]], [st.orders[2], st.orders[3]]]);
    two.forEach((pw, i) => {
      const [p, q] = pw.orders;
      assert.equal(pw.kind, kind);
      assert.deepEqual(pw.angles, [TAU / p, TAU / q]);
      assert.equal(pw.loop, kind === 'E' ? 2 * st.L : st.L);
      near(pw.areaOverPi * Math.PI, pw.area, 1e-15);
      if (kind === 'E') {
        near(pw.seal, st.L, 1e-15); near(pw.heights[0], 0.5 / st.L, 1e-15); near(pw.heights[1], 0.5 / st.L, 1e-15); near(pw.area, 1, 1e-15);
        assert.equal(pw.exact, true); assert.equal(pw.rim, Infinity); assert.equal(pw.degenerate, false); assert.equal(pw.excess, 0);
        return;
      }
      const ref = P.pillow(p, q, st.L);
      assert.equal(pw.seal, ref.d); assert.deepEqual(pw.heights, [ref.hP, ref.hQ]); assert.equal(pw.area, ref.area); assert.equal(pw.least, ref.m);
      assert.equal(pw.degenerate, p === 2 && q === 2);
      // the engine's closed forms (F3, F4) and Gauss–Bonnet
      near(pw.seal, pairDistance(p, q, st.L), 1e-12, `${where}: seal`);
      near(pw.heights[0], hgt(p, q, st.L), 1e-12, `${where}: height`); near(pw.heights[1], hgt(q, p, st.L), 1e-12);
      near(pw.area, TAU * (1 - 1 / p - 1 / q), 1e-12);
      near(pw.rim, Math.asinh(TAU / st.L), 1e-15);
      assert.equal(pw.exact, Math.max(...pw.heights) <= pw.rim);
      near(pw.excess, Math.max(0, Math.max(...pw.heights) - pw.rim), 1e-15);
    });
    if (kind === 'H') assert.equal(two[0].exact && two[1].exact, P.orbifoldMesh(st.orders, st.L, st.tw, { nTheta: 16, nS: 4 }).exact, `${where}: the mesh says the same of the two together`);
    const total = two[0].area + two[1].area;
    near(total, kind === 'E' ? 2 : TAU * (2 - st.orders.reduce((a, n) => a + 1 / n, 0)), 1e-12, `${where}: the two areas add to the orbifold's`);
    // the pillows are the active card's pairs, joined along its loop
    const act = S.cardsOf(st).find((c) => c.active);
    assert.deepEqual(two.map((p) => p.features.slice().sort()), act.pairs);
    assert.equal(two[0].loop, act.length);
  }
  const [a, b] = S.pillowsOf(S.stateFor('3333'));
  near(a.seal, 1.762747, 1e-6); near(a.heights[0], 0.881374, 1e-6); near(a.areaOverPi, 2 / 3, 1e-12); assert.equal(a.exact, true);
  assert.deepEqual(b.features, [2, 3]);
  // 2223: the far pair is a pair of 2s: no area, its seal lies on the loop, half the loop long
  const d = S.pillowsOf(S.stateFor('2223'));
  assert.deepEqual(d.map((p) => p.degenerate), [false, true]);
  assert.deepEqual(d[1].heights, [0, 0]); assert.equal(d[1].area, 0); near(d[1].seal, Math.acosh(2) / 2, 1e-15); assert.equal(d[1].exact, true);
  // 2346 as it opens: the order-6 peak stands past the rim (1.7782 against 1.6304), so the crown has a flange there
  const f = S.pillowsOf(S.stateFor('2346'));
  assert.deepEqual(f.map((p) => p.exact), [true, false]);
  near(f[1].excess, 1.778219 - 1.630422, 2e-6);
  // after a flip the pillows are those of the new pairs
  const st = S.stateFor('2345'), next = S.activate(st, '02|13').state, n2 = S.pillowsOf(next);
  assert.deepEqual(n2.map((p) => p.features.slice().sort()), cardOf(st, '02|13').pairs);
  near(n2[0].loop, cardOf(st, '02|13').L, 1e-12);
});

test('numbers as the cards write them', () => {
  assert.equal(S.lengthText(2 * Math.acosh(2)), '2.634');
  assert.equal(S.twistText(0.25), '+0.250');
  assert.equal(S.twistText(-0.125), '−0.125');
  assert.equal(S.twistText(-1.39e-16), '+0.000');
  assert.equal(S.twistText(-0.0004), '+0.000');
  assert.equal(S.twistText(0), '+0.000');
});
