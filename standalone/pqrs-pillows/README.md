# PQRS pillows

One self-contained page: the orbifold PQRS (a sphere with four cone points of orders P, Q, R, S) drawn in space as
**two pillows joined along a loop**, beside its symmetric pattern, with **three coupled partition cards**. Each of
the three ways to pair the four cone points has its own loop, Length and Twist; moving any of them moves the other
two, and making another partition the active one changes the parameterization and nothing of the geometry: the
pattern on the screen stays where it is.

- Live: https://spacesheep.dev/@yaroslavvb/pqrs-pillows (deployed by the orchestrator, not from here).
- The binding description of the page is `SPEC.md` in this folder. This file says how to work on it.

## The request it answers

Yaroslav Bulatov, Fri 27 Nov 2026:

> Come up with a way to visualize PQRS decomposition described in
> https://spacesheep.dev/@yaroslavvb/critique-of-chaim-s-reply . In particular, I'm interested in having a
> visualizaiton of the pillow. Create a separate PQRS orbifold visualizer that lets me change twist/length, but I want
> to see this also in the surface visualization, ie, there's twisting happening in
> https://spacesheep.dev/@yaroslavvb/twist-of-2222#l=1&t=0&c=0.296, I want to see this kind of twist and
> lengthening, but also, I should be able to change my parameterization using geometry preseving local flips […]
> Find a way to do those flips without changing the visualization of the actual symmetric pattern (poincare disk or
> flat for the 2222 use-case).

And the same day, in two sibling sessions (`SPEC.md` § 0): *"simultaneously give controls for all partitions … I
should be able to adjust the twist between two pairs and simultaneously see the sliders adjust for the other choice
of pants"*; *"use two different colors to mark special points on two different sides of the twist"*; *"I want to
have some kind of pattern which covers the entire pillow"*.

What started it is Chaim Goodman-Strauss's reply to Two features, two handles, public on the critique page linked
above: *"So the PQRS orbifold is made of two of these pillows, each with two regular corners and with one joining
loop."* The page is built from that reply as Yaroslav Bulatov understood it; Chaim Goodman-Strauss has not seen it.

## What is on the page

| Part | What it shows |
|---|---|
| Presets `2222 3333 2223 2345 4444` and a text field | four orders, each 2 to 9; 2222 is flat, the rest hyperbolic |
| Pattern pane | the pattern in the Poincaré disc (the plane for 2222), from Two features, two handles; marks by pair in blue (larger) and orange (smaller), the two seals, the loop |
| Surface pane | the two pillows in 3D, a turntable; the pattern's own commas printed on them |
| Journey scrubber | `surface` → `two pillows` → `open crowns` (Join / Part, Zip / Unzip) |
| Three cards `PQ\|RS`, `PR\|QS`, `PS\|QR` | Length and Twist of each partition's loop; touching a card that is not active makes it active first |
| The two pillows, a table | corners, loop, seal, heights, area; `crown exact` or `peaks past the rim: flange`; the closed surface's stretch |
| Tutorial tab | six short sections with the formulas (`src/tutorial.html`) |
| Address | `#k=<orders>&m=<marking>&l=<Length>&tw=<Twist>[&tri=…][&j=<journey>][&v=<az>,<el>]` |

## What is exact and what is relaxed

| Drawn | Status | Where it comes from |
|---|---|---|
| The pillow's six data (corners, seal, heights), its area | exact, closed forms | `src/pillow.js`, checked against the engine to 1e-12 |
| The open crowns, while both peaks are inside the rim `arsinh(2π / L)` | exact: an isometric piece of the surface of revolution `r(s) = (L / 2π) cosh s` | `src/pillow.js` |
| The Twist on the open crowns | exact: the upper crown turned by `2π · tw` | `src/pillow.js` |
| Peaks past the rim | not exact: a level flange, meridians true, parallels short; the table says so | `src/pillow.js` |
| The three Lengths and Twists, and the pattern when another card is activated | exact: closed forms; the model's cone points hold to 1e-9 | `src/flips.js`, `src/state.js` |
| 2222, the closed solid | exact: the tetrahedron of Twist of 2222; its seals are turned by `arccos(1 − 4 tw)`, not `2π tw` | `src/flat2222.js` |
| The closed hyperbolic surface | **relaxed**: a triangle mesh whose edges have exact rest lengths and whose positions are relaxed toward them; the page prints the mean and worst stretch `abs(chord / rest − 1)` it measured for the state shown | `src/solver.js`, `src/surface-model.js` |

Why the closed surface is not exact: two smooth faces that meet at an angle along a curve that is a geodesic of
both force that curve to be straight, so a surface of curvature −1 creased along geodesics, with the faces of a
tetrahedron, cannot exist in R³ (the critique page, and Tutorial § 3). The page shows a mesh and says how far off it is.

### The solver (Fri 27 Nov 2026, evening)

`src/solver.js` is the winner of a round of three prototypes (position-based, energy minimisation, an explicit
construction), measured on the same 17 states with the same tool; the prototypes, their pictures and their numbers
are in the staging folder `/Users/solid/drive.unsynced/artifacts/pqrs-pillows/proto/` (`solver-*`, `blend`,
`solver-final`). What it is:

- **Energy** on the closed mesh: edge springs against the exact rest lengths, bending through the cotangent
  Laplacian of the rest metric (the seals and the cone points left free, so the seals are creases), a fold guard,
  and a little pressure instead of contact. Minimised by L-BFGS; one iteration depends on the state only, so a shape
  does not depend on how the frames cut the time.
- **Start**: where the waist is round enough, an explicit construction (rows laid on rounded parallelograms of their
  own lengths, the upper pillow turned by `2π · tw`), clean and mirror-symmetric in the Twist; elsewhere (a wide
  waist, a pair of 2s under a twist) the flat 2222 tetrahedron of matching proportions, puffed a little.
- **A cap on polish**: 100 iterations after the construction, about 800 after the flat start (full convergence
  makes a small notch in the middle of a seal).
- **Never a crossed surface on screen**: a cold start is held at its last shape that passed a crossing test; a drag
  is taken in sub-steps, and a fast Length drag leaves the surface behind (`solver.lag`) until the following frames
  catch up.

Measured with `proto/common/metrics.mjs` (2,600 to 2,760 vertices, Apple M4): no crossing on any of the 14
hyperbolic test states at the cap; mean stretch 0.49 to 1.09 % (3333 as it opens: 0.85 %, worst edge 6.3 %); a
first shape in 2 to 10 ms, at rest after 64 to 165 ms (construction) or 450 to 700 ms (flat start); a Twist drag of
a whole turn in 64 steps with no crossing, every step within 1.1 times the median step and the seals' angle turning
steadily; a flip carried onto the new partition's mesh settles in 3 or 4 frames and moves by rms 0.004 to 0.009
(it is the same surface). Known weak spots: a fast Length drag from 0.7 to 6 lags and catches up after release with
one visible jump; the seal lines have small kinks near the tips; on 2222 one crease of the exact tetrahedron shows a
faint jagged line where the grid crosses it.

### Two choices made after the spec

- **The pillows are told apart by the two tones of the paper**: the first pair's pillow in the front's teal, the
  second pair's in the back's sand (`createSurfacePane(…, { sides: 'paper' })`), and a key item "their pillows".
  The spec's 11 % shade of ink on the second pillow could not be seen in the pictures.
- **The default view is az 70, el 14** (`state.js` `DEFAULT_UI`): the first seal lies along y, so az 0 looks along
  it; az 70 shows it across the screen, as Twist of 2222's view shows its solid.

### Activating another card turns nothing (his ask, Fri 27 Nov 2026, 22:30)

*"Don't rotate the three-dimensional shape when switching between different sliders. Keep orientation the same."*
The first version turned the solid over half a second so that the new loop stood level with its first pair below.
Now the surface stays where it is on the screen and only what is drawn on it changes: the loop (another closed
curve of the same surface, generally tilted), the two pillows' tones, the seals and the pairs' colours.

- `surface-model.js` keeps a **hold** (world = R x + t for a point x of the model's own frame): a flip moves the
  model's frame to the new cut and the hold takes that move up, so `frame()` hands out the same surface in the same
  place. The camera's frames are kept in world coordinates and are kept through a flip while every point of the solid
  still lies inside them. A failed carry (a cold start) lays the four cone points where they were.
- Measured in Chrome (`dev/final/hold-check.mjs`): on activation the four cone points move on the screen by at most
  2.6 px (3333), 5.8 px (2345: the surface relaxes a little on its new mesh) and 0.1 px (2222), against 115 to 303 px
  before; three activations round return them to within 1.4 px.
- **The reset button (↺) lays the active cut level again** (`sm.relevel()`): the one place where the solid turns, over
  half a second (at once under reduced motion). A new orbifold or a link opens in the cut's own pose.

## Files and owners

Built by five owners working side by side; each file has one.

| File | What | Owner |
|---|---|---|
| `SPEC.md` | the binding spec | orchestrator |
| `src/flips.js`, `test/flips.test.js` | the three loops, their numbers, a flip and its pose | core |
| `src/pillow.js`, `test/pillow.test.js` | one pillow, the crowns, the meshes, the charts | core |
| `src/state.js`, `test/state.test.js` | presets, typed orders, cards, activation, numbers, address | core |
| `src/solver.js` | the closed-surface solver | surface |
| `src/flat2222.js`, `test/flat2222.test.js` | the exact flat solid | surface |
| `src/surface-model.js`, `test/surface-model.test.js` | mesh + solver + flip carry + pose + journey + curves + marks | surface |
| `src/surface-pane.js` | the renderer's glue, picking, the turn of a reset (re-level) | pane |
| `src/print3d.js`, `test/print3d.test.js` | comma outlines baked into a signed-distance texture; chart points | pane |
| `src/page.js`, `src/page.template.html`, `src/page.css`, `test/page.test.js` | the page | shell |
| `src/cards.js`, `src/pattern-glue.js`, `test/cards.test.js`, `test/pattern-glue.test.js` | the three cards; the Pattern pane with pair colours, held still on a flip | shell |
| `site/index.html` | the build (only the shell owner builds here) | shell |
| `src/tutorial.html` | the Tutorial tab's text, pasted between the template's `TUTORIAL:BEGIN` / `TUTORIAL:END` markers | words |
| `test/contract.test.js` | pins what the page leans on in files it does not own | words |
| `tools/check.mjs` | the built page in headless Chrome | words |
| `README.md` | this file | words |
| `dev/<owner>/` | each owner's scratch, stand-ins, notes (`NOTES.md`), own builds | that owner |

Nothing is copied from the sibling pages except `flat2222.js`; the rest is imported by relative path (`SPEC.md` § 2.1):
the engine and the Pattern pane from `../two-features-two-handles/src/`, the 3D renderer and the print bake from
`../the-folding/src/`, the slider, the address helper, the geometry helpers and the build from
`../classification-of-surfaces/`. Those files belong to other pages and change under this one: that is what
`test/contract.test.js` is for.

## Test

```sh
cd standalone/pqrs-pillows
node --test                              # every module's tests (node 26, no browser; 103 passed in 8 s on 27 Nov, 16:31)
node --test test/contract.test.js        # under a second: run it after every fast-forward of the branch
```

`test/contract.test.js` fails when a sibling page's file stops giving what this page reads: a name of the import
block of `SPEC.md` § 2.1, any name a file in `src/` imports from outside this folder (read off the source), the
engine's opening numbers (3333 at L 2.633916, 2345 at 2.535706, 2223 at 1.316958, 2222 at 1), the keys of
`buildPatternModel` and `centredFor`, the frame `home = Pmat · X(s, θ)` the print on the surface stands on, `recut`'s
`Q` and `invQ`, the tile motions, the SDF bake, the renderer's methods. It cannot run `createPattern` or WebGL
(no DOM): the pattern's methods are pinned by name in the source text, the renderer through its no-WebGL stub.

## Build

One HTML file, with the shared build of Classification of Surfaces (esbuild, MathJax at build time):

```sh
cd standalone/pqrs-pillows
npm run build        # = from ../classification-of-surfaces:
                     #   node build.mjs --template ../pqrs-pillows/src/page.template.html --entry ../pqrs-pillows/src/page.js \
                     #        --css src/styles.css,../two-features-two-handles/src/page.css,../pqrs-pillows/src/page.css \
                     #        --out ../pqrs-pillows/site/index.html
```

- The build refuses a page with a second `<script>` or `<style>`, a `<link>`, an `<img>`, an `<iframe>`, a CSS
  `url()`, or a URL off its allow-list (`https://spacesheep.dev/@yaroslavvb/…`,
  `https://yaroslavvb.github.io/animated-groups-fable/…` and a few more: see `build.mjs`).
- It rewrites the tracked `../classification-of-surfaces/src/gen/math.js` with the same bytes: leave it. Two builds
  at once clash on that file: a build that is not the page's own goes elsewhere with `--out`
  (`node dev/words/build-page.mjs` builds the whole page into `dev/words/page.html`).
- A publish refuses a page that holds any of three letter sequences (`SPEC.md` § 1.8 names them) anywhere, also
  inside identifiers; `tools/check.mjs` looks for them in the built file.
- Formulas are written `\( … \)` and `\[ … \]` in the template and typeset at build time; an undefined command
  stops the build.

## Check (the gate before the page is shown)

```sh
node tools/check.mjs                      # site/index.html, desktop 1280x900 and phone 390x844, about 105 s
node tools/check.mjs <file | url> [--only desktop|phone] [--shots <dir>]
node tools/check.mjs --compare a.png b.png        # no browser: the pixel measures on two saved pictures
```

Playwright with the system Chrome (paths at the top of the file; `PLAYWRIGHT_MJS` and `CHROME` override them). One
line a check, `ok …`, `FAIL …` or `skip …` (a part of the page that is not there), exit code 1 on any `FAIL`:

- no console error, no page error;
- both panes draw (screenshots of the pane elements are not blank);
- each preset chip opens, and four typed orders;
- a drag of the active card's Twist changes the other two cards' numbers and the Surface's pixels; the same for its
  Length; a drag on a card that is not active makes it the active one;
- the table of the two pillows has its two rows and its line: crowns exact or past the rim, the closed surface's
  measured stretch (2222: exact);
- activating each card moves the active state and leaves the Pattern pane's print where it was;
- the journey goes through its three stops;
- nothing is wider than the screen; the panes stay side by side; on the phone, tap targets of 44 px and 16 px field text;
- opening the address again restores the state;
- the Tutorial tab has its six sections, typeset;
- the built file holds none of the three refused letter sequences.

"The pattern did not move" is read off two screenshots of the Pattern pane. The marks, the seals and the loop change
colour and place by design when another card is activated, so they are left out: only pixels whose colour lies
between the print's two tones (paper and comma) in BOTH pictures are compared, with a margin of 2 px round
everything else, and a pixel has moved when its tone changed by more than a quarter of the way. The gate is 0.5 % of
those pixels. Every run prints a gauge with it: the start picture against itself shifted by one device pixel (half
a CSS pixel), which must read at least twice the gate.

Measured on Fri 27 Nov 2026 (`dev/words/NOTES.md` has the runs): a real activation reads 0.00 % on 3333, 2345,
2223 and 2222 at both sizes; the gauge reads 1.7 to 4.7 % on the desktop and 4.6 to 10.6 % on the phone; the pattern
slid by hand by half a CSS pixel reads 1.75 %, by one pixel 3.07 %; a page built wrong on purpose (the line that
holds the view on a flip taken out, `node dev/words/build-broken.mjs`) fails every one of these checks with 32 to
40 %, and no other check. On `site/index.html` as built at 16:40 that day the gate gave 67 ok, 0 FAIL, 0 skip in 109 s.

Then look at pictures (`--shots <dir>` keeps the ones the check took): every preset at three Twists, the journey's
three stops, a flip.

## Deploy

- **spacesheep**: space `75f2b910-0d2a-4d4a-a85e-2b1b7e8f220c` (https://spacesheep.dev/@yaroslavvb/pqrs-pillows,
  anyone with the link). Copy `site/index.html` into a folder of its own and
  `spacesheep deploy <folder> --space 75f2b910-0d2a-4d4a-a85e-2b1b7e8f220c -m "<what changed>"`; read the live page
  back first if someone else may have deployed since (`spacesheep versions pqrs-pillows`).
- **GitHub Pages**: `npm run build` also copies the page to `docs/pqrs-pillows.html`; commit both and push to main.

## Not built (out of scope for v1, `SPEC.md` § 5)

Mirrors, crosscaps, handles, more than four cone points, cusps; dragging on the pattern to change Length or Twist;
a paper net; sound; saving pictures; the twin move as a control (the triangle follows the sliders); a pick on the
3D marks.

## Where the mathematics is written down

- `/Users/solid/drive.unsynced/artifacts/pqrs-pillows/proto/pillow-math/NOTES.md`: the pillow, the crown, the
  charts, 2222, the meshes; each formula with its measured check.
- `/Users/solid/drive.unsynced/artifacts/pqrs-pillows/proto/flips/NOTES.md`: loops, the triangle and its face, the
  cubic, the flip's closed forms, edge cases.
- `/Users/solid/drive.unsynced/artifacts/pqrs-pillows/maps/`: the sibling pages mapped (engine, renderer, the 2222
  solid, his vocabulary and the words to avoid).
