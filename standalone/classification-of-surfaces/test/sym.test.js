// sym.test.js — the Symmetries tab's engine. Nothing about a signature is typed in and believed:
//   - the tile of every example is folded up on paper (orbifold.js analyse) and must give that very signature;
//   - its price must agree with its area (Gauss-Bonnet: area = 2 pi |2 - cost|) and with the geometry it lives in;
//   - on the sphere the number of tiles must be 2 / (2 - cost) (the Magic Theorem for spherical patterns, p. 53);
//   - the gluings must be real symmetries: each takes its edge onto its mate, and no two tiles overlap.

import test from 'node:test';
import assert from 'node:assert/strict';
import { apply } from '../src/sym/geom.js';
import { analyse, tiles, fval, signatureOf } from '../src/sym/orbifold.js';
import { FAMILIES, fromText, toText, bind, ALL, PRESETS, stepParam } from '../src/sym/catalog.js';

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
  let ex = fromText('*532');
  const kinds = [];
  for (let k = 0; k < 4; k++) { kinds.push(FAMILIES[ex.family].make(ex.params).G.kind + ':' + ex.text); ex = stepParam(ex, 0, 1); }
  assert.deepEqual(kinds, ['S:*532', 'E:*632', 'H:*732', 'H:*832']);
  assert.equal(stepParam(fromText('*932'), 0, 1), null);
  assert.equal(stepParam(fromText('*232'), 0, -1), null);
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
