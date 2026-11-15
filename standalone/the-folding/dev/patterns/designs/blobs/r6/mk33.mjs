// r6/mk33.mjs — 3*3 strokes written in the unit square (s, t) of 442's tile and carried into the kite of 3*3 by the
// bilinear map (s, t) -> O + s (M1 - O) + t (M2 - O) + s t (A - M1 - M2 + O): O the 3-fold centre (1.316, 0.76),
// A the *3 corner (0, 0), M1 = (1.316, 0) and M2 = (0.658, 1.14) the mid-points of the two mirror sides at A.
// (442's 4-fold corner (0, 0) goes to the 3-fold centre, its other 4-fold corner (1, 1) to the *3 corner.)
const O = [1.3161, 0.7598], A = [0, 0], M1 = [1.3161, 0], M2 = [0.658, 1.1397];
const KITE = { a: { M1, M2 }, b: { M1: M2, M2: M1 } };
const map = (P, k) => {
  const { M1: m1, M2: m2 } = KITE[k], out = [];
  for (let i = 0; i < P.length; i += 2) {
    const s = P[i], t = P[i + 1];
    for (const c of [0, 1]) out.push(+(O[c] + s * (m1[c] - O[c]) + t * (m2[c] - O[c]) + s * t * (A[c] - m1[c] - m2[c] + O[c])).toFixed(4));
  }
  return out;
};
const P442 = [0.22, 0.71, 1.343, 1.1, 0.651, -0.106, 0.082, 0.096];
const V = [
  { label: '442 in kite a', st: P442, k: 'a', r: 0.2, q: 1.283 },
  { label: '442 in kite b', st: P442, k: 'b', r: 0.2, q: 1.283 },
  { label: 'kite a fat', st: [0.30, 0.66, 1.30, 1.05, 0.70, -0.08, 0.10, 0.10], k: 'a', r: 0.22, q: 1.15 },
  { label: 'kite b fat', st: [0.30, 0.66, 1.30, 1.05, 0.70, -0.08, 0.10, 0.10], k: 'b', r: 0.22, q: 1.15 },
  { label: 'kite a tail out', st: [0.25, 0.30, 0.10, 1.05, 1.15, 0.95, 0.92, 0.55], k: 'a', r: 0.22, q: 1.1 },
];
const out = [{ id: '3*3', label: '3*3 now', stroke: { p: [2.085, 0.158, 0.198, 0.728, 2.982, 0.438, 0.167, 0.064], r0: 0.111, rh: 0.188, th: 0.125, q: 1.8, rt: 0.05 } }];
for (const v of V) out.push({ id: '3*3', label: v.label, stroke: { p: map(v.st, v.k), r0: v.r, rh: v.r, th: 0, q: v.q } });
console.log(JSON.stringify(out, null, 1));
