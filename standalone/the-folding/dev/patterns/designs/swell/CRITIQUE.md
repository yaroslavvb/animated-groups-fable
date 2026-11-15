# Swell — the art director's critique (13 Nov 2026, second pass)

Seen fresh, not from the designer's pictures: `proto.mjs` (the sheet, three closer batches at 520 px, `--zoom 1.8`,
`--side back`), the lab's site view (the commas drawn under the swell), `app-sheet.mjs` at t = 0, 0.6, 1 for all 17,
the fold pane at full size for 9 groups, the back (`--view 180/40/1`), a phone, the re-cut (`xx, 22x --preset 1
--t 0.25`) and the Tile step. All in `~/drive.unsynced/artifacts/the-folding-patterns/swell/review/v1-*.png`.
Proxies of "comma or pebble" (`review/metrics.mjs`, per mark): **solidity** = area / convex hull (a pebble or wedge is
near 1, a comma with a bay 0.55 – 0.75) and **asym** = the least share of a mark that differs from its own mirror
image over any line through its centroid (a teardrop, wedge or rounded square is near 0).

| group | marks / tile | solidity | asym | what the eye sees |
|---|---|---|---|---|
| 333 | 1 | 0.55 | 0.48 | tomoe: commas, the best of the set |
| 22x | 1 | 0.67 | 0.43 | yin-yang commas: good |
| 2222, 442 | 1 | 0.73, 0.69 | 0.49 | swirls, fat body and a thin hook: comma-ish |
| 2\*22 | 1 | 0.64 | 0.41 | rounded squares split by an S-shaped slit |
| xx | 1 | 0.74 | 0.31 | 1.9 tile sizes long S-bands that line up into diagonal stripes |
| 632 | 1 | 0.76 | 0.45 | long petals converging on the 6-fold points: a starburst, a flower |
| 22\* | 1 | 0.77 | 0.23 | a lumpy bottle with a knob on its tail |
| o | 2 | 0.89, 0.85 | 0.32, 0.37 | a boot and a kidney: amoebas |
| \*\* | 2 | 0.96, 0.85 | 0.14, 0.08 | two potatoes, nearly mirror-symmetric |
| \*x | 1 | 0.96 | 0.14 | a cigar as long as the strip |
| 3\*3 | 1 | 0.91 | 0.38 | a fat wedge filling the triangle |
| 4\*2 | 1 | 0.95 | 0.17 | pinwheel blades: pebbles |
| \*2222 | 2 | 0.87, 0.79 | 0.30, 0.35 | jigsaw pieces |
| \*333, \*442, \*632 | 2 | 0.73 – 0.91; second 0.86 – 0.99 | 0.20 – 0.48 | lace: wedges and pebbles, 12 – 24 pieces round a corner |

## Findings, worst first

1. **In 11 of 17 groups the marks are not commas.** The commas under the swell (the lab's site view) are good tapered
   strokes, but the swell fills whatever room a comma sits in, and where no neighbour's head sits in the bay the bay
   fills up: `**` two near-symmetric potatoes (asym 0.14 and 0.08), `*x` a cigar (solidity 0.96), `4*2` pebbles (0.95),
   `3*3` fat wedges (0.91), `o` a boot and a kidney, `*2222` jigsaw pieces, `22*` a bottle, `632` a starburst of petals,
   the kaleidoscopes lace. The owner would say "333 is the comma, but what are these?". One idea does not carry through
   the 17: tomoe, yin-yangs, stripes, puzzles, flowers and lace are six different patterns.
2. **The kaleidoscopes are lace** (`*333`, `*442`, `*632`, also `*2222`): two marks per chamber, the second a pebble
   (solidity 0.98 – 0.99), so 12 – 24 small pieces meet round every corner. Busy, the opposite of calm and graphic, and
   no single mark is big (the second one 0.8 – 1.0 tile sizes long in its thin triangle).
3. **Stripes where the surface is thin.** `xx`'s marks are S-bands 1.9 tile sizes long that line up into diagonal
   stripes; `*x`'s cigar runs the whole strip (2.2 × 0.3). Folded, the Klein bottle and the Möbius band carry a stripe
   along the tube or band (`v1-fold-t06.png`): no head, no tail, no direction to follow. The torus tube of `o` smears its
   blobs the same way.
4. **Lumps and Voronoi corners.** `22*` has a knob on the tip of its tail; the room-filling swell (λ = 1, used in the four
   chambers and `22*`) leaves straight flanks and corners where the nearest disc changes (`*2222`, `22*`); `o` and `**`
   show straight cuts on their flanks. "No kinks, no lumps" fails there.
5. **Bare places over 0.45** in six groups: `442` 0.515, `3*3` 0.511, `2222` 0.505, `2*22` 0.480, `*632` 0.480, `4*2`
   0.470 (none over 0.6). They sit at the centres the seat does not use (the second 4-fold class of 442, the 3-fold
   points of 3\*3, the 2-fold points of 2222).
6. **Two swells, two weights of channel.** 0.06 tile sizes in the λ groups, 0.17 – 0.35 in the room-filling ones: next to
   each other in the selector they do not look like one family.
7. **The default tile holds no whole mark** in the nested groups: the head is in the tile, the tail leaves to wind round
   a neighbour's head, and the tile shows a slice of someone else's tail (the hexagon of 2222 holds one head and a
   foreign tail). In the fold one follows a head, not a comma.
8. **Near-symmetric marks** (`**` asym 0.08 – 0.14, `*x` 0.14): no exact extra symmetry (every mark is asymmetric and the
   two marks of a pair differ in size, `stabilizer` 1), but the eye sees mirror-symmetric potatoes and cigars, which
   blurs which way the mirrors and glides turn things.
9. **Tail tips** end at 0.06 tile sizes, blunt; in 333 and 22x they read as thin hooks in the plane pane of a phone
   (about 4 px). Within the rule, but the weakest feature of the good groups.

## What holds

- **Both sides read**: the marks are big enough that the sand side's low contrast does not lose them (`v1-back.png`,
  `v1-app-back.png`); teal against sand tells which side is up in every fold.
- **The rotation groups fold well**: in 22x's cross-cap and 333's pillow a whole head-and-tail is visible and can be
  followed as the tile closes; the re-cut and the Tile step carry the print in register (`v1-app-recut.png`,
  `v1-app-tile.png`).
- **The hard rules hold**: no overlap, 234 – 375 points, 45 – 108 ms in the mini's Chrome, the validator passes; dark
  0.535 – 0.620 in all 17.

## Verdict before the improvement

Not yet the owner's comma. It is the comma in the five rotation groups and a family of blobs elsewhere. The next round
must make the marks commas in the groups without rotations and in the kaleidoscopes — fewer, bigger marks with a bay —
without losing the filled surface, and then close the bare places over 0.45.

## Outcome (14 Nov 2026, 00:10)

Findings 1 and 5 are fixed in seven groups (`o`, `xx`, `22*`, `632`, `3*3`, `4*2`, `2*22` become commas, and 2222,
442, 632, 3\*3, 4\*2 are under 0.45), finding 3 in part (`xx` is no longer a stripe flat; the thin tubes still are).
Findings 2 (the kaleidoscopes' lace), 6 (two channel weights) and 8 (`**`: now tadpoles, bare 0.531) remain. What changed
and why: `NOTES.md`, "After the critique" and "In the fold".
