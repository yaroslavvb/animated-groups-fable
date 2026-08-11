#!/usr/bin/env node
/* Recompute the regular-cyclic column of the colour/film report.
 *
 * This consumes the public Senechal--Wieting implementation in a separate
 * checkout of yaroslavvb/wieting-subgroups.  It enumerates index-N subgroups,
 * retains normal kernels with cyclic quotient, and then takes orbits under
 * the full affine normalizer of each wallpaper group.
 *
 *   node enumerate/verify_cyclic_colors.mjs ../wieting-subgroups
 *
 * The verifier recomputes the complete 17 x 6 matrix for linear-entry bounds
 * 1 through 6 and fails unless every bound gives the same result.  A
 * denominator-12 translation grid contains the half-, third-, and
 * quarter-lattice shifts in the plane-group normalizers.
 */

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repo = path.resolve(process.argv[2] || "../wieting-subgroups");
const require = createRequire(import.meta.url);
const enginePath = path.join(repo, "js", "subgroups-core.js");
const ENGINE_COMMIT = "dc192b34f206e6fd8e0533c6a25ab89a6055b9ff";
const ENGINE_SHA256 =
  "616c7cb7f7ea90f5b96ad2eec5714cbfc2535c2577138b5f7399abf3d9b2c254";
let L;
try {
  const digest = createHash("sha256").update(readFileSync(enginePath)).digest("hex");
  if (digest !== ENGINE_SHA256) {
    throw new Error(
      `subgroup engine SHA-256 ${digest}; expected ${ENGINE_SHA256} ` +
      `(wieting-subgroups ${ENGINE_COMMIT})`);
  }
  L = require(enginePath);
} catch (error) {
  console.error(`Cannot use pinned engine ${enginePath}`);
  console.error(
    `Pass a wieting-subgroups checkout at commit ${ENGINE_COMMIT}.`);
  throw error;
}

const I = [[1, 0], [0, 1]];
const key = M => M.flat().join(",");
const mm = (A, B) => [
  [A[0][0] * B[0][0] + A[0][1] * B[1][0],
   A[0][0] * B[0][1] + A[0][1] * B[1][1]],
  [A[1][0] * B[0][0] + A[1][1] * B[1][0],
   A[1][0] * B[0][1] + A[1][1] * B[1][1]],
];
const mv = (A, v) => [
  A[0][0] * v[0] + A[0][1] * v[1],
  A[1][0] * v[0] + A[1][1] * v[1],
];
const inv = A => {
  const d = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  return [[A[1][1] / d, -A[0][1] / d],
          [-A[1][0] / d, A[0][0] / d]];
};

function candidateKey(h) {
  const qs = h.pointSubgroup.map(key).sort();
  return h.lattice.key() + "|" + qs.join("|") + "|" +
    qs.map(k => h.lifts.get(k).join(",")).join(";");
}

function multiply(a, b) {
  const mt = mv(a.M, b.t2);
  return { M: mm(a.M, b.M), t2: [a.t2[0] + mt[0], a.t2[1] + mt[1]] };
}

// Affine translations use half-lattice units, matching subgroups-core.js.
function member(group, h, element) {
  const k = key(element.M);
  if (!h.lifts.has(k)) return false;
  const section = group.section.get(k);
  const dx = element.t2[0] - section[0];
  const dy = element.t2[1] - section[1];
  if (dx % 2 || dy % 2) return false;
  const reduced = h.lattice.reduce([dx / 2, dy / 2]);
  const lift = h.lifts.get(k);
  return reduced[0] === lift[0] && reduced[1] === lift[1];
}

// A normal index-N subgroup has cyclic quotient iff one coset has order N.
function quotientIsCyclic(group, h) {
  for (const p of group.pointGroup) {
    for (const z of h.lattice.representatives()) {
      const section = group.section.get(key(p));
      const element = {
        M: p,
        t2: [section[0] + 2 * z[0], section[1] + 2 * z[1]],
      };
      let power = { M: I, t2: [0, 0] };
      for (let order = 1; order <= h.index; ++order) {
        power = multiply(power, element);
        if (member(group, h, power)) {
          if (order === h.index) return true;
          break;
        }
      }
    }
  }
  return false;
}

function linearNormalizes(group, A) {
  const Ai = inv(A);
  const point = new Set(group.pointGroup.map(key));
  return group.pointGroup.every(p => point.has(key(mm(mm(A, p), Ai))));
}

function linearNormalizerMatrices(group, bound) {
  const out = [];
  for (let a = -bound; a <= bound; ++a)
  for (let b = -bound; b <= bound; ++b)
  for (let c = -bound; c <= bound; ++c)
  for (let d = -bound; d <= bound; ++d) {
    if (Math.abs(a * d - b * c) !== 1) continue;
    const A = [[a, b], [c, d]];
    if (linearNormalizes(group, A)) out.push(A);
  }
  return out;
}

function affineNormalizes(group, A, ax, ay) {
  const Ai = inv(A);
  for (const p of group.pointGroup) {
    const q = mm(mm(A, p), Ai);
    const vp = group.section.get(key(p));
    const vq = group.section.get(key(q));
    const Av = mv(A, [vp[0] / 2, vp[1] / 2]);
    const qa = mv(q, [ax, ay]);
    const z = [ax + Av[0] - qa[0] - vq[0] / 2,
               ay + Av[1] - qa[1] - vq[1] / 2];
    if (Math.abs(z[0] - Math.round(z[0])) > 1e-8 ||
        Math.abs(z[1] - Math.round(z[1])) > 1e-8) return false;
  }
  return true;
}

function conjugateCandidate(group, h, A, ax, ay) {
  const Ai = inv(A);
  const lattice = h.lattice.transformed(A);
  const pointSubgroup = [];
  const lifts = new Map();
  for (const q of h.pointSubgroup) {
    const qp = mm(mm(A, q), Ai);
    const vq = group.section.get(key(q));
    const vqp = group.section.get(key(qp));
    const oldLift = h.lifts.get(key(q));
    const t = [vq[0] / 2 + oldLift[0], vq[1] / 2 + oldLift[1]];
    const At = mv(A, t);
    const qpa = mv(qp, [ax, ay]);
    const raw = [ax + At[0] - qpa[0] - vqp[0] / 2,
                 ay + At[1] - qpa[1] - vqp[1] / 2];
    const integral = [Math.round(raw[0]), Math.round(raw[1])];
    if (Math.abs(raw[0] - integral[0]) > 1e-7 ||
        Math.abs(raw[1] - integral[1]) > 1e-7) {
      throw new Error("normalizer produced a nonintegral subgroup lift");
    }
    pointSubgroup.push(qp);
    lifts.set(key(qp), lattice.reduce(integral));
  }
  pointSubgroup.sort((a, b) => key(a).localeCompare(key(b)));
  return {
    group: h.group,
    index: h.index,
    pointIndex: h.pointIndex,
    latticeIndex: h.latticeIndex,
    pointSubgroup,
    lattice,
    lifts,
  };
}

function affineOrbitCount(group, candidates, bound, shiftDenominator) {
  const all = new Map(candidates.map(h => [candidateKey(h), h]));
  const edges = new Map([...all.keys()].map(k => [k, new Set()]));
  const matrices = linearNormalizerMatrices(group, bound);

  for (const h of candidates) {
    const hk = candidateKey(h);
    for (const A of matrices) {
      // Translations centralize p1 and cannot alter one of its subgroups.
      const shiftRange = group.name === "p1" ? 1 : shiftDenominator;
      for (let i = 0; i < shiftRange; ++i)
      for (let j = 0; j < shiftRange; ++j) {
        const ax = i / shiftDenominator;
        const ay = j / shiftDenominator;
        if (!affineNormalizes(group, A, ax, ay)) continue;
        const imageKey = candidateKey(
          conjugateCandidate(group, h, A, ax, ay));
        if (!all.has(imageKey)) {
          throw new Error(`normalizer image absent: ${group.name}, N=${h.index}`);
        }
        edges.get(hk).add(imageKey);
        edges.get(imageKey).add(hk);
      }
    }
  }

  let count = 0;
  const seen = new Set();
  for (const start of all.keys()) {
    if (seen.has(start)) continue;
    ++count;
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const u = stack.pop();
      for (const v of edges.get(u)) {
        if (seen.has(v)) continue;
        seen.add(v);
        stack.push(v);
      }
    }
  }
  return count;
}

function census(bound = 6, shiftDenominator = 12) {
  const rows = [];
  const totals = [0, 0, 0, 0, 0, 0];
  for (const name of Object.keys(L.CRYST_PRESETS)) {
    const group = L.makeCrystPreset(name);
    const counts = [];
    for (let n = 1; n <= 6; ++n) {
      const candidates = L.crystSubgroups(group, n);
      const classes = L.crystConjugacyClasses(group, candidates);
      const cyclicNormal = classes
        .filter(c => c.size === 1) // singleton conjugacy orbit means normal
        .map(c => c.representative)
        .filter(h => quotientIsCyclic(group, h));
      const count = affineOrbitCount(group, cyclicNormal, bound,
                                     shiftDenominator);
      counts.push(count);
      totals[n - 1] += count;
    }
    rows.push({ wallpaper_group: name, counts });
  }
  return { rows, totals };
}

const expected = [17, 46, 8, 13, 4, 13];
const runs = [1, 2, 3, 4, 5, 6].map(bound => ({ bound, result: census(bound) }));
const result = runs[runs.length - 1].result;
const tracked = JSON.parse(readFileSync(
  new URL("../docs/data/color-forward-census.json", import.meta.url), "utf8"));
const trackedRows = new Map(tracked.by_wallpaper.map(row => [
  row.wallpaper_group,
  [1, 2, 3, 4, 5, 6].map(n => row.regular_cyclic[String(n)]),
]));
const discrepancies = [];
const matrixSignature = value => value.rows
  .map(row => `${row.wallpaper_group}:${row.counts.join(",")}`).join("|");
const stableSignature = matrixSignature(runs[0].result);
for (const run of runs.slice(1)) {
  if (matrixSignature(run.result) !== stableSignature) {
    discrepancies.push(`affine-normalizer result changed at bound ${run.bound}`);
  }
}
for (const row of result.rows) {
  const wanted = trackedRows.get(row.wallpaper_group);
  if (!wanted) {
    discrepancies.push(`${row.wallpaper_group}: absent from tracked census`);
  } else if (row.counts.join(",") !== wanted.join(",")) {
    discrepancies.push(
      `${row.wallpaper_group}: computed ${row.counts.join(",")}; ` +
      `tracked ${wanted.join(",")}`);
  }
  trackedRows.delete(row.wallpaper_group);
}
for (const name of trackedRows.keys()) {
  discrepancies.push(`${name}: tracked row was not recomputed`);
}
console.log("group   N=1 N=2 N=3 N=4 N=5 N=6");
for (const row of result.rows) {
  console.log(row.wallpaper_group.padEnd(7),
              row.counts.map(x => String(x).padStart(3)).join(" "));
}
console.log("TOTAL  ", result.totals.map(x => String(x).padStart(3)).join(" "));
if (result.totals.join(",") !== expected.join(",") || discrepancies.length) {
  console.error(`expected ${expected.join(",")}`);
  for (const message of discrepancies) console.error(message);
  process.exit(1);
}
console.log(
  "regular-cyclic census verified (all 17 × 6 cells; bounds 1…6 stable)");
