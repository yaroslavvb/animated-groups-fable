# Blobs — notes of the designer (13 Nov 2026)

## The idea

`u(x) = Σ_g k(g⁻¹x)` over all elements `g` of the group, the Poincaré series of a comma-shaped bump `k`; dark = `{u > c}`,
with `c` the level at which half of the plane is dark (55 % in the kaleidoscopes \*333, \*442, \*632). The group keeps `u`
whatever `k` is, so the print is a pattern of the orbifold without any fitting, and where two copies come near, their
bumps add up and the commas swell into each other's room: the outline is one level line of one smooth function, with no
corner anywhere. `k` is a soft brush stroke (round Gaussian bumps along a curling spine, big at the head, smaller and
smaller down the tail); `find()` returns one blob of each orbit as polygons on the exact level line.

## The rule and its knobs

- **The frame.** Origin = a rotation centre of the group (the fixed point of its first rotation among `reps`), else the
  foot of `center` on the first mirror or glide axis; x along `e1`; unit = the tile size `sqrt(domainArea)`. A group
  that is turned, scaled and shifted gets the same blobs turned, scaled and shifted (checked: `lab/r5/validate.mjs`).
- **Fixed for all groups:** `SOFT` 0.55 (σ of a bump / the stroke's radius there), `STEP` 0.6 σ between bumps, bumps cut
  at 3.6 σ, `R_TIP` 0.03, `COVER` 0.5, the grid 0.016 tile sizes.
- **Per group, a row of dimensionless numbers in that frame (`STROKES`):** the spine `p` (control points of a clamped
  cubic B-spline, head end first), `r0, rh, th` (radius at the head end, largest radius, where), `q` (the taper),
  `rt` (the tip's radius: 0.05 in 3\*3 and \*632, where six or twelve tails meet), `lobes` (round bumps beside the spine:
  \*333, \*442, \*632 only), `cover`. A row may be an **array of strokes**: \*x has two, so two commas per tile.
- The rows come from a search (`lab/search.mjs`: random and hand-seeded strokes, then hill climbing on what the grid
  says: bare disc, gaps, share of the blob inside the default tile, asymmetry, S-bends of the spine, …), started from
  hand sketches where the layout mattered (632, \*x). `lab/settable.mjs` writes them into the table. No absolute
  coordinates; `group.presets` is not read by `find()`.

## Rounds

(two lines a round: what I saw, what I changed)

1. **o, 2222, 442, 333 by hand.** Saw: the machinery works (field on a torus grid, level by the dark share, one blob
   traced and put on the exact level line); a soft stroke gives a fat clean comma in `o` (bare 0.37), but strokes placed
   by hand ran into their half-turn copies in 2222 and 442 (S-shaped lumps), and a softer brush (σ ≥ 0.7 of the radius)
   grows ears between neighbouring heads. Changed: brush softness fixed at 0.55; the stroke of a group is searched, not
   drawn by hand (random strokes, then hill climbing on bare disc, gaps, in-tile share).
2. **All 17, spine = an arc with growing curvature.** Saw: nine groups fine (bare 0.31–0.48), but the triangle tiles and
   the kaleidoscopes bare 0.6–1.05 (one fat end and an arc cannot reach three corners), `*x` fused into lenses, 2\*22 a
   symmetric lens. Changed: the spine is a cubic Bézier (it can bend near a corner), the head end may be pointed, and
   the score now charges for a hole, a straight spine, a level far from the brush's own, a mark that touches the tile's rim.
3. **All 17, Bézier spine, first official sheet.** Saw: the search now filled the tiles with S-shaped worms, crescents and
   chevrons (bare 0.31–0.45 but no direction or no hand: `o` an S, `xx` a crescent, 632 a chevron star); the four
   kaleidoscopes still bare 0.55–0.85. Changed: a measure of asymmetry in the score (1 − the largest share of the blob
   that a mirror image or the half-turn of it about its centroid covers; a drop, a crescent and an S are near 0, a
   comma 0.3) and a charge for a pointed head; stroke ends seeded deep in the tile's corners. After that: real commas in
   13 groups (bare 0.33–0.50), the kaleidoscopes 0.56–0.67 (`lab/r3-sheet.png`, `lab/r3-zoom.png`).
4. **The kaleidoscopes.** Saw: with every side of the tile a mirror, a single arc-like stroke stays at bare 0.55–0.67
   whatever the dark share (tried 0.50, 0.54, 0.55, 0.58): a corner it does not reach is bare six, eight or twelve
   times over, and a bay that opens to a side is doubled by its mirror image. Round lobes beside the spine fill the
   third corner (bare 0.44–0.50) but make knobbly blobs. Changed: the spine is a clamped cubic B-spline of up to six
   points (four points = the Bézier curve of before), and the search is also started from strokes laid once round
   the inside of the tile, corner after corner ("snails"): what stays bare is then the eye in the middle, which no
   mirror doubles.

(Second run, after the usage limit; the first run's last state is `lab/r5/design.before-r5.js`.)

5. **Fix the worst groups, by the numbers and by eye** (fresh sheet: `OUT/blobs/r5-start-sheet.png`; the triangles at
   `OUT/blobs/r5-hard-zoom.png`). Saw: every number in range, but 632 a "bird" with a straight tail and six needles at
   each 6-fold centre, 3\*3 the same wedge, \*x one sausage the length of its 2.31 × 0.43 strip (the plane read as
   stripes), 4\*2 a lump with bare 0.50, \*333 a claw round a ball, \*632 a twelve-needle sun. Changed: 632 from a hand
   sketch, a comma with its head beside the 2-fold centre and its tail sweeping up and round into the 6-fold centre:
   six tails make a PINWHEEL there (`OUT/blobs/lab2/s632a.png`); \*x two strokes, a comma and its image across the glide
   axis half a tile on (`lab/r5/mkx.mjs`), two hooked commas per tile; 4\*2 a new search (bare 0.50 → 0.38: four-fold
   pinwheels of hooks); the score gained three terms (an S-bend of the spine, a hinge on the bare disc above 0.42, a
   spine that winds round), and `search.mjs` a local mode that keeps a given shape and mends its numbers.
6. **Polish.** Saw: the kaleidoscopes searched without lobes under the new terms got worse (bare 0.51–0.74 against
   0.43–0.45), so they keep the first run's lobed strokes; tails that meet in six or twelve at a corner (3\*3, \*632)
   still end in needles; \*\*, \*2222, 442 bare 0.46–0.48. Changed: a blunter tip there (`rt` 0.05: 0.06 put two \*632
   copies 0.013 apart and 3\*3's channel at 0.033, both found by `validateShapes`, not by the grid); \*\* and 442 by a
   local search with small steps (same shapes, bare 0.479 → 0.464 and 0.455 → 0.404). Checked the finished design with
   the production validator (`lab/r5/validate.mjs`: all 17, and turned, scaled, shifted copies of o, \*x, 632, 3\*3,
   \*632, 22x without presets: all ok) and in the real app (`OUT/blobs/app-t06.png`: the print takes in all 17, no
   errors, no validator problems).

## Numbers per group

`proto.mjs` (the kit's measure, browser; `OUT/blobs/rows.json`), and the least distance between two copies of the motif
from `src/shapes.js validateShapes` (tile sizes). Bare and solid are diameters in tile sizes.

| group | dark | bare | solid | overlap | verts | ms | gap | marks per tile |
|---|---|---|---|---|---|---|---|---|
| o | 0.502 | 0.359 | 0.540 | 0 | 189 | 7 | 0.115 | 1 |
| 2222 | 0.502 | 0.368 | 0.527 | 0 | 204 | 6 | 0.117 | 1 |
| \*\* | 0.497 | 0.464 | 0.496 | 0 | 191 | 3 | 0.108 | 1 |
| xx | 0.500 | 0.385 | 0.558 | 0 | 181 | 2 | 0.116 | 1 |
| \*x | 0.500 | 0.380 | 0.352 | 0 | 258 | 6 | 0.083 | 2 |
| 333 | 0.499 | 0.385 | 0.581 | 0 | 183 | 3 | 0.160 | 1 |
| 22x | 0.497 | 0.436 | 0.589 | 0 | 193 | 3 | 0.111 | 1 |
| 22\* | 0.503 | 0.480 | 0.559 | 0 | 201 | 3 | 0.080 | 1 (round 7) |
| \*2222 | 0.504 | 0.480 | 0.429 | 0 | 227 | 4 | 0.097 | 1 |
| 2\*22 | 0.499 | 0.505 | 0.576 | 0 | 190 | 3 | 0.076 | 1 (round 7) |
| 442 | 0.504 | 0.404 | 0.434 | 0 | 222 | 4 | 0.084 | 1 |
| 632 | 0.499 | 0.434 | 0.466 | 0 | 200 | 6 | 0.104 | 1 |
| 3\*3 | 0.500 | 0.357 | 0.432 | 0 | 230 | 6 | 0.051 | 1 |
| \*333 | 0.550 | 0.432 | 0.496 | 0 | 358 | 5 | 0.070 | 1 |
| 4\*2 | 0.500 | 0.500 | 0.436 | 0 | 210 | 6 | 0.082 | 1 (round 7) |
| \*442 | 0.550 | 0.436 | 0.455 | 0 | 250 | 9 | 0.040 | 1 (round 7: rt) |
| \*632 | 0.550 | 0.442 | 0.497 | 0 | 229 | 15 | 0.046 | 1 |

(The rows marked round 7 are after the critique, 13 Nov 2026, 23:40; the rest are unchanged and were measured again then,
to the same digits.)

Worst: dark 0.497–0.550, bare 0.505 (2\*22; 0.480 before round 7), solid 0.589 (22x), overlap 0, 358 vertices, 15 ms in the browser
(find() 10–50 ms in node, cold). No blob is mapped onto itself by an element of the group (stabiliser 1) or looks like its
own mirror image or half-turn (the lab's asymmetry ≥ 0.2), so with one orbit of blobs the print's group is the group
itself; for the two orbits of \*x see below.

## What is weak

- **The kaleidoscopes \*333, \*442, \*632 are the weakest.** One blob per chamber at 55 % that reaches all three corners
  is a fat shrunken chamber with a notch, so the first run's strokes carry lobes: \*333 is a claw round a ball, \*442 a
  bird with a knob (it makes a tidy "butterfly" ornament with its mirror images), \*632 a long wedge whose tails make a
  twelve-ray sun at each 6-fold point (blunted, not gone). Their hand is weak: the asymmetry is there (stabiliser 1,
  asymmetry 0.28) but one has to look for it.
- **3\*3** is a long wedge-comma per tile; six tails meet at each \*3 corner (three mirrored pairs). Clean, not pretty.
- **\*x** is two tadpoles per tile, not fat commas: the strip is 0.43 tile sizes wide, so a comma there is at least
  2.5 times as long as it is wide. Both have the same shape (one is the other turned over and moved half a tile), so the
  strip reads A A′ A′ A: no extra symmetry (that move is not in the group and its square is not a translation of it),
  but pairs.
- **The bare disc** is above the 0.45 target in \*2222 (0.480) and \*\* (0.464); everything else ≤ 0.442.
- **A table, not a rule:** 17 rows of searched numbers (the brief tolerates a table of dimensionless knobs; a rule would
  be better). The search, not a principle, decides where a comma sits; 632 and \*x were seated by hand and are the best.
- The level `c` comes from sorting the grid samples, so the dark share is exact to about 0.5 % but the outline moves a
  little if the grid does (it does not move between runs: everything is deterministic).

## What I would try next

- The 632 lesson for the other triangles: seat by hand where the tails curl (a pinwheel at a rotation centre reads at
  once), then let the local search mend the numbers. 3\*3 has no such centre on its corners, but its 3-fold centre is
  one: a triskele whose tails curl into it, with the mirrors' corners covered by the heads.
- Two strokes per chamber in the kaleidoscopes (a comma and a smaller one), instead of lobes: two clean marks may read
  better than one knobbly one.
- A larger brush softness in the kaleidoscopes only (the lobes would melt into the body), with the gap rule as the limit.

## After the critique (round 7, second pair of eyes, 13 Nov 2026, 23:23–23:40)

The critique is `CRITIQUE.md` (fresh pictures in `OUT/blobs/crit/`). The design as delivered is kept as `design.v1.js`;
its pictures as `OUT/blobs/*.v1.*`. My tools are in `r6/`: `stats.mjs` (the lab's numbers of every row),
`frames.mjs` (each group's frame, tile and centres), `extrasym.mjs` (a scan for symmetry beyond the group),
`mk2s22.mjs`, `mk42.mjs`, `mk33.mjs` (hand seats), the variant files `v*.json`; searches ran on the mini
(`lab/r5/mini.sh … search.mjs --local 1`, outputs `OUT/blobs/crit/s*.txt`).

What changed, and why:

- **The rule found: seat the comma in a FAT domain, not in the page's thin tile.** In 22\*, 2\*22 and 4\*2 the default
  tile is long or sharp (3.3 : 1, 2.7 : 1, a 45° triangle), the score held the mark inside it (`inTile`), so the mark
  was a swoosh or a chevron with a needle. Each of these groups has a fatter fundamental domain bounded by its own
  mirrors and cut through a rotation centre, and there the comma of the neighbouring group without mirrors fits:
  - **22\***: the half-strip between two mirrors, 0.90 × 1.11, a 2-fold centre in the middle of each short side: the
    shape of 22x's Pocket. 22x's comma, moved in and mended by a local search (no `inTile` term, a hinge on the bare
    disc above 0.42, `wiggle`, `asym`). Was a 1.68-long swoosh in rows; is a fat comma, 1.06 long, the same family as
    22x (`OUT/blobs/crit/r6-22s-a.png`, `-b.png`). Bare 0.380 → 0.480, the fattest place 0.430 → 0.559.
  - **2\*22**: half of a mirror rectangle cut ACROSS its long side (0.82 × 1.22, mirrors on three sides, the 2-fold
    centre in the middle of the cut). A fat curled comma (`r6-2s22-c.png`). Was a 1.49-long swoosh; bare 0.407 → 0.505.
  - **4\*2**: the square (side 1) between the 4-fold centre and a \*2 corner, mirrors on two sides: 442's comma carried
    in (`r6/mk42.mjs`), then a local search. Was a chevron round the 4-fold centre with a needle of a tail lying ON the
    mirror (a double needle with its mirror image); is a pinwheel of four commas round every 4-fold centre
    (`r6-42-b.png`). Bare 0.380 → 0.500.
  The price, stated plainly: (1) the bare disc rises to 0.48–0.505 in these three (target 0.45, cap 0.6); more dark
  (0.53, 0.55) does not lower it, it sits where four or eight copies meet at a mirror corner; (2) the default tile now
  holds a head of one comma and the tail of the next (in-tile share 0.38–0.50 against 0.96–1.0), not one whole mark.
  In the fold the two pieces join into one whole comma across the seam (`crit/r6-changed-t1.png`), which is what the
  fold is meant to show; on the flat tile at t = 0 it is a head here and a tail there.
- **Blunter tips where a feature was under 0.04.** On a finer grid than the search used (h 0.0125 against 0.02),
  4\*2's new tail was 0.034 wide before its tip: `rt` 0.045 makes it 0.051 (the narrowest channel 0.040 → 0.072, bare
  unchanged). The designer's \*442 had a neck and a channel of 0.034: `rt` 0.05 makes them 0.051 and 0.042 (least copy
  gap 0.044 → 0.040, bare 0.441 → 0.429; the bird looks the same).
- **The label**: "Soft commas" (was "Blobs"); the key stays `blobs`. It says what the owner asked for. The hint no longer
  repeats the label: "commas swollen until half the paper is dark: front teal, back sand".

On that finer grid the lab still reads 0.034–0.039 for the narrowest dark place in 2222, \*x, 333, 442, 632, 3\*3 and
\*333, and 0.034 for a channel of \*333 (rows I did not change). It falls as the grid gets finer, it did not move when I
shrank or moved \*333's ball, and at h 0.02 every row reads 0.044 or more: it is the last hundredth of a tapering tip,
not a neck. I left those rows alone and say so here.

Tried and NOT taken (the pictures are in `OUT/blobs/crit/`):

- **3\*3 in its kite** (the mirror triangle cut into three kites round the 3-fold centre: 60°, 90°, 120°, 90°; a fat
  domain), 442's comma carried in and searched (`r6-33-a.png`, `r6-33-b.png`): the three tails swirl into the 3-fold
  centre, but the \*3 corners stay bare (0.60–0.69) and the marks read as loops. The bone of v1 stays.
- **\*\* as xx** (the same tile shape): xx's comma between \*\*'s mirrors leaves 0.60 bare (`r6-pm-a.png`): across a
  mirror, head faces head and tail faces tail, where a glide puts a head beside a tail. The sock's toe kick fills that
  gap; it stays.
- **The kaleidoscopes without lobes** (`r6-kal-a.png`): taking a lobe off \*333 or \*442 gives bare 0.76–0.93, or the
  blobs fuse. The geometry forbids a clean comma there: the chamber is a triangle, every corner of it must be within
  0.225 of dark, a round head cannot enter a 30° or 60° corner, and a comma has one tail; so the mark must be a "fat
  shrunken chamber" with a notch, and the lobes do real work. They stay as they are.
- **A blunter tail in 632** (`r6-632-a.png`, `rt` 0.05): the dark needles get thicker but the white ones between them
  thinner (channel 0.093 → 0.062). No clear win; not taken.

Checked (final design, 23:38): `lab/r5/validate.mjs` (src/shapes.js `validateShapes`) passes for all 17 and for
turned, scaled, shifted copies (without presets) of o, \*x, 632, 3\*3, \*632, 22x, 22\*, 2\*22, 4\*2, \*442 (37 checks;
identical vertices and gaps: the new rows are frame-invariant); `r6/extrasym.mjs` finds no symmetry beyond the group in
any of the 17 (it does find planted ones); `proto.mjs` numbers above (`OUT/blobs/rows.json`); `app-sheet.mjs` at t = 0,
0.6, 1: the print takes in all 17, no page errors, no validator problems (`OUT/blobs/app-t*.json`); the whole suite on
the mini, 864 tests, 0 failing (`OUT/blobs/crit/suite.txt`; a first run failed in a file of another agent and was green
when run again; no test imports this design).

## In the fold (round 7)

What I saw in the standard set (`OUT/blobs/app-*.png`) and in closer shots (`OUT/blobs/crit/fold-t06.png`,
`fold-t1.png`, `r6-changed-t06.png`, `r6-changed-t1.png`):

- **Which side is up**: always clear. The front's teal and the back's sand both carry the marks (`app-back.png`), and on
  the Möbius band, the Klein bottle and the cross-cap one sees the paper turn over.
- **Where the head and tail went**: easy where the mark is a comma and the shape stays open: the Möbius band (\*x: two
  commas, whole), the cross-cap (22x: the comma curls into the double line), the pillowcase (22\*: its two pieces now
  close into one comma), the cones of 2\*22, 442, 333, the flat kaleidoscope chambers. Seams close without a break, by
  construction; the re-cut keeps the marks in register (`app-recut.png`), and the Tile step shows commas turning about
  the centres (`app-tile.png`).
- **Weak**: the closed torus and Klein bottle carry one mark over half their surface: on the tube it is a broad band
  and the comma's shape is lost at t = 1 (the checkerboard shows the bending of a tube better). The kaleidoscopes'
  ghost at t = 0 is an ornament (a twelve-ray sun in \*632, butterflies in \*442, lace in \*333), and the closed
  chamber shows the boot, the bird and the claw, not a comma. 4\*2's cone shows the new pinwheel comma only in part
  (the cone is narrow); 3\*3's cone a band.
- **Calmer or busier than the checkerboard**: calmer wherever the mark is a comma (12 of 17 now); busier in the three
  kaleidoscopes and 3\*3.
- **Still weak, by rank**: the kaleidoscopes \*632, \*442, \*333 and 3\*3 (ornaments; the hand takes looking for), the
  bare disc 0.48–0.505 in 22\*, 2\*22, 4\*2, \*2222 (target 0.45), \*x's thin tadpoles in stripes, \*\*'s sock.

## Polish (14 Nov)

The pattern ships tonight as the page's **Soft commas** (key `soft`; the integrator copies `design.js` to
`src/patterns/soft.js`). This round did the judges' MUST FIX list (`dev/patterns/round2/judges-blobs.md`), the new \*x
strip of 13 Nov (SPEC 10.2: the tile is 1.2 × 0.6, 1.414 × 0.707 tile sizes, no longer 1.6 × 0.3), and the optional
eye. The design as the judges saw it is `design.v3.js`; its pictures are `OUT/blobs/*.v3.*`. Tools of this round:
`polish/` (below).

What changed, and why:

- **meta**: `{ key: 'soft', label: 'Soft commas', hint: 'big soft commas with an eye, half the paper dark' }`.
- **\*x, first** (its lattice changed under it: the two old strokes overlapped their copies by 50 % on the new strip).
  ONE comma per tile now, a boteh: a round head at one end, the body along the strip, the tail curling up and back,
  clear of the mirror (copy gap 0.060). The glide turns it over in the next tile, the mirror in the strip beside it,
  so the plane is a checkerboard of the comma and its mirror image (teal front, sand back). The two near-copies per
  tile that read at half the period are gone: the dark that stays dark under the half glide step is 0.72 of it (chance
  0.5; judge-math measured 0.888 for the two-comma tile), and `r6/extrasym.mjs` finds no symmetry beyond the group.
  Bare 0.436. Searched (`polish/search2.mjs`, from hand seeds `polish/mkx.mjs`) on a fine grid, with the copy gap held.
- **The eye** (the judges' optional item; three of five asked for it): a light hole 0.111–0.127 tile sizes across
  (`EYE` = 0.065, the radius asked of it) in the head of every comma (in the big comma where a tile has two or three),
  made by a deep narrow dip of u where u is highest within 1.6 head radii of the head (`eyeBead`), so it sits in the
  middle of the round head in every group; the level is set with the dip in place, so the paper stays half dark. In the flat print each comma becomes a tomoe /
  magatama comma whose head is plain at a glance; in 3D it is a white dot on the head, on the front and on the sand
  back: plain on the Möbius band, on the back of the 2222 pillow and in the closed chambers of \*2222 and \*442
  (`app-back.png`, `app-t1.png`), too small to matter at the size of the closed torus. It costs no calm that I can see
  (`sheet.png`, `zoom.png`), so it stays. `EYE = 0` in `design.js` takes it out everywhere; a row may say `eye: 0`.
- **The kaleidoscopes and 3\*3** (\*333, \*442, \*632, 3\*3): one mark per tile fused with its mirror images into bones,
  crosses, birds and suns. Each now holds a big comma (with the eye) and one small comma (3\*3, \*442, \*632) or two
  (\*333), every one clear of the mirrors (copy gaps 0.046–0.083), as paisley does. Searched with
  `polish/search2.mjs` (K strokes, `polish/an2.mjs` scores every blob: head, hand, a spine that does not pinch, the
  gap between copies, a smooth stand-in for the bare disc), from seeds laid as paisley lays them (`polish/mkk.mjs`).
- **632**: six commas now whirl round each 6-fold centre with their BODIES next to it (the nearest dark 0.18 from the
  centre; it was the tips of six needle tails); the tails sweep outward. The 6-fold centre reads as a whirl, not a
  starburst. Bare 0.434 → 0.368.
- **\*632's 6-fold centre**: the tails of the big commas still point at it (a corner of 30 degrees takes nothing round:
  dark must come within 0.225 of the centre for a bare disc under 0.45, and in that sector anything dark is under 0.09
  wide); they now end 0.2 short of it, blunt (tip radius 0.04), so the centre is a white star, not a point where twelve
  needles meet. Every arrangement that kept them further off left a bare disc of 0.6 or more there.
- **The bare disc** in 2\*22, 4\*2, 22\*, \*2222, \*\*: searched again with the copy gap held (`polish/search2.mjs` on a
  fine grid; for 22\* and 2\*22 last of all on proto's own measure, `polish/psearch.mjs`): 4\*2 0.500 → 0.399, \*2222
  0.480 → 0.404, \*\* 0.464 → 0.436 (a comma with its head low and its tail curling over, in place of the sock), 22\*
  0.480 → 0.442 (the same comma), 2\*22 0.505 → 0.455 (the same comma; see What is still weak).
- **Speed**: the eye's dip is added to the field already computed (`solve(..., { base, extra })`), not a second field:
  find() is 3–18 ms in the mini's Chrome (proto), \*632 the slowest.

Numbers per group: proto.mjs (`OUT/blobs/rows.json`; dark share, bare and solid disc diameters in tile sizes, ms in
the mini's Chrome), the least distance between two copies from `src/shapes.js validateShapes` (tile sizes), marks
per tile.

| group | dark | bare | solid | overlap | verts | ms | copy gap | marks per tile |
|---|---|---|---|---|---|---|---|---|
| o | 0.502 | 0.359 | 0.407 | 0 | 235 | 8 | 0.110 | 1 |
| 2222 | 0.498 | 0.364 | 0.404 | 0 | 251 | 6 | 0.108 | 1 |
| \*\* | 0.500 | 0.436 | 0.385 | 0 | 277 | 4 | 0.068 | 1 (new) |
| xx | 0.499 | 0.385 | 0.418 | 0 | 228 | 3 | 0.105 | 1 |
| \*x | 0.500 | 0.436 | 0.385 | 0 | 270 | 3 | 0.060 | 1 (new; was 2) |
| 333 | 0.501 | 0.380 | 0.430 | 0 | 229 | 4 | 0.150 | 1 |
| 22x | 0.501 | 0.436 | 0.404 | 0 | 240 | 4 | 0.105 | 1 |
| 22\* | 0.500 | 0.442 | 0.386 | 0 | 256 | 4 | 0.043 | 1 (mended) |
| \*2222 | 0.492 | 0.404 | 0.357 | 0 | 295 | 4 | 0.067 | 1 (mended) |
| 2\*22 | 0.500 | 0.455 | 0.399 | 0 | 242 | 5 | 0.055 | 1 (mended) |
| 442 | 0.501 | 0.404 | 0.393 | 0 | 269 | 4 | 0.077 | 1 |
| 632 | 0.501 | 0.368 | 0.430 | 0 | 224 | 7 | 0.132 | 1 (new) |
| 3\*3 | 0.502 | 0.359 | 0.329 | 0 | 340 | 8 | 0.083 | 2 (new) |
| \*333 | 0.494 | 0.386 | 0.357 | 0 | 391 | 8 | 0.061 | 3 (new) |
| 4\*2 | 0.499 | 0.399 | 0.380 | 0 | 262 | 8 | 0.079 | 1 (mended) |
| \*442 | 0.501 | 0.393 | 0.407 | 0 | 322 | 11 | 0.049 | 2 (new) |
| \*632 | 0.500 | 0.430 | 0.399 | 0 | 337 | 18 | 0.046 | 2 (new) |

Worst: dark 0.492–0.502, bare 0.455 (2\*22), solid 0.430, overlap 0, 391 vertices, 18 ms in the browser (find() in node
on this Mac 10–55 ms, cold). The solid disc is smaller than before everywhere (0.33–0.43 against 0.43–0.59): the
largest dark disc now goes round the eye. THIN: none in any group (`polish/check.mjs`, thinParts at 1.5 texels: the
longest thin run is 0 texels in all 17).

Checked (final design): `polish/check.mjs` — src/shapes.js makeShapePrint + printable + validateShapes + thinParts
for all 17 groups and for two turned, scaled and shifted copies of each that carry no presets (test/pattern.test.js
`moved`): all printable, no rule broken, the same vertices and gaps in the moved copies, no THIN; `r6/extrasym.mjs`:
no symmetry beyond the group in any of the 17; `polish/halfstep.mjs` for \*x (above); the standard set of pictures in
`OUT/blobs/` (sheet, zoom, back, rows.json, app-t0, app-t06, app-t1, app-back, app-phone, app-recut, app-tile): the
print takes in all 17 groups at t = 0, 0.6 and 1 with no page errors and no RULES or THIN lines.

The tools (`polish/`): `remote.sh` + `driver.sh` (searches on a lab box, never on this Mac), `search2.mjs` (K strokes),
`psearch.mjs` (proto's measure), `an2.mjs` (the numbers of every blob; `copyGap`, the narrowest channel between two
different copies), `view2.mjs` (contact sheets in node), `eval.mjs`, `vscan.mjs` (candidates through the page's own
checks), `pmeasure.mjs` (proto's numbers in node), `barewhere.mjs` (where proto's bare disc is), `check.mjs`,
`halfstep.mjs`, `setrows.mjs` (rows into the table in place), `mkx.mjs`, `mkk.mjs` (hand seeds), `covers.mjs`,
`eye-test.mjs`, `peak-vs-solid.mjs`, `final.sh` (the pictures). Their outputs are in `OUT/blobs/polish/`.

What is still weak:

- **2\*22's bare disc is 0.455, over the 0.45 asked** (it was 0.505). It sits on the 2\* mirror corners where four
  copies meet; every search (coarse, fine, and on proto's own measure, with the copy gap down to 0.038) and every
  nudge of the comma stopped at 0.455, and a darker paper (0.51–0.53) did not move it either. A comma that brings its
  round head into that corner would do it; I did not find one that stays a calm comma.
- **The kaleidoscopes still make rosettes at their corners.** Two or three commas per chamber read as commas (each
  big one has its eye), and no mark runs into its mirror image any more, but whatever reaches a corner where eight or
  twelve copies meet is repeated round it: in \*632 the big commas' tails make a twelve-pointed white star round the
  6-fold centre (tips 0.2 short of it), in \*442 the small commas make square frames round the 4-fold centres, in
  \*333 the small marks are short worms more than commas. Calmer than the bones, birds and suns of before, still busier
  than the other 13 groups.
- **22\*'s copy gap is 0.043** (a head and its mirror image come close across the mirror), \*442 0.049, \*632 0.046:
  under the 0.06 of most groups, over the kit's 0.02.
- A table of searched rows, not a rule (as before); 3\*3, \*333, \*442, \*632 have two or three rows each.
