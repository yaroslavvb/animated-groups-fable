# The first run's report: core:sdf (13 Nov 2026, cut-off run; claims to check, not facts)

CORE-SDF REPORT — `src/sdf.js` and `test/sdf.test.js` are written, tested and measured. 21 tests pass on the mini, the whole suite is green, and a warm bake of 6016 edges at 1024 takes about 9 ms on this Mac.

**API as built** (pure, no imports, no module state)
- `bakeSDF({ origin = [0, 0], e1, e2, size, range, polys }) -> Uint8Array(size * size)`
  - Texel (i, j) is at index `j * size + i`, its centre at `origin + ((i + .5)/size) e1 + ((j + .5)/size) e2`.
  - `value = round(128 + 127 * clamp(sd / range, -1, 1))`; it is the exactly rounded value in the band, 1 or 255 outside, and 0 never occurs.
  - `polys = [{ pts: Float64Array | flat array | [[x, y], ...], hole }]` in world coordinates; nothing is wrapped.
- `sdfSample(data, size, s, t)`: bilinear between texel centres, repeating both ways.
- `sdfDistance(value, range) = (value - 128) / 127 * range`.
- `MAX_SIZE = 8192` (extra export, a guard on `size`).

**Differences from the brief, and why**
- **The `hole` flag decides the sign, not the direction of the points.** W = (outer polygons x is inside) − (holes x is inside), which is W of kit.js and shapes.js. An outer polygon listed clockwise is dark all the same, and a mirrored copy needs no re-ordering. The renderer's demo already lists counter-clockwise circles flagged `hole: true`; under the literal winding sum those holes would come out dark.
- **Sign: no row buckets.** Each edge adds ±1 at the texel right of each row crossing in an Int16 buffer; a running sum per row gives W. Crossings are weighted by the sign of the polygon's area in texel space, so det < 0 and either orientation come out right.
- **Distance: one oriented rectangle per edge, not the edge's world box grown by range.** It extends past each end by `range * sin(turn / 2)` of the vertex there, with the exact point-to-segment distance. This is exact (argument in the header), and the cost follows band area: cutting the same outline into 4× the edges costs 12 ms instead of 9.
- **Three small kernels** (`crossings`, `strip`, `finish`) instead of one function: the first bake of a fresh process dropped from about 50 ms to about 25 ms.
- **Lenient input:** a repeated point or repeated closing point is dropped, and a polygon without area is left out. Bad points, size, range or collinear e1, e2 throw.
- **Overlap is not repaired.** Polygons that overlap without coinciding stay dark, but their edges inside the dark stay outlines and show as a hairline. This follows the brief's definition of sd; it is tested and documented.

**Verification**
- **Tests:** 21 in `test/sdf.test.js`. Last lines of `suite.sh test/sdf.test.js`: `# tests 21 / # pass 21 / # fail 0 / # cancelled 0 / # skipped 0 / duration_ms 451`, `suite.sh: exit 0`. Whole suite: `# tests 854 / # pass 852 / # fail 0 / # skipped 2`.
- **What they cover:** everything the brief lists — in particular 3000 random texels on each of seven lattices (two with det < 0) and a speed floor of 500 ms.
- **Beyond the brief:** sixty random scenes with every texel against brute force, vertices and edges exactly on texel centres, rings of 3000-point circles, and a cross-module test.
- **Cross-module test:** `makeShapePrint -> copiesIn -> bakeSDF` against the print's own `margin` and `tone` on six groups. It skips if `src/shapes.js` cannot be loaded.
- **Planted faults:** `scratch-core-sdf/mutants-run.mjs` plants 39 faults one at a time in a copy of `sdf.js`; each makes a test fail. One guard against rounding (the slack at edge ends) needed a test written to catch it.
- **Against kit.js** (`verify-kit.mjs`): tone agrees with `kit.toneAt` at every texel for the demo comma and eight designs of the round on all 17 groups. Jumps across both cell seams stay within the distance bound.
- **Against shapes.js** (`verify-shapes.mjs`): 153 textures (nine designs × 17 groups, 1.41M texels) are byte-identical to `round(128 + 127 clamp(±margin / range))`.
- **Pictures looked at** (in `/Users/yaroslavvb/drive.unsynced/artifacts/the-folding-patterns/core-sdf/`): `sdf-demo-s632.png`, `sdf-demo-xx.png`, `sdf-paisley-s632.png`, `sdf-bigcomma-22x.png`. Each shows the raw texture, the print redrawn from the 1024 texture over two cells with the cell outlined, and an enlargement from 256, from 1024 and from the polygons. No seam shows; glides and mirrors read correctly; holes are holes.

**Speed** (node 25, i9-9880H, load 6–14 from the other agents, so ±30 %)

| Scene | 512 | 1024 |
|---|---|---|
| 6016 edges, range 4 texels | 3.5 ms | 6.3 ms |
| 6016 edges, range 8 texels | 4.5 ms | 8.4–9.5 ms |
| 6016 edges, range 16 texels | 7.1 ms | 13 ms |
| 6016 edges, range 32 texels | 13 ms | 24 ms |
| First bake of a fresh process, range 8 | 16 ms | 23–30 ms |
| Page's comma on the *632 cell (4416 edges) | 2.1 ms | 5.7 ms |

- Real designs of the round put up to 33,780 edges on a cell; the slowest bake at 1024 was 15 ms.
- At 2048 a bake takes 40–65 ms warm and 90 ms cold.
- About half of a bake at 1024 is the last pass over the texels.
- Buffers are 7 bytes per texel during a bake; there is no per-texel allocation.

**Still wrong, unverified, or worth knowing**
- **Thin parts vanish.** A part of the print thinner than about one texel is cut short and may leave a speck. The comma's needle tail shows this clearly at 256 and slightly at 1024. Designs should keep strokes at least 1.5 texels wide; 1024 is the size to use.
- **No GPU run by me.** I used only the JS twin. The renderer's own log (`scratch-renderer/final.log`) reports its GPU check of a texture baked by `src/sdf.js` as "px agree 100 %".
- **Edge position is quantised** to range / 254. A range of about 4–8 texels is the sensible choice.
- **The designs `hook` and `mosaic` threw in `find()` for all 17 groups** when I ran them (about 16:45), so they are not in the checks above.
- **`suite.sh` failed once** with "file has vanished" while another agent was deleting its scratch files during the copy; the retry passed.

**Files**
- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/src/sdf.js`
- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/test/sdf.test.js`
- `/Users/yaroslavvb/git/animated-groups-fable/standalone/the-folding/dev/patterns/scratch-core-sdf/` (`bench.mjs`, `cold.mjs`, `cold.sh`, `alloc.mjs`, `lastpass.mjs`, `verify-kit.mjs`, `verify-shapes.mjs`, `picture.mjs`, `png.mjs`, `scene.mjs`, `mutants-core.mjs`, `mutants-run.mjs`, `mutants-report.mjs`, `mutants-report-b.mjs`)
