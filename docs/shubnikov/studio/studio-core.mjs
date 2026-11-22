// Studio — the mathematics, with no DOM and no GL.
//
// A two-colour class of the Shubnikov census is a film group G with a colouring
// sigma: G -> Z_2.  This file turns a census entry into a list of group
// elements, a design (shapes with motions, waves) into the copies those
// elements make of it, and the copies into real fields whose signs decide the
// ink.  Whatever the design, the fields obey F(g.z) = (-1)^sigma(g) F(z) for
// every g in G: the picture has the class's symmetry by construction, not by
// fitting.
//
// Time is measured in LOOPS: one loop is the m film periods after which the
// coloured film repeats.  An element is (x, t) -> (M x + v, t + tau) with a
// colour shift s; a design's shape seen through it is the shape as it was tau
// of a loop ago, carried by (M | v), in the other ink when s = 1.
//
// Three roles for a shape, and one for a wave:
//   flood   every copy claims the part of the plane nearer to it than to any
//           copy of the other ink (a soft Voronoi diagram; softness rounds it)
//   stamp   the copies sit on top of the floods as themselves; where a white
//           and a black copy overlap, the deeper one keeps the ground
//   invert  whatever lies under a copy changes ink
//   wave    a plane wave, summed over the group with signs, added to the
//           floods' field — the alphabet the census's own films are written in
//
// The same arithmetic is written twice: here in double precision (tests, hit
// testing, the "does this layer cancel itself" probe) and in studio-gl.mjs as
// a fragment shader.  A browser test holds the two together.

export const TAU = 2 * Math.PI;
// A frame is four fields, each with the class's symmetry on its own:
//   G  the ground, from the floods and the waves; white where it is positive
//   A  stamp cover, positive inside the union of the stamps' copies
//   S  stamp ink, positive where the stamps' white copies are the deeper
//   I  inverter, negative where an odd number of inverting layers cover
// G and S change sign under an ink-swapping element; A and I do not.  They are
// kept apart, and put together only when a pixel is coloured, because each is
// smooth across the others' outlines and an edge can then be softened by one
// pixel along its own field alone.
// Below GLASS a field counts as zero: that is where white and black copies
// coincide and the group has cancelled them, up to rounding.  It sits well
// above a GPU's rounding (a few 1e-7 here) and well below anything a design
// decides on purpose, so a narrowly won patch is still drawn in its ink.
export const GLASS = 4e-6;
export const STAMP_FLOOR = -6;        // a stamp's say ends about 6 softnesses out
export const INVERT_CAP = 0.02;       // an inverter's field is flat beyond this
const NONE = -1e30;
const G_CLAMP = 60;

export function frac(s) {
  if (typeof s === 'number') return s;
  const [a, b] = String(s).split('/');
  return b === undefined ? Number(a) : Number(a) / Number(b);
}

const mod1 = (x) => x - Math.floor(x);

// ------------------------------------------------------------------ group --

/** Everything the studio needs to know about one two-colour class. */
export function buildGroup(census, classId) {
  const cls = census.classes.find((c) => c.id === classId);
  if (!cls) throw new Error(`studio: no class ${classId} in the census`);
  if (cls.n !== 2) throw new Error(`studio: ${classId} has ${cls.n} colours; the studio draws two`);
  const film = census.films[cls.gid];
  const B = film.basis;                       // rows: the two lattice vectors
  const det = B[0][0] * B[1][1] - B[0][1] * B[1][0];
  // Cartesian X = P lat with P = B^T; lat = Pinv X.
  const P = [[B[0][0], B[1][0]], [B[0][1], B[1][1]]];
  const Pinv = [[B[1][1] / det, -B[1][0] / det], [-B[0][1] / det, B[0][0] / det]];
  const mul = (A, C) => [
    [A[0][0] * C[0][0] + A[0][1] * C[1][0], A[0][0] * C[0][1] + A[0][1] * C[1][1]],
    [A[1][0] * C[0][0] + A[1][1] * C[1][0], A[1][0] * C[0][1] + A[1][1] * C[1][1]],
  ];
  const m = cls.m;
  const elements = [];
  film.ops.forEach(([M, v, tau], i) => {
    for (let j = 0; j < m; j++) {
      const vl = [frac(v[0]), frac(v[1])];
      const Mc = mul(mul(P, M), Pinv);
      const md = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      elements.push({
        M, v: vl,
        tau: mod1((frac(tau) + j) / m),
        s: (cls.c[i] + j * cls.ct) % 2,
        det: md,
        Mc,                                    // Cartesian linear part (orthogonal)
        vc: [P[0][0] * vl[0] + P[0][1] * vl[1], P[1][0] * vl[0] + P[1][1] * vl[1]],
        // M^-T, for carrying wavevectors: integer, since det M = +-1
        MinvT: [[M[1][1] / md, -M[1][0] / md], [-M[0][1] / md, M[0][0] / md]],
        isIdentity: M[0][0] === 1 && M[1][1] === 1 && !M[0][1] && !M[1][0]
          && Math.abs(vl[0]) < 1e-12 && Math.abs(vl[1]) < 1e-12,
      });
    }
  });
  // the seed itself first: identity, no delay, own ink
  elements.sort((a, b) => {
    const ka = a.isIdentity && a.tau === 0 ? 0 : 1, kb = b.isIdentity && b.tau === 0 ? 0 : 1;
    return ka - kb;
  });
  const len0 = Math.hypot(B[0][0], B[0][1]), len1 = Math.hypot(B[1][0], B[1][1]);
  const hmin = Math.min(Math.abs(det) / len1, Math.abs(det) / len0);
  // covering radius of the lattice, by brute force once
  let cover = 0;
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      const X = P[0][0] * (i / 24) + P[0][1] * (j / 24), Y = P[1][0] * (i / 24) + P[1][1] * (j / 24);
      let best = Infinity;
      for (let a = -2; a <= 2; a++) {
        for (let b = -2; b <= 2; b++) {
          best = Math.min(best, Math.hypot(X - a * B[0][0] - b * B[1][0], Y - a * B[0][1] - b * B[1][1]));
        }
      }
      cover = Math.max(cover, best);
    }
  }
  return {
    id: cls.id, gid: cls.gid, cls, film, n: 2, m,
    basis: B, P, Pinv, det,
    u: cls.u.slice(),
    elements,
    hmin, cover,
    // how far from a copy's centre each way of walking the lattice is complete
    safe: [0, hmin / 2, hmin, 1.5 * hmin],
    floodMode: cover < 0.78 * hmin ? 2 : 3,
  };
}

export const toCart = (group, lat) => [
  group.P[0][0] * lat[0] + group.P[0][1] * lat[1],
  group.P[1][0] * lat[0] + group.P[1][1] * lat[1],
];
export const toLat = (group, X) => [
  group.Pinv[0][0] * X[0] + group.Pinv[0][1] * X[1],
  group.Pinv[1][0] * X[0] + group.Pinv[1][1] * X[1],
];

/** g applied to a spacetime point given in Cartesian coordinates. */
export function applyElement(el, X, Y, t) {
  return [el.Mc[0][0] * X + el.Mc[0][1] * Y + el.vc[0], el.Mc[1][0] * X + el.Mc[1][1] * Y + el.vc[1], t + el.tau];
}

const FRACTIONS = [[0, '0'], [1 / 6, '⅙'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [5 / 6, '⅚']];
export function fractionGlyph(x) {
  const f = mod1(x + 1e-9) - 1e-9;
  for (const [value, glyph] of FRACTIONS) if (Math.abs(f - value) < 1e-6) return glyph;
  return f.toFixed(3);
}

/** What one element does, in words a status line can show. */
export function describeElement(el) {
  const parts = [];
  if (el.det > 0) {
    const deg = Math.round(Math.atan2(el.Mc[1][0], el.Mc[0][0]) * 180 / Math.PI);
    if (deg === 0) {
      if (Math.hypot(el.vc[0], el.vc[1]) > 1e-9) parts.push('shifted');
    } else if (Math.abs(deg) === 180) parts.push('half turn');
    else if (Math.abs(deg) === 90) parts.push(deg > 0 ? 'quarter turn ↺' : 'quarter turn ↻');
    else parts.push(`turned ${Math.abs(deg)}° ${deg > 0 ? '↺' : '↻'}`);
  } else {
    const isMirror = Math.abs(el.Mc[0][0] * el.vc[0] + el.Mc[0][1] * el.vc[1] + el.vc[0]) < 1e-9
      && Math.abs(el.Mc[1][0] * el.vc[0] + el.Mc[1][1] * el.vc[1] + el.vc[1]) < 1e-9;
    parts.push(isMirror ? 'mirrored' : 'glide-mirrored');
  }
  if (el.tau > 1e-9) parts.push(`${fractionGlyph(el.tau)} loop later`);
  if (!parts.length) parts.push('itself');
  parts.push(el.s ? 'inks swapped' : 'same inks');
  return parts.join(' · ');
}

/**
 * Rotation centres of the group inside one cell, in lattice coordinates.
 *   order   the largest rotation about the point
 *   kind    'static'  the turn of that order costs no time and keeps the inks
 *           'anti'    some turn about the point costs no time and swaps them
 *           'screw'   every turn about the point costs time
 *   step    {tau, s} of the smallest counter-clockwise turn of that order
 */
export function rotationCentres(group) {
  const found = new Map();
  for (const el of group.elements) {
    if (el.det < 0 || (el.M[0][0] === 1 && el.M[1][1] === 1 && !el.M[0][1] && !el.M[1][0])) continue;
    const tr = el.M[0][0] + el.M[1][1];
    const order = tr === 1 ? 6 : tr === 0 ? 4 : tr === -1 ? 3 : 2;
    const a = 1 - el.M[0][0], b = -el.M[0][1], c = -el.M[1][0], d = 1 - el.M[1][1];
    const dd = a * d - b * c;
    const angle = Math.atan2(el.Mc[1][0], el.Mc[0][0]);
    for (let m0 = -2; m0 <= 2; m0++) {
      for (let m1 = -2; m1 <= 2; m1++) {
        const w0 = el.v[0] + m0, w1 = el.v[1] + m1;
        const c0 = (d * w0 - b * w1) / dd, c1 = (-c * w0 + a * w1) / dd;
        // centres are rational with small denominators: say so exactly
        const r0 = (((Math.round(c0 * 120) % 120) + 120) % 120) / 120, r1 = (((Math.round(c1 * 120) % 120) + 120) % 120) / 120;
        const key = `${Math.round(r0 * 120)},${Math.round(r1 * 120)}`;
        let rec = found.get(key);
        if (!rec) { rec = { c: [r0, r1], order: 0, entries: [] }; found.set(key, rec); }
        const sig = `${order}|${angle.toFixed(4)}|${el.tau.toFixed(6)}|${el.s}`;
        if (!rec.entries.some((e) => e.sig === sig)) rec.entries.push({ sig, order, angle, tau: el.tau, s: el.s });
        rec.order = Math.max(rec.order, order);
      }
    }
  }
  const out = [];
  for (const rec of found.values()) {
    const free = rec.entries.filter((e) => e.tau < 1e-9);
    let kind = 'screw';
    if (free.some((e) => e.s === 1)) kind = 'anti';
    if (free.some((e) => e.s === 0 && e.order === rec.order)) kind = 'static';
    const top = rec.entries.filter((e) => e.order === rec.order && e.angle > 0)
      .sort((p, q) => p.angle - q.angle || p.s - q.s || p.tau - q.tau)[0] || rec.entries[0];
    out.push({ c: rec.c, order: rec.order, kind, step: { tau: top.tau, s: top.s } });
  }
  return out;
}

/**
 * Mirror and glide axes of the group within `reach` cells of the origin, in
 * lattice coordinates: a point `p` on the axis and its direction `d`.
 *   kind  'mirror'  a reflection in the axis that costs no time and keeps the inks
 *         'anti'    one that costs no time and swaps them
 *         'glide'   every reflection in the axis also slides along it or costs time
 * One axis carries many elements (the same reflection with every translation
 * along it), so the kind is the best that any of them offers.
 */
export function mirrorAxes(group, reach = 2) {
  const found = new Map();
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const column = (A) => (A[0][0] || A[1][0] ? [A[0][0], A[1][0]] : [A[0][1], A[1][1]]);
  const primitive = (v) => { const g = gcd(v[0], v[1]) || 1; let w = [v[0] / g, v[1] / g]; if (w[0] < 0 || (w[0] === 0 && w[1] < 0)) w = [-w[0], -w[1]]; return w; };
  const RANK = { glide: 0, anti: 1, mirror: 2 };
  for (const el of group.elements) {
    if (el.det > 0) continue;
    const M = el.M;
    const d = primitive(column([[M[0][0] + 1, M[0][1]], [M[1][0], M[1][1] + 1]]));   // M d = d
    const n = primitive(column([[M[0][0] - 1, M[0][1]], [M[1][0], M[1][1] - 1]]));   // M n = -n
    const det = d[0] * n[1] - d[1] * n[0];
    for (let m0 = -reach - 1; m0 <= reach + 1; m0++) {
      for (let m1 = -reach - 1; m1 <= reach + 1; m1++) {
        const v0 = el.v[0] + m0, v1 = el.v[1] + m1;
        const along = (v0 * n[1] - v1 * n[0]) / det, across = (d[0] * v1 - d[1] * v0) / det;
        const p = [n[0] * across / 2, n[1] * across / 2];
        const offset = -d[1] * p[0] + d[0] * p[1];
        const key = `${d[0]},${d[1]},${Math.round(offset * 48)}`;
        const slides = Math.abs(along - Math.round(along)) > 1e-9;
        const kind = slides || el.tau > 1e-9 ? 'glide' : el.s ? 'anti' : 'mirror';
        const had = found.get(key);
        if (!had) found.set(key, { p, d, kind });
        else if (RANK[kind] > RANK[had.kind]) had.kind = kind;
      }
    }
  }
  const limit = reach + 0.75;
  // an axis is kept if it passes within reach of the origin
  return [...found.values()].filter((axis) => {
    const c = toCart(group, axis.p), dc = toCart(group, axis.d);
    const len = Math.hypot(dc[0], dc[1]);
    return Math.abs(c[0] * dc[1] - c[1] * dc[0]) / len <= limit * Math.max(Math.hypot(group.basis[0][0], group.basis[0][1]), Math.hypot(group.basis[1][0], group.basis[1][1]));
  });
}

// ----------------------------------------------------------------- shapes --

// a, n, q are each [min, max, default, label] when the shape uses them.
// sym is the order of the shape's own rotational symmetry (0: a circle),
// which decides the spin rates that close the loop.
export const SHAPES = [
  { id: 'disc', label: 'Disc', sym: 0 },
  { id: 'ellipse', label: 'Ellipse', sym: 2, a: [0.15, 1, 0.55, 'flatness'] },
  { id: 'bar', label: 'Bar', sym: 2, a: [0.04, 1, 0.22, 'thickness'] },
  { id: 'box', label: 'Box', sym: 2, a: [0.1, 1, 1, 'flatness'], q: [0, 1, 0.15, 'rounding'] },
  { id: 'poly', label: 'Polygon', sym: -1, n: [3, 12, 3, 'sides'], q: [0, 1, 0.1, 'rounding'] },
  { id: 'star', label: 'Star', sym: -1, n: [3, 12, 5, 'points'], a: [0.15, 0.95, 0.45, 'inner radius'], q: [0, 1, 0, 'rounding'] },
  { id: 'ring', label: 'Ring', sym: 0, a: [0.05, 0.95, 0.3, 'thickness'] },
  { id: 'comma', label: 'Comma', sym: 1, a: [0.3, 0.7, 0.5, 'head'] },
  { id: 'moon', label: 'Moon', sym: 1, a: [0.1, 0.95, 0.35, 'fullness'] },
  { id: 'cross', label: 'Cross', sym: 4, a: [0.08, 0.7, 0.28, 'thickness'], q: [0, 1, 0, 'rounding'] },
  { id: 'arc', label: 'Arc', sym: 1, a: [0.05, 0.98, 0.6, 'sweep'], q: [0, 1, 0.3, 'thickness'] },
  { id: 'wedge', label: 'Wedge', sym: 1, a: [0.05, 0.95, 0.25, 'opening'] },
];
export const SHAPE_INDEX = new Map(SHAPES.map((s, i) => [s.id, i]));
export const shapeDef = (id) => SHAPES[SHAPE_INDEX.get(id)] || SHAPES[0];

/** The rotational symmetry a spin has to respect for the loop to close. */
export function shapeSymmetry(layer) {
  const def = shapeDef(layer.sh);
  if (def.sym === -1) return Math.round(layer.n);
  if (layer.sh === 'box' && Math.abs(layer.a - 1) < 1e-9) return 4;
  return def.sym;
}

/** Radius of the disc about the shape's own centre that contains it. */
export function shapeBound(layer) {
  if (layer.sh === 'box' || layer.sh === 'cross') return layer.r * Math.hypot(1, layer.a);
  return layer.r;
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function sdBox(x, y, hx, hy, rad) {
  const dx = Math.abs(x) - (hx - rad), dy = Math.abs(y) - (hy - rad);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - rad;
}

/** Signed distance (negative inside) from a point in the shape's own frame. */
export function sdShape(type, x, y, r, a, n, q) {
  switch (type) {
    case 0: return Math.hypot(x, y) - r;
    case 1: {                                 // ellipse, semi-axes r and r a
      const bx = r, by = r * a;
      const k1 = Math.hypot(x / bx, y / by), k2 = Math.hypot(x / (bx * bx), y / (by * by));
      return k2 < 1e-9 ? -by : k1 * (k1 - 1) / k2;
    }
    case 2: {                                 // bar: a capsule, tip to tip 2r
      const w = r * a, L = r - w;
      return Math.hypot(Math.max(Math.abs(x) - L, 0), y) - w;
    }
    case 3: return sdBox(x, y, r, r * a, q * Math.min(r, r * a));
    case 4: {                                 // regular polygon, a vertex up
      const an = Math.PI / n, ca = Math.cos(an), sa = Math.sin(an);
      const rr = 0.8 * q * r * ca, ri = r - rr / ca;
      const m = 2 * an;
      let bn = Math.atan2(x, y); bn = bn - m * Math.floor(bn / m) - an;
      const len = Math.hypot(x, y);
      let px = len * Math.cos(bn) - ri * ca, py = len * Math.abs(Math.sin(bn)) - ri * sa;
      py += clamp(-py, 0, ri * sa);
      return Math.hypot(px, py) * (px > 0 ? 1 : -1) - rr;
    }
    case 5: {                                 // star, a point up
      const an = Math.PI / n, m = 2 * an;
      const rr = 0.35 * q * r * a, ro = r - rr;
      let bn = Math.atan2(x, y) + an; bn = bn - m * Math.floor(bn / m) - an;
      const len = Math.hypot(x, y);
      const qx = len * Math.cos(bn), qy = len * Math.abs(Math.sin(bn));
      const bax = ro * a * Math.cos(an) - ro, bay = ro * a * Math.sin(an);
      const pax = qx - ro, pay = qy;
      const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
      const s = bax * pay - bay * pax;
      return Math.hypot(pax - bax * h, pay - bay * h) * (s > 0 ? -1 : 1) - rr;
    }
    case 6: {                                 // ring
      const th = r * a;
      return Math.abs(Math.hypot(x, y) - (r - th / 2)) - th / 2;
    }
    case 7: {                                 // comma: the yin of a yin-yang
      // Three half-circles, all ending on the shape's own y axis.  The exact
      // distance, not a bound: a comma and its half-turned twin fill a disc,
      // and a bound would call a whole wedge outside that disc a tie.
      const r1 = r * a, r2 = r - r1;
      const big = Math.hypot(x, y) - r;
      const head = Math.hypot(x, y - (r - r1)) - r1;
      const hole = Math.hypot(x, y + r1) - r2;
      const inside = Math.max(Math.min(Math.max(big, -x), head), -hole) < 0;
      const top = Math.hypot(x, y - r), mid = Math.hypot(x, y - (r - 2 * r1)), bottom = Math.hypot(x, y + r);
      const d = Math.min(
        x >= 0 ? Math.abs(big) : Math.min(top, bottom),
        x <= 0 ? Math.abs(head) : Math.min(top, mid),
        x >= 0 ? Math.abs(hole) : Math.min(mid, bottom),
      );
      return inside ? -d : d;
    }
    case 8: {                                 // moon: a disc less an equal disc, exactly
      const dd = 2 * r * a, py = Math.abs(y);
      const aa = dd / 2, bb = Math.sqrt(Math.max(r * r - aa * aa, 0));
      if (dd * (x * bb - py * aa) > dd * dd * Math.max(bb - py, 0)) return Math.hypot(x - aa, py - bb);
      return Math.max(Math.hypot(x, py) - r, r - Math.hypot(x - dd, py));
    }
    case 9: {
      const w = r * a, rad = q * w;
      return Math.min(sdBox(x, y, r, w, rad), sdBox(x, y, w, r, rad));
    }
    case 10: {                                // arc about +y
      const al = Math.PI * a, sx = Math.sin(al), cx = Math.cos(al);
      const rb = r * (0.06 + 0.3 * q), ra = r - rb;
      const px = Math.abs(x);
      const d = cx * px > sx * y ? Math.hypot(px - sx * ra, y - cx * ra) : Math.abs(Math.hypot(px, y) - ra);
      return d - rb;
    }
    case 11: {                                // wedge about +y
      const al = Math.PI * a, sx = Math.sin(al), cx = Math.cos(al);
      const px = Math.abs(x);
      const l = Math.hypot(px, y) - r;
      const tt = clamp(px * sx + y * cx, 0, r);
      const m = Math.hypot(px - sx * tt, y - cx * tt);
      return Math.max(l, m * (cx * px - sx * y > 0 ? 1 : -1));
    }
    default: return Math.hypot(x, y) - r;
  }
}

// ----------------------------------------------------------------- motion --

export const MOVES = [
  { id: 'o', label: 'Orbit', hint: 'round a circle, an ellipse or along a line' },
  { id: 'w', label: 'Path', hint: 'from point to point round a closed route' },
  { id: 's', label: 'Spin', hint: 'turn about its own centre' },
  { id: 'r', label: 'Rock', hint: 'swing to and fro about its own centre' },
  { id: 'p', label: 'Pulse', hint: 'grow and shrink' },
  { id: 'b', label: 'Blink', hint: 'be there for part of the loop only' },
];

export function newMove(id) {
  switch (id) {
    case 'o': return { m: 'o', r: 0.2, e: 1, tilt: 0, k: 1, ph: 0 };
    case 'w': return { m: 'w', pts: [[0, 0], [0.25, 0], [0.25, 0.25]], k: 1, ph: 0, ease: 0.5 };
    case 's': return { m: 's', k: 1 };
    case 'r': return { m: 'r', amp: 0.125, k: 1, ph: 0 };
    case 'p': return { m: 'p', amt: 0.5, k: 1, ph: 0 };
    case 'b': return { m: 'b', on: 0, dur: 0.5, k: 1 };
    default: throw new Error(`studio: no move ${id}`);
  }
}

function pathPoint(mv, t) {
  const pts = mv.pts, N = pts.length;
  if (N === 0) return [0, 0];
  if (N === 1) return pts[0];
  const u = mod1(mv.k * t + (mv.ph || 0)) * N;
  let i = Math.floor(u); if (i >= N) i = N - 1;
  let f = u - i;
  const sm = f * f * (3 - 2 * f);
  f += (sm - f) * (mv.ease ?? 0);
  const a = pts[i], b = pts[(i + 1) % N];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

function blinkWindow(mv, t) {
  const dur = clamp(mv.dur, 0.02, 1);
  if (dur >= 1) return 1;
  const p = mod1(mv.k * t - mv.on);
  if (p >= dur) return 0;
  const fade = Math.min(0.06, dur / 2);
  const e = clamp(Math.min(p, dur - p) / fade, 0, 1);
  return e * e * (3 - 2 * e);
}

/** Where a shape is, how it is turned and how big, at loop time t. */
export function stateAt(layer, t, group) {
  let x = group.P[0][0] * layer.at[0] + group.P[0][1] * layer.at[1];
  let y = group.P[1][0] * layer.at[0] + group.P[1][1] * layer.at[1];
  let ang = TAU * (layer.th || 0), scale = 1, pres = 1;
  for (const mv of layer.mv || []) {
    switch (mv.m) {
      case 'o': {
        const u = TAU * (mv.k * t + mv.ph), dx = mv.r * Math.cos(u), dy = mv.r * mv.e * Math.sin(u);
        const c = Math.cos(TAU * mv.tilt), s = Math.sin(TAU * mv.tilt);
        x += dx * c - dy * s; y += dx * s + dy * c;
        break;
      }
      case 'w': { const p = pathPoint(mv, t); x += p[0]; y += p[1]; break; }
      case 's': ang += TAU * mv.k * t; break;
      case 'r': ang += TAU * mv.amp * Math.sin(TAU * (mv.k * t + mv.ph)); break;
      case 'p': scale *= Math.max(0, 1 + mv.amt * Math.cos(TAU * (mv.k * t + mv.ph))); break;
      case 'b': { const w = blinkWindow(mv, t); scale *= w; pres *= w; break; }
      default: break;
    }
  }
  return { x, y, ang, scale, pres };
}

/** The centre of a shape before move `upto` is applied (handles hang here). */
export function pivotAt(layer, t, group, upto) {
  const partial = { ...layer, mv: (layer.mv || []).slice(0, upto) };
  const st = stateAt(partial, t, group);
  return [st.x, st.y];
}

function maxScale(layer) {
  let s = 1;
  for (const mv of layer.mv || []) if (mv.m === 'p') s *= 1 + Math.abs(mv.amt);
  return s;
}

// ---------------------------------------------------------------- compile --

const ROLE_ORDER = { f: 0, s: 1, i: 2 };

/**
 * Everything a frame needs: for every shape, the copies the group makes of it
 * at loop time t; for every wave, the plane waves its orbit sums to.
 */
export function compileFrame(design, group, t) {
  const shapes = [];
  const waves = [];
  for (const layer of design.L) {
    if (layer.off) continue;
    if (layer.k === 'w') {
      const terms = waveTerms(layer, group, t);
      if (terms.length) waves.push({ layer, terms });
      continue;
    }
    const type = SHAPE_INDEX.get(layer.sh) ?? 0;
    const role = layer.role in ROLE_ORDER ? layer.role : 'f';
    const h = Math.max(0.002, layer.h ?? 0.02);
    const ext = shapeBound(layer) * maxScale(layer);
    let mode;
    if (role === 'f') mode = ext <= 0.45 * group.hmin ? group.floodMode : 3;
    else {
      const need = ext + (role === 's' ? 8 * h : 0) + 0.02;
      mode = need < group.safe[1] ? 1 : need < group.safe[2] ? 2 : 3;
    }
    const copies = [];
    group.elements.forEach((el, j) => {
      const st = stateAt(layer, t - el.tau, group);
      if (!(st.pres > 0) || !(st.scale > 1e-4)) return;
      const c = Math.cos(st.ang), s = Math.sin(st.ang);
      const Mc = el.Mc;
      copies.push({
        j,
        ox: Mc[0][0] * st.x + Mc[0][1] * st.y + el.vc[0],
        oy: Mc[1][0] * st.x + Mc[1][1] * st.y + el.vc[1],
        // local = Q (X - o), Q = Rot(-ang) Mc^T
        q00: c * Mc[0][0] + s * Mc[0][1], q01: c * Mc[1][0] + s * Mc[1][1],
        q10: -s * Mc[0][0] + c * Mc[0][1], q11: -s * Mc[1][0] + c * Mc[1][1],
        scale: st.scale,
        ink: (el.s + (layer.ink ? 1 : 0)) % 2,
        lnp: Math.log(Math.max(st.pres, 1e-6)),
      });
    });
    const shape = {
      layer, role, type, mode, h,
      r: layer.r, a: layer.a ?? 0.5, n: Math.round(layer.n ?? 5), q: layer.q ?? 0,
      copies,
    };
    if (role !== 'i') cancelCoincident(shape, group);
    shapes.push(shape);
  }
  shapes.sort((p, q) => ROLE_ORDER[p.role] - ROLE_ORDER[q.role]);
  const mean = (list) => (list.length ? list.reduce((s, x) => s + x.h, 0) / list.length : 0.02);
  return {
    t, group, shapes, waves,
    hFlood: mean(shapes.filter((s) => s.role === 'f')),
    hStamp: mean(shapes.filter((s) => s.role === 's')),
  };
}

// Points with no symmetry, for asking whether two copies are the same set.
const PROBE = [[0.31, 0.17], [-0.42, 0.55], [0.08, -0.73], [-0.66, -0.29], [0.93, 0.41], [-0.12, 1.07], [1.21, -0.52]];

/**
 * Take out every white copy that lies exactly on a black one, with it.
 *
 * Such a pair adds nothing: that is the group cancelling a shape (one that
 * stands still, a round one on a centre, any shape at the instant its motion
 * crosses its twin's).  Left in, the pair would have the two sums differ by
 * rounding alone and the picture there would be noise; taken out, what is left
 * decides, which is what the arithmetic means.
 */
function cancelCoincident(shape, group) {
  const copies = shape.copies, n = copies.length;
  if (n < 2) return;
  const dead = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (dead[i]) continue;
    const a = copies[i];
    for (let j = i + 1; j < n; j++) {
      if (dead[j]) continue;
      const b = copies[j];
      if (Math.abs(a.scale - b.scale) > 1e-9 || Math.abs(a.lnp - b.lnp) > 1e-9) continue;
      const dX = b.ox - a.ox, dY = b.oy - a.oy;
      const l0 = group.Pinv[0][0] * dX + group.Pinv[0][1] * dY, l1 = group.Pinv[1][0] * dX + group.Pinv[1][1] * dY;
      const n0 = Math.round(l0), n1 = Math.round(l1);
      if (Math.abs(l0 - n0) > 1e-8 || Math.abs(l1 - n1) > 1e-8) continue;
      // b's translate that sits on a: is it in the other ink?
      if (((a.ink + b.ink + group.u[0] * n0 + group.u[1] * n1) & 1) === 0) continue;
      const reach = 1.3 * shape.r * a.scale;
      let same = true;
      for (const [px, py] of PROBE) {
        if (Math.abs(copyDistance(shape, a, px * reach, py * reach) - copyDistance(shape, b, px * reach, py * reach)) > 1e-9) { same = false; break; }
      }
      if (same) { dead[i] = true; dead[j] = true; break; }
    }
  }
  shape.copies = copies.filter((_, i) => !dead[i]);
}

/** A wave's orbit, collected into distinct plane waves a cos(2 pi q.lat + phase). */
export function waveTerms(layer, group, t) {
  const byQ = new Map();
  const p0 = layer.p[0] + group.u[0] / 2, p1 = layer.p[1] + group.u[1] / 2;
  const norm = (layer.amp ?? 0.1) / group.m;
  for (const el of group.elements) {
    const q0 = el.MinvT[0][0] * p0 + el.MinvT[0][1] * p1;
    const q1 = el.MinvT[1][0] * p0 + el.MinvT[1][1] * p1;
    const phase = TAU * (-(q0 * el.v[0] + q1 * el.v[1]) - layer.nu * (t - el.tau) + (layer.ph || 0) + (layer.ink ? 0.5 : 0));
    const sign = el.s ? -1 : 1;
    const key = `${Math.round(q0 * 2)},${Math.round(q1 * 2)}`;
    let rec = byQ.get(key);
    if (!rec) { rec = { q0, q1, re: 0, im: 0 }; byQ.set(key, rec); }
    rec.re += sign * norm * Math.cos(phase);
    rec.im += sign * norm * Math.sin(phase);
  }
  const out = [];
  for (const rec of byQ.values()) {
    const amp = Math.hypot(rec.re, rec.im);
    if (amp > 1e-9) out.push({ q0: rec.q0, q1: rec.q1, amp, phase: Math.atan2(rec.im, rec.re) });
  }
  return out;
}

// -------------------------------------------------------------- the field --

function lse(acc, e) {                        // streaming log-sum-exp
  if (e > acc.M) { acc.S = acc.S * Math.exp(acc.M - e) + 1; acc.M = e; } else acc.S += Math.exp(e - acc.M);
}
const lseValue = (acc) => (acc.S > 0 ? acc.M + Math.log(acc.S) : NONE);

/** Visit every lattice translate of a copy that the shape's walk mode covers. */
function eachTranslate(group, mode, copy, X, Y, visit) {
  const dX = X - copy.ox, dY = Y - copy.oy;
  const l0 = group.Pinv[0][0] * dX + group.Pinv[0][1] * dY;
  const l1 = group.Pinv[1][0] * dX + group.Pinv[1][1] * dY;
  const f0 = mode === 2 ? Math.floor(l0) : Math.floor(l0 + 0.5);
  const f1 = mode === 2 ? Math.floor(l1) : Math.floor(l1 + 0.5);
  const lo = mode === 1 ? 0 : -1, hi = mode === 3 ? 1 : 0;
  for (let i = lo; i <= hi; i++) {
    for (let j = lo; j <= hi; j++) {
      const d0 = l0 - f0 + i, d1 = l1 - f1 + j;
      const cx = group.P[0][0] * d0 + group.P[0][1] * d1, cy = group.P[1][0] * d0 + group.P[1][1] * d1;
      // this translate sits at o + (f - (i, j)) in lattice steps
      const flip = (group.u[0] * (f0 - i) + group.u[1] * (f1 - j)) & 1;
      visit(cx, cy, flip);
    }
  }
}

function copyDistance(shape, copy, cx, cy) {
  const lx = copy.q00 * cx + copy.q01 * cy, ly = copy.q10 * cx + copy.q11 * cy;
  return sdShape(shape.type, lx, ly, shape.r * copy.scale, shape.a, shape.n, shape.q);
}

/** The four fields [G, A, S, I] of a compiled frame at a Cartesian point. */
export function componentsAt(frame, X, Y) {
  const group = frame.group;
  const fp = { M: NONE, S: 0 }, fq = { M: NONE, S: 0 };
  // the floor is what makes a stamp's far field flat, so that walking only the
  // nearest translates of its copies leaves no seam
  const sp = { M: STAMP_FLOOR, S: 1 }, sq = { M: STAMP_FLOOR, S: 1 };
  let anyFlood = false;
  let I = INVERT_CAP;
  for (const shape of frame.shapes) {
    if (shape.role === 'i') {
      let d = INVERT_CAP;
      for (const copy of shape.copies) {
        eachTranslate(group, shape.mode, copy, X, Y, (cx, cy) => { d = Math.min(d, copyDistance(shape, copy, cx, cy)); });
      }
      I = (d < 0 ? -1 : 1) * (I < 0 ? -1 : 1) * Math.min(Math.abs(I), Math.abs(d));
      continue;
    }
    const flood = shape.role === 'f';
    const R2 = group.safe[shape.mode], R1 = 0.8 * R2;
    for (const copy of shape.copies) {
      eachTranslate(group, shape.mode, copy, X, Y, (cx, cy, flip) => {
        let e = copy.lnp - copyDistance(shape, copy, cx, cy) / shape.h;
        if (flood) {
          const rr = Math.hypot(cx, cy);
          if (rr >= R2) return;
          if (rr > R1) { const s = (R2 - rr) / (R2 - R1); e += Math.log(s * s * (3 - 2 * s)); }
        }
        const white = ((copy.ink + flip) & 1) === 0;
        if (flood) { anyFlood = true; lse(white ? fp : fq, e); } else lse(white ? sp : sq, e);
      });
    }
  }
  let G = 0;
  if (anyFlood) G = frame.hFlood * (lseValue(fp) - lseValue(fq));
  const lat0 = group.Pinv[0][0] * X + group.Pinv[0][1] * Y, lat1 = group.Pinv[1][0] * X + group.Pinv[1][1] * Y;
  for (const wave of frame.waves) {
    for (const term of wave.terms) G += term.amp * Math.cos(TAU * (term.q0 * lat0 + term.q1 * lat1) + term.phase);
  }
  G = clamp(G, -G_CLAMP, G_CLAMP);
  const Lp = lseValue(sp), Lq = lseValue(sq);
  const S = frame.hStamp * (Lp - Lq);
  const A = frame.hStamp * (Math.max(Lp, Lq) + Math.log(1 + Math.exp(-Math.abs(Lp - Lq))));
  return [G, A, S, I];
}

/**
 * The ink at a point: +1 white, -1 black, 0 where nothing has a say.
 * `margin` is how far, in field units, the point is from changing its mind.
 */
export function inkAt(frame, X, Y) {
  const [G, A, S, I] = componentsAt(frame, X, Y);
  const stamped = A > 0 && Math.abs(S) > GLASS;
  // a ground the group cancels is zero up to rounding: that is grey, not ink
  const value = stamped ? S : Math.abs(G) > GLASS ? G : 0;
  const ink = value > 0 ? (I < 0 ? -1 : 1) : value < 0 ? (I < 0 ? 1 : -1) : 0;
  return { ink, margin: Math.min(Math.abs(value), Math.abs(A), Math.abs(I)), G, A, S, I };
}

/**
 * Does this layer, on its own, draw anything?  A shape whose motion repeats
 * every half loop coincides with its own colour-swapped copy, and so does a
 * round shape parked on a centre; the group forces both to nothing.
 */
export function layerVanishes(layer, group) {
  if (layer.k === 'w') return waveTerms(layer, group, 0.137).length === 0;
  if (layer.role === 'i') return false;
  const solo = { L: [{ ...layer, off: false }] };
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const draws = (frame, X, Y) => {
    const [G, A, S] = componentsAt(frame, X, Y);
    return Math.abs(G) > GLASS || (A > 0 && Math.abs(S) > GLASS);
  };
  for (let a = 0; a < 6; a++) {
    const frame = compileFrame(solo, group, (a + 0.31) / 6);
    for (let b = 0; b < 24; b++) {
      const [X, Y] = toCart(group, [rnd(), rnd()]);
      if (draws(frame, X, Y)) return false;
    }
    // a small stamp covers little of the cell: look where its copies are
    for (const shape of frame.shapes) {
      for (const copy of shape.copies) {
        for (let b = 0; b < 6; b++) {
          const rr = 0.9 * shape.r * copy.scale * Math.sqrt(rnd()), th = TAU * rnd();
          if (draws(frame, copy.ox + rr * Math.cos(th), copy.oy + rr * Math.sin(th))) return false;
        }
      }
    }
  }
  return true;
}

/** The copy under a point, if any: {shape, copy, d, m: lattice translate}. */
export function hitTest(frame, X, Y, tolerance = 0) {
  const group = frame.group;
  let best = null;
  for (const shape of frame.shapes) {
    for (const copy of shape.copies) {
      const dX = X - copy.ox, dY = Y - copy.oy;
      const l0 = group.Pinv[0][0] * dX + group.Pinv[0][1] * dY, l1 = group.Pinv[1][0] * dX + group.Pinv[1][1] * dY;
      const f0 = Math.floor(l0 + 0.5), f1 = Math.floor(l1 + 0.5);
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const d0 = l0 - f0 + i, d1 = l1 - f1 + j;
          const cx = group.P[0][0] * d0 + group.P[0][1] * d1, cy = group.P[1][0] * d0 + group.P[1][1] * d1;
          const d = copyDistance(shape, copy, cx, cy);
          if (d <= tolerance && (!best || d < best.d)) best = { shape, copy, d, m: [f0 - i, f1 - j] };
        }
      }
    }
  }
  return best;
}

// ------------------------------------------------------------------ codec --

export const DESIGN_VERSION = 1;

const round = (x, p = 4) => { const s = 10 ** p; return Math.round(x * s) / s; };

export function normaliseLayer(raw) {
  if (raw.k === 'w') {
    return {
      k: 'w',
      p: [Math.round(raw.p?.[0] ?? 1), Math.round(raw.p?.[1] ?? 0)],
      nu: Math.round(raw.nu ?? 1),
      amp: clamp(Number(raw.amp ?? 0.1), 0, 2),
      ph: mod1(Number(raw.ph ?? 0)),
      ink: raw.ink ? 1 : 0,
      ...(raw.off ? { off: 1 } : {}),
      ...(raw.nm ? { nm: String(raw.nm).slice(0, 40) } : {}),
    };
  }
  const def = shapeDef(raw.sh);
  const pick = (key, fallback) => {
    const spec = def[key];
    const value = Number(raw[key]);
    if (!spec) return Number.isFinite(value) ? value : fallback;
    return clamp(Number.isFinite(value) ? value : spec[2], spec[0], spec[1]);
  };
  const role = raw.role === 's' || raw.role === 'i' ? raw.role : 'f';
  const layer = {
    k: 's', role, ink: raw.ink ? 1 : 0, sh: def.id,
    r: clamp(Number(raw.r ?? 0.12), 0.01, 0.9),
    a: pick('a', 0.5), n: Math.round(pick('n', 5)), q: pick('q', 0),
    h: clamp(Number(raw.h ?? (role === 'f' ? 0.03 : 0.004)), 0.002, 0.3),
    at: [Number(raw.at?.[0] ?? 0.25), Number(raw.at?.[1] ?? 0.25)],
    th: Number(raw.th ?? 0),
    mv: [],
    ...(raw.off ? { off: 1 } : {}),
    ...(raw.nm ? { nm: String(raw.nm).slice(0, 40) } : {}),
  };
  for (const mv of raw.mv || []) {
    const base = MOVES.some((d) => d.id === mv.m) ? newMove(mv.m) : null;
    if (!base) continue;
    const out = { ...base };
    for (const key of Object.keys(base)) {
      if (key === 'm') continue;
      if (key === 'pts') {
        if (Array.isArray(mv.pts) && mv.pts.length) out.pts = mv.pts.slice(0, 24).map((p) => [Number(p[0]) || 0, Number(p[1]) || 0]);
      } else if (Number.isFinite(Number(mv[key]))) out[key] = Number(mv[key]);
    }
    if ('k' in out && out.m !== 's') out.k = Math.round(out.k) || 1;
    if (out.m === 's' && !out.k) out.k = 1;
    layer.mv.push(out);
  }
  return layer;
}

export function normaliseDesign(raw, classId) {
  const layers = Array.isArray(raw?.L) ? raw.L.slice(0, 24).map(normaliseLayer) : [];
  return {
    v: DESIGN_VERSION,
    cls: typeof raw?.cls === 'string' ? raw.cls : classId,
    loop: clamp(Number(raw?.loop ?? 8), 1, 120),
    pal: typeof raw?.pal === 'string' ? raw.pal : 'bw',
    L: layers,
    ...(raw?.nm ? { nm: String(raw.nm).slice(0, 60) } : {}),
  };
}

function roundDeep(value) {
  if (typeof value === 'number') return round(value);
  if (Array.isArray(value)) return value.map(roundDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) if (key !== 'id') out[key] = roundDeep(item);
    return out;
  }
  return value;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) out += B64[c & 63];
  }
  return out;
}

function fromBase64Url(text) {
  const bytes = [];
  let buffer = 0, bits = 0;
  for (const ch of text) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('studio: not a design link');
    buffer = (buffer << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 255); }
  }
  return Uint8Array.from(bytes);
}

/** The whole design as text that is safe in a URL fragment. */
export function encodeDesign(design) {
  const json = JSON.stringify(roundDeep(design));
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeDesign(text, classId) {
  const json = new TextDecoder().decode(fromBase64Url(text));
  return normaliseDesign(JSON.parse(json), classId);
}

/** A short name for a layer that has none of its own. */
export function layerLabel(layer) {
  if (layer.nm) return layer.nm;
  if (layer.k === 'w') return `Wave (${layer.p[0]}, ${layer.p[1]}) × ${layer.nu}`;
  return shapeDef(layer.sh).label;
}
