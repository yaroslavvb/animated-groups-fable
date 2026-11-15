// r6/mk2s22.mjs — 2*22 strokes written in the coordinates (a, b) of the fat half Q of a mirror rectangle
// (Q = [0, 0.8165] x [0, 1.225]: mirrors at a = 0, b = 0, b = 1.225; the 2-fold centre at (0.8165, 0.6125) on the cut
// a = 0.8165), turned into the group's frame (x, y) = a u + b v, u = (0.8, -0.6), v = (0.6, 0.8). Prints a variants file.
const U = [0.8, -0.6], V = [0.6, 0.8];
const toF = (P) => { const out = []; for (let i = 0; i < P.length; i += 2) out.push(+(P[i] * U[0] + P[i + 1] * V[0]).toFixed(4), +(P[i] * U[1] + P[i + 1] * V[1]).toFixed(4)); return out; };
const V2 = [
  // the 22* comma, squeezed into Q: head up and in the middle, tail round the lower left, ending at the lower right
  { label: 'Q 22*-like', ab: [0.48, 0.86, 0.32, 1.00, -0.10, 0.05, 0.70, 0.22], r: 0.24, q: 0.8 },
  { label: 'Q head low', ab: [0.42, 0.40, 0.25, 0.10, 0.05, 0.95, 0.62, 1.00], r: 0.24, q: 0.8 },
  { label: 'Q head mid', ab: [0.40, 0.62, 0.15, 0.95, 0.05, 0.10, 0.66, 0.16], r: 0.25, q: 0.9 },
  { label: 'Q tail to centre', ab: [0.36, 0.40, 0.20, 0.95, 0.80, 1.10, 0.72, 0.62], r: 0.24, q: 0.9 },
];
const out = [{ id: '2*22', label: '2*22 now', stroke: { p: [0.408, 0.044, 1.16, 0.039, 0.941, -1.181, 1.524, -0.526], r0: 0.202, rh: 0.202, th: 0, q: 1.317 } }];
for (const v of V2) out.push({ id: '2*22', label: v.label, stroke: { p: toF(v.ab), r0: v.r, rh: v.r, th: 0, q: v.q } });
console.log(JSON.stringify(out, null, 1));
