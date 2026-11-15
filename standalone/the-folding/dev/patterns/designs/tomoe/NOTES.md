# Tomoe: notes (second run of the round, 13 to 14 Nov 2026)

Designed in the first half of the run, then criticised and improved by a second reader. The ranked critique is in
`CRITIQUE.md`. The designer's version is kept as `design.v1.js`, with its pictures as `*.v1.png` and `rows.v1.json`.
Five judges then shipped it with three must-fixes; what was done about them is the last section, "Polish (14 Nov)".
The version they judged is `design.v3.js` (pictures `*.v3.png`, `rows.v3.json`). The sections in between describe v3.

## The idea in three sentences

Every tile of the group is cut in two by one S-curve, as the taijitu cuts its disc. The dark half is the motif and the
light half is what is left, so the plane is all commas, about half of them dark, with no background; each comma has a
round head with an eye (a light eye in the dark head, a dark eye in the light head) and a tail that runs along the
tile's rim into the corner where the other comma's head sits. The S's two ends are put where the gluing of the tile
wants them, so that across every seam a dark back meets a LIGHT back and the commas interlock; in the kaleidoscopes,
where that is impossible, the light comma is carved into a dark chamber and meets its mirror image across one mirror.

## The rule and its knobs (`design.js`)

- **The tile D** is the page's default tile (the Dirichlet tile of `presets[0]`), so the default tile holds one whole
  dark comma and one whole light one.
  - Without presets (a turned, scaled, shifted copy) the same tile comes from `SEED`: the default seed in lattice
    coordinates relative to `group.center`. For o the metric of its default cut is rebuilt from e1, e2.
  - Vertices that `buildDomain` gives twice are merged (a moved 632 had three within 2e-5).
- **The frame**: origin the tile's centroid, x along e1, unit the tile size. All knobs are dimensionless.
- **The S's ends a, b** (`KNOBS[id].a`, `KNOBS[id].b`) are a direction in degrees, snapped to a vertex, to an edge
  midpoint or to a fraction along an edge. Dark is left of S, so the rim from b round to a is the dark back.
  - Complementary rims force the ends onto the 3-, 4- and 6-fold centres, onto the midpoints of half-turn edges, and
    onto glide-related points of glide-paired edges.
  - In the kaleidoscopes the light back is one whole mirror side, with the S running from corner to corner. This is
    forced, as "After the critique" explains.
- **The S** is a belt round two head discs. From a it wraps the dark head HB (on its left), crosses over (bent by
  `curl`), wraps the light head HA (on its right) and runs to b. HB sits against the light back just after a, and HA
  against the dark back just after b. Each head is as large as fits up to `rB` / `rA`, at the distances `dB` / `dA`
  along the rim and `gB` / `gA` off it. *x places its heads by hand (`pB`, `pA`).
- **The dark comma** is the part left of the S inside D, inset by `INSET` = 0.024 (a channel of 0.048 where dark meets
  dark), with its corners rounded.
  - The tile's corners take 0.05 × (angle / 90°), never under 0.02.
  - **New:** the dark comma's back corners (its heels) take `heel` where that is set, for \*2222's mirror corners.
- **The eyes (new rule).** Each eye sits in the middle of what is left of its head: the point within half the head's
  radius of its centre that is farthest from the outline. It keeps at least `RING_MIN` = 0.045 of its head round it,
  and an eye under `EYE_MIN` = 0.025 is dropped. For an uncut head this is the centre, as before.
- **The continuous knobs** form a table found by search: 17 rows of about 10 numbers. A changed lattice or default
  preset still gets a valid motif (checked on moved groups) but may need the search rerun.

## Numbers now (proto.mjs / kit.measure, `rows.json`; lengths in tile sizes)

Overlap is 0 in every group. Head radii (rB / rA) are given in the third table.

| group | dark (v1 → now) | bare ⌀ | solid ⌀ | verts | ms |
|---|---|---|---|---|---|
| o | 0.496 → **0.495** | 0.407 → **0.385** | 0.380 → **0.357** | 455 | 6 |
| 2222 | 0.532 → **0.514** | 0.380 → **0.442** | 0.536 → **0.531** | 464 | 4 |
| \*\* | 0.556 → **0.546** | 0.399 → **0.329** | 0.368 → **0.357** | 683 | 3 |
| xx | 0.481 | 0.357 → **0.329** | 0.337 | 501 | 3 |
| \*x | 0.454 | 0.497 → **0.470** | 0.286 | 579 | 3 |
| 333 | 0.569 | 0.368 → **0.329** | 0.447 | 504 | 3 |
| 22x | 0.479 | 0.407 | 0.368 | 529 | 2 |
| 22\* | 0.597 → **0.574** | 0.373 | 0.536 | 604 | 2 |
| \*2222 | 0.597 → **0.561** | 0.354 | 0.479 → **0.393** | 615 | 2 |
| 2\*22 | 0.591 → **0.544** | 0.303 → **0.329** | 0.432 → **0.430** | 591 | 2 |
| 442 | 0.533 → **0.535** | 0.407 | 0.505 → **0.500** | 411 | 3 |
| 632 | 0.489 | 0.393 | 0.418 | 541 | 3 |
| 3\*3 | 0.588 → **0.571** | 0.368 → **0.452** | 0.436 → **0.447** | 646 | 4 |
| \*333 | 0.607 → **0.608** | 0.480 → **0.486** | 0.432 → **0.436** | 631 | 4 |
| 4\*2 | 0.576 → **0.589** | 0.399 → **0.416** | 0.380 → **0.399** | 643 | 5 |
| \*442 | 0.608 → **0.615** | 0.452 | 0.429 | 662 | 5 |
| \*632 | 0.593 | 0.407 | 0.464 → **0.386** | 636 | 5 |

The ranges, before and after:

| | v1 | now |
|---|---|---|
| dark share | 0.454 – 0.608 | 0.454 – 0.615 |
| bare ⌀ | at most 0.497 (3 groups over 0.45) | at most 0.486 (4 groups over 0.45, by 0.002 to 0.036) |
| solid ⌀ | at most 0.536 | at most 0.536 |
| vertices | at most 667 | at most 683 |
| ms in the mini's Chrome | at most 5 | at most 6 |

Head radii now, against v1 where they changed:

| group | v1 (rB / rA) | now (rB / rA) |
|---|---|---|
| 2222 | 0.32 / 0.13 | 0.26 / 0.19 |
| \*\* | 0.21 / 0.30 | 0.29 / 0.27 |
| 2\*22 | 0.32 / 0.27 | 0.34 / 0.27 |
| 3\*3 | 0.10 / 0.12 | 0.15 / 0.18 |
| 4\*2 | 0.16 / 0.17 | 0.18 / 0.20 |

### Checks, all run on the final `design.js`

| check | tool | result |
|---|---|---|
| The production validator (`validateShapes`) on all 17 groups and two moved copies of each, handed only id, e1, e2, reps, cellArea, domainArea, center | `dev/check.mjs all --moved` | 51 / 51 ok; smallest gap 0.048; stabiliser 1 |
| Parts thinner than 1.5 texels of the 3D texture (the app-sheet's new check, `thinParts`) | `dev/thin.mjs` | none in any group. v1 had three: 3\*3, \*333, \*442 |
| Parts thinner than 0.03 tile sizes over more than 0.06 | `dev/thinw.mjs` | none |
| Extra symmetry: every rotation and every reflection or glide at 7.5° steps, every translation on a grid finer than 0.03 over a cell, 400 interior samples (catches a planted half-turn and planted mirrors) | `dev/symcheck.mjs` | no isometry outside the group keeps the print in any group; the nearest miss gets over 6 % wrong |
| The real app at t = 0, 0.6 and 1, and the back, phone, re-cut and Tile views | `app-sheet.mjs` | the print takes in all 17; no page errors, no rules broken, no THIN warnings |

## After the critique (what changed and why)

The findings are in `CRITIQUE.md`, worst first. This is what was done about each, in the order of that list.

1. **Mirror groups: "a triangle with a keyhole".** Partly improved; the root cannot be removed within the concept.
   - **The geometry.** No dark mark may cross a mirror: a mark through a point of the mirror shares that point with
     its own image. So every dark comma lives inside one chamber, and any light that touches a mirror merges with its
     own mirror image into a symmetric shape. Two asymmetric commas per tile with no background is therefore
     impossible in a kaleidoscope. The light comma can only be a symmetric pair, and the dark comma must take every
     side the light does not.
   - **The light comma's back is one whole side because the alternatives fail.** I tried a light back on the
     hypotenuse with the dark heel moved to the 90° corner and rounded: bare went to 0.55 to 0.69 and the dark became
     rounded squares. I tried a dark pinwheel round the 3- and 4-fold centres of 3\*3 and 4\*2: big light wedges along
     the mirrors, bare 0.57 to 0.76. Heel rounding at 30° and 45° corners grows a light hub (\*632: bare 0.53). All
     were rejected.
   - **What changed.**
     - 3\*3 and 4\*2 heads grew, with a search held to a head floor. 3\*3 went from specks of 0.10 / 0.12 to
       0.15 / 0.18; 4\*2 from 0.16 / 0.17 to 0.18 / 0.20.
     - \*2222's dark comma got a round back (`heel` 0.3 at its two 90° mirror corners): dark 0.597 to 0.561, solid
       0.479 to 0.393.
     - 22\* (dark 0.574) and 2\*22 (dark 0.544, a bigger light comma) were rebalanced.
     - \*333 and \*442 stay as they were: every search that grew their light comma raised bare past 0.49.
2. **Boxy backs in the rotation groups.** Unchanged, by design. Rounding the dark heels where dark meets light only
   joins the neighbours' light tails at the vertices; this was tried on o and 442 with no visible gain. An equivariant
   bend of the edges cannot make both backs round, because a shared boundary is convex for one comma exactly where it
   is concave for the other.
3. **2222's unequal commas.** Fixed. The light head went from 0.13 to 0.19 and now carries a big dark eye; the dark
   head went from 0.32 to 0.26; dark 0.514. The price is bare 0.38 to 0.442, still within 0.45. The tile is now a true
   yin-yang.
4. **\*x.** Slightly better. The heads moved inward to ±0.7 on the strip's centre line, and bare went from 0.497 to
   0.470. A head floor of 0.15 could not go lower, and the eye rule also helped. The strip's mirrors are 0.433 apart,
   so a comma there is at most 0.43 thick: this is the limit of any design, not only this one.
5. **Hairlines and near-touches.** Fixed everywhere the tools can see.
   - \*\*'s dark tail along the mirror is now at least 0.118 wide (the search was held to `gA` ≥ 0.11), and the
     numbers improved too: bare 0.399 to 0.329.
   - The new eye rule removed \*442's hairline ring (an eye 0.003 from the head's edge) without shrinking the eye:
     the eye moves into what is left of the head.
   - The pinched light necks of 3\*3 and \*333 (0.0003 to 0.001 tile sizes wide, where a dark head almost touched
     the dark comma's own tail) are gone. 3\*3's dark head moved toward the apex; \*333's light tail narrowed.
   - The searches (`dev/kitopt.mjs`) now refuse any motif that breaks `validateShapes` or has a part thinner than
     0.03 tile sizes. A first 2\*22 candidate from the old search touched itself, and the app caught it.
6. **Smaller fixes.** The eye placement lowered bare in o (0.407 to 0.385), xx and 333 (to 0.329) and solid in \*632
   (0.464 to 0.386) without any knob change.

Kept from v1: the concept, the structure in every group, all hard rules, and the knobs of o, xx, 333, 22x, 442, 632,
\*333 (except one), \*442 and \*632.

## In the fold (what I saw; what remains weak)

- **Which side is up** is always clear. Front teal, back sand; most closed shapes (torus, pillows, cones) show the
  sand side outside.
- **Following the parts.** Where the tile is a yin-yang (o, 2222, \*\*, xx, 22x, 333, 442, 632), the dark head with its
  light eye and the light head with its dark eye are landmarks. At t = 0.6 one can see which head went where and
  that the tails run into the cone points. The 22x cross-cap and the \*x Möbius band read best: big light head, dark
  eye.
- **Seams.** The default tile holds both commas whole, so no mark is cut by the default cut's seams. Every seam is a
  dark/light boundary there. For other cuts the commas are cut and join up again as the seam closes.
- **The re-cut** (xx, 22x) reassembles the yin-yang in the home tile before the fold: a good effect.
- **The Tile step's cards** carry the commas visibly.
- **Weak: the sand side.** The fixed sand tones are close, so with shading the marks on closed pillows and the torus
  read as soft blobs. On the torus the dark comma becomes a band round the tube. From behind (`app-back.png`) o's
  thin tube shows almost no mark.
- **Weak: the kaleidoscope snowflakes** close to one sand triangle with a light tadpole and its eye. It reads as a
  comma, but a small one in a dark chamber.
- **Weak: the phone.** \*632's plane is a dense field of triangles with tadpoles.
- **Calm.** The 3D picture is calmer than the checkerboard's: one or two big marks per face instead of a grid of
  checks.

## Files

- `design.js` is the design. `design.v1.js` is the designer's version, the backup. `CRITIQUE.md` is the critique.
- `engine.js` is the first run's engine, superseded.
- In `dev/`:
  - `opt.mjs`: the coarse search, now with `--minhead`, `--gAmin`, `--gBmin` and `--bare`.
  - `kitopt.mjs`: a search scored by kit.measure, the validator and thin parts.
  - `kitm.mjs`: kit.measure of variants.
  - `check.mjs`: the validator, with moved copies.
  - `thin.mjs`, `thinw.mjs`: the app-sheet's thin-part check without a browser, and a stricter width.
  - `symcheck.mjs`: the general extra-symmetry search. `extrasym.mjs` is the designer's sieve.
  - `look.mjs`, `zoompt.mjs`: local rasters, with the discs ringed, and around one point.
  - `tileinfo.mjs`: each group's tile, corners and gluings.
  - `info.mjs`, `eyedbg.mjs`, `same.mjs`: head radii, eyes, and a v1-versus-now diff.
  - `plant/disc.js`: the planted-symmetry test.
  - `r1/*.json`: the variants looked at.
- Pictures are in `~/drive.unsynced/artifacts/the-folding-patterns/tomoe/`.
  - The standard set, now: `sheet.png`, `rows.json`, `zoom.png`, `back.png`, `app-t0.png`, `app-t06.png`,
    `app-t1.png`, `app-back.png`, `app-phone.png`, `app-recut.png`, `app-tile.png`.
  - v1's are `sheet.v1.png`, `zoom.v1.png`, `back.v1.png`, `app-t06.v1.png` and `rows.v1.json`.
  - The critique's fresh pictures of v1 are in `crit/`, and each round's pictures in `work/`.

## Polish (14 Nov, late evening)

The five judges (`dev/patterns/round2/judges-tomoe.md`) shipped Tomoe with three must-fixes. The concept, the
S-split structure of every group, the heads and the eyes are kept; what changed is the tile the S splits, the dark's
back along mirrors, and the knobs of the groups that needed it. `design.v3.js` is the version they judged.

### What changed

1. **No straight rim, no second grid (four judges: "the white channel runs along the default tile's rim").**
   - The S now splits a BENT tile R, not the default tile D. Every glued edge of D becomes a smooth curve: its dark
     stretches bulge out by `bend` × their length, its light stretches in (sin² humps, flat at the corners). A
     half-turn edge gets an S that is odd about its centre. Mirrors stay straight. The partner edge gets the group's
     image of the curve, so R is again a fundamental domain (`gluing`, `bendRim`).
   - The whole split (S, heads, tails, eyes) is carried from D into R by mean value coordinates of the rim's
     displacement (`mvcMap`), so nothing near the rim is torn or folded.
   - `bend` per group: 0.16 for o; 0.14 for 2222, xx and 22x; 0.12 for 442; 0.10 elsewhere. At 0.18, 333 breaks a
     rule and 632 prints THIN.
   - Result: no dark/light boundary and no channel lies on a straight edge of the default tile. The marks cross the
     default tile's sides: the neighbours' bulges show inside it (`zoom.png`, o and 442). With another cut (o's
     Hexagon, 442's Pentagon) the plane shows the cut's grid once, not two grids (`polish/cut2-plane-big.png`).
   - The one dark-dark edge left on a glued edge is 2222's half-turn edge that is dark on both sides. It is now an S
     curve (the brief allows a curved channel).
2. **No channel along a mirror.** Where the dark back lies on a mirror, the dark no longer runs beside it at the inset.
   - **Bows** (`bows`: per mirror stretch of the dark back, from b): **, \*x, 22\*, 2\*22 and \*2222, whose mirror
     corners are right angles. The dark keeps inside a disc that touches the mirror's inset line once. Two mirror
     images meet back to back at that point, with a lens of light between them.
   - **Dents** (`dents`): 3\*3, 4\*2, \*333, \*442 and \*632. In the middle of each stretch the dark back is pulled off
     the mirror by 0.10–0.20 tile sizes (a sin² hump, a shear, so nothing folds). It still touches the mirror at the
     stretch's ends, where a tail or a heel has to fill a sharp corner. Bows there opened the corners: bare 0.5–1.2,
     and even a bow of radius 4 left \*442's tail corner empty (bare 0.97).
3. **Kaleidoscopes ("the dark half fills the chamber to its rim").**
   - With the dents the dark no longer fills the chamber. There are leaves of light along every mirror, and the marks'
     tips meet in stars at the corners. The plane no longer reads as a checkerboard of triangles (`zoom.png`, bottom
     row).
   - Each mark is a curved blade with the keyhole: a dark head with its light eye, and the light head with its dark
     eye. The dark share fell from about 0.6 to 0.46–0.54.
   - This is closer to a comma than v3's triangle with a keyhole, but it is not a clean comma. The bare-disc rule
     needs dark (or a dark eye) in every corner of the chamber. A dark comma with a round back that leaves a corner
     empties it (bare 0.8–1.2), and the searches traded head size for that.
4. **\*x (the 1.2 × 0.6 tile of the rebase).**
   - Right after the rebase the old knobs gave bare 0.899: the hand-placed heads fell off the new tile.
   - \*x now has the structure of ** (the same 2:1 rectangle, glued by a glide instead of a translation). It is one
     comma curled round the light head: its back runs along both mirrors (bowed) and the left glide edge (bent), its
     head with a light eye sits against the right glide edge, and its tail runs along the top mirror.
   - Heads 0.21 / 0.28 tile sizes, eyes 0.12 / 0.15. Bare 0.404 (v3 on the old thin strip: 0.47).
5. **Smaller.**
   - `EYE_MIN` 0.025 → 0.05: no free piece under 0.1 tile sizes (the design judge's note on floating dots).
   - The gluing tolerates a moved group's tile. SEED is rounded to six places, so a copy's tile is a hair off the
     page's, and the moved 632 had lost both heads (radius 0.05).
   - Knobs found by searches on aifoundry1 (`dev/search.mjs` through `dev/remote.sh`). They were scored by
     kit.measure, the production validator, THIN at 1.5 texels, the head and eye sizes, and how long the dark hugs a
     mirror. Every result was then looked at.

### Numbers (proto.mjs on the mini, `rows.json`; v3 → now)

| group | dark | bare ⌀ | solid ⌀ | verts | ms |
|---|---|---|---|---|---|
| o | 0.495 → **0.548** | 0.385 → **0.416** | 0.357 → **0.429** | 438 | 8 |
| 2222 | 0.514 → **0.518** | 0.442 → **0.416** | 0.531 → **0.558** | 464 | 8 |
| \*\* | 0.546 → **0.461** | 0.329 → **0.380** | 0.357 → **0.357** | 612 | 5 |
| xx | 0.481 → **0.500** | 0.329 → **0.323** | 0.337 → **0.399** | 501 | 3 |
| \*x | 0.454 → **0.471** | 0.470 → **0.404** | 0.286 → **0.393** | 612 | 5 |
| 333 | 0.569 → **0.580** | 0.329 → **0.323** | 0.447 → **0.505** | 497 | 3 |
| 22x | 0.479 → **0.487** | 0.407 → **0.416** | 0.368 → **0.354** | 529 | 4 |
| 22\* | 0.574 → **0.521** | 0.373 → **0.373** | 0.536 → **0.501** | 566 | 4 |
| \*2222 | 0.561 → **0.524** | 0.354 → **0.386** | 0.393 → **0.407** | 551 | 4 |
| 2\*22 | 0.544 → **0.569** | 0.329 → **0.352** | 0.430 → **0.464** | 589 | 5 |
| 442 | 0.535 → **0.565** | 0.407 → **0.429** | 0.500 → **0.520** | 411 | 2 |
| 632 | 0.489 → **0.519** | 0.393 → **0.404** | 0.418 → **0.430** | 541 | 3 |
| 3\*3 | 0.571 → **0.502** | 0.452 → **0.393** | 0.447 → **0.404** | 657 | 4 |
| \*333 | 0.608 → **0.460** | 0.486 → **0.455** | 0.436 → **0.432** | 560 | 3 |
| 4\*2 | 0.589 → **0.540** | 0.416 → **0.399** | 0.399 → **0.432** | 614 | 4 |
| \*442 | 0.615 → **0.461** | 0.452 → **0.436** | 0.429 → **0.321** | 663 | 3 |
| \*632 | 0.593 → **0.469** | 0.407 → **0.393** | 0.386 → **0.357** | 625 | 5 |

Ranges now: dark 0.460–0.580; bare at most 0.455 (\*333; 0.436 or less in the other 16); solid at most 0.558;
at most 663 vertices; find() at most 8 ms in the mini's Chrome (the ms column; proto's first group includes loading).

### Checks, on the final `design.js`

| check | tool | result |
|---|---|---|
| The production code as the page asks it: makeShapePrint, printable, validateShapes, thinParts at 1.5 texels; all 17 groups and a turned, scaled, shifted copy of each without presets | `dev/prodcheck.mjs` | 34 / 34 ok; no THIN; smallest gap 0.026 in \*442 (the kit asks 0.02): its second dent starts at the heel corner, where pushing off one mirror moves the tips toward the other; 0.041 or more in the other 16 |
| A moved copy draws the page's motif | `dev/movedcmp.mjs` | the same motif within 0.0021 tile sizes (632, 333, \*632, 2222, \*333, \*442, \*x) |
| The real app at t = 0, 0.6, 1; back, phone, re-cut, Tile step | `dev/standard-set.sh` (proto.mjs, app-sheet.mjs) | the print takes in all 17; no page errors, no RULES, no THIN |
| Another cut | app-sheet `--preset 2` | one grid, the cut's (`polish/cut2-plane-big.png`) |

### What is still weak

- **\*333's bare disc is 0.455**, 0.005 over 0.45 (the measure's grid step is about 0.02). Four searches stop
  there. The pool sits at the light head near the top corner, which the corner squeezes to radius 0.16. Moving the
  head along its side empties the corner instead (bare 0.77).
- **The kaleidoscopes are blades, not clean commas** (see 3). \*632's heads are small (0.11 / 0.14): its two heads
  crowd each other in the 30° chamber, and freeing them opens the corner (bare 0.54).
- **3\*3 keeps a thin dark strip along its base mirror.** It doubles with its mirror image into a pair of lines
  along that mirror; a thicker tail loses both eyes.
- **o's light commas still form wavy white rivers** along the rows. The light comma's body lies along the top edge
  of the parallelogram, so these rivers are part of the S-split of that tile. They are curved now and cross the
  seams, but the rows remain visible.
- **The bulges change the commas' outlines.** The dark backs are convex and the light backs concave (one curve is
  both), so the light commas look a little pinched where a neighbour's back pushes in.

### New files (in `dev/`)

- `search.mjs` + `remote.sh`, `remote-run.sh`: the knob search, run on aifoundry1.
- `prodcheck.mjs`: the final production check.
- `standard-set.sh`: the standard pictures, one browser run at a time.
- `bendcheck.mjs`: the bend's numbers.
- `movedcmp.mjs`, `seedtile.mjs`, `gluedbg.mjs`: a moved copy against the page's group.
- `probe.mjs`: the tone across a seam.
- `rowsdiff.mjs`: the numbers table.
- `variant.js`: design.js with knobs replaced, for proto and app-sheet.
- Pictures of the polish: `~/drive.unsynced/artifacts/the-folding-patterns/tomoe/polish/`. The previous standard set
  is kept as `*.v3.png` and `rows.v3.json`.
