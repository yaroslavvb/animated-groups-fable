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

function exactFrameBasis(F) {
  const hand = mdot(mcross(F.P, F.T), F.N) < 0 ? -1 : 1;
  const Binv = mobiusTranslateToOrigin(F.P);
  const B = invLorentz(Binv);
  const t0 = apply3(Binv, F.T);
  const len = Math.hypot(t0[0], t0[1]);
  const ux = len > 1e-12 ? t0[0] / len : 1;
  const uy = len > 1e-12 ? t0[1] / len : 0;
  const R = [
    [ux, -hand * uy, 0],
    [uy, hand * ux, 0],
    [0, 0, 1]
  ];
  return mul3(B, R);
}

export function frameMap(F1, F2) {
  const B1 = F1.P[2] > 5 ? exactFrameBasis(F1) : frameBasis(F1);
  const B2 = F2.P[2] > 5 ? exactFrameBasis(F2) : frameBasis(F2);
  return mul3(B2, invLorentz(B1));
}

export function transformFrame(M, F) {
  const P = normTime(apply3(M, F.P));
  const N = normSpace(apply3(M, F.N));
  const rawT = apply3(M, F.T);
  const T = normSpace(add3(rawT, scale3(P, mdot(P, rawT))));
  return { P, T, N };
}

export function slideFrame(F, s) {
  const c = Math.cosh(s);
  const sh = Math.sinh(s);
  const P = normTime([c * F.P[0] + sh * F.T[0], c * F.P[1] + sh * F.T[1], c * F.P[2] + sh * F.T[2]]);
  const rawT = [sh * F.P[0] + c * F.T[0], sh * F.P[1] + c * F.T[1], sh * F.P[2] + c * F.T[2]];
  const T = normSpace(add3(rawT, scale3(P, mdot(P, rawT))));
  return { P, T, N: [...F.N] };
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
  const F0 = nearestFrameToOrigin(F);
  const B = frameBasis(F0);
  const c = Math.cosh(ell);
  const s = Math.sinh(ell);
  const D = [
    [c, 0, s],
    [0, 1, 0],
    [s, 0, c]
  ];
  return mul3(B, mul3(D, invLorentz(B)));
}

export function nearestFrameToOrigin(F) {
  const N = normSpace(F.N);
  const P = normTime([N[0] * N[2], N[1] * N[2], 1 + N[2] * N[2]]);
  let T = normSpace([N[1], -N[0], 0]);
  if (mdot(T, F.T) < 0) T = neg3(T);
  return { P, T, N };
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
  const isExteriorEdge = [];

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
      isExteriorEdge.push(true);
    } else {
      vertsH.push(f.P0);
      sideOutNormals.push(f.E);
      isExteriorEdge.push(false);
      vertsH.push(f.P1);
      sideOutNormals.push(S[sideAfterIdx]);
      isExteriorEdge.push(true);
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
    isExteriorEdge,
    centroid: baryH(vertsH),
    area
  };
}

function buildPolyRecord(vertsH, sideOutNormals, label, pieceId, parity, isExteriorEdge = null) {
  return {
    vertsH,
    sideOutNormals,
    isExteriorEdge: isExteriorEdge || vertsH.map(() => true),
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
  const oldExt = poly.isExteriorEdge || poly.vertsH.map(() => true);
  const fixedNormals = [];
  const fixedExt = [];
  for (let r = 0; r < n; r++) {
    const j = (n - 2 - r + n) % n;
    fixedNormals.push(normSpace(apply3(R, poly.sideOutNormals[j])));
    fixedExt.push(oldExt[j]);
  }
  return buildPolyRecord(revVerts, fixedNormals, poly.label, poly.pieceId, poly.parity ^ 1, fixedExt);
}

function transformPoly(M, poly) {
  const det = det3(M);
  const vertsH = poly.vertsH.map((v) => normTime(apply3(M, v)));
  const sideOutNormals = poly.sideOutNormals.map((n) => normSpace(apply3(M, n)));
  const oldExt = poly.isExteriorEdge || poly.vertsH.map(() => true);
  if (det >= 0) {
    return buildPolyRecord(vertsH, sideOutNormals, poly.label, poly.pieceId, poly.parity, [...oldExt]);
  }
  // Orientation-reversing transform: reverse vertex order to preserve CCW normal convention
  const n = vertsH.length;
  const revV = [...vertsH].reverse();
  const revN = [];
  const revExt = [];
  for (let r = 0; r < n; r++) {
    const j = (n - 2 - r + n) % n;
    revN.push(sideOutNormals[j]);
    revExt.push(oldExt[j]);
  }
  return buildPolyRecord(revV, revN, poly.label, poly.pieceId, poly.parity ^ 1, revExt);
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
  const rot1 = rotMatrixAt(Q1, Math.PI);
  const rot2 = rotMatrixAt(Q2, Math.PI);
  gensOut.push({ label: `${cut.name}:2A`, M: rot1, role: "cone2", point: Q1 });
  gensOut.push({ label: `${cut.name}:2B`, M: rot2, role: "cone2", point: Q2 });
  markersOut.push({ kind: "cone", order: 2, label: "2", P: Q1 });
  markersOut.push({ kind: "cone", order: 2, label: "2", P: Q2 });
  return {
    segments: [{ cutId: cut.id, color: cut.color, name: cut.name, A: P0, B: P1, samples, isFoldedBar: true }],
    cones: [
      { P: Q1, G: rot1 },
      { P: Q2, G: rot2 }
    ]
  };
}

/**
 * Assemble an exact hyperbolic realization from parsed `orb` and `carving`.
 */
export function buildRealization(orb, carving, { dirichletBase = null, skipDirichletBuild = false } = {}) {
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
  const pushGenPair = (label, invLabel, M, role = "gen", meta = {}) => {
    rawGens.push({ label, invLabel, M, role, isPair: true, ...meta });
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
    return finalizeRealization(orb, carving, fdPolygons, rawGens, cutSegments, seamSegments, markers, totalArea, null, dirichletBase, skipDirichletBuild);
  }

  // --- General tree assembly starting at non-degenerate root ---
  const visitedPieces = new Set();
  const handleAnchors = new Map(); // handleIndex -> { '+': frame, '-': frame, length, twistTurns, cut }
  const crosscapAnchors = [];
  const smoothAnchors = [];

  const computeMirrorWallMap = (loopIdx) => {
    const ml = orb.mirrorLoops[loopIdx];
    const nC = ml?.corners?.length || 0;
    const afterWall = new Map();
    const beforeWall = new Map();
    if (!nC) return { slotCutId: null, slotIdx: -1, afterWall, beforeWall };

    let ring = ml.corners.map((c) => c.id);
    let slotCutId = null;
    let slotIdx = -1;

    if (orb.mode === "cone-mirror" || orb.mode === "pants" || orb.mode === "collar-pair") {
      const slotCut =
        orb.mode === "cone-mirror"
          ? carving.cuts.find((c) => c.kind === "cone-mirror-arc")
          : carving.cuts.find((c) => c.kind === "bridge-arc" && c.loopIndex === loopIdx);
      if (slotCut) {
        slotCutId = slotCut.id;
        slotIdx = ring.indexOf(slotCut.pair[0]);
        for (let k = 0; k < nC; k++) {
          const id = ring[k];
          const prevK = (k - 1 + nC) % nC;
          beforeWall.set(id, prevK === slotIdx ? { type: "slotRight" } : { type: "wall", idx: prevK });
          afterWall.set(id, k === slotIdx ? { type: "slotLeft" } : { type: "wall", idx: k });
        }
        beforeWall.set(slotCutId, { type: "slotLeft" });
        afterWall.set(slotCutId, { type: "slotRight" });
        if (slotIdx !== -1) ring.splice(slotIdx + 1, 0, slotCutId);
      }
    }
    if (!slotCutId) {
      for (let k = 0; k < nC; k++) {
        const id = ring[k];
        beforeWall.set(id, { type: "wall", idx: (k - 1 + nC) % nC });
        afterWall.set(id, { type: "wall", idx: k });
      }
    }

    const arcCuts =
      orb.mode === "mirror-poly"
        ? carving.cuts.filter((c) => c.kind === "mirror-arc")
        : carving.cuts.filter((c) => c.kind === "mirror-arc" && c.loopIndex === loopIdx);
    for (const mCut of arcCuts) {
      const [u, v] = mCut.pair || [];
      let idx = -1;
      for (let i = 0; i < ring.length; i++) {
        if (ring[i] === u && ring[(i + 1) % ring.length] === v) {
          idx = i;
          break;
        }
      }
      if (idx === -1) continue;
      beforeWall.set(mCut.id, beforeWall.get(u));
      afterWall.set(mCut.id, afterWall.get(v));
      if (idx + 1 < ring.length) {
        ring.splice(idx, 2, mCut.id);
      } else {
        ring = [mCut.id, ...ring.slice(1, ring.length - 1)];
      }
    }
    return { slotCutId, slotIdx, afterWall, beforeWall };
  };

  const mirrorSpansByLoop = orb.mirrorLoops.map((_, li) => computeMirrorWallMap(li));

  // Topological metadata in world coords (pre-C) for exact stationary Recut
  const topoMeta = {
    mode: orb.mode,
    mirrorLoops: orb.mirrorLoops.map((ml, li) => ({
      loopIndex: ml.loopIndex,
      nCorners: ml.corners.length,
      walls: new Array(ml.corners.length).fill(null),
      wallOut: new Array(ml.corners.length).fill(null),
      wallIn: new Array(ml.corners.length).fill(null),
      slotLeftWall: null,
      slotRightWall: null,
      slotIdx: mirrorSpansByLoop[li]?.slotIdx ?? -1,
      hcuff: null,
      cuffFrame: null,
      cuffLength: 0,
      capPieceKind: null
    })),
    coneMirror: null,
    worldCycle: null,
    handleGluings: new Map(),
    rootPantWorldM: null,
    firstPantVisited: false
  };

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

  const attachAcrossCut = (cutId, parentFrame, cutLength, twistTurns, parentPieceId, slotG = null) => {
    const cut = cutById.get(cutId);
    const neighbors = (cutNeighbors.get(cutId) || []).filter((id) => id !== parentPieceId && !visitedPieces.has(id));
    if (neighbors.length === 0) return [];
    const childPiece = pieceById.get(neighbors[0]);

    if (childPiece.degenerate) {
      visitedPieces.add(childPiece.id);
      if (childPiece.kind === "pant") {
        // Degenerate (2, 2) cone leaf
        const barRes = makeDegenerateBarSegments(parentFrame, cutLength, twistTurns, cut, markers, rawGens);
        cutSegments.push(...barRes.segments);
        const coneFeats = childPiece.features.filter((f) => f.kind === "cone");
        if (coneFeats.length === 2 && slotG) {
          const [c0, c1] = barRes.cones;
          const prod01 = mul3(c0.G, c1.G);
          const prod10 = mul3(c1.G, c0.G);
          let err01 = 0;
          let err10 = 0;
          for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
              err01 += Math.abs(prod01[i][j] - slotG[i][j]);
              err10 += Math.abs(prod10[i][j] - slotG[i][j]);
            }
          }
          const orderedCones = err01 <= err10 ? [c0, c1] : [c1, c0];
          return [
            { id: coneFeats[0].id, kind: "cone", order: 2, P: orderedCones[0].P, G: orderedCones[0].G },
            { id: coneFeats[1].id, kind: "cone", order: 2, P: orderedCones[1].P, G: orderedCones[1].G }
          ];
        }
        return [];
      } else if (childPiece.kind === "mirror-poly") {
        // Degenerate (*2, *2) mirror wall leaf along parentFrame
        pushGen(`m_${cut.name}`, reflMatrix(parentFrame.N), "mirror", { cutId: cut.id, normal: parentFrame.N });
        const P0 = parentFrame.P;
        const P1 = slideFrame(parentFrame, cutLength).P;
        const corners = childPiece.features.filter((f) => f.kind === "corner");
        const li = childPiece.loopIndex ?? 0;
        const mlMeta = topoMeta.mirrorLoops[li];
        if (mlMeta && corners.length === 2) {
          const idx0 = orb.mirrorLoops[li].corners.findIndex((c) => c.id === corners[0].id);
          const idx1 = orb.mirrorLoops[li].corners.findIndex((c) => c.id === corners[1].id);
          const nC = orb.mirrorLoops[li].corners.length;
          const outwardN = neg3(parentFrame.N);
          if (idx0 !== -1) mlMeta.wallOut[idx0] = outwardN;
          if (idx1 !== -1) mlMeta.wallIn[idx1] = outwardN;
          if (idx0 !== -1 && idx1 !== -1) {
            let wallIdx = idx1 === (idx0 + 1) % nC ? idx0 : idx1;
            if (nC === 2 && mlMeta.slotIdx !== -1) wallIdx = 1 - mlMeta.slotIdx;
            mlMeta.walls[wallIdx] = outwardN;
          }
        }
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
        const rot2 = rotMatrixAt(Qmid, Math.PI);
        pushGen(`${cut.name}:2`, rot2, "cone2", { cutId: cut.id, point: Qmid });
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
        topoMeta.coneMirror = {
          conePoint: Qmid,
          coneOrder: 2,
          rot: rot2,
          cut0Id: childPiece.cutId,
          d0: cutLength
        };
      }
      return [];
    }

    // Non-degenerate child: build in local frame, then glue via frameMap
    const tau = twistTurns * cutLength;
    const targetFrame = reverseFrame(parentFrame, cutLength + tau);
    return buildSubtree(childPiece, targetFrame, cutId) || [];
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

      let ordered = [...feats];
      if (incomingCutId) {
        const incIdx = ordered.findIndex(incomingMatch);
        if (incIdx > 0) {
          const tmp = ordered[0];
          ordered[0] = ordered[incIdx];
          ordered[incIdx] = tmp;
        }
        if (ordered[1].kind === "cone" && ordered[2].kind !== "cone") {
          const tmp = ordered[1];
          ordered[1] = ordered[2];
          ordered[2] = tmp;
        }
      } else {
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
      const isEntryPant = !topoMeta.firstPantVisited;
      if (isEntryPant) {
        topoMeta.firstPantVisited = true;
        topoMeta.rootPantWorldM = M;
      }
      fdPolygons.push(transformPoly(M, localPlus), transformPoly(M, localMinus));
      totalArea += 2 * H.area;

      const slotWorldP = [null, null, null];
      const slotWorldF = [null, null, null];
      const Gslots = [null, null, null];
      for (let slot = 0; slot < 3; slot++) {
        const f = ordered[slot];
        if (f.kind === "cone") {
          const P = normTime(apply3(M, H.features[slot].V));
          slotWorldP[slot] = P;
          Gslots[slot] = rotMatrixAt(P, -(2 * Math.PI) / f.order);
        } else {
          const wf = transformFrame(M, localFrames[slot]);
          slotWorldF[slot] = wf;
          Gslots[slot] = transMatrixAlong(wf, cuffLengths[slot]);
        }
      }

      const g0 = invLorentz(Gslots[1]);
      const g1 = Gslots[0];
      const g0Meta =
        ordered[1].kind === "cone"
          ? { conePoint: slotWorldP[1], coneAngle: (2 * Math.PI) / ordered[1].order }
          : { cuffFrame: slotWorldF[1], cuffEll: -cuffLengths[1] };
      const g1Meta =
        ordered[0].kind === "cone"
          ? { conePoint: slotWorldP[0], coneAngle: -(2 * Math.PI) / ordered[0].order }
          : { cuffFrame: slotWorldF[0], cuffEll: cuffLengths[0] };
      pushGenPair(`${piece.id}:g0`, `${piece.id}:g0^-1`, g0, "seam", g0Meta);
      pushGenPair(`${piece.id}:g1`, `${piece.id}:g1^-1`, g1, "seam", g1Meta);

      const seamEnd0 = H.features[0].kind === "corner" ? H.features[0].V : H.features[0].P1;
      const seamEnd1 = H.features[1].kind === "corner" ? H.features[1].V : H.features[1].P0;
      seamSegments.push(geodesicSamples(normTime(apply3(M, seamEnd0)), normTime(apply3(M, seamEnd1)), 8));

      const slotLeaves = [[], [], []];
      for (let slot = 0; slot < 3; slot++) {
        const f = ordered[slot];
        if (f.kind === "cone") {
          const P = slotWorldP[slot];
          markers.push({
            kind: "cone",
            order: f.order,
            label: f.label,
            P
          });
          slotLeaves[slot].push({ id: f.id, kind: "cone", order: f.order, P, G: Gslots[slot] });
          continue;
        }
        const wf = slotWorldF[slot];
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
            slotLeaves[slot] = attachAcrossCut(f.cutId, wf, ell, cut.twistTurns, piece.id, Gslots[slot]);
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
          slotLeaves[slot].push({
            id: f.id,
            kind: f.kind,
            G: Gslots[slot],
            frame: wf,
            length: ell,
            loopIndex: f.loopIndex,
            handleIndex: f.handleIndex,
            side: f.side
          });
        }
      }

      if (isEntryPant) {
        topoMeta.worldCycle = [...slotLeaves[0], ...slotLeaves[2], ...slotLeaves[1]];
      }
      return isEntryPant ? topoMeta.worldCycle : [...slotLeaves[2], ...slotLeaves[1]];
    }

    if (piece.kind === "mirror-poly") {
      const feats = [...piece.features];
      if (incomingCutId) {
        const incIdx = feats.findIndex((f) => f.kind === "cut" && f.cutId === incomingCutId);
        if (incIdx > 0) {
          const rotFeats = [...feats.slice(incIdx), ...feats.slice(0, incIdx)];
          feats.splice(0, feats.length, ...rotFeats);
        }
      }

      const Cvals = feats.map((f) =>
        f.kind === "corner" ? Math.cos(Math.PI / f.order) : Math.cosh(cutById.get(f.cutId).length)
      );
      const H = generalizedHexagon(Cvals[0], Cvals[1], Cvals[2]);
      const localPoly = buildPolyRecord(H.vertsH, H.sideOutNormals, piece.id, piece.id, 0, H.isExteriorEdge);

      let M = ID3;
      if (incomingWorldFrame) {
        M = frameMap(H.features[0].frame, incomingWorldFrame);
      }
      fdPolygons.push(transformPoly(M, localPoly));
      totalArea += H.area;

      const wS = [0, 1, 2].map((s) => normSpace(apply3(M, H.S[s])));
      for (let s = 0; s < 3; s++) {
        pushGen(`${piece.id}:m${s}`, reflMatrix(wS[s]), "mirror", { normal: wS[s] });
      }

      const li = piece.loopIndex ?? 0;
      const mlMeta = topoMeta.mirrorLoops[li];
      const spanInfo = mirrorSpansByLoop[li];
      const cut0IdRef = carving.cuts.find((c) => c.kind === "cone-mirror-arc")?.id;
      const bCutRef = carving.cuts.find((c) => c.kind === "bridge-arc" && c.loopIndex === li);
      for (let slot = 0; slot < 3; slot++) {
        const f = feats[slot];
        const fNext = feats[(slot + 1) % 3];
        const wBefore = wS[(slot + 1) % 3];
        const wAfter = wS[(slot + 2) % 3];
        if (mlMeta) {
          if (f.kind === "corner") {
            const cIdx = orb.mirrorLoops[li].corners.findIndex((c) => c.id === f.id);
            if (cIdx !== -1) {
              mlMeta.wallIn[cIdx] = wBefore;
              mlMeta.wallOut[cIdx] = wAfter;
            }
          } else if (f.kind === "cut" && (f.cutId === cut0IdRef || f.cutId === bCutRef?.id)) {
            mlMeta.slotLeftWall = wBefore;
            mlMeta.slotRightWall = wAfter;
          }
          if (spanInfo) {
            const edgeRef =
              f.id === piece.boundaryCutId
                ? spanInfo.beforeWall.get(fNext.id)
                : spanInfo.afterWall.get(f.id);
            if (edgeRef?.type === "wall") {
              mlMeta.walls[edgeRef.idx] = wAfter;
            } else if (edgeRef?.type === "slotLeft") {
              mlMeta.slotLeftWall = wAfter;
            } else if (edgeRef?.type === "slotRight") {
              mlMeta.slotRightWall = wAfter;
            }
          }
        }
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
      return [];
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
      pushGenPair(`${piece.id}:rot_${p}`, `${piece.id}:rot_${p}^-1`, rot, "rot", {
        conePoint: wV0,
        coneAngle: (2 * Math.PI) / p
      });
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
        P: wV0
      });

      topoMeta.coneMirror = {
        conePoint: wV0,
        coneOrder: p,
        rot,
        cut0Id: piece.cutId,
        d0
      };

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
      return [];
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

      const wfCuffWorld = transformFrame(M, localCuffFrame);
      const wS2 = normSpace(apply3(M, H.S[2]));
      const wS2m = normSpace(apply3(M, apply3(R1, H.S[2])));
      const wfCuffForGen = nearestFrameToOrigin(wfCuffWorld);
      const hcuff = reorthonormalizeLorentz(transMatrixAlong(wfCuffForGen, ell));
      if (incomingCutId !== cuffCut.id) {
        pushGenPair(`${piece.id}:cuff`, `${piece.id}:cuff^-1`, hcuff, "cuff", {
          cuffFrame: wfCuffWorld,
          cuffEll: ell
        });
      }
      pushGen(`${piece.id}:m+`, reflMatrix(wS2), "mirror", { normal: wS2 });
      pushGen(`${piece.id}:m-`, reflMatrix(wS2m), "mirror", { normal: wS2m });

      const mlMeta = topoMeta.mirrorLoops[piece.loopIndex];
      if (mlMeta) {
        mlMeta.hcuff = hcuff;
        mlMeta.cuffFrame = wfCuffWorld;
        mlMeta.cuffLength = ell;
        mlMeta.capPieceKind = "corner-cap";
      }

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
        const P0 = wfCuffWorld.P;
        const P1 = slideFrame(wfCuffWorld, ell).P;
        cutSegments.push({
          cutId: cuffCut.id,
          color: cuffCut.color,
          name: cuffCut.name,
          A: P0,
          B: P1,
          samples: geodesicSamples(P0, P1, 10),
          frame: wfCuffWorld,
          length: ell,
          twistTurns: cuffCut.twistTurns
        });
        attachCollarPairOtherSide(piece, cuffCut, wfCuffWorld, ell);
      }
      return [];
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

      const wfCuffWorld = transformFrame(M, localCuffFrame);
      const wS0 = normSpace(apply3(M, H.S[0]));
      const wfCuffForGen = nearestFrameToOrigin(wfCuffWorld);
      const hcuff = reorthonormalizeLorentz(transMatrixAlong(wfCuffForGen, ell));
      const wS0m = normSpace(apply3(invLorentz(hcuff), wS0));
      if (incomingCutId !== cuffCut.id) {
        pushGenPair(`${piece.id}:cuff`, `${piece.id}:cuff^-1`, hcuff, "cuff", {
          cuffFrame: wfCuffWorld,
          cuffEll: ell
        });
      }
      pushGen(`${piece.id}:m+`, reflMatrix(wS0), "mirror", { normal: wS0 });
      pushGen(`${piece.id}:m-`, reflMatrix(wS0m), "mirror", { normal: wS0m });

      const mlMeta = topoMeta.mirrorLoops[piece.loopIndex];
      if (mlMeta) {
        mlMeta.hcuff = hcuff;
        mlMeta.cuffFrame = wfCuffWorld;
        mlMeta.cuffLength = ell;
        mlMeta.capPieceKind = "cuff-mirror-bridge";
        mlMeta.slotRightWall = mlMeta.slotRightWall || wS0;
        mlMeta.slotLeftWall = mlMeta.slotLeftWall || wS0m;
      }

      seamSegments.push(
        geodesicSamples(
          normTime(apply3(M, H.features[0].P0)),
          normTime(apply3(M, H.features[2].P1)),
          8
        )
      );

      if (incomingCutId !== cuffCut.id) {
        const P0 = wfCuffWorld.P;
        const P1 = slideFrame(wfCuffWorld, ell).P;
        cutSegments.push({
          cutId: cuffCut.id,
          color: cuffCut.color,
          name: cuffCut.name,
          A: P0,
          B: P1,
          samples: geodesicSamples(P0, P1, 10),
          frame: wfCuffWorld,
          length: ell,
          twistTurns: cuffCut.twistTurns
        });
        attachCollarPairOtherSide(piece, cuffCut, wfCuffWorld, ell);
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
    return [];
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
  for (const [hIdx, entry] of handleAnchors) {
    if (entry["+"] && entry["-"]) {
      const tau = entry.cut.twistTurns * entry.length;
      const handleFrom = entry["+"];
      const handleTo = reverseFrame(entry["-"], entry.length + tau);
      let Gh = frameMap(handleFrom, handleTo);
      if (Gh[2][2] <= 500) Gh = reorthonormalizeLorentz(Gh);
      pushGenPair(`h_${entry.cut.name}`, `h_${entry.cut.name}^-1`, Gh, "handle", { handleFrom, handleTo });
      topoMeta.handleGluings.set(hIdx, { Gh, from: handleFrom, to: handleTo, length: entry.length });
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

  return finalizeRealization(orb, carving, fdPolygons, rawGens, cutSegments, seamSegments, markers, totalArea, topoMeta, dirichletBase, skipDirichletBuild);
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
  const detSign = det3(M) < 0 ? -1 : 1;
  const P = normTime([M[0][2], M[1][2], M[2][2]]);
  const Binv = mobiusTranslateToOrigin(P);
  const B = invLorentz(Binv);
  const R = mul3(Binv, M);
  let rx = R[0][0];
  let ry = R[1][0];
  const rlen = Math.hypot(rx, ry);
  if (rlen > 1e-12) {
    rx /= rlen;
    ry /= rlen;
  } else {
    rx = 1;
    ry = 0;
  }
  const vx = detSign >= 0 ? -ry : ry;
  const vy = detSign >= 0 ? rx : -rx;
  const Rclean = [
    [rx, vx, 0],
    [ry, vy, 0],
    [0, 0, 1]
  ];
  return mul3(B, Rclean);
}

export { reorthonormalizeLorentz };

export function panCameraByDiskDelta(cameraM, du, dv, realization = null) {
  const rad = Math.hypot(du, dv);
  if (rad < 1e-12) return { cameraM, wrapped: false, colorXor: 0 };
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
    const wrappedRes = wrapCameraInGroupWithColor(next, realization);
    return { cameraM: wrappedRes.cameraM, wrapped: true, colorXor: wrappedRes.colorXor };
  }
  return { cameraM: next, wrapped: false, colorXor: 0 };
}

export function wrapCameraInGroupWithColor(cameraM, realization) {
  const { fdPolygons, gens, quotient, dirichletPoly, dirichletBase } = realization || {};
  if (!fdPolygons || fdPolygons.length === 0 || !gens || gens.length === 0) {
    return { cameraM, colorXor: 0 };
  }
  const useDirGens = Boolean(dirichletPoly?.sideGens?.length);
  const activeGens = useDirGens ? dirichletPoly.sideGens : gens;
  const masks = useDirGens ? activeGens.map((g) => g.colorMask ?? 0) : quotient?.genColorMasks;
  const pt = useDirGens ? (dirichletBase || dirichletPoly.centroid) : fdPolygons[0].centroid;
  let cur = cameraM;
  let curT = normTime(apply3(cur, pt))[2];
  let colorXor = 0;
  for (let step = 0; step < 64; step++) {
    let best = null;
    let bestGi = -1;
    let bestT = curT;
    for (let gi = 0; gi < activeGens.length; gi++) {
      let cand = mul3(cur, activeGens[gi].M);
      if (cand[2][2] > 20 && cand[2][2] <= 5000) cand = reorthonormalizeLorentz(cand);
      const t = normTime(apply3(cand, pt))[2];
      if (t < bestT - 1e-6) {
        bestT = t;
        best = cand;
        bestGi = gi;
      }
    }
    if (!best) break;
    cur = best;
    curT = bestT;
    if (masks) colorXor ^= masks[bestGi];
  }
  return {
    cameraM: cur[2][2] <= 5000 ? reorthonormalizeLorentz(cur) : cur,
    colorXor
  };
}

export function wrapCameraInGroup(cameraM, realization) {
  return wrapCameraInGroupWithColor(cameraM, realization).cameraM;
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
 * Solve for an exact group homomorphism Gamma -> Z_2^2 (or Z_2 / trivial if forced
 * by odd relations or commutator loops) via F_2 RREF over local algebraic relations
 * and Cayley-graph BFS cycle relations.
 */
function computeZ2Quotient(fdPolygons, gens) {
  const k = gens ? gens.length : 0;
  if (!fdPolygons || fdPolygons.length === 0 || k === 0) {
    return { genColorMasks: new Array(k).fill(0), quotientSize: 1 };
  }

  const poly0 = fdPolygons[0];
  const testPt1 = poly0.centroid;
  const testPt2 = baryH([poly0.centroid, poly0.vertsH[0], poly0.vertsH[1]], [0.55, 0.27, 0.18]);
  const fixesTestPts = (M) =>
    det3(M) >= 0 &&
    -mdot(normTime(apply3(M, testPt1)), testPt1) < 1 + 1e-5 &&
    -mdot(normTime(apply3(M, testPt2)), testPt2) < 1 + 1e-5;

  const relations = [];
  const evenCornerPairs = [];

  // Step A: Local algebraic relations (inverses & finite-order rotations/pairwise products)
  for (let i = 0; i < k; i++) {
    const M = gens[i].M;
    if (det3(M) > 0) {
      const tr = M[0][0] + M[1][1] + M[2][2];
      if (tr < 3 - 1e-4) {
        let Q = M;
        for (let q = 2; q <= 30; q++) {
          Q = mul3(Q, M);
          if (Q[2][2] <= 5000) Q = reorthonormalizeLorentz(Q);
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
      let P = mul3(gens[i].M, gens[j].M);
      if (P[2][2] <= 5000) P = reorthonormalizeLorentz(P);
      if (fixesTestPts(P)) {
        relations.push((1n << BigInt(i)) | (1n << BigInt(j)));
        continue;
      }
      if (det3(P) > 0) {
        const tr = P[0][0] + P[1][1] + P[2][2];
        if (tr < 3 - 1e-4) {
          let Q = P;
          for (let q = 2; q <= 30; q++) {
            Q = mul3(Q, P);
            if (Q[2][2] <= 5000) Q = reorthonormalizeLorentz(Q);
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

  // Step B: Cayley-graph BFS cycle relations
  const probePts = [];
  for (let pi = 0; pi < fdPolygons.length; pi++) {
    probePts.push(fdPolygons[pi].centroid, ...fdPolygons[pi].vertsH);
  }
  const minDiskR = (M) => {
    let minR = 2;
    for (let i = 0; i < probePts.length; i++) {
      const pc = poincare(normTime(apply3(M, probePts[i])));
      const r = Math.hypot(pc[0], pc[1]);
      if (r < minR) minR = r;
    }
    return minR;
  };

  const buckets = new Map();
  const scale = 60;
  const findSeen = (M, p1, p2, detPos) => {
    const d1 = poincare(p1);
    const bx = Math.round(d1[0] * scale);
    const by = Math.round(d1[1] * scale);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = buckets.get(`${bx + dx},${by + dy}`);
        if (!list) continue;
        for (const item of list) {
          if (item.detPos !== detPos) continue;
          if (-mdot(p1, item.p1) < 1 + 1e-5 && -mdot(p2, item.p2) < 1 + 1e-5) {
            return item;
          }
        }
      }
    }
    return null;
  };
  const markSeen = (M, p1, p2, detPos, vec) => {
    const d1 = poincare(p1);
    const home = `${Math.round(d1[0] * scale)},${Math.round(d1[1] * scale)}`;
    if (!buckets.has(home)) buckets.set(home, []);
    buckets.get(home).push({ detPos, p1, p2, vec });
  };

  const heap = [];
  const pushH = (node) => {
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

  const p1Root = normTime(apply3(ID3, testPt1));
  const p2Root = normTime(apply3(ID3, testPt2));
  markSeen(ID3, p1Root, p2Root, true, 0n);
  pushH({ M: ID3, r: minDiskR(ID3), vec: 0n });

  let visitedCount = 0;
  const maxRelTiles = 450;
  while (heap.length > 0 && visitedCount < maxRelTiles) {
    const cur = popH();
    visitedCount++;
    for (let gi = 0; gi < k; gi++) {
      let M2 = mul3(cur.M, gens[gi].M);
      if (M2[2][2] > 600) continue;
      if (M2[2][2] > 20) M2 = reorthonormalizeLorentz(M2);
      const rad = minDiskR(M2);
      if (rad > 0.96) continue;
      const p1 = normTime(apply3(M2, testPt1));
      const p2 = normTime(apply3(M2, testPt2));
      const detPos = det3(M2) >= 0;
      const edgeVec = cur.vec ^ (1n << BigInt(gi));
      const hit = findSeen(M2, p1, p2, detPos);
      if (hit) {
        const cyc = edgeVec ^ hit.vec;
        if (cyc !== 0n) relations.push(cyc);
      } else {
        markSeen(M2, p1, p2, detPos, edgeVec);
        pushH({ M: M2, r: rad, vec: edgeVec });
      }
    }
  }

  // Step C: Exact RREF over F_2 and nullspace basis
  const pivots = new Map();
  for (let i = 0; i < relations.length; i++) {
    let x = relations[i];
    for (let c = 0; c < k && x !== 0n; c++) {
      if ((x >> BigInt(c)) & 1n) {
        const piv = pivots.get(c);
        if (piv !== undefined) {
          x ^= piv;
        } else {
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
        if (pivLow & maskHigh) {
          pivots.set(cLow, pivLow ^ pivHigh);
        }
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
      const bit0 = Number((v0 >> BigInt(i)) & 1n);
      const bit1 = Number((v1 >> BigInt(i)) & 1n);
      out[i] = bit0 | (bit1 << 1);
    }
    return out;
  };

  if (basis.length === 1) {
    return { genColorMasks: masksFromVecs(basis[0]), quotientSize: 2 };
  }

  // Basis dimension >= 2: select 2 independent characters for Z_2^2 (4 colors)
  const poolSet = new Set();
  const dim = basis.length;
  if (dim <= 6) {
    for (let mask = 1; mask < 1 << dim; mask++) {
      let v = 0n;
      for (let b = 0; b < dim; b++) {
        if ((mask >> b) & 1) v ^= basis[b];
      }
      if (v !== 0n) poolSet.add(v);
    }
  } else {
    let allXor = 0n;
    let evenXor = 0n;
    let oddXor = 0n;
    for (let i = 0; i < dim; i++) {
      if (basis[i] !== 0n) poolSet.add(basis[i]);
      allXor ^= basis[i];
      if (i % 2 === 0) evenXor ^= basis[i];
      else oddXor ^= basis[i];
      for (let j = i + 1; j < dim; j++) {
        const pairXor = basis[i] ^ basis[j];
        if (pairXor !== 0n) poolSet.add(pairXor);
      }
    }
    if (allXor !== 0n) poolSet.add(allXor);
    if (evenXor !== 0n) poolSet.add(evenXor);
    if (oddXor !== 0n) poolSet.add(oddXor);
  }
  const candidates = [...poolSet];

  let detVec = 0n;
  for (let i = 0; i < k; i++) {
    if (det3(gens[i].M) < 0) detVec |= 1n << BigInt(i);
  }
  const detValid =
    detVec !== 0n && [...pivots.values()].every((piv) => (popcountBig(piv & detVec) & 1) === 0);

  const scorePair = (v0, v1) => {
    const masks = masksFromVecs(v0, v1);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < k; i++) counts[masks[i]]++;
    const dNZ = (counts[1] > 0 ? 1 : 0) + (counts[2] > 0 ? 1 : 0) + (counts[3] > 0 ? 1 : 0);
    let evenDiff = 0;
    for (let p = 0; p < evenCornerPairs.length; p++) {
      const [i, j] = evenCornerPairs[p];
      if (masks[i] !== masks[j]) evenDiff++;
    }
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
    const targetHalf = k / 2;
    let bestHalfErr = Infinity;
    for (const v0 of candidates) {
      const err = Math.abs(popcountBig(v0) - targetHalf);
      if (err < bestHalfErr) {
        bestHalfErr = err;
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

function polyAreaAngleSumH(vertsH, sideOutNormals) {
  let angleSum = 0;
  for (let i = 0; i < sideOutNormals.length; i++) {
    const nPrev = sideOutNormals[(i - 1 + sideOutNormals.length) % sideOutNormals.length];
    const nNext = sideOutNormals[i];
    const c = Math.max(-1, Math.min(1, -mdot(nPrev, nNext)));
    angleSum += Math.acos(c);
  }
  return (vertsH.length - 2) * Math.PI - angleSum;
}

/**
 * Wrap point `pt` into tile I of `fdPolygons` via greedy distance reduction under `gens`.
 */
export function wrapPointIntoTileI(pt, fdPolygons, gens, genColorMasks) {
  if (!fdPolygons.length || !gens.length) return { point: pt, colorXor: 0, detFlip: 0 };
  const center = fdPolygons[0].centroid;
  let cur = normTime(pt);
  let curD = -mdot(cur, center);
  let colorXor = 0;
  let detFlip = 0;
  for (let step = 0; step < 64; step++) {
    let bestPt = null;
    let bestGi = -1;
    let bestD = curD;
    for (let gi = 0; gi < gens.length; gi++) {
      const cand = normTime(apply3(gens[gi].M, cur));
      const d = -mdot(cand, center);
      if (d < bestD - 1e-6) {
        bestD = d;
        bestPt = cand;
        bestGi = gi;
      }
    }
    if (!bestPt) break;
    cur = bestPt;
    curD = bestD;
    if (genColorMasks) colorXor ^= genColorMasks[bestGi];
    if (det3(gens[bestGi].M) < 0) detFlip ^= 1;
  }
  return { point: cur, colorXor, detFlip };
}

/**
 * Construct exact convex Dirichlet fundamental domain centered at `p0` under `gens`,
 * certified to Gauss-Bonnet `expectedArea`.
 */
export function buildHyperbolicDirichlet(p0, gens, expectedArea, genColorMasks = null, markers = null) {
  if (!gens || gens.length === 0 || !expectedArea || expectedArea <= 0) return null;
  const B = mobiusTranslateToOrigin(p0);
  const Bi = invLorentz(B);
  const bgens = gens.map((g) => reorthonormalizeLorentz(mul3(B, mul3(g.M, Bi))));

  const buckets = new Map();
  const scale = 60;
  const O = [0, 0, 1];
  const seenImage = (w) => {
    const bx = Math.round((w[0] / (1 + w[2])) * scale);
    const by = Math.round((w[1] / (1 + w[2])) * scale);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = buckets.get(`${bx + dx},${by + dy}`);
        if (!list) continue;
        for (const item of list) {
          if (-mdot(w, item) < 1 + 1e-6) return true;
        }
      }
    }
    const home = `${bx},${by}`;
    if (!buckets.has(home)) buckets.set(home, []);
    buckets.get(home).push(w);
    return false;
  };
  seenImage(O);

  let poly = [
    [-1, -1, null, null],
    [1, -1, null, null],
    [1, 1, null, null],
    [-1, 1, null, null]
  ];
  let rho = Infinity;
  const NEAR = 1e-10;
  const STILL = 1 + 1e-5;
  const tol = 5e-5;

  const computeVertsAndNormals = (pl) => {
    const n = pl.length;
    const normals = pl.map((q) => {
      const w = q[2];
      return normSpace([w[0], w[1], w[2] - 1]);
    });
    const vertsH = [];
    for (let k = 0; k < n; k++) {
      const nPrev = normals[(k - 1 + n) % n];
      const nNext = normals[k];
      let v = mcross(nPrev, nNext);
      if (mdot(v, v) >= -1e-18) return null;
      vertsH.push(normTime(v));
    }
    return { vertsH, normals };
  };

  const measure = () => {
    if (poly.length < 3) return null;
    for (let k = 0; k < poly.length; k++) {
      const q = poly[k];
      if (!q[2] || q[0] * q[0] + q[1] * q[1] >= 0.99999999) {
        rho = Infinity;
        return null;
      }
    }
    const vn = computeVertsAndNormals(poly);
    if (!vn) return null;
    const { vertsH, normals } = vn;
    const cleanV = [];
    const cleanN = [];
    for (let k = 0; k < vertsH.length; k++) {
      const nxt = vertsH[(k + 1) % vertsH.length];
      if (hypDist(vertsH[k], nxt) > 1e-7) {
        cleanV.push(vertsH[k]);
        cleanN.push(normals[k]);
      }
    }
    if (cleanV.length < 3) return null;
    let maxT = 1;
    for (let k = 0; k < cleanV.length; k++) {
      if (cleanV[k][2] > maxT) maxT = cleanV[k][2];
    }
    rho = Math.cosh(2 * Math.acosh(Math.max(1, maxT)) + 0.5);
    return polyAreaAngleSumH(cleanV, cleanN);
  };

  const cutByImage = (w, meta = null) => {
    if (!(w[2] > STILL) || w[2] > Math.min(rho, 8000)) return false;
    const nrm = Math.hypot(w[0], w[1]) || 1;
    const val = (q) => (w[0] * q[0] + w[1] * q[1] - (w[2] - 1)) / nrm;
    const vals = poly.map(val);
    if (vals.every((v) => v <= NEAR)) return false;
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const q = poly[k];
      const r = poly[(k + 1) % poly.length];
      const vq = vals[k];
      const vr = vals[(k + 1) % poly.length];
      if (vq <= NEAR) out.push(q);
      if ((vq <= NEAR) !== (vr <= NEAR)) {
        const t = vq / (vq - vr);
        const hx = q[0] + t * (r[0] - q[0]);
        const hy = q[1] + t * (r[1] - q[1]);
        out.push(vq <= NEAR ? [hx, hy, w, meta] : [hx, hy, q[2], q[3]]);
      }
    }
    const prevPoly = poly;
    const prevRho = rho;
    poly = out;
    const got = measure();
    if (out.length < 3 || (got !== null && got < expectedArea - tol)) {
      poly = prevPoly;
      rho = prevRho;
      return false;
    }
    return true;
  };

  const heap = [];
  const pushH = (node) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].wt <= heap[i].wt) break;
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
        if (l < heap.length && heap[l].wt < heap[m].wt) m = l;
        if (r < heap.length && heap[r].wt < heap[m].wt) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };

  pushH({ M: ID3, colorMask: 0, word: [], wt: 1 });
  let visited = 0;
  let closedArea = null;
  while (heap.length > 0 && visited < 1200) {
    const cur = popH();
    if (cur.wt > Math.min(rho * 1.1, 8000)) break;
    visited++;
    for (let gi = 0; gi < bgens.length; gi++) {
      let M2 = mul3(cur.M, bgens[gi]);
      if (M2[2][2] > 8000) continue;
      if (M2[2][2] > 20) M2 = reorthonormalizeLorentz(M2);
      const w = normTime([M2[0][2], M2[1][2], M2[2][2]]);
      if (!seenImage(w)) {
        const colorMask2 = cur.colorMask ^ (genColorMasks ? genColorMasks[gi] : 0);
        const word2 = [...cur.word, gi];
        cutByImage(w, { M: M2, colorMask: colorMask2, word: word2 });
        if (w[2] <= Math.min(rho * 1.15, 8000)) {
          pushH({ M: M2, colorMask: colorMask2, word: word2, wt: w[2] });
        }
      }
    }
    if (visited % 16 === 0) {
      closedArea = measure();
      if (closedArea !== null && Math.abs(closedArea - expectedArea) <= tol) break;
    }
  }
  // Finish draining near-rho items already in heap up to 200 checks to never shave corners
  let extra = 0;
  while (heap.length > 0 && extra < 200) {
    const cur = popH();
    if (cur.wt > Math.min(rho, 8000)) break;
    extra++;
    for (let gi = 0; gi < bgens.length; gi++) {
      let M2 = mul3(cur.M, bgens[gi]);
      if (M2[2][2] > 8000) continue;
      if (M2[2][2] > 20) M2 = reorthonormalizeLorentz(M2);
      const w = normTime([M2[0][2], M2[1][2], M2[2][2]]);
      if (!seenImage(w)) {
        const colorMask2 = cur.colorMask ^ (genColorMasks ? genColorMasks[gi] : 0);
        const word2 = [...cur.word, gi];
        cutByImage(w, { M: M2, colorMask: colorMask2, word: word2 });
      }
    }
  }

  closedArea = measure();
  if (closedArea === null || Math.abs(closedArea - expectedArea) > tol) {
    return null;
  }

  const vn = computeVertsAndNormals(poly);
  if (!vn) return null;
  const worldVerts = [];
  const worldNormals = [];
  const sideGens = [];
  const addSideGen = (M, colorMask, word) => {
    const dPos = det3(M) >= 0;
    const thresh = Math.max(1e-4, 1e-6 * M[2][2]);
    for (let i = 0; i < sideGens.length; i++) {
      const s = sideGens[i];
      if ((det3(s.M) >= 0) !== dPos) continue;
      let maxDiff = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const df = Math.abs(s.M[r][c] - M[r][c]);
          if (df > maxDiff) maxDiff = df;
        }
      }
      if (maxDiff < thresh) return;
    }
    sideGens.push({
      label: `dir_${sideGens.length}`,
      M,
      colorMask: colorMask ?? 0,
      word: word ? [...word] : null
    });
  };

  for (let k = 0; k < vn.vertsH.length; k++) {
    const vA = normTime(apply3(Bi, vn.vertsH[k]));
    const vB = normTime(apply3(Bi, vn.vertsH[(k + 1) % vn.vertsH.length]));
    if (hypDist(vA, vB) > 1e-6) {
      worldVerts.push(vA);
      worldNormals.push(normSpace(apply3(Bi, vn.normals[k])));
      const meta = poly[k][3];
      if (meta && meta.M) {
        const Morig = reorthonormalizeLorentz(mul3(Bi, mul3(meta.M, B)));
        addSideGen(Morig, meta.colorMask, meta.word);
        addSideGen(invLorentz(Morig), meta.colorMask, meta.word);
      }
    }
  }
  if (worldVerts.length < 3) return null;
  const rec = buildPolyRecord(worldVerts, worldNormals, "dirichlet", "dirichlet", 0);
  rec.sideGens = sideGens;
  rec.markers = markers ? markers.map((mk) => ({ ...mk })) : [];
  return rec;
}

function finalizeRealization(orb, carving, fdPolygons, rawGens, cutSegments, seamSegments, markers, totalArea, topoMeta = null, dirichletBase = null, skipDirichletBuild = false) {
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
      conjugated.push({ label: g.label, role: g.role, M: reflMatrix(wn), normal: wn });
    } else if (g.role === "cone2" && g.point) {
      const wp = normTime(apply3(C, g.point));
      conjugated.push({ label: g.label, role: g.role, M: rotMatrixAt(wp, Math.PI), conePoint: wp, coneAngle: Math.PI });
    } else if (g.cuffFrame) {
      const wf = nearestFrameToOrigin(transformFrame(C, g.cuffFrame));
      const Gc = transMatrixAlong(wf, g.cuffEll);
      conjugated.push({ label: g.label, role: g.role, M: Gc, cuffFrame: wf, cuffEll: g.cuffEll });
      if (g.isPair) {
        conjugated.push({ label: g.invLabel, role: g.role, M: invLorentz(Gc), cuffFrame: wf, cuffEll: -g.cuffEll });
      }
    } else if (g.handleFrom && g.handleTo) {
      const hf = transformFrame(C, g.handleFrom);
      const ht = transformFrame(C, g.handleTo);
      let Gc = frameMap(hf, ht);
      if (Gc[2][2] <= 500) Gc = reorthonormalizeLorentz(Gc);
      conjugated.push({ label: g.label, role: g.role, M: Gc, handleFrom: hf, handleTo: ht });
      if (g.isPair) {
        conjugated.push({ label: g.invLabel, role: g.role, M: invLorentz(Gc), handleFrom: ht, handleTo: hf });
      }
    } else if (g.conePoint) {
      const wp = normTime(apply3(C, g.conePoint));
      const Gc = rotMatrixAt(wp, g.coneAngle);
      conjugated.push({ label: g.label, role: g.role, M: Gc, conePoint: wp, coneAngle: g.coneAngle });
      if (g.isPair) {
        conjugated.push({ label: g.invLabel, role: g.role, M: invLorentz(Gc), conePoint: wp, coneAngle: -g.coneAngle });
      }
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

  // Transform topoMeta into the centered frame C
  let centeredTopo = null;
  if (topoMeta) {
    const conjM = (M) => (M ? reorthonormalizeLorentz(mul3(C, mul3(M, Cinv))) : null);
    const mapN = (n) => (n ? normSpace(apply3(C, n)) : null);
    const mapP = (p) => (p ? normTime(apply3(C, p)) : null);
    const mapF = (f) => (f ? transformFrame(C, f) : null);
    centeredTopo = {
      mode: topoMeta.mode,
      mirrorLoops: topoMeta.mirrorLoops.map((ml) => ({
        ...ml,
        walls: ml.walls.map(mapN),
        wallOut: ml.wallOut.map(mapN),
        wallIn: ml.wallIn.map(mapN),
        slotLeftWall: mapN(ml.slotLeftWall),
        slotRightWall: mapN(ml.slotRightWall),
        hcuff: ml.cuffFrame && ml.cuffLength ? transMatrixAlong(mapF(ml.cuffFrame), ml.cuffLength) : conjM(ml.hcuff),
        cuffFrame: mapF(ml.cuffFrame)
      })),
      coneMirror: topoMeta.coneMirror
        ? {
            ...topoMeta.coneMirror,
            conePoint: mapP(topoMeta.coneMirror.conePoint),
            rot: topoMeta.coneMirror.conePoint
              ? rotMatrixAt(mapP(topoMeta.coneMirror.conePoint), (2 * Math.PI) / topoMeta.coneMirror.coneOrder)
              : conjM(topoMeta.coneMirror.rot)
          }
        : null,
      worldCycle: topoMeta.worldCycle
        ? topoMeta.worldCycle.map((leaf) => {
            const P = mapP(leaf.P);
            const frame = mapF(leaf.frame);
            const G =
              leaf.kind === "cone" && P
                ? rotMatrixAt(P, -(2 * Math.PI) / leaf.order)
                : frame && leaf.length
                ? transMatrixAlong(frame, leaf.length)
                : conjM(leaf.G);
            return { ...leaf, G, P, frame };
          })
        : null,
      handleGluings: new Map(
        [...topoMeta.handleGluings.entries()].map(([hIdx, e]) => {
          const from = mapF(e.from);
          const to = mapF(e.to);
          let Gh = from && to ? frameMap(from, to) : conjM(e.Gh);
          if (Gh && Gh[2][2] <= 500) Gh = reorthonormalizeLorentz(Gh);
          return [hIdx, { ...e, Gh, from, to }];
        })
      ),
      rootPantWorldM: topoMeta.rootPantWorldM ? reorthonormalizeLorentz(mul3(C, topoMeta.rootPantWorldM)) : null
    };
  }

  // Compute exact Lorentz error & area check
  let maxLorentzError = 0;
  for (const g of centeredGens) {
    const err = lorentzError(g.M);
    if (err > maxLorentzError) maxLorentzError = err;
  }
  const areaError = Math.abs(totalArea - orb.areaNum);
  const quotient = computeZ2Quotient(centeredPolys, centeredGens);
  const fdHasBothParities =
    centeredPolys.some((p) => p.parity === 0) && centeredPolys.some((p) => p.parity === 1);

  // Recompute exterior vs interior edge flags purely geometrically so degenerate mirror/seam leaves never hide borders
  for (let pi = 0; pi < centeredPolys.length; pi++) {
    const poly = centeredPolys[pi];
    const n = poly.vertsH.length;
    const ext = new Array(n).fill(true);
    for (let e = 0; e < n; e++) {
      const u = poly.vertsH[e];
      const w = poly.vertsH[(e + 1) % n];
      let shared = false;
      for (let pj = 0; pj < centeredPolys.length && !shared; pj++) {
        if (pj === pi) continue;
        const other = centeredPolys[pj];
        const m = other.vertsH.length;
        for (let f = 0; f < m; f++) {
          const u2 = other.vertsH[f];
          const w2 = other.vertsH[(f + 1) % m];
          if (
            (hypDist(u, u2) < 1e-4 && hypDist(w, w2) < 1e-4) ||
            (hypDist(u, w2) < 1e-4 && hypDist(w, u2) < 1e-4)
          ) {
            shared = true;
            break;
          }
        }
      }
      ext[e] = !shared;
    }
    poly.isExteriorEdge = ext;
  }

  let chosenDirichletBase = dirichletBase ? normTime(dirichletBase) : null;
  let pullColorXor = 0;
  let pullDetFlip = 0;
  let dirichletPoly = null;
  const skipDirichlet =
    orb.mode === "mirror-poly" || (orb.mode === "rigid" && orb.m === 0 && orb.b === 1);
  if (!skipDirichlet && !skipDirichletBuild && centeredPolys.length > 0 && orb.areaNum > 0) {
    if (!chosenDirichletBase) {
      const p0 = centeredPolys[0];
      chosenDirichletBase = baryH([p0.centroid, p0.vertsH[0], p0.vertsH[1]], [0.62, 0.23, 0.15]);
    } else {
      const wrapped = wrapPointIntoTileI(chosenDirichletBase, centeredPolys, centeredGens, quotient.genColorMasks);
      chosenDirichletBase = wrapped.point;
      pullColorXor = wrapped.colorXor;
      pullDetFlip = wrapped.detFlip || 0;
    }
    dirichletPoly = buildHyperbolicDirichlet(
      chosenDirichletBase,
      centeredGens,
      orb.areaNum,
      quotient.genColorMasks,
      centeredMarkers
    );
  }

  return {
    geometry: "hyperbolic",
    orb,
    carving,
    fdPolygons: centeredPolys,
    dirichletPoly,
    dirichletBase: chosenDirichletBase,
    pullColorXor,
    pullDetFlip,
    gens: centeredGens,
    quotient,
    fdHasBothParities,
    cutSegments: centeredCuts,
    seamSegments: centeredSeams,
    markers: centeredMarkers,
    totalArea,
    expectedArea: orb.areaNum,
    areaError,
    maxLorentzError,
    topoMeta: centeredTopo
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
export function generateTiling(realization, cameraM = ID3, { maxPolys = 2000, rMax = 0.985, cameraColor = 0, useDirichlet = false } = {}) {
  const { fdPolygons, gens, quotient } = realization;
  if (!fdPolygons || fdPolygons.length === 0) return [];

  const useDir = Boolean(useDirichlet && realization.dirichletPoly);
  const useDirGens = Boolean(useDir && realization.dirichletPoly.sideGens?.length);
  const activeGens = useDirGens ? realization.dirichletPoly.sideGens : gens;
  const masks = useDirGens ? activeGens.map((g) => g.colorMask ?? 0) : quotient?.genColorMasks;
  const poly0 = useDir ? realization.dirichletPoly : fdPolygons[0];

  let testPt1;
  let testPt2;
  const probePts = [];
  if (useDir) {
    testPt1 = poly0.centroid;
    testPt2 = baryH([poly0.centroid, poly0.vertsH[0], poly0.vertsH[1]], [0.55, 0.27, 0.18]);
    probePts.push(poly0.centroid, ...poly0.vertsH);
  } else {
    const uniqVerts = [];
    const uniqPoinc = [];
    for (let pi = 0; pi < fdPolygons.length; pi++) {
      const verts = fdPolygons[pi].vertsH;
      for (let vi = 0; vi < verts.length; vi++) {
        const v = verts[vi];
        const pv = poincare(v);
        if (!uniqPoinc.some((q) => Math.hypot(q[0] - pv[0], q[1] - pv[1]) < 1e-4)) {
          uniqVerts.push(v);
          uniqPoinc.push(pv);
        }
      }
    }
    const polyCenter = uniqVerts.length > 0 ? baryH(uniqVerts) : poly0.centroid;
    probePts.push(polyCenter, ...uniqVerts);
    testPt1 = polyCenter;
    testPt2 =
      uniqVerts.length >= 2
        ? baryH([polyCenter, uniqVerts[0], uniqVerts[1]], [0.55, 0.27, 0.18])
        : baryH([poly0.centroid, poly0.vertsH[0], poly0.vertsH[1]], [0.55, 0.27, 0.18]);
  }

  const fdCamP1 = normTime(apply3(cameraM, testPt1));
  const fdCamP2 = normTime(apply3(cameraM, testPt2));
  const isCamId = cameraM === ID3;
  const camInv = isCamId ? ID3 : invLorentz(cameraM);

  const maxTiles = useDir
    ? Math.max(1, Math.min(maxPolys, 1400))
    : Math.max(1, Math.ceil(maxPolys / fdPolygons.length));
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
  let seedColor = cameraColor;
  if (!isCamId) {
    let curT = normTime(apply3(seedCM, testPt1))[2];
    for (let step = 0; step < 64; step++) {
      let bestCM = null;
      let bestGi = -1;
      let bestT = curT;
      for (let gi = 0; gi < activeGens.length; gi++) {
        let cand = mul3(seedCM, activeGens[gi].M);
        if (cand[2][2] > 20) cand = reorthonormalizeLorentz(cand);
        const t = normTime(apply3(cand, testPt1))[2];
        if (t < bestT - 1e-6) {
          bestT = t;
          bestCM = cand;
          bestGi = gi;
        }
      }
      if (!bestCM) break;
      seedCM = bestCM;
      curT = bestT;
      if (masks) seedColor ^= masks[bestGi];
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
    isFD: isCamId ? true : checkIsFD(seedCM, seedDetPos),
    color: seedColor
  });

  if (!isCamId) {
    const fdRad = camRadiusOfCM(cameraM);
    if (fdRad <= rMax && !isSeenAndMark(cameraM)) {
      pushHeap({
        M: ID3,
        CM: cameraM,
        r: fdRad,
        depth: 0,
        detPos: det3(cameraM) >= 0,
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
      let CM2 = mul3(cur.CM, activeGens[gi].M);
      if (useDir ? normTime(apply3(CM2, testPt1))[2] > 1500 : CM2[2][2] > 1500) continue;
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
          isFD: isCamId ? false : checkIsFD(CM2, detPos),
          color: cur.color ^ (masks ? masks[gi] : 0)
        });
      }
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// 5. Stationary Recut & Quotient Transfer for Hyperbolic Orbifolds
// ---------------------------------------------------------------------------

function wrapHalfTurns(t) {
  let u = ((t % 1) + 1) % 1;
  if (u >= 0.5 - 1e-7) u -= 1;
  return u;
}

function signedFrameParamOfPoint(frame, P) {
  return Math.asinh(mdot(P, frame.T));
}

function frameFromOriginAndWall(conePt, wallOut) {
  const P = normTime(conePt);
  const wProj = add3(wallOut, scale3(P, mdot(P, wallOut)));
  const N = normSpace(wProj);
  let T = normSpace(mcross(N, P));
  if (det3(frameBasis({ P, T, N })) < 0) T = neg3(T);
  return { P, T, N };
}

function frameFromCornerWalls(wIn, wOut) {
  const P = normTime(mcross(wIn, wOut));
  const N = normSpace(wOut);
  let T = normSpace(mcross(N, P));
  if (det3(frameBasis({ P, T, N })) < 0) T = neg3(T);
  return { P, T, N };
}

/**
 * Transfer Z_2 x Z_2 quotient color masks from oldReal to newReal under p_new = Q * p_old.
 */
export function transferQuotientAcrossRecut(oldReal, newReal, Q = ID3) {
  const oldQ = oldReal?.quotient;
  if (!oldQ || oldQ.quotientSize <= 1 || !oldReal.fdPolygons?.length || !oldReal.gens?.length) {
    return {
      genColorMasks: (newReal?.gens || []).map(() => 0),
      quotientSize: oldQ?.quotientSize || 1,
      exactTransferred: true
    };
  }

  const invQ = invLorentz(Q);
  const poly0 = oldReal.fdPolygons[0];
  const testPt1 = poly0.centroid;
  const testPt2 = baryH([poly0.centroid, poly0.vertsH[0], poly0.vertsH[1]], [0.55, 0.27, 0.18]);
  const oldGens = oldReal.gens;
  const oldMasks = oldQ.genColorMasks;
  const baseT = normSpace(add3(poly0.vertsH[0], scale3(testPt1, mdot(testPt1, poly0.vertsH[0]))));
  const baseF = { P: testPt1, T: baseT, N: normSpace(mcross(testPt1, baseT)) };

  const pullFrameInOld = (startF) => {
    let curF = startF;
    let curD = -mdot(curF.P, testPt1);
    let mask = 0;
    for (let step = 0; step < 120; step++) {
      let bestF = null;
      let bestOi = -1;
      let bestD = curD;
      for (let oi = 0; oi < oldGens.length; oi++) {
        const cf = transformFrame(oldGens[oi].M, curF);
        const d = -mdot(cf.P, testPt1);
        if (d < bestD - 1e-6) {
          bestD = d;
          bestF = cf;
          bestOi = oi;
        }
      }
      if (!bestF) break;
      curF = bestF;
      curD = bestD;
      mask ^= oldMasks[bestOi];
    }
    return { frame: curF, mask };
  };

  const evalOldQuotientMask = (Mstart) => {
    const p1Start = normTime(apply3(Mstart, testPt1));
    const p2Start = normTime(apply3(Mstart, testPt2));
    if (
      det3(Mstart) > 0 &&
      -mdot(p1Start, testPt1) < 1 + 1e-4 &&
      -mdot(p2Start, testPt2) < 1 + 1e-4
    ) {
      return { ok: true, mask: 0 };
    }

    const buckets = new Map();
    const scale = 60;
    const isSeenAndMark = (M, p1, p2) => {
      const detPos = det3(M) >= 0;
      const d1 = poincare(p1);
      const bx = Math.round(d1[0] * scale);
      const by = Math.round(d1[1] * scale);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const list = buckets.get(`${bx + dx},${by + dy}`);
          if (!list) continue;
          for (const it of list) {
            if (it.detPos !== detPos) continue;
            if (-mdot(p1, it.p1) < 1 + 1e-6 && -mdot(p2, it.p2) < 1 + 1e-6) return true;
          }
        }
      }
      const key = `${bx},${by}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ detPos, p1, p2 });
      return false;
    };

    const heap = [];
    const pushHeap = (node) => {
      heap.push(node);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].score <= heap[i].score) break;
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
        const n = heap.length;
        while (true) {
          let m = i;
          const l = 2 * i + 1;
          const r = 2 * i + 2;
          if (l < n && heap[l].score < heap[m].score) m = l;
          if (r < n && heap[r].score < heap[m].score) m = r;
          if (m === i) break;
          const tmp = heap[i];
          heap[i] = heap[m];
          heap[m] = tmp;
          i = m;
        }
      }
      return top;
    };

    const pulled = pullFrameInOld(transformFrame(Mstart, baseF));
    let curM = frameMap(baseF, pulled.frame);
    let greedyMask = pulled.mask;
    let curP1 = normTime(apply3(curM, testPt1));
    let curD = -mdot(curP1, testPt1);

    const curP2 = normTime(apply3(curM, testPt2));
    if (
      det3(curM) > 0 &&
      -mdot(curP1, testPt1) < 1 + 1e-4 &&
      -mdot(curP2, testPt2) < 1 + 1e-4
    ) {
      return { ok: true, mask: greedyMask };
    }

    isSeenAndMark(curM, curP1, curP2);
    pushHeap({
      M: curM,
      mask: greedyMask,
      score: curD,
      p1: curP1,
      p2: curP2
    });

    const maxM22 = Math.max(50000, curM[2][2] * 8);
    let pops = 0;
    let bestPosDet = null;
    let bestPosScore = Infinity;
    while (heap.length > 0 && pops < 12000) {
      const cur = popHeap();
      pops++;
      const s1 = -mdot(cur.p1, testPt1);
      const s2 = -mdot(cur.p2, testPt2);
      const dPos = det3(cur.M) > 0;
      if (dPos && s1 < 1 + 1e-4 && s2 < 1 + 1e-4) {
        return { ok: true, mask: cur.mask };
      }
      if (dPos && s1 + s2 < bestPosScore) {
        bestPosScore = s1 + s2;
        bestPosDet = cur;
      }
      for (let gi = 0; gi < oldGens.length; gi++) {
        let M2 = mul3(oldGens[gi].M, cur.M);
        if (M2[2][2] > maxM22) continue;
        if (lorentzError(M2) > 1e-5) M2 = reorthonormalizeLorentz(M2);
        const p1 = normTime(apply3(M2, testPt1));
        const p2 = normTime(apply3(M2, testPt2));
        if (!isSeenAndMark(M2, p1, p2)) {
          pushHeap({
            M: M2,
            mask: cur.mask ^ oldMasks[gi],
            score: -mdot(p1, testPt1),
            p1,
            p2
          });
        }
      }
    }
    if (bestPosDet && -mdot(bestPosDet.p1, testPt1) < 1 + 5e-4 && -mdot(bestPosDet.p2, testPt2) < 1 + 5e-4) {
      return { ok: true, mask: bestPosDet.mask };
    }
    return { ok: false, mask: 0 };
  };

  const genColorMasks = new Array(newReal.gens.length).fill(0);
  const mirrorAnchor = (n) => normTime([n[0] * n[2], n[1] * n[2], 1 + n[2] * n[2]]);
  const reduceGeoFallback = (g) => {
    if (g.cuffFrame) {
      let curF = nearestFrameToOrigin(transformFrame(invQ, g.cuffFrame));
      let curD = -mdot(curF.P, testPt1);
      for (let step = 0; step < 15 && curD > 2.2; step++) {
        let bestF = null;
        let bestD = curD;
        for (let oi = 0; oi < oldGens.length; oi++) {
          const cf = nearestFrameToOrigin(transformFrame(oldGens[oi].M, curF));
          const d = -mdot(cf.P, testPt1);
          if (d < bestD * 0.95 - 1e-2) {
            bestD = d;
            bestF = cf;
          }
        }
        if (!bestF) break;
        curF = bestF;
        curD = bestD;
      }
      return transMatrixAlong(curF, g.cuffEll);
    }
    if (g.conePoint) {
      let curP = normTime(apply3(invQ, g.conePoint));
      let angle = g.coneAngle;
      let curD = -mdot(curP, testPt1);
      for (let step = 0; step < 15 && curD > 2.2; step++) {
        let bestP = null;
        let bestOi = -1;
        let bestD = curD;
        for (let oi = 0; oi < oldGens.length; oi++) {
          const cp = normTime(apply3(oldGens[oi].M, curP));
          const d = -mdot(cp, testPt1);
          if (d < bestD * 0.95 - 1e-2) {
            bestD = d;
            bestP = cp;
            bestOi = oi;
          }
        }
        if (!bestP) break;
        curP = bestP;
        curD = bestD;
        if (det3(oldGens[bestOi].M) < 0) angle = -angle;
      }
      return rotMatrixAt(curP, angle);
    }
    if (g.normal) {
      let curN = normSpace(apply3(invQ, g.normal));
      let curD = -mdot(mirrorAnchor(curN), testPt1);
      for (let step = 0; step < 15 && curD > 2.2; step++) {
        let bestN = null;
        let bestD = curD;
        for (let oi = 0; oi < oldGens.length; oi++) {
          const cn = normSpace(apply3(oldGens[oi].M, curN));
          const d = -mdot(mirrorAnchor(cn), testPt1);
          if (d < bestD * 0.95 - 1e-2) {
            bestD = d;
            bestN = cn;
          }
        }
        if (!bestN) break;
        curN = bestN;
        curD = bestD;
      }
      return reflMatrix(curN);
    }
    return null;
  };

  for (let gi = 0; gi < newReal.gens.length; gi++) {
    const g = newReal.gens[gi];
    if (g.handleFrom && g.handleTo) {
      const p1 = pullFrameInOld(transformFrame(invQ, g.handleFrom));
      const p2 = pullFrameInOld(transformFrame(invQ, g.handleTo));
      const gSmall = frameMap(p1.frame, p2.frame);
      let hRes = evalOldQuotientMask(gSmall);
      if (!hRes.ok) hRes = evalOldQuotientMask(invLorentz(gSmall));
      if (hRes.ok) {
        genColorMasks[gi] = hRes.mask ^ p1.mask ^ p2.mask;
        continue;
      }
    }
    if (g.cuffFrame) {
      const fFrom = nearestFrameToOrigin(transformFrame(invQ, g.cuffFrame));
      const fTo = slideFrame(fFrom, g.cuffEll);
      const p1 = pullFrameInOld(fFrom);
      const p2 = pullFrameInOld(fTo);
      const gSmall = frameMap(p1.frame, p2.frame);
      let cRes = evalOldQuotientMask(gSmall);
      if (!cRes.ok) cRes = evalOldQuotientMask(invLorentz(gSmall));
      if (cRes.ok) {
        genColorMasks[gi] = cRes.mask ^ p1.mask ^ p2.mask;
        continue;
      }
    }
    let gOld;
    if (g.cuffFrame) {
      gOld = transMatrixAlong(transformFrame(invQ, g.cuffFrame), g.cuffEll);
    } else if (g.conePoint) {
      gOld = rotMatrixAt(normTime(apply3(invQ, g.conePoint)), g.coneAngle);
    } else if (g.normal) {
      gOld = reflMatrix(normSpace(apply3(invQ, g.normal)));
    } else {
      gOld = mul3(invQ, mul3(g.M, Q));
      if (lorentzError(gOld) > 1e-5) gOld = reorthonormalizeLorentz(gOld);
    }
    let res = { ok: false, mask: 0 };
    if (gOld[2][2] <= 500) {
      res = evalOldQuotientMask(gOld);
      if (!res.ok) res = evalOldQuotientMask(invLorentz(gOld));
    }
    if (!res.ok) {
      const gConj = reduceGeoFallback(g);
      if (gConj) {
        res = evalOldQuotientMask(gConj);
        if (!res.ok) res = evalOldQuotientMask(invLorentz(gConj));
      } else if (gOld[2][2] > 500) {
        res = evalOldQuotientMask(gOld);
        if (!res.ok) res = evalOldQuotientMask(invLorentz(gOld));
      }
    }
    if (!res.ok) {
      return { ...newReal.quotient, exactTransferred: false };
    }
    genColorMasks[gi] = res.mask;
  }

  return {
    genColorMasks,
    quotientSize: oldQ.quotientSize,
    exactTransferred: true
  };
}

function recutMirrorLoop(mlOld, orbLoop, newCutsForLoop, T_slot_candidates = null) {
  const n = orbLoop.corners.length;
  const arcCuts = newCutsForLoop.filter((c) => c.kind === "mirror-arc");

  if (!T_slot_candidates) {
    const W = mlOld.walls;
    if (!W || W.some((w) => !w)) return { ok: false };
    const span = new Map();
    orbLoop.corners.forEach((c, k) => span.set(c.id, { start: k, end: k }));
    let ring = orbLoop.corners.map((c) => c.id);
    for (const mCut of arcCuts) {
      const [u, v] = mCut.pair || [];
      let idx = -1;
      for (let i = 0; i < ring.length; i++) {
        if (ring[i] === u && ring[(i + 1) % ring.length] === v) {
          idx = i;
          break;
        }
      }
      if (idx === -1) return { ok: false };
      const su = span.get(u);
      const sv = span.get(v);
      const val = -mdot(W[(su.start - 1 + n) % n], W[sv.end]);
      if (!(val > 1 + 1e-7)) return { ok: false };
      mCut.length = Math.acosh(val);
      span.set(mCut.id, { start: su.start, end: sv.end });
      if (idx + 1 < ring.length) {
        ring.splice(idx, 2, mCut.id);
      } else {
        ring = [mCut.id, ...ring.slice(1, ring.length - 1)];
      }
    }
    return { ok: true };
  }

  const slotCut = newCutsForLoop.find((c) => c.kind === "cone-mirror-arc" || c.kind === "bridge-arc");
  if (!slotCut) return { ok: false };
  if (!mlOld.slotLeftWall || !mlOld.slotRightWall) return { ok: false };

  let bestT = null;
  let bestDot = -Infinity;
  for (const cand of T_slot_candidates) {
    if (!cand) continue;
    for (const T of [cand, invLorentz(cand)]) {
      const d = mdot(normSpace(apply3(T, mlOld.slotLeftWall)), mlOld.slotRightWall);
      if (d > bestDot) {
        bestDot = d;
        bestT = T;
      }
    }
  }
  if (!bestT || bestDot < 0.999) return { ok: false };

  const T_inv = invLorentz(bestT);
  const oldSlot = mlOld.slotIdx;
  const base = new Array(n + 1);
  base[0] = mlOld.slotRightWall;
  for (let pos = 1; pos < n; pos++) {
    const w = mlOld.walls[(oldSlot + pos) % n];
    if (!w) return { ok: false };
    base[pos] = w;
  }
  base[n] = mlOld.slotLeftWall;

  const liftWall = (j) => {
    const q = Math.floor(j / n);
    let w = base[j % n];
    for (let t = 0; t < q; t++) w = normSpace(apply3(T_inv, w));
    return w;
  };

  const newSlot = orbLoop.corners.findIndex((c) => c.id === slotCut.pair[0]);
  if (newSlot === -1) return { ok: false };
  const delta = (newSlot - oldSlot + n) % n;
  const U = new Array(n + 1);
  for (let k = 0; k <= n; k++) U[k] = liftWall(delta + k);

  const valSlot = -mdot(U[n], U[0]);
  if (!(valSlot > 1 + 1e-7)) return { ok: false };
  slotCut.length = Math.acosh(valSlot);

  // Build slotted ring starting with slotCut followed by remaining corners in cyclic order
  const ring0 = [slotCut.id];
  for (let k = 1; k <= n; k++) ring0.push(orbLoop.corners[(newSlot + k) % n].id);
  const posRange = new Map();
  ring0.forEach((id, r) => posRange.set(id, { startPos: r, endPos: r }));
  let ring = [...ring0];
  const L = n + 1;

  for (const mCut of arcCuts) {
    const [u, v] = mCut.pair || [];
    let idx = -1;
    for (let i = 0; i < ring.length; i++) {
      if (ring[i] === u && ring[(i + 1) % ring.length] === v) {
        idx = i;
        break;
      }
    }
    if (idx === -1) return { ok: false };
    const su = posRange.get(u);
    const sv = posRange.get(v);
    const val = -mdot(U[(su.startPos - 1 + L) % L], U[sv.endPos]);
    if (!(val > 1 + 1e-7)) return { ok: false };
    mCut.length = Math.acosh(val);
    posRange.set(mCut.id, { startPos: su.startPos, endPos: sv.endPos });
    if (idx + 1 < ring.length) {
      ring.splice(idx, 2, mCut.id);
    } else {
      ring = [mCut.id, ...ring.slice(1, ring.length - 1)];
    }
  }

  return { ok: true, U, T_slot: bestT, oldSlot, newSlot, delta };
}

function shiftCuffFrameFromBridge(mlOld, U) {
  const S1_old = normSpace(sub3(mlOld.slotRightWall, mlOld.slotLeftWall));
  const S1_new = normSpace(sub3(U[0], U[mlOld.nCorners]));
  const F = mlOld.cuffFrame;
  const sOf = (S1) => {
    const den = mdot(F.T, S1);
    if (Math.abs(den) < 1e-12) return 0;
    const ratio = Math.max(-0.999999999, Math.min(0.999999999, -mdot(F.P, S1) / den));
    return Math.atanh(ratio);
  };
  return slideFrame(F, sOf(S1_new) - sOf(S1_old));
}

function matL1Diff(A, B) {
  let err = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) err += Math.abs(A[i][j] - B[i][j]);
  }
  return err;
}

function matL1Norm(A) {
  let nrm = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) nrm += Math.abs(A[i][j]);
  }
  return nrm;
}

function axisOfLorentz(G, feat, pointHint = null) {
  if (feat.kind === "cone") return normTime(pointHint);
  // Anti-symmetric part of eta * G extracts the invariant spacelike translation axis
  const Geta = [
    [G[0][0], G[0][1], G[0][2]],
    [G[1][0], G[1][1], G[1][2]],
    [-G[2][0], -G[2][1], -G[2][2]]
  ];
  const S01 = Geta[0][1] - Geta[1][0];
  const S02 = Geta[0][2] - Geta[2][0];
  const S12 = Geta[1][2] - Geta[2][1];
  return normSpace([S12, -S02, S01]);
}

function solvePantFromMatrices(Gslots, ordered, H, conePoints) {
  const axes = [0, 1, 2].map((k) => axisOfLorentz(Gslots[k], ordered[k], conePoints[k]));
  const baseW = [
    normSpace(mcross(axes[1], axes[2])),
    normSpace(mcross(axes[2], axes[0])),
    normSpace(mcross(axes[0], axes[1]))
  ];
  const triples = [
    [1, 2, 0],
    [2, 0, 1],
    [0, 1, 2]
  ];
  let k0 = 0;
  for (let k = 1; k < 3; k++) {
    if (H.features[k].C < H.features[k0].C) k0 = k;
  }
  const [a, b, opp] = triples[k0];
  const localF =
    H.features[k0].kind === "corner"
      ? frameFromCornerWalls(H.S[a], H.S[b])
      : H.features[k0].frame;

  let bestM = null;
  let bestErr = Infinity;
  for (const s0 of [-1, 1]) {
    for (const s1 of [-1, 1]) {
      for (const s2 of [-1, 1]) {
        const W = [scale3(baseW[0], s0), scale3(baseW[1], s1), scale3(baseW[2], s2)];
        let dotOk = true;
        for (let k = 0; k < 3; k++) {
          const [ka, kb] = triples[k];
          if (Math.abs(mdot(W[ka], W[kb]) + H.features[k].C) > 2e-2 * (1 + H.features[k].C)) {
            dotOk = false;
            break;
          }
        }
        if (!dotOk) continue;

        let worldF;
        if (H.features[k0].kind === "corner") {
          worldF = frameFromCornerWalls(W[a], W[b]);
        } else {
          let wE = normSpace(mcross(W[a], W[b]));
          if (mdot(wE, W[opp]) > 0) wE = neg3(wE);
          const wP0 = normTime(mcross(W[a], wE));
          const wP1 = normTime(mcross(wE, W[b]));
          const wT = normSpace(add3(wP1, scale3(wP0, mdot(wP0, wP1))));
          const wN = neg3(wE);
          worldF = { P: wP0, T: wT, N: wN };
        }

        const M = frameMap(localF, worldF);
        if (det3(M) <= 0 || M[2][2] <= 0.5) continue;
        const Mr = reorthonormalizeLorentz(M);
        if (lorentzError(Mr) > 1e-3) continue;

        let err = 0;
        for (let k = 0; k < 3; k++) {
          if (ordered[k].kind === "cone") {
            const mp = normTime(apply3(Mr, H.features[k].V));
            const Gk = rotMatrixAt(mp, -(2 * Math.PI) / ordered[k].order);
            err += matL1Diff(Gk, Gslots[k]) / (1 + matL1Norm(Gslots[k]));
            err += hypDist(mp, axes[k]);
          } else {
            const wf = transformFrame(Mr, H.features[k].frame);
            const Gk = transMatrixAlong(wf, 2 * H.features[k].length);
            err += matL1Diff(Gk, Gslots[k]) / (1 + matL1Norm(Gslots[k]));
          }
        }
        if (err < bestErr) {
          bestErr = err;
          bestM = Mr;
        }
      }
    }
  }
  if (!bestM || bestErr >= 1e-3) return null;
  return { M: bestM, err: bestErr };
}

function extractPantsTreePlan(orb, carving) {
  const pieceById = new Map(carving.pieces.map((p) => [p.id, p]));
  const cutById = new Map(carving.cuts.map((c) => [c.id, c]));
  const nodes = [];
  const rootPiece = pieceById.get(carving.rootId);

  const leafIdsOf = (piece, incomingCutId = null) => {
    if (piece.degenerate) {
      const cones = piece.features.filter((f) => f.kind === "cone").map((f) => f.id);
      nodes.push({ piece, ordered: [...piece.features], isRoot: false, incomingCutId, slotLeaves: [null, null, null] });
      return cones;
    }

    const feats = [...piece.features];
    const incomingMatch = (f) => incomingCutId && f.kind === "cut" && f.cutId === incomingCutId;
    let ordered = [...feats];
    if (incomingCutId) {
      const incIdx = ordered.findIndex(incomingMatch);
      if (incIdx > 0) {
        const tmp = ordered[0];
        ordered[0] = ordered[incIdx];
        ordered[incIdx] = tmp;
      }
      if (ordered[1].kind === "cone" && ordered[2].kind !== "cone") {
        const tmp = ordered[1];
        ordered[1] = ordered[2];
        ordered[2] = tmp;
      }
    } else {
      const coneIdx = ordered.findIndex((f) => f.kind === "cone");
      if (coneIdx !== -1 && coneIdx !== 2) {
        const tmp = ordered[2];
        ordered[2] = ordered[coneIdx];
        ordered[coneIdx] = tmp;
      }
    }

    const slotLeaves = [[], [], []];
    for (let slot = 0; slot < 3; slot++) {
      const f = ordered[slot];
      const isIncoming = slot === 0 && incomingCutId !== null;
      if (isIncoming) continue;
      if (f.kind === "cut") {
        const child = carving.pieces.find((q) => q.id !== piece.id && q.features?.some((x) => x.kind === "cut" && x.cutId === f.cutId));
        slotLeaves[slot] = leafIdsOf(child, f.cutId);
      } else {
        slotLeaves[slot] = [f.id];
      }
    }
    const isRoot = incomingCutId === null;
    nodes.push({ piece, ordered, isRoot, incomingCutId, slotLeaves });
    return isRoot ? [...slotLeaves[0], ...slotLeaves[2], ...slotLeaves[1]] : [...slotLeaves[2], ...slotLeaves[1]];
  };

  const targetOrder = leafIdsOf(rootPiece, null);
  return { targetOrder, nodes, cutById };
}

function rotPiPoint(Q, P) {
  return normTime(add3(neg3(P), scale3(Q, -2 * mdot(P, Q))));
}

function prodTwoCones2(P0, P1) {
  const ell = 2 * hypDist(P0, P1);
  if (ell < 1e-12) return { G: ID3, ell: 0 };
  const T = normSpace(add3(P0, scale3(P1, mdot(P1, P0))));
  const N = normSpace(mcross(P1, T));
  return { G: transMatrixAlong({ P: P1, T, N }, ell), ell };
}

function cloneHandleGluings(src) {
  return new Map(
    [...src.entries()].map(([hIdx, e]) => [
      hIdx,
      {
        ...e,
        Gh: e.Gh.map((r) => [...r]),
        from: e.from ? { P: [...e.from.P], T: [...e.from.T], N: [...e.from.N] } : null,
        to: e.to ? { P: [...e.to.P], T: [...e.to.T], N: [...e.to.N] } : null
      }
    ])
  );
}

function stepHandleEntry(hEntry, side, K, Kinv) {
  if (!hEntry) return;
  if (hEntry.from && hEntry.to) {
    if (side === "+") hEntry.from = transformFrame(K, hEntry.from);
    else hEntry.to = transformFrame(K, hEntry.to);
    hEntry.Gh = frameMap(hEntry.from, hEntry.to);
  } else {
    let Gh = side === "+" ? mul3(hEntry.Gh, Kinv) : mul3(K, hEntry.Gh);
    if (lorentzError(Gh) > 1e-4) Gh = reorthonormalizeLorentz(Gh);
    hEntry.Gh = Gh;
  }
}

function hurwitzBraidToOrder(initCycle, initHandleGluings, targetOrder, mode = "right") {
  const cycle = initCycle.map((l) => ({
    ...l,
    G: l.G.map((r) => [...r]),
    P: l.P ? [...l.P] : null,
    frame: l.frame ? { P: [...l.frame.P], T: [...l.frame.T], N: [...l.frame.N] } : null,
    conjM: l.conjM ? l.conjM.map((r) => [...r]) : ID3.map((r) => [...r])
  }));
  const handleGluings = cloneHandleGluings(initHandleGluings);

  const conjLeaf = (leaf, K, kCone2P = null) => {
    const Kinv = invLorentz(K);
    const P = leaf.P ? (kCone2P ? rotPiPoint(kCone2P, leaf.P) : normTime(apply3(K, leaf.P))) : null;
    const frame = leaf.frame ? transformFrame(K, leaf.frame) : null;
    let G;
    if (leaf.kind === "cone" && P) {
      G = rotMatrixAt(P, -(2 * Math.PI) / leaf.order);
    } else if (frame && leaf.length) {
      G = transMatrixAlong(frame, leaf.length);
    } else {
      G = mul3(K, mul3(leaf.G, Kinv));
      if (lorentzError(G) > 1e-4) G = reorthonormalizeLorentz(G);
    }
    let conjM = mul3(K, leaf.conjM);
    if (lorentzError(conjM) > 1e-4) conjM = reorthonormalizeLorentz(conjM);
    const out = {
      ...leaf,
      G,
      P,
      frame,
      conjM
    };
    if (leaf.kind === "handle-end") {
      stepHandleEntry(handleGluings.get(leaf.handleIndex), leaf.side, K, Kinv);
    }
    return out;
  };

  const swapRight = (i) => {
    const A = cycle[i];
    const B = cycle[i + 1];
    const K = invLorentz(B.G);
    const kCone2P = B.kind === "cone" && B.order === 2 ? B.P : null;
    cycle[i] = B;
    cycle[i + 1] = conjLeaf(A, K, kCone2P);
  };

  const swapLeft = (i) => {
    const A = cycle[i];
    const B = cycle[i + 1];
    const K = A.G;
    const kCone2P = A.kind === "cone" && A.order === 2 ? A.P : null;
    cycle[i] = conjLeaf(B, K, kCone2P);
    cycle[i + 1] = A;
  };

  // Cyclically rotate so targetOrder[0] starts at index 0 with zero conjugation needed
  const rotIdx = cycle.findIndex((l) => l.id === targetOrder[0]);
  if (rotIdx === -1) return null;
  if (rotIdx > 0) {
    const head = cycle.splice(0, rotIdx);
    cycle.push(...head);
  }

  for (let t = 0; t < targetOrder.length; t++) {
    const desiredId = targetOrder[t];
    const pos = cycle.findIndex((l) => l.id === desiredId);
    if (pos === -1) return null;
    let cur = pos;
    while (cur > t) {
      let useRight;
      if (mode === "right") {
        useRight = true;
      } else if (mode === "left") {
        useRight = false;
      } else {
        const A = cycle[cur - 1];
        const B = cycle[cur];
        const tR = A.P
          ? B.kind === "cone" && B.order === 2 && B.P
            ? rotPiPoint(B.P, A.P)[2]
            : normTime(apply3(invLorentz(B.G), A.P))[2]
          : mul3(invLorentz(B.G), mul3(A.G, B.G))[2][2];
        const tL = B.P
          ? A.kind === "cone" && A.order === 2 && A.P
            ? rotPiPoint(A.P, B.P)[2]
            : normTime(apply3(A.G, B.P))[2]
          : mul3(A.G, mul3(B.G, invLorentz(A.G)))[2][2];
        useRight = tR <= tL;
      }
      if (useRight) swapRight(cur - 1);
      else swapLeft(cur - 1);
      cur--;
    }
  }

  return { cycle, handleGluings };
}

function carryDirichletAcrossRecut(oldReal, newReal, Q) {
  const oldPoly = oldReal?.dirichletPoly;
  const oldBase = oldReal?.dirichletBase;
  const oldSideGens = oldPoly?.sideGens;
  if (!oldPoly || !oldBase || !oldSideGens || oldSideGens.length === 0) {
    return null;
  }
  const cleanH = (M) => (M[2][2] <= 500 ? reorthonormalizeLorentz(M) : M);
  let T = cleanH(Q);
  let curT = normTime(apply3(T, oldBase))[2];
  let detFlip = 0;
  for (let step = 0; step < 64; step++) {
    let bestT = curT;
    let bestNext = null;
    let bestG = null;
    for (let gi = 0; gi < oldSideGens.length; gi++) {
      const g = oldSideGens[gi];
      const candM = mul3(T, g.M);
      const candPt = normTime(apply3(candM, oldBase));
      if (candPt[2] < bestT - 1e-6) {
        bestT = candPt[2];
        bestNext = candM;
        bestG = g;
      }
    }
    if (!bestG) break;
    T = cleanH(bestNext);
    curT = bestT;
    if (det3(bestG.M) < 0) detFlip ^= 1;
  }
  T = cleanH(T);
  const Tinv = invLorentz(T);

  const carriedVerts = oldPoly.vertsH.map((v) => normTime(apply3(T, v)));
  const carriedNormals = oldPoly.sideOutNormals.map((n) => normSpace(apply3(T, n)));
  const carriedPoly = buildPolyRecord(carriedVerts, carriedNormals, "dirichlet", "dirichlet", 0);
  carriedPoly.centroid = normTime(apply3(T, oldPoly.centroid));
  carriedPoly.sideGens = oldSideGens.map((sg) => ({
    ...sg,
    M: cleanH(mul3(T, mul3(sg.M, Tinv))),
    word: null
  }));
  const srcMarkers = oldPoly.markers?.length ? oldPoly.markers : oldReal.markers || [];
  carriedPoly.markers = srcMarkers.map((mk) => ({
    ...mk,
    P: normTime(apply3(T, mk.P))
  }));

  newReal.dirichletBase = normTime(apply3(T, oldBase));
  newReal.dirichletPoly = carriedPoly;
  newReal.pullColorXor = 0;
  newReal.pullDetFlip = detFlip;
  return { T, invT: Tinv, colorXor: 0, detFlip };
}

/**
 * Compute an exact stationary hyperbolic re-cut onto `newCarvingTemplate` keeping
 * the underlying orbifold tiling, markers, Dirichlet cells, and Z_2^2 colors fixed.
 */
export function recutHyperbolic(orb, oldCarving, oldReal, newCarvingTemplate) {
  const newCarving = {
    ...newCarvingTemplate,
    cuts: newCarvingTemplate.cuts.map((c) => ({ ...c, pair: c.pair ? [...c.pair] : null })),
    pieces: newCarvingTemplate.pieces || [],
    steps: newCarvingTemplate.steps || []
  };
  const oldCutById = new Map(oldCarving.cuts.map((c) => [c.id, c]));

  if (orb.mode === "rigid" || orb.teichDim === 0) {
    const newReal0 = buildRealization(orb, newCarving, { dirichletBase: oldReal.dirichletBase });
    newReal0.quotient = transferQuotientAcrossRecut(oldReal, newReal0, ID3);
    return { carving: newCarving, realization: newReal0, Q: ID3, invQ: ID3, colorXor: 0 };
  }

  if (orb.mode === "mirror-poly") {
    const mlOld = oldReal.topoMeta?.mirrorLoops?.[0];
    if (!mlOld || !recutMirrorLoop(mlOld, orb.mirrorLoops[0], newCarving.cuts, null).ok) {
      return null;
    }
    const newReal0 = buildRealization(orb, newCarving);
    const mlNew = newReal0.topoMeta.mirrorLoops[0];
    const fOld = frameFromCornerWalls(mlOld.walls[mlOld.nCorners - 1], mlOld.walls[0]);
    const fNew = frameFromCornerWalls(mlNew.walls[mlNew.nCorners - 1], mlNew.walls[0]);
    const Q = reorthonormalizeLorentz(frameMap(fOld, fNew));
    const invQ = invLorentz(Q);
    newReal0.quotient = transferQuotientAcrossRecut(oldReal, newReal0, Q);
    return { carving: newCarving, realization: newReal0, Q, invQ, colorXor: 0 };
  }

  if (orb.mode === "cone-mirror") {
    const mlOld = oldReal.topoMeta?.mirrorLoops?.[0];
    const cmOld = oldReal.topoMeta?.coneMirror;
    if (!mlOld || !cmOld) return null;
    const loopRes = recutMirrorLoop(mlOld, orb.mirrorLoops[0], newCarving.cuts, [cmOld.rot]);
    if (!loopRes.ok) return null;
    const newReal0 = buildRealization(orb, newCarving, { skipDirichletBuild: true });
    const mlNew = newReal0.topoMeta.mirrorLoops[0];
    const cmNew = newReal0.topoMeta.coneMirror;
    const fOld = frameFromOriginAndWall(cmOld.conePoint, loopRes.U[mlOld.nCorners]);
    const fNew = frameFromOriginAndWall(cmNew.conePoint, mlNew.slotLeftWall);
    const Q = reorthonormalizeLorentz(frameMap(fOld, fNew));
    const invQ = invLorentz(Q);

    const hasCarriedDir = Boolean(oldReal.dirichletPoly?.sideGens?.length && oldReal.dirichletBase);
    const mappedBase = oldReal.dirichletBase ? normTime(apply3(Q, oldReal.dirichletBase)) : null;
    const newReal = buildRealization(orb, newCarving, {
      dirichletBase: mappedBase,
      skipDirichletBuild: hasCarriedDir
    });
    newReal.quotient = transferQuotientAcrossRecut(oldReal, newReal, Q);
    let colorXor = 0;
    let detFlip = 0;
    let retQ = Q;
    let retInvQ = invQ;
    const carried = hasCarriedDir ? carryDirichletAcrossRecut(oldReal, newReal, Q) : null;
    if (carried) {
      retQ = carried.T;
      retInvQ = carried.invT;
      colorXor = carried.colorXor;
      detFlip = carried.detFlip;
    } else if (mappedBase) {
      const wrapped = wrapPointIntoTileI(mappedBase, newReal.fdPolygons, newReal.gens, newReal.quotient.genColorMasks);
      newReal.pullColorXor = wrapped.colorXor;
      newReal.pullDetFlip = wrapped.detFlip || 0;
      colorXor = wrapped.colorXor;
      detFlip = wrapped.detFlip || 0;
    }
    return { carving: newCarving, realization: newReal, Q: retQ, invQ: retInvQ, colorXor, detFlip };
  }

  // Copy invariant boundary cut lengths from oldCarving
  for (const c of newCarving.cuts) {
    if (c.kind === "handle" || c.kind === "crosscap" || c.kind === "smooth-mirror" || c.kind === "collar") {
      const match = oldCarving.cuts.find(
        (oc) => oc.kind === c.kind && oc.targetId === c.targetId && oc.loopIndex === c.loopIndex
      );
      if (match) {
        c.length = match.length;
        c.twistTurns = match.twistTurns;
      }
    }
  }

  const pairCuts = newCarving.cuts.filter((c) => c.kind === "pair");
  let Q = ID3;

  if (orb.mode === "collar-pair" || pairCuts.length === 0) {
    // Re-cut internal mirror loops & update collar twist / pant M directly
    const shiftedCuffFrames = new Map();
    for (let li = 0; li < orb.mirrorLoops.length; li++) {
      const ml = orb.mirrorLoops[li];
      if (ml.corners.length === 0) continue;
      const mlOld = oldReal.topoMeta.mirrorLoops[li];
      if (ml.corners.length === 1) {
        shiftedCuffFrames.set(li, mlOld.cuffFrame);
        continue;
      }
      const loopCuts = newCarving.cuts.filter((c) => c.loopIndex === li);
      const loopRes = recutMirrorLoop(mlOld, ml, loopCuts, [mlOld.hcuff]);
      if (!loopRes.ok) return null;
      shiftedCuffFrames.set(li, shiftCuffFrameFromBridge(mlOld, loopRes.U));
    }

    if (orb.mode === "pants") {
      // One pant (nTop === 3), only mirror loops reshuffled; update collar twists from shifted cuffs
      for (const [li, newCuffF] of shiftedCuffFrames) {
        const mlOld = oldReal.topoMeta.mirrorLoops[li];
        const colCut = newCarving.cuts.find((c) => c.kind === "collar" && c.loopIndex === li);
        const oldCol = oldCarving.cuts.find((c) => c.id === colCut?.id);
        if (!colCut || !oldCol) continue;
        const ell = mlOld.cuffLength;
        const deltaS = signedFrameParamOfPoint(mlOld.cuffFrame, newCuffF.P);
        colCut.twistTurns = wrapHalfTurns(oldCol.twistTurns - (ell ? deltaS / ell : 0));
      }
      const newReal0 = buildRealization(orb, newCarving);
      if (oldReal.topoMeta.rootPantWorldM && newReal0.topoMeta.rootPantWorldM) {
        Q = reorthonormalizeLorentz(mul3(newReal0.topoMeta.rootPantWorldM, invLorentz(oldReal.topoMeta.rootPantWorldM)));
      } else {
        const refLi = shiftedCuffFrames.has(0) ? 0 : [...shiftedCuffFrames.keys()][0];
        if (refLi !== undefined) {
          Q = reorthonormalizeLorentz(frameMap(shiftedCuffFrames.get(refLi), newReal0.topoMeta.mirrorLoops[refLi].cuffFrame));
        }
      }
    } else {
      // collar-pair: if shared collar exists, update its twistTurns between loops 0 and 1
      const sharedCol = newCarving.cuts.find((c) => c.kind === "collar" && c.targetId === "shared-collar");
      const oldShared = oldCarving.cuts.find((c) => c.kind === "collar" && c.targetId === "shared-collar");
      const refLi = shiftedCuffFrames.has(0) ? 0 : 1;
      if (sharedCol && oldShared && shiftedCuffFrames.has(0) && shiftedCuffFrames.has(1)) {
        const ell = sharedCol.length;
        const f0 = shiftedCuffFrames.get(0);
        const f1 = shiftedCuffFrames.get(1);
        const s01 = signedFrameParamOfPoint(f0, f1.P);
        sharedCol.twistTurns = wrapHalfTurns((ell ? s01 / ell : 0) - 1);
      }
      const newReal0 = buildRealization(orb, newCarving);
      const oldF = shiftedCuffFrames.get(refLi);
      const newF = newReal0.topoMeta.mirrorLoops[refLi].cuffFrame;
      Q = reorthonormalizeLorentz(frameMap(oldF, newF));
    }
  } else {
    // orb.mode === "pants" with pairCuts.length >= 1
    // First re-cut any cornered mirror loops so their shifted cuff frames (in pre-braid world) are known
    const shiftedCuffInOld = new Map();
    for (let li = 0; li < orb.mirrorLoops.length; li++) {
      const ml = orb.mirrorLoops[li];
      if (ml.corners.length === 0) continue;
      const mlOld = oldReal.topoMeta.mirrorLoops[li];
      if (ml.corners.length === 1) {
        shiftedCuffInOld.set(li, mlOld.cuffFrame);
      } else {
        const loopCuts = newCarving.cuts.filter((c) => c.loopIndex === li);
        const loopRes = recutMirrorLoop(mlOld, ml, loopCuts, [mlOld.hcuff]);
        if (!loopRes.ok) return null;
        shiftedCuffInOld.set(li, shiftCuffFrameFromBridge(mlOld, loopRes.U));
      }
    }

    const plan = extractPantsTreePlan(orb, newCarving);
    const oldCycle = oldReal.topoMeta?.worldCycle;
    const oldHandles = oldReal.topoMeta?.handleGluings;
    if (!oldCycle || oldCycle.length !== plan.targetOrder.length) return null;

    const evalCandidate = (braided) => {
      const { cycle, handleGluings } = braided;
      const leafById = new Map(cycle.map((l) => [l.id, l]));
      const cutMats = new Map();
      const cutLens = new Map();
      let lenSum = 0;

      // Build child leaf list for each pair cut
      const childLeavesOfCut = new Map();
      for (const nd of plan.nodes) {
        if (!nd.incomingCutId) continue;
        const leaves = nd.piece.degenerate
          ? nd.ordered.filter((f) => f.kind === "cone").map((f) => f.id)
          : [...nd.slotLeaves[2], ...nd.slotLeaves[1]];
        childLeavesOfCut.set(nd.incomingCutId, leaves);
      }
      let maxErr = 0;
      for (const pCut of pairCuts) {
        const ids = childLeavesOfCut.get(pCut.id);
        if (ids.length === 2) {
          const l0 = leafById.get(ids[0]);
          const l1 = leafById.get(ids[1]);
          if (l0.kind === "cone" && l0.order === 2 && l0.P && l1.kind === "cone" && l1.order === 2 && l1.P) {
            const prod = prodTwoCones2(l0.P, l1.P);
            if (!(prod.ell > 1e-6)) return null;
            const cutLerr = lorentzError(prod.G);
            if (cutLerr > 1e-4) return null;
            if (cutLerr > maxErr) maxErr = cutLerr;
            cutMats.set(pCut.id, prod.G);
            cutLens.set(pCut.id, prod.ell);
            lenSum += prod.ell;
            continue;
          }
        }
        let G = ID3;
        let i = 0;
        while (i < ids.length) {
          const l0 = leafById.get(ids[i]);
          if (i + 1 < ids.length) {
            const l1 = leafById.get(ids[i + 1]);
            if (l0.kind === "cone" && l0.order === 2 && l0.P && l1.kind === "cone" && l1.order === 2 && l1.P) {
              G = mul3(G, prodTwoCones2(l0.P, l1.P).G);
              i += 2;
              continue;
            }
          }
          G = mul3(G, l0.G);
          i += 1;
        }
        const cutLerr = lorentzError(G);
        if (cutLerr > 1e-4) return null;
        if (cutLerr > maxErr) maxErr = cutLerr;
        const tr = G[0][0] + G[1][1] + G[2][2];
        if (!(tr > 3 + 1e-7)) return null;
        const ell = Math.acosh((tr - 1) / 2);
        cutMats.set(pCut.id, G);
        cutLens.set(pCut.id, ell);
        lenSum += ell;
      }

      const getFeatureLength = (f) => {
        if (f.kind === "cut") return cutLens.get(f.cutId);
        if (f.kind === "handle-end") {
          return newCarving.cuts.find((c) => c.kind === "handle" && c.targetId === `handle:${f.handleIndex}`).length;
        }
        if (f.kind === "crosscap-end") {
          return 2 * newCarving.cuts.find((c) => c.kind === "crosscap" && c.targetId === `crosscap:${f.crosscapIndex}`).length;
        }
        if (f.kind === "smooth-end") {
          return newCarving.cuts.find((c) => c.kind === "smooth-mirror" && c.loopIndex === f.loopIndex).length;
        }
        return newCarving.cuts.find((c) => c.kind === "collar" && c.loopIndex === f.loopIndex).length;
      };

      const pantFrames = new Map(); // pieceId -> { M, frames: [f0, f1, f2] }
      let rootPantM = null;
      const matOfSlot = (node, slot) => {
        if (slot === 0 && node.incomingCutId) {
          return invLorentz(cutMats.get(node.incomingCutId));
        }
        const f = node.ordered[slot];
        if (f.kind === "cut") return cutMats.get(f.cutId);
        return leafById.get(f.id).G;
      };

      for (const node of plan.nodes) {
        if (node.piece.degenerate) continue;
        const Cvals = node.ordered.map((f) =>
          f.kind === "cone" ? Math.cos(Math.PI / f.order) : Math.cosh(getFeatureLength(f) / 2)
        );
        const H = generalizedHexagon(Cvals[0], Cvals[1], Cvals[2]);
        const G0 = matOfSlot(node, 0);
        const G1 = matOfSlot(node, 1);
        const G2 = matOfSlot(node, 2);
        const conePts = node.ordered.map((f) => (f.kind === "cone" ? leafById.get(f.id).P : null));
        const solved = solvePantFromMatrices([G0, G1, G2], node.ordered, H, conePts);
        if (!solved) return null;
        if (solved.err > maxErr) maxErr = solved.err;

        const frames = [0, 1, 2].map((s) => {
          if (node.ordered[s].kind === "cone") return null;
          const lf =
            s === 0
              ? H.features[0].frame
              : s === 1
              ? slideFrame(H.features[1].frame, -getFeatureLength(node.ordered[s]) / 2)
              : H.features[2].frame;
          return transformFrame(solved.M, lf);
        });
        pantFrames.set(node.piece.id, { M: solved.M, frames, ordered: node.ordered });
        if (node.isRoot) rootPantM = solved.M;
      }

      return { lenSum, maxErr, cycle, handleGluings, leafById, cutLens, pantFrames, rootPantM };
    };

    const reduceCycleSeed = (baseCycle, baseHandles) => {
      const cyc = baseCycle.map((l) => ({
        ...l,
        G: l.G.map((r) => [...r]),
        P: l.P ? [...l.P] : null,
        frame: l.frame ? { P: [...l.frame.P], T: [...l.frame.T], N: [...l.frame.N] } : null,
        conjM: l.conjM ? l.conjM.map((r) => [...r]) : ID3.map((r) => [...r])
      }));
      const hMap = cloneHandleGluings(baseHandles);
      const conjOne = (leaf, K, kCone2P = null) => {
        const Kinv = invLorentz(K);
        const P = leaf.P ? (kCone2P ? rotPiPoint(kCone2P, leaf.P) : normTime(apply3(K, leaf.P))) : null;
        const frame = leaf.frame ? transformFrame(K, leaf.frame) : null;
        let G;
        if (leaf.kind === "cone" && P) {
          G = rotMatrixAt(P, -(2 * Math.PI) / leaf.order);
        } else if (frame && leaf.length) {
          G = transMatrixAlong(frame, leaf.length);
        } else {
          G = mul3(K, mul3(leaf.G, Kinv));
          if (lorentzError(G) > 1e-4) G = reorthonormalizeLorentz(G);
        }
        let conjM = mul3(K, leaf.conjM);
        if (lorentzError(conjM) > 1e-4) conjM = reorthonormalizeLorentz(conjM);
        if (leaf.kind === "handle-end") {
          stepHandleEntry(hMap.get(leaf.handleIndex), leaf.side, K, Kinv);
        }
        return { ...leaf, G, P, frame, conjM };
      };
      for (let iter = 0; iter < 40; iter++) {
        let bestMove = null;
        let bestGain = 1e-4;
        const nL = cyc.length;
        for (let i = 0; i < nL; i++) {
          const j = (i + 1) % nL;
          const A = cyc[i];
          const B = cyc[j];
          const KR = invLorentz(B.G);
          const gR = A.P
            ? B.kind === "cone" && B.order === 2 && B.P
              ? rotPiPoint(B.P, A.P)[2]
              : normTime(apply3(KR, A.P))[2]
            : mul3(KR, mul3(A.G, B.G))[2][2];
          const curA = A.P ? A.P[2] : A.G[2][2];
          if (curA - gR > bestGain) {
            bestGain = curA - gR;
            bestMove = { i, j, right: true, K: KR, kCone2P: B.kind === "cone" && B.order === 2 ? B.P : null };
          }
          const KL = A.G;
          const gL = B.P
            ? A.kind === "cone" && A.order === 2 && A.P
              ? rotPiPoint(A.P, B.P)[2]
              : normTime(apply3(KL, B.P))[2]
            : mul3(KL, mul3(B.G, invLorentz(KL)))[2][2];
          const curB = B.P ? B.P[2] : B.G[2][2];
          if (curB - gL > bestGain) {
            bestGain = curB - gL;
            bestMove = { i, j, right: false, K: KL, kCone2P: A.kind === "cone" && A.order === 2 ? A.P : null };
          }
        }
        if (!bestMove) break;
        const { i, j, right, K, kCone2P } = bestMove;
        if (right) {
          const movedA = conjOne(cyc[i], K, kCone2P);
          cyc[i] = cyc[j];
          cyc[j] = movedA;
        } else {
          const movedB = conjOne(cyc[j], K, kCone2P);
          cyc[j] = cyc[i];
          cyc[i] = movedB;
        }
      }
      return { cycle: cyc, handleGluings: hMap };
    };

    const seeds = [{ cycle: oldCycle, handleGluings: oldHandles }];
    if (oldCycle.length >= 5) {
      const baseSeeds = [seeds[0]];
      const reduced = reduceCycleSeed(oldCycle, oldHandles);
      let prod = ID3;
      for (const l of reduced.cycle) prod = mul3(prod, l.G);
      let prodErr = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          prodErr = Math.max(prodErr, Math.abs(prod[r][c] - ID3[r][c]));
        }
      }
      if (prodErr < 1e-4) {
        seeds.push(reduced);
        baseSeeds.push(reduced);
      }

      const blockProduct = (cyc, blockIndices) => {
        if (blockIndices.length === 2) {
          const l0 = cyc[blockIndices[0]];
          const l1 = cyc[blockIndices[1]];
          if (l0.kind === "cone" && l0.order === 2 && l0.P && l1.kind === "cone" && l1.order === 2 && l1.P) {
            return prodTwoCones2(l0.P, l1.P).G;
          }
        }
        let Gblk = ID3;
        let idx = 0;
        while (idx < blockIndices.length) {
          const l0 = cyc[blockIndices[idx]];
          if (idx + 1 < blockIndices.length) {
            const l1 = cyc[blockIndices[idx + 1]];
            if (l0.kind === "cone" && l0.order === 2 && l0.P && l1.kind === "cone" && l1.order === 2 && l1.P) {
              Gblk = mul3(Gblk, prodTwoCones2(l0.P, l1.P).G);
              if (lorentzError(Gblk) > 1e-4 && Gblk[2][2] <= 5000) Gblk = reorthonormalizeLorentz(Gblk);
              idx += 2;
              continue;
            }
          }
          Gblk = mul3(Gblk, l0.G);
          if (lorentzError(Gblk) > 1e-4 && Gblk[2][2] <= 5000) Gblk = reorthonormalizeLorentz(Gblk);
          idx += 1;
        }
        return Gblk;
      };

      const addBlockTwistSeeds = (baseSeed, blockIndices, shifts) => {
        let Gblk = blockProduct(baseSeed.cycle, blockIndices);
        const tr = Gblk[0][0] + Gblk[1][1] + Gblk[2][2];
        if (!(tr > 3 + 1e-7 && tr < 600)) return;
        if (lorentzError(Gblk) > 1e-4) Gblk = reorthonormalizeLorentz(Gblk);
        const GblkInv = invLorentz(Gblk);
        for (const mShift of shifts) {
          const D = mShift > 0 ? Gblk : GblkInv;
          const stepsD = Math.abs(mShift);
          const cD = baseSeed.cycle.map((l) => ({
            ...l,
            G: l.G.map((r) => [...r]),
            P: l.P ? [...l.P] : null,
            frame: l.frame ? { P: [...l.frame.P], T: [...l.frame.T], N: [...l.frame.N] } : null,
            conjM: l.conjM ? l.conjM.map((r) => [...r]) : ID3.map((r) => [...r])
          }));
          const hD = cloneHandleGluings(baseSeed.handleGluings);
          let K = ID3;
          for (let s = 0; s < stepsD; s++) K = mul3(K, D);
          if (lorentzError(K) > 1e-5) K = reorthonormalizeLorentz(K);
          const Kinv = invLorentz(K);
          for (const k of blockIndices) {
            const l0 = cD[k];
            const P = l0.P ? normTime(apply3(K, l0.P)) : null;
            const frame = l0.frame ? transformFrame(K, l0.frame) : null;
            const G =
              l0.kind === "cone" && P
                ? rotMatrixAt(P, -(2 * Math.PI) / l0.order)
                : frame && l0.length
                ? transMatrixAlong(frame, l0.length)
                : reorthonormalizeLorentz(mul3(K, mul3(l0.G, Kinv)));
            cD[k] = {
              ...l0,
              G,
              P,
              frame,
              conjM: reorthonormalizeLorentz(mul3(K, l0.conjM || ID3))
            };
            if (l0.kind === "handle-end") {
              stepHandleEntry(hD.get(l0.handleIndex), l0.side, K, Kinv);
            }
          }
          seeds.push({ cycle: cD, handleGluings: hD });
        }
      };

      for (const baseSeed of baseSeeds) {
        const nL = baseSeed.cycle.length;
        const cands = [];
        for (let i = 0; i < nL; i++) {
          const b2 = [i, (i + 1) % nL];
          const G2 = blockProduct(baseSeed.cycle, b2);
          const tr2 = G2[0][0] + G2[1][1] + G2[2][2];
          if (tr2 > 3 + 1e-7 && tr2 < 600) cands.push({ block: b2, tr: tr2 });
        }
        const n3 = Math.floor(nL / 2);
        for (let i = 0; i < n3; i++) {
          const b3 = [i, (i + 1) % nL, (i + 2) % nL];
          const G3 = blockProduct(baseSeed.cycle, b3);
          const tr3 = G3[0][0] + G3[1][1] + G3[2][2];
          if (tr3 > 3 + 1e-7 && tr3 < 600) cands.push({ block: b3, tr: tr3 });
        }
        cands.sort((a, b) => a.tr - b.tr);
        for (let ci = 0; ci < Math.min(3, cands.length); ci++) {
          addBlockTwistSeeds(baseSeed, cands[ci].block, [-1, 1]);
        }
      }
    }
    if (oldCycle.length === 4) {
      // Find the cleanest adjacent leaf pair whose product is the old separating cut
      let cleanPair = [0, 1];
      let bestTr = Infinity;
      let bestLerr = Infinity;
      for (const [k0, k1] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
        const Gtest = mul3(oldCycle[k0].G, oldCycle[k1].G);
        const tr = Gtest[0][0] + Gtest[1][1] + Gtest[2][2];
        const lerr = lorentzError(Gtest);
        if (tr > 3 + 1e-7) {
          const better = Math.abs(tr - bestTr) <= 1e-2 ? lerr < bestLerr : tr < bestTr;
          if (better) {
            bestTr = tr;
            bestLerr = lerr;
            cleanPair = [k0, k1];
          }
        }
      }
      let GcutOld = mul3(oldCycle[cleanPair[0]].G, oldCycle[cleanPair[1]].G);
      if (lorentzError(GcutOld) > 1e-5) GcutOld = reorthonormalizeLorentz(GcutOld);
      const GcutOldInv = invLorentz(GcutOld);
      const compPair = [0, 1, 2, 3].filter((idx) => !cleanPair.includes(idx));
      const cleanSum = oldCycle[cleanPair[0]].G[2][2] + oldCycle[cleanPair[1]].G[2][2];
      const compSum = oldCycle[compPair[0]].G[2][2] + oldCycle[compPair[1]].G[2][2];
      const twistPair = compSum > cleanSum ? compPair : cleanPair;

      for (const mShift of [-2, -1, 1, 2]) {
        const D = mShift > 0 ? GcutOld : GcutOldInv;
        const stepsD = Math.abs(mShift);
        const cD = oldCycle.map((l) => ({
          ...l,
          G: l.G.map((r) => [...r]),
          P: l.P ? [...l.P] : null,
          frame: l.frame ? { P: [...l.frame.P], T: [...l.frame.T], N: [...l.frame.N] } : null,
          conjM: l.conjM ? l.conjM.map((r) => [...r]) : ID3.map((r) => [...r])
        }));
        const hD = cloneHandleGluings(oldHandles);
        let K = ID3;
        for (let s = 0; s < stepsD; s++) K = mul3(K, D);
        if (lorentzError(K) > 1e-5 && K[2][2] <= 5000) K = reorthonormalizeLorentz(K);
        const Kinv = invLorentz(K);
        for (const k of twistPair) {
          const l0 = cD[k];
          const P = l0.P ? normTime(apply3(K, l0.P)) : null;
          const frame = l0.frame ? transformFrame(K, l0.frame) : null;
          const G =
            l0.kind === "cone" && P
              ? rotMatrixAt(P, -(2 * Math.PI) / l0.order)
              : frame && l0.length
              ? transMatrixAlong(frame, l0.length)
              : reorthonormalizeLorentz(mul3(K, mul3(l0.G, Kinv)));
          cD[k] = {
            ...l0,
            G,
            P,
            frame,
            conjM: reorthonormalizeLorentz(mul3(K, l0.conjM || ID3))
          };
          if (l0.kind === "handle-end") {
            stepHandleEntry(hD.get(l0.handleIndex), l0.side, K, Kinv);
          }
        }
        seeds.push({ cycle: cD, handleGluings: hD });
      }
    }

    let bestCand = null;
    for (const seed of seeds) {
      for (const dirMode of ["right", "left", "min-trace"]) {
        const braided = hurwitzBraidToOrder(seed.cycle, seed.handleGluings, plan.targetOrder, dirMode);
        if (!braided) continue;
        const ev = evalCandidate(braided);
        if (ev) {
          const isBetter =
            !bestCand ||
            (Math.abs(ev.lenSum - bestCand.lenSum) <= 1e-2
              ? ev.maxErr < bestCand.maxErr
              : ev.lenSum < bestCand.lenSum);
          if (isBetter) bestCand = ev;
        }
      }
    }
    if (!bestCand) return null;

    // Assign pair cut lengths & exact twists
    for (const pCut of pairCuts) {
      pCut.length = bestCand.cutLens.get(pCut.id);
    }

    const slotFrameByLeafOrCut = new Map(); // cutId/leafId -> parentFrame
    for (const node of plan.nodes) {
      if (node.piece.degenerate) continue;
      const pf = bestCand.pantFrames.get(node.piece.id);
      for (let s = 0; s < 3; s++) {
        const f = node.ordered[s];
        const isIncoming = s === 0 && node.incomingCutId !== null;
        if (isIncoming) continue;
        if (f.kind === "cut") {
          slotFrameByLeafOrCut.set(f.cutId, pf.frames[s]);
        } else {
          slotFrameByLeafOrCut.set(f.id, pf.frames[s]);
        }
      }
    }

    for (const node of plan.nodes) {
      if (!node.incomingCutId) continue;
      const cut = newCarving.cuts.find((c) => c.id === node.incomingCutId);
      const parentF = slotFrameByLeafOrCut.get(cut.id);
      if (!parentF) continue;
      const ell = cut.length;
      if (node.piece.degenerate) {
        const cFeats = node.ordered.filter((f) => f.kind === "cone");
        const q0 = bestCand.leafById.get(cFeats[0].id);
        const q1 = bestCand.leafById.get(cFeats[1].id);
        // Degenerate cones lie at mod0 = tw*ell and mod1 = (tw+0.5)*ell; both yield tw mod 0.5, pick best matching q0
        const s0 = signedFrameParamOfPoint(parentF, q0.P);
        cut.twistTurns = wrapHalfTurns(s0 / ell);
        // Check whether mod1 vs mod0 agrees with leaf order if needed; wrapHalfTurns covers [-0.5, 0.5]
      } else {
        const childSlot0 = bestCand.pantFrames.get(node.piece.id).frames[0];
        const s = signedFrameParamOfPoint(parentF, childSlot0.P);
        cut.twistTurns = wrapHalfTurns(s / ell);
      }
    }

    // Update handle twists & shifted corner-mirror collar twists
    for (const c of newCarving.cuts) {
      if (c.kind === "handle") {
        const hIdx = parseInt(c.targetId.split(":")[1], 10);
        const fPlus = slotFrameByLeafOrCut.get(`handle:${hIdx}:+`);
        const fMinus = slotFrameByLeafOrCut.get(`handle:${hIdx}:-`);
        const hEntry = bestCand.handleGluings.get(hIdx);
        if (fPlus && fMinus && hEntry) {
          const gluedP = normTime(apply3(hEntry.Gh, fPlus.P));
          const s = signedFrameParamOfPoint(fMinus, gluedP);
          c.twistTurns = wrapHalfTurns(s / c.length - 1);
        }
      } else if (c.kind === "collar") {
        const li = c.loopIndex;
        const leaf = bestCand.leafById.get(`collar:${li}`);
        const pantCollarF = slotFrameByLeafOrCut.get(`collar:${li}`);
        const newCuffInOld = shiftedCuffInOld.get(li);
        if (leaf && pantCollarF && newCuffInOld) {
          const transformedCuff = transformFrame(leaf.conjM || ID3, newCuffInOld);
          const s = signedFrameParamOfPoint(pantCollarF, transformedCuff.P);
          c.twistTurns = wrapHalfTurns(s / c.length - 1);
        }
      }
    }

    const newReal0 = buildRealization(orb, newCarving, { skipDirichletBuild: true });
    Q = reorthonormalizeLorentz(mul3(newReal0.topoMeta.rootPantWorldM, invLorentz(bestCand.rootPantM)));
  }

  const invQ = invLorentz(Q);
  const hasCarriedDir = Boolean(oldReal.dirichletPoly?.sideGens?.length && oldReal.dirichletBase);
  const mappedBase = oldReal.dirichletBase ? normTime(apply3(Q, oldReal.dirichletBase)) : null;
  const newReal = buildRealization(orb, newCarving, {
    dirichletBase: mappedBase,
    skipDirichletBuild: hasCarriedDir
  });
  newReal.quotient = transferQuotientAcrossRecut(oldReal, newReal, Q);
  let colorXor = 0;
  let detFlip = 0;
  let retQ = Q;
  let retInvQ = invQ;
  const carried = hasCarriedDir ? carryDirichletAcrossRecut(oldReal, newReal, Q) : null;
  if (carried) {
    retQ = carried.T;
    retInvQ = carried.invT;
    colorXor = carried.colorXor;
    detFlip = carried.detFlip;
  } else if (mappedBase) {
    const wrapped = wrapPointIntoTileI(mappedBase, newReal.fdPolygons, newReal.gens, newReal.quotient.genColorMasks);
    newReal.pullColorXor = wrapped.colorXor;
    newReal.pullDetFlip = wrapped.detFlip || 0;
    colorXor = wrapped.colorXor;
    detFlip = wrapped.detFlip || 0;
  }

  return { carving: newCarving, realization: newReal, Q: retQ, invQ: retInvQ, colorXor, detFlip };
}
