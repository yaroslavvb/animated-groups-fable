# Swell — notes

Design module: `design.js` (this folder; run 2's as `design.v1.js`, its notes as `NOTES.v1.md`). The art director's
critique of run 2: `CRITIQUE.md`. Pictures and numbers: `~/drive.unsynced/artifacts/the-folding-patterns/swell/`
(`sheet.png`, `rows.json`, `zoom.png`, `back.png`, `app-t0.png`, `app-t06.png`, `app-t1.png`, `app-back.png`,
`app-phone.png`, `app-recut.png`, `app-tile.png`; run 2's as `*.v1.*`; every picture of the review in `review/`,
run 1 and 2 in `lab/`). Lab scripts: `lab/` (run 1, 2) and `review/` (the review: `metrics.mjs` the comma proxies,
`lab.sh` the node sheet, `equi.mjs` a group against its moved copy, `prof.mjs`, `deliver.sh` the standard set).

## The idea, in three sentences

Commas are seated so that they **nest**: each comma's tail winds round the head of a neighbouring copy (a half-turn
gives the yin-yang pair, a rotation of order 3, 4 or 6 a tomoe, a glide a chain, a translation a running wave), so
every bay holds a head. Each comma is then **swollen into the room around it** — a point is dark when it is clearly
nearer to its own comma than to any other — which closes the plane up to white channels while the head, the curling
tail and the hand stay readable. Only the kaleidoscopes' chambers, where every neighbour is a mirror image, hold a
nested PAIR of commas, a big one and one at 0.7 of its size.

## The rule and its knobs (`KNOBS` in `design.js`; lengths in tile sizes `u`)

1. **The tile**: the page's default tile (`presets[0]`), or the same Dirichlet tile from a table of seeds in lattice
   coordinates (`SEED`, the only table) when a group comes without presets.
2. **One comma** (`seatSingle`). The spine runs from the head `h` round the partner's head `p = g(h)` in polar
   coordinates about `p`: angle `a0 + sweep s`, distance `rw + (|h-p| - rw)(1-s)^m`; the radius falls from the head
   to the tip as `((1 + cos πt)/2)^0.6` (floor `tipMin` 0.03). Searched: `h` on a grid over the tile (step 0.2, offset
   0.37), the partner among the 4 nearest images of `h` (a tie at the cut kept whole) that are rotations or glides —
   or, in a group without rotations (`o`, `**`, `xx`, `*x`), translations, wound round by `transSweeps` 0.8 / 1.2 / 1.6
   (the tail wraps part of the way round the next copy's head, on the side away from that copy's own tail). No
   mirror, no glide along a mirror, no partner whose head lies across a mirror (`acrossPrune`). `sweep` 2.5 / 3.2,
   `rw` 0.2 … 1.2, `m` 1 / 3, either hand. The head radius is the largest the copies allow (closed form, gap 0.08).
   The 40 largest seats are weighed by a probe of the bare places they leave (`area − 25 (bare − 0.4)²`) and the best
   is refined; the radii are then leaned to 0.75. Tails pinned to a tile corner (`singlePins`) are off, except in
   the thin strip of `*x`.
3. **A pair** (`seatPair`, the chambers): heads `a`, `b` on a grid in the tile, A winding round B's head and B (radii
   0.7) round A's, the same way round; free spirals, or tails pinned to two corners. Weighed `area − 10 (bare − 0.5)²`.
   A strip too thin for either (`*x`, inradius < 0.24) gets one long comma bending toward its partner.
4. **The swell** (`ruleAt`). In the gauge `D = (|x − c| − r)/(r + 0.5 r_head)`: dark ⇔
   `(λ D_other − D_own)/(λ/w_other + 1/w_own) > channel/2` (0.06), the comma itself always dark. `λ` for a dark share
   of 0.56, raised (up to 0.62) where a bare place wider than 0.42 is left. In a chamber, and in a tile with a mirror
   side where it leaves no larger bare place (`marginGain` 0), the commas instead fill their rooms in plain distance
   with `λ = 1` up to channels of one width found for the share, narrowing toward chamber corners.
5. **The outline**: the field blurred (8 passes; 14 in the room-filling swell), the comma put back unblurred,
   marching squares, Taubin smoothing, resampled at 0.014.

## Numbers (the official sheet, `proto.mjs`, 13 Nov 2026 23:58; `rows.json`)

| group | dark | bare ⌀ | solid ⌀ | pts | ms | nesting | λ | channel | solidity, asym (v1) |
|---|---|---|---|---|---|---|---|---|---|
| o | 0.557 | 0.272 | 0.470 | 289 | 78 | translation | 0.22 | 0.06 | 0.73, 0.40 (0.89, 0.32) |
| 2222 | 0.558 | 0.380 | 0.466 | 304 | 77 | half-turn | 0.34 | 0.06 | 0.61, 0.44 (0.73, 0.49) |
| \*\* | 0.617 | **0.531** | 0.554 | 270 | 70 | translation | 0.57 | 0.06 | 0.94, 0.16 (0.96, 0.14) |
| xx | 0.560 | 0.368 | 0.520 | 272 | 63 | translation | 0.22 | 0.06 | 0.73, 0.40 (0.74, 0.31) |
| \*x | 0.551 | 0.393 | 0.321 | 349 | 67 | translation (thin strip) | 0.50 | 0.06 | 0.85, 0.24 (0.96, 0.14) |
| 333 | 0.556 | 0.329 | 0.464 | 324 | 50 | rotation 3 | 0.27 | 0.06 | 0.55, 0.48 (same) |
| 22x | 0.559 | 0.321 | 0.511 | 286 | 65 | half-turn | 0.24 | 0.06 | 0.67, 0.43 (same) |
| 22\* | 0.552 | 0.380 | 0.394 | 298 | 58 | half-turn | 1 | 0.25 | 0.63, 0.48 (0.77, 0.23) |
| \*2222 | 0.540 | 0.404 | 0.430 | 342 | 58 | pair | 1 | 0.24 | 0.87, 0.30 (same) |
| 2\*22 | 0.547 | 0.455 | 0.407 | 308 | 46 | half-turn | 1 | 0.25 | 0.60, 0.56 (0.64, 0.41) |
| 442 | 0.572 | 0.436 | 0.544 | 288 | 74 | rotation 4 | 0.47 | 0.06 | 0.66, 0.63 (0.69, 0.49) |
| 632 | 0.554 | 0.430 | 0.464 | 347 | 72 | rotation 6 | 0.46 | 0.06 | 0.49, 0.71 (0.76, 0.45) |
| 3\*3 | 0.545 | 0.368 | 0.480 | 329 | 53 | rotation 3 | 1 | 0.20 | 0.59, 0.53 (0.91, 0.38) |
| \*333 | 0.535 | 0.385 | 0.429 | 361 | 44 | pair | 1 | 0.18 | 0.73, 0.48 (same) |
| 4\*2 | 0.551 | 0.329 | 0.479 | 301 | 51 | rotation 4 | 1 | 0.30 | 0.61, 0.45 (0.95, 0.17) |
| \*442 | 0.536 | 0.429 | 0.380 | 373 | 47 | pair | 1 | 0.17 | 0.80, 0.33 (same) |
| \*632 | 0.537 | **0.480** | 0.399 | 375 | 61 | pair | 1 | 0.17 | 0.91, 0.40 (same) |

(solidity = area / convex hull of the main mark, a pebble near 1; asym = the least share of it that differs from its
own mirror image, a teardrop near 0: `review/metrics.mjs`. λ 1 with a wider channel: the room-filling swell.)
Over the 17: dark 0.535 – 0.617, bare 0.272 – 0.531 (at most 0.455 except `**` and `*632`), solid 0.321 – 0.554,
270 – 375 points, 44 – 85 ms in the mini's Chrome, no overlap; main mark solidity 0.80 → 0.70, asym 0.35 → 0.44 on
average. `lab/validate.mjs`: `src/shapes.js` `validateShapes` ok for all 17 and for turned (0.83 rad), scaled (1.37),
shifted copies of all 17, whose motif is the moved motif to 9e-9 tile sizes. `app-sheet.mjs`: the print takes in all
17 at t = 0, 0.6, 1 with no page error and no rule broken (`app-t*.json`).

## After the critique

The critique (`CRITIQUE.md`) found the commas good under the swell and the swell making blobs of them wherever no
neighbour's head sat in the bay: 11 of 17 groups were potatoes, pebbles, wedges, a bottle, a starburst or lace. The
causes were in the SEAT, not in the swell. What changed, in rounds (pictures `review/r*.png`):

1. **Translation partners** (`transSweeps`). Run 2 had none ("a translate's body leaves its head the same way"), so `o`
   and `**` fell back to a pair, which swelled into a boot and a kidney, two potatoes. A tail CAN wind part of the
   way round the head of the next translate, on the side away from that copy's tail: `o` became a running wave of fat
   commas (bare 0.357 → 0.272, λ 0.51 → 0.22: the comma itself carries the dark share) and `xx` nested commas with
   their glide copies flipped (solidity 0.74 → 0.73, asym 0.31 → 0.40). Only in groups without rotations, where no
   rotation partner exists.
2. **No tails pinned to tile corners** (`singlePins` 0). A pinned tail wraps only 70 – 80° round its partner's head;
   the swell then fills the bay. Without pins `632` turned from a starburst of petals into six-comma whirls, `4*2`
   from pebbles into four-comma whirls (bare 0.47 → 0.33), `3*3` from wedges into tomoe (0.51 → 0.37), `22*` from a
   knobbed bottle into S-shaped commas. `*x`'s thin strip keeps its pins (without them its bare place was 0.61).
3. **The bare probe weighted harder** for the single comma (`probeB0` 0.5 → 0.4, `probeW` 10 → 25): `2222` 0.505 → 0.38,
   `442` 0.515 → 0.436, `632` 0.50 → 0.43, and the marks curl more. The pairs keep run 2's weights (the stronger one
   turned `*2222` into pebbles with a bare place of 0.48).
4. **`marginGain` 0**: `2*22`'s yin-yang is two C-shaped commas in the room-filling swell instead of a rounded
   rectangle split by a slit (0.48 → 0.455, asym 0.41 → 0.56).
5. **Speed and determinism.** `**` took 126 – 147 ms with the translation partners; partners whose head lies across a
   mirror are no longer tried (`acrossPrune`, off in the thin strip, where a short pinned tail bends toward such a
   partner without reaching the mirror): 70 – 85 ms. A moved `xx` got another seat: a translation by +v and by −v tie
   in distance, the angle that breaks the tie sits on the branch cut of `atan2` for −v, and rounding in the turned copy
   flipped π to −π. π is folded onto −π, and a tie at the cut of 4 partners is kept whole: all 17 moved copies now
   give the moved motif.

Tried and not kept (knobs left at 0 or reverted): keeping the bay open by counting the comma's own far part as another
comma (`selfFar`: no visible change: where a comma curls, a partner's head is in the bay already); one comma per
chamber (`chamberSingle`: bare places 0.57 – 1.04, wedges and arches); the swell meeting mirror copies in plain
distance and all others by λ (`**` 0.61, `*x` dog-bones; reverted); a lower dark target 0.50 (a speck in `22*`, little
gain); a looser bare limit (bare to 0.58, no gain in comma); a smaller second comma in the chambers (β 0.5: the
room-filling swell splits a chamber by position, not size); more rounding of the room-filling swell (smoother, but the
dark share fell and the bare places grew); 48 discs per comma (no change).

## In the fold

Seen in `app-t0/t06/t1.png`, the fold pane at full size (`review/v2-fold-t06.png`), `app-back.png`, `app-phone.png`,
`app-recut.png`, `app-tile.png`.

- **Which side is up** is never in doubt: teal against sand in every fold, and the marks are big enough that the sand
  side's low contrast keeps them (`back.png`, `app-back.png`).
- **Head and tail can be followed** on the pillows and pockets: 22x's cross-cap carries a whole comma, `**`'s annulus a
  whole tadpole, 333, 442, 4\*2, 3\*3, 632, 22\*, 2\*22 show a head and its curling tail on the closing pyramid, and
  at t = 0 the flat tile shows one comma in 2222, xx, 333, 22x, 442.
- **Thin shapes still carry stripes.** At t = 0.6 the tubes of the torus and the Klein bottle and the Möbius band are
  thin, and a comma compressed round the tube reads as a band; the torus at t = 1 shows the marks again. `o`'s commas
  are 1.75 tile sizes long and cross the narrow parallelogram tile diagonally, so the tile holds slices, not a whole
  mark (run 2's kidneys were inside it but were no commas).
- **Seams close**: the re-cut of xx and 22x carries the print in register piece by piece, and the Tile step's cards
  carry it (`app-recut.png`, `app-tile.png`).
- **Calmer than run 2** in the groups that changed (one mark per tile, whirls instead of a starburst); the
  kaleidoscopes are as busy as before.

## What is weak (honestly)

- **The kaleidoscopes are lace** (`*2222`, `*333`, `*442`, `*632`): two marks per chamber (in `*333` and `*442` the
  second a pebble, solidity 0.99 and 0.98; `*2222`'s jigsaw pieces near-symmetric, asym 0.30 and 0.35), 8 – 24 pieces
  round each corner; unchanged from run 2. Nothing tried in this round helped.
- **`**`** is a column of tadpoles with a weak curl (solidity 0.94, asym 0.16) and a bare place of 0.531 on the
  mirrors (target 0.45, cap 0.6): its 0.71-wide column leaves no room for a tail to curl round a head. Run 2's pair met
  the target (0.43) with two potatoes; a direction was judged worth more than the last 0.08 of fill.
- **`*x`** is a long fish (solidity 0.85, asym 0.24), a stripe on the Möbius band.
- **Two swells, two weights of channel**: 0.06 in the λ groups, 0.17 – 0.30 in the room-filling ones (22\*, 2\*22,
  3\*3, 4\*2, the chambers); the room-filling outlines have a slight wobble (`22*`, `2*22`).
- **Tail tips** end 0.06 wide; at zoom they read as whiskers in 632 (near the 3-fold points) and as a small hook on
  22\*'s tail by the mirror.
- **`*632`** keeps its bare place of 0.48 at the 6-fold corner.

## What I would try next

- The kaleidoscopes: a pair that is a big comma and a SMALL accent (the second comma not swollen, or swollen less),
  so one mark dominates each chamber.
- `**`: a chain of two commas per period of the column, each winding round the next one's head.
- One swell for all: the room-filling swell's even channel against mirror copies only, with a gauge that keeps the
  head fatter than the tail, so channels have one weight in all 17.
- The distance to a tapered stroke (segments with interpolated radius) instead of to its discs: smoother outlines in
  the room-filling swell.

## Rounds

1. *(run 1) Four easy groups.* A comma fitted in the tile already covers 45 – 53 %; plain `d_own < λ d_other` barely
   swells or gives angular cells. Changed: the gauge, the channel term.
2. *(run 1) All 17.* Tip in a corner, a seat with a bay bonus; flowers at rotation centres, arcs that cannot enter 30°.
3. *(run 1) The worst.* λ = 1 gives pebbles: belly and back apart, the bay capped.
4. *(run 1) Polish.* Beads, whiskers, kinks; 10× faster field; equivariant seat.
5. *(run 2) A fresh sheet of run 1.* 12 of 17 marks read as blobs with a notch. Changed: the seat — the tail winds
   round a copy's head (nesting).
6. *(run 2) All 17.* No translation partners (`o`, `**` take a pair), spines that dive then orbit, tails pinned to
   tile corners, a bare probe in the score, plain distance and one channel width in chambers.
7. *(run 2) The three worst* (\*632, \*442, 632). Pinned pairs, channels narrowing toward chamber corners, the cap 0.62.
8. *(run 2) Polish.* The grid offset by 0.37 step, ties broken by the order found, tip floor 0.03, 14 blur passes.
9. *(review) The critique* (`CRITIQUE.md`): 11 of 17 groups not commas; the commas under the swell are fine, the seat
   is the cause.
10. *(review) Translation partners*: `o` and `xx` become commas; `**` a tadpole column; the open-bay channel tried, no
    effect.
11. *(review) No single pins, the stronger bare probe*: 632, 4\*2, 3\*3, 22\* become whirls, tomoe and S-commas;
    2222, 442, 632 under 0.45; the pairs keep the old weight; one comma per chamber tried and dropped.
12. *(review) The mirror hybrid swell* tried and reverted; `marginGain` 0 for 2\*22.
13. *(review) Speed and determinism*: `acrossPrune` (`**` 147 → 80 ms), the ±π tie, ties kept whole at the cut;
    validator ok for all 17 and moved copies of all 17; the standard set rendered fresh.
