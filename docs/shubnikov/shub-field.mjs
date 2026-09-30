// The mathematics of the Shubnikov page, with no DOM: read data/census.json,
// expand a class's shipped orbit representatives into its full set of plane
// waves, and evaluate the coloured film.
//
// A class is a colouring sigma: G -> Z_n of a film group G.  Its picture is
//
//     Psi(x, t) = sum_p b_p exp(2 pi i (p.x + nu_p t)),
//
// x in the film's lattice coordinates, t in film periods.  The census ships one
// representative (q0, q1, offset, modulus, k) per orbit of modes; the rest of
// the orbit follows from the film's coset representatives g = (M, v, tau):
//
//     b_{M^T p, nu} = exp(2 pi i (p.v - sigma(g)/n + nu tau)) b_{p, nu},
//
// which is exactly Psi(g.z) = exp(2 pi i sigma(g)/n) Psi(z).  The colour of a
// point is the sector of arg Psi: kappa = floor(n * turn(arg Psi)), so every g
// advances every colour by sigma(g).  Nothing here is fitted or measured.

export const SCHEMA = 'shubnikov-census-v1';
const TAU = 2 * Math.PI;

export function frac(s) {
  if (typeof s === 'number') return s;
  const [a, b] = String(s).split('/');
  return b === undefined ? Number(a) : Number(a) / Number(b);
}

export async function loadCensus(url, fetcher = globalThis.fetch) {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`census: HTTP ${response.status}`);
  return indexCensus(await response.json());
}

export function indexCensus(census) {
  if (census.schema !== SCHEMA) throw new Error(`census: unexpected schema ${census.schema}`);
  const byId = new Map();
  const byFilm = new Map();
  for (const cls of census.classes) {
    byId.set(cls.id, cls);
    if (!byFilm.has(cls.gid)) byFilm.set(cls.gid, []);
    byFilm.get(cls.gid).push(cls);
  }
  Object.defineProperty(census, 'byId', { value: byId, enumerable: false });
  Object.defineProperty(census, 'byFilm', { value: byFilm, enumerable: false });
  return census;
}

// Film geometry: basis rows are the lattice vectors in Cartesian coordinates.
const geometryCache = new WeakMap();
export function filmGeometry(film) {
  let g = geometryCache.get(film);
  if (g) return g;
  const [[a, b], [c, d]] = film.basis;          // x_cart = x0 * (a, b) + x1 * (c, d)
  const det = a * d - b * c;
  g = {
    basis: film.basis,
    // lattice coordinates of a Cartesian point: [x0, x1] = toLattice * [X, Y]
    toLattice: [[d / det, -c / det], [-b / det, a / det]],
    ops: film.ops.map(([M, v, tau]) => ({ M, v: [frac(v[0]), frac(v[1])], tau: frac(tau) })),
  };
  geometryCache.set(film, g);
  return g;
}

// Width, in Cartesian lattice units, of the square of plane a card shows:
// `window` parent-lattice edges, whatever the film's mesh.
export function viewWidth(census, film) {
  return census.model.window / Math.sqrt(film.mesh);
}

// All plane waves of a class, as parallel arrays.
const fieldCache = new WeakMap();
export function expandClass(census, cls) {
  let f = fieldCache.get(cls);
  if (f) return f;
  const film = census.films[cls.gid];
  const { ops } = filmGeometry(film);
  const n = cls.n;
  const nu0 = frac(cls.nu0);
  const P = census.model.phaseDen;
  const seen = new Map();
  const px = [], py = [], nu = [], re = [], im = [];
  for (const [q0, q1, off, mod, k] of cls.modes) {
    const p0 = q0 + cls.u[0] / n, p1 = q1 + cls.u[1] / n, f0 = nu0 + off;
    const m = frac(mod), a0 = TAU * k / P;
    for (let i = 0; i < ops.length; i++) {
      const { M, v, tau } = ops[i];
      const r0 = M[0][0] * p0 + M[1][0] * p1;   // M^T p
      const r1 = M[0][1] * p0 + M[1][1] * p1;
      // exact key: n*12 p is an integer, 12 nu is an integer
      const key = `${Math.round(r0 * n * 12)},${Math.round(r1 * n * 12)},${Math.round(f0 * 12)}`;
      if (seen.has(key)) continue;
      const theta = a0 + TAU * (p0 * v[0] + p1 * v[1] - cls.c[i] / n + f0 * tau);
      seen.set(key, px.length);
      px.push(r0); py.push(r1); nu.push(f0);
      re.push(m * Math.cos(theta)); im.push(m * Math.sin(theta));
    }
  }
  f = {
    n, count: px.length,
    px: Float64Array.from(px), py: Float64Array.from(py), nu: Float64Array.from(nu),
    re: Float64Array.from(re), im: Float64Array.from(im),
    period: cls.m,                    // the coloured film closes after m film periods
  };
  fieldCache.set(cls, f);
  return f;
}

// Coefficients at time t, packed for a shader: [p0, p1, Re, Im] per wave.
export function timeSlice(field, t, out = new Float32Array(field.count * 4)) {
  for (let j = 0; j < field.count; j++) {
    const a = TAU * field.nu[j] * t, c = Math.cos(a), s = Math.sin(a);
    out[4 * j] = field.px[j];
    out[4 * j + 1] = field.py[j];
    out[4 * j + 2] = field.re[j] * c - field.im[j] * s;
    out[4 * j + 3] = field.re[j] * s + field.im[j] * c;
  }
  return out;
}

// Psi at lattice coordinates (x0, x1) and time t (film periods).
export function psi(field, x0, x1, t) {
  let r = 0, i = 0;
  for (let j = 0; j < field.count; j++) {
    const a = TAU * (field.px[j] * x0 + field.py[j] * x1 + field.nu[j] * t);
    const c = Math.cos(a), s = Math.sin(a);
    r += field.re[j] * c - field.im[j] * s;
    i += field.re[j] * s + field.im[j] * c;
  }
  return [r, i];
}

// Colour class of a value of Psi: the sector of its phase.
export function sector(re, im, n) {
  let turn = Math.atan2(im, re) / TAU;
  if (turn < 0) turn += 1;
  const k = Math.floor(turn * n);
  return k >= n ? k - n : k;
}

export function colourAt(field, x0, x1, t) {
  const [r, i] = psi(field, x0, x1, t);
  return sector(r, i, field.n);
}

// n inks, evenly spaced in CIE lightness from near-black to near-white.
export function greys(n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const L = n === 1 ? 50 : 7 + (96 - 7) * k / (n - 1);
    const fy = (L + 16) / 116;
    const Y = L > 8 ? fy * fy * fy : L / 903.3;
    const s = Y <= 0.0031308 ? 12.92 * Y : 1.055 * Math.pow(Y, 1 / 2.4) - 0.055;
    out.push(Math.max(0, Math.min(255, Math.round(255 * s))));
  }
  return out;
}

// Where a named generator or film operation takes a point, and what it does to
// colour.  Used by the tests and by the algebra panel.
export function applyOp(op, x0, x1, t) {
  const { M, v, tau } = op;
  return [M[0][0] * x0 + M[0][1] * x1 + v[0], M[1][0] * x0 + M[1][1] * x1 + v[1], t + tau];
}
