// stress.mjs — try to break src/shapes.js (+ its bake through src/sdf.js) with nasty motifs, against the reviewer's brute
// force in lib.mjs (review-math, 13 Nov 2026).
//   node dev/patterns/scratch-review-math/stress.mjs [--cases A,B,...] [--ids 'o,*632'] [--pts 300] [--tex 128] [--out file.json]
// Per case: validateShapes; W against brute force; fillShapes' nonzero winding against W (plain and flipping map);
// margin against brute force; the baked texture byte by byte against the exact value; the tone under elements.
import { makeShapePrint, validateShapes, fillShapes, bakeShapes, measureShapes } from '../../../src/shapes.js';
import { sdfSample } from '../../../src/sdf.js';
import { writeFileSync } from 'node:fs';
import { GROUPS, BY_ID, prng, movedGroup, flatMotif, bruteW, bruteMargin, recorder, windingOf, rosette, commaAt, roomAt, symmetryElements, elementsNear } from './lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CASES = arg('--cases', '').split(',').filter(Boolean);
const IDS = arg('--ids', '').split(',').filter(Boolean);
const NPTS = +arg('--pts', 300), TEX = +arg('--tex', 128), OUT = arg('--out', null);
const want = (c) => !CASES.length || CASES.includes(c);
const groups = IDS.length ? IDS.map((id) => BY_ID[id]) : GROUPS;

/** The roomiest generic place: of 49 places centre + a e1 + b e2, the one farthest from its other images. */
function roomiest(g) {
  let best = null;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    const a = (i + 0.37) / 7 - 0.5, b = (j + 0.61) / 7 - 0.5;
    const x = g.center[0] + a * g.e1[0] + b * g.e2[0], y = g.center[1] + a * g.e1[1] + b * g.e2[1], D = roomAt(g, x, y);
    if (!best || D > best.D * (1 + 1e-6)) best = { x, y, D };
  }
  return best;
}

const cases = [];
const add = (name, group, shapes, expect, extra = {}) => cases.push({ name, group, shapes, expect, ...extra });

for (const g of groups) {
  const size = Math.sqrt(g.domainArea), b = roomiest(g);
  if (want('A')) add(`A comma generic ${g.id}`, g, [{ pts: commaAt([b.x, b.y], 0.45 * b.D, 0.7) }], 'ok');
  const L = Math.hypot(...g.e1) + Math.hypot(...g.e2), sym = symmetryElements(g, g.center[0], g.center[1], L);
  // B: a rosette with a hole and an island in it on every kind of rotation centre (order 2, 3, 4, 6)
  if (want('B')) {
    const seen = new Set();
    for (const c of sym.centers) {
      const key = c.order + (c.onMirror ? 'm' : '');
      if (seen.has(key)) continue;
      seen.add(key);
      const room = roomAt(g, c.x, c.y), N = 240;
      const o = rosette(g, [c.x, c.y], 0.3 * room, N, { amp: 0.08, seed: 11 }), h = rosette(g, [c.x, c.y], 0.18 * room, N / 2, { amp: 0.06, seed: 12 }), i = rosette(g, [c.x, c.y], 0.08 * room, N / 4, { amp: 0.05, seed: 13 });
      add(`B rosette+hole+island on a ${c.order}-centre${c.onMirror ? ' on a mirror' : ''} ${g.id} (stab ${o.order})`, g, [{ pts: o.pts }, { pts: h.pts, hole: true }, { pts: i.pts }], 'ok', { stab: o.order });
      // the same, turned a little: no longer symmetric -> must be refused
      if (o.order > 1) {
        const bad = rosette(g, [c.x, c.y], 0.3 * room, N, { amp: 0.08, seed: 11, phase0: 0.0371 });
        // a rosette whose vertices are not permuted by the stabilizer, with a lopsided bump (breaks the symmetry)
        const lop = bad.pts.map(([x, y], k) => { const t = (2 * Math.PI * k) / N, f = 1 + 0.15 * Math.exp(-((t - 1) ** 2) * 8); return [c.x + (x - c.x) * f, c.y + (y - c.y) * f]; });
        add(`B- lopsided rosette on a ${c.order}-centre${c.onMirror ? ' on a mirror' : ''} ${g.id}`, g, [{ pts: lop }], 'bad');
        // rough symmetry: one vertex off by 1e-5 tile sizes
        const rough = o.pts.map((p, k) => (k === 7 ? [p[0] + 1e-5 * size, p[1]] : p));
        add(`B~ rosette 1e-5 off on a ${c.order}-centre ${g.id}`, g, [{ pts: rough }], 'bad');
      }
    }
  }
  // C: on a mirror, away from centres: a symmetric egg (stab 2); and its lopsided twin (must be refused)
  if (want('C') && sym.mirrors.length) {
    const m = sym.mirrors[0];
    let best = null;
    for (let k = 0; k < 40; k++) { const t = -L + (2 * L * (k + 0.5)) / 40, p = [m.px + t * m.ux, m.py + t * m.uy], D = roomAt(g, p[0], p[1]); if (!best || D > best.D) best = { p, D }; }
    const o = rosette(g, best.p, 0.3 * best.D, 200, { amp: 0.1, seed: 21 });
    add(`C egg on a mirror ${g.id} (stab ${o.order})`, g, [{ pts: o.pts }], 'ok', { stab: o.order });
    add(`C- comma on a mirror ${g.id}`, g, [{ pts: commaAt(best.p, 0.3 * best.D, 0.4) }], 'bad');
  }
  // D: a comma centred on a glide axis (not a mirror)
  if (want('D') && sym.glides.length) {
    const m = sym.glides[0];
    let best = null;
    for (let k = 0; k < 40; k++) { const t = -L + (2 * L * (k + 0.5)) / 40, p = [m.px + t * m.ux, m.py + t * m.uy], D = roomAt(g, p[0], p[1]); if (!best || D > best.D) best = { p, D }; }
    add(`D comma across a glide axis ${g.id}`, g, [{ pts: commaAt(best.p, 0.45 * best.D, 1.1) }], 'ok');
  }
  // E: a motif larger than the lattice cell (copies overlap: refused; W, fill and texture must still agree)
  if (want('E')) add(`E comma larger than the cell ${g.id}`, g, [{ pts: commaAt([b.x, b.y], 1.3 * Math.max(Math.hypot(...g.e1), Math.hypot(...g.e2)), 0.3) }], 'bad');
  // H: 3 points; 2400 points
  if (want('H')) {
    const s = 0.3 * b.D;
    add(`H triangle ${g.id}`, g, [{ pts: [[b.x - s, b.y - 0.6 * s], [b.x + s, b.y - 0.2 * s], [b.x - 0.1 * s, b.y + s]] }], 'ok');
    const n = 2400, pts = [];
    for (let k = 0; k < n; k++) { const t = (2 * Math.PI * k) / n, r = 0.3 * b.D * (1 + 0.12 * Math.cos(3 * t + 0.2) + 0.08 * Math.sin(17 * t) + 0.05 * Math.cos(41 * t)); pts.push([b.x + r * Math.cos(t), b.y + r * Math.sin(t)]); }
    add(`H 2400 points ${g.id}`, g, [{ pts }], 'ok');
    add(`H 2401 points ${g.id}`, g, [{ pts }, { pts: [[b.x + 0.01 * s, b.y], [b.x + 0.02 * s, b.y], [b.x + 0.015 * s, b.y + 0.01 * s]] }], 'bad');
  }
}
// F: far from the origin (the same orbit: a lattice translate of the motif, and the motif carried by an element)
// G: moved groups; K: other bases of the same lattice
for (const g of groups) {
  const b = roomiest(g), base = [{ pts: commaAt([b.x, b.y], 0.45 * b.D, 0.7) }];
  if (want('F')) {
    const w = [37 * g.e1[0] - 51 * g.e2[0], 37 * g.e1[1] - 51 * g.e2[1]];
    add(`F comma 37 e1 - 51 e2 away ${g.id}`, g, [{ pts: base[0].pts.map(([x, y]) => [x + w[0], y + w[1]]) }], 'ok', { same: base });
    const e = g.reps[g.reps.length - 1];
    add(`F comma carried by rep ${g.reps.length - 1} + 5 e2 ${g.id}`, g, [{ pts: base[0].pts.map(([x, y]) => [e.a * x + e.b * y + e.tx + 5 * g.e2[0], e.c * x + e.d * y + e.ty + 5 * g.e2[1]]) }], 'ok', { same: base });
  }
  if (want('G')) {
    for (const mv of [{ th: 0.7 }, { s: 0.01 }, { s: 100 }, { v: [1e4, -3e4] }, { th: 2.1, s: 0.013, v: [-7e3, 2e3] }, { refl: true, th: 0.4 }, { refl: true, s: 37, v: [3e5, 1e5] }]) {
      const { h, M } = movedGroup(g, mv);
      add(`G moved ${JSON.stringify(mv)} ${g.id}`, h, [{ pts: base[0].pts.map(M) }], 'ok', { carriedFrom: { g, shapes: base, M } });
    }
  }
  if (want('K')) {
    for (const [nm, e1, e2] of [['skew e2+3e1', g.e1, [g.e2[0] + 3 * g.e1[0], g.e2[1] + 3 * g.e1[1]]], ['swapped (det<0)', g.e2, g.e1], ['very skew 7e1+2e2, 3e1+e2', [7 * g.e1[0] + 2 * g.e2[0], 7 * g.e1[1] + 2 * g.e2[1]], [3 * g.e1[0] + g.e2[0], 3 * g.e1[1] + g.e2[1]]]]) {
      const h = { ...g, e1, e2 };
      add(`K basis ${nm} ${g.id}`, h, base, 'ok', { same: base, sameGroup: g });
    }
  }
}
// I: nearly touching copies, in o: a parallelogram along e1 of length |e1| - delta
if (want('I')) {
  const g = BY_ID.o, size = Math.sqrt(g.domainArea), u = g.e1, v = g.e2;
  for (const dl of [1e-7, 1e-4, 0.0199, 0.0201, 0.05]) {
    const a = 1 - (dl * size) / Math.hypot(...u), p0 = [0.1, 0.1];
    const pts = [p0, [p0[0] + a * u[0], p0[1] + a * u[1]], [p0[0] + a * u[0] + 0.3 * v[0], p0[1] + a * u[1] + 0.3 * v[1]], [p0[0] + 0.3 * v[0], p0[1] + 0.3 * v[1]]];
    add(`I parallelogram gap ${dl} tile sizes along e1 (o)`, g, [{ pts }], dl >= 0.02 ? 'ok' : 'bad', { gapExpect: dl });
  }
}
// J: odd motifs: a hole outside its outer polygon; two polygons touching at a point; an outer polygon listed clockwise
if (want('J')) {
  const g = BY_ID['2222'], b = roomiest(g), s = 0.2 * b.D, sq = (x, y, r) => [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]];
  add('J hole outside (2222)', g, [{ pts: sq(b.x, b.y, s) }, { pts: sq(b.x + 3 * s, b.y, 0.5 * s), hole: true }], 'bad');
  add('J two squares touching at a corner (2222)', g, [{ pts: sq(b.x, b.y, s) }, { pts: sq(b.x + 2 * s, b.y + 2 * s, s) }], 'bad');
  add('J clockwise outer, counter-clockwise hole (2222)', g, [{ pts: sq(b.x, b.y, s).reverse() }, { pts: sq(b.x, b.y, 0.5 * s), hole: true }], 'ok');
  add('J island in a hole (2222)', g, [{ pts: sq(b.x, b.y, s) }, { pts: sq(b.x, b.y, 0.6 * s), hole: true }, { pts: sq(b.x, b.y, 0.3 * s) }], 'ok');
  add('J hole touching its outer polygon from inside (2222)', g, [{ pts: sq(b.x, b.y, s) }, { pts: [[b.x - s, b.y], [b.x, b.y - 0.5 * s], [b.x + 0.5 * s, b.y]], hole: true }], 'bad');
  add('J pinch: a vertex repeated (2222)', g, [{ pts: [[b.x, b.y], [b.x + s, b.y - s], [b.x + s, b.y + s], [b.x, b.y], [b.x - s, b.y + s], [b.x - s, b.y - s]] }], 'bad');
  add('J bow-tie (2222)', g, [{ pts: [[b.x - s, b.y - s], [b.x + s, b.y + s], [b.x + s, b.y - s], [b.x - s, b.y + s]] }], 'bad');
  add('J collinear spike (2222)', g, [{ pts: [[b.x - s, b.y - s], [b.x + s, b.y - s], [b.x + s, b.y], [b.x + 2 * s, b.y], [b.x + s, b.y], [b.x + s, b.y + s], [b.x - s, b.y + s]] }], 'bad');
  add('J closing point repeated (2222)', g, [{ pts: [...sq(b.x, b.y, s), sq(b.x, b.y, s)[0]] }], 'ok');
}

// ---------------------------------------------------------------------------------------------------------------
const rows = [];
const t0 = Date.now();
for (const C of cases) {
  const g = C.group, size = Math.sqrt(g.domainArea), row = { name: C.name, expect: C.expect };
  let P;
  try { P = makeShapePrint(g, { shapes: C.shapes }); } catch (e) { row.threw = e.message; rows.push(row); continue; }
  const V = validateShapes(P);
  row.ok = V.ok; row.stab = V.stabilizer; row.gap = +V.gap.toFixed(6); row.problems = V.problems.map((s) => s.slice(0, 110));
  row.verdict = (C.expect === 'ok') === V.ok ? 'as expected' : 'UNEXPECTED';
  if (C.stab != null && V.ok && V.stabilizer !== C.stab) row.verdict += ` STAB ${V.stabilizer} != ${C.stab}`;
  if (C.gapExpect != null) row.gapErr = Math.abs(V.gap - Math.min(C.gapExpect, V.gap)) ;
  const F = flatMotif(C.shapes), rnd = prng(1234 + rows.length);
  const L = Math.max(Math.hypot(...g.e1), Math.hypot(...g.e2));
  // points: half round the group's window, half round the motif
  let wBad = 0, wN = 0, mBad = 0, mWorst = 0, fBad = 0, fBadFlip = 0, invBad = 0, sameBad = 0, carBad = 0;
  const els = elementsNear(g, g.center[0], g.center[1], 2.5 * L);
  const c1 = recorder(), c2 = recorder();
  const box = [g.center[0] - 1.6 * L, g.center[1] - 1.6 * L, g.center[0] + 1.6 * L, g.center[1] + 1.6 * L];
  fillShapes(c1, P, (x, y, o) => { o[0] = x; o[1] = y; return o; }, box, '#000');
  fillShapes(c2, P, (x, y, o) => { o[0] = 3 * x + 1; o[1] = -2 * y + 5; return o; }, box, '#000');    // flips, squeezes
  const Psame = C.same ? makeShapePrint(C.sameGroup || g, { shapes: C.same }) : null;
  const Pcar = C.carriedFrom ? makeShapePrint(C.carriedFrom.g, { shapes: C.carriedFrom.shapes }) : null;
  for (let i = 0; i < NPTS; i++) {
    const near = i % 2, x = near ? F.cx + (2 * rnd() - 1) * 1.2 * F.R : g.center[0] + (2 * rnd() - 1) * 1.5 * L;
    const y = near ? F.cy + (2 * rnd() - 1) * 1.2 * F.R : g.center[1] + (2 * rnd() - 1) * 1.5 * L;
    const bm = bruteMargin(g, F, x, y, 0.5 * size);
    const m = P.margin(x, y);
    if (Math.abs(m - bm) > 1e-9 * size * (1 + Math.abs(x) / size + Math.abs(y) / size) && !(bm >= 0.5 * size && m >= 0.5 * size)) { mBad++; mWorst = Math.max(mWorst, Math.abs(m - bm) / size); }
    if (bm < 1e-9 * size * (1 + Math.abs(x) / size + Math.abs(y) / size)) continue;          // on an outline
    wN++;
    const W = P.winding(x, y), BW = bruteW(g, F, x, y);
    if (W !== BW) { wBad++; if (!row.wFirst) row.wFirst = { x, y, W, BW }; }
    const tone = W > 0 ? 1 : 0;
    if (Math.abs(x - g.center[0]) < 1.5 * L && Math.abs(y - g.center[1]) < 1.5 * L) {
      const w1 = windingOf(c1.fills[0].path, x, y), w2 = windingOf(c2.fills[0].path, 3 * x + 1, -2 * y + 5);
      if (w1 !== W) { fBad++; if (!row.fFirst) row.fFirst = { x, y, w1, W }; }
      if (w2 !== -W) fBadFlip++;
    }
    const e = els[(rnd() * els.length) | 0], gx = e.a * x + e.b * y + e.tx, gy = e.c * x + e.d * y + e.ty;
    if (P.tone(gx, gy) !== tone) invBad++;
    if (Psame && Psame.tone(x, y) !== tone && Psame.margin(x, y) > 1e-9 * size * (1 + Math.abs(x) / size)) sameBad++;
    if (Pcar) {
      // the moved print at M(p) is the home print at p: pick a home point instead
      const hx = C.carriedFrom.g.center[0] + (2 * rnd() - 1) * L / (C.group.domainArea / C.carriedFrom.g.domainArea) ** 0.5, hy = C.carriedFrom.g.center[1] + (2 * rnd() - 1) * L / (C.group.domainArea / C.carriedFrom.g.domainArea) ** 0.5;
      if (Pcar.margin(hx, hy) > 1e-7 * Math.sqrt(C.carriedFrom.g.domainArea)) { const q = C.carriedFrom.M([hx, hy]); if (P.tone(q[0], q[1]) !== Pcar.tone(hx, hy)) carBad++; }
    }
  }
  Object.assign(row, { pts: wN, wBad, mBad, mWorst: +mWorst.toExponential(2), fBad, fBadFlip, invBad, sameBad, carBad });
  // the texture: every texel against the exact value from P.winding and P.margin (themselves checked above)
  if (TEX > 0) {
    const T = bakeShapes(P, TEX);
    let tBad = 0, tOff1 = 0;
    const range = T.range;
    for (let j = 0; j < T.size; j++) for (let i = 0; i < T.size; i++) {
      const s = (i + 0.5) / T.size, t = (j + 0.5) / T.size, x = T.origin[0] + s * T.e1[0] + t * T.e2[0], y = T.origin[1] + s * T.e1[1] + t * T.e2[1];
      const m = P.margin(x, y), W = P.winding(x, y), lv = 127 * Math.min(1, m / range), exp = Math.round(W > 0 ? 128 - lv : 128 + lv), got = T.data[j * T.size + i];
      if (got !== exp) { if (Math.abs(got - exp) === 1 && Math.abs((lv % 1) - 0.5) < 1e-3) tOff1++; else if (m > 1e-9 * size) { tBad++; if (!row.tFirst) row.tFirst = { i, j, got, exp, m: m / T.pitch, W }; } }
    }
    // the seam: the bilinear read just either side of s = 0 | 1 and t = 0 | 1 against the exact tone (away from outlines)
    let seamBad = 0, seamN = 0;
    const diag = Math.hypot(T.e1[0] + T.e2[0], T.e1[1] + T.e2[1]) / T.size + Math.hypot(T.e1[0] - T.e2[0], T.e1[1] - T.e2[1]) / T.size;
    for (let k = 0; k < 400; k++) {
      const along = rnd(), eps = (rnd() - 0.5) * 2 / T.size, side = k % 2;
      const s = side ? eps : along, t = side ? along : eps, x = T.origin[0] + s * T.e1[0] + t * T.e2[0], y = T.origin[1] + s * T.e1[1] + t * T.e2[1];
      if (P.margin(x, y) <= diag) continue;
      seamN++;
      if ((sdfSample(T.data, T.size, s, t) < 128 ? 1 : 0) !== P.tone(x, y)) seamBad++;
    }
    Object.assign(row, { texSize: T.size, tBad, tOff1, seamN, seamBad, texAgain: bakeShapes(P, TEX) === T });
  }
  rows.push(row);
}
const bad = rows.filter((r) => r.threw || r.verdict !== 'as expected' || r.wBad || r.mBad || r.fBad || r.fBadFlip || r.invBad || r.sameBad || r.carBad || r.tBad || r.seamBad);
for (const r of rows) console.log(JSON.stringify(r));
console.log(`\n${rows.length} cases in ${((Date.now() - t0) / 1000).toFixed(1)} s; ${bad.length} with something to look at`);
for (const r of bad) console.log('LOOK', JSON.stringify(r));
if (OUT) writeFileSync(OUT, JSON.stringify(rows, null, 1));
