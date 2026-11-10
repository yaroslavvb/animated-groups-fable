# ui-layout fixer, round 3 — 2026-11-09

Files: `src/styles.css`, `src/index.template.html`, `test/shell.test.js` (SPEC 8). Findings: `qa/round3-triage.md` § ui-layout
(#6 #7 #8 #9 #11 #30 #31 #32 #33 #36 #48 #49 #50 #54 #55). Probes of this round: `dev/uil3-*.mjs`; pictures `qa/round3-ui-layout/`.
Until src/app.js sets `#app[data-fold]` / `#app[data-features]` (contract C1, ui-app), `dev/uil3-look.mjs --attrs auto`
sets them by hand from the table in that file, so the CSS can be judged.

Baseline (v1 CSS, unbundled app, `qa/round3-ui-layout/baseline.json`): at 375x498 (iPhone SE in the frame) plane 151,
fold 351x151, the column hides chip 3 (and 4 of 632); 632's fourth chip hidden at 320x568, 360x640, 390x614, 390x730;
chips cut with an ellipsis at 667x375, 740x360, 844x390 (632); legend 3 rows (52-55 px) everywhere below 880 px;
caption always reserves 2 lines below 540 px; text at 10.5-12.5 px in the legend, hint, Wavy, reset view.

Each entry below is written when the fix is finished: what, files, how verified.

## 1. Contract C1, my side + findings 6 7 8 9 11 31 32 33 36 48 49 50 54 55 (one shell change) — done ~23:20

Method: the draft was built in private copies (`dev/uil3-styles.css`, `dev/uil3-template.html`, served by
`dev/uil3-demo.html`) so the other fixers' pictures did not change while it was unfinished, measured with the layout
reviewer's in-page MEASURE plus checks of this round (`node dev/uil3-look.mjs`), then copied into `src/` at ~23:15.
The pre-round-3 files are kept in `qa/round3-ui-layout/v2-originals/`.

`src/index.template.html`:
- Legend: one `<span class="lg" data-feature="…">` per feature, in C1 order and words: seams "coloured = edges sewn
  together", mirrors "ink = mirror (becomes the rim)", cones "dot *n* = cone point", corners "ring ∗*n* = mirror corner"
  (a ring swatch, as the 3D marker), double "dashed = self-intersection" (dashed ink swatch); each text in one span (a
  bare text run in a flex item loses the spaces around `<i>n</i>`). Companion link last.
- `#cut-note` (p) in `#plane-controls` after the Wavy field: "Every edge is a mirror: Fold folds the plane onto the tile."
- `#turn-hint` (p.hint.turn-hint) in `#pane-fold` after the label layer: "drag to turn".
- Reset view: `Reset<span class="btn-text-wide"> view</span>` — narrow: "Reset" (the verb), wide: "Reset view" (54).
- The DOM-contract comment documents data-fold / data-features, cut-note, turn-hint and the legend items.

`src/styles.css`:
- Legend (31, 55, 9): an item shows only when `#app[data-features~=…]` names it; without the attribute the v1 three
  (seams, mirrors, cones). Flex-wrap of whole items, lines at the bottom of a box ≥ 44 px; the companion link's own box
  is 44 px high (padding 22 up / 6 down, cancelled by negative margins) while it takes one 16 px line. Below 480 px
  the "companion:" label is dropped (it cost a line). Result: 44 px for 1-2-feature groups (v1: 52-55), 58-60 px for
  the 3-4-feature groups on phones, one line from about 820 px up.
- Kaleidoscopes (6, 30, 36, 48, 49): `#app[data-fold="snowflake"]` hides #presets and the Wavy field, shows
  `#cut-note` (13 px, wraps in the phone column), and hides the plane's #hint (ui-app hides it too).
- Hints (11, 50, 32): 13 px everywhere; never wider than the pane (wraps, never cut). On a small plane pane (< 360 px
  either way: every phone) the plane hint sits at the TOP edge, padded so "drag to move the cut" is one line in the
  smallest (150 px) pane. "drag to turn" sits in the fold pane's top-left corner: over 17 groups × t 0/0.5/1 × 4 sizes it
  lies over no part of the shape and no label (centred on an edge it touched 10 of 204: ** folded, the *333 star's ∗3).
- Chips never shrink and never show an ellipsis (7): `flex: none`, rows wrap; in a narrow row (< 480 px) chips are
  13 px with 8 px padding and the Wavy slider (label above it) gives way first, down to 64 px, then wraps to a second
  row. Side by side, the cut controls span the grid rows 2-3 and the fold pane rows 1-2, so a second row of cut
  controls costs the plane only, never the fold (632 at 667x375: plane 318x193, fold 318x237).
- Phone column (8, 9): chips flow two to a line where they fit (flex-wrap, grow), Wavy below; the first grid row is
  `minmax(var(--plane), auto)`, so a column taller than the square takes the height instead of hiding a chip. The square
  = clamp(150 px, 40 % of (100dvh − 170 px), 100vw − 164 px) (v1 allowed it down to 151 with chips hidden).
- Caption (9): one line reserved on phones, two only when the words need them (v1 always reserved two below 540 px).
  Windows under 600 px tall: header 44 (the chip's height), caption gap 4, legend top padding 4.
- Text ≥ 13 px everywhere (32): legend 13 (v1 11.5/12), hint 13 (11/12.5), Wavy label 13 (11), reset 13 ("view" was
  10.5), 3D label layer 13, chip meta 13 (12.5 below 380 px).
- Chip meta (33): wraps to two 16 px lines inside the 36 px pill instead of an ellipsis (320 px: "cmm · corner / pocket").
- Removed with the kaleidoscope hint: `.hint[data-faded]`, `.hint-part`, the hint's opacity transition (app.js no longer
  sets them).

Numbers (unbundled app with ui-app's C1 attributes; fold pane height at 375x498 = iPhone SE under the 50 px bar):
default 333 and 13 other groups 183 px (v1 151), 22x / 22* 169, 2*22 / 3*3 / 4*2 152 (2-line caption, 3-line legend);
360x534 (360x584 frame) 219 (169); 390x614 (390x664 frame) 265 (242); 390x780 383 (358); 844x340 (frame) 202 (187);
667x375 237 (222). No chip hidden or cut at any of the 19 sizes; 632's 4th chip visible everywhere.

Verified:
- `node --test test/shell.test.js`: 18 / 18 (rewritten: contract ids incl. cut-note and turn-hint; legend items, words,
  order and the per-feature CSS; kaleidoscope note; hints; the 13 px floor and no ellipsis; chip meta; caption; chips
  never shrink and the fold spans; the phone column; Reset). 15 of the 18 fail on the pre-round-3 shell.
- `SHELL_LAYOUT=1 node --test test/shell-layout.test.js` (new, opt-in, Chrome from the pool): the real app at 19 sizes ×
  17 groups: no scroll, no block overlap, every chip inside its row and the window and uncut, no chip scroll, tap
  targets ≥ 44, no text under 13 px, caption / chip meta uncut, legend = groupFeatures(group) with no item overlapping
  another or the link, note / chips / Wavy / hint per data-fold, the plane hint inside its pane and on one line (at the
  top of a phone pane), the turn hint in the fold pane's top-left, both panes ≥ 150 px, 333's fold ≥ 175 px at
  375x498; no page or console error. Passes (31 s); on the pre-round-3 shell it reports 3307 problems.
- Looked at: `qa/round3-ui-layout/d3-f375x548-333-p0-t0.png` (dpr 2), `d1-375x498.png`, `d2-small.png`,
  `d4-landscape.png`, `d5-desktop.png`, `d8-folded.png`.

## 2. Checked inside the host-frame stand-in; two refinements — done ~23:45

- `node dev/uil3-frame.mjs` (ui-app's `dev/app-frame.html`: the unbundled app in a cross-origin sandboxed iframe under a
  50 px bar, Chrome on the mini, dpr 2; the layout reviewer's MEASURE run inside the frame): 375x548, 390x664, 390x780,
  844x390, 667x375, 740x360, 640x360 for 333 / 632 / *632 / 2*22 / o / 22x at t = 0 and 1. The sizes inside the frame
  equal the bare runs at W x (H − 50) (375x498: plane 150, fold 351x183). Pictures `qa/round3-ui-layout/frame-phones-2.png`,
  `frame-landscape-3.png`.
- Phone column (8): chips are `flex: 1 1 40%; min-width: max-content` — two to a line at most, equal halves where both
  fit (632 at 375x498 and 390x614: a 2x2 block; before, content-sized chips gave Triangle / Equilateral Kite /
  Pentagon). The `min-width: max-content` is needed: the shared 44 px `min-width` of `.chip` replaces the automatic
  minimum, so with a 40 % basis the chips were squeezed and their names cut (the frame check caught it: "Equilateral"
  63 of 72 px). Narrow columns (~140 px: 390x780, 360x640, 320) still end 632 with one pair (Triangle / Equilateral /
  Kite | Pentagon); one chip per line there would cost 632 about 30 px of fold, so it stays.
- Phone on its side (7): in the frame at 667x375 632's row needed a second line (plane 317x143, < 150). The plane's
  column now has a floor, `minmax(min(320px, 60%), 1fr)` (three chips + slider ≤ 314 px) and 360 px when the row has a
  fourth chip (`:has(.presets > .chip:nth-child(4))`, 632: 349 px). The fold is limited by its height there (its pane
  stays wider than tall), so its picture does not shrink: 667x325 plane 360x187 / fold 275x187 for 632, 320x187 /
  315x187 for the others; 640x310 360x172 / 248x172 (632). Without `:has` 632 wraps as before (the plane gives way).
- Tests: `test/shell.test.js` asserts both rules (18 / 18); `test/shell-layout.test.js` now also runs 667x375 in the frame
  and 640x360: 21 sizes x 17 groups, passes (35 s).

## Requests for other owners

- **ui-app, `tools/qa-matrix.mjs` lines ~700-708** (touch session): the check "the kaleidoscope hint is small on a phone,
  fades after a few seconds…" tests the v1 hint (`'no cut here: every edge is a mirror'`, font < 12.5 px, `data-faded`).
  Under C1 there is no kaleidoscope hint (your app.js hides it, my CSS too) and no text is under 13 px (finding 32), so
  it fails now. Suggested replacement: on `*442` at 390x780, `#hint` not displayed, `#cut-note` displayed with the C1
  text, `#presets` and `#wavy-field` not displayed (getComputedStyle(...).display === 'none'), and after
  `setGroup('333')` the chips and Wavy are back and the note is gone.
- **ui-picker** (finding 32, picker part): row numbers and the key are 11-12 px in `src/hasse.js`; the page itself has
  no text under 13 px now.

## 3. Last refinement and final checks — done ~00:05

- Wide rows: the Wavy slider's minimum is 140 px (was 150), so 632's four 14 px chips and the slider share one row
  from a 480 px pane up (473 px), with no gap between that and the compact form (< 480). `test/shell-layout.test.js`
  now also runs 960x540 and 1024x768: 23 sizes x 17 groups, passes (37 s). Picture `qa/round3-ui-layout/final-desktop.png`
  (632, 3*3, *632 folded at 1024x768, 960x540, 1280x720); `all17-390x780.png` (every group on the common phone).
- The draft copies (`dev/uil3-styles.css`, `dev/uil3-template.html`, `dev/uil3-demo.html`) are deleted: src/ is the
  only copy. Probes kept: `dev/uil3-look.mjs` (measure + pictures of the unbundled app), `dev/uil3-frame.mjs` (the same
  inside `dev/app-frame.html`), `dev/uil3-sum.mjs`, `dev/uil3-turnsum.mjs`, `dev/uil3-textw.mjs` (text widths).
- `node tools/test-all.mjs` (aifoundry1; last run ~00:10, 663 tests): 658 pass, 2 skipped (my opt-in browser test; the
  topology dump), 3 fail, all in `test/crosscap.test.js` (lines 1050, 1239, 1268: the crosscap fixer's file and fold, both
  being edited; four runs gave the same three; an earlier run also had one each in test/app-url.test.js and
  test/plane.test.js, which passed on the next run). `test/shell.test.js`: 18 / 18.
