# Replication step — the implementer (port of design A), Tue 10 Nov 2026

The owner's ask (today): "Also, add another step where it actually shows how the tiling and replication is done."
The judge chose A, "replication in the plane" (qa/rep-judge.md). My job: port dev/rep-a onto the CURRENT src, keep
everything that works, extend the URL state, add tests, film and LOOK, end with `node tools/test-all.mjs` green.
Not mine: src/folds/crosscap.js, src/groupdata/crosscap.js, tools/motif-place.mjs, src/groupdata/motif.js; no build.

## Log (as I go)

### 08:50 — read
- SPEC.md (all, §§ 1–9), notes/integrator-final.md, qa/fill-judge.md, qa/rep-judge.md, qa/rep-a/NOTES.md,
  notes/crosscap-paint.md, the whole patch qa/rep-a/rep-a.diff (app.js, plane.js, template, styles, replicate.js).
- `diff -rq src dev/rep-a/src`: app.js, plane.js, index.template.html, styles.css differ (the patch) and
  folds/crosscap.js, groupdata/motif.js (the cross-cap fixer's newer versions, 08:08–08:11, which stay).

### 09:05 — the port applied (src/), and the pure tests
- Froze the pre-port app: `dev/rep-port/pre/src/` (a copy of src/ at 08:55) + `dev/rep-port/pre/index.html` (loader),
  for the pixel comparisons of the plane at u = 1 against the app without the port.
- `patch -p1 -i qa/rep-a/rep-a.diff` in the workspace: no fuzz, no reject (a dry run on a scratch copy first).
  src/app.js, plane.js, index.template.html, styles.css, replicate.js then equalled dev/rep-a/src's byte for byte;
  src/folds/crosscap.js and src/groupdata/motif.js unchanged (cmp against the frozen copy).
- My edits on top (no behaviour change):
  - src/plane.js: the C2 addition documented at the top (setTiling, getTiling, tilingPlan, tilingCaption,
    setTilingTiming, options.onTilingPlan, what renderTiling draws).
  - src/replicate.js: new pure `cardState(plan, c, st, keep)` = the card's { A, k, back, lift } that renderTiling
    computed inline (same arithmetic, bit for bit); renderTiling calls it. Reason: so the test checks the code that
    draws, not a copy of its formulas. Header lists it.
  - "prototype A" wording in comments of app.js, index.template.html, styles.css → "the replication step".
- test/replicate.test.js = dev/rep-a/replicate.test.mjs re-pathed (`./src/` → `../src/`, the dynamic import too), plus
  NEW 'the cards are continuous …': every copy the window needs, 17 groups x every preset x amp 0/1 x the preset seed +
  a dragged one, 200 samples through its motion + 100 through its settle + one each side: no card before its phase or
  after its settle; it starts on its parent at opacity 0 and lands on g(D) exactly (A === c.g) at opacity 1; opacity,
  face and lift steps <= 0.06; no position step > 4x the mean step (measured: 10,863 cards incl. 4,265 flips, largest
  opacity step 0.042, largest position step 2.96x the mean = smootherstep's 1.875 x the flip's π/2).
  CONTROL (scratch copies, planted): a card at full opacity from its first frame → fails ("opacity jumps by 1.000");
  a motion that lands 3 % short and jumps → fails ("jumps: a step of 0.0204 tile sizes, the mean 0.0034").
  `node --test test/replicate.test.js`: 3/3 pass (10 s locally).

### 09:20 — the plane API test, two small fixes, the URL tests
- NEW test/plane-tiling.test.js (fake canvas, as test/plane.test.js; 3 tests, 8 s locally):
  1. u = 1 is the plane as always: for 17 groups x amp 0/1 x a laptop and a phone pane, a view that showed the
     replication at u 0, 0.37, 0.8, 0.9999 and a replay fade, then setTiling(1), draws EXACTLY the calls (ops, args,
     paint styles) of a view that never replicated; no plan is built while u = 1; the owner hears of a plan once.
     CONTROL: a planted fade that never goes back → fails.
  2. the plan / words / callback: tilingPlan() = what onTilingPlan was told; duration 2–10 s; stops increasing, the
     last 1 'tiled'; phases in order; tilingCaption in each phase = its text, '' at 1; the short words on a 300 px pane
     ("layer k of K" for later layers, the kind alone in layer 1); the first phase's words match the orbifold-term
     pattern (half-turn / rotation by ±… about an n-fold centre / reflection / glide reflection / translation); a new
     tile tells the owner exactly when its timing changed. Clamping of setTiling; NaN ignored.
  3. 17 groups x every preset x amp 0/1 x two panes x every stop ± 1e-6, each phase start and middle, a fade: every
     frame draws, with finite numbers only (1,000+ frames).
- Fix 1 (src/plane.js tilingCaption): it returned '' until a render had built the plan, and after a setScene it read
  the PREVIOUS tile's plan until the next render. It now builds the plan on demand (preparePlan, as tilingPlan does).
  In the app the order (setScene → render → caption) hid it; the API is now safe in any order.
- Fix 2 (my recorder, not the code): the fake ctx must honour save/restore (drawCard's shadow is set inside save/restore).
- test/app-url.test.js: the HASH_KEYS pin → ['g','cut','seed','wavy','tile','t','view'] (the one edited assertion);
  ADDED: tile in the format test (3 decimals, 1 left out, 0 written, clamped, between wavy and t), random states carry
  tile (35 %) through the round trip (2,550 states), every tile value 0..0.999 by 0.001 round-trips and passes
  WRAPPER_HASH, legacy / tile-less links decode to 1, malformed tile values (abc, 1e-3, empty, 0.5/0.5, +0.5) are
  dropped alone, out-of-range values clamped. 14/14 pass.

### 09:35 — films of the current sources (dev/rep-port/film.mjs → dev/app-demo.html, the mini's Chrome), LOOKED AT
- qa/replication/film-{333,2222,s632,4s2,xx,22x}-{laptop,phone}.png (16 frames, u 0 → 1) and
  film-*-laptop-layer1.png (12 larger frames of layer 1). 0 console / page errors.
- Layer 1, one side pairing at a time, named: 333 "rotations by ±2π/3 about a 3-fold centre" (two copies turning about
  the bottom vertex, ring on it, then about the top vertex); 2222 four "half-turn about a 2-fold centre" (each about
  its edge's ringed midpoint; the copy's edge lands on the same-coloured edge), then "translations" (the purple pair
  slides up and down); *632 three "reflection in a mirror" (the copy narrows to the mirror edge and opens mirrored);
  4*2 "reflection in a mirror", then "rotations by ±π/2 about a 4-fold centre" (ring on the square); xx "glide
  reflections" (the two copies flip over the dashed middle axis while sliding up and down), then "translations"
  sideways; 22x two half-turns, then "glide reflections" along the dashed axis. Later layers: "layer k · …".
- Phone: the short words ("half-turn", "reflection", "layer 3 of 12"); the plane is ~225 px, the bar and the words take
  its foot and head; layer 1 still reads; *632's 12 layers bloom from about u 0.45.
- Last frames (u = 1): the plane as always (the bar lingers in the film because setTile(1) starts its 1.4 s linger).

### 09:55 — browser checks on the current sources (dev/app-demo.html; the mini's Chrome), all green
- tools/qa-matrix.mjs `--interact`: ADDED the Tile session (dev/rep-a/check-ui.mjs's checks, run through the matrix's
  own browser, laptop 1280x720 mouse + phone 390x780 touch, DPR 2) + two checks of mine: "the 3D pane is not redrawn by
  the step, and t stays" (renderer draw counter and t unchanged from before Tile to Pause) and "with the bar open
  nothing overlaps, leaves the window or is too small to tap" (the matrix's MEASURE, #hint hidden). Header documents it.
  `--only-interact`: 97 / 97 (70 as before + 27 Tile), 0 console / page errors (qa/replication/matrix-interact/).
  Full run `--interact` (every group at both sizes, every cut, five more window sizes, the session, the frame, touch,
  Tile): **119 pictures, 97 / 97 checks, 0 console / page errors, 0 problems** (qa/replication/matrix/,
  qa/replication/matrix-run.log). LOOKED AT size-320x568 and size-844x390 (the pill in the plane's corner, quiet),
  tile-phone-2-paused, tile-laptop-3-link-s632-025.
- dev/ui3-url-loop.mjs: ADDED tile to the loop (Tile then Pause by real clicks → tile= in the host's address at once →
  the fresh page has the same tile to 3 decimals, paused, the bar open, the same words), a pasted `#g=2222&tile=0.178`
  (paused there, the bar open, the words of that moment "half-turn about a 2-fold centre", the address keeps it), a
  malformed `tile=1e-3` (dropped → tiled, the rest applied, the address rewritten to `#g=2222&t=0.5`). Ran on the
  unbundled page inside dev/app-frame.html: **all passed** (host address
  `#g=4%2A2&cut=1&seed=0.3272/0.4745&wavy=0.65&tile=0.075&t=0.566&view=-46.1/12.3/1.33/-28.4`; legacy #333 #4*2 #*632
  #s632 #%2A2222 as before; throttle 22 writes in a 6 s drag; no history growth). (qa/replication/url/)
- `node tools/test-all.mjs`: **715 tests, 713 pass, 0 fail, 2 skipped** (qa/replication/suite/run-1.log). No remote
  host had room (aifoundry1–3 timed out, the mini 9.1 GB free < 10, intel refused), so it fell back to this Mac (2
  workers, 158 s). Next runs: FOLDING_TEST_HOST=mini.

### 10:25 — pixels, plays and pops on the current sources (dev/rep-port/pixels.mjs, pops.mjs; the mini's Chrome)
- SAME (the plane at u = 1 with the port against dev/rep-port/pre = src before the port; a fresh page per readback):
  17 groups x laptop (DPR 1) and phone: worst **36 levels (3*3), 70 px over 8 (*632)** — the judge's bound exactly
  (it is A's two cached layers against the one layer before); 11 groups identical (0). Phone at DPR 1: worst 23 / 14.
- END (u = 1 − 1e-6 against u = 1, same fresh page): 14 groups ≤ 13 levels, ≤ 15 px over 8 (laptop); 3*3 58/108,
  *333 58/23, *632 55/2. Phone at DPR 1 (the judge's condition): 14 groups ≤ 16 levels, ≤ 9 px; the three exempt ≤ 57 /
  ≤ 15. (At DPR 2 the phone has 4x the pixels: 22* 13 levels in 16 px.) All within acceptance 6.
- PLAY (the real Tile button, every animation frame, 1280x720 DPR 2): 333 4.47 s, 2222 5.72, *632 7.37, 4*2 6.45,
  xx 3.87, 22x 5.77 — median frame 16.7 ms, **0 frames over 34 ms** (max 33.4), u never backwards. Acceptance 7a.
- POPS (400 steps of u, fresh page per group, 333 2222 *632 4*2 xx 22x 632 **, laptop and phone, DPR 1): no flag within
  1.5 steps of a phase boundary or at the replay start or at u → 1. Isolated flags: *632 laptop u 0.935, 0.94 and
  phone 0.9325 (max 2–4 levels: the last corner copies, as the judge found); *632 phone 0.2525 (fresh page: max 29 in
  1 px); ** phone 0.16 (55 levels in a 1-px column, 127 px). Probed (dev/rep-port/pop-probe.mjs, pop-twice.mjs): the
  same frame read twice is identical (not the raster-backend switch); the whole change sits in one 0.0003 sub-step of
  u, along the far edge of the flipping card 0.05 px from rest; with every canvas shadow neutralised it is the same.
  It is the rasterizer's quantized edge coverage (an edge crossing a sample position: 1/4 coverage ≈ 64 levels), as
  any slowly moving straight edge shows. Not a pop of the design. The sweep's END numbers (*632 84, 4*2 29) are
  inflated by its 400 readbacks (the judge's false alarm); the fresh-page END above is the measure.
  Pictures: qa/replication/pops/pair-*.png, probe-*.png. LOOKED AT them.

### 10:40 — layout, small windows, the last runs
- qa-matrix `--interact`: ADDED "a preset chip and the Wavy slider while paused keep u and show the new tile's words"
  (laptop, real clicks / drag). `--only-interact` on dev/app-demo.html: **98 / 98**, 0 errors.
- `SHELL_LAYOUT=1 node --test test/shell-layout.test.js` (23 window sizes x 17 groups, dev/app-demo.html, the pill in
  every plane pane, the bar closed): **pass**.
- Small windows with the bar OPEN (tools/shot.mjs, dev/rep-port/steps-small.json, DPR 2), LOOKED AT:
  `qa/replication/small-844x390-4s2-u02.png` reads well (a 400x250 plane); `small-375x498-333-u012.png` and
  `small-320x568-s632-u027.png`: the plane pane is ~150 px, the caption takes its head and the bar (Tile + scrubber,
  44 px) its foot, so part of layer 1 runs under the bar (333's copies swinging below the tile; *632's tile at the
  lower left of its star sits behind the Tile pill). The judge accepted this for the 390 px phone; on the smallest
  phones it is worse. Not changed (the port is "as it is"); reported.
- `FOLDING_TEST_HOST=mini node tools/test-all.mjs`: **715 tests, 713 pass, 0 fail, 2 skipped** (opt-in), 35 s
  (qa/replication/suite/run-2.log). (Before the port: 709 / 707.) +6: replicate.test.js 3, plane-tiling.test.js 3.

## Files changed (all within my brief; none of crosscap.js, groupdata/crosscap.js, motif-place.mjs, groupdata/motif.js)
- `src/app.js`, `src/index.template.html`, `src/styles.css` — the patch (qa/rep-a/rep-a.diff), comments reworded.
- `src/plane.js` — the patch + the C2 doc block at the top + cardState call + tilingCaption builds its plan on demand.
- `src/replicate.js` — NEW (the patch) + cardState (pure, exported).
- `test/replicate.test.js` — NEW (A's test re-pathed + the cards-continuous test); `test/plane-tiling.test.js` — NEW;
  `test/app-url.test.js` — the HASH_KEYS pin (the one edited assertion) + added tile cases.
- `tools/qa-matrix.mjs` — the Tile session in `--interact` (28 checks: 15 laptop, 13 phone); header.
- `dev/ui3-url-loop.mjs` — tile in the loop, a pasted tile= link, a malformed tile.
- `SPEC.md` — § 7 URL format gains tile (and its rules); § 9 "Replication step" (construction, plane API, DOM, app, tests).
- Scratch: `dev/rep-port/` (pre/ = frozen src before the port + loader; film.mjs, pixels.mjs, pops.mjs, pop-probe.mjs,
  pop-twice.mjs, probe-tiling.mjs, fix-comments.py, steps-small.json); pictures and logs in `qa/replication/`.

## For the final fixer (build + the built page)
- `node build.mjs`; then on dist: `node tools/test-all.mjs`; `node tools/qa-matrix.mjs --interact` (expect 98 / 98);
  `node dev/ui3-url-loop.mjs --page dist`; `SHELL_LAYOUT=1 SHELL_LAYOUT_PAGE=dist/index.html node --test test/shell-layout.test.js`;
  films of the built page: `node dev/rep-port/film.mjs --page dist/index.html --g '333,2222,*632,4*2,xx,22x' --out qa/<dir>`
  (and `--layer1 --sizes laptop --cols 4 --frames 12`); pixels: `dev/rep-port/pixels.mjs` reads dev/app-demo.html (its
  SAME compares with dev/rep-port/pre), so for dist compare by eye or re-point it.
- Not verified here: the built page (no build allowed), Safari / Firefox / a real phone / a real GPU.

### 10:50 — the films, all looked at
All 12 full films (6 groups x laptop, phone) and the 6 laptop layer-1 films in qa/replication/: layer 1 one side
pairing at a time with its words and its ring or dashed axis; the moving copy's coloured edge lands on the
same-coloured edge; the last frame is the plane as always; 0 console / page errors. On the 390 px phone the first
copies that swing below the tile (2222's first half-turn, 333's first rotations) pass partly under the open bar.
