// Exact Minkowski R^{2,1} (+,+,-) hyperbolic orbifold geometry engine.
// Builds exact fundamental domains, side-pairing O+(2,1) generators, cut geodesic
// segments, feature markers, and BFS tilings in the Poincare disk.
// Zero DOM dependencies so it can be verified directly in Node.

// ---------------------------------------------------------------------------
// 1. Minkowski R^{2,1} Linear Algebra & Lorentz Frame Primitives
// ---------------------------------------------------------------------------

export const ID3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];

export const mdot = (u, v) => u[0] * v[0] + u[1] * v[1] - u[2] * v[2];

export const mcross = (u, v) => [
  u[1] * v[2] - u[2] * v[1],
  u[2] * v[0] - u[0] * v[2],
  -(u[0] * v[1] - u[1] * v[0])
];

export const add3 = (u, v) => [u[0] + v[0], u[1] + v[1], u[2] + v[2]];
export const sub3 = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
export const scale3 = (u, s) => [u[0] * s, u[1] * s, u[2] * s];
export const neg3 = (u) => [-u[0], -u[1], -u[2]];

export function normTime(v) {
  const d = mdot(v, v);
  if (d < -1e-12) {
    let s = Math.sqrt(-d);
    if (v[2] < 0) s = -s;
    return [v[0] / s, v[1] / s, v[2] / s];
  }
  const sign = v[2] < 0 ? -1 : 1;
  const x = v[0] * sign;
  const y = v[1] * sign;
  return [x, y, Math.sqrt(1 + x * x + y * y)];
}

export function normSpace(v) {
  const d = mdot(v, v);
  if (d <= 1e-18) return [1, 0, 0];
  const s = Math.sqrt(d);
  return [v[0] / s, v[1] / s, v[2] / s];
}

export const poincare = (v) => [v[0] / (1 + v[2]), v[1] / (1 + v[2])];

export function liftDisk(u, v) {
  const r2 = u * u + v * v;
  const denom = Math.max(1e-7, 1 - r2);
  return [(2 * u) / denom, (2 * v) / denom, (1 + r2) / denom];
}

export function mul3(A, B) {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    }
  }
  return C;
}

export const apply3 = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]
];

export const det3 = (M) =>
  M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
  M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
  M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);

export function invLorentz(M) {
  // M^{-1} = J M^T J where J = diag(1, 1, -1)
  return [
    [M[0][0], M[1][0], -M[2][0]],
    [M[0][1], M[1][1], -M[2][1]],
    [-M[0][2], -M[1][2], M[2][2]]
  ];
}

export function lorentzError(M) {
  const J = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, -1]
  ];
  // Compute M^T J M - J
  let maxErr = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const colI = [M[0][i], M[1][i], M[2][i]];
      const colJ = [M[0][j], M[1][j], M[2][j]];
      const val = mdot(colI, colJ) - J[i][j];
      const err = Math.abs(val);
      if (err > maxErr) maxErr = err;
    }
  }
  return maxErr;
}

export function reflMatrix(n) {
  const unit = normSpace(n);
  const s = [1, 1, -1];
  const M = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      M[i][j] = (i === j ? 1 : 0) - 2 * unit[i] * unit[j] * s[j];
    }
  }
  return M;
}

export function rotMatrix(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1]
  ];
}

export function mobiusTranslateToOrigin(P) {
  const pt = normTime(P);
  const r2 = pt[0] * pt[0] + pt[1] * pt[1];
  if (r2 < 1e-24) return ID3;
  const r = Math.sqrt(r2);
  const ux = pt[0] / r;
  const uy = pt[1] / r;
  const c = pt[2];
  const s = r;
  return [
    [1 + (c - 1) * ux * ux, (c - 1) * ux * uy, -s * ux],
    [(c - 1) * ux * uy, 1 + (c - 1) * uy * uy, -s * uy],
    [-s * ux, -s * uy, c]
  ];
}

export function rotMatrixAt(P, theta) {
  const M = mobiusTranslateToOrigin(P);
  return mul3(invLorentz(M), mul3(rotMatrix(theta), M));
}

export function frameBasis(F) {
  return [
    [F.T[0], F.N[0], F.P[0]],
    [F.T[1], F.N[1], F.P[1]],
    [F.T[2], F.N[2], F.P[2]]
  ];
}

export function frameMap(F1, F2) {
  const B1 = frameBasis(F1);
  const B2 = frameBasis(F2);
  return mul3(B2, invLorentz(B1));
}

export function transformFrame(M, F) {
  const det = det3(M);
  const P = normTime(apply3(M, F.P));
  const rawT = apply3(M, F.T);
  const T = normSpace(add3(rawT, scale3(P, mdot(P, rawT))));
  // Right-handed (T, N, P): P x T = N; flip N if orientation-reversing M
  const N0 = normSpace(mcross(P, T));
  const N = det >= 0 ? N0 : neg3(N0);
  return { P, T, N };
}

export function slideFrame(F, s) {
  const c = Math.cosh(s);
  const sh = Math.sinh(s);
  return {
    P: normTime([c * F.P[0] + sh * F.T[0], c * F.P[1] + sh * F.T[1], c * F.P[2] + sh * F.T[2]]),
    T: normSpace([sh * F.P[0] + c * F.T[0], sh * F.P[1] + c * F.T[1], sh * F.P[2] + c * F.T[2]]),
    N: [...F.N]
  };
}

export function reverseFrame(F, s = 0) {
  const Fs = s === 0 ? F : slideFrame(F, s);
  return {
    P: [...Fs.P],
    T: neg3(Fs.T),
    N: neg3(Fs.N)
  };
}

export function transMatrixAlong(F, ell) {
  return frameMap(F, slideFrame(F, ell));
}

export function nearestFrameToOrigin(F) {
  const ratio = Math.max(-0.999999999999, Math.min(0.999999999999, -F.T[2] / F.P[2]));
  const s = Math.atanh(ratio);
  return slideFrame(F, s);
}

export function glideMatrixAlong(F, d) {
  const refl = reflMatrix(F.N);
  const slide = transMatrixAlong(F, d);
  return mul3(slide, refl);
}

export function baryH(verts, weights = null) {
  let x = 0;
  let y = 0;
  let t = 0;
  for (let i = 0; i < verts.length; i++) {
    const w = weights ? weights[i] : 1;
    x += w * verts[i][0];
    y += w * verts[i][1];
    t += w * verts[i][2];
  }
  return normTime([x, y, t]);
}

export function geodesicSamples(u, w, steps = 8) {
  const out = [];
  for (let s = 0; s <= steps; s++) {
    const f = s / steps;
    const pt = normTime([
      (1 - f) * u[0] + f * w[0],
      (1 - f) * u[1] + f * w[1],
      (1 - f) * u[2] + f * w[2]
    ]);
    out.push(poincare(pt));
  }
  return out;
}

export function hypDist(u, v) {
  return Math.acosh(Math.max(1, -mdot(u, v)));
}

// ---------------------------------------------------------------------------
// 2. Generalized Right-Angled Hexagon / Triangle / Pentagon / Quad Builder
// ---------------------------------------------------------------------------

/**
 * Build a hyperbolic polygon with 3 main sides S[0], S[1], S[2] (outward unit
 * spacelike normals) satisfying S[1]·S[2] = -C0, S[2]·S[0] = -C1, S[0]·S[1] = -C2.
 * Each C_k is either cos(alpha_k) in [0, 1) (corner vertex) or cosh(L_k) > 1 (orthogeodesic edge).
 * CCW boundary order: F0 -> S2 -> F1 -> S0 -> F2 -> S1 -> F0.
 */
export function generalizedHexagon(C0, C1, C2) {
  let S0;
  let S1;
  let S2;

  if (C2 > 1) {
    const L2 = Math.acosh(C2);
    const ch = Math.cosh(L2 / 2);
    const sh = Math.sinh(L2 / 2);
    S0 = [-ch, 0, sh];
    S1 = [ch, 0, sh];
    const t = (C0 + C1) / (2 * sh);
    const x = (C1 - C0) / (2 * ch);
    const y = Math.sqrt(Math.max(0, 1 + t * t - x * x));
    S2 = [x, y, t];
  } else {
    const a2 = Math.acos(Math.max(-0.999999, Math.min(0.999999, C2)));
    const sinA = Math.sin(a2);
    S1 = [0, -1, 0];
    S0 = [-sinA, C2, 0];
    const y = C0;
    const x = (C1 + C0 * C2) / sinA;
    const t = Math.sqrt(Math.max(0, x * x + y * y - 1));
    S2 = [x, y, t];
  }

  S0 = normSpace(S0);
  S1 = normSpace(S1);
  S2 = normSpace(S2);
  const S = [S0, S1, S2];
  const Cs = [C0, C1, C2];

  // For feature k in CCW order: S[a] arrives, S[b] departs, S[opp] is opposite side
  const triple = [
    [1, 2, 0],
    [2, 0, 1],
    [0, 1, 2]
  ];

  const features = [];
  const vertsH = [];
  const sideOutNormals = [];

  // First extract raw vertices and edges so we can check interior point
  for (let k = 0; k < 3; k++) {
    const [a, b, opp] = triple[k];
    const Ck = Cs[k];
    if (Ck < 1) {
      const V = normTime(mcross(S[a], S[b]));
      features.push({
        kind: "corner",
        C: Ck,
        angle: Math.acos(Math.max(-1, Math.min(1, Ck))),
        V
      });
    } else {
      let E = normSpace(mcross(S[a], S[b]));
      if (mdot(E, S[opp]) > 0) E = neg3(E);
      const P0 = normTime(mcross(S[a], E));
      const P1 = normTime(mcross(E, S[b]));
      const L = Math.acosh(Ck);
      const chord = add3(P1, scale3(P0, mdot(P0, P1)));
      const T = normSpace(chord);
      const N = neg3(E);
      const frame = { P: P0, T, N };
      const mid = slideFrame(frame, L / 2).P;
      features.push({
        kind: "edge",
        C: Ck,
        length: L,
        E,
        P0,
        P1,
        mid,
        frame
      });
    }
  }

  // Assemble CCW vertex ring: F0 -> (S2) -> F1 -> (S0) -> F2 -> (S1) -> F0
  const pushFeature = (k, sideAfterIdx) => {
    const f = features[k];
    if (f.kind === "corner") {
      vertsH.push(f.V);
      sideOutNormals.push(S[sideAfterIdx]);
    } else {
      vertsH.push(f.P0);
      sideOutNormals.push(f.E);
      vertsH.push(f.P1);
      sideOutNormals.push(S[sideAfterIdx]);
    }
  };
  pushFeature(0, 2);
  pushFeature(1, 0);
  pushFeature(2, 1);

  // Compute exact hyperbolic area via Gauss-Bonnet on the n-gon
  let angleSum = 0;
  for (let k = 0; k < 3; k++) {
    const f = features[k];
    if (f.kind === "corner") angleSum += f.angle;
    else angleSum += Math.PI; // two pi/2 corners!
  }
  const area = (vertsH.length - 2) * Math.PI - angleSum;

  return {
    S,
    features,
    vertsH,
    sideOutNormals,
    centroid: baryH(vertsH),
    area
  };
}

function buildPolyRecord(vertsH, sideOutNormals, label, pieceId, parity) {
  return {
    vertsH,
    sideOutNormals,
    centroid: baryH(vertsH),
    label,
    pieceId,
    parity
  };
}

function reflectPoly(poly, R) {
  // Reflecting across R reverses vertex order; reverse to preserve CCW orientation
  const revVerts = [...poly.vertsH].reverse().map((v) => normTime(apply3(R, v)));
  const n = poly.sideOutNormals.length;
  const revNormals = [];
  for (let i = n - 1; i >= 0; i--) {
    // Edge between old verts[(i+1)%n] and verts[i] becomes edge between new verts[n-1-i] and verts[n-i]
    revNormals.push(normSpace(apply3(R, poly.sideOutNormals[i])));
  }
  // Wait: check vertex-edge pairing when reversing!
  // Old edge j goes oldV[j] -> oldV[(j+1)%n] with normal oldN[j].
  // New verts[r] = R(oldV[n - 1 - r]).
  // New edge r goes newV[r] -> newV[(r+1)%n], i.e. R(oldV[n - 1 - r]) -> R(oldV[n - 2 - r]),
  // which is the old edge j = (n - 2 - r + n) % n!
  const fixedNormals = [];
  for (let r = 0; r < n; r++) {
    const j = (n - 2 - r + n) % n;
    fixedNormals.push(normSpace(apply3(R, poly.sideOutNormals[j])));
  }
  return buildPolyRecord(revVerts, fixedNormals, poly.label, poly.pieceId, poly.parity ^ 1);
}

function transformPoly(M, poly) {
  const det = det3(M);
  const vertsH = poly.vertsH.map((v) => normTime(apply3(M, v)));
  const sideOutNormals = poly.sideOutNormals.map((n) => normSpace(apply3(M, n)));
  if (det >= 0) {
    return buildPolyRecord(vertsH, sideOutNormals, poly.label, poly.pieceId, poly.parity);
  }
  // Orientation-reversing transform: reverse vertex order to preserve CCW normal convention
  const n = vertsH.length;
  const revV = [...vertsH].reverse();
  const revN = [];
  for (let r = 0; r < n; r++) {
    const j = (n - 2 - r + n) % n;
    revN.push(sideOutNormals[j]);
  }
  return buildPolyRecord(revV, revN, poly.label, poly.pieceId, poly.parity ^ 1);
}

// ---------------------------------------------------------------------------
// 3. Complete Orbifold Realization Assembly
// ---------------------------------------------------------------------------

function makeDegenerateBarSegments(F, length, twistTurns, cut, markersOut, gensOut) {
  const mod0 = (((twistTurns % 1) + 1) % 1) * length;
  const mod1 = ((((twistTurns + 0.5) % 1) + 1) % 1) * length;
  const Q1 = slideFrame(F, mod0).P;
  const Q2 = slideFrame(F, mod1).P;
  const P0 = F.P;
  const P1 = slideFrame(F, length).P;
  const samples = geodesicSamples(P0, P1, 10);
  gensOut.push({ label: `${cut.name}:2A`, M: rotMatrixAt(Q1, Math.PI), role: "cone2", point: Q1 });
  gensOut.push({ label: `${cut.name}:2B`, M: rotMatrixAt(Q2, Math.PI), role: "cone2", point: Q2 });
  markersOut.push({ kind: "cone", order: 2, label: "2", P: Q1 });
  markersOut.push({ kind: "cone", order: 2, label: "2", P: Q2 });
  return [{ cutId: cut.id, color: cut.color, name: cut.name, A: P0, B: P1, samples, isFoldedBar: true }];
}

/**
 * Assemble an exact hyperbolic realization from parsed `orb` and `carving`.
 */
export function buildRealization(orb, carving) {
  if (!orb.ok || orb.geometry !== "hyperbolic") {
    return null;
  }

  const cutById = new Map(carving.cuts.map((c) => [c.id, c]));
  const pieceById = new Map(carving.pieces.map((p) => [p.id, p]));

  // Find child piece attached on the opposite side of a given cutId
  const piecesByBoundaryCut = new Map();
  const pantOrPolyPieces = carving.pieces.filter((p) => p.kind === "pant" || p.kind === "mirror-poly");
  for (const p of carving.pieces) {
    if (p.boundaryCutId) piecesByBoundaryCut.set(p.boundaryCutId, p);
  }

  // Adjacency across cuts: map cutId -> list of pieceIds touching that cut
  const cutNeighbors = new Map();
  const registerTouch = (cutId, pieceId) => {
    if (!cutNeighbors.has(cutId)) cutNeighbors.set(cutId, []);
    const arr = cutNeighbors.get(cutId);
    if (!arr.includes(pieceId)) arr.push(pieceId);
  };

  for (const p of carving.pieces) {
    if (p.kind === "pant" || p.kind === "mirror-poly") {
      for (const f of p.features) {
        if (f.kind === "cut") registerTouch(f.cutId, p.id);
        if (f.kind === "collar-end") {
          // Find the collar or crosscap or smooth cut for this mirror loop
          const cap = carving.pieces.find(
            (q) =>
              (q.kind === "corner-cap" || q.kind === "cuff-mirror-bridge") &&
              q.loopIndex === f.loopIndex
          );
          if (cap) registerTouch(cap.cuffCutId, p.id);
        }
      }
    } else if (p.kind === "cone-mirror-cap") {
      registerTouch(p.cutId, p.id);
    } else if (p.kind === "corner-cap") {
      registerTouch(p.cuffCutId, p.id);
    } else if (p.kind === "cuff-mirror-bridge") {
      registerTouch(p.cuffCutId, p.id);
      registerTouch(p.bridgeCutId, p.id);
    }
  }

  const fdPolygons = [];
  const rawGens = [];
  const cutSegments = [];
  const seamSegments = [];
  const markers = [];
  let totalArea = 0;

  const pushGen = (label, M, role = "gen", meta = {}) => {
    rawGens.push({ label, M, role, ...meta });
  };
  const pushGenPair = (label, invLabel, M, role = "gen") => {
    rawGens.push({ label, invLabel, M, role, isPair: true });
  };

  // --- Special rigid 0D cases ---
  if (orb.mode === "rigid") {
    const p0 = carving.pieces[0];
    if (p0.kind === "rigid-cones") {
      const [a, b, c] = orb.cones;
      const H = generalizedHexagon(Math.cos(Math.PI / a), Math.cos(Math.PI / b), Math.cos(Math.PI / c));
      const R2 = reflMatrix(H.S[2]);
      const pPlus = buildPolyRecord(H.vertsH, H.sideOutNormals, orb.canonical, p0.id, 0);
      const pMinus = reflectPoly(pPlus, R2);
      fdPolygons.push(pPlus, pMinus);
      totalArea += 2 * H.area;
      const g0 = mul3(R2, reflMatrix(H.S[0]));
      const g1 = mul3(R2, reflMatrix(H.S[1]));
      pushGenPair(`r_${b}`, `r_${b}^-1`, g0, "rot");
      pushGenPair(`r_${a}`, `r_${a}^-1`, g1, "rot");
      seamSegments.push(geodesicSamples(H.features[0].V, H.features[1].V, 8));
      markers.push(
        { kind: "cone", order: a, label: orb.coneItems[0].shortLabel, P: H.features[0].V },
        { kind: "cone", order: b, label: orb.coneItems[1].shortLabel, P: H.features[1].V },
        { kind: "cone", order: c, label: orb.coneItems[2].shortLabel, P: H.features[2].V }
      );
    } else if (p0.kind === "rigid-mirror-tri") {
      const [a, b, c] = orb.mirrors[0];
      const H = generalizedHexagon(Math.cos(Math.PI / a), Math.cos(Math.PI / b), Math.cos(Math.PI / c));
      fdPolygons.push(buildPolyRecord(H.vertsH, H.sideOutNormals, orb.canonical, p0.id, 0));
      totalArea += H.area;
      pushGen(`m_${orb.mirrorLoops[0].corners[0].letter}`, reflMatrix(H.S[0]), "mirror", { normal: H.S[0] });
      pushGen(`m_${orb.mirrorLoops[0].corners[1].letter}`, reflMatrix(H.S[1]), "mirror", { normal: H.S[1] });
      pushGen(`m_${orb.mirrorLoops[0].corners[2].letter}`, reflMatrix(H.S[2]), "mirror", { normal: H.S[2] });
      markers.push(
        { kind: "corner", order: a, label: orb.mirrorLoops[0].corners[0].shortLabel, P: H.features[0].V },
        { kind: "corner", order: b, label: orb.mirrorLoops[0].corners[1].shortLabel, P: H.features[1].V },
        { kind: "corner", order: c, label: orb.mirrorLoops[0].corners[2].shortLabel, P: H.features[2].V }
      );
    } else {
      const p = orb.cones[0];
      const q = orb.mirrors[0][0];
      const H = generalizedHexagon(Math.cos(Math.PI / p), Math.cos(Math.PI / (2 * q)), 0);
      const R2 = reflMatrix(H.S[2]);
      const pPlus = buildPolyRecord(H.vertsH, H.sideOutNormals, orb.canonical, p0.id, 0);
      const pMinus = reflectPoly(pPlus, R2);
      fdPolygons.push(pPlus, pMinus);
      totalArea += 2 * H.area;
      const rot = mul3(R2, reflMatrix(H.S[1]));
      const rm0 = reflMatrix(H.S[0]);
      const rm1 = mul3(R2, mul3(rm0, R2));
      pushGenPair(`rot_${p}`, `rot_${p}^-1`, rot, "rot");
      pushGen("m_+", rm0, "mirror", { normal: H.S[0] });
      pushGen("m_-", rm1, "mirror", { normal: normSpace(apply3(R2, H.S[0])) });
      seamSegments.push(geodesicSamples(H.features[0].V, H.features[1].V, 8));
      markers.push(
        { kind: "cone", order: p, label: orb.coneItems[0].shortLabel, P: H.features[0].V },
        { kind: "corner", order: q, label: orb.mirrorLoops[0].corners[0].shortLabel, P: H.features[1].V }
      );
    }
    return finalizeRealization(orb, carving, fdPolygons, rawGens, cutSegments, seamSegments, markers, totalArea);
  }

  // --- General tree assembly starting at non-degenerate root ---
  const visitedPieces = new Set();
  const handleAnchors = new Map(); // handleIndex -> { '+': frame, '-': frame, length, twistTurns, cut }
  const crosscapAnchors = [];
  const smoothAnchors = [];

  const getCuffCutLength = (feat) => {
    if (feat.kind === "cut") return cutById.get(feat.cutId).length;
    if (feat.kind === "handle-end") {
      return carving.cuts.find((c) => c.kind === "handle" && c.targetId === `handle:${feat.handleIndex}`).length;
    }
    if (feat.kind === "crosscap-end") {
      return 2 * carving.cuts.find((c) => c.kind === "crosscap" && c.targetId === `crosscap:${feat.crosscapIndex}`).length;
    }
    if (feat.kind === "smooth-end") {
      return carving.cuts.find((c) => c.kind === "smooth-mirror" && c.loopIndex === feat.loopIndex).length;
    }
    if (feat.kind === "collar-end") {
      const cap = carving.pieces.find(
        (q) => (q.kind === "corner-cap" || q.kind === "cuff-mirror-bridge") && q.loopIndex === feat.loopIndex
      );
      const cCut = cutById.get(cap.cuffCutId);
      return cCut.kind === "crosscap" ? 2 * cCut.length : cCut.length;
    }
    return 1.5;
  };

  const attachAcrossCut = (cutId, parentFrame, cutLength, twistTurns, parentPieceId) => {
    const cut = cutById.get(cutId);
    const neighbors = (cutNeighbors.get(cutId) || []).filter((id) => id !== parentPieceId && !visitedPieces.has(id));
    if (neighbors.length === 0) return;
    const childPiece = pieceById.get(neighbors[0]);

    if (childPiece.degenerate) {
      visitedPieces.add(childPiece.id);
      if (childPiece.kind === "pant") {
        // Degenerate (2, 2) cone leaf
        const segs = makeDegenerateBarSegments(parentFrame, cutLength, twistTurns, cut, markers, rawGens);
        cutSegments.push(...segs);
      } else if (childPiece.kind === "mirror-poly") {
        // Degenerate (*2, *2) mirror wall leaf along parentFrame
        pushGen(`m_${cut.name}`, reflMatrix(parentFrame.N), "mirror", { cutId: cut.id, normal: parentFrame.N });
        const P0 = parentFrame.P;
        const P1 = slideFrame(parentFrame, cutLength).P;
        const corners = childPiece.features.filter((f) => f.kind === "corner");
        markers.push({ kind: "corner", order: 2, label: corners[0]?.label || "*2", P: P0 });
        markers.push({ kind: "corner", order: 2, label: corners[1]?.label || "*2", P: P1 });
        cutSegments.push({
          cutId: cut.id,
          color: cut.color,
          name: cut.name,
          A: P0,
          B: P1,
          samples: geodesicSamples(P0, P1, 10),
          isMirrorWall: true
        });
      } else if (childPiece.kind === "cone-mirror-cap") {
        // Degenerate cone 2 at midpoint of mirror arc of length cutLength
        const Qmid = slideFrame(parentFrame, cutLength / 2).P;
        pushGen(`${cut.name}:2`, rotMatrixAt(Qmid, Math.PI), "cone2", { cutId: cut.id, point: Qmid });
        markers.push({ kind: "cone", order: 2, label: childPiece.cone.label, P: Qmid });
        const P0 = parentFrame.P;
        const P1 = slideFrame(parentFrame, cutLength).P;
        cutSegments.push({
          cutId: cut.id,
          color: cut.color,
          name: cut.name,
          A: P0,
          B: P1,
          samples: geodesicSamples(P0, P1, 10),
          isFoldedBar: true
        });
      }
      return;
    }

    // Non-degenerate child: build in local frame, then glue via frameMap
    const tau = twistTurns * cutLength;
    const targetFrame = reverseFrame(parentFrame, cutLength + tau);
    buildSubtree(childPiece, targetFrame, cutId);
  };

  const attachCollarEndChild = (feat, parentFrame, cuffLength, parentPieceId) => {
    const cap = carving.pieces.find(
      (q) =>
        (q.kind === "corner-cap" || q.kind === "cuff-mirror-bridge") &&
        q.loopIndex === feat.loopIndex &&
        !visitedPieces.has(q.id)
    );
    if (!cap) return;
    const cuffCut = cutById.get(cap.cuffCutId);
    const targetFrame = reverseFrame(parentFrame, cuffLength + cuffCut.twistTurns * cuffLength);
    buildSubtree(cap, targetFrame, cuffCut.id);
  };

  const registerSpecialCuffEnd = (feat, worldFrame, cuffLength, parentPieceId) => {
    if (feat.kind === "handle-end") {
      const hCut = carving.cuts.find((c) => c.kind === "handle" && c.targetId === `handle:${feat.handleIndex}`);
      if (!handleAnchors.has(feat.handleIndex)) {
        handleAnchors.set(feat.handleIndex, { cut: hCut, length: cuffLength });
      }
      const entry = handleAnchors.get(feat.handleIndex);
      entry[feat.side] = worldFrame;
    } else if (feat.kind === "crosscap-end") {
      const xcCut = carving.cuts.find((c) => c.kind === "crosscap" && c.targetId === `crosscap:${feat.crosscapIndex}`);
      crosscapAnchors.push({ cut: xcCut, frame: worldFrame, length: cuffLength });
    } else if (feat.kind === "smooth-end") {
      const smCut = carving.cuts.find((c) => c.kind === "smooth-mirror" && c.loopIndex === feat.loopIndex);
      smoothAnchors.push({ cut: smCut, frame: worldFrame, length: cuffLength });
    } else if (feat.kind === "collar-end") {
      attachCollarEndChild(feat, worldFrame, cuffLength, parentPieceId);
    }
  };

  const buildSubtree = (piece, incomingWorldFrame = null, incomingCutId = null) => {
    visitedPieces.add(piece.id);

    if (piece.kind === "pant") {
      // Arrange features so incomingCutId (if any) sits at slot 0 (unbroken!),
      // and any cone point prefers slot 2 (keeping cuffs on unbroken slots 0, 1).
      const feats = [...piece.features];
      const incomingMatch = (f) =>
        incomingCutId &&
        ((f.kind === "cut" && f.cutId === incomingCutId) ||
          (f.kind === "collar-end" &&
            carving.pieces.some(
              (q) =>
                (q.kind === "corner-cap" || q.kind === "cuff-mirror-bridge") &&
                q.loopIndex === f.loopIndex &&
                q.cuffCutId === incomingCutId
            )));

      // Choose ordering [f0, f1, f2]
      let ordered = [...feats];
      if (incomingCutId) {
        const incIdx = ordered.findIndex(incomingMatch);
        if (incIdx > 0) {
          const tmp = ordered[0];
          ordered[0] = ordered[incIdx];
          ordered[incIdx] = tmp;
        }
        // Put cone at slot 2 if slot 1 is a cone and slot 2 is a cuff
        if (ordered[1].kind === "cone" && ordered[2].kind !== "cone") {
          const tmp = ordered[1];
          ordered[1] = ordered[2];
          ordered[2] = tmp;
        }
      } else {
        // Root: put any cone at slot 2
        const coneIdx = ordered.findIndex((f) => f.kind === "cone");
        if (coneIdx !== -1 && coneIdx !== 2) {
          const tmp = ordered[2];
          ordered[2] = ordered[coneIdx];
          ordered[coneIdx] = tmp;
        }
      }

      const Cvals = ordered.map((f) =>
        f.kind === "cone" ? Math.cos(Math.PI / f.order) : Math.cosh(getCuffCutLength(f) / 2)
      );
      const H = generalizedHexagon(Cvals[0], Cvals[1], Cvals[2]);
      const R2 = reflMatrix(H.S[2]);
      const localPlus = buildPolyRecord(H.vertsH, H.sideOutNormals, piece.id, piece.id, 0);
      const localMinus = reflectPoly(localPlus, R2);

      // Compute full unbroken frames in local coordinates:
      // Slot 0: unbroken frame starts at feat[0].P, length L0*2
      // Slot 1: unbroken frame starts at slideFrame(feat[1].frame, -L1), length L1*2
      // Slot 2: split edge starts at feat[2].P, length L2*2
      const localFrames = [null, null, null];
      const cuffLengths = [0, 0, 0];
      for (let slot = 0; slot < 3; slot++) {
        const f = ordered[slot];
        if (f.kind === "cone") continue;
        const ell = getCuffCutLength(f);
        cuffLengths[slot] = ell;
        if (slot === 0) localFrames[0] = H.features[0].frame;
        else if (slot === 1) localFrames[1] = slideFrame(H.features[1].frame, -ell / 2);
        else localFrames[2] = H.features[2].frame;
      }

      const M = incomingWorldFrame ? frameMap(localFrames[0], incomingWorldFrame) : ID3;
      fdPolygons.push(transformPoly(M, localPlus), transformPoly(M, localMinus));
      totalArea += 2 * H.area;

      // Internal side-pairing generators: g0 = R2*R_{S0}, g1 = R2*R_{S1}
      const wS2 = normSpace(apply3(M, H.S[2]));
      const wS0 = normSpace(apply3(M, H.S[0]));
      const wS1 = normSpace(apply3(M, H.S[1]));
      const wR2 = reflMatrix(wS2);
      const g0 = reorthonormalizeLorentz(mul3(wR2, reflMatrix(wS0)));
      const g1 = reorthonormalizeLorentz(mul3(wR2, reflMatrix(wS1)));
      pushGenPair(`${piece.id}:g0`, `${piece.id}:g0^-1`, g0, "seam");
      pushGenPair(`${piece.id}:g1`, `${piece.id}:g1^-1`, g1, "seam");

      // Seam arc along S[2]
      const seamEnd0 = H.features[0].kind === "corner" ? H.features[0].V : H.features[0].P1;
      const seamEnd1 = H.features[1].kind === "corner" ? H.features[1].V : H.features[1].P0;
      seamSegments.push(geodesicSamples(normTime(apply3(M, seamEnd0)), normTime(apply3(M, seamEnd1)), 8));

      // Place markers & record cut segments / traverse children
      for (let slot = 0; slot < 3; slot++) {
        const f = ordered[slot];
        if (f.kind === "cone") {
          markers.push({
            kind: "cone",
            order: f.order,
            label: f.label,
            P: normTime(apply3(M, H.features[slot].V))
          });
          continue;
        }
        const wf = transformFrame(M, localFrames[slot]);
        const ell = cuffLengths[slot];
        const isIncoming = slot === 0 && incomingCutId !== null;
        if (f.kind === "cut") {
          const cut = cutById.get(f.cutId);
          if (!isIncoming) {
            const pEnd = slideFrame(wf, ell).P;
            cutSegments.push({
              cutId: cut.id,
              color: cut.color,
              name: cut.name,
              A: wf.P,
              B: pEnd,
              samples: geodesicSamples(wf.P, pEnd, 10),
              twistTicks: true,
              frame: wf,
              length: ell,
              twistTurns: cut.twistTurns
            });
            attachAcrossCut(f.cutId, wf, ell, cut.twistTurns, piece.id);
          }
        } else {
          if (!isIncoming) {
            const cCut =
              f.kind === "handle-end"
                ? carving.cuts.find((c) => c.kind === "handle" && c.targetId === `handle:${f.handleIndex}`)
                : f.kind === "crosscap-end"
                ? carving.cuts.find((c) => c.kind === "crosscap" && c.targetId === `crosscap:${f.crosscapIndex}`)
                : f.kind === "smooth-end"
                ? carving.cuts.find((c) => c.kind === "smooth-mirror" && c.loopIndex === f.loopIndex)
                : cutById.get(
                    carving.pieces.find(
                      (q) => (q.kind === "corner-cap" || q.kind === "cuff-mirror-bridge") && q.loopIndex === f.loopIndex
                    ).cuffCutId
                  );
            if (f.kind !== "handle-end" || f.side === "+") {
              const pEnd = slideFrame(wf, ell).P;
              cutSegments.push({
                cutId: cCut.id,
                color: cCut.color,
                name: cCut.name,
                A: wf.P,
                B: pEnd,
                samples: geodesicSamples(wf.P, pEnd, 10),
                isMirrorWall: f.kind === "smooth-end",
                frame: wf,
                length: ell,
                twistTurns: cCut.twistTurns
              });
            }
          }
          registerSpecialCuffEnd(f, wf, ell, piece.id);
        }
      }
      return;
    }

    if (piece.kind === "mirror-poly") {
      const feats = [...piece.features];
      // Put incomingCutId at slot 0 if provided
      if (incomingCutId) {
        const incIdx = feats.findIndex((f) => f.kind === "cut" && f.cutId === incomingCutId);
        if (incIdx > 0) {
          // Rotate cyclic order so incIdx lands at 0 (preserving cyclic polygon order!)
          const rotFeats = [...feats.slice(incIdx), ...feats.slice(0, incIdx)];
          feats.splice(0, feats.length, ...rotFeats);
        }
      }

      const Cvals = feats.map((f) =>
        f.kind === "corner" ? Math.cos(Math.PI / f.order) : Math.cosh(cutById.get(f.cutId).length)
      );
      const H = generalizedHexagon(Cvals[0], Cvals[1], Cvals[2]);
      const localPoly = buildPolyRecord(H.vertsH, H.sideOutNormals, piece.id, piece.id, 0);

      let M = ID3;
      if (incomingWorldFrame) {
        M = frameMap(H.features[0].frame, incomingWorldFrame);
      }
      fdPolygons.push(transformPoly(M, localPoly));
      totalArea += H.area;

      // Exterior mirror side reflections
      for (let s = 0; s < 3; s++) {
        const worldN = normSpace(apply3(M, H.S[s]));
        pushGen(`${piece.id}:m${s}`, reflMatrix(worldN), "mirror", { normal: worldN });
      }

      // Features
      for (let slot = 0; slot < 3; slot++) {
        const f = feats[slot];
        if (f.kind === "corner") {
          markers.push({
            kind: "corner",
            order: f.order,
            label: f.label,
            P: normTime(apply3(M, H.features[slot].V))
          });
        } else {
          const cut = cutById.get(f.cutId);
          const wf = transformFrame(M, H.features[slot].frame);
          const isIncoming = slot === 0 && incomingCutId !== null;
          if (!isIncoming) {
            const P0 = wf.P;
            const P1 = slideFrame(wf, cut.length).P;
            cutSegments.push({
              cutId: cut.id,
              color: cut.color,
              name: cut.name,
              A: P0,
              B: P1,
              samples: geodesicSamples(P0, P1, 10),
              frame: wf,
              length: cut.length
            });
            attachAcrossCut(cut.id, wf, cut.length, 0, piece.id);
          }
        }
      }
      return;
    }

    if (piece.kind === "cone-mirror-cap") {
      const p = piece.cone.order;
      const cut = cutById.get(piece.cutId);
      const d0 = cut.length;
      const H = generalizedHexagon(Math.cos(Math.PI / p), 0, Math.cosh(d0 / 2));
      const R1 = reflMatrix(H.S[1]);
      const localPlus = buildPolyRecord(H.vertsH, H.sideOutNormals, piece.id, piece.id, 0);
      const localMinus = reflectPoly(localPlus, R1);

      const localEdgeFrame = H.features[2].frame;
      const M = incomingWorldFrame ? frameMap(localEdgeFrame, incomingWorldFrame) : ID3;
      fdPolygons.push(transformPoly(M, localPlus), transformPoly(M, localMinus));
      totalArea += 2 * H.area;

      const wS0 = normSpace(apply3(M, H.S[0]));
      const wS0m = normSpace(apply3(M, apply3(R1, H.S[0])));
      const wV0 = normTime(apply3(M, H.features[0].V));
      const rot = reorthonormalizeLorentz(rotMatrixAt(wV0, (2 * Math.PI) / p));
      pushGenPair(`${piece.id}:rot_${p}`, `${piece.id}:rot_${p}^-1`, rot, "rot");
      pushGen(`${piece.id}:m+`, reflMatrix(wS0), "mirror", { normal: wS0 });
      pushGen(`${piece.id}:m-`, reflMatrix(wS0m), "mirror", { normal: wS0m });

      seamSegments.push(
        geodesicSamples(
          normTime(apply3(M, H.features[0].V)),
          normTime(apply3(M, H.features[2].P1)),
          8
        )
      );
      markers.push({
        kind: "cone",
        order: p,
        label: piece.cone.label,
        P: normTime(apply3(M, H.features[0].V))
      });

      if (!incomingCutId) {
        const wf = transformFrame(M, localEdgeFrame);
        const P0 = wf.P;
        const P1 = slideFrame(wf, d0).P;
        cutSegments.push({
          cutId: cut.id,
          color: cut.color,
          name: cut.name,
          A: P0,
          B: P1,
          samples: geodesicSamples(P0, P1, 10),
          frame: wf,
          length: d0
        });
        attachAcrossCut(cut.id, wf, d0, 0, piece.id);
      }
      return;
    }

    if (piece.kind === "corner-cap") {
      const q = piece.corner.order;
      const cuffCut = cutById.get(piece.cuffCutId);
      const ell = cuffCut.kind === "crosscap" ? 2 * cuffCut.length : cuffCut.length;
      const H = generalizedHexagon(Math.cos(Math.PI / (2 * q)), 0, Math.cosh(ell / 2));
      const R1 = reflMatrix(H.S[1]);
      const localPlus = buildPolyRecord(H.vertsH, H.sideOutNormals, piece.id, piece.id, 0);
      const localMinus = reflectPoly(localPlus, R1);

      const localCuffFrame = H.features[2].frame;
      const M = incomingWorldFrame ? frameMap(localCuffFrame, incomingWorldFrame) : ID3;
      fdPolygons.push(transformPoly(M, localPlus), transformPoly(M, localMinus));
      totalArea += 2 * H.area;

      const wS2 = normSpace(apply3(M, H.S[2]));
      const wS2m = normSpace(apply3(M, apply3(R1, H.S[2])));
      if (incomingCutId !== cuffCut.id) {
        const wfCuffForGen = nearestFrameToOrigin(transformFrame(M, localCuffFrame));
        const hcuff = reorthonormalizeLorentz(transMatrixAlong(wfCuffForGen, ell));
        pushGenPair(`${piece.id}:cuff`, `${piece.id}:cuff^-1`, hcuff, "cuff");
      }
      pushGen(`${piece.id}:m+`, reflMatrix(wS2), "mirror", { normal: wS2 });
      pushGen(`${piece.id}:m-`, reflMatrix(wS2m), "mirror", { normal: wS2m });

      seamSegments.push(
        geodesicSamples(
          normTime(apply3(M, H.features[0].V)),
          normTime(apply3(M, H.features[2].P1)),
          8
        )
      );
      markers.push({
        kind: "corner",
        order: q,
        label: piece.corner.shortLabel,
        P: normTime(apply3(M, H.features[0].V))
      });

      if (!incomingCutId) {
        const wf = transformFrame(M, localCuffFrame);
        const P0 = wf.P;
        const P1 = slideFrame(wf, ell).P;
        cutSegments.push({
          cutId: cuffCut.id,
          color: cuffCut.color,
          name: cuffCut.name,
          A: P0,
          B: P1,
          samples: geodesicSamples(P0, P1, 10),
          frame: wf,
          length: ell,
          twistTurns: cuffCut.twistTurns
        });
        attachCollarPairOtherSide(piece, cuffCut, wf, ell);
      }
      return;
    }

    if (piece.kind === "cuff-mirror-bridge") {
      const cuffCut = cutById.get(piece.cuffCutId);
      const bCut = cutById.get(piece.bridgeCutId);
      const ell = cuffCut.kind === "crosscap" ? 2 * cuffCut.length : cuffCut.length;
      const d0 = bCut.length;

      const H = generalizedHexagon(Math.cosh(ell / 2), 0, Math.cosh(d0 / 2));
      const R1 = reflMatrix(H.S[1]);
      const localPlus = buildPolyRecord(H.vertsH, H.sideOutNormals, piece.id, piece.id, 0);
      const localMinus = reflectPoly(localPlus, R1);

      const localCuffFrame = slideFrame(H.features[0].frame, -ell / 2);
      const localBridgeFrame = H.features[2].frame;
      const incomingIsBridge = incomingCutId === bCut.id;
      const M = incomingWorldFrame
        ? frameMap(incomingIsBridge ? localBridgeFrame : localCuffFrame, incomingWorldFrame)
        : ID3;

      fdPolygons.push(transformPoly(M, localPlus), transformPoly(M, localMinus));
      totalArea += 2 * H.area;

      const wS0 = normSpace(apply3(M, H.S[0]));
      const wfCuffForGen = nearestFrameToOrigin(transformFrame(M, localCuffFrame));
      const hcuff = reorthonormalizeLorentz(transMatrixAlong(wfCuffForGen, ell));
      const wS0m = normSpace(apply3(invLorentz(hcuff), wS0));
      if (incomingCutId !== cuffCut.id) {
        pushGenPair(`${piece.id}:cuff`, `${piece.id}:cuff^-1`, hcuff, "cuff");
      }
      pushGen(`${piece.id}:m+`, reflMatrix(wS0), "mirror", { normal: wS0 });
      pushGen(`${piece.id}:m-`, reflMatrix(wS0m), "mirror", { normal: wS0m });

      seamSegments.push(
        geodesicSamples(
          normTime(apply3(M, H.features[0].P0)),
          normTime(apply3(M, H.features[2].P1)),
          8
        )
      );

      if (incomingCutId !== cuffCut.id) {
        const wfCuff = transformFrame(M, localCuffFrame);
        const P0 = wfCuff.P;
        const P1 = slideFrame(wfCuff, ell).P;
        cutSegments.push({
          cutId: cuffCut.id,
          color: cuffCut.color,
          name: cuffCut.name,
          A: P0,
          B: P1,
          samples: geodesicSamples(P0, P1, 10),
          frame: wfCuff,
          length: ell,
          twistTurns: cuffCut.twistTurns
        });
        attachCollarPairOtherSide(piece, cuffCut, wfCuff, ell);
      }
      if (incomingCutId !== bCut.id) {
        const wfBridge = transformFrame(M, localBridgeFrame);
        const P0 = wfBridge.P;
        const P1 = slideFrame(wfBridge, d0).P;
        cutSegments.push({
          cutId: bCut.id,
          color: bCut.color,
          name: bCut.name,
          A: P0,
          B: P1,
          samples: geodesicSamples(P0, P1, 10),
          frame: wfBridge,
          length: d0
        });
        attachAcrossCut(bCut.id, wfBridge, d0, 0, piece.id);
      }
    }
  };

  // Helper when a cap or bridge is the root and must attach the rest of the orbifold
  const attachCollarPairOtherSide = (rootPiece, cuffCut, cuffFrame, ell) => {
    if (orb.mode === "pants") {
      attachAcrossCut(cuffCut.id, cuffFrame, ell, cuffCut.twistTurns, rootPiece.id);
      return;
    }
    if (orb.mode !== "collar-pair") return;
    if (cuffCut.kind === "crosscap") {
      crosscapAnchors.push({ cut: cuffCut, frame: cuffFrame, length: ell });
      return;
    }
    if (cuffCut.kind === "smooth-mirror") {
      smoothAnchors.push({ cut: cuffCut, frame: cuffFrame, length: ell });
      return;
    }
    // Shared collar between two mirror loops
    const other = carving.pieces.find(
      (q) =>
        (q.kind === "corner-cap" || q.kind === "cuff-mirror-bridge") &&
        q.cuffCutId === cuffCut.id &&
        q.id !== rootPiece.id &&
        !visitedPieces.has(q.id)
    );
    if (other) {
      const target = reverseFrame(cuffFrame, ell + cuffCut.twistTurns * ell);
      buildSubtree(other, target, cuffCut.id);
    }
  };

  const rootPiece = pieceById.get(carving.rootId);
  if (rootPiece) {
    buildSubtree(rootPiece, null, null);
  }

  // Self-glued handle cuts, crosscaps, and smooth mirrors
  for (const [, entry] of handleAnchors) {
    if (entry["+"] && entry["-"]) {
      const tau = entry.cut.twistTurns * entry.length;
      const Gh = reorthonormalizeLorentz(frameMap(entry["+"], reverseFrame(entry["-"], entry.length + tau)));
      pushGenPair(`h_${entry.cut.name}`, `h_${entry.cut.name}^-1`, Gh, "handle");
    }
  }
  for (const xc of crosscapAnchors) {
    const d = xc.cut.length;
    const Gx = reorthonormalizeLorentz(glideMatrixAlong(xc.frame, d));
    pushGenPair(`x_${xc.cut.name}`, `x_${xc.cut.name}^-1`, Gx, "glide");
  }
  for (const sm of smoothAnchors) {
    const Rm = reflMatrix(sm.frame.N);
    pushGen(`m_${sm.cut.name}`, Rm, "mirror", { normal: sm.frame.N });
  }

  return finalizeRealization(orb, carving, fdPolygons, rawGens, cutSegments, seamSegments, markers, totalArea);
}

function deduplicateGens(gens) {
  const unique = [];
  for (const g of gens) {
    const det = det3(g.M);
    let dup = false;
    for (const u of unique) {
      if ((det >= 0) !== (det3(u.M) >= 0)) continue;
      let diff = 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          diff += Math.abs(g.M[i][j] - u.M[i][j]);
        }
      }
      if (diff < 1e-8) {
        dup = true;
        break;
      }
    }
    if (!dup) unique.push(g);
  }
  return unique;
}

function matInv3(M) {
  const a = M[0][0], b = M[0][1], c = M[0][2];
  const d = M[1][0], e = M[1][1], f = M[1][2];
  const g = M[2][0], h = M[2][1], i = M[2][2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
  const G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-18) return ID3;
  return [
    [A / det, D / det, G / det],
    [B / det, E / det, H / det],
    [C / det, F / det, I / det]
  ];
}

function reorthonormalizeLorentz(M) {
  let X = M;
  for (let it = 0; it < 2; it++) {
    const L = invLorentz(matInv3(X));
    X = [
      [0.5 * (X[0][0] + L[0][0]), 0.5 * (X[0][1] + L[0][1]), 0.5 * (X[0][2] + L[0][2])],
      [0.5 * (X[1][0] + L[1][0]), 0.5 * (X[1][1] + L[1][1]), 0.5 * (X[1][2] + L[1][2])],
      [0.5 * (X[2][0] + L[2][0]), 0.5 * (X[2][1] + L[2][1]), 0.5 * (X[2][2] + L[2][2])]
    ];
  }
  return X;
}

export { reorthonormalizeLorentz };

export function panCameraByDiskDelta(cameraM, du, dv, realization = null) {
  const rad = Math.hypot(du, dv);
  if (rad < 1e-12) return { cameraM, wrapped: false };
  let sx = du;
  let sy = dv;
  if (rad > 0.55) {
    sx = (du / rad) * 0.55;
    sy = (dv / rad) * 0.55;
  }
  const T = invLorentz(mobiusTranslateToOrigin(liftDisk(sx, sy)));
  let next = mul3(T, cameraM);
  if (next[2][2] <= 5000) {
    next = reorthonormalizeLorentz(next);
  }
  if (realization && next[2][2] > 120) {
    return { cameraM: wrapCameraInGroup(next, realization), wrapped: true };
  }
  return { cameraM: next, wrapped: false };
}

export function wrapCameraInGroup(cameraM, realization) {
  const { fdPolygons, gens } = realization;
  if (!fdPolygons || fdPolygons.length === 0 || !gens || gens.length === 0) return cameraM;
  const pt = fdPolygons[0].centroid;
  let cur = cameraM;
  let curT = normTime(apply3(cur, pt))[2];
  for (let step = 0; step < 64; step++) {
    let best = null;
    let bestT = curT;
    for (let gi = 0; gi < gens.length; gi++) {
      let cand = mul3(cur, gens[gi].M);
      if (cand[2][2] > 20 && cand[2][2] <= 5000) cand = reorthonormalizeLorentz(cand);
      const t = normTime(apply3(cand, pt))[2];
      if (t < bestT - 1e-6) {
        bestT = t;
        best = cand;
      }
    }
    if (!best) break;
    cur = best;
    curT = bestT;
  }
  return cur[2][2] <= 5000 ? reorthonormalizeLorentz(cur) : cur;
}

function finalizeRealization(orb, carving, fdPolygons, rawGens, cutSegments, seamSegments, markers, totalArea) {
  // Center the whole FD when compact; anchor to the root piece if a long twisted branch pulls the barycenter far out
  const allVerts = [];
  const rootVerts = [];
  const rootId = fdPolygons.length > 0 ? fdPolygons[0].pieceId : null;
  for (const p of fdPolygons) {
    allVerts.push(...p.vertsH);
    if (p.pieceId === rootId) rootVerts.push(...p.vertsH);
  }
  const center = rootVerts.length > 0 ? baryH(rootVerts) : (allVerts.length > 0 ? baryH(allVerts) : [0, 0, 1]);
  const C = mobiusTranslateToOrigin(center);
  const Cinv = invLorentz(C);

  const centeredPolys = fdPolygons.map((p) => transformPoly(C, p));
  const conjugated = [];
  for (const g of rawGens) {
    if (g.role === "mirror" && g.normal) {
      const wn = normSpace(apply3(C, g.normal));
      conjugated.push({ label: g.label, role: g.role, M: reflMatrix(wn) });
    } else if (g.role === "cone2" && g.point) {
      const wp = normTime(apply3(C, g.point));
      conjugated.push({ label: g.label, role: g.role, M: rotMatrixAt(wp, Math.PI) });
    } else if (g.isPair) {
      const Gc = reorthonormalizeLorentz(mul3(C, mul3(g.M, Cinv)));
      conjugated.push({ label: g.label, role: g.role, M: Gc });
      conjugated.push({ label: g.invLabel, role: g.role, M: invLorentz(Gc) });
    } else {
      conjugated.push({ label: g.label, role: g.role, M: reorthonormalizeLorentz(mul3(C, mul3(g.M, Cinv))) });
    }
  }
  const centeredGens = deduplicateGens(conjugated);
  const centeredCuts = cutSegments.map((seg) => ({
    ...seg,
    A: normTime(apply3(C, seg.A)),
    B: normTime(apply3(C, seg.B)),
    samples: seg.samples.map((p) => poincare(normTime(apply3(C, liftDisk(p[0], p[1]))))),
    frame: seg.frame ? transformFrame(C, seg.frame) : null
  }));
  const centeredSeams = seamSegments.map((pts) =>
    pts.map((p) => poincare(normTime(apply3(C, liftDisk(p[0], p[1])))))
  );
  const centeredMarkers = markers.map((mk) => ({
    ...mk,
    P: normTime(apply3(C, mk.P))
  }));

  // Compute exact Lorentz error & area check
  let maxLorentzError = 0;
  for (const g of centeredGens) {
    const err = lorentzError(g.M);
    if (err > maxLorentzError) maxLorentzError = err;
  }
  const areaError = Math.abs(totalArea - orb.areaNum);

  return {
    orb,
    carving,
    fdPolygons: centeredPolys,
    gens: centeredGens,
    cutSegments: centeredCuts,
    seamSegments: centeredSeams,
    markers: centeredMarkers,
    totalArea,
    expectedArea: orb.areaNum,
    areaError,
    maxLorentzError
  };
}

// ---------------------------------------------------------------------------
// 4. Spatial-Hashed Min-Heap Tiling Engine
// ---------------------------------------------------------------------------

/**
 * Check if a point P in Minkowski H^2 lies strictly inside polygon `poly`.
 */
export function pointInPolyH(poly, P, margin = 0) {
  for (let i = 0; i < poly.sideOutNormals.length; i++) {
    if (mdot(P, poly.sideOutNormals[i]) > margin) return false;
  }
  return true;
}

/**
 * Generate group transforms tiling the Poincare disk via camera-centered min-heap BFS.
 */
export function generateTiling(realization, cameraM = ID3, { maxPolys = 2000, rMax = 0.985 } = {}) {
  const { fdPolygons, gens } = realization;
  if (!fdPolygons || fdPolygons.length === 0) return [];

  const poly0 = fdPolygons[0];
  const testPt1 = poly0.centroid;
  const testPt2 = baryH([poly0.centroid, poly0.vertsH[0], poly0.vertsH[1]], [0.55, 0.27, 0.18]);
  const fdCamP1 = normTime(apply3(cameraM, testPt1));
  const fdCamP2 = normTime(apply3(cameraM, testPt2));
  const isCamId = cameraM === ID3;
  const camInv = isCamId ? ID3 : invLorentz(cameraM);

  const maxTiles = Math.max(1, Math.ceil(maxPolys / fdPolygons.length));
  const buckets = new Map();
  const scale = 60;

  const isSeenAndMark = (CM) => {
    const p1 = normTime(apply3(CM, testPt1));
    const p2 = normTime(apply3(CM, testPt2));
    const d1 = poincare(p1);
    const detPos = det3(CM) >= 0;
    const bx = Math.round(d1[0] * scale);
    const by = Math.round(d1[1] * scale);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${bx + dx},${by + dy}`;
        const list = buckets.get(key);
        if (!list) continue;
        for (const item of list) {
          if (item.detPos !== detPos) continue;
          if (-mdot(p1, item.p1) < 1 + 1e-6 && -mdot(p2, item.p2) < 1 + 1e-6) {
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

  // Radius metric for min-heap: min radius across all FD polygon centroids & vertices in camera frame
  const probePts = [];
  for (let pi = 0; pi < fdPolygons.length; pi++) {
    probePts.push(fdPolygons[pi].centroid, ...fdPolygons[pi].vertsH);
  }
  const camRadiusOfCM = (CM) => {
    let minR = 2;
    for (let i = 0; i < probePts.length; i++) {
      const pc = poincare(normTime(apply3(CM, probePts[i])));
      const r = Math.hypot(pc[0], pc[1]);
      if (r < minR) minR = r;
    }
    return minR;
  };

  // Min-heap
  const heap = [];
  const pushHeap = (node) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].r <= heap[i].r) break;
      const tmp = heap[p];
      heap[p] = heap[i];
      heap[i] = tmp;
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
        const tmp = heap[i];
        heap[i] = heap[m];
        heap[m] = tmp;
        i = m;
      }
    }
    return top;
  };

  const checkIsFD = (CM, detPos) =>
    detPos &&
    -mdot(normTime(apply3(CM, testPt1)), fdCamP1) < 1 + 1e-6 &&
    -mdot(normTime(apply3(CM, testPt2)), fdCamP2) < 1 + 1e-6;

  // Greedily walk from cameraM back toward the camera center (0,0,1) so far-panned views stay centered
  let seedCM = cameraM;
  if (!isCamId) {
    let curT = normTime(apply3(seedCM, testPt1))[2];
    for (let step = 0; step < 64; step++) {
      let bestCM = null;
      let bestT = curT;
      for (let gi = 0; gi < gens.length; gi++) {
        let cand = mul3(seedCM, gens[gi].M);
        if (cand[2][2] > 20) cand = reorthonormalizeLorentz(cand);
        const t = normTime(apply3(cand, testPt1))[2];
        if (t < bestT - 1e-6) {
          bestT = t;
          bestCM = cand;
        }
      }
      if (!bestCM) break;
      seedCM = bestCM;
      curT = bestT;
    }
  }

  const seedDetPos = det3(seedCM) >= 0;
  isSeenAndMark(seedCM);
  pushHeap({
    M: isCamId ? ID3 : mul3(camInv, seedCM),
    CM: seedCM,
    r: camRadiusOfCM(seedCM),
    depth: 0,
    detPos: seedDetPos,
    isFD: isCamId ? true : checkIsFD(seedCM, seedDetPos)
  });

  if (!isCamId) {
    const fdRad = camRadiusOfCM(cameraM);
    if (fdRad <= rMax && !isSeenAndMark(cameraM)) {
      pushHeap({
        M: ID3,
        CM: cameraM,
        r: fdRad,
        depth: 0,
        detPos: true,
        isFD: true
      });
    }
  }

  const tiles = [];
  while (heap.length > 0 && tiles.length < maxTiles) {
    const cur = popHeap();
    tiles.push(cur);
    for (let gi = 0; gi < gens.length; gi++) {
      let CM2 = mul3(cur.CM, gens[gi].M);
      if (CM2[2][2] > 1500) continue;
      if (CM2[2][2] > 20) CM2 = reorthonormalizeLorentz(CM2);
      const rad = camRadiusOfCM(CM2);
      if (rad > rMax) continue;
      if (!isSeenAndMark(CM2)) {
        const detPos = det3(CM2) >= 0;
        pushHeap({
          M: isCamId ? CM2 : mul3(camInv, CM2),
          CM: CM2,
          r: rad,
          depth: cur.depth + 1,
          detPos,
          isFD: isCamId ? false : checkIsFD(CM2, detPos)
        });
      }
    }
  }
  return tiles;
}
