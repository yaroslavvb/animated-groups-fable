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
  normTime,
  normSpace,
  apply3,
  poincare,
  liftDisk,
  frameMap,
  hypDist,
  lorentzError,
  buildRealization,
  generateTiling
} from "../docs/js/fenchel-nielsen/hyperbolic.js";

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

console.log("ALL FENCHEL-NIELSEN MATHEMATICAL CHECKS PASSED!");
