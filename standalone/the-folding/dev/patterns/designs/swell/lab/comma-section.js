// The comma: a tapered stroke whose spine starts at the head and winds around the partner's head
// ---------------------------------------------------------------------------------------------------------------

function profileOf(n, K) {
  const ts = new Float64Array(n), P = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = 1 - Math.pow(1 - i / (n - 1), K.crowd);
    ts[i] = t; P[i] = Math.max(Math.pow(0.5 * (1 + Math.cos(Math.PI * t)), K.taper), K.pFloor);
  }
  return { ts, P, n };
}

const FINE = 48;
const fineX = new Float64Array(FINE + 1), fineY = new Float64Array(FINE + 1), fineL = new Float64Array(FINE + 1);

/**
 * The spine, from the head h around the partner's head p: in polar coordinates about p, the angle a0 + sgn sweep s and
 * the distance rw + (D - rw) (1 - s)^m (D = |h - p|, s from 0 at the head to 1 at the tip). m = 1 leaves the head
 * sideways (the yin-yang); a larger m dives toward the partner first and then winds round it (a partner far away). The
 * discs sit at the shares ts of its length. Returns D.
 */
function spineInto(h, p, sweep, rw, m, sgn, pr, X, Y) {
  const dx = h[0] - p[0], dy = h[1] - p[1], D = hyp(dx, dy), a0 = Math.atan2(dy, dx);
  for (let j = 0; j <= FINE; j++) {
    const s = j / FINE, rho = rw + (D - rw) * Math.pow(1 - s, m), a = a0 + sgn * sweep * s;
    fineX[j] = p[0] + rho * Math.cos(a); fineY[j] = p[1] + rho * Math.sin(a);
    fineL[j] = j ? fineL[j - 1] + hyp(fineX[j] - fineX[j - 1], fineY[j] - fineY[j - 1]) : 0;
  }
  const L = fineL[FINE];
  for (let i = 0, j = 0; i < pr.n; i++) {
    const want = pr.ts[i] * L;
    while (j < FINE - 1 && fineL[j + 1] < want) j++;
    const seg = fineL[j + 1] - fineL[j], f = seg > 0 ? Math.min(1, Math.max(0, (want - fineL[j]) / seg)) : 0;
    X[i] = fineX[j] + f * (fineX[j + 1] - fineX[j]); Y[i] = fineY[j] + f * (fineY[j + 1] - fineY[j]);
  }
  return D;
}

/** The area of a stroke of head radius r0 (a half disc for the head, and the band along the spine). */
function strokeArea(pr, X, Y, r0, scale = 1) {
  let a = 0;
  for (let i = 1; i < pr.n; i++) a += (pr.P[i] + pr.P[i - 1]) * hyp(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  return scale * r0 * a + (Math.PI / 2) * (scale * r0) ** 2;
}
function spineLength(pr, X, Y) { let L = 0; for (let i = 1; i < pr.n; i++) L += hyp(X[i] - X[i - 1], Y[i] - Y[i - 1]); return L; }

/** The largest head radius r0 for which the stroke (radii r0 P) keeps `gap` from its own far part and from its copies. */
function headRadius(pr, X, Y, copies, gap, limit) {
  const n = pr.n, P = pr.P, ts = pr.ts;
  let r0 = limit;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (ts[j] - ts[i] < 0.45) continue;
    const v = (hyp(X[i] - X[j], Y[i] - Y[j]) - gap) / (P[i] + P[j]);
    if (v < r0) { r0 = v; if (r0 <= 0) return 0; }
  }
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += X[i]; my += Y[i]; }
  mx /= n; my /= n;
  let R = 0;
  for (let i = 0; i < n; i++) R = Math.max(R, hyp(X[i] - mx, Y[i] - my));
  const reach = 2 * (R + r0) + gap;
  for (const g of copies) {
    const cx = g.a * mx + g.b * my + g.tx, cy = g.c * mx + g.d * my + g.ty;
    if ((cx - mx) ** 2 + (cy - my) ** 2 > reach * reach) continue;
    for (let j = 0; j < n; j++) {
      const x = g.a * X[j] + g.b * Y[j] + g.tx, y = g.c * X[j] + g.d * Y[j] + g.ty, Pj = P[j];
      for (let i = 0; i < n; i++) {
        const dx = X[i] - x, dy = Y[i] - y, lim = r0 * (P[i] + Pj) + gap;
        if (dx * dx + dy * dy >= lim * lim) continue;
        const v = (Math.sqrt(dx * dx + dy * dy) - gap) / (P[i] + Pj);
        if (v < r0) { r0 = v; if (r0 <= 0) return 0; }
      }
    }
  }
  return r0;
}

/**
 * The widest bare place the commas leave BEFORE they swell, as a diameter, probed at a few points (the corners, the
 * middles of the sides and the centre of the tile, the rotation centres near it, a coarse grid): twice the largest
 * distance from a probe to the nearest comma (any copy). Cheap; it is what tells a yin-yang that leaves a 6-fold
 * centre bare from a tomoe round it.
 */
function probeBare(strokes, copies, probes) {
  let worst = 0;
  for (const q of probes) {
    let d = Infinity;
    for (const S of strokes) for (const g of copies) {
      const cx = g.a * S.mx + g.b * S.my + g.tx, cy = g.c * S.mx + g.d * S.my + g.ty;
      if (hyp(q[0] - cx, q[1] - cy) - S.R >= d) continue;
      for (let i = 0; i < S.n; i++) {
        const x = g.a * S.X[i] + g.b * S.Y[i] + g.tx, y = g.c * S.X[i] + g.d * S.Y[i] + g.ty, v = hyp(q[0] - x, q[1] - y) - S.r[i];
        if (v < d) d = v;
      }
    }
    if (d > worst) worst = d;
  }
  return 2 * worst;
}
/** A stroke as probeBare wants it: positions, radii, centre and radius of its bounding circle. */
function strokeOf(pr, X, Y, r0) {
  const n = pr.n, r = new Float64Array(n), Xs = Float64Array.from(X), Ys = Float64Array.from(Y);
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { r[i] = r0 * pr.P[i]; mx += X[i]; my += Y[i]; }
  mx /= n; my /= n;
  let R = 0;
  for (let i = 0; i < n; i++) R = Math.max(R, hyp(X[i] - mx, Y[i] - my) + r[i]);
  return { X: Xs, Y: Ys, r, n, mx, my, R };
}

/** The probes of a tile: its corners, the middles of its sides, its centre, the rotation centres in it, a coarse grid. */
function probesOf(group, T, K) {
  const u = Math.sqrt(group.domainArea), out = [];
  const c = polyCentroid(T);
  out.push(c);
  for (let i = 0; i < T.length; i++) { const p = T[i], q = T[(i + 1) % T.length]; out.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]); }
  for (const p of gridIn(group, T, K.probeStep * u, 0)) out.push(p);
  return out;
}

const isIdentity = (g, h, eps) => Math.abs(g.a - 1) < 1e-9 && Math.abs(g.d - 1) < 1e-9 && Math.abs(g.b) < 1e-9 && Math.abs(g.c) < 1e-9 && hyp(g.tx, g.ty) < eps;
const IDENT = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const isReflection = (g, eps) => {
  if (g.a * g.d - g.b * g.c > 0) return false;
  const tx = g.a * g.tx + g.b * g.ty + g.tx, ty = g.c * g.tx + g.d * g.ty + g.ty;      // g o g is a translation by this
  return hyp(tx, ty) < eps;
};

/**
 * The seat of ONE comma (a group that is not a kaleidoscope). The head h on a grid over the default tile; the partner g
 * among the nearest images of h (no mirror: a stroke cannot wind round a head across a mirror); the sweep, the radius
 * rw it ends at round the partner's head, the dive m, the hand; the head radius as large as the copies allow. The
 * seats of largest area are then weighed by the bare place they leave (probeBare), and the best one refined.
 */
export function seatSingle(group, T, K = KNOBS) {
  const u = Math.sqrt(group.domainArea), gap = K.gap * u, pr = profileOf(K.searchDiscs, K), A = group.domainArea;
  const X = new Float64Array(pr.n), Y = new Float64Array(pr.n);
  const le = hyp(group.e1[0], group.e1[1]), ex = group.e1[0] / le, ey = group.e1[1] / le, vx = -ey, vy = ex;
  const reachEls = 2 * K.dMax * u + 2.5 * u;
  const nearOf = (h) => elementsNear(group, h[0], h[1], reachEls, h[0], h[1]).filter((g) => !isIdentity(g, h, 1e-9 * u));
  const tryOne = (h, g, sweep, rw, m, sgn, copies) => {
    const p = [g.a * h[0] + g.b * h[1] + g.tx, g.c * h[0] + g.d * h[1] + g.ty];
    const D = hyp(h[0] - p[0], h[1] - p[1]);
    if (rw * u > 0.92 * D) return null;
    spineInto(h, p, sweep, rw * u, m, sgn, pr, X, Y);
    if (spineLength(pr, X, Y) < K.lenMin * u) return null;
    const r0 = headRadius(pr, X, Y, copies, gap, 0.5 * D);
    if (r0 < K.rMin * u) return null;
    return { h, g, p, sweep, rw, m, sgn, r0, D, area: strokeArea(pr, X, Y, r0) / A };
  };
  // 1. every seat on the grid, by area
  const heads = gridIn(group, T, K.hStep * u, 0.02 * u), all = [];
  for (const h of heads) {
    const near = nearOf(h), parts = [];
    for (const g of near) {
      if (isReflection(g, 1e-7 * u)) continue;
      const qx = g.a * h[0] + g.b * h[1] + g.tx - h[0], qy = g.c * h[0] + g.d * h[1] + g.ty - h[1], d = hyp(qx, qy);
      if (d < K.dMin * u || d > K.dMax * u) continue;
      parts.push({ g, d, ang: Math.atan2(qx * vx + qy * vy, qx * ex + qy * ey) });
    }
    parts.sort((a, b) => (Math.abs(a.d - b.d) > 1e-9 * u ? a.d - b.d : a.ang - b.ang));
    for (const { g } of parts.slice(0, K.partners)) for (const sweep of K.sweeps) for (const rw of K.rws) for (const m of K.ms) for (let sgn = 1; sgn >= -1; sgn -= 2) {
      const c = tryOne(h, g, sweep, rw, m, sgn, near);
      if (c) { c.near = near; all.push(c); }
    }
  }
  if (!all.length) return null;
  all.sort((a, b) => b.area - a.area);
  // 2. the best by area, weighed by the bare place they leave
  const probes = probesOf(group, T, K);
  const scoreOf = (c) => {
    spineInto(c.h, c.p, c.sweep, c.rw * u, c.m, c.sgn, pr, X, Y);
    const bare = probeBare([strokeOf(pr, X, Y, c.r0)], [IDENT, ...c.near], probes) / u;
    c.bare0 = bare;
    c.score = c.area - K.probeW * Math.max(0, bare - K.probeB0) ** 2;
    return c.score;
  };
  let best = null;
  for (const c of all.slice(0, K.topN)) { scoreOf(c); if (!best || c.score > best.score + 1e-9) best = c; }
  // 3. refinement: the head moved a little (the partner is the same element), the sweep and the end radius changed
  let st = 0.5 * K.hStep * u, ds = 0.2, dr = 0.05;
  for (let round = 0; round < K.refine; round++, st /= 2, ds /= 2, dr /= 2) {
    const b0 = best, near = nearOf(b0.h);
    for (let ia = -1; ia <= 1; ia++) for (let ib = -1; ib <= 1; ib++) for (let is = -1; is <= 1; is++) for (let ir = -1; ir <= 1; ir++) {
      if (!ia && !ib && !is && !ir) continue;
      const h = [b0.h[0] + st * (ia * ex + ib * vx), b0.h[1] + st * (ia * ey + ib * vy)];
      const c = tryOne(h, b0.g, b0.sweep + is * ds, b0.rw + ir * dr, b0.m, b0.sgn, near);
      if (!c) continue;
      c.near = near;
      if (scoreOf(c) > best.score + 1e-9) best = c;
    }
  }
  return best;
}

/** The distance from (x, y) to each wall of the chamber T (positive inside). */
function wallsOf(T) {
  const out = [];
  for (let i = 0; i < T.length; i++) {
    const p = T[i], q = T[(i + 1) % T.length], dx = q[0] - p[0], dy = q[1] - p[1], l = hyp(dx, dy);
    if (l > 1e-12) out.push([dy / l, -dx / l, (dy / l) * p[0] + (-dx / l) * p[1]]);
  }
  return out;
}

/**
 * The seat of a PAIR of commas in a kaleidoscope's chamber T: A with its head at a, winding round B's head at b, and B
 * (radii beta times A's) winding round A's head, the same way round (a yin-yang). Both stay inside the chamber by half
 * a gap (so a comma keeps a gap from its mirror images), and apart from each other. Weighed by the bare place left, as
 * the single seat is (a corner of the chamber is where 2n chambers meet: its bare place is the probe's distance twice).
 */
export function seatPair(group, T, K = KNOBS) {
  const u = Math.sqrt(group.domainArea), gap = K.pairGap * u, pr = profileOf(K.searchDiscs, K), n = pr.n, P = pr.P, beta = K.beta, A = group.domainArea;
  const XA = new Float64Array(n), YA = new Float64Array(n), XB = new Float64Array(n), YB = new Float64Array(n);
  const W = wallsOf(T), pts = gridIn(group, T, K.pStep * u, 0.08 * u);
  const tryOne = (a, b, sa, sb, ra, rb, m, sgn) => {
    const D = hyp(a[0] - b[0], a[1] - b[1]);
    if (ra * u > 0.92 * D || rb * u > 0.92 * D) return null;
    spineInto(a, b, sa, ra * u, m, sgn, pr, XA, YA);
    spineInto(b, a, sb, rb * u, m, sgn, pr, XB, YB);
    if (spineLength(pr, XA, YA) < K.lenMin * u) return null;
    let r0 = (D - gap) / (1 + beta);
    for (let i = 0; i < n && r0 > 0; i++) for (const w of W) {
      const dA = w[2] - w[0] * XA[i] - w[1] * YA[i], dB = w[2] - w[0] * XB[i] - w[1] * YB[i];
      if (dA < 0.5 * gap || dB < 0.5 * gap) return null;
      const vA = (dA - 0.5 * gap) / P[i], vB = (dB - 0.5 * gap) / (beta * P[i]);
      if (vA < r0) r0 = vA; if (vB < r0) r0 = vB;
    }
    for (let i = 0; i < n && r0 > 0; i++) for (let j = 0; j < n; j++) {
      const v = (hyp(XA[i] - XB[j], YA[i] - YB[j]) - gap) / (P[i] + beta * P[j]);
      if (v < r0) r0 = v;
      if (j > i && pr.ts[j] - pr.ts[i] >= 0.45) {
        const s = (hyp(XA[i] - XA[j], YA[i] - YA[j]) - gap) / (P[i] + P[j]), t = (hyp(XB[i] - XB[j], YB[i] - YB[j]) - gap) / (beta * (P[i] + P[j]));
        if (s < r0) r0 = s; if (t < r0) r0 = t;
      }
    }
    if (r0 < K.rMin * u) return null;
    const area = (strokeArea(pr, XA, YA, r0) + strokeArea(pr, XB, YB, r0, beta)) / A;
    return { a, b, sa, sb, ra, rb, m, sgn, r0, D, area };
  };
  const all = [];
  for (const a of pts) for (const b of pts) {
    const d = hyp(a[0] - b[0], a[1] - b[1]);
    if (d < K.dMin * u || a === b) continue;
    for (const s of K.sweeps) for (const rw of K.rws) for (const m of K.ms) for (let sgn = 1; sgn >= -1; sgn -= 2) {
      const c = tryOne(a, b, s, s, rw, rw, m, sgn);
      if (c) all.push(c);
    }
  }
  if (!all.length) return null;
  all.sort((x, y) => y.area - x.area);
  const probes = probesOf(group, T, K);
  const scoreOf = (c) => {
    spineInto(c.a, c.b, c.sa, c.ra * u, c.m, c.sgn, pr, XA, YA);
    spineInto(c.b, c.a, c.sb, c.rb * u, c.m, c.sgn, pr, XB, YB);
    const SA = strokeOf(pr, XA, YA, c.r0), SB = strokeOf(pr, XB, YB, beta * c.r0);
    // the chamber's mirror images: the nearest dark across a wall is the probe's own distance (a corner, a side) — so
    // the probes are looked at with the identity alone, and a probe ON a wall counts twice its distance anyway
    const bare = probeBare([SA, SB], [IDENT], probes) / u;
    c.bare0 = bare;
    c.score = c.area - K.probeW * Math.max(0, bare - K.probeB0) ** 2;
    return c.score;
  };
  let best = null;
  for (const c of all.slice(0, K.topN)) { scoreOf(c); if (!best || c.score > best.score + 1e-9) best = c; }
  const le = hyp(group.e1[0], group.e1[1]), ex = group.e1[0] / le, ey = group.e1[1] / le, vx = -ey, vy = ex;
  let st = 0.5 * K.pStep * u, ds = 0.2, dr = 0.05;
  const take = (c) => { if (c && scoreOf(c) > best.score + 1e-9) best = c; };
  for (let round = 0; round < K.refine + 1; round++, st /= 2, ds /= 2, dr /= 2) {
    const b0 = best;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (!i && !j) continue;
      const mv = [st * (i * ex + j * vx), st * (i * ey + j * vy)];
      take(tryOne([b0.a[0] + mv[0], b0.a[1] + mv[1]], b0.b, b0.sa, b0.sb, b0.ra, b0.rb, b0.m, b0.sgn));
      take(tryOne(b0.a, [b0.b[0] + mv[0], b0.b[1] + mv[1]], b0.sa, b0.sb, b0.ra, b0.rb, b0.m, b0.sgn));
    }
    for (const [x, y] of [[ds, 0], [-ds, 0], [0, ds], [0, -ds]]) take(tryOne(b0.a, b0.b, b0.sa + x, b0.sb + y, b0.ra, b0.rb, b0.m, b0.sgn));
    for (const [x, y] of [[dr, 0], [-dr, 0], [0, dr], [0, -dr]]) take(tryOne(b0.a, b0.b, b0.sa, b0.sb, b0.ra + x, b0.rb + y, b0.m, b0.sgn));
  }
  return best;
}

/** A site: the discs of one comma at full resolution, { x, y, r, n, r0, cx, cy, R }. */
function siteOf(h, p, sweep, rw, m, sgn, r0, K, u, scale = 1) {
  const pr = profileOf(K.discs, K), x = new Float64Array(pr.n), y = new Float64Array(pr.n), r = new Float64Array(pr.n);
  spineInto(h, p, sweep, rw * u, m, sgn, pr, x, y);
  for (let i = 0; i < pr.n; i++) r[i] = scale * r0 * pr.P[i];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pr.n; i++) { x0 = Math.min(x0, x[i] - r[i]); y0 = Math.min(y0, y[i] - r[i]); x1 = Math.max(x1, x[i] + r[i]); y1 = Math.max(y1, y[i] + r[i]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let R = 0;
  for (let i = 0; i < pr.n; i++) R = Math.max(R, hyp(x[i] - cx, y[i] - cy) + r[i]);
  return { x, y, r, n: pr.n, r0: scale * r0, cx, cy, R };
}
