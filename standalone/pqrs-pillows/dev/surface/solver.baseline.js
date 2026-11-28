// solver.js — the closed surface of PQRS as a relaxed mesh: a BASELINE behind the PROTO-SPEC interface.
// Pure: no DOM; stands on pillow.js alone. (A round of better solvers is under way behind the same interface;
// the winner replaces this file. Nothing else in the page may look inside it.)
//
//   const surf = createSurface({ nTheta, nS });
//   surf.set(orders, L, tw);          cold start; deterministic (a fixed number of sweeps, no clock)
//   surf.update(L, tw, budgetMs);     warm step for nearby numbers; returns within about budgetMs
//   surf.positions                    Float64Array, 3 per vertex of the CLOSED surface (seals merged)
//   surf.mesh                         pillow.js's mesh (triangles, edges, restLength, triPillow, cones, waist, seals,
//                                     strip, open …). The object changes when the grid or the (2, 2) pattern does;
//                                     its strip's triangles change when mesh.strip.cells does.
//   surf.adoptPositions(positions)    take closed positions for the CURRENT mesh (after a flip)
//   surf.stats()                      { strainMean, strainMax, sweeps, ms, vertices }
//   extras: surf.prepare(orders, L, tw) builds the mesh without relaxing (then adoptPositions);
//           surf.settle(budgetMs) goes on relaxing.
//
// METHOD (position-based, after the scout's zip experiment):
//   start    pillow.js's `mesh.positions`: the exact open crowns with every seal vertex midway between its two
//            crown points, each seal's chain then drawn out to its own length (startInto). There the triangles at
//            the seals span the open mouth of each crown.
//   homotopy every edge is held at  start chord + tau (rest length − start chord),  tau rising from 0 to 1 over the
//            first part of the run: the mouths close gradually (the seals are zipped) while every other edge stays at
//            its exact length throughout.
//   bending  for every edge the distance between the two opposite corners of its two triangles is pulled, weakly,
//            toward the value it has when the two triangles lie flat in one plane (from the rest lengths alone). It
//            smooths the surface and, across a seal, pushes the two sheets of a horn apart.
//   sweeps   Gauss–Seidel over edges then hinges, forwards and backwards in turn.
//   (2, 2)   the folded ring of a pair of 2s is held a straight rod for the first 0.6 of a cold start (rods()).
//
// WHAT IT GIVES (measured, 2,738 vertices, 1,500 sweeps, about 0.25 s): mean stretch 0.3–0.5 %, worst 3–8 %; the
// right kind of shape, but wrinkled (about 15 % of plain edges turn more than 25 degrees), with 14–50 pairs of
// crossing triangles near the horns, kinks in the seal lines, and no mirror symmetry where there should be one
// (the sweeps run in index order). The solver round is to remove exactly these.

import * as P from './pillow.js';

export const DEFAULTS = {
  nTheta: 60, nS: 22,
  sweeps: 1500,          // a cold start
  zipShare: 0.45,        // the share of the cold start over which the seals close
  bend: 0.08,            // the hinges' weight while the seals close
  bendEnd: 0.02,         // … at the end of a cold start and in warm steps
  sealBend: 0,           // along a seal: two vertices two steps apart are pulled toward the sum of the two steps (a straight
                         // crease). Off: it makes the shape depend on which loop is the cut, so a flip would re-shape it.
  foldBend: 0,           // the same along the folded ring of a (2, 2) pair
  sealBendCold: 0,       // the seals' straightening during the first `sealShare` of a cold start only (then let go)
  sealShare: 0.8,
  rodShare: 0.6,         // a cold start keeps the folded ring of a (2, 2) pair a straight rod (its vertices at their own
                         // spacing, projected after every sweep) for this share of its sweeps; 0: never. Warm steps and
                         // the sweeps after a flip never do: the fold belongs to the cut, not to the surface, and a
                         // shape that depended on it would move at a flip.
  foldHeavy: 0,          // while the seals close, how much of every pull a folded ring's vertices refuse (tried: worse)
  sealHeavy: 0,          // … and a seal's (tried: much worse, the seal crumples when it is let go)
  warmMinSweeps: 2,
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createSurface(opts = {}) {
  const K = { ...DEFAULTS, ...opts };
  let mesh = null, n = 0, x = new Float64Array(0), guess = new Float64Array(0);
  let hOpp = new Uint32Array(0), hEdges = new Uint32Array(0), hRest = new Float64Array(0), nH = 0;
  let hingeKey = '';
  let sA = new Uint32Array(0), sB = new Uint32Array(0), sE = new Uint32Array(0), sW = new Float64Array(0), nSeal = 0;   // the seals' triples: ends a, b; the two edges between; the weight
  let chainE = [];                               // per seal: the edge ids along its chain
  let start = new Float64Array(0);               // the start chords of a cold start
  let scratch = new Float64Array(0);
  let rodOn = false, sealW = 0;                    // this sweep: the rod is on; the weight of the seals' straightening
  let heavy = new Float64Array(0), anyHeavy = false;   // while the seals close: how much of a pull a vertex refuses (0 none, 1 all)
  let sweepsDone = 0, lastMs = 0, flip = false;

  function build(orders, L, tw) {
    const m = P.orbifoldMesh(orders, L, tw, { nTheta: K.nTheta, nS: K.nS, into: mesh || undefined });
    if (m !== mesh) { mesh = m; n = m.nVertices; x = new Float64Array(3 * n); guess = new Float64Array(3 * n); hingeKey = ''; }
    hinges();
  }

  /** The hinges: for every edge, the two corners opposite it, and the four other edges of its two triangles. */
  function hinges() {
    const key = `${mesh.nTheta}/${mesh.nS}/${mesh.degenerate}/${mesh.strip ? mesh.strip.cells : 0}`;
    if (key !== hingeKey) {
      hingeKey = key;
      const E = mesh.nEdges, ed = mesh.edges, tr = mesh.triangles, T = mesh.nTriangles;
      const id = new Map();
      for (let e = 0; e < E; e++) { const a = ed[2 * e], b = ed[2 * e + 1]; id.set(a < b ? a * n + b : b * n + a, e); }
      const eid = (a, b) => id.get(a < b ? a * n + b : b * n + a);
      const opp = new Int32Array(2 * E).fill(-1);
      for (let t = 0; t < T; t++) for (let c = 0; c < 3; c++) {
        const a = tr[3 * t + c], b = tr[3 * t + (c + 1) % 3], w = tr[3 * t + (c + 2) % 3], e = eid(a, b);
        if (e === undefined) continue;
        if (opp[2 * e] < 0) opp[2 * e] = w; else if (opp[2 * e + 1] < 0) opp[2 * e + 1] = w;
      }
      if (hOpp.length !== 2 * E) { hOpp = new Uint32Array(2 * E); hEdges = new Uint32Array(5 * E); hRest = new Float64Array(E); }
      nH = 0;
      for (let e = 0; e < E; e++) {
        const w1 = opp[2 * e], w2 = opp[2 * e + 1];
        if (w1 < 0 || w2 < 0 || w1 === w2) continue;
        const u = ed[2 * e], v = ed[2 * e + 1], e1 = eid(u, w1), e2 = eid(v, w1), e3 = eid(u, w2), e4 = eid(v, w2);
        if (e1 === undefined || e2 === undefined || e3 === undefined || e4 === undefined) continue;
        hOpp[2 * nH] = w1; hOpp[2 * nH + 1] = w2;
        hEdges[5 * nH] = e; hEdges[5 * nH + 1] = e1; hEdges[5 * nH + 2] = e2; hEdges[5 * nH + 3] = e3; hEdges[5 * nH + 4] = e4;
        nH++;
      }
      // the seals' chains: vertex k - 1 and vertex k + 1
      let cnt = 0;
      for (const sl of mesh.seals) cnt += Math.max(0, sl.chain.length - 2);
      if (sA.length !== cnt) { sA = new Uint32Array(cnt); sB = new Uint32Array(cnt); sE = new Uint32Array(2 * cnt); }
      nSeal = 0;
      if (sW.length !== cnt) sW = new Float64Array(cnt);
      for (const sl of mesh.seals) for (let k = 1; k + 1 < sl.chain.length; k++) {
        const a = sl.chain[k - 1], m = sl.chain[k], b = sl.chain[k + 1], e1 = eid(a, m), e2 = eid(m, b);
        if (e1 === undefined || e2 === undefined || a === b) continue;
        sA[nSeal] = a; sB[nSeal] = b; sE[2 * nSeal] = e1; sE[2 * nSeal + 1] = e2; sW[nSeal] = mesh.degenerate[sl.pillow] ? 1 : 0; nSeal++;
      }
      chainE = mesh.seals.map((sl) => { const ids = []; for (let k = 0; k + 1 < sl.chain.length; k++) ids.push(eid(sl.chain[k], sl.chain[k + 1])); return ids; });
    }
    // the flat diagonal of each hinge from the five rest lengths
    const r = mesh.restLength;
    for (let h = 0; h < nH; h++) {
      const c = r[hEdges[5 * h]], a1 = r[hEdges[5 * h + 1]], b1 = r[hEdges[5 * h + 2]], a2 = r[hEdges[5 * h + 3]], b2 = r[hEdges[5 * h + 4]];
      const x1 = (c * c + a1 * a1 - b1 * b1) / (2 * c), y1 = Math.sqrt(Math.max(0, a1 * a1 - x1 * x1));
      const x2 = (c * c + a2 * a2 - b2 * b2) / (2 * c), y2 = Math.sqrt(Math.max(0, a2 * a2 - x2 * x2));
      hRest[h] = Math.hypot(x1 - x2, y1 + y2);
    }
  }

  function pull(u, v, r, w) {
    const u3 = 3 * u, v3 = 3 * v, dx = x[u3] - x[v3], dy = x[u3 + 1] - x[v3 + 1], dz = x[u3 + 2] - x[v3 + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-12) return;
    const f = (w * 0.5 * (d - r)) / d;
    x[u3] -= f * dx; x[u3 + 1] -= f * dy; x[u3 + 2] -= f * dz; x[v3] += f * dx; x[v3 + 1] += f * dy; x[v3 + 2] += f * dz;
  }
  /** The same with the two ends sharing the move by their lightness (heavy[v] = 1: v does not move at all). */
  function pullHeavy(u, v, r, w) {
    const lu = 1 - heavy[u], lv = 1 - heavy[v], sum = lu + lv;
    if (!(sum > 0)) return;
    const u3 = 3 * u, v3 = 3 * v, dx = x[u3] - x[v3], dy = x[u3 + 1] - x[v3 + 1], dz = x[u3 + 2] - x[v3 + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-12) return;
    const f = (w * (d - r)) / (d * sum), fu = f * lu, fv = f * lv;
    x[u3] -= fu * dx; x[u3 + 1] -= fu * dy; x[u3 + 2] -= fu * dz; x[v3] += fv * dx; x[v3 + 1] += fv * dy; x[v3 + 2] += fv * dz;
  }

  /** One sweep. tau < 1: the edges are held between their start chords and their rest lengths. */
  function sweep(tau, bend) {
    const E = mesh.nEdges, ed = mesh.edges, r = mesh.restLength, back = flip;
    flip = !flip;
    if (tau >= 1) for (let i = 0; i < E; i++) { const e = back ? E - 1 - i : i; pull(ed[2 * e], ed[2 * e + 1], r[e], 1); }
    else if (anyHeavy) for (let i = 0; i < E; i++) { const e = back ? E - 1 - i : i; pullHeavy(ed[2 * e], ed[2 * e + 1], start[e] + tau * (r[e] - start[e]), 1); }
    else for (let i = 0; i < E; i++) { const e = back ? E - 1 - i : i; pull(ed[2 * e], ed[2 * e + 1], start[e] + tau * (r[e] - start[e]), 1); }
    if (bend > 0) for (let i = 0; i < nH; i++) { const h = back ? nH - 1 - i : i; pull(hOpp[2 * h], hOpp[2 * h + 1], hRest[h], bend); }
    if (sealW > 0 || K.foldBend > 0) for (let i = 0; i < nSeal; i++) {
      const k = back ? nSeal - 1 - i : i, w = sW[k] ? K.foldBend : sealW;
      if (w > 0) pull(sA[k], sB[k], r[sE[2 * k]] + r[sE[2 * k + 1]], w);
    }
    if (rodOn) rods();
    sweepsDone++;
  }

  /**
   * The folded ring of a (2, 2) pair, left to the pulls of a cold start, buckles into waves. While the shape forms it
   * is put back, after every sweep, on the line through its middle along its two ends, each vertex at its own
   * distance along it (the crowns are folded flat on it there, and a flat fold is straight).
   */
  function rods() {
    const r = mesh.restLength;
    for (let si = 0; si < mesh.seals.length; si++) {
      const sl = mesh.seals[si];
      if (!mesh.degenerate[sl.pillow]) continue;
      const ch = sl.chain, H = ch.length - 1, ids = chainE[si];
      if (H < 2 || !ids || ids.some((e) => e === undefined)) continue;
      const a = 3 * ch[0], b = 3 * ch[H];
      let ux = x[b] - x[a], uy = x[b + 1] - x[a + 1], uz = x[b + 2] - x[a + 2];
      const len = Math.hypot(ux, uy, uz);
      if (!(len > 1e-9)) continue;
      ux /= len; uy /= len; uz /= len;
      let cx = 0, cy = 0, cz = 0, total = 0, mean = 0, at = 0;
      for (let k = 0; k <= H; k++) { const v = 3 * ch[k]; cx += x[v]; cy += x[v + 1]; cz += x[v + 2]; if (k) at += r[ids[k - 1]]; mean += at; }
      total = at; cx /= H + 1; cy /= H + 1; cz /= H + 1; mean /= H + 1;
      at = 0;
      for (let k = 0; k <= H; k++) {
        if (k) at += r[ids[k - 1]];
        const v = 3 * ch[k], t = at - mean;
        x[v] = cx + t * ux; x[v + 1] = cy + t * uy; x[v + 2] = cz + t * uz;
      }
      void total;
    }
  }

  function chords(out) {
    const E = mesh.nEdges, ed = mesh.edges;
    for (let e = 0; e < E; e++) {
      const u3 = 3 * ed[2 * e], v3 = 3 * ed[2 * e + 1];
      out[e] = Math.hypot(x[u3] - x[v3], x[u3 + 1] - x[v3 + 1], x[u3 + 2] - x[v3 + 2]);
    }
    return out;
  }

  /**
   * The start: pillow.js's positions (the open crowns, each seal vertex midway between its two crown points), with
   * each seal's chain drawn out to its own length. The midpoints' curve is much shorter than the seal (3333 at the
   * default: 1.25 against 1.76; a folded ring: the diameter L / pi against L / 2), and a chain that has to grow
   * between fixed neighbours buckles into a zigzag. So the chain is stretched along the line of its two cone points
   * until it has its rest length, and its vertices are spaced along it by their rest lengths.
   */
  function startInto(out) {
    out.set(mesh.positions);
    const r = mesh.restLength;
    mesh.seals.forEach((sl, si) => {
      const ch = sl.chain, H = ch.length - 1, ids = chainE[si];
      if (H < 2 || !ids || ids.some((e) => e === undefined)) return;
      let d = 0;
      for (const e of ids) d += r[e];
      const a = 3 * ch[0], b = 3 * ch[H];
      const u = [out[b] - out[a], out[b + 1] - out[a + 1], out[b + 2] - out[a + 2]], span = Math.hypot(u[0], u[1], u[2]);
      if (!(span > 1e-9)) return;
      u[0] /= span; u[1] /= span; u[2] /= span;
      const c = [(out[a] + out[b]) / 2, (out[a + 1] + out[b + 1]) / 2, (out[a + 2] + out[b + 2]) / 2];
      const q = new Float64Array(3 * (H + 1)), cum = new Float64Array(H + 1);
      const lay = (lam) => {
        let len = 0;
        for (let k = 0; k <= H; k++) {
          const v = 3 * ch[k], px = out[v] - c[0], py = out[v + 1] - c[1], pz = out[v + 2] - c[2], al = (lam - 1) * (px * u[0] + py * u[1] + pz * u[2]);
          q[3 * k] = c[0] + px + al * u[0]; q[3 * k + 1] = c[1] + py + al * u[1]; q[3 * k + 2] = c[2] + pz + al * u[2];
          if (k) { len += Math.hypot(q[3 * k] - q[3 * k - 3], q[3 * k + 1] - q[3 * k - 2], q[3 * k + 2] - q[3 * k - 1]); cum[k] = len; }
        }
        return len;
      };
      let lo = 1, hi = Math.max(1, d / span) + 1e-9;
      if (lay(1) < d) { for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (lay(mid) < d) lo = mid; else hi = mid; } }
      else hi = 1;
      const len = lay(hi);
      let seg = 1, sAt = 0;
      for (let k = 1; k < H; k++) {
        sAt += r[ids[k - 1]];
        const want = (sAt / d) * len;
        while (seg < H && cum[seg] < want) seg++;
        const t = cum[seg] > cum[seg - 1] ? (want - cum[seg - 1]) / (cum[seg] - cum[seg - 1]) : 0, v = 3 * ch[k];
        for (let x3 = 0; x3 < 3; x3++) out[v + x3] = q[3 * (seg - 1) + x3] + t * (q[3 * seg + x3] - q[3 * (seg - 1) + x3]);
      }
      for (let x3 = 0; x3 < 3; x3++) { out[a + x3] = q[x3]; out[b + x3] = q[3 * H + x3]; }
    });
    return out;
  }

  /** The mesh of a state with the start positions and no relaxation (then adoptPositions, or set). */
  function prepare(orders, L, tw) {
    build(orders, L, tw);
    startInto(x); guess.set(x);
    sweepsDone = 0; flip = false;
    return api;
  }

  function set(orders, L, tw) {
    const t0 = now();
    prepare(orders, L, tw);
    if (start.length !== mesh.nEdges) start = new Float64Array(mesh.nEdges);
    chords(start);
    // While the mouths close, a chain that was laid out at its own length is heavy: its neighbours come to it. (Pulled
    // on equal terms it gives way lengthwise and buckles into waves, which the rest of the run does not undo.)
    if (heavy.length !== n) heavy = new Float64Array(n); else heavy.fill(0);
    anyHeavy = false;
    for (const sl of mesh.seals) {
      const h = mesh.degenerate[sl.pillow] ? K.foldHeavy : K.sealHeavy;
      if (h > 0) { anyHeavy = true; for (const v of sl.chain) heavy[v] = Math.min(1, h); }
    }
    const S = Math.max(10, K.sweeps | 0), zip = Math.max(1, Math.round(K.zipShare * S));
    for (let i = 0; i < S; i++) {
      const tau = Math.min(1, (i + 1) / zip), late = Math.max(0, (i - zip) / Math.max(1, S - zip));
      rodOn = i < K.rodShare * S;
      sealW = i < K.sealShare * S ? K.sealBendCold : K.sealBend;
      sweep(tau, K.bend + (K.bendEnd - K.bend) * Math.min(1, late * 1.5));
    }
    rodOn = false; sealW = K.sealBend;
    lastMs = now() - t0;
    return api;
  }

  function update(L, tw, budgetMs = 4) {
    if (!mesh) throw new Error('solver: update before set');
    const t0 = now();
    if (L !== mesh.L || tw !== mesh.tw) {
      if (L !== mesh.L) build(mesh.orders, L, tw); else { P.setTwist(mesh, tw); hinges(); }
      // the crowns' own motion is the first guess: every vertex moves as its start point does
      if (scratch.length !== 3 * n) scratch = new Float64Array(3 * n);
      const g = startInto(scratch);
      for (let i = 0, n3 = 3 * n; i < n3; i++) { x[i] += g[i] - guess[i]; guess[i] = g[i]; }
    }
    let k = 0;
    do { sweep(1, K.bendEnd); k++; } while (k < K.warmMinSweeps || now() - t0 < budgetMs);
    lastMs = now() - t0;
    return api;
  }

  function settle(budgetMs = 30) {
    const t0 = now();
    do { sweep(1, K.bendEnd); } while (now() - t0 < budgetMs);
    lastMs = now() - t0;
    return api;
  }

  /** `count` more sweeps, no clock: for tests that want the same answer twice. */
  function relax(count = 100) {
    for (let i = 0; i < count; i++) sweep(1, K.bendEnd);
    return api;
  }

  function adoptPositions(positions) {
    if (positions.length !== 3 * n) throw new Error(`solver: adoptPositions wants ${3 * n} numbers`);
    x.set(positions);
    return api;
  }

  function stats() {
    const E = mesh.nEdges, ed = mesh.edges, r = mesh.restLength;
    let sum = 0, mx = 0;
    for (let e = 0; e < E; e++) {
      const u3 = 3 * ed[2 * e], v3 = 3 * ed[2 * e + 1];
      const s = Math.abs(Math.hypot(x[u3] - x[v3], x[u3 + 1] - x[v3 + 1], x[u3 + 2] - x[v3 + 2]) / r[e] - 1);
      sum += s; if (s > mx) mx = s;
    }
    return { strainMean: sum / E, strainMax: mx, sweeps: sweepsDone, ms: lastMs, vertices: n, method: 'baseline: position-based, seals closed by a homotopy of the rest lengths' };
  }

  const api = {
    set, update, settle, relax, prepare, adoptPositions, stats, knobs: K,
    get positions() { return x; },
    get mesh() { return mesh; },
    result() { return { ...P.toResult(mesh, x), method: 'baseline PBD', ms: lastMs, iterations: sweepsDone }; },
  };
  return api;
}
