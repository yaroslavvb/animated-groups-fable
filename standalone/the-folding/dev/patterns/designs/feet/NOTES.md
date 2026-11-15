# Footprints (`feet`): notes

The designer's notes of the first two runs are kept in `NOTES.v1.md`, and their design in `design.v1.js`. This file
describes the design as it is now, after the art director's round of 13 Nov 2026. That round's findings are in
`CRITIQUE.md`.

## The idea

The mark is a LEFT FOOTPRINT: a sole with a heel, an arch drawn into its inner side and a ball, and five toes as fat
ovals that shrink from the big toe outward. It has a direction (heel to toes) and a hand (big toe and arch on one side).
So a rotated copy turns, and a mirrored or glided copy is a RIGHT foot; a line of alternating left and right feet is the
textbook glide. To fill the paper the foot is not a fixed glyph. It is drawn into a FRAME, a convex polygon whose
copies under the group do not overlap, and takes the frame's shape.
- In 15 groups the frame is the page's default tile, or a part of it, so that tile holds exactly one whole foot.
- In 632 and 3\*3 the frame is a band along a side of the triangle of three tiles round a 3-fold gyration: three feet
  walk round it (see "After the critique").

## The rule and its knobs (design.js)

- `layout(group)` picks the frame and which corners or edges carry the heel and the toes:
  - o: a rectangle along the longer reduced lattice vector.
  - 2222: a brick between two lines of 2-fold centres, cut by the hexagon.
  - Rectangles (`rectSpec`), for \*\*, ××, 22×, 22\*, 2\*22, 442: the inner side goes on a mirror where a long side
    is one.
  - \*×: two feet in line, 0.57 and 0.43 of the strip.
  - \*2222: a broad pad with the toes round a cut front (`roofSpec`).
  - 333: the rhombus, heel in one acute corner, big toe in the other (`bandSpec`).
  - **632, 3\*3 (new): `triPinwheel`.** T is the triangle of the three 6-fold centres (632) or `*3` points (3\*3)
    round a 3-fold gyration G. It holds exactly three tiles, which the rotations about G carry onto each other.
    - The frame is a band along one side AB of T, 0.266 of the side wide (0.70 tile sizes): an isosceles trapezoid
      with 60° corners on its inner side, whose ends are parallel to T's other two sides.
    - The heel is in T's corner A and the toes are at the next foot's outer side.
    - The inner side lies on AB. In 3\*3 AB is a mirror; in 632 it carries a half-turn.
  - The kaleidoscope triangles (\*333, \*442, \*632) and 4\*2: the heel in a thin corner, the toes along the far
    side, the big toe at the most forward corner.
- `leftFoot(frame, toe, heel, o)` draws the foot:
  - the frame is inset by `delta` (0.036 tile sizes, so a channel between two feet is 0.072);
  - five toes are placed along the front, each touching the inset front, `gapToe` 0.046 apart; they spread up to
    `gapToeMax` 0.085 and grow up to `toeCapHard` 0.285 to span a long front;
  - each toe clips the sole behind a line;
  - the heel tapers. `taperIn` and `taperOut` are now options per frame; the pinwheel uses taperIn 0 and taperOut 0.28,
    so its heel keeps the inner corner in T's corner and is narrower than the ball on the outer side;
  - the corners are rounded (`rSide`, `rApex`), but never so much that a frame corner stays bare beyond `bare` (0.19;
    0.21 at the pinwheel's heel);
  - the arch is pushed into the inner side (`notch` 0.11, at most `notchRel` of the width);
  - the outline is a closed cubic B-spline, sampled at `h` 0.013.
- `find()` loops: a foot darker than `coverMax` 0.585 is drawn leaner, and a sole that holds a disc wider than
  `solidMax` 0.665 is pushed back from its toes.
- Everything is in local coordinates: origin at `group.center`, unit = one tile size. Without `presets` the frame comes
  from a seed found by rule (`ruleSeed`), so a turned, scaled and shifted group gets the same foot. The pinwheel needs no
  seed: T comes from the group's own centres, and any of T's three feet gives the same print.

## The numbers (proto.mjs, kit.measure; rows.json of 13 Nov, after the critique)

| group | dark | bare ⌀ | solid ⌀ | verts | ms | feet | big toe | little toe | channel |
|---|---|---|---|---|---|---|---|---|---|
| o | 0.551 | 0.337 | 0.536 | 415 | 7 | 1 | 0.145 | 0.064 | 0.072 |
| 2222 | 0.519 | 0.339 | 0.643 | 411 | 7 | 1 | 0.203 | 0.089 | 0.072 |
| ** | 0.587 | 0.429 | 0.571 | 416 | 2 | 1 | 0.149 | 0.066 | 0.072 |
| xx | 0.567 | 0.354 | 0.571 | 419 | 2 | 1 | 0.159 | 0.070 | 0.072 |
| *x | 0.468 | 0.407 | 0.357 | 678 | 4 | 2 | 0.092 | 0.041 | 0.054 |
| 333 | 0.578 | 0.394 | 0.643 | 409 | 3 | 1 | 0.191 | 0.084 | 0.072 |
| 22x | 0.580 | 0.368 | 0.667 | 425 | 2 | 1 | 0.192 | 0.084 | 0.072 |
| 22* | 0.545 | 0.385 | 0.464 | 403 | 2 | 1 | 0.117 | 0.051 | 0.069 |
| *2222 | 0.529 | 0.380 | 0.667 | 405 | 5 | 1 | 0.220 | 0.097 | 0.072 |
| 2*22 | 0.575 | 0.430 | 0.505 | 418 | 6 | 1 | 0.119 | 0.053 | 0.080 |
| 442 | 0.583 | 0.418 | 0.643 | 430 | 2 | 1 | 0.239 | 0.105 | 0.072 |
| **632** | 0.570 | 0.429 | 0.576 | 445 | 3 | 1 | 0.159 | 0.070 | 0.072 |
| **3*3** | 0.582 | 0.429 | 0.591 | 444 | 4 | 1 | 0.156 | 0.069 | 0.080 |
| *333 | 0.576 | 0.432 | 0.571 | 419 | 2 | 1 | 0.285 | 0.125 | 0.072 |
| 4*2 | 0.542 | 0.430 | 0.505 | 407 | 2 | 1 | 0.285 | 0.125 | 0.072 |
| *442 | 0.542 | 0.430 | 0.505 | 407 | 2 | 1 | 0.285 | 0.125 | 0.072 |
| *632 | 0.592 | 0.430 | 0.589 | 418 | 6 | 1 | 0.226 | 0.100 | 0.072 |

Bold rows changed in this round.
- Before, 632 and 3\*3 were both 0.563 / 0.399 / 0.496 / 398 points, with big toe 0.200, little toe 0.088 and
  channel 0.060.
- Overlap is 0 everywhere. Ranges: dark 0.468 to 0.592, bare at most 0.432, solid at most 0.667, at most 678 vertices,
  at most 7 ms in the browser (21 ms in node, the slowest first call).

How it was checked (this round, on the final design):
- `scratch/verify.mjs`: exact, no grid.
  - Copies are at least 0.054 apart, and two marks of one foot at least 0.043 apart.
  - The curve step is at most 0.015, and no vertex turns by more than 16°.
  - The same result in four places: the group as it is, and three turned, scaled and shifted copies without presets.
- `scratch/validate.mjs`: the production check, `src/shapes.js` `validateShapes` on `makeShapePrint`. All 17 groups are
  ok in all four places, stabilizer 1 everywhere, so the print's group is exactly the group.
- `app-sheet.mjs --json` at t 0, 0.6 and 1 (`app-t0.json`, `app-t06.json`, `app-t1.json`): in all 17 groups the print
  took, the page had no errors, there were no validator problems, and the stabilizer was 1.
- No test of the suite loads a design (`grep designs/ test/`), so the suite was not rerun for this folder.

## After the critique

The critique (`CRITIQUE.md`) ranked six findings. The worst: a third of the selector (632, 3\*3, \*333, 4\*2, \*442,
\*632) showed wedges and fins, not footprints. What changed, and why:

1. **632 and 3\*3: three feet walking round a triangle (kept).**
   - **Why.** Their tile is a 30-30-120 triangle 2.6 long and 0.76 tall. Any foot inside it is a fin with a spiked heel
     and a 30° toe end, and the plane read as a starfish. T, the triangle of three tiles round the 3-fold gyration, has
     room for three slim feet in a pinwheel.
   - **The shape** (the single foot, `r14-one.png`, `r15-one.png`): a footprint on its side. It is about 1.5 long
     (read off the picture) and 0.63 wide (`info.width`; o's foot is 0.56 wide), with a narrower heel, the arch on the
     inner side, a broad ball, and five toes receding from the big toe by 30°. A real foot's toe line, big-toe tip to
     little-toe tip, recedes about 30° too.
   - **The plane** (`r16-632.svg.png`, `r16-33.svg.png`, `sheet.png`, `zoom.png`):
     - six heels meet round every 6-fold centre (632) or `*3` point (3\*3), like people standing back to back;
     - three feet whirl round every 3-fold gyration;
     - in 632 two left feet pass head to tail across every 2-fold centre;
     - in 3\*3 a left and a right foot stand in step across every mirror: heels together, toes splayed in a V, arches
       facing.
     All three rotations, and the mirrors, read at a glance.
   - **Numbers**: dark 0.570 and 0.582, bare 0.429, solid 0.576 and 0.591, big toe 0.16, little toe 0.07.
   - **Tried and dropped on the way:**
     - the band 0.62 wide: the foot too long (aspect 3.4), bare 0.40;
     - the designer's heel taper: it pulled the heel out of T's corner, bare 0.59 at the 6-fold centre (`r11-*`);
     - no taper: a banana-shaped sole (`r12-*`);
     - taperOut 0.4: a club-shaped sole, propeller blades in the plane (`r14-*`);
     - heel corner limit 0.225: rounder, but bare 0.472 (`r15-*`).
   - **The cost: (d).** The main foot's outer heel lies over the default tile's edge AG. The tile shows the front of the
     foot, its toe column, and at the far corner B a dark wedge, which is that same heel's outer part (the rotation
     about G glues AG to BG). On the flat tile that is two dark masses with the toes between. When the tile closes,
     they are one heel at the 6-fold (or `*3`) cone point.
2. **The other triangle groups: not changed. No better arrangement exists within the rules.**
   - \*333, \*442, \*632: every edge is a mirror, so a chiral foot must stay inside one chamber, a triangle. It is a
     wedge whatever is drawn.
   - 4\*2 and 442: the analogous pinwheel of four feet in a square leaves a hole of side 2 − 2w at the square's
     4-fold centre. Bare 0.45 needs w ≥ 0.8, a foot of 1.2 by 0.8: no slimmer than today's.
   - 442: the basketweave pinwheel (rectangles of 1.56 by 1.26, two feet passing in each, round a 0.3 hole) gives
     proper feet of 1.56 by 0.63. But the feet lie at 37° to the lattice, so the unit-square tile would hold only
     slices of three feet. Not built.
3. **The squat paws (2222, 333, \*2222, 22×): not changed.**
   - A slimmer foot needs either a narrower heel or a frame across the tile's edges.
   - The narrower heel opens bare corners where four heels meet (the designer measured 0.48 in 442).
   - A frame across the edges gives slices in the default tile: 2222's long brick sticks out of the hexagon at both
     the heel and the toes.
   - In 333 the band's ends must be 60° points, so the toes run down the side. That is why it reads as a paw.
4. **Toes in the long frames (\*×, 22\*, 2\*22): not changed.** Their frames are fixed by the group:
   - \*×'s strip between adjacent mirrors is 0.433 wide;
   - 22\* and 2\*22 are 0.555 and 0.612 wide.

   Five toes in that width cannot be bigger.

## In the fold

What I saw in the real app (`app-t0.png`, `app-t06.png`, `app-t1.png`, `app-back.png`, `app-phone.png`,
`app-recut.png`, `app-tile.png`; closer looks `c1-fold06a/b.png`, `c1-fold1.png`, `r16-fold1-tri.png`,
`r16-fold1-under.png`, `r16-tile-tri.png`, `r16-phone-tri.png`):

- **Which side is up** can always be told: front teal, back sand. Both tones of the sand side carry the soles and toes.
  The page's camera shows most closed pillows and cones from the sand side (2222, 333, 442, 632, 3\*3, 4\*2, 22\*,
  2\*22), at lower contrast.
- **Following the parts.**
  - Each face of a closed surface carries one big sole and a row of toes, so heel and toes say where the tile's ends
    went.
  - Best: \*\* (a whole footprint curled on the annulus), \*× (soles and toe rows run round the Möbius band), 22× (the
    toe row on the sand side of the cross-cap), \*2222, \*333, \*442, \*632 (a whole foot on the flat folded triangle).
  - In 632 and 3\*3 the pinwheel foot closes up: the heel piece at the tile's far corner joins its foot at the
    cone point, and on the closed pillow the sole runs whole from the 6 (or `*3`) corner.
- **Thin and curved parts.**
  - On the torus (o) and the Klein bottle (××) the foot wraps a thin tube: a teal or sand band and a few dots. Nothing
    there reads as a foot. That is the weakest picture of the set, and it comes from one big mark per tile.
- **Seams.**
  - Marks cut by a seam join up when it closes. The print is the group's, so this holds by construction.
  - The re-cut of ×× and 22× keeps the print in register: a whole foot on the re-cut tile.
  - On the Tile step the cards carry it. In 632 and 3\*3 the pinwheel assembles as the cards arrive.
- **Calm.** One sole and one row of toes per face: calmer than the checkerboard. The busiest are the kaleidoscopes'
  ghost stars at t 0 (\*333, \*442, \*632): a rosette of wedges with toe ladders.
- **Phone.** The tile is about 120 px. Soles read, and toes are 4 to 8 px dots; in \*× they are 3 to 4 px. On the flat
  632 and 3\*3 tile the heel piece at the far corner can be taken for a second foot.

## What is weak (now)

- **The kaleidoscope triangles, \*333, \*442, \*632 (and 4\*2): wedge feet with toe ladders.**
  - A foot confined to a triangle chamber is a wedge.
  - Its toes lie along a mirror, so the mirror image's toes face them: two rows of five dots. Seen as "left and right
    foot, toe to toe" it is the picture of a mirror; seen as texture it is close to speckle.
- **Squat frames, 2222, 333, \*2222, 442, 22×: paw prints.** The big toe keeps the hand, but the foot read is weak,
  worst in \*2222 (a bean) and 333 (toes down the side).
- **632 and 3\*3 break "one whole foot in the default tile"**: the heel crosses the tile's edge (see above).
- **\*× has the smallest features**: little toe 0.041, channel 0.054. They pass the 0.04 floor only just.
- **The torus and the Klein bottle in 3D**: the foot is not legible on a thin tube.

## Rounds

1. *First run, 16:12 to 16:19 (r1-easy.png).* Seen: the fitted foot reads at once in o and 2222; 442's square left a
   bare corner of 0.55. Changed: the toes spread and grow along a long front.
2. *First run, to 16:31 (r2-all.png).* Seen: all 17 drawn. Seven groups were over budget (\*2222 bare 0.61 / solid 0.73,
   \*333 0.59, \*442 0.60, 2222 0.51, 333 0.50, \*632 0.48, 442 0.48). Changed: the frames per group (the 2222 brick,
   `roofSpec` for \*2222, `bandSpec` for 333, the heel in the thin corner of the triangles).
3. *First run, to 17:18 (r3 to r9).* Seen: the worst groups by the numbers. Changed: the round of a corner is capped by
   `bare`; the lean and push-back loop (`coverMax`, `solidMax`); the 'straight' front for the 30-30-120 triangle; the
   facing arches on mirrors. Every group within budget since r4.
4. *Second run, 22:35 to 23:00 (r10 to x8).* The designer's last round: four structural alternatives were tested and
   dropped (x1 to x8). `gapToe` went to 0.046 and `gapToeMin` to 0.043.
5. *The art director's round, from 23:00 (c1-\*, r11 to r16; CRITIQUE.md).*
   - Fresh pictures of design.v1.js (c1-\*), flat and in the app, and the critique.
   - Then the triangle pinwheel for 632 and 3\*3 in five steps (r11 to r16, above).
   - The heel taper became an option per frame (`taperIn`, `taperOut`, `taperReach`).
   - The final standard set (sheet, rows, zoom, back, app-t0 / t06 / t1, app-back, app-phone, app-recut, app-tile)
     was made fresh, from the final design.js. The first run's set is kept as `*.v1.png` / `*.v1.json`.

Pictures: `~/drive.unsynced/artifacts/the-folding-patterns/feet/`.
