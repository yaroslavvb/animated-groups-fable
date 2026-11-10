# Renderer — round 2 fixes (renderer fixer, 2026-11-09)

Files changed: `src/render3d.js`, `test/render3d.test.js`, `dev/render-demo.html` (only these). Pictures and numbers in
`qa/renderer-round2/`. Round 1's note "a marker's label is at the marker's upper right" (notes/renderer.md) no longer holds.

## 1. Marker labels keep off the lines (done, verified)

**Was:** every label sat at its marker's upper right, so at a corner whose edges leave toward the upper right it lay on
the bold edge (∗333 left corner, ∗632's ∗3 and ∗2, 333's "3"; integrator notes, "For the other owners").
Measured on v1 (`qa/renderer-round2/before-desktop.png` + `.json`: the fraction of each label's box covered by line or
marker pixels, found by rendering the same frame with and without lines and markers): 8 of 16 checked cases had a
label 22–43 % covered.

**Now** (`src/render3d.js`, section "marker labels"; pure functions `labelBox`, `lineCover`, `projectSegments`,
`chooseLabelSpots`, exported in `__test`; the renderer's `placeLabels` / `positionLabels`):
- 8 spots round the marker (E, NE, N, … at k·45°), the text box 3 px clear of the marker's rim (`LABEL_GAP`).
- Score per spot (lowest wins):
  - lines: 2 · Σ alpha · width · ∫ K along the projected line (dashed × 0.6); K = 1 within the line's half width + the
    label's 2 px halo of the text box, then drops to 0.3 within 1.5 px and to 0 at 6 px more: a bold edge across a
    label costs about its area, one across a corner ~0.4 of it, one passing near a little; continuous as lines move.
    (3-point Simpson over the part of each segment within reach; exact for a line parallel to a side.)
  - 3 × area over other markers (their disc's square + 1 px), 3 × area over labels placed before it, 8 × area outside
    the canvas (2 px margin);
  - up to 0.25 × box area for facing the projected frame centre instead of away from it (fades out within 10 % of the
    canvas from that centre); a faint tie-break toward the upper right.
- Hysteresis: a label leaves its spot only for one better by 13 % of its area + 10 % of the old score, and only after
  it has wanted to for 50 ms (`LABEL_WAIT`): a line sweeping across it in a few frames (an edge passing mid-fold) is
  let by instead of chased round the marker. Chosen afresh (no hysteresis, no wait) when the label is new or comes back
  into view, its marker jumped > 12 % of the canvas, the view turned > 20° at once, or after 250 ms without a placement
  (so a scripted `setView` / `setT` gives a reproducible picture).
- A label that changes spot glides there round its marker in 0.16 s (smoothstep on the angle; the box path never
  touches the marker). Labels are clamped inside the canvas (2 px). Sizes measured once per text (offsetWidth/Height),
  again after a resize; estimated from the font until the layer is laid out.
- Exact early-out: every score term is ≥ 0, so when a label's current spot scores below its own margin, the other seven
  are not scored.
- New in the API (all optional): `R.stats.labelsMs` (cost of the last frame's placement). Label elements carry
  `_cand` (spot 0..7), `_score`, `_scores` for QA scripts. `dev/render-demo.html?shape=torus&labels=6&polylines=36`
  ("labels" in its bar) = 10 labels among 40 polylines; `__demo.labels()` lists the visible labels with their spots.

**Design iterations that the tests now pin down** (each seen in a trace, not guessed):
- "Length of line inside the grown box" was a step function for a line parallel to a side: a label left a still-clear
  spot the moment a line touched its clearance band → the continuous kernel K.
- A score-proportional margin made a covered spot sticky (a bold line crossed a label for frames) → line weight 2,
  proportional part 10 %.
- With a 6 % margin, labels hopped aside and straight back as lines passed (26 quick returns in a dense sweep) → 13 %.
- 22× folding at t ≈ 0.2: an edge sweeps the label's right side in 4 frames; the label hopped NE→E→SE→NE, each time
  onto the spot the line was about to reach → `LABEL_WAIT` (in the app simulation: 4 quick returns at 0 ms, 1 at
  50 ms, 1 at 80 ms but 30 % more covered frames; 50 ms chosen).

**Verified:**
- Pictures (`qa/renderer-round2/after-desktop.png` + `.json`, single panes in `qa/renderer-round2/panes/`): ∗333, ∗632,
  333, 22× at t = 1 from the default view, az 40 el 30 and az −70 el 65 at 1280 × 720; ∗442 and 632 at t = 1, ∗632 and
  333 at t = 0.5; at 390 × 780 the four at t = 1 plus ∗632 az 40 el 30: every label 0 % covered (v1: up to 43 %), on
  the outer side of its corner, inside the canvas. Looked at: crops of every label and four panes at full size.
- `test/render3d.test.js`, 9 new tests (18 in all): spot geometry (exact gap, own side, glide path never on the marker);
  clipLength against sampling; projectSegments against the camera; outward preference in 8 directions; avoiding a bold
  line, a corner's two edges in 24 orientations, other markers, other labels, the canvas edges; hysteresis (a control
  that flips 59 times in 60 frames when chosen afresh does not move; slow line sweeps in 4 directions never touch the
  label and never send it back to a spot within 20 frames; fast sweeps are let by with no move; the 50 ms wait);
  the app's scenes in node (`buildScene` / `sceneLines` / `sceneMarkers`): ∗333, ∗632, 333, 22×, ∗442, 442, 632, 2222
  at t = 1 from 5 views on the laptop and phone panes — every label ≥ 1 px clear of every line, inside, off other
  markers and labels; and over time — the view turning 1° a frame at 60 fps (el 55 and 30) for ∗333, ∗632, 333, 22×,
  442, 2222: a bold edge never on a label for more than 3 frames running, ≤ 1 quick return, ≤ 14 moves a turn; folding
  0 → 1: ≤ 1 quick return, ≤ 8 moves.
- In the real renderer (headless Chrome, one placement per animation frame; `qa/renderer-round2/dynamics.json`):
  turning the app's ∗632, 333, 22×, ∗333 at t = 1 through 360° at 1° a frame moves each label 3–4 times (22× at
  el 30: 5 and 7; it follows the outward side round), 0 quick returns (22× at el 30: 1); folding 333, ∗632, 22× from 0 to 1 in 300
  frames: 2–4 moves, 0 returns (before LABEL_WAIT 22× had 6 moves and 2 returns). The dense demo (10 labels, lines
  wound all over a torus): 152 moves and 18 quick returns in a 360-frame turn — it keeps dodging lines.
- `dev/render-demo.html` (`qa/renderer-round2/demo-sheet.png`, panes in `panes/`): torus, Klein bottle, stacked flaps,
  the 10-label stress mode, and the torus and stress mode at 390 × 780. `dev/fold-demo.html`
  (`qa/renderer-round2/fold-demo-*.png`): 333 and ∗632 at t = 1, labels outward and clear. `node
  dev/render-touch-check.mjs`: 14 of 14 touch checks pass (drag, fling, pinch, twist, double tap, no page scroll).
- Cost (node, this Mac at load average 5–7, so ±50 %): 10 labels among 40 polylines of 100 segments (4000 segments),
  camera and projection included: about 1.0–1.7 ms a frame when every line crowds the labels (≈ 160 segments within
  reach of each label), 0.8–1.6 ms spread over the picture. In headless Chrome: the demo's 10 labels among 40
  polylines (4416 segments) 0.89 ms mean, 1.3 ms p95 (`__demo.perf()`); the app's scenes 0.06–0.12 ms mean.
- Whole suite (`node tools/test-all.mjs`, at the end): 573 tests, 572 pass, 0 fail, 1 skipped (the topology dump,
  skipped unless VERIFY_TOPOLOGY_DUMP is set). After it only a comment in `src/render3d.js` changed; its tests re-ran green.

**Known limits:** in a genuinely crowded moment (442 mid-fold: four bold edges cross near a cone point, every spot has
bold stroke within its halo) a label can sit on an edge for up to ~0.4 s; the dense demo scene (lines wound all over a
torus) leaves 1–3 of its 10 labels partly covered from some views because no spot is free there.
