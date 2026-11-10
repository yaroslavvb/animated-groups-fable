# Renderer — round 3 fixes (renderer fixer, 9 Nov 2026)

Files changed: `src/render3d.js`, `test/render3d.test.js`, new `test/render3d-dom.test.js`; probes of my own
`dev/renderer-r3-probe.mjs` (pictures, before/after in one run), `dev/renderer-r3-scan.mjs` (zipper scan),
`dev/renderer-r3-checks.mjs` (findings 25, 26, 43 in the real app); pictures and numbers in `qa/round3-renderer/`.
No change is needed in anybody else's file. `dev/render-demo.html` is unchanged (its `__demo.loseContext()` now
also shows the message).
The round-2 renderer is kept for comparisons at `qa/round3-renderer/render3d-round2.js.txt` (the probes take it as
`--baseline`; they route it in place of `src/render3d.js` with `page.route`, so "before" and "after" come from the
same run with everybody else's code identical).

## #24 [minor] The outline renders as a black/grey zipper along a folded edge of a stack — fixed

**Cause (measured, not guessed).** A line segment is drawn as a camera-facing quad that runs past both ends by its
half width + 1.5 px (round caps, joints). The quad's corners carried the depths of the two ends, so the depth the
depth test saw at an end was off by `(zB − zA) · ext / (len + 2 ext)`, with the opposite sign on the other side of
every joint: a sawtooth along the line with the period of the segments (outline segments are 5–10 px). Where a line
lies on a sheet right at the edge of being hidden — the tile's outline on the lid of a kaleidoscope's stack, along a
folded edge — that sawtooth decided hidden/visible segment by segment, and the surface's tilt across the stroke turned
each segment's switch into a chevron: one black and one grey chevron per segment.

**Fix** (`src/render3d.js`, LINE_VS / LINE_FS only): the vertex shader passes the two ends' biased depths (`vZ`);
the fragment shader writes `gl_FragDepth` = the depth of the nearest point of the segment's centre line
(`mix(zA, zB, clamp(along / len, 0, 1))`, exact because NDC depth is affine along a projected straight segment). The
depth test (hidden pass GREATER, visible pass LEQUAL) is unchanged. The line's depth is now continuous from segment
to segment and exact at every pixel; nothing else in the pipeline changed.

**Tried and rejected** (pictures in `qa/round3-renderer/zipper-tex*.png`): deciding the whole cross-section at its
centre line from a depth texture of the nearest sheet (an extra depth pass into an FBO). It removes the zipper too,
but where a sheet's silhouette runs along the centre line (exactly the folded-edge case) any point sampling of that
silhouette aliases: fine ticks, or (taking the farthest of four texels) a new flicker of 20–40 flips per 100 px. The
per-pixel depth test resolves that silhouette with the multisampling and stays steady, so it is kept.

**Verified** (1280 × 720, dpr 2, `dev/app-demo.html`, both renderers in one run):
- The reviewer's cases (`qa/round3-renderer/zipper-A.png` and `zipper-fragdepth.png`, crops x4 `*-crop-*.png`):
  ∗442 from below (az 20, el −35) t 0.80–0.88, ∗442 side view (az 65, el 12) t 0.84–0.90, ∗632 default view
  t 0.944 (side ∗2–∗6), ∗442 default view t 0.68 (left side). Flips of the centre line between bold and x-ray per
  100 px: 18–24 before, 0 after in every case. From below the outline on top of the stack is now one even x-ray line;
  ∗632 t 0.944 and ∗442 t 0.68 are one even bold line.
- Fine sweeps through those moments (`sweep-A.png`: 38 frames, t steps 0.004–0.01): no frame with a zipper.
- Scan of the four kaleidoscopes × 3 views (default, below, side) × t = 0.40 … 1.00 in steps of 0.01, 732 frames
  (`dev/renderer-r3-scan.mjs`, `scan-A.json`): edge-frames whose centre line flips more than 4 times per 100 px:
  69 fixed, 0 new; 53 remain in both renderers with the same counts — those are not zippers but a two-tone stroke
  where a flap's or a stack's silhouette runs along the line (the geometry of finding 5, which the snowflake fixer
  is changing: `zipper-both.png`). Where the old renderer also had teeth along such a boundary (∗2222 t 0.81 from
  below, t 0.82 default), the new one draws a clean boundary.
- Ordinary seams and x-ray lines (`same-A.png`, and `same-final.png` with all of round 3: the same numbers):
  333 t 0.6 and t 1 az 30 el 30, 22× t 1 and t 0.7 az 200 el 35, ×× t 1, ○ t 0.5, 2222 t 1 az −60 el 20, ∗632 t 0.5,
  4∗2 t 1 from below, 442 t 0.45, ∗× t 1, ∗∗ t 0.8: at most 0.04 % of the pane's pixels differ (561 of 1.37 M, for
  ∗×), 0 for 442. The magnified spots with the most change show the old renderer's small teeth gone: the Möbius
  band's rim, the tube's rim where it passes behind the surface, specks in the dashes of 22×'s double line, and a
  seam's round end cap at a cone point now drawn at its end's depth (bold up to the marker; it was half x-ray).
  Nothing else changed.
- Known, unchanged: where a flap stands right on the outline from below, a thin bold rim can show along one side of
  the grey stroke (the stroke is wider than the spine that hides it); steady, not a zipper.
- Test: `test/render3d.test.js` "lines: every pixel of a stroke is depth-tested at its centre line's depth".

## #26 [minor] The 3D view ignored prefers-reduced-motion — fixed

**Was** (reproduced, `qa/round3-renderer/checks-before.json`, 333 t 0.6, real mouse input, reduced motion emulated):
a flick coasted 54–64° after the release, "reset view" glided over 21 frames, a wheel notch sprang over 30 frames,
an arrow key turned 0.01° at once and 9° over the next frames — the same with and without the preference.

**Now** (`src/render3d.js`): the renderer reads `matchMedia('(prefers-reduced-motion: reduce)')` and follows its
`change` event. While it applies, nothing moves by itself: no momentum after a drag (or a pinch's twist), the reset
(button, double-tap, 0 / Home) is immediate, the zoom takes its value at once with no spring and stops at its limits
with no elastic overshoot (wheel, pinch, + / −, Safari's gestures; no glide after a pinch), an arrow key turns the
view by its whole 9° step at once, the eased camera frame (setFrame) is taken at once (the dash length is still fixed
by the first / immediate setFrame, so dashes do not change length), and a label that changes spot jumps instead of
gliding. When the preference comes on, whatever is moving is put at its end (settleMotion). The fold's playback is
the app's and is untouched (it still plays, 6.0 s). Additions (optional): `createRenderer(canvas, { reducedMotion:
true | false })` overrides the query (default 'auto'); `R.reducedMotion` says which applies.

**Verified:** in the real app (`node dev/renderer-r3-checks.mjs`, `qa/round3-renderer/checks-after.json`):
reduced motion switched on live — coast 0°, reset 0 frames moving (home at the click), wheel 0 frames moving, arrow
9° at once; switched back — coast 46–63° (a real flick varies), reset 21 frames, wheel 29 frames, arrow about 1° at
once then 9° (as before);
playback with reduced motion runs to t = 1. Tests: `test/render3d-dom.test.js` (createRenderer in node on stand-in
canvas, WebGL2 context, DOM and clock): default behaviour unchanged (momentum, glide, spring); with the query: no
momentum, reset and Home at once, wheel at once and no spring, held exactly at the zoom limit, arrow 9° at once and no
more, frame at once; followed live (a coast and a reset glide under way stop at their ends when it comes on,
momentum returns when it goes off, the option overrides the query, dispose stops listening); a label that must move
jumps with it and glides without it. These tests fail on the round-2 renderer for the right reasons.

## #25 [minor] While the WebGL context was lost the pane showed stale labels and no message — fixed

**Was** (reproduced, `checks-before-ctx-*.png`): after `WEBGL_lose_context.loseContext()` the four "3" labels of 333
stayed in a blank pane, and still after `setGroup('*632')`; no message.

**Now:** on `webglcontextlost` the renderer hides every marker label and puts one line over the canvas, "The 3D view
paused: the browser reset its graphics." — a `<p class="r3d-message" role="status">` in the canvas's parent element
(not in the label layer, which is aria-hidden), across the canvas a little above its middle, click-through, MUTED
ink; it follows the canvas if the pane is resized while lost. Labels set while lost stay hidden. On
`webglcontextrestored` everything is uploaded again and drawn (as before), the message goes and the labels of the
current state come back. If the context cannot be set up again, the message stays and nothing is drawn. `R.lost`
(addition) says whether the context is lost. No button to re-create the context: the browser restores it by itself
(the renderer asks for that with preventDefault), and a restore cannot be forced for a real GPU reset.

**Verified:** in the real app (`checks-after-ctx-1-lost.png`, `-2-lost-group-changed.png`, `-3-restored.png`): lost
— no labels, the message centred in the pane, role status, inside the canvas; a group change while lost — still no
labels; restored — the message gone, the labels ∗6 ∗3 ∗2 of the new group, `R.lost` false. Tests in
`test/render3d-dom.test.js` (two).

## #43 [polish] The 3D canvas had no role, and its label named only gestures — fixed

**Now:** unless the page set them, the canvas gets `role="application"` (as the plane does: a screen reader hands it
the arrow keys), `aria-roledescription="3D view"` and the label "Fold in 3D. Drag or arrow keys to turn; scroll,
pinch, + or − to zoom; double-tap, 0 or Home to reset." Attributes the page sets itself are kept.
**Verified:** Chrome's accessibility tree (CDP, `checks-after.json`): role application, that name, roledescription
"3D view", focusable. Test in `test/render3d-dom.test.js`.

## Also checked (after all four fixes)

- Phone, 390 × 780 at dpr 3 (`zipper-phone.png`, crops `zipper-phone-*-crop-*.png`): the same reviewer cases; the
  zipper of the old renderer (∗442 from below t 0.83–0.86, chevrons) is gone. What shows instead at t 0.83 from below
  is a solid dark outline with light dashes along it: the crease lines on the lower sheets, which from below lie
  nearer than the outline on top of the stack, drawn over the outline's x-ray (the app now draws a kaleidoscope's
  outline with a stronger x-ray, `KALEIDO_EDGE_XRAY`, for finding 5). That is the picture's content, steady along the
  line; the creases fade out over the last fold.
- Whole folds as filmstrips with everybody's current code (`film-s442-below-t06-1.png`, ∗442 az 20 el −35,
  t 0.6–1; `film-s632-default-t07-1.png`, ∗632 default view, t 0.7–1): even outlines in every frame.
- `node dev/render-touch-check.mjs`: 14 of 14 touch checks pass (drag, fling, pinch, elastic limit, twist, double tap,
  no page scroll). `dev/render-demo.html` (`demo-*.png`): torus as before; `loseContext` shows the message centred at
  1280 and 390 wide; restored as before.
- `node --test test/render3d.test.js test/render3d-dom.test.js`: 26 of 26. Whole suite (`node tools/test-all.mjs`,
  aifoundry1, 660 tests): every renderer test passes; the only failures are 2 tests in `test/crosscap.test.js`
  (anchor path across a crease; stage-2 pass-through for Bowl), the cross-cap fixer's work in progress — no file of
  mine is involved (the cross-cap fold's positions are computed in node; the renderer is not loaded there).
