# Cross-cap paint fixer — Tue 10 Nov 2026 (notes as I go)

The owner's complaint (today): "crosscap vis is weird, It's like the surface, the painting jumped from one side of the
surface to another at one point. Fix that."

My files: `src/folds/crosscap.js`, `src/groupdata/crosscap.js`, `test/crosscap.test.js`, `tools/motif-place.mjs`,
`src/groupdata/motif.js`, `test/motif.test.js`, `test/motif-view.test.js` (and new test files of my own). Scratch scripts:
`dev/xcpaint/`, pictures: `qa/xcpaint/`. The orchestrator's measurements: `dev/xc-scan*.mjs`, `dev/xc-where.mjs`, `qa/xc/`.

## Log

### 07:20 — start, what the orchestrator's data say
- Read SPEC.md (all), notes/integrator-final.md, qa/fill-judge.md, notes/fill.md, notes/crosscap-round3.md, the sources.
- `qa/xc/area-*.json` (xc-scan2, the built page, 1/300 steps), largest 5-step-smoothed area change / its median over
  the play: Pocket 45-105 x (t 0.07-0.26, the flap turning over; the median is small because the Pocket's stage 2
  moves little), Bowl 3-16 x (t 0.73-0.91), Hexagon 5-11 x, seed (0.2, 0.3) from the Pocket 23-36 x (t 0.82-0.83).
- Why (geometry, src/folds/crosscap.js + hinge.js): the Pocket tile is [0, a/2] x [b/4, 3b/4] = [0, 0.65] x [0.45, 1.35],
  its crease y = 0.9; the closed shape sits on the cell C0 = [0, 0.65] x [0, 0.9] (anchorCell: the seed is ON the
  crease, the cell in front keeps its claim), so the ROOT is the near half y in [0.45, 0.9] and the far half (the
  flap) turns over toward the camera. The table's comma is at (0.290, 1.288): on the flap, 0.39 from the crease. The
  flap is edge-on to the default camera (az 0, el 55) at theta = 125 deg (t = 0.233), and a flap point r from the
  crease moves r per radian on the screen there: the comma sweeps from the top of the picture to the bottom.

### 07:35 — the measure counts the paper, not the paint (control)
- `dev/xcpaint/scan.mjs` = xc-scan2's measure on any page, with the 22x comma placement overridden in the page
  (PLACEMENTS['22x'] mutated before the app first builds 22x). Reproduces the orchestrator: Pocket 54.2 x (t 0.257).
- CONTROL, the comma made tiny (s = 0.02, nothing painted): Pocket peak 1.34e-2 (with the comma 1.52e-2), median
  4.1e-5 -> **331 x**; Bowl 16.7 x; seed (0.2, 0.3) 68 x. So the burst is the FLAP itself (a light sheet against white:
  > 40 levels), not the paint: no placement of the comma can bring this measure to 10 x. The Pocket's median is small
  because its stage 2 hardly moves.
- Comma on the root half (0.325, 0.57, angle 1.92, s 0.32): Pocket 181 x, Bowl 15.9 x, seed A 27.5 x.

### 07:50 — the conflict, and why (geometry)
- `dev/xcpaint/stillmap.mjs`, `dev/xcpaint/turnmap.mjs` (node): for every plane point, the copy in each cut's tile,
  its path over the fold, where it ends, and how far its sheet's normal turns. In every preset the plane band
  y in [b/4, b/2] = [0.45, 0.9] mod b/2 (call it R*: the far half of the cell C0, i.e. the far-lower sheet of the
  pillow) never turns over (normal within 80 deg of its start, path <= 0.3 tile sizes) and ends on the BOTTOM of the
  closed shape; everything else turns over by 140-180 deg (Pocket's flap; the Bowl's and Hexagon's near parts in stage
  2) and ends on the TOP, except a sliver along the crease.
- Reason: with flaps that lift toward +z (SPEC 5.3) and the fixed sheet puffed to -z, the sheet that stays put is
  always the bottom one, and the top of the closed shape (what the default camera sees) is made of sheet that turned
  over. So "the comma holds still" and "the comma is on top at t = 1" exclude each other for every cut.
- Why 22x looks worse than the hinge groups (whose commas ride flaps too: 22* travels 1.51 tile sizes, 2*22 1.25,
  632 0.98, 22x 1.11; `dev/xcpaint/travel-all.mjs`): the Pocket's crease is horizontal on the screen, so the flap swings
  in the plane that holds the default camera's line of sight: the whole comma squashes to a line and reappears below
  it, mirrored. 22*'s flap swings sideways, a page turn seen at 35 deg from edge-on.

### 08:20 — the candidates, measured and filmed (pictures in qa/xcpaint/)
| candidate | what | the paint | at t = 1 (default view) | films |
|---|---|---|---|---|
| B (round 3, before) | comma on the Pocket's flap (0.290, 1.288) | turns over in every cut (99 % Pocket, 77-93 % others), 1.0-1.5 tile sizes of path | on top: front 64 %, seen 47 % | qa/xc/22x-p*-full.png, film-base-flip-p0 |
| A (a): still band | comma on the far half of C0, y in [0.45, 0.9] | turns over 0 % in all three presets and seed (0.5, 0.75); path 0.35 | UNDER the top sheet: front 0, seen 8 % | film-root-*, film-after-* |
| (b) other half folds | C0 = the cell behind the crease | the comma stays, but on the bottom again, and the mouth faces away from the camera | worse than A | not built (argued above) |
| J (c): flaps tucked under | A's comma; the whole motion mirrored in z (dev copy dev/xcpaint/src, knob __xcFold.under) | still, as A | ON TOP (the closed shape is symmetric in z, so it is the same shape with the sheets swapped) | film-under-p0/p1/p2 |
- J is the best picture (the comma never moves and stays on top), but it folds AWAY from the viewer: SPEC 5.3 says
  "folding goes toward +z", and test/folds.test.js (not mine) checks it: zTop >= 0.5 |zBottom| for the cross-cap.
  J's worst ratio over 60 random seeds is 0.331 (`node dev/xcpaint/rise.mjs`; now 0.958). So J needs the
  orchestrator: a SPEC 5.3/7 exception for 22x and RISE.crosscap about 0.3. Not shipped.
- Shipped: A (the orchestrator's (a)), as a placement RULE in tools/motif-place.mjs (STILL), not a hand-picked place.

### 08:40 — A implemented: tools/motif-place.mjs STILL, table regenerated
- `STILL = { folds: ['crosscap'], turn: 120, steps: 32, cell: 0.006 }`: `stillOf(G)` samples, on a grid over the default
  tile (0.0046 apart), the largest turn of the sheet's normal over each preset's fold (with its anchor, 32 times); the
  comma (outline + 50 inner points) may only lie where that stays <= 120 deg (`stillTurn`, `stillScale`). Item 0 of
  the search, before size: `fitAt` = the gap's bisection capped by the still one. The entry gains `stillFit` and `turn`
  (22x only; the other 15 entries are byte-identical). 1 s for the field, 36 s for the whole table (one core).
- 22x now: at (0.321953, 0.780439), angle 5.014962, s 0.327076 = stillFit (gap fit 0.32758), cover 28.7 %,
  in the default tile 100 %, seen 8.1 %, turn 89.3 deg (the pillow's sides are vertical: 90).
- `node dev/xcpaint/hold.mjs` (the app's scenes): turns over 0.0 % of the comma in Pocket, Bowl, Hexagon and seed
  (0.5, 0.75) from the Bowl, path 0.35, farthest 0.33 tile sizes; wavy Bowl 3.0 %, wavy seed B 2.6 % (a lobe of the
  wavy cut); seed (0.2, 0.3) from the Pocket 29 % (that tile carries a third of the comma on a flap / its near part;
  round 3: 77 %).
- Tests (mine): test/motif.test.js cover test takes 22x as STILL_COVER (>= 28 %, s = min(stillFit, fit), the band
  limits it, turn <= STILL.turn); test/motif-view.test.js holds the folds in STILL.folds to seen >= 6 % with no front
  floor (front 0 / seen 8.0 % laptop and phone), with the reason at the top. 15/15 and 3/3.
- Whole suite (`node tools/test-all.mjs`; no remote host had room, it fell back to this Mac, 2 workers, 157 s):
  705 tests, 703 pass, 0 fail, 2 skipped (`qa/xcpaint/suite/run-1.log`), render3d's label test included.

### 09:05 — final table, the paint test, and what J would give
- Two refinements of the tool before the final table: the turn field is sampled at cell CENTRES (no sample lies on a
  tile edge, where a point has two copies: a grid column on x = 0 had read 180 deg for nothing), and the comments.
  Final 22x entry: at (0.321458, 0.782285), angle 5.00448, s 0.328393 = stillFit (gap fit 0.328813), cover 29.0 %,
  inTile 100 %, seen 8.4 %, turn 89.6 deg. `node tools/motif-place.mjs --check`: up to date. Every other entry is
  byte-identical to before (`diff dev/xcpaint/motif.table-before.js src/groupdata/motif.js`).
- NEW test/crosscap-paint.test.js (3 tests, computed apart from the tool on the app's drawn scenes, 1/120 steps):
  Pocket, Bowl, Hexagon: 0.0 % of the comma turns over (largest turn 90 deg), path 0.35, farthest 0.33 tile sizes;
  Bowl dragged to (0.5, 0.75): the same; wavy Pocket / Hexagon 0 %, wavy Bowl 3.2 % (<= 5 %); the reviewer's drag of
  the Pocket to (0.2, 0.3): 29.8 % (<= 40 %; round 3: 77 %); control: the round-3 comma turns over 98.3 %, path 1.11.
- J (flaps tucked under, the dev copy) with THIS table's comma: front 53 %, seen 39 % at t = 1 for every preset
  (`node dev/xcpaint/j-seen.mjs`; round 3 had 64 / 47 %). So J would give back the comma on top with nothing jumping.

### 09:40 — the opt-in FLAPS = 'under' (J) in src, ready for the orchestrator's call
- `src/folds/crosscap.js`: `export const FLAPS = 'over'` (shipped) and `opts.flaps`; with 'under' fold.at(t), the
  half pillow and the double line are the mirror image in z = 0 of 'over' (a wrapper at the end of createFold);
  `fold.flaps` says which. The header's new section THE PAINT says why. The 'over' motion is untouched (same table view
  key, same tests).
- My tests follow `fold.flaps` where they check a sign of z (test/crosscap.test.js: 'upward', 'pillow', the Pocket's
  "fixed sheet below", anchor 1's reference shape; with 'over' each check is exactly as before), and
  test/motif-view.test.js applies the 22x exception only while FLAPS is 'over'. New test (crosscap-paint.test.js):
  'under' is the exact mirror of 'over' at 14 times incl. the stage boundaries, for every preset straight and wavy; its
  flaps dip below the plane; with the table's comma the comma is 53.2 % of the front layer at t = 1 ('over': 0).
- Proven: a scratch copy of the workspace with FLAPS = 'under' and the table regenerated passes all 59 tests of
  crosscap / crosscap-paint / motif / motif-view (22x then front 53 / seen 39 %, the comma at (0.321429, 0.781875),
  the same size). What else the switch needs (not mine): test/folds.test.js RISE.crosscap 0.5 -> about 0.3 (flaps
  under: worst 0.331 over 60 seeds, `node dev/xcpaint/rise.mjs`), and SPEC 5.3 / 7 ("toward +z", "lifts the far side
  toward +z") an exception for 22x. Then `node tools/motif-place.mjs`. One visible difference: the outside of the
  closed shape is then the paper's FRONT colour (darker teal), as the flat tile is.

### 09:50 — final measurements (dev/app-demo.html = the current sources; the mini's Chrome)
dev/xc-scan2.mjs reads dist/index.html (the shipped build, which only the integrator rebuilds), so the same measure
was re-run on the sources by `dev/xcpaint/scan.mjs`; `blank` = the same fold with nothing painted (the floor the paper
sets). Peaks are the largest 5-step-smoothed area change per 1/300 step (share of the pane); x = over its median.

| cut | view | before (round 3) | after | blank paper | the paint's excess over the paper, before -> after |
|---|---|---|---|---|---|
| Pocket | 0/55 | 1.52e-2 (54 x) | 1.38e-2 (106 x) | 1.34e-2 (331 x) | +13 % -> +3 % |
| Pocket | 40/25 | 1.03e-2 (50 x) | 1.02e-2 (95 x) | 0.88e-2 (453 x) | +17 % -> +16 % |
| Bowl | 0/55 | 2.67e-2 (16 x) | 1.89e-2 (18 x) | 1.87e-2 (17 x) | +43 % -> +1 % |
| Bowl | 40/25 | 1.84e-2 (7 x) | 1.34e-2 (7 x) | 1.26e-2 (8 x) | +46 % -> +6 % |
| Hexagon | 0/55 | 5.75e-3 (8 x) | 5.04e-3 (9 x) | 5.13e-3 (14 x) | +12 % -> -2 % |
| Hexagon | 40/25 | 3.49e-3 (5 x) | 2.84e-3 (5 x) | 2.68e-3 (30 x) | +30 % -> +6 % |
| Pocket -> (0.2, 0.3) | 0/55 | 4.41e-2 (36 x) | 2.99e-2 (23 x) | 2.57e-2 (68 x) | +72 % -> +16 % |
| Pocket -> (0.2, 0.3) | 40/25 | 3.33e-2 (30 x) | 2.31e-2 (36 x) | 1.98e-2 (125 x) | +68 % -> +17 % |
| Bowl -> (0.5, 0.75) | 0/55 | 1.79e-2 (50 x) | 1.71e-2 (72 x) | 1.37e-2 (72 x) | +31 % -> +25 % |
| Bowl -> (0.5, 0.75) | 40/25 | 1.51e-2 (58 x) | 1.54e-2 (168 x) | 1.30e-2 (191 x) | +16 % -> +18 % |
- The "<= 10 x the median" acceptance is not reachable by moving the paint: the blank paper alone is at 8-453 x,
  because the Pocket's flap and the drags' early flaps sweep the picture while the rest of the play hardly changes a
  pixel. With the paint still, the median drops (the comma no longer moves in the quiet parts), so x grows for the
  Pocket and the Bowl drag although their peaks fell. What is left over the paper (+1 to +25 %) is the comma being
  COVERED by a sheet that folds over it, not moving (the Bowl drag's flap covers it at t 0.06).
- The paint itself (`dev/xcpaint/scan-paint.mjs`: the pane rendered with the fill in its colour and in red; the
  painted area's centroid): the Pocket's largest one-step jump of the paint, default view, 0.191 of the pane -> 0.004
  (40/25: 0.040 -> 0.005); every other cut <= 0.026 before and after (seed A 0.008 -> 0.022: the third of the comma
  that comes round with the seams).
- The paint on the sheet (`node dev/xcpaint/hold-compare.mjs`, the measure of test/crosscap-paint.test.js):
  share of the comma whose sheet turns over / mean path / farthest, tile sizes:
  Pocket 98 % / 1.11 / 1.19 -> 0 / 0.35 / 0.33; Bowl 79 % / 1.53 / 1.18 -> 0 / 0.35 / 0.33; Hexagon 91 % / 0.96 / 0.94
  -> 0 / 0.35 / 0.33; Bowl -> (0.5, 0.75) 95 % / 0.85 / 0.90 -> 0 / 0.35 / 0.33; Pocket -> (0.2, 0.3) 80 % / 1.44 /
  1.13 -> 30 % / 0.85 / 1.38.
- Films (LOOKED at): before `qa/xcpaint/film-before-{p0,p1,p2,seedA,seedB}-{0_55,40_25}.png`, after
  `qa/xcpaint/film-after-*`, wavy `film-after-wavy-{p0,p1}-0_55.png`, the flip close up `film-base-flip-p0-0_55.png`,
  J `film-under-{p0,p1,p2}-0_55.png`. After: the comma stays where it is on the sheet in every preset and in the Bowl
  drag; the flap (Pocket, Hexagon) or the near part (Bowl) comes over it, and from then on it is seen through that
  sheet; at t = 1 it lies under the top sheet, faint (its outline and a slight darkening). Pages:
  `qa/xcpaint/page-{1280,390}-{0,0.3,0.6,1}.png`, 0 console errors, seams 1.2e-8.
- Suite on the mini (`FOLDING_TEST_HOST=mini node tools/test-all.mjs`): 709 tests, 707 pass, 0 fail, 2 skipped
  (`qa/xcpaint/suite/run-3.log`, and again after the last comment edit: `run-4.log`). `node tools/motif-place.mjs
  --check`: up to date.

## Files changed (all mine)
- `tools/motif-place.mjs` — item 0 STILL (stillOf, stillTurn, stillScale, STILL_INNER), entries gain stillFit/turn.
- `src/groupdata/motif.js` — regenerated (22x moved; PLACEMENT_SOURCE; 15 other entries byte-identical).
- `src/folds/crosscap.js` — THE PAINT (header), FLAPS = 'over' + opts.flaps = 'under' (mirror wrapper), fold.flaps.
- `test/motif.test.js` — STILL_COVER (22x >= 28 %, s = min(stillFit, fit), turn <= STILL.turn), header.
- `test/motif-view.test.js` — 22x (FLAPS 'over') held to seen >= 6 %, no front floor; header says why. A weakening of
  that guard for 22x ALONE, for the owner's complaint; with FLAPS = 'under' the normal floors apply again.
- `test/crosscap.test.js` — sign checks follow fold.flaps ('over' = as before); one test title.
- NEW `test/crosscap-paint.test.js` (4 tests). Scratch: `dev/xcpaint/` (incl. a src copy with the J knob), `qa/xcpaint/`.

## For the orchestrator
1. Decide J (FLAPS = 'under'): the only way found to have the paint still AND on top at t = 1 (front 53 / seen 39 %
   vs 0 / 8 % now). Needs: SPEC 5.3 / 7 exception for 22x, test/folds.test.js RISE.crosscap about 0.3 (integrator),
   then `FLAPS = 'under'` and `node tools/motif-place.mjs`. My tests already pass that way.
2. SPEC § 9 "Big comma": add that the cross-cap's comma is held to the sheet that stays put (tools/motif-place.mjs
   STILL), 29 % of the tile, and that its 3D fill lies under the top sheet at t = 1 while FLAPS is 'over'.
3. The acceptance's "<= 10 x" measure flags the paper, not the paint (blank control above); a paint measure is in
   dev/xcpaint/scan-paint.mjs and test/crosscap-paint.test.js.
4. dist/index.html is not rebuilt (not mine); the change ships with the next `node build.mjs`.
