// glue.mjs — the delayed glue: SymSim's fundamental domain with a history buffer.
//
// A port of the experiment scripts `delayed-glue/dde.py` and `delayed-glue/reduced.py`
// (Glue, History, ReducedRHS, run_reduced) to plain ES modules.  Everything numerical is
// the repository's own arithmetic: the six-neighbour triangular Laplacian with the factor
// 2/(3h²), the Brusselator right-hand side, and classical RK4 — the same lines that
// ../newton/core.mjs already ports from `rdlab.py`.  `selfTest()` below checks the reduced
// right-hand side against core.mjs's full-torus one node by node.
//
// The idea in one line.  The catalog convention q(Mx + v, t + τ_g T) = q(x, t) read
// node-wise is  q(y, t) = q(g⁻¹y, t − τ_g T):  the neighbour across a glued edge is the
// representative's own past.  So the PDE on the fundamental domain becomes a
// delay-differential equation whose only extra parameter is the period T — the delay.

import { G227, makeCharacter, tauOf, hopfEigen } from '../newton/core.mjs';

export { G227 };
export const PUBLISHED_PERIOD = 6.390159918584649;

// ---------------------------------------------------------------- the glue

/** Orbit representatives and the copy map (source representative, delay k·T/m) for
 *  every other node of the N×N mesh.
 *
 *  Representative choice.  `dde.py` labels each orbit by its smallest flat index, which is
 *  correct but draws as a disconnected scatter.  Here the representative is the orbit
 *  member closest — in the L∞ sense on wrapped lattice coordinates — to the centre
 *  (1/6, 1/6) of the rhombus [0,1/3)×[0,1/3).  That rhombus is the classical p3
 *  fundamental domain: its four corners are the cone points 3, 3₂, 3₁, 3₂.  The set is
 *  connected, it has the same 146 members, and the physics is untouched (a different
 *  spanning choice of the same relations).
 */
export function buildGlue(entry, N) {
  const ch = makeCharacter(entry, N);
  const m = entry.phaseOrder;
  const n = N * N;
  const maps = ch.maps;
  const taus = ch.taus;

  // --- representatives
  const wrapDiff = d => { let w = d - Math.floor(d); return w > 0.5 ? w - 1 : w; };
  const score = new Float64Array(n);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const du = wrapDiff(i / N - 1 / 6), dv = wrapDiff(j / N - 1 / 6);
      score[j * N + i] = Math.max(Math.abs(du), Math.abs(dv));
    }
  }
  const labels = new Int32Array(n);
  for (let p = 0; p < n; p++) {
    let best = -1, bestScore = Infinity;
    for (const map of maps) {
      const q = map[p], s = score[q];
      if (s < bestScore - 1e-12 || (Math.abs(s - bestScore) <= 1e-12 && (best < 0 || q < best))) {
        bestScore = Math.min(bestScore, s); best = q;
      }
    }
    labels[p] = best;
  }
  const repSet = [...new Set(labels)].sort((a, b) => a - b);
  const reps = Int32Array.from(repSet);
  const nRep = reps.length;
  const repPos = new Int32Array(n).fill(-1);
  reps.forEach((p, k) => { repPos[p] = k; });

  // --- one copy rule per non-representative node, smallest delay preferred
  const assigned = new Uint8Array(n);
  for (const p of reps) assigned[p] = 1;
  const copySrc = new Int32Array(n).fill(-1);
  const copyK = new Int32Array(n).fill(-1);
  const order = maps.map((_, g) => g)
    .sort((x, y) => (Math.round(taus[x] * m) % m) - (Math.round(taus[y] * m) % m));
  for (const g of order) {
    const k = ((Math.round(taus[g] * m) % m) + m) % m;
    for (const r of reps) {
      const tgt = maps[g][r];
      if (!assigned[tgt]) { copySrc[tgt] = r; copyK[tgt] = k; assigned[tgt] = 1; }
    }
  }
  for (let p = 0; p < n; p++) if (!assigned[p]) throw new Error('node unreachable from a representative');

  const instTgtArr = [], instSrcArr = [];
  const delayedTgt = [], delayedSrc = [];
  for (let k = 1; k < m; k++) { delayedTgt.push([]); delayedSrc.push([]); }
  for (let p = 0; p < n; p++) {
    if (repPos[p] >= 0) continue;
    if (copyK[p] === 0) { instTgtArr.push(p); instSrcArr.push(copySrc[p]); }
    else { delayedTgt[copyK[p] - 1].push(p); delayedSrc[copyK[p] - 1].push(repPos[copySrc[p]]); }
  }

  return {
    entry, N, n, m, ch, maps, taus, reps, nRep, repPos, labels, copySrc, copyK,
    instTgt: Int32Array.from(instTgtArr), instSrc: Int32Array.from(instSrcArr),
    delayed: delayedTgt.map((t, i) => ({ k: i + 1, tgt: Int32Array.from(t), srcPos: Int32Array.from(delayedSrc[i]) })),
    summary() {
      return {
        nodes: n, representatives: nRep, reductionFactor: n / nRep,
        instantaneousCopies: this.instTgt.length,
        delayedCopies: this.delayed.map(d => d.tgt.length),
        delays: this.delayed.map(d => `${d.k}T/${m}`),
      };
    },
  };
}

// ---------------------------------------------------------------- the history buffer

/** Absolute-time ring of representative vectors, sampled by 4-point Lagrange
 *  interpolation — RK4's midpoint stages ask for the delayed field at half steps, which
 *  never land on the step grid.  (`dde.History`, same interpolation, same trimming rule.) */
export class History {
  constructor(span, size) {
    this.span = span; this.size = size;
    this.times = []; this.vals = []; this.pool = []; this.samples = 0;
  }
  _take() { return this.pool.pop() || new Float64Array(this.size); }
  push(t, v) {
    const last = this.times.length - 1;
    if (last >= 0 && t <= this.times[last] + 1e-12 * Math.max(1, Math.abs(t))) {
      this.times[last] = t; this.vals[last].set(v); return;
    }
    const buf = this._take(); buf.set(v);
    this.times.push(t); this.vals.push(buf);
    if (this.times.length > 64 && this.times[0] < t - this.span) {
      const cut = this._lower(t - this.span) - 4;
      if (cut > 0) {
        for (let i = 0; i < cut; i++) this.pool.push(this.vals[i]);
        this.times.splice(0, cut); this.vals.splice(0, cut);
      }
    }
  }
  _lower(t) {                       // first index with times[i] >= t
    let lo = 0, hi = this.times.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.times[mid] < t) lo = mid + 1; else hi = mid; }
    return lo;
  }
  prefill(func, t0, dt) {
    const steps = Math.ceil(this.span / dt) + 4;
    for (let i = steps; i >= 0; i--) this.push(t0 - i * dt, func(t0 - i * dt));
  }
  sample(t, out) {
    this.samples++;
    const times = this.times, vals = this.vals, L = times.length;
    if (t <= times[0]) { out.set(vals[0]); return out; }
    if (t >= times[L - 1]) { out.set(vals[L - 1]); return out; }
    const j = this._lower(t);
    if (times[j] === t) { out.set(vals[j]); return out; }
    const i0 = Math.min(Math.max(j - 2, 0), L - 4);
    const ts = [times[i0], times[i0 + 1], times[i0 + 2], times[i0 + 3]];
    const w = new Float64Array(4);
    for (let a = 0; a < 4; a++) {
      let num = 1, den = 1;
      for (let b = 0; b < 4; b++) if (a !== b) { num *= (t - ts[b]); den *= (ts[a] - ts[b]); }
      w[a] = num / den;
    }
    const v0 = vals[i0], v1 = vals[i0 + 1], v2 = vals[i0 + 2], v3 = vals[i0 + 3];
    for (let i = 0; i < out.length; i++) out[i] = w[0] * v0[i] + w[1] * v1[i] + w[2] * v2[i] + w[3] * v3[i];
    return out;
  }
}

// ---------------------------------------------------------------- the reduced right-hand side

const OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, -1]];

/** Brusselator on the representatives only: one RK4 stage touches 146 nodes per channel
 *  instead of 1296, and the six stencil neighbours are gathered through the glue — two
 *  reads of the history buffer per stage.  (`reduced.py: ReducedRHS`.) */
export function makeReducedRhs(glue, p) {
  const { N, n, m, nRep, reps, repPos, copySrc, copyK } = glue;
  const srcPosOfNode = new Int32Array(n);
  const kOfNode = new Int32Array(n);
  for (let q = 0; q < n; q++) {
    if (repPos[q] >= 0) { srcPosOfNode[q] = repPos[q]; kOfNode[q] = 0; }
    else { srcPosOfNode[q] = repPos[copySrc[q]]; kOfNode[q] = copyK[q]; }
  }
  const gather = [];
  for (const [dx, dy] of OFFSETS) {
    const buckets = []; for (let k = 0; k < m; k++) buckets.push({ tgt: [], src: [] });
    for (let r = 0; r < nRep; r++) {
      const node = reps[r], i = node % N, j = (node / N) | 0;
      const nbNode = (((j + dy) % N + N) % N) * N + (((i + dx) % N + N) % N);
      const k = kOfNode[nbNode];
      buckets[k].tgt.push(r); buckets[k].src.push(srcPosOfNode[nbNode]);
    }
    buckets.forEach((bk, k) => {
      if (bk.tgt.length) gather.push({ k, tgt: Int32Array.from(bk.tgt), src: Int32Array.from(bk.src) });
    });
  }

  const c = 2 / (3 * p.h * p.h);
  const { a, b, Du, Dv } = p; const b1 = b + 1;
  const past = []; for (let k = 0; k < m; k++) past.push(new Float64Array(2 * nRep));
  const s = new Float64Array(2 * nRep);
  const counters = { rhsCalls: 0, nodeEvals: 0 };

  function rhs(x, t, hist, T, out) {
    counters.rhsCalls++; counters.nodeEvals += nRep;
    for (let k = 1; k < m; k++) hist.sample(t - k * T / m, past[k]);
    s.fill(0);
    for (const g of gather) {
      const src = g.k === 0 ? x : past[g.k];
      const tgt = g.tgt, sp = g.src, len = tgt.length;
      for (let q = 0; q < len; q++) {
        s[tgt[q]] += src[sp[q]];
        s[nRep + tgt[q]] += src[nRep + sp[q]];
      }
    }
    for (let i = 0; i < nRep; i++) {
      const u = x[i], v = x[nRep + i];
      const lu = c * (s[i] - 6 * u), lv = c * (s[nRep + i] - 6 * v);
      const r = u * u * v;
      out[i] = Du * lu + a - b1 * u + r;
      out[nRep + i] = Dv * lv + b * u - r;
    }
    return out;
  }
  rhs.counters = counters;
  rhs.gather = gather;
  return rhs;
}

/** Rebuild the whole N×N torus field (layout of core.mjs: u then v, node = y*N + x)
 *  from the representative vector plus the history.  (`reduced.py: ReducedRHS.expand`.) */
export function makeExpander(glue) {
  const { n, m, nRep, reps, instTgt, instSrc, repPos, delayed } = glue;
  const buf = new Float64Array(2 * nRep);
  return function expand(x, t, hist, T, out = new Float64Array(2 * n)) {
    for (let r = 0; r < nRep; r++) { out[reps[r]] = x[r]; out[n + reps[r]] = x[nRep + r]; }
    for (let i = 0; i < instTgt.length; i++) {
      const pos = repPos[instSrc[i]];
      out[instTgt[i]] = x[pos]; out[n + instTgt[i]] = x[nRep + pos];
    }
    for (const d of delayed) {
      hist.sample(t - d.k * T / m, buf);
      for (let i = 0; i < d.tgt.length; i++) {
        out[d.tgt[i]] = buf[d.srcPos[i]];
        out[n + d.tgt[i]] = buf[nRep + d.srcPos[i]];
      }
    }
    return out;
  };
}

// ---------------------------------------------------------------- seeded noise

/** mulberry32 + Box–Muller: the same white noise every time the button is pressed. */
export function seededNoise(seed, count) {
  let s = (seed >>> 0) + 0x6d2b79f5;
  const rand = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = new Float64Array(count);
  for (let i = 0; i < count; i += 2) {
    const u1 = Math.max(rand(), 1e-12), u2 = rand();
    const r = Math.sqrt(-2 * Math.log(u1)), th = 2 * Math.PI * u2;
    out[i] = r * Math.cos(th);
    if (i + 1 < count) out[i + 1] = r * Math.sin(th);
  }
  let ss = 0; for (let i = 0; i < count; i++) ss += out[i] * out[i];
  const rms = Math.sqrt(ss / count) || 1;
  for (let i = 0; i < count; i++) out[i] /= rms;
  return out;
}

// ---------------------------------------------------------------- the run

export const GLUE_DEFAULTS = {
  N: 36, L: 40, a: 1, b: 2.3, Du: 1, Dv: 1,
  stepsPerThird: 112,       // dt = T/336, so T/3 is an exact number of steps
  relax: 1.0,               // dde.py's default. 2.5 (= 1/(1 − 0.6), the outer map's measured
                            // gain) is offered as an option but is unstable here: see README

  adaptEvery: 1,            // update the delay once per period
  adaptAfter: 1,
  noiseAmplitude: 0.10,
  seed: 1,
  tol: 1e-5,                // stop when the delay stops moving
  minPeriods: 10,
  maxPeriods: 90,
  spanFactor: 1.30,
};

/** A resumable delayed-glue run.  `advance(k)` takes k RK4 steps and returns; the page
 *  calls it a few hundred steps at a time so the canvas keeps painting. */
export function createRun(options = {}) {
  const o = { ...GLUE_DEFAULTS, ...options };
  const entry = G227;
  const glue = buildGlue(entry, o.N);
  const p = { a: o.a, b: o.b, Du: o.Du, Dv: o.Dv, h: o.L / o.N };
  const rhs = makeReducedRhs(glue, p);
  const expand = makeExpander(glue);
  const m = glue.m, nRep = glue.nRep, dim = 2 * nRep;

  const T0 = hopfEigen(p, 0).period;            // 2π/Im λ at k = 0 — the only guess we have
  let T = T0;
  let dt = T / (m * o.stepsPerThird);

  // white noise about the uniform equilibrium q* = (a, b/a)
  const noise = seededNoise(o.seed, dim);
  const x = new Float64Array(dim);
  for (let i = 0; i < nRep; i++) {
    x[i] = o.a + o.noiseAmplitude * noise[i];
    x[nRep + i] = o.b / o.a + o.noiseAmplitude * noise[nRep + i];
  }
  const x0 = Float64Array.from(x);

  const hist = new History(o.spanFactor * T, dim);
  hist.prefill(() => x0, 0, dt);                 // frozen history for t ≤ 0
  hist.push(0, x);

  const k1 = new Float64Array(dim), k2 = new Float64Array(dim), k3 = new Float64Array(dim),
    k4 = new Float64Array(dim), tmp = new Float64Array(dim), dq = new Float64Array(dim),
    prev = new Float64Array(dim);

  let t = 0, steps = 0, stopReason = null, done = false;
  let nextAdapt = o.adaptAfter * T, settled = 0, lastDeltaT = NaN;
  const delays = [{ t: 0, T, periods: 0 }];
  const drift = [];

  function measure() {                            // the phase-shift feedback of dde.py
    rhs(x, t, hist, T, dq);
    hist.sample(t - T, prev);
    let nn = 0, num = 0, dd = 0;
    for (let i = 0; i < dim; i++) {
      const d = prev[i] - x[i];
      nn += dq[i] * dq[i]; num += d * dq[i]; dd += d * d;
    }
    const shift = nn > 0 ? num / nn : 0;
    return { shift, driftRms: Math.sqrt(dd / dim), periodEstimate: T + shift };
  }

  function advance(nSteps) {
    for (let s = 0; s < nSteps && !done; s++) {
      rhs(x, t, hist, T, k1);
      for (let i = 0; i < dim; i++) tmp[i] = x[i] + 0.5 * dt * k1[i];
      rhs(tmp, t + 0.5 * dt, hist, T, k2);
      for (let i = 0; i < dim; i++) tmp[i] = x[i] + 0.5 * dt * k2[i];
      rhs(tmp, t + 0.5 * dt, hist, T, k3);
      for (let i = 0; i < dim; i++) tmp[i] = x[i] + dt * k3[i];
      rhs(tmp, t + dt, hist, T, k4);
      for (let i = 0; i < dim; i++) x[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      t += dt; steps++;
      hist.push(t, x);
      if (!Number.isFinite(x[0])) { done = true; stopReason = 'blew up'; break; }

      if (t >= nextAdapt - 1e-12) {
        nextAdapt += o.adaptEvery * T;
        const mrec = measure();
        const Told = T;
        T = Math.min(Math.max(T + o.relax * mrec.shift, 0.5 * T0), 2 * T0);
        dt = T / (m * o.stepsPerThird);
        hist.span = o.spanFactor * T;
        lastDeltaT = Math.abs(T - Told);
        const periods = delays.length;
        delays.push({ t, T, previous: Told, deltaT: lastDeltaT, measured: mrec.periodEstimate, periods });
        drift.push({ t, periods, driftRms: mrec.driftRms, T });
        if (lastDeltaT < o.tol) settled++; else settled = 0;
        if (settled >= 2 && periods >= o.minPeriods) { done = true; stopReason = 'period found'; }
        if (periods >= o.maxPeriods) { done = true; stopReason = 'period budget spent'; }
      }
    }
    return { t, T, steps, done, stopReason };
  }

  return {
    glue, rhs, p, T0, dim, options: o,
    get t() { return t; }, get T() { return T; }, get dt() { return dt; },
    get steps() { return steps; }, get done() { return done; },
    get stopReason() { return stopReason; }, get lastDeltaT() { return lastDeltaT; },
    get periods() { return delays.length - 1; },
    delays, drift, history: hist, state: () => x,
    counters: rhs.counters,
    measure,
    field(out) { return expand(x, t, hist, T, out); },
    fieldAt(tt, xx, out) { return expand(xx, tt, hist, T, out); },
    advance,
  };
}

// ---------------------------------------------------------------- self-test

/** The reduced right-hand side must agree, node by node, with core.mjs's full-torus one
 *  applied to the expanded field.  Any error in the glue tables shows up here. */
export async function selfTest(N = 36) {
  const { makeMesh, makeRhs } = await import('../newton/core.mjs');
  const glue = buildGlue(G227, N);
  const p = { a: 1, b: 2.3, Du: 1, Dv: 1, h: 40 / N };
  const rhs = makeReducedRhs(glue, p);
  const expand = makeExpander(glue);
  const mesh = makeMesh(N), fullRhs = makeRhs(mesh, p);
  const dim = 2 * glue.nRep, n = glue.n;
  const noise = seededNoise(7, dim);
  const x = new Float64Array(dim);
  for (let i = 0; i < glue.nRep; i++) { x[i] = 1 + 0.2 * noise[i]; x[glue.nRep + i] = 2.3 + 0.2 * noise[glue.nRep + i]; }
  const hist = new History(9, dim);
  const T = PUBLISHED_PERIOD, dt = T / 336;
  // a genuinely time-dependent history, so the delayed reads are exercised
  const tmp = new Float64Array(dim);
  hist.prefill(tt => { for (let i = 0; i < dim; i++) tmp[i] = x[i] * (1 + 0.15 * Math.sin(tt + i)); return tmp; }, 0, dt);
  hist.push(0, x);
  const full = expand(x, 0, hist, T);
  const outFull = new Float64Array(2 * n);
  fullRhs(full, outFull);
  const outRed = rhs(x, 0, hist, T, new Float64Array(dim));
  let worst = 0;
  for (let r = 0; r < glue.nRep; r++) {
    worst = Math.max(worst, Math.abs(outRed[r] - outFull[glue.reps[r]]));
    worst = Math.max(worst, Math.abs(outRed[glue.nRep + r] - outFull[n + glue.reps[r]]));
  }
  return { maxDifference: worst, representatives: glue.nRep, nodes: n, summary: glue.summary() };
}
