# Letter F (key `glyph`): design notes, 13 Nov 2026

## The idea

One bold letter F per tile, with a full stop: the crystallographer's own asymmetric mark. It has a direction (top to
foot) and a hand (the arms are on one side), and a mirrored letter is seen as wrong at once, so rotations, mirrors and
glides read at a glance. The F is not stamped into the tile, it is built from the tile: stem along one side, top arm
along the next, and what the far sides cut off is cut off, so a rectangle carries an upright F, a parallelogram an
italic one and a right triangle an F whose hull is the triangle.

I did not draw the other letters of the brief; I ruled them out by their shape. R, G and P need a counter (a hole) and
a rectangular hull, so they do not survive a triangle or a strong shear; 7 and J cover too little. F is the only one
whose hull is a right triangle, the shape of the tile in 4\*2, \*442 and \*632.

## The rule

`find(group)` in `design.js`; the knobs are the object `K` there, lengths in tile sizes.

1. **The tile.** The Dirichlet tile of the page's default seed when `group.presets` exists, so the default tile holds
   the whole F and its F is no mirror image. Without presets, a seed found from the symmetry elements (`ruleSeed`):
   the lattice cell (o), half way from the inner centre to its nearest mirror (22\*, 2\*22, 3\*3, 4\*2), the chamber
   (kaleidoscopes), the middle line of the strip (\*\*, \*x), the nearest glide axis (xx), half way between the two
   nearest centres (22x, 333), the point farthest from every centre (2222, 442), half way from a 2-fold centre to a
   3-fold one (632).
2. **Long tiles** (a parallelogram more than `split` = 2.45 times longer than wide) are cut across into equal parts,
   one F each: \*x three, 22\* and 2\*22 two (their two parts are the two faces of the folded shape).
3. **Inset** by `margin` = 0.034: copies stay 0.068 apart, a white channel that draws the tiling.
4. **Frames.** Every corner of the inset tile is tried as the F's top-left corner: stem along the next side, top arm
   along the previous one; at an obtuse corner also an F leaning `italic` = 14 degrees only; in a hexagon also a stem
   along a chord; in a triangle also an upright F on the foot of a height. Always a normal F.
5. **Weight.** Arms `weight` = 0.225 thick, stem 1.14 times that; less where the F's own channels (`gapMin` 0.07) or
   `target` = 0.56 of the tile ask for less.
6. **Bare patches**, measured on the whole pattern, so that bays that meet across a mirror or round a centre count as
   one. While a bare disc over `dotBare` = 0.40 stays: a full stop at the F's foot; else one in the patch if a proper
   one fits (`patchMin`); else the middle arm lower, longer, the F bolder (`targetBold` 0.60). A row of F's always
   ends with its full stop, which also breaks the row's false period.
7. **A chevron is no F.** An F that leans more than 15 degrees with a top arm as long as its stem has its arm stopped
   at `leanArm` = 0.72 of the stem; the rest of the arm stays beyond a channel as a chip in the far corner.
8. **Score**: dark share, bare disc (hard above 0.45), lean, arm over stem, and only to break ties the F standing
   upright on the page (`right`, the one table keyed by group id: two integer pairs, for \*x and 2\*22).
9. **Corners** rounded by 0.034, tips sharper than 70 degrees by 0.02.

## The numbers

The DESIGNER'S version (`design.v1.js`; the numbers after the critique are in "After the critique" below), from
`rows.v1.json` (the kit's `measure`, 56 samples per tile size, Chrome on the mini). Lengths in tile sizes.

| group | dark | bare | solid | pts | ms | F's | frame | lean | weight | stem | arm | extras |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| o | 0.56 | 0.39 | 0.33 | 76 | 12 | 1 | side | 7 | 0.225 | 1.42 | 0.61 | foot |
| 2222 | 0.50 | 0.36 | 0.33 | 84 | 20 | 1 | chord | -1 | 0.225 | 0.95 | 0.77 | foot |
| \*\* | 0.54 | 0.44 | 0.33 | 84 | 10 | 1 | side | 0 | 0.225 | 1.35 | 0.64 | foot |
| xx | 0.54 | 0.32 | 0.33 | 84 | 7 | 1 | side | 0 | 0.225 | 1.31 | 0.66 | foot |
| \*x | 0.53 | 0.42 | 0.23 | 204 | 8 | 3 | side | 0 | 0.147 | 0.70 | 0.36 | foot |
| 333 | 0.49 | 0.32 | 0.32 | 74 | 11 | 1 | italic | 14 | 0.207 | 0.89 | 0.93 | patch |
| 22x | 0.53 | 0.43 | 0.33 | 84 | 8 | 1 | side | 0 | 0.225 | 1.11 | 0.78 | foot |
| 22\* | 0.57 | 0.36 | 0.30 | 144 | 6 | 2 | side | 0 | 0.196 | 0.83 | 0.49 | foot |
| \*2222 | 0.55 | 0.43 | 0.33 | 84 | 10 | 1 | side | 0 | 0.225 | 1.07 | 0.81 | foot |
| 2\*22 | 0.54 | 0.39 | 0.28 | 144 | 8 | 2 | side | 0 | 0.180 | 0.75 | 0.54 | foot |
| 442 | 0.52 | 0.43 | 0.33 | 84 | 10 | 1 | side | 0 | 0.224 | 0.93 | 0.93 | patch |
| 632 | 0.50 | 0.40 | 0.34 | 48 | 3 | 1 | italic | 14 | 0.225 | 1.18 | 0.85 | none |
| 3\*3 | 0.55 | 0.43 | 0.33 | 64 | 7 | 1 | side | 30 | 0.207 | 1.24 | 0.77 | chip, long |
| \*333 | 0.56 | 0.45 | 0.32 | 69 | 16 | 1 | side | -30 | 0.199 | 1.27 | 0.79 | chip |
| 4\*2 | 0.60 | 0.43 | 0.33 | 51 | 8 | 1 | side | 0 | 0.217 | 1.18 | 1.19 | bold |
| \*442 | 0.60 | 0.43 | 0.32 | 51 | 8 | 1 | side | 0 | 0.217 | 1.18 | 1.19 | bold |
| \*632 | 0.58 | 0.40 | 0.30 | 75 | 7 | 1 | side | 0 | 0.205 | 1.50 | 0.92 | patch |

Worst over the 17: dark 0.49 to 0.60, bare 0.447 (\*333; \*\* 0.442), solid 0.337, overlap 0, 204 points, 20 ms.
Today's comma through the same kit: 30 % dark, bare 0.7 to 2.0.

Checked besides: `validate.mjs` puts all 17 through `validateShapes` of `src/shapes.js` (the production form of the
kit's rules): all pass, at home and turned, scaled and shifted without presets; the smallest gap between copies is
0.068 (0.075 in 333). `check.mjs same=1`: without presets 13 groups give the identical pattern; 333, 3\*3, \*333 and
\*632 give one that differs by a symmetry of the tile (as good, not the same).

## What is weak

- **Mirror groups read as bands at small sizes.** In \*442, \*632, 4\*2, 3\*3 and \*333 the stems of mirrored F's lie
  back to back along the mirrors with a 0.068 channel between them. In the highlighted tile the F is clear; in the pale
  field at 330 px the eye sees a lattice of bands before it sees letters.
- **Rows of small F's.** \*x holds three lying F's, 22\* and 2\*22 two. They are 0.70 to 0.83 long but only 0.36 to 0.54
  across and look like chairs; in \*x the stroke is 0.147, the thinnest of the family. The F's of a row are identical;
  only the full stop at the end tells them apart.
- **\*333 and 3\*3 lean 30 degrees** and need the chip, a wedge about 0.2 wide in the far corner. An upright F fills
  only half of an equilateral triangle (bare 0.66); a full-length arm gives a chevron (`r5-varA.png`).
- **The full stop is not always at the foot.** 333, 442 and \*632 have it in the bare patch instead.
- **The home tile's F is not always upright**: tilted 38 degrees in 2222, lying in \*2222 and the rows, turned in the
  triangles. Nothing in the tile allows better without a larger bare patch.
- **About thirty knobs and a discrete search.** A changed lattice gets a valid F, but which corner and which extra
  it gets can jump.
- **Not verified**: the page itself and the 3D fold (only the kit's sheet), WebKit, the distance texture at the chip's
  0.02 tip.

## What I would try next

- A wider channel along mirror sides only, so mirrored stems part and the kaleidoscopes read as letters.
- In the kaleidoscopes, an F standing free in the middle of the chamber with the corners filled otherwise.
- \*x with two longer F's instead of three, and a second look at one F per fundamental domain for 22\* and 2\*22.
- Fewer knobs: fold the lower, longer and bolder variants into one continuous search.

## Rounds

1. Four easy groups, then all 17. Saw: strokes 0.15 to 0.21 hugging the sides, F upside down in \*\* and xx, \*x a key
   with two teeth, bays merging across mirrors (\*\* bare 0.75, 333 bare 0.81). Changed: one weight and a dark target,
   the upright tie-break, bare measured on the whole orbit, the full stop, long tiles cut into parts.
2. All 17 closer. Saw: triangle groups as line lattices, 3\*3 and \*333 as chevrons, a third of 632's tile empty, small
   dots as speckle in \*632; the kit found 0.48 at the 6-fold centres that my grid missed. Changed: weight 0.225,
   target 0.56, the frames on a height and the 14 degree italic, a smaller radius at sharp tips, corners sampled.
3. The three worst (\*333, 3\*3, 4\*2 with \*442). Saw: \*333 as chevron, as half an F (bare 0.66), as a leaning F with
   a short arm (bare 1.0 in the far corner); 3\*3's wedge doubling across its mirror (0.51); bays meeting across the
   hypotenuse (0.46). Changed: the cut arm with its chip, bare above 0.45 scored hard, the bolder variant.
4. Polish. Saw: the long middle arm turning F's into brackets (\*\*, 22x, \*2222), 2222 preferring a patch dot under
   an upside-down F, clean outlines at 2.3 times zoom, the sand side legible. Changed: the long arm only above 0.45, a
   small cost for a patch dot, a row ends with its full stop. Found my own test mover wrong, fixed it, then verified
   the rule without presets.

## Files

- `design.js`: the design (after the critique). `design.v1.js`: the designer's version; `design.v2.js`: the backup
  the critic of the second run made before changing anything (the same bytes as v1: the first run's critic had
  changed nothing). `CRITIQUE.md`: the critique.
- `check.mjs` (time, points, coarse numbers; `moved=1`, `same=1`), `where.mjs` (where the largest bare disc is),
  `explain.mjs` (the frames tried, with scores; each now with `down`, the stem's direction on the page in degrees),
  `validate.mjs` (through `src/shapes.js`; `moved=1`); the critic's `inspect.mjs` (each group's default tile: sides,
  angles, which side is a mirror or a glide) and `knobs.mjs` (the kit's numbers for all 17 with knobs changed).
- Pictures in `~/drive.unsynced/artifacts/the-folding-patterns/glyph/`: the standard set of the README, fresh after
  the critique (`sheet.png`, `rows.json`, `zoom.png`, `back.png`, `app-t0.png`, `app-t06.png` with `app-t06.json`,
  `app-t1.png`, `app-back.png`, `app-phone.png`, `app-recut.png`, `app-tile.png`); the designer's `sheet.v1.png`,
  `zoom.v1.png`, `back.v1.png`, `rows.v1.json`, `close.png`, `r1-sheet.png`, `r4-close.png`, `r5-varA.png`,
  `r5-varB.png`; the critique's pictures in `crit2/` (`v1-*`: the designer's version, flat and in the app;
  `r1-mirrors.png` to `r4-sheet.png`: the rounds; `x-wide.png`, `x-round.png`: two variants that lost;
  `v3-fold-t1.png`: the closed folds after the critique, larger) and the first run's critic's in `crit/`.

## After the critique

Second run, 13 Nov 2026, 22:40 to 00:45; the critique is `CRITIQUE.md`. The concept and the machinery stay the
designer's; four changes, each tried in pictures and kept only where the picture got better.

1. **A V-shaped channel at mirror corners** (critique 1, the fret; `K.cornerWide`). Where two mirrors cross, the inset
   margin is `margin + cornerWide x (angle - 30 deg) / 60 deg`: 0.114 at a right angle (four copies meet; their four
   F corners had closed into a square ring), 0.074 at 60, 0.054 at 45, 0.034 at 30 degrees (eight or twelve tips
   must stay close, or they leave a bare star at the point). A side's inset line runs from the one corner's margin to
   the other's, so an F and its reflection part in a V. Effect: \*2222's F's are islands now (gap 0.23, dark 0.44);
   \*442's F and its reflections separate at the right-angle corner and \*442 no longer needs the bold F (dark 0.60
   to 0.52); \*632 no longer needs its dot (0.58 to 0.52); \*333's channel is 0.148 (0.56 to 0.53). Tried and dropped:
   a uniform wider channel along every mirror (`x-wide.png`: separates strokes, keeps the fret, leaves bare stars at
   the sharp corners and thins \*x to 35 %), rounder corners (`x-round.png`: bubble letters, the same fret).
2. **Lighter where the target binds** (critique 3): `target` 0.56 to 0.53. `targetBold` stays 0.60, used only where
   bare patches demand it (4\*2 and 3\*3). Dark is now 0.44 to 0.60 (designer: 0.49 to 0.60).
3. **No confetti** (critique 6). A full stop on the F's baseline is tried at three places (the far corner as before,
   half way, right after the stem as a period is set) and the one that leaves the smallest bare disc wins; a dot in a
   free bare patch costs 0.05 of the score (`patchCost`, was 0.02) and the lower / longer / bolder variants are judged
   by the bare disc WITHOUT such a dot, so they are tried first. A fifth variant joins the ladder: bolder with the lower,
   longer middle arm (3\*3: bare 0.404, was 0.479 with the lighter target). Effect: no free-floating dot is left in any
   group (333 and 442 have their full stop at the foot now, \*632 and 4\*2 none); the only extras left are full stops at
   an F's foot and the chip of \*333 and 3\*3.
4. **Fewer dead knobs**: a wider margin along every mirror (`mirrorMargin`) and a bonus for an upright F were tried
   and removed: the first did not help (1. above), the second changed no group's choice. Net: `cornerWide` and
   `patchCost` in, one variant more in the ladder.

What did not change, though the critique asked: the rows of lying F's in \*x, 22\* and 2\*22 (an upright F in those
strips is 0.46 tall with strokes of 0.10 and bare up to 0.53; a straddling F would break the default tile into
slices; two different marks per tile give a false rotation or mirror), \*2222's F still lies (an upright F in its
mirror rectangle leaves a bay at the foot that meets its own reflection: bare 0.60 with any full stop), and \*632's F
still stands on its head on the page (in that chamber the only normal F that reaches the 6-fold tip has its top at the
right-angle corner, which is at the bottom).

The numbers (Chrome on the mini, `rows.json`; designer's in brackets where they changed):

| group | dark | bare | solid | pts | extras |
|---|---|---|---|---|---|
| o | 0.56 | 0.393 | 0.329 | 76 | foot |
| 2222 | 0.52 (0.50) | 0.429 (0.364) | 0.329 | 81 | foot, now beside the stem |
| \*\* | 0.54 | 0.442 | 0.329 | 84 | foot |
| xx | 0.54 | 0.321 | 0.329 | 84 | foot |
| \*x | 0.53 | 0.416 | 0.229 | 204 | 3 F's, foot |
| 333 | 0.51 (0.49) | 0.321 | 0.321 | 76 | foot (was a free dot) |
| 22x | 0.53 | 0.429 | 0.329 | 84 | foot |
| 22\* | 0.57 | 0.357 | 0.286 | 144 | 2 F's, foot |
| \*2222 | 0.44 (0.55) | 0.380 (0.430) | 0.329 | 84 | foot, low; V channel |
| 2\*22 | 0.54 | 0.393 | 0.279 | 144 | 2 F's, foot |
| 442 | 0.54 (0.52) | 0.307 (0.429) | 0.329 | 84 | foot (was a free dot) |
| 632 | 0.50 | 0.399 | 0.337 | 48 | none |
| 3\*3 | 0.58 (0.55) | 0.404 (0.432) | 0.357 | 64 | chip, bold + long |
| \*333 | 0.53 (0.56) | 0.393 (0.447) | 0.357 | 71 | chip; V channel |
| 4\*2 | 0.60 | 0.429 | 0.329 | 51 | bold (as the designer's) |
| \*442 | 0.52 (0.60) | 0.393 (0.429) | 0.329 | 45 | none (was bold); V channel |
| \*632 | 0.52 (0.58) | 0.442 (0.399) | 0.329 | 48 | none (was a free dot); V channel |

Worst: dark 0.44 to 0.60, bare 0.442 (\*\*, \*632), solid 0.357, overlap 0, 204 points, 35 ms in Chrome. All 17 pass
`validateShapes` of `src/shapes.js`, at home and turned, scaled and shifted without presets (`validate.mjs moved=1`);
the smallest gap is 0.068 (\*2222 0.228, \*333 0.148, \*442 0.108, \*632 0.077). Without presets 14 groups give the
identical pattern; 333, \*333 and 3\*3 give another one (52.8, 17.8 and 6.2 % of the plane differ; `check.mjs same=1`).
Turned, scaled and shifted without presets the numbers stay within the limits except 3\*3: bare 0.458 at 48 samples
per tile size (`check.mjs moved=1 per=48`; the page always has presets). No test of `test/` imports the design.

## In the fold

Seen in the real app (`app-t0.png`, `app-t06.png`, `app-t1.png`, `app-back.png`, `app-phone.png`, `app-recut.png`,
`app-tile.png`, and larger `crit2/v3-fold-t1.png`; the designer's version in `crit2/v1-*`). The page showed no error
and `validateShapes` no problem in any group (`app-t06.json`).

- **Which side is up** is always clear: the closed shapes show mostly the sand back, with teal where the paper turns.
- **The letter survives where the paper stays flat.** At t = 1 the kaleidoscopes ARE their chamber: \*442 shows a
  clean F, \*333 and \*632 a sheared F, \*2222 an F lying on its stem (`v3-fold-t1.png`). On \*\*'s cylinder the F is
  legible at t = 0.6. That is the strongest part of the fold.
- **On tubes the marks become bands.** The torus (o) shows sand blobs, the Klein bottle (xx) bands of teal and sand,
  the Möbius band (\*x) a ring of gear teeth, 22\* and 2\*22 a castle wall: the tile's short side wraps round the tube
  and the F's stem runs along it. The F's do join across the seams (the bands are continuous), but one cannot follow
  a head and a foot round a tube. Unchanged by the critique; partly the app's (the tubes are thin).
- **Re-cut** (xx Hexagon, 22x Bowl, t = 0.25): the pieces carry the F in register; xx's F reassembles in 3D as the
  glide piece lands. **Tile step** (2222, \*442, 333): the cards carry the print, the F's turn and flip with them.
- **Phone**: o and 22x read as F's; \*x is a comb; \*632's plane is a fine maze at 120 px a tile.
- **Calmer or busier than the checkerboard?** Busier in the plane of the mirror groups (a fret instead of checks),
  calmer and far more telling in o, xx, 22x, 442, 2222 (one big letter per tile, turned and flipped by the group).

What remains weak, worst first: the mirror groups still read as a fret more than as letters (better in \*2222 and
\*442, unchanged in 3\*3, \*333, 4\*2); the rows of lying F's (\*x, 22\*, 2\*22) read as combs, with a false period of a
half or a third of the tile broken only by the full stop; \*632's F is upside down on the page; the chip of \*333 and
3\*3 reads as a fragment; the marks turn into bands on the tubes.
