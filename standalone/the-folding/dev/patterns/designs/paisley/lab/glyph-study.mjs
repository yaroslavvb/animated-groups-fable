// lab/glyph-study.mjs — look at candidate glyphs (the unit paisley) side by side, round and stretched.
//   node dev/patterns/designs/paisley/lab/glyph-study.mjs <out.png>
import { Canvas, hex } from './raster.mjs';

/** Arcs: back (unit circle), tip (radius rt), hollow (radius a), head (radius b). CCW outline, unit bounding circle. */
export function paisley({ b = 0.56, a = 0.62, tip = 100, rt = 0.03, step = 0.03 } = {}) {
  const th = (tip * Math.PI) / 180;
  const H = [0, -1 + b], T = [Math.cos(th), Math.sin(th)];
  const cc = (c1, r1, c2, r2, left) => {                      // intersection of two circles, left / right of c1 -> c2
    const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
    const x = (d * d + r1 * r1 - r2 * r2) / (2 * d), y = Math.sqrt(Math.max(0, r1 * r1 - x * x)) * (left ? 1 : -1);
    return [c1[0] + (x * dx - y * dy) / d, c1[1] + (x * dy + y * dx) / d];
  };
  const Q = cc(H, a + b, T, a, true);                         // the hollow's circle: through the tip, touching the head
  const Ct = cc([0, 0], 1 - rt, Q, a + rt, false);            // the tip's circle: inside the back, outside the hollow
  const ang = (p, c) => Math.atan2(p[1] - c[1], p[0] - c[0]);
  const pts = [];
  const arc = (c, r, a0, a1, ccw) => {
    if (ccw) while (a1 < a0) a1 += 2 * Math.PI; else while (a1 > a0) a1 -= 2 * Math.PI;
    const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / step));
    for (let i = 0; i < n; i++) { const f = a0 + ((a1 - a0) * i) / n; pts.push([c[0] + r * Math.cos(f), c[1] + r * Math.sin(f)]); }
  };
  const fb = ang(Ct, [0, 0]);
  arc([0, 0], 1, -Math.PI / 2, fb, true);                     // the back
  arc(Ct, rt, fb, ang(Q, Ct), true);                          // the tip
  arc(Q, a, ang(Ct, Q), ang(H, Q), false);                    // the hollow
  arc(H, b, ang(Q, H), 1.5 * Math.PI, true);                  // the head
  let A = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += p[0] * q[1] - q[0] * p[1]; }
  const tipAngle = Math.acos(Math.max(-1, Math.min(1, ((T[0] - Q[0]) * T[0] + (T[1] - Q[1]) * T[1]) / a))) * 180 / Math.PI;
  return { pts, area: A / 2, fill: A / 2 / Math.PI, tipAngle, Q, H };
}

if (process.argv[1] && process.argv[1].endsWith('glyph-study.mjs')) {
  const out = process.argv[2];
  const variants = [
    { b: 0.5, a: 0.5, tip: 90, rt: 0.004 },
    { b: 0.5, a: 0.56, tip: 90 },
    { b: 0.55, a: 0.6, tip: 100 },
    { b: 0.58, a: 0.62, tip: 105 },
    { b: 0.6, a: 0.7, tip: 110 },
    { b: 0.56, a: 0.5, tip: 120 },
    { b: 0.6, a: 0.55, tip: 125 },
    { b: 0.62, a: 0.75, tip: 120 },
  ];
  const stretches = [1, 1.4, 2];
  const cw = 250, chH = [250, 320, 430];
  const c = new Canvas(cw * variants.length, chH.reduce((s, v) => s + v, 0), 3);
  const teal = hex('#4fa397');
  let y0 = 0;
  stretches.forEach((sg, r) => {
    variants.forEach((v, k) => {
      const g = paisley(v), R = 100;
      const ox = k * cw + cw / 2, oy = y0 + chH[r] / 2;
      c.fill([g.pts.map(([x, y]) => [ox + R * x, oy - R * sg * y])], teal);
      const ring = []; for (let i = 0; i < 90; i++) ring.push([ox + R * Math.cos(i * Math.PI / 45), oy - R * sg * Math.sin(i * Math.PI / 45)]);
      c.line(ring, [0.6, 0.6, 0.65], 0.7, 1, true);
      if (r === 0) console.log(k, JSON.stringify(v), 'fill', g.fill.toFixed(3), 'tipAngle', g.tipAngle.toFixed(1), 'n', g.pts.length);
    });
    y0 += chH[r];
  });
  c.save(out);
  console.log('WROTE', out);
}
