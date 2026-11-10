# plane fixer, round 3 — 2026-11-09

Files: `src/plane.js`, `test/plane.test.js`, `dev/plane-demo.html`. Findings: qa/round3-triage.md § plane (11, 20, 21, 22,
23, 30/36 plane part = contract C2, 38, 40, 41, 42). Pictures: `qa/round3-plane/`. Step files and probe scripts of this
round live outside the workspace (session scratchpad); every picture says what it shows in its file name.

Each entry below is written when the fix is finished: what, files, how verified.

## Baseline (reproduced before any change, 22:45)

- `qa/round3-plane/before-phone-333-632.png` (plane demo, 236 px panes, dpr 2): every default tile sits in the lower
  third of its window (11, 23, 38); 333 In between / Hexagon: the purple chevron clusters run into the ▲ between them;
  632 Pentagon: the orange chevrons touch the apex ▲ (22); the 14 px handle hides the comma (632 Pentagon, 4∗2 Diamond)
  (21).
- `qa/round3-plane/before-phone-dense-mirror.png`: 22∗ with the seed below the mirror y = 0.4 (left) is greyer than
  above it (right) (40); 4∗2 at Wavy 1 is a dense net of dashes and wavy outlines (41); ∗× Skew: the handle's white
  disc covers the bold mirror edge (21).
- `qa/round3-plane/before-app-360-xx.png` (unbundled app, 360 × 640): the hint pill sits on the tile's lower seam (11).
- App at 1280 × 720, 333: the handle is 70 % down the 550 px plane pane (23).

## 11, 20, 23, 38 — the window is centred on the tile and follows a dragged tile (done 23:40)

- `src/plane.js`: the window keeps its scale (the short side shows 2 viewHalf) but its centre is now the scene's
  FOCUS, the bounding box of the current (warped) tile, or of the snowflake patch when `star` is given (= the
  kaleidoscope's corner, i.e. group.center, for the presets). A new group is shown centred at once; a cut chosen from
  outside (the seed jumps, or the metric changes, while nobody drags: a preset chip, `setSeed`, a hash) glides to the
  centre; while the person drags or nudges with the keys the window moves only as far as needed to keep the tile's box
  inside the inner part of the window (margin max(14 px, 10 % of the pane)). The glide is a critically damped spring
  (no overshoot): stiffness 18/s for a chosen cut (90 % in 0.22 s), 30/s while following a drag (0.13 s); it jumps
  instead under `prefers-reduced-motion` or without requestAnimationFrame (node). The seed is held on a leash: within
  viewHalf (less the largest handle's reach + 3 px) of `home`, the focus centre when the cut was chosen, so a drag can
  neither run away nor push the window further than about a tile. The drag stays relative: the seed moves by the
  pointer's world displacement, the glide adds nothing. `toCss`/`toWorld` describe the frame on screen. Wavy alone
  (same seed) moves the window only if the wavy tile leaves the inner part (it never does for the presets).
  Implementation details: the symmetry elements are gathered for a region the window can glide in (0.6 viewHalf
  around the window's centre, re-gathered beyond it); the motif layer is re-drawn when the window moves; one picture
  per frame even when the owner draws in the same frame (`onFrame` skips a frame already drawn). `P.getView()` adds
  `home`, `target`, `gliding`.
- Verified: `node --test test/plane.test.js` (new tests: centring for all 17 groups × presets × amp at 3 canvas
  shapes, kaleidoscope patch centred; preset → centred, Wavy → window unchanged; drag with live rebuild, 17 groups ×
  4 directions × 2 pane sizes, 40 steps each: the tile's box never leaves the inner part, the window moves only when
  needed and then exactly to the margin, the seed stays on its leash; keys follow without re-centring; the glide with a
  fake clock: monotone, on the straight line, no overshoot, largest step < 20 % of the way, exact at rest, one picture
  per frame, a drag during a glide moves the seed by exactly the pointer's displacement; reduced motion jumps).
- Real input (`qa/round3-plane/drag-check.txt`, plane demo, Chrome on the mini, phone 226 px pane dpr 2 and laptop
  622 × 550): pointer dragged 600–700 px past each corner/edge from the canvas centre for 333, 2222, o, 632 and held:
  the tile ends exactly at the inner margin every time (22.4 px phone, 54.8 px laptop; v1: only a corner of the tile
  showed, e.g. `qa/review-plane-cuts/drag-333-out-phone.png`). Pictures `qa/round3-plane/drag-<size>-<g>-<leg>.png`.
  While moving fast (~950 px/s) or across a rotation centre (the Dirichlet tile hops by most of a tile) the tile can
  stand partly outside for about 0.15 s while the window glides after it (worst 76 px on the laptop, 333/632 dragged
  straight down a line of rotation centres); at an ordinary speed away from such hops it stays inside. A preset
  change: 333 Rhombus → Hexagon glides 17 px (phone) / 41.5 px (laptop), largest step 2.2 / 4.9 px per frame, rests
  after 23 / 27 frames.
- Baseline vs now: `before-phone-333-632.png` vs `chev-226.png` (tiles in the middle instead of the lower third).
- Cost (`plane3/perf-probe.mjs`, Chrome on the mini, 622 × 550 dpr 2 and 226 px dpr 3): the plane's draw while the
  window glides (the motif layer is redrawn each frame) at most 1.8 ms, median 1.0–1.3 ms (4∗2, 632); while a drag
  pushes the window at most 1.3 ms. In the app (`app-1280-333-*.png`): 333 dragged far down ends with its tile box at
  y 351–495 of 550 (the 55 px margin); the Hexagon preset then lands exactly centred.

## 21 — the seed handle is a ring with an open centre (done 23:40)

- `src/plane.js` `drawHandle`: a teal ring (radius 0.46 × the tile's inradius, 5–7.5 px; 2.2–2.6 px wide) with a
  thin white rim and a 1.3 px pin-point at the seed; the rest of its middle is open, so the comma, a mirror edge or a
  seam under it shows through. While held, a faint annulus halo (alpha 0.18) around the ring. The handle is now drawn
  under the tile's bold edges (after the fill): a seed next to an edge no longer cuts it. Without the pin the open ring
  looked like the half-turn marks (a ring with a lens) on 22∗ and 2∗22, where the two sit one above the other
  (`final-sheet-laptop-amp0.png`); with it the handle reads as a target ⊙ (`pin-226.png`). No handle and no plane hint
  for `interactive: false`.
- Verified: test "the handle is a ring" (632, 4∗2, ∗×, 333, 22∗ at 226 and 622 px, held and not: one ACCENT ring,
  no fill covers the middle but the pin (≤ 0.27 r), the halo is an annulus, the bold edges are drawn after the ring);
  pictures `pin-226.png` (632 Pentagon / Kite, 333 Rhombus: the comma visible inside and around the ring; ∗× Skew:
  the bold mirror edge runs unbroken over the ring; 22∗: ⊙ under the fold mark ⊘).

## 22 — chevrons scale with their edge and keep clear of the vertex glyphs (done 23:40)

- `src/plane.js`: `chevronFit(edgePx, count, size, clearA, clearB)` (pure, exported): a cluster takes at most 40 % of
  its edge, stays clear of each end by the reach of the (enlarged) cone glyph there along the edge (`glyphReach`, the
  glyph's support function) + its white rim + 3 px (or half a bold edge at a plain corner); it shrinks to fit, down to
  0.45 of its size, and never loses a chevron (v1 dropped one: 333 In between's purple 3 → 2); below that it is left
  out and the colour alone names the seam. When the middle of the edge is too close to a glyph, the cluster slides
  toward the other end just enough. Ends, glyphs and directions correspond under the gluing, so the clusters drawn on
  two sewn edges are still exact images of each other (tested).
- Numbers (`plane3/chev-probe.mjs`): at 226 px (390 px phones) every cluster of every preset is drawn (0 of 196 left
  out; smallest scale 0.52, 333 In between); at 178 px (320–360 px phones) the clusters of two sliver edges are left
  out (333 In between 18 px, 632 Pentagon 14–15 px).
- Verified: test "chevrons: the count of every seam, …" (all 17 groups × presets × amp 0/1 at 622, 226 and 178 px: the
  strokes actually drawn have the seam's count, ≤ 40 % of the edge, ≥ 3 px from every glyph's ink — measured on the
  drawn paths — and partner clusters match under the gluing; only edges < 20 px may go without), test "chevronFit
  and glyphReach". Pictures `chev-226.png`, `chev-178.png`; close-ups at device resolution: 333 In between (3 purple,
  2 orange, 1 blue, a gap before the ▲) and 632 Pentagon.

## 40 — the current tile is never tinted (done 23:40)

- `src/plane.js`: `tintedCopies(copies, eps)` leaves out the identity copy, so the current tile's translucent fill
  always lies on the white ground: the same on either side of a mirror.
- Verified: test "the current tile is never tinted" (6 groups with mirrors, seeds on both sides of a mirror);
  `after1-phone-dense-mirror.png`: 22∗ below / above the mirror y = 0.4 now the same light teal (v1: greyer below,
  `before-phone-dense-mirror.png`).

## 41 — quieter glide axes on small panes, lighter copy outlines with Wavy (done 23:40)

- `src/plane.js` metrics: glide-axis alpha × 0.62 on panes under 300 px (0.31–0.62 instead of 0.5–1); copy outlines
  alpha 0.85 × (1 − 0.42 amp) (0.49 at Wavy 1; unchanged at Wavy 0).
- Verified: test "quieter lines"; `after1-phone-dense-mirror.png` (4∗2 Triangle / Quad at Wavy 1 on a phone pane: the
  dashes and wavy outlines recede, the bold mirrors and the tile stand out; v1 `before-phone-dense-mirror.png`).

## 42 — a second finger freezes the drag (done 23:40)

- `src/plane.js`: the view tracks the pointers pressed on the canvas. A second pointer during a drag freezes it (and
  is captured, so its 'up' comes back); if the first finger had moved less than 10 px (a pinch, not a drag) the cut
  goes back to where the drag began. Nothing moves the seed until every pointer is up; the drag reports its 'end'
  when its own finger lifts. Only the pointers of the gesture in hand are tracked (the drag's and those that came down
  during it), so a press that started no drag can never block a later one; a lost 'up' of a frozen gesture ends with
  the next primary pointer.
- Verified: test "a second finger freezes the drag" (pinch → back and frozen; drag then palm → frozen in place;
  blocked while a finger of the gesture is down; lost up recovered); real touch in Chrome (CDP, phone and laptop
  contexts): two fingers spread 40 px each → seed unchanged (v1: 0.746 → 0.353), then one finger moves the cut 30 px.

## C2 — setScene({ interactive }) (done 23:40)

- `interactive` defaults to true; false: no seed handle, no drags (pointer presses are ignored), no arrow keys (left
  to the page, no preventDefault), no plane hint, `cursor: default`, the canvas becomes `role="img"`,
  `tabindex="-1"`, aria-label without "drag"/"arrow keys". A drag in progress when a non-interactive scene arrives
  ends there (one 'end' at the new tile's seed). Back to interactive: cursor grab, role/tabindex as before.
- Verified: test "C2: interactive false …". `dev/plane-demo.html` now passes `interactive: fold !== 'snowflake'` like
  the app should (`&interactive=1|0` overrides; `show({ interactive })`; `getTile()` reports the window and the tile's
  box in canvas px).

## Final pictures (final code, 00:15) and deviations from the letter of SPEC 5.9

- `qa/round3-plane/final-sheet-laptop-amp0.png`, `-amp1.png` (plane demo, 17 groups, ~315 px panels, dpr 1) and
  `final-sheet-phone-amp0.png`, `-amp1.png` (~236 px panels, dpr 2): every tile centred, the handle ⊙, the four
  kaleidoscopes without handle (C2) with their patch centred; at Wavy 1 the copies' outlines are lighter.
  `chev-226.png`, `chev-178.png` (chevrons on short edges), `pin-226.png` (the handle next to fold marks and mirror
  edges), `drag-*.png` (held drags), `app-*.png` (the unbundled app: 390 × 780 333, 360 × 640 xx, 320 × 568 2222 —
  the tile mid-pane under the hint, which ui-layout moved to the top; ∗632 not draggable; 1280 × 720 333 dragged
  down, then Hexagon).
- Deviations (decided in round 3, written at the top of `src/plane.js`): the window is centred on the tile (or the
  snowflake patch), not on `group.center`, and follows a dragged tile; the seed's leash is centred on that focus.
  The handle is a ring with a pin-point, drawn under the tile's bold edges. Chevrons scale with their edge.

## For other owners (nothing blocking)

- **ui-app**: C2 is in as specified, and `src/app.js` already passes `interactive: fold !== 'snowflake'`. Two
  things to know: (1) a cut set from outside (`__folding.setPreset`, `setSeed`, a same-group hash) GLIDES the plane's
  window for up to ~0.45 s (a group change and a load jump at once), so a picture taken right after such a call may
  catch it mid-way; `__folding.plane.getView().gliding` says so. If the QA wants still pictures at once, ask me for a
  `P.settle()`; I did not add an unused method. (2) `onSeed(…, 'end')` now also comes when a scene that takes no drags
  (C2) arrives during a drag: once, at that scene's own seed.
- **reviewers / qa**: the handle follows the pointer exactly as before EXCEPT when the window follows the tile near
  the window's edge (by design); `P.toCss` is always the frame on screen.

## Tests (00:20)

- `node --test test/plane.test.js`: 29 / 29 (17 of v1, of which "window" was rewritten for the round-3 window: it
  asserted the window centred on `group.center`, which decision 23 replaces; the new test asserts the same scale,
  orientation and inverse at the same sizes for every preset and amp, centred on the tile; plus 12 new tests).
- `node tools/test-all.mjs` (aifoundry1, final run with the final plane code): 661 tests, 656 pass, 2 skipped,
  3 fail — all in `test/crosscap.test.js` (anchor 3, stage 2 acts, stage 2 "2" labels), the cross-cap fixer's files,
  edited at the time (`src/folds/crosscap.js` saved 23:20); nothing in them touches `plane.js`. All 29 plane tests
  pass there (and locally).
