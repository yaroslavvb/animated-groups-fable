# hinge fixer, round 3 — 2026-11-09

Owner group "hinge" (SPEC 8): `src/folds/hinge.js`, `src/groupdata/hinge.js`, `test/hinge.test.js`, `dev/fold-demo.html`.
Findings (qa/round3-triage.md, section "hinge"): #15, #16, #17, #18, #19, #37. Pictures: `qa/round3-hinge/`.
Earlier notes: `notes/hinge.md` (round 1), `notes/hinge-round2.md` (round 2, the anchor contract).

Each entry below is written when the fix is finished: what, files, how verified.

## Reproduced (before any change)

- #15: the reviewer's sheet `qa/review-hinge-motion/presetswitch.png` (632 Kite and 4*2 Diamond move the closed shape to
  the cell across a crease).
- #16, #17, #18: `node dev/hinge3-shapes.mjs` classifies every preset's straight tile with the current sources:
  3*3 "Kite" (0.67, 0.1) = sides 0.303 0.303 0.594 0.406, no parallel sides, not a kite; 4*2 "Kite" (0.2, 0.45) = sides
  0.358 0.295 0.412 0.358, angles 90 99.5 90 80.5, not a kite; 22* "Skew" (1.1, 0.55) = a pentagon with two sides of
  0.040 (5.5 % of the tile size). Every other name of the eight groups is true of its tile (2*22 "Tall": 0.494 wide,
  0.600 tall).
- #37: `node dev/hinge3-puff.mjs`: thickness of the closed shape / longest side of T = 632 0.202, 442 0.229, 333 0.319,
  2222 0.431 (as the reviewer measured on v1).

## 1. #15 + C3: explicit anchors for the presets whose seed lies on a crease (done 2026-11-09 22:55)

What: `src/groupdata/hinge.js` — 632 Kite `anchor: [2/3, √3/18]`, 3*3 Kite (new seed, entry 2) the same, 4*2 Diamond
`anchor: [1/4, 5/12]` (the centroids of the shared cell). 4*2 Diamond's seed moved from (1/2, 1/4) to (1/4, 1/2): the
same square (the seeds on the crease y = 1/2 give it), but now the shared cell is HALF of the tile, so that cell stays
flat and the other half folds onto it (walk of 1 crease). With the old seed and the anchor the whole tile would have
tumbled over two creases onto a cell outside it. `dev/fold-demo.html`: `&anchor=preset` / `setAnchor('preset')` now
resolve as the app must (C3: `preset.anchor ?? preset.seed`).
How verified: `node dev/hinge3-anchor-probe.mjs proposed` — at t = 1 the camera frame (box centre of the vertices, as
`src/app.js` mapScene) is the same for every preset of every hinge group (632: (0.750, 0.144, 0.000) for all four;
4*2: (0.250, 0.375, 0.000) for all three; 3*3: (0.750, 0.144)); at t = 0.5 the x, y of the frame agree too; the
vertices in the shared cell move 6e-16 under the hinges. Before: 632 Kite (0.750, 0.217), 4*2 Diamond (0.625, 0.250).
Tests (`test/hinge.test.js`, 29 tests, all green on aifoundry1):
- "presets: the closed shapes of a group sit on ONE cell ..." (rewritten from "one fixed cell per group"): every preset,
  with the anchor the app passes, closes over the same cell — NO exceptions now (the old test had an EXCEPT list for
  632 Kite and 4*2 Diamond); a preset without `anchor` must have the shared cell as its own fixed cell (as before); an
  explicit anchor is allowed only where needed (seed ON a glued side of the shared cell, its own cell elsewhere), lies
  well inside the shared cell, walks one crease; at amp 0 the tile is that cell and its reflection (two pieces of one
  cell each) and the shared cell's points do not move at any theta (1e-12). The mouth check now looks at the cell of
  the closed shape.
- new "presets (contract C3, finding 15)": building every preset with `preset.anchor ?? preset.seed`, at t = 1 the
  image of 8 fixed plane points per group is the same for all presets (1e-9 tile sizes) and the camera frame's centre
  moves < 0.01, its box < 0.02 tile sizes, at amp 0 and 1.
- "anchor (SPEC 7) 1" and "2" now run every preset's seed AND every explicit anchor as anchors (1620 anchored folds,
  54 seed paths); nothing else in them changed.
- Request to ui-app (their #15 part, contract C3): `src/app.js` `usePreset` still sets `state.anchor = p.seed` (line 604
  at 22:44); it must be `p.anchor ?? p.seed`. Until then the app still shows the jump for 632 Kite and 4*2 Diamond.

## 2. #16, #17, #18: true names and better seeds (done 2026-11-09 22:55)

What (`src/groupdata/hinge.js`):
- 3*3 "Kite": seed (0.67, 0.1) -> (0.75, √3/12), the midpoint of the shared cell's hypotenuse (as 632's Kite): a true
  kite (sides 0.289 0.289 0.5 0.5, angles 60 90 120 90), = the cell and its reflection in the hypotenuse; anchor as above.
- 4*2 "Kite" -> "Quad", seed (0.2, 0.45) -> (0.24, 0.41) near the incentre of the shared cell. A seed inside that cell
  always gives a cyclic quadrilateral with right angles at the cone point and at the mirror corner, a kite only when it
  is the square (the reviewer's argument; `node dev/hinge3-legible.mjs 4*2 ...` finds nothing else), so no true "Kite"
  exists there. The new seed gives angles 90 109 90 71 (old: 90 99.5 90 80.5, nearly the Diamond square) and keeps
  0.09-0.12 from every crease.
- 22* "Skew" -> "Pentagon", seed (1.1, 0.55) -> (0.74, 0.47): the same kind of tile ("Skew" was a pentagon whose two
  translation-glued sides were 0.04 long): mirror 1.300, translation pair 0.247 + 0.247, half-turn 1.161 and 0.355 —
  every side at least 34 % of the tile size, largest angle 149.5. Not the reviewer's (1.08, 0.66): that is a second
  trapezoid of the same type as "Trapezoid" (mirror, half-turn, mirror, half-turn) and would need an awkward second
  name; the pentagon is the one other type of 22* tile and shows three seams. Seed 0.08 from the mirror (clamp 0.043).
- Every other name of the eight groups is true and distinct (orchestrator: "Hexagon" stays; fold names stay); 2*22
  "Tall" checked: the tile is 0.494 wide, 0.600 tall.
How verified: `node dev/hinge3-shapes.mjs` (all presets) and the new test "preset names are true of their straight
tiles ...": a claim per shape name (Triangle 3 sides, Equilateral, Quad, Rhombus, Square, Diamond = equal sides with
one diagonal upright, Kite, Trapezoid = exactly one parallel pair, Pentagon, Hexagon, Tall), names distinct within a
group, and every preset tile has every side >= 15 % of the tile size and every angle <= 155 degrees (finding 17's lesson).
It fails on the old presets (3*3 and 4*2 Kite not kites; 22* Skew unknown name, 5.5 % side).

## 3. #19: captions in one pattern (done 2026-11-09 22:55)

What (`src/groupdata/hinge.js`): 2*22 "disc with a cone point of order 2 and two mirror corners of order 2", 4*2 "disc
with a cone point of order 4 and a mirror corner of order 2", 3*3 "disc with a cone point of order 3 and a mirror corner
of order 3". The wording is that of the kaleidoscopes' captions ("disc with mirror corners of order 6, 3, 2"), not the
reviewer's "...; its mirror rim has two corners of order 2": same content, one pattern for all twelve disc and sphere
captions, and 67 characters at most (the reviewer's would be 77; the layout reserves two lines on phones).
How verified: new test "captions (finding 19)": every hinge caption equals the one generated from the orbifold symbol
(cone points before the ∗, corners after it); the same generator reproduces the four kaleidoscope captions exactly.

## 4. #37: plumper 632 and 442 pillows (done 2026-11-09 23:20)

What (`src/folds/hinge.js`, TUNING): '632' plump 0.85, '442' plump 0.75 (the reviewer's values; default 0.56 of the
inradius of T). Their T are thin triangles, so half the inradius made the closed shapes only 0.202 and 0.229 of the
longest side of T thick (`node dev/hinge3-puff.mjs`); now 0.307 for both, as 333 (0.319). 22x is untouched (the
cross-cap passes its own plump).
How verified:
- Pictures: `qa/round3-hinge/puff.png` (632 at 0.56 / 0.78 / 0.85, 442 at 0.56 / 0.75, 333 for reference; default view,
  az 60 el 15, az 0 el 20): from the default view the 632 pillow shows a bulge above its blue seam only at the higher
  values, and from the side it is a fuller lens with no crease ridge. In the app: `film-632-triangle.png`,
  `film-442-square.png` (12 frames, default view): the motion is unchanged, the closed shape reads as a pillow.
- Pass-through: `node dev/hinge3-crossprobe.mjs <632|442> <0.56|own> <amp> 10` (the reviewer's crossing measure on the
  current sources, presets + 10 random cuts, t from 0.5 to 0.93): the deepest crossing is 2e-4 / 3e-4 tile sizes
  (632, amp 1, old / new), 2e-4 / 2e-4 (442), all at t = 0.93, i.e. the two sheets touching along a closed seam; the
  plumper puff adds nothing.
- Test change, said plainly: "hinge: the profile of every cell" asserted 0.4 < hMax / inradius < 0.8 (the round-1
  rendering of SPEC 5.4's "about 0.5-0.6 x the inradius"); 632 at 0.85 cannot pass that. It now asserts 0.4 <
  hMax / inradius <= 0.9 (no spikes at the cone points) AND, new, that every closed pillow (2222, 442, 333, 632) is
  0.28-0.45 of the longest side of T thick — the requirement of finding 37, which the old values fail (0.20, 0.23).

## 5. #15 re-checked in the real app (2026-11-09 23:30)

The ui-app fixer has applied C3 in `src/app.js` (presetState: anchor = preset.anchor ?? preset.seed), so the request in
entry 1 is done. `node dev/hinge3-pw.mjs --scenario dev/hinge3-sc-appclicks.mjs --page dev/app-demo.html` (real clicks
on the preset chips, camera untouched, 1280x800): at t = 1 the camera frame's centre moves 0.0000 in x, y (z <= 0.0006)
over the presets of every hinge group, 2222 22* 2*22 442 4*2 333 3*3 632; at t = 0.5 (4*2, 3*3, 632) x, y do not move
either. Picture: `qa/round3-hinge/app-preset-clicks.png` (the reviewer's `presetswitch.png` redone for all eight).
Also in `qa/round3-hinge/`: `presets-c3.png` (the same in dev/fold-demo.html with anchor=preset), `motion-*.png` (the
motion of 3*3 Kite, 632 Kite, 4*2 Quad, 4*2 Diamond, 22* Pentagon, two directions), `plane-presets-1280.png` /
`plane-presets-390.png` (the new tiles in the plane, straight and wavy), `captions.png` (the new captions fit two lines
at 320x568, 390x780, 667x375 and one line from 844 px wide; never clipped, no page scroll).
22* Pentagon: the seed went from (0.74, 0.47) to (0.74, 0.49) after the phone picture: the handle ring touched the
mirror line at 390 px; now 0.09 above it (every side still >= 33 % of the tile size, ridge 151 degrees).

## 4b. #37 amended: 442 at 0.62, not 0.75 (2026-11-09 23:45)

The full suite showed one failure caused by entry 4: `test/render3d.test.js` "labels: in the app at t = 1 ... no label
touches a line" — 442 at 622x550, az 40 el 30: the "2" label is 1 px from a line. Confirmed in a scratch copy of the
workspace: green with the old tuning, red with 442 at 0.75; the same test with 632 at 0.85 is green. Scanning 442:
0.56 / 0.62 / 0.63 / 0.64 green, 0.65 / 0.66 / 0.70 / 0.72 / 0.75 red (both label tests). Picture of the red case in the
app: `qa/round3-hinge/label-442-az40-el30.png` — the label sits on the comma line that runs over the rim of the
plumper pillow (legible, but it touches). So 442 takes 0.62 (thickness 0.254 of the longest side, from 0.229), with
margin below the edge at 0.645; 632 keeps 0.85 (0.307). The new profile assertion is "a closed pillow is a quarter to
0.45 of the longest side of T thick" (catches v1's 0.202 and 0.229).

### Request to the renderer fixer (`src/render3d.js`, label placement), 2026-11-09 — nothing blocks
442 would read better at plump 0.75 (`src/folds/hinge.js` TUNING), as the reviewer of finding 37 asked. Then
`chooseLabelSpots` finds no spot for the cone label "2" of 442 (preset Square, t = 1, view az 40 el 30, pane 622x550)
that keeps 1 px off every line: the motif's comma runs over the rim right next to that cone point. If the placement
can treat the motif (drawn at alpha 0.7) as a softer obstacle than the seams, or try a spot further out, tell me (or
the next hinge owner) and 442 can go to 0.75: change '442' in TUNING and run test/render3d.test.js.

## Suite at the end (2026-11-09 23:55)

`node tools/test-all.mjs` (aifoundry1): 618 tests, 613 pass, 3 fail, none in my files and none caused by my changes:
- `test/crosscap.test.js` "crosscap: the timing without a crease (work 0, the Bowl) ..." and "stage 2: no faster than
  round 1 ..." — the cross-cap fixer's work in progress (their finding 2). The same two fail in a fresh copy of the
  workspace with my only behavioural change to `src/folds/hinge.js` (TUNING) reverted; 22x does not use my presets.
- `test/plane.test.js` "window: the short side shows 2 viewHalf ... centred on the tile" — group o, amp 1 (the plane
  fixer's window work, C2).
`test/hinge.test.js`: 29 tests, all green (26 kept, the "presets" test rewritten as described in entry 1, 3 new).
Also green: `test/render3d.test.js` (both label tests, with 442 at 0.62), `test/folds.test.js` (the generic SPEC 5.3
tests for all 17 groups), `test/motif.test.js` (no preset handle on a glyph), domain, mesh, verify-*.
Scripts of this round: `dev/hinge3-shapes.mjs`, `dev/hinge3-legible.mjs`, `dev/hinge3-anchor-probe.mjs`,
`dev/hinge3-puff.mjs`, `dev/hinge3-crossprobe.mjs`, `dev/hinge3-pw.mjs` + scenarios `dev/hinge3-sc-*.mjs`,
`dev/hinge3-steps-motion.json`, `dev/hinge3-steps-label442.json`.
