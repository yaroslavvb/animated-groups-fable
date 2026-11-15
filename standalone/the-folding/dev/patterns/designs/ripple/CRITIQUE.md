# Ripples: the critique (second run, 13 Nov 2026)

Read by an art director who speaks for the owner. The design as delivered is `design.v1.js`. The first run's critic copied
it and changed nothing (`design.js` was byte for byte `design.v1.js`; its pictures in `OUT/ripple/crit/` are of that
version), so there was one version to judge, not two. Pictures of this critique: `OUT/ripple/c2/` (`v1-*.png`); OUT is
`~/drive.unsynced/artifacts/the-folding-patterns`. The findings are ranked by how much they would bother the owner.

## The verdict in one line

The idea is right and the numbers pass in every group. As delivered it is not clean enough for this page: the ring's
edge is ragged wherever it meets a pool beside the comma's hollow, the high-order centres wear little asterisks of
petals, and on the folded sand side the echo, not the comma, is what one sees.

## Findings, worst first

1. **The ring's edge is ragged, and it shows in the app at normal size.** It is saw-toothed beside the comma's hollow,
   where the ring meets a pool: in o, \*\*, xx, 22x, 333, 442 and 2\*22 (`v1-z1.png`, `v1-z2.png`). In the app's flat
   tile (`v1-fold-t0.png`) it shows as a wobble at xx's top right and along 442's bottom edge. On a page that is "precise
   and quiet" this reads as a rendering fault, not as a design. The cause is in the field, not the outline code:
   - the ring points that carry a corner's swell were labelled from the swollen corners alone, so the labels ran all
     round the ring. Beside a pool that does not swell, the field jumped between grid points: a tooth per grid step.
   - the opening, done with cones of a field that is only nearly a distance, scalloped every narrow stretch of the ring
     (\*\*: the ring's inner edge on its right flank).
2. **Asterisks at the high-order centres.** Each 6-fold centre of 632 wears a star of six small petals (0.036 tile
   areas each). The 6-fold corner of \*632 has twelve petals and twelve arc segments. Each 4-fold corner of \*442 has
   eight petals, and two corners of \*333 have them too. Elsewhere the print is calm swirls; here it is fussy. In the
   plane pane the stars sit on the cone-point dots and the mirror-corner rings and compete with them. They are the
   concept's third band, cut by the channels, so they are honest. But they are the busiest thing on the sheet, and the
   one thing that looks like the checkerboard's small marks.
3. **The echo is what one sees, not the comma.** The comma itself covers 10 to 17 % of the tile; the page's covers 30 %.
   Round it, the light moat (0.10) and the dark ring (0.135) make a bean whose outline is rounder than the comma's.
   - Flat, this works: comma and echo read as a swirl, and the hand is plain in 2222, 333, 442, \*2222 and 22x.
   - Folded, most closed shapes show the sand side in the default view (`v1-app-t1.png`, `v1-fold-t1.png`). At low
     contrast and under shading, what is left are broad arcs: the torus wears two dark stripes round its tube, and the
     pillows of 2222 and 632 wear wide sand arcs. One cannot point at a head or a tail there.
   - The teal side does better: the \*x Möbius band, the 22x cross-cap and the xx Klein bottle all show swirls.
   - Asked "is this the comma, filling the surface?", the owner would say yes in the flat plane and only half yes in
     the fold.
4. **Stretched commas in six groups.** In o, \*\*, xx, 22\*, 2\*22 and \*x the comma and its bands are stretched 1.5 to
   2.9 times, and a band is up to 2.4 times wider along the tile than across it. The mark reads as a kidney (o, \*\*, xx)
   or an eye or fish (22\*, 2\*22, \*x) more than as a comma. The page's own comma is stretched only in \*x. The stretch
   is what lets one comma fill a long tile, so it buys finding (b). It is a price, not a fault.
5. **Off-centre seats: slices of other rings in the tile.** In 333, 22\*, 442, 632, 3\*3 and 4\*2 the comma sits at the
   roomiest place of the tile. The tile holds the whole comma and its moat, but its own ring is cut, and slices of the
   neighbours' rings fill the tile's corners. Folded, those are arcs that belong to no comma on the shape: they help
   one tell the places apart, but not follow a mark.
6. **The channel doubles every mirror.** A 0.05 light channel runs along every cell border, so in the kaleidoscopes
   every mirror line is traced in white under the ink. The plane then reads as "one comma per triangle" more than as
   one print. This is the rule of shape prints (copies must keep apart, and a mirror is a border), not a choice. Minor.
7. **Without presets the motif is another one** (the default tile is not the roomiest place, most visibly in 22x, 22\*,
   2\*22, 632, 3\*3 and 4\*2). Rule 2 asks only for a good motif then, and it is one. Minor.

## What holds (checked)

- **(a) The symmetry is the group's.** Every motif holds exactly one comma, and no other piece has that shape. So an
  extra symmetry would have to carry the comma onto a copy of itself: it would be an element of the group. No group
  shows a mirror, half-turn or half-translation of its own, by eye on all 17, and the kit's stabiliser is 1 and overlap
  0 in all 17.
- **(b) The numbers.** Dark 0.516 to 0.583 and bare ⌀ 0.208 to 0.430 (\*632; the target is 0.45), solid ⌀ at most
  0.339, from `v1-rows.json`. No corner is empty: the bands reach the 30° corner of \*632, the strip of \*x and the
  hexagon of 2222.
- **(c) Big.** The comma is 0.57 to 0.97 tile sizes long. Light channel 0.05, dark pieces at least 0.04 by
  construction.
- **(d) The default tile holds a whole comma** in all 17.
- **(e) The sand side reads** flat (`v1-back.png`), at lower contrast. The asterisks of finding 2 are just as busy
  there.
- **The re-cut and the Tile step keep the print in register** (`v1-app-recut.png`: xx Hexagon at "re-cut 3/3: glide",
  22x Bowl; `v1-app-tile.png`).
- **Hard rules.** At most 618 vertices; 13 to 52 ms in Chrome on the mini; channel 0.05 between copies.

## What I would change, in this order

1. Make the field clean at its source: label every corner, measure the channel exactly, and open and close an exact
   signed distance. Then the outline has no tooth anywhere, with no change to the concept.
2. Calm the asterisks: fewer, larger pieces at the high-order centres, so long as no corner is left empty and bare stays
   at most 0.45.
3. Give the comma more of the mark: let it grow, with the moat and ring a little narrower, within the brief's 0.1 to
   0.16 bands. Only if the pictures say it reads better, flat and folded.

## Where each finding stands now (design.js, second run)

What changed and how is in `NOTES.md` "After the critique". The pictures are the standard set in `OUT/ripple/`.

1. **Ragged edge: fixed.** No tooth anywhere at 1.8 and 2.6 times zoom, nor in the app's flat tile. The fix is in the
   field: every corner seeds the swell's labels, the channel is measured exactly, a light blur, and an opening and
   closing of a true signed distance.
2. **Asterisks: two of the four fixed.** 632's six-petal stars are gone: the rings fill those narrow wedges, round a
   small pool. \*333's petal corners and \*632's 3-fold corner are calmer the same way. Left: \*632's 6-fold corner (a
   target of two arc bands and twelve tips) and \*442's 4-fold corners (eight petals). Those petals are large enough to
   read, and removing them pushed the dark share past 0.62.
3. **The echo, not the comma, in the fold: not fixed, and not fixable within the concept.** A narrower moat and ring,
   or a fuller comma, gain 5 to 9 % of comma and push a group past 0.62 dark.
4. **Stretched commas: kept.** A smaller stretch of the plane moves the stretch into the comma itself.
5. to 7.: unchanged (choices of the concept, minor).

New price: the ring is lopsided where it fills a wedge. 632's rings send a horn into each 6-fold centre, and \*333's
rings swell into rounded triangles.
