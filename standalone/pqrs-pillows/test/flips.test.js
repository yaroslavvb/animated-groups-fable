// flips.test.js — src/flips.js against the engine and against itself: a compact port of the prototype's check
// (/Users/solid/drive.unsynced/artifacts/pqrs-pillows/proto/flips/check.mjs, 2,400 states there; a few hundred here).
//   node --test test/flips.test.js
//
// HOW "THE PATTERN DID NOT MOVE" IS MEASURED (as in the prototype's check). The old pattern is the group of the old
// state: its tile (the engine's hexagon T(B) A B D C T(D), built from flips.js's own layout) with its three side
// pairings. A point is walked back into that tile; so is the point it should be an image of; the two must
// coincide. Only motions of the OLD group are used, so a small number can only mean "on the old orbit".
// Double precision places a point that stands rho from the middle of the picture to about 1e-16 e^(2 rho) / 4, so
// the geometric lines are asserted for the cases "in range" (both Lengths at most 10, nothing used further than 6
// from the middle of its picture); the lines about numbers (Length, Twist, the relation) are asserted for all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../../two-features-two-handles/src/handles.js';
import { apply, mul, inv, I3 } from '../../classification-of-surfaces/src/sym/geom.js';
import * as F from '../src/flips.js';

const N_STATES = 360, SEED = 20261127, LMAX = 10, RMAX = 6, NEAR = 3.5;
const PI = Math.PI, TAU = 2 * PI, GH = H.GH, GE = H.GE;

// ---- seeded numbers (the prototype's generator) ---------------------------------------------------------------------
function seeded(seed0) {
  let seed = seed0 >>> 0;
  const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const uni = (a, b) => a + (b - a) * rnd(), int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (list) => list[Math.floor(rnd() * list.length)];
  const shuffled = (list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { rnd, uni, int, pick, shuffled };
}

// ---- points, pictures, the old pattern ------------------------------------------------------------------------------
const lform = (a, b) => a[0] * b[0] + a[1] * b[1] - a[2] * b[2];
const lcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], -(a[0] * b[1] - a[1] * b[0])];
const onH = (v) => [v[0], v[1], Math.sqrt(1 + v[0] * v[0] + v[1] * v[1])];
const kindOf = (st) => (F.isFlat(st) ? GE : GH);
const move = (G, M, p) => (G === GE ? apply(M, p) : onH(apply(M, p)));
const rotate = (G, c, angle) => (G === GE ? GE.rotate(c, angle) : H.psuToSO21(H.psuRotate(c, angle)));
const backOf = (G, M) => (G === GE ? GE.fix(inv(M), 1) : H.invH(M));
const farOf = (G, p) => G.dist(p, G.origin);
const describe = (st, extra = '') => `orders ${st.orders.join('')} perm ${st.perm.join('')} L ${st.L.toFixed(6)} tw ${st.tw.toFixed(6)} tri ${F.triText(st.tri) || 'natural'}${extra}`;

const COMMAS = [0, 1, 2, 3].map((f) => ({ which: f % 2 ? 'small' : 'big', rho: 0.22 + 0.03 * f, size: 0.09, theta: 0 }));
/** The engine's picture of a state: its four cone points and one comma by each. */
function engineOf(st) {
  const b = F.isFlat(st)
    ? H.pillowCentered(st.L, st.tw, { perm: st.perm, thetas: st.thetas, commas: COMMAS })
    : H.fourConeCentered(st.orders, st.L, st.tw, { perm: st.perm, thetas: st.thetas, k: '3333', commas: COMMAS });
  return { home: b.home, shapes: b.shapes, cutSeg: b.cutSeg, verts: b.D.verts };
}
/** The pattern of a state, exactly: its cone points, and (hyperbolic) its tile with the side pairings. */
function patternOf(st) {
  const lay = F.layout(st), G = kindOf(st), home = [lay.X(0), lay.X(1), lay.Y(0), lay.Y(1)];
  if (G === GE) return { flat: true, G, st, home };
  const o = st.orders, pos = st.tw >= 0, T = lay.T, Ti = H.invH(T);
  const verts = pos ? [lay.X(0), lay.X(1), lay.Y(1), lay.Y(0), lay.Y(-1), lay.X(-1)] : [lay.X(1), lay.X(2), lay.Y(2), lay.Y(1), lay.Y(0), lay.X(0)];
  const a = pos ? lay.X(0) : lay.X(1), na = pos ? o[0] : o[1], c = pos ? lay.Y(0) : lay.Y(1), nc = pos ? o[2] : o[3];
  // maps[i] carries the tile to its neighbour across side i (as the engine's A.maps): the side paired with i onto i
  const maps = [rotate(GH, a, -TAU / na), Ti, rotate(GH, c, TAU / nc), rotate(GH, c, -TAU / nc), T, rotate(GH, a, TAU / na)];
  const n = 6, at = GH.mix(GH.mix(verts[0], verts[2], 0.5), GH.mix(verts[1], verts[3], 0.5), 0.47);
  const normals = verts.map((v, i) => {
    let m = lcross(v, verts[(i + 1) % n]);
    const l = Math.sqrt(Math.max(1e-300, lform(m, m)));
    m = [m[0] / l, m[1] / l, m[2] / l];
    return lform(m, at) < 0 ? [-m[0], -m[1], -m[2]] : m;
  });
  const ends = verts.map((v, i) => [GH.toward(v, verts[(i + 1) % n]), GH.toward(verts[(i + 1) % n], v)]);
  let pairing = 0;
  for (let i = 0; i < n; i++) { const j = 5 - i; pairing = Math.max(pairing, GH.dist(move(GH, maps[i], verts[j]), verts[(i + 1) % n]), GH.dist(move(GH, maps[i], verts[(j + 1) % n]), verts[i])); }
  return { flat: false, G, st, home, verts, n, at, normals, ends, maps, pairing };
}
/** Walk P back into the tile: follow the straight line from a point inside the tile to P, one side pairing at a time. */
function reduceH(pat, P, stat) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let a = attempt ? GH.mix(pat.at, pat.verts[attempt % pat.n], 0.11 * attempt) : pat.at, bq = onH(P), last = -1;
    for (let step = 0; step < 1500; step++) {
      let exit = -1, sBest = Infinity, exitAny = -1, sAny = Infinity, cross = null;
      for (let i = 0; i < pat.n; i++) {
        const fb = lform(pat.normals[i], bq);
        if (fb >= -1e-10 || i === last) continue;
        const fa = Math.max(0, lform(pat.normals[i], a)), sp = fa / (fa - fb);
        if (sp < sAny) { sAny = sp; exitAny = i; }
        if (sp >= sBest) continue;
        const c = onH([a[0] + sp * (bq[0] - a[0]), a[1] + sp * (bq[1] - a[1]), 0]);
        if (lform(pat.ends[i][0], c) < -1e-9 || lform(pat.ends[i][1], c) < -1e-9) continue;          // meets the line beyond the side's end
        sBest = sp; exit = i; cross = c;
      }
      if (exit < 0 && exitAny >= 0) { exit = exitAny; cross = onH([a[0] + sAny * (bq[0] - a[0]), a[1] + sAny * (bq[1] - a[1]), 0]); }
      if (exit < 0) return bq;
      const j = 5 - exit, M = pat.maps[j];          // maps[j] carries the tile across side `exit` back onto the tile
      a = onH(apply(M, cross)); bq = onH(apply(M, bq)); last = j;
    }
  }
  if (stat) stat.failed = (stat.failed || 0) + 1;
  return onH(P);
}
/** How far P is from the pattern's orbit of Q (both in the pattern's frame). */
function orbitDist(pat, P, Q, stat) {
  if (pat.flat) {
    const st = pat.st, ell = st.L, w = 1 / ell, s = 2 * ell * st.tw, A0 = pat.home[0];
    let best = Infinity;
    for (const sg of [1, -1]) {
      const vx = (P[0] - A0[0]) - sg * (Q[0] - A0[0]), vy = (P[1] - A0[1]) - sg * (Q[1] - A0[1]);
      const bb = vy / (2 * w), aa = (vx - bb * 2 * s) / (2 * ell);
      best = Math.min(best, Math.hypot(vx - Math.round(aa) * 2 * ell - Math.round(bb) * 2 * s, vy - Math.round(bb) * 2 * w));
    }
    return best;
  }
  const p = reduceH(pat, P, stat), q = reduceH(pat, Q, stat);
  let best = GH.dist(p, q);
  if (best > 1e-12) for (let i = 0; i < pat.n; i++) { best = Math.min(best, GH.dist(onH(apply(pat.maps[i], p)), q)); if (best < 1e-13) break; }
  return best;
}

// ---- records: every line is the largest value over its cases ---------------------------------------------------------
function makeTracks() {
  const tracks = new Map();
  const track = (name, value, where, must = true) => {
    let t = tracks.get(name);
    if (!t) { t = { max: -Infinity, where: null, n: 0, must }; tracks.set(name, t); }
    t.n++;
    if (!(value <= t.max)) { t.max = value; t.where = where; }
  };
  const settle = (limit = 1e-9) => {
    const lines = [], bad = [];
    for (const [name, t] of [...tracks.entries()].sort()) {
      lines.push(`${t.must ? '' : '(for scale) '}${name}: ${t.max.toExponential(1)} over ${t.n}`);
      if (t.must && !(t.max <= limit)) bad.push(`${name}: ${t.max.toExponential(2)} at ${t.where}`);
    }
    return { lines, bad };
  };
  return { track, settle, tracks };
}

/** One new state against the old pattern: the cone points, the group's turns, the commas. Returns whether in range. */
function compare(track, pat, oldE, st1, Q, invQ, tag, where, through = null) {
  const G = pat.G, st0 = pat.st, stat = {};
  const newE = engineOf(st1), newX = patternOf(st1);
  const cE = newE.home.map((p) => move(G, invQ, p)), cX = newX.home.map((p) => move(G, invQ, p));
  const size = Math.max(...(pat.verts || pat.home).map((p) => farOf(G, p)), ...(newX.verts || newX.home).map((p) => farOf(G, p)), ...cX.map((p) => farOf(G, p)), ...pat.home.map((p) => farOf(G, move(G, Q, p))));
  const inRange = G === GE || (Math.max(st0.L, st1.L, through ? through.L : 0) <= LMAX && Math.max(size, through ? through.size : 0) <= RMAX);
  const cls = G === GE ? '' : inRange ? ' [in range]' : ' [far]';
  const slotOld = (f) => st0.perm.indexOf(f);
  // 1. every new cone point lies on an old cone point of its feature
  let dE = 0, dX = 0;
  for (let sl = 0; sl < 4; sl++) {
    const q = pat.home[slotOld(st1.perm[sl])];
    dE = Math.max(dE, orbitDist(pat, cE[sl], q, stat));
    dX = Math.max(dX, orbitDist(pat, cX[sl], q, stat));
  }
  track(`${tag} a new cone point off the old ones, engine's picture${cls}`, dE, where, inRange);
  track(`${tag} a new cone point off the old ones, exact picture${cls}`, dX, where, inRange);
  // 2. and every old cone point lies on a new one (the other inclusion), in the new pattern
  let dBack = 0;
  for (let sl = 0; sl < 4; sl++) dBack = Math.max(dBack, orbitDist(newX, move(G, Q, pat.home[sl]), newX.home[st1.perm.indexOf(st0.perm[sl])], stat));
  track(`${tag} an old cone point off the new pattern${cls}`, dBack, where, inRange);
  // 3. the group is kept: the new turns, applied to old cone points near their centres, land on old cone points
  let gen = 0;
  for (let sl = 0; sl < 4; sl++) {
    const R = rotate(G, cX[sl], TAU / st1.orders[sl]);
    const pool = [0, 1, 2, 3].filter((m) => m !== sl).map((m) => ({ p: cX[m], f: st1.perm[m], r: G.dist(cX[m], cX[sl]) })).sort((u, v) => u.r - v.r);
    pool.forEach((smp, i) => { if (smp.r <= NEAR || i === 0) gen = Math.max(gen, orbitDist(pat, move(G, R, smp.p), pat.home[slotOld(smp.f)], stat)); });
  }
  track(`${tag} a new turn moves an old cone point off the old ones${cls}`, gen, where, inRange);
  // 4. every comma (the engine draws them): three of its points lie on the old comma's orbit, point for point
  let comma = 0;
  for (let f = 0; f < 4; f++) {
    const a = oldE.shapes[f].pts, b = newE.shapes[f].pts, m = a.length;
    for (const i of [0, Math.floor(m / 3), Math.floor((2 * m) / 3)]) comma = Math.max(comma, orbitDist(pat, move(G, invQ, b[i]), a[i], stat));
  }
  track(`${tag} a comma's points off the old comma's${cls}`, comma, where, inRange && !stat.failed);
  track(`${tag} tw outside [-1/2, 1/2] by`, Math.max(0, Math.abs(st1.tw) - 0.5), where);
  return { inRange, failed: stat.failed || 0 };
}

const SPECIAL_TW = [0, 0.25, -0.25, 0.5, -0.5];
function randomState(R) {
  const { rnd, uni, int, pick, shuffled } = R, u = rnd();
  let orders, kind;
  if (u < 0.12) { orders = [2, 2, 2, 2]; kind = 'flat 2222'; }
  else if (u < 0.20) { orders = [2, 2, int(2, 9), int(3, 9)]; if (rnd() < 0.5) orders = [orders[0], orders[1], orders[3], orders[2]]; kind = 'pair of 2s picked'; }
  else if (u < 0.28) { orders = [int(2, 9), int(3, 9), 2, 2]; if (rnd() < 0.5) orders = [orders[1], orders[0], 2, 2]; kind = 'pair of 2s far'; }
  else if (u < 0.37) { const a = int(3, 9), b = int(2, 9); orders = pick([[2, a, 2, b], [2, a, b, 2], [a, 2, 2, b], [a, 2, b, 2]]); kind = 'a 2 on each side'; }
  else if (u < 0.45) { const a = int(3, 9), b = int(3, 9); orders = pick([[a, a, a, a], [a, a, b, b], [a, b, a, b], [a, b, b, a]]); kind = 'equal orders'; }
  else { do { orders = [int(2, 9), int(2, 9), int(2, 9), int(2, 9)]; } while (orders.every((n) => n === 2)); kind = 'generic'; }
  const flat = orders.every((n) => n === 2);
  const L = flat ? uni(0.5, 2.0) : uni(0.4, 7.0);
  const special = kind === 'equal orders' || rnd() < (flat ? 0.3 : 0.08);
  const tw = special ? pick(SPECIAL_TW) : uni(-0.5, 0.5);
  const st = { k: flat ? '2222' : '3333', perm: shuffled([0, 1, 2, 3]), orders, L, tw, thetas: [0, 1, 2, 3].map(() => uni(-PI, PI)), b: 0, tau: 0 };
  let out = st;
  const v = rnd();
  if (v < 0.12) { for (let i = int(1, 3); i > 0; i--) out = F.flip(out, rnd() < 0.5 ? 'lo' : 'hi').state; kind += ', after flips'; }          // a carried triangle
  else if (v < 0.2) { out = F.swap(st, rnd() < 0.5 ? 'lo' : 'hi').state; kind += ', one swap on'; }                                       // one swap from the natural one
  return { st: out, tag: flat ? 'flat' : 'hyperbolic', kind };
}
const STATES = (() => { const R = seeded(SEED), out = []; for (let i = 0; i < N_STATES; i++) out.push(randomState(R)); return out; })();
const report = (title, lines) => { console.log(`    ${title}`); for (const l of lines) console.log(`      ${l}`); };

// =====================================================================================================================
test(`a flip keeps the cone points, the group and the commas (${N_STATES} seeded states, both flips of each)`, () => {
  const { track, settle } = makeTracks(), kinds = {};
  let flips = 0, inRange = 0, walks = 0;
  for (const { st: st0, tag, kind } of STATES) {
    kinds[kind] = (kinds[kind] || 0) + 1;
    const pat = patternOf(st0), oldE = engineOf(st0), G = pat.G, where0 = describe(st0);
    const size0 = Math.max(...(pat.verts || pat.home).map((p) => farOf(G, p))), in0 = pat.flat || (st0.L <= LMAX && size0 <= RMAX), far = in0 ? '' : ' [far]';
    if (!pat.flat) track(`${tag} the check's own tile: a side pairing off its side by${far}`, pat.pairing, where0, in0);
    if (!pat.flat) track(`${tag} the check's own tile: its six corners against the engine's tile${far}`, Math.max(...pat.verts.map((p, i) => G.dist(p, oldE.verts[i]))), where0, in0);
    track(`${tag} this layer's cone points against the engine's${far}`, Math.max(...pat.home.map((p, i) => G.dist(p, oldE.home[i]))), where0, in0);
    for (const which of ['lo', 'hi']) {
      const r = F.flip(st0, which);
      const c = compare(track, pat, oldE, r.state, r.Q, r.invQ, tag, `${where0} flip ${which}`);
      flips++; if (c.inRange) inRange++; walks += c.failed;
    }
  }
  const { lines, bad } = settle();
  report(`${flips} flips, ${inRange} in range (flat ones count as in range); kinds: ${Object.entries(kinds).sort().map(([k, v]) => `${k} ${v}`).join('; ')}; walks into the tile that did not end: ${walks}`, lines);
  assert.deepEqual(bad, []);
  assert.ok(inRange > 0.7 * flips, `most cases are in range: ${inRange} of ${flips}`);
});

test('flip and flip back, and three flips round the face, return the numbers, the slots, the commas and the pose', () => {
  const { track, settle } = makeTracks();
  for (const { st: st0, tag } of STATES) {
    const pat = patternOf(st0), G = pat.G, where0 = describe(st0), tr = F.triangle(st0);
    const sizeOf = (st) => { const p = patternOf(st); return Math.max(...(p.verts || p.home).map((q) => farOf(G, q))); };
    const classOf = {};
    for (const which of ['lo', 'hi']) {
      const where = `${where0} flip ${which}`, r = F.flip(st0, which), st1 = r.state, lp = tr.loops[which === 'lo' ? 1 : 2];
      const inR = pat.flat || (Math.max(st0.L, st1.L) <= LMAX && Math.max(sizeOf(st0), sizeOf(st1)) <= RMAX), far = inR ? '' : ' [far]';
      classOf[which] = inR;
      track(`${tag} the flip's numbers against the triangle's listing`, Math.abs(st1.L - lp.L) + Math.abs(st1.tw - lp.tw) + (st1.perm.join('') === lp.perm.join('') ? 0 : 1), where);
      // the triangle is kept: its other two loops have the lengths they had (closed forms in the NEW numbers)
      const t1 = F.triangle(st1), kept = which === 'lo' ? [t1.loops[1].L - tr.loops[2].L, t1.loops[2].L - tr.loops[0].L] : [t1.loops[1].L - tr.loops[0].L, t1.loops[2].L - tr.loops[1].L];
      track(`${tag} the triangle after a flip: its other two lengths changed by`, Math.max(...kept.map(Math.abs)), where);
      const r2 = F.flip(st1, which === 'lo' ? 'hi' : 'lo'), st2 = r2.state;
      track(`${tag} flip and back: L`, Math.abs(st2.L - st0.L), where);
      track(`${tag} flip and back: tw`, Math.abs(st2.tw - st0.tw), where);
      track(`${tag} flip and back: perm, orders or tri differ (0 or 1)`, st2.perm.join('') === st0.perm.join('') && st2.orders.join('') === st0.orders.join('') && F.triText(st2.tri) === F.triText(tr.tri) ? 0 : 1, where);
      track(`${tag} flip and back: comma angles${far}`, Math.max(...st2.thetas.map((t, i) => Math.abs(t - st0.thetas[i]))), where, inR);
      const QQ = mul(r2.Q, r.Q);
      track(`${tag} flip and back: pose (a cone point moved by)${far}`, Math.max(...pat.home.map((p) => G.dist(move(G, QQ, p), p))), where, inR);
      // the same flip named by two features, by its number, by its key
      const viaPair = F.flip(st0, lp.pairing[0]).state, viaNum = F.flip(st0, which === 'lo' ? 1 : 2).state, viaKey = F.flip(st0, lp.key).state;
      track(`${tag} a flip named by features, by number or by key differs (0 or 1)`, viaPair.L === st1.L && viaPair.tw === st1.tw && viaNum.L === st1.L && viaKey.L === st1.L && viaKey.tw === st1.tw && viaKey.perm.join('') === st1.perm.join('') ? 0 : 1, where);
    }
    const in3 = classOf.lo && classOf.hi, far3 = in3 ? '' : ' [far]';
    for (const dirn of ['lo', 'hi']) {
      let cur = st0, Qacc = I3.slice();
      for (let i = 0; i < 3; i++) { const r = F.flip(cur, dirn); cur = r.state; Qacc = mul(r.Q, Qacc); }
      track(`${tag} three round: L`, Math.abs(cur.L - st0.L), where0);
      track(`${tag} three round: tw`, Math.abs(cur.tw - st0.tw), where0);
      track(`${tag} three round: perm or tri differ (0 or 1)`, cur.perm.join('') === st0.perm.join('') && F.triText(cur.tri) === F.triText(tr.tri) ? 0 : 1, where0);
      track(`${tag} three round: pose (a cone point moved by)${far3}`, Math.max(...pat.home.map((p) => G.dist(move(G, Qacc, p), p))), where0, in3);
      track(`${tag} three round: comma angles${far3}`, Math.max(...cur.thetas.map((t, i) => Math.abs(t - st0.thetas[i]))), where0, in3);
    }
  }
  const { lines, bad } = settle();
  report('largest value of each line', lines);
  assert.deepEqual(bad, []);
});

test('a chain of six flips keeps the pattern; the Twist never leaves [-1/2, 1/2]', () => {
  const { track, settle } = makeTracks(), R = seeded(SEED + 1);
  let n = 0, inRange = 0;
  for (const { st: st0, tag } of STATES.slice(0, 160)) {
    const pat = patternOf(st0), oldE = engineOf(st0), G = pat.G;
    let cur = st0, Qacc = I3.slice(), twOut = 0;
    const path = [], through = { L: 0, size: 0 };
    for (let i = 0; i < 6; i++) {
      const w = R.rnd() < 0.5 ? 'lo' : 'hi', r = F.flip(cur, w);
      cur = r.state; Qacc = mul(r.Q, Qacc); path.push(w);
      twOut = Math.max(twOut, Math.abs(cur.tw) - 0.5);
      if (!pat.flat) { const mid = patternOf(cur); through.L = Math.max(through.L, cur.L); through.size = Math.max(through.size, ...mid.verts.map((p) => farOf(G, p))); }
    }
    const where = `${describe(st0)} chain ${path.join(',')}`;
    const c = compare(track, pat, oldE, cur, Qacc, backOf(G, Qacc), `${tag} chain of six:`, where, through);
    n++; if (c.inRange) inRange++;
    track(`${tag} chain of six: tw outside [-1/2, 1/2] at some step by`, Math.max(0, twOut), where);
  }
  const { lines, bad } = settle();
  report(`${n} chains, ${inRange} in range`, lines);
  assert.deepEqual(bad, []);
});

test('the trace relation (Fricke\'s cubic; Heron on the plane), its other root is the twin, and the closed forms', () => {
  const { track, settle } = makeTracks(), R = seeded(SEED + 2);
  let long = 0, reducedN = 0, natural = 0;
  for (const { st, tag } of STATES) {
    const where = describe(st), tr = F.triangle(st), flat = tr.kind === 'E';
    track(`${tag} trace relation residual`, Math.abs(tr.residual), where);
    track(`${tag} closed forms: the apex's two distances agree on where it stands`, tr.err, where);
    for (const lp of tr.loops.slice(1)) track(`${tag} loop length: the flip's against the one-line closed form`, Math.abs(F.neighbour(st, lp.index).L - lp.L), `${where} loop ${lp.index}`);
    // the relation written out here, from the three Lengths alone
    if (flat) {
      const [a, b, c] = tr.loops.map((lp) => lp.L);
      track('flat Heron: 2 (a2 b2 + b2 c2 + c2 a2) - (a4 + b4 + c4) = 4 (relative)', Math.abs(2 * (a * a * b * b + b * b * c * c + c * c * a * a) - (a ** 4 + b ** 4 + c ** 4) - 4) / Math.max(4, a ** 4 + b ** 4 + c ** 4), where);
    } else {
      const cs = st.orders.map((n) => Math.cos(PI / n)), X = tr.loops.map((lp) => Math.cosh(lp.L / 2));
      const kap = tr.loops.map((lp) => cs[lp.slots[0][0]] * cs[lp.slots[0][1]] + cs[lp.slots[1][0]] * cs[lp.slots[1][1]]);
      const res = X[0] ** 2 + X[1] ** 2 + X[2] ** 2 - 2 * X[0] * X[1] * X[2] + 2 * (kap[0] * X[0] + kap[1] * X[1] + kap[2] * X[2]) + cs.reduce((s, c) => s + c * c, 0) + 4 * cs[0] * cs[1] * cs[2] * cs[3] - 1;
      track('hyperbolic cubic, written out from the three Lengths (relative)', Math.abs(res) / Math.max(1, 2 * X[0] * X[1] * X[2]), where);
    }
    // a twin's length by closed form (loops k + 2 and k - 1) against the relation's other root
    const k = tr.k, twinLo = F.neighbour(st, k + 2), twinHi = F.neighbour(st, k - 1);
    track(`${tag} a twin's length: closed form against the relation's other root`, Math.max(Math.abs(twinLo.X - tr.loops[1].partner) / Math.max(1, twinLo.X), Math.abs(twinHi.X - tr.loops[2].partner) / Math.max(1, twinHi.X)), where);
    // each loop's two arcs between cone points give its Length (F1; flat: the arc is the Length)
    const G = kindOf(st), oY = (i) => st.orders[(((i % 2) + 2) % 2) === 0 ? 2 : 3];
    const sizeAll = Math.max(...tr.loops.flatMap((lp) => lp.seg.concat(lp.seals.flat())).map((p) => farOf(G, p)));
    const inD = flat || (st.L <= LMAX && Math.max(...tr.loops.map((lp) => lp.L)) <= LMAX && sizeAll <= RMAX);
    for (const lp of tr.loops) {
      const j = lp.index, no = lp.id === 'cut' ? [[st.orders[0], st.orders[1]], [st.orders[2], st.orders[3]]] : lp.id === 'lo' ? [[st.orders[1], oY(j + 1)], [st.orders[0], oY(j)]] : [[oY(j), st.orders[0]], [st.orders[1], oY(j + 1)]];
      let sealErr = 0;
      lp.seals.forEach((seal, i) => { const d = G.dist(seal[0], seal[1]); sealErr = Math.max(sealErr, Math.abs((flat ? d : H.pairLength(no[i][0], no[i][1], d)) - lp.L)); });
      track(`${tag} drawn: a loop's two arcs give its Length (F1)${inD ? '' : ' [far]'}`, sealErr, `${where} loop ${lp.id}`, inD);
      // its motion T is the product of the turns about the pair it picks; its two ends are kept by T
      const [u0, u1] = lp.seals[0], TT = mul(rotate(G, u0, TAU / no[0][0]), rotate(G, u1, TAU / no[0][1]));
      for (const q of [G.mix(u0, u1, 0.5), G.mix(u0, u1, 0.2)]) {
        const a = move(G, lp.T, q), b = move(G, TT, q), nearBy = flat || (inD && farOf(G, b) <= RMAX);
        track(`${tag} drawn: a loop's motion T against the product of its pair's two turns${nearBy ? '' : ' [far]'}`, G.dist(a, b), `${where} loop ${lp.id}`, nearBy);
      }
      if (lp.ends) {
        let e = 0;
        const Ti = H.invH(lp.T);
        for (const w of lp.ends) {
          const off = (M) => { const v = apply(M, [w[0], w[1], 1]); return Math.hypot(v[0] / v[2] - w[0], v[1] / v[2] - w[1]); };
          e = Math.max(e, Math.min(off(lp.T), off(Ti)), Math.abs(Math.hypot(w[0], w[1]) - 1));
        }
        track(`${tag} drawn: a loop's two ends, moved by T or off the circle by${inD ? '' : ' [far]'}`, e, `${where} loop ${lp.id}`, inD);
      }
    }
    if (!tr.loops[0].minimal) long++;
    if (tr.reduced) reducedN++;
    if (tr.natural) { natural++; track(`${tag} natural triangle: one of the two other loops is longer than its twin (0 or 1)`, tr.loops[1].minimal && tr.loops[2].minimal ? 0 : 1, where); }
  }
  // swap of the cut for its twin: its Length is the other root, the other two loops stay
  for (let i = 0; i < 60; i++) {
    const { st, tag } = randomState(R), tr = F.triangle(st), r = F.swap(st, 'cut');
    const want = tr.kind === 'E' ? tr.loops[0].partner : 2 * Math.acosh(Math.max(1, tr.loops[0].partner));
    track(`${tag} swap of the cut: Length against the relation's other root`, Math.abs(r.state.L - want), describe(st));
    const t2 = F.triangle(r.state), a = [t2.loops[1].L, t2.loops[2].L].sort(), b = [tr.loops[1].L, tr.loops[2].L].sort();
    track(`${tag} swap of the cut: the other two loops' lengths changed by`, Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), describe(st));
  }
  const { lines, bad } = settle();
  report(`${STATES.length} triangles: ${natural} natural, ${reducedN} reduced, the cut longer than its twin in ${long}`, lines);
  assert.deepEqual(bad, []);
  // the example of the notes: 3333 as classified, X^2 + Y^2 + Z^2 - 2 X Y Z + X + Y + Z + 1/4 = 0 at (2, 2, 7/2)
  const tr = F.triangle({ k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 2 * Math.acosh(2), tw: 0, thetas: [0, 0, 0, 0] });
  assert.deepEqual(tr.loops.map((lp) => +lp.X.toFixed(9)), [2, 3.5, 2]);
  assert.ok(Math.abs(4 + 4 + 12.25 - 2 * 2 * 2 * 3.5 + 2 + 2 + 3.5 + 0.25) < 1e-12);
});

test('the engine\'s own re-cut takes the same loops from a natural triangle (and does not always come back)', () => {
  let n = 0, same = 0, worstTw = 0, tie = 0, back = 0, backFail = 0, failLong = 0, failShort = 0, okLong = 0;
  const modGap = (a, b, period) => { const d = (((a - b) % period) + period) % period; return Math.min(d, period - d); };
  for (const { st: st0 } of STATES) {
    const tr = F.triangle(st0);
    if (!tr.natural) continue;
    const flat = F.isFlat(st0), base = { ...st0, k: flat ? '2222' : '3333' };
    for (const which of ['lo', 'hi']) {
      const mine = F.flip(st0, which).state, e = H.recut(base, mine.perm[0], mine.perm[1]), lp = tr.loops[which === 'lo' ? 1 : 2];
      n++;
      if (Math.abs(e.L - mine.L) < 1e-9) {
        same++;
        const gap = Math.min(modGap(e.tw, mine.tw, 1), modGap(e.tw, mine.tw + 0.5, 1));
        const twinAsLong = Math.abs((flat ? lp.partner : 2 * Math.acosh(lp.partner)) - mine.L) < 1e-9;
        if (twinAsLong && gap > 1e-9) tie++; else worstTw = Math.max(worstTw, gap);
      }
      // the engine there and back: the Length returns exactly when the cut is no longer than its twin
      const e2 = H.recut({ ...base, perm: e.perm, orders: e.orders, L: e.L, tw: e.tw, thetas: e.thetas }, st0.perm[0], st0.perm[1]);
      back++;
      const failed = Math.abs(e2.L - st0.L) > 1e-9, isLong = !tr.loops[0].minimal;
      if (failed) { backFail++; if (isLong) failLong++; else failShort++; } else if (isLong) okLong++;
    }
  }
  console.log(`    the engine's pick gives the flip's Length in ${same} of ${n}; then the same Twist up to the far pair's naming: ${worstTw.toExponential(1)} (${tie} ties with a twin); pick and pick back fails in ${backFail} of ${back}: the cut longer than its twin in ${failLong} of them, not in ${failShort}; returned although longer: ${okLong}`);
  assert.equal(same, n, 'from a natural triangle the engine picks the same loop');
  assert.ok(worstTw < 1e-9);
  assert.equal(failShort, 0, 'the engine comes back whenever the cut is no longer than its twin');
  assert.equal(okLong, 0, 'and never when it is longer');
  assert.ok(backFail > 0, 'the case the flip layer exists for occurs in the sample');
});

test('named cases: the numbers of the notes', () => {
  const th0 = [0.3, -0.4, 0.5, 0.1];
  const loops = (st) => Object.fromEntries(F.triangle(st).loops.map((lp) => [lp.key, lp]));
  const is = (lp, L, tw, msg) => { assert.ok(Math.abs(lp.L - L) < 5e-7, `${msg}: Length ${lp.L} against ${L}`); assert.ok(Math.abs(lp.tw - tw) < 5e-7, `${msg}: Twist ${lp.tw} against ${tw}`); };
  // 3333 as classified (the run the page folder was seeded with)
  const a = loops({ k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 2 * Math.acosh(2), tw: 0, thetas: th0 });
  is(a['01|23'], 2.633916, 0, '3333 cut'); is(a['03|12'], 3.849695, 0.25, '3333 diagonal'); is(a['02|13'], 2.633916, 0, '3333 across');
  assert.equal(a['01|23'].id, 'cut'); assert.equal(a['03|12'].id, 'lo'); assert.equal(a['02|13'].id, 'hi');
  // 2345 as classified: m = 0132, so P, Q, R, S have orders 2, 3, 4, 5
  H.normalizeFamilyKey('2345');
  const fam = H.FAMILIES['2345'], perm = fam.defaultM.split('').map(Number);
  const b = loops({ k: '2345', perm, orders: perm.map((c) => fam.baseOrders[c]), L: fam.defaultL, tw: fam.defaultTw, thetas: th0 });
  is(b['01|23'], 2.535706, 0, '2345 cut'); is(b['02|13'], 3.796814, 0.247578, '2345 diagonal'); is(b['03|12'], 2.623276, 0, '2345 across');
  // 3333 at Length 4.1, Twist 0.2: the cut is longer than its twin, and the flip still comes back (the engine does not)
  const st41 = { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 4.1, tw: 0.2, thetas: th0 }, t41 = F.triangle(st41);
  assert.equal(t41.loops[0].minimal, false);
  is(t41.loops[2], 2.324465, t41.loops[2].tw, '3333 L 4.1: the first and third cone points');
  assert.ok(Math.abs(2 * Math.acosh(t41.loops[0].partner) - 3.706781) < 5e-7, 'the cut\'s twin is 3.706781 long');
  const there = F.flip(st41, 'hi').state, home = F.flip(there, [0, 1]).state;
  assert.ok(Math.abs(home.L - 4.1) < 1e-12 && Math.abs(home.tw - 0.2) < 1e-12);
  const e1 = H.recut(st41, 0, 2), e2 = H.recut({ ...st41, perm: e1.perm, orders: e1.orders, L: e1.L, tw: e1.tw, thetas: e1.thetas }, 0, 1);
  assert.ok(Math.abs(e1.L - 2.324465) < 5e-7 && Math.abs(e2.L - 3.706781) < 5e-7, `the engine returns the twin: ${e1.L}, ${e2.L}`);
  // half a turn either way: the flips keep the sign on the way back
  for (const tw of [0.5, -0.5]) for (const which of ['lo', 'hi']) {
    const s0 = { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 2, tw, thetas: th0 }, r = F.flip(F.flip(s0, which).state, which === 'lo' ? 'hi' : 'lo').state;
    assert.ok(Math.abs(r.tw - tw) < 1e-12 && Math.abs(r.L - 2) < 1e-12 && r.perm.join('') === '0123', `3333 at ${tw} of a turn, ${which} and back: ${r.tw}`);
  }
});

test('2222: the flat family', () => {
  const th0 = [0, 0, 0, 0], flat = (L, tw) => ({ k: '2222', perm: [0, 1, 2, 3], orders: [2, 2, 2, 2], L, tw, thetas: th0 });
  const loops = (st) => Object.fromEntries(F.triangle(st).loops.map((lp) => [lp.key, lp]));
  const sq = loops(flat(1, 0));
  assert.deepEqual(['01|23', '02|13', '03|12'].map((k) => +sq[k].L.toFixed(6)), [1, 1, 1.414214]);
  assert.deepEqual(['01|23', '02|13', '03|12'].map((k) => +sq[k].tw.toFixed(6) + 0), [0, 0, 0.25]);
  assert.deepEqual(['01|23', '02|13', '03|12'].map((k) => +sq[k].length.toFixed(6)), [2, 2, 2.828427], 'L is the pair\'s spacing, half the loop');
  // a quarter turn at L = 1: the two other loops are equally long mirror images
  const q = loops(flat(1, 0.25));
  assert.ok(Math.abs(q['02|13'].L - 1.118034) < 5e-7 && Math.abs(q['03|12'].L - 1.118034) < 5e-7);
  assert.deepEqual([q['02|13'].tw, q['03|12'].tw].map((t) => +Math.abs(t).toFixed(6)), [0.2, 0.2]);
  assert.ok(q['02|13'].tw * q['03|12'].tw < 0);
  // the hexagonal shape: all three equal, both others read +1/4
  const hx = loops(flat(Math.pow(4 / 3, 0.25), 0.25));
  for (const k of ['01|23', '02|13', '03|12']) assert.ok(Math.abs(hx[k].L - 1.074570) < 5e-7, `${k}: ${hx[k].L}`);
  assert.ok(Math.abs(hx['02|13'].tw - 0.25) < 1e-9 && Math.abs(hx['03|12'].tw - 0.25) < 1e-9);
  // L = 1.8 at a quarter turn: the cut is longer than its twin (1.111111)
  const t18 = F.triangle(flat(1.8, 0.25));
  assert.equal(t18.loops[0].minimal, false);
  assert.ok(Math.abs(t18.loops[0].partner - 1.111111) < 5e-7);
  // half a turn: the loop across is 1 / L long at Twist 0
  const h = F.triangle(flat(1.1, 0.5)), across = h.loops.find((lp) => Math.abs(lp.tw) < 1e-9 && lp.id !== 'cut');
  assert.ok(across && Math.abs(across.L - 1 / 1.1) < 1e-12);
  // a loop's line: any parallel; seg the middle one, dir its direction, no ends
  for (const lp of F.triangle(flat(1.2, 0.1)).loops) { assert.equal(lp.ends, null); assert.ok(Math.abs(Math.hypot(lp.dir[0], lp.dir[1]) - 1) < 1e-12); assert.equal(lp.onTree, null); }
  // the three Lengths are the sides of a triangle of area 1/2 (Heron), for a sweep of shapes
  let worst = 0, worstMove = 0;
  for (let i = 0; i < 40; i++) {
    const st = flat(0.5 + 0.0375 * i, -0.5 + 0.025 * i), tr = F.triangle(st), [x, y, z] = tr.loops.map((lp) => lp.L), s = (x + y + z) / 2;
    worst = Math.max(worst, Math.abs(Math.sqrt(s * (s - x) * (s - y) * (s - z)) - 0.5));
    // and the cone-point lattice is the same lattice after a flip
    const pat = patternOf(st);
    for (const which of ['lo', 'hi']) {
      const r = F.flip(st, which), lay = F.layout(r.state);
      [lay.X(0), lay.X(1), lay.Y(0), lay.Y(1)].forEach((p, sl) => { worstMove = Math.max(worstMove, orbitDist(pat, apply(r.invQ, p), pat.home[st.perm.indexOf(r.state.perm[sl])])); });
    }
  }
  console.log(`    2222, 40 shapes: the face's area off 1/2 by ${worst.toExponential(1)}; a cone point after a flip off the old lattice by ${worstMove.toExponential(1)}`);
  assert.ok(worst < 1e-12 && worstMove < 1e-12);
});

test('a pair of 2s: the loop is that pair\'s seal run twice', () => {
  const th0 = [0, 0, 0, 0];
  // 2223 as the page opens it: every loop has a pair of 2s on one side
  const tr = F.triangle({ k: '2223', perm: [3, 0, 1, 2], orders: [3, 2, 2, 2], L: Math.acosh(2), tw: 0, thetas: th0 });
  const by = Object.fromEntries(tr.loops.map((lp) => [lp.id, lp]));
  assert.ok(Math.abs(by.cut.L - 1.316958) < 5e-7 && by.cut.onTree === 'far');
  assert.ok(Math.abs(by.hi.L - 1.316958) < 5e-7 && Math.abs(by.hi.tw) < 1e-9 && by.hi.onTree === 'far');
  assert.ok(Math.abs(by.lo.L - 1.924847) < 5e-7 && Math.abs(by.lo.tw - 0.25) < 1e-9 && by.lo.onTree === 'picked');
  for (const lp of tr.loops) {
    // seg is the pair's segment: half the loop long, and it joins two cone points of order 2
    assert.ok(Math.abs(GH.dist(lp.seg[0], lp.seg[1]) - lp.L / 2) < 1e-9, `${lp.id}: seg is half the loop`);
    assert.equal(lp.length, lp.L);
    const twos = lp.onTree === 'picked' ? lp.orders.slice(0, 2) : lp.orders.slice(2);
    assert.deepEqual(twos, [2, 2]);
  }
  // 2323 at L = 2.2, tw = 0.1: a 2 on each side of the cut; the loop 02|13 is a pair of 2s, 1.5319 long
  const t2 = F.triangle({ k: '3333', perm: [0, 1, 2, 3], orders: [2, 3, 2, 3], L: 2.2, tw: 0.1, thetas: th0 });
  const lp = t2.loops.find((l) => l.key === '02|13');
  assert.ok(lp.onTree && Math.abs(lp.L - 1.5319) < 5e-5, `2323: ${lp.L} ${lp.onTree}`);
  assert.equal(t2.loops[0].onTree, null);
  assert.ok(Math.abs(t2.residual) < 1e-12, 'the relation needs no change for a pair of 2s');
  // flips through pairs of 2s come back
  for (const which of ['lo', 'hi']) {
    const st = { k: '3333', perm: [0, 1, 2, 3], orders: [2, 3, 2, 3], L: 2.2, tw: 0.1, thetas: th0 }, back = F.flip(F.flip(st, which).state, which === 'lo' ? 'hi' : 'lo').state;
    assert.ok(Math.abs(back.L - 2.2) < 1e-12 && Math.abs(back.tw - 0.1) < 1e-12);
  }
});

test('the words: the four turns as a tuple, the chains by turns', () => {
  const R = seeded(SEED + 3), { track, settle } = makeTracks();
  const idGap = (g) => Math.min(Math.hypot(g[0] - 1, g[1], g[2], g[3]), Math.hypot(g[0] + 1, g[1], g[2], g[3]));
  let done = 0;
  for (let tries = 0; done < 80 && tries < 20000; tries++) {
    let orders;
    do { orders = [R.int(2, 9), R.int(2, 9), R.int(2, 9), R.int(2, 9)]; } while (orders.every((n) => n === 2));
    const st = { k: '3333', perm: [0, 1, 2, 3], orders, L: R.uni(0.8, 3.2), tw: R.uni(-0.5, 0.5), thetas: [0, 0, 0, 0] };
    const lay = F.layout(st), js = [-2, -1, 0, 1, 2, 3];
    if (Math.max(...js.map((j) => farOf(GH, lay.Y(j))), farOf(GH, lay.X(-2)), farOf(GH, lay.X(3))) > 5) continue;          // a turn about a far point reaches far: kept within 5
    done++;
    const where = describe(st), oY = (j) => orders[(((j % 2) + 2) % 2) === 0 ? 2 : 3], oX = (j) => orders[(((j % 2) + 2) % 2) === 0 ? 0 : 1];
    const Rt = (pt, n) => H.psuRotate(pt, TAU / n), a = Rt(lay.X(0), orders[0]), b = Rt(lay.X(1), orders[1]);
    for (const j of [-2, -1, 0, 1, 2]) {
      const y0 = Rt(lay.Y(j), oY(j)), y1 = Rt(lay.Y(j + 1), oY(j + 1));
      track('R(A) R(B) R(Y_{j+1}) R(Y_j) off the identity by', idGap(H.psuMul(H.psuMul(a, b), H.psuMul(y1, y0))), `${where} j ${j}`);
      track('loop j as R(B) R(Y_{j+1}): its length against the closed form', Math.abs(2 * Math.acosh(Math.max(1, Math.abs(H.psuMul(b, y1)[0]))) - F.neighbour(st, j).L), `${where} j ${j}`);
      track('Y_{j+1} against R(Y_j)(Y_{j-1})', GH.dist(move(GH, H.psuToSO21(y0), lay.Y(j - 1)), lay.Y(j + 1)), `${where} j ${j}`);
      track('X_{j-1} against R(X_j)(X_{j+1})', GH.dist(move(GH, H.psuToSO21(Rt(lay.X(j), oX(j))), lay.X(j + 1)), lay.X(j - 1)), `${where} j ${j}`);
      track('T = R(A) R(B) takes Y_j to Y_{j-2}', GH.dist(move(GH, H.psuToSO21(H.psuMul(a, b)), lay.Y(j + 1)), lay.Y(j - 1)), `${where} j ${j}`);
      track('layout().T against R(A) R(B)', GH.dist(move(GH, lay.T, lay.Y(j + 1)), lay.Y(j - 1)), `${where} j ${j}`);
    }
  }
  const { lines, bad } = settle();
  report(`${done} states`, lines);
  assert.equal(done, 80);
  assert.deepEqual(bad, []);
});

test('the carried triangle: stamped, lapses when a number moves; tri as text; anchor; the cut names itself', () => {
  const st = { k: '3333', perm: [0, 1, 2, 3], orders: [3, 3, 3, 3], L: 4.1, tw: 0.2, thetas: [0, 0, 0, 0] };
  const there = F.flip(st, 'lo').state;
  assert.deepEqual([there.tri.L, there.tri.tw], [there.L, there.tw]);
  // the carried triangle is not the natural one here (the cut was longer than its twin) ...
  const carried = F.triangle(there), natural = F.triangle(F.anchor(there));
  assert.equal(F.anchor(there).tri, undefined);
  assert.equal(natural.natural, true);
  assert.notDeepEqual(carried.loops.map((lp) => +lp.L.toFixed(9)).sort(), natural.loops.map((lp) => +lp.L.toFixed(9)).sort());
  // ... and it lapses by itself once L or tw change
  for (const moved of [{ ...there, L: there.L + 1e-6 }, { ...there, tw: there.tw - 1e-6 }]) assert.equal(F.triangle(moved).natural, true);
  assert.deepEqual(F.triangle({ ...there }).tri, carried.tri);
  // tri as text and back (no stamp: taken as it is)
  assert.equal(F.triText(there.tri), [there.tri.k, there.tri.lo, there.tri.hi].join('.'));
  assert.deepEqual(F.triFrom(F.triText(there.tri)), { k: there.tri.k, lo: there.tri.lo, hi: there.tri.hi });
  assert.deepEqual(F.triFrom('-1._.2'), { k: -1, lo: null, hi: 2 });
  assert.equal(F.triText({ k: -1, lo: null, hi: 2 }), '-1._.2');
  for (const bad of ['', 'x', '1.2', '1.2.3.4', '_.0.0', null]) assert.equal(F.triFrom(bad), null, String(bad));
  assert.deepEqual(F.triangle({ ...F.anchor(there), tri: F.triFrom(F.triText(there.tri)) }).tri, carried.tri);
  // the cut's own key, or two features it keeps together: the same state, the triangle fixed
  for (const which of ['12|03', [1, 2], 0, 'cut']) { const r = F.flip(there, which); assert.equal(r.loop, 'cut'); assert.equal(r.state.L, there.L); assert.equal(r.state.tw, there.tw); assert.deepEqual(r.state.perm, there.perm); }
  assert.throws(() => F.flip(st, 'sideways'), /which loop/);
  assert.equal(F.pairingKey([[3, 1], [2, 0]]), '02|13');
  assert.equal(F.isFlat({ orders: [2, 2, 2, 2] }), true);
  assert.equal(F.naturalIndex({ tw: 0 }), -1); assert.equal(F.naturalIndex({ tw: -0.1 }), 0);
});

test('the page\'s own print after a flip and the engine\'s re-tie: every comma an image of an old one', () => {
  const lines = [];
  let worst = 0, parted = 0, n = 0;
  for (const [k, L, tw] of [['3333', null, null], ['2223', null, null], ['2345', null, null], ['2222', null, null], ['3333', 2.2, 0.13], ['2222', 1.2, -0.2]]) {
    const key = H.normalizeFamilyKey(k), fam = H.FAMILIES[key], perm = fam.defaultM.split('').map(Number);
    const st = { k: key, perm, orders: perm.map((c) => fam.baseOrders[c]), L: L ?? fam.defaultL, tw: tw ?? fam.defaultTw, b: 0, tau: 0, thetas: H.defaultCommas(key).map((sp) => (sp ? sp.theta : 0)) };
    const pat = patternOf(st), G = pat.G, before = H.centredFor(st).shapes;
    const matchAll = (shapes, bring) => {
      let w = 0;
      for (const sh of shapes) {
        let best = Infinity;
        for (const old of before) {
          if (old.pts.length !== sh.pts.length) continue;
          const m = sh.pts.length;
          let d = 0;
          for (const i of [0, Math.floor(m / 3), Math.floor((2 * m) / 3)]) d = Math.max(d, orbitDist(pat, bring(sh.pts[i]), old.pts[i]));
          best = Math.min(best, d);
        }
        w = Math.max(w, best);
      }
      return w;
    };
    for (const which of ['lo', 'hi']) {
      const r = F.flip(st, which), next = r.state;
      next.print = H.retiePrint(next, st);
      const after = H.centredFor(next).shapes;
      if (after.length !== before.length) { parted++; lines.push(`${k} flip ${which}: the engine's re-tie parted ${before.length} commas into ${after.length} (its own doing: not compared)`); continue; }
      const d1 = matchAll(after, (p) => move(G, r.invQ, p));
      const r2 = F.flip(next, which === 'lo' ? 'hi' : 'lo'), home = r2.state;
      home.print = H.retiePrint(home, next);
      const again = H.centredFor(home).shapes, QQ = mul(r2.Q, r.Q);
      const d2 = again.length === before.length ? matchAll(again, (p) => move(G, backOf(G, QQ), p)) : 0;
      n++; worst = Math.max(worst, d1, d2);
      assert.ok(d1 < 1e-9 && d2 < 1e-9, `${k} L ${st.L} tw ${st.tw} flip ${which}: a comma displaced by ${d1.toExponential(2)}; after the flip back ${d2.toExponential(2)}`);
    }
  }
  console.log(`    ${n} flips of six states re-tied (and flipped back, re-tied again): a comma displaced by at most ${worst.toExponential(1)}; re-ties that parted commas: ${parted}`);
  for (const l of lines) console.log('    ' + l);
  assert.ok(n >= 8);
});
