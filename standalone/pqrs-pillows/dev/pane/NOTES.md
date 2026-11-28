# pane: notes (owner of `src/surface-pane.js`, `src/print3d.js`, `test/print3d.test.js`)

Fri 27 Nov 2026, 16:02 to 16:45, on the mini (M4, node 26, headless Chrome). Every number below was measured here;
how is said beside it.

## For the integrator (read this first)

1. **The turn after a flip wants the model's `shift` too.** `page.js` calls
   `S.pane.turn(turn, 0.5, { inverse: true })`. `sm.flip` returns `{ turn, shift, cold }` with new pose = turn · old
   pose + shift, so the call should be `S.pane.turn(r.turn, 0.5, { inverse: true, shift: r.shift })` (keep `r`, not only
   `r.turn`). Measured on the real surface model in the harness (pane 562 px wide, the four marks' jump on the screen
   at the first frame of the turn; the flip itself moves them by 45 to 390 px): 2345 to (0,2): 5 to 13 px with the
   shift, 27 to 37 px without; 2223 to (0,2): 10 to 25 against 25 to 40; 3333, 4444, 2222 (shift about 0): 0 to 10
   either way. What is left with the shift is the model's carry, which is not rigid (surface owner's).
2. **`bake` and `chartOf` go together.** `chartOf` folds with the motions, and lays the disc, of the state BAKED (or
   `prepare`d) last. `page.js drawSurfaceFrame` calls `S.print.prepare(st)` + `chartOf` when the mesh's version
   changed in a frame whose bake was skipped: the chart is then this state's and the texture an older state's. With
   the disc centred on the neck (below) the two can differ by more than a little for one frame. It only happens where
   a bake takes over 12 ms (the page then spaces bakes); if it shows, bake in that frame too, or keep the old chart
   (`showFrame` without `uv`). Not a fault at the speeds measured here (2 to 7 ms a bake).
3. **The chart is not literally "the Poincaré disc of the pair frame"** (SPEC 1.6): it is that disc slid so that its
   centre is the middle of the NECK (print3d.js header, `neckMiddle`). Same cell, same contract for the caller. Why:
   on short loops the far pillow lay near the disc's rim (3333, Length 0.4: the fold reached 4.77 from the pair
   frame's origin, where a texel of a 512 texture was 0.234 long at the farthest mesh point, against 2.46 and 0.027
   now: `sweep.mjs`). `createPrint3d({ centre: 'pair' })` gives the literal one (tested too).
4. **2222 at Twist 0 is two sheets on one another.** The pane gives the paper a thickness (`puff: 0.0015` of the
   frame's radius, along the outward normal), which cures the sand-coloured half that showed (`shots/2222-solved.png`
   is after). surface-model's `flatMinConorm` does the same from its side; either is enough.
5. **Labels.** `showFrame` writes `mark.label` if the model gives one, else `opts.labels` (a function of the mark, or
   a map by id), else `id + opts.orders[mark.feature]` (orders BY FEATURE). The page passes a function: fine.
6. Pictures of the real model through the pane: `shots/model-3333.png`, `model-3333-j1.png`, `-j2.png`,
   `model-2345.png`, `model-2222.png`, `*-flipped.png`. The baseline solver's wrinkles show in the print (the commas
   themselves are right: whole across the loop).

## What there is

- **`src/print3d.js`**: `createPrint3d(opts?)` -> `{ bake(state, { size }), chartOf(corners, out?), prepare(state), current }`.
  The header comment is the contract and says how. In short:
  - outlines: `centredFor(state).shapes[i].pts`; tile motions: **`tilesPSU(D, A, { focus, radius, extraSamples })`**
    of `two-features-two-handles/src/pattern-ext.js` (the Pattern pane's own walk); bake: `the-folding/src/sdf.js bakeSDF`;
  - hyperbolic: cell origin (-1, -1), e1 (2, 0), e2 (0, 2), disc coordinates, range 6 texels; 2222: one cell of the
    translation lattice (2a, 2b from the engine's home points, Gauss-reduced), chart point = plane point;
  - `chartOf` brings each TRIANGLE (its three corners together) near the middle by motions of the group: candidates
    found per state with `locateTilePSU` + the walk (one for each of about 180 sample points of the tile, and the 12
    that move the middle least); a triangle left far out is first put into the engine's tile;
  - commas that overlap (any Length away from the family's own) are baked as their UNION, in up to 6 layers joined by
    the smaller byte: else the outline of one shows as a hairline inside the other;
  - two data arrays a size, written in turn; the same state + size returns the same object.
- **`src/surface-pane.js`**: the prototype's API unchanged, plus
  - `showFrame(frame, { uv, orders, labels, keepChart, immediate, render })`: lays a mesh only when `frame.version` or
    the chart changed (the chart is compared by content), else moves the positions; curves and marks by vertex ids in
    the page's look (exported `LOOK`: loop ink 1.8 px, seal0 blue #0072B2 3 px, seal1 orange #D55E00 3 px, marks blue
    13 px / orange 9.5 px, labels in the pair's colour, the orange label a shade darker, #b04d00, for contrast);
  - `turn(rotation, seconds, { inverse, shift })`, `turning`, `charted`, `markAt(id)`;
  - options `chart`, `look`, `puff`; defaults: tint = ink at 0.11, view az -20 / el 14, wheel 'turn' with the
    page-scroll guard (as in the prototype).
- **`test/print3d.test.js`**: 10 tests, `node --test test/print3d.test.js`, 0.8 s. The truth is made without print3d's
  ways: the group is walked afresh from `centredFor(state).A.maps`, point-in-polygon in the Klein model.
  1. 3333 at defaults and Twist 0.2; 2. 2345 (orders [2, 3, 5, 4]) the same; 3. 2222 at defaults, Twist 0.2 and
  Length 1.6 / Twist -0.37: 500 random points of the tile and their images under random motions, 0 wrong outside two
  texels of an outline; 4. 2223, Length 5.5, 0.8, 7 (Twist -0.5), a short loop with Twist 0.45, the pair-centred
  option; 5. overlapping commas are a union (it fails on the one-layer bake, as it should: `node --test dev/pane/v3-union.control.mjs`
  runs the same file against the kept `dev/pane/print3d.v3.js`; that control is named so the suite does not pick it up);
  6. after a flip (`recut` + `retiePrint`) the new state's print read in the new frame is the OLD pattern (four flips,
  0 wrong); 7. on pillow.js's mesh the two copies of every seal vertex, and a point and its lift one loop on, read the
  same tone; 8. a triangle moves as one; 9. the two arrays; 10. no DOM, times.
- **`dev/pane/`**: the harness page (`harness.js`, `harness.template.html`, `harness.css`, `standin-frame.js`;
  `bash build.sh` -> `index.html` with the shared build), `shots.mjs` (`node shots.mjs name=hash ...`), `check.mjs`
  (17 browser checks -> `check.out.json`), `sweep.mjs` / `sweep.out.txt`, `layers.mjs`, pictures in `shots/`.
  Hash: `#k=3333&l=..&tw=..&mode=open|pressed|solved|model&j=0..2&az=..&el=..&zoom=..&puff=..`
  (`open`: pillow.js's exact crowns; `solved`: solver.js, or flat2222 for 2222; `model`: the real surface-model).

## Numbers

- **Bake** (the whole `bake` call: walk, fold, layers, bakeSDF), median over nearby Twists:
  node: 3333 1.8 ms at 512, 3.4 at 1024; 2345 2.8 to 3.4 and 4.6 to 5.2; 2222 0.6 and 1.9.
  headless Chrome: 3333 1.8 / 3.9; 2345 3.2 / 5.0; 2223 3.1 / 4.8; 2222 0.8 / 2.4. A process's first bake: 10 to 15 ms.
- **chartOf**: 5,200 triangles 0.38 ms in node; 5,472 triangles 0.3 ms in Chrome (2222: under 0.1).
  `showFrame` with a new chart (the mesh laid again, no render): 0.3 to 0.4 ms.
- **Over the sliders' range** (`sweep.mjs`, 512, 6 signatures x Length 0.4 .. 7 x Twist 0, 0.25, -0.5 = 144 states):
  no state without a print, no pair of copies of one surface point reading different tones; the fold's reach at most
  2.6 on 3333 and 2345, 3.0 on 4444, 4.0 on 9999 (Length 0.4). Slow corners: the first bake of 4444 at Length 0.4 is
  47 ms (1,430 outlines, 3 layers), 9999 there 76 to 82 ms, 2223 at Length 7 22 ms (6 layers). Elsewhere 2 to 12 ms.
- **Browser check** (`node check.mjs`): 17 of 17: WebGL2, labels and their colours, the home view, showFrame's
  rule, turn (starts turned by 182 px at the mark, ends within 0 px of rest; `{ inverse }`; `turn(null)`), reduced
  motion (no turn), the wheel turns (az -20 -> -8.8 for a wheel of 60) and a wheel that scrolls the page leaves the
  view alone, a phone-size context, the real model's frames and three flips, the pane's own `chart` option.

## Not done / ideas

- The slow corners above: cull copies shape by shape (now a tile brings all its commas), and make the overlap test
  cheaper than every pair (it repeats under the group).
- The print at the chart's rim is still coarser than in the middle. A texel of a 512 texture at the farthest mesh
  point (`sweep.out.txt`): 0.012 long on 3333 at its own Length, 0.027 at Length 0.4, 0.043 on 4444 and 0.11 on 9999
  there (a comma is about 1 long). Two cells, one a pillow, would halve it; not needed at the presets.
- No DOM test of the pane under node (the browser check stands in for it). Safari and a real phone: not run.
- Commas piled more than six deep keep a hairline (2223 at Length 7).
- `page.js` could hand `frame.cornersVersion` to decide when to chart; today it charts when it bakes, which is right.
