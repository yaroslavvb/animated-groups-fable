// lab/shape-study.mjs — the comma as a round head and a tapering tail along a curling spine: a table of curl x length.
//   node dev/patterns/designs/paisley/lab/shape-study.mjs <out.png> [m] [p]
import { Canvas, hex } from './raster.mjs';

/** Dense CCW outline; unit = the head's radius; head centre at the origin, the tail leaves upward and curls left. */
export function denseShape(L, ThDeg, { m = 0.4, p = 1.25, rtip = 0.07, N = 160 } = {}) {
  const Th = (ThDeg * Math.PI) / 180;
  // p < 0: the cosine family, w = cos(pi t / 2)^q with q = -p (q = 2 is the yin-yang's own profile)
  const q = -p, hp = Math.PI / 2;
  const w = p < 0 ? (t) => Math.pow(Math.cos(hp * t), q) : (t) => Math.pow(1 - t, p) * (1 + p * t);
  const dw = p < 0 ? (t) => -q * hp * Math.sin(hp * t) * Math.pow(Math.cos(hp * t), q - 1) : (t) => -p * (1 + p) * t * Math.pow(1 - t, p - 1);
  let te = 1; { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (w(mid) > rtip) lo = mid; else hi = mid; } te = lo; }
  const th = (t) => Math.PI / 2 + Th * ((1 - m) * t + m * t * t);
  // spine by Simpson steps
  const P = [[0, 0]], sub = 4;
  for (let i = 1; i <= N; i++) {
    let x = P[i - 1][0], y = P[i - 1][1];
    const t0 = (te * (i - 1)) / N, dt = te / N / sub;
    for (let k = 0; k < sub; k++) { const a = t0 + k * dt, b = a + dt, c = (a + b) / 2; x += (L * dt * (Math.cos(th(a)) + 4 * Math.cos(th(c)) + Math.cos(th(b)))) / 6; y += (L * dt * (Math.sin(th(a)) + 4 * Math.sin(th(c)) + Math.sin(th(b)))) / 6; }
    P.push([x, y]);
  }
  const right = [], left = [];
  for (let i = 0; i <= N; i++) {
    const t = (te * i) / N, a = th(t), wt = dw(t) / L, ww = w(t), q = Math.sqrt(Math.max(0, 1 - wt * wt));
    const tx = Math.cos(a), ty = Math.sin(a), nx = -ty, ny = tx;
    right.push([P[i][0] + ww * (-wt * tx - q * nx), P[i][1] + ww * (-wt * ty - q * ny)]);
    left.push([P[i][0] + ww * (-wt * tx + q * nx), P[i][1] + ww * (-wt * ty + q * ny)]);
  }
  const out = [];
  const arc = (c, r, a0, a1, n) => { while (a1 < a0) a1 += 2 * Math.PI; for (let i = 1; i < n; i++) { const f = a0 + ((a1 - a0) * i) / n; out.push([c[0] + r * Math.cos(f), c[1] + r * Math.sin(f)]); } };
  out.push(left[0]);
  arc([0, 0], 1, Math.atan2(left[0][1], left[0][0]), Math.atan2(right[0][1], right[0][0]), 64);     // the head's back
  for (let i = 0; i <= N; i++) out.push(right[i]);
  const E = P[N];
  arc(E, w(te), Math.atan2(right[N][1] - E[1], right[N][0] - E[0]), Math.atan2(left[N][1] - E[1], left[N][0] - E[0]), 10);   // the tip
  for (let i = N; i > 0; i--) out.push(left[i]);
  let A = 0;
  for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; A += a[0] * b[1] - b[0] * a[1]; }
  return { pts: out, area: A / 2, spine: P };
}

function selfCrossings(pts) {
  let n = 0;
  const N = pts.length;
  const cross = (a, b, c, d) => { const d1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), d2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]); if ((d1 > 0) === (d2 > 0)) return false; const d3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]), d4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]); return (d3 > 0) !== (d4 > 0); };
  for (let i = 0; i < N; i++) for (let j = i + 2; j < N; j++) { if (i === 0 && j === N - 1) continue; if (cross(pts[i], pts[(i + 1) % N], pts[j], pts[(j + 1) % N])) n++; }
  return n;
}

if (process.argv[1] && process.argv[1].endsWith('shape-study.mjs')) {
  const out = process.argv[2], m = process.argv[3] !== undefined ? +process.argv[3] : 0.4, p = process.argv[4] !== undefined ? +process.argv[4] : 1.25;
  const Ls = [3.2, 4.0, 4.8, 5.8], Ths = [50, 80, 110, 140, 170, 200];
  const cw = 250, ch = 215;
  const c = new Canvas(cw * Ths.length, ch * Ls.length, 2);
  Ls.forEach((L, r) => Ths.forEach((Th, k) => {
    const g = denseShape(L, Th, { m, p });
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of g.pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const R = 28, ox = k * cw + cw / 2 - (R * (x0 + x1)) / 2, oy = r * ch + ch / 2 + (R * (y0 + y1)) / 2;
    c.fill([g.pts.map(([x, y]) => [ox + R * x, oy - R * y])], hex('#4fa397'));
    const bw = x1 - x0, bh = y1 - y0;
    console.log(`L ${L} Th ${Th}: area ${g.area.toFixed(2)} box ${bw.toFixed(2)}x${bh.toFixed(2)} fillBox ${(g.area / (bw * bh)).toFixed(2)} crossings ${selfCrossings(g.pts)} n ${g.pts.length}`);
  }));
  c.save(out);
  console.log('WROTE', out);
}
