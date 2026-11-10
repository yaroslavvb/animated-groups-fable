# Integrator notes (SPEC 5.12) — 2026-11-09

Files: `src/folds/index.js`, `src/app.js`, `test/folds.test.js`, `tools/qa-matrix.mjs`, `dist/index.html`; helpers
`dev/app-demo.html` (the app unbundled), `dev/app-frame.html` (the built page in a sandboxed iframe under a 50 px bar),
`dev/app-probe.mjs`, `dev/app-smoke.mjs`, `dev/app-cwprobe.mjs` (numbers in node), `dev/app-steps-*.json` (step files
for `tools/shot.mjs`); pictures in `qa/matrix/` (the QA run) and `qa/app/` (closer looks).

**No file of another owner was changed.** Everything below was done in the files above.

## How to run things

```
node build.mjs                         # -> dist/index.html (one file; prints the size)
node tools/qa-matrix.mjs --interact    # ONE Chrome, about 70 s: 86 matrix pictures + picker, sizes, cuts, mouse, frame, touch
node tools/qa-matrix.mjs --groups 22x,s632           # only some groups ("s" = "*")
node tools/qa-matrix.mjs --page dev/app-demo.html --out qa/matrix-dev   # the unbundled sources, no build needed
node --test test/folds.test.js         # 14 s; FOLDS_SEEDS=60 widens the sweep (57 s), FOLDS_WALK=600 the drag walk (55 s)
node tools/shot.mjs --page dist/index.html --steps dev/app-steps-look.json
```
`tools/qa-matrix.mjs` exits 1 if anything failed and writes `qa/matrix/report.json`. Never run it next to another
`tools/shot.mjs` / `qa-matrix.mjs` (SPEC 2: one browser at a time).

## `src/folds/index.js`

`createFold(group, domain, mesh?, opts?)` (default export; `buildFold` = the same with the mesh built inside),
`foldMeshOptions(group)` and `FOLD_TYPES`. It dispatches on `group.fold`, hands the roll folds the density they ask
for (`rollDensity`: o 88, ** 60, *x 80, xx 104, so their fold returns the mesh it was given and nothing is built
twice) and builds no tile mesh for the snowflake fold, which never looks at it. **Draw from `fold.mesh`**, never from
the mesh passed in.

## `src/app.js`

Two halves. The pure half (`buildScene`, `mapScene`, `sceneLines`, `sceneMarkers`, `seamGap`, `ghostColor`,
`creaseAlpha`, `lineScale`, `resolveGroupId`) turns a state into what the renderer is given and runs in node (it is
what `test/folds.test.js` tests). `start()` wires it to the shell and only runs where there is a document.

Decisions that are not in the SPEC:

- **One hint**: the shell's `#hint`; the plane view is created with `hint: false`. It says "drag to move the cut" until
  the first drag (ever), and for the four kaleidoscopes "no cut here: every edge is a mirror" until the seed is dragged
  in that group. `#wavy` is disabled for the kaleidoscopes (the wave slides along the mirrors: nothing would change).
- **Seam colours**: `assignEdgeColors(domain, previousDomain)` (plane.js) right after `buildDomain`, and the 3D lines
  use `edge.color`, as notes/plane.md asks. A drag or a change of the wave passes the previous tile (a seam keeps its
  colour under the finger); a preset chip and a group change pass none, so **a named cut always shows in the same
  colours** (those of `edge.cls`).
- **The metric stays while dragging.** A preset's `metric` is kept for the custom seeds that follow it; otherwise the
  tile of `o` (whose cuts differ by the metric only) would jump back to another shape at the first drag.
- **Cone-point markers** take the piece of the nearest boundary sample. A dot labelled `n` for a cone point, a ring
  labelled `∗n` for a corner on the mirror boundary. Markers of the same label that coincide (glued points, once the
  seam is closed) are merged, so at t = 1 exactly the special points of the orbifold's name are left — a test.
- **The motif in 3D** is `motifInTile` with `mesh.locate` per point (pseudo-cell folds: cell 0). For the
  kaleidoscopes the comma is copied onto every cell of the star with `fold.cellMaps`; the tile's own copy rides on
  the lid. Folded, the 2n commas lie above each other, one sheet apart: one sees a small stack of them.
- **The double line** (`fold.doubleLine(t)`: cross-cap, Klein bottle) is drawn last, thin, dashed, ink, x-ray 0.7.
  With the default cuts a closed seam lies exactly on it: dashes on the seam's colour.
- **Creases** fade with a smoothstep: hinge 0.45 → 1, cross-cap 0.2 → 0.47 (its hinges are done at the middle stop),
  snowflake 0.72 → 1.
- **The kaleidoscope's stack takes the tile's colour at the end.** The renderer's `ghost` colour goes from
  `SURFACE_GHOST` to `SURFACE_FRONT` during the last fold (`ghostColor`): folded up, every sheet is the tile, and the
  top sheet, which is all one sees from above, would otherwise leave the finished orbifold grey (the snowflake
  agent's first open point). Nothing in `snowflake.js` or `render3d.js` changed for it.
- **Camera frame**: bounding sphere of the vertex positions, eased by the renderer while playing, scrubbing and
  dragging; it jumps on a group change and for the `__folding` setters (so a screenshot is not taken mid-glide).
  Orientation and zoom are never touched except by "reset view" (and the renderer's own double-tap).
- **Line widths** follow the pane like the plane view's: × 1 at 520 px, × 0.72 on a phone, × 1.1 at most.
- **URL hash**: `history.replaceState`, with `location.hash =` as the fallback where a sandbox refuses it. Both the
  display label and "s" for "*" are understood (`#∗632`, `#s632`).
- **Errors** while building or drawing are caught, printed once with `console.error`, kept in `__folding.errors`,
  and the old picture stays. None has been seen.

`window.__folding`: `setGroup setPreset setSeed setAmp setT setView getState ready` (SPEC) plus `play`, `resetView`,
`openPicker`, `closePicker`, `errors`, `counters`, `renderer`, `plane`, `timeline`, `picker`, `scene()`. Every setter
draws both panes before it returns and returns `getState()`, which includes `seamGap` (largest gap between glued
boundary points at the current t, in tile sizes), `nonFinite`, `view { az, el, zoom }`, `hash`, `button`.

## For the other owners (nothing blocking; seen while integrating)

- **shell**: on phones narrower than about 375 px the column beside the plane holds three chips; the fourth cut of
  632 ("Pentagon") is reached by scrolling that column, and only a sliver of it hints at that (360 × 640, 320 × 568).
- **renderer**: a label always sits at its marker's upper right, so at a corner whose edges leave toward the upper
  right the label lies on the bold edge (∗333, left corner; ∗632, the ∗3 corner). It stays readable (the halo).
- **core**: with a seed within about 1e-6 of a crease the Float32 mesh has sliver triangles whose area is negative by
  rounding (down to −1.4e-9 of the tile; 442 seed (0.8376, 1.0000003), 333, 632). Harmless for the picture;
  `test/folds.test.js` allows for it. `dev/app-cwprobe.mjs` lists them.
- **cross-cap**: with any cut but "Pocket" the motion reaches as far below the plane as above it (smallest ratio
  0.70 over the sweep) and the sheet passes through itself in stage 2, as notes/crosscap.md says. The generic
  "toward +z" test therefore asks the cross-cap only for half as much rise as dip.
- **plane**: the kaleidoscope hint is the shell's HTML pill now, with your wording (`HINT_MIRRORS`).

## What was checked, and how (2026-11-09, evening)

- `test/folds.test.js`, 23 tests: SPEC 5.3 (1)–(4) for all 17 groups through `src/folds/index.js` (every preset +
  10 random seeds × amp 0 and 1 = 418 folds; with `FOLDS_SEEDS=60`: 2118 folds, also green): the mesh is drawable;
  `at(0)` exact identity; seams closed at t = 1 to 1.7e-8 tile sizes with the stored pieces and with pieces from
  `locate` (105 k pairs); largest step and second difference per 1/200 within per-type bounds; the watched steps cut
  into 32 move at exactly 1/32 of the largest step (bound: 1/16); finite at every stop and stage boundary ± 1e-12;
  `at(t)` functions independent; upward; near the tile; `locate` consistent with the triangles. A control test plants
  a jump, an open seam, a moved start, a NaN, a downward fold and shared state, and each is noticed. Then the pure
  half of `app.js` for 196 scenes (lines and markers finite and on the shape, colours, creases gone at t = 1, the
  markers at t = 1 = the orbifold's name) and a drag walk (612 scenes, each built from the one before, the seed on
  and next to rotation centres and crease crossings, the wave changing; `FOLDS_WALK=600`: 10 200 scenes, green).
- `tools/qa-matrix.mjs --interact` on `dist/index.html`: 113 pictures, 0 console errors, 0 page errors, 0 problems;
  every shot measured (both canvases drawn, seam gap, labels, layout: no scroll, nothing outside, no overlap, tap
  targets ≥ 44 px); 78 cuts (every preset straight and wavy) folded shut, worst seam gap 1.3e-8; a drag step costs
  2.3–9 ms (rebuild + both panes, CPU side, headless Chrome); 56 interaction checks with real mouse, keyboard and
  touch input, and inside a sandboxed iframe.

## Not verified / known limits

- **Chrome only** (headless, WebGL through SwiftShader): no Safari, no Firefox, no real phone, no real GPU. Touch was
  Chrome's emulation (CDP touch events at 390 × 780, devicePixelRatio 2). Frame rates were not measured on a GPU.
- **Motion was judged from stills** (t = 0, 0.5, 1 and a few more per group) and from numbers (the play test checks
  that t never goes back and no frame jumps); nobody watched it play.
- The dashed double line on top of a seam (Klein bottle, default cut: all the way round; cross-cap, default cut)
  reads as a seam with ink dashes. It is correct (the seam lies on the self-intersection) but busy.
- 22×, cuts "Bowl" and "Hexagon": between the middle stop and the end the picture is hard to read (the near half
  is turned over through the far half). The default cut "Pocket" is clean.
- The four kaleidoscopes at t = 1: the stack of 2n sheets is drawn as a slab with the tile's outline on top; the
  2n commas appear as a small ribbon. From the default view the ∗3 / ∗2 labels touch the outline.
- On a phone the kaleidoscope hint ("no cut here: every edge is a mirror") spans the 226 px plane and covers its
  lowest 30 px until the seed is dragged.
- `fold.at(t)` for the hinge groups hops when the seed is dragged across a mirror of the kaleidoscope with t > 0
  (notes/hinge.md); the app does nothing about it.
