# Big comma — notes

Design module: `dev/patterns/designs/bigcomma/design.js` (`meta`, `find(group)`, `KNOBS`).

Pictures are in `~/drive.unsynced/artifacts/the-folding-patterns/bigcomma/`. The standard set, fresh from the second run
(13 Nov 2026): `sheet.png`, `rows.json`, `zoom.png`, `back.png`, `app-t0.png`, `app-t06.png`, `app-t1.png`,
`app-back.png`, `app-phone.png`, `app-recut.png`, `app-tile.png`. The designer's pictures are kept as `*.v1.png` and
`rows.v1.json`. The critique's pictures and checks are in `crit/`.

`CRITIQUE.md` (here) holds the art director's findings on the designer's version. `design.v1.js` is that version, byte for
byte. Set `KNOBS.grow = false` to get it back from `design.js`.

## After the critique (second run, 13 Nov 2026)

Three findings drove the changes: no nesting (a comma in a box), speckle (up to three dots per tile), and teardrops in the
triangles. What changed, and why:

1. **The comma grows against its copies, not against the walls of its room.** This is the concept's nesting. The fits of
   the room are now only starting points: the designer's chosen fit, plus the largest fit of each class (classic,
   curled, flat). Each grows by a pattern search over position, turn, tail length and back angle, its head radius always
   as large as its copies allow (one channel, `dotGap` = 0.064 tile sizes, to every other copy). Where a neighbour leaves
   room, in its bay or in a corner it does not use, the comma crosses the side of its tile. So the tail of one lies in
   the hollow of the next. A mirror is still a wall, because the comma's mirror image is a copy. The distances come from
   an exact signed distance to the three arcs, so the search is cheap.
   - The growth stops at a dark share of `capD` = 0.57. It then spreads the comma out (the channel to spare counts), and
     steers clear of bare patches at the rotation centres: the copies round a centre all stand as far from it as the
     comma stands from the centre's orbit, so that patch is cheap to watch.
   - On the page, at most a fifth of the comma's outline may leave the default tile (`outMax`), so that tile still holds
     the comma but for the end of its tail (criterion d). Measured: 78 to 85 % of the outline in the nesting groups,
     100 % where mirrors wall the comma in.
2. **Dots must earn their place.** The first dot goes to the comma's own bay, the yin-yang's dot at the centre of the
   belly circle, and only when that bay is open (a nesting neighbour's tail may fill it) and a patch above the goal is
   left. A second dot only where a patch above the goal still remains (in practice a mirror corner). Never a third.
   - The grown commas are ranked by curl (0.3), dots (-0.06 each) and bare patch. Any dark share from 0.46 to 0.58 counts
     the same: more dark is not better, calm is.
   - Totals: 27 dots over the 17 groups before, 20 now. o, 2222, ×× and 22× have none. No group has three.
3. **Curled commas where they fit.** The largest curled fit is always among the starts. 333 became a pinwheel of curled
   commas round its 3-fold centres. 632 became a six-armed whirl instead of a starburst of drops.
4. **The same pattern wherever the group lies.** Nesting first broke this for \*\* and ×× (check.mjs: "not the moved
   pattern"). Rounding decided three things:
   - the designer's linear programme pins a comma exactly one channel from its mirror image, so "channel ≥ c" was a coin
     toss;
   - a hill climb probing along e1 sat on the mirrors of \*442;
   - near-equal fits came in a different order.

   Now every threshold carries a tolerance of 1e-9 tile sizes, my climbs probe 17° off e1, and ties go to the first
   hand and the least turn from e1. All 68 cases (17 groups, as the page has them, as the tests hand them over, and at
   two turned, scaled, shifted places) give the moved pattern to 1e-12 (`crit/check-ids.mjs`, logs in
   `OUT/crit/check-final-*.txt`).
5. **Tried and dropped.**
   - Larger dots in the mirror groups (caps 0.18 tile sizes and 0.5 head radii): no fewer dots, and \*442 switched to a
     worse comma (bare 0.49).
   - A dark cap of 0.55: slightly wider channels, slightly larger bare patches, no fewer dots. 0.57 is kept.
   - Four starts (adding the next best evaluated fits): no better in the groups I logged, slower, and the source of
     the moved-pattern faults (see 4).

### The numbers (the official sheet, proto.mjs on the mini's Chrome, `rows.json`; lengths in tile sizes)

| group | dark | bare ⌀ | solid ⌀ | pts | ms | nests | dots |
|---|---|---|---|---|---|---|---|
| o | 0.57 | 0.28 | 0.48 | 400 | 50 | yes | 0 |
| 2222 | 0.57 | 0.41 | 0.53 | 350 | 30 | yes | 0 |
| \*\* | 0.54 | 0.45 | 0.45 | 463 | 29 | no (the copies along the strip leave no room) | 2 |
| ×× | 0.57 | 0.32 | 0.51 | 376 | 30 | yes | 0 |
| \*× | 0.52 | 0.43 | 0.36 | 502 | 42 | no (5.3 : 1 between mirrors) | 2 |
| 333 | 0.58 | 0.33 | 0.49 | 432 | 27 | yes | 1 |
| 22× | 0.57 | 0.39 | 0.53 | 355 | 18 | yes | 0 |
| 22\* | 0.54 | 0.42 | 0.42 | 455 | 47 | along the strip | 1 |
| \*2222 | 0.57 | **0.53** | 0.51 | 381 | 29 | walled | 1 |
| 2\*22 | 0.48 | 0.41 | 0.40 | 457 | 29 | no | 2 |
| 442 | 0.57 | 0.40 | 0.50 | 401 | 18 | yes | 1 |
| 632 | 0.58 | 0.41 | 0.46 | 465 | 39 | yes | 1 |
| 3\*3 | 0.53 | 0.39 | 0.43 | 466 | 44 | a little | 2 |
| \*333 | 0.56 | 0.42 | 0.39 | 456 | 23 | walled | 2 |
| 4\*2 | 0.54 | 0.43 | 0.40 | 419 | 37 | no | 1 |
| \*442 | 0.56 | 0.40 | 0.40 | 451 | 30 | walled | 2 |
| \*632 | 0.55 | 0.37 | 0.44 | 471 | 33 | walled | 2 |

Worst over the 17:
- dark 0.475 (2\*22) to 0.581 (632); bare ⌀ 0.531 (\*2222), next 0.447 (\*\*); solid ⌀ 0.531 (22×); 502 points (\*×);
  50 ms on the mini's Chrome (o; 150 ms in node on the Intel);
- overlap 0 everywhere; the smallest channel between copies 0.061 (3\*3; production `validateShapes`, 34 cases ok,
  stabiliser 1 everywhere, so each print's group is exactly its wallpaper group).

The designer's version for comparison: dark 0.45 to 0.58, bare ⌀ at most 0.42, 27 dots.

### Still weak

- **The mirror groups are much as the designer left them.** A comma walled in by mirrors cannot nest. With one tip it
  reaches one corner of its chamber, so the other corners need a dot or stay bare:
  - \*333, \*442, \*632 and 3\*3 keep two dots and flat drops, and \*442's second dot is a 0.12 speck;
  - \*2222 keeps one dot and pays with a bare patch of 0.53 at the mirror corners (target 0.45, limit 0.6).
- **\*× is still a comet** (head 0.37, 2.2 long) with two dots: a 5.3 : 1 room between mirrors leaves no width to curl in.
- **4\*2 and 3\*3 stay flat drops**: their curled starts leave bare patches of 0.47 to 0.53.
- **Criterion d is now a compromise in the nesting groups.** The default tile holds most of a comma, all but the end of
  its tail, plus the tip of a neighbour's tail at a corner (a sliver).
- **Cost:** find takes up to 50 ms on the mini (35 before), 60 to 150 ms in node on this Mac.

## In the fold

What I saw in `app-t0/t06/t1.png`, `crit/fold-t06.png` and `crit/fold-t1.png` (the 3D pane alone, full size), and in
`app-back`, `app-phone`, `app-recut` and `app-tile`:

- **Flat (t = 0)** the tile in the 3D pane shows one big comma with its eye in every group. In the nesting groups the
  comma's tail runs off one side of the tile, and the tip of a neighbour's tail comes in at another.
- **Marks join across the seams.** Where the commas nest, a tail cut by a seam meets its comma again when the seam
  closes. The torus at t = 1 shows the commas as continuous bands through both seams; the designer's boxed commas never
  crossed a seam. The cross-cap (22×) and the tube (\*\*) carry one whole comma with its eye, readable at 0.6 and 1. The
  kaleidoscopes close flat on their chamber at t = 1, the comma and its dots fully in view.
- **Which side is up:** at 0.6 most pillows and cones (2222, 333, 442, 632, 22\*, 2\*22, 3\*3, 4\*2) show the sand side.
  The marks read there as big blobs with a light eye, but at a lower contrast than the teal side.
- **Weak:**
  - on the torus tube at t = 0.6 and on the Klein bottle the comma becomes a broad band with no head or tail;
  - on the pillows at 0.6 one sees blobs, not commas;
  - the extra dots of the mirror groups become specks on a phone (\*×, \*632 in `app-phone.png`).

  The fold is calmer than the checkerboard (one big shape per face against dozens of checks), but no clearer than the
  designer's version: the gains of this round are in the plane.
- **The re-cut (×× Hexagon, 22× Bowl at t = 0.25)** lands in register, and the pieces close into the home tile's whole
  comma. The Tile step's cards carry the print. No page errors, and no `validateShapes` problems in any app run.

## Files of the second run

- `CRITIQUE.md`: the findings on the designer's version, worst first.
- `crit/check-ids.mjs`: the designer's `check.mjs` for a list of groups (`--ids '333,*x'`), so that one run stays short.
- `crit/timing.mjs`: what find spends its time on, and what each start became (`KNOBS.debug`).
- `crit/eqdbg.mjs`, `crit/roomeq.mjs`: where a moved group's motif differs from the moved motif.
- `crit/rooms.mjs`: the first critic's look at the rooms of `design.v1.js`.

---

# The designer's notes (first run, design.v1.js)

## The idea in three sentences

Every tile carries ONE comma, drawn the way a yin-yang is drawn — three circular arcs: a round head, a back arc that
holds the head, a belly arc that touches it from outside — and made as large as its room (the tile) allows: long where
the tile is long, its tail's tip sent into a corner, curled where there is room to curl.
The yin-yang's two small details finish it: a light eye in the head, and a dark dot of about the eye's size in the bay
(a second or third dot only where a patch of the plane would otherwise stay bare).
Everything keeps one channel width (0.064 tile sizes) from everything else, so the print is calm: big dark shapes, one
width of light line between neighbours, and the head, the tip and the dots mark different places of the tile.

## The rule (nothing is tabulated per group)

1. **The room** is one tile of the group, a convex polygon. With `group.presets`: the page's default tile
   (`buildDomain` of `presets[0]`), so the default tile holds the WHOLE comma (all 17: 100 % of its outline inside).
   Without presets (the tests): the roundest Dirichlet tile — the seed farthest from the rest of its orbit, ties
   (a strip) broken by the second and third neighbours. Rectangles for the strips, the regular hexagon for 333, the
   Cairo pentagon for 442, the floret pentagon for 632, the chamber for a kaleidoscope.
2. **The comma** (`unitComma(lam, ab, tau)`): head = the unit circle, tip at distance `lam`; the back is the circle
   through the tip that holds the head and touches it, leaving the tip at the angle `ab` from the axis; the belly is
   the circle through the tip that touches the head from outside, leaving the tip at `ab − tau`. `ab = 90°, lam = 3,
   tau = 0` is the classic half of a yin-yang; a smaller `ab` flattens the back, a larger `lam` lengthens the tail,
   `tau` (fixed, 16°) opens the tip so the tail is no hairline. Every such outline is simple and smooth but for the tip.
3. **The fit**: for a shape and a turn, the largest copy inside the room (every mark `margin` inside it) is a linear
   programme in (x, y, size), solved exactly at its vertices. A scan over 66 shapes × 72 turns, then a pattern search
   over the turn, `lam` and `ab`, gives the largest comma of a class. Classes: **classic** (`ab = 90°`), **curled**
   (the back rises ≥ 1.45 head radii above the axis), **flat** (less). Each class is fitted free and with the tip
   pinned into each corner of the room (one more row of the programme), in both hands: 24 to 42 candidates.
4. **The choice**: for each candidate the dots are placed and the largest bare disc of the PLANE is measured (points of
   the room, its rim and its corners against the comma, the dots and their copies in the neighbouring rooms); worth =
   0.5 × dark share + 0.1 × curl − 4 × (bare ⌀ above 0.41) − (dark outside 0.44 … 0.58) − 0.03 per extra dot. The best
   wins; a room with a symmetry of its own has several equal bests (images of one another): the first hand, turned
   least from e1 — so a turned, scaled, shifted group gets the same pattern turned, scaled and shifted.
5. **The dots**: a dot goes where the largest bare patch is (the largest disc that fits there, at most 0.4 head radii
   and 0.14 tile sizes; the first dot otherwise where the largest dot fits), up to three; a dot that does not make the
   largest patch smaller is taken out again (never the largest: the yin-yang's own).
6. **The eye**: a hole of 0.36 head radii at the head's centre, larger (up to 0.5) where the print would be darker
   than 58 %.

### Knobs (`KNOBS`, lengths in tile sizes)

| knob | value | what |
|---|---|---|
| `margin` / `dotGap` | 0.032 / 0.064 | every mark stays `margin` inside its room; a dot `dotGap` from the comma: channels of 0.064 everywhere |
| `tip` | 16° | the angle of the tail's tip |
| `backMax`, `curled` | 2.1, 1.45 | how high the back may rise above the head → tip axis (head radii); from where a comma counts as curled |
| `eye`, `eyeMax` | 0.36, 0.5 | the eye's radius in head radii |
| `dotMin`, `dotMax`, `dotCap`, `dots` | 0.06, 0.4 head radii, 0.14, 3 | the dots |
| `bareGoal` | 0.41 | a bare patch up to this diameter costs nothing |
| `darkMin`, `darkMax` | 0.44, 0.58 | the dark share that costs nothing |
| `step` | 0.012 | segment length of the outline |
| `roundRoom` | false | true: the roundest tile also on the page (`alt-round-rooms.png`): rounder commas in 22∗, 2∗22, 632, 3∗3, 4∗2, 442 — but the default tile then holds slices of two commas |

## The numbers (the official sheet, `proto.mjs` on the mini's Chrome, `rows.json`; lengths in tile sizes)

| group | dark | bare ⌀ | solid ⌀ | pts | ms | comma: head ⌀, length, shape | eye ⌀ | dots ⌀ |
|---|---|---|---|---|---|---|---|---|
| o | 0.49 | 0.40 | 0.43 | 406 | 50 | 0.55, 1.49, curled, tip in a corner | 0.20 | 0.19 |
| 2222 | 0.58 | 0.37 | 0.51 | 405 | 21 | 0.65, 1.07, classic, tip in a corner | 0.23 | 0.26 |
| \*\* | 0.54 | 0.38 | 0.45 | 463 | 18 | 0.57, 1.39, curled, tip in a corner | 0.21 | 0.21, 0.22 |
| xx | 0.51 | 0.40 | 0.45 | 404 | 16 | 0.60, 1.35, curled, tip in a corner | 0.22 | 0.21 |
| \*x | 0.51 | 0.40 | 0.36 | 500 | 13 | 0.37, 2.19, flat, tip in a corner | 0.13 | 0.15, 0.15 |
| 333 | 0.58 | 0.32 | 0.42 | 418 | 10 | 0.80, 1.33, flat, tip in a corner | 0.29 | 0.23 |
| 22x | 0.55 | 0.39 | 0.52 | 385 | 11 | 0.61, 1.13, classic, tip in a corner | 0.22 | 0.15 |
| 22\* | 0.45 | 0.41 | 0.36 | 451 | 13 | 0.41, 1.75, curled, tip in a corner | 0.15 | 0.16, 0.15 |
| \*2222 | 0.58 | 0.35 | 0.50 | 487 | 18 | 0.60, 1.09, classic, tip in a corner | 0.24 | 0.17, 0.16, 0.22 |
| 2\*22 | 0.47 | 0.41 | 0.40 | 453 | 14 | 0.47, 1.59, curled, tip in a corner | 0.17 | 0.19, 0.18 |
| 442 | 0.53 | 0.42 | 0.48 | 386 | 13 | 0.62, 1.02, classic | 0.22 | 0.25 |
| 632 | 0.50 | 0.36 | 0.43 | 423 | 10 | 0.58, 1.63, flat | 0.21 | 0.23 |
| 3\*3 | 0.52 | 0.33 | 0.43 | 470 | 14 | 0.58, 1.63, flat | 0.21 | 0.23, 0.18 |
| \*333 | 0.56 | 0.42 | 0.39 | 457 | 14 | 0.74, 1.22, flat, tip in a corner | 0.27 | 0.28, 0.21 |
| 4\*2 | 0.54 | 0.40 | 0.40 | 419 | 14 | 0.72, 1.34, flat, tip in a corner | 0.26 | 0.28 |
| \*442 | 0.56 | 0.40 | 0.40 | 451 | 16 | 0.72, 1.34, flat, tip in a corner | 0.26 | 0.28, 0.12 |
| \*632 | 0.55 | 0.37 | 0.44 | 471 | 14 | 0.60, 1.76, flat, tip in a corner | 0.22 | 0.16, 0.16 |

Worst over the 17: dark 0.45 (22∗) … 0.58 (333, 2222, ∗2222); bare ⌀ 0.42 (442, ∗333); solid ⌀ 0.52 (22×); 500 points (∗×);
50 ms (o, the first call: it builds the shape tables; 10 – 21 ms after that); overlap 0 everywhere; the smallest gap
between two copies 0.064. (The kit's dark share is measured over one lattice cell since 16:58 on 13 Nov; these are the
numbers of the final run.) The baseline comma through the same kit: dark 0.19 – 0.31, bare ⌀ 0.69 – 2.0.

What was checked, and how (`node dev/patterns/designs/bigcomma/check.mjs [--measure 1]`, 68 cases: the 17 groups as
the page has them, as the tests hand them over (no presets), and at two turned, scaled, shifted places):
no self-crossing, the eye inside the comma, segments ≤ 0.021, ≤ 2400 points, smallest distance between copies
(exact, polygon to polygon) 0.064 … 0.11, kit overlap 0, and the moved group's pattern = the moved pattern (outlines
within 0.005 tile sizes; 1e-13 in most). Without presets: dark 0.49 – 0.58, bare ⌀ ≤ 0.43, solid ⌀ ≤ 0.51 (kit,
56 samples per tile). The design's own bare-patch number agrees with a 0.004-fine raster to ±0.015; the kit's is up
to 0.025 higher (its grid), hence `bareGoal` 0.41 for a target of 0.45.
NOT checked: the print inside the page (the 3D shader, the plane pane) — the design is only a motif so far.

## What is weak

- **No nesting.** Each comma stays inside its own convex tile, so the tail of one never lies in the hollow of the
  next; the bay is filled by the dot instead. That is what keeps the whole comma in the default tile, but in the
  rotation groups a real tomoe (commas chasing one another round a centre) would be the stronger picture.
- **The triangles get flat commas** (333's rhombus, 632, 3∗3, ∗333, 4∗2, ∗442, ∗632): a teardrop with a hooked belly,
  its tip in the sharp corner. Its hand is there (one side convex, one concave, the head against one wall) but weaker
  than the curl of the commas in the rectangles and the hexagon.
- **Two or three dots in 9 groups** (∗∗, ∗×, 22∗, ∗2222, 2∗22, 3∗3, ∗333, ∗442, ∗632): one is the idea, the others
  are there for the bare-patch target. ∗2222 has three; ∗442 has one small corner dot (⌀ 0.12, the smallest mark).
- **∗× and 22∗ are thin**: the tile is 5.3 and 3.3 times as long as wide, so the comma is a long comet (head ⌀ 0.37
  and 0.41); 22∗ is the lightest print (43 %).
- The pattern of the page depends on `presets[0]` (the room is the default tile): if a default cut changes, the
  pattern changes with it. `KNOBS.roundRoom` removes that dependence at the price named above.
- A candidate is judged on a sample grid (0.055 tile sizes) with local refinement: a bare patch can be off by 0.015.

## What I would try next

1. Nesting for the groups with rotation centres off the mirrors: n commas round an n-fold centre, the belly of each
   an arc round the next one's head (then the channel is even by construction), found by the same kind of search but
   with the true distance to the copies instead of "inside the room" — and then decide, with the owner, whether a tile
   that holds most of a comma and a slice of the next still "holds a whole mark".
2. Candidates with the tip in one corner AND the head pushed toward another (one more row of the programme): fewer
   dots in the triangles.
3. A last pattern search on the true worth (bare patch and all) from the best candidate, about 30 ms more.
4. Ask the owner about `alt-round-rooms.png`: it is the prettier sheet in six groups and the worse one for the fold.

## Rounds

1. *Four easy groups (o, 2222, 442, 333), largest area in the room.* Saw fat blobs with stub tails (the search took
   the fattest shape allowed). Fixed the tip angle (16°), bounded how high the back may rise (the classic's
   proportions), `lam ≥ 2.3`: yin-yang commas, 49 – 60 % dark.
2. *All 17.* Saw bare discs up to 1.17 where a round comma leaves a sharp corner empty (∗632, ∗333, ∗442, the flat
   triangles), and bays doubled by a mirror (∗∗). Added the candidates with the tip pinned into each corner and chose
   by the bare disc of the plane, measured against the neighbours; dots where the largest patch is.
3. *The worst three (∗2222, ∗442, ∗632) and the look.* Tried "pressing" the back toward the walls (a soft morph of
   the outline): fewer dots, but boxy, lumpy commas — dropped; the comma stays pure arcs. Saw thin horns in the wedges:
   let the back lie flat on the head there (big heads again). Saw dots missed or kept by the luck of the sample grid
   (the same room gave 0.39 and 0.73): the dot is now climbed to from the bare patch itself.
4. *Polish.* Curled and flat fitted separately and curl rewarded (o, ∗∗, ××, 22∗, 2∗22 became commas instead of
   teardrops); a classic class (`ab = 90°`) gave ∗2222 and 22× true yin-yang halves with dots of one size; dots capped
   near the eye's size; one channel width; the eye grows where the print would pass 58 %; everything laid out relative
   to e1 with canonical ties, so a moved group gets the moved pattern; the sand side read; the linear programme on
   flat arrays (2222: 109 → 65 ms in node here, 22 ms in the mini's Chrome).

## Files here

- `design.js` — the design.
- `check.mjs` — the hard rules on 68 cases (above). `validate.mjs` — the same motifs through the production validator
  (`src/shapes.js` `validateShapes`, as it stood on 13 Nov 17:00): all 34 ok, gap 0.0636 – 0.113.
  `table.mjs <rows.json>` — the table above.
- `preview.mjs`, `png.mjs` — a contact sheet without a browser (a scanline rasteriser; red ring = largest bare disc,
  blue = largest solid disc; `--strip 1` = as the tests hand the group over; `--knobs a=1,b=2`). `shapes.mjs` — a
  gallery of unit commas. `dbg.mjs '<ids>' [knobs] [bare]` — every candidate of a group with what it is worth.
