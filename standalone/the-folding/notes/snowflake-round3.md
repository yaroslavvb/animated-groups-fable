# snowflake fixer — round 3 (9 Nov 2026)

Files changed: `src/folds/snowflake.js`, `test/snowflake.test.js` (and `src/groupdata/kaleido.js` for #47). Pictures and
numbers in `qa/round3-snowflake/`. Tools of my own: `dev/snowflake3-look.mjs` (browser: per-side "bold share" over t
in three views, the reviewer's method, plus 16-frame films), `dev/snowflake3-occlusion.mjs` (the renderer's line
visibility test emulated in node, for quick design iterations), `dev/snowflake3-probe.mjs` (sides, folds, stacks).

## #5 [major] A side of the outline turns grey and stays grey through the last folds — fixed (the stack part)

**Cause (confirmed).** The outline rode on the lid, the top of the tile's OWN stack. In the folds where an odd number
of sectors is left (∗632 fold 3, ∗333 fold 2) the flap lands on the neighbouring sector, not on the tile: after it
the neighbour holds 8 sheets against the tile's 4 (∗632; ∗333: 4 against 2), and its folded edge (the spines it
brings) bulges over the tile's side, 1.5 spacings out, 4-7 spacings up, i.e. above the outline at 3. The renderer then
drew that side hidden (x-ray 0.42) under the dashed crease: from the landing (t 0.725) through the magnet stop
'sixth' (0.785) until the lid rose in the last fold (0.94). Measured before: `qa/round3-snowflake/before-measure.png`
(+ `.json`), films `before-film-<g>-<view>.png`.

**Fix (`src/folds/snowflake.js`).** The outline gets its own pieces, `mesh.outline[i]` = `boundary[i].cells`, one per
side of the tile (piece indices after the lid; `fold.pieces` grows by the number of sides). Side i runs straight
between its two corners, and each corner is lifted to the top of the TALLEST stack that meets there: the pivot meets
every stack, the far end of spoke 1 (spoke 0) the tile's and the neighbour's across that spoke, any other corner the
tile's alone. Between stops the corners rise with the lid (the same smoothstep over the flap's last 70 degrees). At
t = 1 every corner is on the top sheet, as before. The lid itself (motif, `locate`) is unchanged, and so is the
cone-point marker logic of the app (a marker takes the piece of the nearest boundary sample: now an outline piece,
whose corners are where the markers are). Only ∗632 and ∗333 change between stops; ∗2222 and ∗442 have uniform
stacks and look exactly as before.

**Verified.**
- Browser (`node dev/snowflake3-look.mjs --tag v1 --only measure`, `qa/round3-snowflake/v1-measure.png`): ∗632 side
  ∗2-∗6, default view: weak (< 50 % bold) only for t in [0.7275, 0.76] (the flap of fold 3 landing in front of it)
  and [0.8775, 0.9275] (the last fold stands on it), instead of [0.725, 0.9375]; bold through the stop 'sixth'.
  Fine films: `v1-film-s632-default-t0.7-0.86.png`, `v1-film-s632-side-t0.7-0.86.png` (all three sides bold for
  t = 0.7686 … 0.8371 in both views; before, side ∗2-∗6 was a grey dashed line there).
- `test/snowflake.test.js`, new test 'the outline rides on the topmost paper along each side …' (all presets and 24
  random seeds per group, amp 0 and 1): at every stop each corner of the outline lies exactly (1e-12) on the top of the
  tallest stack meeting there and every outline sample at or above every sheet under it; at 160 steps of t plus every
  stop and stop ± 0.002, ± 0.01, no paper within a quarter spacing of rest stands more than half a spacing above the
  outline within 3 spacings of it; the outline only rises, stays within the stack, and is on the top sheet at t = 1.
  The same check run on the v1 module (`snapshots/v1/src/folds/snowflake.js`): paper 3.99 spacings above the outline
  (∗632, t 0.7725) and 1.99 (∗333, t 0.655) beyond the allowance; now at most 0.05 beyond it.
  Two assertions of the old tests changed with the design, not weakened: boundary samples carry `mesh.outline[i]`
  instead of the lid (plus new checks that these are distinct pieces of their own), and the piece count without
  spines is 2n + 1 + (number of sides).
- `node --test test/snowflake.test.js`: 18 / 18 at that point (19 / 19 with the #47 test below).

**What stays (honest occlusion, not the stack).** A flap passing in front of a side still hides it, and two such
moments are abrupt because the occluding edge is parallel to the side: the hinge of the last fold (the flap stands on
side B, e.g. ∗632 t 0.8775-0.9275, ∗442 0.8275-0.895) and the far edge of a landing flap parallel to a side (∗2222's
far side, 0.8775-0.9625). From below (az 20, el -35) the outline is on top of the stack, so behind it: drawn x-ray
once it is more than the renderer's line bias (3-5 spacings) above the base tile. No position of the outline avoids
these without lifting it far off the paper; see the request to ui-app below.

## #47 [polish] '∗442 … right triangle' — fixed

`src/groupdata/kaleido.js`: ∗442's `shape` is now '45-45-90 triangle' (∗632 already reads '30-60-90 triangle'; both
are right triangles). The chip shows 'p4m · 45-45-90 triangle', the picker's key '∗442 · p4m · 45-45-90 triangle'.
Test (`test/snowflake.test.js`, 'the shape names the tile exactly'): the four kaleidoscope cells' angles, measured
from `group.kaleido.cell`, give 'rectangle', '45-45-90 triangle', 'equilateral triangle', '30-60-90 triangle'.
Looked at: `qa/round3-snowflake/chip-s442-390.png` and `chip-s442-1280.png` (the header reads '∗442 p4m · 45-45-90
triangle ▾', one line on the 390 px phone).

## Request to ui-app (`src/app.js`, not my file) — the complement for #5, the reviewer's own suggestion

What a fold module cannot change: when a FLAP passes in front of a side, the renderer draws that side hidden
(x-ray 0.42, grey), and two such moments are abrupt because the flap's edge runs parallel to the side: the last
fold's hinge (side B: the flap stands on it, e.g. ∗632 t 0.8775-0.9275, ∗442 0.8275-0.895, ∗333 0.845-0.8675) and
a landing flap's far edge (∗2222's far sides, 0.8775-0.9625). From below the outline is behind the whole stack from
the middle of the fold on. (Measured: `qa/round3-snowflake/v1-measure.png` / `.json`.)

**Request:** in `sceneLines`, when `scene.group.fold === 'snowflake'`, draw the tile's MIRROR edges with
`xray: 0.85` instead of 0.42 (one line, e.g.
`for (const e of scene.edges) if (e.mirror) lines.push({ …, xray: scene.group.fold === 'snowflake' ? 0.85 : 0.42 })`).
For the kaleidoscopes the outline IS the orbifold; at 0.85 a flap in front changes it from 100 % to 85 % ink instead
of 42 %, which is the owner's "edges bold and shining through", while the translucent flap still shows what is in
front. Picture of the same frames both ways: `qa/round3-snowflake/v1-xray.png` (∗2222 t 0.875 and 0.88, ∗632 t
0.8786 at the hinge, ∗442 t 0.83, ∗632 from below at t = 1, ∗442 side view t 0.86). Other groups unchanged.

## #24 (my part: lift the outline off the spine "if it still helps") — not done: it does not help enough

After the renderer's fix (per-pixel depth at the stroke's centre line, notes/renderer-round3.md) the zipper is gone in
every case of the reviewer: `qa/round3-snowflake/v1-zip-probes.png` (dpr 2, 4x crops: ∗632 t 0.944 and ∗442 t 0.68
one clean bold line; ∗442 from below t 0.83 one even grey stroke). What is left is a steady two-tone stroke or a grey
one on the last fold's hinge, where the flap's spine and outer sheet really pass over the line (∗2222 t 0.82 default,
∗442 t 0.83 default). Tried: (1) a temporary lift of 2 spacings during the last fold (a sin² bump): ∗2222 t 0.82
became one clean bold line and the thin rims from below went (`exp-lift-probes.png`), but the bump makes the outline
sink back at the end and float above the stack, against the tested rules that it only rises and stays within the
stack; (2) the same effect kept monotone, by letting the outline start rising earlier in the last fold (at 80° or 50°
of the flap's turn instead of 110°): over 4 groups × 3 views the emulated hidden share of the last fold went from
43.9 % to 43.6 % and the two-tone share from 16.3 % to 14.4 %, while from below the outline was hidden longer (∗2222:
27.8 % to 39.3 % of the last fold). Not worth a new rule; the module is unchanged by these experiments. The x-ray
request above covers the same moments far better.

## Before / after in one renderer (#5), and the suite

The first "before" pictures (`before-*.png`) were taken with the round-2 renderer, before the renderer's #24 fix.
For a clean comparison, `dev/snowflake3-look.mjs --swap snapshots/v1/src/folds/snowflake.js` serves the v1 fold
module in place of the current one, everything else identical: `before-v1module-measure.png` / `.json` and
`before-v1module-film-<g>-<view>.png` against `after-measure.png` / `.json` and `after-film-<g>-<view>.png`
(4 groups × default az 0 el 55, side az 65 el 12, below az 20 el -35; 16 frames each).
- ∗632 side ∗2-∗6, default view: weak (< 50 % bold) for t in [0.725, 0.94] → [0.7275, 0.76] ∪ [0.8775, 0.9275];
  side view [0.635, 0.9425] → [0.635, 0.7675] ∪ [0.83, 0.93]. Bold at the stop 'sixth' (0.785) in both views.
- ∗333 side view, its long side: weak [0.5975, 0.7325] (through the stop 'third', 0.667) → [0.595, 0.6425] ∪
  [0.7375, 0.81]; default view [0.845, 0.89] → [0.845, 0.8675]. Films: at t 0.6667 all three sides bold now.
- ∗2222, ∗442: identical (their stacks are uniform, so the corners are where the lid was).
- Below: the cost of "on top": ∗632's sides ∗2-∗6 and ∗3-∗6 go x-ray at t 0.71 instead of 0.875-0.89, ∗333's at
  0.59 instead of 0.8875 — behind the 4-sheet stack, drawn as a solid grey line (not dashed), and more gradually than
  before (largest drop per 0.0025 of t: ∗333 0.28 instead of 0.91). The x-ray request above would make it 85 % ink.
- `node tools/test-all.mjs` (lab box, 9 Nov ~23:30): 660 tests, 654 pass, 3 skipped, 3 fail — none of mine:
  `test/crosscap.test.js` 'anchor (SPEC 7) 3' and 'stage 2 (acts)…', `test/plane.test.js` 'the handle is a ring…'
  (the crosscap and plane fixers' work in progress). `test/snowflake.test.js` 19 / 19, `test/folds.test.js` and the
  verify suites green.
- Last run of `node tools/test-all.mjs` (the end of my work): 660 tests, 656 pass, 2 skipped, 2 fail, both in
  `test/crosscap.test.js` ('anchor (SPEC 7) 3', 'stage 2 (acts)…'), the cross-cap fixer's files; the plane failure of
  the earlier run is gone. Everything of mine is green.
