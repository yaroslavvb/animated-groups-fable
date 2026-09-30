// core.mjs — the whole clockwork search, in plain JavaScript.
//
// This is a line-by-line port of the repository's own numerics
//   docs/scott-gray/research/equations/rdlab.py
// for one case: the g227 Brusselator oscillatory spiral lattice
//   a = 1, b = 2.3, Du = Dv = 1, triangular six-neighbour Laplacian, L = 40, N = 36.
//
// Convention (the site's, unchanged):  q(M x + v, t + tau*T) = q(x, t),
// with x in lattice coordinates.  A field is a Float64Array of length 2*N*N:
// channel u first, then channel v, each row-major with x fastest, so node (i, j)
// sits at lattice coordinates (i/N, j/N) — the same layout as the site's Float32
// payloads.
//
// Nothing here is re-derived: every formula is the repository's.

// ---------------------------------------------------------------- the group entry
// docs/scott-gray/wallpaper-groups.json, entry g227 (family p3, orbifold 333,
// clockwork symbol r33₁3₂).  The translation parts are thirds, written as exact
// integer numerators so that v*N is integral for every N divisible by 3.
//
// tau is the time offset as a fraction of the period.  Read each row as
//   q(M x + v, t + tau T) = q(x, t).
export const G227 = {
  id: 'g227',
  family: 'p3',
  orbifold: '333',
  symbol: 'r33₁1₁2',       // r33₁3₂ (rendered properly in the page)
  lattice: 'triangular',
  phaseOrder: 3,
  meshMultiple: 3,
  frameMultiple: 3,
  // basis rows a1, a2 in Cartesian (unit 120-degree basis)
  basis: [[1, 0], [-0.5, Math.sqrt(3) / 2]],
  // ops: M (integer 2x2, acting on lattice coordinates), v = [v0/3, v1/3], tau = tau3/3
  ops: [
    { M: [[-1, 1], [-1, 0]], v3: [0, 0], tau3: 0 },
    { M: [[-1, 1], [-1, 0]], v3: [1, 2], tau3: 2 },
    { M: [[-1, 1], [-1, 0]], v3: [2, 1], tau3: 1 },
    { M: [[0, -1], [1, -1]], v3: [0, 0], tau3: 0 },
    { M: [[0, -1], [1, -1]], v3: [1, 2], tau3: 2 },
    { M: [[0, -1], [1, -1]], v3: [2, 1], tau3: 1 },
    { M: [[1, 0], [0, 1]], v3: [0, 0], tau3: 0 },
    { M: [[1, 0], [0, 1]], v3: [1, 2], tau3: 2 },
    { M: [[1, 0], [0, 1]], v3: [2, 1], tau3: 1 },
  ],
};
export const tauOf = op => op.tau3 / 3;

// The published record this page is trying to rediscover:
// docs/scott-gray/data/equation-orbits/g227-brusselator-e47c12f9099fb9d2b6d4.json
export const PUBLISHED_PERIOD = 6.390159918584649;
export const DEFAULTS = { a: 1, b: 2.3, Du: 1, Dv: 1, L: 40, N: 36, M: 48 };

// ---------------------------------------------------------------- the mesh
/** Neighbour tables for the periodic N x N mesh.
 *  rdlab's triangular stencil uses the six neighbours
 *    (x±1, y), (x, y±1), (x+1, y+1), (x-1, y-1)      [array[y, x]]
 *  which are the six nearest sites of the 120-degree lattice. */
export function makeMesh(N) {
  const n = N * N;
  const nb = new Int32Array(6 * n);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const p = y * N + x;
      const xm = (x + N - 1) % N, xp = (x + 1) % N;
      const ym = (y + N - 1) % N, yp = (y + 1) % N;
      nb[6 * p + 0] = y * N + xm;
      nb[6 * p + 1] = y * N + xp;
      nb[6 * p + 2] = ym * N + x;
      nb[6 * p + 3] = yp * N + x;
      nb[6 * p + 4] = yp * N + xp;
      nb[6 * p + 5] = ym * N + xm;
    }
  }
  return { N, n, nb };
}

// ---------------------------------------------------------------- the model
/** Brusselator right-hand side (rdlab.rhs_brusselator):
 *    u_t = Du lap u + a - (b+1) u + u^2 v
 *    v_t = Dv lap v + b u - u^2 v
 *  The triangular Laplacian carries the factor 2/(3 h^2). */
export function makeRhs(mesh, p) {
  const { n, nb } = mesh;
  const c = 2 / (3 * p.h * p.h);
  const { a, b, Du, Dv } = p;
  const b1 = b + 1;
  return function rhs(q, out) {
    for (let i = 0; i < n; i++) {
      const o = 6 * i;
      const n0 = nb[o], n1 = nb[o + 1], n2 = nb[o + 2], n3 = nb[o + 3], n4 = nb[o + 4], n5 = nb[o + 5];
      const u = q[i], v = q[n + i];
      const lu = c * (q[n0] + q[n1] + q[n2] + q[n3] + q[n4] + q[n5] - 6 * u);
      const lv = c * (q[n + n0] + q[n + n1] + q[n + n2] + q[n + n3] + q[n + n4] + q[n + n5] - 6 * v);
      const r = u * u * v;
      out[i] = Du * lu + a - b1 * u + r;
      out[n + i] = Dv * lv + b * u - r;
    }
    return out;
  };
}

/** rdlab.timestep for the Brusselator: min(dtmax = 0.02, 0.15 h^2 / max(Du, Dv)).
 *  At N = 36, L = 40 this is 0.02 — an accuracy cap, well inside RK4 stability. */
export function timestep(p, dt = null) {
  const bound = Math.min(0.02, 0.15 * p.h * p.h / Math.max(p.Du, p.Dv));
  return dt ? Math.min(dt, bound) : bound;
}

/** Cost counters, so the page can report work the same way the Python lab does. */
export const counters = { rhsCalls: 0, rk4Steps: 0, flowCalls: 0, flowTime: 0 };
export const resetCounters = () => { counters.rhsCalls = 0; counters.rk4Steps = 0; counters.flowCalls = 0; counters.flowTime = 0; };

/** RK4 for time T with no projection — rdlab.flow, including its step-count rule
 *  steps = ceil(T / timestep).  Scratch arrays are reused between calls. */
export function makeFlow(mesh, p) {
  const rhs = makeRhs(mesh, p);
  const m = 2 * mesh.n;
  const k1 = new Float64Array(m), k2 = new Float64Array(m), k3 = new Float64Array(m), k4 = new Float64Array(m), tmp = new Float64Array(m);
  return function flow(q0, T, out = new Float64Array(m), { dt = null, steps = null } = {}) {
    const t0 = performance.now();
    const q = out;
    if (q !== q0) q.set(q0);
    const nsteps = steps ?? Math.max(1, Math.ceil(T / timestep(p, dt)));
    const k = T / nsteps;
    for (let s = 0; s < nsteps; s++) {
      rhs(q, k1);
      for (let i = 0; i < m; i++) tmp[i] = q[i] + 0.5 * k * k1[i];
      rhs(tmp, k2);
      for (let i = 0; i < m; i++) tmp[i] = q[i] + 0.5 * k * k2[i];
      rhs(tmp, k3);
      for (let i = 0; i < m; i++) tmp[i] = q[i] + k * k3[i];
      rhs(tmp, k4);
      for (let i = 0; i < m; i++) q[i] += k * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6;
    }
    counters.rhsCalls += 4 * nsteps;
    counters.rk4Steps += nsteps;
    counters.flowCalls += 1;
    counters.flowTime += performance.now() - t0;
    return q;
  };
}

/** One independent RK4 period from q0, saved as M frames (frame f at time f*T/M) —
 *  exactly what the repository's exporter writes into the site's Float32 payloads. */
export function movieFromState(flow, q0, T, M, m) {
  const frames = [];
  let state = Float64Array.from(q0);
  for (let f = 0; f < M; f++) {
    frames.push(Float64Array.from(state));
    state = flow(state, T / M, new Float64Array(m));
  }
  return frames;
}

// ---------------------------------------------------------------- the group action
/** rdlab.mapping: the flat gather index with (S q)(y, x) = q(M x + v).
 *  Index (y, x) of the result reads the source at
 *    x' = M00 x + M01 y + v0,   y' = M10 x + M11 y + v1   (mod N). */
export function opMapping(op, N) {
  const A = op.M, n = N * N;
  const v0 = op.v3[0] * N / 3, v1 = op.v3[1] * N / 3;
  if (Math.abs(v0 - Math.round(v0)) > 1e-7 || Math.abs(v1 - Math.round(v1)) > 1e-7) {
    throw new Error('Operation does not preserve this mesh');
  }
  const map = new Int32Array(n);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const xs = (((A[0][0] * x + A[0][1] * y + v0) % N) + N) % N;
      const ys = (((A[1][0] * x + A[1][1] * y + v1) % N) + N) % N;
      map[y * N + x] = ys * N + xs;
    }
  }
  return map;
}

/** The g227 machinery on an N-mesh: every operation's permutation, the kernel
 *  (tau = 0) subgroup, the primitive generator (tau = 1/3) and the kernel orbit
 *  reduction that the repository's shooting code uses. */
export function makeCharacter(entry, N) {
  if (N % entry.meshMultiple) throw new Error('mesh incompatible with this group');
  const maps = entry.ops.map(op => opMapping(op, N));
  const taus = entry.ops.map(tauOf);
  const kernel = maps.filter((_, i) => taus[i] === 0);
  const order = entry.phaseOrder;
  const generator = taus.findIndex(t => Math.abs(t - 1 / order) < 1e-9);
  const n = N * N;

  // kernel orbit reduction (wallpaper/search.py): label each node by the smallest
  // index in its kernel orbit, then number the distinct labels.
  const labels = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let lo = i;
    for (const m of kernel) if (m[i] < lo) lo = m[i];
    labels[i] = lo;
  }
  const seen = new Map();
  const expand = new Int32Array(n);
  const reps = [];
  const sorted = [...new Set(labels)].sort((a, b) => a - b);
  sorted.forEach((label, k) => seen.set(label, k));
  for (let i = 0; i < n; i++) expand[i] = seen.get(labels[i]);
  sorted.forEach(label => reps.push(label));

  return {
    N, n, maps, taus, kernel, order, generator,
    generatorMap: maps[generator],
    reduction: { reps: Int32Array.from(reps), expand, count: reps.length },
  };
}

/** out(p) = q(map(p)) for both channels — an exact index permutation. */
export function applyMap(q, map, n, out = new Float64Array(2 * n)) {
  for (let i = 0; i < n; i++) { out[i] = q[map[i]]; out[n + i] = q[n + map[i]]; }
  return out;
}

/** Average over the tau = 0 operations: the orthogonal projector onto fields
 *  invariant under the kernel (rdlab.Character.project_kernel). */
export function projectKernel(ch, q, out = new Float64Array(q.length)) {
  const { n, kernel } = ch, k = kernel.length;
  out.fill(0);
  for (const map of kernel) {
    for (let i = 0; i < n; i++) { out[i] += q[map[i]]; out[n + i] += q[n + map[i]]; }
  }
  for (let i = 0; i < out.length; i++) out[i] /= k;
  return out;
}

/** Average a movie over the group's whole space-time action, so that
 *  q(gx, t + tau T) = q(x, t) holds to round-off (rdlab.space_time_project).
 *  An already-symmetric movie is unchanged except in the last bits — the repository's
 *  exporter does this before float32 encoding, and without it float32 rounding alone
 *  pushes the symmetry error above the atlas limit of 2e-7. */
export function spaceTimeProject(frames, ch, M) {
  const { n, maps, taus } = ch, m = 2 * n;
  const out = frames.map(() => new Float64Array(m));
  for (let o = 0; o < maps.length; o++) {
    const shift = Math.round(taus[o] * M), map = maps[o];
    for (let f = 0; f < M; f++) {
      const src = frames[(f + shift) % M], dst = out[f];
      for (let i = 0; i < n; i++) { dst[i] += src[map[i]]; dst[n + i] += src[n + map[i]]; }
    }
  }
  for (const f of out) for (let i = 0; i < m; i++) f[i] /= maps.length;
  return out;
}

/** max |q(gx, t + tau T) - q(x, t)| over all nine operations, for a movie
 *  frames[f] (each a 2*n field, frame f at time f*T/M). */
export function symmetryError(frames, ch, M) {
  const { n, maps, taus } = ch;
  let worst = 0;
  for (let o = 0; o < maps.length; o++) {
    const shift = Math.round(taus[o] * M), map = maps[o];
    for (let f = 0; f < M; f++) {
      const A = frames[(f + shift) % M], B = frames[f];
      for (let i = 0; i < 2 * n; i++) {
        const j = i < n ? map[i] : n + map[i - n];
        const d = Math.abs(A[j] - B[i]);
        if (d > worst) worst = d;
      }
    }
  }
  return worst;
}

// ---------------------------------------------------------------- rotation centres
/** Every rotation-centre class in one simulation cell, with its time offset.
 *  For an op with rotation part M and translation v, the fixed point solves
 *  (I - M) x* = v + l for each lattice translation l; centres are deduped modulo
 *  the lattice.  The primitive generator at a centre is the op whose Cartesian
 *  rotation is +360/n degrees; its offset k/n then predicts the winding of the
 *  first temporal harmonic there: w = -k (mod n). */
export function rotationCentres(entry, range = 1) {
  const basis = entry.basis;
  const toCart = ([u, v]) => [u * basis[0][0] + v * basis[1][0], u * basis[0][1] + v * basis[1][1]];
  const found = [];
  const key = ([u, v]) => `${Math.round(((u % 1) + 1) % 1 * 3)}|${Math.round(((v % 1) + 1) % 1 * 3)}`;
  const byKey = new Map();
  for (let oi = 0; oi < entry.ops.length; oi++) {
    const op = entry.ops[oi];
    const A = op.M;
    const trace = A[0][0] + A[1][1], det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    if (det !== 1) continue;                 // rotations only (no mirrors in p3 anyway)
    if (trace === 2) continue;               // the identity has no isolated centre
    const order = trace === -1 ? 3 : trace === 0 ? 4 : trace === 1 ? 6 : 2;
    // (I - M)^{-1}
    const a = 1 - A[0][0], b = -A[0][1], c = -A[1][0], d = 1 - A[1][1];
    const det2 = a * d - b * c;
    for (let li = -range; li <= range; li++) {
      for (let lj = -range; lj <= range; lj++) {
        const r0 = op.v3[0] / 3 + li, r1 = op.v3[1] / 3 + lj;
        const u = (d * r0 - b * r1) / det2, v = (-c * r0 + a * r1) / det2;
        const uu = ((u % 1) + 1) % 1, vv = ((v % 1) + 1) % 1;
        const k = key([uu, vv]);
        // the Cartesian turn of M: +120 degrees is the primitive generator here
        const e1 = toCart([A[0][0], A[1][0]]);
        const angle = Math.atan2(e1[1], e1[0]) * 180 / Math.PI;
        const positive = Math.abs(((angle % 360) + 360) % 360 - 360 / order) < 1e-6;
        const entryRow = byKey.get(k);
        if (!entryRow) {
          const row = { lattice: [uu, vv], cartesian: toCart([uu, vv]), order, tau: null, k: null, ops: [oi] };
          byKey.set(k, row); found.push(row);
          if (positive) { row.tau = tauOf(op); row.k = ((Math.round(tauOf(op) * order)) % order + order) % order; }
        } else {
          entryRow.ops.push(oi);
          if (positive && entryRow.k === null) { entryRow.tau = tauOf(op); entryRow.k = ((Math.round(tauOf(op) * order)) % order + order) % order; }
        }
      }
    }
  }
  for (const row of found) {
    // w = -k (mod n), folded into the symmetric range
    let w = ((-row.k) % row.order + row.order) % row.order;
    if (w > row.order / 2) w -= row.order;
    row.predictedWinding = w;
  }
  return found;
}

// ---------------------------------------------------------------- the seed
/** Exact eigenvalue (<= 0) of the repository stencil for exp(2 pi i (a i + b j)/N). */
export function laplacianEigenvalue(wave, N, L) {
  const [a, b] = wave, h = L / N;
  return 2 / (3 * h * h) * (2 * Math.cos(2 * Math.PI * a / N) + 2 * Math.cos(2 * Math.PI * b / N)
    + 2 * Math.cos(2 * Math.PI * (a + b) / N) - 6);
}

/** The twisted plane-wave star
 *    psi = (1/|G|) sum_g exp(2 pi i h tau_g) (plane wave o g),
 *  which satisfies psi(g x) = exp(-2 pi i h tau_g) psi(x): the law the h-th
 *  temporal Fourier coefficient of a clockwork orbit must obey.
 *  Returns {re, im} as Float64Arrays of length N*N. */
export function characterStar(ch, wave, N, harmonic = 1) {
  const n = N * N;
  const [a, b] = wave;
  const baseRe = new Float64Array(n), baseIm = new Float64Array(n);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const phase = 2 * Math.PI * (a * i + b * j) / N;
      baseRe[j * N + i] = Math.cos(phase); baseIm[j * N + i] = Math.sin(phase);
    }
  }
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let o = 0; o < ch.maps.length; o++) {
    const w = 2 * Math.PI * harmonic * ch.taus[o];
    const cw = Math.cos(w), sw = Math.sin(w), map = ch.maps[o];
    for (let i = 0; i < n; i++) {
      const br = baseRe[map[i]], bi = baseIm[map[i]];
      re[i] += cw * br - sw * bi;
      im[i] += sw * br + cw * bi;
    }
  }
  const g = ch.maps.length;
  for (let i = 0; i < n; i++) { re[i] /= g; im[i] /= g; }
  return { re, im };
}

/** Reciprocal shells, smallest |k| first, each with the members whose twisted star
 *  survives the character projection.  THIS IS THE SURPRISE: inside one shell some
 *  members survive and some cancel identically — for g227 the (1/3, 2/3) translation
 *  with tau = 2/3 kills half of the shortest shell, so "take the first shell vector"
 *  can give exactly zero.  Every member is therefore tested. */
export function waveShells(ch, N, L, { radius = 3, harmonic = 1, tolerance = 1e-9 } = {}) {
  const groups = new Map();
  for (let a = -radius; a <= radius; a++) {
    for (let b = -radius; b <= radius; b++) {
      if (a === 0 && b === 0) continue;
      const lam = laplacianEigenvalue([a, b], N, L);
      const k = lam.toFixed(9);
      if (!groups.has(k)) groups.set(k, { lam, waves: [] });
      groups.get(k).waves.push([a, b]);
    }
  }
  const out = [...groups.values()].sort((x, y) => y.lam - x.lam);   // lam <= 0: descending = |k| ascending
  for (const shell of out) {
    shell.norms = shell.waves.map(w => {
      const { re, im } = characterStar(ch, w, N, harmonic);
      let s = 0; for (let i = 0; i < re.length; i++) s += re[i] * re[i] + im[i] * im[i];
      return Math.sqrt(s / re.length);
    });
    shell.surviving = shell.waves.filter((_, i) => shell.norms[i] > tolerance);
    shell.projectionNorm = Math.max(...shell.norms);
    shell.k2 = -shell.lam;
  }
  return out;
}

/** Linearisation of the reaction at the uniform state plus the diffusion eigenvalue
 *  lam (rdlab.hopf_eigen, same one-sided finite difference with eps = 1e-6).
 *  Returns the oscillatory eigenvalue and its eigenvector normalised to first
 *  component 1 — exactly what rdlab.seed_from_complex uses. */
export function hopfEigen(p, lam = 0) {
  const f = ([u, v]) => [p.a - (p.b + 1) * u + u * u * v, p.b * u - u * u * v];
  const q0 = [p.a, p.b / p.a];                       // the Brusselator uniform state
  const eps = 1e-6, base = f(q0), J = [[0, 0], [0, 0]];
  for (let j = 0; j < 2; j++) {
    const d = [...q0]; d[j] += eps;
    const g = f(d);
    J[0][j] = (g[0] - base[0]) / eps;
    J[1][j] = (g[1] - base[1]) / eps;
  }
  const A = [[J[0][0] + lam * p.Du, J[0][1]], [J[1][0], J[1][1] + lam * p.Dv]];
  const tr = A[0][0] + A[1][1], det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  const disc = tr * tr / 4 - det;
  if (disc >= 0) throw new Error('no oscillatory pair at this wavenumber');
  const growth = tr / 2, omega = Math.sqrt(-disc);
  // eigenvector of a 2x2 for eigenvalue mu, normalised to first component 1:
  //   e = (1, (mu - A00)/A01)
  const reE = (growth - A[0][0]) / A[0][1], imE = omega / A[0][1];
  return { growth, omega, period: 2 * Math.PI / omega, q0, e: [[1, 0], [reE, imE]], lam, muHopf: p.b - 1 - p.a * p.a };
}

/** Seed (ii) of the tutorial: the lowest-|k| surviving twisted star, lifted through
 *  the Hopf eigenvector (rdlab.seed_from_complex):
 *    q(x) = q0 + amplitude * Re(psi(x) e_Hopf) / rms
 *  with trial period T0 = 2 pi / omega at that |k|.  For g227 the star is a sum of
 *  three plane waves at 120 degrees: a vortex-antivortex honeycomb. */
export function characterStarSeed(ch, p, { N = 36, L = 40, shell = 1, harmonic = 1, amplitude = 0.25, wave = null } = {}) {
  const shells = waveShells(ch, N, L, { harmonic }).filter(s => s.projectionNorm > 1e-9);
  const chosen = wave
    ? { lam: laplacianEigenvalue(wave, N, L), surviving: [wave], waves: [wave] }
    : shells[shell - 1];
  if (!chosen) throw new Error(`shell ${shell} out of range (1..${shells.length})`);
  chosen.k2 = -chosen.lam;
  const used = chosen.surviving[0];
  const psi = characterStar(ch, used, N, harmonic);
  const hopf = hopfEigen(p, chosen.lam);
  const n = N * N, field = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    // Re(psi * e_c) for each channel c
    field[i] = psi.re[i] * hopf.e[0][0] - psi.im[i] * hopf.e[0][1];
    field[n + i] = psi.re[i] * hopf.e[1][0] - psi.im[i] * hopf.e[1][1];
  }
  let ss = 0; for (let i = 0; i < field.length; i++) ss += field[i] * field[i];
  const rms = Math.sqrt(ss / field.length) || 1;
  const seed = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    seed[i] = hopf.q0[0] + amplitude * field[i] / rms;
    seed[n + i] = hopf.q0[1] + amplitude * field[n + i] / rms;
  }
  return {
    seed, T0: 2 * Math.PI / hopf.omega, psi, wave: used, waves: chosen.waves,
    surviving: chosen.surviving, norms: chosen.norms, lam: chosen.lam, k2: chosen.k2,
    omega: hopf.omega, growth: hopf.growth, amplitude, harmonic,
    shells: shells.slice(0, 4).map(s => ({ lam: s.lam, k2: s.k2, waves: s.waves, surviving: s.surviving, projectionNorm: s.projectionNorm })),
  };
}

// ---------------------------------------------------------------- first harmonic
/** Ahat(x) = (1/T) int_0^T q(x,t) e^{-2 pi i h t/T} dt, as the mean over saved frames.
 *  The clockwork law then reads  Ahat(g x) = exp(-2 pi i h tau_g) Ahat(x)  (a MINUS sign;
 *  measured on the published record: 8.5e-16 for minus, 0.74 for plus). */
export function firstHarmonic(frames, n, harmonic = 1) {
  const M = frames.length;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let f = 0; f < M; f++) {
    const c = Math.cos(-2 * Math.PI * harmonic * f / M) / M, s = Math.sin(-2 * Math.PI * harmonic * f / M) / M;
    const q = frames[f];
    for (let i = 0; i < n; i++) { re[i] += c * q[i]; im[i] += s * q[i]; }
  }
  return { re, im };
}

/** Winding of arg Ahat around the ring of six neighbours of every node.
 *
 *  The rotation centres of g227 sit ON mesh nodes, and that is exactly where the
 *  theory says the first harmonic must vanish — so the winding has to be measured
 *  around a node, not around a mesh cell (a triangle containing no zero winds by
 *  zero).  The ring is taken in Cartesian cyclic order
 *    (1,0) (1,1) (0,1) (-1,0) (-1,-1) (0,-1),
 *  the six stencil neighbours at 0, 60, ..., 300 degrees.  A ring that passes through
 *  a zero has no defined winding, so such nodes are skipped (`tolerance` is relative
 *  to max|Ahat|).  Returns the charged nodes: the vortices. */
export function findVortices(A, N, tolerance = 1e-6) {
  const wrap = d => { let a = d; while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };
  const n = N * N;
  const arg = new Float64Array(n), mag = new Float64Array(n);
  let maxMag = 0;
  for (let i = 0; i < n; i++) {
    arg[i] = Math.atan2(A.im[i], A.re[i]);
    mag[i] = Math.hypot(A.re[i], A.im[i]);
    if (mag[i] > maxMag) maxMag = mag[i];
  }
  const ring = [[1, 0], [1, 1], [0, 1], [-1, 0], [-1, -1], [0, -1]];
  const out = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const idx = k => (((y + ring[k][1]) % N + N) % N) * N + ((x + ring[k][0]) % N + N) % N;
      let sum = 0, ok = true;
      for (let k = 0; k < 6; k++) {
        const a = idx(k), b = idx((k + 1) % 6);
        if (mag[a] < tolerance * maxMag) { ok = false; break; }
        sum += wrap(arg[b] - arg[a]);
      }
      if (!ok) continue;
      const charge = Math.round(sum / (2 * Math.PI));
      if (charge !== 0) out.push({ charge, lattice: [x / N, y / N], amplitude: mag[y * N + x] / maxMag });
    }
  }
  return out;
}
