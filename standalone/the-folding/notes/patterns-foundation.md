# The foundation of the shape prints — 13 Nov 2026

The pattern round (the owner: *"come up with some patterns which are more like a comma but they fill more of the
space. And they reuse the idea of the checkerboard by giving different tints to the two sides"*) adds a third kind of
print, the SHAPE print: the dark tone of the plane is the union of g(motif) over every element g of the group, for a
motif of a few closed polygons, printed like the checkerboard (opaque paper, front teal, back sand, two tones each). It
is the group's by construction, so it closes without a break across every seam of every cut.

The first run of the round built this foundation (agents core-shapes, core-sdf, renderer, glue; the glue was cut off
before it reported). Three reviewers then read it (mathematics, the picture on a GPU, the app). The second run's fixer
fixed what they found and finished the glue; this note is the result: what there is, the contracts as they ended up,
what was measured, what is not done. The round's reports: `dev/patterns/round1/`.

## What there is

| file | what | tests |
|---|---|---|
| `src/shapes.js` | the print: `makeShapePrint`, `shapeElements`, `fillShapes`, `copiesIn`, `bakeShapes`, `validateShapes`, `printable`, `thinParts`, `measureShapes` | `test/shapes.test.js` |
| `src/sdf.js` | the signed-distance texture of polygons over a lattice cell: `bakeSDF`, `sdfSample`, `sdfDistance` | `test/sdf.test.js` |
| `src/render3d.js` | print mode 3: one read of an R8 texture per pixel at lattice coordinates, a one-pixel ramp across sd = 0 | `test/render3d.test.js`, `test/render3d-dom.test.js`; `dev/patterns/tex-demo.*`; `notes/patterns-renderer.md` |
| `src/pattern.js` | the registry and the glue: `registerPattern`, `allPatterns`, `resolvePattern`, `printFor`, `printUniforms` mode 3, `fillPrint` | `test/pattern.test.js` |
| `src/app.js` | the select lists `allPatterns()`; `#app[data-print]`; `getState().printKind`; `pat=<key>` in the address | `test/app-url.test.js` |
| `src/plane.js` | a shape print is filled once per window into three cached layers, its outline simplified to a quarter of a device pixel | `test/plane-print.test.js` |
| `dev/patterns/app.html`, `app-sheet.mjs` | a design in the real app (registers designs, then starts the app); all 17 groups as one picture | `dev/patterns/README.md` |

## The contracts

**Registering** (`src/pattern.js`).
- `registerPattern({ key, label?, hint? }, find)` → the frozen `{ key, label, hint }`.
  - `key`: lower-case letters, digits, `-` and `_`, a letter first, at most 24 characters. It goes into the address.
  - A key that resolvePattern already knows is refused: a key, a label, an alias.
  - `find(group)` → `{ shapes: [{ pts: [[x, y], …], hole? }], info? }`, in the world coordinates of the group. It is
    pure and may throw for a group it has no motif for.
- `allPatterns()` → `PATTERNS` (checker, rings, comma; frozen), then the registered ones in the order they came.
- `resolvePattern(raw)` → a key or null. It ignores case and blanks and takes a label for its key.
- `printFor(group, key)` → the print of the group, the same object every time (cached per group). It is null for
  `comma`, for an unknown key, and for a registered pattern when:
  - `find` threw or gave no `{ shapes }`;
  - `makeShapePrint` refused the motif (no polygon, a point that is no number);
  - **the motif breaks a rule that would draw it wrong** (`printable`, below).

  Each refusal gives one `console.warn` with the pattern, the group and the first two problems; the app then shows the
  comma for that group.
- **Register before `src/app.js` runs.** It starts itself when imported and reads the address then: a `pat=` that
  names no pattern yet is dropped, and the address is rewritten. A pattern registered later joins the select at the
  next `syncPattern` (a group, a cut or a pattern chosen). `dev/patterns/app.html` imports the designs first. The
  designs import `../../../../src/…` from `dev/patterns/designs/`; the ones that ship move under `src/`, and the page's
  entry imports them before `./app.js`.

**The rules** (`src/shapes.js`).
- `validateShapes(print, { gap = GAP_MIN })` → `{ ok, problems, gap, stabilizer }`. It checks the rules of the kit
  (`dev/patterns/kit.js`) and three more:
  - two polygons of one motif do not touch;
  - a polygon does not touch itself;
  - a polygon has an area.
- `printable(print)` is `validateShapes` with the gap the 3D texture can hold, `TEXELS_APART` = 2 texels of a
  `BAKE_SIZE` texture of the print's cell (0.003 tile sizes in o, 0.0073 in \*632), in place of `GAP_MIN` (0.02).
  - It is what `printFor` asks. Its cost per group is 0.8–4.6 ms for the designs in Chrome, cold; 10 ms for the stress
    design.
  - `GAP_MIN` stays the rule of a finished design. `app-sheet.mjs` prints it as `RULES`; the page still shows the print.
- `thinParts(print, width)` → `[{ length, width, at, dark }]`, the longest first. These are the runs of the motif's
  outline along which the motif is thinner than `width`:
  - dark: a needle, a neck;
  - light: a slit, the gap round an island.

  It is a measurement, not a rule. `app-sheet.mjs` prints `THIN` when a part is under 1.5 texels along more than 6
  texels of outline. At 1.5 texels: the page's comma 26–57 texels, ripple 27–29, bigcomma 11, the stress design 33–36;
  paisley and glyph none.

**The texture** (`src/shapes.js`, `src/sdf.js`).
- `bakeShapes(print, size = BAKE_SIZE)` → a frozen `{ size, data, range, origin, e1, e2, pitch }`.
  - `BAKE_SIZE` 1024, `BAKE_RANGE` 6 texels.
  - `e1`, `e2` are a REDUCED basis of the print's lattice, not always the group's: the rhombus of \*x is 21°.
  - `origin` is the corner of the cell whose middle is the motif's centre.
  - Texel (i, j) is at `origin + ((i + ½) / size) e1 + ((j + ½) / size) e2`, value v ↦ sd = (v − 128) / 127 · range,
    negative in the dark.
  - The same object is returned while the print is among the `BAKE_KEEP` (6) asked for last. The renderer keys its
    upload on the data array, so asking again per frame costs nothing.
- `bakeSDF` is exact: every texel byte equals `round(128 ∓ 127 min(margin / range, 1))` (the math review, about 440
  textures). A part thinner than about 1.5 texels is not held (see `thinParts`).

**The renderer** (`src/render3d.js`; the details are in `notes/patterns-renderer.md`).
- `printUniforms(print)` for a shape print is `{ mode: 3, L, A, I, O, tex }`:
  - `tex` = `bakeShapes(print)`, baked at the first call and the same object after;
  - `A` = the texture's (e1, e2);
  - `I` = the rows of [e1 e2]⁻¹;
  - `O` = (origin, range).
- `R.setStyle({ print })` uploads the R8 texture (REPEAT, trilinear, anisotropic) in the next drawn frame, only when
  `tex.data` or `tex.size` is another one. `R.stats.printUploads` counts the uploads.
- A lost context is restored from the kept array.
- What is refused: no tex, a bad size, data or range, numbers that are not finite, a size beyond the GPU's limit. The
  sheet is then drawn plain, with one warning.

**The canvas** (`src/shapes.js`, `src/pattern.js`, `src/plane.js`).
- `fillShapes(c, print, map, box, fillStyle, tol = 0)` draws every copy that can touch the box as ONE path, by the
  nonzero rule. Mirrored copies are walked backwards, so coincident copies add up and a hole stays a hole.
  - With `tol > 0` the outline is simplified to within tol world units: Douglas–Peucker, keeping points of the
    outline, cached per print and power-of-two tolerance.
  - `fillPrint(c, print, map, box, fillStyle, tol)` passes tol on to it; linear prints and rings ignore it.
- **The plane** (`src/plane.js`).
  - A shape print is filled ONCE per window (view, canvas, print) into three offscreen canvases (`printLayers`):
    - `dark`: the tile's opaque front tone;
    - `pale` and `paleBack`: made from `dark` by `source-in` compositing, in the plane's pale teal and pale sand.
  - A frame draws them under the clips it already has, as the `base` layer is drawn: the tinted copies, the tile, and
    the landed copies of the Tile step.
  - The cards of the Tile step move, so they cannot take the layers. The tile's share of the print (the copies near
    the tile) is ONE world-space `Path2D`, made once per tile, print and scale (`cardPath`), and each card fills it under
    its own transform (`setTransform`: world → its place → the window → device pixels). Drawn both ways on two canvases
    of the same Chrome, a card differs from the old one (fillPrint through the card's map) in at most 27 pixels by at
    most 7 levels, turned, flipped and shifted by fractions of a pixel, at dpr 1 and 2 (`scratch-fixer/card-equiv.mjs`).
    Without `Path2D` (node) a card fills through its map, as before.
  - All shape fills are at `PRINT_TOL` = ¼ device pixel: the stress design keeps 220 of its 1982 points at the plane's
    scale of \*442, paisley 154 of 485.
  - The layers are dropped (their memory given back) when the print on screen is not a shape print.
  - Linear prints and the rings are drawn as before, in every frame, pixel for pixel.
  - Without a document (node), fillPrint draws on the canvas itself.
  - `P.stats.printMs` and `P.stats.printBuilds` record the last filling and how many there were.

**The app** (`src/app.js`).
- The select's options are `allPatterns()`.
- `#app[data-pattern]` is the key. `#app[data-print]` is the kind of the print on screen ('linear', 'rings',
  'shapes'), absent under the comma, also for a registered pattern that has no print for the group.
- `getState()` gains `printKind`.
- The address carries `pat=<key>` right after `g`.

## Measured

Chrome on the mini (Apple M4, ANGLE Metal), 1280 × 720 at dpr 1 (plane canvas 622 × 550), median of 5. The script is
`dev/patterns/scratch-fixer/perf.mjs`; the JSON files are in `~/drive.unsynced/artifacts/the-folding-patterns/fixer/`.
A draw is `P.render()` and a 1-pixel read that waits for the canvas.

| design, group | one plane draw, before | after: the same window (a frame, a drag, the Wavy slider) | after: a new window (layers made anew) | Tile step at u = 0.5, before → after |
|---|---|---|---|---|
| stress (1982 points), \*442 | 70.1 ms | 2.1 ms | 6.8 ms | 77 → 3.6 ms |
| stress, \*632 | 45.9 | 3.2 | 7.9 | 49.6 → 4.3 |
| stress, 4\*2 | 40.7 | 2.0 | 6.3 | 42.1 → 2.7 |
| stress, o | 3.8 | 1.9 | 3.2 | 6.0 → 2.4 |
| paisley (452–517 points), \*632 | 33.7 | 3.6 | 8.5 | 28.5 → 5.3 |
| paisley, \*442 | 21.9 | 2.5 | 5.8 | 17.5 → 3.5 |
| paisley, 4\*2 | 14.3 | 2.4 | 5.9 | 13.1 → 2.5 |
| ripple, \*632 / \*442 | 20.6 / 21.7 (the app review) | 3.0 / 2.6 | 8.5 / 7.5 | 21.7 (\*442) → 3.8 |
| bigcomma, \*632 / \*442 | 15.2 / 15.9 (the app review) | 3.1 / 2.5 | 6.8 / 5.6 | → 3.9 / 3.6 |
| checkerboard, \*632 (unchanged code) | 4.4 | 4.7 | 4.4 | 4.8 → 3.9 |
| rings, \*442 (unchanged code) | — | 8.9 | 8.8 | → 9.4 |

- The budget is 8 ms.
  - A frame in the same window is within it for every design. That covers a drag of the cut, the Wavy slider, the
    Tile step, the plane's redraws.
  - The first draw in a new window reaches 7.9 ms for the stress design and 8.5 ms for paisley and ripple, all in
    \*632. A new window comes with a new group, cut or size, and with each frame of the window's glide after one
    (about 0.2 s).
  - The rings were 8–9 ms a draw in 4\*2, \*442 and \*632 before this round and are unchanged (one clip per centre's
    cell); the reviews did not ask about them.
  - A frame of the Wavy slider with both panes takes 5–7 ms (before: up to 73 ms).
  - The Tile step frame by frame (u = 0, 0.01, …, 1; `scratch-fixer/tile-sweep.mjs`), median / 95th percentile /
    frames over 8 ms of 101:

    | group | checkerboard | paisley | stress | ripple |
    |---|---|---|---|---|
    | \*632 | 2.4 / 5.7 / 3 | 6.1 / 11.5 / 25 | 6.3 / 11.1 / 23 | 6.0 / 12.9 / 27 |
    | 4\*2 | 6.1 / 10.0 / 18 | 4.7 / 9.0 / 11 | 4.9 / 8.7 / 10 | 4.6 / 8.7 / 11 |
    | 333 | 5.6 / 10.4 / 20 | 4.6 / 8.3 / 8 | 4.0 / 8.3 / 7 | 5.0 / 9.7 / 15 |

    In 4\*2 and 333 a shape print's step is as cheap as the checkerboard's own (its cards, glyphs and mirror runs
    cost that much). In \*632 its many cards still fill about 20 k points a frame. Before the layers, the step was
    28.6 ms a frame for paisley in \*632 (the app review); with the layers and before the `Path2D` cards it was 6.9 /
    15.9 / 46.
- Two other paths were tried and measured, and gave no gain:
  - Without the simplification, filling the layers took 14–34 ms for the stress design.
  - Composing the copy's element into the canvas transform cost more than the arithmetic per point.
- The picture: the plane pane before and after differ only on the outlines, by antialiasing (up to 38 of 255 on a pixel
  of the tile's opaque edge). Crops are in `fixer/compare/layers/` (`crop-paisley-4s2.png`): the same marks.
- **The first bake of a print in a fresh page** (nothing warm), at BAKE_SIZE:
  - stress: 22.9 ms in \*632, 8.5 in o;
  - the designs: 5–14 ms;
  - a second bake: 2–14 ms.

  The budget is 60 ms (`fixer/bake-cold.json`).
- **find()**, the designs' own code, runs once per group on the page's thread when the group is first shown (Chrome,
  cold): paisley 148 ms in \*632, ripple 92, bigcomma 53. That is the designs' to cut; `kit.js` asks for well under
  100 ms.
- **The three built-in patterns are as before.** I compared sheets of all 17 groups in the same Chrome, using HEAD
  (cd06b92, the app reviewer's git-archive export) and the workspace: checker at t 0 and 0.6, rings at t 0, 0.6 and 1,
  comma at t 0 and 0.6.
  - 0 pixels differ in six of the seven.
  - In rings t 0, 27 pixels of at most 3 levels differ, at the same three places in every cell: interface text at the
    plane's head and a corner of the fold pane, not the print.
  - The 15:41 baselines differ from HEAD and from the workspace by the same 30 to 361 pixels.
  - The script is `dev/patterns/scratch-fixer/sheets.sh`; the results are in `fixer/sheets.txt` and `fixer/sheets/`.
- The 3D frame and the GPU: the GPU reviewer measured 0.44–1.44 ms a frame with any shape print, the same as the
  checkerboard; flat and folded sheets match the print pixel for pixel away from outlines; there is no seam.
- **WebKit** (Safari 26.5's engine, Playwright on the M5), on the sources (`dev/patterns/app.html?designs=demo,stress`),
  at 1180 × 760 and on a 390 × 780 phone at dpr 2: the surface program with mode 3 links, no GL error, no page error or
  warning, a shape print is drawn in both panes (the demo and stress designs in 333, \*632, o and 22x; the
  checkerboard and the rings as before). Script: `dev/patterns/scratch-fixer/webkit-mode3.sh`; pictures:
  `fixer/webkit/`. The phone picture also shows the bare caret of the pattern pill (below). The built page was not
  tried (no build in this round).

## Not done, or still wrong

(15 Nov 2026: the pattern round closed the first four of these and the slow finds — the shell agent's swatches and the
legend's paper rule, SPEC.md §11, the designs shipped as `src/patterns/` and imported by `src/pattern.js`, every tip
rounded to 1.5 texels or more (the Comma's tail kept 2 texels thick, `src/patterns/comma.js`); Paisley draws a table of
the marks its search grew, and the current pattern's prints of the other groups are made while the page is idle
(`src/patterns/warm.js`). The list below is as it stood on 13 Nov; `notes/patterns-round.md` has what is open now.)

- **The shipped stylesheet does not know shape patterns.** `src/styles.css` is not the fixer's file. The app sets
  `#app[data-print="shapes"]`, so the integrator adds:
  - the legend's paper item: `.app[data-print] .lg[data-paper] { display: flex; }`, kept inside the existing
    `@media (max-width: 359px)` rule that hides it. Today only `dev/patterns/app.html` has it.
  - a swatch for a shape pattern. Today the pill on a phone is a bare caret 25 px wide, so a tap target fails. Add a
    `.pat-sw-shapes` svg to the pill in `src/index.template.html`, shown by
    `.app[data-print="shapes"] .pat-sw-shapes { display: block; }`, or one swatch per design.

  Then run the layout gate with a page that registers the designs (`SHELL_LAYOUT_PAGE`), and the WebKit check.
- **SPEC.md says nothing of shape prints.** It is not the fixer's file. The renderer's paragraph is at the end of
  `notes/patterns-renderer.md`. For SPEC 10 the integrator adds:
  - `registerPattern`, `allPatterns()` and the refusal;
  - `#app[data-print]`, `getState().printKind`;
  - `src/shapes.js`, `src/sdf.js`, `BAKE_*` and the plane's layers.

  SPEC 10's "PATTERNS = three, printFor null only for comma" is out of date.
- **Nothing in `src/` registers a design yet.** Whoever ships designs moves them under `src/` and imports them before
  `./app.js`.
- **Thin parts:** the 3D view still cuts needle tips short. `thinParts` and app-sheet's `THIN` measure it. The fix is
  the designs' (round a tip to 1.5 texels), or a larger texture (2048 halves it).
- **A new window costs 6–9 ms** with the heaviest motifs (above), so the glide after a group or cut change runs at
  about that per frame.
- **find() is slow** for several designs (above). It is theirs to cut: precompute the motif per group.
- **Thin LIGHT parts are not refused.** Copies nearer than 2 texels are (`printable`), but a slit, or the gap between
  two polygons of one motif, as thin is only reported (`THIN`, light). Of the designs measured (demo, ripple, bigcomma,
  paisley, glyph, stress) only the stress design has light thin parts: the sharp corners of its triangular holes and
  its slit.
- **A pattern registered after the page started** joins the select only at the next group, cut or pattern change, and
  a link that named it was rewritten at the start (see the contracts).
- Not re-tried: one phone measurement of the GPU reviewer (390 × 780, dpr 3, demo \*632, the first draw after 4\*2)
  that did not match the camera. The reviewer's five replays were clean; it was probably the probe.
