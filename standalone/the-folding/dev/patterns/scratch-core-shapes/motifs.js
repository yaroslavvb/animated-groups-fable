// scratch (core-shapes): the motifs of test/shapes.test.js, for the browser sheet (copies of the test's own builders).
import { elementsNear, symmetryElements, classify } from '../../../src/groups.js';
import { motifFor } from '../../../src/motif.js';

const TAU = 2 * Math.PI;
const len = (p) => Math.hypot(p[0], p[1]);
const det = (g) => g.a * g.d - g.b * g.c;
const sizeOf = (g) => Math.sqrt(g.domainArea);
export function stabiliserAt(group, x, y) { return elementsNear(group, x, y, 1e-7 * sizeOf(group), x, y); }
export function clearance(group, x, y) {
  let D = Infinity;
  for (const g of elementsNear(group, x, y, 1.01 * Math.max(len(group.e1), len(group.e2)), x, y)) {
    const d = Math.hypot(g.a * x + g.b * y + g.tx - x, g.c * x + g.d * y + g.ty - y);
    if (d > 1e-7 * sizeOf(group) && d < D) D = d;
  }
  return D;
}
const PLACES = [];
for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) PLACES.push([(i + 0.37) / 7 - 0.5, (j + 0.61) / 7 - 0.5]);
export function genericPlace(group, k = 0) {
  return PLACES.map(([a, b]) => {
    const x = group.center[0] + a * group.e1[0] + b * group.e2[0], y = group.center[1] + a * group.e1[1] + b * group.e2[1];
    return { x, y, D: clearance(group, x, y) };
  }).sort((p, q) => q.D - p.D)[k];
}
export function ring(cx, cy, n, radius, phase = 0, back = false) {
  const pts = [];
  for (let i = 0; i < n; i++) { const k = back ? n - i : i, th = phase + (TAU * k) / n, r = radius((TAU * k) / n); pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]); }
  return pts;
}
export const commaShapes = (group) => motifFor(group).polylines.map((p) => ({ pts: p }));
export function blobShapes(group, place = genericPlace(group)) {
  const rho = 0.42 * (place.D - 0.03 * sizeOf(group)), { x, y } = place, hx = x + 0.12 * rho, hy = y - 0.05 * rho;
  const outer = ring(x, y, 72, (t) => rho * (0.74 + 0.2 * Math.cos(t + 0.5) + 0.06 * Math.cos(3 * t + 1)));
  const hole = ring(hx, hy, 40, (t) => 0.22 * rho * (1 + 0.2 * Math.cos(2 * t)));
  const island = ring(hx, hy, 24, () => 0.07 * rho, 0, true);
  return { shapes: [{ pts: outer }, { pts: hole, hole: true }, { pts: island }], at: [x, y], rho, order: 1 };
}
export function symmetricShapes(group, kind) {
  const L = len(group.e1) + len(group.e2), sym = symmetryElements(group, group.center[0], group.center[1], 1.2 * L);
  let place = null;
  if (kind === 'centre') {
    for (const c of sym.centers) {
      const S = stabiliserAt(group, c.x, c.y), d = Math.hypot(c.x - group.center[0], c.y - group.center[1]);
      if (!place || S.length > place.S.length || (S.length === place.S.length && d < place.d - 1e-9)) place = { x: c.x, y: c.y, S, d };
    }
  } else {
    for (const m of sym.mirrors.slice(0, 4)) for (let k = -12; k <= 12; k++) {
      const x = m.px + (k + 0.3) * 0.04 * L * m.ux, y = m.py + (k + 0.3) * 0.04 * L * m.uy, S = stabiliserAt(group, x, y);
      if (S.length !== 2) continue;
      const D = clearance(group, x, y);
      if (!place || D > place.D * (1 + 1e-9)) place = { x, y, S, D };
    }
  }
  if (!place) return null;
  const S = place.S, n = S.filter((g) => det(g) > 0).length, mir = S.find((g) => det(g) < 0);
  let phi = 0.4;
  if (mir) { const c = classify(mir); phi = Math.atan2(c.dir[1], c.dir[0]); }
  const rho = 0.42 * (clearance(group, place.x, place.y) - 0.03 * sizeOf(group));
  const f = mir ? (psi) => Math.cos(psi) : (psi) => (Math.cos(psi) + 0.5 * Math.sin(2 * psi)) / 1.3;
  const outer = ring(place.x, place.y, 60 * n, (t) => rho * (0.72 + 0.28 * f(n * t)), phi);
  const hole = ring(place.x, place.y, 24 * n, () => 0.2 * rho, phi);
  return { shapes: [{ pts: outer }, { pts: hole, hole: true }], at: [place.x, place.y], rho, order: S.length };
}
