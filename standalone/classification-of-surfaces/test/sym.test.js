// sym.test.js — the Symmetries tab's engine. Nothing about a signature is typed in and believed:
//   - the tile of every example is folded up on paper (orbifold.js analyse) and must give that very signature;
//   - its price must agree with its area (Gauss-Bonnet: area = 2 pi |2 - cost|) and with the geometry it lives in;
//   - on the sphere the number of tiles must be 2 / (2 - cost) (the Magic Theorem for spherical patterns, p. 53);
//   - the gluings must be real symmetries: each takes its edge onto its mate, and no two tiles overlap.

import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../src/sym/geom.js';
import { analyse, tiles, fval, signatureOf } from '../src/sym/orbifold.js';
import { FAMILIES, fromText, toText, bind, ALL, PRESETS, parse, textOf, stepAt, domainOf } from '../src/sym/catalog.js';

const TAU = 2 * Math.PI;
function build(text) {
  const ex = fromText(text);
  assert.ok(ex, 'no family reads ' + text);
  assert.equal(ex.text, text, 'the text does not round-trip');
  const F = FAMILIES[ex.family], D = F.make(ex.params), A = analyse(D), tokens = F.tokens(ex.params);
  return { ex, D, A, tokens, B: bind(tokens, A) };
}

function checkTile(text) {
  const { D, A } = build(text), G = D.G, n = D.n;
  // counter-clockwise: the motif's point is on the left of every edge
  for (let i = 0; i < n; i++) {
    const F = G.frame(D.verts[i], D.verts[(i + 1) % n]), nrm = [F[1], F[4], F[7]];
    const side = G.kind === 'E' ? (D.at[0] - D.verts[i][0]) * nrm[0] + (D.at[1] - D.verts[i][1]) * nrm[1] : G.form(D.at, nrm);
    assert.ok(side > 1e-9, `${text}: the inside is not on the left of edge ${i}`);
  }
  // every gluing takes its edge's mate onto the edge, and the neighbour lies outside
  for (let i = 0; i < n; i++) {
    const e = D.edges[i], a = D.verts[i], b = D.verts[(i + 1) % n], M = A.maps[i];
    if (e.mirror) { assert.ok(G.dist(apply(M, a), a) < 1e-6 && G.dist(apply(M, b), b) < 1e-6, `${text}: mirror ${i} moves its own edge`); continue; }
    const c = D.verts[e.to], d = D.verts[(e.to + 1) % n];
    assert.ok(Math.abs(G.dist(a, b) - G.dist(c, d)) < 1e-9, `${text}: edges ${i} and ${e.to} differ in length`);
    const [pc, pd] = [apply(M, c), apply(M, d)];
    const ok = e.rev ? G.dist(pc, a) < 1e-6 && G.dist(pd, b) < 1e-6 : G.dist(pc, b) < 1e-6 && G.dist(pd, a) < 1e-6;
    assert.ok(ok, `${text}: gluing ${e.to} -> ${i} misses`);
    assert.equal(D.edges[e.to].to, i);
    assert.equal(!!D.edges[e.to].rev, !!e.rev);
  }
  // geometry, price and area
  const chi = fval(A.chi), kind = chi > 1e-12 ? 'S' : chi < -1e-12 ? 'H' : 'E';
  assert.equal(G.kind, kind, `${text}: costs ${A.cost.n}/${A.cost.d} but lives on ${G.kind}`);
  if (G.kind !== 'E') assert.ok(Math.abs(G.area(D.verts) - TAU * Math.abs(chi)) < 1e-7, `${text}: area ${G.area(D.verts)} against 2 pi |chi| = ${TAU * Math.abs(chi)}`);
  return { D, A, chi };
}

test('every example on the page: its tile folds up to its signature', () => {
  for (const text of ALL) checkTile(text);
  assert.equal(new Set(ALL).size, ALL.length);
  assert.equal(PRESETS.find((g) => g.group === 'E').list.length, 17, 'the plane has 17 types');
});

test('the groups say where each example lives', () => {
  for (const g of PRESETS) for (const text of g.list) assert.equal(build(text).D.G.kind, g.group, text);
});

test('on the sphere: as many tiles as 2 / (2 - cost)', () => {
  for (const text of PRESETS.find((g) => g.group === 'S').list) {
    const { D, A, chi } = checkTile(text), T = tiles(D, A);
    assert.equal(T.length, Math.round(2 / chi), `${text}: ${T.length} tiles`);
    assert.ok(Math.abs(2 / chi - Math.round(2 / chi)) < 1e-9);
  }
  // the book's counts (p. 56 ff.): *532 has 120 symmetries, 532 has 60, *432 48, 3*2 24
  const order = (t) => { const { D, A } = build(t); return tiles(D, A).length; };
  assert.deepEqual(['*532', '532', '*432', '432', '*332', '332', '3*2', '*225', '225', '2*5', '*55', '55', '5*', '5x', '*', 'x'].map(order), [120, 60, 48, 24, 24, 12, 24, 20, 10, 20, 10, 5, 10, 10, 2, 2]);
});

test('no two tiles overlap, on the plane and the hyperbolic plane', () => {
  for (const g of PRESETS) {
    if (g.group === 'S') continue;
    for (const text of g.list) {
      const { D, A } = build(text), G = D.G;
      const reach = Math.max(...D.verts.map((v) => G.dist(v, D.at)));
      const T = tiles(D, A, { radius: g.group === 'H' ? Math.min(4.5 * reach, 3.4 + reach) : 4.5 * reach, max: 1500 });     // as far as the page ever draws
      assert.ok(T.length > 8, `${text}: only ${T.length} tiles`);
      const P = T.map((t) => apply(t.M, D.at));
      let min = Infinity;
      for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) min = Math.min(min, G.dist(P[a], P[b]));
      assert.ok(min > 2 * D.clear - 1e-6, `${text}: two motifs ${min} apart, each has ${D.clear} of room`);
      // a tile and its neighbour across edge i share that edge: the neighbour's motif mirrors across / lands beyond it
      for (let i = 0; i < D.n; i++) assert.ok(G.dist(apply(A.maps[i], D.at), D.at) > 2 * D.clear - 1e-6);
    }
  }
});

test('changing a digit: every kaleidoscope and every gyration group with three digits', () => {
  let n = 0;
  for (let p = 2; p <= 9; p++) for (let q = 2; q <= 9; q++) for (let r = 2; r <= 9; r++) {
    for (const text of [`*${p}${q}${r}`, `${p}${q}${r}`]) { checkTile(text); n++; }
  }
  assert.equal(n, 1024);
  // and the other families, over all their numbers
  for (let p = 2; p <= 9; p++) {
    for (const t of [`*${p}${p}`, `${p}${p}`, `${p}*`, `${p}x`, `o${p}`, `${p}xx`, `*${p}*`]) checkTile(t);
    for (let q = 2; q <= 9; q++) for (const t of [`${p}*${q}`, `${p}*${q}${q}`, `${p}${q}*`, `${p}${q}x`]) checkTile(t);
  }
  for (const t of ['*2222', '*3333', '*2223', '*22222', '*222222', '2222', '2223', '22222', '3333']) checkTile(t);
});

test('stepping one digit walks from the sphere through the plane to the hyperbolic plane', () => {
  let sig = parse('*532');
  const kinds = [], ref = { kind: 'corner', s: 0, i: 0 };
  for (let k = 0; k < 4; k++) { kinds.push(domainOf(sig).G.kind + ':' + textOf(sig)); sig = stepAt(sig, ref, 1); }
  assert.deepEqual(kinds, ['S:*532', 'E:*632', 'H:*732', 'H:*832']);
  assert.equal(stepAt(parse('*932'), ref, 1), null);
  assert.equal(stepAt(parse('*232'), ref, -1), null);
});

test('the signature read off a tile, for a few by hand', () => {
  const sig = (t) => signatureOf(build(t).A);
  assert.deepEqual(sig('*632').stars[0].slice().sort(), [2, 3, 6]);
  assert.deepEqual({ ...sig('*632'), stars: 1 }, { o: 0, x: 0, cones: [], stars: 1 });
  assert.deepEqual(sig('3*3'), { o: 0, x: 0, cones: [3], stars: [[3]] });
  assert.deepEqual(sig('22x'), { o: 0, x: 1, cones: [2, 2], stars: [] });
  assert.deepEqual(sig('**'), { o: 0, x: 0, cones: [], stars: [[], []] });
  assert.deepEqual(sig('*x'), { o: 0, x: 1, cones: [], stars: [[]] });
  assert.deepEqual(sig('oo'), { o: 2, x: 0, cones: [], stars: [] });
  assert.deepEqual(sig('xxx'), { o: 0, x: 3, cones: [], stars: [] });
  assert.deepEqual(sig('2*22').stars, [[2, 2]]);
  assert.deepEqual(sig('*3*').stars.map((s) => s.length).sort(), [0, 1]);
  assert.equal(toText(build('23x').tokens), '23x');
});

test('a matrix that drifted off the group is put back onto it', async () => {
  const { geometry, mul } = await import('../src/sym/geom.js');
  for (const kind of ['S', 'E', 'H']) {
    const G = geometry(kind), J = [1, 1, kind === 'S' ? 1 : -1];
    const gram = (M, a, b) => { let q = 0; for (let k = 0; k < 3; k++) q += M[3 * k + a] * J[k] * M[3 * k + b]; return q; };
    let M = G.translate(G.origin, G.polar(0.9, 0.4));
    for (let i = 0; i < 8; i++) M = mul(mul(G.rotate(G.polar(0.5, i), 0.9), G.reflect(G.polar(0.3, 2 * i), G.polar(0.8, 1 + i))), M);
    const size = Math.max(...M.map(Math.abs));
    const noisy = M.map((x, i) => x + 1e-8 * size * Math.sin(7 * i + 1));
    const F = G.fix(noisy);
    for (let i = 0; i < 9; i++) assert.ok(Math.abs(F[i] - M[i]) < 1e-6 * size * size, `${kind}: fix moved entry ${i} by ${Math.abs(F[i] - M[i])}`);
    if (kind === 'E') { assert.ok(Math.abs(F[0] * F[0] + F[3] * F[3] - 1) < 1e-12 && Math.abs(F[0] * F[1] + F[3] * F[4]) < 1e-12 && F[6] === 0 && F[8] === 1); continue; }
    // the columns of a motion are orthonormal for the geometry's own product: (1, 1, 1) on the sphere, (1, 1, -1) on the hyperboloid
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) assert.ok(Math.abs(gram(F, a, b) - (a === b ? J[a] : 0)) < 1e-9 * size * size, `${kind}: columns ${a}, ${b}`);
    assert.equal(Math.sign(F[0] * (F[4] * F[8] - F[5] * F[7]) - F[1] * (F[3] * F[8] - F[5] * F[6]) + F[2] * (F[3] * F[7] - F[4] * F[6])), 1, kind + ': eight mirrors keep the sense');
  }
});

// ---- any signature at all: the editable model and the general tile
test('a signature as text and as data', async () => {
  const C = await import('../src/sym/catalog.js');
  for (const t of ALL) assert.equal(C.textOf(C.parse(t)), t, t);
  assert.deepEqual(C.parse('o23*45*x'), { o: 0, cones: [2, 3], stars: [[4, 5], []], x: 3 }, 'a ring beside a cross is read as two more crosses');
  assert.equal(C.textOf(C.parse('oo23*45*x')), '23*45*xxxxx');
  assert.deepEqual(C.parse(''), { o: 0, cones: [], stars: [], x: 0 }, 'nothing is a signature too');
  assert.deepEqual(C.parse('1'), C.parse(''), 'and the book writes it 1');
  assert.equal(C.linkOf(C.parse('')), '1'); assert.equal(C.textOf(C.parse('1')), ''); assert.ok(C.isEmpty(C.parse('1')) && !C.isEmpty(C.parse('x')));
  assert.equal(C.parse('7*1'), null); assert.equal(C.parse('x*'), null); assert.equal(C.parse('11'), null); assert.equal(C.parse('ooooooo'), null, 'more than the ball holds');
  assert.deepEqual(C.tokensOf(C.parse('3*3')).map((k) => k.t + (k.v || '') + ':' + k.ref.kind), ['d3:cone', '*:star', 'd3:corner']);
  const cost = C.costOf(C.parse('*632'));
  assert.deepEqual([cost.n, cost.d], [2, 1]);
});

test('adding, removing and stepping', async () => {
  const C = await import('../src/sym/catalog.js');
  const T = (sig) => C.textOf(sig);
  let r = C.addTo(C.parse('*632'), 'x');
  assert.equal(T(r.sig), '*632x'); assert.deepEqual(r.ref, { kind: 'x', i: 0 }); assert.equal(r.traded, false);
  r = C.addTo(C.parse('oo'), 'x');
  assert.equal(T(r.sig), 'xxxxx'); assert.equal(r.traded, true, 'a cross beside two rings: five crosses');
  r = C.addTo(C.parse('2x'), 'o');
  assert.equal(T(r.sig), '2xxx'); assert.equal(r.traded, true, 'a ring beside a cross arrives as two crosses');
  assert.equal(T(C.addTo(C.parse('22'), 'cone').sig), '222');
  assert.equal(T(C.addTo(C.parse('3*3'), 'star').sig), '3*3*');
  assert.equal(C.addTo(C.parse('333'), 'corner'), null, 'a corner needs a mirror');
  r = C.addTo(C.parse('*23*4'), 'corner', { kind: 'corner', s: 0, i: 0 });
  assert.equal(T(r.sig), '*223*4'); assert.deepEqual(r.ref, { kind: 'corner', s: 0, i: 1 });
  assert.equal(T(C.addTo(C.parse('*23*4'), 'corner').sig), '*23*42', 'with nothing chosen: on the last mirror');
  assert.equal(T(C.addTo(C.parse('*23*4'), 'corner', { kind: 'star', s: 0 }).sig), '*223*4', 'with the cursor on the star: its first corner');
  assert.equal(T(C.removeAt(C.parse('2*23x'), { kind: 'star', s: 0 })), '2x', 'a mirror goes with its corners');
  assert.equal(T(C.removeAt(C.parse('2*23x'), { kind: 'corner', s: 0, i: 0 })), '2*3x');
  assert.ok(C.isEmpty(C.removeAt(C.parse('x'), { kind: 'x', i: 0 })), 'the last character may go too');
  assert.equal(T(C.stepAt(C.parse('*532'), { kind: 'corner', s: 0, i: 0 }, 1)), '*632');
  assert.equal(C.stepAt(C.parse('*932'), { kind: 'corner', s: 0, i: 0 }, 1), null);
  assert.equal(T(C.stepAt(C.parse('55'), { kind: 'cone', i: 1 }, 1)), '66', 'the two cone points of NN go together');
  assert.equal(T(C.stepAt(C.parse('*55'), { kind: 'corner', s: 0, i: 0 }, -1)), '*44');
  assert.equal(T(C.stepAt(C.parse('2*55'), { kind: 'corner', s: 0, i: 0 }, 1)), '2*65', 'but not when something else is there');
  let sig = C.parse('x');
  for (let i = 0; i < 20; i++) { const a = C.addTo(sig, 'o'); if (!a) break; sig = a.sig; }
  assert.ok(C.room(sig) === 11 && C.addTo(sig, 'o') === null && C.room(C.addTo(sig, 'x').sig) === 12 && C.addTo(C.addTo(sig, 'x').sig, 'x') === null, 'adding stops when the ball is full: ' + T(sig));
});

test('no pattern: the signatures under $2 that are not among the fourteen spherical types', async () => {
  const C = await import('../src/sym/catalog.js');
  for (const t of ['2', '7', '23', '95', '*2', '*9', '*23', '*45']) { const sig = C.parse(t); assert.ok(fval(C.costOf(sig)) < 2, t); assert.equal(C.domainOf(sig), null, t + ' has a tile'); }
  // every other signature with at most four characters has one, and on a sphere it is one of the fourteen types
  const chars = ['o', '2', '3', '5', '*', 'x'];
  let seen = 0, sphere = new Set();
  const grow = (s, n) => {
    const sig = C.parse(s);
    if (sig && C.textOf(sig) === s) {
      seen++;
      const D = C.domainOf(sig), cost = fval(C.costOf(sig));
      if (!D) assert.ok(cost < 2 && /^\*?([2-9])?([2-9])?$/.test(s) && !/^\*?(.)\1$/.test(s), s + ' has no tile');
      else { assert.equal(D.G.kind, cost < 2 - 1e-12 ? 'S' : cost > 2 + 1e-12 ? 'H' : 'E', s); if (D.G.kind === 'S') sphere.add(s); }
    }
    if (n) for (const c of chars) grow(s + c, n - 1);
  };
  grow('', 4);
  assert.ok(seen > 150, 'tried ' + seen);
  assert.deepEqual([...sphere].sort(), ['', '*', '*22', '*222', '*223', '*225', '*232', '*233', '*235', '*252', '*253', '*322', '*323', '*325', '*332', '*352', '*33', '*522', '*523', '*532', '*55', '2*', '2*2', '2*3', '2*5', '22', '222', '223', '225', '232', '233', '235', '252', '253', '2x', '3*', '3*2', '322', '323', '325', '33', '332', '352', '3x', '5*', '522', '523', '532', '55', '5x', 'x'].sort());
});

test('any signature: the general tile folds up to exactly what was asked for', async () => {
  const C = await import('../src/sym/catalog.js');
  let s = 12345;
  const rnd = (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) % n; };
  let made = 0, general = 0;
  const kinds = { E: 0, H: 0, S: 0 };
  while (made < 400) {
    const sig = { o: rnd(4) === 0 ? 1 + rnd(2) : 0, cones: Array.from({ length: rnd(4) }, () => 2 + rnd(6)), stars: Array.from({ length: rnd(3) }, () => Array.from({ length: rnd(4) }, () => 2 + rnd(5))), x: 0 };
    if (!sig.o && rnd(3) === 0) sig.x = 1 + rnd(3);
    const text = C.textOf(sig), back = C.parse(text);
    if (!back) continue;
    const D = C.domainOf(sig);
    if (!D) { assert.ok(fval(C.costOf(sig)) < 2, text); continue; }
    if (!D.n) continue;                                                 // the empty signature: the whole sphere, nothing to fold
    made++; kinds[D.G.kind]++;
    if (!fromText(text)) general++;
    const A = analyse(D), G = D.G, tokens = C.tokensOf(sig);
    bind(tokens, A);                                                     // throws unless the tile's own reading is this signature
    const cost = C.costOf(sig);
    assert.equal(A.cost.n * cost.d, cost.n * A.cost.d, text + ': the price');
    if (G.kind !== 'E') assert.ok(Math.abs(G.area(D.verts) - TAU * Math.abs(fval(A.chi))) < 1e-6, text + ': area against price');
    for (let i = 0; i < D.n; i++) {
      const e = D.edges[i], a = D.verts[i], b = D.verts[(i + 1) % D.n];
      assert.ok(G.dist(a, b) > 1e-6, text + ': an edge of no length');
      if (e.mirror) continue;
      const c = D.verts[e.to], d = D.verts[(e.to + 1) % D.n], M = A.maps[i], pc = apply(M, c), pd = apply(M, d);
      assert.ok(e.rev ? G.dist(pc, a) < 1e-6 && G.dist(pd, b) < 1e-6 : G.dist(pc, b) < 1e-6 && G.dist(pd, a) < 1e-6, text + ': a gluing misses');
    }
    // no two tiles overlap, as far out as a few tiles go
    const reach = Math.max(...D.verts.map((v) => G.dist(v, D.at)));
    const T = tiles(D, A, { radius: G.kind === 'S' ? Infinity : Math.min(2.6 * reach, reach + 3), max: 160 });
    const P = T.map((t) => apply(t.M, D.at));
    let min = Infinity;
    for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) min = Math.min(min, G.dist(P[a], P[b]));
    assert.ok(P.length < 2 || min > 2 * D.clear - 1e-6, `${text}: two motifs ${min} apart, each has ${D.clear} of room`);
  }
  assert.ok(general > 250 && kinds.H > 300, `general tiles: ${general}; ${JSON.stringify(kinds)}`);
});

test('typing a signature as it is read, and deleting it again', async () => {
  const C = await import('../src/sym/catalog.js');
  const type = (keys, from = C.EMPTY) => {
    let sig = from, at = null;
    const seen = [];
    for (const ch of keys) {
      const r = ch === '*' ? C.addTo(sig, 'star', at) : ch === 'x' || ch === 'o' ? C.addTo(sig, ch, at) : C.addTo(sig, 'digit', at, Number(ch));
      assert.ok(r, 'cannot type ' + ch + ' after ' + C.textOf(sig));
      sig = r.sig; at = r.ref; seen.push(C.textOf(sig) + (C.domainOf(sig) ? '' : '?'));
    }
    return seen;
  };
  // a ? marks a signature no pattern has: on the way to *632 one passes two of them
  assert.deepEqual(type('*632'), ['*', '*6?', '*63?', '*632']);
  assert.deepEqual(type('3*3'), ['3?', '3*', '3*3']);
  assert.deepEqual(type('22*'), ['2?', '22', '22*']);
  assert.deepEqual(type('2*22'), ['2?', '2*', '2*2', '2*22']);
  assert.deepEqual(type('22x'), ['2?', '22', '22x']);
  assert.deepEqual(type('oo'), ['o', 'oo']);
  assert.deepEqual(type('*3*').slice(-1), ['*3*']);
  assert.deepEqual(type('o2*3x').slice(-1), ['2*3xxx'], 'the cross trades the ring');
  // the cursor: a digit typed at the start is a cone point, on a star its first corner, at the end a corner of the last star
  const T = (r) => C.textOf(r.sig);
  assert.equal(T(C.addTo(C.parse('*632'), 'digit', 'start', 4)), '4*632');
  assert.equal(T(C.addTo(C.parse('*632'), 'digit', { kind: 'star', s: 0 }, 4)), '*4632');
  assert.equal(T(C.addTo(C.parse('*632'), 'digit', { kind: 'corner', s: 0, i: 0 }, 4)), '*6432');
  assert.equal(T(C.addTo(C.parse('*632'), 'digit', null, 4)), '*6324');
  assert.equal(T(C.addTo(C.parse('3*3'), 'digit', { kind: 'cone', i: 0 }, 2)), '32*3');
  assert.equal(T(C.addTo(C.parse('o*'), 'digit', { kind: 'o', i: 0 }, 5)), 'o5*');
  assert.equal(T(C.addTo(C.parse('*2*3'), 'star', { kind: 'star', s: 0 })), '*2**3', 'a star typed inside a mirror starts a new one after it');
  assert.equal(C.addTo(C.parse('*632'), 'digit', null, 1), null); assert.equal(C.addTo(C.parse('*632'), 'digit', null, 10), null);
  // deleting from the end, one character at a time, reaches the empty signature: the bare sphere
  let sig = C.parse('2*632*3x');
  const down = [];
  while (!C.isEmpty(sig)) { const tokens = C.tokensOf(sig); sig = C.removeAt(sig, tokens[tokens.length - 1].ref); down.push(C.textOf(sig)); }
  assert.deepEqual(down, ['2*632*3', '2*632*', '2*632', '2*63', '2*6', '2*', '2', '']);
  const D = C.domainOf(sig), A = analyse(D);
  assert.equal(D.n, 0); assert.equal(D.G.kind, 'S'); assert.equal(tiles(D, A).length, 1, 'one tile: no symmetry but leaving it alone');
  assert.deepEqual([A.cost.n, A.chi.n, A.chi.d], [0, 2, 1]);
  assert.deepEqual(bind(C.tokensOf(sig), A), []);
});

test('the six designs: every mark lies inside its tile, for every example and some signatures of one\'s own', async () => {
  const C = await import('../src/sym/catalog.js'), Mo = await import('../src/sym/motifs.js');
  assert.deepEqual(Mo.PATTERNS.map((p) => p.label), ['Paisley', 'Soft commas', 'Tomoe', 'Checkerboard', 'Rings', 'Comma'], 'the names and order of The Folding\'s selector');
  assert.equal(Mo.DEFAULT_PATTERN, 'paisley');
  let shapes = 0;
  for (const t of [...ALL, '1', '*632x', '2*23', 'o2*', '23*45*6', 'xxxxx', 'ooo', '2*632*3x', '*22*', '3xx']) {
    const D = C.domainOf(C.parse(t)), G = D.G, normals = D.verts.map((v, i) => { const F = G.frame(v, D.verts[(i + 1) % D.n]); return [F[1], F[4], F[7]]; });
    for (const { key } of Mo.PATTERNS) {
      const des = Mo.design(D, key);
      assert.ok(des.dark.length >= 1, `${t}/${key}: nothing dark`);
      if (D.cells && D.cells.length === 2 && ['paisley', 'soft', 'comma'].includes(key)) assert.ok(des.dark.length >= 2, `${t}/${key}: the second half of the tile is bare`);
      for (const sh of des.dark.concat(des.light)) {
        shapes++;
        assert.ok(sh.pts.length >= 3, `${t}/${key}: a shape of ${sh.pts.length} points`);
        for (const p of sh.pts) {
          assert.ok(p.every(Number.isFinite), `${t}/${key}: not a number`);
          normals.forEach((nrm, i) => {
            const side = G.kind === 'E' ? (p[0] - D.verts[i][0]) * nrm[0] + (p[1] - D.verts[i][1]) * nrm[1] : G.form(p, nrm);
            assert.ok(side > -1e-7, `${t}/${key}: a mark is ${-side} outside edge ${i}`);
          });
        }
      }
    }
  }
  assert.ok(shapes > 1000, 'shapes checked: ' + shapes);
});

test('many handles, many crosscaps: the tile search ends, and finds every tile once', async () => {
  // His report, Sun 15 Nov 2026: "If I type 4 handles in a row, the whole thing freezes." Sixteen tiles meet at each
  // corner of that tile; going round one, rounding moved a tile's point by a billionth of its size, the search took
  // it for a new tile, and the copies bred until the matrices were garbage and the loop never ended.
  const C = await import('../src/sym/catalog.js');
  for (const t of ['ooo', 'oooo', 'ooooo', 'oooooo', 'xxxxxxxx', 'xxxxxxxxxxxx', 'oooo*', 'oo2*3', '2222222', '*732']) {
    const sig = C.parse(t);
    assert.ok(sig, t + ' does not parse');
    const D = C.domainOf(sig), A = analyse(D), G = D.G, reach = Math.max(...D.verts.map((v) => G.dist(v, D.at)));
    const t0 = performance.now(), T = tiles(D, A, { radius: 5 + 2 * reach, max: 1500 }), took = performance.now() - t0;
    assert.ok(took < 1500, `${t}: the search took ${Math.round(took)} ms`);
    assert.ok(T.length >= 500, `${t}: only ${T.length} tiles`);
    const P = T.map((x) => apply(x.M, D.at));
    let min = Infinity;
    for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) min = Math.min(min, G.dist(P[a], P[b]));
    assert.ok(min > 2 * D.clear - 1e-4, `${t}: two tiles ${min} apart, each has ${D.clear} of room: one tile was found twice`);
    // as many tiles as the disc they lie in has room for (the farthest tile's ring is only partly taken)
    const far = T[T.length - 1].d, fit = (TAU * (Math.cosh(far) - 1)) / Math.abs(G.area(D.verts));
    assert.ok(T.length > 0.55 * fit && T.length < 1.6 * fit, `${t}: ${T.length} tiles out to ${far.toFixed(2)}, where about ${Math.round(fit)} fit`);
    // every tile's point is still a point of the hyperbolic plane, to a hundred-millionth of its size (a determinant
    // would say nothing: for entries of 100 000 its own rounding is larger than 1)
    for (const q of P) assert.ok(Math.abs(q[0] * q[0] + q[1] * q[1] - q[2] * q[2] + 1) < 1e-8 * (1 + q[2] * q[2]), t + ': a tile has left the plane');
  }
  assert.equal(C.parse('ooooooo'), null, 'a seventh handle has no place on the ball: it is refused, not tried');
});
