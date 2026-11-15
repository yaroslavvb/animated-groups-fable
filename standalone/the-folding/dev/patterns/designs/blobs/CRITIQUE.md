# Blobs — the critique (13 Nov 2026, 23:09–23:23, second pair of eyes; status added 23:33)

Fresh pictures of the design as delivered (`design.v1.js`), all in `OUT/blobs/crit/`: the flat sheet with its numbers
(`sheet.png`, `rows.json`), closer looks (`close-a.png`, `close-b.png`, `close-c.png`, 520 px), the tiles
(`zoom.png`), the sand side (`back.png`), the lab's view of the six hard groups with the largest bare disc in red
(`lab-hard.png`), and the real app: `app-t0.png`, `app-t06.png`, the fold pane alone at t = 0.6 and 1 (`fold-t06.png`,
`fold-t1.png`), the back (`app-back.png`), a phone (`app-phone.png`), a re-cut (`app-recut.png`), the Tile step
(`app-tile.png`). The numbers of `proto.mjs` match the designer's table to the last digit.

Findings, ranked by how much they would bother the owner.

## 1. In the mirror groups the marks are not commas, and the plane reads as ornament (5 of 17 groups)

The owner asked for "more like a comma". In five groups the mark is something else, and the plane shows stars, suns and
butterflies, not commas:

- **\*632**: the mark is a boot with a knob (a lobe at the 60° corner, a toe that runs into the 30° corner). Twelve
  toes make a twelve-ray sunburst at every 6-fold corner; the sun is what one sees, in the plane and in the 3D pane's
  ghost at t = 0 (`app-t0.png`).
- **\*442**: "a bird with a knob". With its mirror images it makes butterflies and four-armed propellers.
- **\*333**: "a claw round a ball": a hook that nearly closes round a separate-looking ball. Busy, lace-like, the
  most knobbly mark of the set (358 vertices, a channel of 0.054 between claw and ball).
- **3\*3**: a long bone (a wedge 2.0 tile sizes long with a bump), six ends meet at every \*3 corner as a six-pointed
  star. Reads as a bone, not a comma.
- **4\*2**: a fat chevron hook round the 4-fold centre and a long needle of a tail lying ON the mirror; with its mirror
  image it makes a double needle along every mirror line.

At t = 1 the closed kaleidoscope IS the chamber, so the owner looks straight at the boot, the bird and the claw
(`fold-t1.png`). The hand is there (stabiliser 1, asymmetry about 0.28) but it takes looking for. The designer says so;
I rank it first because it is where the idea visibly breaks.

## 2. Stripes of swooshes in the long tiles: \*x, 22\*, 2\*22

The default tiles of these three are long (2\*22 2.7 : 1, 22\* 3.3 : 1, \*x two marks in 5.3 : 1), the mark is held in
the tile, so it is a long low swoosh: 1.68 long in 22\*, 1.49 in 2\*22, with no head to speak of (the fattest disc
0.43–0.46 against 0.54–0.59 in o, xx, 333, 22x). The plane reads as rows of horizontal waves (`close-b.png`), not as
commas. \*x is two thin tadpoles per strip (fattest disc 0.35) all pointing the same way: stripes again.

## 3. Not one family

Fat commas in o, xx, 333, 22x, 442 and 2222 (a curled one); a sock with a toe kick in \*\* (an S-bend, asymmetry 0.21,
the lowest of all); C-hooks in \*2222; swooshes in 22\*, 2\*22; tadpoles in \*x; a tadpole pinwheel in 632; ornaments in
the five of finding 1. "One idea carried through all 17 groups" holds for the six good groups only.

## 4. Needles where tails meet

Six tails run straight into each 6-fold centre of 632 (white needles between them), six thin ends meet at the \*3
corners of 3\*3, twelve at the \*6 corners of \*632, and 4\*2's tails lie on the mirror. The lab grid says no dark feature
is under 0.044 and no channel under 0.045 (and `validateShapes` passes), so no hard rule breaks, but the eye sees
hairlines converging on points: the opposite of "calm, bold".

## 5. The bare-disc target is missed in two groups

\*2222 0.480 (the bays of two C-hooks face each other across a mirror: one bare ellipse), \*\* 0.464 (between the
socks' necks). Every other group 0.36–0.446. The 0.6 cap holds everywhere; dark share 0.497–0.550 everywhere; overlap
0; at most 358 vertices; at most 19 ms in the browser.

## 6. In the fold

- **Good.** Both sides read (teal and sand, `app-back.png`); one can tell which side is up. Marks cut by a seam join up
  when it closes (by construction; seen on the Möbius band, the cross-cap, the cones). The re-cut keeps the marks in
  register (`app-recut.png`: the comma of xx reassembles after the glide), and the Tile step shows commas turning about
  the 3-fold centres of 333 (`app-tile.png`). On a phone the marks are large enough (`app-phone.png`). The 3D picture
  is calmer than the checkerboard's wherever the mark is a comma.
- **Weak.** One mark per tile means the closed torus and Klein bottle carry ONE mark over half their surface: it wraps
  round the tube as a broad band and the comma's shape is lost at t = 1 (`fold-t1.png`, o: a sand torus with a darker
  band). The checkerboard shows the bending of a tube better. Inherent to "one big comma per tile"; I note it, I do
  not fight it.
- In the kaleidoscopes the 3D pane at t = 0 shows the ghost tiles: a sunburst (\*632), a butterfly tile (\*442), a
  lace doily (\*333) (finding 1 again).

## 7. The symmetry claim holds

With one orbit of blobs, each blob asymmetric (stabiliser 1), an isometry h that keeps the print maps the home blob B
onto some g(B), so g⁻¹h keeps B and is the identity: the print's group is exactly the group. \*x has two orbits; I
scanned every isometry whose linear part keeps the lattice and whose translation lies on a 1/12 grid of the lattice
(`r6/extrasym.mjs`, 300 points, 0.6 % tolerance): for all 17 groups it finds exactly the group's own coset
representatives and nothing else. The scan finds planted faults (a disc on a centre of o, xx, 22x gains a half-turn,
a mirror, a half-translation).

## Status after round 7 (13 Nov 2026, details in NOTES.md "After the critique")

- Finding 2 fixed in 22\* and 2\*22 (fat commas seated in a fat domain; 22\* now one family with 22x); \*x unchanged.
- Finding 1 fixed in 4\*2 only (a pinwheel of commas round the 4-fold centres; no needle on the mirror). 3\*3, \*333,
  \*442, \*632 unchanged: every lobe-free or re-seated version I tried left 0.6–0.9 bare or fused.
- Finding 5 is now worse in number: bare 0.48 (22\*), 0.505 (2\*22), 0.50 (4\*2), the price of real commas there.
- Findings 3, 4, 6, 8 stand as written, except where these three groups changed.

## 8. Smaller

- The design is a table of 17 searched rows of knobs, not a rule (tolerated by the brief).
- The good six are very good: o, xx, 333, 22x are exactly what the owner asked for ("this is the comma, but it fills the
  surface").
