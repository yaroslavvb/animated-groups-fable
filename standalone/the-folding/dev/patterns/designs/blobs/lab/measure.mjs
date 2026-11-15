// lab/measure.mjs — the numbers a stroke is judged by, straight from u on the torus grid (no polygons, so it is fast
// enough to search with). Lengths in tile sizes.
import { solve, labelTorus, spine, firstStroke, strokeBeads } from '../design.js';
import { buildDomain } from '../../../../../src/domain.js';

/** 8SED on the torus grid: for every sample the offset (di, dj) to the nearest sample with site[p], and the distance. */
export function nearest(site, fld) {
  const { N1, N2, a1x, a1y, a2x, a2y } = fld, n = N1 * N2, INF = 30000;
  const di = new Int16Array(n), dj = new Int16Array(n), best = new Float64Array(n);
  for (let p = 0; p < n; p++) if (site[p]) { best[p] = 0; } else { di[p] = INF; best[p] = Infinity; }
  const d2 = (i, j) => { const x = i * a1x + j * a2x, y = i * a1y + j * a2y; return x * x + y * y; };
  const relax = (p, i, j, ni, nj) => {
    const q = ((j + nj + N2) % N2) * N1 + ((i + ni + N1) % N1);
    if (di[q] === INF) return;
    const ci = ni + di[q], cj = nj + dj[q], cd = d2(ci, cj);
    if (cd < best[p]) { best[p] = cd; di[p] = ci; dj[p] = cj; }
  };
  for (let it = 0; it < 3; it++) {
    for (let j = 0; j < N2; j++) {
      for (let i = 0; i < N1; i++) { const p = j * N1 + i; if (!best[p]) continue; relax(p, i, j, -1, -1); relax(p, i, j, 0, -1); relax(p, i, j, 1, -1); relax(p, i, j, -1, 0); }
      for (let i = N1 - 1; i >= 0; i--) { const p = j * N1 + i; if (!best[p]) continue; relax(p, i, j, 1, 0); }
    }
    for (let j = N2 - 1; j >= 0; j--) {
      for (let i = N1 - 1; i >= 0; i--) { const p = j * N1 + i; if (!best[p]) continue; relax(p, i, j, 1, 1); relax(p, i, j, 0, 1); relax(p, i, j, -1, 1); relax(p, i, j, 1, 0); }
      for (let i = 0; i < N1; i++) { const p = j * N1 + i; if (!best[p]) continue; relax(p, i, j, -1, 0); }
    }
  }
  const dist = new Float64Array(n);
  for (let p = 0; p < n; p++) dist[p] = Math.sqrt(best[p]);
  return { di, dj, dist };
}

/** The narrowest place of the region { !site }: the least distance between two of its banks that face each other. */
function narrowest(site, near, fld, h) {
  const { N1, N2, a1x, a1y, a2x, a2y } = fld, { di, dj, dist } = near;
  let w = Infinity;
  for (let j = 0; j < N2; j++) for (let i = 0; i < N1; i++) {
    const p = j * N1 + i;
    if (site[p]) continue;
    for (const [si, sj] of [[1, 0], [0, 1]]) {
      const q = ((j + sj) % N2) * N1 + ((i + si) % N1);
      if (site[q]) continue;
      const ei = si + di[q] - di[p], ej = sj + dj[q] - dj[p];
      const sep = Math.hypot(ei * a1x + ej * a2x, ei * a1y + ej * a2y);
      if (sep > 3 * h && sep >= 0.8 * (dist[p] + dist[q])) w = Math.min(w, sep - 0.9 * h);
    }
  }
  return w;
}

function hull(pts) {                                        // Andrew's monotone chain; pts [[x, y]...]
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let k = pts.length - 1; k >= 0; k--) { const p = pts[k]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

const tiles = new WeakMap();
/** The default tile of a group of src/groups.js, in the frame: [[x, y]...] counter-clockwise. */
export function tileInFrame(group, F) {
  let t = tiles.get(group);
  if (!t) {
    const d = buildDomain(group, { seed: group.presets[0].seed, metric: group.presets[0].metric });
    t = d.poly.map((p) => F.toF(p[0], p[1]));
    tiles.set(group, t);
  }
  return t;
}
/** Is (x, y) inside the convex counter-clockwise polygon, at least `margin` from every side? */
function insidePoly(poly, x, y, margin = 0) {
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1];
    if ((ex * (y - a[1]) - ey * (x - a[0])) / Math.hypot(ex, ey) < margin) return false;
  }
  return true;
}
/** The length of a stroke's spine and how far its heading turns in all (radians, every bend counted). */
export function spineShape(stroke) {
  const S = spine(firstStroke(stroke), 96);
  let turn = 0, signed = 0, prev = null;
  for (let i = 0; i < S.n; i++) {
    const a = Math.atan2(S.y[i + 1] - S.y[i], S.x[i + 1] - S.x[i]);
    if (prev !== null) { const d = Math.atan2(Math.sin(a - prev), Math.cos(a - prev)); turn += Math.abs(d); signed += d; }
    prev = a;
  }
  // wiggle: the turning against the spine's main sense (an S-bend or a kink); a comma's spine turns one way only
  return { len: S.len, turn, signed, wiggle: (turn - Math.abs(signed)) / 2 };
}
/** How many pieces the light part of the torus is in (1: one sea round every blob; more: a blob has a hole). */
function lightPieces(dark, fld) {
  const { N1, N2 } = fld, n = N1 * N2, lab = new Int32Array(n).fill(-1), stack = new Int32Array(n);
  let count = 0;
  for (let p0 = 0; p0 < n; p0++) {
    if (dark[p0] || lab[p0] >= 0) continue;
    let top = 0; stack[top++] = p0; lab[p0] = count;
    while (top) {
      const p = stack[--top], i = p % N1, j = (p - i) / N1;
      for (const q of [j * N1 + ((i + 1) % N1), j * N1 + ((i + N1 - 1) % N1), ((j + 1) % N2) * N1 + i, ((j + N2 - 1) % N2) * N1 + i]) if (!dark[q] && lab[q] < 0) { lab[q] = count; stack[top++] = q; }
    }
    count++;
  }
  return count;
}

/**
 * Everything about a stroke on a group. opts.h: the grid step; opts.cover: the wanted dark share.
 * Returns { cover, wanted, valid, marks, sym, bare, solid, gap, thin, inTile, dent, length, ms }.
 */
export function analyse(group, stroke, opts = {}) {
  const h = opts.h || 0.02, t0 = performance.now();
  const S = solve(group, stroke, { h, cover: opts.cover, settle: false });
  const { F, fld } = S, { N1, N2, a1x, a1y, a2x, a2y } = fld, n = N1 * N2;
  // an endless band, or a symmetric blob (one that an element of the group keeps), is no comma: less dark until there
  // is none (the largest dark share at which every blob is a bounded, asymmetric island, by bisection)
  let L = S.L, c = S.c, cv = S.cover;
  const good = (M) => M.comps.every((k) => !k.wraps && k.stab === 1);
  if (!good(L)) {
    let lo = 0.08, hi = cv;
    for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2; if (good(labelTorus(fld, S.levelAt(mid), F))) lo = mid; else hi = mid; }
    cv = lo; c = S.levelAt(cv); L = labelTorus(fld, c, F);
    if (opts.quick) return { cover: cv, wanted: S.wanted, valid: false, marks: 1, sym: 0, bare: 1, solid: 0, gap: 0, thin: 0, inTile: 0, dent: 0, asym: 0, length: 0, level: 1, holes: 0, turn: 9, nose: 0, quick: true };
  }
  const valid = good(L);
  const dark = new Uint8Array(n), light = new Uint8Array(n);
  for (let p = 0; p < n; p++) { dark[p] = L.par[p] >= 0 ? 1 : 0; light[p] = 1 - dark[p]; }
  const toDark = nearest(dark, fld), toLight = nearest(light, fld);
  let bare = 0, solid = 0, bareAt = 0, solidAt = 0;
  for (let p = 0; p < n; p++) {
    if (dark[p]) { if (toLight.dist[p] > solid) { solid = toLight.dist[p]; solidAt = p; } }
    else if (toDark.dist[p] > bare) { bare = toDark.dist[p]; bareAt = p; }
  }
  const atF = (p) => { const i = p % N1, j = (p - i) / N1; return [i * a1x + j * a2x, i * a1y + j * a2y]; };
  const gap = narrowest(dark, toDark, fld, h), thin = narrowest(light, toLight, fld, h);
  // the home blob: the one under the fattest place of the stroke
  const res = { cover: cv, wanted: S.wanted, valid, marks: L.orbits, blobs: L.comps.length / F.reps.length, sym: L.comps.filter((k) => k.stab > 1).length,
    bare: 2 * bare, solid: 2 * solid, gap, thin, inTile: 0, dent: 0, asym: 0, length: 0, level: c, holes: lightPieces(dark, fld) - 1, turn: spineShape(stroke).turn,
    bareAt: atF(bareAt), solidAt: atF(solidAt), wiggle: spineShape(stroke).wiggle };
  const st0 = firstStroke(stroke), th = st0.th || 0, beads = Array.isArray(stroke) ? strokeBeads(st0) : S.beads;
  let hb = 4 * Math.min(beads.length / 4 - 1, 1 + Math.round(th * (beads.length / 4 - 2)));
  const hxF = beads[hb], hyF = beads[hb + 1];
  const Ih = Math.round((N1 * (hxF * F.E2[1] - hyF * F.E2[0])) / fld.det), Jh = Math.round((N2 * (F.E1[0] * hyF - F.E1[1] * hxF)) / fld.det);
  const hp = (((Jh % N2) + N2) % N2) * N1 + (((Ih % N1) + N1) % N1);
  if (L.par[hp] >= 0) {
    const root = L.find(hp), hx0 = L.dx[hp], hy0 = L.dy[hp], pts = [], cells = new Set();
    const tile = group.presets ? tileInFrame(group, F) : null;
    let inside = 0, mx = 0, my = 0;
    for (let p = 0; p < n; p++) {
      if (L.par[p] < 0 || L.find(p) !== root) continue;
      const I = Ih + L.dx[p] - hx0, J = Jh + L.dy[p] - hy0, x = I * a1x + J * a2x, y = I * a1y + J * a2y;
      pts.push([x, y]); cells.add((I + 4096) * 8192 + (J + 4096));
      mx += x; my += y;
      if (tile && insidePoly(tile, x, y, opts.margin ?? 0.04)) inside++;
    }
    // how unlike its own mirror images and its own half-turn the blob is: 1 - the largest share of it that such an
    // image (about its centroid) covers. A drop or a crescent has a mirror image that covers it (no hand), an S a
    // half-turn that does (no direction): near 0. A comma: 0.3 and more.
    mx /= pts.length; my /= pts.length;
    const has = (x, y) => { const I = Math.round((N1 * (x * F.E2[1] - y * F.E2[0])) / fld.det), J = Math.round((N2 * (F.E1[0] * y - F.E1[1] * x)) / fld.det); return cells.has((I + 4096) * 8192 + (J + 4096)); };
    let most = 0;
    for (let k = -1; k < 24; k++) {
      let hit = 0;
      if (k < 0) { for (const q of pts) if (has(2 * mx - q[0], 2 * my - q[1])) hit++; }
      else {
        const co = Math.cos((2 * Math.PI * k) / 24), si = Math.sin((2 * Math.PI * k) / 24);       // the mirror at angle pi k / 24
        for (const q of pts) { const dx = q[0] - mx, dy = q[1] - my; if (has(mx + co * dx + si * dy, my + si * dx - co * dy)) hit++; }
      }
      most = Math.max(most, hit / pts.length);
    }
    res.asym = 1 - most;
    res.inTile = tile ? inside / pts.length : 1;
    res.share = (pts.length * Math.abs(fld.det)) / (N1 * N2);       // the area of the home blob, in tiles (domainArea = 1 in the frame)
    const H = hull(pts);
    let A = 0, len = 0;
    for (let i = 0; i < H.length; i++) { const j = (i + 1) % H.length; A += H[i][0] * H[j][1] - H[j][0] * H[i][1]; }
    for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) len = Math.max(len, Math.hypot(H[i][0] - H[j][0], H[i][1] - H[j][1]));
    res.dent = 1 - res.share / (A / 2);
    res.length = len;
  }
  res.nose = (st0.th || 0) > 0 ? st0.th + 0.5 * (1 - (st0.r0 ?? st0.rh) / st0.rh) : 0;       // how far the head end is from a round head
  res.ms = performance.now() - t0;
  return res;
}

/** One number, smaller is better. */
export function score(m, W = {}) {
  const w = { bare: 1, gap: 8, gapWant: 0.1, solid: 3, solidMax: 0.66, head: 0.6, headWant: 0.46, inTile: 3, cover: 6, marks: 0.6, thin: 6, thinWant: 0.05,
    dent: 0.5, dentWant: 0.16, asym: 3, asymWant: 0.28, nose: 0.25, level: 0.4, levelSpan: 0.9, holes: 1, turn: 0.4, turnWant: 0.8, ...W };
  let s = w.bare * m.bare;
  s += w.gap * Math.max(0, w.gapWant - m.gap);
  s += w.thin * Math.max(0, w.thinWant - m.thin);
  s += w.solid * Math.max(0, m.solid - w.solidMax);
  s += w.head * Math.max(0, w.headWant - m.solid);
  s += w.inTile * (1 - m.inTile);
  s += w.cover * Math.max(0, m.wanted - m.cover);
  s += w.marks * Math.max(0, m.marks - 1);
  s += w.dent * Math.max(0, w.dentWant - m.dent);
  s += w.asym * Math.max(0, w.asymWant - m.asym);
  s += w.nose * (m.nose || 0);
  s += w.level * Math.max(0, Math.abs(Math.log(Math.max(1e-6, m.level))) - w.levelSpan);
  s += w.holes * m.holes;
  s += w.turn * Math.max(0, w.turnWant - m.turn);
  // round 5 (13 Nov 2026, second run): what the eye objected to in the first run's triangles. All off unless W sets them.
  s += (w.wiggle || 0) * Math.max(0, (m.wiggle || 0) - (w.wiggleFree ?? 0.2));          // an S-bend or a kink in the spine
  s += (w.bareHinge || 0) * Math.max(0, m.bare - (w.bareMax ?? 0.42));                   // the bare disc above its target
  s += (w.loop || 0) * Math.max(0, m.turn - (w.turnMax ?? 3.4));                         // a spine that winds round
  s += (w.coverLow || 0) * Math.max(0, (w.coverMin ?? 0.47) - m.cover);                  // less dark than wanted
  if (!m.valid) s += 5;
  return s;
}
