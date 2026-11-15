// r6/mk42.mjs — 4*2 strokes written in the unit square (s, t) of 442's tile and carried into a small square of 4*2:
// (s, t) -> O + s (M1 - O) + t (M2 - O), O = the 4-fold centre (1.414, 1.414), M1, M2 two mid-points of the mirror
// square's sides (the other corner, s = t = 1, is a *2 point). Prints a variants file.
const O = [1.4142, 1.4142];
const SQ = {
  A: { M1: [0.7071, 0.7071], M2: [0.7071, 2.1213] },        // the square at the *2 point (0, 1.414)
  Ar: { M1: [0.7071, 2.1213], M2: [0.7071, 0.7071] },       // the same square, the other way round (a mirror image)
};
const map = (P, q) => { const out = []; for (let i = 0; i < P.length; i += 2) { const s = P[i], t = P[i + 1]; out.push(+(O[0] + s * (q.M1[0] - O[0]) + t * (q.M2[0] - O[0])).toFixed(4), +(O[1] + s * (q.M1[1] - O[1]) + t * (q.M2[1] - O[1])).toFixed(4)); } return out; };
const P442 = [0.22, 0.71, 1.343, 1.1, 0.651, -0.106, 0.082, 0.096];
const V = [
  { label: '442 in A', st: P442, q: 'A', r: 0.193, qq: 1.283 },
  { label: '442 in Ar', st: P442, q: 'Ar', r: 0.193, qq: 1.283 },
  { label: 'head in', st: [0.40, 0.66, 1.25, 1.05, 0.70, -0.05, 0.10, 0.12], q: 'A', r: 0.2, qq: 1.2 },
  { label: 'head in r', st: [0.40, 0.66, 1.25, 1.05, 0.70, -0.05, 0.10, 0.12], q: 'Ar', r: 0.2, qq: 1.2 },
  { label: 'fat', st: [0.35, 0.62, 1.30, 1.10, 0.75, -0.08, 0.12, 0.10], q: 'A', r: 0.23, qq: 1.1 },
];
const out = [{ id: '4*2', label: '4*2 now', stroke: { p: [1.168, 1.144, -0.164, 1.474, 1.054, 0.737, 1.523, 0.166], r0: 0.189, rh: 0.189, th: 0.069, q: 1.045 } }];
for (const v of V) out.push({ id: '4*2', label: v.label, stroke: { p: map(v.st, SQ[v.q]), r0: v.r, rh: v.r, th: 0, q: v.qq } });
console.log(JSON.stringify(out, null, 1));
