# ui-picker fixer, round 3 — 2026-11-09

Files (SPEC section 8): `src/hasse.js`, `src/timeline.js`, `test/hasse.test.js`, `test/timeline.test.js`.
Findings (qa/round3-triage.md, section "ui-picker"): #10 (major), #32 (picker part), #34, #35, #51, #56.
Probes of this round: `dev/round3-ui-picker-*.mjs`; pictures and measurements in `qa/round3-ui-picker/`.

## Reproduced first (v1 code, unbundled app, Chrome from the mini pool) — 22:40

`node dev/round3-ui-picker-look.mjs --tag before` → `qa/round3-ui-picker/before-look.json`, `before-picker-*.png`:
- #10: the picker shows 10 of 17 pills at 844x390, 6 of 17 at 844x340 (the app's box in the host frame), 6/17 at
  667x325, 5/17 at 740x310; portrait frames 375x498 14/17, 360x534 16/17, 320x518 16/17 (the diagram never goes
  below 420 px, so the body scrolls with no cue). Opened on *632, o is above the edge at every one of those sizes.
- #32: row numbers 11 px, key 12 px.
- #34: Chrome's AX tree under the listbox: 0 options; all 17 nodes are 'group'.
- #35: after a mouse click on 'Hexagon' or 'Reset view', Space does not play (it re-presses the button); after a
  click on Fold it plays; after Tab to a chip, Space activates the chip (wanted).

Each entry below is written when the fix is finished: what, files, how verified.

## #10 [major] the picker fits phone landscape and short frames; o always on top; a cue where it must scroll — done 23:25

- Cause: the diagram was never drawn shorter than 420 px (MIN_H), because with ONE vertical scale the rule between
  333's row and 22∗'s row (22∗ sits 40 data units under 333) clears both pills only from ky = 0.75 up; and the title,
  info line and key always sat above and below the diagram, eating ~130 px of a 340 px window.
- Fix (`src/hasse.js`):
  - Vertical placement is a piecewise-linear map of the data's y levels: the data's proportions where there is room
    (exactly the v1 uniform scale: tested), and where the box is short, the gaps that must not shrink are kept (pills
    of neighbouring rows 4 px apart so the rule misses both; 22∗ over 22× 4 px apart) and only the rest is scaled
    (forward pass with the gaps as lower bounds + bisection on the scale). Least height 268–282 px for 286–600 px
    widths (`hasseMinHeight`); below it the diagram is drawn at that height and the body scrolls.
  - The card has two arrangements (`hasseCardLayout`, pure): stacked as in v1 wherever the diagram gets ≥ 420 px (or
    1.5 × its width) — every portrait window and laptop; otherwise, in a window wide enough, the title, info line and
    key move into a 214 px column beside the diagram, which gets the card's full height (phone landscape: 844x390 →
    580x356 diagram; the 844x340 frame → 600x322; 667x325 → 429x307; 740x310 → 484x292).
  - Where the body still must scroll (only below ~300 px of window height), a fade with a chevron marks each cut edge
    (`.hasse-cue-top/-bottom`, toggled on scroll); keyboard focus is kept clear of the fades.
  - Tap targets: 44 px where there is room; where packed rows bring two 44 px areas together they are split half way
    between the pills, and no area ever covers another node's pill (pure `hitBoxes`; v1 let 44 px areas overlap at
    W = 286 already, where the later node won the tap).
  - Row numbers: computed in the layout (`rows[].labelX/labelY`); where a pill would reach under its row's number
    (632 under "6" on a phone) the left margin makes room.
- Verified: `node dev/round3-ui-picker-look.mjs` (unbundled app, Chrome from the mini pool): 17/17 pills visible with
  no scrolling and o on top at 844x390, 844x340, 667x375, 667x325, 740x360, 740x310, 1280x720, 1024x600, 390x780,
  390x614, 375x498, 360x534, 320x568, 320x518, 360x640, opened on 333 and on ∗632 (v1: 10, 6, 7/10, 6, 7/10, 5/6,
  17, 17, 17, 17, 14/16, 16, 17, 16 of 17; `qa/round3-ui-picker/before-look.json` vs `after1-look.json`). Pictures:
  `after2-picker-844x390-s632.png`, `after1-picker-844x340f-s632.png`, `after1-picker-740x310f-333.png`,
  `after1-picker-667x325f-s632.png`, `after1-picker-375x498f-333.png`, `after1-picker-320x518f-s632.png`,
  `after2-picker-390x780-333.png`, `after1-picker-1280x720-333.png` (the laptop card is the v1 card: 574 wide, diagram
  540x556). Scroll cue: `after2-scroll-640x250-open333.png`, `after2-scroll-360x300-end.png` (bottom cue at the top,
  top cue after End, Home back). Real mouse in the side card (844x340, 667x325) and the 375x498 stacked card: hover
  names the node in the info line; clicks on 22×, ∗632, and in the trimmed margins under 22∗ and over 2222 pick that
  node and close (`after3-look.json`).
- Tests (`test/hasse.test.js`, new): least height ≤ 290 px for every width and the layout keeps it below; every short
  size (16 widths × up to 8 heights): pills inside and ≥ 3 px apart, rows hold their pills, rules miss every pill,
  edges clear by the same margins as before and never turn up, o above all; the uniform v1 scale wherever it fits
  (H ≥ 470); hit areas pairwise disjoint, never over another pill, ≥ 36 x 30, full 44 px on large diagrams; the
  card's choice for 19 window sizes and that the whole diagram fits in each.

## #32 (picker part) row numbers and key at 13 px — done 23:25

- `src/hasse.js` CSS: `.hasse-rowlabel` 11 → 13 px, `.hasse-legend` 12 → 13 px; row numbers clear of every pill
  at every size (test). Measured in Chrome: rowLabel 13, legend 13, info 15, title 16, pill labels 13–15 (look.json).

## #34 picker nodes are options in Chrome's accessibility tree — done 23:25

- Cause: a plain `<g>` between `svg[role=listbox]` and the `<g role=option>` nodes; Chrome then drops the option role
  (no listbox parent) and falls back to 'group'. Fix: `role="none"` on that `<g>`.
- Verified (CDP `Accessibility.queryAXTree` under the dialog, `dev/round3-ui-picker-look.mjs --only a11y`): v1 0
  options and 17 'group'; now 17 options, `selected` only on the current group ("2 star 2 2, cmm, corner pocket"),
  and the node focused by ArrowDown is announced as option "3 star 3, p31m, cone pouch", not selected.
- Test: the dialog built in a fake DOM (`test/hasse.test.js`): listbox > none > 17 options, aria-selected on the
  current one only, roving tabindex.

## #56 the key says what a line means — done 23:25

- Key: "line = subgroup with the same translations: — index 2  - - index 3" / "row = order of the point group"
  (same "x = meaning" form as the page's legend; the two line styles never split across lines; side column: one item
  per line). Checked against the data: every edge joins a group to a maximal subgroup with the same translation
  lattice, index 2 or 3, as the reviewer verified against International Tables.
- Test: the key's text in the fake-DOM test.

## #35 Space after a mouse click on a preset chip or Reset view plays / pauses — done 23:55

- Measured first (`dev/round3-ui-picker-focusvisible.mjs`, Chrome): during the keydown of a Space pressed after a
  mouse click, the clicked button ALREADY matches `:focus-visible` (any key, even Shift, turns it on), so the
  reviewer's "own Space only when :focus-visible" would never fire. At `focusin` it is right: false after a mouse
  click, true after Tab (and after a script focus that follows keyboard use). preventDefault on the Space keydown
  keeps Chrome from pressing the button.
- Fix (`src/timeline.js`): the timeline notes at `focusin` whether a pointer focused the element (`!matches(':focus-visible')`;
  engines without it: a pointer press in the last second). A focused BUTTON that a pointer focused gives Space back
  (outside dialogs): the keydown is prevented (the button is not pressed), a held Space too, and the matching keyup
  is prevented as well (engines that press on keyup); then play / pause toggles. Buttons reached by keyboard, text
  fields, selects and open dialogs keep their Space as before.
- Verified in the app (`dev/round3-ui-picker-look.mjs --only space`, real mouse and keys): click 'Hexagon' then Space:
  plays, rebuild count unchanged (v1: did not play, +1 rebuild); click 'Reset view' then Space: plays; click Fold then
  Space: plays as before; Tab to 'In between' then Space: that chip is pressed (preset 1, +1 rebuild), no play
  (`qa/round3-ui-picker/after4-look.json`).
- Test (`test/timeline.test.js`): mouse-focused button (keydown, held repeat and keyup all prevented, play toggles),
  Tab-focused button keeps Space, a button in a dialog keeps it, a clicked text field keeps it, the fallback without
  :focus-visible both ways; destroy removes the three new listeners.

## #51 scrubber: a C2 detent, the playing thumb on t, a 10 px zone — done 00:20 (10 Nov)

- Detent (`src/timeline.js`): inside a stop's zone t − s = sign(d)·w·F(|d|/w) with F(u) = u − u(1 − u)³ (was
  w·(|d|/w)^1.6). F(0) = 0 and F'(0) = 0 (the stop stays flat: the magnet), F(1) = 1, F'(1) = 1, F''(1) = 0 (no step
  in dt/dp at the zone's edge, not even in its derivative); steepest slope F'(1/2) = 1.25 (v1 1.6). Exact inverse by
  bracketed Newton (round trip < 1e-14). Zone half-width: 3.5 % of the track but at least 10 px (`detentZone`; the
  track is measured from the [data-scrub] box, followed with a ResizeObserver): laptop 13.3 px as before, the 390
  phone 10 px instead of 6.7 (v1: 7 px on its 200 px track).
- Playing: the thumb moves in proportion to t, from where it was to where the target lives (affine in t; from rest
  at 0 it is exactly p = t), so it passes a tick at the speed of t instead of racing through it. A pause part-way
  lets it glide in 150 ms (smoothstep) onto timeToPosition(t), t fixed; grabbing the slider mid-play puts it there
  at once so the drag starts from the exact t. `getThumb()` added (documented at the top of the file, contract C5).
- Measured in Chrome with real clicks and a real mouse, v1 build vs now (`dev/round3-ui-picker-scrub.mjs` →
  `qa/round3-ui-picker/scrub.json`; `dev/round3-ui-picker-curves.mjs` → `scrub-curves.html`, `scrub-curves.png`,
  `scrub-stats.json`), group ○ (stops 0, 0.45, 1):
  | | v1 1280 | now 1280 | v1 390 | now 390 |
  |---|---|---|---|---|
  | playing: thumb speed / t speed, per frame | 0.64 – 3.04 | 1.000 – 1.000 | 0.64 – 2.92 | 1.000 – 1.000 |
  | playing: largest |thumb − t| | 2.27 px | 0 | 1.20 px | 0 |
  | dragging: dt/dp just inside → outside the zone edge | 1.54 → 1 | 1.01 → 1 | 1.50 → 1 | 1.01 → 1 |
  | dragging: steepest dt/dp | 1.58 | 1.25 | 1.57 | 1.25 |
  | zone half-width | 13.3 px | 13.3 px | 7 px | 10 px |
  | pause just past the stop: thumb glide | none | 1.34 px in 150 ms | none | 0.92 px in 150 ms |
  (Thumb speeds per wall-clock ms are not quoted: headless Chrome's frames jitter against the sampler; the thumb is
  compared with t frame by frame.)
- The magnet is about as strong as v1's: the thumb travel for which t stays within 1 px of the stop is ±2.3 px on a
  laptop (v1 ±2.6); the qa-matrix check "slowest mouse step next to the stop < 0.6 step" gives at most 0.56 (v1 0.42).
- Tests (`test/timeline.test.js`): the old exact power-law test now checks the new law exactly (same 1e-12), and the
  monotonic/continuity test's slope bound tightens from 1.6 to 1.25; new: the profile (flat at 0, slope 1 and no
  curvature at the edge, steepest 1.25, inverse), dt/dp continuous everywhere for four stop sets incl. the phone zone
  (the slope change per sample shrinks tenfold with the sample; v1's 0.6 step would not), the 10 px zone (pure and on
  178/214/296 px tracks, and measured from a [data-scrub] box), playing (p = t from rest; affine from a scrubbed
  point; thumb never faster than 1.01 × t; v1's 2.5× race as a control), the pause glide (exact end, never back, ≥ 7
  frames, t fixed, resume from the drawn thumb), the grab mid-play.

## Checks after all fixes — 00:40 (10 Nov)

- Tap targets of the picker at the cards the dialog really uses: 44 x 44 everywhere at 1280x720 and 390x780; in packed
  layouts only the nodes whose 44 px boxes would overlap are trimmed half way: 22∗, 22×, ∗2222 (and o / 2222 at
  740x310) are 32–41 px tall, all ≥ 44 px wide (v1 let those same pairs overlap, already at 360x640 and 320x568,
  and the node later in the DOM took a tap meant for the nearer one). Clicks in those margins pick the nearer node
  (after3-look.json).
- Neighbouring cases: dev/hasse-demo.html with and without native <dialog> (`?nodialog`), a live resize while open
  844x390 → 1280x720 → 390x780 → 667x325: the card switches arrangement and keeps 17/17 in the window
  (`after5-demo*.png`, after5-look.json); hover in the side card (`after3-hover-844x340-22x.png`); keyboard Enter on
  the chip, End / Home, Esc in a scrolling card (`after2-scroll-*.png`).
- `node tools/qa-matrix.mjs --only-interact --page dev/app-demo.html --out qa/round3-ui-picker/matrix-interact` (ui-app's
  tool, run read-only): 64 of 69; all picker, Space and scrubber checks pass (magnet: slowest step 0.44 mouse steps,
  largest 1.21; Space toggles; touch tap on 4∗2's hit area picks it). The 5 failures are not in these files: three URL
  hash checks and the hash half of the touch-picker check (ui-app's URL work, being edited while it ran), and "the seams
  slide over the shape" (a seam point moved 0.008 < 0.01).
- Idle frames (`dev/round3-ui-picker-look.mjs --only idle`): the timeline asks for 8 frames for the 150 ms glide after
  a pause and none after it or after a play.
- `node tools/test-all.mjs` (aifoundry1): 659 tests, 654 pass, 3 skipped, 2 fail — both in test/crosscap.test.js
  ("anchor (SPEC 7) 3 …", "stage 2 (acts) …"), the cross-cap fixer's work in progress; hasse 16/16, timeline 25/25.

## For other owners (observations, nothing blocking)

- renderer (`src/render3d.js`): after a play ends (and after a pause), `tick` keeps re-scheduling itself — 7–10
  animation frames per second for at least 1.4 s with nothing moving (stack: `schedule` ← `tick`, render3d.js
  1058/1070, measured with `dev/round3-ui-picker-look.mjs --only idle` at 1280x720, group o). The round-2 review
  measured 0 idle frames in v1 (perf.json). May be work in progress.
- ui-app: nothing needed from the picker or the timeline. The timeline now has `getThumb()`; the picker's API is
  unchanged (`hasseMinHeight`, `hasseCardLayout` are new pure exports, documented at the top of src/hasse.js).
- SPEC 5.11's letter ("t − stop ∝ sign(d)·|d|^1.6", zone ±3.5 %) is superseded by finding #51: the detent is now
  F(u) = u − u(1 − u)³ (flat at the stop, C2 at the zone edge) on a zone of 3.5 % of the track but at least 10 px.
- 00:50: the side card is used down to a 286 px diagram (was 320), the layout's narrowest tested width: a 568x320
  window (small phone on its side) now gets 312x302 and fits (`after7-picker-568x320-333.png`). Below ~290 px of
  window height the body scrolls with the cues (568x270: 16 px; opened on ∗632 the current node is shown and o sits
  under the top cue, `after7-picker-568x270f-s632.png`). hasse 16/16 (the card test has 568x320).

## Final — 00:55 (10 Nov)

- `node tools/test-all.mjs` (aifoundry1, 8 workers): 660 tests, 656 pass, 2 skipped, 2 fail — both in
  test/crosscap.test.js ("anchor (SPEC 7) 3 …" and "stage 2 (acts) …"), the cross-cap fixer's files; all 41 tests of
  test/hasse.test.js (16) and test/timeline.test.js (25) pass.
- Old tests changed, not weakened: timeline's "flattened near a stop — 1.6 power law" checks the new law exactly (same
  1e-12), and the continuity test's slope bound tightened from 1.6 to 1.25 (the finding replaces the formula). The
  hasse tests of v1 are untouched and pass.
- Not verified: Firefox and Safari (the pool has Chrome only). Firefox presses a button on keyup; the timeline prevents
  that keyup too, by reading of its source, not run. Safari does not focus buttons on a click, so Space there already
  played in v1.
