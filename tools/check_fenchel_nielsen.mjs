// Standalone mathematical verification suite for docs/js/fenchel-nielsen/*.js.
// Usage: node tools/check_fenchel_nielsen.mjs
import assert from "node:assert/strict";
import {
  PRESETS,
  parseOrbifold,
  createDefaultCarving,
  createRandomCarving,
  hasMultipleCarvings,
  carvingPartitionSignature,
  carvingShapeSignature,
  setCutPair,
  cycleCarvingTopology,
  totalSliderCount
} from "../docs/js/fenchel-nielsen/orbifold.js";
import {
  ID3,
  mul3,
  det3,
  mdot,
  mcross,
  add3,
  scale3,
  baryH,
  normTime,
  normSpace,
  apply3,
  poincare,
  liftDisk,
  frameMap,
  hypDist,
  lorentzError,
  panCameraByDiskDelta,
  wrapCameraInGroupWithColor,
  buildRealization,
  generateTiling,
  recutHyperbolic
} from "../docs/js/fenchel-nielsen/hyperbolic.js";
import {
  EID3,
  emul3,
  edet3,
  eapply,
  polygonAreaE,
  buildEuclideanRealization,
  generateEuclideanTiling,
  recutEuclidean
} from "../docs/js/fenchel-nielsen/euclidean.js";

function matPow(M, k) {
  let acc = ID3;
  for (let i = 0; i < k; i++) acc = mul3(acc, M);
  return acc;
}

function matErr(A, B) {
  let worst = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const d = Math.abs(A[i][j] - B[i][j]);
      if (d > worst) worst = d;
    }
  }
  return worst;
}

function checkGeneratorRelations(label, r) {
  assert(r.maxLorentzError < 1e-3, `${label}: absolute Lorentz error ${r.maxLorentzError}`);
  assert(r.areaError < 1e-7, `${label}: area error ${r.areaError}`);

  for (const g of r.gens) {
    const M = g.M;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        assert(Number.isFinite(M[i][j]), `${label}: non-finite entry in ${g.label}`);
      }
    }
    assert(
      lorentzError(M) < 1e-9 * Math.max(1, M[2][2]),
      `${label}: scaled Lorentz error on ${g.label}: ${lorentzError(M)} (M22=${M[2][2]})`
    );
    const tr = M[0][0] + M[1][1] + M[2][2];
    const det = det3(M);
    const tol = 1e-8 * Math.max(1, M[2][2]);
    const detTol = Math.max(1e-3, (M[2][2] ** 3) * 1e-15);
    if (g.role === "mirror") {
      assert(Math.abs(det + 1) < detTol, `${label}: mirror ${g.label} det=${det}`);
      assert(matErr(mul3(M, M), ID3) < tol, `${label}: mirror ${g.label}^2 != I`);
    } else if (g.role === "cone2") {
      assert(Math.abs(det - 1) < detTol, `${label}: cone2 ${g.label} det=${det}`);
      assert(matErr(mul3(M, M), ID3) < tol, `${label}: cone2 ${g.label}^2 != I`);
    } else if (g.role === "rot") {
      assert(det > 0.999, `${label}: rot ${g.label} det=${det}`);
      const cosAng = Math.max(-1, Math.min(1, (tr - 1) / 2));
      const ang = Math.acos(cosAng);
      const ord = Math.round((2 * Math.PI) / ang);
      assert(ord >= 2 && Math.abs(ang - (2 * Math.PI) / ord) < 1e-7, `${label}: invalid rot angle ${ang}`);
      assert(matErr(matPow(M, ord), ID3) < 1e-7, `${label}: rot^${ord} != I`);
    } else if (g.role === "glide") {
      assert(det < -0.999, `${label}: glide ${g.label} det=${det}`);
    } else {
      assert(det > 0.999, `${label}: gen ${g.label} det=${det}`);
    }
  }
}

function checkTilingCoverage(label, r, numSamples = 250, maxRadius = 0.55) {
  const tiles = generateTiling(r, ID3, { maxPolys: 1500, rMax: 0.985 });
  assert(tiles.length > 0, `${label}: empty tiling`);

  const invTiles = [];
  for (const t of tiles) {
    // Inverse in O(2,1) is J M^T J regardless of det sign!
    const M = t.M;
    invTiles.push([
      [M[0][0], M[1][0], -M[2][0]],
      [M[0][1], M[1][1], -M[2][1]],
      [-M[0][2], -M[1][2], M[2][2]]
    ]);
  }

  let tested = 0;
  for (let k = 0; k < numSamples; k++) {
    const ang = k * 2.399963229728653;
    const rad = 0.02 + (maxRadius - 0.02) * Math.sqrt((k + 0.5) / numSamples);
    const P = liftDisk(rad * Math.cos(ang), rad * Math.sin(ang));
    let hits = 0;
    let skipBoundary = false;

    for (let ti = 0; ti < invTiles.length; ti++) {
      const Q = normTime(apply3(invTiles[ti], P));
      for (const poly of r.fdPolygons) {
        let inside = true;
        let nearEdge = false;
        for (const n of poly.sideOutNormals) {
          const d = mdot(Q, n);
          if (Math.abs(d) < 1e-3) nearEdge = true;
          if (d > 1e-3) {
            inside = false;
            break;
          }
        }
        if (inside) {
          if (nearEdge) {
            skipBoundary = true;
            break;
          }
          hits++;
        }
      }
      if (skipBoundary) break;
    }
    if (skipBoundary) continue;
    tested++;
    assert.equal(hits, 1, `${label}: sample k=${k} (r=${rad.toFixed(3)}) hit ${hits} tiles`);
  }
  assert(tested >= Math.floor(numSamples * 0.75), `${label}: too few non-boundary samples (${tested})`);
}

function polyFrame(poly) {
  const P = poly.centroid;
  const V = poly.vertsH[0];
  const T = normSpace(add3(V, scale3(P, mdot(P, V))));
  const N = normSpace(mcross(P, T));
  return { P, T, N };
}

function checkDehnTwistInvariance(sig) {
  const orb = parseOrbifold(sig);
  const c0 = createDefaultCarving(orb);
  for (let i = 0; i < c0.cuts.length; i++) {
    if (!c0.cuts[i].hasTwist) continue;
    const cA = {
      ...c0,
      cuts: c0.cuts.map((x, k) => (k === i ? { ...x, twistTurns: 0.19 } : { ...x }))
    };
    const cB = {
      ...c0,
      cuts: c0.cuts.map((x, k) => (k === i ? { ...x, twistTurns: 1.19 } : { ...x }))
    };
    const rA = buildRealization(orb, cA);
    const rB = buildRealization(orb, cB);
    const align = frameMap(polyFrame(rB.fdPolygons[0]), polyFrame(rA.fdPolygons[0]));
    const tilesA = generateTiling(rA, ID3, { maxPolys: 1000, rMax: 0.95 });
    const tilesB = generateTiling(rB, ID3, { maxPolys: 1600, rMax: 0.98 });

    const ptsB = [];
    for (const t of tilesB) {
      for (const poly of rB.fdPolygons) {
        ptsB.push(normTime(apply3(align, apply3(t.M, poly.centroid))));
      }
    }

    for (const t of tilesA) {
      for (const poly of rA.fdPolygons) {
        const pA = normTime(apply3(t.M, poly.centroid));
        const d = poincare(pA);
        if (Math.hypot(d[0], d[1]) > 0.55) continue;
        let best = Infinity;
        for (const pB of ptsB) {
          const dist = hypDist(pA, pB);
          if (dist < best) best = dist;
        }
        assert(best < 1e-4, `${sig} cut ${c0.cuts[i].name}: Dehn twist centroid error ${best}`);
      }
    }
  }
}

console.log("1. Checking parser, Teichmuller dimension, and non-hyperbolic cases...");
for (const sig of ["2222", "*2222", "o", "xx", "*332", "332"]) {
  const o = parseOrbifold(sig);
  assert(o.ok, `${sig} failed to parse`);
  assert(o.geometry !== "hyperbolic", `${sig} expected non-hyperbolic`);
}
{
  const o12 = parseOrbifold("(12)222");
  assert(o12.ok && o12.cones[0] === 12 && o12.cones.length === 4);
  const c12 = createDefaultCarving(o12);
  assert.equal(totalSliderCount(c12), o12.teichDim);
  checkGeneratorRelations("(12)222", buildRealization(o12, c12));
}

console.log("2. Checking all 28 presets + exact generator relations + 250-pt disk coverage...");
let presetCount = 0;
for (const grp of PRESETS) {
  for (const item of grp.items) {
    presetCount++;
    const o = parseOrbifold(item.sig);
    assert(o.ok && o.geometry === "hyperbolic", `${item.sig} not hyperbolic`);
    const c = createDefaultCarving(o);
    assert.equal(totalSliderCount(c), o.teichDim, `${item.sig}: slider count != teichDim`);
    const r = buildRealization(o, c);
    checkGeneratorRelations(item.sig, r);
    checkTilingCoverage(item.sig, r, 250, 0.55);
  }
}
console.log(`   Passed all ${presetCount} presets.`);

console.log("3. Checking alternate carvings (Snowflake vs Caterpillar, Dumbbell vs Theta, etc.)...");
{
  // 222222 Snowflake vs Caterpillar
  const o6 = parseOrbifold("222222");
  const cSnow = createDefaultCarving(o6);
  checkTilingCoverage("222222#snowflake", buildRealization(o6, cSnow), 250, 0.55);
  // Explicit Caterpillar: (A,B)->cut0, (cut0,C)->cut1, (cut1,D)->cut2
  let cCat = setCutPair(o6, cSnow, 1, "cut:0", "cone:2");
  cCat = setCutPair(o6, cCat, 2, "cut:1", "cone:3");
  const rCat = buildRealization(o6, cCat);
  checkGeneratorRelations("222222#caterpillar", rCat);
  checkTilingCoverage("222222#caterpillar", rCat, 250, 0.55);

  // oo Separating Dumbbell vs Non-separating Theta
  const o2 = parseOrbifold("oo");
  const cDumb = createDefaultCarving(o2);
  checkTilingCoverage("oo#dumbbell", buildRealization(o2, cDumb), 250, 0.55);
  const cTheta = setCutPair(o2, cDumb, 2, "handle:0:+", "handle:1:+");
  const rTheta = buildRealization(o2, cTheta);
  checkGeneratorRelations("oo#theta", rTheta);
  checkTilingCoverage("oo#theta", rTheta, 250, 0.55);

  // Cycle alternates for 3322, *3333, *22222, 2*222
  for (const sig of ["3322", "*3333", "*22222", "2*222"]) {
    const o = parseOrbifold(sig);
    let c = createDefaultCarving(o);
    for (let step = 1; step <= 2; step++) {
      c = cycleCarvingTopology(o, c);
      const r = buildRealization(o, c);
      checkGeneratorRelations(`${sig}#alt${step}`, r);
      checkTilingCoverage(`${sig}#alt${step}`, r, 250, 0.55);
    }
  }
}

console.log("4. Checking Dehn twist invariance across 3322, 2223, 222222, o2, oo, 23*2...");
for (const sig of ["3322", "2223", "222222", "o2", "oo", "23*2"]) {
  checkDehnTwistInvariance(sig);
}

console.log("5. Extreme parameter stress test (length = 0.25, 5.0, twist = +-1.0)...");
for (const sig of ["3322", "*3333", "2*32", "222222", "o2", "23x", "*22*22"]) {
  const o = parseOrbifold(sig);
  const base = createDefaultCarving(o);
  for (const [len, tw] of [
    [0.25, -1.0],
    [5.0, 1.0],
    [0.3, 0.75]
  ]) {
    const c = {
      ...base,
      cuts: base.cuts.map((x) => ({
        ...x,
        length: x.kind === "crosscap" ? len * 0.5 : len,
        twistTurns: x.hasTwist ? tw : 0
      }))
    };
    const r = buildRealization(o, c);
    checkGeneratorRelations(`${sig}@(${len},${tw})`, r);
    // For extreme length=5.0, tiles are enormous; verify non-overlap inside r < 0.4
    checkTilingCoverage(`${sig}@(${len},${tw})`, r, 120, len > 3 ? 0.4 : 0.55);
  }
}

console.log("6. Checking random carvings, hasMultipleCarvings, and Reshuffle invariants...");
{
  const multiTrue = ["3322", "2223", "2345", "22223", "222222", "*3333", "*22222", "*222222", "2*222", "oo", "o22", "222x"];
  const multiFalse = ["237", "*642", "o2", "2*32", "23x", "23*", "23*2", "xxx", "*22*22"];

  for (const sig of multiTrue) {
    const o = parseOrbifold(sig);
    const c = createDefaultCarving(o);
    assert.equal(hasMultipleCarvings(o, c), true, `${sig}: expected hasMultipleCarvings === true`);
  }
  for (const sig of multiFalse) {
    const o = parseOrbifold(sig);
    const c = createDefaultCarving(o);
    assert.equal(hasMultipleCarvings(o, c), false, `${sig}: expected hasMultipleCarvings === false`);
  }

  const shapeStrict = new Set(["3322", "2345", "222222", "oo"]);
  for (const sig of ["3322", "2345", "222222", "oo", "*3333", "*22222", "2*222"]) {
    const o = parseOrbifold(sig);
    let cur = createRandomCarving(o);
    assert.equal(totalSliderCount(cur), o.teichDim, `${sig}#rand0: slider count`);
    let r = buildRealization(o, cur);
    checkGeneratorRelations(`${sig}#rand0`, r);
    checkTilingCoverage(`${sig}#rand0`, r, 150, 0.55);

    for (let step = 1; step <= 5; step++) {
      const next = createRandomCarving(o, cur);
      assert.equal(totalSliderCount(next), o.teichDim, `${sig}#reshuffle${step}: slider count`);
      assert.notEqual(
        carvingPartitionSignature(o, next),
        carvingPartitionSignature(o, cur),
        `${sig}#reshuffle${step}: partition did not change`
      );
      if (shapeStrict.has(sig)) {
        assert.notEqual(
          carvingShapeSignature(o, next),
          carvingShapeSignature(o, cur),
          `${sig}#reshuffle${step}: shape did not change`
        );
      }
      r = buildRealization(o, next);
      checkGeneratorRelations(`${sig}#reshuffle${step}`, r);
      checkTilingCoverage(`${sig}#reshuffle${step}`, r, 150, 0.55);
      cur = next;
    }
  }
}

console.log("7. Checking Z_2^2 quotient coloring solver, zero homomorphism contradictions, and pan-wrap invariance...");
{
  const expectedQuotientSizes = [
    ["*22222", 4],
    ["*222222", 4],
    ["*642", 4],
    ["*2223", 4],
    ["222222", 4],
    ["2223", 4],
    ["2*32", 4],
    ["4*3", 4],
    ["23*", 4],
    ["o2", 4],
    ["oo", 4],
    ["xxx", 4],
    ["2*222", 4],
    ["*22*22", 4],
    ["*3333", 2],
    ["3*5", 2],
    ["3322", 2],
    ["2345", 2],
    ["23x", 2],
    ["237", 1]
  ];
  for (const [sig, expSize] of expectedQuotientSizes) {
    const o = parseOrbifold(sig);
    const r = buildRealization(o, createDefaultCarving(o));
    assert.equal(r.quotient.quotientSize, expSize, `${sig}: expected quotientSize=${expSize}, got ${r.quotient.quotientSize}`);
  }

  const verifyTilingHomomorphism = (label, r, tiles, camColor = 0) => {
    const masks = r.quotient.genColorMasks;
    const poly0 = r.fdPolygons[0];
    const testPt1 = poly0.centroid;
    const testPt2 = baryH([poly0.centroid, poly0.vertsH[0], poly0.vertsH[1]], [0.55, 0.27, 0.18]);
    const scale = 60;
    const buckets = new Map();
    for (const t of tiles) {
      const p1 = normTime(apply3(t.M, testPt1));
      const p2 = normTime(apply3(t.M, testPt2));
      const d1 = poincare(p1);
      const detPos = det3(t.M) >= 0;
      const home = `${Math.round(d1[0] * scale)},${Math.round(d1[1] * scale)}`;
      if (!buckets.has(home)) buckets.set(home, []);
      buckets.get(home).push({ detPos, p1, p2, color: t.color, M: t.M });
    }
    const fdMatches = buckets.get(`${Math.round(poincare(testPt1)[0] * scale)},${Math.round(poincare(testPt1)[1] * scale)}`) || [];
    for (const item of fdMatches) {
      if (item.detPos && -mdot(item.p1, testPt1) < 1 + 1e-5 && -mdot(item.p2, testPt2) < 1 + 1e-5) {
        assert.equal(item.color, camColor, `${label}: FD color mismatch`);
      }
    }
    let edgesChecked = 0;
    for (const t of tiles) {
      for (let gi = 0; gi < r.gens.length; gi++) {
        const M2 = mul3(t.M, r.gens[gi].M);
        const p1 = normTime(apply3(M2, testPt1));
        const p2 = normTime(apply3(M2, testPt2));
        const d1 = poincare(p1);
        const detPos = det3(M2) >= 0;
        const bx = Math.round(d1[0] * scale);
        const by = Math.round(d1[1] * scale);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const list = buckets.get(`${bx + dx},${by + dy}`);
            if (!list) continue;
            for (const t2 of list) {
              if (t2.detPos !== detPos) continue;
              if (-mdot(p1, t2.p1) < 1 + 1e-5 && -mdot(p2, t2.p2) < 1 + 1e-5) {
                edgesChecked++;
                assert.equal(
                  t.color ^ masks[gi],
                  t2.color,
                  `${label}: homomorphism contradiction at gen ${gi}`
                );
              }
            }
          }
        }
      }
    }
    assert(edgesChecked > 0, `${label}: no Cayley edges verified`);
  };

  for (const grp of PRESETS) {
    for (const item of grp.items) {
      const o = parseOrbifold(item.sig);
      const r = buildRealization(o, createDefaultCarving(o));
      const tiles = generateTiling(r, ID3, { maxPolys: 900, rMax: 0.94 });
      verifyTilingHomomorphism(item.sig, r, tiles, 0);
    }
  }

  for (const sig of ["*22222", "2*32"]) {
    const o = parseOrbifold(sig);
    const r = buildRealization(o, createDefaultCarving(o));
    let cameraM = ID3;
    let cameraColor = 0;
    let wrapCount = 0;
    for (let step = 0; step < 80; step++) {
      const res = panCameraByDiskDelta(cameraM, 0.22, 0.13, r);
      cameraM = res.cameraM;
      if (res.wrapped) {
        wrapCount++;
        cameraColor ^= res.colorXor;
      }
    }
    assert(wrapCount > 0, `${sig}: expected camera wrapping during 80-step pan`);
    assert(cameraM[2][2] <= 200, `${sig}: cameraM did not wrap cleanly (${cameraM[2][2]})`);
    const pannedTiles = generateTiling(r, cameraM, { maxPolys: 700, rMax: 0.94, cameraColor });
    verifyTilingHomomorphism(`${sig}#panned`, r, pannedTiles, cameraColor);
    const wrappedRes = wrapCameraInGroupWithColor(cameraM, r);
    assert(typeof wrappedRes.colorXor === "number");
  }
}

// ============================================================================
// 8. Euclidean Orbifolds (All 17) & Stationary Recut Invariance
// ============================================================================
{
  const verifyEucHomomorphism = (label, r, tiles) => {
    const masks = r.quotient?.genColorMasks;
    if (!masks || r.quotient.quotientSize <= 1) return;
    const p0 = r.fdPolygons[0].centroid;
    const tp1 = p0;
    const tp2 = [p0[0] + 0.031, p0[1] - 0.023];
    const buckets = new Map();
    const scale = 40;
    for (const t of tiles) {
      const a1 = eapply(t.CM, tp1);
      const a2 = eapply(t.CM, tp2);
      const bx = Math.round(a1[0] * scale);
      const by = Math.round(a1[1] * scale);
      const key = `${bx},${by}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ detPos: t.detPos, a1, a2, color: t.color });
    }
    let checked = 0;
    for (const t of tiles) {
      if (t.r > 2.2) continue;
      for (let gi = 0; gi < r.gens.length; gi++) {
        const CM2 = emul3(t.CM, r.gens[gi].M);
        const detPos = edet3(CM2) >= 0;
        const a1 = eapply(CM2, tp1);
        const a2 = eapply(CM2, tp2);
        const bx = Math.round(a1[0] * scale);
        const by = Math.round(a1[1] * scale);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const list = buckets.get(`${bx + dx},${by + dy}`);
            if (!list) continue;
            for (const t2 of list) {
              if (t2.detPos !== detPos) continue;
              if (Math.hypot(a1[0] - t2.a1[0], a1[1] - t2.a1[1]) < 1e-4 &&
                  Math.hypot(a2[0] - t2.a2[0], a2[1] - t2.a2[1]) < 1e-4) {
                checked++;
                assert.equal(
                  t.color ^ masks[gi],
                  t2.color,
                  `${label}: Euclidean quotient contradiction on gen ${gi}`
                );
              }
            }
          }
        }
      }
    }
    assert(checked > 0, `${label}: no Euclidean Cayley edges verified`);
  };

  // 8a. All 17 wallpaper groups
  const EUC_17 = [
    "2222", "o", "*2222",
    "2*22", "22*", "22x", "**", "*x", "xx",
    "*442", "442", "4*2", "*632", "632", "*333", "3*3", "333"
  ];
  for (const sig of EUC_17) {
    const orb = parseOrbifold(sig);
    assert(orb.ok && orb.geometry === "euclidean", `${sig}: expected valid euclidean orbifold`);
    const c = createDefaultCarving(orb);
    const r = buildEuclideanRealization(orb, c);
    assert(r.areaError < 1e-6, `${sig}: areaError=${r.areaError}`);
    assert(r.maxIsometryError < 1e-10, `${sig}: maxIsometryError=${r.maxIsometryError}`);
    if (r.dirichletPoly) {
      const dArea = Math.abs(polygonAreaE(r.dirichletPoly.vertsE));
      assert(Math.abs(dArea - r.expectedArea) < 1e-6, `${sig}: dirichlet area ${dArea} vs ${r.expectedArea}`);
    }
    const tiles = generateEuclideanTiling(r, EID3, { viewRadius: 3.5, maxTiles: 450, cameraColor: 0 });
    assert(tiles.length > 0, `${sig}: empty Euclidean tiling`);
    verifyEucHomomorphism(sig, r, tiles);
  }

  // 8b. Stationary recutEuclidean invariance on 2222 (at handles.js params), o, *2222
  const checkEucMarkers = (oldR, newR, Q) => {
    const tiles = generateEuclideanTiling(newR, EID3, { viewRadius: 5.5, maxTiles: 700, cameraColor: 0 });
    let worst = 0;
    for (const mk of oldR.markers) {
      const tp = eapply(Q, mk.P);
      let best = Infinity;
      for (const tile of tiles) {
        for (const nmk of newR.markers) {
          if (nmk.kind !== mk.kind || nmk.order !== mk.order) continue;
          const np = eapply(tile.CM, nmk.P);
          best = Math.min(best, Math.hypot(np[0] - tp[0], np[1] - tp[1]));
        }
      }
      if (best > worst) worst = best;
    }
    return worst;
  };

  {
    const orb2 = parseOrbifold("2222");
    let c2 = createDefaultCarving(orb2);
    c2.cuts[0].length = 1.186;
    c2.cuts[0].twistTurns = -0.0596;
    let r2 = buildEuclideanRealization(orb2, c2);
    for (let s = 0; s < 12; s++) {
      const next = createRandomCarving(orb2, c2);
      const res = recutEuclidean(orb2, c2, r2, next);
      assert(res && res.realization.areaError < 1e-9, `2222 step ${s} areaError`);
      assert(res.realization.maxIsometryError < 1e-10, `2222 step ${s} isomError`);
      assert(res.realization.quotient.exactTransferred === true, `2222 step ${s} quotient transfer failed`);
      const err = checkEucMarkers(r2, res.realization, res.Q);
      assert(err < 1e-8, `2222 step ${s} marker lattice drift ${err}`);
      const dArea = Math.abs(polygonAreaE(res.realization.dirichletPoly.vertsE));
      assert(Math.abs(dArea - res.realization.expectedArea) < 1e-6, `2222 step ${s} dirichlet area`);
      const tiles = generateEuclideanTiling(res.realization, EID3, { viewRadius: 3.5, maxTiles: 450, cameraColor: 0, useDirichlet: true });
      verifyEucHomomorphism(`2222#${s}`, res.realization, tiles);
      c2 = res.carving;
      r2 = res.realization;
    }

    for (const sig of ["o", "*2222"]) {
      const orb = parseOrbifold(sig);
      let curC = createDefaultCarving(orb);
      let curR = buildEuclideanRealization(orb, curC);
      for (let s = 0; s < 5; s++) {
        const res = recutEuclidean(orb, curC, curR, createRandomCarving(orb, curC));
        assert(res && res.realization.areaError < 1e-9, `${sig} step ${s} areaError`);
        assert(res.realization.quotient.exactTransferred === true, `${sig} step ${s} quotient transfer failed`);
        const err = checkEucMarkers(curR, res.realization, res.Q);
        assert(err < 1e-8, `${sig} step ${s} marker lattice drift ${err}`);
        const tiles = generateEuclideanTiling(res.realization, EID3, { viewRadius: 3.5, maxTiles: 450, cameraColor: 0, useDirichlet: Boolean(res.realization.dirichletPoly) });
        verifyEucHomomorphism(`${sig}#${s}`, res.realization, tiles);
        curC = res.carving;
        curR = res.realization;
      }
    }
  }

  // 8c. Stationary recutHyperbolic invariance across all multi-carving modes
  const checkHypMarkers = (oldR, newR, Q) => {
    const center = newR.fdPolygons?.[0]?.centroid;
    let worst = 0;
    for (const mk of oldR.markers) {
      let targetP = normTime(apply3(Q, mk.P));
      if (center) {
        let curD = -mdot(targetP, center);
        for (let step = 0; step < 60; step++) {
          let bestPt = null;
          let bestD = curD;
          for (const g of newR.gens) {
            const cand = normTime(apply3(g.M, targetP));
            const d = -mdot(cand, center);
            if (d < bestD - 1e-6) {
              bestD = d;
              bestPt = cand;
            }
          }
          if (!bestPt) break;
          targetP = bestPt;
          curD = bestD;
        }
      }
      const t = targetP[2], x = targetP[0], y = targetP[1], tp1 = 1 + t;
      const invB = [
        [1 + (x * x) / tp1, (x * y) / tp1, -x],
        [(x * y) / tp1, 1 + (y * y) / tp1, -y],
        [-x, -y, t]
      ];
      const tiles = generateTiling(newR, invB, { maxPolys: 1600, rMax: 0.99 });
      let best = Infinity;
      for (const tile of tiles) {
        for (const nmk of newR.markers) {
          if (nmk.kind !== mk.kind || nmk.order !== mk.order) continue;
          best = Math.min(best, hypDist(normTime(apply3(tile.M, nmk.P)), targetP));
        }
      }
      if (best > worst) worst = best;
    }
    return worst;
  };

  const HYP_RECUT_SIGS = [
    "3322", "2223", "2345", "22223", "222222", "oo", "o22", "222x",
    "*3333", "*2345", "*22222", "2*222", "2*234", "22*222", "o*222", "*22*222"
  ];
  for (const sig of HYP_RECUT_SIGS) {
    const orb = parseOrbifold(sig);
    let curC = createDefaultCarving(orb);
    let curR = buildRealization(orb, curC);
    for (let s = 0; s < 3; s++) {
      const nextC = createRandomCarving(orb, curC);
      const res = recutHyperbolic(orb, curC, curR, nextC);
      assert(res, `${sig} step ${s}: recutHyperbolic returned null`);
      const { carving, realization, Q } = res;
      assert(realization.areaError < 1e-5, `${sig} step ${s}: areaError=${realization.areaError}`);
      assert(realization.maxLorentzError < 1e-4, `${sig} step ${s}: lorentzError=${realization.maxLorentzError}`);
      assert(realization.quotient.exactTransferred === true, `${sig} step ${s}: quotient transfer fallback`);
      const hd = checkHypMarkers(curR, realization, Q);
      assert(hd < 1e-3, `${sig} step ${s}: marker orbit hypDist=${hd}`);
      if (realization.dirichletPoly) {
        let ang = 0;
        const nrm = realization.dirichletPoly.sideOutNormals;
        for (let i = 0; i < nrm.length; i++) {
          const c = Math.max(-1, Math.min(1, -mdot(nrm[(i - 1 + nrm.length) % nrm.length], nrm[i])));
          ang += Math.acos(c);
        }
        const dArea = (nrm.length - 2) * Math.PI - ang;
        assert(Math.abs(dArea - orb.areaNum) < 1e-4, `${sig} step ${s}: Dirichlet area mismatch ${dArea} vs ${orb.areaNum}`);
      }
      curC = carving;
      curR = realization;
    }
  }
}

console.log("ALL FENCHEL-NIELSEN MATHEMATICAL CHECKS PASSED!");
