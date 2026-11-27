// pinwheel.js — the book's test for sides (p. 101): carry a pinwheel round a loop of the surface and look at how
// it comes back. "No matter what journey the pinwheel makes on a torus, it always returns in the same orientation";
// taken once through a crosscap "it returns in the other orientation".
//
//   loopPath(cx, loop)   -> the journey: a closed curve through the loop's faces (complex.js: [{ face, kin, kout }]),
//                           from the middle of the first face through the middles of the shared edges, with a frame
//                           carried along it
//   pinwheelAt(path, i, size)   -> Float32Array polyline: the pinwheel at sample i (i = path.n: back at the start)
//
// The frame. At every sample e1 is the direction of travel, laid into the tangent plane there, and e2 is the
// direction that was "to the pinwheel's left" one sample earlier, laid into the new tangent plane and squared up
// against e1. Nothing here knows whether the surface has one side or two: the frame is carried by geometry alone.
// Back at the start e1 is what it was; e2 is either what it was or its opposite (path.turned = +1 or -1), and the
// pinwheel drawn with it is either the one that set out or its mirror image.

import { chartAt, sideAt, chartNormal } from './complex.js';
import { sub, cross, norm, dot, scale, add } from '../geo/vec.js';

// Samples lie this far apart along the journey (world units; the surfaces are about 2 across). The direction of
// travel at a sample is read from the samples LOOK steps behind and ahead, so that where the journey turns a corner
// (it does at some shared edges) the pinwheel turns over a short stretch, not in one jump.
const STEP = 0.008, LOOK = 5;

/** Lay the vector v into the plane with unit normal n. */
const flat = (v, n) => { const d = dot(v, n); return [v[0] - d * n[0], v[1] - d * n[1], v[2] - d * n[2]]; };

export function loopPath(cx, loop, step = STEP) {
  const raw = [];
  let half = 0;
  for (const l of loop) {
    const face = cx.faces[l.face], f = cx.patches[face.patch].f, ha = (face.a1 - face.a0) * 1e-3, hb = (face.b1 - face.b0) * 1e-3;
    // through the face: in at the middle of one side, out at the middle of another, bending round the face's middle
    const m0 = sideAt(face, l.kin, 0.5), c = chartAt(face, 0.5, 0.5), m1 = sideAt(face, l.kout, 0.5);
    const curve = (u) => { const w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u; return [w0 * m0[0] + w1 * c[0] + w2 * m1[0], w0 * m0[1] + w1 * c[1] + w2 * m1[1]]; };
    // measure this stretch, then put samples on it at equal distances (a chart can run fast in one place and slow in
    // another, and the pinwheel should not)
    const K = 48, len = [0];
    for (let k = 1, p = f(...curve(0)); k <= K; k++) { const q = f(...curve(k / K)); len.push(len[k - 1] + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])); p = q; }
    const count = Math.max(6, Math.ceil(len[K] / step));
    if (!raw.length) half = Math.floor(count / 2);
    for (let i = 0, k = 0; i < count; i++) {
      const want = (len[K] * i) / count;
      while (k < K - 1 && len[k + 1] < want) k++;
      const [a, b] = curve((k + (want - len[k]) / (len[k + 1] - len[k] || 1)) / K);
      raw.push({ f, a, b, ha, hb, p: f(a, b), n: chartNormal(f, a, b, ha, hb) });
    }
  }
  const S = raw.slice(half).concat(raw.slice(0, half)), n = S.length;   // the journey starts in the middle of the first face
  const e1 = [], e2 = [], at = [0];
  for (let i = 0; i < n; i++) {
    e1.push(norm(flat(sub(S[(i + LOOK) % n].p, S[(i + n - LOOK) % n].p), S[i].n)));
    if (i > 0) { const d = sub(S[i].p, S[i - 1].p); at.push(at[i - 1] + Math.hypot(d[0], d[1], d[2])); }
  }
  const closing = sub(S[0].p, S[n - 1].p), length = at[n - 1] + Math.hypot(closing[0], closing[1], closing[2]);
  const carry = (prev, i) => { const v = flat(prev, S[i].n), d = dot(v, e1[i]); return norm([v[0] - d * e1[i][0], v[1] - d * e1[i][1], v[2] - d * e1[i][2]]); };
  e2.push(norm(cross(S[0].n, e1[0])));
  for (let i = 1; i < n; i++) e2.push(carry(e2[i - 1], i));
  const home = carry(e2[n - 1], 0);                       // once round, laid into the first tangent plane again
  return {
    n, samples: S, e1, e2, home, length, at, turned: dot(home, e2[0]),
    /** The sample reached after the fraction u (0 .. 1) of the journey; u = 1 gives n: home again. */
    index(u) {
      if (u >= 1) return n;
      const want = Math.max(0, u) * length;
      let lo = 0, hi = n - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (at[mid] <= want) lo = mid; else hi = mid - 1; }
      return lo;
    },
  };
}

// The pinwheel, in units of its radius: four sails, each a triangle on one side of its arm, drawn as one line
// through the hub. Every straight piece is cut in three so that it can follow a curved surface.
const SAILS = (() => {
  const pts = [[0, 0]];
  const leg = (q) => { const p = pts[pts.length - 1]; for (let i = 1; i <= 3; i++) pts.push([p[0] + ((q[0] - p[0]) * i) / 3, p[1] + ((q[1] - p[1]) * i) / 3]); };
  for (let k = 0; k < 4; k++) {
    const a = (Math.PI / 2) * k + Math.PI / 4, b = a + (50 * Math.PI) / 180;
    leg([Math.cos(a), Math.sin(a)]); leg([0.6 * Math.cos(b), 0.6 * Math.sin(b)]); leg([0, 0]);
  }
  return pts;
})();

/**
 * Lay q, a point of the tangent plane at the sample s (at most `reach` from it), onto the chart's surface: the
 * nearest point of it, found from (a, b) by a few Gauss-Newton steps. Where that point is far from q the pinwheel
 * stays a flat little wheel instead (the answer slides from the surface point to q itself): in the middle of a
 * half twist the paper turns too fast under it to be followed, and past the end of a strip the chart is no longer
 * the paper at all, which is flat there anyway.
 */
function settle(s, q, reach) {
  let { a, b } = s;
  for (let it = 0; it < 4; it++) {
    const p = s.f(a, b), r = sub(q, p);
    const fa = scale(sub(s.f(a + s.ha, b), s.f(a - s.ha, b)), 0.5 / s.ha), fb = scale(sub(s.f(a, b + s.hb), s.f(a, b - s.hb)), 0.5 / s.hb);
    const A = dot(fa, fa), B = dot(fa, fb), C = dot(fb, fb), det = A * C - B * B;
    if (!(det > 1e-9 * A * C)) break;
    const ra = dot(r, fa), rb = dot(r, fb), lim = 600;      // never further than 0.6 of a face in one step
    a += Math.max(-lim * s.ha, Math.min(lim * s.ha, (C * ra - B * rb) / det));
    b += Math.max(-lim * s.hb, Math.min(lim * s.hb, (A * rb - B * ra) / det));
  }
  const p = s.f(a, b), off = sub(q, p), far = Math.hypot(off[0], off[1], off[2]) / reach;
  const w = Math.min(1, Math.max(0, (far - 0.15) / 0.25));
  return add(p, scale(off, w * w * (3 - 2 * w)));
}

/**
 * The pinwheel at sample i, lying on the surface. i = path.n is the pinwheel home again: at sample 0 with the frame
 * it came back with.
 */
export function pinwheelAt(path, i, size) {
  const back = i >= path.n, s = path.samples[back ? 0 : i], e1 = path.e1[back ? 0 : i], e2 = back ? path.home : path.e2[i];
  const out = new Float32Array(3 * SAILS.length);
  SAILS.forEach(([x, y], j) => {
    const q = add(s.p, add(scale(e1, size * x), scale(e2, size * y)));
    out.set(settle(s, q, size), 3 * j);
  });
  return out;
}

/** The journey as a closed polyline (every `step`-th sample). */
export function pathLine(path, step = 3) {
  const out = [];
  for (let i = 0; i < path.n; i += step) out.push(...path.samples[i].p);
  return Float32Array.from(out);
}
