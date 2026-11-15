# Ripples — the comma and its echoes

Design `ripple` of the pattern round of 13 Nov 2026 (`dev/patterns/kit.js`). Module: `design.js`. Pictures and numbers:
`~/drive.unsynced/artifacts/the-folding-patterns/ripple/` (OUT below): the standard set of `dev/patterns/README.md`
(`sheet.png`, `rows.json`, `zoom.png`, `back.png`, `app-t0.png`, `app-t06.png`, `app-t1.png`, `app-back.png`,
`app-phone.png`, `app-recut.png`, `app-tile.png`), all of the second run's version. The first run's pictures are
`*.v1.png` and `rows.v1.json`; the critique's are in `OUT/c2/`.

Versions: `design.v1.js` is the designer's (first run). `design.v2.js` is the same file again, the second run's backup
(the first run's critic copied it and changed nothing). `design.js` is the second run's. The critique is
`CRITIQUE.md`. The sections below up to "Rounds" are the designer's account of the first run, except "After the
critique" and "In the fold" at the end.

## The idea

One comma per tile, as on the page, and round it the bands at equal distance from its outline: a light **moat**, a dark
**ring**, and further bands only where the comma's cell is deep. The cell is the set of points nearer to this comma
than to any other copy, so neighbours meet band to band; a thin light **channel** on the cell's border keeps the copies
apart and a light **pool** lies where three or more cells meet. The moat and the ring are the comma, inflated: they
carry its direction and hand, and the plane is covered (dark share 0.52 to 0.58 in all 17 groups).

## The rule

`find(group)` reads `e1, e2, reps, domainArea, center` and, when the group has presets, `presets[0]` (the default
tile). There is no table per group. All lengths below are in tile sizes, `sqrt(domainArea)`.

1. **The tile T.** The default tile; without presets the Dirichlet tile of the point farthest from all its copies.
2. **The metric.** Distances are measured after a linear map A (symmetric, det 1) that the point group allows and that
   makes T at most `ASPECT` = 1.25 times longer than wide, stretching by at most `KAPPA` = 2.4. A is the identity for
   every group with a 3-, 4- or 6-fold centre. So in o, \*\*, xx, \*x, 22\*, 2\*22 the comma and its bands are a
   stretched picture (as the page's comma is in \*x): "equal distance" means equal in that metric.
3. **The seat and the comma.** A small linear program gives, for every turn of the comma (72 turns; 2 in a stretched
   plane, along the long axis) and every stretch of its own (`SIGMAS` 1, 1.2, 1.45; all told at most `STRETCH` = 2.9
   on the paper), the largest comma that fits a seat with its moat (`MOAT` = 0.36 comma radii), the ring's neck
   (`NECK` = 0.055) and half a channel to spare. `SLACK` = 94 % of it is moved to where the seat's deepest corner is
   shallowest. Score = r² σ^`BETA` − `NU` × (bands the deepest corner needs). Three seats are tried:
   - **tile**: T itself (the comma's cell is then about T);
   - **strip**: T when the ringed comma would be under `WIDE` = 0.22 across (only \*x): no ring on the long side the
     comma turns its back to, the comma comes within `GAP` = 0.035 of the channel there;
   - **roomiest**: the Dirichlet tile of the roomiest place of T for a comma that stays inside T (kept `INSIDE` =
     0.02 from T's edge); taken when its score beats the tile's by `ROOMY` = 1.1 (tiles with thin corners).
4. **The distances**, on a grid of step 0.011 in the comma's own frame: the exact signed distance to the comma; the
   distance to every other copy near by, by a look-up in the same grid moved by that element; a mirror's border is its
   line, exactly. The channel (`CHANNEL` = 0.05) is cut at constant width on the paper.
5. **The bands.** Moat, then the ring (`RING` = 0.135), the same all round. Beyond the ring a corner of the cell is,
   by its depth: up to `POOL` = 0.18 a light pool; up to `SWELL` = 0.11 more, the ring swells into it (not at the
   channels) and the pool stays 0.18 deep; deeper, light (`LIGHT` 0.09) and dark (`DARK` 0.15) bands, as few as leave
   a last dark band no deeper than `TIP` = 0.45, which runs on to the corner's tip — the petals round a rotation
   centre or a mirror corner. A tip not worth drawing (`PETAL`) takes the band before it in, or the ring swells.
6. **The outlines.** An opening by a disc of radius `THIN` = 0.02 (no dark piece narrower than 0.04, convex corners
   round, no slivers where a band meets a channel at a flat angle), pieces under `SPECK` = 0.02 tile areas left out,
   marching squares, thinned to 0.0005. The comma is drawn from its own formula.

## The numbers (the sheet of the mini, 13 Nov 2026)

`long` = the comma's length on the paper; `stretch` = the plane's (A) × the comma's own; `dark` = the sheet's number
(the kit samples one lattice cell on a grid along the lattice, which lies along the channels of \*442: 0.583 there);
`area` = the same share from the polygons' areas.

| group | seat | comma r | long | stretch | dark | area | bare ⌀ | solid ⌀ | pts | ms | corners beyond the ring |
|---|---|---|---|---|---|---|---|---|---|---|---|
| o | tile | 0.283 | 0.90 | 1.77 × 1.2 | 0.521 | 0.521 | 0.368 | 0.305 | 607 | 45 | pools |
| 2222 | tile | 0.325 | 0.65 | 1 × 1 | 0.555 | 0.554 | 0.226 | 0.329 | 574 | 31 | pools |
| \*\* | tile | 0.291 | 0.88 | 1.60 × 1.2 | 0.527 | 0.526 | 0.380 | 0.323 | 566 | 22 | pools |
| xx | tile | 0.293 | 0.86 | 1.51 × 1.2 | 0.529 | 0.530 | 0.329 | 0.329 | 618 | 19 | pools |
| \*x | strip | 0.227 | 0.84 | 2.40 × 1.2 | 0.563 | 0.560 | 0.208 | 0.250 | 613 | 52 | 1 band at each end |
| 333 | roomiest | 0.331 | 0.66 | 1 × 1 | 0.570 | 0.570 | 0.217 | 0.339 | 591 | 19 | pools |
| 22x | tile | 0.305 | 0.64 | 1.11 × 1 | 0.516 | 0.518 | 0.380 | 0.323 | 582 | 13 | pools |
| 22\* | roomiest | 0.291 | 0.90 | 2.40 × 1 | 0.537 | 0.536 | 0.380 | 0.272 | 598 | 16 | swell |
| \*2222 | tile | 0.331 | 0.68 | 1.04 × 1 | 0.528 | 0.530 | 0.380 | 0.337 | 514 | 22 | pools |
| 2\*22 | tile | 0.278 | 0.97 | 2.13 × 1.2 | 0.531 | 0.530 | 0.380 | 0.272 | 563 | 16 | swell |
| 442 | roomiest | 0.330 | 0.66 | 1 × 1 | 0.535 | 0.535 | 0.258 | 0.337 | 593 | 19 | pools |
| 632 | roomiest | 0.309 | 0.62 | 1 × 1 | 0.554 | 0.552 | 0.272 | 0.321 | 605 | 25 | 6 petals at the 6-fold centre |
| 3\*3 | roomiest | 0.246 | 0.59 | 1 × 1.2 | 0.563 | 0.574 | 0.329 | 0.303 | 556 | 40 | 1 band |
| \*333 | tile | 0.294 | 0.59 | 1 × 1 | 0.561 | 0.556 | 0.429 | 0.319 | 523 | 39 | petals at two corners, swell at the third |
| 4\*2 | roomiest | 0.293 | 0.59 | 1 × 1 | 0.534 | 0.531 | 0.429 | 0.295 | 497 | 22 | swell |
| \*442 | tile | 0.287 | 0.57 | 1 × 1 | 0.583 | 0.563 | 0.354 | 0.295 | 520 | 32 | 8 petals at each 4-fold corner |
| \*632 | tile | 0.260 | 0.62 | 1 × 1.2 | 0.535 | 0.545 | 0.430 | 0.319 | 531 | 44 | 1 band + 12 petals at the 6-fold corner, petals at the 3-fold |

Ranges: dark 0.516 to 0.583 (by area 0.518 to 0.574); bare ⌀ 0.208 to 0.430; solid ⌀ 0.250 to 0.339; 497 to 618
vertices; 13 to 52 ms (Chrome on the mini; 35 to 100 ms in node on the Intel). Copies of the motif keep 0.050 apart
(the channel; the rule is 0.02); the polygons of one motif keep 0.053 or more apart (the moat, a light band). Dark
pieces: the comma 0.10 to 0.17 of the tile, the ring 0.36 to 0.40, a petal or band 0.026 to 0.25.

## What was checked, and how

- `proto.mjs` on the mini: `sheet.png`, `zoom.png` (1.8), `back.png` (sand), `rows.json`. Looked at each.
- `lab/check.mjs`: no polygon crosses itself, holes lie in an outer polygon, the gap between copies, find() twice
  gives the same motif. All 17, with presets, without (`--bare 1`), and turned / scaled / shifted (`--turn`).
- `lab/prod.mjs`: `makeShapePrint` + `validateShapes` + `measureShapes` of `src/shapes.js` (the production module that
  appeared during the round): all 17 pass, with presets and carried; stabiliser 1; overlap 0.
- `lab/stress.mjs`: 69 lattices the page does not have (the nine stretchable groups under stretches up to 2.6 and
  shears), no presets: no error, no overlap, dark (by area) 0.46 to 0.58, solid ⌀ at most 0.37; bare ⌀ over 0.45 in
  one of them (0.464, a long xx).
- `lab/turned.mjs`: a turned, scaled, shifted group (no presets) gets the turned, scaled, shifted motif, to 2e-12
  tile sizes in all 17 (the grid lies in the comma's own frame; ties are broken along the lattice).
- `lab/preview.mjs`: the same sheet drawn by a small rasteriser in node (the many looks in between);
  `lab/debug.mjs`: the grid of one group (cell, corners, tone).

## What is weak

- **The comma itself is smaller than the page's**: 10 to 17 % of the tile (the page's: 30 %). The mark that fills the
  tile is the comma with its ring; the light moat is what the eye reads first.
- **Six cells are not the default tile** (333, 22\*, 442, 632, 3\*3, 4\*2: seat `roomiest`). The tile holds the whole
  comma and its moat there, but the ring is cut by the tile's edge and slices of the neighbours' rings lie in the tile.
- **Stretched planes** (o 2.1×, \*\* 1.9×, xx 1.8×, 22\* 2.4×, 2\*22 2.6×, \*x 2.9× in all): comma and bands are a
  stretched picture; a band is up to 2.4 times wider along the tile than across it. In **\*x** the ring is open on
  the side of the comma's back (the strip is 0.43 wide; a full ring left a comma 0.19 across).
- **Thin corners** are busier than the rest: 12 petals and an arc band round the 6-fold corner of \*632, 8 petals
  round the 4-fold corners of \*442, 6 small petals (0.036 tile areas each) at the 6-fold centres of 632.
- **Corners of one cell can differ in kind** (\*333: petals at two corners, a swollen ring and a pool at the third),
  and the kinds flip at thresholds: a small change of a lattice can turn a pool into a swollen ring or a petal, or
  change the seat.
- **Pools up to 0.43 across** (target 0.45; 0.436 without presets), unevenly sized where one corner holds several
  vertices of the cell.
- **Without presets the motif is another one** wherever the default tile is not the roomiest tile of the group (most
  visibly 22x, 22\*, 2\*22, 632, 3\*3, 4\*2: the comma need not lie in a default tile, the cells are rounder, 3\*3's
  comma is 0.31 instead of 0.25). Both pass every check.
- **Band to band across a channel** is exact for moat and ring. For a deep corner's bands it holds where the corner is
  a rotation centre or a mirror corner (every banded corner on the page but \*x's ends, which are one corner of the
  cell running round the comma's back); two different corners meeting at a generic vertex are not reconciled.
- The ring's neck is 0.055 at its thinnest; round corners (radius 0.02) have three or four vertices each.
- **Not verified**: the page itself (the fold in 3D, a tile 60 px across, a phone) — the design is not integrated.

## What I would try next

- One pool per vertex of the cell (a watershed of the depth) and pools reconciled across cells (a union-find over the
  borders), so pools are even and deep-corner bands always agree.
- A closing after the opening, to round the notch the hollow of the comma leaves on the ring's outer edge.
- A comma whose tail lengthens into a thin corner, instead of petals there.
- The seat chosen among more places of the tile by the measured numbers, not by the fit's score.

## Rounds

1. *o, 2222, 442, 333.* Saw: equal bands with a smooth-min corner gave specks in every deep corner; a "pebble" variant
   (ring out to a pool at each corner) was calm but heavy and lost the echo. Changed: one ring of constant width, pools
   beyond; the fit moves the comma to balance the corners; an opening instead of smooth minima.
2. *All 17.* Saw: the ringed comma of \*x was a needle; webs of small arcs round the 6-fold centres of 632, 3\*3,
   \*632. Changed: the metric map A (cap 2.4) and a cap on the total stretch; the seat at the roomiest place of the
   tile; as few corner bands as leave a tip up to 0.45, the tip to the corner.
3. *The worst three (\*x, 3\*3, 632 / \*632).* Saw: \*x's ring caps were lumps; 3\*3's comma 0.45 long. Changed: \*x
   half-ringed (open at the comma's back); the roomiest place counts the tile's own edge, so 3\*3's comma is 0.59
   long and 4\*2 has no petals; tips only when worth drawing.
4. *Polish.* Saw: dark share 0.61 in 3\*3; "ears", then a saw-toothed edge, where a slightly swollen ring met a
   channel (the ring below the swell did not know of it, and the opening ate the thin band); a 0.006 speck in \*632;
   a turned group got a comma seated 0.01 to 0.13 elsewhere. Changed: channel 0.05, ring 0.135, pool 0.18; the swell
   fades at the channels and is carried into the ring below it; pieces under 0.02 left out; tolerances relative to
   the tile; the fit's search along the comma's own axes and ties broken along the lattice (a turned group now gets
   the turned motif to 2e-12).

## After the critique (second run, 13 Nov 2026)

The critique is `CRITIQUE.md`. The concept, the seat and the fit, the comma (the page's, head 0.5) and every knob of
the first run are kept. What changed is how clean the field is, and the deepest narrow corners. All of it is behind
knobs: `EXACT: false, BLUR: 0, PETAL0: 0.008` give `design.v1.js`'s motif bit for bit (`lab/same.mjs`, all 17).

1. **The saw-tooth** (finding 1). Seen with `lab/fields.mjs`, the grid of one group, its corners, labels and medial
   axis. Two faults in the field:
   - the ring points that carry a corner's swell were labelled from the swollen corners alone, so the labels ran
     round the whole ring. Beside a pool that does not swell, the field jumped between neighbouring grid points: one
     tooth per grid step, along the ring's edge beside the comma's hollow.
   - the paper width was divided by |grad d1|, which is short on the medial axis of the comma's outside.

   Changed: every corner seeds the labels; the gradient is used by its direction only; a light blur (`BLUR` 1, a
   5-tap binomial each way); the channel is measured exactly (`exactChannel`: the distance on the paper to the zero
   line of mn, the cell's border).
2. **Scallops and the crease** (finding 1, the rest). The opening, done with cones of a field that is only nearly a
   distance, scalloped every narrow stretch of the ring (\*\*: its inner edge on the right flank). The offset of the
   comma's hollow left a sharp crease on the ring's outer edge. Changed (`morph`, `levelDistance`):
   - the field is first made a true signed distance on the paper (the exact distance to its zero line);
   - then it is CLOSED (the light tone opened by a disc of radius `CLOSE` = 0.03: no light sliver, the crease
     round) and OPENED (the dark tone, radius `THIN` = 0.02, as before), both by distances to the eroded set's
     outline.

   A first try without the re-distancing grew teeth everywhere; that was undone.
3. **The asterisks** (finding 2). A corner deep enough for bands, whose single tip would be smaller than `PETAL0` =
   0.03 tile areas, is a WEDGE: the ring fills it unfaded, and the pool at its tip stays `POOL` deep. These corners
   are the 60° wedges round the 6-fold centres of 632, the 3-fold corner of \*632 and two corners of \*333. With
   the fade of an ordinary swell, the swell came to nothing in a narrow wedge (bare 0.53 round 632's 6-fold
   centres): the fade is for wide corners, and keeps their ring an even echo. Corners with bands keep the first
   run's test (`PETAL` 0.008), so \*632 keeps its two bands.
4. The hint is shorter: "a comma and its echoes: bands at equal distance from it".

Tried and undone (`lab/try.mjs`, the numbers in node):

- `SWELL` 0.2: every corner up to 0.38 deep swells. \*x lost the echo at its ends (a pill shape, bare 0.464).
- No fade anywhere: lower bare discs everywhere, but every ring was lumpy and the echo lost its even width.
- `PETAL` 0.03 for every band count: \*632 lost a band (dark 0.615 by the sheet, 0.627 by area).
- `MOAT` 0.3 + `RING` 0.12: the comma only 5 % larger; \*333 0.622 dark, and 632's star came back.
- `HEAD` 0.58: comma area +9 %; \*632 0.622 by area; 3\*3 and \*632 switched to a stretched comma.
- `KAPPA` 1.7 and 1.3: less stretch of the plane only moved it into the comma's own (σ 1.45); \*x and 22\* over 0.62.

So the comma's share of the tile and the stretch in the long tiles are the concept's own limits. They are not knobs
left untried.

### The numbers (the sheet of the mini; first run → now)

| group | dark | bare ⌀ | solid ⌀ | pts | ms (Chrome) |
|---|---|---|---|---|---|
| o | 0.521 → 0.521 | 0.368 → 0.368 | 0.305 → 0.305 | 607 → 595 | 35 → 60 |
| 2222 | 0.555 → 0.553 | 0.226 → 0.226 | 0.329 → 0.329 | 574 → 552 | 31 → 39 |
| \*\* | 0.527 → 0.525 | 0.38 → 0.38 | 0.323 → 0.323 | 566 → 562 | 25 → 36 |
| xx | 0.529 → 0.529 | 0.329 → 0.329 | 0.329 → 0.329 | 618 → 603 | 19 → 27 |
| \*x | 0.563 → 0.562 | 0.208 → 0.208 | 0.25 → 0.25 | 613 → 606 | 27 → 34 |
| 333 | 0.57 → 0.57 | 0.217 → 0.217 | 0.339 → 0.339 | 591 → 569 | 19 → 25 |
| 22x | 0.516 → 0.516 | 0.38 → 0.38 | 0.323 → 0.323 | 582 → 542 | 13 → 20 |
| 22\* | 0.537 → 0.537 | 0.38 → 0.38 | 0.272 → 0.272 | 598 → 584 | 18 → 23 |
| \*2222 | 0.528 → 0.529 | 0.38 → 0.38 | 0.337 → 0.337 | 514 → 523 | 21 → 33 |
| 2\*22 | 0.531 → 0.531 | 0.38 → 0.38 | 0.272 → 0.272 | 563 → 569 | 16 → 36 |
| 442 | 0.535 → 0.536 | 0.258 → 0.258 | 0.337 → 0.337 | 593 → 596 | 19 → 25 |
| 632 | 0.554 → 0.579 | 0.272 → 0.385 | 0.321 → 0.323 | 605 → 539 | 25 → 37 |
| 3\*3 | 0.563 → 0.564 | 0.329 → 0.329 | 0.303 → 0.303 | 556 → 556 | 41 → 48 |
| \*333 | 0.561 → 0.597 | 0.429 → 0.386 | 0.319 → 0.319 | 523 → 468 | 50 → 34 |
| 4\*2 | 0.534 → 0.535 | 0.429 → 0.429 | 0.295 → 0.295 | 497 → 489 | 20 → 26 |
| \*442 | 0.583 → 0.582 | 0.354 → 0.354 | 0.295 → 0.295 | 520 → 536 | 29 → 33 |
| \*632 | 0.535 → 0.592 | 0.43 → 0.385 | 0.319 → 0.319 | 531 → 497 | 34 → 40 |

Ranges now: dark 0.516 to 0.597; bare ⌀ 0.208 to 0.429; solid ⌀ 0.25 to 0.339; 468 to 606 vertices; 20 to 60 ms in
Chrome (a second run of the same code gave up to 78 ms; the mini is shared). By polygon area (`lab/prod.mjs`) the
darkest is \*632 at 0.603.

The bare disc of 632 rose from 0.272 to 0.385. A calm pool round each 6-fold centre took the place of the star of
six petals that filled it.

### What was checked, and how

- `lab/check.mjs`, with presets, `--bare 1` and `--turn 0.7`: all rules kept. Copies keep 0.0499 to 0.050 apart; the
  pieces of one motif keep 0.052 or more apart; no polygon crosses itself; holes lie inside.
- `lab/prod.mjs` (`validateShapes` and `measureShapes` of `src/shapes.js`): all 17 pass, stabiliser 1, overlap 0.
- `lab/turned.mjs`: a turned, scaled and shifted group without presets gets the turned motif, to 1.1e-13 tile sizes.
- `lab/same.mjs`: the first run's knobs give `design.v1.js` bit for bit.
- The app (`app-sheet.mjs --json`, t = 0, 0.6, 1): all 17 take the print, with no page error and no validateShapes
  problem.
- Looked at every picture of the standard set and the critique's (`OUT/c2/`).
- Not run: the test suite (`dev/patterns/suite.sh`). No test touches the designs, and no file outside
  `designs/ripple/` was changed.

New tools in `lab/`: `fields.mjs` (the grid of one group: corners, the swell's labels, the medial axis, the tone),
`same.mjs`, `timing.mjs`, and `deliver.sh` (the standard set, one browser at a time).

## In the fold (second run)

What `app-t0.png`, `app-t06.png`, `app-t1.png`, `app-back.png`, `app-phone.png`, `app-recut.png` and `app-tile.png`
show, and the critique's closer looks (`OUT/c2/v1-fold-t0.png`, `v1-fold-t1.png`, `v2b-fold-t1.png`):

- **Which side is up is always plain**: teal is the front, sand the back, as with the checkerboard. The marks are big;
  the 3D picture is calmer than the checkerboard's, with fewer edges, but there is less fine texture to read the
  bending by.
- **Flat (t = 0)** the tile is the comma in its ring, in teal, in all 17. The edges are now clean at the app's size;
  the first run's wobble at xx's top right and along 442's bottom is gone.
- **The kaleidoscopes** fold onto the tile, and their sand side shows the tile's own print (\*2222, \*333, \*442,
  \*632, 3\*3, 4\*2): the comma in its ring reads best of all here.
- **The rolls.**
  - The \*x Möbius band shows its teal side, with the swirls and the channels; the best of the rolls.
  - The 22x cross-cap is teal, with a big swirl across its seam.
  - The xx Klein bottle shows teal and sand halves.
  - The torus (o) is sand: its stretched ring becomes broad stripes round the tube, and the comma's head and tail
    cannot be told apart there.
- **The pillows** (2222, 333, 442, 632, and 22\*, 2\*22 at t = 0.6) mostly show the sand side in the default view:
  broad arcs of the ring, low contrast; the comma's hand is hard to read.
- **Re-cut first** (xx Hexagon at "re-cut 3/3: glide", 22x Bowl): the print stays in register on every moving piece,
  and the marks join across the seams. The Tile step's cards carry the print, and the commas turn from card to card.
- **What remains weak**:
  - on the sand side and on the rolls, the echo (the ring and the moat) is what one sees, not the comma, which covers
    10 to 17 % of the tile;
  - stretched kidneys and fish in o, \*\*, xx, 22\*, 2\*22 and \*x;
  - \*632's 6-fold corner keeps a target of two arc bands and twelve tips, and \*442's 4-fold corners keep eight
    petals each;
  - where the ring fills a wedge, it is lopsided: 632's rings send a horn into each 6-fold centre.
