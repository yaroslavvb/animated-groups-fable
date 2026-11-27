// Exact 3-partition coupled Fenchel-Nielsen geometry for 4-cone sphere orbifolds (P Q R S).

import { frac, addFrac, subFrac, formatFrac } from "./orbifold.js?v=fn-v9";
import {
  ID3,
  mul3,
  det3,
  apply3,
  invLorentz,
  mdot,
  mcross,
  normTime,
  normSpace,
  add3,
  scale3,
  baryH,
  poincare,
  rotMatrixAt,
  frameMap,
  transformFrame,
  slideFrame,
  reverseFrame,
  transMatrixAlong,
  generalizedHexagon,
  reorthonormalizeLorentz,
  hypDist,
  mobiusTranslateToOrigin,
  buildHyperbolicDirichlet
} from "./hyperbolic.js?v=fn-v9";
import {
  EID3,
  emul3,
  einv3,
  eapply,
  etrans,
  erotAt,
  reduceSuperbase,
  buildEuclideanDirichlet
} from "./euclidean.js?v=fn-v9";

export const PQRS_LETTERS = ["P", "Q", "R", "S"];

export const PQRS_PARTITIONS = [
  { id: "part-0", index: 0, name: "γ₁", color: "#0f5a8a", sideA: [0, 1], sideB: [2, 3] },
  { id: "part-1", index: 1, name: "γ₂", color: "#0e7a5f", sideA: [0, 2], sideB: [1, 3] },
  { id: "part-2", index: 2, name: "γ₃", color: "#7a4999", sideA: [0, 3], sideB: [1, 2] }
];

const ORIGIN_FRAME = { P: [0, 0, 1], T: [1, 0, 0], N: [0, 1, 0] };

export function parsePqrs(input) {
  const raw = String(input ?? "").trim();
  const invalidMsg = "Enter 4 cone orders ≥ 2 (e.g. 3322, 2222, 4322, 3333, or 12 3 2 2).";
  if (!raw || !/^[\d\s,]+$/.test(raw)) {
    return { ok: false, error: invalidMsg };
  }
  const hasSep = /[\s,]/.test(raw);
  const tokens = !hasSep && /^\d{4}$/.test(raw) ? raw.split("") : raw.split(/[\s,]+/).filter(Boolean);
  if (tokens.length !== 4 || !tokens.every((t) => /^\d+$/.test(t))) {
    return { ok: false, error: invalidMsg };
  }
  const orders = tokens.map((t) => parseInt(t, 10));
  if (orders.some((n) => n < 2 || n > 99)) {
    return { ok: false, error: "Each cone order must be between 2 and 99." };
  }

  let coneSum = frac(0, 1);
  for (const n of orders) {
    coneSum = addFrac(coneSum, frac(1, n));
  }
  const chi = subFrac(coneSum, frac(2, 1));
  const geometry = chi.num === 0 ? "euclidean" : chi.num > 0 ? "spherical" : "hyperbolic";
  const canonical = orders.every((n) => n <= 9) ? orders.join("") : orders.join(" ");
  const expectedArea = geometry === "euclidean" ? 2.0 : 2 * Math.PI * (-chi.num / chi.den);

  return {
    ok: true,
    orders,
    chi,
    chiStr: formatFrac(chi),
    geometry,
    canonical,
    expectedArea
  };
}

export function coneColorMasks(orders) {
  const masks = [0, 0, 0, 0];
  const evens = [];
  for (let i = 0; i < 4; i++) {
    if (orders[i] % 2 === 0) evens.push(i);
  }
  if (evens.length <= 1) {
    return { masks, quotientSize: 1 };
  }
  if (evens.length === 2) {
    masks[evens[0]] = 1;
    masks[evens[1]] = 1;
    return { masks, quotientSize: 2 };
  }
  if (evens.length === 3) {
    masks[evens[0]] = 1;
    masks[evens[1]] = 2;
    masks[evens[2]] = 3;
    return { masks, quotientSize: 4 };
  }
  return { masks: [1, 1, 3, 3], quotientSize: 4 };
}

// ---------------------------------------------------------------------------
// Hyperbolic 4-cone geometry & exact 3-partition coordinate extraction
// ---------------------------------------------------------------------------

function frameFromTwoPoints(A, B) {
  const N = normSpace(mcross(A, B));
  const T = normSpace(add3(B, scale3(A, mdot(A, B))));
  return { P: normTime(A), T, N };
}

function signedFrameParam(F, Q) {
  return Math.asinh(mdot(F.T, Q));
}

function buildLocalPant(nx, ny, ell) {
  const H = generalizedHexagon(Math.cos(Math.PI / ny), Math.cos(Math.PI / nx), Math.cosh(ell / 2));
  return {
    H,
    X: H.features[1].V,
    Y: H.features[0].V,
    F: H.features[2].frame
  };
}

function placePant(nx, ny, ell, targetFrame) {
  const loc = buildLocalPant(nx, ny, ell);
  const M = reorthonormalizeLorentz(frameMap(loc.F, targetFrame));
  const X = normTime(apply3(M, loc.X));
  const Y = normTime(apply3(M, loc.Y));
  return {
    X,
    Y,
    gX: reorthonormalizeLorentz(rotMatrixAt(X, -(2 * Math.PI) / nx)),
    gY: reorthonormalizeLorentz(rotMatrixAt(Y, -(2 * Math.PI) / ny)),
    F: transformFrame(M, loc.F)
  };
}

function pantFrameFromPoints(nx, ny, ell, X, Y) {
  const loc = buildLocalPant(nx, ny, ell);
  const M = reorthonormalizeLorentz(frameMap(frameFromTwoPoints(loc.X, loc.Y), frameFromTwoPoints(X, Y)));
  return transformFrame(M, loc.F);
}

function buildOrderedQuad(a, b, c, d, ell, theta) {
  const abDeg = a === 2 && b === 2;
  const cdDeg = c === 2 && d === 2;
  const FA = slideFrame(ORIGIN_FRAME, -ell / 2);

  let A, B, C, D, gA, gB, gC, gD;
  if (!abDeg && !cdDeg) {
    const halfShift = (0.5 + theta * 0.5) * ell;
    const pA = placePant(a, b, ell, slideFrame(ORIGIN_FRAME, -halfShift));
    const pB = placePant(c, d, ell, reverseFrame(ORIGIN_FRAME, halfShift));
    A = pA.X;
    B = pA.Y;
    gA = pA.gX;
    gB = pA.gY;
    C = pB.X;
    D = pB.Y;
    gC = pB.gX;
    gD = pB.gY;
  } else if (!abDeg && cdDeg) {
    const pA = placePant(a, b, ell, FA);
    A = pA.X;
    B = pA.Y;
    gA = pA.gX;
    gB = pA.gY;
    D = slideFrame(FA, (theta - 0.25) * ell).P;
    C = slideFrame(FA, (theta + 0.25) * ell).P;
    gC = reorthonormalizeLorentz(rotMatrixAt(C, Math.PI));
    gD = reorthonormalizeLorentz(rotMatrixAt(D, Math.PI));
  } else {
    const FB = reverseFrame(FA, ell);
    const pB = placePant(c, d, ell, FB);
    C = pB.X;
    D = pB.Y;
    gC = pB.gX;
    gD = pB.gY;
    B = slideFrame(FB, (-theta - 0.25) * ell).P;
    A = slideFrame(FB, (-theta + 0.25) * ell).P;
    gA = reorthonormalizeLorentz(rotMatrixAt(A, Math.PI));
    gB = reorthonormalizeLorentz(rotMatrixAt(B, Math.PI));
  }
  return { pts: [A, B, C, D], gens: [gA, gB, gC, gD] };
}

function extractOrderedQuad(a, b, c, d, pts, gens) {
  const [A, B, C, D] = pts;
  const [gA, gB] = gens;
  const G = mul3(gA, gB);
  const tr = G[0][0] + G[1][1] + G[2][2];
  const ell = Math.acosh(Math.max(1 + 1e-12, (tr - 1) / 2));
  const abDeg = a === 2 && b === 2;
  const cdDeg = c === 2 && d === 2;

  let theta;
  if (!abDeg && !cdDeg) {
    const FA = pantFrameFromPoints(a, b, ell, A, B);
    const FB = pantFrameFromPoints(c, d, ell, C, D);
    theta = signedFrameParam(FA, FB.P) / ell - 1;
  } else if (!abDeg && cdDeg) {
    const FA = pantFrameFromPoints(a, b, ell, A, B);
    theta = signedFrameParam(FA, D) / ell + 0.25;
  } else {
    const FB = pantFrameFromPoints(c, d, ell, C, D);
    theta = -signedFrameParam(FB, B) / ell - 0.25;
  }
  return { ell, theta };
}

function toPart(k, orders, pts, gens) {
  const [p, q, r, s] = orders;
  const [P, Q, R, S] = pts;
  const [gP, gQ, gR, gS] = gens;
  if (k === 0) return { ord: [p, q, r, s], pts: [P, Q, R, S], gens: [gP, gQ, gR, gS] };
  if (k === 1) {
    const gRinv = invLorentz(gR);
    return {
      ord: [p, r, q, s],
      pts: [P, R, normTime(apply3(gRinv, Q)), S],
      gens: [gP, gR, reorthonormalizeLorentz(mul3(mul3(gRinv, gQ), gR)), gS]
    };
  }
  return { ord: [s, p, q, r], pts: [S, P, Q, R], gens: [gS, gP, gQ, gR] };
}

function fromPart(k, pts, gens) {
  const [A, B, C, D] = pts;
  const [gA, gB, gC, gD] = gens;
  if (k === 0) return { pts: [A, B, C, D], gens: [gA, gB, gC, gD] };
  if (k === 1) {
    const gBinv = invLorentz(gB);
    return {
      pts: [A, normTime(apply3(gB, C)), B, D],
      gens: [gA, reorthonormalizeLorentz(mul3(mul3(gB, gC), gBinv)), gB, gD]
    };
  }
  return { pts: [B, C, D, A], gens: [gB, gC, gD, gA] };
}

function computeAllHyperbolicCoords(orders, pts, gens) {
  return [0, 1, 2].map((k) => {
    const pk = toPart(k, orders, pts, gens);
    return extractOrderedQuad(pk.ord[0], pk.ord[1], pk.ord[2], pk.ord[3], pk.pts, pk.gens);
  });
}

function closestPairIndices(pts) {
  let bi = 0;
  let bj = 1;
  let bestDot = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const md = -mdot(pts[i], pts[j]);
      if (md > 1.0005 && md < bestDot) {
        bestDot = md;
        bi = i;
        bj = j;
      }
    }
  }
  return [bi, bj];
}

function spreadScore(arrPts, refPt) {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    s += -mdot(arrPts[i], refPt);
    for (let j = i + 1; j < 4; j++) {
      s += 0.5 * -mdot(arrPts[i], arrPts[j]);
    }
  }
  return s;
}

function applyBraidMove(tPts, tGens, tOrd, tMasks, tOrig, moveIdx, dir) {
  const np = [...tPts];
  const ng = [...tGens];
  const no = [...tOrd];
  const nm = [...tMasks];
  const ni = [...tOrig];
  const i = moveIdx;
  const j = (moveIdx + 1) & 3;
  if (dir > 0) {
    const gi = tGens[i];
    const giInv = invLorentz(gi);
    np[i] = normTime(apply3(gi, tPts[j]));
    np[j] = tPts[i];
    ng[i] = reorthonormalizeLorentz(mul3(mul3(gi, tGens[j]), giInv));
    ng[j] = gi;
  } else {
    const gj = tGens[j];
    const gjInv = invLorentz(gj);
    np[i] = tPts[j];
    np[j] = normTime(apply3(gjInv, tPts[i]));
    ng[i] = gj;
    ng[j] = reorthonormalizeLorentz(mul3(mul3(gjInv, tGens[i]), gj));
  }
  no[i] = tOrd[j];
  no[j] = tOrd[i];
  nm[i] = tMasks[j];
  nm[j] = tMasks[i];
  ni[i] = tOrig[j];
  ni[j] = tOrig[i];
  return { tPts: np, tGens: ng, tOrd: no, tMasks: nm, tOrig: ni };
}

function reduceHyperbolicGens(orders, pts, gens, masks, refPt) {
  let cur = {
    tPts: [...pts],
    tGens: [...gens],
    tOrd: [...orders],
    tMasks: [...masks],
    tOrig: [0, 1, 2, 3]
  };
  let curScore = spreadScore(cur.tPts, refPt);
  for (let step = 0; step < 16; step++) {
    let bestCand = null;
    let bestScore = curScore;
    for (let i = 0; i < 4; i++) {
      for (const dir of [1, -1]) {
        const cand = applyBraidMove(cur.tPts, cur.tGens, cur.tOrd, cur.tMasks, cur.tOrig, i, dir);
        const sc = spreadScore(cand.tPts, refPt);
        if (sc < bestScore - 1e-6) {
          bestScore = sc;
          bestCand = cand;
        }
      }
    }
    if (!bestCand) break;
    cur = bestCand;
    curScore = bestScore;
  }

  const dirGens = [];
  const dirMasks = [];
  const markers = [];
  const pushGen = (label, M, mask) => {
    dirGens.push({ label, M: reorthonormalizeLorentz(M), role: "gen" });
    dirMasks.push(mask);
  };

  for (let i = 0; i < 4; i++) {
    const origIdx = cur.tOrig[i];
    const letter = PQRS_LETTERS[origIdx];
    const ord = cur.tOrd[i];
    const mask = cur.tMasks[i];
    const M = cur.tGens[i];
    pushGen(`g_${letter}`, M, mask);
    if (ord > 2) {
      pushGen(`g_${letter}^-1`, invLorentz(M), mask);
    }
    markers.push({
      kind: "cone",
      order: ord,
      label: `${letter}:${ord}`,
      featureId: `cone:${origIdx}`,
      P: cur.tPts[i]
    });
  }

  // Include adjacent pair translations so Dirichlet finds close walls reliably even at large twists
  for (let i = 0; i < 2; i++) {
    const j = (i + 1) & 3;
    const T = mul3(cur.tGens[i], cur.tGens[j]);
    const mask = cur.tMasks[i] ^ cur.tMasks[j];
    pushGen(`t_${i}${j}`, T, mask);
    pushGen(`t_${i}${j}^-1`, invLorentz(T), mask);
  }

  return { tPts: cur.tPts, dirGens, dirMasks, markers };
}

function baryWithDistinctWeights(pts) {
  return baryH(pts, [0.37, 0.29, 0.21, 0.13]);
}

function buildHyperbolicPqrsRealization(state) {
  const { orb, pts, gens, masks, quotientSize, dirichletBase } = state;
  const refPt = dirichletBase || [0, 0, 1];
  const { tPts, dirGens, dirMasks, markers } = reduceHyperbolicGens(orb.orders, pts, gens, masks, refPt);

  const shortCenter = baryWithDistinctWeights(tPts);
  let chosenBase = dirichletBase;
  let pullColorXor = 0;
  let pullM = ID3;

  if (!chosenBase) {
    chosenBase = shortCenter;
  } else if (hypDist(chosenBase, shortCenter) > 1.5) {
    let cur = normTime(chosenBase);
    let curDot = -mdot(cur, shortCenter);
    for (let step = 0; step < 64; step++) {
      let bestPt = null;
      let bestGi = -1;
      let bestDot = curDot;
      for (let gi = 0; gi < dirGens.length; gi++) {
        const cand = normTime(apply3(dirGens[gi].M, cur));
        const d = -mdot(cand, shortCenter);
        if (d < bestDot - 1e-6) {
          bestDot = d;
          bestPt = cand;
          bestGi = gi;
        }
      }
      if (!bestPt) break;
      cur = bestPt;
      curDot = bestDot;
      pullM = reorthonormalizeLorentz(mul3(dirGens[bestGi].M, pullM));
      pullColorXor ^= dirMasks[bestGi];
    }
    chosenBase = cur;
  }

  const nearCone = (pt) => tPts.some((cp) => hypDist(pt, cp) < 1e-3);
  if (nearCone(chosenBase)) {
    chosenBase = normTime([chosenBase[0] + 0.009, chosenBase[1] - 0.007, chosenBase[2]]);
  }

  let dirichletPoly = buildHyperbolicDirichlet(chosenBase, dirGens, orb.expectedArea, dirMasks, markers);
  if (!dirichletPoly) {
    const fallbackBase = normTime([shortCenter[0] + 0.011, shortCenter[1] - 0.008, shortCenter[2]]);
    dirichletPoly = buildHyperbolicDirichlet(fallbackBase, dirGens, orb.expectedArea, dirMasks, markers);
    if (dirichletPoly) chosenBase = fallbackBase;
  }

  const quotient = {
    genColorMasks: dirMasks,
    quotientSize
  };

  return {
    geometry: "hyperbolic",
    orb,
    fdPolygons: dirichletPoly ? [dirichletPoly] : [],
    dirichletPoly,
    dirichletBase: chosenBase,
    pullM,
    pullColorXor,
    gens: dirGens,
    quotient,
    markers: dirichletPoly?.markers || markers
  };
}

// ---------------------------------------------------------------------------
// Euclidean 2222 geometry & exact 3-partition coordinate extraction
// ---------------------------------------------------------------------------

function extractAllEuc2222Coords(e1, e2) {
  const ell0 = Math.hypot(e1[0], e1[1]);
  const th0 = (e1[0] * e2[0] + e1[1] * e2[1]) / (2 * ell0 * ell0);

  const v1 = [e1[0] + e2[0], e1[1] + e2[1]];
  const ell1 = Math.hypot(v1[0], v1[1]);
  const th1 = (v1[0] * e2[0] + v1[1] * e2[1]) / (2 * ell1 * ell1) - 0.25;

  const ell2 = Math.hypot(e2[0], e2[1]);
  const th2 = -(e1[0] * e2[0] + e1[1] * e2[1]) / (2 * ell2 * ell2);

  return [
    { ell: ell0, theta: th0 },
    { ell: ell1, theta: th1 },
    { ell: ell2, theta: th2 }
  ];
}

function buildCanonicalEucBasisForPart(partIdx, ell, theta) {
  if (partIdx === 0) {
    return {
      e1: [ell, 0],
      e2: [2 * ell * theta, 1 / ell]
    };
  }
  if (partIdx === 1) {
    const v1 = [ell, 0];
    const u1 = [(2 * theta + 0.5) * ell, 1 / ell];
    return {
      e1: [v1[0] - u1[0], v1[1] - u1[1]],
      e2: u1
    };
  }
  return {
    e1: [-2 * ell * theta, -1 / ell],
    e2: [ell, 0]
  };
}

function partAxisVecEuc(partIdx, e1, e2) {
  if (partIdx === 0) return e1;
  if (partIdx === 1) return [e1[0] + e2[0], e1[1] + e2[1]];
  return e2;
}

function se2FromRotAndTrans(angle, tx, ty) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, tx],
    [s, c, ty],
    [0, 0, 1]
  ];
}

function rotEucVec(M, v) {
  return [M[0][0] * v[0] + M[0][1] * v[1], M[1][0] * v[0] + M[1][1] * v[1]];
}

function buildEuclideanPqrsRealization(state) {
  const { orb, P, e1, e2, masks, quotientSize, dirichletBase } = state;
  const { va, vb } = reduceSuperbase(e1, e2);

  const invB = 1 / (e1[0] * e2[1] - e1[1] * e2[0]);
  const expressInBasis = (v) => [
    Math.round((v[0] * e2[1] - v[1] * e2[0]) * invB),
    Math.round((e1[0] * v[1] - e1[1] * v[0]) * invB)
  ];

  // Pick nearest lattice shift of cone P so the fundamental square stays near dirichletBase (or origin)
  const targetRef = dirichletBase || [0, 0];
  const du = targetRef[0] - P[0];
  const dv = targetRef[1] - P[1];
  const mP = Math.round(((du * e2[1] - dv * e2[0]) * invB - 0.5) / 2);
  const nP = Math.round(((e1[0] * dv - e1[1] * du) * invB - 0.5) / 2);
  const P0 = [P[0] + 2 * (mP * e1[0] + nP * e2[0]), P[1] + 2 * (mP * e1[1] + nP * e2[1])];

  // Build 4 nearby half-turns around reduced cell [P0, P0+va, P0+vb, P0+va+vb] preserving exact cone indices
  const corners = [
    [0, 0],
    va,
    [va[0] + vb[0], va[1] + vb[1]],
    vb
  ];
  const gens = [];
  const dirMasks = [];
  const markers = [];

  for (let c = 0; c < corners.length; c++) {
    const off = corners[c];
    const [cu, cv] = expressInBasis(off);
    const pu = ((cu % 2) + 2) % 2;
    const pv = ((cv % 2) + 2) % 2;
    // Maps (pu, pv) -> P(0,0), Q(1,0), R(1,1), S(0,1)
    const coneIdx = pu === 0 && pv === 0 ? 0 : pu === 1 && pv === 0 ? 1 : pu === 1 && pv === 1 ? 2 : 3;
    const pt = [P0[0] + off[0], P0[1] + off[1]];
    const letter = PQRS_LETTERS[coneIdx];
    gens.push({ label: `R_${letter}`, M: erotAt(pt[0], pt[1], Math.PI), role: "cone2" });
    dirMasks.push(masks[coneIdx]);
    markers.push({
      kind: "cone",
      order: 2,
      label: `${letter}:2`,
      featureId: `cone:${coneIdx}`,
      P: pt
    });
  }

  let chosenBase = dirichletBase;
  let pullColorXor = 0;
  let pullM = EID3;
  if (!chosenBase) {
    chosenBase = [P0[0] + 0.37 * va[0] + 0.31 * vb[0], P0[1] + 0.37 * va[1] + 0.31 * vb[1]];
  } else {
    const detR = va[0] * vb[1] - va[1] * vb[0];
    const rdu = chosenBase[0] - P0[0];
    const rdv = chosenBase[1] - P0[1];
    const rm = (rdu * vb[1] - rdv * vb[0]) / detR;
    const rn = (va[0] * rdv - va[1] * rdu) / detR;
    if (Math.hypot(rm, rn) > 3.5) {
      const kM = Math.round(rm / 2);
      const kN = Math.round(rn / 2);
      const shiftM = kM * 2;
      const shiftN = kN * 2;
      const sx = -shiftM * va[0] - shiftN * vb[0];
      const sy = -shiftM * va[1] - shiftN * vb[1];
      chosenBase = [chosenBase[0] + sx, chosenBase[1] + sy];
      pullM = etrans(sx, sy);
      if (Math.abs(kM) & 1) pullColorXor ^= dirMasks[0] ^ dirMasks[1];
      if (Math.abs(kN) & 1) pullColorXor ^= dirMasks[0] ^ dirMasks[3];
    }
  }

  let dirichletPoly = buildEuclideanDirichlet(chosenBase, gens, 2.0, dirMasks, markers);
  if (!dirichletPoly) {
    const fallback = [P0[0] + 0.37 * va[0] + 0.31 * vb[0], P0[1] + 0.37 * va[1] + 0.31 * vb[1]];
    dirichletPoly = buildEuclideanDirichlet(fallback, gens, 2.0, dirMasks, markers);
    if (dirichletPoly) chosenBase = fallback;
  }

  return {
    geometry: "euclidean",
    orb,
    fdPolygons: dirichletPoly ? [dirichletPoly] : [],
    dirichletPoly,
    dirichletBase: chosenBase,
    pullM,
    pullColorXor,
    gens,
    quotient: {
      genColorMasks: dirMasks,
      quotientSize
    },
    markers: dirichletPoly?.markers || markers
  };
}

// ---------------------------------------------------------------------------
// Public PQRS State API: initialize, align on drag start, deform live, recenter
// ---------------------------------------------------------------------------

export function createPqrsState(orb) {
  const { masks, quotientSize } = coneColorMasks(orb.orders);
  if (orb.geometry === "euclidean") {
    const ell0 = 1.15;
    const { e1, e2 } = buildCanonicalEucBasisForPart(0, ell0, 0);
    const P = [-ell0 / 2, -0.5 / ell0];
    const coords = extractAllEuc2222Coords(e1, e2);
    const baseState = {
      orb,
      geometry: "euclidean",
      P,
      e1,
      e2,
      masks,
      quotientSize,
      coords,
      dirichletBase: null
    };
    const realization = buildEuclideanPqrsRealization(baseState);
    return {
      ...baseState,
      dirichletBase: realization.dirichletBase,
      realization
    };
  }

  const ell0 = 1.75;
  const { pts, gens } = buildOrderedQuad(orb.orders[0], orb.orders[1], orb.orders[2], orb.orders[3], ell0, 0);
  const coords = computeAllHyperbolicCoords(orb.orders, pts, gens);
  const baseState = {
    orb,
    geometry: "hyperbolic",
    pts,
    gens,
    masks,
    quotientSize,
    coords,
    dirichletBase: null
  };
  const realization = buildHyperbolicPqrsRealization(baseState);
  return {
    ...baseState,
    dirichletBase: realization.dirichletBase,
    realization
  };
}

export function computeDragAlign(pqrsState, partIdx) {
  const { ell, theta } = pqrsState.coords[partIdx];
  if (pqrsState.geometry === "euclidean") {
    const curAxis = partAxisVecEuc(partIdx, pqrsState.e1, pqrsState.e2);
    const curAngle = Math.atan2(curAxis[1], curAxis[0]);
    return se2FromRotAndTrans(curAngle, pqrsState.P[0], pqrsState.P[1]);
  }

  const ord = pqrsState.orb.orders;
  const partOrders =
    partIdx === 0
      ? ord
      : partIdx === 1
      ? [ord[0], ord[2], ord[1], ord[3]]
      : [ord[3], ord[0], ord[1], ord[2]];
  const bk = buildOrderedQuad(partOrders[0], partOrders[1], partOrders[2], partOrders[3], ell, theta);
  const back = fromPart(partIdx, bk.pts, bk.gens);
  const [iA, iB] = closestPairIndices(pqrsState.pts);
  return reorthonormalizeLorentz(
    frameMap(frameFromTwoPoints(back.pts[iA], back.pts[iB]), frameFromTwoPoints(pqrsState.pts[iA], pqrsState.pts[iB]))
  );
}

export function deformPqrsPartition(pqrsState, partIdx, newEll, newTheta, dragAlign) {
  if (pqrsState.geometry === "euclidean") {
    const canon = buildCanonicalEucBasisForPart(partIdx, newEll, newTheta);
    const e1 = rotEucVec(dragAlign, canon.e1);
    const e2 = rotEucVec(dragAlign, canon.e2);
    const P = [dragAlign[0][2], dragAlign[1][2]];
    const coords = extractAllEuc2222Coords(e1, e2);
    coords[partIdx] = { ell: newEll, theta: newTheta };
    const nextBase = {
      ...pqrsState,
      P,
      e1,
      e2,
      coords
    };
    const realization = buildEuclideanPqrsRealization(nextBase);
    return {
      ...nextBase,
      dirichletBase: realization.dirichletBase,
      realization
    };
  }

  const ord = pqrsState.orb.orders;
  const partOrders =
    partIdx === 0
      ? ord
      : partIdx === 1
      ? [ord[0], ord[2], ord[1], ord[3]]
      : [ord[3], ord[0], ord[1], ord[2]];
  const bk = buildOrderedQuad(partOrders[0], partOrders[1], partOrders[2], partOrders[3], newEll, newTheta);
  const back = fromPart(partIdx, bk.pts, bk.gens);
  const alignInv = invLorentz(dragAlign);
  const pts = back.pts.map((pt) => normTime(apply3(dragAlign, pt)));
  const gens = back.gens.map((g) => reorthonormalizeLorentz(mul3(dragAlign, mul3(g, alignInv))));
  const coords = computeAllHyperbolicCoords(ord, pts, gens);
  coords[partIdx] = { ell: newEll, theta: newTheta };

  const nextBase = {
    ...pqrsState,
    pts,
    gens,
    coords
  };
  const realization = buildHyperbolicPqrsRealization(nextBase);
  return {
    ...nextBase,
    dirichletBase: realization.dirichletBase,
    realization
  };
}

export function recenterPqrsState(pqrsState) {
  if (pqrsState.geometry === "euclidean") {
    const rP = Math.hypot(pqrsState.P[0], pqrsState.P[1]);
    if (rP < 6) return { state: pqrsState, camComp: EID3 };
    const T = etrans(-pqrsState.P[0], -pqrsState.P[1]);
    const Tinv = einv3(T);
    const P = [0, 0];
    const db = pqrsState.dirichletBase ? eapply(T, pqrsState.dirichletBase) : null;
    const nextBase = { ...pqrsState, P, dirichletBase: db };
    const realization = buildEuclideanPqrsRealization(nextBase);
    return {
      state: { ...nextBase, dirichletBase: realization.dirichletBase, realization },
      camComp: Tinv
    };
  }

  const maxT = Math.max(...pqrsState.pts.map((p) => p[2]));
  if (maxT < 8) return { state: pqrsState, camComp: ID3 };
  const center = baryWithDistinctWeights(pqrsState.pts);
  const C = mobiusTranslateToOrigin(center);
  const Cinv = invLorentz(C);
  const pts = pqrsState.pts.map((p) => normTime(apply3(C, p)));
  const gens = pqrsState.gens.map((g) => reorthonormalizeLorentz(mul3(C, mul3(g, Cinv))));
  const db = pqrsState.dirichletBase ? normTime(apply3(C, pqrsState.dirichletBase)) : null;
  const nextBase = { ...pqrsState, pts, gens, dirichletBase: db };
  const realization = buildHyperbolicPqrsRealization(nextBase);
  return {
    state: { ...nextBase, dirichletBase: realization.dirichletBase, realization },
    camComp: Cinv
  };
}
