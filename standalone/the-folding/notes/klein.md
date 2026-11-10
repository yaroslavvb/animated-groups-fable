# Klein bottle (xx = pg) — implementer's log

Mon 9 Nov 2026. Implementing the judge's decision (`qa/klein-judge.md`): design A, the "seam-crossing comma"
(`dev/klein-a/`), with the judge's four adjustments. The owner's complaint: "the side of the thing which houses the glide
reflection is just empty, so it's not clear why I need to do this complicated thing for the glide reflection."

Files this work owns (SPEC §7, §8): `src/motif.js`, `src/folds/roll.js`, `src/groupdata/roll.js`, `src/palette.js`
(colours only), `test/motif.test.js`, `test/roll.test.js`, new `test/klein.test.js`. Everything else is a request below.

## Log

- 22:41 step 0. `cmp`: `src/motif.js`, `src/folds/roll.js`, `src/palette.js`, `src/app.js` and `src/groupdata/roll.js`
  are byte-identical to `dev/klein-a/base/src/` (so A's hunks apply as they are; app.js has NOT received the URL-state
  edit yet). Since A's snapshot, `src/render3d.js`, `src/folds/crosscap.js`, `src/groupdata/crosscap.js` and
  `src/groupdata/hinge.js` have moved on; `test/crosscap.test.js` and `test/hinge.test.js` too. Snapshot of today's tree
  for the before/after comparison: `dev/klein/base/src/` (cp -R src, 22:41).
- 22:45 step 1 `src/motif.js` = `dev/klein-a/src/motif.js` (cmp-identical; the base was identical, so this is exactly
  A's diff: +231/-4 by diffstat): SEAM_GROUPS = {xx}, K_SEAM_GLIDE 0.78, SEAM_VIEW_CAP = VIEW_CAP, SEAM_TILT -0.1,
  SEAM_SHIFT 0.3, placeAcrossSeam, motifFor returns `angle` and `seam`, insideOutline + exported motifTintMesh.
  No other edit.
- 22:46 step 2 `src/palette.js`: `MOTIF_FILL_3D = [0.42, 0.42, 0.46]` (judge's adjustment (a): not FILL_RGB in app.js).
  3D-only, so no CSS variable (test/shell.test.js mirrors only the 2D colours).
- 22:46 step 3 `src/folds/roll.js` = `dev/klein-a/src/folds/roll.js` (cmp-identical; diff vs base = the four klein hunks:
  TUNE.klein.phase 0.5 + comment, `const phase = PI * (Number(T.phase) || 0)`, `ph = phase * w`, `al = chi * th + ph`).
  Torus, cylinder, mobius untouched. At w = 0 the map is v1's exactly (ph = 0), so stage 1 is unchanged.
- 22:45 NOTE: ui-app's URL-state `src/app.js` landed at 22:45:45 (55 kB; my 22:41 snapshot has the old one). So A's
  app.js hunks do NOT apply verbatim any more; the request below is written against the new file.
- 22:58 step 4. `test/motif.test.js`: in 'the default picture shows one whole glyph…', `if (m.seam) { t.diagnostic(…on
  purpose (SEAM_GROUPS)); continue; }` before the tier check (adjustment (b)); the '>= 12 whole glyphs' count unchanged.
  New `test/klein.test.js` (no static import of app.js): A's tests 1, 2, 3, 5, 6 —
  2 without buildScene: instead every other group's motifFor equals v1's (place(g) + TILT) bit for bit;
  3 (motifTintMesh) also checks every own vertex's tint against an independent point-in-comma test (margin 1e-6),
  vertices/pieces kept, the null case; 5 widened to every preset + 20 random seeds x amp 0/1 (the task's ask) —
  plus three exact checks of the phase map: (i) at(1) invariant under the glide, its inverse, +-e1, e2, glide.e1 at
  200 random points (< 1e-9 tile sizes) and every seam closes (< 1e-10); (ii) before the ring stage the map is v1's
  bit for bit, and at t = 1 it is v1's bottle turned half way round the ring (point for point, < 1e-9); (iii) the end
  at +A/2 keeps its 8 upright through the ring stage (horizontal part of tip - crossing < 1e-9), the end at -A/2 is
  turned by exactly pi w (1e-7 rad), and the default comma's centre lies beyond the +A/2 edge (the head is on the end
  that holds). A's test 4 (the xx scene) is in the file as the last test, with a DYNAMIC import of app.js: it skips
  itself ("src/app.js does not draw the filled comma yet") until the app.js request lands, then runs unchanged.
  Remote run (aifoundry1) of klein + motif + roll: 44 pass, 1 skipped, 0 fail. Tinted area within 1.47 % of the
  comma over 44 meshes; at most 226 vertices added. roll.test.js sweep (176 folds, phase 0.5 now): seam gap <= 1.2e-15,
  invariance <= 3.3e-15, lowest z -0.0133 tile sizes mid-motion (bound 0.08).
- 23:05 step 4(c), whole suite. Other agents are mid-edit, so the workspace is not green for reasons of theirs; to
  attribute, `dev/klein/make-trees.sh` snapshots the workspace twice at one moment: `dev/klein/now/` as is and
  `dev/klein/base-now/` with the Klein change taken out; `dev/klein/run-trees.sh` runs both whole suites remotely.
  now: 587 tests, 573 pass, 12 fail, 2 skipped; base-now: 578 tests, 565 pass, 12 fail, 1 skipped. The 12 failing tests
  are THE SAME in both (crosscap x7, hinge 'spines', plane 'window', render 'labels', ui-app's new 'url: every parameter
  round-trips', and test/folds.test.js, which does not load: the new app.js no longer exports HINT_FADE_SECONDS).
  So the Klein change breaks nothing and none of the 12 is ours. Outputs: dev/klein/runs/{now,base-now}.txt.
- 23:05 the requests verified before handing them over: `dev/klein/oldapp/` = 22:41's src (the app.js that
  test/folds.test.js still loads) + the Klein files + the app.js request applied by hand, with test/folds.test.js
  carrying the requested assertion and test/klein.test.js: 37 / 37 pass, the xx scene test RUNS (not skipped) and
  passes. Also `dev/klein/preview/` (src as of 22:50, URL-state app.js + the request): the xx scene test runs and
  passes there too (its other failures are the same in-flight ones).
- 23:10 other groups untouched: `dev/klein/compare-groups.mjs` (A's script; base and after directories are options).
  The judge's baseline `dev/klein/base` (22:41) would mix in what other agents changed since, so both sides are taken
  at one moment: `--base base-now --after now` → 16 of 17 groups IDENTICAL (positions at t = 0, .3, .5, .8, 1, indices,
  tint, every line and marker, ghost colour, motif outline; every preset, amp 0 and 1); only xx differs. Same with
  `--after now-req` (now + the app.js request applied with `patch -p0 < dev/klein/app.js.patch`, which applies cleanly
  to the URL-state app.js): 16 of 17 IDENTICAL, only xx.
- 23:30 films (`dev/klein/films.sh live|preview|before`, mini pool, one Chrome at a time). Pages: `dev/app-demo.html`
  (live: the Klein change, app.js as ui-app has it), `dev/klein/preview.html` (snapshot `dev/klein/now-req/` = the Klein
  change + the app.js request), `dev/klein/before.html` (snapshot `dev/klein/base-now/` = without it). Every STATE line:
  seamGap at t = 1 = 2.0e-16 (Rectangle), 2.7e-16 (Hexagon), 2.6e-16 (seed 0.3,0.6), 2.1e-16 (wavy 1); nonFinite 0,
  errors 0; no console error.
  * preview (= the design once the request lands): `qa/klein/preview-xx-p0-default.png` matches the after row of
    qa/klein-a/cmp-film-p0-default.png (t = 0: grey head piece at the top orange edge, mirrored curl bottom-left;
    t 0.82-0.91: the two pieces on the two open ends, on different lobes; t = 1: grey across the orange 8).
    `preview-xx-closing-default.png` matches qa/klein-judge/a-closing-default.png (head end's 8 upright, curl end
    turns over, the pieces meet). `preview-xx-closing-left.png` (az -70 el 25) is the clearest: at t = 1 ONE grey
    comma across the upright orange 8. `-closing-back`, `-p1-default` (Hexagon), `-seed-default`, `-amp1-default`,
    `-phone-closing` (390 x 780) all read.
  * live: `qa/klein/xx-*.png`, same motion (the phase is in roll.js), but in 3D the comma is only a thin grey OUTLINE
    (the plane fills it): at t = 1 it does not read. That is A's 21:40 finding; the fill needs the app.js request.
  * before: `qa/klein/before-xx-*.png` (v1 motion, the comma's outline on the top of the ring, nothing at the seam).
- 23:40 stills (`tools/shot.mjs --steps dev/klein/steps-stills-{preview,live}.json`, from steps-stills.template.json):
  `qa/klein/preview-still-*.png` and `qa/klein/still-*.png`: 1280 x 720 Rectangle t = 0 / t = 1, Hexagon t = 0,
  Hexagon + wavy 1 at t = 0 / 1, a zoomed t = 1 (az -90 el 10 zoom 2.2: crisp fill edges, no confetti, as in
  qa/klein-a/v5-xx-t1-zoom.png) and az -70 at t = 1 (one whole grey comma across the upright 8); 390 x 780 at t = 0,
  0.9, 1 (the pieces read on the phone). `qa/klein/preview-still-390-plane-zoom.png` (dpr 3): the comma that straddles
  the bottom orange edge ends about 10 css px above the "drag to move the cut" hint, clear of it. Every EVAL: seamGap
  at t = 1 <= 2.7e-16, nonFinite 0, errors 0.
- 23:50 `dev/klein/check-browser.mjs` (one Chrome on the mini; prints ok / FAIL per check):
  * drag: a real pointer drag (24 moves) over the plane at t = 0 and t = 1, on preview and live: the cut moves
    (0.43), 24 rebuilds in 52-67 frames (at most one per frame), t kept, seam gap at t = 1 stays 2.3e-16 while
    dragging, nothing non-finite, no console error. Pictures `qa/klein/check-drag-*-t{0,1}-{0,1}.png`: the fill
    moves with the cut (after the drag the tile holds a whole comma; in 3D one grey comma on the front of the ring).
  * url: through `dev/app-frame.html` (ui-app's viewer stand-in; `?page=dev/klein/preview.html` for the preview):
    `#g=xx&cut=1&t=0.9` and the dragged-seed link `#g=xx&seed=0.3/0.6&t=1` give exactly the state set by hand, and the
    same surface, tint, comma and edges NUMBER FOR NUMBER (a digest of scene.pos, M.tint, motif and edge points).
    The preset link is pixel-identical (0 of the fold pane's pixels differ). The motif needs nothing in the hash.
    OBSERVATION for ui-app / plane (not ours, not needed by this work): the dragged-seed link swaps the colours of the
    two glide seams (orange <-> purple) against the session it was copied from: assignEdgeColors keeps a seam's
    colour along the cut's history, a link numbers them afresh. Same geometry; 0.38 % of the pane's pixels.
  * others: o, *x and 333 at t = 0.5 and 1, dev/klein/before.html vs dev/klein/preview.html (one moment, without and
    with the Klein change and the app.js request): 0 pixels differ in the whole 1280 x 720 page.
- 23:58 test/folds.test.js changed at 22:53 (ui-app: the app.js import now takes HINT_TEXT), so both request patches
  were regenerated against the files as they are now (dev/klein/req/ holds the edited copies). Then
  `dev/klein/verify-requests.sh`: the workspace snapshot as is (`dev/klein/ws/`) and with both patches applied
  (`dev/klein/ws-req/`), whole suites remotely. ws: 647 tests, 640 pass, 4 fail, 3 skipped; ws-req: 647, 641 pass,
  4 fail, 2 skipped. The same 4 fail in both, none of them ours or about xx (crosscap 'anchor (SPEC 7) 3' and
  'stage 2 (acts)' on 22x; plane 'drag with a live rebuild' on 2*22 and 'chevrons' on 333). With the requests the xx
  scene test of test/klein.test.js RUNS and passes, and folds.test.js's ghost-colour test passes.
- 00:10 final `node tools/test-all.mjs` on the workspace (dev/klein/runs/final.txt): 658 tests, 651 pass, 4 fail,
  3 skipped. Failing: crosscap 'anchor (SPEC 7) 3' and 'stage 2 (acts)' (22x), and render3d-dom.test.js '26: with
  prefers-reduced-motion …' x2 (the renderer's new file): other agents' in-flight work, none about xx or our files.
  test/klein.test.js 8 pass + the xx scene test skipped (waits for R1); motif and roll suites all pass.
  Scratch trees, deletable once R1/R2 land: dev/klein/{now,base-now,now-req,preview,oldapp,ws,ws-req,req}/ (before.html
  and preview.html load base-now and now-req; compare-groups.mjs takes any two of them).

## Requests (files this work does not own)

### R1 — `src/app.js` (ui-app): draw the comma filled in 3D. ESSENTIAL to the design.

Why: the judge's design (qa/klein-judge.md) shows the glide's work by a comma that straddles the glide seam; in the
plane plane.js fills it, but in 3D app.js draws only its outline, a thin grey line on a bent translucent sheet, and at
t = 1 the joined comma does not read (compare `qa/klein/xx-closing-left.png`, live now, with
`qa/klein/preview-xx-closing-left.png`, the same with this request). motif.js and palette.js already export what it needs.

What (a ready patch, against src/app.js as of 22:52, applies with `patch -p0 < dev/klein/app.js.patch`):
1. `import { motifFor, motifInTile, motifTintMesh } from './motif.js';` and add `MOTIF_FILL_3D` to the import from
   `./palette.js`.
2. Next to the other constants (after `MOTIF_ALPHA`): `const ROLL_FOLDS = new Set(['torus', 'cylinder', 'mobius', 'klein']);`
   (with the comment in the patch).
3. `buildScene`: right after `const fold = createFold(group, domain, tileMesh, foldOpts);` and before
   `const M = fold.mesh;`:
   `const mot = motifFor(group);`
   `if (mot.seam && ROLL_FOLDS.has(group.fold)) fold.mesh = motifTintMesh(group, fold.mesh, mot) || fold.mesh;`
4. `ghostColor(scene)`: first line `if (scene.M && scene.M.motifTint) return MOTIF_FILL_3D;` (and one sentence in its
   doc comment, in the patch).
Nothing else: `drawFold(…, fresh)` already passes `scene.M.tint` to `R.setSurface` (its length is scene.n) and sets
the ghost colour through `R.setStyle({ ghost })` when it changes. Cost: about 220 vertices and 0.7 ms per rebuild, xx
only; every other group's scene is bit-identical (`dev/klein/compare-groups.mjs`).

How to verify: (a) `node tools/test-all.mjs test/klein.test.js`: its last test ('xx scene (app.js) …') stops skipping
and passes; (b) R2 below; (c) `node tools/filmstrip.mjs --page dev/app-demo.html --g xx --t0 0.76 --t1 1 --frames 6
--cols 3 --w 700 --h 560 --az -70 --el 25 --out qa/klein/after-r1-closing-left.png` looks like
`qa/klein/preview-xx-closing-left.png` (a grey comma joined across the upright orange 8 at t = 1).
Verified here: dev/klein/ws-req/ (whole suite, see 23:58), dev/klein/now-req/ + dev/klein/preview.html (films, stills,
drag, URL links, 0-pixel spot check of o, *x, 333).

### R2 — `test/folds.test.js` (ui-app): the ghost-colour assertion, with R1 (same commit).

Why: with R1 the ghost colour of xx's scene is MOTIF_FILL_3D (the filled comma), not SURFACE_GHOST; the assertion in
'app: creases fade out as the fold completes; line widths follow the pane' expects SURFACE_GHOST for every group but
the kaleidoscopes and would fail at xx.

What (patch: `dev/klein/folds.test.js.patch`, against the file as of 22:53): import `MOTIF_FILL_3D` from
`../src/palette.js`; after `const scene = buildScene(g, …)` add
`assert.equal(!!scene.M.motifTint, g.id === 'xx', …)`; for the non-snowflake groups the expected colour becomes
`scene.M.motifTint ? MOTIF_FILL_3D : SURFACE_GHOST`; the snowflake branch and the no-jump check are unchanged.
How to verify: `node tools/test-all.mjs test/folds.test.js` with R1 applied (green in dev/klein/ws-req/).

## Status (Tue 10 Nov, 00:05)

Landed (Klein-owned files):
- `src/motif.js` = `dev/klein-a/src/motif.js` (A's port, no other edit); `src/folds/roll.js` = `dev/klein-a/src/folds/roll.js`
  (the klein phase; torus, cylinder, mobius untouched); `src/palette.js` + MOTIF_FILL_3D; `test/motif.test.js` (the
  seam diagnostic); new `test/klein.test.js` (9 tests: 8 pass, the xx scene test skips until R1). `src/groupdata/roll.js`
  and `test/roll.test.js` unchanged (the roll sweep now runs the phase-0.5 map and passes).
- Klein + motif + roll suites: 44 pass, 1 skipped. Whole suite: nothing that fails is ours (two attributions above).
- Pictures: `qa/klein/` (films and stills: preview-* = with R1, the plain names = live without R1, before-* = without
  the change; check-* = drag, links, other groups).

Pending with ui-app: R1 and R2 (one commit). Until R1 lands, the plane shows the comma across the glide seam and the 3D
shows the new motion, but the comma is only outlined in 3D.

Fallbacks, kept in dev/ if the owner still asks "why" after seeing this: B (two-sided colour,
`dev/klein-b/design-b-colour.patch`) and C (the classic bottle, `dev/klein-c/`).

Infra note: A found at 21:43 that `tools/remote/start-pool.sh` failed on the mini because Homebrew's node there cannot
load libsimdjson.34.dylib (brew upgraded simdjson). The script (edited 22:28) now tries the codex runtime's node
(~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node) first; if the pool is down, start it that
way. It stayed up through this work (every film and still ran on the mini).

Small follow-ups (not done, to keep the port cmp-identical to A's): the header comments of src/motif.js (the export list
omits motifTintMesh, placeAcrossSeam and motifFor's `seam`) and of src/folds/roll.js (the klein paragraph does not name
TUNE.klein.phase; the TUNE comment does).
