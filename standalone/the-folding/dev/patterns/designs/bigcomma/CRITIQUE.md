# Big comma: the art director's critique (13 Nov 2026, second run of the round)

Starting point: `design.js` as the designer delivered it. `design.v1.js` is the same file (byte for byte: the first
critic made the backup and was cut off before changing anything), so there was no second version to compare.

Pictures I rendered fresh for this critique, in `~/drive.unsynced/artifacts/the-folding-patterns/bigcomma/crit/`:
`v1-sheet.png` + `v1-rows.json` (all 17 on the mini's Chrome), `v1-a/b/c.png` (520 px, three per row), `v1-back.png`
(sand side, zoom 1.8), `v1-app-t06.png` (the real app), `v1-fold-t06.png`, `v1-fold-t1.png` (the 3D pane alone, full
size), `v1-phone.png`, `v1-recut.png`, `v1-tile.png`, `exp-dots1.png` (the experiment below).

The numbers pass: dark 0.45 to 0.58, largest bare disc at most 0.42, largest solid disc at most 0.52, no overlap, at
most 500 points, at most 35 ms. The findings below are about how it looks, worst first.

## Findings, ranked by how much they would bother the owner

1. **A comma in a box, not commas that nest.** Each comma is inscribed in its own default tile, `margin` inside every
   side. So the light channels redraw the default tiling over the whole plane, a grid of stamps: rows of boxed comets
   in \*x, boxes in 22\*, 2\*22 and \*2222, a honeycomb of white lines in 2222, rhombi in 333. The concept asked for
   the opposite: commas as large as their COPIES allow, the tail of one in the hollow of the next, one thin even
   channel. Here the bays stay empty and are plugged with dots. A side effect in the fold: at the default cut every seam
   runs down an empty channel. No mark ever crosses a seam, so the print never shows a mark joining up again when an
   edge closes. Only the coloured seam lines show the gluing.
2. **Speckle.** Nine groups carry two or three dots per tile, in four or five sizes, 0.12 to 0.28 tile sizes across:
   \*\*, \*x, 22\*, \*2222, 2\*22, 3\*3, \*333, \*442, \*632. They do not read as the yin-yang's dot in the bay.
   They read as bubbles:
   - 3\*3: dot, dot, head in a graduated row, a caterpillar;
   - \*2222: four dots meet at every mirror corner;
   - 632: pairs of dots between the rays of the starburst;
   - \*442: a 0.12 speck in a corner;
   - \*x: dots in pairs at the end of every comet.

   On the phone sheet these are specks of 4 to 8 px. Dropping them is not free (`exp-dots1.png`, at most one dot): the
   bare disc goes to 0.51 in \*\* and \*2222, 0.48 in 3\*3, 0.64 in \*442 and 0.73 in \*333. The dots are covering
   for commas that cannot reach the corners of their rooms.
3. **Teardrops, not commas, in the seven triangle groups** (333, 632, 3\*3, \*333, 4\*2, \*442, \*632). The search
   picks the flat class there: a fat drop whose tail runs straight into the sharp corner, its back lying flat on the
   head. The hand is a faint hook of the belly. It reads as a drop, a pear or a flame. In 632 and 3\*3 the tails
   converge on the centres as a twelve-ray starburst, a flower, not commas chasing each other round a centre. A
   flat comma is also close to mirror-symmetric, so the eye nearly sees a larger group (in \*333 the drops almost lie
   on the bisectors). This is a perception problem, not an exact one; see 8.
4. **Comets in the strips.** \*x (a 5.3 : 1 room) gets a needle 2.2 tile sizes long with a head 0.37 across. 22\* and
   2\*22 (3.3 : 1) get long fish. The curl is gone and the tail runs for most of a tile size at under 0.1 wide. Two
   rows of fish face each other across every mirror.
5. **In the fold the marks are often blobs.** At t = 0.6 and 1 most surfaces show the sand side:
   - the torus (o) and the Klein bottle (xx) turn the comma into broad diagonal bands, with no head or tail to be
     found;
   - on the pillows (2222, 333, 442, 632) each face is one blob in a white frame.

   It reads well on \*\* (the tube), 22× (the cross-cap) and the four kaleidoscopes at t = 1, where the tile lies flat
   and the whole comma with its eye is in view. On the sand side the small dots nearly vanish (lower contrast).
6. **Two families, not one.** Yin-yang halves in the rectangles and the hexagon (o, 2222, \*\*, xx, 22×, \*2222, 442:
   the best boards, calm and clearly commas). Teardrops with bubbles in the triangles. Comets in the strips. The
   seventeen do not look like one idea carried through.
7. **The re-cut and the Tile step are fine.** The pieces of xx's Hexagon and 22×'s Bowl land in register and close
   into one whole comma in the home tile. The cards of the Tile step carry the print. Nothing to fix there.
8. **The symmetry claim holds.** One asymmetric comma per tile, its eye on the head's centre, its dots off every
   symmetry element. An extra isometry would have to map the comma onto itself, so the print's group is exactly the
   group in all 17. No orbits line up into a mirror. The near-symmetry of the flat drops (3) is the only risk to
   the eye.

## Where each finding stands after the improvement (details in NOTES.md, "After the critique")

1. **Box: fixed where the geometry allows.** Commas grow against their copies:
   - o, 2222, ××, 22×, 333, 442 and 632 nest, the tail of one in the hollow of the next, and o, 2222, ×× and 22× need no
     dot at all;
   - where mirrors wall the comma in (\*\*, \*×, 2\*22, 4\*2 and the four kaleidoscopes) nothing can nest, and the
     comma stays in its chamber;
   - the price is criterion d: the default tile holds 78 to 85 % of a nesting comma's outline, and a sliver of a
     neighbour's tail tip.
2. **Speckle: reduced, not gone.** 27 dots became 20; no group has three; the first dot sits in the comma's own bay. The
   mirror groups keep two (a mirror corner needs a tip or a dot). \*442's second dot is still a 0.12 speck.
3. **Teardrops: fixed in 333 and 632, not in the mirror triangles.** 333 is a pinwheel of curled commas and 632 a
   six-armed whirl. 3\*3, 4\*2, \*333, \*442 and \*632 keep flat drops (their curled versions leave bare patches of 0.47
   or more).
4. **Comets: unchanged.** \*×'s room has no width to curl in.
5. **The fold: unchanged.** Marks now cross the seams and join up, but the pillows still show blobs at t = 0.6.
6. **Family: closer, not one.** The rotation groups are now one family: nested yin-yang commas and whirls. The
   kaleidoscopes are still the drops-and-dots family.
7. and 8. **Still hold.** All hard rules hold in 68 cases. The moved group gives the moved pattern to 1e-12. The
   stabiliser is 1 in all 34 production checks.

New numbers: dark 0.48 to 0.58; bare ⌀ at most 0.45 except \*2222 (0.53, which traded two corner dots for it); at most
50 ms on the mini.

## What I set out to change (same concept, better execution)

- Let the comma grow against its copies, not against the walls of its room: where a neighbour leaves room (its bay,
  a corner it does not use) the comma may cross the tile's side. That is the nesting the concept asked for, and it
  should let the dots go.
- At most one dot, the yin-yang's, in the bay. A second only where a mirror corner would otherwise stay bare, never a
  third.
- Prefer curled commas where they fit, so the triangles get commas, not drops.
- Keep every hard rule. Undo whatever does not make both the pictures and the numbers better.
