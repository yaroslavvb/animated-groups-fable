// dev/patterns/designs/mosaic/design.js — "Mosaic": the plane laid as a mosaic of dark tiles with light grout between
// them, a big light comma inlaid in every tile. The pattern round of 13 Nov 2026 (the owner: "come up with some
// patterns which are more like a comma but they fill more of the space ... different tints to the two sides").
//
// The tiles are the Voronoi cells of one generic orbit g(p): with p the seed of the page's default cut, they are the
// copies of the default tile itself, so the tile holds exactly one whole tile of the mosaic and its comma, and the
// seams of the cut run in the grout. The grout is a channel CHAN = 0.055 tile sizes wide, of constant width (the
// exact distance to each wall), the tiles' corners rounded (ROUND 0.035, so a 30-degree corner ends in a cap, not a
// needle). The comma is a stroke: a round head (radius 0.13 to 0.22 tile sizes) and a tail that tapers along a curved
// spine and runs until it meets the grout, where it ends at a T, rounded by a fillet. So the light (grout and commas)
// is one network and the dark tile is one hook-shaped piece around its comma: the animal (the comma) interlocks with
// its ground (the tile). The comma has a direction (head -> tail) and a hand (its curl): translated tiles are
// parallel, rotated ones turn about the centres, mirrored and glided ones curl the other way.
//
// The motif is ONE dark tile: the zero set of an implicit function f on a grid (in the group's own frame, so a turned,
// scaled or shifted group gets the turned, scaled, shifted motif), traced by marching squares, resampled and smoothed.
// f > 0 inside the cell of the identity, at least half a channel off every wall and off every copy's comma: two copies
// are never nearer than CHAN, whatever the knobs.
//
// Knobs. Per group (TABLE): where p sits and the comma (head, heading, length, turn at the head and at the tip, head
// radius, taper), in the group's own frame (lattice coordinates from an anchor that moves with the group; the heading
// from e1; lengths in tile sizes); placed by hand in run 2, after a seeded search in run 1. A group the table does not
// know gets a generic p and a plain comma (fallback): valid, not tuned. bend > 0 bends every wall that is no mirror
// into an S (the first run's idea; off: see NOTES.md). The story, the numbers and what is weak: NOTES.md.
import { elementsNear, classify, inverse } from '../../../../src/groups.js';

export const meta = { key: 'mosaic', label: 'Mosaic', hint: 'dark tiles with light grout between them, a big light comma inlaid in each' };

// ---- the group's own frame: an anchor that moves with the group, and its lattice basis -----------------------------
export function frameOf(group) {
  const size = Math.sqrt(group.domainArea);
  let A = null, best = 0;
  for (const r of group.reps) { const c = classify(r); if (c.type === 'rotation' && c.order > best) { best = c.order; A = c.center.slice(); } }
  if (!A) {
    for (const r of group.reps) {
      const c = classify(r);
      if (c.type !== 'reflection' && c.type !== 'glide') continue;
      const dx = group.center[0] - c.point[0], dy = group.center[1] - c.point[1], t = dx * c.dir[0] + dy * c.dir[1];
      A = [c.point[0] + t * c.dir[0], c.point[1] + t * c.dir[1]];
      break;
    }
  }
  if (!A) A = group.center.slice();
  return { size, A, order: best, e1ang: Math.atan2(group.e1[1], group.e1[0]) };
}
export function toWorld(group, A, st) { return [A[0] + st[0] * group.e1[0] + st[1] * group.e2[0], A[1] + st[0] * group.e1[1] + st[1] * group.e2[1]]; }
export function toFrame(group, A, xy) {
  const { e1, e2 } = group, dd = e1[0] * e2[1] - e1[1] * e2[0], x = xy[0] - A[0], y = xy[1] - A[1];
  return [(x * e2[1] - y * e2[0]) / dd, (e1[0] * y - e1[1] * x) / dd];
}

// bend (0: off; 0.075 was tried, NOTES.md): the peak of a wall's S as a share of the wall's length (capped at bendMax
// tile sizes; a wall shorter than bendMin tile sizes stays straight). S(t) = KS t (1 - t^2)^2 on the wall, t from -1 to
// 1 corner to corner: odd (so a wall that a half-turn maps onto itself can carry it), 0 and flat at both corners, its
// peaks 1 at t = +-1/sqrt(5).
// fillet: where a tail meets the grout at a slant, the dark between them ends in a spike. Near the junction (within
// filletReach tile sizes of the spine's end) the cell and the comma are joined by a smooth minimum of radius fillet,
// which rounds the spike; elsewhere a plain minimum (a smooth one everywhere dented the cell's edge wherever the comma
// passed near the grout).
const DEF = { metric: null, chan: 0.055, round: 0.035, grid: 64, smooth: 0.028, ds: 0.0125, bend: 0, bendMax: 0.11, bendMin: 0.3, light: [], tip: 0.028, nseg: 28, fillet: 0.09, filletReach: 0.22 };
const KS = 1 / ((1 / Math.sqrt(5)) * (16 / 25));

/** The spine of a stroke: from `at`, heading `dir`, `len` long, its heading turning by t0 at the start and t1 at the end. */
export function spineOf(at, dir, len, t0, t1, n) {
  const pts = [[at[0], at[1]]];
  let x = at[0], y = at[1];
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, a = dir + t0 * t + ((t1 - t0) * t * t) / 2;
    x += (len / n) * Math.cos(a); y += (len / n) * Math.sin(a);
    pts.push([x, y]);
  }
  return pts;
}

// ---- the model: sites, walls and strokes near the identity's cell ---------------------------------------------------
export function buildModel(group, knobs) {
  const K = { ...DEF, ...knobs };
  const F = frameOf(group), { size, A } = F;
  const p = toWorld(group, A, K.p);
  const R = 3.2 * size;
  const els = elementsNear(group, p[0], p[1], R, p[0], p[1]);
  const ap = (g, v) => [g.a * v[0] + g.b * v[1] + g.tx, g.c * v[0] + g.d * v[1] + g.ty];
  const dist0 = (g) => { const v = ap(g, p); return Math.hypot(v[0] - p[0], v[1] - p[1]); };
  els.sort((a, b) => dist0(a) - dist0(b));
  const nd = els.length, dx = new Float64Array(nd), dy = new Float64Array(nd);
  els.forEach((g, i) => { const v = ap(g, p); dx[i] = v[0]; dy[i] = v[1]; });
  if (dist0(els[0]) > 1e-9 * size || (nd > 1 && dist0(els[1]) < 1e-6 * size)) throw new Error('mosaic: p is not a generic point');
  // Distances are measured by a quadratic form the group keeps: the plain one, except for the group of translations
  // alone, whose cells are then the parallelograms of its basis (the page's default tile) instead of hexagons.
  const [q11, q12, q22] = K.metric || [1, 0, 1];
  const qf = (ax, ay) => q11 * ax * ax + 2 * q12 * ax * ay + q22 * ay * ay;

  // the straight cell of p, clipped by the bisectors: the box of the grid
  let poly = [[p[0] - 4 * size, p[1] - 4 * size], [p[0] + 4 * size, p[1] - 4 * size], [p[0] + 4 * size, p[1] + 4 * size], [p[0] - 4 * size, p[1] + 4 * size]];
  const clip = (zx, zy) => {
    // nearer to p than to z:  x . Q(z - p) <= (zQz - pQp) / 2
    let nx = q11 * (zx - p[0]) + q12 * (zy - p[1]), ny = q12 * (zx - p[0]) + q22 * (zy - p[1]), c = (qf(zx, zy) - qf(p[0], p[1])) / 2;
    const l = Math.hypot(nx, ny); nx /= l; ny /= l; c /= l;
    const np = [], n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n], sa = nx * a[0] + ny * a[1] - c, sb = nx * b[0] + ny * b[1] - c;
      if (sa <= 0) np.push(a);
      if ((sa <= 0) !== (sb <= 0)) { const t = sa / (sa - sb); np.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
    }
    poly = np;
  };
  for (let i = 1; i < nd; i++) if (dist0(els[i]) < 2.6 * size) clip(dx[i], dy[i]);
  // drop the zero-length edges a clip through a corner leaves
  poly = poly.filter((v, i) => { const w = poly[(i + 1) % poly.length]; return Math.hypot(w[0] - v[0], w[1] - v[1]) > 1e-9 * size; });

  // what the field needs: the copies near the cell (a point of the grid is nearer to p than to anything left out)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, rc = 0;
  for (const v of poly) { x0 = Math.min(x0, v[0]); y0 = Math.min(y0, v[1]); x1 = Math.max(x1, v[0]); y1 = Math.max(y1, v[1]); rc = Math.max(rc, Math.hypot(v[0] - p[0], v[1] - p[1])); }
  const near = els.filter((g) => dist0(g) <= 2 * rc + 1.7 * size), ne = near.length;
  const ex = Float64Array.from(near, (g) => ap(g, p)[0]), ey = Float64Array.from(near, (g) => ap(g, p)[1]);
  const back = near.map((g) => inverse(g));                    // carries a point of the cell g(0) back into the cell 0
  // 1 / (2 |z_0 - z_j|): (|x - z_j|^2 - |x - z_0|^2) times it is the distance from x to the wall between the cells 0
  // and j; (wnx, wny): the unit normal of that wall, pointing out of the cell 0
  const inv2 = new Float64Array(ne), d2 = new Float64Array(ne), wnx = new Float64Array(ne), wny = new Float64Array(ne);
  for (let j = 1; j < ne; j++) {
    const ux = q11 * (ex[j] - ex[0]) + q12 * (ey[j] - ey[0]), uy = q12 * (ex[j] - ex[0]) + q22 * (ey[j] - ey[0]), l = Math.hypot(ux, uy);
    inv2[j] = 0.5 / l; wnx[j] = ux / l; wny[j] = uy / l;
  }

  // ---- the walls of the cell 0, and their S -------------------------------------------------------------------------
  // The curved wall to the site j lies at the signed distance v = A S(t) from the straight one (v > 0 into the cell 0),
  // t running along the tangent (-n_y, n_x) from the wall's middle, -1 and 1 at its corners. The walls of the tiling
  // must be the group's, so: a mirror stays straight; the wall to g(p) and its partner, the wall to g^-1(p), carry
  // amplitudes A' = det(g) A. Every wall whose element keeps the hand gets the same sense (the half nearer the
  // tangent's side bulges OUT of the cell): the cell's outline is a pinwheel with a hand of its own, and a mirrored
  // cell turns the other way. A glide pair bends one wall out and its partner in; which is which goes by the
  // directions of their middles from p, measured from e1 (so the choice moves with the group).
  const walls = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d0 = qf(m[0] - p[0], m[1] - p[1]);
    let who = -1, err = Infinity;
    for (let k = 1; k < ne; k++) {
      const e = Math.abs(qf(a[0] - ex[k], a[1] - ey[k]) - qf(a[0] - p[0], a[1] - p[1])) + Math.abs(qf(b[0] - ex[k], b[1] - ey[k]) - qf(b[0] - p[0], b[1] - p[1]));
      if (e < err) { err = e; who = k; }
    }
    if (who < 0 || err > 1e-6 * d0) continue;
    const g = near[who], c = classify(g), det = g.a * g.d - g.b * g.c;
    const peak = c.type === 'reflection' || L < K.bendMin * size ? 0 : Math.min(K.bend * L, K.bendMax * size);
    let key = (Math.atan2(m[1] - p[1], m[0] - p[0]) - F.e1ang - 0.4567) % (2 * Math.PI);
    if (key < 0) key += 2 * Math.PI;
    const gp = ap(back[who], p);                                // the partner wall's site
    walls.push({ j: who, a, b, m, L, type: c.type, det, peak, key, partner: gp, amp: det > 0 ? -peak : 0 });
  }
  for (const w of walls) {
    if (w.det > 0 || w.type === 'reflection' || w.peak === 0) continue;
    const q = walls.find((o) => Math.hypot(ex[o.j] - w.partner[0], ey[o.j] - w.partner[1]) < 1e-7 * size);
    w.amp = !q || w.key <= q.key ? -w.peak : w.peak;
  }
  const bentAt = new Int32Array(ne).fill(-1), WB = walls.filter((w) => w.amp !== 0), nb = WB.length;
  const wMx = new Float64Array(nb), wMy = new Float64Array(nb), wTx = new Float64Array(nb), wTy = new Float64Array(nb), wLh = new Float64Array(nb), wA = new Float64Array(nb);
  WB.forEach((w, s) => { bentAt[w.j] = s; wMx[s] = w.m[0]; wMy[s] = w.m[1]; wTx[s] = -wny[w.j]; wTy[s] = wnx[w.j]; wLh[s] = w.L / 2; wA[s] = w.amp; });
  const band = 0.12 * size;

  // the light strokes: the identity's spines, then every near copy's (with a bounding circle each)
  const tip = K.tip * size, nseg = K.nseg, np1 = nseg + 1;
  const strokes = K.light.map((s) => {
    const at = toWorld(group, A, s.h), pts = spineOf(at, F.e1ang + s.dir, s.len * size, s.t0, s.t1, nseg), r0 = s.rad * size;
    const rad = pts.map((_, k) => { const t = k / nseg; return tip + (r0 - tip) * Math.pow(1 - t, s.pow || 1); });
    return { pts, rad };
  });
  const ns = strokes.length, nc = ns * ne;
  const sx = new Float64Array(nc * np1), sy = new Float64Array(nc * np1), sr = new Float64Array(ns * np1);
  const bcx = new Float64Array(nc), bcy = new Float64Array(nc), bcr = new Float64Array(nc);
  strokes.forEach((S, j) => {
    S.rad.forEach((r, k) => { sr[j * np1 + k] = r; });
    near.forEach((g, i) => {
      const c = i * ns + j;
      let ax = 0, ay = 0;
      S.pts.forEach((v, k) => { const w = ap(g, v); sx[c * np1 + k] = w[0]; sy[c * np1 + k] = w[1]; ax += w[0]; ay += w[1]; });
      ax /= np1; ay /= np1;
      let rr = 0;
      for (let k = 0; k < np1; k++) rr = Math.max(rr, Math.hypot(sx[c * np1 + k] - ax, sy[c * np1 + k] - ay) + S.rad[k]);
      bcx[c] = ax; bcy[c] = ay; bcr[c] = rr;
    });
  });

  const cHalf = (K.chan * size) / 2, rho = K.round * size, reachS = 0.2 * size;
  const out = [0, 0, 0, 0, -1];                               // the identity's claim, the best other claim, the light strokes, the identity's plain depth and its nearest wall
  const setD2 = (x, y) => { for (let g = 0; g < ne; g++) { const ax = x - ex[g], ay = y - ey[g]; d2[g] = q11 * ax * ax + 2 * q12 * ax * ay + q22 * ay * ay; } };
  /** The signed distance from (x, y) to the wall between the cells 0 and j, as drawn (d2 set at that point). */
  const vAt = (j, x, y) => {
    let v = (d2[j] - d2[0]) * inv2[j];
    const s = bentAt[j];
    if (s >= 0) {
      const t = ((x - wMx[s]) * wTx[s] + (y - wMy[s]) * wTy[s]) / wLh[s];
      if (t > -1 && t < 1) {
        const u = 1 - t * t, S = KS * t * u * u, dS = KS * u * (1 - 5 * t * t), e = v - wA[s] * S, sl = (wA[s] * dS) / wLh[s];
        const lam = e < band ? 1 : e > 2 * band ? 0 : 2 - e / band;  // near the wall: the distance to the curve (first order)
        v = e * (1 - lam * (1 - 1 / Math.sqrt(1 + sl * sl)));
      }
    }
    return v;
  };
  // The claim of the cell 0: its depth (the distance to the nearest wall, as drawn) less half a channel, with the
  // corners ROUNDED: the cell shrunk by rho and grown back (a 30-degree corner ends in a round cap 2 rho wide, not in a
  // needle). plain: the depth itself and its wall.
  const plain = [0, -1];
  const claim0 = (x, y) => {
    let da = Infinity, db = Infinity, ia = -1, ib = -1;
    for (let j = 1; j < ne; j++) {
      const v = vAt(j, x, y);
      if (v < da) { db = da; ib = ia; da = v; ia = j; } else if (v < db) { db = v; ib = j; }
    }
    plain[0] = da; plain[1] = ia;
    const ea = da - cHalf, va = rho - ea, vb = rho - (db - cHalf);
    if (va <= 0 || vb <= 0) return ea;                         // deep inside, or near one wall only
    const c = wnx[ia] * wnx[ib] + wny[ia] * wny[ib], den = 1 - c * c;
    if (den < 1e-9) return ea;
    const aa = (va - c * vb) / den, ab = (vb - c * va) / den;   // the point seen from the shrunk cell's corner
    if (aa <= 0 || ab <= 0) return ea;                          // nearest to an edge of the shrunk cell after all
    return rho - Math.sqrt(aa * aa + ab * ab + 2 * aa * ab * c);
  };
  const near3 = new Int32Array(3);
  const evalAll = (x, y, other = false) => {
    setD2(x, y);
    out[0] = claim0(x, y); out[3] = plain[0]; out[4] = plain[1];
    if (other) {
      // the cells nearest after the identity's: their claims are the identity's, at the point carried back
      near3.fill(-1);
      const dn = [Infinity, Infinity, Infinity];
      for (let g = 1; g < ne; g++) {
        const d = d2[g];
        if (d < dn[2]) { let k = 2; while (k > 0 && d < dn[k - 1]) { dn[k] = dn[k - 1]; near3[k] = near3[k - 1]; k--; } dn[k] = d; near3[k] = g; }
      }
      let best = -Infinity;
      for (let k = 0; k < 3; k++) {
        const g = near3[k];
        if (g < 0) continue;
        const B = back[g], bx = B.a * x + B.b * y + B.tx, by = B.c * x + B.d * y + B.ty;
        setD2(bx, by);
        best = Math.max(best, claim0(bx, by));
      }
      out[1] = best;
    }
    // the light strokes of every copy: S > 0 inside one (a smooth union)
    let S = -1e9;
    for (let c = 0; c < nc; c++) {
      const bd = Math.sqrt((x - bcx[c]) * (x - bcx[c]) + (y - bcy[c]) * (y - bcy[c])) - bcr[c];
      if (bd > reachS) continue;
      const o = c * np1, ro = (c % ns) * np1;
      let best = -1e9;
      for (let k = 0; k < nseg; k++) {
        const ax = sx[o + k], ay = sy[o + k], ux = sx[o + k + 1] - ax, uy = sy[o + k + 1] - ay, l2 = ux * ux + uy * uy;
        let t = l2 > 0 ? ((x - ax) * ux + (y - ay) * uy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const v = sr[ro + k] + t * (sr[ro + k + 1] - sr[ro + k]) - Math.sqrt((x - ax - t * ux) * (x - ax - t * ux) + (y - ay - t * uy) * (y - ay - t * uy));
        if (v > best) best = v;
      }
      if (best > S) S = best;
    }
    out[2] = S;
  };
  /** The depth of a point inside the identity's cell with one wall left out (after evalAll at that point): for the search. */
  const depthBut = (skip, x, y) => { setD2(x, y); let m = Infinity; for (let j = 1; j < ne; j++) { if (j === skip) continue; const v = vAt(j, x, y); if (v < m) m = v; } return m; };
  /** f > 0 inside the identity's dark cell; about the distance to its rim. */
  // the junctions: the ends of the identity's spines that lie on a wall
  const J = [];
  for (const S of strokes) { const e = S.pts[S.pts.length - 1]; setD2(e[0], e[1]); claim0(e[0], e[1]); if (Math.abs(plain[0]) < 0.01 * size) J.push(e); }
  const kf = K.fillet * size, reachJ = K.filletReach * size;
  const f = (x, y) => {
    evalAll(x, y);
    const a = out[0], b = -out[2];
    let dj = Infinity;
    for (const e of J) dj = Math.min(dj, Math.hypot(x - e[0], y - e[1]));
    if (dj >= reachJ) return Math.min(a, b);
    const w = 1 - dj / reachJ, k = kf * w * w * (3 - 2 * w), d = Math.abs(a - b);
    return d >= k ? Math.min(a, b) : Math.min(a, b) - ((k - d) * (k - d)) / (4 * k);   // a smooth minimum, near a junction
  };
  /** Is the plane dark here (any copy)? Good within about a tile size of p. */
  const tone = (x, y) => { evalAll(x, y, true); return Math.max(out[0], out[1]) > 0 && out[2] < 0 ? 1 : 0; };

  const m = 0.1 * size + WB.reduce((q, w) => Math.max(q, Math.abs(w.amp)), 0);
  return { K, F, size, A, p, els, near, f, tone, ev: evalAll, out, depthBut, walls, margin: m, box: [x0 - m, y0 - m, x1 + m, y1 + m], poly, strokes, nd, dx, dy, cHalf };
}

// ---- the zero set of f on a grid, as closed loops with the inside on the left ---------------------------------------
function trace(f, box, h) {
  const nx = Math.ceil((box[2] - box[0]) / h) + 1, ny = Math.ceil((box[3] - box[1]) / h) + 1, x0 = box[0], y0 = box[1];
  const v = new Float64Array(nx * ny);
  let open = false;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let t = f(x0 + i * h, y0 + j * h);
    if (t === 0) t = -1e-12;
    if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) { if (t > 0) { open = true; t = -1e-9; } }
    v[j * nx + i] = t;
  }
  const NE = nx * ny, next = new Int32Array(2 * NE).fill(-1);
  const H = (i, j) => j * nx + i, Ve = (i, j) => NE + j * nx + i;
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = v[j * nx + i] > 0, b = v[j * nx + i + 1] > 0, c = v[(j + 1) * nx + i + 1] > 0, d = v[(j + 1) * nx + i] > 0;
    const k = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
    if (k === 0 || k === 15) continue;
    const B = H(i, j), Rt = Ve(i + 1, j), T = H(i, j + 1), Lf = Ve(i, j);
    const mid = () => v[j * nx + i] + v[j * nx + i + 1] + v[(j + 1) * nx + i + 1] + v[(j + 1) * nx + i] > 0;
    switch (k) {
      case 1: next[B] = Lf; break;
      case 2: next[Rt] = B; break;
      case 4: next[T] = Rt; break;
      case 8: next[Lf] = T; break;
      case 3: next[Rt] = Lf; break;
      case 6: next[T] = B; break;
      case 12: next[Lf] = Rt; break;
      case 9: next[B] = T; break;
      case 7: next[T] = Lf; break;
      case 11: next[Rt] = T; break;
      case 13: next[B] = Rt; break;
      case 14: next[Lf] = B; break;
      case 5: if (mid()) { next[T] = Lf; next[B] = Rt; } else { next[B] = Lf; next[T] = Rt; } break;
      case 10: if (mid()) { next[Lf] = B; next[Rt] = T; } else { next[Rt] = B; next[Lf] = T; } break;
    }
  }
  const pt = (e) => {
    if (e < NE) { const i = e % nx, j = (e / nx) | 0, a = v[e], b = v[e + 1]; return [x0 + (i + a / (a - b)) * h, y0 + j * h]; }
    const q = e - NE, i = q % nx, j = (q / nx) | 0, a = v[q], b = v[q + nx];
    return [x0 + i * h, y0 + (j + a / (a - b)) * h];
  };
  const loops = [];
  for (let e = 0; e < 2 * NE; e++) {
    if (next[e] < 0) continue;
    const pts = [];
    let k = e, guard = 0;
    while (next[k] >= 0 && guard++ < 4 * NE) { pts.push(pt(k)); const n = next[k]; next[k] = -1; k = n; }
    if (pts.length >= 3) loops.push(pts);
  }
  return { loops, open, nx, ny };
}

function areaOf(pts) { let s = 0; for (let i = 0, n = pts.length; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; s += a[0] * b[1] - a[1] * b[0]; } return s / 2; }

/** A closed loop resampled at equal steps of arc length, then smoothed (binomial passes of standard deviation sigma). */
function fair(pts, ds, sigma) {
  const n = pts.length, cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const Ltot = cum[n], m = Math.max(12, Math.round(Ltot / ds));
  let X = new Float64Array(m), Y = new Float64Array(m);
  for (let k = 0, i = 0; k < m; k++) {
    const s = (k * Ltot) / m;
    while (i < n - 1 && cum[i + 1] < s) i++;
    const a = pts[i], b = pts[(i + 1) % n], t = cum[i + 1] > cum[i] ? (s - cum[i]) / (cum[i + 1] - cum[i]) : 0;
    X[k] = a[0] + t * (b[0] - a[0]); Y[k] = a[1] + t * (b[1] - a[1]);
  }
  const step = Ltot / m, passes = Math.round((2 * sigma * sigma) / (step * step));
  let X2 = new Float64Array(m), Y2 = new Float64Array(m);
  for (let q = 0; q < passes; q++) {
    for (let k = 0; k < m; k++) { const a = (k + m - 1) % m, b = (k + 1) % m; X2[k] = (X[a] + 2 * X[k] + X[b]) / 4; Y2[k] = (Y[a] + 2 * Y[k] + Y[b]) / 4; }
    [X, X2] = [X2, X]; [Y, Y2] = [Y2, Y];
  }
  const out = [];
  for (let k = 0; k < m; k++) out.push([X[k], Y[k]]);
  return out;
}

/**
 * A comma as it is drawn, from its knobs: the head as large as the knob says, or as its rim allows; the spine cut where
 * it meets the grout, so the tail ends in the channel at a T whatever the lattice is. M0: the model without commas.
 */
export function seat(group, M0, s, rimMin = 0.06) {
  const { size, A, F, cHalf } = M0, at = toWorld(group, A, s.h), dir = F.e1ang + s.dir;
  const wall = (x, y) => { M0.ev(x, y); return M0.out[3]; };                  // the depth inside the identity's cell, as drawn
  let prev = wall(at[0], at[1]);
  const rad = Math.min(s.rad, (prev - cHalf) / size - rimMin);
  if (!(rad >= 0.05)) return null;                                            // no room for a head here
  const L0 = s.len * size, N = 160, ds = (1.3 * L0) / N;
  let x = at[0], y = at[1], run = 0;
  for (let k = 0; k < N; k++) {
    const sm = (run + ds / 2) / L0, a = dir + s.t0 * sm + ((s.t1 - s.t0) * sm * sm) / 2;
    x += ds * Math.cos(a); y += ds * Math.sin(a); run += ds;
    const w = wall(x, y);
    if (w <= 0) {
      const lam = (run - ds + (prev / (prev - w)) * ds) / L0;
      return { h: s.h, dir: s.dir, len: s.len * lam, t0: s.t0 * lam, t1: s.t0 * lam + (s.t1 - s.t0) * lam * lam, rad, pow: s.pow };
    }
    prev = w;
  }
  return { ...s, rad };                                                       // it never meets the grout: a closed comma
}

export function build(group, knobs) {
  const M0 = buildModel(group, { ...knobs, light: [] });
  const light = (knobs.light || []).map((s) => seat(group, M0, s)).filter(Boolean);
  const M = buildModel(group, { ...knobs, light }), h = M.size / M.K.grid;
  // The grid lies in the group's own frame (origin p, first axis along e1), so a turned, scaled or shifted group gets
  // the turned, scaled, shifted motif, vertex for vertex.
  const c = Math.cos(M.F.e1ang), sn = Math.sin(M.F.e1ang), px = M.p[0], py = M.p[1];
  const fr = (u, v) => M.f(px + c * u - sn * v, py + sn * u + c * v);
  let box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const v of M.poly) { const u = c * (v[0] - px) + sn * (v[1] - py), w = -sn * (v[0] - px) + c * (v[1] - py); box = [Math.min(box[0], u), Math.min(box[1], w), Math.max(box[2], u), Math.max(box[3], w)]; }
  box = [box[0] - M.margin, box[1] - M.margin, box[2] + M.margin, box[3] + M.margin];
  let T = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    T = trace(fr, box, h);
    if (!T.open) break;
    const gx = 0.3 * (box[2] - box[0]), gy = 0.3 * (box[3] - box[1]);
    box = [box[0] - gx, box[1] - gy, box[2] + gx, box[3] + gy];
  }
  const shapes = [], minA = 0.004 * group.domainArea;
  let area = 0;
  for (const lp of T.loops) {
    const a = areaOf(lp);
    if (Math.abs(a) < minA) continue;                          // a speck, or a pinhole
    const pts = fair(lp, M.K.ds * M.size, M.K.smooth * M.size).map(([u, v]) => [px + c * u - sn * v, py + sn * u + c * v]);
    shapes.push({ pts, hole: a < 0 });
    area += areaOf(pts);
  }
  shapes.sort((u, v) => (u.hole ? 1 : 0) - (v.hole ? 1 : 0));
  const info = { cover: +(area / group.domainArea).toFixed(3), loops: shapes.length, open: T.open, grid: [T.nx, T.ny], commas: light.length, head: light.map((q) => +q.rad.toFixed(3)), tail: light.map((q) => +q.len.toFixed(3)) };
  return { shapes, info, model: M };
}

// ---- the knobs ------------------------------------------------------------------------------------------------------
// Per group: the dark site p (the default cut's seed) and the comma, in the group's own frame (frameOf: anchor + s e1 +
// t e2; lengths in tile sizes; the heading from e1). Run 1 found them by a seeded search scored on a raster (dark share,
// the largest bare and solid discs, thin slivers, a rim round the comma, a tail that meets the grout steeply, a curl);
// run 2 kept nine and placed eight by hand (o, **, xx, *x, 22*, 2*22, 632, 3*3: cand.mjs writes this table from a
// file in the cell's own frame). Whatever stands here, the motif is valid: the cells never overlap, the grout is 0.055
// wide, the head is shrunk to its rim and the tail is cut at the grout when it is drawn (seat).
//   id: [p.s, p.t,  head.s, head.t,  heading, length, turn at the head, turn at the tip, head radius, taper power]
// KNOBS-BEGIN
export const TABLE = {
  'o': [0, 0, 0.0717, 0.2717, -1.45, 1.3, -0.2, -3.8, 0.21, 1],
  '2222': [0.25, 0.25, 0.241, 0.4717, -0.1951, 1.1841, -3.8666, -2.488, 0.2044, 1],
  '**': [0.25, 0, 0.2783, 0.2828, -1.45, 1.3, -0.2, -3.8, 0.21, 1],
  'xx': [0, 0, 0.055, 0.1382, -1.45, 1.3, -0.2, -3.8, 0.21, 1],
  '*x': [-0.25, 0.25, -0.4319, 0.0681, 0.1853, 1.98, 0.2, -0.2, 0.135, 1.9],
  '333': [0.5, 0, 0.6518, -0.0038, 2.3159, 1.1232, 2.097, 2.6004, 0.2022, 1],
  '22x': [0.25, 0.5, 0.226, 0.6183, -2.6002, 1.2076, 4.2696, 3.6057, 0.1973, 1],
  '22*': [0.5, 0.375, 0.8217, 0.3705, 3, 1.45, -0.6, 3.3, 0.19, 1.1],
  '*2222': [0.25, 0.25, 0.3603, 0.2196, 1.8754, 1.2219, 4.0177, 2.9968, 0.2017, 1],
  '2*22': [0.375, -0.125, 0.2148, 0.0516, -0.5035, 1.3, 0.6, -3.2, 0.2, 1.1],
  '442': [0.25, 0.25, 0.1895, 0.1705, -0.2346, 1.0501, 3.4627, 2.478, 0.21, 1],
  '632': [0.4134, 0.1732, 0.47, 0.1513, 2.9, 0.95, 0.9, 3.4, 0.22, 1.1],
  '3*3': [0.4423, 0.1155, 0.4703, 0.1506, 2.9, 0.95, 0.9, 3.4, 0.22, 1.1],
  '*333': [0.3333, 0, 0.4186, -0.0814, 1.8157, 0.9684, 2.5825, 2.5502, 0.21, 1],
  '4*2': [0.35, 0.35, 0.3835, 0.2754, 1.2434, 1.0563, 3.6363, 1.8965, 0.2053, 1],
  '*442': [0.1667, 0.3333, 0.118, 0.2758, 1.8625, 1.0638, -3.447, -2.0261, 0.2048, 1],
  '*632': [-0.1111, -0.2778, -0.1452, -0.3415, 0.1635, 1.0282, 1.2879, 2.0824, 0.2039, 1],
};
// KNOBS-END
export const STYLE = { chan: 0.055, bend: 0, bendMax: 0.11, bendMin: 0.3 };

/** A generic point and a plain comma for a group the table does not know: valid, not tuned. */
function fallback(group) {
  const F = frameOf(group);
  let best = null;
  for (const st of [[0.31, 0.23], [0.19, 0.37], [0.41, 0.13], [0.27, 0.61], [0.13, 0.19], [0.37, 0.43]]) {
    const p = toWorld(group, F.A, st);
    let m = Infinity;
    for (const g of elementsNear(group, p[0], p[1], 2.5 * F.size, p[0], p[1])) { const d = Math.hypot(g.a * p[0] + g.b * p[1] + g.tx - p[0], g.c * p[0] + g.d * p[1] + g.ty - p[1]); if (d > 1e-9 * F.size && d < m) m = d; }
    if (!best || m > best.m) best = { st, m };
  }
  return [best.st[0], best.st[1], best.st[0], best.st[1], 0.6, 1.6, 2.6, 1.4, 0.21, 0.8];
}

/** The form in which e1 and e2 are orthonormal, for the group of translations alone (any form is invariant there). */
export function metricOf(group) {
  if (group.reps.length !== 1) return null;
  const [ax, ay] = group.e1, [bx, by] = group.e2, dt = ax * by - ay * bx;
  const r0 = [by / dt, -bx / dt], r1 = [-ay / dt, ax / dt];                  // the rows of [e1 e2]^-1
  return [r0[0] * r0[0] + r1[0] * r1[0], r0[0] * r0[1] + r1[0] * r1[1], r0[1] * r0[1] + r1[1] * r1[1]];
}

export function knobsFor(group) {
  const v = TABLE[group.id] || fallback(group);
  return { p: [v[0], v[1]], light: [{ h: [v[2], v[3]], dir: v[4], len: v[5], t0: v[6], t1: v[7], rad: v[8], pow: v[9] || 1 }], metric: metricOf(group), ...STYLE };
}

export function find(group) {
  const { shapes, info } = build(group, knobsFor(group));
  return { shapes, info };
}
