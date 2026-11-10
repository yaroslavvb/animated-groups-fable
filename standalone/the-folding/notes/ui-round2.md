# ui fixer, round 2 part A — 2026-11-09

Owner group "ui": `src/app.js`, `src/folds/index.js`, `src/styles.css`, `src/index.template.html`, `src/timeline.js`,
`dev/app-demo.html`, `tools/qa-matrix.mjs`, tests `test/folds.test.js`, `test/shell.test.js`, `test/timeline.test.js`.
`src/hasse.js` is not touched in this part. Round 1 notes: `notes/integrator.md`, `notes/shell.md`.
Scratch probes of this round: `dev/ui2-*.mjs`, `dev/ui2-*.json`; pictures in `qa/ui2/`.

Each entry below is written when the fix is finished: what, files, how verified.

## 1. The anchor reaches every fold (SPEC 7 anchor contract) — done ~20:32

- `src/folds/index.js`: new pure `foldOptions(opts)`: a shallow copy of the options; `anchor` passes on as a fresh
  `[x, y]` when it is two finite numbers, anything else is dropped (= anchor = seed, the v1 path). `createFold` hands
  the module `foldOptions(opts)`, so every module gets the anchor; the ones that do not use it ignore it.
- `src/app.js`: `buildScene(group, { seed, metric, amp, anchor }, prev)` passes `{ anchor }` to `createFold` and
  keeps what it passed as `scene.anchor` (or null). In the page: `state.anchor` is set in ONE place, `usePreset`,
  i.e. when a group or a preset is chosen (load and URL hash go through `setGroup`, so they set it too); a drag
  (`onSeed`, `setSeed`) and the wave (`setAmp`) never touch it. `getState().anchor` reports it. The anchor is the
  preset's seed as written in the group data; no preset seed is moved by `clampSeed` (checked:
  `node dev/ui2-probe-anchor.mjs`), so at the moment a preset is chosen anchor = `domain.seed` exactly.
- Tests (`test/folds.test.js`): `foldOptions` (valid / 12 malformed anchors / other options kept / input untouched;
  an option reaches the module: the snowflake's `chirality`); `buildScene` records the anchor, none and malformed give
  null; for every group, generic seeds away from the creases: the fold with anchor = seed and the scene's fold equal
  the fold without an anchor at t = 0.25, 0.5, 0.75, 1 (1e-9 tile sizes) — the contract "missing anchor = seed", true
  now and after the hinge / cross-cap fixers land; the drag walk now carries the app's anchor (preset 0's seed) and
  checks it reaches every scene. A diagnostic line reports how far the folded shape (t = 1) wanders over the walk
  per fold type: today hinge 8.0, crosscap 3.5 tile sizes (v1: the shape follows the seed); it should drop to ~0
  for hinge and crosscap once their fixers land. `node --test test/folds.test.js`: 25 / 25.

## 3. A folded kaleidoscope shows one comma, not a ribbon — done ~20:42

- Cause: `buildScene` copies the tile's motif onto all 2n cells of the star (`fold.cellMaps`); folded, the copies lie
  one sheet apart and read as a thick ribbon (v1 picture: `qa/ui2/stack-v1-vs-now.png`, left of each pair).
- Fix (`src/app.js` only): `motifFades(fold, size)` gives each cell but the tile a fade window: the stage (span between
  two stops, one per completed crease) in which the cell FIRST moves, from 0.45 of it to its end. Every fold lays its
  flap on a stack that is already there, and a flap folded along a mirror carries its copies exactly onto the copies
  under it, so at its first landing a copy is redundant; fading it then leaves exactly one comma per pile at every
  stop, and at t = 1 only the tile's own copy (on the lid, `fade: null`). The stage is read off the motion itself
  (`fold.at` at the stops), not from snowflake.js internals. `motifFade(fade, t)` = 1 − smoothstep over the window;
  `sceneLines` draws a motif copy with alpha 0.7 × that and leaves out copies below 0.004. Motif entries now carry
  `copy` (cell), `part` (polyline of the tile's motif) and `fade`. Other groups: unchanged (alpha 0.7, no fade).
- Tests (`test/folds.test.js`, new): for the 4 kaleidoscopes × 4 seeds (preset + 3 random, so other base tiles) ×
  amp 0 / 1: a copy on every cell; the tile's copy never fades; each other copy fades in the second part of one stage
  ending at a stop; over 400 steps the opacity never rises and never changes by more than 0.04 in a step (no pop);
  at every stop each copy is either drawn or gone, no two drawn copies lie on the same spot (no ribbon), every gone
  copy lies exactly (1e-6 tile sizes, in the plane) under a drawn one (nothing leaves the picture), the gone ones are
  not handed to the renderer; at t = 1 only the tile's copy, in full. Other groups: every comma drawn in full at
  t = 0, 0.5, 1. Probe: `node dev/ui2-probe-fade.mjs` (per stop: drawn / faded / piles / orphans).
- Looked at (`node dev/ui2-look.mjs --only film`, unbundled app): filmstrips `qa/ui2/film-s632.png` (18 frames),
  `film-s442.png`, `film-s333.png`, `film-s2222.png`: 12 → 6 → 3 → 2 → 1 commas for ∗632, each landing comma
  thinning out as its flap comes down, no pop; neighbours: `film-s632-other-cell.png` (seed in another cell),
  `film-s442-side.png` (az 35, el 14), `film-3s3-cut-unchanged.png` (a group with a cut: comma as before);
  `stack-v1-vs-now.png`: v1 ribbon vs one crisp comma now, from above and from the side, all four kaleidoscopes.

## 2. A group change brings the zoom back to 1, smoothly, keeping the orientation — code done ~20:42

- `src/app.js`: `setGroup` calls `zoomHome()` when the group id really changes (not for the same group picked again,
  which acts like choosing preset 0). It glides the zoom from where it is to 1 in `ZOOM_HOME_SECONDS` = 0.35 s
  (`zoomBetween`: even steps in log zoom, smoothstep-eased, exact ends, never past them) by calling
  `R.setView({ zoom })` once per animation frame; with no `q` / `az` / `el` the renderer leaves the orientation alone.
  (render3d.js has no smooth zoom setter of its own; none was needed.) The glide stops at once for the person's
  hand on the 3D canvas (`pointerdown`, `wheel`, `keydown`, `gesturestart`, capture listeners), "reset view"
  (button and `__folding.resetView`) and `__folding.setView`. `prefers-reduced-motion: reduce`: the zoom is set at
  once. Preset, seed, wave and t never touch the zoom (unchanged). `getState().view.gliding` says a glide is running.
- Tests: `test/folds.test.js` (zoomBetween: exact ends, monotone, between the ends, half way in log zoom at half
  time, largest step ≤ 1.51 / 100 of the way, eased first and last steps, five start zooms in and out).
  `tools/qa-matrix.mjs --interact`: the touch check "the view survived the group change" asserted the OLD contract
  (zoom kept across groups); it now asserts the new one (orientation kept, pinch zoom back to 1 after the glide).
  New mouse-session checks: zoom kept through preset / seed / wave / t; a group change read frame by frame in the
  page (starts at the wheel zoom, ends at 1, never goes back, ≥ 3 frames on the way, az / el kept on every frame);
  the wheel zooms again before "reset view" so that check still has a zoom to reset.
- Looked at: `qa/ui2/zoom-glide.png` (333 at az 35 el 38 zoom 2.8 overflowing, then xx: 2.8 at 40 ms, 1.82 at 110,
  1.09 at 190, 1 at 280 ms, az / el unchanged; per-frame trace 2.8 → 1 in ~350 ms over 21 frames, never back);
  `qa/ui2/zoom-real.png` (zoom 1.9 kept through preset, seed, wave, t; a real wheel zoom 1.47, a real click in the
  picker on `o`: 1.40 at 80 ms, 1 at 680 ms, view kept); a pointer on the 3D view mid-glide stops it (zoom stayed
  2.337, gliding false).

## 4. The kaleidoscope hint on a phone: smaller, and it fades — code done ~20:42

- `src/styles.css`: `.pane-plane` is a size container (`container: plane / size`; its size comes from the grid, its
  children are absolutely placed, so nothing changes in the layout). On a small plane pane (`@container plane
  (max-height: 359px) or (max-width: 359px)`; fallback without container queries: `@media (max-width: 599px),
  (max-height: 479px)`) the hint is 11 px instead of 12.5, 5 px from the edge, tighter padding, as wide as its words
  but never wider than the pane − 12 px, and may wrap; there `.hint[data-faded]` is transparent, with a 0.8 s opacity
  transition. `.hint-part { white-space: nowrap }`.
- `src/app.js`: pure `hintState(group, presetIndex, dragged)` → `{ text, hidden, fades }` (the rules of v1, plus
  `fades` for the kaleidoscopes). `syncHint(fresh)` sets `data-faded` `HINT_FADE_SECONDS` = 4 s after the
  kaleidoscope hint appears; a group or preset choice (`fresh`) or its reappearing after a drag restarts it in full.
  On a large pane the attribute does nothing (the hint stays, as in v1). The cut hint ("drag to move the cut") is
  compact on a small pane too but never fades (it goes at the first drag, as before). The words are written as two
  halves that never break inside ("no cut here:" / "every edge is a mirror"), so on the 176–178 px panes of 320 / 360
  px phones the hint breaks after the colon instead of leaving "mirror" alone on a line; `textContent` is unchanged.
- Tests: `test/folds.test.js` (hintState for all 17 groups × 4 states, the message kept whole);
  `test/shell.test.js` (the container, the transition, both small-pane blocks: transparent when faded, 10.5–12.5 px,
  wraps, max-content capped by the pane; `data-faded` nowhere else; `.hint-part`). `tools/qa-matrix.mjs` touch
  session: on the 390 × 780 phone the hint is < 12.5 px, gone (opacity < 0.05) after 5.2 s, hidden while the seed is
  custom, back in full with the preset.
- Looked at: `qa/ui2/hint.png` — 390 × 780: one line, 196 × 19 px, covers the lowest 25 of 226 px (v1: ~35), gone
  after 5 s; 333's cut hint compact and still there after 4.6 s; 1280 × 720: unchanged and stays.

## Browser verification of 1–4 (unbundled app, Chrome on the mini via tools/browser.mjs) — ~20:49

- Task 1 (`node dev/ui2-look.mjs --only anchor`, fresh page loads): `getState().anchor` = preset 0's seed on load
  (632), preset 2's seed after its chip, unchanged after `setSeed`, after `setAmp`, after a real mouse drag in the
  plane (seed moved, preset −1); = 2∗22's / xx's preset 0 seed after `setGroup` / a hash change; after a reload
  with `#22x`: 22x's. `tools/qa-matrix.mjs --interact` has these as checks now (drag, chip, wave, hash, reload).
- Task 2, one refinement after looking: `__folding.setView(az, el)` WITHOUT a zoom no longer stops the glide (it
  only turns the view; the glide sets the zoom only), so a script that turns the view right after `setGroup` (as
  `tools/filmstrip.mjs` does) still ends at zoom 1; `setView(az, el, zoom)` with a zoom wins over the glide.
  qa-matrix check: "during the glide a script that only turns the view lets the zoom reach 1; one that sets a zoom
  wins".
- Task 4's CSS: the plane pane as a size container moved nothing: every box of the page (header, caption, both
  panes, both control rows, legend, chips, Wavy, Fold, scrubber, reset view) is where v1 has it at 1280×720,
  1440×900, 768×1024, 844×390, 390×780, 360×640, 320×568: largest difference 0 px (`node dev/ui2-look.mjs
  --only layout`, v1 = `snapshots/v1/index.html`). Pictures `qa/ui2/layout-now.png`.
- `node tools/qa-matrix.mjs --only-interact --page dev/app-demo.html --out qa/ui2/matrix-interact`: 61 of 61 checks
  pass (was 56 in round 1; the touch zoom check changed to the new contract, 6 new checks), 0 console / page errors.

## The anchor end to end, with the hinge fixer's anchored fold (src/folds/hinge.js of 20:41) — ~20:52

- `node --test test/folds.test.js`: the drag-walk diagnostic "folded shape (t = 1) wandering over the walk with one
  anchor" now reads hinge 0.00099 tile sizes (was 8.0 with v1's seed-following fold; the rest is the bounding sphere
  of a differently meshed tile), crosscap 3.5 (its fixer has not landed yet). The contract test "anchor = seed is the
  fold without an anchor" passes against the anchored hinge fold too.

## Final checks — ~20:55

- `node tools/qa-matrix.mjs --page dev/app-demo.html --out qa/ui2/matrix-dev` (no --interact): 105 pictures, every
  group at 1280 × 720 (t = 0, 0.5, 1) and 390 × 780 (t = 0, 1), the picker, five more window sizes (pane sizes as in
  round 1), 78 cuts folded shut (worst seam 1.3e-8), drag step 0.8–2.5 ms; 0 console errors, 0 page errors,
  0 problems. Log `qa/ui2/matrix-dev.log`.
- `node tools/test-all.mjs` (ran on aifoundry1): 572 tests, 571 pass, 0 fail, 1 skipped (the opt-in topology dump of
  verify-topology.test.js). Log `qa/ui2/test-all.log`. (A first run 3 minutes earlier had 2 failures in
  `test/render3d.test.js`, label placement, while the renderer fixer was saving that file; they pass now.)

## For the integrator (nothing blocking)

- `dist/` is not rebuilt (not mine to build): `node build.mjs`, then `node tools/qa-matrix.mjs --interact` on the
  built page. Its interaction session now has 61 checks; one changed meaning (touch: a group change keeps the
  orientation and brings the pinch zoom back to 1 — it used to assert that the zoom survived the group change).
- `dev/ui2-look.mjs [--only film,zoom,hint,layout,anchor]` re-makes every picture of this round in one browser.
- Snowflake fixer: the motif fade needs only `fold.stops` (one per completed crease), `fold.at`, `mesh.cells[i].poly`
  and `fold.cellMaps`; if a stop is ever added in the middle of a fold, the fade would run in that half-stage.
