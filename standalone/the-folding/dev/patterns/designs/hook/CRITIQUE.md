# Hooks: the critique (13 Nov 2026, second run, a fresh pair of eyes)

What I looked at, all rendered fresh (in `~/drive.unsynced/artifacts/the-folding-patterns/hook/crit/`):

- the flat sheet with numbers (`sheet.png`, `rows.json`);
- three closer batches at 520 px (`b1.png`, `b2.png`, `b3.png`);
- the tile at 1.8x (`zoom.png`) and six groups at 1.3x for the outlines (`lumps.png`);
- the sand side (`back.png`);
- the real app at t = 0, 0.6 and 1 (`app-t0.png`, `app-t06.png`, `fold-a.png`, `fold-b.png`, `fold-t1.png`);
- the back in 3D (`app-back.png`), a phone (`app-phone.png`), the re-cut (`app-recut.png`) and the Tile step (`app-tile.png`).

I checked the numbers with the production validator (`dev/validate.mjs`): all 17 groups pass `validateShapes` with
stabiliser 1, and 51 turned, scaled and shifted copies differ from the carried print at 0 points. I measured
near-symmetry with `dev/extra.mjs`: for each group, the largest share of points that an isometry outside the group
keeps.

## What works

- **No-mirror groups.** In o, 2222, 333, 22x and 442 the mark is a bold hook with a direction and a hand. Translated
  copies run parallel and rotated copies turn about the centres. The default tile holds a whole hook or nearly so.
- **The rules.** The symmetry is exact: no isometry outside the group keeps more than 93 % of the tone. The motif is
  equivariant. `find` takes at most 21 ms in the browser.
- **The app.** The print takes in all 17 groups with 0 errors. Marks cut by a seam join when the seam closes, by
  construction. The re-cut pieces of xx and 22x carry the hooks in register, and the Tile step's cards carry the
  print.
- **The sand side** reads at the lower contrast.

## Findings, worst first

1. **The kaleidoscopes \*333, \*442 and \*632 show chamber outlines, not hooks.** The C-hook runs at constant width
   along two and a half sides of each chamber, with tight corners. Each chamber therefore holds a dark triangle
   outline around a smaller white triangle, and every ink mirror lies between two parallel dark bands. From any
   distance the plane is a grid of thick double lines: the checkerboard's triangles in another form. The hand shows
   only at the short break where the C stops. Near-symmetry is 89.7 % (\*333), 91.4 % (\*442, a half translation) and
   81.4 % (\*632). In the fold at t = 1, the closed triangle carries a smaller outlined triangle, with no head and no
   tail to follow. On a phone (`app-phone.png`), \*632's plane pane is hatching. These are the last three groups of
   the picker, and the owner would stop at them.
2. **\*2222 shows a "C" with a dot.** A half translation keeps 93.0 % of the tone, the largest near-symmetry of the
   set. The C is nearly symmetric about its own axis, so the horizontal mirrors almost disappear and the plane reads
   as columns of identical "C:" glyphs. The dot reads as punctuation.
3. **\*x shows pinstripes.** The owner named this group. Each mark is a 2.0 x 0.43 paperclip: strokes 0.14 wide (half
   the weight of every other group), inner channel 0.07, and a dot 0.14 across. The plane is horizontal stripes and
   the Möbius band a striped ribbon (`fold-a.png`, `fold-t1.png`). A half translation keeps 89.9 %. The crook and the
   dot that carry the direction are too small to see on a phone.
4. **22\* shows dashed rows.** Long bars with a stub at one end lie end to end in their lanes. It reads as brickwork,
   with no hand at a glance; near-symmetry is 87.8 %. The bars' long edges are wavy (`lumps.png`).
5. **The 17 groups do not look like one family.** There are seven kinds of mark:
   - fat boots and hockey sticks (o, 2222, xx, 333, 22x);
   - letters with i-dots (\*\* reads "ij", \*2222 reads "C:");
   - Greek-key meanders (2\*22, 442, 4\*2);
   - a paperclip (\*x);
   - dashes (22\*);
   - triangle outlines (the kaleidoscopes);
   - a sunburst of sticks (632).

   The dots in \*\*, \*x and \*2222 read as typography or speckle, not as part of a hook.
6. **The trimmed outlines are lumpy.** Where two fat strokes compete, the trimming follows a curved territory border,
   so straight strokes get dents and bulges:
   - 442: the J's lower bar bulges and dips, and the marks look melted;
   - 22\*: the bars;
   - \*\*: the J's bowl and short arm;
   - 22x: the heel;
   - 2\*22: the bars.

   They show at 520 px and in the app's plane pane. The bar is "calm, bold, graphic", and these fail it.
7. **xx shows a chevron, not a hook.** The arms are 0.76 and 0.52 long at 98°, so the mark reads as an arrowhead "<".
   A mirror keeps 82 % of the tone, and the hand is weak.
8. **Some groups are near their limits.** 2222, 22x, 442 and 632 have bare discs of 0.43, against the 0.45 target.
   632 is the busiest picture of the set: a sunburst of long sticks around every 6-fold centre.
9. **The tips are hairlines.** The wedge tips in the 45° and 30° corners of \*442 and \*632 narrow below 0.04 tile
   sizes over their last 0.05 to 0.08, which is speckle at phone size.
10. **In the fold:**
    - On the thin tubes (the torus and Klein bottle at t = 0.6), a hook becomes a band wrapped around the tube.
    - On the closed pillows (2222, 333, 632, mostly sand from the default view), each hook is one blob, and head and
      tail are hard to tell apart.
    - Which side is up is always clear (teal or sand).
    - The fold is calmer than the checkerboard in the no-mirror groups and busier in the kaleidoscopes.

## What the improvement should do (in this order)

1. Kaleidoscopes and \*2222: a mark that reads as a hook (a pointed tail, a fat round bend, a head that turns in),
   not as a lining of the chamber; nothing a half translation or a turn nearly keeps.
2. \*x: a walking stick, not a paperclip: a long shank, a round crook and a short return, with fewer parallel bars.
3. 22\*: hooks, not bricks.
4. xx: a hook with a clear short arm, not a chevron.
5. Fewer lumps: the trimming should cut straight where it cuts a straight stroke.
6. Drop the i-dots where a hook can do their work.

## Outcome (14 Nov 2026; the details are in NOTES.md, "After the critique")

| finding | outcome |
|---|---|
| 1. kaleidoscopes | Partly fixed. The C now has a pointed tail, thickens toward the bend and ends in a round head. Near-symmetry fell from 90, 91 and 81 % to 80, 83 and 76 %. The C itself stays: the bare target forces every side of a chamber to be lined. |
| 2. \*2222 | Fixed. A G, no dot; near-symmetry 88 %. |
| 3. \*x | Partly fixed. Two unequal arms, a pointed tail and a round head, no dot; near-symmetry 81 %. It is still striped, because thin lanes must each be lined for about 80 % of their length. |
| 4. 22\* | Not fixed. The interlocking J's I tried were lumpy and left gaps. |
| 5. One family | Better. Two of the three dots are gone, and the kaleidoscope C's now carry the hook's tail and head. \*\* keeps its dot. |
| 6. Lumps | Not fixed. A thinner stroke pushes bare over the target, and the plain trimming rule changes nothing. |
| 7. xx | Fixed. A fish hook; near-symmetry 63 %. |
| 8. Sparse groups | Unchanged. |
| 9. Hairline tips | Unchanged. |
| 10. In the fold | See NOTES.md, "In the fold". |
