# Footprints (`feet`): notes

## The idea

The mark is a LEFT FOOTPRINT: a sole with a heel, an arch drawn into its inner side and a ball, and five toes as fat ovals
that shrink from the big toe outward. It has a direction (heel to toes) and a hand (big toe and arch on one side), so a
rotated copy turns, and a mirrored or glided copy is a RIGHT foot; a line of alternating left and right feet is the
textbook glide. To fill the paper the foot is not a fixed glyph: it is drawn into a FRAME, the page's default tile (or a
part of it), and takes the frame's shape, so the default tile always holds exactly one whole foot.

## The rule and its knobs (design.js)

- `layout(group)` picks the frame and which corners or edges carry the heel and the toes:
  - o: a rectangle along the longer reduced lattice vector.
  - 2222: a brick between two lines of 2-fold centres, cut by the hexagon.
  - Rectangles (`rectSpec`), for **, xx, 22x, 22*, 2*22, 442: the inner side goes on a mirror where a long side is one.
  - *x: two feet in line, 0.57 and 0.43 of the strip.
  - *2222: a broad pad with the toes round a cut front (`roofSpec`).
  - 333: the rhombus, heel in one acute corner, big toe in the other (`bandSpec`).
  - Triangles: the heel in a thin corner, the toes along the far side, the big toe at the most forward corner.
- `leftFoot(frame, toe, heel, o)` draws the foot:
  - the frame is inset by `delta` (0.036 tile sizes, so a channel between two feet is 0.072);
  - five toes are placed along the front, each touching the inset front, `gapToe` 0.046 apart; they spread up to
    `gapToeMax` 0.085 and grow up to `toeCapHard` 0.285 to span a long front;
  - each toe clips the sole behind a line; the heel tapers (`taperIn` / `taperOut`);
  - the corners are rounded (`rSide`, `rApex`), but never so much that a frame corner stays bare beyond `bare` 0.19;
  - the arch is pushed into the inner side (`notch` 0.11, at most `notchRel` of the width);
  - the outline is a closed cubic B-spline, sampled at `h` 0.013.
- `find()` loops: a foot darker than `coverMax` 0.585 is drawn leaner, and a sole that holds a disc wider than `solidMax`
  0.665 is pushed back from its toes.
- Everything is in local coordinates: origin at `group.center`, unit = one tile size. Without `presets` the frame comes
  from a seed found by rule (`ruleSeed`), so a turned, scaled and shifted group gets the same foot.

## The numbers (proto.mjs, kit.measure; rows.json of 13 Nov, 22:58)

| group | dark | bare ⌀ | solid ⌀ | verts | ms | feet | big toe | little toe | channel |
|---|---|---|---|---|---|---|---|---|---|
| o | 0.551 | 0.337 | 0.536 | 415 | 11 | 1 | 0.145 | 0.064 | 0.072 |
| 2222 | 0.519 | 0.339 | 0.643 | 411 | 5 | 1 | 0.203 | 0.089 | 0.072 |
| ** | 0.587 | 0.429 | 0.571 | 416 | 2 | 1 | 0.149 | 0.066 | 0.072 |
| xx | 0.567 | 0.354 | 0.571 | 419 | 3 | 1 | 0.159 | 0.070 | 0.072 |
| *x | 0.468 | 0.407 | 0.357 | 678 | 4 | 2 | 0.092 | 0.041 | 0.054 |
| 333 | 0.578 | 0.394 | 0.643 | 409 | 2 | 1 | 0.191 | 0.084 | 0.072 |
| 22x | 0.580 | 0.368 | 0.667 | 425 | 2 | 1 | 0.192 | 0.084 | 0.072 |
| 22* | 0.545 | 0.385 | 0.464 | 403 | 2 | 1 | 0.117 | 0.051 | 0.069 |
| *2222 | 0.529 | 0.380 | 0.667 | 405 | 5 | 1 | 0.220 | 0.097 | 0.072 |
| 2*22 | 0.575 | 0.430 | 0.505 | 418 | 5 | 1 | 0.119 | 0.053 | 0.080 |
| 442 | 0.583 | 0.418 | 0.643 | 430 | 2 | 1 | 0.239 | 0.105 | 0.072 |
| 632 | 0.563 | 0.399 | 0.496 | 398 | 3 | 1 | 0.200 | 0.088 | 0.060 |
| 3*3 | 0.563 | 0.399 | 0.496 | 398 | 3 | 1 | 0.200 | 0.088 | 0.060 |
| *333 | 0.576 | 0.432 | 0.571 | 419 | 2 | 1 | 0.285 | 0.125 | 0.072 |
| 4*2 | 0.542 | 0.430 | 0.505 | 407 | 2 | 1 | 0.285 | 0.125 | 0.072 |
| *442 | 0.542 | 0.430 | 0.505 | 407 | 4 | 1 | 0.285 | 0.125 | 0.072 |
| *632 | 0.592 | 0.430 | 0.589 | 418 | 6 | 1 | 0.226 | 0.100 | 0.072 |

Overlap 0 everywhere. Ranges: dark 0.468 to 0.592, bare at most 0.432, solid at most 0.667, at most 678 vertices,
at most 11 ms (o, the first call of the page). The feet are 0.9 to 2.4 tile sizes long.

How it was checked:
- `scratch/verify.mjs`: exact, no grid. Copies are at least 0.054 apart. Two marks of one foot are at least 0.043
  apart. The curve step is at most 0.015. No vertex turns by more than 16°. The same result in four places: as the group
  is, and three turned, scaled and shifted copies without presets.
- `scratch/validate.mjs`: the production check, `src/shapes.js` `validateShapes` on `makeShapePrint`. All 17 groups
  are ok, each as it is and in three such places; stabilizer 1 everywhere, so the motif has no symmetry of its own and the
  print's group is exactly the group.
- `app-sheet.mjs --json`: in all 17 groups the print took, the page had no errors and no validator problems.

## What is weak

- **Thin triangles, 632 and 3*3.** The page's tile is a 30-30-120 triangle, 2.6 long and 0.76 tall, so a whole foot in
  it is a fin. The heel must be a spike: around a 6-fold centre twelve corners of 30° meet, and a rounded heel opens a
  bare disc wider than 0.45. The plane reads as a starfish of fins with dotted toe rows; one tile reads as a foot, the
  plane less so.
- **Squat frames: 442, *2222, 333, 22x, 2222.** The frame is up to twice as wide as a foot of its length, and keeping
  the bare disc under 0.45 forces a broad sole. The prints look like paws: a short arch reads as a bite, and the heel is
  as wide as the ball.
- **Kaleidoscopes and triangles: *333, *442, 4*2, *632.** The toes have to span the whole front edge (big toe 0.285),
  or the corner beyond the little toe stays bare (0.57). Across a mirror the two rows of toes face each other: a
  ladder of ten dots.
- **\*x has the smallest features.** Two feet per strip, little toe 0.041, channel 0.054: just over the 0.04 floor.
- **Mixed families.** The rectangles (o, **, xx, 22x, 22*, 2*22) are the best feet. The triangle feet are wedges, so
  the 17 look like one family of footprints, not of one foot shape.

## What I would try next

- Let the foot leave the tile where an edge is not a mirror (632, 333, 2222, 442), giving up "one whole foot in the
  default tile". Then a pinwheel of slender feet "walking" around the 6-fold, 4-fold and 3-fold centres becomes
  possible: a curved fundamental domain, as the comma prints use, with a real foot outline inside it.
- A toe row that may end before the front's far corner, with the sole's outer edge carried on to that corner (no bare
  corner, toes kept compact). That needs a different clip of the sole than the per-toe lines.

## Rounds

1. *First run, 16:12 to 16:19 (r1-easy.png).* Seen: the fitted foot reads at once in o and 2222; 442's square left a
   bare corner of 0.55. Changed: the toes spread and grow along a long front.
2. *First run, to 16:31 (r2-all.png).* Seen: all 17 drawn. Seven groups were over budget (*2222 bare 0.61 / solid 0.73,
   *333 0.59, *442 0.60, 2222 0.51, 333 0.50, *632 0.48, 442 0.48). Changed: the frames per group (the 2222 brick,
   `roofSpec` for *2222, `bandSpec` for 333, the heel in the thin corner of the triangles).
3. *First run, to 17:18 (r3 to r9).* Seen: the worst groups by the numbers. Changed: the round of a corner is capped by
   `bare`; the lean and push-back loop (`coverMax`, `solidMax`); the 'straight' front for the 30-30-120 triangle; the
   facing arches on mirrors. Every group is within budget since r4; r5 checked the sand side.
4. *Second run, 22:35 to 23:00 (r10 to x8, the final set).* Seen at 520 px: the fins of 632 and 3*3, the paws of 442,
   *2222 and 333, and two toes in xx and 2*22 only 0.039 apart (under the 0.04 feature floor). Tried and dropped, with
   their pictures in OUT/feet:
   - compact toe rows (x1): bare 0.86 in *333;
   - big toe at the 120° corner (x2, x8): anatomically backwards, sole halved;
   - a stronger heel taper (x3): bare 0.48 in 442;
   - an arch for *2222 (x4): a molar, bare up to 0.49;
   - a deeper arch and a blunter heel for 632 (x5): a boomerang, bare 0.46;
   - smaller toes in the triangles (x7): bare 0.57.

   Changed: `gapToe` 0.043 to 0.046 and `gapToeMin` 0.039 to 0.043 (every channel inside a foot is now at least 0.043),
   and a shorter hint. Checked: verify.mjs, validateShapes in 4 places, app-sheet (t 0.6, phone), the sand side.

Pictures: `~/drive.unsynced/artifacts/the-folding-patterns/feet/` holds sheet.png, zoom.png, back.png and rows.json (the
deliverables); app-t06.png and app-phone.png (the real app); r1 to r10 (the rounds); x1 to x8 (this run's experiments).
