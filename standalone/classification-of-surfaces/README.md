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
| 5 Symmetries | Ch. 2–4, 9, 17–18 | any signature you can type (47 offered) on the sphere, the plane or the hyperbolic plane: the signature, the pattern (drag it; six designs), the surface it folds up to; type, delete, step a digit |

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
| `src/sym/` | tab 5: `geom.js` (sphere, plane, hyperbolic plane behind one interface), `domains.js` (a pattern's tile), `orbifold.js` (the signature read off the tile; the tiles of the pattern), `catalog.js` (signatures as data, the examples), `motifs.js` (the six designs printed on a tile), `pattern.js` (the 2D pane), `surface.js` (the orbifold in 3D) |
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

Four ways of turning were then offered behind a chooser (turntable, arcball, grab, the rolling ball). His choice the
same evening: *"make Turnable the default and get rid of chooser"*. So `src/turning.js` is a turntable and nothing
else: left-right turns about the vertical, up-down tilts to straight above or below, "up" stays up, and any loop of
the pointer comes home exactly. It does not change the renderer: its listeners sit on the canvas's parent, run after
the renderer's, and set the view they want. The Folding and The Unfolding have the rolling ball still.

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

**Any signature** (his next ask, the same evening: *"give a way to add x/ etc to give more signuatre flexibility
(not just cone point, but give a way to modify the singuature)"*). The row under the signature adds a handle `o`, a
cone point, a mirror `*`, a corner (on the chosen mirror, else the last) or a crosscap `x`, and removes the chosen
character; a signature is data, `{ o, cones, stars, x }` (`src/sym/catalog.js` `parse`, `addTo`, `removeAt`,
`stepAt`), and any text of that shape is a deep link (`#sym&k=2*632*3x`).

- A crosscap next to handles turns each handle into two crosscaps, and a handle next to a crosscap arrives as two
  (tab 2's trade, `o x = x x x`); the page says so when it happens.
- A signature with no hand-made tile gets the general one (`src/sym/domains.js` `canonical`): the textbook polygon
  of a surface (`a b a⁻¹ b⁻¹` per handle, `c c` per crosscap, `e e⁻¹` round each cone point, a cut out to each mirror
  and back), drawn round an inscribed circle. Then an edge's length depends only on the angles at its ends, so every
  edge is as long as its mate and only the circle's radius has to be solved for. It is used for signatures that cost
  $2 or more; on the sphere the fourteen types all have tiles of their own.
- Under $2 a signature that is not one of the fourteen spherical types has no pattern (a lone cone point, two of
  different orders, the same for the corners of one mirror: the book's proviso, p. 53). The page shows the surface,
  an empty pattern pane and says so.
- In `NN` and `*NN` the two digits step together, so stepping never leaves the fourteen types by accident.

**Typing it** (his next ask, later that evening: *"it should be more interactive. I want to be able to press Delete
and keep deleting until I get an empty bar. And then interactive really built up from there. Maybe using 2 to add
the cone point of order 2"*). The signature sits in a bar with a caret and is typed like a line of text, wherever
the focus is on the tab: `o`, `2` to `9`, `*` and `x` put a character in after the cursor, Delete (or Backspace)
takes out the character the cursor is on and steps back, or the last one, down to an empty bar; in the bar itself
the arrows move the cursor, up and down step a digit, Home and End jump. A typed digit means what it would mean
where it stands: a cone point among the rings and cone points or at the start, a corner inside a mirror, and at the
end a corner of the last mirror if there is one. So `* 6 3 2` types `*632` (passing `*6` and `*63`, which no pattern
has, and the page says so on the way). The row under the bar does the same for a finger, with a delete button.
The empty signature is the bare sphere with no symmetry (one tile, one mark; `#sym&k=1`, as the book writes it).

**Six patterns** (the same ask: *"give me a chooser to choose between patterns, maybe reuse the patterns from
https://spacesheep.dev/@yaroslavvb/the-folding#g=333"*). A chooser in the pattern pane's corner, with the names and
order of The Folding's selector: Paisley (the default), Soft commas, Tomoe, Checkerboard, Rings, Comma; kept in the
address (`&p=tomoe`) and between visits. The Folding's own prints are fitted by hand and by search to each of the 17
plane groups (a table of knobs per group in its `src/patterns/`), so they cannot be carried to a sphere, a hyperbolic
tiling or a signature typed a moment ago. Taken from it: the six ideas and names, its unit comma (`motif.js`
`commaOutline`, copied) and the paper's two tones a side (`palette.js` `PRINT_FRONT` / `PRINT_BACK`). In
`src/sym/motifs.js` each design is drawn on ONE tile from that tile's corners alone, and the symmetries carry it:
a family of commas (a big one a cell, a small one in every corner with room); a fat comma with an eye; the tile
split by an S into a dark and a light comma, the dark tail running into the farthest corner; triangles from a hub
to the corners and the middles of the sides, every other one dark; the tile's outline shrunk again and again
toward a point; one comma a cell. None has a symmetry of its own (the hub, the rings' point and the S sit off the
middle; a tile of two mirror halves gets the same hand twice, not a mirror image), so every design has exactly the
signature shown. Tested: every mark of every design lies inside its tile, for all examples.

**Four handles froze the page** (his report, the same night: *"If I type 4 handles in a row, the whole thing
freezes."*). The tile of `oooo` is a 16-gon and sixteen tiles meet at each of its corners. Going round such a
corner, eight big matrices that nearly undo one another leave a tile's point about a billionth of its size off;
the search for tiles (`src/sym/orbifold.js` `tiles`) asked "have we met this tile?" with a tolerance just under that,
took the tile for a new one, the copy bred copies, their matrices fell off the group, one of them claimed to be at
distance 0, and filing a point with coordinates of 10^8 never ended. Three handles and eight crosscaps happened to
stay under the tolerance. Now two points are one tile when they are within a thousandth of a tile's room of each
other in the geometry's own distance (two tiles are at least twice that room apart), a hyperbolic point is filed by
how far out it is and in which direction (both stay put when it moves a little, however far out), a point that has
left the plane is dropped, and the walk gives up after 1.5 s with what it has. Putting each matrix back onto the
group as it was made (`geom.js` `fix`) was tried and taken out: far out it subtracts numbers of the size e^distance
and cost a thousand times the accuracy. `oooo` now takes 114 ms from key to picture, six handles 171 ms, twelve
crosscaps 110 ms (headless Chrome on the Intel); `test/sym.test.js` holds it: for 3 to 6 handles, 8 and 12
crosscaps and four more, the search ends, finds every tile once and as many as the disc has room for.

**∗4 fails, 4∗ works; any order of what has no order** (his question, Mon 16 Nov 2026, week 47: *"I'm confused why
\*4 fails but 4\* works, maybe allow the entry of unordered tuples (but automatically canonicalize and show the
canonical result) somewhere"*). Two things were mixed up on the page, and it said nothing about either.

- *Where a digit stands is what it is.* Before the star it is a gyration point (a turn, no mirror through it); after
  a star it is a corner where that many mirrors cross. So `4*` and `*4` are two signatures, not two spellings. `4*`
  is a four-fold turn with one mirror across its axis. `*4` asks for a mirror with a single corner where four
  mirrors cross: under $2 it would live on a sphere, and there four mirrors through a point cross again at the
  opposite point, so the corner comes twice (`*44`). The book's four kinds without a pattern (pp. 53, 57): `N`,
  `MN`, `*N`, `*MN` with M and N different. The page used to say only "no pattern has this signature". Now the
  empty pattern pane gives the reason in that signature's own numbers (`catalog.js` `whyNot`, the wording in
  `tabs/sym.js` `bad`) and offers the nearest signatures that have one as chips: the same characters with a digit
  on the other side of the star (`*4` → `4*`), the two numbers made equal, one more number.
- *What has no order is taken in any order.* The book, pp. 231–232: the digits before the star may be permuted
  freely, a star's digits turned round, all stars read backwards at once (one alone only beside a ×), the stars
  permuted. `catalog.js` `canon` picks one spelling among these (larger numbers first, p. 31), `spelled` prefers the
  book's own where an example has it (`*225`, not `*522`), `sameAs` compares two. `domainOf` looks for a hand-made
  tile under the spelling typed, then under those two, so `*236` gets the tile of `*632` and its characters are
  tied to it by `bind` as before. The bar keeps what was typed (rewriting characters under the cursor would undo
  the typing), and beside the price a line reads "the same as ∗632": tap the chip, or press Enter, to write it that
  way. The example's chip lights up and previous/next go from it, whatever the spelling. Side by side, the line's
  height is kept when it is empty, so the panes do not jump as characters go in.

What is not the same and is not offered as such: `*4` and `4*`; `*234*567` and `*234*765` (two mirrors, one read
backwards: another orbifold, unless a × is there).

Known limits: digits run 2 to 9; at most twelve places on the ball (a handle takes two), six corners on a mirror,
fourteen characters; a tile's shape is one choice among many where the book says the pattern can be stretched
(`*3*`, `o`, `**`, and every general tile); cone points and corners do not show in tab 3 (only the surface); the
hyperbolic disc draws the 4,200 nearest tiles (fewer while a finger moves), the rest of the rim is tinted.

## What is not there

- A join that involves a ball (not two polygons) changes the picture without motion: the two arrows stand out, then the
  picture is redrawn.
- After a zip that leaves rim over, the tidy redraw is a cut: an eyelet becomes a hole at a site of its own in one step.
- The chapter's frontispiece surface (p. 92) is not classified in the book and is not on the page.
- The scan of the book is on the tailnet only, so the page-number links open for him and for nobody else.

## Checked

- `node --test`: 75 tests (the last five: typing and deleting a signature character by character; the six designs
  inside their tiles; many handles and crosscaps: the tile search ends and finds every tile once; over 250 spellings
  of the 47 examples each found as its example, with the example's tile; the four kinds without a pattern and what
  is offered for them, each offer having a pattern). The zipping's bookkeeping against an independent count of the glued surface (400 random
  gluings, three zip orders each); the seven examples' counts against the book's table; tab 5: the 47 examples and
  1,345 more signatures (every `*pqr` and `pqr` with digits 2 to 9, every family over its numbers) each folded up
  from its own tile, its price against its area, the sphere's tile counts (`*532`: 120), no two tiles overlapping;
  400 random signatures (over 250 of them on the general tile) folded up the same way; every signature of at most
  four characters over `o 2 3 5 * x` either has a tile in the right geometry or is one of the ones without a
  pattern, and the spherical ones among them are exactly the fourteen types; adding, removing, stepping, the trade.
- Every zip of every preset and of 40 random deals, in three orders, stepped through all its phases in a browser: no error.
- `node tools/check_quotes.mjs`: 75 citations, each at most 15 words and on its page.
- Looked at in headless Chrome at 1280 and 390 px wide, light and dark, with reduced motion; a real tap on an arrow,
  the chips, Unzip, and the deep links (`#zip&kind=handle`, `#tidy&k=oox*`, `#prove&k=fig810`, `#name&k=klein`).
  And in WebKit (Safari's engine) on the M5, at 390 and 1280 px: no error, no sideways scroll, the same layout as Chrome.
  Not tried on a real phone.
- Tab 5 with a real mouse in headless Chrome: a long drag in each geometry (after six strokes across the hyperbolic
  disc the view is still an exact motion and the disc is full), once round a circle on the ball comes home exactly,
  the digit stepper, next and previous, the chips, `#sym&k=*732`, coming in by the tab button at 1280 and 390 px;
  and every one of the 47 tiles zipped up in tab 3 ends as the surface tab 5 shows, as do twelve signatures made
  by hand on the general tile (93 zips in all). Editing with real clicks: add a crosscap to `*632`, remove it,
  remove the mirror of `3*3` (no pattern, and the page says so), a deep link to `o2*3x`. In WebKit on the M5: all
  47 examples at both widths, the add row and remove with real taps, fifteen signatures of one's own, a touch drag
  on the ball and on the disc, no error. Dark theme looked at.
  Typing with a real keyboard in headless Chrome, at 1280 and 390 px: Delete four times from `*632` to an empty bar,
  `2 2 *` typed back (no pattern, a sphere, the plane), the cursor keys, a digit typed in the middle, the chooser
  and its place in the address, a reload; the 3D view once round a circle comes home. The six designs looked at on
  eleven signatures in all three geometries. In WebKit on the M5 (it did not answer over ssh at first, about
  22:00 PST, and did a quarter of an hour later): the same Delete and typing with real key presses at both widths,
  the six designs, the 47 examples and nineteen signatures of one's own (four, five and six handles and twelve
  crosscaps among them), the drags; no error. And with real keys in Chrome: `o` seven times (the seventh refused),
  `x` thirteen times, Delete twelve times, three long drags across the disc of `oooo`.
  Spellings and reasons (Mon 16 Nov 2026), with real clicks and keys in headless Chrome at 1280 and 390 px: `*4`
  says why and offers 4∗ and ∗44, a tap on 4∗ draws it; `*43`, `4`, `45`; `*236` reads "the same as ∗632" with that
  example lit, the chip and Enter both write it; `*252` is ∗225 "as the book lists it"; `* 2 3 6` typed key by key;
  the panes stay put side by side. In WebKit on the M5 at both widths: the same, and the 47 examples, no error.
  Not tried on a real phone; no reader other than the author has gone through tab 5 yet.
- A reader who had not written the page went through it from screenshots and the chapter's text: no wrong count,
  symbol or citation; fourteen findings on wording and on the links between the tabs, the wording ones applied
  (which way the arrows run is now always said "round the rim"; the trade of a cross-handle for two crosscaps links
  to Figure 8.10 in tab 3; the pinwheel is explained; the symbol is worked out from the three numbers).
