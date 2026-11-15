# Footprints (`feet`): the art director's critique

13 Nov 2026, second run. Everything below was seen in fresh pictures of the design as delivered (design.v1.js), all in
`~/drive.unsynced/artifacts/the-folding-patterns/feet/`:
- flat: `c1-sheet.png` / `c1-rows.json`, the 520 px closer looks `c1-big1..3.png`, the tile itself `c1-zoom.png`;
- the real app: `c1-app-t0.png`, `c1-app-t06.png`, the fold pane alone `c1-fold06a/b.png` (t 0.6) and `c1-fold1.png`
  (closed), the back `c1-app-back.png`, the phone `c1-app-phone.png`, the re-cut `c1-app-recut.png`, the Tile step
  `c1-app-tile.png`.

The numbers are all within budget, and the symmetry claim holds:
- dark 0.468 to 0.592, bare at most 0.432, solid at most 0.667, overlap 0, at most 678 vertices, at most 11 ms;
- the motif has no symmetry of its own (stabilizer 1) and each copy is one sole plus five toes, so no isometry outside
  the group keeps the print. No group gains a mirror, a half-turn or a half-translation.

The findings, ranked by how much they would bother the owner:

1. **A third of the selector shows no footprints: 632, 3\*3, \*333, 4\*2, \*442, \*632.** The foot is drawn into the
   default tile and takes its shape, and in a triangle that shape is a wedge: a triangular sole with five dots along
   one side. In the plane:
   - 632 and 3\*3 are a starfish of fins around the 6-fold (or `*3`) points, with dotted rows between the arms;
   - \*632 is a twelve-petal flower;
   - \*442 and 4\*2 are a quilt of wedges and dotted lines;
   - \*333 is a rosette of blobs.

   "One idea carried through all 17 groups" fails here. The owner would not recognise the concept in these six, and
   these are the groups where rotations and mirrors meet, which is where a footprint should help most.
2. **Squat frames make paws, not feet: 2222, 333, 442, \*2222, 22×.**
   - The frame is up to 1.6 times as wide as a foot of its length, so the sole is a rounded box or a potato. The heel
     is as wide as the ball, and the short arch reads as a bite.
   - The five toes round the front of a broad pad are the picture of a dog's or a bear's paw. \*2222 is a bean with
     five dots down its side.
   - The hand is still there, carried by the big toe, but the "foot" read is gone.
3. **Ladders of toes across mirrors: \*2222, \*333, \*442, \*632, 4\*2.** Where the front of the foot lies on a
   mirror, its five toes face the mirror image's five toes, which makes two parallel rows of dots, a ladder. In the
   kaleidoscopes these ladders run along every mirror, so the plane is ruled with dotted lines: speckle (rule f). The
   ladders are also what shows most at the Tile step and in the ghost stars of the kaleidoscopes at t 0.
4. **The toes are crumbs in the long frames: \*x, 22\*, 2\*22.**
   - Little toes are 0.041 (\*x), 0.051 (22\*) and 0.053 (2\*22) tile sizes; \*x's channel is 0.054. All pass the
     0.04 floor, but on a phone (c1-app-phone, \*x) the toes are 3 to 4 px specks.
   - The soles are long slabs (aspect up to 3.5) with the toes squeezed into the short front, so they read as insoles
     with crumbs at one end.
5. **The fold shows fragments, mostly on the sand side.** One foot per tile means each face of a closed surface carries
   a piece of one sole and a few toes.
   - On the torus (o) and the Klein bottle (××) the foot wraps a thin tube: a teal or sand band and nothing that reads
     as a foot.
   - On the pillows (2222, 333, 442, 632) and cones (3\*3, 4\*2) the camera sees mostly the sand back, with one big
     pale blob.
   - What works: \*\* (a whole footprint on the curled annulus, the best picture of the set), \*× (the soles and toe
     rows go round the Möbius band), 22× (the toe row on the sand side of the cross-cap reads at once). In every group
     the side that is up can be told by the tint, and the heel and toes show where the tile's ends went.
   - The 3D view is calmer than the checkerboard's: one large mark and a row of dots per face.
6. **The heel is as wide as the ball even in the good rectangles (o, \*\*, ××).**
   - The outer side is a straight ruled line from heel to little toe, so the foot looks like a boot sole.
   - It still reads as a footprint at once. These three are what the whole set should look like.
7. **Two sides.** The sand side (back.png of the first run, the app's back view) reads, at lower contrast. The broad
   soles carry it; the small toes of \*x, 22\* and 2\*22 nearly vanish.
8. **The seams.** The re-cut of ×× and 22× keeps the print in register (a whole foot on the re-cut tile), and on the
   Tile step the cards carry it. Nothing to fix there.
9. **Hard rules.** All hold. The feature floor is met only just in \*x (little toe 0.041, channel 0.054).

What would the owner say? "In the rectangles, yes, this is the comma, and it fills the paper; in the triangles I see
wedges and dots." The concept is right. The execution fails where the tile is a triangle, and half-fails where it is
squat.

## Plan for the improvement (in order)

1. **632 and 3\*3: three feet walking round a triangle.** The triangle T of three 6-fold (632) or `*3` (3\*3) points
   round a 3-fold gyration holds exactly three tiles. Each foot becomes a slim band along one side of T, its heel in
   T's corner and its toes at the next foot's heel, its inner side on T's side. In 3\*3 that side is a mirror, so a
   left and a right foot stand in step across every mirror; in 632 it carries a half-turn, so two left feet pass each
   other. This gives up "one whole foot in the default tile": the heel of the main foot lies over the tile's edge,
   and on the closed surface it joins up again.
2. Then the squat paws and the kaleidoscope ladders, where a change can be shown to be better in the pictures and the
   numbers.

## Outcome

Details are in NOTES.md, "After the critique" and "In the fold".
- **Item 1 was done and kept.** 632 and 3\*3 are now proper footprints in a pinwheel: dark 0.570 / 0.582, bare 0.429,
  solid 0.576 / 0.591. Their cost is finding (d): the heel crosses the default tile's edge.
- **Item 2 was not changed.** For each case, the analysis or a measurement showed that the rules leave no better
  arrangement:
  - a chiral foot cannot leave a kaleidoscope's chamber;
  - a square pinwheel's centre hole needs feet as squat as today's;
  - the slimmer alternatives for 442 and 2222 leave only slices in the default tile.
- **Findings 1 (for \*333, \*442, \*632, 4\*2), 2, 3, 4 and 5 stand** for those groups, as listed in NOTES.md,
  "What is weak".
