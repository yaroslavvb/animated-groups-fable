# Hooks: notes (design key `hook`, label "Hooks")

## The idea

The mark is a bold hook: two strokes of different length joined at a rounded bend, with round caps. The long stroke
gives the direction and the side the short one turns to gives the hand. In the kaleidoscopes the hook bends twice into
a C, and in two strip groups it carries a dot. One hook per tile, as big as the tile allows, fat enough that its copies
leave channels of even width between them, so the dark tone covers half the paper. Mirrored and glided copies curl the
other way, rotated copies turn about the centres as pinwheels, and translated copies run parallel as herringbones.

## The rule and its knobs

`find(group)` reads one row of `SPEC` (only dimensionless knobs per group id) and draws the motif from it:

1. **Frame.** A frame that moves with the group: its origin O is the centre of the highest-order rotation among the
   coset representatives. Without one, O is the foot of `group.center` on the first mirror or glide axis; without
   either, it is `group.center`. The axes are e1 and e2.
2. **Spine.** The bend is B = O + s e1 + t e2 (`B: [s, t]`). The long stroke leaves B at the angle `th` from e1 and is
   `a` tile sizes long. The short one is turned by `phi` and is `b` long. With `u` and `phi2` the spine bends twice
   (a J or a C). Corners are rounded with radius `fil`. The half-width is `r`, with `rt` and `rh` for a taper at the
   tail or head end. A tile size is sqrt(domainArea).
3. **Trimming.** The stroke is trimmed wherever another copy's stroke comes nearer than the channel `gap`. A point is
   dark when it is in this copy's stroke and at least gap/2 inside its territory against every other copy (the field
   of `makeField`, first order in the depth difference). The trimmed corners are rounded by `rd`. A dot (`dr`, `dg`,
   `dx`) can sit off the short arm.
4. **Outline.** The outline is traced from that field by marching squares, on a grid laid along the long stroke. It is
   then simplified by Douglas–Peucker at 0.0006 tile sizes.

The table has no absolute coordinates and no row reads `group.presets`. A turned, scaled or shifted group therefore gets
the same pattern, turned, scaled or shifted to match. This is checked exactly by `dev/validate.mjs`: 0 tone differences
at about 3,900 points per copy, for three moves of each of the 17 groups.

**Equivariance fix (second run).** The first run culled rival copies with axis-aligned boxes. A box is not carried
along when the group turns, so a turned group's motif differed from the turned motif by up to 0.012 tile sizes (1.5 %
of sample points). The culling now uses circles round each spine, with a radius chosen so that a culled rival
provably cannot change the sign of the field.

**Shapes by family.**

The table is the design as it stands after the critique round (13–14 Nov 2026). Rows marked † changed in that round;
see "After the critique".

| Family | Groups | Shape |
|---|---|---|
| No mirrors | o, 2222, 333, 22x, 632 | Two-stroke hook. Rows found by `dev/tune2.mjs` with a heavy weight on the hook lying whole in the default tile. |
| No mirrors, glides | xx † | Fish hook: a long stroke, a round heel, a short toe turned forward. |
| Mirror + 3-fold centre | 3*3 | Two-stroke hook. |
| Square tile, 4-fold centres | 442 | J drawn by hand to sit in the square tile; its quarter-turns make a key pattern. |
| Mirrors making strips | 2*22, 4*2 | J |
| Mirrors making strips | ** | J and a dot |
| Mirror box | *2222 † | G: the top arm curls down the right side, and a barb turns in below the opening. No dot. |
| Thin strip | *x † | J lying in the strip. A fat shank in one lane ends in a pointed tail. A round crook leads to a thinner return in the other lane, which ends in a round head. No dot. The glide sends the next J the other way. |
| Strip with half-turns | 22* | L whose arm rises from the lower lane, with the half-turned L hanging from above; arms evenly spaced. |
| Kaleidoscopes | *333, *442, *632 † | A C along two and a half sides of the chamber, with a comma's character. The tail is pointed in the sharpest corner and thickens toward the first bend. A round head (half-width 0.22–0.26) ends the C partway along the last side. |

Since the critique round a row can also be a **path**: the spine's places in lattice coordinates from the frame
origin, with a half-width at each (`pathStrokes` in design.js). It is as dimensionless as the knobs, so a turned,
scaled or shifted group still gets the carried motif. `dev/validate.mjs` checks this exactly.

`*632` uses gap 0.09, not 0.12, because its twelve wedge tips meet at the 6-fold centre. There the channels alone leave
a bare disc of diameter gap / sin 15°, which is 0.46 at gap 0.12.

## Numbers per group

This table is the designer's state before the critique round (design.v1.js). Eleven rows are unchanged; the six that
changed (xx, \*x, \*2222, \*333, \*442, \*632) are in the before/after table of "After the critique". The numbers
are from the sheet (kit.measure, 56 points per tile size). The in-tile value is the share of one hook that
lies inside the page's default tile, for the best copy (`dev/intile.mjs`). The near-symmetry value is the largest share
of points kept by an isometry outside the group (`dev/extra.mjs`); 100 % would mean an extra symmetry, and none has one.
Every group passes `validateShapes` with stabiliser 1. The ms column is `find` in the browser.

| group | dark | bare ⌀ | solid ⌀ | verts | ms | in tile | near-symmetry |
|---|---|---|---|---|---|---|---|
| o     | 0.525 | 0.368 | 0.357 | 79  | 6  | 0.95 | 66 % |
| 2222  | 0.493 | 0.430 | 0.418 | 87  | 5  | 1.00 | 70 % |
| **    | 0.488 | 0.416 | 0.253 | 143 | 8  | 1.00 | 78 % |
| xx    | 0.507 | 0.359 | 0.359 | 79  | 2  | 1.00 | 82 % |
| *x    | 0.522 | 0.329 | 0.160 | 111 | 13 | 1.00 | 90 % |
| 333   | 0.493 | 0.393 | 0.380 | 89  | 2  | 1.00 | 81 % |
| 22x   | 0.479 | 0.430 | 0.404 | 89  | 2  | 0.99 | 68 % |
| 22*   | 0.534 | 0.393 | 0.368 | 78  | 4  | 0.92 | 88 % |
| *2222 | 0.513 | 0.404 | 0.307 | 126 | 5  | 1.00 | 93 % |
| 2*22  | 0.581 | 0.380 | 0.319 | 82  | 7  | 0.88 | 86 % |
| 442   | 0.549 | 0.429 | 0.368 | 105 | 4  | 0.98 | 67 % |
| 632   | 0.543 | 0.432 | 0.321 | 84  | 5  | 0.96 | 69 % |
| 3*3   | 0.579 | 0.416 | 0.368 | 79  | 7  | 0.83 | 76 % |
| *333  | 0.564 | 0.385 | 0.337 | 59  | 15 | 1.00 | 90 % |
| 4*2   | 0.574 | 0.380 | 0.295 | 85  | 8  | 0.86 | 75 % |
| *442  | 0.557 | 0.352 | 0.303 | 57  | 14 | 1.00 | 91 % |
| *632  | 0.575 | 0.380 | 0.288 | 48  | 17 | 1.00 | 81 % |

**Worst values.** Dark share ranges from 0.479 (22x) to 0.581 (2*22). The largest bare disc is 0.432 (632) and the
largest solid disc 0.418 (2222). The most vertices is 143 (**) and the slowest `find` 18 ms in the browser (45 ms cold
in node on the Intel).

**App check.** In the real app (`app-sheet.mjs --t 0.6`, all 17 groups) every group reports 0 errors and 0
validateShapes problems, and the print took.

## What is weak

- **442, 632, 2222 and 22x** are close to the bare-disc target (0.43 against 0.45). In 442, 2222 and 22x this is
  the price of a whole hook in the default tile. The first run's longer hooks filled better (bare 0.31 to 0.35), but
  the tile held only 57 % (442) and 74 to 78 % (2222, 22x) of a hook. These three patterns are sparser than the others.
- **The kaleidoscope C-hooks (*333, *442, *632) and *2222** are near-symmetric. An isometry outside the group keeps 90
  to 93 % of the tone, because the C covers most of the chamber's rim and the hand is only where it stops. Seen from
  afar, these patterns read as thick double lines along the mirrors with gaps.
- **Stroke weights vary by family.** The *x strokes are thin (0.14 tile sizes; the strip is only 0.43 wide) next to
  0.3 to 0.4 elsewhere. The wedge tips in the 30° and 45° corners are pointed, under 0.04 wide for their last 0.05 to
  0.08 tile sizes.
- **The table is per group.** It is 17 rows of knobs found by search and drawn by hand, not one rule. It holds for any
  similarity of the groups, but a change of a group's lattice shape in src/groupdata would need its row redone.

## What I would try next

- For 2222 and 22x, a small dot off the short arm to fill the bare patch the shorter hook leaves.
- For the kaleidoscopes, a shorter C (less near-symmetry) with a taper on the long arm to keep the fill.
- The re-cut (`--preset 1 --t 0.25`) and Tile (`--tile 0.5`) steps of the app were not looked at. The phone was
  checked once (`app-sheet.mjs --phone --t 0.6 --ids 'o,*x,22x,333,*632'`: app-phone.png): the hooks read in the plane
  pane and on the 3D shape, and *x's J's are thin there but clear.

## Rounds

- **First run** (15:45 to 17:35, cut off by the usage limit; it wrote no notes).
  - Round 1: hooks on o, 2222, 442 and 333 by a random search (`dev/tune2.mjs`: a cheap proxy on the bare spine, then
    the real motif with coarse numbers).
  - Round 2: all 17. The mirror groups were drawn by hand (`dev/hand.mjs`): fat ticks in the kaleidoscopes, J's in
    4*2, 2*22, ** and *2222.
  - Round 3 had started (r3-sheet, r4-sheet).
- **Second run, round 3: the worst groups** (22:40 on).
  - Saw: *x was a tapered sliver with no visible hand. 22* was a wavy stroke, not a hook. *333 was a tick with a
    blob-like dot. The default tile held only 57 to 75 % of a hook in o, 2222, 333 and 442 (`dev/intile.mjs`). *632's
    bare disc was 0.505.
  - Changed: *x became the J with a dot and 22* the L meander. o, 2222, 333, xx, 22x, 442 and 632 were re-searched for
    a whole hook in the tile (out/T2.json, T3.json). *333, *442 and *632 became C-hooks. *632 got gap 0.09; its bare
    disc fell from 0.505 to 0.38.
- **Second run, round 4: polish.**
  - Saw: a turned group's motif was not exactly the turned motif (box culling). 22x was blobby. *333's C was 95 %
    near-symmetric. 442's hook had a lump.
  - Changed: the culling now uses circles, so the motif is exactly equivariant. 22x was slimmed to r 0.19. *333's C
    was shortened (foot 0.35). 442's fat "7" became a J drawn to sit in the square tile (r9-lab442.png): it holds 98 %
    of the J, and the J's quarter-turns make a key pattern. The production validator passes for all 17 groups and their
    moved copies.

**Pictures of the second run** (in ~/drive.unsynced/artifacts/the-folding-patterns/hook/): renamed to sheet.v1.png,
zoom.v1.png, back.v1.png, rows.v1.json, app-t06.v1.png and app-phone.v1.png. r5-* is the state the second run found;
r6-lab* and r7-lab* are the candidates it compared.

## After the critique (13–14 Nov 2026, a fresh pair of eyes)

`CRITIQUE.md` holds the findings, ranked by how much they would bother the owner. design.v1.js is the designer's version.
Six rows changed; the other eleven are the designer's.

### What changed and why

| group | the mark before → after | dark | bare ⌀ | solid ⌀ | near-symmetry | in tile | verts |
|---|---|---|---|---|---|---|---|
| xx | chevron "<" → fish hook | 0.507 → 0.505 | 0.359 → 0.399 | 0.359 → 0.429 | 82 → 63 % | 1.00 → 0.89 | 79 → 86 |
| \*x | paperclip and dot → J, unequal arms, no dot | 0.522 → 0.550 | 0.329 → 0.416 | 0.160 → 0.179 | 90 → 81 % | 1.00 | 111 → 68 |
| \*2222 | C and dot → G | 0.513 → 0.545 | 0.404 → 0.329 | 0.307 → 0.393 | 93 → 88 % | 1.00 | 126 → 92 |
| \*333 | uniform C → C with tail and head | 0.564 → 0.566 | 0.385 → 0.339 | 0.337 → 0.357 | 90 → 80 % | 1.00 | 59 → 63 |
| \*442 | uniform C → C with tail and head | 0.557 → 0.550 | 0.352 → 0.404 | 0.303 → 0.329 | 91 → 83 % | 1.00 | 57 → 61 |
| \*632 | uniform C → C with tail and head | 0.575 → 0.576 | 0.380 → 0.407 | 0.288 → 0.288 | 81 → 76 % | 1.00 | 48 → 57 |

How the numbers were measured:

- Dark, bare and solid are from the sheet (`rows.json`, `rows.v1.json`).
- Near-symmetry is from `dev/extra.mjs`: the largest share of the tone that an isometry outside the group keeps.
- In tile is from `dev/intile.mjs`.

The worst values over all 17 groups are now:

| measure | value | where |
|---|---|---|
| dark share | 0.479 to 0.581 | 22x, 2\*22 |
| bare disc | 0.432 | 632 |
| solid disc | 0.429 | xx |
| near-symmetry | 87.8 % | 22\*, \*2222 (was 93.0 %) |
| vertices | 143 | \*\* |
| `find` in the browser | 16 ms | |

All 17 groups pass `validateShapes` with stabiliser 1, and `dev/validate.mjs` passes for the 51 turned, scaled and
shifted copies at 0 tone differences.

1. **Kaleidoscopes (\*333, \*442, \*632): the C keeps its course and gains a comma's character.**
   - What changed: the tail starts pointed in the sharpest corner and thickens toward the first bend. A round head
     ends the C partway along the last side; its half-width is 0.22 to 0.26, against 0.15 to 0.21 for the stroke.
   - The effect: the hand now shows in the stroke itself, not only at the break, and near-symmetry falls by 5 to 10
     points.
   - Why the course stays: with bare ≤ 0.45, the dark must come within about 0.22 of the middle of every side of the
     chamber. A disc centred on a mirror sees the white of both chambers. So any mark that leaves a side unlined fails.
     I measured this:

     | tried | result |
     |---|---|
     | ticks lining two sides | bare 1.1 to 1.5 |
     | fat "7" | bare 0.54 to 0.62 |
     | "seven" with its head at the third side | dark 0.68 to 0.78, near-symmetry up to 97 % |
     | curls (C plus a barb) | the eye closes into a hole: rings, not hooks |
     | crook with a floating return | still triangles, \*632 dark 0.67 |

     These are in `dev/ad-cands.mjs` and the `ad-r1-lab*.png` pictures. The open C is the topology the constraint
     leaves.
2. **\*2222: a G instead of a C and a dot.**
   - The shape: the top arm curls down the right side, and a barb turns in below the opening.
   - The effect: no dot, a clear hand, and near-symmetry 88 % against 93 %.
   - Why the opening is on the side: the first G's opened at a corner, which left the 2-fold centres bare (0.5 to 0.7).
3. **\*x: the same two-lane J, with character instead of a dot.**
   - What changed: the shank is 0.16 wide, against 0.12 for the return. The shank ends in a pointed tail, the return in
     a round head, and there is no dot.
   - The effect: near-symmetry 81 % against 90 %, and the plane has no speckle.
   - Why it is still two long arms: a disc on a mirror sees only the lane next to it, because the lanes are too thin to
     reach across the strip. Each lane must therefore be lined for about 80 % of its length, and the two arms must sum
     to about 3.7 tile sizes.
   - What I tried and dropped: a candy cane with a short return (bare 0.54 to 0.56) and a tapered stick (near-symmetry
     94 %). The designer's dot was filling exactly the lane gap that the shorter return leaves.
4. **xx: a fish hook instead of a chevron.**
   - The shape: a long stroke, a round heel, and a short toe turned forward.
   - The effect: near-symmetry 63 % against 82 %.
   - The trade: the default tile holds 89 % of it, against 100 %.
   - Why this foot: a thinner foot (half-width 0.17) and a rounder heel (0.28) took the trimming lump off the heel.

**Tried and not adopted:**

- **22\*, two J's interlocking round each 2-fold centre.** Near-symmetry was 78 % against 88 %. But the crooks sit too
  close to the opposite shanks, so the trimming made puzzle-piece lumps, and the strip's half-turn pairing leaves every
  other gap empty. 22\* keeps the designer's L.
- **\*\*, a G.** Under 0.62 dark, the strokes would be 0.17 wide against 0.24.
- **Fewer lumps in 442, 22x, 22\* and 2222.** A thinner stroke pushed bare over 0.45. The plain trimming rule (a new
  `plain` knob) did not change the outline.

### In the fold

What I saw in the real app, in all 17 groups at t = 0, 0.6 and 1 (`app-t0.png`, `app-t06.png`, `app-t1.png`):

- **The print takes everywhere.** 0 errors and 0 `validateShapes` problems, stabiliser 1 (`app-t06.json`).
- **Which side is up** is always clear: teal or sand.
- **Seams.** Marks cut by a seam join when it closes, by construction. In the re-cut of xx (`app-recut.png`) the new
  fish hook arrives whole in the home tile. The Tile step's cards carry the marks (`app-tile.png`).
- **Head and tail.**
  - On the closed kaleidoscope triangles (t = 1) the round head and the thin tail of the C both show, so one can see
    which corner the tail went into. Before, it was an even outline.
  - \*2222's G reads on the closed rectangle.
- **Thin and curved parts.**
  - On the torus and Klein bottle tubes (o, xx at t = 0.6) a hook becomes a band around the tube. xx's toe shows as a
    widening of the band, but the hand is hard to read there.
  - \*x's Möbius band is still a striped ribbon, now with pointed ends instead of dots.
- **The pillows** (2222, 333, 632) show mostly their sand side in the default view. There a hook is one low-contrast
  blob.
- **Phone** (`app-phone.png`): the marks read in the 160 px plane pane, but \*632's plane is still busy.
- **The back in 3D** (`app-back.png`, view 180/40): the sand side carries the marks, faintly on the thin torus.

What remains weak, worst first:

1. **The kaleidoscopes still read as triangles within triangles.** It is quieter and has a hand now, but it is forced
   by the bare target.
2. **\*x is still stripes,** also forced by the bare target.
3. **22\* is still dashed rows.**
4. **Trimming lumps remain** in 442 (the worst), 22\*, \*\*, 22x and 2\*22.
5. **\*\* still reads "ij".**
6. **xx's heel has a small notch** at its inner corner, visible at 1.8x.
7. **632 is still a busy sunburst,** and 2222, 22x, 442 and 632 sit at bare 0.43.
8. **The wedge tips** in the 45° and 30° corners narrow below 0.04 tile sizes over their last few hundredths.

**Pictures of this round** (in ~/drive.unsynced/artifacts/the-folding-patterns/hook/):

- the standard set: sheet.png, rows.json, zoom.png, back.png, app-t0.png, app-t06.png (and .json), app-t1.png,
  app-back.png, app-phone.png, app-recut.png and app-tile.png;
- the critique's own renders of the designer's version, in crit/;
- the candidates compared, in ad-r1-lab*.png to ad-r5-lab*.png and ad-r6-sheet.png;
- the six changed groups in the app, in ad-fold-changed-t06.png.

The tools of this round are in dev/:

| tool | what it does |
|---|---|
| `ad-cands.mjs` | the candidates |
| `ad-lab.mjs` | coarse numbers and near-symmetry for a list of candidates, feeding `lab.js` |
| `ad-sym.mjs` | the near-symmetry measure |
| `ad-loops.mjs` | the polygons and holes of a candidate |
| `ad-probe.mjs` | the tone along a ray |
| `ad-sweep7.mjs` | a small sweep of the "seven" shape |
| `ad-rows.mjs` | a candidate as a SPEC row |
| `ad-info.mjs` | a group's geometry |
