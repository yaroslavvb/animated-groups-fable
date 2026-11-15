# Spirals: the art director's critique (13 Nov 2026, second run)

All pictures were rendered fresh from the design as delivered (`design.js` of 23:03). They are in
`~/drive.unsynced/artifacts/the-folding-patterns/spiral/`:

- flat: `c1-sheet.png` (+ `c1-rows.json`), `c1-close-a/b/c.png` (520 px), `c1-zoom.png`, `c1-back.png`
- the app: `c1-app-t06.png`, `c1-fold-t06.png` and `c1-fold-t1.png` (the 3D pane at full size), `c1-app-t0-some.png`,
  `c1-fold-thin.png` (torus, Klein bottle, Moebius at 1.6x), `c1-app-phone.png`, `c1-app-recut.png`, `c1-app-tile.png`

The hard rules hold. `validate.mjs` (the production `validateShapes`) passes all 17 groups and their carried copies:
gap 0.052, stabilizer 1, no overlap, at most 418 vertices, at most 12 ms.

The numbers are in range too: dark 0.50 to 0.58, bare at most 0.38, solid at most 0.32. So what follows is about the
LOOK, which is what the owner asked about.

## Findings, worst first

1. **It reads as a tiled floor with a spiral groove, not as a field of commas. The mark is the tile.**
   - The arm's outer turn runs along the whole rim of the default tile, so the outline of every mark is the tile
     itself: rounded by 0.022 and set back by 0.026.
   - On the plane this shows as slabs shaped like the tile, with pale "grout" lines 0.052 wide between them. Each slab
     has a pale spiral GROOVE in it (the bare channel), and the eye follows the pale groove plus grout network rather
     than a dark mark.
   - At the sheet's scale there is no comma silhouette anywhere: no head, no tail.
   - Next to `bigcomma`, which reads at once as commas, this reads as a maze, or as a Greek-key floor.
2. **No head and no taper, so the eye gets no direction.**
   - The concept says "fat at the head and tapering".
   - The head is a hook of radius 0.07 at the centre, NARROWER than the arm beside it (at least 0.075). The arm keeps
     its width all the way out: the taper (`gamma` 0.8) cannot be seen.
   - The tail's end is a 0.052 point tucked into a corner beside a small bare wedge. At sheet scale neither end of the
     mark can be found.
   - One sees the hand (the winding sense), but not where the mark starts and ends. Following "which part of the tile
     went where" through the fold needs that.
3. **Square spirals, not a snail.**
   - The levels are the tile's own polygon with corners rounded by 0.022; they become round only near the centre.
   - In the squares and rectangles (`*2222`, `442`, `22x`, `xx`, `**`, `2*22`), the outer turns are straight runs with
     sharp bends: an archaic meander. In the hexagon of `2222` they are hexagonal, in triangles triangular.
   - The result is busy and angular: not the "fiddlehead, snail, curl" of the brief.
4. **`*x`: a uniform bar, and on the Moebius band almost a solid colour.**
   - The snail is a bar 2.3 tile sizes long with a curl 0.38 across at one end. On the plane it reads as stripes
     with hooks.
   - Folded (`c1-fold-t06.png`, `c1-fold-t1.png`), the band is nearly all dark teal: the bar covers three quarters of
     its width along most of its length, and the curl sits at the seam.
   - The twist of the band cannot be followed. This is the very group the owner named ("in *x, most of the surface is
     empty"), and a uniform band tells as little as an empty one.
5. **Torus and Klein bottle: stripes.** The long straight runs of a spiral that follows a long rectangle become
   parallel bands along the tube (`o` at t = 0.6 and t = 1, `xx`). No spiral can be seen on the closed torus.
6. **`632` and `3*3`: flames, and a starburst.**
   - In the obtuse triangle (squeezed 1.68 times), the spiral is a flattened ellipse whose tail runs into a 30-degree
     corner.
   - Twelve grout lines meet in a star at every 6-fold centre. The plane reads as a starburst, and each mark as an eye
     or a flame.
7. **The grout draws the page's default cut on the paper.**
   - The pale lines are the edges of the default tile. At the default cut they lie under the coloured seams, which is
     harmless.
   - After a re-cut or a dragged seed, the paper still shows the old cut as straight pale lines across the new tile.
     In `o`, `2222`, `333`, `442` and `632` these lines are no symmetry element at all.
8. **The sand side.**
   - Half folded and closed, most hinge groups show the BACK (`2222`, `333`, `22*`, `632`, `3*3`, `442`, the
     kaleidoscopes).
   - There the groove reads only as a pale pattern on pale paper. A bold silhouette matters more on that side than a
     fine groove.
9. **What already works, and should be kept.**
   - The hand is unmistakable: mirrored copies curl the other way, rotated ones turn about the centres. The symmetry
     group is exactly the group, because the mark has no symmetry of its own and its stabilizer is 1.
   - The Tile step's cards and the re-cut each carry ONE whole spiral, and the re-cut visibly re-assembles it.
   - `*333`, `*442` and `4*2` (triangles) read cleanly.

## Would the owner say "yes, this is the comma, but it fills the surface"?

No: he would say "it fills the surface, but it is a maze, not the comma".

What would make it the comma is the comma's two parts:

- a big round HEAD that one sees first;
- a tail that visibly TAPERS as it winds, to a sharp point.

Next comes rounder turns: a snail, not a key. Then the silhouette: a mark, not a tile. `*x` needs a mark that changes
along the band, not a bar.
