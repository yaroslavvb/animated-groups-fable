# Classification of Surfaces

Live: https://spacesheep.dev/@yaroslavvb/classification-of-surfaces (anyone with the link) ·
tailnet: http://intel/reports/2026-11/2026-11-15-classification-of-surfaces/dist/index.html

Made Sun 15 Nov 2026 (week 46) on the Intel, at his ask: *"read … The Symmetries of Things, Chapter 8 and come up
with a way to understand classification of surfaces by interactively allowing me to construct/deconstruct these kinds
of surfaces. Reuse 3d visualization code from https://spacesheep.dev/@yaroslavvb/the-folding . Create a page called
'Classification of Surfaces' which walks me through the examples in the book by also adding interactive elements"*.

Chapter 8 (printed pp. 93–106) of Conway, Burgiel & Goodman-Strauss, *The Symmetries of Things*, as one 3D stage with
five tabs: Symmetries first, which is what the chapter is for and the tab the page opens on, then the chapter's
four in the book's order:

| tab | pages | what you do |
|---|---|---|
| 1 Symmetries | Ch. 2–4, 9, 17–18 | any signature you can type (47 offered) on the sphere, the plane or the hyperbolic plane: the signature, the pattern (drag it), the surface it folds up to; type, delete, step a digit |
| 2 Zippers | 93–95 | one hole or two, arrows opposite or the same: scrub a cap, a crosscap, a handle, a cross-handle shut |
| 3 Tidy surfaces | 96, 101–103 | add holes, handles, crosscaps, cross-handles to a sphere; a hole walks through a crosscap (Fig. 8.11); the trade ⊗ = ××; χ, boundaries, sides |
| 4 Zip it up | 96–100, Fig. 8.1–8.10 | the Tidying Lemma by hand: tap an arrow, the pair is zipped, what you hold is tidy again |
| 5 Examples | 104–106 | the book's seven surfaces; count a map, the boundaries, the sides; the symbol follows |

The way in: every surface is polygons and zippers; zipping one pair at a time keeps it a sphere with holes, handles,
crosscaps and cross-handles; two trades remove the cross-handles and the mixed case. The Zip it up tab lets you do that to the
book's own strange surface (p. 104) from its five pieces and watch it become ○∗∗.

## Files

| path | what |
|---|---|
| `dist/index.html` | the built page, one self-contained file (what is deployed) |
| `src/vendor/the-folding/` | The Folding's `render3d.js`, `palette.js`, `timeline.js`, unchanged (animated-groups-fable `0a82435`) |
| `src/geo/` | the surface kit: sites and their charts, cells with holes, tubes, the crosscap collar, the flat patch, the twelve-site ball |
| `src/zipper/` | the Zip it up tab: `engine.js` (the lemma's bookkeeping, pure), `view.js` (how a state is drawn), `parts.js` and `moves.js` (the motion of each zip) |
| `src/examples/` | the Examples tab: the seven surfaces as cell complexes, their counts computed, the pinwheel |
| `src/sym/` | the Symmetries tab: `geom.js` (sphere, plane, hyperbolic plane behind one interface), `domains.js` (a pattern's tile), `orbifold.js` (the signature read off the tile; the tiles of the pattern), `catalog.js` (signatures as data, the examples), `motifs.js` (the print on a tile: Paisley), `pairs.js` (the look of each glued pair of edges), `pattern.js` (the 2D pane), `surface.js` (the orbifold in 3D) |
| `src/tabs/` | one module per tab; `src/app.js` the shell; `src/index.template.html` all the static words |
| `src/turning.js`, `src/wheel.js` | how a drag and a wheel without ctrl (a trackpad's two-finger swipe) turn the 3D view (a turntable); `wheel.js`, not used, tells a swipe from a mouse's notch, for a wheel that zooms again |
| `src/sync.js` | one screen drives the others: the owner's open page sends its state through a spacesheep page stream, every other screen takes it |
| `src/sharehash.js` | the address a reader can copy follows the page: inside spacesheep's viewer the page tells the viewer its fragment |
| `src/showcase.template.html`, `src/showcase.js`, `src/showcase.css` | the Orbifold showcase: the Symmetries tab on its own page, built from this source into `../2026-11-17-orbifold-showcase/site/` |
| `src/formulas.mjs` | the LaTeX the page composes while it runs; MathJax typesets everything at build time |
| `test/` | `node --test`: the engine against an independent count (400 random gluings), the seven examples against the book, every signature of the Symmetries tab against its own tile |
| `tools/check_quotes.mjs` | every book citation quotes words that are on that page (needs the PDF and `pdftotext`) |

Build: `node build.mjs` (esbuild through `npx`; MathJax from `~/.cache/mathjax-full-3.2.2`, `npm i mathjax-full@3.2.2`
there). `--hide prove,name` leaves a tab's button out, `--out dist/x.html` writes another file;
`--template`, `--entry` and `--css a.css,b.css` build another page from the same source (the showcase:
`node build.mjs --template src/showcase.template.html --entry src/showcase.js --css src/styles.css,src/showcase.css --out ../2026-11-17-orbifold-showcase/site/index.html`).
Tests: `node --test`. Quotes: `node tools/check_quotes.mjs`.
Screenshots: `node ~/git/animated-groups-fable/standalone/the-folding/tools/shot.mjs --root "$PWD" --page dist/index.html --steps steps.json`
(`window.__surfaces = { show(tab, state), tabs, stage }`; `tabs.prove.dry(id)` runs every phase of a zip at once;
`tabs.sym.go('*732')`, `tabs.sym.select(i)` and `tabs.sym.pattern.state()` drive and read the Symmetries tab).
Publish: `~/git0/flush-util/sheep publish reports/2026-11/2026-11-15-classification-of-surfaces/dist/index.html --as-rendered --name '…'`.

## How the 3D is built

A body is cut into cells, one round each site: the flat patch of the Zippers tab has one or two, the ball has the twelve
pentagons of a dodecahedron. A cell is a polar grid from its hole's rim to its outline; what a zipper makes is a
separate patch welded to that rim (`src/geo/scene.js`). A zip is drawn by moving vertices, never by changing the mesh:
the purse closes a hole, a tube half grows along a Bezier arc, the crosscap's collar rises onto its crossing segment.
The renderer paints the two sides of the paper teal and sand by triangle winding, so where a one-sided surface is
zipped, teal meets sand along the seam. That is the book's "front against back", for free.

The Zip it up tab's pictures are honest where the book's are: gaping zips leave eyelets (Fig. 8.6, 8.8, 8.9), a gaping crosscap is
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

**A trackpad's two-finger swipe turns the view; only a pinch zooms** (Sat 21 Nov 2026, week 47). His note on the page,
20:12: on the MacBook's trackpad a finger drag zoomed but never turned, while the mouse worked (his words to Shepherd:
*"Make sure the interactions work using the Macintosh latest Touch API…"*). A swipe reaches the page as wheel events,
and the renderer reads every wheel event as zoom (`render3d.js` onWheel). Shepherd, the page's own agent, changed the
live page at 20:15 (version `d6a32866`, "syntax checked, runtime unverified") by editing the built file's renderer:
any wheel without ctrl turns the 3D view and slides the pattern, and only ctrl+wheel (a pinch in Chrome and Firefox;
Safari pinches with gesture events) zooms. The agent-requests pass carried that into the source on Sun 22 Nov, the
renderer left unchanged: `src/turning.js` takes a wheel on the way down (capture) and turns, `src/sym/pattern.js`
slides. **So a mouse wheel turns and slides too, and no longer zooms.** `src/wheel.js` (not used, tested) tells a
mouse's notch from a swipe, if the wheel is to zoom again: its header says the two lines. Checked headless, on
Shepherd's live page and on this build alike (synthetic wheel events, real mouse drags): a swipe turns and keeps the
zoom, a pinch zooms, a mouse drag still turns; before Sat 20:15 the same swipe zoomed (1 to 0.96) and never turned. Not
checked here: a real trackpad.

## The Symmetries tab

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
  comes home exactly: no drift). Every tile has one tone and carries the same print, mirrored where a mirror or a
  miracle brought the tile there (two tones for the two hands went on Tue 17 Nov: "Chaim's two comments" below). Mirrors
  are red lines, a glide's axis a dashed red line, gyration points and mirror crossings the crystallographers'
  marks (lens, triangle, square, ...). On the outlined tile the two edges of each glued pair share a colour and a number of arrowheads.
- **the surface**, in the 3D pane (`src/sym/surface.js`): a sphere with one hole is drawn as a flat plate with the
  star's corners as corners (the plate of `*632` is its 30-60-90 triangle); an annulus and a Möbius band are the Examples tab's
  own models; everything else is a tidy ball of the Tidy surfaces tab with cone points (as sharp at the tip as a paper cone of
  angle 2π/n), mirror rims and crosscaps. "Zip the outlined tile up in “Zip it up”" hands the tile's word to that tab.

How an example is made (`src/sym/domains.js`): a polygon with angles π/d round an inscribed circle, in whichever
geometry its angle sum puts it; each edge is a mirror or a seam. All mirrors: the kaleidoscope. Otherwise the tile is
the polygon and its image in one seam, every other seam glued to its image (by a turn, or by a turn and a flip: a
glide). That one construction gives `*pqr`, `pqr`, `p*q`, `2*22`, `22*`, `22x`, `**`, `*3*`, `***` and their
families; regular polygons with a word give `o`, `xx`, `oo`, `xxx`, `o2`; three are written out (`*x`, `Nx`, `NN`).

Nothing about a signature is typed in and believed (`src/sym/orbifold.js`, `test/sym.test.js`): the tile's corners
are walked round each point they share (total angle 2π/n: a cone point; π/n ending on mirrors: a corner), the mirror
edges are strung into boundaries, the glued edges are handed to the Zip it up tab's bookkeeping for handles and crosscaps, and
`bind()` fails if that is not the signature shown. The price must agree with the tile's area (Gauss-Bonnet) and the
geometry; on the sphere the number of tiles must be 2 / (2 − price); no two tiles may overlap.

**Any signature** (his next ask, the same evening: *"give a way to add x/ etc to give more signuatre flexibility
(not just cone point, but give a way to modify the singuature)"*). The row under the signature adds a handle `o`, a
cone point, a mirror `*`, a corner (on the chosen mirror, else the last) or a crosscap `x`, and removes the chosen
character; a signature is data, `{ o, cones, stars, x }` (`src/sym/catalog.js` `parse`, `addTo`, `removeAt`,
`stepAt`), and any text of that shape is a deep link (`#sym&k=2*632*3x`).

- A crosscap next to handles turns each handle into two crosscaps, and a handle next to a crosscap arrives as two
  (the Tidy surfaces tab's trade, `o x = x x x`); the page says so when it happens.
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

**The print: Paisley** (six prints behind a chooser for a day: the same ask of Sun 15 Nov, *"give me a chooser to
choose between patterns, maybe reuse the patterns from https://spacesheep.dev/@yaroslavvb/the-folding#g=333"*; then
his decision of Mon 16 Nov 2026: *"keep the Paisley pattern and get rid of the selector, and the 'pattern on a
sphere' box, should be cleaner design"*). The chooser, its place in the address (`&p=`, now ignored) and in the
browser's storage, and the five other designs (Soft commas, Tomoe, Checkerboard, Rings, Comma) are gone; commit
`eac0a050` is the last that has them. The box in the pane's corner that said "the pattern, on a sphere" went too: the
line beside the price says which of the three it is. What is left on the pattern pane is its reset button and, until
the first touch, the hint. The Folding's own prints are fitted by hand and by search to each of the 17 plane groups
(a table of knobs per group in its `src/patterns/`), so they cannot be carried to a sphere, a hyperbolic tiling or a
signature typed a moment ago. Taken from it: the idea, the name and the paper's two tones a side (`palette.js`
`PRINT_FRONT` / `PRINT_BACK`). In `src/sym/motifs.js` the print is drawn on ONE tile from that tile's corners alone,
and the symmetries carry it: a family of commas, a big one a cell and a small one in every corner with room. It has
no symmetry of its own (a comma has a hand; a tile of two mirror halves gets the same hand twice, not a mirror
image), so the pattern has exactly the signature shown. Tested: every comma lies inside its tile, for all examples.

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

**Colours flipped under a drag; a and b unexplained** (his note, Mon 16 Nov 2026, week 47, later that morning: *"when I take
…#sym&k=\*4 and drag it around, colors flip which is distracting. alos I don't understand what a,b mean in the
leftmost diagram there. Maybe add explanations/tooltips somewhere or delete it"*). Three things were behind it.

- *Every tile's tone swapped when a drag crossed a mirror*, on the plane and the hyperbolic plane: a bug since the Symmetries tab
  was made. The list of tiles is kept centred on the tile nearest the middle of the view (`pattern.js` `recentre`),
  and a tile was painted teal or sand by whether it is a mirror image of THAT tile. Each time the middle moved onto
  a mirror-image neighbour, all the tones swapped. A tile is now teal when it is a copy of the OUTLINED tile and
  sand when it is its mirror image (`side = t.flip !== (det(base) < 0)`), so the tone belongs to the tile. The
  sphere was never affected: nothing is re-centred there. (The two tones themselves went the next day: "Chaim's two
  comments" below.)
- *A flat plate turned from teal to sand when tipped over* (`*4`'s teardrop, and every one-hole orbifold that
  `surface.js` `buildDisc` draws). A plate has nothing to show underneath, so it has one colour on both sides now
  (`scene.sameBothSides`, read by `stage.js`). A band (`**`) keeps its sand inside, and the four chapter tabs are as before.
- *a, b* are the zips of the outlined tile: two edges with the same letter are glued to each other, arrow onto
  arrow, when the pattern folds up into the surface. The page said so only inside a fold. Now a key sits right
  under the two pictures and names only what is in them (the outlined tile; a, b; a copy of the tile; its mirror
  image), and a mouse resting on an arrow or a letter, or a finger tapping one, makes the two edges of that letter
  stand out and says the same beside them (`pattern.js` `spotAt` / `placeTip`; the note is `#pat-tip`). The footer
  legend's teal and sand entries moved into the key. The letters themselves went soon after: next paragraph.

**Colours and arrowheads instead of letters** (his next note, the same morning: *"instead of using letters a,b, use
colors or edge styling to indicate edges which are. matched up"*). The outlined tile no longer carries letters. The
two edges of a glued pair are drawn alike and unlike every other pair: one colour, and one number of arrowheads
(one, two or three, as on a textbook's polygon), so that pairs can be told apart without colour too
(`src/sym/pairs.js` `pairStyle(k)`, k = the order in which the pairs are met going round the tile). Five colours
(violet, gold, magenta, green, grey) times three counts give fifteen looks before one repeats, and no tile the page
allows has more than fifteen pairs. The colours keep clear of what the pattern already uses (teal tiles, red
mirrors, blue gyration points) and each stroke has white under it, so a colour reads the same on a tile and on the
print. The arrowheads still say which way the two edges go together. The key under the pictures shows a
swatch for each pair on the screen; a pointer anywhere along a glued edge (or a tap) brings out its pair with the
note. The Zip it up tab keeps letters, because there they name the buttons that zip a pair, and draws a tile handed over from
the Symmetries tab in the Symmetries tab's colours, pair for pair (`tabs/prove.js`: the `tile` preset takes `PAIR_COLORS`). The blue and red
marks at the tile's corners are drawn after its edges now, which would otherwise cover them.

**The surface's labels in the signature's colours, no ring** (his note, the same morning, with a picture of the ring
on a rim: *"also this large circle selector is confusing, perhaps just use color, same as in the edit box"*). A
chosen character used to get a 26 px ring round its place on the surface, which read as part of the surface (a loop
in the rim). Now every label on the surface is written in its character's colour, the bar's own blue or red
(`var(--blue)` / `var(--red)`, so the dark theme follows), and a chosen character keeps its strength while the others
fade to half; a chosen digit's dot is a little larger. The renderer writes all labels in one ink and is vendored
unchanged, so `stage.js` colours its label elements from outside, by position, after each render: a marker may carry
`labelColor` and `labelFaint`. Colour and opacity only, because the renderer measures a label once.

**Symmetries first, and the tab the page opens on** (his ask through the page's Session tab, Mon 16 Nov 2026: *"make
'symmetries' tab the default first tab"*). It was the fifth tab and the page opened on Zippers. Now it is first in
the bar and `DEFAULT_TAB` in `src/app.js`, so a plain link opens on it, and so does a deep link whose `#…` part
spacesheep's viewer has dropped. The four chapter tabs follow in the book's order. The page used to call its tabs by
number ("tab 3"); with the order changed every such mention would have pointed at the wrong tab, so the page, the
code's comments and this file now call a tab by its name, which no reordering makes wrong. Deep links are by name
as before (`#zip`, `#tidy`, `#prove`, `#name`, `#sym`).

**One screen drives the others** (his ask, Tue 17 Nov 2026, week 47: *"Make this collaborative so that multiple people
can drag it and see the results, similar to how this page was done.
https://spacesheep.dev/@misha/the-folding-synced#g=333&cut=2"*). That page uses spacesheep's page stream, and so does
this one (`src/sync.js`).

- *How it works.* The page's head declares a stream it reads and may write:
  `<meta name="ss-streams" content="classification-of-surfaces/view" data-push="classification-of-surfaces/view">`.
  That loads spacesheep's client, so `window.ss.stream(name)` exists. The open page of the space's **owner** pushes
  its state into the stream, and every other screen that has the page open takes what arrives, signed-out readers
  included.
- *Who can drive.* Only the owner. spacesheep's push route lets through the space's owner and nobody else (its notes:
  "only the space's owner is let through … so treat `ok: false` as 'this screen follows'"), and only for a page no
  one else can edit. A reader's first touch tries one push, is refused, and that screen follows from then on. So
  several people watch one person drag; several people cannot each drag for the others. That is the service's rule
  and the same on the page it was modelled on. He leads from whichever of his own signed-in screens he touched last.
- *What is sent* (`app.js` `snapshot()`, taken back by `applyRemote()`): the tab; what the tab keeps in the address
  (the signature, the zipper and its scrubber, the tidy counts, the preset, the example); the 3D view; and what the
  address does not hold: in Symmetries the chosen character and where the pattern has been slid to
  (`pattern.getView()` / `setView()`), in Zip it up the pairs zipped so far in order (a follower plays the last one
  and does the earlier ones at once), in Examples which counts are on. Under 1 KB a value.
- *When.* While this screen is the one being touched, its state is looked at 14 times a second and sent when it has
  changed; when it has not, once every 1.5 s for half an hour after the last touch, so that a screen that opens late
  hears the presenter. A real gesture (`isTrusted`) is what makes a screen the driver. Each value carries a random
  id for the tab and is ignored when it comes back.
- *On a follower.* A value is taken when it says something new and this screen's own hand is not on it. A value that
  only repeats the last one is not taken again, so a reader who wanders off is left alone until the presenter
  moves. A screen that opens while someone presents goes to the presenter within a second or two; with nobody
  presenting it stays on the address it was opened with (the stream's last value may be hours old and is not asked
  for).
- *The chip* at the right of the title says what this screen is doing: Synced (waiting), Live (it leads), Following,
  Solo. A tap goes Solo (nothing sent, nothing followed) and back; the choice is kept in the browser. Outside
  spacesheep (the tailnet copy) there is no `window.ss`, no chip, and nothing runs.
- *Two things made exact on the way,* both in `src/sym/pattern.js`. Whether the tile at the middle of the view is a
  mirror image of the outlined one is now kept as a fact (flipped when the middle crosses onto a mirror-image
  neighbour) and no longer read off a determinant, which rounding made wrong beyond about 13 units on the hyperbolic
  plane: the tones would have swapped again there. And the outlined tile's place, a matrix whose entries grow like
  e^distance, turned to not-a-number for good some 18 units out; about 10 units out (four long strokes, long after
  the tile has shrunk out of sight) the outline now moves to a tile by the middle of the view with the same hand.
- *Not tried:* the owner's own push from the open page, which needs his signed-in browser. Everything round it is:
  the declaration is read (a signed-out screen on the published page gets the stream, online and not denied), a
  reader's push comes back refused, and three states pushed into the stream with his key (the CLI) moved a signed-out
  screen to each of them. The route's conditions were read in spacesheep's source: the caller is the owner, the page
  names the stream in `data-push`, nobody else has edited or may edit the page (its roster holds only him).

**Chaim's two comments** (Chaim Goodman-Strauss, on the published page, Tue 17 Nov 2026, week 47; threads
`e62bd35e…` at 11:08 and `06ab350e…` at 12:03 on https://spacesheep.dev/@yaroslavvb/classification-of-surfaces; his
ask: *"address the comments Chaim left"*, then *"When you fix them, make sure to reply to the comments."*).

- *"\*pqr's show two colors, and break the symmetry, to be pqr!"* He is right, and it was wrong since the tab was
  made. A tile that is a mirror image of the outlined one was sand and a copy teal, so a reflection swapped the two
  tones: what was drawn under `*632` had only the symmetries that keep the tones, which is `632`. The same went for
  every signature with a mirror or a miracle. A picture offered as "the pattern with this signature" has to have
  that symmetry and no less. Now every tile has one tone, and the only thing that differs between a tile and its
  mirror image is the print, which arrives mirrored: that is what a reflection does to it. The key's two entries (a
  copy, its mirror image) are gone, the fold says why a second colour would take the mirrors away, and the rim of
  the hyperbolic disc is tinted by the one tone. In `pattern.js` one path for the tiles and one for the print.
- *"dragging the fd away to infinity, it could snap back."* When a drag has carried the outlined tile (the
  fundamental domain) out of sight, the outline goes to the tile nearest the middle of the view as the hand lets go,
  and glows for a moment (`pattern.js` `outlineSeen()` / `settle()`): off the pane on the plane, more than two units
  from the middle of the hyperbolic disc (0.77 of its radius, where a tile is a speck), behind the ball on the
  sphere. Every tile is as good a fundamental domain as another, so nothing else in the picture changes. The same
  after a slide with the arrow keys. While the hand is still down nothing snaps. With one tone there is no hand to
  keep, so the outline simply takes the middle tile; whether each of the two matrices turns the plane over is still
  kept as a fact for `fix()` (`vRev`, `bRev`).
- Both threads were answered on the page with one line each and a link, marked `<ai>` (replies `5a49a7a1…` and
  `45e51710…`); the threads are left open for him.

**The Orbifold showcase, and what it changed here** (Tue 17 Nov 2026, week 47; his ask: *"Create a little showcase
just the symmetries tab only, and also generate a video I can post on twitter ... the goal is interactive toy for
people learning about Orbifolds, maybe hide the explanation below a tutorial tab ... along with things that can be
tried, and a separate link to tutorial"*). The page and its video are in
[`../2026-11-17-orbifold-showcase/`](../2026-11-17-orbifold-showcase/README.md); it is this tab's module on a page of
its own (`src/showcase.*`), so the two cannot drift apart. What changed in the shared code:

- **Deleting a star keeps its numbers** (`catalog.js` `removeAt`). It used to take the star's corners with it:
  `*632` without its star was the empty signature. Now it is as in a line of text: the numbers stay and belong to
  what stands before them, the star before it or, with none, the cone points, so `*632` becomes `632` (the mirrors
  go, the triangle closes into a pillow) and `3*3` becomes `33`. Where the result would not fit the limits below,
  the star goes with its numbers as before.
- **The address bar follows the page** (`src/sharehash.js`). On spacesheep the page runs in a frame and the address
  belongs to the viewer round it. The viewer takes a page's fragment only when the page says
  `{type: "ss-hash", hash}`; its own bridge says so on a `hashchange`, and these pages write their address with
  `replaceState`, which fires none. So the page says it itself, in the characters the viewer takes
  (`[A-Za-z0-9_.=%&/-]`: the star of a signature travels as `%2A`, and the page reads either spelling). The state a
  plain link opens is told as no fragment at all, so the plain link stays plain; another tab or signature reads
  `...#sym&k=%2A732`, and that address opens the same thing for whoever gets it.
- A broken escape in a typed address (`#sym&k=%zz`) used to stop the page from starting; that part is now ignored.
- The tab's module no longer needs every control to be there (the example arrows and "Zip the outlined tile up" are
  absent on the showcase), and `initBookRefs(pop, { open: false })` shows a citation's words without the link to
  the scan, which only his tailnet serves; there the pop-up links the book at its publisher instead
  (`https://doi.org/10.1201/b21368`). On this page the citations still open the scan.

Known limits: digits run 2 to 9; at most twelve places on the ball (a handle takes two), six corners on a mirror,
fourteen characters; a tile's shape is one choice among many where the book says the pattern can be stretched
(`*3*`, `o`, `**`, and every general tile); cone points and corners do not show in the Zip it up tab (only the surface); the
hyperbolic disc draws the 4,200 nearest tiles (fewer while a finger moves), the rest of the rim is tinted.

### A slide coasts, and a two-finger swipe slides (Sat 21 Nov 2026, week 47)

His ask on the page, Sat 21 Nov 2026 10:47: *"add slight inertia for when I slide things"*. Shepherd, the page's own
agent, added a glide to the live page at 10:49 (version `05afd7b9`, "Haven't tried it in a browser yet") by editing
the built file; the agent-requests pass carried it into `src/sym/pattern.js` on Sun 22 Nov with Shepherd's numbers. A
slide carries on after the hand lets go and slows to a stop: the speed is the hand's over its last 90 ms, at most 2.5
px per ms, it falls to a third in about a fifth of a second (`FADE` 200 ms), and nothing coasts below 0.12 px per ms or
when the hand rested 70 ms before letting go. Each frame moves the point under the place the hand let go, as one more
step of the drag would, so it works the same on the sphere, the plane and the hyperbolic disc, and the outline still
comes back (settle()) once it stops. A new touch, a wheel, a key, a reset, another pattern or another screen's view
stops it; `prefers-reduced-motion` has none. Shepherd's 20:15 change (above, under Turning the view) also made a wheel
without ctrl slide the pattern: a two-finger swipe moves the point under the pointer the way the fingers go. Checked
headless: a flick coasts and stops, a hand that rests before letting go doesn't coast, a touch stops a coast.

## What is not there

- A join that involves a ball (not two polygons) changes the picture without motion: the two arrows stand out, then the
  picture is redrawn.
- After a zip that leaves rim over, the tidy redraw is a cut: an eyelet becomes a hole at a site of its own in one step.
- The chapter's frontispiece surface (p. 92) is not classified in the book and is not on the page.
- The scan of the book is on the tailnet only, so the page-number links open for him and for nobody else.

## Checked

- `node --test`: 86 tests (the newest five, Sun 22 Nov 2026, for the unused `src/wheel.js`: a trackpad's swipe against a
  mouse notch, lines, a pinch and modifier keys, and one gesture keeping one kind; before them, 81: the newest of those: the address told to spacesheep's viewer holds only the characters it takes,
  and deleting a star keeps its numbers; before them: a motion put back onto the group keeps the hand it is told, in all three
  geometries; before it: on every example's tile and seven tiles of one's own each glued pair sits on
  exactly two edges and the pairs are numbered from the first, and fifteen pairs get fifteen different looks, none
  of them near the pattern's red or blue; the five before it: typing and deleting a signature character by character; the print
  inside its tile on every example; many handles and crosscaps: the tile search ends and finds every tile once; over 250 spellings
  of the 47 examples each found as its example, with the example's tile; the four kinds without a pattern and what
  is offered for them, each offer having a pattern). The zipping's bookkeeping against an independent count of the glued surface (400 random
  gluings, three zip orders each); the seven examples' counts against the book's table; the Symmetries tab: the 47 examples and
  1,345 more signatures (every `*pqr` and `pqr` with digits 2 to 9, every family over its numbers) each folded up
  from its own tile, its price against its area, the sphere's tile counts (`*532`: 120), no two tiles overlapping;
  400 random signatures (over 250 of them on the general tile) folded up the same way; every signature of at most
  four characters over `o 2 3 5 * x` either has a tile in the right geometry or is one of the ones without a
  pattern, and the spherical ones among them are exactly the fourteen types; adding, removing, stepping, the trade.
- Every zip of every preset and of 40 random deals, in three orders, stepped through all its phases in a browser: no error.
- `node tools/check_quotes.mjs`: 88 citations in the two templates, each at most 15 words and on its page.
- The address, Tue 17 Nov 2026: 20 checks of both pages inside a frame (what each tells its parent, a fragment handed
  down with `%2A`, a plain link staying plain, a broken escape); and on the published copies inside spacesheep's
  viewer, a fresh session each: the plain link stays plain, another signature reads `...#sym&k=%2A732`, and that
  address opens the same signature.
- Looked at in headless Chrome at 1280 and 390 px wide, light and dark, with reduced motion; a real tap on an arrow,
  the chips, Unzip, and the deep links (`#zip&kind=handle`, `#tidy&k=oox*`, `#prove&k=fig810`, `#name&k=klein`).
  And in WebKit (Safari's engine) on the M5, at 390 and 1280 px: no error, no sideways scroll, the same layout as Chrome.
  Not tried on a real phone.
- The Symmetries tab with a real mouse in headless Chrome: a long drag in each geometry (after six strokes across the hyperbolic
  disc the view is still an exact motion and the disc is full), once round a circle on the ball comes home exactly,
  the digit stepper, next and previous, the chips, `#sym&k=*732`, coming in by the tab button at 1280 and 390 px;
  and every one of the 47 tiles zipped up in the Zip it up tab ends as the surface the Symmetries tab shows, as do twelve signatures made
  by hand on the general tile (93 zips in all). Editing with real clicks: add a crosscap to `*632`, remove it,
  remove the mirror of `3*3` (no pattern, and the page says so), a deep link to `o2*3x`. In WebKit on the M5: all
  47 examples at both widths, the add row and remove with real taps, fifteen signatures of one's own, a touch drag
  on the ball and on the disc, no error. Dark theme looked at.
  Typing with a real keyboard in headless Chrome, at 1280 and 390 px: Delete four times from `*632` to an empty bar,
  `2 2 *` typed back (no pattern, a sphere, the plane), the cursor keys, a digit typed in the middle, a reload;
  the 3D view once round a circle comes home. (The chooser of prints and its six designs were checked then too,
  and removed the next day.) In WebKit on the M5 (it did not answer over ssh at first, about
  22:00 PST, and did a quarter of an hour later): the same Delete and typing with real key presses at both widths,
  the 47 examples and nineteen signatures of one's own (four, five and six handles and twelve
  crosscaps among them), the drags; no error. And with real keys in Chrome: `o` seven times (the seventh refused),
  `x` thirteen times, Delete twelve times, three long drags across the disc of `oooo`.
  Spellings and reasons (Mon 16 Nov 2026), with real clicks and keys in headless Chrome at 1280 and 390 px: `*4`
  says why and offers 4∗ and ∗44, a tap on 4∗ draws it; `*43`, `4`, `45`; `*236` reads "the same as ∗632" with that
  example lit, the chip and Enter both write it; `*252` is ∗225 "as the book lists it"; `* 2 3 6` typed key by key;
  the panes stay put side by side. In WebKit on the M5 at both widths: the same, and the 47 examples, no error.
  Tones, the plate, the key and the note (Mon 16 Nov 2026), in headless Chrome at 1280 and 390 px: six patterns with
  mirrors or glides (`*632`, `*442`, `22*`, `*x`, `*732`, `23x`) dragged in four strokes each, the outlined tile's own
  pixel read at every step: teal each time (before the fix it was sand after the first mirror crossed); `*4`'s plate
  seen from 51° below is teal; `**` still shows sand inside; the key's entries for `4*`, `*632`, `632`, `*4` and the
  empty bar; a mouse on an arrow shows the note inside the pane, and moving off or starting a drag hides it. In
  WebKit on the M5 at both widths: 33 looks of 33 teal on each of four patterns, the note by a finger's tap (and
  off again) and by a mouse. The published copy inside spacesheep's viewer: 33 of 33 teal on `*632`, the key, the note.
  Colours for letters (Mon 16 Nov 2026): twenty signatures looked at in Chrome (one to eight pairs, all three
  geometries); at 1280 and 390 px `632`'s four glued edges are two looks, the canvas shows each edge in its own
  colour at its middle, the key shows the same two swatches, a mouse on an edge brings its note, and the Zip it up tab opens
  the tile with its two zips in those two colours. In WebKit on the M5 the same at both widths, the note by a
  finger; the published copy inside spacesheep's viewer likewise.
  One print, bare pane, coloured labels (Mon 16 Nov 2026): in Chrome at 1280 and 390 px the pattern pane carries its
  reset button and nothing else after the first touch, an old link with `&p=tomoe` opens its signature and the
  address drops the `p`; the surface of `2*632*3x` writes its eight labels in the bar's own computed colours, a
  chosen one stays while seven fade, no ring marker is made, and the four chapter tabs are unchanged. The same in WebKit on the
  M5 at both widths and in the published copy.
  One screen drives the others (Tue 17 Nov 2026): with a stand-in for spacesheep's stream that keeps its rule, an
  owner's screen, a reader's and two late ones in one headless Chrome: the pattern slid (also while the hand is
  down), a signature typed, a character chosen, the surface turned, Zippers scrubbed, a pair zipped and unzipped,
  a count switched on, each arriving on the reader's screen; a reader's own move refused and left alone until the
  owner moves; Solo and back; a late screen with a link of its own going to the presenter, and staying put when
  nobody presents (19 checks, 32 pushes in all). On spacesheep itself, signed out: see "Not tried" above. Nine
  long strokes out and nine back on `*732`: every matrix a number, the outlined tile teal whenever in view. Chaim's
  two comments (the same day): on five patterns with mirrors or glides no sand tile is left (a few pale samples in
  40,000 are the soft edges of the red lines; it was about half of them); on the plane, the hyperbolic plane and the
  ball the outlined tile, dragged away three times, is back in the middle each time the hand lets go, and after each
  of eighteen long strokes on `*732`; Chrome at 1280 and 390 px, WebKit on the M5 at both widths, and the published
  copy inside spacesheep's viewer. In
  WebKit on the M5 (it did not answer over ssh at first that morning, and did twenty minutes later): the page as
  before at both widths, no error; the sync itself was not driven there.
  Not tried on a real phone; no reader other than the author has gone through the Symmetries tab yet.
- A reader who had not written the page went through it from screenshots and the chapter's text: no wrong count,
  symbol or citation; fourteen findings on wording and on the links between the tabs, the wording ones applied
  (which way the arrows run is now always said "round the rim"; the trade of a cross-handle for two crosscaps links
  to Figure 8.10 in the Zip it up tab; the pinwheel is explained; the symbol is worked out from the three numbers).
