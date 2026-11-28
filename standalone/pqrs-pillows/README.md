# PQRS pillows

One self-contained page: the orbifold PQRS (a sphere with four cone points of orders P, Q, R, S) drawn in space as
**the exact solid whose surface it is**, a tetrahedron with pointed corners, beside its symmetric pattern, with
**three coupled partition cards**. Each of the three ways to pair the four cone points has its own loop, Length,
Twist and **colour**; moving any slider moves the other two cards' numbers, and touching another card changes
nothing at all on the page.

- Live: https://spacesheep.dev/@yaroslavvb/pqrs-pillows and https://yaroslavvb.github.io/animated-groups-fable/pqrs-pillows.html
- `SPEC.md` is the build's first spec (27 Nov, afternoon); its § "v2" at the top says what replaced what. This file
  says how the page is now and how to work on it.

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

And on Fri 27 Nov 2026, 22:55, about the first version (this file's § "What changed on 27 November, late"):

> I don't want to switch colors, so the lines between different edges should keep their colors. I should be able to
> adjust different sliders, and when I switch between sliders, there shouldn't be any change. The only change will be
> when I'm actually moving the slider, so maybe the image can always be painted there correspondingly. The surface
> currently looks quite wobbly maybe find a better surface parameterization

What started it is Chaim Goodman-Strauss's reply to Two features, two handles, public on the critique page linked
above: *"So the PQRS orbifold is made of two of these pillows, each with two regular corners and with one joining
loop."* The page is built from that reply as Yaroslav Bulatov understood it; Chaim Goodman-Strauss has not seen it.

## What is on the page

| Part | What it shows |
|---|---|
| Presets `2222 3333 2223 2345 4444` and a text field | four orders, each 2 to 9; 2222 is flat, the rest hyperbolic |
| Pattern pane | the pattern in the Poincaré disc (the plane for 2222), from Two features, two handles; on it, at all times, every partition's two seals (bold) and its loop (thin) in the partition's colour |
| Surface pane | the solid, a turntable; the pattern's own commas printed on it; the same six seals and three loops; the cone points labelled `P3` … |
| Three cards `PQ\|RS` blue, `PR\|QS` vermillion, `PS\|QR` purple | Length and Twist of each partition's loop; all three are equals, none is shown as "active" |
| The pillows of each partition, a table | for each partition its two pillows: corners, loop, seal, heights, area; a line that says the solid is exact, when it is flat, and when a loop has left the edges |
| Tutorial tab | five short sections with the formulas (`src/tutorial.html`) |
| Address | `#k=<orders>&m=<marking>&l=<Length>&tw=<Twist>[&tri=…][&v=<az>,<el>]` |

## What changed on 27 November, late (his three asks, 22:55)

**1. The colours stay.** A partition owns a colour for good (`src/colors.js`; the same three values in `page.css`):
its two seals, its loop, its card, its rows of the table. The first version painted "the active partition's first
pair blue, its second pair orange", so the colours jumped from line to line with every card touched. Blue and
vermillion are the two he had; the purple `#882E72` is the third that stays apart from both for every kind of
colour vision (checked with the dataviz validator on white, on the print's paper and on its comma tone, all pairs:
worst pair purple against blue under deuteranopia, 10.5 where 8 is the target). On the print the vermillion has a
contrast of 2.35 : 1, so colour is never the only sign: a seal is also named by the two labelled cone points it
joins, a card by its letters.

**2. Switching between sliders changes nothing.** Three things had changed when another card was touched: the
colours (above), the pillows' two paper tones, and the surface itself, which was carried onto another mesh and
relaxed again (2.6 to 5.8 px). Now:

- everything drawn is drawn for all three partitions at once, so there is nothing to switch;
- the solid does not depend on which loop is the engine's cut (below), and neither does the table;
- a flip (the engine taking another loop as its cut) is **not an event for either pane**: nothing is redrawn. The
  Surface pane keeps the picture it has (`surface.sm.state` is the state it was made for); the Pattern pane keeps
  its model and remembers the flip's motion (`pattern-glue.js` `still`), and lays the new cut's model where the
  picture is when a slider next moves;
- on 2222 the shared pattern pane sizes its marks by the engine's tile, another polygon for every cut:
  `pattern-glue.js` hands it a size of the orbifold's own instead.

Measured by `tools/check.mjs` ("switch"): press and release on another card's slider, on 3333, 2345, 2223 and 2222,
desktop and phone: **not one pixel differs** in the Surface pane, the Pattern pane or the cards.

**3. The surface is exact, not relaxed.** See the next section. The solver (`src/solver.js`, a mesh relaxed toward
the right lengths in ordinary space: 0.5 to 1.1 % mean stretch, uneven to look at) is gone; it is in the history
at `295f1921`.

## The solid (`src/solid.js`)

Three loops, one for each pairing, any two meeting twice, have six seals that do not cross: they cut the orbifold
into four geodesic triangles, glued as the faces of a tetrahedron. A tetrahedron of hyperbolic 3-space with those
six edge lengths has faces congruent to the four triangles, glued the same way: **its surface is the orbifold,
exactly**, creased along the six seals. (2222: a Euclidean tetrahedron, the solid of Twist of 2222.) By
Alexandrov's theorem there is exactly one such convex solid for every metric, flat ones included, so it does not
depend on any choice of loops.

- **Which three loops.** Only one triangle of loops has its seals along the edges: the reduced one, in which no loop
  is longer than its twin (an edge is the shortest way between its ends). `reducedTriangulation` gets there from the
  cards' triangle by twin moves on the developed picture; `swaps` counts them. In 360 random states the tetrahedron
  existed for the reduced triangle every time (`test/solid.test.js`).
- **Where it is flat.** Exactly where the orbifold has a mirror through its four cone points: Twist 0 and ±1/2 of a
  loop that runs round two edges. Every preset opens there: a doubled quadrilateral, as Twist of 2222 opens on its
  "square envelope". The thickness grows like the square root of the Twist.
- **How it is drawn.** Vertices on the hyperboloid of R^{3,1} from the six cosh of distances, moved so that their
  middle is the origin, shown in the Poincaré ball at twice its scale: faces are caps of spheres, edges arcs of
  circles. Each face is cut into 4^5 triangles by halving (even hyperbolic size); every vertex keeps its point of
  the engine's pair frame, which is what the print's chart needs (`print3d.js chartOf`).
- **Lines on it.** `trace(a, b)` lays any geodesic of the pattern on the solid by walking the developed triangles,
  with a point at every edge crossed: the cards' seals and loops, on any lift. Seals of the reduced triangle are
  the edges themselves; a loop dragged longer than its twin has seals that cross the faces (the table's line says so).
- **The pose** (`src/surface-model.js`). A cold start lays the first pair below, its seal along y, the other pair
  above. While a slider moves the solid is turned as little as can be from the last picture (the best rotation of
  the four named cone points), and the moved card's pair that holds P is held still (weight 30 to 1), so a Twist
  shows as the other pair turning against it. The reset button lays it level again.

Why not ordinary space: two smooth faces that meet at an angle along a curve that is a geodesic of both force that
curve to be straight, so a surface of curvature −1 with the faces of a tetrahedron, creased along geodesics, would
have faces with the Euclidean angle sum (the Tutorial, § 2).

**Not back yet: the journey** (surface → two pillows → open crowns). It parted the pillows of "the active
partition", which no longer exists as a thing to see; it is hidden in the template (`#journey hidden`) until it is
rebuilt on the solid with its own choice of loop.

## Files

| File | What |
|---|---|
| `src/solid.js`, `test/solid.test.js` | the solid: reduced triangle, the tetrahedron, the developed walk, mesh, traces |
| `src/surface-model.js`, `test/surface-model.test.js` | what the Surface pane is handed: the solid's mesh, every partition's curves, marks, the pose |
| `src/colors.js`, `test/colors.test.js` | the three partitions' colours (and that `page.css` has the same) |
| `src/flips.js`, `test/flips.test.js` | the three loops, their numbers, a flip and its motion |
| `src/state.js`, `test/state.test.js` | presets, typed orders, cards, activation, numbers, address, the pillows in numbers |
| `src/pillow.js`, `test/pillow.test.js` | one pillow {p, q, L}: its six data, Fermi charts, the crown (used by the table now, by the journey later) |
| `src/surface-pane.js` | the renderer's glue (The Folding's `render3d.js`), the look by partition, the turn of a reset |
| `src/print3d.js`, `test/print3d.test.js` | comma outlines baked into a signed-distance texture; chart points |
| `src/cards.js`, `src/pattern-glue.js`, `test/cards.test.js`, `test/pattern-glue.test.js` | the three cards; the Pattern pane with all three partitions' lines, left alone on a flip |
| `src/page.js`, `src/page.template.html`, `src/page.css`, `test/page.test.js` | the page |
| `src/tutorial.html` | the Tutorial tab's text; `node dev/integration/paste-tutorial.mjs` puts it between the template's markers |
| `src/flat2222.js`, `test/flat2222.test.js` | Twist of 2222's own solid, copied: no longer drawn, kept as the witness `test/solid.test.js` checks 2222 against |
| `test/contract.test.js` | pins what the page leans on in files it does not own |
| `tools/check.mjs` | the built page in headless Chrome |
| `site/index.html` | the build |
| `dev/solid/` | this round's tools: `probe.mjs` (the solid in numbers), `shot.mjs` (pictures of states), `perf.mjs`, `pixdiff.mjs`, `diffmap.mjs` |
| `dev/core`, `dev/pane`, `dev/shell`, `dev/surface`, `dev/final`, `dev/integration` | the first build's scratch (27 Nov, afternoon). What imports the solver or the old surface model there no longer runs |

Nothing is copied from the sibling pages except `flat2222.js`; the rest is imported by relative path (`SPEC.md` § 2.1):
the engine and the Pattern pane from `../two-features-two-handles/src/`, the 3D renderer and the print bake from
`../the-folding/src/`, the slider, the address helper, the geometry helpers and the build from
`../classification-of-surfaces/`. Those files belong to other pages and change under this one: that is what
`test/contract.test.js` is for.

## Test

```sh
cd standalone/pqrs-pillows
node --test                              # every module's tests (no browser; 111 passed in 20 s on the Intel, 27 Nov, 23:50)
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
node tools/check.mjs                      # site/index.html, desktop 1280x900 and phone 390x844, about 2 min
node tools/check.mjs <file | url> [--only desktop|phone] [--shots <dir>]
node tools/check.mjs --compare a.png b.png        # no browser: the pixel measures on two saved pictures
```

Playwright with the system Chrome (paths at the top of the file; `PLAYWRIGHT_MJS` and `CHROME` override them). One
line a check, `ok …`, `FAIL …` or `skip …` (a part of the page that is not there), exit code 1 on any `FAIL`:

- no console error, no page error; both panes draw; each preset chip opens, and four typed orders;
- a drag of a card's Twist changes the other two cards' numbers and the Surface's pixels; the same for its Length;
  a drag on a card that is not the cut makes it the cut;
- the table has its six rows and the line that says the solid is exact;
- **colours**: the three cards wear three colours, the same after each of them was made the cut;
- **switch**: on 3333, 2345, 2223 and 2222, each after a Twist drag: press and release on another card's slider
  (Twist, then Length, then back). Gate: not one pixel differs in the Surface pane, in the Pattern pane or in the
  cards, read off screenshots of the three elements. Each run prints its gauge first (the Pattern picture against
  itself shifted by one device pixel must read at least 1 % by the print measure);
- nothing is wider than the screen; the panes stay side by side; on the phone, tap targets of 44 px and 16 px field text;
- opening the address again restores the state; the Tutorial tab has its sections, typeset;
- the built file holds none of the three refused letter sequences.

On the build of 27 Nov, 23:50: 67 ok, 0 FAIL, 2 skip (the journey, hidden) in 117 s.

`node dev/solid/perf.mjs`: script time of a slider frame in headless Chrome on the Intel, at device scale 2: 12 to
16 ms, of which the solid 1.4 ms, the print's bake 3 to 9 ms, the Pattern pane 2 to 6 ms.

## Deploy

- **spacesheep**: space `75f2b910-0d2a-4d4a-a85e-2b1b7e8f220c` (https://spacesheep.dev/@yaroslavvb/pqrs-pillows,
  anyone with the link). Copy `site/index.html` into a folder of its own (`~/spacesheep/yaroslavvb/pqrs-pillows/`) and
  `spacesheep deploy . --space 75f2b910-0d2a-4d4a-a85e-2b1b7e8f220c --base <the live version's sha> -m "<what changed>"`;
  `spacesheep versions pqrs-pillows` lists the versions (the CLI is signed in on the Intel and on the mini).
- **GitHub Pages**: `npm run build` also copies the page to `docs/pqrs-pillows.html`; commit both and push to main.

## Not built

Mirrors, crosscaps, handles, more than four cone points, cusps; dragging on the pattern to change Length or Twist;
a paper net; sound; saving pictures; the twin move as a control (the triangle follows the sliders); a pick on the 3D
marks; the journey on the new solid (above). Safari / WebKit and a real phone have not been looked at.

## Where the mathematics is written down

- This file's § "The solid", `src/solid.js`'s head, and the Tutorial tab § 2.
- On the mini, from the first build: `/Users/solid/drive.unsynced/artifacts/pqrs-pillows/proto/pillow-math/NOTES.md`
  (the pillow, the crown, the charts, 2222) and `…/proto/flips/NOTES.md` (loops, the triangle and its face, the
  cubic, the flip's closed forms).
