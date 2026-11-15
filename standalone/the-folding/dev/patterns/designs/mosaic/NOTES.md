# Mosaic — design notes (key: `mosaic`, label "Mosaic")

## The idea

The plane is laid as a mosaic: the dark tiles are the Voronoi cells of one generic orbit of the group (with the
default cut's seed, the copies of the page's default tile itself), separated by light grout 0.044 tile sizes wide.
Into every tile a big light comma is inlaid (two in \*x): a round head of radius about 0.2 and a full body that curls
and tapers to a fine tip, floating in the tile with a dark rim all round. The comma has a direction (head to tail) and
a hand (its curl): translated tiles are parallel, rotated ones turn about the centres, and mirrored or glided ones curl
the other way. The default tile holds exactly one whole tile and its comma, with its seams in the grout.

Run 2 ran each tail into the grout, where it ended at a T. Run 3 (a second pair of eyes, `CRITIQUE.md`) let the
commas float; see "After the critique".

## After the critique (run 3, 13 Nov 2026, from 23:20)

What changed, and why. The findings are numbered as in `CRITIQUE.md`.

1. **The commas float.** The tail now stops 0.045 tile sizes short of the grout, where run 2 ran it into the grout.
   - Why: fused, the light tone was one connected web. Each comma read as a bay of the grout, a drop hanging off a
     net (finding 8). Floating, each comma is a whole mark with a fine tip, the classic comma, inlaid in its tile. It
     was the largest single gain of the round (`r3/r1-free.png`, `r3/r2-free-all.png`).
   - The motif is now the dark tile with its comma as a hole.
   - The body is pulled in by a smooth minimum (radius 0.015) wherever it would come nearer the grout than 0.042
     (`DEF.rim`). Without it, the fuller bodies of change 2 left dark rims of 0.03 in o, 22\* and 442.
2. **Fuller bodies.** The taper powers of run 2 are multiplied by 0.6 (442 by 0.45).
   - The light comma now covers 0.29–0.38 of the plane (run 2: 0.27–0.35).
   - This brought the dark share back to 0.50–0.60, after the floating tails had pushed it up to 0.62 in 442.
   - A taper times 0.4 turned the commas into bananas and split a dark speck off in 442 (`r3/r1-fat.png`).
3. **Quieter grout and corners.**
   - The grout is 0.044 wide (was 0.055; the rules ask for 0.04).
   - Corners are rounded by 0.025 (was 0.035).
   - The seams in the fold and the 12-spoke stars at the 6-fold centres of 632, 3\*3 and \*632 are quieter. The stars
     shrink from about 0.41 to 0.31 across (findings 2 and 5).
4. **\*x: two commas per strip, their tails curling late,** where run 2 had one wedge (finding 3).
   - A new knob, `q`, lets a tail run straight and curl only at its end. The turning rate goes from `t0` to `t1` as
     s^q; `q = 1` is run 2's spine, exactly.
   - The hand now shows: in one strip the tails flick toward one mirror, in the mirrored strips toward the other, and
     along a strip the glide flips them after every second comma.
   - One comma per strip was tried: it was either a wedge again or a dark bar (dark 0.72–0.77, over the cap;
     `r3/r1-sx.png`). The two commas are translates by half the cell, which is no symmetry of the print: the glide
     image of the first comma, not the second, comes next.
5. **22\* and 2\*22 keep the designer's arcs.**
   - Floating, they are clean lying commas with a fine tip. The long dark wedge under each and 2\*22's dark finger in
     the corner are gone (finding 4).
   - A tail that runs straight and flicks into a wall, as in \*x, was tried there and read as a boot (`r3/r1-pmg.png`).
6. **The fallback** (a group id the table does not know) keeps run 2's tail into the grout: valid, dark 0.62–0.83.
   None of the 17 uses it.

Not changed:

- `p`: the tiles are still the default tiles.
- The heads, places, headings and curls of run 2's table; `bend` 0.

The bench of this round is `r3/`:

- `bench.mjs`: variants side by side, any number of commas per cell, global switches;
- `shares.mjs`: frame, comma and grout shares;
- `torows.mjs`: commas in the cell's frame written as table rows.

Its pictures are in `OUT/mosaic/r3/` and the critique's in `OUT/mosaic/critique/`. The run-2 pictures are kept as
`*.v1.png` and `rows.v1.json`, and the run-2 design as `design.v1.js`.

**The numbers** (kit.measure in the browser: proto.mjs, `rows.json`; run 2 in brackets):

| group | dark | bare ⌀ | solid ⌀ | verts | ms |
|---|---|---|---|---|---|
| o | 0.513 (0.543) | 0.418 (0.399) | 0.286 (0.288) | 572 | 22 |
| 2222 | 0.546 (0.541) | 0.407 (0.407) | 0.496 (0.496) | 526 | 5 |
| \*\* | 0.562 (0.539) | 0.429 (0.418) | 0.357 (0.380) | 548 | 4 |
| xx | 0.548 (0.537) | 0.429 (0.418) | 0.354 (0.357) | 547 | 3 |
| \*x | 0.496 (0.572) | 0.286 (0.260) | 0.229 (0.250) | 778 | 9 |
| 333 | 0.578 (0.571) | 0.407 (0.404) | 0.430 (0.432) | 539 | 5 |
| 22x | 0.597 (0.571) | 0.399 (0.399) | 0.380 (0.364) | 525 | 3 |
| 22\* | 0.526 (0.546) | 0.373 (0.357) | 0.321 (0.329) | 630 | 4 |
| \*2222 | 0.556 (0.547) | 0.407 (0.399) | 0.399 (0.418) | 543 | 3 |
| 2\*22 | 0.515 (0.548) | 0.373 (0.357) | 0.303 (0.321) | 607 | 7 |
| 442 | 0.593 (0.559) | 0.429 (0.418) | 0.464 (0.464) | 503 | 3 |
| 632 | 0.591 (0.569) | 0.432 (0.418) | 0.399 (0.393) | 598 | 5 |
| 3\*3 | 0.590 (0.566) | 0.434 (0.429) | 0.393 (0.393) | 598 | 5 |
| \*333 | 0.572 (0.581) | 0.429 (0.418) | 0.436 (0.436) | 542 | 5 |
| 4\*2 | 0.573 (0.526) | 0.407 (0.407) | 0.329 (0.329) | 571 | 11 |
| \*442 | 0.572 (0.524) | 0.407 (0.407) | 0.329 (0.329) | 572 | 5 |
| \*632 | 0.573 (0.551) | 0.407 (0.407) | 0.305 (0.288) | 583 | 9 |

Ranges over the 17 groups:

- dark 0.496 to 0.597;
- bare disc at most 0.434 (3\*3);
- solid disc at most 0.496 (2222);
- 503 to 778 vertices;
- at most 22 ms (o, the first group drawn; the rest at most 11).

**Checks:**

- `check.mjs`:
  - gap 0.044 between copies;
  - no thin dark or light feature in any group;
  - no self-crossing; one hole per motif (two in \*x);
  - the motif wholly in the default tile.
- `validate.mjs`, with its output in `OUT/mosaic/r3/validate.txt`:
  - `validateShapes` is ok in all 17, with stabilizer 1;
  - 51 turned, scaled and shifted copies without presets are ok, exactly invariant, and vertex for vertex the moved
    motif.
- `fallback-check.mjs`: all 17 lattices valid under an unknown id.
- `app-sheet.mjs`, 7 runs of the standard set: the pattern took in every group, with no page error, no validator
  problem, gap 0.044 and stabilizer 1 everywhere.
- The repository suite was not run: no test loads the designs, and nothing outside this folder was touched.

## In the fold (run 3)

What I saw in the standard set (`app-t0`, `app-t06`, `app-t1`, `app-back`, `app-phone`, `app-recut`, `app-tile`), and
closer, in a 1100 x 700 window (`OUT/mosaic/r3/fold1-big-r3a.png`, `fold1-big-roll.png`):

- **Flat (t = 0) and on the flat kaleidoscopes,** the comma reads at once, front and back.
  - Every tile shows one whole comma (two in \*x).
  - Closed, \*2222, \*333, \*442 and \*632 show their comma on the sand side as clearly as flat.
- **The Möbius band, closed,** shows two commas, head and tail readable, and the sand side at its seam. Run 2 showed
  one light stripe along the band.
- **22\*, 2\*22, \*\* and 22x, closed:** the comma is visible on the shape (mostly the sand side).
- **The torus, the Klein bottle, the 2222 pillow, 333, 442 and 632, closed:** the one comma per tile is stretched over
  the whole shape.
  - The head of o is 0.41 tile sizes across, on a tube 0.68 around, so it becomes a pale band.
  - On the sand side, which the default views show, the contrast is low.
  - This is the limit of the idea (finding 1: one mark per tile, which also makes it the biggest mark possible). The
    checkerboard shows the bending of these shapes far better.
- **The seams** are still light bands of grout under the coloured seam lines (finding 2), narrower than in run 2.
  - No mark crosses a seam of the default cut, so the default fold never shows a mark joining up.
  - The re-cut does: in xx's Hexagon and 22x's Bowl the floating commas are cut and carried in register.
- **Which side is up** is always clear: teal against sand.
- **The Tile step:** each card carries one whole comma.
- **On a phone:** the plane pane shows the commas well. At t = 0.6 the 3D shows them on \*x, 22x and \*632; the torus
  is a pale tube.

What remains weak, by the findings of `CRITIQUE.md`:

- 1: one mark per tile, a pale blob on the closed torus, pillow, 333, 442 and 632.
- 2: the grout lies on the seams of the default cut.
- 6: the sand side's low contrast in the default 3D views.
- 5: the 12-spoke stars, smaller but still the busiest place.
- 7: a table of 17 hand-placed commas, now one style.
- 9: the table repeats the presets' seeds.

## The rule and its knobs

- **Motif** = one dark tile, `{f > 0}` with `f = min(claim, -strokes)`:
  - `claim`: the exact distance to the nearest wall of the identity's Voronoi cell, less half a channel. The corners
    are rounded: shrunk by `round` and grown back, so a 30-degree corner ends in a cap 0.05 wide, not in a needle.
  - `strokes`: the light comma of every nearby copy.
  - Near the junction where a tail meets the wall, the minimum is a smooth one (the fillet). Run 3's floating commas
    have no junction; the fillet is kept for a comma with `free` 0 (the fallback).
  - Traced by marching squares on a grid of 64 per tile size in the group's own frame, resampled every 0.0125 tile
    sizes and smoothed (sigma 0.028).
  - Two copies are never nearer than the channel, whatever the knobs.
- **Comma** = a stroke: a disc of radius `rad` at the head, then a spine of length `len`.
  - The heading turns at the rate `t0` at the head and `t1` at the tip. The rate goes from one to the other as s^q
    (`q` 1: linearly, run 2; `q` 4: the tail runs on and curls late).
  - The radius tapers to 0.028 with power `pow`.
  - `seat()` shrinks the head to keep a dark rim of 0.06. It cuts the spine where its tip comes within `FREE` (0.045)
    of the grout, so every comma floats, whatever the lattice. It also gives the body its `maxRad`: the body is pulled
    in wherever it would leave less than `rim` (0.042) of dark between itself and the grout.
- **Global knobs** (`DEF`, `STYLE` and `FREE` in design.js; run 2's values in brackets):

  | knob | value | what it does |
  |---|---|---|
  | `chan` | 0.044 (0.055) | grout width |
  | `round` | 0.025 (0.035) | radius that rounds the tiles' corners |
  | `FREE` | 0.045 (0: into the grout) | how far a comma's tip stays off the grout |
  | `rim`, `rimSoft` | 0.042, 0.015 | least dark rim between a comma's body and the grout; the smooth minimum that keeps it |
  | `fillet` | 0.09 | radius of the smooth minimum at a tail's junction with the grout (free 0 only)... |
  | `filletReach` | 0.22 | ...applied only within this distance of the junction |
  | `bend` | 0 (off) | bends each non-mirror wall into an S; `bendMax` and `bendMin` go with it |
  | `grid`, `ds`, `smooth` | 64, 0.0125, 0.028 | the tracing |

- **Per group** (`TABLE`, 10 or 11 numbers per group; `MORE` for a second comma, used by \*x): where `p` sits, then
  the comma (head, heading, length, `t0`, `t1`, `rad`, `pow`, and `q` when it is not 1).
  - All of it is in the group's own frame: lattice coordinates from an anchor that moves with the group (its
    highest-order rotation centre, or the foot of a mirror or glide axis), headings from e1, lengths in tile sizes.
  - `p` is the default cut's seed, which is why the tiles are the default tile.
  - `cand.mjs` writes this table from a candidate file in the cell's own frame (origin p, world axes), the form in
    which the commas were placed by hand.
  - A group id the table does not know gets a generic `p` and a plain comma (`fallback`): valid, not tuned.

## The numbers of run 2 (kit.measure in the browser: proto.mjs, rows.v1.json; lengths in tile sizes)

| group | dark | bare ⌀ | solid ⌀ | head r | spine | verts | ms |
|---|---|---|---|---|---|---|---|
| o | 0.543 | 0.399 | 0.288 | 0.201 | 1.233 | 559 | 10 |
| 2222 | 0.541 | 0.407 | 0.496 | 0.204 | 1.243 | 516 | 7 |
| ** | 0.539 | 0.418 | 0.380 | 0.21 | 1.118 | 536 | 4 |
| xx | 0.537 | 0.418 | 0.357 | 0.21 | 1.128 | 534 | 4 |
| *x | 0.572 | 0.260 | 0.250 | 0.129 | 1.996 | 756 | 9 |
| 333 | 0.571 | 0.404 | 0.432 | 0.202 | 1.07 | 524 | 5 |
| 22x | 0.571 | 0.399 | 0.364 | 0.197 | 1.157 | 514 | 3 |
| 22* | 0.546 | 0.357 | 0.329 | 0.18 | 1.457 | 620 | 4 |
| *2222 | 0.547 | 0.399 | 0.418 | 0.202 | 1.222 | 532 | 3 |
| 2*22 | 0.548 | 0.357 | 0.321 | 0.179 | 1.412 | 595 | 8 |
| 442 | 0.559 | 0.418 | 0.464 | 0.21 | 0.99 | 489 | 3 |
| 632 | 0.569 | 0.418 | 0.393 | 0.212 | 0.851 | 575 | 5 |
| 3*3 | 0.566 | 0.429 | 0.393 | 0.213 | 0.85 | 575 | 8 |
| *333 | 0.581 | 0.418 | 0.436 | 0.21 | 0.968 | 526 | 8 |
| 4*2 | 0.526 | 0.407 | 0.329 | 0.205 | 1.056 | 556 | 7 |
| *442 | 0.524 | 0.407 | 0.329 | 0.205 | 1.064 | 556 | 7 |
| *632 | 0.551 | 0.407 | 0.288 | 0.204 | 1.028 | 565 | 10 |

Ranges over the 17 groups:

- dark 0.524 to 0.581;
- bare disc at most 0.429 (3*3);
- solid disc at most 0.496 (2222);
- at most 756 vertices;
- at most 10 ms in the browser;
- overlap 0.

The mark is longer than the spine by the head's radius: 1.06 to 2.13 tile sizes.

Checks:

- **`check.mjs`** (all 17):
  - the gap between copies is 0.055 everywhere;
  - no self-crossing, one polygon, no hole;
  - no thin dark or light feature (an opening by a disc 0.04 across takes nothing away);
  - segments 0.006 to 0.0125 long;
  - the whole motif lies inside the default tile (share 1.000).
- **`validate.mjs`** (production `src/shapes.js`; output in `OUT/mosaic/run2/validate.txt`), all passed:
  - `validateShapes` is ok for all 17 groups (gap 0.055, stabilizer 1);
  - on 51 turned, scaled and shifted copies handed over without presets, it is ok too, `exactlyInvariant` holds,
    and the motif is the moved motif to 1e-13.
- **`app-sheet.mjs`**: no page error and no validator problem in any of the 7 runs of the standard set.

## What is weak (run 2's own list; run 3's is CRITIQUE.md, and "In the fold" above)

1. **The light comma is the mark that reads**; the dark tile is its frame.
   - Where the tile is long and thin, the comma is long too: *x (5.3 : 1), 22* (3.3 : 1), 2*22 (2.7 : 1).
   - *x is a round-headed tadpole (head 0.129, the strip's height less the rims) whose tail rises gently to the far
     wall: it has a direction and a hand, but it is not a curled comma.
2. **12 tiles meet at every 6-fold centre** of 632, 3*3 and *632 (30-degree corners). The rounded tips leave a white
   star about 0.4 tile sizes across, with 12 spokes of grout: the busiest place of the family, though it marks the
   centres.
3. **The concept's S-bent walls are off** (`bend 0`). Bent over the whole wall, the S made a jigsaw: busier, with
   slivers where the default tile's straight seam cuts a wavy wall. The run-1 vortex bent only the middle of a wall
   (a lump). The S is still a knob.
4. **The seams of the default cut run in the grout.** Closed, the surface shows one tile and its comma between light
   seams. The print's continuity across a seam shows for the other cuts: a re-cut, Wavy, or a dragged seed.
5. **Not one comma, one family.** The commas are placed per group: eight by hand in run 2 (o, **, xx, *x, 22*, 2*22,
   632, 3*3), nine kept from run 1's search. Their shapes:
   - a "9" in the tall tiles;
   - curls in the compact ones;
   - a lying J in the long ones;
   - a tadpole in *x.
6. **The sand side has less contrast** (the colours are fixed), and in many default views of a closed shape it is the
   sand side that shows.
7. **The table repeats the presets' seeds in the group's frame.** If a seed changes in `src/groupdata`, the tiles no
   longer coincide with the default tile. The print stays valid, and `check.mjs` reports the share of the motif
   inside the default tile.
8. **The fallback** (a group id the table does not know) is valid but darker than the targets (0.60 to 0.81).

## What I would try next

- **A cubic term in the spine's heading**, so a tail can run straight and then curl late. *x could then end its tail
  in a mirror at a right angle (a curled comma in the strip). The J-curls of 22* and 2*22 would get tighter.
- **Port run 1's search** (`search2.mjs`, which still assumes the swirl) to the straight walls, and run it on a lab
  box over the nine untouched groups, for a uniform curl and heads of 0.21.
- **A smaller `round` at the 30-degree corners only**, for smaller stars at the 6-fold centres. Or keep them, as
  rosettes.

## Tools in this folder

All are dev tools that run in node; nothing of the page imports them.

| file | what it does |
|---|---|
| `design.js` | the design |
| `design.v1.js` | run 2's design, as delivered (the backup of run 3) |
| `CRITIQUE.md` | run 3's critique of run 2, findings ranked |
| `r3/bench.mjs` | run 3's bench: variants side by side, any number of commas per cell, switches for all groups |
| `r3/shares.mjs` | how the plane splits into dark frame, light comma and grout |
| `r3/torows.mjs` | commas in the cell's frame, written as rows of the table (the group's frame) |
| `lab.mjs` | a fast raster of a motif's orbit, kit.measure's numbers from it, a PNG contact sheet |
| `view2.mjs` | variants side by side; `"L"` (cell frame), `"T"` (table rows) or a candidate file `@file.json` |
| `cell.mjs` | the cell, its walls and centres, and the comma in the cell's own frame |
| `cand.mjs` | the table to and from a candidate file |
| `check.mjs` | the hard rules, measured |
| `validate.mjs` | the production validator, and moved copies without presets |
| `fallback-check.mjs` | the path for an unknown group id |
| `remote-run.sh` | runs one of these on the mini under run_remote's caps |

Run 1's search and lab scripts, its design (`run1-design.js`) and its pictures are kept in
`~/drive.unsynced/artifacts/the-folding-patterns/mosaic/run1/`. The candidate files and the pictures of run 2 are in
`.../mosaic/run2/`.

## Round log (what I saw, what I changed)

**Round 0 — the literal concept (two-orbit Voronoi, straight cells), groups o, 2222, 442, 333.**

- Saw: with p = the default tile's seed and q searched over the tile, the dark cells are plain convex polygons and the
  light cells merge into a network. The bare disc is 0.52–0.67 unless the cells are thin stripes. A compact light
  cell of area 0.4 always holds a disc of 0.6: the 0.45 limit cannot be met by "half the cells light".
- Changed: the light orbit no longer takes a Voronoi cell. The dark orbit alone tiles the plane (grout between
  neighbours); the light orbit is a comma inlaid in each dark cell (round head, tapering curved tail). The dark cell is
  what is left: a fat hook, the comma is its ground (yin and yang in one cell).

**Round 1 — inlaid commas by hand, then a seeded search, 11 groups.**

- Saw: bold and clean; numbers in range at once (dark 0.52–0.60, bare 0.38–0.41, solid 0.3–0.55). But tails that
  crossed the grout left short stubs in the next cell (they read as debris), and oblique crossings made slivers; *x
  was a mess.
- Changed: the tail now runs until it MEETS the grout and ends there, at a T (the search cuts the spine at the wall of
  its own cell and asks for a steep approach). Before that the stroke keeps a dark rim of 0.08 tile sizes.

**Round 2 — all 17.**

- Saw: 632, 3*3, *632 had a white star of 0.66 tile sizes on every 6-fold centre. Cause: the channel was "nearer to
  the second site by less than c", which is as wide as c only between two sites that face each other; at a 30-degree
  corner, far along the wall, it was four times as wide. *x and 22* (thin cells, a "free" mode without rim) were
  shapeless.
- Changed: the channel is now the exact distance to the wall (the cell is an intersection of half planes), so the
  grout is equally wide everywhere and thin corners stay dark to their tips. No free mode: thin cells follow the same
  rule with a rim of 0.065 and a smaller head. The grout is swirled: a vortex at the middle of every edge that is no
  mirror bends it into an S (the commas are not swirled); mirrors stay straight because they must.

**Run 2, round 3a — the walls (13 Nov, from 22:45).**

- Saw: fresh sheets of the run-1 design gave the numbers as before, all in range. But the swirl bent only the middle of
  each wall (its vortex discs were capped by their neighbours'), so long walls showed a lump. An S over the whole wall
  (now an explicit S per wall, flat at both corners) gave a busy jigsaw, and slivers where a tile's straight seam cuts
  a wavy wall.
- Changed: straight walls (bend 0; the S stays a knob). The default tile IS the cell then, its seams run in the grout,
  and the comma is the animal.

**Run 2, round 3b — the worst groups by eye (o, ** and xx; *x; 632 and 3*3), and 22*, 2*22.**

- Saw: o, **, xx had a banana (no head); *x's tail ran into a corner and left a thin dark tongue; 632 and 3*3 had a
  small crescent in a long triangle.
- Changed (by hand, with `view2.mjs` and `cell.mjs`):
  - a classic comma "9" in the tall cells (head 0.21 at the top, the tail curling down into a side wall);
  - a tadpole in *x;
  - in the 30-30-120 triangles, heads of 0.21 at the incentre with a tail curling into the base;
  - J-curls in 22* and 2*22.

  A taper power joins the table (its 10th number).

**Run 2, round 4 — polish.**

- Saw (at 3.2x): where a tail meets the grout at a slant, the dark between them ended in a spike (632, 22x, 442). A
  smooth minimum everywhere rounded it but dented the tile's straight edge wherever the comma passed near the grout.
  *x's head was drawn at 0.089: 0.04 off the centre line, it was shrunk by the rim rule.
- Changed:
  - the fillet (radius 0.09), confined within 0.22 of the junction;
  - *x's head on the centre line (0.129), with a tail that thins quickly (taper 1.9), so it reads as head and tail;
  - a bigger fallback comma;
  - `info.head`, the module's header, the tooltip;
  - the production validator, the fallback check and the remote runner.
- Sand side, phone, re-cut, Tile step and the 3D fold looked at: `app-*.png`.

**Run 3 — a second pair of eyes (13 Nov, 23:20 on).**

- Saw: `CRITIQUE.md`.
  - In the fold it says as much as today's Comma.
  - The grout lies on the seams.
  - \*x is stripes; 22\* and 2\*22 are bananas.
  - There are stars at the 6-fold centres.
  - The comma is a bay of the grout network.
- Tried, on the bench (`r3/`, pictures in `OUT/mosaic/r3/`):
  - a narrower grout and smaller rounding;
  - \*x with one comma (a hooked tail), then two;
  - flicked tails in 22\* and 2\*22;
  - fatter tails (taper times 0.6 and 0.4);
  - floating commas.
- Kept:
  - the floating commas, which gave the largest single gain;
  - taper times 0.6 (442: 0.45), with the body pulled in to a rim of 0.042;
  - grout 0.044 and rounding 0.025;
  - two late-curling commas in \*x.
- Dropped:
  - one comma in \*x (a wedge or a dark bar);
  - flicked tails in 22\* and 2\*22 (they read as a boot);
  - taper times 0.4 (bananas, and a dark speck in 442).
- Details: "After the critique" and "In the fold" at the top.
