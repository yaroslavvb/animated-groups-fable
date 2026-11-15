# Spirals (`spiral`) — notes

## The idea

One spiral arm per fundamental domain: a comma whose tail keeps winding. The arm starts at a round head in the middle
of the page's default tile, winds out 1.2 to 1.45 turns between the turns of a bare channel, runs along the tile's rim
and ends in a point beside the channel's mouth, where a bare wedge shows the hand from afar. The motif fills the tile
(set back by a margin), so every default tile holds exactly one whole mark, and copies are disjoint. The pattern's
symmetry group is the group itself, because the mark has no symmetry of its own.

## The rule and its knobs (`KNOBS` in design.js; lengths in tile sizes)

- **The tile.** The Dirichlet tile of `presets[0]` (the page's default tile); without presets, the same tile from
  `SEEDS`, a table of seed positions in lattice coordinates (dimensionless). Set back by `margin` 0.026, so copies are
  0.052 apart.
- **Long tiles** are squeezed along their principal axis toward round (`squash`, up to `squashCap` 2.2, keeping
  `keepDepth` 0.9 of the depth), the spiral is drawn there and stretched back, which gives an elliptic spiral.
- **Levels.** The level curves are rounded insets of the tile (`round0`, `roundIn`, `roundPow`, `aniso`). The
  channel follows them by arc length.
- **Widths.**
  - channel `slit` 0.085 (×0.85 at its round end, ×1.15 at its mouth)
  - arm at least `arm` 0.075
  - head `headR` 0.07
  - tail point `tip` 0.052, `tipLen` 2.6 tip widths long
  - all scaled down in a shallow tile (`full`, `shrink`), never below `floors` (0.042 to 0.05)
  - `gamma` 0.8 makes the inner turns fatter: the arm thins from the head outward
- **Turns.** As many as leave the arm its least width: `turnsMin` 1.15 to `turnsMax` 1.45.
- **The seat.** The hand, the corner or side where the tail's point ends (`places`) and the length of the bare wedge
  (`flares`) are searched. The longest wedge is taken that leaves no bare disc wider than `bareMax` 0.4 along it,
  doubled as if the neighbour across the rim were a mirror image. Ties are broken by a reference point that moves with
  the group.
- **The snail (new in this run, `snail` knobs).** A tile too shallow for 1.15 turns (only the strip of `*x`: 0.43
  across, 5.3 times as long) gets a snail instead of the old one-loop hairpin:
  - at one end, a round curl with 1.1 turns of channel round a head: `arm` 0.052, `slit` 0.047, `head` 0.04
  - the curl's outer whorl leaves along one long side as a fat body (`body` 0.58 to `bodyEnd` 0.76 of the strip)
  - the body is rounded at the far end (`nose`)
  - a bare channel over the body runs into the curl
  - the floor of that channel winds round the curl at the channel's pitch, so the arm under it keeps its width
    (`ramp` is the fillet)
  - it is built as a level set `max(rim, -bare)` with smooth unions, traced by marching squares on a grid of 0.0035
    and thinned by Douglas-Peucker to 0.0004
  - the curl goes at the end nearer the reference point

## The numbers of v1 (the designer's, `design.v1.js`; `rows.v1.json`). The current numbers are under "After the critique".

| group | dark | bare ⌀ | solid ⌀ | overlap | verts | ms | turns | hand |
|---|---|---|---|---|---|---|---|---|
| o | 0.52 | 0.253 | 0.25 | 0 | 391 | 6 | 1.338 | cw |
| 2222 | 0.527 | 0.295 | 0.25 | 0 | 418 | 3 | 1.45 | cw |
| ** | 0.519 | 0.368 | 0.25 | 0 | 394 | 3 | 1.399 | cw |
| xx | 0.517 | 0.25 | 0.25 | 0 | 405 | 2 | 1.409 | cw |
| *x | 0.567 | 0.357 | 0.286 | 0 | 195 | 12 | 1.114 | snail ccw |
| 333 | 0.521 | 0.272 | 0.279 | 0 | 398 | 3 | 1.412 | cw |
| 22x | 0.511 | 0.288 | 0.26 | 0 | 412 | 1 | 1.444 | cw |
| 22* | 0.538 | 0.286 | 0.321 | 0 | 363 | 1 | 1.189 | ccw |
| *2222 | 0.51 | 0.368 | 0.272 | 0 | 412 | 1 | 1.444 | ccw |
| 2*22 | 0.519 | 0.286 | 0.286 | 0 | 381 | 1 | 1.283 | ccw |
| 442 | 0.526 | 0.25 | 0.253 | 0 | 413 | 1 | 1.445 | cw |
| 632 | 0.502 | 0.321 | 0.286 | 0 | 383 | 1 | 1.246 | ccw |
| 3*3 | 0.502 | 0.321 | 0.286 | 0 | 383 | 2 | 1.246 | ccw |
| *333 | 0.577 | 0.38 | 0.305 | 0 | 366 | 5 | 1.293 | ccw |
| 4*2 | 0.546 | 0.253 | 0.305 | 0 | 367 | 6 | 1.289 | ccw |
| *442 | 0.546 | 0.368 | 0.305 | 0 | 367 | 6 | 1.289 | ccw |
| *632 | 0.515 | 0.364 | 0.272 | 0 | 398 | 6 | 1.276 | cw |

Worst over the 17 groups:

| measure | value | target |
|---|---|---|
| dark share | 0.502 to 0.577 | 0.40 to 0.62 |
| largest bare disc | 0.38 (`*333`) | at most 0.45 |
| largest solid disc | 0.321 (`22*`) | at most 0.7 |
| overlap | 0 | 0 |
| vertices | at most 418 | at most 2400 |
| time per group | at most 12 ms in Chrome; up to about 60 ms for the `*x` snail in a cold node | under 120 ms |

Checks, each a script in this folder (plain node, one or two seconds each):

| script | what it checks | result |
|---|---|---|
| `validate.mjs` | the production validator (`src/shapes.js` `validateShapes`) on all 17 groups, and on each group carried to two turned, scaled and shifted places without presets | all valid; gap 0.052; stabilizer 1; the carried motif equals the home motif carried along (the snail within 0.0003, the trace's noise) |
| `robust.mjs` | presets and random Dirichlet tiles | 90 tiles, no crossing, nothing outside the margin |
| `robust-snail.mjs` | the snail forced on every such tile | 90 tiles, no crossing, nothing outside, never without room |
| `necks.mjs` | narrowest place of the outline | `*x` 0.043 (the channel's round end); 0.043 to 0.06 in the others |
| `app-sheet.mjs` | the real app, all 17 groups at t = 0.6 (`app-t06.json`) | 0 errors, no validator problems, the print took |

## Rounds

The first run left no notes. Its rounds below are reconstructed from the names of its pictures (OUT/rounds) and the
header of design.js.

1. *(first run)* What I saw: a polygonal spiral on o, 2222, 442 and 333 read well, but its corners were bare. What I
   changed: rounder level curves (`round1-*.png` in OUT/rounds).
2. *(first run)* What I saw on all 17: a frame along the rim was too dark, and the hand was unclear. What I changed:
   the bare wedge past the mouth, and the tail ending in a point (`round2-*.png`).
3. *(first run)* What I saw: a long wedge left bare discs over 0.45 in the kaleidoscopes and thin triangles. What I
   changed: the wedge length and the tail's place are searched against `bareMax` 0.4, with mirror doubling
   (`round3-*.png`).
4. *(first run)* What I saw: details such as the channel's round end, the point's squaring, and necks under 0.04.
   What I changed: the floors, the squeeze limit `keepDepth` and the taper fallback (`round4-details.png`). The first
   run was cut off here, before writing these notes.
5. *(this run)* What I saw: all numbers in range, but `*x` was a hairpin (0.72 turns) that read as stripes, not a
   spiral. What I changed: the snail for shallow tiles (`r5a` to `r5g`), with dark 0.567, bare 0.357 and 1.11 turns.
   Its first floor pinched the arm under the mouth to 0.033, so the floor now winds round the curl at the channel's
   pitch (0.043).

## What is weak

- **`*x` is still mostly a bar.**
  - The strip's width caps the curl at 0.38 tile sizes, against a 2.3-long body.
  - At sheet scale the curl is a small hook at the end of a long bar.
  - In `zoom.png` the curl falls outside the window (it is about 1 tile size from the tile's centre), so that panel
    shows only bars. The unzoomed sheet and the app show it.
  - The snail's 1.1 turns are below the brief's 1.25.
  - It is a variant of the family: there, the arm's fat end is the body; elsewhere, the head is in the middle.
- **The grout.** A copy fills its tile up to the 0.052 margin, so every tile edge shows as a thin pale line.
  - At the 6-fold centres of 632 and 3*3, 12 such lines meet in a small star.
  - It reads as structure (in the kaleidoscopes the lines lie on the mirrors, under the ink), but it is the tile's
    structure, not the group's. Re-cut the tile and the lines no longer follow its edges.
- **Square spirals.** In squares and rectangles the turns follow the rim, which gives a Greek-key look rather than a
  round snail. In the obtuse triangles of 632 and 3*3 the spiral is flattened (squeeze 1.68).
- **The sand side** reads, but at lower contrast, as all designs do on the fixed colours.

## What I would try next

- `*x`:
  - let the body carry a second, smaller curl at its far end, so both ends of the strip read as spirals (a scroll); or
  - put the curl on the default tile's centre line, which needs a motif that crosses the tile's short edges.
- Round the level curves more in squares (raise `roundIn`, `roundPow`) for a snail look rather than a key.
- Shorten the grout at sharp corners (a larger corner radius `round0` only at corners under 45 degrees), to soften the
  star at the 6-fold centres.

## After the critique (the art director's round, 13 Nov 2026, second run)

The critique is in `CRITIQUE.md`, ranked. Its first finding is the one that matters: the mark IS the tile.

- The outer turn runs along the whole rim, so the plane reads as a floor of tile-shaped slabs.
- Each slab carries a pale spiral groove.
- There is no comma silhouette: no head, no tail.

**What I tried.** Experiments are in `exp/`; their pictures are `OUT/x-*.png`.

1. **Knobs only (`exp/k1`, `k2`, `k3`).**
   - A bigger head (0.12 to 0.15), a stronger taper, rounder levels, a wider channel, longer wedges.
   - Result: still a slab, now with a C- or @-shaped groove.
   - A big head costs turns or channel width. k3's thin groove made the slab read even more strongly.
   - 22* fell into the snail branch.
2. **A rewrite as a FIGURE (`exp/curl.js` to `curl5.js`, shared helpers in `exp/lib.js`).**
   - The dark is a round head plus one arm that tapers to a point. The bare channel between the turns keeps one width.
   - It is drawn in a round model and carried into the tile by fitted levels, as a traced level set.
   - In the deep tiles (2222, 333, 22x, 442), `curl3` reads at once as curls: a head and a winding arm. It is much
     closer to "the comma whose tail keeps winding".
   - But one mark per default tile, with every corner filled, forces the outer whorl onto the rim. Corners matter
     because 4, 6 or 12 of them meet at a vertex.
   - Every way round this failed one rule or another (dark / bare disc in brackets):
     - `curl3`: a crescent outside the tail leaves bare corners (bare discs up to 1.8 in `*632`, 1.3 in `632`,
       1.0 in `*333`).
     - `curl4`: the channel kept to a true width brings the slab back (dark up to 0.65).
     - `curl5`: the crescent pulled back from every corner gives "ears", lumps where the arm swells into each corner.
   - None was clean in all 17 groups, so none ships.
3. **What ships (`design.js` = `exp/k6.js` folded in; `design.v1.js` is the backup).** Only the changes that cost no
   turns and break no rule:
   - **Rounder levels and rim corners** (`round0` 0.022 -> 0.034, `roundPow` 0.5 -> 0.38). The middle turns of 2222,
     333 and the squares are rounder, less Greek key.
   - **Longer wedges where the bare-disc limit allows** (`flares` up to 0.7 turns, `bareMax` 0.41). 2222, 22x, 22*,
     *2222 and *632 now take 0.62 to 0.7 of a turn (v1: at most 0.55), so the tail visibly tapers off the rim there.
   - **`*x`: a slimmer snail body** (`snail.body` 0.58 -> 0.5, `bodyEnd` 0.76 -> 0.66). The closed Moebius band was one
     solid teal band (finding 4); now it is a dark stripe beside light bands (`x-k4-mobius.png`, `app-t1.png`).
   - Rejected on the way (`exp/k4`, `k5`): a head of 0.085 and `gamma` 0.7. They cost 0.05 to 0.14 turns everywhere,
     which put nine groups under the brief's 1.25 turns (v1: two). The head gain was barely visible.

**Verified.**

| check | result |
|---|---|
| `validate.mjs` (the production `validateShapes`, home and two carried copies without presets) | all valid; gap 0.052, stabilizer 1 |
| `robust.mjs` | 209 tiles, 0 problems |
| `robust-snail.mjs` | 141 tiles, 0 problems |
| `necks.mjs` | narrowest feature 0.043 to 0.061 |
| `app-sheet.mjs` (`app-t06.json`) | all 17 took the print; 0 page errors; 0 validator problems |

`suite.sh` was not run, because only files in `designs/spiral/` changed and no test imports them.

**The numbers now** (proto.mjs, mini Chrome, `rows.json`):

| group | dark | bare ⌀ | solid ⌀ | verts | turns | flare |
|---|---|---|---|---|---|---|
| o | 0.518 | 0.258 | 0.258 | 405 | 1.338 | 0.55 |
| 2222 | 0.495 | 0.319 | 0.25 | 440 | 1.45 | 0.7 |
| ** | 0.52 | 0.386 | 0.25 | 419 | 1.399 | 0.55 |
| xx | 0.518 | 0.253 | 0.25 | 414 | 1.409 | 0.55 |
| *x | 0.502 | 0.429 | 0.25 | 194 | 1.114 (snail) | — |
| 333 | 0.522 | 0.286 | 0.279 | 416 | 1.412 | 0.47 |
| 22x | 0.492 | 0.319 | 0.272 | 425 | 1.444 | 0.62 |
| 22* | 0.516 | 0.288 | 0.295 | 369 | 1.189 | 0.62 |
| *2222 | 0.492 | 0.407 | 0.272 | 425 | 1.444 | 0.62 |
| 2*22 | 0.519 | 0.288 | 0.286 | 385 | 1.283 | 0.55 |
| 442 | 0.526 | 0.253 | 0.253 | 427 | 1.445 | 0.55 |
| 632, 3*3 | 0.535 | 0.354 | 0.319 | 370 | 1.246 | 0.47 |
| *333 | 0.581 | 0.385 | 0.319 | 379 | 1.293 | 0.27 |
| 4*2 | 0.553 | 0.253 | 0.323 | 377 | 1.289 | 0.4 |
| *442 | 0.553 | 0.368 | 0.321 | 377 | 1.289 | 0.4 |
| *632 | 0.525 | 0.404 | 0.286 | 384 | 1.276 | 0.47 |

Worst over the 17 groups:

| measure | value | target |
|---|---|---|
| dark share | 0.492 to 0.581 | 0.40 to 0.62 |
| largest bare disc | 0.429 (`*x`: its channel doubled across the mirror) | at most 0.45 |
| largest solid disc | 0.323 | at most 0.7 |
| overlap | 0 | 0 |
| vertices | at most 440 | at most 2400 |
| time per group, mini Chrome | at most 11 ms | under 120 ms |

**What is still wrong.**

- Findings 1 and 2 of the critique stand: a tile-shaped slab with a groove, and a head the size of the arm.
- The changes are a refinement, not the comma the owner asked for.

## In the fold (`app-t0`, `app-t06`, `app-t1`, `app-back`, `app-phone`, `app-recut`, `app-tile`)

What I saw:

- **Which side is up.** Readable everywhere: teal against sand, and mirrored copies curl the other way. Half folded and
  closed, most hinge groups show the SAND side (2222, 333, 22*, 2*22, 442, 632, 3*3, the kaleidoscopes). There the
  spiral reads, but pale.
- **Following the head and the tail.** One whole spiral per tile.
  - In the closed kaleidoscopes (*2222, *333, *442, *632) and the pillows (333, 442), the single spiral of the tile
    sits on the closed shape, and its centre and wedge can be found.
  - Its turns look alike, so following a single region through the fold is weaker than with a comma.
- **Seams.** At the default cut the seams lie on the pale grout (0.052), so the seams show as pale lines on the closed
  shape. No mark is cut by a seam there, so none has to join up. After a re-cut (`app-recut`) the pieces re-assemble
  ONE whole spiral in the home tile, which reads well.
- **Thin and curved parts.**
  - The torus (o) and the Klein bottle (xx): the long straight runs become bands along the tube. No spiral can be
    seen on the closed torus. This is unchanged and is the weakest fold.
  - The Moebius band (*x): v1 was one solid teal band. Now it is a dark stripe with light bands beside it, so the band
    has an edge to follow. Its curl sits at the seam.
- **Calm or busy.** Calmer than the comma, which is a big translucent mark. On the closed shapes it is busier than the
  checkerboard, which is uniform. One spiral per face reads as decoration rather than as structure.
- **The Tile step** (`app-tile`): every card carries one whole spiral, so the replication reads card by card.

What remains weak, in order:

1. The slab silhouette and the grout network (the plane reads as tiles).
2. No real head.
3. Torus and Klein bottle stripes.
4. The sand side's low contrast.
5. 632 and 3*3: flame-like spirals, and the star at the 6-fold centres.
