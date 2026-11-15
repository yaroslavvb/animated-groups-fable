# Tomoe: the critique (second run, 13 Nov 2026, 23:35)

Pictures, all fresh, in `~/drive.unsynced/artifacts/the-folding-patterns/tomoe/crit/`: `sheet.png` + `rows.json`
(all 17 flat, with numbers), `b1.png`, `b2.png`, `b3.png` (520 px, 3 columns), `zoom.png`, `back.png` (sand side),
`look-kal.png`, `look-defects.png`, `look-weak.png` (local rasters with the largest bare disc ringed red and the
largest solid disc blue), `app-t0.png`, `app-t06.png`, `app-t1.png`, `fold-t1.png` (the 3D pane alone, closed),
`app-back.png`, `app-phone.png`, `app-recut.png`, `app-tile.png`.

The numbers reproduce the designer's exactly (dark 0.454 to 0.608, bare 0.303 to 0.497, solid 0.286 to 0.536,
overlap 0, at most 667 vertices, at most 7 ms). The app shows the print in all 17 groups: no page errors and no
`validateShapes` problems.

## Ranked findings (worst first: what would bother the owner most)

1. **In the mirror groups the dark mark is the tile and the comma is a small keyhole cut into it.** This holds in
   \*333, \*442, \*632, \*2222, 3\*3 and 4\*2 (and partly in 2\*22 and 22\*). The light comma's back runs along one
   mirror, and the dark comma takes every other side, so the dark comma *is* the triangle or rectangle less a
   keyhole. In the plane this reads as a teal and sand triangle checkerboard with keyholes punched in it. That is
   the owner's complaint about the checkerboard (tile-shaped, symmetric-looking marks) and not "a comma that fills
   the surface".
   - The comma heads are specks: radius 0.10 / 0.12 in 3\*3, 0.15 / 0.17 in \*333, 0.16 / 0.17 in 4\*2, against
     about 0.3 in o, xx and 22x.
   - The dark share is 0.59 to 0.61 in all of them, so the dark chamber dominates.
   - The snowflake folds close to a sand triangle with a keyhole (`fold-t1.png`).
   - 3\*3 has a 30-degree pennant with a 0.04-wide dark spike along the mirror into its left corner.
   - In \*632 the dark heel sits in the 30-degree corner, so twelve dark slivers meet at every 6-fold point.
2. **The commas are boxy: their backs are the tile's straight edges and their heels are the tile's corners.** In
   the plane the default tile's grid shows as a net of long straight dark/light boundaries (o, 2222, 333, 442, 22\*,
   2\*22, \*2222). A mark reads as "a polygon cut by an S" before it reads as a comma. The taijitu's round back is
   gone. This is built into the concept (a tile split in two with no background), but the corners can be softened
   where dark meets dark.
3. **2222: the two commas are unequal.** The light comma's head is a knob of radius 0.13 on a neck. Its body is the
   whole lower half of the hexagon, so it reads as a blob with a keyhole. The dark head next to it is 0.32.
4. **\*x: two 2.3-long slugs per tile with heads of 0.16 at the ends.** They read as a ribbon or wave, not as commas,
   and the bare disc is 0.497 (over the 0.45 target). This is partly forced: an asymmetric mark cannot cross a mirror
   (a point on the mirror would be in both the mark and its image), and the mirrors of \*x are 0.433 tile sizes
   apart, so any comma there is at most 0.43 thick.
5. **There are hairline dark tails along mirrors.** In \*\* the dark tail down the right mirror is about 0.046 wide,
   and its mirror twin sits 0.048 away, so it reads as a double hairline. The 3\*3 spike is 0.04 wide. These break
   (c) "every feature at least 0.04 before its tip" in spirit, and (f) "no hairlines".
6. **In the fold.** Most closed shapes show the sand side outside, where the contrast is low.
   - The torus and the pillows show soft blobs, and on the torus the dark comma becomes a band round the tube.
   - The eyes save the reading where they are big: the light head with its dark eye is clear on 22x, \*x and the
     Klein bottle.
   - Where the tile is a yin-yang (o, xx, 22x, \*\*) one can follow head and tail into the fold, and which side is
     up (teal or sand) is always clear.
   - The re-cut is a pleasure: the pieces reassemble the yin-yang in the home tile.
   - On the phone the plane of \*632 is a tangle of triangles.
7. **The knobs are a table.** It holds 17 rows of about 10 numbers found by a search, not a rule. A changed lattice
   or default preset keeps a valid motif but may need the search rerun.

## Where each finding stands after the improvement (14 Nov; details in NOTES.md "After the critique")

1. **Mirror groups: partly improved.** The heads of 3\*3 and 4\*2 grew. \*2222's dark comma has a round back. 22\* and
   2\*22 are rebalanced. The root stays: in a kaleidoscope a dark comma cannot cross a mirror, and the light that
   touches a mirror is a symmetric pair. Every alternative structure I tried was worse.
2. **Boxy backs in the rotation groups: unchanged.** This is inherent to "a tile split in two"; softening the heels
   where dark meets light gained nothing visible.
3. **2222: fixed.** It is a balanced yin-yang now, with heads 0.26 / 0.19.
4. **\*x: slightly better** (bare 0.497 to 0.470). It is at the strip's geometric limit.
5. **Hairlines: fixed.**
   - \*\*'s mirror tail is at least 0.118 wide.
   - Three near-touches the new app check exposes in v1 are gone: 3\*3's and \*333's pinched necks and \*442's
     hairline eye ring.
6. **In the fold: unchanged** (the sand side's low contrast is the palette's).
7. **The knob table: unchanged.**

## What passes

- **(a) The pattern's own group is exactly the group: verified.** `dev/symcheck.mjs` makes a general search, not
  a sieve at chosen points. It tries every rotation and every reflection or glide at 7.5-degree steps, with every
  translation on a grid finer than 0.03 tile sizes over a lattice cell, against 400 interior sample points. No
  isometry outside the group keeps the tone in any group, and the nearest miss outside the group gets more than 6 %
  of the samples wrong. It does catch a planted half-turn (discs on o) and planted mirrors (discs on 333).
- **(b) It fills.** There is no background, and the bare disc is at most 0.41 in 14 groups.
- **(e) Both sides read.** The sand side reads flat (`back.png`).
- **The rotation groups work.** In xx, 22x, \*\* and o the yin-yang in the tile is big, calm and clearly handed.
