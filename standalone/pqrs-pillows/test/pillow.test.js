// pillow.test.js — src/pillow.js against closed forms, brute force and the engine (handles.js): a compact port of
// the prototype's check (/Users/solid/drive.unsynced/artifacts/pqrs-pillows/proto/pillow-math/check.mjs).
//   node --test test/pillow.test.js
// Not ported: the 2222 mesh carried onto the exact solid of Twist of 2222 (that module is src/flat2222.js here, the
// surface owner's, with its own test), the JSON samples and the timings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/pillow.js';
import * as F from '../src/flips.js';
import * as E from '../../two-features-two-handles/src/handles.js';
import { mul, apply } from '../../classification-of-surfaces/src/sym/geom.js';

const PI = Math.PI, TAU = 2 * PI;
const { sinh, cosh, tanh, atanh, sqrt, sin, cos, abs, max, min, hypot, atan2 } = Math;
const fmt = (x) => (x === 0 ? '0' : x.toExponential(1));
const say = (line) => console.log(`    ${line}`);
const ok = (cond, msg) => assert.ok(cond, msg);

// deterministic random numbers (the prototype's)
function seeded(seed0 = 20261127) {
  let seed = seed0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  return { rnd, between: (a, b) => a + (b - a) * rnd() };
}
// Gauss–Legendre, 16 points, composite
const GLx = [0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438, 0.7554044083550030, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499];
const GLw = [0.1894506104550685, 0.1826034150449236, 0.1691565193950025, 0.1495959888165767, 0.1246289712555339, 0.0951585116824928, 0.0622535239386479, 0.0271524594117541];
function integrate(f, a, b, pieces = 32) {
  let acc = 0;
  const h = (b - a) / pieces;
  for (let i = 0; i < pieces; i++) { const c = a + (i + 0.5) * h; for (let k = 0; k < 8; k++) acc += GLw[k] * (f(c - GLx[k] * h / 2) + f(c + GLx[k] * h / 2)); }
  return acc * h / 2;
}
// tanh–sinh: for integrands with a square-root zero at an end
function tanhSinh(f, a, b, hStep = 1 / 64) {
  const r = (b - a) / 2;
  let acc = 0;
  for (let k = -400; k <= 400; k++) {
    const t = k * hStep, u = (PI / 2) * sinh(t), ch = cosh(u);
    if (ch > 1e150) continue;
    const w = (PI / 2) * cosh(t) / (ch * ch);
    if (w < 1e-300) continue;
    const q = Math.exp(-2 * abs(u)), oneMinus = (2 * q) / (1 + q);         // 1 - |tanh u|, without cancellation
    acc += w * f(u >= 0 ? b - r * oneMinus : a + r * oneMinus);
  }
  return acc * r * hStep;
}
// hyperbolic and Euclidean triangles from their three sides
const hypAngle = (a, b, c) => { const s = (a + b + c) / 2; return 2 * Math.atan(sqrt(max(0, sinh(s - b) * sinh(s - c)) / max(1e-300, sinh(s) * sinh(s - a)))); };   // opposite a
const hypArea = (a, b, c) => { const s = (a + b + c) / 2; return 4 * Math.atan(sqrt(max(0, tanh(s / 2) * tanh((s - a) / 2) * tanh((s - b) / 2) * tanh((s - c) / 2)))); };
const eucAngle = (a, b, c) => { const s = (a + b + c) / 2; return 2 * Math.atan(sqrt(max(0, (s - b) * (s - c)) / max(1e-300, s * (s - a)))); };
const eucArea = (a, b, c) => { const s = (a + b + c) / 2; return sqrt(max(0, s * (s - a) * (s - b) * (s - c))); };

/** A mesh as a surface: topology, and areas and angle sums from the rest lengths alone; chords of the open crowns. */
function analyse(m) {
  const nV = m.nVertices, nT = m.nTriangles, nE = m.nEdges, flat = m.kind === 'E';
  const key = (a, b) => (a < b ? a * nV + b : b * nV + a);
  const rest = new Map();
  let dupEdges = 0;
  for (let e = 0; e < nE; e++) { const k = key(m.edges[2 * e], m.edges[2 * e + 1]); if (rest.has(k)) dupEdges++; rest.set(k, m.restLength[e]); }
  const use = new Map(), dir = new Set();
  let missing = 0, badDir = 0, degTri = 0;
  for (let t = 0; t < nT; t++) {
    const v = [m.triangles[3 * t], m.triangles[3 * t + 1], m.triangles[3 * t + 2]];
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) degTri++;
    for (let x = 0; x < 3; x++) {
      const a = v[x], b = v[(x + 1) % 3], k = key(a, b);
      if (!rest.has(k)) missing++;
      use.set(k, (use.get(k) || 0) + 1);
      const dk = a * nV + b;
      if (dir.has(dk)) badDir++;
      dir.add(dk);
    }
  }
  let boundary = 0, nonManifold = 0, unused = 0;
  for (const k of rest.keys()) { const u = use.get(k) || 0; if (u === 1) boundary++; else if (u === 0) unused++; else if (u !== 2) nonManifold++; }
  const parent = Array.from({ length: nV }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let e = 0; e < nE; e++) parent[find(m.edges[2 * e])] = find(m.edges[2 * e + 1]);
  let comps = 0;
  for (let i = 0; i < nV; i++) if (find(i) === i) comps++;
  const angH = new Float64Array(nV), angE = new Float64Array(nV);
  let areaH = 0, areaE = 0, triIneq = 0;
  for (let t = 0; t < nT; t++) {
    const v = [m.triangles[3 * t], m.triangles[3 * t + 1], m.triangles[3 * t + 2]];
    const l = [rest.get(key(v[1], v[2])), rest.get(key(v[0], v[2])), rest.get(key(v[0], v[1]))];   // l[x] opposite v[x]
    if (l[0] + l[1] <= l[2] || l[0] + l[2] <= l[1] || l[1] + l[2] <= l[0]) triIneq++;
    areaH += flat ? eucArea(l[0], l[1], l[2]) : hypArea(l[0], l[1], l[2]);
    areaE += eucArea(l[0], l[1], l[2]);
    for (let x = 0; x < 3; x++) {
      const a = l[x], b = l[(x + 1) % 3], c = l[(x + 2) % 3];
      angH[v[x]] += flat ? eucAngle(a, b, c) : hypAngle(a, b, c);
      angE[v[x]] += eucAngle(a, b, c);
    }
  }
  const o = m.open;
  let chordMax = 0, chordNeg = 0;
  for (let e = 0; e < nE; e++) {
    const a = o.edges[2 * e], b = o.edges[2 * e + 1];
    const ch = hypot(o.positions[3 * a] - o.positions[3 * b], o.positions[3 * a + 1] - o.positions[3 * b + 1], o.positions[3 * a + 2] - o.positions[3 * b + 2]);
    const rel = (m.restLength[e] - ch) / m.restLength[e];
    chordMax = max(chordMax, abs(rel)); if (rel < -1e-12) chordNeg++;
  }
  const isCone = new Set(Object.values(m.cones));
  let regMax = 0;
  for (let v = 0; v < nV; v++) if (!isCone.has(v)) regMax = max(regMax, abs(angH[v] - TAU));
  const closed = nV - nE + nT === 2 && boundary === 0 && nonManifold === 0 && unused === 0 && missing === 0 && badDir === 0 && dupEdges === 0 && degTri === 0 && comps === 1;
  return { nV, nE, nT, chi: nV - nE + nT, closed, boundary, nonManifold, badDir, comps, areaH, areaE, angH, angE, triIneq, chordMax, chordNeg, regMax };
}
const gaussBonnet = (m) => m.pillows.reduce((a, pl) => a + pl.area, 0);

const f2345 = E.FAMILIES[E.normalizeFamilyKey('2345')], f2223 = E.FAMILIES['2223'], f3333 = E.FAMILIES['3333'];
const ordersOf = (fam) => fam.defaultM.split('').map((c) => fam.baseOrders[+c]);
const meshCases = [
  { name: '3333 L=2 tw=0', orders: [3, 3, 3, 3], L: 2, tw: 0 },
  { name: '3333 L=2 tw=0.25', orders: [3, 3, 3, 3], L: 2, tw: 0.25 },
  { name: '3333 L=2 tw=0.1337', orders: [3, 3, 3, 3], L: 2, tw: 0.1337 },
  { name: '3333 default', orders: ordersOf(f3333), L: f3333.defaultL, tw: 0 },
  { name: '2345 default', orders: ordersOf(f2345), L: f2345.defaultL, tw: f2345.defaultTw },
  { name: '2223 default', orders: ordersOf(f2223), L: f2223.defaultL, tw: f2223.defaultTw },
  { name: '2223 tw=0.3', orders: ordersOf(f2223), L: f2223.defaultL, tw: 0.3 },
  { name: '2233 (2,2|3,3) tw=0.2', orders: [2, 2, 3, 3], L: 1.7340294529811298, tw: 0.2 },
  { name: '2222 default', orders: [2, 2, 2, 2], L: 1, tw: 0 },
  { name: '2222 L=1.0746 tw=0.25', orders: [2, 2, 2, 2], L: 1.0745699318235418, tw: 0.25 },
  { name: '6666 L=3 tw=0.1 (fallback)', orders: [6, 6, 6, 6], L: 3, tw: 0.1 },
];
const resolutions = [[16, 4], [32, 8], [64, 16]];

// =====================================================================================================================
test('closed forms of the half-pillow: heights, seal, least distance; the engine\'s hgt, pairDistance, treeToCut', () => {
  let eH = 0, eD = 0, eM = 0, eT = 0, n = 0, eSum = 0, eU = 0, eMin = 0, eRel = 0;
  for (let p = 2; p <= 9; p++) for (let q = 2; q <= 9; q++) for (const L of [0.35, 0.5, 0.8, 1, 1.5, 2, 2.6339, 3, 4, 5, 6, 7, 9.5]) {
    const h = P.halfPillow(p, q, L), t2c = E.treeToCut(p, q, L);
    n++;
    eH = max(eH, abs(h.hP - E.hgt(p, q, L)), abs(h.hQ - E.hgt(q, p, L)));
    eD = max(eD, abs(h.d - E.pairDistance(p, q, L)) / h.d);
    eM = max(eM, abs(h.m - t2c.m));
    if (!h.degenerate) eT = max(eT, abs(h.dP - t2c.dA), abs(h.dQ - t2c.dB));
    eSum = max(eSum, abs(h.dP + h.dQ - h.d));
    eU = max(eU, abs(h.uP + h.uQ - h.a));
    if (h.degenerate) continue;
    const pl = P.pillow(p, q, L);
    let lo = Infinity;
    for (let i = 0; i <= 1000; i++) lo = min(lo, pl.roofAt((i / 1000) * h.a));          // the least distance by brute force
    eMin = max(eMin, abs(lo - h.m));
    const { al, be, a, d, hP, hQ } = h;                                                   // the seven relations
    eRel = max(eRel,
      abs(cosh(a) - (sin(al) * sin(be) * cosh(d) - cos(al) * cos(be))) / cosh(a),
      abs(cos(be) - (sin(al) * sinh(a) * sinh(hP) - cos(al) * cosh(a))),
      abs(cos(al) - (sin(be) * sinh(a) * sinh(hQ) - cos(be) * cosh(a))),
      abs(cosh(d) - (cosh(hP) * cosh(hQ) * cosh(a) - sinh(hP) * sinh(hQ))) / cosh(d),
      abs(sinh(hQ) - (cosh(d) * sinh(hP) - sinh(d) * cosh(hP) * cos(al))) / cosh(d),
      abs(sinh(hP) - (cosh(d) * sinh(hQ) - sinh(d) * cosh(hQ) * cos(be))) / cosh(d),
      abs(sin(al) / cosh(hQ) - sinh(a) / sinh(d)), abs(sin(be) / cosh(hP) - sinh(a) / sinh(d)));
  }
  say(`${n} pillows (orders 2..9, L 0.35..9.5): heights against hgt ${fmt(eH)}; seal against pairDistance (rel) ${fmt(eD)}; least distance against treeToCut ${fmt(eM)}, its feet ${fmt(eT)}; dP + dQ - d ${fmt(eSum)}; uP + uQ - L/2 ${fmt(eU)}; least value of the roof ${fmt(eMin)}; the seven relations ${fmt(eRel)}`);
  ok(eH < 1e-12, 'hP, hQ = hgt(p, q, L), hgt(q, p, L)');
  ok(eD < 1e-12, 'd = pairDistance(p, q, L)');
  ok(eM < 1e-10 && eT < 1e-10, 'm = treeToCut(p, q, L).m; dP, dQ = its dA, dB');
  ok(eSum < 1e-10 && eU < 1e-10, 'dP + dQ = d and uP + uQ = L/2');
  ok(eMin < 1e-5, 'm is the least value of the roof');
  ok(eRel < 1e-11, 'the seven relations R1..R7');
  const h33 = P.halfPillow(3, 3, 2), h23 = P.halfPillow(2, 3, 2), h45 = P.halfPillow(4, 5, 2.5357);
  assert.deepEqual([h33.hP, h33.hQ, h33.d, h33.m, h33.uP].map((v) => +v.toFixed(6)), [1.047193, 1.047193, 1.517841, 0.852456, 0.5]);
  assert.deepEqual([h23.hP, h23.hQ, h23.d, h23.m, h23.uP].map((v) => +v.toFixed(6)), [0.413568, 0.6996, 1.180658, 0.413568, 0]);
  assert.deepEqual([h45.hP, h45.hQ, h45.d, h45.m].map((v) => +v.toFixed(6)), [1.384613, 1.589469, 2.476106, 0.962759]);
  const d22 = P.halfPillow(2, 2, 3);
  ok(d22.degenerate && d22.hP === 0 && d22.m === 0 && d22.d === 1.5 && d22.area === 0, '{2, 2, L} is degenerate: everything on the cuff');
});

test('any three of the six data fix the half-pillow (acute corners: exactly one)', () => {
  const R = seeded(), KEYS = ['al', 'be', 'a', 'd', 'hP', 'hQ'], triples = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let k = j + 1; k < 6; k++) triples.push([KEYS[i], KEYS[j], KEYS[k]]);
  assert.equal(triples.length, 20);
  const stats = new Map(triples.map((t) => [t.join(','), { found: 0, two: 0, acute: 0, worst: 0 }])), N = 150;
  for (let it = 0; it < N; it++) {
    const al = R.between(0.2, PI / 2), be = R.between(0.2, PI / 2), a = R.between(0.25, 3), six = P.sixFromCorners(al, be, a);
    for (const t of triples) {
      const given = {}; for (const k of t) given[k] = six[k];
      const sols = P.solveHalfPillow(given), st = stats.get(t.join(','));
      const hit = sols.find((s) => abs(s.al - al) + abs(s.be - be) + abs(s.a - a) < 1e-6);
      if (hit) { st.found++; st.worst = max(st.worst, abs(hit.al - al) + abs(hit.be - be) + abs(hit.a - a)); }
      if (sols.length === 2) st.two++;
      if (sols.filter((s) => s.acute).length === 1) st.acute++;
      ok(sols.length <= 2, 'never more than two');
    }
  }
  const two = [];
  let worst = 0;
  for (const [k, st] of stats) { assert.equal(st.found, N, `${k}: every triple returns the half-pillow it came from`); assert.equal(st.acute, N, `${k}: exactly one acute solution`); worst = max(worst, st.worst); if (st.two) two.push(k); }
  assert.deepEqual(two.sort(), ['a,d,hP', 'a,d,hQ', 'al,hP,hQ', 'be,hP,hQ'], 'two solutions: exactly the two SSA patterns and their mirror images');
  say(`20 triples x ${N} half-pillows: the original returned to ${fmt(worst)}; two solutions only for ${two.join('; ')}`);
  const s = P.sixFromCorners(PI / 5, PI / 3, 1);
  assert.equal(P.solveHalfPillow({ al: s.al, hP: s.hP, hQ: s.hQ }).length, 2);
  assert.equal(P.solveHalfPillow({ a: s.a, d: s.d, hP: s.hP }).length, 2);
  assert.equal(P.solveHalfPillow({ al: PI / 3, be: PI / 3, d: 1.0 }).length, 0, 'no pillow below d0(3, 3) = 1.0986');
  ok(abs(E.d0(3, 3) - 1.098612) < 1e-6);
  ok(!P.solveFlatHalfPillow({ al: PI / 2, be: PI / 2, a: 1 }).determined && P.solveFlatHalfPillow({ al: PI / 2, a: 1, hQ: 0.4 }).determined, 'flat: the corners leave the height free');
});

test('the roof: the seal in Fermi coordinates, its slope, the corner angles, the area (Gauss–Bonnet)', () => {
  const R = seeded(7);
  let eRoof = 0, eDer = 0, eAngP = 0, eAngQ = 0, eArea = 0, eAreaC = 0, eGeo = 0, n = 0, eMetric = 0, eDer2 = 0, eRoof2 = 0;
  for (let p = 2; p <= 9; p++) for (let q = 2; q <= 9; q++) for (const L of [0.5, 1, 2, 3.3, 5, 7]) {
    if (p === 2 && q === 2) continue;
    const pl = P.pillow(p, q, L), a = L / 2;
    n++;
    // the seal as a plane through the origin: e . X = 0 with e = P x Q
    const Pp = P.fermiToHyperboloid(pl.hP, 0), Qp = P.fermiToHyperboloid(pl.hQ, a);
    const e = [Pp[1] * Qp[2] - Pp[2] * Qp[1], Pp[2] * Qp[0] - Pp[0] * Qp[2], Pp[0] * Qp[1] - Pp[1] * Qp[0]];
    for (let i = 0; i <= 20; i++) {
      const th = (i / 20) * a, brute = atanh(-(e[0] * sinh(th) + e[2] * cosh(th)) / e[1]);
      eRoof = max(eRoof, abs(pl.roof(th) - brute));
      if (i > 0 && i < 20) {
        const hh = 1e-4, fd = (-pl.roofAt(th + 2 * hh) + 8 * pl.roofAt(th + hh) - 8 * pl.roofAt(th - hh) + pl.roofAt(th - 2 * hh)) / (12 * hh);
        eDer = max(eDer, abs(pl.roofPrime(th) - fd) / max(1, abs(fd)));
        eDer2 = max(eDer2, abs(pl.roofPrime(th) - tanh(pl.m) * sinh(th - pl.uP) * cosh(pl.roof(th)) ** 2) / max(1, abs(fd)));
        eRoof2 = max(eRoof2, abs(pl.roof(th) - atanh(tanh(pl.m) * cosh(th - pl.uP))));
        const X = [pl.roof(th), th];
        eGeo = max(eGeo, abs(P.distFermi([pl.hP, 0], X) + P.distFermi(X, [pl.hQ, a]) - pl.d));
      }
      eRoof = max(eRoof, abs(pl.roof(-th) - pl.roof(th)), abs(pl.roof(th + L) - pl.roof(th)));
    }
    eAngP = max(eAngP, abs(atan2(cosh(pl.hP), -pl.roofPrime(0)) - PI / p));
    eAngQ = max(eAngQ, abs(atan2(cosh(pl.hQ), pl.roofPrime(a)) - PI / q));
    eArea = max(eArea, abs(2 * integrate((th) => sinh(pl.roofAt(th)), 0, a, 64) - TAU * (1 - 1 / p - 1 / q)));
    eAreaC = max(eAreaC, abs(2 * pl.areaUnder(0, a) - pl.area), abs(pl.areaUnder(0.2 * a, 0.7 * a) - integrate((th) => sinh(pl.roofAt(th)), 0.2 * a, 0.7 * a, 64)));
  }
  for (let i = 0; i < 1000; i++) {
    const s1 = R.between(-3, 3), s2 = R.between(-3, 3), t1 = R.between(-4, 4), t2 = R.between(-4, 4);
    const X = P.fermiToHyperboloid(s1, t1), Y = P.fermiToHyperboloid(s2, t2);
    eMetric = max(eMetric, abs(P.dFermi(s1, t1, s2, t2) - E.GH.dist(X, Y)) / max(1e-3, E.GH.dist(X, Y)));
  }
  say(`${n} pillows x 21 theta: roof against the plane through P, Q ${fmt(eRoof)}; on the segment PQ ${fmt(eGeo)}; through the common perpendicular ${fmt(eRoof2)}; slope ${fmt(eDer)} (difference), ${fmt(eDer2)} (closed form); corner angles ${fmt(max(eAngP, eAngQ))}; area against Gauss–Bonnet ${fmt(eArea)}; areaUnder ${fmt(eAreaC)}; dFermi against GH.dist (rel) ${fmt(eMetric)}`);
  ok(eRoof < 1e-11, 'roof(theta) is the seal; even, period L');
  ok(eGeo < 1e-12, 'roof points lie on the segment PQ');
  ok(eRoof2 < 1e-10 && eDer2 < 1e-9, 'tanh roof = tanh m cosh(theta - uP)');
  ok(eDer < 1e-6, 'roofPrime against a five-point difference');
  ok(eAngP < 1e-11 && eAngQ < 1e-11, 'the roof meets the perpendiculars through P and Q at pi/p and pi/q');
  ok(eArea < 1e-11, 'area = 2 * integral of sinh roof = 2 pi (1 - 1/p - 1/q)');
  ok(eAreaC < 1e-11, 'areaUnder against quadrature');
  ok(eMetric < 1e-9, 'dFermi = the engine\'s GH.dist');
  const pl = P.pillow(3, 3, 2);
  assert.deepEqual([pl.roof(0), pl.roof(0.25), pl.roof(0.5), pl.roofPrime(0)].map((v) => +v.toFixed(6)), [1.047193, 0.8955, 0.852456, -0.923922]);
});

test('the crown is an isometry onto a surface of revolution, up to the rim', () => {
  ok(abs(P.carlsonRF(1, 2, 0) - 1.3110287771461) < 1e-13 && abs(P.carlsonRD(0, 2, 1) - 1.7972103521034) < 1e-13, 'Carlson R_F(1, 2, 0), R_D(0, 2, 1)');
  let eZ = 0, eIso = 0, eK = 0, n = 0, eRim = 0;
  for (const L of [0.35, 0.5, 1, 2, 3, 5, 7, 9.5]) {
    const rho = L / TAU, sM = P.sMax(L);
    ok(abs(sM - Math.asinh(TAU / L)) < 1e-15);
    for (const fr of [0.1, 0.3, 0.6, 0.9, 0.99, 1]) {
      const s = fr * sM;
      // z by tanh–sinh (the integrand has a square-root zero at the rim)
      const quad = tanhSinh((t) => sqrt(max(0, fr === 1 && t > s / 2 ? rho * rho * (sinh(sM) ** 2 - sinh(t) ** 2) : 1 - (rho * sinh(t)) ** 2)), 0, s);
      eZ = max(eZ, abs(P.crownZ0(rho, s) - quad) / max(1e-12, quad));
      n++;
      if (fr === 1) continue;
      // the first fundamental form of (s, theta) -> crownPoint: 1, 0, cosh^2 s
      const th = 0.37 * L, hh = 1e-5;
      const a1 = P.crownPoint(L, s + hh, th, 1, [0, 0, 0]), a0 = P.crownPoint(L, s - hh, th, 1, [0, 0, 0]);
      const b1 = P.crownPoint(L, s, th + hh, 1, [0, 0, 0]), b0 = P.crownPoint(L, s, th - hh, 1, [0, 0, 0]);
      const Xs = [0, 1, 2].map((k) => (a1[k] - a0[k]) / (2 * hh)), Xt = [0, 1, 2].map((k) => (b1[k] - b0[k]) / (2 * hh));
      const EE = Xs[0] ** 2 + Xs[1] ** 2 + Xs[2] ** 2, GG = Xt[0] ** 2 + Xt[1] ** 2 + Xt[2] ** 2, FF = Xs[0] * Xt[0] + Xs[1] * Xt[1] + Xs[2] * Xt[2];
      eIso = max(eIso, abs(EE - 1), abs(FF), abs(GG / cosh(s) ** 2 - 1));
      // X_theta x X_s points away from the axis: seen from outside theta runs to the right, s up (no mirror)
      const nx = Xt[1] * Xs[2] - Xt[2] * Xs[1], ny = Xt[2] * Xs[0] - Xt[0] * Xs[2], mid = P.crownPoint(L, s, th, 1, [0, 0, 0]);
      eK = max(eK, nx * mid[0] + ny * mid[1] > 0 ? 0 : 1);
      // the radius is (L / 2 pi) cosh s, and the lower crown is the mirror image in the loop's plane
      ok(abs(hypot(mid[0], mid[1]) - rho * cosh(s)) < 1e-12);
      const low = P.crownPoint(L, s, th, -1, [0, 0, 0]);
      ok(abs(low[2] + mid[2]) < 1e-15 && low[0] === mid[0]);
    }
    eRim = max(eRim, abs(rho * sinh(sM) - 1));
  }
  say(`${n} heights against quadrature (rel) ${fmt(eZ)}; first fundamental form off (1, 0, cosh^2 s) by ${fmt(eIso)} (central differences); r'(rim) - 1: ${fmt(eRim)}`);
  ok(eZ < 1e-10, 'z(s) by Carlson integrals against tanh–sinh quadrature');
  ok(eIso < 1e-7, '(s, theta) -> crownPoint is an isometry');
  assert.equal(eK, 0, 'the crown keeps orientation');
  ok(eRim < 1e-12, 'at the rim the meridian is horizontal');
  // past the rim: the fallback keeps meridians and shortens parallels by stretch(s)
  const L = 5, pr = P.crownProfile(L, 0), s = pr.sMax + 0.6, hh = 1e-5;
  const b1 = P.crownPoint(L, s, 0.3 + hh, 1, [0, 0, 0]), b0 = P.crownPoint(L, s, 0.3 - hh, 1, [0, 0, 0]), a1 = P.crownPoint(L, s + hh, 0.3, 1, [0, 0, 0]), a0 = P.crownPoint(L, s - hh, 0.3, 1, [0, 0, 0]);
  const gT = hypot(b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]) / (2 * hh) / cosh(s), gS = hypot(a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]) / (2 * hh);
  ok(abs(gS - 1) < 1e-8 && abs(gT - pr.stretch(s)) < 1e-8 && pr.stretch(s) < 1, 'past the rim: meridians keep their length, parallels are short by stretch(s)');
  // where the peaks leave the rim: {3,3,L} at L = 10.78, {4,4,L} at 5.54 (the critique page's two numbers); {6,6,L} never fits
  const gap = (p, q, LL) => P.sMax(LL) - max(E.hgt(p, q, LL), E.hgt(q, p, LL));
  const root = (p, q) => { let lo = 0.01, hi = 60; if (!(gap(p, q, lo) > 0)) return null; for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (gap(p, q, mid) > 0) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  ok(abs(root(3, 3) - 10.78) < 0.01 && abs(root(4, 4) - 5.54) < 0.01, `{3,3}: ${root(3, 3)}, {4,4}: ${root(4, 4)}`);
  assert.equal(root(6, 6), null);
  ok(root(5, 5) > 2.5 && root(5, 5) < 2.7);
});

test('two pillows on one surface: the cone points are the engine\'s home points', () => {
  const cases = [[3, 3, 3, 3], [3, 2, 2, 2], [2, 2, 3, 3], [2, 3, 5, 4], [4, 4, 4, 4], [2, 3, 4, 5], [3, 5, 7, 9], [2, 9, 2, 9], [6, 6, 6, 6]];
  const Ls = [0.4, 1, 2, 2.6339, 3.3, 5, 7], tws = [-1.3, -0.5, -0.25, -0.1, 0, 0.1, 0.25, 0.5, 0.77, 1.2], EPS = 2.220446049250313e-16;
  let eDist = 0, eLift = 0, n = 0, eTurn = 0, eOpp = 0, rPos = 0, rDist = 0, ePosNear = 0, eDistNear = 0, eT = 0, nNear = 0;
  for (const orders of cases) for (const L of Ls) for (const tw of tws) {
    const b = E.fourConeCentered(orders, L, tw, { k: '3333' }), cp = P.conePositions(orders, L, tw);
    n++;
    // The engine renormalises its points, which leaves a relative error of about eps z^2 at hyperboloid height z:
    // allowed everywhere; the plain bound is asserted for the states whose points and frame stay below z = 30.
    const nearBy = b.home.every((h) => h[2] <= 30) && b.Pmat.every((v) => abs(v) <= 30), zS = max(...b.home.map((h) => h[2]), ...b.Pmat.map(abs));
    if (nearBy) nNear++;
    const mine = cp.s.map((s, i) => apply(b.Pmat, P.fermiToHyperboloid(s, cp.theta[i])));
    for (let i = 0; i < 4; i++) {
      const er = hypot(mine[i][0] - b.home[i][0], mine[i][1] - b.home[i][1], mine[i][2] - b.home[i][2]) / b.home[i][2];
      rPos = max(rPos, er / (1e-13 + 64 * EPS * zS * zS));
      if (nearBy) ePosNear = max(ePosNear, er);
    }
    // all six distances, measured in the chart (four of them ACROSS the waist)
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const dE = E.GH.dist(b.home[i], b.home[j]), er = abs(dE - P.dFermi(cp.s[i], cp.theta[i], cp.s[j], cp.theta[j])) / max(1, dE);
      eDist = max(eDist, er); rDist = max(rDist, er / (1e-13 + 64 * EPS * zS * zS));
      if (nearBy) eDistNear = max(eDistNear, er);
    }
    // the shortest over the lifts along the cut: the engine's far pair moved by T^k, at the twist reduced mod 1
    const twR = tw - Math.round(tw), bR = twR === tw ? b : E.fourConeCentered(orders, L, twR, { k: '3333' }), T = bR.A.maps[1], Ti = E.invH(T);
    for (const i of [0, 1]) for (const j of [2, 3]) {
      let bestE = Infinity, bestM = Infinity;
      for (const X of [bR.home[j], apply(T, bR.home[j]), apply(Ti, bR.home[j])]) bestE = min(bestE, E.GH.dist(bR.home[i], X));
      for (let k = -4; k <= 4; k++) bestM = min(bestM, P.dFermi(cp.s[i], cp.theta[i], cp.s[j], cp.theta[j] + k * L));
      eLift = max(eLift, abs(bestE - bestM) / max(1, bestE));
    }
    if (L <= 3.3) { const T2 = mul(mul(bR.Pmat, E.boostX(L)), E.invH(bR.Pmat)); for (let x = 0; x < 9; x++) eT = max(eT, abs(T[x] - T2[x]) / max(1, abs(T2[x]))); }
    eTurn = max(eTurn, abs((cp.azimuth[2] - cp.azimuth[0]) - TAU * tw), abs((cp.azimuth[3] - cp.azimuth[1]) - TAU * tw));
    eOpp = max(eOpp, abs(cp.azimuth[1] - cp.azimuth[0] - PI), abs(cp.azimuth[3] - cp.azimuth[2] - PI));
  }
  say(`${n} states (9 signatures x 7 L x 10 tw from -1.3 to 1.2): home = Pmat * fermiToHyperboloid(s, theta) to ${fmt(ePosNear)} (rel) over the ${nNear} states below z = 30, within 64 eps z^2 everywhere; six distances ${fmt(eDistNear)} (${fmt(eDist)} over all); shortest over the lifts ${fmt(eLift)}; the turn 2 pi tw ${fmt(eTurn)}`);
  ok(rPos < 1 && ePosNear < 1e-11, 'P, Q, R, S of conePositions are the engine\'s home points');
  ok(rDist < 1 && eDistNear < 1e-11, 'the six distances between cone points equal the engine\'s');
  ok(eLift < 1e-9, 'the shortest distance across the waist over the lifts along the cut');
  ok(eT < 1e-9, 'the engine\'s side pairing is the translation by L along the cut');
  ok(eTurn < 1e-12 && eOpp < 1e-12, 'azimuth(R) - azimuth(P) = 2 pi tw; Q opposite P, S opposite R');
  // signs: A left, B right, the cut above them; tw > 0 moves C, D to the right (towards +theta)
  const b0 = E.fourConeCentered([3, 3, 3, 3], 2, 0, { k: '3333' }), b1 = E.fourConeCentered([3, 3, 3, 3], 2, 0.1, { k: '3333' }), disc = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
  ok(disc(b0.home[0])[0] < 0 && disc(b0.home[1])[0] > 0 && disc(b0.home[2])[1] > 0 && disc(b1.home[2])[0] > disc(b0.home[2])[0], 'sign of the twist');
  // the first pair is BELOW (z < 0), its seal along y with the first point at -y (SPEC 3.3: the world frame)
  const cp = P.conePositions([3, 3, 3, 3], 2, 0);
  ok(cp.xyz[0][2] < 0 && cp.xyz[1][2] < 0 && cp.xyz[2][2] > 0 && cp.xyz[3][2] > 0, 'P, Q below the loop, R, S above');
  ok(abs(cp.xyz[0][0]) < 1e-12 && cp.xyz[0][1] < 0 && abs(cp.xyz[1][0]) < 1e-12 && cp.xyz[1][1] > 0, 'the first seal along y, P at -y');
  const cp2 = P.conePositions([3, 3, 3, 3], 2, 0.1), hA = E.hgt(3, 3, 2);
  ok(abs(cosh(P.dFermi(cp2.s[0], cp2.theta[0], cp2.s[2], cp2.theta[2])) - (cosh(hA) ** 2 * cosh(0.2) + sinh(hA) ** 2)) < 1e-12, 'across the waist: cosh d(P, R) = cosh hP cosh hR cosh t + sinh hP sinh hR');
  // handedness: the signed volume of (P, Q, R, S) on the crowns is negative for 0 < tw < 1/2
  const vol = (c) => { const [p0, q0, r0, s0] = c.xyz, u = [0, 1, 2].map((x) => q0[x] - p0[x]), v = [0, 1, 2].map((x) => r0[x] - p0[x]), w = [0, 1, 2].map((x) => s0[x] - p0[x]); return u[0] * (v[1] * w[2] - v[2] * w[1]) - u[1] * (v[0] * w[2] - v[2] * w[0]) + u[2] * (v[0] * w[1] - v[1] * w[0]); };
  for (const [orders, LL] of [[[2, 2, 2, 2], 1], [[2, 2, 2, 2], 1.4], [[3, 3, 3, 3], 2], [[2, 3, 5, 4], 2.5357]]) for (const tw of [0.02, 0.1, 0.25, 0.4, 0.48]) {
    ok(vol(P.conePositions(orders, LL, tw)) < 0 && vol(P.conePositions(orders, LL, -tw)) > 0, `handedness at ${orders.join('')} tw ${tw}`);
  }
});

test('the flat 2222, and a pair of 2s in a hyperbolic orbifold', () => {
  const R = seeded(11);
  let ePos = 0, eDist = 0, n = 0;
  for (const ell of [0.5, 0.7071, 1, 1.2, 1.4142, 2]) for (const tw of [-0.6, -0.25, 0, 0.1, 0.25, 0.5, 1.1]) {
    const b = E.pillowCentered(ell, tw), cp = P.conePositions([2, 2, 2, 2], ell, tw), g = P.orbifold([2, 2, 2, 2], ell, tw);
    n++;
    for (let i = 0; i < 4; i++) ePos = max(ePos, hypot(cp.theta[i] - b.home[i][0], cp.s[i] + 0.5 / ell - b.home[i][1]));
    for (const i of [0, 1]) for (const j of [2, 3]) {
      let bestE = Infinity, bestM = Infinity;
      for (let k = -4; k <= 4; k++) { bestE = min(bestE, hypot(b.home[i][0] - b.home[j][0] - 2 * k * ell, b.home[i][1] - b.home[j][1])); bestM = min(bestM, hypot(cp.s[i] - cp.s[j], cp.theta[i] - cp.theta[j] - k * g.cuff)); }
      eDist = max(eDist, abs(bestE - bestM));
    }
  }
  ok(ePos < 1e-14, '2222: conePositions are the engine\'s pillowCentered home points, (x, y) = (theta, s + 1/(2 L))');
  ok(eDist < 1e-14, '2222: shortest distances across the cut over the lifts along it');
  const g = P.orbifold([2, 2, 2, 2], 1.2, 0.1);
  ok(g.cuff === 2.4 && abs(g.lower.hP - 1 / 2.4) < 1e-15 && abs(g.upper.hP - 1 / 2.4) < 1e-15 && abs(g.thR - g.thP - 0.24) < 1e-15 && abs(g.lower.area + g.upper.area - 2) < 1e-15, '2222: cuff = 2 L, both pockets 1 / (2 L) high, slide tw * cuff, area 2');
  assert.equal(P.cuffOf([2, 2, 2, 2], 1.2), 2.4); assert.equal(P.cuffOf([3, 3, 3, 3], 1.2), 1.2);
  assert.equal(P.isFlat([2, 2, 2, 2]), true); assert.equal(P.isFlat([2, 2, 2, 3]), false);
  // the closed solid's six edges: the three distances between cone points = the engine's reduced superbase
  let worst = 0;
  for (let it = 0; it < 200; it++) {
    const ell = R.between(0.5, 2.6), tw = R.between(-2, 2), sb = E.reduceSuperbase([ell, 0], [2 * ell * tw, 1 / ell]), td = P.flatTipDistances(ell, tw);
    worst = max(worst, abs(td.PQ - hypot(sb.va[0], sb.va[1])), abs(td.PR - hypot(sb.vb[0], sb.vb[1])), abs(td.PS - hypot(sb.vc[0], sb.vc[1])));
  }
  const sq = P.flatTipDistances(1, 0), reg = P.flatTipDistances(Math.pow(4 / 3, 0.25), 0.25);
  ok(worst < 1e-12 && abs(sq.PS - Math.SQRT2) < 1e-15 && abs(reg.PQ - reg.PR) < 1e-12 && abs(reg.PQ - reg.PS) < 1e-12 && abs(reg.PQ - 1.07457) < 1e-6, 'flatTipDistances = the lengths of the engine\'s reduced superbase');
  // ... and they are the three partitions' Lengths wherever the triangle of flips.js is the reduced one
  for (const [ell, tw] of [[1, 0], [1, 0.25], [1.2, 0.1], [0.8, -0.37], [Math.pow(4 / 3, 0.25), 0.25]]) {
    const tr = F.triangle({ k: '2222', perm: [0, 1, 2, 3], orders: [2, 2, 2, 2], L: ell, tw, thetas: [0, 0, 0, 0] }), td = P.flatTipDistances(ell, tw);
    if (!tr.reduced) continue;
    const by = Object.fromEntries(tr.loops.map((lp) => [lp.key, lp.L]));
    ok(abs(by['01|23'] - td.PQ) < 1e-12 && abs(by['02|13'] - td.PR) < 1e-12 && abs(by['03|12'] - td.PS) < 1e-12, `2222 (${ell}, ${tw}): the three Lengths are the solid's three edge lengths`);
  }
  // a (2, 2) pair in the hyperbolic case: 2223 at its default pair, orders [3, 2, 2, 2]
  const L = Math.acosh(2), tw = 0.15, b = E.fourConeCentered([3, 2, 2, 2], L, tw, { k: '2223' }), cp = P.conePositions([3, 2, 2, 2], L, tw);
  ok(cp.s[2] === 0 && cp.s[3] === 0 && abs(cp.theta[3] - cp.theta[2] - L / 2) < 1e-15 && abs(cp.azimuth[2] - cp.azimuth[0] - TAU * tw) < 1e-15, '(2, 2) far pair: R, S lie on the waist, L/2 apart');
  ok(b.cutOnFar === true && abs(E.GH.dist(b.cutSeg[0], b.cutSeg[1]) - L / 2) < 1e-12, 'the engine draws that segment as the cut');
  const m = P.orbifoldMesh([3, 2, 2, 2], L, tw, { nTheta: 32, nS: 6 }), seal = m.seals[1];
  let eFold = 0, len = 0;
  for (let k = 0; k < seal.chain.length; k++) {
    const tA = m.open.theta[seal.openA[k]], tB = m.open.theta[seal.openB[k]];
    eFold = max(eFold, abs(P.wrapSym(tA + tB - 2 * cp.theta[2], L)), abs(m.open.s[seal.openA[k]]), abs(m.open.s[seal.openB[k]]));
  }
  const key = (a, c) => (a < c ? `${a}/${c}` : `${c}/${a}`), rest = new Map();
  for (let e = 0; e < m.nEdges; e++) rest.set(key(m.edges[2 * e], m.edges[2 * e + 1]), m.restLength[e]);
  for (let k = 0; k + 1 < seal.chain.length; k++) len += rest.get(key(seal.chain[k], seal.chain[k + 1]));
  ok(eFold < 1e-13 && abs(len - L / 2) < 1e-13 && m.ringOwner === 1 && m.cones.R === seal.chain[0], 'mesh of 2223: the waist ring is folded about R; the folded seal is L/2 long');
  assert.deepEqual(m.degenerate, [false, true]);
  ok(P.pillow(2, 2, 3).degenerate && P.pillow(2, 2, 3).roof(0.4) === 0);
});

test('meshes: closed surfaces of Euler characteristic 2; areas and cone angles from the rest lengths alone', () => {
  let worstAreaH = 0, worstConeH = 0, worstReg = 0;
  const rowsOut = [];
  for (const c of meshCases) {
    const rows = [];
    for (const [nTheta, nS] of resolutions) {
      const m = P.orbifoldMesh(c.orders, c.L, c.tw, { nTheta, nS }), A = analyse(m), gb = gaussBonnet(m), where = `${c.name} ${nTheta} x ${nS}`;
      ok(A.closed, `${where}: a closed, connected, consistently oriented surface with V - E + F = 2 (chi ${A.chi}, boundary ${A.boundary})`);
      assert.equal(A.triIneq, 0, `${where}: every triangle's rest lengths satisfy the strict triangle inequality`);
      assert.equal(m.nVertices - m.nEdges + m.nTriangles, 2);
      const coneH = ['P', 'Q', 'R', 'S'].map((nm, i) => A.angH[m.cones[nm]] - TAU / m.orders[i]), coneE = ['P', 'Q', 'R', 'S'].map((nm, i) => A.angE[m.cones[nm]] - TAU / m.orders[i]);
      worstAreaH = max(worstAreaH, abs(A.areaH - gb)); worstConeH = max(worstConeH, ...coneH.map(abs)); worstReg = max(worstReg, A.regMax);
      ok(abs(A.areaH - gb) < 1e-9, `${where}: the triangles' areas add up to Gauss–Bonnet (off by ${A.areaH - gb})`);
      ok(coneH.every((x) => abs(x) < 1e-9), `${where}: angles round P, Q, R, S sum to 2 pi / order`);
      ok(A.regMax < 1e-9, `${where}: angles round every other vertex sum to 2 pi`);
      const kind = m.kind, total = kind === 'E' ? 2 : TAU * (2 - m.orders.reduce((a, x) => a + 1 / x, 0));
      ok(abs(gb - total) < 1e-12, `${where}: the two pillows' areas are the orbifold's`);
      rows.push({ A, m, coneE, gb, margin: kind === 'E' ? 0 : max(...m.pillows.map((pl) => max(pl.hP, pl.hQ))) / m.sMax });
    }
    if (rows[0].m.exact) {
      ok(rows[2].A.chordMax < rows[1].A.chordMax && rows[1].A.chordMax < rows[0].A.chordMax && rows.every((r) => r.A.chordNeg === 0), `${c.name}: on an exact crown no chord is longer than its rest length, and the largest gap falls with every refinement`);
      if (rows[0].margin < 0.9) ok(rows[2].A.chordMax < 0.3 * rows[1].A.chordMax && rows[1].A.chordMax < 0.3 * rows[0].A.chordMax, `${c.name}: by a factor 4 per doubling`);
    }
    if (rows[0].m.kind === 'H') for (let r = 1; r < 3; r++) ok(abs(rows[r].A.areaE - rows[r].gb) < 0.3 * abs(rows[r - 1].A.areaE - rows[r - 1].gb) && rows[r].coneE.every((x, i) => abs(x) < 0.4 * abs(rows[r - 1].coneE[i])), `${c.name}: read as FLAT triangles the lengths give areas and cone angles that tend to those values`);
    rowsOut.push(`${c.name}: ${rows.map((r) => `${r.A.nV}/${r.A.nE}/${r.A.nT}`).join(', ')}${rows[0].m.exact ? '' : ' (past the rim: fallback)'}`);
  }
  say(`V/E/T at 16 x 4, 32 x 8, 64 x 16: ${rowsOut.join('; ')}`);
  say(`worst over all: area against Gauss–Bonnet ${fmt(worstAreaH)}, cone angle ${fmt(worstConeH)}, regular vertex ${fmt(worstReg)}`);
  assert.equal(meshCases.map((c) => P.orbifoldMesh(c.orders, c.L, c.tw).exact).join(), [true, true, true, true, true, true, true, true, true, true, false].join(), 'which crowns are exact');
  // on the open crowns every triangle faces outwards, the zipper strip's included
  let inward = 0, total = 0;
  for (const [orders, L, tw] of [[[3, 3, 3, 3], 2, 0.137], [[2, 3, 5, 4], 2.5357, -0.4], [[3, 2, 2, 2], 3, 0.1], [[2, 2, 3, 3], 1.734, 0.7], [[2, 2, 2, 2], 1.1, 0.3]]) {
    const m = P.orbifoldMesh(orders, L, tw, { nTheta: 32, nS: 6 }), o = m.open, X = o.positions;
    for (let t = 0; t < m.nTriangles; t++) {
      const a = 3 * o.triangles[3 * t], b = 3 * o.triangles[3 * t + 1], c = 3 * o.triangles[3 * t + 2];
      const ux = X[b] - X[a], uy = X[b + 1] - X[a + 1], uz = X[b + 2] - X[a + 2], vx = X[c] - X[a], vy = X[c + 1] - X[a + 1], vz = X[c + 2] - X[a + 2];
      total++;
      if (!((uy * vz - uz * vy) * (X[a] + X[b] + X[c]) + (uz * vx - ux * vz) * (X[a + 1] + X[b + 1] + X[c + 1]) > 0)) inward++;
    }
  }
  assert.equal(inward, 0, `every one of ${total} triangles of the open crowns faces outwards`);
});

test('one pillow is a disc bounded by its loop', () => {
  for (const [p, q, L] of [[3, 3, 2], [2, 3, 2], [4, 5, 2.5357], [3, 7, 1]]) for (const [nTheta, nS] of resolutions.slice(0, 2)) {
    const m = P.pillowMesh(p, q, L, { nTheta, nS }), A = analyse(m), pl = m.pillows[0], where = `{${p},${q},${L}} ${nTheta} x ${nS}`;
    const onCuff = new Set(m.waist);
    let reg = 0, cuffAng = 0, cuffLen = 0, sealLen = 0;
    for (let v = 0; v < m.nVertices; v++) { if (v === m.cones.P || v === m.cones.Q) continue; if (onCuff.has(v)) cuffAng = max(cuffAng, abs(A.angH[v] - PI)); else reg = max(reg, abs(A.angH[v] - TAU)); }
    const key = (a, b) => (a < b ? `${a}/${b}` : `${b}/${a}`), rest = new Map();
    for (let e = 0; e < m.nEdges; e++) rest.set(key(m.edges[2 * e], m.edges[2 * e + 1]), m.restLength[e]);
    for (let i = 0; i < m.waist.length; i++) cuffLen += rest.get(key(m.waist[i], m.waist[(i + 1) % m.waist.length]));
    const ch = m.seals[0].chain;
    for (let k = 0; k + 1 < ch.length; k++) sealLen += rest.get(key(ch[k], ch[k + 1]));
    ok(A.chi === 1 && A.boundary === nTheta && A.nonManifold === 0 && A.comps === 1 && A.badDir === 0, `${where}: Euler characteristic 1, boundary = the loop`);
    ok(abs(A.areaH - pl.area) < 1e-10 && abs(A.angH[m.cones.P] - TAU / p) < 1e-10 && abs(A.angH[m.cones.Q] - TAU / q) < 1e-10 && reg < 1e-10 && cuffAng < 1e-10, `${where}: area 2 pi (1 - 1/p - 1/q), cone angles, pi along the loop, 2 pi elsewhere`);
    ok(abs(cuffLen - L) < 1e-11 && abs(sealLen - pl.d) < 1e-11, `${where}: the loop's rest lengths sum to L, the seal's to d`);
  }
  const dg = P.pillowMesh(2, 2, 3, { nTheta: 16, nS: 4 });
  ok(dg.nTriangles === 0 && dg.nVertices === 9 && dg.nEdges === 8 && abs(dg.restLength.reduce((a, b) => a + b, 0) - 1.5) < 1e-13, 'pillowMesh(2, 2, L): the folded ring only');
});

test('the zipper strip follows the twist; nothing else of the mesh changes; on the crowns the upper pillow turns by 2 pi tw', () => {
  const orders = [3, 3, 3, 3], L = 2, nTheta = 32, nS = 6, m = P.orbifoldMesh(orders, L, 0, { nTheta, nS });
  const sigma0 = m.open.sigma.slice(), thl0 = m.open.thetaLocal.slice(), tri0 = m.triangles.slice(0, 3 * m.strip.triStart), ed0 = m.edges.slice(0, 2 * m.strip.edgeStart), rest0 = m.restLength.slice(0, m.strip.edgeStart), pos0 = m.open.positions.slice();
  let worstArea = 0, worstReg = 0, notClosed = 0, same = true, rot = 0, changes = 0, lastCells = 0, n = 0;
  for (let i = 0; i <= 160; i++) {
    const tw = -1.2 + (2.4 * i) / 160;
    P.setTwist(m, tw);
    const A = analyse(m);
    n++;
    worstArea = max(worstArea, abs(A.areaH - gaussBonnet(m))); worstReg = max(worstReg, A.regMax);
    if (!(A.closed && A.triIneq === 0)) notClosed++;
    for (let k = 0; k < sigma0.length; k++) if (m.open.sigma[k] !== sigma0[k] || m.open.thetaLocal[k] !== thl0[k]) same = false;
    for (let k = 0; k < tri0.length; k++) if (m.triangles[k] !== tri0[k]) same = false;
    for (let k = 0; k < ed0.length; k++) if (m.edges[k] !== ed0[k]) same = false;
    for (let k = 0; k < rest0.length; k++) if (m.restLength[k] !== rest0[k]) same = false;
    const c = cos(TAU * tw), s = sin(TAU * tw);
    for (let v = 0; v < m.open.nVertices; v++) {
      const x = pos0[3 * v], y = pos0[3 * v + 1], z = pos0[3 * v + 2], up = m.open.pillow[v] === 1;
      rot = max(rot, hypot(m.open.positions[3 * v] - (up ? c * x - s * y : x), m.open.positions[3 * v + 1] - (up ? s * x + c * y : y), m.open.positions[3 * v + 2] - z));
    }
    if (i > 0 && m.strip.cells !== lastCells) changes++;
    lastCells = m.strip.cells;
  }
  say(`${n} twists from -1.2 to 1.2: the stitch changed ${changes} times; area against Gauss–Bonnet ${fmt(worstArea)}, regular vertex ${fmt(worstReg)}, the turn of the upper crown ${fmt(rot)}`);
  assert.equal(notClosed, 0, 'always a closed surface of Euler characteristic 2');
  ok(worstArea < 1e-9 && worstReg < 1e-9, 'the areas still add to Gauss–Bonnet and every regular vertex has angle 2 pi');
  ok(same, 'nothing of either pillow changes with the twist (only the strip\'s triangles and cross edges)');
  ok(rot < 1e-12, 'the upper pillow\'s vertices turn by 2 pi tw about the axis, counter-clockwise from above; the lower ones stay');
  P.setTwist(m, 0.377);
  const fresh = P.orbifoldMesh(orders, L, 0.377, { nTheta, nS });
  for (const f of ['positions', 'triangles', 'edges', 'restLength', 's', 'theta']) for (let k = 0; k < fresh[f].length; k++) assert.equal(m[f][k], fresh[f][k], `setTwist leaves exactly the mesh orbifoldMesh builds: ${f}[${k}]`);
  const a = P.triLocal(fresh, 5).slice(), b = P.triLocal(P.setTwist(fresh, -0.61), 5);
  ok(a.every((v, k) => abs(v - b[k]) < 1e-13), 'triLocal: a pillow\'s triangle in its own chart is the same at every twist');
  // `into` refills the same mesh for a new Length
  const again = P.orbifoldMesh(orders, 2.5, 0.1, { nTheta, nS, into: m });
  assert.equal(again, m); assert.equal(m.L, 2.5);
  ok(analyse(m).closed);
});

test('the mesh\'s cone points against the engine; edge paths never undercut the true distance', () => {
  let worst = 0, worstPlace = 0, n = 0;
  for (const c of meshCases) {
    const m = P.orbifoldMesh(c.orders, c.L, c.tw, { nTheta: 32, nS: 6 }), cp = P.conePositions(c.orders, c.L, c.tw), idx = [m.cones.P, m.cones.Q, m.cones.R, m.cones.S];
    for (let i = 0; i < 4; i++) worstPlace = max(worstPlace, abs(m.s[idx[i]] - cp.s[i]), abs(P.wrapSym(m.theta[idx[i]] - cp.theta[i], m.cuff)));
    if (m.kind === 'E') continue;
    const b = E.fourConeCentered(c.orders, c.L, c.tw, { k: '3333' }), T = b.A.maps[1], Ti = E.invH(T);
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      let bestE = Infinity, bestM = Infinity;
      for (const X of [b.home[j], apply(T, b.home[j]), apply(Ti, b.home[j])]) bestE = min(bestE, E.GH.dist(b.home[i], X));
      for (let k = -2; k <= 2; k++) bestM = min(bestM, P.dFermi(m.s[idx[i]], m.theta[idx[i]], m.s[idx[j]], m.theta[idx[j]] + k * m.cuff));
      worst = max(worst, abs(bestE - bestM)); n++;
    }
  }
  ok(worstPlace < 1e-13, 'the mesh\'s vertices P, Q, R, S sit at conePositions\' points');
  ok(worst < 1e-11, `shortest distances between them over the lifts along the cut equal the engine's (${n} distances, worst ${worst})`);
  // Dijkstra over rest lengths from P
  const m = P.orbifoldMesh([3, 3, 3, 3], 2, 0.1, { nTheta: 48, nS: 12 }), b = E.fourConeCentered([3, 3, 3, 3], 2, 0.1, { k: '3333' });
  const adj = Array.from({ length: m.nVertices }, () => []);
  for (let e = 0; e < m.nEdges; e++) { adj[m.edges[2 * e]].push([m.edges[2 * e + 1], m.restLength[e]]); adj[m.edges[2 * e + 1]].push([m.edges[2 * e], m.restLength[e]]); }
  const dist = new Float64Array(m.nVertices).fill(Infinity), done = new Uint8Array(m.nVertices);
  dist[m.cones.P] = 0;
  for (;;) { let u = -1, best = Infinity; for (let v = 0; v < m.nVertices; v++) if (!done[v] && dist[v] < best) { best = dist[v]; u = v; } if (u < 0) break; done[u] = 1; for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) dist[v] = dist[u] + w; }
  const T = mul(mul(b.Pmat, E.boostX(2)), E.invH(b.Pmat));
  const shortest = (i, j) => { let best = Infinity; for (let k = -3; k <= 3; k++) { let X = b.home[j]; const Tk = k >= 0 ? T : E.invH(T); for (let r = 0; r < abs(k); r++) X = apply(Tk, X); best = min(best, E.GH.dist(b.home[i], X)); } return best; };
  const truth = [E.GH.dist(b.home[0], b.home[1]), shortest(0, 2), shortest(0, 3)], got = ['Q', 'R', 'S'].map((nm) => dist[m.cones[nm]]);
  say(`edge paths from P in the 48 x 12 mesh of 3333, L = 2, tw = 0.1: ${['Q', 'R', 'S'].map((nm, i) => `${nm} ${got[i].toFixed(4)} (true ${truth[i].toFixed(4)})`).join(', ')}`);
  ok(got.every((gv, i) => gv >= truth[i] - 1e-9 && gv < 1.08 * truth[i]), 'edge paths are no shorter than the true distances, and within 8 % of them');
});

test('robustness: random states on random grids are closed surfaces with finite numbers', () => {
  const R = seeded(13), grids = [[4, 2], [8, 2], [12, 3], [16, 5], [48, 8], [20, 30]];
  let n = 0, worstArea = 0, worstAng = 0, worstCone = 0;
  for (let it = 0; it < 300; it++) {
    const ord = () => 2 + Math.floor(R.rnd() * 11), kind = it % 6;                      // orders 2..12
    const orders = kind === 0 ? [2, 2, ord(), ord()] : kind === 1 ? [ord(), ord(), 2, 2] : kind === 2 ? [2, 2, 2, 2] : [ord(), ord(), ord(), ord()];
    const flat = orders.every((x) => x === 2);
    const L = flat ? R.between(0.5, 2) : Math.exp(R.between(Math.log(0.3), Math.log(10))), tw = R.between(-2, 2), [nTheta, nS] = grids[it % grids.length];
    const m = P.orbifoldMesh(orders, L, tw, { nTheta, nS }), A = analyse(m), gb = gaussBonnet(m), where = `${orders.join(',')} L ${L.toFixed(3)} tw ${tw.toFixed(3)} ${nTheta} x ${nS}`;
    n++;
    ok(A.closed, `${where}: closed, Euler characteristic 2 (chi ${A.chi}, boundary ${A.boundary}, comps ${A.comps})`);
    assert.equal(A.triIneq, 0, where);
    for (const arr of [m.positions, m.restLength, m.open.positions]) for (let k = 0; k < arr.length; k++) if (!Number.isFinite(arr[k])) assert.fail(`${where}: a number that is not finite`);
    worstArea = max(worstArea, abs(A.areaH - gb) / max(1, gb)); worstAng = max(worstAng, A.regMax);
    ['P', 'Q', 'R', 'S'].forEach((nm, i) => { worstCone = max(worstCone, abs(A.angH[m.cones[nm]] - TAU / m.orders[i])); });
  }
  say(`${n} meshes (orders 2..12, a pair of 2s on either side, 2222; L 0.3..10; tw -2..2; six grids): area ${fmt(worstArea)} (rel), regular vertex ${fmt(worstAng)}, cone ${fmt(worstCone)}`);
  ok(worstArea < 1e-8 && worstAng < 1e-7 && worstCone < 1e-7, 'areas add to Gauss–Bonnet, angles to 2 pi and to 2 pi / order');
  const sg = P.suggestGrid([3, 3, 3, 3], 2, 2500);
  ok(sg.nTheta % 4 === 0 && sg.nS >= 2 && abs(sg.nTheta * sg.nS * 2 - 2500) < 600, `suggestGrid gives about the vertices asked for: ${sg.nTheta} x ${sg.nS}`);
  const r = P.toResult(P.orbifoldMesh([3, 3, 3, 3], 2, 0.125, { nTheta: 16, nS: 4 }));
  ok(r.positions.length === 3 * 130 && r.rest.length === r.edges.length / 2 && r.pillow.length === r.triangles.length / 3 && r.cones.length === 4 && r.seals.length === 2 && r.waist.length === 16, 'toResult: the fields the solver round reads');
});

test('locate and pointOn: a pillow-chart point in the mesh, through the strip at any twist', () => {
  const R = seeded(17);
  let worstParam = 0, worstW = 0, n = 0, bad = 0;
  const dev = [];
  for (const [orders, L] of [[[3, 3, 3, 3], 2], [[3, 2, 2, 2], 3], [[2, 2, 3, 3], 1.734], [[2, 3, 5, 4], 2.5357], [[2, 2, 2, 2], 1.1]]) {
    const [nTheta, nS] = [48, 8], m = P.orbifoldMesh(orders, L, 0, { nTheta, nS });
    let far = 0;
    for (let it = 0; it < 1200; it++) {
      if (it % 150 === 0) P.setTwist(m, R.between(-1.3, 1.3));
      const k = R.rnd() < 0.5 ? 0 : 1, pl = m.pillows[k];
      if (pl.degenerate) { if (P.locate(m, k, 0, 0) !== null) bad++; continue; }
      const th = R.between(-m.cuff, m.cuff), u = R.rnd() < 0.3 ? R.between(0, 1.5 / nS) : R.rnd(), sg = u * pl.roof(th);
      const loc = P.locate(m, k, sg, th);
      n++;
      if (m.triPillow[loc.tri] !== k) bad++;
      worstW = max(worstW, abs(loc.w[0] + loc.w[1] + loc.w[2] - 1), -min(loc.w[0], loc.w[1], loc.w[2]));
      const cr = P.triLocal(m, loc.tri);
      let thI = 0, uI = 0;
      for (let x = 0; x < 3; x++) { const hv = pl.roof(cr[2 * x + 1]); thI += loc.w[x] * cr[2 * x + 1]; uI += loc.w[x] * (cr[2 * x] / hv); }
      worstParam = max(worstParam, abs(P.wrapSym(thI - th, m.cuff)), abs(uI - u));
      const X = P.pointOn(m, loc, m.open.positions, m.open.triangles), g = m.frame, thG = k === 0 ? g.thP - th : g.thR + th;
      const Y = m.kind === 'E' ? P.tubePoint(m.cuff, k === 0 ? -sg : sg, thG) : P.crownPoint(m.cuff, k === 0 ? -sg : sg, thG);
      far = max(far, hypot(X[0] - Y[0], X[1] - Y[1], X[2] - Y[2]));
    }
    dev.push(`${orders.join('')}: ${fmt(far)}`);
    ok(far < 0.05, `${orders.join('')}: pointOn(open crowns) stays near the exact crown point (${far})`);
  }
  say(`${n} points at 40 twists, five signatures: weights off by ${fmt(worstW)}, parameters by ${fmt(worstParam)}; pointOn against the exact crown point: ${dev.join('; ')}`);
  ok(bad === 0 && worstW < 1e-12 && worstParam < 1e-10, 'a triangle of the right pillow, weights in [0, 1] adding to 1, and the weighted corner parameters are the point\'s');
});

test('toPillow: a point of the pattern on the pillows (the charts\' inverse)', () => {
  const R = seeded(19);
  let eRot = 0;
  for (let i = 0; i < 200; i++) {
    const C = P.fermiToHyperboloid(R.between(-2, 2), R.between(-2, 2)), X = P.fermiToHyperboloid(R.between(-2, 2), R.between(-2, 2)), ang = R.between(-3, 3);
    const a = P.rotateAbout(X, C, ang), b = apply(E.GH.rotate(C, ang), X);
    eRot = max(eRot, hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / b[2]);
  }
  ok(eRot < 1e-11 && P.rotateAbout([0.3, 0, Math.sqrt(1.09)], [0, 0, 1], 0.5)[1] > 0, 'rotateAbout is the engine\'s GH.rotate: counter-clockwise');
  // points moved by random words of the group come back to the pillow point they started from
  let n = 0, inside0 = 0, nIn = 0, maxSteps = 0;
  const bins = [{ zMax: 50, tol: 1e-8, n: 0, bad: 0, worst: 0 }, { zMax: 2000, tol: 1e-4, n: 0, bad: 0, worst: 0 }], flatBin = { n: 0, bad: 0, worst: 0 };
  for (const [orders, L, tw] of [[[3, 3, 3, 3], 2, 0.17], [[2, 3, 5, 4], 2.5357, -0.3], [[3, 2, 2, 2], 1.6, 0.1], [[2, 2, 3, 3], 1.734, 0.41], [[4, 6, 3, 7], 1.2, 0.05], [[2, 2, 2, 2], 1.1, 0.2], [[2, 2, 2, 2], 0.8, -0.37]]) {
    const g = P.orbifold(orders, L, tw), flat = g.kind === 'E';
    const cone = [[g.sP, g.thP, orders[0]], [g.sQ, g.thQ, orders[1]], [g.sR, g.thR, orders[2]], [g.sS, g.thS, orders[3]]], gens = [];
    for (const [s, th, ord] of cone) for (const sgn of [1, -1]) {
      if (flat) gens.push((X) => [2 * th - X[0], 2 * s - X[1]]);
      else { const C = P.fermiToHyperboloid(s, th); gens.push((X) => P.rotateAbout(X, C, (sgn * TAU) / ord)); }
    }
    for (let it = 0; it < 800; it++) {
      const k = R.rnd() < 0.5 ? 0 : 1, pl = k === 0 ? g.lower : g.upper;
      if (pl.degenerate) continue;
      const thl = R.between(-g.cuff / 2, g.cuff / 2), sg = R.between(0.02, 0.98) * pl.roof(thl), side = k === 0 ? -1 : 1, base = k === 0 ? g.thP : g.thR;
      let X = flat ? [base + side * thl, side * sg] : P.fermiToHyperboloid(side * sg, base + side * thl);
      const direct = P.toPillow(g, X);
      nIn++; if (direct && direct.steps === 0 && direct.k === k) inside0++;
      const len = 1 + Math.floor(R.rnd() * (flat ? 12 : 6));
      let zPath = 0;
      for (let w = 0; w < len; w++) { X = gens[Math.floor(R.rnd() * gens.length)](X); if (!flat) zPath = max(zPath, X[2]); }
      const bin = flat ? flatBin : bins.find((bb) => zPath <= bb.zMax);
      if (!bin) continue;
      const r = P.toPillow(g, X);
      n++; bin.n++;
      const err = r && r.k === k ? abs(r.sigma - sg) + abs(P.wrapSym(r.thetaLocal - thl, g.cuff)) : Infinity;
      if (!(err < (flat ? 1e-12 : bin.tol))) bin.bad++; else bin.worst = max(bin.worst, err);
      if (r) maxSteps = max(maxSteps, r.steps);
    }
  }
  say(`${n} points moved by random words: ${bins[0].n} carried no farther than z = 50, worst ${fmt(bins[0].worst)}; ${bins[1].n} to z <= 2000, worst ${fmt(bins[1].worst)}; flat ${flatBin.n}, worst ${fmt(flatBin.worst)}; most turns needed ${maxSteps}`);
  assert.equal(inside0, nIn, 'a point inside a pillow is found at once');
  ok(bins.every((bb) => bb.bad === 0) && flatBin.bad === 0, 'a point moved by a word of the group comes back to the pillow point it started from');
});

test('a flip seen from the pillows: the new loop closes on the old pillows and crosses the old loop twice; the carry keeps the cone points and the seals', () => {
  // The new state's chart, carried into the old frame by the flip's invQ and onto the old pillows by toPillow: the
  // first step of the carry of SPEC 1.4 (toPillow -> locate -> pointOn), run here on the exact charts.
  let closed = true, worstClose = 0, nFlips = 0, lost = 0, worstCone = 0, nCone = 0, worstSeal = 0, nSeal = 0;
  const cross = [];
  for (const c of [{ k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 2.0, tw: 0.175 }, { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 2 * Math.acosh(2), tw: 0 }, { k: '3333', perm: [0, 1, 3, 2], orders: [2, 3, 5, 4], L: 2.5357, tw: -0.2 }, { k: '2223', perm: [3, 0, 1, 2], orders: [3, 2, 2, 2], L: 1.6, tw: 0.1 }]) {
    const st0 = { ...c, thetas: [0, 0, 0, 0] }, g0 = P.orbifold(st0.orders, st0.L, st0.tw), cp0 = P.conePositions(st0.orders, st0.L, st0.tw);
    const b0 = E.fourConeCentered(st0.orders, st0.L, st0.tw, { k: '3333' }), back = E.invH(b0.Pmat);
    /** An old pillow point as a point of the old orbifold chart, a seal point named by its side theta' >= 0. */
    const place = (pt) => {
      const pl = pt.k === 0 ? g0.lower : g0.upper, onSeal = !pl.degenerate && pt.sigma >= pl.roofAt(abs(pt.thetaLocal)) * (1 - 1e-9) - 1e-12;
      const thl = onSeal ? abs(pt.thetaLocal) : pt.thetaLocal, side = pt.k === 0 ? -1 : 1;
      return { s: side * pt.sigma, theta: (pt.k === 0 ? g0.thP : g0.thR) + side * thl };
    };
    const gapOf = (a, b) => abs(a.s - b.s) + abs(P.wrapSym(a.theta - b.theta, g0.cuff));
    for (const which of ['lo', 'hi']) {
      const r = F.flip(st0, which), st1 = r.state, b1 = E.fourConeCentered(st1.orders, st1.L, st1.tw, { k: '3333' }), g1 = P.orbifold(st1.orders, st1.L, st1.tw);
      const toOld = (s, theta) => P.toPillow(g0, apply(back, apply(r.invQ, apply(b1.Pmat, P.fermiToHyperboloid(s, theta)))));          // new chart point -> old pillow point
      nFlips++;
      // (a) the new loop on the old pillows: closed, and it crosses the old loop twice
      const N = 400, pts = [];
      for (let i = 0; i <= N; i++) pts.push(toOld(0, (i / N) * st1.L));
      if (pts.some((p) => !p)) { closed = false; continue; }
      const gap = gapOf(place(pts[0]), place(pts[N]));
      worstClose = max(worstClose, gap); if (!(gap < 1e-7)) closed = false;
      let crossings = 0;
      for (let i = 0; i < N; i++) if (pts[i].k !== pts[i + 1].k) crossings++;
      if (!g0.lower.degenerate && !g0.upper.degenerate) cross.push(crossings);
      // (b) the four cone points of the new state land on the old cone points of the same features
      const cp1 = P.conePositions(st1.orders, st1.L, st1.tw);
      for (let i = 0; i < 4; i++) {
        const got = toOld(cp1.s[i], cp1.theta[i]), j = st0.perm.indexOf(st1.perm[i]);
        if (!got) { lost++; continue; }
        // (a cone point of order 2 on a folded loop is found from the other pillow, at the same place of the chart)
        const d = gapOf({ s: (got.k === 0 ? -1 : 1) * got.sigma, theta: (got.k === 0 ? g0.thP - got.thetaLocal : g0.thR + got.thetaLocal) }, { s: cp0.s[j], theta: cp0.theta[j] });
        worstCone = max(worstCone, d); nCone++;
      }
      // (c) a point of a new seal has two chart points, (roof, theta') and (roof, -theta'): both land on ONE old point
      for (const k1 of [0, 1]) {
        const pl = k1 === 0 ? g1.lower : g1.upper, side = k1 === 0 ? -1 : 1, base = k1 === 0 ? g1.thP : g1.thR;
        if (pl.degenerate) continue;
        for (const fr of [0.13, 0.31, 0.5, 0.72, 0.9]) {
          const thl = fr * g1.cuff / 2, h = pl.roofAt(thl) * (1 - 1e-9);
          const a = toOld(side * h, base + side * thl), b = toOld(side * h, base - side * thl);
          if (!a || !b) { lost++; continue; }
          worstSeal = max(worstSeal, gapOf(place(a), place(b))); nSeal++;
        }
      }
    }
  }
  say(`${nFlips} flips of four states: the new loop closes on the old pillows to ${fmt(worstClose)}; crossings of the old loop: ${cross.join(', ')}; ${nCone} new cone points on the old ones to ${fmt(worstCone)}; ${nSeal} seal points, their two chart points apart by ${fmt(worstSeal)} on the old pillows; points not found: ${lost}`);
  ok(closed && nFlips === 8, 'the new loop of a flip, carried into the old pillows, is a closed curve there');
  ok(cross.length === 6 && cross.every((x) => x === 2), 'where both old pillows have an inside it crosses the old loop exactly twice');
  assert.equal(lost, 0);
  ok(nCone === 32 && worstCone < 1e-8, 'the carry keeps the four cone points');
  ok(nSeal >= 60 && worstSeal < 1e-6, 'the two chart points of a new seal point are one point of the old pillows');
});
