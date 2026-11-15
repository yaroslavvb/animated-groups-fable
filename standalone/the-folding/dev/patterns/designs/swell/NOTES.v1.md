# Swell — notes

Design module: `design.js` (this folder). Pictures and numbers: `~/drive.unsynced/artifacts/the-folding-patterns/swell/`
(`sheet.png`, `zoom.png`, `back.png`, `rows.json`, `app-t06.png`, `app-back.png`; every intermediate picture in `lab/`,
run 1's last design as `lab/design-run1-final.js`, its notes as `lab/NOTES-run1.md`). Lab scripts: `lab/` here.

## The idea, in three sentences

Commas are seated so that they **nest**: each comma's tail winds round the head of a neighbouring copy (a half-turn
gives the yin-yang pair, a rotation of order 3, 4 or 6 a tomoe, a glide a chain), so every bay holds a head. Each comma
is then **swollen into the room around it** — a point is dark when it is clearly nearer to its own comma than to any
other — which closes the plane up to even white channels while the head, the curling tail and the hand stay readable.
Where no copy can reach into a bay (a kaleidoscope's chamber, whose neighbours are mirror images; `o` and `**`, which
have only translations and mirrors) the tile holds a nested PAIR of commas, a big one and one at 0.7 of its size.

## The rule and its knobs (`KNOBS` in `design.js`; lengths in tile sizes `u`)

1. **The tile**: the page's default tile (`presets[0]`), or the same Dirichlet tile from a table of seeds in lattice
   coordinates (`SEED`, the only table) when a group comes without presets.
2. **One comma** (`seatSingle`). The spine runs from the head `h` round the partner's head `p = g(h)` in polar
   coordinates about `p`: angle `a0 + sweep s`, distance `rw + (|h-p| - rw)(1-s)^m`; the radius falls from the head
   to the tip as `((1 + cos πt)/2)^0.6` (floor `tipMin` 0.03). Searched: `h` on a grid over the tile (step 0.2, offset
   0.37 so no point sits on a rim), the partner among the 4 nearest images of `h` that are rotations or glides
   (no mirror, no glide along a mirror, no translation: a translate's body leaves its head the way this one's does),
   `sweep` 2.5 / 3.2, `rw` 0.2 … 1.2, `m` 1 / 3, either hand, and tails pinned to a corner of the tile (sweep at least
   1.3, or 0.9·2π/n round a partner of order n). The head radius is the largest the copies allow (closed form, gap
   0.08). The 40 largest seats of each kind are weighed by a probe of the bare places they leave
   (`area − 10 (bare − 0.5)²`) and the best is refined. The radii are then leaned to 0.75.
3. **A pair** (`seatPair`): heads `a`, `b` on a grid in the tile, A winding round B's head and B (radii 0.7) round A's,
   the same way round; free spirals, or tails pinned to two corners (sweep ≥ 0.6). Inside the tile by half a gap.
   A strip too thin for either (`*x`, inradius < 0.24) gets one long comma bending toward its glide partner.
4. **The swell** (`ruleAt`). In the gauge `D = (|x − c| − r)/(r + 0.5 r_head)` (the fat head claims more room than the
   thin tail): dark ⇔ `(λ D_other − D_own)/(λ/w_other + 1/w_own) > channel/2` (0.06), the comma itself always dark.
   `λ` for a dark share of 0.56, raised (up to 0.62) where a bare place wider than 0.42 is left. In a chamber, and in a
   tile with a mirror side where it leaves a bare place smaller by 0.05, the commas instead fill their rooms in plain
   distance with `λ = 1` up to channels of one width found for the share, narrowing within 0.6 of a chamber corner
   (to 0.25 of it): a corner is as near a mirror image as the comma, so `λ < 1` would leave it bare.
5. **The outline**: the field blurred (8 passes; 14 where the commas fill their rooms), the comma put back unblurred,
   marching squares, Taubin smoothing, resampled at 0.014.

## Numbers (the official sheet, `proto.mjs`, 13 Nov 2026 23:21; `rows.json`)

| group | dark | bare ⌀ | solid ⌀ | pts | ms | nesting | λ | channel | head r |
|---|---|---|---|---|---|---|---|---|---|
| o | 0.555 | 0.357 | 0.486 | 319 | 67 | pair | 0.51 | 0.06 | 0.19 |
| 2222 | 0.616 | **0.505** | 0.606 | 290 | 86 | half-turn | 0.50 | 0.06 | 0.25 |
| \*\* | 0.585 | 0.430 | 0.464 | 343 | 108 | pair | 0.72 | 0.06 | 0.13 |
| xx | 0.559 | 0.399 | 0.442 | 300 | 85 | glide | 0.38 | 0.06 | 0.22 |
| \*x | 0.557 | 0.385 | 0.321 | 338 | 57 | glide (thin strip) | 0.47 | 0.06 | 0.16 |
| 333 | 0.556 | 0.329 | 0.464 | 324 | 55 | rotation 3 | 0.27 | 0.06 | 0.26 |
| 22x | 0.559 | 0.321 | 0.511 | 286 | 69 | half-turn | 0.24 | 0.06 | 0.30 |
| 22\* | 0.553 | 0.407 | 0.546 | 296 | 69 | half-turn | 1.00 | 0.35 | 0.30 |
| \*2222 | 0.540 | 0.404 | 0.430 | 342 | 47 | pair | 1.00 | 0.24 | 0.20 |
| 2\*22 | 0.613 | **0.480** | 0.527 | 313 | 75 | half-turn | 0.56 | 0.06 | 0.21 |
| 442 | 0.613 | **0.515** | 0.559 | 287 | 70 | rotation 4 | 0.44 | 0.06 | 0.27 |
| 632 | 0.550 | 0.399 | 0.464 | 322 | 55 | rotation 6 | 0.38 | 0.06 | 0.21 |
| 3\*3 | 0.620 | **0.511** | 0.546 | 288 | 74 | glide | 0.58 | 0.06 | 0.23 |
| \*333 | 0.535 | 0.385 | 0.429 | 361 | 50 | pair | 1.00 | 0.18 | 0.16 |
| 4\*2 | 0.619 | **0.470** | 0.664 | 234 | 63 | rotation 4 | 0.55 | 0.06 | 0.29 |
| \*442 | 0.536 | 0.429 | 0.380 | 373 | 55 | pair | 1.00 | 0.17 | 0.13 |
| \*632 | 0.537 | **0.480** | 0.399 | 375 | 58 | pair | 1.00 | 0.17 | 0.16 |

(nesting, λ, channel, head r: `info` of `rows.json`; λ 1 with a wider channel: the commas fill their rooms; head r before the lean.)
Over the 17: dark 0.535 – 0.620, bare 0.321 – 0.515, solid 0.321 – 0.664, 234 – 375 points, 47 – 108 ms in the mini's
Chrome (40 – 120 ms over several runs on the shared pool), no overlap. `lab/validate.mjs`: `src/shapes.js` `validateShapes` ok for all 17 (copies 0.08 – 0.31 tile sizes
apart, stabiliser 1) and for turned (0.83 rad), scaled (1.37), shifted copies of 10 groups without presets, whose
motif is the moved motif to 1e-8 tile sizes. `app-sheet.mjs`: the print takes in the app in all 17 (`app-t06.png`), and
the sand side reads (`app-back.png`).

## What is weak (honestly)

- **Bare places over the 0.45 target** in 2222 (0.51), 442 (0.52), 3\*3 (0.51), 2\*22, \*632 (0.48), 4\*2 (0.47);
  none reaches 0.6. They sit at the rotation centres the nesting does not use (the other 4-fold class of 442, the
  mirror corners of 3\*3 and 2\*22, the 6-fold points of \*632). The bare probe of the seat is a proxy (a coarse grid and
  the tile's corners, before the swell), and it misses some of them.
- **Comma or blob.** The nested groups read as commas (333, 22x, 2222, 22\*, 2\*22, 442, 632, 4\*2: yin-yang or tomoe
  swirls). The pairs read as interlocking S-pairs in \*2222 and \*333, as wedges in the thin triangles of \*442 and
  \*632, and as kidney pairs in `o` and `**`. xx gives long waves; \*x a long drop per strip; 3\*3 fan-shaped marks.
- **Two kinds of swell.** Where the commas fill their rooms by one channel width (the four chambers, 22\*), the outline is
  more angular and the channels are wider (0.17 – 0.34) than in the λ groups (0.06 and more).
- **The default tile** holds the head and most of a comma, but a nested tail always leaves the tile to wind round its
  partner's head: no tile holds a whole mark in the nested groups (the pairs lie in their tile).
- 2\*22 runs both swells (74 – 120 ms on the mini, near the 120 ms target).

## What I would try next

- Score the seat by the bare place of the swollen print (run the field for the best five seats) instead of the probe.
- In the chambers: a tail into each sharp corner and the head in the right-angled one (a third comma, or a seat
  family that pins both tails), so \*442 and \*632 read as commas rather than wedges.
- One swell for all: the plain-distance channel with the gauge only between a comma and its own partner.

## Rounds

1. *(run 1) Four easy groups.* A comma fitted in the tile already covers 45 – 53 %; plain `d_own < λ d_other` barely
   swells or gives angular cells. Changed: the gauge, the channel term.
2. *(run 1) All 17.* Tip in a corner, a seat with a bay bonus; flowers at rotation centres, arcs that cannot enter 30°.
3. *(run 1) The worst.* λ = 1 gives pebbles: belly and back apart, the bay capped.
4. *(run 1) Polish.* Beads, whiskers, kinks; 10× faster field; equivariant seat.
5. *(run 2) A fresh sheet of run 1.* Saw: 12 of 17 marks read as blobs with a notch (the comma alone in its tile, its bay
   filled by the swell), \*442 and \*333 bare 0.58. Changed: the seat — the tail winds round a copy's head (nesting); in
   2222, 333, 22x the swollen cells became yin-yang and tomoe commas at once.
6. *(run 2) All 17.* Saw: translation partners cannot nest (a translate's body leaves its head the same way), glides far
   away need a dive, kaleidoscope pairs left corners bare (and a head across a mirror claimed this side of it in the
   gauge). Changed: no translation partners (`o`, `**` take a pair), spines that dive then orbit, tails pinned to tile
   corners, a bare probe in the score, plain distance and one channel width in chambers.
7. *(run 2) The three worst* (\*632 1.04, \*442 0.78, 632 0.62). Saw: the A/B channel ran into a chamber corner, a 6-fold
   tomoe left 3-fold centres bare. Changed: pinned pairs with sweeps from 0.6, channels narrowing toward chamber
   corners, the probe weight 10, the cap 0.62; all 17 under 0.6.
8. *(run 2) Polish.* Saw: a moved group got another print (grid points on the tile's rim, ties broken by rounding), hairline
   tail tips, lumpy Voronoi outlines. Changed: the grid offset by 0.37 step and ties broken by the order found, tip
   floor 0.03, 14 blur passes for the room-filling swell, its window 1.6 tile sizes.
