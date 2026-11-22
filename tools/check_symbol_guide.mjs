#!/usr/bin/env node
// Geometry checks for the symbol guide (docs/correspondence-symbols.html).
//
// The figures claim that each mark is a symmetry of the tiles they draw.  This
// script tests that claim on the pure functions of
// docs/js/correspondence-symbols.js, without a browser:
//
//   1. one application of the operation carries the moving tile exactly onto
//      the next copy (position, orientation, handedness, height mod period);
//   2. the operation maps the drawn set of copies into itself, for both senses
//      of turn of a screw axis, wherever the image stays on the floor;
//   3. every copy stands at a height the symbol allows, the number of heights
//      is the number the page states, and the powers the cards quote hold;
//   4. the page lists exactly the symbols the module can draw.
//
// Usage: node tools/check_symbol_guide.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  basePose, clampSeed, defaultSeed, defaultSense, levelOf, rails, riseOf, specFor, staticCopies, stepMotion,
  stepRange,
} from "../docs/js/correspondence-symbols.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const page = readFileSync(`${root}docs/correspondence-symbols.html`, "utf8");
const ids = [...page.matchAll(/data-symbol-figure data-symbol="([^"]+)"/g)].map((m) => m[1]);

let failures = 0;
const check = (ok, message) => {
  if (ok) return;
  failures += 1;
  console.error(`FAIL ${message}`);
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const samePlace = (p, q) => near(p.x, q.x, 1e-9) && near(p.y, q.y, 1e-9)
  && p.m.every((v, i) => near(v, q.m[i], 1e-9));
const frac = (z) => ((z % 1) + 1) % 1;
const sameHeight = (a, b) => near(frac(a - b + 0.5), 0.5, 1e-9);

check(ids.length === 21, `the page should carry 21 figures, found ${ids.length}`);
check(new Set(ids).size === ids.length, "a symbol appears twice on the page");

const seeds = (spec) => {
  const base = defaultSeed(spec);
  return [
    base,
    clampSeed(spec, { ...base, x: base.x * 0.4 + 0.11, y: base.y * 0.5 - 0.07 }),
    clampSeed(spec, { ...base, x: -base.x + 0.23, y: base.y + 0.61 }),
  ];
};

const expectedLevels = {
  translation: 1,
  "rotation-2-0": 1, "rotation-2-1": 2,
  "rotation-3-0": 1, "rotation-3-1": 3, "rotation-3-2": 3,
  "rotation-4-0": 1, "rotation-4-1": 4, "rotation-4-2": 2, "rotation-4-3": 4,
  "rotation-6-0": 1, "rotation-6-1": 6, "rotation-6-2": 3, "rotation-6-3": 2, "rotation-6-4": 3, "rotation-6-5": 6,
  "plane-m": 1, "plane-axial": 1, "plane-c": 2, "plane-n": 2, "plane-d": 4,
};

for (const id of ids) {
  const spec = specFor(id);
  check(spec, `${id}: the module has no figure for it`);
  if (!spec) continue;
  check(spec.levels === expectedLevels[id], `${id}: ${spec.levels} heights, expected ${expectedLevels[id]}`);
  // a screw's figure starts with the turn that rises no more than half a period
  if (spec.kind === "axis") {
    const sense = defaultSense(spec);
    check(2 * riseOf(spec, sense) <= spec.n, `${id}: starts with the steeper turn`);
    check(sense === 1 || 2 * spec.m > spec.n, `${id}: starts clockwise without need`);
  }
  const senses = spec.kind === "axis" ? [1, -1] : [1];
  for (const seed of seeds(spec)) {
    const copies = staticCopies(spec, seed);
    check(copies.length > 1, `${id}: only ${copies.length} copy drawn`);
    const heights = new Set(copies.map((copy) => Math.round(frac(copy.z) * 1e6)));
    check(heights.size === spec.levels, `${id}: tiles stand at ${heights.size} heights, not ${spec.levels}`);
    for (const copy of copies) {
      check(copy.level === levelOf(spec, copy.h), `${id}: a copy has the wrong colour`);
      check(Number.isInteger(copy.level) && copy.level >= 0 && copy.level < spec.levels,
        `${id}: colour index ${copy.level} out of range`);
    }
    for (const dir of senses) {
      const [from, to] = stepRange(spec, seed);
      check(to > from, `${id}: the moving tile has nowhere to go (${from}..${to})`);
      for (let k = from; k <= to; k += 1) {
        const base = basePose(spec, seed, k, dir);
        const start = stepMotion(spec, base, 0, dir);
        const end = stepMotion(spec, base, 1, dir);
        const next = basePose(spec, seed, k + 1, dir);
        // 1. the step starts on its copy and ends on the next one
        check(samePlace(start, base) && near(start.z, base.h / spec.D), `${id}: step ${k} does not start on its copy`);
        check(samePlace(end, next), `${id} (sense ${dir}): step ${k} does not land on the next copy`);
        check(sameHeight(end.z, next.h / spec.D), `${id} (sense ${dir}): step ${k} lands at the wrong height`);
        check(near(end.z - start.z, riseOf(spec, dir) / spec.D), `${id} (sense ${dir}): step ${k} rises ${end.z - start.z}`);
        // the base copy is one of the drawn tiles
        check(copies.some((copy) => samePlace(copy, base) && sameHeight(copy.z, base.h / spec.D)),
          `${id} (sense ${dir}): step ${k} starts off the drawn tiles`);
      }
      // 2. the operation maps the drawn tiles into themselves
      for (const copy of copies) {
        if (copy.top) continue;
        const image = stepMotion(spec, copy, 1, dir);
        const onFloor = spec.kind === "axis" || copies.some((other) => near(other.y, image.y, 1e-9) || near(other.x, image.x, 1e-9));
        const hit = copies.some((other) => samePlace(other, image) && sameHeight(other.z, image.z));
        if (spec.kind === "axis") check(hit, `${id} (sense ${dir}): the image of a tile is not a tile`);
        else if (onFloor && !hit) {
          // rows are cut off by the floor: only an image beyond the last copy may be missing
          const [lo, hi] = [Math.min(...copies.map((c) => c.y)), Math.max(...copies.map((c) => c.y))];
          const [xlo, xhi] = [Math.min(...copies.map((c) => c.x)), Math.max(...copies.map((c) => c.x))];
          const beyond = image.y > hi + 1e-9 || image.y < lo - 1e-9 || image.x > xhi + 1e-9 || image.x < xlo - 1e-9;
          check(beyond, `${id}: the image of a tile inside the row is not a tile`);
        }
      }
      // rails pass through every copy of an axis figure
      if (spec.kind === "axis" && Math.hypot(seed.x, seed.y) > 0.1) {
        const lines = rails(spec, seed, dir);
        for (const copy of copies) {
          let best = Infinity;
          for (const line of lines) {
            for (let i = 1; i < line.length; i += 1) {
              const [p, q] = [line[i - 1], line[i]];
              for (let t = 0; t <= 1; t += 0.05) {
                const d = Math.hypot(p[0] + (q[0] - p[0]) * t - copy.x, p[1] + (q[1] - p[1]) * t - copy.y,
                  (p[2] + (q[2] - p[2]) * t - copy.z) * 1.75);
                best = Math.min(best, d);
              }
            }
          }
          check(best < 0.02, `${id} (sense ${dir}): a guide line misses a tile by ${best.toFixed(3)}`);
        }
      }
    }
  }
}

// 3. the powers the cards quote: (n_m)^p is the axis of order n/p with rise p*m/n mod 1
const power = (n, m, p) => {
  const order = n / p;
  const riseNum = ((p * m) % n) / p; // over `order`
  return Number.isInteger(riseNum) ? `${order}_${riseNum}` : null;
};
const quoted = {
  "4_1^2": "2_1", "4_2^2": "2_0", "4_3^2": "2_1",
  "6_1^2": "3_1", "6_1^3": "2_1", "6_2^2": "3_2", "6_2^3": "2_0", "6_3^2": "3_0", "6_3^3": "2_1",
  "6_4^2": "3_1", "6_4^3": "2_0", "6_5^2": "3_2", "6_5^3": "2_1",
};
for (const [key, value] of Object.entries(quoted)) {
  const [, n, m, p] = /^(\d)_(\d)\^(\d)$/.exec(key).map(Number);
  check(power(n, m, p) === value, `${key} should be ${power(n, m, p)}, the card says ${value}`);
}

if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log(`symbol guide geometry: ${ids.length} symbols consistent`);
