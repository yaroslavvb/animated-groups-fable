// surfaces.js — the seven example surfaces of pp. 104-106, each as patches for complex.js.
//
// Only shapes are written down here: where the paper is. How many vertices, edges, faces and boundaries a surface
// has, and how many sides, is counted on the welded map (complex.js), never typed in. Each entry:
//   label      what the chip and the badge call it before it has been named
//   name       the book's plain name for its tidy form (pp. 105-106), shown beside the computed symbol
//   patches()  the charts; world units, the plane of a flat piece is z = 0, +z is up
//   front      +1: patch 0 shows its front where da x db points
//   loop(cx)   the faces the pinwheel visits on a two-sided surface (a one-sided one finds its own: reversingLoop)
//   mark       the pinwheel's radius; view, frame: how the stage looks at it
//
// A chart must be defined a little beyond its patch as well (the pinwheel's sails are laid on the surface with it).

import { smoother } from '../geo/vec.js';
import { buildComplex, analyse, tidyForm, paint, reversingLoop, loopThrough, loopReverses, faceId } from './complex.js';

const TAU = 2 * Math.PI, DEG = Math.PI / 180;
const breaks = (n, from = 0, span = TAU) => Array.from({ length: n + 1 }, (_, i) => from + (span * i) / n);
const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
const wrap = (x, n) => ((x % n) + n) % n;

// ---------------------------------------------------------------------------------------------------------------
// Disk: six slices of a pie. The slices' inner sides are all the one point in the middle.
function disk() {
  return [{ name: 'disc', f: (r, th) => [r * Math.cos(th), r * Math.sin(th), 0], as: [0, 1], bs: breaks(6, -120 * DEG), sub: [5, 12] }];
}

// Annulus, drawn as the book draws it: a short wide band, like a ring for a finger.
const BAND_R = 1, BAND_W = 0.3;
function annulus() {
  return [{ name: 'band', f: (u, w) => [BAND_R * Math.cos(u), BAND_R * Math.sin(u), w], as: breaks(8, -112.5 * DEG), bs: [-BAND_W, BAND_W], sub: [6, 4] }];
}

// Torus.
const TORUS_R = 0.82, TORUS_r = 0.38;
function torus() {
  const f = (u, v) => { const d = TORUS_R + TORUS_r * Math.cos(v); return [d * Math.cos(u), d * Math.sin(u), TORUS_r * Math.sin(v)]; };
  return [{ name: 'torus', f, as: breaks(6, -120 * DEG), bs: breaks(3, 30 * DEG), sub: [8, 10] }];
}

// Moebius band: the same ring as the annulus, with a half twist on its left. Going once round turns the band's
// cross direction over (angle + pi), so f(u + 2 pi, w) = f(u, -w): the chart closes up on itself reversed.
const TWIST_FROM = 95 * DEG, TWIST_SPAN = 170 * DEG;
function mobius() {
  const f = (u, w) => {
    const x = u - TWIST_FROM, k = Math.floor(x / TAU), th = Math.PI / 2 + Math.PI * (k + smoother((x - k * TAU) / TWIST_SPAN));
    const d = BAND_R + w * Math.cos(th);
    return [d * Math.cos(u), d * Math.sin(u), w * Math.sin(th)];
  };
  return [{ name: 'band', f, as: breaks(8, -112.5 * DEG), bs: [-BAND_W, BAND_W], sub: [8, 4] }];
}

// ---------------------------------------------------------------------------------------------------------------
// Klein bottle, the classic one: a tube of circles. Station k says where a circle's centre is (x, z in the plane of
// the picture) and its radius; a Catmull-Rom spline runs through the stations. Up the body (0-3), over the neck
// (4-7), in through the wall (8-10), down inside (11-12), and round the lip (13) back to station 0, where the tube
// arrives from the INSIDE: its circles have turned by half a turn on the way (the direction `dir` below), so
// f(t + n, v) = f(t, pi - v). That is the one place where the bottle's front has to meet its back.
const KLEIN = [
  [0, 0, 0.5], [0, 0.5, 0.6], [0, 1, 0.47], [0, 1.45, 0.25], [0.12, 1.87, 0.21], [0.5, 2.13, 0.2], [0.9, 1.85, 0.2],
  [1.01, 1.4, 0.2], [0.87, 0.98, 0.2], [0.5, 0.7, 0.205], [0.16, 0.46, 0.215], [0, 0.2, 0.24], [0, 0, 0.27], [0, -0.115, 0.385],
];
const KLEIN_SCALE = 0.86, KLEIN_SHIFT = [-0.3, 0, -1.08];
function kleinChart() {
  const n = KLEIN.length, st = (k) => KLEIN[wrap(k, n)];
  // the direction each circle faces, as an angle in the picture plane: along the centre line, except on the lip,
  // where the centre only dips and comes back while the circle keeps facing down and grows
  const dir = [];
  for (let k = 0; k < n; k++) {
    let a = k >= 12 ? -Math.PI / 2 : Math.atan2(st(k + 1)[1] - st(k - 1)[1], st(k + 1)[0] - st(k - 1)[0]);
    if (k > 0) while (a - dir[k - 1] > Math.PI) a -= TAU;
    if (k > 0) while (a - dir[k - 1] < -Math.PI) a += TAU;
    dir.push(a);
  }
  const ang = (k) => dir[wrap(k, n)] - Math.PI * Math.floor(k / n);        // half a turn less per lap
  const spline = (p0, p1, p2, p3, u) => 0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u);
  const f = (t, v) => {
    const k = Math.floor(t), u = t - k, at = (c) => spline(st(k - 1)[c], st(k)[c], st(k + 1)[c], st(k + 2)[c], u);
    const x = at(0), z = at(1), rad = at(2), al = spline(ang(k - 1), ang(k), ang(k + 1), ang(k + 2), u);
    const c = rad * Math.cos(v), s = rad * Math.sin(v);                    // the circle: c along its in-plane normal, s toward the eye
    return [KLEIN_SCALE * (x + c * Math.sin(al) + KLEIN_SHIFT[0]), KLEIN_SCALE * -s, KLEIN_SCALE * (z - c * Math.cos(al) + KLEIN_SHIFT[2])];
  };
  return { f, n };
}
function klein() {
  const { f, n } = kleinChart();
  // eight rings of faces, equally long along the line that faces the eye (v = 90 degrees)
  const N = 1400, acc = [0];
  for (let i = 1; i <= N; i++) { const p = f((n * (i - 1)) / N, Math.PI / 2), q = f((n * i) / N, Math.PI / 2); acc.push(acc[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])); }
  const as = [0];
  for (let c = 1, i = 0; c < 8; c++) { while (acc[i] < (acc[N] * c) / 8) i++; as.push((n * i) / N); }
  as.push(n);
  return [{ name: 'tube', f, as, bs: breaks(3, 30 * DEG), sub: [8, 10] }];
}

// ---------------------------------------------------------------------------------------------------------------
// "This strange-looking surface" (p. 106): an oval with two holes side by side, and a half twist in the strip of
// paper between them. Laid flat it would be an oval with two round holes; the twist joins their rims into one
// figure-eight. Patches: the oval round both holes (six faces, cut straight across the strip's two ends), the strip.
const OVAL = [1.3, 0.97], LOBE = { c: 0.47, p: 0.33, q: 0.42, cut: 55 * DEG }, OVAL_BETA = 21 * DEG;
function punched() {
  const { c, p, q, cut } = LOBE, xc = c - p * Math.cos(cut), yc = q * Math.sin(cut);
  const right = (ph) => [c + p * Math.cos(ph), q * Math.sin(ph), 0], left = (ph) => [-c + p * Math.cos(ph), q * Math.sin(ph), 0];
  const along = (g, from, to) => (u) => g(from + (to - from) * u), line = (P, Q) => (u) => mix(P, Q, u);
  const inner = [
    along(right, 0, Math.PI - cut), line([xc, yc, 0], [-xc, yc, 0]), along(left, cut, Math.PI),
    along(left, Math.PI, TAU - cut), line([-xc, -yc, 0], [xc, -yc, 0]), along(right, Math.PI + cut, TAU),
  ];
  const outerAt = [0, 90 * DEG - OVAL_BETA, 90 * DEG + OVAL_BETA, Math.PI, 270 * DEG - OVAL_BETA, 270 * DEG + OVAL_BETA, TAU];
  const oval = (t, b) => {
    const bb = wrap(b, 6), k = Math.min(5, Math.floor(bb)), u = bb - k, th = outerAt[k] + (outerAt[k + 1] - outerAt[k]) * u;
    return mix(inner[k](u), [OVAL[0] * Math.cos(th), OVAL[1] * Math.sin(th), 0], t);
  };
  const strip = (w, s) => {
    const y = (2 * s - 1) * yc, half = c - p * Math.sqrt(Math.max(0, 1 - (y * y) / (q * q))), th = Math.PI * smoother(s);
    return [w * half * Math.cos(th), y, w * half * Math.sin(th)];
  };
  return [
    { name: 'oval', f: oval, as: [0, 1], bs: breaks(6, 0, 6), sub: [5, 10] },
    { name: 'strip', f: strip, as: [-1, 1], bs: [0, 1], sub: [10, 16] },
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// "The following strange surface" (p. 104): a round sheet with three holes, and a half twist in each of the three
// strips of paper between neighbouring holes, all three twisted the same way. A hole is an oval bent round the
// centre: at the angle th(tau) = spread * sin(tau) from its axis, at the distance mid + deep * cos(tau).
// Patches: the outside (six faces: across a strip's outer end, round the outside of a hole, ...), the middle (six
// slices: a strip's inner end, the inside of a hole, ...), and the three strips.
const HOLES = { mid: 0.5, deep: 0.25, spread: 46 * DEG, inner: 140 * DEG }, STRIP_AT = [30 * DEG, 150 * DEG, 270 * DEG];
// A strip's outer end is cut where its two sides (the rims of the two holes beside it) are farthest out along the
// strip, plus a hair: any further round the holes and the strip's chart would fold back over itself.
HOLES.outer = (() => {
  const out = (tau) => (HOLES.mid + HOLES.deep * Math.cos(tau)) * Math.cos(60 * DEG - HOLES.spread * Math.sin(tau));
  let best = 90 * DEG;
  for (let tau = 90 * DEG; tau > 0; tau -= 0.05 * DEG) if (out(tau) > out(best)) best = tau;
  return best + 3 * DEG;
})();
function strange() {
  const H = HOLES, polar = (r, a) => [r * Math.cos(a), r * Math.sin(a), 0];
  const hole = (axis, tau) => polar(H.mid + H.deep * Math.cos(tau), axis + H.spread * Math.sin(tau));
  // one strip end as [across the strip (u = 0 .. 1, a straight cut), round the next hole (u = 0 .. 1)]
  const pieces = (tau, outside) => STRIP_AT.flatMap((at) => {
    const A = hole(at - 60 * DEG, tau), B = hole(at + 60 * DEG, -tau);
    return [(u) => mix(A, B, u), outside ? (u) => hole(at + 60 * DEG, -tau + 2 * tau * u) : (u) => hole(at + 60 * DEG, TAU - tau - (TAU - 2 * tau) * u)];
  });
  const rimOut = pieces(H.outer, true), rimIn = pieces(H.inner, false);
  const piece = (rim, b) => { const bb = wrap(b, 6), k = Math.min(5, Math.floor(bb)); return rim[k](bb - k); };
  const outside = (t, b) => { const p = piece(rimOut, b), a = Math.atan2(p[1], p[0]); return mix(p, [Math.cos(a), Math.sin(a), 0], t); };
  const middle = (t, b) => { const p = piece(rimIn, b); return [p[0] * t, p[1] * t, 0]; };
  const strip = (at) => (s, w) => {
    const tau = H.inner + (H.outer - H.inner) * s, rho = H.mid + H.deep * Math.cos(tau), off = 60 * DEG - H.spread * Math.sin(tau);
    const r = rho * Math.cos(off), h = w * rho * Math.sin(off), th = Math.PI * smoother(s), c = Math.cos(at), sn = Math.sin(at);
    return [r * c - h * Math.cos(th) * sn, r * sn + h * Math.cos(th) * c, h * Math.sin(th)];
  };
  return [
    { name: 'outside', f: outside, as: [0, 1], bs: breaks(6, 0, 6), sub: [4, 10] },
    { name: 'middle', f: middle, as: [0, 1], bs: breaks(6, 0, 6), sub: [3, 10] },
    ...STRIP_AT.map((at, m) => ({ name: 'strip ' + (m + 1), f: strip(at), as: [0, 1], bs: [-1, 1], sub: [16, 10] })),
  ];
}

// ---------------------------------------------------------------------------------------------------------------

const row = (cx, p, n) => Array.from({ length: n }, (_, k) => (cx.patches[p].as.length > 2 ? faceId(cx, p, k, 0) : faceId(cx, p, 0, k)));

export const SURFACES = {
  disk: {
    label: 'Disk', name: 'a punched sphere', patches: disk, front: 1, mark: 0.17,
    loop: (cx) => row(cx, 0, 6), view: { az: -14, el: 52 }, frame: { center: [0, 0, 0], radius: 1.12 },
  },
  annulus: {
    label: 'Annulus', name: 'a twice-punched sphere', patches: annulus, front: 1, mark: 0.17,
    loop: (cx) => row(cx, 0, 8), view: { az: -16, el: 30 }, frame: { center: [0, 0, 0], radius: 1.14 },
  },
  torus: {
    label: 'Torus', name: 'a sphere with a handle', patches: torus, front: 1, mark: 0.15,
    loop: (cx) => row(cx, 0, 6), view: { az: -16, el: 44 }, frame: { center: [0, 0, 0], radius: 1.3 },
  },
  mobius: {
    label: 'Möbius band', name: 'a punched crosscap', patches: mobius, front: 1, mark: 0.17,
    view: { az: -50, el: 35 }, frame: { center: [0, 0, 0], radius: 1.2 },
  },
  klein: {
    label: 'Klein bottle', name: 'a pair of crosscaps', patches: klein, front: 1, mark: 0.11,
    view: { az: -28, el: -20 }, frame: { center: [0, 0, 0], radius: 1.32 },
  },
  punched: {
    label: 'Figure-eight hole', name: 'a punched Möbius band', patches: punched, front: 1, mark: 0.13,
    view: { az: -8, el: 64 }, frame: { center: [0, 0, 0], radius: 1.34 },
  },
  strange: {
    label: 'The strange surface', name: 'a twice-punched torus', patches: strange, front: 1, mark: 0.1,
    // from the outside over the top hole, down one strip, across the middle, back up the next strip
    loop: (cx) => [faceId(cx, 0, 0, 1), faceId(cx, 0, 0, 2), faceId(cx, 3, 0, 0), faceId(cx, 1, 0, 2), faceId(cx, 1, 0, 1), faceId(cx, 1, 0, 0), faceId(cx, 2, 0, 0), faceId(cx, 0, 0, 0)],
    view: { az: -10, el: 58 }, frame: { center: [0, 0, 0], radius: 1.12 },
  },
};

/** The chips' order: the familiar ones first, the book's two puzzles last (it asks about the strange one first). */
export const ORDER = ['disk', 'annulus', 'torus', 'mobius', 'klein', 'punched', 'strange'];

const cache = new Map();

/**
 * Everything counted for one surface: its map, the three numbers, the tidy form they name, how it is painted, and
 * the loop of faces the pinwheel is carried round.
 */
export function measure(key) {
  if (cache.has(key)) return cache.get(key);
  const S = SURFACES[key];
  if (!S) throw new Error('no such surface: ' + key);
  const cx = buildComplex(S.patches()), numbers = analyse(cx), counts = tidyForm(numbers), paintJob = paint(cx, S.front);
  const loop = numbers.orientable ? loopThrough(cx, S.loop(cx)) : reversingLoop(cx);
  const out = { key, def: S, cx, ...numbers, counts, paint: paintJob, loop, loopReverses: loopReverses(cx, loop) };
  cache.set(key, out);
  return out;
}
