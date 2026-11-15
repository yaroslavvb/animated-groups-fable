// scratch: a group carried by the similarity x -> s R x + t, as a test would hand it over: { id, e1, e2, reps, cellArea,
// domainArea, center } and nothing else (no presets, no viewHalf).
export function moved(g, ang = 0.7, s = 1.7, t = [3.1, -2.2]) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const L = (v) => [s * (c * v[0] - sn * v[1]), s * (sn * v[0] + c * v[1])];
  const P = (v) => { const w = L(v); return [w[0] + t[0], w[1] + t[1]]; };
  const reps = g.reps.map((r) => {
    // g' = S g S^-1: linear part R A R^-1 (A R^-1 first), translation from g'(S(0)) = S(g(0))
    const m00 = r.a * c - r.b * sn, m01 = r.a * sn + r.b * c, m10 = r.c * c - r.d * sn, m11 = r.c * sn + r.d * c;
    const a = c * m00 - sn * m10, b = c * m01 - sn * m11, cc = sn * m00 + c * m10, d = sn * m01 + c * m11;
    const s0 = P([0, 0]), sg = P([r.tx, r.ty]);
    return { a, b, c: cc, d, tx: sg[0] - (a * s0[0] + b * s0[1]), ty: sg[1] - (cc * s0[0] + d * s0[1]) };
  });
  const e1 = L(g.e1), e2 = L(g.e2), cellArea = Math.abs(e1[0] * e2[1] - e1[1] * e2[0]);
  return { id: g.id, e1, e2, reps, cellArea, domainArea: cellArea / reps.length, center: P(g.center) };
}
