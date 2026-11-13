// pattern.js — the prints: two-tone patterns of the plane that every element of the group leaves as they are, so they
// are patterns OF THE ORBIFOLD. The plane shows them everywhere, the tile carries its share, and folded up they close
// without a break across every seam. Pure (no DOM, no WebGL): the plane view draws them with fillPrint, the renderer's
// fragment shader evaluates the same formulas per pixel from printUniforms.
//
// Why (13 Nov 2026, the owner: "use the Checkerboard choice … I want more of the surface to be covered with pattern,
// for instance in *x, most of the surface is empty, so it's not obvious how the unfolding is happening. Maybe add a
// selector at the top which allows me to pick different patterns"): one comma leaves most of a shape bare; a print covers
// all of it, shows which side of the paper is up (front teal, back sand) and how the sheet bends. The 22x lab's
// Checkerboard was a square grid on the paper of one tile; here the grid is fitted to the group, so the pieces of a
// re-cut tile (src/folds/recut.js), which are carried by elements of the group, keep the print in register.
//
//   PATTERNS                 [{ key, label, hint }]: 'checker' (the default), 'rings', 'comma' (the one big comma of
//                            src/motif.js on a translucent sheet: no print)
//   DEFAULT_PATTERN          'checker'
//   resolvePattern(raw)      a key of PATTERNS, or null
//   printFor(group, key)     the print of a group, or null for 'comma' / an unknown key. The same object every time.
//   printUniforms(print)     what the renderer's shader needs (render3d.js setStyle({ print }))
//   fillPrint(c, print, map, box, fillStyle)   the DARK tone as canvas paths (even-odd), through any affine map
//   invariantUnder(group, print, samples?)     does every element of the group keep the print? At generic points:
//                                              a coarse sieve (it cannot see a print that is off by a hair)
//   exactlyInvariant(group, print, samples?)   the sharp check: a millionth of a mark either side of the lines where
//                                              the tone changes, every generator must keep the tone
//
// A Print:
//   key, kind          'linear' | 'rings'
//   tone(x, y)         0 (light) | 1 (dark) at the plane point (actual coordinates; the print does not move with Wavy)
//   forms              kind 'linear': three linear forms [lx, ly, o]; with c_k = lx x + ly y + o,
//                          dark  <=>  floor(c_1) + floor(c_2) + floor(c_3) is odd
//                      (a form that is not used is [0, 0, 0]). One form: stripes. Two: checks (rectangles, or
//                      parallelograms on an oblique lattice). Three with c_3 = c_1 + c_2: the triangles of a triangular
//                      grid, alternately light and dark. Three with half offsets: hexagons (light) and triangles (dark),
//                      the pattern of three families of lines that never meet in one point.
//   origin, a, b, inv, width   kind 'rings': dark <=> floor(d / width) is odd, d = the distance to the nearest point of
//                      the lattice origin + i a + j b (a, b a reduced basis with a.b <= 0, so the nearest point of a
//                      point of the cell spanned by a and b is one of its four corners; inv = rows of [a b]^-1)
//   cell               the size of one mark of the print (the side of a check, the width of a ring), in world units
//   name               'checks' | 'triangles' | 'hexagons' | 'stripes' | 'rings'
//
// The checkerboard is FOUND, not tabulated: candidates are grids on the group's own lattice vectors (and, on a
// hexagonal lattice, the triangular grids on it and on its 30-degree refinement, at the group's rotation centres), kept
// when every coset representative and both lattice translations leave the tone unchanged — at a few hundred generic
// points (invariantUnder, a sieve) and then a millionth of a mark either side of the print's own lines
// (exactlyInvariant: a grid laid a hair off the group's centres passes the sieve, not this) — and the one whose marks
// are nearest the wanted size, squarest and most evenly two-toned wins. So a change of a lattice in src/groupdata needs
// no table to be regenerated; test/pattern.test.js checks all 17, and turned, scaled and shifted copies of them.

import { symmetryElements } from './groups.js';

export const PATTERNS = Object.freeze([
  Object.freeze({ key: 'checker', label: 'Checkerboard', hint: 'a print that covers the paper: front teal, back sand' }),
  Object.freeze({ key: 'rings', label: 'Rings', hint: 'bands at equal distance from the cone points, the mirrors or the glide axes' }),
  Object.freeze({ key: 'comma', label: 'Comma', hint: 'one comma per tile on a translucent sheet' }),
]);
export const DEFAULT_PATTERN = 'checker';

/** The key of a pattern from whatever a URL or a person may hold ("Checkerboard", "CHECKER", "rings"); null if none. */
export function resolvePattern(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  for (const p of PATTERNS) if (p.key === s || p.label.toLowerCase() === s) return p.key;
  if (s === 'checkerboard' || s === 'checks' || s === 'check') return 'checker';
  if (s === 'ring' || s === 'bands') return 'rings';
  if (s === 'commas' || s === 'motif') return 'comma';
  return null;
}

/** Marks per tile, roughly: the wanted side of a check is sqrt(domainArea) / CHECKS_ACROSS (the lab used 6). */
export const CHECKS_ACROSS = 6.4;
/** The wanted width of a ring: sqrt(domainArea) / RINGS_ACROSS. */
export const RINGS_ACROSS = 6.5;

const NONE = Object.freeze([0, 0, 0]);
const det2 = (p, q) => p[0] * q[1] - p[1] * q[0];
const len = (p) => Math.hypot(p[0], p[1]);

/** A small deterministic generator (mulberry32). */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Tone
// ---------------------------------------------------------------------------------------------------------------

function linearTone(forms) {
  const [f1, f2, f3] = forms;
  const use2 = f2[0] !== 0 || f2[1] !== 0, use3 = f3[0] !== 0 || f3[1] !== 0;
  return (x, y) => {
    let k = Math.floor(f1[0] * x + f1[1] * y + f1[2]);
    if (use2) k += Math.floor(f2[0] * x + f2[1] * y + f2[2]);
    if (use3) k += Math.floor(f3[0] * x + f3[1] * y + f3[2]);
    return k & 1;
  };
}
/** How close (in units of a mark) the point is to a line where a linear print changes tone. */
function linearMargin(forms, x, y) {
  let m = Infinity;
  for (const f of forms) {
    if (f[0] === 0 && f[1] === 0) continue;
    const c = f[0] * x + f[1] * y + f[2];
    m = Math.min(m, Math.abs(c - Math.round(c)));
  }
  return m;
}

function ringDistance(P, x, y) {
  const dx = x - P.origin[0], dy = y - P.origin[1];
  let s = P.inv[0] * dx + P.inv[1] * dy, t = P.inv[2] * dx + P.inv[3] * dy;
  s -= Math.floor(s); t -= Math.floor(t);
  const qx = s * P.a[0] + t * P.b[0], qy = s * P.a[1] + t * P.b[1];
  return Math.min(Math.hypot(qx, qy), Math.hypot(qx - P.a[0], qy - P.a[1]), Math.hypot(qx - P.b[0], qy - P.b[1]),
    Math.hypot(qx - P.a[0] - P.b[0], qy - P.a[1] - P.b[1]));
}

/**
 * Does every element of the group leave the print as it is? Checked on `samples` generic points (kept away from the
 * lines where the tone changes, so rounding decides nothing), for every coset representative and both lattice
 * translations: these generate the group.
 */
export function invariantUnder(group, print, samples = 240, seed = 7) {
  const rnd = prng(seed), L = Math.max(len(group.e1), len(group.e2));
  const margin = print.kind === 'linear' ? (x, y) => linearMargin(print.forms, x, y)
    : (x, y) => { const c = ringDistance(print, x, y) / print.width; return Math.abs(c - Math.round(c)); };
  const gens = group.reps.slice();
  gens.push({ a: 1, b: 0, c: 0, d: 1, tx: group.e1[0], ty: group.e1[1] }, { a: 1, b: 0, c: 0, d: 1, tx: group.e2[0], ty: group.e2[1] });
  let done = 0;
  for (let i = 0; i < 40 * samples && done < samples; i++) {
    const x = group.center[0] + (2 * rnd() - 1) * 1.7 * L, y = group.center[1] + (2 * rnd() - 1) * 1.7 * L;
    if (margin(x, y) < 0.03) continue;
    const t0 = print.tone(x, y);
    for (const g of gens) {
      const gx = g.a * x + g.b * y + g.tx, gy = g.c * x + g.d * y + g.ty;
      if (margin(gx, gy) < 0.01) continue;
      if (print.tone(gx, gy) !== t0) return false;
    }
    done++;
  }
  return done >= samples / 2;
}

/**
 * The sharp check (invariantUnder keeps away from the lines where the tone changes, so a print that is off by a
 * hundredth of a mark passes it): points a millionth of a mark either side of a tone line — a line of one of the
 * linear forms, away from the others' lines; a circle of the rings, inside its centre's own cell — must keep their
 * tone under every coset representative and both lattice translations. A print the group keeps exactly passes; one
 * that is off by more than a millionth of a mark does not.
 */
export function exactlyInvariant(group, print, samples = 20, seed = 23) {
  const rnd = prng(seed), L = Math.max(len(group.e1), len(group.e2)), EPS = 1e-6;
  const gens = group.reps.slice();
  gens.push({ a: 1, b: 0, c: 0, d: 1, tx: group.e1[0], ty: group.e1[1] }, { a: 1, b: 0, c: 0, d: 1, tx: group.e2[0], ty: group.e2[1] });
  const keeps = (x, y) => {
    const t0 = print.tone(x, y);
    for (const g of gens) if (print.tone(g.a * x + g.b * y + g.tx, g.c * x + g.d * y + g.ty) !== t0) return false;
    return true;
  };
  if (print.kind === 'linear') {
    const forms = print.forms.filter((f) => f[0] !== 0 || f[1] !== 0);
    for (const f of forms) {
      const l2 = f[0] * f[0] + f[1] * f[1], others = forms.filter((o) => o !== f);
      let done = 0;
      for (let i = 0; i < 60 * samples && done < samples; i++) {
        let x = group.center[0] + (2 * rnd() - 1) * 1.5 * L, y = group.center[1] + (2 * rnd() - 1) * 1.5 * L;
        const c = f[0] * x + f[1] * y + f[2], m = Math.round(c);
        x += ((m - c) * f[0]) / l2; y += ((m - c) * f[1]) / l2;          // onto the line c = m
        if (others.length && linearMargin(others, x, y) < 0.02) continue;   // (a corner of a mark: another line is near)
        done++;
        for (const sg of [1, -1]) if (!keeps(x + (sg * EPS * f[0]) / l2, y + (sg * EPS * f[1]) / l2)) return false;
      }
      if (done < samples) return false;
    }
    return true;
  }
  let done = 0;
  for (let i = 0; i < 80 * samples && done < 2 * samples; i++) {
    // a circle of the rings round a centre near the window, at a random bearing, where that centre is the nearest one
    const ci = Math.round((2 * rnd() - 1) * 2), cj = Math.round((2 * rnd() - 1) * 2);
    const cx = print.origin[0] + ci * print.a[0] + cj * print.b[0], cy = print.origin[1] + ci * print.a[1] + cj * print.b[1];
    const k = 1 + Math.floor(rnd() * 4), th = 2 * Math.PI * rnd(), r = k * print.width;
    const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
    if (Math.abs(ringDistance(print, x, y) - r) > 1e-9 * print.width) continue;        // (another centre is nearer)
    // ... and not at the rim of the cell, where a hair further out another centre takes over
    if (Math.abs(ringDistance(print, cx + (r + 0.02 * print.width) * Math.cos(th), cy + (r + 0.02 * print.width) * Math.sin(th)) - (r + 0.02 * print.width)) > 1e-9 * print.width) continue;
    done++;
    for (const sg of [1, -1]) { const q = r + sg * EPS * print.width; if (!keeps(cx + q * Math.cos(th), cy + q * Math.sin(th))) return false; }
  }
  return done >= samples;
}

// ---------------------------------------------------------------------------------------------------------------
// The checkerboard: found on the group's own lattice
// ---------------------------------------------------------------------------------------------------------------

function isHexagonal(group) {
  // a rotation of order 3 or 6 among the coset representatives
  return group.reps.some((r) => Math.abs(r.a + 0.5) < 1e-6 && Math.abs(Math.abs(r.b) - Math.sqrt(3) / 2) < 1e-6 && r.a * r.d - r.b * r.c > 0);
}

/** The forms of a grid of parallelograms: sides p / n1 and q / n2 from the point O, offsets o1, o2 (0 or 1/2). */
function gridForms(p, q, O, n1, n2, o1, o2) {
  const d = det2(p, q);
  // x - O = s p + t q:   s = ((x - O) x q) / d,   t = (p x (x - O)) / d
  const f1 = [(n1 * q[1]) / d, (-n1 * q[0]) / d, 0], f2 = [(-n2 * p[1]) / d, (n2 * p[0]) / d, 0];
  f1[2] = o1 - (f1[0] * O[0] + f1[1] * O[1]);
  f2[2] = o2 - (f2[0] * O[0] + f2[1] * O[1]);
  return [f1, f2];
}

function makeLinear(key, name, forms, cell, info) {
  const F = [forms[0] || NONE, forms[1] || NONE, forms[2] || NONE].map((f) => Object.freeze(f.slice()));
  return Object.freeze({ key, kind: 'linear', name, forms: Object.freeze(F), tone: linearTone(F), cell, info: Object.freeze(info || {}) });
}

/** Short lattice vectors, one of each pair +-v, shortest first. */
function shortVectors(group, R = 2) {
  const out = [];
  for (let m = -R; m <= R; m++) for (let n = -R; n <= R; n++) {
    if (!m && !n) continue;
    if (m < 0 || (m === 0 && n < 0)) continue;
    const g = Math.abs(gcd(m, n));
    if (g !== 1) continue;
    out.push([m * group.e1[0] + n * group.e2[0], m * group.e1[1] + n * group.e2[1]]);
  }
  return out.sort((u, v) => len(u) - len(v));
}
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }

/** The centres of rotation of the group near its window's centre, highest order first (one per lattice class). */
function centresOf(group) {
  const L = len(group.e1) + len(group.e2);
  const sym = symmetryElements(group, group.center[0], group.center[1], 1.2 * L);
  const cs = sym.centers.slice().sort((p, q) => q.order - p.order || Math.hypot(p.x - group.center[0], p.y - group.center[1]) - Math.hypot(q.x - group.center[0], q.y - group.center[1]));
  return { centers: cs, mirrors: sym.mirrors, glides: sym.glides };
}

function findChecker(group) {
  const s0 = Math.sqrt(group.domainArea) / CHECKS_ACROSS;
  const sym = centresOf(group);
  // the points a grid may be laid from: the origin, the rotation centres, a point of a mirror or of a glide axis
  const origins = [[0, 0]];
  for (const c of sym.centers.slice(0, 8)) origins.push([c.x, c.y]);
  for (const m of sym.mirrors.slice(0, 2)) origins.push([m.px, m.py]);
  for (const m of sym.glides.slice(0, 2)) origins.push([m.px, m.py]);
  let best = null;
  const offer = (print, score) => {
    if (best && score >= best.score - 1e-9) return;
    if (!invariantUnder(group, print, 160) || !exactlyInvariant(group, print)) return;
    best = { print, score };
  };

  if (isHexagonal(group)) {
    // 60-degree bases of the lattice and of its refinement by sqrt(3), turned 30 degrees
    let p = group.e1, q = group.e2;
    if (p[0] * q[0] + p[1] * q[1] < 0) q = [p[0] + q[0], p[1] + q[1]];
    const bases = [[p, q], [[(2 * p[0] - q[0]) / 3, (2 * p[1] - q[1]) / 3], [(p[0] + q[0]) / 3, (p[1] + q[1]) / 3]]];
    for (const [u, v] of bases) {
      for (let n = 1; n <= 14; n++) {
        const side = len(u) / n;
        for (const O of origins) {
          // triangles, alternately light and dark: a triangle of side `side` has the area of a square of side 0.658 side
          {
            const [f1, f2] = gridForms(u, v, O, n, n, 0, 0);
            const f3 = [f1[0] + f2[0], f1[1] + f2[1], f1[2] + f2[2]];
            const e = Math.log((0.658 * side) / s0);
            offer(makeLinear('checker', 'triangles', [f1, f2, f3], side, { n, origin: O }), e * e);
          }
          // hexagons and triangles: three marks per cell of area (sqrt 3 / 2) side^2; never preferred to plain triangles
          {
            const [f1, f2] = gridForms(u, v, O, n, n, 0.5, 0.5);
            const f3 = [f1[0] + f2[0], f1[1] + f2[1], f1[2] + f2[2] - 0.5];
            const e = Math.log((0.537 * side) / s0);
            offer(makeLinear('checker', 'hexagons', [f1, f2, f3], side, { n, origin: O }), e * e + 0.35);
          }
        }
      }
    }
    if (best) return best.print;
  }

  const vecs = shortVectors(group).slice(0, 8);
  for (let i = 0; i < vecs.length; i++) {
    for (let j = i + 1; j < vecs.length; j++) {
      const p = vecs[i], q = vecs[j], d = det2(p, q);
      if (Math.abs(d) < 1e-9) continue;
      const cos = Math.abs(p[0] * q[0] + p[1] * q[1]) / (len(p) * len(q));
      // the sides of a check are p / n1 and q / n2; its widths across are what count when it leans
      const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
      for (let n1 = 1; n1 <= 16; n1++) {
        const a1 = (len(p) / n1) * sin, e1 = Math.log(a1 / s0);
        if (Math.abs(e1) > 0.9) continue;
        for (let n2 = 1; n2 <= 16; n2++) {
          const a2 = (len(q) / n2) * sin, e2 = Math.log(a2 / s0);
          if (Math.abs(e2) > 0.9) continue;
          const ea = Math.log(a1 / a2);
          // the size, the squareness and the right angle of a check; and the grid should run along the lattice's own
          // shortest vectors (k = how many lattice cells the pair spans: 1 for a basis; 2 for the rectangle of a centred
          // lattice, which beats its rhombus; more is a grid that runs askew to the tile's sides)
          const k = Math.round(Math.abs(d) / group.cellArea);
          const score = e1 * e1 + e2 * e2 + 1.5 * ea * ea + 12 * cos * cos + (k <= 1 ? 0 : 0.5 + 0.6 * (k - 2));
          if (best && score >= best.score - 1e-9) continue;
          for (const O of origins) {
            for (const o1 of [0, 0.5]) for (const o2 of [0, 0.5]) {
              offer(makeLinear('checker', 'checks', gridForms(p, q, O, n1, n2, o1, o2), Math.sqrt(a1 * a2), { n: [n1, n2], origin: O }), score);
            }
          }
        }
      }
    }
  }
  return best ? best.print : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Rings: bands at equal distance from the group's most special points (or lines)
// ---------------------------------------------------------------------------------------------------------------

/** Gauss reduction: the two shortest independent vectors of the lattice spanned by a and b, with a.b <= 0. */
function reduceBasis(a, b) {
  let u = a.slice(), v = b.slice();
  for (let it = 0; it < 64; it++) {
    if (len(u) > len(v)) { const t = u; u = v; v = t; }
    const m = Math.round((u[0] * v[0] + u[1] * v[1]) / (u[0] * u[0] + u[1] * u[1]));
    if (!m) break;
    v = [v[0] - m * u[0], v[1] - m * u[1]];
  }
  if (u[0] * v[0] + u[1] * v[1] > 0) v = [-v[0], -v[1]];
  return [u, v];
}

function makeRings(origin, a, b, width, info) {
  const d = det2(a, b);
  const P = { key: 'rings', kind: 'rings', name: 'rings', origin: Object.freeze(origin.slice()), a: Object.freeze(a.slice()), b: Object.freeze(b.slice()),
    inv: Object.freeze([b[1] / d, -b[0] / d, -a[1] / d, a[0] / d]), width, cell: width, info: Object.freeze(info || {}) };
  P.tone = (x, y) => Math.floor(ringDistance(P, x, y) / width) & 1;
  return Object.freeze(P);
}

function findRings(group) {
  const size = Math.sqrt(group.domainArea), w0 = size / RINGS_ACROSS;
  const sym = centresOf(group);
  if (sym.centers.length) {
    // the centres of the highest order: a lattice (a coset of one)
    const top = sym.centers[0].order, cs = sym.centers.filter((c) => c.order === top);
    const O = [cs[0].x, cs[0].y];
    const diffs = cs.slice(1).map((c) => [c.x - O[0], c.y - O[1]]).sort((u, v) => len(u) - len(v));
    let a = diffs[0], b = null;
    for (const v of diffs) if (Math.abs(det2(a, v)) > 1e-6 * len(a) * len(v)) { b = v; break; }
    if (a && b) {
      [a, b] = reduceBasis(a, b);
      // the rings of neighbouring centres meet half way: a whole number of rings fits there when it is not far off
      const half = len(a) / 2, k = Math.max(1, Math.round(half / w0));
      const width = Math.abs(half / k - w0) < 0.3 * w0 ? half / k : w0;
      const P = makeRings(O, a, b, width, { order: top, centres: cs.length });
      if (invariantUnder(group, P, 160) && exactlyInvariant(group, P)) return P;
    }
  }
  // no rotations: bands along the mirrors, else along the glide axes, else along the first lattice vector
  const lines = sym.mirrors.length ? sym.mirrors : sym.glides;
  let best = null;
  const offer = (forms, cell, score, info) => {
    if (best && score >= best.score) return;
    const P = makeLinear('rings', 'stripes', forms, cell, info);
    if (invariantUnder(group, P, 160) && exactlyInvariant(group, P)) best = { print: P, score };
  };
  if (lines.length) {
    const m = lines[0], nx = -m.uy, ny = m.ux, off = m.px * nx + m.py * ny;
    // the spacing of the family of lines parallel to this one
    let h = Infinity;
    for (const o of lines) {
      if (Math.abs(o.ux * m.uy - o.uy * m.ux) > 1e-6) continue;
      const d = Math.abs(o.px * nx + o.py * ny - off);
      if (d > 1e-6 && d < h) h = d;
    }
    if (h < Infinity) {
      for (let N = 2; N <= 24; N += 2) {
        const e = Math.log(h / N / w0);
        offer([[(N * nx) / h, (N * ny) / h, 0.5 - (N * off) / h]], h / N, e * e, { lines: sym.mirrors.length ? 'mirrors' : 'glide axes', N });
      }
    }
  }
  if (!best) {
    const p = group.e1, q = group.e2;
    for (let N = 2; N <= 24; N += 2) {
      const [, f2] = gridForms(p, q, [0, 0], 1, N, 0, 0.5);
      const cell = Math.abs(det2(p, q)) / len(p) / N, e = Math.log(cell / w0);
      offer([f2], cell, e * e, { lines: 'lattice', N });
    }
  }
  return best ? best.print : null;
}

// ---------------------------------------------------------------------------------------------------------------

const cache = new WeakMap();
/** The print `key` of a group ('checker' | 'rings'); null for 'comma' or an unknown key. Cached per group. */
export function printFor(group, key) {
  const k = resolvePattern(key);
  if (!group || !k || k === 'comma') return null;
  let m = cache.get(group);
  if (!m) { m = {}; cache.set(group, m); }
  if (!(k in m)) m[k] = (k === 'checker' ? findChecker(group) : findRings(group)) || null;
  return m[k];
}

/**
 * What the renderer's fragment shader needs (render3d.js): { mode: 1 | 2, L: Float32Array(9), A: Float32Array(4),
 * I: Float32Array(4), O: Float32Array(3) }. mode 1: L holds the three forms (a form that is not used is [0, 0, 0.5]: its
 * factor is then 1). mode 2: A = (a, b), I = the rows of [a b]^-1, O = (origin, 1 / width).
 */
export function printUniforms(print) {
  const L = new Float32Array(9), A = new Float32Array(4), I = new Float32Array(4), O = new Float32Array(3);
  if (!print) return { mode: 0, L, A, I, O };
  if (print.kind === 'linear') {
    print.forms.forEach((f, k) => { const used = f[0] !== 0 || f[1] !== 0; L[3 * k] = f[0]; L[3 * k + 1] = f[1]; L[3 * k + 2] = used ? f[2] : 0.5; });
    return { mode: 1, L, A, I, O };
  }
  A.set([print.a[0], print.a[1], print.b[0], print.b[1]]); I.set(print.inv);
  O.set([print.origin[0], print.origin[1], 1 / print.width]);
  return { mode: 2, L, A, I, O };
}

// ---------------------------------------------------------------------------------------------------------------
// Canvas: the dark tone, through any affine map
// ---------------------------------------------------------------------------------------------------------------

const RING_SEGMENTS = 56;

/**
 * Fill the DARK tone of the print over the world box [x0, y0, x1, y1] on the 2D context `c`, in `fillStyle`.
 *   map(x, y, out) -> out   world point -> canvas point; any affine map (the plane's window; a card of the replication
 *                           on its way, which also turns and flips), so the box is given in the print's own coordinates
 * The caller clips (to the pane, to a tile). Linear prints: every band of every family in one path, filled by the
 * even-odd rule (a point is dark when it lies in an odd number of bands). Rings: the rings of each centre, clipped to
 * that centre's own cell of the plane (the points nearer to it than to any other centre).
 */
export function fillPrint(c, print, map, box, fillStyle) {
  if (!print) return;
  const o = [0, 0];
  const moveTo = (x, y) => { map(x, y, o); c.moveTo(o[0], o[1]); }, lineTo = (x, y) => { map(x, y, o); c.lineTo(o[0], o[1]); };
  const [x0, y0, x1, y1] = box, R = Math.hypot(x1 - x0, y1 - y0) + 1e-9, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  c.fillStyle = fillStyle;
  if (print.kind === 'linear') {
    c.beginPath();
    for (const f of print.forms) {
      const l2 = f[0] * f[0] + f[1] * f[1];
      if (!(l2 > 0)) continue;
      const l = Math.sqrt(l2), tx = -f[1] / l, ty = f[0] / l;        // along the bands
      const cm = f[0] * mx + f[1] * my + f[2], reach = (R / 2) * l;   // the form at the box's middle, and how far it ranges
      // the foot of the box's middle on the line c = m:  (mx, my) + (m - cm) (lx, ly) / l^2
      const quad = (m) => {
        const ax = mx + ((m - cm) * f[0]) / l2, ay = my + ((m - cm) * f[1]) / l2;
        const bx = mx + ((m + 1 - cm) * f[0]) / l2, by = my + ((m + 1 - cm) * f[1]) / l2;
        moveTo(ax - R * tx, ay - R * ty); lineTo(ax + R * tx, ay + R * ty); lineTo(bx + R * tx, by + R * ty); lineTo(bx - R * tx, by - R * ty);
        c.closePath();
      };
      const lo = Math.floor(cm - reach) - 1, hi = Math.ceil(cm + reach) + 1;
      for (let m = lo; m <= hi; m++) if (m & 1) quad(m);
    }
    c.fill('evenodd');
    return;
  }
  // rings: the cell of a centre is the hexagon cut out by the bisectors of +-a, +-b, +-(a + b)
  const { a, b, origin, width } = print;
  const nb = [a, b, [a[0] + b[0], a[1] + b[1]]];
  const cellPoly = [];
  {
    // clip a large square by the six half-planes  v.x <= |v|^2 / 2
    const S = 2 * (len(a) + len(b));
    let poly = [[-S, -S], [S, -S], [S, S], [-S, S]];
    for (const v0 of nb) for (const sg of [1, -1]) {
      const v = [sg * v0[0], sg * v0[1]], lim = (v[0] * v[0] + v[1] * v[1]) / 2, next = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const sp = v[0] * p[0] + v[1] * p[1] - lim, sq = v[0] * q[0] + v[1] * q[1] - lim;
        if (sp <= 0) next.push(p);
        if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) { const u = sp / (sp - sq); next.push([p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1])]); }
      }
      poly = next;
    }
    for (const p of poly) cellPoly.push(p);
  }
  let rMax = 0;
  for (const p of cellPoly) rMax = Math.max(rMax, len(p));
  let kMax = Math.ceil(rMax / width) + 1;
  if (kMax & 1) kMax++;                              // an even number of circles: inside the innermost one is light
  // the centres whose cells can touch the box
  const d = det2(a, b);
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [((x - origin[0]) * b[1] - (y - origin[1]) * b[0]) / d, (a[0] * (y - origin[1]) - a[1] * (x - origin[0])) / d]);
  const i0 = Math.floor(Math.min(...corners.map((p) => p[0]))) - 1, i1 = Math.ceil(Math.max(...corners.map((p) => p[0]))) + 1;
  const j0 = Math.floor(Math.min(...corners.map((p) => p[1]))) - 1, j1 = Math.ceil(Math.max(...corners.map((p) => p[1]))) + 1;
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const cx = origin[0] + i * a[0] + j * b[0], cy = origin[1] + i * a[1] + j * b[1];
    if (cx < x0 - rMax || cx > x1 + rMax || cy < y0 - rMax || cy > y1 + rMax) continue;
    c.save();
    c.beginPath();
    cellPoly.forEach((p, k) => (k ? lineTo(cx + p[0], cy + p[1]) : moveTo(cx + p[0], cy + p[1])));
    c.closePath();
    c.clip();
    c.beginPath();
    for (let k = 1; k <= kMax; k++) {
      const r = k * width;
      for (let s = 0; s < RING_SEGMENTS; s++) {
        const th = (2 * Math.PI * s) / RING_SEGMENTS, x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
        if (s) lineTo(x, y); else moveTo(x, y);
      }
      c.closePath();
    }
    c.fill('evenodd');
    c.restore();
  }
}
