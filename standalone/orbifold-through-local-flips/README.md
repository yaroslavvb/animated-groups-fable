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

## What is on the page

- **The orbifold box.** One text field that always says what is on show; typing a signature opens it as it is typed (`2345`, `22∗3`, `o∗2`; `*` and `x` do for `∗` and `×`). Under it three rows of entries (hyperbolic, plane, sphere) and a fourth, "yours", of what was typed here (kept in the browser). A signature no pattern has says why and offers the nearest that have one.
- **The pattern**, in the geometry it lives in: the Poincaré disc, the plane, or the sphere seen from outside. Drag slides it, the wheel too, a double tap centres it. The cuts are drawn over it, each in its own colour: a cuff solid, an arc dashed. Mirrors red, cone points blue, the seams of the pieces thin.
- **The diagram**: a dot for every piece, a line for every cut, the features as leaves. A numbered round handle on a cut that offers a move; click it (or the cut on the pattern, or the button in its row) to flip.
- **A row for every cut** with its Length (on a log scale; a crosscap shows the length of its one-sided core) and its Twist (in turns). Pointing at a row, a handle or a cut on the pattern lights the same cut in all three places.
- **Undo** (also ⌘Z / Ctrl+Z) steps back through flips and slider moves; **Reset** returns to the canonical cut. The address holds the signature, the decomposition and its numbers (`#k=333*2x&d=…&p=…`), so a link brings a state back.

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
- **The view** follows that map (`view.replace`): the tile in the middle of the pane is re-expressed in the new atlas and nothing moves. The cuts that went fade out as the new ones fade in.
- **The print** is Paisley commas, each lying whole inside one piece. A flip leaves every comma exactly where it was and ties it to the new piece it now lies in (`print.js` `retie`), so some lie across the new cuts. The first slider moved after a flip inks the print afresh inside the new pieces, cross-faded. A Twist slides whole pieces past each other, so no comma is ever cut.
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

- `npm test` — 152 node tests, about 1.5 s. The pieces (areas by Gauss–Bonnet, the three end motions of a pair of pants multiply to 1); every way of closing an end covers the plane exactly once; the canonical cut of 48 signatures has Thurston's count of numbers, the right area and covers the plane once, at the default numbers and at random ones; every move every one of 24 signatures offers at first leaves the group as it was (each generator of one atlas is tried as a symmetry of the other); three edge flips return the same numbers; pop and merge undo each other; chains at random numbers; the nine plane types and their moves; the sphere covered by the right count of tiles; every flip keeps every comma, also along chains; the address reads back; a slider moved in 1 % steps moves every comma in small steps.
- `node tools/browser-check.mjs [--url <url>]` — the built page in Chrome, 22 checks. On 27 Nov 2026: 112 flips over 16 orbifolds leave the print pixel for pixel the same (0.00 % of pixels differ inside 0.8 of the pane); 61 steps undone bring the picture and the address back each time; 15 sliders moved in small steps, none with a step over 1.2 times the usual; hover, click, keyboard and typing; at 390 px nothing wider than the screen and the pattern pinned above the sliders.

## Faults found on the way, each fixed at its root

- **A comma turned by a flip of `2222`.** At its square default a comma's middle lies exactly on a corner of the next pieces, and the way the comma faces was kept against that same corner: the direction to a point from itself. Kept against the farthest corner now (`print.js`).
- **Commas missing near the rim after a pop.** How large a comma is on the screen was asked at its atom's middle; tied to a long new piece, a comma near the pane's middle was judged too small to draw. Asked where the comma is (`view.js`).
- **Commas jumping as a Length moved** (`33∗2` at 1.12 of its first length, by 0.19). The middle of a piece was the centre of the largest circle that fits, found by stepping; in a long piece that circle can sit anywhere along it. The analytic centre instead (`pieces.js` `incentre`).
- **A link that did not read back**: a Twist of −0.5 is written 0.5 (one twist).

## What is not built

- **Two crosscaps for a one-sided handle**: the fourth move a non-orientable surface has. Every crosscap stays cut along its own core.
- **A pop for a cuff between two mirrors with corners**, or between such a mirror and a crosscap.
- **Long cuts.** A move that would make a cuff longer than 9.5 or an arc longer than 6 is turned down, and says so: such a piece is a sliver on the screen and its far end is known to few digits. On surfaces with handles this comes soon (`oo` cut as a theta has a cuff of 7.05; flipping either of the others would make one of 13 or more): shorten the cuts with the sliders first. In 2,880 random flips from the defaults over 17 signatures a fifth were turned down so; over seven signatures with handles, a third of 3,360, and 4 of those failed in the arithmetic (cuffs of 9.3), which the page reports as not flipped.
- **Cone points of order 10 and more**, and signatures longer than 14 characters (the Classification page's parser).
- **The metric is the page's own**: the default numbers are every cuff `2 acosh 2`, every arc `acosh 2`, every Twist 0, not the Classification page's tile. Only the rigid types are drawn as that page draws them.
