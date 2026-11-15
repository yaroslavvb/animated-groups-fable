// dev/variants.mjs — the variants dev/try.mjs prints (scratch: what was tried last)
const S442 = 0.3536, S632 = 0.2686, S333 = 0.3799, S42 = 0.3536, S33 = 0.3799, S2222 = 0.5701, S222 = 0.4899;
export function tick442(d, r, gap, rd = 0.04) {                 // d: spine inset (tile sizes)
  const dw = d * S442, k = dw / Math.sin(Math.PI / 8), B = [k * Math.cos(3 * Math.PI / 8), k * Math.sin(3 * Math.PI / 8)];
  const a = (0.5 - dw - B[1]) / Math.SQRT1_2;
  return ['*442', [B[0] + a * Math.SQRT1_2, B[1] + a * Math.SQRT1_2], B, [B[0], 0.5 - 0.045], { r, gap, rd, fil: 0.03 }];
}
export function tick632(d, r, gap, rd = 0.03, cEnd = 0.035) {
  const dw = d * S632, B = [-0.5 + 2 * dw, -0.2887], u = [0.866, 0.5], v = [0.866, -0.5];
  const bn = B[0] * 0.866 - B[1] * 0.5;                          // signed distance to the long leg (negative inside)
  const ta = (-bn - dw) / 0.5, tc = -bn - cEnd;
  return ['*632', [B[0] + ta * u[0], B[1] + ta * u[1]], B, [B[0] + tc * v[0], B[1] + tc * v[1]], { r, gap, rd, fil: 0.03 }];
}
// *333: bend at (0,0), long stroke along the side to (1/2, sqrt3/6), short stroke b tile sizes along the side to
// (1/2, -sqrt3/6), then the dot: its centre nu inside both mirrors of that corner (so on the corner's bisector)
export function tick333(d, r, gap, b, dr, nu, dg = gap) {
  const dw = d * S333, B = [2 * dw, 0], u = [0.866, 0.5], v = [0.866, -0.5];
  const ta = (0.5 - dw - B[0]) / 0.866;
  // along the short stroke's line: t (tile sizes from B) of the foot of the dot's centre; the centre is nu from both mirrors
  const tCorner = (0.5 - B[0]) / 0.866 / S333;                   // where the line meets the mirror x = 1/2
  const tDot = tCorner - (nu + 0.5 * (nu - d)) / 0.866;          // distance to x = 1/2 is (tCorner - t) 0.866 - (nu - d) 0.5
  const bb = b ?? tDot - r - dg - dr;
  return ['*333', [B[0] + ta * u[0], B[1] + ta * u[1]], B, [B[0] + bb * S333 * v[0], B[1] + bb * S333 * v[1]], { r, gap, fil: 0.03, dr, dg: +(tDot - bb - r - dr).toFixed(4), dx: +(nu - d).toFixed(4) }];
}
// 4*2: a J along the mirror. Local frame: x along the mirror side from the corner (1/2, 0), y into the chamber (tile sizes)
export function j42(y1, y2, xA, xB, xC, r, gap, fil) {
  const P = (x, y) => [0.5 - 0.25 * x + 0.25 * y, 0.25 * x + 0.25 * y];
  return ['4*2', P(xA, y1), P(xB, y1), P(xB, y2), P(xC, y2), { r, gap, fil }];
}
export const VARIANTS = {
  '*442': (hook) => [[0.09, 0.29, 0.15], [0.09, 0.3, 0.15]].map((p) => ['d ' + p[0] + ' r ' + p[1] + ' gap ' + p[2], hook(...tick442(...p))]),
  '*632': (hook) => [[0.08, 0.3, 0.12], [0.08, 0.32, 0.12], [0.085, 0.32, 0.14], [0.085, 0.34, 0.14], [0.09, 0.33, 0.15], [0.08, 0.31, 0.12, 0.02], [0.075, 0.31, 0.11, 0.02]].map((p) => ['d ' + p[0] + ' r ' + p[1] + ' gap ' + p[2] + ' rd ' + (p[3] ?? 0.03), hook(...tick632(...p))]),
  '*333': (hook) => [[0.085, 0.345, 0.12, undefined, 0.22, 0.085], [0.085, 0.33, 0.12, undefined, 0.27, 0.2], [0.085, 0.33, 0.12, undefined, 0.25, 0.17], [0.085, 0.33, 0.13, undefined, 0.28, 0.22], [0.09, 0.31, 0.13, undefined, 0.3, 0.24], [0.09, 0.3, 0.14, undefined, 0.3, 0.25], [0.085, 0.33, 0.12, 0.55, 0.25, 0.2]]
    .map((p) => ['r ' + p[1] + ' gap ' + p[2] + ' dr ' + p[4] + ' nu ' + p[5] + (p[3] ? ' b ' + p[3] : ''), hook(...tick333(...p))]),
  '4*2': (hook, jhook) => [[0.2, 0.64, 0.085, 1.4, 1.04, 0.14, 0.12, 0.14], [0.2, 0.68, 0.085, 1.4, 1.04, 0.14, 0.12, 0.14], [0.19, 0.67, 0.085, 1.4, 1.02, 0.13, 0.12, 0.14], [0.2, 0.7, 0.085, 1.42, 1.0, 0.14, 0.12, 0.16], [0.2, 0.68, 0.085, 1.42, 0.98, 0.14, 0.12, 0.2]]
    .map((p) => [p.join(' '), jhook(...j42(...p))]),
};
