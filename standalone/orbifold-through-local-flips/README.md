# Orbifold through local flips

Type any orbifold. Its pattern is cut into rigid pieces; every cut has a Length, and a Twist where it can turn. Click a cut to cut another way: the pattern stays exactly where it is, and only the cuts and their numbers change.

- **GitHub Pages:** https://yaroslavvb.github.io/animated-groups-fable/orbifold-through-local-flips.html
- **Spacesheep:** https://spacesheep.dev/@yaroslavvb/orbifold-through-local-flips (anyone with the link, unlisted)
- **Built from:** the Antigravity session [cad9fb4a](https://spacesheep.dev/sessions/antigravity/cad9fb4a-bcd5-4af3-9550-c4b04d9778b8), its section "The sweetest editing primitive: Geometry-Preserving Local Flips"
- **Companions:** [Two features, two handles](https://yaroslavvb.github.io/animated-groups-fable/two-features-two-handles.html) (four small types worked by hand), Classification of Surfaces (whose signature parser, rigid tiles and Paisley print this page uses, from `../classification-of-surfaces/src/sym/`)

## His ask (Fri 27 Nov 2026, week 48)

From a Claude session in `animated-groups-fable` (`f1620a4d`):

> *"Look at the transcript of https://spacesheep.dev/sessions/antigravity/cad9fb4a-bcd5-4af3-9550-c4b04d9778b8 for background and implement the "The sweetest editing primitive: Geometry-Preserving Local Flips" implementation. I want to have a page with an orbifold box (and also some entries that I can reuse), and implement the three-click moves. Make sure it supports both spherical, Euclidean, and hyperbolic examples. I want to maintain visual consistency when doing local flips. But the basic idea is I want to have an orbifold visualizer which lets me select parameters in OSA to change parameterizations for arbitrary orbifolds."*

And while it was being built: *"Call it "orbifold through local flips" and deploy Boson GitHub Pages and Spaceship."* ("in OSA" was read as "and also", "Boson" as "both on".)

What the transcript proposes: any orbifold is cut along three kinds of curve (a two-sided cuff with a Length and a Twist, a crosscap's one-sided core with a Length, an arc from mirror to mirror with a Length) into halves of pairs of pants; every decomposition is reached from any other by three click-to-flip moves on the diagram's edges (the edge flip that re-pairs a cuff's four neighbours, the handle swap, the mirror pop and merge that trades a cuff for arcs); and *"keep the current group Γ fixed when they flip and compute the new cut lengths/twists directly from Γ. The pattern on screen doesn't jump at all—only the highlighted cut curves and the slider handles smoothly swap."* Its example `333∗2×` has 7 numbers, 4 lengths and 3 twists.

## Corners, not cuts (his second ask, Fri 27 Nov 2026, evening)

After the first version was live, from the same session:

> *"Okay, the issue is that you're doing a cut. Can you change it so, instead of cutting on the geodesic, you're just rearranging the corners? The flip determines which special points you move, but I don't think we need the actual cut. Just find a way to make sure that the final pattern satisfies the symmetry. I think if the pattern doesn't actually go through a special point, it can just be moved Without distortion. So the point is that these cuts specify which corners are moved and then find some way to have a pattern which is satisfied while twisting. I don't want to have unexpected changes in pattern. Right now, this is happening. This may require some limits on the length to avoid things getting too skewed."*

The same day, on The real 2222 (session `c57c7f21`), he had asked for the same thing there: *"Instead of drawing the isolated cut with white, um, highlight the pairs of vertices which are being separated. So use different colors and different sizes"*.

What the first version did that he calls unexpected, and what is done now:

| first version | now |
|---|---|
| the print was laid afresh inside the pieces whenever a Length moved: commas changed size, and small ones came and went | **a comma is rigid**: laid once, when an orbifold is opened, and from then on only moved. No number and no flip changes its shape or its size, and none comes or goes |
| after a flip the first slider moved inked the whole print afresh for the new pieces (a cross-fade) | **nothing is ever inked afresh** unless the Fresh print button is pressed. A flip leaves every comma where it is; the next slider moves it from there |
| every cut was drawn over the pattern as a line, with the seams of the pieces | **the cuts are not drawn.** A cut is shown by what it parts: while it is pointed at, the special points on one side of it are drawn larger and filled in its colour, those on the other side larger and ringed in it; its row reads `parts 33 \| 3∗2×`. A cut that parts no special points (a handle's loop, a crosscap, a mirror) is drawn as its line. The `cuts` tick draws them all as before |
| a Length went from 0.35 to 7.5 | **a Length stops before the commas run into each other** (and at 1.0 for a cuff, 0.5 for an arc, where the collar round a short cut is bare ground as wide as a piece) |

How the pattern "satisfies the symmetry": it is the orbit under the group of commas that are each tied to one **anchor**, and the anchors are things the group moves with it. An anchor is a special point (a cone point or a mirror's corner: a corner of the piece the comma lies in, where the piece's angle is fixed by the signature, so the wedge there is rigid whatever the numbers are) or, in a piece that has no special point, the piece's middle. A Twist carries whole pieces, special points and commas, past each other. A Length moves the special points of a piece apart or together and each takes its commas with it. A flip changes which special points a number moves and moves nothing itself: each comma is tied to an anchor of the new pieces (the nearest: its own special point if it had one) exactly where it lies.

The limit: `crowding` (`print.js`) measures how far the circles round any two commas cross, as a part of the smaller one's size, over the copies in all the tiles round. The print is laid so that it is 0 (commas of special points are drawn in towards them, and where two circles would cross the small ones give way); it is a matter of the pattern alone, so a flip leaves it as it was; and a Length stops at 0.12 (`CROWD_MAX`), walking the way there in steps so that two commas cannot pass through each other between one slider place and the next. For the entries of the page a Length then runs from about 0.4 to 1.6 of what the cut opens with (0.6 to 1.5 on the plane; up to 2.3 for a handle's loop). A Twist is never stopped: after a flip, commas that lie across the new cut are carried over the others, and are drawn over them.

**Fresh print** lays the commas afresh on the pieces as they are now: the one thing that changes them, and only when asked. A link opens the same orbifold cut the same way with the same numbers, with the print laid as that decomposition first has it.

## What is on the page

- **The orbifold box.** One text field that always says what is on show; typing a signature opens it as it is typed (`2345`, `22∗3`, `o∗2`; `*` and `x` do for `∗` and `×`). Under it three rows of entries (hyperbolic, plane, sphere) and a fourth, "yours", of what was typed here (kept in the browser). A signature no pattern has says why and offers the nearest that have one.
- **The pattern**, in the geometry it lives in: the Poincaré disc, the plane, or the sphere seen from outside. Drag slides it, the wheel too, a double tap centres it. Mirrors red, cone points blue. The cuts are not drawn (see above); the `cuts` tick draws each in its own colour, a cuff solid and an arc dashed, with the seams of the pieces thin.
- **The diagram**: a dot for every piece, a line for every cut, the features as leaves. A numbered round handle on a cut that offers a move; click it (or the button in its row; or the cut on the pattern when the cuts are drawn) to flip.
- **A row for every cut** with what it parts, its Length (on a log scale; a crosscap shows the length of its one-sided core) and its Twist (in turns). Pointing at a row or a handle lights the cut in both and marks the special points on its two sides, on the pattern and in the diagram.
- **Undo** (also ⌘Z / Ctrl+Z) steps back through flips, slider moves and fresh prints; **Reset** returns to the canonical cut. The address holds the signature, the decomposition and its numbers (`#k=333*2x&d=…&p=…`), so a link brings a state back.

Three kinds of orbifold:

| | what is shown | numbers |
|---|---|---|
| hyperbolic with numbers of shape (any signature, up to 14 characters) | cut into pieces, every move | Thurston's count, `−3χ(\|O\|) + 2k + l` |
| the nine plane types that have one (`2222 o ∗∗ ∗× 22∗ 22× ×× ∗2222 2∗22`) | one flat piece closed on itself, at a fixed area | 1 or 2 |
| rigid: every type on the sphere, eight on the plane, `pqr`, `∗pqr`, `p∗q` | the Classification page's tile and print, nothing to cut | 0 |

## The moves

| move | offered by | what it does |
|---|---|---|
| edge flip (`A`) | a cuff between two pairs of pants | re-pairs its four neighbours, `(AB\|CD) → (AC\|BD) → (AD\|BC)`: of the curves that pair them so and cross the old cuff twice, the shortest. If that one is too long to draw and the pairing after it is not, the one after |
| handle swap (`S`) | a cuff with both sides on one pair of pants | the shortest loop that crosses it once |
| pop / merge | a cuff with a mirror behind it; the arcs it opens into | the cuff becomes arcs from the mirror round each of the two things in front of it (its Twist traded for a second Length), and back |
| arc flip (`F`) | an arc between two mirror polygons | the common perpendicular of the other two mirrors |
| slide | an arc from a mirror round a cone point or a cuff, next to a mirror polygon | moves to the polygon's third mirror |

On the plane the same clicks do the lattice's version: `2222` goes round the three pairings of its four half-turn points, `o` takes the shortest loop across, `∗2222` the other pair of mirrors, and `∗∗`, `∗×`, `22∗` pop between a cuff and an arc.

## How the pattern is kept still

- **A flip is a change of coordinates.** The new cut is a product of the motions round the old pieces' ends, worked out in the frame of the cut being flipped, as pairs `(c, w)` in SL(2, ℝ) (`h2.js`: a slide by `d` along a line is `(cosh d/2, sinh d/2 · n)`), because 3 × 3 products of far-reaching motions lose `e^{2d}` digits. Its Length is read off the trace; the neighbours' Twists change by the step the foot of a seam takes along its cuff. The new pieces are then fitted onto the motions (`fitPants`, `fitMirror`, `fitHalf`), which gives the map from each old piece's chart to the new one's.
- **The view** follows that map (`view.replace`): the tile in the middle of the pane is re-expressed in the new atlas and nothing moves. (With the cuts drawn, those that went fade out as the new ones fade in.)
- **The print** is Paisley commas, each tied to one anchor and only ever moved (see Corners, not cuts). A flip leaves every comma exactly where it was and ties it to an anchor of the new pieces (`print.js` `retie`). No comma is ever cut, resized or laid afresh.
- **A slider** keeps the middle of the pane where it is: the cut being moved keeps its line when it is a cut of the piece in the middle. An atom's middle (where its big comma is) is the polygon's analytic centre, which moves smoothly with the piece; the centre of the largest circle that fits did not (see Faults).
- **Undo** of a flip is the flip's own map the other way round; Undo of a slider puts the view back exactly, unless the pattern has been slid about since.

## How it is built

`src/` — no dependencies beyond the Classification page's `sym/` modules and its build script.

| file | what |
|---|---|
| `h2.js` | the hyperboloid model: points and lines as vectors, frames, slides and turns, pair arithmetic |
| `pieces.js` | the rigid pieces: the right-angled hexagon in closed form (from its Gram matrix), pants `P`, mirror polygon `M`, half-pants `S`, the flat annulus `A` and strip `R` |
| `atlas.js` | pieces glued along their ends (pair, fold onto `22`, smooth mirror, crosscap, half-turn), every atom in a chart of its own; the walk that unrolls the tiling, point location |
| `decomp.js` | a decomposition as plain data, the canonical one for any signature, its code for the address |
| `moves.js` | the moves on hyperbolic decompositions |
| `flat.js`, `rigid.js` | the nine plane types and their moves; the rigid types |
| `print.js` | the commas: laid on a decomposition, kept through a flip |
| `model.js` | one state as the page holds it: open, move a number, flip, link. No DOM |
| `view.js`, `schematic.js`, `page.js` | the pattern pane, the diagram, the page |

`npm run build` bundles one file (`site/index.html`, copied to `docs/orbifold-through-local-flips.html`) with the Classification page's `build.mjs`.

## Checks

- `npm test` — 158 node tests, about 4 s. The pieces (areas by Gauss–Bonnet, the three end motions of a pair of pants multiply to 1); every way of closing an end covers the plane exactly once; the canonical cut of 48 signatures has Thurston's count of numbers, the right area and covers the plane once, at the default numbers and at random ones; every move every one of 24 signatures offers at first leaves the group as it was (each generator of one atlas is tried as a symmetry of the other); three edge flips return the same numbers; pop and merge undo each other; chains at random numbers; the nine plane types and their moves; the sphere covered by the right count of tiles; every flip keeps every comma, also along chains; **along random flips, Lengths and Twists every comma keeps its shape and its size and none comes or goes**; the print is laid with no two commas touching, a flip leaves it as crowded as it was, and a Length taken to either end of its slider stops within the limit; the first step of a slider after a flip is a step like the next; what each cut parts; the address reads back; a slider moved in 1 % steps moves every comma in small steps.
- `node tools/browser-check.mjs [--url <url>]` — the built page in Chrome, 27 checks. On 27 Nov 2026: 112 flips over 16 orbifolds leave the print pixel for pixel the same (0.00 % of pixels differ inside 0.8 of the pane); 62 steps undone bring the picture and the address back each time; sliders moved in small steps, none with a step over 1.3 times the usual, also right after a flip; a Length dragged to the end of its slider stops and says why; Fresh print and its Undo; the cuts not drawn, a cut pointed at marking the special points it parts; with `cuts` ticked a click on a cut on the pattern; keyboard and typing; at 390 px nothing wider than the screen and the pattern pinned above the sliders.

## Faults found on the way, each fixed at its root

- **A comma turned by a flip of `2222`.** At its square default a comma's middle lies exactly on a corner of the next pieces, and the way the comma faces was kept against that same corner: the direction to a point from itself. Kept against the farthest corner now (`print.js`).
- **Commas missing near the rim after a pop.** How large a comma is on the screen was asked at its atom's middle; tied to a long new piece, a comma near the pane's middle was judged too small to draw. Asked where the comma is (`view.js`).
- **Commas jumping as a Length moved** (`33∗2` at 1.12 of its first length, by 0.19). The middle of a piece was the centre of the largest circle that fits, found by stepping; in a long piece that circle can sit anywhere along it. The analytic centre instead (`pieces.js` `incentre`).
- **A link that did not read back**: a Twist of −0.5 is written 0.5 (one twist).
- **A comma swinging about after a flip of `∗22222`** (second version): the corner 2 at either end of an arc that runs along a mirror was not counted a special point, so its comma was tied to the middle of the pentagon, 0.75 away, and ran into the others when the arc was 2 % longer. Counted now (`print.js` `specialCorners`); the two half-turn points a cuff is folded onto are still not, since they slide along the cuff with its Twist.

## What is not built

- **Two crosscaps for a one-sided handle**: the fourth move a non-orientable surface has. Every crosscap stays cut along its own core.
- **A pop for a cuff between two mirrors with corners**, or between such a mirror and a crosscap.
- **Long cuts.** A move that would make a cuff longer than 9.5 or an arc longer than 6 is turned down, and says so: such a piece is a sliver on the screen and its far end is known to few digits. On surfaces with handles this comes soon (`oo` cut as a theta has a cuff of 7.05; flipping either of the others would make one of 13 or more): shorten the cuts with the sliders first. In 2,880 random flips from the defaults over 17 signatures a fifth were turned down so; over seven signatures with handles, a third of 3,360, and 4 of those failed in the arithmetic (cuffs of 9.3), which the page reports as not flipped.
- **A print that looks after itself.** Commas are only moved, so after flips and long slides the commas of different anchors can lie over each other (under a Twist after a flip they are carried across), and a short cuff leaves bare ground round it. Fresh print lays them afresh when asked; nothing else does. A link does not carry the print: it is laid as the decomposition first has it.
- **Cone points of order 10 and more**, and signatures longer than 14 characters (the Classification page's parser).
- **The metric is the page's own**: the default numbers are every cuff `2 acosh 2`, every arc `acosh 2`, every Twist 0, not the Classification page's tile. Only the rigid types are drawn as that page draws them.
