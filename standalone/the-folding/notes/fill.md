# Fill port — one big comma per tile, filled in 3D (notes as I go)

Owner of this note: the PORT agent for the "big comma" fill (Tue 10 Nov 2026).
The owner's ask (9-10 Nov): "find a way to occupy more space on the Orbifold … there should be less empty space", then
"I meant for all the examples." The plan is the judge's: `qa/fill-judge.md` (prototype `dev/fill-judge/src`, `dev/fill-judge/tools`).

My files: `src/motif.js`, `src/palette.js`, `src/render3d.js`, `src/app.js`, `src/plane.js`, new `src/groupdata/motif.js`,
new `tools/motif-place.mjs`, `test/motif.test.js`, `test/folds.test.js`, `test/render3d.test.js`, `test/render3d-dom.test.js`,
`test/plane.test.js`, `test/app-url.test.js`, new test files of my own. NOT mine (a roll fixer works on them now):
`src/folds/roll.js`, `src/groupdata/roll.js`, `test/roll.test.js`, `test/klein.test.js`. QA scripts: `dev/fill-port/`,
pictures: `qa/fill-port/`.

## Log

### 00:20 — start
- Read SPEC.md, qa/fill-judge.md, the prototype (`diff dev/klein-a/src dev/fill-judge/src`: motif.js, motif-big.js, app.js,
  render3d.js, plane.js; palette.js unchanged there). The current `src/motif.js` is byte-identical to `dev/klein-a/src/motif.js`,
  so the motif half of the prototype applies as is; app.js, render3d.js, plane.js, palette.js moved on in round 3 and are
  merged by hand.
- The prototype's group data is older than src (hinge, crosscap, kaleido presets changed in round 3), so its table
  (`dev/fill-judge/src/motif-big.js`) is NOT copied: `tools/motif-place.mjs` regenerates it from the current src.

### 00:26 — before pictures (current src, dev/app-demo.html, the mini's Chrome; 0 console errors)
- Contact sheets: `qa/fill-port/before-{laptop,phone}-{fold1,plane0}.png` (`node dev/fill-port/sheet.mjs --tag before`).
- Filmstrips: `qa/fill-port/before-film-{333,22x,s442,o,xx}.png` (`node tools/filmstrip.mjs --page dev/app-demo.html --g <id>`).
- Looked at: every folded shape is a blank shell with a thin comma outline (1-6 % of the tile); xx alone carries a small
  grey filled half-comma at each end of the tube. Same as the judge's `base-*`.

### 00:40 — the port, first pass (src)
- `tools/motif-place.mjs` (new): the judge's `bigcomma.mjs` search, deterministic (fixed grid, fixed order, no
  randomness), one command (`node tools/motif-place.mjs`, about 11 s on one core here), `--check` (exit 1 when the file
  on disk is not what it would write), `--groups a,b` (print only). It writes `src/groupdata/motif.js` (new): per group
  `{ key, at, angle, s, stretch, fit, cover, coverFit, inTile, radius }`, plus `PLACEMENT_SOURCE` (fnv1a of the tool).
  `key` = `placementKey(group)` (src/motif.js): fnv1a of what the search reads (lattice, reps, viewHalf, the default
  tile rounded to 1e-6, the rules). The rounded place is measured again (its `fit`), so the stored numbers keep the gap.
  Checked: `--check` right after a run says up to date (byte for byte), and the result equals the judge's table to
  5e-6 for all 16 groups (`node dev/fill-port/motif-probe.mjs`): the default presets did not move in round 3.
- `src/motif.js`: motifFor from the table (30 %; o 29.4, ** 27.8, *x 21.2 with stretch 2), xx's seam comma two lobes
  wide (placeAcrossSeam(group, unit, SEAM_LOBES = 2), x SEAM_SCALE 2.6 across, x SEAM_STRETCH 1.4 along: 19.5 %, its
  copies 0.285 tile sizes apart), constants named (FILL_TARGET, FILL_GAP, FILL_RCAP, FILL_STRETCH, SEARCH_OUTLINE). No
  hash knobs. A stale table entry (key mismatch) keeps its centre and turn and shrinks until the copies keep the gap
  (one console.warn); a missing entry falls back to the v1 small comma (`place`, kept: klein.test.js imports it).
  The xx comma also shrinks if its copies would come closer than the gap (never with today's lattice).
- `motifTintMesh`: the prototype's (outline copies, the triangle's own piece via triCell, two-bit tint: bit 0 the
  mesh's own ghost bit kept, bit 1 the fill), with the outlines' edges binned by height. Same output as the prototype
  on 112 meshes (all groups, presets + a seed, amp 0/1; worst difference 0), 1.3-2.4x faster: at most 1.25 ms
  (`node dev/fill-port/tint-compare.mjs`).
- `src/app.js`: every fold's mesh is tinted; ghostColor is the star's alone again; `R.setStyle({ fill: MOTIF_FILL_3D })`
  once after createRenderer. `src/render3d.js`: `uFill`, decode `tq = floor(tint + .5)`, ghost = tq mod 2, fill =
  tq >= 2; `style.fill` (default MOTIF_FILL_3D), `setStyle({ fill })`; SURF_VS / SURF_FS in `__test`.
  `src/palette.js`: MOTIF_FILL_3D = [0.33, 0.55, 0.55], new MOTIF_ALPHA_PLANE = 0.4. `src/plane.js`: MOTIF_FILL at 0.40.
- Node, all 17 scenes (`node dev/fill-port/scene-probe.mjs`): every mesh tinted, nothing non-finite at t = 0.5 / 1,
  seams closed (<= 3.5e-12), median rebuild at most 7.4 ms (xx), at most 12 214 triangles.
- First look (`qa/fill-port/after1-laptop-{fold1,plane0}.png`): the judge's final3 picture, every shape carries a big
  teal comma, the plane's commas are lighter.

### 01:01 — the exact cut (src/motif.js motifTintMesh), the table again, tests
- LOOKED at zoomed t = 1 views (`qa/fill-port/zoom-{632,442,333,3s3}-t1-0_55_z2.2-laptop.png`): the prototype's cut
  (each triangle split along ONE chord between its two edge crossings; a triangle with no corner inside the comma not
  filled at all) broke the big comma's thin tail into teal shards on the coarse hinge meshes (632, 333, 442, 3*3), visible
  at zoom 1 on the laptop too (`qa/fill-port/panes/after1-laptop-fold1-632.png`, the tail between the two outline lines).
  Measured: the fill boundary strayed up to 0.034 tile sizes (about 12 px on the laptop) from the outline, the filled area
  up to 2.3 % off (`node dev/fill-port/fill-error.mjs`).
- Fix: every triangle an outline crosses is now cut EXACTLY along the outline: at all its edge crossings (any number per
  edge, shared with the neighbour, so no crack) and through the outline's own points inside it; the inside and outside
  parts are triangulated apart (ear clipping), each point twice (inside copy, outside copy), triangles keep order and
  winding, slivers that round to zero area in float32 are left out. A coarse 48 x 48 grid of the cells the outlines touch
  skips the triangles far from them. Filled area now exact to 0.01 % for every group; `motifCut.bad` (a cut left undone
  because rounding made it inconsistent) is 0 over every mesh tested (68 in motif.test.js, 196 scenes + the 612-step drag
  walk in folds.test.js). Pictures after: `qa/fill-port/zoomx-*.png` (the tail filled to its tip, matching the outline).
  Cost: motifTintMesh 1-3 ms for hinge groups, 3.2 ms o, 4 ms xx, 6.7 ms *632 (warmed, this Mac); a drag rebuild of o
  is about 7-8 ms in node.
- The table: the roll fixer turned ** a quarter turn at 00:52 (notes/roll-round4.md, finding 44), so its key changed and
  motifFor shrank it (the stale guard, one warning) until `node tools/motif-place.mjs` was run again (done, about 00:57).
  With ** turned, the search's first-found maximum lay only 44.5 % in the default tile: for the strips capped by
  FILL_RCAP (o, **) the old score had no preference among equal sizes. Tried (reverted at 01:07, below): treating "reached the cap" like
  "reached the target": among the placements that reach the goal (target or cap) the one most inside the default tile
  wins. o: 35.9 -> 100 % inside, **: 44.5 -> 100 %, same cover (29.4 %, 27.8 %); the 14 other groups unchanged (their
  target comes before the cap). So 15 groups now show the whole comma (>= 97.5 %) in the default tile; *x 80 %, xx by design.
- test/klein.test.js: the roll fixer rewrote it at 01:03 for the big comma (it now leaves the comma's placement, size
  and fill to test/motif.test.js); all 7 of its tests pass with the port. No change of it is needed from me.
- test/motif.test.js: the three small-glyph tests rewritten (why: in the file's header), new: table fresh (keys +
  PLACEMENT_SOURCE), tool deterministic (*632 twice, equal to the table), coverage, gap (outline distance, written apart
  from motif.js), xx two lobes, the stale guard and the missing-entry fallback, motifTintMesh for all 17 groups (area,
  tints, ghost bit kept, fill bit exactly inside, pieces of new points). 13/13 pass.
- test/folds.test.js: the ghost-colour test now expects SURFACE_GHOST for every non-star group and the fill in every
  mesh; a new sweep check 'fill' (every scene's drawn mesh: filled, cut consistent, counter-clockwise within float32,
  <= 20k triangles; largest 12 440). test/render3d-dom.test.js: the shader reads two bits; uFill reaches the GPU,
  MOTIF_FILL_3D by default. test/plane.test.js: the commas filled with MOTIF_COLOR at 0.40 over white.
- test/render3d.test.js, label test AMENDED (not a motif test; flagged here for the orchestrator): with the big comma its
  thin outline passes the cone points in some views; in 4 of 240 labels (632 and 2222 at az 120 el 20, both panes) the
  placement lays the label on it, in 632 because no spot of the eight is clear of it. The label stays legible (white
  halo; `qa/fill-port/lab-{632,2222}-t1-120_20-*.png`). Now: every other line never touches a label (as before); the
  comma's outline may only where no spot is clean (clear of every line by 1 px, of the bold lines by the placement's whole
  reach, inside the canvas, off the markers), and at most 1 label in 20. The renderer's placement is unchanged.
- Not mine, seen in the run: test/folds.test.js 'folds 3' and '3c' fail for xx at amp 1 (largest step 0.028 > 0.025,
  second difference 0.0045 > 0.0012 tile sizes): the roll fixer's new klein motion (TUNE.klein flat / spin), not the
  fill (these checks run on fold.mesh, before any fill). The bounds in test/folds.test.js are mine; see below.

### 01:07 — o's comma: the judge's scoring kept (tried and not taken)
- Tried: the tool's in-tile preference also among the placements capped by FILL_RCAP (o, **). It put o's and **'s whole
  comma in the default tile (plane: one whole comma in the tile), but on the torus the tile's middle rolls to the tube's
  underside: at t = 1 o's comma became a teal band under the torus and its top looked as empty as before
  (`qa/fill-port/after-laptop-fold1.png`, `panes/after-laptop-fold1-o.png`; the roll fixer's `qa/roll-round4/after-o-p0-default.png`
  shows the same). The judge's placement (the first largest one the search meets, 35.9 % in the tile) lies across the
  tile's left edge, which rolls to the top of the tube: the comma stays in the default view. Reverted to the judge's rule
  (the in-tile share decides only among placements that reach the target); ** keeps 44.5 % in its tile (the comma on
  the front of the turned tube, as in the roll fixer's `qa/roll-round4/after-ss-p0-default.png`). The tool's header says so.

### 01:09 — cost per drag frame in a browser (the mini's Chrome 157; `dev/fill-port/dragcost-browser.mjs` via
`node tools/shot.mjs --page "dev/app-demo.html#g=333" --steps dev/fill-port/dragcost-steps.json`), median / p95 ms:
motifTintMesh 0.3-1.1 (o 1.0, xx 0.9 at Wavy 1); the app's whole step (__folding.setSeed: rebuild + both panes, folded)
1.2-6.3 (xx Wavy 1 the most). The fill adds about a fifth to a drag frame.

### 01:11 — after pictures, LOOKED at (dev/app-demo.html, the mini's Chrome, 0 console errors)
- Contact sheets: `qa/fill-port/final-{laptop,phone}-{fold1,plane0}.png` (`node dev/fill-port/sheet.mjs --tag final`),
  against `before-*`. Every one of the 17 folded shapes carries a big teal comma (it was a blank shell with a thin
  outline); the outline stays; seams and rims read over the fill; the kaleidoscope stars stay grey with teal commas on
  them; the plane's commas are lighter (0.40) with the mirrors, dashed glides and centre glyphs on top. o: the judge's
  look (the comma across the top of the torus); **: the roll fixer's turned tube, the comma on its front.
- Filmstrips: `qa/fill-port/after-film-{333,22x,s442,o,xx}.png` (12 frames, default view): no colour change in time (the
  fill is part of the sheet), the kaleidoscope flaps carry their commas onto the ones beneath, xx's two halves ride at
  the tube's ends and join at t = 1 (with the roll fixer's new flat-8 / spin motion).
- Zoomed (2.2 x): `qa/fill-port/zoomx-*.png`: the exact cut, the tail filled to its tip.
- URL state: `dev/fill-port/url-steps.json` (#333, #*632, #g=%2A632&t=1&view=40/30/1.5,
  #g=xx&cut=1&seed=0.1/0.9&wavy=0.5&t=0.6, #g=o&t=1, #g=4%2A2&cut=2&t=0.75&view=-20/40/1): each loads its state and
  writes back the same hash, 0 errors, the mesh filled. No new hash key (HASH_KEYS unchanged, test/app-url.test.js green).

### 01:11 — the whole suite (node tools/test-all.mjs, lab box): 681 tests, 677 pass, 2 skipped (opt-in), 2 fail, not mine:
- test/klein.test.js 'klein: the 8 lies flat at the inner stop ...' — the roll fixer's own test on their work in
  progress (src/folds/roll.js changed again at 01:10).
- test/folds.test.js 'folds 3c: even' — xx random seed 2 at amp 1: second difference 0.00121 > 0.0012 tile sizes,
  the same klein motion (an earlier run, on roll.js of 00:57, also failed 'folds 3' at 0.028 > 0.025). These checks run on
  fold.mesh before any fill; the fill does not move a point.

## For the integrator (and the roll fixer)
1. After the roll fixer's last change to `src/groupdata/roll.js` (or any group data / default preset / src/domain.js):
   `node tools/motif-place.mjs` then `node tools/motif-place.mjs --check` (prints "up to date"). test/motif.test.js
   'the placement table is fresh' fails until then; meanwhile motifFor shrinks a stale comma to keep the gap (one
   console warning). About 11 s on one core.
2. test/folds.test.js MAX_STEP.klein = 0.025 and MAX_BEND.klein = 0.0012 were measured on the old klein motion. If the
   round-4 motion is final and the roll fixer agrees, re-measure them by the file's own rule (FOLDS_SEEDS=60, the
   largest value seen x about 1.5; the diagnostics of 'folds: the sweep really ran' print them) — I did not, the motion
   was still changing (roll.js 00:57, 01:10).
3. test/render3d.test.js: the label test "no label touches a line" now exempts the comma's thin outline where no spot is
   clean (see 01:01). Review it if you prefer another contract; the renderer's placement itself is unchanged.
4. SPEC 5.9 (not my file): motifFor now also returns `scale` ([across, along]) and `info.source`; motif.js exports
   motifTintMesh (two-bit tint), placementKey and the FILL_* rules; the placement table is src/groupdata/motif.js,
   written by tools/motif-place.mjs. Render3d: setStyle({ fill }); the tint is two bits (ghost, fill).

### 01:13 — the cut under stress (`node dev/fill-port/cut-stress.mjs 40`: 17 groups x (40 random seeds + seeds on
rotation centres and kaleidoscope corners, exactly and 1e-12 .. 1e-6 beside) x Wavy 0 / 0.35 / 1 = 3288 cuts)
- Found: 10 triangles of mixed tint, all ORIGINAL mesh triangles of no area (two corners on one spot along a crease, in
  333, 2*22, 632, 4*2 with seeds on a centre or a corner) that the outline crosses; the cut leaves zero-area triangles
  whole. Invisible (no area, in 3D too: both pieces map a crease point alike), but a tint per triangle is the contract.
  Fixed in motifTintMesh: such a triangle is left out (`motifCut.dropped`); also the cut's own box is now the vertices'
  box (mesh.bbox need not hold every vertex). After: 3288 cuts, 0 bad, 0 clockwise, 0 mixed, filled area exact to
  0.014 %, largest 12 450 triangles. test/motif.test.js 13/13.

### 01:14 — the whole suite, again (node tools/test-all.mjs, lab box): 681 tests, 679 pass, 0 fail, 2 skipped (opt-in:
SHELL_LAYOUT=1, VERIFY_TOPOLOGY_DUMP=1). The roll fixer's roll.js / klein.test.js of 01:13 brought the klein motion back
within test/folds.test.js's bounds and their own test; so item 2 below needs nothing unless the motion changes again.
The placement table is fresh for today's group data (src/groupdata/roll.js of 00:52).
- 01:15 `qa/fill-port/final-film-xx.png`: xx with the roll fixer's motion of 01:13; the two halves of the comma ride at
  the tube's ends and join at t = 1 (the bottle's lower left), no colour change in time.

## Files changed (all mine)
src/motif.js, new src/groupdata/motif.js, new tools/motif-place.mjs, src/app.js, src/render3d.js, src/plane.js,
src/palette.js; test/motif.test.js, test/folds.test.js, test/render3d.test.js, test/render3d-dom.test.js,
test/plane.test.js. Round-3 copies for diffs: dev/fill-port/*.round3.js. QA scripts: dev/fill-port/*.mjs.

---

# Fix-up after the fill's verification (Tue 10 Nov 2026, 01:50 - 02:45; the FIX-UP agent)

The verifier's four findings (all minor), reproduced, and what was done. Scratch: `dev/fill-fix/`, pictures:
`qa/fill-fix/`. The owner's ask behind it all: "find a way to occupy more space on the Orbifold ... there should be less
empty space when I fold it", "I meant for all the examples".

## Finding 1 — 22*'s comma 97.3 % in its tile (table and test said 97.8 %): REAL, fixed
- Reproduced: `node dev/verify-fill-probe8.mjs '22*,...'`: exact clipping 97.30 % (the tool's 18 x 18 grid said 97.8).
- `tools/motif-place.mjs`: the in-tile share is now EXACT (`exactShare`: the comma clipped by the tile's half-planes,
  Sutherland-Hodgman), on the comma's curve sampled 4 x finer than the drawn outline (`FINE_UNIT`), and the bar is the
  judge's 98 % (`SHARE_OK`). The last `fit` is measured on `FINE_UNIT` too: the acceptance table's other FAIL (*x 0.0694
  from its mirror image, rule 0.07) is gone. Target groups keep a 0.6 % size margin while searching, so the curve still
  covers 30 % exactly.
- `test/motif.test.js`: its own exact clipping (written apart), bar 98 % (it was 97.5 % on a 90 x 90 grid), the table's
  `inTile` checked to 6e-5 against the tool's measure; the gap test now asks for FILL_GAP itself on the drawn outline
  (it allowed 0.95 of it).
- Verified with the verifier's own script (`dev/fill-fix/verifier-numbers.mjs`, a copy writing here): in-tile 98.00 to
  100 % for all 13 non-strip groups (2222 98.003, 333 98.02, 632 98.17, 22* 98.87, ...), separations all >= 0.0700
  (** 0.070008, *x 0.070005 on its fine curve), cover 30.0 % (o 29.4, ** 27.6, *x 21.0, xx 19.5), no bad / mixed
  triangles, at most 12 444 triangles.

## Findings 2 and 3 — which tie the tool picks, and the comma out of view; *x the emptiest: REAL, fixed in the tool
- Reproduced and measured: the size and in-tile rules leave REAL ties, and the grid's first tie was kept.
  * a strip's comma slides along its strip without changing size (a translation u commutes with the group iff every
    rep fixes u: o anywhere, ** along y, *x along x; `freeDirections`, tested);
  * once the share is exact, many places lie wholly in a tile (2222: 100 grid places >= 99 %, 442: 192, 22x: 142).
  How much of the default view at t = 1 is comma varies a lot among these ties (`dev/fill-fix/strip-scan.mjs`,
  `tie-scan.mjs`): o 18 -> 46 % seen, ** 13 -> 48, *x 15 -> 28, 2222 15 -> 39, 333 16 -> 43, 22x 8 -> 42 %. So
  finding 2's risk was real for every group, not only o and **: whether the comma lay on the near face or the far face
  or the underside was luck.
- `tools/motif-place.mjs`: a third rule after size and in-tile share: among the ties, the place whose comma the default
  3D view at t = 1 shows most (`seenShare`: the default scene as the app builds it, folded at t = 1, through the
  renderer's own camera and default view, 4 layers per pixel, each weighted by what shows through the layers before it,
  SURFACE_OPACITY each). The ties: the grid's, 12 refined starts (22*'s grid had none at 98 %), and the strips' slides;
  then a pattern search on the view. Every entry carries `view` (= `viewKey`: a hash of the camera and of where the
  fold puts 50-odd points of the default tile at t = 1) and `seen`. Deterministic (`--check` byte for byte), one
  command, about 37 s on one core here. The kaleidoscopes have no view term (folded, every layer's comma lies on the
  tile's); xx is placed by rule as before (unchanged).
- Result, share of what one sees that is comma (seen; front = the front-most layer), default view, t = 1, before ->
  after: o 24 -> 48 (front 22 -> 61), 2222 27 -> 44 (22 -> 53), ** 37 -> 51 (47 -> 66), *x 20.5 -> 29 (20.5 -> 29),
  333 36 -> 44, 22x 25 -> 47 (18 -> 64), 22* 34 -> 35, 2*22 20 -> 36 (8 -> 45), 442 36 -> 49, 632 28.5 -> 36,
  3*3 25 -> 28, 4*2 29 -> 38.5; none less than before. In the browser (the verifier's measure, fill's share of the
  shape's pixels, laptop): o 40 -> 57 %, ** 45 -> 62, *x 19 -> 27, 2222 39 -> 52, 22x 43 -> 61, 442 40 -> 60,
  632 38 -> 43, 4*2 34 -> 43. (2*22 49 -> 43 and 3*3 32 -> 28 on that any-layer count: their comma moved from the far
  face, counted at full weight there though seen faint, to the near face; the pictures read better.)
- New `test/motif-view.test.js` (the guard finding 2 asked for), measured APART from the tool: on the mesh the app draws
  (buildScene + mapScene, the fill bit), the renderer's camera, laptop and phone panes: (1) every shape shows its comma:
  front >= 20 %, seen >= 22 % where the table chooses by the view (lowest today *x 29 / 29, 3*3 29 / 28), and 14 / 17 %
  for xx and the kaleidoscopes, which no table can move (xx is 18-26 / 21-25 % from every azimuth,
  `dev/fill-fix/az-sweep.mjs`, so a new spin of the bottle cannot trip it); (2) the table's `seen` is what the app draws
  (within 0.02; today within 0.003); (3) the guard is not idle: slid along their strips the o, ** and *x commas fall to
  17.5, 12.8, 17.3 % (below the floor), and the table's places are the best of the slides.
- `test/motif.test.js` 'the placement table is fresh' also checks `view` against `viewKey`: a fold that changes its
  shape at t = 1 makes the table stale like a lattice change does; the determinism test now also runs ** (placed by the
  view).
- Finding 3 (*x): its comma is now on the band's far half, front-most there, 27 % of the band's pixels (was 19 %), the
  best any place along the strip gives (the slides span 17-29 %). What remains is its cover, 21 %: the strip is 0.3
  wide, and the radius cap FILL_RCAP binds before a longer stretch could help (stretch 2.5: 20.0 %, stretch 3: 16.7 %;
  `dev/fill-fix/sx-stretch.mjs`). So *x stays the emptiest shape under the judge's caps: REQUEST below.
- Looked at: `qa/fill-fix/final-{laptop,phone}-{fold1,plane0}.png` (against `qa/verify-fill/v-*`): every comma that
  moved is now on the near face (o round the torus's near front, ** filling the tube's front, 2222 / 22x / 442 / 632 a
  big front comma, 2*22 dark on top instead of faint behind); the planes keep their pinwheels and mirror pairs, nothing
  crosses a mirror. Films `qa/fill-fix/film-{o,sx,22x}.png`: smooth, no colour change in time, the comma rides in view
  from t = 0 to 1. 0 console errors.
- Cost: unchanged in the browser (the mini's Chrome, `dev/fill-port/dragcost-*`): motifTintMesh 0.3-1.1 ms, a drag step
  at t = 1 1.2-6.3 ms median, p95 <= 6.6.

## Finding 4 — the amended label test: accepted explicitly, tightened, and the halo is now tested
- Reproduced: with the new places 2 of 240 labels touch the comma's outline (was 4): both 2222 at az 120, el 20
  (`dev/fill-fix/label-probe.mjs`). There every spot touches a bold edge or the comma's outline except one, which has a
  bold seam edge against the label's halo; the placement scores it 120 against 59 for the faint outline under the halo
  (`dev/fill-fix/label-scores.mjs`). Keeping the old rule would mean a bold edge against the label: worse.
- As the renderer's owner in this fix-up I accept the amended contract (written in the test's header, with this
  evidence) and tightened it: at most 1 label in 40 (was 1 in 20). The placement code is unchanged.
- Labels over the fill: measured in Chrome (`dev/fill-fix/label-contrast.mjs`, all 185 labels of the 13 groups with
  cone points, t = 1, the test's five views): 3 lie mostly over the fill; the lowest contrast of any label is 8.6:1
  (2222 az 120 el 20, wholly over the fill) and 3.2:1 with the halo taken away. So the halo is what makes them legible;
  new test 'labels: the white halo ...' (test/render3d.test.js) keeps it: dark ink, a white text-shadow of three
  layers or more reaching 4 px (`__test.LABEL_STYLE` exported for it; a comment at LABEL_STYLE says why).

## For the integrator (replaces item 1 of the port's list above)
1. After the roll fixer's last change (they are at work again, `dev/roll5`: roll.js changed at 02:26), run
   `node tools/motif-place.mjs` (about 37 s, one core), then `node tools/motif-place.mjs --check` ("up to date").
   Now ALSO needed when a fold's shape at t = 1 changes (not only the group data): test/motif.test.js 'the placement
   table is fresh' (key, view, PLACEMENT_SOURCE) and test/motif-view.test.js 'the table's seen is what the app draws'
   fail until then. The table is fresh against roll.js of 02:26:23.
2. test/klein.test.js: no change needed (xx's comma is placed by rule and did not move).

## Requests (files I do not own)
- qa/fill-judge.md (the judge), "Known weak spots": add *x (21 % cover, structural under FILL_RCAP; 27 % of the band's
  pixels at t = 1); 2*22 and 2222 no longer lie mostly on the far face (front layer 45 % and 53 % comma).
- SPEC 5.9 / 8 (orchestrator): motif placement now also depends on the folds at t = 1 and the renderer's default view
  (through the tool only; motif.js itself does not import them).

## Files changed in the fix-up (all mine)
tools/motif-place.mjs, src/groupdata/motif.js (regenerated), src/motif.js (DRAWN_OUTLINE, DRAWN_UNIT, the key includes
the drawn outline; header), src/render3d.js (LABEL_STYLE comment, exported in __test), test/motif.test.js,
test/render3d.test.js, new test/motif-view.test.js. QA scripts: dev/fill-fix/*.mjs.
