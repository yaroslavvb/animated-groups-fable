# Paisley — notes of the design

`design.js` is the THIRD version (14 Nov 2026, late evening): the polish after the five judges, which ships as the
page's default pattern. The section "Polish (14 Nov)" at the end says what changed and gives its numbers.
`design.v3.js` is the second version (13 Nov 2026, evening, after CRITIQUE.md), which the sections "After the critique"
and "In the fold" describe. `design.v1.js` is the designer's first version, which the sections up to "Rounds" describe.
`design.v2.js` is the first critic's unfinished change, not used. `design.lab.js` is the third version's rule with the
lab's tracing hooks (`KNOBS.debug`), for `lab/r3/look.mjs` and its kin; it gives the same motifs (`lab/r3/same.mjs`).

Pictures and numbers are in `~/drive.unsynced/artifacts/the-folding-patterns/paisley/`:
- the standard set of the third version: `sheet.png`, `rows.json`, `zoom.png`, `back.png`, `app-t0.png`,
  `app-t06.png`, `app-t1.png`, `app-back.png`, `app-phone.png`, `app-recut.png`, `app-tile.png`;
- the second version's: the same names with `.v2` (`sheet.v2.png`, `rows.v2.json`, …; its ∗× is the old 1.6 × 0.3 strip);
- v1's: `sheet.v1.png`, `zoom.v1.png`, `back.v1.png`, `rows.v1.json`;
- the polish's working pictures and checks: `polish/`; the critique's and the second round's: `r2/`;
- the designer's: `lab/`; the first critic's: `crit/`.

## The idea in three sentences

A fundamental domain carries a FAMILY of commas, as a paisley cloth does: one big comma, the largest the page's default
tile holds whole, and two to four smaller ones dropped, one after another, into the largest bare disc that remains, each
turned and curled to fit the room it finds. A comma is a round head and a tail tapering along a curling spine, and one
knob uncurls it: half a turn round the head in a round room (the page's own comma, a little fatter), an even arc of 70°
in a long room or a thin corner. Every comma of the motif has the same hand and none has a symmetry of its own, so a
copy that curls the other way is always the work of a mirror or a glide, and the pattern's group is the group exactly.

## The rule

All lengths in tile sizes, √(domainArea); everything is computed in a frame of the group (origin `group.center`, x along
`e1`), so a turned, scaled, shifted group gets the turned, scaled, shifted pattern. No table per group.

1. **The tile.** With presets: the page's default tile (`buildDomain` of `presets[0]`). Without (the tests): the
   Dirichlet cell of the group's deepest hole, the point farthest from its own copies.
2. **The big comma.** For 72 turns × 9 curls the largest comma inside the tile shrunk by `bigMargin`: a linear program
   in (x, y, size), solved exactly (`inscribe`). It counts by its area, a little more the more it curls, less when it
   leaves a corner of the tile further than `farOk` away. So the default tile always holds the main mark whole.
3. **The smaller commas**, round after round, on a distance grid (64 cells a tile size) over the tile and a margin:
   - the largest bare disc of the plane (it is often centred on a rotation centre or a mirror corner);
   - up to three seats in and around it: points where a head has most room; a point fixed by an element of the group
     has none, so no mark is ever born on a mirror or a centre;
   - a mark born at p lives in the Dirichlet cell of p shrunk by half a channel, so it never meets its own copies;
   - for each seat a convex ROOM (24 sectors, one supporting line each, a channel from every outline point there) and
     the largest comma in it for 30 turns × 5 curls (the same program), besides commas grown on the grid from the
     seat, which may wind round a neighbour;
   - a fit counts by its area when it comes near enough to the middle of the bare disc to end it, by (ok / d)² when
     it stays d away; the winner is checked against the true outlines (stepping away where the channel is short);
   - marks under `floorWant` are only taken while a bare disc is still larger than `bareNeed`; none under `floor`;
     a mark that would take the dark share over `coverHi` is shrunk.
4. **Three starts.** When the cloth has a flaw (a bare disc too large, a speck, too dark or too light, more than four
   marks) the big comma is tried in the other curls too, and the least flawed cloth is kept.

### The knobs (`KNOBS` in design.js)

| knob | value | what it does |
|---|---|---|
| `shape` | L 4.2 → 5.8, turn 180° → 70°, late 0.4 → 0, taper 1.7, tip 0.08 | the comma at e = 0 → e = 1, in head radii: spine length, total turn, how much of the turn waits for the tip, taper exponent (2 = the yin-yang's), tip radius |
| `channel` / `own` | 0.07 / 0.06 | bare channel between two marks / between a mark and its own copies |
| `bigMargin` | 0.05 | the big comma stays this far inside the tile |
| `solidMax` | 0.62 | largest head diameter |
| `curlBias`, `farOk`, `farPow` | 0.15, 0.25, 1.5 | what the big comma's area is weighed by |
| `ratioNext` | 0.85 | a later head is at most this × the big one's |
| `bareGoal`, `coverGoal` | 0.36, 0.45 | stop when no bare disc is larger and the dark share is reached |
| `bareNeed`, `floor`, `floorWant` | 0.40, 0.14, 0.24 | small marks only while a bare disc is larger than `bareNeed` |
| `coverLo`, `coverHi`, `budgetMin` | 0.41, 0.60, 0.8 | the band of the dark share; how far a late mark may be shrunk to stay in it |
| `seats`, `seatReach`, `nearPow`, `progress` | 3, 2, 2, 0.8 | where a head may sit and how reaching the bare disc counts |
| `startCurls`, `flawOk` | 3 ranges of e, 0.06 | the starts, and when the first one is good enough |
| `grid`, `pad`, `seg`, `segAngle` | 64, 0.65, 0.016, 7° | the grid; the outline's sampling |

## The numbers (kit.js `measure` through `proto.mjs`, 13 Nov 2026; Chrome on the mini)

| group | dark | dark (exact) | bare ⌀ | solid ⌀ | gap | pts | ms | marks | lengths of the marks | curl e of the big one | starts tried |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ○ | 0.56 | 0.557 | 0.36 | 0.43 | 0.078 | 408 | 24 | 2 | 1.35, 0.63 | 1 | 1 |
| 2222 | 0.60 | 0.597 | 0.25 | 0.48 | 0.076 | 472 | 10 | 3 | 0.94, 0.58, 0.35 | 0 | 1 |
| ∗∗ | 0.55 | 0.550 | 0.32 | 0.43 | 0.060 | 496 | 7 | 3 | 1.31, 0.77, 0.31 | 0.88 | 1 |
| ×× | 0.57 | 0.577 | 0.28 | 0.49 | 0.076 | 469 | 6 | 3 | 1.24, 0.38, 0.52 | 0.5 | 1 |
| ∗× | 0.44 | 0.441 | 0.32 | 0.29 | 0.059 | 598 | 14 | 5 | 0.93, 0.79, 0.36, 0.38, 0.39 | 1 | 1 |
| 333 | 0.59 | 0.585 | 0.32 | 0.48 | 0.061 | 479 | 7 | 3 | 1.11, 0.52, 0.35 | 0.38 | 1 |
| 22× | 0.59 | 0.597 | 0.24 | 0.48 | 0.073 | 480 | 8 | 3 | 1.13, 0.5, 0.4 | 0.38 | 2 |
| 22∗ | 0.49 | 0.501 | 0.32 | 0.40 | 0.060 | 442 | 6 | 3 | 1.27, 0.59, 0.25 | 1 | 1 |
| ∗2222 | 0.56 | 0.544 | 0.29 | 0.46 | 0.060 | 634 | 13 | 5 | 1.09, 0.44, 0.31, 0.23, 0.17 | 0.38 | 2 |
| 2∗22 | 0.52 | 0.524 | 0.30 | 0.40 | 0.060 | 627 | 14 | 5 | 1.1, 0.53, 0.27, 0.2, 0.25 | 0.63 | 2 |
| 442 | 0.55 | 0.553 | 0.26 | 0.47 | 0.061 | 644 | 6 | 5 | 0.9, 0.29, 0.7, 0.2, 0.26 | 0 | 1 |
| 632 | 0.51 | 0.510 | 0.41 | 0.43 | 0.061 | 383 | 16 | 2 | 1.18, 0.56 | 0.63 | 3 |
| 3∗3 | 0.55 | 0.546 | 0.42 | 0.43 | 0.060 | 479 | 28 | 3 | 1.18, 0.57, 0.26 | 0.63 | 3 |
| ∗333 | 0.50 | 0.503 | 0.41 | 0.41 | 0.059 | 536 | 25 | 4 | 0.95, 0.38, 0.64, 0.16 | 0.38 | 2 |
| 4∗2 | 0.56 | 0.564 | 0.30 | 0.46 | 0.060 | 553 | 11 | 4 | 1.19, 0.37, 0.29, 0.38 | 0.5 | 1 |
| ∗442 | 0.55 | 0.554 | 0.40 | 0.50 | 0.060 | 626 | 26 | 5 | 1.02, 0.29, 0.27, 0.21, 0.3 | 0.13 | 3 |
| ∗632 | 0.52 | 0.518 | 0.35 | 0.46 | 0.061 | 610 | 15 | 5 | 1.45, 0.23, 0.3, 0.16, 0.26 | 1 | 1 |

"dark (exact)" is the polygons' area over the tile's; "gap" the smallest distance between two different copies, by
`validateShapes` of `src/shapes.js`. Worst over the 17: dark 0.44 … 0.60, bare 0.42, solid 0.50, gap 0.059, 644
vertices, 28 ms; the main mark is 0.90 … 1.45 long.

What was checked, and how (the scripts are in `lab/`, all run in node, no browser):

- `validate.mjs`: `validateShapes` of `src/shapes.js` finds no problem in any group, with presets and without.
- `check.mjs` (also `--moved 1`): my own exact outline distances, nesting, self-crossings, vertices, segment lengths.
- `validate-moved.mjs`: every group carried to three turned, scaled, shifted places as `test/shapes.test.js` carries
  it (one of them 12 times larger and 2000 away), only `{ id, e1, e2, reps, cellArea, domainArea, center }` handed
  over: `validateShapes` finds no problem in 51 runs, dark 0.44–0.60, gap ≥ 0.059, and the three places of a group get
  the same family.
- `fuzz.mjs`: the same at random places with my own distance check: no failure in 34 + 51 runs; the same family of
  sizes in the group's own frame in all but one or two (a tie decided the other way; still a good motif).
- `exact.mjs`: 139 063 isometries that are NOT in the group (translations by fractions of the lattice, rotations and
  reflections about a grid of points and the groups' own special points): every one changes the tone within 16 sample
  points; the group's own elements never do.
- `determinism.mjs`: the same polygons on every call, in any order; the group object is not written to.
- The project's test suite was NOT run: nothing in `test/` reads a design.

## What is weak

- **Small marks.** Mirror corners and the strip need them: 0.16–0.17 long in ∗2222, ∗333 and ∗632 (head 0.07–0.08
  across), 0.20–0.25 in five more groups. Their tails are thinner than 0.04 for most of their length: on a phone they
  are a dot with a hook. Raising the floor to 0.17 leaves bare discs of 0.53 (∗2222) and 0.63 (∗632) instead.
- **Bare patches of 0.40–0.42** remain at the 6-fold centre of 632, in 3∗3, ∗333 and ∗442 (the target was 0.45; none
  is above it). They sit where six or eight copies of a tail meet.
- **∗× is the thinnest result**: dark 0.44, five marks in the strip, the main one 0.93 long but only 0.27 across. A
  comma cannot be wider than the strip between two mirrors, less the two margins.
- **Five marks** in ∗×, ∗2222, 2∗22, 442, ∗442, ∗632: more than the "one to four" of the brief.
- **Channels are not all alike**: 0.06–0.08 where two marks run side by side, wide bare triangles beside a long tail.
- **The method is greedy and its outcome jumps**: a small change of a knob (or of a lattice) can give another family
  for a group (632 has been a rosette of long commas and a field of medium ones on the way). The three starts and the
  flaw count hide most of it; there is no proof that every lattice of every group comes out within the targets.
- **Time**: 6–28 ms a group in Chrome on the mini; on this (loaded, older) Mac in node 10–60 ms, and up to about
  120 ms in the worst run of the fuzz, when all three starts are tried.
- Without presets the big comma sits in the cell of the deepest hole, not in the page's tile (it cannot know it).

## What I would try next

- Seat the big comma a little smaller and off the middle of a round tile, so the second comma comes nearer its size:
  a more even family, fewer fillers.
- A last pass that swells or slides each mark until its channels are as even as they can be.
- Corners by intent, not by search: where n mirrors meet, a small rosette of tails laid in by rule.
- An incremental distance field (only the new copies) and a faster program for the rooms: the time would halve.
- The same family with a second tone step for the smallest marks, if the print ever gets a third tone.

## Rounds

**Round 1 — the idea on o, 2222, 442, 333.**
Saw: a first version (the page's yin-yang comma made fatter, stretched along head → tail by up to 2.2, the big one the
largest the default tile holds, then smaller ones grown on a distance grid in the largest bare discs) already read as a
paisley cloth, but was 66–71 % dark and the stretched commas were beans: no clear tail, a tip that points sideways.
Changed: the glyph. A comma is now a round head and a tail tapering along a curling SPINE; one knob uncurls it.
Channel 0.06 → 0.07.

**Round 2 — all 17.**
Saw: `*442` printed "copies overlap 10 %": a seat exactly on a mirror was taken for a free point (the reflection moved
it by 0 and I had skipped zero distances). Bare discs of 0.5–0.65 stayed at the corners of the kaleidoscopes and at the
6-fold centre of 632: a seat was the point with most room, which is never near a corner. A comma that winds round a
neighbour does not get further away from it when it shrinks about its head, so "shrink until the channel is there" ran
out of steps.
Changed: a point fixed by an element has no room (never a seat); the seat is taken IN the largest bare disc; every
seat gets a convex ROOM and the comma is fitted into it by a small linear program, which threads tails into thin
corners; the exact check steps away from the nearest outline instead of only shrinking; the big comma is tried in up
to three curls and the least flawed cloth is kept. All 17 then met the kit's numbers (dark 0.42–0.60, bare ≤ 0.42).

**Round 3 — the three worst: `*632` (bare 0.48), `*x` (dark 0.37, 97 ms), `2222` (dark 0.62).**
Saw: in the 30° corner of `*632` a compact comma took the wide end of the wedge and nothing could pass it; a tail
that curls at its TIP cannot go into a thin corner at all. The strip of `*x` held only small heads and ran all three
starts for a flaw nobody could mend. In `2222` a third comma, needed for a bare disc, took the dark share over the band.
Changed: a fit counts fully only when it ends the bare disc ((ok / d)² otherwise); the big comma counts less when it
leaves a corner of the tile far away; a late mark that would take the dark share over 0.60 is shrunk about its point
nearest the bare disc; a cloth with a flaw under 0.06 is taken without trying the other curls; the channel to a mark's
OWN copies is 0.06. `validateShapes`: no problem in any group, smallest gap 0.059.

**Round 4 — polish.**
Saw: the long commas with a turn by the head and a straight tail read as tadpoles, and round a 6-fold centre as a
starburst, not a pinwheel; the bare disc the design measured was up to 0.05 smaller than the kit's, because the
largest bare discs are centred ON the tile's corners and the design only looked at cells inside the tile; the tip was
nine straight pieces. On the sand side the marks read as well as on the teal (they are big).
Changed: at e = 1 the tail is an even arc of 70° (the hand shows along the whole body; `*x` rose from 0.41 to 0.44
dark); the bare disc is measured on a rim round the tile too, and small marks are taken while it is above 0.40; the
tip is 22 pieces; at most six marks. Final numbers in the table above.

## After the critique

The second version, 13 Nov 2026, evening (the second critic). It starts from `design.v1.js`; why not from the first
critic's unfinished change is in CRITIQUE.md, "Starting point". It keeps the concept: a big comma, then smaller commas
in the largest bare discs. It changes which marks may be placed and where the big comma may sit. The findings it answers
are numbered as in CRITIQUE.md.

**What changed, and why**

1. **No speck (finding 1).**
   - At most four marks, none under 0.22 tile sizes long or with a head under 0.12 across (`maxMarks`, `floor`,
     `headMin`).
   - A bare disc that only a speck could end is given up, and the next one is looked at (`giveUp`, the first critic's,
     kept).
2. **A stout cut for small marks (findings 1 and 4).**
   - A comma whose head is under 0.20 across is cut stout, and one over 0.26 slender (`KNOBS.stout`, `slenderMin`,
     `stoutMax`).
   - The stout cut is the same glyph with a shorter spine (3.1–3.9 head radii) and a fatter tail (taper 1.3, tip 0.11),
     the way type is cut sturdier at small sizes.
   - So a small mark is a fat comma whose hook still reads at 120 px a tile. Every tail is at least 0.057 wide at 70 % of
     its spine (v1: under 0.04 for the last fifth to two fifths).
3. **No bean for the big comma (findings 3 and 4).**
   - The big comma is curled no further than e = 3/8 (`startCurls`, `pinCurls`).
   - Curled further it is a bean, and its mirror image looks like a translate of it: ∗2222 kept 85 % of its tone under a
     half translation, 78 % now; 4∗2 85, now 78.
4. **The kaleidoscopes' corners get commas of a fair size (findings 1 and 2).** Besides the largest comma of each curl
   range, the big comma is also tried:
   - **with its tip pinned in a thin corner of the tile**: one more side in the same linear program. The tip's middle is
     held within a reach of the corner along its bisector, and in corners under 40° the comma keeps only 0.03 from the
     tile's sides; with 0.05 it could not get nearer a 30° corner than 0.27;
   - **corner to corner**: the tip in one corner and the near edge of the head at a wider one;
   - **smaller**: 0.92, 0.84 and 0.76 of the largest, set in the middle of where it fits.

   A smaller or pinned big comma leaves the corners room for a 0.3 comma where v1 could only put a 0.16 speck.
5. **More starts, looked at lightly.**
   - The greedy rounds are touchy: a hair's change gives another family.
   - So the first start is grown in full, then every other start is grown quickly (a third of the work: two seats, fewer
     turns and curls).
   - The two best quick ones are grown again in full, and the least flawed cloth of all is kept (`fullAgain`,
     `startsOfKind`).
6. **The flaw weighed afresh.** In this order:
   - no bare disc over 0.40;
   - the dark share in 0.42–0.60;
   - the big comma as large as the tile holds (0.6 per share it was made smaller);
   - few marks (0.03 for each beyond two) and few small ones (0.05 each);
   - of two cloths alike, the darker.

   v1's weights preferred a shrunken big comma with four marks to the full one with a single 0.30 mark: ∗∗ fell to 0.49
   dark.

**Tried and dropped** (none beat the backup on the pictures and the numbers):
- **Tails laid tip first by the greedy rounds**, first by a ray (the first critic's idea, with the chord aimed at the
  corner), then by the pinned program in a convex room. They never won in the 17 groups (the room round a corner is too
  small once the big comma has taken the middle) and cost a third of the time. They stay behind `tails: false`.
- **A hooked long glyph** (e = 1: turn 95°, the curl late, taper 1.4: a fuller boteh). ∗632 got a bare disc of 0.546
  and ∗442 one of 0.504.
- **A steeper reward for coming near a fixed point** (`nearPowCorner` 3, 4): no change.
- **A coarser grid (48 cells a tile) and fewer turns**: ∗333 got a bare disc of 0.542.
- **The 0.03 margin for every pinned big comma**: ∗442 got 0.633.

**The numbers** (the kit's `measure` in the mini's Chrome, `rows.json`; marks from `lab/r2/ev.mjs`: length / head
across, s = stout, at curl e)

| group | dark | bare ⌀ | solid ⌀ | pts | ms | marks | the start that won |
|---|---|---|---|---|---|---|---|
| ○ | 0.557 | 0.357 | 0.430 | 408 | 33 | 1.35/0.41, 0.63/0.32 | largest, e = 1 |
| 2222 | 0.583 | 0.286 | 0.418 | 459 | 12 | 0.97/0.41, 0.68/0.35, 0.35/0.21 s | largest |
| ∗∗ | 0.549 | 0.368 | 0.480 | 432 | 51 | 1.30/0.47, 0.33/0.20 s, 0.28/0.16 s | corner to corner |
| ×× | 0.542 | 0.359 | 0.486 | 348 | 8 | 1.24/0.48, 0.52/0.23 s | largest |
| ∗× | 0.455 | 0.393 | 0.288 | 492 | 92 | 0.93/0.29, 0.71/0.24, 0.38/0.23 s, 0.39/0.23 s | tip in a corner |
| 333 | 0.590 | 0.319 | 0.479 | 466 | 9 | 1.11/0.46, 0.52/0.26, 0.35/0.21 s | largest |
| 22× | 0.596 | 0.240 | 0.479 | 467 | 8 | 1.13/0.47, 0.50/0.26, 0.34/0.20 s | largest |
| 22∗ | 0.479 | 0.393 | 0.399 | 366 | 8 | 1.27/0.39, 0.58/0.29 | largest |
| ∗2222 | 0.518 | 0.430 | 0.455 | 500 | 46 | 1.07/0.45, 0.31/0.18 s, 0.29/0.17 s, 0.32/0.19 s | corner to corner |
| 2∗22 | 0.509 | 0.430 | 0.447 | 360 | 82 | 1.43/0.44, 0.41/0.24 s | tip in a corner |
| 442 | 0.571 | 0.329 | 0.429 | 402 | 46 | 1.10/0.43, 0.69/0.35 | corner to corner |
| 632 | 0.484 | 0.416 | 0.442 | 348 | 14 | 1.41/0.43, 0.47/0.20 s | largest |
| 3∗3 | 0.525 | 0.357 | 0.436 | 441 | 60 | 1.25/0.43, 0.61/0.26 s, 0.22/0.13 s | largest (quick) |
| ∗333 | 0.487 | 0.380 | 0.357 | 475 | 63 | 1.08/0.35, 0.53/0.23 s, 0.41/0.21 s, 0.36/0.21 s | largest (quick) |
| 4∗2 | 0.569 | 0.357 | 0.464 | 517 | 59 | 1.26/0.46, 0.31/0.19 s, 0.35/0.21 s, 0.27/0.16 s | largest |
| ∗442 | 0.520 | 0.447 | 0.442 | 485 | 72 | 1.37/0.44, 0.30/0.13 s, 0.32/0.19 s, 0.28/0.12 s | largest (quick) |
| ∗632 | 0.425 | **0.497** | 0.385 | 452 | 89 | 1.22/0.37, 0.31/0.13 s, 0.35/0.20 s, 0.23/0.14 s | 0.84 of the largest |

- **Worst:** dark 0.425 … 0.596; bare 0.447 in 16 groups and 0.497 in ∗632; solid 0.486; 517 points; 92 ms; overlap
  0; smallest gap 0.059.
- **Main mark:** 0.93 … 1.43 long.
- **Marks:** 51 in all (v1: 63). Six are under 0.30 long or 0.13 across (v1: 20). The smallest is 0.22 long with a
  0.12 head.

**Checked, and how** (the scripts are in `lab/r2/`; the outputs are in OUT `r2/final-*.txt`):
- `validateShapes` of `src/shapes.js` in the app finds no problem in any group (`app-t06.json`).
- `lab/validate-moved.mjs` carried every group to three turned, scaled and shifted places (51 runs): no problem.
  Without presets the families differ, as in v1: dark 0.393–0.571, bare up to 0.51 (∗632).
- `lab/r2/ev.mjs --bare 1` (no presets): dark 0.444–0.586, bare up to 0.494.
- `lab/determinism.mjs`: the same polygons on every call, in any order.
- `lab/r2/near2.mjs`, near-symmetries:
  - the worst share is 81 % (∗442, a translation); v1's was 83 %;
  - 3∗3 fell from 83 % to under 77 %;
  - ○ 80 % (the long leaf, as in v1), ∗2222, ∗333 and 4∗2 78 %.
- **Time:**
  - 8–92 ms per group in the mini's Chrome (v1: 6–31);
  - in node on the loaded Intel, up to about 300 ms.
- **The project's suite**: nothing in it reads a design. It was run on the mini at the end: 864 tests, 0 failed, 2
  skipped (`r2/suite.txt`).

## In the fold

What the app pictures show (`app-t0.png`, `app-t06.png`, `app-t1.png`, `app-back.png`, `app-phone.png`,
`app-recut.png`, `app-tile.png`):

- **t = 0.** The fold pane's flat tile holds one whole big comma with a clear head and tail in every group: one sees
  which way it points and which way it curls.
  - In the kaleidoscopes (∗333, ∗442, ∗632) the star of mirrored tiles turns the commas into flowers round the corners.
  - ∗632's 6-fold point is bare, a small white star.
- **t = 0.6.** The paper bends and the marks bend with it.
  - On the Möbius band (∗x) and the cross-cap (22×) the commas stay commas, and one can follow the big one round the
    band.
  - On the thin tubes of the torus (○) and the Klein bottle (××) they turn into broad soft stripes, as any print does
    there.
  - Many folds show the sand side at this moment. The big marks read on it; the stout small ones read too, where v1's
    hooks faded.
- **t = 1.** Closed, mostly the back faces the viewer. Torus, pillows and pouches show one or two large pale sand
  shapes per face: calm, but the comma's hand is hard to make out on a curved closed surface. The marks that a seam cut
  join up again; nothing breaks at the seams, by construction.
- **Front or back.** One can always tell which side is up: teal marks on the front, sand on the back (`app-back.png`:
  the view from behind shows the sand side with the same marks).
- **Phone.** The fold pane is about 180 px wide; the big comma reads there. In the plane pane a tile is about 40–60 px:
  the big comma still reads, and the stout marks are small blobs with a nub.
- **Re-cut (××, 22×, at t = 0.25).** Each moving piece carries its share of the print: one sees a part of the big comma
  on each piece while it travels.
- **Tile step.** The cards carry the print. In 333 the turned copies of the comma show the 3-fold turn.

**What remains weak in the fold**
- The hand of a mark is lost on the closed tubes (○, ××) and on the closed sand faces at t = 1. This is a limit of any
  print on a thin, curved surface; the comma helps less there than on a flat or gently bent sheet.
- The small stout marks at the kaleidoscope corners are near the limit of what reads at the page's size. In 3D they
  read as fat hooks, in the plane pane as dots with a nub.
- ∗632's bare 6-fold point is the one place where the cloth looks thin, in the plane and on the folded triangle.

## Polish (14 Nov)

The third version, 14 Nov 2026, late evening: the five judges' MUST FIX list (`dev/patterns/round2/judges-paisley.md`),
for Paisley as the page's DEFAULT pattern. It starts from the second version (kept as `design.v3.js`) and keeps its
concept: a big comma, then smaller commas of the same hand in the largest bare discs. The tree had been rebased onto
b256e3e: ∗×'s tile is now 1.2 × 0.6 (was 1.6 × 0.3), so ∗× was looked at first.

**What changed, and why**

1. **∗× on its new lattice.** Nothing in the rule had to change: the 1.2 × 0.6 rectangle holds a big comma 1.30 long and
   0.47 across (the old strip: 0.93 and 0.29), with a curled small comma in one corner and a stout one under the big
   tail. Dark 0.544 (was 0.455), bare 0.416, three marks (was four). On the Möbius band the big comma reads whole at
   t = 0.6 and t = 1 (`app-t06.png`, `app-t1.png`, `app-back.png`).
2. **No hair on a phone** (the judges: "the smallest curls and their hooked tips shrink to specks on a phone"). Every
   tip is round and at least 0.04 tile sizes across (`tipAbs` 0.02, a radius), so no tail is thinner than 0.04 before
   its tip: at 120 px a tile that is 5 px. A comma is cut blunter the smaller it is: the same spine, its width lifted
   toward the tip (`w = tipB + (w0 - tip)(1 - tipB)/(1 - tip)`; a blunter comma holds the sharper one, so a fit found
   with a blunter cut stays a fit). Later commas are looked for in the cut of a typical size (`searchHead`) and cut
   exactly once their size is known, then checked against the outlines again; each big comma is fitted again with its
   own cut. The big commas hardly change (their tips were 0.03 across); the small ones end in a round knob.
3. **Fewer, larger marks** ("busy is its known weakness"). A fourth mark only for a bare disc over 0.42
   (`fourthNeed`), never for a crumb. 47 marks in all (51), four only in ∗2222 and ∗333 (six groups before), where
   without it a bare disc of 0.62 stays. The shortest mark is 0.23 long with a 0.13 head (∗442); four are under 0.30.
4. **∗632's 6-fold point is filled** (bare 0.497 → 0.430, dark 0.425 → 0.490). A bare disc that holds a thin corner of
   the tile is ended by a TAIL in that corner:
   - commas AIMED at the corner are offered besides the seats' fits: the head on the corner's bisector (`aimAt`), the
     chord head → tip pointing in (`aimOff`), grown until the tip meets the wedge's sides; nearness counts to the corner
     itself, and as fully as a blunt tip can come (`dTip`, `aimSlack`);
   - the big comma pinned in a corner may uncurl to e = 1.25 (`pinCurls` [3, 10]: a 42° arc, the tail running out
     nearly straight, still handed), its tip held within 0.04 of where it fits (`pinReach`, was 0.08), and it is also
     tried smaller with its tip still in the corner (`pinScales` 0.86, 0.74).

   In ∗632 the big comma now lies along the tile with its tail in the 30° corner, so the twelve tails meet at the
   6-fold point as a flower; a stout and a slender comma take the 60° and 90° corners. ∗442 and 4∗2 gained the same way
   (∗442: bare 0.447 → 0.394, three marks).
5. **Speed** (the judges: 72–127 ms in ∗×, ∗632, 2∗22, ∗442 on the mini). The rule is unchanged; the page's 17 default
   tiles look up WHICH of its starts wins (`WINNERS`: the kind of start, its corner or curl range, quick or full, and
   the tile's corners in the group's frame to match it by, all dimensionless) and make and grow only that one. The
   motif is the very same, point for point (`lab/r3/winners.mjs check`). A group or tile not in the table (a moved
   copy, a group without presets) runs the search. The table must be made again (`winners.mjs make`) whenever a knob
   changes. Besides: only the curls of the start ranges are fitted (the first three were fitted and never used).
6. A cleaner rule for tiles without presets: a cell with a repeated corner lost that corner (∗442 without presets had a
   bare disc of 0.756; now 0.387).
7. The tails laid tip first (`tails: false`, which never won) and the lab's tracing hooks are gone from `design.js`
   (no debug code ships); `design.lab.js` keeps the hooks.

**The numbers** (the kit's `measure` in the mini's Chrome, `rows.json`; ms is find() in the order of the sheet, the
first group paying for a cold page; marks: length / head across / tip across, s = stout)

| group | dark | bare ⌀ | solid ⌀ | pts | ms | marks | v2: dark, bare, ms |
|---|---|---|---|---|---|---|---|
| ○ | 0.556 | 0.357 | 0.430 | 409 | 25 | 1.36/0.41/0.041, 0.65/0.31/0.040 | 0.557, 0.357, 33 |
| 2222 | 0.568 | 0.272 | 0.418 | 450 | 10 | 0.97/0.40/0.040, 0.66/0.33/0.043, 0.34/0.20/0.041 s | 0.583, 0.286, 12 |
| ∗∗ | 0.553 | 0.329 | 0.480 | 424 | 8 | 1.30/0.47/0.043, 0.33/0.19/0.042 s, 0.33/0.16/0.040 s | 0.549, 0.368, 51 |
| ×× | 0.536 | 0.359 | 0.480 | 344 | 6 | 1.23/0.48/0.043, 0.52/0.22/0.041 s | 0.542, 0.359, 8 |
| ∗× | 0.544 | 0.416 | 0.480 | 419 | 6 | 1.30/0.47/0.043, 0.39/0.16/0.041 s, 0.28/0.16/0.041 s | (old strip) 0.455, 0.393, 92 |
| 333 | 0.593 | 0.319 | 0.466 | 466 | 7 | 1.11/0.46/0.042, 0.53/0.26/0.042, 0.34/0.20/0.042 s | 0.590, 0.319, 9 |
| 22× | 0.594 | 0.250 | 0.479 | 466 | 6 | 1.13/0.47/0.042, 0.50/0.25/0.042, 0.34/0.20/0.041 s | 0.596, 0.240, 8 |
| 22∗ | 0.482 | 0.393 | 0.385 | 362 | 8 | 1.26/0.38/0.042, 0.59/0.29/0.041 | 0.479, 0.393, 8 |
| ∗2222 | 0.510 | 0.430 | 0.447 | 491 | 8 | 1.05/0.44/0.044, 0.32/0.18/0.040 s, 0.28/0.16/0.041 s, 0.34/0.18/0.041 s | 0.518, 0.430, 46 |
| 2∗22 | 0.530 | 0.393 | 0.452 | 373 | 13 | 1.54/0.45/0.041, 0.36/0.21/0.040 s | 0.509, 0.430, 82 |
| 442 | 0.516 | 0.404 | 0.407 | 364 | 7 | 1.10/0.40/0.044, 0.65/0.33/0.042 | 0.571, 0.329, 46 |
| 632 | 0.490 | 0.416 | 0.436 | 349 | 8 | 1.41/0.43/0.043, 0.43/0.22/0.041 s | 0.484, 0.416, 14 |
| 3∗3 | 0.534 | 0.407 | 0.432 | 448 | 13 | 1.09/0.42/0.042, 0.56/0.28/0.042, 0.31/0.15/0.040 s | 0.525, 0.357, 60 |
| ∗333 | 0.493 | 0.385 | 0.357 | 472 | 18 | 1.08/0.35/0.042, 0.50/0.24/0.040 s, 0.42/0.21/0.041 s, 0.36/0.21/0.042 s | 0.487, 0.380, 63 |
| 4∗2 | 0.522 | 0.385 | 0.373 | 447 | 9 | 1.21/0.37/0.041, 0.64/0.31/0.041, 0.27/0.16/0.041 s | 0.569, 0.357, 59 |
| ∗442 | 0.479 | 0.394 | 0.373 | 440 | 11 | 1.21/0.37/0.041, 0.84/0.25/0.040, 0.23/0.13/0.040 s | 0.520, 0.447, 72 |
| ∗632 | 0.490 | 0.430 | 0.352 | 448 | 18 | 1.20/0.33/0.040, 0.59/0.26/0.041 s, 0.50/0.25/0.042 | 0.425, 0.497, 89 |

- **Worst over the 17:** dark 0.479 … 0.594; bare 0.430 (∗2222, ∗632); solid 0.480; 491 points; find() 6–18 ms warm,
  25 ms for the first group of a page. A group alone in a fresh page (all cold): ∗632 38 ms, 2∗22 36, ∗333 32 (before
  the start was made alone: 44–46).
- **Main mark** 0.97 … 1.54 long; every tip 0.040–0.044 across; no THIN part anywhere.

**Checked, and how** (scripts in `lab/r3/`; outputs in OUT `polish/`)
- `prodcheck.mjs`: the production code of `src/shapes.js` (makeShapePrint, printable, validateShapes at GAP_MIN,
  thinParts at 1.5 texels of the 3D texture) on all 17 groups with presets and on two turned, scaled and shifted copies
  of each without presets (test/pattern.test.js's `moved`): all 51 pass, smallest gap 0.059, no thin part, at most 491
  vertices (`polish/prodcheck.txt`). Without presets the families differ, as before: dark 0.475–0.612, bare up to 0.509
  (∗632; its cell of the deepest hole is the mirror image of the page's tile, and the comma's hand fits it less well).
- `winners.mjs check`: with the table, all 17 come from it, each the same motif as the full search, point for point.
- `same.mjs`: `design.js` and `design.lab.js` give the same motifs in all 34 cases (with presets and without).
- The real app (`app-sheet.mjs`, the mini's Chrome): all 17 take the print at t = 0, 0.6 and 1, no RULES line, no THIN
  line, no page error; `app-t06.json` has validateShapes' gap ≥ 0.059 in every group.
- Looked at: `sheet.png`, `zoom.png`, `back.png`, the seven app pictures, and `polish/a2-zoom-hard.png` (the
  kaleidoscopes closer). ∗632 reads as a flower of tails at the 6-fold point and paisley commas round the other
  corners; ∗442 has eight-petalled flowers of tails at its 4-fold corners where rosettes of stout specks were, and 4∗2
  lost its fourth mark.
- The project's suite was not run: nothing in `test/` reads this file (the integrator moves it to `src/patterns/`).

**What remains weak**
- Still two to four marks a tile; the kaleidoscopes' corners are now flowers of tails (a figure, but of commas).
- ∗2222 and ∗333 keep four marks: three small stout commas round the mirror corners.
- Without presets (only the tests' moved groups) ∗632's bare disc is 0.509 and that search takes up to about 300 ms on
  this Mac; the page never takes that path.
- The table ties the speed to the knobs: a knob changed without `winners.mjs make` gives another (still valid, but not
  the searched) motif for the groups whose start moved, and `winners.mjs check` says so.

## The table of grown marks (15 Nov 2026, the fixer, after the WebKit review)

The review of the shipped page in Safari's engine (Playwright's WebKit 26.5 on the M5, beside Chrome on the mini) found
Paisley's 17 default tiles grown into OTHER marks in WebKit, in all 17 groups: a mark of 4∗2 0.28 tile sizes away, a
third comma of 333 0.2 away, ∗632 another arrangement (its flaw 0.54 against 0.235; 4∗2 0.46 against 0.08). The start
from `WINNERS` was the same; its growth was not. The greedy rounds compare sizes, distances and flaws, and WebKit's libm
gives another last bit than V8's for 4 to 38 % of cos, sin, hypot, acos, atan and tan: one bit tips one comparison, and
every round after it goes elsewhere. V8 itself is not one engine: Chrome 157 grows a small mark of ∗333 elsewhere than
node does (and 22x, 2∗22, ∗632 a thousandth apart), while node 24 on the mini (arm64) and node 25 on the Intel (x86)
grow the same marks to 1e-16.

So the 17 default tiles now DRAW the marks the search grew (`GROWN`, beside `WINNERS` in `design.js`: per mark x, y,
turn, head radius, curl in sixteenths, cut and tip, the numbers exactly as the search left them), drawn as the search
draws a mark (`shapeOf`, thinned by `decimate` at its size, `place`d), with no search in between that a last bit could
tip. `KNOBS.pinned` (on) says so; the lab turns it off to grow the table's start again.
- `lab/r3/grown.mjs make` prints the table: made in node on the mini (the node on the Intel grows the same marks).
  `grown.mjs check` on the mini: all 17 drawn motifs are the grown ones point for point; drawing one takes 0.1–0.5 ms,
  growing it 6–26 ms (`winners.mjs check` now grows the table's start, as it did before the second table).
- `test/patterns-engines.test.js` (the project's suite): with the last bit of Math.cos, sin, hypot, acos, atan, atan2,
  asin, tan, cbrt, exp and pow moved for a third of their arguments, Paisley grew other marks in 17 of 17 groups before
  this table, and draws the same outlines in all 17 now; Soft commas, Tomoe and the Comma: 0 of 17 either way. It also
  keeps a fingerprint (each outline's area and centroid, `test/patterns-fingerprint.json`).
- The knobs are now tied to two tables: a knob changed without `winners.mjs make` and `grown.mjs make` draws the old
  marks with the new comma; the fingerprint test fails until both are made again.
- Any other group or tile (a copy without presets; only the tests make one) is still searched and may come out
  otherwise in another engine.
