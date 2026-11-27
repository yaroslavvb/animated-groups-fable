// The rigid pieces: right-angled hexagons and what is built of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hexagon, buildPiece, degenerate } from '../src/pieces.js';
import { H, E, leftOf, qSlide, qTurn, qMulAll, qOff, qLen, mdot } from '../src/h2.js';

const near = (a, b, tol = 1e-9, what = '') => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} is not ${b} (off by ${Math.abs(a - b)})`);
const cuff = (len) => ({ t: 'cuff', len }), cone = (n) => ({ t: 'cone', n }), arc = (len) => ({ t: 'arc', len }), corner = (n) => ({ t: 'corner', n });
const areaOf = (piece, G = H) => piece.atoms.reduce((s, a) => s + G.area(a.verts), 0);

test('a hexagon with given ends closes up, with right angles at every seam foot', () => {
  const cases = [
    [{ a: 1.3 }, { a: 0.7 }, { a: 2.1 }],
    [{ a: 1.3 }, { th: Math.PI / 3 }, { a: 2.1 }],
    [{ a: 1.3 }, { th: Math.PI / 3 }, { th: Math.PI / 2 }],
    [{ th: Math.PI / 2 }, { th: Math.PI / 3 }, { th: Math.PI / 7 }],
    [{ th: Math.PI / 3 }, { th: Math.PI / 3 }, { a: 0.4 }],
    [{ a: 4.7 }, { a: 4.7 }, { a: 0.3 }],                                   // long and thin: the closed form, not a walk
  ];
  for (const ends of cases) {
    const h = hexagon(ends);
    assert.ok(h.closure < 1e-9, `closure ${h.closure}`);
    // Gauss-Bonnet: a side end adds two right angles, a vertex end its own angle
    const n = h.verts.length, angles = ends.reduce((s, e) => s + (e.a !== undefined ? Math.PI : e.th), 0);
    near(H.area(h.verts), (n - 2) * Math.PI - angles, 1e-9, 'area');
    // each side has the length asked, and each seam meets its two ends squarely
    h.ends.forEach((e, k) => { if (e.side) near(H.dist(e.vin, e.vout), ends[k].a, 1e-9, 'side'); });
    for (const s of h.seams) assert.ok(s.len > 0 && Number.isFinite(s.len));
    for (const e of h.ends) if (e.side) for (const s of h.seams) { const d = Math.abs(mdot(e.line, s.line)); if (d < 1e-6) near(d, 0, 1e-9, 'a seam and a side that meet'); }
  }
});

test('a pair of pants: area, and its three end motions multiply to the identity', () => {
  const specs = [
    [cuff(2 * Math.acosh(2)), cone(3), cone(3)],
    [cuff(2), cuff(3), cuff(1.5)],
    [cone(3), cuff(3), cuff(1.5)],
    [cone(2), cone(3), cone(7)],
    [cuff(8.5), cuff(1.1), cone(4)],
  ];
  for (const ends of specs) {
    const p = buildPiece({ kind: 'P', ends });
    near(areaOf(p), 2 * Math.PI * (1 - ends.reduce((s, e) => s + (e.t === 'cone' ? 1 / e.n : 0), 0)), 1e-9, 'area');
    const g = p.ends.map((e) => (e.t === 'cone' ? qTurn(e.pt, (2 * Math.PI) / e.n) : qSlide(leftOf(e.frame), -e.len)));
    assert.ok(qOff(qMulAll(...g)) < 1e-9, `g0 g1 g2 is ${qOff(qMulAll(...g))} from the identity`);
    p.ends.forEach((e, k) => { if (e.t === 'cuff') near(qLen(g[k]), ends[k].len, 1e-9, 'cuff'); });
  }
});

test('a mirror polygon and a half pair of pants have the areas Gauss-Bonnet gives them', () => {
  near(areaOf(buildPiece({ kind: 'M', ends: [arc(1.1), corner(2), arc(0.9)] })), Math.PI - Math.PI / 2, 1e-9, 'M');
  near(areaOf(buildPiece({ kind: 'M', ends: [arc(1.1), corner(3), corner(4)] })), Math.PI - Math.PI / 3 - Math.PI / 4, 1e-9, 'M');
  // S (c | corner n) is half of P(c, c, cone n) cut along its mirror; S (c | arc d) half of P(c, c, cuff 2d)
  near(areaOf(buildPiece({ kind: 'S', ends: [cuff(2.2), corner(2)] })), Math.PI * (1 - 1 / 2), 1e-9, 'S crown');
  near(areaOf(buildPiece({ kind: 'S', ends: [cuff(2.2), arc(1.4)] })), Math.PI, 1e-9, 'S');
  near(areaOf(buildPiece({ kind: 'S', ends: [cone(3), arc(1.4)] })), Math.PI * (1 - 2 / 3), 1e-9, 'S cone');
});

test('the flat pieces: an annulus and a strip of the area asked', () => {
  near(areaOf(buildPiece({ kind: 'A', len: 4, h: 2 }), E), 8, 1e-12);
  near(areaOf(buildPiece({ kind: 'A', len: 2, h: 2, halves: 1 }), E), 4, 1e-12);
  near(areaOf(buildPiece({ kind: 'R', len: 2, h: 2 }), E), 4, 1e-12);
});

test('the pieces of no area are known for what they are', () => {
  assert.ok(degenerate({ kind: 'P', ends: [cuff(1), cone(2), cone(2)] }));
  assert.ok(degenerate({ kind: 'M', ends: [arc(1), corner(2), corner(2)] }));
  assert.ok(degenerate({ kind: 'S', ends: [cone(2), arc(1)] }));
  assert.ok(!degenerate({ kind: 'P', ends: [cuff(1), cone(2), cone(3)] }));
  assert.ok(!degenerate({ kind: 'S', ends: [cuff(1), corner(2)] }));
});

test('a piece that cannot be built says which', () => {
  assert.throws(() => buildPiece({ kind: 'P', ends: [cone(2), cone(2), cone(2)] }));
  assert.throws(() => buildPiece({ kind: 'P', ends: [cone(2), cone(3), cone(6)] }));         // a flat triangle is no hyperbolic piece
});
