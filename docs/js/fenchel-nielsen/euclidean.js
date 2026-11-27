// Exact 2D Euclidean Isom(E^2) wallpaper orbifold geometry engine.
// Supports all 17 wallpaper groups normalized cleanly with Voronoi / Dirichlet
// fundamental domains, Z_2^2 quotient coloring, camera wrapping, and exact stationary recuts.
// Zero DOM dependencies so it can be verified directly in Node.

export const EID3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];

export function emul3(A, B) {
  return [
    [
      A[0][0] * B[0][0] + A[0][1] * B[1][0],
      A[0][0] * B[0][1] + A[0][1] * B[1][1],
      A[0][0] * B[0][2] + A[0][1] * B[1][2] + A[0][2]
    ],
    [
      A[1][0] * B[0][0] + A[1][1] * B[1][0],
      A[1][0] * B[0][1] + A[1][1] * B[1][1],
      A[1][0] * B[0][2] + A[1][1] * B[1][2] + A[1][2]
    ],
    [0, 0, 1]
  ];
}

export function einv3(M) {
  // Exact inverse of an orthogonal 2x2 isometry matrix
  const a = M[0][0], b = M[0][1], tx = M[0][2];
  const c = M[1][0], d = M[1][1], ty = M[1][2];
  const det = a * d - b * c;
  const ia = d / det, ib = -b / det;
  const ic = -c / det, id = a / det;
  return [
    [ia, ib, -(ia * tx + ib * ty)],
    [ic, id, -(ic * tx + id * ty)],
    [0, 0, 1]
  ];
}

export function edet3(M) {
  return M[0][0] * M[1][1] - M[0][1] * M[1][0];
}

export function eapply(M, p) {
  return [
    M[0][0] * p[0] + M[0][1] * p[1] + M[0][2],
    M[1][0] * p[0] + M[1][1] * p[1] + M[1][2]
  ];
}

export function etrans(dx, dy) {
  return [
    [1, 0, dx],
    [0, 1, dy],
    [0, 0, 1]
  ];
}

export function erotAt(px, py, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [
    [c, -s, px - c * px + s * py],
    [s, c, py - s * px - c * py],
    [0, 0, 1]
  ];
}

export function ereflLine(p0, p1) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const c = nx * p0[0] + ny * p0[1];
  return [
    [1 - 2 * nx * nx, -2 * nx * ny, 2 * nx * c],
    [-2 * nx * ny, 1 - 2 * ny * ny, 2 * ny * c],
    [0, 0, 1]
  ];
}

export function eglideLine(p0, p1, step) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return emul3(etrans(step * ux, step * uy), ereflLine(p0, p1));
}

export function efit(a0, b0, a1, b1) {
  const ang0 = Math.atan2(b0[1] - a0[1], b0[0] - a0[0]);
  const ang1 = Math.atan2(b1[1] - a1[1], b1[0] - a1[0]);
  const dAng = ang1 - ang0;
  return emul3(etrans(a1[0] - a0[0], a1[1] - a0[1]), erotAt(a0[0], a0[1], dAng));
}

export function polygonAreaE(verts) {
  let sum = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) * 0.5;
}

export function polyCentroidE(verts) {
  if (!verts.length) return [0, 0];
  let sx = 0, sy = 0;
  for (let i = 0; i < verts.length; i++) {
    sx += verts[i][0];
    sy += verts[i][1];
  }
  return [sx / verts.length, sy / verts.length];
}

function wrapHalf(x) {
  let r = x - Math.round(x);
  if (r <= -0.5) r += 1;
  if (r > 0.5) r -= 1;
  return r;
}

/**
 * Conway's Listing/superbase reduction in E^2.
 */
export function reduceSuperbase(e1, e2, tol = 1e-12) {
  let Va = [1, 0], Vb = [0, 1], Vc = [-1, -1];
  const comb = (r) => [r[0] * e1[0] + r[1] * e2[0], r[0] * e1[1] + r[1] * e2[1]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  for (let n = 0; n < 10000; n++) {
    const va = comb(Va), vb = comb(Vb), vc = comb(Vc);
    const dab = dot(va, vb), dac = dot(va, vc), dbc = dot(vb, vc);
    if (dab > tol) {
      [Vb, Vc] = [[-Vb[0], -Vb[1]], [Vb[0] - Va[0], Vb[1] - Va[1]]];
    } else if (dac > tol) {
      [Vb, Vc] = [[Vc[0] - Va[0], Vc[1] - Va[1]], [-Vc[0], -Vc[1]]];
    } else if (dbc > tol) {
      [Va, Vc] = [[Vc[0] - Vb[0], Vc[1] - Vb[1]], [-Vc[0], -Vc[1]]];
    } else {
      const sig = Va[0] * Vb[1] - Va[1] * Vb[0];
      return { Va, Vb, Vc, va, vb, vc, sig };
    }
  }
  return { Va, Vb, Vc, va: comb(Va), vb: comb(Vb), vc: comb(Vc), sig: 1 };
}

/**
 * Exact convex Voronoi cell around `center` against `neighborPts` in E^2.
 */
export function euclideanVoronoiCell(center, neighborPts, bound = 14) {
  let poly = [
    [center[0] - bound, center[1] - bound],
    [center[0] + bound, center[1] - bound],
    [center[0] + bound, center[1] + bound],
    [center[0] - bound, center[1] + bound]
  ];
  const NEAR = 1e-10;
  for (let ni = 0; ni < neighborPts.length; ni++) {
    const q = neighborPts[ni];
    const nx = q[0] - center[0];
    const ny = q[1] - center[1];
    const nLen = Math.hypot(nx, ny);
    if (nLen < 1e-8) continue;
    const midx = 0.5 * (center[0] + q[0]);
    const midy = 0.5 * (center[1] + q[1]);
    const val = (p) => ((p[0] - midx) * nx + (p[1] - midy) * ny) / nLen;
    const vals = poly.map(val);
    if (vals.every((v) => v <= NEAR)) continue;
    if (vals.every((v) => v > NEAR)) return [];
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const va = vals[i];
      const vb = vals[(i + 1) % poly.length];
      if (va <= NEAR) out.push(a);
      if ((va <= NEAR) !== (vb <= NEAR)) {
        const t = va / (va - vb);
        out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    poly = out;
    if (poly.length < 3) return [];
  }
  const cleaned = [];
  for (let i = 0; i < poly.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    if (!prev || Math.hypot(poly[i][0] - prev[0], poly[i][1] - prev[1]) > 1e-7) {
      cleaned.push(poly[i]);
    }
  }
  if (cleaned.length >= 2 && Math.hypot(cleaned[0][0] - cleaned[cleaned.length - 1][0], cleaned[0][1] - cleaned[cleaned.length - 1][1]) < 1e-7) {
    cleaned.pop();
  }
  return cleaned;
}

function isometryError(M) {
  const c0 = M[0][0] * M[0][0] + M[1][0] * M[1][0];
  const c1 = M[0][1] * M[0][1] + M[1][1] * M[1][1];
  const d = M[0][0] * M[0][1] + M[1][0] * M[1][1];
  return Math.max(Math.abs(c0 - 1), Math.abs(c1 - 1), Math.abs(d));
}

function deduplicateEucGens(gens) {
  const out = [];
  for (const g of gens) {
    const det = edet3(g.M) >= 0;
    let dup = false;
    for (const u of out) {
      if ((edet3(u.M) >= 0) !== det) continue;
      let err = 0;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 3; j++) err += Math.abs(g.M[i][j] - u.M[i][j]);
      }
      if (err < 1e-8) {
        dup = true;
        break;
      }
    }
    if (!dup) out.push(g);
  }
  return out;
}

function makeTestPts(fdPolygons) {
  const verts = fdPolygons[0].vertsE;
  const c = polyCentroidE(verts);
  const p1 = [0.68 * c[0] + 0.19 * verts[0][0] + 0.13 * verts[1][0], 0.68 * c[1] + 0.19 * verts[0][1] + 0.13 * verts[1][1]];
  const p2 = [0.55 * c[0] + 0.27 * verts[0][0] + 0.18 * verts[1][0], 0.55 * c[1] + 0.27 * verts[0][1] + 0.18 * verts[1][1]];
  return [p1, p2];
}

function popcountBig(x) {
  let c = 0;
  let v = x;
  while (v !== 0n) {
    v &= v - 1n;
    c++;
  }
  return c;
}

/**
 * Exact F_2 RREF quotient solver for Euclidean wallpaper groups.
 */
function computeEuclideanZ2Quotient(fdPolygons, gens) {
  const k = gens ? gens.length : 0;
  if (!fdPolygons || fdPolygons.length === 0 || k === 0) {
    return { genColorMasks: new Array(k).fill(0), quotientSize: 1 };
  }

  const [testPt1, testPt2] = makeTestPts(fdPolygons);
  const samePts = (a1, a2, detPos, b1, b2, detPosB) =>
    detPos === detPosB &&
    Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) < 1e-4 &&
    Math.hypot(a2[0] - b2[0], a2[1] - b2[1]) < 1e-4;
  const fixesTestPts = (M) =>
    samePts(eapply(M, testPt1), eapply(M, testPt2), edet3(M) >= 0, testPt1, testPt2, true);

  const relations = [];
  const evenCornerPairs = [];

  for (let i = 0; i < k; i++) {
    const M = gens[i].M;
    if (edet3(M) > 0) {
      const tr2 = M[0][0] + M[1][1];
      if (tr2 < 2 - 1e-4) {
        let Q = M;
        for (let q = 2; q <= 12; q++) {
          Q = emul3(Q, M);
          if (fixesTestPts(Q)) {
            if (q % 2 === 1) relations.push(1n << BigInt(i));
            break;
          }
        }
      }
    }
  }

  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const P = emul3(gens[i].M, gens[j].M);
      if (fixesTestPts(P)) {
        relations.push((1n << BigInt(i)) | (1n << BigInt(j)));
        continue;
      }
      if (edet3(P) > 0) {
        const tr2 = P[0][0] + P[1][1];
        if (tr2 < 2 - 1e-4) {
          let Q = P;
          for (let q = 2; q <= 12; q++) {
            Q = emul3(Q, P);
            if (fixesTestPts(Q)) {
              if (q % 2 === 1) relations.push((1n << BigInt(i)) | (1n << BigInt(j)));
              else evenCornerPairs.push([i, j]);
              break;
            }
          }
        }
      }
    }
  }

  // BFS cycle relations on Cayley graph
  const buckets = new Map();
  const scale = 12;
  const queue = [{ M: EID3, dist: 0, vec: 0n }];
  buckets.set(`${Math.round(testPt1[0] * scale)},${Math.round(testPt1[1] * scale)}`, [
    { p1: testPt1, p2: testPt2, detPos: true, vec: 0n }
  ]);

  let qHead = 0;
  while (qHead < queue.length && queue.length < 320) {
    const cur = queue[qHead++];
    for (let gi = 0; gi < k; gi++) {
      const M2 = emul3(cur.M, gens[gi].M);
      const p1 = eapply(M2, testPt1);
      if (Math.hypot(p1[0], p1[1]) > 10) continue;
      const p2 = eapply(M2, testPt2);
      const detPos = edet3(M2) >= 0;
      const edgeVec = cur.vec ^ (1n << BigInt(gi));
      const bx = Math.round(p1[0] * scale);
      const by = Math.round(p1[1] * scale);
      let found = null;
      for (let dx = -1; dx <= 1 && !found; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const list = buckets.get(`${bx + dx},${by + dy}`);
          if (!list) continue;
          for (const item of list) {
            if (samePts(p1, p2, detPos, item.p1, item.p2, item.detPos)) {
              found = item;
              break;
            }
          }
        }
      }
      if (found) {
        const cyc = edgeVec ^ found.vec;
        if (cyc !== 0n) relations.push(cyc);
      } else {
        const home = `${bx},${by}`;
        if (!buckets.has(home)) buckets.set(home, []);
        buckets.get(home).push({ p1, p2, detPos, vec: edgeVec });
        queue.push({ M: M2, dist: Math.hypot(p1[0], p1[1]), vec: edgeVec });
      }
    }
  }

  const pivots = new Map();
  for (let i = 0; i < relations.length; i++) {
    let x = relations[i];
    for (let c = 0; c < k && x !== 0n; c++) {
      if ((x >> BigInt(c)) & 1n) {
        const piv = pivots.get(c);
        if (piv !== undefined) x ^= piv;
        else {
          pivots.set(c, x);
          break;
        }
      }
    }
  }

  const pivotColsDesc = [...pivots.keys()].sort((a, b) => b - a);
  for (const cHigh of pivotColsDesc) {
    const pivHigh = pivots.get(cHigh);
    const maskHigh = 1n << BigInt(cHigh);
    for (const cLow of pivotColsDesc) {
      if (cLow < cHigh) {
        const pivLow = pivots.get(cLow);
        if (pivLow & maskHigh) pivots.set(cLow, pivLow ^ pivHigh);
      }
    }
  }

  const basis = [];
  for (let f = 0; f < k; f++) {
    if (pivots.has(f)) continue;
    let b = 1n << BigInt(f);
    const maskF = 1n << BigInt(f);
    for (const [c, piv] of pivots.entries()) {
      if (piv & maskF) b |= 1n << BigInt(c);
    }
    basis.push(b);
  }

  if (basis.length === 0) {
    return { genColorMasks: new Array(k).fill(0), quotientSize: 1 };
  }

  const masksFromVecs = (v0, v1 = 0n) => {
    const out = new Array(k);
    for (let i = 0; i < k; i++) {
      out[i] = Number((v0 >> BigInt(i)) & 1n) | (Number((v1 >> BigInt(i)) & 1n) << 1);
    }
    return out;
  };

  if (basis.length === 1) {
    return { genColorMasks: masksFromVecs(basis[0]), quotientSize: 2 };
  }

  const poolSet = new Set();
  const dim = basis.length;
  if (dim <= 6) {
    for (let mask = 1; mask < 1 << dim; mask++) {
      let v = 0n;
      for (let b = 0; b < dim; b++) if ((mask >> b) & 1) v ^= basis[b];
      if (v !== 0n) poolSet.add(v);
    }
  } else {
    for (let i = 0; i < dim; i++) {
      poolSet.add(basis[i]);
      for (let j = i + 1; j < dim; j++) poolSet.add(basis[i] ^ basis[j]);
    }
  }
  const candidates = [...poolSet];

  let detVec = 0n;
  for (let i = 0; i < k; i++) if (edet3(gens[i].M) < 0) detVec |= 1n << BigInt(i);
  const detValid =
    detVec !== 0n && [...pivots.values()].every((piv) => (popcountBig(piv & detVec) & 1) === 0);

  const scorePair = (v0, v1) => {
    const masks = masksFromVecs(v0, v1);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < k; i++) counts[masks[i]]++;
    const dNZ = (counts[1] > 0 ? 1 : 0) + (counts[2] > 0 ? 1 : 0) + (counts[3] > 0 ? 1 : 0);
    let evenDiff = 0;
    for (const [i, j] of evenCornerPairs) if (masks[i] !== masks[j]) evenDiff++;
    const balance =
      Math.abs(counts[1] - counts[3]) +
      (!detValid ? Math.abs(counts[1] - counts[2]) + Math.abs(counts[2] - counts[3]) : 0);
    return -10 * counts[0] + 12 * evenDiff + 6 * dNZ - balance;
  };

  let bestV0 = basis[0];
  let bestV1 = basis[1];
  if (detValid) {
    bestV0 = detVec;
    let bestScore = -Infinity;
    for (const v1 of candidates) {
      if (v1 === bestV0) continue;
      const sc = scorePair(bestV0, v1);
      if (sc > bestScore) {
        bestScore = sc;
        bestV1 = v1;
      }
    }
  } else {
    const half = k / 2;
    let bestErr = Infinity;
    for (const v0 of candidates) {
      const err = Math.abs(popcountBig(v0) - half);
      if (err < bestErr) {
        bestErr = err;
        bestV0 = v0;
      }
    }
    let bestScore = -Infinity;
    for (const v1 of candidates) {
      if (v1 === bestV0) continue;
      const sc = scorePair(bestV0, v1);
      if (sc > bestScore) {
        bestScore = sc;
        bestV1 = v1;
      }
    }
  }

  return {
    genColorMasks: masksFromVecs(bestV0, bestV1),
    quotientSize: 4
  };
}

/**
 * Wrap a query point into tile I of `real` under `real.gens`, returning { point, colorXor }.
 */
export function wrapPointIntoEucFD(point, fdPolygons, gens, genColorMasks) {
  if (!fdPolygons.length || !gens.length) return { point, colorXor: 0 };
  const center = polyCentroidE(fdPolygons[0].vertsE);
  let cur = point;
  let colorXor = 0;
  const curD = () => Math.hypot(cur[0] - center[0], cur[1] - center[1]);
  for (let step = 0; step < 64; step++) {
    let bestPt = null;
    let bestGi = -1;
    let bestD = curD();
    for (let gi = 0; gi < gens.length; gi++) {
      const cand = eapply(gens[gi].M, cur);
      const d = Math.hypot(cand[0] - center[0], cand[1] - center[1]);
      if (d < bestD - 1e-6) {
        bestD = d;
        bestPt = cand;
        bestGi = gi;
      }
    }
    if (!bestPt) break;
    cur = bestPt;
    if (genColorMasks) colorXor ^= genColorMasks[bestGi];
  }
  return { point: cur, colorXor };
}

/**
 * Compute convex Dirichlet fundamental domain around `p0` under `gens` in E^2,
 * tracking exact generator side-pairings and Z_2^2 quotient color masks.
 */
function buildEuclideanDirichlet(p0, gens, expectedArea, genColorMasks = null, markers = null) {
  if (!gens || gens.length === 0 || !expectedArea || expectedArea <= 0) return null;
  const ptTest = [p0[0], p0[1]];
  const sortedCands = [];
  const buckets = new Map();
  const scale = 10;
  const mark = (p) => {
    const bx = Math.round(p[0] * scale);
    const by = Math.round(p[1] * scale);
    const key = `${bx},${by}`;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = buckets.get(`${bx + dx},${by + dy}`);
        if (!list) continue;
        for (const q of list) {
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6) return false;
        }
      }
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(p);
    return true;
  };
  mark(ptTest);

  const heap = [];
  const pushHeap = (node) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].d <= heap[i].d) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const popHeap = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let m = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < heap.length && heap[l].d < heap[m].d) m = l;
        if (r < heap.length && heap[r].d < heap[m].d) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };

  pushHeap({ M: EID3, pt: ptTest, colorMask: 0, word: [], d: 0 });
  while (heap.length > 0 && sortedCands.length < 240) {
    const cur = popHeap();
    if (cur.d > 0) sortedCands.push(cur);
    for (let gi = 0; gi < gens.length; gi++) {
      const M2 = emul3(cur.M, gens[gi].M);
      const img = eapply(M2, ptTest);
      const d = Math.hypot(img[0] - ptTest[0], img[1] - ptTest[1]);
      if (d > 18) continue;
      if (mark(img)) {
        const colorMask = cur.colorMask ^ (genColorMasks ? genColorMasks[gi] : 0);
        const word = [...cur.word, gi];
        pushHeap({ M: M2, pt: img, colorMask, word, d });
      }
    }
  }

  const bound = 14;
  let poly = [
    [p0[0] - bound, p0[1] - bound, null],
    [p0[0] + bound, p0[1] - bound, null],
    [p0[0] + bound, p0[1] + bound, null],
    [p0[0] - bound, p0[1] + bound, null]
  ];
  const NEAR = 1e-10;
  for (let ni = 0; ni < sortedCands.length; ni++) {
    const { pt: q, M, colorMask, word } = sortedCands[ni];
    const nx = q[0] - p0[0];
    const ny = q[1] - p0[1];
    const nLen = Math.hypot(nx, ny);
    if (nLen < 1e-8) continue;
    const midx = 0.5 * (p0[0] + q[0]);
    const midy = 0.5 * (p0[1] + q[1]);
    const val = (p) => ((p[0] - midx) * nx + (p[1] - midy) * ny) / nLen;
    const vals = poly.map(val);
    if (vals.every((v) => v <= NEAR)) continue;
    if (vals.every((v) => v > NEAR)) {
      poly = [];
      break;
    }
    const meta = { M, colorMask, word };
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const va = vals[i];
      const vb = vals[(i + 1) % poly.length];
      if (va <= NEAR) out.push(a);
      if ((va <= NEAR) !== (vb <= NEAR)) {
        const t = va / (va - vb);
        const hx = a[0] + t * (b[0] - a[0]);
        const hy = a[1] + t * (b[1] - a[1]);
        out.push(va <= NEAR ? [hx, hy, meta] : [hx, hy, a[2]]);
      }
    }
    poly = out;
    if (poly.length < 3) break;
  }

  const cleaned = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = cleaned[cleaned.length - 1];
    if (prev && Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) <= 1e-7) {
      cleaned[cleaned.length - 1] = cur;
    } else {
      cleaned.push(cur);
    }
  }
  if (
    cleaned.length >= 2 &&
    Math.hypot(cleaned[0][0] - cleaned[cleaned.length - 1][0], cleaned[0][1] - cleaned[cleaned.length - 1][1]) <= 1e-7
  ) {
    cleaned.pop();
  }

  const verts = cleaned.map((v) => [v[0], v[1]]);
  if (verts.length < 3 || Math.abs(polygonAreaE(verts) - expectedArea) > 1e-3) {
    return null;
  }

  const sideGens = [];
  const addSideGen = (M, colorMask, word) => {
    const dPos = edet3(M) >= 0;
    for (let i = 0; i < sideGens.length; i++) {
      const s = sideGens[i];
      if ((edet3(s.M) >= 0) !== dPos) continue;
      let maxDiff = 0;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const df = Math.abs(s.M[r][c] - M[r][c]);
          if (df > maxDiff) maxDiff = df;
        }
      }
      if (maxDiff < 1e-4) return;
    }
    sideGens.push({
      label: `dir_${sideGens.length}`,
      M,
      colorMask: colorMask ?? 0,
      word: word ? [...word] : null
    });
  };
  for (let k = 0; k < cleaned.length; k++) {
    const meta = cleaned[k][2];
    if (meta && meta.M) {
      addSideGen(meta.M, meta.colorMask, meta.word);
      addSideGen(einv3(meta.M), meta.colorMask, meta.word);
    }
  }

  return {
    vertsE: verts,
    centroid: polyCentroidE(verts),
    pieceId: "dirichlet",
    parity: 0,
    isExteriorEdge: verts.map(() => true),
    sideGens,
    markers: markers ? markers.map((mk) => ({ ...mk })) : []
  };
}

/**
 * Build exact E^2 realization for any of the 17 Euclidean wallpaper orbifolds.
 */
export function buildEuclideanRealization(orb, carving, { dirichletBase = null, skipDirichletBuild = false } = {}) {
  const fdPolygons = [];
  const rawGens = [];
  const cutSegments = [];
  const markers = [];
  let expectedArea = 1.0;
  let eucMeta = { kind: orb.mode };
  let defaultBase = null;

  const pushGen = (label, M, role = "gen") => {
    rawGens.push({ label, M, role });
  };
  const pushGenPair = (label, invLabel, M, role = "gen") => {
    rawGens.push({ label, invLabel, M, role });
    rawGens.push({ label: invLabel, invLabel: label, M: einv3(M), role });
  };

  const makePoly = (verts, pieceId, parity, isExteriorEdge = null) => ({
    vertsE: verts,
    centroid: polyCentroidE(verts),
    pieceId,
    parity,
    isExteriorEdge: isExteriorEdge || verts.map(() => true)
  });

  if (orb.mode === "euc-2222") {
    expectedArea = 2.0;
    const cut = carving.cuts[0];
    const ell = cut.length;
    const tw = cut.twistTurns;
    const w = 1 / ell;
    const s = 2 * ell * tw;
    const e1 = [ell, 0];
    const e2 = [s, w];

    const i0 = parseInt(cut.pair[0].split(":")[1], 10);
    const i1 = parseInt(cut.pair[1].split(":")[1], 10);
    const restIndices = cut.restPair
      ? cut.restPair.map((id) => parseInt(id.split(":")[1], 10))
      : [0, 1, 2, 3].filter((idx) => idx !== i0 && idx !== i1);
    const [i2, i3] = restIndices;
    const perm = [i0, i1, i2, i3];

    const A = [-ell / 2, 0];
    const B = [ell / 2, 0];
    const C = [-ell / 2 + s, w];
    const D = [ell / 2 + s, w];
    const rawPts = [A, B, C, D];

    // Two half-strip pieces of area 1.0 each (width 2*ell, height w/2)
    const pBot = [
      [-ell / 2, 0],
      [1.5 * ell, 0],
      [1.5 * ell + s * 0.5, w * 0.5],
      [-ell / 2 + s * 0.5, w * 0.5]
    ];
    const pTop = [
      [-ell / 2 + s * 0.5, w * 0.5],
      [1.5 * ell + s * 0.5, w * 0.5],
      [1.5 * ell + s, w],
      [-ell / 2 + s, w]
    ];
    fdPolygons.push(
      makePoly(pBot, `piece:pant:${cut.id}`, 0, [true, true, false, true]),
      makePoly(pTop, "piece:pant-final", 1, [false, true, true, true])
    );

    const names = orb.coneItems;
    for (let slot = 0; slot < 4; slot++) {
      const idx = perm[slot];
      const P = rawPts[slot];
      pushGen(`R_${names[idx].letter}`, erotAt(P[0], P[1], Math.PI), "cone2");
      markers.push({ kind: "cone", order: 2, label: names[idx].shortLabel, featureId: names[idx].id, P, coneIndex: idx });
    }

    cutSegments.push({
      cutId: cut.id,
      color: cut.color,
      name: cut.name,
      A: [-ell / 2 + s * 0.5, w * 0.5],
      B: [1.5 * ell + s * 0.5, w * 0.5],
      samples: [
        [-ell / 2 + s * 0.5, w * 0.5],
        [1.5 * ell + s * 0.5, w * 0.5]
      ],
      twistTicks: true,
      length: 2 * ell,
      twistTurns: tw,
      tickBase: [-ell / 2, w * 0.5],
      tickEnd: [-ell / 2 + s, w * 0.5],
      tickNormal: [0, 0.08]
    });

    defaultBase = [0.19 * ell, 0.34 * w];
    eucMeta = { kind: "euc-2222", ell, tw, w, s, e1, e2, perm, conesPos: rawPts };
  } else if (orb.mode === "euc-torus") {
    const cut = carving.cuts[0];
    const ell = cut.length;
    const tw = cut.twistTurns;
    const h = 1 / ell;
    const e1 = [ell, 0];
    const e2 = [ell * tw, h];

    const verts = [
      [0, 0],
      [ell, 0],
      [ell + ell * tw, h],
      [ell * tw, h]
    ];
    fdPolygons.push(makePoly(verts, "piece:0", 0));
    pushGenPair(`T_${cut.name}`, `T_${cut.name}^-1`, etrans(e1[0], e1[1]), "translation");
    pushGenPair("T_b", "T_b^-1", etrans(e2[0], e2[1]), "translation");

    cutSegments.push({
      cutId: cut.id,
      color: cut.color,
      name: cut.name,
      A: [0, 0],
      B: [ell, 0],
      samples: [[0, 0], [ell, 0]],
      twistTicks: true,
      length: ell,
      twistTurns: tw,
      tickBase: [0, 0],
      tickEnd: [wrapHalf(tw) * ell, 0],
      tickNormal: [0, 0.075]
    });

    defaultBase = [0.5 * (ell + e2[0]), 0.5 * h];
    eucMeta = { kind: "euc-torus", ell, tw, e1, e2, pair: [...cut.pair] };
  } else if (orb.mode === "euc-rect-mirror") {
    const cut = carving.cuts[0];
    const a = cut.length;
    const h = 1 / a;
    const cList = orb.mirrorLoops[0].corners;
    const adjIdx = [0, 1, 2, 3].find((k) => {
      const u = cList[k].id;
      const v = cList[(k + 1) % 4].id;
      return (u === cut.pair[0] && v === cut.pair[1]) || (u === cut.pair[1] && v === cut.pair[0]);
    }) ?? 0;

    // Orient corners cyclically starting from the first vertex of cut.pair
    const perm = [adjIdx, (adjIdx + 1) % 4, (adjIdx + 2) % 4, (adjIdx + 3) % 4];
    const cornerPts = [
      [0, 0],
      [a, 0],
      [a, h],
      [0, h]
    ];
    fdPolygons.push(
      makePoly([[0, 0], [a, 0], [a, h * 0.5], [0, h * 0.5]], `piece:cut:${cut.id}`, 0, [true, true, false, true]),
      makePoly([[0, h * 0.5], [a, h * 0.5], [a, h], [0, h]], "piece:final", 0, [false, true, true, true])
    );

    pushGen("m_0", ereflLine([0, 0], [a, 0]), "mirror");
    pushGen("m_1", ereflLine([a, 0], [a, h]), "mirror");
    pushGen("m_2", ereflLine([a, h], [0, h]), "mirror");
    pushGen("m_3", ereflLine([0, h], [0, 0]), "mirror");

    for (let k = 0; k < 4; k++) {
      const cItem = cList[perm[k]];
      markers.push({ kind: "corner", order: 2, label: cItem.shortLabel, featureId: cItem.id, P: cornerPts[k], cornerIndex: perm[k] });
    }

    cutSegments.push({
      cutId: cut.id,
      color: cut.color,
      name: cut.name,
      A: [0, h * 0.5],
      B: [a, h * 0.5],
      samples: [[0, h * 0.5], [a, h * 0.5]]
    });

    defaultBase = [0.37 * a, 0.31 * h];
    eucMeta = { kind: "euc-rect-mirror", a, h, perm, cornerPts };
  } else if (orb.mode === "euc-1d") {
    const cut = carving.cuts[0];
    const a = cut.length;
    const h = 1 / a;
    if (orb.k === 0 && orb.b === 1 && orb.m === 1) {
      // 2*22 (c2mm): left/right/bottom mirrors + top midpoint half-turn
      fdPolygons.push(makePoly([[0, 0], [a, 0], [a, h], [0, h]], "piece:0", 0));
      pushGen("m_L", ereflLine([0, 0], [0, h]), "mirror");
      pushGen("m_R", ereflLine([a, 0], [a, h]), "mirror");
      pushGen("m_B", ereflLine([0, 0], [a, 0]), "mirror");
      pushGen("R_2", erotAt(a * 0.5, h, Math.PI), "cone2");
      markers.push(
        { kind: "corner", order: 2, label: orb.mirrorLoops[0].corners[0].shortLabel, featureId: orb.mirrorLoops[0].corners[0].id, P: [0, 0] },
        { kind: "corner", order: 2, label: orb.mirrorLoops[0].corners[1].shortLabel, featureId: orb.mirrorLoops[0].corners[1].id, P: [a, 0] },
        { kind: "cone", order: 2, label: orb.coneItems[0].shortLabel, featureId: orb.coneItems[0].id, P: [a * 0.5, h] }
      );
      cutSegments.push({ cutId: cut.id, color: cut.color, name: cut.name, A: [0, h * 0.5], B: [a, h * 0.5], samples: [[0, h * 0.5], [a, h * 0.5]] });
      defaultBase = [0.37 * a, 0.43 * h];
    } else if (orb.k === 0 && orb.b === 1 && orb.m === 2) {
      // 22* (p2mg): smooth bottom mirror + two cones on top edge + horizontal translation
      fdPolygons.push(makePoly([[0, 0], [a, 0], [a, h], [0, h]], "piece:0", 0));
      pushGen("m_*", ereflLine([0, 0], [a, 0]), "mirror");
      pushGen("R_A", erotAt(a * 0.25, h, Math.PI), "cone2");
      pushGen("R_B", erotAt(a * 0.75, h, Math.PI), "cone2");
      pushGenPair("T_x", "T_x^-1", etrans(a, 0), "translation");
      markers.push(
        { kind: "cone", order: 2, label: orb.coneItems[0].shortLabel, featureId: orb.coneItems[0].id, P: [a * 0.25, h] },
        { kind: "cone", order: 2, label: orb.coneItems[1].shortLabel, featureId: orb.coneItems[1].id, P: [a * 0.75, h] }
      );
      cutSegments.push({ cutId: cut.id, color: cut.color, name: cut.name, A: [0, 0], B: [a, 0], samples: [[0, 0], [a, 0]], isMirrorWall: true });
      defaultBase = [0.39 * a, 0.43 * h];
    } else if (orb.k === 1 && orb.m === 2) {
      // 22x (p2gg): horizontal & vertical glides
      fdPolygons.push(makePoly([[0, 0], [a, 0], [a, h], [0, h]], "piece:0", 0));
      pushGenPair("g_h", "g_h^-1", eglideLine([0, h * 0.5], [a, h * 0.5], a), "glide");
      pushGenPair("g_v", "g_v^-1", eglideLine([a * 0.5, 0], [a * 0.5, h], h), "glide");
      markers.push(
        { kind: "cone", order: 2, label: orb.coneItems[0].shortLabel, featureId: orb.coneItems[0].id, P: [0, 0] },
        { kind: "cone", order: 2, label: orb.coneItems[1].shortLabel, featureId: orb.coneItems[1].id, P: [a, 0] }
      );
      cutSegments.push({ cutId: cut.id, color: cut.color, name: cut.name, A: [0, h * 0.5], B: [a, h * 0.5], samples: [[0, h * 0.5], [a, h * 0.5]] });
      defaultBase = [0.38 * a, 0.31 * h];
    } else if (orb.b === 2 && orb.k === 0) {
      // ** (pm): two parallel mirrors + vertical translation
      fdPolygons.push(makePoly([[0, 0], [a, 0], [a, h], [0, h]], "piece:0", 0));
      pushGen("m_1", ereflLine([0, 0], [0, h]), "mirror");
      pushGen("m_2", ereflLine([a, 0], [a, h]), "mirror");
      pushGenPair("T_y", "T_y^-1", etrans(0, h), "translation");
      cutSegments.push({ cutId: cut.id, color: cut.color, name: cut.name, A: [0, h * 0.5], B: [a, h * 0.5], samples: [[0, h * 0.5], [a, h * 0.5]] });
      defaultBase = [0.41 * a, 0.37 * h];
    } else if (orb.b === 1 && orb.k === 1) {
      // *x (cm): triangle with mirror edge + slanted glide
      fdPolygons.push(makePoly([[0, -h], [a, 0], [0, h]], "piece:0", 0));
      pushGen("m_*", ereflLine([0, h], [0, -h]), "mirror");
      pushGenPair("g_x", "g_x^-1", eglideLine([a * 0.5, -h * 0.5], [a * 0.5, h * 0.5], h), "glide");
      cutSegments.push({ cutId: cut.id, color: cut.color, name: cut.name, A: [0, 0], B: [0, h], samples: [[0, 0], [0, h]], isMirrorWall: true });
      defaultBase = [0.29 * a, 0.13 * h];
    } else {
      // xx (pg): Klein bottle (vertical translation + horizontal glide)
      fdPolygons.push(makePoly([[0, 0], [a, 0], [a, h], [0, h]], "piece:0", 0));
      pushGenPair("g_x", "g_x^-1", eglideLine([0, h * 0.5], [a, h * 0.5], a), "glide");
      pushGenPair("T_y", "T_y^-1", etrans(0, h), "translation");
      cutSegments.push({ cutId: cut.id, color: cut.color, name: cut.name, A: [0, h * 0.5], B: [a, h * 0.5], samples: [[0, h * 0.5], [a, h * 0.5]] });
      defaultBase = [0.39 * a, 0.31 * h];
    }
  } else {
    // euc-rigid (8 zero-parameter wallpaper groups, area = 1.0)
    const sig = orb.canonical;
    if (sig === "*442") {
      const s = Math.SQRT2;
      fdPolygons.push(makePoly([[0, 0], [s, 0], [0, s]], "piece:0", 0));
      pushGen("m_y", ereflLine([0, 0], [s, 0]), "mirror");
      pushGen("m_h", ereflLine([s, 0], [0, s]), "mirror");
      pushGen("m_x", ereflLine([0, s], [0, 0]), "mirror");
      markers.push(
        { kind: "corner", order: 2, label: orb.mirrorLoops[0].corners[2].shortLabel, featureId: orb.mirrorLoops[0].corners[2].id, P: [0, 0] },
        { kind: "corner", order: 4, label: orb.mirrorLoops[0].corners[0].shortLabel, featureId: orb.mirrorLoops[0].corners[0].id, P: [s, 0] },
        { kind: "corner", order: 4, label: orb.mirrorLoops[0].corners[1].shortLabel, featureId: orb.mirrorLoops[0].corners[1].id, P: [0, s] }
      );
      defaultBase = [0.39 * s, 0.27 * s];
    } else if (sig === "442") {
      fdPolygons.push(makePoly([[0, 0], [1, 0], [1, 1], [0, 1]], "piece:0", 0));
      pushGenPair("r_4A", "r_4A^-1", erotAt(0, 0, Math.PI / 2), "rot");
      pushGenPair("r_4B", "r_4B^-1", erotAt(1, 1, Math.PI / 2), "rot");
      pushGen("r_2", erotAt(1, 0, Math.PI), "cone2");
      markers.push(
        { kind: "cone", order: 4, label: orb.coneItems[0].shortLabel, featureId: orb.coneItems[0].id, P: [0, 0] },
        { kind: "cone", order: 4, label: orb.coneItems[1].shortLabel, featureId: orb.coneItems[1].id, P: [1, 1] },
        { kind: "cone", order: 2, label: orb.coneItems[2].shortLabel, featureId: orb.coneItems[2].id, P: [1, 0] }
      );
      defaultBase = [0.43, 0.37];
    } else if (sig === "4*2") {
      const s = Math.SQRT2;
      fdPolygons.push(makePoly([[0, 0], [s, 0], [0, s]], "piece:0", 0));
      pushGenPair("r_4", "r_4^-1", erotAt(0, 0, Math.PI / 2), "rot");
      pushGen("m_h", ereflLine([s, 0], [0, s]), "mirror");
      markers.push(
        { kind: "cone", order: 4, label: orb.coneItems[0].shortLabel, featureId: orb.coneItems[0].id, P: [0, 0] },
        { kind: "corner", order: 2, label: orb.mirrorLoops[0].corners[0].shortLabel, featureId: orb.mirrorLoops[0].corners[0].id, P: [s, 0] }
      );
      defaultBase = [0.41, 0.27];
    } else if (sig === "*632") {
      const L = Math.sqrt(2 * Math.sqrt(3));
      const H = L / Math.sqrt(3);
      fdPolygons.push(makePoly([[0, 0], [L, 0], [0, H]], "piece:0", 0));
      pushGen("m_y", ereflLine([0, 0], [L, 0]), "mirror");
      pushGen("m_h", ereflLine([L, 0], [0, H]), "mirror");
      pushGen("m_x", ereflLine([0, H], [0, 0]), "mirror");
      markers.push(
        { kind: "corner", order: 6, label: orb.mirrorLoops[0].corners[0].shortLabel, featureId: orb.mirrorLoops[0].corners[0].id, P: [L, 0] },
        { kind: "corner", order: 3, label: orb.mirrorLoops[0].corners[1].shortLabel, featureId: orb.mirrorLoops[0].corners[1].id, P: [0, H] },
        { kind: "corner", order: 2, label: orb.mirrorLoops[0].corners[2].shortLabel, featureId: orb.mirrorLoops[0].corners[2].id, P: [0, 0] }
      );
      defaultBase = [0.41 * L, 0.29 * H];
    } else if (sig === "632") {
      const r = Math.sqrt(4 / Math.sqrt(3));
      const bx = 0.75 * r;
      const by = (r * Math.sqrt(3)) / 4;
      fdPolygons.push(makePoly([[0, 0], [bx, -by], [r, 0], [bx, by]], "piece:0", 0));
      pushGenPair("r_6", "r_6^-1", erotAt(0, 0, Math.PI / 3), "rot");
      pushGenPair("r_3", "r_3^-1", erotAt(r, 0, (2 * Math.PI) / 3), "rot");
      pushGen("r_2", erotAt(bx, by, Math.PI), "cone2");
      markers.push(
        { kind: "cone", order: 6, label: orb.coneItems[0].shortLabel, featureId: orb.coneItems[0].id, P: [0, 0] },
        { kind: "cone", order: 3, label: orb.coneItems[1].shortLabel, featureId: orb.coneItems[1].id, P: [r, 0] },
        { kind: "cone", order: 2, label: orb.coneItems[2].shortLabel, featureId: orb.coneItems[2].id, P: [bx, by] }
      );
      defaultBase = [0.53 * r, 0.29 * by];
    } else if (sig === "*333") {
      const L = Math.sqrt(4 / Math.sqrt(3));
      const H = (L * Math.sqrt(3)) / 2;
      fdPolygons.push(makePoly([[0, 0], [L, 0], [L * 0.5, H]], "piece:0", 0));
      pushGen("m_0", ereflLine([0, 0], [L, 0]), "mirror");
      pushGen("m_1", ereflLine([L, 0], [L * 0.5, H]), "mirror");
      pushGen("m_2", ereflLine([L * 0.5, H], [0, 0]), "mirror");
      markers.push(
        { kind: "corner", order: 3, label: orb.mirrorLoops[0].corners[0].shortLabel, featureId: orb.mirrorLoops[0].corners[0].id, P: [0, 0] },
        { kind: "corner", order: 3, label: orb.mirrorLoops[0].corners[1].shortLabel, featureId: orb.mirrorLoops[0].corners[1].id, P: [L, 0] },
        { kind: "corner", order: 3, label: orb.mirrorLoops[0].corners[2].shortLabel, featureId: orb.mirrorLoops[0].corners[2].id, P: [L * 0.5, H] }
      );
      defaultBase = [0.47 * L, 0.31 * H];
    } else if (sig === "3*3") {
      const L = Math.sqrt(4 * Math.sqrt(3));
      const H = L / (2 * Math.sqrt(3));
      fdPolygons.push(makePoly([[0, 0], [L, 0], [L * 0.5, H]], "piece:0", 0));
      pushGen("m_*", ereflLine([0, 0], [L, 0]), "mirror");
      pushGenPair("r_3", "r_3^-1", erotAt(L * 0.5, H, (2 * Math.PI) / 3), "rot");
      markers.push(
        { kind: "cone", order: 3, label: orb.coneItems[0].shortLabel, featureId: orb.coneItems[0].id, P: [L * 0.5, H] },
        { kind: "corner", order: 3, label: orb.mirrorLoops[0].corners[0].shortLabel, featureId: orb.mirrorLoops[0].corners[0].id, P: [0, 0] }
      );
      defaultBase = [0.43 * L, 0.31 * H];
    } else {
      // 333 (p3)
      const r = Math.sqrt(2 / Math.sqrt(3));
      const vr = [r, 0];
      const vl = [-r * 0.5, (r * Math.sqrt(3)) / 2];
      const top = [r * 0.5, (r * Math.sqrt(3)) / 2];
      fdPolygons.push(makePoly([[0, 0], vr, top, vl], "piece:0", 0));
      pushGenPair("r_3A", "r_3A^-1", erotAt(0, 0, (2 * Math.PI) / 3), "rot");
      pushGenPair("r_3B", "r_3B^-1", erotAt(top[0], top[1], (2 * Math.PI) / 3), "rot");
      markers.push(
        { kind: "cone", order: 3, label: orb.coneItems[0].shortLabel, featureId: orb.coneItems[0].id, P: [0, 0] },
        { kind: "cone", order: 3, label: orb.coneItems[1].shortLabel, featureId: orb.coneItems[1].id, P: top },
        { kind: "cone", order: 3, label: orb.coneItems[2].shortLabel, featureId: orb.coneItems[2].id, P: vr }
      );
      defaultBase = [0.33 * r, 0.37 * top[1]];
    }
  }

  const gens = deduplicateEucGens(rawGens);
  const quotient = computeEuclideanZ2Quotient(fdPolygons, gens);

  let chosenBase = defaultBase || polyCentroidE(fdPolygons[0].vertsE);
  let pullColorXor = 0;
  if (dirichletBase) {
    const wrapped = wrapPointIntoEucFD(dirichletBase, fdPolygons, gens, quotient.genColorMasks);
    chosenBase = wrapped.point;
    pullColorXor = wrapped.colorXor;
  }

  const isMirrorTri = orb.mode === "euc-rect-mirror" || orb.canonical === "*442" || orb.canonical === "*632" || orb.canonical === "*333";
  let dirichletPoly = null;
  if (!isMirrorTri && !skipDirichletBuild) {
    dirichletPoly = buildEuclideanDirichlet(chosenBase, gens, expectedArea, quotient.genColorMasks, markers);
  }

  let totalArea = 0;
  for (const p of fdPolygons) totalArea += polygonAreaE(p.vertsE);
  let maxIsometryError = 0;
  for (const g of gens) {
    const err = isometryError(g.M);
    if (err > maxIsometryError) maxIsometryError = err;
  }

  return {
    geometry: "euclidean",
    orb,
    carving,
    fdPolygons,
    dirichletPoly,
    dirichletBase: chosenBase,
    pullColorXor,
    gens,
    quotient,
    fdHasBothParities: false,
    cutSegments,
    seamSegments: [],
    markers,
    totalArea,
    expectedArea,
    areaError: Math.abs(totalArea - expectedArea),
    maxIsometryError,
    eucMeta
  };
}

/**
 * Tile the Euclidean plane around cameraE covering [-viewRadius, viewRadius]^2.
 */
export function generateEuclideanTiling(realization, cameraE = EID3, { viewRadius = 3.2, maxTiles = 600, cameraColor = 0, useDirichlet = false } = {}) {
  const { fdPolygons, gens, quotient } = realization;
  if (!fdPolygons || fdPolygons.length === 0) return [];

  const useDir = Boolean(useDirichlet && realization.dirichletPoly?.sideGens?.length);
  const dirPoly = useDir ? realization.dirichletPoly : null;
  const activeGens = useDir ? dirPoly.sideGens : gens;
  const masks = useDir ? activeGens.map((g) => g.colorMask ?? 0) : quotient?.genColorMasks;
  const [testPt1, testPt2] = makeTestPts(useDir ? [dirPoly] : fdPolygons);

  const fdCamP1 = eapply(cameraE, testPt1);
  const fdCamP2 = eapply(cameraE, testPt2);

  const probePts = [];
  if (useDir) {
    probePts.push(dirPoly.centroid, ...dirPoly.vertsE);
  } else {
    for (const p of fdPolygons) probePts.push(p.centroid, ...p.vertsE);
  }
  const camDistOfCM = (CM) => {
    let minD = Infinity;
    for (let i = 0; i < probePts.length; i++) {
      const q = eapply(CM, probePts[i]);
      const d = Math.max(Math.abs(q[0]), Math.abs(q[1]));
      if (d < minD) minD = d;
    }
    return minD;
  };

  let seedCM = cameraE;
  let seedColor = cameraColor;
  const camInv = cameraE === EID3 ? EID3 : einv3(cameraE);
  if (cameraE !== EID3) {
    let curD = Math.hypot(...eapply(seedCM, testPt1));
    for (let step = 0; step < 64; step++) {
      let bestCM = null;
      let bestGi = -1;
      let bestD = curD;
      for (let gi = 0; gi < activeGens.length; gi++) {
        const cand = emul3(seedCM, activeGens[gi].M);
        const d = Math.hypot(...eapply(cand, testPt1));
        if (d < bestD - 1e-6) {
          bestD = d;
          bestCM = cand;
          bestGi = gi;
        }
      }
      if (!bestCM) break;
      seedCM = bestCM;
      curD = bestD;
      if (masks) seedColor ^= masks[bestGi];
    }
  }

  const buckets = new Map();
  const scale = 12;
  const isSeenAndMark = (CM) => {
    const p1 = eapply(CM, testPt1);
    const p2 = eapply(CM, testPt2);
    const detPos = edet3(CM) >= 0;
    const bx = Math.round(p1[0] * scale);
    const by = Math.round(p1[1] * scale);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = buckets.get(`${bx + dx},${by + dy}`);
        if (!list) continue;
        for (const item of list) {
          if (item.detPos !== detPos) continue;
          if (
            Math.hypot(p1[0] - item.p1[0], p1[1] - item.p1[1]) < 1e-4 &&
            Math.hypot(p2[0] - item.p2[0], p2[1] - item.p2[1]) < 1e-4
          ) {
            return true;
          }
        }
      }
    }
    const home = `${bx},${by}`;
    if (!buckets.has(home)) buckets.set(home, []);
    buckets.get(home).push({ detPos, p1, p2 });
    return false;
  };

  const checkIsFD = (CM, detPos) =>
    detPos &&
    Math.hypot(eapply(CM, testPt1)[0] - fdCamP1[0], eapply(CM, testPt1)[1] - fdCamP1[1]) < 1e-4 &&
    Math.hypot(eapply(CM, testPt2)[0] - fdCamP2[0], eapply(CM, testPt2)[1] - fdCamP2[1]) < 1e-4;

  const heap = [];
  const pushHeap = (node) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].r <= heap[i].r) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const popHeap = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let m = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < heap.length && heap[l].r < heap[m].r) m = l;
        if (r < heap.length && heap[r].r < heap[m].r) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };

  const seedDet = edet3(seedCM) >= 0;
  isSeenAndMark(seedCM);
  pushHeap({
    M: cameraE === EID3 ? EID3 : emul3(camInv, seedCM),
    CM: seedCM,
    r: camDistOfCM(seedCM),
    detPos: seedDet,
    isFD: cameraE === EID3 ? true : checkIsFD(seedCM, seedDet),
    color: seedColor
  });

  if (cameraE !== EID3) {
    const fdRad = camDistOfCM(cameraE);
    if (fdRad <= viewRadius && !isSeenAndMark(cameraE)) {
      pushHeap({
        M: EID3,
        CM: cameraE,
        r: fdRad,
        detPos: edet3(cameraE) >= 0,
        isFD: true,
        color: cameraColor
      });
    }
  }

  const tiles = [];
  while (heap.length > 0 && tiles.length < maxTiles) {
    const cur = popHeap();
    tiles.push(cur);
    for (let gi = 0; gi < activeGens.length; gi++) {
      const CM2 = emul3(cur.CM, activeGens[gi].M);
      const rad = camDistOfCM(CM2);
      if (rad > viewRadius) continue;
      if (!isSeenAndMark(CM2)) {
        const detPos = edet3(CM2) >= 0;
        pushHeap({
          M: cameraE === EID3 ? CM2 : emul3(camInv, CM2),
          CM: CM2,
          r: rad,
          detPos,
          isFD: cameraE === EID3 ? false : checkIsFD(CM2, detPos),
          color: cur.color ^ (masks ? masks[gi] : 0)
        });
      }
    }
  }
  return tiles;
}

export function wrapEuclideanCameraWithColor(cameraE, realization) {
  const { fdPolygons, gens, quotient, dirichletPoly, dirichletBase } = realization || {};
  if (!fdPolygons || fdPolygons.length === 0 || !gens || gens.length === 0) {
    return { cameraE, colorXor: 0 };
  }
  const useDirGens = Boolean(dirichletPoly?.sideGens?.length);
  const activeGens = useDirGens ? dirichletPoly.sideGens : gens;
  const masks = useDirGens ? activeGens.map((g) => g.colorMask ?? 0) : quotient?.genColorMasks;
  const pt = useDirGens ? (dirichletBase || dirichletPoly.centroid) : fdPolygons[0].centroid;
  let cur = cameraE;
  let curD = Math.hypot(...eapply(cur, pt));
  let colorXor = 0;
  for (let step = 0; step < 64; step++) {
    let best = null;
    let bestGi = -1;
    let bestD = curD;
    for (let gi = 0; gi < activeGens.length; gi++) {
      const cand = emul3(cur, activeGens[gi].M);
      const d = Math.hypot(...eapply(cand, pt));
      if (d < bestD - 1e-6) {
        bestD = d;
        best = cand;
        bestGi = gi;
      }
    }
    if (!best) break;
    cur = best;
    curD = bestD;
    if (masks) colorXor ^= masks[bestGi];
  }
  return { cameraE: cur, colorXor };
}

export function panEuclideanCamera(cameraE, dx, dy, realization = null) {
  let next = emul3(etrans(dx, dy), cameraE);
  if (realization && (Math.abs(next[0][2]) > 8 || Math.abs(next[1][2]) > 8)) {
    const res = wrapEuclideanCameraWithColor(next, realization);
    return { cameraE: res.cameraE, wrapped: true, colorXor: res.colorXor };
  }
  return { cameraE: next, wrapped: false, colorXor: 0 };
}

function transferEuclideanQuotient(oldReal, newReal, Q) {
  const oldQ = oldReal?.quotient;
  if (!oldQ || oldQ.quotientSize <= 1 || !oldReal.fdPolygons?.length || !oldReal.gens?.length) {
    newReal.quotient = {
      genColorMasks: (newReal?.gens || []).map(() => 0),
      quotientSize: oldQ?.quotientSize || 1,
      exactTransferred: true
    };
    return true;
  }

  const Qinv = einv3(Q);
  const useDirGens = Boolean(oldReal.dirichletPoly?.sideGens?.length);
  const activeGens = useDirGens ? oldReal.dirichletPoly.sideGens : oldReal.gens;
  const activeMasks = useDirGens ? activeGens.map((g) => g.colorMask ?? 0) : oldQ.genColorMasks;
  const [tp1, tp2] = makeTestPts(useDirGens ? [oldReal.dirichletPoly] : oldReal.fdPolygons);

  const fixesOld = (M) =>
    edet3(M) >= 0 &&
    Math.hypot(eapply(M, tp1)[0] - tp1[0], eapply(M, tp1)[1] - tp1[1]) < 1e-4 &&
    Math.hypot(eapply(M, tp2)[0] - tp2[0], eapply(M, tp2)[1] - tp2[1]) < 1e-4;

  const newMasks = [];
  for (let j = 0; j < newReal.gens.length; j++) {
    const startM = emul3(Qinv, emul3(newReal.gens[j].M, Q));
    if (fixesOld(startM)) {
      newMasks.push(0);
      continue;
    }

    const heap = [];
    const pushH = (node) => {
      heap.push(node);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].d <= heap[i].d) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const popH = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        while (true) {
          let m = i;
          const l = 2 * i + 1;
          const r = 2 * i + 2;
          if (l < heap.length && heap[l].d < heap[m].d) m = l;
          if (r < heap.length && heap[r].d < heap[m].d) m = r;
          if (m === i) break;
          [heap[i], heap[m]] = [heap[m], heap[i]];
          i = m;
        }
      }
      return top;
    };

    const visited = new Map();
    const bucketScale = 12;
    const seenState = (M) => {
      const p1 = eapply(M, tp1);
      const p2 = eapply(M, tp2);
      const detPos = edet3(M) >= 0;
      const bx = Math.round(p1[0] * bucketScale);
      const by = Math.round(p1[1] * bucketScale);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const list = visited.get(`${detPos ? 1 : 0}:${bx + dx},${by + dy}`);
          if (!list) continue;
          for (const it of list) {
            if (
              Math.hypot(p1[0] - it.p1[0], p1[1] - it.p1[1]) < 1e-4 &&
              Math.hypot(p2[0] - it.p2[0], p2[1] - it.p2[1]) < 1e-4
            ) {
              return true;
            }
          }
        }
      }
      const home = `${detPos ? 1 : 0}:${bx},${by}`;
      if (!visited.has(home)) visited.set(home, []);
      visited.get(home).push({ p1, p2 });
      return false;
    };

    const startP1 = eapply(startM, tp1);
    const startD = Math.hypot(startP1[0] - tp1[0], startP1[1] - tp1[1]);
    seenState(startM);
    pushH({ M: startM, mask: 0, d: startD });

    let foundMask = null;
    let pops = 0;
    while (heap.length > 0 && pops < 350) {
      const cur = popH();
      pops++;
      if (fixesOld(cur.M)) {
        foundMask = cur.mask;
        break;
      }
      for (let gi = 0; gi < activeGens.length; gi++) {
        const cand = emul3(cur.M, activeGens[gi].M);
        const img = eapply(cand, tp1);
        const d = Math.hypot(img[0] - tp1[0], img[1] - tp1[1]);
        if (d > 40) continue;
        if (!seenState(cand)) {
          pushH({ M: cand, mask: cur.mask ^ activeMasks[gi], d });
        }
      }
    }
    if (foundMask === null) return false;
    newMasks.push(foundMask);
  }
  newReal.quotient = {
    genColorMasks: newMasks,
    quotientSize: oldQ.quotientSize,
    exactTransferred: true
  };
  return true;
}

function carryEuclideanDirichletAcrossRecut(oldReal, newReal, Q) {
  const oldPoly = oldReal?.dirichletPoly;
  const oldBase = oldReal?.dirichletBase;
  const oldSideGens = oldPoly?.sideGens;
  if (!oldPoly || !oldBase || !oldSideGens || oldSideGens.length === 0) {
    return null;
  }
  let T = Q;
  let curBase = eapply(T, oldBase);
  let curD = Math.hypot(curBase[0], curBase[1]);
  let detFlip = 0;
  for (let step = 0; step < 64; step++) {
    let bestG = null;
    let bestNext = null;
    let bestD = curD;
    for (let gi = 0; gi < oldSideGens.length; gi++) {
      const g = oldSideGens[gi];
      const candM = emul3(T, g.M);
      const candPt = eapply(candM, oldBase);
      const d = Math.hypot(candPt[0], candPt[1]);
      if (d < bestD - 1e-6) {
        bestD = d;
        bestNext = candM;
        bestG = g;
      }
    }
    if (!bestG) break;
    T = bestNext;
    curD = bestD;
    if (edet3(bestG.M) < 0) detFlip ^= 1;
  }

  const Tinv = einv3(T);
  const carriedVerts = oldPoly.vertsE.map((v) => eapply(T, v));
  const srcMarkers = oldPoly.markers?.length ? oldPoly.markers : oldReal.markers || [];
  newReal.dirichletBase = eapply(T, oldBase);
  newReal.dirichletPoly = {
    vertsE: carriedVerts,
    centroid: eapply(T, oldPoly.centroid),
    pieceId: "dirichlet",
    parity: 0,
    isExteriorEdge: oldPoly.isExteriorEdge ? [...oldPoly.isExteriorEdge] : carriedVerts.map(() => true),
    sideGens: oldSideGens.map((sg) => ({
      ...sg,
      M: emul3(T, emul3(sg.M, Tinv)),
      word: null
    })),
    markers: srcMarkers.map((mk) => ({
      ...mk,
      P: eapply(T, mk.P)
    }))
  };
  newReal.pullColorXor = 0;
  newReal.pullDetFlip = detFlip;
  return { T, invT: Tinv, colorXor: 0, detFlip };
}

/**
 * Exact stationary Euclidean recut across Reshuffle for 2222, o, and *2222.
 */
export function recutEuclidean(orb, oldCarving, oldReal, newCarvingTemplate) {
  const newCarving = {
    ...newCarvingTemplate,
    cuts: newCarvingTemplate.cuts.map((c) => ({ ...c, pair: c.pair ? [...c.pair] : null })),
    pieces: newCarvingTemplate.pieces.map((p) => ({ ...p, features: p.features ? [...p.features] : [] })),
    steps: [...newCarvingTemplate.steps]
  };

  if (orb.mode === "euc-2222") {
    const meta = oldReal.eucMeta;
    const { ell, tw, w, s, e1, e2, perm } = meta;
    const slotPos = [
      [-ell / 2, 0],
      [ell / 2, 0],
      [-ell / 2 + s, w],
      [ell / 2 + s, w]
    ];
    const parity = [[0, 0], [1, 0], [0, 1], [1, 1]];
    const i = parseInt(newCarving.cuts[0].pair[0].split(":")[1], 10);
    const j = parseInt(newCarving.cuts[0].pair[1].split(":")[1], 10);
    const slotA = perm.indexOf(i);
    const slotB = perm.indexOf(j);
    const pa = parity[slotA], pb = parity[slotB];
    const dp = [pa[0] ^ pb[0], pa[1] ^ pb[1]];
    const { va, vb, vc, sig } = reduceSuperbase(e1, e2);

    let v, u;
    if (dp[0] === 1 && dp[1] === 0) {
      v = va;
      u = [sig * vb[0], sig * vb[1]];
    } else if (dp[0] === 0 && dp[1] === 1) {
      v = vb;
      u = [sig * vc[0], sig * vc[1]];
    } else {
      v = vc;
      u = [sig * va[0], sig * va[1]];
    }

    const A0 = slotPos[slotA];
    let bestDist = Infinity, bestSign = 1, bestA = A0;
    for (const sgn of [1, -1]) {
      const vs = [sgn * v[0], sgn * v[1]];
      const target = [-(A0[0] + vs[0] / 2), -(A0[1] + vs[1] / 2)];
      const m = Math.round((target[0] - (s / w) * target[1]) / (2 * ell));
      const n = Math.round(target[1] / (2 * w));
      const Ax = A0[0] + 2 * (m * e1[0] + n * e2[0]);
      const Ay = A0[1] + 2 * (m * e1[1] + n * e2[1]);
      const mx = Ax + vs[0] / 2, my = Ay + vs[1] / 2;
      const d2 = mx * mx + my * my;
      if (d2 < bestDist - 1e-12) {
        bestDist = d2;
        bestSign = sgn;
        bestA = [Ax, Ay];
      }
    }

    const vDir = [bestSign * v[0], bestSign * v[1]];
    const uDir = [bestSign * u[0], bestSign * u[1]];
    const ellP = Math.hypot(vDir[0], vDir[1]);
    const twP = wrapHalf((uDir[0] * vDir[0] + uDir[1] * vDir[1]) / (2 * ellP * ellP));

    // Identify which cone occupies slotC (bestA + uDir mod 2*Lambda)
    const mod2 = (x) => ((Math.round(x) % 2) + 2) % 2;
    const invE = (px, py) => [(px - (s / w) * py) / ell, py / w];
    const [cu0, cv0] = invE(bestA[0] + uDir[0] - (-ell / 2), bestA[1] + uDir[1]);
    const cPar = [mod2(cu0), mod2(cv0)];
    const others = [0, 1, 2, 3].filter((idx) => idx !== slotA && idx !== slotB);
    const slotC = parity[others[0]][0] === cPar[0] && parity[others[0]][1] === cPar[1] ? others[0] : others[1];
    const slotD = others[0] === slotC ? others[1] : others[0];

    newCarving.cuts[0].length = ellP;
    newCarving.cuts[0].twistTurns = twP;
    newCarving.cuts[0].restPair = [`cone:${perm[slotC]}`, `cone:${perm[slotD]}`];

    const Bnew = [bestA[0] + vDir[0], bestA[1] + vDir[1]];
    const Q = efit(bestA, Bnew, [-ellP / 2, 0], [ellP / 2, 0]);
    const hasCarriedDir = Boolean(oldReal.dirichletPoly?.sideGens?.length && oldReal.dirichletBase);
    const carriedBase = oldReal.dirichletBase ? eapply(Q, oldReal.dirichletBase) : null;
    const newReal = buildEuclideanRealization(orb, newCarving, {
      dirichletBase: carriedBase,
      skipDirichletBuild: hasCarriedDir
    });
    transferEuclideanQuotient(oldReal, newReal, Q);

    let colorXor = 0;
    let detFlip = 0;
    let retQ = Q;
    let retInvQ = einv3(Q);
    const carried = hasCarriedDir ? carryEuclideanDirichletAcrossRecut(oldReal, newReal, Q) : null;
    if (carried) {
      retQ = carried.T;
      retInvQ = carried.invT;
      colorXor = carried.colorXor;
      detFlip = carried.detFlip;
    } else if (carriedBase) {
      const wrapped = wrapPointIntoEucFD(carriedBase, newReal.fdPolygons, newReal.gens, newReal.quotient.genColorMasks);
      newReal.dirichletBase = wrapped.point;
      newReal.pullColorXor = wrapped.colorXor;
      newReal.dirichletPoly = buildEuclideanDirichlet(
        wrapped.point,
        newReal.gens,
        newReal.expectedArea,
        newReal.quotient.genColorMasks,
        newReal.markers
      );
      colorXor = wrapped.colorXor;
    }

    return {
      carving: newCarving,
      realization: newReal,
      Q: retQ,
      invQ: retInvQ,
      colorXor,
      detFlip
    };
  }

  if (orb.mode === "euc-torus") {
    const { e1, e2 } = oldReal.eucMeta;
    const { va, vb, vc } = reduceSuperbase(e1, e2);
    const pair = newCarving.cuts[0].pair;
    const pairIdx = pair[0] === "e2" ? 1 : pair[0] === "e3" ? 2 : 0;
    const allTriples = [
      [va, vb],
      [vb, vc],
      [vc, va]
    ];
    const nonCollinear = allTriples.filter(
      ([v]) => Math.abs(v[0] * e1[1] - v[1] * e1[0]) > 1e-6 * Math.hypot(v[0], v[1]) * Math.hypot(e1[0], e1[1])
    );
    const choices = nonCollinear.length > 0 ? nonCollinear : allTriples;
    let [vRaw, uRaw] = choices[pairIdx % choices.length];
    const det = vRaw[0] * uRaw[1] - vRaw[1] * uRaw[0];
    if (det < 0) uRaw = [-uRaw[0], -uRaw[1]];
    const ellP = Math.hypot(vRaw[0], vRaw[1]);
    const rawTw = (vRaw[0] * uRaw[0] + vRaw[1] * uRaw[1]) / (ellP * ellP);
    const twP = wrapHalf(rawTw);

    newCarving.cuts[0].length = ellP;
    newCarving.cuts[0].twistTurns = twP;

    const Q = efit([0, 0], vRaw, [0, 0], [ellP, 0]);
    const hasCarriedDir = Boolean(oldReal.dirichletPoly?.sideGens?.length && oldReal.dirichletBase);
    const carriedBase = oldReal.dirichletBase ? eapply(Q, oldReal.dirichletBase) : null;
    const newReal = buildEuclideanRealization(orb, newCarving, {
      dirichletBase: carriedBase,
      skipDirichletBuild: hasCarriedDir
    });
    transferEuclideanQuotient(oldReal, newReal, Q);

    let colorXor = 0;
    let detFlip = 0;
    let retQ = Q;
    let retInvQ = einv3(Q);
    const carried = hasCarriedDir ? carryEuclideanDirichletAcrossRecut(oldReal, newReal, Q) : null;
    if (carried) {
      retQ = carried.T;
      retInvQ = carried.invT;
      colorXor = carried.colorXor;
      detFlip = carried.detFlip;
    } else if (carriedBase) {
      const wrapped = wrapPointIntoEucFD(carriedBase, newReal.fdPolygons, newReal.gens, newReal.quotient.genColorMasks);
      newReal.dirichletBase = wrapped.point;
      newReal.pullColorXor = wrapped.colorXor;
      newReal.dirichletPoly = buildEuclideanDirichlet(
        wrapped.point,
        newReal.gens,
        newReal.expectedArea,
        newReal.quotient.genColorMasks,
        newReal.markers
      );
      colorXor = wrapped.colorXor;
    }
    return {
      carving: newCarving,
      realization: newReal,
      Q: retQ,
      invQ: retInvQ,
      colorXor,
      detFlip
    };
  }

  if (orb.mode === "euc-rect-mirror") {
    const { perm: oldPerm, cornerPts: oldCornerPts } = oldReal.eucMeta;
    const toCornerIdx = (id) => (typeof id === "number" ? id : parseInt(String(id).split(":")[2], 10));
    const [paId, pbId] = newCarving.cuts[0].pair || [oldPerm[0], oldPerm[1]];
    const pA = oldCornerPts[oldPerm.indexOf(toCornerIdx(paId))];
    const pB = oldCornerPts[oldPerm.indexOf(toCornerIdx(pbId))];
    const ellP = Math.hypot(pB[0] - pA[0], pB[1] - pA[1]);
    newCarving.cuts[0].length = ellP;
    const newReal = buildEuclideanRealization(orb, newCarving);
    const newPerm = newReal.eucMeta.perm;
    const pA0 = oldCornerPts[oldPerm.indexOf(newPerm[0])];
    const pB0 = oldCornerPts[oldPerm.indexOf(newPerm[1])];
    const Q = efit(pA0, pB0, [0, 0], [ellP, 0]);
    transferEuclideanQuotient(oldReal, newReal, Q);
    return {
      carving: newCarving,
      realization: newReal,
      Q,
      invQ: einv3(Q),
      colorXor: 0
    };
  }

  return {
    carving: oldCarving,
    realization: oldReal,
    Q: EID3,
    invQ: EID3,
    colorXor: 0
  };
}
