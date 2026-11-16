# Classification of Surfaces

Live: https://spacesheep.dev/@yaroslavvb/classification-of-surfaces (anyone with the link) ·
tailnet: http://intel/reports/2026-11/2026-11-15-classification-of-surfaces/dist/index.html

Made Sun 15 Nov 2026 (week 46) on the Intel, at his ask: *"read … The Symmetries of Things, Chapter 8 and come up
with a way to understand classification of surfaces by interactively allowing me to construct/deconstruct these kinds
of surfaces. Reuse 3d visualization code from https://spacesheep.dev/@yaroslavvb/the-folding . Create a page called
'Classification of Surfaces' which walks me through the examples in the book by also adding interactive elements"*.

Chapter 8 (printed pp. 93–106) of Conway, Burgiel & Goodman-Strauss, *The Symmetries of Things*, as one 3D stage with
four tabs, in the book's order, and a fifth for what the chapter is for:

| tab | pages | what you do |
|---|---|---|
| 1 Zippers | 93–95 | one hole or two, arrows opposite or the same: scrub a cap, a crosscap, a handle, a cross-handle shut |
| 2 Tidy surfaces | 96, 101–103 | add holes, handles, crosscaps, cross-handles to a sphere; a hole walks through a crosscap (Fig. 8.11); the trade ⊗ = ××; χ, boundaries, sides |
| 3 Zip it up | 96–100, Fig. 8.1–8.10 | the Tidying Lemma by hand: tap an arrow, the pair is zipped, what you hold is tidy again |
| 4 Examples | 104–106 | the book's seven surfaces; count a map, the boundaries, the sides; the symbol follows |
| 5 Symmetries | Ch. 2–4, 9, 17–18 | 47 signatures on the sphere, the plane and the hyperbolic plane: the signature, the pattern (drag it), the surface it folds up to; tap a character, step a digit |

The way in: every surface is polygons and zippers; zipping one pair at a time keeps it a sphere with holes, handles,
crosscaps and cross-handles; two trades remove the cross-handles and the mixed case. Tab 3 lets you do that to the
book's own strange surface (p. 104) from its five pieces and watch it become ○∗∗.

## Files

| path | what |
|---|---|
| `dist/index.html` | the built page, one self-contained file (what is deployed) |
| `src/vendor/the-folding/` | The Folding's `render3d.js`, `palette.js`, `timeline.js`, unchanged (animated-groups-fable `0a82435`) |
| `src/geo/` | the surface kit: sites and their charts, cells with holes, tubes, the crosscap collar, the flat patch, the twelve-site ball |
| `src/zipper/` | tab 3: `engine.js` (the lemma's bookkeeping, pure), `view.js` (how a state is drawn), `parts.js` and `moves.js` (the motion of each zip) |
| `src/examples/` | tab 4: the seven surfaces as cell complexes, their counts computed, the pinwheel |
| `src/sym/` | tab 5: `geom.js` (sphere, plane, hyperbolic plane behind one interface), `domains.js` (a pattern's tile), `orbifold.js` (the signature read off the tile; the tiles of the pattern), `catalog.js` (the examples), `pattern.js` (the 2D pane), `surface.js` (the orbifold in 3D) |
| `src/tabs/` | one module per tab; `src/app.js` the shell; `src/index.template.html` all the static words |
| `src/formulas.mjs` | the LaTeX the page composes while it runs; MathJax typesets everything at build time |
| `test/` | `node --test`: the engine against an independent count (400 random gluings), the seven examples against the book, every signature of tab 5 against its own tile |
| `tools/check_quotes.mjs` | every book citation quotes words that are on that page (needs the PDF and `pdftotext`) |

Build: `node build.mjs` (esbuild through `npx`; MathJax from `~/.cache/mathjax-full-3.2.2`, `npm i mathjax-full@3.2.2`
there). `--hide prove,name` leaves a tab's button out, `--out dist/x.html` writes another file.
Tests: `node --test`. Quotes: `node tools/check_quotes.mjs`.
Screenshots: `node ~/git/animated-groups-fable/standalone/the-folding/tools/shot.mjs --root "$PWD" --page dist/index.html --steps steps.json`
(`window.__surfaces = { show(tab, state), tabs, stage }`; `tabs.prove.dry(id)` runs every phase of a zip at once;
`tabs.sym.go('*732')`, `tabs.sym.select(i)` and `tabs.sym.pattern.state()` drive and read tab 5).
Publish: `~/git0/flush-util/sheep publish reports/2026-11/2026-11-15-classification-of-surfaces/dist/index.html --as-rendered --name '…'`.

## How the 3D is built

A body is cut into cells, one round each site: the flat patch of tab 1 has one or two, the ball has the twelve
pentagons of a dodecahedron. A cell is a polar grid from its hole's rim to its outline; what a zipper makes is a
separate patch welded to that rim (`src/geo/scene.js`). A zip is drawn by moving vertices, never by changing the mesh:
the purse closes a hole, a tube half grows along a Bezier arc, the crosscap's collar rises onto its crossing segment.
The renderer paints the two sides of the paper teal and sand by triangle winding, so where a one-sided surface is
zipped, teal meets sand along the seam. That is the book's "front against back", for free.

Tab 3's pictures are honest where the book's are: gaping zips leave eyelets (Fig. 8.6, 8.8, 8.9), a gaping crosscap is
a half-twisted strap across the hole (a punched Möbius band, Fig. 8.7). After each zip the picture is redrawn tidy;
that step is a cut, not a motion ("we can just push the holes around", p. 96).

## Turning the view

His note on the first version (Sun 15 Nov 2026): *"interactive Rotation is a little weird. If I do it in a circle,
there is a drift."* The renderer's own control is a rolling ball: each step of the pointer turns the picture about the
screen axis square to it, such steps do not commute, and a closed loop of the pointer leaves a twist of (the loop's
area) x (sensitivity squared). Measured with real drags in the 755 x 566 pane: once round a circle of 100 px radius
leaves the view 70 degrees off (19 degrees for 50 px; on a phone-sized pane 45 degrees for 50 px).

`src/turning.js` adds three other ways and a chooser in the corner of the pane (kept in `localStorage`); the default
is now the turntable. It does not change the renderer: its listeners sit on the canvas's parent, run after the
renderer's, and set the view they want.

| way | a drag | once round a circle | "up" |
|---|---|---|---|
| Turntable (default) | left-right turns about the vertical, up-down tilts, to straight above or below | comes home exactly | stays up |
| Arcball | takes hold of a ball filling the pane, at double speed; a drag round the edge twists | comes home exactly | free |
| Grab | the same ball at single speed: the point taken stays under the pointer | comes home exactly | free |
| Rolling ball | the renderer's own, with its momentum | 70 degrees off (100 px circle) | free |

The Folding and The Unfolding have the rolling ball still; nothing of theirs was changed.

## Tab 5, Symmetries

Added the same evening, at his ask: *"Add another tab to that page called Symmetries, where it lets me go through many
examples of surfaces and lets me visualize the orbifold symbo, the surface surface and, corresponding to it, the
symmetrical pattern. Also include spherical and hyperbolic symmetries."* Deep link: `#sym&k=*732` (`*` the star, `x`
the cross, `o` the ring).

Three things say the same thing three ways, and every character of the signature ties them together (tap it):

- **the signature**, in the book's colours: blue for what keeps the pattern's sense (wonder-rings, gyration points),
  red for what reflects (kaleidoscopes, their corners, miracles), p. 27. A chosen digit steps with − and +, and the
  tile follows: `*532`, `*632`, `*732` go from the sphere through the plane to the hyperbolic plane while the price
  ruler crosses $2 (the Magic Theorem, pp. 30, 53, 219).
- **the pattern**, a 2D canvas (`src/sym/pattern.js`): an orthographic ball, the plane, or Poincaré's disc. A drag
  moves it by a motion of its own geometry, and the point taken stays under the finger (so a circle of the pointer
  comes home exactly: no drift). Teal tiles are copies of the outlined tile, sand tiles its mirror images. Mirrors
  are red lines, a glide's axis a dashed red line, gyration points and mirror crossings the crystallographers'
  marks (lens, triangle, square, ...). The outlined tile carries arrows and letters on its glued edges.
- **the surface**, in the 3D pane (`src/sym/surface.js`): a sphere with one hole is drawn as a flat plate with the
  star's corners as corners (the plate of `*632` is its 30-60-90 triangle); an annulus and a Möbius band are tab 4's
  own models; everything else is a tidy ball of tab 2 with cone points (as sharp at the tip as a paper cone of
  angle 2π/n), mirror rims and crosscaps. "Zip the outlined tile up in tab 3" hands the tile's word to tab 3.

How an example is made (`src/sym/domains.js`): a polygon with angles π/d round an inscribed circle, in whichever
geometry its angle sum puts it; each edge is a mirror or a seam. All mirrors: the kaleidoscope. Otherwise the tile is
the polygon and its image in one seam, every other seam glued to its image (by a turn, or by a turn and a flip: a
glide). That one construction gives `*pqr`, `pqr`, `p*q`, `2*22`, `22*`, `22x`, `**`, `*3*`, `***` and their
families; regular polygons with a word give `o`, `xx`, `oo`, `xxx`, `o2`; three are written out (`*x`, `Nx`, `NN`).

Nothing about a signature is typed in and believed (`src/sym/orbifold.js`, `test/sym.test.js`): the tile's corners
are walked round each point they share (total angle 2π/n: a cone point; π/n ending on mirrors: a corner), the mirror
edges are strung into boundaries, the glued edges are handed to tab 3's bookkeeping for handles and crosscaps, and
`bind()` fails if that is not the signature shown. The price must agree with the tile's area (Gauss-Bonnet) and the
geometry; on the sphere the number of tiles must be 2 / (2 − price); no two tiles may overlap.

Known limits: digits run 2 to 9; a tile's shape is one choice among many where the book says the pattern can be
stretched (`*3*`, `o`, `**`); cone points and corners do not show in tab 3 (only the surface); the hyperbolic disc
draws at most 4,200 tiles (fewer while a finger moves), which leaves the last pixel at the rim unfilled.

## What is not there

- A join that involves a ball (not two polygons) changes the picture without motion: the two arrows stand out, then the
  picture is redrawn.
- After a zip that leaves rim over, the tidy redraw is a cut: an eyelet becomes a hole at a site of its own in one step.
- The chapter's frontispiece surface (p. 92) is not classified in the book and is not on the page.
- The scan of the book is on the tailnet only, so the page-number links open for him and for nobody else.

## Checked

- `node --test`: 66 tests. The zipping's bookkeeping against an independent count of the glued surface (400 random
  gluings, three zip orders each); the seven examples' counts against the book's table; tab 5: the 47 examples and
  1,345 more signatures (every `*pqr` and `pqr` with digits 2 to 9, every family over its numbers) each folded up
  from its own tile, its price against its area, the sphere's tile counts (`*532`: 120), no two tiles overlapping.
- Every zip of every preset and of 40 random deals, in three orders, stepped through all its phases in a browser: no error.
- `node tools/check_quotes.mjs`: 69 citations, each at most 15 words and on its page.
- Looked at in headless Chrome at 1280 and 390 px wide, light and dark, with reduced motion; a real tap on an arrow,
  the chips, Unzip, and the deep links (`#zip&kind=handle`, `#tidy&k=oox*`, `#prove&k=fig810`, `#name&k=klein`).
  And in WebKit (Safari's engine) on the M5, at 390 and 1280 px: no error, no sideways scroll, the same layout as Chrome.
  Not tried on a real phone.
- Tab 5 with a real mouse in headless Chrome: a long drag in each geometry (after six strokes across the hyperbolic
  disc the view is still an exact motion and the disc is full), once round a circle on the ball comes home exactly,
  the digit stepper, next and previous, the chips, `#sym&k=*732`, coming in by the tab button at 1280 and 390 px;
  and every one of the 47 tiles zipped up in tab 3 (61 zips) ends as the surface tab 5 shows. In WebKit on the M5:
  all 47 examples at both widths, a touch drag on the ball and on the disc, no error. Dark theme looked at.
  Not tried on a real phone; no reader other than the author has gone through tab 5 yet.
- A reader who had not written the page went through it from screenshots and the chapter's text: no wrong count,
  symbol or citation; fourteen findings on wording and on the links between the tabs, the wording ones applied
  (which way the arrows run is now always said "round the rim"; the trade of a cross-handle for two crosscaps links
  to Figure 8.10 in tab 3; the pinwheel is explained; the symbol is worked out from the three numbers).
