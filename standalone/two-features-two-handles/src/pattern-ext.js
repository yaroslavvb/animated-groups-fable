// Local copy of engine-sample/pattern-ext.js with `outline: false`, `center`, `dots`, and `setView(v, { moving })`.
// pattern.js — the pattern pane of the Symmetries tab: a 2D canvas that draws one repeating pattern in the geometry
// it lives in, and lets you slide it about by the motions of that geometry.
//
//   sphere            seen from far away (orthographic): a ball; a drag turns it, the point you took stays under the finger
//   plane             as it is; a drag slides it
//   hyperbolic plane  the Poincare disc (angles true, straight lines drawn as arcs square to the rim); a drag slides
//                     the pattern along a hyperbolic line, so every tile can be brought to the middle
//
// What is drawn, tile by tile (orbifold.js tiles()):
//   the tile itself     one tone for every tile. Until Tue 17 Nov 2026 a mirror-image tile was sand and a copy teal;
//                       Chaim Goodman-Strauss's note on the page that day: "*pqr's show two colors, and break the
//                       symmetry, to be pqr!". He is right: a reflection then swapped the two tones, so what was
//                       drawn under *632 had only the symmetries of 632. The picture has to have the signature's
//                       symmetry and no less, so nothing may tell a tile from its mirror image but the print
//   the print           a family of commas on every tile (motifs.js: Paisley), in a darker tone; in a mirror-image
//                       tile it is the mirror image. It has no symmetry of its own, so the pattern has exactly the
//                       signature's
//   red lines           mirrors (one colour of the book's signature: what reflects)        dashed: a glide's axis
//   blue / red marks    gyration points (blue) and the points where mirrors cross (red): a lens for order 2, then
//                       a triangle, a square, a pentagon ... as crystallographers draw them
// One tile is outlined: the one the surface in the other pane is folded from. The two edges of each glued pair are
// drawn alike: one colour and one number of arrowheads a pair (pairs.js; the Zip it up tab zips the tile up in the same colours).
// They carried letters at first; his notes, Mon 16 Nov 2026: "I don't understand what a,b mean in the leftmost
// diagram", then "instead of using letters a,b, use colors or edge styling to indicate edges which are matched up".
// A pointer on a glued edge (or a tap) brings out the pair and says what it is, in opts.tip.
// When a drag has carried the outlined tile out of sight (off the pane, toward the disc's rim, behind the ball), the
// outline goes to the tile nearest the middle of the view as the hand lets go: his second note, "dragging the fd
// away to infinity, it could snap back". Any tile is as good a fundamental domain as another.
//
//   const P = createPattern(canvas, { tip });   tip: an element inside the canvas's pane, for the note on a glued edge
//   P.set({ D, A, binding, tokens })    a new pattern (the view starts over); P.set(null): none, the pane is cleared
//   P.select(i | null)                  bring out what the i-th character of the signature stands for
//   P.resetView()   P.draw()   P.state()   for the tests
//
// For a page whose tile moves under a knob (the twist pages, Nov 2026); all of it off unless asked for:
//   P.set(model, { keepView, moving })  the view, the outline and the chosen character stay; moving: draw as during a drag
//   model.design(D)                     a print of one's own in place of Paisley
//   model.lines = [{ a, b, color, width, dash, alpha, once, steps }]   lines in the tile's coordinates: on every tile, or once in the outlined one
//   model.marks = [class id, ...]       corner classes brought out together
//   P.projectTile(p)                    a point of the outlined tile, on the canvas (css px)

import { mul, apply, det, I3 } from '../../2026-11-15-classification-of-surfaces/src/sym/geom.js';
import { tiles as makeTiles } from '../../2026-11-15-classification-of-surfaces/src/sym/orbifold.js';
import { design } from '../../2026-11-15-classification-of-surfaces/src/sym/motifs.js';
import { PRINT_FRONT, hexToRgb } from '../../2026-11-15-classification-of-surfaces/src/vendor/the-folding/palette.js';
import { pairStyle } from '../../2026-11-15-classification-of-surfaces/src/sym/pairs.js';
import { invH, psuI, psuNorm, psuInv, psuMul, psuApplyDisc, psuToSO21, so21ToPSU, discDist } from './handles.js';

const TAU = 2 * Math.PI;
export const BLUE = [0, 0.447, 0.698], RED = [0.835, 0.369, 0];
const DARK = [0.08, 0.09, 0.12];
// the paper of The Folding's prints: teal, a light tone for the tile and a dark one for what is printed on it
const FRONT = hexToRgb(PRINT_FRONT[0]), FRONT_INK = hexToRgb(PRINT_FRONT[1]);
const css = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

const hypLerp = (G, a, b, u) => {
  const d = G.dist(a, b);
  if (d < 1e-3) return G.norm([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
  const e2 = Math.exp(-2 * d), invDen = 1 / (1 - e2);
  const wa = (Math.exp(-u * d) - Math.exp((u - 2) * d)) * invDen;
  const wb = (Math.exp(-(1 - u) * d) - Math.exp(-(1 + u) * d)) * invDen;
  return G.norm([wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]]);
};

/** Compute screen-space Poincare disc orthogonal circular arc (or chord shortcut) from `(ax, ay)` to `(bx, by)`. */
export function poincareArc(ax, ay, bx, by, cx, cy, R) {
  const sx1 = cx + R * ax, sy1 = cy - R * ay;
  const sx2 = cx + R * bx, sy2 = cy - R * by;
  const dx = sx2 - sx1, dy = sy2 - sy1, ch2 = dx * dx + dy * dy;
  const det2 = 2 * (ax * by - ay * bx);
  if (ch2 < 2.25 || Math.abs(det2) < 1e-6) return { line: true, sx1, sy1, sx2, sy2 };
  const r1 = 1 + ax * ax + ay * ay, r2 = 1 + bx * bx + by * by;
  const ux = (r1 * by - r2 * ay) / det2, uy = (ax * r2 - bx * r1) / det2;
  const rc2 = ux * ux + uy * uy - 1;
  if (!(rc2 > 0)) return { line: true, sx1, sy1, sx2, sy2 };
  const sr = R * Math.sqrt(rc2);
  if (sr > 2e5 || (sr > 4 && ch2 < 1.6 * sr)) return { line: true, sx1, sy1, sx2, sy2 };
  const scx = cx + R * ux, scy = cy - R * uy;
  const a1 = Math.atan2(sy1 - scy, sx1 - scx);
  const a2 = Math.atan2(sy2 - scy, sx2 - scx);
  let da = a2 - a1;
  if (da > Math.PI) da -= TAU;
  else if (da < -Math.PI) da += TAU;
  return { line: false, sx1, sy1, sx2, sy2, scx, scy, sr, a1, a2, ccw: da < 0 };
}

const clampDisc = (w) => {
  const r = Math.hypot(w[0], w[1]);
  return r >= 1 - 1e-12 ? [(w[0] * (1 - 1e-12)) / r, (w[1] * (1 - 1e-12)) / r] : w;
};
const discToKlein = (w) => { const r2 = w[0] * w[0] + w[1] * w[1], s = 1 / (1 + r2); return [2 * w[0] * s, 2 * w[1] * s, 1]; };
const kleinToDisc = (k) => { const r2 = k[0] * k[0] + k[1] * k[1], s = 1 / (1 + Math.sqrt(Math.max(1e-15, 1 - r2))); return [k[0] * s, k[1] * s]; };
const buildKleinNorms = (D) => {
  if (D._kleinNorms) return D._kleinNorms;
  const norms = [];
  for (let i = 0; i < D.n; i++) {
    const a = D.verts[i], b = D.verts[(i + 1) % D.n];
    const N = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const l = Math.hypot(N[0], N[1], N[2]) || 1;
    const u = [N[0] / l, N[1] / l, N[2] / l];
    if (u[0] * D.at[0] + u[1] * D.at[1] + u[2] * D.at[2] < 0) { u[0] = -u[0]; u[1] = -u[1]; u[2] = -u[2]; }
    norms.push(u);
  }
  D._kleinNorms = norms;
  return norms;
};

/** Exact Cyrus-Beck geodesic ray-marcher in Klein disc + PSU(1,1) x Z2 returning tile g containing `targetDisc`. */
export function locateTilePSU(D, A, targetDisc, maxSteps = 400) {
  if (!D.n) return { g: psuI(), inside: true, steps: 0 };
  const target = clampDisc(targetDisc);
  const maps2 = A.maps2 || A.maps.map((M, i) => so21ToPSU(M, !!(D.edges[i].mirror || D.edges[i].rev)));
  const norms = buildKleinNorms(D);
  const atD = [D.at[0] / (1 + D.at[2]), D.at[1] / (1 + D.at[2])];
  let gAcc = psuI(), pD = atD, lastEdge = -1, zeroRun = 0;
  let bestG = gAcc, bestDist = discDist(target, atD);

  for (let step = 0; step < maxSteps; step++) {
    const qD = clampDisc(psuApplyDisc(psuInv(gAcc), target));
    const qDist = discDist(qD, atD);
    if (qDist < bestDist) { bestDist = qDist; bestG = gAcc; }
    const qK = discToKlein(qD);
    let minSq = Infinity;
    const sqs = new Array(D.n);
    for (let i = 0; i < D.n; i++) {
      const N = norms[i], s = N[0] * qK[0] + N[1] * qK[1] + N[2] * qK[2];
      sqs[i] = s;
      if (s < minSq) minSq = s;
    }
    if (minSq >= -1e-11) return { g: gAcc, inside: true, steps: step };

    const pK = discToKlein(pD);
    let bestEdge = -1, bestT = Infinity;
    for (let i = 0; i < D.n; i++) {
      if (i === lastEdge) continue;
      const sq = sqs[i];
      if (sq >= -1e-14) continue;
      const N = norms[i], sp = Math.max(0, N[0] * pK[0] + N[1] * pK[1] + N[2] * pK[2]);
      const t = sp / (sp - sq);
      if (t < bestT) { bestT = t; bestEdge = i; }
    }
    if (bestEdge < 0) {
      for (let i = 0; i < D.n; i++) {
        const sq = sqs[i];
        if (sq >= -1e-14) continue;
        const N = norms[i], sp = Math.max(0, N[0] * pK[0] + N[1] * pK[1] + N[2] * pK[2]);
        const t = sp / (sp - sq);
        if (t < bestT) { bestT = t; bestEdge = i; }
      }
      if (bestEdge < 0) return { g: bestG, inside: false, steps: step };
    }
    if (bestT < 1e-9) {
      zeroRun++;
      if (zeroRun > 12) {
        pD = [pD[0] + 1e-5 * (atD[0] - pD[0]), pD[1] + 1e-5 * (atD[1] - pD[1])];
        zeroRun = 0; lastEdge = -1;
        continue;
      }
    } else zeroRun = 0;

    const wK = [pK[0] + bestT * (qK[0] - pK[0]), pK[1] + bestT * (qK[1] - pK[1]), 1];
    const stepG = maps2[bestEdge];
    gAcc = psuMul(gAcc, stepG);
    pD = clampDisc(psuApplyDisc(psuInv(stepG), kleinToDisc(wK)));
    const e = D.edges[bestEdge];
    lastEdge = e.mirror ? bestEdge : e.to;
  }
  return { g: bestG, inside: false, steps: maxSteps };
}

/** Exact PSU(1,1) x Z2 hyperbolic tile enumerator centered at `focus` (in Poincare disc). */
export function tilesPSU(D, A, { focus = [0, 0], radius = 5.6, max = 4200, ms = 1500 } = {}) {
  const G = D.G, n = D.n;
  if (!n) return [{ g: psuI(), M: I3.slice(), flip: false, d: 0 }];
  const [fx, fy] = clampDisc(focus);
  const focusTo0 = psuNorm([1, 0, -fx, -fy, 0]);
  const maps2 = A.maps2 || A.maps.map((M, i) => so21ToPSU(M, !!(D.edges[i].mirror || D.edges[i].rev)));
  const toDisc = (p) => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
  const atD = toDisc(D.at);
  const samplesD = [atD, ...D.verts.map(toDisc)];
  for (let i = 0; i < n; i++) {
    const a = D.verts[i], b = D.verts[(i + 1) % n], len = G.dist(a, b);
    if (len > 2.0) {
      const k = Math.ceil(len / 2.0);
      for (let s = 1; s < k; s++) samplesD.push(toDisc(hypLerp(G, a, b, s / k)));
    }
  }
  const ns = samplesD.length, sX = new Float64Array(ns), sY = new Float64Array(ns);
  for (let i = 0; i < ns; i++) { sX[i] = samplesD[i][0]; sY[i] = samplesD[i][1]; }
  const tMax = Math.tanh(radius / 2), maxR2 = Math.min(1 - 1e-15, tMax * tMax);
  const tau = Math.max(1e-7, 1e-3 * Math.min(1, D.clear || 1));
  const grid = new Map();
  const cells = (w, flip) => {
    const out = [], tag = flip ? 'f' : 'd';
    const r = Math.hypot(w[0], w[1]), d = 2 * Math.atanh(Math.min(1 - 1e-15, r)), th = Math.atan2(w[1], w[0]);
    const e = 3 * tau + 1e-6;
    for (let id = Math.floor((d - e) * 16); id <= Math.floor((d + e) * 16); id++) {
      if (id < 0) continue;
      const N = Math.max(1, Math.min(1 << 20, Math.round(16 * Math.sinh((id + 0.5) / 16)))), k = N / TAU, et = e / Math.max(0.05, Math.sinh(d));
      const lo = Math.floor((th - et) * k), hi = Math.min(lo + N - 1, Math.floor((th + et) * k));
      for (let it = lo; it <= hi; it++) out.push(tag + id + ':' + (((it % N) + N) % N));
    }
    return out;
  };
  const cellKey = (w, flip) => {
    const r = Math.hypot(w[0], w[1]), d = 2 * Math.atanh(Math.min(1 - 1e-15, r)), th = Math.atan2(w[1], w[0]);
    const id = Math.max(0, Math.floor(d * 16));
    const N = Math.max(1, Math.min(1 << 20, Math.round(16 * Math.sinh((id + 0.5) / 16)))), k = N / TAU;
    const it = Math.floor(th * k);
    return (flip ? 'f' : 'd') + id + ':' + (((it % N) + N) % N);
  };
  const known = (w, flip) => {
    const list = grid.get(cellKey(w, flip));
    if (list) for (const q of list) if (discDist(w, q) < tau) return true;
    return false;
  };
  const put = (w, flip) => { for (const key of cells(w, flip)) { const l = grid.get(key); if (l) l.push(w); else grid.set(key, [w]); } };
  const minR2Of = (gRel) => {
    const ar = gRel[0], ai = gRel[1], br = gRel[2], bi = gRel[3], flip = gRel[4];
    let bestR2 = Infinity;
    for (let i = 0; i < ns; i++) {
      const u = sX[i], v = flip ? -sY[i] : sY[i];
      const nr = ar * u - ai * v + br, ni = ar * v + ai * u + bi;
      const dr = br * u + bi * v + ar, di = br * v - bi * u - ai;
      const r2 = (nr * nr + ni * ni) / (dr * dr + di * di);
      if (r2 < bestR2) bestR2 = r2;
    }
    return bestR2;
  };
  const distFromR2 = (r2) => 2 * Math.atanh(Math.sqrt(Math.min(1 - 1e-15, r2)));
  const heap = [];
  const push = (t) => { heap.push(t); for (let i = heap.length - 1; i > 0;) { const up = (i - 1) >> 1; if (heap[up].d <= heap[i].d) break; [heap[up], heap[i]] = [heap[i], heap[up]]; i = up; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].d < heap[m].d) m = l; if (r < heap.length && heap[r].d < heap[m].d) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };

  const out = [], t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const g0 = locateTilePSU(D, A, [fx, fy]).g;
  const gRel0 = psuMul(focusTo0, g0);
  put(psuApplyDisc(gRel0, atD), !!g0[4]);
  push({ g: g0, gRel: gRel0, flip: !!g0[4], d: distFromR2(minR2Of(gRel0)) });
  while (heap.length && out.length < max) {
    const t = pop();
    out.push({ g: t.g, M: psuToSO21(t.g), flip: t.flip, d: t.d });
    if ((out.length & 63) === 0 && typeof performance !== 'undefined' && performance.now() - t0 > ms) break;
    for (let i = 0; i < n; i++) {
      const gRel = psuMul(t.gRel, maps2[i]);
      const r2 = minR2Of(gRel);
      if (!(r2 <= maxR2)) continue;
      const g = psuMul(t.g, maps2[i]), flip = !!g[4];
      const w = psuApplyDisc(gRel, atD);
      if (known(w, flip)) continue;
      put(w, flip); push({ g, gRel, flip, d: distFromR2(r2) });
    }
  }
  return out;
}

export function createPattern(canvas, opts = {}) {
  const ctx = canvas.getContext('2d'), tipEl = opts.tip || null;
  let W = 0, H = 0, dpr = 1;
  let model = null, G = null, V = I3.slice(), base = I3.slice(), sel = null, quick = false;
  // Does V turn the plane over? Does base? Kept as facts (each flips when the middle of the view crosses onto a
  // mirror-image neighbour; base's is set when the outline moves), never read back off a determinant: a long way
  // out on the hyperbolic plane a determinant is rounding. fix() is told them.
  const H_CACHE_RADIUS = 5.9, H_REBUILD_DRIFT = 0.65, H_CULL_Z = Math.cosh(5.2), H_FULL_MAX = 4200;
  const isIdentityPsu = (g) => Math.abs(g[0] - 1) < 1e-12 && !g[4] && Math.hypot(g[1], g[2], g[3]) < 1e-12;
  let vRev = false, bRev = false;
  let vPsu = psuI(), bPsu = psuI();
  const vHand = () => (vRev ? -1 : 1), bHand = () => (bRev ? -1 : 1);
  let pulse = -1e9;                 // when the outline last moved to another tile (performance.now()): it glows for a moment
  const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let budget = H_FULL_MAX, emaMs = 8, cache = new Map(), hCache = null, hMidSamples = [], des = [], desAt = [], reach = 1, area = 1, stats = { tiles: 0, drawn: 0 };
  let raf = 0;
  let hots = [], hot = null, home = null;      // the outlined tile's glued edges on the screen, the pair a pointer is on (a, b, ...), the tile's middle

  function size() {
    const r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);      // 2 is sharp enough, and a 3x phone fills 2.25 times fewer pixels
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === W && h === H && d === dpr) return;
    W = w; H = h; dpr = d;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  // what a unit of the geometry is on the screen, and where its origin goes
  const lay = () => {
    const half = Math.min(W, H) / 2;
    // on the plane: a tile is about as large on a phone as on a desk, so a small pane shows fewer of them
    if (G.kind === 'E') return { cx: W / 2, cy: H / 2, R: half / (Math.max(2.1, Math.min(3.1, half / 88)) * Math.sqrt(area)), half };
    return { cx: W / 2, cy: H / 2, R: half * 0.94, half };
  };
  /** Under a pointer: the point of the geometry (in view coordinates). */
  function unproject(x, y) {
    const L = lay(), u = (x - L.cx) / L.R, v = -(y - L.cy) / L.R, d2 = u * u + v * v;
    if (G.kind === 'E') return [u, v, 1];
    if (G.kind === 'S') { if (d2 >= 1) { const l = Math.sqrt(d2); return [u / l, v / l, 0]; } return [u, v, Math.sqrt(1 - d2)]; }
    const m = Math.min(1, 0.93 / Math.sqrt(d2 || 1e-12)), a = u * m, b = v * m, q = a * a + b * b;     // not too near the rim: the slide stays gentle
    return [(2 * a) / (1 - q), (2 * b) / (1 - q), (1 + q) / (1 - q)];
  }

  function firstView() {
    base = I3.slice(); vRev = false; bRev = false; bPsu = psuI();
    if (G.kind === 'S') {
      // the tile's own middle faces the eye, tipped a little so that no mirror hides on the rim
      const a = -0.42, b = 0.34, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const Rx = [1, 0, 0, 0, ca, -sa, 0, sa, ca], Ry = [cb, 0, sb, 0, 1, 0, -sb, 0, cb];
      V = mul(mul(Rx, Ry), G.translate(model.D.face || model.D.at, G.origin));
      vPsu = psuI();
    } else {
      V = G.translate(model.center || model.D.at, G.origin);
      vPsu = G.kind === 'H' ? so21ToPSU(V, false) : psuI();
    }
  }
  /** Keep the tile containing the middle of the view the one the list of tiles is centred on (the pattern does not move). */
  function recentre(V0) {
    if (G.kind === 'S') return V0;
    const { D, A } = model;
    if (G.kind === 'H') {
      const focus = psuApplyDisc(psuInv(vPsu), [0, 0]);
      const { g } = locateTilePSU(D, A, focus);
      if (isIdentityPsu(g)) return V0;
      vPsu = psuMul(vPsu, g);
      V = psuToSO21(vPsu); vRev = !!vPsu[4];
      const invG = psuInv(g);
      bPsu = psuMul(invG, bPsu);
      if (Math.hypot(bPsu[0], bPsu[1]) > 150) { bPsu = psuI(); base = I3.slice(); bRev = false; }
      else { base = psuToSO21(bPsu); bRev = !!bPsu[4]; }
      if (hCache) hCache.shift = psuMul(invG, hCache.shift);
      return V0 ? psuMul(V0, g) : V0;
    }
    const ref = D.at;
    const far = (M) => { const p = apply(M, ref); return p[0] * p[0] + p[1] * p[1]; };
    for (let guard = 0; guard < 400; guard++) {
      let best = -1, bd = far(V) - 1e-9;
      for (let i = 0; i < D.n; i++) { const d = far(mul(V, A.maps[i])); if (d < bd) { bd = d; best = i; } }
      if (best < 0) break;
      const h = A.maps[best], hi = A.maps[D.edges[best].mirror ? best : D.edges[best].to];     // the neighbour's own way back
      V = mul(V, h); base = mul(hi, base);
      if (det(h) < 0) { vRev = !vRev; bRev = !bRev; }          // h is one of the tile's own gluings: small and exact
      if (V0) V0 = mul(V0, h);
    }
    V = G.fix(V, vHand()); base = G.fix(base, bHand());
    return V0 ? G.fix(V0, vHand()) : V0;
  }
  /** Is the outlined tile still to be seen? Not once it has slid off the pane, shrunk toward the disc's rim, or gone behind the ball. */
  function outlineSeen() {
    const D = model.D;
    if (!D.n) return true;
    const M = G.kind === 'H' ? psuToSO21(psuMul(vPsu, bPsu)) : mul(V, base);
    const c = apply(M, D.at);
    if (!(Number.isFinite(c[0]) && Number.isFinite(c[1]) && Number.isFinite(c[2]))) return false;
    if (G.kind === 'S') return c[2] > 0.12;
    if (G.kind === 'H') return c[2] < 4;                  // within two units of the middle (0.77 of the disc's radius): farther out it is a speck
    const L = lay(), x = L.cx + L.R * c[0], y = L.cy - L.R * c[1];
    return x > 0 && x < W && y > 0 && y < H;
  }
  /** If the outlined tile is out of sight, the outline goes to the tile nearest the middle of the view. Returns whether it moved. */
  function settle() {
    if (!model || !model.D.n || outlineSeen()) return false;
    if (G.kind === 'S') {
      let best = null, bz = -Infinity;
      for (const t of tileList()) { const z = apply(mul(V, t.M), model.D.at)[2]; if (z > bz) { bz = z; best = t; } }
      if (!best) return false;
      base = best.M.slice(); bRev = !!best.flip;
    } else { base = I3.slice(); bRev = false; bPsu = psuI(); }          // recentre() keeps the list centred on that tile
    pulse = performance.now();
    return true;
  }

  function tileList() {
    const { D, A } = model;
    let radius = Infinity, max = H_FULL_MAX;
    if (G.kind === 'E') { const L = lay(); radius = (Math.hypot(W, H) / 2) / L.R + reach; }
    if (G.kind === 'H') {
      const wantMax = quick ? budget : H_FULL_MAX;
      let need = !hCache || (!quick && hCache.max < H_FULL_MAX && hCache.list.length >= hCache.max);
      if (!need) {
        const vEff = psuMul(vPsu, hCache.shift);
        const focusInCache = psuApplyDisc(psuInv(vEff), [0, 0]);
        if (discDist(focusInCache, hCache.focus) >= H_REBUILD_DRIFT) need = true;
      }
      if (need) {
        const focus = psuApplyDisc(psuInv(vPsu), [0, 0]);
        hCache = { focus, shift: psuI(), max: wantMax, list: tilesPSU(D, A, { focus, radius: H_CACHE_RADIUS, max: wantMax }) };
      }
      return quick && hCache.list.length > budget ? hCache.list.slice(0, budget) : hCache.list;
    }
    const key = G.kind + ':' + radius.toFixed(2) + ':' + max;
    if (!cache.has(key)) { if (cache.size > 3) cache.clear(); cache.set(key, makeTiles(D, A, { radius, max })); }
    return cache.get(key);
  }

  // ---- drawing
  function draw() {
    raf = 0;
    if (!model) return;
    const t0 = performance.now();
    size();
    const { D, A, binding } = model, kind = G.kind, L = lay(), { cx, cy, R } = L;
    const n = D.n, list = tileList();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (kind !== 'E') { ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip(); }
    if (kind === 'H') {
      // the hyperbolic disc has infinitely many tiles toward its rim and only some thousands are drawn: what is left
      // of the rim gets the colour the tiles there would blur to, not the page's white
      const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const bg = A.stars.length ? mixc(FRONT, RED, 0.35) : FRONT;
      ctx.fillStyle = css(bg); ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    }

    const X = (p) => (kind === 'H' ? cx + (R * p[0]) / (1 + p[2]) : cx + R * p[0]);
    const Y = (p) => (kind === 'H' ? cy - (R * p[1]) / (1 + p[2]) : cy - R * p[1]);
    const lerp = (a, b, t) => G.norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    const lerpEdge = (a, b, u) => (kind === 'H' ? hypLerp(G, a, b, u) : lerp(a, b, u));
    const hypArcD = (path, ax, ay, sx1, sy1, bx, by, sx2, sy2, move) => {
      if (move) path.moveTo(sx1, sy1);
      const dx = sx2 - sx1, dy = sy2 - sy1, ch2 = dx * dx + dy * dy;
      const det2 = 2 * (ax * by - ay * bx);
      if (ch2 < 2.25 || Math.abs(det2) < 1e-6) { path.lineTo(sx2, sy2); return; }
      const r1 = 1 + ax * ax + ay * ay, r2 = 1 + bx * bx + by * by;
      const ux = (r1 * by - r2 * ay) / det2, uy = (ax * r2 - bx * r1) / det2;
      const rc2 = ux * ux + uy * uy - 1;
      if (!(rc2 > 0)) { path.lineTo(sx2, sy2); return; }
      const sr = R * Math.sqrt(rc2);
      if (sr > 2e5 || (sr > 4 && ch2 < 1.6 * sr)) { path.lineTo(sx2, sy2); return; }
      const scx = cx + R * ux, scy = cy - R * uy;
      const a1 = Math.atan2(sy1 - scy, sx1 - scx), a2 = Math.atan2(sy2 - scy, sx2 - scx);
      let da = a2 - a1;
      if (da > Math.PI) da -= TAU;
      else if (da < -Math.PI) da += TAU;
      path.arc(scx, scy, sr, a1, a2, da < 0);
    };
    const hypArc = (path, a, b, move) => {
      const za = 1 + a[2], zb = 1 + b[2];
      const ax = a[0] / za, ay = a[1] / za, bx = b[0] / zb, by = b[1] / zb;
      hypArcD(path, ax, ay, cx + R * ax, cy - R * ay, bx, by, cx + R * bx, cy - R * by, move);
    };
    // a small shape that need not be convex (the comma): on the sphere, whatever of it is behind the ball is pressed
    // onto the rim (the exact cut below pairs each way out with the next way in, which is only right for a convex tile)
    const blob = (path, pts) => {
      if (kind !== 'S') { path.moveTo(X(pts[0]), Y(pts[0])); for (let i = 1; i < pts.length; i++) path.lineTo(X(pts[i]), Y(pts[i])); return; }
      let front = 0;
      for (const p of pts) if (p[2] >= 0) front++;
      if (front < 3) return;
      pts.forEach((p, i) => {
        let x = p[0], y = p[1];
        if (p[2] < 0) { const l = Math.hypot(x, y) || 1; x /= l; y /= l; }
        if (i) path.lineTo(cx + R * x, cy - R * y); else path.moveTo(cx + R * x, cy - R * y);
      });
    };
    // a closed CONVEX outline given by points of the geometry, added to a path (on the sphere: only what faces the eye)
    const closed = (path, pts, flip, stroke = false) => {
      const m = pts.length;
      if (kind !== 'S') {
        const x0 = X(pts[0]), y0 = Y(pts[0]);
        path.moveTo(x0, y0);
        for (let i = 1; i < m; i++) path.lineTo(X(pts[i]), Y(pts[i]));
        if (stroke) path.lineTo(x0, y0);
        return;
      }
      let any = false, all = true;
      for (const p of pts) { if (p[2] >= 0) any = true; else all = false; }
      if (!any) return;
      if (all) {
        const x0 = X(pts[0]), y0 = Y(pts[0]);
        path.moveTo(x0, y0);
        for (let i = 1; i < m; i++) path.lineTo(X(pts[i]), Y(pts[i]));
        if (stroke) path.lineTo(x0, y0);
        return;
      }
      const rim = (a, b) => { const t = a[2] / (a[2] - b[2]), x = a[0] + t * (b[0] - a[0]), y = a[1] + t * (b[1] - a[1]), l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
      let i0 = 0;
      while (!(pts[(i0 + m - 1) % m][2] < 0 && pts[i0][2] >= 0)) i0++;
      const e0 = rim(pts[(i0 + m - 1) % m], pts[i0]);
      const x0 = cx + R * e0[0], y0 = cy - R * e0[1];
      path.moveTo(x0, y0);
      let out = null;
      for (let k = 0; k < m; k++) {
        const p = pts[(i0 + k) % m], q = pts[(i0 + k + 1) % m];
        if (p[2] >= 0) {
          if (out) { const e = rim(pts[(i0 + k + m - 1) % m], p); path.arc(cx, cy, R, -Math.atan2(out[1], out[0]), -Math.atan2(e[1], e[0]), !flip); out = null; }
          path.lineTo(cx + R * p[0], cy - R * p[1]);
          if (q[2] < 0) { out = rim(q, p); path.lineTo(cx + R * out[0], cy - R * out[1]); }
        }
      }
      if (out) path.arc(cx, cy, R, -Math.atan2(out[1], out[0]), -Math.atan2(e0[1], e0[0]), !flip);
      if (stroke) path.lineTo(x0, y0);
    };
    // an open line: a -> b along the geometry's straight line, in `steps` pieces (on the sphere: the visible part)
    const line = (path, a, b, steps) => {
      if (kind === 'H') { hypArc(path, a, b, true); return; }
      let on = false;
      for (let s = 0; s <= steps; s++) {
        const p = s === 0 ? a : s === steps ? b : lerpEdge(a, b, s / steps);
        if (kind === 'S' && p[2] < 0) { on = false; continue; }
        if (!on) { path.moveTo(X(p), Y(p)); on = true; } else path.lineTo(X(p), Y(p));
      }
    };
    const stepsFor = (a, b, minSteps = 1) => {
      if (kind === 'E') return 1;
      const d = G.dist(a, b);
      if (kind === 'S') return Math.max(Math.max(2, minSteps), Math.ceil(d / 0.11));
      const pxLen = Math.hypot(X(a) - X(b), Y(a) - Y(b));
      return Math.max(minSteps, Math.min(36, Math.ceil(Math.max(pxLen / 9, d * 3))));
    };

    // which corner class, star, glide the selected character stands for
    const pick = sel !== null && binding[sel] ? binding[sel] : null;
    const also = model.marks ? new Set(model.marks) : null;          // corner classes brought out together (a pair of features)
    const dim = pick || also ? 0.38 : 1;
    const needFill = kind !== 'H' || A.stars.length > 0;
    const showEdges = model.tileEdges !== false;
    const fill = new Path2D(), edge = [0, 1, 2].map(() => new Path2D());
    const ink = new Path2D();       // the print, in the darker tone
    // a comma of the print, carried to a tile; on a small tile it keeps every second or third of its points
    const print = (path, sh, M, b) => {
      const pts0 = sh.pts, nPts = pts0.length;
      if (!nPts) return;
      const skip = b ? Math.min(2 * b + 1, Math.max(1, Math.floor(nPts / 8))) : 1;
      if (kind === 'H') {
        const m0 = M[0], m1 = M[1], m2 = M[2], m3 = M[3], m4 = M[4], m5 = M[5], m6 = M[6], m7 = M[7], m8 = M[8];
        const p0 = pts0[0], z0 = R / (1 + m6 * p0[0] + m7 * p0[1] + m8 * p0[2]);
        path.moveTo(cx + (m0 * p0[0] + m1 * p0[1] + m2 * p0[2]) * z0, cy - (m3 * p0[0] + m4 * p0[1] + m5 * p0[2]) * z0);
        for (let i = skip; i < nPts; i += skip) {
          const p = pts0[i], z = R / (1 + m6 * p[0] + m7 * p[1] + m8 * p[2]);
          path.lineTo(cx + (m0 * p[0] + m1 * p[1] + m2 * p[2]) * z, cy - (m3 * p[0] + m4 * p[1] + m5 * p[2]) * z);
        }
        return;
      }
      if (kind === 'E') {
        const p0 = apply(M, pts0[0]);
        path.moveTo(cx + R * p0[0], cy - R * p0[1]);
        for (let i = skip; i < nPts; i += skip) { const q = apply(M, pts0[i]); path.lineTo(cx + R * q[0], cy - R * q[1]); }
        return;
      }
      const pts = [];
      for (let i = 0; i < nPts; i += skip) pts.push(apply(M, pts0[i]));
      blob(path, pts);
    };
    const mirrors = A.stars.map(() => [0, 1, 2].map(() => new Path2D())), glides = A.glides.map(() => [0, 1, 2].map(() => new Path2D()));
    const extras = (model.lines || []).map(() => [0, 1, 2].map(() => new Path2D()));          // the caller's own lines (a loop of the orbifold), tile by tile
    const marks = A.classes.map(() => new Path2D());
    const starOf = new Array(n).fill(-1);
    A.stars.forEach((s, k) => s.edges.forEach((e) => { starOf[e] = k; }));
    const hScale = kind === 'H' ? Math.min(0.75, Math.max(0.45, 0.30 * Math.sqrt(area))) : 0.45;
    const segBucket = (a, q) => {
      const midZ = (a[2] + q[2]) / Math.sqrt(Math.max(1e-12, 2 * (1 + a[2] * q[2] - a[0] * q[0] - a[1] * q[1])));
      const sPx = (hScale * R) / (1 + Math.min(a[2], q[2], midZ));
      return sPx >= 20 ? 0 : sPx >= 7 ? 1 : 2;
    };
    // the corner classes that get a mark, and from which corner each is drawn
    const marked = A.classes.filter((c) => c.n > 1).map((c) => {
      const ref = model.markRefs && model.markRefs[c.id];
      const v = ref ? ref.v : c.verts[0];
      let toward = null;
      if (!ref && c.kind === 'corner') { const en = c.ends[0]; toward = en.side === 'start' ? (en.e + 1) % n : en.e; }
      return { c, v, toward, dir: ref ? ref.dir : null };
    });
    let drawn = 0;
    const P = new Array(n);
    const vPsuEff = kind === 'H' ? (hCache ? psuMul(vPsu, hCache.shift) : vPsu) : null;
    const DX = kind === 'H' && n ? new Float64Array(n) : null;
    const DY = DX ? new Float64Array(n) : null;
    const SX = DX ? new Float64Array(n) : null;
    const SY = DX ? new Float64Array(n) : null;
    for (const t of list) {
      const M = kind === 'H' && t.g ? psuToSO21(psuMul(vPsuEff, t.g)) : mul(V, t.M);
      const c = apply(M, D.at);
      const ppu = kind === 'H' ? R / (1 + c[2]) : R, px = D.clear * ppu;
      for (let i = 0; i < n; i++) P[i] = apply(M, D.verts[i]);
      if (kind === 'S') { let vis = c[2] > 0; for (let i = 0; i < n && !vis; i++) if (P[i][2] > 0) vis = true; if (!vis) continue; }
      if (kind === 'E') { let inView = false; const m = reach * R + 4; if (X(c) > -m && X(c) < W + m && Y(c) > -m && Y(c) < H + m) inView = true; if (!inView) continue; }
      let b, effPx;
      if (kind === 'H') {
        const m6 = M[6], m7 = M[7], m8 = M[8];
        let minZ = c[2];
        for (let i = 0; i < n; i++) if (P[i][2] < minZ) minZ = P[i][2];
        for (let i = 0; i < hMidSamples.length; i++) {
          const s = hMidSamples[i], sz = m6 * s[0] + m7 * s[1] + m8 * s[2];
          if (sz < minZ) minZ = sz;
        }
        if (minZ > H_CULL_Z) continue;
        drawn++;
        effPx = (hScale * R) / (1 + minZ);
        b = effPx >= 20 ? 0 : effPx >= 7 ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const pi = P[i], invZ = 1 / (1 + pi[2]);
          const dx = pi[0] * invZ, dy = pi[1] * invZ;
          DX[i] = dx; DY[i] = dy;
          SX[i] = cx + R * dx; SY[i] = cy - R * dy;
        }
        if (n) {
          if (needFill) {
            fill.moveTo(SX[0], SY[0]);
            for (let i = 0; i < n; i++) {
              const j = i + 1 === n ? 0 : i + 1;
              hypArcD(fill, DX[i], DY[i], SX[i], SY[i], DX[j], DY[j], SX[j], SY[j], false);
            }
          }
          if (showEdges && effPx >= 2.0) {
            const ep = edge[b];
            ep.moveTo(SX[0], SY[0]);
            for (let i = 0; i < n; i++) {
              const j = i + 1 === n ? 0 : i + 1;
              hypArcD(ep, DX[i], DY[i], SX[i], SY[i], DX[j], DY[j], SX[j], SY[j], false);
            }
          }
        } else {
          if (needFill) fill.arc(cx, cy, R, 0, TAU);
        }
        for (let i = 0; i < n; i++) {
          if (starOf[i] >= 0) {
            const j = i + 1 === n ? 0 : i + 1;
            const mb = segBucket(P[i], P[j]);
            hypArcD(mirrors[starOf[i]][mb], DX[i], DY[i], SX[i], SY[i], DX[j], DY[j], SX[j], SY[j], true);
          }
        }
        A.glides.forEach((g, k) => { if (g.seg) { const ga = apply(M, g.seg[0]), gb = apply(M, g.seg[1]); hypArc(glides[k][segBucket(ga, gb)], ga, gb, true); } });
        (model.lines || []).forEach((ln, k) => { if (!ln.once) { const la = apply(M, ln.a), lb = apply(M, ln.b); hypArc(extras[k][segBucket(la, lb)], la, lb, true); } });
      } else {
        drawn++;
        effPx = px;
        b = effPx >= 20 ? 0 : effPx >= 7 ? 1 : 2;
        const pts = [];
        for (let i = 0; i < n; i++) {
          const a = P[i], q = P[(i + 1) % n], st = stepsFor(a, q);
          pts.push(a);
          for (let s = 1; s < st; s++) pts.push(lerpEdge(a, q, s / st));
        }
        if (n) { closed(fill, pts, t.flip, false); if (showEdges) closed(edge[b], pts, t.flip, true); }
        else fill.arc(cx, cy, R, 0, TAU);              // no edges: the one tile is the whole sphere
        for (let i = 0; i < n; i++) if (starOf[i] >= 0) line(mirrors[starOf[i]][b], P[i], P[(i + 1) % n], stepsFor(P[i], P[(i + 1) % n]));
        A.glides.forEach((g, k) => { if (g.seg) { const a = apply(M, g.seg[0]), q = apply(M, g.seg[1]); line(glides[k][b], a, q, kind === 'E' ? 1 : stepsFor(a, q, 2)); } });
        (model.lines || []).forEach((ln, k) => { if (ln.once) return; const a = apply(M, ln.a), q = apply(M, ln.b); line(extras[k][b], a, q, kind === 'E' ? 1 : stepsFor(a, q, 2)); });
      }
      if (kind === 'H') {
        for (let si = 0; si < des.length; si++) {
          const sh = des[si], q = apply(M, desAt[si] || D.at);
          const shPx = (hScale * R) / (1 + q[2]);
          if (shPx >= Math.max(1.2, sh.min || 0)) print(ink, sh, M, shPx >= 20 ? 0 : shPx >= 7 ? 1 : 2);
        }
      } else if (px >= 1.2) {
        for (const sh of des) if (px >= sh.min) print(ink, sh, M, b);
      }
      for (const mk of marked) {
        const p = P[mk.v];
        const mpx = kind === 'H' ? (hScale * R) / (1 + p[2]) : px;
        if (mpx < 4.5) continue;
        if (kind === 'S' && p[2] < 0.05) continue;
        let ang;
        if (mk.dir) {
          const u = apply(M, mk.dir);
          ang = kind === 'H'
            ? Math.atan2(-(u[1] * (1 + p[2]) - p[1] * u[2]), u[0] * (1 + p[2]) - p[0] * u[2])
            : Math.atan2(-u[1], u[0]);
        } else {
          const q = lerpEdge(p, mk.toward === null ? c : P[mk.toward], 0.06);
          ang = Math.atan2(Y(q) - Y(p), X(q) - X(p));
        }
        const on = (pick && pick.t === 'd' && pick.cls === mk.c.id) || (also && also.has(mk.c.id));
        const r = Math.min(on ? 9.5 : 6.5, (on ? 0.34 : 0.24) * mpx), x = X(p), y = Y(p), path = marks[mk.c.id];
        if (r < 1.1) continue;
        if (mk.c.n === 2) { const ux = Math.cos(ang), uy = Math.sin(ang), a1 = 1.25 * r, w = 0.95 * r; path.moveTo(x + a1 * ux, y + a1 * uy); path.quadraticCurveTo(x - w * uy, y + w * ux, x - a1 * ux, y - a1 * uy); path.quadraticCurveTo(x + w * uy, y - w * ux, x + a1 * ux, y + a1 * uy); }
        else { const m = mk.c.n, rr = r * (m === 3 ? 1.25 : 1.08), x0 = x + rr * Math.cos(ang), y0 = y + rr * Math.sin(ang); path.moveTo(x0, y0); for (let k = 1; k < m; k++) { const a = ang + (TAU * k) / m; path.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } path.lineTo(x0, y0); }
      }
    }
    stats = { tiles: list.length, drawn };

    if (needFill) { ctx.fillStyle = css(FRONT); ctx.fill(fill); }
    ctx.fillStyle = css(FRONT_INK); ctx.fill(ink);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (showEdges) [[0.9, 0.2], [0.7, 0.16], [0.5, 0.12]].forEach(([w, a], b) => { ctx.lineWidth = w; ctx.strokeStyle = css(DARK, a); ctx.stroke(edge[b]); });
    // mirrors and glide axes: red
    const widths = [2.1, 1.4, 0.8];
    A.stars.forEach((s, k) => {
      // chosen: bold. One of its corners chosen: left at full strength, since that corner is where these mirrors cross
      const on = pick && pick.t === '*' && pick.star === k, near = pick && pick.t === 'd' && pick.role === 'corner' && pick.star === k;
      ctx.strokeStyle = css(RED, on || near || !pick ? 1 : dim);
      mirrors[k].forEach((p, b) => { ctx.lineWidth = widths[b] * (on ? 1.7 : 1); ctx.stroke(p); });
    });
    A.glides.forEach((g, k) => {
      const on = pick && pick.t === 'x' && pick.k % A.glides.length === k;
      const a0 = on || !pick ? 1 : dim;
      glides[k].forEach((p, b) => { ctx.strokeStyle = css(RED, b === 2 ? a0 * 0.78 : a0); ctx.lineWidth = widths[b] * (on ? 1.7 : 1); ctx.setLineDash(b === 2 ? [] : [widths[b] * 3.2, widths[b] * 3]); ctx.stroke(p); });
      ctx.setLineDash([]);
    });
    // the caller's lines, in their own colour (never the mirrors' red or the gyration points' blue), thinner on small tiles
    (model.lines || []).forEach((ln, k) => {
      if (ln.once) return;
      const a0 = ln.alpha === undefined ? 1 : ln.alpha;
      extras[k].forEach((p, b) => { const f = [1, 0.7, 0.4][b]; ctx.strokeStyle = css(ln.color || DARK, b === 2 && ln.dash ? a0 * 0.78 : a0); ctx.lineWidth = (ln.width || 2) * f; ctx.setLineDash(b === 2 || !ln.dash ? [] : ln.dash.map((x) => x * f)); ctx.stroke(p); });
      ctx.setLineDash([]);
    });
    // the marked points: blue inside the surface (gyrations), red on a mirror. Drawn last, over the outlined tile,
    // whose coloured edges would otherwise cover the marks at its corners
    const drawMarks = () => {
      for (const mk of marked) {
        const on = (pick && pick.t === 'd' && pick.cls === mk.c.id) || (also && also.has(mk.c.id)), col = mk.c.kind === 'cone' ? BLUE : RED;
        ctx.fillStyle = css(col, on || !(pick || also) ? 1 : dim);
        ctx.fill(marks[mk.c.id]);
        ctx.lineWidth = on ? 1.6 : 1; ctx.strokeStyle = `rgba(255,255,255,${on || !(pick || also) ? 0.95 : 0.5})`;
        ctx.stroke(marks[mk.c.id]);
      }
    };

    // ---- the tile the surface is folded from
    const found = [], afterDots = [];
    home = null;
    {
      const M = kind === 'H' ? psuToSO21(psuMul(vPsu, bPsu)) : mul(V, base), Q = D.verts.map((v) => apply(M, v)), c = apply(M, D.at);
      const ppu = kind === 'H' ? R / (1 + c[2]) : R, px = D.clear * ppu;
      const visible = kind !== 'S' || c[2] > -0.2;
      if (n && visible && (px > 3 || model.outline === false)) {
        if (px > 3) home = [X(c), Y(c), px];          // its middle on the screen, and its room there in px
        if (model.outline !== false) {
          const flip = M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]) < 0;
          const out = new Path2D();
          if (kind === 'H') {
            out.moveTo(X(Q[0]), Y(Q[0]));
            for (let i = 0; i < n; i++) hypArc(out, Q[i], Q[(i + 1) % n], false);
          } else {
            const pts = [];
            for (let i = 0; i < n; i++) { const a = Q[i], q = Q[(i + 1) % n], st = stepsFor(a, q); pts.push(a); for (let s = 1; s < st; s++) pts.push(lerp(a, q, s / st)); }
            closed(out, pts, flip, true);
          }
          const glow = calm ? 0 : Math.max(0, 1 - (performance.now() - pulse) / 600);
          ctx.fillStyle = `rgba(255,255,255,${0.22 + 0.45 * glow})`; ctx.fill(out);
          if (glow > 0) schedule();
          ctx.lineWidth = 2.6; ctx.strokeStyle = css(DARK, 0.95); ctx.stroke(out);
          // mirrors of the tile on top of its outline, in red
          for (let i = 0; i < n; i++) if (starOf[i] >= 0) { const p = new Path2D(); line(p, Q[i], Q[(i + 1) % n], stepsFor(Q[i], Q[(i + 1) % n])); const on = pick && pick.t === '*' && pick.star === starOf[i]; ctx.strokeStyle = css(RED, on || !pick ? 1 : 0.6); ctx.lineWidth = on ? 4.4 : 3; ctx.stroke(p); }
          // glued edges: the two of a pair alike, in the pair's colour and with its number of arrowheads (pairs.js)
          const glued = [];
          for (let i = 0; i < n; i++) {
            const e = D.edges[i];
            if (e.mirror) continue;
            const a = Q[i], q = Q[(i + 1) % n], mid = lerp(a, q, 0.5), m2 = lerp(a, q, 0.56), st = stepsFor(a, q);
            const path = new Path2D(), poly = [];
            line(path, a, q, st);
            for (let j = 0; j <= st; j++) { const p = j === 0 ? a : j === st ? q : lerp(a, q, j / st); if (kind !== 'S' || p[2] >= 0) poly.push([X(p), Y(p)]); }
            if (poly.length < 2) continue;                                      // the whole edge is behind the ball
            const style = pairStyle(A.letter[i].charCodeAt(0) - 97), g = { key: A.letter[i], path, color: style.color, on: hot === A.letter[i], heads: [] };
            const lenPx = Math.hypot(X(a) - X(q), Y(a) - Y(q)), x = X(mid), y = Y(mid), facing = kind !== 'S' || mid[2] >= 0.02;
            if (facing && lenPx >= 16) {
              let dx = X(m2) - x, dy = Y(m2) - y;
              const l = Math.hypot(dx, dy) || 1;
              dx /= l; dy /= l;
              const along = e.to > i || e.rev ? 1 : -1;        // a ... a^-1: the second arrow runs against the outline
              const tx = dx * along, ty = dy * along, s = Math.min(8, lenPx / (2.6 + 1.4 * style.heads));
              if (s >= 2.4) for (let h = 0; h < style.heads; h++) { const off = (h - (style.heads - 1) / 2) * s * 1.3; g.heads.push([x + tx * off, y + ty * off, tx, ty, s]); }
            }
            glued.push(g);
            found.push({ letter: g.key, x: facing ? x : poly[0][0], y: facing ? y : poly[0][1], poly, color: style.color, heads: g.heads.length });
          }
          const chevron = (h) => { const [x, y, tx, ty, s] = h; ctx.beginPath(); ctx.moveTo(x - tx * s - ty * s * 0.75, y - ty * s + tx * s * 0.75); ctx.lineTo(x + tx * s * 0.7, y + ty * s * 0.7); ctx.lineTo(x - tx * s + ty * s * 0.75, y - ty * s - tx * s * 0.75); ctx.stroke(); };
          // white under every coloured stroke, so that a colour reads the same on a teal tile, a sand one and the print
          ctx.strokeStyle = 'rgba(255,255,255,0.92)';
          for (const g of glued) { ctx.lineWidth = g.on ? 10 : 6.6; ctx.stroke(g.path); }
          ctx.lineWidth = 5.4;
          for (const g of glued) g.heads.forEach(chevron);
          for (const g of glued) { ctx.strokeStyle = css(g.color, 1); ctx.lineWidth = g.on ? 5.8 : 3.4; ctx.stroke(g.path); ctx.lineWidth = 2.6; g.heads.forEach(chevron); }
        }
        // the caller's lines that are drawn once, in the outlined tile's own frame (one lift of a loop, a tree): annotations
        for (const ln of model.lines || []) {
          if (!ln.once) continue;
          const a = apply(M, ln.a), q = apply(M, ln.b), p = new Path2D();
          line(p, a, q, kind === 'E' ? 1 : stepsFor(a, q, ln.steps || 2));
          ctx.strokeStyle = css(ln.color || DARK, ln.alpha === undefined ? 1 : ln.alpha); ctx.lineWidth = ln.width || 2.4; ctx.setLineDash(ln.dash || []); ctx.stroke(p);
          ctx.setLineDash([]);
        }
        for (const dt of model.dots || []) {
          const q = apply(M, dt.p);
          if (kind === 'S' && q[2] < 0) continue;
          const item = { x: X(q), y: Y(q), dt };
          if (dt.after) { afterDots.push(item); continue; }
          ctx.beginPath(); ctx.arc(item.x, item.y, dt.r || 5, 0, TAU);
          ctx.fillStyle = css(dt.color || DARK, dt.alpha === undefined ? 1 : dt.alpha); ctx.fill();
          if (dt.stroke) { ctx.lineWidth = dt.strokeWidth || 1.2; ctx.strokeStyle = css(dt.stroke, 1); ctx.stroke(); }
        }
        // a wonder-ring chosen: its two wanderings, out of the tile across one glued edge and across the other
        if (pick && pick.t === 'o') {
          const turns = A.pairs.filter((p) => !p.rev).slice(2 * pick.k, 2 * pick.k + 2);
          ctx.strokeStyle = css(BLUE, 1); ctx.lineWidth = 2.6; ctx.setLineDash([2, 6]);
          for (const pr of turns) for (const i of [pr.i, pr.j]) {
            const mid = lerp(Q[i], Q[(i + 1) % n], 0.5), far = apply(mul(M, A.maps[i]), D.at), p = new Path2D();
            line(p, c, mid, Math.max(2, stepsFor(c, mid))); line(p, mid, far, Math.max(2, stepsFor(mid, far)));
            ctx.stroke(p);
          }
          ctx.setLineDash([]);
        }
      }
    }
    drawMarks();
    ctx.restore();
    hots = found;
    placeTip();

    // the edge of the world: the ball's limb, the disc's rim
    if (kind !== 'E') {
      if (kind === 'S') {
        const g = ctx.createRadialGradient(cx - 0.3 * R, cy - 0.35 * R, 0.1 * R, cx, cy, R);
        g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(10,20,30,0.3)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.lineWidth = 1.2; ctx.strokeStyle = css(DARK, 0.55); ctx.stroke();
    }
    for (const item of afterDots) {
      const dt = item.dt;
      ctx.beginPath(); ctx.arc(item.x, item.y, dt.r || 6, 0, TAU);
      ctx.fillStyle = css(dt.color || DARK, dt.alpha === undefined ? 1 : dt.alpha); ctx.fill();
      if (dt.stroke) { ctx.lineWidth = dt.strokeWidth || 1.2; ctx.strokeStyle = css(dt.stroke, 1); ctx.stroke(); }
    }
    // Keep 60+ fps smooth with EMA hysteresis and zero frame-to-frame budget oscillation
    if (quick && kind === 'H') {
      const ms = performance.now() - t0;
      emaMs = 0.75 * emaMs + 0.25 * ms;
      if (emaMs > 14) budget = Math.max(600, Math.round(budget * 0.85));
      else if (emaMs < 8 && budget < H_FULL_MAX) budget = Math.min(H_FULL_MAX, Math.round(budget * 1.15));
    }
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

  // ---- the note on a glued edge of the outlined tile
  /** The glued edge that passes within r px of a point of the canvas, or null. */
  function spotAt(x, y, r) {
    let best = null, bd = r;
    for (const h of hots) for (let i = 0; i + 1 < h.poly.length; i++) {
      const p = h.poly[i], q = h.poly[i + 1], vx = q[0] - p[0], vy = q[1] - p[1], t = Math.max(0, Math.min(1, ((x - p[0]) * vx + (y - p[1]) * vy) / (vx * vx + vy * vy || 1)));
      const d = Math.hypot(x - p[0] - t * vx, y - p[1] - t * vy);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }
  function placeTip() {
    if (!tipEl) return;
    const all = hot === null ? [] : hots.filter((h) => h.letter === hot);
    if (!all.length) { tipEl.hidden = true; if (hot !== null && !hots.some((h) => h.letter === hot)) hot = null; return; }
    const h = all.reduce((a, b) => (b.y < a.y ? b : a));                // the upper of its edges: the note sits above it
    tipEl.textContent = all.length > 1 ? 'These two edges are glued to each other, arrow onto arrow, when the pattern folds up.' : 'This edge is glued to the other one of its colour, arrow onto arrow, when the pattern folds up.';
    tipEl.hidden = false;
    const half = Math.min(118, W / 2 - 6), below = h.y < 96;
    tipEl.style.left = canvas.offsetLeft + Math.max(half + 6, Math.min(W - half - 6, h.x)) + 'px';
    tipEl.style.top = canvas.offsetTop + h.y + 'px';
    tipEl.toggleAttribute('data-below', below);
  }
  function setHot(letter) {
    if (letter === hot) return;
    hot = letter;
    schedule();
  }

  // ---- sliding the pattern about
  let drag = null, lastTap = 0, still = 0;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  // A slide coasts on a little once the hand lets go, and slows to a stop (his ask, Sat 21 Nov 2026 10:47: "add slight
  // inertia for when I slide things"). Shepherd, the page's own agent, added it to the live page at 10:49 by editing the
  // built file; this is that glide in the source, with its numbers: the speed is the hand's over its last 90 ms, none
  // below 0.12 px per ms or once the hand rested 70 ms before letting go, at most 2.5 px per ms, and it falls to a third
  // in about a fifth of a second. Each frame moves the point under the place the hand let go, as one more step of the
  // drag would. A new touch, a wheel, a key, a reset or a pattern from another screen stops it; reduced motion has none.
  let coast = 0;
  const FADE = 200, MIN_SPEED = 0.12, MAX_SPEED = 2.5;      // ms; px per ms
  const stopCoast = () => { if (coast) { cancelAnimationFrame(coast); coast = 0; } };
  function release(was, t) {
    const pts = was.trail;
    if (calm || !pts || pts.length < 2 || typeof requestAnimationFrame !== 'function') return false;
    const last = pts[pts.length - 1];
    if (t - last.t > 70) return false;                         // the hand stopped before it let go
    let first = last;
    for (let i = pts.length - 2; i >= 0 && last.t - pts[i].t <= 90; i--) first = pts[i];
    const dt = last.t - first.t;
    if (dt < 8) return false;
    let vx = (last.x - first.x) / dt, vy = (last.y - first.y) / dt;
    const s = Math.hypot(vx, vy);
    if (s < MIN_SPEED) return false;
    if (s > MAX_SPEED) { vx *= MAX_SPEED / s; vy *= MAX_SPEED / s; }
    const x = last.x, y = last.y;
    let prev = performance.now();
    const step = (now) => {
      coast = 0;
      if (!model) return;
      const dt2 = Math.min(50, Math.max(0, now - prev)), k = Math.exp(-dt2 / FADE);
      prev = now;
      const dx = vx * FADE * (1 - k), dy = vy * FADE * (1 - k);
      vx *= k; vy *= k;
      if (dx || dy) {
        const T = G.translate(unproject(x, y), unproject(x + dx, y + dy));
        if (G.kind === 'H') {
          vPsu = psuMul(so21ToPSU(T, false), vPsu);
          V = psuToSO21(vPsu); vRev = !!vPsu[4];
        } else {
          V = G.fix(mul(T, V), vHand());
        }
        recentre(null);
      }
      if (Math.hypot(vx, vy) > 0.02) {
        quick = true;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        draw();
        coast = requestAnimationFrame(step);
        return;
      }
      const moved = settle();                                                 // the outlined tile went out of sight: it comes back
      clearTimeout(still); quick = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (moved || model.outline !== false || (G.kind === 'H' && (!hCache || (hCache.max < H_FULL_MAX && hCache.list.length >= hCache.max)))) draw();
    };
    coast = requestAnimationFrame(step);
    return true;
  }
  canvas.addEventListener('pointerdown', (e) => {
    stopCoast();
    if (!model || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const [x, y] = local(e);
    drag = { id: e.pointerId, p0: unproject(x, y), V0: V.slice(), v0Psu: G.kind === 'H' ? vPsu.slice() : null, x, y, moved: false, trail: [{ x, y, t: performance.now() }] };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer: no capture, the drag still works */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) {
      // a mouse resting on a glued edge of the outlined tile: say what it is
      if (model && e.pointerType === 'mouse') { const [hx, hy] = local(e), h = spotAt(hx, hy, 9); setHot(h ? h.letter : null); }
      return;
    }
    if (drag.id !== e.pointerId) return;
    const [x, y] = local(e);
    const t = performance.now();
    drag.trail.push({ x, y, t });
    while (drag.trail.length > 2 && t - drag.trail[0].t > 120) drag.trail.shift();
    if (Math.hypot(x - drag.x, y - drag.y) > 3) drag.moved = true;
    if (!drag.moved) return;
    setHot(null);
    const p = unproject(x, y);
    const T = G.translate(drag.p0, p);
    if (G.kind === 'H') {
      vPsu = psuMul(so21ToPSU(T, false), drag.v0Psu);
      V = psuToSO21(vPsu); vRev = !!vPsu[4];
      drag.v0Psu = recentre(drag.v0Psu);
      // a very long stroke: start afresh from here, so that no huge slide has to be undone by a huge view
      if (G.dist(drag.p0, p) > 2.6) { drag.p0 = p; drag.v0Psu = vPsu.slice(); drag.V0 = V.slice(); }
    } else {
      V = G.fix(mul(T, drag.V0), vHand());
      drag.V0 = recentre(drag.V0);
    }
    quick = true; clearTimeout(still);
    schedule();
  });
  const up = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const was = drag;
    drag = null;
    if (!was.moved) {
      // a tap on a glued edge: its note, and off again on the next tap
      const h = spotAt(was.x, was.y, 20);
      if (e.pointerType !== 'mouse') setHot(h && h.letter !== hot ? h.letter : null);
      const now = performance.now();
      if (now - lastTap < 320) { api.resetView(); lastTap = 0; } else lastTap = now;
      return;
    }
    if (e.type === 'pointerup' && release(was, performance.now())) return;     // it coasts, and settles when it stops
    const moved = settle();
    if (moved) schedule();                                           // the outlined tile was dragged out of sight: it comes back
    still = setTimeout(() => {
      const wasTruncated = G.kind === 'H' && (!hCache || (hCache.max < H_FULL_MAX && hCache.list.length >= hCache.max));
      quick = false;
      if (moved || model.outline !== false || wasTruncated) schedule();
    }, 140);      // the far rim is filled in once the hand is still
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  // A trackpad's two-finger swipe slides the pattern as well (Shepherd's change on the live page, Sat 21 Nov 2026
  // 20:15, for his note that on the MacBook's trackpad a finger drag only zoomed): a wheel without ctrl moves the point
  // under the pointer by the scroll, the way the fingers go with natural scrolling; a mouse wheel slides it too. A
  // pinch does nothing here.
  canvas.addEventListener('wheel', (e) => {
    if (!model || e.ctrlKey) return;
    e.preventDefault();
    stopCoast();
    let dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 30; dy *= 30; } else if (e.deltaMode === 2) { dx *= 300; dy *= 300; }
    dx = Math.max(-240, Math.min(240, dx)); dy = Math.max(-240, Math.min(240, dy));
    if (!dx && !dy) return;
    const [x, y] = local(e);
    setHot(null);
    const T = G.translate(unproject(x, y), unproject(x - dx, y - dy));
    if (G.kind === 'H') {
      vPsu = psuMul(so21ToPSU(T, false), vPsu);
      V = psuToSO21(vPsu); vRev = !!vPsu[4];
    } else {
      V = G.fix(mul(T, V), vHand());
    }
    recentre(null);
    quick = true; clearTimeout(still);
    still = setTimeout(() => {
      const moved = settle();
      const wasTruncated = G.kind === 'H' && (!hCache || (hCache.max < H_FULL_MAX && hCache.list.length >= hCache.max));
      quick = false;
      if (moved || model.outline !== false || wasTruncated) schedule();
    }, 180);     // the outline comes back once it rests
    schedule();
  }, { passive: false });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) setHot(null); });
  canvas.addEventListener('keydown', (e) => {
    if (!model) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (e.key === '0' || e.key === 'Home') { api.resetView(); e.preventDefault(); return; }
    if (!d) return;
    e.preventDefault();
    stopCoast();
    const step = G.kind === 'E' ? 0.5 * Math.sqrt(area) : G.kind === 'S' ? 0.2 : 0.35;
    const T = G.translate(G.origin, G.polar(step, Math.atan2(d[1], d[0])));
    if (G.kind === 'H') {
      vPsu = psuMul(so21ToPSU(T, false), vPsu);
      V = psuToSO21(vPsu); vRev = !!vPsu[4];
    } else {
      V = G.fix(mul(T, V), vHand());
    }
    recentre(null);
    settle();
    schedule();
  });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (model) schedule(); }).observe(canvas);

  const api = {
    /**
     * A new pattern. o.keepView: it is the last one a little changed (a knob moved its tile), so the view, the
     * outline's place and the chosen character stay. o.moving: more such changes follow at once, so draw as during a
     * drag (on the hyperbolic plane: the nearest tiles only) and fill in when they stop.
     */
    set(m, o = {}) {
      stopCoast();
      hot = null; hots = []; home = null; if (tipEl) tipEl.hidden = true;
      if (!m) { model = null; G = null; sel = null; hCache = null; hMidSamples = []; des = []; desAt = []; stats = { tiles: 0, drawn: 0 }; size(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); return; }      // a signature no pattern has
      const keep = !!(o.keepView && model && G && G.kind === m.D.G.kind);
      model = m; G = m.D.G; if (!keep) sel = null; quick = false;
      cache = new Map();
      hCache = null;
      hMidSamples = [];
      if (G.kind === 'H' && m.D.n) {
        const Dn = m.D.n, Dv = m.D.verts;
        for (let i = 0; i < Dn; i++) {
          const a = Dv[i], b = Dv[(i + 1) % Dn], len = G.dist(a, b);
          if (len > 2.0) {
            const k = Math.ceil(len / 2.0);
            for (let s = 1; s < k; s++) hMidSamples.push(hypLerp(G, a, b, s / k));
          }
        }
      }
      reach = m.D.n ? Math.max(...m.D.verts.map((v) => G.dist(v, m.D.at))) : 0;
      area = m.D.n ? Math.abs(G.area(m.D.verts)) || 1 : 1;
      des = (m.design || design)(m.D);
      desAt = des.map((sh) => {
        if (!sh.pts || !sh.pts.length) return m.D.at;
        const s = [0, 0, 0];
        for (const p of sh.pts) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
        return G.norm(s);
      });
      size();
      if (!keep) { emaMs = 8; budget = H_FULL_MAX; firstView(); }
      else {
        if (G.kind === 'H') {
          if (!isIdentityPsu(bPsu)) {
            const vWorld = psuMul(vPsu, bPsu);
            if (Number.isFinite(vWorld[0]) && Number.isFinite(vWorld[1]) && Math.hypot(vWorld[0], vWorld[1]) < 150) {
              if (drag && drag.v0Psu) drag.v0Psu = psuMul(drag.v0Psu, bPsu);
              vPsu = vWorld; V = psuToSO21(vPsu); vRev = !!vPsu[4];
            }
            bPsu = psuI(); base = I3.slice(); bRev = false;
          }
          if (drag && drag.v0Psu) drag.v0Psu = recentre(drag.v0Psu);
          else recentre(null);
        } else if (G.kind === 'E') {
          if (Math.hypot(base[2], base[5]) > 1e-12 || Math.abs(base[0] - 1) > 1e-12 || Math.abs(base[1]) > 1e-12 || bRev) {
            if (drag && drag.V0) drag.V0 = G.fix(mul(drag.V0, base), vHand() * bHand());
            V = G.fix(mul(V, base), vHand() * bHand());
            vRev = vRev !== bRev;
            base = I3.slice(); bRev = false;
          }
          if (drag && drag.V0) drag.V0 = recentre(drag.V0);
          else recentre(null);
        }
        if (o.moving) { quick = true; clearTimeout(still); still = setTimeout(() => { quick = false; schedule(); }, 180); }
      }
      draw();
    },
    select(i) { sel = i; schedule(); },
    resetView() { stopCoast(); if (!model) return; hCache = null; emaMs = 8; budget = H_FULL_MAX; firstView(); quick = false; schedule(); },
    /** Where the pattern and its outlined tile are on the screen, to hand to another screen: { V, base, turned } (turned: base turns the plane over; null: no pattern). */
    getView() { return model ? { V: V.slice(), base: base.slice(), turned: bRev } : null; },
    /** Put the pattern where another screen has it (what its getView() gave). Anything else is left alone. */
    setView(v, o = {}) {
      const nine = (m) => Array.isArray(m) && m.length === 9 && m.every(Number.isFinite);
      if (!model || !v || !nine(v.V) || !nine(v.base)) return false;
      stopCoast();
      vRev = det(v.V) < 0; bRev = !!v.turned;              // V is always near the middle of the view: its determinant can be trusted
      V = G.fix(v.V, vHand()); base = G.fix(v.base, bHand());
      vPsu = G.kind === 'H' ? so21ToPSU(V, vRev) : psuI();
      bPsu = G.kind === 'H' ? so21ToPSU(base, bRev) : psuI();
      if (hCache && !isIdentityPsu(hCache.shift)) hCache = null;
      quick = !!o.moving;
      if (o.sync) draw(); else schedule();
      return true;
    },
    /** Where a point of the outlined tile (in the tile's own coordinates) is on the canvas, in css px: [x, y]; null with no pattern. */
    projectTile(p) { if (!model) return null; const L = lay(), q = apply(G.kind === 'H' ? psuToSO21(psuMul(vPsu, bPsu)) : mul(V, base), p), k = G.kind === 'H' ? 1 / (1 + q[2]) : 1; return [L.cx + L.R * q[0] * k, L.cy - L.R * q[1] * k]; },
    draw, redraw: schedule,
    /** For the tests: bring out a glued pair as a pointer on it does. Pairs are named a, b, ... in the order they are met going round the tile (null: none). */
    point(letter) { setHot(letter); if (model) draw(); },
    state: () => ({ kind: G && G.kind, ...stats, V: V.slice(), base: base.slice(), sel, turned: bRev, shapes: des.length, home: home && home.slice(), hot, edges: hots.map((h) => ({ letter: h.letter, x: Math.round(h.x), y: Math.round(h.y), color: css(h.color), heads: h.heads })) }),
  };
  return api;
}
