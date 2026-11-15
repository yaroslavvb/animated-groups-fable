p = 'design.js'
s = open(p).read()
a = s.index("/**\n * The stroke of a group, in its own frame")
b = s.index("// ---- the group's own frame")
new = r'''/**
 * The stroke of a group, in its own frame (lengths in tile sizes):
 *   p           the spine, a cubic Bezier curve: [x0, y0, x1, y1, x2, y2, x3, y3], from the head end to the tail's tip
 *   r0, rh, th  the radius at the head end, the largest radius, and where along the spine (0..1 of its length) that is
 *   q           how the radius falls from there to the tip: 1 - w^q  (1: a straight taper, 2: fat for longer)
 *   cover       the dark share (default COVER)
 */
export const STROKES = {
  default: { p: [0.3, 0.3, 0.7, 0.2, 0.9, 0.6, 0.6, 0.9], r0: 0.2, rh: 0.2, th: 0, q: 1 },
};

/** The spine of a stroke: n + 1 points at equal steps of its length. { x, y, len } */
export function spine(k, n = 256) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = k.p, M = 4 * n;
  const bx = new Float64Array(M + 1), by = new Float64Array(M + 1), cum = new Float64Array(M + 1);
  for (let m = 0; m <= M; m++) {
    const t = m / M, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    bx[m] = a * x0 + b * x1 + c * x2 + d * x3; by[m] = a * y0 + b * y1 + c * y2 + d * y3;
    if (m) cum[m] = cum[m - 1] + Math.hypot(bx[m] - bx[m - 1], by[m] - by[m - 1]);
  }
  const len = cum[M], x = new Float64Array(n + 1), y = new Float64Array(n + 1);
  for (let i = 0, m = 0; i <= n; i++) {
    const want = (i / n) * len;
    while (m < M - 1 && cum[m + 1] < want) m++;
    const f = cum[m + 1] > cum[m] ? Math.min(1, Math.max(0, (want - cum[m]) / (cum[m + 1] - cum[m]))) : 0;
    x[i] = bx[m] + f * (bx[m + 1] - bx[m]); y[i] = by[m] + f * (by[m + 1] - by[m]);
  }
  return { x, y, len, n };
}

/** The bumps of a stroke: Float64Array [x, y, sigma, amplitude] per bump, in the frame. */
export function strokeBeads(k, soft = k.soft ?? SOFT) {
  const { r0 = k.rh, rh, th = 0, q = 1, rt = R_TIP } = k;
  const amp = Math.exp(1 / (2 * soft * soft));             // a long even stroke has u = 1 at its radius
  const S = spine(k), M = S.n, len = S.len;
  const radius = (t) => {
    if (t < th) { const z = t / th, f0 = (r0 - rt) / (rh - rt); return rt + (rh - rt) * (f0 + (1 - f0) * z * z * (3 - 2 * z)); }
    const w = Math.min(1, (t - th) / (1 - th));
    return rt + (rh - rt) * (1 - Math.pow(w, q));
  };
  const out = [];
  out.push(S.x[0], S.y[0], soft * radius(0), 0.8 * amp);   // the round end of the head
  const a = amp * STEP / Math.sqrt(2 * Math.PI);
  for (let t = 0; t <= 1;) {
    const sg = soft * radius(t), f = t * M, m = Math.min(M - 1, Math.floor(f)), fr = f - m;
    out.push(S.x[m] + fr * (S.x[m + 1] - S.x[m]), S.y[m] + fr * (S.y[m + 1] - S.y[m]), sg, a);
    t += (STEP * sg) / len;
  }
  return Float64Array.from(out);
}

'''
s = s[:a] + new + s[b:]
open(p, 'w').write(s)

p = 'lab/measure.mjs'
s = open(p).read()
old = """import { solve, labelTorus } from '../design.js';"""
new = """import { solve, labelTorus, spine } from '../design.js';"""
assert old in s; s = s.replace(old, new)
old = """function insidePoly(poly, x, y) {
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false;
  }
  return true;
}
"""
new = """/** Is (x, y) inside the convex counter-clockwise polygon, at least `margin` from every side? */
function insidePoly(poly, x, y, margin = 0) {
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1];
    if ((ex * (y - a[1]) - ey * (x - a[0])) / Math.hypot(ex, ey) < margin) return false;
  }
  return true;
}
/** The length of a stroke's spine and how far its heading turns in all (radians, every bend counted). */
export function spineShape(stroke) {
  const S = spine(stroke, 96);
  let turn = 0, signed = 0, prev = null;
  for (let i = 0; i < S.n; i++) {
    const a = Math.atan2(S.y[i + 1] - S.y[i], S.x[i + 1] - S.x[i]);
    if (prev !== null) { const d = Math.atan2(Math.sin(a - prev), Math.cos(a - prev)); turn += Math.abs(d); signed += d; }
    prev = a;
  }
  return { len: S.len, turn, signed };
}
/** How many pieces the light part of the torus is in (1: one sea round every blob; more: a blob has a hole). */
function lightPieces(dark, fld) {
  const { N1, N2 } = fld, n = N1 * N2, lab = new Int32Array(n).fill(-1), stack = new Int32Array(n);
  let count = 0;
  for (let p0 = 0; p0 < n; p0++) {
    if (dark[p0] || lab[p0] >= 0) continue;
    let top = 0; stack[top++] = p0; lab[p0] = count;
    while (top) {
      const p = stack[--top], i = p % N1, j = (p - i) / N1;
      for (const q of [j * N1 + ((i + 1) % N1), j * N1 + ((i + N1 - 1) % N1), ((j + 1) % N2) * N1 + i, ((j + N2 - 1) % N2) * N1 + i]) if (!dark[q] && lab[q] < 0) { lab[q] = count; stack[top++] = q; }
    }
    count++;
  }
  return count;
}
"""
assert old in s; s = s.replace(old, new)
old = """    if (opts.quick) return { cover: cv, wanted: S.wanted, valid: false, marks: 1, sym: 0, bare: 1, solid: 0, gap: 0, thin: 0, inTile: 0, dent: 0, length: 0, quick: true };"""
new = """    if (opts.quick) return { cover: cv, wanted: S.wanted, valid: false, marks: 1, sym: 0, bare: 1, solid: 0, gap: 0, thin: 0, inTile: 0, dent: 0, length: 0, level: 1, holes: 0, turn: 9, quick: true };"""
assert old in s; s = s.replace(old, new)
old = """    bare: 2 * bare, solid: 2 * solid, gap, thin, inTile: 0, dent: 0, length: 0, level: c };"""
new = """    bare: 2 * bare, solid: 2 * solid, gap, thin, inTile: 0, dent: 0, length: 0, level: c, holes: lightPieces(dark, fld) - 1, turn: spineShape(stroke).turn };"""
assert old in s; s = s.replace(old, new)
old = """      if (tile && insidePoly(tile, x, y)) inside++;"""
new = """      if (tile && insidePoly(tile, x, y, opts.margin ?? 0.04)) inside++;"""
assert old in s; s = s.replace(old, new)
a = s.index("/** One number, smaller is better. */")
new = """/** One number, smaller is better. */
export function score(m, W = {}) {
  const w = { bare: 1, gap: 8, gapWant: 0.1, solid: 3, solidMax: 0.66, head: 0.6, headWant: 0.46, inTile: 3, cover: 6, marks: 0.6, thin: 6, thinWant: 0.05,
    dent: 1, dentWant: 0.16, level: 0.4, levelSpan: 0.9, holes: 1, turn: 0.4, turnWant: 0.8, ...W };
  let s = w.bare * m.bare;
  s += w.gap * Math.max(0, w.gapWant - m.gap);
  s += w.thin * Math.max(0, w.thinWant - m.thin);
  s += w.solid * Math.max(0, m.solid - w.solidMax);
  s += w.head * Math.max(0, w.headWant - m.solid);
  s += w.inTile * (1 - m.inTile);
  s += w.cover * Math.max(0, m.wanted - m.cover);
  s += w.marks * Math.max(0, m.marks - 1);
  s += w.dent * Math.max(0, w.dentWant - m.dent);
  s += w.level * Math.max(0, Math.abs(Math.log(Math.max(1e-6, m.level))) - w.levelSpan);
  s += w.holes * m.holes;
  s += w.turn * Math.max(0, w.turnWant - m.turn);
  if (!m.valid) s += 5;
  return s;
}
"""
s = s[:a] + new
open(p, 'w').write(s)

p = 'lab/search.mjs'
s = open(p).read()
a = s.index("// bounds of the knobs")
b = s.index("const pool = [];")
new = r'''// the knobs as a vector: the four control points of the spine, rh, r0 / rh, th, q
const LIM = opt.lim ? JSON.parse(opt.lim) : {};
const B = { out: 0.35, rh: [0.1, 0.36], r0f: [0.15, 1], th: [0, 0.55], q: [0.8, 1.8], ...LIM };
const clamp = (v, [a, b]) => Math.min(b, Math.max(a, v));
function fix(v) {
  for (let k = 0; k < 8; k += 2) { v[k] = clamp(v[k], [bx0 - B.out, bx1 + B.out]); v[k + 1] = clamp(v[k + 1], [by0 - B.out, by1 + B.out]); }
  v[8] = clamp(v[8], B.rh); v[9] = clamp(v[9], B.r0f); v[10] = clamp(v[10], B.th); v[11] = clamp(v[11], B.q);
  return v;
}
const toStroke = (v) => ({ p: v.slice(0, 8), rh: v[8], r0: v[8] * (v[10] > 0.02 ? v[9] : 1), th: v[10] > 0.02 ? v[10] : 0, q: v[11] });
const fromStroke = (s) => [...s.p, s.rh, (s.r0 ?? s.rh) / s.rh, s.th || 0, s.q || 1];
let evals = 0;
function cost(v, h = H) {
  evals++;
  const m = analyse(group, toStroke(v), { h, cover, quick: true });
  return { s: score(m, W), m };
}
function randomVec() {
  const u = (a, b) => a + rnd() * (b - a);
  const inside = () => { let x, y; do { x = u(bx0, bx1); y = u(by0, by1); } while (!inTile(x, y)); return [x, y]; };
  const a = inside(), d = inside(), b = [u(bx0 - 0.2, bx1 + 0.2), u(by0 - 0.2, by1 + 0.2)], c = [u(bx0 - 0.2, bx1 + 0.2), u(by0 - 0.2, by1 + 0.2)];
  return fix([...a, ...b, ...c, ...d, u(B.rh[0], B.rh[1]), u(B.r0f[0], 1), rnd() < 0.5 ? 0 : u(0.1, 0.5), u(B.q[0], B.q[1])]);
}

'''
s = s[:a] + new + s[b:]
old = """const STEP0 = [0.12, 0.12, 0.35, 0.25, 0.5, 0.25, 0.04, 0.12, 0.08, 0.2];"""
new = """const STEP0 = [0.1, 0.1, 0.14, 0.14, 0.14, 0.14, 0.1, 0.1, 0.035, 0.12, 0.08, 0.2], D = STEP0.length;"""
assert old in s; s = s.replace(old, new)
old = """    const k1 = Math.floor(rnd() * 10), k2 = Math.floor(rnd() * 10);
    for (let k = 0; k < 10; k++) if (all || k === k1 || k === k2) v[k] += step * STEP0[k] * gauss() * (all ? 0.5 : 1);"""
new = """    const k1 = Math.floor(rnd() * D), k2 = rnd() < 0.5 ? (k1 ^ 1) : Math.floor(rnd() * D);
    for (let k = 0; k < D; k++) if (all || k === k1 || k === k2) v[k] += step * STEP0[k] * gauss() * (all ? 0.5 : 1);"""
assert old in s; s = s.replace(old, new)
old = """const stroke = { at: st.at.map(r4), dir: r4(st.dir), len: r4(st.len), turn: r4(st.turn), skew: r4(st.skew), r0: r4(st.r0), rh: r4(st.rh), th: r4(st.th), q: r4(st.q) };"""
new = """const stroke = { p: st.p.map(r4), r0: r4(st.r0), rh: r4(st.rh), th: r4(st.th), q: r4(st.q) };"""
assert old in s; s = s.replace(old, new)
open(p, 'w').write(s)
