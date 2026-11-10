# cross-cap fixer, round 3 — 2026-11-09

Owner group "crosscap": `src/folds/crosscap.js`, `src/groupdata/crosscap.js`, `test/crosscap.test.js`.
Findings (qa/round3-triage.md, section crosscap): #2, #3, #13, #14, #18 (22x part), #57.
Pictures: `qa/round3-crosscap/`. Probes live in the session scratchpad (not in the workspace): a node replay of a
Fold press with the app's timeline easing at 60 fps (the reviewer's px-per-frame measure, on the CURRENT sources), the
test's near x far crossing counter on generic dragged cuts, and a real-playback filmstrip script (clicks Fold in
`dev/app-demo.html`, grabs the fold pane every 350 ms).

Each entry is written when the piece is finished: what, files, how verified.

## 1. #2 + #13: the timing — no pause, no dead start, a short landing (done 23:00)

Reproduced first (node replay, current sources): Pocket rests t 0.43–0.52 (the pause plus soft ramps) and t 0.959–1
(the zip's long landing, 0.78 s); the flap flip, 8.70 px/frame, is the fastest moment. Bowl frozen 0–1.80 s (its tile
is the cell itself: nothing to hinge before the puff starts at 0.19) and again t 0.43–0.51; 2.67 s of 7 s frozen.

What (`src/folds/crosscap.js`):
- No pause. The zip starts at 0.45, while the puff is still landing (the puff lands at 0.49 = the middle stop). At the
  stop the zip has done 1.3 % (the shape is within 0.0096 cells of the exact half pillow, which is `fold.halfPillow`).
  In the overlap the zip's move away from the half pillow is added to stage 1.
- The time saved went to the flaps: they turn over 0.42 of the play (was 0.36). Puff 0.21–0.49.
- The zip lands over its last 15 % (was 50 %); the fold back over its last 25 % (was 50 %).
- Stage 1 takes time in proportion to its work: `fold.work` = smoothstep of the share of the ANCHOR's own straight
  tile outside its cell (0.02 to 0.12). Bowl 0 (the cell itself), Pocket 1 (0.5 outside), Hexagon 1 (0.29). With work
  0 the puff starts at t = 0 at full rate and stage 1 ends at 0.22 (zip from 0.18): `TIMES_NO_CREASE`. In between, a
  blend (`crosscapTimes(work)`, `crosscapSchedule(t, out, work)`; C1 and bounded acceleration for every work). The
  work depends on the anchor alone, so dragging the cut never changes the timing (and the round-2 property that a
  point staying in the tile does not move in stage 1 survives).
- So that the middle stop depends on the anchor alone too, stage 2's three acts (pinch, roll, fold back) now run in
  the time after the middle stop, v = (u - free) / (1 - free); until the stop every tile zips alike (actsTiming's
  `free`, `fold.actsFree`). The quick pinch shrinks what is left of the zip: sigma = 1 - (1 - zip) (1 - c pinch(v)).
- Round 2's timing is kept for comparison: `opts.timing = 'round2'` (`TIMES_ROUND2`).

Verified (node replay of a real play, 60 fps, px per frame of a 520 px pane; before -> after):
- Pocket: total rest 1.37 -> 0.68 s; middle rest 0.54 s -> none; end 0.78 -> 0.62 s; fastest 8.70 -> 7.47 px/frame.
- Bowl: dead start 1.80 -> 0.25 s (the timeline's own ease-in); total 2.67 -> 0.75 s; fastest 9.93 -> 7.36.
- Hexagon: total 1.05 -> 0.60 s; seeds (0.2, 0.3) / (0.5, 0.75): 0.97 / 1.07 -> 0.55 / 0.57 s.
- The end rest that is left (0.33–0.62 s, t > 0.975) is the timeline's ease-out on a slow zip; a landing shorter than
  0.15 would break round 1's bound on the zip's landing (s'^2 / (1 - s) < 60) for 0.12 s less, so I kept the
  reviewer's 0.15.
- Tests: the timing test rewritten for the new design (no pause; the zip starts while the puff lands; zero speed
  only at t = 1; the slowest moment before 0.99 has rate 0.30 per unit of t; flaps >= 40 %); a new test for work 0
  and continuity in the work; checkFold uses each fold's own times and schedule rates (fold.times, fold.work); "nothing
  moves in the pause" became "no rest: every step but the last two moves >= 1 % of the median step, the last two move"
  (smallest 0.033 median steps over the sweep); the half-pillow checks run on fold.halfPillow (exact) plus "the stop
  is within 1.5 % of a cell of it"; anchor test 3 and the labels test use each fold's own times.

## 2. #57: a true name for the middle stop (done 23:00)

`MIDDLE_LABEL = 'glide seams open'`: at that stop every seam but the glide seams is closed (the Bowl has only glide
seams), whatever the cut, and the glide seams close only at t = 1. "half pillow" read as a tube from the default camera
with the Pocket (intent-critic). The stop is at the fold's own `times.halfStop` (0.49 with a crease, 0.22 for the Bowl).
The scrubber's aria text uses it (timeline.js, not mine). Test: checkFold asserts the label on every fold.

## 3. #14: the double line no longer floats in the open mouth (done 23:00)

`fold.doubleLine(t)`: empty until the sheets that meet along it are within 3 % of meeting (`DOUBLE_FROM = 0.97` of the
pinch / zip), then it grows out of the tip along the final line and is whole when they meet. With the Pocket the rim
closes onto it only at the very end, so it shows in the last 17 of 201 frames of the zip; with the Bowl (and every cut
that reaches into the near half) at the end of the pinch, after which it is a true double line (the bottom meridian is
folded onto it two to one). Test (rewritten): empty until then; starts at the tip, grows, whole by the end of the
pinch (Bowl); for the Pocket, drawn only while every point of the rim is within 3.1 % of the cell of it, and not drawn
while the rim is further than 2.9 %.

## 4. #3: generic dragged cuts — fewer passes through the far part (done 23:20)

Reproduced: with the app's anchor (the Pocket's seed after a drag from the default cut), seed (0.2, 0.3) passed 113
near triangles through the far part (82 wavy), all during the landing of the fold back (t 0.85–0.975); 24 random cuts
in and around the fixed cell: 933 in 12 of them. The presets were clean.

Causes found (crossing counter + which-triangles-meet probe):
- the fold back slid the near part onto its place at 38 degrees from the front, through whatever stands in front of
  its place on the closed heart;
- the swing direction (fold.lift) was an average over the mesh's VERTICES, which are graded toward the cell sides:
  for seed (0.2, 0.3) it said -0.87 (swing down) while the AREA of the near part says +0.99; and it jumped by up to
  0.09 between drag steps of a wavy cut (the vertex set changes as the tile is re-meshed).

What (`src/folds/crosscap.js`): the lift is an area integral over the near part's triangles (continuous in the cut);
gain 2 (was 3); the fold back starts at v = 0.35 (was 0.42; still after the roll is half done), swings higher
(ACTS.lift 0.8, was 0.5) with its peak later (sin(pi del^2)), and its move back in y is done at 90 % of it
(ACTS.landY), so the part comes straight down (or up) onto its place: both sheets of the closed heart are graphs over
the plane, so a vertical landing does not pass through the far part.

Verified (test's counter, 16 times of stage 2): seed (0.2, 0.3) 113 -> 9 (wavy 82 -> 29); the 24 random cuts 933 ->
about 400; seed (0.5, 0.75) and Hexagon straight / wavy 0; the strict round-2 tiles 0. Speed: the largest step of stage
2 is at most 1.08 x round 1's twist in round 2's timing (the round-2 test's bound is 1.15). Seed sensitivity along
anchor test 3's paths at t = 0.9: at most 5.3 x the seed's step (bound 6; gain 6 and swing 0.8 gave 15.9 x, measured).
Tried and dropped: each point swinging to its own side (the wavy Bowl 91 -> 346), compressing the move in y into
75 % (speed 1.54 x), re-spacing the acts (the pinch becomes the fastest moment).

Left: tiles whose near part lies almost evenly on both sheets still pass a little through the far part in the middle of
the fold back (e.g. (0.667, 0.262): 85 triangles at 6 instants). The core fixer's new wave (finding 1, domain.js
23:01-23:03) gives the wavy Bowl and the wavy "hair behind the centre" lobes on the upper sheet (their near part now lies
on both sheets): 6 and 2 contacts at t = 0.75 / 0.99; the stage-2 test counts them with the Bowl drags (the class round
2 made for that case), whose bound (<= 1/10 of the twist) holds: 29 against 2513.

New test: "stage 2 (acts) on generic cuts dragged from the Pocket": seed (0.2, 0.3) <= 20 / 45 (round 2: 113 / 82), the
26 cuts <= 600 (round 2: 933 on the 24) and <= 1/4 of round 1's twist (414 against 2056). The seed (0.5, 0.75) joined
the strict tiles.

## 5. #18 (22x part): preset names (checked, no change)

Pocket and Bowl are congruent 0.9 x 0.65 rectangles named by how they fold (one fold into a pocket; the cell puffs into
a bowl): the critic's own suggestion keeps such names, and the decision renames only false or duplicate names.
"Hexagon" is a hexagon (6 corners, sides 0.338–0.607). Nothing to rename.

## For the other owners

- ui-app (`test/folds.test.js`, not mine; nothing blocking): its specialTimes() adds crosscap's HINGE_END, PUFF_START,
  HALF_END, ZIP_START, HALF_STOP (still exported, the values with a crease); a fold's own inner times are now
  `fold.times` (the Bowl's differ). Adding `Object.values(fold.times || {})` there would cover them. The comment at its
  line 20 ("the cross-cap pauses at its middle stop") is no longer true.

## 6. Looked at, with the final code (real renderer, `dev/app-demo.html`; all in `qa/round3-crosscap/`) — 23:30

- REAL playback (a click on Fold, a frame every 350 ms; default view az 0 el 55 and side view az 70 el 20):
  `play-pocket.png` (flap 0.8–2.2 s, puff to 3.6 s, then the mouth closes without a rest; the dashed line only as the
  lips meet), `play-bowl.png` (the puff from the first frames, the hourglass at 1.9 s instead of 3.9 s, roll, the lid
  rising and coming straight down), `play-hexagon.png`, `play-seed-0.2-0.3-from-pocket.png` (most of the tile is near:
  it rolls in front, stands up like a page and comes down onto the back; no pass-through visible),
  `play-seed-0.5-0.75-from-pocket.png`, `play-bowl-wavy.png`, `play-pocket-wavy.png` (with the core's new wave the
  Pocket's glide edges wave too: small front lobes roll and fold back, and at t = 1 the wavy seam closes around the
  straight double line).
- The double line (#14): `dl-pocket-early.png` (t 0.5–0.72 at az 35 el 30, the reviewer's frames: no mark in the open
  mouth any more), `dl-pocket-late.png` (it appears at t 0.96 on the closing seam, from the tip), `dl-bowl-pinch.png`
  (it appears when the pinched neck closes, t 0.45).
- The app hands the stops on: getState().stops = 0 flat | 0.49 glide seams open | 1 cross-cap (Pocket, Hexagon),
  0.22 for the Bowl; the scrubber's aria text at the stop reads "glide seams open, 49%".
- Before pictures: `before-seed0203-side.png` (seed (0.2, 0.3), t 0.5–1, side view, round 2's code).

## 7. Suite

- `node --test test/crosscap.test.js`: 37 / 37 (20 s). Round 2's 36 kept; changed where the decision changed what they
  pin (the pause, the global times, the wavy Pocket's straight glide edges, the wavy Bowl's class), each change
  explained in a comment at the test; new: the timing without a crease, generic dragged cuts, the names.
- `node tools/test-all.mjs` (aifoundry1, 8 workers): 664 tests, 662 pass, 0 fail, 2 skipped.

## For the ui-app owner (not blocking)

- `src/app.js` CREASE_FADE.crosscap = [0.2, 0.47] still fits (the flaps close at 0.42, the stop is at 0.49); a
  fold-relative window would be [0.5 x fold.times.hingeEnd, fold.times.halfEnd] (the Bowl's flaps, when its cut is
  dragged, close at 0.17).
