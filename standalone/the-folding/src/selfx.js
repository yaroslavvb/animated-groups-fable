// selfx.js — where a triangle mesh passes through itself. Pure, no DOM. (Written for the 22x lab, lab22x/; the tests
// of the re-cut motion, test/recut.test.js, measure with it that no paper passes through paper. Not part of the app.)
//
//   const X = createSelfX(tri /*Uint32Array(3m)*/, opts?)
//       opts.skip   Uint8Array(m): a pair with a flagged triangle is not looked at (rimTriangles: the triangles along
//                   the outline of a piece — a rim that ends ON another sheet touches it; on a faceted mesh its
//                   triangles dip through the facets by the facets' own sag, which is no passing through)
//   const r = X.compute(pos /*Float32Array(3n)*/)      -> { segs: Float64Array(6 * count), pairs: Int32Array(2 * count), count, length }
//                                                         pairs: the two triangles each segment lies in
//   chainSegments(segs, count, tol) -> [Float32Array(3k), ...]   the segments joined end to end into polylines
//
// What counts as a crossing: two triangles that share no vertex and cut through each other TRANSVERSALLY — each has
// corners strictly on both sides of the other's plane, and their planes make an angle of more than `minAngle`.
// What does not: triangles that only touch (a corner or an edge of one lies in the other's plane within `eps`: the two
// sides of a closed seam, four sheets that end on one line), and sheets that lie on each other (nearly parallel planes).
// So a closed seam is silent, and a line along which the sheet runs through itself is found.
//
// Method: sweep and prune along the longest axis of the mesh's bounding box, then Moller's interval test on the line
// in which the two planes meet. About 1 ms for 3,000 triangles.

const DEFAULTS = { eps: 1e-5, minAngle: 0.03, minLength: 1e-4, skip: null };

export function createSelfX(tri, opts = {}) {
  const m = (tri.length / 3) | 0;
  const O = { ...DEFAULTS, ...opts };
  const skip = O.skip && O.skip.length >= m ? O.skip : null;
  const lo = new Float64Array(3 * m), hi = new Float64Array(3 * m);
  const order = new Int32Array(m);
  for (let t = 0; t < m; t++) order[t] = t;
  const key = new Float64Array(m);
  let segs = new Float64Array(6 * 256), pairs = new Int32Array(2 * 256);
  // scratch
  const nA = [0, 0, 0], nB = [0, 0, 0], d = [0, 0, 0];
  const sA = [0, 0, 0], sB = [0, 0, 0];
  const pa = new Float64Array(6), pb = new Float64Array(6);

  /** The two points where the triangle (i0, i1, i2) of `pos` meets a plane, given its corners' signed distances s. */
  function cut(pos, i0, i1, i2, s, out) {
    const I = [i0, i1, i2];
    let k = 0;
    for (let e = 0; e < 3 && k < 2; e++) {
      const a = I[e], b = I[(e + 1) % 3], sa = s[e], sb = s[(e + 1) % 3];
      if (sa === 0) {
        // a corner in the plane: counted once (when it is the edge's first end)
        out[3 * k] = pos[3 * a]; out[3 * k + 1] = pos[3 * a + 1]; out[3 * k + 2] = pos[3 * a + 2]; k++;
      } else if (sb !== 0 && (sa > 0) !== (sb > 0)) {
        const u = sa / (sa - sb);
        out[3 * k] = pos[3 * a] + u * (pos[3 * b] - pos[3 * a]);
        out[3 * k + 1] = pos[3 * a + 1] + u * (pos[3 * b + 1] - pos[3 * a + 1]);
        out[3 * k + 2] = pos[3 * a + 2] + u * (pos[3 * b + 2] - pos[3 * a + 2]); k++;
      }
    }
    return k;
  }

  function compute(pos, scaleHint) {
    // bounding boxes, and the box of everything
    let X0 = Infinity, Y0 = Infinity, Z0 = Infinity, X1 = -Infinity, Y1 = -Infinity, Z1 = -Infinity;
    for (let t = 0; t < m; t++) {
      const a = 3 * tri[3 * t], b = 3 * tri[3 * t + 1], c = 3 * tri[3 * t + 2];
      for (let k = 0; k < 3; k++) {
        const u = pos[a + k], v = pos[b + k], w = pos[c + k];
        lo[3 * t + k] = u < v ? (u < w ? u : w) : (v < w ? v : w);
        hi[3 * t + k] = u > v ? (u > w ? u : w) : (v > w ? v : w);
      }
      if (lo[3 * t] < X0) X0 = lo[3 * t]; if (hi[3 * t] > X1) X1 = hi[3 * t];
      if (lo[3 * t + 1] < Y0) Y0 = lo[3 * t + 1]; if (hi[3 * t + 1] > Y1) Y1 = hi[3 * t + 1];
      if (lo[3 * t + 2] < Z0) Z0 = lo[3 * t + 2]; if (hi[3 * t + 2] > Z1) Z1 = hi[3 * t + 2];
    }
    const ex = X1 - X0, ey = Y1 - Y0, ez = Z1 - Z0;
    const scale = scaleHint > 0 ? scaleHint : Math.max(ex, ey, ez) || 1;
    const eps = O.eps * scale, minLen = O.minLength * scale, sinMin = Math.sin(O.minAngle);
    const ax = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2, a1 = (ax + 1) % 3, a2 = (ax + 2) % 3;
    for (let t = 0; t < m; t++) key[t] = lo[3 * t + ax];
    // insertion sort: the order of the last frame is nearly right
    for (let i = 1; i < m; i++) {
      const t = order[i], k = key[t];
      let j = i - 1;
      while (j >= 0 && key[order[j]] > k) { order[j + 1] = order[j]; j--; }
      order[j + 1] = t;
    }
    let count = 0, length = 0;
    for (let i = 0; i < m; i++) {
      const A = order[i], A3 = 3 * A, aMax = hi[A3 + ax];
      if (skip && skip[A]) continue;
      const i0 = tri[A3], i1 = tri[A3 + 1], i2 = tri[A3 + 2];
      let haveA = false, lenA = 0, dA = 0;
      for (let j = i + 1; j < m; j++) {
        const B = order[j], B3 = 3 * B;
        if (lo[B3 + ax] > aMax) break;
        if (skip && skip[B]) continue;
        if (lo[B3 + a1] > hi[A3 + a1] || hi[B3 + a1] < lo[A3 + a1] || lo[B3 + a2] > hi[A3 + a2] || hi[B3 + a2] < lo[A3 + a2]) continue;
        const j0 = tri[B3], j1 = tri[B3 + 1], j2 = tri[B3 + 2];
        if (i0 === j0 || i0 === j1 || i0 === j2 || i1 === j0 || i1 === j1 || i1 === j2 || i2 === j0 || i2 === j1 || i2 === j2) continue;
        if (!haveA) {
          const p = 3 * i0, q = 3 * i1, r = 3 * i2;
          const ux = pos[q] - pos[p], uy = pos[q + 1] - pos[p + 1], uz = pos[q + 2] - pos[p + 2];
          const vx = pos[r] - pos[p], vy = pos[r + 1] - pos[p + 1], vz = pos[r + 2] - pos[p + 2];
          nA[0] = uy * vz - uz * vy; nA[1] = uz * vx - ux * vz; nA[2] = ux * vy - uy * vx;
          lenA = Math.hypot(nA[0], nA[1], nA[2]);
          if (lenA > 0) { nA[0] /= lenA; nA[1] /= lenA; nA[2] /= lenA; }
          dA = -(nA[0] * pos[p] + nA[1] * pos[p + 1] + nA[2] * pos[p + 2]);
          haveA = true;
        }
        if (!(lenA > 0)) break;
        // the corners of B against the plane of A
        let pos_ = 0, neg_ = 0;
        const J = [j0, j1, j2];
        for (let k = 0; k < 3; k++) {
          const v = 3 * J[k];
          let s = nA[0] * pos[v] + nA[1] * pos[v + 1] + nA[2] * pos[v + 2] + dA;
          if (s < eps && s > -eps) s = 0;
          sB[k] = s; if (s > 0) pos_++; else if (s < 0) neg_++;
        }
        if (!pos_ || !neg_) continue;
        // the plane of B, the corners of A against it
        const p = 3 * j0, q = 3 * j1, r = 3 * j2;
        const ux = pos[q] - pos[p], uy = pos[q + 1] - pos[p + 1], uz = pos[q + 2] - pos[p + 2];
        const vx = pos[r] - pos[p], vy = pos[r + 1] - pos[p + 1], vz = pos[r + 2] - pos[p + 2];
        nB[0] = uy * vz - uz * vy; nB[1] = uz * vx - ux * vz; nB[2] = ux * vy - uy * vx;
        const lenB = Math.hypot(nB[0], nB[1], nB[2]);
        if (!(lenB > 0)) continue;
        nB[0] /= lenB; nB[1] /= lenB; nB[2] /= lenB;
        const dB = -(nB[0] * pos[p] + nB[1] * pos[p + 1] + nB[2] * pos[p + 2]);
        pos_ = 0; neg_ = 0;
        const I = [i0, i1, i2];
        for (let k = 0; k < 3; k++) {
          const v = 3 * I[k];
          let s = nB[0] * pos[v] + nB[1] * pos[v + 1] + nB[2] * pos[v + 2] + dB;
          if (s < eps && s > -eps) s = 0;
          sA[k] = s; if (s > 0) pos_++; else if (s < 0) neg_++;
        }
        if (!pos_ || !neg_) continue;
        d[0] = nA[1] * nB[2] - nA[2] * nB[1]; d[1] = nA[2] * nB[0] - nA[0] * nB[2]; d[2] = nA[0] * nB[1] - nA[1] * nB[0];
        const dl = Math.hypot(d[0], d[1], d[2]);
        if (dl < sinMin) continue;                       // sheets lying on each other
        if (cut(pos, i0, i1, i2, sA, pa) !== 2 || cut(pos, j0, j1, j2, sB, pb) !== 2) continue;
        let ta0 = d[0] * pa[0] + d[1] * pa[1] + d[2] * pa[2], ta1 = d[0] * pa[3] + d[1] * pa[4] + d[2] * pa[5];
        let tb0 = d[0] * pb[0] + d[1] * pb[1] + d[2] * pb[2], tb1 = d[0] * pb[3] + d[1] * pb[4] + d[2] * pb[5];
        let a0 = 0, a1o = 3, b0 = 0, b1o = 3;
        if (ta0 > ta1) { const x = ta0; ta0 = ta1; ta1 = x; a0 = 3; a1o = 0; }
        if (tb0 > tb1) { const x = tb0; tb0 = tb1; tb1 = x; b0 = 3; b1o = 0; }
        const tlo = ta0 > tb0 ? ta0 : tb0, thi = ta1 < tb1 ? ta1 : tb1;
        if (!((thi - tlo) / dl > minLen)) continue;
        if (6 * (count + 1) > segs.length) { const g = new Float64Array(2 * segs.length); g.set(segs); segs = g; const h = new Int32Array(2 * pairs.length); h.set(pairs); pairs = h; }
        pairs[2 * count] = A; pairs[2 * count + 1] = B;
        const o = 6 * count;
        if (ta0 > tb0) { segs[o] = pa[a0]; segs[o + 1] = pa[a0 + 1]; segs[o + 2] = pa[a0 + 2]; } else { segs[o] = pb[b0]; segs[o + 1] = pb[b0 + 1]; segs[o + 2] = pb[b0 + 2]; }
        if (ta1 < tb1) { segs[o + 3] = pa[a1o]; segs[o + 4] = pa[a1o + 1]; segs[o + 5] = pa[a1o + 2]; } else { segs[o + 3] = pb[b1o]; segs[o + 4] = pb[b1o + 1]; segs[o + 5] = pb[b1o + 2]; }
        length += Math.hypot(segs[o + 3] - segs[o], segs[o + 4] - segs[o + 1], segs[o + 5] - segs[o + 2]);
        count++;
      }
    }
    return { segs, pairs, count, length, scale };
  }

  return { compute, triangles: m };
}

/**
 * Join segments end to end into polylines. Ends closer than `tol` are one point. A point where more than two segments
 * meet ends the polylines there. -> [Float32Array(3k), ...] (k >= 2), longest first.
 */
export function chainSegments(segs, count, tol = 1e-4) {
  if (!count) return [];
  const inv = 1 / tol;
  const cellOf = new Map();
  const px = [], py = [], pz = [];
  const idOf = (x, y, z) => {
    const cx = Math.floor(x * inv), cy = Math.floor(y * inv), cz = Math.floor(z * inv);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const list = cellOf.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz));
      if (!list) continue;
      for (const id of list) if (Math.abs(px[id] - x) <= tol && Math.abs(py[id] - y) <= tol && Math.abs(pz[id] - z) <= tol) return id;
    }
    const id = px.length;
    px.push(x); py.push(y); pz.push(z);
    const k = cx + ',' + cy + ',' + cz;
    const list = cellOf.get(k);
    if (list) list.push(id); else cellOf.set(k, [id]);
    return id;
  };
  const ends = new Int32Array(2 * count);
  for (let s = 0; s < count; s++) {
    ends[2 * s] = idOf(segs[6 * s], segs[6 * s + 1], segs[6 * s + 2]);
    ends[2 * s + 1] = idOf(segs[6 * s + 3], segs[6 * s + 4], segs[6 * s + 5]);
  }
  const np = px.length;
  const adj = Array.from({ length: np }, () => []);
  for (let s = 0; s < count; s++) { if (ends[2 * s] === ends[2 * s + 1]) continue; adj[ends[2 * s]].push(s); adj[ends[2 * s + 1]].push(s); }
  const used = new Uint8Array(count);
  const out = [];
  const walk = (start, first) => {
    const ids = [start];
    let p = start, s = first;
    while (s >= 0) {
      used[s] = 1;
      p = ends[2 * s] === p ? ends[2 * s + 1] : ends[2 * s];
      ids.push(p);
      if (adj[p].length !== 2 || p === start) break;
      const n = adj[p][0] === s ? adj[p][1] : adj[p][0];
      s = used[n] ? -1 : n;
    }
    const a = new Float32Array(3 * ids.length);
    for (let i = 0; i < ids.length; i++) { a[3 * i] = px[ids[i]]; a[3 * i + 1] = py[ids[i]]; a[3 * i + 2] = pz[ids[i]]; }
    out.push(a);
  };
  // open chains first (from the points where exactly one segment ends, or more than two meet), then the loops
  for (let p = 0; p < np; p++) if (adj[p].length !== 2) for (const s of adj[p]) if (!used[s]) walk(p, s);
  for (let s = 0; s < count; s++) if (!used[s] && ends[2 * s] !== ends[2 * s + 1]) walk(ends[2 * s], s);
  out.sort((a, b) => b.length - a.length);
  return out;
}

/** The total length of polylines (Float32Array(3k) each). */
export function polylineLength(lines) {
  let L = 0;
  for (const a of lines) for (let i = 3; i < a.length; i += 3) L += Math.hypot(a[i] - a[i - 3], a[i + 1] - a[i - 2], a[i + 2] - a[i - 1]);
  return L;
}

/**
 * A second triangulation of the same sheet for the detector: the plane points of the INTERIOR vertices moved a little
 * (a fixed pseudo-random direction, 0.3 of the smallest altitude of the triangles round the vertex), the vertices on
 * the outline and on a crease (where `triPiece` changes) left where they are. Why: the fold's own mesh has lines of
 * edges exactly where the closed surface runs through itself (the middle lines of the kaleidoscope's cells are folded
 * onto the double line), and two sheets that cross exactly along edges of both only TOUCH, triangle by triangle. In the
 * moved triangulation the crossing runs through the inside of triangles and is found; a closed seam stays silent.
 *   xy        Float32Array | Float64Array (2n): the plane points
 *   tri       Uint32Array (3m)
 *   triPiece  optional (m): the rigid piece of each triangle; a vertex whose triangles differ in it does not move
 * -> Float64Array(2n)
 */
export function jitterPlane(xy, tri, triPiece = null, share = 0.3) {
  const n = xy.length >> 1, m = (tri.length / 3) | 0;
  const out = Float64Array.from(xy);
  const fixed = new Uint8Array(n), alt = new Float64Array(n).fill(Infinity), piece = new Int32Array(n).fill(-1);
  const edges = new Map();
  for (let t = 0; t < m; t++) {
    const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
    const ax = xy[2 * a], ay = xy[2 * a + 1], bx = xy[2 * b], by = xy[2 * b + 1], cx = xy[2 * c], cy = xy[2 * c + 1];
    const area2 = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
    const lmax = Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(cx - bx, cy - by), Math.hypot(ax - cx, ay - cy));
    const h = lmax > 0 ? area2 / lmax : 0;                    // the smallest altitude
    for (const v of [a, b, c]) {
      if (h < alt[v]) alt[v] = h;
      if (triPiece) { if (piece[v] === -1) piece[v] = triPiece[t]; else if (piece[v] !== triPiece[t]) fixed[v] = 1; }
    }
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const k = u < v ? u * n + v : v * n + u;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  }
  for (const [k, cnt] of edges) if (cnt === 1) { fixed[Math.floor(k / n)] = 1; fixed[k % n] = 1; }
  for (let v = 0; v < n; v++) {
    if (fixed[v] || !(alt[v] > 0) || alt[v] === Infinity) continue;
    const r = Math.sin(v * 12.9898 + 4.1414) * 43758.5453, ang = 2 * Math.PI * (r - Math.floor(r));
    out[2 * v] += share * alt[v] * Math.cos(ang); out[2 * v + 1] += share * alt[v] * Math.sin(ang);
  }
  return out;
}

/**
 * The triangles along the outline of the mesh's pieces: flags (Uint8Array(m)).
 *   rimTriangles(tri, n)                 every triangle with a corner on the outline (an edge of one triangle only)
 *   rimTriangles(tri, n, { xy, within }) every triangle with a corner closer than `within` (plane distance, on the
 *                                        flat mesh xy) to a corner on the outline. A mesh that was cut has slivers
 *                                        along its cuts, so "one triangle from the rim" is no distance; this is.
 */
export function rimTriangles(tri, n, { xy = null, within = 0 } = {}) {
  const m = (tri.length / 3) | 0, edges = new Map();
  for (let t = 0; t < m; t++) {
    for (let e = 0; e < 3; e++) {
      const u = tri[3 * t + e], v = tri[3 * t + (e + 1) % 3], k = u < v ? u * n + v : v * n + u;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  }
  const onRim = new Uint8Array(n);
  for (const [k, cnt] of edges) if (cnt === 1) { onRim[Math.floor(k / n)] = 1; onRim[k % n] = 1; }
  const near = onRim.slice();
  if (xy && within > 0) {
    const inv = 1 / within, grid = new Map();
    const key = (i, j) => i + ',' + j;
    for (let v = 0; v < n; v++) {
      if (!onRim[v]) continue;
      const k = key(Math.floor(xy[2 * v] * inv), Math.floor(xy[2 * v + 1] * inv));
      const l = grid.get(k);
      if (l) l.push(v); else grid.set(k, [v]);
    }
    for (let v = 0; v < n; v++) {
      if (near[v]) continue;
      const x = xy[2 * v], y = xy[2 * v + 1], ci = Math.floor(x * inv), cj = Math.floor(y * inv);
      for (let di = -1; di <= 1 && !near[v]; di++) for (let dj = -1; dj <= 1 && !near[v]; dj++) {
        const l = grid.get(key(ci + di, cj + dj));
        if (!l) continue;
        for (const u of l) if (Math.hypot(xy[2 * u] - x, xy[2 * u + 1] - y) < within) { near[v] = 1; break; }
      }
    }
  }
  const flag = new Uint8Array(m);
  for (let t = 0; t < m; t++) if (near[tri[3 * t]] || near[tri[3 * t + 1]] || near[tri[3 * t + 2]]) flag[t] = 1;
  return flag;
}
