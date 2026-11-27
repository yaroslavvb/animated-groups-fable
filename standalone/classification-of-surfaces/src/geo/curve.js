// curve.js — a chain of cubic Bezier segments, read by arc length. The centre line of a tube.
//
//   const C = bezierChain([[P0, P1, P2, P3], [P3, P4, P5, P6], ...]);
//   C.length                     total arc length
//   C.at(s) -> { p, t }          point and unit tangent at arc length s (clamped to 0 .. length)
//   C.lengthAt(seg, u)           arc length at parameter u (0..1) of segment `seg`

const SAMPLES = 96;

function bez(P, u) {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1], a * P[0][2] + b * P[1][2] + c * P[2][2] + d * P[3][2]];
}
function bezTan(P, u) {
  const v = 1 - u, a = 3 * v * v, b = 6 * v * u, c = 3 * u * u;
  const t = [0, 1, 2].map((k) => a * (P[1][k] - P[0][k]) + b * (P[2][k] - P[1][k]) + c * (P[3][k] - P[2][k]));
  const l = Math.hypot(t[0], t[1], t[2]) || 1;
  return [t[0] / l, t[1] / l, t[2] / l];
}

export function bezierChain(segments) {
  // cum[i * (SAMPLES + 1) + k] = arc length at parameter k / SAMPLES of segment i
  const cum = [];
  let total = 0;
  for (const P of segments) {
    let prev = bez(P, 0);
    cum.push(total);
    for (let k = 1; k <= SAMPLES; k++) {
      const q = bez(P, k / SAMPLES);
      total += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]);
      cum.push(total);
      prev = q;
    }
  }
  const W = SAMPLES + 1;
  function locate(s) {
    s = Math.min(total, Math.max(0, s));
    let seg = 0;
    while (seg < segments.length - 1 && cum[(seg + 1) * W] <= s) seg++;
    let lo = 0, hi = SAMPLES;
    const off = seg * W;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[off + mid] <= s) lo = mid; else hi = mid; }
    const a = cum[off + lo], b = cum[off + hi];
    const u = (lo + (b > a ? (s - a) / (b - a) : 0)) / SAMPLES;
    return [seg, u];
  }
  return {
    length: total,
    at(s) { const [seg, u] = locate(s); return { p: bez(segments[seg], u), t: bezTan(segments[seg], u) }; },
    lengthAt(seg, u) {
      const x = Math.min(1, Math.max(0, u)) * SAMPLES, lo = Math.min(SAMPLES - 1, Math.floor(x)), off = seg * W;
      return cum[off + lo] + (cum[off + lo + 1] - cum[off + lo]) * (x - lo);
    },
  };
}
